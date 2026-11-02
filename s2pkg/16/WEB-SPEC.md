# Lesson 16 web page: spec

The Lesson 16 page is the web lesson for "Sing what you see", Season 2's first voice lesson and its
first sight-singing: a cold open on Tavi's line, a recall from Lessons 9 and 15, written steps on
one main toy, Lesson 15's staff toy, in five step states with free play, a scored checkpoint that
reads two phrases from the learner's own staff, two quizzes and the lesson explorer. Copy is in
[LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is a text-only package: no film
exists for Lesson 16, so the page has no Watch section and the masthead's anchors are Lesson, Sing
and Explorer. It is built on the kit (`src/features/lessons/kit/`) as it stands on main at
`c60f0fdcb`, and like every lesson page it reuses and never copies: a part that lives in an earlier
lesson's module moves into the kit first.

It stands on Season 2's kit work, none of it built yet (SEASON-2 § 6.2 and § 8.2 item 1): the
seasons in the kit, Lesson 15's staff toy (Lesson 15 WEB-SPEC, Toys 1), Lesson 4's staircase moved
into the kit (Lesson 21 WEB-SPEC, What the kit and the app still need, item 6) and Lesson 12's sing
flow moved into the kit (Lesson 15 WEB-SPEC, What the kit and the app still need, item 6). This spec
says only what this page adds to each: the staircase's turn into the staff, Hear it inside, the
Names switch, Tavi's sung notes drawn on the staff, the pitch line drawn after a phrase, and a
scored take that moves a cursor along written notes (What the kit and the app still need).

One object carries the lesson: the staff toy in the learner's clef, with the house on do. In Step 1
Lesson 4's staircase turns into it; in Step 2 one note finds the next; in Step 3 each note lights a
beat before it sounds; in Step 4 do, mi and so stand on three lines or three spaces; in Step 5 the
names go and the house stays; in Sing it the learner reads two phrases from it, and after each
their pitch line is drawn beside it. The card's signature is that path (FACTS 4).

Its public home is `mercurypitch.com/learn/16`: a hand-written document `learn/16.html` with its
module in `src/features/lessons/lesson-16/`. It is a voice lesson, so it is a draft until the vocal
coach signs off its voice lines and its checkpoint (LESSON.md, For the vocal coach), in the draft
list's form (`src/features/lessons/kit/drafts.ts:31-41`). The season orders it after Sight-Singing's
"hear do" start, bass clef, key signature and octave folding (SEASON-2 § 8.2 item 4), and the
season's release starts when it is ready (FACTS 63; Decisions for the owner, 2).

## Look

Season 1's look and Lesson 15's staff, unchanged: the dark listening room, the series colour code,
Lesson 1's type and wordmark, and the motion rules; the staff's lines at 3:1 or more against the
figure, noteheads filled and without stems, chrome at rest and ink while they sound (Lesson 15
WEB-SPEC, Look; FACTS 72). On this page:

- **The house** marks do on every staff, as Lesson 4 marks home: with the house glyph on do's line
  or space, never with a colour (FACTS 17). Gold, which Lesson 15 keeps for a clef's line, is not
  used: on this page the house does that work.
- **Orange `#ff7448`** is Tavi's: her bubble and, in the cold open, the notes she sings, drawn where
  she sang them. **Blue `#58a6ff`** is Merc's: his bubble. On the learner's staff the notes Merc or
  Tavi sing light in the app's target amber `#f59e0b` as they sound, as on Lesson 15's sing-along.
- **The learner's pitch line**, drawn only after a phrase, is the series' violet line against the
  written notes' amber bands, a lane a semitone, as Lesson 9's chart draws a take (FACTS 46).
- **Syllables** sit under the notes in the step toys while Names is on, and under the first phrase
  in Sing it; Names off leaves only the house.
- **No decorative staff or clef anywhere**, as Lesson 15's page sets it out: a staff on screen is
  always music (FACTS 6).

Four things move: the Merc idle loops; the staircase turning into the staff (0.8 s); a note as it
lights; and the cursor moving along the written notes in Sing it. Only Merc and Tavi move on their
own. Under `prefers-reduced-motion` Merc and Tavi stop, the staircase cross-fades into the staff
with no travel, and the cursor jumps from note to note; what the viewer starts still sounds and
lights. For everyone else the masthead's Pause animations toggle stops the same things.

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Season 1's departures kept: the step toys double as the
Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it; the
practice card sits in the Wrap. No Watch section. The page opens in Lesson 2's order (FACTS 5a).
Each section's heading, and the line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Lesson 15's, with "Season 2 · Lesson 16", anchors Lesson, Sing and Explorer, the
   Sound toggle off by default and Pause animations, through `initMasthead` with
   `{ lesson: 16, deck }`. On a first visit its welcome tour waits for the predict's choice
   (Toys 1).
2. **Hero, with the cold open**, laid out as Lesson 2's: the kicker, the hook as the title
   (`<h1 class="hook" id="hook">`), the meta as five chips, the promise and the sound gate from
   LESSON.md.
   The chips are "15 minutes" (FACTS 3), "After Lesson 9: Landing a leap" and "After Lesson 15: The
   staff: where notes sit", each a link to that page that stays a plain chip wherever the lesson is
   not live (FACTS 2), "Sound on" and "Microphone optional". The stage holds Tavi's and Merc's
   bubbles over Merc and Tavi, the treble staff with its five plain notes between them, and under it
   the cold open's two plays, both locked until a choice; the predict card sits under the stage
   (Toys 1). The head:
   - the title, at most 60 characters, "How to sight-sing a melody from the staff | MercuryPitch"
     (56; Decisions for the owner, 1);
   - the description, "Can you sing a tune you've never heard, just by reading it? A fifteen-minute
     lesson with sound toys: find do on the staff, then read and sing." (142), which the head test
     holds to 80 to 160 characters (`src/tests/lesson-pages.test.ts:157-159`) and to the chip's run
     time in words (`:191-210`);
   - og:title and twitter:title "Sing what you see · Find Your Pitch, Lesson 16" (46); og:description
     and twitter:description the hook alone (59);
   - the share card `learn/lesson-16-og.jpg`, 1200 by 630, drawing the cold open's treble staff and
     its five plain notes between Merc and Tavi, with no light, name or house; its alt "The title
     card: Find Your Pitch, Lesson 16, Sing what you see, above a treble staff of five plain notes,
     between Merc and Tavi." (127);
   - the Article's structured data: headline "Sing what you see", `alternativeHeadline` the hook,
     the description, `timeRequired` `PT15M`, position 16, and `teaches` "Finding do on the staff",
     "Relative and absolute pitch", "Hearing a note inside before singing it" and "Reading steps and
     the tonic triad from the staff"; and on release a line in llms.txt: "Lesson 16, Sing what you
     see: find do on the staff, hear each note inside, and read and sing two short phrases."

   None of these names a note to start from or what a reader sings without one (FACTS 1a). Lengths:
   `verify16.py`, section 7.

3. **Recall from Lessons 9 and 15**, straight after the hero, shown to everyone (Toys 5; FACTS 7).
4. **Three words you'll meet**: Sight-singing, Tonic triad, Audiation, each with its figure and play
   (Toys 4).
5. **Steps**: the step deck, five steps, the staff toy stuck beside the text (Toys 2), Step 2's
   mix-up card in its text.
6. **Sing it**: the comfort check, the voice choice and Lesson 15's line, Your turn, the stop line,
   the "What this does" box, the learner's staff, the takes, the reading and "How did that feel?"
   (Toys 6).
7. **Quick check**: four questions (Toys 5).
8. **Wrap**: the three lines, the one-sentence challenge, the practice card in the version Sing it's
   ending picks (Practice links), the next-lesson card with Lesson 17's still (Toys 7), and free play,
   the step toys unlocked.
9. **Explorer**: the season's map with a tab per season, opening on Season 2's.
10. **Footer**: LESSON.md's, with the practice link, the fonts line and "Every sound on this page is
    synthesised in your browser."

## Length

The learner copy is 2,226 words on `node scripts/lesson-words.mjs`, every branch counted (FACTS 3),
under the series' cap of 2,379 by 153. Each step's own text, with its Try, its Notice and any Tavi
line, runs 78 to 118 words, inside 50 to 120 a step. The page runs about 15 minutes: 9.35 of reading
at 238 words a minute and about 5.1 of sound, toys and tasks, with six quiz questions, about 14.5 in
all. The chip is an estimate until the staff toy and the take are timed in their lab (SEASON-2
§ 1.3), and this section says so until then. Five parts carry more, for these reasons:

- **Step 2, 192 words with its mix-up card.** The card sits in the step whose argument refutes it.
- **Sing it, 534 words.** It holds the series' singing lines, Lesson 3's and Lesson 15's word for
  word, which are not cut; Lesson 9's box and lines; the reading's four example lines; Stop here and
  Play the start; and lines of its own (FACTS 36 to 51).
- **The quick check, 282 words.** Four questions with three answers each and a line of feedback for
  every answer, as MASTER-PLAN § 4.2 item 8 asks.
- **The recall, 159 words.** Lessons 9 and 15's questions, word for word.
- **The Wrap, 267 words.** The practice card says what Sight-Singing does today, how to hide its
  pitch line, its care lines and its rest version (FACTS 52 to 58).

The hints and status lines are stage directions in LESSON.md and are not counted, as in every text
package: the predict's hints and its "You said" lines, the stored voice's line, Sing it's status
lines during a take, and the toys' labels and hints. A built page writes them in the open, about 150
words more by Lesson 8's reckoning (Lesson 8 FACTS 4), so the built page would run about 2,376
words, 3 under the cap. The reading's four example lines, 35 words, are not printed on the built
page, since it prints the learner's own, which brings it to about 2,341. If a build still runs over,
it makes these cuts first, 49 words, and every fact they carry stays in FACTS:

1. Step 2's "A 1993 review found the evidence points to it being learned early, up to about age 6
   (Takeuchi and Hulse)." (20 words; FACTS 20), which the step's point does not rest on.
2. Step 3's "And in Lesson 9's study, students who said they imagine sounds vividly tended to sing
   more of their notes in tune. That's a link, not proof that practising helps." (29 words; FACTS
   25), cut whole, since the second sentence is the first one's limit.

