# Lesson 19 web page: spec

The Lesson 19 page is the web lesson for "Threes, offbeats and syncopation": written steps, one main
toy in four step states with a compact state for the hero and free play, one predict, the four
words, a checkpoint that times the learner's taps on the beat of two tunes, two quizzes (the recall
and the quick check) and the lesson explorer. Copy is in [LESSON.md](LESSON.md); every claim is in
[FACTS.md](FACTS.md). It is a text-only package: no film exists for Lesson 19, so the page has no
Watch section and the masthead's anchors are Lesson, Tap the beat and Explorer. Nothing on it is
sung.

It is built on the kit (`src/features/lessons/kit/`) as Season 2's kit PR leaves it (SEASON-2 § 8.2
item 1): the season structure, the staff toy with both clefs, rhythm on the staff and the lesson
plumbing, and on Lesson 17's page, whose rhythm bar and tap take this page reuses and generalises.
Like every lesson page it reuses and never copies: a part that lives in an earlier lesson's module
moves into the kit first. Where this page shares a behaviour with Lesson 17's, it is Lesson 17's,
unchanged unless this spec says otherwise (Lesson 17 WEB-SPEC, Toys 1 and 7). Its drums are the Ear
Lab's Subdivide's, its click the Ear Lab's woodblock (Audio).

One object carries the lesson: Lesson 8's pads, six in a row, which the page groups and then writes
down. In the hero the six pads sound six even notes, then group in threes and in twos. In Step 1 the
same six are written as a bar of 6/8 or of 3/4; in Step 2 two tunes in those metres sit on the
learner's staff with their counts; in Step 3 one beat of a 4/4 bar splits in three; in Step 4 a note
leaves beat 3 for the "and" before it. It is the card's signature: "Lesson 8's six pads, regrouped:
3 + 3 lights two big beats, 2 + 2 + 2 lights three" (FACTS 4).

Its public home is `mercurypitch.com/learn/19` (SEASON-2 § 7 item 1): a hand-written document
`learn/19.html` with its module in `src/features/lessons/lesson-19/`, wired as Lesson 8's page is. It
joins `kit/drafts.ts` in its first commit, held back on mercurypitch.com until the console publishes
it, and it publishes only after `/learn/17` is live, because its prerequisite chip and its recall
link there; nothing on it waits on the vocal coach (FACTS 51). The next-lesson card on Lesson 18's
page draws this lesson's tease above its hook from the season data, and this page's card draws
Lesson 20's; neither is written into a page's markup (FACTS 5, 5b).

## The checkpoint: how it takes input

The card's checkpoint is "tap the beat under a 6/8 tune and then a 3/4 tune, two taps a bar against
three; optionally, say the count aloud" (SEASON-2 § 3, Lesson 19). The lead's answer keeps it
tapped, on Lesson 17's take, and puts naming the metre into the quick check (FACTS 4, 69).

- **Why taps.** A page hears a clap only through the microphone, and this page opens none (FACTS
  31). The count aloud is the learner's own and nothing hears it.
- **Each tune plays twice.** The first time the click plays every beat and the learner taps with
  it; the second time the click stops and the learner keeps the beat on their own. The first time
  lines the taps up with the sound, as Lesson 8's two bars of beat taps do; the second is judged
  (FACTS 32, 36). Without the click the taps show the beat held, not a click followed.
- **What is measured.** Each tap's time is its event's timestamp on the page's clock; each beat's
  time is where the audio clock put it, mapped through the beat clock, as on Lesson 17's page. Drum
  Night's estimator, bounded at 0 to 250 ms and needing five taps, takes the first pass's median
  offset from every second-pass tap (FACTS 32).
- **The window and the judge.** A lined-up tap meets a beat within 120 ms of it,
  `TOLERANCE_MS.quarters`; the beats are 1 s or 0.67 s apart, so the window stays far under half of
  that. The taps are matched to the second pass's beats by the Ear Lab's `judgeTake`, imported,
  never copied (FACTS 33).
- **What the page says, and what it draws.** The line counts the beats that got a tap and the taps
  that fell between them, and names the other metre's beats when most of the extra taps fell there.
  Early and late are drawn, not said: each second-pass tap is a tick where it fell, against the beat
  the learner set with the click. The strip is hidden from a screen reader and the line speaks for
  it (FACTS 34).
- **Audio on the audio clock.** Every click, drum, note and clap is started at a time on the
  AudioContext's clock through the beat clock; nothing is started or stopped by a timer (Audio).

## Look

Lesson 17's look, unchanged: the dark listening room, the series colour code, Lesson 1's type and
wordmark, and the motion rules (Lesson 17 WEB-SPEC, Look). On this page:

