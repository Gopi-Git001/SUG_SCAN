# QuickGOB

Scan a food or drink label with your phone and see its sugars at a glance.

QuickGOB reads the ingredient list (and the nutrition panel, if it's in the photo), sorts every sugar and
sweetener it finds, and gives one verdict: **CLEAN**, **OKAY** or **BAD**. A cartoon sugar cube reacts to the result.

> This README describes the `Sugscan` branch.

## How verdicts work

| Verdict | When |
|---|---|
| **CLEAN** | No added sugar and no sweeteners. Sugars that are naturally in the food (lactose in milk, fructose in fruit) are fine. |
| **OKAY** | 1–4 g of added sugar per serving, sugar alcohols (erythritol, xylitol…), or plant sweeteners (stevia, monk fruit). |
| **BAD** | Artificial sweeteners (aspartame, sucralose…), alcohol, or more than 4 g of added sugar per serving. |

Claude's vision model only *reads* the label. Fixed rules in
[`supabase/functions/_shared/rules.ts`](supabase/functions/_shared/rules.ts) decide the verdict, so the same label
always gets the same answer. A second check (Jev / TypeSafe) is logged but can never override the rules.

Not medical advice. QuickGOB doesn't check allergens.

## Features

- Full-screen camera with a guide box; the photo freezes behind the result.
- Dark result card: verdict, then natural sugars, added sugars and sweeteners (only the ones found).
- Sign in with a phone number and SMS code (Supabase Auth + Twilio Verify).
- **Profile** (person icon): name, masked phone number, your stats (% CLEAN / OKAY / BAD), sign out, delete account.
- **Menu** (☰): scan history, preferences (Strict mode, Gentle mode, Haptics), how verdicts work, help, privacy, terms.
- Scan history saved to your account. Photos are never stored.
- Delete account removes the account, profile and all scan history.

## Tech stack

- **App:** Expo SDK 58 (React Native, TypeScript), runs in **Expo Go** on a real phone.
- **Backend:** Supabase: Auth (phone OTP), Postgres with Row Level Security, Edge Functions (Deno), pg_cron.
- **AI:** Claude (Anthropic API) reads the label inside the `scan-label` Edge Function.
- **Animation:** Lottie (`lottie-react-native`). **Icons:** lucide-react-native. **Font:** Inter.

## Project structure

```
App.tsx                      App shell: sign-in, camera, result, Profile and Menu sheets
src/
  screens/                   CameraScreen, ResultScreen, SignInScreen, ProfileScreen, MenuScreen
  components/                VerdictPanel (result card), Chrome (header, pill), Character, ListUI, Icons
  lib/                       supabase client, api calls, account, prefs, history, pure display helpers
  config.ts                  Privacy/terms/support/store links (placeholders, marked TODO)
supabase/
  migrations/                profiles + scans tables, RLS, sign-up trigger, daily cleanup job
  functions/scan-label/      Photo → Claude reads label → rules → verdict; saves the scan
  functions/delete-account/  Deletes the caller's scans, profile and user
  functions/_shared/         Sugar rules (rules.ts) and the Jev check, with tests
  tests/database/            pgTAP tests for the trigger and Row Level Security
assets/lottie/               Character animations (idle, scanning, happy, okay, sad)
```

## Quick start (demo mode, no backend)

You can try the app without any accounts or keys. It shows fake results in turn.

**Needs:** Node.js 20+, and the **Expo Go** app on your phone (iOS or Android), on the same Wi-Fi as your computer.

```bash
git clone https://github.com/Gopi-Git001/SUG_SCAN.git
cd SUG_SCAN
git checkout Sugscan
npm install
npx expo start --clear
```

Scan the QR code with your phone's camera (iOS) or the Expo Go app (Android). Without a `.env` file the app runs in
demo mode: no sign-in, and the header shows "Demo mode · fake results".

## Full setup (your own Supabase backend)

**Also needs:** a [Supabase](https://supabase.com) project, an [Anthropic API key](https://console.anthropic.com),
and a [Twilio Verify](https://www.twilio.com/verify) service for SMS codes. Docker is only needed to run the
database tests locally.

### 1. App settings

```bash
cp .env.example .env
```

Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from Supabase → Project Settings →
API Keys. Both are public by design. **Never put a secret key in the app's `.env`.**

### 2. Link the project and create the database

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push --remote
```

This creates the `profiles` and `scans` tables with Row Level Security, the sign-up trigger, and a daily pg_cron job
that clears unverified phone-number changes older than an hour.

### 3. Server secrets and functions

```bash
cp supabase/functions/.env.example supabase/functions/.env   # fill in ANTHROPIC_API_KEY and TYPESAFE_API_KEY
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy scan-label delete-account
```

API keys live only in Supabase secrets, never in the app. The service-role key is used only inside Edge Functions.

### 4. SMS sign-in (Twilio Verify)

```bash
cp supabase/.env.example supabase/.env   # fill in your Twilio Account SID, Verify Service SID and Auth Token
```

Then turn on the Twilio Verify phone provider, either in the Supabase dashboard (Authentication → Sign In /
Providers → Phone) or with `npx supabase config push`. Check the diff first with `npx supabase config diff`,
because a push overwrites the project's auth settings.

**Testing without real SMS:** add test numbers in the same Phone settings, as digits only, e.g.
`15555550100=123456`, and set "valid until" to a future date. **Remove test numbers before releasing.**

### 5. Run it

```bash
npx expo start --clear
```

Sign in with your phone number, then scan a label.

## Tests

```bash
npm run test:rules      # sugar rules, Jev check and display helpers (Node's built-in test runner)
npx tsc --noEmit        # type check the app
npx supabase db start   # local database (Docker), then:
npx supabase test db    # trigger and Row Level Security tests
```

## Privacy

For each scan, QuickGOB stores the product name, the verdict and the ingredient lists found, linked to your account.
Label photos are never stored. Your phone number is used only to sign in. Deleting your account permanently deletes
your profile and scan history.

## Status

| Phase | What | State |
|---|---|---|
| 1 | Supabase backend: profiles, scans, RLS, functions, cleanup job | Done |
| 2 | Separate Profile and Menu screens, synced preferences | Done |
| 3 | Change phone number (SMS code to the new number) | Next |
| 4 | Account scan history: by day, filters, paging, swipe to delete, upload of on-phone history | Planned |

**Before a store release:** replace the placeholder links in `src/config.ts`, remove any test phone numbers, and set
the iOS bundle identifier and Android package name in `app.json`.
