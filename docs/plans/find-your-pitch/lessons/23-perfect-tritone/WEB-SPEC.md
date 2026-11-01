# Lesson 23 web page: spec

The Lesson 23 page is the web lesson for "Perfect, major, minor and the tritone": written steps,
one main toy in four step states with free play, a cold open on the hero's upright pitch line, one
predict, the four words, an unscored sing-along with a listening part, two quizzes (the recall and
the quick check) and the lesson explorer. Copy is in [LESSON.md](LESSON.md); every claim is in
[FACTS.md](FACTS.md). It is a text-only package: no film exists for Lesson 23, so the page has no
Watch section and the masthead's anchors are Lesson, Sing and Explorer.

It is built on the kit (`src/features/lessons/kit/`) as Season 2's kit PR leaves it (SEASON-2 § 8.2
item 1): the season structure, the staff toy with both clefs and the house on the staff, and the
lesson plumbing; and on Lesson 15's page, whose staff toy, voice line and sing flow it reuses
(Lesson 15 WEB-SPEC, Toys 1 and 5). Like every lesson page it reuses and never copies: a part that
lives in an earlier lesson's module moves into the kit first, as Lesson 6's interval pair does here
(What the kit and the app still need, item 5). Where this page shares a behaviour with Lesson 15's,
it is Lesson 15's, unchanged unless this spec says otherwise.

One object carries the lesson: the learner's staff and the pitch line, side by side (FACTS 39). The
pitch line is Lesson 2's semitone ruler stood upright, a lane for each note from C to the C an
octave up, a semitone apart, the staff's pitch-line switch turned on. In the hero it stands alone
with only its two ends named; in Step 1 an interval lights on both, its letters counted on the staff
and its semitones on the line; in Step 2 one top note takes a sharp and the next a flat and lands on
the same lane; in Step 3 Fold lays an interval and its upside down along the line, filling the
octave; in Step 4 the line curls into Lesson 2's ring, where B and F sit straight across. That path
is the card's signature, an interval lying against its upside down and the tritone as the ring's
diameter (FACTS 4).

Its public home is `mercurypitch.com/learn/23` (FACTS 9): a hand-written document `learn/23.html`
with its module in `src/features/lessons/lesson-23/`, wired as Lesson 10's page is: a written lesson
with no film, its cold open before its recall, a recall that asks Lesson 6's own questions, and a
sing-along with no microphone. It joins `kit/drafts.ts` in its first commit and publishes only after
`/learn/06` is live, because its prerequisite chip and its recall link there and it imports Lesson
6's questions, and after the vocal coach's look at its voice lines (LESSON.md, For the vocal coach).
The next-lesson card on Lesson 22's page draws this lesson's tease above its hook from the season
data, and this page's card draws Lesson 24's; neither is written into a page's markup (FACTS 5,
5b).

## Look

Lesson 15's look: the dark listening room, the series colour code, Lesson 1's type and wordmark,
the staff toy's engraving and the motion rules (Lesson 15 WEB-SPEC, Look), with Lesson 17's colours
for a sounding note. On this page:

- **Notation** is ink `#e6edf3` on chrome lines `#c3ccd6`: plain noteheads without stems, since no
  note value is taught, accidentals to the left of their notes, and ledger lines no further than a
  note needs. A note lights in its singer's colour while it sounds, blue `#58a6ff` on the bass staff
  and orange `#ff7448` on the treble, by the voice the learner chose, as on Lesson 17's page; its
  lane on the pitch line lights in the same colour.
- **The pitch line** keeps Season 1's look: a lane for each note, a semitone apart, the white-key
  lanes chrome and the black-key lanes fainter; before the cold open's choice the steps' line draws
  its white-key lanes only (Toys 1). Only a lit note is named, and its name stays while it is part
  of the interval shown (FACTS 1a).
- **The readout**, in JetBrains Mono under the drawing, gives letters, semitones and the
  interval's name in ink, a count that is never carried by colour alone.
