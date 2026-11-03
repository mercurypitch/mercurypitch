# Lesson 18 web page: spec

The Lesson 18 page is the web lesson for "Read and sing a whole line", Season 2's second voice
lesson: a cold open on Merc's tune read note by note against the beat, a recall from Lessons 16 and
17, written steps on one main toy, Lesson 16's staff over Lesson 17's beat grid, in four step states
with free play, a scored checkpoint that reads two tunes in time from the learner's own staff, two
quizzes and the lesson explorer. Copy is in [LESSON.md](LESSON.md); every claim is in
[FACTS.md](FACTS.md). It is a text-only package: no film exists for Lesson 18, so the page has no
Watch section and the masthead's anchors are Lesson, Sing and Explorer. It is built on the kit
(`src/features/lessons/kit/`) as it stands on main at `c60f0fdcb`, and like every lesson page it
reuses and never copies: a part that lives in an earlier lesson's module moves into the kit first.

It stands on Season 2's kit work, none of it built yet (SEASON-2 § 6.2 and § 8.2 item 1): the seasons
in the kit, Lesson 15's staff toy (Lesson 15 WEB-SPEC, Toys 1), Lesson 17's rhythm on the staff, its
pitch-line view of a rhythm and its woodblock moved into the kit (Lesson 17 WEB-SPEC, What the kit
and the app still need, items 3, 8 and 11), Lesson 12's sing flow moved into the kit (Lesson 15
WEB-SPEC, What the kit and the app still need, item 6) with Lesson 16's additions to it (Lesson 16
WEB-SPEC, What the kit and the app still need, item 6). This spec says only what this page adds: two
bars of quarter and half notes at any pitch in either clef, a cursor at tempo, brackets that light
over patterns, the marks of a song sheet written as they sound, a start of do and a count-in, a take
read in time and anchored on the singer's first note, and a lock on Step 1's toy until the predict's
choice (What the kit and the app still need).

One object carries the lesson: Lesson 16's staff in the learner's clef, with the house on do, over
Lesson 17's beat grid. In the cold open Merc reads a tune on it note by note while the beat runs on,
then his own way while brackets light over the patterns he reads; in Step 1 the learner plays both
reads in their own clef; in Step 2 brackets light over the three patterns; in Step 3 a count-in and
the count keep the beat; in Step 4 the marks appear over the sounds they ask for; in Sing it the
learner reads two tunes from it in time, and after each the pitch line is drawn under it. The card's
signature is that path (FACTS 4).

Its public home is `mercurypitch.com/learn/18`: a hand-written document `learn/18.html` with its
module in `src/features/lessons/lesson-18/`. It is a voice lesson, so it is a draft until the vocal
coach signs off its voice lines and its checkpoint (LESSON.md, For the vocal coach), in the draft
list's form (`src/features/lessons/kit/drafts.ts:31-41`). The season makes it with Lesson 16, once
Sight-Singing has its work for the lessons and sight-singing in time, and the two go to the coach
together (SEASON-2 § 8.2 item 4; FACTS 73; Decisions for the owner, 2).

## Look

Season 1's look and Lesson 16's staff, unchanged: the dark listening room, the series colour code,
Lesson 1's type and wordmark, and the motion rules; the staff's lines at 3:1 or more against the
figure, chrome at rest and ink while they sound (Lesson 16 WEB-SPEC, Look; FACTS 85). Notes carry
stems now, engraved as Lesson 17's rhythm on the staff engraves them. On this page:

- **The house** marks do on every staff, with the house glyph on do's line or space, never a colour
  (FACTS 16).
- **The beat grid** is Lesson 17's pads under the bars, eight for two bars, numbered 1 to 4 twice,
  beat 1's number larger; the pad of the beat that is playing lights. The pads are drawn, never
  pressed (FACTS 84).
- **The cursor**, a thin ink `#e6edf3` line across the staff and the beat grid, moves at tempo while
  a tune plays, from the first beat of bar 1 to the end of bar 2.
- **Brackets** are gold `#ffd84d`, the series' colour for "the fit", the relationship that matters
  (MASTER-PLAN § 5; playbook rule 11): a square bracket over the notes of one pattern, above the
  highest note and its ledger line, with its label above it in gold, "a run of steps", "a repeated
  note" or "do-mi-so". Gold marks nothing else on the page; the house does do's work.
- **Orange `#ff7448`** is Tavi's bubble and **blue `#58a6ff`** Merc's. On the staff the notes Merc or
  Tavi sing light in the app's target amber `#f59e0b` as they sound, as on Lessons 15 and 16.
- **The marks**, ink: p and f in the engraving's italic dynamic letters above the staff, hairpins
  above the staff, staccato dots on the notehead's side away from the stem, slurs over the notes,
  and the breath mark, a comma above the staff at the bar line. Dynamics may sit above or below the
  staff, and in vocal music hairpins often go above: here the syllables and Step 3's count are written
  under the notes, so the dynamics go above, clear of them (FACTS 41). Each mark is written as its
  sound plays.
- **Names** written over the notes in the note-by-note read appear in ink, small, above the staff,
  on the beat Merc names each note, and stay until the play ends (FACTS 35).
- **Loudness** is brightness, one of the ways MASTER-PLAN § 5 allows: a note sung f lights brighter
  than one sung p. A note never moves for loudness, since pitch is always height, and never grows,
  since its size is the engraving's.
- **The learner's pitch line**, drawn only after a take, is the series' violet line against the
  written notes' amber bands, each band as long as its note, a lane a semitone (FACTS 53).
- **No decorative staff or clef anywhere** (FACTS 6).

Six things move: the Merc idle loops; the cursor; a note as it lights; a name as it appears; a
bracket as it lights, fading in over 0.2 s; and a mark as it is written. Only Merc and Tavi move on
their own. Under `prefers-reduced-motion` Merc and Tavi stop, the cursor jumps from beat to beat,
and brackets and marks appear with no fade; what the viewer starts still sounds and lights. For
everyone else the masthead's Pause animations toggle stops the same things.

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Season 1's departures kept: the step toys double as the
Playground in the Wrap; the mix-up card sits in the step whose toy refutes it; the practice card
sits in the Wrap. No Watch section. The page opens in Lesson 2's order (FACTS 5a). Each section's
heading, and the line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Lesson 16's, with "Season 2 · Lesson 18", anchors Lesson, Sing and Explorer, the
   Sound toggle off by default and Pause animations, through `initMasthead` with
   `{ lesson: 18, deck }`. On a first visit its welcome tour waits for the predict's choice (Toys 1).
   Its lesson menu lists the four step headings from the first paint, and none says what reading
   note by note costs (FACTS 1a).
2. **Hero, with the cold open**, laid out as Lesson 2's: the kicker, the hook as the title
   (`<h1 class="hook" id="hook">`), the meta as five chips, the promise and the sound gate from
   LESSON.md. The chips are "16 minutes" (FACTS 3), "After Lesson 16: Sing what you see" and "After
   Lesson 17: How long is a note?", each a link to that page that stays a plain chip wherever the
   lesson is not live (FACTS 2), "Sound on" and "Microphone optional". The stage holds Tavi's and
   Merc's bubbles over Merc and Tavi, the bass staff with Merc's tune and the beat grid between them,
   and under it the cold open's play, locked until a choice; the predict card sits under the stage,
   and its reveal holds the second play (Toys 1). The head:
   - the title, at most 60 characters, "How to sight-sing a melody in time | MercuryPitch" (49;
     Decisions for the owner, 1);
   - the description, "How do singers read a tune they've never heard without stopping on every
     note? A sixteen-minute lesson with sound toys: read and sing a tune in time." (149), which the
     head test holds to over 80 and at most 160 characters and to the chip's run time in words
     (`src/tests/lesson-pages.test.ts:154-159`, `src/tests/lesson-pages.test.ts:191-210`);
   - og:title and twitter:title "Read and sing a whole line · Find Your Pitch, Lesson 18" (55);
     og:description and twitter:description the hook alone (78);
   - the share card `learn/lesson-18-og.jpg`, 1200 by 630, drawing the cold open's bass staff, its
     two bars and the beat grid between Merc and Tavi, with no cursor, bracket, name, light or
     syllable; its alt "The title card: Find Your Pitch, Lesson 18, Read and sing a whole line,
     above a bass staff of two bars over a row of beat pads, between Merc and Tavi." (150);
   - the Article's structured data: headline "Read and sing a whole line", `alternativeHeadline` the
     hook, the description, `timeRequired` `PT16M`, position 18, and `teaches` "Reading a tune at
     sight, in time", "Counting in and keeping the beat", "Dynamics, staccato, slurs and breath marks"
     and "Sight-singing a short tune from the staff"; and on release a line in llms.txt: "Lesson 18,
     Read and sing a whole line: count in, read and sing a short tune in time, and read the marks a
     song sheet carries."

   The head's description writes the run time as a word, "A sixteen-minute lesson", inside the
   test's 160 characters; were the lab to set the chip at 17, "A seventeen-minute lesson" makes it 151. None of these says what reading note by note costs, so none decides the predict (FACTS 1a).
   Lengths: `verify18.mjs`, section 7.

