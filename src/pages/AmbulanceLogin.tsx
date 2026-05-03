import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import AppLogo from "@/components/AppLogo";

const REMEMBER_KEY = "ambulance_remember_email";

const AmbulanceLogin = () => {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Register fields
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) { setEmail(saved); setRememberMe(true); }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: ambData } = await supabase
          .from("ambulance_services")
          .select("id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (ambData?.id) {
          localStorage.setItem("ambulance_id", ambData.id);
          navigate("/ambulance/driver");
        }
      }
    })();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("Login failed");

      if (rememberMe) localStorage.setItem(REMEMBER_KEY, email);
      else localStorage.removeItem(REMEMBER_KEY);

      const { data: roleData } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", data.user.id).eq("role", "ambulance").maybeSingle();

      if (!roleData) {
        await supabase.auth.signOut();
        throw new Error("This account does not have ambulance driver access.");
      }

      const { data: ambData } = await supabase
        .from("ambulance_services").select("id")
        .eq("user_id", data.user.id).maybeSingle();

      if (!ambData?.id) throw new Error("No ambulance linked to this account. Contact admin.");

      localStorage.setItem("ambulance_id", ambData.id);
      toast({ title: "Welcome!", description: "Redirecting to dashboard..." });
      navigate("/ambulance/driver");
    } catch (error: any) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-ambulance", {
        body: {
          email: regEmail,
          password: regPassword,
          phone: regPhone,
          serviceName,
          licenseNumber,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({ title: "Registered!", description: "You can now sign in." });
      setEmail(regEmail);
      setTab("login");
      setRegEmail(""); setRegPassword(""); setRegPhone(""); setServiceName(""); setLicenseNumber("");
    } catch (error: any) {
      toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-8">
      <Card className="w-full max-w-md bg-slate-800/80 border-slate-700">
        <CardHeader className="text-center">
          <AppLogo className="w-20 h-20 mx-auto mb-3" />
          <CardTitle className="text-2xl font-bold text-white">Ambulance Driver</CardTitle>
          <CardDescription className="text-slate-400">Sign in or register your ambulance</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
            <TabsList className="grid w-full grid-cols-2 bg-slate-900/50">
              <TabsTrigger value="login" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-slate-900/50 border-slate-600 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-slate-900/50 border-slate-600 text-white" required />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="remember-me" checked={rememberMe} onCheckedChange={(v) => setRememberMe(v === true)} />
                  <Label htmlFor="remember-me" className="cursor-pointer text-sm text-slate-300">Remember me</Label>
                </div>
                <Button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white">
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-3 mt-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Service Name</Label>
                  <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="City Ambulance #4" className="bg-slate-900/50 border-slate-600 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">License Number</Label>
                  <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="AMB-12345" className="bg-slate-900/50 border-slate-600 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Phone</Label>
                  <Input type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="+91 98765 43210" className="bg-slate-900/50 border-slate-600 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Email</Label>
                  <Input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="bg-slate-900/50 border-slate-600 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Password</Label>
                  <Input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} minLength={6} className="bg-slate-900/50 border-slate-600 text-white" required />
                </div>
                <Button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white">
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  Register Ambulance
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AmbulanceLogin;
