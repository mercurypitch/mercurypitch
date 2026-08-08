# Microphone Latency — EARS Requirements

Requirements for measuring the speaker-to-microphone round trip and applying
it wherever sung pitch is aligned to a reference timeline.

**Source:** `src/lib/mic-latency.ts` — onset detection and the run summary;
`src/lib/calibration-stats.ts` — the statistics, shared with
[tap calibration](../../src/lib/tap-calibration.ts);
`src/features/mic-feedback/MicLatencyWizard.tsx` — capture, playback and copy;
`src/stores/mic-latency-store.ts` — the per-device offset;
`src/lib/practice-engine.ts` and
`src/features/stem-mixer/useStemMixerMicController.ts` — the two consumers
**Tests:** `src/lib/mic-latency.test.ts`,
`src/tests/mic-latency-store.test.ts`, `src/tests/practice-engine.test.ts`

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Measurement — `REQ-ML-001..007`

### REQ-ML-001 — What is measured

The wizard **shall** measure the full round trip: the interval between a click
being **scheduled** for output and the same click being observed in captured
audio. Output buffering, the speaker, the air and the capture buffer are all
part of the answer, because all of them delay a sung note the same way.

### REQ-ML-002 — One clock

Scheduling and capture **shall** be timed on a single `AudioContext` clock, so
the subtraction in `REQ-ML-001` compares two points on the same time base.

### REQ-ML-003 — Distinct from reaction calibration

The reference **shall** be the scheduled click time with no `outputLatency`
added. This is the opposite of `tap-calibration`, which adds it deliberately
so that a human reaction time excludes the device's own delay.

### REQ-ML-004 — Median of a click train

The reported latency **shall** be the median gap over a train of clicks, not a
single measurement, and **shall** be reported in whole milliseconds.

### REQ-ML-005 — Relative onset thresholds

Onset detection **shall** threshold relative to the recording's own peak and
noise floor. How loud a click returns depends on the speaker volume and the
distance to the microphone, so an absolute level would only ever suit one room.

### REQ-ML-006 — One onset per click

A single click **shall** produce at most one onset, however many analysis
windows it spans.

### REQ-ML-007 — Confidence is reported

The wizard **shall** report how many clicks were matched and the interquartile
spread of their gaps, so a noisy run is visible as such rather than presented
as a precise number.

## Refusals — `REQ-ML-008..011`

A wrong offset is worse than no offset, so every doubtful run produces a
reason rather than a number.

### REQ-ML-008 — Nothing heard

**IF** the recording holds nothing standing out from its own noise floor,
**THEN** the wizard **shall** report that the clicks were not heard and suggest
speakers rather than headphones.

### REQ-ML-009 — Too few matches

**IF** fewer than four onsets line up with a click, **THEN** the wizard
**shall** refuse to report a latency.

### REQ-ML-010 — Implausible result

**IF** the median gap is zero, negative, or above 500 ms, **THEN** the wizard
**shall** refuse to report a latency.

### REQ-ML-011 — Onsets before their click are dropped

A gap **shall** be discarded when negative: a click cannot return before it is
played, so such an onset is something else in the room.

## Storage — `REQ-ML-012..015`

### REQ-ML-012 — Per input device

The offset **shall** be stored against the microphone it was measured on. A
USB interface and a built-in microphone differ by more than the offset itself.

### REQ-ML-013 — Default input has a key

**WHERE** no device has been chosen explicitly, the offset **shall** be stored
under a key standing for the operating system's default input.

### REQ-ML-014 — Unmeasured means zero

**WHEN** an input has never been measured, its offset **shall** be zero.

### REQ-ML-015 — Clearable

The user **shall** be able to clear the current input's offset, which
**shall** leave every other input's offset untouched.

## Application — `REQ-ML-016..020`

### REQ-ML-016 — Zero changes nothing

**WHILE** the offset is zero, every consumer **shall** behave exactly as it did
before latency compensation existed. This is the property that keeps an
unmeasured device safe.

### REQ-ML-017 — Practice scoring

**WHILE** an offset is set, the practice engine **shall** attribute a pitch
frame to the note that was the target one round trip earlier, not the note
that is the target when the frame arrives.

### REQ-ML-018 — No note is dropped

**WHEN** a run ends with note starts still queued behind the offset, the engine
**shall** still produce a result for each of them.

### REQ-ML-019 — A new run discards the queue

**WHEN** a session starts, any note starts queued from a previous run
**shall** be discarded.

### REQ-ML-020 — Karaoke scoring

**WHILE** an offset is set, the karaoke mic comparison **shall** judge a mic
frame against the reference pitch from one round trip earlier. Frames arriving
before the song has run that long **shall** be dropped rather than mis-scored.

## Not specified here

The stem mixer's own alignment offset — the LRC-first lyric and stem
alignment — is a separate mechanism with a separate purpose, and is not
affected by this one.
