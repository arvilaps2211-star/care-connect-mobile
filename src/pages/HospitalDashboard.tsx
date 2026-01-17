import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { LogOut, AlertCircle, MapPin, Phone, Clock, User, Heart, Navigation, Activity, Archive, FileX, CheckCircle, Ambulance, Map, Plus, Trash2, Truck, X, Timer, Monitor } from "lucide-react";
import OpenStreetMapEmbed from "@/components/OpenStreetMapEmbed";
import { calculateETA, getETAStatus, calculateDistance } from "@/utils/eta";

interface Emergency {
  id: string;
  created_at: string;
  latitude: number;
  longitude: number;
  status: string;
  accepted_by_hospital: string | null;
  accepted_by_ambulance: string | null;
  dispatched_to_ambulance: string | null;
  resolved_at: string | null;
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

interface AmbulanceService {
  id: string;
  name: string;
  contact_number: string;
  latitude: number;
  longitude: number;
}

const HospitalDashboard = () => {
  const [activeEmergencies, setActiveEmergencies] = useState<Emergency[]>([]);
  const [acceptedEmergencies, setAcceptedEmergencies] = useState<Emergency[]>([]);
  const [dispatchedEmergencies, setDispatchedEmergencies] = useState<Emergency[]>([]);
  const [expiredEmergencies, setExpiredEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityInfo, setEntityInfo] = useState<any>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("active");
  const [showMap, setShowMap] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedEmergency, setSelectedEmergency] = useState<Emergency | null>(null);
  
  // Ambulance management
  const [ambulances, setAmbulances] = useState<AmbulanceService[]>([]);
  const [showAddAmbulance, setShowAddAmbulance] = useState(false);
  const [newAmbulance, setNewAmbulance] = useState({
    name: "",
    contact_number: "",
    latitude: "",
    longitude: "",
  });
  const [addingAmbulance, setAddingAmbulance] = useState(false);
  