3. **Recall from Lessons 16 and 17**, straight after the hero, shown to everyone (Toys 4; FACTS 7).
4. **Four words you'll meet**: Count-in, Dynamics, Staccato, Slur, each with its figure and play
   (Toys 3).
5. **Steps**: the step deck, four steps, the staff toy stuck beside the text (Toys 2), Step 1's
   mix-up card in its text.
6. **Sing it**: the comfort check, the voice choice and Lesson 15's line, Your turn, the stop line,
   the "What this does" box, the learner's staff, the takes, the reading and "How did that feel?"
   (Toys 5).
7. **Quick check**: four questions (Toys 4).
8. **Wrap**: the three lines, the one-sentence challenge, the practice card in the version Sing it's
   ending picks (Practice links), the next-lesson card with Lesson 19's still (Toys 6), and free
   play, the step toys under their own rules, Step 1's state still locked until the predict's choice
   (Toys 2).
9. **Explorer**: the season's map with a tab per season, opening on Season 2's.
10. **Footer**: LESSON.md's, with the two practice links, the fonts line and "Every sound on this page
    is synthesised in your browser."

## Length

The learner copy is 2,177 words on `node scripts/lesson-words.mjs`, every branch counted (FACTS 3),
under the series' cap of 2,379 by 202, and under the lead's aim of 2,230 for this pass. Each step's
own text, with its Try and its Notice, runs 82 to 119 words, inside 50 to 120 a step. The page runs
about 16 minutes: 9.15 of reading at 238 words a minute and about 7.25 of sound, toys and tasks,
about 16.4 in all. The chip is an estimate until the staff toy and the take are timed in their lab
(SEASON-2 § 1.3), and this section says so until then. Five parts carry more, for these reasons:

- **Sing it, 547 words.** It holds the series' singing lines, Lesson 3's and Lesson 15's word for
  word, which are not cut; Lesson 16's box, lines and endings; the reading's four example lines; Stop
  here and Play the start; and lines of its own (FACTS 43 to 63).
- **The Wrap, 335 words.** The practice card says what Sight-Singing does today, with its care lines,
  The Chart as its second drill, and its rest version (FACTS 60, 65 to 71).
- **The quick check, 267 words.** Four questions with three answers each and a line of feedback for
  every answer, as MASTER-PLAN § 4.2 item 8 asks.
- **Step 1, 216 words with its mix-up card.** The card sits in the step whose toy refutes it, and
  says the study's limit (FACTS 22).
- **The cold open, 146 words, and the recall, 142.** The predict, its two choices and its reveal,
  which holds Merc's way; Lessons 16 and 17's questions, word for word.

The hints and status lines are not counted, as in every text package: the predict's hints and its
"You said" lines, the lock line on Step 1's toy, the stored voice's line and Sing it's status lines,
which LESSON.md gives as stage directions, and the toys' labels, readouts, live regions and hints,
which this spec gives. A built page writes them in the open, about 150 words more by Lesson 8's
reckoning (Lesson 8 FACTS 4), so the built page would run about 2,327 words, 52 under the cap, and
needs no cut. If a build still runs over, it makes these cuts first, and every fact they carry stays
in FACTS:

1. The second tune, the lead's first cut: its offer and its Easy or Workable line, and "the two
   tunes" in "Just listen today" becomes "the tune" (about 25 words; FACTS 50, 56). Sing it then
   reads one tune, and Play Merc's tunes becomes Play Merc's tune.
2. Step 3's "The Royal Conservatory's voice exams let a singer tap one bar of the beat before
   sight-singing, to set the tempo." (19 words; FACTS 19), which the step's point does not rest on.

The activities are timed from FACTS 76 to 83. Free play is not counted.

## Toys: what each reuses, and what is new

| Toy                         | Reuses                                                                                                                                                                                                                                       | New in Lesson 18                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Predict and hero staff   | The kit's predict (`kit/predict.ts`), its `onChoice`; the tour's hold (`kit/tour-gate.ts`); the staff toy's drawing; Lesson 17's beat grid and woodblock                                                                                     | Merc's note-by-note read with its names, a count-in and the cursor; Merc's way in the reveal, with brackets                              |
| 2. The reading staff, steps | Lesson 15's staff toy and Lesson 16's options (the house, the Clef switch, Names, the pitch-line switch); Lesson 17's rhythm on the staff, its Count and its tap pad (`kit/tap-pad.ts`), with the pad's tempo readout                        | Two bars of quarters and halves in G in either clef; the cursor; brackets; the marks written as they sound; Step 1's lock and lag tags   |
| 3. Four words               | The kit's words strip (`kit/words-strip.ts`) with the page's sound owner                                                                                                                                                                     | Four small figures, each mark written as it sounds                                                                                       |
| 4. Recall and quick check   | The kit's quiz (`kit/quiz.ts`), its prefix, keys and away links; Lessons 16 and 17's question objects, once built                                                                                                                            | Ids `l18-q1` to `l18-q4`; quick check 4's play                                                                                           |
| 5. Sing it                  | Lesson 12's sing flow moved into the kit, its comfort check, voice choice and feelings (`kit/comfort.ts`, `kit/voice-choice.ts`); the listener (`kit/listen.ts`); the take reader (`kit/take.ts`); Lesson 16's start, lines and Names switch | A start of do and a count-in; a take read in time and anchored (`kit/read-in-time.ts`); the silent cursor; the pitch line; the flow rule |
| 6. Tease still              | The kit's next-lesson card and its slot (`kit/next-card.ts`)                                                                                                                                                                                 | Lesson 19's stage as a still, which plays nothing                                                                                        |

### 1. Predict and the hero's staff

The hero's staff is the reading staff's drawing in a fixed state: a bass staff with its clef, 4/4 and
two bars, Merc's tune, G3, A3, B3 and A3, then G3, B3 and D4, four quarter notes, two quarter notes
and a half note, engraved as Lesson 17's rhythm on the staff engraves them, with the house in the top
space on G3 and the beat grid under the bars; no cursor, no bracket, no name, no syllable, nothing
lit; between Merc and Tavi; it takes no taps. It is the bass clef for everyone, since the tune is
Merc's (FACTS 8, 34). The kit's predict, as it is: two `.choice` buttons, "All seven notes, each a
beat late" and "Only the first four"; one answering play, `read` ("Watch Merc read"), no free play;
`revealOn: ['read']`, the default `revealAfter`, so the reveal waits until the read has been heard
to its end with sound on (`src/features/lessons/kit/predict.ts:55-59`); the hints from LESSON.md,
`chosen` "Locked in. Watch Merc read.", `silent` "Sound is off: nothing played. Turn sound on, then
play it again." and `again` "Play it again.", with no `next`; the markup's lock hint, "Choose an
answer to unlock Merc's read."; `guess` giving "You said: all seven" or "You said: only four"; and
`onChoice` (`src/features/lessons/kit/predict.ts:64-65`), which tells the reading staff that a choice
is in, so Step 1's toy enables its plays (Toys 2), and settles the tour's hold (FACTS 37).

- **Watch Merc read** (`read`), the note-by-note read: do, G3, in the soft tone for 1.0 s, lighting
  the house's note; 0.4 s of quiet; the count-in, four woodblock clicks at 60 BPM, beat 1 higher,
  while a strip of four small dots before bar 1 lights one dot a click; then the bars over the
  click, the cursor moving from bar 1's first beat and each pad lighting on its beat. On beats 1, 3,
  5 and 7 the next note's syllable appears over it in small ink as Merc names it; on beats 2, 4, 6
  and 8 he sings that note on "ooh" and it lights amber. Do, re, mi and re sound, one, two, three
  and four beats after their places, while the cursor pulls ahead; when bar 2 ends, the cursor stops
  at the final bar line and do, mi and so stay unlit and unnamed. 13.4 s in all; the names stay
  until the next play (FACTS 35, 38, 76).
- **Read Merc's way**, in the reveal, which shows only after it: the count-in, then Merc sings the
  tune on the beat over the click, each note lighting as it sounds. As the cursor reaches bar 1's
  first note, a gold bracket fades in over its four notes, labelled "a run of steps"; as it reaches
  bar 2's first note, one over do, mi and so, labelled "do-mi-so". 12.0 s; the brackets stay drawn
  until the next play. It is not an answering play, and it registers with the page's sound owner like
  every play (FACTS 35, 37).
- The figure's accessible name is "Bass staff, two bars of 4/4: G, A, B, A, then G, B and a long D".
  A polite live region says what each play did. After the read: "Merc named each note on one beat and
  sang it on the next: G, A, B and A, each further behind the beat. The bars ended before G, B and
  D." After Merc's way: "Merc read a run of steps, G, A, B, A, then do-mi-so, G, B, D, on the beat."

On a first visit the welcome tour waits for the choice: its step "One step at a time" scrolls to the
steps' stage (`src/features/lessons/kit/tour-copy.ts:44-46`), which would carry a learner past the
predict, so the page holds the tour until a choice through the kit's `holdTour`
(`src/features/lessons/kit/tour-gate.ts:57-69`), with no time limit, as Lessons 15, 16, 21 and 23 do.
The hold matters here: Step 1's text gives the answer, and it sits further down the page on a wide
screen, under the recall and the four words, and one Next away in a phone's deck. A learner who goes
there unasked has passed the predict, as on Lessons 16 and 21's pages; Step 1's toy stays locked
until the choice all the same (FACTS 1a).

