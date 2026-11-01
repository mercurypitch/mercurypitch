# Lesson 15 web page: spec

The Lesson 15 page is the web lesson for "The staff: where notes sit", Season 2's first: written
steps, one main toy in six step states with free play, a cold open on the hero's pitch line that
folds into a staff, one predict, an unscored sing-along on the learner's own staff, two quizzes (the
recall and the quick check) and the lesson explorer. Copy is in [LESSON.md](LESSON.md); every claim
is in [FACTS.md](FACTS.md). It is a text-only package: no film exists for Lesson 15, so the page has
no Watch section and the masthead's anchors are Lesson, Sing and Explorer. It is built on the kit
(`src/features/lessons/kit/`) as it stands on main at `c60f0fdcb`, and like Lessons 2 to 12 it
reuses and never copies: a part that still lives in an earlier lesson's module moves into the kit
first.

Two parts it needs are Season 2's own, listed in SEASON-2 § 6.2 and not built yet, so this spec
says what the page needs from each (What the kit and the app still need, items 3 and 4):

- **Seasons** (§ 6.2 item 1): the kit is Season 1 throughout, from the season data's name to the
  masthead's constant (`src/features/lessons/kit/season.ts:1-3`;
  `src/features/lessons/kit/lesson-menu.ts:111`), and this page is Season 2's first.
- **The staff toy** (§ 6.2 item 2): the stats site's engraving as a page toy, with the F clef the
  kit lacks (`src/features/lessons/kit/glyphs.ts:10`), the house on do, a "See it on the pitch
  line" switch and play on every example. Lesson 15 is its first page, so this spec gives its
  first form (Toys 1).

Where this page shares a behaviour with Lesson 12's Sing it (the comfort check, the voice choice,
"How did that feel?", the guide that waits for Merc's notes), it is Lesson 12's, as built
(`src/features/lessons/lesson-12/sing-flow.ts:1-41`), unless this spec says otherwise: the guide
is drawn on the staff, there is no Move do, and the rest card keeps the practice link, as Lesson
8's does (Toys 5).

One object carries the lesson across its steps: the staff toy (Toys 1), Season 1's pitch line
folded into a staff. In the hero the pitch line's black-key lanes fold away and its white-key lanes
close up into five lines (Toys 2); in Step 1 the treble staff names its nine places from the clef's
line; in Step 2 the pitch line comes back beside it, so a step of one letter shows as one lane or
two; in Step 3 a note climbs past the edges and draws its ledger lines; in Step 4 the clef switches
and the same line names another note; in Step 5 a second staff joins it, Lesson 1's keyboard slides
under the two, and they meet at middle C. In Sing it the learner's own staff lights do, re, mi, fa
and so as they sound. The card's signature is that path (FACTS 4, 37), and playbook rule 6 asks
for one object.

Its public home is `mercurypitch.com/learn/15` (FACTS 9): a hand-written document `learn/15.html`
with its module in `src/features/lessons/lesson-15/`, wired as Lesson 12's page is
(`src/features/lessons/lesson-12/main.ts`): a written lesson with no film, its cold open before its
recall, a recall shown to everyone and a sing-along with no microphone. It is published only after
the vocal coach has looked at its voice lines (LESSON.md, For the vocal coach), and until then it
is a draft, in the draft list's form (`src/features/lessons/kit/drafts.ts:29-41`): the site worker
holds a draft back on mercurypitch.com and every build carries its page
(`tools/draft-lessons.ts:8-14`). Its prerequisite, Lesson 2, is live, so nothing else holds it
(FACTS 2, 7). The release follows Lesson 16, not Lesson 15, since the two open the season together
and Lesson 16 waits on app work (SEASON-2 § 7 item 6).

## Look

Season 1's look, unchanged: the dark listening room, the series colour code, Lesson 1's type and
wordmark, and the motion rules. On this page:

- **The staff's lines** are ink at a contrast of 3:1 or more against the figure's background at
  every stop of its gradient, as the series asks of any graphical object (FACTS 72): never the
  stats snippet's faint default. Ledger lines take the same weight and colour, a little wider than
  a notehead. The line weight is a token of the staff toy, checked on a real phone at 390 px (Tests).
- **Noteheads** are filled, without stems (note lengths wait for Lesson 17), chrome `#c3ccd6` at
  rest and ink `#e6edf3`, lit, while their note sounds. Sharps and flats sit to the note's left
  (FACTS 23).
- **Gold `#ffd84d` marks only the line a clef names**, G4 on the treble staff and F3 on the bass
  staff, while a step explains it, with the letter beside it, so the mark never rests on colour
  alone. It is the series' gold for the fit, "things that line up"
  (`docs/plans/find-your-pitch/MASTER-PLAN.md:196`): on that line the clef's curl or dots, the line
  and the note's letter line up. Nothing else on the page is gold.
- **Blue `#58a6ff` and orange `#ff7448`** are Merc and Tavi's own: their bubbles, Merc's sung F3 on
  the bass staff in Step 4, and in Sing it the still of the Merc who sings. The sing-along's notes
  light in the app's target amber `#f59e0b` while the voice sings them, and on the learner's turn
  the staff is plain chrome under a chrome sweep, as Lessons 2, 4, 6, 10 and 12's guides are.
- **The pitch line** keeps Season 1's look: a lane a semitone, the white-key lanes chrome and the
  black-key lanes fainter (FACTS 33).
- **No decorative staff or clef anywhere.** Season 1's section heads carry a faint staff with an
  engraved G clef (`learn/12.html:551-552`; `src/features/lessons/kit/lesson-base.css:397-440`),
  which every page's module engraves (`engraveClefs`,
  `src/features/lessons/kit/page-chrome.ts:161-175`, called at `src/features/lessons/lesson-12/main.ts:85`),
  and the body's background tiles a fainter one down every page, five 1 px lines 9 px apart every
  168 px (`src/features/lessons/kit/lesson-base.css:128-157`). This page has none of them: in a
  lesson that teaches the staff, a staff on screen is always music (SEASON-2 § 1.5 item 7; FACTS 6;
  What the kit and the app still need, item 7).

