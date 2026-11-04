# Lesson 26 web page: spec

The Lesson 26 page is the web lesson for "A second voice", Season 2's sixth voice lesson and the
third of Arc D, Harmonise it: a cold open in which "Twinkle" plays with a copy of itself moved up
four semitones and six of the copy's notes, on three pitches, leave the key, a recall from Lessons
12 and 24, three words, written steps on one main toy, Lesson 6's tune line with a second part drawn
beside the tune, in four step states with free play, a scored checkpoint in which the learner sings
a part a third from Merc's tune and then the tune against it, with headphones, read note by note in
time, an unscored sing-along without them, two quizzes and the lesson explorer. Copy is in
[LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is a text-only package: no film
exists for Lesson 26, so the page has no Watch section and the masthead's anchors are Lesson, Sing
and Explorer. It is built on the kit (`src/features/lessons/kit/`) as it stands on main at
`c60f0fdcb`, and like every lesson page it reuses and never copies: a part that lives in an earlier
lesson's module moves into the kit first.

It stands on Season 2's kit work, none of it built yet, and specifies again none of what other
packages give: the seasons in the kit (SEASON-2 § 6.2 item 1); Lesson 18's in-time reader and its
sing flow with a take read in time (`docs/plans/find-your-pitch/lessons/18-read-a-line/WEB-SPEC.md:689-705`),
its woodblock count-in (`docs/plans/find-your-pitch/lessons/18-read-a-line/WEB-SPEC.md:685-686`) and
its planning-text test codes (`docs/plans/find-your-pitch/lessons/18-read-a-line/WEB-SPEC.md:739-742`),
the lead's answer 2; and Lesson 24's headphones check and quiet check
(`docs/plans/find-your-pitch/lessons/24-drone-harmony/WEB-SPEC.md:748-756`) and its one kept source
under a take (`docs/plans/find-your-pitch/lessons/24-drone-harmony/WEB-SPEC.md:743-747`). This spec
adds only what a part sung against a played part needs: that kept source widened from a drone to a
sung line, one line for the reader, the tune line's two-part states, and a lab test. The scored runs
ship only after that lab test, in which silence with Merc's part from the speakers reads as no
voice; until then, and wherever the learner has no headphones, Sing it is the unscored sing-along
(FACTS 28, 52). The page plays no take back, so it needs no recorder: that is Lesson 28's, the lead's
answer 3 (FACTS 30).

One object carries the lesson: Lesson 6's tune line, "Twinkle" as beads on semitone rows. In the
cold open a copy draws itself four semitones above the tune and six of its beads land off C major's
rows, on three of them; in Step 1 the key's thirds walk up the scale, 4 or 3 semitones; in Step 2
the copy bends to the key, the season's signature; in Step 3 a part sits above or below, and Merc
and Tavi sing it a tenth apart; in Step 4 a chord lights its notes gold under the part and a passing
note stays hollow; in Sing it the learner's own part lies on the rows as amber bands, Merc's part
beside it (FACTS 31, 44).

Its public home is `mercurypitch.com/learn/26`: a hand-written document `learn/26.html` with its
module in `src/features/lessons/lesson-26/`. It is a voice lesson, so it is a draft until the vocal
coach signs off its voice lines and its checkpoint (LESSON.md, For the vocal coach), in the draft
list's form (`src/features/lessons/kit/drafts.ts:31-42`). The season builds Lessons 24, 26 and 28
last, with one coach batch for all three (SEASON-2 § 8.2 item 7,
`docs/plans/find-your-pitch/SEASON-2.md:1272-1273`). Lesson 28 sings one part of a two-part song with
the other part played, so it reuses this page's part under a take, the reader's new line and the
headphones and quiet checks as they are specified here.

## Look

Season 1's look, unchanged: the dark listening room, the series colour code, Lesson 1's type and
wordmark, and the motion rules. On this page:

- **The tune line is Lesson 6's**: chrome beads on faint semitone rows, joined by a line, the
  sounding bead lit ink, Lesson 4's house on do. Its rows carry no names
  (`docs/plans/find-your-pitch/lessons/06-intervals/WEB-SPEC.md:149-151`).
- **A lane is a key's row lit**: the rows of C major's seven notes drawn a step brighter across the
  figure, the others left faint, as Lessons 4 and 6 draw a key's rows (FACTS 31). No C major lane is
  lit before the cold open's choice: the hero waits for the answering play, and the steps' stage
  and free play draw the hero's plain rows until the choice (FACTS 32, 40). Sing it's figure lights
  G's lanes under the learner's part, choice or no choice: it is in G and names no copy (FACTS 1a).
- **A second part is a second chrome line**, with its own beads, labelled at its start ("tune",
  "copy" or "part"), so position and label tell the two apart, never colour alone. A bead off the
  lanes shows its name beside it, C♯, G♯ or F♯. A bracket between the two lines at each note names
  the third's size, 4 or 3, in ink.
- **The contrast case** is Lesson 6's: after the reveal the copy moved four semitones fades to the
  dashed ink-2 `#a8b3bf` line with its "?" (`docs/plans/find-your-pitch/lessons/06-intervals/WEB-SPEC.md:29`).
- **Gold `#ffd84d` only in Step 4**: a chord note's bead glows gold as it sounds, the fit, as Lesson
  12's corners glow; a passing note's bead is hollow, with no glow (FACTS 46).
- **Blue `#58a6ff` and orange `#ff7448`** are Merc's and Tavi's, in their bubbles, their stills and
  Step 3's Merc and Tavi state, where Merc's tune is blue and Tavi's part orange (FACTS 45).
- **Sing it is a pitch canvas**: the learner's part as amber `#f59e0b` bands, the other part's notes
  chrome, the learner's line violet `#a78bfa`, drawn only after a run (FACTS 47).
- **No decorative staff or clef anywhere** (SEASON-2 § 1.5 item 7): this page draws no staff.

Four things move: the Merc idle loops; a bead lighting as its note sounds; the copy fading to its
contrast line after the reveal; and Sing it's cursor. Only Merc and Tavi move on their own. Under
`prefers-reduced-motion` Merc and Tavi hold a still frame, a fade lands at once, and the beads light
in turn with no transition; what the viewer starts still sounds. For everyone else the masthead's
Pause animations toggle stops the same things.

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Season 1's departures kept: the step toys double as the
Playground, unlocked in the Wrap once the cold open's choice is made; the mix-up card sits in Step 2,
whose question it answers; the practice card sits in the Wrap. No Watch section. The page opens in
Lesson 2's order (FACTS 5a). Each section's heading, and the line above it, are in LESSON.md
("Section headings").

1. **Masthead**: Season 1's, with the kit's seasons: "Season 2 · Lesson 26", anchors Lesson, Sing
   and Explorer, the Sound toggle off by default and Pause animations, through `initMasthead`
   (`src/features/lessons/kit/page-chrome.ts:127`) with `{ lesson: 26, deck }`. Its lesson menu
   lists the four step headings from the first paint and heads its card "Lesson 26 · What's a third
   above each note?"; no heading names the predict's answer (FACTS 42). On a first visit its welcome
   tour waits for the cold open's choice (Toys 1).
2. **Hero, with the cold open**, laid out as Lesson 2's: the kicker, the hook as the title
   (`<h1 class="hook" id="hook">`), the meta as six chips, the promise and the sound gate from
   LESSON.md. The chips are "16 minutes" (FACTS 3); "After Lesson 12: Chords and the four-chord
   song" and "After Lesson 24: Harmony against a drone", links to `/learn/12` and `/learn/24` that
   stay plain chips wherever their lesson is not live (FACTS 2); "Sound on"; "Microphone optional";
   and "Headphones optional". The stage holds Tavi's and Merc's bubbles over Merc and Tavi, the
   tune line's hero state between them, and under it Play the tune, which works from the start, and
   Play them together, locked until a choice; the predict card sits under the stage (Toys 1). The
   head:
   - the title, at most 60 characters: "How to sing a harmony in thirds | MercuryPitch" (46),
     query-led as SEARCH.md § 13 item 1 decided (`docs/plans/find-your-pitch/SEARCH.md:454-456`),
     the lead's choice;
   - the description, 121 characters: "Can you make a harmony by singing the tune a third higher? A
     sixteen-minute lesson with sound toys and a harmony to sing.", which the head test holds to 80
     to 160 characters (`src/tests/lesson-pages.test.ts:156-159`) and to the chip's run time in
     words (`src/tests/lesson-pages.test.ts:191-210`);
   - og:title and twitter:title "A second voice · Find Your Pitch, Lesson 26" (43);
     og:description and twitter:description the hook alone (58);
   - the share card `learn/lesson-26-og.jpg`, 1200 by 630, drawing the hero's still, "Twinkle" on
     plain rows between Merc and Tavi, with no copy and no lane; its alt "The title card: Find Your
     Pitch, Lesson 26, A second voice, above the start of ‘Twinkle’ drawn as beads on rows, between
     Merc and Tavi." (135);
   - the Article's structured data: headline "A second voice", `alternativeHeadline` the hook, the
     description, `timeRequired` `PT16M`, position 26, and `teaches` "A harmony a third above or
     below a tune, in its key", "Why a key's thirds are major on do, fa and so and minor on re, mi,
     la and ti", "Chord notes and passing notes" and "Singing a part while another part sings the
     tune"; and on release a line in llms.txt in its own form (`public/llms.txt:78-80`): "- [Lesson
     26: A second voice](https://mercurypitch.com/learn/26): How to sing a harmony a third above or
     below a tune. Why a key's thirds come in two sizes, why a tune moved up four semitones leaves
     the key, what a passing note is, and how to sing your part while Merc sings the tune."

   Nothing a learner can meet before the choice, the title, the descriptions, the share card and
   its alt, says whether a copy moved four semitones stays in the key, or that a key's thirds come
   in two sizes (FACTS 1a). The structured data and the llms.txt line, which no learner meets on the
   page, name the answer. Lengths: `verify26.py`, section 10.

3. **Recall from Lessons 12 and 24**, straight after the hero, shown to everyone (Toys 4; FACTS 7).
4. **Three words you'll meet**: Part, Chord note and Passing note, each with its figure and play
   (Toys 3).
5. **Steps**: the step deck, four steps, the tune line stuck beside the text (Toys 2), with Step 2's
   mix-up card in its text, and Steps 1 and 2's words held for the cold open's reveal (Toys 1).
6. **Sing it**: the comfort check, the voice choice, the headphones check, the "What this does" box,
   Start, the quiet check, the briefing, the runs, their readings and "How did that feel?", the swap;
   or the sing-along (Toys 5).
7. **Quick check**: four questions, question 2 and question 4's play waiting for the cold open's
   choice (Toys 4).
8. **Wrap**: the three lines, the one-sentence challenge, the practice card in the version Sing it's
   ending picks (Practice links), the next-lesson card with Lesson 27's still (Toys 6), and free
   play, the steps' tune line in every state, drawing the hero's plain rows under its lock line
   until the cold open's choice (Toys 2).
9. **Explorer**: the season's map with a tab per season, opening on Season 2's.
10. **Footer**: LESSON.md's, with the practice links, the fonts line and "Every sound on this page
    is synthesised in your browser."

## Length

The learner copy is 2,044 words on `node scripts/lesson-words.mjs`, every branch counted (FACTS 3),
under the series' cap of 2,379. Each step's own text, with its Try, its Notice and any Tavi line,
runs 108, 83, 101 and 83 words, inside 50 to 120 a step.

The built page is counted as the review counts it: the brief's 150 for the hints and status lines
a built page writes in the open (Lesson 8 FACTS 4), plus every line this page adds that the counter
would count, 168 in all (`verify26.py`, section 12): the steps' figure's lock line and its copy in
free play, "Choose an answer at the top to unlock this figure." (10 each); Steps 1 and 2's held
lines, "Hear the copy at the top to unlock this step." (10 each); quick check 2's lock line, "Choose
an answer at the top to try this." (9), and quick check 4's, "Choose an answer at the top to hear
this." (9); "Just listen today"'s play, "Play the two parts" (4); the quiet check's line when it
hears a note (18); the predict's two "You said" lines (14); the stored voice's line (9); Your
turn's other part lines, "mi fa so fa mi, a third above the tune" and "do re mi re do, the tune"
(17); Sing it's status lines, "Counting in: one bar.", "Your turn: sing your part with Merc's." and
"Done for today." (14); Step 1's Step up, Step down and bracket, "D up to F: 3 semitones" (10); Step
2's switch and Play (7); Step 3's switch and the tenth's bracket, "a tenth" (4); Step 4's Play both
and its bar, "C major chord" (5); the hero's label, "‘Twinkle’ in C major" (4); and free play's
state switch, 1 to 4 (4). Marks that are a numeral or a single name, the brackets' 4s and 3s, the
beads' sharps, the lines' tags and the syllables under Sing it's bands, are not counted, as a
chart's ticks are not. So the built page runs about 2,044 + 150 + 168 = 2,362 words, 17 under the
cap.

The page runs about 16 minutes: 9.92 of reading the built page at 238 words a minute and about 5.9
of sound, toys and tasks, 15.82 in all, the plan's "about 16 minutes (lab-timed)"; the text's count
alone gives 14.49. The chip, the head's "A sixteen-minute lesson", `timeRequired` `PT16M` and the
season's `minutes` say 16 until the tune line's states and the runs are timed in their lab (SEASON-2
§ 1.3), which may move them. Two parts carry more, for these reasons:

- **Sing it, 521 words.** It holds the series' singing lines, Lesson 3's, Lesson 18's and Lesson
  24's word for word, which are not cut; the headphones check and the quiet check, which the scored
  path needs; the briefing, one for every set; the "What this does" box; the reading's example
  lines; the feelings' and the swap's lines; and the sing-along (FACTS 49 to 62).
- **The Wrap, 294 words.** The practice card says what Harmony Stack does to a learner and how to
  reach it with a friend: the range, the room, the mode and the link; nothing played; the boxes'
  names; the octave it scores. Then Drone Intonation for a learner alone, the care lines and the
  rest version (FACTS 63 to 66), and the next lesson.

The quick check runs 242 words, four questions with three answers each and a line of feedback for
every answer (MASTER-PLAN § 4.2 item 8); the recall 152, Lessons 12 and 24's questions word for
word.

The cuts, every fact they carried staying in FACTS. The first draft counted 2,323 words, about
2,534 built on the brief's rule, and was cut in the promise, the reveal, the Part word, the four
steps, the mix-up card, Your turn, the readings, the feelings, the sing-along, the quick check's
feedback, the Wrap's "note for note" and the practice card's room steps. The review's five cuts then
went in its order: the Wrap's "An octave further apart, a third is a tenth." (9); Step 3's "In Sing
it, the lower voice takes the part below, the higher voice the part above." (16); Step 2's "Both
sizes count as consonances." (5); the reading's "your pitch line appears, with" (5); and Drone
Intonation's range line, now "It too wants each note in the octave your range sets." (10). Then the
reserve line, "Listen to the tune as you sing." (7), with Your turn rewritten to serve every set;
then this package's own: the reveal's "and every note fits"; the after-swap line, "Both parts: the
harmony, then the tune."; the sing-along's "A part a third from the tune, sung with it."; the
reading's example "La · We didn't hear a steady note there."; the promise's "with the tune"; the
Tries of Steps 1 to 4; Step 2's opening and Notice; quick check 2's and 4's longer feedback; the
Wrap's first and third lines; Step 4's toy buttons for the part and the tune, which the text's plays
sound; and the tenth's bracket, now "a tenth" (FACTS 3). If a build's own count still runs over the
cap, the next cut is the reading's example of the octave line, "Added when it applies: "You sang it
an octave lower: same note."" (11), which the reader still gives.

The activities are timed from FACTS 75 to 78. Free play is not counted.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                              | New in Lesson 26                                                                                                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Hero and predict       | The kit's predict (`kit/predict.ts`) with a free play, `onChoice`, `unlocks` and three reveal elements; the kit's tune line (`kit/tune-line.ts`) in its compact state, with its contrast case; the tour's hold (`kit/tour-gate.ts`) | The copy as a second line drawn as it sounds; the lanes lit by the answering play; a name beside a bead off the lanes; Steps 1 and 2's words held as reveal elements                                                                   |
| 2. The tune line, steps   | The kit's tune line, its stacked lines, beads, brackets and one-sound owner; Lesson 6's tune toy as the model of its states (`lesson-06/tune-toy.ts`)                                                                               | Four step states and free play, the hero's plain rows until the choice: Step 1's pair walk, Step 2's switch, Step 3's switch and Merc and Tavi state, Step 4's chord bar with gold and hollow beads; brackets between two lines; lanes |
| 3. Three words            | Lesson 5's word tickets (`lesson-05/words.ts`), with the page's sound owner                                                                                                                                                         | Three small figures that draw their plays                                                                                                                                                                                              |
| 4. Recall and quick check | The kit's quiz (`kit/quiz.ts`), its prefix, keys and away links; Lesson 12's question object; Lesson 24's, once built                                                                                                               | Ids `l26-q1` to `l26-q4`; quick check 2's answers and 4's play, by ear, held until the cold open's choice                                                                                                                              |
| 5. Sing it                | Lesson 18's sing flow, take read in time and in-time reader, with its count-in; Lesson 24's headphones check, quiet check and kept source; the comfort check, voice choice and feelings (`kit/comfort.ts`, `kit/voice-choice.ts`)   | The other part sung under the take; the model before each run; the swap; the reader's line for a note sung on the other part's note; three takes a set, as Lesson 24's sets; the sing-along with the tune                              |
| 6. Tease still            | The kit's next-lesson card and its slot (`kit/next-card.ts`)                                                                                                                                                                        | Lesson 27's opening as a still, as Lesson 27's package draws it, which plays nothing                                                                                                                                                   |

### 1. The hero and the cold open's predict

The kit's tune line in its compact state, "Twinkle"'s two lines in C stacked as Lesson 6 stacks
them, fourteen chrome beads, C4 at the foot of each band and D5 at its top, the house on do, the
label "‘Twinkle’ in C major" over the stage, every row alike and faint: no lane, no copy, no name on
a bead (FACTS 31, 32). It takes no taps.

- **Play the tune** is a free play (`[data-free]`): "Twinkle"'s two lines in the soft tone, 8.0 s,
  each bead lighting ink as it sounds. It works before a choice and never reveals.
- **The predict card**: LESSON.md's question and its two choices, with the kit's hints: before a
  choice, "Choose an answer to unlock the copy."; after one, "Locked in. Play them together."; a
  play that sound off kept silent, "Sound is off: nothing played. Turn sound on, then play it
  again."; after the reveal, "Play any of them again." No "Now play the other one." shows, since the
  reveal has one answering play. The choice holds for the visit, in memory.
- **Play them together**, the answering play, locked until a choice: the tune with the copy four
  semitones above it, note against note, 8.0 s, as one run (Audio). As it starts, the rows of C
  major's seven notes light as lanes; each note of the copy draws its bead on its row as it
  sounds, a line joining it to the copy's bead before, and a bead off the lanes shows its name
  beside it, "C♯", "G♯" or "F♯", as it lands. The predict's `revealOn` names this play alone.
- **The reveal** waits until the play is heard to its end with sound on, and shows three elements
  at once, which the kit announces in order (`showReveal`, `src/features/lessons/kit/predict.ts:133-148`):
  the hero's reveal, "You said: …" and LESSON.md's text, with **Play the copy that stays in the
  key**; then Step 1's held words and Step 2's, each in its step (Toys 2). The predict's `onReveal`
  hides the two held lines.
- **Play the copy that stays in the key**: the tune with the key's copy, E E B B C C B, A A G G F F
  E, 8.0 s, its beads drawing on the lanes as they sound; as it starts the copy moved four
  semitones fades to the kit's contrast case, dashed ink-2, with its "?" over its first line's off-
  lane beads, as Lesson 6's swapped version is drawn (`TuneOverlay`,
  `src/features/lessons/kit/tune-line.ts:85-89`).
- **Spoken summary** of the figure, in words, never signs: at first, "‘Twinkle’ in C major: two
  lines of seven notes, from C 4 up to A 4."; after the answering play, "The copy: six of its notes,
  on C sharp 5, G sharp 4 and F sharp 4, are off C major's rows."; after the reveal's play, "The
  copy that stays in the key: every note on C major's rows."
- **The tour**: the first-visit tour's step "One step at a time" scrolls to the steps' stage, past
  the predict, so the page holds it until the choice (`holdTour`, `src/features/lessons/kit/tour-gate.ts:57-69`),
  with no time limit (FACTS 41).

### 2. The tune line in the steps

One stage beside the steps' text, the kit's tune line in four states, each step's own, and free play
in the Wrap. **Before the cold open's choice** the stage and free play draw no step's state, since
every one shows the answer through its lanes, its brackets or its Four semitones up setting, and the
kit's lock disables controls, not drawings (`unlocks`, "Controls elsewhere that the choice unlocks
too", `src/features/lessons/kit/predict.ts:66-67`). Until then both draw the hero's state:
"Twinkle"'s two lines alone on plain rows, as the hero draws them, with no lane, no second line, no
bracket and no name on a bead, and the hero's spoken summary, "‘Twinkle’ in C major: two lines of
seven notes, from C 4 up to A 4."; every control and play, the plays in the steps' text among them,
is disabled with its name kept, under the line "Choose an answer at the top to unlock this figure.".
The predict's `onChoice` draws each step's own state and free play's, and removes the line, and
`unlocks` enables the controls; a return visit holds them again (FACTS 40), as Lesson 25's stage
leaves its chord column undrawn
(`docs/plans/find-your-pitch/lessons/25-minor-properly/WEB-SPEC.md:241-245`) and Lesson 27's draws
V with three corners until the choice
(`docs/plans/find-your-pitch/lessons/27-sevenths-inversions/WEB-SPEC.md:215-216`). Steps 1 and 2's
text, its plays, Try and Notice stay hidden until the reveal, the held line "Hear the copy
at the top to unlock this step." in their place (FACTS 41). Every play is the page's one sound
(Audio). Each state has a spoken summary that says what it draws whenever it changes.

- **Step 1, the thirds up the scale**: one band, C4 to D5, the lanes lit, the house on do. A note of
  the scale and the key's note a third above it light together as two beads joined by a bracket that
  names the letters and the semitones, "C up to E: 4 semitones" to "B up to D: 3 semitones", with
  the unit, since a bare 3 beside a third would read as its letters (FACTS 11), the bracket's words
  spoken "C up to E, 4 semitones". **Step up** and **Step down** walk the pair from do to ti and
  back, each step playing its two notes together, 1.0 s, "Step down" `aria-disabled` at do and "Step
  up" at ti. **Play the thirds up the scale**, in the text, plays the seven pairs in turn, 7.0 s,
  the pair walking with it (FACTS 43, 77).
- **Step 2, "Twinkle" with its copy**: the two lines stacked, each band C4 to D5 with the lanes lit,
  the copy a second chrome line labelled "copy", a bracket at each note naming 4 or 3, and a switch,
  **C major's thirds · Four semitones up**, on the first. Switched, the copy's beads over D, E and A
  move up a semitone off the lanes, show their names, and their brackets read 4, the move drawn as
  the kit's slide of those beads alone, at once under reduced motion. **Play**, in the toy and in the
  text, plays the tune with the copy as the switch sets it, 8.0 s, note against note (FACTS 44).
- **Step 3, above or below**: one band, A3 to G4, do re mi re do on C4 as the tune, and a switch,
  **Above · Below**, that draws the part a third above it, mi fa so fa mi, or below it, la ti do ti
  la, labelled "part", a bracket at each note naming 4 or 3. **Play above** and **Play below**, in
  the text and the toy, set the switch and play the tune with that part, 3.0 s each. **Play Merc and
  Tavi** redraws the band from C3 to G4, Merc's tune in blue, C3 to E3, Tavi's part in orange, E4 to
  G4, each line labelled with its singer, and a bracket between their first notes labelled "a
  tenth", the text giving "an octave and a third"; it plays both in Merc's "ooh", 3.0 s (FACTS 45,
  77).
