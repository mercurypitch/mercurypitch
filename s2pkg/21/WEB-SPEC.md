# Lesson 21 web page: spec

The Lesson 21 page is the web lesson for "Keys and the circle of fifths": written steps, five toys
on the step deck's stage (Lesson 4's staircase, the staff with key signatures, the circle of fifths,
Find do and the circle's Pure · Equal walk), one predict, the four words, an unscored sing-along
that nothing listens to or scores, two quizzes (the recall and the quick check) and the lesson
explorer. Copy is in [LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is a
text-only package: no film exists for Lesson 21, so the page has no Watch section and the
masthead's anchors are Lesson, Sing it and Explorer.

It is built on the kit (`src/features/lessons/kit/`) as Season 2's kit PR leaves it (SEASON-2 § 8.2
item 1): the season structure, the staff toy with both clefs, the house on the staff and the lesson
plumbing. Like every lesson page it reuses and never copies: a part that lives in an earlier lesson's
module moves into the kit first. It reuses Lesson 2's ring of twelve beads (the spiral seen from the
top), Lesson 1's keyboard (`kit/key-strip.ts`), Lesson 4's staircase, which moves into the kit,
Lesson 15's staff toy, which gains key signatures here, and Lesson 15's sing-along with its comfort
check, voice choice, feelings and rest card (Lesson 15 WEB-SPEC, Toys 1 and 5). Where this page
shares a behaviour with Lesson 15's, it is Lesson 15's, unchanged unless this spec says otherwise.

One object carries the lesson: Lesson 2's ring of twelve beads, threaded by fifths. In the hero it
lights D major and its two black keys, then A major, a fifth up, played both ways; in Step 2 it
becomes the circle of fifths, and the house walks round it while the staff's key signature gains a
sharp at each step; in Step 3 the house walks the other way and the flats come in; in Step 5 the
thread is pulled taut, and twelve pure fifths run past the C they started from by 23.46 cents until
equal temperament closes the ring. It is the card's
signature: "Lesson 2's ring of twelve beads, re-threaded by fifths (C, G, D, A ...); the house walks
round it, and each step lights one more sharp in the signature beside it; the flats light the other
way" (FACTS 4).

Its public home is `mercurypitch.com/learn/21` (SEASON-2 § 7 item 1): a hand-written document
`learn/21.html` with its module in `src/features/lessons/lesson-21/`, wired as Lesson 15's page is.
It joins `kit/drafts.ts` in its first commit, held back on mercurypitch.com until the vocal coach has
looked at Sing it and the console publishes it, and it publishes only after `/learn/06` and
`/learn/15` are live, because its prerequisite chips and its recall link there and its recall asks
Lesson 15's own question (FACTS 2, 7). The next-lesson card on Lesson 20's page draws this lesson's
tease above its hook from the season data, and this page's card draws Lesson 22's; neither is
written into a page's markup (FACTS 5, 5b).

## Look

Lesson 15's look, unchanged: the dark listening room, the series colour code, Lesson 1's type and
wordmark, and the motion rules (Lesson 15 WEB-SPEC, Look). On this page:

- **Notation** is drawn on chrome lines `#c3ccd6`: staff lines, clefs, noteheads, sharps, flats
  and every key signature. As on Lesson 15's page, noteheads are chrome at rest and ink `#e6edf3`,
  lit, while their note sounds in the soft tone, as are the ring's beads and the keyboard's keys; in
  Sing it the notes light in the app's target amber `#f59e0b` while the voice sings them, and on the
  learner's turn the staff is plain chrome under a chrome sweep. Blue `#58a6ff` and orange `#ff7448`
  are Merc's and Tavi's own: their bubbles, and in Sing it the still of the one who sings (FACTS
  10).
- **The key's own black keys** carry their sign on the ring, the keyboard and the staff, in ink. A
  sign the step has just added (F♯ in Step 1, each new sharp or flat in Steps 2 and 3) is outlined
  for the length of its scale, never filled with a colour of its own.
- **The house** marks do on the ring, the circle, the staircase and the staff, as Lesson 4 marks
  home: with the house, never with a colour (`src/features/lessons/kit/home-glyph.ts:1-12`).
- **Gold** `#ffd84d` marks nothing: nothing on this page is a fit or a score (MASTER-PLAN § 5;
  playbook rule 11). Find do's right place shows the house and plays, and its line says so.
- **The gap** on Pure, in Step 5, is a short dashed arc in ink-2 `#a8b3bf` that runs on clockwise
  past C, from C to where the walk ends, labelled "23.46 cents": the walk overshoots, as it sounds
  (FACTS 31). On Equal the thread meets C and closes.
- **The pitch-line view** ("See it on the pitch line", on every staff toy and in free play, SEASON-2
  § 1.4 item 1) is Lesson 15's: the hero's pitch line beside the staff, each note a band at its
  height, in the app's amber; no violet, since no line of the learner's is drawn.
- **No decorative staves or clefs** anywhere on the page: on this page a staff is always music
  (SEASON-2 § 1.5 item 7 and § 6.1 item 8).

