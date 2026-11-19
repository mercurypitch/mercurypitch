# Storyboard v1: Find Your Pitch, Lesson 5, "Breath and a steady note"

1920x1080, 60 fps. **Timed on the board clock, 9:22.0 (562.01 s): script draft 3's word-rate
estimate** (Merc 2.32 and Tavi 3.08 words a second, Lesson 2's voiced pace; `script.json`, as
`tools/script-draft.py` counts it) **plus the six chapter-card pauses this board asks for** (a 2.2 s
gap before o4, o6, o9, o10, o11 and b34 in place of 0.3 s, 11.4 s in all; DECISIONS 70). No voice
exists yet. The scratch voices (Kokoro) and then the owner's ElevenLabs voices will move every time
here, by tens of seconds by the end (Lesson 4's voiced film ran about 30 s past its estimate). So
every time below is an orientation, never a number to type: scenes key off cue names and words
(`L.at(scene, cue)`, `L.word(scene, line, word)`), and a word's time here is its estimate (its
place in the line at the line's rate). Exact pixels for every carried object, every framing and
the geometry formulas are in [HANDOFFS.md](HANDOFFS.md); this board names framings and positions,
HANDOFFS fixes them. Line ids are `script.json`'s (b = Merc, o = Tavi); FACTS numbers are the
film's `FACTS.md`.

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
240 px small at the edge under the dense diagrams of chapters 2 to 4, 400 px on the end card). No
host falls from the top of the frame anywhere in this film, and no entrance repeats (DECISIONS 72;
Lesson 4's six film rounds each found "the same fall" again).

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
- **The beads**: the tease's seven beads on faint semitone rows.

**The bottom 17 % is the caption band**: nothing essential below y 896 in any shot, and the care
block (S11, S12) nothing below y 864. Delivery as Lessons 1, 2 and 4: a clean master plus SRT and
VTT from `cues.json`, never burned in.

**Motion with the sound off.** Every span longer than about 0.5 s has something that moves or
changes: a host who talks or sings, a line drawing on, an object moving, a label landing or
leaving, a counted pulse (§ Type), or a camera move while content travels at least about 8 px a
second. A drift, a breathing glow and the near dust do not count. Spans with no host on screen
(S2, S3) carry a lead move under their events.

## Camera plan

Each move has one job and lands before the change it goes for. Moves in brackets are object moves
the camera leaves to the object. Numbers in HANDOFFS § Framings and § Camera moves.

| Time (board)    | Move                                                       | From, to                     | For                                                                 |
| --------------- | ---------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| 0.00-31.25      | drift (not counted)                                        | F-cold 0.90 to 0.92          | the cold open breathes                                              |
| 31.40-34.40     | pull out (sine.inOut)                                      | F-cold to F-hook             | the bigger question: Merc's line becomes Lesson 4's last long note |
| 37.50-38.05     | through an object: into the long note's light (power3.in)  | F-hook to F-line             | into the title (the film's one signature move)                      |
| 41.90           | cut                                                        | F-promise-a                  | the title's bead lands on A3                                        |
| 42.60-53.40     | truck right, 160 px (power1.inOut)                         | F-promise-a to F-promise-b   | follow the promise from a note's start to its ten seconds           |
| 54.00-55.40     | crane down with a push in (power2.inOut)                   | F-promise-b to F-strip       | "how loud": onto the level strip                                    |
| 66.00-67.50     | crane up (power2.inOut)                                    | F-strip to F0                | "the right note": the band returns                                  |
| 97.30-98.50     | pull out (power2.inOut)                                    | F0 to F-wide                 | Lesson 1's loud-or-high figure joins the chart                      |
| 108.70-109.90   | push in (power2.inOut)                                     | F-wide to F0                 | back to the push as Tavi asks where it comes from                   |
| (110.90-112.40) | the chart splits: band up, strip down (object)             | F0                           | room for the breath figure; the gauge's two halves                  |
| (127.90-129.90) | the strip opens out into the gauge (object)                | F0                           | the predict's 2 s: frame and side label settle                      |
| 130.25-140.25   | slow push in (sine.inOut)                                  | F0 to F-gauge                | listen: attention closes in while the note holds                    |
| 179.00-180.40   | pull out (power2.inOut)                                    | F-gauge to F0                | the mix-up card needs the whole frame                               |
| 229.10-230.50   | push in (power2.inOut)                                     | F0 to F-chest                | "let the breath drop low": onto the torso                           |
| 234.30-235.70   | pull out (power2.inOut)                                    | F-chest to F0                | "as much as feels easy": the whole figure again                     |
| 275.50-276.70   | pull out (power2.inOut)                                    | F0 to F-stack                | the three traces stack                                              |
| 303.40-304.60   | push in (power2.inOut)                                     | F-stack to F0                | the chart returns for chapter 5                                     |
| 324.60-326.10   | push in (power2.inOut)                                     | F0 to CU-scoop               | the first second, slowed: the scoop                                 |
| 331.90-333.10   | pull out (power2.inOut)                                    | CU-scoop to F0               | the whole hold again for "steady"                                   |
| (353.90-355.10) | the hold frame slides to the right half (object)           | F0                           | room for the voice box; the turn's frame is in place                |
| 556.01-562.01   | slow push in, 3 % (sine.inOut)                             | F0 to F-end                  | the end card breathes to the last frame                             |

Every push and pull here is one of five purposes: onto a part (S4 strip, S6 gauge, S8 chest, S10
scoop) or back out to the whole. No two consecutive chapters use the same move, and the camera never
does "push, run, pull" twice in a row (Lesson 4's film critics named that pattern six times).
F0 holds about 52 % of the film's time, but F0 here frames five different subjects (the chart, the
figure and gauge, the mix-up card, the folds and traces, the turn), each filling 60 to 85 % of
the frame.

## Persistent actors

1. **The band chart.** One object the whole way, the app's own picture of a sung note. Frame 0
   shows it finished. In the cold open it holds the two takes; in the hook it pulls back into
   Lesson 4's last frame, its amber line the long note; the title's bead lands on its A3 and draws
   that line again for the promise; the camera cranes onto its strip for the recall; in chapter 1
   it is the Push toy, a slider under it. In chapter 2 it splits: the band rises and shrinks into
   Merc's small band, and the strip opens out sideways into the gauge, then folds back into the
   strip; in the mix-up card the band becomes the pushed take in miniature and the strip doubles,
   easy and pressed. It is away for chapters 3 and 4 (the figure and the folds are the subjects).
   In chapter 5 it returns with its window widened to the hold's 10-second frame for Tavi's line;
   it slides to the right half, where on the viewer's turn the same frame holds only a chrome
   playhead and the ring; it answers recap card 3. Every change happens on screen, never across a
   cut and never under a chapter card.
2. **The breath figure.** Chapter 2's torso (the dome, the lungs, the belly), chapter 3's whole
   upright figure (the same drawing, unmasked and moved to the frame's centre), recap card 1.
3. **The violet line.** A voice's line always shows the wave its voice carries (FACTS 98): the
   easy take, the pushed take, the Push note, Tavi's hold. Merc's amber line is always steady at
   the band's centre (FACTS 42). On the viewer's turn there is no violet line (FACTS 87).
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
   fades beside it. Two minutes later the same frame stands empty but for a chrome playhead, the
   ring turns, and the viewer's ten seconds pass with nothing drawn and nothing listening.

## Codes

- **Pitch canvas** (the band chart; FACTS 69): target amber `#f59e0b` for Merc's band (fill 12 %,
  edges 2 px at 45 %) and his line (4 px, steady); singer violet `#a78bfa` for a voice's line
  (4 px, round caps) and its level strip (fill 28 %, edges 2 px at 70 %); in-tune mint `#80ffca`
  for the band's lit edge (3 px with a soft glow), shown only while a voice's centre is in the
  band and **always beside the words "in the band"**. There is no "off" colour.