### 2. The reading staff in the steps

Lesson 15's staff toy (proposed as `src/features/lessons/kit/staff.ts`, Lesson 15 WEB-SPEC, Toys 1)
with Lesson 17's rhythm on the staff, on the step deck's stage, in the learner's clef: the clef of
the voice stored as `fyp-voice`, the bass for the lower voice and the treble for the higher, and the
bass when none is stored; a **Clef** switch, Bass · Treble, a radio group of two 44 px buttons,
changes it for the visit, and the voice choice in Sing it sets it from there on (FACTS 8). Do is G:
G3 in the bass staff's top space, G4 on the treble staff's second line, with the house on do's line
or space. Each two-bar figure is two bars of 4/4 in quarter and half notes over the beat grid,
engraved as Lesson 17's rhythm on the staff engraves them, with stems set by the staff's middle
line; Step 4's short figures are quarter notes, or a half note, with no time signature, no bar line
and no beat grid, as Lesson 17's four words are (FACTS 41). A tap on a note plays it for 0.8 s and
says it ("B3, mi, a quarter note"); **Names on · off**, off, shows or hides the syllables under the
notes; "See it on the pitch line" redraws a figure as Lesson 17's pitch-line view of a rhythm, each
note an amber band as long as it sounds, off by default (FACTS 8). Every play of a two-bar figure
runs at 60 BPM over the woodblock, beat 1 higher, with the cursor and each pad lighting on its beat,
in the soft tone in the learner's octave, timed from its first sound on the beat clock; Step 4's
short figures and a bracket's pattern play at 60 BPM as written, without the click, and a tapped
note plays alone.

Four step states and free play, with LESSON.md's plays (FACTS 78 to 81):

1. **Two reads (Step 1), locked until the choice.** The cold open's tune, do re mi re, do mi so
   (half), in the learner's clef. **Read note by note**: the count-in, then the bars, the click and
   the cursor on the beat; each note is named on one beat, its syllable appearing over it, and sung
   on the next, so do sounds a beat after its place, re two beats, mi three and the second re four,
   on beats 2, 4, 6 and 8, each lighting amber as it sounds while the cursor pulls further ahead.
   Under each sung note a small tag says how late it came, "1 beat late" to "4 beats late". The play
   ends with bar 2, and do, mi and so stay unlit, 12.0 s (FACTS 38). **Read Merc's way**: the
   count-in, then the tune on the beat, its gold brackets fading in as in the cold open's reveal,
   12.0 s. A polite live region: "Read note by note: four notes sounded, each further behind the
   beat. Do, mi and so never came." and "Read Merc's way: a run of steps, then do-mi-so, on the
   beat."
2. **Patterns (Step 2), never locked.** **Play tune A**, do re mi fa, so (half) so (half), and
   **Play tune B**, so (half) mi do, re re do (half), 8.0 s each, in place of each other on the one
   staff. As the cursor reaches a pattern's first note its gold bracket fades in: in tune A "a run
   of steps" over bar 1 and "a repeated note" over bar 2; in tune B "do-mi-so" over so, mi, do and
   "a repeated note" over re, re (FACTS 39). A drawn bracket is a button, its hit area at least
   44 px tall over the bracket and its label, named for its pattern and notes ("a run of steps: G,
   A, B, C"), which plays its notes alone at 60 BPM, each lighting. No bracket is drawn before its
   tune has played.
3. **The beat (Step 3).** Tune C, do re mi do, re (half) do (half), with **Count** on, Lesson 17's
   switch: "1 2 3 4" under bar 1 and "1 (2) 3 (4)" under bar 2, each count lighting in turn, the
   unsaid ones in brackets (FACTS 18). **Play with the count-in**: the count-in strip, then the tune,
   12.0 s. Under the figure, Lesson 17's tap pad, a 64 px button, "Tap" with "or press Space": each tap
   sounds the clap and lights the pad of the beat it fell nearest, and nothing is judged; from the
   fourth tap a readout under the pad reads the taps' tempo, "Your taps: 60 BPM", through the kit's
   `createTapTempo` (`src/features/lessons/kit/tap-pad.ts:87-120`), and it never scores (FACTS 40).
   The pad works with or without a play, and taps sound with sound on only.
4. **The marks (Step 4).** Five buttons under the figure, each playing one example in the learner's
   octave and writing its mark as its sound plays, the short figures in quarter notes at 60 BPM as
   written (FACTS 41): **p, then f**, mi, re, do at 0.3 of the voice's level with p written above the
   first note as it starts, then after a beat the same at 1.0 with f above the first, 7.0 s;
   **Hairpins**, so as a half note, the level gliding from 0.3 to 1.0 over 1.0 s under a hairpin
   above the staff that draws open as it grows, then back over 1.0 s under one that draws closed,
   2.0 s; **Staccato**, do, mi, so, each sounding 0.15 s of its beat, a dot appearing on each as it
   sounds, 3.0 s; **Slur**, do, re, mi joined, the curve drawing over them as they sound, 3.0 s;
   **Breath mark**, tune C over the click, its last do of bar 1 sounding 0.6 s, then 0.4 s of silence
   as the comma appears above the staff at the bar line, bar 2 on its beat, 8.0 s. Once drawn, a mark
   is a button that plays its example again. A polite live region names each: "p, then f: the same
   three notes, quiet then loud."
5. **Free play (Wrap).** Every state above, with the Clef switch, Names, Count and the pitch-line
   switch, and no reveal or quiz attached, each under its own rules: Step 1's state stays locked until
   the predict's choice, with the same lock line, since the Wrap can be reached by scrolling before
   it, where Lesson 23's free play runs whether or not a choice was made (FACTS 1a).

**The lock.** Until the predict's choice, Step 1's play buttons are `disabled`, in the step and in
free play, and a line under the figure reads "Choose an answer at the top of the page to unlock
this." The predict's `onChoice` enables them. The kit's predict stores no choice, so a returning
learner meets the lock again, unless Lesson 18 is already marked done (`Done.has(18)`,
`src/features/lessons/kit/progress.ts:22-29`): then Step 1's toy opens unlocked, though the cold
open still asks its question afresh. Steps 2, 3 and 4's toys never play the cold open's tune or the
note-by-note read, so none is locked: Step 2's brackets bear on what a reader looks for, not on what
naming costs (FACTS 1a).

No play anywhere in the steps is tune 1 or tune 2 of Sing it, in either octave: the steps play the
cold open's tune, tunes A, B and C, the marks' examples and single notes (FACTS 39, 50). A learner's
taps can play any note, as every staff toy's can.

The steps' figure is `.viz.tall`, as Lesson 16's (FACTS 84): the lower voice's notes reach D4, the
space above the bass staff's first ledger line, inside the toy's range, and the brackets sit above it;
the treble's G4 to D5 sit on the staff, the brackets above them.

### 3. Four words

The kit's words strip, a ticket a word with its figure and play, with the page's sound owner. Each
figure is a small staff in the learner's clef (the stored voice, the bass when none), or for the
count-in four beat pads, its mark written as its sound plays and staying written (FACTS 77):
Count-in, four woodblock clicks at 60 BPM, beat 1 higher, each pad lighting; Dynamics, mi, re, do
quiet with p, then after a beat loud with f; Staccato, do, mi, so with their dots; Slur, do, re, mi
under its curve. The staff figures are quarter notes with no time signature, no bar line and no beat
grid, played at 60 BPM as written, as Lesson 17's four words are. No figure has the pitch-line
switch, as Lesson 16's word figures have none.

### 4. Recall and quick check

Two quizzes through the kit's quiz, each with its own prefix and keys.

- **Recall**: Lesson 16's question 3 and Lesson 17's question 1, imported from their questions and
  filtered by id, `l16-q3` and `l17-q1`, once those pages are built; until then their words are
  LESSON.md's, word for word (FACTS 7). Shown to everyone. Prefix `recall-`, keys
  `fyp-l18-recall-seed` and `fyp-l18-recall-v1`; no `lesson`, so it marks nothing done. Step links
  read "Try Lesson 16, Step 4 again" and "Try Lesson 17, Step 1 again" and open that page at the step
  in a new tab, the quiz's `away` address set to `recallStepHref`
  (`src/features/lessons/kit/quiz.ts:140-142`), or keep their words with no link where the lesson is
  not live (`linkAway`, `src/features/lessons/kit/quiz.ts:186-212`).
- **Quick check**: LESSON.md's four questions, ids `l18-q1` to `l18-q4`, keys `fyp-l18-seed` and
  `fyp-l18-quiz-v1`, and `lesson: 18`, so answering all four marks Lesson 18 done. Three answers each,
  shuffled from the stored seed, one line of feedback for every answer, "Right." or "Not quite."
  before it (`src/features/lessons/kit/quiz.ts:315`). Question 4's slot holds its play, a button
  reading "Play", which plays so, fa, mi loud, then after a beat the same three notes quiet, in
  quarter notes at 60 BPM in the learner's octave, 7.0 s, drawn as nothing. It is not the four
  words' clip, mi, re, do quiet then loud, so the ear answers and not the memory of a labelled sound
  (FACTS 83).

### 5. Sing it

Lesson 12's sing flow as Lesson 15's spec moves it into the kit, with Lesson 16's additions and a
take read in time: the comfort check, the voice choice and its line, Your turn, the stop line and the
"What this does" box from LESSON.md. Every state has a visible status line that is also announced
(`aria-live="polite"`).

States:

1. **Comfort check**, always first and asked every visit (never stored): Lesson 3's line, its list of
   six conditions and its two buttons (FACTS 43), through the kit's `mountComfort`
   (`src/features/lessons/kit/comfort.ts:159`).
2. **Voice choice**, after either comfort answer: Lesson 3's two buttons with Merc and Tavi's stills
   (`aria-pressed`, at least 44 px), under LESSON.md's line in its two forms, then Lesson 15's line
   under them (FACTS 45). It reads and writes `fyp-voice` (`src/features/lessons/kit/voice-choice.ts:20`).
   With none stored nothing in Sing it plays until a choice; the choice sets the learner's staff, the
   voice that sings, and the steps' clef from then on.
3. **Just listen today**: LESSON.md's line with the doctor lines; **Play Merc's tunes** at once;
   nothing listens, Start is not shown, and nothing asks the viewer to sing (REQ-GVC-021). The Wrap
   shows the rest card (FACTS 44, 60).
4. **Your turn and briefing**: LESSON.md's Your turn, the stop line on its own line, the "What this
   does" box (FACTS 55), and the learner's staff, the reading staff's sing state: tune 1, do re mi so,
   so mi do (half), with its breath mark at the bar line, the house on do, the beat grid and the
   count-in strip, no syllables and a **Names on · off** switch, off, in the learner's clef and octave
   (G3 A3 B3 D4, D4 B3 G3 in the bass; G4 A4 B4 D5, D5 B4 G4 in the treble). The staff takes no taps
   and has no pitch-line switch here. **Start** is the only control that asks for the microphone
   (`listen('lesson-18', Sound.context())`).
5. **The start**: with sound on, Start asks for the microphone, then the voice for the chosen voice,
   Merc or Tavi, sings do for 1.0 s on "ooh", the house's note lighting; 0.4 s of quiet; the count-in,
   four woodblock clicks, beat 1 higher, the count-in strip lighting a dot a click, status "Counting
   in: one bar." No written note but do lights during the start, so the start shows nothing of the
   tune (FACTS 49). With sound off, Start plays nothing and asks for nothing, with the hint "Sound is
   off, so nothing played. Turn sound on to hear the start, then press Start." Sound turned off during
   the start ends it without counting a take.
6. **The take**, sung from bar 1's first beat, the beat after the count-in; its frames are kept from
   half a beat before it, 0.5 s after the last click starts (FACTS 82). From the first beat the
   cursor moves along the bars at 60 BPM and the beat grid lights each beat, in silence, status "Your
   turn: sing in time with the cursor."; Merc and Tavi listen. Nothing plays during a take, the click
   included, since the microphone hears the raw signal, and the pitch line is not drawn (FACTS 52,
   53). The cursor keeps the written beat; the reader counts each note's beats from the singer's
   first note (below). When bar 2 ends the cursor stops at the final bar line, and the take listens
   on until the last note's window closes, a quarter of a beat after bar 2 ends, moved by the anchor,
   so up to 2.25 s after the bar line for a singer who came in two beats late; the microphone is
   released when it ends. The Names switch can change during a take: it changes only what is drawn.
7. **After the take**, 0.5 s later: the staff keeps its notes, and the learner's pitch line is drawn
   under it on the bars' time axis, the take's frames as a violet line over the written notes' amber
   bands, each band as long as its note, a lane a semitone, folded into the written notes' octave with
   the octave tag where it applies, as Lesson 16 draws a phrase's (`octaveTag`,
   `src/features/lessons/kit/band-words.ts:93-99`); under it, one line a note in order, from the
   reading (below). If no note's window held any voice: Lesson 9's line with this task's cue, "We
   didn't hear you start that time. Come in on do after the count-in.", with **Start again** while the
   visit has made fewer than three takes, and no feeling question; after the last take the line keeps
   "We didn't hear you start that time." and drops its cue (FACTS 57).
