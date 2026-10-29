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
