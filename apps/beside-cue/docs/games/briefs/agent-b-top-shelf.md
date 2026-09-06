# Brief B — the Top Shelf, plan and spike

You are preparing slice 6 of Beside Cue's mini games, the Top Shelf,
in `apps/beside-cue` of `mercurypitch/mercurypitch`. Read, in order:
`docs/games/handoff-2026-09-06.md`, `docs/games/slice-5-polish-to-v1.md`
(§3 and §5 -- maff's answers override the T defaults), then
`docs/games/sorting-line.md` §1.2 (why the proposal's geometry did not
close), §6 (what the Line took from the Top Shelf: tolerance is
geometry), §9 (the grade in real units) and §13 (how a slice is cut).

**Your scope, two PRs**:

1. `docs/top-shelf-plan`: `docs/games/top-shelf.md`, the plan in the
   shape of `sorting-line.md` -- the fantasy in one sentence, the
   rules, the three rooms as data with their asks in semitones, the
   derived geometry per voice preset (shelf heights from intervals at
   0.1 m per semitone, T1; every preset must be able to make every
   leap and none must clear a room by resting), the tolerance and
   failure model (T3, T4), the grade reusing `sim/line-grade.ts`
   (cents past the asked interval, first-try), the thirty seconds
   (T7), the steps 6a–6f with "done when" for each, and a §Decisions
   list of anything the T defaults do not settle. State the numbers;
   do not guess at what a measurement answers -- name the measurement.
2. `feat/top-shelf-spike`: the shared physics (T6) -- an upward ground
   sampler and whatever a leap-to-a-shelf needs in
   `src/games/glass3d/sim/locomotion3d.ts`, added behind the existing
   locomotion tests with NO behaviour change for the Hallway, chambers
   or Line (their tests are the regression gate), plus a pure
   `levels/shelf.ts` with the room data and the derived heights, and a
   probe page in the style of `src/dev/merc-probe.ts` that stands Merc
   on a staircase of shelves so maff can judge the scale on his phone
   before any of the numbers mean anything (§1.3 of the Line plan says
   this device pass comes first).

**Files you own**: `src/games/glass3d/sim/locomotion3d.ts` (+ tests),
`src/games/glass3d/levels/shelf*.ts`, `src/dev/shelf-probe*`,
`docs/games/top-shelf.md`. **Do not edit** the stages, scenes,
`world3d-config.ts`, `dev/*` or `games.css` -- agent A owns those for
the polish slice. The Top Shelf's own stage and scene come after both
of you have landed, as 6b onward.

**Rules that bite** are in the handoff §4: run git from the repo root;
`timeout` on long commands; never touch port 5199, bind your own port
for the probe (5207 is free); no emojis; no attribution lines; no
timelines; rebase-merge is maff's call after he has looked, you open
the PRs and wait.

**Report** in each PR body: the decisions you took beyond the T
defaults, the numbers per preset, and what maff should look at on the
phone.
