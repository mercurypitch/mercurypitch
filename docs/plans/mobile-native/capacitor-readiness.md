# Capacitor readiness — checklist & spike plan

Decision (interview): make the web app native-ready during the redesign, run
an early throwaway iOS spike, commit native projects only when the mobile
shell stabilizes (Phase 5). Capacitor has an official SolidJS + Vite
template, so the wrap itself is routine — the risk is concentrated in audio,
threading, and storage inside WKWebView. Full sourcing in
[native-feel-research.md](native-feel-research.md).

## A. Web-side readiness (do during Phases 0–3, benefits the web app too)

| # | Item | Where |
| --- | --- | --- |
| A1 | `viewport-fit=cover` + safe-area tokens on all 4 HTML entries | `index.html`, `mirror.html`, `karaoke.html` (has it), `glass.html` |
| A2 | `dvh`-based sizing for all full-height chrome; no bare `100vh` in kit code | kit CSS |
| A3 | `src/lib/platform/` service layer (haptics, keepAwake, share, statusBar, openExternal) with web impls; components never import `@capacitor/*` directly | new |
| A4 | Audio-unlock chain audited: every sound-starting control routes through `unlockAudio` (`src/lib/audio-unlock.ts`); stages mount from lazy chunks so contexts are born suspended | existing util, enforce in kit |
| A5 | Self-host Inter/Outfit (drop Google Fonts CDN) — required offline/native, nice for web privacy/perf | `index.html`, assets |
| A6 | Service worker + offline shell (Phase 4) — also derisks the capacitor:// asset serving model by making the app tolerant of no-network | new |
| A7 | Keep hash-based routing for in-app navigation (already the case: `#/singing`) — hash routes are immune to file-server path issues in `capacitor://localhost`; the path-based marketing entries (`/karaoke-night`, `/glass`) are web-only and stay out of the native bundle | no change |
| A8 | Bundle discipline: the native shell ships only the `index` entry; standalone entries (mirror/karaoke/glass HTML) and their alias-copy plugins are excluded from `webDir` | build config at Phase 5 |
| A9 | `beforeinstallprompt`/PWA polish deferred until Phase 4 — PWA is the cheap intermediate distribution while Capacitor matures | plan |

## B. Known WKWebView risks → spike must answer (Phase S, parallel with Phase 1)

Throwaway branch: `npx cap add ios` on a dev machine with Xcode; nothing
committed except findings written back into this doc.

| # | Risk | Test | Expected mitigation if it bites |
| --- | --- | --- | --- |
| B1 | Mic permission flow: `getUserMedia` in WKWebView prompts per the native permission (`NSMicrophoneUsageDescription` in Info.plist) | Start mic on Singing stage; kill/relaunch; deny/re-allow path | Standard Info.plist string + graceful in-app denied-state (we already have `MicInsightHint`) |
| B2 | **Earpiece routing**: enabling mic reroutes playback to the quiet earpiece | Play melody, toggle mic, listen to output level/route | `@capgo/capacitor-plugin-audiosession` `overrideOutput('speaker')` behind `platform/` |
| B3 | **Cold audio session**: first-play stutter in fresh WKWebView (capacitor#8176, unconfirmed) | Cold launch → immediate play; measure first 2s | Pre-activate AVAudioSession natively at startup (plugin or 10-line AppDelegate patch) |
| B4 | Pitch-detection latency: our YIN runs on main thread via `AnalyserNode` + rAF (no AudioWorklet anywhere — verified) | Compare detection latency/jank vs iOS Safari on the same device | Acceptable for v1 (same engine as mobile Safari today); AudioWorklet migration is a separate perf project, not a Capacitor blocker |
| B5 | **Threaded ONNX WASM**: UVR separation uses multi-threaded onnxruntime-web which needs cross-origin isolation (COOP/COEP); header behavior under the custom `capacitor://` scheme is unclear | Load the karaoke local-separation path; check `crossOriginIsolated`, thread count, fallback | Ship single-threaded WASM fallback in native (slower but works), or keep server-side separation as the native path; decide on data |
| B6 | IndexedDB eviction: Dexie data (sessions, songs, groups) lives in WKWebView website storage | Fill DB, background app days-long, check `navigator.storage.persist()` result | If eviction observed: Dexie→`@capacitor-community/sqlite` adapter (native only; web keeps Dexie) |
| B7 | Background audio: screen lock pauses WebAudio/JS timers | Lock mid-practice; observe | v1 policy: practice pauses on lock (acceptable for a practice app); keep-awake via `platform/` during active runs |
| B8 | On-device dev loop: live-reload needs HTTPS on LAN for getUserMedia | Confirm `dev:host` + basic-ssl works from the device inside the shell | mkcert cert for LAN IP (matches existing dev setup) |
| B9 | R2-hosted ONNX models (~MBs) fetched at runtime | Confirm fetch + cache inside shell; measure | Cache API/persistent storage; optionally bundle the small SwiftF0 model, never the UVR model |

## C. Phase 5 — productionization (after stages ship)

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

- No native audio DSP rewrite (web engine is the product).
- No background/lock-screen practice sessions.
- No IAP — billing stays web (Stripe) until store policy forces the issue;
  the native app links out per current App Store external-purchase rules at
  submission time (re-check then — this area moves).

## E. Running the spike (Phase S)

A one-shot harness exists: `scripts/spike-capacitor.sh`. It builds the
local-mode bundle, adds `@capacitor/*`, writes `capacitor.config.ts`,
creates `ios/`, patches `NSMicrophoneUsageDescription`, and opens Xcode.
It is **throwaway** — run it on a `spike/capacitor` branch and discard;
none of what it creates is committed to the mobile PR (the native project
lands in Phase 5, §C).

```sh
git switch -c spike/capacitor
./scripts/spike-capacitor.sh          # macOS + Xcode + CocoaPods
# run the §B smoke tests, record findings in the table below
rm -rf ios capacitor.config.ts && git checkout package.json pnpm-lock.yaml
git switch feat/mobile-first-redesign && git branch -D spike/capacitor
```

For on-device getUserMedia, serve over HTTPS: `pnpm run dev:host` already
uses `@vitejs/plugin-basic-ssl`; set `server.url` in the generated config
to `https://<LAN-IP>:3000` (mkcert if the self-signed cert is rejected).

### Findings (fill in after running)

| # | Risk | Result | Mitigation needed? |
| --- | --- | --- | --- |
| B1 | mic permission flow | _tbd_ | |
| B2 | earpiece routing on mic | _tbd_ | |
| B3 | cold audio-session first-play | _tbd_ | |
| B4 | pitch latency vs iOS Safari | _tbd_ | |
| B5 | threaded ONNX (COOP/COEP) | _tbd_ | |
| B6 | IndexedDB persistence | _tbd_ | |
| B7 | background/lock behavior | _tbd_ | |
| B8 | live-reload HTTPS getUserMedia | _tbd_ | |
| B9 | R2 model fetch + cache | _tbd_ | |

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
    success: () => void Haptics.notification({ type: NotificationType.Success }),
    warning: () => void Haptics.notification({ type: NotificationType.Warning }),
  },
  keepAwake: {
    enable: () => KeepAwake.keepAwake().then(() => undefined),
    disable: () => KeepAwake.allowSleep().then(() => undefined),
  },
  statusBar: {
    setStyle: (s) =>
      void StatusBar.setStyle({ style: s === 'dark' ? Style.Dark : Style.Light }),
  },
  share: (data) => Share.share(data).then(() => true).catch(() => false),
  openExternal: (url) => void Browser.open({ url }),
}
```