What moves: Merc and Tavi's idle loops; while something the learner started plays, the lit beads,
keys and notes, the ring's thread drawn bead to bead, the house walking round the circle, and a
signature's new sign fading in over 0.12 s as its scale ends. Under `prefers-reduced-motion`, or
with the masthead's Pause animations on, Merc and Tavi stop, the thread and the house jump to where
they end, and each sign appears at once; what the learner starts still sounds (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Season 1's departures kept: the step toys double as the
Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it (Step 3); the
practice card sits in the Wrap. No Watch section. The page opens in Lesson 2's order: the hook, the
stage, the sound gate and the cold open's predict, then the recall (FACTS 5a). Items 2 to 5 are the
hero, laid out as Lesson 15's: two columns above 1080 px, one column at 1080 px and below in the
order listed, with the promise after the predict. Each section's heading, and the line above it, are
in LESSON.md ("Section headings").

1. **Masthead**: Season 2's (What the kit and the app still need, item 1), "Season 2 · Lesson 21",
   with the lesson menu, which lists the five step headings from the first paint (FACTS 1a).
2. **The hook**: the kicker, the hook question as the title (`h1.hook#hook`), the meta as five chips
   (15 minutes, the two prerequisites by their full titles as links to `/learn/06` and `/learn/15`,
   Lesson 13 by its short name as a plain chip, Sound on), the promise (FACTS 2, 3).
3. **The stage**: Tavi's and Merc's bubbles over Merc and Tavi on the floor line, with Lesson 2's
   ring of twelve beads between them and Lesson 1's keyboard under it, D4 to A5, D major lit on both
   and its two black keys, F♯ and C♯, glowing (Toys 3).
4. **The sound gate**: LESSON.md's line and its button, between the stage and the predict at 1080 px
   and below.
5. **The cold open's predict**: the predict card, `#predict`, under the stage (Toys 5).
6. **Recall from Lessons 6 and 15**, `section#recall`, straight after the hero (Toys 8).
7. **Four words you'll meet**: key, key signature, circle of fifths and equal temperament, each with
   its definition, a play and a figure (Toys 6).
8. **The steps**: the kit's sticky stage and step deck ("N of 5", Previous and Next), every step on
   one stage: the staircase (Step 1), the circle with the staff (Steps 2 and 3), Find do (Step 4) and
   the circle's walk (Step 5) (Toys 1 to 4). No step has a Go deeper drawer (Length).
9. **Sing it**, `#sing`: the comfort check, the voice choice, Merc's two runs, the guide and the
   feeling question (Toys 7).
10. **Quick check**: LESSON.md's four questions (Toys 8).
11. **Wrap**: the three recap lines, the challenge, the practice card in the version Sing it's ending
    picks, the Playground's free play, and the next-lesson card with its tease and still (Toys 9).
12. **Lesson explorer**: the kit's, with Lesson 21 as the current node, on Season 2's tab (Explorer
    and season data).
13. **Footer**: Lesson 15's, with "Season 2 · Lesson 21 · Keys and the circle of fifths", the two
    practice links and "Compose and Ear Lab are free.", Lesson 1's fonts line, and "Every sound on
    this page is synthesised in your browser."

## Length

The learner copy is 2,139 words on `scripts/lesson-words.mjs`, every branch counted, under the
series' cap of 2,379 by 240 (FACTS 3). The page runs about 15 minutes: 8.99 minutes of reading at
238 words a minute and about 6.4 of sound, toys and tasks. That is past MASTER-PLAN § 4.2's budget,
"8 to 12 minutes of active time, 500 to 900 words", as every Season 1 page from Lesson 3 is. The
chip's figure is an estimate until the staff toy and the circle are timed in their labs, as SEASON-2
§ 1.3 asks; the chip is then set from the lab. Each step's own text, with its Try, its Notice and
any Tavi line, runs 110 to 120 words (Steps 1 to 5: 116, 111, 115, 120 and 110), inside § 4.2's 50
to 120 a step. Two parts carry more beside it:

- **Step 3, 193 words with its mix-up card**, which sits in the step whose toy refutes it.
- **Sing it, 323 words.** It carries the series' singing lines, Lesson 15's word for word and not
  cut.

**The built page.** The hints and status lines are stage directions in LESSON.md and are not
counted, as in the text packages of Lessons 9 to 14. A built page writes them in the open and counts
them, and on this page they come to about 175 words, counted from LESSON.md's stage directions and
this spec's toys: the predict's hints, about 25; Find do's lines with Next round and Again, about
77; the two figure captions, 21; Spell it's two lines, 11; Sing it's "Play Merc's notes first" and
its stored-voice line, 13; the toys' labels, about 30. That is within Lesson 8's measured 174 to 206
(Lesson 8 FACTS 4). The built page then lands at about 2,314 words, some 65 under the cap. To make
that room, the review cut Step 2's Go deeper drawer (its item stays in FACTS 27), Step 2's last
line, which Step 4 says again, and Step 3's F major spelled out, which the mix-up card and the toy
show (FACTS 3). **Step 5 stays in the page**: it still fits. If the built page's hints run longer
than counted here, the next cut is the reveal's last sentence, on why D♯ was a fair guess (16
words).

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                       | New in Lesson 21                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. The staircase          | Lesson 4's staircase and its White keys only (`lesson-04/stairs-toy.ts`), moved into the kit; the kit's scales (`kit/major-scale.ts`); Lesson 1's keyboard strip (`kit/key-strip.ts`)                        | Starts on G2 or G4 by the learner's clef; the staff beside it, written as the scale plays; the F♯'s sharp moving into the key signature, which White keys only drops                                                  |
| 2. The staff              | Season 2's staff toy (Lesson 15 WEB-SPEC, Toys 1), both clefs, the house on the staff, the pitch-line switch                                                                                                 | Key signatures at each clef's places (FACTS 21); notes spelled by the key; a signature that grows a sign at a time; Spell it: A♯ · B♭                                                                                 |
| 3. The circle             | Lesson 2's ring, the spiral seen from the top (`setView('top')`, `src/features/lessons/kit/spiral.ts:28-32`); the house (`kit/home-glyph.ts`)                                                                | The ring threaded by fifths, the twelve keys' names round it, the house within three sharps and three flats, Step round · Step back, Pure · Equal and the gap past C: the circle-of-fifths toy, SEASON-2 § 6.2 item 4 |
| 4. Find do                | The staff toy (2) and the house                                                                                                                                                                              | Six rounds, the eleven places to tap, the feedback lines                                                                                                                                                              |
| 5. Predict widget         | The kit's predict (`kit/predict.ts`), with a free play and `revealAfter: 'all'`, as Lesson 4's step 3 predict                                                                                                | A small staircase under each A major play                                                                                                                                                                             |
| 6. Four words             | The kit's words strip (`kit/words-strip.ts`)                                                                                                                                                                 | Four figures: a small ring, a staff with G major's sharp, a small circle, a row of semitones                                                                                                                          |
| 7. Sing it                | Lesson 15's sing-along, from Lesson 12's flow (`lesson-12/sing-flow.ts`): the comfort check, voice choice, feelings and rest card (`kit/comfort.ts`, `kit/voice-choice.ts`); the count-in (`kit/move-do.ts`) | Two runs with the key changing between them; a second count-in on the new so                                                                                                                                          |
| 8. Recall and quick check | The kit's quiz (`kit/quiz.ts`); Lesson 6's question object `l06-q2`, imported; Lesson 15's `l15-q2` and its slot, imported                                                                                   | Nothing                                                                                                                                                                                                               |
| 9. Tease still            | The kit's next-lesson card and its slot (`kit/next-card.ts`)                                                                                                                                                 | Lesson 5's band with a pitch line waving across both its edges                                                                                                                                                        |

