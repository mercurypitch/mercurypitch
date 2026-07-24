# Break Glass — native app (RevenueCat Shipaton 2026)

A brand-new native game for the [RevenueCat Shipaton 2026](https://revenuecat-shipaton-2026.devpost.com/)
(ship window **1 Aug – 30 Sept 2026**). It wraps the existing offline
`/glass` experience (sing → hold → shatter, tuned to your range) as a Capacitor
app for iOS + Android, monetized with a RevenueCat subscription.

Nothing here touches the main app: it lives on the `feat/shipaton-glass-game`
branch and builds a **separate app identity** (`com.mercurypitch.glass`).

## Architecture

- **Web bundle:** `vite.config.native.ts` builds only `game.html` →
  `dist-native/` (offline, WASM-free) and copies it to `index.html` for
  Capacitor's `webDir`.
- **Platform seam:** the native build aliases `@/lib/platform` →
  `src/lib/platform/capacitor.ts`, so haptics / keep-awake / share / status-bar
  use Capacitor plugins app-wide (incl. the `@/lib/haptics` re-export) with no
  per-component change.
- **Entry:** `game.html` → `src/features/glass/native-main.tsx` →
  `GameShell.tsx` (splash hide + Android back, guarded to native) → `GlassApp`
  (reused as-is) with `Paywall.tsx` layered over it.
- **Monetization:** `src/lib/monetization/revenuecat.ts` wraps
  `@revenuecat/purchases-capacitor` (entitlement `pro`). Shared components never
  import it — they open the paywall via `src/features/glass/paywall-control.ts`
  and read `pro` state, keeping `GlassApp` web-clean.

## Build & run

```bash
pnpm build:native        # web bundle → dist-native/ (offline, mode=native)
pnpm preview:native      # serve dist-native at http://localhost:4174
pnpm cap:sync            # build:native + cap sync (copy into ios/ + android/)
pnpm cap:run:android     # build + install on a connected Android device (Linux OK)
pnpm cap:ios             # build + open Xcode (needs macOS / CI)
```

Android builds fully locally on Linux. iOS builds run on **Codemagic**
(`codemagic.yaml`) — no Mac needed; your iPhone tests via TestFlight.

RevenueCat keys load from `.env.native.local` (copy `.env.native.example`).

## Status

Done:
- Capacitor 8 scaffold (iOS SPM + Android), mic permissions
  (`NSMicrophoneUsageDescription`, `RECORD_AUDIO`).
- Native platform adapter, offline native build verified (renders the game, no
  console errors).
- RevenueCat SDK wired behind the platform check + a working offerings paywall.
- Codemagic CI template for both stores.

TODO (next build phases):
- **Game progression** — the current glass is a single challenge; add levels /
  packs (e.g. the cosmic "Sing the Universe" stages) as the net-new content, and
  a level-select screen. Gate premium levels behind `openPaywall()`.
- Remove/replace the web footer links (`/mirror`, `/karaoke-night`) in the
  native shell — they 404 in the app.
- Swap the placeholder `Paywall.tsx` for **RevenueCat Paywalls v2** (remote,
  no-rebuild restyle).
- iOS audio-session plugin for the known WKWebView mic risks (readiness §B2/B3).
- App icon + splash from `docs/branding`; store screenshots.

## What you (the human) need to do

Accounts & identity:
- [ ] Apple Developer Program — enroll from iPhone (Individual, domain-email
      Apple ID). $99/yr.
- [ ] Google Play developer account ($25). If **personal**, plan the 12-tester /
      14-day closed test (start it the moment the first build is up).
- [ ] (Optional) Samsung Galaxy Store seller account (fast, no test gate).
- [ ] (If going Organization on either store) request a free D-U-N-S number now.

RevenueCat dashboard:
- [ ] Create a project; add the iOS + Android apps.
- [ ] Entitlement `pro`; offering `default` with monthly + annual packages.
- [ ] Copy the **public** SDK keys into `.env.native.local` / the Codemagic
      `revenuecat` group.

Store products:
- [ ] App Store Connect: create the app (`com.mercurypitch.glass`) + an
      auto-renewing subscription; link it in RevenueCat.
- [ ] Play Console: create the app + subscription; link it in RevenueCat.

CI (Codemagic):
- [ ] Variable groups `revenuecat`, `google_play`; Android keystore
      `break_glass_keystore`; ASC API key integration `break_glass_asc`.
- [ ] Wire `android/app/build.gradle` signingConfig to the injected `CM_*`
      keystore variables.

See `~/.dotfiles/personal/mercurypitch/plans/MercuryPitch_Shipaton_2026_App_Launch_Playbook.md`
for the full strategy, timeline, and award-targeting plan.
