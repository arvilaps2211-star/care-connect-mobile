import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Hospital, Ambulance, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const AdminPanel = () => {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchData();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roles || roles.role !== "admin") {
      navigate("/");
      return;
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const [hospitalsRes, ambulancesRes] = await Promise.all([
      supabase.from("hospitals").select("*"),
      supabase.from("ambulance_services").select("*"),
    ]);

    if (hospitalsRes.data) setHospitals(hospitalsRes.data);
    if (ambulancesRes.data) setAmbulances(ambulancesRes.data);
    setLoading(false);
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
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-foreground">Admin Panel</h1>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Add Hospital */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hospital className="h-5 w-5" />
                Add Hospital
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddHospital} className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input name="hospital_email" type="email" required />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input name="hospital_password" type="password" required />
                </div>
                <div>
                  <Label>Hospital Name</Label>
                  <Input name="hospital_name" required />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Latitude</Label>
                    <Input name="hospital_lat" type="number" step="any" required />
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <Input name="hospital_lng" type="number" step="any" required />
                  </div>
                </div>
                <div>
                  <Label>Contact Number</Label>
                  <Input name="hospital_contact" required />
                </div>
                <Button type="submit" className="w-full">Add Hospital</Button>
              </form>
            </CardContent>
          </Card>

          {/* Add Ambulance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ambulance className="h-5 w-5" />
                Add Ambulance Service
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddAmbulance} className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input name="ambulance_email" type="email" required />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input name="ambulance_password" type="password" required />
                </div>
                <div>
                  <Label>Service Name</Label>
                  <Input name="ambulance_name" required />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Latitude</Label>
                    <Input name="ambulance_lat" type="number" step="any" required />
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <Input name="ambulance_lng" type="number" step="any" required />
                  </div>
                </div>
                <div>
                  <Label>Contact Number</Label>
                  <Input name="ambulance_contact" required />
                </div>
                <Button type="submit" className="w-full">Add Ambulance</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Hospitals List */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Hospitals</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hospitals.map((hospital) => (
                  <TableRow key={hospital.id}>
                    <TableCell>{hospital.name}</TableCell>
                    <TableCell>{hospital.contact_number}</TableCell>
                    <TableCell>{hospital.latitude}, {hospital.longitude}</TableCell>
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
          </CardContent>
        </Card>

        {/* Ambulances List */}
        <Card>
          <CardHeader>
            <CardTitle>Ambulance Services</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ambulances.map((ambulance) => (
                  <TableRow key={ambulance.id}>
                    <TableCell>{ambulance.name}</TableCell>
                    <TableCell>{ambulance.contact_number}</TableCell>
                    <TableCell>{ambulance.latitude}, {ambulance.longitude}</TableCell>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPanel;