### 1. The staircase (Step 1)

Lesson 4's staircase, moved into the kit with its White keys only overlay and its keyboard strip, so
Lesson 4's page and this one import the same module (What the kit and the app still need, item 5).
On this page it starts on G, in the learner's clef's octave: G2 for the lower voice, G4 for the
higher (FACTS 63), where Lesson 4's slider runs C4 to B4. Its slider and Start lower and Start
higher are hidden here: the step is about G.

- **Play**: plays the scale from G at 0.4 s a note, each stair and key lighting as it sounds.
- **White keys only**: a switch, off at first. On, the scale plays the white keys from G, G A B C D
  E F G, and the staircase draws their steps, the sixth short and the seventh tall, the wrong way
  round (FACTS 13); the seventh stair is outlined. Off, it plays G major with F♯.
- **The staff beside it**, in the learner's clef, writes each note as it sounds. With White keys
  only off, G major's F♯ is written with its own sharp before it as it plays; at the end of that play
  the sharp slides to the start of the staff, after the clef, into G major's key signature, on its
  clef's F line (FACTS 21), and the note keeps no sign. With White keys only on, the staff drops the
  key signature and writes the white keys plain, G A B C D E F G, with no sign on F: under a
  signature that F would need a natural sign, which this page does not teach. Switched off again,
  the next G major play writes F♯ with its own sharp, and the sharp moves into the signature as the
  scale ends, as it did the first time, so the sound still comes before the symbol. A caption under
  the staff: "Fig. 1 G major: one sharp, F♯, its ti."
- **Labels**: each stair says its syllable and name on focus ("Stair 7, ti, F sharp 3"), as Lesson
  4's do. The syllables show from the first paint, as Step 1's text and caption name ti: the welcome
  tour's hold, not the stairs, keeps a first visit from meeting them before the choice (FACTS 1a).
- **See it on the pitch line**: on the staff, as in Lesson 15.

### 2. The staff with key signatures

Lesson 15's staff toy (its engraving, places, taps, keys, live region and pitch-line switch), with
what this page adds. Its clef follows the stored voice, the lower when none is stored, and the voice
choice in Sing it sets it for the visit; a Clef switch shows the other (FACTS 10).

- **The key signature.** Drawn after the clef, before any note, its signs at the places FACTS 21
  gives: in the treble clef F♯ on the top line, C♯ in the third space, G♯ in the space above the
  staff, B♭ on the middle line, E♭ in the top space, A♭ in the second space; in the bass clef each a
  line lower (F♯ on the fourth line, C♯ in the second space, G♯ in the top space, B♭ on the second
  line, E♭ in the third space, A♭ in the bottom space). Signs are spaced as the notation library the
  app uses spaces them, left to right in the order of sharps or flats. The staff's live region names
  the signature when it changes: "Key signature: two sharps, F sharp and C sharp".
- **Spelling.** A note is spelled as its key spells it, one letter per degree (`majorScale`,
  `src/features/lessons/kit/major-scale.ts:43-45`): F♯ in G major, B♭ in F major. A note the
  signature covers carries no sign of its own.
- **Growing a signature.** In Step 2 each scale plays first and the signature gains its new sign as
  the scale ends, so the sound comes before the symbol (SEASON-2 § 1.4 item 1); in Step 3 the same
  with flats.
- **Spell it: A♯ · B♭** (Step 3 only): a two-way switch on F major's fourth note. On A♯ the staff
  writes F, G, A, A♯, C, D, E, F, two notes on A's space and none on B's line, both outlined; on B♭
  it writes F major with its one-flat signature. Both play the same sounds. The live region says
  "Two notes on A, none on B" or "One note on every letter".
- **Range**: the scales on this page stay inside Lesson 15's two ledger lines each way: in the bass
  clef from F2 to E♭4, in the treble from B♭3 to A5 (FACTS 63, 64).

### 3. The circle

Lesson 2's ring, seen from the top as Lesson 2's page draws it, grown into the circle-of-fifths toy
SEASON-2 § 6.2 item 4 asks for (What the kit and the app still need, item 4).