- **Step 4, the note in the middle**: one band, C4 to G4, the tune do re mi on C4 and the part mi fa
  so above it, over a bar at the band's foot named "C major chord", its lanes of C, E and G glowing.
  Each play holds the chord, C3, E3 and G3, for 3.0 s under its notes: a chord note's bead glows
  gold as it sounds, and a passing note's bead, re or fa, is drawn hollow, with no glow, and named
  "passing" in the spoken summary. The text's two plays sound the part and the tune, each over the
  chord, and the toy's **Play both** sounds the two together over it, as Try asks (FACTS 46, 77).
- **Free play**, under the next-lesson card: the four states on one stage, with every control and a
  state switch of four buttons, 1 to 4, each named by its step's heading. Until the cold open's
  choice it draws the hero's state under the same line, its controls disabled, and again on a return
  visit, as Lessons 22 and 25's free play keeps its steps' holds (FACTS 40).

Layout: the stage takes the kit's tune line layout at every width from 344 px up. No bead and no
bracket is a button in any state: `beadButtons` is off, and the kit's `brackets`, a button each, are
not used, since this page's brackets stand between two lines and are drawn only (item 7;
`src/features/lessons/kit/tune-line.ts:70-73`). The targets are the controls, each at least 44 px,
no two overlapping: Step up and Step down, the switches, the plays and free play's state switch.
Step 2's two lines stack, each on a band of fifteen rows with no gap strip, so the figure keeps
about the 350 px Lesson 6 measured at 390 by 844, though two of its beads and their bracket can
share one 44.25 px column a few rows apart, which is why they are not buttons; Step 3's Merc and
Tavi state draws C3 to G4, 20 rows, about 180 px of rows, inside Lesson 6's one-line states (FACTS
80). The lab confirms both on a phone (What the kit and the app still need, item 8).

