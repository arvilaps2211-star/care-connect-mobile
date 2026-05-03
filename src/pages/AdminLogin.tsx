import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogIn } from "lucide-react";
import AppLogo from "@/components/AppLogo";

const AdminLogin = () => {
  const [email, setEmail] = useState("admin@careconnect.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: role } = await supabase
          .from("user_roles").select("role")
          .eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
        if (role) navigate("/admin");
      }
    })();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: role } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", data.user!.id).eq("role", "admin").maybeSingle();
      if (!role) {
        await supabase.auth.signOut();
        throw new Error("This account does not have admin access.");
      }
      toast({ title: "Welcome, Admin!" });
      navigate("/admin");
    } catch (error: any) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <Card className="w-full max-w-md bg-slate-800/80 border-slate-700">
        <CardHeader className="text-center">
          <AppLogo className="w-20 h-20 mx-auto mb-3" />
          <CardTitle className="text-2xl font-bold text-white">CareConnect Admin</CardTitle>
          <CardDescription className="text-slate-400">Sign in to the admin console</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-slate-900/50 border-slate-600 text-white" required />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-slate-900/50 border-slate-600 text-white" required />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;