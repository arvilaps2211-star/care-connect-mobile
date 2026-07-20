# CareConnect — Final Developer Handover

Emergency response platform connecting **patients**, **hospitals**, and **ambulance drivers**. Single React/Vite codebase produces **two Android apps** (patient + ambulance) plus a **web portal** used by hospitals and admins.

---

## 1. Architecture

```text
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│   Patient App       │   │  Ambulance App      │   │  Hospital / Admin   │
│   (Android/Web)     │   │  (Android)          │   │  Web Portal         │
│   React + Capacitor │   │  React + Capacitor  │   │  React (browser)    │
└──────────┬──────────┘   └──────────┬──────────┘   └──────────┬──────────┘
           │                         │                         │
           └────────────┬────────────┴────────────┬────────────┘
                        │                         │
                        ▼                         ▼
           ┌────────────────────────┐   ┌────────────────────────┐
           │   Supabase Postgres    │◄──┤   Supabase Auth (JWT)  │
           │   + RLS + Realtime     │   │   email/password       │
           └───────────┬────────────┘   └────────────────────────┘
                       │
                       ▼
           ┌────────────────────────┐   ┌────────────────────────┐
           │   Supabase Edge Fns    │──►│   Twilio SMS API       │
           │   (Deno / TypeScript)  │   │   (via connector or    │
           │                        │   │    TWILIO_* secrets)   │
           └───────────┬────────────┘   └────────────────────────┘
                       │
                       ▼
           ┌────────────────────────┐
           │   FCM Push (send-push) │
           └────────────────────────┘
```

**Runtime split**
- Frontend is a plain SPA (React 18, Vite 5, Tailwind, shadcn/ui). No server component.
- Backend is Lovable Cloud (Supabase). All privileged work runs in Edge Functions with the service-role key.
- Native shell is Capacitor 5. Two separate manifests / configs produce two APKs from one web build.

---

## 2. Folder Structure

```text
├── android-user/                 # Patient APK — AndroidManifest + native Java (SOS service)
├── android-ambulance/            # Ambulance APK — AndroidManifest
├── android-native-files/         # Source-of-truth Java/XML copied into android-user
├── capacitor.user.config.ts      # appId: com.careconnect.user
├── capacitor.ambulance.config.ts # appId: com.careconnect.ambulance
├── public/                       # logos, manifest.json, static assets
├── src/
│   ├── pages/                    # Route components (see §7–10)
│   ├── components/               # PhoneInput, EmergencyChat, RouteMap, TripHistory, …
│   ├── components/ui/            # shadcn primitives
│   ├── contexts/                 # SOSContext (global emergency state)
│   ├── hooks/                    # useAuth, useLocation, useOsrmRoute, useAccidentDetection
│   ├── features/
│   │   ├── emergencies/          # emergencyService.ts — orchestrates GPS → DB → SMS → push
│   │   ├── ambulance/            # driver-specific logic
│   │   ├── geolocation/          # cross-platform GPS
│   │   ├── notifications/        # local + push
│   │   └── sms/                  # bulk SMS + templates
│   ├── services/                 # smsService, audioAlertService, ambulanceNotificationService
│   ├── utils/                    # phoneFormat, emergencyGPS, mapLinks, safetyDiagnostics
│   ├── plugins/                  # Capacitor bridges (lockScreenSOS, background-monitor)
│   └── integrations/supabase/    # AUTO-GENERATED client.ts + types.ts — do not edit
└── supabase/
    ├── config.toml               # auto-generated project settings
    └── functions/                # 8 edge functions (see §5)
```

---

## 3. Database ER Diagram

