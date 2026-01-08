import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User, Heart, Users } from "lucide-react";

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Personal Details
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  // Medical Info
  const [bloodGroup, setBloodGroup] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Guardians
  const [guardians, setGuardians] = useState([
    { name: "", relationship: "", contact: "" },
  ]);

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  useEffect(() => {
    // Prefill name/phone from existing profile (preferred) or auth metadata (fallback)
    const prefill = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, phone")
        .eq("user_id", user.id)
        .maybeSingle();

      const meta: any = user.user_metadata ?? {};
      setName(String(profile?.name ?? meta?.name ?? "").trim());
      setPhone(String(profile?.phone ?? meta?.phone ?? "").trim());
    };

    prefill();
  }, []);

  const addGuardian = () => {
    setGuardians([...guardians, { name: "", relationship: "", contact: "" }]);
  };

  const removeGuardian = (index: number) => {
    setGuardians(guardians.filter((_, i) => i !== index));
  };

  const updateGuardian = (index: number, field: string, value: string) => {
    const updated = [...guardians];
    updated[index] = { ...updated[index], [field]: value };
    setGuardians(updated);
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const profilePatch = {
        age: age ? parseInt(age) : null,
        gender,
        address,
        vehicle_number: vehicleNumber,
        remarks,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      };

      // Ensure we always have the required fields for profiles (name + phone)
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("name, phone")
        .eq("user_id", user.id)
        .maybeSingle();

      const meta: any = user.user_metadata ?? {};
      const finalName = String(name || existingProfile?.name || meta?.name || "User").trim() || "User";
      const finalPhone = String(phone || existingProfile?.phone || meta?.phone || "").trim();

      if (!finalPhone) {
        throw new Error("Please enter your phone number to continue.");
      }

      // Upsert profile (creates row if missing, updates if exists)
      const { error: profileUpsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
            name: finalName,
            phone: finalPhone,
            ...profilePatch,
          },
          { onConflict: "user_id" },
        );

      if (profileUpsertError) throw profileUpsertError;

      // Upsert medical info (update if exists, insert if not)
      const { error: medicalError } = await supabase
        .from("medical_info")
        .upsert({
          user_id: user.id,
          blood_group: bloodGroup,
          medical_history: medicalHistory,
          additional_notes: additionalNotes,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (medicalError) throw medicalError;

      // Delete existing guardians and insert new ones
      const validGuardians = guardians.filter(
        (g) => g.name && g.relationship && g.contact
      );
      
      // Remove old guardians first
      await supabase
        .from("guardians")
        .delete()
        .eq("user_id", user.id);

      // Insert new guardians
      if (validGuardians.length > 0) {
        const { error: guardiansError } = await supabase.from("guardians").insert(
          validGuardians.map((g) => ({
            user_id: user.id,
            name: g.name,
            relationship: g.relationship,
            contact_number: g.contact,
          }))
        );
        if (guardiansError) throw guardiansError;
      }

      toast({
        title: "Profile Complete!",
        description: "Your emergency profile has been set up.",
      });

      navigate("/dashboard");
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-primary" />
              <div>
                <h3 className="font-semibold text-lg">Personal Details</h3>
                <p className="text-sm text-muted-foreground">
                  Help us know you better
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="25"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Residential Address</Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, City, State, ZIP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle Number (Optional)</Label>
              <Input
                id="vehicle"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="ABC-1234"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remarks">Additional Remarks (Optional)</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any additional information..."
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <Heart className="w-6 h-6 text-emergency" />
              <div>
                <h3 className="font-semibold text-lg">Medical Information</h3>
                <p className="text-sm text-muted-foreground">
                  Critical for emergency response
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bloodGroup">Blood Group</Label>
              <Select value={bloodGroup} onValueChange={setBloodGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
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
              <Label htmlFor="history">Medical History</Label>
              <Textarea
                id="history"
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                placeholder="Any chronic conditions, allergies, or past surgeries..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Medical Notes</Label>
              <Textarea
                id="notes"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Medications, special requirements..."
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <Users className="w-6 h-6 text-success" />
              <div>
                <h3 className="font-semibold text-lg">Emergency Contacts</h3>
                <p className="text-sm text-muted-foreground">
                  Who should we notify?
                </p>
              </div>
            </div>
            {guardians.map((guardian, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Guardian {index + 1}</h4>
                    {guardians.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeGuardian(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="Guardian Name"
                    value={guardian.name}
                    onChange={(e) =>
                      updateGuardian(index, "name", e.target.value)
                    }
                  />
                  <Input
                    placeholder="Relationship"
                    value={guardian.relationship}
                    onChange={(e) =>
                      updateGuardian(index, "relationship", e.target.value)
                    }
                  />
                  <Input
                    placeholder="Contact Number"
                    type="tel"
                    value={guardian.contact}
                    onChange={(e) =>
                      updateGuardian(index, "contact", e.target.value)
                    }
                  />
                </div>
              </Card>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={addGuardian}
            >
              + Add Another Guardian
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-success/10 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Complete Your Profile</CardTitle>
            <CardDescription>
              Step {step} of {totalSteps}
            </CardDescription>
            <Progress value={progress} className="mt-2" />
          </CardHeader>
          <CardContent>
            {renderStep()}
            <div className="flex gap-3 mt-6">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="flex-1"
                >
                  Back
                </Button>
              )}
              <Button
                onClick={handleNext}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : step === totalSteps ? (
                  "Complete Setup"
                ) : (
                  "Next"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;