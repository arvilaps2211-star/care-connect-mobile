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
  Wifi,
  WifiOff,
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
  httpStatus?: number;
  rawResponse?: string;
}

interface TwilioHealthResult {
  status: "untested" | "testing" | "ok" | "error";
  message?: string;
  accountSid?: string;
  fromNumber?: string;
}

const SMSDiagnostic = () => {
  const [guardians, setGuardians] = useState<GuardianEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [twilioHealth, setTwilioHealth] = useState<TwilioHealthResult>({
    status: "untested",
  });
  const [lastRawResponse, setLastRawResponse] = useState<string | null>(null);

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
      rawResponse: undefined,
    });

    try {
      const loc = await getCurrentPosition().catch(() => ({
        latitude: 13.056602,
        longitude: 80.179375,
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

      // Store raw response for debugging
      const rawStr = JSON.stringify(data ?? error, null, 2);
      setLastRawResponse(rawStr);

      if (error) {
        throw new Error(error.message);
      }

      const result = data?.results?.[0];
      if (result?.success) {
        updateGuardian(guardian.id, {
          status: "sent",
          sid: result.sid,
          twilioStatus: result.twilioStatus,
          httpStatus: result.status,
          rawResponse: rawStr,
        });
      } else {
        const errCode = result?.errorCode;
        const errMsg =
          result?.errorMessage ?? result?.error ?? "Delivery failed";

        // Don't retry Twilio trial errors (21608)
        if (
          retryAttempt < 2 &&
          errCode !== "21608" &&
          errCode !== 21608
        ) {
          await new Promise((r) => setTimeout(r, 1500));
          return sendToGuardian(guardian, retryAttempt + 1);
        }

        updateGuardian(guardian.id, {
          status: "failed",
          errorCode: String(errCode ?? ""),
          errorMessage: errMsg,
          httpStatus: result?.status ?? result?.httpStatus,
          rawResponse: rawStr,
        });
      }
    } catch (e: any) {
      const rawStr = JSON.stringify({ error: e?.message }, null, 2);
      setLastRawResponse(rawStr);

      if (retryAttempt < 2) {
        await new Promise((r) => setTimeout(r, 1500));
        return sendToGuardian(guardian, retryAttempt + 1);
      }
      updateGuardian(guardian.id, {
        status: "failed",
        errorMessage: e?.message ?? "Unknown error",
        rawResponse: rawStr,
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

  const testTwilioConnection = async () => {
    setTwilioHealth({ status: "testing" });
    try {
      // Send to a known number with a minimal payload to verify Twilio works
      const { data, error } = await supabase.functions.invoke(
        "send-test-sms",
        {
          body: {
            guardianPhones: ["+15005550006"], // Twilio test number
            location: { latitude: 13.056602, longitude: 80.179375 },
          },
        }
      );

      if (error) {
        setTwilioHealth({
          status: "error",
          message: `Edge function error: ${error.message}`,
        });
        return;
      }

      const result = data?.results?.[0];
      if (result?.success) {
        setTwilioHealth({
          status: "ok",
          message: `Connected! SID: ${result.sid?.slice(-8)}`,
        });
      } else if (result?.errorCode === "21608" || result?.errorCode === 21608) {
        // 21608 means Twilio accepted the request but the number isn't verified
        // This confirms Twilio credentials ARE working (trial account)
        setTwilioHealth({
          status: "ok",
          message:
            "Twilio connected (trial account). Only verified numbers receive SMS.",
        });
      } else {
        setTwilioHealth({
          status: "error",
          message: `Twilio error [${result?.errorCode}]: ${result?.errorMessage}`,
        });
      }
    } catch (e: any) {
      setTwilioHealth({
        status: "error",
        message: e?.message ?? "Connection failed",
      });
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
        <div className="flex gap-2 flex-wrap text-sm text-muted-foreground">
          <Badge variant="outline">{guardians.length} guardians</Badge>
          {sentCount > 0 && (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
              {sentCount} sent
            </Badge>
          )}
          {failedCount > 0 && (
            <Badge variant="destructive">{failedCount} failed</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Twilio Health Check */}
        <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              {twilioHealth.status === "ok" ? (
                <Wifi className="h-4 w-4 text-emerald-500" />
              ) : twilioHealth.status === "error" ? (
                <WifiOff className="h-4 w-4 text-destructive" />
              ) : (
                <Wifi className="h-4 w-4 text-muted-foreground" />
              )}
              Twilio Connection
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={testTwilioConnection}
              disabled={twilioHealth.status === "testing"}
            >
              {twilioHealth.status === "testing" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Test"
              )}
            </Button>
          </div>
          {twilioHealth.message && (
            <p
              className={`text-xs ${
                twilioHealth.status === "ok"
                  ? "text-emerald-600"
                  : "text-destructive"
              }`}
            >
              {twilioHealth.message}
            </p>
          )}
        </div>

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
                    ✓ SID: {g.sid.slice(-8)} · Status: {g.twilioStatus} · HTTP {g.httpStatus}
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
                  g.status === "sending" ||
                  g.status === "retrying" ||
                  isSendingAll
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
                On a trial account, SMS can only be sent to numbers you've
                verified. All 3 guardian numbers must be verified individually.
              </p>
              <a
                href="https://www.twilio.com/console/phone-numbers/verified"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary mt-1 underline"
              >
                Verify Numbers on Twilio <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {/* Important trial account notice - always show */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <AlertTriangle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
              Twilio Trial Account Reminder
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              If you're on a Twilio trial, each guardian's phone number must be
              individually verified at{" "}
              <a
                href="https://www.twilio.com/console/phone-numbers/verified"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                twilio.com/console/phone-numbers/verified
              </a>
              . SMS will show as "queued" but won't be delivered to unverified
              numbers.
            </p>
          </div>
        </div>

        {/* Raw API response (debug) */}
        {lastRawResponse && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Last API Response (raw)
            </summary>
            <pre className="mt-2 p-2 rounded bg-muted/50 overflow-x-auto text-[10px] font-mono whitespace-pre-wrap">
              {lastRawResponse}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
};

export default SMSDiagnostic;
