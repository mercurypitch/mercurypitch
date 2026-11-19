# Handoffs v1: exact frames where one scene meets the next

The last frame of scene N and the first frame of scene N+1 show every carried object on the same
pixels (within 2 px). Values marked **(provisional)** are starting values the builders on either
side confirm in a lab still; this file is then updated and the mark removed before either scene is
built further. Unmarked values follow from the formulas below and are fixed now. Times are the
board clock's (STORYBOARD, header): orientation only, since every scene computes its times from
cues and words.

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
- **World or frame.** A label that names a part of a drawing is a world label (mid layer): it
  rides every move and scales with it, so its size is given in world px. Kickers, chapter cards,
  pills, ring timers, the four words, the recap panel, the practise cards, the care block and the
  hook's type are frame-fixed (`hud`) and never move with the camera.
- **Hosts** are in screen space (`room.top`). A host's body box is about 0.53 of the shown size wide
  and 0.64 of it tall, standing on its feet point: at 240 it is x ±64, 154 tall; at 300 ±80, 192; at
  360 ±95, 230; at 400 ±106, 256; at 420 ±111, 269.

  | Place | Merc feet, size | Merc body | Tavi feet, size | Tavi body |
  | ----- | --------------- | --------- | --------------- | --------- |
  | Cold (S1) | (230, 840), 420 | x 119-341, y 571-840 | (1690, 840), 420 | x 1579-1801 |
  | Corners | (110, 840), 300 | x 30-190, y 648-840 | (1800, 840), 300 | x 1720-1880 |
  | Small (S6 to S9) | (100, 840), 240 | x 36-164, y 686-840 | (1820, 840), 240 | x 1756-1884 |
  | Tease (S14) | (1290, 840), 300 | x 1210-1370, y 648-840 | (1800, 840), 300 | x 1720-1880 |
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
  through its 0.42 s in the air (power1.in). The only exits are S1h's slides, 360 px outward over
  37.30 to 37.90 (power2.in).
- **Text and marks** fade in over 0.2 s from their word and out over 0.2 s unless a row says
  otherwise; "up fast" is 0.3 s, power3.in, rising 16 px. Counted pulses as STORYBOARD § Type, each
  about its label's left baseline. Ring timers, pills, arrows and capsules are Lesson 4's
  `assets/lib/marks.js` (`L.ringTimer`, `L.pill`, `L.arrow`); Tavi's guesses `L.GUESS` (dashed
  ink-2, 3 px, dash 10, gap 8).
- **Captions.** Everything essential above y 896; the care block above y 864.

## World (F0, `s = 1`)

### The band chart

- **Plot**: x 400 to 1520. Time: `x(t) = 400 + 1120 t / W`, with `W` = 4 s (S1: the takes), 6 s
  (S5: the Push note), 10 s (S10 on: the hold). Pitch: `y(c) = 400 - 2.5 c` (c in cents from the
  band's A; Tavi's A4 folds onto it, "A, any octave"). So Merc's line is y 400, the band 312.5 to
  487.5 (±35 c), +74 c y 215, -60 c y 550.
- **Band**: amber `#f59e0b` fill 12 %, top and bottom edges 2 px at 45 %; lit edges mint `#80ffca`
  3 px with a 6 px glow at 40 %, lit while a voice's centre is within ±35 c. **Merc's line**: 4 px
  amber, x 400 to 1520, y 400, a 10 px glow at 20 %.
