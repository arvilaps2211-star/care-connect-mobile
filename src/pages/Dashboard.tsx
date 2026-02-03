import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Heart, LogOut, Settings, Shield, Activity, MapPin, RefreshCw, Navigation, MessageSquare } from "lucide-react";
import AccelerometerMonitor from "@/components/AccelerometerMonitor";
import { useSOSContext } from "@/contexts/SOSContext";
import { useLocation } from "@/hooks/useLocation";
import GPSTracker from "@/components/GPSTracker";
import { sendEmergencySMS, type SMSStatus } from "@/utils/smsService";
import { SMSStatusBadge } from "@/components/SMSStatusBadge";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [lastSMSStatus, setLastSMSStatus] = useState<SMSStatus | null>(null);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { triggerSOS, setEmergencyHandler } = useSOSContext();
  
  // Live GPS tracking using the reusable hook
  const { location, status, error: locationError, isLoading: isLocating, refresh: refreshLocation } = useLocation({
    watch: true,
    highAccuracy: true,
  });

  // Emergency handling logic with improved SMS tracking
  const handleEmergencyConfirmed = useCallback(async (emergencyLocation: { latitude: number; longitude: number }) => {
    const currentUser = user;
    const currentProfile = profile;
    
    if (!currentUser || !currentProfile) {
      toast({
        title: "Error",
        description: "Please log in to send an emergency",
        variant: "destructive",
      });
      return;
    }

    console.log("[EMERGENCY] Creating emergency record...");
    setIsSendingSMS(true);
    setSmsError(null);
    setLastSMSStatus("pending");

    const { data: emergency, error } = await supabase
      .from("emergencies")
      .insert({
        user_id: currentUser.id,
        latitude: emergencyLocation.latitude,
        longitude: emergencyLocation.longitude,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error("[EMERGENCY] Error recording emergency:", error);
      setIsSendingSMS(false);
      setLastSMSStatus("failed");
      setSmsError("Failed to record emergency");
      toast({
        title: "Error",
        description: "Failed to record emergency",
        variant: "destructive",
      });
      return;
    }

    console.log("[EMERGENCY] Emergency created:", emergency.id);

    // Get ALL guardians
    const { data: guardians } = await supabase
      .from("guardians")
      .select("name, contact_number")
      .eq("user_id", currentUser.id);

    // Get medical info
    const { data: medicalInfo } = await supabase
      .from("medical_info")
      .select("*")
      .eq("user_id", currentUser.id)
      .single();

    // Send SMS notification using the SMS service
    const guardianList = (guardians || []).map((g: any) => ({
      name: g.name,
      phone: g.contact_number,
    }));

    if (guardianList.length > 0) {
      console.log("[SMS] Sending emergency SMS to", guardianList.length, "guardian(s)");
      
      const smsResult = await sendEmergencySMS({
        emergencyId: emergency.id,
        userPhone: currentProfile.phone,
        userName: currentProfile.name,
        location: emergencyLocation,
        guardians: guardianList,
        userAge: currentProfile.age,
        userGender: currentProfile.gender,
        vehicleNumber: currentProfile.vehicle_number,
        bloodGroup: medicalInfo?.blood_group,
        medicalHistory: medicalInfo?.medical_history,
        profilePhotoUrl: currentProfile.profile_photo_url,
        residentialAddress: currentProfile.address,
      });

      console.log("[SMS] SMS result:", smsResult);
      setLastSMSStatus(smsResult.status);
      
      if (!smsResult.success && smsResult.error) {
        setSmsError(smsResult.error);
      }

      // Show appropriate toast based on SMS status
      if (smsResult.status === "sent") {
        toast({
          title: "🚨 Emergency Recorded",
          description: `Emergency services and ${guardianList.length} guardian(s) notified via SMS`,
        });
      } else if (smsResult.status === "partial") {
        toast({
          title: "⚠️ Partial Notification",
          description: `Some SMS notifications failed. ${smsResult.summary?.sent || 0} of ${smsResult.summary?.total || 0} sent.`,
          variant: "destructive",
        });
      } else if (smsResult.status === "simulated") {
        toast({
          title: "🔧 DEV Mode",
          description: "Emergency recorded. SMS simulated (not sent).",
        });
      } else if (smsResult.status === "not_configured") {
        toast({
          title: "⚙️ SMS Not Configured",
          description: "Emergency recorded. SMS not configured - Twilio credentials missing.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "⚠️ SMS Failed",
          description: smsResult.error || "Failed to send SMS notifications. Emergency still recorded.",
          variant: "destructive",
        });
      }
    } else {
      console.log("[SMS] No guardians configured, skipping SMS");
      setLastSMSStatus("not_configured");
      toast({
        title: "🚨 Emergency Recorded",
        description: "No guardians configured. Add guardians in Settings to receive SMS alerts.",
        variant: "destructive",
      });
    }

    // Push notification to hospitals and ambulances (separate from SMS)
    try {
      await supabase.functions.invoke("send-push-notification", {
        body: {
          emergencyId: emergency.id,
          title: "🚨 EMERGENCY ALERT",
          body: `Emergency reported by ${currentProfile.name}. Location: ${emergencyLocation.latitude.toFixed(4)}, ${emergencyLocation.longitude.toFixed(4)}`,
          data: {
            type: "emergency",
            lat: String(emergencyLocation.latitude),
            lng: String(emergencyLocation.longitude),
          },
          targetRoles: ["hospital", "ambulance"],
        },
      });
      console.log("[EMERGENCY] Push notifications sent");
    } catch (pushErr) {
      console.error("[EMERGENCY] Push notification error:", pushErr);
    }

    setIsSendingSMS(false);
  }, [user, profile, toast]);

  // Register emergency handler with global context
  useEffect(() => {
    if (user && profile) {
      setEmergencyHandler(handleEmergencyConfirmed);
    }
  }, [user, profile, handleEmergencyConfirmed, setEmergencyHandler]);

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

  // Trigger global SOS overlay when accelerometer detects accident
  const handleAccidentDetected = () => {
    triggerSOS();
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
        {/* Live GPS Status */}
        <Card className="border-2 border-blue-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-500" />
                Live GPS Location
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshLocation}
                disabled={isLocating}
              >
                <RefreshCw className={`w-4 h-4 ${isLocating ? "animate-spin" : ""}`} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* GPS Status Indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                status === "granted" && location ? "bg-green-500 animate-pulse" :
                status === "denied" ? "bg-red-500" :
                status === "requesting" || isLocating ? "bg-yellow-500 animate-pulse" :
                "bg-gray-400"
              }`} />
              <span className="text-sm text-muted-foreground">
                {status === "granted" && location ? "GPS Active" :
                 status === "denied" ? "Permission Denied" :
                 status === "requesting" ? "Requesting Permission..." :
                 isLocating ? "Acquiring Location..." :
                 "GPS Inactive"}
              </span>
            </div>

            {/* Coordinates Display */}
            {location ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/50 rounded-lg p-2">
                  <span className="text-muted-foreground text-xs">Latitude</span>
                  <p className="font-mono font-medium">{location.latitude.toFixed(6)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <span className="text-muted-foreground text-xs">Longitude</span>
                  <p className="font-mono font-medium">{location.longitude.toFixed(6)}</p>
                </div>
                {typeof location.accuracy === "number" && (
                  <div className="col-span-2 bg-muted/50 rounded-lg p-2">
                    <span className="text-muted-foreground text-xs">Accuracy</span>
                    <p className="font-medium">±{Math.round(location.accuracy)}m</p>
                  </div>
                )}
              </div>
            ) : locationError ? (
              <p className="text-sm text-destructive">{locationError}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for GPS signal...</p>
            )}

            {/* Map Toggle */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowMap(!showMap)}
            >
              <Navigation className="mr-2 w-4 h-4" />
              {showMap ? "Hide Map" : "Show Map"}
            </Button>

            {/* Leaflet Map (visualization only) */}
            {showMap && location && (
              <div className="mt-2">
                <GPSTracker
                  currentLocation={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                    accuracy: location.accuracy,
                    label: "Your Location",
                  }}
                  height="200px"
                  useUserIcon={true}
                />
              </div>
            )}
          </CardContent>
        </Card>

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

        {/* Manual Emergency with SMS Status */}
        <Card className="border-2 border-emergency">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emergency">
                <AlertCircle className="w-5 h-5" />
                Manual Emergency
              </div>
              {lastSMSStatus && (
                <SMSStatusBadge status={lastSMSStatus} />
              )}
            </CardTitle>
            <CardDescription>
              Press if you need immediate help
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={triggerSOS}
              size="lg"
              className="w-full bg-gradient-emergency shadow-emergency"
              disabled={isSendingSMS}
            >
              {isSendingSMS ? (
                <>
                  <RefreshCw className="mr-2 w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <AlertCircle className="mr-2 w-5 h-5" />
                  EMERGENCY
                </>
              )}
            </Button>
            
            {/* SMS Error Banner */}
            {smsError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">SMS Notification Issue</p>
                    <p className="text-muted-foreground">{smsError}</p>
                  </div>
                </div>
              </div>
            )}
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

      {/* Accelerometer Monitor - triggers global SOS overlay */}
      {isMonitoring && (
        <AccelerometerMonitor onAccidentDetected={handleAccidentDetected} />
      )}
    </div>
  );
};

export default Dashboard;
