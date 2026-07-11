# Real-Time Vocal Separation & Pitch Analysis — Research Report

**Date:** July 2026 · **Status:** research / no implementation yet
**Question:** How can MercuryPitch do vocal/instrumental separation plus pitch
analysis on *live, running audio* (not an uploaded file), with a budget of a
few seconds of delay? Covers the web app and a possible native iPhone/Android
app.

---

## 1. TL;DR

- The web app is **closer than it looks**: client-side MDX-Net separation
  (ONNX in a Web Worker, WebGPU + WASM fallback) and a real-time pitch stack
  (YIN/MPM/SwiftF0 + causal smoothing pipeline) already exist. The missing
  piece is *streaming plumbing*: a live capture bridge and a sliding-window
  scheduler instead of the whole-file chunker.
- With a "few seconds" budget you do **not** need an exotic causal model.
  Re-running the existing ~6 s MDX window every 1–2 s hop on WebGPU gives
  ~2–5 s end-to-end delay. The gating unknown is the on-device real-time
  factor → benchmark first.
- If the live goal is only the **vocal pitch line** (not audible stems), a
  mixture-trained pitch model (SPICE-style) or a cheap DSP pre-clean in front
  of YIN gets sub-second results for a fraction of the work.
- **Native mobile is where the full vision becomes real.** Phone NPUs (Apple
  Neural Engine, Snapdragon Hexagon) run separation models many times faster
  than browser WASM — Moises Live already ships exactly this (on-device,
  real-time, system-audio) on desktop NPUs. On **Android** you can capture
  other apps' audio (`AudioPlaybackCapture`) *and* draw a floating overlay on
  top of them — the "pitch line over YouTube" experience is fully buildable.
  On **iOS** system-audio capture and cross-app overlays are locked down, so
  the realistic modes are mic pickup, in-app playback, or a
  Picture-in-Picture window.

---

## 2. What MercuryPitch already has (relevant inventory)

| Piece | Where | Notes |
|---|---|---|
| MDX-Net separation in browser | `src/workers/vocal-separator.worker.ts` | `UVR-MDX-NET-Inst_HQ_3.onnx` (63.6 MB, R2-served, IndexedDB-cached), STFT → ONNX → complex-domain subtract (vocal = mix − instrumental), WebGPU EP with WASM fallback |
| Offline chunker | `src/lib/audio-chunker.ts` | ~5.9 s windows (261 120 samples), Hanning overlap-add — whole-file only, **this is the piece to make streaming** |
| STFT engine | `src/lib/stft-engine.ts` | Reusable forward/inverse STFT (Hann) |
| Pitch detectors | `src/lib/pitch-detector.ts`, `src/lib/swift-f0-detector.ts` | YIN + MPM (real-time, main thread) and SwiftF0 ONNX (389 KB, 16 kHz) |
| Causal pitch pipeline | `src/lib/pitch-pipeline/live-pitch-pipeline.ts` | Voicing gate → octave correction → running median → One-Euro → note state machine |
| Live "pitch vs stem" loop | `src/features/stem-mixer/useStemMixerAudioController.ts:636` | Already runs YIN on a separated vocal stem and the mic simultaneously with cents delta |
| Mic capture | `src/lib/mic-manager.ts` | Ref-counted singleton, analysis-grade constraints (no AEC/NS/AGC) |
| Server GPU tier | `runpod/handler.py`, `src/lib/uvr-processing-pipeline.ts` | BS-RoFormer / MDX / Mel-RoFormer karaoke / ensemble on RunPod, ~7–16× real time on RTX 4090 |
| Cross-origin isolation | `public/_headers`, `vite.config.ts` | COOP `same-origin` + COEP `credentialless` already shipped → threaded WASM / SharedArrayBuffer OK |

**Gaps for live audio:** no AudioWorklet anywhere (live analysis is
main-thread `AnalyserNode` + rAF), no `getDisplayMedia` (tab/system audio),
separation path is strictly whole-file.

---

## 3. Where the live audio comes from (browser)

1. **Microphone** — already handled (`mic-manager.ts`). Works everywhere, but
   separating music that went speaker → room → mic costs quality.
2. **Tab / system audio, `getDisplayMedia({ audio: true })`** — the natural
   source for "a song is playing on my machine". Tab-audio capture is solid
   in Chrome/Edge; system-wide audio is effectively Windows-only; Safari and
   Firefox are weak. Currently unused in the app — small greenfield addition.
   (Virtual loopback devices — BlackHole, VB-Cable — appear as microphones
   and need zero code.)
