import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Truck, LogIn } from "lucide-react";

const AmbulanceLogin = () => {
  const [searchParams] = useSearchParams();
  const ambulanceIdFromUrl = searchParams.get("id");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ambulanceId, setAmbulanceId] = useState(ambulanceIdFromUrl || "");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // If ambulance ID is passed in URL, try direct access
  useEffect(() => {
    if (ambulanceIdFromUrl) {
      setAmbulanceId(ambulanceIdFromUrl);
    }
  }, [ambulanceIdFromUrl]);

  // Check if already logged in with ambulance role
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "ambulance")
          .maybeSingle();

        if (roleData) {
          // Find ambulance linked to this user
          const { data: ambData } = await supabase
            .from("ambulance_services")
            .select("id")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (ambData) {
            navigate(`/ambulance/driver?id=${ambData.id}`);
          }
        }
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;

      if (data.user) {
        // Check ambulance role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .eq("role", "ambulance")
          .maybeSingle();

        if (!roleData) {
          toast({
            title: "Access Denied",
            description: "This account does not have ambulance driver access.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          setIsLoading(false);
          return;
        }

        // Find ambulance service linked to this user
        const { data: ambData } = await supabase
          .from("ambulance_services")
          .select("id")
          .eq("user_id", data.user.id)
          .maybeSingle();

        const targetId = ambData?.id || ambulanceId;

        if (!targetId) {
          toast({
            title: "No Ambulance Linked",
            description: "Your account is not linked to an ambulance service. Contact admin.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        localStorage.setItem("ambulance_id", targetId);
        toast({ title: "Welcome!", description: "Redirecting to dashboard..." });
        navigate(`/ambulance/driver?id=${targetId}`);
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectAccess = async () => {
    if (!ambulanceId.trim()) {
      toast({
        title: "Missing ID",
        description: "Please enter an ambulance ID",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    // Verify the ambulance exists
    const { data, error } = await supabase
      .from("ambulance_services")
      .select("id, name")
      .eq("id", ambulanceId.trim())
      .maybeSingle();

    if (error || !data) {
      toast({
        title: "Not Found",
        description: "No ambulance found with that ID",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    localStorage.setItem("ambulance_id", data.id);
    toast({ title: `Welcome, ${data.name}!` });
    navigate(`/ambulance/driver?id=${data.id}`);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <Card className="w-full max-w-md bg-slate-800/80 border-slate-700">
        <CardHeader className="text-center">
          <div className="mx-auto bg-gradient-to-br from-orange-500 to-red-600 p-4 rounded-2xl w-fit mb-4">
            <Truck className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">Ambulance Driver</CardTitle>
          <CardDescription className="text-slate-400">
            Sign in to access your driver dashboard
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Credential Login */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="driver@example.com"
                className="bg-slate-900/50 border-slate-600 text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-slate-900/50 border-slate-600 text-white"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold py-5"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4 mr-2" />
              )}
              Sign In
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-600" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-800 px-2 text-slate-400">Or access with ID</span>
            </div>
          </div>

          {/* Direct ID Access */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ambulanceId" className="text-slate-300">Ambulance ID</Label>
              <Input
                id="ambulanceId"
                value={ambulanceId}
                onChange={(e) => setAmbulanceId(e.target.value)}
                placeholder="Enter ambulance UUID"
                className="bg-slate-900/50 border-slate-600 text-white font-mono text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleDirectAccess}
              disabled={isLoading}
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Truck className="w-4 h-4 mr-2" />
              Access Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AmbulanceLogin;
