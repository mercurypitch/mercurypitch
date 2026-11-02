# Lesson 28 web page: spec

The Lesson 28 page is the web lesson for "Cadences, form and a song in two parts", Season 2's last
lesson, its voice and theory finale, the fourth of Arc D, Harmonise it: a cold open in which a song
in two parts seems to end at bar 8, then keeps going, and the learner predicts which part changed
its note; a recall from Lessons 18 and 26; three words; written steps on one main toy, the song on
two staffs, in four step states with free play, and a form strip; a scored checkpoint in which the
learner reads and sings one part of the song's eight bars in time, in their own clef, with the other
part in the headphones, recorded on the device and played back with the other part; a way to sing
alone without headphones and hear the two together afterwards; an unscored sing-along without a
microphone; two quizzes; the season's close; and the lesson explorer. Copy is in
[LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is a text-only package: no film
exists for Lesson 28, so the page has no Watch section and the masthead's anchors are Lesson, Sing
and Explorer. It is built on the kit (`src/features/lessons/kit/`) as it stands on main at
`c60f0fdcb`, and like every lesson page it reuses and never copies: a part that lives in an earlier
lesson's module moves into the kit first.

It stands on Season 2's kit work, none of it built yet, and specifies again none of what other
packages give: the seasons in the kit (SEASON-2 § 6.2 item 1); the staff toy (SEASON-2 § 6.2 item 2; Lesson
15's item 4, `docs/plans/find-your-pitch/lessons/15-staff/WEB-SPEC.md:580-585`), with key
signatures (Lesson 21's item 4, `docs/plans/find-your-pitch/lessons/21-keys-circle/WEB-SPEC.md:459-463`)
and rhythm on the staff (§ 6.2 item 3); Lesson 18's reading staff, its woodblock count-in, its sing
flow with a take read in time and its marks (its items 4, 5, 7 and 8,
`docs/plans/find-your-pitch/lessons/18-read-a-line/WEB-SPEC.md:657-708`); Lesson 24's headphones
check and quiet check (`docs/plans/find-your-pitch/lessons/24-drone-harmony/WEB-SPEC.md:747-755`);
Lesson 26's options for them, its part under a take and its reader's rule for a note sung on the
other part's note (`docs/plans/find-your-pitch/lessons/26-second-voice/WEB-SPEC.md:661-687`); and
Lesson 14's recorder (`docs/plans/find-your-pitch/lessons/14-phrasing-whole-song/WEB-SPEC.md:564-591`)
and its rest-aware close (`docs/plans/find-your-pitch/lessons/14-phrasing-whole-song/WEB-SPEC.md:877-886`).
This spec adds only what a song in two parts needs: two staffs in one figure, its tags and its
plagal tag; the song strip and the form strip; a take played back with the other part; the alone
path; the season's close for Season 2; and a lab test. The scored runs ship only after that lab
test, in which silence with the other part from the speakers reads as no voice and a take plays back
in time with the part; until then Sing it is the unscored sing-along (FACTS 59 to 64).

One object carries the lesson: a song in two parts, written for it, in G major, Tavi's part in the
treble clef above and Merc's in the bass clef below. In the cold open it is ten empty bars that
sound; after the choice its bars 7 and 8 are written as they play, both ways; in Step 1 the A
section's two phrases end on their cadences, tagged; in Step 2 bars 7 and 8 end three ways, the
signature's tags among them; in Step 3 the song's four sections gather their letters, A A B A; in
Step 4 each part is a tune of its own on its own staff; in Sing it the learner's part is lit amber
on their staff, the other part beside it; and at the season's close the season's objects line up
along the song's sections (FACTS 4, 29 to 36).

Its public home is `mercurypitch.com/learn/28`: a hand-written document `learn/28.html` with its
module in `src/features/lessons/lesson-28/`. It is a voice lesson, so it is a draft until the vocal
coach signs off its voice lines and its checkpoint (LESSON.md, For the vocal coach), in the draft
list's form (`src/features/lessons/kit/drafts.ts:31-41`). The season builds Lessons 24, 26 and 28
last, with one coach batch for all three (SEASON-2 § 8.2 item 7,
`docs/plans/find-your-pitch/SEASON-2.md:1146-1147`).

## Look

Season 1's look, unchanged: the dark listening room, the series colour code, Lesson 1's type and
wordmark, and the motion rules. On this page:

- **The song on two staffs**: Season 2's staff toy, the treble staff above the bass staff joined by
  a brace, as Lesson 15's grand staff is, the system's bar lines through both, the key's one sharp
  after each clef at its own clef's height, 4/4, the bar numbers small above the treble staff, the
  house on do, the breath marks as commas above each staff. Notes are ink; the note sounding lights;
  the cursor is a thin ink line at the beat (FACTS 8, 51, 52).
- **Blue `#58a6ff` and orange `#ff7448`** are Merc's and Tavi's: the song strip's two rows, each
  part's label, "Merc's part" and "Tavi's part", and the two bands of the pitch-line view. Position
  and label tell the parts apart, never colour alone (FACTS 85).
- **The song strip**: ten numbered boxes a row, one a bar, two rows, Tavi's above, Merc's below,
  each row labelled; a box lights as its bar sounds. It draws no note (FACTS 40).
- **Tags** are short ink labels in a rounded box over a phrase's last bar, "Imperfect: on V",
  "Perfect: V to I", "Interrupted: V to vi", "Plagal: IV to I", with the cadence's numerals in ink
  under its bars and nowhere else (FACTS 32, 48, 49).
- **The form strip**: four blocks of eight bars, their capital letters fading in above them in ink,
  the section sounding outlined (FACTS 50).
- **Sing it is a staff with the learner's part lit**: the learner's part's notes amber `#f59e0b` on
  their beat, the other part's notes chrome, and after a run the learner's pitch line violet
  `#a78bfa` on the run's time axis under the staffs, folded into the part's octave (FACTS 60).
- **No decorative staff or clef anywhere** (SEASON-2 § 1.5 item 7): every staff on the page is
  music, and it plays.

Five things move: the Merc idle loops; a box or a note lighting as it sounds; the cursor; a tag or a
letter fading in; and Sing it's cursor. Only Merc and Tavi move on their own. Under
`prefers-reduced-motion` Merc and Tavi hold a still frame, a fade lands at once, the cursor jumps
beat to beat, and the notes light in turn with no transition; what the viewer starts still sounds.
For everyone else the masthead's Pause animations toggle stops the same things.

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Season 1's departures kept: the step toys double as the
Playground, unlocked in the Wrap once the cold open's choice is made; the mix-up card sits in Step 2,
whose question it answers; the practice card sits in the Wrap. No Watch section. The page opens in
Lesson 2's order (FACTS 5a). Each section's heading, and the line above it, are in LESSON.md
("Section headings").

1. **Masthead**: Season 1's, with the kit's seasons: "Season 2 · Lesson 28", anchors Lesson, Sing
   and Explorer, the Sound toggle off by default and Pause animations, through `initMasthead`
   (`src/features/lessons/kit/page-chrome.ts:127`) with `{ lesson: 28, deck }`. Its lesson menu
   lists the four step headings from the first paint and heads its card "Lesson 28 · What makes a
   phrase sound finished?"; no heading names a part or a chord (FACTS 1a). On a first visit its
   welcome tour waits for the cold open's choice (Toys 1).
2. **Hero, with the cold open**, laid out as Lesson 2's: the kicker, the hook as the title
   (`<h1 class="hook" id="hook">`), the meta as six chips, the promise and the sound gate from
   LESSON.md. The chips are "19 minutes" (FACTS 3); "After Lesson 18: Read and sing a whole line"
   and "After Lesson 26: A second voice", links to `/learn/18` and `/learn/26` that stay plain chips
   wherever their lesson is not live (FACTS 2); "Sound on"; "Microphone optional"; and "Headphones
   optional". The stage holds Tavi's and Merc's bubbles over Merc and Tavi, the song strip between
   them, and under it Play the song, which works from the start, and Play the ending and Play the
   way it kept going, locked until a choice; the predict card sits under the stage (Toys 1). The
   head:
   - the title, at most 60 characters: "Types of cadence and song form | MercuryPitch" (45),
     query-led as SEARCH.md § 13 item 1 decided (`docs/plans/find-your-pitch/SEARCH.md:454-456`);
   - the description, 130 characters: "How can a song sound as if it's ending, then keep going? A
     nineteen-minute lesson with sound toys and a song in two parts to sing.", which the head test
     holds to 80 to 160 characters (`src/tests/lesson-pages.test.ts:156-159`) and to the chip's run
     time in words (`src/tests/lesson-pages.test.ts:191-210`), "nineteen" among its words
     (`MINUTE_WORDS`, `src/tests/lesson-pages.test.ts:75-89`);
   - og:title and twitter:title "Cadences, form and a song in two parts · Find Your Pitch, Lesson
     28" (67), in Lesson 4's form; og:description and twitter:description the hook alone (56);
   - the share card `learn/lesson-28-og.jpg`, 1200 by 630, drawing the hero's still, the song strip
     between Merc and Tavi, with no note; its alt "The title card: Find Your Pitch, Lesson 28,
     Cadences, form and a song in two parts, above a strip of ten bars in two rows, between Merc and
     Tavi." (145);
   - the Article's structured data: headline "Cadences, form and a song in two parts",
     `alternativeHeadline` the hook, the description, `timeRequired` `PT19M`, position 28, and
     `teaches` "Perfect, imperfect, interrupted and plagal cadences", "Song form written as letters,
     A A B A, and verse and chorus" and "Reading and singing one part of a song in two parts, in
     time"; and on release a line in llms.txt in its own form (`public/llms.txt:78-80`): "- [Lesson
     28: Cadences, form and a song in two parts](https://mercurypitch.com/learn/28): How a song can
     sound as if it's ending, then keep going. The four cadences, a song's form written as letters,
     and how to read and sing one part of a song in two parts."

   Nothing a learner can meet before the choice, the title, the descriptions, the share card and
   its alt, says which part changes at bar 8 (FACTS 1a). Lengths: `verify28.py`, section 10.

3. **Recall from Lessons 18 and 26**, straight after the hero, shown to everyone (Toys 5; FACTS 7).
4. **Three words you'll meet**: Cadence, Section and Form, with their figures (Toys 4).
5. **Steps**: the step deck, four steps, the song's staffs stuck beside the text (Toys 2), Step 2's
   mix-up card in its text, Step 2's words held for the cold open's reveal, and Step 3's form strip
   (Toys 3).
6. **Sing it**: the comfort check, the voice choice and its line, the headphones check, the "What
   this does" box, Start, the quiet check, Your turn, the runs, their readings, the playback and
   "How did that feel?"; the alone path; or the sing-along (Toys 6).
7. **Quick check**: four questions, none held (Toys 5).
8. **Wrap**: the three lines, the one-sentence challenge, the practice card in the version Sing
   it's ending picks (Practice links), the season's close in place of a next-lesson card (Toys 7),
   and free play, the steps' staffs in every state, drawing the hero's empty bars under its lock
   line until the cold open's choice (Toys 2).
9. **Explorer**: the season's map with a tab per season, opening on Season 2's.
10. **Footer**: LESSON.md's, with the practice links, the fonts line and Lesson 14's "Every example
    on this page is synthesised in your browser. The only recording it plays is your own, on this
    device."

## Length

The learner copy is 2,051 words on `node scripts/lesson-words.mjs`, every branch counted (FACTS 3),
under the series' cap of 2,379. Each step's own text, with its Try, its Notice and any Tavi line,
runs 100, 107, 109 and 117 words, inside 50 to 120 a step.

The built page is counted as the review counts it: the brief's 150 for the hints and status lines a
built page writes in the open (Lesson 8 FACTS 4), plus every line this page adds that the counter
would count, 151 in all (`verify28.py`, section 11): the hero's strip labels, "Tavi's part" and
"Merc's part" (4); the answering plays, "Play the ending" and "Play the way it kept going" (9); the
predict's two "You said" lines (8); the steps' figure's lock line, "Choose an answer at the top to
unlock this figure." (10); the steps' staff labels, the same two (4); Step 1's tags, "Imperfect: on
V" and "Perfect: V to I" (7); Step 2's switch, "Perfect · Interrupted · Plagal", its tags
"Interrupted: V to vi" and "Plagal: IV to I", and the tag's word, "A-" and "men" (13); Step 2's held
line, "Hear both ways at the top to unlock this step." (10); Step 4's Play both (2); the steps'
"See it on the pitch line" (6); the stored voice's line (9); the quiet check's line when it hears a
note (18); Sing it's status lines, "Counting in: one bar.", "Your turn: sing in time with the
cursor." and "Done for today." (15); Sing it's lock line, the figure's (10); Sing along again (3);
the close's rest line, "You've read a song in two parts." (7); and free play's lock line and its
"See it on the pitch line" (16). Marks that are a numeral, a letter or a single name, the bar
numbers, the cadences' numerals, the form's letters and free play's state numbers, are not counted,
as a chart's ticks are not; the section lines above the headings and the kit's own hints sit inside
the 150, as Lessons 24 and 26 count them. So the built page runs about 2,051 + 150 + 151 = 2,352
words, 27 under the cap.

The page runs about 19 minutes: 9.88 of reading the built page at 238 words a minute and about 8.98
of sound, toys and tasks, 18.87 in all, near the plan's "about 20 minutes (lab-timed)" and under the
season's cap of 20 for a film; the text's count alone gives 17.60. It is the season's longest page,
as SEASON-2 § 1.3 expects of Lesson 28. The chip, the head's "A nineteen-minute lesson",
`timeRequired` `PT19M` and the season's `minutes` say 19 until the staffs' plays and the runs are
timed in their lab (SEASON-2 § 1.3), which may move them. Its sounds carry the time: the song's
plays are long at 72 beats a minute, eight bars 26.7 seconds (FACTS 38). These parts carry more
words, for these reasons:

- **Sing it, 591 words.** It holds the series' singing lines, Lesson 3's, Lesson 18's, Lesson 24's
  and Lesson 26's word for word, which are not cut; the headphones and quiet checks, which the
  scored path needs; the briefing and the headphones line; the "What this does" box with Lesson
  14's two sentences on a recording; the reading's example lines; the playback and its cadence line;
  the feelings' lines with Lesson 14's take lines; the sing-along; and the can't-record line (FACTS
  53 to 69).
- **The Wrap, 251 words.** The three lines, the challenge, Karaoke Night's card in Lesson 14's
  words with its care lines and rest version, Cadence as the second drill, and the season's close
  (FACTS 5, 70 to 73).
- **Step 2, 177 words with its mix-up card**: the card sits in the step whose plays refute it.
- **The quick check, 178 words, and the recall, 157**: three answers a question with a line of
  feedback for each, as MASTER-PLAN § 4.2 item 8 asks; the recall is Lessons 18's and 26's, word for
  word.

The cuts, every fact they carried staying in FACTS. The first draft counted 2,175 words, about 2,480
built, and was cut in the reveal, Steps 1 to 4, Your turn, the voice line, the headphones line, the
playback's lead-in, the feelings' line, the quiet check's fail line, the quick check's feedback, the
Wrap's second line and the Ear Lab line, and by the plan's Lesson 14 recall question, the mix-up
card's "and a song can end on one", and Karaoke Night's "Ten minutes, gently, most days. Missed a
day? Just come back." (11), Lesson 14's habit line, which this card leaves out. If a build's own
count still runs over the cap, the next cuts are the can't-record line (16), whose state can show
its playback button absent with the kit's own hint, and the Easy or Workable line, "Your part, read
in time from the page." (8).

The activities are timed from FACTS 3 and 38. Free play is not counted.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                                                              | New in Lesson 28                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Hero and predict       | The kit's predict (`kit/predict.ts`) with a free play, `onChoice`, `unlocks` and two reveal elements; the tour's hold (`kit/tour-gate.ts`); the staff toy for the answering plays                                                                                   | The song strip; two staffs written as both ways play; bar 8's ring after the reveal                                                                                                   |
| 2. The steps' staffs      | Season 2's staff toy with key signatures and rhythm, as Lessons 15, 17, 18 and 21's specs build it, with Lesson 18's cursor, breath marks and lock; the page's one sound owner                                                                                       | Two staffs in one figure, a part on each; four step states and free play, the hero's empty bars until the choice; tags; the cadences' numerals; the plagal tag's chords and its word |
| 3. The form strip         | The step deck's stage                                                                                                                                                                                                                                               | Four blocks, A A B A, the letters fading in as their sections play; B written on the staffs as it plays                                                                               |
| 4. Three words            | Lesson 5's word tickets (`lesson-05/words.ts`), with the page's sound owner                                                                                                                                                                                         | Cadence's play of bars 3 and 4; Form's letters                                                                                                                                        |
| 5. Recall and quick check | The kit's quiz (`kit/quiz.ts`), its prefix, keys and away links; Lessons 18 and 26's question objects, once built                                                                                                                                                   | Ids `l28-q1` to `l28-q4`; quick check 4's play                                                                                                                                        |
| 6. Sing it                | Lesson 18's sing flow, take read in time and in-time reader; Lesson 24's headphones and quiet checks with Lesson 26's options; Lesson 26's part under a take and its reader's rule; Lesson 14's recorder; the comfort check, voice choice and feelings (`kit/comfort.ts`) | Fourteen notes at 72 beats a minute in halves and wholes; the playback with the other part and its cadence line; the alone path; the voice line                                       |
| 7. The season's close     | The kit's next-lesson card and its slot (`kit/next-card.ts`), its close (`endCard`)                                                                                                                                                                                  | Season 2's close and its rest version; its figure                                                                                                                                     |
| 8. Tease still            | Lesson 27's next-lesson card and its slot                                                                                                                                                                                                                            | This page's stage as a still, which plays nothing                                                                                                                                     |

### 1. The hero and the cold open's predict

The song strip between Merc and Tavi: ten numbered boxes in two rows, Tavi's above in orange and
Merc's below in blue, each row labelled "Tavi's part" and "Merc's part", with no note and no staff
(FACTS 40). It takes no taps.

- **Play the song** is a free play (`[data-free]`): the song as it kept going, ten bars, both parts
  on "ooh", 33.33 s, as one run (Audio), each bar's two boxes lighting as it sounds. It works before
  a choice and never reveals.
- **The predict card**: LESSON.md's question and its two choices, with the kit's hints: before a
  choice, "Choose an answer to unlock both ways."; after one, "Locked in. Play both ways."; a play
  that sound off kept silent, "Sound is off: nothing played. Turn sound on, then play it again.";
  after the reveal, "Play either again." No "Now play the other one." shows: the locked-in hint
  holds until the reveal. The choice holds for the visit, in memory.
- **Play the ending** and **Play the way it kept going**, the answering plays, locked until a
  choice: bars 7 and 8, both parts, 6.67 s each, the first with G3 in Merc's part at bar 8 and the
  second with E3. As each starts, the strip's bars 7 and 8 open into two staffs, treble above bass,
  the key's sharp after each clef, and each note is written as it sounds, lighting; each play draws
  its own pair of staffs, the ending's above the other way's. The predict's `revealOn` names both,
  and `revealAfter` is `'all'` (FACTS 43).
- **The reveal** waits until both are heard to their end with sound on, and shows two elements,
  which the kit announces in order: the hero's reveal, "You said: …" and LESSON.md's text; then Step
  2's held words, in its step (Toys 2). The predict's `onReveal` hides Step 2's held line and rings
  bar 8's note in Merc's part on both pairs of staffs, G3 and E3, with V and I, V and vi, under the
  bars.
- **Spoken summary** of the figure, in words: at first, "The song in two parts, ten bars: Tavi's part
  above, Merc's below."; after each answering play, "Bars 7 and 8, the ending: Tavi's part F sharp 4
  to G 4, Merc's D 3, D 3, then G 3." and "Bars 7 and 8, the way it kept going: Tavi's part F sharp
  4 to G 4, Merc's D 3, D 3, then E 3."; the summaries come only after their plays.
- **The tour**: the first-visit tour's step "One step at a time" scrolls to the steps' stage, past
  the predict, so the page holds it until the choice (`holdTour`,
  `src/features/lessons/kit/tour-gate.ts:57-69`), with no time limit (FACTS 1a, 46).

### 2. The steps' staffs

One figure on the step deck's stage: the song on two staffs, Tavi's part in the treble clef above
and Merc's in the bass clef below, the key's one sharp after each clef, 4/4, the bar numbers, the
house on do and the breath marks after bars 2, 4 and 6. Every state plays its notes as it draws
them, under a cursor at 72 beats a minute; "See it on the pitch line" redraws both parts as bands on
semitone rows, Merc's blue and Tavi's orange, and back.

- **The lock**: until the cold open's choice the figure draws only the hero's ten empty bars, every
  control disabled, under the line "Choose an answer at the top to unlock this figure."; from the
  page's `onChoice` each step draws its own state. The lock is the page's: the kit's `unlocks`
  disables controls and hides nothing (`src/features/lessons/kit/predict.ts:66-67`), so the figure
  draws the strip until the choice and the staffs from then on. The plays in the steps' text wait
  with it. A return visit holds it again (FACTS 46).
- **Step 1**: the A section, bars 1 to 8. Play bars 1 to 4 and Play bars 5 to 8, 13.33 s each; as a
  phrase's last bar sounds, its tag fades in over it, "Imperfect: on V" over bar 4 and "Perfect: V to
  I" over bar 8, and its numerals under its bars, V, then V and I (FACTS 48).
- **Step 2**: the staffs from bar 7, and a three-way switch, "Perfect · Interrupted · Plagal".
  Perfect plays bars 7 and 8 as the song ends, 6.67 s; Interrupted plays bars 7 to 10, the way it
  kept going, 13.33 s; Plagal plays bars 7 and 8, then the tag, 13.33 s: both parts hold G, G4 and
  G3, on "ooh" for two whole notes while the soft tone plays IV, C3, C4 and E4, then I, B3 and D4,
  "A-" and "men" written under the two notes and IV and I under the bars; the tag's chords are named,
  not engraved. Each way ends on its tag, "Perfect: V to I", "Interrupted: V to vi" or "Plagal: IV to
  I". The text's two plays sound Interrupted and Plagal (FACTS 33, 35, 49).
- **Step 3**: the form strip (Toys 3) above the staffs.
- **Step 4**: the A section; tap a staff to hear its part alone, 26.67 s, or Play both; the text's
  Play Tavi's part and Play Merc's part are the same plays (FACTS 51).
- **Free play**, in the Wrap: the figure in every state, with a state switch, 1 to 4, and every
  control, under the same lock until the choice.
- **Spoken summaries**, words only: "Bars 1 to 8 on two staffs, G major: Tavi's part in the treble
  clef, Merc's in the bass clef." and, after a tag, its words; under the pitch line, "Both parts as
  bands: Tavi's from F sharp 4 to D 5, Merc's from D 3 to B 3."

### 3. The form strip

Four blocks of eight bars, A A B A, 32 bars in all, above the staffs. As a section plays, its block
outlines and its letter fades in above it, and the staffs show that section, B written as it plays.
The text's Play B, then A plays bars 17 to 32, 53.33 s; tapping a block plays its section, 26.67 s.
Under the lock it draws the hero's empty bars, as Toys 2 does. The bridge is never sung (FACTS 36,
50). Form's Show the letters, in the three words, draws the same four blocks with their letters at
once, small, and plays nothing.

### 4. Three words

Lesson 5's word tickets, with the page's sound owner. Cadence plays bars 3 and 4, both parts, 6.67
s, its two bars lighting on a small strip; Section has no play; Form's Show the letters draws the
four blocks (Toys 3). None sounds bar 8 (FACTS 47).

### 5. Recall and quick check

- **Recall**: Lesson 18's question 2 and `l26-q2`, imported from their modules, with their away
  links reading "Try Lesson 18, Step 2 again" and "Try Lesson 26, Step 2 again" and opening those
  pages at that step in a new tab, under the recall's own seed and record keys, `fyp-l28-recall-seed`
  and `fyp-l28-recall-v1` (FACTS 7).
- **Quick check**: LESSON.md's four questions, ids `l28-q1` to `l28-q4`, keys `fyp-l28-seed` and
  `fyp-l28-quiz-v1`, and `lesson: 28`, so answering all four marks Lesson 28 done. Three answers
  each, shuffled; "Right." or "Not quite." before each feedback line. None waits for the cold open's
  choice: no question or answer names a part or a note of bar 8, and question 4's Play sounds bars 5
  to 8 the way the song kept going, both parts, 13.33 s, the hero's free play's notes, its button
  reading "Play" (FACTS 77 to 80).

### 6. Sing it: one part of the song

Lesson 18's sing flow, as its spec moves it into the kit, with a take read in time; Lesson 24's
headphones check and quiet check with Lesson 26's options; Lesson 26's part under a take; and Lesson
14's recorder, with these changes: the learner reads fourteen notes of halves and wholes from the
staff at 72 beats a minute; the take is recorded and played back with the other part; without
headphones the learner sings alone. Every state has a visible status line that is also announced
(`aria-live="polite"`). Until the cold open's choice Sing it's plays, Play the song, Start and Start
the sing-along, are disabled under the line "Choose an answer at the top to unlock this figure.",
since each sounds the song's ending; the staffs show the song as written (FACTS 1a).

States:

1. **Comfort check**, always first and asked every visit, never stored: Lesson 3's line, its list
   of six conditions and its two buttons (FACTS 53), through the kit's `mountComfort`
   (`src/features/lessons/kit/comfort.ts:159`).
2. **Voice choice**, after either comfort answer when none is stored, and before anything in Sing
   it plays: Lesson 3's two buttons with Merc's and Tavi's stills (`aria-pressed`, at least 44 px),
   under LESSON.md's line in its two forms, then LESSON.md's line on the parts (FACTS 55); it reads
   and writes `fyp-voice` (`src/features/lessons/kit/voice-choice.ts:20`). The lower voice sings
   Merc's part with do on G3, the higher Tavi's with do on G4; the staffs' learner's part lights
   amber. No Move do and no other octave (FACTS 68).
3. **Just listen today**: LESSON.md's line with the doctor lines, and **Play the song**, bars 1 to
   8, both parts, 26.67 s, again on each tap, the notes lighting as they sound. Nothing listens; the
   headphones check, Start and the sing-along do not show, and nothing asks the viewer to sing
   (REQ-GVC-021, REQ-GVC-055). The Wrap shows the rest card and the close's rest version (FACTS 54).
4. **Headphones check**: LESSON.md's line, "Tavi's part" read "Merc's part" for the higher voice,
   with **I have headphones on** and **No headphones**. The answer holds for the visit, in memory,
   never stored, and can be changed (FACTS 56).
5. **Briefing**: the "What this does" box (REQ-GVC-002, REQ-GVC-003, REQ-GVC-012, REQ-GVC-026;
   FACTS 57), Your turn and its headphones line, the stop line on its own line, and **Start**, the
   only control that asks for the microphone, through the kit's listener under the page's consumer
   id, `lesson-28`. With sound off, Start asks for nothing and plays nothing, with the hint "Sound is
   off, so nothing played. Turn sound on to hear do, then press Start." A refused microphone, or none,
   opens the sing-along (state 11).
6. **The quiet check**, with headphones only, after the microphone opens and before every run,
   Again's included: LESSON.md's line, and the first 2.0 s of the other part at the run's level,
   nothing else playing, while the listener reads the frames. It fails on any voiced run of 0.3 s or
   more at any pitch; then no run starts, the line reads LESSON.md's fail line, and Start stays
   under it, so the check can run again, beside the headphones check's No headphones (FACTS 56).
7. **The run, together**: do, sung by Merc for the lower voice or Tavi for the higher, 1.0 s; 0.4 s
   of quiet; the count-in, Lesson 18's one bar of woodblock, here at 72 BPM, 3.33 s, beat 1 higher,
   the strip lighting a dot a click, status "Counting in: one bar."; then the take, as Lesson 18's:
   frames kept from half a beat before bar 1's first beat, read in time from the singer's first note,
   and recorded from the same moment. From bar 1's first beat the other part sings, the one sound
   the take allows (Audio), its notes lighting chrome, and the cursor moves at the beat, the
   learner's notes lighting amber on their beats, status "Your turn: sing in time with the cursor.";
   nothing draws the learner's line. The take ends when the last note's window closes, as Lesson
   18's does, 26.67 s after bar 1's first beat at the earliest (FACTS 58, 59).
8. **The run, alone**, after No headphones: states 5 and 7 with nothing playing during the take, no
   quiet check, and the same status; the reader has no other part to compare (FACTS 63).
9. **After the run**, 0.5 s later: the learner's pitch line drawn under the staffs on the run's time
   axis, folded into the part's octave with the octave tag where it applies; under it, one line a
   note in order, from the reading (The reader, below). If no note's window held any voice: "We
   didn't hear you start that time. Come in on bar 1, after the count-in.", with **Start again**
   while the visit has takes left, no recording kept and no feeling question (FACTS 61, 65). With
   voice: **Hear it with Tavi's part** (Merc's for the higher voice) and **Delete your take**, and
   the line "The song ends V to I: a perfect cadence." (The playback, below; FACTS 62, 69).
10. **How did that feel?**: Lesson 3's four answers after each run with voice, an answer that
    locks, through `mountFeelings` (`src/features/lessons/kit/comfort.ts:175`), with what each
    allows from the kit's rule (`afterFeeling`, `src/features/lessons/kit/comfort.ts:56-87`) and the
    rest card after Effortful (`restAfterEffort`):
    - Easy or Workable: the tricky line where the visit's rules give it, then LESSON.md's line,
      with **Again** (while the visit has takes left) and **Done for today**.
    - Effortful: the lines stay; no Again; "Keep it gentle: rest before you sing again." and Lesson
      14's take line, with only **Done for today**; the take stays to play back or delete; the Wrap
      shows the rest card and the close's rest version.
    - Uncomfortable: the lines and the pitch line are taken away; no Again; "Thanks for saying so.
      That's enough singing for today: rest your voice." with the doctor lines and Lesson 14's take
      line; the take stays to play back or delete; the microphone is released; the Wrap shows the
      rest card and the close's rest version (REQ-GVC-021, REQ-GVC-023, REQ-GVC-024).
    - Once "Effortful" or "Uncomfortable" has been answered, no further run and the rest card stay
      so for the visit, in memory (`VisitEnding`, `src/features/lessons/kit/comfort.ts:101-114`).
11. **The sing-along**, for no microphone or a refused one: LESSON.md's line and **Start the
    sing-along**: do, 0.4 s of quiet, the count-in, then the other part, 26.67 s, the cursor moving
    and the learner's notes lighting as their beats come; nothing listens, nothing is recorded and
    no line is drawn. Then "How did that feel?" with the same endings; Easy or Workable offers **Sing
    along again**, once a visit, the cap Season 1's sing-alongs put on their Again (the kit's
    `AfterFeeling`, "still offered only once a visit", `src/features/lessons/kit/comfort.ts:41`), and
    **Done for today** (FACTS 64).
