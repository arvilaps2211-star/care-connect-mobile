import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LogOut, AlertCircle, MapPin, Phone, Clock } from "lucide-react";

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
  };
  medical_info: {
    blood_group: string;
    medical_history: string;
  }[];
}

const AmbulanceDashboard = () => {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [ambulanceInfo, setAmbulanceInfo] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchEmergencies();
    subscribeToEmergencies();
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

    if (!roles || roles.role !== "ambulance") {
      navigate("/");
      return;
    }

    const { data: ambulance } = await supabase
      .from("ambulance_services")
      .select("*")
      .eq("user_id", user.id)
      .single();

    setAmbulanceInfo(ambulance);
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

    // Fetch related data for each emergency
    const enrichedEmergencies = await Promise.all(
      (emergenciesData || []).map(async (emergency) => {
        const [profileRes, medicalRes] = await Promise.all([
          supabase.from("profiles").select("name, phone, age").eq("user_id", emergency.user_id).single(),
          supabase.from("medical_info").select("blood_group, medical_history").eq("user_id", emergency.user_id),
        ]);

        return {
          ...emergency,
          profiles: profileRes.data || { name: "", phone: "", age: 0 },
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

  const handleAccept = async (emergencyId: string) => {
    const { error } = await supabase
      .from("emergencies")
      .update({
        accepted_by_ambulance: ambulanceInfo?.id,
        status: "dispatched",
      })
      .eq("id", emergencyId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to accept emergency",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Emergency Accepted",
        description: "Ambulance dispatched to location",
      });
      fetchEmergencies();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-success/5">
      <div className="container mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Ambulance Dashboard</h1>
            {ambulanceInfo && (
              <p className="text-muted-foreground mt-2">{ambulanceInfo.name}</p>
            )}
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        {/* Active Emergencies */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-6 w-6 text-emergency" />
            <h2 className="text-2xl font-semibold">Active Emergencies</h2>
            <Badge variant="destructive" className="ml-2">
              {emergencies.length}
            </Badge>
          </div>

          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Loading emergencies...</p>
              </CardContent>
            </Card>
          ) : emergencies.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No active emergencies at the moment</p>
              </CardContent>
            </Card>
          ) : (
            emergencies.map((emergency) => (
              <Card key={emergency.id} className="border-l-4 border-l-emergency">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-emergency">EMERGENCY ALERT</span>
                    <Badge variant="destructive">ACTIVE</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold mb-2">Patient Information</h3>
                      <div className="space-y-2 text-sm">
                        <p><strong>Name:</strong> {emergency.profiles.name}</p>
                        <p><strong>Age:</strong> {emergency.profiles.age}</p>
                        <p className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {emergency.profiles.phone}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Medical Information</h3>
                      <div className="space-y-2 text-sm">
                        {emergency.medical_info[0] && (
                          <>
                            <p><strong>Blood Group:</strong> {emergency.medical_info[0].blood_group}</p>
                            <p><strong>Medical History:</strong> {emergency.medical_info[0].medical_history || "None"}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-2">Location</h3>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-emergency" />
                      <span>Lat: {emergency.latitude}, Long: {emergency.longitude}</span>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => window.open(`https://www.google.com/maps?q=${emergency.latitude},${emergency.longitude}`, "_blank")}
                      >
                        Open in Maps
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Reported: {new Date(emergency.created_at).toLocaleString()}</span>
                  </div>

                  <Button
                    onClick={() => handleAccept(emergency.id)}
                    className="w-full bg-emergency hover:bg-emergency/90"
                    size="lg"
                  >
                    Dispatch Ambulance
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AmbulanceDashboard;
