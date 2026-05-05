import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Activity, Bell, MessageSquare, Phone, Wifi } from "lucide-react";

type Status = "ok" | "warn" | "err" | "pending";
const dot = (s: Status) =>
  s === "ok" ? "bg-emerald-500" : s === "warn" ? "bg-yellow-500" : s === "err" ? "bg-red-500" : "bg-slate-500";

const Debug = () => {
  const { toast } = useToast();
  const [twilio, setTwilio] = useState<Status>("pending");
  const [twilioMsg, setTwilioMsg] = useState("checking…");
  const [fcm, setFcm] = useState<Status>("pending");
  const [fcmMsg, setFcmMsg] = useState("checking…");
  const [realtime, setRealtime] = useState<Status>("pending");
  const [realtimeMsg, setRealtimeMsg] = useState("connecting…");
  const [lastSms, setLastSms] = useState<any>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    // Last SMS attempt
    try {
      const raw = localStorage.getItem("careconnect_last_sms_attempt");
      if (raw) setLastSms(JSON.parse(raw));
    } catch {}

    // FCM token check
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setFcm("warn");
        setFcmMsg("not signed in – cannot check");
      } else {
        const { data, error } = await supabase
          .from("fcm_tokens")
          .select("token, device_type")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (error) { setFcm("err"); setFcmMsg(error.message); }
        else if (data?.token) { setFcm("ok"); setFcmMsg(`registered (${data.device_type})`); }
        else { setFcm("warn"); setFcmMsg("no token registered"); }
      }
    })();

    // Realtime check
    const ch = supabase
      .channel("debug_realtime")
      .subscribe((status) => {
        console.log("[Debug] realtime:", status);
        if (status === "SUBSCRIBED") { setRealtime("ok"); setRealtimeMsg("connected"); }
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtime("err"); setRealtimeMsg(status.toLowerCase());
        }
      });

    // Twilio check (probe edge function presence – credentials live in secrets)
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("send-test-sms", {
          body: { ping: true, guardianPhones: [], location: { latitude: 0, longitude: 0 } },
        });
        if (error) { setTwilio("err"); setTwilioMsg(error.message); }
        else if (data?.error?.toString()?.toLowerCase()?.includes("not configured")) {
          setTwilio("err"); setTwilioMsg("Twilio not configured");
        } else { setTwilio("ok"); setTwilioMsg("edge function reachable"); }
      } catch (e: any) {
        setTwilio("err"); setTwilioMsg(e?.message || "unreachable");
      }
    })();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const testPush = async () => {
    setPushBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          title: "🚨 Test Push",
          body: "CareConnect debug test push",
          userIds: session?.user ? [session.user.id] : undefined,
        },
      });
      if (error) throw error;
      toast({ title: "Push test", description: JSON.stringify(data).slice(0, 200) });
    } catch (e: any) {
      toast({ title: "Push failed", description: e?.message, variant: "destructive" });
    } finally { setPushBusy(false); }
  };

  const Row = ({ icon: Icon, label, status, msg }: any) => (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
      <div className="flex items-center gap-3"><Icon className="w-4 h-4 text-slate-300" /><span className="text-slate-200">{label}</span></div>
      <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${dot(status)}`} /><span className="text-xs text-slate-400">{msg}</span></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-white">CareConnect Diagnostics</h1>
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader><CardTitle className="text-white text-base">Live status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Row icon={Phone} label="Twilio (SMS)" status={twilio} msg={twilioMsg} />
            <Row icon={Bell} label="FCM token" status={fcm} msg={fcmMsg} />
            <Row icon={Wifi} label="Realtime" status={realtime} msg={realtimeMsg} />
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader><CardTitle className="text-white text-base flex items-center gap-2"><MessageSquare className="w-4 h-4" />Last SMS attempt</CardTitle></CardHeader>
          <CardContent>
            {lastSms ? (
              <pre className="text-xs text-slate-300 whitespace-pre-wrap break-all bg-slate-900/60 p-3 rounded">{JSON.stringify(lastSms, null, 2)}</pre>
            ) : <p className="text-slate-400 text-sm">No SMS attempts recorded yet.</p>}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader><CardTitle className="text-white text-base flex items-center gap-2"><Activity className="w-4 h-4" />Test push</CardTitle></CardHeader>
          <CardContent>
            <Button onClick={testPush} disabled={pushBusy} className="bg-blue-600 hover:bg-blue-700 text-white">
              {pushBusy ? "Sending…" : "Send test push to me"}
            </Button>
            <p className="text-xs text-slate-400 mt-2">Requires FCM_SERVER_KEY to actually deliver. Without it the edge function logs only.</p>
          </CardContent>
        </Card>

        <div className="text-center"><Badge variant="outline" className="text-slate-400 border-slate-600">/debug</Badge></div>
      </div>
    </div>
  );
};

export default Debug;