12. **Done for today** ends the checkpoint with the status "Done for today." and leaves the practice
    card and the close in the version the visit's ending picks.

**The visit's rules** (FACTS 65): three takes a visit, every take counted, one with no voice or one
cut short when the page is left or hidden too, as Lessons 18, 24 and 26 count them (`MAX_TRIES`,
`src/features/lessons/kit/take.ts:54`); Again sings again, the quiet check first with headphones,
and records its take in the last one's place; no celebration: the reader's lines say where notes
sat, and Merc and Tavi only listen after a run; the tricky line follows a run with under half its
notes in the band.

**The reader** is Lesson 18's in-time reader as its spec gives it
(`docs/plans/find-your-pitch/lessons/18-read-a-line/WEB-SPEC.md:449-505`), with Lesson 26's input
of the other part's notes and its rule for a note sung on the other part's note
(`docs/plans/find-your-pitch/lessons/26-second-voice/WEB-SPEC.md:451-479`): this page restates
neither. It reads fourteen notes, twelve half notes and two whole notes, at 72 BPM, from the
learner's part; with headphones the other part's fourteen notes come with their onsets as booked,
named "Tavi's" or "Merc's". What this page adds is a case, not a rule: at bar 8 both parts sing G,
an octave apart, so the learner's G there is their own note folded; the own-note rule, read first,
reads it in the band, and the other-part rule never names a note sung on the learner's own note
(FACTS 39, 60). On the alone path the other part's notes are not passed, and the reader is Lesson
18's alone. The lines take "your part's note" where Lesson 18's take "the written note", through
`gapWords`, which takes whose note it is (`src/features/lessons/kit/band-words.ts:55-61`).

