# Coda Echo and musical memories — implementation checkpoint

The existing three completed gallery portraits offer an optional Coda Echo.
This does not add a campaign level or replace any lesson, exit or star result.
The same encore is reachable later from its earned portrait in the collection.

## Delivered behavior

- Shared validated contour drives drawing, reference sound and live pitch judging.
  Four configurable 3/5/7/10-note sketches; editable feel, pace, root, note offsets,
  transition types, breath boundaries and judge policy. Beginner defaults remain.
- Comfortable-note calibration uses the existing microphone owner. Reference audio
  ends before judged capture and before any recording begins. Backgrounding,
  closing and changing shape cancel capture; no automatic microphone restart.
- Recording is off by default every visit. Explicit consent records the owned
  microphone stream only. A visible elapsed indicator and Stop control make the
  recording state clear. Bounded 45-second/12-MB takes; failed/empty recordings
  never become saved audio. Completion survives all recording outcomes.
- Listen, stop, download, save/replace and delete operate locally. IndexedDB stores
  one chosen take per gallery in the host namespace. Unsaved takes remain in
  memory only. Save failures preserve the candidate for download/retry. Playback
  uses the shared audio context, quiet handoff and soft release, with cancellation
  even if decoding is still pending. No upload path is introduced.
- Completing a coda earns a cosmetic seal and a brief light celebration. Collection
  focus returns to the opener after nested playback closes; the background is inert.
- Opaque encore/collection overlays suspend the covered Three.js renderer. The
  hidden world previously caused 0.6–0.9-second capture gaps under software WebGL;
  freezing it made the actual PCM test pass without weakening judge tolerances.

## Evidence

- 64 focused tests across compiler, judge, catalogue, reference player, practice
  controller, voice session/recorder, IndexedDB store and memory/playback lifecycle.
- Actual oscillator PCM enters the shared pitch engine in the browser test; no
  fabricated judge result. It checks no recording before consent, no scoring from
  reference sound, post-guide recording start, microphone release, save/reload,
  album access, playback/stop/delete, keyboard focus and preserved lesson completion.
- Browser suite: `e2e/glass-adventure-encore.e2e.ts`, passed on Chromium.
- 320/768/1440 screenshots and the passing pitch trace are archived under
  `art/glass-adventure/proofs/encore-2026-09-24/`. The earlier failed trace is retained
  there as the diagnosis, not as an accepted result. This suite suppresses WebGL
  draw calls to isolate audio/UI; portrait world proofs are a separate real-Three run.

## Remaining within stage 8

Original sung Merc D2 examples are being produced and pitch-audited separately
under `voice/v5-encores/`. The current teaching reference is a calibrated tone
contour. Do not describe the unreviewed raw singing takes as accepted instruction.
Human feel tuning and physical-device testing follow the complete 1–8 batch.