The activities are timed from FACTS 66 to 70. Free play is not counted.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                            | New in Lesson 16                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1. Predict and hero staff | The kit's predict (`kit/predict.ts`) with `revealAfter: 'all'`; the tour's hold (`kit/tour-gate.ts`); the staff toy's drawing                                                                     | Tavi's sung notes drawn on the staff where she sang them, orange                                                    |
| 2. The staff toy, steps   | Lesson 15's staff toy (its places, clefs, ledger lines, taps, the pitch-line switch); the house (`kit/home-glyph.ts`)                                                                             | Five step states; the Clef switch on a voice's default; Hear it inside; Names on · off                              |
| 3. The staircase          | Lesson 4's staircase, moved into the kit for Lesson 21 (`lesson-04/stairs-toy.ts`), started on G3 or G4                                                                                           | Turn into the staff: each stair lands on its place                                                                  |
| 4. Three words            | The kit's words strip (`kit/words-strip.ts`) with the page's sound owner                                                                                                                          | Three small staves in the learner's clef                                                                            |
| 5. Recall and quick check | The kit's quiz (`kit/quiz.ts`), its prefix, keys and away links; Lesson 9's question object; Lesson 15's, once built                                                                              | Ids `l16-q1` to `l16-q4`; quick check 4's play                                                                      |
| 6. Sing it                | Lesson 12's sing flow moved into the kit, its comfort check, voice choice and feelings (`kit/comfort.ts`, `kit/voice-choice.ts`); the listener (`kit/listen.ts`); the take reader (`kit/take.ts`) | The cursor take, read note by note; the start sung before each phrase; the pitch line after a phrase; the flow rule |
| 7. Tease still            | The kit's next-lesson card and its slot (`kit/next-card.ts`)                                                                                                                                      | Lesson 17's stage as a still, which plays nothing                                                                   |

### 1. Predict and the hero's staff