- **The hero's ring.** Twelve beads, a bead a semitone, with Lesson 1's keyboard under it from D4 to
  A5. D major's seven beads and keys are lit, its two black keys, F♯ and C♯, glowing. As a scale
  plays, each note lights its bead and key, and a thread joins each bead to the one before. No names
  of degrees, no staff (FACTS 33).
- **Threaded by fifths** (Step 2 on): the beads move round the ring until each sits a fifth from its
  neighbours, C at the top, G one place clockwise, F one place anticlockwise; each bead takes its
  key's name, and the bottom three take two names each, B and C♭, F♯ and G♭, C♯ and D♭ (FACTS 23,
  24). A bead's key signature shows beside the circle, in the learner's clef, when the house is on
  it.
- **The house** sits on C at first. **Step round** moves it a fifth clockwise and plays the new
  key's scale, a note every 0.3 s, on the staff beside the circle, which then gains the new sharp;
  **Step back** moves it a fifth anticlockwise. The house moves only within three sharps and three
  flats, the page's reading (SEASON-2 § 7 item 13; FACTS 25), and each step has its own part of
  that: in Step 2 from C round to A, the sharp side, where Step round stops at A and Step back at C;
  in Step 3 from C round to E♭, the flat side, where Step back stops at E♭ and Step round at C; in
  free play in the Wrap, anywhere from E♭ round to A. A bead in the step's part is a button that
  moves the house there and plays its scale. At a stop, Step round or Step back is marked
  `aria-disabled`, as Move do's buttons are at their ends (`setMoveEnds`,
  `src/features/lessons/kit/move-do.ts:52-63`).
- **Beads past three sharps or flats**: E, B or C♭, F♯ or G♭, C♯ or D♭, and A♭. They are drawn and
  named, dimmed, and take no tap: the house never goes there, nothing plays, and no signature
  shows beside the circle for them, since the page reads no signature past three. The bottom three
  carry both names, the sharp name above the flat. The circle still shows all twelve (FACTS 23).
- **Pure · Equal** (Step 5): a two-way switch and **Play the walk**. The walk starts on C4 and plays
  the twelve fifths up, each folded into the octave from C4, 0.45 s a note, the thread drawn bead to
  bead round the circle, the last C held 1.0 s, then after 0.2 s the starting C again (FACTS 31,
  63). On Equal the thread meets C and closes; on Pure it runs on clockwise past C by the gap, drawn
  and labelled "23.46 cents", and the last C sounds a little high against the first. A caption:
  "Fig. 5 Twelve pure fifths overshoot by 23.46 cents; equal ones close the ring."
- **Accessibility**: the circle is a `role="group"` named "Circle of fifths"; each bead in the
  step's part is a button of at least 44 px on a phone, named "G major, one sharp", that plays its
  scale and moves the house there; Left and Right arrows step back and round, within the same part.
  The beads past three sharps or flats are not buttons; the group's description names them: "Also on
  the circle: E major, B or C flat major, F sharp or G flat major, C sharp or D flat major, and A
  flat major." The walk's beads are announced only at its end: "The walk ended 23.46 cents above C"
  on Pure, "The walk ended on C" on Equal.

### 4. Find do (Step 4)

The staff toy in the learner's clef with a key signature and no notes, and the house to place, in six
rounds in a fixed order: G, D and A major, then F, B♭ and E♭ major (FACTS 26).

- **A tap** on any of the staff's eleven places, its nine lines and spaces and the space just above
  and below, puts the house there and plays that place's note, 0.8 s, with the signature applied.
  Step up and Step down move the house a place, and Enter plays it, for the keyboard.
- **Right**: a place with do's letter, in either octave. The line reads, for the sharp keys, "Do is
  G. The last sharp, F♯, is ti.", "Do is D. The last sharp, C♯, is ti." and "Do is A. The last
  sharp, G♯, is ti."; for F, "One flat: F major."; for the other flat keys, "Do is B♭: the
  second-to-last flat." and "Do is E♭: the second-to-last flat."; then do, mi, so play from the house
  (FACTS 63), and Next round appears.