- **A voice's line**: violet `#a78bfa`, 4 px, round, drawn from the contour of FACTS 80 *with* its
  wave (5.5 Hz, ±14 c, grown in over 0.35 s, phase 0 at the vibrato's start), so `y = y(c(t))`; its
  head a violet dot r 7 with a 14 px glow while it draws. A ghosted line is 35 % violet.
- **Level strip**: centre y 690, x 400 to 1520; envelope half-height `h = 28 × 10^(dB / 20)` (0 dB
  28 px, +6 dB 55.9 px); fill violet 28 %, edges 2 px violet at 70 %; a hairline at y 690, ink 10 %,
  when empty. Ghosted: outline only, 35 %.
- **Labels** (world px): "A3" Outfit 600 48, ink, right-aligned x 366, baseline 417 (S10 on: "A,
  any octave", Outfit 600 36, same place); "in the band" Outfit 600 30, ink, right-aligned 366,
  baseline 470, shown only with the mint edge; "level" Outfit 600 32, ink-2, left-aligned x 400, baseline
  778, under the strip's left end (left of the plot it would meet Merc's keep-out at F-cold). **Label row**, baseline 150: its text Outfit 500 34, ink, from x 400 ("in the band:
  within 35 cents (Lesson 3)" in S1 and S5; S5's definition; S10's "steady: settles into the band
  and stays"); chips (JetBrains Mono 500 26, tracking .18em, ink-2, in a chrome 25 % pill 40 high,
  centred y 140): "ILLUSTRATION" right-aligned to x 1520, "LISTEN ONLY" right-aligned to x 1300.
- **Right of the plot** (left-aligned x 1536): "?" Outfit 600 64, ink-2, baseline 423; "sung easily"
  Outfit 600 36, ink, baseline 470; "above the band" Outfit 600 36, ink, baseline 262. Inside the
  plot, top left: "louder · higher" Outfit 600 56, ink, x 420, baseline 268; S5's "also: a little
  higher" Outfit 600 36 x 420 baseline 280 and "mainly: louder" x 420 baseline 600, each with a 3 px
  chrome arrow (30 px) to the band's top edge and to the strip. Under the strip: the small type
  "Both lines are drawings of that rule, not recordings." Inter 34, ink-2, right-aligned x 1520,
  baseline 812.
- **Tavi's straight guess**: `L.GUESS` along y 400 from x 540 (t 0.5 s at W 4) to 1520 in S1, from
  400 to 1520 in S10; its "?" as above. Merc's line dims to 50 % under it.
- **Push slider** (S5): track x 400 to 1520, y 800, 4 px chrome at 50 %; `x(p) = 400 + 11.2 p`, the
  thumb a chrome disc r 16 at `x(p)`, its value Outfit 600 30 tabular, ink, centred over it,
  baseline 776; "Push" Outfit 600 32, ink, right-aligned x 366, baseline 811 (Merc's keep-out at 300 ends at
  x 210). The thumb follows FACTS
  80's Push curve exactly (50 to 0.6 s, linear to 100 by 2.1 s, held to 3.6 s, linear to 50 by
  4.8 s, held to 5.6 s), so line, strip and thumb are one function of `t`. The push plan (5d):
  chrome 40 % arrows on y 770 from 960 to 1520 and back, a 4 px hold bar at 1520.
- **Pills** (S1, frame-fixed): Outfit 600 34 in chrome-stroked capsules 52 high centred y 112 (as
  shown at F-cold): "Settle, steadier than before" x 470 to 930, "Get louder and drift higher" x
  970 to 1430; the ring timer at (1480, 112), r 18; the check an ink SVG mark at the capsule's left.
- **The swatches** (S4): three envelopes 160 wide centred at x 640, 960 and 1280, y 850, half-heights
  10, 28 and 56, chrome outline 2 px at 50 %; labels Outfit 600 36, ink-2 (lit: ink), centred,
  baseline 950; the hairline from the middle swatch's top (960, 822) to the strip's foot (960, 718).
- **Lesson 1's figure** (S5f): two panels 240 x 260 at x 1640 to 1880 and 1900 to 2140, y 220 to 480,
  Lesson 1's LOUDER and HIGHER drawings at 0.6; "loud ≠ high" Outfit 600 48 ink centred x 1890,
  baseline 190. The fork (5g): ink 3 px from the thumb (960, 800) up to (1100, 600), branching to
  (1260, 700) "louder" and (1260, 300) "higher" (Outfit 600 40, ink, left of each end +16 px).
- **S1's arrow** (1f): ink 3 px from the pushed line's last in-band centre point (t 2.75 s, x 1170)
  to its end (1520, 250), curving above the line, 20 px clear of it.

### The breath figure

Drawn in figure units `(u, v)`: u 0 to 400 back to front (it faces right), v 0 (crown) to 1000
(soles), placed by `x = x0 + k u`, `y = y0 + k v`. Chrome strokes 3 px (at k 1), joins round.

| Part | Figure units (at rest) | Breathing in |
| ---- | ---------------------- | ------------ |
| Head | circle (230, 85), r 65; jaw (200, 130) to chin (285, 140) | - |
| Neck, throat | lines u 200 and 250, v 150 to 215; throat point (250, 190) | - |
| Shoulder | (175, 235) | does not move (S8) |
| Torso | back u 150, v 230 to 560; chest front u 320, v 230 to 400; belly wall u 330, v 420 to 560 | belly bows to u 360 at v 490 |
| Ribs | arcs at v 290, 340, 390, u 160 to 320 | - |
| Lungs | ellipse (240, 335), rx 75, ry 105 | ry 118, centre (240, 345) |
| Dome | quadratic (155, 470), control (240, 400), (325, 470) | control (240, 470), ends at v 485 |
| Legs | knee (235, 780), ankle (220, 980), toe (300, 1000) | - |

