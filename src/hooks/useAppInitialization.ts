import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { requestAllPermissions, setupPushNotificationListeners } from '@/utils/permissions';
import { createEmergencyChannel, initializeBackgroundNotifications } from '@/utils/backgroundNotification';
import { platformDiag, backgroundDiag } from '@/utils/safetyDiagnostics';

interface AppInitState {
  initialized: boolean;
  permissions: {
    location: boolean;
    notifications: boolean;
  } | null;
  platform: string;
}

/**
 * Hook to initialize the app and request permissions on native platforms
 */
export const useAppInitialization = () => {
  const [state, setState] = useState<AppInitState>({
    initialized: false,
    permissions: null,
    platform: Capacitor.getPlatform(),
  });

  useEffect(() => {
    const initializeApp = async () => {
      const platform = Capacitor.getPlatform();
      platformDiag.detected(platform);
      
      // Only request permissions on native platforms
      if (Capacitor.isNativePlatform()) {
        platformDiag.nativeGuardActive();
        
        // Setup push notification listeners first
        setupPushNotificationListeners();
        
        // Create emergency notification channel (Android)
        await createEmergencyChannel();
        
        // Request all permissions
        const permissions = await requestAllPermissions();
        
        // Initialize background notification handlers
        // Note: Actual callbacks are registered in the SOS context
        backgroundDiag.active();
        
        setState({
          initialized: true,
          permissions,
          platform,
        });
      } else {
        platformDiag.webGuardActive();
        
        // Web platform - no need to request permissions upfront
        setState({
          initialized: true,
          permissions: { location: true, notifications: true },
          platform: 'web',
        });
      }
    };

    initializeApp();
  }, []);

  return state;
};

export default useAppInitialization;
