import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LogOut, AlertCircle, MapPin, Phone, Clock, User, Heart, Navigation, Bell, Activity } from "lucide-react";

interface Emergency {
  id: string;
  created_at: string;
  latitude: number;
  longitude: number;
  status: string;
  profiles: {
    name: string;
    phone: string;
    age: number;
    gender: string;
    address: string;
  };
  medical_info: {
    blood_group: string;
    medical_history: string;
    additional_notes: string;
  }[];
}

const HospitalDashboard = () => {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [hospitalInfo, setHospitalInfo] = useState<any>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchEmergencies();
    const unsubscribe = subscribeToEmergencies();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roles || roles.role !== "hospital") {
      navigate("/");
      return;
    }

    const { data: hospital } = await supabase
      .from("hospitals")
      .select("*")
      .eq("user_id", user.id)
      .single();

    setHospitalInfo(hospital);
  };

  const fetchEmergencies = async () => {
    setLoading(true);
    const { data: emergenciesData, error } = await supabase
      .from("emergencies")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch emergencies",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const enrichedEmergencies = await Promise.all(
      (emergenciesData || []).map(async (emergency) => {
        const [profileRes, medicalRes] = await Promise.all([
          supabase.from("profiles").select("name, phone, age, gender, address").eq("user_id", emergency.user_id).single(),
          supabase.from("medical_info").select("blood_group, medical_history, additional_notes").eq("user_id", emergency.user_id),
        ]);

        return {
          ...emergency,
          profiles: profileRes.data || { name: "", phone: "", age: 0, gender: "", address: "" },
          medical_info: medicalRes.data || [],
        };
      })
    );

    setEmergencies(enrichedEmergencies);
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
          fetchEmergencies();
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

  const handleAcceptAndDispatch = async (emergencyId: string, lat: number, lng: number) => {
    setDispatchingId(emergencyId);
    
    try {
      const { error } = await supabase
        .from("emergencies")
        .update({
          accepted_by_hospital: hospitalInfo?.id,
          status: "accepted",
        })
        .eq("id", emergencyId);

      if (error) throw error;

      toast({
        title: "Emergency Accepted",
        description: "Ambulance dispatch initiated. Opening navigation...",
      });

      // Open Google Maps for navigation
      openGoogleMaps(lat, lng);
      fetchEmergencies();
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

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
                <h1 className="text-2xl font-bold text-white">Hospital Command Center</h1>
                {hospitalInfo && (
                  <p className="text-slate-400">{hospitalInfo.name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
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
                <p className="text-2xl font-bold text-white">{emergencies.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-emerald-500/10 p-3 rounded-lg">
                <Bell className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Notifications</p>
                <p className="text-2xl font-bold text-white">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-blue-500/10 p-3 rounded-lg">
                <Navigation className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Dispatch Ready</p>
                <p className="text-2xl font-bold text-white">Yes</p>
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

        {/* Emergency List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-500" />
              <h2 className="text-xl font-semibold text-white">Incoming Emergencies</h2>
            </div>
            <Badge className="bg-red-500/10 text-red-500 border-red-500/20 px-3 py-1">
              {emergencies.length} Active
            </Badge>
          </div>

          {loading ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-12 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-slate-400">Loading emergencies...</p>
              </CardContent>
            </Card>
          ) : emergencies.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-12 text-center">
                <div className="bg-slate-700/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No Active Emergencies</h3>
                <p className="text-slate-400">The system is monitoring for incoming alerts</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {emergencies.map((emergency) => (
                <Card key={emergency.id} className="bg-slate-800/50 border-l-4 border-l-red-500 border-slate-700 overflow-hidden">
                  <CardHeader className="bg-red-500/5 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-500 p-2 rounded-lg animate-pulse">
                          <AlertCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-red-400 text-lg">EMERGENCY ALERT</CardTitle>
                          <CardDescription className="text-slate-400">
                            {new Date(emergency.created_at).toLocaleString()}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hospitalInfo && (
                          <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                            <Navigation className="w-3 h-3 mr-1" />
                            {calculateDistance(
                              hospitalInfo.latitude,
                              hospitalInfo.longitude,
                              emergency.latitude,
                              emergency.longitude
                            )} km away
                          </Badge>
                        )}
                        <Badge className="bg-red-500 text-white">CRITICAL</Badge>
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
                        </div>

                        <Button
                          onClick={() => handleAcceptAndDispatch(emergency.id, emergency.latitude, emergency.longitude)}
                          disabled={dispatchingId === emergency.id}
                          className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-6"
                          size="lg"
                        >
                          {dispatchingId === emergency.id ? (
                            <>
                              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                              Dispatching...
                            </>
                          ) : (
                            <>
                              <Navigation className="mr-2 h-5 w-5" />
                              Accept & Dispatch Ambulance
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HospitalDashboard;