- **Gold** `#ffd84d` marks only the fit: on Fold, in Step 3 and in free play, the bracket for the
  whole octave as the interval and its upside down meet in it, with their sum written beside it, as
  in "7 + 5 = 12" (MASTER-PLAN § 5's "things that line up"). Nothing else on the page is gold.
- **No decorative staves or clefs** anywhere: in a season that teaches the staff, a staff is always
  music (SEASON-2 § 1.5 item 7; FACTS 6).
- **Nothing is in tune or out of it**, and nothing is scored, so the page uses no target band, no
  singer violet and no mint.

What moves: Merc and Tavi's idle loops; while something the learner started plays, the lit notes
and lanes; in the cold open's answering plays, the lanes drawing in (0.4 s) and the counts; at the
choice, the steps' black-key lanes drawing in (0.4 s); a note landing on its place; Fold (0.6 s);
Curl into a ring (0.8 s). Under `prefers-reduced-motion`, or
with the masthead's Pause animations on, Merc and Tavi stop, the lanes and notes appear in place,
and Fold and the curl cross-fade with no travel; what the learner starts still sounds, and the
notes still light as they sound (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Season 1's departures kept: the step toys double as the
Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it; the
practice card sits in the Wrap. No Watch section. The page opens in Lesson 2's order (FACTS 5a).
Each section's heading, and the line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Season 2's, "Season 2 · Lesson 23", with Lesson, Sing and Explorer, the Sound
   toggle off by default and Pause animations, through `initMasthead`
   (`src/features/lessons/kit/page-chrome.ts:127-159`) with `{ lesson: 23, deck }`. Its lesson
   menu lists the four step headings from the first paint and heads its card "Lesson 23 · How do you
   name an interval?"; no heading names a note, a size or the tritone (FACTS 1a, 48). On a first
   visit its welcome tour waits for the predict's choice (Toys 3).
2. **Hero, with the cold open**, laid out as Lesson 2's: the kicker, the hook question as the title
   (`<h1 class="hook" id="hook">`), the meta as three chips, the promise and the sound gate from
   LESSON.md. The chips are "14 minutes" (FACTS 3), "After Lesson 6: Intervals: the distance between
   notes", a link to `/learn/06` that stays a plain chip wherever Lesson 6 is not live
   (`src/features/lessons/kit/page-state.ts:14-20`; FACTS 2), and "Sound on". Its stage holds Tavi's
   and Merc's bubbles over Merc and Tavi on the floor line, the upright pitch line between them
   (Toys 2), and under it the cold open's three plays: Play C up to C, which works from the start,
   and Play C, G, C and Play C, F♯, C, locked until a choice. The predict card sits under the stage
   (Toys 3). On a phone the hero's parts run kicker, title, meta, the stage, the gate, the predict,
   then the promise (`src/features/lessons/kit/lesson-stage.css:394-437`), so the title and the
   first Play come before anything asks for an answer. The head: the title, at most 60 characters,
   "Interval quality: perfect, major and minor | MercuryPitch" (57), proposed, as Lessons 15 to 21
   propose theirs; the description, "Which interval splits the octave exactly in half, and why does
   it want to move? A fourteen-minute lesson with sound toys: perfect, major and minor intervals."
   (157), which the head test holds to 80 to 160 characters and to the chip's run time in words;
   og:title and twitter:title "Perfect, major, minor and the tritone · Find Your Pitch, Lesson 23"
   (66), in Lesson 4's form; og:description and twitter:description the hook alone (79); the share
   card `learn/lesson-23-og.jpg`, 1200 by 630, its alt "The title card: Find Your Pitch, Lesson 23,
   Perfect, major, minor and the tritone, above an upright pitch line with C at its foot and C an
   octave up at its top and nothing between, between Merc and Tavi." (203), with no note between the
   two Cs (FACTS 1a); the two structured-data blocks from Lesson 1's, the Article's `headline` the
   lesson's name, its `alternativeHeadline` the hook, `timeRequired` `PT14M`, position 23, and
   `teaches` "Naming an interval by its number and quality", "Perfect, major and minor intervals",
   "Augmented and diminished intervals, and the tritone" and "Turning an interval upside down"; and,
   on release, the llms.txt line in Season 1's form: "[Lesson 23: Perfect, major, minor and the
   tritone](https://mercurypitch.com/learn/23): Which interval splits the octave in half, and why it
   wants to move. Naming an interval by its number and quality, the perfect intervals, augmented and
   diminished intervals and the tritone, and turning an interval upside down." (SEARCH § 3.2 and §
   3.4). The structured data and the llms.txt line, which no learner meets before the choice, name
   the tritone as a topic and name no note, size or halfway note (FACTS 1a).
3. **Recall from Lesson 6**, straight after the hero: Lesson 6's questions 3 and 4, shown to
   everyone (Toys 7; FACTS 7).
4. **Four words you'll meet**: Number, Quality, Perfect and Inversion, each with its figure and play
   (Toys 4).
5. **Steps**: the step deck, four steps, the staff toy stuck beside the text (Toys 1), Step 2's
   mix-up card in its text, a Go deeper drawer in Steps 2 and 4 (Toys 6).
6. **Sing it**: the comfort check, the voice choice and Lesson 15's line under it, Your turn, the
   staff guide, "How did that feel?" and the listening part (Toys 5).
7. **Quick check**: four questions (Toys 7).
8. **Wrap**: the three lines, the one-sentence challenge, the practice card in the version Sing
   it's ending picks (Practice links; Toys 5), the next-lesson card with its still (Toys 8), and free
   play, the step toys unlocked.
9. **Explorer**: the season's map, opening on Season 2's tab (Explorer and season data).
10. **Footer**: LESSON.md's, with the practice link, the fonts line and "Every sound on this page is
    synthesised in your browser."

## Length

The learner copy is 2,048 words on `node scripts/lesson-words.mjs`, every branch counted, under the
series' cap of 2,379 by 331 (FACTS 3). The page runs about 14 minutes: 8.61 minutes of reading at
238 words a minute and about 5.1 of sound, toys and tasks, 13.71 in all, past MASTER-PLAN § 4.2's
"8 to 12 minutes of active time, 500 to 900 words", as Lessons 3, 5, 6, 7, 10, 12 and 15 are. The
chip is an estimate until the staff toy's interval state is timed in its lab, as SEASON-2 § 1.3
asks, and this section says so until then. Each step's own text, with its Try, its Notice and any
Tavi line, runs 112 to 119 words (Steps 1 to 4: 112, 119, 116 and 119), inside 50 to 120 a step.
Five parts carry more, by the same counter, for these reasons:

- **Step 2, 288 words with its mix-up card and its drawer.** The card sits in the step whose toy
  refutes it; the drawer, two items, is closed by default.
- **Step 4, 171 words with its drawer**, one item, closed by default.
- **Sing it, 361 words.** It holds the series' singing lines, Lesson 3's word for word, which are
  not cut, Lesson 15's line under the voice choice, two lines of its own (the top note that feels
  high, and Easy and Workable's) and the listening part (FACTS 53, 57, 58).
- **The quick check, 235 words**, and **the recall, 183**: three answers a question with a line of
  feedback for each, as MASTER-PLAN § 4.2 item 8 asks; the recall is Lesson 6's, word for word.
- **The Wrap, 236 words**: the practice card says what Leap does and what to listen for, and keeps
  its rest version, Lesson 8's (FACTS 56, 60).

The hints and status lines are stage directions in LESSON.md and are not counted, as in the text
packages of Lessons 9 to 15, 17 and 19: the predict's hints and its two "You said" lines, the names
of the plays a choice unlocks, the stored voice's line, Sing it's hints, and the toys' labels,
readouts and hints. A built page writes them in the open and counts them, about 150 words more
(Lesson 8 FACTS 4), so the built page is about 2,200 words, under the 2,230 the series aims for and
under the cap, with the chip still at 14 minutes. No cut is needed. The article plan budgeted about
1,200 words; its own section estimates add to 1,575 before the recall, the drawers and the practice
card (FACTS 3).

The activities are timed from this spec's lengths (FACTS 3, 66 to 73). Free play is not counted.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                  | New in Lesson 23                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1. The staff toy          | The kit's staff toy, both clefs, its pitch-line switch, sound and step deck (SEASON-2 § 6.2 item 2; Lesson 15 WEB-SPEC, Toys 1); Lesson 6's interval pair, moved to the kit; the kit's spiral, top view | The interval state: a bottom note on C and a top note to move, Sharp and Flat, the readout, Fold, the B lane and Curl into a ring |
| 2. The hero's pitch line  | Season 1's pitch line, a lane for each note; the staff toy's lanes                                                                                                                                      | The pitch line upright with only its two ends named; the lanes and counts drawn by the answering plays                            |
| 3. Predict widget         | The kit's predict (`kit/predict.ts`), with a free play, `revealAfter: 'all'` and `onChoice`; the tour's hold (`kit/tour-gate.ts`)                                                                       | The steps' toy holds back its answering controls, plays and black-key lanes until the choice                                      |
| 4. Four words             | The kit's words strip (`kit/words-strip.ts`), with the page's sound owner; the staff toy's engraving                                                                                                    | Four small staff figures                                                                                                          |
| 5. Sing it                | Lesson 15's Sing it, on Lesson 12's sing flow moved into the kit (`kit/comfort.ts`, `kit/voice-choice.ts`, `fyp-voice`, `kit/move-do.ts`'s count-in); Lesson 8's rest line                              | The do, so, do line in D on the learner's staff; two lines of its own; the listening pair and its button                          |
| 6. Go deeper drawers      | Lesson 2's `details` drawer                                                                                                                                                                             | Three items in two drawers                                                                                                        |
| 7. Recall and quick check | The kit's quiz (`kit/quiz.ts`); Lesson 6's questions and plays (`lesson-06/quiz-questions.ts`, `lesson-06/quiz-play.ts`), imported as Lesson 10 imports them                                            | Ids and keys; quick check 4's play                                                                                                |
| 8. Tease still            | The kit's next-lesson card and its slot (`kit/next-card.ts`)                                                                                                                                            | One still: a drone band and a line just above it, which plays nothing                                                             |

### 1. The staff toy

The kit's staff toy (Lesson 15 WEB-SPEC, Toys 1), with one new state, the interval state, as an
option of the toy, not this page's code (What the kit and the app still need, item 4). It is mounted
on the step deck's stage, in four step states and free play in the Wrap. DOM buttons sit under the
drawing, so the keyboard and the stage-fit test reach every action.

- **The learner's octave.** The staff is the learner's, the bass clef with C3 at the foot for the
  lower voice and the treble with C4 for the higher, the lower when no voice is stored; the staff's
  Clef switch shows the other, and the examples move with it, so what is written is what sounds
  (FACTS 8). C3 sits in the bass staff's second space and C4 one ledger line above it; in the treble
  C4 hangs on one ledger line below and C5 sits in the third space.
- **The pitch line, on.** The staff toy's pitch-line switch is on in every state of this page, since
  the semitones are what the page counts: a lane is one note's row, so the line from the learner's C
  to the C an octave up has thirteen, eight white-key lanes and five black-key lanes, beside the
  staff (FACTS 15, 39, 79). The learner can turn it off; the readout counts the semitones either
  way. Before the cold open's choice the line draws its white-key lanes only, at their heights, as
  the hero draws no lane, so no faint lane marks the octave's middle; the one black key that can
  sound before then, Step 1's E♭, draws its own lane as it sounds and no other. At the choice the
  black-key lanes draw in, 0.4 s (FACTS 1a, 71).
- **Two notes.** The bottom note is C and does not move. The top note moves a letter at a time by
  Step up and Step down, 44 px buttons, by a tap on a staff place, or by the Up and Down arrows on
  the focused staff, through the eight letters from the unison to the octave; a move to a new letter
  clears its sign. Each move plays the interval as a pair (FACTS 71) and writes both notes as they
  sound: the toy starts with its clef and lines alone, and the first sound writes its notes (SEASON-2
  § 1.4 item 1).
- **Sharp and Flat**, two toggles (`aria-pressed`), raise or lower the top note a semitone. They
  offer only the spellings the page names: Sharp on D, F, G and A, giving D♯, F♯, G♯ and A♯; Flat on
  D, E, G, A and B, giving D♭, E♭, G♭, A♭ and B♭; neither on either C, and no E♯, B♯, F♭, C♭ or
  double sign. A second press of the same toggle takes the sign off, and the other toggle swaps it
  where the letter takes both. So every black key is reached, and F♯ and G♭ both (FACTS 10, 16, 18).
  The toy owns their enabled state: it applies this rule on every move, before the choice and after,
  so Sharp stays disabled on E or B and Flat on F whatever the predict does (Toys 3).
- **The readout**, under the drawing and in a polite live region: the letters, the semitones and
  the name, as in "3 letters · 4 semitones · a major third", "4 letters · 6 semitones · an augmented
  fourth, a tritone" and "5 letters · 6 semitones · a diminished fifth, a tritone"; a unison and an
  octave read "a perfect unison" and "a perfect octave" (FACTS 11 to 14, 16, 17). The augmented
  second, fifth and sixth that Sharp gives on D, G and A are named by the page's rule (FACTS 16).
  "Tritone" is added only to the augmented fourth and the diminished fifth.
- **Fold** (Step 3 and free play) lifts the bottom note an octave: the staff writes the interval,
  then its upside down after it, the pitch line lays the two spans end to end, touching at the top
  note and filling the octave, and the readout gives both names and the sums, as in "5 + 4 = 9" and
  "7 + 5 = 12", the octave's bracket turning gold as the spans meet (Look). It plays the two pairs,
  3.6 s. A move, Sharp or Flat brings back the single interval from C (FACTS 21 to 24).
- **The B lane and Curl into a ring** (Step 4 and free play). The state draws one lane below the
  foot, B, a white-key lane unnamed until it lights, so Step 4's B and F light on the line, fourteen
  lanes in all. Curl into a ring, a toggle that then reads Straighten the line, bends the line round
  until its two Cs meet in one bead at the top, so its thirteen lanes make the ring's twelve beads,
  and the B lane below the foot merges into the ring's B bead, beside C: Lesson 2's ring of twelve,
  drawn as the kit's spiral draws it seen from the top (`setView('top')`,
  `src/features/lessons/kit/spiral.ts:28-30`), as Lesson 2's page shows it
  (`src/features/lessons/lesson-02/spiral-copy.ts:234`), held to one octave (`range`,
  `src/features/lessons/kit/spiral.ts:131`). Every bead is named on the ring, since Curl into a ring
  waits for the choice (Toys 3). Step 4's play lights B and F straight across, then steps each one
  bead to C and E (FACTS 20, 29). Whether the toy mounts the spiral or draws a
  flat ring in its colours is the lab's call; the curl itself is new.
- **Before the choice.** Until the cold open's choice the toy holds back whatever would sound,
  draw or read out the answer, disabled and announced as unavailable: Sharp and Flat; Fold; Curl
  into a ring; Step 2's two plays, which would sound F♯ and G♭ and read out six semitones, a
  tritone; Step 3's two plays, drawn as Fold draws them, the fifth folding into 7 and 5; and Step 4's
  play, whose readout gives B up to F six semitones, a tritone. The pitch line draws no black-key
  lane until then, as above. What stays open: Step 1's two plays, since a minor third answers
  nothing, its E♭ drawing only its own lane; and Step up, Step down and a tap on a place, which reach
  only white keys, where the readout gives a learner who steps to G its seven semitones, Lesson 6's
  fact, worked for and never printed under the choices (FACTS 1a). The toy hears the choice through
  the predict's `onChoice` (Toys 3), then enables these under its own rules and draws the black-key
  lanes in.

The states, with LESSON.md's plays (FACTS 66, 70, 71):

1. **Naming (Step 1).** Plays: "Play C up to E" and "Play C up to E♭", a pair each. Before any
   sound the top note waits on E, unwritten; after a play it stays where the play left it. The Try,
   after the choice, moves it up to A and presses Flat: A♭ keeps A's place on the staff, the line
   drops a lane, and the readout goes from 9 semitones, a major sixth, to 8, a minor sixth, while its
   6 letters stay (LESSON.md's Notice).
2. **Perfect and the tritone (Step 2).** Plays, which wait for the choice: "Play C up to F, then F♯"
   and "Play C up to G, then G♭", two pairs each. F♯ lands in F's place with its sharp and G♭ in G's
   with its flat, a place apart on the staff, and both on the same lane of the line (LESSON.md's
   Notice). The mix-up card sits in the text beside it.
3. **Fold (Step 3).** Plays, which wait for the choice: "Play C up to G, then G up to C" and "Play C
   up to E, then E up to C", each drawn as the fold draws it. The Try folds a fifth, a third, then C
   up to F♯: F♯ up to C is six semitones again, and the readout says "4 + 5 = 9" and "6 + 6 = 12"
   (LESSON.md's Notice).
4. **The ring (Step 4).** The B lane is drawn. Play, which waits for the choice: "Play B and F, then
   C and E", B and F together, then C and E together, each pair lit on the staff, the line and, when
   curled, the ring. The readout reads "B up to F: 5 letters · 6 semitones · a diminished fifth, a
   tritone", then "C up to E: 3 letters · 4 semitones · a major third".
5. **Free play (Wrap).** A second instance of the toy, which the Wrap mounts, as Lesson 8's wrap
   mounts its own beat machine (`src/features/lessons/lesson-08/wrap.ts:26`): every control above
   on one card, with the Clef switch and the pitch-line switch, all thirteen lanes drawn and every
   control under its own rules from the start, whether or not a choice was made, and no reveal or
   quiz attached.

On a phone each step's figure is `.viz.tall`, 310 px tall up to 420 px wide (FACTS 79): the staff
takes about 60 % of the width and the pitch line the rest, thirteen lanes of 20 px, or fourteen of
about 18.6 px with Step 4's B lane, drawn, not tapped; the top note moves by the buttons and the
staff's places. On a desktop the figure is 380 px
tall. At the kit's four short landscape sizes the stuck stage keeps each step's controls on screen,
as the stage-fit test checks (`src/e2e/learn-stage-fit.spec.ts:33-54`).

### 2. The hero's pitch line

The cold open's own drawing, `lesson-23/cold-open.ts`, new, on the staff toy's lanes: the pitch line
standing upright between Merc and Tavi, C4 at its foot and C5 at its top, both named, and between
them the words "an octave: 12 semitones". Before a choice nothing else is drawn: no lanes, no notes,
no names (FACTS 1a, 40). It plays in C4 to C5 for everyone, Tavi's register, since the voice choice
comes later on the page (FACTS 8).

- **Play C up to C** (free, `data-free`): C4, then C5, then the two together, each lighting its end
  of the line as it sounds, 2.6 s (FACTS 41, 67). It works before and after a choice and never
  reveals.
- **Play C, G, C** and **Play C, F♯, C** (locked until a choice; the predict's answering plays): C4,
  the middle note and C5, one at a time, then C4 and the middle note together, 3.3 s. As the middle
  note sounds it lands at its height and is named, the thirteen lanes draw in, and the two leaps are
  counted beside the line, "7" and "5" for G, "6" and "6" for F♯ (FACTS 44, 67). Each play redraws
  the line with its own middle note; after the reveal the line keeps its lanes and the last split.
  The polite line says each split in words: "G: seven semitones up, five more to the top C" and "F
  sharp: six semitones up, six more to the top C".
- Merc and Tavi listen while any of the three plays (Merc and Tavi).

### 3. Predict widget

The kit's predict (`src/features/lessons/kit/predict.ts`), as it is (CURIOSITY-MOMENTS § 1, rule 2):
two `.choice` buttons, G and F♯; the plays `octave` (with `data-free`), `g` and `fs`; `revealOn:
['g', 'fs']` and `revealAfter: 'all'`, since the predict compares two sounds; the hints from
LESSON.md, `chosen` "Locked in. Play both splits.", `silent` "Sound is off: nothing played. Turn
sound on, then play it again." and `again` "Play any of them again.", with no `next` hint (FACTS
44); the markup's lock hint, "Choose an answer to unlock the two splits."; `guess` giving "You said:
G" or "You said: F♯"; `onChoice`, which tells the steps' toy that a choice is in, so it enables what
it held back (Toys 1); and on the reveal Tavi's celebration (Merc and Tavi). The predict's `unlocks`
is not used: it enables every listed button as the choice locks
(`src/features/lessons/kit/predict.ts:124-126`), Sharp on E or B among them, where the toy applies
its rule per letter; Lesson 8's Step 5 passes the choice to its stage the same way
(`src/features/lessons/lesson-08/steps.ts:17-19`). What a play does to the hint is the
kit's: a free play heard before a choice puts the lock hint back; a play sound off kept silent shows
`silent`; a play cut short, by another sound or by leaving the hero, counts as not heard and
changes nothing. The reveal waits for both splits heard to their end with sound on, in either
order.

On a first visit the welcome tour waits for the choice. Its step "One step at a time"
(`src/features/lessons/kit/tour-copy.ts:44-46`) scrolls to the steps' stage, the hero's object at
work, so the page holds the tour until a choice is made, through the kit's `holdTour`
(`src/features/lessons/kit/tour-gate.ts:57-69`), as Lessons 15 and 19 hold theirs, with no time limit
(FACTS 47). A visit that never chooses is offered the tour again on the next lesson page it opens at
the top (`tourDue`, `src/features/lessons/kit/tour-gate.ts:36-49`); the lesson menu's "Tour this
page" still runs it at once.

### 4. Four words

The kit's words strip (`src/features/lessons/kit/words-strip.ts:1-12`), as Lessons 7 to 10 and 15
use it: a ticket per word with its figure, its word and definition from LESSON.md, and its play
button, each figure a small staff in the learner's clef drawn by the staff toy's engraving, its
notes written as they sound (FACTS 69). The page passes its sound owner, so a word claims the one
sound as it starts and a newer sound anywhere stops it:

- **Number**: C up to E as a pair, with "3 letters" under the two notes as the second is written.
- **Quality**: C up to E, then C up to E♭, two pairs, "major" and "minor" under each.
- **Perfect**: C up to G as a pair.
- **Inversion**: C up to E, then E up to C an octave up, two pairs: a third turned over, never the
  fifth, so no figure splits the octave at G before the reveal (FACTS 1a, 69).

The strip sits below the recall, below the reveal, and no figure draws a pitch line or a count of
semitones (FACTS 1a).

### 5. Sing it

Lesson 15's Sing it (Lesson 15 WEB-SPEC, Toys 5), on Lesson 12's sing flow moved into the kit, with
the guide drawn on the staff and no Move do. In order:

1. **The comfort check**, Lesson 3's, every visit, never stored (FACTS 49), through the kit's
   `mountComfort` (`src/features/lessons/kit/comfort.ts:159`).
2. **The voice choice**, Lesson 3's two buttons and lines (FACTS 51), through the kit's voice choice
   (`fyp-voice`, `src/features/lessons/kit/voice-choice.ts:20`), after either answer and before
   anything plays when none is stored. Under it, Lesson 15's line, word for word. The staff below
   follows a change at once, and the steps' staff with it.
3. **Your turn**: the learner's staff with do, so, then so, do as plain noteheads, D3, A3, A3, D4 in
   the bass clef or D4, A4, A4, D5 in the treble, the house on do
   (`src/features/lessons/kit/home-glyph.ts:1-13`), and the pitch-line switch (FACTS 52, 55). On the
   bass staff D4 sits just above middle C's ledger line; on the treble D4 hangs below the bottom
   line. The stop line on its own line, then two buttons. Play Merc's notes plays Merc's line
   (lower) or Tavi's (higher) as two contours a breath apart, each one voice: do held 1.15 s and a
   0.05 s glide to so, held 1.8 s; 1.0 s of quiet; then so held 1.15 s, a 0.05 s glide to do, held
   1.8 s; 7.0 s in all (FACTS 55, 72; `contourOf`, `src/features/lessons/kit/sound.ts:290`;
   `playContour`, `src/features/lessons/kit/sound.ts:575`), each note lighting as it sounds. Start
   the guide waits until Merc's notes have been heard with sound on, with Lesson 12's two hints
   (`HINT`, `src/features/lessons/lesson-12/sing-flow.ts:192-197`); then it counts in on do, 0.8 s
   at 0.065 and 0.2 s of quiet (`countIn`, `src/features/lessons/kit/move-do.ts:65-74`), and a
   chrome sweep line runs along the four notes in time, 7.0 s, with no voice and nothing on the
   notes themselves. No Move do and no readout (FACTS 53). The line under the buttons is LESSON.md's
   guide line (FACTS 58a). Your turn's own text adds the line for a top note that feels high (FACTS
   53).
4. **How did that feel?** after each sweep run to its end, through the kit's `mountFeelings`
   (`src/features/lessons/kit/comfort.ts:175`): Easy and Workable give LESSON.md's new line;
   Effortful and Uncomfortable give Lesson 3's lines (with the doctor lines after Uncomfortable), put
   the guide away for the visit, as Lesson 12's flow does, and set the rest ending, "Effortful"
   included, as Lesson 12's flow asks (`AFTER_OPTIONS`,
   `src/features/lessons/lesson-12/sing-flow.ts:99-100`; FACTS 56, 58).
5. **Just listen today**: Merc's line on a tap, in the chosen voice, no guide, and the doctor lines
   (FACTS 50); it sets the rest ending too.
6. **Then just listen**, in every ending: Play ti and fa plays C♯ and G together for 1.5 s, then D
   and F♯ together for 1.5 s, in the soft tone, in the chosen voice's octave, C♯3 and G3 to D3 and F♯3
   or C♯4 and G4 to D4 and F♯4, each pair lit on the learner's staff with its sharps, the house on do
   (FACTS 57, 72). It asks nothing of the voice, so it stays after "Effortful", "Uncomfortable" and
   "Just listen today", and it is never a guide: no sweep, no count-in, no feeling question.

After "Effortful", "Uncomfortable" or "Just listen today" the Wrap's practice card shows its rest
line, Lesson 8's word for word, above its text, and keeps Leap, since Leap asks for no voice (FACTS
56). It is Lesson 8's form, a line in the card shown for the rest ending, through the kit's
`VisitEnding` (`src/features/lessons/kit/comfort.ts:101-114`), as Lesson 8's wrap shows it
(`src/features/lessons/lesson-08/wrap.ts:21-25`). The kit's practise card that stops being a link
after those endings is not needed, since nothing on this card asks for the voice. Nothing listens:
the page never asks for the microphone (FACTS 58a).

