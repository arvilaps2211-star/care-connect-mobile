import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Activity, Lock, Mail, AlertCircle } from "lucide-react";

const HospitalLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-gradient-to-br from-red-500 to-red-600 p-4 rounded-2xl mb-4">
            <Activity className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">CareConnect Hospitals</h1>
          <p className="text-slate-400 mt-2">Emergency Response Command Center</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 shadow-2xl">
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
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Signing In...
                  </>
                ) : (
                  "Sign In to Dashboard"
                )}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
                <div className="text-sm">
                  <p className="text-slate-300 font-medium">Hospital Staff Only</p>
                  <p className="text-slate-500 mt-1">
                    This portal is exclusively for authorized hospital personnel. Contact your administrator if you need access.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-sm mt-6">
          CareConnect Hospitals © 2024 • Emergency Response System
        </p>
      </div>
    </div>
  );
};

export default HospitalLogin;