- **Notation** is drawn in ink `#e6edf3` on chrome lines `#c3ccd6`: noteheads, stems, flags, beams,
  dots, ties, rests, the triplet's 3 and the time signatures 6/8, 3/4, 2/4 and 4/4. A note lights
  while it sounds, in blue `#58a6ff` on the bass staff and orange `#ff7448` on the treble, the
  singers' colours by clef, as on Lesson 17's page (FACTS 10).
- **The groups** are drawn as an arc under each group of pads, in ink-2 `#a8b3bf`, as each group
  starts: two arcs of three, or three of two. Before a choice no arc is drawn (FACTS 1a).
- **Gold** `#ffd84d` marks only the fit: in the checkpoint, a tick whose tap met its beat (MASTER-PLAN
  § 5).
- **The counts** sit under the notes in ink-2, each lighting in ink as its note sounds; a count in
  brackets stays ink-2 (FACTS 28).
- **No decorative staves or clefs** anywhere: in a season that teaches the staff, a staff is always
  music (SEASON-2 § 1.5 item 7).
- **Nothing is in tune or out of it**, and nothing is scored, so the page uses no target band, no
  singer violet and no mint.

What moves: Merc and Tavi's idle loops and hops; while something the learner started plays, the lit
pad, the arcs as each group starts, the notes as they sound and the counts. Under
`prefers-reduced-motion`, or with the masthead's Pause animations on, Merc and Tavi neither idle nor
hop, the arcs and notes appear at once, and what the learner starts still sounds (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Season 1's departures kept: the step toys double as the
Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it; the practice
card sits in the Wrap. No Watch section. The page opens in Lesson 2's order (FACTS 5a). Items 2 to 5
are the hero, laid out as Lesson 17's. Each section's heading, and the line above it, are in
LESSON.md ("Section headings").

1. **Masthead**: Season 2's, "Season 2 · Lesson 19", with Lesson, Tap the beat and Explorer, the
   lesson menu (its card headed "Lesson 19 · What do the numbers in 6/8 mean?") and the tour.
2. **The hook**: the kicker, the hook question as the title (`h1.hook#hook`), the meta as three chips,
   and the promise.
3. **The stage**: Tavi's and Merc's bubbles over Merc and Tavi on the floor line, the six pads
   between them (Toys 2).
4. **The sound gate**: LESSON.md's line and its button.
5. **The cold open's predict**, `#predict`: the predict card under the stage (Toys 3).
6. **Recall from Lesson 17**, `section#recall`, straight after the hero (Toys 9).
7. **Four words you'll meet**: accent, offbeat, triplet and syncopation (Toys 4).
8. **The steps**: the kit's sticky stage and step deck ("N of 4", Previous and Next), every step on
   one toy (Toys 6); Step 1 holds the mix-up card and Step 2 the Go deeper drawer (Toys 10).
9. **Tap the beat**, `#tap`: the two takes (Toys 7).
10. **Quick check**: LESSON.md's four questions (Toys 9).
11. **Wrap**: the three recap lines, the challenge, the practice card, free play (Toys 8) and the
    next-lesson card with its tease still (Toys 11).
12. **Lesson explorer**: the kit's, with Lesson 19 as the current node, on Season 2's tab.
13. **Footer**: Lesson 1's, with "Season 2 · Lesson 19 · Threes, offbeats and syncopation", the
    practice link and "Every sound on this page is synthesised in your browser."

## Length

The learner copy is 1,780 words on `scripts/lesson-words.mjs`, every branch counted, under the
series' cap of 2,379 by 599 (FACTS 3). The page runs about 12 minutes: 7.48 minutes of reading at
238 words a minute and about 5.0 of sound, toys and tasks, at the top of MASTER-PLAN § 4.2's budget,
"8 to 12 minutes of active time, 500 to 900 words", in minutes, and past it in words, as every page
from Lesson 3 is. The chip's figure is an estimate until the staff toy and the rhythm toy are timed
in their labs, as SEASON-2 § 1.3 asks. Each step's own text, with its Try and its Notice, runs 94 to
119 words (Steps 1 to 4: 119, 120, 94 and 115), inside § 4.2's 50 to 120 a step. Two parts carry more
beside it:

- **Step 1, 212 words with its mix-up card**, which sits in the step whose toy refutes it.
- **Step 2, 220 words with its Go deeper drawer** (three items), closed by default.

The hints and status lines are stage directions in LESSON.md and are not counted, as in the text
packages of Lessons 9 to 17. A built page writes them in the open and counts them, about 150 words
more (Lesson 8 FACTS 4), so the built page is about 1,930 words, under the 2,230 the series aims for
and the cap. No cut is needed.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                           | New in Lesson 19                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 1. The rhythm bar         | Lesson 17's rhythm bar (its notes on the audio clock, Count, the pitch-line view, Clef); Lesson 8's pads and beat clock; Subdivide's drums       | Six pads and their arcs; 6/8, 3/4 and 2/4 beamed by beat; a triplet's 3; a tie at beat 3; three switches |
| 2. The hero's six pads    | Toy 1's six pads in the compact strip (`kit/beat-strip.ts`); the kit's hop (`kit/merc-hop.ts`)                                                   | The three plays and the arcs                                                                             |
| 3. Predict widget         | The kit's predict (`kit/predict.ts`) with a free play before the choice, `revealOn` and `revealAfter: 'all'`; the tour hold (`kit/tour-gate.ts`) | Nothing                                                                                                  |
| 4. Four words             | The kit's words strip (`kit/words-strip.ts`); Lesson 17's written figures                                                                        | Four figures: the accent on the pads, three written as they play                                         |
| 5. Step 2's staff         | Season 2's staff toy with both clefs (SEASON-2 § 6.2 item 2); Lesson 17's Count and Clef                                                         | Two tunes in 6/8 and 3/4                                                                                 |
| 6. Step states            | The kit's step deck and stage fit                                                                                                                | Four states of Toy 1                                                                                     |
| 7. The checkpoint         | Lesson 17's take, moved into the kit (its pad, lining-up, judge, ticks and status lines)                                                         | Two tunes as the take's sound; the click stopped for the judged pass; the beats as onsets; its lines     |
| 8. Free play              | Toy 1 in a card, as Lesson 17's free play                                                                                                        | Nothing beyond Toy 1                                                                                     |
| 9. Recall and quick check | The kit's quiz (`kit/quiz.ts`); Lesson 17's question objects, imported                                                                           | Quick check 2's play                                                                                     |
| 10. Go deeper drawer      | Lesson 2's `details` drawer                                                                                                                      | Three items                                                                                              |
| 11. Tease still           | The kit's next-lesson card and its slot (`kit/next-card.ts`)                                                                                     | Nine beads on the pitch line                                                                             |

### 1. The rhythm bar

Lesson 17's rhythm bar (Lesson 17 WEB-SPEC, Toys 1), with what this page adds:

- **Six pads a bar.** A row of six of Lesson 8's pads, one per eighth, numbered 1 to 6, all one
  size, each lighting as its note sounds; on a phone six columns of at least 44 px (FACTS 70).
  Lesson 8's row draws at most four (FACTS 54), so the six-pad row is new in the kit. Steps 3 and 4
  keep Lesson 17's four pads, one a beat.
- **Arcs.** When a bar is grouped, an arc is drawn under each group of pads as the group's first
  note sounds, and stays until the bar is played again or regrouped: two arcs of three for 6/8, three
  of two for 3/4. An ungrouped bar draws none.
- **The written bar** above the pads, on one line (Steps 1, 3 and 4) or on the staff (Step 2), drawn
  by the kit's rhythm on the staff, which this page needs to write: the time signatures 6/8, 3/4,
  2/4 and 4/4; beams by beat, 3 + 3 in 6/8, 2 + 2 + 2 in 3/4 and by quarter in 4/4 and 2/4; dotted
  quarters and dotted halves; a triplet of eighths beamed with a 3 over the beam and no bracket; and
  Step 4's eighth tied to a quarter at beat 3 (FACTS 15, 41, 43, 52). Every written bar plays, and
  every note is written as it first sounds, as on Lesson 17's page.
- **Count**: the counts under the notes, each lighting as its note sounds: "1 and a 2 and a" in 6/8,
  "1 and 2 and 3 and" in 3/4, "1, 2 and, 3 trip-let, 4" in Step 3, and held beats in brackets,
  never lit (FACTS 22, 24, 28, 40). The counts are written, never spoken (FACTS 75).
- **Switches**: 6/8 · 3/4 regroups the same six notes, its beams, its arcs and its drums, and
  plays nothing until Play; Eighths · Triplet and On 3 · On 2 and swap one beat of a 4/4 bar. A
  switch is a pair of buttons, `aria-pressed`, reachable by keyboard (FACTS 44).
- **The pitch-line view**, "See it on the pitch line", on Step 2's staff, as SEASON-2 § 1.4 item 1
  asks of every staff toy. Steps 1, 3 and 4 write their bars on one line over the pads, Step 1's on
  drums with no pitch and Steps 3 and 4 on one note, so the pads are their picture and they have no
  such switch.
- **Drums**: Step 1's bars play on Subdivide's drums: 6/8 the kick, hi-hat, hi-hat, snare, hi-hat,
  hi-hat; 3/4 the kick, hi-hat, snare, hi-hat, snare, hi-hat; the first hit of each bar at full level
  and the rest at 0.7, each eighth a third of a second, one bar, 2 s (FACTS 18, 65).

### 2. The hero's six pads

Toy 1's six pads in the compact strip, under Merc and Tavi, with no written bar and no arcs until a
grouping plays. Three plays, each two bars, 4 s (FACTS 64). Play six notes starts 0.1 s after the
press; the two groupings start 0.6 s after it, Lesson 8's lead, with each hop booked `HOP_MS` before
its kick or snare, so the first hop, which takes 530 ms to land, starts after the press (FACTS 57):

- **Play six notes**, before and after the choice: twelve closed hi-hats a third of a second apart, all
  at 0.7; the pads light one by one; no arc, no hop.
- **Play in threes**, after a choice: in each bar the kick on pad 1, the snare on pad 4 and the
  hi-hat on the rest; two arcs of three, each drawn as its group starts; Merc and Tavi hop on the
  kick and the snare, twice a bar.
- **Play in twos**, after a choice: in each bar the kick on pad 1, the snare on pads 3 and 5 and the
  hi-hat between; three arcs of two; the hop three times a bar.

Starting any play stops the one sounding. After the reveal the three plays stay, and the arcs of the
last grouping played stay drawn. The share card draws the six pads ungrouped, with the title.

### 3. Predict widget

The kit's predict with the choices "In threes" and "In twos". Play six notes is free before the
choice; Play in threes and Play in twos have `revealOn: ['threes', 'twos']` and `revealAfter: 'all'`,
so the reveal waits until both have been heard to their end (FACTS 59). The hints, in order:
"Choose an answer to unlock the two groupings." until a choice; "Locked in. Play both groupings,
and watch Merc." after it, until the reveal (no "Now play the other one.": the kit would show it after the free play too); the silent-play
hint, Lesson 17's, when sound is off; "Play either grouping again." after the reveal. A play cut
short changes nothing. The reveal is LESSON.md's, word for word, with its closing line on a guess of
"In twos" only.

**The tour.** Step 1 states the answer, so the page calls `holdTour` with the predict's choice, in
the same task as the masthead's start: a first visit's tour opens once the learner has chosen, and a
visit with no tour holds nothing (FACTS 60). The lesson menu lists the step headings, none of which
names a grouping (FACTS 1a). The tour's first stop says that Merc and Tavi sing and that the learner
sings along, which is false on this page, so the page waits on the kit's line for a lesson with
nothing sung (What the kit and the app still need, item 13). Its "Your turn to sing" stop lights
`#sing`, which this page does not have, so it drops out; the solo is `#tap`.

### 4. Four words

The kit's words strip: each word, its definition and a play button, with its figure beside it,
written as it plays and left written (FACTS 66):

1. **Accent**: six pads, the first hi-hat at full level and the rest at 0.7, the first pad lit
   larger as it sounds. Nothing is written.
2. **Offbeat**: a bar of 4/4 at 60 BPM over the click, a clap on each "and", written as an eighth
   rest and an eighth on each beat, 4 s.
3. **Triplet**: a bar of 2/4 at 60 BPM, two eighths on beat 1 and a triplet on beat 2, on A3 or A4,
   2 s.
4. **Syncopation**: Step 4's bar with the note on "2 and", 4 s.

### 5. Step 2's staff

Season 2's staff toy in the learner's clef, the bass for the lower voice and the treble for the
higher, read from `fyp-voice`, the lower when none is stored; Clef shows the other for the visit
(FACTS 10). It holds one tune at a time, four bars on one system where the width allows and two
systems of two bars on a phone, chosen by 6/8 · 3/4: the 6/8 tune or the 3/4 tune of FACTS 30, in C,
at C3 on the bass staff and C4 on the treble, each 8 s, the beats lit under the staff without a
click, Count as in Toy 1. Stems follow FACTS 30. Play plays the tune shown; a switch during a play
stops it. Each tune is written as it first sounds, as Toy 1's bars are, and stays written for the
visit; until a tune has played, its staff shows only the clef and the time signature. "See it on the pitch line" shows the tune as amber bands in time, as on Lesson 17's page.

### 6. Step states

Each step's toy is Toy 1 in one state, with a caption:

1. **Six pads** (Step 1): one bar of six eighths, written on one line above the pads, 6/8 · 3/4 (6/8
   first), Play. Caption: "Fig. 1 · The same six eighths, written as 6/8 or 3/4".
2. **Tunes** (Step 2): Toy 5. Caption: "Fig. 2 · A tune in 6/8 and a tune in 3/4, on your staff".
3. **Triplet** (Step 3): one bar of 4/4 at 60 BPM over four pads, a quarter, two eighths, beat 3,
   a quarter; Eighths · Triplet sets beat 3; Count; Play. Caption: "Fig. 3 · Beat 3 split in two, or
   in three".
4. **Syncopation** (Step 4): one bar of 4/4 at 60 BPM, On 3 gives four quarters, On 2 and gives a
   quarter, an eighth, an eighth tied to a quarter and a quarter; Count; Play. Caption: "Fig. 4 · The
   note on 3, or moved to "2 and"".

### 7. The checkpoint

Lesson 17's take, moved into the kit (Lesson 17 WEB-SPEC, Toys 7, part 1), with this page's frame
and lines. Two Start buttons, "Start: the 6/8 tune" and "Start: the 3/4 tune"; the one pressed becomes
Stop while its take runs, and either runs its take again at any time.

- **The take** (FACTS 36): a 0.6 s lead; one bar counted in on the woodblock, beat 1 high (two
  clicks 1 s apart for 6/8, three 0.67 s apart for 3/4); the tune with the click on every beat, 8 s;
  the tune again with no click, 8 s; 0.35 s; the line. 18.95 s for either.
- **The frame**, in beats from the first count-in click: 6/8 counts in on beats 0 and 1, lines up on
  beats 2 to 9 and judges beats 10 to 17; 3/4 counts in on 0 to 2, lines up on 3 to 14 and judges 15
  to 26 (FACTS 32, 33).
- **Lining up**: each tap whose nearest beat is in the lining-up range gives a sample, its time less
  that beat's; `estimateDrumInputLatency` takes them, and the take is lined up when it reports ready
  with at least five inliers (Lesson 8's `lineUp`).
- **Judging**: every tap less the estimate, measured from the first judged beat, goes to `judgeTake`
  with the judged beats as onsets, the 120 ms window, and a bar 7.5 beats (6/8) or 11.5 beats (3/4)
  less the window long.
- **The line**, the first that applies (FACTS 34): not lined up; lined up but no second-pass tap; all
  beats met with no tap over; otherwise "Beats with a tap: N of 8." (or 12) and, when any taps
  matched no beat, either the other-metre clause or "N taps fell between the beats." The other-metre
  clause applies when at least four unmatched taps, and at least two thirds of them, fall within
  120 ms of the other metre's beats: in the 6/8 tune 666.67 and 1333.33 ms after each beat 1, "N taps
  fell where 3/4's beats would be."; in the 3/4 tune 1000 ms after each beat 1, "N taps fell where
  6/8's second beat would be." A count that starts a sentence is a word up to nine and a figure from
  10, with "One tap" for one, as Lesson 8's `tapsWord` writes it.
- **The ticks**: each second-pass tap, lined up, drawn as a tick on the strip at the point where it
  fell, gold if it met its beat; hidden from a screen reader.
- **The status lines** (FACTS 37), one live region above the line: "Press a Start button when you're
  ready to tap.", "Counting in: one bar.", "Tap with the click: bar N of 4", "Now on your own: bar N
  of 4", the line; Stop gives "Stopped. Press a Start button to tap again."; with sound off, "Sound
  is off, so the take didn't start. Turn sound on, then press a Start button."
- **The pad** takes a tap on a press, Space or Enter, as Lesson 17's, and each tap sounds the clap at
  0.7 at once (FACTS 31). Space's auto-repeat is ignored.

### 8. Free play

Toy 1 in a card in the Wrap, as Lesson 17's: Step 1's six pads with 6/8 · 3/4, and Step 2's staff
with both tunes. Nothing new.

### 9. Recall and quick check

The kit's quiz. The recall imports Lesson 17's quick-check questions 3 and 2, never copies them,
with the try-again lines naming Lesson 17 and linking to its steps in a new tab, through the kit's
recall step address and its link-away (FACTS 7); neither plays a sound. The quick check is LESSON.md's four questions, three answers each, shuffled; question
2's slot, "Play", plays Subdivide's second 6/8 pattern for two bars at this page's speed, 4 s (FACTS
68, 69).

### 10. Go deeper drawer

Lesson 2's `details` drawer in Step 2, closed by default, with LESSON.md's three items (FACTS 25 to
27).

### 11. Tease still

The kit's next-lesson card for Lesson 20, its tease above its hook (FACTS 5). Its slot holds a still
of Lesson 20's stage: the pitch line with nine beads on a string, do re mi so la so mi re do, each in
its band, nothing lit and nothing blurred; it plays nothing, and the card stays one link. Until
Lesson 20's page is live the card says "Coming later" and "See it on the map".

## Audio

- **The sound gate** is the kit's: nothing plays until the learner turns sound on and presses a play
  button. With sound off every play draws silently and the hints and status lines say so.
- **The beat clock** books every sound on the AudioContext's clock: a play starts 0.1 s after the
  press, the beat clock's default; Play in threes and Play in twos start 0.6 s after it, with their
  hops booked `HOP_MS` early, as Lesson 8's cold open does, so the first hop lands on the first kick;
  a take starts 0.6 s after Start (FACTS 36, 57, 64).
- **Drums**: the app's drum voices, kick, snare, closed hi-hat and sidestick, through
  `triggerDrumVoice` into the kit's output, at 1 for an accent and 0.7 otherwise, Subdivide's levels
  (FACTS 18, 63).
- **The click**: the Ear Lab's woodblock, beat 1 higher, the kit sound Lesson 17's page brings in
  (FACTS 62).
- **Notes**: the kit's soft voice, booked with `bookNote`, each note for its written length less a
  short gap, a tied pair once (FACTS 63). Nothing sounds in Merc's sung voice.
- **The clap** on each tap, the app's shared clap at 0.7 (FACTS 31).
- **One sound at a time**: starting any play stops the one sounding, in the hero, the steps, the
  words, the quizzes and free play; Start stops every play.

## Merc and Tavi

Merc and Tavi stand on the floor line either side of the six pads, as on Lesson 8's page, with their
bubbles from the start: Tavi's guess, "Group six notes in twos and you'll feel two beats, surely?",
and Merc's "Let's group them both ways and listen." (FACTS 58). In Play in threes and Play in twos
they hop on the kick and the snare through the kit's `mercHop`, which this page imports as Lessons 8
and 9 do, with Lesson 8's lead of 0.6 s before the first kick (FACTS 57). Tavi's Step 1 line, "Six on
top means six beats a bar, doesn't it?", sits at the head of Step 1, as Tavi's line heads Step 2 on
Lesson 15's page. Nothing is sung, so neither has a sung part or a voice
button.

## Practice links: what exists and what needs engineering

- **Today**: Ear Lab, printed `mercurypitch.com/ear-lab` and linked `/ear-lab?lesson=19`, "then tap
  Subdivide", with Pulse as the second drill (FACTS 46, 48, 49). The card says what Subdivide plays
  at `c60f0fdcb`: two bars on a drum kit, the kick on beat 1, four pads out of five metres, its 6/8
  six hits in two groups of three, its 3/4 three hits, each bar 1.5 s, a miss replayed slower. Pulse
  plays a bar as clicks and is tapped back, and some of its bars hold a triplet or a note on an "and".
- **Needs engineering: the `ear-drill` launch kind** (SEASON-2 § 5.2 item 12; code with tests), then
  a subset as data: Subdivide on its two 3/4 and two 6/8 patterns only, `metre:3-4:a`, `metre:3-4:b`,
  `metre:6-8:a` and `metre:6-8:b`, with two pads, 3/4 and 6/8 (FACTS 50). The card's text then
  changes as LESSON.md's editorial note says.
- **Needs engineering: the lesson marker** for 15 to 28 (SEASON-2 § 5.2 item 21), without which
  `?lesson=19` is an ordinary visit and First Light opens (FACTS 47). It is part of the kit PR this
  page waits on.
- **No practice for 6/8 reading**: the app writes no compound metre (FACTS 52; SEASON-2 § 5.3), so
  only this page writes 6/8 until a drill does.

## Explorer and season data

The lead writes these entries; this spec gives them:

- **The season entry**, in Season 2's module (What the kit and the app still need, item 1): `n: 19`,
  `lane: 'theory'`, `title: 'Threes, offbeats and syncopation'`, `short: 'Threes and offbeats'`,
  `topics: ['T08']`, `minutes: 12`, `page: '/learn/19'`, `hook: 'Six notes in a bar, grouped two
ways: why does one feel like two beats and the other like three?'`, `pr.link` with `href:
'/ear-lab?lesson=19'`, `addr: 'mercurypitch.com/ear-lab'`, `label: 'Ear Lab'` and `note: 'then tap
Subdivide'`, since the explorer prints the label, a comma and the note (`practiseMarkup`,
  `src/features/lessons/kit/explorer.ts:177-181`), and `pr.needs: 'Subdivide with only 3/4 and 6/8
(an ear-drill link)'`, which no page draws (`src/features/lessons/kit/season.ts:90-106`). The edge
  `[17, 19]` (SEASON-2 § 4.3). The topic T08, "Simple and compound metre; triplets; syncopation"
  (SEASON-2 § 4.1).
- **The figure** beside its explorer card: six pads in a row, ungrouped, with nothing written, a
  drawing that answers nothing (FACTS 1a). It needs a new `fig` kind, `'pads'`, or Lesson 17's
  proposed `'rhythm'` with an ungrouped option; until one is drawn the entry leaves `fig` out.
- **The signature**, in `kit/team-notes.ts`: "Lesson 8's six pads, regrouped: 3 + 3 makes two beats,
  2 + 2 + 2 makes three; then a beat splits in three and a note leaves beat 3 for the and."
- **The copy**, in `kit/lesson-copy.ts`: Lesson 19's `tease`, "Same six notes, same speed. Only the
  accents move.", with one alternative, `teaseAlts` id `written`, "Every bar written this season has
  had four beats." (FACTS 5b); and Lesson 20's tease, "Merc sings a run of nine notes, five every second.",
  with one alternative, `teaseAlts` id `plan`, "Squeeze three notes into a beat, then four, then
  more." (FACTS 5); their notes in `TEASE_NOTES`. Each is at most 70 characters, `TEASE_MAX`
  (`src/features/lessons/kit/lesson-copy.ts:76`). No hook alternative.
- **The explorer**: Season 2's tab, its line above the heading "Season 2 · Lesson 19" (FACTS 6), the
  card showing only learner information: "Ready", "Coming later" or "Done".

## What the kit and the app still need

The page is built only after these, most of them shared with Lessons 15 and 17:

1. **Seasons in the kit** (SEASON-2 § 6.2 item 1): Season 2's data, its masthead and explorer tab.
2. **The head** (SEARCH § 3.1 and § 12): the title "6/8 time, triplets and syncopation explained |
   MercuryPitch" (59 characters), the meta and share description "Six notes in a bar, grouped two
   ways: why does one feel like two beats, the other three? A 12-minute lesson on 6/8, triplets and
   syncopation, with sound toys." (158 characters, the hook, then what and how, as SEARCH § 3.1
   asks), `og:title` "Threes, offbeats and syncopation · Find
   Your Pitch", and a share card of the six pads ungrouped between Merc and Tavi (FACTS 1a).
