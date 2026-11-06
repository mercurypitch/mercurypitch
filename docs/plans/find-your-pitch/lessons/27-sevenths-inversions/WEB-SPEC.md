# Lesson 27 web page: spec

The Lesson 27 page is the web lesson for "Seventh chords and inversions": written steps, one main
toy in four step states with free play, a cold open on Lesson 12's ring of rooms, two predicts (the
cold open's and Step 4's), three words, an unscored sing-along, two quizzes (the recall and the
quick check) and the lesson explorer. Copy is in [LESSON.md](LESSON.md); every claim is in
[FACTS.md](FACTS.md). It is a text-only package: no film exists for Lesson 27, so the page has no
Watch section and the masthead's anchors are Lesson, Sing and Explorer.

It is built on the kit (`src/features/lessons/kit/`) as Season 2's kit PR leaves it (SEASON-2 § 8.2
item 1): the season structure, the staff toy with both clefs, and the lesson plumbing; and on Lesson
25's page, whose sing flow, voice line, predict lock and held paragraph it reuses. Like every lesson
page it reuses and never copies: a part that lives in an earlier lesson's module moves into the kit
first, as Lesson 12's ring of rooms and chord levels and Lesson 6's interval pair do here (What the
kit and the app still need, items 4 to 6). Where this page shares a behaviour with Lesson 25's, it
is Lesson 25's, unchanged unless this spec says otherwise.

One object carries the lesson: Lesson 12's ring of rooms, seen from above, beside the learner's
staff (FACTS 30). In the hero it draws two rooms, V lit and I faint; after the cold open's choice
the V room grows a fourth corner on F or F♯. In Step 1 a room grows its seventh; in Step 2 the I and
V rooms each have four corners; in Step 3 the V7 room's diagonal from B to F crosses the ring's
centre and folds into C and E; in Step 4 a chord turns over, its bottom note climbing an octave on
the staff while its room on the ring stays the same and a mark moves to the corner in the bass.
That path is the card's signature, with two rooms in place of four (FACTS 4, 33).

Its public home is `mercurypitch.com/learn/27` (FACTS 9): a hand-written document `learn/27.html`
with its module in `src/features/lessons/lesson-27/`, wired as Lesson 25's page is: a written lesson
with no film, its cold open before its recall, a recall that asks other lessons' own questions, and
a sing-along with no microphone. It joins `kit/drafts.ts` in its first commit and publishes only
after `/learn/12` and `/learn/23` are live, because its prerequisite chips and its recall link there
and it imports their questions, and after the vocal coach's look at its voice lines and its sung
drill (LESSON.md, For the vocal coach). The next-lesson card on Lesson 26's page draws this lesson's
tease above its hook from the season data, and this page's card draws Lesson 28's; neither is
written into a page's markup (FACTS 5, 5b).

## Look

Lesson 25's look: the dark listening room, the series colour code, Lesson 1's type and wordmark,
the staff toy's engraving and the motion rules (Lesson 25 WEB-SPEC, Look), with Lesson 12's ring of
rooms as Lesson 12's page draws it. On this page:

- **Notation** is ink `#e6edf3` on chrome lines `#c3ccd6`: plain noteheads without stems, since no
  note value is taught, accidentals to the left of their notes, no key signature, and ledger lines
  no further than a note needs (FACTS 51). A chord's notes stack on one stem-less column; two notes
  a second apart, F and G in V7's inversions and B and C in those of I with its seventh, sit side by
  side, the upper to the right, as engravers write a second. A note lights in its singer's colour
  while it sounds, blue `#58a6ff` on the bass staff and orange `#ff7448` on the treble, by the voice
  the learner chose.
- **The ring** keeps Lesson 12's look: twelve beads on a ring, each named, the black piano keys
  smaller, lit, named in sharps beside them, the rooms chrome with a halo on each corner, the lit
  room with a brighter line and a faint fill, the others faint, and the ring's centre naming the lit
  room in JetBrains Mono (FACTS 30). A room of four corners is drawn through its corners in their
  order round the ring, which for every chord on this page is the order of root, third, fifth and
  seventh. A fourth corner grows out of its bead in 0.3 s.
- **The diagonal**: in Step 3 and in free play, while V7 is lit, a chrome line runs from B to F
  across the ring's centre, and as I sounds two short arrows show B moving one bead to C and F one
  bead to E. Nothing marks it in colour alone: the line is labelled "B to F: 6 semitones".
- **The bass mark**: in Step 4 and in free play, a chrome ring round the corner in the bass, with
  "bass" beside it; Turn over moves it to the next corner in 0.3 s.
- **Gold** `#ffd84d` is not used: nothing on this page lines up as a fit.
- **No decorative staves or clefs** anywhere: in a season that teaches the staff, a staff is always
  music (SEASON-2 § 1.5 item 7; FACTS 6).
- **Nothing is in tune or out of it**, and nothing is scored, so the page uses no target band, no
  singer violet and no mint.

