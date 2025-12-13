import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LogOut, AlertCircle, MapPin, Phone, Clock, User, Heart, Navigation, Bell, Activity, Archive, FileX, CheckCircle, Ambulance, Map } from "lucide-react";
import GPSTracker from "@/components/GPSTracker";

interface Emergency {
  id: string;
  created_at: string;
  latitude: number;
  longitude: number;
  status: string;
  accepted_by_hospital: string | null;
  accepted_by_ambulance: string | null;
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

type UserRole = "hospital" | "ambulance";

const HospitalDashboard = () => {
  const [activeEmergencies, setActiveEmergencies] = useState<Emergency[]>([]);
  const [acceptedEmergencies, setAcceptedEmergencies] = useState<Emergency[]>([]);
  const [expiredEmergencies, setExpiredEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityInfo, setEntityInfo] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>("hospital");
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("active");
  const [showMap, setShowMap] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedEmergency, setSelectedEmergency] = useState<Emergency | null>(null);
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

    if (!roles || (roles.role !== "hospital" && roles.role !== "ambulance")) {
      navigate("/hospital/login");
      return;
    }

    setUserRole(roles.role as UserRole);

    if (roles.role === "hospital") {
      const { data: hospital } = await supabase
        .from("hospitals")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setEntityInfo(hospital);
    } else if (roles.role === "ambulance") {
      const { data: ambulance } = await supabase
        .from("ambulance_services")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setEntityInfo(ambulance);
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

    // Fetch accepted emergencies (drafts - cases this hospital accepted)
    const { data: acceptedData } = await supabase
      .from("emergencies")
      .select("*")
      .eq("status", "accepted")
      .order("created_at", { ascending: false });

    // Fetch resolved/expired emergencies (cases closed by others or resolved)
    const { data: expiredData } = await supabase
      .from("emergencies")
      .select("*")
      .in("status", ["resolved", "closed"])
      .order("created_at", { ascending: false })
      .limit(50);

    // Enrich all data with profile and medical info
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

    const [enrichedActive, enrichedAccepted, enrichedExpired] = await Promise.all([
      enrichEmergencies(activeData || []),
      enrichEmergencies(acceptedData || []),
      enrichEmergencies(expiredData || []),
    ]);

    setActiveEmergencies(enrichedActive);
    setAcceptedEmergencies(enrichedAccepted);
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

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
  };