- **Not yet**: any other place names its note and gives the rule: for sharps, "That's A. Look at the
  last sharp: do sits a semitone above it."; for flats, "That's C. Look at the second-to-last flat."
  (F's round: "That's C. One flat means F major."). The next tap tries again. Nothing is counted.
- **After the sixth**: "All six found." and Again, which starts at G again.

### 5. Predict widget

The kit's predict (`src/features/lessons/kit/predict.ts:1-17`), mounted on the predict card, as
Lesson 4's step 3 predict compares two plays (FACTS 36).

- **Play D major** is `data-free`: it works before a choice and never reveals.
- **Play A with D♯** and **Play A with G♯** unlock with the choice; `revealOn` names both and
  `revealAfter` is `'all'`, so the reveal waits until both have been heard to their end. Each draws a
  small staircase under its own button as it plays, a stair a note, its steps' sizes drawn: with D♯
  they run tone, tone, tone, semitone, tone, semitone, tone; with G♯ they are Lesson 4's (FACTS 37).
- **Hints**: `chosen` "Locked in. Play A major both ways.", which stays until the reveal; `silent`
  "Sound is off: nothing played. Turn sound on, then play it again."; `again` "Play any of them
  again."; and the guess line "You said: D♯" or "You said: G♯". No `next`: the kit shows it after any
  heard play that does not reveal, the free Play D major included, so "Now play the other one."
  would ask for the other one before either A major had played, as the review found; Lesson 19's
  page made the same cut (FACTS 36).
- **The tour**: the page calls `holdTour` with the choice's promise, so a first visit's welcome tour
  opens only after the choice (`src/features/lessons/kit/tour-gate.ts:57-69`; FACTS 1a).

### 6. Four words

The kit's words strip, each word with its play and figure, lit as its sound plays: **Key**, G major
from G3 on a small ring; **Key signature**, G major in the learner's clef on a small staff, F♯ lit and
written once in the signature; **Circle of fifths**, C3, G3, D4 and A4, the house stepping round a
small circle of four named beads, no sharp named; **Equal temperament**, C4 up to C5 in semitones, a
row of thirteen equal tiles lighting in turn (FACTS 62).

### 7. Sing it

Lesson 15's flow, with two runs in place of one (Lesson 15 WEB-SPEC, Toys 5).

1. **Comfort check**, asked every visit: Lesson 3's line, list and buttons (FACTS 48).
2. **Voice choice**, after either answer when none is stored, and shown pressed when one is:
   Lesson 3's buttons, read from and stored in `fyp-voice`. It sets the voice that sings and the
   staff that shows, for the rest of the visit (FACTS 50).
3. **Just listen today**: LESSON.md's line with the doctor lines; **Play Merc's notes** plays the two
   runs in the chosen voice; the guide is put away (FACTS 49).
4. **Ready**: the staff in the learner's clef, the house on C. **Play Merc's notes** plays so, la,
   ti, do in C (G3 A3 B3 C4, or Tavi's G4 A4 B4 C5), each note lighting as it sounds; in the 2.0 s
   after it the signature gains F♯ and the house moves to G; then so, la, ti, do in G (D3 E3 F♯3 G3,
   or D4 E4 F♯4 G4). 12.8 s in all, Merc's "ooh" (FACTS 56, 64).
5. **Guide**: enabled once Merc's notes have been heard with sound on, with the hint "Play Merc's
   notes first" until then. A count-in on so (`countIn`, which plays the note it is given,
   `src/features/lessons/kit/move-do.ts:69-70`), then a line sweeps along the four notes in C with
   no voice; the signature and the house change as in Merc's; a second count-in on the new so in the
   last second of the gap; then the line sweeps along the four notes in G. 13.8 s in all.
6. **How did that feel?**, after each guide that runs to its end: Lesson 3's four answers through
   `mountFeelings`; Easy or Workable shows LESSON.md's line and Again, once a visit; Effortful and
   Uncomfortable put the guide away for the visit, with the rest ending (`afterFeeling` with
   `restAfterEffort`, `src/features/lessons/kit/comfort.ts:51-87`) and their lines (FACTS 57, 58).

### 8. Recall and quick check

Two quizzes share this page through the kit's quiz, each with its own prefix and keys, as on Lesson
15's page.

- **Recall**: Lesson 6's question object `l06-q2` and Lesson 15's `l15-q2`, imported, never copied,
  under their ids, with `away: { href: recallStepHref }`, so "Try Step 5 again" and "Try Step 2 again"
  read "Try Lesson 6, Step 5 again" and "Try Lesson 15, Step 2 again" and open that lesson's page at
  the step in a new tab (`recallStepHref`, `src/features/lessons/kit/quiz.ts:141-143`; FACTS 7).
  Lesson 15's question keeps its slot, "Play the three notes", E4, F4 and G4 on a small treble staff,
  which takes this page's sound owner.
- **Quick check**: LESSON.md's four questions, ids `l21-q1` to `l21-q4`, keys `fyp-l21-seed` and
  `fyp-l21-quiz-v1`, and `lesson: 21`, so answering all four marks Lesson 21 done. Three answers
  each, shuffled per question from the stored seed, one-line feedback for every answer; the kit
  prints "Right." or "Not quite." before each line (`quiz.ts:315`).

### 9. Tease still

The kit's next-lesson card, drawn from the season and its lesson copy: Lesson 22's title, its hook,
and one line above the hook, its tease (FACTS 5). In the card's slot, a still: Lesson 5's band, with
a pitch line waving across both its edges and no centre line drawn. It plays nothing, and the card
stays one link. Until Lesson 22's page is live the card says "Coming later" and "See it on the map".

## Audio

Every sound is synthesised by the kit at its exact equal-tempered frequency (`hz`,
`src/features/lessons/kit/notes.ts:42-43`), A4 = 440 Hz, except Step 5's pure walk, whose notes are
the twelve pure fifths folded into one octave from C4 (FACTS 31): 261.63, 392.44, 294.33, 441.49,
331.12, 496.68, 372.51, 279.38, 419.07, 314.31, 471.46, 353.59 and 265.19 Hz. Nothing plays before a
play button is pressed (the sound gate).

- **The soft tone** plays every scale, the four words, Find do and the walk; **Merc's "ooh"** sings
  Sing it's runs, Tavi's an octave higher; the count-ins are the kit's, at half a tapped note's level
  (`COUNT_IN`, `src/features/lessons/kit/move-do.ts:65-66`).
- **Timings** (FACTS 61 to 64): a scale a note every 0.4 s, each note 0.35 s long, 3.15 s, as the
  hero's three plays are (D major from D4, A major from A4 both ways); Step 2's scales a note every
  0.3 s, each 0.27 s long, 2.37 s; the semitones word, thirteen notes 0.3 s apart, each 0.25 s long,
  3.85 s; F major spelled both ways, 6.8 s; Find do's answer, 2.7 s; the walk, 7.6 s; Merc's two
  runs, 12.8 s; the guide, 13.8 s.
- **One sound at a time**: every source on the page takes the kit's now-playing owner, so a new play
  stops the one before with its own stop (`src/features/lessons/kit/now-playing.ts:1-15`).
- **The predict's plays** report whether they were heard to their end, so a play cut short or kept
  silent by sound off reveals nothing (FACTS 36).

## Merc and Tavi

Merc speaks once, in the hero: "A is a fifth above D. A major keeps D's F♯ and C♯, and it needs one
sharp more." Tavi speaks twice, each time a sincere guess or question (MERC-BIBLE): in the hero,
"F♯, then C♯. Isn't the new sharp D♯, the letter after C?", and in Step 3, "A♯ and B♭ are one piano
key. Can't F major use A♯?", which the step shows half right. In Sing it, Merc sings the lower
voice's runs and Tavi the higher's. Their idle loops follow Lesson 15's; neither has a line after
the hero but Tavi's in Step 3.

## Practice links: what exists and what needs engineering

**Today:**

- **Compose, in Sheet Music** (`/?lesson=21#/compose`, printed mercurypitch.com/#/compose): the
  practice card's first drill. On a first visit Compose holds a C major scale; Playback Setup's key
  picker moves the tune into each key, and Sheet Music, or Split, writes it with its key signature
  (FACTS 39 to 42). On a narrow screen Compose asks to be turned sideways (FACTS 43).
- **Ear Lab's Home** (`/ear-lab?lesson=21`, printed mercurypitch.com/ear-lab, then tap Home): a
  cadence sets a key, one note sounds, and the learner taps its degree, do to ti; the key is chosen
  afresh each round (FACTS 44).

**Not linked:** the Singing tab, whose key picker changes only the view and which has no sheet view
on a phone held upright (FACTS 41), though SEASON-2 § 5.1's row names it; Sight-Singing, which writes
every black key as a sharp (FACTS 45).

**Waiting for:** the note-reading drill reading key signatures (SEASON-2 § 5.2 item 9), key-aware
Sight-Singing (item 10d), and all twelve keys with flat names in the key picker, with an address for
the sheet view (item 20). When the first of these ships, the practice card names it (FACTS 45).

## Explorer and season data

Lesson 21's entry, proposed for Season 2's data, which goes in its own module that a Season 1 page
does not load (SEASON-2 § 6.2 item 1), in Season 1's entry form (Lesson 8's,
`src/features/lessons/kit/season.ts:303-324`):

- `n: 21`, `lane: 'theory'`, `title: 'Keys and the circle of fifths'`, `short: 'Circle of fifths'`,
  `topics: ['T17', 'T18', 'T29']`, with their names as SEASON-2 § 4.1 gives them, "Keys, key
  signatures, transposition", "Circle of fifths" and "Tuning systems: why twelve, equal temperament"
  (`docs/plans/find-your-pitch/SEASON-2.md:724-726`); the hook word for word (FACTS 1). `minutes: 15`
  and `page: '/learn/21'` once the page is built, under the drafts' comment in Lesson 15's form: `//
A draft until the vocal coach's look at Sing it (drafts.ts).` The entry decides nothing about
  being live: the draft list and the console do. The short name is the lead's: "Keys" alone could
  be read as a keyboard's keys.
- `pr.link`: `href` `/?lesson=21#/compose`, `addr` `mercurypitch.com/#/compose`, `label` "Compose"
  and `note` "then choose Sheet Music", which the explorer's card prints after the address as
  "Compose, then choose Sheet Music" (`practiseMarkup`, `src/features/lessons/kit/explorer.ts:177-181`).
  Ear Lab's Home is the page card's second drill only, as Lesson 8's entry links one of its two.
  `pr.needs`, "A note-reading drill that reads key signatures, and Sight-Singing that spells by
  key", stays until one ships; it is "Admin only, never drawn on a lesson page"
  (`src/features/lessons/kit/season.ts:102-103`).
- `EDGES` gains [6, 21] and [15, 21], as SEASON-2 § 4.3 gives them (FACTS 2); Lesson 21's
  prerequisite list is then [6, 15].
- The tease on this page's next-lesson card is Lesson 22's, set on Lesson 22 in the lesson copy:
  settled, `tease` "Merc holds one note, and its line swings past both edges of the band.", with
  the plan's line cut to fit as a variant, `teaseAlts` `[{ id: 'nudged', text: 'Each fifth is
nudged two cents. A held note can move far more.' }]`, and its note in the team's notes (FACTS 5).
  This lesson's own, set on Lesson 21 and drawn on Lesson 20's card: settled, `tease` "D major:
  seven notes, two black keys, F♯ and C♯. Now step up a fifth.", with `teaseAlts` `[{ id:
'lesson-4', text: 'Lesson 4 slid the scale to G, with one sharp, and to D, with two.' }]` and its
  note (FACTS 5b). Both pairs were settled at the lead's review on 1 November 2026, as the owner asked.
  Each is at most `TEASE_MAX`, 70 characters (`src/features/lessons/kit/lesson-copy.ts:76`).
- The signature line for the admin console, from the card (FACTS 4): "Lesson 2's ring of twelve
  beads, threaded by fifths; the house walks round it and each step adds a sharp to the signature
  beside it, the flats the other way; then twelve pure fifths miss by 23.46 cents, and equal
  temperament closes the ring." It goes in the team's notes, which no lesson page loads.
- No `fig`: the card shows no figure, as Lesson 14's does (`cardFigure`,
  `src/features/lessons/kit/explorer-figures.ts:188-194`). The explorer opens on Season 2's tab, and
  its card reads "Ready · read" with "15 min" once the page is live.

## What the kit and the app still need

Found in the kit and the app as they stand on main at `c60f0fdcb`. Every item is proposed.

1. **Seasons in the kit** (SEASON-2 § 6.2 item 1): Season 2's data in its own module, the explorer's
   tab per season, the masthead's "Season 2 · Lesson 21", and `TOPICS` gaining T17, T18 and T29
   (`src/features/lessons/kit/season.ts:50`).
2. **The head, the structured data and llms.txt** (SEARCH § 3.1 and § 12), each checked against the
   predict (FACTS 1a):
   - the title "Key signatures and the circle of fifths | MercuryPitch", 54 characters, in
     searchers' words;
   - the description, the hook and "A 15-minute lesson on keys and the circle of fifths.", 151
     characters; `og:title` "Keys and the circle of fifths · Find Your Pitch, Lesson 21"; the share
     descriptions, the hook and "Hear each scale, then see it written.";
   - the share card, `learn/lesson-21-og.jpg`, 1200 by 630: Lesson 2's ring with D major's seven
     notes lit and its two black keys glowing, between Merc and Tavi, with no A major anywhere on it,
     and its alt text "Lesson 2's ring of twelve beads, lit with D major's seven notes and its two
     black keys, F sharp and C sharp, between Merc and Tavi.";
   - the two structured-data blocks from Lesson 1's, with `timeRequired` `PT15M` and `teaches`
     "Building a major scale on any note", "Key signatures of up to three sharps or flats", "The
     circle of fifths" and "Why twelve notes: equal temperament";
   - on release, the llms.txt line, in Season 1's form: "[Lesson 21: Keys and the circle of
     fifths](https://mercurypitch.com/learn/21): Why each key a fifth up keeps its sharps and adds
     one. Building a major scale on any note, reading key signatures of up to three sharps or
     flats, the circle of fifths, and why twelve fifths close it."
     None of them names a sharp of A major or says ti.
3. **The lesson host and the draft line**: `learn/21.html` at `/learn/21`, with its entries beside
   Lesson 15's, as Lesson 15's spec sets them out (Lesson 15 WEB-SPEC, What the kit and the app still
   need, items 1 and 2), and the draft line `21: "the vocal coach's look at Sing it (MASTER-PLAN §