The hero's staff is the staff toy's drawing in a fixed state: a treble staff with its clef and five
plain noteheads, G4, A4, B4, A4, G4, no stems, no names, no house, nothing lit, between Merc and
Tavi; it takes no taps (FACTS 32). The kit's predict, as it is: two `.choice` buttons, "A jumble:
with no note, she can't read it" and "The tune, from a note of her own"; two plays, `alone` ("Tavi
sings, no note first") and `note` ("One note first, then Tavi sings"), no free play; `revealOn:
['alone', 'note']` with `revealAfter: 'all'`, so the reveal waits until both have been heard to
their end with sound on (`src/features/lessons/kit/predict.ts:55-59`); the hints from LESSON.md,
`chosen` "Locked in. Play both tries.", `silent` "Sound is off: nothing played. Turn sound on, then
play it again." and `again` "Play either try again.", with no `next`, so the locked-in hint stays
until the reveal; the markup's lock hint, "Choose an answer to unlock Tavi's two tries."; and
`guess` giving "You said: a jumble" or "You said: the tune" (FACTS 35).

- **Tavi sings, no note first** (`alone`): Tavi sings F4, G4, A4, G4, F4 on "ooh", 0.6 s a note;
  as each note sounds an orange notehead appears where she sang it, one place under its written
  note, and stays until the next play (FACTS 33, 66).
- **One note first, then Tavi sings** (`note`): G4 plays alone in the soft tone, lighting the first
  written note, then Tavi sings the five written notes, each orange notehead landing on its written
  note.
- The figure's accessible name is "Treble staff with five notes: G, A, B, A, G"; a polite live region
  says what each try drew: "Tavi sang F, G, A, G, F: each a step under the written note." and "Tavi
  sang G, A, B, A, G: each on its written note."

On a first visit the welcome tour waits for the choice: its step "One step at a time" scrolls to the
steps' stage (`src/features/lessons/kit/tour-copy.ts:44-46`), which would carry a learner past the
predict, so the page holds the tour until a choice through the kit's `holdTour`
(`src/features/lessons/kit/tour-gate.ts:57-69`), with no time limit, as Lessons 15, 21 and 23 do.
The hold matters here: Step 2's text points to the answer, saying what the one note gives and that
Tavi has no absolute pitch, and it sits further down the page on a wide screen, under the recall and
the three words, and one Next from Step 1 in a phone's deck. A learner who goes there unasked has
passed the predict, as on Lesson 21's page. None of the steps' toys plays a line with no note first
or the cold open's line, so the toys need no predict lock (FACTS 1a).

### 2. The staff toy in the steps

Lesson 15's staff toy (`src/features/lessons/kit/staff.ts`, Lesson 15 WEB-SPEC, Toys 1), on the
step deck's stage, in the learner's clef: the clef of the voice stored as `fyp-voice`, the bass for
the lower voice and the treble for the higher, and the bass when none is stored; a **Clef** switch,
Bass · Treble, a radio group of two 44 px buttons, changes it for the visit, and the voice choice in
Sing it sets it from there on (FACTS 8). Do is G: G3 in the bass staff's top space, G4 on the treble
staff's second line, with the house on do's line or space. Taps play a place's note for 0.8 s and
say it ("A3, the top line"); "See it on the pitch line" is on the toy in every state, off by default
(FACTS 8). Five states, with LESSON.md's plays (FACTS 68):

1. **The staircase turns (Step 1).** Toy 3 stands beside the staff, then turns into it: the
   syllables under the notes, the house on do. A tap on the house plays do; a tap on any note plays
   do, then that note, 0.8 s each with 0.2 s between (LESSON.md's Try).
2. **Play do (Step 2).** "Play do" plays do and lights the house's note; the learner hears re
   inside, then taps re to check it, and a tap on any note plays it (LESSON.md's Try).
3. **Hear it inside (Step 3).** A switch, off at first. On, every run of notes lights each note 1.0
   s before it sounds; "Play do to so" plays do, re, mi, fa, so that way, 8.0 s. Off, it plays them
   at 0.6 s onsets, 2.9 s. The switch holds for the visit, in memory, across the steps and free play.
4. **The triad (Step 4).** "Play do, mi, so, mi, do", 2.9 s, and "Play do, mi, then do, so", 2.7 s,
   the third and then the fifth that Step 4's text puts on the staff, line to line and two lines or
   two spaces up, so the leap that opens the second phrase is heard before it is read (FACTS 43);
   with Hear it inside on, each note lights its beat first.
5. **Names (Step 5).** **Names on · off**, a radio group: off hides the syllables under every note
   and keeps the house; on shows them. "Play do to so" and "Play do, mi, so, mi, do" play with the
   names as they are.
6. **Free play (Wrap).** Every state above, with the Clef switch, Hear it inside, Names and the
   pitch-line switch, and no reveal or quiz attached.

No step's play is the cold open's line, G A B A G, or the second phrase, G D B A G, in either
octave: the step toys play do to so, the triad and its turn, do, mi then do, so, and single notes
(FACTS 43). A
learner's taps can play any note, as every staff toy's can.

The steps' figure is `.viz.tall`, as Lesson 15's (FACTS 71): the lower voice's notes reach D4, the
space above the bass staff's first ledger line, inside the toy's range; the treble's G4 to D5 sit
on the staff.

### 3. The staircase

Lesson 4's staircase, moved into the kit (Lesson 21's item; FACTS 16), started on G in the
learner's octave, G3 or G4, its slider and Start lower and Start higher hidden. Five stairs, do to
so, each with its syllable, the third step short (mi to fa, B to C, a semitone). **Play the stairs**
plays do to so in the soft tone, 2.9 s, each stair lighting as it sounds. **Turn into the staff**
turns the staircase 90 degrees onto the staff in 0.8 s, so each stair lands on its line or space,
the short stair too, and then plays the five notes, 3.7 s in all, each lighting its place (FACTS 15).
Under reduced motion the turn is a cross-fade. The stairs keep their names on focus ("Stair 3, mi,
B 3"), as Lesson 4's do. A caption under the figure: "Fig. 1 Do, re, mi, fa, so in G: one stair,
one place."

### 4. Three words

The kit's words strip, a ticket a word with its figure and play, with the page's sound owner. Each
figure is a small staff in the learner's clef (the stored voice, the bass when none), its notes
lighting as they play (FACTS 67): Sight-singing, do in the soft tone, 0.4 s of quiet, then do to so
sung by Merc, or Tavi for a stored higher voice, 4.4 s, so no voice on the page sings written notes
with no note first; Tonic triad, do, mi, so; Audiation, do, then re lit through a silent beat, then
re. No figure has the pitch-line switch, as Lesson 15's word figures have none: the steps play the
same notes beside it.

### 5. Recall and quick check

Two quizzes through the kit's quiz, each with its own prefix and keys.

- **Recall**: Lesson 9's question 2, imported from its questions and filtered by id, `l09-q2`
  (`src/features/lessons/lesson-09/quiz-questions.ts:54-73`), and Lesson 15's question 1, `l15-q1`,
  imported the same way once Lesson 15's page is built; until then its words are LESSON.md's, word
  for word (FACTS 7). Shown to everyone. Prefix `recall-`, keys `fyp-l16-recall-seed` and
  `fyp-l16-recall-v1`; no `lesson`, so it marks nothing done. Step links read "Try Lesson 9, Step 3
  again" and "Try Lesson 15, Step 1 again" and open that page at the step in a new tab, or keep their
  words with no link where the lesson is not live (`linkAway`, `src/features/lessons/kit/quiz.ts:186-212`).
- **Quick check**: LESSON.md's four questions, ids `l16-q1` to `l16-q4`, keys `fyp-l16-seed` and
  `fyp-l16-quiz-v1`, and `lesson: 16`, so answering all four marks Lesson 16 done. Three answers each,
  shuffled from the stored seed, one line of feedback for every answer, "Right." or "Not quite."
  before it (`src/features/lessons/kit/quiz.ts:315`). Question 4's slot holds its play, "Play do,
  then re", in the learner's octave (FACTS 69). Question 3 is the one Lesson 18's recall plans to ask
  word for word (`docs/plans/find-your-pitch/lessons/18-read-a-line/ARTICLE-PLAN.md:45-50`), so
  LESSON.md's wording is the one to carry: it says "places" for the plan's "positions" and "leaps"
  for "skips", and its second answer, "On three neighbouring places, like line, space, line", holds
  in both clefs.

### 6. Sing it

Lesson 12's sing flow as Lesson 15's spec moves it into the kit, with a scored take in place of the
guide: the comfort check, the voice choice and its line, Your turn, the stop line and the "What this
does" box from LESSON.md. Every state has a visible status line that is also announced
(`aria-live="polite"`).

States:

1. **Comfort check**, always first and asked every visit (never stored): Lesson 3's line, its list of
   six conditions and its two buttons (FACTS 36), through the kit's `mountComfort`
   (`src/features/lessons/kit/comfort.ts:159`).
2. **Voice choice**, after either comfort answer: Lesson 3's two buttons with Merc and Tavi's stills
   (`aria-pressed`, at least 44 px), under LESSON.md's line in its two forms, then Lesson 15's line
   under them (FACTS 38). It reads and writes `fyp-voice` (`src/features/lessons/kit/voice-choice.ts:20`).
   With none stored nothing in Sing it plays until a choice; the choice sets the learner's staff, the
   voice that sings, and the steps' clef from then on.
3. **Just listen today**: LESSON.md's line with the doctor lines; **Play Merc's phrases** at once;
   nothing listens, Start is not shown, and nothing asks the viewer to sing (REQ-GVC-021). The Wrap
   shows the rest card (FACTS 37, 52).
4. **Your turn and briefing**: LESSON.md's Your turn, the stop line on its own line, the "What this
   does" box (FACTS 48), and the learner's staff (the staff toy's sing state): the first phrase, do,
   re, mi, re, do, as plain noteheads with their syllables under them and the house on do, in the
   learner's clef and octave (G3 A3 B3 A3 G3 in the bass, G4 A4 B4 A4 G4 in the treble). The staff
   takes no taps and has no pitch-line switch here. **Start** is the only control that asks for the
   microphone (`listen('lesson-16', Sound.context())`).
5. **The start**: with sound on, Start asks for the microphone, then the voice for the chosen
   voice, Merc or Tavi, sings do for 1.0 s, 0.4 s of quiet, then do, mi, so, mi, do, 0.6 s a note
   (4.4 s; FACTS 42), each written do lighting amber as do sounds and the house glowing. No other
   written note lights during the start, so it never shows where mi or so sit in the phrase, which
   would play part of the line. With sound off, Start plays nothing and asks for
   nothing, with the hint "Sound is off, so nothing played. Turn sound on to hear the start, then
   press Start." Sound turned off during the start ends it without counting a take.
6. **The take**: 0.4 s after the start ends, the first note lights, the status reads "Your turn: start
   on do when you're ready.", and Merc and Tavi listen. Nothing plays during a take and the pitch
   line is not drawn (FACTS 46). The take waits up to 8 s for the first voiced frame; from it, the
   cursor reader (below) lights each next note as the voice passes the current one; the take ends as
   the fifth note passes, or at 40 s. The microphone is released when the take ends. The Names switch
   (phrase 2 only) can change during a take: it changes only what is drawn.
7. **After the take**: the staff keeps its notes, and the learner's pitch line is drawn beside it,
   the take's frames as a violet line over the written notes' amber bands, a lane a semitone, folded
   into the written notes' octave with the octave tag where it applies, as Lesson 9's chart draws a
   take (`octaveTag`, `src/features/lessons/kit/band-words.ts:93-99`); under it, one line a note in
   order, from the reading (below). If no voice came within 8 s: Lesson 9's line with this task's
   cue, "We didn't hear you start that time. Start on do when you're ready.", with **Start again**
   while the visit has made fewer than three takes, and no feeling question; after the last take the
   line keeps "We didn't hear you start that time." and drops its cue (FACTS 50).
8. **How did that feel?**: Lesson 3's four answers after each take with voice, an answer that locks,
   through `mountFeelings` (`src/features/lessons/kit/comfort.ts:175`):
   - After the first phrase, Easy or Workable: "Now a line you've never heard, with the names off."
     The staff draws the second phrase, do, so, mi, re, do (G3 D4 B3 A3 G3 or G4 D5 B4 A4 G4), with
     only the house, and a **Names on · off** switch, off; it can be read silently before **Start
     phrase 2**, which runs states 5 to 8 again. Beside it, **Stop here** ends the singing for the
     visit: no second take, the lines stay, **Play Merc's phrases** shows, and the Wrap keeps the
     practice card, since stopping reports no effort (FACTS 49).
   - After the second, Easy or Workable: "Two phrases from the page, each found from do." and **Play
     Merc's phrases**. The Wrap shows the practice card.
   - Effortful: no more phrases, Lesson 3's "Keep it gentle: rest before you sing again.", the lines
     stay; **Play Merc's phrases**; the Wrap shows the rest card (`restAfterEffort`).
   - Uncomfortable: the lines and the pitch line are taken away, Lesson 3's "Thanks for saying so.
     That's enough singing for today: rest your voice." with the doctor lines; **Play Merc's
     phrases**; the Wrap shows the rest card (REQ-GVC-023, REQ-GVC-055).
   - Once "Effortful" or "Uncomfortable" has been answered, no further take and the rest card stay
     so for the visit, in memory (`VisitEnding`, `src/features/lessons/kit/comfort.ts:101-114`).
9. **No microphone** (refused, no device, or the listener failed to load): LESSON.md's "No
   microphone?" line, both phrases drawn, the first with its names, **Play the start**, which sings
   do, then do, mi, so, mi, do in the chosen voice, 4.4 s, and no phrase, so a learner singing with
   nothing listening still hears do first, and **Play Merc's phrases**; the Wrap keeps the practice
   card (FACTS 51). Without Web Audio, Sing it offers this path at once, and
   Play Merc's phrases lights the notes in silence with "This browser can't play sound here."

**Play Merc's phrases** appears only once the singing has ended (after the second phrase's answer,
Stop here, an Effortful or Uncomfortable answer, Just listen today, the visit's last take, or no
microphone),
so the second phrase is never heard before it is read. It sings the start, then both phrases in the
chosen voice, each note lighting amber as it sounds, 12.0 s (FACTS 70).

The retry rules, all in the flow rule below (FACTS 50):

- A visit allows at most three takes. Every take counts: one with no voice, one with no steady
  note, and one abandoned when the page was hidden.
- The second phrase only after Easy or Workable on the first, and never after Stop here; no Again
  for either phrase.
- Never another take after "Effortful" or "Uncomfortable".
- No reading line invites another try (FACTS 47), so no retry wording shows without a retry control.

The flow is a pure rule (`lesson-16/sing-flow.ts`), as Lesson 9's is: from the comfort answer, the
voice, whether sound and Web Audio are on, the takes so far (how many, which phrase each read,
whether each had voice and whether it was abandoned) and the answers so far (the latest, and whether
"Effortful" or "Uncomfortable" was ever answered, and whether Stop here was pressed), it gives the
state, the controls shown, the lines,
whether Play Merc's phrases shows and the Wrap's card, so every branch is unit-tested without a
microphone (Tests, 8).

**The cursor reader** (`kit/read-along.ts`, new, pure and unit-tested; What the kit and the app still
need, item 6):

- Input: the take's frames as they arrive (`takeFrames`'s `onFrame`), and the written notes as MIDI
  notes in order. A frame is voiced when Voice Mirror's `preprocess` keeps it, as `readTake` takes
  them.
- The current note starts at the take's first voiced frame. Each frame's distance from the current
  note is folded into one octave (`foldCents`, `src/lib/pitch-measurements/f0.ts:57-59`). A frame
  within 60 cents adds its time to the note's hold; a frame outside, or with no voice, takes back half
  its time, never below zero: Sight-Singing's rule (`src/features/exercises/sight-singing/use-sight-singing-controller.ts:199-202`).
  At 0.45 s of hold the note passes and the next lights; at 8 s from the note's start the next lights
  anyway (FACTS 45). The take ends when the last note passes or moves on.
- Each note's reading: a note passed by its hold is read from the frames that counted towards it, as
  their median folded distance, with the octave they sat in; a note the 8 s limit moved past is read
  by `readTake` over its frames, after the 0.3 s attack and with 0.6 s of steady voice needed, which
  gives the not-steady line where there is too little (FACTS 47).
- Each line is the rung line with the note's syllable and "the written note": "Re · In the band: 20
  cents below the written note.", "Right in the middle" within 15 cents, with Lesson 3's octave line
  within 50 cents of the note an octave or more away, or "Do · We didn't hear a steady note there."
  (`rungLine`, `src/features/lessons/kit/take.ts:280-287`, given whose note it is). No count, no
  score and no celebration on a note.

On a phone the staff and its lines fit the card at 344 to 390 px: five notes at 52 px apart on a 26
px staff space (FACTS 71), the lines under it wrapping, and the pitch line below the staff at full
width, 160 px tall.

### 7. Tease still

The drawing in the next-lesson card's slot, the page's `[data-next-card]` mark: an SVG,
`aria-hidden`, of Lesson 17's stage before its first play, Lesson 8's four beat pads numbered 1 to
4, an empty line above them and an empty stopwatch strip under them, nothing written and nothing lit
(FACTS 5). It holds no button, since the card is a link, does not move and plays no sound. Its
styles go under a class of its own, not the tease line's `.next-tease`.

## Audio

Every sound is synthesised in the page with Web Audio, through the kit's sound module, its master
bus and its house envelopes, and started only by a tap: a played note, the staircase and the toys'
plays in the soft tone; Merc's and Tavi's singing in Merc's "ooh", Tavi's an octave up (FACTS 64 to
70). Nothing autoplays, and the page has no music bed.

- **The sound rules**, for every source of sound on the page (the cold open's tries, the three
  words, every play and tap of the staff toy and the staircase, quick check 4's play, Sing it's start
  and Merc's phrases):
  1. One sound plays at a time, across the whole page: a new play stops the one before.
  2. Leaving a step, by any route, stops its sound and any queued play; scrolling Sing it off screen
     for 600 ms, or hiding the page, stops what plays there and abandons a take.
  3. A play that is cut short never counts as heard by the predict.
  4. Nothing plays during a take: every play control is disabled from Start until the take ends.

  The kit has the helpers: the page-wide owner (`NowPlaying`, `src/features/lessons/kit/now-playing.ts:39`),
  which every source registers with, and the words strip already takes it.

- **A run of notes** is timed from one start, every note on its own timer from the play's start, so
  the drawing and the sound share one clock. Hear it inside's silent beat is part of that schedule,
  each note lit 1.0 s before its onset.
- **Merc's and Tavi's lines** (the cold open's tries, the start, Merc's phrases) are one voice along
  a contour, held and glided on the audio clock (`src/features/lessons/kit/sound.ts:16-21`), with
  their notes 0.6 s apart.
- **No low notes.** The page's lowest sound is G3, 196 Hz, which a phone's speaker carries.

## Merc and Tavi

Lesson 1's setup through the kit (`src/features/lessons/kit/merc-duo.ts`): the app's renderer loaded
after first paint, one WebGL context per Merc, medium quality on phones, paused off screen, and the
stills when WebGL fails.

- They live in the hero, on either side of the staff. Tavi asks and Merc answers in the bubbles. While
  Tavi sings a try, her Merc sings (`mercSing`, `src/features/lessons/kit/merc-duo.ts:165`) and Merc
  listens (`mercListen`, `:207`). Tavi celebrates once as the reveal shows, quietly, with no sparkles,
  since the reveal calls no choice right (`mercCelebrate`, `:217`; `MercDuoOptions`, `:119`).
- In Sing it the singing Merc appears as a still beside the learner's staff: Merc for the lower voice,
  Tavi for the higher. During a take both listen; nothing celebrates a note.
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Sight-Singing.** The link is `/pitch-training?lesson=16`, printed
  "mercurypitch.com/pitch-training", with "then tap Sight-Singing", in Lesson 9's form (FACTS 60, 62).
  The card says what the drill does at `c60f0fdcb` (FACTS 54 to 58): six notes it picks itself, in
  the key its start screen shows and the saved range, which it asks the learner to set first;
  nothing played first; the treble clef only, a lower voice reading below it on ledger lines; the
  written octave; and its names. It names notes in six places, four of them on its pitch tracker,
  which its round button at the top right hides; that choice is remembered for every drill, so the
  card does not suggest it and says only "It prints each note's name under it: read the staff, not
  the names." (FACTS 58). The
  drill is free (FACTS 62). It is the season plan's link for this lesson, with its limits said
  (SEASON-2 § 5.1).
- **The rest version.** After "Effortful", "Uncomfortable" or "Just listen today" the card shows
  Lesson 12's form, "Rest today. Sight-Singing will be here when your voice feels comfortable:
  mercurypitch.com/pitch-training, then tap Sight-Singing.", and is no longer a link, since the drill
  asks for the voice (FACTS 52).
- **The first visit.** The page is not built before SEASON-2 § 5.2 item 21 widens the lesson marker,
  so `?lesson=16` steps First Light aside and the card and footer have no first-visit line (FACTS 60).
- **Needed: Sight-Singing for the lessons** (SEASON-2 § 5.2 item 10; FACTS 63), the app's work:
  - (a) **Fixed phrases**, data: a launch's `notes` already replace the random round when there are
    two or more, and a link's notes are fitted to the saved range by whole octaves, the octave nearest
    the range's middle winning (FACTS 59). Proposed: one entry, `sing-what-you-see`, holding the two
    phrases as one ten-note line, G4 A4 B4 A4 G4 G4 D5 B4 A4 G4, so both phrases stay in one octave.
    Today's fit would give the baritone and tenor presets G3 to D4, the higher presets G4 to D5, and
    the bass preset G2 to D3, an octave under the page's lower line: with the bass clef (c), do
    would sit on the bass staff's bottom line, not in the top space the page and quick check 2
    teach. Written in the bass octave, the line still goes to G2 for the bass, and two separate
    entries would part, the first at G3 and the second at G2 (FACTS 59). So the item asks for a
    fixed-phrase link that skips the octave fit and writes the line in the octave of the singer's
    voice: G3 to D4 for a lower preset, G4 to D5 for a higher one. A ten-note line also needs the
    drill to show a phrase break, or the card says "two phrases, one after the other".
  - (b) a **"hear do" start** that plays do and do, mi, so, mi, do before the first note;
  - (c) the **bass clef** for lower voices;
  - (d) a **key signature and spelling by key**, needed here only once a lesson reads in a key with
    sharps or flats;
  - (e) **names off**, which needs to hide the letters under the notes and the hold bar's "Hold G4
    to continue": the other four names, the target line's label, the next two upcoming notes'
    labels, the live dot's label and the tracker's side labels, go with the tracker's own hide
    (FACTS 58). The item lists the first;
  - (f) **octave-folded scoring**;
  - (g) a **`key` launch field**.
- **The card once (a), (b), (c), (e) and (f) ship**, proposed: "Sight-Singing writes this page's two
  phrases on your own clef. It sings do and do, mi, so, mi, do first, then you read and sing, in any
  octave; hold each note to light the next. Turn the names off to read from the house." with the
  care lines, and the address "Practise it free: mercurypitch.com/exercises/sing-what-you-see". Each
  new sentence waits for its item; until all ship, the card keeps today's sentences for the rest.
- Not linked: no premium exercise. Sight-Singing is free, an always-available card that the
  premium switch does not gate (FACTS 62).

## Explorer and season data

Lesson 16's entry, proposed for Season 2's data in its own module, in Season 1's entry form
(Lesson 9's, `src/features/lessons/kit/season.ts:326-344`):

- `n: 16`, `lane: 'voice'`, `title: 'Sing what you see'`, `short: 'Sight-singing'`,
  `topics: ['S11a']`, with S11a's name as SEASON-2 § 4.1 gives it; the hook word for word (FACTS
  1); `minutes: 15` and `page: '/learn/16'` once the page is built, under the drafts' comment,
  `// A draft until its sign-off (drafts.ts), as Lesson 3 is.`