  // Dispatch modal
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [emergencyToDispatch, setEmergencyToDispatch] = useState<Emergency | null>(null);
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Watch current location for GPS tracking
  useEffect(() => {
    if (showMap && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => console.error("GPS error:", error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [showMap]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (entityInfo) {
      fetchAllEmergencies();
      fetchAmbulances();
      const unsubscribe = subscribeToEmergencies();
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [entityInfo]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/hospital/login");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roles || roles.role !== "hospital") {
      navigate("/hospital/login");
      return;
    }

    const { data: hospital } = await supabase
      .from("hospitals")
      .select("*")
      .eq("user_id", user.id)
      .single();
    setEntityInfo(hospital);
  };

  const fetchAmbulances = async () => {
    if (!entityInfo?.id) return;
    
    const { data } = await supabase
      .from("hospital_ambulances")
      .select(`
        ambulance_id,
        ambulance_services (
          id,
          name,
          contact_number,
          latitude,
          longitude
        )
      `)
      .eq("hospital_id", entityInfo.id);

    if (data) {
      const ambulanceList = data
        .filter((item: any) => item.ambulance_services)
        .map((item: any) => item.ambulance_services);
      setAmbulances(ambulanceList);
    }
  };

  const fetchAllEmergencies = async () => {
    setLoading(true);
    
    // Fetch active emergencies
    const { data: activeData } = await supabase
      .from("emergencies")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    // Fetch accepted emergencies (hospital accepted, pending dispatch)
    const { data: acceptedData } = await supabase
      .from("emergencies")
      .select("*")
      .eq("status", "accepted")
      .order("created_at", { ascending: false });

    // Fetch dispatched emergencies (sent to ambulance)
    const { data: dispatchedData } = await supabase
      .from("emergencies")
      .select("*")
      .eq("status", "dispatched")
      .order("created_at", { ascending: false });

    // Fetch resolved/expired emergencies
    const { data: expiredData } = await supabase
      .from("emergencies")
      .select("*")
      .in("status", ["resolved", "closed", "declined"])
      .order("created_at", { ascending: false })
      .limit(50);

    // Enrich all data with profile and medical info
    const enrichEmergencies = async (emergencies: any[]) => {
      return Promise.all(
        (emergencies || []).map(async (emergency) => {
          const [profileRes, medicalRes, guardiansRes] = await Promise.all([
            supabase.from("profiles").select("name, phone, age, gender, address, profile_photo_url").eq("user_id", emergency.user_id).single(),
            supabase.from("medical_info").select("blood_group, medical_history, additional_notes").eq("user_id", emergency.user_id),
            supabase.from("guardians").select("name, contact_number, relationship").eq("user_id", emergency.user_id),
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

    const [enrichedActive, enrichedAccepted, enrichedDispatched, enrichedExpired] = await Promise.all([
      enrichEmergencies(activeData || []),
      enrichEmergencies(acceptedData || []),
      enrichEmergencies(dispatchedData || []),
      enrichEmergencies(expiredData || []),
    ]);

    setActiveEmergencies(enrichedActive);
    setAcceptedEmergencies(enrichedAccepted);
    setDispatchedEmergencies(enrichedDispatched);
    setExpiredEmergencies(enrichedExpired);
    setLoading(false);
  };

  const subscribeToEmergencies = () => {
    const channel = supabase
      .channel("emergency-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "emergencies",
        },
        () => {
          fetchAllEmergencies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getEmergencyETA = (emergency: Emergency, fromAmbulanceId?: string) => {
    // If ambulance specified, use its location; otherwise use hospital location
    let fromLocation = entityInfo ? { latitude: entityInfo.latitude, longitude: entityInfo.longitude } : null;
    
    if (fromAmbulanceId) {
      const ambulance = ambulances.find(a => a.id === fromAmbulanceId);
      if (ambulance) {
        fromLocation = { latitude: ambulance.latitude, longitude: ambulance.longitude };
      }
    }
    
    if (!fromLocation) return null;
    return calculateETA(fromLocation, { latitude: emergency.latitude, longitude: emergency.longitude });
  };

  const getDistanceFromHospital = (emergency: Emergency): string => {
    if (!entityInfo) return "N/A";
    const distance = calculateDistance(
      { latitude: entityInfo.latitude, longitude: entityInfo.longitude },
      { latitude: emergency.latitude, longitude: emergency.longitude }
    );
    return distance.toFixed(1);
  };

  const openMapModal = (emergency: Emergency) => {
    setSelectedEmergency(emergency);
    setShowMap(true);
  };

  const handleAcceptEmergency = async (emergency: Emergency) => {
    setDispatchingId(emergency.id);
    
    try {
      const { error } = await supabase
        .from("emergencies")
        .update({ 
          accepted_by_hospital: entityInfo?.id, 
          status: "accepted" 
        })
        .eq("id", emergency.id);

      if (error) throw error;

      // Notify guardian that hospital has accepted the case
      try {
        const { error: notifyError } = await supabase.functions.invoke('notify-hospital-acceptance', {
          body: {
            emergencyId: emergency.id,
            hospitalId: entityInfo?.id,
            hospitalName: entityInfo?.name,
            hospitalPhone: entityInfo?.contact_number,
            patientLocation: {
              latitude: emergency.latitude,
              longitude: emergency.longitude,
            },
          },
        });
        
        if (notifyError) {
          console.error("Failed to notify guardian:", notifyError);
        } else {
          console.log("Guardian notified of hospital acceptance");
        }
      } catch (notifyErr) {
        console.error("Guardian notification error:", notifyErr);
      }

      toast({
        title: "Emergency Accepted",
        description: "Guardian has been notified. Dispatch an ambulance when ready.",
      });

      fetchAllEmergencies();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to accept emergency",
        variant: "destructive",
      });
    } finally {
      setDispatchingId(null);
    }
  };

  const openDispatchModal = (emergency: Emergency) => {
    setEmergencyToDispatch(emergency);
    setSelectedAmbulanceId(null);
    setShowDispatchModal(true);
  };

  const handleDispatchAmbulance = async () => {
    if (!emergencyToDispatch || !selectedAmbulanceId) return;
    
    setDispatchingId(emergencyToDispatch.id);
    
    try {
      const { error } = await supabase
        .from("emergencies")
        .update({ 
          dispatched_to_ambulance: selectedAmbulanceId,
          status: "dispatched" 
        })
        .eq("id", emergencyToDispatch.id);

      if (error) throw error;

      // Send notification to ambulance driver via edge function
      try {
        const { error: notifyError } = await supabase.functions.invoke('notify-ambulance-dispatch', {
          body: {
            emergencyId: emergencyToDispatch.id,
            ambulanceId: selectedAmbulanceId,
            patientName: emergencyToDispatch.profiles.name,
            patientPhone: emergencyToDispatch.profiles.phone,
            location: {
              latitude: emergencyToDispatch.latitude,
              longitude: emergencyToDispatch.longitude,
            },
          },
        });
        
        if (notifyError) {
          console.error("Failed to send notification:", notifyError);
        } else {
          console.log("Ambulance driver notified successfully");
        }
      } catch (notifyErr) {
        console.error("Notification error:", notifyErr);
      }

      // Set up GPS tracking
      setSelectedEmergency(emergencyToDispatch);
      setShowMap(true);
      setShowDispatchModal(false);

      toast({
        title: "Ambulance Dispatched",
        description: "The ambulance driver has been notified via SMS.",
      });

      fetchAllEmergencies();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to dispatch ambulance",
        variant: "destructive",
      });
    } finally {
      setDispatchingId(null);
    }
  };

  const handleAmbulanceDecision = async (emergencyId: string, decision: "accept" | "decline") => {
    try {
      if (decision === "accept") {
        const { error } = await supabase
          .from("emergencies")
          .update({ 
            status: "in_transit",
            accepted_by_ambulance: entityInfo?.id
          })
          .eq("id", emergencyId);
        if (error) throw error;
        toast({ title: "Case Accepted", description: "Ambulance is en route to patient." });
      } else {
        const { error } = await supabase
          .from("emergencies")
          .update({ 
            status: "accepted",
            dispatched_to_ambulance: null
          })
          .eq("id", emergencyId);
        if (error) throw error;
        toast({ title: "Case Declined", description: "Case returned to hospital queue." });
      }
      fetchAllEmergencies();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleResolveCase = async (emergencyId: string) => {
    try {
      const { error } = await supabase
        .from("emergencies")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", emergencyId);

      if (error) throw error;

      toast({
        title: "Case Resolved",
        description: "Emergency has been marked as resolved",
      });

      fetchAllEmergencies();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resolve case",
        variant: "destructive",
      });
    }
  };

  const handleAddAmbulance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityInfo?.id) return;
    
    setAddingAmbulance(true);
    
    try {
      const { error } = await supabase.rpc('register_ambulance_for_hospital', {
        p_hospital_id: entityInfo.id,
        p_service_name: newAmbulance.name,
        p_contact_number: newAmbulance.contact_number,
        p_latitude: parseFloat(newAmbulance.latitude),
        p_longitude: parseFloat(newAmbulance.longitude),
      });

      if (error) throw error;

      toast({
        title: "Ambulance Added",
        description: "New ambulance service has been registered under your hospital.",
      });

      setShowAddAmbulance(false);
      setNewAmbulance({ name: "", contact_number: "", latitude: "", longitude: "" });
      fetchAmbulances();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add ambulance",
        variant: "destructive",
      });
    } finally {
      setAddingAmbulance(false);
    }
  };

  const handleRemoveAmbulance = async (ambulanceId: string) => {
    try {
      const { error } = await supabase
        .from("hospital_ambulances")
        .delete()
        .eq("hospital_id", entityInfo?.id)
        .eq("ambulance_id", ambulanceId);

      if (error) throw error;

      toast({ title: "Ambulance Removed", description: "Ambulance has been unlinked from your hospital." });
      fetchAmbulances();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setNewAmbulance(prev => ({
            ...prev,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
          }));
          toast({ title: "Location Detected", description: "Coordinates have been set" });
        },
        () => toast({ title: "Error", description: "Could not get location", variant: "destructive" })
      );
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/hospital/login");
  };

  const getAmbulanceName = (ambulanceId: string | null) => {
    if (!ambulanceId) return "Unknown";
    const ambulance = ambulances.find(a => a.id === ambulanceId);
    return ambulance?.name || "Unknown";
  };

  const renderEmergencyCard = (emergency: Emergency, cardType: "active" | "accepted" | "dispatched" | "expired") => {
    const eta = getEmergencyETA(emergency, emergency.dispatched_to_ambulance || undefined);
    const etaStatus = eta ? getETAStatus(eta.minutes) : null;
    
    return (
    <Card key={emergency.id} className={`bg-slate-800/50 border-l-4 ${
      cardType === "expired" ? 'border-l-slate-500' : 
      cardType === "dispatched" ? 'border-l-orange-500' :
      cardType === "accepted" ? 'border-l-amber-500' :
      'border-l-red-500'
    } border-slate-700 overflow-hidden`}>
      <CardHeader className={`${
        cardType === "expired" ? 'bg-slate-700/20' : 
        cardType === "dispatched" ? 'bg-orange-500/5' :
        cardType === "accepted" ? 'bg-amber-500/5' :
        'bg-red-500/5'
      } border-b border-slate-700`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${
              cardType === "expired" ? 'bg-slate-500' : 
              cardType === "dispatched" ? 'bg-orange-500' :
              cardType === "accepted" ? 'bg-amber-500' :
              'bg-red-500 animate-pulse'
            } p-2 rounded-lg`}>
              {cardType === "expired" ? <Archive className="w-5 h-5 text-white" /> : 
               cardType === "dispatched" ? <Truck className="w-5 h-5 text-white" /> :
               <AlertCircle className="w-5 h-5 text-white" />}
            </div>
            <div>
              <CardTitle className={`${
                cardType === "expired" ? 'text-slate-400' : 
                cardType === "dispatched" ? 'text-orange-400' :
                cardType === "accepted" ? 'text-amber-400' :
                'text-red-400'
              } text-lg`}>
                {cardType === "expired" ? 'CASE CLOSED' : 
                 cardType === "dispatched" ? 'DISPATCHED TO AMBULANCE' :
                 cardType === "accepted" ? 'PENDING DISPATCH' :
                 'EMERGENCY ALERT'}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {new Date(emergency.created_at).toLocaleString()}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {eta && etaStatus && cardType !== "expired" && (
              <Badge className={`${etaStatus.bgColor} ${etaStatus.color} border-0`}>
                <Timer className="w-3 h-3 mr-1" />
                ETA: {eta.formatted}
              </Badge>
            )}
            {cardType === "dispatched" && emergency.dispatched_to_ambulance && (
              <Badge variant="outline" className="border-orange-500/30 text-orange-400">
                <Truck className="w-3 h-3 mr-1" />
                {getAmbulanceName(emergency.dispatched_to_ambulance)}
              </Badge>
            )}
            <Badge variant="outline" className="border-blue-500/30 text-blue-400">
              <Navigation className="w-3 h-3 mr-1" />
              {getDistanceFromHospital(emergency)} km
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Patient Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <User className="w-4 h-4" />
              Patient Information
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
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Contact</span>
                <a href={`tel:${emergency.profiles.phone}`} className="text-blue-400 hover:underline flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {emergency.profiles.phone}
                </a>
              </div>
              {emergency.profiles.address && (
                <div className="pt-2 border-t border-slate-700">
                  <span className="text-slate-400 text-xs">Residential Address</span>
                  <p className="text-white text-sm mt-1">{emergency.profiles.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Medical Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Heart className="w-4 h-4" />
              Medical Details
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
              {emergency.medical_info[0] ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Blood Group</span>
                    <Badge className="bg-red-500/20 text-red-400">{emergency.medical_info[0].blood_group || "Unknown"}</Badge>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Medical History</span>
                    <p className="text-white text-sm mt-1">{emergency.medical_info[0].medical_history || "None reported"}</p>
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
              <div className="text-sm">
                <span className="text-slate-400">Current Coordinates</span>
                <p className="text-white font-mono text-xs mt-1">{emergency.latitude.toFixed(6)}, {emergency.longitude.toFixed(6)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => openMapModal(emergency)} className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
                <Navigation className="w-4 h-4 mr-2" />
                View on Map
              </Button>
            </div>

            {/* Actions based on card type */}
            {cardType === "active" && (
              <Button onClick={() => handleAcceptEmergency(emergency)} disabled={dispatchingId === emergency.id} className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-6" size="lg">
                {dispatchingId === emergency.id ? (
                  <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />Processing...</>
                ) : (
                  <><CheckCircle className="mr-2 h-5 w-5" />Accept Emergency</>
                )}
              </Button>
            )}

            {cardType === "accepted" && (
              <Button onClick={() => openDispatchModal(emergency)} disabled={ambulances.length === 0} className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-6" size="lg">
                <Ambulance className="mr-2 h-5 w-5" />
                {ambulances.length === 0 ? "Add Ambulance First" : "Dispatch Ambulance"}
              </Button>
            )}

            {cardType === "dispatched" && (
              <div className="space-y-2">
                <p className="text-center text-slate-400 text-sm">Awaiting ambulance decision</p>
                <Button onClick={() => handleResolveCase(emergency.id)} className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold" size="lg">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Mark as Resolved
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
  };

  const renderEmptyState = (icon: React.ReactNode, title: string, description: string) => (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="p-12 text-center">
        <div className="bg-slate-700/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">{icon}</div>
        <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
        <p className="text-slate-400">{description}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-red-500 to-red-600 p-3 rounded-xl">
                <Activity className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">CareConnect Hospitals</h1>
                {entityInfo && <p className="text-slate-400">{entityInfo.name}</p>}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge className="px-3 py-1.5 bg-slate-800/80 text-slate-400 border-slate-700">
                <Monitor className="w-3 h-3 mr-1" />
                Desktop Portal
              </Badge>
              <Badge className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border-blue-500/20">Hospital Staff</Badge>
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-emerald-400 text-sm font-medium">System Online</span>
              </div>
              <Button variant="ghost" onClick={handleLogout} className="text-slate-400 hover:text-white hover:bg-slate-800">
                <LogOut className="mr-2 h-4 w-4" />Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-red-500/10 p-3 rounded-lg"><AlertCircle className="w-6 h-6 text-red-500" /></div>
              <div>
                <p className="text-sm text-slate-400">Active</p>
                <p className="text-2xl font-bold text-white">{activeEmergencies.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-amber-500/10 p-3 rounded-lg"><Archive className="w-6 h-6 text-amber-500" /></div>
              <div>
                <p className="text-sm text-slate-400">Pending</p>
                <p className="text-2xl font-bold text-white">{acceptedEmergencies.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-orange-500/10 p-3 rounded-lg"><Truck className="w-6 h-6 text-orange-500" /></div>
              <div>
                <p className="text-sm text-slate-400">Dispatched</p>
                <p className="text-2xl font-bold text-white">{dispatchedEmergencies.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-slate-500/10 p-3 rounded-lg"><FileX className="w-6 h-6 text-slate-500" /></div>
              <div>
                <p className="text-sm text-slate-400">Closed</p>
                <p className="text-2xl font-bold text-white">{expiredEmergencies.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-emerald-500/10 p-3 rounded-lg"><Ambulance className="w-6 h-6 text-emerald-500" /></div>
              <div>
                <p className="text-sm text-slate-400">Ambulances</p>
                <p className="text-2xl font-bold text-white">{ambulances.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* GPS Tracking Map */}
        {showMap && selectedEmergency && (
          <Card className="bg-slate-800/50 border-slate-700 mb-8">
            <CardHeader className="border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/10 p-2 rounded-lg"><Map className="w-5 h-5 text-blue-400" /></div>
                  <div>
                    <CardTitle className="text-white">Live GPS Tracking</CardTitle>
                    <CardDescription className="text-slate-400">Tracking route to: {selectedEmergency.profiles.name}</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setShowMap(false); setSelectedEmergency(null); }} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <OpenStreetMapEmbed
                latitude={selectedEmergency.latitude}
                longitude={selectedEmergency.longitude}
                title={`Live tracking: ${selectedEmergency.profiles.name}`}
                height="400px"
              />
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="active" className="data-[state=active]:bg-red-500 data-[state=active]:text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />Active ({activeEmergencies.length})
            </TabsTrigger>
            <TabsTrigger value="accepted" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white flex items-center gap-2">
              <Archive className="w-4 h-4" />Pending ({acceptedEmergencies.length})
            </TabsTrigger>
            <TabsTrigger value="dispatched" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white flex items-center gap-2">
              <Truck className="w-4 h-4" />Dispatched ({dispatchedEmergencies.length})
            </TabsTrigger>
            <TabsTrigger value="closed" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white flex items-center gap-2">
              <FileX className="w-4 h-4" />Closed ({expiredEmergencies.length})
            </TabsTrigger>
            <TabsTrigger value="ambulances" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white flex items-center gap-2">
              <Ambulance className="w-4 h-4" />Ambulances ({ambulances.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-6">
            {loading ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-12 text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-slate-400">Loading emergencies...</p>
                </CardContent>
              </Card>
            ) : activeEmergencies.length === 0 ? (
              renderEmptyState(<AlertCircle className="w-8 h-8 text-slate-500" />, "No Active Emergencies", "The system is monitoring for incoming alerts")
            ) : (
              <div className="grid gap-6">{activeEmergencies.map((e) => renderEmergencyCard(e, "active"))}</div>
            )}
          </TabsContent>

          <TabsContent value="accepted" className="space-y-6">
            {acceptedEmergencies.length === 0 ? (
              renderEmptyState(<Archive className="w-8 h-8 text-slate-500" />, "No Pending Cases", "Accepted emergencies pending ambulance dispatch")
            ) : (
              <div className="grid gap-6">{acceptedEmergencies.map((e) => renderEmergencyCard(e, "accepted"))}</div>
            )}
          </TabsContent>

          <TabsContent value="dispatched" className="space-y-6">
            {dispatchedEmergencies.length === 0 ? (
              renderEmptyState(<Truck className="w-8 h-8 text-slate-500" />, "No Dispatched Cases", "Cases dispatched to ambulances will appear here")
            ) : (
              <div className="grid gap-6">{dispatchedEmergencies.map((e) => renderEmergencyCard(e, "dispatched"))}</div>
            )}
          </TabsContent>

          <TabsContent value="closed" className="space-y-6">
            {expiredEmergencies.length === 0 ? (
              renderEmptyState(<FileX className="w-8 h-8 text-slate-500" />, "No Closed Cases", "Resolved emergencies will appear here")
            ) : (
              <div className="grid gap-6">{expiredEmergencies.map((e) => renderEmergencyCard(e, "expired"))}</div>
            )}
          </TabsContent>

          <TabsContent value="ambulances" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Manage Ambulances</h2>
              <Button onClick={() => setShowAddAmbulance(true)} className="bg-emerald-500 hover:bg-emerald-600">
                <Plus className="w-4 h-4 mr-2" />Add Ambulance
              </Button>
            </div>
            
            {ambulances.length === 0 ? (
              renderEmptyState(<Ambulance className="w-8 h-8 text-slate-500" />, "No Ambulances", "Add ambulances to dispatch for emergencies")
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ambulances.map((amb) => (
                  <Card key={amb.id} className="bg-slate-800/50 border-slate-700">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-emerald-500/10 p-2 rounded-lg"><Truck className="w-5 h-5 text-emerald-400" /></div>
                          <div>
                            <h3 className="text-white font-medium">{amb.name}</h3>
                            <p className="text-slate-400 text-sm">{amb.contact_number}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => window.open(`/ambulance/driver?id=${amb.id}`, '_blank')} 
                            className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                          >
                            <Navigation className="w-3 h-3 mr-1" />
                            Driver View
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveAmbulance(amb.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Add Ambulance Dialog */}
      <Dialog open={showAddAmbulance} onOpenChange={setShowAddAmbulance}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Add New Ambulance</DialogTitle>
            <DialogDescription className="text-slate-400">Register an ambulance service under your hospital</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAmbulance} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Service Name</Label>
              <Input value={newAmbulance.name} onChange={(e) => setNewAmbulance(prev => ({ ...prev, name: e.target.value }))} placeholder="City Ambulance Unit 1" className="bg-slate-900/50 border-slate-600 text-white" required />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Contact Number</Label>
              <Input value={newAmbulance.contact_number} onChange={(e) => setNewAmbulance(prev => ({ ...prev, contact_number: e.target.value }))} placeholder="+91 9876543210" className="bg-slate-900/50 border-slate-600 text-white" required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300">Base Location</Label>
                <Button type="button" variant="ghost" size="sm" onClick={getCurrentLocation} className="text-blue-400 h-auto py-1 text-xs">
                  <MapPin className="w-3 h-3 mr-1" />Detect
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={newAmbulance.latitude} onChange={(e) => setNewAmbulance(prev => ({ ...prev, latitude: e.target.value }))} placeholder="Latitude" className="bg-slate-900/50 border-slate-600 text-white" required />
                <Input value={newAmbulance.longitude} onChange={(e) => setNewAmbulance(prev => ({ ...prev, longitude: e.target.value }))} placeholder="Longitude" className="bg-slate-900/50 border-slate-600 text-white" required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAddAmbulance(false)} className="text-slate-400">Cancel</Button>
              <Button type="submit" disabled={addingAmbulance} className="bg-emerald-500 hover:bg-emerald-600">
                {addingAmbulance ? "Adding..." : "Add Ambulance"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dispatch Ambulance Dialog */}
      <Dialog open={showDispatchModal} onOpenChange={setShowDispatchModal}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Dispatch Ambulance</DialogTitle>
            <DialogDescription className="text-slate-400">Select an ambulance to dispatch for this emergency</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {ambulances.map((amb) => (
              <div key={amb.id} onClick={() => setSelectedAmbulanceId(amb.id)} className={`p-4 rounded-lg border cursor-pointer transition-colors ${selectedAmbulanceId === amb.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-600 hover:border-slate-500'}`}>
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/10 p-2 rounded-lg"><Truck className="w-5 h-5 text-emerald-400" /></div>
                  <div>
                    <h3 className="text-white font-medium">{amb.name}</h3>
                    <p className="text-slate-400 text-sm">{amb.contact_number}</p>
                    {emergencyToDispatch && (
                      <p className="text-blue-400 text-xs mt-1">{calculateDistance({ latitude: amb.latitude, longitude: amb.longitude }, { latitude: emergencyToDispatch.latitude, longitude: emergencyToDispatch.longitude }).toFixed(1)} km from emergency</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDispatchModal(false)} className="text-slate-400">Cancel</Button>
            <Button onClick={handleDispatchAmbulance} disabled={!selectedAmbulanceId || dispatchingId !== null} className="bg-orange-500 hover:bg-orange-600">
              {dispatchingId ? "Dispatching..." : "Dispatch Selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Map View Dialog */}
      <Dialog open={showMap} onOpenChange={setShowMap}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-400" />
              Emergency Location
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedEmergency && (
                <span>
                  Patient: {selectedEmergency.profiles.name} • 
                  Coordinates: {selectedEmergency.latitude.toFixed(6)}, {selectedEmergency.longitude.toFixed(6)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="h-[400px] rounded-lg overflow-hidden border border-slate-600">
            {selectedEmergency && (
              <OpenStreetMapEmbed
                latitude={selectedEmergency.latitude}
                longitude={selectedEmergency.longitude}
                title={`Emergency location: ${selectedEmergency.profiles.name}`}
                height="400px"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowMap(false)} className="text-slate-400">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HospitalDashboard;