import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.careconnect.ambulance',
  appName: 'CareConnect Ambulance',
  webDir: 'dist-ambulance',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#dc2626',
      showSpinner: false,
    },
    Geolocation: {
      enableHighAccuracy: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_notification",
      iconColor: "#dc2626",
    },
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