- **S6 (torso)**: `k` 1.15, `x0` 200, `y0` 60: head (464, 158), throat (488, 279), lungs centre
  (476, 445), dome apex (476, 560), dome ends (378, 600) and (574, 600), hips y 704; the legs
  masked out from y 690 to 720 (a soft fade). Labels: "lungs" right-aligned x 350, baseline 440;
  "diaphragm" right-aligned 350, baseline 575, a 1.5 px chrome leader to (378, 600); "belly" x 640,
  baseline 640; "breathing in" right-aligned 350, baseline 655; "can't push air out" right-aligned
  350, baseline 500. Under the figure (x 260): "with your breathing muscles," baseline 770 and "never
  your throat" 808; "belly and rib muscles" 770. Guess arrow: `L.GUESS` from (476, 560) to (476,
  400), arrowhead 14 px, its "?" at x 500, baseline 400; the struck arrow the same path, chrome 3 px,
  its strike ink 3 px from (446, 500) to (506, 460).
- **S8 (whole)**: `k` 0.7, `x0` 830, `y0` 140: head (991, 200), chin (1030, 238), throat (1005, 273),
  shoulder (953, 305), lungs (998, 375), dome apex (998, 445), belly front x 1061, knee (995, 686),
  soles y 840 (on the floor line). Cue labels Outfit 600 36, ink, each with a 1.5 px chrome leader:
  "tall but easy" right-aligned 900, baseline 200 (its arrow up the back at x 925 from y 830 to
  150); "shoulders still" right-aligned 910, baseline 300 (a 40 px level mark at y 290 over the
  shoulder); "breathe in quietly, low" right-aligned 910, baseline 400; "knees unlocked"
  right-aligned 950, baseline 700; "jaw · tongue · neck loose" x 1070, baseline 245; "diaphragm at
  work" x 1110, baseline 470; "as much as feels easy" x 1110, baseline 560; "Singers breathe in" /
  "different ways." serif italic 48, x 1110, baselines 720 and 770.
