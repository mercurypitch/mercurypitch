# Resonance Conservatory — implementation and playtest

2026-09-21. Stage 3 of the approved pass. Code is a fourth campaign chapter;
physical microphone acceptance is still pending the owner's next playtest.

## Lesson and route

Four required exhibits and three optional finds across 18 authored placements.
The entrance goblet revisits a comfortable steady note. The fern house teaches
settle → wave; a listening court offers a familiar optional hold beside the
harp. The orchid house repeats the wave, and the keeper's portrait is the final
required wave. A west-facing panorama provides the departure and a last optional
wave. Room ports, gates, checkpoints, artwork and audio remain authored data.

The new paintings are original fictional art: The Garden That Listened and
The Keeper of Gentle Waves. Full PNG masters and exact generation prompts are
under `art/glass-adventure/v7-conservatory/`; hashed WebP derivatives are in the
shared native/web allowlist. No public figure or celebrity voice is imitated.

## Capture contract

The `settle-wave` challenge is independent of room/layout IDs. First settle for
0.8 seconds near a calibrated comfortable note. The judge centres the second
step on recent accepted settled pitch, so calibration rounding does not make
one side of the gesture artificially harder. Then cross both sides of that
centre for two cycles. Minimum excursion 35 cents, maximum 180; cycle duration
0.3–2.5 seconds, at least 1.2 seconds of wave evidence. These are forgiving
teaching parameters, not a clinical or stylistic assessment of vibrato.

Only fresh confident monotonic capture frames count. Gaps, silence, weak input,
stale frames and abrupt jumps clear an unfinished wave. Taking a breath retains
the first settled step; cancelling/replaying clears the whole attempt. Small
jitter and an indefinitely steady note cannot finish the wave. Render elapsed
time never manufactures evidence. This lesson is ungraded in the reward pilot.

The audible example plays a steady note then a gentle one-hertz pitch wave.
It uses the existing owned sound session and waits through its release/quiet
boundary before judging. Replay and recalibration use the same microphone
session, with generation guards against late callbacks. The panel shows two
steps and a dedicated “Hear the gentle wave again” action.

## Automated evidence

- 42 focused tests passed across wave, settle-wave, sound, voice controller and
  Conservatory course files. Includes three capture cadences, false-positive
  rejection, rest/retry, reference contamination, cancellation and fresh input.
- The complete required-only route can be walked without jumping, opens each
  gate, exits through the panorama, and restores completion from its own save.
- Compiler rejects missing wave parameters; port coordinates are validated.
- Shared package TypeScript check passed after integration.
- Built host/browser rendering evidence is recorded with the delivery pass;
  this document does not claim physical-device singing or FPS verification.

## Next owner test

Choose Resonance Conservatory in the campaign. Let the first goblet hear your
normal comfortable note. At the fern house listen first, settle, then gently
sway above and below twice. Try a breath midway: the wave restarts while the
settled step remains. Try Replay and Cancel; neither should break the glass or
leave background capture. Continue through orchids and the keeper to departure.
Check ordinary speech or a steady note does not accidentally finish a wave.
Tell us if the intended gesture feels too broad, too narrow or too unforgiving
on the actual tablet microphone; those thresholds are content data.

## Final review evidence

The exact reference gesture now passes after two smooth centre-started waves
and return to centre. One wave, tracker chatter and a fast gesture followed by
a long hold fail. Capture-cadence regressions cover 20, 40 and 75 ms. Authoring
rejects excursion/speed/period combinations that cannot physically reach the
other extreme. The focused reviewed judge/authoring/route suite passed 43 tests.

Full Adventure UI proof at 390×844 and 1024×768 exercised the first wave lesson
using synthetic microphone observations and real reference playback, with
visible settle/wave steps, replay/recalibration actions and successful Cancel.
No page errors were recorded. Proofs: `../v7-conservatory/proofs/manifest.json`.
The root web host also loaded the actual Conservatory first room without asset
failures; see `../delivery/v1/proofs/manifest.json`. Real-device singing remains
the owner's acceptance test.