- `pr.link`: `href` `/pitch-training?lesson=16`, `addr` `mercurypitch.com/pitch-training`, `label`
  "Exercises" and `note` "then tap Sight-Singing", as Lesson 9's (FACTS 60). `pr.needs`, "Sight-Singing
  for the lessons: fixed phrases, a hear-do start, the bass clef, names off and octave-folded scoring
  (SEASON-2 § 5.2 item 10)", which is "Admin only, never drawn on a lesson page"
  (`src/features/lessons/kit/season.ts:102-103`).
- `EDGES` gains [9, 16], a cross-season edge, and [15, 16], as SEASON-2 § 4.3 gives them (FACTS 2);
  Lesson 16's prerequisite list is then [9, 15] (`PREREQ`, `src/features/lessons/kit/season.ts:452-458`).
- The tease on Lesson 15's card is this lesson's, set on Lesson 16 in the lesson copy: `tease` "Five
  notes on the staff. Tavi has never heard them.", `teaseAlts`
  `[{ id: 'any-note', text: 'Now you can see where any note sits.' }]`, with the variant's team note
  (FACTS 5b). The tease on this page's
  card is Lesson 17's, set on Lesson 17: "Same written bar, played twice. Only the tempo changes.",
  with the alternative `shapes` (FACTS 5).
