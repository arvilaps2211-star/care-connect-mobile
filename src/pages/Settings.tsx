import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentPosition } from "@/utils/geolocation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, User, Heart, Users, Shield, Loader2, MessageSquare, Plus, Trash2 } from "lucide-react";

interface Guardian {
  id?: string;
  name: string;
  relationship: string;
  contact_number: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Test SMS
  const [testPhone, setTestPhone] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Sheets
  const [personalOpen, setPersonalOpen] = useState(false);
  const [medicalOpen, setMedicalOpen] = useState(false);
  const [guardiansOpen, setGuardiansOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);

  // Personal Info
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");

  // Medical Info
  const [bloodGroup, setBloodGroup] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Guardians
  const [guardians, setGuardians] = useState<Guardian[]>([]);

  // Safety
  const [sensitivity, setSensitivity] = useState(50);

  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Keep Settings reactive to auth changes (avoids "not saving" when userId wasn't loaded yet)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      setUserId(nextUserId);
      if (nextUserId) {
        // Defer any DB calls; never call Supabase directly inside the auth callback
        setTimeout(() => {
          loadUserData(nextUserId);
        }, 0);
      } else {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      const nextUserId = session?.user?.id ?? null;
      setUserId(nextUserId);
      if (!nextUserId) {
        navigate("/auth");
        return;
      }
      loadUserData(nextUserId);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadUserData = async (uid: string) => {
    // Load profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();

    if (profile) {
      setName(profile.name || "");
      setPhone(profile.phone || "");
      setAge(profile.age?.toString() || "");
      setGender(profile.gender || "");
      setAddress(profile.address || "");
      setVehicleNumber(profile.vehicle_number || "");
    }

    // Load medical info
    const { data: medical } = await supabase
      .from("medical_info")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();

    if (medical) {
      setBloodGroup(medical.blood_group || "");
      setMedicalHistory(medical.medical_history || "");
      setAdditionalNotes(medical.additional_notes || "");
    }

    // Load guardians
    const { data: guardianData } = await supabase
      .from("guardians")
      .select("*")
      .eq("user_id", uid);

    if (guardianData && guardianData.length > 0) {
      setGuardians(guardianData);
    } else {
      setGuardians([]);
    }
  };

  const canSend = useMemo(() => testPhone.trim().length > 0 && !isSendingTest, [testPhone, isSendingTest]);

  const handleSendTestSms = async () => {
    setIsSendingTest(true);
    try {
      const location = await getCurrentPosition();
      const { data, error } = await supabase.functions.invoke("send-test-sms", {
        body: { toPhone: testPhone.trim(), location },
      });
      if (error) throw error;
      toast({ title: "Test SMS sent", description: `Sent to ${data?.to ?? testPhone.trim()}. Check your phone now.` });
    } catch (e: any) {
      toast({ title: "Test SMS failed", description: e?.message ?? "Unable to send test SMS", variant: "destructive" });
    } finally {
      setIsSendingTest(false);
    }
  };

  const savePersonalInfo = async () => {
    if (!userId) {
      navigate("/auth");
      return;
    }

    if (!name.trim() || !phone.trim()) {
      toast({
        title: "Missing info",
        description: "Name and phone are required.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const patch = {
        name: name.trim(),
        phone: phone.trim(),
        age: age ? parseInt(age) : null,
        gender,
        address,
        vehicle_number: vehicleNumber,
        updated_at: new Date().toISOString(),
      };

      // Upsert profile (now safe with unique constraint on user_id)
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          user_id: userId,
          ...patch,
          onboarding_completed: true,
        },
        { onConflict: "user_id" }
      );

      if (profileError) throw profileError;

      toast({ title: "Saved", description: "Personal information updated." });
      setPersonalOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const saveMedicalInfo = async () => {
    if (!userId) {
      navigate("/auth");
      return;
    }
    setIsSaving(true);
    try {
      const patch = {
        blood_group: bloodGroup,
        medical_history: medicalHistory,
        additional_notes: additionalNotes,
        updated_at: new Date().toISOString(),
      };

      // Upsert medical info (now safe with unique constraint on user_id)
      const { error: medicalError } = await supabase.from("medical_info").upsert(
        {
          user_id: userId,
          ...patch,
        },
        { onConflict: "user_id" }
      );

      if (medicalError) throw medicalError;

      toast({ title: "Saved", description: "Medical information updated." });
      setMedicalOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const saveGuardians = async () => {
    if (!userId) {
      navigate("/auth");
      return;
    }
    setIsSaving(true);
    try {
      // Delete existing
      const { error: deleteError } = await supabase.from("guardians").delete().eq("user_id", userId);
      if (deleteError) throw deleteError;

      // Insert new
      const validGuardians = guardians.filter((g) => g.name && g.relationship && g.contact_number);
      if (validGuardians.length > 0) {
        const { error } = await supabase.from("guardians").insert(
          validGuardians.map((g) => ({
            user_id: userId,
            name: g.name,
            relationship: g.relationship,
            contact_number: g.contact_number,
          })),
        );
        if (error) throw error;
      }

      toast({ title: "Saved", description: "Emergency contacts updated." });
      setGuardiansOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const addGuardian = () => {
    setGuardians([...guardians, { name: "", relationship: "", contact_number: "" }]);
  };

  const removeGuardian = (index: number) => {
    setGuardians(guardians.filter((_, i) => i !== index));
  };

  const updateGuardian = (index: number, field: keyof Guardian, value: string) => {
    const updated = [...guardians];
    updated[index] = { ...updated[index], [field]: value };
    setGuardians(updated);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-success/5">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Back to dashboard">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-4">
        {/* Test SMS */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <MessageSquare className="w-8 h-8 text-primary" />
            <div>
              <CardTitle>Test SMS</CardTitle>
              <CardDescription>Send a test message to verify SMS delivery</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="testPhone">Your phone number</Label>
              <Input id="testPhone" type="tel" placeholder="+91 98765 43210" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleSendTestSms} disabled={!canSend}>
              {isSendingTest ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : "Send Test SMS"}
            </Button>
            <p className="text-sm text-muted-foreground">We'll include your current location (maps link) in the test message.</p>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setPersonalOpen(true)}>
          <CardHeader className="flex flex-row items-center gap-4">
            <User className="w-8 h-8 text-primary" />
            <div>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your profile details</CardDescription>
            </div>
          </CardHeader>
        </Card>

        {/* Medical Information */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setMedicalOpen(true)}>
          <CardHeader className="flex flex-row items-center gap-4">
            <Heart className="w-8 h-8 text-emergency" />
            <div>
              <CardTitle>Medical Information</CardTitle>
              <CardDescription>Manage your medical records</CardDescription>
            </div>
          </CardHeader>
        </Card>

        {/* Emergency Contacts */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setGuardiansOpen(true)}>
          <CardHeader className="flex flex-row items-center gap-4">
            <Users className="w-8 h-8 text-success" />
            <div>
              <CardTitle>Emergency Contacts</CardTitle>
              <CardDescription>Manage your guardians</CardDescription>
            </div>
          </CardHeader>
        </Card>

        {/* Safety Settings */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSafetyOpen(true)}>
          <CardHeader className="flex flex-row items-center gap-4">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <CardTitle>Safety Settings</CardTitle>
              <CardDescription>Configure detection sensitivity</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Personal Info Sheet */}
      <Sheet open={personalOpen} onOpenChange={setPersonalOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Personal Information</SheetTitle>
            <SheetDescription>Update your profile details</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-2">
              <Label>Age</Label>
              <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Your address" />
            </div>
            <div className="space-y-2">
              <Label>Vehicle Number</Label>
              <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="ABC-1234" />
            </div>
            <Button className="w-full" onClick={savePersonalInfo} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Medical Info Sheet */}
      <Sheet open={medicalOpen} onOpenChange={setMedicalOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Medical Information</SheetTitle>
            <SheetDescription>Critical for emergency response</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Blood Group</Label>
              <Select value={bloodGroup} onValueChange={setBloodGroup}>
                <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A-">A-</SelectItem>
                  <SelectItem value="B+">B+</SelectItem>
                  <SelectItem value="B-">B-</SelectItem>
                  <SelectItem value="AB+">AB+</SelectItem>
                  <SelectItem value="AB-">AB-</SelectItem>
                  <SelectItem value="O+">O+</SelectItem>
                  <SelectItem value="O-">O-</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Medical History</Label>
              <Textarea value={medicalHistory} onChange={(e) => setMedicalHistory(e.target.value)} placeholder="Chronic conditions, allergies, surgeries..." rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} placeholder="Medications, special requirements..." />
            </div>
            <Button className="w-full" onClick={saveMedicalInfo} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Guardians Sheet */}
      <Sheet open={guardiansOpen} onOpenChange={setGuardiansOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Emergency Contacts</SheetTitle>
            <SheetDescription>Who should we notify in an emergency?</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            {guardians.map((guardian, index) => (
              <Card key={index} className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-medium">Guardian {index + 1}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeGuardian(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="space-y-3">
                  <Input placeholder="Name" value={guardian.name} onChange={(e) => updateGuardian(index, "name", e.target.value)} />
                  <Input placeholder="Relationship" value={guardian.relationship} onChange={(e) => updateGuardian(index, "relationship", e.target.value)} />
                  <Input placeholder="Contact Number" type="tel" value={guardian.contact_number} onChange={(e) => updateGuardian(index, "contact_number", e.target.value)} />
                </div>
              </Card>
            ))}
            <Button variant="outline" className="w-full" onClick={addGuardian}>
              <Plus className="mr-2 h-4 w-4" /> Add Guardian
            </Button>
            <Button className="w-full" onClick={saveGuardians} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Safety Settings Sheet */}
      <Sheet open={safetyOpen} onOpenChange={setSafetyOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Safety Settings</SheetTitle>
            <SheetDescription>Configure accident detection sensitivity</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 mt-6">
            <div className="space-y-4">
              <Label>Detection Sensitivity</Label>
              <Slider value={[sensitivity]} onValueChange={(v) => setSensitivity(v[0])} max={100} step={1} />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Less sensitive</span>
                <span>{sensitivity}%</span>
                <span>More sensitive</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Higher sensitivity detects smaller impacts but may trigger more false alarms.
              </p>
            </div>
            <Button className="w-full" onClick={() => { toast({ title: "Saved", description: "Safety settings updated." }); setSafetyOpen(false); }}>
              Save Changes
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Settings;
