import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.careconnect.user',
  appName: 'CareConnect',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#3b82f6',
      showSpinner: false,
    },
    Geolocation: {
      enableHighAccuracy: true,
    },
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
