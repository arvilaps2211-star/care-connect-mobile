import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  LogOut, AlertCircle, MapPin, Phone, User, Heart, Navigation,
  Activity, CheckCircle, X, Truck, Clock, Bell, BellOff, Timer, Users,
  Wifi, WifiOff, Power, CircleDot
} from "lucide-react";
import GPSTracker from "@/components/GPSTracker";
import { calculateETA, getETAStatus } from "@/utils/eta";
import { useBackgroundLocation } from "@/hooks/useBackgroundLocation";
import { useRealtimeLocation, getAccuracyColor, getAccuracyBgColor } from "@/hooks/useRealtimeLocation";
import { openGoogleMapsNavigation } from "@/utils/navigation";
import { triggerFullEmergencyAlert } from "@/services/audioAlertService";

// --- Types ---

interface Guardian {
  id: string;
  name: string;
  relationship: string;
  contact_number: string;
}

interface Emergency {
  id: string;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  dispatched_to_ambulance: string | null;
  profiles: {
    name: string;
    phone: string;
    age: number;
    gender: string;
    address: string;
    profile_photo_url?: string;
  };
  medical_info: {
    blood_group: string;
    medical_history: string;
    additional_notes: string;
  }[];
  guardians: Guardian[];
}

interface AmbulanceInfo {
  id: string;
  name: string;
  contact_number: string;
}

type DriverStatus = "available" | "en_route" | "busy" | "offline";

const STATUS_CONFIG: Record<DriverStatus, { label: string; color: string; bgColor: string; icon: typeof Wifi }> = {
  available: { label: "Available", color: "text-emerald-400", bgColor: "bg-emerald-500/15 border-emerald-500/30", icon: Wifi },
  en_route: { label: "En Route", color: "text-blue-400", bgColor: "bg-blue-500/15 border-blue-500/30", icon: Navigation },
  busy: { label: "Busy", color: "text-amber-400", bgColor: "bg-amber-500/15 border-amber-500/30", icon: CircleDot },
  offline: { label: "Offline", color: "text-slate-400", bgColor: "bg-slate-500/15 border-slate-700", icon: WifiOff },
};

const STATUS_ORDER: DriverStatus[] = ["available", "en_route", "busy", "offline"];

// --- Component ---