3. **Rhythm on the staff** (SEASON-2 § 6.2 item 3), generalised past four-beat bars: 6/8, 3/4 and 2/4
   with beams by beat, dotted quarters and halves, a beamed triplet with its 3, a tie at beat 3, and
   counts with brackets (Toys 1; FACTS 52, 56). The app's `readRhythm` writes four-beat bars and no
   tie, so the kit's model must do both.
4. **The staff toy** (SEASON-2 § 6.2 item 2) with both clefs, for Step 2's tunes (Toys 5).
5. **The six-pad row and its arcs** in the kit's beat row, and six cells to a bar in its compact
   strip (`kit/beat-strip.ts`) for the hero (Toys 1 and 2; FACTS 54).
6. **The drums in the kit**: Subdivide's voices and levels booked through the beat clock (Audio).
7. **The tap take in the kit**, as Lesson 17's page moves it there, generalised: any sound as the
   take's backing, a click that can stop for the judged pass, the beats as onsets, and this page's
   other-metre clause (Toys 7).
8. **The woodblock in the kit**, Lesson 17's item.
9. **The hop**: `kit/merc-hop.ts` exists; the page imports it and books the groupings with Lesson 8's
   lead of 0.6 s and their hops `HOP_MS` early (FACTS 57).
10. **The lesson plumbing** (SEASON-2 § 5.2 item 21): the marker's reach to 19, the lesson-answer
    bounds and the admin console.