**The playback.** The recorder is Lesson 14's proposed `kit/record.ts` over the app's own recorder,
`createTakeRecorder(listener.media)` (`src/lib/voice-capture.ts:82`), as Lesson 14's spec gives it:
started when the take opens, stopped when it ends, the take decoded into a buffer on the page's one
audio context and kept in memory only, beside the take's lines, until Delete, until Again records
its next take, or until the page is left; played at one set level, past the master bus's
compressor; a take that cannot be decoded leaves its lines and no playback, with the can't-record
line. What is new is the other part with it: Hear it with Tavi's part schedules, on one audio-clock
time, the buffer from the point that was bar 1's first beat in the take and the other part's
contour voice from its bar 1, the two ending together, 26.9 s; during the playback the staffs'
cursor runs again and both parts' notes light. A device's round trip, output and input, puts the
voice late against the part by that much; the app keeps a measured round trip per device and treats
zero as uncompensated (`src/stores/mic-latency-store.ts:1-23`), but a lesson page reads none of it,
so the playback is uncompensated and the lab measures the offset (What the kit and the app still
need, item 9). On the alone path the playback is the only time the two parts sound together, which
is the point of the turns (FACTS 62, 63).

Run on synthetic takes before the lab (Tests 7): the lower part sung on pitch and on time reads every
note in the band; sung a beat late, the same, as the anchor allows; bar 7's two D3s sung as one held
note reads the second D3 on its own note, since its window holds the same pitch; bar 8's G sung as
G3 or G4 reads in the band, the second with the octave line; the lower part's ti sung on Tavi's re,
A, reads "Ti · That was Tavi's note: re."; the higher part's mi sung on Merc's do, G3, in bar 1 reads
"Mi · That was Merc's note: do."; a take on the alone path reads no note as the other part's; and a
take of frames on the other part alone, the voice silent, which only the together path can make,
reads every note as the other part's, which is why the quiet check runs before every run and the lab
test comes first.

