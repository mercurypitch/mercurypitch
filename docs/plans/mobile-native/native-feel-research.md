# Native-feel web apps — research (2026-07-18)

Method: multi-angle web research (5 search angles, ~20 sources fetched, 75
falsifiable claims extracted with quotes) + inline review of every claim
against platform documentation. The formal multi-agent adversarial pass was
skipped to save tokens; load-bearing browser-support numbers below come from
caniuse/MDN/WebKit/Apple primary pages fetched on 2026-07-18. Confidence is
noted where a claim is user-reported or self-promotional.

## 1. Edge-to-edge & safe areas (the foundation)

- Without `viewport-fit=cover`, iOS auto-insets the page inside the safe area
  — you literally cannot draw a full-bleed tab bar. With it, the page goes
  edge-to-edge and `env(safe-area-inset-*)` becomes responsible for avoiding
  the notch/home indicator. [WebKit "Designing Websites for iPhone X"]
  → Confirms the Phase-0 prerequisite: our `index.html` lacks it today.
- Canonical padding pattern: `padding-left: max(12px, env(safe-area-inset-left))`
  — insets resolve to 0 in many orientations, so they complement, not
  replace, design minimums. Our `--safe-*` tokens should be consumed through
  `max()`.
- `overscroll-behavior` is in all majors since Safari 16 (2022) — rubber-band
  scroll-chaining under sheets/stages is solvable in pure CSS. The proven
  iOS body-lock recipe: fixed full-viewport holder > an always-scrollable
  (content forced 1px taller) `overflow-y:auto; overscroll-behavior:none`
  layer > sticky content. ~30 lines, framework-agnostic — port into our
  `useScrollLock`/`StageShell` instead of the current
  `document.body.style.overflow` mutation. [stripearmy/react-ios-scroll-lock
  technique; package is React-only, pattern is not]

## 2. Keyboards & fixed bottom bars

- `position:fixed; bottom:0` anchors to the *layout* viewport; the on-screen
  keyboard shrinks only the *visual* viewport → bottom bars vanish under the
  keyboard. The `VirtualKeyboard` API (+ `env(keyboard-inset-height)`) fixes
  this but is **Chromium-only** (no WebKit signal) — on iOS the fallback is
  the `visualViewport` API. [bram.us; htmhell interactive-widget]
  → Our stages are mostly input-free by design (good); the song-sheet search
  field and any sheet inputs must use a `visualViewport`-aware sheet variant.
  We currently use `visualViewport` nowhere.

## 3. iOS design language worth copying (HIG + Liquid Glass, iOS 26 era)

- **Tab bar**: floats above content on translucent material; navigation
  only — never actions (transport stays in our TransportBar, not the tab
  bar). No hard "max 5 tabs" rule exists; the guidance is "fewer is easier"
  and avoid overflow ("five or fewer" appears only for iPadOS customizable
  defaults). Tab bar may minimize on scroll; the **mini-player is now a
  sanctioned tab-bar accessory** (Apple Music pattern) — a natural v2 slot
  for a persistent practice transport. [Apple HIG tab bars; WWDC25 design
  session]
- **Sheets**: system detents medium (~half) and large; grabber for resizable
  sheets; half-height sheets are inset from the edges with content peeking
  through; more opaque when expanded; full-screen modal for long flows.
  Action sheets now spring from their source element, not always the bottom.
  → Our `Sheet` primitive: two snap points, grabber with real drag-dismiss,
  edge inset at `snap:'content'`.
- **Type & touch**: SF ramp reference points — Body 17pt, Large Title 34/41pt;
  11pt floor; controls default 44×44pt with 28pt minimum plus ~12-24pt
  spacing to prevent mis-taps. → Our stage type ramp maps to
  17px body / 34px large title; `--touch-target: 44px` confirmed.
- **Liquid Glass**: glass belongs to the floating chrome layer ONLY — Apple
  explicitly warns against glassing content and against glass-on-glass.
  Concentric corner radii (capsule = height/2; child radius = parent −
  padding), scroll-edge blur instead of divider lines. Legibility criticism
  is real (refraction-based contrast) — keep our `.glass` surfaces
  high-contrast, honor reduced-transparency. WKWebView gets **none** of this
  from the system; we hand-build it — which we already do (karaoke stage).
  [Apple "Adopting Liquid Glass"; WWDC25; CSS-Tricks]

## 4. Motion & rendering support matrix (verified against caniuse 2026-07-18)

