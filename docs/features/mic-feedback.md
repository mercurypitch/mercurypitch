---
doc_id: mic-feedback
title: Mic feedback and insights
area: audio-input
status: current
sources:
  - src/features/mic-feedback/**/*.ts
related:
  - src/stores/mic-store.ts
  - src/stores/settings-store.ts
  - docs/postmortems/mic-state-desync.md
anchor:
  content: sha256:7a49b8a9deaf1b29
  api: sha256:4489802812d27fa2
  files: 4
  reviewed: 2026-07-30
  commit: 6fa4769
---

# Mic feedback and insights

Every tab that listens to the microphone (Singing, Karaoke, Piano, Guitar, Jam)
shares one answer to "why isn't my singing being picked up?". This feature owns
that answer. It does not open or own the microphone — `mic-store` does — it only
interprets what the mic is producing and turns it into a message.

## What it decides

`useMicInsights` reduces raw mic state to a single debounced `MicInsight`:

| Insight | Means |
| --- | --- |
| `none` | A pitch is being read, or the mic is idle and nothing is expected |
| `mic-off` | Playback is running with the mic off, so nothing is heard or scored |
| `no-input` | Mic is on, playback is running, and we hear silence |
| `too-quiet` | We hear audible sound, but too faint for the detector to read a pitch |

The detector is the ground truth. While it produces a pitch the insight is
`none`, regardless of level — a working signal is never worth a warning.

`MIC_INSIGHT_MESSAGE` holds the user-facing copy for each state, so all tabs say
the same thing.

## Debouncing

Three constants keep the messages from flickering:

- `TOO_QUIET_FRAMES` (45, roughly 0.75s at 60fps) — sustained audible-but-unreadable
  frames before warning.
- `NO_INPUT_FRAMES` (90, roughly 1.5s) — sustained silence during playback before
  warning. Deliberately longer, so it does not fire in the gaps between sung notes.
- `MIN_DISPLAY_MS` (1300) — once a warning is surfaced it is held at least this
  long, so it cannot vanish before it can be read.

Level is smoothed with a 0.8/0.2 exponential blend, and `NOISE_FLOOR` (0.01 RMS)
is the line between "silence" and "audible".

The monitor runs a single `requestAnimationFrame` loop that exists only while the
mic is on and the monitor is enabled. It is torn down via `onCleanup`.

## Level measurement

`mic-level.ts` exists so every tab derives amplitude identically:

- `rmsOfTimeData(data)` — RMS (0–1) of a time-domain buffer.
- `rmsOfAnalyser(analyser)` — the same, sampled from an `AnalyserNode`. It reuses
  a module-level scratch `Float32Array` sized to `analyser.fftSize`, because this
  runs about 60 times a second and per-frame allocation there is a real cost.

## Nudges and calibration

`usePlaybackMicNudge` fires at most once per session: when playback starts on a
tab where singing is the point and the mic is off, it shows one toast with an
"Enable mic" action. It never nags again once fired or once the mic is on.

`autoCalibrateSensitivity(getLevel)` samples the ambient level for one second
while asking the user to stay quiet, then maps the average noise floor to a
preset — under 0.01 is `quiet`, under 0.03 is `home`, otherwise `noisy` — and
applies it through `applySensitivityPreset`. The caller must turn the mic on
first; this function does not.

## Dismissal

`micOffHintDismissed` is a persisted signal
(`pitchperfect_mic_off_hint_dismissed`). Once the user dismisses the mic-off hint
via `dismissMicOffHint()`, the `mic-off` insight never surfaces again. The other
three insights are not dismissible — they are transient and always actionable.

## Gotchas

- The `mic-off` state is the only one gated on a persisted preference. If you add
  another dismissible insight, dismissal has to be per-insight or the first one
  silences the rest.
- Both `usePlaybackMicNudge` and the `mic-off` insight can describe the same
  situation. The nudge is a toast with an action; the insight is inline state.
  Wiring both into one surface will say it twice.
