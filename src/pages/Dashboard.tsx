import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Heart, LogOut, Settings, Shield, Activity } from "lucide-react";
import AccelerometerMonitor from "@/components/AccelerometerMonitor";
import EmergencyModal from "@/components/EmergencyModal";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Dashboard auth.getUser error:", userError);
    }

    if (!user) {
      console.warn("Dashboard: no user session, redirecting to /auth");
      navigate("/auth");
      return;
    }

    setUser(user);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Dashboard: Failed to load profile", { userId: user.id, profileError });
      toast({
        title: "Profile error",
        description: profileError.message,
        variant: "destructive",
      });
      navigate("/onboarding");
      return;
    }

    if (!profileData) {
      console.warn("Dashboard: profile missing for user", user.id);
      toast({
        title: "Complete setup",
        description: "We couldn't find your profile. Please complete onboarding.",
        variant: "destructive",
      });
      navigate("/onboarding");
      return;
    }

    if (!profileData.onboarding_completed) {
      console.warn("Dashboard: onboarding not completed for user", user.id);
      navigate("/onboarding");
      return;
    }

    setProfile(profileData);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleAccidentDetected = () => {
    setShowEmergency(true);
  };

  const handleEmergencyConfirmed = async (location: { latitude: number; longitude: number }) => {
    if (!user || !profile) return;

    const { data: emergency, error } = await supabase
      .from("emergencies")
      .insert({
        user_id: user.id,
        latitude: location.latitude,
        longitude: location.longitude,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error("Error recording emergency:", error);
      toast({
        title: "Error",
        description: "Failed to record emergency",
        variant: "destructive",
      });
      return;
    }

    // Get ALL guardians
    const { data: guardians } = await supabase
      .from("guardians")
      .select("name, contact_number")
      .eq("user_id", user.id);

    // Get medical info
    const { data: medicalInfo } = await supabase
      .from("medical_info")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Call backend functions to send notifications
    const notificationPromises: Promise<any>[] = [];

    // SMS notification to ALL guardians
    const guardianPhones = (guardians || [])
      .map((g: any) => String(g.contact_number || "").trim())
      .filter(Boolean);

    if (guardianPhones.length > 0) {
      notificationPromises.push(
        supabase.functions.invoke("notify-emergency", {
          body: {
            emergencyId: emergency.id,
            userPhone: profile.phone,
            guardianPhones,
            guardians: (guardians || []).map((g: any) => ({
              name: g.name,
              phone: g.contact_number,
            })),
            userName: profile.name,
            location,
            userAge: profile.age,
            userGender: profile.gender,
            vehicleNumber: profile.vehicle_number,
            bloodGroup: medicalInfo?.blood_group,
            medicalHistory: medicalInfo?.medical_history,
            profilePhotoUrl: profile.profile_photo_url,
          },
        })
      );
    }

    // Push notification to hospitals and ambulances
    notificationPromises.push(
      supabase.functions.invoke("send-push-notification", {
        body: {
          emergencyId: emergency.id,
          title: "🚨 EMERGENCY ALERT",
          body: `Emergency reported by ${profile.name}. Location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
          data: {
            type: "emergency",
            lat: String(location.latitude),
            lng: String(location.longitude),
          },
          targetRoles: ["hospital", "ambulance"],
        },
      })
    );

    // Execute all notifications in parallel
    const results = await Promise.allSettled(notificationPromises);
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`Notification ${index} failed:`, result.reason);
      }
    });

    toast({
      title: "Emergency Recorded",
      description: "Emergency services have been notified",
    });
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-emergency/5">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-emergency p-2 rounded-full">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">CareConnect</h1>
              <p className="text-sm text-muted-foreground">Welcome, {profile.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Monitoring Status */}
        <Card className="border-2 border-primary shadow-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Accident Detection
            </CardTitle>
            <CardDescription>
              {isMonitoring
                ? "Actively monitoring for abnormal movement"
                : "Start monitoring to enable accident detection"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setIsMonitoring(!isMonitoring)}
              size="lg"
              className={
                isMonitoring
                  ? "w-full bg-gradient-safe"
                  : "w-full bg-gradient-emergency"
              }
            >
              {isMonitoring ? (
                <>
                  <Activity className="mr-2 w-5 h-5 animate-pulse" />
                  Monitoring Active
                </>
              ) : (
                "Start Monitoring"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Manual Emergency */}
        <Card className="border-2 border-emergency">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emergency">
              <AlertCircle className="w-5 h-5" />
              Manual Emergency
            </CardTitle>
            <CardDescription>
              Press if you need immediate help
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setShowEmergency(true)}
              size="lg"
              className="w-full bg-gradient-emergency shadow-emergency"
            >
              <AlertCircle className="mr-2 w-5 h-5" />
              EMERGENCY
            </Button>
          </CardContent>
        </Card>

        {/* Profile Summary */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Age:</span>
                <span className="font-medium">{profile.age || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gender:</span>
                <span className="font-medium capitalize">{profile.gender || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vehicle:</span>
                <span className="font-medium">{profile.vehicle_number || "N/A"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium">{profile.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{user?.email}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Accelerometer Monitor */}
      {isMonitoring && (
        <AccelerometerMonitor onAccidentDetected={handleAccidentDetected} />
      )}

      {/* Emergency Modal */}
      <EmergencyModal
        open={showEmergency}
        onOpenChange={setShowEmergency}
        onEmergencyConfirmed={handleEmergencyConfirmed}
        onSafe={() => setShowEmergency(false)}
      />
    </div>
  );
};

export default Dashboard;