### 3. Three words

Lesson 5's word tickets, each with a small figure that draws its play as it sounds, with no rows and
no numbers (FACTS 37 to 39, 76): **Part**, two short lines, the tune, then the tune with its part
above; **Chord note**, three stacked beads for the chord and a fourth above, drawn as it joins;
**Passing note**, three beads stepping up over the chord, the middle one hollow. None sounds a copy
moved four semitones or names a third's size, so none waits for the choice (FACTS 1a).

### 4. Recall and quick check

The kit's quiz, as on Lesson 24's page. The recall imports Lesson 12's `l12-q3`
(`src/features/lessons/lesson-12/quiz-questions.ts:73-91`) and Lesson 24's question 1, `l24-q1`,
once Lesson 24's questions are a module, each with its away links, "Try Lesson 12, Step 4 again"
becoming plain words where Lesson 12 is not live (`linkAway`,
`src/features/lessons/kit/quiz.ts:191-205`); its keys are `fyp-l26-recall-seed` and
`fyp-l26-recall-v1`. The quick check's ids are `l26-q1` to `l26-q4`, its keys `fyp-l26-seed` and
`fyp-l26-quiz-v1`, its words LESSON.md's, in authored order, each ♯ made speakable (FACTS 71 to 74).
Question 4's **Play** plays do re mi re do on C4 with the part four semitones up, then, after 1.0 s,
with the key's thirds, 7.0 s, by ear only: nothing draws. Until the cold open's choice it is
disabled, under "Choose an answer at the top to hear this.". Question 2 asks the predict's question
again, with its right answer and feedback that states it, so until the choice its three answers are
disabled with their words kept, under "Choose an answer at the top to try this.", the kit's quiz
answer buttons passed to the predict's `unlocks`; a return visit holds both again (FACTS 1a, 40,
72). Lesson 28's recall imports `l26-q2` as this page words it (FACTS 72).