8. **How did that feel?**: Lesson 3's four answers after each take with voice, an answer that locks,
   through `mountFeelings` (`src/features/lessons/kit/comfort.ts:175`):
   - After the first tune, Easy or Workable: "Now another tune you've never heard." The staff draws
     tune 2, do do mi mi, so (half) do (half) (G3 G3 B3 B3, D4 G3 or G4 G4 B4 B4, D5 G4), with its
     breath mark and only the house; it can be read silently before **Start tune 2**, which runs
     states 5 to 8 again. Beside it, **Stop here** ends the singing for the visit: no second take, the
     lines stay, **Play Merc's tunes** shows, and the Wrap keeps the practice card, since stopping
     reports no effort (FACTS 56).
   - After the second, Easy or Workable: "Two tunes, read in time from the page." and **Play Merc's
     tunes**. The Wrap shows the practice card.
   - Effortful: no more tunes, Lesson 3's "Keep it gentle: rest before you sing again.", the lines
     stay; **Play Merc's tunes**; the Wrap shows the rest card (`restAfterEffort`).
   - Uncomfortable: the lines and the pitch line are taken away, Lesson 3's "Thanks for saying so.
     That's enough singing for today: rest your voice." with the doctor lines; **Play Merc's tunes**;
     the Wrap shows the rest card (REQ-GVC-023, REQ-GVC-055).
   - Once "Effortful" or "Uncomfortable" has been answered, no further take and the rest card stay so
     for the visit, in memory (`VisitEnding`, `src/features/lessons/kit/comfort.ts:101-114`).
9. **No microphone** (refused, no device, or the listener failed to load): LESSON.md's "No
   microphone?" line, both tunes drawn, one above the other, each with its own **Play the start**
   under it, which sings do and counts in one bar in the chosen voice, then moves that tune's cursor
   through its two bars in silence, 13.4 s, and no tune, so a learner singing with nothing listening
   still hears do and the tempo first; and **Play Merc's tunes**; the Wrap keeps the practice card
   (FACTS 58). Without Web Audio, Sing it offers this path at once, and Play Merc's tunes lights the
   notes in silence with "This browser can't play sound here."

**Play Merc's tunes** appears only once the singing has ended (after the second tune's answer, Stop
here, an Effortful or Uncomfortable answer, Just listen today, the visit's last take, or no
microphone), so the second tune is never heard before it is read. It sings do, counts in, sings tune
1, then after 1.0 s counts in again and sings tune 2, in the chosen voice, each note lighting amber as
it sounds, 26.4 s (FACTS 59).

The retry rules, all in the flow rule below (FACTS 57):

- A visit allows at most three takes. Every take counts: one with no voice, one with no steady note,
  and one abandoned when the page was hidden.
- The second tune only after Easy or Workable on the first, and never after Stop here; no Again for
  either tune.
- Never another take after "Effortful" or "Uncomfortable".
- No reading line invites another try (FACTS 54), so no retry wording shows without a retry control.

The flow is a pure rule (`lesson-18/sing-flow.ts`), as Lessons 9 and 16's are: from the comfort
answer, the voice, whether sound and Web Audio are on, the takes so far (how many, which tune each
read, whether each had voice and whether it was abandoned) and the answers so far (the latest, whether
"Effortful" or "Uncomfortable" was ever answered, and whether Stop here was pressed), it gives the
state, the controls shown, the lines, whether Play Merc's tunes shows and the Wrap's card, so every
branch is unit-tested without a microphone (Tests, 8).

**The in-time reader** (`kit/read-in-time.ts`, new, pure and unit-tested; What the kit and the app
still need, item 7), the lead's answers for scoring in time: each note judged in its own beats, the
beats anchored on the singer's first note, and a note left out or far late read as not heard, never
as a pitch gap (FACTS 52, 54). Every value below is new, chosen for a quarter note's 1 s at 60 BPM,
and is run on synthetic takes in `verify18.mjs`, section 8; the lab sets them on a phone (What the
kit and the app still need, item 15).

- **Input**: the take's frames, each with its time on the audio clock, its f0 and its confidence; the
  written notes, each a MIDI note with its onset and length in beats; the tempo; and the audio-clock
  time of bar 1's first beat, which the start scheduled. A frame is voiced when Voice Mirror's
  `preprocess` keeps it, as `readTake` takes them. The page's notes and the microphone's frames share
  one clock (`src/features/lessons/kit/listen.ts:13-15`).
