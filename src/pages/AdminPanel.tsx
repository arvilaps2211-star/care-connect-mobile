import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Hospital, Ambulance, Trash2, Activity, Users, AlertTriangle, CheckCircle, BarChart3, Shield, Clock, MessageSquare, MapPin } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SMSStatusBadge } from "@/components/SMSStatusBadge";

interface Emergency {
  id: string;
  user_id: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  notified_at: string | null;
  guardian_notified: boolean;
  accepted_by_hospital: string | null;
  dispatched_to_ambulance: string | null;
}

interface Stats {
  totalEmergencies: number;
  activeEmergencies: number;
  resolvedEmergencies: number;
  totalHospitals: number;
  totalAmbulances: number;
  totalUsers: number;
}

const AdminPanel = () => {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalEmergencies: 0,
    activeEmergencies: 0,
    resolvedEmergencies: 0,
    totalHospitals: 0,
    totalAmbulances: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingEmergencies, setLoadingEmergencies] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Auth is handled by ProtectedRoute - just fetch data
    console.log("[ADMIN] Initializing admin panel...");
    fetchData();
    fetchStats();
    fetchEmergencies();
  }, []);

  const fetchStats = async () => {
    try {
      console.log("[ADMIN] Fetching stats...");
      
      // Fetch emergency counts with individual error handling
      const [emergencyRes, activeRes, resolvedRes, hospitalRes, ambulanceRes, userRes] = await Promise.all([
        supabase.from("emergencies").select("*", { count: "exact", head: true }),
        supabase.from("emergencies").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("emergencies").select("*", { count: "exact", head: true }).in("status", ["resolved", "closed"]),
        supabase.from("hospitals").select("*", { count: "exact", head: true }),
        supabase.from("ambulance_services").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);

      // Log any errors but don't crash
      if (emergencyRes.error) console.warn("[ADMIN] Error fetching emergencies:", emergencyRes.error.message);
      if (activeRes.error) console.warn("[ADMIN] Error fetching active emergencies:", activeRes.error.message);
      if (resolvedRes.error) console.warn("[ADMIN] Error fetching resolved emergencies:", resolvedRes.error.message);
      if (hospitalRes.error) console.warn("[ADMIN] Error fetching hospitals:", hospitalRes.error.message);
      if (ambulanceRes.error) console.warn("[ADMIN] Error fetching ambulances:", ambulanceRes.error.message);
      if (userRes.error) console.warn("[ADMIN] Error fetching users:", userRes.error.message);

      setStats({
        totalEmergencies: emergencyRes.count || 0,
        activeEmergencies: activeRes.count || 0,
        resolvedEmergencies: resolvedRes.count || 0,
        totalHospitals: hospitalRes.count || 0,
        totalAmbulances: ambulanceRes.count || 0,
        totalUsers: userRes.count || 0,
      });
      
      console.log("[ADMIN] Stats loaded successfully");
    } catch (error: any) {
      console.error("[ADMIN] Exception fetching stats:", error?.message || error);
    }
  };

  const fetchEmergencies = async () => {
    setLoadingEmergencies(true);
    try {
      console.log("[ADMIN] Fetching emergencies...");
      
      // Fetch emergencies (NO patient medical/guardian data - privacy)
      const { data: emergencyData, error: emergencyError } = await supabase
        .from("emergencies")
        .select("id, user_id, status, latitude, longitude, created_at, notified_at, guardian_notified, accepted_by_hospital, dispatched_to_ambulance")
        .order("created_at", { ascending: false })
        .limit(50);

      if (emergencyError) {
        console.warn("[ADMIN] Error fetching emergencies:", emergencyError.message);
      }

      setEmergencies(emergencyData || []);
      console.log("[ADMIN] Emergencies loaded:", emergencyData?.length || 0);
    } catch (error: any) {
      console.error("[ADMIN] Exception fetching emergencies:", error?.message || error);
      setEmergencies([]);
    } finally {
      setLoadingEmergencies(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    
    try {
      console.log("[ADMIN] Fetching data...");
      
      // Fetch hospitals with verification status (NO patient data)
      const { data: hospitalsData, error: hospitalError } = await supabase
        .from("hospitals")
        .select("id, name, contact_number, latitude, longitude, created_at");

      if (hospitalError) {
        console.warn("[ADMIN] Error fetching hospitals:", hospitalError.message);
      }

      // Fetch ambulances (NO patient/guardian data)
      const { data: ambulancesData, error: ambulanceError } = await supabase
        .from("ambulance_services")
        .select("id, name, contact_number, latitude, longitude, created_at");

      if (ambulanceError) {
        console.warn("[ADMIN] Error fetching ambulances:", ambulanceError.message);
      }

      // Set data even if partially failed
      setHospitals(hospitalsData || []);
      setAmbulances(ambulancesData || []);
      
      console.log("[ADMIN] Data loaded:", {
        hospitals: hospitalsData?.length || 0,
        ambulances: ambulancesData?.length || 0,
      });
    } catch (error: any) {
      console.error("[ADMIN] Exception fetching data:", error?.message || error);
      // Set empty arrays to prevent null crashes
      setHospitals([]);
      setAmbulances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHospital = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const email = formData.get("hospital_email") as string;
    const password = formData.get("hospital_password") as string;
    const name = formData.get("hospital_name") as string;
    const lat = parseFloat(formData.get("hospital_lat") as string);
    const lng = parseFloat(formData.get("hospital_lng") as string);
    const contact = formData.get("hospital_contact") as string;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      toast({
        title: "Error",
        description: authError.message,
        variant: "destructive",
      });
      return;
    }

    const { error: hospitalError } = await supabase.from("hospitals").insert({
      name,
      latitude: lat,
      longitude: lng,
      contact_number: contact,
      user_id: authData.user?.id,
    });

    if (hospitalError) {
      toast({
        title: "Error",
        description: hospitalError.message,
        variant: "destructive",
      });
      return;
    }

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: authData.user?.id,
      role: "hospital",
    });

    if (roleError) {
      toast({
        title: "Error",
        description: roleError.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Hospital added successfully",
    });

    fetchData();
    fetchStats();
    e.currentTarget.reset();
  };

  const handleAddAmbulance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const email = formData.get("ambulance_email") as string;
    const password = formData.get("ambulance_password") as string;
    const name = formData.get("ambulance_name") as string;
    const lat = parseFloat(formData.get("ambulance_lat") as string);
    const lng = parseFloat(formData.get("ambulance_lng") as string);
    const contact = formData.get("ambulance_contact") as string;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      toast({
        title: "Error",
        description: authError.message,
        variant: "destructive",
      });
      return;
    }

    const { error: ambulanceError } = await supabase.from("ambulance_services").insert({
      name,
      latitude: lat,
      longitude: lng,
      contact_number: contact,
      user_id: authData.user?.id,
    });

    if (ambulanceError) {
      toast({
        title: "Error",
        description: ambulanceError.message,
        variant: "destructive",
      });
      return;
    }

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: authData.user?.id,
      role: "ambulance",
    });

    if (roleError) {
      toast({
        title: "Error",
        description: roleError.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Ambulance service added successfully",
    });

    fetchData();
    fetchStats();
    e.currentTarget.reset();
  };

  const handleDelete = async (type: "hospital" | "ambulance", id: string) => {
    const table = type === "hospital" ? "hospitals" : "ambulance_services";
    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `${type} deleted successfully`,
      });
      fetchData();
      fetchStats();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {import.meta.env.VITE_DEV_MODE === "true" && (
        <div className="bg-yellow-400 text-yellow-950 text-center text-sm font-semibold py-2 px-4 border-b border-yellow-600">
          ⚠️ DEV MODE — Admin Authentication Disabled
        </div>
      )}
      <div className="container mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="CareConnect" className="h-10 w-10" />
            <div>
              <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
              <p className="text-slate-400 text-sm">System administration dashboard</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-slate-600 text-slate-300 hover:bg-slate-700">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        {/* Privacy Notice */}
        <Card className="mb-6 bg-amber-900/20 border-amber-500/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-amber-400" />
              <p className="text-amber-200 text-sm">
                <strong>Privacy Notice:</strong> Admin access is restricted to system management only. 
                Patient medical details and guardian contact information are not accessible from this panel.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <BarChart3 className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.totalEmergencies}</p>
              <p className="text-slate-400 text-xs">Total Emergencies</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.activeEmergencies}</p>
              <p className="text-slate-400 text-xs">Active Now</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.resolvedEmergencies}</p>
              <p className="text-slate-400 text-xs">Resolved</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <Hospital className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.totalHospitals}</p>
              <p className="text-slate-400 text-xs">Hospitals</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <Ambulance className="w-8 h-8 text-orange-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.totalAmbulances}</p>
              <p className="text-slate-400 text-xs">Ambulances</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
              <p className="text-slate-400 text-xs">Registered Users</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="emergencies" className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="emergencies" className="data-[state=active]:bg-slate-700">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Emergencies
            </TabsTrigger>
            <TabsTrigger value="hospitals" className="data-[state=active]:bg-slate-700">
              <Hospital className="w-4 h-4 mr-2" />
              Hospitals
            </TabsTrigger>
            <TabsTrigger value="ambulances" className="data-[state=active]:bg-slate-700">
              <Ambulance className="w-4 h-4 mr-2" />
              Ambulances
            </TabsTrigger>
            <TabsTrigger value="add-new" className="data-[state=active]:bg-slate-700">
              <Activity className="w-4 h-4 mr-2" />
              Add New
            </TabsTrigger>
          </TabsList>

          {/* Emergency History Tab */}
          <TabsContent value="emergencies">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  Emergency History
                </CardTitle>
                <CardDescription className="text-slate-400">
                  View emergency events and SMS notification status (patient details hidden for privacy)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEmergencies ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : emergencies.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No emergencies recorded yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-300">Time</TableHead>
                        <TableHead className="text-slate-300">Status</TableHead>
                        <TableHead className="text-slate-300">Location</TableHead>
                        <TableHead className="text-slate-300">SMS Status</TableHead>
                        <TableHead className="text-slate-300">Hospital</TableHead>
                        <TableHead className="text-slate-300">Ambulance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emergencies.map((emergency) => (
                        <TableRow key={emergency.id} className="border-slate-700">
                          <TableCell className="text-slate-300">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span className="text-xs">
                                {new Date(emergency.created_at).toLocaleString()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                emergency.status === "active" ? "destructive" :
                                emergency.status === "resolved" ? "default" :
                                "secondary"
                              }
                              className="text-xs"
                            >
                              {emergency.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-400">
                            {emergency.latitude && emergency.longitude ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                <span className="font-mono text-xs">
                                  {emergency.latitude.toFixed(4)}, {emergency.longitude.toFixed(4)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-3 h-3 text-slate-400" />
                              <SMSStatusBadge
                                status={
                                  emergency.guardian_notified ? "sent" :
                                  emergency.notified_at ? "partial" :
                                  "pending"
                                }
                              />
                            </div>
                            {emergency.notified_at && (
                              <span className="text-xs text-slate-500 block mt-1">
                                {new Date(emergency.notified_at).toLocaleTimeString()}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-400 text-xs">
                            {emergency.accepted_by_hospital ? (
                              <Badge variant="outline" className="text-green-400 border-green-400/30">
                                Accepted
                              </Badge>
                            ) : (
                              <span className="text-slate-500">Pending</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-400 text-xs">
                            {emergency.dispatched_to_ambulance ? (
                              <Badge variant="outline" className="text-orange-400 border-orange-400/30">
                                Dispatched
                              </Badge>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hospitals Tab */}
          <TabsContent value="hospitals">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Hospital className="h-5 w-5" />
                  Registered Hospitals
                </CardTitle>
                <CardDescription className="text-slate-400">
                  View and manage hospital registrations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : hospitals.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No hospitals registered yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-300">Name</TableHead>
                        <TableHead className="text-slate-300">Contact</TableHead>
                        <TableHead className="text-slate-300">Location</TableHead>
                        <TableHead className="text-slate-300">Registered</TableHead>
                        <TableHead className="text-slate-300">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hospitals.map((hospital) => (
                        <TableRow key={hospital.id} className="border-slate-700">
                          <TableCell className="text-white font-medium">{hospital.name}</TableCell>
                          <TableCell className="text-slate-300">{hospital.contact_number}</TableCell>
                          <TableCell className="text-slate-400 font-mono text-xs">
                            {hospital.latitude?.toFixed(4)}, {hospital.longitude?.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-slate-400 text-sm">
                            {hospital.created_at ? new Date(hospital.created_at).toLocaleDateString() : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete("hospital", hospital.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ambulances Tab */}
          <TabsContent value="ambulances">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Ambulance className="h-5 w-5" />
                  Registered Ambulance Services
                </CardTitle>
                <CardDescription className="text-slate-400">
                  View and manage ambulance registrations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : ambulances.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No ambulances registered yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-300">Service Name</TableHead>
                        <TableHead className="text-slate-300">Contact</TableHead>
                        <TableHead className="text-slate-300">Location</TableHead>
                        <TableHead className="text-slate-300">Registered</TableHead>
                        <TableHead className="text-slate-300">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ambulances.map((ambulance) => (
                        <TableRow key={ambulance.id} className="border-slate-700">
                          <TableCell className="text-white font-medium">{ambulance.name}</TableCell>
                          <TableCell className="text-slate-300">{ambulance.contact_number}</TableCell>
                          <TableCell className="text-slate-400 font-mono text-xs">
                            {ambulance.latitude?.toFixed(4)}, {ambulance.longitude?.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-slate-400 text-sm">
                            {ambulance.created_at ? new Date(ambulance.created_at).toLocaleDateString() : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete("ambulance", ambulance.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Add New Tab */}
          <TabsContent value="add-new">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Add Hospital */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Hospital className="h-5 w-5 text-purple-400" />
                    Add Hospital
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddHospital} className="space-y-4">
                    <div>
                      <Label className="text-slate-300">Email</Label>
                      <Input name="hospital_email" type="email" required className="bg-slate-700/50 border-slate-600 text-white" />
                    </div>
                    <div>
                      <Label className="text-slate-300">Password</Label>
                      <Input name="hospital_password" type="password" required className="bg-slate-700/50 border-slate-600 text-white" />
                    </div>
                    <div>
                      <Label className="text-slate-300">Hospital Name</Label>
                      <Input name="hospital_name" required className="bg-slate-700/50 border-slate-600 text-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-slate-300">Latitude</Label>
                        <Input name="hospital_lat" type="number" step="any" required className="bg-slate-700/50 border-slate-600 text-white" />
                      </div>
                      <div>
                        <Label className="text-slate-300">Longitude</Label>
                        <Input name="hospital_lng" type="number" step="any" required className="bg-slate-700/50 border-slate-600 text-white" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-300">Contact Number</Label>
                      <Input name="hospital_contact" required className="bg-slate-700/50 border-slate-600 text-white" />
                    </div>
                    <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">Add Hospital</Button>
                  </form>
                </CardContent>
              </Card>

              {/* Add Ambulance */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Ambulance className="h-5 w-5 text-orange-400" />
                    Add Ambulance Service
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddAmbulance} className="space-y-4">
                    <div>
                      <Label className="text-slate-300">Email</Label>
                      <Input name="ambulance_email" type="email" required className="bg-slate-700/50 border-slate-600 text-white" />
                    </div>
                    <div>
                      <Label className="text-slate-300">Password</Label>
                      <Input name="ambulance_password" type="password" required className="bg-slate-700/50 border-slate-600 text-white" />
                    </div>
                    <div>
                      <Label className="text-slate-300">Service Name</Label>
                      <Input name="ambulance_name" required className="bg-slate-700/50 border-slate-600 text-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-slate-300">Latitude</Label>
                        <Input name="ambulance_lat" type="number" step="any" required className="bg-slate-700/50 border-slate-600 text-white" />
                      </div>
                      <div>
                        <Label className="text-slate-300">Longitude</Label>
                        <Input name="ambulance_lng" type="number" step="any" required className="bg-slate-700/50 border-slate-600 text-white" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-300">Contact Number</Label>
                      <Input name="ambulance_contact" required className="bg-slate-700/50 border-slate-600 text-white" />
                    </div>
                    <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700">Add Ambulance</Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;