### 7. The season's close

The Wrap's last card, in the page's `[data-next-card]` mark, drawn by the kit's close
(`endCard`, `src/features/lessons/kit/next-card.ts:148-174`) in Season 2's words, which the kit
does not have yet (What the kit and the app still need, item 3): the eyebrow "End of Season 2", the
line "You've read a song in two parts. Now sing a whole song.", **Karaoke Night**, a link to
`/karaoke-night?lesson=28` in a tab of its own, marked with the out icon, and **See the season map**,
`#explorer`. After "Effortful", "Uncomfortable" or "Just listen today" it reads "You've read a song in
two parts." with See the season map alone. The card holds two links, so it is no link itself. Its
slot, which the kit keeps after its words (`src/features/lessons/kit/next-card.ts:27-30`), holds the
figure: an SVG, `aria-hidden`, of the four section blocks, A A B A, and along them a staff, a beat
grid, Lesson 12's ring and Lesson 6's beads, drawn in light, with no note; it does not move and plays
no sound (FACTS 5, 85). No tease and no next lesson appear anywhere on the page (SEASON-2 § 7 item
8).

What the kit's card does on this page today, at `c60f0fdcb`: `createNextCard(28)` reads the page's
season, which holds Lessons 0 to 14; `nextCard` finds no Lesson 29 and no Lesson 28, and returns
null; the card is not drawn, and the mark stays as the page wrote it, its figure with no words
(`nextCard`, `src/features/lessons/kit/next-card.ts:91-121`; `createNextCard`,
`src/features/lessons/kit/next-card.ts:176-210`). With Season 2's lessons in the same list it would
draw the close in Season 1's words, "End of Season 1" and "You've seen every note you sing. Now sing
a whole song." (`SEASON_END`, `src/features/lessons/kit/lesson-copy.ts:130-141`), and Lesson 14's
page would draw Lesson 15's card instead of its own close. Either way it draws once and never redraws
(`src/features/lessons/kit/next-card.ts:190-193`), so it cannot follow Sing it's ending (FACTS 5).