- **The anchor.** The take's first run of voice at least 0.15 s long is the singer's first note. If
  it starts between a quarter of a beat before bar 1's first beat and two beats after it, it anchors
  the take: every note's beats move by its distance from bar 1's first beat, early or late, as The
  Chart's first tap anchors its bar (`src/features/ear-lab/ChartDrill.tsx:5-13`). A steady delay, the
  device's output and input or the singer's own lag, moves the first note with it and cancels out,
  so no measured round trip is needed. A run already going when the take opens (do hummed through the
  count-in), or a first run outside that span, leaves the beats where they are written. Only the
  first run counts: the reader never hunts for a later one, which could be a later note.
- **The window.** Each note is listened for from a quarter of a beat before its beats to a quarter
  of a beat after them, anchored. Windows overlap, and a frame may count for two notes: each note is
  judged alone, so a slip costs only that note.
- **Heard on its note.** Inside its window, in time order, each voiced frame's distance from the
  note is folded into one octave (`foldCents`, `src/lib/pitch-measurements/f0.ts:57-59`); a frame
  within 60 cents adds its time to the note's total, and a frame outside, or with no voice, takes
  back half its time, never below zero: Sight-Singing's rule
  (`src/features/exercises/sight-singing/use-sight-singing-controller.ts:199-202`). The note is heard
  on its note once the total reaches 0.45 s, and is read from the frames that counted towards it, as
  their median folded distance, with the octave they sat in. This rule only finds the note: its line
  says "In the band" only within 35 cents.
- **Not heard on its note.** Its reading comes only from the voiced frames inside its own beats,
  anchored, never the widened window, after an attack of 0.15 s counted from its first beat:
  - under 0.3 s of them gives "We didn't hear a steady note there.";
  - so does a median more than 60 cents from the note and within 60 cents, folded, of a written note
    up to two places before or after it, since that is another written note sung early or late, a
    left-out note's neighbour coming in early, or a tune far behind;
  - so does every note not heard on its note in a take with no anchor, where the reader cannot tell
    late from wrong;
  - otherwise its line gives its gap from its own note, for a note held out of tune.

  No gap is ever measured from the wrong note, and nothing reads when in its window the voice came,
  so timing is never scored and never becomes a pitch line.

- **The line**: the rung line with the note's syllable and "the written note": "So · In the band: 20
  cents above the written note.", "Right in the middle" within 15 cents, with Lesson 3's octave line
  within 50 cents of the note an octave or more away, or "Mi · We didn't hear a steady note there."
  (`rungLine`, `src/features/lessons/kit/take.ts:280-287`, given whose note it is, as Lesson 16's spec
  asks). No count, no score, no word on timing and no celebration on a note.
- **No voice**: when no window holds a voiced frame, the take reads as no voice (state 7).

Run on synthetic takes (`verify18.mjs`, section 8): tune 1 on pitch and on time, a whole beat late,
1.5 beats late or 0.2 s early reads every note heard on its note; 0.4 s early, before the span, it
reads every note heard on the written beats; 2.5 beats late, past the span, it gives no gap line;
with both sos left out and mi coming in 0.1 s or 0.4 s early, both sos read "We didn't hear a steady
note there."; with its last three notes drifting 1.2 beats late, those notes read as not heard or are
found late in their windows, with no gap line; re sung as fa, on time, reads its gap; and a note held
for 0.45 s is heard where one held for 0.44 s is not.

On a phone the staff and its lines fit the card at 344 to 390 px: two bars of seven notes at most on a
26 px staff space, the beat grid's pads at least 40 px wide and drawn, never pressed (FACTS 84), the
lines under it wrapping, and the pitch line below the staff at full width, 160 px tall.

### 6. Tease still

The drawing in the next-lesson card's slot, the page's `[data-next-card]` mark: an SVG, `aria-hidden`,
of Lesson 19's stage before its first play, six of Lesson 8's pads in a row, numbered 1 to 6, all one
size, with no grouping, no arcs and nothing written or lit (FACTS 5). It holds no button, since the
card is a link, does not move and plays no sound. Its styles go under a class of its own, not the
tease line's `.next-tease`.

## Audio

Every sound is synthesised in the page with Web Audio, through the kit's sound module, its master bus
and its house envelopes, and started only by a tap: a played note, the toys' plays and the marks'
examples in the soft tone; Merc's and Tavi's singing in Merc's "ooh", Tavi's an octave up; the
woodblock click, Lesson 17's, beat 1 higher (FACTS 74 to 83). Nothing autoplays, and the page has no
music bed.