### 6. Go deeper drawers

Lesson 2's `details` drawer, closed by default, under the step's text: Step 2's, "Halfway in hertz"
and "Perfect is a name, not a promise" (FACTS 32 to 35); Step 4's, "The devil in music" (FACTS 36,
37), which ends on Fux's rule and says nothing of a church ban (FACTS 38). Text only: no sound and
no figure. Each item's bold lead-in is its summary line's words. The hertz figures print with "Hz",
and "3:2" and "4:3" are read as "3 to 2" and "4 to 3" by a visually hidden word, as the kit's sign
names are.

### 7. Recall and quick check

Two quizzes share this page through the kit's quiz (`createQuiz`,
`src/features/lessons/kit/quiz.ts:218`), each with its own prefix and keys.

- **Recall**: Lesson 6's questions 3 and 4 (FACTS 7), imported from Lesson 6's page and filtered by
  id, `l06-q3` and `l06-q4`, as Lesson 10's page filters its two
  (`src/features/lessons/lesson-10/quiz-questions.ts:32-34`), so one question reports under one id
  on every page. Shown to everyone, since Lesson 6 is the prerequisite, and wired as Lesson 10's
  `initRecall` is (`src/features/lessons/lesson-10/recall.ts:21-29`): prefix `recall-`, keys
  `fyp-l23-recall-seed` and `fyp-l23-recall-v1`, no `lesson`, so it marks nothing done. Its step
  links read "Try Lesson 6, Step 2 again" and "Try Lesson 6, Step 4 again" and open
  `/learn/06#step-2` and `/learn/06#step-4` in a new tab, through `away: { href: recallStepHref }`
  (`src/features/lessons/kit/quiz.ts:142`, `src/features/lessons/kit/quiz.ts:191`). The first
  question, `l06-q3`, keeps Lesson 6's own slot and Play, handled by Lesson 6's `bindQuizPlays` on
  this quiz's host (`src/features/lessons/lesson-06/quiz-play.ts:18`), which plays Lesson 6's pair
  and already claims the page's one sound (FACTS 68); the second, `l06-q4`, has no play.