Four things move: the Merc idle loops; the fold (0.8 s); a note as it lands on its place, or as it
moves in Step 3; and the keyboard sliding in under the grand staff in Step 5. Only Merc and Tavi
move on their own. Under `prefers-reduced-motion` Merc and Tavi stop, the fold cross-fades from the lanes to
the lines with no travel, notes appear in place, and the keyboard is simply there; what the viewer
starts still sounds, and the notes still light as they sound. For everyone else the masthead's
Pause animations toggle stops the same things (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Season 1's departures kept: the step toys double as the
Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it; the
practice card sits in the Wrap. No Watch section. The page opens in Lesson 2's order: the hook, the
stage, the sound gate and the cold open's predict, then the recall (FACTS 5a). Each section's
heading, and the line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Lesson 12's, with "Season 2 · Lesson 15", anchors Lesson, Sing and Explorer, the
   Sound toggle off by default and Pause animations, through `initMasthead`
   (`src/features/lessons/kit/page-chrome.ts:127-159`) with `{ lesson: 15, deck }`. On a first visit
   its welcome tour waits for the predict's choice (Toys 3). The masthead's
   season is a constant today, "Season 1" (`src/features/lessons/kit/lesson-menu.ts:111`); it takes
   the lesson's season from the kit's seasons (What the kit and the app still need, item 3).
2. **Hero, with the cold open**, laid out as Lesson 2's (`learn/02.html:334-519`): the kicker, the
   hook question as the title (`<h1 class="hook" id="hook">`), the meta as three chips, the promise
   and the sound gate from LESSON.md. The chips are "15 minutes" (FACTS 3), "After Lesson 2: Twelve
   notes", a link to `/learn/02` that stays a plain chip wherever Lesson 2 is not live
   (`src/features/lessons/kit/page-state.ts:14-20`; FACTS 2), and "Sound on". Its stage holds Tavi's
   and Merc's bubbles over Merc and Tavi on the floor line, the hero's pitch line between them (Toys
   2), and under it the cold open's two plays: "Play the climb", which works from the start, and
   "Play it on the five lines", locked until a choice. The predict card sits under the stage
   (Toys 3). On a phone the hero's parts run kicker, title, meta, the stage, the gate, the predict,
   then the promise (`src/features/lessons/kit/lesson-stage.css:394-437`), so the title and the
   first Play come before anything asks for an answer. The head: the title, at most 60 characters,
   "How to read the staff: clefs and middle C | MercuryPitch" (56; Decisions for the owner, 1); the
   description, "A piano has 88 keys. How can five lines write down every one of them? A
   fifteen-minute lesson with sound toys: clefs, ledger lines and middle C." (144), which the head
   test holds to 80 to 160 characters (`src/tests/lesson-pages.test.ts:155-159`) and to the chip's
   run time in words (`:191-210`); og:title and twitter:title "The staff:
   where notes sit · Find Your Pitch, Lesson 15" (55), in Lesson 6's form for a title with a colon;
   og:description "A piano has 88 keys. How can five lines write down every one of them? Hear the
   notes, then see where each one sits." (115); twitter:description the hook alone (69); the share
   card `learn/lesson-15-og.jpg`, 1200 by 630, its alt "The title card: Find Your Pitch, Lesson
   15, The staff: where notes sit, above five empty lines between Merc and Tavi." (117), with no
   note on the lines (FACTS 1a); the Article's `timeRequired` `PT15M`, position 15 (lengths:
   FACTS, preamble, `verify15b.py`).
3. **Recall from Lesson 2**, straight after the hero: Lesson 2's questions 2 and 3, shown to
   everyone (Toys 7; FACTS 7).
4. **Four words you'll meet**: Staff, Clef, Ledger line, Grand staff, each with its figure and play
   (Toys 4).
5. **Steps**: the step deck, five steps, the staff toy stuck beside the text (Toys 1), Step 2's
   mix-up card in its text, a Go deeper drawer in Steps 1, 4 and 5 (Toys 6).
6. **Sing it**: the comfort check, the voice choice and its new line, Your turn, the staff guide and
   "How did that feel?" (Toys 5).
7. **Quick check**: four questions (Toys 7).
8. **Wrap**: the three lines, the one-sentence challenge, the practice card in the version Sing
   it's ending picks (Practice links; Toys 5), the next-lesson card with its still (Toys 8), and free
   play, the step toys unlocked.
9. **Explorer**: the season's map, with a tab per season, opening on Season 2's (Explorer and season
   data).
10. **Footer**: LESSON.md's, with the practice link and its first-visit line, the fonts line and
    "Every sound on this page is synthesised in your browser."

## Length

The learner copy is 2,337 words on `node scripts/lesson-words.mjs`, every branch counted (FACTS 3),
under the series' cap of 2,379 by 42. The page runs about 15 minutes: 9.82 of reading at 238 words a
minute and about 5.5 of sound, toys and tasks, 15.32 in all, past MASTER-PLAN § 4.2's 8 to 12
minutes of active time, as Lessons 3, 5, 6, 7, 10 and 12 are. The chip is an estimate until the
staff toy is timed in its lab (SEASON-2 § 1.3), and this section says so until then. Each step's
text, with its Try, its Notice and any Tavi line, runs 103 to 119 words (Steps 1 to 5: 118, 118,
103, 119 and 118), inside 50 to 120 a step. Six parts carry more, by the same counter, for these
reasons:

- **Steps 1, 4 and 5, 171, 181 and 169 words with their headings and drawers.** Each Go deeper
  drawer is closed by default: Step 1's gives Open Music Theory's two sentences for the treble
  lines and spaces, Step 4's the octave treble clef and the alto clef, Step 5's the piano's 54 keys
  to 88.
- **Step 2, 202 words with its mix-up card.** The card sits in the step whose toy refutes it.
- **Sing it, 340 words.** It holds the series' singing lines, Lesson 3's word for word, which are
  not cut, and two lines of its own: where the lower voice's notes sit, and what to do with a top
  note that feels high (FACTS 55, 56).
- **The quick check, 341 words.** Four questions with three answers each and a line of feedback for
  every answer, as MASTER-PLAN § 4.2 item 8 asks.
- **The recall, 206 words.** Lesson 2's questions, word for word.
- **The Wrap, 304 words.** The practice card says how to use Compose for the task, keeps a
  first-visit line until the marker takes Season 2's numbers, and has its rest version, Lesson 8's
  (FACTS 42, 43, 59).

The hints and status lines are stage directions in LESSON.md and are not counted, as in the text
packages of Lessons 9 to 14: the predict's hints and its two "You said" lines, the name of the play
a choice unlocks, the stored voice's line, Sing it's hints, and the toys' labels and hints. A built
page writes them in the open and counts them, about 150 words more by Lesson 17's reckoning from
Lesson 8's page (Lesson 8 FACTS 4), so as it stands the built page would be about 2,490 words,
some 110 over the cap, with the chip still at 15 minutes. The build makes these cuts first, 126
words, which bring it back under; every fact they carry stays in FACTS:

1. Step 1's Go deeper drawer, the two sentences for the treble lines and spaces (43 words; FACTS
   29).
2. Step 5's Go deeper drawer, from 54 keys to 88 (41 words; FACTS 28).
3. Step 4's second Go deeper item, the alto clef (20 words; FACTS 27). Its first, the octave
   treble clef, stays: SEASON-2 § 7 item 2 names it for Go deeper.
4. The practice card's first-visit line (22 words; FACTS 42), which goes anyway once SEASON-2 § 5.2
   item 21 widens the lesson marker, and this spec asks for item 21 first or with the page
   (Decisions for the owner, 2).

