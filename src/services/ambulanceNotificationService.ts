import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { supabase } from "@/integrations/supabase/client";

/**
 * Initialize push notifications for the ambulance app.
 * Registers device token with the database and listens for incoming notifications.
 */
export async function initAmbulancePushNotifications(options: {
  ambulanceId: string;
  onNewEmergency?: (emergencyId: string) => void;
}): Promise<() => void> {
  const { ambulanceId, onNewEmergency } = options;

  if (!Capacitor.isNativePlatform()) {
    console.log("[AmbulanceNotif] Web platform - using browser notifications only");
    return () => {};
  }

  try {
    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== "granted") {
      console.warn("[AmbulanceNotif] Push notification permission denied");
      return () => {};
    }

    // Register for push
    await PushNotifications.register();

    // Listen for registration
    const regListener = await PushNotifications.addListener("registration", async (token) => {
      console.log("[AmbulanceNotif] Token received:", token.value.slice(0, 20) + "...");

      // Store token in fcm_tokens table
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      if (userId) {
        const { error } = await supabase.from("fcm_tokens").upsert(
          {
            user_id: userId,
            token: token.value,
            device_type: Capacitor.getPlatform(),
          },
          { onConflict: "user_id" }
        );

        if (error) {
          console.error("[AmbulanceNotif] Failed to store token:", error.message);
        } else {
          console.log("[AmbulanceNotif] Token stored successfully");
        }
      }
    });

    // Listen for registration errors
    const errListener = await PushNotifications.addListener("registrationError", (error) => {
      console.error("[AmbulanceNotif] Registration error:", error);
    });

    // Listen for received notifications (foreground)
    const recvListener = await PushNotifications.addListener(
      "pushNotificationReceived",
      async (notification) => {
        console.log("[AmbulanceNotif] Received:", notification.title);

        // Show local notification since push notifications in foreground may not display
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now(),
              title: notification.title || "🚨 Emergency Alert",
              body: notification.body || "New emergency case dispatched",
              sound: "default",
              smallIcon: "ic_notification",
              channelId: "emergency_alerts",
              extra: notification.data,
            },
          ],
        });

        if (notification.data?.emergencyId) {
          onNewEmergency?.(notification.data.emergencyId);
        }
      }
    );

    // Listen for notification taps
    const actionListener = await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action) => {
        console.log("[AmbulanceNotif] Action:", action.actionId);
        if (action.notification.data?.emergencyId) {
          onNewEmergency?.(action.notification.data.emergencyId);
        }
      }
    );

    // Create notification channel for Android
    try {
      await LocalNotifications.createChannel({
        id: "emergency_alerts",
        name: "Emergency Alerts",
        description: "Notifications for new emergency dispatches",
        importance: 5,
        visibility: 1,
        vibration: true,
        sound: "default",
      });
    } catch {
      // Channel creation may fail on non-Android
    }

    // Return cleanup function
    return () => {
      regListener.remove();
      errListener.remove();
      recvListener.remove();
      actionListener.remove();
    };
  } catch (err: any) {
    console.error("[AmbulanceNotif] Init failed:", err.message);
    return () => {};
  }
}

/**
 * Request browser notification permission (web fallback)
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * Show a browser notification (web fallback)
 */
export function showBrowserNotification(title: string, body: string): void {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "ambulance-emergency",
      requireInteraction: true,
    });
  }
}
