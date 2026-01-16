import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { requestAllPermissions, setupPushNotificationListeners } from '@/utils/permissions';

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
      console.log('[App] Initializing on platform:', Capacitor.getPlatform());
      
      // Only request permissions on native platforms
      if (Capacitor.isNativePlatform()) {
        // Setup push notification listeners first
        setupPushNotificationListeners();
        
        // Request all permissions
        const permissions = await requestAllPermissions();
        
        setState({
          initialized: true,
          permissions,
          platform: Capacitor.getPlatform(),
        });
      } else {
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
