# Storyboard v3: Find Your Pitch, Lesson 5, "Breath and a steady note"

1920x1080, 60 fps. **Timed on the board clock, 9:22.0 (562.01 s): script draft 3's word-rate
estimate as `script.json` now times it** (Merc 2.32 and Tavi 3.08 words a second, Lesson 2's voiced
pace, counted by `tools/script-draft.py`), the six chapter-card pauses included: since v2 they are
`script.json`'s own gaps, 2.2 s before o4, o6, o9, o10, o11 and b34 (DECISIONS 86), and
`SCRIPT-DRAFT.md` reads 9:22.0. No voice exists yet. The scratch voices (Kokoro) and then the owner's
ElevenLabs voices will move every time here, by tens of seconds by the end (Lesson 4's voiced film
ran about 30 s past its estimate). So every time below is an orientation, never a number to type:
scenes key off cue names and words (`L.at(scene, cue)`, `L.word(scene, line, word)`), and a word's
time here is its estimate (its place in the line at the line's rate). Exact pixels for every
carried object, every framing and the geometry formulas are in [HANDOFFS.md](HANDOFFS.md); this
board names framings and positions, HANDOFFS fixes them. Line ids are `script.json`'s (b = Merc,
o = Tavi); FACTS numbers are the film's `FACTS.md`.

**What changed from v1** (storyboard critic 01; v1 is kept in `review/storyboard-v1/`; DECISIONS 86
to 108 give each change and its reason). Each item is checkable where it is named:

| Critic item | v2 | Where to check |
| ----------- | -- | -------------- |
| 0, the camera's "push, run, pull" | Two push-and-returns only (S4's crane, S10's close-ups); three pushes return by a matched cut; four v1 moves become object moves | § Camera plan (its last column), HANDOFFS § Camera moves, § The cuts |
| 1, the viewer's turn | Push onto the right half (F-turn, 1.4x), since v3 at 422.80 to 423.90 (v2: 423.50 to 424.60): the ring r 224, the frame 896 px wide; the stop line and the small doctor lines stay left, and since v3 "Your turn." too; leaves by a matched cut at 478.09 | 12c to 12h; HANDOFFS § The turn, § Framings (F-turn) |
| 2, S10 | The chart fades in at W 4 during a push to 1.3x; the window widens to 10 s on screen on "ten seconds" (309.46 to 310.26); a truck at 1.8x from the scoop to the held wave; one wave rule for every framing | 10b to 10f; HANDOFFS § The wave rule |
| 3, S7 | Each piece of evidence drawn large while said, then shrunk into its row | 7a to 7e; HANDOFFS § The mix-up card |
| 4, collisions | Each one moved, with its new pixels | § Build checks, "Collisions fixed" |
| 5, the 0.4 s staging rule | Kept everywhere; the whole board swept | § Type, "Staging"; § Build checks, "Label landings" |
| 6, 10c's flicker | The mint edge and "in the band" light once, at 0.69 s, and hold | 10c, 13d |
| 7, the empty join at 216 to 219 | The breath figure carried, dimmed, through S7 into S8 | 7a to 8b |
| 8, 1h | Through the long note's round head bead, which becomes the title bead | 1g, 1h, 2 |
| 9, word for word | Every card line checked against `script.json`; "any comfortable" restored | 13e to 13g |
| 10, length | Not taken (the lead): the card gaps stay 2.2 s | DECISIONS 99 |
| 11, minor | The 179.2 visit of the four words is gone; 10h's check reworded | § Type; § Build checks |

**What changed from v2** (storyboard critic 02, `review/storyboard-02/REPORT.md`; v2 is kept in
`review/storyboard-02/before/`; DECISIONS 109 to 124 give each change and its reason). Rows and
HANDOFFS paragraphs changed in v3 carry **[v3: n]**, n being that report's item number ("prev n" is
its list of previous items). Clearances are HANDOFFS arithmetic with the report's type widths
(Outfit about 0.5 em a character; JetBrains Mono 0.6 em plus .18 em tracking); what paper cannot
settle is in [LAB-CHECKS.md](LAB-CHECKS.md).

| Critic 02 item | v3 | Where to check |
| -------------- | -- | -------------- |
| 1, 6k's label | "less holding back at first" back in v1's slot (x 760, baseline 765) with its leader up to (900, 430); "what the note needs", which stood across that leader in Loud, moves above the gold line's right end | 6k; HANDOFFS § The gauge, Labels |
| 2, the label-row chips | "LISTEN ONLY" right of the plot (left-aligned 1536, centred y 140) in S1 and S5; S5's definition on its own line (baseline 200); the four words' lane up to baseline 98; Lesson 1's panels 30 px lower; found in the recheck at 26 px, S1's pills and 10h's chip each 4 px higher; every tag one size, 26 px | 1e, 4d, 5c, 5e, 5f; § Codes, § Type; HANDOFFS § The band chart (Tags, Pills, Lesson 1's figure), § The hold frame |
| 3, missing tags | The gauge's chip in the frame's top right (on from 106.20, leaves with the gauge at 179.40); "LISTEN ONLY" on the catch in `starts`; the strip's chip at centred y 150 in the stack; "SLOWED · ILLUSTRATION", frame-fixed, through CU-scoop and the truck | 5g, 6a, 6b, 6e, 6f, 7a, 9f, 10d, 10e; HANDOFFS § The gauge, § The folds, § The hold chart |
| 4 and 7, the turn | The push 422.80 to 423.90, landed 0.14 s before "Listen"; the block thins and the phase row leaves at 422.30 to 422.60; "Your turn." stays to 438.60 | 12c, 12f; § Camera plan; HANDOFFS § Shared formulas, § The turn, § Framings, § Camera moves |
| 5, 9a and 10a | The figure and the stack leave from dim; the chart fades in from 303.40; the kicker at 303.80 | 9a, 9b, 10a, 10b; HANDOFFS § Camera moves |
| 6, the floor | Screen-space with the hosts at every framing, never on a parting layer | HANDOFFS § Shared formulas, § Framings (F-strip, F-gauge); 4a, 6f |
| prev 2, S10's empty band | The sentence corrected: the floor band is empty 304.9 to 324.6, accepted | 10f |
| prev 5, 342.00 | The axis, "A, any octave" and "settled" return 0.25 and 0.21 s apart | 10e, 10f; § Build checks |
| 9, geometry | "can't push air out" 30 px; "knees unlocked" right-aligned 907; 5g's fork points at the peak, "louder" off the fill; '"support"' lands at baseline 406 and settles to 420; Quiet and Loud stacked right of the frame | 1g, 5g, 6i, 6k, 8c; HANDOFFS |
| 11, minor | 7c lands each line on its words; Merc's line leaves the small band in 6e; chips 26 px in Codes | 6b, 6e, 7c; § Codes |
| 8, 10 and "not judgeable" | For the lab, each with a pass rule | LAB-CHECKS.md |

## The world

Lessons 1, 2 and 4's continuous dark listening room: Obsidian `#0d1117`, three soft radial glows
(blue top-left, violet top-right, aqua low-left), the stats site's faint five-line staves at 3.5 %
as the far layer, seeded dust motes as the near layer and Lesson 4's faint chrome bokeh discs in
the room's under layer (Lesson 4 DECISIONS 89, 93, 100), which part from the world on a push, pull,
truck or crane and brighten while they slide. Camera moves are Lesson 4's `L.frameRig` on far, mid
and near layers (0.25, 1, 1.6): a push, pull, truck or crane shows parallax; nothing in this film
pans. The Mercs are placed in screen space, so no camera move shifts or scales them.

