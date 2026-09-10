# Capacitor readiness — checklist & spike plan

**Status:** superseded, 10 Sep 2026 — kept as a risk register, not as a plan.

Both of its premises are now false: `apps/beside-cue/capacitor.config.ts`
exists and a full Capacitor 8 app has shipped to TestFlight since build 163,
and the spike this document proposed was never needed in the form it
describes. The shape it assumed — wrap **this** web app in place, at Phase 5 —
is also not what happened: Mercury Pitch is a separate package,
`apps/mercurypitch/`, which aliases this `src/` tree rather than copying it.

What is still live here is section B: the list of what WKWebView can do to an
app like this one. B2 and B3 carry answers paid for on a device, and they are
the reason those two rows are worth more than the rest of the file. The
current plan of record is
`dotfiles/personal/mercurypitch/plans/native-v1-1-implementation-plan-2026-09-10.md`.

Decision (interview): make the web app native-ready during the redesign, run
an early throwaway iOS spike, commit native projects only when the mobile
shell stabilizes (Phase 5). Capacitor has an official SolidJS + Vite
template, so the wrap itself is routine — the risk is concentrated in audio,
threading, and storage inside WKWebView. Full sourcing in
[native-feel-research.md](native-feel-research.md).

## A. Web-side readiness (do during Phases 0–3, benefits the web app too)

| #   | Item                                                                                                                                                                                                                                                                       | Where                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| A1  | `viewport-fit=cover` + safe-area tokens on all 4 HTML entries                                                                                                                                                                                                              | `index.html`, `mirror.html`, `karaoke.html` (has it), `glass.html` |
| A2  | `dvh`-based sizing for all full-height chrome; no bare `100vh` in kit code                                                                                                                                                                                                 | kit CSS                                                            |
| A3  | `src/lib/platform/` service layer (haptics, keepAwake, share, statusBar, openExternal) with web impls; components never import `@capacitor/*` directly                                                                                                                     | new                                                                |
| A4  | Audio-unlock chain audited: every sound-starting control routes through `unlockAudio` (`src/lib/audio-unlock.ts`); stages mount from lazy chunks so contexts are born suspended                                                                                            | existing util, enforce in kit                                      |
| A5  | Self-host Inter/Outfit (drop Google Fonts CDN) — required offline/native, nice for web privacy/perf                                                                                                                                                                        | `index.html`, assets                                               |
| A6  | Service worker + offline shell (Phase 4) — also derisks the capacitor:// asset serving model by making the app tolerant of no-network                                                                                                                                      | new                                                                |
| A7  | Keep hash-based routing for in-app navigation (already the case: `#/singing`) — hash routes are immune to file-server path issues in `capacitor://localhost`; the path-based marketing entries (`/karaoke-night`, `/glass`) are web-only and stay out of the native bundle | no change                                                          |
| A8  | Bundle discipline: the native shell ships only the `index` entry; standalone entries (mirror/karaoke/glass HTML) and their alias-copy plugins are excluded from `webDir`                                                                                                   | build config at Phase 5                                            |
| A9  | `beforeinstallprompt`/PWA polish deferred until Phase 4 — PWA is the cheap intermediate distribution while Capacitor matures                                                                                                                                               | plan                                                               |

## B. Known WKWebView risks → spike must answer (Phase S, parallel with Phase 1)

Throwaway branch: `npx cap add ios` on a dev machine with Xcode; nothing
committed except findings written back into this doc.