- **Quick check**: LESSON.md's four questions, ids `l23-q1` to `l23-q4`, keys `fyp-l23-seed` and
  `fyp-l23-quiz-v1`, and `lesson: 23`, so answering all four marks Lesson 23 done. Three answers
  each, shuffled per question from the stored seed, one-line feedback for every answer, and a check
  icon and ink, not gold, on the right one. The kit prints "Right." or "Not quite." before each line
  (`src/features/lessons/kit/quiz.ts:315`). Question 1's "Try Step 2 again", question 2's "Try Step
  3 again", question 3's "Try Step 1 again" and question 4's "Try Step 4 again" go to that step on
  this page. Question 4's slot holds its play, "Play", which plays B3 and F4 together for 1.5 s, for
  everyone, the same on every visit (FACTS 73, 78), handled by one listener on the quiz's host in
  Lesson 10's form, the page's one sound (`src/features/lessons/lesson-10/quiz-play.ts:1-13`); it
  never shares a name with Step 4's play. Question 1's and question 3's wording stay as they are:
  Lesson 27 plans to ask question 1, and Lesson 24 question 3, word for word, as their recalls
  (FACTS 75, 77).

### 8. Tease still

The drawing in the next-lesson card's slot, the page's `[data-next-card]` mark, which the kit keeps
in the card after its words (`src/features/lessons/kit/next-card.ts:27-30`): an SVG,
`aria-hidden`, of Lesson 24's stage as its plan draws it, a wide drone band on A3 and a thin chrome
line just above it, nothing moving, no glow and no "beats" label (FACTS, Illustrations without
claims). It names no beat, so it does not answer Lesson 24's predict (FACTS 5). It holds no button,
since the card is a link, and does not move. It plays no sound, on purpose: Lesson 24's opening
plays the throbbing first, and a played still would give it away. Its styles go under a class of
its own, not the tease line's `.next-tease`.