- **Diagrams** (the series code, MASTER-PLAN § 5): chrome `#c3ccd6` marks and any note that is not
  a host's; ink `#e6edf3` labels; ink-2 `#a8b3bf` secondary labels; blue `#58a6ff` Merc's sung
  notes in a diagram (the tease's beads); orange `#ff7448` Tavi's; aqua `#2dd4bf` only the chapter
  cards' numerals. **Gold `#ffd84d` marks two things only**, the fit: the gauge's "what the note
  needs" line and the "together" start's tick. Never `#6e7681` for text.
- **Tavi's guesses** are dashed ink-2 (3 px, dash 10, gap 8) with a "?" (Outfit 600 64 px ink-2):
  the straight line (1b, 10b), the up arrow from the dome (6b), "steady air keeps it there?" (10g),
  the mix-up card's belief row (7a), the tease's moved copy (14b, her question). Nothing else is
  dashed.
- **Tags.** "ILLUSTRATION" (JetBrains Mono 500 24 px, tracking .18em, ink-2, in a chrome 25 %
  pill) on every drawing that is not a measurement: the takes, the Push note, the gauge, the
  starts, Tavi's hold, recap card 3. "LISTEN ONLY" (same style) on the pushed take, the Push note
  and the catch, from the moment each sounds until it leaves.
- **Loudness is never drawn on the pitch axis**: it is the level strip's height (playbook rule 20).
  The Push slider is horizontal, under the strip, so its travel is never read as pitch.
- Every coloured thing also has a label.

## Type

As Lessons 1, 2 and 4. Kickers JetBrains Mono 500 30 px, uppercase, tracking .18em, ink-2, at
(120, 110), landing with an act's first line after its card and leaving at the end of its second
line. Big ideas Instrument Serif italic, 64 to 160 px. Numbers Outfit 600 tabular. Diagram labels
Outfit 600, 30 to 56 px. On-screen text is a label, a number or a key term, never a narrated
sentence, except the care block's stop line and doctor lines and the two practise cards' lines,
carried whole (BRIEF).

World labels (anything that names a part of a drawing) ride the camera and scale with it;
frame-fixed type (kickers, chapter cards, pills, the four words, the recap panel, the cards, the
hook) never scales and never rides a move. A frame-fixed label a move would put over a drawing
leaves before the move and its replacement lands after it.

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
chips in the top lane, right-aligned to x 1800, baseline 110 (Outfit 600 30 px; dim: ink-2 in a
chrome 25 % outline; lit: ink, chrome 60 % outline, a 2 px chrome underline). The row is not on
screen all the time: it comes back for about 4 s round each word's definition, with that word
lighting as Merc says it ("pressure" 78.3, "diaphragm" 113.0, '"Support"' 198.1, "onset" 244.6),
and lit words stay lit on its later visits (DECISIONS 75).

**Timing of text and marks**: unless a row says otherwise, a label fades in over 0.2 s from its word
and out over 0.2 s; "up fast" is 0.3 s, power3.in. Nothing lands where something else is still
leaving. A replacement label slides the old one up 12 px as it fades and the new one in from 12 px
below, 0.25 s.

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
to s15 (HANDOFFS names every cross-group frame). YouTube chapters (each over 10 s; board starts):
One push (0:00), How loud to sing (0:54), What pushing does (1:08), What the diaphragm does (1:46),
"Support" (2:59), Breathing in (3:36), How a note starts (3:57), A steady note (5:01), Sing it
(6:05), Your turn (6:43), Quick check (7:58), Practise it (8:28), Next time (9:00).

## Shots

Shot line: size · angle · lens · move · light · composition · time · out, in the vocabulary of
`.claude/skills/motion-designer/references/shot-grammar.md`. Every shot is eye level, 50 mm
equivalent and lit by the palette unless its line says otherwise ("as above" repeats the line
before). "Out" says how the shot leaves; "Carried" names what the next shot picks up. Times are the
board clock's; a word in quotation marks with a time is the cue a builder keys to.

### Cold open, title, promise and recall [A]

World positions are F0 pixels; HANDOFFS § Framings maps them to the screen in each framing.

| #   | Time (cues) | Shot line | On screen | For | Out | Carried |
| --- | ----------- | --------- | --------- | --- | --- | ------- |
| 1a  | 0.00-4.90 (open, easy, heard) | MWS two-shot · eye level · 50 mm · F-cold, drifting from 0.90 to 0.92 about the screen point (960, 450) over 0 to 31.25 (power1.inOut; a drift, not counted) · soft key glow behind each host, mint and amber the only colour on the chart · centre symmetry: the chart centred, Merc feet (230, 840) and Tavi feet (1690, 840) at 420, both turned toward it · real time · continuous | **Frame 0 is finished**: the band chart (plot x 400 to 1520), Merc's amber band at A3 with his steady amber line at its centre; "A3" left of the line; the label row above the plot, "in the band: within 35 cents (Lesson 3)" left and the "ILLUSTRATION" chip right; the level strip under the plot as a hairline, "level" under its left end; kicker "FIND YOUR PITCH · LESSON 05" (leaves 4.40 to 4.60). From easy's start (0.60) the easy take draws as it sounds, a violet line whose head is a small violet dot with a soft glow, travelling right at 280 world px a second: in from 40 cents low, into the band by 0.5 s, then holding there with its small, even wave growing in over 0.35 s (5.5 cycles a second, 14 cents either way: FACTS 80, 98); the strip's even envelope draws with it. As its centre enters the band (about 0.85) the band's top and bottom edges light mint and "in the band" lands beside the band's left end, under "A3". On "sung" being heard (1.10) "sung easily" lands right of the plot beside the band's lower edge. The head reaches the plot's end at 4.60 and its dot fades; heard: both hosts lean a little toward the chart, the line whole | A sound becomes a line, by 1 s | continuous | Easy line, band lit |
| 1b  | 4.90-9.35 (o1) | as above | Tavi talks, Merc listens (turned to her). On "push the air out harder" (6.07 to 7.37) the strip's envelope outline brightens once (an accent) and the line's head point at the plot's end sends an echo ring (7.40). On "holds steadier?" (8.35 to 9.00) her guess draws as a guess: a dashed ink-2 line held dead flat along the band's centre over the take's held part, x 540 to 1520 (8.35 to 8.85, left to right), with its "?" landing right of its end (8.85); Merc's amber line dims to 50 % under it (a stroke, never a label), so the straight dashed line and the wavy violet one read side by side | Voice the misconception: a push would iron the wave out (FACTS 82) | continuous | Dashed guess |
| 1c  | 9.35-19.13 (b1) | as above | Merc talks, Tavi listens. On "the same note" (10.64) a light runs along the easy line, left to right (0.6 s), and back to rest; on "harder" (11.93) and again on "harder." (12.79) the guess's "?" scales 1.2 (counted). On "settle," (14.52) the pill "Settle, steadier than before" lands top centre-left; on "louder" (17.10) "Get louder and drift higher" lands beside it (pills Outfit 600 34 px in chrome-stroked capsules, HANDOFFS § S1); both scale 1.08 once as each lands | The page's predict, aloud (by 0:19) | continuous | Pills |
| 1d  | 19.13-21.48 (predict) | as above | A ring timer draws round a small dot right of the pills over the 2.0 s; the pad swells; both hosts idle, turned toward the pills; the "?" breathes (an accent). At 21.13 the ring timer fades; at 21.30 "sung easily"'s line dims to a 35 % violet ghost (its label stays ink) and the strip's easy envelope to an outline, so the next line has the stage | The viewer predicts | continuous | Ghosted easy line |
| 1e  | 21.48-25.68 (pushed) **signature 1** | as above | "LISTEN ONLY" lands in the label row as the take starts (21.48). The pushed take draws at full violet over the ghost: for its first second it lies on the easy line; then, as the push grows, the strip's envelope swells under it (to twice the easy height by the end, +6 dB) while the wavy line climbs: its peaks leave the top of the band from 23.53 (2.05 s), its centre at 24.23 (2.75 s), when the band's edge goes dark and "in the band" leaves; from 24.93 (3.45 s) the whole line is above the band and "above the band" lands right of the plot beside the line's end (FACTS 80). The finished line is drawn whole at 25.48 and stays exactly so through b3, still and complete, its head dot fading | One push, both moved, heard and seen together | continuous | Pushed line, swollen strip |
| 1f  | 25.68-31.25 (b3) | as above | On "Louder," (25.68) the swollen part of the strip lights to 40 % violet and back (counted) and "louder · higher" (Outfit 600 56 px, ink) lands top left of the plot, over the band's empty left half; on "higher." (26.54) the climbing part of the line glows and the second pill gets an ink check (an SVG mark drawing on 0.3 s); the first pill dims its stroke; Tavi's dashed guess and its "?" fade (26.60 to 26.90) and Merc's amber line returns to full. On "Pushing" (26.97) the small type "Both lines are drawings of that rule, not recordings." lands under the strip's right half (Inter 34 px, ink-2). On "moves it." (29.99) an ink arrow (3 px) draws from the take's last in-band point up to its end (30.0 to 30.5) | The reveal; the takes declared drawings (FACTS 72) | continuous | Both lines, arrow |
| 1g  | 31.25-37.10 (o2) | pull out (sine.inOut, 31.40 to 34.40) from F-cold end to F-hook: the chart recedes until Merc's amber line runs x 560 to 1360 at y 520, Lesson 4's last long note; far, mid and near layers part · the hosts hold their places | Tavi asks; Merc listens. As the pull starts, the pills, "louder · higher", the arrow, the small type, "above the band" and "LISTEN ONLY" leave up fast in turn (31.30 to 31.75); on "told to" (32.23) the pushed line, the ghost, the strip and their labels fade (32.20 to 32.70), then the band's fill and edges, "A3" and the label row (32.50 to 33.00), leaving only Merc's amber line. On "support" (32.87) '"support"' (Instrument Serif italic 160 px, ink, centred, baseline 420) lands above the line; on "what keeps" (35.80) "what keeps it steady?" (serif italic 96 px, centred, baseline 680) lands under it; on "steady?" (36.77) the line's glow brightens once and back. At 34.40 the frame is Lesson 4's own last tease frame (its S15: same type, sizes and places, the long note at y 520 from x 560 to 1360), now asked from this side (DECISIONS 73) | The hook, by 0:37; it picks up Lesson 4's last lines | continuous | The long note, the hook's two lines |
| 1h  | 37.10-38.30 (hook) | through an object: the long note's light, F-hook to F-line (37.50 to 38.05, power3.in), the camera passing into the line's middle · the hosts slide 360 px outward and out of frame (37.30 to 37.90, power2.in) | The two lines hold to 37.55, then leave up fast (37.55 to 37.85). From 37.60 the line's glow grows toward the lens and defocuses, its amber cooling to chrome as it nears, until a smooth radial chrome field fills the frame at 38.05 (Lesson 2's level, never a white flash); it holds, breathing 2 % in brightness, to the cut | Into the title, through Merc's note | full-frame field | Full-frame field |
| 2   | 38.30-41.90 (title) | full-frame type · centre symmetry · slow zoom out 4 % (Lessons 2 and 4's S2) | Lesson 4's title composition: the field shrinks into a chrome bead on the middle line of five living staff lines (38.30 to 38.76, the radius on power2.out, the centre on power3.out); five quarter notes hop in with the sting's five chimes (A3 E4 A4 C♯5 E5; 38.35 to 38.71), each sending a ripple; the title "Breath and a steady note" (chrome serif italic 140 px, one line, centred, baseline 380) and its kicker "LESSON 05" land from 38.56; "Find Your Pitch" (Outfit 48 px) under the title; the notes bob 8 px on a 1.2 s cycle. From 40.72 the type and notes exit up; from 41.02 the staff fades (41.02 to 41.62) while the chart fades up under it in F-promise-a (band, Merc's line not yet drawn), and the bead lifts off its line and flies to the chart's A3 at the plot's left end (41.02 to 42.02, sine.out) | Series identity | continuous across the cut: the bead in flight | The bead, in flight to A3 |
| 3a  | 41.90-45.77 (b4 to "does,") | WS · F-promise-a, then a truck right of 160 px (42.60 to 53.40, power1.inOut; far, mid and near at 0.25, 1, 1.6) · centre · no hosts | The bead lands on A3 at the plot's left end (42.02), turns amber, sends one echo ring, and becomes the head of Merc's line, which draws on to the plot's end (42.02 to 42.62, power2.out), the band's fill and edges spreading behind it; "A3" and the strip's hairline fade up with it. On "what your diaphragm does" (44.05) "what your diaphragm does" (Outfit 600 40 px, ink, a world label) lands under the strip's left half, and the strip's rounded outline draws round it in chrome (44.10 to 44.60) and dims back: the place the push of air will be drawn | The promise, part 1 (the diaphragm) | continuous | Chart, label 1 |
| 3b  | 45.77-49.65 ("how to" to "easily,") | as above | On "breathe in low" (46.64) "breathe in low · start easily" lands above the band's left end; on "start" (48.36) a chrome tick (4 px, the band's height) stands at the line's start and the first 120 px of Merc's line glow, the place a note starts | Part 2 | continuous | Chart, labels 1 and 2 |
| 3c  | 49.65-53.70 ("and you'll" to the end) | as above (the truck lands at 53.40) | On "hold" (50.09) "a comfortable note · 10 s" lands above the band's right half; on "comfortable" (50.95) a chrome playhead (3 px, the band's height) starts at the line's start and sweeps the band to its end over 2.0 s, the band's fill brightening from 12 to 24 % behind it and easing back after it, a preview of the hold. The three labels leave up fast at 53.00 to 53.30. Tavi's leap begins off the right edge (52.32; she is in the air 52.47 to 52.90 and settled at 53.12, HANDOFFS § S3 to S4) | Part 3 (the ten seconds) | cut on o3 (53.70) | Chart, Tavi landing |
| 4a  | 53.70-57.95 (o3) | crane down with a push in (54.00 to 55.40, power2.inOut) from F-promise-b to F-strip: the strip rises to the frame's upper middle at 1.4x, the band leaving out of the top; the staves slide up past it slower, the bokeh faster · Tavi in her corner (1800, 840) at 300 | Kicker "FROM LESSON 3" (53.75; leaves at 59.75). Tavi talks. As the crane lands, three level swatches land in a row under the strip, left to right, 0.15 s apart, on "how loud" (54.68 to 55.00 + 0.3): chrome-outlined envelopes of three heights, small, middle and tall (the middle one exactly the strip's own height), with "whisper", "about speaking volume" and "shout" under them (Outfit 600 36 world px, ink-2). The strip itself shows an even envelope at the middle height and never changes | Retrieve Lesson 3, asked afresh (rule 18) | continuous | Strip, swatches |
| 4b  | 57.95-60.25 (q0) | as above · Merc leaps in from the left edge to (110, 840) at 300 (in the air 59.02 to 59.45, settled 59.67) | A ring timer round a small dot top left (180, 200) over the 1.8 s; the pad swells; Tavi idles, turned toward the strip; Merc's leap lands as the ring closes | The viewer answers in their head | continuous | Strip, swatches |
| 4c  | 60.25-63.27 (b6 to "at:") | as above | Merc talks. On "about the volume" (60.68) the middle swatch lights: violet 28 % fill like the strip's, an ink outline, its label to ink and Outfit 600 (it scales 1.08 once); a chrome hairline (40 %) draws from it up to the strip, whose envelope it matches. Nothing else moves: the strip does not grow or shrink (FACTS 83) | The answer, on the object that taught it | continuous | Lit swatch |
| 4d  | 63.27-68.13 (b6 from "a quiet note") | as above, then crane up (66.00 to 67.50, power2.inOut) from F-strip to F0 | On "a quiet note" (63.27) "FOUR WORDS YOU'LL MEET" (mono 26 px, ink-2) lands centred low, and the four words land under it one by one as chips (63.50, 63.85, 64.20, 64.55): "air pressure", "diaphragm", "onset", '"support"' (Outfit 600 44 px, ink, centred row at baseline 790); on "much" (65.85) the row shrinks to 30 px and flies to the top lane, right-aligned to x 1800, baseline 110, and dims (65.70 to 66.30, power2.inOut), each word in its dim chip. On "the right note" (66.28) the crane brings the band back down into frame: the swatches, the hairline and the heading fade (66.00 to 66.40) and Merc's line in its band returns at F0 as the crane lands (67.50) | The four words parked; the right note is the band's | cut on act1 (68.13) | Chart at F0, the four words parked (HANDOFFS § A to B) |