### 8. Tease still

The drawing in Lesson 27's next-lesson card's slot, which that page's mark keeps after its words: an
SVG, `aria-hidden`, of this page's stage as its cold open opens, the song strip's ten empty bars in
two rows between Merc and Tavi, no bubbles and no note. It holds no button, since the card is a
link, does not move and plays no sound. Its styles go under a class of its own, not the tease line's
`.next-tease` (FACTS 5b).

## Audio

Every sound is synthesised in the page with Web Audio, through the kit's sound module, its master
bus and its house envelopes, and started only by a tap. Nothing autoplays, and the page has no music
bed (FACTS 81 to 83).

- **The sound rules**, for every source of sound on the page (the cold open's three plays, the
  words' play, every play of the steps' staffs and of free play, quick check 4's play, do, the
  count-in, the other part, the playback and the sing-along):
  1. One sound plays at a time, across the whole page: a new play stops the one before. Two parts
     playing together, or the tag's chords with the parts, are one sound.
  2. Leaving a step, by any route, stops its sound and any queued play; scrolling Sing it off screen
     for 600 ms, or hiding the page, stops what plays there and abandons a take.
  3. A play that is cut short never counts as heard by the predict.
  4. During a take only the other part plays, and on the alone path nothing: every play control is
     disabled from Start until the take ends.
  5. A play that would answer the predict, any play that sounds the song's ending, stays disabled
     until its choice, wherever it sits on the page (Toys 1, 2, 6).

  The kit has the page-wide owner every source registers with (`NowPlaying`,
  `src/features/lessons/kit/now-playing.ts:39`).

- **Two parts note against note.** Every two-part play outside a take, the cold open's, the steps',
  the word's, free play's, quick check 4's and "Just listen today"'s, is one `playNotes` run holding
  both parts' notes, each note its own voice, so notes that share an onset start in one timer task
  (`src/features/lessons/kit/run.ts:9-10`); the tag's chords are notes of the same run in the soft
  tone (`src/features/lessons/kit/run.ts:38-39`). Bar 7's two D3s are two notes, so the second
  sounds as a new note. Nothing new is needed for these.
- **Timbres.** Both parts sing on Merc's "ooh", Tavi's part at her pitches, in every play, since the
  cold open says Merc and Tavi sing; the tag's chords are in the soft tone; do in Sing it is the
  chosen voice's "ooh"; the count-in is the woodblock.
- **A part under a take.** The kit holds every sound off while a take is open
  (`src/features/lessons/kit/sound.ts:533-541`). The other part is the one exception, as Lesson
  26's item 6 has it for this page: one voice along a contour (`contourVoice`,
  `src/features/lessons/kit/sound.ts:315-347`), each note a held point at its pitch, joined to the
  next by a glide of 0.05 s, built before the take opens and booked on the audio clock to start on
  bar 1's first beat through the voice's `at` (`src/features/lessons/kit/sound.ts:39-43`). Its two
  D3s in bar 7, for the higher voice, are struck again by a dip in the contour's level, to a quarter
  for 0.08 s between them; and at each breath mark, after bars 2, 4 and 6, its level falls to a
  quarter for the last half beat, 0.42 s, of the note before the mark, so it breathes where the
  learner breathes. Its release ends it as its last note ends (FACTS 59, 67).
- **The playback** plays the take's buffer and a new contour voice of the other part, started on one
  audio-clock time, through the page's owner as one sound (Toys 6).
- **Levels.** A note at the kit's 0.13 and Merc's "ooh" at 0.2
  (`src/features/lessons/kit/sound.ts:181`); in a two-part play each part at 0.2, the master bus's
  compressor holding the two (`src/features/lessons/kit/sound.ts:109-118`); the tag's chords at
  0.13 a voice. In a run the other part sits at a level the lab sets, so the singer's own voice stays
  clear in the headphones; the playback sets the take's peak to one level, the same for every take,
  and the part under it at the run's level.
- **Low notes.** The page's lowest sounds are C3, 130.81 Hz, the tag's IV in the soft tone, and D3,
  146.83 Hz, Merc's part's lowest; the lab hears both on a phone's speaker.

## Merc and Tavi

Lesson 1's setup through the kit (`src/features/lessons/kit/merc-duo.ts`): the app's renderer loaded
after first paint, one WebGL context per Merc, medium quality on phones, paused off screen, and the
stills when WebGL fails.

- They live in the hero, on either side of the song strip. Tavi asks and Merc answers in the
  bubbles, which show from the start. While the cold open's plays sound, both sing their parts
  (`mercSing`, `src/features/lessons/kit/merc-duo.ts:165`), Merc's lower and Tavi's upper; after
  the reveal Tavi gives a quiet "oh", with no sparkles (`mercCelebrate`,
  `src/features/lessons/kit/merc-duo.ts:217`; `MercDuoOptions`,
  `src/features/lessons/kit/merc-duo.ts:119`).
