import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, User, Heart, Users, Shield } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-success/5">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center gap-4">
            <User className="w-8 h-8 text-primary" />
            <div>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your profile details</CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center gap-4">
            <Heart className="w-8 h-8 text-emergency" />
            <div>
              <CardTitle>Medical Information</CardTitle>
              <CardDescription>Manage your medical records</CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center gap-4">
            <Users className="w-8 h-8 text-success" />
            <div>
              <CardTitle>Emergency Contacts</CardTitle>
              <CardDescription>Manage your guardians</CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center gap-4">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <CardTitle>Safety Settings</CardTitle>
              <CardDescription>Configure detection sensitivity</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};

export default Settings;