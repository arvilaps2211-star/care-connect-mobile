import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Heart, LogOut, Settings, RefreshCw, MessageSquare, Bell, BellOff, Phone as PhoneIcon, Smartphone } from "lucide-react";
import { useSOSContext } from "@/contexts/SOSContext";
import { sendEmergencySMS, type SMSStatus } from "@/utils/smsService";
import { SMSStatusBadge } from "@/components/SMSStatusBadge";
import LockScreenSOS from "@/plugins/lockScreenSOS";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [monitoringEnabled, setMonitoringEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("emergency_monitoring_enabled");
    return stored === null ? true : stored === "true";
  });
  const [shakeEnabled, setShakeEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("shake_detection_enabled");
    return stored === null ? true : stored === "true";
  });
  const [guardians, setGuardians] = useState<any[]>([]);
  const [lastSMSStatus, setLastSMSStatus] = useState<SMSStatus | null>(null);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { triggerSOS, setEmergencyHandler } = useSOSContext();
  const lastShakeRef = useRef<number>(0);

  const toggleMonitoring = (next: boolean) => {
    setMonitoringEnabled(next);
    try {
      localStorage.setItem("emergency_monitoring_enabled", String(next));
    } catch {}
    // One-time battery whitelist prompt when monitoring first enabled
    if (next) {
      try {
        const shown = localStorage.getItem("battery_prompt_shown");
        if (!shown) {
          localStorage.setItem("battery_prompt_shown", "1");
          toast({
            title: "Keep monitoring alive",
            description: "Disable battery optimization for CareConnect: Settings → Apps → CareConnect → Battery → Unrestricted.",
          });
        }
      } catch {}
    }
    toast({
      title: next ? "Emergency Monitoring ON" : "Emergency Monitoring OFF",
      description: next
        ? "SOS button is active. Guardians will be notified in an emergency."
        : "SOS button is disabled. Turn monitoring back on to send alerts.",
      variant: next ? "default" : "destructive",
    });
  };

  const toggleShake = (next: boolean) => {
    setShakeEnabled(next);
    try { localStorage.setItem("shake_detection_enabled", String(next)); } catch {}
    toast({
      title: next ? "Shake Detection ON" : "Shake Detection OFF",
      description: next ? "Strong phone shake will trigger SOS." : "Shake will no longer trigger SOS.",
    });
  };

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

      const locationSource = emergencyLocation.latitude !== 0 && emergencyLocation.longitude !== 0
        ? "gps"
        : "unavailable";

      const smsResult = await sendEmergencySMS({
        emergencyId: emergency.id,
        userPhone: currentProfile.phone,
        userName: currentProfile.name,
        location: emergencyLocation,
        locationSource,
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

    const { data: guardianData } = await supabase
      .from("guardians")
      .select("name, contact_number, relationship")
      .eq("user_id", user.id);
    setGuardians(guardianData || []);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // --- SHAKE DETECTION (>15 m/s², 30s cooldown) ---
  useEffect(() => {
    if (!shakeEnabled || !monitoringEnabled) return;
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) return;

    let lastCalc = 0;
    const handleMotion = (event: DeviceMotionEvent) => {
      try {
        const now = Date.now();
        if (now - lastCalc < 1000) return; // 1s debounce
        lastCalc = now;
        const a = event?.accelerationIncludingGravity;
        if (!a || a.x == null || a.y == null || a.z == null) return;
        const magnitude = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
        if (magnitude > 22) {
          if (now - lastShakeRef.current < 30000) return;
          lastShakeRef.current = now;
          toast({ title: "Shake detected", description: "Sending SOS...", variant: "destructive" });
          try { LockScreenSOS.wakeScreen(); } catch {}
          try { triggerSOS(); } catch (e) { console.error("[Shake] SOS failed", e); }
        }
      } catch (err) {
        console.error("[Shake] handler error", err);
      }
    };

    // iOS 13+ requires permission
    const anyDM: any = (window as any).DeviceMotionEvent;
    if (typeof anyDM?.requestPermission === "function") {
      anyDM.requestPermission().then((res: string) => {
        if (res === "granted") window.addEventListener("devicemotion", handleMotion);
      }).catch(() => {});
    } else {
      window.addEventListener("devicemotion", handleMotion);
    }

    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [shakeEnabled, monitoringEnabled, triggerSOS, toast]);

  // --- Background lock-screen monitoring service ---
  useEffect(() => {
    if (monitoringEnabled) {
      LockScreenSOS.startBackgroundMonitoring().catch(() => {});
    } else {
      LockScreenSOS.stopBackgroundMonitoring().catch(() => {});
    }
  }, [monitoringEnabled]);

  // --- Volume-button SOS bridge from native MainActivity ---
  useEffect(() => {
    if (!monitoringEnabled) return;
    const handler = () => {
      toast({ title: "Volume SOS", description: "Sending SOS...", variant: "destructive" });
      try { LockScreenSOS.wakeScreen(); } catch {}
      try { triggerSOS(); } catch (e) { console.error("[VolumeSOS] failed", e); }
    };
    window.addEventListener("careconnect:volumeSOS", handler);
    return () => window.removeEventListener("careconnect:volumeSOS", handler);
  }, [monitoringEnabled, triggerSOS, toast]);


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
            {profile.profile_photo_url ? (
              <img
                src={profile.profile_photo_url}
                alt={profile.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-primary"
              />
            ) : (
              <div className="bg-gradient-emergency p-2 rounded-full">
                <Heart className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">CareConnect</h1>
              <p className="text-sm text-muted-foreground">Welcome, {profile.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
        {/* Toggles */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className={monitoringEnabled ? "border-2 border-primary" : "border-2 border-muted"}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                {monitoringEnabled ? <Bell className="w-5 h-5 text-primary" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
                <div>
                  <Label htmlFor="monitoring-toggle" className="text-base font-semibold cursor-pointer">🔔 Emergency Monitoring</Label>
                  <p className="text-xs text-muted-foreground">{monitoringEnabled ? "SOS button is active" : "SOS button is disabled"}</p>
                </div>
              </div>
              <Switch id="monitoring-toggle" checked={monitoringEnabled} onCheckedChange={toggleMonitoring} />
            </CardContent>
          </Card>

          <Card className={shakeEnabled ? "border-2 border-orange-500" : "border-2 border-muted"}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Smartphone className={`w-5 h-5 ${shakeEnabled ? "text-orange-500" : "text-muted-foreground"}`} />
                <div>
                  <Label htmlFor="shake-toggle" className="text-base font-semibold cursor-pointer">📳 Shake Detection</Label>
                  <p className="text-xs text-muted-foreground">{shakeEnabled ? "Shake phone hard to trigger SOS" : "Shake detection disabled"}</p>
                </div>
              </div>
              <Switch id="shake-toggle" checked={shakeEnabled} onCheckedChange={toggleShake} />
            </CardContent>
          </Card>
        </div>

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
              disabled={isSendingSMS || !monitoringEnabled}
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

            {!monitoringEnabled && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
                <p className="font-medium text-yellow-700 dark:text-yellow-400">
                  ⚠️ Emergency Monitoring is OFF
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  Turn on the toggle above to enable the SOS button.
                </p>
              </div>
            )}

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

        {/* Guardians */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PhoneIcon className="w-4 h-4" /> Emergency Contacts
            </CardTitle>
            <CardDescription>{guardians.length} guardian{guardians.length === 1 ? "" : "s"} configured</CardDescription>
          </CardHeader>
          <CardContent>
            {guardians.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No guardians yet. Add one in Settings to receive SMS alerts.
              </p>
            ) : (
              <ul className="space-y-2">
                {guardians.map((g, i) => (
                  <li key={i} className="flex justify-between items-center text-sm border-b last:border-0 pb-2 last:pb-0">
                    <div>
                      <p className="font-medium">{g.name}</p>
                      {g.relationship && <p className="text-xs text-muted-foreground">{g.relationship}</p>}
                    </div>
                    <a href={`tel:${g.contact_number}`} className="text-primary hover:underline">{g.contact_number}</a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Background crash detection is now handled by useCrashDetection hook inside MonitoringToggle */}
    </div>
  );
};

export default Dashboard;