- In the steps their parts are the staffs' parts, labelled with their names; they do not appear
  there.
- In Sing it the Merc who sings do appears as a still beside the figure, Merc for the lower voice
  and Tavi for the higher, and the other sings the other part; during a take the singer's still
  listens (`mercListen`, `src/features/lessons/kit/merc-duo.ts:207`); after a run both listen, with
  no celebration.
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Karaoke Night**: the link is `/karaoke-night?lesson=28`, printed
  mercurypitch.com/karaoke-night (`KARAOKE_PATHS`, `src/worker.ts:92`), as Lesson 14 links it. The
  card is Lesson 14's, read again in the app: it draws every note sung against the one aimed for and
  plays the singer's take back, keeping it in memory; it scores the singing in any octave, comparing
  pitch class; its example song is free; its key chip moves a song up or down by up to six semitones
  and Find my key picks a key from the singer's range, so a song can sit in the comfortable middle of
  every preset; its care lines are Lesson 10's. It reads no lesson marker and shows no intro, so the
  card has no first-visit line (FACTS 70, 71). Lesson 14's "Ten minutes, gently, most days" is left
  out for length (Length).
- **The second drill, Ear Lab's Cadence**: `/ear-lab?lesson=28`, printed mercurypitch.com/ear-lab,
  then tap Cadence (`/ear-lab`, `src/lib/sw-runtime.ts:123`). The card opens on Lesson 12's line and
  says what the drill does to a learner: it strums a progression of three or four chords on the
  guitar voices in a roved key and asks for it in numerals from four pads; it names progressions,
  not cadences; five of its eight stop on V, as an imperfect cadence does; it asks for no voice,
  writes no staff and plays nothing a learner must sing (FACTS 72, 73). It asks for no voice, so it
  stays on offer under the rest card.
- **Left out: Jam's Harmony Stack**, which the plan and SEASON-2 § 5.1's row link: it needs two
  singers in a room, gives each a chord tone of a scale, and its card is Lesson 26's, with its two
  app items still open (FACTS 74; SEASON-2 § 5.1, row 28, `docs/plans/find-your-pitch/SEASON-2.md:844`).
- **The rest version.** After "Effortful", "Uncomfortable" or "Just listen today" the card shows
  Lesson 14's rest line, headed "Rest today", and is no longer a link, naming Karaoke Night; the
  second drill stays (`mountPractiseCard`, `src/features/lessons/kit/comfort.ts:126-149`).
- **The first visit and the marker.** Nothing reads `?lesson=28` until SEASON-2 § 5.2 item 21
  widens the marker, and until then the quiz's answers are refused whole; the page is not built
  before that (FACTS 75).
- **Needed: a cadence-type ear drill** (SEASON-2 § 5.2 item 19,
  `docs/plans/find-your-pitch/SEASON-2.md:897-899`), the app's work: a bank of perfect, imperfect,
  plagal and interrupted cadences, as a new drill or a mode of Cadence. When it ships, it takes the
  second drill's place, with a card that says what it plays and asks.
- **Needed: the harmony-line drill** (SEASON-2 § 5.2 item 17,
  `docs/plans/find-your-pitch/SEASON-2.md:891-893`), the app's work, which Lesson 26's card takes
  first when it ships; this page's card can add it then, as a drill for singing a part alone.
- No premium exercise is linked: Karaoke Night's example song and Ear Lab are free (FACTS 76).

## Explorer and season data

Lesson 28's entry, proposed for Season 2's data in its own module, in Season 1's entry form, as
Lesson 14's is (`src/features/lessons/kit/season.ts:405-419`):

- `n: 28`, `lane: 'both'`, `title: 'Cadences, form and a song in two parts'`, `short: 'Cadences'`,
  `topics: ['T22', 'T31']`, with their names as SEASON-2 § 4.1 gives them, "Phrases and cadences"
  and "Song form"; the hook word for word (FACTS 1); `minutes: 19`, which the lab may move (FACTS
  3), and `page: '/learn/28'` once the page is built, under the drafts' comment.
- `pr.link`: `href` `/karaoke-night?lesson=28`, `addr` `mercurypitch.com/karaoke-night`, `label`
  "Karaoke Night"; `pr.needs`, "A cadence-type ear drill (SEASON-2 § 5.2 item 19); the harmony-line
  drill (item 17)", is the team's only: the field is "Admin only, never drawn on a lesson page"
  (`src/features/lessons/kit/season.ts:102-103`).
- `EDGES` gains [18, 28] and [26, 28], as SEASON-2 § 4.3 gives them (FACTS 2); Lesson 28's
  prerequisite list is then [18, 26] (`PREREQ`, `src/features/lessons/kit/season.ts:453-457`).
- The tease on Lesson 27's card is this lesson's, set on Lesson 28 in the lesson copy
  (`LESSON_COPY`, `src/features/lessons/kit/lesson-copy.ts:79`): `tease` "A song in two parts. At
  bar 8 it seems to end, then keeps going.", 64 characters, inside `TEASE_MAX`
  (`src/features/lessons/kit/lesson-copy.ts:76`), with no `teaseAlts`, as the lead bound it (FACTS
  5b). This page's card is the season's close, so no lesson's tease is set for it.
- The season's close for Season 2, in the kit (What the kit and the app still need, item 3): its
  eyebrow "End of Season 2", its line "You've read a song in two parts. Now sing a whole song." and
  its rest line "You've read a song in two parts.", with Karaoke Night and the map (FACTS 5).
- The signature line for the admin console (`SIGNATURES`,
  `src/features/lessons/kit/team-notes.ts:31-46`), from the card (FACTS 4): "A song in two parts on
  two staffs, Merc's lower part blue and Tavi's upper part orange; a tag names each phrase's cadence,
  and form letters gather above the sections."
- The explorer's card shows "19 min" once the page is live.

## What the kit and the app still need

Found in the kit and the app as they stand on main at `c60f0fdcb`. Every item is proposed.

1. **The lesson host**: `learn/28.html` at `/learn/28`, which every build takes as a lesson page
   (`lessonPages`, `tools/draft-lessons.ts:81-89`); `/learn/28` and `/learn/28.html` in
   `STANDALONE_DOCUMENT_PATHS` (`src/lib/sw-runtime.ts:93`); the first-paint budgets. The lesson
   pages' route already takes any two digits (`LESSON_PAGE`, `src/lesson-gate.ts:134`).
2. **The draft line**, in the draft list's form:
   `28: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`, as Lesson 5's
   (`src/features/lessons/kit/drafts.ts:31-41`).
3. **Seasons in the kit, and a close per season** (SEASON-2 § 6.2 item 1), required before this page
   is built:
   - a season that knows its last lesson, so `nextCard` stops at it: today it looks for lesson n + 1
     in one list (`src/features/lessons/kit/next-card.ts:91-121`), so with Season 2 in that list
     Lesson 14's page would draw Lesson 15's card, and Lesson 28's draws nothing until it is in the
     list;
   - a close per season: `SEASON_END` is one, "End of Season 1"
     (`src/features/lessons/kit/lesson-copy.ts:130-141`); Season 2's is LESSON.md's, its eyebrow, its
     line and its rest line, with the same two ways on, kept free of the team's words as the copy's
     test asks;
   - the rest-aware close Lesson 14's item 12 requires, for both seasons: after "Effortful",
     "Uncomfortable" or "Just listen today" the close keeps the rest line and the map and drops the
     invitation and its Karaoke Night button; since the kit draws the close once
     (`src/features/lessons/kit/next-card.ts:190-193`), either `createNextCard` redraws it when the
     visit's ending changes or the page draws it once Sing it has ended;
   - the masthead's season from the page's lesson, where it is a constant today
     (`src/features/lessons/kit/lesson-menu.ts:111`).