12 item 8)"`.
4. **Key signatures on the staff toy** (SEASON-2 § 6.2 item 2, extended): the staff toy as Lesson
   15's spec builds it draws no key signature, so it gains one, at each clef's places (FACTS 21), the
   sharp and flat glyphs it already holds, spelling by key, a signature that grows a sign as a scale
   ends and drops away under White keys only, and Spell it (Toys 1 and 2). It needs no natural sign.
   Any later page that writes a key reuses it.
5. **The circle-of-fifths toy** (SEASON-2 § 6.2 item 4): grown from the spiral's top view, with the
   ring threaded by fifths, the twelve key names with the bottom three's two names, the house and
   Step round · Step back within each step's part of three sharps and three flats, the beads past
   that range drawn and named but not buttons, the signature beside it, and Pure · Equal with the gap
   drawn past C (Toys 3). The pure walk needs a note at an exact frequency, which the kit's voice
   already takes.
6. **Lesson 4's staircase into the kit**, with its White keys only and its strip, and a start
   outside Lesson 4's C4 to B4 (G2 and G4 here); Lesson 4's page then imports it from there
   (`src/features/lessons/lesson-04/stairs-toy.ts:1-16`).
7. **This page's own parts**, new in `src/features/lessons/lesson-21/`: Find do on the staff toy,
   its six rounds, eleven places and lines (Toys 4); the small staircase under each of the predict's
   A major plays (Toys 5); and the four words' figures, a small ring, a staff with G major's sharp, a
   small circle of four beads and a row of thirteen tiles (Toys 6).