### 5. Sing it: two parts

Lesson 18's sing flow, as its spec moves it into the kit, with a take read in time
(`docs/plans/find-your-pitch/lessons/18-read-a-line/WEB-SPEC.md:349-448`), and Lesson 24's
headphones check and quiet check, with these changes: the other part sounds under the take; a model
before each run; the swap; three takes a set. Every state has a visible status line that is also
announced (`aria-live="polite"`).

States:

1. **Comfort check**, always first and asked every visit, never stored: Lesson 3's line, its list
   of six conditions and its two buttons (FACTS 49), through the kit's `mountComfort`
   (`src/features/lessons/kit/comfort.ts:159`).
2. **Voice choice**, after either comfort answer when none is stored, and before anything in Sing
   it plays: Lesson 3's two buttons with Merc's and Tavi's stills (`aria-pressed`, at least 44 px),
   under LESSON.md's line in its two forms (FACTS 50); it reads and writes `fyp-voice`
   (`src/features/lessons/kit/voice-choice.ts:20`). The lower voice sings in G with do on G3, the
   higher with do on G4; the page's examples stay in C (FACTS 8). No Move do and no other octave
   (FACTS 50).
3. **Just listen today**: LESSON.md's line with the doctor lines, and **Play the two parts**, in the
   chosen voice, again on each tap: the tune alone, 6.0 s, then the part alone, then the two
   together, 1.0 s apart, 20.0 s, the bands and notes lighting as they sound. Nothing listens; the
   headphones check, Start and the sing-along do not show, and nothing asks the viewer to sing
   (REQ-GVC-021, REQ-GVC-055). The Wrap shows the rest card (FACTS 49, 66).
4. **Headphones check**: LESSON.md's line, "Merc's part" read "Tavi's part" for the higher voice,
   with **I have headphones on** and **No headphones**. No headphones opens the sing-along (state 11)
   and asks for no microphone. The answer holds for the visit, in memory, never stored (FACTS 52).
5. **Briefing**: the "What this does" box (REQ-GVC-002, REQ-GVC-003, REQ-GVC-012, REQ-GVC-026; FACTS
   58), Your turn, its first line the part the set sings, the chosen voice's part or, in the swap,
   the tune (FACTS 55), the stop line on its own line, and **Start**, the only control that asks for
   the microphone, through the kit's listener under the page's consumer id, `lesson-26`. Under Your
   turn the figure draws the learner's part as amber bands on G's lanes, the other part's notes as
   chrome beads beside them, and the count-in strip. With sound off, Start asks for nothing and
   plays nothing, with the hint "Sound is off, so nothing played. Turn sound on to hear Merc's part,
   then press Start." A refused microphone opens the sing-along.
6. **The quiet check**, Lesson 24's, after the microphone opens and before every set, Again's
   included: LESSON.md's line, and the first 2.0 s of the part Merc sings in that set, at the run's
   level, nothing else playing, while the listener reads the frames. It fails on any voiced run of
   0.3 s or more at any pitch; then the microphone is released, the line reads "The microphone heard
   a note during Merc's part. Check your headphones, then press Start again and stay quiet.", the
   sing-along opens in the runs' place, and Start stays under it (FACTS 52).
7. **The run**: the model, Merc for the lower voice or Tavi for the higher singing the learner's part
   alone on "ooh", 6.0 s, each amber band lighting as its note sounds, the other listening; 0.4 s of
   quiet; the count-in, Lesson 18's one bar of woodblock at 60 BPM, beat 1 higher, the strip lighting
   a dot a click, status "Counting in: one bar."; then the take, as Lesson 18's: frames kept from
   half a beat before bar 1's first beat, read in time from the singer's first note. From bar 1's
   first beat Merc or Tavi sings the other part, the one sound the take allows (Audio), its chrome
   beads lighting as they sound, and the cursor moves at the beat, status "Your turn: sing your part
   with Merc's."; nothing draws the learner's line, and the band does not light (FACTS 47, 54). The
   take ends when the last note's window closes, as Lesson 18's does.
8. **After the run**, 0.5 s later: the learner's pitch line drawn over the amber bands on the run's
   time axis, folded into the part's octave with the octave tag where it applies, the other part's
   beads kept chrome beside it; under it, one line a note in order, from the reading (The reader,
   below). If no note's window held any voice: "We didn't hear you start that time. Come in with
   Merc after the count-in.", with **Start again** while the set has takes left, and no feeling
   question (FACTS 57).
