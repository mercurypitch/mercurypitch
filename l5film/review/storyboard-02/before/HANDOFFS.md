# Handoffs v2: exact frames where one scene meets the next

The last frame of scene N and the first frame of scene N+1 show every carried object on the same
pixels (within 2 px). Values marked **(provisional)** are starting values the builders on either
side confirm in a lab still; this file is then updated and the mark removed before either scene is
built further. Unmarked values follow from the formulas below and are fixed now. Times are the
board clock's (STORYBOARD, header): orientation only, since every scene computes its times from
cues and words. v1 is kept in `review/storyboard-v1/HANDOFFS.md`; what changed is listed in
STORYBOARD's header table and DECISIONS 86 to 108.

Builder groups (STORYBOARD): [A] S1 to S4, [B] S5 to S7, [C] S8 to S10, [D] S11 and S12, [E] S13
to S15.

## Shared formulas

- Film time `T = L.scene(SID).start + t`. Anything that travels across a cut (a glow, a drift, a
  carried bead, the tease figure) is drawn from `T` on both sides with GSAP's own easing, so it
  matches at the cut.
- **Framing.** `x' = s x + ox`, `y' = s y + oy` from world (F0) pixels to the screen; a push about
  the world point `(cx, cy)` to scale `s` keeping that point still has `ox = cx (1 - s)`,
  `oy = cy (1 - s)`. A change of framing moves `s`, `ox` and `oy` together on one curve. The room's
  far, mid and near layers follow Lesson 4's `L.frameRig` with k = 0.25, 1 and 1.6: layer k draws at
  scale `1 + k (s - 1)` with offset `(k ox, k oy)`. The bokeh (`room.under`) moves as the near layer
  and brightens while it slides (Lesson 4 DECISIONS 89, 93, 100). No move in this film is a pan.
- **Matched cut** (new in v2; critic 01, item 0). Three pushes end on a cut instead of a pull: o8
  (178.83, F-gauge), sing (364.73, F-hold) and recap (478.09, F-turn). The scene before ends in its
  framing; the scene after starts at F0 and draws each carried object at the screen pixels the
  framing gave it, so in the new scene its world position is its old screen position (world =
  screen at F0). The room's layers start the new scene at rest (F0): only the faint room (staves at
  3.5 %, dust, bokeh) changes at the cut. Nothing eases the room back after the cut.
- **Object move.** A move in brackets on STORYBOARD's camera plan moves the object's own
  coordinates; `s`, `ox`, `oy` and the room stay as they are.
- **World or frame.** A label that names a part of a drawing is a world label (mid layer): it
  rides every move and scales with it, so its size is given in world px. Kickers, chapter cards,
  pills, ring timers, the four words, the recap panel, the practise cards, the care block, the feel
  block and the hook's type are frame-fixed (`hud`) and never move with the camera. In the turn the
  frame, the ring and their labels are world drawings (they ride the push at 423.50); the care
  block and the feel block are frame-fixed.
- **Hosts** are in screen space (`room.top`). A host's body box is about 0.53 of the shown size wide
  and 0.64 of it tall, standing on its feet point: at 240 it is x ±64, 154 tall; at 300 ±80, 192; at
  360 ±95, 230; at 400 ±106, 256; at 420 ±111, 269.

  | Place | Merc feet, size | Merc body | Tavi feet, size | Tavi body |
  | ----- | --------------- | --------- | --------------- | --------- |
  | Cold (S1) | (230, 840), 420 | x 119-341, y 571-840 | (1690, 840), 420 | x 1579-1801 |
  | Corners | (110, 840), 300 | x 30-190, y 648-840 | (1800, 840), 300 | x 1720-1880 |
  | Small (S6 to S9) | (100, 840), 240 | x 36-164, y 686-840 | (1820, 840), 240 | x 1756-1884 |
  | Merc right (510.05 to the end of S14) | (1290, 840), 300 | x 1210-1370, y 648-840 | (1800, 840), 300 | x 1720-1880 |
  | End (S15) | (1290, 840), 400 | x 1184-1396, y 584-840 | (1610, 840), 400 | x 1504-1716 |

- **Keep-out.** No drawing, label or mark within 20 px of a host's body box, in every framing and
  through every move. The tease's faint rows are masked round each host in screen space instead
  (Lesson 4's mask: clear within 20 px of the body, back to full over the next 60 px).
- **The floor** is the room's, y 840, full width, with each host's reflection at 16 %, whenever a
  host is on screen (`L.mercGate(..., { floor: false })` in every scene: no local patch).
- **Entrances and moves.** The two leaps are Lesson 4's `leap` (`L.mercGate` with `leap: true`;
  crouch 0.15 s off frame, 0.43 s in the air, carried in from `leapDx` 300 px beyond the edge, Tavi
  from the right, Merc from the left with the pass mirrored). A size change in place eases over
  0.6 to 0.8 s (power2.inOut) about the feet point; a hop is the renderer's hop with the box carried
  through its 0.42 s in the air (power1.in). Merc's two hops: (110, 840) to (700, 840), 508.85 to
  509.40, and (700, 840) to (1290, 840), 509.50 to 510.05; nothing is drawn below y 300 anywhere
  from x 0 to 1400 while he is in the air. The only exits are S1h's slides, 360 px outward over
  37.30 to 37.90 (power2.in).
- **Text and marks** fade in over 0.2 s from their word and out over 0.2 s unless a row says
  otherwise; "up fast" is 0.3 s, power3.in, rising 16 px. No two separate labels land within 0.4 s
  (STORYBOARD § Type, Staging). Counted pulses as STORYBOARD § Type, each about its label's left
  baseline. Ring timers, pills, arrows and capsules are Lesson 4's `assets/lib/marks.js`
  (`L.ringTimer`, `L.pill`, `L.arrow`); Tavi's guesses `L.GUESS` (dashed ink-2, 3 px, dash 10, gap 8).
- **Captions.** Everything essential above y 896; the care block above y 864.

## The wave rule (critic 01, item 2)

A voice's line carries its vibrato, 5.5 cycles a second and 14 cents either way (28 cents peak to
peak; FACTS 80, 98). On a chart of plot width `L` px for a window of `W` s at `k` px a cent:

- one cycle is `L / (5.5 W)` px wide; the wave is `28 k` px from peak to peak;
- **the rule: `k W = 10` on the 1120 px world plot** (so `k` = 2.5 at W 4, 1.667 at W 6, 1.0 at
  W 10). Then a cycle is `203.6 / W` world px and peak to peak `280 / W` world px, and their ratio
  is 1.375 in every scene and every framing: a small, even wave, about one and a third times as
  tall as it is long. A chart drawn at another width keeps `k W = 10 L / 1120`.

| Where | Window, scale | On screen | One cycle (px) | Peak to peak (px) |
| ----- | ------------- | --------- | -------------- | ----------------- |
| S1, the takes | W 4, k 2.5 | F-cold, 0.90 | 45.8 | 63.0 |
| S5, the Push note (k set on screen at 70.48 to 71.08) | W 6, k 1.667 | F0 | 33.9 | 46.7 |
| S5f to 5g, the chart at 0.78 (object) | as above | F0 | 26.4 | 36.4 |
| S7, the pushed take large | W 4, k 2.5 | F0 | 50.9 | 70.0 |
| S7, row 1's miniature (0.41) | as above | F0 | 20.9 | 28.7 |
| S10, before "ten seconds" (no voice line yet) | W 4, k 2.5 | F-hold, 1.3 | (66.2) | (91.0) |
| S10, Tavi's hold, from 309.46 to 310.26 on | W 10, k 1.0 | F-hold, 1.3 | 26.5 | 36.4 |
| S10, the scoop and the held wave | as above | CU-scoop, CU-wave, 1.8 | 36.7 | 50.4 |
| S10h, the silent line in the small frame (640 px, k 1.0 on screen) | W 6 | F-hold (screen px) | 19.4 | 28.0 |
| S13d, Tavi's line in the recap frame (1456 px, k 1.3 on screen) | W 10 | F0 | 26.5 | 36.4 |

v1's W 10 at 2.5 px a cent drew 20 px cycles 70 px tall (ratio 3.5, a zigzag) and 11.6 px cycles in
13d; no framing above is under 19 px a cycle or over 1.45 in ratio. Tavi's line is never shown in
the turn's small frame (it fades at 353.90, before 10h's slide).

## World (F0, `s = 1`)

### The band chart

- **Plot**: x 400 to 1520. Time: `x(t) = 400 + 1120 t / W`. Pitch: `y(c) = y0 - k c` (c in cents
  from the band's A; Tavi's A4 folds onto it, "A, any octave"), `k = 10 / W` (the wave rule):

  | Scene | W | k | y0 (Merc's line) | Band (±35 c) | Notes |
  | ----- | - | - | ---------------- | ------------ | ----- |
  | S1, S3, S4 | 4 | 2.5 | 400 | 312.5 to 487.5 | +74 c y 215, -40 c y 500 |
  | S5 | 6 | 1.667 | 400 | 341.7 to 458.3 | eased from 2.5 at 70.48 to 71.08 (power2.inOut), about y 400; the Push note's +60 c at y 300 |
  | S7, large | 4 | 2.5 | 470 | 382.5 to 557.5 | strip centre 700; the pushed line's highest peak y 250 |
  | S10, to 309.46 | 4 | 2.5 | 400 | 312.5 to 487.5 | no voice line yet |
  | S10, from 310.26 | 10 | 1.0 | 400 | 365 to 435 | -60 c y 460; eased with the window, 309.46 to 310.26 |

- **Band**: amber `#f59e0b` fill 12 %, top and bottom edges 2 px at 45 %; lit edges mint `#80ffca`
  3 px with a 6 px glow at 40 %, lit while a voice's centre is within ±35 c, except that in S10c
  and S13d the edge lights once, at the line's 0.69 s, when the centre enters to stay (DECISIONS 96). **Merc's line**: 4 px
  amber, x 400 to 1520, y y0, a 10 px glow at 20 %.
- **A voice's line**: violet `#a78bfa`, 4 px, round, drawn from the contour of FACTS 80 *with* its
  wave (5.5 Hz, ±14 c, grown in over 0.35 s, phase 0 at the vibrato's start), so `y = y(c(t))`; its
  head a violet dot r 7 with a 14 px glow while it draws. A ghosted line is 35 % violet.
- **Level strip**: centre y 690 (S7: 700), x 400 to 1520; envelope half-height `h = 28 × 10^(dB /
  20)` (0 dB 28 px, +6 dB 55.9 px); fill violet 28 %, edges 2 px violet at 70 %; a hairline at its
  centre, ink 10 %, when empty. Ghosted: outline only, 35 %. S10 has no strip.
- **Labels** (world px): "A3" Outfit 600 48, ink, right-aligned x 366, baseline 417; "in the band"
  Outfit 600 30, ink, right-aligned 366, baseline 470, shown only with the mint edge; "level" Outfit
  600 32, ink-2, left-aligned x 400, baseline 778. **Label row**, baseline 150: its text Outfit 500
  34, ink, from x 400 ("in the band: within 35 cents (Lesson 3)" in S1 and S5; S5's definition);
  chips (JetBrains Mono 500 26, tracking .18em, ink-2, in a chrome 25 % pill 40 high, centred y
  140): "ILLUSTRATION" right-aligned to x 1520 (S1 from frame 0; S5 from 70.93), "LISTEN ONLY"
  right-aligned to x 1300.
- **Right of the plot** (left-aligned x 1536): "?" Outfit 600 64, ink-2, baseline 423; "sung easily"
  Outfit 600 36, ink, baseline 470; "above the band" Outfit 600 36, ink, baseline 262 (S1) or 300
  (S5). Inside the plot, top left: "louder · higher" Outfit 600 56, ink, x 420, baseline 268; S5's
  "also: a little higher" Outfit 600 36 x 420 baseline 310 and "mainly: louder" x 420 baseline 600,
  each with a 3 px chrome arrow (30 px) to the band's top edge (341.7) and to the strip. Under the
  strip: the small type "Both lines are drawings of that rule, not recordings." Inter 34, ink-2,
  right-aligned x 1520, baseline 812.
- **Tavi's straight guess**: `L.GUESS` along y0 from x 540 (t 0.5 s at W 4) to 1520 in S1, from 400
  to 1520 in S10; its "?" as above. Merc's line dims to 50 % under it.
- **The long note's head bead** (S1g, S1h): chrome `#c3ccd6`, world (400, 400), r 30.8 (screen
  (560, 520), r 22 at F-hook), fading in 34.40 to 34.80; on "steady?" (36.77) it scales 1.2 and
  sends one echo ring. Its glow (a radial gradient about its centre) grows from 37.60 to fill the
  frame at 38.05 as the camera reaches F-bead.
- **Push slider** (S5): track x 400 to 1520, y 800, 4 px chrome at 50 %; `x(p) = 400 + 11.2 p`, the
  thumb a chrome disc r 16 at `x(p)`, its value Outfit 600 30 tabular, ink, centred over it,
  baseline 776; "Push" Outfit 600 32, ink, right-aligned x 366, baseline 811 (Merc's keep-out at
  300 ends at x 210). The thumb follows FACTS 80's Push curve exactly (50 to 0.6 s, linear to 100
  by 2.1 s, held to 3.6 s, linear to 50 by 4.8 s, held to 5.6 s), so line, strip and thumb are one
  function of `t`. The push plan (5d): chrome 40 % arrows on y 770 from 960 to 1520 and back, a
  4 px hold bar at 1520.
- **The chart at 0.78** (S5f to S6b, an object move, 97.30 to 98.50, power2.inOut): the whole chart
  group drawn at `x' = 0.78 x + 154`, `y' = 0.78 y + 99`: plot x 466 to 1340, band 365.5 to 456.5,
  strip centre 637, the thumb at (903, 723), "Push" right edge 440.
- **Pills** (S1, frame-fixed): Outfit 600 34 in chrome-stroked capsules 52 high centred y 112 (as
  shown at F-cold): "Settle, steadier than before" x 470 to 930, "Get louder and drift higher" x
  970 to 1430; the ring timer at (1480, 112), r 18; the check an ink SVG mark at the capsule's left.
- **The swatches** (S4): three envelopes 160 wide centred at x 640, 960 and 1280, y 850, half-heights
  10, 28 and 56, chrome outline 2 px at 50 %; labels Outfit 600 36, ink-2 (lit: ink), centred,
  baseline 950; the hairline from the middle swatch's top (960, 822) to the strip's foot (960, 718).
- **Lesson 1's figure** (S5f, frame-fixed at F0): two panels 187 x 203 at x 1433 to 1620 and 1636 to
  1823, y 271 to 473, Lesson 1's LOUDER and HIGHER drawings at 0.47 of their size, sliding in from
  x 1920 (97.60 to 98.50); "loud ≠ high" Outfit 600 48 ink centred x 1628, baseline 247. The fork
  (5g, screen px): ink 3 px from the thumb (903, 723) up to (1012, 567), branching to (1137, 645)
  "louder" and (1137, 356) "higher" (Outfit 600 40, ink, from x 1153 at each end); "in a voice, one
  push moves both" serif italic 56, ink, centred x 960, baseline 130.
- **S1's arrow** (1f): ink 3 px from the pushed line's last in-band centre point (t 2.75 s, x 1170)
  to its end (1520, 250), curving above the line, 20 px clear of it.

### The breath figure

Drawn in figure units `(u, v)`: u 0 to 400 back to front (it faces right), v 0 (crown) to 1000
(soles), placed by `x = x0 + k u`, `y = y0 + k v`. Chrome strokes 3 px (at k 1), joins round.

| Part | Figure units (at rest) | Breathing in | Breathing out (Q27; FACTS § 4) |
| ---- | ---------------------- | ------------ | ------------------------------ |
| Head | circle (230, 85), r 65; jaw (200, 130) to chin (285, 140) | - | - |
| Neck, throat | lines u 200 and 250, v 150 to 215; throat point (250, 190) | - | - |
| Shoulder | (175, 235) | does not move (S8) | - |
| Torso | back u 150, v 230 to 560; chest front u 320, v 230 to 400; belly wall u 330, v 420 to 560 | belly bows to u 360 at v 490 | belly wall back to u 330, then in to u 315 at v 490 as the belly and rib muscles push (6f after 7 s, 6i, 8d) |
| Ribs | arcs at v 290, 340, 390, u 160 to 320 | - | glow when they push (6i) |
| Lungs | ellipse (240, 335), rx 75, ry 105 | ry 118, centre (240, 345) | ry 95, centre (240, 330) |
| Dome | quadratic (155, 470), control (240, 400), (325, 470); apex v 435 | control (240, 470), ends at v 485 | back to rest (it rises; it never pushes) |
| Legs | knee (235, 780), ankle (220, 980), toe (300, 1000) | - | - |

- **S6 (torso)**: `k` 1.15, `x0` 200, `y0` 120 (v1's y0 60 put the head on the kicker): head
  centre (464, 218), r 75, so y 143 to 293, 33 px under the kicker's foot (y 110); throat (488,
  339); lungs centre (476, 505), x 390 to 562; dome apex (476, 620), dome ends (378, 661) and (574,
  661); hips y 764; the legs masked out from y 750 to 780 (a soft fade). Labels: "lungs"
  right-aligned x 350, baseline 470; "breathing in" (6c, 6d) and "can't push air out" (6i) at the
  same place, never together, right-aligned 350, baseline 580; "diaphragm" right-aligned 350,
  baseline 640, a 1.5 px chrome leader to (378, 661); "belly" x 640, baseline 700. Under the figure
  (x 260): "with your breathing muscles," baseline 800 and "never your throat" 838; "belly and rib
  muscles" 800. Guess arrow: `L.GUESS` from (476, 620) to (476, 460), arrowhead 14 px, its "?"
  right of the chest at x 600, baseline 470; the struck arrow the same path, chrome 3 px, its
  strike ink 3 px from (446, 560) to (506, 520). At F-gauge all of these ride the push (§ Framings).
- **S7 (parked)**: from F-gauge's pixels at 178.83 (`k` 1.2075, `x0` 150, `y0` 100.75 on screen) to
  `k` 0.5, `x0` 140, `y0` 180 (179.00 to 180.00, power2.inOut), dimmed to 35 %: x 215 to 320, y 190
  to 460, legs masked from y 450. At 210.63 to 212.13 it comes to full and breathes in once, then
  eases back and dims (212.20 to 213.00).
- **S8 (whole)**: from the parked place to `k` 0.7, `x0` 830, `y0` 140 (218.75 to 219.95,
  power2.inOut), full strength, the legs drawing down from the hips 219.40 to 219.95: head (991,
  200), chin (1030, 238), throat (1005, 273), shoulder (953, 305), lungs (998, 375), dome apex
  (998, 445), belly front x 1061, knee (995, 686), soles y 840 (on the floor line). Cue labels
  Outfit 600 36, ink, each with a 1.5 px chrome leader: "tall but easy" right-aligned 900, baseline
  200 (its arrow up the back at x 925 from y 830 to 150); "shoulders still" right-aligned 910,
  baseline 300 (a 40 px level mark at y 290 over the shoulder); "breathe in quietly, low"
  right-aligned 910, baseline 400; "knees unlocked" right-aligned 950, baseline 700; "jaw · tongue ·
  neck loose" x 1070, baseline 245; "diaphragm at work" x 1110, baseline 470; "as much as feels
  easy" x 1110, baseline 560; "Singers breathe in" / "different ways." serif italic 48, x 1110,
  baselines 720 and 770.
- **S13 (recap card 1)**: `k` 0.75, `x0` 1150, `y0` 90: x 1262 to 1420, y 105 to 500, legs masked
  from y 480.

### The gauge and Merc's small band (S6)

- **Small band**: x 760 to 1640, y 160 to 240, Merc's line y 200 (amber, 3 px, drawn behind the
  cursor); "A3" Outfit 600 36 right-aligned 740, baseline 212; "the note: unchanged" Outfit 600 30,
  ink, x 760, baseline 140.
