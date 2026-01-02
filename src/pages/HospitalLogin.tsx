import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Activity, Lock, Mail, AlertCircle, Building2, Phone, MapPin, Upload, FileCheck, Loader2, Monitor } from "lucide-react";

const HospitalLogin = () => {
  const [activeTab, setActiveTab] = useState("login");
  
  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Registration state
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [registering, setRegistering] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if user has hospital role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .single();

      if (roleError || !roleData || roleData.role !== "hospital") {
        await supabase.auth.signOut();
        throw new Error("Access denied. This account does not have hospital access.");
      }

      toast({
        title: "Welcome to CareConnect Hospitals",
        description: "Login successful. Redirecting to dashboard...",
      });

      navigate("/hospital");
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!licenseFile) {
      toast({
        title: "License Required",
        description: "Please upload your hospital license document",
        variant: "destructive",
      });
      return;
    }

    setRegistering(true);

    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/hospital`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Registration failed");

      const userId = authData.user.id;

      // Upload license document
      const licenseExt = licenseFile.name.split('.').pop();
      const licensePath = `${userId}/license.${licenseExt}`;
      
      const { error: licenseUploadError } = await supabase.storage
        .from("hospital-documents")
        .upload(licensePath, licenseFile);

      if (licenseUploadError) throw licenseUploadError;

      const { data: licenseUrlData } = supabase.storage
        .from("hospital-documents")
        .getPublicUrl(licensePath);

      let certificateUrl = null;
      
      // Upload certificate if provided
      if (certificateFile) {
        const certExt = certificateFile.name.split('.').pop();
        const certPath = `${userId}/certificate.${certExt}`;
        
        const { error: certUploadError } = await supabase.storage
          .from("hospital-documents")
          .upload(certPath, certificateFile);

        if (certUploadError) {
          console.error("Certificate upload failed:", certUploadError);
        } else {
          const { data: certUrlData } = supabase.storage
            .from("hospital-documents")
            .getPublicUrl(certPath);
          certificateUrl = certUrlData.publicUrl;
        }
      }

      // Use security definer function to register hospital (bypasses RLS)
      const { data: hospitalId, error: registerError } = await supabase
        .rpc('register_hospital', {
          p_user_id: userId,
          p_hospital_name: hospitalName,
          p_contact_number: contactNumber,
          p_latitude: parseFloat(latitude),
          p_longitude: parseFloat(longitude),
          p_license_url: licenseUrlData.publicUrl,
          p_certificate_url: certificateUrl,
        });

      if (registerError) throw registerError;

      toast({
        title: "Registration Successful",
        description: "Your hospital account has been created. You can now login.",
      });

      // Reset form and switch to login
      setActiveTab("login");
      setEmail(regEmail);
      setRegEmail("");
      setRegPassword("");
      setHospitalName("");
      setContactNumber("");
      setLatitude("");
      setLongitude("");
      setLicenseFile(null);
      setCertificateFile(null);

    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register hospital",
        variant: "destructive",
      });
    } finally {
      setRegistering(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString());
          setLongitude(position.coords.longitude.toString());
          toast({
            title: "Location Detected",
            description: "Hospital coordinates have been set",
          });
        },
        (error) => {
          toast({
            title: "Location Error",
            description: "Could not get current location",
            variant: "destructive",
          });
        }
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-lg">
        {/* Desktop Badge */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-4 py-2 rounded-full">
            <Monitor className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400 text-sm font-medium">Desktop Portal</span>
          </div>
        </div>

        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-gradient-to-br from-red-500 to-red-600 p-4 rounded-2xl mb-4">
            <Activity className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">CareConnect Hospitals</h1>
          <p className="text-slate-400 mt-2">Emergency Response Command Center</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 shadow-2xl">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 bg-slate-900/50">
              <TabsTrigger value="login" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                Register Hospital
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <CardHeader className="text-center">
                <CardTitle className="text-xl text-white">Hospital Staff Login</CardTitle>
                <CardDescription className="text-slate-400">
                  Enter your credentials to access the dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-300">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="hospital@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-red-500"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-300">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-red-500"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-6"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      "Sign In to Dashboard"
                    )}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>

            <TabsContent value="register">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl text-white">Register Your Hospital</CardTitle>
                <CardDescription className="text-slate-400">
                  Provide hospital details and verification documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  {/* Hospital Details */}
                  <div className="space-y-2">
                    <Label className="text-slate-300">Hospital Name *</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="City General Hospital"
                        value={hospitalName}
                        onChange={(e) => setHospitalName(e.target.value)}
                        className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Email *</Label>
                      <Input
                        type="email"
                        placeholder="admin@hospital.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Password *</Label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Contact Number *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        type="tel"
                        placeholder="+91 9876543210"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-300">Hospital Location *</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={getCurrentLocation}
                        className="text-blue-400 hover:text-blue-300 h-auto py-1"
                      >
                        <MapPin className="w-3 h-3 mr-1" />
                        Detect Location
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        step="any"
                        placeholder="Latitude"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                        required
                      />
                      <Input
                        type="number"
                        step="any"
                        placeholder="Longitude"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Document Upload */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-slate-300 font-medium">
                      <FileCheck className="w-4 h-4" />
                      Verification Documents
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm">Hospital License * (Required)</Label>
                      <div className="relative">
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                          className="bg-slate-900/50 border-slate-600 text-white file:bg-red-500 file:text-white file:border-0 file:mr-3 file:px-3 file:py-1 file:rounded"
                          required
                        />
                      </div>
                      {licenseFile && (
                        <p className="text-xs text-emerald-400 flex items-center gap-1">
                          <FileCheck className="w-3 h-3" />
                          {licenseFile.name}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm">Additional Certificates (Optional)</Label>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                        className="bg-slate-900/50 border-slate-600 text-white file:bg-slate-600 file:text-white file:border-0 file:mr-3 file:px-3 file:py-1 file:rounded"
                      />
                      {certificateFile && (
                        <p className="text-xs text-emerald-400 flex items-center gap-1">
                          <FileCheck className="w-3 h-3" />
                          {certificateFile.name}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={registering}
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-6"
                    size="lg"
                  >
                    {registering ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Registering Hospital...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Register Hospital
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>
          </Tabs>

          <div className="px-6 pb-6">
            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
                <div className="text-sm">
                  <p className="text-slate-300 font-medium">Verification Required</p>
                  <p className="text-slate-500 mt-1">
                    Hospital registration requires valid license and certification documents for verification.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Ambulance Login Link */}
        <div className="text-center mt-6">
          <p className="text-slate-400 text-sm">
            Are you an ambulance service?{" "}
            <Button
              variant="link"
              onClick={() => navigate("/ambulance/login")}
              className="text-orange-400 hover:text-orange-300 p-0"
            >
              Ambulance Login
            </Button>
          </p>
        </div>

        <p className="text-center text-slate-500 text-sm mt-4">
          CareConnect © 2024 • Emergency Response System
        </p>
      </div>
    </div>
  );
};

export default HospitalLogin;