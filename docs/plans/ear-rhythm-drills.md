# Ear Lab — the rhythm drills (Pulse, Echo)

Designed in Polish Phase 5 of the Ear Lab, to be built in the follow-up the
founder named ("then we polish and add more ear/rhythm exercises"). Both
drills already sit in the catalogue (`src/lib/ear/drills.ts`: `pulse`,
`echo`, Elo-scaled, `choices: 0` — answered by doing, not by picking) and
neither is offered anywhere until it has a view (`drill-views.test.ts`
holds `SPRINT_DRILL_IDS` to `VIEW_FOR_DRILL`).

## The seam they stand on (built)

- **`src/lib/ear/tap-input.ts`** — `createTapLedger({ latencyMs })` measures
  taps from the instant the first beat was scheduled, on the page clock,
  and subtracts the app's one round-trip number from every tap.
  `nearestBeatDeviation` and `summariseTaps` turn a take into signed
  deviations (negative early), a mean, a spread and a matched count; taps
  further than half a period from any beat are misses, not outliers.
- **`TapPad`** (`EarStage.tsx`) — one wide pad; taps on pointer down and on
  Space / Enter, stamped with the event's own time, brass flash per tap.
- **Clocks.** The audio clock and the page clock are read in the same
  instant when a take starts: `startAt = ctx.currentTime + lead`,
  `originMs = performance.now() + lead * 1000`. Clicks come from
  `click-synth.ts` in the room's voice at the stage volume.
- **The subtraction, honestly.** The round trip is speaker → microphone; a
  tap's true offset is output latency + touch latency. On one device the
  difference (microphone input latency less touch latency) is small and
  constant, so it cancels out of any change over time. It is not the ear
  and it is not zero, which is why the readiness panel's **Tap check**
  shows the mean and spread with the round trip subtracted: the founder
  can judge the residual on real hardware before a reading depends on it.

## Pulse — hold the beat (faculty V, time)

- **Task.** Eight clicks at a tempo, then the clicks stop and the player
  keeps tapping the beat for eight more. The reading is how well the
  pulse is held without the crutch.
- **Stimulus.** `PULSE_TIMING = { beats: 8, continue: 8, leadS: 0.6 }` in
  `timing.ts`; tempo comes from the item.
- **Items (frozen difficulty).** A bank of tempi × subdivisions:
  100 / 80 / 66 / 54 / 44 BPM (slower is harder — the interval to hold
  grows) each on the beat and on the half-beat. Item difficulty is seeded
  from the interval length, then frozen like every other bank
  (`banks.ts`).
- **Scoring.** The eight unaccompanied taps against the extrapolated grid
  (`nearestBeatDeviation`); the take is correct when the spread of
  deviations is under the tolerance tier of the item (tiers 60 / 45 / 35 /
  25 ms, mirroring Contour's gap tiers) and at least six taps met a beat.
  Elo per item as everywhere else; the **reading** shown on the bench is
  the spread in ms of the last calibration take — a real unit, falling.
- **Stage.** The Regulator's pendulum as the instrument
  (`TrackPendulums`-style bob) swinging on the clicks, then swinging on
  the player's taps once the clicks stop, so a drifting pulse is seen as a
  pendulum going out of true. Console: the tap pad full width, Stop in
  the bar. Reveal: the eight deviations as ticks on a rule, early left,
  late right, in ms.
- **Latency.** Every tap through the ledger; the Round-trip chip's
  "unmeasured" state disables Calibration for Pulse (practice stays open,
  marked raw), the same rule the Grid's copy already states.

## Echo — clap it back (faculty III, shape)

- **Task.** A rhythm of three to six onsets on one pitch; the player taps
  it back after a count-in. Contour's cousin: shape in time.
- **Stimulus.** `ECHO_TIMING = { countIn: 4, periodMs: 600, gapMs: 900 }`;
  onsets drawn from a bank of patterns at fixed difficulty (onset count ×
  the smallest subdivision in the pattern).
- **Scoring.** Each stimulus onset must be met by a tap within the item's
  tolerance tier, in order; an extra tap or a missed onset fails the item.
  Reading on the bench: the finest subdivision the player clears at 75%
  (an Elo-derived tier), shown as a note value, not a percent.
- **Stage.** The stylus trace's drum (Contour's instrument) with onsets
  as ticks along the drum, the player's taps drawn under them at the
  reveal.

## What ships when

1. Now (Phase 5): the seam above, the tap check in the readiness panel,
   this spec. Nothing in the sprint, no view.
2. Follow-up A: Pulse — `PulseDrill.tsx` on `use-threshold-run`-style
   pacing with the tap ledger, `PULSE_TIMING`, the bank, the pendulum
   instrument; `SPRINT_DRILL_IDS` gains `pulse`, `VIEW_FOR_DRILL` gains
   `pulse: 'pulse'`, the testing doc gains its section, the audit walks it.
3. Follow-up B: Echo, on Contour's drum.