9. **How did that feel?**: Lesson 3's four answers after each run with voice, an answer that locks,
   through `mountFeelings` (`src/features/lessons/kit/comfort.ts:175`), with what each allows from
   the kit's rule (`afterFeeling`, `src/features/lessons/kit/comfort.ts:56-82`) and the rest card
   after Effortful (`restAfterEffort`):
   - Easy or Workable after the learner's part: the tricky line where the set's rules give it, then
     "Now swap: sing the tune while Merc sings your part." with **Swap parts**, **Again** (while the
     set has takes left) and **Done for today**.
   - Easy or Workable after the swap: **Again** (while the swap's set has takes left) and **Done for
     today**.
   - Effortful: the lines stay; no Again, no swap; "Keep it gentle: rest before you sing again."
     with only **Done for today**; the Wrap shows the rest card.
   - Uncomfortable: the lines and the pitch line are taken away; no Again, no swap; "Thanks for
     saying so. That's enough singing for today: rest your voice." with the doctor lines; the
     microphone is released; the Wrap shows the rest card (REQ-GVC-021, REQ-GVC-023, REQ-GVC-024).
   - Once "Effortful" or "Uncomfortable" has been answered, no further run and the rest card stay
     so for the visit, in memory (`VisitEnding`, `src/features/lessons/kit/comfort.ts:101-114`).
10. **The swap**: states 6 to 9 with the parts exchanged: Your turn's first line reads "do re mi re
    do, the tune"; the quiet check plays the first 2.0 s of the harmony; the model is the tune sung
    alone; the learner sings the tune while Merc sings the harmony; the figure draws the tune as the
    amber bands and the harmony as the chrome beads; the lines read against the tune, with the
    harmony as the other part (FACTS 56).
11. **The sing-along**, for No headphones, no microphone, a refused microphone or a quiet check that
    heard a note: LESSON.md's line and **Start the sing-along**: the model, 0.4 s of quiet, the
    count-in, then the other part, 6.0 s, the cursor moving and the bands lighting as their beats
    come; nothing listens and no line is drawn. Then "How did that feel?" with the same endings;
    Easy or Workable offers **Swap parts** and **Sing along again**. Swap parts sings along with the
    parts exchanged; Sing along again is offered once a visit, the cap Season 1's sing-alongs put on
    their Again (the kit's `AfterFeeling`, "still offered only once a visit",
    `src/features/lessons/kit/comfort.ts:41`; FACTS 61).
12. **Done for today** ends the checkpoint with the status "Done for today." and leaves the practice
    card in the version the visit's ending picks.

**The set's rules** (FACTS 57, 60):

- **A set** is one part sung in runs: the learner's part, then, after Easy or Workable, the tune in
  the swap. One run is one take, and each set allows three takes in a visit, every take counted, one
  with no voice or one cut short when the page is left or hidden too, as Lessons 18 and 24 count
  them (`MAX_TRIES`, `src/features/lessons/kit/take.ts:54`).
- **Again** sings the set again: the quiet check, the model, the count-in and the run.
- **The swap** is offered only after Easy or Workable on the learner's part, and never after
  Effortful or Uncomfortable.
- **No celebration**: the reader's lines say where notes sat, and Merc and Tavi only listen after a
  run. **The tricky line** follows a run with under half its notes in the band.

**The reader** is Lesson 18's in-time reader as its spec gives it
(`docs/plans/find-your-pitch/lessons/18-read-a-line/WEB-SPEC.md:449-505`), with its values, its
anchor, its windows, its rule for a note heard on its note and its rules for a note not heard on it:
this page restates none of it. It reads five notes, four of one beat and one of two, at 60 BPM, as
Lesson 18 reads quarter and half notes (FACTS 29, 54). What is new for a part sung against a played
one:

- **Input**: beside the written notes, here the learner's part, the reader takes the other part's
  notes, each a MIDI note with its onset and length in beats, and the name each line uses for it,
  "Merc's" or "Tavi's".
- **The anchor** is Lesson 18's, unchanged, for the learner's own part: a late start, up to two
  beats, moves every one of its notes' beats, so a late start still reads its notes.
- **The other part's note**: a note not heard on its note, whose voiced frames inside its own beats,
  anchored, have a median more than 60 cents from its own note, is compared frame by frame with the
  other part as played: each frame against the note the other part is sounding at that frame's time
  on the audio clock, from bar 1's first beat, where the part is booked, never anchored. If those
  distances, folded, have their median within 60 cents, the note reads "That was Merc's note:" with
  the syllable of the other part's note most of those frames sat on, through the rung line's form:
  "Do · That was Merc's note: mi." A device's round trip shifts the frames against the part by a
  fraction of a beat, which the median absorbs; the lab measures it (item 8). This rule comes first
  among the not-heard rules, before Lesson 18's rule for a neighbouring written note, since in these
  parts the other part's note at one moment is sometimes the learner's own note two places away
  (FACTS 58). It never gives a gap, never names a cause and gives no advice.
- **Never "in the band" for the other part**: the parts are a third apart in every beat, three or
  four semitones, so a note sung on the other part's note is 300 or 400 cents from the learner's
  own (FACTS 28).
- **The lines** take "your part's note" where Lesson 18's take "the written note", through
  `gapWords`, which takes whose note it is (`src/features/lessons/kit/band-words.ts:55-61`).

Run on synthetic takes before the lab (Tests 7): the lower part sung on pitch and on time reads
every note heard on its note; sung a whole beat late on its own notes, the same, as the anchor
allows; sung a beat late on Merc's sounding notes, A3, B3, A3, G3 and G3, stopping with him, "La ·
That was Merc's note: re.", "Ti · That was Merc's note: mi.", "Do · That was Merc's note: re.", "Ti
· That was Merc's note: do." and "La · That was Merc's note: do.", where a rule on the anchored beat
would read gaps; do sung on Merc's mi, B3, reads "Do · That was Merc's note: mi."; la sung on G3 in
beat 1, which is Merc's do there and the learner's own do two places on, reads "La · That was Merc's
note: do.", not the neighbour's line; ti sung on G♯3, off both parts, reads its gap; the higher
part's so sung on B4 in beat 3 reads "So · That was Tavi's note: mi."; in the swap, do sung on E3 in
beat 1 reads "Do · That was Merc's note: la."; and a take of frames on Merc's part alone, the voice
silent, reads every note as Merc's, which is why the quiet check runs before every set and the lab
test comes first (What the kit and the app still need, item 8).

### 6. Tease still

The drawing in the next-lesson card's slot, the page's `[data-next-card]` mark, which the kit keeps
in the card after its words (`src/features/lessons/kit/next-card.ts:34-37`): an SVG, `aria-hidden`,
of Lesson 27's stage as its cold open opens, as Lesson 27's package draws it: the ring with the V
room lit and the I room faint, no fourth corner, Merc and Tavi, no bubbles
(`docs/plans/find-your-pitch/lessons/27-sevenths-inversions/WEB-SPEC.md:316-319`). It holds no
button, since the card is a link, does not move and plays no sound. Its styles go under a class of
its own, not the tease line's `.next-tease` (FACTS 5b).

## Audio

Every sound is synthesised in the page with Web Audio, through the kit's sound module, its master
bus and its house envelopes, and started only by a tap. Nothing autoplays, and the page has no
music bed (FACTS 75 to 79).

- **The sound rules**, for every source of sound on the page (the cold open's three plays, the three
  words, every play of the steps' tune line and of free play, quick check 4's play, the models, the
  other part and the sing-along):
  1. One sound plays at a time, across the whole page: a new play stops the one before. Two parts
     playing together, or a chord with its part, are one sound.
  2. Leaving a step, by any route, stops its sound and any queued play; scrolling Sing it off screen
     for 600 ms, or hiding the page, stops what plays there and abandons a take.
  3. A play that is cut short never counts as heard by the predict.
  4. During a take only the other part plays: every play control is disabled from Start until the
     set ends.
  5. A play that would answer the predict stays disabled until its choice, wherever it sits on the
     page (Toys 1, 2, 4).

  The kit has the page-wide owner every source registers with (`NowPlaying`,
  `src/features/lessons/kit/now-playing.ts:39`).

- **Two parts note against note.** Every two-part play outside a take, the cold open's, the steps',
  the words' and quick check 4's, is one `playNotes` run holding both parts' notes, which share their
  onsets, so each pair of notes starts in one timer task (`src/features/lessons/kit/run.ts:9-10`);
  a chord under a part is the same, its notes in the soft tone (`src/features/lessons/kit/run.ts:38-39`).
  Nothing new is needed for these (FACTS 26).
- **Timbres.** The cold open, the words, the steps but for Merc and Tavi, and quick check 4 play in
  the kit's soft tone; Step 3's Merc and Tavi, the models, the other part in a run, "Just listen
  today"'s play and the sing-along in Merc's "ooh", Tavi's an octave above Merc's; the count-in is the
  woodblock (FACTS 79).
- **A part under a take.** The kit holds every sound off while a take is open
  (`src/features/lessons/kit/sound.ts:539-547`). The other part is the one exception: one voice along
  a contour (`contourVoice`, `src/features/lessons/kit/sound.ts:321-353`), each note a held point at
  its pitch, joined to the next by a glide of 0.05 s, built before the take opens and booked on the
  audio clock to start on bar 1's first beat through the voice's `at`
  (`src/features/lessons/kit/sound.ts:39-43`), the hush leaving it sounding, as Lesson 24's item 5
  keeps its drone. Its release ends it as its last note ends. Two notes on one pitch in a row, which
  this page's parts never have and Lesson 28's song may, are struck again by a dip in the contour's
  level, to a quarter for 0.08 s between them (What the kit and the app still need, item 6).
- **Levels.** A note at the kit's 0.13 and Merc at 0.2 (`src/features/lessons/kit/sound.ts:187`); a
  two-part play at the note level for each part. In a run the other part sits at a level the lab
  sets, under Merc's model, so the singer's own voice stays clear in the headphones (FACTS 79).
- **Low notes.** The page's lowest sounds are C3, 130.81 Hz, Step 4's chord root and Merc's do in
  Step 3, in the soft tone and the "ooh", and E3, 164.81 Hz, the lower voice's la in Sing it; the lab
  hears both on a phone's speaker.

## Merc and Tavi

Lesson 1's setup through the kit (`src/features/lessons/kit/merc-duo.ts`): the app's renderer loaded
after first paint, one WebGL context per Merc, medium quality on phones, paused off screen, and the
stills when WebGL fails.

- They live in the hero, on either side of the tune line. Tavi asks and Merc answers in the bubbles,
  which show from the start. While the cold open's plays sound, both listen (`mercListen`,
  `src/features/lessons/kit/merc-duo.ts:207`): the sounds are played tones. Tavi gives a quiet "oh"
  as the reveal shows, with no sparkles (`mercCelebrate`, `src/features/lessons/kit/merc-duo.ts:217`;
  `MercDuoOptions`, `src/features/lessons/kit/merc-duo.ts:119`).
- In Step 3 their parts are lines in their colours on the stage, labelled with their names; they do
  not appear there.