- The signature line for the admin console, from the card (FACTS 4): "Lesson 4's staircase turns
  into the staff with the house on do; each note lights a beat before it sounds, and the names fade
  until only the house is left."
- The explorer's card reads "Ready · read" with "15 min" once the page is live.

## What the kit and the app still need

Found in the kit and the app as they stand on main at `c60f0fdcb`. Every item is proposed.

1. **The lesson host**: `learn/16.html` at `/learn/16`, which every build takes as a lesson page
   (`lessonPages`, `tools/draft-lessons.ts:82`); `/learn/16` and `/learn/16.html` in
   `STANDALONE_DOCUMENT_PATHS` (`src/lib/sw-runtime.ts:93`); the first-paint budgets (FACTS 73). The
   lesson pages' route already takes any two digits (`LESSON_PAGE`, `src/lesson-gate.ts:134`).
2. **The draft line**, in the draft list's form:
   `16: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`, as Lesson 9's
   (`src/features/lessons/kit/drafts.ts:31-41`).
3. **Seasons in the kit** (SEASON-2 § 6.2 item 1), as Lesson 15's spec sets them out.
4. **The staff toy** (Lesson 15's item 4), with this page's options: the Clef switch on the stored
   voice; **Hear it inside**, a play option that lights each note 1.0 s before its onset; **Names on ·
   off**, which hides the syllables and keeps the house; **drawn notes in a colour** at a sounded
   pitch, for Tavi's tries (a notehead at the place of the pitch sung, orange); **a fixed state**
   that takes no taps, for the hero and Sing it; and **the take's pitch line**, a lane a semitone
   beside the staff, drawing a take's frames after it ends.
5. **Lesson 4's staircase in the kit** (Lesson 21's item 6), with its **turn into the staff**: the
   stairs rotate onto the staff toy's places in 0.8 s, from a start on G3 or G4.
