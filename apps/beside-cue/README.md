# Beside Cue app

Standalone SolidJS application and Android Capacitor shell for Beside Cue.

## Package boundaries

- `@irchiinnuss/beside-cue-core`: pure product domain and application contracts.
- `@irchiinnuss/mobile-runtime`: reusable web/Capacitor ports and opt-in
  capability adapters. Games can import only `/capacitor/haptics`; products
  that schedule cues can separately opt into `/capacitor/local-notifications`.
- `@irchiinnuss/beside-cue-app`: Beside Cue content, persistence composition, UI, assets, and native project.

MercuryPitch remains at the repository root during the incremental monorepo transition. Break Glass can later adopt `@irchiinnuss/mobile-runtime`, but every shipped app keeps its own Capacitor config, Android/iOS project, application ID, signing, assets, permissions, and store lifecycle.

The app stores one portable daily target time. Web previews deliver it only
while the tab is open; Android delegates the same recurring wall-clock intent
to one stable local OS notification ID. This avoids alarm buildup and keeps the
chosen local time after restarts or travel. All notification copy is generic,
so private pull and B-side text stays off the lock screen.

## Commands

```sh
pnpm beside-cue:dev
pnpm beside-cue:check
pnpm beside-cue:test
pnpm beside-cue:build
pnpm beside-cue:android
```

`com.irchiinnuss.besidecue` is provisional until the Play Console application is created. Treat it as permanent once that happens.

Android builds require Java 21 and Android SDK 36. The app supports Android 8
(API 26) and newer so its discreet, non-vibrating notification channel is
available consistently. Release bundles remain unsigned until a Play upload
key is supplied outside Git.

`MainActivity` uses `launchMode="singleTop"`. RevenueCat requires `standard`
or `singleTop` on the activity that starts a purchase; with `singleTask`,
backgrounding the app for payment verification can cancel the purchase.

## Purchases

Purchases run through RevenueCat, behind the `PurchasesPort` and `PaywallPort`
in `@irchiinnuss/mobile-runtime`. No screen imports the billing SDK, so the
web build has no store code on any path a browser can reach.

Nothing in the app is gated. `BeSideCue Pro` exists so people who want to
support the work can, and so a future gate is a `proAccess.isPro()` check
rather than an integration.

### Configuration

Copy `.env.example` to `.env.local` and fill in what you need. Development
builds with no key fall back to the RevenueCat **Test Store** key, which lets
you exercise the whole purchase flow without Play Console or App Store Connect
products. That key is refused in release builds — the SDK aborts an app that
configures one — so a release build without `VITE_REVENUECAT_ANDROID_KEY`
ships with purchases switched off and says so in Settings instead of crashing.

Identifiers live in one file, `src/purchases/revenuecat-config.ts`.

### Dashboard setup

1. **Entitlement** — create `BeSideCue Pro`. Renaming it means setting
   `VITE_REVENUECAT_ENTITLEMENT_ID` to match; nothing else in the code moves.
2. **Products** — `lifetime`, `yearly` and `monthly`, attached to that
   entitlement. On Play these are one non-consumable and two subscription base
   plans.
3. **Offering** — one offering holding the three products as packages. The
   adapter reads either the standard package types (`$rc_lifetime`,
   `$rc_annual`, `$rc_monthly`) or plain `lifetime` / `yearly` / `monthly`
   identifiers, so both dashboard conventions work.
4. **Paywall** — design a Paywall v2 on that offering. `presentPaywall` is
   template-driven, so pricing and copy change in the dashboard without an app
   release.
5. **Customer Center** — enable it to give subscribers cancellation, plan
   changes and refund requests without leaving the app.

### Verifying on a device

Run `pnpm beside-cue:android` on a machine with the Android SDK, open
Settings, and check that the paywall presents, a Test Store purchase flips Pro
on, Customer Center opens, **Restore purchases** works, and the entitlement
survives a force-quit.

### iOS

`@capacitor/ios` is a dependency, but the `ios/` project is not in the
repository — generating it needs macOS. On a Mac: `pnpm build` then
`pnpm exec cap add ios`, set `VITE_REVENUECAT_IOS_KEY`, and enable the In-App
Purchase capability in Xcode. No TypeScript changes are needed; every purchase
path is already platform-neutral.