## Audio

Every sound is synthesised in the page with Web Audio, through the kit's sound module, its master
bus and its house envelopes, and started only by a tap: a played note, the toy's moves and every
example in the soft tone; Merc's singing in Merc's "ooh", and Tavi's the same an octave up; the
guide's count-in in the soft tone at half a tapped note's level (FACTS 66 to 74). Nothing autoplays,
and the page has no music bed.

- **The sound rules**, for every source of sound on the page (the hero's plays, the four words, the
  recall's pair, every play and move of the staff toy, the quick check's play, Sing it and its
  listening pair):
  1. One sound plays at a time, across the whole page: a new play stops the one before, whichever
     toy started it.
  2. Leaving a step, by any route (Next, Back, a swipe, the lesson menu, `#step-N`, a quiz link),
     stops its sound and any queued play; scrolling Sing it off screen for 600 ms, or hiding the
     page, stops what plays there.
  3. A play that is cut short never counts as heard by the predict or by Sing it's gate.

  The kit has the helpers: a page-wide "now playing" owner (`NowPlaying`,
  `src/features/lessons/kit/now-playing.ts:39`), which every source here registers with, and a
  predict `play` that can report "not heard" (`src/features/lessons/kit/predict.ts:31-41`). The
  words strip and Lesson 6's quiz plays take the owner today.

- **Two notes together** (the cold open's last chord, Step 4's B and F, the listening pair, quick
  check 4) start in one timer task, so their voices share one clock (`playNotes`,
  `src/features/lessons/kit/run.ts:113`); a pair's second note is timed from the play's start, as
  Lesson 6 times its pairs, so the drawing and the sound never drift.
- **Merc's and Tavi's line** in Sing it is one voice along a contour, held and glided on the audio
  clock (`src/features/lessons/kit/sound.ts:16-21`), so do and so join with no click.
- **Low notes.** The page's lowest note is the lower voice's B2, 123.47 Hz, in Step 4, and its
  steps start on C3, 130.81 Hz, both faint on a phone's speaker; the soft tone's upper partials
  carry them (FACTS 66). The owner's ear on a real phone decides whether they need more level
  (Contract).

## Merc and Tavi

Lesson 1's setup through the kit (`src/features/lessons/kit/merc-duo.ts`): the app's renderer
loaded after first paint, one WebGL context per Merc, medium quality on phones, turned towards each
other, paused off screen, and the still images when WebGL fails.

- They live in the hero, on either side of the pitch line. Tavi guesses and Merc answers in the
  bubbles (LESSON.md; FACTS 42). While any of the cold open's plays sounds, both listen (`mercListen`,
  `src/features/lessons/kit/merc-duo.ts:207`). Tavi celebrates once as the reveal shows, the guesser
  who then gets it (`mercCelebrate('orange', 1600)`, `src/features/lessons/kit/merc-duo.ts:217`), a
  quiet one, since the reveal calls no choice right: the page mounts the pair with no sparkles
  (`MercDuoOptions`, `src/features/lessons/kit/merc-duo.ts:119`).
- In Sing it Merc and Tavi appear as stills, the Merc who sings beside the learner's staff.
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Ear Lab's Leap.** The link is `/ear-lab?lesson=23`, printed "mercurypitch.com/ear-lab",
  with "then tap Leap" (FACTS 62). Leap plays two notes, one after the other, going up or down at a
  coin flip from a lower note roved between C3 and A4, and the learner names the distance from
  twelve answers, the minor second to the octave, labelled m2 to P8 with TT for the tritone; a round
  has 12 pairs, and a miss replays the pair more slowly (FACTS 60). The card points at the four this
  lesson names, by Leap's own labels (FACTS 61). Ear Lab is free (FACTS 59). Leap asks for no voice,
  so nothing about it needs the voice-safety lines.