**The floor runs the full width of the frame whenever a host is on screen** (y 840, the room's own
floor with each host's wet reflection at 16 %), never a local patch under a corner: Lesson 4's
film round 3 found a hard-edged box in the floor under each host (DECISIONS 72).

**The hosts are on screen from 0:53 to the end, and enter twice in the whole film.** Both watch
the cold open at 420 px, slide out at the hook (Lesson 4's exit), are absent through the title and
the promise, and come back in the recall by two floor-level leaps from opposite edges, Tavi from
the right (52.3) and Merc from the left (58.9). From then on they never leave: they stand in their
corners and change size or place in screen space when a framing needs it (300 px in the corners,
240 px small at the edge under the dense diagrams of chapters 2 to 4, 400 px on the end card), and
Merc crosses the floor once, in two hops at the recap's clean break (508.85 to 510.05), to stand under
where the tune will be. No host falls from the top of the frame anywhere in this film, and no entrance
repeats (DECISIONS 72; Lesson 4's six film rounds each found "the same fall" again).

The film's objects (HANDOFFS § World):

- **The band chart**, the persistent actor (§ Persistent actors): Merc's amber band at A3 with his
  steady amber line at its centre, a voice's violet line drawn with its wave, the level strip
  under it.
- **The breath figure**: a schematic standing figure in side view, facing right, chrome on the
  dark room (not to scale): head, jaw, neck, shoulders, ribs, the lungs, the diaphragm's dome under
  them, the belly wall, the legs and knees. Chapter 2 shows its torso; chapter 3 the whole figure.
- **The gauge**: the level strip opened out over one 10-second note (chapter 2).
- **The folds and the trace strip**: Lesson 3's vocal folds seen from above, and a 1.6-second
  trace (chapter 4).
- **The ring**: the page's breathing ring and its counter (the turn).
- **The beads**: the long note's head bead (the hook), the title bead, and the tease's seven beads
  on faint semitone rows.

**The bottom 17 % is the caption band**: nothing essential below y 896 in any shot, and the care
block (S11, S12) nothing below y 864. Delivery as Lessons 1, 2 and 4: a clean master plus SRT and
VTT from `cues.json`, never burned in.

**Motion with the sound off.** Every span longer than about 0.5 s has something that moves or
changes: a host who talks or sings, a line drawing on, an object moving, a label landing or
leaving, a counted pulse (§ Type), or a camera move while content travels at least about 8 px a
second. A drift, a breathing glow and the near dust do not count. Spans with no host on screen
(S2, S3) carry a lead move under their events.

## Camera plan

Each move has one job and lands before the change it goes for. Moves in brackets are object moves:
the camera stays still and the object moves (the room does not part). Numbers in HANDOFFS §
Framings and § Camera moves.

**The rule since v2** (critic 01, item 0): at most two moves leave a framing and come straight back
to it (push-and-return 1 and 2 below). Every other move that leaves F0 returns by a **matched cut**:
the next scene opens at F0 and draws the carried object on the same screen pixels (within 2 px), so
the subject holds while the faint room cuts back to rest; or it does not return at all (the hook
and the end). Four v1 camera moves are now object moves (F-wide, F-chest, F-stack and the pull at
179.00 are gone).

| Time (board)    | Move                                                       | From, to                     | For                                                                 | How it returns |
| --------------- | ---------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- | -------------- |
| 0.00-31.25      | drift (not counted)                                        | F-cold 0.90 to 0.92          | the cold open breathes                                              | - |
| 31.40-34.40     | pull out (sine.inOut)                                      | F-cold end to F-hook         | the bigger question: Merc's line becomes Lesson 4's last long note | does not: it goes on into the title |
| 37.50-38.05     | through an object: into the long note's head bead (power3.in) | F-hook to F-bead          | into the title (the film's one signature move)                      | does not: the bead becomes the title bead |
| 41.90           | cut                                                        | F-promise-a                  | the title's bead lands on A3                                        | - |
| 42.60-53.40     | truck right, 160 px (power1.inOut)                         | F-promise-a to F-promise-b   | follow the promise from a note's start to its ten seconds           | carries on into S4's crane |
| 54.00-55.40     | crane down with a push in (power2.inOut)                   | F-promise-b to F-strip       | "how loud": onto the level strip                                    | **push-and-return 1** |
| 66.00-67.50     | crane up (power2.inOut)                                    | F-strip to F0                | "the right note": the band returns                                  | (the return of 1) |
| (97.30-98.50)   | the chart slides left and shrinks to 0.78 (object)         | F0                           | room for Lesson 1's loud-or-high figure                             | never returns: S6 splits it from there |
| (110.90-112.40) | the chart splits: band up, strip down (object)             | F0                           | room for the breath figure; the gauge's two halves                  | - |
| (127.95-129.35) | the strip opens out into the gauge (object)                | F0                           | the predict's 2 s: frame and side label settle                      | - |
| 130.25-140.25   | slow push in (sine.inOut)                                  | F0 to F-gauge                | listen: attention closes in while the note holds                    | matched cut at o8 (178.83): the gauge, small band and figure keep their pixels |
| (179.00-180.40) | the gauge folds back and the chart reassembles (object)    | F0                           | the mix-up card's first evidence                                    | - |
| (186.20-186.80, 196.50-197.10, 205.20-205.80) | each large piece of evidence shrinks into its row (object) | F0 | the card fills as it is argued                               | - |
| (218.75-219.95) | the figure stands up whole at the centre (object)          | F0                           | chapter 3's whole figure                                            | - |
| (275.50-276.70) | the trace strip becomes a stack of three (object)          | F0                           | the three starts compared                                           | - |
| 303.40-304.90   | push in (power2.inOut)                                     | F0 to F-hold                 | onto the hold chart as it fades in (from 303.40) **[v3: 5]**        | matched cut at sing (364.73): the frame keeps its pixels |
| (309.46-310.26) | the window widens from 4 s to 10 s (object)                | F-hold                       | "ten seconds", seen                                                 | - |
| 324.60-326.10   | push in (power2.inOut)                                     | F-hold to CU-scoop           | the first second, slowed: the scoop                                 | **push-and-return 2** |
| 331.90-333.90   | truck right at 1.8x (sine.inOut)                           | CU-scoop to CU-wave          | from the scoop to the held wave                                     | (carries on) |
| 340.74-342.20   | pull out (power2.inOut)                                    | CU-wave to F-hold            | the whole hold again for "steady"                                   | (the return of 2) |
| (353.90-355.10) | the hold frame slides to the right half (object)           | F-hold                       | room for the voice box; the turn's frame is in place                | - |
| 422.80-423.90   | push in (power2.inOut)                                     | F0 to F-turn                 | the viewer's turn gets the frame: the ring at r 224; landed 0.14 s before "Listen" (424.04) **[v3: 4]** | matched cut at recap (478.09): the frame keeps its pixels |
| (478.20-479.40) | the frame slides down to its recap place (object)          | F0                           | room for the recap's panel and objects                              | - |
| 556.01-562.01   | slow push in, 3 % (sine.inOut)                             | F0 to F-end                  | the end card breathes to the last frame                             | does not: the film ends |

Every camera push here goes onto one thing (S4 the strip, S6 the gauge, S10 the hold and its
scoop, S12 the ring), and no two consecutive chapters use the same move. F0 holds about 58 % of the
film's time; it frames six different subjects (the chart, the figure and gauge, the mix-up card,
the folds and traces, the turn, the cards), each filling 60 to 85 % of the frame.

## Persistent actors

1. **The band chart.** One object the whole way, the app's own picture of a sung note. Frame 0
   shows it finished. In the cold open it holds the two takes; in the hook it pulls back into
   Lesson 4's last frame, its amber line the long note with a chrome bead at its head, and the
   camera passes into that bead; the title's bead lands on its A3 and draws that line again for
   the promise; the camera cranes onto its strip for the recall; in chapter 1 it is the Push toy,
   a slider under it, its pitch axis re-scaled on screen for the 6 s window (5b), and it slides
   left and shrinks to make room for Lesson 1's figure (5f). In chapter 2 it splits: the band
   rises and shrinks into Merc's small band, and the strip opens out sideways into the gauge. In
   the mix-up card it reassembles, draws the pushed take large and shrinks into the card's first
   row, and its strip doubles, easy and pressed, large, then small in the second row. It is away
   for chapters 3 and 4 (the figure and the folds are the subjects). In chapter 5 it fades in at a
   4 s window and widens to 10 s as Merc says "ten seconds"; it slides to the right half, where on
   the viewer's turn the camera pushes onto the same frame, which holds only a chrome playhead
   beside the ring; it slides down to answer recap card 3. Every change happens on screen, never
   under a chapter card; across a cut it keeps its pixels.
2. **The breath figure.** Chapter 2's torso (the dome, the lungs, the belly); parked, dimmed, at the
   mix-up card's left through S7, where it breathes once on "breathe in low"; chapter 3's whole
   upright figure (the same drawing, standing up from its parked place to the frame's centre);
   recap card 1.
3. **The violet line.** A voice's line always shows the wave its voice carries (FACTS 98), and by
   one rule the wave keeps one shape in every framing (HANDOFFS § The wave rule): the easy take,
   the pushed take, the Push note, Tavi's hold. Merc's amber line is always steady at the band's
   centre (FACTS 42). On the viewer's turn there is no violet line (FACTS 87).
4. **Tavi's dashed straight line.** Her cold-open guess (1b) and her chapter 5 guess (10b) are the
   same dashed line on the same band, so the second reads as the first returning.

## Signature moments

1. **One push, both moved** (1e). The pushed take sounds and draws: a second in the band beside
   the easy take's faint line, then the level strip under it swells while the wavy line climbs
   out of the top of the band, its peaks first, then its centre, then all of it; the band's edge
   goes dark and "above the band" stands where "in the band" was.
2. **The note holds while the work changes** (6f). Merc sings A3 for ten seconds and no one
   speaks. In his small band his amber line draws straight and level; under it, in the gauge, one
   cursor carries the lungs' falling push down across the gold line, and "Now: holding back"
   becomes "Now: adding" at seven seconds.
3. **A steady note settles, then waits for you** (10c and 12e). Tavi's line scoops up from below,
   wavers, finds the band and stays there with a small, even wave, while her dashed straight guess
   fades beside it. Two minutes later the camera moves in on the same frame, now standing empty but
   for a chrome playhead; the ring beside it, 448 px across, turns, and the viewer's ten seconds
   pass with nothing drawn and nothing listening.

## Codes

- **Pitch canvas** (the band chart; FACTS 69): target amber `#f59e0b` for Merc's band (fill 12 %,
  edges 2 px at 45 %) and his line (4 px, steady); singer violet `#a78bfa` for a voice's line
  (4 px, round caps) and its level strip (fill 28 %, edges 2 px at 70 %); in-tune mint `#80ffca`
  for the band's lit edge (3 px with a soft glow), shown only while a voice's centre is in the
  band and **always beside the words "in the band"**. There is no "off" colour. In 10c and 13d
  (Tavi's hold) the edge lights once, when her centre enters the band to stay (0.69 s); her line's
  first touch of the band and its 4-frame dip back out (under 0.1 s, FACTS 80's points) are not
  shown (DECISIONS 96).
- **Diagrams** (the series code, MASTER-PLAN § 5): chrome `#c3ccd6` marks and any note that is not
  a host's; ink `#e6edf3` labels; ink-2 `#a8b3bf` secondary labels; blue `#58a6ff` Merc's sung
  notes in a diagram (the tease's beads); orange `#ff7448` Tavi's; aqua `#2dd4bf` only the chapter
  cards' numerals. **Gold `#ffd84d` marks two things only**, the fit: the gauge's "what the note
  needs" line and the "together" start's tick. Never `#6e7681` for text.
- **Tavi's guesses** are dashed ink-2 (3 px, dash 10, gap 8) with a "?" (Outfit 600 64 px ink-2):
  the straight line (1b, 10b), the up arrow from the dome (6b), "steady air keeps it there?" (10g),
  the mix-up card's belief row (7a), the tease's moved copy (14b, her question). Nothing else is
  dashed.
- **Tags.** "ILLUSTRATION" (JetBrains Mono 500 26 px, tracking .18em, ink-2, in a chrome 25 %
  pill 40 px high with 16 px each side: 271 px wide; one size everywhere, as HANDOFFS § The band
  chart sets it, in the units of the drawing it sits on) on every drawing that is not a
  measurement: the takes, the Push note and its toy (from 70.93, Q29), the gauge (the same chip,
  carried on from the toy at 106.20 and leaving with the gauge at 179.40), the pushed take
  redrawn in the mix-up card, the starts, Tavi's hold (in the close-ups as "SLOWED ·
  ILLUSTRATION", 453 px), 10h's silent line, recap card 3. "LISTEN ONLY" (same style, 250 px) on
  the pushed take, the Push note and the catch, the catch again in `starts`, from the moment each
  sounds until it leaves **[v3: 2, 3, 11]**.
- **Loudness is never drawn on the pitch axis**: it is the level strip's height (playbook rule 20).
  The Push slider is horizontal, under the strip, so its travel is never read as pitch.
- Every coloured thing also has a label.

## Type

As Lessons 1, 2 and 4. Kickers JetBrains Mono 500 30 px, uppercase, tracking .18em, ink-2, at
(120, 110), landing with an act's first line after its card and leaving at the end of its second
line. Big ideas Instrument Serif italic, 64 to 160 px. Numbers Outfit 600 tabular. Diagram labels
Outfit 600, 30 to 56 px. On-screen text is a label, a number or a key term, never a narrated
sentence, except the care block's stop line and doctor lines and the two practise cards' lines,
carried whole and word for word (BRIEF).

World labels (anything that names a part of a drawing) ride the camera and scale with it;
frame-fixed type (kickers, chapter cards, pills, the four words, the care block, the recap panel,
the cards, the feel block, the hook) never scales and never rides a move. A frame-fixed label a
move would put over a drawing leaves before the move and its replacement lands after it.

**Chapter cards** are Lesson 1's, as Lesson 4's: the numeral in aqua (Instrument Serif italic
300 px) beside the title in chrome serif italic 170 px, centred on baseline y 480, in from act +
0.22 (0.85 s, expo.out), breathing from scale 1 to 1.03, leaving up fast (0.38 s, power3.in) 0.1 s
before the act's first line, over the diagram dimmed to 25 % (its labels hidden while dim). Five
numbered cards ("01 What pushing does", "02 What the diaphragm does", "03 Breathing in", "04
Starting a note", "05 A steady note") and "Sing it" with no numeral; the recap and "Next time" are
kickers only ("QUICK CHECK", "NEXT TIME"). A diagram never changes shape under a card: what a
chapter replaces stays, dimmed, under its card and gives way on the chapter's first line.

**The four words** ("air pressure", "diaphragm", "onset", '"support"'; LESSON.md's "Four words
you'll meet", on screen only, FACTS 83) are introduced once in the recall (4d) and park as a row of
chips in the top lane, right-aligned to x 1800, baseline 98 (Outfit 600 30 px, each in an outline
38 px high, y 68 to 106; dim: ink-2 in a chrome 25 % outline; lit: ink, chrome 60 % outline, a 2 px
chrome underline). Since v3 the lane is 12 px higher than the kickers' baseline (110): in S5 the
chart's "ILLUSTRATION" chip (from y 120) sat right under the row's outlines, and at 98 they clear it
by 14 px **[v3: 2]**. The row is not on
screen all the time: it comes back four times, once round each word's definition, with that word
lighting as Merc says it: "pressure" (row 77.80, lit 78.34, leaves 82.10), "diaphragm" (112.40,
112.98, 117.10), '"Support"' (197.55, 198.06, 202.20), "onset" (244.20, 244.61, 248.40). Lit
words stay lit on its later visits (DECISIONS 75). There is no other visit (v1's at 179.2, which lit
nothing, is gone).

**Staging (the 0.4 s rule).** No two separate labels land within 0.4 s of each other anywhere in
the film. A label that is part of an object landing with it (a swatch's name, the slider's "Push"
and value, a strip's name under it, a chip on a drawing) counts as that object; a label switch
("Air first" to "A catch", "Now: holding back" to "Now: adding") counts as a landing; a chip
lighting, a pulse or a glow does not. Leaving is not landing, but nothing lands where something
else is still leaving. § Build checks lists every pair under 0.6 s, all at 0.40 s or more. One
exception, by the lead's call (v3): labels that leave for a camera move and come back after it are
returns, not new labels, and come back staggered 0.2 to 0.3 s apart inside their row's own window,
the main one first (10f at 342.00) **[v3: prev 5]**.

**Timing of text and marks**: unless a row says otherwise, a label fades in over 0.2 s from its word
and out over 0.2 s; "up fast" is 0.3 s, power3.in. A replacement label slides the old one up 12 px
as it fades and the new one in from 12 px below, 0.25 s.

**Counted pulses** (Lesson 2's, measured by its critic 08; Lesson 4 BUILD-GUIDE, Motion): a label of
48 px or more scales 1.2 about its own left baseline (never its centre, which made type twitch in
Lesson 4's E rounds), up over 0.15 s and back over 0.6 s; a pill or chip scales 1.08; a bead scales
1.2 or sends an echo ring (2 px chrome growing from its edge to three times its radius as it fades
over 0.5 s); a large area lit (a strip, a hatch region, a trace) counts once the lab clip shows it
registering. Glows are accents and never stand in for motion. Small type never steps a whole pixel
a frame as it settles: settling moves are eased over 0.4 s or more, or not done (Lesson 4 E-02).

**Contrast**: dim strokes and fills, never labels. Every settled label stays at 4.5:1 or better
against what is behind it (ink on the ground 16.0:1, ink-2 8.9:1; ink on the band's 12 % amber fill
and on the strip's 28 % violet fill measured again in the lab). A label whose group dims is hidden
while it is dim.

## Scene table (for `tools/gen-root.py`; its table is unchanged)

| Scene         | First cue | Title                                         | Starts (board) | Builder |
| ------------- | --------- | --------------------------------------------- | -------------- | ------- |
| s01-cold-open | (film 0)  | Cold open: one note, sung easily, then pushed | 0:00.0         | A       |
| s02-title     | title     | Title                                         | 0:38.3         | A       |
| s03-promise   | b4        | The promise                                   | 0:41.9         | A       |
| s04-recall    | o3        | From Lesson 3: how loud to sing               | 0:53.7         | A       |
| s05-push      | act1      | What pushing does                             | 1:08.1         | B       |
| s06-diaphragm | act2      | What the diaphragm does                       | 1:46.3         | B       |
| s07-support   | o8        | "Support": a common mix-up                    | 2:58.8         | B       |
| s08-breathe   | act3      | Breathing in                                  | 3:36.4         | C       |
| s09-onset     | act4      | How a note starts                             | 3:57.4         | C       |
| s10-steady    | act5      | What a steady note looks like                 | 5:01.0         | C       |
| s11-sing      | sing      | Sing it: listen along if you need to          | 6:04.7         | D       |
| s12-your-turn | b38       | Your turn: ten seconds                        | 6:42.6         | D       |
| s13-recap     | recap     | Quick check and practise                      | 7:58.1         | E       |
| s14-next      | next      | Next time                                     | 9:00.5         | E       |
| s15-end       | end       | End card                                      | 9:16.0         | E       |

Fifteen compositions; cuts on `act1` to `act5`, `sing`, `recap` and `next` land 0.15 s before the
mark, as `gen-root.py` does. Groups: A s01 to s04, B s05 to s07, C s08 to s10, D s11 and s12, E s13
to s15 (HANDOFFS names every cross-group frame). Three cuts are matched cuts that end a push (o8,
sing, recap; § Camera plan). YouTube chapters (each over 10 s; board starts): One push (0:00), How
loud to sing (0:54), What pushing does (1:08), What the diaphragm does (1:46), "Support" (2:59),
Breathing in (3:36), How a note starts (3:57), A steady note (5:01), Sing it (6:05), Your turn
(6:43), Quick check (7:58), Practise it (8:28), Next time (9:00).

## Shots

Shot line: size · angle · lens · move · light · composition · time · out, in the vocabulary of
`.claude/skills/motion-designer/references/shot-grammar.md`. Every shot is eye level, 50 mm
equivalent and lit by the palette unless its line says otherwise ("as above" repeats the line
before). "Out" says how the shot leaves; "Carried" names what the next shot picks up. Times are the
board clock's; a word in quotation marks with a time is the cue a builder keys to. Rows changed
since v1 end with the critic item they answer, as **[v2: n]**, and rows changed since v2 with
storyboard critic 02's item, as **[v3: n]** ("prev n": that report's list of previous items).

### Cold open, title, promise and recall [A]

World positions are F0 pixels; HANDOFFS § Framings maps them to the screen in each framing.

| #   | Time (cues) | Shot line | On screen | For | Out | Carried |
| --- | ----------- | --------- | --------- | --- | --- | ------- |
| 1a  | 0.00-4.90 (open, easy, heard) | MWS two-shot · eye level · 50 mm · F-cold, drifting from 0.90 to 0.92 about the screen point (960, 450) over 0 to 31.25 (power1.inOut; a drift, not counted) · soft key glow behind each host, mint and amber the only colour on the chart · centre symmetry: the chart centred, Merc feet (230, 840) and Tavi feet (1690, 840) at 420, both turned toward it · real time · continuous | **Frame 0 is finished**: the band chart (plot x 400 to 1520), Merc's amber band at A3 with his steady amber line at its centre; "A3" left of the line; the label row above the plot, "in the band: within 35 cents (Lesson 3)" left and the "ILLUSTRATION" chip right; the level strip under the plot as a hairline, "level" under its left end; kicker "FIND YOUR PITCH · LESSON 05" (leaves 4.40 to 4.60). From easy's start (0.60) the easy take draws as it sounds, a violet line whose head is a small violet dot with a soft glow, travelling right at 280 world px a second: in from 40 cents low, into the band by 0.5 s, then holding there with its small, even wave growing in over 0.35 s (5.5 cycles a second, 14 cents either way: FACTS 80, 98; 45.8 px a cycle and 63 px peak to peak on screen, HANDOFFS § The wave rule); the strip's even envelope draws with it. As its centre enters the band (about 0.85) the band's top and bottom edges light mint and "in the band" lands beside the band's left end, under "A3". On "sung" being heard, "sung easily" lands right of the plot beside the band's lower edge (1.30, 0.45 s after "in the band"). The head reaches the plot's end at 4.60 and its dot fades; heard: both hosts lean a little toward the chart, the line whole **[v2: 5]** | A sound becomes a line, by 1 s | continuous | Easy line, band lit |
| 1b  | 4.90-9.35 (o1) | as above | Tavi talks, Merc listens (turned to her). On "push the air out harder" (6.07 to 7.37) the strip's envelope outline brightens once (an accent) and the line's head point at the plot's end sends an echo ring (7.40). On "holds steadier?" (8.35 to 9.00) her guess draws as a guess: a dashed ink-2 line held dead flat along the band's centre over the take's held part, x 540 to 1520 (8.35 to 8.85, left to right), with its "?" landing right of its end (8.85); Merc's amber line fades to 0 under it (a stroke, never a label), the easy take dims to 50 % while the guess draws with a travelling head, so the straight dashed line and the wavy violet one read side by side **[A-01: 170]** | Voice the misconception: a push would iron the wave out (FACTS 82) | continuous | Dashed guess |
| 1c  | 9.35-19.13 (b1) | as above | Merc talks, Tavi listens. On "the same note" (10.64) a light runs along the easy line, left to right (0.6 s), and back to rest; on "harder" (11.93) and again on "harder." (12.79) the guess's "?" scales 1.2 (counted). On "settle," (14.52) the pill "Settle, steadier than before" lands top centre-left; on "louder" (17.10) "Get louder and drift higher" lands beside it (pills Outfit 600 34 px in chrome-stroked capsules, HANDOFFS § The band chart); both scale 1.08 once as each lands | The page's predict, aloud (by 0:19) | continuous | Pills |
| 1d  | 19.13-21.48 (predict) | as above | A ring timer draws round a small dot right of the pills over the 2.0 s; the pad swells; both hosts idle, turned toward the pills; the "?" breathes (an accent). At 21.13 the ring timer fades; at 21.30 "sung easily"'s line dims to a 35 % violet ghost (its label stays ink) and the strip's easy envelope to an outline, so the next line has the stage | The viewer predicts | continuous | Ghosted easy line |
| 1e  | 21.48-25.68 (pushed) **signature 1** | as above | "LISTEN ONLY" lands as the take starts (21.48), right of the plot at the label row's height (left-aligned x 1536, centred y 140 world; on screen x 1488 to 1720, y 146 to 184 while it shows, the drift at 0.916 to 0.92), 16 world px right of "ILLUSTRATION" (it ends at 1520; 14.7 px on screen), 76 world px over "above the band" and 58 px right of the second pill (it ends at x 1430) **[v3: 2]**. The pushed take draws at full violet over the ghost: for its first second it lies on the easy line; then, as the push grows, the strip's envelope swells under it (to twice the easy height by the end, +6 dB) while the wavy line climbs: its peaks leave the top of the band from 23.53 (2.05 s), its centre at 24.23 (2.75 s), when the band's edge goes dark and "in the band" leaves; from 24.93 (3.45 s) the whole line is above the band and "above the band" lands right of the plot beside the line's end (FACTS 80). The finished line is drawn whole at 25.48 and stays exactly so through b3, still and complete, its head dot fading | One push, both moved, heard and seen together | continuous | Pushed line, swollen strip |
| 1f  | 25.68-31.25 (b3) | as above | On "Louder," (25.68) the swollen part of the strip lights to 40 % violet and back (counted) and "louder · higher" (Outfit 600 56 px, ink) lands top left of the plot, over the band's empty left half; on "higher." (26.54) the climbing part of the line glows and the second pill gets an ink check (an SVG mark drawing on 0.3 s); the first pill dims its stroke; Tavi's dashed guess and its "?" fade (26.60 to 26.90) and Merc's amber line returns to full. On "Pushing" (26.97) the small type "Both lines are drawings of that rule, not recordings." lands under the strip's right half (Inter 34 px, ink-2). On "moves it." (29.99) an ink arrow (3 px) draws from the take's last in-band point up to its end (30.0 to 30.5) | The reveal; the takes declared drawings (FACTS 72) | continuous | Both lines, arrow |
| 1g  | 31.25-37.10 (o2) | pull out (sine.inOut, 31.40 to 34.40) from F-cold end to F-hook: the chart recedes until Merc's amber line runs x 560 to 1360 at y 520, Lesson 4's last long note; far, mid and near layers part · the hosts hold their places | Tavi asks; Merc listens. As the pull starts, the pills, "louder · higher", the arrow, the small type, "above the band" and "LISTEN ONLY" leave up fast in turn (31.30 to 31.75); on "told to" (32.23) the pushed line, the ghost, the strip and their labels fade (32.20 to 32.70), then the band's fill and edges, "A3" and the label row (32.50 to 33.00), leaving only Merc's amber line. On "support" (32.87) '"support"' (Instrument Serif italic 160 px, ink, centred) lands above the line at baseline 406, so its descenders (about 40 px, to y 446) keep 12 px above Merc's line at its highest while the word is on screen (centre y 460 at 32.87, its 4 px stroke from 458); it then eases down 14 px to Lesson 4's baseline 420 with the pull (32.87 to 34.40, sine.inOut), the line falling 60 px over the same time, so the clearance only grows (58 px at 34.40) **[v3: 9]**. **As the pull lands (34.40 to 34.80) a chrome bead fades in at the line's left end, screen (560, 520), r 22 on screen (world (400, 400), r 30.8), Lesson 4's bead on Lesson 4's long note: the line's round head.** On "what keeps" (35.80) "what keeps it steady?" (serif italic 96 px, centred, baseline 680) lands under the line; on "steady?" (36.77) the bead scales 1.2 and sends one echo ring, and the line's glow brightens once and back. At 34.40 the frame is Lesson 4's own last tease frame (its S15: the same type, sizes and places, the long note at y 520 from x 560 to 1360, its bead at (560, 520)), now asked from this side (DECISIONS 73) **[v2: 8]** | The hook, by 0:37; it picks up Lesson 4's last lines | continuous | The long note and its head bead, the hook's two lines |
| 1h  | 37.10-38.30 (hook) | through an object: into the long note's head bead, F-hook to F-bead (37.50 to 38.05, power3.in), the camera closing on the bead until it stands at the frame's centre, (960, 540), 2.2 times its world size · the hosts slide 360 px outward and out of frame (37.30 to 37.90, power2.in) | The two lines hold to 37.55, then leave up fast (37.55 to 37.85). From 37.60 the bead's glow grows toward the lens and defocuses, round about the bead's own centre, until a smooth radial chrome field fills the frame at 38.05 (Lesson 2's level, never a white flash); the amber line, now off to the right of the bead, fades under the glow (37.60 to 37.90), so nothing blooms sideways. The field holds, breathing 2 % in brightness, to the cut **[v2: 8]** | Into the title, through the long note's bead | full-frame field | Full-frame field |
| 2   | 38.30-41.90 (title) | full-frame type · centre symmetry · slow zoom out 4 % (Lessons 2 and 4's S2) | Lesson 4's title composition: the field shrinks back into a chrome bead on the middle line of five living staff lines (38.30 to 38.76, the radius on power2.out, the centre on power3.out), the same bead the camera passed into; five quarter notes hop in with the sting's five chimes (A3 E4 A4 C♯5 E5; 38.35 to 38.71), each sending a ripple; the title "Breath and a steady note" (chrome serif italic 140 px, one line, centred, baseline 380) and its kicker "LESSON 05" land from 38.56; "Find Your Pitch" (Outfit 48 px) under the title; the notes bob 8 px on a 1.2 s cycle. From 40.72 the type and notes exit up; from 41.02 the staff fades (41.02 to 41.62) while the chart fades up under it in F-promise-a (band, Merc's line not yet drawn), and the bead lifts off its line and flies to the chart's A3 at the plot's left end (41.02 to 42.02, sine.out) | Series identity | continuous across the cut: the bead in flight | The bead, in flight to A3 |
| 3a  | 41.90-45.77 (b4 to "does,") | WS · F-promise-a, then a truck right of 160 px (42.60 to 53.40, power1.inOut; far, mid and near at 0.25, 1, 1.6) · centre · no hosts | The bead lands on A3 at the plot's left end (42.02), turns amber, sends one echo ring, and becomes the head of Merc's line, which draws on to the plot's end (42.02 to 42.62, power2.out), the band's fill and edges spreading behind it; "A3" and the strip's hairline fade up with it. On "what your diaphragm does" (44.05) "what your diaphragm does" (Outfit 600 40 px, ink, a world label) lands under the strip's left half, and the strip's rounded outline draws round it in chrome (44.10 to 44.60) and dims back: the place the push of air will be drawn | The promise, part 1 (the diaphragm) | continuous | Chart, label 1 |
| 3b  | 45.77-49.65 ("how to" to "easily,") | as above | On "breathe in low" (46.64) "breathe in low · start easily" lands above the band's left end; on "start" (48.36) a chrome tick (4 px, the band's height) stands at the line's start and the first 120 px of Merc's line glow, the place a note starts | Part 2 | continuous | Chart, labels 1 and 2 |
| 3c  | 49.65-53.70 ("and you'll" to the end) | as above (the truck lands at 53.40) | On "hold" (50.09) "a comfortable note · 10 s" lands above the band's right half; on "comfortable" (50.95) a chrome playhead (3 px, the band's height) starts at the line's start and sweeps the band to its end over 2.0 s, the band's fill brightening from 12 to 24 % behind it and easing back after it, a preview of the hold. The three labels leave up fast at 53.00 to 53.30. Tavi's leap begins off the right edge (52.32; she is in the air 52.47 to 52.90 and settled at 53.12, HANDOFFS § S3 to S4) | Part 3 (the ten seconds) | cut on o3 (53.70) | Chart, Tavi landing |
| 4a  | 53.70-57.95 (o3) | crane down with a push in (54.00 to 55.40, power2.inOut) from F-promise-b to F-strip: the strip rises to the frame's upper middle at 1.4x, the band leaving out of the top; the staves slide up past it slower, the bokeh faster; the floor and Tavi's reflection stay at y 840 with her, in screen space (HANDOFFS § Shared formulas) **[v3: 6]** · Tavi in her corner (1800, 840) at 300 · **push-and-return 1, out** | Kicker "FROM LESSON 3" (53.75; leaves at 59.75). Tavi talks. As the crane lands, three level swatches land in a row under the strip, left to right, 0.4 s apart (55.00, 55.40, 55.80), each with its name under it: chrome-outlined envelopes of three heights, small, middle and tall (the middle one exactly the strip's own height), with "whisper", "about speaking volume" and "shout" under them (Outfit 600 36 world px, ink-2). The strip itself shows an even envelope at the middle height and never changes **[v2: 5]** | Retrieve Lesson 3, asked afresh (rule 18) | continuous | Strip, swatches |
| 4b  | 57.95-60.25 (q0) | as above · Merc leaps in from the left edge to (110, 840) at 300 (in the air 59.02 to 59.45, settled 59.67) | A ring timer round a small dot right of the swatches (40 px clear of the third, centred on the row) over the 1.8 s **[A-01: 175]**; the pad swells; Tavi idles, turned toward the strip; Merc's leap lands as the ring closes | The viewer answers in their head | continuous | Strip, swatches |
| 4c  | 60.25-63.27 (b6 to "at:") | as above | Merc talks. On "about the volume" (60.68) the middle swatch lights: violet 28 % fill like the strip's, an ink outline, its label to ink and Outfit 600 (it scales 1.08 once); a chrome hairline (40 %) draws from it up to the strip, whose envelope it matches. Nothing else moves: the strip does not grow or shrink (FACTS 83) | The answer, on the object that taught it | continuous | Lit swatch |
| 4d  | 63.27-68.13 (b6 from "a quiet note") | as above, then crane up (66.00 to 67.50, power2.inOut) from F-strip to F0 · **push-and-return 1, back** | On "a quiet note" (63.27) "FOUR WORDS YOU'LL MEET" (mono 26 px, ink-2) lands centred low, and the four words land under it one by one as chips, 0.4 s apart (63.70, 64.10, 64.50, 64.90): "air pressure", "diaphragm", "onset", '"support"' (Outfit 600 44 px, ink, centred row at baseline 790); on "much" (65.85) the row shrinks to 30 px and flies to the top lane, right-aligned to x 1800, baseline 98 (v2: 110), and dims (65.70 to 66.30, power2.inOut), each word in its dim chip **[v3: 2]**. On "the right note" (66.28) the crane brings the band back down into frame: the swatches, the hairline and the heading fade (66.00 to 66.40) and Merc's line in its band returns at F0 as the crane lands (67.50) **[v2: 5]** | The four words parked; the right note is the band's | cut on act1 (68.13) | Chart at F0, the four words parked (HANDOFFS § S4 to S5) |

### Chapters 1 and 2, and the mix-up card [B]

| #   | Time (cues) | Shot line | On screen | For | Out | Carried |
| --- | ----------- | --------- | --------- | --- | --- | ------- |
| 5a  | 68.13-70.48 (act1) | full-frame type over the dimmed chart · both hosts in their corners at 300 (Merc (110, 840), Tavi (1800, 840)), idle, turned to the card | The chart dims to 25 % (68.28 to 68.48), "A3" and "level" hidden while dim; chapter card "01 What pushing does" in from 68.50, leaving up fast 69.98 to 70.36; the chart back to full 70.36 to 70.56. The four words stay parked in the top lane through the card | Chapter breath; the whoosh | continuous | Chart at F0 |
| 5b  | 70.48-73.60 (o4) | MWS · F0, static · the chart centred, hosts in the corners · real time | The four words leave up fast (70.48 to 70.78). As Tavi starts, the chart's pitch axis eases from 2.5 to 1.667 px a cent (70.48 to 71.08, power2.inOut): the band narrows from 175 to 117 px about Merc's line (y 312.5-487.5 to 341.7-458.3), so the Push note's wave will keep the cold open's shape at its 6 s window (HANDOFFS § The wave rule). On "If I ease off" (70.48 to 71.45) the Push slider draws under the strip, left to right (0.5 s): a chrome track x 400 to 1520, its thumb at 50 (x 960) with "50" riding above it (Outfit 600 30, tabular) and "Push" left of the track (one object). "ILLUSTRATION" lands in the label row (70.93): the toy is a drawing from the start (Q29). On "ease off," (71.13) the thumb scales 1.2; Tavi talks, Merc listens **[v2: 2, 5]** | Her question, which the sound will answer (FACTS 84) | continuous | Push toy |
| 5c  | 73.60-84.72 (b7) | as above | On "How hard" (73.60) "pressure: how hard your breath pushes on your vocal folds" (Outfit 600 34 px, ink) lands on its own line under the label row, x 400, baseline 200 (to about x 1370; its cap top 176 is 15 px under the "ILLUSTRATION" chip's foot, y 160), and "in the band: within 35 cents (Lesson 3)" stays in the row; the four words return to the top lane (77.80, baseline 98: their outlines end at y 106, 14 px over the chip and 70 px over the definition) and "air pressure" lights on "pressure." (78.34), the row leaving at 82.10; on "mainly" (79.20) "mainly: louder" lands inside the plot just above the strip (x 420, baseline 600) with a short chrome arrow down to the strip, whose envelope outline brightens: from here the strip shows its resting envelope in ghost violet, so the arrow points at a level, and "level" stands at the strip's left at its height, not on the slider's row **[B-01: 184]**; on "nudges the pitch" (83.08) "also: a little higher" lands above the band (x 420, baseline 310) with a short arrow up to the band's top edge **[v3: 2]** | Step 1's words, each on its part | continuous | Push toy, two labels |
| 5d  | 84.72-90.30 (b8) | as above | "mainly", "also" and the definition leave (84.72 to 85.02). On "watch the line" (85.59) the line's starting point on A3 at the plot's left end sends an echo ring. Over the slider only, the push's plan draws in chrome at 40 %: on "rises," (87.74) an arrow from the thumb along the track to 100; on "holds," (88.17) a short hold bar at 100; on "eases off." (89.03) an arrow back to 50. They say what the push does, never what the line does, and fade at 90.10 | b8 names the push only; the line is left to the sound (script critic 02) | continuous | Push toy |
| 5e  | 90.30-95.90 (push) | as above | "LISTEN ONLY" lands (90.30) right of the plot at the label row's height, as in S1 (left-aligned x 1536, centred y 140: x 1536 to 1786, y 120 to 160), 16 px right of "ILLUSTRATION" and 114 px over "above the band" **[v3: 2]**. The Push note draws in violet with its wave over the 6-second window (33.9 px a cycle, 46.7 px peak to peak), the thumb moving in time with the sound: at 50 to 0.6 s, up to 100 by 2.1 s, held to 3.6 s, back to 50 by 4.8 s, held to 5.6 s (FACTS 80), its "50" counting to "100" and back; the strip swells to twice its height and returns with it; the line climbs 100 px (+60 cents) out of the top of the band, the band's edge dark and "in the band" gone from 91.77 to 94.40 (its centre out), "above the band" right of the plot (x 1536, baseline 300) from 92.12 to 94.12 (the whole line out, 1.5 s of it at the top); the line comes back into the band and the mint edge and "in the band" return at 94.40. The finished line stays whole: up, a flat 1.5 s at the top, back | The push rises, holds, eases; the line follows it up and back | continuous | Finished Push line |
| 5f  | 95.90-101.42 (o5) | MWS · F0, static · **the chart moves, not the camera**: the whole chart (plot, band, lines, strip, slider, their labels and chips) slides left and shrinks to 0.78 (97.30 to 98.50, power2.inOut; on screen x' = 0.78 x + 154, y' = 0.78 y + 99, so the plot spans x 466 to 1340) while Lesson 1's figure slides in from the right edge to x 1433 to 1823, y 301 to 503 (97.60 to 98.50; v2: y 271 to 473); the room stays still **[v3: 2]** | On "It came back." (96.20 to 96.85) the line's return glows from the top back into the band and "in the band" scales 1.08. Tavi talks. Lesson 1's loud-or-high figure (chrome, its own drawing at 0.6 of its size): two small panels, LOUDER (a trace grows taller while its bead stays put) and HIGHER (the trace packs tighter while its bead jumps), each playing once, LOUDER on "loud" (98.47) and HIGHER on "high" (99.12); on "different things." (99.77) "loud ≠ high" (Outfit 600 48 px, ink, centred x 1628, baseline 277; ≠ drawn as a path) lands over the panels. At 0.78 the chart's two chips ride to x 1128 to 1340 ("ILLUSTRATION") and 1352 to 1547 ("LISTEN ONLY"), y 192 to 224, 12.5 px apart; v3 moves the panels and "loud ≠ high" 30 px down so the heading (x 1496 to 1760, y 242 to 287) clears "LISTEN ONLY" by 19 px and the panels by 14. At 0.78 the Push line's wave measures 26.4 px a cycle and 36.4 px peak to peak, the same shape **[v2: 0]** **[v3: 2]** | Her doubt, from Lesson 1 (FACTS 13) | continuous | Chart at 0.78 and Lesson 1's figure |
| 5g  | 101.42-106.28 (b9) | as above, static | On "They are." (101.42) "loud ≠ high" scales 1.2. On "one push" (104.00) an ink arrow (3 px) draws up from the slider's thumb (screen (903, 723)) and forks (104.00 to 104.60), both ends pointing at the note's peak, where the push was held at 100 (screen x 772 to 990): the stem leaves the thumb's right side, passes 12 px or more right of its "50", crosses the strip just right of the peak and reaches the fork at (1010, 525), in the dark gap between the band's foot (456.5) and the swollen strip (top 593); one branch ends 11 px over the swollen strip at (960, 582), and "louder" (Outfit 600 40 px) lands beside it as it arrives (104.30), left-aligned x 806, baseline 575: off the strip's fill (18 px over it) and 40 px left of its branch; the other ends under the raised line at (960, 375), on the band's fill 24 px under the line's lowest point, and "higher" lands (104.75) at x 806, baseline 500, 14 px under the band's foot; the two labels stand 38 px apart inside the fork. On "in a voice," (before "one push") "in a voice, one push moves both" (serif italic 56 px, ink, centred, baseline 130) lands top centre, so it reads for 2 s or more before the fade **[B-01: 181]** (v3: on "both.", 105.30, up 0.5 s). From 105.80 the panels, the fork, its labels, the line, "LISTEN ONLY" and the type fade (105.80 to 106.20), leaving the bare chart at 0.78, the slider at 50 and "ILLUSTRATION", which stays in the label row with the toy (the slider is a drawing, Q29) **[v2: 0, 5]** **[v3: 3, 9]** | Loud and high are different, and one push moves both | cut on act2 (106.28) | Bare chart at 0.78, slider and its "ILLUSTRATION" chip (HANDOFFS § S5 to S6) |
| 6a  | 106.28-108.63 (act2) | full-frame type over the dimmed chart, F0 | The chart and slider dim to 25 % at their 0.78 place (106.43 to 106.63), their labels and the "ILLUSTRATION" chip hidden while dim; card "02 What the diaphragm does" in from 106.65, out 108.15 to 108.53; back to full 108.53 to 108.73 **[v3: 3]** | Chapter breath | continuous | Chart at 0.78 |
| 6b  | 108.63-112.55 (o6) | MWS · F0, static · the hosts shrink in place to 240 at (100, 840) and (1820, 840) (108.70 to 109.50), sitting small at the edges for the diagrams to come | Kicker "02 · WHAT THE DIAPHRAGM DOES" (to b11's end; y 89 to 110, out to about x 730). Tavi talks. The chart's "ILLUSTRATION" chip glides from the label row (at 0.78: x 1128 to 1340, centred y 208) down and then right, over the empty top right of the plot, to its place for the gauge right of the bare plot (right-aligned 1630, centred y 320: x 1359 to 1630, y 300 to 340), growing to full size (108.80 to 109.40): 19 px right of the plot's end, 25 px over the band's top at 0.78 **[v3: 3]**. On "that push" (109.60) the thumb scales 1.2. On "Isn't it the diaphragm?" (110.90) the chart splits from its 0.78 place in one move (110.90 to 112.40, power2.inOut): the slider and the label row's text fade (110.90 to 111.10); the band with Merc's line rises and narrows into Merc's small band, top right, rising before it slides right (its foot above y 288 before its right end passes x 1347), so it passes 12 px or more above the chip **[v3: 3]**; Merc's line rides into the small band whole and stays there until the gauge opens, where it fades so the sung note can draw it again (6e) **[v3: 11]**; the strip slides down and right to the gauge's floor, still a strip; at the same time the breath figure draws on at the left (111.00 to 112.00, its strokes drawing from the spine outward): the torso in side view facing right, its head at y 143 to 293 (33 px under the kicker), the lungs, the dome under them, the belly wall, the legs faded out below the hips. On "diaphragm?" (111.87) her guess: a dashed ink-2 arrow from the dome up into the lungs, with its "?" right of the chest (112.00 to 112.40) **[v2: 0, 4]** | Her guess, drawn as one (FACTS 85) | continuous | Figure, small band, strip |
| 6c  | 112.55-118.93 (b11) | MWS · F0, static · the figure left third, the small band and the strip right | The four words return (112.40) and "diaphragm" lights on "diaphragm" (112.98), the row leaving at 117.10; "diaphragm" (Outfit 600 34 px, ink) lands left of the figure's back with a chrome leader to the dome (113.45); on "dome-shaped" (114.27) a light runs along the dome's arc; on "lungs." (116.00) "lungs" lands left of the lungs and the guess arrow and its "?" fade (116.00 to 116.30). On "tightens to breathe in" (116.86) the figure breathes in once (116.86 to 118.36, sine.inOut): the dome flattens and lowers, the belly wall moves out and "belly" lands beside it (117.10), the lungs' outline fills; "breathing in" (Outfit 600 36 px) lands left of the dome (117.60); the figure eases back (118.40 to 119.40) **[v2: 5]** | The diaphragm is a breathing-in muscle (FACTS 14) | continuous | Figure |
| 6d  | 118.93-127.90 (b12) | as above | On "big breath," (119.79) the figure breathes in fully (119.79 to 121.00) and stays full; "breathing in" leaves. On "quiet note." (121.95) the strip's envelope draws in at a low, even height, left to right (0.6 s), the note under way. On "Must your body" (122.81) "PREDICT" (mono 26 px, ink-2) lands in the top lane; on "push the air out," (124.11) the pill "Push it out" and on "hold it back?" (126.26) "Hold it back" land beside it (x 920 to 1420, frame-fixed) | Step 2's predict, before anything says what the diaphragm can't do | continuous | Figure full, strip, pills |
| 6e  | 127.90-130.25 (predict2) | as above | A ring timer right of the pills over 2.0 s; the pad swells. As the gauge opens, Merc's line in the small band fades (127.95 to 128.25), leaving the band empty for the note to draw in **[v3: 11]**. **The gauge's first stage** (BRIEF: its labels build up in stages): the strip opens out sideways and upward into the gauge's frame (127.95 to 129.35, power2.inOut), its violet envelope fading as the frame's chrome outline and time axis draw; the frame opens round the "ILLUSTRATION" chip, its top edge rising behind the chip in the opening's last 0.2 s (about 128.97 to 129.18, the chip drawn above the stroke) and settling 9 px above it, the chip now inside the frame's top right, 9 px in from its right stroke **[v3: 3]**; "one 10-second note" lands under the axis (128.40); "push of air (not pitch)" with its small up arrow lands over the frame's left end (128.85, 0.45 s later). The cursor stands at the frame's left edge. Two labels in 2 s, one after the other **[v2: 5]** | The gauge's frame and what its height means, before any line | continuous | Gauge frame, figure, small band |
| 6f  | 130.25-140.25 (gauge) **signature 2** | slow push in (sine.inOut, over the whole 10 s) from F0 to F-gauge: the gauge and small band grow 5 % about the gauge's centre, the staves and bokeh part behind; the floor and both hosts' reflections stay at y 840 with the hosts, in screen space (HANDOFFS § Shared formulas) **[v3: 6]** · Merc sings (arcs on); Tavi idles, turned to the gauge · this push does not come back: it ends on the matched cut at o8 (178.83) | Merc sings A3 for 10 s; no one speaks. One chrome cursor runs across the small band and the gauge at the note's own pace (passing behind the "ILLUSTRATION" chip from about 137.1 to 140.1, as it passes behind the readout) **[v3: 3]**. In the small band Merc's amber line draws behind it, steady at the centre, the whole way. In the gauge, **in stages, never together**: 0 s, the falling chrome line draws behind the cursor and "the lungs' own push" lands at its start (130.45); 1.0 s, the gold line "what the note needs" draws across the whole frame (131.25 to 131.85) and its label lands under its left end, x 776, baseline 640, 34 px under the line (131.55); 2.0 s, the region between the two, behind the cursor, fills with a fine chrome hatch and "held back" lands in it (132.25); 2.5 s, "Now: holding back" lands over the frame's right end (132.75); 3.5 s, "Hold it back" gets its ink check and "Push it out" dims (133.75), then the pills and "PREDICT" leave (134.25 to 134.55); 5.0 s, "the note: unchanged" lands over the small band (135.25); **7.0 s, the cursor crosses the gold line**: "Now: holding back" turns into "Now: adding" (137.25, a label switch made as a swap: the old words leave in 0.1 s before the new land in 0.15 s, never glyph on glyph) and the region behind the cursor fills with the other hatch; "added" lands inside its hatch 0.45 s after the switch (137.70), once its region shows, with no leader (DECISIONS 144, [kit-01: 2]) **[B-01: 183]**. The figure's lungs empty slowly with the cursor and its dome rises back; after the crossing the belly wall moves in a little as the belly and rib muscles take over the pushing (Q27, FACTS 17). The cursor reaches the end as the note stops **[v2: 0, 4, 5]** | The note holds while the breath's work changes, heard before it is explained (FACTS 93) | continuous | The whole Quiet gauge |
| 6g  | 140.45-144.96 (b13) | MWS · F-gauge, static | On "Hold it back," (140.45) the held-back hatch lights to 40 % chrome and back (counted). On "breathing muscles," (142.61) the figure's ribs and dome glow and "with your breathing muscles," lands under the figure (from screen x 213, baseline 815); on "never your throat." (143.47) "never your throat" lands under it (baseline 855; Outfit 600 32 px, ink) | Step 2's reveal, how to hold back (FACTS 32) | continuous | Gauge, figure |
| 6h  | 144.96-156.90 (b14) | as above | On "Full lungs" (144.96) the cursor glides back to the start (0.4 s) and the figure's lungs fill again; on "spring back" (145.83) a light runs down the falling line from its start (1.0 s) and the lungs' outline pulls in once; on "harder than a quiet note needs." (147.98) the held-back region lights. On "So at first" (150.57) the cursor walks silently from 0 to 3.5 s (150.57 to 156.00, sine.inOut), the readout back to "Now: holding back"; on "breathing-in muscles" (152.29) the dome glows; on "holding" (154.02) "held back" scales 1.2 | Full lungs push by themselves (FACTS 17, 18) | continuous | Gauge, figure |
| 6i  | 156.90-165.39 (b15) | as above | b13's two labels leave (156.90). On "As the air goes," (157.33) the cursor runs on to 8.5 s (157.33 to 158.60) and the lungs empty with it, the readout switching to "Now: adding" at the crossing (a swap, **[B-01: 183]**); on "belly and rib muscles" (159.06) the belly wall moves in a little and the belly and ribs glow, "belly and rib muscles" lands under the figure, and the added region lights. On "can't push air out." (163.37) a solid chrome arrow draws from the dome up into the lungs (163.37 to 163.67) and an ink strike draws across it (163.80 to 164.10); "can't push air out" (Outfit 600 30 px, ink) lands left of the torso with a leader to it: right-aligned world x 350, baseline 580, about 270 px wide, so at F-gauge it spans screen x 24 to 308 (36 px would have run off the left edge) and stands 29 px over "diaphragm" **[v3: 9]** | Step 2's reveal, ending on what the diaphragm can't do (FACTS 15, 17) | continuous | Gauge, struck arrow |
| 6j  | 165.39-170.34 (o7) | as above | Tavi talks; Merc listens. The struck arrow, its label and "belly and rib muscles" fade (165.40 to 165.70). On "full lungs push by themselves," (165.72) the cursor glides back to the start and the lungs fill; the falling line's first stretch glows; on "hold some back." (168.96) the held-back region lights and "held back" scales 1.2. The cursor and readout fade at 170.10 | Her re-explanation (Step 2's own) | continuous | Gauge, figure full |
| 6k  | 170.34-178.83 (b16) | as above | On "Yes." (170.34) "one 10-second note" leaves (170.34 to 170.54) and two chips, "Quiet" (lit) and "Loud", land stacked just outside the frame's top right (left-aligned world x 1652, centred y 320 and 372; Outfit 600 30 px in 40 px outlines): 12 px from the frame's right stroke and from each other, 22 px from the "ILLUSTRATION" chip inside the frame **[v3: 9]**; on "loud note" (171.63) "Loud" lights and "Quiet" dims, "held back", "added" and "what the note needs" fade, and the gold line rises (172.06 to 172.86, power2.inOut) so the crossing moves from 7 s to 3 s and both hatches redraw; on "less holding back at first," (172.92) "less holding back at first" lands in v1's slot under the frame's left end (x 760, baseline 765; free since "one 10-second note" left at 170.54) with a 1.5 px leader straight up at x 900 into the now small held-back region, ending at (900, 430), 30 px under the falling line and 24 px over the gold line **[v3: 1]**; on "back" (173.79) "what the note needs" lands again, for Loud, above the gold line's right end (right-aligned 1630, baseline 440), on empty ground 12 px over the line: left where Quiet had it (x 776 to 1061, baseline 520 once risen), it would stand across that leader **[v3: 1]**; on "more adding" (175.51) "more adding as the air runs low" lands under the frame's right end (right-aligned 1640, baseline 805), 25 px right of "less holding back at first" and 12 px lower, with a leader up into the large added region, which lights. Both stay through the cut until 7a fades them (178.90 to 179.40) **[v2: 4]** | Both halves of FACTS 19 (94) | matched cut on o8 (178.83) | Loud gauge with its chips, small band, figure, on F-gauge's pixels (HANDOFFS § S6 to S7) |
| 7a  | 178.83-182.27 (o8) | MWS · **F0 from the cut**: S7 opens with the gauge, the small band and the figure on the pixels F-gauge gave them, so the subject holds and only the faint room cuts back to rest (no pull) · hosts at 240 | Tavi talks. The gauge's hatches, lines, chips and labels fade (178.90 to 179.40), its "ILLUSTRATION" chip with them: it has tagged the toy and then the gauge since 106.20 and leaves with the gauge, because the band's glide back down would cross any place it could keep; the reassembled chart is bare (Merc's band and line, and the strip's resting envelope in ghost violet rather than a bare hairline **[B-01: 184]**) until the pushed take redraws with its own chip (184.00) **[v3: 3]**. The gauge folds back into a strip, and the strip and the small band glide back together into the chart, reassembled at the frame's middle: plot x 400 to 1520, band centre y 470 at 2.5 px a cent, strip centre y 700 (179.00 to 180.40, power2.inOut). The figure dims to 35 % and shrinks to its parked place at the card's left, x 215 to 320, y 190 to 460 (179.00 to 180.00). "COMMON MIX-UP" lands as the kicker at (120, 110) (179.48); on "pushing hard," (180.77) her belief lands under it as a guess, "'support' means pushing hard, or squeezing" (Outfit 600 44 px, ink, x 360, baseline 180, a dashed ink-2 underline and a "?"), its last word on "squeezing?" (181.75). No visit of the four words here (v1's lit nothing new) **[v2: 0, 3, 7, 11]** | The mix-up card's belief, as her question | continuous | Row 0, the reassembled chart, the parked figure |
| 7b  | 182.27-187.36 (b17) | MWS · F0, static · the card's rows from x 360, its evidence drawn large below them, then small at the right column (x 1180 to 1640) | On "mix-up." (183.57) "COMMON MIX-UP" scales 1.08. **Evidence 1, large**: on "Pushing" (184.00) "ILLUSTRATION" lands under the strip's right end and the pushed take redraws over the whole plot, silent, at 2.5 times its speed (184.10 to 185.70): a second in the band, then the strip swelling under it while the wavy line climbs out of the top of the band (50.9 px a cycle, 70 px peak to peak), the band's edge going dark as its centre leaves, its peak 56 px under row 0. It holds whole (185.70 to 186.20; 0.5 s on every clock: where a clock is shorter the redraw runs faster, never the hold shorter **[B-01: 180]**), then **shrinks into its row** (186.20 to 186.80, power2.inOut; 0.41 times, about (1180, 310)): the chart lands at x 1180 to 1640, y 212 to 427 (its wave 20.9 px a cycle, 28.7 px peak to peak), and row 1 lands beside it as it arrives, "push harder: louder, and higher" (Outfit 600 40 px, x 360, baseline 300) with "ILLUSTRATION" under it (186.80) **[v2: 3]** | Evidence 1, as you heard (FACTS 7, 8) | continuous | Row 1 and its miniature |
| 7c  | 187.36-198.06 (b18) | as above | On "Squeezing" (187.36) row 2's first line lands, "squeeze: a pressed sound," (x 360, baseline 490). **Evidence 2, large**: on "pressed sound," (189.52) two level strips draw side by side right of it under one push of air (189.52 to 190.32): a chrome bar across both with a drop to each, "one push of air" over it, "easy" x 860 to 1200 at a tall envelope (half-height 110), "pressed" x 1260 to 1600 at a short one (half-height 28), centred y 680, each named under it; "same push: much quieter" (x 360, baseline 580) lands with them (189.52), the strips' finding, part of that one landing; on "heavy," (192.97) "pressed" scales 1.08; on "more air pressure," (195.55) "more pressure, not less" lands where it is said (x 360, baseline 535), between the two **[v3: 11]**. No numbers, no sound (FACTS 95). On "not less." (196.50 to 197.10) the pair **shrinks into its row** (0.5 times): the strips land at x 1180 to 1350 and 1380 to 1550, y 452 to 575, "one push of air" fading, the names set again at 26 px under them (197.10) **[v2: 3]** | Evidence 2, seen | continuous | Row 2 and its miniature |
| 7d  | 198.06-206.32 (b19) | as above | The four words return (197.55) and '"support"' lights on '"Support"' (198.06). **The word, large**: '"support"' (serif italic 160 px, ink) lands in the empty lower third (x 360, baseline 800, 198.06); on "word for how" (199.35) "how singers manage the breath" (Outfit 600 44 px) lands beside it (x 980, baseline 800); on "no one agreed" (204.09) "no one agreed meaning" (Outfit 600 36 px) under that (x 980, baseline 850). The four words leave at 202.20. The large word and its phrases **shrink into row 3** (205.20 to 205.80): '"support": how singers manage the breath' (Outfit 600 40 px, x 360, baseline 655) and "no one agreed meaning" (baseline 700) **[v2: 3, 5]** | What "support" names (FACTS 24a, 25) | continuous | Row 3 |
| 7e  | 206.32-216.35 (b20) | as above | "The better idea:" (Outfit 600 30 px, ink-2, x 360, baseline 760) lands on "A steady" (206.32); then its four phrases land as said, separated by middots (Outfit 600 40 px, baselines 810 and 855): "steady air, not more of it" (208.04), "breathe in low" (210.63), "start easily" (211.92), "let it flow out unforced" (214.51). On "breathe in low" (210.63) the parked figure comes to full and breathes in once, slowly (210.63 to 212.13): the dome flattens, the belly moves out; it eases back and dims again (212.20 to 213.00). As this row lands, rows 0 to 3 dim to ink-2 (4.5:1 or better), and the row is set large in the empty lower right (x 1180 to 1700, one phrase to a line, above the floor horizon by 12 px or more), so the card ends on its payoff, not a slide; the coach signs off its words (LAB-CHECKS 22) **[B-01: 185, 188]**. From 215.85 the rows leave up fast, 0.05 s apart, and the miniatures fade (215.85 to 216.25), leaving the room, the hosts and the dimmed figure **[v2: 3, 7]** | The hook answered in the page's words (FACTS 10) | cut on act3 (216.35) | The dimmed figure at its parked place, hosts at 240 (HANDOFFS § S7 to S8) |

### Chapters 3, 4 and 5 [C]

| #   | Time (cues) | Shot line | On screen | For | Out | Carried |
| --- | ----------- | --------- | --------- | --- | --- | ------- |
| 8a  | 216.35-218.70 (act3) | full-frame type over the dimmed figure · hosts at 240, idle | The figure stays dimmed at its parked place (x 215 to 320, y 190 to 460), carried from S7 (HANDOFFS § S7 to S8); card "03 Breathing in" in from 216.72, out 218.20 to 218.58, over it. Nothing changes shape under the card **[v2: 7]** | Chapter breath | continuous | Dimmed figure |
| 8b  | 218.70-220.52 (o9) | MWS · F0, static · centre: the figure stands on the floor line, x 820 to 1100, hosts small at the edges | Kicker "03 · BREATHING IN" (218.70). The breath figure comes back to full and **stands up whole** (218.75 to 219.95, power2.inOut, an object move): from its parked torso it moves to the frame's centre and grows from 0.5 to 0.7, its legs and knees drawing down from the hips as it lands (219.40 to 219.95), feet on the floor at y 840: chapter 2's torso, now whole. On "breathe in?" (219.67) its lungs' outline glows. Tavi talks **[v2: 7]** | Step 3's heading, as her question | continuous | Whole figure |
| 8c  | 220.52-229.06 (b21) | as above | On "tall" (220.96) a chrome arrow draws up the figure's back from heel to crown (0.5 s) and "tall but easy" lands left of the head; on "knees" (224.40) the knees soften 2 degrees and back and "knees unlocked" lands left of them, right-aligned x 907 (v2: 950, across the back arrow at x 925), 16 px clear of the arrow's 3 px stroke; its leader runs on to the knee, crossing the arrow **[v3: 9]**; on "jaw," (226.13) the jaw line drops 4 px and a light runs down the neck, and "jaw · tongue · neck loose" lands right of the head. Each label is Outfit 600 36 px, ink, a world label with a 1.5 px chrome leader to its part | Step 3's posture cues, as instructions (FACTS 28) | continuous | Figure, three cues |
| 8d  | 229.06-237.37 (b22) | MWS · F0, **static** (v1's push onto the chest and pull back are gone: the figure's own breath is the motion) | On "breathe in quietly," (229.93) "breathe in quietly, low" lands left of the lungs; on "let the breath drop low," (231.22) the figure breathes in once, slowly (231.22 to 233.22): the dome flattens and lowers, the belly moves out, and "diaphragm at work" lands right of the belly with a leader to the dome (232.51; FACTS 29); on "shoulders still," (233.37) "shoulders still" lands above the shoulder beside a short level mark, and the shoulders do not move; on "taking as much" (234.24) "as much as feels easy" lands right of the figure; the figure breathes out, slowly (234.30 to 236.30), the belly wall moving back in (FACTS 17); "Singers breathe in different ways." (serif italic 48 px, ink) lands bottom right (234.80, 0.56 s after; FACTS 30). No ring, no count, nothing asks the viewer to breathe along (DECISIONS 12) **[v2: 0, 5]** | The breath in, as instructions only (FACTS 32) | cut on act4 (237.37) | Figure with its cues (HANDOFFS § S8 to S9) |
| 9a  | 237.37-239.72 (act4) | full-frame type over the dimmed figure | The figure dims to 25 % and its labels hide (237.52 to 237.72); card "04 Starting a note" in from 237.89, out 239.22 to 239.60. The figure is not brought back to full: it stays at 25 %, its cue labels gone, and leaves from dim in 9b **[v3: 5]** | Chapter breath | continuous | Dimmed figure |
| 9b  | 239.72-248.79 (o10, b24) | MWS · F0, static · the folds left, the trace strip right | Kicker "04 · STARTING A NOTE" (239.72). On "how should" (240.05) the dimmed figure fades from 25 % to nothing (240.00 to 240.40) while a small chrome ring at its throat, at full strength, grows into Lesson 3's vocal folds seen from above (240.00 to 240.90) **[v3: 5]** and slides to the left place (240.40 to 241.40, power2.inOut), "vocal folds, from above" (Outfit 500 28 px, ink-2) landing under them as they arrive (241.40); the trace strip draws in at the right (241.85 to 242.45): a hairline 1.6 s long with the "ILLUSTRATION" chip over its right end. The four words return (244.20) and "onset" lights on "onset." (244.61), leaving at 248.40; the strip's title "onset: how a note starts" lands over its left end (245.05); on "three main ways." (246.33) three chips land under the strip, 0.4 s apart, "Air first" (246.33), "A catch" (246.73), "Together" (247.13), and each scales 1.08 on "Just listen." (247.62) **[v2: 5]** | Name the onset; three ways, for listening | continuous | Folds, strip, chips |
| 9c  | 248.79-256.64 (b25, start-air) | as above | On "Air first:" (248.79) its chip lights and the strip's title becomes "Air first" (a label switch); the folds draw apart, a chrome arrow of air rising between them. start-air (254.74): the strip draws as it sounds, its head moving at the sound's pace: a layer of fine chrome dots (air, no note) for 0.35 s, then the wave grows under it from 0.25 s (FACTS 80); as the wave grows the folds close into vibration (the gap narrows and shimmers ±3 px). "air, no note" lands under the dots (255.30) | Air first, heard and drawn | continuous | Trace 1 |
| 9d  | 256.64-267.51 (b26, start-catch) | as above | On "A catch:" (257.07) trace 1 fades and the title switches to "A catch", with "LISTEN ONLY" landing beside it (257.50); on "pressed shut," (259.23) the folds close with a heavier stroke, no gap. start-catch (265.61): 0.15 s of nothing, then a short ink mark the strip's height at the click, then the wave at full height at once; the folds snap open into vibration at the mark; "the catch" lands under the mark (265.90) **[v2: 5]** | A catch, for listening only | continuous | Trace 2 |
| 9e  | 267.51-275.41 (b27, start-together) | as above | On "Or together:" (267.94) trace 2 fades, the title switches to "Together" and "LISTEN ONLY" leaves; on "meet" (269.23) the folds move from apart to a slit. start-together (273.46): the wave starts and grows smoothly, no dots, no mark, and a gold tick (4 px, 40 px tall) lands on the strip at the onset, where air and sound begin at once | Together; gold for the fit | continuous | Trace 3, gold tick |
| 9f  | 275.41-287.07 (b27a, starts) | MWS · F0, **static** · hosts at 240 · **the strip moves, not the camera** (v1's pull to F-stack is gone) | The title and chips leave (275.45). The strip becomes a stack of three in one object move (275.50 to 276.70, power2.inOut): trace 3 slides down to the third row (centre y 650), two empty rows open above it (centres 250 and 450), and the folds shrink to the top left (x 160 to 330, y 110 to 280); the row labels land right-aligned to x 670, 0.4 s apart, "Air first" (275.50), "A catch" (275.90), "Together" (276.30); the strip's "ILLUSTRATION" chip rides up with the move to centred y 150 (right-aligned 1600: x 1329 to 1600, y 130 to 170), off row 1, whose envelope starts 10 px under it at y 180 **[v3: 3]**. On "the puff," (278.43), "the click," (279.72) and "neither." (280.59) each row's label scales 1.08 in turn. starts (281.37): "LISTEN ONLY" lands as the sound starts, the catch being in it (right-aligned 1600, centred y 350: x 1350 to 1600, y 330 to 370, beside row 2's right end, 10 px over its envelope and 10 px under row 1's), and stays until the stack leaves **[v3: 3]**; the three play back to back 0.2 s apart and draw on their rows in turn, each row lighting as it plays (rows 1, 2, 3 empty and redrawn), the folds showing each start's state; then the dots of row 1 are circled in chrome, "the puff" (283.20); row 2's mark circled, "the click" (285.00); and for row 3 nothing to circle, "neither" (286.70) **[v2: 0, 5]** | Compare the three, back to back (FACTS 96) | continuous | Stack |
| 9g  | 287.07-300.98 (b28) | WS · F0, static | On "the third," (291.38) row 3 lights and rows 1 and 2 dim their strokes (their labels stay ink); on "the easy start." (292.24) "the easy start" (Outfit 600 40 px, ink) lands between rows 2 and 3 and the gold tick scales 1.2; on "soft 'h'," (296.55) a faint "h" (serif italic 120 px, ink-2 at 40 %) appears over row 3's start; on "only in your mind." (298.71) it fades over 1.2 s and "the h, only in your mind" lands under row 3 | Many teachers aim for the third (FACTS 39); the h, kept in mind | cut on act5 (300.98) | Stack at F0 (HANDOFFS § S9 to S10) |
| 10a | 300.98-303.33 (act5) | full-frame type over the dimmed stack | The stack and the small folds dim to 25 % (301.13 to 301.33), their names, circles, labels and both chips hidden while dim; card "05 A steady note" in from 301.35, out 302.83 to 303.21. The stack is not brought back to full: it leaves from dim, up fast, 303.10 to 303.40, as the card clears and o11 starts (303.33), so nothing of it is left when the chart starts to fade in (303.40) **[v3: 5]** | Chapter breath | continuous | Stack, dimmed and leaving |
| 10b | 303.33-310.72 (o11, b29) | push in (303.40 to 304.90, power2.inOut) from F0 to F-hold (1.3x), the room parting as the chart arrives · Tavi at (1800, 840) and Merc at (110, 840), both back to 300 (303.40 to 304.00) | The stack and folds have left from dim by 303.40 (10a). **The chart fades in at a 4 s window** as the push starts (303.40 to 304.00, riding the push), and kicker "05 · A STEADY NOTE" lands 0.40 s after it (303.80). So from 303.65 to 304.10 the push moves onto the chart as it comes up (about 40 % at 303.65, full from 304.00), with both hosts growing back to 300 and the kicker landing: never onto an empty room **[v3: 5]**. The chart on screen at F-hold: Merc's band (y 416 to 644 at 2.5 px a cent) and amber line (y 530), plot x 232 to 1688, "A, any octave" in its label row (x 232, baseline 387), the "ILLUSTRATION" chip (right-aligned 1688), a time axis under the plot with a tick at each second and "0" and "4 s" (baseline 690), no level strip. On "A perfectly straight line?" (305.60) her guess: the same dashed ink-2 line as the cold open's, dead flat along the band's centre, x 232 to 1688 (305.93 to 306.58), its "?" landing right of its end (306.58); Merc's line fades to 0 under it **[A-01: 170]**. b29: Merc talks. **On "ten seconds." the window widens on screen** (309.46 to 310.26, power2.inOut): the second ticks pack in from 364 to 146 px apart, six new ones entering at the right end, "4 s" switches to "10 s" (309.46), and the band narrows with it (to y 484.5 to 575.5, 1.0 px a cent) so the wave to come keeps its shape (HANDOFFS § The wave rule) **[v2: 2]** | Her guess, the cold open's again (FACTS 86); the window, seen widening | continuous | Chart in hold mode at 10 s, dashed guess |
| 10c | 310.72-321.02 (demo) **signature 3, first half** | MWS · F-hold, static · Tavi sings (arcs on); Merc idles, turned to the chart | Tavi holds A4 for 10 s and her violet line draws as she sings: up from 60 cents low (y 608), through the page's hand-set wavers, into the band, then level with a small, even wave growing in (FACTS 80): 26.5 px a cycle, 36.4 px peak to peak. **The band's mint edge and "in the band" (x 544, baseline 387) light once, at 0.69 s into the take (311.41), and stay lit to the end**: FACTS 80's points touch the band at about 0.45 s and dip back out for 4 frames (under 0.1 s) before entering to stay at 0.69 s, and the picture does not show that touch and dip, so the light never flickers: a display choice (DECISIONS 96). Once her centre has stayed in the band 0.5 s (about 311.9), a chrome "settled" flag stands on the band's top edge where it entered (x 332), "settled" above it (baseline 455; no number; FACTS 80). As her line passes 2 s (312.70 to 313.20) the dashed guess and its "?" fade and Merc's line returns to full. The line is whole at 320.72 **[v2: 2, 6]** | A steady note settles, and is not straight | continuous | Tavi's finished line |
| 10d | 321.02-331.82 (o12, b30) | push in (324.60 to 326.10, power2.inOut) from F-hold to CU-scoop (1.8x), onto the first second · Tavi stays at 300 · **push-and-return 2, out** | o12: on "scooped," (321.34) the line's first second glows; on "waves." (322.32) a light runs along its held wave. b30: the time axis fades as the push starts (324.60 to 324.80; at 1.8x it would reach Tavi's corner); at CU-scoop the chart's own "ILLUSTRATION" chip is pushed out of frame (to x 2362 to 2850), so the first 1.5 s of her line fade and redraw at a third of their speed (326.20 to 330.70, silent) under one frame-fixed chip that says both, "SLOWED · ILLUSTRATION" (326.20; mono 26 px, 453 x 40, x 1110 to 1563, centred y 400): above the band from the slowed stretch's right end, 55 px right of "settled" (x 891 to 1055), 58 px under "in the band" and 37 px over the band's top **[v3: 3]**; on "a scoop." (330.61) "scoop" (Outfit 600 30 world px, 54 on screen, ink) lands under the low point (screen (834, 700)). At 1.8x the wave measures 36.7 px a cycle and 50.4 px peak to peak **[v2: 2]** | The scoop, seen slowly (FACTS 41) | continuous | Slowed first second |
| 10e | 331.82-340.74 (b31) | truck right at 1.8x (331.90 to 333.90, sine.inOut) from CU-scoop to CU-wave: the line passes under the camera from its scoop to its held wave, the staves sliding slower and the bokeh faster | "scoop" leaves as the truck starts (331.90 to 332.10), and so do "A, any octave" and "settled", which the truck would carry to the frame's left edge (they return after the pull, 342.00 to 342.66, staggered: 10f). "SLOWED · ILLUSTRATION" stays, frame-fixed, while the line passes under the camera: nothing passes under the chip (the band and line below y 457, "in the band" and the chart's chip above y 340, "settled" and its flag sliding away to the left), and it leaves as the truck lands (333.90 to 334.10), when the chart's own "ILLUSTRATION" has come into frame (x 1408 to 1896, centred y 304, 40 px over where the chip was) **[v3: 3, prev 5]**. On "small vibrato," (334.83) a chrome bracket marks the wave's height over the held part (screen x 1500, y 495 to 545) and "small vibrato: inside the band" lands above the band's right half (screen x 888, baseline 416); on "inside the band." (339.58) the mint edge glows and "in the band" scales 1.08 **[v2: 2]** | A small vibrato sits inside the band (FACTS 42) | continuous | Held wave at 1.8x |
| 10f | 340.74-350.09 (b32) | pull out (340.74 to 342.20, power2.inOut) from CU-wave to F-hold · **push-and-return 2, back** | The bracket and "small vibrato" leave as the pull starts (340.74 to 340.94); as it lands the three that left come back one at a time inside this row, the main one first: the time axis (342.00 to 342.20), "A, any octave" (342.25 to 342.45), then "settled" on "settles into the band" (342.46 to 342.66), as its flag scales 1.2 **[v3: prev 5]**; on "stays," (344.62) a chrome bracket draws along the band's top from the flag to the end (0.6 s) and "steady: settles into the band and stays" lands in the upper label row (x 232, baseline 322); on "comfortable, fixed length," (345.91) a bracket under the plot spans 0 to 10 s (y 712) and "a comfortable, fixed length" lands under it (centred, baseline 760). Nothing names a length beyond the frame's 10 s. From 342.20 to 353.84 the frame's lower half holds the scoop (to y 608), the axis (690), the bracket (712) and its label (760). Above the floor no band of 50 px stays empty for more than about 7 s anywhere in S10; the floor band itself, y 700 to 840, is empty from 304.9 to 324.6, and that is the floor, accepted (v2 said no band at all, which was wrong there) **[v2: 2]** **[v3: prev 2]** | What steady means (FACTS 44) | continuous | Chart |
| 10g | 350.09-353.84 (o13) | as above | Tavi talks; Merc listens. On "steady air" (351.06) her guess lands above the label rows, "steady air keeps it there?" (Outfit 600 40 world px, ink-2, a dashed underline and a "?"; screen x 232, baseline 257) | The overreach, as her guess (FACTS 86) | continuous | Guess label |
| 10h | 353.84-364.73 (b33) | MWS · F-hold, static · the hold frame slides to the right half (354.00 to 355.10, power2.inOut), where the turn will use it (screen px below) | On "No." (353.84) the guess fades (353.90 to 354.20), and Tavi's line, the flag, both brackets and the chart's labels fade with it (353.90 to 354.30), so her wave is never shown squeezed. The frame, now its band and Merc's line only, slides right and shrinks to the turn's place: x 1000 to 1640, band y 210 to 280 (1.0 px a cent, 64 px a second). The voice box draws on at the left (354.50 to 355.50; x 300 to 640, y 190 to 510): Lesson 3's folds from above inside a rounded outline, two small chrome muscle bands beside them; on "voice box" (355.56) "voice box" lands (x 300, baseline 170); on "set the note." (356.42) the muscle bands glow and "muscles here set the note" lands under the box (x 260, baseline 570); on "needs" (359.01) "a steady note needs steady air too" lands at the left (x 260, baseline 680). On "because" (360.73) the Push slider draws under the frame (track x 1000 to 1640, y 380), its thumb at 50; from 361.20 a silent violet line draws in the frame at a 6 s window (19.4 px a cycle, 28 px peak to peak) while the thumb never stops: 50 to 75 to 50 to 70 to 50 (361.20 to 364.30, each leg sine.inOut), the line rising 30 px and back with it (Push's rule, FACTS 73), "ILLUSTRATION" landing on the frame (361.65); on "moves it." (363.32) "a change in the air moves it" lands under the earlier line (baseline 740). **Never a still slider over a still line** (BRIEF): the line's head draws on the whole time. From 364.30 the slider, the line, the box and the type fade, leaving the empty frame **[v2: 2, 11]** | What sets the note; why a steady note needs steady air (FACTS 91) | matched cut on sing (364.73) | Empty frame at x 1000 to 1640, band 210 to 280 (HANDOFFS § S10 to S11) |

### Sing it and your turn [D]

The care block is frame-fixed, left-aligned at x 260, every line within x 260 to 960 and nothing
of it below y 864 (HANDOFFS § The turn). The hold frame and the ring are world drawings right of it
(x 1000 to 1640 at F0), so the push at 422.80 enlarges them; the feel answers are frame-fixed, x 1000
to 1660 **[v3: 4]**.

| #   | Time (cues) | Shot line | On screen | For | Out | Carried |
| --- | ----------- | --------- | --------- | --- | --- | ------- |
| 11a | 364.73-367.08 (sing) | full-frame type over the dimmed frame · F0 from the cut: the frame keeps its pixels and the faint room cuts back to rest · hosts at 300 in the corners | The empty frame dims (364.88 to 365.08); card "Sing it" (chrome serif italic 170 px, no numeral, centred, baseline 480) in from 365.10, out 366.58 to 366.96; the frame back to full **[v2: 0]** | Chapter breath before the voice's turn | continuous | Empty frame |
| 11b | 367.08-371.16 (b34) | MWS · F0, static · the care block left, the frame right | On "Your turn:" (367.08) "Your turn." (serif italic 110 px, ink) lands top left; on "comfortable note," (368.37) the frame's band glows; on "ten seconds." (370.10) a bracket draws under the frame, 0 to 10 s (y 292), with "0" and "10 s" under its ends (baseline 322; one object); "Nothing listens" (Outfit 600 30 px, ink, x 1000, baseline 402) lands under them (370.60) and stays to the end of the turn (FACTS 87) | The task, before any care line | continuous | Frame, title |
| 11c | 371.16-381.19 (b35, b36) | as above | On "care lines" (372.02) the doctor lines land at the block's foot in small type (Inter 30 px, ink-2, five lines, word for word; HANDOFFS), where they stay to the end of the turn. On "Sore," (377.40) the comfort line lands in bold beside the care icon (the app's own SVG): "Sore, hoarse or unwell today?" and, on "Just" (379.55), "Just listen along." under it (Outfit 700 36 px, ink) | Care first (FACTS 47, 48, 51) | continuous | Care block |
| 11d | 381.19-398.35 (b37) | as above | The six reasons in short land under the comfort line as Merc names them (Outfit 500 30 px, ink): "hurts or uncomfortable" (382.92), "unusually hoarse or tired" (387.23), "usual notes suddenly gone" (391.54), "ill" (393.26), "talking or singing is hard work" (394.56), in three lines joined by middots | The comfort check, all six (FACTS 49) | continuous | Care block |
| 11e | 398.35-402.58 (b37a) | as above | On "Listening along?" (398.35) the ring draws on under the frame (398.40 to 399.20: centre (1320, 590), r 160, a chrome circle 10 px wide at 35 %, its 12 o'clock tick, no counter yet); on "Rest your voice" (399.22) "listening along: rest your voice and watch the ring" lands in the block; on "the ring." (401.37) the ring scales 1.05 once | The listener's place in the turn (the lead's line) | cut on b38 (402.58) | Care block, ring, frame (HANDOFFS § S11 to S12) |
| 12a | 402.58-406.66 (b38) | as above | On "my A," (403.45) "A3 · Merc" (a blue dot before it; x 1000, baseline 362) lands under the bracket and Merc's amber line glows; on "an octave up." (405.17) "A4 · Tavi, an octave up" (an orange dot; from x 1186) lands beside it | The voice choice, in one line | continuous | Voice labels |
| 12b | 406.66-420.86 (b39, b40) | as above | Under the ring, "Listen · Breathe · Sing" lands (mono 28 px, ink-2, baseline 790) and each word lights to ink as Merc says it: "Listen" (406.66), "Breathe" (408.39), "Sing" (410.97); on "at about speaking volume." (412.70) "at about speaking volume" lands under them (baseline 828). b40: on "ring closes," (416.78) the ring's 12 o'clock tick brightens; on "stop sooner" (418.07) "stop sooner if you need to" lands under the last label (baseline 864) | The page's briefing, its three phases | continuous | Ring and its labels |
| 12c | 420.86-424.04 (b41) | as above, then **push in (422.80 to 423.90, power2.inOut) from F0 to F-turn (1.4x)**: the frame and the ring grow onto the right half, the staves and bokeh part behind; it has landed 0.14 s before `listen` and "Listen" (424.04); b41's gap stays 0.2 s, the clock unchanged · this push does not come back: it ends on the matched cut at recap (478.09) | On "Stop" (420.86) the stop line lands in the block, carried whole: "Stop immediately if anything / feels uncomfortable." (Outfit 600 36 px, ink, two lines, baselines 548 and 590). Before the push (422.30 to 422.60) the care icon and comfort line, the reasons and the listening line fade, and the phase row and its two lines under the ring leave up fast in the same window. **Kept on the left, frame-fixed: "Your turn.", the stop line, and at its foot the doctor lines in small type** (the brief keeps the care lines to the end of the turn; DECISIONS 89, 121). "Your turn." (x 260, baseline 200; about x 260 to 755, y 123 to 200) does not fade at the push: it stays through the viewer's ten seconds and fades with the ring, its word, the counter and the playhead (438.60 to 439.00), so the top left is never blank. Nothing meets it: the frame at F-turn starts at x 928 (173 px to its right) and its labels at 928 too; the ring at x 1152; Merc's body ends at x 190 and starts at y 648 (his arcs at about x 225: 35 px across, and 448 px below its foot); "How did that feel?" lands at x 1000, baseline 480, only from 439.00, when it has gone. As the push lands (423.90) the frame spans x 928 to 1824 with its band y 104 to 202, and the ring stands at (1376, 636), r 224 (x 1152 to 1600, y 412 to 860); "A3 · Merc", "A4 · Tavi, an octave up" and "Nothing listens" ride it (screen baselines 317 and 373) **[v2: 1]** **[v3: 4, 7]** | The stop line, before any singing (FACTS 50); then the turn gets the frame | continuous | "Your turn.", stop line, small doctor lines, frame and ring at F-turn |
| 12d | 424.04-428.20 (listen, b42, breathe) | MWS · F-turn, static · both hosts sing (arcs on both) for listen only | listen: "Listen" lands inside the ring (424.04; 56 px on screen, centred, baseline 577); Merc and Tavi sing their A together (FACTS 80); "A3 · Merc" and "A4 · Tavi" each scale 1.08, the frame's band brightens. b42: "Listen" switches to "Breathe" (426.14); "Breathe in, low and quiet" (Outfit 600 28 world px) lands right-aligned to the frame's right end on the "Nothing listens" line (screen right edge 1824, baseline 373) on "in," (426.57): the two share a baseline and stand 70 px apart on screen, never one over the other; the ring breathes once, growing to 1.08 and back (426.10 to 428.10, sine.inOut); nothing counts down **[v2: 1, 4]** | Merc's note in both octaves, then one breath | continuous | Ring |
| 12e | 428.20-438.30 (tick-in, hold, tick-out) **signature 3, second half** | MWS · F-turn, static · both hosts idle, turned to the ring, no arcs, never `listen` | At the first tick (428.10) "Breathe" switches to "Sing", "Breathe in, low and quiet" leaves (428.10 to 428.30), and the ring starts to turn: its chrome arc fills clockwise from 12 o'clock at an even pace and closes at the second tick (438.20); inside it a counter (112 px on screen, tabular, baseline 706) fades in at "0" (428.50) and counts the seconds, 1 to 10, each change a 0.15 s switch (429.20 to 438.20); a chrome playhead (3 px, the band's height) sweeps the frame's 10-second window in step, 89.6 px a second across 896 px. No violet line, no reading, no microphone: the frame stays empty but for the playhead. Room tone only. At the second tick the ring closes and sends one chrome echo ring **[v2: 1, 5]** | The viewer's ten seconds; nothing listens (FACTS 87, 97) | continuous | Closed ring, frame |
| 12f | 438.30-445.38 (b43, feel) | as above | The ring, its word, the counter, the playhead and "Your turn." fade (438.60 to 439.00) **[v3: 7]**. On "How did that feel?" (439.00) "How did that feel?" (serif italic 64 px, ink, frame-fixed, x 1000, baseline 480) lands where the ring was, and its four answers land under it as capsules on their words: "Easy" (440.73), "Workable" (441.16), "Effortful" (441.59), "Uncomfortable" (442.45). feel: a small ring timer beside the question; the pad swells | The feeling question, the page's labels (FACTS 52) | continuous | Four answers |
| 12g | 445.38-459.80 (b44, b45, b46) | as above | Each answer lights as Merc names it, the one before dimming its capsule's stroke (its label stays ink): "Easy" and "Workable" (445.38) with a bracket joining them to "rest a few easy breaths" (on "Rest", 446.68); "Effortful" (449.61) to "rest before you sing again" (451.34); "Uncomfortable" (453.84) to "enough singing for today" (456.43) | What each answer leads to | continuous | Answers and their lines |
| 12h | 459.80-478.09 (b46a) | as above | On "Whatever you chose:" (459.80) all four answers light together; the stop line fades (459.85 to 460.25) and the doctor lines rise and grow to full size (Inter 40 px, ink, six lines at baselines 430 to 680 within x 260 to 960, re-broken as a cross-fade rising 12 px, 460.00 to 460.80), held while Merc says them, clear of the frame's labels (on screen right of x 928 and above y 373 only) and of the answers (right of x 1000); on "see a doctor" (465.83) its words underline in chrome; on "get help straight away." (475.31) its words underline. From 477.10 every mark of the turn fades but the frame's band and Merc's line (477.10 to 477.60) **[v2: 1]** | The doctor lines, for every answer, full size while said (FACTS 51) | matched cut on recap (478.09) | The frame on F-turn's pixels, x 928 to 1824, band 104 to 202 (HANDOFFS § S12 to S13) |

### Recap, practise, next time, end [E]

| #   | Time (cues) | Shot line | On screen | For | Out | Carried |
| --- | ----------- | --------- | --------- | --- | --- | ------- |
| 13a | 478.09-484.78 (recap, b47, b48, q1) | MWS · F0 from the cut: the frame keeps F-turn's pixels and the faint room cuts back to rest · the panel top left, the object right, the frame low, hosts at 300 in the corners | **The frame moves, not the camera**: from x 928 to 1824, band 104 to 202, it slides down and widens to its recap place, x 232 to 1688, band 554.5 to 645.5 (478.20 to 479.40, power2.inOut), then dims its strokes (479.40 to 479.70), stepping aside under everything the recap draws. Kicker "QUICK CHECK" (478.24). On "What is" (479.75) the card panel lands (x 120 to 960, y 140 to 330) with "What is your diaphragm's main job?" (Outfit 600 40 px, ink); the breath figure's torso draws on at the right (480.50 to 481.30; x 1262 to 1420, y 105 to 500, 54 px above the dimmed band). q1: a ring timer in the panel; the pad swells **[v2: 0, 4]** | Recap question 1 (FACTS 88) | continuous | Panel, figure |
| 13b | 484.78-486.00 (b49) | as above | On "Breathing" (484.78) the dome flattens and the belly moves out (484.78 to 485.98), and "Breathing in." (serif italic 64 px, ink, x 150, baseline 400) lands under the panel | Answered by the object that taught it | continuous | Figure |
| 13c | 486.00-497.85 (b51, q3, b52) | as above | The panel's line switches to question 3 in two lines (486.00); the figure fades (486.00 to 486.40) and the three traces stack in at the right as chapter 4 left them, smaller, with their names (486.45 to 487.15; x 1180 to 1640, centres y 200, 320 and 440, clear of the dimmed band by 69 px). q3: ring timer. On "together:" (495.77) row 3 lights and its gold tick scales 1.2, rows 1 and 2 dimming their strokes; "Air and sound starting together: the easy start." (serif italic 56 px, two lines, baselines 392 and 452) lands under the panel **[v2: 4, 5]** | Question 3, answered on the traces | continuous | Traces |
| 13d | 497.85-508.24 (o14a, q4, b54) | as above · Tavi asks from her corner | The panel switches to question 4, Tavi's (497.85); the traces fade and the frame comes back to full with its labels, "A, any octave" (x 232, baseline 510) and "ILLUSTRATION" (right-aligned 1688) (498.30 to 498.90). q4: ring timer. On "settles" (504.93) Tavi's line from chapter 5 redraws in the frame, silent, in 2.4 s (504.93 to 507.33): the scoop, the wavers, the band, its small wave, at the frame's own scale (1456 px for 10 s, 1.3 px a cent: 26.5 px a cycle, 36.4 px peak to peak, as in 10c). **The mint edge and "in the band" (x 520, baseline 510) light once, at the line's 0.69 s (505.10), and hold**; the "settled" flag stands (505.21). On "band" (506.21) "It settles into the band / and stays there." (serif italic 56 px, baselines 392 and 452) lands under the panel **[v2: 2, 4, 5, 6]** | Question 4, answered by her own line | continuous | Frame with her line |
| 13e | 508.24-519.09 (b55) | MWS · F0, static · the Voice Mirror card left, x 230 to 1110 · Merc hops twice across the empty floor, (110, 840) to (700, 840) (508.85 to 509.40) and on to (1290, 840) (509.50 to 510.05), to stand under where the tune will be; since DECISIONS 190 the pair falls in a silent beat (`break`) before b55, the clean break on the beat's start, and "Practise it." starts after he lands **[lead: 190]** | **A clean break**: on "Practise it." (508.24) the kicker, the panel, the answer, the frame and its line leave up fast in turn (508.30 to 508.80). Then the card builds under its own name, its rounded panel (chrome 25 %) growing down as its rows land (each 0.3 s, power2.out; 300 px tall while Merc is in the air, its foot at y 300): the panel and "Practise it." (508.85); "Voice Mirror" (serif italic 96 px, ink, baseline 250) with a rule under it (509.25); then b55's sentence, word for word, in three rows, each after its glyph (Outfit 600 34 px, ink): "Voice Mirror has you glide up and down," (510.83; a glide glyph), "hold any comfortable note for six seconds," (512.55; a held-line glyph), "then sing back five notes it plays." (515.57; five dots); on "plays." (518.16) the hold's readout, type only and word for word: "For the hold, it shows in cents how fast the note drifted and how much it wobbled, and a vibrato isn't counted against you." (Inter 32 px, three lines). Its six seconds never stand beside the film's ten: the frame left 3.75 s before **[v2: 4, 9]** | The practise card, word for word (FACTS 89) | continuous | Card |
| 13f | 519.09-528.01 (b56) | as above | "Keep the glides comfortable." (519.09); "Sore, hoarse or unwell today? Just listen along." (520.81); "Free, no account: mercurypitch.com/mirror" (Outfit 600 40 px, 524.26), its address underlined in chrome on "mercurypitch" (525.55); as b56 ends (527.40), under the card, type only and word for word, in two lines (so it ends near x 800, far from Merc): "Ten minutes, gently, most days." / "Missed a day? Just come back." (Inter 34 px, ink-2, baselines 822 and 862) **[v2: 4, 9]** | The card's lines, each on its word | continuous | Card complete |
| 13g | 528.01-540.47 (b58, card) | as above · the rest card right, x 1130 to 1690, y 250 to 600 (28 px above Merc's keep-out) | On "Felt uncomfortable," (528.01) the rest card's panel lands right with b58's question, word for word: "Felt uncomfortable, or listened / along today?" (Outfit 500 28 px, ink-2); "Rest today" (serif italic 72 px, 530.59); "Voice Mirror will be here when / your voice feels comfortable:" (Outfit 500 30 px, two lines, 531.46); "mercurypitch.com/mirror" (Outfit 600 36 px, 535.77), underlined; no "Ten minutes" line. card: 2 s with no voice, both cards drifting up 14 px (sine.inOut), the hosts idle. From 539.60 the cards' lines leave up in turn, 0.03 s apart, and fade, while the first of the "five notes" glyph's dots brightens, grows into a 20 px chrome bead and glides to the tease's first place (539.70 to 541.30, power2.inOut), across the cut, its whole path left of x 450, 740 px from Merc **[v2: 4, 9]** | Both endings, read whole | continuous: the bead in flight | The bead (HANDOFFS § S13 to S14) |
| 14a | 540.47-546.23 (next, b59, twinkle) | WS · F0, static · the beads centre left, Merc under the tune's right end at (1290, 840), Tavi in her corner | Kicker "NEXT TIME" (540.62). The bead lands on the first bead's place, C4's row, with a squash (541.30); faint semitone rows fade in under it (541.00 to 541.60) and the other six beads fade in on their rows as chrome outlines (541.30 to 541.80), unnamed. b59: Merc talks, standing still. twinkle: Merc sings the first line once, from C (arcs on), and each bead lights blue on its note's onset with an echo ring; the last is held **[v2: 4]** | The tune, heard once, untouched (FACTS 99) | continuous | Seven lit beads |
| 14b | 546.23-550.41 (b60) | as above | On "I move" (546.23) "Merc moves every single note of 'Twinkle, Twinkle' up." (Outfit 600 44 px, ink, centred, baseline 150) lands top; on "every single note" (547.10) a thin chrome arrow rises from each bead six rows up, one after another (0.08 s apart), and a dashed ink-2 copy of the seven beads draws there, silent, with a "?" right of it (547.60) | The set-up, never its answer (the copy is never played) | continuous | Beads, dashed copy |
| 14c | 550.41-556.01 (o15) | as above | The tease line leaves up fast as b60 ends (550.05 to 550.35); Tavi asks; Lesson 6's hook lands in two lines, serif italic 60 px, centred: 'Why can you start "Twinkle, Twinkle" on any note' (550.50, after the tease line has gone, baseline 130) and "and it is still the same tune?" (553.34, baseline 200). The hook leaves up fast at 555.65 to 555.95, and the beads, the copy and the "?" shrink toward the end card's top right on one curve (555.70 to 556.90), across the cut **[v2: 5]** | Lesson 6's question | continuous | The tease figure, in flight |
| 15  | 556.01-562.01 (end) | WS · slow push in 3 % (sine.inOut) to the last frame · the hosts right: Merc grows in place to 400 at (1290, 840) and Tavi hops 190 px left to (1610, 840), growing to 400 (556.05 to 556.75) | The tease figure settles small at the top right (556.90). The lockup is revealed top left by a feathered wipe (556.15 to 556.65); "mercurypitch.com/mirror" (Outfit 600 72 px, ink) lands under it (556.55) and "Voice Mirror is free, with no account" (Outfit 500 44 px, ink) under that (556.95); all at rest by 557.15. The lower-left third stays clear for YouTube's next-video element, with room for Subscribe between it and the hosts (Q26); Lesson 1's end chimes. Complete for 4.86 s, the hosts idling past the last frame **[v2: 5]** | The address, again; the series continues | end | none |

## Merc performances (`merc/shots/*.json`, from the cues by `tools/merc-shots.py`)

Three performances, not twenty: the hosts are on screen from 52.3 to the end without a cut in their
presence, so each is one continuous score rendered in frame-range chunks. A chunk boundary may fall
on any frame, a cut included, because every frame is a pure function of the score, the voice, the
view and time (MERC-BIBLE § 6); chunks join exactly, so no pass boundary needs a cut of its own
(DECISIONS 72). Size changes and moves are the scene's, in screen space; each chunk renders at the
largest size it is shown at.

| Pass | Span | States | Shown at | View |
| ---- | ---- | ------ | -------- | ---- |
| m01-blue, m01-orange | S1, 0.00 to 37.95 (both slide out 37.30 to 37.90) | On screen from frame 0. Neither sings in S1: the takes belong to no host (FACTS 72), so through `easy`, `heard`, `predict` and `pushed` both `idle`, turned toward the chart, with no arcs. Tavi talks o1 and o2, Merc listens; Merc talks b1 and b3, Tavi listens | 420 | front, turned toward the chart |
| m-orange | 52.32 to the film's end, past it (trap 15) | Leap in from the right edge (`celebrate`, opening 1.38 s before o3; in the air 52.47 to 52.90, settled 53.12; Lesson 4 DECISIONS 123). Talks her nine lines; listens to Merc's; idles, turned to the subject, through every sound she does not make; sings `demo` (S10c, arcs on) and `listen` (S12d); `idle` through `breathe`, `tick-in`, `hold` and `tick-out` with no arcs (never `listen`: nothing hears the viewer); hops 190 px left at S15 | 300 (S4, S5, S10 to S14); 240 (S6 to S9); 400 (S15) | front, turned toward the subject |
| m-blue | 58.87 to the film's end, past it | Leap in from the left edge (opening 1.38 s before b6; in the air 59.02 to 59.45, settled 59.67). Talks his lines; sings `gauge` (S6f, arcs on), `listen` (S12d) and `twinkle` (S14a); idles through the takes, the Push note, the starts and Tavi's `demo` (no arcs: only the host making the sound shows them, trap 14); `idle` through the viewer's hold, no arcs; two hops right at the recap's clean break, (110, 840) to (700, 840) to (1290, 840) (508.85 to 510.05, talking b55 as he goes), then still at (1290, 840) to the end | 300; 240 (S6 to S9); 400 (S15) | front, turned toward the subject |

Notes for `tools/merc-shots.py`:

- `easy`, `pushed`, `push`, the starts and `starts` are `sound` events with no singer: both hosts
  `idle`, turned to the drawing, so no one is seen making a pushed note or a catch (FACTS § 4, the
  coach's "for listening only").
- The scoring is Lesson 4's: `sing` from 0.15 s before to 0.15 s after a host's sound, talk on the
  host's lines, `listen` while the other host talks, `idle` otherwise. The one difference: in
  `hold` both are `idle` with no arcs, and the pad is silent, so a muted viewer reads the ring, not a
  host, as the clock.
- Two entrances in the film, both leaps, from opposite edges; one exit pair (S1h's slide, Lesson
  4's); no `drop` anywhere; Merc's one pair of hops is at 508.85 to 510.05, never near the bead.
- The m-blue and m-orange chunks: start the long performances first (trap 9). At 300 shown the
  chunk renders at 300 (0.26 s a frame alone); the S6 to S9 chunk at 300 too (shown at 240); S15's
  last chunk at 400.

## Sounds and captions

FACTS 80 holds every sound's notes. `tools/captions.py` describes each sound (`SOUNDS`), never what
it means, so a muted viewer knows what is playing and the predicts give nothing away:

| Cue | Caption |
| --- | ------- |
| easy | [a note, sung easily] |
| pushed | [the same note, pushed harder and harder] |
| push | [a held note: the push rises, holds, eases off] |
| gauge | [Merc holds an A, 220 Hz, for ten seconds] |
| start-air, start-catch, start-together | [a start: air first], [a start: a catch], [a start: together] |
| starts | [the three starts, back to back] |
| demo | [Tavi holds an A, 440 Hz, for ten seconds] |
| listen | [Merc and Tavi sing their A together] |
| tick-in, tick-out | [tick: start], [tick: stop] |
| hold | [your ten seconds] |
| twinkle | [Merc sings the first line of a tune] |
| predict, predict2 | [pause and predict] |
| q0, q1, q3, q4, feel | [think] |
| title, end | [chime] |

`heard`, `breathe`, `hook` and `card` carry no caption: the picture holds them. Captions are 42
characters a line, two lines, at most 20 characters a second, the speaker named only when it
changes ("MERC:", "TAVI:"), the address written mercurypitch.com/mirror (FACTS 78). Every caption
sits in the bottom 17 %, so every essential mark sits above y 896 and the care block above y 864.

## Build checks (component rounds)

The motion rule is checked on pixels, in the build. These are binding, and each names what Lesson
4's critics, or this board's critic 01, found, so it is designed out here, not found again.

- **Holds.** Each scene's lab clip goes through `measure.py render` before it joins the film: no
  hold over 0.5 s outside the end card, and no more than about 1.8 s of holds per 30 s in a clip
  with no host on screen (S2, S3). Check first: S3 (no host: the truck must move content at 8 px a
  second or more in its middle, 44.0 to 52.0), 1d (the predict: ring timer and idles only), 6e (the
  predict's 2 s), 6f (one cursor and the drawing behind it: the push must register), 8d (no camera
  move now: the breath and the labels carry it), 9f and 9g (static now), 12e (the viewer's 10 s: the
  ring, its counter and the playhead must each register as moving), 13g's `card` (two cards
  drifting 14 px: if the drift measures as a hold, raise it to a counted event) and 15's last 4.9 s.
- **No single-frame pops** (Lesson 4 FILM1's largest event was tiles popping on at 25 %): every
  object fades or draws in over 0.2 s or more; nothing appears or vanishes on one frame. In 10c and
  13d the mint edge and "in the band" light once (311.41, 505.10) and do not change again until
  10e's glow (critic 01, item 6).
- **No empty frames at joins** (Lesson 4 FILM1, F-01): every cut carries an object across it (each
  is named in the Carried column and fixed in HANDOFFS § The cuts); S7 to S8 carries the dimmed
  figure (critic 01, item 7), S13 to S14 a bead from the card's glyph, S14 to S15 the tease figure.
- **Matched cuts** (critic 01, item 0): at 178.83, 364.73 and 478.09 the carried object (the gauge,
  small band and figure; the empty frame; the frame) sits on the same pixels, within 2 px, in the
  last frame before the cut and the first after it; only the faint room changes. Whether the near
  layer's snap to rest reads as a one-frame event is a lab check (LAB-CHECKS, critic 02 item 10).
- **Two push-and-returns, no more**: in the camera track of the cut film, only 54.00 to 67.50
  (F-strip) and 324.60 to 342.20 (CU-scoop and CU-wave) leave a framing and come back to it by a
  camera move.
- **The gauge's labels build in stages** (script critic 02): in the lab clip of S6, its eight
  landings come 0.40 s or more apart: "one 10-second note" 128.40, "push of air (not pitch)" 128.85,
  "the lungs' own push" 130.45, "what the note needs" 131.55, "held back" 132.25, "Now: holding
  back" 132.75, "Now: adding" 137.25, "added" 137.70; and "added" and "Now: adding" land only at
  or after the 7 s crossing. Every readout switch is a swap, the old words out before the new
  in **[B-01: 183]**.
- **Label landings, the 0.4 s rule** (critic 01, item 5; § Type, Staging). Swept over every row of
  this board: no two separate labels land under 0.40 s apart. The closest pairs, all kept at 0.40 s
  or more, are:

  | Pair | Times | Apart | Rows |
  | ---- | ----- | ----- | ---- |
  | "in the band", "sung easily" | 0.85, 1.30 | 0.45 | 1a |
  | the three swatches with their names | 55.00, 55.40, 55.80 | 0.40, 0.40 | 4a |
  | "FOUR WORDS YOU'LL MEET", then the four chips | 63.27, 63.70, 64.10, 64.50, 64.90 | 0.43, then 0.40 each | 4d |
  | the slider (with "Push" and "50"), "ILLUSTRATION" | 70.48, 70.93 | 0.45 | 5b |
  | "louder", "higher", "in a voice, one push moves both" | 104.30, 104.75, 105.30 | 0.45, 0.55 | 5g |
  | the guess's "?", the four words' row | 112.00, 112.40 | 0.40 | 6b, 6c |
  | "belly", "breathing in" | 117.10, 117.60 | 0.50 | 6c |
  | "one 10-second note", "push of air (not pitch)" | 128.40, 128.85 | 0.45 | 6e (v1: 0.35) |
  | "Now: adding", "added" | 137.25, 137.70 | 0.45 | 6f (v1: 0.20) |
  | row 1, row 2's first line | 186.80, 187.36 | 0.56 | 7b, 7c (v3: row 2's other two lines land on their own words, 189.52 and 195.55) |
  | row 2's names, the four words, the large '"support"' | 197.10, 197.55, 198.06 | 0.45, 0.51 | 7c, 7d |
  | row 3 lands, "The better idea:" | 205.80, 206.32 | 0.52 | 7d, 7e |
  | "as much as feels easy", "Singers breathe in different ways." | 234.24, 234.80 | 0.56 | 8d (v1: 0.36) |
  | "vocal folds, from above", the strip with "ILLUSTRATION" | 241.40, 241.85 | 0.45 | 9b |
  | "onset" row, the strip's title | 244.20, 245.05 | 0.85 | 9b (v1: the title on "onset." with the chip lighting) |
  | the three chips | 246.33, 246.73, 247.13 | 0.40, 0.40 | 9b (v1: together) |
  | "A catch", "LISTEN ONLY" | 257.07, 257.50 | 0.43 | 9d (v1: together) |
  | the stack's three names | 275.50, 275.90, 276.30 | 0.40, 0.40 | 9f (v1: together) |
  | the chart (with its labels), kicker | 303.40, 303.80 | 0.40 | 10b (v2: kicker 303.70, chart 304.10) |
  | "in the band", "settled" | 311.41, 311.90 | 0.49 | 10c |
  | returns after the pull: the axis, "A, any octave", "settled" | 342.00, 342.25, 342.46 | 0.25, 0.21 | 10f (returns, staggered 0.2 to 0.3 s by the lead's call; § Type, Staging; v2: all three at 342.00) |
  | the bracket (with "0" and "10 s"), "Nothing listens" | 370.10, 370.60 | 0.50 | 11b |
  | "Breathe", "Breathe in, low and quiet" | 426.14, 426.57 | 0.43 | 12d |
  | "Sing", the counter | 428.10, 428.50 | 0.40 | 12e |
  | "Easy", "Workable", "Effortful" | 440.73, 441.16, 441.59 | 0.43, 0.43 | 12f |
  | question 3, the traces (with their names) | 486.00, 486.45 | 0.45 | 13c |
  | question 4, the frame's labels | 497.85, 498.30 | 0.45 | 13d |
  | "Practise it.", "Voice Mirror" | 508.85, 509.25 | 0.40 | 13e |
  | the lockup, the address, "Voice Mirror is free, with no account" | 556.15, 556.55, 556.95 | 0.40, 0.40 | 15 (v1: 0.25, 0.20) |

  Every other landing is 0.6 s or more from its neighbours. The counter's ten changes (1.0 s
  apart) and the gauge readout's switch are label switches and counted as landings.

- **The wave rule** (critic 01, item 2): in a lab still of each framing in HANDOFFS § The wave rule,
  a violet line's vibrato measures the cycle and peak to peak listed there within 10 %, and the
  ratio of the two stays 1.30 to 1.45 (1.375 by design): S1 at F-cold, S5 at F0 and at 0.78, S7 large
  and small, S10 at F-hold, CU-scoop and CU-wave, 10h's small frame, 13d.
- **The pushed take stays drawn** whole and still from 25.48 through b3 to o2's "told to" (FACTS
  80): a still at 30.80 shows it complete, above the band at its end.
- **Never a still slider over a still line** (BRIEF; reworded for critic 01's minor item): in 10h,
  from 361.20 to 364.30, the line's head advances every frame (106.7 px a second); the thumb slows
  under 1 px a frame only at its four sine.inOut turns, about 4 frames each, while the head keeps
  drawing; so no frame shows both the thumb and the line's head still. (v1's check, "the thumb's
  speed never zero for more than one frame", could not pass on sine.inOut turns.)
- **Nothing listens**: in S12 no violet line, no microphone, no reading, no host in `listen`; the
  ring is a clock (it fills at an even pace and counts seconds; it never pulses with any sound).
- **Every move reads as itself** (shot grammar § 4): the pushes, pulls, the trucks and the crane
  show the far, mid and near layers parting (Lesson 4 A-01 to A-03 found its pushes reading as zooms
  until the bokeh carried them); S1h reads as a pass into a round bead's light, its glow growing
  round, never a sideways bloom or a dissolve; the object moves (5f, 6b, 7a to 7e, 8b, 9f, 10b's
  widening, 10h, 13a) move with the room still.
- **Contrast**: every settled label at 4.5:1 or better in the lab clip, above all "in the band" and
  "sung easily" beside the band's amber fill, the gauge's labels over the hatches, the doctor lines
  (ink-2 at 30 px) and the rest card's question (ink-2 at 28 px).
- **Pulses** scale about the label's left baseline and move no type a whole pixel per frame as it
  settles (Lesson 4 E-02, E-03).
- **Keep-out**: no label, mark or drawing within 20 px of a host's body box, in every framing,
  including the moves (HANDOFFS § Shared formulas). Watch: the ring at F-turn (right edge 1600,
  Tavi's keep-out from 1700); CU-scoop and CU-wave (the band's foot 583, Tavi's keep-out from y 628;
  the axis faded); 10b's "?" (x 1709 to 1745, y 514 to 560, above Tavi's keep-out); the recap frame
  (x 232 to 1688: Merc's keep-out ends at 210, Tavi's starts at 1700); the rest card (foot 600 over
  Merc's keep-out from 628); Merc's hops (508.85 to 510.05: the floor empty, the card's foot at 300).
- **Collisions fixed** (critic 01, item 4), each to check in a still:
  - 6b and 6c: the kicker (y 89 to 110) and the figure's head (y 143 to 293), 33 px apart.
  - 6k (v3: critic 02, item 1): "one 10-second note" leaves at 170.34 to 170.54; "less holding
    back at first" lands in its slot (x 760, baseline 765, to about x 1150) at 172.92, its leader
    straight up at x 900 to (900, 430); nothing else lies on that path from 171.83 on.
  - "what the note needs": in Quiet under the gold line's left end, x 776, baseline 640, never
    crossed by the falling line (at x 776 to 1061 that line runs at y 347 to 470, 148 px above it);
    in Loud (v3) above the gold line's right end, right-aligned 1630, baseline 440, 12 px over the
    line, on ground the falling line never reaches (it is under the gold line right of x 1024).
  - "added": its leader from (1508, 735) up to (1508, 640), inside its region (y 606 to 663 at
    x 1508).
  - 13a to 13c: the recap frame's band at y 554.5 to 645.5 and its labels at baseline 510, under the
    figure (foot 500) and the traces (foot 485).
  - 12d: "Nothing listens" and "Breathe in, low and quiet" share a baseline, 50 world px apart (70
    on screen at F-turn), never stacked.
  - 540.85: the bead's path stays left of x 450; Merc stands at (1290, 840) from 510.05, 740 px away.
- **Collisions fixed in v3** (critic 02, items 1, 2, 3, 9), each to check in a still, with the
  clearance the board gives (font widths are estimates until LAB-CHECKS confirms them):
  - S1 and S5: "ILLUSTRATION" (to x 1520) and "LISTEN ONLY" (from 1536) 16 world px apart (14.7 at
    F-cold, 12.5 at 0.78); at 0.78 "loud ≠ high" 19 px under "LISTEN ONLY"; S1's chip 12 px under the
    second pill at the drift's end (pills centred y 108).
  - 5c: the definition (baseline 200) 15 px under the chip; the four words' outlines (to y 106) 14 px
    over the chip.
  - 5g: the fork's tips at x 960, inside the peak (772 to 990); "louder" 18 px off the strip's fill;
    "higher" 14 px under the band; the stem 12 px or more right of "50".
  - 6b: the band's path passes 12 px or more above the "ILLUSTRATION" chip (x 1359 to 1630, y 300 to
    340).
  - 6i: "can't push air out" (30 px) from screen x 24 at F-gauge.
  - 6k: "Quiet" and "Loud" 12 px from the frame's right stroke and from each other; "less holding
    back at first" and "more adding as the air runs low" 25 px apart across, 12 px in height.
  - 8c: "knees unlocked" 16 px left of the back arrow's stroke.
  - 9f: the strip's chip 10 px over row 1; "LISTEN ONLY" 10 px between rows 1 and 2.
  - 10d, 10e: "SLOWED · ILLUSTRATION" 55 px from "settled", 37 px over the band, nothing passing under
    it in the truck.
  - 12c to 12f: "Your turn." 173 px left of the frame at F-turn, 35 px right of Merc's arcs.
  - 1g: '"support"' descenders 12 px over Merc's line at 32.87.
- **Captions**: nothing essential below y 896; the care block above y 864.
- **Honesty**: nothing on screen that FACTS does not hold; "ILLUSTRATION" on every drawing of a
  take, the Push note and its toy, the gauge (106.20 to 179.40), the redrawn pushed take, the
  starts, Tavi's hold (in the close-ups as "SLOWED · ILLUSTRATION") and 10h's line; "LISTEN ONLY" on
  the pushed take, the Push note and the catch, the catch again in `starts` (v3: critic 02, item 3);
  no number on Tavi's hold; no "15" or "fifteen" anywhere; Voice Mirror's six seconds only on its
  card, after the clean break. **Word for word** (critic 01, item 9): every line on both practise
  cards is `script.json`'s b55, b56 and b58 as written, split only at phrase ends; the readout and
  "Ten minutes, gently, most days. Missed a day? Just come back." are the brief's (FACTS 54, 59).

## Open for the owner

- The voices: the scratch Kokoro pass, then the owner's ElevenLabs voices on the owner's word
  (DECISIONS 38). The board re-times itself from the cues; only the board clock's numbers change.
  If the voiced cut passes 9:50, the card gaps go to 1.6 s first (DECISIONS 99).
- The vocal coach signs off the care block, the turn and the lines marked `[coach]` before the
  final voices (MASTER-PLAN § 7), and the film at the day-6 gate. Nothing on this board adds a
  coach line; it puts the care lines on screen as the brief words them. The figure's out-breath
  (6f, 6i, 8d; FACTS § 4) is marked for the coach.
- The end card's lower-left third is left clear for YouTube's end-screen elements; the owner
  places them in YouTube Studio.
