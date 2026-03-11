import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentPosition } from "@/utils/geolocation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Send,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

type GuardianStatus = "idle" | "sending" | "sent" | "failed" | "retrying";

interface GuardianEntry {
  id: string;
  name: string;
  phone: string;
  status: GuardianStatus;
  sid?: string;
  twilioStatus?: string;
  errorCode?: string;
  errorMessage?: string;
}

const SMSDiagnostic = () => {
  const [guardians, setGuardians] = useState<GuardianEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSendingAll, setIsSendingAll] = useState(false);

  useEffect(() => {
    loadGuardians();
  }, []);

  const loadGuardians = async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("guardians")
      .select("id, name, contact_number, relationship")
      .eq("user_id", session.user.id);

    setGuardians(
      (data ?? []).map((g) => ({
        id: g.id,
        name: `${g.name} (${g.relationship})`,
        phone: g.contact_number,
        status: "idle" as GuardianStatus,
      }))
    );
    setLoading(false);
  };

  const updateGuardian = (id: string, patch: Partial<GuardianEntry>) => {
    setGuardians((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...patch } : g))
    );
  };

  const sendToGuardian = async (guardian: GuardianEntry, retryAttempt = 0) => {
    updateGuardian(guardian.id, {
      status: retryAttempt > 0 ? "retrying" : "sending",
      errorMessage: undefined,
      errorCode: undefined,
    });

    try {
      const loc = await getCurrentPosition().catch(() => ({
        latitude: 0,
        longitude: 0,
      }));

      const { data, error } = await supabase.functions.invoke(
        "send-test-sms",
        {
          body: {
            guardianPhones: [guardian.phone],
            location: loc,
          },
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const result = data?.results?.[0];
      if (result?.success) {
        updateGuardian(guardian.id, {
          status: "sent",
          sid: result.sid,
          twilioStatus: result.twilioStatus,
        });
      } else {
        const errCode = result?.errorCode;
        const errMsg = result?.errorMessage ?? result?.error ?? "Delivery failed";

        // Retry once if not a Twilio trial error
        if (retryAttempt < 2 && errCode !== "21608" && errCode !== 21608) {
          await new Promise((r) => setTimeout(r, 1500));
          return sendToGuardian(guardian, retryAttempt + 1);
        }

        updateGuardian(guardian.id, {
          status: "failed",
          errorCode: String(errCode ?? ""),
          errorMessage: errMsg,
        });
      }
    } catch (e: any) {
      if (retryAttempt < 2) {
        await new Promise((r) => setTimeout(r, 1500));
        return sendToGuardian(guardian, retryAttempt + 1);
      }
      updateGuardian(guardian.id, {
        status: "failed",
        errorMessage: e?.message ?? "Unknown error",
      });
    }
  };

  const sendToAll = async () => {
    setIsSendingAll(true);
    for (let i = 0; i < guardians.length; i++) {
      await sendToGuardian(guardians[i]);
      if (i < guardians.length - 1) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    setIsSendingAll(false);
  };

  const retryFailed = async () => {
    const failed = guardians.filter((g) => g.status === "failed");
    for (let i = 0; i < failed.length; i++) {
      await sendToGuardian(failed[i]);
      if (i < failed.length - 1) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  };

  const sentCount = guardians.filter((g) => g.status === "sent").length;
  const failedCount = guardians.filter((g) => g.status === "failed").length;
  const hasTwilioTrialError = guardians.some(
    (g) => g.errorCode === "21608"
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          SMS Diagnostic Panel
        </CardTitle>
        <div className="flex gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{guardians.length} guardians</Badge>
          {sentCount > 0 && (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
              {sentCount} sent
            </Badge>
          )}
          {failedCount > 0 && (
            <Badge variant="destructive">
              {failedCount} failed
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            onClick={sendToAll}
            disabled={isSendingAll || guardians.length === 0}
            className="flex-1"
          >
            {isSendingAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Test All ({guardians.length})
              </>
            )}
          </Button>
          {failedCount > 0 && (
            <Button variant="outline" onClick={retryFailed}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Failed
            </Button>
          )}
        </div>

        {/* Guardian list */}
        <div className="space-y-2">
          {guardians.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              {/* Status icon */}
              <div className="shrink-0">
                {g.status === "sent" && (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                )}
                {g.status === "failed" && (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                {(g.status === "sending" || g.status === "retrying") && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                {g.status === "idle" && (
                  <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{g.name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {g.phone}
                </p>
                {g.status === "sent" && g.sid && (
                  <p className="text-xs text-emerald-600">
                    SID: {g.sid.slice(-8)} · {g.twilioStatus}
                  </p>
                )}
                {g.status === "failed" && g.errorMessage && (
                  <p className="text-xs text-destructive mt-0.5">
                    {g.errorCode && `[${g.errorCode}] `}
                    {g.errorMessage}
                  </p>
                )}
                {g.status === "retrying" && (
                  <p className="text-xs text-amber-600">Retrying...</p>
                )}
              </div>

              {/* Individual test button */}
              <Button
                size="sm"
                variant="ghost"
                disabled={
                  g.status === "sending" || g.status === "retrying" || isSendingAll
                }
                onClick={() => sendToGuardian(g)}
              >
                Test
              </Button>
            </div>
          ))}
        </div>

        {guardians.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No guardians configured. Add emergency contacts first.
          </p>
        )}

        {/* Twilio trial warning */}
        {hasTwilioTrialError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Twilio Trial Account Detected
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                All recipient numbers must be verified on your Twilio account.
              </p>
              <a
                href="https://www.twilio.com/console/phone-numbers/verified"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary mt-1 underline"
              >
                Verify Numbers <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SMSDiagnostic;