- **The rest version.** After "Effortful", "Uncomfortable" or "Just listen today" the card shows
  Lesson 8's rest line above its text and keeps the link (Toys 5; FACTS 56).
- **The first visit.** `?lesson=23` is not a lesson marker today, so a first visit would meet First
  Light, the app's intro, before Ear Lab. The page is not built before SEASON-2 § 5.2 item 21 widens
  the marker, so the card and the footer carry no first-visit line, as Lesson 19's carry none
  (FACTS 62).
- **Needed: the `ear-drill` launch kind** (SEASON-2 § 5.2 item 12), which would open Leap with only
  P4, TT, P5 and P8. When it ships, the card's text changes as LESSON.md's editorial note says, and
  the link opens the subset (FACTS 63).
- **Not linked yet: Interval Trainer's `perfect-intervals`** (item 16), intervals 5, 7 and 12 upward,
  and Lesson 9's `leap-ladder`, which exists. Either is a sung drill, so its card brings the comfort
  lines, a rest version without it and the coach's look; the plan made the second card optional, and
  the page keeps to Leap until `perfect-intervals` ships (FACTS 63).
- Not linked: none of the premium exercises.

## Explorer and season data

Lesson 23's entry, proposed for Season 2's data, which goes in its own module that a Season 1 page
does not load (SEASON-2 § 6.2 item 1), in Season 1's entry form, as Lesson 6's is
(`src/features/lessons/kit/season.ts:264-284`):

- `n: 23`, `lane: 'theory'`, `title: 'Perfect, major, minor and the tritone'`, `short: 'Interval
quality'`, `topics: ['T13']`, with T13's name, "Interval quality: major, minor, perfect; tritone;
  inversion", as SEASON-2 § 4.1 gives it (`docs/plans/find-your-pitch/SEASON-2.md:727`); the hook word
  for word (FACTS 1). `minutes: 14` and `page: '/learn/23'` once the page is built, under the drafts'
  comment in Lesson 6's form (`src/features/lessons/kit/season.ts:270`), naming Lesson 6's page and
  the vocal coach's look. The entry decides nothing about being live: the draft list and the console
  do.
- `pr.link`: `href` `/ear-lab?lesson=23`, `addr` `mercurypitch.com/ear-lab`, `label` "Ear Lab" and
  `note` "then tap Leap", which the explorer's card prints after the address as "Ear Lab, then tap
  Leap" (`practiseMarkup`, `src/features/lessons/kit/explorer.ts:177-181`). `pr.needs`, "Leap with
  only the perfect intervals and the tritone (the ear-drill launch kind)", stays until it ships; it
  is admin only, never drawn on a lesson page (`src/features/lessons/kit/season.ts:102-103`).
- `EDGES` gains [6, 23], a cross-season edge, as SEASON-2 § 4.3 gives it (FACTS 2). Lesson 23's
  prerequisite list is then [6] (`PREREQ`, `src/features/lessons/kit/season.ts:452-458`).
- The tease on Lesson 22's card is this lesson's, set on Lesson 23 in the lesson copy (`LESSON_COPY`,
  `src/features/lessons/kit/lesson-copy.ts:79`): `tease` "One note, swinging. Now two notes
  together: one pair wants to move.", with Lesson 22's planned line as a variant, `teaseAlts` `[{
id: 'hold', text: 'One note, swinging. Now hold two together: one pair wants to move.' }]` (FACTS
  5b). The tease on this page's card is Lesson 24's, set on Lesson 24: `tease` "A drone, and a second
  note just above it, almost in tune.", with a mended form of this lesson's planned line as a
  variant, `teaseAlts` `[{ id: 'fifths', text: 'Fifths count as settled, tritones lean. Next, a note
against a drone.' }]`; the planned line itself is withdrawn (FACTS 5). Each variant's note goes in
  the team's notes, which a variant needs (`TEASE_NOTES`,
  `src/features/lessons/kit/team-notes.ts:71`). Both pairs were settled at the lead's review on 1
  November 2026, as the owner asked; if Lesson 24's writer changes its opening, its tease follows.
- The signature line for the admin console, from the card (FACTS 4): "An interval and its upside
  down fill the octave on the pitch line; curled into Lesson 2's ring, the tritone is its diameter."
  Every season entry has one, in the team's notes (`SIGNATURES`,
  `src/features/lessons/kit/team-notes.ts:31`), which no lesson page loads.
- The explorer opens on Season 2's tab. Its card reads "Ready · read" with "14 min" once the page is
  live.

## What the kit and the app still need

Found in the kit and the app as they stand on main at `c60f0fdcb`. Every item is proposed. Items 3,
6 and 8 are Season 2's kit PR (SEASON-2 § 8.2 item 1) or Lesson 15's page, which come first; they
are listed so this page's needs are in one place.

1. **The lesson host**: `learn/23.html` at `/learn/23`, which every build takes as a lesson page, a
   draft's included (`lessonPages`, `tools/draft-lessons.ts:82-90`); `/learn/23` and
   `/learn/23.html` in `STANDALONE_DOCUMENT_PATHS` (`src/lib/sw-runtime.ts:93`); the first-paint
   budgets. The lesson pages' route already takes any two digits (`LESSON_PAGE`,
   `src/lesson-gate.ts:134`).
2. **The draft line**, in the draft list's form, as Lesson 10's names its prerequisite's page
   (`src/features/lessons/kit/drafts.ts:39`): `23: "Lesson 6's page at /learn/06, and the vocal
coach's look at Sing it"`. Releasing it is deleting that line, then listing the page in the
   sitemap and llms.txt (SEARCH.md § 12 item 3).
3. **Seasons in the kit** (SEASON-2 § 6.2 item 1): Season 2's data in its own module, Lesson 23's
   entry and the edge [6, 23], the masthead's season from the data (today a constant,
   `src/features/lessons/kit/lesson-menu.ts:111`), and the explorer's tab per season.
4. **The staff toy's interval state** (Toys 1), an option of the kit's staff toy (SEASON-2 § 6.2
   item 2): two notes, the bottom fixed on C and the top moved by Step up, Step down and its places;
   Sharp and Flat as toggles that offer only the spellings Toys 1 lists; the readout and its live
   line; Fold; the B lane and Curl into a ring; with pure helpers and their unit tests (an interval's
   number, semitones, quality and name from two spelled notes; its upside down; which signs a letter
   takes). Lessons 25 and 27 can reuse the readout for their intervals.
5. **Lesson 6's pair in the kit**: `PAIR` and `pair` (`src/features/lessons/lesson-06/examples.ts:34`,
   `src/features/lessons/lesson-06/examples.ts:80-90`) move into the kit, since every interval on
   this page plays as Lesson 6's pair, and Lesson 6's page then imports them from there.
6. **The sing flow in the kit** (Lesson 15 WEB-SPEC, What the kit and the app still need, item 6):
   Lesson 12's flow (`src/features/lessons/lesson-12/sing-flow.ts:1-41`) with Move do and the guide's
   drawing as options. This page passes no Move do and the staff toy's sing state, and adds a plain
   play outside the flow, Play ti and fa, open in every ending.
7. **The hero's pitch line**: `lesson-23/cold-open.ts`, new (Toys 2), on the staff toy's lanes.
8. **No decorative staff** (Look; Lesson 15 WEB-SPEC, What the kit and the app still need, item 7):
   no `.mv-staff` in the section heads, no `engraveClefs`, and no background staff on a Season 2
   page.
9. **The lesson copy and the team's notes**: Lesson 23's tease set on Lesson 23 and Lesson 24's on
   Lesson 24 (`src/features/lessons/kit/lesson-copy.ts:12`), each with its variant and each within
   `TEASE_MAX` (`src/features/lessons/kit/lesson-copy.ts:76`; FACTS 5, 5b), both variants' notes in
   `TEASE_NOTES`, and Lesson 23's signature (Explorer and season data). The admin console switches
   between them; nothing on this page changes.
10. **Season 2 in the app's lesson plumbing** (SEASON-2 § 5.2 item 21), the app's work, not the
    page's, and this page waits for it: the lesson marker's range (`src/lib/lesson-marker.ts:19`), so
    `?lesson=23` steps First Light aside (FACTS 62); the lesson-answer bounds
    (`workers/db-worker/src/mirror-metrics.ts:61-62`), which refuse Lesson 23's answers whole today
    (FACTS 64); the admin console's one row per Season 1 lesson
    (`src/features/admin/lessons/lesson-admin.ts:88`); `RELEASED_LESSONS`
    (`src/lib/current-lesson.ts:34-37`).
11. **The head, the structured data and llms.txt** (Sections, 2; SEARCH § 3.1, § 3.2 and § 12):
    the title, the descriptions, the share card `learn/lesson-23-og.jpg` and its alt, the two
    structured-data blocks with `alternativeHeadline`, `teaches` and `timeRequired` `PT14M`, and on
    release the llms.txt line, each checked against the predict (FACTS 1a).
12. **The practise links that wait** (Practice links), the app's work: the `ear-drill` launch kind
    (SEASON-2 § 5.2 item 12) and `perfect-intervals` (item 16). When either ships, LESSON.md's card
    changes as its editorial note says.

## Decisions for the owner

1. **The two teases** (FACTS 5, 5b): settled at the lead's review on 1 November 2026, as the owner
   asked, each with an alternative the console can switch to later.

The head title is proposed in Sections, 2, as Lessons 15 to 21 propose theirs: "Interval quality:
perfect, major and minor | MercuryPitch" (57), term first as Lesson 6's title is, with "Perfect,
major and minor intervals explained | MercuryPitch" (59) beside it if the lead prefers; neither names
the tritone or a number of semitones (FACTS 1a). The sing-along's key, its line for a top note that
feels high and its listening part are the vocal coach's to confirm before publishing (LESSON.md, For
the vocal coach), not the owner's.

## Edge cases

- **Sound off, unset or missing.** Every play obeys the kit's `canPlay`. The predict's reveal and
  Start the guide wait for heard sound (Toys 3, 5). With no Web Audio the page stays readable, every
  play runs its visuals in silence with its hint, and Sing it offers the listen-only path.
- **A hidden page or a section off screen** stops what is playing (Audio).
- **Before a choice**, Play C, G, C and Play C, F♯, C are disabled and the reveal hidden; Play C up
  to C still sounds and lights the two ends, and draws no lane.
- **One split heard, not the other**: the hint stays `chosen`, "Locked in. Play both splits.", and
  the reveal waits; the same after a free play following the choice.
- **Sound off before a choice**: Play C up to C runs its lights silently and `silent` replaces the
  lock hint; once it is heard with sound on, still before a choice, the lock hint comes back.
- **A split cut short** (another sound, a step link, leaving the hero): not heard, no reveal, the
  hint as it was; the line keeps what it last drew.
- **The steps' toy before a choice**: Sharp, Flat, Fold, Curl into a ring, Step 2's two plays,
  Step 3's two and Step 4's one are disabled; the pitch line draws its white-key lanes only; Step
  1's two plays work, its E♭ drawing only its own lane; the top note moves through the white keys
  only, and the readout names white-key intervals alone (Toys 1). A return visit starts with a new
  predict, so the toy holds them back again until its choice.
- **The choice made**: the toy draws its black-key lanes in and enables what it held back, Sharp and
  Flat only where the letter shown takes them (Toys 1, 3).
- **Sharp or Flat on a letter that takes no such sign** (Sharp on C, E or B; Flat on C or F): the
  button is disabled, before the choice and after it, with its accessible name kept, so a screen
  reader hears it as unavailable.
- **The Clef switch mid-play** stops the play; the interval keeps its letters and plays in the new
  octave on the next move.
- **Fold, then a move**: the single interval from C comes back, and the gold bracket goes.
- **Curl into a ring mid-play**: the play carries on and lights the ring's beads from then on.
- **Reduced motion**: the lanes, notes, fold and ring appear in place; the reveal still waits for the
  sound.
- **A first visit that never chooses**: the welcome tour waits for the choice, and the next lesson
  page opened at the top offers it again (Toys 3); the steps' toy keeps its answering controls,
  plays and black-key lanes back, and the Wrap's free play, its own instance, offers everything.
- **No voice chosen**: the steps' staff is the bass clef from C3 with its Clef switch; nothing in
  Sing it plays until a voice is chosen, and its staff waits with no notes. A stored voice opens on
  its own staff, in the steps and in Sing it.
- **Effortful or Uncomfortable**: the guide goes for the visit; Play Merc's notes and Play ti and fa
  stay, as listening; the practice card shows its rest line and keeps Leap, as after "Just listen
  today".
- **No WebGL**: the Mercs' stills; everything else runs.
- **No storage** (a private window): the quiz seeds and the voice last for the visit; nothing breaks.
- **Lesson 6 not live** where the page is served: the prerequisite chip stays a plain chip and the
  recall's step links keep their words with no link (FACTS 7).
- **The practice link** opens Ear Lab with the lesson marker, which by then steps First Light aside
  (FACTS 62); a visitor taps Leap from Ear Lab's bench.

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-23/`, and on the
kit parts it adds:

1. **Intervals**: from C, every top note the toy can reach gives the letters, semitones and name of
   FACTS 13, 14, 16 and 17: D 2 and 2, D♭ 2 and 1, D♯ 2 and 3, E 3 and 4, E♭ 3 and 3, F 4 and 5, F♯ 4
   and 6, G 5 and 7, G♭ 5 and 6, G♯ 5 and 8, A 6 and 9, A♭ 6 and 8, A♯ 6 and 10, B 7 and 11, B♭ 7 and
   10, and the two Cs 1 and 0, 8 and 12; "tritone" only for F♯ and G♭; B up to F 5 and 6, C up to E 3
   and 4 (FACTS 29).
2. **Inversion**: for every interval in test 1, the upside down's numbers add to 9 and its
   semitones to 12; major and minor swap, perfect stays, augmented and diminished swap; F♯ up to C
   is 5 letters and 6 semitones (FACTS 21 to 24).
3. **Signs**: Sharp offered on D, F, G and A only; Flat on D, E, G, A and B only; none on either C;
   the rule holds after the choice, so Sharp stays disabled with the top note on E or B and Flat on
   F (Toys 1).
4. **The sing-along**: D3, A3, D4 and D4, A4, D5 against `VOCAL_RANGES`: every note at least 2
   semitones inside every preset of its voice; do on C♯ or E♭ and the line an octave lower fail
   that check, so no Move do and no octave are offered (FACTS 52, 53).
5. **Sounds**: every fixed sound's frequency equals `hz(m)` for the notes of FACTS 66; the free play
   lasts 2.6 s and each split 3.3 s, a pair 1.55 s and two pairs 3.6 s, Step 4's play and the
   listening pair 3.0 s, Merc's line 7.0 s, the count-in 1.0 s and quick check 4's play 1.5 s
   (FACTS 66 to 73).
6. **The predict**: the free play plays before a choice and never reveals; the reveal waits for both
   splits heard with sound on, in either order; a split cut short reveals nothing and leaves the
   hint; the hints and the guess lines are LESSON.md's; the steps' Sharp, Flat, Fold and Curl and
   the plays of Steps 2, 3 and 4 are disabled until the choice and enabled after it, through
   `onChoice` (FACTS 1a, 44).
7. **The recall**: the questions are Lesson 6's own objects, `l06-q3` and `l06-q4`, imported, not
   copied; their links open `/learn/06#step-2` and `/learn/06#step-4`; `l06-q3`'s slot plays
   Lesson 6's pair; no text in either names six semitones, F♯, a tritone or the middle of the octave
   (FACTS 1a, 7, 68).
