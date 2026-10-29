# Build notes: group C (s07-predict, s08-anywhere)

Running notes so a container restart or a usage-limit pause can resume. Builder C owns
`compositions/s07-predict.html`, `compositions/s08-anywhere.html`, `lab/s07-predict/` and
`lab/s08-anywhere/` only. Clock: Kokoro scratch, 483.73 s (cues.json = tools/board-cues.json).

## Spans

- s07-predict 146.097 to 199.360 (D 53.263); cuts on act2 (146.25) 0.15 s early.
- s08-anywhere 199.360 to 229.240 (D 29.880).

## Merc passes

- m07-orange (s07, 148.35 to 153.35): rendering from 08:43 (m07-orange-merc.part.webm).
- m08-orange (s07 to s08, 198.9 to 228.25): queued.
- Both placed with L.mercGate (gate falls back to 30 with a console warning until whole.js has them). In s07
  m08's tag covers 198.9 to 199.36 only (27 frames < 31), so the gate keeps it hidden there; it shows from s08.

## Decisions (builder)

- Strip in 7b: as Tavi's dashed staircase draws, the white keys D4 to D5 come up to full (D5 up from 45 %) and
  C4 goes down to 45 %, so the strip shows exactly the guess's keys. In 7e's slide the strip goes to D major:
  F4 and C5 to 45 %, F#4 and C#5 lit (40 % chrome). The real staircase's hairlines dim with it under the card.
- Tavi's "?" is right-aligned to the top stair's right edge (x 1314, baseline 250), not centred on x 1258: centred,
  the bead's hop onto stair 8 (white-d and major-d) passes through it. Measured: 7.0 px (white-d) and 7.5 px
  (major-d) at the closest, 14.4 px at rest (lab/s07-predict/item2/clearance.json).
- The pills leave with the ring timer as the predict pause ends and come back once the pull out of F-white has
  landed (170.3): in F-white the bead's drop onto the dashed stair 1 (screen x 420 to 476, from y 423) crossed
  "No: it changes" (x 140 to 443, y 433 to 497). Back in F0, the major-d bead keeps 9 px from that pill.
- "Predict." stays up through F-white and leaves with the pills on "The white keys climb".
- Step rows: per HANDOFFS (steps x 340 to 596, each letter centred on the same column in both rows).
- 7f's "dashed riser flashes" are drawn as the dashed step itself (riser plus the tread it climbs to) in a
  5 px ink line with a glow, faded linearly; the dashed riser alone sat on the real riser's bar.
- Lead-ins for holds (each tied to the word it serves): dashed stairs 1 to 3 fill on "doh ray mee"; the white
  keys D to D ripple on "white keys" (b18) and on "climb" (b20); the rows' S's scale on "short steps" too; the
  real gold pair grows (and stairs 4 and 8 light) on "fall"; the tread flashes lead "third"/"seventh" by 0.15 s;
  the key names lead "F sharp"/"C sharp" by 0.15 s and their keys scale again; the risers grow in turn on
  "Keeping the pattern" (0.15 s apart); the "D" of "D major" scales on "named"; D4 scales on "note".
- Edge fades (text sweep EDGE): stair 1's letter through CU-D; riser 7's label through F-keys-D; the label pulses
  of the "Keeping" ripple only on risers 1 to 5 (6 and 7 sit at F-keys-D's top edge).
- s08: stair 1 lights (and D4 scales) on "Start"; the beads drop onto the moving stair when a slide is landing,
  and slide-g's rides stair 8 while it fades as the slide to E starts.

## Status

| Scene | Built | Stills | Clip | measure.py | Text sweep | clock-lint | merc-tags |
| --- | --- | --- | --- | --- | --- | --- | --- |
| s07-predict | all rows, round 2 | round 1 | round 1: 7.9 s holds, longest 0.8 (in 7b, m07 missing; 7f, 7h) | round 2 pending | round 1: LOW F glow copy, EDGE riser 6 pulse (both fixed) | clean | current |
| s08-anywhere | all rows, round 1 | round 1 | not yet | | round 1: clean | clean | current |