- In Sing it the singing Merc appears as a still beside the figure, Merc for the lower voice and
  Tavi for the higher, and sings the model and the other part (`mercSing`,
  `src/features/lessons/kit/merc-duo.ts:165`); after a run both listen, with no celebration (FACTS
  60).
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Jam's Harmony Stack**, for two or more: the link is `/jam?lesson=26`, printed
  mercurypitch.com/jam (`/jam`, `src/lib/sw-runtime.ts:132`). The card says how to reach it and
  what it does to a learner (FACTS 63, 63a, 63b and 64). The steps: set your Singing Voice Range in
  Settings first, since the room's octave is the host's range, which reads tenor until it is set;
  then open a Jam room, then pick Harmony Stack under More controls and share the room's link, in
  either order, since a friend who joins late is sent the room's drill and its mode. What it
  does: one singer takes the room's tune and the other a third above it, in the key, each scored on
  their own part; the room plays nothing, not even a first note; its boxes name their notes, each
  part its own; and it scores each note in the octave the host's range sets, unfolded, where this
  page's reader folds. Until items 15 and 16 of What the kit and the app still need shipped, the
  card had the friend in before the mode was picked and said "on the third, its boxes print the
  tune's letters". The card gives no advice on which voices
  to pair: checked against all six presets on the room's first tune, the C major scale on C3 or C4,
  two lower or two higher voices keep the tune and the third inside every preset, but with no room
  at the tenor's floor or the soprano's, on the tune's C, under the series' two semitones, and a
  lower and a higher voice leave a note outside a preset unless a tenor draws the tune in a higher
  voice's room; the coach's list carries the table (`verify26.py`, section 13). It leaves out the
  fifth a third singer takes, which runs a semitone past the bass preset's top, and it does not say
  which friend gets which part, since that follows the room's order, which the room shows. It is the
  season plan's link for this lesson (SEASON-2 § 5.1, row 26,
  `docs/plans/find-your-pitch/SEASON-2.md:863`).
- **The second drill, alone, Drone Intonation's thirds**: `/exercises/thirds-on-a-drone?lesson=26`,
  printed mercurypitch.com/exercises/thirds-on-a-drone (`src/features/exercises/slug-map.ts:75-81`),
  with Lesson 24's card lines cut to this page: what it does, now "names a third to sing above it",
  since it prints the interval and the note's name; the headphones line, "Headphones help: its
  drone plays while it listens."; and the range line, "It too wants each note in the octave your
  range sets.", its "too" pointing back to Harmony Stack's octave and its range the one the card's
  first line sets, with no "so" for "therefore". It writes no staff and plays nothing first; its
  scoring sentence stays on Lesson 24's card (FACTS 65).
- **The rest version.** After "Effortful", "Uncomfortable" or "Just listen today" the card shows
  Lesson 10's form, headed "Rest today", and is no longer a link, naming Harmony Stack; both drills
  ask for the voice, so neither stays on offer (`mountPractiseCard`,
  `src/features/lessons/kit/comfort.ts:126-149`; FACTS 66).
- **The first visit and the marker.** Nothing reads `?lesson=26` until SEASON-2 § 5.2 item 21
  widens the marker, and until then the quiz's answers are refused whole; the page is not built
  before that, so First Light steps aside and the card has no first-visit line (FACTS 67).
- **Needed: the harmony-line drill** (SEASON-2 § 5.2 item 17, `docs/plans/find-your-pitch/SEASON-2.md:933-935`),
  the app's work: a melody played and a third above or below it sung, scored per note, octave-folded,
  with a headphones prompt. When it ships it takes the card's first place, as the drill a learner can
  do alone, with its own care lines and the coach's look, and Harmony Stack moves to second (FACTS
  68). The native app's Harmony room does it there, but no web page can open it, so the card does
  not name it (SEASON-2 § 7 item 14).
- No premium exercise is linked: Jam and Drone Intonation are free (FACTS 69).

## Explorer and season data

Lesson 26's entry, proposed for Season 2's data in its own module, in Season 1's entry form, as
Lesson 10's is (`src/features/lessons/kit/season.ts:345-364`):

- `n: 26`, `lane: 'voice'`, `title: 'A second voice'`, `short: 'Second voice'`,
  `topics: ['S20b', 'T23']`, with their names as SEASON-2 § 4.1 gives them, "Sing a second part with
  a melody" and "Chord tones and non-chord tones"; the hook word for word (FACTS 1); `minutes: 16`,
  which the lab may move (FACTS 3), and `page: '/learn/26'` once the page is built, under the
  drafts' comment, `// A draft until its sign-off (drafts.ts), as Lesson 3 is.`
- `pr.link`: `href` `/jam?lesson=26`, `addr` `mercurypitch.com/jam`, `label` "Harmony Stack" and
  `note` "with a friend: the host picks Harmony Stack", as the card has it (FACTS 64); `pr.needs`,
  "The harmony-line drill (SEASON-2 § 5.2 item 17)", is the team's only: the field is "Admin only,
  never drawn on a lesson page" (`src/features/lessons/kit/season.ts:102-103`).
- `EDGES` gains [12, 26] and [24, 26], as SEASON-2 § 4.3 gives them (FACTS 2); Lesson 26's
  prerequisite list is then [12, 24].
- The tease on Lesson 25's card is this lesson's, set on Lesson 26 in the lesson copy: `tease`
  "‘Twinkle’, and the same tune four semitones higher, played together.", with `teaseAlts`
  `[{ id: 'plan', text: "Lesson 24's other part was a drone. What if it's a tune?" }]`, and its team
  note in `TEASE_NOTES` (`src/features/lessons/kit/team-notes.ts:84-85`) proposed as "The plan's
  line, mended: its ‘So far the other part was a drone’ was false, since Lesson 12's sing-along had
  the learner sing over moving chords. It is true of Lesson 24 and answers nothing of the predict;
  the lead's line, the opening in miniature, is the default." (FACTS 5). The tease on this page's
  card is Lesson 27's, set on Lesson 27 by Lesson 27's package
  (`docs/plans/find-your-pitch/lessons/27-sevenths-inversions/WEB-SPEC.md:386-389`): the lead's "G,
  B and D going home to C, E and G. Now add one note on top." as the default, and the lead's
  alternative, `teaseAlts` id `three-notes`, "Three notes make a chord. Add one more to V, and hear
  where it goes." (FACTS 5b). Each is at most `TEASE_MAX`, 70 characters
  (`src/features/lessons/kit/lesson-copy.ts:76`): 68, 56, 61 and 68.
- The signature line for the admin console, from the card (FACTS 4): "Lesson 6's ‘Twinkle’ copied a
  third higher, the copy bending to the key's rows: some thirds four semitones and some three."
- The explorer's card shows "16 min" once the page is live.

## What the kit and the app still need

Found in the kit and the app as they stand on main at `c60f0fdcb`. Every item is proposed, but
items 15 and 16 and Lesson 18's item 16 (item 4 below), which have shipped.

1. **The lesson host**: `learn/26.html` at `/learn/26`, which every build takes as a lesson page
   (`lessonPages`, `tools/draft-lessons.ts:82`); `/learn/26` and `/learn/26.html` in
   `STANDALONE_DOCUMENT_PATHS` (`src/lib/sw-runtime.ts:93`); the first-paint budgets. The lesson
   pages' route already takes any two digits (`LESSON_PAGE`, `src/lesson-gate.ts:135`).
2. **The draft line**, in the draft list's form:
   `26: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`, as Lesson 5's
   (`src/features/lessons/kit/drafts.ts:31-42`).
3. **Seasons in the kit** (SEASON-2 § 6.2 item 1), as Lesson 15's spec sets them out.
4. **Lesson 18's pieces**, as its spec gives them and this page cites them, without restating them:
   its item 7, the sing flow in the kit with a take read in time and `kit/read-in-time.ts`
   (`docs/plans/find-your-pitch/lessons/18-read-a-line/WEB-SPEC.md:689-705`); its item 5, the
   woodblock and the count-in (`docs/plans/find-your-pitch/lessons/18-read-a-line/WEB-SPEC.md:685-686`);
   and its item 16, the planning-text test's codes, which this page's S20b needed, now shipped
   (`docs/plans/find-your-pitch/lessons/18-read-a-line/WEB-SPEC.md:739-742`). Then this page's
   additions to the reader, code with tests (Toys 5): the other part's notes as input, with their
   times on the audio clock as booked, and the rule and line for a note sung on the note the other
   part is sounding, each frame compared by its clock time, never by an anchored beat, read before
   the neighbour rule. Lesson 18's
   flow allows three takes a visit; this page's options give three a set, and a model before each
   run.
5. **Lesson 24's checks**, its item 6, `kit/headphones.ts` and `kit/quiet-check.ts`
   (`docs/plans/find-your-pitch/lessons/24-drone-harmony/WEB-SPEC.md:748-756`), with two options
   for this page: the check's line names what plays, "Merc's part" or "Tavi's part", where Lesson
   24's names the drone; and the quiet check plays the first 2.0 s of the set's other part, where
   Lesson 24's plays the drone.
