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
