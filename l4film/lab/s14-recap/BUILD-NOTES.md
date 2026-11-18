# Build notes: group F (s14-recap, s15-next, s16-end)

Running notes so a container restart or a usage-limit pause can resume. Builder F owns
`compositions/s14-recap.html`, `s15-next.html`, `s16-end.html` and `lab/s14-recap/`, `lab/s15-next/`,
`lab/s16-end/` only. Clock: Kokoro scratch, 483.73 s (cues.json = tools/board-cues.json today).
Never touch s12/s13 (builder E, in progress).

## Spans

- s14-recap 405.494 to 470.243 (D 64.749); cuts on recap (405.644) 0.15 s early.
- s15-next 470.243 to 478.529 (D 8.286); cuts on next (470.393) 0.15 s early.
- s16-end 478.529 to 483.729 (D 5.200).

## Merc passes (m12-blue, m12-orange; 8,438 frames each, filmStart 343.2, size 520, front view)

- 10:00: both still .part.webm. L.mercGate warns and uses 30 until whole.js lists them (harmless here:
  the drop is in S12, so the gate's frame lies long before S14).
- Celebrate in the pass at pass t 136.2 (film 479.4) to 137.05 (480.25): the hop 479.4 to 480.0.
- S14, S15: L.mercGate, x 110 and 1800, size 300, feet 0.81, floor patch on.
- S16: L.mercGate at the end pose (330 / 1590, 520, floor off); the scene sets each box's transform after
  the gate's draw (scale about the feet + translate) for the grow-and-move, and draws its own floor
  patches that match the gate's at the cut and widen with the Mercs.

## Plan, s14 (anchors by role)

See the scene's anchor table (comments in compositions/s14-recap.html). Hold plan with no Merc in the lab
clip: every gap between counted events under about 0.45 s, the ring timers carrying q1 to q4, larger
events in the card pause (icon pulses that register, then the address once more).

## Log

- 10:00 read everything; plan written.
- 10:25 s14 built (all rows 14a-14g), tags written (merc-tags s14-recap), clock-lint clean. Stills round 1
  (lab/s14-recap/frame-*.png): frame 0 matches E to F; F-recap-1, 14b labels, 14c no-scale at 424.0, D major
  keys at 428.5, F-recap-3 bead on ti, S at 438.1, G at 452.1, ladder 459.0, card 466.0, empty at 470.2.
  Clip rendering (lab/s14-recap/clip.mp4).
- 10:30 s15 built, tags, clock-lint clean, stills lab/s15-next/frame-*.png and sheet-r1.png.
- 10:35 s16 built (Lesson 2's s17 adapted), tags, clock-lint clean, stills lab/s16-end/frame-*.png, sheet-r1.png.
  Text sweep s15 + s16 clean (lab/s15-next/sweep). Ink extents (frame-06-at-5.19s): skip line x 636-1284 and
  the Scale Runner line 680-1239 (HANDOFFS' 636-1284 exactly); address x 356-1567.
  Fixes after round 1: the gate's corner patches carried hard outer edges into frame as the Mercs grew: they
  now hand over to a full room floor (own layer, no drift) over the move; the underline raised to y 449-452 so
  the address keeps 55 / 25 px over the heads.
- Practise card ink (s14 frame-09-at-60.5s): L1 x 436-1484, L2 640-1281, L3 (the 710 line, the widest)
  410-1509 (inside 310-1610 by 100 px each side), L4 683-1236, L5 741-1178, L6 585-1334, its descenders to y 896.
- 10:40 s14 clip round 1 measured (lab/s14-recap/measure): 15.1 s of holds inside (7.0 per 30 s), longest 1.4 s
  (455.5, the ladder before "Runner,"), five over 0.5 s. A proxy (lab/s14-recap/tools/holds.mjs + holds.py,
  seeks the timeline, no Merc) reproduces measure.py's holds exactly, so fixes iterate on it.
- 10:50 hold fixes: stairs ripple on "check.", card 2's "scale" and card 4's "major scale" (0.07 s apart); the
  black keys light in turn on "black" (was a scale pulse too small to count); both gold glows and the S labels
  pulse 0.55 s after "semitone."; rung names and the connector arrive on "Runner,"; the tip wavers on "sing";
  card lines rise 20 px over 0.7 s; icons pop in 0.15 s after their line and pulse to 1.5 with a full glow.
- 11:05 proxy round 2: 8.1 s inside (3.75 per 30 s), longest 0.5. Bar (BUILD-GUIDE): <= about 1.8 per 30 s with
  no Merc, none over 0.5. Most holds were dead samples at a pulse's peak, or a 0.1-0.3 s gap between word beats.
  Fixes (round 3): a label's pulse lags its bar's by 0.15 s (LAG), risers grow 0.6 s power1.out, the stairs
  ripple also on b46 "scale?" and b48 "major", stairs 3/4/7/8 light on the semitone recap, stair 1 lights as
  the slide to D lands and on b52 "Doh", ti/do beats in 14d are scale pulses (both are held lit there) with
  their names lagging, card lines leave up over 0.35 s (staggered 0.08), the F#/C# names 0.15 s after, the ladder
  title and names rise over 0.7 s, the title pulses as "Exercises > Scale Runner" lands, the rung names pulse on
  "back," and "octave", the tip wavers on "time.", and the card pause traces each tab's path under its line
  as its icon glows (the icon alone registered 0.1 s). Tools: lab/s14-recap/tools/where.py (what changed where).
- 11:35 (after a usage-limit pause; every background job re-checked) proxy round 3: 2.4 s inside (1.1 per 30 s),
  longest 0.3 (the empty F0 before the cut, and 429.2 between cards 2 and 3). Icon pulse cut to 1.25 (at 1.5 the
  gear touched "first:"). The black-key ripple on "black" now lights all eight in turn and holds them together
  to "need?" + 0.3 (a still at 424.0 caught the ripple half way, C#5, D#5 and F#5 lit unevenly, which read as an
  answer); proxy: one 0.2 s hold before "need?". s14 clip round 3 rendering.
- s15 clip r1 measured: 0.5 s inside (1.8 per 30 s), longest 0.2. Fixes: '"support"' pulses on o14 "that"
  (it is "that"), "what keeps it steady?" rises over 0.7 s, the bead's "steady?" pulse sends a second ring 0.12 s
  behind. Proxy: 0.1 s (the cut). s16 clip r1: 0.2 s at its start only (no Merc in the lab; the Mercs move from
  +0.07 in the film). Root lint in the lab project: only missing_local_asset (passes not rendered).
- 12:05 round 4 (fa/so pulse with the joining riser; "Singing Voice Range" pulses on "voice range" and "range";
  the gear turns one tooth on "Settings"; traces draw 0.75 s power1.inOut and fade after; the tip wavers longer on
  "plays."). Lab clips measured (measure.py, no Merc in the lab):
  s14 1.7 s inside (0.8 per 30 s), longest 0.2, final 0.3 (the empty F0 before the cut, Mercs only);
  s15 0.1 s (0.4 per 30 s), longest 0.1 (the cut); s16 0.2 s at its start (1.2 per 30 s; the Mercs move from
  +0.07 in the film). Pops: s14 28.33 is bead4's landing squash on the top stair (kit, as s10), 40.80 stair 8's
  light starting (smooth on the dense sheet). Text sweep s14 + s15 clean (lab/s14-recap/sweep.log). Handoffs:
  s14 64.733 vs s15 0 max 27, 0.0002 % over 24 (one dust mote); s15 8.267 vs s16 0 max 22, none over 24.
  Root check: only missing_local_asset (m11 for s11, m12 for s12 to s16). merc-tags --check clean for all three.
  Passes at 12:07: m12-blue and m12-orange still .part.webm, so the S16 hop-top still and every Merc-covered
  hold are unproven.
- 15:36-18:45 host pass (m12-blue 14:02, m12-orange 15:17 in; script lab/s14-recap/hostpass.sh, one render at a
  time, nice 10, TMPDIR=/dev/shm, waits for 1150 MB). Holds with hosts: s14 0.4 s (0.2 per 30 s), longest 0.2, no
  final hold (the empty F0 before the cut is covered: before 1.7 s + 0.3 final); s15 0.1 s at the cut (same);
  s16 0.1 s at its first sample (before 0.2). Merc blinks show as 0.05 % single-frame pops in s14.
  S16: the pass's celebrate hop is about 76-79 px (bright body top 539 -> 463, glow 516 -> 453 at end + 1.2),
  not 30; with the address on end + 1.2 it rose in beside the orange head (16 px at 7 % opacity, 18 px low).
  Fix: URL = end + 1.35 (first visible at +1.40, heads then 518-527, >= 57 px; at rest address and underline
  bottom 452 vs glow 512-516, body 516-530: >= 60 px). A render whose first try failed lost the Mercs for its
  first three frames (a 3.0 pop at 0.067); re-rendered clean.
  S14: body + glow edge 189-192 vs stair 1 at 228 (F-recap-1) and 219-225 (F-recap-3): 36-39 and 30-36 px. The
  pass's talk arcs reach x 208-217: 9-13 px from stair 1's block in F-recap-1 (b47), 21 px in F-recap-3 (b51).
  Handoffs (host stills): s14 64.733 = s15 0 and s15 8.267 = s16 0, Merc boxes identical, <= 0.0013 % over 24.
  npm run check: 0 lint errors; layout 3 errors, all in s06 and s11 (not group F). Text sweep s14-s16 clean.
  18:41 kit change (bokeh/staves brighten during camera moves): s14 re-rendered.
- 20:15-21:10 round F-01 (DECISIONS 97). Backups: lab/<s>/<s>.r5-before.html. Tools: lab/s14-recap/tools/times.cjs
  (cue and word times), stills.mjs (seek-proxy stills at given scene times), keepout.py (Merc ink vs a box);
  renders lab/s14-recap/hostpass5.sh (previous host clips kept as clip-h1.mp4 / measure-h1, new measure-r5).
  1. Join: card, ladder and practise card fade 469.69-469.99 (was 0.2 s); the top rung (card time x 1454-1510,
     y 230, 45 %) brightens to full (469.69-469.89) and slides to (560, 520) (469.89-470.69, power2.inOut =
     GSAP cubic), condensing (470.29-470.69: a capsule shortening 52 -> 0 and thickening 4 -> 44 px, the L.bead
     in over the last 0.15 s). carryAt(t, tc) is the same code in s14 and s15. Seek proxy: s14 at D and s15 at 0
     identical in the rung's box (max 0). Lab clips: s14's last frame (film 470.227) rung centre (1212, 314.5),
     s15's first (film 470.243) (1172.5, 326.5), as computed (1212.9, 314.7) and (1173.1, 327.2). On the film's
     grid: 470.233 -> (1198.1, 319.3), 470.267 -> (1106.3, 348.2). S15: no drop; the bead from 470.69 hovers as
     before; '"support"' on b55 "Singers" (472.15, was "support" 473.14).
  2. Ladder large (454.0-459.4): panel 200-1720 x 140-620; x' = 200 + (x - 300) * 1.1515; playhead 884, y 248-589;
     title (234.5, 217), ILLUSTRATION right edge 1685.5 at 217; pitches G4 557 A4 509 B4 461 C5 437 D5 389 E5 341
     F#5 293 G5 269 (24 px a semitone); rungs at x 996.8 1109.7 1222.5 1335.4 1448.2 1561.1, 90 px, 6/4 px, 100 89 78
     67 56 45 %; violet G4 246-545.5, A4 614.5-884; amber dash 246-884 at 509; pill 824-876 x 464-498. Ease to card
     time 459.40-460.00 (b53 "time." + 0.05, 0.6 s power2.inOut): box 300-1620 x 150-460, G4 422 ... G5 230,
     rungs 56 px, playhead y 220-440, pill 834-886 x 345-379. Type keeps its size. Keep-out on the clip: Merc ink
     tops 662-667 vs the panel's foot 620 (41-47 px; body boxes 28 px).
  3. Brackets (S6's, world y 458 / 276, ink, tick 8): lower on "Two" 417.54, upper on "groups," 417.77 (0.5 s
     power2.out), gone with the labels at 419.62. Clip: lower 226-818 x 496-508, upper 826-1418 x 269-280; riser 4's
     "T" 36-40 px below the lower; S labels and stair tops 80+ px. Both allowances used: card 1 and its panel leave
     at b47 "Two" - 0.5 (417.04, gone 417.47; labels all landed by 416.55, settled 417.05); both houses leave
     413.0-413.3 and return 419.62-419.92. Riser 4's "T" scales 1.2 (kit 'label' pulse) about its centre (anchor
     moved 11 (s-1), 14 (s-1)); clip: T centre (800.0, 565.0) at rest, (798.5, 564.5) at the pulse.
  4. Panel per card: in over the 0.2 s before each card's first line (card 1 407.24-407.44), rising 12 px, out
     with its lines (0.43 s); between cards 3 and 4 it dips to 18 % and comes back. Kicker on the recap mark 405.64.
  5. One ripple: the stairs light in turn on "steps" (408.29 + 0.07 n). Removed: stairs on "check." (406.47),
     "scale?" (409.56), b48 "major" (420.58), o13 "major scale" (443.83); C major's keys on "major scale" (409.09);
     all eight black keys on "black" (422.98); G major's keys on b52 "scale" (451.37); the tile ripple on
     "pattern" (407.77); the risers' ripple on "steps"; the rungs' ripple on b53 "major scale". No beat added.
     Proxy without hosts showed gaps of 0.5-1.3 s, all inside Merc's or Tavi's lines; with hosts none over 0.2 s.
  6. ti home: top house unlights 433.09-433.29 as the bead drops onto ti; the bead rests on ti; on do's onset
     (tiDo + 0.45 = 433.74; the ti-do sound's C5 onset measured 433.725-433.745) it hops (0.3 s, lift 16) into the
     house centre, shrinking from 433.83 to nothing at 434.04, drawn under the houses; the house lights
     433.74-434.04; one echo ring at 434.04. Clip: bead on ti centre (1302.5, 335.5) by ink, house centre (1472.5, 277).
  7. Practise card baselines 540/610/670/730/790/850, underline 554; line 1 at 460.00, line 2 460.30, phone line on
     the card mark 465.69; icon glows 465.80/466.60/467.40/468.20. Line 1 cap top 506 vs box foot 460: 46 px.
     F-recap-3 on the clip: names baseline 854, "S" baseline 358, house centre (1472.5, 277), bead ~(1303, 336).
  8. S16: the wordmark's clipPath is a mask with a 60 px (78.7 lockup units) linear feather; the edge runs 0.83 s
     power3.inOut from x 270 until the feather clears the wordmark + 30. Clip: the fade spans about 60-70 px.
  Holds (hosts, measure-r5): s14 0.5 s (0.2 per 30 s), longest 0.2 (405.89); s15 0.0; s16 0.1 at its start.
  Renders: s16 20:37-20:40 and s14 20:42-20:49:52 (old bokeh), s15 20:49:52-20:51:10 (DECISIONS 100 bokeh);
  s14 and s16 re-rendered from 20:54:48 on the new kit.
  Re-renders on the DECISIONS 100 kit: s14 20:54:48-21:02:07 (holds 0.6 s, 0.3 per 30 s, longest 0.2: 405.89,
  423.99, 432.99, 451.69, 466.49), s16 21:02-21:03:11 (0.1 at its start). S15's second echo ring (477.72, 0.9 s)
  was still at 12 % at the cut and vanished across it: the rings now fade with S15's exit (o14 end + 0.07, 0.3 s);
  s15 re-rendered 21:04:06-21:04:40 (holds 0.0).
  Handoffs (lab frames): S13 (E's 20:10 clip, last 60 fps frame) -> S14: Merc boxes within 5 px, 0.03 % over 24,
  max 41 outside the Mercs. S14 -> S15: the Mercs identical (<= 4 px), outside them only the rung's own motion
  between the two lab frames (0.016 s of film apart): 1212,314.5 -> 1172.5,326.5. S15 -> S16: 0.011 % over 24,
  max 20 outside the Mercs. npm run check: lint 0 errors; layout 1 error, s06 129.21-130.02 (not group F);
  contrast 59/59. clock-lint clean; merc-tags --check s14 s15 s16: 12 tags, 0 stale. Text sweep s14-s16 clean
  (lab/s14-recap/sweep-r5.log). Scratch frames in /dev/shm deleted.
- 23:28-00:05 round F-02 (DECISIONS 102). Backups lab/<s>/<s>.r6-before.html; round-1 clips kept as clip-r5.mp4.
  60 fps renders with lab/s14-recap/tools/hostpass60.sh (a copy of E's): s14 23:34:46-23:48:09, s15 23:49:31-
  23:51:02, s16 23:51:15-23:52:01; measures in lab/<s>/measure-r6.
  1. Carry 2.0 s: carryAt u over tc + 0.2 .. + 2.2 (469.89-471.89), condensing over the last 0.4 s, bead in over
     the last 0.15; S15 lands at at('card', 'end', 2.2). Peak 24.0 px a frame at 60 fps (470.88), was 60.4. Rung:
     S14's last lab frame (film 470.227) (1464.5, 235.0), S15's first (470.243) (1461.5, 235.5) measured; computed
     (1464.8, 235.4) and (1462.2, 236.2); film grid 470.233 (1463.8, 235.7), 470.250 (1461.0, 236.6).
  2. Speech marks (S15 r5 clip, every frame): Merc's reach x 217 (y 734-776), Tavi's x 1692 (y 735-792). Large
     layout: panel 240-1672 x 160-720 (right edge narrowed from 1680: 1680 would be 19 px from Tavi's marks);
     x' = 240 + (x - 300) * 1.0848; playhead 884.4, y 286-684; title (272.5, 250); ILLUSTRATION right 1639.5 at
     250; G4 658 A4 598 B4 538 C5 508 D5 448 E5 388 F#5 328 G5 298 (30 px); rungs 990.7 1097.0 1203.3 1309.6
     1416.0 1522.3, 90 px, 6/4 px, 100-45 %; violet G4 283.4-565.5, A4 630.5 + 20 px stub, drawn on to 884.4 over
     456.51-457.74 (sing -> back,, power1.inOut); amber 283.4-884.4 at 598; pill 824.4-876.4 x 553-587. Removed the
     waver on "sing" and the first rung's pulse on "major scale" (the draw-on is the beat there). Clip: A4 violet
     630-651 at 456.49, 630-755 at 457.09, 630-883 from 457.79; panel 239-1672, foot 720; Merc's marks 31.8 px from
     the panel at their closest during b53 (458.88); bodies 44+ px.
  3. "Singing Voice Range": one 1.2 swell (kit 'label') on "range" 461.49, from its left edge. Clip 461.64: ends at
     x 1580, "Singing" stays at 1156, "›" 1137-1143 untouched.
  4. Cards 3 and 4 bring their panel with their first line (lead 0, on the line's curve); it leaves with the lines
     (0.43 s). 3 -> 4: out 443.01-443.44, in 443.51-443.71. The same dip between 2 and 3 (428.84-429.27, back from
     429.24) is gone too.
  5. The address underline (468.94) removed: the pause ends on More's sweep and glow (468.2). Pause holds: 466.49
     0.1 s and 469.19-469.59 0.4 s.
  6. The arrow: S3's shape (Q = A + 8 px, B's height), tip at world (1114, 316); clip: ink to x 1440, wall at 1445.
  7. Stair lights: 416.89 stairs 3/4/7/8 on b47 "semitone." (twoS, 416.75), 420.49 stair 1 on b48 "Start"
     (420.25), 424.29 stairs 1/8 on b48 "need?" (424.18), 446.29 stair 8 on o13 "note" (446.18), 452.09 stair 1
     on b52 "starts:" (451.77). All on words; none removed.
  Holds (60 fps): s14 0.9 s (0.4 per 30 s), longest 0.4 (469.19), 0.1 at 405.99 423.99 429.29 432.99 466.49;
  s15 0.1 (472.04); s16 0.1 at its start. Pops at 417.21, 460.79, 462.79, 465.93 are card lines leaving/landing.
  Handoffs: S13 (E's 20:10 clip) -> S14 0.0068 % over 24, max 43; S14 -> S15 0.0148 %, outside the Mercs only the
  rung (3 px between the two lab frames); S15 -> S16 compared on S15's last film frame (lab frame 496, 8.267):
  0.0057 % over 24, max 56. The lab clip's own last frame (8.283, not a film frame) has no Mercs: the tags end half
  a frame after S15's last film frame (8.274). Lab-only; reported (merc-tags could end a pass at the scene's end
  when it runs past it, as it does at the start).
  Checks: clock-lint clean; merc-tags --check 12 tags 0 stale; npm run check lint 0 errors, layout 1 error in s06
  (129.21-130.02), contrast 59/59, none in S14-S16; text sweep clean (sweep-r6.log). /dev/shm scratch deleted.
- 01:09-01:45 round F-03 (DECISIONS 108). Backups lab/<s>/<s>.r7-before.html; round 2's clips kept as clip-r6.mp4;
  renders (60 fps, tools/hostpass60.sh with KEEP/MEAS): s14 01:16:46-01:29:45, s15 01:30:54-01:32:08; measures in
  lab/<s>/measure-r7. S16 not re-rendered (unchanged).
  1. S15: '"support"' lands with the kicker on b54 "Next" (470.71; was b55 "Singers" 472.15) and scales 1.2 once
     (kit 'label') on b55 "support" (473.14; the pulse on o14 "that" is gone). The carry keeps its times and
     power2.inOut but follows a path read by arc length (CARRY, the same code in both scenes): a cubic from
     (1482, 230) via (1482, 330) and (1250, 520) to (1000, 520), then y 520 to (560, 520); 1038 px (was 966).
     Peak 25.7 px a frame at 60 fps (470.88; was 24.0). Nearest the word's ink from 470.71 (ink > 40, its rise
     included): 53.4 px (471.09, under "pp"); 55 px on proxy stills. Centre: S14 last film frame (470.233)
     (1479.2, 250.2), S15 first (470.250) (1478.4, 253.3); lab frames 470.227 (1479.5, 249.2) and 470.243
     (1478.7, 251.9); clip 1479.0, 248.5 and 1478.0, 251.5. Proxy: s14 at D = s15 at 0 (max 0 in the rung box).
  2. Every card's panel comes in with its first line on the line's curve (0.2 s): clip, card 1 text from 407.44,
     stroke from 407.54; card 2 text from 420.26, stroke from 420.26. Before: panel 0.17 and 0.22 s ahead.
  3. Icon pulse 1.25 -> 1.15; the gear's slot +2 px left, +1 right, More's +1 each side (the range swell still ends
     at x 1581). Closest glow/icon ink (> 45) to type at the peaks (proxy, against a rest still): x 14 px, gear
     8.9 (466.70) and 8.5 on "Settings" (462.41), Exercises 10, More 9. Before (1.25, no pad): gear 7, More 8.
  Holds: s14 0.5 s (0.2 per 30 s), longest 0.1 (405.99, 423.99, 429.29, 469.19, 469.39); s15 0.2 s (471.94,
  476.14). Handoffs: S13 (E's 00:35 clip) -> S14 0.0064 % over 24, max 50; S14 -> S15 0.0201 %, outside the Mercs
  only the rung (3 px between the lab frames); S15 -> S16 (round 2's s16 clip) 0.0042 %, max 45, the Mercs now on
  S15's last lab frame. Checks: clock-lint clean, merc-tags 12 tags 0 stale, npm run check 0 errors (contrast 59/59),
  text sweep clean (sweep-r7.log). Scratch in /dev/shm deleted.

## Polish round (30 Oct, film critic FILM1; DECISIONS 122; brief polish/BRIEF-F.md)

- Items: 1 the empty frame before the tease (card exit 0.3 s or more, the rung growing about 2.5x on its
  travel, "NEXT TIME" and '"support"' within 0.3 s of the cut); 2 the end card complete by 479.9 (s16 1.37)
  and its two lower lines at Outfit 500 52 px or more; 3 the gear's halo 8 px from its words.
- Backups: lab/<s>/<s>.p1-before.html (the F-03 files). Renders: TMPDIR=/dev/shm, --output /dev/shm/l4lab-F/,
  then mv into the lab folder; one at a time, --workers 2 at most.
- 12:15-13:40 tools (new): lab/s16-end/tools/stills.mjs (stills.mjs with SRC=<file> to load a copy of a scene),
  hostmask.py + hostclean.py (the hosts' ink and glow per frame, from a hosts-only S16 render, lab/s16-end/projH:
  room.mid hidden, against its own proxy stills), cardgap.py (each card row's nearest approach to the hosts over a
  span of frames), settle.py (when each card band stops changing, on a copy with drift, dust, beads and halo
  breathing off: projH/s16-still.html); lab/s15-next/tools/rungword.py (+ var/*.html: the rung against
  '"support"'); lab/s14-recap/tools/gearhalo.py (F-04's halo measure, luma > 30, connected to the gear);
  lab/s14-recap/tools/polish-render.sh (the round's renders: /dev/shm output, 2 workers, then mv).
  1. S14 exit: the ladder fades evenly over 0.5 s and the card's lines leave up in turn (0.42 s, 0.02 s apart),
     469.69 to 470.21 (CARD_OUT 0.52; was 0.3 s power2.inOut). carryAt (both scenes): the rung grows 2.5x over
     the glide's first 0.7 s (469.89 to 470.59; 56 x 4 to 140 x 10) and condenses from there; path, times and the
     landing (560, 520) unchanged. S15: kicker and '"support"' on at('next') (470.39, was "Next" 470.71);
     '"support"''s fade on power2.out, the kicker's curve. Rung to word (proxy, every 60 fps frame): 44.0 px
     nearest (470.78); was 53.4.
  2. S16 layout: tag 112 px at baseline 326 (was 120 / 330), address baseline 412 (was 440; underline y 421-424),
     lines Outfit 500 54 px at 496 and 564 (were 40 px at 510 / 570; icons 43.2 and 48.6 px, centred 0.35 em
     above the baseline). Times: orb end + 0.15, wave + 0.27, wipe + 0.25 (whole by + 1.08), tag + 0.45 (0.6 s),
     address + 0.55 (in 0.3 s, rise 0.45 s), underline + 0.67 (0.4 s), lines + 0.75 and + 0.87 (0.45 s), beads fly
     + 0.15 for 0.8 s from inside their moving Mercs (squash 0.25 s). The hop's top (479.73): address 27.5 px from
     the hosts' faint glow, 31.8 px at luma > 30. Lines 107 px or more from the hosts at every frame.
  3. Gear slot padL 2 -> 6, padR 1 -> 5 and its own glow filter (stdDeviation 1.1, was 1.6). Clip of the first
     try (padR 4): 11.0 / 8.1 px (F-03 clip 5.4 / 6.3); codec ringing takes about 2 px on the clip, so padR 5.
  Renders: s16 13:07-13:08, s15 13:08-13:09, s14 13:10-13:18 (exit then re-timed to even fades and padR 5;
  re-render from 13:23).
- 13:23-13:45 final (S14 re-rendered 13:23-13:30 with the even exit and padR 5; s15 and s16 clips from 13:08).
  Clips: lab/<s>/clip.mp4 (60 fps), measures lab/<s>/measure-p1; F-03's clips and every older lab clip deleted.
  1. Exit, S14 clip (the card's light over its band, the rung's column left out): 95 to 5 % 64.267 to 64.667
     (0.40 s, 12 film frames; 99 to 1 % 0.47 s), gone by 470.19; F-03 0.15 s (5 frames). S15 clip: kicker and
     word first visible 0.167 (470.41), the word full by 0.28, the kicker by 0.33; F-03 0.50 / 0.55. Rung: S14's
     last lab frame (1479.0, 248.8) 93 x 7 px, S15's first (1478.4, 251.5) 98 x 8 (F-03 (1479.0, 248.6) 55 x 4 and
     (1478.2, 251.5) 56 x 4); 140 x 10 from 470.59; lands (560, 520) as before. Frame-only stretch now 470.21 to
     470.41 (rung and Mercs), was 469.96 to 470.79.
  2. S16 clip: complete by s16 1.32 (479.85; on a copy with drift, dust, beads and halo breathing off, every
     band pixel-identical to the last frame from 1.25): holds 3.88 s. Hop's top (s16 1.200, 479.73): address
     27.5 px from the hosts' faint glow (luma > 30: 31.8), at rest 89 px or more. Lines' ink (luma > 90): 51 px
     (skip line, cap to descender) and 40 px (Scale Runner line, no descenders); F-03 38 and 30 (mean 34, the
     critic's figure; now 45.5). Lines 106.9 px or more from the hosts at every frame.
  3. Gear (F-04's measure, on the clips): 12.0 px to "first:", 9.5 to "Settings" (F-03 clip 5.4 / 6.3). Line 3
     now x 405-1515 at rest; the range swell peaks at x 1586 (was 1581); "Singing" still clear of the "›".
  Holds (measure-p1): s14 0.5 s (0.2 per 30 s), longest 0.1 (405.99, 423.99, 429.29, 469.19, 469.39: as F-03);
  s15 0.2 s (471.94, 476.14); s16 0.1 at its start. Handoffs: S14 frame 0 identical to F-03's (max 0); S14's last
  and S15's first differ from F-03's only in the rung's box (its size) and render-to-render Merc noise (144 px
  over 24 against 511 for a frame's own step); S15's last and S16's first: middle max 18-20, S16 frame 0
  identical to F-03's. check 0 errors (group F's warnings as F-03: duplicate_media x3, s14 file length), contrast
  59/59; clock-lint silent; merc-tags 12 tags, 0 stale; text sweep clean (lab/s14-recap/sweep-p1.log).
  Stills: lab/s14-recap/polish/, lab/s15-next/polish/, lab/s16-end/polish/.

## Polish round 2 (30 Oct, film critic FILM2 item 3; DECISIONS 130; brief polish2/BRIEF-F.md)

- One item: S15's bead flies across the cut into the end card's blue bead (which no longer rises from
  Merc); no frame 478.2 to 479.0 holds only the Mercs; the card complete by 479.85 as now; HANDOFFS.md not
  edited (the report lists the new values). S14 is not touched.
- Backups: lab/s15-next/s15-next.p2-before.html, lab/s16-end/s16-end.p2-before.html (the polish-round files).
- 21:59-22:15 built (no render yet). Tools (lab/s16-end/tools/): probe.mjs (each visible bead's centre, scale,
  opacity and colour per scene time on the seek proxy; EVAL= adds an expression), flightsim.py (a candidate path
  against the type's ink boxes, opacities and rises per 60 fps frame), flightgap.py (the same on probe output, as
  drawn), sheet.py (a contact sheet labelled with film times).
  S15: A.fly = at('o14', 'end') (478.13), A.flyEnd = at('end', 'start', 0.95) (479.479); from A.fly the bead is
  on FLIGHT at full (no lift, no fade); the type, line and rings leave as before (o14 end + 0.07, 0.3 s).
  FLIGHT (both scenes, identical): two cubics (1360,520) (1180,455) (900,440) (700,432) | (560,425) (505,300)
  (482,106), 401 points, read by arc length, sine.inOut over A.fly..A.flyEnd; 1099 px.
  S16: the blue bead = FLIGHT + w (orbit point - FEND), scale lerp(1, orbit scale, w), w = P(t, 0, FLYE,
  power2.inOut); tint chrome -> blue over FLYE - 0.6 (0.5 s, sine.inOut); squash at FLYE as before; opacity 1
  from 0. Orange unchanged. Proxy: S15 at D = S16 at 0, (1145.0, 468.8) scale 1, chrome; from 0.95 the blue
  bead and every card pixel as before.
- 22:16 check (root-check-p2.log): 0 errors, but a new warning, s16-end composition_file_too_large (324 lines;
  the rule is <= 300 structural lines). FLIGHT compacted (same points, same numbers, identical in both scenes),
  the blue bead folded into fly() and comments trimmed: s16-end 298 lines, s15-next 193. Probe after: unchanged.
- 22:19 renders (tools/polish2-render.sh: 1 worker, /dev/shm, measure-p2); the F-p1 clips parked in
  /dev/shm/l4lab-F/p1/ for the before/after compares. s16 rendered 22:19-22:21: holds 0.0 s (p1: 0.1 at its start);
  single-frame events as p1 (2.683, 3.100, 3.200, 4.233 jumps). Text sweep s15 + s16 clean (sweep-p2.log).
- 22:21-22:23 s15 rendered (holds 0.2 s, 1.70 and 5.90 = 471.94 and 476.14, as p1; the 8.017 / 8.067 jumps of
  the old bead's lift are gone; other single-frame events as p1). Clips: lab/s15-next/clip.mp4,
  lab/s16-end/clip.mp4 (60 fps); measures lab/<s>/measure-p2.
  Bead in the clips (tools/clipflight.py, every frame S15 7.8 s to end, S16 0 to 1.5 s): found in every frame
  478.04 to 479.98; measured centres within 0.5 px of the computed ones from 478.34 (before that the finder
  merges the bead with the line and the echo ring). S15 last lab frame (film 478.5263) (1147.5, 469.5) 45 x 45,
  S16 first (478.529) (1145.0, 468.5) 44 x 45, both chrome; computed (1147.7, 469.2) and (1145.0, 468.8). Film grid:
  478.5167 (1157.3, 470.7), 478.5333 (1140.6, 468.1). Lands (481.5, 105.5) at 479.479, blue, squash to 479.729.
  Compares (480 px box means, codec noise is max ~14): S15 frame 0 = p1's (max 0); S15 up to 478.126 = p1's;
  after it only the beads differ; S15 last vs S16 first outside the bead max 46 (Merc edges), middle max 17;
  S16 from 0.95 s = p1's (max 12-14 at 480 px; last frame max 0). Proxy: S16 outside 80 px of the beads max 1
  at every 30 fps step 0 to 1.24 (the card builds as before).
  Gaps (proxy ink, while the type is at 5 % or more): '"support"' 77 px or more, "what keeps it steady?" 80,
  tag 52 (479.00, at 10 %), address 70 (479.10), orb 90, the blue Merc's body box 187; peak 22.2 px a frame
  (478.83). Stills: lab/s16-end/polish2/ (flight-sheet-clips.jpg, cut-bead-crop.png, landing-crop.png,
  handoff-s16-first-0.000.png), lab/s15-next/polish2/ (handoff-s15-first-0.000.png, handoff-s15-last-8.283.png).
- 22:25-22:31 check re-run (root-check-p2.log): 0 errors; group F's warnings as p1 (duplicate_media x3, s14
  file length); contrast 59/59. clock-lint silent on all three; merc-tags 12 tags, 0 stale. /dev/shm/l4lab-F
  deleted (the p1 clips with it); the per-frame bead log is lab/s16-end/polish2/clipflight.txt. Round done.

## Holds round, item 2 only (1 November; polish5/BRIEF-D.md, builder D): the practise card

Film round 5, item 4, at s14 61.93 to 63.13 (8:46.0 to 8:47.2). Backup: lab/s14-recap/s14-recap.holds-before.html.
- "Singing Voice Range" no longer swells 1.2 from its left edge on "range" (A.rangeW, 62.57), which pushed the
  centred line's right end about 30 px out. A swell about its own centre would reach the "›" before it (one
  space away), so it is marked by brightness: its blurred shape in chrome under it (feGaussianBlur 6 on its alpha,
  flood opacity 0.8 at most), on the pulse's own curve (L.lit, long: up 0.15 s power2.out, back over 0.8 s
  sine.inOut), the filter on only while it glows (as s11's labels). The phrase and the line do not move.
- The gear (the y 670 line's icon) fades in with a scale from 0.88 to 1 over 0.3 s (power2.out) from the same time
  as its old pop (the line's start + 0.15 s, 61.88), instead of popping from 0.4 on back.out(2) over 0.5 s. The
  other three icons keep their pop (the item names only the gear).
- Stills at 61.8, 62.0, 62.2, 62.6, 63.0 and 63.4, before and after: lab/s14-recap/holds/stills-sheet.png; the line
  at 2x, before over after: lab/s14-recap/holds/line-2x.png (lab/s14-recap/linecrop.py). clock-lint silent; the
  text sweep clean (as before); merc-tags 4 tags, 0 stale.