- **The sound rules**, for every source of sound on the page (the cold open's two reads, the four
  words, every play and tap of the reading staff, the pad's claps, quick check 4's play, Sing it's
  start, each Play the start and Merc's tunes):
  1. One sound plays at a time, across the whole page: a new play stops the one before.
  2. Leaving a step, by any route, stops its sound and any queued play; scrolling Sing it off screen
     for 600 ms, or hiding the page, stops what plays there and abandons a take.
  3. A play that is cut short never counts as heard by the predict.
  4. Nothing plays during a take: every play control is disabled from Start until the take ends, and
     the take itself sounds no click. Whether a quiet click under the take would help the singer keep
     time without disturbing the reader is for the lab to say (What the kit and the app still need,
     item 15).

  The kit has the helpers: the page-wide owner (`NowPlaying`, `src/features/lessons/kit/now-playing.ts:39`),
  which every source registers with, and the words strip already takes it.

- **A run in time** is booked on the beat clock from one start, the count-in, the notes and the clicks
  on the audio clock, so the drawing and the sound share it. Each note sounds its written length less
  a short gap, 0.08 s or a quarter of its length if that is less, so repeated notes are heard apart,
  as Lesson 17's runs sound (FACTS 76). The four words' and Step 4's short figures are runs too, in
  quarter notes at 60 BPM, with no count-in and no click (FACTS 77, 81).
- **Merc's and Tavi's tunes** (the cold open's two reads, the start's do, Merc's tunes) are one voice
  along a contour, held and glided on the audio clock (`src/features/lessons/kit/sound.ts:16-21`),
  each note held its written length less the gap, with a dip in level between repeated notes. In the
  note-by-note read each sung note starts on the beat after its name, beats 2, 4, 6 and 8 (FACTS 35,
  38).
- **Dynamics and articulation** are a run's note levels and lengths: p at 0.3 of the voice's level and
  f at 1.0, about 10 dB apart under the master's compressor; the hairpin a level glide between them;
  staccato notes 0.15 s long; slurred notes joined with no gap; a breath a silence of 0.4 s taken from
  the end of the note before it, which sounds 0.6 s. The levels are checked by ear on a phone in the
  lab (FACTS 41, 75).
- **No low notes.** The page's lowest sound is G3, 196 Hz, which a phone's speaker carries.

## Merc and Tavi

Lesson 1's setup through the kit (`src/features/lessons/kit/merc-duo.ts`): the app's renderer loaded
after first paint, one WebGL context per Merc, medium quality on phones, paused off screen, and the
stills when WebGL fails.

- They live in the hero, on either side of the staff. Tavi asks and Merc answers in the bubbles.
  While Merc reads, he sings each note as it sounds (`mercSing`,
  `src/features/lessons/kit/merc-duo.ts:165`), in the note-by-note read on beats 2, 4, 6 and 8 only,
  and Tavi listens (`mercListen`, `src/features/lessons/kit/merc-duo.ts:207`). Neither celebrates at
  the reveal, which says what the read played and calls no choice right or wrong.
- In Sing it the singing Merc appears as a still beside the learner's staff: Merc for the lower
  voice, Tavi for the higher. During a take both listen; nothing celebrates a note.
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Sight-Singing.** The link is `/pitch-training?lesson=18`, printed
  "mercurypitch.com/pitch-training", with "then tap Sight-Singing", in Lesson 16's form (FACTS 69).
  The card says what the drill does at `c60f0fdcb` (FACTS 65 to 68): it reads pitch, not rhythm, with
  no note lengths and no beat, and moves on once a note has been held for about half a second, or
  after 8 s, so the card asks for no hold; six notes it picks itself, in the key its start screen
  shows and the saved range, which the card asks the learner to set first; nothing played first; the
  treble clef only, a lower voice reading below it on ledger lines; the written octave; and its
  names. The drill is free. It is the season plan's link for this lesson, with its limits said
  (SEASON-2 § 5.1). The plan's "practise the patterns here" is not said: the drill never writes a
  repeated note and seldom a run of steps (FACTS 66).
- **The second drill, The Chart.** `/ear-lab?lesson=18`, printed "mercurypitch.com/ear-lab", with
  "then tap The Chart", in Lesson 17's form: a bar of rhythm on one line, tapped at sight, some bars
  holding triplets, which Lesson 19 teaches (FACTS 71). It asks for no voice, so it stays on offer
  under the rest card.
- **The rest version.** After "Effortful", "Uncomfortable" or "Just listen today" the card shows
  Lesson 12's form, "Rest today. Sight-Singing will be here when your voice feels comfortable:
  mercurypitch.com/pitch-training, then tap Sight-Singing.", is no longer a link for Sight-Singing,
  and keeps The Chart (FACTS 60).
- **The first visit.** The page is not built before SEASON-2 § 5.2 item 21 widens the lesson marker,
  so `?lesson=18` steps First Light aside and the card and footer have no first-visit line (FACTS 69).
- **Not linked: the Singing tab's sheet view.** It moves a cursor with the playing melody, but no
  address opens it and whether the tab scores a take in that view was not verified (FACTS 72). SEASON-2
  § 5.2 item 20 gives it an address; once it is known to score, a later edit may link it as "sing a
  whole song from the page".
- **Needed: sight-singing in time** (SEASON-2 § 5.2 item 11; FACTS 73), the app's work. For this
  lesson it needs: a count-in and a click; notes that move on the beat at a set tempo, 60 BPM by
  default, rather than on a 450 ms hold; note values drawn, at least quarters and halves; pitch read
  per note inside its beats, folded into the singer's octave, in a band as generous as this page's;
  each note's beats counted from the singer's first note, as The Chart counts a bar from its first
  tap and this page's take does, so a steady delay or a late entry is never read as a wrong pitch,
  and a note not heard read as not heard, never as a gap from another note (FACTS 52, 54); timing
  shown, not scored; and, from item 10, fixed tunes by data, this page's two tunes written in the
  singer's own clef and octave as Lesson 16's spec asks for its phrases, a hear-do start, the bass
  clef and names off. Its click under the singing is the one part this page's take leaves out, since
  the microphone hears the raw signal (FACTS 52); the lab's answer on a quiet click (What the kit and
  the app still need, item 15) goes to item 11 too.
- **The card once item 11 ships with item 10's parts**, proposed: "Sight-Singing writes this page's
  two tunes on your own clef. It sings do and counts you in, then the notes move on the beat while you
  sing, in any octave; it shows your timing but doesn't score it." with the care lines, and the
  address "Practise it free: mercurypitch.com/exercises/read-a-whole-line". Each new sentence waits
  for its item; until all ship, the card keeps today's sentences for the rest. The Chart stays the
  second drill.
- Not linked: no premium exercise. Sight-Singing and The Chart are free (FACTS 69).

## Explorer and season data

Lesson 18's entry, proposed for Season 2's data in its own module, in Season 1's entry form (Lesson
9's, `src/features/lessons/kit/season.ts:326-344`):

- `n: 18`, `lane: 'voice'`, `title: 'Read and sing a whole line'`, `short: 'Reading in time'`,
  `topics: ['S11b', 'T32']`, with S11b's and T32's names as SEASON-2 § 4.1 gives them; the hook word
  for word (FACTS 1); `minutes: 16` and `page: '/learn/18'` once the page is built, under the drafts'
  comment, `// A draft until its sign-off (drafts.ts), as Lesson 3 is.`
- `pr.link`: `href` `/pitch-training?lesson=18`, `addr` `mercurypitch.com/pitch-training`, `label`
  "Exercises" and `note` "then tap Sight-Singing", as Lesson 16's (FACTS 69). `pr.needs`,
  "Sight-singing in time: a count-in, a click and notes that move on the beat, pitch scored per note
  (SEASON-2 § 5.2 item 11)", which is "Admin only, never drawn on a lesson page"
  (`src/features/lessons/kit/season.ts:102-103`).
- `EDGES` gains [16, 18] and [17, 18], as SEASON-2 § 4.3 gives them (FACTS 2).
- The tease on Lesson 17's card is this lesson's, set on Lesson 18 in the lesson copy: `tease` "Now
  you can read when each note comes, and where it sits." (57 characters), with no alternative, so no
  team note is needed (FACTS 5b). The tease on this page's card is Lesson 19's, set on Lesson 19:
  "Same six notes, same speed. Only the accents move.", with the alternative `written` (FACTS 5).
- The signature line for the admin console, from the card (FACTS 4): "Lesson 16's staff over Lesson
  17's beat grid; a cursor moves at tempo, patterns bracket themselves as it reaches them, and the
  song sheet's marks appear over the sounds they ask for."
- The explorer's card reads "Ready · read" with "16 min" once the page is live.

## What the kit and the app still need

Found in the kit and the app as they stand on main at `c60f0fdcb`. Every item is proposed but item
16, which has shipped.

1. **The lesson host**: `learn/18.html` at `/learn/18`, which every build takes as a lesson page
   (`lessonPages`, `tools/draft-lessons.ts:82`); `/learn/18` and `/learn/18.html` in
   `STANDALONE_DOCUMENT_PATHS` (`src/lib/sw-runtime.ts:93`); the first-paint budgets (FACTS 86). The
   lesson pages' route already takes any two digits (`LESSON_PAGE`, `src/lesson-gate.ts:134`).
2. **The draft line**, in the draft list's form:
   `18: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`, as Lesson 9's
   (`src/features/lessons/kit/drafts.ts:31-41`).
3. **Seasons in the kit** (SEASON-2 § 6.2 item 1), as Lesson 15's spec sets them out.
4. **The reading staff**: the staff toy (SEASON-2 § 6.2 item 2) with rhythm on the staff (item 3), as
   Lessons 15 and 17's specs ask, and this page's additions:
   - **any pitch, quarters and halves**: Lesson 17 engraves one pitch, A3 or A4 (Lesson 17 WEB-SPEC,
     What the kit and the app still need); this page needs G3 to D4 on the bass staff and G4 to D5 on
     the treble, each stem set by its note's side of the middle line, which the stats snippet does not
     do for a note that crosses it (SEASON-2 § 6.1 item 1);
   - **the beat grid under a two-bar figure**, its pads drawn and lit, never pressed, and a **count-in
     strip** of four dots before bar 1; and **short figures** with no time signature, bar line or beat
     grid, as Lesson 17's four words are;
   - **a cursor at tempo** on the beat clock, jumping beat to beat under reduced motion;
   - **names**, new: a note's syllable written small over it on the beat the note-by-note read names
     it, and after Step 1's Read note by note a **lag tag** on each sung note, the beats it came late;
   - **brackets**, new: a gold square bracket with its label over the notes of one pattern, fading in
     as a play's cursor reaches its first note, a button once drawn that plays its notes;
   - **the marks**, new: p and f, hairpins, staccato dots, slurs and the breath mark, each written as
     its sound plays and a button once drawn, with p, f, the hairpins and the breath mark above the
     staff, clear of the syllables and the count under the notes (Look; FACTS 41). The p and f are the
     snippet's Noto Music glyphs `dynP` and `dynF` (`docs/plans/find-your-pitch/research/stats-motifs.md:549`);
     its hairpin glyphs are one size, so a hairpin is drawn as a path to its length. The staccato dot,
     the slur and the breath mark are not among its 33 glyphs, so the dot, the slur and the breath
     mark's comma are paths, each placed by the staff's rules, checked against a theory text, then
     built, as SEASON-2 § 6.1 item 1 has it for the symbols the snippet does not list;
   - **a lock**: a state with its plays disabled and a lock line until the page says a choice is in
     (Toys 2), which the predict's `onChoice` gives (`src/features/lessons/kit/predict.ts:64-65`), in
     the step and in the Wrap's free play alike, and no lock once Lesson 18 is marked done (`Done`,
     `src/features/lessons/kit/progress.ts:22-29`);
   - **loudness as brightness**: a sounding note's light scaled by its level, never its size.