const AmbulanceDriverDashboard = () => {
  const [searchParams] = useSearchParams();
  const ambulanceId = searchParams.get("id") || localStorage.getItem("ambulance_id");
  const [ambulanceInfo, setAmbulanceInfo] = useState<AmbulanceInfo | null>(null);
  const [dispatchedCases, setDispatchedCases] = useState<Emergency[]>([]);
  const [inTransitCases, setInTransitCases] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState<Emergency | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [driverStatus, setDriverStatus] = useState<DriverStatus>("available");
  const prevDispatchCountRef = useRef(0);

  const navigate = useNavigate();
  const { toast } = useToast();

  // --- GPS Tracking ---
  const isGPSActive = driverStatus === "available" || driverStatus === "en_route";

  const realtimeLocation = useRealtimeLocation({ enabled: isGPSActive, targetAccuracy: 15 });

  const backgroundLocation = useBackgroundLocation({
    ambulanceId,
    enabled: isGPSActive,
    intervalMs: 10000,
  });

  const currentLocation = realtimeLocation.location
    ? { latitude: realtimeLocation.location.latitude, longitude: realtimeLocation.location.longitude, accuracy: realtimeLocation.location.accuracy }
    : null;

  const accuracyGrade = realtimeLocation.accuracyGrade;
  const accuracyColor = getAccuracyColor(accuracyGrade);
  const accuracyBg = getAccuracyBgColor(accuracyGrade);

  // --- Notification permission ---
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast({ title: "Not Supported", description: "Push notifications are not supported in this browser", variant: "destructive" });
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      toast({ title: "Notifications Enabled", description: "You'll receive alerts for new dispatches" });
    }
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, []);

  // --- Init ---
  useEffect(() => {
    if (!ambulanceId) {
      toast({ title: "Error", description: "No ambulance ID. Use ?id=<ambulance-id> in URL.", variant: "destructive" });
      if (!import.meta.env.DEV) navigate("/ambulance/login");
      return;
    }
    localStorage.setItem("ambulance_id", ambulanceId);
    fetchAmbulanceInfo();
  }, [ambulanceId]);

  useEffect(() => {
    if (ambulanceInfo) {
      fetchCases();
      const unsub = subscribeToCases();
      return () => { if (unsub) unsub(); };
    }
  }, [ambulanceInfo]);

  // --- Fetch ambulance info ---
  const fetchAmbulanceInfo = async () => {
    if (!ambulanceId) return;
    try {
      const { data, error } = await supabase
        .from("ambulance_services")
        .select("id, name, contact_number")
        .eq("id", ambulanceId)
        .maybeSingle();

      if (error || !data) {
        toast({ title: "Ambulance Not Found", description: error?.message || "ID not found", variant: "destructive" });
        return;
      }
      setAmbulanceInfo(data);
    } catch (err: any) {
      console.error("[AMBULANCE] Fetch error:", err);
    }
  };

  // --- Fetch cases ---
  const fetchCases = async () => {
    if (!ambulanceId) return;
    setLoading(true);

    const [dispatchedRes, inTransitRes] = await Promise.all([
      supabase.from("emergencies").select("*").eq("dispatched_to_ambulance", ambulanceId).eq("status", "dispatched").order("created_at", { ascending: false }),
      supabase.from("emergencies").select("*").eq("dispatched_to_ambulance", ambulanceId).eq("status", "in_transit").order("created_at", { ascending: false }),
    ]);

    const enrichEmergencies = async (emergencies: any[]) => {
      return Promise.all(
        (emergencies || []).map(async (emergency) => {
          const [profileRes, medicalRes, guardiansRes] = await Promise.all([
            supabase.from("profiles").select("name, phone, age, gender, address, profile_photo_url").eq("user_id", emergency.user_id).single(),
            supabase.from("medical_info").select("blood_group, medical_history, additional_notes").eq("user_id", emergency.user_id),
            supabase.from("guardians").select("id, name, relationship, contact_number").eq("user_id", emergency.user_id),
          ]);
          return {
            ...emergency,
            profiles: profileRes.data || { name: "", phone: "", age: 0, gender: "", address: "" },
            medical_info: medicalRes.data || [],
            guardians: guardiansRes.data || [],
          };
        })
      );
    };

    const [enrichedDispatched, enrichedInTransit] = await Promise.all([
      enrichEmergencies(dispatchedRes.data || []),
      enrichEmergencies(inTransitRes.data || []),
    ]);

    // Audio alert when NEW dispatches arrive
    if (enrichedDispatched.length > prevDispatchCountRef.current && prevDispatchCountRef.current !== 0) {
      triggerFullEmergencyAlert();
      showBrowserNotification("🚨 New Case Dispatched!", "A new emergency has been assigned to you.");
    }
    prevDispatchCountRef.current = enrichedDispatched.length;

    setDispatchedCases(enrichedDispatched);
    setInTransitCases(enrichedInTransit);
    setLoading(false);
  };

  // --- Browser notification ---
  const showBrowserNotification = (title: string, body: string) => {
    if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico", tag: "ambulance-dispatch", requireInteraction: true });
    }
  };

  // --- Realtime subscription ---
  const subscribeToCases = () => {
    const channel = supabase
      .channel("ambulance-emergency-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "emergencies", filter: `dispatched_to_ambulance=eq.${ambulanceId}` }, () => {
        triggerFullEmergencyAlert();
        showBrowserNotification("🚨 New Case Dispatched!", "A new emergency has been assigned to you.");
        fetchCases();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "emergencies" }, () => {
        fetchCases();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  // --- Status toggle ---
  const cycleStatus = () => {
    const idx = STATUS_ORDER.indexOf(driverStatus);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    setDriverStatus(next);
    toast({ title: `Status: ${STATUS_CONFIG[next].label}`, description: next === "offline" ? "GPS tracking stopped" : "GPS tracking active" });
  };

  // --- Actions ---
  const handleAcceptCase = async (emergency: Emergency) => {
    if (driverStatus === "busy" || driverStatus === "offline") {
      toast({ title: "Cannot Accept", description: "Change status to Available first", variant: "destructive" });
      return;
    }
    setProcessingId(emergency.id);
    try {
      const { error } = await supabase
        .from("emergencies")
        .update({ status: "in_transit", accepted_by_ambulance: ambulanceId })
        .eq("id", emergency.id);
      if (error) throw error;

      setDriverStatus("en_route");
      toast({ title: "Case Accepted", description: "GPS tracking active. Navigate to patient." });

      if (typeof emergency.latitude === "number" && typeof emergency.longitude === "number") {
        setSelectedEmergency(emergency);
        setShowMap(true);
      }
      fetchCases();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineCase = async (emergency: Emergency) => {
    setProcessingId(emergency.id);
    try {
      const { error } = await supabase
        .from("emergencies")
        .update({ status: "accepted", dispatched_to_ambulance: null })
        .eq("id", emergency.id);
      if (error) throw error;
      toast({ title: "Case Declined", description: "Returned to hospital queue." });
      fetchCases();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteCase = async (emergency: Emergency) => {
    setProcessingId(emergency.id);
    try {
      const { error } = await supabase
        .from("emergencies")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", emergency.id);
      if (error) throw error;
      toast({ title: "Case Completed", description: "Patient delivered." });
      setShowMap(false);
      setSelectedEmergency(null);
      setDriverStatus("available");
      fetchCases();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleNavigate = (lat: number | null, lng: number | null) => {
    if (typeof lat !== "number" || typeof lng !== "number") {
      toast({ title: "Missing location", description: "No GPS coordinates for this case.", variant: "destructive" });
      return;
    }
    openGoogleMapsNavigation(lat, lng, currentLocation?.latitude, currentLocation?.longitude);
  };

  const getEmergencyETA = (emergency: Emergency) => {
    if (!currentLocation || typeof emergency.latitude !== "number" || typeof emergency.longitude !== "number") return null;
    return calculateETA(currentLocation, { latitude: emergency.latitude, longitude: emergency.longitude });
  };

  // --- Render case card ---
  const renderCaseCard = (emergency: Emergency, isInTransit: boolean) => {
    const eta = getEmergencyETA(emergency);
    const etaStatus = eta ? getETAStatus(eta.minutes) : null;

    return (
      <Card key={emergency.id} className={`bg-slate-800/50 border-l-4 ${isInTransit ? "border-l-blue-500" : "border-l-orange-500"} border-slate-700`}>
        <CardHeader className={`${isInTransit ? "bg-blue-500/5" : "bg-orange-500/5"} border-b border-slate-700`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className={`${isInTransit ? "bg-blue-500" : "bg-orange-500 animate-pulse"} p-2 rounded-lg`}>
                {isInTransit ? <Navigation className="w-5 h-5 text-white" /> : <AlertCircle className="w-5 h-5 text-white" />}
              </div>
              <div>
                <CardTitle className={`${isInTransit ? "text-blue-400" : "text-orange-400"} text-lg`}>
                  {isInTransit ? "EN ROUTE TO PATIENT" : "NEW DISPATCH"}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {new Date(emergency.created_at).toLocaleString()}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {eta && etaStatus && (
                <Badge className={`${etaStatus.bgColor} ${etaStatus.color} border-0`}>
                  <Timer className="w-3 h-3 mr-1" />
                  ETA: {eta.formatted}
                </Badge>
              )}
              {eta && (
                <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                  <Navigation className="w-3 h-3 mr-1" />
                  {eta.distance} km
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Patient Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-300 font-medium"><User className="w-4 h-4" />Patient</div>
              <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                {emergency.profiles.profile_photo_url && (
                  <div className="flex justify-center mb-3">
                    <img src={emergency.profiles.profile_photo_url} alt="Patient" className="w-16 h-16 rounded-full object-cover border-2 border-slate-600" />
                  </div>
                )}
                <div className="flex justify-between"><span className="text-slate-400">Name</span><span className="text-white font-medium">{emergency.profiles.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Age</span><span className="text-white">{emergency.profiles.age} years</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Gender</span><span className="text-white">{emergency.profiles.gender || "N/A"}</span></div>
                <a href={`tel:${emergency.profiles.phone}`} className="flex items-center justify-center gap-2 bg-blue-500/10 text-blue-400 py-2 rounded-lg hover:bg-blue-500/20 transition-colors">
                  <Phone className="w-4 h-4" />Call Patient
                </a>
              </div>
            </div>

            {/* Medical Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-300 font-medium"><Heart className="w-4 h-4" />Medical</div>
              <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                {emergency.medical_info[0] ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Blood</span>
                      <Badge className="bg-red-500/20 text-red-400">{emergency.medical_info[0].blood_group || "Unknown"}</Badge>
                    </div>
                    <div><span className="text-slate-400 text-sm">History</span><p className="text-white text-sm mt-1">{emergency.medical_info[0].medical_history || "None"}</p></div>
                    {emergency.medical_info[0].additional_notes && (
                      <div><span className="text-slate-400 text-sm">Notes</span><p className="text-yellow-400 text-sm mt-1">{emergency.medical_info[0].additional_notes}</p></div>
                    )}
                  </>
                ) : (
                  <p className="text-slate-500 text-sm">No medical info available</p>
                )}
              </div>
            </div>

            {/* Guardian Info + Location + Actions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-300 font-medium"><Users className="w-4 h-4" />Emergency Contacts</div>
              <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                {emergency.guardians && emergency.guardians.length > 0 ? (
                  emergency.guardians.map((g) => (
                    <div key={g.id} className="border-b border-slate-700 pb-2 last:border-0 last:pb-0">
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-sm">{g.relationship}</span>
                        <span className="text-white text-sm font-medium">{g.name}</span>
                      </div>
                      <a href={`tel:${g.contact_number}`} className="flex items-center gap-1 text-emerald-400 text-xs mt-1 hover:underline">
                        <Phone className="w-3 h-3" />{g.contact_number}
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">No emergency contacts</p>
                )}
              </div>

              {/* Location */}
              <div className="flex items-center gap-2 text-slate-300 font-medium"><MapPin className="w-4 h-4" />Location</div>
              <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                {emergency.profiles.address && (
                  <div className="text-sm"><span className="text-slate-400">Address</span><p className="text-white text-xs mt-1">{emergency.profiles.address}</p></div>
                )}
                <Button variant="outline" size="sm" onClick={() => handleNavigate(emergency.latitude, emergency.longitude)} className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
                  <Navigation className="w-4 h-4 mr-2" />Navigate (Google Maps)
                </Button>
              </div>

              {/* Actions */}
              {isInTransit ? (
                <Button onClick={() => handleCompleteCase(emergency)} disabled={processingId === emergency.id} className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-6" size="lg">
                  {processingId === emergency.id ? (<><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />Processing...</>) : (<><CheckCircle className="mr-2 h-5 w-5" />Complete Delivery</>)}
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button onClick={() => handleAcceptCase(emergency)} disabled={processingId === emergency.id || driverStatus === "busy" || driverStatus === "offline"} className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-4" size="lg">
                    {processingId === emergency.id ? (<><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />Processing...</>) : (<><CheckCircle className="mr-2 h-5 w-5" />Accept Case</>)}
                  </Button>
                  <Button onClick={() => handleDeclineCase(emergency)} disabled={processingId === emergency.id} variant="outline" className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 py-4" size="lg">
                    <X className="mr-2 h-5 w-5" />Decline
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // --- Render ---
  const statusConf = STATUS_CONFIG[driverStatus];
  const StatusIcon = statusConf.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2.5 rounded-xl">
                <Truck className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Ambulance Dashboard</h1>
                {ambulanceInfo && <p className="text-slate-400 text-sm">{ambulanceInfo.name}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* GPS Accuracy */}
              {currentLocation && typeof currentLocation.accuracy === "number" && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${accuracyBg}`}>
                  <Activity className={`w-3 h-3 ${accuracyColor}`} />
                  <span className={`text-xs font-medium ${accuracyColor}`}>GPS ±{Math.round(currentLocation.accuracy)}m</span>
                </div>
              )}

              {/* Background tracking indicator */}
              {backgroundLocation.isTracking && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-blue-500/10 border-blue-500/30">
                  <MapPin className="w-3 h-3 text-blue-400" />
                  <span className="text-xs text-blue-400">Tracking</span>
                </div>
              )}

              {/* Notifications */}
              {!notificationsEnabled ? (
                <Button variant="outline" size="sm" onClick={requestNotificationPermission} className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 h-8 text-xs">
                  <BellOff className="w-3 h-3 mr-1" />Alerts
                </Button>
              ) : (
                <div className="flex items-center gap-1 px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <Bell className="w-3 h-3 text-emerald-400" />
                </div>
              )}

              {/* Status Toggle */}
              <Button onClick={cycleStatus} variant="outline" className={`h-8 px-3 text-xs border ${statusConf.bgColor} ${statusConf.color} hover:opacity-80`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConf.label}
              </Button>

              {/* Logout */}
              <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("ambulance_id"); navigate("/ambulance/login"); }} className="text-slate-400 hover:text-white h-8">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Status banner when offline */}
        {driverStatus === "offline" && (
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 mb-4 flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-white text-sm font-medium">You are offline</p>
              <p className="text-slate-400 text-xs">GPS tracking paused. Change status to receive dispatches.</p>
            </div>
            <Button size="sm" onClick={() => setDriverStatus("available")} className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7">
              <Power className="w-3 h-3 mr-1" />Go Online
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="bg-orange-500/10 p-2.5 rounded-lg">
                <AlertCircle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Pending</p>
                <p className="text-xl font-bold text-white">{dispatchedCases.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="bg-blue-500/10 p-2.5 rounded-lg">
                <Navigation className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400">In Transit</p>
                <p className="text-xl font-bold text-white">{inTransitCases.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* GPS Map */}
        {showMap && selectedEmergency && (
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardHeader className="border-b border-slate-700 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <CardTitle className="text-white text-base">Live Navigation</CardTitle>
                  <CardDescription className="text-slate-400 text-xs">→ {selectedEmergency.profiles.name}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setShowMap(false); setSelectedEmergency(null); }} className="text-slate-400 hover:text-white h-7">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <GPSTracker
                currentLocation={currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude, accuracy: currentLocation.accuracy, label: "Ambulance" } : undefined}
                emergencyLocation={typeof selectedEmergency.latitude === "number" && typeof selectedEmergency.longitude === "number" ? { latitude: selectedEmergency.latitude, longitude: selectedEmergency.longitude, label: `Patient - ${selectedEmergency.profiles.name}` } : undefined}
                height="350px"
              />
            </CardContent>
          </Card>
        )}

        {/* Cases */}
        <div className="space-y-6">
          {loading ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-12 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-slate-400">Loading cases...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {inTransitCases.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-blue-400" />Active Cases
                  </h2>
                  {inTransitCases.map((e) => renderCaseCard(e, true))}
                </div>
              )}

              {dispatchedCases.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-400" />Dispatched to You
                  </h2>
                  {dispatchedCases.map((e) => renderCaseCard(e, false))}
                </div>
              )}

              {dispatchedCases.length === 0 && inTransitCases.length === 0 && (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-12 text-center">
                    <div className="bg-slate-700/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Truck className="w-8 h-8 text-slate-500" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">No Cases Assigned</h3>
                    <p className="text-slate-400">Waiting for hospital to dispatch cases</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AmbulanceDriverDashboard;
