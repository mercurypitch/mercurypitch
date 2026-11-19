# Handoffs v3: exact frames where one scene meets the next

The last frame of scene N and the first frame of scene N+1 show every carried object on the same
pixels (within 2 px). Values marked **(provisional)** are starting values the builders on either
side confirm in a lab still; this file is then updated and the mark removed before either scene is
built further. Unmarked values follow from the formulas below and are fixed now. Times are the
board clock's (STORYBOARD, header): orientation only, since every scene computes its times from
cues and words. v1 is kept in `review/storyboard-v1/HANDOFFS.md` and v2 in
`review/storyboard-02/before/HANDOFFS.md`; what changed is listed in STORYBOARD's header tables
and DECISIONS 86 to 108 (v2) and 109 to 124 (v3). Paragraphs changed in v3 carry **[v3: n]**,
storyboard critic 02's item number ("prev n": its list of previous items).

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
  **The floor and the hosts' reflections are not on any of these layers**: they are screen-space,
  with the hosts (`room.top`), at every framing and through every move, so the floor stays at y 840
  under the feet (on the mid layer F-strip would put it at y 476, on the far layer at 749)
  **[v3: 6]**.
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
  block, the hook's type and the close-ups' "SLOWED · ILLUSTRATION" chip are frame-fixed (`hud`)
  and never move with the camera. In the turn the frame, the ring and their labels are world
  drawings (they ride the push at 422.80); the care block and the feel block are frame-fixed
  **[v3: 3, 4]**.
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
  host is on screen (`L.mercGate(..., { floor: false })` in every scene: no local patch); it is
  screen-space with the hosts (§ Framing above) **[v3: 6]**.
- **Entrances and moves.** The two leaps are Lesson 4's `leap` (`L.mercGate` with `leap: true`;
  crouch 0.15 s off frame, 0.43 s in the air, carried in from `leapDx` 300 px beyond the edge, Tavi
  from the right, Merc from the left with the pass mirrored). A size change in place eases over
  0.6 to 0.8 s (power2.inOut) about the feet point; a hop is the renderer's hop with the box carried
  through its 0.42 s in the air (power1.in). Merc's two hops: (110, 840) to (700, 840), 508.85 to
  509.40, and (700, 840) to (1290, 840), 509.50 to 510.05; nothing is drawn below y 300 anywhere
  from x 0 to 1400 while he is in the air. The only exits are S1h's slides, 360 px outward over
  37.10 to 37.55 (power2.in; `hook` + 0.00 to + 0.45) **[A-01: 171]**.
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
  600 32, ink-2, left-aligned x 400, baseline 778 (in S5 it moves on `o4` with the axis's ease to the
  strip's left at its height, right-aligned 366, baseline 701, and stays there in S6, so it labels the
  strip, not the slider **[B-01: 184]**). **Label row**, baseline 150: its text Outfit 500
  34, ink, from x 400 ("in the band: within 35 cents (Lesson 3)" in S1 and S5, to about x 1063).
  **S5's definition** "pressure: how hard your breath pushes on your vocal folds" (Outfit 600 34,
  ink) has its own line under the row, x 400, baseline 200, to about x 1370 (73.60 to 85.02), and
  the row's text stays above it; its cap top (176) is 15 px under the chips' foot (160) and 70 px
  under the four words' outlines (to y 106) **[v3: 2]**.
- **Tags** (one size everywhere, **[v3: 2, 11]**): JetBrains Mono 500 26, tracking .18em, ink-2, in a
  chrome 25 % pill 40 high with 16 px each side, so "ILLUSTRATION" is 271 px wide, "LISTEN ONLY"
  250 and "SLOWED · ILLUSTRATION" 453 (text at 0.6 em plus .18 em a character). A tag on a world
  drawing is set in world px and scales with its framing; one on 10h's frame or a frame-fixed one
  is set in screen px. The band chart's two, centred y 140: "ILLUSTRATION" right-aligned to x 1520
  (x 1249 to 1520; S1 from frame 0; S5 from 70.93); "LISTEN ONLY" **right of the plot, left-aligned
  x 1536** (x 1536 to 1786; S1 21.48 to 31.30, S5 90.30 to 105.80), 16 px right of "ILLUSTRATION"
  (v2: right-aligned to x 1300, overlapping it by 51 px). At F-cold (0.916 to 0.92 while it shows)
  "LISTEN ONLY" is at screen x 1488 to 1720, y 146 to 184, 58 px right of the second pill; at 0.78
  (S5f, 5g) the two are at x 1128 to 1340 and 1352 to 1547, y 192 to 224, 12.5 px apart **[v3: 2]**.
- **Right of the plot** (left-aligned x 1536): "?" Outfit 600 64, ink-2, baseline 423; "sung easily"
  Outfit 600 36, ink, baseline 470; "above the band" Outfit 600 36, ink, baseline 262 (S1) or 300
  (S5). Inside the plot, top left: "louder · higher" Outfit 600 56, ink, x 420, baseline 268; S5's
  "also: a little higher" Outfit 600 36 x 420 baseline 310 and "mainly: louder" x 420 baseline 600,
  each with a 3 px chrome arrow (30 px) to the band's top edge (341.7) and to the strip. Under the
  strip: the small type "Both lines are drawings of that rule, not recordings." Inter 34, ink-2,
  right-aligned x 1520, baseline 812.
- **Tavi's straight guess**: `L.GUESS` along y0 from x 540 (t 0.5 s at W 4) to 1520 in S1, from 400
  to 1520 in S10; its "?" as above. Merc's line goes to 0 under it, returning when the guess leaves **[A-01: 170]**.
- **The long note's head bead** (S1g, S1h): chrome `#c3ccd6`, world (400, 400), r 30.8 (screen
  (560, 520), r 22 at F-hook), fading in 34.40 to 34.80; on "steady?" (36.77) it scales 1.2 and
  sends one echo ring. The hook's two lines leave up fast 37.14 to 37.34 and the hosts slide out
  37.10 to 37.55; then the approach, 37.44 to 38.14 (`hook` + 0.34 to + 1.04): the bead itself,
  in its own screen layer, grows from r 22 to r 1200 (wider than the frame) in log scale, its time
  spread by how much of the frame each step covers, crisp to r 300 and then defocusing (60 px of
  blur by r 900), dimmed to 62 % by r 500; the camera reaches F-bead with it; the field comes up
  over it over the last 0.25 s and breathes to the cut **[A-01: 171]**.
- **Push slider** (S5): track x 400 to 1520, y 800, 4 px chrome at 50 %; `x(p) = 400 + 11.2 p`, the
  thumb a chrome disc r 16 at `x(p)`, its value Outfit 600 30 tabular, ink, centred over it,
  baseline 776; "Push" Outfit 600 32, ink, right-aligned x 366, baseline 811 (Merc's keep-out at
  300 ends at x 210). The thumb follows FACTS 80's Push curve exactly (50 to 0.6 s, linear to 100
  by 2.1 s, held to 3.6 s, linear to 50 by 4.8 s, held to 5.6 s), so line, strip and thumb are one
  function of `t`. The push plan (5d): chrome 40 % arrows on y 770 from 960 to 1520 and back, a
  4 px hold bar at 1520.
- **The chart at 0.78** (S5f to S6b, an object move, 97.30 to 98.50, power2.inOut): the whole chart
  group drawn at `x' = 0.78 x + 154`, `y' = 0.78 y + 99`: plot x 466 to 1340, band 365.5 to 456.5,
  strip centre 637, the thumb at (903, 723), its "50" over it (about x 890 to 916, y 688 to 704),
  "Push" right edge 440. The Push note's peak (held at 100, 2.1 to 3.6 s) runs x 772 to 990, its
  line centred y 333 (315 to 351 with the wave), the swollen strip 593 to 681 under it **[v3: 9]**.
- **Pills** (S1, frame-fixed): Outfit 600 34 in chrome-stroked capsules 52 high centred y 108 (as
  shown at F-cold; v2: 112): "Settle, steadier than before" x 470 to 930, "Get louder and drift
  higher" x 970 to 1430; the ring timer at (1480, 108), r 18; the check an ink SVG mark right of
  the second capsule, 12 px clear of its stroke (about x 1442 to 1469), centred y 108 (DECISIONS
  166; it was at the capsule's left, in the gap). 4 px higher since v3: the "ILLUSTRATION" chip under the second pill rises with the
  drift to screen y 146 at 31.25, and the pills' foot (134) keeps 12 px over it (v2: 8 px)
  **[v3: 2]**.
- **The swatches** (S4): three envelopes 160 wide centred at x 640, 960 and 1280, y 850, half-heights
  10, 28 and 56, chrome outline 2 px at 50 %; labels Outfit 600 36, ink-2 (lit: ink), centred,
  baseline 950; the hairline from the middle swatch's top (960, 822) to the strip's foot (960, 718).
- **Lesson 1's figure** (S5f, frame-fixed at F0): two panels 187 x 203 at x 1433 to 1620 and 1636 to
  1823, y 301 to 503 (v2: 271 to 473), Lesson 1's LOUDER and HIGHER drawings at 0.47 of their size,
  sliding in from x 1920 (97.60 to 98.50); "loud ≠ high" Outfit 600 48 ink centred x 1628, baseline
  277 (v2: 247), so about x 1496 to 1760, y 242 to 287: 19 px under "LISTEN ONLY" at 0.78 (to y 224),
  14 px over the panels; the panels' foot stays 125 px over Tavi's keep-out (y 628) **[v3: 2]**.
- **The fork** (5g, screen px, 104.00 to 104.60), ink 3 px, both ends at the peak **[v3: 9]**: the
  stem leaves the thumb's right side at (914, 717), heading up and right at about 30 degrees so it
  passes 12 px or more right of "50", crosses the strip right of the peak (about x 1000) and rises
  to the fork point (1010, 525), between the band's foot (456.5) and the swollen strip (596 at
  x 1010); one branch from there to an arrowhead at (960, 582), 11 px over the swollen strip; one
  to an arrowhead at (960, 375), on the band's fill under the raised line (24 px under its lowest
  point, 351). Labels Outfit 600 40, ink, inside the fork, left-aligned x 806: "louder" baseline
  575 (x 806 to 926, y 546 to 575: 18 px over the strip's fill, 40 px left of its branch; 104.30)
  and "higher" baseline 500 (y 471 to 508: 14 px under the band's foot, 66 px left of its branch;
  104.75); 38 px between them. "in a voice, one push moves both" serif italic 56, ink, centred x
  960, baseline 130. v2's ends at x 1137 pointed where the line and strip had already come back,
  and "louder" sat on the strip's fill.
- **S1's arrow** (1f): ink 3 px from the pushed line's last in-band centre point (t 2.75 s, x 1170)
  to its end (1520, 250), curving above the line, 20 px clear of it.

- **Group A's full-film fix round** **[F-01 fix: 236]**: S1, the band's fill leaves with its edges and
  the label row (0.4 s) and no longer rides the pull under '"support"'; the take stays at 50 % from
  "holds" until the guess leaves; the guess's dash is 4 px on screen. S2, the type exits at the
  fade-up - 0.42 s (title + 2.10), and the chart fades up with the strip at 720 and "level" at 820.
  S3, the strip at 720, its outline x 390 to 1530, y 660 to 780, rx 60; "level" at (400, 820), "what
  your diaphragm does" at (400, 874). S4 at F-strip, the strip at world 720 (screen 308), its
  envelope half-height 42 (screen 249.2 to 366.8); swatches at world x 640, 960, 1280, 240 wide,
  half-heights 15, 42, 84, at world y 890 (screen 546); names at world baseline 1022 (screen 730.8);
  heading 790, row baseline 862, ring (1636.9, 546) r 18; over the crane up the strip glides 720 to
  690 and "level" 820 to 778 (S5's first frame unchanged), and the band's lines come in 12 px under
  the parked row, 0.3 s linear each. Moving type in S1, S2 and S4 is drawn in composited layers.

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
  661); hips y 764; the legs masked out from y 696 to 726 (a soft fade; 730 to 760 before the leftovers
  round, v3 750 to 780), 20 px over "with your breathing muscles,"'s ink at F-gauge **[leftovers: 222]**. Labels: "lungs"
  right-aligned x 350, baseline 470; "breathing in" (6c, 6d; Outfit 600 36) and "can't push air
  out" (6i; **Outfit 600 30**, about 270 px, so x 80 to 350, at F-gauge screen x 24 to 308, where
  36 px would start at about x -20 **[v3: 9]**) at the same place, never together, right-aligned
  350, baseline 580; "diaphragm" right-aligned 350,
  baseline 640, a 1.5 px chrome leader to (378, 661); "belly" x 640, baseline 700. Under the figure
  (x 260): "with your breathing muscles," baseline 766 and "never your throat" 804 (screen 779.1 and
  819.0 at F-gauge, the ink 13.7 px over the floor horizon; 800 and 838 before) **[leftovers: 222]**; "belly and rib
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
  baseline 300 (a 26 px level mark, x 932 to 958, y 289, over the shoulder: at 40 px it ran into the neck at x 967 **[C: 191]**); "breathe in quietly, low"
  right-aligned 910, baseline 400; "knees unlocked" right-aligned 907, baseline 700 (v2: 950, across
  the back arrow; now 16 px left of the arrow's 3 px stroke at x 923.5 to 926.5, its leader crossing
  the arrow to the knee (995, 686)) **[v3: 9]**; "jaw · tongue ·
  neck loose" x 1070, baseline 245; "diaphragm at work" x 1110, baseline 470; "as much as feels
  easy" x 1110, baseline 560; "Singers breathe in" / "different ways." serif italic 48, x 1110,
  baselines 720 and 770.
- **S13 (recap card 1)**: `k` 0.75, `x0` 1150, `y0` 90: x 1262 to 1420, y 105 to 500, legs masked
  from y 480.

- **S8's opening** **[C-01 fix: 212]**: the stand-up starts as the chapter card starts to leave
  (o9 - 0.5), the figure coming up from 25 % to full while the card is still up, so it is at full
  through its move; S8's out-breath ends at rest (breath 0) and rests there across the cut to S9.

### The gauge and Merc's small band (S6)

- **Small band**: x 760 to 1640, y 160 to 240, Merc's line y 200 (amber, 3 px, drawn behind the
  cursor); "A3" Outfit 600 36 right-aligned 740, baseline 212; "the note: unchanged" Outfit 600 30,
  ink, x 760, baseline 140. Merc's line arrives whole with the split (6b) and stays until the gauge
  opens: it fades from the small band at 127.95 to 128.25 (6e), and from 130.25 the sung note draws
  it again behind the cursor **[v3: 11]**.
- **Frame**: x 760 to 1640, y 290 to 720, chrome 30 % 2 px, radius 8. `x(t) = 760 + 88 t` (t 0 to
  10 s). The lungs' own push `y_L(t) = 340 + 38 t`, chrome 3 px. Gold `#ffd84d` 3 px "what the note
  needs": Quiet y 606 (crossing 7 s, x 1376); Loud y 454 (crossing 3 s, x 1024). Hatches: held back
  (above gold, under the lungs' line) 1.5 px chrome at 25 %, 45 degrees, 10 px apart; added (under
  gold, over the lungs' line) the same at 135 degrees. Cursor: 3 px chrome with a soft glow, y 160
  to 720 (through both).
- **Labels** (v2 places in bold):
  - Every label's plate (`back`) is its text box plus 4 px (`backPadX: 4, backPadY: 4`) and covers no
    stroke **[B-01: 182]**.
  - "push of air (not pitch)" Outfit 600 30, ink, x 790, baseline 276 (v3 275; its plate y 242 to 288,
    clear of the band's edge, 241, and the frame's top, 289) **[B-01: 182]**, after a 12 x 24 px up
    arrow at x 768 (128.85).
  - "one 10-second note" Outfit 500 30, ink-2, x 760, baseline 760 (128.40; **leaves 170.34 to
    170.54**).
  - "the lungs' own push" Outfit 600 30, ink, x 776, baseline 327 (v3 325; its plate y 293 to 339, 2 px
    under the frame's top stroke) **[B-01: 182]** (130.45).
  - "what the note needs" Outfit 600 30, ink, **x 776, baseline 646 (Quiet; v3 640), under the gold
    line's left end, its plate 4.5 px under the line's stroke** **[B-01: 182]** (131.55). Where it sits the falling line runs at y 347 to 470 (148 px clear above the
    label). **In Loud (v3) it does not ride up with the line**: it fades with "held back" and
    "added" on "loud note" (171.63 to 171.83) and lands again on "back" (173.79) above the gold
    line's right end, right-aligned 1630, baseline 440 (about x 1345 to 1630, y 418 to 440): 12 px
    over the gold line's stroke, on ground that is empty in Loud (right of the crossing at x 1024
    the falling line is under the gold line), 78 px under the "ILLUSTRATION" chip. Riding up to
    baseline 520 at x 776 to 1061, as v2 had it, it stood across the leader of "less holding back
    at first" at x 900, and no other path from that label into the held-back region misses it
    **[v3: 1]**.
  - "held back" Outfit 600 34, centred x 860, baseline 540 (132.25).
  - "added" Outfit 600 30, centred (1560, 645), inside the added region with no leader, its glyphs
    15.5 px under the gold line and 20.7 px over the lungs' line; it lands 0.45 s after the
    crossing (the readout's switch to "Now: adding", when the lungs' line passes under the gold
    line), once its region shows **[kit-01: 2]** (DECISIONS 144) **[B-01: 183]**.
  - The readout "Now: holding back" / "Now: adding" Outfit 600 34, ink, **right-aligned 1630, baseline
    382, inside the frame's top right under the chip** (its plate y 344 to 395, 4 px under the chip:
    at v3's place, right-aligned 1640, baseline 275, a 34 px label's plate cannot fit between the
    band's edge and the frame's top) **[B-01: 182]** (132.75; the switch at 137.25, a swap: the old words leave in 0.1 s, then the new land
    in 0.15 s **[B-01: 183]**).
  - Loud: **"less holding back at first" Outfit 600 30, ink, x 760, baseline 765 (about x 760 to
    1150, y 743 to 771), under the frame's left end in v1's slot, with a 1.5 px leader straight up
    from (900, 740) to (900, 430)**, ending inside the small held-back region (at x 900: the lungs'
    line 400 to the gold line 454; the end 30 px under the one and 24 px over the other) (172.92;
    on screen until 7a fades it, 178.90 to 179.40). The slot is free for the whole window: "one
    10-second note" left it at 170.54, "added" and "held back" are gone by 171.83, "what the note
    needs" no longer rides into the leader's path (above), "belly" ends about 35 px to the left, the
    frame's foot (720) is 23 px over its cap top, and the folding gauge and the parking figure move
    away from it in 7a. At F-gauge it shows at screen x 738 to 1148, baseline 778, its leader at
    x 885 **[v3: 1]**. "more adding as the air runs low" right-aligned 1640, baseline 805 (about x
    1175 to 1640, y 783 to 811), a leader from (1500, 780) up to (1500, 600), inside the large added
    region (at x 1500: 454 to 660) (175.51): 25 px right of "less holding back at first" and 12 px
    lower (its cap top 783 against the other's descenders, 771).
  - **Chips "Quiet" and "Loud"** (Outfit 600 30, ink-2 dim, ink lit, in chrome 25 % / 60 % outlines
    40 high; "Quiet" about 103 px wide, "Loud" 88) stacked just outside the frame's top right,
    left-aligned x 1652, centred y 320 ("Quiet") and 372 ("Loud") (170.34): 12 px from the frame's
    right stroke (1640) and from each other, 22 px from the "ILLUSTRATION" chip across the stroke.
    At F-gauge: screen x 1675 to 1783, y 290 to 386, clear of the screen's edge and of Tavi's
    keep-out (from y 666). v2's place (right-aligned 1640, centred y 266) left them 6 px under the
    small band and 4 px over the frame **[v3: 9]**.
  - **"ILLUSTRATION"** (the gauge's tag; § The band chart, Tags), right-aligned 1630, centred y 320
    (x 1359 to 1630, y 300 to 340): the chart's chip from S5, which glides here from the label row
    at 0.78 (108.80 to 109.40, down and then right over the plot's empty top right, growing to full
    size), stands right of the bare plot through the split and the strip (19 px right of the plot's
    end, 25 px over the band at 0.78, 60 px under the small band), and is inside the frame's top
    right once the frame opens (6e): 9 px in from the right stroke and 9 px under the top one, the
    top stroke rising behind it in the opening's last 0.2 s (128.97 to 129.18; the chip is drawn
    above the frame's stroke and above the cursor, which passes behind it from about 137.1 to 140.1).
    In Quiet and in Loud the corner is empty round it: the readout ends 18 px above it, "what the
    note needs" (Loud) is 78 px under it. At F-gauge: screen x 1367 to 1652, y 290 to 332. It
    leaves with the gauge's labels at 178.90 to 179.40 (7a) **[v3: 3]**.
- **Predict** (frame-fixed): "PREDICT" mono 26, ink-2, x 760, baseline 115; capsules "Push it out"
  x 920 to 1150 and "Hold it back" x 1180 to 1420, 48 high, centred y 105; ring timer (1470, 105).
- **The split (6b)** **(provisional: the lab decides the curves)**: from the chart at 0.78 (plot
  x 466 to 1340, band 365.5 to 456.5, strip centre 637) the band and Merc's line map to the small
  band (x 760 to 1640, y 160 to 240) and the strip to (760 to 1640, centre 690); one move, 110.90 to
  112.40, power2.inOut. The slider and the label row's text fade first (110.90 to 111.10). One
  constraint on the band's curve: it rises before it slides right, its foot above y 288 before its
  right end passes x 1347, so it passes 12 px or more above the "ILLUSTRATION" chip (x 1359 to 1630,
  y 300 to 340) **[v3: 3]**. The opening (6e) grows the strip's box (y 630 to 750) to the frame's
  box, 127.95 to 129.35.
- **Settles when the voice names a label again** (the board's settle, 0.15 s up and 0.6 s back)
  **[F-01 fix: 238]**: "held back" 1.2 on "Hold" (135.20), as on "holding" and o7's "hold";
  "the lungs' own push" 1.08 on "themselves" (140.70 and o7's, 160.76); "what the note needs" 1.08
  on "needs" (144.12). These two scale from their plate's top-left corner (they hang under the
  frame's top stroke and the gold line, which a baseline-anchored scale would push their plates
  across); "what the note needs" keeps 4.5 px under the gold line at its peak. "with your breathing
  muscles," 1.08 on "muscles," (136.91) from its left baseline: the legs stay 18.6 px from its
  ink, its right end 57.8 px from "one 10-second note".

### The mix-up card (S7, F0 from the matched cut; frame-fixed)

Left column from x 360 (the parked figure is x 215 to 320); right column x 1180 to 1640 for the
miniatures; the lower half for each piece of evidence while it is large.

| Row | Words (Outfit 600, ink, x 360) | Lands | Miniature (right column) |
| --- | ------------------------------ | ----- | ------------------------ |
| kicker | "COMMON MIX-UP" (mono 30, ink-2, at (120, 110)) | 179.48 | - |
| 0 | "'support' means pushing hard, or squeezing" 44 px, baseline 180, dashed ink-2 underline at y 194, its "?" (Outfit 600 64, ink-2) after its last word | 180.77 | - |
| 1 | "push harder: louder, and higher" 40 px, baseline 300; "ILLUSTRATION" chip under it, x 360, centred y 345 | 186.80 | the pushed chart at 0.41: x 1180 to 1640, y 212 to 427 |
| 2 | "squeeze: a pressed sound," / "more pressure, not less" 40 px, baselines 490 and 535; "same push: much quieter" 30 px, baseline 580; its own "ILLUSTRATION" chip right of its first line (24 px after it, centred y 476), landing with the miniature's names **[B-01: 187]** | "squeeze" 187.36; "same push" with the strips, 189.52; "more pressure, not less" when said, 195.55 **[v3: 11]** | the two strips at 0.5: easy x 1180 to 1350, pressed 1380 to 1550, y 452 to 575; "easy" and "pressed" Outfit 600 26 centred under each, baseline 605 |
| 3 | '"support": how singers manage the breath' 40 px, baseline 655; "no one agreed meaning" 36 px, baseline 700 | 205.80 (shrunk in) | - |
| 4 | in the lower right, x 1180 (to 1620 at most): "The better idea:" 30 px ink-2, baseline 648; one phrase to a line, 40 px, baselines 694, 738, 782 and 826 ("steady air, not more of it", "breathe in low", "start easily", "let it flow out unforced"; the last line's glyphs 13 px over the floor horizon, 840), each on its first word; rows 0 to 3 dim to ink-2 as it lands (0.6 s) **[B-01: 185, 188]** | 206.32 to "let" (v3 put the last phrase at 214.51, on "flow") | - |

- **The chart reassembled** (7a, 179.00 to 180.40): the gauge folds back onto its floor and becomes
  the strip; the small band and the strip glide to plot x 400 to 1520, band centre 470 (k 2.5,
  382.5 to 557.5), strip centre 700. **Evidence 1, large** (7b): the pushed take redrawn over the
  plot at 2.5 times its speed (184.10 to 185.70), silent, then held whole 0.5 s on every clock (where
  the clock is shorter it redraws faster, never the hold shorter; on the scratch clock 3.02 times,
  a 0.4 s shrink, and row 1 0.45 s before row 2's first line) **[B-01: 180]**; "ILLUSTRATION" right-aligned 1520, centred
  y 790 (184.00); the strip shows its resting envelope in ghost violet from the reassembly
  **[B-01: 184]**; its highest peak y 285, 91 px under row 0's foot (194) **[B-01: 179]**. **Into row 1** (186.20 to
  186.80, power2.inOut): `x' = 1180 + 0.41 (x - 400)`, `y' = 310 + 0.41 (y - 470)`; the chart's chip fades
  as the chart shrinks and row 1's own chip lands with row 1, rather than one chip crossing the
  shrinking chart and row 1's words **[B-01: 179]**.
- **Evidence 2, large** (7c, 189.52 to 190.32): "easy" x 860 to 1200, half-height 110; "pressed" x
  1260 to 1600, half-height 28; both centred y 680, violet 28 % fill, 2 px violet edges at 70 %; a
  chrome bar 3 px at y 545 from x 860 to 1600 with a drop to each strip's top; "one push of air"
  Outfit 500 28, ink-2, centred x 1230, baseline 530; "easy" and "pressed" Outfit 600 30 centred x
  1030 and 1430, baseline 830. **Into row 2** (196.50 to 197.10): `x' = 1180 + 0.5 (x - 860)`,
  `y' = 520 + 0.5 (y - 680)`; "one push of air" fades, the names land again at 26 px (197.10).
  While large it carries its own "ILLUSTRATION" chip, right-aligned 1600, centred y 470 (over the
  pair's right end, 19 px over "one push of air"), fading as the pair shrinks **[B-01: 187]**.
- **The word, large** (7d): '"support"' serif italic 160, ink, x 360, baseline 800 (198.06); "how
  singers manage the breath" Outfit 600 44, x 980, baseline 800 (199.35); "no one agreed meaning"
  Outfit 600 36, x 980, baseline 850 (204.09). **Into row 3** (205.20 to 205.80): the word to 40 px
  at x 360, baseline 655, the phrase following it on that baseline, "no one agreed meaning" to
  baseline 700.
- Every row and miniature leaves up fast from 215.85, 0.05 s apart; the parked figure stays.
- **Settle** **[F-01 fix: 238]**: "how singers manage the breath" 1.08 on "how" (193.50), from its
  left baseline (the board's settle). The rows need no lighting (DECISIONS 228): each lands on its
  own words.

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
  250, 450, 650, half-height 70, x 700 to 1600; names Outfit 600 36 right-aligned 660 **[C: 191]**, baselines
  262, 462, 662 (275.50, 275.90, 276.30); "the puff" x 720 baseline 148, "the click" x 812 baseline
  368, "neither" x 720 baseline 568; "the easy start" Outfit 600 40 right-aligned 660, baseline 714, under "Together" as row 3's name **[C-01 fix: 212]** (the puff and the click moved off the circles and the crests **[C: 191]**); the "h"
  serif italic 120 ink-2 at 70 % centred (760, 690), row 3's first 200 px (x 704 to 880, soft to 920) at 25 % while it shows, both over 0.5 s linear **[C-01 fix: 212]**; "the h, only in your mind" Outfit 500 30 x 720
  baseline 770; the folds small in x 160 to 330, y 110 to 280. Hosts at 240: Merc's keep-out ends
  at x 184, Tavi's starts at 1736. **Chips in the stack** **[v3: 3]**: the strip's "ILLUSTRATION"
  rides the move from centred y 270 (which would sit on row 1, y 180 to 320) to centred y 150,
  right-aligned 1600 (x 1329 to 1600, y 130 to 170): 10 px over row 1's envelope, clear of "the
  puff" (x 720) and the small folds (to x 330). "LISTEN ONLY" for the catch in `starts`
  lands as `starts` begins (281.37) under row 2's name, "A catch": right-aligned 660, centred y
  about 495, 12 px or more from the name and the row, so it reads as row 2's tag **[C-01: 195]**
  (v3 had it right-aligned 1600, centred y 350, between rows 1 and 2, where it read as no row's); "the click" (x 800 to about 935) is far to its left. Both dim with the stack (hidden
  while dim, 301.13) and leave with it, from dim, 303.10 to 303.40.
- **Onsets** within each start (FACTS 80): air first's noise from 0, its tone from 0.25 s; the
  catch's click at 0.15 s; together's tone at the sound's own onset as the mixer's stem puts it,
  measured in the sound round **(provisional)**.

- **Group C's fix round** **[C-01 fix: 212]**: the strip is a lit lane (chrome 6 %, x 700 to 1600, y
  320 to 540), drawn with the strip and fading as trace 3 settles into row 3; each finished trace
  drops to 30 % when the next start is named and stays until the next trace's head draws over it
  (wiped at x 1150 at + 0.8 s). The folds box at 1.35 is 80.5 px clear of the lane. The stack in
  order, from b27a + 0.09: the folds shrink (0 to + 0.5), trace 3 settles (+ 0.4 to + 1.0), the
  names at + 1.0, + 1.4 and + 1.8. The chapter opening: the figure's fade and the ring start as the
  chapter card starts to leave, and the ring grows in 0.5 s.

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
- **CU-scoop** (s 1.8, ox -360, oy -200) **[kit-01: 9]**: the scoop anchored near the frame's left, the
  line's first 1.5 s at x 360 to 662 and the wave running right across the frame, the band y 457 to
  583, the low point (360, 628); "scoop" Outfit 600 30 world (54 on screen) centred (360, 700)
  baseline (world (400, 500)). (v3's ox 114 put the scoop at x 834 and left the frame's left 43 % empty.) The axis is faded (324.60 to 342.20): at CU-wave its "10 s" would
  sit at (1896, 741), inside Tavi's keep-out. **"SLOWED · ILLUSTRATION"** **[v3: 3]**: at CU-scoop the
  chart's own "ILLUSTRATION" chip is not shown (at screen x 1888 to 2376 its left 32 px would stand in
  frame: every world chip fades by its distance to the frame's edge, never shown cropped or within
  16 px of it, `cam.edgeAlpha` **[kit-01: 9]**), so v2's "SLOWED" chip says both, and it is frame-fixed, screen px (mono 26, 453 x 40), x 1110 to 1563, centred y 400
  (y 380 to 420), from 326.20 to 333.90 (out 333.90 to 334.10): 542 px right of "settled" (screen x
  428 to 568, y 382 to 416, measured in the real font) and 611 px right of its flag (x 499), 58 px
  under "in the band" (screen x 792 on, y 283 to 322), 37 px over the band's top (457) **[kit-01: 9]**. v2's place, left-aligned x 834, ran into "settled". It
  stays through the truck (331.90 to 333.90) and nothing passes under it: the band and Tavi's line
  stay below y 457, "in the band" and the chart's chip slide in above y 340, and "settled" and its
  flag start left of it and slide away left. It leaves as the truck lands, when the chart's own chip
  stands in frame at CU-wave (x 1408 to 1896, y 268 to 340), 40 px over where it was; "small
  vibrato: inside the band" lands in that place at 334.83, 0.73 s after it has gone.
- **CU-wave** (s 1.8, ox -840, oy -200): the held wave from x 888 (world 960) to the frame's edge,
  the band y 457 to 583 (Tavi's keep-out starts at y 628); the vibrato marks two ink hairlines 1.5 px at
  the wave's crest and trough, screen y 491.2 and 548.8, x 1124.4 to 1364.4, a 10 px tick across
  each end (world y 384 and 416, x 1091 to 1224) **[C-01 fix: 212]**; "small vibrato: inside the band" Outfit 600 30 world at (888,
  416) (world (960, 342)); "in the band" at (312, 322); the chart's "ILLUSTRATION" chip at x 1408
  to 1896, centred y 304. "A, any octave" and "settled", which this framing would cut at the left
  edge, are faded from 331.90; after the pull they come back one at a time with the axis, the main
  one first: the axis 342.00 to 342.20, "A, any octave" 342.25 to 342.45, "settled" 342.46 to
  342.66, on "settles into the band", as its flag scales 1.2 **[v3: prev 5]**.

- **Group C's fix round** **[C-01 fix: 212]**: 10b, the chart fades in at F0 from the stack's exit
  + 0.3 over 0.25 s (linear) and is at full, labels and chip, before the push. 10f, the "stays"
  bracket line at screen y 457 from x 398 (12 px right of "settled") to 1688, its ticks down to
  465, 16 px over the mint edge. "No." (b33): an ink strike through the guess and its "?" from
  b33 + 0.06 over 0.3 s, held to b33 + 0.76, then the rest clears in turn 0.05 s apart over 0.3 s
  linear each (the guess, the chart's labels, the chip and axis, the brackets, Tavi's line last);
  the frame's slide starts once her line has gone (about b33 + 1.46) and the voice box draws 0.4 s
  into it.

- **The chart as the lead subject** **[F-01 fix: 235]**: S10 keeps the cents scale at 2.5 world px a cent
  while the window widens from 4 s to 10 s (the wave rule's exception: k 2.5, W 10; a cycle 26.5 px and
  91 px peak to peak at F-hold, 36.7 and 126 at the close-ups). At F-hold (y' = 1.3 y + 10) the band is
  y 361.65 to 589.15 (227.5 px), x 232 to 1688; Merc's line and the dashed guess world y 358 (screen
  475.4); row 1 baseline 277.8, the chip centred 263.5, "steady: ..." 221.9, her guess 158.2 (underline
  176.4, strike 145.2); the flag x 334.5, y 340.85 to 361.65, "settled" 331.75; the "stays" bracket y
  334.2 from x 399.3; axis ticks 691.2 to 701.6, labels 725; the length bracket 753.6, its label 796.5;
  SLOWED frame-fixed x 1110 to 1563, y 212 to 252. The scoop's deep part (her first 0.45 s) fades by its
  distance to Merc's body during the truck and the pull. 10h's slide shrinks this chart into the hold
  frame (end frame unchanged). The full table is in `lab/s10-steady/BUILD-NOTES.md` (Fix round F-01).

### The hold frame at the right half (S10h to S12; screen px)

Drawn at F-hold in S10h, so world = `((x' + 288) / 1.3, (y' - 10) / 1.3)`; from 364.73 (S11) world
= screen. The slide (354.00 to 355.10, power2.inOut) takes the plot from x 232 to 1688, band 484.5
to 575.5 to:

- **The frame**: x 1000 to 1640, band y 210 to 280, Merc's line y 245; 64 px a second, 1.0 px a
  cent (the wave rule at 640 px: `k W = 5.71`, so W 6 at k 1.0 gives 19.4 px a cycle, 28 px peak to
  peak). Tavi's line has faded (353.90 to 354.30) before it shrinks.
- **10h's slider**: track x 1000 to 1640, y 380, thumb r 14, value Outfit 600 26 tabular baseline
  358, "Push" Outfit 600 30 right-aligned 985, baseline 390; the silent line draws at 106.7 px a
  second from 361.20 and follows FACTS 73's rule (+1.2 c a step: 75 is +30 c, 30 px up; 100 is +60 c, 60 px up); the
  slider from "needs" + 0.4, one push 50 to 100 and back on "because" (two legs of 0.9 s; the bump
  59 px, 2.1 times the vibrato's 28 px peak to peak), "a change in the air moves it" on "because"
  **[C-01 fix: 212]**; "ILLUSTRATION" right-aligned 1640, centred y 176 (361.65; screen px, 271 x 40, so
  x 1369 to 1640, y 156 to 196: 14 px over the band's top edge, where v2's y 180 left 10)
  **[v3: 2]**.
- **The voice box** (10h): a rounded outline x 300 to 640, y 190 to 510, radius 60; the folds at 0.8
  centred (470, 350); muscle bands chrome 6 px at x 380 and 560, y 280 to 420; "voice box" Outfit
  600 32 x 300 baseline 170; "muscles here set the note" Outfit 600 36 x 260 baseline 570; "a
  steady note needs steady air too" and "a change in the air moves it" Outfit 600 40 x 260,
  baselines 680 and 740.

### The turn (S11, S12)

**World drawings** (F0 from 364.73; at F-turn from 423.90 **[v3: 4]**, `x' = 1.4 x - 472`, `y' = 1.4 y - 190`):

| Item | F0 (world = screen) | At F-turn |
| ---- | ------------------- | --------- |
| The frame: band, Merc's line | x 1000 to 1640, band y 210 to 280, line y 245 | x 928 to 1824, band y 104 to 202, line y 153 |
| The bracket (370.10), 2 px chrome, end ticks | y 292, x 1000 to 1640 | y 219 |
| "0" (x 1000) and "10 s" (right-aligned 1640), Outfit 600 30 ink-2 | baseline 322 | baseline 261 |
| "A3 · Merc" (blue dot r 6 at x 1000, text from 1016) and "A4 · Tavi, an octave up" (orange dot at 1186, text from 1202), Outfit 600 30 ink | baseline 362 | baseline 317 |
| "Nothing listens" Outfit 600 30 ink, x 1000 to about 1225 | baseline 402 | baseline 373, x 928 to 1243 |
| "Breathe in, low and quiet" Outfit 600 28 ink, right-aligned 1640, from about 1278 (426.57 to 428.30) | baseline 402 | baseline 373, x 1317 to 1824: 74 px right of "Nothing listens" |
| The ring: track chrome 35 %, stroke 10; arc chrome 100 % with a soft glow, clockwise from 12 o'clock, `angle = 36 t` over the hold; 12 o'clock tick 4 x 24 | centre (1320, 572), r 136: x 1184 to 1456, y 436 to 708 **[D-01 fix: 213]** | centre (1376, 610.8), r 190.4: x 1185.6 to 1566.4, y 420.4 to 801.2 |
| The phase word inside the ring ("Listen", "Breathe", "Sing"), Outfit 600 40, ink, centred | baseline 530 **[D-01 fix: 213]** | baseline 552, 56 px |
| The counter, Outfit 600 80 tabular, ink, centred ("0" at 428.50, then 1 to 10) | baseline 622 **[D-01 fix: 213]** | baseline 680.8, 112 px |
| "Listen · Breathe · Sing" mono 28: the named word at ink, the other two ink-2 at 60 %, a 24 x 3 chrome mark at baseline + 7 under the named word, sliding to the next in 0.25 s; "at about speaking volume" and "stop sooner if you need to" Outfit 500 30 ink, centred x 1320 | baselines 747, 785, 820 (the last ink 14 px over the floor horizon) **[D-01 fix: 213]** | gone (they leave up fast 422.30 to 422.60, before the push **[v3: 4]**) |
| The playhead, 3 px chrome, the band's height | `x = 1000 + 64 t` | `x = 928 + 89.6 t` |

The ring's breath: scale 1 to 1.08 and back about its centre, 426.10 to 428.10; its echo grows to
1.16 of the radius. At rest at F-turn its ink is 23 px over the floor horizon and 30.8 px under
"Nothing listens"; at the largest breath 16 px and 15 px, and its tick 20.5 px from "Breathe in,
low and quiet" (the label unmoved). Signature 3's "448 px across" is 381 px now: the labels' line
and the floor rule hold the ring to r 141 at most **[D-01 fix: 213]**. Tavi's keep-out at
F-turn starts at x 1700 (the ring ends at 1566.4) and y 628 (the frame's labels end at 373).
The ring draws on in 11b on "seconds" (at 35 %, no counter) and "Nothing listens" lands 0.4 s
after it; after the close, the bracket, "0", "10 s", "A3 · Merc" and "A4 · Tavi, an octave up"
fade with the ring, and the band, Merc's line and "Nothing listens" stay **[D-01 fix: 213]**.

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
  word with their parentheses. **Before the push** (422.30 to 422.60, the push itself 422.80 to
  423.90) the care icon, the comfort line, the reasons and the listening line fade; "Your turn.",
  the stop line and the small doctor lines stay. **"Your turn." stays through the viewer's ten
  seconds** and fades with the ring, its word, the counter and the playhead (438.60 to 439.00). It
  runs about x 260 to 755 (10 characters of serif italic at about 0.45 em), y 123 to 200 (no
  descenders): at F-turn the frame and its labels start at x 928 (173 px right of it) and the ring
  at 1152; Merc's body ends at x 190 and y 648, his arcs at about x 225 (35 px across, and 448 px
  under its foot); "How did that feel?" (x 1000, baseline 480) lands only at 439.00, when it has
  gone; it is 322 px over the stop line's cap top (522). On the left through the turn, then: "Your
  turn.", the stop line and the small doctor lines **[v3: 4, 7]**. **Full size** (12h): the stop line fades (459.85 to 460.25) and the
  doctor lines become Inter 40, ink, seven lines broken by hand at phrase ends, baselines 430 to
  730 (50 apart: "If hoarseness or discomfort lasts" / "more than a couple of weeks," / "see a
  doctor (a GP or an ear," / "nose and throat specialist)." / "If it's very painful," / "or
  breathing or swallowing is hard," / "get help straight away."), ink to x 846, within
  x 260 to 960 **[D-01 fix: 213]**, a cross-fade rising 12 px (460.00 to 460.80); at F-turn nothing of the frame's is
  left of x 1000 below y 373, so they stand clear. Merc's body ends at x 190 and his talking arcs
  reach x 229.3 at most (measured on m-blue-s12, DECISIONS 202), so x 260 keeps 30.7 px.
- **Feel** (12f to 12h, at F-turn): "How did that feel?" serif italic 64, ink, x 1000, baseline
  480; a ring timer at (1660, 458), r 16; capsules x 1000 to 1230, 44 high, centred y 540, 596, 652,
  708 (Outfit 600 30); lines Outfit 500 30, ink, x 1260: "rest for a few easy breaths" (the page's words **[D-01: 209]**) baseline 579 (a
  2 px chrome bracket from the first two capsules at x 1240), "rest before you sing again" 663,
  "enough singing for today" 719. All of it left of x 1630 and above y 730. On "Whatever you
  chose:" all four answers light; then the feel block (question, capsules, lines, bracket) dims to
  35 % from b46a + 0.5 over 0.6 s, the capsules lit within it, and stays so to the end fade **[D-01 fix: 213]**.

- **Group D's full-film fix round** **[F-01 fix: 237]**: the full doctor lines rise whole at ink-2 and
  each lights to ink on its first word (b46a: 'if hoarseness', 'more than', 'see a doctor', 'nose and',
  "If it's", 'or breathing', 'get help'), 0.3 s linear, staying lit; the stop line's second line waits
  at ink-2 for "feels" (b41). The band and Merc's line dim to 50 % from `at('b43','start',-0.4)` over
  0.4 s and come back to full from `at('b46a','end',0.06)`, 0.59 s before `recap` ("Nothing listens"
  stays at full; the last frame unchanged). The dimmed feel block is at 55 % (its capsule labels
  4.80:1; 50 % measured 4.23). The ring and its word draw in their own layer, the breath a scale of
  that layer about the ring's centre (centre and radius unchanged). S11: "usual notes suddenly gone"
  on `word('b37','have')`; "hurts or uncomfortable" settles (1.06) on `word('b37','singing')`.

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
  days. Missed a day? Just come back." as one line, Inter 30, ink-2, x 270 to 1100, baseline 820, its
  ink y 797 to 827 (13 px over the floor horizon, 20 px under the panel's last foot) (527.40) **[E-01 fix: 223]**.
  Since the fix round the card closes up 13 px under its glyph rows: the readout at baselines 523,
  560, 597; "Keep" 654; "Sore" 699; "Free" 752, its underline 764; the panel's feet 300, 360, 420,
  480, 617, 674, 719, 777 (`L.RECAP.VM`) **[E-01 fix: 223]**; "Voice Mirror" lands 0.4 s after the panel.
- **Rest card** (13g): panel x 1130 to 1690, y 250 to 600 (Merc's keep-out from y 628; Tavi's from
  x 1700); text from x 1160: "Felt uncomfortable, or listened" / "along today?" Outfit 500 28, ink-2,
  baselines 296 and 332 (528.01); "Rest today" serif italic 72, ink, 416 (530.59); "Voice Mirror
  will be here when" / "your voice feels comfortable:" Outfit 500 30, ink, 470 and 508 (531.46);
  "mercurypitch.com/mirror" Outfit 600 36, 566, underlined at y 576 (535.77).
- **The drift** (card): both cards and their lines move up 14 px together, 537.92 to 539.92,
  sine.inOut (whole-pixel steps are not allowed: draw at sub-pixel positions).

- **Group E's fix round** **[E-01 fix: 223]**: the recap's figure at k 0.9 (x 1300.5 to 1489.5, crown
  y 63, masked by 531) and its traces at 1.2 times (x 1136 to 1688, centres 170, 314, 458; names
  Outfit 30 right-aligned 1116) with their ILLUSTRATION chip (x 1417 to 1688, y 62 to 102), leaving
  with them before card 3's chip lands; the band at 20 % under cards 1 and 2, full for card 3. Card
  3's redraw from "settles" lasts min(2.4, the cascade - 0.5 - "settles"), so the answer holds
  0.5 s; the clean break's cascade starts at `break` + 0.2, the kicker, panel, answer and frame
  0.07 s apart, 0.3 s each, the recap gone before hop 1's apex. S14's rows and outlines fade in
  from its first frame over 0.6 s; the carried bead stays filled until its note lights it.

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
  Outfit 600 44, ink, centred, baseline 170 (its ink 27 px under "NEXT TIME"'s foot) **[E-01 fix: 223]** (546.23; leaves 550.05 to 550.35); the hook serif italic
  60, ink, centred, baselines 130 (550.50) and 200 (553.34).
- **The end card** (S15): the tease figure (beads, copy, "?") on `x' = 1210 + 0.45 (x - 400)`,
  `y' = 150 + 0.45 (y - 255)`, so in x 1210 to 1660, y 150 to 380; the lockup
  (`assets/brand/lockup-horizontal.svg`) at x 120, y 80 to 180, its width from its aspect (wipe
  556.15 to 556.65); the address Outfit 600 72, ink, x 120, baseline 320 (556.55); "Voice Mirror is
  free, with no account" Outfit 500 44, ink, x 120, baseline 395 (556.95). **Clear zone**: x 80 to
  1100, y 460 to 880, nothing drawn and no glow (YouTube's next-video element and Subscribe).
  F-end: the room and the tease figure ride a 3 % push about (960, 540); the type is frame-fixed.

- **Merc's root** **[234]**: `L.mercGate` reads the root on `L.passFrame(t, ds, ms, pf)`, the pass frame the
  renderer shows (F the render's fps, a 1e-3 frame margin); a preview reads what a 30 fps render shows.

## Framings

| Framing | s | ox | oy | About | Used | What it holds (screen px) |
| ------- | - | -- | -- | ----- | ---- | ------------------------- |
| F0 | 1 | 0 | 0 | - | most shots | the world as drawn |
| F-cold | 0.90 | 96 | 45 | screen (960, 450) | S1 from frame 0 | plot x 456 to 1464, Merc's line y 405, band 326.3 to 483.8, strip centre 666; "A3" right edge 425 (above Merc's box), "level" from x 456, baseline 745 (Merc's keep-out ends at x 361); right-of-plot labels from 1478 (Tavi's keep-out starts at x 1559, and only below y 551) |
| F-cold end | 0.92 | 76.8 | 36 | screen (960, 450) | 31.25 (the drift's end) | plot x 444.8 to 1475.2, line y 404 |
| F-hook | 0.7143 | 274.3 | 234.3 | - | 34.40 to 37.44 **[A-01: 171]** | Merc's line x 560 to 1360 at y 520: Lesson 4's last long note, its head bead at (560, 520), r 22; '"support"' baseline 420 and "what keeps it steady?" baseline 680 frame-fixed, as Lesson 4's S15 ('"support"' lands at baseline 406 at 32.87, mid-pull, its descenders 12 px over Merc's line, then eases down to 420 by 34.40 with the pull, sine.inOut **[v3: 9]**) |
| F-bead (new) | 2.2 | 80 | -340 | world (400, 400) to screen (960, 540) | 38.14 **[A-01: 171]** | the head bead at the frame's centre, its own layer r 1200, wider than the frame (the room's bead would be r 68), the field over it; the line, which ran from it off the right edge, gone as the disc defocused over it (replaces v1's F-line, 4.0x on the line's middle) |
| F-promise-a | 1 | 80 | 0 | - | 41.90 to 42.60 | plot x 480 to 1600; the bead lands at (480, 400) |
| F-promise-b | 1 | -80 | 0 | - | 53.40 to 54.00 | plot x 320 to 1440 |
| F-strip | 1.4 | -384 | -700 | - | 55.40 to 66.00 | the strip x 176 to 1744, y 182 to 350 (envelope 227 to 305); the band out of the top; swatches centred (512, 490), (960, 490), (1408, 490); their labels baseline 630 at 50 px. Moves: the world (mid layer) and the staves, dust and bokeh; not the hosts, and not the floor and its reflections, which stay at y 840, screen-space with the hosts (§ Shared formulas) **[v3: 6]** |
| F-gauge | 1.05 | -60 | -25.25 | world (1200, 505) | 140.25 to 178.83 | frame x 738 to 1662, y 279 to 731; figure x 331 to 585, head y 125 to 282; labels under the figure from x 213, baselines 815 and 855 (Merc's keep-out ends at 184). Moves: the world (mid layer) and the staves, dust and bokeh; not the hosts, and not the floor and its reflections, which stay at y 840, screen-space with the hosts (§ Shared formulas) **[v3: 6]** |
| F-hold (new) | 1.3 | -288 | 10 | world (960, 400) to screen (960, 530) | 304.90 to 324.60, 342.20 to 364.73 | § The hold chart: plot x 232 to 1688, band 484.5 to 575.5 at W 10; label rows 322 and 387; axis 690; bracket 712 |
| CU-scoop | 1.8 | -360 | -200 | world (400, 400) to screen (360, 520) | 326.10 to 331.90 | the first 1.5 s at x 360 to 662, the wave running right across the frame (to about 7.7 s at its right edge); the band y 457 to 583; "scoop" at (360, 700) **[kit-01: 9]** |
| CU-wave (new) | 1.8 | -840 | -200 | world (1000, 400) to screen (960, 520) | 333.90 to 340.74 | the held wave from x 888 to the edge, band y 457 to 583; the vibrato hairlines x 1124 to 1364 **[C-01 fix: 212]** |
| F-turn (new) | 1.4 | -472 | -190 | world (1180, 475) | 423.90 to 478.09 **[v3: 4]** | § The turn: frame x 928 to 1824, band 104 to 202; ring centre (1376, 610.8), r 190.4 **[D-01 fix: 213]**; labels at baselines 261, 317, 373 |
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
| 37.44-38.14 | through the head bead **[A-01: 171]** | F-hook | F-bead | log scale (the bead's progress) | the scale on the same log curve as the bead's radius, the bead's place eased to the centre with it; the field comes up over the last 0.25 s; does not return |
| 41.90 | cut | - | F-promise-a | - | |
| 42.60-53.40 | truck | F-promise-a | F-promise-b | power1.inOut | 160 px; content moves 14.8 px a second on average, more in the middle; carries on into the crane |
| 54.00-55.40 | crane down and push | F-promise-b | F-strip | power2.inOut | push-and-return 1; layers part vertically |
| 66.00-67.50 | crane up and pull | F-strip | F0 | power2.inOut | (1's return); the label row's text fades in as it lands (67.00 to 67.50) |
| 130.25-140.25 | push | F0 | F-gauge | steady (`L.steady(10)`: linear between 0.3 s smoothstep ramps) **[kit-01: 7]** | the cursor's own pace is the gauge's clock; the frame keeps moving through the whole 10 s, with no still stretch over 0.5 s at either end (sine.inOut held still for about 1.3 s at each end); returns by the matched cut at 178.83 |
| 303.40-304.90 | push | F0 | F-hold | power2.inOut | the stack left from dim at 303.10 to 303.40, never brought back to full; the chart fades in as the push starts, 303.40 to 304.00 **[v3: 5]**; returns by the matched cut at 364.73 |
| 324.60-326.10 | push | F-hold | CU-scoop | power2.inOut | push-and-return 2 |
| 331.90-333.90 | truck | CU-scoop | CU-wave | sine.inOut | 480 px on screen **[kit-01: 9]**; part of 2 |
| 340.74-342.20 | pull | CU-wave | F-hold | power2.inOut | (2's return) |
| 422.80-423.90 | push | F0 | F-turn | power2.inOut | the care block thinned and the phase row gone at 422.30 to 422.60; landed 0.14 s before `listen` (424.04) **[v3: 4]**; returns by the matched cut at 478.09 |
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
  baseline 98 (v2: 110) **[v3: 2]**. Merc (110, 840) and Tavi (1800, 840) at 300. The swatches gone
  (66.40).
- **S5 to S6 (106.28).** F0. The bare chart at 0.78 (plot x 466 to 1340, band 365.5 to 456.5 on
  screen; no line, no labels inside the plot), the slider at 50 (thumb (903, 723)) with "Push" and
  "50"; the label row's text and its "ILLUSTRATION" chip (x 1128 to 1340, centred y 208), which tags
  the toy and stays (v2 faded it at 105.80) **[v3: 3]**; the strip's resting envelope in ghost violet
  (y 615.4 to 659.0 on screen) and "level" at its left (right-aligned 439.5, baseline 645.8 on screen)
  **[B-01: 184]**; "LISTEN ONLY", Lesson 1's panels, the fork and the type gone (106.20). Hosts at 300
  in the corners. S6 fades the ghost envelope as the split begins (0.3 s), when the strip leaves for
  the gauge.
- **S6 to S7 (178.83), a matched cut.** S6 ends at F-gauge; S7 starts at F0. On the same screen
  pixels: the Loud gauge (frame x 738 to 1662, y 279 to 731; gold at world y 454; both hatches; the
  "ILLUSTRATION" chip inside its top right (screen x 1367 to 1652, y 290 to 332); the chips "Quiet"
  and "Loud", "Loud" lit, stacked outside its top right (screen x 1675 to 1783, y 290 to 332 and 344
  to 386); "the lungs' own push"; "what the note needs" above the gold line's right end (world
  right-aligned 1630, baseline 440; screen right edge 1652, baseline 437); "less holding back at
  first" under the frame's left end (world (760, 765); screen from x 738, baseline 778) with its
  leader; "more adding as the air runs low") **[v3: 1, 3, 9]**; the small band with Merc's line whole
  (x 738 to 1662, y 143 to 227); the figure's torso at rest (`k` 1.2075, `x0` 150, `y0` 100.75 on
  screen; its legs masked from world y 741.25 to 772.75 at F-gauge **[B-01: 188]**); "push of air (not
  pitch)" and "the lungs' own push" at their B-01 places with trimmed plates **[B-01: 182]**. No cursor,
  no readout. Only the room changes: it crossfades from F-gauge's layers to rest over 0.3 s (`L.roomCut`: the
  incoming scene draws the room at the outgoing framing, at rest, fading out over its own room at F0,
  so the room never snaps; the carried object holds its pixels throughout) **[kit-01: 6]**. Hosts at 240 at
  (100, 840) and (1820, 840).
- **S7 to S8 (216.35, group B to C).** F0. The dimmed figure at its parked place (`k` 0.5, `x0` 140,
  `y0` 180, 35 %); every row and miniature of the card gone (216.25); hosts at 240.
- **S8 to S9 (237.37).** F0. The whole figure at S8's placement with its cue labels; hosts at 240.
- **S9 to S10 (300.98).** F0. The stack, its names, circles, "the easy start" and "the h, only in
  your mind", its two chips ("ILLUSTRATION" centred y 150, right-aligned 1600; "LISTEN ONLY" under
  "A catch", right-aligned 660, centred y about 495 **[C-01: 195]**) **[v3: 3]**, the folds small; hosts at 240. S10 dims them all at 301.13 and
  they leave from dim at 303.10 to 303.40 **[v3: 5]**.
- **S10 to S11 (364.73, group C to D), a matched cut.** S10 ends at F-hold; S11 starts at F0. The
  empty hold frame on the same screen pixels: x 1000 to 1640, band 210 to 280, Merc's line y 245,
  no labels; the voice box, the slider, the line and the type gone (364.60). Only the room changes,
  crossfading from F-hold's layers to rest over 0.3 s (`L.roomCut`) **[kit-01: 6]**.
  Hosts at 300 in the corners.
- **S11 to S12 (402.58).** F0. The care block from "Your turn." to the listening line, the doctor
  lines small; the frame with its bracket, "0", "10 s" and "Nothing listens"; the ring at 35 %, no
  counter; hosts at 300.
- **S12 to S13 (478.09, group D to E), a matched cut.** S12 ends at F-turn; S13 starts at F0. The
  frame's band and Merc's line on the same screen pixels: x 928 to 1824, band 104 to 202, line 153,
  no labels (gone by 477.60). Only the room changes, crossfading from F-turn's layers to rest over
  0.3 s (`L.roomCut`) **[kit-01: 6]**. Hosts at 300 in the corners.
- **S13 to S14 (540.47).** The bead in flight on one curve both scenes compute from film time: from
  the "five notes" glyph's first dot (272, 434 after the drift) at 539.70, growing from r 4 to r 20,
  to the C4 place (420, 745) at 541.30 (power2.inOut), a cubic through (300, 560) and (380, 680),
  drawn from film time; its whole path left of x 450. Merc standing at (1290, 840) since 510.05
  (on the scratch clock, since hop 2 lands in the `break` beat before b55, DECISIONS 190);
  Tavi at (1800, 840). The cards' lines gone by 540.30.
- **S14 to S15 (556.01).** The tease figure in flight on its shrink (555.70 to 556.90, power2.inOut)
  from the S14 layout to the end card's box (above), computed from film time on both sides; the
  rows fading (555.70 to 556.10); the hook gone (555.95); Merc (1290, 840) and Tavi (1800, 840) at
  300, both beginning their moves at 556.05.

## Provisional values (each confirmed in a lab still, then unmarked)

Confirmed by group C (DECISIONS 191): the folds' growth from the throat (9b: a ring r 20 at 0.5
from (1005, 273), growing over 0.5 s (0.9 s before **[C-01: 196]**), sliding from + 0.4 s over 1.0 s to (390, 430) at 1, landing
in x 220 to 560, y 260 to 600; since the fix round shown at 1.35 about (390, 430): x 160.5 to 619.5, y 200.5
to 659.5, its label centred 390, baseline 694 **[C-01 fix: 212]**); the "settled" flag by the page's rule (stays within 35 c for 0.5 s)
at its own 16 ms readings: entry 0.704 s into the take, the flag at 1.204 s, world x 478.8.
Confirmed by group D (DECISIONS 202): Merc's arc reach beside the care block, x 229.3 at most on
every frame of m-blue-s12, so the block at x 260 keeps 30.7 px.

Confirmed by group E (DECISIONS 214): the "settled" flag in card 3 by the same rule, entry 0.704 s,
x 334.5 (y 538.5 to 554.5, no label), at the line's 1.204 s; the hop height is the pass's, the sole
rising 22 px in the film (20 px on the pass frames).

Still provisional: the bead's flight S2 to S3; the chart's split from 0.78 (6b) and the strip's
opening (6e); the together start's onset (sound round). Since v3 the
split's curve carries one constraint (the band passes 12 px or more above the gauge's
"ILLUSTRATION" chip), and every v3 clearance that rests on a type width is an estimate until the
lab still measures it (LAB-CHECKS.md) **[v3: 3, 9]**.
