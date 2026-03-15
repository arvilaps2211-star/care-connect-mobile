import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";

type TestStatus = "idle" | "testing" | "success" | "failed";

const NotificationTester = () => {
  const [permissionStatus, setPermissionStatus] = useState<string>("unknown");
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();

  const checkPermission = async () => {
    try {
      if (isNative) {
        const { LocalNotifications } = await import(
          "@capacitor/local-notifications"
        );
        const result = await LocalNotifications.checkPermissions();
        setPermissionStatus(result.display);
      } else {
        // Web Notification API
        if (!("Notification" in window)) {
          setPermissionStatus("not_supported");
        } else {
          setPermissionStatus(Notification.permission);
        }
      }
    } catch (e: any) {
      setPermissionStatus(`error: ${e.message}`);
    }
  };

  const requestPermission = async () => {
    try {
      if (isNative) {
        const { LocalNotifications } = await import(
          "@capacitor/local-notifications"
        );
        const result = await LocalNotifications.requestPermissions();
        setPermissionStatus(result.display);
      } else {
        if ("Notification" in window) {
          const result = await Notification.requestPermission();
          setPermissionStatus(result);
        }
      }
    } catch (e: any) {
      setPermissionStatus(`error: ${e.message}`);
    }
  };

  const sendTestNotification = async () => {
    setTestStatus("testing");
    setErrorMsg(null);

    try {
      if (isNative) {
        const { LocalNotifications } = await import(
          "@capacitor/local-notifications"
        );

        // Ensure permission
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== "granted") {
          const req = await LocalNotifications.requestPermissions();
          if (req.display !== "granted") {
            setTestStatus("failed");
            setErrorMsg("Notification permission denied");
            return;
          }
        }

        await LocalNotifications.schedule({
          notifications: [
            {
              title: "🚨 CareConnect Test",
              body: "If you see this, notifications are working!",
              id: Date.now(),
              schedule: { at: new Date(Date.now() + 1000) },
              sound: undefined,
              actionTypeId: "",
              extra: null,
            },
          ],
        });

        setTestStatus("success");
      } else {
        // Web notification
        if (!("Notification" in window)) {
          setTestStatus("failed");
          setErrorMsg("Web notifications not supported in this browser");
          return;
        }

        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setTestStatus("failed");
          setErrorMsg("Notification permission denied");
          return;
        }

        new Notification("🚨 CareConnect Test", {
          body: "If you see this, notifications are working!",
          icon: "/favicon.ico",
        });

        setTestStatus("success");
      }
    } catch (e: any) {
      setTestStatus("failed");
      setErrorMsg(e?.message ?? "Failed to send notification");
    }
  };

  // Check permission on mount
  useState(() => {
    checkPermission();
  });

  const permGranted = permissionStatus === "granted";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {permGranted ? (
            <Bell className="h-5 w-5 text-primary" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
          Notification Diagnostics
        </CardTitle>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline">{platform}</Badge>
          <Badge
            variant={permGranted ? "default" : "destructive"}
          >
            {permissionStatus === "unknown"
              ? "Checking..."
              : permGranted
                ? "Granted"
                : permissionStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Permission controls */}
        {!permGranted && permissionStatus !== "unknown" && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <BellOff className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Notifications are not enabled.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                {isNative
                  ? "Go to Settings → Apps → CareConnect → Notifications to enable."
                  : "Click the button below to request permission."}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={requestPermission}
          >
            Request Permission
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={checkPermission}
          >
            Refresh Status
          </Button>
        </div>

        {/* Test notification */}
        <Button
          className="w-full"
          onClick={sendTestNotification}
          disabled={testStatus === "testing"}
        >
          {testStatus === "testing" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Bell className="mr-2 h-4 w-4" />
              Send Test Notification
            </>
          )}
        </Button>

        {/* Result */}
        {testStatus === "success" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Notification sent! Check your notification tray.
            </p>
          </div>
        )}

        {testStatus === "failed" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <XCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">
              {errorMsg ?? "Notification failed"}
            </p>
          </div>
        )}

        {/* Info */}
        <p className="text-xs text-muted-foreground">
          {isNative
            ? "Uses Capacitor Local Notifications. For Android 13+, POST_NOTIFICATIONS permission is required."
            : "Uses browser Web Notification API. Some browsers may block notifications."}
        </p>
      </CardContent>
    </Card>
  );
};

export default NotificationTester;
