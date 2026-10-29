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

- s07 round 2 (after the first measure): the step flashes are L-shaped (riser plus upper tread, 5 px ink with a
  14 px glow, linear fade); the rows' letters land from 1.5x over 0.6 s; "WHITE KEYS" slides 30 px over 0.7 s; the
  "?" grows through "changes" and fades at its end (power4.in, so it spends under 0.2 s at part-faded alphas: the
  round-2 sweep had flagged the linear fade as LOW at 176.85 to 177.10).
- s08 round 2 (the first s08 measure, with m08 not rendered, had 9.7 s of holds, longest 2.7 s at 219.06 to
  221.76; every one but 228.26 (0.4 s) sits inside m08's span, so Tavi's idle carries them in the film): the eight
  lit keys' pulse on "set of keys" and the four black keys' on "keys under it change" settle over 0.8 s, the four
  now in turn (0.2 s apart); the ghost outlines fade over 0.7 s; the tally's pulses settle over 0.8 s; on the slide
  back to C, E major's black keys go dark over 1.2 s from 0.3 s in, trailing the stairs.

## Results

- s07 round 2 clip (m07 rendered, m08 not): 2.8 s of holds inside (1.6 s per 30 s), longest 0.4 s (31.30, film
  177.4); 2.2 s in the no-Merc stretch 153.3 to 198.9 (45.6 s), 1.45 s per 30 s; final hold 0.3 s (52.9, where m08
  drops in). Single-frame "pops" at 39.03 (the flash on "different places", 2-frame onset) and 43.30 (the step
  rows' 0.2 s leave, 189.3 to 189.5): both intended, checked frame by frame (frames 1166 to 1176, 1294 to 1304).
- s07 round 3 clip: 2.7 s of holds inside (1.5 s per 30 s), longest 0.3 s; 2.1 s in the no-Merc stretch
  (1.38 s per 30 s). m07 placed by the gate (whole.js has m07-orange 28 since 08:56): Tavi whole from 148.81,
  hopping out right 152.7 to 153.3 (frames in lab/s07-predict/scratch/merc-sheet.png).
- s08 round 2 clip (m08 not rendered): 9.0 s of holds, longest 2.1 s (219.66 to 221.76), all inside m08's span
  but 28.9 (0.4 s, after Tavi has hopped out). Needs the m08 pass to prove.
- s07 text sweep round 3: clean. s08 text sweep round 2: clean.
- s08 last (29.873) vs s09's first still (lab/s09-names/frame-00-at-0s.png, 09:08): max 10, none over 16.
- CU-D (40.6): the dashed and real treads at stairs 3 and 7 are one row apart (26 px world, 52 px at 2x); the
  visible lines' centres read 49 px because L.stairs draws its tread highlight 1.5 px inside the block.
- Handoffs: s06 last clip frame (director's 08:49 measure) vs s07 frame 0: max 36, mean 0.39, edges only
  (draft encode). s07 53.253 vs s08 0.007 stills: max 21, 2 pixels over 16 (dust), mean 0.001.
- Key names F# and C# settled on their 40 % chrome keys (49.1): 5.23:1 each.
- item 2: lab/s07-predict/item2/clearance.json (numbers); stills lab/s07-predict/stills-r2/frame-03..09 (S7e hop
  middles) and lab/s08-anywhere/stills-item2/ (S8b, S8c); sheets lab/s07-predict/scratch/item2-S7e.png,
  lab/s08-anywhere/scratch/item2-S8b.png, item2-S8c.png.

## Status

| Scene | Built | Stills | Clip | measure.py | Text sweep | clock-lint | merc-tags |
| --- | --- | --- | --- | --- | --- | --- | --- |
| s07-predict | all rows, round 3 | round 2 (stills-r2) | round 3: 2.7 s, longest 0.3 | passes both limits | round 3: clean | clean | current |
| s08-anywhere | all rows, round 2 | rounds 1 and 2, item 2, handoff | round 2: 9.0 s, longest 2.1 (inside m08's span) | waits on m08 | round 2: clean | clean | current |

## Final checks (09:25)

- Root `hyperframes check`: my scenes' only errors are missing_local_asset for m08-orange (both tags), as expected
  until the pass lands; warnings are the shared Merc-tag ones (nested_media_start_basis_ambiguous,
  duplicate_media_discovery_risk) and composition_file_too_large on s07 (449 lines). Log: lab/s07-predict/root-check.log.
- merc-tags --check: 6 tags, 0 stale, 0 problems. clock-lint: prints nothing on both scenes.
- m08-orange still rendering at 09:25 (1.3 MB part file, 32 min in). Once it lands and merc-whole.py runs:
  re-render lab s08 (and s07's last 0.5 s) and re-measure; s08's diagram-only holds (longest 2.1 s at 219.66)
  must then be covered by Tavi's idle.

## Fix round 1 (component critic C-01, review/component-C-01/REPORT.md), from 12:50

Sources re-read: DECISIONS 81, 83, 85; FACTS 77; BUILD-GUIDE § Handoff confirmations (Tavi's entrances stay as
the director tagged them: m07 from 147.34 with its tall intro, m08-in from 198.27, the splice at 203.65).

- Item 1 (S8 dead): lights instead of 1.05 pulses. 8b: stair 1 lights on "Start" and the light climbs the stairs
  on "pattern"; on "any of the twelve notes" the six keys outside D major come up in turn (0.12 s apart) so all
  twelve stand lit, and go back in turn from "get". 8d: each stair's hairline flashes to its key in turn on "keys
  under it change" (its black key flashing, its white key scaling); the four entries scale in turn on "Every
  start"; the header scales on "needs"; "D 2" flashes F#4 and C#5, "G 1" lights F#5, "E 4" flashes E's four; on the
  slide back E's black keys go dark in turn (0.25 s apart); the stairs light in turn on "fits the white keys alone".
  A black key's flash is a chrome face (50 %) over the lit key, an accent written in the scene.
- Item 2: header "BLACK KEYS" with L.kicker (mono 30 px, .18em, ink-2) at x 140, baseline 172; the tally's text is
  FACTS 77's, real spaces, with word spacing (entries +0.3 em: a 32 px space; probe +0.5 em: 44 px round each dot).
  The line is about 805 px now (HANDOFFS said 476), x 140 to about 945, clear of every start's stairs.
- Item 3: the "?" from x 1360, baseline 330 (world): 80.9 px from the bead at rest on stair 8, 24.6 px from the
  echo ring at its largest (lab/s07-predict/item2/clearance.mjs).
- Item 4: all eight names out over the slide's first 30 %, in over its last 30 %: none shows between, so no stair
  holds two letters and no letter rides more than a fifth of the way to another key. Checked every 1/60 s
  (lab/s07-predict/scratch/names-check.py): PASS on all four slides.
- Item 5: the pills stay up; the lane ("Predict." and both pills) eases 50 px left with the push to F-white and back
  with the pull. At x 140 white-d's drop and its first hop cross "No: it changes" by 23 px; at x 90 they clear it
  by 26.7 px (drop) and 33.9 px (hops) (lab/s07-predict/scratch/pills.mjs).
- Item 6: the ghosts one at a time (0.5 s apart; each 0.2 s in, 0.6 s slide, fit), the rim (the outline, ink 3.5 px
  with a chrome glow) flashing as each fits; ghosts at 40 %.
- Item 7: two beads; slide-g's fades in 0.25 s riding stair 8, slide-e's drops 0.2 s onto E's moving stair 1.
- Item 8: the steps at x 354 + 46 k (both rows).
- Item 9: the strip (and both sets of hairlines) fades over the CU-D push and returns with the crane; stair 7's
  arrow fades 0.35 s before the crane.
- Item 10: the strip dims to 25 % from the staircase's dim (1.0 s, power1.in) and returns as the card leaves.
- Item 11: the "?" shrinks away on "changes" (0.35 s, power2.in); the rows leave over 0.4 s drifting 24 px left,
  from 0.5 s before the crane; the flashes rise over 0.15 s.
- DECISIONS 85: the dashed staircase's lines, fills and flashes are cut clear of the real staircase's two golds
  (gap and corner, as the real staircase comes to full); S8's ghosts and rim are cut clear of E's golds.
- For the holds (about 1 s per 30 s with Tavi): S7's stair 3 and 7 letters scale and their keys flash on
  "changes" (+0.45 s); F#4 and C#5 flash on "black" and "keys" instead of scaling.