3. **Audio played by MercuryPitch itself** — no true streaming needed: start
   playback and separation together; when separation runs faster than real
   time it stays ahead of the playhead and stems/pitch appear progressively a
   few seconds behind. Cheapest path if in-app playback covers the use case.

---

## 4. Options — web app

| # | Approach | End-to-end delay | Quality | Effort |
|---|---|---|---|---|
| 0 | DSP pre-clean (center-channel / HPSS) + existing pitch detector | < 100 ms | Poor as audio, decent as pitch front-end | Days |
| A | **Sliding-window streaming with the existing MDX worker (WebGPU)** | ~2–5 s | Same as current local separation | 1–2 weeks |
| B | Mixture-trained pitch model on the mix (SPICE-style), no stems | < 0.5 s | Pitch only | ~1 week |
| C | True causal low-latency model (HS-TasNet / RT-STT / streaming Open-Unmix) | 20 ms – 1 s | Below MDX (SDR ≈ 4.5–5.5) | High (training/porting) |
| D | Server-side streaming via the existing RunPod path | ~3–6 s + network | Best (BS-RoFormer class) | Medium + $/min |

### Option 0 — instant DSP front-end

Center-channel extraction (vocals are usually mid-panned: `side = L − R`
kills them, `mid − k·side` boosts them) and/or harmonic–percussive
separation, then YIN/SwiftF0. Zero model cost, real-time, and a good
permanent pre-filter in front of any pitch detector. Not usable as an
audible stem.

### Option A — reuse the MDX model, change the scheduling (recommended)

Keep the model; make the chunker a ring buffer:

1. **Capture bridge:** a tiny `AudioWorkletProcessor` (or
   `MediaStreamTrackProcessor` on Chromium) posts fixed-size blocks into the
   separation worker. COOP/COEP is already shipped, so a SharedArrayBuffer
   ring buffer is available.
2. **Sliding window:** every hop *H* (1–2 s), run the model on the most
   recent ~6 s window (its native 256-frame size), overlap-add, and emit only
   the newest *H* seconds of vocal stem.
3. **Pitch:** feed emitted slices into the existing
   `live-pitch-pipeline.ts`; render with a fixed timestamp offset so the
   piano-roll aligns with what the user hears.

**Latency budget:** `delay ≈ H + T_inf + margin` where `margin` ≈ 0.5–1 s of
future context to avoid edge artifacts at the window's trailing edge. With
H = 1 s and WebGPU inference T_inf ≈ 0.5–1 s → **~2–4 s**.

**Compute cost:** each audio second is processed `window / hop` ≈ 3–6×. The
whole scheme lives or dies on the **real-time factor**: WebGPU must chew a
6 s window in well under H. Browser ports of comparable models (demucs-web,
freemusicdemixer) confirm WebGPU is viable while plain WASM runs several
times *slower* than real time — so the WASM fallback is offline-only, and
the feature gets gated behind a quick on-device RTF probe.

### Option B — pitch without stems

SwiftF0 and YIN are monophonic-oriented; on a full mix they chase whatever
is loudest. Google's SPICE was trained specifically for singing over backing
instruments, runs real-time on CPU, and has a JS-ready model. A
melody-extraction model (or Option 0's pre-filter in front of the existing
detectors) gives an instant live pitch line; Option A can deliver the
audible stem a few seconds later. A and B compose well.

### Option C — true low latency (only if sub-second becomes a requirement)