6. **A part under a take**, code with tests, widening Lesson 24's item 5
   (`docs/plans/find-your-pitch/lessons/24-drone-harmony/WEB-SPEC.md:743-747`): the hush's one kept
   source is any one voice built before the hush, a drone or a contour voice, not a drone alone; a
   contour voice can be booked to start later through `at` (`src/features/lessons/kit/sound.ts:39-43`),
   so the other part is built when the take is set up and starts on bar 1's first beat; and a
   helper turns a part's notes into its contour, each note a held point with a 0.05 s glide to the
   next and a dip in level to a quarter for 0.08 s between two notes on one pitch, so Lesson 28 can
   play a song's part the same way. Tests: during a take a play of any other source sounds nothing;
   the kept part sounds until its release, its notes at their onsets on the audio clock; a second
   kept source is refused; a part with a repeated note dips between the two.
7. **The tune line's two-part states** on the kit's tune line (`src/features/lessons/kit/tune-line.ts`),
   code with tests: a second line of beads beside the tune, solid, with its own label, lit by the
   same run; lanes, a key's rows drawn brighter; a bracket between two lines at a note, naming 4 or 3;
   a name beside a bead off the lanes; a line that draws its beads as they sound; Step 1's pair and
   its walk; Step 2's switch moving some beads of a line; Step 3's switch and its two-colour state;
   Step 4's chord bar, gold glow and hollow beads; the lock, in the step and in free play, as Lesson
   18's item 4 gives it, drawing the hero's state, the tune alone on plain rows, until the choice
   and from the page's `onChoice` each step's own; and each state's spoken summary.
8. **The lab test, on a phone**, before the scored runs ship and before the chip is set, on the
   lab's phones (one iPhone, one Android) and laptops, with the coach where a run is sung:
   - **Silence over Merc's part from the speakers**: with nobody singing, the other part played at
     the run's level and at full volume, the microphone open, the quiet check must fail or the run
     must read no voice, on every device, and silence must never read as notes in the band or as
     "That was Merc's note"; the same with closed and open-back headphones, where the check should
     pass, and with Bluetooth earbuds, whether opening the microphone switches the headset's
     profile or moves the part to the loudspeaker (FACTS 28, 52).
   - **The reader with a part playing**: Lesson 18's lab items on real takes
     (`docs/plans/find-your-pitch/lessons/18-read-a-line/WEB-SPEC.md:722-738`), here with Merc's
     part in the headphones: whether learners come in with it, whether 0.45 s within 60 cents is
     reachable on a one-beat note against a part a third away, how often the new line shows, and
     how far each device's round trip, output and input, shifts a take's frames against the part as
     played, which the new line compares by clock time (Toys 5).
   - **Levels and sounds**: the other part's level in the headphones, so the learner hears their
     own voice; the soft tone's C3 and the "ooh"'s E3 on a phone's speaker.
   - **The states' timing** for the chip (SEASON-2 § 1.3), and the tune line's two-part states at
     344 to 390 px.
9. **The head and the share card** (Sections, 2): the title, the descriptions, the share card
   `learn/lesson-26-og.jpg` and its alt, and the structured data with `timeRequired` `PT16M`; the
   head test already has its word for sixteen (`src/tests/lesson-pages.test.ts:84`).
10. **Lesson 24's questions as a module** (`lesson-24/quiz-questions.ts`), so this page imports
    `l24-q1`; Lesson 12's module exists (Toys 4).
11. **The lesson copy**: this lesson's tease and its `plan` variant set on Lesson 26, with the
    variant's team note (Explorer and season data), within `TEASE_MAX`: 68 and 56 characters; and
    the signature line in the team's notes.
12. **Season 2 in the app's lesson plumbing** (SEASON-2 § 5.2 item 21), the app's work: the lesson
    marker's range (`src/lib/lesson-marker.ts:11-19`) and the lesson-answer bounds
    (`workers/db-worker/src/mirror-metrics.ts:57-62`), which refuse Lesson 26's answers whole today
    (FACTS 67).
13. **The harmony-line drill** (SEASON-2 § 5.2 item 17), the app's work (Practice links).
14. **At release, the room's link back**, optional: SEARCH § 8's row for Jam gains 26.
15. **Harmony Stack's note names**, shipped (`fix(jam): Name harmony notes by their own pitch`):
    `harmoniseItems` names each moved note from its own pitch (`src/lib/jam/jam-modes.ts:141-151`),
    and the canvas prints that name with its octave on the box
    (`src/components/jam/JamExerciseCanvas.tsx:68`, `:356-365`), so the third's boxes over the C
    major scale in a higher voice's room read E4 to D5, where they read C4 to G4, A5 and B5 before
    (`verify26.py`, section 13). Its tests pin the names: in C major, the third over C4 is E4 and
    over A4 is C5, the fifth over B4 is F5 (`src/tests/jam-modes.test.ts:134-174`). The comment
    above the call, "a fourth singer lands on the seventh" (`src/lib/jam/jam-modes.ts:209-210`), was
    left, though `roleCountFor` caps the parts at three and a fourth singer sings the tune (FACTS
    63). The card's sentence is now "It plays nothing; its boxes name their notes." (FACTS 63a).
16. **Harmony Stack for a friend who joins late**, shipped
    (`fix(jam): Send a late joiner the room's drill and mode`, and for a song
    `fix(jam): Send a late joiner the room's song, and nobody else`): once a newcomer's channel
    opens, the host sends them what the room is on, to them alone, so the room already singing
    carries on: its drill and the mode it is sung in (`sendRoomDrillTo`,
    `src/stores/jam-store.ts:1322-1338`; `sendMelody`, `src/lib/jam/service.ts:1043-1057`), or its
    song (`sendRoomSongTo`, `src/stores/jam-store.ts:665-680`), from `onPeerChannelReady`
    (`:2301-2315`). Before, the mode travelled only with the drill, sent when the host picked it, to
    the channels open then (`broadcastData`, `src/lib/jam/service.ts:1141-1148`), and the song went
    out on the room's announcement, before the newcomer had a channel, so a friend who joined after
    the pick stayed in unison on their own default scale (FACTS 64). The card's last two steps, the
    pick and the share, now work in either order.

## Decisions for the owner

None is open. The lead chose the head's title, "How to sing a harmony in thirds | MercuryPitch"
(46), query-led as SEARCH § 13 item 1 decided, and the chip's 16 minutes (FACTS 3); and the card
describes Harmony Stack as it is, "It plays nothing; its boxes name their notes.", now that items
15 and 16, the app's work on Harmony Stack, have shipped (What the kit and the app still need;
Practice links; FACTS 63a, 64).

## Edge cases

- **Sound off, unset or missing.** Every play obeys the kit's `canPlay`. The predict's reveal waits
  for a play heard with sound on; Start waits for sound (Toys 5). With no Web Audio the page stays
  readable, every play runs its drawing in silence with its hint, and Sing it offers the sing-along
  as words alone.
- **Before the cold open's choice**: Play them together is locked and the reveal hidden; the steps'
  stage and free play draw only the hero's plain "Twinkle", their controls and the text's plays
  disabled under their lock line; quick check 2's answers and quick check 4's play are disabled;
  the tour waits (Toys 1, 2, 4).
- **Before the cold open's reveal**, its choice made: the steps' stage works, and Steps 1 and 2's
  text, plays, mix-up card, Try and Notice stay hidden under their held lines until the copy has
  been heard to its end (Toys 1).
- **A play cut short** (another sound, a step link, leaving the hero or the step): not heard, no
  reveal, the hint as it was; the line keeps what it last drew.
- **A return visit** starts with the predict fresh, so the steps' stage, free play and quick check
  4 hold back again until the choice, and Steps 1 and 2's words until the reveal.
- **The switch pressed during a play**: the play stops and the switch moves the beads; a new Play
  plays the new setting.
- **Reduced motion**: beads land and light with no transition; the copy's fade lands at once.
- **A first visit that never chooses**: the welcome tour waits, and the next lesson page opened at
  the top offers it again; "Tour this page" runs it at once (Toys 1).
- **No voice chosen**: every example sounds in C; nothing in Sing it plays until a voice is chosen,
  and the voice moves only Sing it's notes.
- **"I have headphones on" with none on**: the quiet check hears Merc's part and opens the
  sing-along (Toys 5, state 6).
- **A hum, an early answer, a television or a second singer during the quiet check**: it fails as
  Merc's part would, since it cannot tell them apart; its line says the microphone heard a note and
  asks for quiet, and Start runs it again.
- **Headphones unplugged during a set**: Merc's part then reaches the microphone; the reader cannot
  tell, and its lines say only where notes sat. The quiet check runs before every set, Again's
  included.
- **The microphone refused** at Start: the sing-along; no take is counted.
- **A run with no voice**: Lesson 18's no-voice line with this task's cue, Start again while the set
  has takes left, no feeling question.
- **The learner sings Merc's part instead of their own**: each note read on Merc's note says so,
  "That was Merc's note: …", and "How did that feel?" follows as after any run.
- **A part sung an octave away**: read in full, with the octave line.
- **The swap sung on the harmony**: the lines read against the tune, and each note sung on the
  harmony's note says "That was Merc's note: …".