8. **Two runs in the sing-along**: Lesson 15's flow takes a line of any length in two parts with a
   key change and a second count-in between them (Toys 7). The count-in already plays any note.
9. **No decorative staff** (Look), as Lesson 15's spec sets it out: no `.mv-staff` on the section
   heads, no engraved clefs, and no background staff (Lesson 15 WEB-SPEC, What the kit and the app
   still need, item 7).
10. **Lesson 15's quiz objects**: the recall imports `l15-q2` and its slot, which exist only once
    Lesson 15's page is built, so this page is built after it (FACTS 7).
11. **The lesson plumbing** (SEASON-2 § 5.2 item 21): the marker's reach to 21, the lesson-answer
    bounds, the admin console's row and the released list, so `?lesson=21` reads as a lesson's link
    and the page's answers are kept (FACTS 46).
12. **For the lead, SEASON-2 § 5.1's row for Lesson 21** names the Singing tab's key picker and sheet
    view; the package links Compose instead, since the Singing tab's picker changes only the view
    (FACTS 41, 42). The row's "Needs building" list stands. And § 3's card for Lesson 21 still gives
    the checkpoint as do re mi fa so in C, then in G, where the lead decided on so, la, ti, do (FACTS
    54).

## Decisions for the owner

1. **The two teases** (FACTS 5, 5b): settled at the lead's review on 1 November 2026, as the owner asked, each with an
   alternative the console can switch to later.

The short name on the map, "Circle of fifths", is the lead's. The sing-along's key and notes, and its
line for a second run that starts low, are the vocal coach's to confirm before publishing (LESSON.md,
For the vocal coach), not the owner's.

## Edge cases

- **Sound off**: every play is silent and says so in its hint; the predict reveals nothing until a
  play is heard (FACTS 36); Find do's taps still move the house and show its line.
- **A play cut short** by another play or Stop: it reveals nothing and releases the owner.
- **Play D major again after the choice**: the locked-in hint stays, since the page sets no `next`
  hint (Toys 5).
- **No stored voice**: the steps' staff shows the bass clef until Sing it's choice, which then sets
  the clef for the visit (FACTS 10). **No storage** (a private window): the quiz seeds and the voice
  last for the visit; nothing breaks.