| Capability | Chromium/Android | iOS Safari & WKWebView | Use as |
| --- | --- | --- | --- |
| View Transitions (same-doc) | Chrome 111+ (2023), Android WebView current | **iOS 18+** | Progressive enhancement for tab/stage transitions; ~88% global support, plain swap fallback |
| Scroll-driven animations (`animation-timeline: scroll()`) | Chrome 115+ | **iOS 26+ only** (Safari 26, Sept 2025) | Collapsing large-title headers: CSS-only on new devices, tiny rAF fallback below iOS 26 |
| WebGPU | Chrome 113+ default | **iOS 26+ default** (17.4–18.x flag-gated) | Glass feature's typegpu renderer needs its canvas2d fallback on iPhones ≤ iOS 25; don't build mobile-stage chrome on WebGPU |
| `overscroll-behavior` | yes | Safari 16+ | Rely on it freely |
| VirtualKeyboard API | Chromium only | no | `visualViewport` fallback on iOS |

## 5. Architecture & libraries

- Practitioner consensus matches our interview decision: purpose-built
  mobile shells for app-like surfaces + responsive CSS for content surfaces;
  "adaptive" beats "responsive" when the two form factors have different
  interaction models. [browserstack guide; gfor.rest native-feel guide]
- **Konsta UI**: components-only, Tailwind-first — composable with any
  stack, but we don't use Tailwind and our kit needs ~10 primitives we
  mostly already have proven in KaraokeMobileStage. **Framework7/Ionic**:
  bundle routers/app-shells that fight SolidJS's own routing (documented
  migration pain: F7 → Konsta over routing). → **Hand-roll the kit**
  (decision stands); steal specs, not dependencies. [konsta discussion #107;
  evolvenova comparison; medium "Why Ionic Sucks" — opinionated source,
  weight accordingly]
- Capacitor ships an **official SolidJS + Vite template** (Ionic blog) — the
  wrap path is first-class, no framework adapter needed.

## 6. Capacitor for an audio app (the risk register)

- **Cold AVAudioSession**: first WebRTC/Web Audio playback in a fresh
  WKWebView can stutter (session spins up cold; Safari's is pre-warmed).
  Open, maintainer-unconfirmed report (capacitor#8176, repro repo) —
  *medium confidence, spike must test first-play behavior*. Mitigation
  pattern: pre-activate the audio session natively at startup.
- **Earpiece routing**: enabling the mic on iOS reroutes output to the quiet
  earpiece — the classic getUserMedia+playback quirk. Mitigation:
  `@capgo/capacitor-plugin-audiosession` (maintained, v8 line tracks
  Capacitor 8) exposes route changes/interruptions and `overrideOutput` to
  force the speaker. iOS-only plugin; Android no-ops. Its "only free
  maintained option" claim is self-promotional — verify alternatives at
  spike time. (WebKit bug 167788 — WKWebView ignoring AVAudioSession
  category — is the long-running upstream backdrop.)
- **Storage**: WKWebView IndexedDB is evictable browser storage;
  `@capacitor-community/sqlite` (active, v8.x 2026) is the standard native
  escape hatch — but on web it's sql.js persisted into IndexedDB anyway, so
  it only helps native builds. Sequencing: keep Dexie + our existing
  `requestPersistentStorage()`; adopt a Dexie→SQLite adapter only if spike
  shows real eviction risk. SQLCipher encryption exists if needed
  (note: US export-compliance paperwork).
- **Live-reload dev**: on-device getUserMedia/WebRTC testing requires the
  dev server over **HTTPS on the LAN IP** (mkcert) — matches our existing
  `dev:host` + basic-ssl setup, carry it into the Capacitor workflow.

## 7. What we're NOT adopting (and why)

- System-font-only typography: brand keeps Inter/Outfit; we mirror the SF
  *scale*, not the face (self-host fonts at Capacitor time).
- Konsta/Ionic/F7 dependency: kit is hand-rolled (above).
- VirtualKeyboard API: Chromium-only; `visualViewport` covers both.
- Liquid-Glass-everywhere: glass restricted to chrome per Apple's own
  guidance; content stays flat and legible.

## Sources (fetched 2026-07-18)

Primary: WebKit blog (iPhone X safe areas; scroll-driven animations guide),
Apple HIG (tab bars, typography, accessibility/touch targets, sheets),
Apple "Adopting Liquid Glass" + WWDC25 session 356, Capacitor docs (UI,
storage), caniuse (view-transitions, animation-timeline scroll(), WebGPU),
MDN (Web Audio visualizations), Ionic blog (SolidJS+Vite templates).
Secondary/practitioner: bram.us (VirtualKeyboard), htmhell
(interactive-widget), stripearmy (iOS scroll lock), CSS-Tricks + learnui
(Liquid Glass analysis), gfor.rest (native-feel guide), browserstack
(adaptive vs responsive), konsta discussion #107, evolvenova (UI-lib
comparison). Issue trackers: capacitor#8176, capacitor#5071 (Xcode 13
getUserMedia AbortError — historical), WebKit bug 167788, Cap-go
audiosession, capacitor-community/sqlite.
