import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Activity, Lock, Mail, Truck, Phone, MapPin, User, FileText, Loader2, ArrowLeft } from "lucide-react";

const AmbulanceLogin = () => {
  const [activeTab, setActiveTab] = useState("login");
  
  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Registration state
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  
  // Vehicle details
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  
  // Driver details
  const [driverName, setDriverName] = useState("");
  const [driverLicense, setDriverLicense] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  
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

      // Check if user has ambulance role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .single();

      if (roleError || !roleData || roleData.role !== "ambulance") {
        await supabase.auth.signOut();
        throw new Error("Access denied. This account does not have ambulance access.");
      }

      toast({
        title: "Welcome to CareConnect Ambulance",
        description: "Login successful. Redirecting to dashboard...",
      });

      navigate("/ambulance");
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
    setRegistering(true);

    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/ambulance`,
          data: {
            vehicle_number: vehicleNumber,
            vehicle_type: vehicleType,
            vehicle_model: vehicleModel,
            driver_name: driverName,
            driver_license: driverLicense,
            driver_phone: driverPhone,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Registration failed");

      const userId = authData.user.id;

      // Create ambulance service record
      const { error: ambulanceError } = await supabase
        .from("ambulance_services")
        .insert({
          name: serviceName,
          contact_number: contactNumber,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          user_id: userId,
        });

      if (ambulanceError) throw ambulanceError;

      // Assign ambulance role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "ambulance",
        });

      if (roleError) {
        console.error("Role assignment error:", roleError);
      }

      toast({
        title: "Registration Successful",
        description: "Your ambulance service has been registered. You can now login.",
      });

      // Reset form and switch to login
      setActiveTab("login");
      setEmail(regEmail);
      resetRegistrationForm();

    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register ambulance service",
        variant: "destructive",
      });
    } finally {
      setRegistering(false);
    }
  };

  const resetRegistrationForm = () => {
    setRegEmail("");
    setRegPassword("");
    setServiceName("");
    setContactNumber("");
    setLatitude("");
    setLongitude("");
    setVehicleNumber("");
    setVehicleType("");
    setVehicleModel("");
    setDriverName("");
    setDriverLicense("");
    setDriverPhone("");
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString());
          setLongitude(position.coords.longitude.toString());
          toast({
            title: "Location Detected",
            description: "Current coordinates have been set",
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
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4 text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600 p-4 rounded-2xl mb-4">
            <Truck className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">CareConnect Ambulance</h1>
          <p className="text-slate-400 mt-2">Emergency Response Vehicle Portal</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 shadow-2xl">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 bg-slate-900/50">
              <TabsTrigger value="login" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                Register Ambulance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <CardHeader className="text-center">
                <CardTitle className="text-xl text-white">Ambulance Driver Login</CardTitle>
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
                        placeholder="driver@ambulance.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
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
                        className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-6"
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
                <CardTitle className="text-xl text-white">Register Ambulance Service</CardTitle>
                <CardDescription className="text-slate-400">
                  Enter vehicle and driver details
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[60vh] overflow-y-auto">
                <form onSubmit={handleRegister} className="space-y-4">
                  {/* Service Details */}
                  <div className="space-y-3 p-3 bg-slate-900/30 rounded-lg">
                    <h3 className="text-sm font-medium text-orange-400 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Service Details
                    </h3>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm">Service Name *</Label>
                      <Input
                        placeholder="City Ambulance Services"
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                        className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-slate-300 text-sm">Email *</Label>
                        <Input
                          type="email"
                          placeholder="service@email.com"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300 text-sm">Password *</Label>
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
                      <Label className="text-slate-300 text-sm">Contact Number *</Label>
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
                        <Label className="text-slate-300 text-sm">Base Location *</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={getCurrentLocation}
                          className="text-blue-400 hover:text-blue-300 h-auto py-1 text-xs"
                        >
                          <MapPin className="w-3 h-3 mr-1" />
                          Detect
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
                  </div>

                  {/* Vehicle Details */}
                  <div className="space-y-3 p-3 bg-slate-900/30 rounded-lg">
                    <h3 className="text-sm font-medium text-orange-400 flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      Vehicle Details
                    </h3>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm">Vehicle Number *</Label>
                      <Input
                        placeholder="TN 01 AB 1234"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                        className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-slate-300 text-sm">Vehicle Type *</Label>
                        <Input
                          placeholder="Basic / Advanced"
                          value={vehicleType}
                          onChange={(e) => setVehicleType(e.target.value)}
                          className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300 text-sm">Model</Label>
                        <Input
                          placeholder="Force Traveller"
                          value={vehicleModel}
                          onChange={(e) => setVehicleModel(e.target.value)}
                          className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Driver Details */}
                  <div className="space-y-3 p-3 bg-slate-900/30 rounded-lg">
                    <h3 className="text-sm font-medium text-orange-400 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Driver Details
                    </h3>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm">Driver Name *</Label>
                      <Input
                        placeholder="Full Name"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-slate-300 text-sm">License Number *</Label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          <Input
                            placeholder="DL123456789"
                            value={driverLicense}
                            onChange={(e) => setDriverLicense(e.target.value)}
                            className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300 text-sm">Driver Phone *</Label>
                        <Input
                          type="tel"
                          placeholder="+91 98765..."
                          value={driverPhone}
                          onChange={(e) => setDriverPhone(e.target.value)}
                          className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={registering}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-6"
                    size="lg"
                  >
                    {registering ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      "Register Ambulance Service"
                    )}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Hospital Login Link */}
        <div className="text-center mt-6">
          <p className="text-slate-400 text-sm">
            Are you a hospital?{" "}
            <Button
              variant="link"
              onClick={() => navigate("/hospital/login")}
              className="text-red-400 hover:text-red-300 p-0"
            >
              Hospital Login
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AmbulanceLogin;