HS-TasNet (L-Acoustics, 23 ms latency, real-time on CPU, commercialized via
GPU Audio) and RT-STT (Nov 2025, quantized single-path TFC-TDF UNet, −82.6 %
inference time) prove feasibility, but **no public pretrained weights**
exist (lucidrains' repo is architecture-only), and quality sits well below
the current MDX model. Streaming Open-Unmix (causal LSTM, ~4 ms inference
per 11 ms hop on 4 CPU cores) is the only weights-attainable route and still
needs training work. Not worth it for a few-seconds budget.

### Option D — RunPod streaming

Chunk live capture into 2–3 s segments over a WebSocket to the existing
RunPod tier (7–16× real time on a 4090) → BS-RoFormer-quality stems ~3–6 s
behind live. Caveats: serverless cold starts blow the latency budget, so a
warm worker must run for the whole session — a paid/premium-shaped feature
versus the local-first options.

---

## 5. Native iPhone / Android app

The question: gather audio *from the phone itself* (whatever the phone is
playing), separate locally in near-real-time, and overlay results on top of
another app.

### 5.1 Why native changes the game

Phone NPUs are the hardware Moises Live already targets on desktop: it runs
**entirely on-device, in real time, on system audio**, crediting Apple
Neural Engine / Snapdragon NPUs at "up to 35× faster than CPU". Apple's own
Music Sing feature (adjustable vocal level, requires A13 Bionic or newer)
points the same direction, and MDX-Net vocal separation has been shown
running on-device on iPhone via ONNX/Core ML. Compared to browser WASM, a
phone NPU turns the 6 s MDX window from "several times slower than real
time" into "a fraction of a second" — the same sliding-window architecture
as web Option A, but with headroom to spare, plus lower capture latency and
no tab-capture friction.

Big practical bonus: **the exact same `UVR-MDX-NET-Inst_HQ_3.onnx` asset can
ship on all three targets** via ONNX Runtime — Web (WebGPU/WASM), iOS
(Core ML execution provider), Android (QNN/NNAPI execution provider). One
model, three runtimes. SwiftF0 (389 KB ONNX) ports the same way, and the
causal pitch pipeline (One-Euro, median, note state machine) is a few
hundred lines of portable logic.

### 5.2 Capturing "the phone's audio"

**Android — genuinely possible.**
- `AudioPlaybackCapture` (API 29+, Android 10): capture other apps' audio
  via a `MediaProjection` consent dialog. Requires `RECORD_AUDIO` +
  foreground service (`foregroundServiceType="mediaProjection"` on
  Android 14+).
- Limits: only players with usage `MEDIA` / `GAME` / `UNKNOWN` and capture
  policy `ALLOW_CAPTURE_BY_ALL` are capturable. Apps can opt out
  (`ALLOW_CAPTURE_BY_NONE`) — DRM-heavy apps (Spotify, Netflix) do, and come
  through as **silence**; YouTube and most media/game apps have historically
  been capturable. Opt-out status is per-app and can change.
- Mic fallback is always available for the karaoke-in-the-room scenario.

**iOS — locked down; design around it.**
- There is **no general system-audio capture API**. The only system-wide
  hook is a ReplayKit **Broadcast Upload Extension** (user starts a screen
  broadcast; the extension receives app-audio + mic sample buffers).
- Two hard constraints: the extension has a **50 MB memory ceiling** — the
  63 MB MDX model cannot live there, so audio must be relayed (App Group
  shared memory / local socket) to the main app for inference — and
  DRM/`AVPlayer`-based playback (Apple Music, Safari FairPlay video) arrives
  **muted**.
- Realistic iOS modes, in order of practicality:
  1. **MercuryPitch plays the audio itself** (local files / its own catalog)
     — full-quality pipeline, zero capture problems.
  2. **Mic pickup** while another app/speaker plays
     (`AVAudioSession` `.playAndRecord` + `.mixWithOthers`) — universal, no
     DRM issues, modest quality loss.
  3. **Broadcast extension relay** — for power users; fragile and
     review-sensitive.

### 5.3 Overlay on top of another app

- **Android: yes.** `SYSTEM_ALERT_WINDOW` ("Display over other apps") allows
  a floating, always-on-top window (chat-heads pattern). A slim live pitch
  ribbon over YouTube/karaoke apps + capture service + NPU inference =
  the full vision, all on-device.
- **iOS: no cross-app overlays.** Nearest equivalents:
  - **Picture-in-Picture window** rendering a custom pitch view
    (`AVSampleBufferDisplayLayer` technique used by teleprompter-style apps)
    — floats over other apps but is an App Store review gray zone;
  - Live Activities / Dynamic Island — low-frequency updates only, fine for
    "session running / current note", not for a live scrolling graph;
  - iPad Split View / Stage Manager side-by-side.

### 5.4 App architecture options

| Route | Reuse of current code | Effort | Notes |
|---|---|---|---|
| **Capacitor/WebView wrapper + native plugins** | Very high (whole SolidJS UI) | Medium | Plugins bridge: playback-capture (Android), native ONNX Runtime inference, overlay window. WebView itself can't capture system audio — the plugin feeds PCM into the web layer or keeps DSP native. |
| **Full native (SwiftUI / Jetpack Compose) + shared core** | Pitch/DSP logic ported or compiled (C++/Rust core, or Kotlin Multiplatform) | High | Best latency, battery, and store-review posture; UI rebuilt per platform. |
| **React Native / Flutter** | Medium (logic ports, UI rebuilt once) | Medium-high | Same native audio plugins required as Capacitor; buys little over it given the web app already exists. |

**Recommended pilot: Android-first Capacitor build.** Android is where the
differentiating capabilities live (playback capture + overlay), the existing
web app runs nearly unchanged inside the WebView, and the two native plugins
(capture service, ORT-with-QNN inference) are well-scoped. iOS follows with
the reduced scope (in-app playback + mic modes, optional PiP overlay).

### 5.5 Mobile-specific risks

- **Battery/thermals:** continuous capture + NPU inference for a whole
  practice session needs a power budget pass (duty-cycling the separator,
  e.g. only while the pitch view is visible).
- **Fragmentation (Android):** NNAPI/QNN coverage varies; mid-range phones
  may fall back to CPU at 2–5× slower — same RTF-probe gating as web.
- **Store review:** Android's `SYSTEM_ALERT_WINDOW` + MediaProjection combo
  is established but scrutinized; iOS custom-content PiP is a known gray
  zone.
- **DRM reality:** capture-based modes silently fail on opted-out apps —
  the UX must detect silence and steer users to mic mode.

---

## 6. Suggested roadmap

1. **RTF benchmark (afternoon):** measure the existing separator worker's
   real-time factor on WebGPU vs WASM across a few machines; decides hop
   size and gating for everything else.
2. **Web streaming MVP (1–2 weeks):** AudioWorklet capture bridge → ring
   buffer → sliding-window mode in `vocal-separator.worker.ts` (reuse the
   Hanning overlap-add) → live vocal slices into `live-pitch-pipeline.ts`.
   Input: mic + in-app playback.
3. **Instant pitch layer:** Option 0 pre-filter and/or a SPICE-class model
   so the pitch line is live even before the first separated slice lands.
4. **Tab capture (Chromium):** `getDisplayMedia({ audio: true })` as a new
   input in `mic-manager.ts`'s pattern.
5. **Android Capacitor pilot:** playback-capture plugin + ORT/QNN inference
   plugin + overlay ribbon; reuse the same ONNX assets.
6. **iOS follow-up:** in-app playback + mic modes, evaluate PiP overlay.

---

## 7. Sources

**Real-time separation research**
- HS-TasNet paper — <https://arxiv.org/abs/2402.17701> ·
  [L-Acoustics PDF](https://www.l-acoustics.com/wp-content/uploads/2024/04/real_time_demixer_2024_04_19.pdf) ·
  [architecture-only implementation](https://github.com/lucidrains/HS-TasNet)
- RT-STT, "Towards Practical Real-Time Low-Latency Music Source Separation" —
  <https://arxiv.org/abs/2511.13146>
- GPU Audio real-time separation module —
  <https://www.gpu.audio/newsfeed/real-time-source-separation-is-here-76>
- Streaming Open-Unmix —
  <https://github.com/tommy-fox/streaming-source-separation>

**Browser implementations**
- demucs-web (HTDemucs via onnxruntime-web, WebGPU/WASM) —
  <https://github.com/timcsy/demucs-web>
- free-music-demixer (demucs.cpp → WASM) —
  <https://github.com/sevagh/free-music-demixer> ·
  [multi-threading discussion](https://news.ycombinator.com/item?id=38840776)
- SPICE pitch model — <https://www.tensorflow.org/hub/tutorials/spice> ·
  [TensorFlow blog](https://blog.tensorflow.org/2020/06/estimating-pitch-with-spice-and-tensorflow-hub.html)
- MDX-Net ONNX model sizes (21–66 MB) —
  <https://github.com/set-soft/AudioSeparation>

**Mobile platform**
- Android playback capture —
  <https://developer.android.com/media/platform/av-capture> ·
  [Android Q audio capture blog](https://android-developers.googleblog.com/2019/07/capturing-audio-in-android-q.html)
- Apple ReplayKit — <https://developer.apple.com/documentation/ReplayKit> ·
  [50 MB broadcast-extension limit](https://developer.apple.com/forums/thread/651367) ·
  [AVPlayer/Music audio not captured](https://github.com/twilio/video-quickstart-ios/blob/master/ReplayKitExample/README.md)
- Moises Live (on-device real-time system-audio separation, NPU) —
  <https://moises.ai/products/live/> ·
  [launch coverage, "35× faster on NPU"](https://www.recordoftheday.com/news-and-press/moises-live-real-time-audio-control-for-all-your-apps)
- MDX-Net vocal splits on-device with ONNX/Core ML (iPhone) —
  <https://web.navan.dev/posts/2025-10-26-vocal-separation-and-rvc-onnx-coreml.html>
