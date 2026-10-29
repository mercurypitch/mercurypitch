# Build notes: group E (s12-sing, s13-your-turn)

Running notes so a container restart or a usage-limit pause can resume. Builder E owns
`compositions/s12-sing.html`, `compositions/s13-your-turn.html`, `lab/s12-sing/` and
`lab/s13-your-turn/` only. Clock: Kokoro scratch, 483.73 s (cues.json = tools/board-cues.json).

## Spans

- s12-sing 341.242 to 372.917 (D 31.675); cuts on act4 (341.392) 0.15 s early.
- s13-your-turn 372.917 to 405.494 (D 32.577); ends 0.15 s before recap (405.644).

## Merc passes (mine: m12-blue, m12-orange; 8,438 frames each, filmStart 343.2, size 520)

- 09:50: both still rendering (.part.webm). L.mercGate warns and uses 30 until whole.js lists them.

## Plan (09:50)

- S12: kit L.stairs + L.strip for the D-to-E frame; my own rows (the kit's look, the kit's
  keep-out mask) so they can stretch into lanes; my own tread rects that become the band.
- Tip (provisional): rows on one affine map (x 220-1680 -> 600-1440, 26 -> 46 px); treads to
  segments; blocks collapse up into their treads while they fade; names and bottom house ride
  their stair and fade; top house rides to (1381, 116).
- S13: the S12 guide drawn from the same formulas (G(u) for the move), then the plain guide; the
  reverse tip: lanes to C's rows, segments to C's treads, blocks grow down from them (the kit's
  own block elements, geometry overridden until the morph lands), names ride the growing foot.

## Log

- 10:10 S11 to S12 at the true film frames (seek.mjs, 45.2973 / 0.008): max 10, mean 0.041, none over 16.
- 10:15 S12 to S13 (31.6747 / 0.0163): max 61 at the orange bead only (x 1418-1462, y 162-207). Cause:
  the bead's own end-of-run pulse settling across the cut (scale 1.0294 then 1.0235, then 1.0184 at
  0.033); same position (1440, 185), same paint order. With both forced to one scale: max 11, none
  over 16. Frame-to-frame inside either scene the same pulse gives max 39 to 41. Continuous.
- 10:16 S13's last frame (32.5663) against a kit-only F0 drawn to HANDOFFS § E to F
  (lab/s13-your-turn/ef-ref.html): max 0, identical.
- 10:20 holds.sh: a predictor of measure.py's holds from exact stills (0.1 s, 320 px, gray diff);
  it matched the real clip to 0.1 s on every run.
- 10:25 s12 hold breakers, all tied to words: ti's segment glows on b39 "tee," (L.light 0.3/0.6);
  the house sends a ring on o12 "listen"; do's segment (the path's start) lights on b40 "Try";
  a sweep do to do travels over b40 "octave up." (word to word end); do's segment and the house
  glow once more as sing-a ends (0.3/0.5); the bead's and lit band's fade on "Yes." made linear;
  the arrow's draw power1.inOut (it started too slowly to register). Long holds 0.6, 0.6, 0.8 gone.