11. **Lesson 17's page**, for the recall's imported questions and the chip's link.
12. **The `ear-drill` launch kind** and Subdivide's subset (Practice links), after which the card's
    text changes.
13. **The tour's first stop on a page with nothing sung** (`kit/tour-copy.ts`, spec only). Its body
    today, "They teach every lesson. Listen to them sing, then sing along with them when it's your
    turn.", is true of every page so far and false on this one (FACTS 60). The kit needs a second
    body for a lesson where nothing is sung, chosen by a list of such lessons, as `LISTENING_LESSONS`
    chooses the microphone line. This page needs: 19 in that list, and a body that says nothing of
    singing, for example "They teach every lesson. Listen along, then try each idea yourself."
    Nothing else in the tour changes for it: the "Your turn to sing" stop drops out where `#sing` is
    missing. If the lead wants the tour to show this page's solo, a stop lighting `#tap`, "Your turn
    to tap", could say "Tap the beat on the pad, or with Space or Enter, while a tune plays. Nothing
    listens: the page times your taps.", and would drop out on every page without `#tap`. Lesson
    21's page may need the same.

## Decisions for the owner

None is open. Everything the page needs is decided (SEASON-2 § 7) or answered by the lead (this
lesson's brief: the tunes, the cold open's drums, the checkpoint). Two choices go to the lead at
review: this lesson's tease on Lesson 18's card, with an alternative that claims only what Season 2
has written (FACTS 5b), and Lesson 20's tease, with the plan's line as its alternative (FACTS 5).