```text
                       ┌──────────────┐
                       │  auth.users  │  (Supabase-managed)
                       └──────┬───────┘
                              │ user_id (FK on every table below)
          ┌───────────────────┼──────────────────────────────────┐
          ▼                   ▼                                  ▼
   ┌──────────────┐    ┌──────────────┐                  ┌──────────────┐
   │  profiles    │    │  user_roles  │  role ∈          │ medical_info │
   │  name, age,  │    │  admin |     │  {admin,hospital,│  blood_group,│
   │  gender,     │    │  hospital |  │   ambulance,     │  allergies,  │
   │  phone, addr │    │  ambulance} │   user}           │  history     │
   └──────┬───────┘    └──────────────┘                  └──────────────┘
          │
          │ 1..N
          ▼
   ┌──────────────┐        ┌─────────────────┐        ┌──────────────────┐
   │  guardians   │        │   emergencies   │◄───────┤ emergency_messages│
   │  name, phone │        │  status, lat,   │  1..N  │  sender_role,text │
   └──────────────┘        │  lng, hospital, │        └──────────────────┘
                           │  ambulance_id   │
                           └────┬───────┬────┘
                                │       │
                     ┌──────────┘       └──────────┐
                     ▼                             ▼
              ┌──────────────┐             ┌──────────────────┐
              │  hospitals   │◄────────────┤ hospital_ambulances│  (join)
              │  name, lat,  │             └────────┬─────────┘
              │  lng, contact│                      │
              └──────┬───────┘                      ▼
                     │                     ┌──────────────────┐
                     ▼                     │ ambulance_services│
           ┌──────────────────────┐        │  name, phone,    │
           │ hospital_verifications│       │  lat, lng        │
           │  license, cert, status│       └──────────────────┘
           └──────────────────────┘

   ┌──────────────┐
   │  fcm_tokens  │  user_id, token, platform, role  (for push)
   └──────────────┘
```

---

## 4. Supabase Tables (11)

| Table | Purpose | RLS |
|---|---|---|
| `profiles` | Patient/user profile (name, age, gender, phone, address, photo) | Owner read/write |
| `user_roles` | Enum-role assignments (admin, hospital, ambulance, user) | Read own; writes via `has_role()` |
| `guardians` | Emergency contacts per user | Owner CRUD |
| `medical_info` | Blood group, allergies, history | Owner CRUD |
| `emergencies` | Active/accepted/dispatched/resolved cases | Owner + assigned hospital/ambulance |
| `emergency_messages` | Realtime chat between hospital ↔ ambulance | Participants only |
| `hospitals` | Registered facilities | Public read, owner write |
| `hospital_verifications` | Uploaded license/certificate + status | Owner + admin |
| `hospital_ambulances` | Join table (hospital ↔ ambulance fleet) | Hospital-scoped |
| `ambulance_services` | Fleet vehicles/drivers | Hospital-scoped write |
| `fcm_tokens` | Device push tokens per user + role | Owner CRUD |

All `public` tables have explicit `GRANT` to `authenticated` / `service_role`. `user_roles` uses the `public.has_role(uuid, app_role)` SECURITY DEFINER helper to avoid RLS recursion.

---

## 5. Edge Functions (8, all Deno)

| Function | Trigger | Purpose |
|---|---|---|
| `seed-admin` | Manual | Idempotently creates the 4 demo accounts + roles |
| `send-test-sms` | Client | Single-recipient SMS via Twilio (validates E.164, truncates to 155 chars, guards against Twilio error 21267) |
| `notify-emergency` | On SOS | Sends SOS SMS to all guardians of a user |
| `notify-hospital-acceptance` | Hospital accepts | SMS to guardians with hospital name + Google Maps link |
| `notify-ambulance-dispatch` | Hospital dispatches | SMS to driver + guardians with route link |
| `send-push` / `send-push-notification` | Any lifecycle event | FCM push to hospitals/ambulances by role |
| `register-ambulance` | Registration form | Creates driver profile + ambulance vehicle + role assignment |

All functions: import `corsHeaders` from `npm:@supabase/supabase-js@2/cors`, validate body with lightweight schemas, and return the provider's status + body on failure (never a bare 500).

---

