# CareConnect Android Setup Guide

## Prerequisites
- Node.js 18+ 
- Android Studio (latest version)
- JDK 17+
- Git

## Required Android Permissions

The following permissions are configured in `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

## Setup Steps

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd careconnect
npm install
```

### 2. Add Android Platform
```bash
npx cap add android
```

### 3. Build the Web App
```bash
npm run build
```

### 4. Sync to Android
```bash
npx cap sync android
```

### 5. Open in Android Studio
```bash
npx cap open android
```

### 6. Configure Android Permissions

After running `npx cap add android`, the Android project will be created. The required permissions are already configured in `android/app/src/main/AndroidManifest.xml`.

**Required AndroidManifest.xml contents:**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Internet access (required for app) -->
    <uses-permission android:name="android.permission.INTERNET" />
    
    <!-- Network state for connectivity checks -->
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <!-- Location Permissions - CRITICAL for GPS -->
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    
    <!-- GPS hardware feature declaration -->
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />
    <uses-feature android:name="android.hardware.location" android:required="false" />
    
    <!-- Push Notifications (Android 13+) -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    
    <!-- Vibration for alerts -->
    <uses-permission android:name="android.permission.VIBRATE" />
    
    <!-- Wake lock for background tasks -->
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    
    <!-- Foreground service for continuous monitoring -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true"
        android:networkSecurityConfig="@xml/network_security_config">

        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:exported="true"
            android:launchMode="singleTask"
            android:theme="@style/AppTheme.NoActionBarLaunch">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>

    </application>

</manifest>
```

**Important Notes:**
- `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` are required for GPS
- `FOREGROUND_SERVICE_LOCATION` is needed for Android 14+ background location
- `android:usesCleartextTraffic="true"` allows dev server connections

### 7. Run on Device/Emulator
```bash
npx cap run android
```

## Development with Hot Reload

The app is pre-configured for hot reload from the Lovable preview server. When running in development:

1. The app connects to the Lovable preview URL
2. Changes made in Lovable are reflected in real-time on your device
3. No need to rebuild for UI changes

For production builds, update `capacitor.config.ts`:
```typescript
const config: CapacitorConfig = {
  // ... other config
  server: {
    // Remove or comment out the URL for production
    // url: 'https://...',
  }
};
```

## Dependencies Installed

- `@capacitor/core` - Core Capacitor runtime
- `@capacitor/cli` - Capacitor CLI tools
- `@capacitor/android` - Android platform support
- `@capacitor/geolocation` - GPS/Location services
- `@capacitor/push-notifications` - Push notification support

## Automatic Permission Requests

The app automatically requests these permissions on startup (native only):
1. **Location** - For emergency GPS tracking
2. **Notifications** - For emergency alerts

See `src/utils/permissions.ts` and `src/hooks/useAppInitialization.ts` for implementation.

## Troubleshooting

### Location Not Working
1. Ensure location services are enabled on device
2. Check app permissions in Android Settings
3. Try toggling GPS off/on

### Push Notifications Not Working
1. Ensure notification permissions are granted
2. Check if battery optimization is disabled for the app
3. Verify Google Play Services is installed

### Build Errors
1. Run `npx cap sync android` after any npm install
2. Clear Android Studio cache: File → Invalidate Caches
3. Clean and rebuild: Build → Clean Project, then Build → Rebuild Project
