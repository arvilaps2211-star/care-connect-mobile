import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  LogOut, AlertCircle, MapPin, Phone, User, Heart, Navigation, 
  Activity, CheckCircle, X, Truck, ArrowLeft, Clock, Bell, BellOff, Timer
} from "lucide-react";
import GPSTracker from "@/components/GPSTracker";
import { calculateETA, getETAStatus } from "@/utils/eta";

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
}

type DriverLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
};

interface AmbulanceInfo {
  id: string;
  name: string;
  contact_number: string;
}

const AmbulanceDriverDashboard = () => {
  const [searchParams] = useSearchParams();
  const ambulanceId = searchParams.get("id");
  const [ambulanceInfo, setAmbulanceInfo] = useState<AmbulanceInfo | null>(null);
  const [dispatchedCases, setDispatchedCases] = useState<Emergency[]>([]);
  const [inTransitCases, setInTransitCases] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState<Emergency | null>(null);
  const [currentLocation, setCurrentLocation] = useState<DriverLocation | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  // Request notification permission
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast({
        title: "Not Supported",
        description: "Push notifications are not supported in this browser",
        variant: "destructive",
      });
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      toast({
        title: "Notifications Enabled",
        description: "You'll receive alerts when new cases are dispatched",
      });
    } else {
      toast({
        title: "Notifications Blocked",
        description: "Enable notifications in browser settings to receive alerts",
        variant: "destructive",
      });
    }
  };

  // Check notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, []);

  // Watch current location for GPS tracking
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const next: DriverLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };

        // Prefer more accurate fixes; still refresh periodically.
        setCurrentLocation((prev) => {
          if (!prev) return next;

          const prevAcc = typeof prev.accuracy === "number" ? prev.accuracy : Number.POSITIVE_INFINITY;
          const nextAcc = typeof next.accuracy === "number" ? next.accuracy : Number.POSITIVE_INFINITY;

          // Update when accuracy improves or when 10s elapsed.
          const prevTs = prev.timestamp ?? 0;
          const nextTs = next.timestamp ?? Date.now();
          const timeElapsed = nextTs - prevTs;

          if (nextAcc <= prevAcc || timeElapsed > 10_000) return next;
          return prev;
        });
      },
      (error) => console.error("GPS error:", error),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!ambulanceId) {
      toast({
        title: "Error",
        description: "No ambulance ID provided",
        variant: "destructive",
      });
      navigate("/hospital/login");
      return;
    }
    fetchAmbulanceInfo();
  }, [ambulanceId]);

  useEffect(() => {
    if (ambulanceInfo) {
      fetchCases();
      const unsubscribe = subscribeToCases();
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [ambulanceInfo]);

  const fetchAmbulanceInfo = async () => {
    if (!ambulanceId) return;

    const { data, error } = await supabase
      .from("ambulance_services")
      .select("id, name, contact_number")
      .eq("id", ambulanceId)
      .single();

    if (error || !data) {
      toast({
        title: "Error",
        description: "Ambulance not found",
        variant: "destructive",
      });
      navigate("/hospital/login");
      return;
    }

    setAmbulanceInfo(data);
  };

  const fetchCases = async () => {
    if (!ambulanceId) return;
    setLoading(true);

    // Fetch dispatched cases (awaiting decision)
    const { data: dispatchedData } = await supabase
      .from("emergencies")
      .select("*")
      .eq("dispatched_to_ambulance", ambulanceId)
      .eq("status", "dispatched")
      .order("created_at", { ascending: false });

    // Fetch in-transit cases (accepted by this ambulance)
    const { data: inTransitData } = await supabase
      .from("emergencies")
      .select("*")
      .eq("dispatched_to_ambulance", ambulanceId)
      .eq("status", "in_transit")
      .order("created_at", { ascending: false });

    // Enrich with profile and medical info
    const enrichEmergencies = async (emergencies: any[]) => {
      return Promise.all(
        (emergencies || []).map(async (emergency) => {
          const [profileRes, medicalRes] = await Promise.all([
            supabase.from("profiles").select("name, phone, age, gender, address, profile_photo_url").eq("user_id", emergency.user_id).single(),
            supabase.from("medical_info").select("blood_group, medical_history, additional_notes").eq("user_id", emergency.user_id),
          ]);

          return {
            ...emergency,
            profiles: profileRes.data || { name: "", phone: "", age: 0, gender: "", address: "" },
            medical_info: medicalRes.data || [],
          };
        })
      );
    };

    const [enrichedDispatched, enrichedInTransit] = await Promise.all([
      enrichEmergencies(dispatchedData || []),
      enrichEmergencies(inTransitData || []),
    ]);

    setDispatchedCases(enrichedDispatched);
    setInTransitCases(enrichedInTransit);
    setLoading(false);
  };

  const showBrowserNotification = (title: string, body: string) => {
    if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: "ambulance-dispatch",
        requireInteraction: true,
      });
    }
  };

  const subscribeToCases = () => {
    const channel = supabase
      .channel("ambulance-emergency-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "emergencies",
          filter: `dispatched_to_ambulance=eq.${ambulanceId}`,
        },
        (payload) => {
          console.log("New case dispatched:", payload);
          showBrowserNotification(
            "🚨 New Case Dispatched!",
            "A new emergency case has been assigned to you. Tap to view."
          );
          fetchCases();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "emergencies",
        },
        () => {
          fetchCases();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAcceptCase = async (emergency: Emergency) => {
    setProcessingId(emergency.id);

    try {
      const { error } = await supabase
        .from("emergencies")
        .update({
          status: "in_transit",
          accepted_by_ambulance: ambulanceId,
        })
        .eq("id", emergency.id);

      if (error) throw error;

      toast({
        title: "Case Accepted",
        description: "You are now en route to the patient. GPS tracking enabled.",
      });

      // Show GPS map only if we have patient coordinates
      if (typeof emergency.latitude === "number" && typeof emergency.longitude === "number") {
        setSelectedEmergency(emergency);
        setShowMap(true);
      } else {
        toast({
          title: "No patient location",
          description: "This case has no GPS coordinates, so the live map can't be shown.",
          variant: "destructive",
        });
        setSelectedEmergency(null);
        setShowMap(false);
      }

      fetchCases();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to accept case",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineCase = async (emergency: Emergency) => {
    setProcessingId(emergency.id);
    
    try {
      const { error } = await supabase
        .from("emergencies")
        .update({ 
          status: "accepted",
          dispatched_to_ambulance: null
        })
        .eq("id", emergency.id);

      if (error) throw error;

      toast({
        title: "Case Declined",
        description: "Case has been returned to the hospital queue.",
      });

      fetchCases();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to decline case",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteCase = async (emergency: Emergency) => {
    setProcessingId(emergency.id);
    
    try {
      const { error } = await supabase
        .from("emergencies")
        .update({ 
          status: "resolved",
          resolved_at: new Date().toISOString()
        })
        .eq("id", emergency.id);

      if (error) throw error;

      toast({
        title: "Case Completed",
        description: "Patient has been delivered to hospital.",
      });

      setShowMap(false);
      setSelectedEmergency(null);
      fetchCases();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete case",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const openGoogleMaps = (lat: number | null, lng: number | null) => {
    if (typeof lat !== "number" || typeof lng !== "number") {
      toast({
        title: "Missing location",
        description: "This case doesn't have GPS coordinates.",
        variant: "destructive",
      });
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, "_blank");
  };

  const getEmergencyETA = (emergency: Emergency) => {
    if (!currentLocation) return null;
    if (typeof emergency.latitude !== "number" || typeof emergency.longitude !== "number") return null;

    return calculateETA(currentLocation, {
      latitude: emergency.latitude,
      longitude: emergency.longitude,
    });
  };

  const renderCaseCard = (emergency: Emergency, isInTransit: boolean) => {
    const eta = getEmergencyETA(emergency);
    const etaStatus = eta ? getETAStatus(eta.minutes) : null;
    
    return (
    <Card key={emergency.id} className={`bg-slate-800/50 border-l-4 ${isInTransit ? 'border-l-blue-500' : 'border-l-orange-500'} border-slate-700`}>
      <CardHeader className={`${isInTransit ? 'bg-blue-500/5' : 'bg-orange-500/5'} border-b border-slate-700`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${isInTransit ? 'bg-blue-500' : 'bg-orange-500 animate-pulse'} p-2 rounded-lg`}>
              {isInTransit ? <Navigation className="w-5 h-5 text-white" /> : <AlertCircle className="w-5 h-5 text-white" />}
            </div>
            <div>
              <CardTitle className={`${isInTransit ? 'text-blue-400' : 'text-orange-400'} text-lg`}>
                {isInTransit ? 'EN ROUTE TO PATIENT' : 'NEW DISPATCH'}
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
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <User className="w-4 h-4" />
              Patient
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
              {emergency.profiles.profile_photo_url && (
                <div className="flex justify-center mb-3">
                  <img src={emergency.profiles.profile_photo_url} alt="Patient" className="w-16 h-16 rounded-full object-cover border-2 border-slate-600" />
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Name</span>
                <span className="text-white font-medium">{emergency.profiles.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Age</span>
                <span className="text-white">{emergency.profiles.age} years</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gender</span>
                <span className="text-white">{emergency.profiles.gender || "N/A"}</span>
              </div>
              <a href={`tel:${emergency.profiles.phone}`} className="flex items-center justify-center gap-2 bg-blue-500/10 text-blue-400 py-2 rounded-lg hover:bg-blue-500/20 transition-colors">
                <Phone className="w-4 h-4" />
                Call Patient
              </a>
            </div>
          </div>

          {/* Medical Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Heart className="w-4 h-4" />
              Medical
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
              {emergency.medical_info[0] ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Blood</span>
                    <Badge className="bg-red-500/20 text-red-400">{emergency.medical_info[0].blood_group || "Unknown"}</Badge>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">History</span>
                    <p className="text-white text-sm mt-1">{emergency.medical_info[0].medical_history || "None"}</p>
                  </div>
                  {emergency.medical_info[0].additional_notes && (
                    <div>
                      <span className="text-slate-400 text-sm">Notes</span>
                      <p className="text-yellow-400 text-sm mt-1">{emergency.medical_info[0].additional_notes}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-slate-500 text-sm">No medical info available</p>
              )}
            </div>
          </div>

          {/* Location & Actions */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <MapPin className="w-4 h-4" />
              Location
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
              {emergency.profiles.address && (
                <div className="text-sm">
                  <span className="text-slate-400">Address</span>
                  <p className="text-white text-xs mt-1">{emergency.profiles.address}</p>
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => openGoogleMaps(emergency.latitude, emergency.longitude)} 
                className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Navigate
              </Button>
            </div>

            {/* Actions */}
            {isInTransit ? (
              <Button 
                onClick={() => handleCompleteCase(emergency)} 
                disabled={processingId === emergency.id}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-6" 
                size="lg"
              >
                {processingId === emergency.id ? (
                  <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />Processing...</>
                ) : (
                  <><CheckCircle className="mr-2 h-5 w-5" />Complete Delivery</>
                )}
              </Button>
            ) : (
              <div className="space-y-2">
                <Button 
                  onClick={() => handleAcceptCase(emergency)} 
                  disabled={processingId === emergency.id}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-4" 
                  size="lg"
                >
                  {processingId === emergency.id ? (
                    <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />Processing...</>
                  ) : (
                    <><CheckCircle className="mr-2 h-5 w-5" />Accept Case</>
                  )}
                </Button>
                <Button 
                  onClick={() => handleDeclineCase(emergency)} 
                  disabled={processingId === emergency.id}
                  variant="outline"
                  className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 py-4" 
                  size="lg"
                >
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate("/hospital/login")} 
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-xl">
                <Truck className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Ambulance Dashboard</h1>
                {ambulanceInfo && <p className="text-slate-400">{ambulanceInfo.name}</p>}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {!notificationsEnabled ? (
                <Button
                  variant="outline"
                  onClick={requestNotificationPermission}
                  className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                >
                  <BellOff className="w-4 h-4 mr-2" />
                  Enable Notifications
                </Button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <Bell className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 text-sm">Notifications On</span>
                </div>
              )}

              {typeof currentLocation?.accuracy === "number" && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <Activity className="w-3 h-3 text-slate-300" />
                  <span className="text-slate-200 text-sm">GPS ±{Math.round(currentLocation.accuracy)}m</span>
                </div>
              )}

              <Badge className="px-3 py-1.5 bg-orange-500/10 text-orange-400 border-orange-500/20">
                <Truck className="w-3 h-3 mr-1" />
                Driver View
              </Badge>
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-emerald-400 text-sm font-medium">Online</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-orange-500/10 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Awaiting Decision</p>
                <p className="text-2xl font-bold text-white">{dispatchedCases.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-blue-500/10 p-3 rounded-lg">
                <Navigation className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-slate-400">In Transit</p>
                <p className="text-2xl font-bold text-white">{inTransitCases.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* GPS Map */}
        {showMap && selectedEmergency && (
          <Card className="bg-slate-800/50 border-slate-700 mb-8">
            <CardHeader className="border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/10 p-2 rounded-lg">
                    <Activity className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Live Navigation</CardTitle>
                    <CardDescription className="text-slate-400">
                      En route to: {selectedEmergency.profiles.name}
                    </CardDescription>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setShowMap(false); setSelectedEmergency(null); }} 
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <GPSTracker
                currentLocation={
                  currentLocation
                    ? {
                        latitude: currentLocation.latitude,
                        longitude: currentLocation.longitude,
                        accuracy: currentLocation.accuracy,
                        label: "Ambulance",
                      }
                    : undefined
                }
                emergencyLocation={
                  typeof selectedEmergency.latitude === "number" && typeof selectedEmergency.longitude === "number"
                    ? {
                        latitude: selectedEmergency.latitude,
                        longitude: selectedEmergency.longitude,
                        label: `Patient - ${selectedEmergency.profiles.name}`,
                      }
                    : undefined
                }
                height="400px"
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
              {/* In Transit Cases */}
              {inTransitCases.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-blue-400" />
                    Active Cases
                  </h2>
                  {inTransitCases.map((e) => renderCaseCard(e, true))}
                </div>
              )}

              {/* Dispatched Cases */}
              {dispatchedCases.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-400" />
                    Dispatched to You
                  </h2>
                  {dispatchedCases.map((e) => renderCaseCard(e, false))}
                </div>
              )}

              {/* Empty State */}
              {dispatchedCases.length === 0 && inTransitCases.length === 0 && (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-12 text-center">
                    <div className="bg-slate-700/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Truck className="w-8 h-8 text-slate-500" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">No Cases Assigned</h3>
                    <p className="text-slate-400">Waiting for hospital to dispatch cases to you</p>
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