## Edge cases

- **Sound off.** Plays draw silently; the predict waits for a heard play and says so; a Start says
  the take didn't start.
- **Device delay.** The lining-up cancels a steady delay up to 250 ms; on simulated takes the 6/8
  take reads clean up to a 350 ms delay and the 3/4 take up to 300 ms. The two limits have different
  causes: in the 6/8 tune the delay past the 250 ms cap must stay inside the 120 ms window, so its
  limit is about 370 ms; in the 3/4 tune a tap more than half a beat late, 333 ms, is nearest the next
  beat and is lined up as early. Past those the line reads as missed beats or taps between, and the
  ticks drift (FACTS 35). The page gives no figure for any device.
- **No taps in the first pass**: the take is not lined up, and the line asks for taps with the click.
  **No taps in the second**: its own line.
- **Taps during the count-in** count for nothing; taps after the second pass's window are ignored.
- **Stop mid-take**: the sound stops, nothing is judged, the status reads "Stopped. Press a Start
  button to tap again."
- **A play started during a take** stops the take, as Stop does; a Start during another take stops
  that one and starts its own.
- **A hidden tab** (the AudioContext suspended): a running take stops as Stop does; a play stops.
- **The tour on a first visit** waits for the predict's choice; a learner who never chooses gets the
  tour from the masthead's question mark (FACTS 60).