What moves: Merc and Tavi's idle loops; while something the learner started plays, the lit beads,
rooms and notes; a fourth corner growing (0.3 s); the diagonal's arrows (0.4 s); in Step 4 a
note's octave climb on the staff (0.4 s) and the bass mark's move (0.3 s). Under
`prefers-reduced-motion`, or with the masthead's Pause animations on, Merc and Tavi stop and every
growth, climb and move lands in place; what the learner starts still sounds, and the beads and notes
still light as they sound (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Season 1's departures kept: the step toys double as the
Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it; the
practice card sits in the Wrap. No Watch section. The page opens in Lesson 2's order (FACTS 5a).
Each section's heading, and the line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Season 2's, "Season 2 · Lesson 27", with Lesson, Sing and Explorer, the Sound
   toggle off by default and Pause animations, through `initMasthead`
   (`src/features/lessons/kit/page-chrome.ts:127-159`) with `{ lesson: 27, deck }`. Its lesson menu
   lists the four step headings from the first paint and heads its card "Lesson 27 · How do you
   build a seventh chord?"; no heading names either predict's answer (FACTS 1a, 1b). On a first
   visit its welcome tour waits for the cold open's choice (Toys 3).
2. **Hero, with the cold open**, laid out as Lesson 2's: the kicker, the hook question as the title
   (`<h1 class="hook" id="hook">`), the meta as four chips, the promise and the sound gate from
   LESSON.md. The chips are "15 minutes" (FACTS 3); "After Lesson 12: Chords and the four-chord
   song" and "After Lesson 23: Perfect, major, minor and the tritone", links to `/learn/12` and
   `/learn/23` that stay plain chips wherever their lesson is not live
   (`src/features/lessons/kit/page-state.ts:14-20`; FACTS 2); and "Sound on". Its stage holds Tavi's
   and Merc's bubbles over Merc and Tavi on the floor line, the ring between them (Toys 2), and
   under it the cold open's three plays: Play V, then I, which works from the start, and Play it
   with F and Play it with F♯, locked until a choice. The predict card sits under the stage (Toys
   3). On a phone the hero's parts run kicker, title, meta, the stage, the gate, the predict, then
   the promise (`src/features/lessons/kit/lesson-stage.css:394-437`), so the title and the first
   play come before anything asks for an answer. The head: the title, at most 60 characters,
   "Seventh chords and chord inversions | MercuryPitch" (50); the description, "Add one note to the
   V chord and it pulls towards home. Which note, and why? A fifteen-minute lesson with sound toys:
   seventh chords and inversions." (147), which the head test holds to 80 to 160 characters and to
   the chip's run time in words; og:title and twitter:title "Seventh chords and inversions · Find
   Your Pitch, Lesson 27" (58), in Lesson 4's form; og:description and twitter:description the
   hook alone (75); the share card `learn/lesson-27-og.jpg`, 1200 by 630, its alt "The title card:
   Find Your Pitch, Lesson 27, Seventh chords and inversions, above Lesson 12's ring of rooms with
   the V room lit, between Merc and Tavi." (150), the V room with three corners and no fourth
   (FACTS 1a); the two structured-data blocks from Lesson 1's, the Article's `headline` the
   lesson's name, its `alternativeHeadline` the hook, its `description` the meta description, so
   it holds "A fifteen-minute lesson" as the head test asks, `timeRequired` `PT15M`, position 27,
   and `teaches` "Building seventh chords", "The dominant seventh and its pull towards I" and "Root
   position and inversions"; and, on release, the llms.txt line in Season 1's form: "[Lesson 27:
   Seventh chords and inversions](https://mercurypitch.com/learn/27): Which note turns the V chord
   into a seventh chord, and why it pulls towards home. Seventh chords, the dominant seventh, and
   inversions." (SEARCH § 3.2 and § 3.4). None of them names the added note (FACTS 1a).
3. **Recall from Lessons 12 and 23**, straight after the hero: Lesson 12's question 3 and Lesson
   23's question 1, shown to everyone (Toys 7; FACTS 7).
4. **Three words you'll meet**: Seventh chord, Major seventh and Minor seventh, each with its figure
   and play (Toys 4).
5. **Steps**: the step deck, four steps, the ring and the staff toy stuck beside the text (Toys 1),
   Step 2's mix-up card in its text, a Go deeper drawer in Steps 3 and 4 (Toys 6), and Step 4's
   predict (Toys 3).
6. **Sing it**: the comfort check, the voice choice and Lesson 15's line under it, Your turn, the
   staff guide and "How did that feel?" (Toys 5).
7. **Quick check**: four questions (Toys 7).
8. **Wrap**: the three lines, the one-sentence challenge, the practice card in the version Sing
   it's ending picks (Practice links; Toys 5), the next-lesson card with its still (Toys 8), and
   free play, the step toys on one card, its V7 controls held until the cold open's choice and its
   Turn over until Step 4's (Toys 1).
9. **Explorer**: the season's map, opening on Season 2's tab (Explorer and season data).
10. **Footer**: LESSON.md's, with the two practice links, the fonts line and "Every sound on this
    page is synthesised in your browser."

## Length

The learner copy is 2,177 words on `node scripts/lesson-words.mjs`, every branch counted, under the
series' cap of 2,379 by 202, and inside the lead's aim for this pass of 2,230 (FACTS 3). The page
runs about 15 minutes: 9.15 minutes of reading at 238 words a minute and about 5.5 of sound, toys
and tasks, 14.62 in all, past MASTER-PLAN § 4.2's "8 to 12 minutes of active time, 500 to 900
words", as Lessons 10, 12, 15, 21, 23 and 25 are. The chip is an estimate until the ring's states
and the staff's chords are timed in their lab, as SEASON-2 § 1.3 asks, and this section says so
until then. Each step's own text, with its Try and its Notice, runs 57 to 120 words (Steps 1 to 4:
119, 57, 119 and 120), inside 50 to 120 words a step; Step 1's count includes its paragraph on V's
seventh, which shows with the cold open's reveal, and Step 4's its predict and its reveal. Eight
parts run past a step's 120 words, by the same counter, for these reasons:

- **Step 2, 165 words with its mix-up card**, and **Step 3, 172 with its drawer**: the card sits in
  the step whose plays refute it; the drawer has one item, closed by default.
- **Step 4, 181 words with its drawer**, one item, closed by default.
- **Sing it, 321 words.** It holds the series' singing lines, Lesson 3's word for word, which are
  not cut, Lesson 15's line under the voice choice and two lines of its own (Your turn's listening
  line, and Easy and Workable's) (FACTS 56 to 61).
- **The quick check, 256 words**, and **the recall, 151**: three answers a question with a line of
  feedback for each, as MASTER-PLAN § 4.2 item 8 asks; the recall is Lessons 12's and 23's, word for
  word.
- **The cold open, 159 words**: the hook's own question, and a reveal that says which note, says the
  pull in one textbook's words, and says why F♯ was fair (FACTS 34 to 38).
- **The Wrap, 460 words**: the practice card says what Chord Stacker does at every level, its
  printed sharps included, what it shows and what it scores, and what the app lacks; its second
  drill is Stack; its rest version is Lesson 12's (FACTS 62 to 70).

The fix pass after the review added the new reveal, Step 3's sentence on B and F♯, Step 4's clause
on Lesson 23's intervals and "its seventh in the bass", the letters counted with both ends, and the
card's account of Chord Stacker's pace, and made room with these cuts:

- **The cold open**: the review's stem, 29 words for 32, and its reveal, 80 for 91 (FACTS 34, 38).
- **Step 3**: Tavi's line, "Then the note we added is what makes it pull?", and "G, B and D alone
  hold no tritone." (FACTS 23, 44).
- **Step 4**: "stacked in thirds", and the play of C major's three positions, whose work the
  predict's plays and the Try now do (FACTS 49).

The count went from 2,178 to 2,195, and to 2,177 when the app's Chord Stacker fixes shipped and the
card dropped the pace and the top note's tail (FACTS 62, 65). The hints and status lines are stage
directions in LESSON.md and are not counted, as in the text packages of Lessons 9 to 25: the two
predicts' hints and their "You said" lines, the names of the plays a choice unlocks, the stored
voice's line, the steps' lock lines and the held lines, Sing it's hints, and the toys' labels,
readouts and hints. A built page writes them in the open and counts them, about 150 words more
(Lesson 8 FACTS 4), so the built page is about 2,327 words, under the cap, with the chip still at
15 minutes. The article plan budgeted near
1,250 words.

The activities are timed from this spec's lengths (FACTS 3, 72). Free play is not counted.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                           | New                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1. The steps' toy         | Lesson 12's ring of rooms, moved into the kit; Season 2's staff toy, both clefs, with its Clef and "See it on the pitch line" switches; Lesson 12's chord levels | Rooms of four corners, the diagonal, the bass mark, Turn over, the readout, the held V chip |
| 2. The hero's ring        | Toy 1, two rooms, no staff                                                                                                                                       | The fourth corner on F or F♯ after the choice                                               |
| 3. Predict widgets        | The kit's predict (`src/features/lessons/kit/predict.ts`), two on the page, the second disabled until the first's choice as on Lesson 22's page; `holdTour`      | Four reveal elements for the first predict                                                  |
| 4. Three words            | Lesson 25's words strip with small staffs; Lesson 6's interval pair, moved into the kit                                                                          | A four-note arpeggio, then the chord                                                        |
| 5. Sing it                | Lesson 25's sing flow (`kit/comfort.ts`, `kit/voice-choice.ts`, `fyp-voice`, `kit/move-do.ts`'s count-in), its staff guide, its feelings and rest card           | The figure in G                                                                             |
| 6. Go deeper drawers      | The kit's drawer                                                                                                                                                 | Held until a reveal                                                                         |
| 7. Recall and quick check | The kit's quiz, with Lesson 12's and Lesson 23's question objects imported                                                                                       | Question 4's play                                                                           |
| 8. Tease stills           | The next-lesson card's slot                                                                                                                                      | This page's still for Lesson 26's card                                                      |

### 1. The steps' toy

Lesson 12's ring of rooms, the kit's spiral seen from above (`src/features/lessons/lesson-12/rooms-draw.ts:5-9`;
`src/features/lessons/kit/spiral-draw.ts:130`), moved into the kit with its drawing, marks and
plays, and Lesson 12's page then importing them from there (What the kit and the app still need,
item 4). Beside it, Season 2's staff toy in the learner's clef, with its Clef switch and its "See it
on the pitch line" switch (SEASON-2 § 1.4 item 1); every chord the toy plays, the staff writes as it
sounds, in the same voice (FACTS 8, 51). One toy, four step states, then free play:

- **Step 1**: two chips, I and V, and a switch, Add the seventh, off at first, with I lit at first
  paint, so the switch can sound only I's seventh before the choice. A chip plays its triad, 1.2 s,
  and lights its room; with Add the seventh on, a chip plays its seventh chord, and switching it on
  plays the lit chord with its seventh, the fourth corner growing as it sounds. A readout under the
  ring says "Root to seventh: 11 semitones" for I and "Root to seventh: 10 semitones" for V. The
  step's plays are LESSON.md's: C, E and G, then C, E, G and B; and, held with the paragraph, G, B
  and D, then G, B, D and F (FACTS 42). The V chip and its plays are disabled until the cold open's
  choice, under the steps' line "Choose an answer at the top to unlock the rest of this figure."
  (FACTS 39).
- **Step 2**: the I room and the V room, each with its fourth corner, and the step's two plays, in
  its text: the major seventh chord, then the dominant seventh; the dominant seventh, then I (FACTS
  43). Until the cold open's choice the V room has three corners, under the same line; the step's
  text, its plays among it, waits for the cold open's reveal (Toys 3).
- **Step 3**: the V7 room with its diagonal, B to F, across the centre, and the I room. The plays: B
  and F, then C and E, with the arrows; V7, then I (FACTS 44). The whole step, its plays among it,
  waits for the cold open's reveal (Toys 3).
- **Step 4**: two chips, I and V7, Turn over, the bass mark and the position's name under the ring,
  "Root position", "First inversion", "Second inversion" or "Third inversion". Turn over moves the
  chord's lowest note up an octave and plays the chord, 1.2 s: the staff restacks it, the bass mark
  moves to the new bottom note's corner, the name changes, and the room on the ring does not change
  (FACTS 50). The press after the last inversion returns the chord to root position at its first
  pitches, the third press for a triad and the fourth for a seventh chord, so no press sounds a
  pitch outside FACTS 72's. All of it waits for Step 4's choice, which waits for the cold open's
  (Toys 3).
- **Free play**, in the Wrap: one card with every control: chips I and V, Add the seventh, Turn over
  with the bass mark and the position's name, and the diagonal while V7 is lit. Turn over turns
  whichever chord is lit, I or V, with or without its seventh, and returns it as Step 4's does. The
  V chip, V's seventh, the diagonal and V7's plays wait for the cold open's choice, under the steps'
  line; Turn over waits for Step 4's choice, under "Choose an answer in Step 4 to unlock this.". A
  return visit holds them again (FACTS 1a, 1b, 39).

The figure's accessible name and live region use words only: "V, G major: G, B and D", "V7: G, B, D
and F", "I with its seventh: C, E, G and B. Root to seventh: 11 semitones", "C major, first
inversion, E in the bass: E, G and C", each note spoken with its letter and octave when the staff
reads it out.

### 2. The hero's ring

Toy 1's ring, alone on the stage, with no staff: the cold open plays in Merc's register for
everyone, since the voice choice comes later (FACTS 8, 74). Two rooms: V's, lit, and I's, faint; the
centre reads "V · G major" (FACTS 33). Play V, then I sounds G3, B3 and D4, then C4, E4 and G4, 1.5
s each, lighting each room and naming it in the centre (FACTS 32). After a choice, Play it with F
and Play it with F♯ each sound V with its fourth note, F4 or F♯4, 1.5 s, then I, 1.5 s; as the
fourth note sounds its bead lights and the V room grows its fourth corner there, and the centre
names the four letters with no chord's name. After the reveal, the F play's centre reads "V7". IV's
room is never drawn here (FACTS 1a). The black piano keys are drawn as on Lesson 12's ring, smaller,
lit, their names beside them, F♯ among them (FACTS 1a, 30).

### 3. Predict widgets

Two of the kit's predicts (`src/features/lessons/kit/predict.ts:12-17`), with the hints LESSON.md
gives and no `next` hint, so the locked-in hint stays until the reveal (FACTS 37).

- **The cold open's**: choices F and F♯; Play V, then I is a free play (`data-free`); the answering
  plays are `revealOn` both, with `revealAfter: 'all'`; `guess` gives "You said: F" or "You said:
  F♯". Its reveal is four elements (`src/features/lessons/kit/predict.ts:70-71`): the reveal under
  the predict; Step 1's held paragraph and its play; Step 2's text, plays, mix-up card, Try and
  Notice; and Step 3's text, plays, Try, Notice and Go deeper drawer. Each held element's place
  shows its held line until then, and none is announced as it appears. Its `unlocks` are the steps'
  toy's V chip, with which Add the seventh plays V7, and the free play's V chip, V's seventh,
  diagonal and V7 plays (`src/features/lessons/kit/predict.ts:66-67`). Its `onChoice` lets Step 2's
  V room grow its fourth corner, releases the tour's hold (`holdTour`,
  `src/features/lessons/kit/tour-gate.ts:57-69`) and enables Step 4's predict.
- **Step 4's**: choices "Still C major" and "E minor", and both plays, disabled at first paint with
  the hint "Choose an answer at the top first.". The cold open's `onChoice` sets the lock line
  "Choose an answer to unlock the two comparisons.", enables the choices and only then mounts this
  predict, which keeps the hint it finds, as Lesson 22's page wires its second predict (FACTS 48).
  Its plays are `revealOn` both with `revealAfter: 'all'`; `guess` gives "You said: still C major"
  or "You said: E minor"; its reveal is the reveal, the text after it, the Try and Notice and the Go
  deeper drawer; its `unlocks` are Step 4's chips and Turn over, and the free play's Turn over.
- On a first visit the welcome tour, whose "One step at a time" scrolls to the steps
  (`src/features/lessons/kit/tour-copy.ts:56-58`), waits for the cold open's choice. Neither
  predict's choice is stored: a return visit starts both afresh.

### 4. Three words

Lesson 25's words strip (`src/features/lessons/kit/words-strip.ts:1-12`), three words, each with a
small staff in the learner's clef that writes its notes as they play (FACTS 41). Seventh chord plays
C, E, G and B a note every 0.4 s, then together for 1.2 s; Major seventh and Minor seventh play
Lesson 6's interval pair (`pair`, `src/features/lessons/kit/pair.ts:28-38`), C up to B and
C up to B♭, the lower note first. For the higher voice the words sound from C4, for the lower from
C3.

### 5. Sing it

Lesson 25's Sing it, unchanged but for the figure: the comfort check, the voice choice with its
stored voice and Lesson 15's line, Your turn, Play Merc's notes and Start the guide, the guide's
count-in on so, its line sweeping along the notes, "How did that feel?" and its endings, the rest
card after "Effortful" or "Uncomfortable" (FACTS 56 to 61). The figure is so, ti, re and fa, then
mi, then do, in G: D3, F♯3, A3, C4, B3, G3 for the lower voice in the bass clef, D4, F♯4, A4, C5,
B4, G4 for the higher in the treble, each note 1.2 s and do 1.8 s, a 1.15 s hold and a 0.05 s
glide, on Merc's "ooh" (FACTS 52, 56). The staff writes it with no key signature and F♯'s own sharp,
the house on do, G. Each note lights as it sounds. No Move do and no octave switch (FACTS 55).
Nothing listens: the page asks for no microphone.

### 6. Go deeper drawers

The kit's drawer, closed by default, one item each: Step 3's "No fifth", held with the rest of Step 3
until the cold open's reveal, and Step 4's "Figures", held until Step 4's reveal (FACTS 47, 1b).

### 7. Recall and quick check

The kit's quiz (`src/features/lessons/kit/quiz.ts:218`), "Right." or "Not quite." before each
feedback line (`src/features/lessons/kit/quiz.ts:315`), answers shuffled. The recall imports `l12-q3`
(`src/features/lessons/lesson-12/quiz-questions.ts:89-107`) and Lesson 23's first question once
Lesson 23's page registers it, its step links rewritten to the other lesson's page, opening in a new
tab (`recallStepHref`, `src/features/lessons/kit/quiz.ts:142-143`; `linkAway`,
`src/features/lessons/kit/quiz.ts:186-194`; FACTS 7). The quick check's four questions are
LESSON.md's (FACTS 75 to 78); question 4's Play sounds G3, B3, D4 and F4 for 1.5 s, for everyone.

### 8. Tease stills

Lesson 26's next-lesson card holds, in its slot, a still of this page's stage as the cold open
opens: the ring with the V room lit and the I room faint, no fourth corner, Merc and Tavi, no
bubbles (FACTS 1a, 80). It plays nothing. This page's card holds Lesson 28's still as Lesson 28's
package draws it (FACTS 5).

## Audio

The kit's soft tone through the page's one audio context, sound off until the learner turns it on,
nothing playing until a press, and one sound at a time: a new play stops the one before
(`src/features/lessons/kit/now-playing.ts:39`). The levels are Lesson 12's, moved into the kit with
its ring: a single note at 0.13, each voice of a three-note chord at 0.075, Merc's "ooh" at 0.2
(`src/features/lessons/lesson-12/sounds.ts:41-48`); each voice of a four-note chord at 0.056, so a
seventh chord sounds no louder in all than a triad, 0.224 against 0.225, and in power about 1.3 dB
quieter, and Step 2 compares two chords, not two loudnesses (FACTS 73). Every pitch is FACTS 72's.
The lowest, G2 at 98 Hz in the lower voice's V and V7, is checked on a phone's speaker in the lab
(Edge cases); the highest, G5 at 784 Hz, sounds only in free play (FACTS 72). Chords sound their
notes together, with no arpeggio, except the Seventh chord word's and Merc's line. The guide's
count-in is Lesson 25's (`src/features/lessons/kit/move-do.ts:65-74`).

## Merc and Tavi

Merc and Tavi stand either side of the ring on the floor line, as on Lesson 25's stage, with the
kit's idle loops and celebration (`src/features/lessons/kit/merc-duo.ts:119`). Their lines are
LESSON.md's: in the hero, Tavi's guess for F♯, "F♯ sits a semitone under G, and G is in the home
chord. Won't F♯ pull hardest?", and Merc's "Choose, then hear both go home." (FACTS 35). Neither
speaks in the steps: the plan's Tavi line for Step 3 is left out for length (FACTS 44). Merc sings
the sing-along on "ooh" for the lower voice, Tavi an octave higher for the higher voice, as in
Lesson 25. Neither says "right" or "wrong"; the reveal's line says what the learner chose.

## Practice links: what exists and what needs engineering

1. **Chord Stacker**, `/pitch-training?lesson=27`, printed mercurypitch.com/pitch-training, then tap
   Chord Stacker. Today a run is five rounds, one four-note chord each, in a shuffled order; each
   chord plays root first, a note at a time, each note in full with 0.3 s between, then the learner
   sings each note back with nothing sounding; it scores each note against its own octave, names no
   chord, prints each note's name with every black piano key as a sharp, shows a tuning dot and no
   staff, and starts its root on the preset's starting note; its level changes every note's length
   and the time to sing (FACTS 62 to 65). Needs engineering, not blocking this page: a chord-type
   launch field, triads and inversions (SEASON-2 § 5.2 item 18), so the card could open it on the
   dominant seventh and its inversions. The two fixes this package found have shipped: each note is
   waited out before the next, as Arpeggio Jumper's are
   (`src/features/exercises/arpeggio-jumper/use-arpeggio-jumper-controller.ts:316-319`), so the
   first three notes sound their full length (FACTS 62); and its help text and its summary say what
   the drill does (FACTS 66).
2. **Ear Lab's Stack**, `/ear-lab?lesson=27`, printed mercurypitch.com/ear-lab, then tap Stack. Today
   it plays one block chord on a roved root and asks for its quality from six, the dominant seventh's
   pad marked 7; no major seventh chord (FACTS 67). Needs engineering: the `ear-drill` launch kind
   with major against dominant seventh as a subset (SEASON-2 § 5.2 item 12).
3. **The lesson marker** reads Season 1's numbers only (`src/lib/lesson-marker.ts:18-19`); `?lesson=27`
   waits on SEASON-2 § 5.2 item 21, before which this page is not built (FACTS 69).

Both are free (FACTS 71). The rest version names Chord Stacker in Lesson 12's form, and Stack stays
on offer under it (FACTS 70).

## Explorer and season data

The entry for `kit/season.ts`, in Season 2's data once the kit's seasons land (What the kit and the
app still need, item 3), in the form of Lesson 12's entry
(`src/features/lessons/kit/season.ts:386-405`) and Lesson 9's link
(`src/features/lessons/kit/season.ts:335-343`):

- `n: 27`, `lane: 'theory'`, `title: 'Seventh chords and inversions'`, `short: 'Sevenths'`,
  `topics: ['T24', 'T25']`, `minutes: 15`, `page: '/learn/27'`, `hook`: the title (FACTS 1).
- `pr.link`: `href: '/pitch-training?lesson=27'`, `addr: 'mercurypitch.com/pitch-training'`,
  `label: 'Exercises'`, `note: 'then tap Chord Stacker'`.
- `pr.needs` (admin only), as the hand-back writes it: "Chord Stacker opening on the dominant
  seventh, with triads and inversions (today it shuffles maj7, min7, dom7, dim7 and maj6); Stack
  with major against dominant seventh alone (the ear-drill launch kind)".
- Two edges: `[12, 27]` and `[23, 27]`, so the explorer lights Lessons 12 and 23 as this lesson's
  path and `PREREQ` reads them (`src/features/lessons/kit/season.ts:456-483`).
- In `kit/lesson-copy.ts` (`LESSON_COPY`, `src/features/lessons/kit/lesson-copy.ts:79`): the hook
  with no alternative; the tease for this lesson, which Lesson 26's card prints, "G, B and D going
  home to C, E and G. Now add one note on top.", with `teaseAlts` `three-notes`, "Three notes make a
  chord. Add one more to V, and hear where it goes." (FACTS 5b). Lesson 28's tease, "A song in two
  parts. At bar 8 it seems to end, then keeps going.", is Lesson 28's entry, as the lead bound it
  (FACTS 5).
- In `kit/team-notes.ts`: the signature line from the card (FACTS 4), "Lesson 12's rooms on the
  ring; the V room gains a fourth corner; ti and fa lie straight across and fold inwards to do and
  mi; a chord turns over and keeps its name", and a `TEASE_NOTES` line saying the tease is this
  page's opening in miniature and names no note and no third.

The explorer opens on Season 2's tab with this lesson lit; its line above the heading is "Season 2 ·
Lesson 27" and under it Lesson 1's line (FACTS 6).

## What the kit and the app still need

Found in the kit and the app as they stand on main at `c60f0fdcb`. Every item is proposed. Items 3
and 5 are Season 2's kit PR (SEASON-2 § 8.2 item 1) or an earlier Season 2 page's, which come
first; they are listed so this page's needs are in one place.

1. **The lesson host**: `learn/27.html` at `/learn/27`, which every build takes as a lesson page, a
   draft's included (`lessonPages`, `tools/draft-lessons.ts:82-90`); `/learn/27` and
   `/learn/27.html` in `STANDALONE_DOCUMENT_PATHS` (`src/lib/sw-runtime.ts:93`); the first-paint
   budgets. The lesson pages' route already takes any two digits (`LESSON_PAGE`,
   `src/lesson-gate.ts:135`).
2. **The draft line**, in the draft list's form (`src/features/lessons/kit/drafts.ts:31-42`):
   `27: "Lessons 12 and 23's pages at /learn/12 and /learn/23, and the vocal coach's look at the sung
checkpoint and the sung drill"`. Releasing it is deleting that line, then listing the page in the
   sitemap and llms.txt (SEARCH.md § 12 item 3).
3. **Seasons in the kit** (SEASON-2 § 6.2 item 1): Season 2's data in its own module, Lesson 27's
   entry and its two edges, the masthead's season from the data (today a constant,
   `src/features/lessons/kit/lesson-menu.ts:111`), and the explorer's tab per season.
4. **Lesson 12's ring of rooms in the kit**: `lesson-12/rooms-draw.ts`, its marks and its plays move
   into the kit, and Lesson 12's page then imports them. They gain: rooms of four corners, drawn in
   their order round the ring; a room set per page, so the hero draws two; the diagonal with its two
   arrows; the bass mark; Turn over, with the position's name and the press after the last inversion
   back to the first pitches; a chip and a control that a predict's `unlocks` can hold; and
   the centre's text set by the page ("V · G major", the four letters, "V7").
5. **The staff toy's chords** (SEASON-2 § 6.2): a chord written as stacked noteheads on one column,
   a second set side by side, in either clef, its notes lit as they sound; an octave climb drawn as a
   note moving up the staff; no key signature, accidentals to the left.
6. **Lesson 12's chord levels and Lesson 6's interval pair in the kit**, with a four-voice level of
   0.056 beside the three-voice 0.075 (FACTS 73). If Lesson 25's page has moved the pair first, it
   is used from there.
7. **A predict that waits for another**, wired as Lesson 22's page wires its second: Step 4's
   choices and plays disabled in the markup with their own hint, and the cold open's `onChoice`
   setting the lock line, enabling them and only then mounting Step 4's predict, which keeps the
   hint it finds ("the page's own hint, asking for a choice", `src/features/lessons/kit/predict.ts:84-85`).
   No kit change.
8. **Lesson 23's question object**: its quick check 1 registered under its id, so this page imports
   it (FACTS 7).
9. **Season 2 in the app's plumbing** (SEASON-2 § 5.2 item 21): the lesson marker's range, the
   lesson-answer bounds (`workers/db-worker/src/mirror-metrics.ts:57-67`), the admin console's
   lesson list (`src/features/admin/lessons/lesson-admin.ts:88`) and the current lesson's reader
   (`src/lib/current-lesson.ts:34-37`).
10. **Chord Stacker's help text and its note lengths**, app content and an app fix, both shipped.
    The help said each note is tuned against the notes already sounding, and its summary that the
    learner builds a chord, though nothing sounds while the learner sings (FACTS 66). It now takes
    the summary and the first sentence proposed here, "Hear a chord one note at a time, then sing
    each note back in tune." and "You hear a chord one note at a time, from the root up, then sing
    each note back on its own.", and adds the octave and the run's five rounds, one chord each
    (`src/features/exercises/exercise-help.ts:212-220`). The play loop waited only a fixed 300 ms
    after each note, so notes 1 to 3 were cut off 0.3 s in at every level; it now waits each note
    out before the gap, as Arpeggio Jumper does
    (`src/features/exercises/chord-stacker/use-chord-stacker-controller.ts:144-168`; FACTS 62). The
    card no longer gives "about a third of a second apart", and the coach's list has the new
    lengths.

## Decisions for the owner

Most of this page follows decisions already made (SEASON-2 § 7) or the lead's answers, the cold
open's predict, both teases and the head title among them. Open:

1. **The coach's call on the sing-along's span**, a minor seventh by thirds, with two shorter
   figures ready (FACTS 54).

## Edge cases

- **Sound off**: every play shows the kit's sound-off line and changes nothing; neither predict
  reveals; the steps' plays and the guide wait. The page is readable throughout.
- **A play cut short** by another play or by Stop counts as not heard: it reveals nothing.
- **Scrolling past the predict**: the steps' toy and the free play hold their V7 controls, Steps 1,
  2 and 3 their held text, Step 4 its whole predict, as Toys 1 and 3 say, and the welcome tour waits
  for the choice; Sing it, the quick check and the Wrap, whose lines state or lean on the answers,
  sit below the steps (FACTS 1a).
- **A return visit**: neither choice is stored; every hold applies again, and the tour, once seen,
  does not run again (`fyp-tour`, `src/features/lessons/kit/tour-gate.ts:29`).
- **No stored voice**: the staffs show the bass clef and play the lower voice until the voice
  choice; the cold open and quick check 4 play for everyone in Merc's register.
- **The Clef switch** shows the other clef for the same notes; the plays stay in the learner's
  voice.
- **Narrow screens**: at 390 px the ring and the staff stack, the ring first; the ring's twelve
  names stay legible at its smallest size, and no tap target is under 44 px.
- **Reduced motion**: every growth, climb, arrow and mark lands in place; the beads and notes still
  light as they sound.
- **Screen readers**: the reveal and the held elements are not announced as they appear; the
  predict's "You said" line is; every ♯ and ♭ has a spoken name.
- **Low notes on a phone**: G2, 98 Hz, sounds only in the lower voice's V and V7, in Step 1's V chip
  and held play, Steps 2 to 4 and free play; the lab checks it on a phone's speaker, and if it is
  lost there the lower voice's examples move up an octave, to the higher voice's pitches, while the
  staff keeps the bass clef and its ledger lines.
- **High notes**: G5, 784 Hz, sounds only in free play, the higher voice's I with its seventh turned
  over three times; it is written in the space above the treble staff, with no ledger line, and the
  next press returns the chord to C4, E4, G4 and B4.
- **Turn over pressed again and again** cycles through the chord's positions and back to its first
  pitches; it never climbs past them (FACTS 50).