6. **The sing flow in the kit** (Lesson 15's item 6), and a **scored take that reads along written
   notes**:
   - `kit/read-along.ts`, new: the cursor reader (Toys 6), pure, with its tests;
   - `TakeOptions` gains `until`, a test run each frame that ends the take with its frames, as `quiet`
     does, so a take can end as its last note passes (`src/features/lessons/kit/listen.ts:89-110`);
     today a take ends only by its `run`, its `quiet` or a cancel that keeps nothing;
   - `rungLine` and the reading's words take whose note it is, passed through to `gapWords`, which
     already takes it (`src/features/lessons/kit/band-words.ts:56-61`), so each line can name the
     written note (`src/features/lessons/kit/take.ts:280-287`, `:89-95`);
   - the start sung before each take, in the chosen voice.
7. **No decorative staff** (Lesson 15's item 7).
8. **The lesson copy**: this lesson's tease and its variant set on Lesson 16, with the variant's team
   note (Lesson 15's item 8; FACTS 5b), within `TEASE_MAX` (`src/features/lessons/kit/lesson-copy.ts:76`):
   51 and 36 characters.
9. **Season 2 in the app's lesson plumbing** (SEASON-2 § 5.2 item 21), the app's work: the lesson
   marker's range, so `?lesson=16` steps First Light aside (FACTS 60), and the lesson-answer bounds,
   which refuse Lesson 16's answers whole today (FACTS 61).
10. **Sight-Singing for the lessons** (SEASON-2 § 5.2 item 10), the app's work (Practice links), with
    (a) a fixed-phrase link that skips the octave fit, so each voice reads its own octave (FACTS
    59), and (e) names off covering the letters under the notes and the hold bar's name, since the
    tracker's own hide covers its four (FACTS 58).
11. **The head and the share card** (Sections, 2): the title, the descriptions, the share card
    `learn/lesson-16-og.jpg` and its alt, and the structured data with `timeRequired` `PT15M`.
12. **Lesson 15's questions as a module** (`lesson-15/quiz-questions.ts`), so this page imports
    `l15-q1` (Toys 5).

## Decisions for the owner

1. **The page's title.** SEARCH.md § 4 has no Season 2 drafts. Recommended: "How to sight-sing a
   melody from the staff | MercuryPitch" (56), in the query-led form the owner chose on 22 October
   2026, with the words people type, "sight-sing", "melody" and "staff". The alternative,
   "Sight-singing for beginners | MercuryPitch" (42), is shorter and names the audience. Neither
   names a note to start from or perfect pitch (FACTS 1a).
2. **Release after Sight-Singing's work, or before.** Recommended: as the season orders it, after
   SEASON-2 § 5.2 item 10's (b), (c), (d) and (f) and item 21, so the practice card can send each
   learner to their own clef with do first, and every quiz answer is kept. The page as written is
   ready for either: today's card states the drill's limits, and the shrunk card is written
   (Practice links; FACTS 63).

## Edge cases

- **Sound off, unset or missing.** Every play obeys the kit's `canPlay`. The predict's reveal waits
  for both tries heard with sound on; Start waits for sound (Toys 6). With no Web Audio the page stays
  readable, every play runs its visuals in silence with its hint, and Sing it offers the
  no-microphone path.
- **Before a choice** both tries are locked and the reveal hidden; the stage plays nothing.
- **One try heard, the other not**: the hint stays `chosen`, "Locked in. Play both tries."; the reveal
  waits for the other.
- **A try cut short** (another sound, a step link, leaving the hero): not heard, no reveal, the hint
  as it was; its orange notes stay drawn until the next play.
- **Reduced motion**: the staircase cross-fades into the staff; the cursor jumps; nothing travels.
- **A first visit that never chooses**: the welcome tour waits, and the next lesson page opened at
  the top offers it again; "Tour this page" runs it at once (Toys 1).
- **No voice chosen**: the steps' staff shows the bass clef; nothing in Sing it plays until a voice
  is chosen. A stored voice opens on its own clef.
- **The Clef switch in the steps** changes the clef for the visit until Sing it's voice choice;
  switched mid-play it stops the play.
- **The microphone refused** at Start: the no-microphone path, with Play the start and Play Merc's
  phrases; no take is counted.
- **No microphone, and singing anyway**: Play the start gives do and the triad, as Start would, and
  nothing listens; it can be played again, and Play Merc's phrases checks both phrases after.
- **Stop here after the first phrase**: no second take this visit; the second phrase stays unheard
  until Play Merc's phrases, which plays both; the Wrap keeps the practice card.
- **A take with no voice in 8 s**: the no-voice line with Start again while takes remain; no feeling
  question (Toys 6, state 7).
- **A take that stops mid-phrase**: each remaining note moves on after 8 s and reads "We didn't hear a
  steady note there."; the take ends at the fifth note or 40 s, then How did that feel? asks, as for
  any take with voice.
- **A take abandoned** (page hidden, Sing it scrolled away for 600 ms): it counts as a take; no
  feeling question; Start or Start again comes back while takes remain.
- **Singing an octave or two from the written note**: the reader folds each frame, so the cursor moves
  as it would in the written octave, and the line adds "You sang it an octave lower: same note."
  within 50 cents.
- **Holding a note between two written notes**: frames beyond 60 cents take back half their time, so
  the cursor waits; after 8 s it moves on and the line reads the gap ("About a semitone below,
  nearer a different note.").
- **Effortful after the first phrase**: no second phrase this visit; the second phrase is not drawn,
  and Play Merc's phrases plays both.
- **The Names switch during the second take** changes only what is drawn; the reader does not see it.
- **No WebGL**: the Mercs' stills; everything else runs.
- **No storage** (a private window): the quiz seeds and the voice last for the visit; nothing breaks.
- **Lesson 9 or 15 not live** where the page is served: its chip stays a plain chip and the recall's
  step links keep their words with no link (FACTS 2, 7).
- **The practice link before item 21 ships**: First Light would open on a first visit; the page is not
  built before it (FACTS 60).
- **Sight-Singing in another key**: the drill writes the key its start screen shows, the app's key,
  C major unless the learner changed it in the Singing tab; the card says "in the key it shows".
- **Sight-Singing's tracker hidden**: the choice is kept on the device, so a learner who hides it for
  this card finds it hidden in every drill that shows the tracker, until Show Tracker brings it
  back; the drill says so with that button (FACTS 58).

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-16/`, and on the kit
parts it adds:

1. **Places in G**: G4 on the treble staff's second line, A4 the second space, B4 the middle line, C5
   the third space, D5 the fourth line; G3 the bass staff's top space, A3 its top line, B3 the space
   above, C4 one ledger line above, D4 the space over it; G4, B4, D5 three lines in a row and G3, B3,
   D4 three spaces in a row (FACTS 12 to 14).
2. **Intervals**: G to A and A to B 2 semitones, B to C 1, G to B 4, B to D 3, G to D 7; Tavi's no-note
   try F4 G4 A4 G4 F4 keeps the line's steps, each note one place under its written note (FACTS 14,
   33).
3. **The range**: every note of G3 to D4 and G4 to D5 at least 2 semitones inside every preset of its
   voice in `VOCAL_RANGES`, with the table's numbers; an octave lower fails four presets; G♯ leaves the
   bass preset 1 (FACTS 44).
4. **Sounds**: every fixed sound's frequency equals `hz(m)` for FACTS 64's notes; the tries 3.0 s and
   4.4 s; the Sight-singing word 4.4 s, its do in the soft tone before the voice; the stairs 2.9 s
   and 3.7 s, Hear it inside 8.0 s, the triad 2.9 s, do, mi then do, so 2.7 s, quick check 4 2.6 s,
   the start 4.4 s, Play the start 4.4 s, Merc's phrases 12.0 s (FACTS 66 to 70). No play in which
   a voice sings written notes starts without do first.
5. **The predict**: neither try plays before a choice; the reveal waits for both heard with sound on;
   a try cut short reveals nothing and leaves the hint; no `next` hint is set; the hints and guesses
   are LESSON.md's (FACTS 35).
6. **The recall and quick check**: `l09-q2` imported, not copied, and `l15-q1` once it exists; the
   links open `/learn/09#step-3` and `/learn/15#step-1`; ids `l16-q1` to `l16-q4`, three answers each,
   one right, LESSON.md's words, quick check 3's word for word, since Lesson 18 asks it, and no
   feedback line starting "Right", "Yes" or "Correct".
7. **The cursor reader**: a note passes at 0.45 s of frames within 60 cents and not at 0.44; a frame
   outside takes back half its time and never below zero; a frame an octave away counts as in; at 8 s
   the next note lights; a take with no voiced frame reads as no voice; the readings use "the written
   note", Lesson 3's octave line within 50 cents, and the not-steady line; no reading has a count or
   advice (FACTS 45, 47).
8. **The flow rule**: the voice before anything plays; the second phrase only after Easy or Workable,
   never after Stop here; at most three takes, every take counted; no take after Effortful or
   Uncomfortable; Uncomfortable takes the lines away; Play Merc's phrases only once the singing has
   ended, Stop here included; Play the start on the no-microphone path, with no phrase in it; the
   rest card after Effortful, Uncomfortable and Just listen today, the practice card otherwise,
   after Stop here and with no microphone too (FACTS 49 to 52).
9. **The second phrase is never heard before it is read**: no play source on the page sounds G D B A
   G, in any octave, before the second take has ended or the singing has ended (FACTS 43).

Page tests, against a local or dev build, never production:

10. The head test (`src/tests/lesson-pages.test.ts`): the title within 60 characters, the description
    80 to 160 with "A fifteen-minute lesson", the chip "15 minutes" and `timeRequired` `PT15M`
    (`:154-159`, `:191-210`).
11. No planning text on the page: no topic code such as "S11a", no "planned", "slug" or "for the team"
    (`src/e2e/learn-no-planning-text.spec.ts:22-40`).
12. The stage-fit test at the four short landscape sizes, every step's controls on screen with the
    stage stuck (`src/e2e/learn-stage-fit.spec.ts:229-235`).
13. The first-paint budgets for `learn/16.html` (FACTS 73).
14. The claims validator over LESSON.md and WEB-SPEC.md, 0 flagged lines (FACTS, Claims check).
15. **The tour's hold**: on a first visit at the top the welcome tour does not open before the
    predict's choice and opens after it (Toys 1).
16. **No pitch line during a take**: from Start to the take's end no pitch line or live readout is
    drawn, and after it the pitch line and the lines appear (FACTS 46).
17. **One sound at a time**: a word's play stops a try; a try stops a step's play; every play control
    is disabled during a take.
18. **No background staff** on `learn/16.html` (Lesson 15's test 16).

## Contract

Lesson 1's contract, unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of
GSAP, and practice links that carry `?lesson=16`. Then the layout, accessibility, sound, motion and
storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text children,
touch targets of at least 44 px with no two tap zones overlapping, visible focus, a single dark theme
with every colour a token and an explicit body background, sound only after a tap, the microphone
only after Start, localStorage only for per-viewer conveniences inside try/catch, and the whole page
usable with no sound, no microphone, no WebGL and no storage. The figures' accessible names and every
live region use words only, and every note is spoken with its letter and octave, and its syllable
where one shows. The page stores the quiz seeds and records (`fyp-l16-recall-seed`,
`fyp-l16-recall-v1`, `fyp-l16-seed`, `fyp-l16-quiz-v1`), `fyp-done`
(`src/features/lessons/kit/progress.ts:12-15`), `fyp-voice` (`src/features/lessons/kit/voice-choice.ts:20`),
`fyp-motion` (`src/features/lessons/kit/motion-switch.ts:12`), `fyp-pos`
(`src/features/lessons/kit/position.ts:20`) and `fyp-tour` (`src/features/lessons/kit/tour-gate.ts:29`);
nothing from the toys or Sing it but the voice. No frame, reading or answer from Sing it is kept or
sent: a take is held in memory until it is read and then dropped (FACTS 48). The Clef, Names, Hear it
inside and pitch-line switches hold for the visit, in memory.

Page QA before publishing adds, for this page, every check against a local or dev build, never
production:

- Every play, switch and button works by keyboard alone and announces what LESSON.md shows.
- The two tries sound and draw as FACTS 33 says, the orange notes one place under and then on.
- A take moves the cursor as the voice holds each note, in the singer's own octave, and draws nothing
  until it ends; the lines then match what was sung, by ear, with the coach.
- The second phrase cannot be heard anywhere on the page before its take.
- On a real phone at 390 px, the staff, the cursor and the lines fit Sing it's card, and G3 is heard
  through the speaker.