The activities are timed from this spec's lengths (FACTS 3, 62 to 69). Free play is not counted.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                                                        | New in Lesson 15                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. The staff toy          | The stats snippets' engraving (`research/stats-snippets/staff-engraving.js`, its glyphs); the kit's G clef path, sound, notes, frame loop, step deck and stage fit; the key strip (`kit/key-strip.ts`) in Step 5                                              | The kit's staff toy itself (SEASON-2 § 6.2 item 2): staves in either clef and the grand staff, the F clef, ledger lines, accidentals, the pitch-line switch, six states |
| 2. The hero's pitch line  | Season 1's picture of pitch as height, a lane a semitone (`kit/slide-guide.ts`'s rows)                                                                                                                                                                        | The fold from lanes to lines, in the hero                                                                                                                               |
| 3. Predict widget         | The kit's predict (`kit/predict.ts`), with a free play before the choice; the tour's hold (`kit/tour-gate.ts`)                                                                                                                                                | The welcome tour waits for the choice                                                                                                                                   |
| 4. Four words             | The kit's words strip (`kit/words-strip.ts`), a ticket per word with its figure and play button, with the page's sound owner                                                                                                                                  | Four new figures, drawn by Toys 1's engraving                                                                                                                           |
| 5. Sing it                | Lesson 12's sing flow, moved into the kit, its comfort check, voice choice and feeling question (`lesson-12/sing-flow.ts`, `kit/comfort.ts`, `kit/voice-choice.ts`, `fyp-voice`); the count-in (`kit/move-do.ts`); Lesson 8's rest line (`lesson-08/wrap.ts`) | The guide drawn on the learner's staff; three lines of its own; no Move do                                                                                              |
| 6. Go deeper drawers      | Lesson 2's `details` drawer                                                                                                                                                                                                                                   | Four items in three drawers                                                                                                                                             |
| 7. Recall and quick check | The kit's quiz (`kit/quiz.ts`), with its prefix, slot and away links; Lesson 2's questions and its pair (`lesson-02/quiz-questions.ts`, `lesson-02/quiz-pair.ts`), imported as Lesson 4 imports them                                                          | Ids and keys; the pair takes the page's sound owner                                                                                                                     |
| 8. Tease still            | The kit's next-lesson card and its slot (`kit/next-card.ts`)                                                                                                                                                                                                  | One still: a short phrase on a staff, plain, with a "?", which plays nothing                                                                                            |

### 1. The staff toy

One component in the kit, `src/features/lessons/kit/staff.ts`, new (What the kit and the app still
need, item 4), with its pure helpers beside it, mounted on the step deck's stage, in six states:
treble (Step 1), pitch line (Step 2), ledger (Step 3), clef switch (Step 4), grand staff (Step 5)
and the sing-along staff (Sing it), and free play in the Wrap. DOM buttons sit under the drawing,
so the keyboard and the stage-fit test reach every action.

- **The engraving.** The stats site's snippets are its start (SEASON-2 § 6.1 item 1): a staff of
  five evenly spaced lines; true-size clefs from Noto Music's outlines, the G clef the kit has
  (`G_CLEF_PATH`, `src/features/lessons/kit/glyphs.ts:10`) and the F clef from the snippet's
  glyphs (`research/stats-snippets/noto-music-glyph-paths.json:13`), drawn with its bottom line at
  font y −88, since its dots centre at font y 644 (`research/stats-snippets/staff-engraving.js:123-127`);
  the filled notehead (`noto-music-glyph-paths.json:160`), the sharp (`:76`) and the flat (`:62`).
  No stems, flags, time or key signatures. The line weight follows Look.
- **Places.** A note's place is counted in letters from the staff's bottom line: in the treble clef
  E4 is 0 and F5 is 8, in the bass clef G2 is 0 and A3 is 8; even places are lines, odd places
  spaces (FACTS 12, 14, 16). Ledger lines are drawn at the even places past the staff, -2 and -4
  below, 10 and 12 above, and only as far as the note that needs them (FACTS 18). The toy's range is
  two ledger lines each way: A3 to C6 in the treble clef, C2 to E4 in the bass (FACTS 19, 60a). A
  black key sits on its letter's place with a sharp, named by its sharp, except Step 2's B♭ (FACTS
  10, 24).
- **Taps and keys.** A tap on the staff selects the nearest place and plays its note, 0.8 s, and
  shows its letter and octave beside it ("G4"); places are 13 px apart on a phone (FACTS 71), so
  Step up and Step down, 44 px buttons under the drawing, are the second way in, and Up and Down
  arrows on the focused staff do the same. The staff is a `role="group"` named for its state
  ("Treble staff, five lines and four spaces"), and a polite live region says the place: "G4, the
  second line", "A4, the space above it", "C4, one ledger line below". Every ♯ and ♭ the toy prints
  is spoken, as Lesson 2's contract sets (`signsHtml`, `src/features/lessons/kit/notes.ts:221`).
- **"See it on the pitch line".** A switch, off by default, on the staff toy in every step, in
  free play and in Sing it (SEASON-2 § 1.4 item 1): it draws the hero's pitch line beside the staff,
  a lane a semitone over the toy's range, and each sounding note lights its lane as well as its
  place, with a thin chrome connector between them, so a step of one letter shows as one lane or two
  (FACTS 22, 33). It holds for the visit, in memory. Three staff drawings are not toys and go
  without it: the four words' figures, too small for a second drawing, whose notes the steps play
  again beside the switch; quick check 2's small staff, where the lanes would answer the question,
  one lane and then two; and the tease still, which plays nothing (Toys 8).
- **Sound before symbol.** Every example's note sounds and lights first, on the pitch line when it
  is shown and on the staff in the same frame; nothing on the staff is drawn before its sound in a
  step's own plays (SEASON-2 § 1.4 item 1).

The states, with LESSON.md's plays (FACTS 62 to 69):

1. **Treble (Step 1).** The treble clef and the nine places. "Play G4" plays G4 and lights the clef's
   line in gold with its letter, G. Taps and Step up and Step down move through the places from E4
   to F5; the letters appear as each place is played and stay, so the line, space, line pattern
   builds as the learner moves (LESSON.md's Notice). No ledger lines in this state.
2. **Pitch line (Step 2).** The treble staff with the switch to the fore. Four plays: "Play E, F, G",
   "Play B, C, D", "Play F, then F♯" and "Play B, then B♭". F♯ lands in F's space and B♭ on B's line,
   each with its sign to the left, and with the switch on the lanes show one lane for E to F and
   two for F to G. The mix-up card sits in the text beside it.
3. **Ledger (Step 3).** One notehead to move, from A3 to C6, starting on F5. Step up and Step down
   move it a place at a time, a tap on a place above or below the staff moves it there, and a mouse
   or pen drags it; each place it lands on plays, 0.6 s, and the ledger lines draw and go as it
   moves. On touch the figure keeps `touch-action: pan-y` (`src/features/lessons/kit/lesson-stage.css:810-818`),
   so a vertical swipe scrolls the page and the buttons and taps move the note, as on Season 1's
   toys (`src/features/lessons/lesson-06/tune-toy.ts:18-21`; FACTS 66). "Play G, A, C above" and
   "Play D, C, A below" play their notes as the note jumps to each in turn. Past two ledger lines
   the note stops, and the live region says "This season reads up to two ledger lines."
4. **Clef switch (Step 4).** A segmented control, Treble · Bass, a radio group of two 44 px
   buttons, swaps the clef and relabels every place; a selected place keeps its line or space, so
   the same line names a different note and plays it (LESSON.md's Notice). "Play Merc's F" opens on
   the bass clef: Merc sings F3 on "ooh", its notehead blue on the F line, and the line turns gold
   with its letter, F. "Play G2 up to D4" plays the bass clef's nine places and runs on past the top
   line: B3, then C4 on middle C's ledger line, drawn as C4 sounds, then D4 just over it, the lower
   voice's notes above the staff in Sing it (FACTS 16, 55, 67).
5. **Grand staff (Step 5).** The treble staff above the bass staff, joined at the left by a line and
   a brace, with middle C's ledger line between them, and under them the kit's key strip from G2 to
   F5 (`src/features/lessons/kit/key-strip.ts:1-16`), sliding in as the state opens. A tap on a key
   plays it and lights its note on the grand staff, a black key's with its sharp; a tap on a staff
   note plays its key and lights it. "Play middle C on each staff" lights C4 below the treble staff,
   then C4 above the bass, the same key lit both times. "Play the white keys from G2 to F5" sweeps
   the range's 21 white keys, each lighting its key and its place; its 14 black keys play on a tap
   (FACTS 68). On a phone the strip shows 8 white keys at
   390 px and 7 at 344 to 375 px, each at least 44 px wide, and Lower keys and Higher keys, two 44
   px buttons, pan it a white key at a time; a play pans it to keep the sounding key in view
   (FACTS 71).
6. **The sing-along staff (Sing it).** The learner's staff, bass for the lower voice and treble for
   the higher (FACTS 51), with do, re, mi, fa and so, G3 to D4 or G4 to D5, as plain noteheads, the
   house on do (`src/features/lessons/kit/home-glyph.ts:1-13`), and the pitch-line switch. While
   Merc or Tavi sings, each note lights amber as it sounds; on the guide, a chrome sweep line runs
   along the five notes in time, nothing on the notes themselves (Toys 5). The lower line climbs
   past the bass staff's top line: B3 in the space above it, C4 on middle C's ledger line and D4 just
   over it, as Step 4's play showed and Your turn says; the higher line sits on the treble staff with
   no ledger line (FACTS 55).
7. **Free play (Wrap).** The step toys unlock as the Playground, as on Season 1's pages: every state
   above, with the clef switch and the pitch-line switch, and no reveal or quiz attached.

On a phone each step's figure is `.viz.tall`, 310 px tall up to 420 px wide (FACTS 71): a single
staff at 26 px a staff space fits A3 to C6 in 234 px, and the grand staff at 18 px a space fits
G2 to F5 in 198 px with the strip below it. On a desktop the figure is 380 px tall and the staff
grows to fill it. At the kit's four short landscape sizes the stuck stage keeps each step's controls
on screen, as the stage-fit test checks (`src/e2e/learn-stage-fit.spec.ts:36-57`).

### 2. The hero's pitch line

The staff toy's hero copy, `lesson-15/cold-open.ts`, new: the pitch line between Merc and Tavi, a
lane for every semitone from D4 to G5, the white-key lanes chrome and the black-key lanes fainter
(FACTS 33). Nothing else is drawn before a choice: no line, space, clef or letter (FACTS 1a).

- **Play the climb** (free, `data-free`): E4 up to F5, one white key every 0.6 s, each lighting its
  lane as it sounds (FACTS 34, 62). It works before and after a choice and never reveals.
- **Play it on the five lines** (locked until a choice; the predict's answering play): the fold,
  0.8 s: the black-key lanes narrow to nothing, the white-key lanes slide together, every other one
  (E, G, B, D, F) becomes a line and the others spaces, and a treble clef fades in at the start;
  then the climb plays again, each note landing on its line or space as it sounds, from the bottom
  line to the top (FACTS 37). The staff stays drawn after the reveal, and both plays stay: the climb
  on the pitch line plays over the lanes, which come back beside the staff.
- Merc and Tavi listen while either plays (Merc and Tavi). The nine notes are in the treble for
  everyone, Tavi's register, since the voice choice comes later on the page (FACTS 39).

### 3. Predict widget

The kit's predict (`src/features/lessons/kit/predict.ts`), as it is (CURIOSITY-MOMENTS § 1, rule
2): two `.choice` buttons, Five and Nine; the plays `climb` (with `data-free`) and `lines`;
`revealOn: ['lines']`; the hints from LESSON.md, `chosen` "Locked in. Now play the climb on the five
lines.", `silent` "Sound is off: nothing played. Turn sound on, then play it again." and `again` "Play
the climb again, on the pitch line or on the five lines."; the markup's lock hint, "Choose an answer
to unlock the five lines."; `guess` giving "You said: five" or "You said: nine"; and on the reveal
Tavi's celebration (Merc and Tavi). What a play does to the hint is the kit's (`predict.ts:158-190`):
a free play heard before a choice puts the lock hint back; a play sound off kept silent shows
`silent`; a play cut short, by another sound or by leaving the hero, counts as not heard and
changes nothing (FACTS 38). The reveal waits for the climb on the five lines heard to its end with
sound on.

On a first visit the welcome tour waits for the choice. Its step "One step at a time"
(`src/features/lessons/kit/tour-copy.ts:44-46`) scrolls to the steps' stage, where Step 1 counts the
places (FACTS 1a), so the page holds the tour until a choice is made, through the kit's `holdTour`
(`src/features/lessons/kit/tour-gate.ts:57-69`), as Lessons 1 and 2 hold it for their opening shot
(`:23-26`), with no time limit. A choice locks the guess, so nothing the tour then shows can change
it. A visit that never chooses is offered the tour again on the next lesson page it opens at the
top (`tourDue`, `:36-49`); the lesson menu's "Tour this page" still runs it at once.

### 4. Four words

The kit's words strip (`src/features/lessons/kit/words-strip.ts:1-12`), as Lessons 7 to 10 use it:
a ticket per word with its figure, its word and definition from LESSON.md, and its play button,
each figure drawn by Toys 1's engraving and lit as its notes sound (FACTS 63). The page passes its
sound owner, so a word claims the one sound as it starts and a newer sound anywhere stops it:

- **Staff**: five lines and four spaces, no clef; the climb lights its nine places in turn.
- **Clef**: a treble clef on a staff, its G line lit gold while G4 sounds.
- **Ledger line**: the treble staff's bottom with middle C on its ledger line, lit while C4 sounds.
- **Grand staff**: two small staves with a brace; C3, C4 and C5 light in turn, C4 on the ledger line
  between them.

The strip sits below the recall, below the reveal, so its definitions never answer the predict
(FACTS 1a).

### 5. Sing it

Lesson 12's sing flow (`src/features/lessons/lesson-12/sing-flow.ts:1-41`), moved into the kit with
Move do as an option (What the kit and the app still need, item 6), with the guide drawn on the
staff (Toys 1, state 6). In order:

1. **The comfort check**, Lesson 3's, every visit, never stored (FACTS 49), through the kit's
   `mountComfort` (`src/features/lessons/kit/comfort.ts:159`).
2. **The voice choice**, Lesson 3's two buttons and lines (FACTS 51), through the kit's voice choice
   (`fyp-voice`, `src/features/lessons/kit/voice-choice.ts:20`), after either answer and before
   anything plays when none is stored. Under it, LESSON.md's new line: "Your staff follows your
   choice: the bass clef for the lower voice, the treble clef for the higher." The staff below
   follows a change at once.
3. **Your turn**, the stop line on its own line, then two buttons: Play Merc's notes and Start the
   guide. Play Merc's notes plays Merc's line (lower) or Tavi's (higher) as one voice along a
   contour, each of the first four notes a 1.15 s hold and a 0.05 s glide, the top note 1.8 s
   (FACTS 57, 69; `contourOf` and `playContour`, `src/features/lessons/kit/sound.ts:280-308`,
   `:571-584`), lighting
   each note amber as it sounds. Start the guide waits until Merc's notes have been heard with sound
   on, with Lesson 12's hint, "Play Merc's notes first", and its sound-off line
   (`src/features/lessons/lesson-12/sing-flow.ts:192-197`); then it counts in on do, 0.8 s at 0.065
   and 0.2 s of quiet (`countIn`, `src/features/lessons/kit/move-do.ts:65-74`), and the sweep runs
   6.6 s with no voice. No Move do and no readout (FACTS 56). The line under the buttons is
   LESSON.md's, "The guide counts you in on do, then a line sweeps along the notes. Nothing listens
   here and nothing is scored. It's just for you." (FACTS 59a). Your turn's own text adds two
   lines: "For the lower voice, the last three sit above the bass staff, around middle C's ledger
   line." and "If the top note feels high, leave it out and stop at fa." (FACTS 55, 56).
4. **How did that feel?** after each sweep run to its end, through the kit's `mountFeelings`
   (`src/features/lessons/kit/comfort.ts:175`): Easy and Workable give LESSON.md's line, "Do, re,
   mi, fa, so: five notes, one step up the staff each time."; Effortful and Uncomfortable give
   Lesson 3's lines (with the doctor lines after Uncomfortable), put the guide away for the visit,
   as Lesson 12's flow does, and set the rest ending (FACTS 58, 59).
5. **Just listen today**: Merc's line on a tap, in the chosen voice, no guide, and the doctor lines
   (FACTS 50); it sets the rest ending too.

After "Effortful", "Uncomfortable" or "Just listen today" the Wrap's practice card shows its rest
line, Lesson 8's word for word, "Rest today. This page's sung line will be here when your voice
feels comfortable.", above its text, and keeps Compose, since Compose asks for no voice (FACTS 59).
It is Lesson 8's form, a line in the card shown for the rest ending, through the kit's
`VisitEnding` (`src/features/lessons/kit/comfort.ts:89-114`), as Lesson 8's wrap shows it
(`src/features/lessons/lesson-08/wrap.ts:5-10`, `:21-25`), with "Effortful" leading to the rest
ending as Lesson 12's flow has it (`src/features/lessons/lesson-12/sing-flow.ts:27-29`, `:100`).
The kit's practise card that stops being a link after those endings is not needed, since nothing
on this card asks for the voice (`src/features/lessons/kit/comfort.ts:116-125`). Nothing listens:
the page never asks for the microphone (FACTS 59a).

### 6. Go deeper drawers

Lesson 2's `details` drawer, closed by default, under the step's text: Step 1's, "Two sentences to
remember them" (FACTS 29); Step 4's, "The octave treble clef" and "A third clef" (FACTS 26, 27);
Step 5's, "From 54 keys to 88" (FACTS 28). Text only: no sound and no figure. Each item's bold
lead-in is its summary line's words.

### 7. Recall and quick check

Two quizzes share this page through the kit's quiz (`createQuiz`,
`src/features/lessons/kit/quiz.ts:218`), each with its own prefix and keys.

- **Recall**: Lesson 2's questions 2 and 3 (FACTS 7), imported from Lesson 2's page and filtered by
  id, `l02-q2` and `l02-q3`, as Lesson 4's page takes Lesson 2's questions 1 and 3
  (`src/features/lessons/lesson-04/quiz-questions.ts:27-29`), so one question reports under one id
  on every page. Shown to everyone, as Lesson 4's recall is (`src/features/lessons/lesson-04/main.ts:58-65`),
  since Lesson 2 is a prerequisite. Prefix `recall-`, keys `fyp-l15-recall-seed` and
  `fyp-l15-recall-v1`; no `lesson`, so it marks nothing done. Its step links read "Try Lesson 2,
  Step 3 again" and "Try Lesson 2, Step 5 again" and open `/learn/02#step-3` and `/learn/02#step-5`
  in a new tab, through `away: { href: recallStepHref }` (`quiz.ts:141-143`, `:186-216`); the step
  deck opens a page at the step its address names (`src/features/lessons/kit/step-deck.ts:21-23`).
  Question 2's slot is Lesson 2's own, its play button and its "1st" and "2nd" chips
  (`QUIZ_PAIR_SLOT`), handled by `bindQuizPair` on this quiz's host
  (`src/features/lessons/lesson-02/quiz-pair.ts:49-58`), which plays Lesson 2's pair (FACTS 61).
  That handler takes no sound owner today, so the kit's version takes one and this page passes it
  (What the kit and the app still need, item 11; Audio).
- **Quick check**: LESSON.md's four questions, ids `l15-q1` to `l15-q4`, keys `fyp-l15-seed` and
  `fyp-l15-quiz-v1`, and `lesson: 15`, so answering all four marks Lesson 15 done. Three answers
  each, shuffled per question from the stored seed, one-line feedback for every answer, and a check
  icon and ink, not gold, on the right one. The kit prints "Right." or "Not quite." before each line
  (`quiz.ts:315`). Question 2's slot holds its play, "Play the three notes", which plays E4, F4 and
  G4 and lights them on a small treble staff in the slot (FACTS 65); it never shares a name with
  Step 2's plays. Question 1's wording stays as it is: Lesson 16 plans to ask it, word for word, as
  its recall (`lessons/16-sing-what-you-see/ARTICLE-PLAN.md:50`).

### 8. Tease still

The drawing in the next-lesson card's slot, the page's `[data-next-card]` mark, which the kit keeps
in the card after its words (`src/features/lessons/kit/next-card.ts:27-30`): an SVG, `aria-hidden`,
of a treble staff with five plain noteheads stepping up two places and back down, no syllables, no
house and nothing lit, and a "?" beside it (FACTS, Illustrations without claims). It names no note
to start from, so it does not answer Lesson 16's predict (FACTS 5). It holds no button, since the
card is a link, and does not move. It plays no sound, on purpose: Lesson 16's opening plays nothing
until its predict, and a phrase played here would undo "Tavi has never heard them"; it is the card's
picture, not a staff example (FACTS, Illustrations without claims). Its styles go under a class of
its own, not the tease line's `.next-tease`.

## Audio

Every sound is synthesised in the page with Web Audio, through the kit's sound module, its master
bus and its house envelopes, and started only by a tap: a played note and the toys' plays in the
soft tone; Merc's singing in Merc's "ooh", and Tavi's the same an octave up; the guide's count-in
in the soft tone at half a tapped note's level (FACTS 60 to 70). Nothing autoplays, and the page
has no music bed.

- **The sound rules**, for every source of sound on the page (the hero's plays, the four words, the
  recall's pair, every play and tap of the staff toy, the quick check's play and Sing it):
  1. One sound plays at a time, across the whole page: a new play stops the one before, whichever
     toy started it.
  2. Leaving a step, by any route (Next, Back, a swipe, the lesson menu, `#step-N`, a quiz link),
     stops its sound and any queued play; scrolling Sing it off screen for 600 ms, or hiding the
     page, stops what plays there.
  3. A play that is cut short never counts as heard by the predict or by Sing it's gate.

  The kit has the helpers: a page-wide "now playing" owner
  (`NowPlaying`, `src/features/lessons/kit/now-playing.ts:39`), which every source here registers
  with, and a predict `play` that can report "not heard" (`src/features/lessons/kit/predict.ts:31-41`).
  The words strip takes the owner today (`src/features/lessons/kit/words-strip.ts:5-12`); Lesson 2's
  pair does not yet (What the kit and the app still need, item 11).

- **A run of notes** (the climb, the three-note plays, the sweep from G2 to F5) is timed from one
  start, every note on its own timer counted from the play's start, as Lesson 2 times its examples
  (`schedule`), so the drawing and the sound share one clock and never drift.
- **Merc's and Tavi's line** in Sing it is one voice along a contour, held and glided on the audio
  clock (`src/features/lessons/kit/sound.ts:16-21`), so the five notes join with no gap and no click.
- **Low notes.** The bass staff's G2, 98 Hz, and the toy's C2, 65.41 Hz, are faint on a phone's
  speaker; the soft tone's upper partials carry them, and nothing lower is played (FACTS 25, 60a).
  The owner's ear on a real phone decides whether G2 needs more level (Contract).

## Merc and Tavi

Lesson 1's setup through the kit (`src/features/lessons/kit/merc-duo.ts`): the app's renderer
loaded after first paint, one WebGL context per Merc, medium quality on phones, turned towards each
other, paused off screen, and the still images when WebGL fails.

- They live in the hero, on either side of the pitch line. Tavi asks and Merc answers in the
  bubbles (LESSON.md). While the climb plays, on the lanes or on the five lines, both listen
  (`mercListen`, `src/features/lessons/kit/merc-duo.ts:207`). Tavi celebrates once as the reveal
  shows, the puzzled guesser who then gets it (`mercCelebrate('orange', 1600)`, `:217`, as Lesson
  2's cold open does), a quiet one, since the reveal calls no choice right: the page mounts the pair
  with no sparkles (`MercDuoOptions`, `:119`).
- Step 4's "Play Merc's F" is Merc's voice with Merc's blue notehead on the staff; the hero's
  Mercs are off screen by then and do not move for it.
- In Sing it Merc and Tavi appear as stills, the Merc who sings beside the learner's staff.
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Compose, in Sheet Music.** The link is `/?lesson=15#/compose`, printed
  "mercurypitch.com/#/compose", with "then choose Sheet Music" (FACTS 45). Compose opens on its
  piano roll with the Place tool, so a tap on the grid adds a note; on a first visit the roll holds
  the app's C major scale from C3, which the card asks the learner to clear with the bin button,
  Clear all notes, which Undo reverses; Sheet Music, or Split, then draws the notes on a staff and
  plays them, in the bass clef when the melody's middle note sits below middle C (FACTS 43, 44).
  The learner's do, re, mi, fa and so in G come out in their own clef: the lower voice's G3 to D4 in
  the bass, the higher's G4 to D5 in the treble. Compose is free (FACTS 40). It is a sandbox, so the
  card gives it a goal, as playbook rule 17 asks.
- **The rest version.** After "Effortful", "Uncomfortable" or "Just listen today" the card shows
  Lesson 8's rest line above its text and keeps the link, since Compose asks for no voice (Toys 5;
  FACTS 59).
- **Compose on a phone.** It is built for a bigger screen: on a screen up to 768 px wide it says so
  in a toast once, and its view tabs are icons; turned sideways past 768 px, a phone gets the
  labelled tabs (FACTS 41). The card says "on a phone, turn it sideways".
- **The first visit.** `?lesson=15` is not a lesson marker today, so on a first visit First Light,
  the app's intro, opens before Compose, and its close now asks "Skip the intro?" first: the card
  and the footer keep Season 1's first-visit line with "then tap "Yes, skip"" until SEASON-2 § 5.2
  item 21 widens the marker (FACTS 42). A returning visitor may meet the opening takeover over
  Compose until then (FACTS 48).
- **A visitor in simple mode or set to guitar** cannot open Compose: the app sends them Home with no
  note while it starts (FACTS 46). The card does not say so; Edge cases.
- **Needed: the note-reading drill** (SEASON-2 § 5.2 item 9): a note on the treble or bass staff, up
  to two ledger lines, answered on a keyboard or by letter, the clef chosen by the singer's range.
  When it ships, the card names it in Compose's place, or beside it (FACTS 44). The app's only note
  quiz is the guitar's fretboard, and Sight-Singing, which reads a staff and asks for singing, is
  Lesson 16's link.
- Not linked: none of the premium exercises.

## Explorer and season data

Lesson 15's entry, proposed for Season 2's data, which goes in its own module that a Season 1 page
does not load (SEASON-2 § 6.2 item 1), in Season 1's entry form
(`src/features/lessons/kit/season.ts:405-419`, Lesson 14's):

- `n: 15`, `lane: 'theory'`, `title: 'The staff: where notes sit'`, `short: 'The staff'`, `topics:
['T30']`, with T30's name, "Staff notation: staff, clefs, ledger lines, grand staff", as SEASON-2
  § 4.1 gives it (`docs/plans/find-your-pitch/SEASON-2.md:719`); the hook word for word (FACTS 1).
  `minutes: 15` and `page: '/learn/15'` once the page is built, under the drafts' comment in Lesson
  6's form (`src/features/lessons/kit/season.ts:270`): `// A draft until the vocal coach's look at
Sing it (drafts.ts).` The entry decides nothing about being live: the draft list and the console do.
- `pr.link`: `href` `/?lesson=15#/compose`, `addr` `mercurypitch.com/#/compose`, `label` "Compose"
  and `note` "then choose Sheet Music", which the explorer's card prints after the address as
  "Compose, then choose Sheet Music" (`practiseMarkup`, `src/features/lessons/kit/explorer.ts:177-181`).
  `pr.needs`, "A note-reading drill: a note on the treble or bass staff, up to two ledger lines,
  answered on a keyboard or by letter", stays until it ships; it is "Admin only, never drawn on a
  lesson page" (`src/features/lessons/kit/season.ts:102-103`).
- `EDGES` gains [2, 15], a cross-season edge, as SEASON-2 § 4.3 gives it (FACTS 2). Lesson 15's
  prerequisite list is then [2] (`PREREQ`, `src/features/lessons/kit/season.ts:452-458`).
- The tease on this page's next-lesson card is Lesson 16's, set on Lesson 16 in the lesson copy
  (`LESSON_COPY`, `src/features/lessons/kit/lesson-copy.ts:79`): settled, `tease` "Five notes on the
  staff. Tavi has never heard them.", with the plan's line as a variant, `teaseAlts` `[{ id:
'any-note', text: 'Now you can see where any note sits.' }]`, and that variant's note in the team's
  notes, which a variant needs (`:28-31`; FACTS 5). Lesson 15 itself has none, since Lesson 14
  teases nothing (FACTS 5b).
- The signature line for the admin console, from the card (FACTS 4): "The pitch line's black-key
  lanes fold away and its white-key lanes close into five lines; Lesson 1's keyboard slides under
  the grand staff, and the two staves meet at middle C." Every season entry has one, in the team's
  notes, which no lesson page loads.
- The explorer gains a tab per season and cross-season lines (SEASON-2 § 6.2 item 1); this page
  opens on Season 2's tab. Its card reads "Ready · read" with "15 min" once the page is live.

## What the kit and the app still need

Found in the kit and the app as they stand on main at `c60f0fdcb`. Every item is proposed.

1. **The lesson host**: `learn/15.html` at `/learn/15`, which every build takes as a lesson page,
   a draft's included (`lessonPages`, `tools/draft-lessons.ts:82-90`); `/learn/15` and
   `/learn/15.html` in `STANDALONE_DOCUMENT_PATHS` (`src/lib/sw-runtime.ts:93`), beside the drafts'
   entries; the first-paint budgets (FACTS 73). The lesson pages' route already takes any two
   digits (`LESSON_PAGE`, `src/lesson-gate.ts:134`).
2. **The draft line**, in the draft list's form (`src/features/lessons/kit/drafts.ts:29-41`):
   `15: "the vocal coach's look at Sing it (MASTER-PLAN § 12 item 8)"`. Releasing it is deleting
   that line, then listing the page in the sitemap and llms.txt (SEARCH.md § 12 item 3).
3. **Seasons in the kit** (SEASON-2 § 6.2 item 1): Season 2's data in its own module, its topics
   and edges, the masthead's season from the data (`src/features/lessons/kit/lesson-menu.ts:111`),
   the explorer's tab per season, and a season's end per season. The last matters on day one: the
   next-lesson card draws the lesson after the page's own wherever the data holds one, and the
   season's end only where it holds none (`nextCard`, `src/features/lessons/kit/next-card.ts:91-121`),
   so once Lesson 15 is in the data, Lesson 14's page would draw Lesson 15's card in place of
   Season 1's close, `SEASON_END` (`src/features/lessons/kit/lesson-copy.ts:129-141`), which SEASON-2
   § 1.4 item 3 and § 7 item 8 keep, with CURIOSITY-MOMENTS' Lesson 14 entry (FACTS 5b). The card
   for Lesson 15 would answer nothing, but Season 1's end would be gone. `LESSONS[n].n === n` (`src/features/lessons/kit/season.ts:108-110`) and the head
   test's `LESSONS[n]?.minutes` (`src/tests/lesson-pages.test.ts:191-210`) read one list by number;
   with Season 2 in its own module, both read the season the page belongs to.
4. **The staff toy** (SEASON-2 § 6.2 item 2; Toys 1): `src/features/lessons/kit/staff.ts`, new,
   with its pure helpers and their unit tests (a note's place in a clef, its ledger count, its
   letter and octave, the clef for a voice, the grand staff's 21 white keys); the F clef, the
   filled notehead, the sharp and the flat added to `kit/glyphs.ts` from the snippet's glyphs, with
   their licence line; the line-weight token (Look). Lessons 16 to 28 reuse it, so its states are
   options, not this page's code.
5. **The hero's fold**: `lesson-15/cold-open.ts`, new (Toys 2), on the staff toy's drawing.
6. **The sing flow in the kit** (Toys 5): Lesson 12's flow
   (`src/features/lessons/lesson-12/sing-flow.ts`) moves into the kit, as the series moves a part a
   second page needs, with Move do and the guide's drawing as options and its endings as they are.
   This page passes no Move do and the staff toy's sing state as the guide; Lesson 12 keeps its own
   options, and Lesson 17's sung bars can take the flow too.
7. **No decorative staff** (Look): the page's section heads have no `.mv-staff`, and its module
   does not call `engraveClefs`; and a Season 2 page drops the body's background staff, the
   repeating five-line gradient (`src/features/lessons/kit/lesson-base.css:128-157`), by a class on
   `body` or in the season's own stylesheet, keeping the background's three glows. Season 1 pages
   keep both.
8. **The lesson copy**: Lesson 16's tease, set on Lesson 16
   (`src/features/lessons/kit/lesson-copy.ts:12`, `:79`), within `TEASE_MAX` (`:75-76`; FACTS 5):
   the proposal and the plan's line as its variant, with the variant's team note (Explorer and
   season data). The admin console switches between them; nothing on this page changes.
9. **Season 2 in the app's lesson plumbing** (SEASON-2 § 5.2 item 21), the app's work, not the
   page's: the lesson marker's range (`src/lib/lesson-marker.ts:19`), so `?lesson=15` steps First
   Light aside and holds the takeover back (FACTS 42, 48); the lesson-answer bounds
   (`workers/db-worker/src/mirror-metrics.ts:61-62`), which refuse Lesson 15's answers whole today
   (FACTS 47); the admin console's one row per Season 1 lesson
   (`src/features/admin/lessons/lesson-admin.ts:88`); `RELEASED_LESSONS`
   (`src/lib/current-lesson.ts:34-37`). When the marker widens, LESSON.md's first-visit line comes
   out of the card and the footer, as Season 1's did.
10. **The head and the share card** (Sections, 2): the title, the descriptions, the share card
    `learn/lesson-15-og.jpg` and its alt, and the structured data with `timeRequired` `PT15M`.
11. **The recall pair's sound owner** (Toys 7; Audio): Lesson 2's handler for question 2's play
    takes no owner and keeps its own guard (`src/features/lessons/lesson-02/quiz-pair.ts:28-58`). It
    gains an optional one, `bindQuizPair(host, owner?)`, which claims the owner as the pair starts
    and stops the pair when a newer sound claims it, as the words strip does; Lesson 2's page passes
    none and keeps its behaviour.

## Decisions for the owner

1. **The page's title.** SEARCH.md § 4 has no Season 2 drafts. Recommended: "How to read the staff:
   clefs and middle C | MercuryPitch" (56), in the query-led form the owner chose on 22 October
   2026, with the terms people type: "read the staff", "clefs", "middle C". The alternative,
   "Treble and bass clef notes: reading the staff | MercuryPitch" (60), leads with the clefs and
   sits at the cap. Neither names how many places a staff has (FACTS 1a).
2. **Release before or after the app's Season 2 plumbing** (SEASON-2 § 5.2 item 21). Recommended:
   ship item 21 first, or with this page. Before it, the practice link meets First Light on a first
   visit (the card's first-visit line covers it), a returning visitor may meet the takeover over
   Compose, and every quiz answer on the page is dropped by the worker, so the season's first page
   would report no first-try scores (FACTS 42, 47, 48). Since the release follows Lesson 16, which
   waits on app work of its own (SEASON-2 § 7 item 6), item 21 can ride with it.

## Edge cases

- **Sound off, unset or missing.** Every play obeys the kit's `canPlay`. The predict's reveal and
  Start the guide wait for heard sound (Toys 3, 5). With no Web Audio the page stays readable, every
  play runs its visuals in silence with its hint, and Sing it offers the listen-only path.
- **A hidden page or a section off screen** stops what is playing (Audio).
- **Before a choice**, Play it on the five lines is disabled and the reveal hidden; Play the climb
  still sounds and lights the lanes, and draws no line.
- **The climb after a choice, before the five lines**: the hint stays `chosen`, "Locked in. Now play
  the climb on the five lines.", since that play does not reveal.
- **Sound off before a choice**: the climb runs its lights silently and `silent` replaces the lock
  hint; once a climb is heard with sound on, still before a choice, the lock hint comes back.
- **The five lines cut short** (another sound, a step link, leaving the hero): not heard, no reveal,
  the hint as it was; the fold, if it had run, stays drawn and plays again from the lanes next time.
- **Reduced motion**: the fold cross-fades; nothing travels; the reveal still waits for the sound.
- **A tap past two ledger lines** in Step 3 stops at the limit with its live-region line; a tap on
  the staff outside the toy's range selects the nearest place inside it.
- **Step 3 on touch**: a vertical swipe on the figure scrolls the page; Step up, Step down and a tap
  on a place move the note, and a mouse or pen drags it (Toys 1, state 3).
- **A first visit that never chooses**: the welcome tour waits for the choice, and the next lesson
  page opened at the top offers it again (Toys 3).
- **The clef switched mid-play** stops the play; the selected place keeps its line or space and
  plays its new note on the next tap.
- **The keyboard's black keys** light their letter's place with a sharp; on a phone each key's zone
  is the key strip's own, never under 44 px, and a key the window cuts too small takes no tap
  (`src/features/lessons/kit/key-strip.ts:12-16`).
- **No voice chosen**: nothing in Sing it plays until a voice is chosen, and the staff waits in the
  treble with no notes. A stored voice opens on its own staff.
- **Effortful or Uncomfortable**: the guide goes for the visit; Play Merc's notes stays, as listening;
  the practice card shows its rest line and keeps Compose, as after "Just listen today".
- **No WebGL**: the Mercs' stills; everything else runs.
- **No storage** (a private window): the quiz seeds and the voice last for the visit; nothing breaks.
- **Lesson 2 not live** where the page is served: the prerequisite chip stays a plain chip and the
  recall's step links keep their words with no link (FACTS 7).
- **The practice link, first visit**: First Light opens; the × asks "Skip the intro?", and "Yes,
  skip" opens Compose with its first-visit C major scale (FACTS 42, 43).
- **The practice link, returning visitor**: Compose opens on their own last melody; the card's
  "clear it" speaks of the first visit's scale, and Clear all notes can be undone. The opening
  takeover may show first (FACTS 48).
- **The practice link in simple mode or set to guitar**: the app lands on Home with no note while it
  starts; the card does not name the settings, as no card does (FACTS 46).
- **Compose on a small phone held sideways**: a phone whose long side is 768 px or less stays narrow,
  with the toast and icon tabs (FACTS 41).
- **A0 and C8** are named and never played (FACTS 25).

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-15/`, and on the
kit parts it adds:

1. **Places**: the treble clef's lines E4, G4, B4, D5, F5 and spaces F4, A4, C5, E5; the bass clef's
   lines G2, B2, D3, F3, A3 and spaces A2, C3, E3, G3; G4 on the treble staff's second line and F3 on
   the bass staff's fourth; ledger counts, C4 one below the treble staff and one above the bass, A3
   two below the treble, C6 two above, E2 one below the bass, E4 two above it; B3 in the space above
   the bass staff and D4 just over its ledger line; F3 on the treble
   staff's third ledger line below and G2 its sixth; the grand staff's 21 white keys, G2 to F5
   (FACTS 13 to 21).
2. **Steps**: E4 to F4 and B4 to C5 are 1 semitone, F4 to G4 and C5 to D5 2; F♯4 sits on F4's place
   and B♭4 on B4's (FACTS 22, 23).
3. **The sing-along**: G3, A3, B3, C4, D4 and G4, A4, B4, C5, D5 against `VOCAL_RANGES`: every note at
   least 2 semitones inside every preset of its voice; the app's clef rule gives bass for the lower
   line and treble for the higher (FACTS 44, 55).
4. **Sounds**: every fixed sound's frequency equals `hz(m)` for the notes of FACTS 60; the climb lasts
   5.3 s, the five lines 6.1 s, the three-note plays 1.7 s, the pairs 1.8 s, Step 3's plays 2.0 s,
   G2 up to D4 7.1 s, middle C twice 2.0 s, the sweep 5.22 s, Merc's line 6.6 s and the count-in
   1.0 s (FACTS 62 to 69).
5. **The predict**: the climb plays before a choice and never reveals; the reveal waits for the five
   lines heard with sound on; a five-lines play cut short reveals nothing and leaves the hint; the
   hints and the guess lines are LESSON.md's (FACTS 38).
6. **The recall**: the questions are Lesson 2's own objects, `l02-q2` and `l02-q3`, imported, not
   copied; their links open `/learn/02#step-3` and `/learn/02#step-5`; question 2's slot plays
   Lesson 2's pair (FACTS 7, 61).
7. **The quick check**: ids `l15-q1` to `l15-q4`, three answers each, one right, LESSON.md's words;
   no feedback line starts with "Right", "Yes" or "Correct".
8. **Sing it's flow**, in Lesson 12's tests' form: the voice before anything plays; the guide after
   Merc's notes heard; no Move do; Effortful and Uncomfortable put the guide away; Effortful,
   Uncomfortable and Just listen today show the practice card's rest line, and the card keeps
   Compose after every ending (FACTS 57 to 59).

Page tests, against a local or dev build, never production:

9. The head test (`src/tests/lesson-pages.test.ts`): the title within 60 characters, the description
   80 to 160 with "A fifteen-minute lesson", the chip "15 minutes" and `timeRequired` `PT15M`
   (`:155-159`, `:191-210`).
10. No planning text on the page: no topic code such as "T30", no "planned", "deep link" or "for the
    team" (`src/e2e/learn-no-planning-text.spec.ts:22-40`).
11. The stage-fit test at the four short landscape sizes, every step's controls on screen with the
    stage stuck (`src/e2e/learn-stage-fit.spec.ts:36-57`).
12. The first-paint budgets for `learn/15.html` (FACTS 73).
13. **The staff's line weight at 390 px, on a real phone** (the lead's check): at 390 x 844, in each
    state, the five lines and the ledger lines read clearly against the figure at arm's length, by
    eye and by a measured contrast of 3:1 or more on a screenshot (FACTS 72); and the same at 360 px.
