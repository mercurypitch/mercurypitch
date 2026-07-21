# Voice Mirror — Demo Audio Cues — EARS Requirements

Requirements for the audible glide/hold guide cues the Voice Mirror plays
alongside its onboarding task-demo animations, ported from the Glass feature's
"hearable, not just animated" instruction demos.

Reuses the shared synthesizers in `src/lib/demo-audio.ts` (`playSirenSweep`,
`playHoldTone`). Cue selection is pure and lives in
`src/features/mirror/demo-cue.ts` (`planDemoCue`, `playDemoCue`); the animation
component `src/features/mirror/TaskDemo.tsx` triggers the cue.

Each requirement has an ID referenced by the unit tests in:

- `src/tests/mirror-demo-cue.test.ts` (cue planning + direction — `MDA-*`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Cue planning — `MDA-*`

A **task demo** is one looping onboarding animation for a Voice Mirror task
(`glide-up`, `glide-down`, `hold`, `match`). Its gold **guide** path and named
segments come from `buildDemoTimeline`. The **sing window** is the timeline's
`sing` segment.

- **MDA-1** — WHEN planning the cue for a `glide-up` demo, the system shall
  produce an ascending siren sweep from the guide's first pitch to its last
  (`fromHz < toHz`), lasting exactly the sing window's duration.
- **MDA-2** — WHEN planning the cue for a `glide-down` demo, the system shall
  produce a descending siren sweep from the guide's first pitch to its last
  (`fromHz > toHz`), lasting exactly the sing window's duration.
- **MDA-3** — WHEN planning the cue for a `hold` demo, the system shall produce
  a steady hold tone at the guide's pitch, lasting exactly the sing window's
  duration.
- **MDA-4** — WHERE the demo is the `match` task, the system shall produce no
  glide/hold cue (`planDemoCue` returns `null`), leaving the match task's own
  reference-tone playback unchanged.
- **MDA-5** — IF the timeline has no `sing` segment or a non-positive guide
  pitch, THEN cue planning shall return `null` rather than emit a cue.
- **MDA-6** — WHEN `playSirenSweep` is invoked with `{ fromHz, toHz }`, the
  system shall ramp the oscillator frequency from `fromHz` to `toHz` over the
  requested duration, in either direction, so a single synthesizer serves both
  glide-up and glide-down.

## Playback behaviour — `MDA-*`

- **MDA-7** — WHILE a task demo is active, visible, and on-screen, the system
  shall play its planned cue once through the caller-supplied `AudioContext`,
  and shall stop the cue when the demo becomes inactive, hidden, off-screen, or
  unmounts. Re-activation plays the cue again.
- **MDA-8** — WHERE no `AudioContext` is supplied, or the context is closed, the
  task demo shall animate silently (the pre-existing behaviour) without error.
- **MDA-9** — WHERE the supplied `AudioContext` is suspended, the system shall
  attempt to resume it before scheduling the cue, so autoplay-gated contexts
  (e.g. the onboarding overview) become audible once the browser permits.
