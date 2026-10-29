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