4. **Lesson 18's pieces**, as its spec gives them and this page cites them, without restating them:
   its items 4, 5, 7 and 8, the reading staff, the woodblock and the count-in, the sing flow with a
   take read in time and `kit/read-in-time.ts`, and the marks in the kit's runs
   (`docs/plans/find-your-pitch/lessons/18-read-a-line/WEB-SPEC.md:657-708`), and its item 16, the
   planning-text test's codes, which this page's T22 and T31 need before it is built
   (`docs/plans/find-your-pitch/lessons/18-read-a-line/WEB-SPEC.md:738-741`). This page's additions
   to the staff toy, code with tests: two staffs in one figure, treble over bass with a brace and
   the system's bar lines, a part on each with its label; the bar numbers; tags over a bar; numerals
   under chosen bars; words under notes, "A-" and "men"; the house on do on both staffs; the lock
   that draws ten empty bars, as the hero's strip, until the page's `onChoice`; and the pitch-line
   view of two parts in two colours. The song's notes need no ledger line: D3 is the bass staff's
   middle line and B3 the space above it, F♯4 the treble's bottom space and D5 its fourth line.
5. **Lesson 24's checks**, its item 6, with Lesson 26's options, its item 5
   (`docs/plans/find-your-pitch/lessons/26-second-voice/WEB-SPEC.md:673-677`): the check's line
   names "Tavi's part" or "Merc's part", and the quiet check plays the first 2.0 s of the run's other
   part; and one for this page: the fail line ends "or choose No headphones to sing alone".
6. **Lesson 26's part under a take**, its item 6
   (`docs/plans/find-your-pitch/lessons/26-second-voice/WEB-SPEC.md:678-687`), with its repeated-note
   dip, and this page's breath dip: a breath mark's half beat taken from the note before, its level
   to a quarter; tests: the dips at their times on the audio clock.
7. **Lesson 26's reader rule**, its item 4's additions
   (`docs/plans/find-your-pitch/lessons/26-second-voice/WEB-SPEC.md:661-672`), here for fourteen
   notes of two and four beats at 72 BPM; tests: this spec's synthetic takes (Tests 7). On the alone
   path the reader is called with no other part.
8. **Lesson 14's recorder and a playback with a part**: `kit/record.ts` as Lesson 14's spec proposes
   it (`docs/plans/find-your-pitch/lessons/14-phrasing-whole-song/WEB-SPEC.md:564-591`), whichever
   page builds it first, and this page's playback (Toys 6): the take's buffer and the other part's
   contour voice started on one audio-clock time from bar 1, as one sound for the page's owner; the
   recorder's own header, since the listener says nothing is recorded (`src/features/lessons/kit/listen.ts:18-22`);
   tests: the take kept in memory only and dropped on Delete, on Again and on leaving; the playback's
   two sources start together; no playback for a take with no voice.
9. **The lab test, on a phone**, before the scored runs ship and before the chip is set, on the lab's
   phones (one iPhone, one Android) and laptops, with the coach where a run is sung:
   - **Silence over the other part from the speakers**, as Lesson 26's item 8 runs it
     (`docs/plans/find-your-pitch/lessons/26-second-voice/WEB-SPEC.md:696-713`), here for 26.7 s
     of a part with a repeated note and three breaths.
   - **The reader**: Lesson 18's lab items on real takes of fourteen notes, here at 72 BPM with
     whole notes, with and without the other part in the headphones: whether learners come in on bar
     1 after do and the count-in, whether the higher voice finds mi from do, how the whole notes read,
     and how often "That was Tavi's note" shows.
   - **The playback's timing**: how far each device's round trip puts the voice behind the part on
     playback, measured with a click sung into the microphone; if it is audible, a per-device offset
     for the page is a kit item, read from a measure the lab makes.
   - **Levels and sounds**: the other part's level in the headphones, so the learner hears their own
     voice; two "ooh" parts together at 0.2 each under the compressor; C3 and D3 on a phone's
     speaker; the plagal tag's chords under the held G.
   - **The states' timing** for the chip (SEASON-2 § 1.3), and the two staffs and the form strip at
     344 to 390 px.
10. **The head and the share card** (Sections, 2): the title, the descriptions, the share card
    `learn/lesson-28-og.jpg` and its alt, and the structured data with `timeRequired` `PT19M`; the
    head test already has its word for nineteen (`src/tests/lesson-pages.test.ts:75-89`).
11. **Lessons 18 and 26's questions as modules** (`lesson-18/quiz-questions.ts`,
    `lesson-26/quiz-questions.ts`), so this page imports Lesson 18's question 2 and `l26-q2`.
12. **The lesson copy and the team's notes**: this lesson's tease set on Lesson 28, with no
    alternative, within `TEASE_MAX`, 64 characters; Season 2's close in the kit (item 3); and the
    signature line in the team's notes.
13. **Season 2 in the app's lesson plumbing** (SEASON-2 § 5.2 item 21), the app's work: the lesson
    marker's range (`src/lib/lesson-marker.ts:11-19`) and the lesson-answer bounds
    (`workers/db-worker/src/mirror-metrics.ts:57-62`), which refuse Lesson 28's answers whole today
    (FACTS 75).
14. **The cadence-type ear drill and the harmony-line drill** (SEASON-2 § 5.2 items 19 and 17), the
    app's work (Practice links).
15. **At release, the rooms' links back**, optional: SEARCH § 8's rows for `/karaoke-night` and
    `/ear-lab` gain 28 (`docs/plans/find-your-pitch/SEARCH.md:370`, `:373`), and Karaoke Night's
    entry page lists Lesson 28 beside 14 (`lessonsPractised`, `src/seo/entry-pages.ts:272`).

## Decisions for the owner

Most of this page follows decisions already made (SEASON-2 § 7) or the lead's answers: the plagal
tag, the bridge shown and not sung, the song written for the lesson, no exam board, and the tease.
Open:

1. **Season 2's closing words**: "End of Season 2" and "You've read a song in two parts. Now sing a
   whole song.", with the rest line "You've read a song in two parts.", proposed to answer the
   Season 2 trailer's question as Season 1's close answers its own (FACTS 5). The trailer is not
   written yet; if its question changes, so does this line.
2. **The coach's call on the breath marks**: after bars 2, 4 and 6, or only bar 4's (FACTS 67).

## Edge cases

- **Sound off, unset or missing.** Every play obeys the kit's `canPlay`. The predict's reveal waits
  for both plays heard with sound on; Start waits for sound (Toys 6). With no Web Audio the page
  stays readable, every play runs its drawing in silence with its hint, and Sing it offers the
  sing-along as words alone.
- **Before the cold open's choice**: the answering plays are locked and the reveal hidden; the steps'
  stage and free play draw only the hero's ten empty bars, their controls and the text's plays
  disabled under their lock line; Sing it's plays are disabled under the same line; the tour waits
  (Toys 1, 2, 6).
- **Before the cold open's reveal**, its choice made: the steps' stage, Sing it and free play work,
  and Step 2's text, plays, mix-up card, Try and Notice stay hidden under their held line until both
  ways have been heard to their end (Toys 1).
- **Only one way heard**: no reveal; the hint stays "Locked in. Play both ways."
- **A play cut short** (another sound, a step link, leaving the hero or the step): not heard, no
  reveal, the hint as it was; the staffs keep what they last drew.
- **A return visit** starts with the predict fresh, so the steps' stage, Sing it's plays and free
  play hold back again until the choice, and Step 2's words until the reveal.
- **The switch pressed during a play**: the play stops and the switch moves the staffs; a new Play
  plays the new way.
- **Reduced motion**: notes light with no transition, tags and letters land at once, the cursor
  jumps beat to beat.
- **A first visit that never chooses**: the welcome tour waits, and the next lesson page opened at
  the top offers it again; "Tour this page" runs it at once (Toys 1).
- **No voice chosen**: every example sounds both parts at their pitches; nothing in Sing it plays
  until a voice is chosen.
- **"I have headphones on" with none on**: the quiet check hears the other part and its fail line
  shows (Toys 6, state 6).
- **A hum, an early answer, a television or a second singer during the quiet check**: it fails as
  the other part would, since it cannot tell them apart.
- **Headphones unplugged during a run**: the other part then reaches the microphone; the reader
  cannot tell, and its lines say only where notes sat. The quiet check runs before every run.
- **The microphone refused** at Start: the sing-along; no take is counted.
- **A run with no voice**: the no-voice line, Start again while the visit has takes left, no feeling
  question, no playback.
- **The learner sings the other part instead of their own**: each note read on the other part's note
  says so, and the playback plays the two on one part.
- **A part sung an octave away**: read in full, with the octave line; the playback plays it where it
  was sung.
- **A browser that cannot record** (no supported format): the take is read and drawn, the playback
  buttons do not show, and the can't-record line does.