- **A phone at 344 px**: the circle's twelve beads keep 44 px targets by drawing the names outside
  the ring; Find do's places, 13 px apart on a phone (Lesson 15 FACTS 71), are reached by Step up and
  Step down as well as by tap (Toys 4).
- **A tap on a bead past three sharps or flats**: nothing happens; it is not a button (Toys 3).
- **Lessons 6 and 15 not live**: the recall links keep their words and do not link, as the kit's
  quiz does for a lesson that is not live (`linkAway`, `src/features/lessons/kit/quiz.ts:186-216`);
  the page publishes only after both are live.
- **Compose hidden**: in the app's simple mode, or set to guitar, Compose is not a tab, and the link
  lands on Home (Lesson 15 FACTS 46). **Compose on a later visit** opens on the last melody open, not
  the C major scale, and the card says "on a first visit" (FACTS 39). **Compose's clef** changes as
  the tune moves between keys (FACTS 42). **Playback Setup turned off** in Settings: the panel, and
  with it the card's key picker, is not in the sidebar until the learner turns it back on (FACTS 40).
- **Before the plumbing**: `?lesson=21` is an ordinary visit, so First Light opens on a first visit
  and a returning visitor may meet the app's takeover over Compose (Lesson 15 FACTS 48), and the
  page's answers are refused (Lesson 15 FACTS 47); the page is built only after § 5.2 item 21
  (FACTS 46).
- **Home in microphone mode**: Home opens in the mode last chosen, so a learner who switched it to
  the microphone before finds it so, and can switch back to taps (FACTS 44).
- **Reduced motion**: Look's rules; the thread and the house jump, and every sound still plays.

## Tests

1. **Scales and signs**: for all twelve starts, the kit's major scale is spelled one letter per
   degree; the white keys from G and F give the steps of FACTS 13; each key a fifth up adds its ti,
   each a fifth down its fa; the orders of sharps and flats (FACTS 12, 13, 16 to 19). With White keys
   only on, Step 1's staff shows no key signature and no sign on F; switched off, the next G major
   play writes F♯ with its sharp and moves it into the signature as the scale ends.
2. **Signature places**: for one to three sharps and flats in each clef, the signs sit at FACTS 21's
   places, and the bass clef's are one line lower than the treble's.
3. **The predict**: Play D major works before a choice and never reveals; choose, play D major again,
   and the hint is still "Locked in. Play A major both ways."; the reveal waits for both A major
   plays; a play cut short or silent reveals nothing; the tour waits for the choice.
4. **The circle**: twelve fifths from C visit every bead once; the pure walk's thirteen frequencies
   equal FACTS 31's to 0.01 Hz and end 23.46 cents above C4; on Pure the gap is drawn past C,
   clockwise, and on Equal the thread closes on C; the house moves from C to A and no further in
   Step 2, from C to E♭ in Step 3, and from E♭ to A in free play; the five beads past three sharps
   or flats are not buttons, and no signature shows for them.
5. **Find do**: each round's right places (FACTS 26) and its lines; every other place gives its
   note's name and the rule; six rounds, then "All six found."
6. **Sing it**: every branch of Toys 7, the count-in on so before each run, Again at most once a
   visit, the rest card after Effortful, Uncomfortable and Just listen today.
7. **The words**: LESSON.md's lines word for word in the page's modules; the recall's questions are
   Lesson 6's and Lesson 15's objects, by id; no feedback line starts with "Right", "Yes" or
   "Correct".
8. **No leak**: a page test holds that none of G♯, "ti" and "just below do" appears in the head, the
   share card's alt, the structured data, the title, the promise, the sound gate, the lesson menu's
   card and list, the step and section headings, the recall or the four words. The predict's own
   choices and its two locked plays, which name D♯ and G♯ alike, are exempt; so are the steps'
   stages, which the tour holds until the choice.
9. **The season**: the entry, the edges, both teases and their alternatives at most 70 characters,
   each variant with its team note.
10. **Stage fit**: every step's stage at 390 by 844 and 1440 by 900, in both clefs, as the kit's
    stage-fit test checks Season 1's pages.

## Contract

- The copy is LESSON.md's, word for word, and every claim on the page is in FACTS.md.
- Sound comes before every symbol: each scale plays and lights before its key signature is written,
  and every staff example plays.
- Every scale is spelled one letter per degree; every key signature sits at its clef's places
  (FACTS 21); reading stops at three sharps and three flats, the house moves only within them, and
  the circle shows all twelve; no natural sign is drawn.
- Nothing a learner meets before the choice, outside the predict's own choices and locked plays,
  names A major's new sharp or says ti; the steps' stages wait behind the tour's hold.
- Gold marks nothing; the house marks do; no decorative staff or clef.
- Sing it keeps the comfort check, the voice choice, the stop line, the doctor lines and Lesson 8's
  rest card; nothing listens, records or scores.
- The departures from the plan, each argued in FACTS: the predict on A major's third sharp, with
  the bare notes as its choices (1a, 35); the hero at D4 and A4 for everyone (34); the reveal after
  both plays, the locked-in hint until then, and the tour's hold (36); the sing-along so, la, ti, do
  in C, then in G (54); the recall's Lesson 6 question 2 (7); Compose for the Singing tab (41, 42);
  Step 1's staircase; Step 3's heading; the guide's count-in before each run (56); the two teases
  (5, 5b); the signature places from the app's notation library (21); Step 2's Go deeper drawer
  cut (3, 27); "piano key" for a key on the keyboard (22); and the smaller ones in FACTS 4.