- **Quick check before the cold open**: allowed; its question 1 offers F among three answers, below
  Sing it (FACTS 1a).

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-27/`, and on the
kit parts it adds:

1. **Chords**: I and V stacked in C major, with and without their sevenths, give FACTS 15 and 16's
   notes and thirds; C up to B is 11, G up to F 10; G, B and D hold no pair six apart, G, B, D and F
   hold one, B and F, and G, B, D and F♯ none, B up to F♯ being 7 (FACTS 13, 23).
2. **The ring**: B and F 180 degrees apart; a room's corners at its notes' places whatever their
   octave; a four-corner room's corners in ring order; Turn over leaves a room's corners unchanged
   and moves the bass mark; the black piano keys, F♯ among them, drawn smaller with their names
   beside them, as on Lesson 12's ring (FACTS 1a, 30, 31, 50).
3. **The cold open's lock**: at first paint, with no choice, the steps' toy lights I, and its V chip
   and V7 plays are disabled under the steps' line; Step 1's paragraph on so and its play are hidden
   and the held line shows; Steps 2 and 3 show only their headings and held lines; the free play's V
   chip, seventh, diagonal and V7 plays are disabled; the hero draws two rooms and no fourth corner;
   Step 4's choices and plays are disabled with their hint. After a choice the V controls and Step
   2's fourth corner on V are enabled, and Step 4's choices too, while the held text stays hidden;
   after both answering plays are heard with sound on, in either order, the reveal, Step 1's
   paragraph and Steps 2 and 3's text show. A new visit holds all of them again. A play cut short
   reveals nothing (FACTS 1a, 37, 39, 40).
4. **No "Now play the other one"**: neither predict has a `next` hint, and after one answering
   play the hint is still "Locked in. Play both." (FACTS 37).
5. **Step 4's lock**: Turn over and the chips, and the free play's Turn over, are disabled until
   Step 4's choice; the reveal shows the body, Try, Notice and drawer only after both of its plays
   (FACTS 1b, 48, 50).
6. **The tour** waits for the cold open's choice on a first visit (FACTS 39).
7. **The plays**: each play's notes, for each voice, are FACTS 72's; three-note chords at 0.075 a
   voice, four-note at 0.056; the hero and quick check 4 the same for both voices (FACTS 72 to 74).
8. **The staff**: every chord and inversion written in both clefs with no key signature; in the
   treble, G3 under the second ledger line below, B3 under the first, and G5 in the space above the
   staff with no ledger line; in the bass, E4 on the second ledger line above and G4 on the third;
   F♯ with its sharp; two notes a second apart side by side, F and G in V7's inversions and B and C
   in those of I with its seventh (FACTS 51, 52).
9. **The headings**: the masthead's menu lists the four headings, and none contains F, F♯,
   "inversion" or "bottom note" (FACTS 1a, 1b).
10. **The head**: the title at most 60 characters; the description 80 to 160 characters with "A
    fifteen-minute lesson"; `timeRequired` `PT15M`; no head text contains "F" as a note name
    (`src/tests/lesson-pages.test.ts:154-159`; `src/tests/lesson-pages.test.ts:197-210`).
11. **The words**: three words, none built on G; their plays as Toys 4 (FACTS 41).
12. **The recall** imports `l12-q3` and Lesson 23's question 1, and its step links read "Try Lesson
    12, Step 4 again" and open `/learn/12` at that step in a new tab (FACTS 7).
13. **The quick check**: four questions of three answers, shuffled; question 4 plays G3, B3, D4 and
    F4 for 1.5 s (FACTS 75 to 78).
14. **Sing it**: the comfort check, the voice choice and Lesson 15's line; Merc's notes and the
    guide's, D3 to G3 for the lower voice and D4 to G4 for the higher, with the count-in on so;
    "Effortful" and "Uncomfortable" put the guide away for the visit and choose the card's rest
    version; nothing asks for a microphone (FACTS 52, 56 to 61).
15. **The practice card**: its links carry `?lesson=27`; its printed addresses carry none; the rest
    version names Chord Stacker and keeps Stack (FACTS 69, 70).
16. **The next card**: Lesson 28's hook and the tease from the season data, "A song in two parts. At
    bar 8 it seems to end, then keeps going.", and "Coming later" while Lesson 28's page is not live
    (FACTS 5).
17. **Accessibility**: the figures' accessible names use words only; every ♯ and ♭ has a spoken
    name (`signsHtml`, `src/features/lessons/kit/notes.ts:221`); the held elements are not
    announced.
18. **The tease still** on Lesson 26's card shows the V room with three corners (FACTS 1a).
19. **Turn over's pitches**: from each chord it can turn, in each voice, every press sounds FACTS
    72's pitches for the next position; the press after the last inversion sounds the first pitches
    again, the third for a triad and the fourth for a seventh chord; and no press, however many,
    sounds a pitch outside FACTS 72's, G2 to G5 (FACTS 50, 72).

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practice links that carry `?lesson=27` before any hash. Then the layout, accessibility, sound,
motion and storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text
children, touch targets of at least 44 px with no two tap zones overlapping (the ring's beads and
rooms are drawn, never tapped; the chips, Add the seventh and Turn over are buttons and a switch),
visible focus, a single dark theme with every colour a token and an explicit body background, sound
only after a tap, localStorage only for per-viewer conveniences inside try/catch, and the whole page
usable with no sound, no WebGL and no storage. Every ♯ and ♭ the page prints has a spoken name, the
sign `aria-hidden` and a visually hidden word after it (`signsHtml`,
`src/features/lessons/kit/notes.ts:221`). "Piano key" means a key of the keyboard everywhere on the
page, and "key" alone a musical key (FACTS 10). The page stores the quiz seeds and records
(`fyp-l27-recall-seed`, `fyp-l27-recall-v1`, `fyp-l27-seed`, `fyp-l27-quiz-v1`), `fyp-done`
(`src/features/lessons/kit/progress.ts:12-15`), `fyp-voice`
(`src/features/lessons/kit/voice-choice.ts:20`), the masthead's Pause animations choice,
`fyp-motion` (`src/features/lessons/kit/motion-switch.ts:12`), the steps the viewer reached,
`fyp-pos` (`src/features/lessons/kit/position.ts:20`), and its record of the welcome tour,
`fyp-tour` (`src/features/lessons/kit/tour-gate.ts:29`); nothing from the toys or Sing it but the
voice. The predicts' choices, the Clef switch, the pitch-line switch, Add the seventh and the turned
chord hold for the visit, in memory.

The departures from ARTICLE-PLAN.md, each argued in FACTS and listed in LESSON.md's preamble: the
predict asking the hook's own question, which note makes V pull harder, F or F♯, after the review
(FACTS 1a, 34); both choices played, the reveal waiting for both (37); two rooms in the hero, not
four (33); Tavi's bubble arguing F♯, a semitone under G, the plan's line moved to Step 2's card, and
Merc's line changed (35, 36); both prerequisites on the chips (2); the promise and the words keeping
both answers back, three words in place of four (1a, 1b, 41); Step 1's paragraph on V7 and Steps 2
and 3's text waiting for the reveal, and the toys, the free play and the tour holding until the
choice (39, 40); Step 3 without a predict, without minor and without the plan's Tavi line, with B
and F♯ beside B and F (23, 44, 45, 46); Step 4's heading, its wait for the cold open, and its reveal
naming the two rules it breaks (48, 49); Go deeper keeping two of three items (47); the quick
check's reworded stems and feedback (75 to 78); the practice card's account of Chord Stacker and
Stack (62 to 70); the run time at 15 minutes, not 14 (3); and both teases the lead's, the plan's
lines withdrawn (5, 5b).