14. The claims validator over LESSON.md and WEB-SPEC.md (`validateGuidedDynamicClaim`), 0 flagged
    lines, as Lessons 12 and 14 ran it (FACTS, Claims check).
15. **One sound at a time across sources**: the recall pair's play stops the climb, the climb stops
    the pair, and a word's play stops either (Audio; What the kit and the app still need, item 11).
16. **No background staff**: on `learn/15.html` the body's computed `background-image` holds no
    repeating gradient and the page has no `.mv-staff`, while a Season 1 page keeps both (Look;
    What the kit and the app still need, item 7).
17. **The tour's hold**: on a first visit at the top, the welcome tour does not open before the
    predict's choice and opens after it; "Tour this page" opens it at once (Toys 3).

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practice links that carry `?lesson=15` before any hash. Then the layout, accessibility, sound,
motion and storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text
children, touch targets of at least 44 px with no two tap zones overlapping (the staff's places are
reached by Step up and Step down as well as by taps), visible focus, a single dark theme with every
colour a token and an explicit body background, sound only after a tap, localStorage only for
per-viewer conveniences inside try/catch, and the whole page usable with no sound, no WebGL and no
storage (the predict and the guide then say why they wait). Every ♯ and ♭ the page prints in text
(Step 2's F♯ and B♭, the recall's C♯ and D♭, the keyboard's sharps) has a spoken name, the sign
`aria-hidden` and a visually hidden word after it (`signsHtml`,
`src/features/lessons/kit/notes.ts:221`); the figures' accessible names and every live region use
words only, and every place is spoken with its letter and octave. The page stores the quiz seeds
and records (`fyp-l15-recall-seed`, `fyp-l15-recall-v1`, `fyp-l15-seed`, `fyp-l15-quiz-v1`),
`fyp-done` (`src/features/lessons/kit/progress.ts:12-15`), `fyp-voice`
(`src/features/lessons/kit/voice-choice.ts:20`), the masthead's Pause animations choice,
`fyp-motion` (`src/features/lessons/kit/motion-switch.ts:12`), the steps the viewer reached,
`fyp-pos` (`src/features/lessons/kit/position.ts:20`), and its record of the welcome tour,
`fyp-tour` (`src/features/lessons/kit/tour-gate.ts:29`); nothing from the toys or Sing it but the
voice. The clef switch and the pitch-line switch hold for the visit, in memory.

Page QA before publishing adds, for this page, every check against a local or dev build, never
production:

- Every play, switch and button works by keyboard alone and announces what LESSON.md shows; the
  staff's places are reached by Step up and Step down and the arrow keys; a screen reader hears
  every place with its letter and octave, and every ♯ and ♭ spoken.
- At 390 x 844 every target is at least 44 px square and nothing scrolls sideways at 344, 360 and
  375 px; the key strip pans with Lower keys and Higher keys and keeps the sounding key in view.
- On a real phone, by ear and by eye (`docs/agent/DEVICE-DEBUGGING.md`): the staff's lines at 390 px
  (Tests, 13); G2 and the bass staff's low notes audible on the speaker; Merc's line joined, with no
  click between notes; each note lighting as it starts, with no drift across the sweep.
- The network panel and the browser's microphone indicator stay quiet through Sing it: no request,
  no microphone.
- The Wrap's practice card shows its rest line after "Effortful", "Uncomfortable" and "Just listen
  today", keeps Compose after every ending, and every link opens in a new tab.
- No faint staff shows behind the page at any width, and no section head carries one (Tests, 16).
- The app-check sweep at phone and desktop width, with Sing it open in each state and the cold open
  before and after its reveal.