- **Delete during the playback**: the playback stops and the take goes; the lines stay.
- **Leaving Sing it mid-run**: the take is abandoned and counts as one of the visit's three, the
  other part stops, the microphone is released and nothing is recorded.
- **Leaving the page**: the recording goes with it; nothing is stored.
- **A narrow phone**: the two staffs and the form strip fit 344 px, with every target at least 44 px;
  a tag sits above its bar, never over a note.
- **The card's drills, off this page.** Karaoke Night asks for the voice, so the rest version names
  it for another day; Cadence asks for none, so it stays.

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-28/`, and on the kit
parts it adds:

1. **Sounds**: every note's frequency as FACTS 81 gives it; every play's length, 33.33 s for the
   hero's free play, 6.67 s for each answering play and the word's, 13.33 s for Steps 1 and 2's
   plays and quick check 4's, 53.33 s for Play B, then A, 26.67 s for a section, a part, "Just listen
   today"'s play and a run's eight bars, 1.0, 0.4 and 3.33 s for do, the quiet and the count-in, 2.0
   s for the quiet check; every two-part play's notes share their onsets.
2. **The arithmetic**: the song's A section, its syllables and its verticals, all tenths, twelfths
   or octaves and all in G; bar 4 on V; bars 7 and 8 V to I with the lower part D3 to G3, five
   semitones up; the way it kept going, bar 8 E3, and its bars 9 and 10 equal to bars 7 and 8 of the
   ending; the upper part the same both ways; the plagal tag's chords; the bridge's verticals and its
   ends on vi and V; 32 bars in all (FACTS 29 to 36).
3. **The range**: every note of both parts at least 2 semitones inside every preset of its voice in
   `VOCAL_RANGES`, with the table's numbers (FACTS 37); no Move do control and no octave switch.
4. **The predict**: at first paint the hero draws ten empty bars and no note; Play the song works
   before a choice and never reveals; the answering plays do not play before a choice; the reveal
   waits for both heard to their end with sound on; a play cut short reveals nothing; no `next`
   hint is set; the hints and "You said" lines are LESSON.md's; Step 2's words stay hidden, the held
   line in their place, until the reveal, and show with it, after the hero's reveal in the
   announcement (FACTS 40 to 45).
5. **Nothing answers the predict before its choice**: the lesson menu's headings, the recall, the
   three words, the quick check and the head's lines name no part and no note of bar 8; until the
   choice the steps' stage and free play draw ten empty bars with the hero's spoken summary and sound
   nothing; no play anywhere sounds the song's ending, Sing it's included; from the choice each step
   draws its own state, and a return visit holds them all again (FACTS 1a, 46).
6. **The quiz**: the recall imports Lesson 18's question 2 and `l26-q2` unchanged, with their away
   links; the quick check's ids, keys and words as LESSON.md gives them, none held.
7. **The reader on synthetic takes**, through Voice Mirror's `preprocess`, as Lesson 18's tests run
   (`docs/plans/find-your-pitch/lessons/18-read-a-line/WEB-SPEC.md:865-881`), with the cases of Toys
   6: on pitch and on time; a beat late; bar 7's two D3s as one held note; bar 8's G in either
   octave read in the band; ti on Tavi's re; mi on Merc's do; the alone path with no other part;
   the other part alone with no voice. No line reads "That was Tavi's note" for a note sung on the
   learner's own note.
8. **The quiet check with a part** (What the kit and the app still need, item 5): it plays the run's
   other part's first 2.0 s; a voiced run of 0.3 s at any pitch fails it, with its line; it runs
   before every run with headphones and never on the alone path.
9. **The part under a take** (item 6): its notes at their onsets on the audio clock, the dip between
   the two D3s, the breath dips after bars 2, 4 and 6.
10. **The recorder and the playback** (item 8).
11. **The flow and the visit's rules** (Toys 6): do, the count-in and the run in order; three takes
    a visit, a take with no voice or one cut short counted; Again sings again, the quiet check first
    with headphones; a run with no voice gives the no-voice line and no feeling question; Effortful
    keeps the lines and offers nothing more, with the rest card; Uncomfortable takes the lines away,
    with the doctor lines and the rest card; after either the take stays to play back or delete; no
    celebration; the tricky line at its share.
12. **The alone path, the sing-along and the listening path**: the alone path opens after No
    headphones and plays nothing during the take; the sing-along opens with no microphone or a
    refused one, asks for no microphone, plays do, the count-in and the other part, and offers Sing
    along again once a visit. After "Just listen today", the headphones check, Start and the
    sing-along do not show, and Play the song plays bars 1 to 8.
13. **The season's close**: the card reads "End of Season 2", its line and its two ways after any
    other ending, and its rest line with the map alone after "Effortful", "Uncomfortable" or "Just
    listen today", redrawn when the ending changes; no next-lesson card and no tease anywhere on the
    page; Lesson 14's page still draws Season 1's close.

Page tests (the series' own, run on every lesson page): the head test, with the title, the
description's length and its "A nineteen-minute lesson", the chip and `timeRequired`
(`src/tests/lesson-pages.test.ts:156-159`, `:191-210`); no planning text on the page, T22 and T31
included once the test's pattern takes them (`src/e2e/learn-no-planning-text.spec.ts:39`); the stage
fits a 390 px screen; first paint within the budget; the claims validator; one sound at a time; no
background staff or clef; the tour's hold.

## Contract

Lesson 1's contract, unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of
GSAP, and practice links that carry `?lesson=28`. Then the layout, accessibility, sound, motion and
storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text children,
touch targets of at least 44 px with no two tap zones overlapping, visible focus, a single dark theme
with every colour a token and an explicit body background, sound only after a tap, the microphone
only after Start, localStorage only for per-viewer conveniences inside try/catch, and the whole page
usable with no sound, no microphone, no headphones, no WebGL and no storage. The figures' accessible
names and every live region use words only, and every note is spoken with its letter and octave, "F
sharp 4", never the sign. The page stores the quiz seeds and records (`fyp-l28-recall-seed`,
`fyp-l28-recall-v1`, `fyp-l28-seed`, `fyp-l28-quiz-v1`), `fyp-done`
(`src/features/lessons/kit/progress.ts:12-15`), `fyp-voice`
(`src/features/lessons/kit/voice-choice.ts:20`), `fyp-motion`
(`src/features/lessons/kit/motion-switch.ts:12`), `fyp-pos` (`src/features/lessons/kit/position.ts:20`)
and `fyp-tour` (`src/features/lessons/kit/tour-gate.ts:29`); nothing from the toys, the headphones
answer, the quiet check or the runs: the headphones answer holds for the visit, in memory. The take
is recorded on the device and kept in memory only, never stored, never sent, and gone on Delete, on
Again and when the page is left; no frame, reading or answer from Sing it is kept or sent. The
predict's choice holds for the visit, in memory: a return visit starts fresh.

This package departs from ARTICLE-PLAN.md where LESSON.md's preamble lists and FACTS argues: the
predict's stem and the reveal's move (42, 44); the hero's empty bars (40); the bubbles (41); the
recall (7); the three words (47); Step 2's held words and the waiting plays (46); the plagal tag's
"ooh" (35); Step 3 without a predict or Go deeper (50); the breath marks (67); the alone path (63);
quick check 2 and 4's feedback (78, 80); the practice card without Harmony Stack (74); the chips
and the promise (2, 3, 17).

Page QA before publishing adds, for this page, every check against a local or dev build, never
production:

- Every play, switch and button works by keyboard alone and announces what LESSON.md shows.
- The cold open's plays sound and draw as FACTS 40 and 43 say: ten empty bars at first, then bars 7
  and 8 written both ways as they play, Merc's bar 8 G3 and E3.
- No source on the page sounds the song's ending before the cold open's choice, and no note is drawn
  in the steps' stage or free play until then; Sing it's staff shows the song as written.
- The lab test has passed and is written down where the coach's sign-off is.
- With headphones, a part sung in tune reads in the band note by note, a note sung on the other
  part's note reads as theirs, and a part sung an octave away reads in full, by ear, with the coach;
  the playback sounds the take in time with the part.
- Without headphones, the alone path reads the take and plays it back with the other part.
- On a real phone at 390 px, the two staffs, the tags, the form strip and the run's lines fit their
  cards, and C3 and D3 are heard through the speaker.
- The season's close reads Season 2's words, and its rest version after each of the three endings;
  Lesson 14's page still reads Season 1's.
