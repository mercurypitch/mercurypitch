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
