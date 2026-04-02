import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.careconnect.ambulance',
  appName: 'Ambulance Driver',
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
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
