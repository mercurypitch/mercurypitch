# Postmortem: microphone state desyncs

Date: 2026-07-26. Status: fixed (this PR). Severity: user-facing on prod
(reported), no data loss.

## What users saw

A prod user reported two contradictory mic states on the singing page:

1. The mic icon showed **on** while the mic was actually dead (no
   detection, no meter movement).
2. The mic icon showed **off** while the live pitch visual was actively
   tracking their voice.

Neither state recovered on its own; only manual toggling (sometimes a
reload) resolved it.

## Architecture background

`src/lib/mic-manager.ts` is the app-wide, reference-counted owner of the
capture device. Consumers (`audio-engine-N` for the shared engine behind
singing/compose/exercises/piano/guitar/analysis, `stem-mixer` for
karaoke, plus the standalone mirror/glass pages) `acquire()`/`release()`
holds; the manager opens/closes the hardware, keeps a short linger
between pages, and serializes open/close to avoid device races.

Each surface, however, drives its mic **icon from a local boolean set at
toggle time** (`micActive`, `micOn`, `isRecording`…).

## Root causes

1. **The manager announced state changes to nobody.** It emits on every
   teardown — OS revoking the track (unplug, another app, mobile
   backgrounding) or a device switch — but `micManager.subscribe()` had
   **zero production callers**. Every local boolean stayed wherever the
   last toggle left it. This is symptom 1: icon on over dead tracks —
   and in karaoke it also kept feeding silent frames into the score.
2. **The practice engine healed state silently.** `isMicActive()`
   copied the engine's recording flag over its own **without emitting**
   `onMicStateChange` — but that emit is the only writer of the global
   icon signal. A raced start (toggle + mic-nudge + auto-calibrate all
   funnel into `startMic` with no in-flight guard) could leave the
   signal off while the engine recorded; the "heal" then preserved the
   contradiction every frame. This is symptom 2: icon off, pitch visual
   live. (A past commit throttled the mismatch *warning* instead of
   fixing the mismatch.)
3. **Phantom holds.** Failure paths after a successful `acquire()`
   returned without releasing (audio-engine's missing-context branch;
   the stem-mixer unmounting while an acquire was in flight — playlist
   advances remount it per song). A leaked hold keeps the device open
   forever with every icon off.
4. **Global side effects from page-local UI.** The guitar page's
   persisted input device was applied at **app boot** (its provider
   wraps the whole app), silently redirecting capture for every surface
   toward an instrument interface that may not even be plugged in — and
   `setPreferredDevice` tears down the shared stream under every other
   holder with no notification.
5. **A capture path outside the manager.** The (dev-oriented) pitch
   testing tab used raw `getUserMedia` and leaked its tracks on unmount
   — a hot mic invisible to the app.

## Fixes (this PR)

- **Reconciliation backbone.** The audio engine subscribes to the
  manager: if the shared stream dies while recording, it resets itself,
  drops its stale hold, and fires a new `onMicLost` hook. The practice
  engine, guitar, and piano wrappers propagate that into their signals
  (and the global icon signal) with a visible notification; the
  stem-mixer controller does the same internally. The silent
  `isMicActive()` heal now **emits**.
- **Leak/race fixes.** `startMic` is re-entrancy-safe (concurrent calls
  share one start) and every post-acquire failure path releases the
  hold; the stem-mixer releases unconditionally on unmount and aborts an
  acquire that resolves after disposal; its toggle ignores taps while
  one is in flight.
- **Scoped device preference.** The guitar input device is applied on
  entering the guitar surface and restored to the default on leaving —
  it no longer hijacks capture app-wide at boot.
- **Ownership hygiene.** Analysis modals only stop a mic they started;
  the guitar tuner's auto-started mic stops on mode leave; guitar/piano
  toggles surface acquire failures instead of doing nothing; the pitch
  testing tab tears its raw stream down on unmount; the zen playlist's
  Start arms the mic like desktop does.
- **MicSentinel** (`src/lib/mic-sentinel.ts`). Surfaces register the
  accessor behind their mic icon. A 3-second watchdog compares icons vs
  manager holds vs actual `MediaStreamTrack` liveness; any mismatch that
  survives two ticks is reported once to the console with a full state
  dump, and the unambiguous case (icon on, no live track) is
  self-healed through the surface's own off path.
  `window.__micSentinel.dump()` prints the state for bug reports.

## Regression guards

- `src/tests/mic-sentinel.test.ts` — the comparison invariants,
  including both prod symptoms verbatim (icon-on/stream-dead,
  live-without-ui) and the non-mismatch cases (linger window,
  unregistered standalone holders).
- `src/tests/mic-reconciliation.test.ts` — startMic failure paths
  release the hold; concurrent starts share one acquire; the mismatch
  heal emits; `onMicLost` fires on stream death while recording.
- `src/tests/mic-manager.test.ts` — the pre-existing manager contract.

## What to watch

Any `[MicSentinel]` warning in the console is a state desync that the
old code would have shipped silently — please report it with the
`window.__micSentinel.dump()` output. New mic-consuming surfaces must
acquire through the manager and register their icon with
`registerMicIndicator`.
