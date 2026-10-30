# Build notes: group A (s01-cold-open, s02-title, s03-promise, s04-recall)

Running notes so a container restart or a usage-limit pause can resume. Updated after each row or
proof. Scratch files live in lab/<scene>/ only.

## Clock

- Scratch clock of 29 October, 483.73 s; cues.json equals tools/board-cues.json (board time = film time).
- Spans: s01 0-34.183, s02 34.183-37.583, s03 37.583-47.045, s04 47.045-69.354.

## Merc passes (mine: m01-blue, m01-orange, m04-orange)

- 07:40: m01-blue still rendering (.part.webm, 3.4 MB); m01-orange and m04-orange not started.
  m06a-orange is done (s05's, read only).
- m01-blue's first 202 frames decoded (lab/s01-cold-open/scratch/): his mouth while singing sits
  at about (181, 211) in the 315 px frame, so (261, 781) on screen at feet (230, 840), size 420,
  front. HANDOFFS' provisional (270, 664) is about 117 px too high. The bead is built from the
  measured point; confirm in the lab clip once the pass is complete.
- merc-tags.py s01-cold-open has run: tags point at assets/merc/m01-*-merc.webm (data-start 0,
  duration 33.425, media-start 0.008). Run merc-tags.py s04-recall once s04 is written.

## Shared code

- Group A shared block (identical in s01 to s04): between `// ==== group A shared block` and
  `// ==== end group A shared block ====`. Copies: scratchpad shared-a.txt. FIELD/fieldDisc (soft
  edge parameter), dustF over a 2840 x 1840 field in film time, txt, fadeIO, place, curveArrow, SOL.
- Title-to-house flight (identical in s02, s03): `// ==== title-to-house flight`. TF.flight(T)
  from film time; FLY0 = cueF('title','start',2.72), 1.0 s, lit from FLY0+0.7.
- s03 is assembled from lab/s03-promise/s03-src.html (/*SHARED_A*/, /*SHARED_TF*/ placeholders)
  by scratchpad assemble.py. Edit the source, then re-assemble.

## s01-cold-open: BUILT

Anchors (all words or cue edges; see the anchors block in the file):
- SPAWN at('stop-c','start',-0.3); LAND_C at('stop-c','start',0.45); arrow at('hang-c'); echo
  at('hang-c','start',0.5); ring and "from C" on word('o1','waiting') / word('o1','started on C').
- BACK word('b1','Start'); RISE word('b1','D','start',0.03) 0.8 s; FROM_D RISE+0.7; HANGING
  word('b1','still hang'); PRED0 at('predict-d'); LAND_D at('stop-d','start',0.45).
- CHECK word('b2','Still'); LAST word('b2','last step'); LANDD0 at('land-d'); LAND8
  at('land-d','start',0.45); RISE8 +0.06; LIT8 +0.3.
- MOVED word('o2','home moved'); FINISHED word('o2','finished'); RESTLESS word('o2','restless');
  LINES_OUT at('o2','end',0.07); MERCS_OUT at('o2','end'); DOLLY at('hook','start',0.17) 0.93 s
  to F-house; GLOW0 DOLLY+0.35 (field grows over the cut).
- Stills checked: frame 0 (F-cold on C, stairs x 389-1531, tread 700), 32.78 (F-cold end), field
  means 115.7 at 34.0 and 116.5 at 34.17.
- Lab clip 1 (no Merc videos): 16.1 s of holds (14.1 per 30 s), longest 2.1 s. Expected: the Mercs
  carry S1's motion. Must re-measure with the m01 passes.

## s02-title: BUILT

- Field shrinks to the staff bead P(t,0,0.3,'expo.out'); TITLE_IN at('title','start',0.26);
  FYP_IN +0.76; EXIT at('title','start',2.42); sheen from at('title','start',1.2); notes chime
  TF.CHIME(k); staircase on D fades up from TF.FLY0 (0.6 s); bead follows TF.flight.
- Stills 0 to 3.383 checked (lab/s02-title/sheet-1.png, sheet-2.png).

## s03-promise: BUILT

- LIT (house echo) TF.FLY0+TF.FLY; RIP0 word('b3','build','start',0.08) riser ripple 0.2 s apart;
  SLIDE word('b3','start it','start',0.04) 0.9 s; LIGHT0 word('b3','name its notes','start',-0.02);
  PULL word('b3','hear') 2.5 s to F0; ARROW word('b3','tee','start',0.06); LIST_OUT at('b3','end');
  WIDEN PULL+2.5-0.56.
- Stills 0 to 3.5 checked (lab/s03-promise/sheet-1.png). s02/s03 cut: bead and staircase agree.
- Clip measured 4 times. Fixes for holds: line 1 lands on "you'll" (not "build"); riser ripple
  0.28 s apart (board 0.2) with its own brightening envelope (up 0.28 s / back 0.5 s, linear);
  stair 1 lights as the slide lands (up 0.3 / back 0.4 linear, group B's measured shape) and
  scales (long pulse); stairs light in turn 0.1 s apart, long settle (board 0.07).
  Final: 0.2 s holds (0.6 per 30 s), longest 0.1 s; final hold 0.2 s (46.8 to the cut).
- s03 end (9.44) vs s04 frame 0: mean diff 0.002, 2 px over 16 (dust): continuous.

## s04-recall: BUILT (source lab/s04-recall/s04-src.html, assembled like s03)

- Anchors: DIM word('b4','First','start',0.02); RISE word('b4','one','start',0.025) 1.0 s;
  NAMES_IN word('b4','2','start',0.05) 0.12 apart; SEMIS word('b4','semitones') over 0.8 s;
  OCT word('b4','octave'); Q0 at('q0'); TWELVE word('b5','Twelve'); BR0 +0.04, 0.04 apart 0.26 s;
  SEVEN_L word('b5','Seven'); FIVE word('b5','five') 0.25 apart; B5_END at('b5','end');
  NAMES_OUT word('b6','major'); STAND +0.04; P2 STAND+1.0; ROWS_IN +1.6; BACK +1.8; NAMES_BACK
  +2.0; SWAP +2.2; SEVEN word('b6','seven steps'); QMARK word('o3','steps?'); LEAVE
  word('b7',"Let's"); HOP at('b7','start',0.29); MEASURE word('b7','measure').
- Stand-up: pitch first (0.6 s), turn + pivot (240,560)->(360,677) from +0.2 (0.8 s); phase 2
  stretch 1.0 s, fade from +0.3 (0.7 s power2.in, exponential in opacity); staircase 25 % -> 0 in
  phase 1's second half so the tile group moves behind it at P2 unseen; slivers hand over to the
  kit rows by an exact complementary crossfade (SWAP, 0.6 s). Dust crossfades to group B's over q0.
- Tavi: copy of group B's s05 helper (gate WHOLE 31 provisional, 60 px ease, 360 px hop, floor patch).
- merc-tags.py s04-recall run (data-start 14.947); copied back into the source.
- Stills: lab/s04-recall/sheet-1.png, sheet-2.png. s04 end vs s05's own 0 s still: mean 0.001.

## Status

| Scene | Built | Stills | Clip measured | Text sweep | clock-lint | Merc proved |
| --- | --- | --- | --- | --- | --- | --- |
| s01-cold-open | yes | yes | blue only: 4.1 s, all in Tavi's lines | clean bar EDGE in the dolly | clean | mouth confirmed; orange waits |
| s02-title | yes | yes | 0.0 s holds | clean | clean | n/a |
| s03-promise | yes | yes | 0.2 s (0.6/30) | clean | clean | n/a |
| s04-recall | yes | yes | 0.3 s in 47-62 (no Merc); 4d waits m04 | clean | clean | waiting m04 |

## Proofs so far (08:10)

- s01 clip 2 (m01-blue present, m01-orange missing): 4.1 s holds (3.6/30), longest 0.7 s; every hold
  but one 0.2 s (11.5) falls inside o1 or o2, Tavi's lines, where her missing pass would move.
  Mouth point confirmed on the clip: lab/s01-cold-open/scratch/mouth/sheet.png, full-1.0s.png. The
  bead leaves at 0.30 from a closed mouth (the pass opens it from about 0.6).
- s01 text sweep: LOW on the "ti" name glow (a blurred text copy, an accent); glows now draw a defs
  copy through <use>, so only labels are swept. EDGE at 33.75: names leaving the frame in the dolly.
- s01 checks by name on lab/s01-cold-open/checks-sheet.png: pass. Field mean at 34.0: 115.6.
- s02 3.4 vs s03 0 at the same film time: max pixel diff 0.
- s04 clip 2: 47-62 holds 0.3 s (0.6 per 30 s), longest 0.1 s; 62-68.55 holds 5.3 s while m04 is
  missing (her talk carries 4d). Stand-up frames: lab/s04-recall/scratch/standup/sheet.png (reads
  as the row turning upright, then stretching into the rows).
- s04 fixes: names 0.14 s apart from "2."; seven white tiles (C4 to B4, not C5) in turn 0.15 s apart
  (board: together); dark tiles tent-lit 0.3 s apart (up 0.3, back 0.7, linear); brackets fade 0.45 s.

## Decisions and departures

- Mouth point measured (261, 781), not HANDOFFS' (270, 664).
- Riser ripple in S3a brightens each riser (4 px at 40 % to 6 px at full), a scene override.
- index.html root is stale (generated before frames.js/stairs.js joined scripts.txt): root check
  fails for frameRig/stairs scenes until the director re-runs gen-root.py. Lab renders are fine.

## Next (08:12)

- Root check: 3 errors, all missing_local_asset (m01-orange, m04-orange mine; m06b group B's);
  index.html still the 03:11 one without frames.js/stairs.js (director's gen-root.py).
- When m01-orange-merc.webm exists: node tools/lab.mjs s01-cold-open --clip, then measure.py into
  lab/s01-cold-open/scratch/measure-3; holds inside o1/o2 should go.
- When m04-orange-merc.webm exists: python3 lab/s04-recall/scratch/whole.py assets/merc/m04-orange-merc.webm
  lab/s04-recall/scratch/m04 (first frame with top rows empty; WHOLE = that + 1 in the s04 source,
  then re-assemble with the scratchpad assemble.py or edit compositions/s04-recall.html the same way),
  then the s04 clip and measure: 62-68.55 should lose its 5.3 s of holds.
- Then hand back (SubagentHandback).

## Fix round A-01 (from 14:35; report review/component-A-01/REPORT.md)

Since the hand back: the director moved s04 onto L.mercGate (hosts.js) and its tag to
at('o3','start',-1.1) with a tall intro segment (DECISIONS 81, 86); lab/s04-recall/s04-src.html was
regenerated from the live composition at 14:40 (shared block -> placeholder). m01-blue re-rendered
with the mouth lead (DECISIONS 79). L.bokeh landed in lesson.js at 14:42 (DECISIONS 89).

Done (14:50), all clock-lint and node --check clean:
- Item 2 (s03): the list is gone; four world labels (Outfit 600 40 world px, ink) ride the world and
  the slide: "build it from its steps" x 242 baseline 494 (on C), "start it on any note" x 242
  baseline 790, "name its notes" centred 958 baseline 790, "hear ti lean home" right-aligned 1166
  baseline 254. Riser n's event also pulses stair n+1 to 1.06 (long) and flashes its tread (glow +
  core, up 0.08 s, back 0.5 s). Riser gap kept at 0.28 s (board 0.2) for the 40.8-41.3 span.
- Item 5 (s02/s03 TF block): the flight is a cubic P0 -> (P0x, 120) -> (1100, 40) -> house on
  sine.out; shared-tf.txt in the scratchpad updated, s03 re-assembled.
- Items 3, 7, 8 (s04): C4/C5 lift 16 px through q0 (edges glow), back on "Twelve"; "?" pulses at
  QMARK+0.25 (long); risers pulse in turn on "bigger" (0.08 s apart), and every s04 riser event
  (seven steps, bigger, measure) pulses stair n+1 and flashes its tread as in S3; dark tiles get a
  full chrome 3.5 px rim and a 30 % chrome fill lift through the spin; the dimmed staircase fades
  out as the tiles land (RISE+0.4, 0.6 s).
- Items 1, 4, 9 (s01): doh/ray/mee pulse stairs 1-3 and their names; on "finished" stairs 1-7 go
  unlit (0.4 s) and do's name pulses 1.2; on "restless" ti lights orange, its name pulses, the arrow
  redraws (RESTLESS+0.1, 0.5 s) and leaves with the lines; the first hop is a cubic through screen
  (390, 840) and (330, 550), the bead at 35 % until clear of his face.
- Stills: lab/s03-promise/sheet-fix1.png, lab/s02-title/flight-fix.png, lab/s04-recall/sheet-fix1.png,
  lab/s01-cold-open/hook-fix.png, lab/s01-cold-open/scratch/mouth/path-fix.png.

Next: the four clips (nice -n 10, one at a time) into lab/<id>/measure-fix1, the four sweeps, the
root check, then hand back.

### Fix round A-01 results (15:15)

All four clips re-rendered one at a time (nice -n 10, TMPDIR=/dev/shm; the s03 clip first failed the
renderer's 1024 MB free-disk preflight and went again through scratch/requeue.sh). L.bokeh was in
lesson.js for every render. Measures in lab/<id>/measure-fix1:
- s01: inside 0.2 s (0.2 per 30 s), longest 0.1 (0.00, 11.50); final none. Critic before: 0.3 s.
- s02: none. Critic before: none. Jumps at 1.300/1.767 as before.
- s03: inside 0.2 s (0.6 per 30 s), longest 0.1 (1.00, 5.20); final 0.2. Critic before: 0.4 s.
  New pop at 1.433 s is riser 2's event (mi block pulse + tread flash onset), seen on a crop sheet.
- s04: inside 0.3 s (0.4 per 30 s), longest 0.1 (1.40, 7.00, 20.50); final 0.1. Critic before 0.9 s
  (1.2 per 30 s).
Sweeps: s02, s03, s04 clean; s01 only the known EDGE at 33.75 (names leaving in the dolly).
Root check: 5 errors, all missing m12-orange in s12-s16 (not ours); s01-s04 warnings only.
Seams: s02 3.4 vs s03 0 stills max 0; s03 end vs s04 0 stills mean 0.001; clips s01->s02 0.363
(largest 6), s03->s04 0.363. s04 end vs s05's 14:26 clip differs only by the bokeh discs
(s05's clip predates L.bokeh). clock-lint silent; node --check ok on all four.

## Round A-02 (from 21:08; report review/component-A-02/REPORT.md: s01, s02, s04 KEEP, s03 REVISE)

Edits done (21:40), clock-lint silent, node --check ok:
- Item 1 (s03): risers are the subject. RIP_GAP 0.2 (board). Riser n: 4 -> 10 px, chrome 40 % -> full
  ink, P(RIP0 + 0.2(n-1), 0.2, power2.out), so 38.70 to 40.10; all thin back together from
  word('b3','steps','start',0.3) = 40.54 over 0.7 s linear (done 41.24, before "start it" 41.26).
  Block pulses and tread flashes removed from s03 (the flash overlays are gone).
- Item 5 (s03): "name its notes" right-aligned (anchor end) at ST.colX(8,0) + 56 = 1194, top do's right
  edge; baseline unchanged (790 world on C).
- Item 2 (s04): numerals 1-7 (Outfit 600 36 px, ink) centred at riserX(n), baseline tread(n+1) - 24,
  each in with growAt(n) (60.98 + 0.07(n-1)), out with the labels at LEAVE (67.63). "bigger": the seven
  bars brighten together (4 -> 8 px, chrome 40 % -> full ink, 0.25 s up from 66.22, linear back by
  67.63) and take one 'bar' long pulse together; no block pulses or tread flashes on "bigger" now.
  "measure" (68.04) keeps its in-turn ripple with block pulse and flash (not asked).
- Item 4 (s04): C4/C5 lift 40 px from LIFT0 = at('q0','start',0.06) = 52.10 (0.4 s, power3.out) with a
  3 px chrome outline 6 px out (own rect in each tile's group); drop from TWELVE 54.16 (0.25 s,
  power2.in) and a tile pulse at 54.41. The A-01 top-edge glow on them is gone.
- Item 6 (s01): ti on "restless" lit 0.25 / ST.LIT.color of the orange (25 % against do's 45 %).
  Backup of the pre-edit s01 at lab/s01-cold-open/scratch/s01-before-r3.html.
Next: 60 fps clips via lab/s01-cold-open/scratch/pass60.sh (old clips kept as clip-r2.mp4), measures in
lab/<id>/measure-r3, sweeps, check, report.

### Round A-02 results (23:25, after the 23:11 container restart; no re-render needed)

60 fps clips (pass60.sh, 21:18-21:30): s03 568 frames, s04 1339, s01 2051, s02 204. Old 30 fps clips kept as
lab/<id>/clip-r2.mp4. Measures in lab/<id>/measure-r3:
- s01 holds 0.2 s (0.2 per 30 s), longest 0.1 (0.00, 11.50), no final. Critic A-02: 0.2, longest 0.1.
- s02 none. Critic: none.
- s03 0.2 s (0.6 per 30 s), longest 0.1 (1.00, 5.20), final 0.2. Critic: 0.2 + 0.2 final. Riser turns
  show largest change 132-143 per 0.1 s sample; the thin-back 19-34 (no holds).
- s04 0.4 s (0.5 per 30 s), longest 0.1 (0.40, 1.40, 7.00, 20.50), final 0.1. Critic: 0.3 s. Low motion
  through q0 is now 51.15-52.05 and 52.35-54.15 (the lift breaks it at 52.10).
Seams: stills s02 3.4 / s03 0 max 0; s03 end / s04 0 mean 0.001. Clips at 60 fps: s01->s02 0.398 (6),
s02->s03 0.516 (bead step), s03->s04 0.431 (39).
npm run check: 0 errors on s01-s04 (warnings only; 2 infos text_occluded at s01 26.87, the "do" names
inside the Merc videos' transparent boxes, visible on the frame). The run fails on s06's layout error
(builder B). Contrast 59/59. Sweep (scratch/sweep-r3-report.txt): s02-s04 clean, s01 the known EDGE at 33.75.

## Round A-03 (30 Oct from 00:45; review/component-A-03/REPORT.md: s01, s03 KEEP; s02, s04 REVISE; DECISIONS 106)

- Item 1 (s04): "measure" lights: stair n lit (40 % chrome) P(MEASURE + 0.1(n-1), 0.2, power2.out), i.e.
  68.04 to 68.94; all back from UNLIGHT = at('b7','end',0.05) = 68.95 over 0.35 s (power2.inOut), done 69.30.
  The "measure" riser ripple, its block pulses and tread flashes are gone (rippleAt removed); the
  "seven steps" flash stays. Backup lab/s04-recall/scratch/s04-src-before-r4.html.
- Item 2 (s02): the field's shrink u = P(t, 0, 0.3, 'power2.out') (was expo.out). Backup
  lab/s02-title/s02-before-r4.html. Mean luma at 0/0.05/0.10/0.15 s: before 114.9, 34.0, 20.7, 20.2; after
  114.9, 70.5, 31.9, 21.7 (Lesson 2 per A-03: 122, 93, 61, 38; its own shrink is 0.46 s, radius
  power2.out, centre power3.out).
- Item 4 (s03): start1 = t < LIGHT0 + 0.15 ? clamp((t - LANDED + 0.05) / 0.3) : 0 (held to the wave's
  peak). First render: holds 0.5 s (1.6 per 30 s), longest 0.4 (42.48-42.88). Added: stair 1's name swells
  1.2 at LANDED (long), so the held light does not read still. Second render: 0.1 s (0.3 per 30 s).
- Clips 60 fps (pass60.sh; round 2's kept as clip-r3.mp4): s03 00:55 and 01:08, s04 00:58, s01 01:05,
  s02 01:07. Measures in lab/<id>/measure-r4.
- Holds: s01 0.2 (0.2/30), s02 none, s03 0.1 + 0.2 final, s04 0.4 (0.5/30) + 0.1 final.
- Seams, clip to clip: s01->s02 0.397 (5), s02->s03 0.53 (bead), s03->s04 0.445, s04->s05 (s05's
  00:45 60 fps clip) 0.309 (33, all at stair edges).
- npm run check passed (0 errors; s01-s04 warnings only, 2 infos at s01 26.87 as before). merc-tags
  --check: 8 tags, 0 stale. Sweep (scratch/sweep-r4-report.txt): s02-s04 clean, s01 the known EDGE.
- Note: one stray `merc-tags.py --help` ran over every scene (it takes no --help); it reported
  "84 Merc tags, 0 updated", so it wrote nothing.
- Board row 3b says the naming wave is 0.07 s apart; the build has 0.1 s since round 1 (not raised by any
  critic). Left as built; flagged.

## Round 4 (30 Oct 01:15; DECISIONS 112)

- s02: SHRINK 0.46 s; radius u = P(0, 0.46, power2.out), centre uc = P(0, 0.46, power3.out) (Lesson 2's
  s02). Backup lab/s02-title/s02-before-r5.html. Mean luma at 0/.05/.10/.15 s: 114.9, 90.1, 55.0, 33.0
  (Lesson 2 122, 93, 61, 38; round 3 114.9, 70.5, 31.9, 21.7). Clip 60 fps 01:21 (204 frames), round 3's
  kept as clip-r4.mp4; measure-r5: no holds.
- s03: no change. The kit's L.spell.draw already scales about (anchor x, baseline): translate(px py)
  scale(s) translate(-ax 0). Measured on the 60 fps clip over 42.20-43.15: baseline row 772 every frame,
  bottom-edge centroid 769.86-769.97; only the cap top moves (741 -> 734 -> 740). Clip left as is.
- Seams: s01->s02 0.397 (5); s02->s03 clip 0.515 (bead step), stills 3.4 / 0 max 0.
- check passed (0 errors, s01-s04 warnings only), merc-tags 0 stale, sweep as before.

## Polish round (30 Oct from 12:17; brief scratchpad/l4entr/polish/BRIEF-A.md, items 1 to 5)

Context read: film-01 report (items 1, 8, 10), A-04 report (items 2, 3). Scratch in /dev/shm/l4lab-A (renders
go there, then mv into lab/<id>/). s03 and s04 compositions still equal their lab sources assembled (checked
12:25), so s04 edits go into lab/s04-recall/s04-src.html first, then assemble.py.
Before numbers (lab clip r4, 60 fps): s04 tile entrance: frames 0.43 to 0.55 s near still (mean change under
0.01), hold sample at 0.40 s; the pop frame 0.583 s (47.628) changes 12.0 % of pixels (4.0 % the next).
Edits done (12:55), clock-lint silent, node --check ok on all three (backups: lab/s04-recall/polish/s04-src-before-polish.html,
lab/s01-cold-open/scratch/s01-before-polish.html, lab/s02-title/s02-before-polish.html):
- Item 1 (s04): RISE = DIM + 0.3 (47.40, was "one" + 0.025 = 47.605); the row's opacity P(RISE, 0.45, sine.inOut)
  (was 0.3 s power2.out from a quarter in one frame); rise 300 px power3.out 1.0 s as before; stA's fade-out stays
  RISE + 0.4.
- Item 2 (s04): stand-up rebuilt as one 2.0 s move from STAND (sine.inOut su): turn about the middle tile F#4,
  pitch 26 + 94 (1-su)^2.23, length 280 -> 1460 by su^4.04, the F#4 centre on a cubic (960,560) (890,422) (1090,675)
  (950,521). Modelled in lab/s04-recall/polish/standup-sim.py (bez.py, bez2.py searched it): box never under 20 %
  (old 4.5 %), 25 px or more from lab1, bottom 892 or above. A turn about C4 cannot stay large: lab1 blocks the
  top-left (best found about 17 %). Stills lab/s04-recall/polish/standup/ and standup-sheet-1.png. Before-measure
  from the r4 clip: lab/s04-recall/polish/standup-box-before.txt (min 4.5 % at 59.31; under 10 % 58.78-59.81).
- Item 4 (s04): measure lights removed; riser sweep sweep(n) = P(MEASURE + 0.1(n-1), 0.12, power2.out) x
  (1 - P(+0.12, 0.45, sine.inOut)), 4 -> 8 px, chrome 40 % -> full ink; last back at 69.21.
- Item 3 (s01): two-row tick (ink, 4 px) at world x 225 to 237 beside stair 1, spine following the tread, ticks
  at rows 0, 1, 2 as the tread reaches them; TICK_OUT = RISE + 1.2, 0.3 s; gone 11.70. Stills lab/s01-cold-open/polish/.
- Item 5 (s02): crisp = P(0, 0.1, power1.out); soft lerp(0.8, 0.95, crisp); radius from lerp(1500, 1200, crisp) to the
  bead (Lesson 2's 1200 and 5 % rim). Stills lab/s02-title/polish/before|after.
Next: lab/s01-cold-open/scratch/polish60.sh s04-recall s02-title s01-cold-open (60 fps, workers 2, /dev/shm), then
measure, sweeps, check.
First clips (13:00): s04 measure-polish: holds 0.5 s, a new 0.3 s hold at 1.20 s (48.25-48.55: the earlier rise had
settled before the names); final 0.2 s. Fixed in the source: RISE_DUR 1.2 (lands 48.60, the board's end of 4a) and the
sweep's settle 0.55 s (last bar back 69.31) plus a guard that eases all bars to rest over D - 0.3 if a re-voice ever
pushes the sweep into the cut (inactive now). s04 needs one more clip. Entrance on the first clip: largest frame
change 1.27 % of pixels (was 12.0 %), no single-frame event. Stand-up on the clip (polish/subject-box.py): box min
19.7 % at 12.48 (59.53), was 4.6 %; lit pixels min 10.1 %, was 4.5 %; label gap min 26 px (polish/label-gap.py).
s02 clip: no holds; edge (polish/edge.py, up the column from the disc's centre): 10-90 fall 44-54 px with a 45-84
steepest 24 px drop at 0.15-0.30 s, was 95-134 px and 13-39; mean luma 116.5 86.3 55.2 35.5 26.2 (was 116.5 91.7
56.4 34.3 25.3; Lesson 2 122 93 61 38). s02 last clip frame differs from r5's by encoding noise only: lossless stills
of the old and new compositions at 1.667 and 3.383 are identical (max 0).
Sweep (scratch/sweep-polish-report.txt): s02, s04 clean; s01 the known EDGE at 33.75 only.
s01 clip (12:56): holds 0.1 s (0.1/30), longest 0.1 (0.00); the 11.50 hold of r4 is gone (the tick's fade covers it).
Tick on the clip: ink x 364-382, y 636-702, from 10.25, gone at 11.70; 23 px from Merc's body box (x 341).
Sheet lab/s01-cold-open/polish/tick-clip-crops.png. s01 clip frames 0, 600, 1500 and the last equal r5's bit for bit;
s01 last vs s02 first: mean 0.253, max 4 (same as r5 against r5). s04 second clip rendering (13:00).
s04 second clip (12:59): holds 0.3 s (0.4/30), longest 0.1 (1.40, 7.00, 20.50), final 0.1 (r4: 0.4 s with 0.40 and 1.40,
final 0.1). Entrance: largest frame change 1.25 % at 0.567 (r4 12.0 % at 0.583); new small jumps at 1.217 (0.36 %)
and 1.250 (0.04 %) are whole-pixel snaps of the tile edges in the rise's slow tail (r4 had one at 1.300, 0.25 %).
Stand-up box min 19.7 % (r4 4.6 %), label gap min 26 px. Sweep peaks 236-245 luma, 8 px, 21.08 to 21.68 in turn;
stairs stay unlit (fill max 35; r4 lit to about 100). s04 frames 0 and last: lossless stills of old and new
compositions identical (max 0); last clip frame vs s05's first: mean 0.250, max 26, 2 px over 24 (r5: 0.275, 32, 7).
Old clips r2 to r5 deleted (latest only). check running (13:05).
check (13:10, scratch/check-polish.log): passed, 0 errors; s01-s04 warnings the same kinds and count as round 5
(4 file-size, 2 duplicate-media, 4 nested-media-start), the 2 infos at s01 26.87 as before; contrast 59/59.
merc-tags --check s01 and s04: 0 stale. /dev/shm/l4lab-A removed. Left in place (outside my folders): my renders'
frames in the renderer's shared cache /dev/shm/hyperframes-extract-cache-0 (hfcache-v6-85801aed09b41408 and
-c84d58f7c5b05ff2, 2006 frames each, s01's m01 passes, about 550 MB; -054169f8ac673059 and -51f68186c82d41cf,
s04's m04, about 40 MB).

### Polish round status (13:12): all five items in; round done

| Scene | Items | Clip (60 fps) | Holds | Sweep | clock-lint |
| --- | --- | --- | --- | --- | --- |
| s01 | 3 | lab/s01-cold-open/clip.mp4 | 0.1 s, longest 0.1 | known EDGE 33.75 only | silent |
| s02 | 5 | lab/s02-title/clip.mp4 | none | clean | silent |
| s03 | none | unchanged (01:08 clip) | as round 4 | as before | silent |
| s04 | 1, 2, 4 | lab/s04-recall/clip.mp4 | 0.3 s (0.4/30), longest 0.1, final 0.1 | clean | silent |
For the director: STORYBOARD 4c and HANDOFFS § Inside A "S4c's stand-up" (and its confirmations row) still describe
the C4-pivot, comb-at-the-left stand-up; the new curves are in the s04 comment at the stand-up.