- **A narrow phone**: the stage keeps every target at least 44 px; the brackets' numbers sit beside
  their brackets, never over a bead.
- **Leaving Sing it mid-run**: the take is abandoned and counts as one of the set's three, Merc's
  part stops and the microphone is released.
- **The card's drills, off this page.** A learner with no one to sing with gets unison in Harmony
  Stack, so the card offers Drone Intonation for a learner alone. A friend who joins after the host
  has picked Harmony Stack is sent the room's drill and its mode, so the card's last two steps, the
  pick and the share, work in either order (item 16; FACTS 64). A host who never set a range opens
  on the tenor's octave, which is why the card sets the range first; a lower and a higher voice in
  one room leave a note outside a preset, since the room scores the host's octave, and the card
  advises no pairing, the coach's list carrying the table (FACTS 63b, 65).

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-26/`, and on the kit
parts it adds:

1. **Sounds**: every fixed sound's frequency as FACTS 75 to 78 give it; every play's length, 8.0 s
   for each "Twinkle" play, 6.0, 3.0 and 3.0 s for the words, 7.0 s for Step 1's scale, 3.0 s for
   Steps 3 and 4's plays, 7.0 s for quick check 4, and 2.0, 6.0, 4.0 and 6.0 s for the quiet check,
   the model, the count-in and a run; every two-part play's notes share their onsets.
2. **The arithmetic**: the third above each degree of C and G major is 4, 3, 3, 4, 4, 3, 3; the
   key's copy of "Twinkle" is all in C major, its thirds 4 over C, F and G and 3 over D, E and A; the
   copy four semitones up has C♯5, G♯4 and F♯4 off the key and nothing else; Step 3's parts and their
   thirds; Merc and Tavi's 16 and 15 semitones; Step 4's chord notes and passing notes; quick check
   4's first part's F♯4 and G♯4 (FACTS 12 to 17, 19, 23).
3. **The range**: every note of both voices' parts and tunes at least 2 semitones inside every
   preset of its voice in `VOCAL_RANGES`, with the table's numbers (FACTS 50); no Move do control and
   no octave switch in Sing it.
4. **The predict**: at first paint the hero draws "Twinkle" with no lane, no copy and no name; Play
   the tune works before a choice and never reveals; Play them together does not play before a
   choice; the reveal waits for it heard to its end with sound on; a play cut short reveals nothing
   and leaves the hint; no `next` hint is set; the hints and "You said" lines are LESSON.md's; Steps
   1 and 2's words stay hidden, the held lines in their place, until the reveal, and show with it,
   after the hero's reveal in the announcement (FACTS 35, 40, 41).
5. **Nothing answers the predict before its choice**: the lesson menu's headings, the recall, the
   three words and the head's lines name no third's size and nothing that leaves a key; until the
   choice the steps' stage and free play draw the hero's state alone, "Twinkle" on plain rows with
   no lane, no second line, no bracket and no name on a bead, with the hero's spoken summary, and
   sound nothing; quick check 2's answers take no tap and quick check 4's play sounds nothing; no C
   major lane lights and no copy four semitones up sounds anywhere; from the choice each step draws
   its own state, and a return visit holds them all again (FACTS 1a, 40).
6. **The quiz**: the recall imports `l12-q3` and `l24-q1` unchanged, with their away links; the
   quick check's ids, keys and words as LESSON.md gives them; question 2's answers are disabled
   under "Choose an answer at the top to try this." until the cold open's choice, and enabled by it
   (FACTS 72).
7. **The reader's new rule**, on synthetic takes through Voice Mirror's `preprocess`, as Lesson
   18's tests run (`docs/plans/find-your-pitch/lessons/18-read-a-line/WEB-SPEC.md:866-882`), with the
   cases of Toys 5: on pitch and on time; a whole beat late on its own notes, read in the band; the
   lower part's singer a beat late on Merc's sounding notes, each note read as Merc's by the note he
   is sounding at its frames' clock time, never by the anchored beat; do on Merc's mi; la on Merc's
   do in beat 1, read before the neighbour rule; ti off both parts, its gap; the higher part's so on
   Tavi's mi; the swap's do on Merc's la; and Merc's part alone with no voice, every note read as
   Merc's. No line ever reads "in the band" for a note sung on the other part's note.
8. **The quiet check with a part** (What the kit and the app still need, item 5): it plays the
   set's other part's first 2.0 s; a voiced run of 0.3 s at any pitch fails it, with its line naming
   Merc's part, or Tavi's for the higher voice; it runs before every set, Again's included.
9. **The part under a take** (item 6).
10. **The flow and the set's rules** (Toys 5): the model, the count-in and the run in order; three
    takes a set, a take with no voice or one cut short counted; Again sings the set again, the quiet
    check first; the swap only after Easy or Workable on the learner's part, its lines; a run with no
    voice gives the no-voice line with its cue and no feeling question; Effortful keeps the lines and
    offers nothing more, with the rest card; Uncomfortable takes the lines away, with the doctor
    lines and the rest card; no celebration; the tricky line at its share (FACTS 56, 57, 59, 60).
11. **The sing-along and the listening path**: the sing-along opens after No headphones, no
    microphone, a refused microphone and a failed quiet check; asks for no microphone; plays the
    model, the count-in and the other part; gives its Easy and Workable line; offers Swap parts, and
    Sing along again once a visit. After "Just listen today", the headphones check, Start and the
    sing-along do not show, and Play the two parts plays the tune, the part and both (FACTS 49, 61;
    REQ-GVC-055).

Page tests (the series' own, run on every lesson page): the head test, with the title, the
description's length and its "A sixteen-minute lesson", the chip and `timeRequired`
(`src/tests/lesson-pages.test.ts:156-159`, `:191-210`); no planning text on the page, S20b
included, since the test's pattern takes a lettered code
(`src/e2e/learn-no-planning-text.spec.ts:40`); the stage fits a 390 px screen; first paint within
the budget; the claims validator; one sound at a time; no background staff or clef; the tour's
hold.

## Contract

Lesson 1's contract, unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of
GSAP, and practice links that carry `?lesson=26`. Then the layout, accessibility, sound, motion and
storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text children,
touch targets of at least 44 px with no two tap zones overlapping, visible focus, a single dark theme
with every colour a token and an explicit body background, sound only after a tap, the microphone
only after Start, localStorage only for per-viewer conveniences inside try/catch, and the whole page
usable with no sound, no microphone, no headphones, no WebGL and no storage. The figures' accessible
names and every live region use words only, and every note is spoken with its letter and octave,
"C sharp 5", never the sign. The page stores the quiz seeds and records (`fyp-l26-recall-seed`,
`fyp-l26-recall-v1`, `fyp-l26-seed`, `fyp-l26-quiz-v1`), `fyp-done`
(`src/features/lessons/kit/progress.ts:12-15`), `fyp-voice`
(`src/features/lessons/kit/voice-choice.ts:20`), `fyp-motion`
(`src/features/lessons/kit/motion-switch.ts:12`), `fyp-pos` (`src/features/lessons/kit/position.ts:20`)
and `fyp-tour` (`src/features/lessons/kit/tour-gate.ts:29`); nothing from the toys, the headphones
answer, the quiet check or the runs: the headphones answer holds for the visit, in memory. No frame,
reading or answer from Sing it is kept or sent, and nothing is recorded: a take is held in memory
until it is read and then dropped (`src/features/lessons/kit/listen.ts:19-22`). The predict's choice
holds for the visit, in memory: a return visit starts fresh.

Page QA before publishing adds, for this page, every check against a local or dev build, never
production:

- Every play, switch and button works by keyboard alone and announces what LESSON.md shows.
- The cold open's plays sound and draw as FACTS 35 says: the copy's three notes off C major land off
  the lanes with their names; the key's copy lands on them.
- No source on the page sounds a copy four semitones up, or lights a C major lane, before the cold
  open's choice; the steps' stage and free play show the hero's plain "Twinkle" until then.
- The lab test has passed and is written down where the coach's sign-off is.
- With headphones, a part sung in tune reads in the band note by note, a note sung on Merc's note
  reads as his, and a part sung an octave away reads in full, by ear, with the coach.
- On a real phone at 390 px, the tune line's four states, the brackets' numbers and the run's lines
  fit their cards, and C3 and E3 are heard through the speaker.
- The practice card's Harmony Stack lines hold in a local Jam room with two peers, the card's steps
  followed in its order: the host sets a range in Settings and opens the room from the card's link,
  the room opening on the C major scale in that range's octave; the host picks Harmony Stack under
  More controls; then the guest joins by the shared link, and the two get the tune and the third.
  Nothing plays; each part's boxes name its own notes; a note sung an octave from its box scores
  nothing. Once more with the guest in before the pick, the repo's two-peer check's own order, so
  both orders are seen to work (items 15 and 16; FACTS 63a, 63b, 64).
