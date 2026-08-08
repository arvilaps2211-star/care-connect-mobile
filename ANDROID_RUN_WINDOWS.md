# Running CareConnect on Android (Windows / Android Studio)

Capacitor 5's CLI has **no `--config` flag** — that's why `npx cap sync android --config ...`
failed. Use the npm scripts below instead; they swap the right `capacitor.*.config.ts`
in automatically, create the native project, sync, and copy all native files
(manifest, icons, splash, Java services) for you.

## Patient app

```bat
npm install
npm run cap:user:open
```

## Ambulance app

```bat
npm run cap:ambulance:open
```

Each app gets its own native project so they can coexist:

- Patient   -> `native\android-user`
- Ambulance -> `native\android-ambulance`

If Android Studio doesn't launch automatically, open that folder directly
(**not** the project root).

## In Android Studio

1. File -> Settings -> Build, Execution, Deployment -> Build Tools -> Gradle
   -> **Gradle JDK = jbr-17** (Java 21 will fail).
2. File -> Sync Project with Gradle Files
3. Build -> Clean Project, then Run.

## Build an APK from the command line

```bat
cd native\android-user
gradlew.bat clean assembleDebug
```

APK: `native\android-user\app\build\outputs\apk\debug\app-debug.apk`

## Notes

- Never run `npx cap init` — the config files already exist.
- `cp` / `./gradlew` are Linux commands; on Windows use `xcopy` / `gradlew.bat`
  (the npm scripts already handle the file copying).
- Re-run `npm run cap:user` after every code change, then Run in Android Studio.