- **Frame**: x 760 to 1640, y 290 to 720, chrome 30 % 2 px, radius 8. `x(t) = 760 + 88 t` (t 0 to
  10 s). The lungs' own push `y_L(t) = 340 + 38 t`, chrome 3 px. Gold `#ffd84d` 3 px "what the note
  needs": Quiet y 606 (crossing 7 s, x 1376); Loud y 454 (crossing 3 s, x 1024). Hatches: held back
  (above gold, under the lungs' line) 1.5 px chrome at 25 %, 45 degrees, 10 px apart; added (under
  gold, over the lungs' line) the same at 135 degrees. Cursor: 3 px chrome with a soft glow, y 160
  to 720 (through both).
- **Labels** (v2 places in bold):
  - "push of air (not pitch)" Outfit 600 30, ink, x 790, baseline 275, after a 12 x 24 px up arrow
    at x 768 (128.85).
  - "one 10-second note" Outfit 500 30, ink-2, x 760, baseline 760 (128.40; **leaves 170.34 to
    170.54**).
  - "the lungs' own push" Outfit 600 30, ink, x 776, baseline 325 (130.45).
  - "what the note needs" Outfit 600 30, ink, **x 776, baseline 640 (Quiet), under the gold line's
    left end; in Loud at baseline 520, riding up with the gold line (172.06 to 172.86)** (131.55).
    Where it sits the falling line runs at y 347 to 470 (Quiet: 148 px clear above the label); in
    Loud the line meets the label's right end (x 1061) at y 470, 28 px above its cap top (498).
  - "held back" Outfit 600 34, centred x 860, baseline 540 (132.25).
  - "added" Outfit 600 30, centred x 1508, baseline 760, **a 1.5 px leader from (1508, 735) up to
    (1508, 640)**, inside the added region, which at x 1508 runs from the gold line (606) down to
    the lungs' line (663) (137.70).
  - The readout "Now: holding back" / "Now: adding" Outfit 600 34, ink, right-aligned 1640, baseline
    275 (132.75; the switch at 137.25).
  - Loud: **"less holding back at first" Outfit 600 30, ink, x 790, baseline 330, inside the frame
    above the falling line (23 px over it at x 790), a 1.5 px leader from (900, 338) down to (900,
    430)**, inside the small held-back region (at x 900: the lungs' line 400 to the gold line 454)
    (172.92); "more adding as the air runs low" right-aligned 1640, baseline 805, a leader from
    (1500, 780) up to (1500, 600), inside the large added region (at x 1500: 454 to 651) (175.51).
  - Chips "Quiet" and "Loud" right-aligned to 1640, centred y 266 (the readout's place, after it
    leaves at 170.10) (170.34).
- **Predict** (frame-fixed): "PREDICT" mono 26, ink-2, x 760, baseline 115; capsules "Push it out"
  x 920 to 1150 and "Hold it back" x 1180 to 1420, 48 high, centred y 105; ring timer (1470, 105).
- **The split (6b)** **(provisional: the lab decides the curves)**: from the chart at 0.78 (plot
  x 466 to 1340, band 365.5 to 456.5, strip centre 637) the band and Merc's line map to the small
  band (x 760 to 1640, y 160 to 240) and the strip to (760 to 1640, centre 690); one move, 110.90 to
  112.40, power2.inOut. The opening (6e) grows the strip's box to the frame's box, 127.95 to 129.35.

### The mix-up card (S7, F0 from the matched cut; frame-fixed)

Left column from x 360 (the parked figure is x 215 to 320); right column x 1180 to 1640 for the
miniatures; the lower half for each piece of evidence while it is large.

| Row | Words (Outfit 600, ink, x 360) | Lands | Miniature (right column) |
| --- | ------------------------------ | ----- | ------------------------ |
| kicker | "COMMON MIX-UP" (mono 30, ink-2, at (120, 110)) | 179.48 | - |
| 0 | "'support' means pushing hard, or squeezing" 44 px, baseline 180, dashed ink-2 underline at y 194, its "?" (Outfit 600 64, ink-2) after its last word | 180.77 | - |
| 1 | "push harder: louder, and higher" 40 px, baseline 300; "ILLUSTRATION" chip under it, x 360, centred y 345 | 186.80 | the pushed chart at 0.41: x 1180 to 1640, y 212 to 427 |
| 2 | "squeeze: a pressed sound," / "more pressure, not less" 40 px, baselines 490 and 535; "same push: much quieter" 30 px, baseline 580 | 187.36; 195.55 | the two strips at 0.5: easy x 1180 to 1350, pressed 1380 to 1550, y 452 to 575; "easy" and "pressed" Outfit 600 26 centred under each, baseline 605 |
| 3 | '"support": how singers manage the breath' 40 px, baseline 655; "no one agreed meaning" 36 px, baseline 700 | 205.80 (shrunk in) | - |
| 4 | "The better idea:" 30 px ink-2, baseline 760; "steady air, not more of it · breathe in low" and "start easily · let it flow out unforced" 40 px, baselines 810 and 855 | 206.32 to 214.51 | - |

- **The chart reassembled** (7a, 179.00 to 180.40): the gauge folds back onto its floor and becomes
  the strip; the small band and the strip glide to plot x 400 to 1520, band centre 470 (k 2.5,
  382.5 to 557.5), strip centre 700. **Evidence 1, large** (7b): the pushed take redrawn over the
  plot at 2.5 times its speed (184.10 to 185.70), silent; "ILLUSTRATION" right-aligned 1520, centred
  y 790 (184.00); its highest peak y 250, 56 px under row 0's foot (194). **Into row 1** (186.20 to
  186.80, power2.inOut): `x' = 1180 + 0.41 (x - 400)`, `y' = 310 + 0.41 (y - 470)`; the chip moves
  to its row-1 place.
- **Evidence 2, large** (7c, 189.52 to 190.32): "easy" x 860 to 1200, half-height 110; "pressed" x
  1260 to 1600, half-height 28; both centred y 680, violet 28 % fill, 2 px violet edges at 70 %; a
  chrome bar 3 px at y 545 from x 860 to 1600 with a drop to each strip's top; "one push of air"
  Outfit 500 28, ink-2, centred x 1230, baseline 530; "easy" and "pressed" Outfit 600 30 centred x
  1030 and 1430, baseline 830. **Into row 2** (196.50 to 197.10): `x' = 1180 + 0.5 (x - 860)`,
  `y' = 520 + 0.5 (y - 680)`; "one push of air" fades, the names land again at 26 px (197.10).
- **The word, large** (7d): '"support"' serif italic 160, ink, x 360, baseline 800 (198.06); "how
  singers manage the breath" Outfit 600 44, x 980, baseline 800 (199.35); "no one agreed meaning"
  Outfit 600 36, x 980, baseline 850 (204.09). **Into row 3** (205.20 to 205.80): the word to 40 px
  at x 360, baseline 655, the phrase following it on that baseline, "no one agreed meaning" to
  baseline 700.
- Every row and miniature leaves up fast from 215.85, 0.05 s apart; the parked figure stays.

### The folds and the traces (S9, F0 throughout)

- **Folds** (from above), centred (390, 430) in a 340 px box: two chrome folds 8 px from the front
  apex (390, 300) to their back ends; apart (330, 560) and (450, 560); slit (378, 560) and (402,
  560); pressed shut (388, 560) and (392, 560) at 12 px; a rounded outline round them, chrome 30 %;
  vibration ±3 px across the gap at 18 Hz drawn time (not the voice's). "vocal folds, from above"
  Outfit 500 28 ink-2, x 220, baseline 650 (241.40). They grow at 240.00 from the figure's throat
  (1005, 273).
- **Trace strip**: x 700 to 1600 (`x(t) = 700 + 562.5 t`, 1.6 s), centre y 430, a stylised wave of
  22 px a cycle whose half-height is the level (up to 110; it is the level, not the pitch); fine
  dots (r 1.5, chrome 70 %, seeded) for air; the catch's mark ink 4 px, y 320 to 540; the gold tick
  4 x 40 at the together start's onset on y 430. It draws in 241.85 to 242.45. Title Outfit 600 44
  x 700, baseline 280 (245.05), "LISTEN ONLY" after it +24 px (257.50); "ILLUSTRATION" right-aligned
  1600, centred y 270; chips "Air first", "A catch", "Together" capsules centred y 680 from x 700,
  920, 1140 (246.33, 246.73, 247.13); mark labels Outfit 600 30, ink, baseline 580 ("air, no note"
  from x 700; "the catch" from x 786).
- **Stack** (9f, an object move at F0, 275.50 to 276.70; v1 showed it at F-stack): rows centred y
  250, 450, 650, half-height 70, x 700 to 1600; names Outfit 600 36 right-aligned 670, baselines
  262, 462, 662 (275.50, 275.90, 276.30); "the puff" x 720 baseline 165, "the click" x 800 baseline
  368, "neither" x 720 baseline 568; "the easy start" Outfit 600 40 x 1000 baseline 568; the "h"
  serif italic 120 ink-2 at 40 % centred (760, 690); "the h, only in your mind" Outfit 500 30 x 720
  baseline 770; the folds small in x 160 to 330, y 110 to 280. Hosts at 240: Merc's keep-out ends
  at x 184, Tavi's starts at 1736.
- **Onsets** within each start (FACTS 80): air first's noise from 0, its tone from 0.25 s; the
  catch's click at 0.15 s; together's tone at the sound's own onset as the mixer's stem puts it,
  measured in the sound round **(provisional)**.

### The hold chart (S10; world at F0, shown at F-hold, CU-scoop and CU-wave)

World px (the band chart's plot and formulas above, y0 400), with the screen place at F-hold
(`x' = 1.3 x - 288`, `y' = 1.3 y + 10`):

| Item | World | Screen at F-hold |
| ---- | ----- | ---------------- |
| Plot | x 400 to 1520 | x 232 to 1688 |
| Band at W 4 (to 309.46) | y 312.5 to 487.5 | y 416 to 644 |
| Band at W 10 (from 310.26) | y 365 to 435 | y 484.5 to 575.5 |
| Merc's line | y 400 | y 530 |
| Tavi's -60 c start (W 10) | y 460 | y 608 |
| Label row 1: "A, any octave" Outfit 600 30 (x 400), "in the band" Outfit 600 30 (x 640), "ILLUSTRATION" right-aligned 1520, centred y 280 | baseline 290 | baseline 387; x 232, 544; chip to 1688 |
| Label row 2: "steady: settles into the band and stays" Outfit 600 30, x 400 (344.62) | baseline 240 | baseline 322 |
| Tavi's guess "steady air keeps it there?" Outfit 600 40, ink-2, x 400 (351.06) | baseline 190 | baseline 257 |
| "settled" flag (chrome, 16 tall) on the band's top edge at the entry, t 0.69 s; "settled" Outfit 600 26 centred over it | x 477, y 349 to 365; baseline 342 | x 332, y 464 to 484.5; baseline 455 |
| Time axis: ticks each second, 8 tall; "0" x 400 and "4 s" / "10 s" right-aligned 1520, Outfit 600 30 ink-2 | ticks y 497 to 505; baseline 523 | ticks y 656 to 666; baseline 690 |
| The bracket of 10f, 2 px chrome, and "a comfortable, fixed length" Outfit 600 30 centred x 960 | y 540; baseline 577 | y 712; baseline 760 |
| Tavi's dashed guess (10b) and its "?" (x 1536, baseline 423) | y 400, x 400 to 1520 | y 530; "?" x 1709 to 1745, y 514 to 560 |

- **The window widens** (309.46 to 310.26, power2.inOut): `W` from 4 to 10 and `k` from 2.5 to 1.0
  on one curve (`k = 10 / W` throughout), about y 400; the ticks' spacing goes from 280 to 112
  world px (364 to 146 on screen), ticks 5 to 10 entering at x 1520 as they come inside the plot;
  "4 s" switches to "10 s" at 309.46. The dashed guess and Merc's line are flat and do not change.
- **10c**: FACTS 80's points cross -35 c into the band at about 0.45 s, dip back out for 4
  frames (the point (0.66, -38)) and enter to stay at 0.69 s. The mint edge and "in the band" light
  once, at 0.69 s (311.41), and stay lit to 320.72 and after; the first touch and the dip are not
  shown (DECISIONS 96). The flag at about 311.9 (0.5 s after 0.69 s).
- **CU-scoop** (s 1.8, ox 114, oy -200): the line's first 1.5 s at x 834 to 1136, the band y 457 to
  583, the low point (834, 628); "SLOWED" chip left-aligned x 834, centred y 412; "scoop" Outfit 600
  30 world (54 on screen) centred (834, 700) baseline (world (400, 500)). The axis is faded (324.60
  to 342.20): at CU-wave its "10 s" would sit at (1896, 741), inside Tavi's keep-out.
- **CU-wave** (s 1.8, ox -840, oy -200): the held wave from x 888 (world 960) to the frame's edge,
  the band y 457 to 583 (Tavi's keep-out starts at y 628); the vibrato bracket at x 1500, y 495 to
  545 (world (1300, 386 to 414)); "small vibrato: inside the band" Outfit 600 30 world at (888,
  416) (world (960, 342)); "in the band" at (312, 322). "A, any octave" and "settled", which this
  framing would cut at the left edge, are faded from 331.90 to 342.20.

### The hold frame at the right half (S10h to S12; screen px)

Drawn at F-hold in S10h, so world = `((x' + 288) / 1.3, (y' - 10) / 1.3)`; from 364.73 (S11) world
= screen. The slide (354.00 to 355.10, power2.inOut) takes the plot from x 232 to 1688, band 484.5
to 575.5 to:

- **The frame**: x 1000 to 1640, band y 210 to 280, Merc's line y 245; 64 px a second, 1.0 px a
  cent (the wave rule at 640 px: `k W = 5.71`, so W 6 at k 1.0 gives 19.4 px a cycle, 28 px peak to
  peak). Tavi's line has faded (353.90 to 354.30) before it shrinks.
- **10h's slider**: track x 1000 to 1640, y 380, thumb r 14, value Outfit 600 26 tabular baseline
  358, "Push" Outfit 600 30 right-aligned 985, baseline 390; the silent line draws at 106.7 px a
  second from 361.20 and follows FACTS 73's rule (+1.2 c a step: 75 is +30 c, 30 px up; 70 is +24 c,
  24 px up); "ILLUSTRATION" right-aligned 1640, centred y 180 (361.65).
- **The voice box** (10h): a rounded outline x 300 to 640, y 190 to 510, radius 60; the folds at 0.8
  centred (470, 350); muscle bands chrome 6 px at x 380 and 560, y 280 to 420; "voice box" Outfit
  600 32 x 300 baseline 170; "muscles here set the note" Outfit 600 36 x 260 baseline 570; "a
  steady note needs steady air too" and "a change in the air moves it" Outfit 600 40 x 260,
  baselines 680 and 740.

### The turn (S11, S12)

**World drawings** (F0 from 364.73; at F-turn from 424.60, `x' = 1.4 x - 472`, `y' = 1.4 y - 190`):

| Item | F0 (world = screen) | At F-turn |
| ---- | ------------------- | --------- |
| The frame: band, Merc's line | x 1000 to 1640, band y 210 to 280, line y 245 | x 928 to 1824, band y 104 to 202, line y 153 |
| The bracket (370.10), 2 px chrome, end ticks | y 292, x 1000 to 1640 | y 219 |
| "0" (x 1000) and "10 s" (right-aligned 1640), Outfit 600 30 ink-2 | baseline 322 | baseline 261 |
| "A3 · Merc" (blue dot r 6 at x 1000, text from 1016) and "A4 · Tavi, an octave up" (orange dot at 1186, text from 1202), Outfit 600 30 ink | baseline 362 | baseline 317 |
| "Nothing listens" Outfit 600 30 ink, x 1000 to about 1225 | baseline 402 | baseline 373, x 928 to 1243 |
| "Breathe in, low and quiet" Outfit 600 28 ink, right-aligned 1640, from about 1278 (426.57 to 428.30) | baseline 402 | baseline 373, x 1317 to 1824: 74 px right of "Nothing listens" |
| The ring: track chrome 35 %, stroke 10; arc chrome 100 % with a soft glow, clockwise from 12 o'clock, `angle = 36 t` over the hold; 12 o'clock tick 4 x 24 | centre (1320, 590), r 160: x 1160 to 1480, y 430 to 750 | centre (1376, 636), r 224: x 1152 to 1600, y 412 to 860 |
| The phase word inside the ring ("Listen", "Breathe", "Sing"), Outfit 600 40, ink, centred | baseline 548 | baseline 577, 56 px |
| The counter, Outfit 600 80 tabular, ink, centred ("0" at 428.50, then 1 to 10) | baseline 640 | baseline 706, 112 px |
| "Listen · Breathe · Sing" mono 28 ink-2; "at about speaking volume" and "stop sooner if you need to" Outfit 500 30 ink, centred x 1320 | baselines 790, 828, 864 | gone (they leave up fast 423.00 to 423.30) |
| The playhead, 3 px chrome, the band's height | `x = 1000 + 64 t` | `x = 928 + 89.6 t` |

The ring's breath: scale 1 to 1.08 and back about its centre, 426.10 to 428.10. Tavi's keep-out at
F-turn starts at x 1700 (the ring ends at 1600) and y 628 (the frame's labels end at 373).

**Frame-fixed** (screen px, never scaled):

- **Care block**, left-aligned x 260, every line within x 260 to 960, nothing below y 864 (the care
  icon's top-left at (260, 236), 36 px, the app's SVG): "Your turn." serif italic 110, ink,
  baseline 200; the comfort line Outfit 700 36, ink, x 310, baselines 262 ("Sore, hoarse or unwell
  today?") and 306 ("Just listen along."); the reasons Outfit 500 30, ink, baselines 352 ("hurts or
  uncomfortable · unusually hoarse or tired"), 390 ("usual notes suddenly gone · ill") and 428
  ("talking or singing is hard work"); "listening along: rest your voice and watch the ring" Outfit
  500 30, ink, baseline 486; the stop line Outfit 600 36, ink, baselines 548 ("Stop immediately if
  anything") and 590 ("feels uncomfortable."); the doctor lines, small, Inter 30, ink-2, five lines
  at baselines 650, 688, 726, 764 and 802, broken where the font puts them within 700 px, word for
  word with their parentheses. **At the push** (423.00 to 423.30) everything but the stop line and
  the small doctor lines fades. **Full size** (12h): the stop line fades (459.85 to 460.25) and the
  doctor lines become Inter 40, ink, six lines at baselines 430, 480, 530, 580, 630 and 680, within
  x 260 to 960, a cross-fade rising 12 px (460.00 to 460.80); at F-turn nothing of the frame's is
  left of x 1000 below y 373, so they stand clear. Merc's body ends at x 190 and his talking arcs
  reach about x 225 (to be measured on m-blue at 300: **provisional**), so x 260 keeps 35 px.
- **Feel** (12f to 12h, at F-turn): "How did that feel?" serif italic 64, ink, x 1000, baseline
  480; a ring timer at (1660, 458), r 16; capsules x 1000 to 1230, 44 high, centred y 540, 596, 652,
  708 (Outfit 600 30); lines Outfit 500 30, ink, x 1260: "rest a few easy breaths" baseline 579 (a
  2 px chrome bracket from the first two capsules at x 1240), "rest before you sing again" 663,
  "enough singing for today" 719. All of it left of x 1630 and above y 730.

### Recap and practise (S13; F0 from the matched cut; frame-fixed)

- **The frame's slide** (13a, an object move, 478.20 to 479.40, power2.inOut): from F-turn's pixels
  (x 928 to 1824, band 104 to 202) to the **recap frame**: x 232 to 1688 (145.6 px a second), band
  y 554.5 to 645.5 (1.3 px a cent), Merc's line y 600; dimmed strokes from 479.40 to 479.70 (its
  labels hidden), back to full 498.30 to 498.90 with "A, any octave" Outfit 600 30 x 232, baseline
  510, "ILLUSTRATION" right-aligned 1688, centred y 500, and, lit with the mint edge only, "in the
  band" Outfit 600 30 x 520, baseline 510. The "settled" flag (no label) at x 332, y 538.5 to
  554.5. Merc's keep-out ends at x 210 and Tavi's starts at x 1700 and y 628: the frame (and the
  -60 c start at y 678, x 232 to 300) clears both.
- **Panel** x 120 to 960, y 140 to 330 (radius 16, chrome 25 % stroke, obsidian fill 85 %); its
  question Outfit 600 40, ink, x 150, baselines 220 and 280; its ring timer at (910, 250). Answers
  serif italic, ink, x 150: one line 64 px at baseline 400; two lines 56 px at 392 and 452 (their
  feet at about 466, 22 px over the frame's labels). The panel never shows empty: it leaves with one
  card's lines and comes back with the next's.
- **Card 1's figure**: § The breath figure, S13: x 1262 to 1420, y 105 to 500 (54 px over the band).
- **Card 2's traces** (486.45 to 487.15): x 1180 to 1640 (`x(t) = 1180 + 287.5 t`), centres y 200,
  320, 440, half-height 45 (feet at 485, 69 px over the band); names Outfit 600 30 right-aligned
  1160, baselines 210, 330, 450.
- **Card 3**: Tavi's line redrawn in the recap frame from FACTS 80 at 4.17 times its speed (504.93
  to 507.33); the mint edge and "in the band" at 505.10, held.
- **Voice Mirror card** (13e, 13f): panel x 230 to 1110, top y 90, its foot easing down as rows
  land (0.3 s, power2.out): y 300 (508.85), 360 (510.83), 420 (512.55), 480 (515.57), 625 (518.16),
  685 (519.09), 730 (520.81), 790 (524.26). Text from x 270: "Practise it." Outfit 600 40, ink,
  baseline 150 (508.85); "Voice Mirror" serif italic 96, ink, baseline 250, a 2 px chrome rule at y
  272 from 270 to 1070 (509.25); b55's sentence in three rows, Outfit 600 34, ink, text from x 326,
  each after a 40 px chrome glyph at x 270: "Voice Mirror has you glide up and down," baseline 340
  (a glide glyph: up and down arrows, centred y 328; 510.83), "hold any comfortable note for six
  seconds," baseline 400 (a held-line glyph, centred y 388; 512.55), "then sing back five notes it
  plays." baseline 460 (five dots r 4 at x 272, 281, 290, 299, 308, y 448; 515.57); the readout
  Inter 32, ink, baselines 525, 565, 605, broken within 800 px (518.16); "Keep the glides
  comfortable." Outfit 500 34, baseline 665 (519.09); "Sore, hoarse or unwell today? Just listen
  along." 710 (520.81); "Free, no account: mercurypitch.com/mirror" Outfit 600 40, 765, the address
  underlined at y 777 (524.26; the underline 525.55); under the card, "Ten minutes, gently, most
  days." and "Missed a day? Just come back." Inter 34, ink-2, x 270, baselines 822 and 862 (527.40;
  both end before x 820).
- **Rest card** (13g): panel x 1130 to 1690, y 250 to 600 (Merc's keep-out from y 628; Tavi's from
  x 1700); text from x 1160: "Felt uncomfortable, or listened" / "along today?" Outfit 500 28, ink-2,
  baselines 296 and 332 (528.01); "Rest today" serif italic 72, ink, 416 (530.59); "Voice Mirror
  will be here when" / "your voice feels comfortable:" Outfit 500 30, ink, 470 and 508 (531.46);
  "mercurypitch.com/mirror" Outfit 600 36, 566, underlined at y 576 (535.77).
- **The drift** (card): both cards and their lines move up 14 px together, 537.92 to 539.92,
  sine.inOut (whole-pixel steps are not allowed: draw at sub-pixel positions).

### The tease and the end card

- **Rows** (S14): semitone row k (C4 = 0 to D♯5 = 15) centred `y = 745 - 30 k`, 30 px bands, x 340
  to 1500; black-key rows ink 6 %, the others ink 2.5 %, lines ink 6 %; masked round each host.
- **Beads** r 20 at `x = 420 + 160 i`: C4 (420, 745), C4 (580, 745), G4 (740, 535), G4 (900, 535),
  A4 (1060, 475), A4 (1220, 475), G4 (1380, 535). Chrome outline 2 px until lit; lit blue `#58a6ff`
  with an echo ring at each onset (0.5 s apart from `twinkle`'s start, the last held 1.0 s). Merc at
  (1290, 840) stands under A4 and G4: their feet (y 495 and 555) are 73 px over his keep-out. The
  copy, six rows up (y - 180): `L.GUESS` outlines at (420, 565), (580, 565), (740, 355), (900,
  355), (1060, 295), (1220, 295), (1380, 355); its "?" Outfit 600 64, ink-2, x 1430, baseline 375;
  the rising arrows 1.5 px chrome at 40 % from each bead's top to its copy's bottom. The tease line
  Outfit 600 44, ink, centred, baseline 150 (546.23; leaves 550.05 to 550.35); the hook serif italic
  60, ink, centred, baselines 130 (550.50) and 200 (553.34).
- **The end card** (S15): the tease figure (beads, copy, "?") on `x' = 1210 + 0.45 (x - 400)`,
  `y' = 150 + 0.45 (y - 255)`, so in x 1210 to 1660, y 150 to 380; the lockup
  (`assets/brand/lockup-horizontal.svg`) at x 120, y 80 to 180, its width from its aspect (wipe
  556.15 to 556.65); the address Outfit 600 72, ink, x 120, baseline 320 (556.55); "Voice Mirror is
  free, with no account" Outfit 500 44, ink, x 120, baseline 395 (556.95). **Clear zone**: x 80 to
  1100, y 460 to 880, nothing drawn and no glow (YouTube's next-video element and Subscribe).
  F-end: the room and the tease figure ride a 3 % push about (960, 540); the type is frame-fixed.

## Framings

| Framing | s | ox | oy | About | Used | What it holds (screen px) |
| ------- | - | -- | -- | ----- | ---- | ------------------------- |
| F0 | 1 | 0 | 0 | - | most shots | the world as drawn |
| F-cold | 0.90 | 96 | 45 | screen (960, 450) | S1 from frame 0 | plot x 456 to 1464, Merc's line y 405, band 326.3 to 483.8, strip centre 666; "A3" right edge 425 (above Merc's box), "level" from x 456, baseline 745 (Merc's keep-out ends at x 361); right-of-plot labels from 1478 (Tavi's keep-out starts at x 1559, and only below y 551) |
| F-cold end | 0.92 | 76.8 | 36 | screen (960, 450) | 31.25 (the drift's end) | plot x 444.8 to 1475.2, line y 404 |
| F-hook | 0.7143 | 274.3 | 234.3 | - | 34.40 to 37.50 | Merc's line x 560 to 1360 at y 520: Lesson 4's last long note, its head bead at (560, 520), r 22; '"support"' baseline 420 and "what keeps it steady?" baseline 680 frame-fixed, as Lesson 4's S15 |
| F-bead (new) | 2.2 | 80 | -340 | world (400, 400) to screen (960, 540) | 38.05 | the head bead at the frame's centre, r 68, its glow filling the frame; the line runs from it off the right edge, under the glow (replaces v1's F-line, 4.0x on the line's middle) |
| F-promise-a | 1 | 80 | 0 | - | 41.90 to 42.60 | plot x 480 to 1600; the bead lands at (480, 400) |
| F-promise-b | 1 | -80 | 0 | - | 53.40 to 54.00 | plot x 320 to 1440 |
| F-strip | 1.4 | -384 | -700 | - | 55.40 to 66.00 | the strip x 176 to 1744, y 182 to 350 (envelope 227 to 305); the band out of the top; swatches centred (512, 490), (960, 490), (1408, 490); their labels baseline 630 at 50 px |
| F-gauge | 1.05 | -60 | -25.25 | world (1200, 505) | 140.25 to 178.83 | frame x 738 to 1662, y 279 to 731; figure x 331 to 585, head y 125 to 282; labels under the figure from x 213, baselines 815 and 855 (Merc's keep-out ends at 184) |
| F-hold (new) | 1.3 | -288 | 10 | world (960, 400) to screen (960, 530) | 304.90 to 324.60, 342.20 to 364.73 | § The hold chart: plot x 232 to 1688, band 484.5 to 575.5 at W 10; label rows 322 and 387; axis 690; bracket 712 |
| CU-scoop | 1.8 | 114 | -200 | world (400, 400) to screen (834, 520) | 326.10 to 331.90 | the first 1.5 s at x 834 to 1136; the band y 457 to 583; "scoop" at (834, 700) |
| CU-wave (new) | 1.8 | -840 | -200 | world (1000, 400) to screen (960, 520) | 333.90 to 340.74 | the held wave from x 888 to the edge, band y 457 to 583; the vibrato bracket at x 1500 |
| F-turn (new) | 1.4 | -472 | -190 | world (1180, 475) | 424.60 to 478.09 | § The turn: frame x 928 to 1824, band 104 to 202; ring centre (1376, 636), r 224; labels at baselines 261, 317, 373 |
| F-end | 1.03 | -28.8 | -16.2 | world (960, 540) | 562.01 | the room and the tease figure 3 % closer |

v1's F-line, F-wide, F-chest and F-stack are gone (DECISIONS 87, 98).

## Camera moves

Each changes framing on one curve (`s`, `ox`, `oy` together); every move is a push, pull, truck or
crane, so the layers part. Outside these the camera is still. Object moves are in STORYBOARD's
camera plan, in brackets.

| Time | Move | From | To | Ease | Returns |
| ---- | ---- | ---- | -- | ---- | ------- |
| 0.00-31.25 | drift | F-cold | F-cold end | power1.inOut | not counted as motion; the hosts and the lines carry the open |
| 31.40-34.40 | pull | F-cold end | F-hook | sine.inOut | the chart's marks leave over it (31.30 to 33.00); does not return |
| 37.50-38.05 | through the head bead | F-hook | F-bead | power3.in | from 37.60 the bead's glow grows round about its centre to the field; does not return |
| 41.90 | cut | - | F-promise-a | - | |
| 42.60-53.40 | truck | F-promise-a | F-promise-b | power1.inOut | 160 px; content moves 14.8 px a second on average, more in the middle; carries on into the crane |
| 54.00-55.40 | crane down and push | F-promise-b | F-strip | power2.inOut | push-and-return 1; layers part vertically |
| 66.00-67.50 | crane up and pull | F-strip | F0 | power2.inOut | (1's return); the label row's text fades in as it lands (67.00 to 67.50) |
| 130.25-140.25 | push | F0 | F-gauge | sine.inOut | the cursor's own pace is the gauge's clock; returns by the matched cut at 178.83 |
| 303.40-304.90 | push | F0 | F-hold | power2.inOut | the stack left at 303.35 to 303.65; returns by the matched cut at 364.73 |
| 324.60-326.10 | push | F-hold | CU-scoop | power2.inOut | push-and-return 2 |
| 331.90-333.90 | truck | CU-scoop | CU-wave | sine.inOut | 954 px on screen; part of 2 |
| 340.74-342.20 | pull | CU-wave | F-hold | power2.inOut | (2's return) |
| 423.50-424.60 | push | F0 | F-turn | power2.inOut | the care block thinned at 423.00 to 423.30; returns by the matched cut at 478.09 |
| 556.01-562.01 | push | F0 | F-end | sine.inOut | the film ends |

## Carried from Lessons 1, 2 and 4 (fixed)

- **The room**: Lesson 4's (`$S/l4film/assets/lib`, its `lesson.js` room, staves, dust and bokeh),
  seeded as there; `L.frameRig` and `L.mercGate` from its `frames.js` and `hosts.js`.
- **Chapter cards**: `L.chapterCard(hud, { num, title, baseline: 480, tIn, tOut })`; "Sing it" with
  no numeral.
- **Title (S2)**: Lesson 4's `s02-title` with "Breath and a steady note" (chrome serif italic 140
  px, one line, centred, baseline 380), kicker "LESSON 05"; its staff (bottom line y 696, 28 px
  apart), the bead's rest (1060, 640) on the middle line, the 4 % zoom, the five chimes' notes at
  x 560, 760, 960, 1160, 1360; only the bead's flight changes (S2 to S3, below).
- **The hook's frame (S1g)**: Lesson 4's S15 tease frame on the same pixels: '"support"' serif
  italic 160 at baseline 420, the long note at y 520 from x 560 to 1360, its chrome bead at
  (560, 520), "what keeps it steady?" serif italic 96 at baseline 680.
- **End card (S15)**: Lesson 4's `s16-end` wipe and timing pattern, this film's layout (above).

## The cuts

- **S1 to S2 (38.30).** The same full-frame field on both sides: chrome `#c3ccd6` at 75 % over the
  ground at the frame's centre falling to 35 % at the corners, no edges, round about the frame's
  centre (it grew from the head bead), mean luma 110 to 125 of 255, breathing 2 % from film time
  (Lesson 4's `fieldDisc`). No hosts, no type. S2 shrinks it back into the title bead.
- **S2 to S3 (41.90).** The bead in flight on one curve both scenes compute from film time: lifting
  off its rest at 41.02 (`title` + 2.72), a cubic from the rest (z-mapped) through (1060, 300) and
  (620, 320) to (480, 400), sine.out, landing at 42.02 and shrinking from r 22 to the line's 4 px
  head over its last 0.3 s, turning amber as it lands **(provisional: the lab confirms it clears the
  fading staff and "A3")**. At 41.90 the chart is at F-promise-a fading up (band, "A3", strip
  hairline, "level"; Merc's line not yet drawn); no hosts.
- **S3 to S4 (53.70).** F-promise-b. The chart: band, Merc's line, "A3", "level", the strip's
  hairline; the promise labels gone (53.30). Tavi at (1800, 840), 300, landed (53.12); Merc not yet
  in. m-orange spans the cut.
- **S4 to S5 (68.13, group A to B).** F0. The chart at k 2.5: band 312.5 to 487.5, Merc's line,
  "A3", "level", strip hairline; the label row's "in the band: within 35 cents (Lesson 3)" from x
  400, baseline 150; no chips. The four words parked dim in the top lane, right-aligned to x 1800,
  baseline 110. Merc (110, 840) and Tavi (1800, 840) at 300. The swatches gone (66.40).
- **S5 to S6 (106.28).** F0. The bare chart at 0.78 (plot x 466 to 1340, band 365.5 to 456.5 on
  screen; no line, no chips, no labels inside the plot), the slider at 50 (thumb (903, 723)) with
  "Push" and "50"; the label row's text; Lesson 1's panels, the fork and the type gone (106.20).
  Hosts at 300 in the corners.
- **S6 to S7 (178.83), a matched cut.** S6 ends at F-gauge; S7 starts at F0. On the same screen
  pixels: the Loud gauge (frame x 738 to 1662, y 279 to 731; gold at world y 454; both hatches; the
  chips, "Loud" lit; "the lungs' own push"; "what the note needs" at world baseline 520; "less
  holding back at first"; "more adding as the air runs low"); the small band with Merc's line whole
  (x 738 to 1662, y 143 to 227); the figure's torso at rest (`k` 1.2075, `x0` 150, `y0` 100.75 on
  screen). No cursor, no readout. Only the room changes (F-gauge's layers to rest). Hosts at 240 at
  (100, 840) and (1820, 840).
- **S7 to S8 (216.35, group B to C).** F0. The dimmed figure at its parked place (`k` 0.5, `x0` 140,
  `y0` 180, 35 %); every row and miniature of the card gone (216.25); hosts at 240.
- **S8 to S9 (237.37).** F0. The whole figure at S8's placement with its cue labels; hosts at 240.
- **S9 to S10 (300.98).** F0. The stack, its names, circles, "the easy start" and "the h, only in
  your mind", the folds small; hosts at 240.
- **S10 to S11 (364.73, group C to D), a matched cut.** S10 ends at F-hold; S11 starts at F0. The
  empty hold frame on the same screen pixels: x 1000 to 1640, band 210 to 280, Merc's line y 245,
  no labels; the voice box, the slider, the line and the type gone (364.60). Only the room changes.
  Hosts at 300 in the corners.
- **S11 to S12 (402.58).** F0. The care block from "Your turn." to the listening line, the doctor
  lines small; the frame with its bracket, "0", "10 s" and "Nothing listens"; the ring at 35 %, no
  counter; hosts at 300.
- **S12 to S13 (478.09, group D to E), a matched cut.** S12 ends at F-turn; S13 starts at F0. The
  frame's band and Merc's line on the same screen pixels: x 928 to 1824, band 104 to 202, line 153,
  no labels (gone by 477.60). Only the room changes. Hosts at 300 in the corners.
- **S13 to S14 (540.47).** The bead in flight on one curve both scenes compute from film time: from
  the "five notes" glyph's first dot (272, 434 after the drift) at 539.70, growing from r 4 to r 20,
  to the C4 place (420, 745) at 541.30 (power2.inOut), a cubic through (300, 560) and (380, 680),
  drawn from film time; its whole path left of x 450. Merc standing at (1290, 840) since 510.05;
  Tavi at (1800, 840). The cards' lines gone by 540.30.
- **S14 to S15 (556.01).** The tease figure in flight on its shrink (555.70 to 556.90, power2.inOut)
  from the S14 layout to the end card's box (above), computed from film time on both sides; the
  rows fading (555.70 to 556.10); the hook gone (555.95); Merc (1290, 840) and Tavi (1800, 840) at
  300, both beginning their moves at 556.05.

## Provisional values (each confirmed in a lab still, then unmarked)

The bead's flight S2 to S3; the chart's split from 0.78 (6b) and the strip's opening (6e); the
folds' growth from the throat (9b); the together start's onset (sound round); Merc's arc reach
beside the care block (m-blue at 300); the "settled" flag's time, computed from FACTS 80's points
by the page's rule (stays within 35 c for 0.5 s; entry about 0.69 s, x 477 world); the hop height
of Merc's two hops (the card's foot at y 300 leaves room for any hop under 328 px).