  const openGoogleMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const handleAcceptAndDispatch = async (emergencyId: string, lat: number, lng: number, emergency: Emergency) => {
    setDispatchingId(emergencyId);
    
    try {
      const updateData = userRole === "hospital" 
        ? { accepted_by_hospital: entityInfo?.id, status: "accepted" }
        : { accepted_by_ambulance: entityInfo?.id, status: "dispatched" };

      const { error } = await supabase
        .from("emergencies")
        .update(updateData)
        .eq("id", emergencyId);

      if (error) throw error;

      // Set up GPS tracking
      setSelectedEmergency(emergency);
      setShowMap(true);

      toast({
        title: userRole === "hospital" ? "Emergency Accepted" : "Ambulance Dispatched",
        description: userRole === "hospital" 
          ? "Ambulance dispatch initiated. GPS tracking enabled." 
          : "En route to patient. GPS tracking enabled.",
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/hospital/login");
  };

  const renderEmergencyCard = (emergency: Emergency, showActions: boolean = true, isExpired: boolean = false) => (
    <Card key={emergency.id} className={`bg-slate-800/50 border-l-4 ${isExpired ? 'border-l-slate-500' : 'border-l-red-500'} border-slate-700 overflow-hidden`}>
      <CardHeader className={`${isExpired ? 'bg-slate-700/20' : 'bg-red-500/5'} border-b border-slate-700`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${isExpired ? 'bg-slate-500' : 'bg-red-500 animate-pulse'} p-2 rounded-lg`}>
              {isExpired ? <Archive className="w-5 h-5 text-white" /> : <AlertCircle className="w-5 h-5 text-white" />}
            </div>
            <div>
              <CardTitle className={`${isExpired ? 'text-slate-400' : 'text-red-400'} text-lg`}>
                {isExpired ? 'CASE CLOSED' : 'EMERGENCY ALERT'}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {new Date(emergency.created_at).toLocaleString()}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {entityInfo && (
              <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                <Navigation className="w-3 h-3 mr-1" />
                {calculateDistance(
                  entityInfo.latitude,
                  entityInfo.longitude,
                  emergency.latitude,
                  emergency.longitude
                )} km away
              </Badge>
            )}
            <Badge className={isExpired ? 'bg-slate-500 text-white' : 'bg-red-500 text-white'}>
              {isExpired ? 'CLOSED' : 'CRITICAL'}
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
                  <img 
                    src={emergency.profiles.profile_photo_url} 
                    alt="Patient" 
                    className="w-16 h-16 rounded-full object-cover border-2 border-slate-600"
                  />
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
                    <Badge className="bg-red-500/20 text-red-400">
                      {emergency.medical_info[0].blood_group || "Unknown"}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Medical History</span>
                    <p className="text-white text-sm mt-1">
                      {emergency.medical_info[0].medical_history || "None reported"}
                    </p>
                  </div>
                  {emergency.medical_info[0].additional_notes && (
                    <div>
                      <span className="text-slate-400 text-sm">Notes</span>
                      <p className="text-yellow-400 text-sm mt-1">
                        {emergency.medical_info[0].additional_notes}
                      </p>
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
                <span className="text-slate-400">Coordinates</span>
                <p className="text-white font-mono text-xs mt-1">
                  {emergency.latitude.toFixed(6)}, {emergency.longitude.toFixed(6)}
                </p>
              </div>
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
                View on Map
              </Button>
            </div>

            {showActions && !isExpired && (
              <Button
                onClick={() => handleAcceptAndDispatch(emergency.id, emergency.latitude, emergency.longitude, emergency)}
                disabled={dispatchingId === emergency.id}
                className={`w-full font-semibold py-6 ${
                  userRole === "ambulance" 
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700" 
                    : "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                } text-white`}
                size="lg"
              >
                {dispatchingId === emergency.id ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    {userRole === "ambulance" ? "Dispatching..." : "Processing..."}
                  </>
                ) : (
                  <>
                    {userRole === "ambulance" ? (
                      <Ambulance className="mr-2 h-5 w-5" />
                    ) : (
                      <Navigation className="mr-2 h-5 w-5" />
                    )}
                    {userRole === "ambulance" ? "Dispatch & Navigate" : "Accept & Dispatch Ambulance"}
                  </>
                )}
              </Button>
            )}

            {emergency.status === "accepted" && (
              <Button
                onClick={() => handleResolveCase(emergency.id)}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold"
                size="lg"
              >
                <CheckCircle className="mr-2 h-5 w-5" />
                Mark as Resolved
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderEmptyState = (icon: React.ReactNode, title: string, description: string) => (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="p-12 text-center">
        <div className="bg-slate-700/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
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
              <div className={`p-3 rounded-xl ${
                userRole === "ambulance" 
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600" 
                  : "bg-gradient-to-br from-red-500 to-red-600"
              }`}>
                {userRole === "ambulance" ? (
                  <Ambulance className="w-8 h-8 text-white" />
                ) : (
                  <Activity className="w-8 h-8 text-white" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {userRole === "ambulance" ? "CareConnect Ambulance" : "CareConnect Hospitals"}
                </h1>
                {entityInfo && (
                  <p className="text-slate-400">{entityInfo.name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge className={`px-3 py-1.5 ${
                userRole === "ambulance" 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                  : "bg-blue-500/10 text-blue-400 border-blue-500/20"
              }`}>
                {userRole === "ambulance" ? "Ambulance Unit" : "Hospital Staff"}
              </Badge>
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-emerald-400 text-sm font-medium">System Online</span>
              </div>
              <Button variant="ghost" onClick={handleLogout} className="text-slate-400 hover:text-white hover:bg-slate-800">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-red-500/10 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Active Emergencies</p>
                <p className="text-2xl font-bold text-white">{activeEmergencies.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-amber-500/10 p-3 rounded-lg">
                <Archive className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-slate-400">In Progress</p>
                <p className="text-2xl font-bold text-white">{acceptedEmergencies.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-slate-500/10 p-3 rounded-lg">
                <FileX className="w-6 h-6 text-slate-500" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Closed Cases</p>
                <p className="text-2xl font-bold text-white">{expiredEmergencies.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-purple-500/10 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Response Time</p>
                <p className="text-2xl font-bold text-white">&lt; 5 min</p>
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
                  <div className="bg-blue-500/10 p-2 rounded-lg">
                    <Map className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Live GPS Tracking</CardTitle>
                    <CardDescription className="text-slate-400">
                      Tracking route to: {selectedEmergency.profiles.name}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openGoogleMaps(selectedEmergency.latitude, selectedEmergency.longitude)}
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Open in Google Maps
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowMap(false);
                      setSelectedEmergency(null);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    Close Map
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <GPSTracker
                currentLocation={currentLocation || undefined}
                emergencyLocation={{
                  latitude: selectedEmergency.latitude,
                  longitude: selectedEmergency.longitude,
                  label: `Emergency - ${selectedEmergency.profiles.name}`,
                }}
                height="400px"
              />
            </CardContent>
          </Card>
        )}

        {/* Tabs for different case statuses */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger 
              value="active" 
              className="data-[state=active]:bg-red-500 data-[state=active]:text-white flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              Active ({activeEmergencies.length})
            </TabsTrigger>
            <TabsTrigger 
              value="drafts" 
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-white flex items-center gap-2"
            >
              <Archive className="w-4 h-4" />
              In Progress ({acceptedEmergencies.length})
            </TabsTrigger>
            <TabsTrigger 
              value="expired" 
              className="data-[state=active]:bg-slate-600 data-[state=active]:text-white flex items-center gap-2"
            >
              <FileX className="w-4 h-4" />
              Closed ({expiredEmergencies.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-red-500" />
                <h2 className="text-xl font-semibold text-white">Incoming Emergencies</h2>
              </div>
              <Badge className="bg-red-500/10 text-red-500 border-red-500/20 px-3 py-1">
                {activeEmergencies.length} Active
              </Badge>
            </div>

            {loading ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-12 text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-slate-400">Loading emergencies...</p>
                </CardContent>
              </Card>
            ) : activeEmergencies.length === 0 ? (
              renderEmptyState(
                <AlertCircle className="w-8 h-8 text-slate-500" />,
                "No Active Emergencies",
                "The system is monitoring for incoming alerts"
              )
            ) : (
              <div className="grid gap-6">
                {activeEmergencies.map((emergency) => renderEmergencyCard(emergency, true, false))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="drafts" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Archive className="h-6 w-6 text-amber-500" />
                <h2 className="text-xl font-semibold text-white">In Progress Cases</h2>
              </div>
              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-1">
                {acceptedEmergencies.length} Cases
              </Badge>
            </div>

            {acceptedEmergencies.length === 0 ? (
              renderEmptyState(
                <Archive className="w-8 h-8 text-slate-500" />,
                "No Cases In Progress",
                "Accepted emergencies will appear here"
              )
            ) : (
              <div className="grid gap-6">
                {acceptedEmergencies.map((emergency) => renderEmergencyCard(emergency, false, false))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="expired" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileX className="h-6 w-6 text-slate-500" />
                <h2 className="text-xl font-semibold text-white">Closed & Expired Cases</h2>
              </div>
              <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20 px-3 py-1">
                {expiredEmergencies.length} Cases
              </Badge>
            </div>

            {expiredEmergencies.length === 0 ? (
              renderEmptyState(
                <FileX className="w-8 h-8 text-slate-500" />,
                "No Closed Cases",
                "Resolved or expired emergencies will appear here"
              )
            ) : (
              <div className="grid gap-6">
                {expiredEmergencies.map((emergency) => renderEmergencyCard(emergency, false, true))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default HospitalDashboard;