| #   | Risk                                                                                                                                                                                                                                                                                                                                                                                                                        | Test                                                                                        | Expected mitigation if it bites                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Mic permission flow: `getUserMedia` in WKWebView prompts per the native permission (`NSMicrophoneUsageDescription` in Info.plist)                                                                                                                                                                                                                                                                                           | Start mic on Singing stage; kill/relaunch; deny/re-allow path                               | Standard Info.plist string + graceful in-app denied-state (we already have `MicInsightHint`)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| B2  | **Earpiece routing**: enabling mic reroutes playback to the quiet earpiece                                                                                                                                                                                                                                                                                                                                                  | Play melody, toggle mic, listen to output level/route                                       | ~~`@capgo/capacitor-plugin-audiosession`~~ **FIX PENDING DEVICE CONFIRMATION 2026-09-04, no plugin**: `ios/App/App/AudioSession.swift` sets `playAndRecord` + `.defaultToSpeaker` at launch/reactivation, then repairs only an actual `.builtInReceiver` route. Never mutate the category from its route-change observer: category and speaker overrides emit their own notifications, and the prior unconditional observer is the leading code-level cause of build 214's main-thread feedback-loop symptoms. |
| B3  | **Cold audio session**: first-play stutter in fresh WKWebView (capacitor#8176, unconfirmed)                                                                                                                                                                                                                                                                                                                                 | Cold launch → immediate play; measure first 2s                                              | **DONE 2026-09-01**: `AudioSession.configure()` runs in `didFinishLaunchingWithOptions`, before the web layer exists. Also fixes the separate silence from `soloAmbient` — an app that never sets a category is muted by the Ring/Silent switch.                                                                                                                                                                                                                                                               |
| B4  | Pitch-detection latency: YIN runs on the main thread via `AnalyserNode` + rAF. ~~no AudioWorklet anywhere — verified~~ **WRONG, corrected 10 Sep 2026**: four worklets exist — `src/workers/guitar-input.worklet.ts`, `src/workers/guitar-recorder.worklet.ts`, `src/lib/guitar/recording-worklet.ts`, and `packages/pitch-engine/src/f0-capture.worklet.ts`, which already runs capture on the audio clock rather than rAF | Compare detection latency/jank vs iOS Safari on the same device                             | Acceptable for v1 (same engine as mobile Safari today); AudioWorklet migration is a separate perf project, not a Capacitor blocker                                                                                                                                                                                                                                                                                                                                                                             |
| B5  | **Threaded ONNX WASM**: UVR separation uses multi-threaded onnxruntime-web which needs cross-origin isolation (COOP/COEP); header behavior under the custom `capacitor://` scheme is unclear                                                                                                                                                                                                                                | Load the karaoke local-separation path; check `crossOriginIsolated`, thread count, fallback | Ship single-threaded WASM fallback in native (slower but works), or keep server-side separation as the native path; decide on data                                                                                                                                                                                                                                                                                                                                                                             |
| B6  | IndexedDB eviction: Dexie data (sessions, songs, groups) lives in WKWebView website storage                                                                                                                                                                                                                                                                                                                                 | Fill DB, background app days-long, check `navigator.storage.persist()` result               | If eviction observed: Dexie→`@capacitor-community/sqlite` adapter (native only; web keeps Dexie)                                                                                                                                                                                                                                                                                                                                                                                                               |
| B7  | Background audio: screen lock pauses WebAudio/JS timers                                                                                                                                                                                                                                                                                                                                                                     | Lock mid-practice; observe                                                                  | v1 policy: practice pauses on lock (acceptable for a practice app); keep-awake via `platform/` during active runs                                                                                                                                                                                                                                                                                                                                                                                              |
| B8  | On-device dev loop: live-reload needs HTTPS on LAN for getUserMedia                                                                                                                                                                                                                                                                                                                                                         | Confirm `dev:host` + basic-ssl works from the device inside the shell                       | mkcert cert for LAN IP (matches existing dev setup)                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| B9  | R2-hosted ONNX models (~MBs) fetched at runtime                                                                                                                                                                                                                                                                                                                                                                             | Confirm fetch + cache inside shell; measure                                                 | Cache API/persistent storage; optionally bundle the small SwiftF0 model, never the UVR model                                                                                                                                                                                                                                                                                                                                                                                                                   |

## C. Phase 5 — productionization (after stages ship)

> **Superseded, 10 Sep 2026.** Nothing below is wired up: none of the plugins
> listed here is a dependency of any app in this repository, and the
> `platform/` swap the section describes never happened. Read it as the
> shape of the problem, not as a task list. What Mercury Pitch actually
> depends on is in `apps/mercurypitch/package.json`, and CI is
> `.github/workflows/beside-cue-mobile.yml` plus its Mercury Pitch caller.

- `capacitor.config.ts`: `webDir: 'dist'`, `appId`, iOS scheme; trim inputs
  to the `index` entry (A8).
- Plugins: `@capacitor/haptics`, `@capacitor/status-bar` (style per theme,
  overlay + safe-area already handled by A1), `@capacitor/splash-screen`,
  `@capacitor/app` (Android back button → close sheet/stage before exiting —
  our "one sheet at a time" rule makes this a 10-line handler),
  `@capacitor/keep-awake`, audio-session plugin per B2/B3.
- Swap `platform/` web impls for Capacitor impls via one build-time flag.
- Store review posture: we're not a bare website wrap — mic-driven real-time
  practice, offline exercises, haptics, native audio session handling are
  app-like behavior; keep the marketing/SEO pages out of the shell.
- CI: cap sync + iOS/Android build jobs; version/splash/icon pipeline reuses
  `docs/branding` assets.

## D. Explicit non-goals (v1 native)

> **The third bullet is superseded, 10 Sep 2026** (owner answer 8). Billing
> does not stay web and the app does not link out: Beside Cue already depends
> on RevenueCat 13.4.0 (`apps/beside-cue/package.json:26-27`) through
> `packages/mobile-runtime/src/capacitor/purchases.ts`, and Mercury Pitch
> ships an inert purchase scaffold in V1-1 with the same seam behind it. The
> first two bullets still hold.

- No native audio DSP rewrite (web engine is the product).
- No background/lock-screen practice sessions.
- No IAP — billing stays web (Stripe) until store policy forces the issue;
  the native app links out per current App Store external-purchase rules at
  submission time (re-check then — this area moves).

## E. Running the spike — done, and the harness is gone

`scripts/spike-capacitor.sh` was deleted on 10 Sep 2026. Three of the four
assumptions it was built on turned out to be false, and each one had been
treated as a blocker:

- **It needed a Mac with Xcode.** It does not. Beside Cue has shipped to
  TestFlight from GitHub Actions `macos-latest` runners since build 163;
  `.github/workflows/beside-cue-mobile.yml` is the whole of it. Nobody here
  owns a Mac and none is required — the one thing that genuinely cannot be
  done on Linux is generating the certificate signing request, which is why
  the certificates were made through the App Store Connect API instead.
- **It needed CocoaPods.** Capacitor 8 resolves plugins through Swift Package
  Manager. `cap add ios` reports "All Capacitor plugins have a Package.swift
  file and will be included in Package.swift", and it runs on Linux.
- **Nothing would be committed.** The native projects are committed:
  `apps/mercurypitch/ios/`, `apps/mercurypitch/android/`, and
  `apps/mercurypitch/capacitor.config.ts` beside them. Regenerating is
  `cap sync`, never a fresh `cap add`.

The fourth assumption survives, and is the one worth keeping: on-device
`getUserMedia` over the LAN needs HTTPS, so a device playtest against a dev
server needs a certificate for the LAN IP (`apps/mercurypitch/.dev-cert/`,
git-ignored and machine-specific).

### Findings

Answered on a device, and written into the rows above rather than repeated
here: **B2** (earpiece routing — `ios/App/App/AudioSession.swift`, and never
mutate the category from the route-change observer) and **B3** (cold audio
session — configure in `didFinishLaunchingWithOptions`, which also fixes the
`soloAmbient` silence under the Ring/Silent switch). **B4** was answered by
reading the tree, and the row's original claim was wrong.

The rest are open, and are now tracked as Track 3 device rounds in
`dotfiles/personal/mercurypitch/plans/native-v1-1-checklist.md` rather than in
this table — one list, in the place it gets opened. **B5** is moot for Mercury
Pitch: UVR is out of the native product.

## F. Capacitor `platform/` adapter (Phase 5 drop-in)

The web `src/lib/platform/index.ts` is the only seam. The native build
swaps its impls for these (kept here rather than in-tree so the branch
stays dependency-free until Phase 5). Selected via a build flag, e.g.
`export const platform = import.meta.env.VITE_NATIVE ? capacitorPlatform : webPlatform`.

```ts
// src/lib/platform/capacitor.ts  (Phase 5)
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { KeepAwake } from '@capacitor/keep-awake'
import { Share } from '@capacitor/share'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Browser } from '@capacitor/browser'
import type { PlatformServices } from './index'

export const capacitorPlatform: PlatformServices = {
  haptics: {
    tapLight: () => void Haptics.impact({ style: ImpactStyle.Light }),
    success: () =>
      void Haptics.notification({ type: NotificationType.Success }),
    warning: () =>
      void Haptics.notification({ type: NotificationType.Warning }),
  },
  keepAwake: {
    enable: () => KeepAwake.keepAwake().then(() => undefined),
    disable: () => KeepAwake.allowSleep().then(() => undefined),
  },
  statusBar: {
    setStyle: (s) =>
      void StatusBar.setStyle({
        style: s === 'dark' ? Style.Dark : Style.Light,
      }),
  },
  share: (data) =>
    Share.share(data)
      .then(() => true)
      .catch(() => false),
  openExternal: (url) => void Browser.open({ url }),
}
```
