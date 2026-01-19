import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.08e4337778ca4863a93afaf89a5c083e',
  appName: 'CareConnect',
  webDir: 'dist',
  server: {
    url: 'https://08e43377-78ca-4863-a93a-faf89a5c083e.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#3b82f6',
      showSpinner: false
    },
    // Geolocation plugin configuration
    Geolocation: {
      // Request high accuracy by default
      enableHighAccuracy: true
    }
  },
  // Android-specific configuration
  android: {
    // Allow mixed content for dev server
    allowMixedContent: true,
    // Capture all navigation
    webContentsDebuggingEnabled: true
  }
};

export default config;
