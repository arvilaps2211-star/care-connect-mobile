# CareConnect Android — Complete Setup & Fix Guide

## Prerequisites
- Node.js 18+ LTS
- Android Studio with JDK 17 (jbr-17)
- Android SDK 34 installed

---

## STEP 1 — Clean Build & Sync

```bash
# From project root
rm -rf node_modules dist
npm install
npm run build
```

## STEP 2 — Add Android Platform (if not done)

```bash
npx cap add android
```

## STEP 3 — Copy Native Config Files

After `npx cap add android` generates the `android/` folder, copy these reference files:

```bash
# AndroidManifest.xml (permissions, single-activity, notch support)
cp android-native-files/AndroidManifest.xml android/app/src/main/AndroidManifest.xml

# styles.xml (notch/cutout, status bar color)
cp android-native-files/res/values/styles.xml android/app/src/main/res/values/styles.xml

# file_paths.xml (camera/gallery file provider)
mkdir -p android/app/src/main/res/xml
cp android-native-files/res/xml/file_paths.xml android/app/src/main/res/xml/file_paths.xml

# network_security_config.xml (cleartext for dev)
cp android-native-files/res/xml/network_security_config.xml android/app/src/main/res/xml/network_security_config.xml
```

## STEP 4 — Edit build.gradle

Open `android/app/build.gradle` and ensure:

```gradle
android {
    compileSdk 34

    defaultConfig {
        applicationId "app.lovable.careconnect"
        minSdk 23
        targetSdk 34          // ← Fixes "Unsafe app blocked"
        versionCode 1
        versionName "1.0"
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}
```

## STEP 5 — Sync Capacitor

```bash
npx cap sync android
```

## STEP 6 — Open in Android Studio

```bash
npx cap open android
```

Then in Android Studio:
1. Set **Gradle JDK** → **jbr-17** (File → Settings → Build → Gradle)
2. File → **Sync Project with Gradle Files**
3. Build → **Clean Project**
4. Build → **Rebuild Project**

---

## Issue-by-Issue Fix Summary

### ✅ 1. "Unsafe app blocked" (Play Protect)
**Cause:** `targetSdk` was < 33.
**Fix:** Set `targetSdk 34` in `android/app/build.gradle`.

### ✅ 2. Two app icons
**Cause:** Multiple activities with `LAUNCHER` intent.
**Fix:** Updated `AndroidManifest.xml` has exactly ONE `<activity>` with `LAUNCHER` + `singleTask`.

### ✅ 3. Photo capture / gallery fails
**Cause:** Missing `READ_MEDIA_IMAGES` permission (Android 13+).
**Fix:** `AndroidManifest.xml` now includes `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `CAMERA`, and legacy storage permissions with `maxSdkVersion` guards.

### ✅ 4. SMS partial delivery (1 of 3 sent)
**Cause:** Twilio rate limiting + trial account unverified numbers.
**Fix:** Edge function already includes:
- 800ms delay between recipients
- 1 retry per failed number (1.5s delay)
- Twilio error 21608 detection (unverified number on trial)

**Important:** On a Twilio trial account, ALL recipient numbers must be verified at https://twilio.com/console/phone-numbers/verified. Unverified numbers will always fail — this is a Twilio restriction, not a code bug.

### ✅ 5. Notch/cutout white background
**Cause:** WebView default white behind safe-area padding.
**Fix:**
- `html` element now has primary blue background that fills behind the notch
- `body` element has the app background with safe-area padding
- Android `styles.xml` sets `windowLayoutInDisplayCutoutMode: shortEdges`
- `windowBackground` set to `#3b82f6` (primary blue)

---

## Ambulance Services

The ambulance driver dashboard is already built at route `/ambulance/driver?id={ambulanceId}`.

**To access it:**
1. A hospital admin registers an ambulance via the Hospital Dashboard
2. The ambulance driver navigates to the URL with their ambulance ID
3. They log in with hospital-assigned credentials (role: `ambulance`)

**To test locally (web):**
```bash
npm run dev
# Navigate to: http://localhost:8080/ambulance/driver?id=<ambulance-uuid>
```

**For a standalone mobile app:** The same Capacitor project can be configured with a different entry route. However, the current architecture shares the same APK — the driver accesses their dashboard via the web URL or a deep link.

---

## Admin & Hospital Dashboards

```bash
npm run dev
# Hospital login:  http://localhost:8080/hospital/login
# Admin panel:     http://localhost:8080/admin
# Ambulance:       http://localhost:8080/ambulance/driver?id=<id>
```

These are web-only dashboards that run in desktop browsers. They are NOT part of the mobile APK.

---

## Verification Checklist

| # | Check | How to verify |
|---|-------|---------------|
| 1 | Single app icon | Install APK → check app drawer |
| 2 | No Play Protect warning | Install APK → should not show "unsafe" |
| 3 | Location works | Open app → Dashboard → GPS indicator shows coordinates |
| 4 | Camera works | Settings → Profile Photo → Take Photo |
| 5 | Gallery works | Settings → Profile Photo → Choose from Gallery |
| 6 | SMS sends to all 3 | Settings → Test SMS → check all 3 show ✓ |
| 7 | Notch filled | Check status bar area shows blue, not white |
| 8 | Notifications work | Trigger SOS → check notification appears |

---

## Troubleshooting

**Permissions still missing after manifest update:**
- Run `npx cap sync android` again
- In Android Studio: Build → Clean → Rebuild
- Uninstall old APK from device before installing new one

**SMS still fails (1 of 3):**
- Check Twilio console: all 3 numbers must be verified on trial accounts
- Check edge function logs for error code 21608

**Notch still white:**
- Ensure you copied `styles.xml` to `android/app/src/main/res/values/`
- Rebuild the APK (old cached version may still be on device)

**Build fails with Java errors:**
- Ensure Gradle JDK is set to **jbr-17**, not JDK 21
- Delete `android/.gradle` and `android/app/build` folders, then rebuild
