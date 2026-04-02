/**
 * Notifications Feature Module
 * Re-exports all notification-related utils and components
 */

export {
  initializeBackgroundNotifications,
  showEmergencyNotification,
  cancelEmergencyNotifications,
  createEmergencyChannel,
  checkNotificationStatus,
} from "@/utils/backgroundNotification";
export type { NotificationAction } from "@/utils/backgroundNotification";

export {
  requestNotificationPermission,
  setupPushNotificationListeners,
} from "@/utils/permissions";