## 6. Authentication Flow

```text
App load
  │
  ▼
supabase.auth.getSession()
  │
  ├─ no session ────────► /auth (or role-specific login)
  │
  └─ session ► lookup user_roles.role
                 ├─ admin     ► /admin
                 ├─ hospital  ► /hospital
                 ├─ ambulance ► /ambulance-driver
                 └─ (none)    ► profiles.onboarding_completed?
                                 ├─ true  ► /dashboard
                                 └─ false ► /onboarding
```

- Email/password only. HIBP disabled for demo.
- Session persisted in `localStorage` via the classic Supabase JS client.
- `useAuth` hook registers `onAuthStateChange`; role reads use `.maybeSingle()` to tolerate missing rows.
- Seeded demo credentials:
  - `admin@careconnect.com / Admin@123`
  - `hospital@citycare.com / Hospital@123`
  - `driver@ambulance1.com / Driver@123`
  - `patient@test.com / Patient@123`

---

## 7. SMS Flow

```text
Trigger (SOS / hospital accept / dispatch)
  │
  ▼
services/smsService.ts  or  features/sms/*
  │  1. Fetch guardians dynamically from DB (never hardcoded)
  │  2. Format each number with utils/phoneFormat.ts → +91XXXXXXXXXX
  │  3. Build short template (< 155 chars) + Google Maps link
  │  4. Invoke edge function (send-test-sms / notify-*)
  ▼
Edge function
  │  - Validates TWILIO_PHONE_NUMBER is numeric (rejects alphanumeric on trial)
  │  - Truncates body to 155 chars
  │  - POSTs to Twilio /Messages.json (form-encoded)
  │  - Retries with exponential backoff (1s, 2s, 4s)
  │  - Logs masked phone (last 4 digits) — NEVER full PII
  ▼
Response written to client + persisted attempt in localStorage for diagnostics
```

**Templates** (all < 160 chars): `emergencyAlert`, `sosTrigger`, `hospitalAcceptance`, `guardianAlert`, `etaUpdate`, `arrivalConfirm`.

---

## 8. GPS Flow

```text
utils/emergencyGPS.ts → getEmergencyLocation(fallback?)
  │
  ├─ native  → Capacitor Geolocation (enableHighAccuracy, 8s timeout)
  ├─ web     → navigator.geolocation (retries 2×, targets ±15 m)
  │
  ├─ success → { lat, lng, accuracy, source: 'gps' }
  ├─ timeout → cached lastKnown (< 30 s old) → source: 'cache'
  └─ fail    → fallback param                → source: 'fallback' | 'unavailable'
```

- Background tracking: `hooks/useBackgroundLocation.ts` + `SOSForegroundService.java` (Android specialUse foreground service).
- Map links: mobile uses native intents (`geo:` / Apple Maps); SMS always uses `https://maps.google.com/?q=lat,lng` for cross-platform compatibility.

---

## 9. Hospital Flow

1. Staff registers at `/hospital-login` — uploads license to `hospital-documents` bucket (private, RLS-scoped).
2. `register_hospital()` SECURITY DEFINER function creates row, verification record, and assigns `hospital` role.
3. Dashboard subscribes to `emergencies` where `status = 'active'`.
4. **Accept** → `status = 'accepted'`, `hospital_id` set, `notify-hospital-acceptance` fires SMS.
5. **Dispatch** to a specific ambulance → `status = 'dispatched'`, `ambulance_id` set, `notify-ambulance-dispatch` fires.
6. Chat with assigned driver via `emergency_messages` (Realtime, 5 s polling fallback).
7. **Resolve** → `status = 'resolved'`; RLS closes third-party read access.

---

## 10. Ambulance Flow

