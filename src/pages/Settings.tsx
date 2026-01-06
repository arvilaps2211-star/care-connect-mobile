import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentPosition } from "@/utils/geolocation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, User, Heart, Users, Shield, Loader2, MessageSquare } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [testPhone, setTestPhone] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  const canSend = useMemo(() => testPhone.trim().length > 0 && !isSendingTest, [testPhone, isSendingTest]);

  const handleSendTestSms = async () => {
    setIsSendingTest(true);
    try {
      const location = await getCurrentPosition();

      const { data, error } = await supabase.functions.invoke("send-test-sms", {
        body: {
          toPhone: testPhone.trim(),
          location,
        },
      });

      if (error) throw error;

      toast({
        title: "Test SMS sent",
        description: `Sent to ${data?.to ?? testPhone.trim()}. Check your phone now.`,
      });
    } catch (e: any) {
      toast({
        title: "Test SMS failed",
        description: e?.message ?? "Unable to send test SMS",
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-success/5">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <MessageSquare className="w-8 h-8 text-primary" />
            <div>
              <CardTitle>Test SMS</CardTitle>
              <CardDescription>Send a test message to verify SMS delivery</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="testPhone">Your phone number</Label>
              <Input
                id="testPhone"
                type="tel"
                placeholder="+91 98765 43210"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleSendTestSms} disabled={!canSend}>
              {isSendingTest ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Test SMS"
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              We’ll include your current location (maps link) in the test message.
            </p>
          </CardContent>
        </Card>

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