- 10:40 Director: the hosts' entrance moved (DECISIONS 81): drops 342.50 to 343.35 (Merc) and
  342.62 to 343.47 (Tavi), tall intro columns from y 223 down (pad 352). merc-tags.py s12-sing
  re-run: seg1 (tall) and seg2 (head) tags added; a second run changes nothing. merc-tags --check
  then reports those 8 seg tags and "intro tags" stale on every run (its add_segments strips and
  re-adds bare seg tags before comparing): a tool bug, reported, not fixed (director's tool).
  Card type box x 665 to 1259 (y 107 to 579) at every sample 342.50 to 343.50: 329 px clear of
  Merc's column (x 144 to 336) and 345 px of Tavi's (1604 to 1796), at any height.
  The no-Merc stretch in S12 is now 341.24 to 342.50 only.
- 10:50 s13 hold breakers on words: do, re and mi's names light on "doh, ray, mee"; the top do's
  name brightens on "octave" (as the bottom do's on "Start"); ti's name lights on b43 "tee,"; the
  top do's segment glows on "go."; the hold's glow on "Wait" made a linear ramp (no plateau).
  13a and 13b (Merc talking) still hold in the lab clip, which has no hosts.
- 11:00 Checks measured: beads land 22 px clear of "do" (body x 578 vs name box right 556); the
  landing squash narrows it to 19.4 px for about 0.1 s. Bead on do (y 163 to 207) under the
  house (box y 92 to 140; HANDOFFS 90 to 142): 21 to 23 px; at the 1.2 pulse the bead's top is
  158.6, but the shapes never share an x (house right 1408, bead left 1413.6), 27 px apart.
  S13 at 373.50: top do box 836.8 to 873.8 (HANDOFFS 812); at 373.55: 892 (HANDOFFS 857); title box
  x 360 to 799.5, ink 362 to 788 (HANDOFFS 811). HANDOFFS's figures fit a quadratic in-out; GSAP's
  power2.inOut is cubic, so the names are further right than it says (more clearance, not less).
  Care block: right edge 921.4 (<= 960), bottom 795 (< 864).
- 11:25 s12 lab clip (no hosts: every m12 pass still missing) measured: holds 2.0 s (1.9 per 30 s),
  longest 0.3 s; none over 0.5. In the no-Merc stretch (341.24 to 342.50): 0.1 at 0.0 and 0.2 at
  1.0 (the card settling before its breath). Single-frame events: four small jumps (0.03 to 0.08 %
  of pixels) at event onsets (4.667 the sweep, 5.700 "wait", 6.000 the home glow, 21.400 the chip).
  A 0.7 s tail on the run-end glow made a 0.5 s hold (too slow to register); back to 0.5.
- Text sweep: clean on both scenes (one landing sample of "wait" at alpha 0.39 is the only one
  under 4.5:1). Doctor lines 8.50 to 8.89:1. hyperframes check: only missing_local_asset for the m12
  passes in my scenes (plus warnings shared by every scene: nested media start, refl twins, length).
- Handoffs re-diffed after the last edits: D to E max 10; S12 to S13 max 61 (the pulse); E to F 0.
- 11:18 s13 lab clip (no hosts) measured: holds 17.1 s (15.7 per 30 s), longest 3.5; every hold
  inside 373.85 to 394.24, where m12-blue's shot is in its 'sing' state (talking b41 to b44 and the
  count-in, shot t 29.67 to 52.05). The your-turn pause (395.24 to 403.84): no hold at all (the
  cursor). Count-in 0.5 s (the bead held on do while Merc sings it). A landed talking pass (m08
  orange, over the room colour, at 50 px = 300 px in measure's 320-wide frame) breaks a hold in 35
  of 37 talking samples and 17 of 36 idle ones: Merc's talking should fill 13a and 13b. Re-measure
  once m12 lands.
- 11:40 Usage pause and resume. The m12 tall intros landed (orange 11:24, blue 11:32); runtime stills
  of the drops (lab/s12-sing/drops-sheet.png, columns marked): the card clear of both falls; after
  the tall segment each host vanishes (head passes not rendered yet, as the director said).
  Old pre-curve stills moved to lab/s12-sing/old-stills/.
- 11:55 s12 lab clip with the tall intros: holds 2.0 s (1.9 per 30 s), longest 0.3; the 0.1 s hold
  under Tavi's fall is gone. One large jump at 2.067 s (343.31): her tall segment ending with no
  head pass to take over (the missing m12-orange-in), as expected. clock-lint silent on both.
- 11:45 merc-tags --check: s12 0 stale, s13 0 stale (the tool has changed since 10:40; the stale-forever
  report on intro tags no longer happens).

## Host pass (every m12 video in; kit with the long falls and the near bokeh)

- 15:34 tools: hostpass.sh (waits for 1150 MB on /, nice 10, TMPDIR /dev/shm, one clip at a time, then
  measures); seek.mjs HOSTS=1 (keeps the Merc videos, serves byte ranges, seeks each to its own media
  time and waits for the presented frame); hostmask.py (hosts' painted extent = host still minus a
  host-free still at the same time). No-host clips kept as clip-nohosts.mp4 and measure-nohosts/.
- 15:41 s12 with hosts: holds 0.3 s (0.3 per 30 s), longest 0.2 (no hosts: 2.0 s, 1.9, 0.3). The old
  jump at 2.067 s is gone. New single-frame "pop" at 19.933 s = Merc's own blink in the pass.
- s12 falls (342.50 to 343.05, 342.62 to 343.17): every visible element of mine checked in the
  columns x 124 to 356 and 1584 to 1816, y 0 to 840: none (only the kit's bokeh and dust, the
  near layer); the card x 665 to 1259; the rows are world (DECISIONS 83).
- s12 at rest: Merc's painted extent (body, glow, reflection) x 110 to 373, Tavi's 1571 to 1833:
  146 px from the names (519), 131 px from the lanes' end (1440).
- 15:45 s13 with hosts (first): holds 2.3 s (2.1 per 30 s), longest 0.4 (no hosts: 17.1, 15.7, 3.5).
  13a and 13b (0 to 21.3): 2.2 s, 3.1 per 30 s.
- Merc's talking arcs in s13 reach x 351 (61 samples, 1.0 to 31.5 s, y 600 to 800): 9 px from the
  doctor lines' ink (x 360). Fix (mine): the care block's left edge 360 -> 380 (title, care lines,
  doctor lines, the "wait on ti" pulse centre); longest line now ends 941 (<= 960).
- 18:16 container restart; resumed 18:22. s13 beats added on Merc's words: a light runs the plain
  path do to do over "Otherwise," (the turn from listening to singing); "at about speaking volume"
  scales 1.05 on "volume."; a light runs along do's segment on "my note," and along the top do's on
  "up." (the two starting notes).
- Mouths: each bead lands as its host starts to sing (arcs from 0.1 s before Merc's onset at 348.19,
  Tavi's 0.14 s after hers at 363.72, Merc's count-in arcs 0.12 s after 394.24); no bead crosses a face.
- Handoffs with hosts at exact frames (seek HOSTS=1): S11 to S12 max 10 (no hosts on either side);
  S12 to S13 max 144, 1597 px over 16: Merc 1261 (S12's own last step 386, S13's first 1014: he
  starts "Now you"), Tavi 179 (steps 67 and 34), the bead pulse 157: continuous; S13 to S14 max 10,
  none over 16. (A first run showed Tavi missing at 31.6747: a decode race in seek.mjs, fixed by
  waiting for the presented frame.)
- E to F with hosts: Merc's extent 26 px from the strip's left end (240); Tavi's floor light (y 800 to
  880) 19 px from the strip's last key (1675), her body 42 px. HANDOFFS-fixed frame.
- 18:36 s13 with hosts, care block at 380 and the four beats: holds 1.5 s (1.4 per 30 s), longest 0.3;
  13a and 13b 1.4 s (2.0 per 30 s). Kept as clip-hosts-v2.mp4 / measure-hosts-v2.
- 18:40 one more beat: the stop line scales 1.05 (long settle) on "immediately" (holds sat at 390.9 to
  391.5 under it). Re-rendering.
- Text sweep after the move: no run under 4.5:1 in either scene; doctor lines 8.50 to 8.89:1.
- seek.mjs HOSTS=1 can still miss a head video's first frames (Merc absent in its still at 2.0000);
  the rendered clip shows him on every frame 57 to 63, so hand-over checks use the clip.
- 18:41 s13 final with hosts: holds 1.2 s (1.1 per 30 s), longest 0.3; 13a and 13b 1.1 s (1.5 per 30 s):
  0.1 each at 375.92, 382.12, 384.22, 386.22, 389.82, 390.02, 0.3 at 383.22 (the long "volume."),
  0.2 at 393.82 (the gap before the count-in); the your-turn pause none; the count-in 0.1.
- npm run check: lint 0 errors, runtime 0; layout's 3 errors are in s06 (129.21) and s11 (328.68),
  not mine; my scenes only warnings (nested media start, refl twins, length 341 / 383 lines).
  clock-lint silent on both; merc-tags --check 84 tags, 0 stale.
- lab/s12-sing/hosts/falls.png rebuilt from the rendered clip's frames (40 to 62).

## Round 2 (component critic E-01, DECISIONS 96)

- 19:28 onsets measured from the stems (tools/onsets.py; tools/cues.mjs resolves anchors without a
  browser): note changes on FACTS 68 within 4 ms; attacks out of silence (first note, do) 14 / 30 / 46 ms
  after FACTS at 2 / 10 / 25 % of peak, so keyed at +20 ms (ATTACK).
- S12 ride rewritten: 0.18 s hops (kit hopAt, lift 10) placed so the middle of the passage into the
  note's lane lands on the onset (semitone: its one crossing on it; tone: the lane between -21 ms, the
  note's lane +21 ms); the rest a power2.in rise from ti's end crossing into do's lane on do's attack;
  on do an ease to x 1418 (k 1.21 so the speed carries in); the end-of-run bead pulse and the cue-only
  run-end glow (sing-a's end) removed; do's echo rings on do's attack.
- S12 risers: bar, tick and the gold corner ride the treads; the gold pair fades 343.70 to 343.99, the
  tone risers with the blocks. Clip: no gold pixel from 343.942.
- S13 rebuilt: one path (S12's band thinning 14 -> 6 px and cooling amber -> chrome, full -> 70 %, 372.94
  to 373.54, with S12's 35 % layer under it while it cools so the seam matches), fills on lanes 0 2 4 5
  7 9 11 12 (chrome 6 %, inset 2), lane rules out 373.24 to 373.54; the segment under the cursor to full
  with the cursor's glow (0.1 s each way); Tavi on the guide's move to (1800, 840) at 300; Merc's breath
  curve 6p^2 - 8p^3 + 3p^4 (clears stair 1 at 404.656); the breath re-timed (see the report).
- Still checks: path luma 150, lit 202, fill 27, empty 16.5 (at 400 x 225: 132, 201, 27, 16); "wait on
  ti" at its peak ink y 461 to 495 from x 380, 12 px under the line above, 22 px over the stop line.
- 19:52 S12 at 60 fps with hosts: holds 0.3 s, longest 0.2. Crossings (clip, interpolated) -23 to +31
  ms; do's crossing exact on its attack (scene state; the clip's colour mask loses Tavi's dimmed bead).
- Handoffs (seek HOSTS=1 exact frames): S11 to S12 max 10; S12 to S13 1440 px over 16, all hosts
  (Merc 1261, Tavi 179), the guide 0; S13 to S14 max 10.
- Text sweep: no run under 4.5:1 in either scene. merc-tags --check: 16 tags, 0 stale.
- 19:59 S13 at 60 fps with hosts: holds 1.0 s inside (0.9 per 30), longest 0.3 (10.3 s, the pause at the
  end of the drawn-out "volume.", 383.22; 20.9 s, before the count-in's drop, 393.82), final 0.3 (the
  breath's settle, 405.12 on). Fixes: the "volume." swell held over the word (up 0.15 s from its start,
  back over its last 0.5 s, sine.in, so it moves until the word ends at 383.44); the count-in's drop
  lengthened to 0.35 s at the kit's own pull (184 px, from 393.89).
- 20:11 S13 final: holds 0.5 s inside (0.5 per 30), longest 0.1; final hold 0.3 s (the settle); with
  it, 0.8 s (0.7 per 30). Keep-outs from the clip (hosts' painted extent at threshold 24): Tavi's paint
  from x 1708 (body 1720.5) against the lanes' end 1700; Merc's paint at stair 1's start (404.656)
  between 242 and 223 (body 222.0, 20 px); segment 1 against Merc's paint at least 31 px.
- npm run check: lint 0 errors, runtime 0, motion 0, contrast 59/59; layout 1 error, in s06 (129.21),
  not mine. clock-lint silent on both; merc-tags --check 16 tags, 0 stale.
- Clips: lab/s12-sing/clip.mp4, lab/s13-your-turn/clip.mp4 (60 fps, hosts); round 1 kept as clip-r1.mp4
  and measure-r1. Sheets: lab/s12-sing/tip-sheet.png, lab/s13-your-turn/handover-sheet.png,
  rev-sheet.png, phone-400x225.png.