1. Driver logs in at `/ambulance-login` (email/password, "Remember Me" persists email in localStorage).
2. `AmbulanceDriverDashboard` resolves the ambulance from the driver's profile.
3. Status toggle: **Available → En Route → Busy → Offline** (drives background tracking on/off).
4. On dispatch push/realtime event: audio siren + haptics + accept/reject buttons.
5. Route optimization: OSRM (free) polyline drawn on Leaflet; green "Navigate with Google Maps" button opens turn-by-turn.
6. In-app chat with hospital; offline banner pauses new dispatches when `navigator.onLine === false`.
7. Trip history: last 20 resolved cases, expandable card at dashboard bottom.

---

## 11. Android Build Process

**Prerequisites**
- JDK **17** (pinned)
- Gradle **8.7** (pinned)
- Android SDK 34, Build-Tools 34.0.0
- Node 20+, npm or bun

**Build once**
```bash
npm install
```

**Patient APK**
```bash
npm run cap:user               # vite build (mode=user) + cap sync
npx cap open android --config capacitor.user.config.ts
# In Android Studio: Build → Build Bundle(s)/APK(s) → Build APK
```

**Ambulance APK**
```bash
npm run cap:ambulance
npx cap open android --config capacitor.ambulance.config.ts
```

**Signed release (either app)**
```bash
cd android
./gradlew bundleRelease          # → app/build/outputs/bundle/release/app-release.aab
./gradlew assembleRelease        # → app/build/outputs/apk/release/app-release.apk
```
Configure signing in `android/app/build.gradle` (`signingConfigs.release`) or via Android Studio → Build → Generate Signed Bundle / APK.

---

## 12. Capacitor Commands

```bash
# One-time platform add (already committed under android-user / android-ambulance)
npx cap add android --config capacitor.user.config.ts
npx cap add android --config capacitor.ambulance.config.ts

# After any web change
npm run build:user       && npx cap sync android --config capacitor.user.config.ts
npm run build:ambulance  && npx cap sync android --config capacitor.ambulance.config.ts

# Copy web assets only (no plugin update)
npx cap copy android --config capacitor.user.config.ts

# Open in Android Studio
npx cap open android --config capacitor.user.config.ts

# Live-run on connected device
npx cap run android --config capacitor.user.config.ts
```

---

## 13. GitHub Push Commands

```bash
# One-time
git remote add origin https://github.com/<you>/careconnect.git

# Every change
git status
git add .
git commit -m "Complete CareConnect production stabilization"
git push origin main
```

`.gitignore` already excludes: `node_modules/`, `dist/`, `dist-ambulance/`, `android/app/build/`, `.env.local`, `*.keystore`, `.DS_Store`.
**Do commit** `android-user/`, `android-ambulance/`, `capacitor.*.config.ts`, and lockfiles.

---

## 14. Environment Variables

### Frontend (`.env`, auto-managed by Lovable Cloud)
| Var | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase REST endpoint |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key (safe in browser bundle) |
| `VITE_SUPABASE_PROJECT_ID` | Used to construct edge-function URLs |
| `VITE_APP_TYPE` | `user` \| `ambulance` — selects logo/branding |
| `VITE_DEV_MODE` (optional, `.env.local`) | Bypasses admin auth in local dev only |

### Edge Functions (Supabase Secrets)
| Secret | Purpose |
|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB access (auto-provisioned) |
| `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` | JWT verification |
| `TWILIO_ACCOUNT_SID` | Twilio account |
| `TWILIO_AUTH_TOKEN` | Twilio API auth |
| `TWILIO_PHONE_NUMBER` | Sender number in E.164 (**must be numeric**, not alphanumeric — trial accounts) |
| `LOVABLE_API_KEY` | Lovable AI Gateway (currently unused; ready for AI features) |
| `FCM_SERVER_KEY` (add before enabling push) | Firebase Cloud Messaging |

---

## 15. Production Deployment Checklist