- **Reduced motion and Pause animations**: no hops or idles; arcs, notes and counts appear at once.
- **Screen readers**: the pads, arcs and ticks are hidden; each figure has a name in words ("Six
  notes, grouped in threes", "Six notes, grouped in twos"), the status lines and the line speak.
- **Narrow phones**: six pads stay at least 44 px from 344 px wide (FACTS 70); Step 2's staff wraps
  to two systems.

## Tests

1. **The rhythm model and writing**: 6/8 and 3/4 bars of six eighths beam 3 + 3 and 2 + 2 + 2; the
   tunes' bars write as FACTS 30 lists; Step 3's triplet beams with a 3 and no bracket; Step 4's bar
   writes an eighth tied to a quarter at beat 3; held counts sit in brackets.
2. **The drums**: Play in threes, Play in twos and Step 1's bars strike the voices and levels of
   FACTS 18 and 64 at their times; quick check 2 plays `metre:6-8:b`'s voices.
3. **The take judge**: every line of Toys 7 from seeded takes, as the simulation reads them (FACTS
   35), for both tunes, with the delay limits as edge-case tests.
4. **The predict**: Play six notes works before a choice and never reveals; the reveal waits for
   both groupings heard to their end; a cut play counts for nothing; the tour waits for the choice.
5. **The words**: LESSON.md's lines, hints, status lines and quiz questions word for word in the
   page's modules; the recall imports, never copies.
6. **The season**: the entry, the edge `[17, 19]`, both teases and their alternatives at most
   `TEASE_MAX`.

## Contract

Lesson 1's contract and its page on the app, unchanged and binding: no CDN, self-hosted fonts, Web
Animations in place of GSAP, and practice links that carry `?lesson=19` before any hash. Then the
layout, accessibility, sound, motion and storage rules: 16 px side gutters, no sideways scroll at
390 px, `min-width: 0` on text children, touch targets of at least 44 px with no two tap zones
overlapping, visible focus, a single dark theme with every colour a token and an explicit body
background, sound only after a tap, localStorage only for per-viewer conveniences inside try/catch,
and the whole page usable with no sound and no storage. The page stores the quiz seeds and records,
`fyp-done`, `fyp-voice` (read only), `fyp-motion`, `fyp-pos` and `fyp-tour`, as every lesson page
does; nothing from the toys or the take.

Departures from [ARTICLE-PLAN.md](ARTICLE-PLAN.md), each argued in FACTS:

1. The sound gate reads "how notes are grouped", not "how beats are split" (FACTS 1a).
2. The four words are accent, offbeat, triplet and syncopation; simple and compound metre are named
   in Step 1 (FACTS 20).
3. The recall asks Lesson 17's questions 3 and 2, where the plan's second question was Lesson 8's
   question 2, which Lesson 17's own recall already asks (FACTS 7).
4. The cold open plays hi-hats, then Subdivide's 6/8 drums for in threes and the same rule for in
   twos, where the plan has clicks and accents (FACTS 18, 64); Merc and Tavi hop where the plan has
   Merc's foot tap, and Merc says "listen", not "tap along" (FACTS 58). Tavi's guess is reworded.
5. Tavi voices the card's misconception in Step 1 (FACTS 19).
6. Step 2's heading is "How do you count 6/8?", Tavi's question to Merc, not "How do I". The 3/4
   tune's third bar is six eighths (FACTS 30). "1 la li" is named in Step 2 and Takadimi in Go deeper
   (FACTS 23, 25). "Row, Row, Row Your Boat" is named, not played (FACTS 29). The counts light; Merc
   does not say them (FACTS 75).
7. Steps 3 and 4 run at 60 BPM, not 80 (FACTS 38).
8. Step 3's triplet carries a 3 and no bracket; Pulse's "triplet on 1" is left to the practice card
   (FACTS 41).
9. Step 4 writes an eighth tied to a quarter; it moves a note with a switch, not a clap by a drag;
   its offbeat claps move to the four words; its Notice drops "the bar leans forward" (FACTS 43, 44,
   66, 74).
10. The checkpoint plays each tune twice, with the click and then without, and reports beats met
    and taps between (FACTS 32 to 36).
11. Quick check 1 asks what a bar of 6/8 holds; question 2 plays Subdivide's second 6/8 pattern, so
    its right answer is 6/8; questions 3 and 4 are reworded, with the "and" moved into question 4's
    feedback (FACTS 69, 76).
12. The Wrap's lines and challenge are reworded to the page's terms; the teases are new (FACTS 5,
    5b); the chip reads 12 minutes, not 13 (FACTS 3).