5. **The woodblock in the kit** (Lesson 17's item 11) and **a count-in**, new: a one-bar run of the
   click before a figure, beat 1 higher, its strip lighting with each click.
6. **The tap pad's tempo readout** under Step 3's pad: `createTapTempo` is in the kit
   (`src/features/lessons/kit/tap-pad.ts:87-120`); the page draws its reading, "Your taps: 60 BPM".
7. **The sing flow in the kit** (Lesson 15's item 6) with Lesson 16's additions (its item 6), and a
   **take read in time**:
   - a start of do in the chosen voice, then the count-in, scheduled on the audio clock, with bar 1's
     first beat handed to the reader;
   - a take that keeps frames from half a beat before bar 1's first beat and ends when the last
     note's window closes, moved by the anchor, on the frames' clock, through Lesson 16's proposed
     `until`, with `wait` covering the whole take: today `run` counts from the first voiced frame
     (`TakeOptions`, `src/features/lessons/kit/listen.ts:89-110`), so a late first note would push
     the take's end past the bars;
   - `kit/read-in-time.ts`, new: the in-time reader (Toys 5), pure, with its tests, beside the cursor
     reader Lesson 16 proposes, `kit/read-along.ts`, sharing its line reading. It counts each note's
     beats from the singer's first note, as The Chart's take is "judged by its distance from the
     anchor, so a steady input delay cancels out entirely" (`src/features/ear-lab/anchored-take.ts:10-11`),
     so no device delay is measured;
   - the silent cursor and beat grid during a take, with no sound;
   - the pitch line drawn after a take on the bars' time axis: Lesson 17's pitch-line view of a rhythm
     (its item 8) given a take's frames.
8. **Dynamics, staccato, slurs and breaths in the kit's runs**: a run's note takes a level, which a
   contour already carries (`src/features/lessons/kit/sound.ts:270-278`), a sounding length shorter
   than its value, a join to the next note with no gap, and a silence taken from its end, all booked
   on the beat clock.
9. **No decorative staff** (Lesson 15's item 7).
10. **The lesson copy**: this lesson's tease set on Lesson 18, with no alternative, within `TEASE_MAX`
    (`src/features/lessons/kit/lesson-copy.ts:76`): 57 characters (FACTS 5b).
11. **Season 2 in the app's lesson plumbing** (SEASON-2 § 5.2 item 21), the app's work: the lesson
    marker's range, so `?lesson=18` steps First Light aside (FACTS 69), and the lesson-answer bounds,
    which refuse Lesson 18's answers whole today (FACTS 70).
12. **Sight-singing in time and Sight-Singing for the lessons** (SEASON-2 § 5.2 items 11 and 10), the
    app's work (Practice links).
13. **The head and the share card** (Sections, 2): the title, the descriptions, the share card
    `learn/lesson-18-og.jpg` and its alt, and the structured data with `timeRequired` `PT16M`.
14. **Lessons 16 and 17's questions as modules** (`lesson-16/quiz-questions.ts`,
    `lesson-17/quiz-questions.ts`), so this page imports `l16-q3` and `l17-q1` (Toys 4).
15. **The lab, on a phone**, before the chip and the checkpoint are set, with the coach where a take
    is sung:
    - the in-time reader's values on real takes (Toys 5): the anchor's span, a quarter of a beat
      early to two beats late, and its 0.15 s run; the windows' quarter-beat edges; the 0.15 s attack
      and the 0.3 s of voice for a note not heard on its note; and the two places either side that
      the neighbour rule looks at;
    - whether 0.45 s within 60 cents of the note, inside a quarter note's window at 60 BPM, is
      reachable for a beginner, and on the note before each breath mark, which sounds about 0.6 s;
    - how often learners come in late, drift behind the cursor or hum do through the count-in;
    - whether a quiet click under the take helps the singer keep time without disturbing the reader,
      which hears the raw signal (FACTS 52): The Chart's beat "ticks softly under the remaining
      onsets" (`src/features/ear-lab/anchored-take.ts:7-8`), and SEASON-2 § 5.2 item 11 plans a
      click for the app's own drill;
    - the p and f levels and the woodblock's level by ear;
    - the brackets, marks, names and pitch line at 344 to 390 px, and the figure's height in the bass
      clef with a bracket and its label over D4 (FACTS 84);
    - the page's run time.
16. **The planning-text test's topic codes**, found here, have shipped. Its pattern took a T or an
    S, two digits and a word's end, so a letter after the digits hid Season 2's split codes, S11a,
    S11b, S20a and S20b, from it; it now takes one lowercase letter there
    (`src/e2e/learn-no-planning-text.spec.ts:40`), so it catches each of them.

## Decisions for the owner

Both were open in the plan. The owner asked for the recommended answer to every open question, so
each below is taken and nothing here waits.

1. **The page's title.** SEARCH.md § 4 has no Season 2 drafts. Taken: "How to sight-sing a melody in
   time | MercuryPitch" (49), in the query-led form the owner chose on 22 October 2026, with the words
   people type, "sight-sing", "melody" and "in time". The alternative, "Sight-singing in rhythm for
   beginners | MercuryPitch" (52), names the audience. Neither names a pattern or a number (FACTS 1a).
2. **Release after the app's work, or before.** Taken: as the season orders it, after SEASON-2 § 5.2
   item 10's parts and item 11, and item 21, so the practice card can send the learner to sight-singing
   in time on their own clef, and every quiz answer is kept. The page as written is ready for either:
   today's card states the drill's limits, and the shrunk card is written (Practice links; FACTS 73).

## Edge cases

- **Sound off, unset or missing.** Every play obeys the kit's `canPlay`. The predict's reveal waits
  for the read heard with sound on; Start waits for sound (Toys 5). With no Web Audio the page stays
  readable, every play runs its visuals in silence with its hint, and Sing it offers the no-microphone
  path.
- **Before a choice** the read is locked, the reveal and Read Merc's way hidden, and the hero plays
  nothing; Step 1's toy is locked with its lock line, in the step and in the Wrap's free play, whose
  other states play; Steps 2, 3 and 4 play.
- **The read cut short** (another sound, a step link, leaving the hero): not heard, no reveal, the
  hint as it was; its names stay drawn until the next play.
- **A stored choice**: the kit's predict stores no choice, so every visit asks again, and Step 1's toy
  locks again until it is answered, unless Lesson 18 is marked done, when it opens unlocked (Toys 2).
- **Reduced motion**: the cursor jumps beat to beat, and names, brackets and marks appear with no
  fade.
- **A first visit that never chooses**: the welcome tour waits, and the next lesson page opened at the
  top offers it again; "Tour this page" runs it at once (Toys 1).
- **No voice chosen**: the steps' staff shows the bass clef; nothing in Sing it plays until a voice
  is chosen. A stored voice opens on its own clef.
- **The Clef switch in the steps** changes the clef for the visit until Sing it's voice choice;
  switched mid-play it stops the play.
- **Taps on Step 3's pad with no play running**: each tap claps and lights the beat grid's next pad
  in turn, and the readout reads the taps' tempo from the fourth tap; with sound off the pad lights
  and reads, silently.
- **The microphone refused** at Start: the no-microphone path, with each tune's Play the start and
  Play Merc's tunes; no take is counted.
- **No microphone, and singing anyway**: each tune's Play the start gives do and the count-in, then
  that tune's cursor keeps the beat in silence, and nothing listens; either can be played again, and
  Play Merc's tunes checks both tunes after.
- **Stop here after the first tune**: no second take this visit; the second tune stays unheard until
  Play Merc's tunes, which plays both; the Wrap keeps the practice card.
- **A take with no voice in any window**: the no-voice line with Start again while takes remain; no
  feeling question (Toys 5, state 7).
- **A take that stops mid-tune**: each remaining note reads "We didn't hear a steady note there.";
  the take ends when the last note's window closes, then How did that feel? asks, as for any take
  with voice.
- **A note left out** (so felt high): it reads "We didn't hear a steady note there.", even when the
  next note comes in a little early, and the next note is read in its own window (FACTS 51, 52).
- **A note sung a little early or late**: it is heard on its note if its 0.45 s within 60 cents fall
  inside its window, which reaches a quarter of a beat either side of its beats, counted from the
  singer's first note.
- **A whole tune sung late**, or a little early: the first note anchors the take, so a tune sung up to
  two beats late, or up to a quarter of a beat early, whether the delay is the singer's or the
  device's, reads as if on time (Toys 5).
- **A singer who drifts behind** during a tune: a note that slips so late that its beats hold the note
  before it reads "We didn't hear a steady note there.", never a gap measured from that note.
- **A first note far late or early**, starting more than two beats after bar 1's first beat or more
  than a quarter of a beat before it, or **do hummed through the count-in**: nothing anchors the take,
  the beats stay where they are written, and a note not heard on its note reads "We didn't hear a
  steady note there.".
- **A note far out of tune, near a written neighbour** (mi sung 150 cents flat, near re): it reads
  "We didn't hear a steady note there.", since the reader cannot tell it from re sung early or late;
  a note far from every written neighbour, such as re sung as fa, reads its gap.
- **A take abandoned** (page hidden, Sing it scrolled away for 600 ms): it counts as a take; no
  feeling question; Start or Start again comes back while takes remain.
- **Singing an octave or two from the written note**: the reader folds each frame, and the line adds
  "You sang it an octave lower: same note." within 50 cents.
- **Holding a note between two written notes**: frames beyond 60 cents take back half their time; the
  line reads the gap ("About a semitone below, nearer a different note.").
- **Effortful after the first tune**: no second tune this visit; it is not drawn, and Play Merc's
  tunes plays both.
- **The Names switch during a take** changes only what is drawn; the reader does not see it.
- **No WebGL**: the Mercs' stills; everything else runs.
- **No storage** (a private window): the quiz seeds and the voice last for the visit, and Step 1's
  toy locks until the choice, since no done mark can be read; nothing breaks.
- **Lesson 16 or 17 not live** where the page is served: its chip stays a plain chip and the recall's
  step links keep their words with no link (FACTS 2, 7).
- **The practice links before item 21 ships**: First Light would open on a first visit; the page is
  not built before it (FACTS 69).
- **Sight-Singing in another key**: the drill writes the key its start screen shows, the app's key,
  C major unless the learner changed it in the Singing tab; the card says "in the key it shows".
- **The Chart's triplets**: some of its bars hold them; the card says they come later (FACTS 71).

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-18/`, and on the kit
parts it adds:

1. **Places in G**: G4 on the treble staff's second line, B4 the middle line, D5 the fourth line; G3
   the bass staff's top space, A3 its top line, B3 the space above, C4 one ledger line above, D4 the
   space over it; G4, B4, D5 three lines in a row and G3, B3, D4 three spaces in a row (FACTS 12 to
   14).
2. **The tunes**: every bar of every two-bar figure adds up to four beats, and the short figures have
   no bar line or time signature; the cold open's tune, tunes A, B and C, and tunes 1 and 2 hold
   LESSON.md's notes in both clefs, tune 1 do re mi so, so mi do (half); no play the learner can hear
   before a take sounds more than three notes of tune 1, or two of tune 2, in order, in either octave
   (FACTS 39, 50).
3. **The range**: every note of G3 to D4 and G4 to D5 at least 2 semitones inside every preset of its
   voice in `VOCAL_RANGES`, with the table's numbers; an octave lower fails four presets; G♯ leaves the
   bass preset 1 (FACTS 51).
4. **Sounds**: every fixed sound's frequency equals `hz(m)` for FACTS 74's notes; the read 13.4 s,
   its names on beats 1, 3, 5 and 7 and do, re, mi and re sung on beats 2, 4, 6 and 8, one, two,
   three and four beats behind their places, with nothing sung after bar 2; Read Merc's way and Step
   1's two reads 12.0 s each; tunes A and B 8.0 s; tune C with the count-in 12.0 s; the four words'
   Dynamics 7.0 s and Staccato and Slur 3.0 s each, in quarter notes at 60 BPM; Step 4's examples
   7.0, 2.0, 3.0, 3.0 and 8.0 s, the note before the breath sounding 0.6 s; the start 5.4 s; each
   Play the start 13.4 s; Merc's tunes 26.4 s; quick check 4 7.0 s; p at 0.3 and f at 1.0 of the
   voice's level (FACTS 75 to 83).
5. **The predict**: the choices are LESSON.md's, "All seven notes, each a beat late" and "Only the
   first four"; the read does not play before a choice; the reveal waits for it heard with sound on;
   a read cut short reveals nothing and leaves the hint; no `next` hint is set; the hints and the
   reveal's first lines, "You said: all seven" and "You said: only four", are LESSON.md's; Read
   Merc's way exists only inside the reveal; `onChoice` unlocks Step 1's toy (FACTS 33, 37).
6. **The recall and quick check**: `l16-q3` and `l17-q1` imported, not copied, once they exist; the
   links open `/learn/16#step-4` and `/learn/17#step-1`; ids `l18-q1` to `l18-q4`, three answers each,
   one right, LESSON.md's words; question 4's button reads "Play", and its clip is so, fa, mi, loud
   then quiet, never the four words' mi, re, do; no feedback line starting "Right", "Yes" or
   "Correct" (FACTS 64, 83).
7. **The in-time reader**, on synthetic takes as `verify18.mjs` runs them in section 8 (FACTS 52, 54):
   - **the anchor**: the take's first run of voice of 0.15 s or more anchors it when it starts between
     a quarter of a beat before bar 1's first beat and two beats after; a shorter run, a run already
     going when the take opens, or a first run outside the span anchors nothing, and no later run
     anchors;
   - **the window**: a note's window opens a quarter of a beat before its first beat and closes a
     quarter after its last, both moved by the anchor; a frame in two windows counts for both;
   - **heard on its note**: at 0.45 s of frames within 60 cents and not at 0.44; a frame outside takes
     back half its time and never below zero; a frame an octave away counts as in;
   - **not heard on its note**: read only from its own beats, anchored, after a 0.15 s attack; under
     0.3 s of voice, a median within 60 cents of a written note up to two places either side, or a
     take with no anchor gives "We didn't hear a steady note there."; otherwise the gap from its own
     note;
   - **the review's cases**: tune 1 sung on pitch a whole beat late reads every note heard on its
     note, with no gap line; with both sos left out and mi coming in 0.1 s early, both sos read "We
     didn't hear a steady note there.";
   - **the rest of section 8**: tune 1 sung 0.2 s early or 1.5 beats late reads as on time; 2.5 beats
     late, or drifting 1.2 beats late, it gives no gap line; mi sung 150 cents flat reads as not heard;
     re sung as fa, on time, reads its gap; an octave lower reads every note heard on its note;
   - **the lines**: a note with no voice in its window does not change the next note's reading; a take
     with no voiced frame in any window reads as no voice; the readings use "the written note",
     Lesson 3's octave line within 50 cents, and the not-steady line; no reading has a count, advice
     or a word on timing.
8. **The flow rule**: the voice before anything plays; the second tune only after Easy or Workable,
   never after Stop here; at most three takes, every take counted; no take after Effortful or
   Uncomfortable; Uncomfortable takes the lines away; Play Merc's tunes only once the singing has
   ended, Stop here included; each tune's Play the start on the no-microphone path, with no tune in
   it; the rest card after Effortful, Uncomfortable and Just listen today, the practice card
   otherwise, after Stop here and with no microphone too (FACTS 56 to 60).
9. **The tunes are never heard before they are read**: no play source on the page sounds tune 1 or
   tune 2, in any octave, before its take has ended or the singing has ended (FACTS 50).
10. **The lock**: before a choice, Step 1's plays are disabled and its names, lag tags and brackets
    undrawn, in the step and in the Wrap's free play; Step 2's toy plays; after the choice Step 1's
    toy plays; with Lesson 18 marked done it opens unlocked before any choice (FACTS 1a).

Page tests, against a local or dev build, never production:

11. The head test (`src/tests/lesson-pages.test.ts`): the title within 60 characters, the description
    over 80 and at most 160 with "A sixteen-minute lesson", the chip "16 minutes" and
    `timeRequired` `PT16M` (`src/tests/lesson-pages.test.ts:154-159`,
    `src/tests/lesson-pages.test.ts:191-210`).
12. No planning text on the page: no topic code such as "S11b" or "T32", no "planned", "slug" or "for
    the team" (`src/e2e/learn-no-planning-text.spec.ts:22-41`). Its pattern for a topic's code now
    takes a lettered code such as S11b too (What the kit and the app still need, item 16).
13. The stage-fit test at the four short landscape sizes, every step's controls on screen with the
    stage stuck (`src/e2e/learn-stage-fit.spec.ts:229-235`).
14. The first-paint budgets for `learn/18.html` (FACTS 86).
15. The claims validator over LESSON.md and WEB-SPEC.md, 0 flagged lines (FACTS, Claims check).
16. **The tour's hold**: on a first visit at the top the welcome tour does not open before the
    predict's choice and opens after it (Toys 1).
17. **Nothing during a take**: from the take's first beat to its end no sound plays, the click
    included, and no pitch line or live readout is drawn; after it the pitch line and the lines appear
    (FACTS 52, 53).
18. **One sound at a time**: a word's play stops the read; a step's play stops a word's; every play
    control is disabled from Start to the take's end.
19. **No background staff** on `learn/18.html` (Lesson 15's test 16).
20. **The lock in the browser**: before the choice, Step 1's toy is locked in the step and in the
    Wrap's free play, and Step 2's plays; with `fyp-done` holding 18, Step 1's toy opens unlocked
    (FACTS 1a).

## Contract

Lesson 1's contract, unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of
GSAP, and practice links that carry `?lesson=18`. Then the layout, accessibility, sound, motion and
storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text children,
touch targets of at least 44 px with no two tap zones overlapping, visible focus, a single dark theme
with every colour a token and an explicit body background, sound only after a tap, the microphone
only after Start, localStorage only for per-viewer conveniences inside try/catch, and the whole page
usable with no sound, no microphone, no WebGL and no storage. The figures' accessible names and every
live region use words only, and every note is spoken with its letter and octave, and its syllable
where one shows. The page stores the quiz seeds and records (`fyp-l18-recall-seed`,
`fyp-l18-recall-v1`, `fyp-l18-seed`, `fyp-l18-quiz-v1`), `fyp-done`
(`src/features/lessons/kit/progress.ts:12-15`), `fyp-voice` (`src/features/lessons/kit/voice-choice.ts:20`),
`fyp-motion` (`src/features/lessons/kit/motion-switch.ts:12`), `fyp-pos`
(`src/features/lessons/kit/position.ts:20`) and `fyp-tour` (`src/features/lessons/kit/tour-gate.ts:29`);
nothing from the toys or Sing it but the voice. Step 1's lock reads the done list and stores nothing
of its own. No frame, reading or answer from Sing it is kept or sent: a take is held in memory until
it is read and then dropped (FACTS 55). The Clef, Names, Count and pitch-line switches hold for the
visit, in memory.

Page QA before publishing adds, for this page, every check against a local or dev build, never
production:

- Every play, switch, bracket, mark and button works by keyboard alone and announces what LESSON.md
  shows.
- The read and the two reads sound and draw as FACTS 35 and 38 say: the names appear on beats 1, 3, 5
  and 7 and the notes sound on beats 2, 4, 6 and 8, the note-by-note read leaves do, mi and so unsung,
  and Merc's way's brackets light as the cursor reaches each pattern.
- Before the choice Step 1's toy is locked, in the step and in the Wrap's free play; once Lesson 18
  is done it opens unlocked.
- A take moves the cursor at 60 BPM in silence and draws nothing until it ends; the lines then match
  what was sung, by ear, with the coach, for a take on the beat, one a whole beat late, which reads
  as on time, one that drifts behind, and one with a note left out, none of them giving a gap line
  measured from another note.
- Tune 1 and tune 2 cannot be heard anywhere on the page before their takes.
- On a real phone at 390 px, the staff, its brackets, the beat grid, the cursor and the lines fit
  Sing it's card, G3 is heard through the speaker, and p and f sound clearly apart.