**Backend**
- [ ] `security--linter` clean; every `public` table has RLS + GRANT
- [ ] Rotate Twilio credentials; upgrade Twilio account off trial (verified caller-ID limits removed)
- [ ] Enable HIBP password protection (`configure_auth password_hibp_enabled: true`) — currently disabled for demo
- [ ] Set custom SMTP or verified sending domain for auth emails
- [ ] Add `FCM_SERVER_KEY` secret and enable Firebase project
- [ ] Point storage bucket lifecycle rules / size limits on `hospital-documents`

**Frontend / Web portal**
- [ ] Click **Publish** in Lovable to go live (frontend changes require this; edge functions deploy automatically)
- [ ] Attach custom domain (Project Settings → Domains) after first publish
- [ ] Confirm `/hospital-login`, `/admin`, `/hospital`, `/admin-panel` render behind role guards

**Android**
- [ ] Generate release keystore, store in secure vault
- [ ] Fill `signingConfigs.release` in both `android-user` and `android-ambulance`
- [ ] Bump `versionCode` / `versionName` in each `app/build.gradle`
- [ ] Provide store assets: 512×512 icon, 1024×500 feature graphic, screenshots per app
- [ ] Complete Play Console Data Safety form (location + contacts + photos collected)
- [ ] Submit **background location** justification (SOS use-case) — required for approval
- [ ] Submit `USE_FULL_SCREEN_INTENT` justification (emergency category)

**Verification**
- [ ] Seed function invoked once (`POST /seed-admin`) — verify 4 accounts
- [ ] Real end-to-end SMS to a verified Twilio number
- [ ] Lock-screen SOS: lock phone, shake, confirm full-screen wake + guardian SMS
- [ ] Realtime chat: hospital ↔ ambulance message round-trip

---

## 16. Known Limitations

1. **Twilio trial** — SMS delivers only to verified caller IDs; upgrade removes this. Error 21608 is a trial-plan message, not a code bug.
2. **Alphanumeric sender** unsupported on trial (Twilio error 21267) — must use a purchased number.
3. **OSRM public server** is best-effort and rate-limited — for production either self-host OSRM or swap for Google Directions API (planned per master prompt).
4. **HIBP password protection disabled** for the demo; simple passwords like `123456` are accepted.
5. **Native lock-screen SOS** (`SOSForegroundService`) is Android-only. iOS would need a fresh implementation (CoreMotion + CallKit-like full-screen intent).
6. **FCM push** requires `FCM_SERVER_KEY` — not yet set; `send-push` returns 500 until configured.
7. **Hospital document review** is auto-approved by `register_hospital()`; there is no admin verification queue yet.
8. **Chat message retention** — no TTL; `emergency_messages` grow unbounded. Add a periodic cleanup for resolved cases.
9. **Nominatim geocoding** for address lookup is rate-limited; consider replacing with a paid geocoder at scale.
10. **Single language (English)**; SMS templates are not localized.

---

## 17. Future Improvements

**Product**
- Two-factor auth (SMS OTP) for hospital & admin roles.
- Admin verification queue for hospital registrations (approve/reject with reason).
- Patient-side ETA display + live ambulance marker on map.
- Multi-language SMS templates (i18n keyed by profile language).
- iOS build using the same Capacitor codebase.

**Engineering**
- Swap OSRM → Google Directions API + polyline caching.
- Move SMS orchestration into a queue (Postgres `pg_cron` or Supabase Queues) to survive edge cold-starts.
- Add integration tests around `emergencyService.triggerEmergency()` covering GPS timeout, guardian fanout, and partial SMS failure.
- Playwright e2e for the four seeded roles.
- Structured logging (JSON) with a log drain to a hosted collector.
- Sentry / crash reporter for both APKs.

**Ops**
- Nightly `pg_dump` snapshot via GitHub Actions.
- Terraform / Supabase CLI migration pipeline replacing ad-hoc migrations.
- Play Store internal testing track for both APKs with staged rollout.

---

_Last updated: 2026-07-20. Maintained alongside the Lovable project memory (`mem://index.md`)._