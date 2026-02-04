# CareConnect Android Studio Setup Guide

## Problem: Java 21 / Gradle Sync Failures

Android Studio defaults to Java 21, but CareConnect requires **Java 17** (LTS) for compatibility with Capacitor 7.x and Gradle 8.x.

---

## Quick Fix: Force JDK 17

### Step 1: Configure Gradle JDK

1. Open Android Studio
2. Go to **File → Settings** (Windows) or **Android Studio → Preferences** (Mac)
3. Navigate to **Build, Execution, Deployment → Build Tools → Gradle**
4. Under **Gradle JDK**, select:
   - **Embedded JDK 17** (recommended)
   - OR download **Eclipse Temurin 17** via IntelliJ/Android Studio
5. Click **Apply → OK**

### Step 2: Verify gradle-wrapper.properties

Ensure `android/gradle/wrapper/gradle-wrapper.properties` contains:

```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.7-all.zip
```

### Step 3: Sync Project

```bash
# From project root
npx cap sync android
```

Then in Android Studio:
- **File → Sync Project with Gradle Files**

---

## Common Errors & Fixes

### Error: `<no module>` or "app module not detected"

**Cause**: Android Studio opened at wrong folder level.

**Fix**: Always open **`/android`** folder directly, NOT the project root.

### Error: `gradle-wrapper.properties not found`

**Cause**: Capacitor files not synced.

**Fix**:
```bash
npx cap update android
npx cap sync android
```

### Error: `java.net.UnknownHostException` during Gradle sync

**Cause**: Network issue or wrong Gradle distribution URL.

**Fix**: 
1. Check internet connection
2. Use Gradle 8.7 (stable with Capacitor 7.x)
3. Try: **File → Invalidate Caches / Restart**

### Error: `Unsupported class file major version 65`

**Cause**: Project compiled with Java 21 but Gradle expects 17.

**Fix**:
1. Delete `android/.gradle` folder
2. Delete `android/app/build` folder
3. Force JDK 17 as shown above
4. Re-sync

---

## Complete Reset Procedure

If all else fails:

```bash
# 1. Clean everything
rm -rf android/.gradle
rm -rf android/app/build
rm -rf node_modules/.cache

# 2. Reinstall dependencies
npm install --legacy-peer-deps

# 3. Regenerate Android files
npx cap update android
npx cap sync android

# 4. Build web assets
npm run build

# 5. Sync again
npx cap sync android
```

Then open Android Studio at the `/android` folder.

---

## Recommended JDK Sources

| Provider | Download |
|----------|----------|
| Eclipse Temurin | https://adoptium.net/temurin/releases/?version=17 |
| Android Studio Embedded | Settings → Gradle → Gradle JDK → "Embedded JDK" |
| Amazon Corretto | https://aws.amazon.com/corretto/ |

---

## Security & Lock Screen Notification Justification

### Why CareConnect Cannot Bypass Lock Screen

1. **Android Security Policy**: Apps CANNOT bypass PIN/pattern/fingerprint locks. This is an OS-level restriction that protects user data.

2. **Notification-Based Approach**: Instead, CareConnect uses:
   - **High-priority notification channel** (importance level 5)
   - **Full-screen intent** (shows over lock screen without unlocking)
   - **Ongoing notification** (cannot be swiped away)
   - **Action buttons** ("I'm Safe" / "Send SOS")

3. **User Interaction Required**: The user must:
   - See the notification on lock screen
   - Tap an action button OR
   - Unlock phone to access full app

4. **Industry Standard**: This is how all emergency apps work (Google Safety Check, Samsung Emergency SOS, etc.)

### AndroidManifest.xml Configuration

The following permissions enable lock-screen notifications:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
```

The notification channel is created with:
- `importance: 5` (MAX - shows on lock screen)
- `visibility: 1` (PUBLIC - content visible on lock screen)
- `sound`, `vibration`, `lights` enabled

This follows Google's guidelines for emergency/safety applications.

---

## Build Commands Reference

```bash
# Development
npm run dev          # Web dashboards only

# Android
npx cap sync android # Sync web to Android
npx cap run android  # Run on device/emulator
npx cap open android # Open in Android Studio

# iOS
npx cap sync ios
npx cap run ios
npx cap open ios
```