### Chapters 1 and 2, and the mix-up card [B]

| #   | Time (cues) | Shot line | On screen | For | Out | Carried |
| --- | ----------- | --------- | --------- | --- | --- | ------- |
| 5a  | 68.13-70.48 (act1) | full-frame type over the dimmed chart · both hosts in their corners at 300 (Merc (110, 840), Tavi (1800, 840)), idle, turned to the card | The chart dims to 25 % (68.28 to 68.48), "A3" and "level" hidden while dim; chapter card "01 What pushing does" in from 68.50, leaving up fast 69.98 to 70.36; the chart back to full 70.36 to 70.56. The four words stay parked in the top lane through the card | Chapter breath; the whoosh | continuous | Chart at F0 |
| 5b  | 70.48-73.60 (o4) | MWS · F0, static · the chart centred, hosts in the corners · real time | The four words leave up fast (70.48 to 70.78). Kicker "01 · WHAT PUSHING DOES" (leaves at b7's end). On "If I ease off" (70.48 to 71.45) the Push slider draws under the strip, left to right (0.5 s): a chrome track x 400 to 1520, its thumb at 50 (x 960) with "50" riding above it (Outfit 600 30, tabular) and "Push" left of the track; on "ease off," (71.13) the thumb scales 1.2; Tavi talks, Merc listens | Her question, which the sound will answer (FACTS 84) | continuous | Push toy |
| 5c  | 73.60-84.72 (b7) | as above | On "How hard" (73.60) "in the band: within 35 cents (Lesson 3)" leaves the label row and "pressure: how hard your breath pushes on your vocal folds" (Outfit 600 34 px, ink) lands in its place, from x 400; the four words return to the top lane (77.80) and "air pressure" lights on "pressure." (78.34), the row leaving at 82.10; on "mainly" (79.20) "mainly: louder" lands inside the plot just above the strip (x 420) with a short chrome arrow down to the strip, whose envelope outline brightens; on "nudges the pitch" (83.08) "also: a little higher" lands above the band (x 420) with a short arrow up to the band's top edge | Step 1's words, each on its part | continuous | Push toy, two labels |
| 5d  | 84.72-90.30 (b8) | as above | "mainly", "also" and the definition leave (84.72 to 85.02). On "watch the line" (85.59) the line's starting point on A3 at the plot's left end sends an echo ring. Over the slider only, the push's plan draws in chrome at 40 %: on "rises," (87.74) an arrow from the thumb along the track to 100; on "holds," (88.17) a short hold bar at 100; on "eases off." (89.03) an arrow back to 50. They say what the push does, never what the line does, and fade at 90.10 | b8 names the push only; the line is left to the sound (script critic 02) | continuous | Push toy |
| 5e  | 90.30-95.90 (push) | as above | "LISTEN ONLY" and "ILLUSTRATION" land in the label row (90.30). The Push note draws in violet with its wave over the 6-second window, the thumb moving in time with the sound: at 50 to 0.6 s, up to 100 by 2.1 s, held to 3.6 s, back to 50 by 4.8 s, held to 5.6 s (FACTS 80), its "50" counting to "100" and back; the strip swells to twice its height and returns with it; the line climbs out of the top of the band, the band's edge dark and "in the band" gone from 91.77 to 94.40 (its centre out), "above the band" right of the plot from 92.12 to 94.12 (the whole line out, 1.5 s of it at the top); the line comes back into the band and the mint edge and "in the band" return at 94.40. The finished line stays whole: up, a flat 1.5 s at the top, back | The push rises, holds, eases; the line follows it up and back | continuous | Finished Push line |
| 5f  | 95.90-101.42 (o5) | pull out (97.30 to 98.50, power2.inOut) from F0 to F-wide: the chart recedes left and Lesson 1's figure is found waiting right of it; layers part | On "It came back." (96.20 to 96.85) the line's return glows from the top back into the band and "in the band" scales 1.08. Tavi talks. On "Lesson 1" (97.50) the pull opens room on the right, where Lesson 1's loud-or-high figure stands (chrome, its own drawing at 0.6 of its size): two small panels, LOUDER (a trace grows taller while its bead stays put) and HIGHER (the trace packs tighter while its bead jumps), each playing once, LOUDER on "loud" (98.47) and HIGHER on "high" (99.12); on "different things." (99.77) "loud ≠ high" (Outfit 600 48 px, ink; ≠ drawn as a path) lands over the panels | Her doubt, from Lesson 1 (FACTS 13) | continuous | Chart and Lesson 1's figure |
| 5g  | 101.42-106.28 (b9) | WS · F-wide, static · the chart left, the panels right | On "They are." (101.42) "loud ≠ high" scales 1.2. On "one push" (104.00) an ink arrow (3 px) draws up from the slider's thumb and forks (104.00 to 104.60): one branch to the strip, ending at "louder" (Outfit 600 40 px), one to the band's top, ending at "higher"; on "both." (105.30) "in a voice, one push moves both" (serif italic 56 px, ink) lands top centre. From 105.80 the panels, the fork, its labels, the line, "LISTEN ONLY" and the type fade (105.80 to 106.20), leaving the bare chart and the slider at 50 | Loud and high are different, and one push moves both | cut on act2 (106.28) | Bare chart and slider at F-wide (HANDOFFS § S5 to S6) |
| 6a  | 106.28-108.63 (act2) | full-frame type over the dimmed chart, F-wide | The chart and slider dim to 25 % (106.43 to 106.63); card "02 What the diaphragm does" in from 106.65, out 108.15 to 108.53; back to full 108.53 to 108.73 | Chapter breath | continuous | Chart |
| 6b  | 108.63-112.55 (o6) | push in (108.70 to 109.90, power2.inOut) from F-wide to F0 · the hosts shrink in place to 240 at (100, 840) and (1820, 840) (108.70 to 109.50), sitting small at the edges for the diagrams to come | Kicker "02 · WHAT THE DIAPHRAGM DOES" (to b11's end). Tavi talks. On "that push" (109.60) the thumb scales 1.2. On "Isn't it the diaphragm?" (110.90) the chart splits in one move (110.90 to 112.40, power2.inOut): the slider fades; the band with Merc's line rises and narrows into Merc's small band, top right; the strip slides down and right to the gauge's floor, still a strip; at the same time the breath figure draws on at the left (111.00 to 112.00, its strokes drawing from the spine outward): the torso in side view facing right, head and neck above, the lungs, the dome under them, the belly wall, the legs faded out below the hips. On "diaphragm?" (111.87) her guess: a dashed ink-2 arrow from the dome up into the lungs, with its "?" (112.00 to 112.40) | Her guess, drawn as one (FACTS 85) | continuous | Figure, small band, strip |
| 6c  | 112.55-118.93 (b11) | MWS · F0, static · the figure left third, the small band and the strip right | The four words return (112.60) and "diaphragm" lights on "diaphragm" (112.98), the row leaving at 117.10; "diaphragm" (Outfit 600 34 px, ink) lands left of the figure's back with a chrome leader to the dome; on "dome-shaped" (114.27) a light runs along the dome's arc; on "lungs." (116.00) "lungs" lands left of the lungs and the guess arrow and its "?" fade (116.00 to 116.30). On "tightens to breathe in" (116.86) the figure breathes in once (116.86 to 118.36, sine.inOut): the dome flattens and lowers, the belly wall moves out and "belly" lands beside it, the lungs' outline fills; "breathing in" (Outfit 600 36 px) lands under the dome (117.30); the figure eases back (118.40 to 119.40) | The diaphragm is a breathing-in muscle (FACTS 14) | continuous | Figure |
| 6d  | 118.93-127.90 (b12) | as above | On "big breath," (119.79) the figure breathes in fully (119.79 to 121.00) and stays full; "breathing in" leaves. On "quiet note." (121.95) the strip's envelope draws in at a low, even height, left to right (0.6 s), the note under way. On "Must your body" (122.81) "PREDICT" (mono 26 px, ink-2) lands in the top lane; on "push the air out," (124.11) the pill "Push it out" and on "hold it back?" (126.26) "Hold it back" land beside it (x 760 to 1640, frame-fixed) | Step 2's predict, before anything says what the diaphragm can't do | continuous | Figure full, strip, pills |
| 6e  | 127.90-130.25 (predict2) | as above | A ring timer right of the pills over 2.0 s; the pad swells. **The gauge's first stage** (BRIEF: its labels build up in stages): the strip opens out sideways and upward into the gauge's frame (127.95 to 129.35, power2.inOut), its violet envelope fading as the frame's chrome outline and time axis draw; "one 10-second note" lands under the axis (128.40); "push of air (not pitch)" with its small up arrow lands over the frame's left end (128.75). The cursor stands at the frame's left edge. Two labels in 2 s, one after the other | The gauge's frame and what its height means, before any line | continuous | Gauge frame, figure, small band |
| 6f  | 130.25-140.25 (gauge) **signature 2** | slow push in (sine.inOut, over the whole 10 s) from F0 to F-gauge: the gauge and small band grow 5 % about the gauge's centre, the staves and bokeh part behind · Merc sings (arcs on); Tavi idles, turned to the gauge | Merc sings A3 for 10 s; no one speaks. One chrome cursor runs across the small band and the gauge at the note's own pace. In the small band Merc's amber line draws behind it, steady at the centre, the whole way. In the gauge, **in stages, never together**: 0 s, the falling chrome line draws behind the cursor and "the lungs' own push" lands at its start (130.45); 1.0 s, the gold line "what the note needs" draws across the whole frame (131.25 to 131.85) and its label lands under its left end (131.55); 2.0 s, the region between the two, behind the cursor, fills with a fine chrome hatch and "held back" lands in it (132.25); 2.5 s, "Now: holding back" lands over the frame's right end (132.75); 3.5 s, "Hold it back" gets its ink check and "Push it out" dims (133.75), then the pills and "PREDICT" leave (134.25 to 134.55); 5.0 s, "the note: unchanged" lands over the small band (135.25); **7.0 s, the cursor crosses the gold line**: "Now: holding back" turns into "Now: adding" (137.25, a label switch) and the region behind the cursor fills with the other hatch; 7.2 s, "added" lands under the frame with a short leader up into it (137.45). The figure's lungs empty slowly with the cursor and its dome rises back. The cursor reaches the end as the note stops | The note holds while the breath's work changes, heard before it is explained (FACTS 93) | continuous | The whole Quiet gauge |
| 6g  | 140.45-144.96 (b13) | MWS · F-gauge, static | On "Hold it back," (140.45) the held-back hatch lights to 40 % chrome and back (counted). On "breathing muscles," (142.61) the figure's ribs and dome glow and "with your breathing muscles," lands under the figure; on "never your throat." (143.47) "never your throat" lands under it (Outfit 600 32 px, ink) | Step 2's reveal, how to hold back (FACTS 32) | continuous | Gauge, figure |
| 6h  | 144.96-156.90 (b14) | as above | On "Full lungs" (144.96) the cursor glides back to the start (0.4 s) and the figure's lungs fill again; on "spring back" (145.83) a light runs down the falling line from its start (1.0 s) and the lungs' outline pulls in once; on "harder than a quiet note needs." (147.98) the held-back region lights. On "So at first" (150.57) the cursor walks silently from 0 to 3.5 s (150.57 to 156.00, sine.inOut), the readout back to "Now: holding back"; on "breathing-in muscles" (152.29) the dome glows; on "holding" (154.02) "held back" scales 1.2 | Full lungs push by themselves (FACTS 17, 18) | continuous | Gauge, figure |
| 6i  | 156.90-165.39 (b15) | as above | b13's two labels leave (156.90). On "As the air goes," (157.33) the cursor runs on to 8.5 s (157.33 to 158.60) and the lungs empty with it, the readout switching to "Now: adding" at the crossing; on "belly and rib muscles" (159.06) the belly wall moves in a little and the belly and ribs glow, "belly and rib muscles" lands under the figure, and the added region lights. On "can't push air out." (163.37) a solid chrome arrow draws from the dome up into the lungs (163.37 to 163.67) and an ink strike draws across it (163.80 to 164.10); "can't push air out" lands left of the torso with a leader to it | Step 2's reveal, ending on what the diaphragm can't do (FACTS 15) | continuous | Gauge, struck arrow |
| 6j  | 165.39-170.34 (o7) | as above | Tavi talks; Merc listens. The struck arrow, its label and "belly and rib muscles" fade (165.40 to 165.70). On "full lungs push by themselves," (165.72) the cursor glides back to the start and the lungs fill; the falling line's first stretch glows; on "hold some back." (168.96) the held-back region lights and "held back" scales 1.2. The cursor and readout fade at 170.10 | Her re-explanation (Step 2's own) | continuous | Gauge, figure full |
| 6k  | 170.34-178.83 (b16) | as above | On "Yes." (170.34) two chips, "Quiet" (lit) and "Loud", land over the frame's right end; on "loud note" (171.63) "Loud" lights and "Quiet" dims, "held back" and "added" fade, and the gold line rises (172.06 to 172.86, power2.inOut) so the crossing moves from 7 s to 3 s and both hatches redraw; on "less holding back at first," (172.92) "less holding back at first" lands under the frame's left end with a leader into the now small held-back region; on "more adding" (175.51) "more adding as the air runs low" lands under the frame's right end with a leader into the large added region, which lights | Both halves of FACTS 19 (94) | continuous | Loud gauge (HANDOFFS § S6 to S7) |
| 7a  | 178.83-182.27 (o8) | pull out (179.00 to 180.40, power2.inOut) from F-gauge to F0 · hosts at 240 | Tavi talks. The gauge folds back into a strip (179.00 to 180.20): hatches, lines, chips and labels fade, the frame closes down onto its floor and the strip's violet envelope returns there; the small band slides and shrinks to the card's first miniature place (right column, top); the figure fades as it drifts 60 px left (179.00 to 179.60). The four words return (179.20), lit "air pressure" and "diaphragm", and leave at 182.80. "COMMON MIX-UP" (mono 26 px, ink-2) lands top left (179.48); on "pushing hard," (180.77) her belief lands under it as a guess, "'support' means pushing hard, or squeezing" (Outfit 600 44 px, ink, a dashed ink-2 underline and a "?"), its last word on "squeezing?" (181.75) | The mix-up card's belief, as her question | continuous | Card row 0, miniature band, strip |
| 7b  | 182.27-187.36 (b17) | MWS · F0, static · a card in rows, left column type, right column drawings | On "mix-up." (183.57) "COMMON MIX-UP" scales 1.08. On "Pushing" (184.00) row 1 lands, "push harder: louder, and higher", and in the miniature band beside it the pushed take redraws in 1.2 s, silent, climbing out of the band while its small strip swells (184.10 to 185.30) | Evidence 1, as you heard (FACTS 7, 8) | continuous | Row 1 |
| 7c  | 187.36-198.06 (b18) | as above | On "Squeezing" (187.36) row 2 lands, "squeeze: a pressed sound, more pressure, not less". On "pressed sound," (189.52) the strip from the gauge splits into two side by side under one chrome arrow of air, "easy" tall and "pressed" much shorter, their names under them (189.52 to 190.32); on "heavy," (192.97) "pressed" scales 1.08; on "more air pressure," (195.55) "same push: much quieter" lands under the pair. No numbers, no sound (FACTS 95) | Evidence 2, seen | continuous | Row 2, two strips |
| 7d  | 198.06-206.32 (b19) | as above | The four words return (197.80) and '"support"' lights on '"Support"' (198.06), the row leaving at 202.20. On "word for how" (199.35) row 3 lands, "'support': how singers manage the breath"; on "no one agreed" (204.09) "no one agreed meaning" lands under it | What "support" names (FACTS 24a, 25) | continuous | Row 3 |
| 7e  | 206.32-216.35 (b20) | as above | "The better idea:" (Outfit 600 30 px, ink-2) lands on "A steady" (206.32); then its four phrases land as said, separated by middots: "steady air, not more of it" (208.04), "breathe in low" (210.63), "start easily" (211.92), "let it flow out unforced" (214.51). From 215.85 the rows leave up fast, 0.05 s apart, and the drawings fade (215.85 to 216.25), leaving the room and the hosts | The hook answered in the page's words (FACTS 10) | cut on act3 (216.35) | Empty room, hosts at 240 (HANDOFFS § B to C) |

### Chapters 3, 4 and 5 [C]

| #   | Time (cues) | Shot line | On screen | For | Out | Carried |
| --- | ----------- | --------- | --------- | --- | --- | ------- |
| 8a  | 216.35-218.70 (act3) | full-frame type over the empty room · hosts at 240, idle | Card "03 Breathing in" in from 216.72, out 218.20 to 218.58, over the room alone (s07's card has gone: nothing to dim) | Chapter breath | continuous | Room |
| 8b  | 218.70-220.52 (o9) | MWS · F0, static · centre: the figure stands on the floor line, x 820 to 1100, hosts small at the edges | Kicker "03 · BREATHING IN". The breath figure returns whole and upright, its strokes drawing from the spine outward (218.75 to 219.75), its legs and knees with it, feet on the floor at y 840: the same drawing as chapter 2's torso, now whole. On "breathe in?" (219.67) its lungs' outline glows. Tavi talks | Step 3's heading, as her question | continuous | Whole figure |
| 8c  | 220.52-229.06 (b21) | as above | On "tall" (220.96) a chrome arrow draws up the figure's back from heel to crown (0.5 s) and "tall but easy" lands left of the head; on "knees" (224.40) the knees soften 2 degrees and back and "knees unlocked" lands left of them; on "jaw," (226.13) the jaw line drops 4 px and a light runs down the neck, and "jaw · tongue · neck loose" lands right of the head. Each label is Outfit 600 36 px, ink, a world label with a 1.5 px chrome leader to its part | Step 3's posture cues, as instructions (FACTS 28) | continuous | Figure, three cues |
| 8d  | 229.06-237.37 (b22) | push in (229.10 to 230.50, power2.inOut) from F0 to F-chest, onto the torso; pull out (234.30 to 235.70) back to F0 | "knees unlocked" leaves before the push (228.90 to 229.10). On "breathe in quietly," (229.93) "breathe in quietly, low" lands left of the lungs; on "let the breath drop low," (231.22) the figure breathes in once, slowly (231.22 to 233.22): the dome flattens and lowers, the belly moves out, and "diaphragm at work" lands right of the belly with a leader to the dome (232.51; FACTS 29); on "shoulders still," (233.37) "shoulders still" lands above the shoulder beside a short level mark, and the shoulders do not move; on "taking as much" (234.24) the pull out starts and "as much as feels easy" lands right of the figure; the figure breathes out, slowly (234.30 to 236.30); "Singers breathe in different ways." (serif italic 48 px, ink) lands bottom right (234.60; FACTS 30). No ring, no count, nothing asks the viewer to breathe along (DECISIONS 12) | The breath in, as instructions only (FACTS 32) | cut on act4 (237.37) | Figure with its cues (HANDOFFS § S8 to S9) |
| 9a  | 237.37-239.72 (act4) | full-frame type over the dimmed figure | The figure dims to 25 % and its labels hide (237.52 to 237.72); card "04 Starting a note" in from 237.89, out 239.22 to 239.60; the figure back to full 239.60 to 239.80, its cue labels gone | Chapter breath | continuous | Figure |
| 9b  | 239.72-248.79 (o10, b24) | MWS · F0, static · the folds left, the trace strip right | Kicker "04 · STARTING A NOTE". On "how should" (240.05) the figure fades while a small chrome ring at its throat grows into Lesson 3's vocal folds seen from above (240.00 to 240.90) and slides to the left place (240.40 to 241.40, power2.inOut), "vocal folds, from above" (Outfit 500 28 px, ink-2) under them; the trace strip draws in at the right (241.00 to 241.60): a hairline 1.6 s long with the "ILLUSTRATION" chip over its right end. The four words return (244.20) and "onset" lights on "onset." (244.61), leaving at 248.40; "onset: how a note starts" lands over the strip's left end (244.61); on "three main ways." (246.33) three chips land under the strip, "Air first", "A catch", "Together", and each scales 1.08 on "Just listen." (247.62) | Name the onset; three ways, for listening | continuous | Folds, strip, chips |
| 9c  | 248.79-256.64 (b25, start-air) | as above | On "Air first:" (248.79) its chip lights and the strip's title becomes "Air first" (a label switch); the folds draw apart, a chrome arrow of air rising between them. start-air (254.74): the strip draws as it sounds, its head moving at the sound's pace: a layer of fine chrome dots (air, no note) for 0.35 s, then the wave grows under it from 0.25 s (FACTS 80); as the wave grows the folds close into vibration (the gap narrows and shimmers ±3 px). "air, no note" lands under the dots (255.30) | Air first, heard and drawn | continuous | Trace 1 |
| 9d  | 256.64-267.51 (b26, start-catch) | as above | On "A catch:" (257.07) trace 1 fades and the title switches to "A catch", with "LISTEN ONLY" beside it; on "pressed shut," (259.23) the folds close with a heavier stroke, no gap. start-catch (265.61): 0.15 s of nothing, then a short ink mark the strip's height at the click, then the wave at full height at once; the folds snap open into vibration at the mark; "the catch" lands under the mark (265.90) | A catch, for listening only | continuous | Trace 2 |
| 9e  | 267.51-275.41 (b27, start-together) | as above | On "Or together:" (267.94) trace 2 fades, the title switches to "Together" and "LISTEN ONLY" leaves; on "meet" (269.23) the folds move from apart to a slit. start-together (273.46): the wave starts and grows smoothly, no dots, no mark, and a gold tick (4 px, 40 px tall) lands on the strip at the onset, where air and sound begin at once | Together; gold for the fit | continuous | Trace 3, gold tick |
| 9f  | 275.41-287.07 (b27a, starts) | pull out (275.50 to 276.70, power2.inOut) from F0 to F-stack · hosts at 240 | The title and chips leave (275.45). In the pull the strip becomes a stack of three: trace 3 slides down to the third row, two empty rows appear above it, and "Air first", "A catch", "Together" land right-aligned before them; the folds shrink to the top left. On "the puff," (278.43), "the click," (279.72) and "neither." (280.59) each row's label scales 1.08 in turn. starts (281.37): the three play back to back 0.2 s apart and draw on their rows in turn, each row lighting as it plays (rows 1, 2, 3 empty and redrawn), the folds showing each start's state; then the dots of row 1 are circled in chrome, "the puff" (283.20); row 2's mark circled, "the click" (285.00); and for row 3 nothing to circle, "neither" (286.70) | Compare the three, back to back (FACTS 96) | continuous | Stack |
| 9g  | 287.07-300.98 (b28) | WS · F-stack, static | On "the third," (291.38) row 3 lights and rows 1 and 2 dim their strokes (their labels stay ink); on "the easy start." (292.24) "the easy start" (Outfit 600 40 px, ink) lands between rows 2 and 3 and the gold tick scales 1.2; on "soft 'h'," (296.55) a faint "h" (serif italic 120 px, ink-2 at 40 %) appears over row 3's start; on "only in your mind." (298.71) it fades over 1.2 s and "the h, only in your mind" lands under row 3 | Many teachers aim for the third (FACTS 39); the h, kept in mind | cut on act5 (300.98) | Stack (HANDOFFS § S9 to S10) |
| 10a | 300.98-303.33 (act5) | full-frame type over the dimmed stack | The stack dims (301.13 to 301.33); card "05 A steady note" in from 301.35, out 302.83 to 303.21; back to full 303.21 to 303.41 | Chapter breath | continuous | Stack |
| 10b | 303.33-310.72 (o11, b29) | push in (303.40 to 304.60, power2.inOut) from F-stack to F0 · Tavi at (1800, 840) and Merc at (110, 840), both back to 300 (303.40 to 304.00) | Kicker "05 · A STEADY NOTE". The stack and folds leave up fast (303.35 to 303.65) while the band chart rises 120 px into its place, fading in (303.50 to 304.50): Merc's band and amber line, its window now 10 s ("0" and "10 s" under the plot), "A, any octave" left of the line, the "ILLUSTRATION" chip, no level strip. On "A perfectly straight line?" (305.60) her guess: the same dashed ink-2 line as the cold open's, dead flat along the band's centre, x 400 to 1520 (305.93 to 306.58), with its "?"; Merc's line dims to 50 % under it. b29: Merc talks; on "ten seconds." (309.46) the "10 s" mark scales 1.2 | Her guess, the cold open's again (FACTS 86) | continuous | Chart in hold mode, dashed guess |
| 10c | 310.72-321.02 (demo) **signature 3, first half** | MWS · F0, static · Tavi sings (arcs on); Merc idles, turned to the chart | Tavi holds A4 for 10 s and her violet line draws as she sings: up from 60 cents low, through the page's hand-set wavers, into the band, then level with a small, even wave growing in (FACTS 80); the band's mint edge and "in the band" follow her centre in and out of the band exactly; once her centre has stayed in the band 0.5 s (about 311.9), a chrome "settled" flag stands on the band's top edge where it entered, "settled" above it (no number; FACTS 80). As her line passes 2 s (312.70 to 313.20) the dashed guess and its "?" fade and Merc's line returns to full. The line is whole at 320.72 | A steady note settles, and is not straight | continuous | Tavi's finished line |
| 10d | 321.02-331.82 (o12, b30) | push in (324.60 to 326.10, power2.inOut) from F0 to CU-scoop, onto the first second · Tavi stays at 300 | o12: on "scooped," (321.34) the line's first second glows; on "waves." (322.32) a light runs along its held wave. b30: on "Sung notes" (325.00) the push; the first 1.5 s of her line fade and redraw at a third of their speed (326.20 to 330.70, silent), a "SLOWED" chip at their start; on "a scoop." (330.61) "scoop" (Outfit 600 40 px, ink) lands under the low point | The scoop, seen slowly (FACTS 41) | continuous | Slowed first second |
| 10e | 331.82-340.74 (b31) | pull out (331.90 to 333.10, power2.inOut) from CU-scoop to F0 | "scoop" and "SLOWED" leave as the pull starts. On "small vibrato," (334.83) a chrome bracket marks the wave's height over the held part and "small vibrato: inside the band" lands above the band's right half; on "inside the band." (339.58) the mint edge glows and "in the band" scales 1.08 | A small vibrato sits inside the band (FACTS 42) | continuous | Chart |
| 10f | 340.74-350.09 (b32) | WS · F0, static | On "settles into the band" (342.46) the "settled" flag scales 1.2; on "stays," (344.62) a chrome bracket draws along the band's top from the flag to the end (0.6 s) and "steady: settles into the band and stays" lands in the label row; on "comfortable, fixed length," (345.91) a bracket under the plot spans 0 to 10 s and "a comfortable, fixed length" lands under it. Nothing names a length beyond the frame's 10 s | What steady means (FACTS 44) | continuous | Chart |
| 10g | 350.09-353.84 (o13) | as above | Tavi talks; Merc listens. On "steady air" (351.06) her guess lands above the band's left end, "steady air keeps it there?" (Outfit 600 40 px, ink-2, a dashed underline and a "?") | The overreach, as her guess (FACTS 86) | continuous | Guess label |
| 10h | 353.84-364.73 (b33) | MWS · F0 · the hold frame slides to the right half (353.90 to 355.10, power2.inOut), where the turn will use it | On "No." (353.84) the guess fades (353.90 to 354.20) and the frame slides right and shrinks, Tavi's line with it; the voice box draws on at the left (354.50 to 355.50): Lesson 3's folds from above inside a rounded outline, two small chrome muscle bands beside them; on "voice box" (355.56) "voice box" lands; on "set the note." (356.42) the muscle bands glow and "muscles here set the note" lands under the box. On "A steady note" (357.72) Tavi's line fades from the frame (357.72 to 358.22); on "needs" (359.01) "a steady note needs steady air too" lands at the left. On "because" (360.73) the Push slider draws under the frame, its thumb at 50; from 361.20 a silent violet line draws in the frame while the thumb never stops: 50 to 75 to 50 to 70 to 50 (361.20 to 364.30, each leg sine.inOut), the line climbing and returning with it (Push's rule, FACTS 73), "ILLUSTRATION" on the frame; on "moves it." (363.32) "a change in the air moves it" lands under the earlier line. **Never a still slider over a still line** (BRIEF). From 364.30 the slider, the line, the box and the type fade, leaving the empty frame | What sets the note; why a steady note needs steady air (FACTS 91) | cut on sing (364.73) | Empty frame at the right half (HANDOFFS § C to D) |

### Sing it and your turn [D]

The care block is frame-fixed, left-aligned at x 260, every line within x 260 to 960 and nothing
of it below y 864 (HANDOFFS § Inside D). The hold frame, the ring and the feel answers stand right
of it, x 1000 to 1700.

| #   | Time (cues) | Shot line | On screen | For | Out | Carried |
| --- | ----------- | --------- | --------- | --- | --- | ------- |
| 11a | 364.73-367.08 (sing) | full-frame type over the dimmed frame · hosts at 300 in the corners | The empty frame dims (364.88 to 365.08); card "Sing it" (chrome serif italic 170 px, no numeral, centred, baseline 480) in from 365.10, out 366.58 to 366.96; the frame back to full | Chapter breath before the voice's turn | continuous | Empty frame |
| 11b | 367.08-371.16 (b34) | MWS · F0, static · the care block left, the frame right | On "Your turn:" (367.08) "Your turn." (serif italic 110 px, ink) lands top left; on "comfortable note," (368.37) the frame's band glows; on "ten seconds." (370.10) a bracket draws under the frame, 0 to 10 s, with "10 s" under it; "Nothing listens" (Outfit 600 30 px, ink) lands under the frame (370.60) and stays to the end of the turn (FACTS 87) | The task, before any care line | continuous | Frame, title |
| 11c | 371.16-381.19 (b35, b36) | as above | On "care lines" (372.02) the doctor lines land at the block's foot in small type (Inter 30 px, ink-2, five lines, word for word; HANDOFFS), where they stay to the end of the turn. On "Sore," (377.40) the comfort line lands in bold beside the care icon (the app's own SVG): "Sore, hoarse or unwell today?" and, on "Just" (379.55), "Just listen along." under it (Outfit 700 36 px, ink) | Care first (FACTS 47, 48, 51) | continuous | Care block |
| 11d | 381.19-398.35 (b37) | as above | The six reasons in short land under the comfort line as Merc names them (Outfit 500 30 px, ink): "hurts or uncomfortable" (382.92), "unusually hoarse or tired" (387.23), "usual notes suddenly gone" (391.54), "ill" (393.26), "talking or singing is hard work" (394.56), in three lines joined by middots | The comfort check, all six (FACTS 49) | continuous | Care block |
| 11e | 398.35-402.58 (b37a) | as above | On "Listening along?" (398.35) the ring draws on right of the block, under the frame (398.40 to 399.20: a chrome circle 10 px wide at 35 %, its 12 o'clock tick, no counter yet); on "Rest your voice" (399.22) "listening along: rest your voice and watch the ring" lands in the block; on "the ring." (401.37) the ring scales 1.05 once | The listener's place in the turn (the lead's line) | cut on b38 (402.58) | Care block, ring, frame (HANDOFFS § S11 to S12) |
| 12a | 402.58-406.66 (b38) | as above | On "my A," (403.45) "A3 · Merc" (a blue dot before it) lands under the frame's band and Merc's amber line glows; on "an octave up." (405.17) "A4 · Tavi, an octave up" (an orange dot) lands beside it | The voice choice, in one line | continuous | Voice labels |
| 12b | 406.66-420.86 (b39, b40) | as above | Under the ring, "Listen · Breathe · Sing" lands (mono 28 px, ink-2) and each word lights to ink as Merc says it: "Listen" (406.66), "Breathe" (408.39), "Sing" (410.97); on "at about speaking volume." (412.70) "at about speaking volume" lands under them. b40: on "ring closes," (416.78) the ring's 12 o'clock tick brightens; on "stop sooner" (418.07) "stop sooner if you need to" lands under the last label | The page's briefing, its three phases | continuous | Ring and its labels |
| 12c | 420.86-424.04 (b41) | as above | On "Stop" (420.86) the stop line lands in the block, carried whole: "Stop immediately if anything / feels uncomfortable." (Outfit 600 36 px, ink, two lines) | The stop line, before any singing (FACTS 50) | continuous | Care block whole |
| 12d | 424.04-428.20 (listen, b42, breathe) | as above · both hosts sing (arcs on both) for listen only | listen: Merc and Tavi sing their A together (FACTS 80); "A3 · Merc" and "A4 · Tavi" each scale 1.08, "Listen" glows, the frame's band brightens. b42: "Breathe" lights; "Breathe in, low and quiet" lands over the ring (426.14); the ring breathes once, growing to 1.08 and back (426.10 to 428.10, sine.inOut); nothing counts down | Merc's note in both octaves, then one breath | continuous | Ring |
| 12e | 428.20-438.30 (tick-in, hold, tick-out) **signature 3, second half** | MWS · F0, static · both hosts idle, turned to the ring, no arcs, never `listen` | At the first tick (428.10) "Sing" lights, "Breathe in, low and quiet" leaves, and the ring starts to turn: its chrome arc fills clockwise from 12 o'clock at an even pace and closes at the second tick (438.20); inside it a counter (Outfit 600 80 px, tabular) shows the seconds, 1 to 10, each change a 0.15 s switch; a chrome playhead (3 px, the band's height) sweeps the frame's 10-second window in step. No violet line, no reading, no microphone: the frame stays empty but for the playhead. Room tone only. At the second tick the ring closes and sends one chrome echo ring | The viewer's ten seconds; nothing listens (FACTS 87, 97) | continuous | Closed ring, frame |
| 12f | 438.30-445.38 (b43, feel) | as above | The ring, its labels, the counter and the playhead fade (438.60 to 439.00). On "How did that feel?" (439.00) "How did that feel?" (serif italic 64 px, ink) lands where the ring was, and its four answers land under it as capsules on their words: "Easy" (440.73), "Workable" (441.16), "Effortful" (441.59), "Uncomfortable" (442.45). feel: a small ring timer beside the question; the pad swells | The feeling question, the page's labels (FACTS 52) | continuous | Four answers |
| 12g | 445.38-459.80 (b44, b45, b46) | as above | Each answer lights as Merc names it, the one before dimming its capsule's stroke (its label stays ink): "Easy" and "Workable" (445.38) with a bracket joining them to "rest a few easy breaths" (on "Rest", 446.68); "Effortful" (449.61) to "rest before you sing again" (451.34); "Uncomfortable" (453.84) to "enough singing for today" (456.43) | What each answer leads to | continuous | Answers and their lines |
| 12h | 459.80-478.09 (b46a) | as above | On "Whatever you chose:" (459.80) all four answers light together; the block's middle (the title, the comfort line, the reasons, the listening line, the stop line) fades (459.85 to 460.25) and the doctor lines rise and grow to full size (Inter 40 px, ink, six lines, re-broken as a cross-fade rising 12 px, 460.00 to 460.80), held while Merc says them; on "see a doctor" (465.83) its words underline in chrome; on "get help straight away." (475.31) its words underline. From 477.10 every mark of the turn fades but the frame (477.10 to 477.60) | The doctor lines, for every answer, full size while said (FACTS 51) | cut on recap (478.09) | Frame at the right half (HANDOFFS § D to E) |

### Recap, practise, next time, end [E]

| #   | Time (cues) | Shot line | On screen | For | Out | Carried |
| --- | ----------- | --------- | --------- | --- | --- | ------- |
| 13a | 478.09-484.78 (recap, b47, b48, q1) | MWS · F0, static · the panel top left, the object right, hosts at 300 in the corners | Kicker "QUICK CHECK" (478.24). The frame dims its strokes (479.00 to 479.40), stepping aside. On "What is" (479.75) the card panel lands (x 120 to 960, y 140 to 330) with "What is your diaphragm's main job?" (Outfit 600 40 px, ink); the breath figure's torso draws on at the right (480.50 to 481.30). q1: a ring timer in the panel; the pad swells | Recap question 1 (FACTS 88) | continuous | Panel, figure |
| 13b | 484.78-486.00 (b49) | as above | On "Breathing" (484.78) the dome flattens and the belly moves out (484.78 to 485.98), and "Breathing in." (serif italic 64 px, ink) lands under the panel | Answered by the object that taught it | continuous | Figure |
| 13c | 486.00-497.85 (b51, q3, b52) | as above | The panel's line switches to question 3 in two lines (486.00); the figure fades (486.00 to 486.40) and the three traces stack in at the right as chapter 4 left them, smaller (486.20 to 486.90). q3: ring timer. On "together:" (495.77) row 3 lights and its gold tick scales 1.2, rows 1 and 2 dimming their strokes; "Air and sound starting together: the easy start." (serif italic 56 px, two lines) lands under the panel | Question 3, answered on the traces | continuous | Traces |
| 13d | 497.85-508.24 (o14a, q4, b54) | as above · Tavi asks from her corner | The panel switches to question 4, Tavi's (497.85); the traces fade and the frame comes back to full (498.00 to 498.60). q4: ring timer. On "settles" (504.93) Tavi's line from chapter 5 redraws in the frame, silent, in 2.4 s: the scoop, the wavers, the band, its small wave; the mint edge and "in the band" light and the "settled" flag stands; "It settles into the band and stays there." lands under the panel | Question 4, answered by her own line | continuous | Frame with her line |
| 13e | 508.24-519.09 (b55) | MWS · F0, static · the Voice Mirror card left, x 210 to 1100 | **A clean break**: on "Practise it." (508.24) the kicker, the panel, the answer, the frame and its line leave up fast in turn (508.30 to 508.80). Then the card builds under its own name: its rounded panel (chrome 25 %) and "Practise it." (508.67); "Voice Mirror" (serif italic 96 px, ink) with a rule under it (509.11); the tasks as glyphs and words: "glide up" (510.83), "glide down" (512.12), "a six-second hold" (512.55), "five notes" (516.86); on "plays." (518.16) the hold's readout, type only and word for word: "For the hold, it shows in cents how fast the note drifted and how much it wobbled, and a vibrato isn't counted against you." (Inter 32 px, three lines). Its six seconds never stand beside the film's ten: the frame left 4 s before | The practise card, word for word (FACTS 89) | continuous | Card |
| 13f | 519.09-528.01 (b56) | as above | "Keep the glides comfortable." (519.09); "Sore, hoarse or unwell today? Just listen along." (520.81); "Free, no account: mercurypitch.com/mirror" (Outfit 600 40 px, 524.26), its address underlined in chrome on "mercurypitch" (525.55); as b56 ends (527.40), under the card, type only and word for word: "Ten minutes, gently, most days. Missed a day? Just come back." (Inter 34 px, ink-2) | The card's lines, each on its word | continuous | Card complete |
| 13g | 528.01-540.47 (b58, card) | as above · the rest card right, x 1150 to 1690 | On "Felt uncomfortable," (528.01) the rest card's panel lands right with its condition, 'after "Uncomfortable" or listening along' (Outfit 500 28 px, ink-2); "Rest today" (serif italic 72 px, 530.59); "Voice Mirror will be here when your voice feels comfortable:" (Outfit 500 32 px, two lines, 531.46); "mercurypitch.com/mirror" (Outfit 600 36 px, 535.77), underlined; no "Ten minutes" line. card: 2 s with no voice, both cards drifting up 14 px (sine.inOut), the hosts idle. From 539.60 the cards' lines leave up in turn, 0.03 s apart, and fade, while the first of the "five notes" glyph's dots brightens, grows into a 20 px chrome bead and glides to the tease's first place (539.70 to 541.30, power2.inOut), across the cut. Merc hops twice to (1290, 840), under where the tune will stand, once the cards' lines have gone (540.40 to 541.50, across the cut) | Both endings, read whole | continuous: the bead in flight | The bead (HANDOFFS § S13 to S14) |
| 14a | 540.47-546.23 (next, b59, twinkle) | WS · F0, static · the beads centre left, Merc under the tune, Tavi in her corner | Kicker "NEXT TIME" (540.62). The bead lands on the first bead's place, C4's row, with a squash (541.30); faint semitone rows fade in under it (541.00 to 541.60) and the other six beads fade in on their rows as chrome outlines (541.30 to 541.80), unnamed. b59: Merc talks. twinkle: Merc sings the first line once, from C (arcs on), and each bead lights blue on its note's onset with an echo ring; the last is held | The tune, heard once, untouched (FACTS 99) | continuous | Seven lit beads |
| 14b | 546.23-550.41 (b60) | as above | On "I move" (546.23) "Merc moves every single note of 'Twinkle, Twinkle' up." (Outfit 600 44 px, ink, centred) lands top; on "every single note" (547.10) a thin chrome arrow rises from each bead six rows up, one after another (0.08 s apart), and a dashed ink-2 copy of the seven beads draws there, silent, with a "?" right of it (547.60) | The set-up, never its answer (the copy is never played) | continuous | Beads, dashed copy |
| 14c | 550.41-556.01 (o15) | as above | The tease line leaves up (550.45 to 550.75); Tavi asks; Lesson 6's hook lands in two lines, serif italic 60 px, centred: 'Why can you start "Twinkle, Twinkle" on any note' (550.41) and "and it is still the same tune?" (553.34). The hook leaves up fast at 555.65 to 555.95, and the beads, the copy and the "?" shrink toward the end card's top right on one curve (555.70 to 556.90), across the cut | Lesson 6's question | continuous | The tease figure, in flight |
| 15  | 556.01-562.01 (end) | WS · slow push in 3 % (sine.inOut) to the last frame · the hosts right: Merc grows in place to 400 at (1290, 840) and Tavi hops 190 px left to (1610, 840), growing to 400 (556.05 to 556.75) | The tease figure settles small at the top right (556.90). The lockup is revealed top left by a feathered wipe (556.15 to 556.65); "mercurypitch.com/mirror" (Outfit 600 72 px, ink) lands under it (556.40) and "Voice Mirror is free, with no account" (Outfit 500 44 px, ink) under that (556.60); all at rest by 556.95. The lower-left third stays clear for YouTube's next-video element, with room for Subscribe between it and the hosts; Lesson 1's end chimes. Complete for 5.06 s, the hosts idling past the last frame | The address, again; the series continues | end | none |

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
| m-blue | 58.87 to the film's end, past it | Leap in from the left edge (opening 1.38 s before b6; in the air 59.02 to 59.45, settled 59.67). Talks his lines; sings `gauge` (S6f, arcs on), `listen` (S12d) and `twinkle` (S14a); idles through the takes, the Push note, the starts and Tavi's `demo` (no arcs: only the host making the sound shows them, trap 14); `idle` through the viewer's hold, no arcs; two hops right (540.40 to 541.50) | 300; 240 (S6 to S9); 400 (S15) | front, turned toward the subject |

Notes for `tools/merc-shots.py`:

- `easy`, `pushed`, `push`, the starts and `starts` are `sound` events with no singer: both hosts
  `idle`, turned to the drawing, so no one is seen making a pushed note or a catch (FACTS § 4, the
  coach's "for listening only").
- The scoring is Lesson 4's: `sing` from 0.15 s before to 0.15 s after a host's sound, talk on the
  host's lines, `listen` while the other host talks, `idle` otherwise. The one difference: in
  `hold` both are `idle` with no arcs, and the pad is silent, so a muted viewer reads the ring, not a
  host, as the clock.
- Two entrances in the film, both leaps, from opposite edges; one exit pair (S1h's slide, Lesson
  4's); no `drop` anywhere.
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
4's critics found so it is designed out here, not found again.

- **Holds.** Each scene's lab clip goes through `measure.py render` before it joins the film: no
  hold over 0.5 s outside the end card, and no more than about 1.8 s of holds per 30 s in a clip
  with no host on screen (S2, S3). Check first: S3 (no host: the truck must move content at 8 px a
  second or more in its middle, 44.0 to 52.0), 1d (the predict: ring timer and idles only), 6e (the
  predict's 2 s), 6f (one cursor and the drawing behind it: the push must register), 12e (the
  viewer's 10 s: the ring, its counter and the playhead must each register as moving), 13g's
  `card` (two cards drifting 14 px: if the drift measures as a hold, raise it to a counted event)
  and 15's last 5 s.
- **No single-frame pops** (Lesson 4 FILM1's largest event was tiles popping on at 25 %): every
  object fades or draws in over 0.2 s or more; nothing appears or vanishes on one frame.
- **No empty frames at joins** (Lesson 4 FILM1, F-01): every cut carries an object across it (each
  is named in the Carried column and fixed in HANDOFFS); S13 to S14 carries a bead from the card's
  glyph, S14 to S15 the tease figure.
- **The gauge's labels build in stages** (script critic 02): in the lab clip of S6, no two of its
  seven labels ("push of air (not pitch)", "one 10-second note", "the lungs' own push", "what the
  note needs", "held back", "Now: holding back", "added", then "Now: adding") land within 0.4 s of
  each other, and "added" and "Now: adding" land only at or after the 7 s crossing.
- **The pushed take stays drawn** whole and still from 25.48 through b3 to o2's "told to" (FACTS
  80): a still at 30.80 shows it complete, above the band at its end.
- **Never a still slider over a still line** (BRIEF): in 10h, from 361.20 to 364.30, the thumb's
  speed is never zero for more than one frame between legs.
- **Nothing listens**: in S12 no violet line, no microphone, no reading, no host in `listen`; the
  ring is a clock (it fills at an even pace and counts seconds; it never pulses with any sound).
- **Every move reads as itself** (shot grammar § 4): the pushes, pulls, the truck and the crane show
  the far, mid and near layers parting (Lesson 4 A-01 to A-03 found its pushes reading as zooms
  until the bokeh carried them); S1h reads as a pass through the line's light, not a dissolve.
- **Contrast**: every settled label at 4.5:1 or better in the lab clip, above all "in the band" and
  "sung easily" beside the band's amber fill, the gauge's labels over the hatches, the doctor lines
  (ink-2 at 30 px) and the rest card's condition (ink-2 at 28 px).
- **Pulses** scale about the label's left baseline and move no type a whole pixel per frame as it
  settles (Lesson 4 E-02, E-03).
- **Keep-out**: no label, mark or drawing within 20 px of a host's body box, in every framing,
  including the moves (HANDOFFS § Shared formulas). Watch S10's CU-scoop (the band's bottom at y
  625.5 against Tavi's keep-out from y 628) and 13g's hops (Merc starts once the cards' lines have gone).
- **Captions**: nothing essential below y 896; the care block above y 864.
- **Honesty**: nothing on screen that FACTS does not hold; "ILLUSTRATION" on every drawing of a
  take, the Push note, the gauge, the starts and Tavi's hold; no number on Tavi's hold; no "15" or
  "fifteen" anywhere; Voice Mirror's six seconds only on its card, after the clean break.

## Open for the owner

- The voices: the scratch Kokoro pass, then the owner's ElevenLabs voices on the owner's word
  (DECISIONS 38). The board re-times itself from the cues; only the board clock's numbers change.
- The vocal coach signs off the care block, the turn and the lines marked `[coach]` before the
  final voices (MASTER-PLAN § 7), and the film at the day-6 gate. Nothing on this board adds a
  coach line; it puts the care lines on screen as the brief words them.
- The end card's lower-left third is left clear for YouTube's end-screen elements; the owner
  places them in YouTube Studio.