8. **The quick check**: ids `l23-q1` to `l23-q4`, three answers each, one right, LESSON.md's words;
   question 1's and question 3's questions and answers equal the plan's, which Lesson 27's and
   Lesson 24's recalls ask; no feedback line starts with "Right", "Yes" or "Correct" (FACTS 75 to
   78).
9. **Sing it's flow**, in Lesson 12's tests' form: the voice before anything plays; the guide after
   Merc's notes heard; no Move do; Effortful and Uncomfortable put the guide away; Effortful,
   Uncomfortable and Just listen today show the practice card's rest line, and the card keeps Leap
   after every ending; Play ti and fa plays after every ending (FACTS 56 to 58).

Page tests, against a local or dev build, never production:

10. The head test (`src/tests/lesson-pages.test.ts`): the title within 60 characters, the
    description 80 to 160 with "A fourteen-minute lesson", the chip "14 minutes" and `timeRequired`
    `PT14M` (`src/tests/lesson-pages.test.ts:155-159`, `src/tests/lesson-pages.test.ts:191-210`).
11. No planning text on the page: no topic code such as "T13", no "planned", "deep link" or "for the
    team" (`src/e2e/learn-no-planning-text.spec.ts:22-40`).
12. The stage-fit test at the four short landscape sizes, every step's controls on screen with the
    stage stuck (`src/e2e/learn-stage-fit.spec.ts:33-54`).
13. The first-paint budgets for `learn/23.html`.
14. The claims validator over LESSON.md and WEB-SPEC.md (`validateGuidedDynamicClaim`), 0 flagged
    lines, as Lessons 12 and 14 ran it (FACTS, Claims check).
15. **One sound at a time across sources**: the recall's pair stops a split, a split stops the pair,
    and a word's play, a toy move and Play ti and fa stop any of them (Audio).
16. **No background staff**: on `learn/23.html` the body's computed `background-image` holds no
    repeating gradient and the page has no `.mv-staff` (Look).
17. **The tour's hold**: on a first visit at the top, the welcome tour does not open before the
    predict's choice and opens after it; "Tour this page" opens it at once (Toys 3).
18. **Nothing answers the predict before the choice**: at first paint, with no choice made, the hero
    draws no lane and no note between the two Cs; the lesson menu's headings, the recall and the
    four words' text and figures name no F♯, no "six semitones" and no "tritone", and the recall no
    "7 semitones"; the steps' pitch line draws no black-key lane; Step 2's two plays, Step 3's two
    and Step 4's one are disabled, with Sharp, Flat, Fold and Curl into a ring; Step 1's "Play C up
    to E♭" plays and draws E♭'s lane and no other; after the choice all five plays work and the
    lanes are drawn (FACTS 1a).

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practice links that carry `?lesson=23` before any hash. Then the layout, accessibility, sound,
motion and storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text
children, touch targets of at least 44 px with no two tap zones overlapping (the staff's places are
reached by Step up and Step down as well as by taps, and the pitch line's lanes are drawn, never
tapped), visible focus, a single dark theme with every colour a token and an explicit body
background, sound only after a tap, localStorage only for per-viewer conveniences inside try/catch,
and the whole page usable with no sound, no WebGL and no storage (the predict and the guide then say
why they wait). Every ♯ and ♭ the page prints in text (the predict's F♯, the steps' E♭, F♯ and G♭,
every sign on the staff and in the readout, Sing it's C♯ and F♯) has a spoken name, the sign
`aria-hidden` and a visually hidden word after it (`signsHtml`,
`src/features/lessons/kit/notes.ts:221`); the figures' accessible names and every live region use
words only, and every note is spoken with its letter and octave. "Piano key" means a key of the
keyboard everywhere on the page, and a key such as D major is "in D", never "the key" (FACTS 18).
The page stores the quiz seeds and records (`fyp-l23-recall-seed`, `fyp-l23-recall-v1`,
`fyp-l23-seed`, `fyp-l23-quiz-v1`), `fyp-done` (`src/features/lessons/kit/progress.ts:12-15`),
`fyp-voice` (`src/features/lessons/kit/voice-choice.ts:20`), the masthead's Pause animations choice,
`fyp-motion` (`src/features/lessons/kit/motion-switch.ts:12`), the steps the viewer reached,
`fyp-pos` (`src/features/lessons/kit/position.ts:20`), and its record of the welcome tour,
`fyp-tour` (`src/features/lessons/kit/tour-gate.ts:29`); nothing from the toys or Sing it but the
voice. The predict's choice, the Clef switch, the pitch-line switch and the ring hold for the visit,
in memory.

The departures from ARTICLE-PLAN.md, each argued in FACTS and listed in LESSON.md's preamble: one
predict, the plan's two step predicts kept as Try and Notice lines (FACTS 46); the cold open's stage
drawing only the octave's two ends (40); the predict asking which note between the two Cs makes two
equal leaps, with the choices G and F♯, kept as a reasoning check on Lesson 6's facts (1a, 43), its
answering plays ending on two notes together (44); the recall asking Lesson 6's questions 3 and 4,
not 2 and 3 (7); Lesson 2's ruler as the pitch line beside the staff, curling into Lesson 2's ring,
in place of "Lesson 6's interval ruler" (39); Inversion in place of Tritone in the four words, its
figure a third (1a, 69); Step 4's heading and both Tavi lines (48); the sing-along in D with no Move
do and no octave below, and the listening pair ti below fa, closing inwards (52, 53, 57); no "lean
hardest" (31); the Go deeper drawers, with no word on a church ban (32 to 38); Leap alone on the
practice card (63); quick check 1's and 3's links and question 4's answers and its one sound (73, 75
to 78); the sound gate's plainer line (1a, 25); the steps' toy holding back its answering controls,
plays and black-key lanes until the choice (1a); and the teases, settled at the lead's review,
Lesson 22's planned line reworded and Lesson 24's new (5, 5b).

Page QA before publishing adds, for this page, every check against a local or dev build, never
production:

- Every play, toggle and button works by keyboard alone and announces what LESSON.md shows; the
  staff's places are reached by Step up and Step down and the arrow keys; a screen reader hears
  every note with its letter and octave, every ♯ and ♭ spoken, and each split and readout in words.
- At 390 x 844 every target is at least 44 px square and nothing scrolls sideways at 344, 360 and
  375 px; the staff, the pitch line and the readout fit `.viz.tall` without overlap, in both clefs.
- On a real phone, by ear and by eye (`docs/agent/DEVICE-DEBUGGING.md`): B2 and C3 audible on the
  speaker; two notes together heard as one chord, with no flam; Merc's line joined, with no click
  between do and so; each note lighting as it starts.
- The network panel and the browser's microphone indicator stay quiet through Sing it: no request,
  no microphone.
- The Wrap's practice card shows its rest line after "Effortful", "Uncomfortable" and "Just listen
  today", keeps Leap after every ending, and every link opens in a new tab.
- No faint staff shows behind the page at any width, and no section head carries one (Tests, 16).
- The app-check sweep at phone and desktop width, with Sing it open in each state, the steps' toy
  folded and curled, and the cold open before and after its reveal.
