# CareConnect Mobile App Setup Guide

CareConnect is now configured as a **native mobile application** using Capacitor. Follow these steps to run it on iOS or Android devices.

## Prerequisites

- Node.js installed
- Git installed
- **For iOS**: Mac with Xcode installed
- **For Android**: Android Studio installed

## Setup Steps

### 1. Transfer Project to GitHub

1. Click the **"Export to Github"** button in Lovable
2. Clone the project from your GitHub repository:
   ```bash
   git clone <your-repo-url>
   cd <project-folder>
   ```

### 2. Install Dependencies

```bash
npm install
```

### 3. Add Mobile Platforms

**For iOS:**
```bash
npx cap add ios
npx cap update ios
```

**For Android:**
```bash
npx cap add android
npx cap update android
```

### 4. Build the Project

```bash
npm run build
```

### 5. Sync with Native Projects

```bash
npx cap sync
```

> **Note:** Run `npx cap sync` every time you pull new changes from GitHub

### 6. Run on Device/Emulator

**For iOS (Mac only):**
```bash
npx cap run ios
```
This will open Xcode. Select your device/simulator and click Run.

**For Android:**
```bash
npx cap run android
```
This will open Android Studio. Select your device/emulator and click Run.

## Features

✅ **Accident Detection** - Uses device accelerometer to detect abnormal movement
✅ **Emergency Alerts** - Manual and automatic emergency triggers
✅ **SMS Notifications** - Notifies guardians via SMS (requires Twilio setup)
✅ **Location Tracking** - Native geolocation for accurate emergency location
✅ **Hospital Dashboard** - View and accept emergency requests
✅ **Ambulance Dashboard** - Coordinate emergency response
✅ **Admin Panel** - Manage hospitals and ambulances

## Required Permissions

The app requires the following device permissions:
- **Location** - For emergency location tracking
- **Motion Sensors** - For accident detection

These permissions are requested automatically when needed.

## Twilio SMS Setup (Optional)

To enable SMS notifications to guardians:

1. Go to Lovable project settings
2. Navigate to Backend → Secrets
3. Add the following secrets:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

## Development Mode

For faster development, the app is configured to connect to the Lovable sandbox:
- Hot reload is enabled
- Changes in Lovable are reflected immediately in the app
- No need to rebuild for UI/logic changes

## Production Deployment

To deploy to App Store or Play Store:

1. Remove the hot-reload server URL from `capacitor.config.ts`:
   ```typescript
   // Remove the server section for production
   server: {
     url: 'https://...',
     cleartext: true
   }
   ```

2. Build the production version:
   ```bash
   npm run build
   npx cap sync
   ```

3. Follow platform-specific deployment guides:
   - [iOS App Store](https://capacitorjs.com/docs/ios/deploying-to-app-store)
   - [Google Play Store](https://capacitorjs.com/docs/android/deploying-to-google-play)

## Troubleshooting

**Location not working?**
- Make sure location permissions are granted
- Check that location services are enabled on the device

**Build errors?**
- Run `npm install` again
- Clear build cache: `npx cap sync --force`
- For iOS: Clean build in Xcode (Shift+Cmd+K)
- For Android: Invalidate caches in Android Studio

**Hot reload not working?**
- Make sure both your computer and device are on the same network
- Check the URL in `capacitor.config.ts` is correct

## Support

For more information about Capacitor:
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Lovable Mobile Development Guide](https://docs.lovable.dev)

---

**Important:** This app is designed exclusively for mobile devices. Some features may not work properly in a web browser.