- **S13 (recap card 1)**: `k` 0.9, `x0` 1110, `y0` 130, legs masked from y 630.

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
- **Labels**: "push of air (not pitch)" Outfit 600 30, ink, x 790, baseline 275, after a 12 x 24 px
  up arrow at x 768; "one 10-second note" Outfit 500 30, ink-2, x 760, baseline 760; "the lungs' own
  push" Outfit 600 30, ink, x 776, baseline 325; "what the note needs" Outfit 600 30, ink,
  right-aligned 1630, baseline 596 (Quiet) or 444 (Loud); "held back" Outfit 600 34, centred x 860,
  baseline 540; "added" Outfit 600 30, centred x 1508, baseline 760, a 1.5 px leader up to
  (1508, 690); the readout "Now: holding back" / "Now: adding" Outfit 600 34, ink, right-aligned
  1640, baseline 275; Loud's "less holding back at first" x 760, baseline 765, and "more adding as
  the air runs low" right-aligned 1640, baseline 805, each with a leader into its region; chips
  "Quiet" and "Loud" right-aligned to 1640, centred y 266 (the readout's place, after it leaves).
- **Predict** (frame-fixed): "PREDICT" mono 26, ink-2, x 760, baseline 115; capsules "Push it out"
  x 920 to 1150 and "Hold it back" x 1180 to 1420, 48 high, centred y 105; ring timer (1470, 105).
- **The split (6b)** **(provisional: the lab decides the curves)**: the band and Merc's line map
  from the plot (x 400 to 1520, y 312.5 to 487.5) to the small band (x 760 to 1640, y 160 to 240);
  the strip from (400 to 1520, centre 690) to (760 to 1640, centre 690); one move, 110.90 to 112.40,
  power2.inOut. The opening (6e) grows the strip's box to the frame's box, 127.95 to 129.35.

### The mix-up card (S7, frame-fixed)

Left column from x 220: "COMMON MIX-UP" mono 26 ink-2 baseline 160; the belief Outfit 600 44 ink
baseline 222, its dashed underline at y 236, its "?" at x 1140; row 1 Outfit 600 40 baseline 320;
row 2 baseline 450; row 3 baselines 560 and 605; "The better idea:" Outfit 600 30 ink-2 baseline
690; its phrases Outfit 600 40, baselines 740 ("steady air, not more of it · breathe in low") and
790 ("start easily · let it flow out unforced"). Right column: the miniature band x 1180 to 1640,
y 300 to 360 (line 330; the pushed line climbs to y 280; its strip at y 382, half-height 6 to 12);
the two strips under one chrome arrow (x 1180 to 1300, y 470): "easy" x 1320 to 1460 centre 470
half-height 40, "pressed" x 1500 to 1640 half-height 10, names Outfit 600 30 centred, baseline 545;
"same push: much quieter" Outfit 600 30 x 1180, baseline 600.

### The folds and the traces (S9)

- **Folds** (from above), centred (390, 430) in a 340 px box: two chrome folds 8 px from the front
  apex (390, 300) to their back ends; apart (330, 560) and (450, 560); slit (378, 560) and (402,
  560); pressed shut (388, 560) and (392, 560) at 12 px; a rounded outline round them, chrome 30 %;
  vibration ±3 px across the gap at 18 Hz drawn time (not the voice's). "vocal folds, from above"
  Outfit 500 28 ink-2, x 220, baseline 650. They grow at 240.00 from the figure's throat (1005, 273).
- **Trace strip**: x 700 to 1600 (`x(t) = 700 + 562.5 t`, 1.6 s), centre y 430, a stylised wave of
  22 px a cycle whose half-height is the level (up to 110; it is the level, not the pitch); fine
  dots (r 1.5, chrome 70 %, seeded) for air; the catch's mark ink 4 px, y 320 to 540; the gold tick
  4 x 40 at the together start's onset on y 430. Title Outfit 600 44 x 700, baseline 280, "LISTEN
  ONLY" after it +24 px; "ILLUSTRATION" right-aligned 1600, centred y 270; chips "Air first", "A
  catch", "Together" capsules centred y 680 from x 700, 920, 1140; mark labels Outfit 600 30, ink,
  baseline 580 ("air, no note" from x 700; "the catch" from x 786).
- **Stack** (F0 coordinates, shown at F-stack): rows centred y 250, 450, 650, half-height 70, x 700
  to 1600; labels Outfit 600 36 right-aligned 670, baselines 262, 462, 662; "the puff" x 720
  baseline 165, "the click" x 800 baseline 368, "neither" x 720 baseline 568; "the easy start"
  Outfit 600 40 x 1000 baseline 568; the "h" serif italic 120 ink-2 at 40 % centred (760, 690);
  "the h, only in your mind" Outfit 500 30 x 720 baseline 770; the folds small in x 160 to 330,
  y 110 to 280.
- **Onsets** within each start (FACTS 80): air first's noise from 0, its tone from 0.25 s; the
  catch's click at 0.15 s; together's tone at the sound's own onset as the mixer's stem puts it,
  measured in the sound round **(provisional)**.

### The hold frame at the right half (S10h to S13)

`x' = 1000 + 0.5714 (x - 400)`, `y' = 245 + 0.5714 (y - 400)`: plot x 1000 to 1640, band 195 to
295, Merc's line y 245. Its labels are set again at legible sizes, not scaled: "A, any octave"
Outfit 600 30 right-aligned 985, baseline 255; "ILLUSTRATION" right-aligned 1640, centred y 160;
"in the band" (13d) Outfit 600 26 right-aligned 985, baseline 290. 10h's slider: track x 1000 to
1640, y 400, thumb r 14, value baseline 378, "Push" right-aligned 985, baseline 410; its demo line
follows FACTS 73's rule (+1.2 c a step, so 75 is +30 c, 43 px up here). The voice box (10h): a
rounded outline x 300 to 640, y 190 to 510, radius 60; the folds at 0.8 centred (470, 350); muscle
bands chrome 6 px at x 380 and 560, y 280 to 420; "voice box" Outfit 600 32 x 300 baseline 170;
"muscles here set the note" Outfit 600 36 x 260 baseline 570; "a steady note needs steady air too"
and "a change in the air moves it" Outfit 600 40 x 260, baselines 680 and 740.

### The turn (S11, S12; frame-fixed, screen px)

- **Care block**, left-aligned x 260, every line within x 260 to 960, nothing below y 864 (the
  care icon's top-left at (260, 236), 36 px, the app's SVG): "Your turn." serif italic 110, ink,
  baseline 200; the comfort line Outfit 700 36, ink, x 310, baselines 262 ("Sore, hoarse or unwell
  today?") and 306 ("Just listen along."); the reasons Outfit 500 30, ink, baselines 352 ("hurts or
  uncomfortable · unusually hoarse or tired"), 390 ("usual notes suddenly gone · ill") and 428
  ("talking or singing is hard work"); "listening along: rest your voice and watch the ring"
  Outfit 500 30, ink, baseline 486; the stop line Outfit 600 36, ink, baselines 548 ("Stop
  immediately if anything") and 590 ("feels uncomfortable."); the doctor lines, small, Inter 30,
  ink-2, five lines at baselines 650, 688, 726, 764 and 802, broken where the font puts them within
  700 px, word for word with their parentheses. Full size (12h): Inter 40, ink, six lines at
  baselines 330, 380, 430, 480, 530 and 580, within 700 px; the change is a cross-fade, the new
  lines rising 12 px into place (460.00 to 460.80). Merc's body ends at x 190 and his talking arcs
  reach about x 225 (to be measured on m-blue at 300: **provisional**), so x 260 keeps 35 px.
- **The frame** at the right half (above); its bracket 2 px chrome at y 312, x 1000 to 1640; "10 s"
  Outfit 600 30 ink-2 right-aligned 1640, baseline 345; "A3 · Merc" Outfit 600 30, ink, x 1000,
  baseline 345, a blue dot r 6 at its left; "A4 · Tavi, an octave up" x 1180, an orange dot;
  "Nothing listens" Outfit 600 30, ink, x 1000, baseline 390. The playhead 3 px chrome, y 195 to
  295, `x = 1000 + 64 t` over the hold.
- **The ring**: centre (1320, 570), radius 130, stroke 10; its track chrome 35 %, its arc chrome
  100 % with a soft glow, clockwise from 12 o'clock, `angle = 36 t` degrees over the hold (even:
  the arc is a clock); the 12 o'clock tick 4 x 24. "Breathe in, low and quiet" Outfit 600 30, ink,
  centred x 1320, baseline 425; the counter Outfit 600 80 tabular, ink, centred, baseline 598;
  "Listen · Breathe · Sing" mono 28, centred, baseline 750; "at about speaking volume" Outfit 500 30,
  ink, centred, baseline 795; "stop sooner if you need to" baseline 838. The breath: scale 1 to 1.08
  and back about the centre, 426.10 to 428.10.
- **Feel**: "How did that feel?" serif italic 64, ink, x 1000, baseline 480; a ring timer at (1660,
  458), r 16; capsules x 1000 to 1230, 44 high, centred y 540, 596, 652, 708 (Outfit 600 30); lines
  Outfit 500 30, ink, x 1260: "rest a few easy breaths" baseline 579 (a 2 px chrome bracket from
  the first two capsules at x 1240), "rest before you sing again" 663, "enough singing for today"
  719.

### Recap and practise (S13; frame-fixed)

- **Panel** x 120 to 960, y 140 to 330 (radius 16, chrome 25 % stroke, obsidian fill 85 %); its
  question Outfit 600 40, ink, x 150, baselines 220 and 280; its ring timer at (910, 250). Answers
  serif italic, ink, x 150: one line 64 px at baseline 420; two lines 56 px at 420 and 486. The panel
  never shows empty: it leaves with one card's lines and comes back with the next's.
- **Card 2's traces**: x 1180 to 1640 (`x(t) = 1180 + 287.5 t`), centres y 330, 450, 570,
  half-height 45; labels Outfit 600 30 right-aligned 1160.
- **Card 3**: the hold frame at the right half; Tavi's line redrawn from FACTS 80 at 4.17 times its
  speed (504.93 to 507.33).
- **Voice Mirror card**: panel x 230 to 1110, y 90 to 770 (chrome 25 %); text from x 270: "Practise
  it." Outfit 600 40, ink, baseline 150; "Voice Mirror" serif italic 96, ink, baseline 250, a 2 px
  chrome rule at y 272 from 270 to 1070; tasks Outfit 600 34, ink, each after a 40 px chrome glyph:
  row 1 baseline 345, "glide up" (glyph x 270, word x 320) and "glide down" (glyph 540, word 590);
  row 2 baseline 405, "a six-second hold" (glyph 270, word 320) and "five notes" (glyph 670 to 710:
  five dots r 4 at x 672, 681, 690, 699, 708, y 393; word 720); the readout Inter 32, ink, baselines
  480, 520, 560; "Keep the glides comfortable." Outfit 500 34, baseline 630; "Sore, hoarse or unwell
  today? Just listen along." 674; "Free, no account: mercurypitch.com/mirror" Outfit 600 40, 740,
  the address underlined at y 752; under the card, "Ten minutes, gently, most days. Missed a day?
  Just come back." Inter 34, ink-2, x 270, baseline 820.
- **Rest card**: panel x 1150 to 1690, y 290 to 650; text from x 1180: the condition Outfit 500 28,
  ink-2, baseline 340; "Rest today" serif italic 72, ink, 430; "Voice Mirror will be here when your"
  / "voice feels comfortable:" Outfit 500 32, ink, 500 and 540; "mercurypitch.com/mirror" Outfit 600
  36, 610, underlined at y 620. Its right edge keeps 30 px from Tavi's box.
- **The drift** (card): both cards and their lines move up 14 px together, 537.92 to 539.92,
  sine.inOut (whole-pixel steps are not allowed: draw at sub-pixel positions).

### The tease and the end card

- **Rows** (S14): semitone row k (C4 = 0 to D♯5 = 15) centred `y = 745 - 30 k`, 30 px bands, x 340
  to 1500; black-key rows ink 6 %, the others ink 2.5 %, lines ink 6 %; masked round each host.
- **Beads** r 20 at `x = 420 + 160 i`: C4 (420, 745), C4 (580, 745), G4 (740, 535), G4 (900, 535),
  A4 (1060, 475), A4 (1220, 475), G4 (1380, 535). Chrome outline 2 px until lit; lit blue `#58a6ff`
  with an echo ring at each onset (0.5 s apart from `twinkle`'s start, the last held 1.0 s). The
  copy, six rows up (y - 180): `L.GUESS` outlines at (420, 565), (580, 565), (740, 355), (900,
  355), (1060, 295), (1220, 295), (1380, 355); its "?" Outfit 600 64, ink-2, x 1430, baseline 375;
  the rising arrows 1.5 px chrome at 40 % from each bead's top to its copy's bottom. The tease line
  Outfit 600 44, ink, centred, baseline 150; the hook serif italic 60, ink, centred, baselines 130
  and 200.
- **The end card** (S15): the tease figure (beads, copy, "?") on `x' = 1210 + 0.45 (x - 400)`,
  `y' = 150 + 0.45 (y - 255)`, so in x 1210 to 1660, y 150 to 380; the lockup
  (`assets/brand/lockup-horizontal.svg`) at x 120, y 80 to 180, its width from its aspect; the
  address Outfit 600 72, ink, x 120, baseline 320; "Voice Mirror is free, with no account" Outfit
  500 44, ink, x 120, baseline 395. **Clear zone**: x 80 to 1100, y 460 to 880, nothing drawn and no
  glow (YouTube's next-video element and Subscribe). F-end: the room and the tease figure ride a 3 %
  push about (960, 540); the type is frame-fixed.

## Framings

| Framing | s | ox | oy | About | Used | What it holds (screen px) |
| ------- | - | -- | -- | ----- | ---- | ------------------------- |
| F0 | 1 | 0 | 0 | - | most shots | the world as drawn |
| F-cold | 0.90 | 96 | 45 | screen (960, 450) | S1 from frame 0 | plot x 456 to 1464, Merc's line y 405, band 326.3 to 483.8, strip centre 666; "A3" right edge 425 (above Merc's box), "level" from x 456, baseline 745 (Merc's keep-out ends at x 361); right-of-plot labels from 1478 (Tavi's keep-out starts at x 1559, and only below y 551) |
| F-cold end | 0.92 | 76.8 | 36 | screen (960, 450) | 31.25 (the drift's end) | plot x 444.8 to 1475.2, line y 404 |
| F-hook | 0.7143 | 274.3 | 234.3 | - | 34.40 to 37.50 | Merc's line x 560 to 1360 at y 520: Lesson 4's last long note; '"support"' baseline 420 and "what keeps it steady?" baseline 680 frame-fixed, as Lesson 4's S15 |
| F-line | 4.0 | -2880 | -1080 | world (960, 400) to screen (960, 520) | 38.05 | inside the line's light: the full-frame field |
| F-promise-a | 1 | 80 | 0 | - | 41.90 to 42.60 | plot x 480 to 1600; the bead lands at (480, 400) |
| F-promise-b | 1 | -80 | 0 | - | 53.40 to 54.00 | plot x 320 to 1440 |
| F-strip | 1.4 | -384 | -700 | - | 55.40 to 66.00 | the strip x 176 to 1744, y 182 to 350 (envelope 227 to 305); the band out of the top; swatches centred (512, 490), (960, 490), (1408, 490); their labels baseline 630 at 50 px |
| F-wide | 0.78 | 154 | 99 | - | 98.50 to 109.90 | plot x 466 to 1340; Lesson 1's panels x 1433 to 1823, y 271 to 473; the slider's thumb at (903, 723) |
| F-gauge | 1.05 | -60 | -25.25 | world (1200, 505) | 140.25 to 179.00 | frame x 738 to 1662, y 279 to 731; figure x 331 to 585; labels under the figure from x 213 (Merc's keep-out ends at 184) |
| F-chest | 1.4 | -399.2 | -168 | world (998, 420) | 230.50 to 234.30 | head (988, 112), lungs (998, 357), dome (998, 455); the legs below the frame |
| F-stack | 0.92 | 76.8 | 36 | screen (960, 450) | 276.70 to 303.40 | rows x 721 to 1549, centres y 266, 450, 634 |
| CU-scoop | 1.8 | 60 | -252 | world (500, 440) | 326.10 to 331.90 | the first 1.5 s at x 780 to 1082; the band y 310.5 to 625.5 (Tavi's keep-out from y 628); "scoop" at (816, 828) |
| F-end | 1.03 | -28.8 | -16.2 | world (960, 540) | 562.01 | the room and the tease figure 3 % closer |

## Camera moves

Each changes framing on one curve (`s`, `ox`, `oy` together); every move is a push, pull, truck or
crane, so the layers part. Outside these the camera is still.

| Time | Move | From | To | Ease | Notes |
| ---- | ---- | ---- | -- | ---- | ----- |
| 0.00-31.25 | drift | F-cold | F-cold end | power1.inOut | not counted as motion; the hosts and the lines carry the open |
| 31.40-34.40 | pull | F-cold end | F-hook | sine.inOut | the chart's marks leave over it (31.30 to 33.00) |
| 37.50-38.05 | through the line's light | F-hook | F-line | power3.in | from 37.60 the line's glow grows and defocuses to the field; amber cools to chrome |
| 41.90 | cut | - | F-promise-a | - | |
| 42.60-53.40 | truck | F-promise-a | F-promise-b | power1.inOut | 160 px; content moves 14.8 px a second on average, more in the middle |
| 54.00-55.40 | crane down and push | F-promise-b | F-strip | power2.inOut | layers part vertically: the staves rise slower than the strip, the bokeh faster |
| 66.00-67.50 | crane up and pull | F-strip | F0 | power2.inOut | the label row's text fades in as it lands (67.00 to 67.50) |
| 97.30-98.50 | pull | F0 | F-wide | power2.inOut | |
| 108.70-109.90 | push | F-wide | F0 | power2.inOut | |
| 130.25-140.25 | push | F0 | F-gauge | sine.inOut | the cursor's own pace is the gauge's clock; the push is the lead move |
| 179.00-180.40 | pull | F-gauge | F0 | power2.inOut | |
| 229.10-230.50 | push | F0 | F-chest | power2.inOut | "knees unlocked" left at 228.90 to 229.10 |
| 234.30-235.70 | pull | F-chest | F0 | power2.inOut | |
| 275.50-276.70 | pull | F0 | F-stack | power2.inOut | |
| 303.40-304.60 | push | F-stack | F0 | power2.inOut | the stack left at 303.35 to 303.65 |
| 324.60-326.10 | push | F0 | CU-scoop | power2.inOut | |
| 331.90-333.10 | pull | CU-scoop | F0 | power2.inOut | |
| 556.01-562.01 | push | F0 | F-end | sine.inOut | |

## Carried from Lessons 1, 2 and 4 (fixed)

- **The room**: Lesson 4's (`$S/l4film/assets/lib`, its `lesson.js` room, staves, dust and bokeh),
  seeded as there; `L.frameRig` and `L.mercGate` from its `frames.js` and `hosts.js`.
- **Chapter cards**: `L.chapterCard(hud, { num, title, baseline: 480, tIn, tOut })`; "Sing it" with
  no numeral.
- **Title (S2)**: Lesson 4's `s02-title` with "Breath and a steady note" (chrome serif italic 140
  px, one line, centred, baseline 380), kicker "LESSON 05"; its staff (bottom line y 696, 28 px
  apart), the bead's rest (1060, 640) on the middle line, the 4 % zoom, the five chimes' notes at
  x 560, 760, 960, 1160, 1360; only the bead's flight changes (S2 to S3, below).
- **End card (S15)**: Lesson 4's `s16-end` wipe and timing pattern, this film's layout (above).

## The cuts

- **S1 to S2 (38.30).** The same full-frame field on both sides: chrome `#c3ccd6` at 75 % over the
  ground at the frame's centre falling to 35 % at the corners, no edges, mean luma 110 to 125 of
  255, breathing 2 % from film time (Lesson 4's `fieldDisc`). No hosts, no type.
- **S2 to S3 (41.90).** The bead in flight on one curve both scenes compute from film time: lifting
  off its rest at 41.02 (`title` + 2.72), a cubic from the rest (z-mapped) through (1060, 300) and
  (620, 320) to (480, 400), sine.out, landing at 42.02 and shrinking from r 22 to the line's 4 px
  head over its last 0.3 s, turning amber as it lands **(provisional: the lab confirms it clears the
  fading staff and "A3")**. At 41.90 the chart is at F-promise-a fading up (band, "A3", strip
  hairline, "level"; Merc's line not yet drawn); no hosts.
- **S3 to S4 (53.70).** F-promise-b. The chart: band, Merc's line, "A3", "level", the strip's
  hairline; the promise labels gone (53.30). Tavi at (1800, 840), 300, landed (53.12); Merc not yet
  in. m-orange spans the cut.
- **S4 to S5 (68.13, group A to B).** F0. The chart: band, Merc's line, "A3", "level", strip
  hairline; the label row's "in the band: within 35 cents (Lesson 3)" from x 400, baseline 150; no
  chips. The four words parked dim in the top lane, right-aligned to x 1800, baseline 110. Merc
  (110, 840) and Tavi (1800, 840) at 300. The swatches gone (66.40).
- **S5 to S6 (106.28).** F-wide. The bare chart (no line, no chips, no labels inside the plot), the
  slider at 50 (thumb (903, 723) on screen) with "Push" and "50"; the label row's text; Lesson 1's
  panels, the fork and the type gone (106.20). Hosts at 300 in the corners.
- **S6 to S7 (178.83).** F-gauge. The Loud gauge: gold at world y 454, both hatches, the chips
  ("Loud" lit), "the lungs' own push", "what the note needs" (baseline 444), "less holding back at
  first", "more adding as the air runs low"; the small band with Merc's line whole; the figure's
  torso at rest; no cursor, no readout. Hosts at 240 at (100, 840) and (1820, 840).
- **S7 to S8 (216.35, group B to C).** F0. The room only, the hosts at 240: every row and drawing of
  the card gone (216.25).
- **S8 to S9 (237.37).** F0. The whole figure at S8's placement with its cue labels but "knees
  unlocked"; hosts at 240.
- **S9 to S10 (300.98).** F-stack. The stack, its labels, circles, "the easy start" and "the h, only
  in your mind", the folds small; hosts at 240.
- **S10 to S11 (364.73, group C to D).** F0. The empty hold frame at the right half (band, Merc's
  line, "A, any octave"); the voice box, the slider, the demo line and the type gone (364.60); hosts
  at 300 in the corners.
- **S11 to S12 (402.58).** F0. The care block from "Your turn." to the listening line, the doctor
  lines small; the frame with its bracket, "10 s" and "Nothing listens"; the ring at 35 %, no
  counter; hosts at 300.
- **S12 to S13 (478.09, group D to E).** F0. The hold frame at the right half, nothing else of the
  turn (gone by 477.60); hosts at 300.
- **S13 to S14 (540.47).** The bead in flight on one curve both scenes compute from film time: from
  the "five notes" glyph's first dot (672, 393) at 539.70, growing from r 4 to r 20, to the C4 place
  (420, 745) at 541.30 (power2.inOut), a cubic through (640, 520) and (440, 640), drawn from film
  time; Merc in his first hop (540.40 to 540.95, (110, 840) to (700, 840)), his second (540.95 to
  541.50) to (1290, 840); Tavi at (1800, 840). The cards' lines gone by 540.30 **(provisional: the
  lab confirms the bead's path keeps 20 px from Merc's box)**.
- **S14 to S15 (556.01).** The tease figure in flight on its shrink (555.70 to 556.90, power2.inOut)
  from the S14 layout to the end card's box (above), computed from film time on both sides; the
  rows fading (555.70 to 556.10); the hook gone (555.95); Merc (1290, 840) and Tavi (1800, 840) at
  300, both beginning their moves at 556.05.

## Provisional values (each confirmed in a lab still, then unmarked)

The bead's flight S2 to S3; the chart's split (6b) and the strip's opening (6e); the folds' growth
from the throat (9b); the together start's onset (sound round); Merc's arc reach beside the care
block (m-blue at 300); the bead's path S13 to S14; the "settled" flag's time, computed from FACTS 80's
points by the page's rule (stays within 35 c for 0.5 s; about 0.68 s, x 476).
