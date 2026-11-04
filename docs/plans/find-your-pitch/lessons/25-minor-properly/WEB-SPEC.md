# Lesson 25 web page: spec

The Lesson 25 page is the web lesson for "Minor, properly": written steps, one main toy in four
step states with free play, a cold open on Lesson 10's minor staircase, one predict, the four words,
an unscored sing-along, two quizzes (the recall and the quick check) and the lesson explorer. Copy
is in [LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is a text-only package: no
film exists for Lesson 25, so the page has no Watch section and the masthead's anchors are Lesson,
Sing and Explorer.

It is built on the kit (`src/features/lessons/kit/`) as Season 2's kit PR leaves it (SEASON-2 § 8.2
item 1): the season structure, the staff toy with both clefs, key signatures and the house on the
staff, and the lesson plumbing; on Lesson 21's page, whose key signatures in both clefs it reuses;
and on Lesson 23's, whose sing flow, voice line and predict lock it reuses. Like every lesson page it
reuses and never copies: a part that lives in an earlier lesson's module moves into the kit first,
as Lesson 10's chord beads and staircase, Lesson 12's chord levels and Lesson 6's interval pair do
here (What the kit and the app still need, items 4, 6 and 7). Where this page shares a behaviour
with Lesson 23's, it is Lesson 23's, unchanged unless this spec says otherwise.

One object carries the lesson: Lesson 10's minor staircase, do re me fa so le te do on A, with its
chord column, beside the learner's staff (FACTS 29). In the hero it stands alone, the house on do;
the tune play's second ending lifts te to ti for a moment, and the chord column draws in only after
the predict's choice. In Step 1 te lifts to ti and the chord on so's middle bead slides up a row,
once the cold open's choice is in, and the step's two sentences on that chord show with its reveal;
in
Step 2 the le-to-ti stair, now three semitones, is outlined; in Step 3 le lifts too, on the way up
only; in Step 4 the staircase redraws from C major to A minor on the same white piano keys, the
house moving from C to A while the staff's key signature stays empty, then C minor's three flats
move into the signature. That path is the card's signature (FACTS 4, 29).

Its public home is `mercurypitch.com/learn/25` (FACTS 9): a hand-written document `learn/25.html`
with its module in `src/features/lessons/lesson-25/`, wired as Lesson 23's page is: a written lesson
with no film, its cold open before its recall, a recall that asks other lessons' own questions, and
a sing-along with no microphone. It joins `kit/drafts.ts` in its first commit and publishes only
after `/learn/10`, `/learn/21` and `/learn/23` are live, because its prerequisite chips and its
recall link there and it imports Lesson 10's and Lesson 21's questions, and after the vocal coach's
look at its voice lines and its sung drill (LESSON.md, For the vocal coach). The next-lesson card on
Lesson 24's page draws this lesson's tease above its hook from the season data, and this page's
card draws Lesson 26's; neither is written into a page's markup (FACTS 5, 5b).

## Look

Lesson 23's look: the dark listening room, the series colour code, Lesson 1's type and wordmark,
the staff toy's engraving and the motion rules (Lesson 23 WEB-SPEC, Look), with Lesson 10's
staircase and beads as Lesson 10's page draws them. On this page:

- **Notation** is ink `#e6edf3` on chrome lines `#c3ccd6`: plain noteheads without stems, since no
  note value is taught, accidentals to the left of their notes, the key signature after the clef,
  and ledger lines no further than a note needs. A note lights in its singer's colour while it
  sounds, blue `#58a6ff` on the bass staff and orange `#ff7448` on the treble, by the voice the
  learner chose, and its stair lights in the same colour.
- **The staircase** keeps Lesson 10's look: eight chrome stairs, each stair's rise its step in
  semitones, each named with its syllable, the house on do. A stair that moves (te to ti, le to la)
  slides up a semitone's height in 0.4 s and its name changes as it lands. The le-to-ti stair, three
  semitones high in harmonic minor, carries a chrome outline and "3" beside it in Step 2 and in free
  play; nothing marks it in colour alone.
- **The chord column** is Lesson 10's beads: three beads on faint semitone rows, each named beside
  it one letter per chord tone, the gaps between them counted, "3" and "4", and the chord's name
  under them, "E minor" or "E major", in JetBrains Mono. It is never drawn before the cold open's
  choice (FACTS 1a).
- **Gold** `#ffd84d` is not used: nothing on this page lines up as a fit.
- **No decorative staves or clefs** anywhere: in a season that teaches the staff, a staff is always
  music (SEASON-2 § 1.5 item 7; FACTS 6).
- **Nothing is in tune or out of it**, and nothing is scored, so the page uses no target band, no
  singer violet and no mint.

What moves: Merc and Tavi's idle loops; while something the learner started plays, the lit stairs,
notes and beads; a stair or bead sliding a semitone (0.4 s); the chord column drawing in after the
choice (0.4 s); in Step 4 the staircase redrawing from C major to A minor, the house gliding from C
to A (0.6 s), and C minor's three flats moving from their notes into the signature (0.6 s). Under
`prefers-reduced-motion`, or with the masthead's Pause animations on, Merc and Tavi stop, every
slide and glide lands in place and the flats appear in the signature; what the learner starts still
sounds, and the notes still light as they sound (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Season 1's departures kept: the step toys double as the
Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it; the
practice card sits in the Wrap. No Watch section. The page opens in Lesson 2's order (FACTS 5a).
Each section's heading, and the line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Season 2's, "Season 2 · Lesson 25", with Lesson, Sing and Explorer, the Sound
   toggle off by default and Pause animations, through `initMasthead`
   (`src/features/lessons/kit/page-chrome.ts:127-159`) with `{ lesson: 25, deck }`. Its lesson menu
   lists the four step headings from the first paint and heads its card "Lesson 25 · Why raise
   te?"; no heading names a chord or a quality (FACTS 1a). On a first visit its welcome tour waits
   for the predict's choice (Toys 3).
2. **Hero, with the cold open**, laid out as Lesson 2's: the kicker, the hook question as the title
   (`<h1 class="hook" id="hook">`), the meta as five chips, the promise and the sound gate from
   LESSON.md. The chips are "15 minutes" (FACTS 3); "After Lesson 10: Major and minor", "After
   Lesson 21: Keys and the circle of fifths" and "After Lesson 23: Perfect, major, minor and the
   tritone", links to `/learn/10`, `/learn/21` and `/learn/23` that stay plain chips wherever their
   lesson is not live (`src/features/lessons/kit/page-state.ts:14-20`; FACTS 2); and "Sound on". Its
   stage holds Tavi's and Merc's bubbles over Merc and Tavi on the floor line, the staircase between
   them (Toys 2), and under it the cold open's three plays: Play the tune, twice, which works from
   the start, and Play ending 1, with chords and Play ending 2, with chords, locked until a choice.
   The predict card sits under the stage (Toys 3). On a phone the hero's parts run kicker, title,
   meta, the stage, the gate, the predict, then the promise
   (`src/features/lessons/kit/lesson-stage.css:394-437`), so the title and the first play come
   before anything asks for an answer. The five chips wrap to two or three lines at 390 px. The
   head: the title, at most 60 characters, "Harmonic and melodic minor, relative keys |
   MercuryPitch" (56), the lead's choice on 2 November 2026 (Decisions for the owner); the
   description, "Why does a minor key often raise one note just before it comes home? A
   fifteen-minute lesson with sound toys: harmonic and melodic minor, and relative keys." (156),
   which the head test holds to 80 to 160 characters and to the chip's run time in words; og:title
   and twitter:title "Minor, properly · Find Your Pitch, Lesson 25" (44), in Lesson 4's form;
   og:description and twitter:description the hook alone (68); the share card
   `learn/lesson-25-og.jpg`, 1200 by 630, its alt "The title card: Find Your Pitch, Lesson 25,
   Minor, properly, above Lesson 10's minor staircase on A, do to do, with the house on do, between
   Merc and Tavi." (155), with te at rest and no chord (FACTS 1a); the two structured-data blocks
   from Lesson 1's, the Article's `headline` the lesson's name, its `alternativeHeadline` the hook,
   its `description` the meta description, so it holds "A fifteen-minute lesson" as the head test
   asks, `timeRequired` `PT15M`, position 25, and `teaches` "Natural, harmonic and melodic minor",
   "Raising te to ti before home" and "Relative and parallel keys"; and, on release, the llms.txt
   line in Season 1's form: "[Lesson 25: Minor, properly](https://mercurypitch.com/learn/25): Why a
   minor key often raises one note just before it comes home. Natural, harmonic and melodic minor,
   the raised seventh, and relative and parallel keys." (SEARCH § 3.2 and § 3.4). None of them names
   a chord's quality (FACTS 1a).
3. **Recall from Lessons 10 and 21**, straight after the hero: Lesson 10's question 4 and Lesson
   21's question 2, shown to everyone (Toys 7; FACTS 7).
4. **Four words you'll meet**: Natural minor, Harmonic minor, Melodic minor and Relative keys, each
   with its figure and play (Toys 4).
5. **Steps**: the step deck, four steps, the staircase and the staff toy stuck beside the text (Toys
   1), Step 3's mix-up card in its text, a Go deeper drawer in Step 4 (Toys 6).
6. **Sing it**: the comfort check, the voice choice and Lesson 15's line under it, Your turn, the
   staff guide and "How did that feel?" (Toys 5).
7. **Quick check**: four questions (Toys 7).
8. **Wrap**: the three lines, the one-sentence challenge, the practice card in the version Sing
   it's ending picks (Practice links; Toys 5), the next-lesson card with its still (Toys 8), and free
   play, the step toys on one card, its chord held until the cold open's choice (Toys 1).
9. **Explorer**: the season's map, opening on Season 2's tab (Explorer and season data).
10. **Footer**: LESSON.md's, with the two practice links, the fonts line and "Every sound on this
    page is synthesised in your browser."

## Length

The learner copy is 2,160 words on `node scripts/lesson-words.mjs`, every branch counted, under the
series' cap of 2,379 by 219 (FACTS 3). The page runs about 15 minutes: 9.08 minutes of reading at
238 words a minute and about 5.7 of sound, toys and tasks, 14.81 in all, past MASTER-PLAN § 4.2's
"8 to 12 minutes of active time, 500 to 900 words", as Lessons 10, 12, 15, 21 and 23 are. The chip
is an estimate until the staircase's states and the staff's key signatures are timed in their lab,
as SEASON-2 § 1.3 asks, and this section says so until then. Each step's own text, with its Try,
its Notice and any Tavi line, runs 104 to 120 words (Steps 1 to 4: 120, 104, 117 and 120), inside
50 to 120 a step; Step 1's count includes its paragraph on the chord on so, which shows with the
cold open's reveal. Six parts carry more, by the same counter, for these reasons:

- **Step 3, 210 words with its mix-up card.** The card sits in the step whose toy refutes it.
- **Step 4, 175 words with its drawer**, one item, closed by default.
- **Sing it, 326 words.** It holds the series' singing lines, Lesson 3's word for word, which are
  not cut, Lesson 15's line under the voice choice and two lines of its own (Your turn's listening
  line, and Easy and Workable's) (FACTS 39 to 46).
- **The quick check, 262 words**, and **the recall, 159**: three answers a question with a line of
  feedback for each, as MASTER-PLAN § 4.2 item 8 asks; the recall is Lessons 10's and 21's, word for
  word.
- **The cold open, 183 words**: the predict states that the chords are not yet played, the chord
  before home and the raised note, so a learner can reason it out, and the reveal counts both thirds
  (FACTS 33, 35).
- **The Wrap, 413 words**: the practice card says what Gravity does and what the app lacks, and its
  second drill, Sight-Singing, needs its route through the Singing tab, Lesson 16's care lines and
  its two sentences on the octave and the names; its rest version is Lesson 12's (FACTS 47 to 53).

The hints and status lines are stage directions in LESSON.md and are not counted, as in the text
packages of Lessons 9 to 23: the predict's hints and its two "You said" lines, the names of the
plays a choice unlocks, the stored voice's line, the steps' lock line and Step 1's held line, Sing
it's hints, and the toys' labels, readouts and hints. A built page writes them in the open and
counts them, about 150 words more (Lesson 8 FACTS 4), so the built page is about 2,310 words, under
the cap, with the chip still at 15 minutes. No cut is needed. The article plan budgeted near 1,200
words; its own section estimates add to 1,525, with none for the recall or the practice card (FACTS
3).

The activities are timed from this spec's lengths (FACTS 3, 58 to 65). Free play is not counted.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                                        | New in Lesson 25                                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. The steps' toy         | Lesson 10's chord beads and their staircase, moved into the kit; the kit's staff toy with both clefs, key signatures and its pitch-line switch (SEASON-2 § 6.2 item 2; Lesson 21 WEB-SPEC, Toys 1); Lesson 6's pair; Lesson 12's chord levels | Raise te and Raise le on the staircase; the widened stair's outline; the chord on so as a column; C major redrawn as A minor; a signature-only staff in the other clef |
| 2. The hero's staircase   | Toy 1's staircase and chord column                                                                                                                                                                                                            | The tune played twice, its second ending's G♯ lifting te; the chord column drawn in by the answering plays                                                             |
| 3. Predict widget         | The kit's predict (`kit/predict.ts`), with the tune play as its free example, `revealAfter: 'all'`, `unlocks`, `onChoice` and several reveal elements; the tour's hold (`kit/tour-gate.ts`)                                                   | The steps' toy and the Wrap's free play hold back Raise te, Raise le and the chord until the choice; Step 1's paragraph on the chord on so shows with the reveal       |
| 4. Four words             | The kit's words strip (`kit/words-strip.ts`), with the page's sound owner; Toy 1's staircase, small                                                                                                                                           | Four small staircase figures                                                                                                                                           |
| 5. Sing it                | Lesson 23's Sing it, on Lesson 12's sing flow moved into the kit (`kit/comfort.ts`, `kit/voice-choice.ts`, `fyp-voice`, `kit/move-do.ts`'s count-in); Lesson 12's rest line                                                                   | The so, te, do and so, ti, do figures in A minor on the learner's staff; a count-in on so; two lines of its own                                                        |
| 6. Go deeper drawer       | Lesson 2's `details` drawer                                                                                                                                                                                                                   | One item                                                                                                                                                               |
| 7. Recall and quick check | The kit's quiz (`kit/quiz.ts`); Lesson 10's questions (`lesson-10/quiz-questions.ts`) and Lesson 21's, imported as Lesson 10 imports Lesson 6's                                                                                               | Ids and keys; quick check 4's play                                                                                                                                     |
| 8. Tease stills           | The kit's next-lesson card and its slot (`kit/next-card.ts`)                                                                                                                                                                                  | This page's opening as a still, for Lesson 24's card                                                                                                                   |

### 1. The steps' toy

Lesson 10's chord beads (`src/features/lessons/lesson-10/chord-beads.ts:1-30`), moved into the kit
with their drawing and layout (`lesson-10/chord-beads-draw.ts`, `lesson-10/chord-layout.ts`), in
two of their states side by side: the scale state, which Lesson 10's Step 5 spreads into a staircase
with its Major · Minor (`src/features/lessons/lesson-10/steps.ts:259`), here on A in Minor; and the
chord state, a column of three beads. Beside them, the kit's staff toy in the learner's clef, A2 to
A3 in the bass clef for the lower voice and A3 to A4 in the treble for the higher, the house on do
(`src/features/lessons/kit/home-glyph.ts:1-13`), with its Clef switch and its "See it on the pitch
line" switch, which swaps the staircase for the season's pitch line with the same notes lit (FACTS
8). One instance per step, each in its step's state, and one more in the Wrap's free play with every
control, its chord held until the cold open's choice (Free play, below). Every play lights its stairs, its notes and its beads as they sound, and the staff writes
each figure as it plays: a bar per figure, so no sign is ever cancelled and the page needs no
natural sign. Notes are spelled one letter per degree from the kit's spelling (`spellScale`,
`src/features/lessons/kit/notes.ts:165-177`; FACTS 10).

- **Step 1** (Why raise te?): the staircase in natural minor; the chord on so's column to its
  right, E, G and B in the learner's octave, named one letter per chord tone, its gaps "3" and "4"
  and its name "E minor"; Raise te, a switch that lifts the te stair a semitone to ti and slides the
  column's middle bead up a row, G to G♯, its gaps becoming "4" and "3" and its name "E major" as it
  lands. Plays: Play so, te, do and Play so, ti, do (each 2.4 s), and, in the step's text, Play the
  chord on so, then home (2.4 s), which plays the column's chord as Raise te sets it, then A minor.
  Before the cold open's choice the column is not drawn and Raise te is disabled with its name kept,
  under the steps' line "Choose an answer at the top to unlock the rest of this figure."; the two
  figure plays work, lighting their stairs, and Play so, ti, do lifts the te stair for as long as it
  sounds, as the tune play's second ending does. The choice draws the column (0.4 s), enables Raise
  te and removes the line. The step's paragraph on the chord on so, with Play the chord on so, then
  home, is the predict's second reveal element: hidden until the reveal, with the held line "Choose
  an answer at the top, then hear both endings, to unlock this paragraph." in its place, which the
  predict's `onReveal` hides (Toys 3; FACTS 1a, 36, 61).
- **Step 2** (What does the raised note do to the scale?): the staircase in harmonic minor, the
  le-to-ti stair outlined with "3" beside it. Plays: Play A harmonic minor, up and down (5.95 s),
  and Play le to te, then le to ti, two of Lesson 6's pairs (3.6 s), each pair's two stairs lit and
  its semitones counted under it, "2" then "3" (FACTS 19, 62).
- **Step 3** (Is there more than one minor scale?): the staircase in harmonic minor with Raise le,
  a switch, off as Step 2 left it. Switched on, the scale is melodic minor: on the way up le lifts to
  la and te to ti, and on the way down both settle back. Plays: Play A melodic minor, up and down
  (5.95 s), which switches Raise le on as it starts; Play A major, then melodic minor, going up (6.8
  s), the staircase redrawn as A major for the first scale, its third stair mi, then back; and the
  toy's Play the scale, up and down, as the switch sets it (FACTS 13, 21, 63). The staff writes the
  scale going up, F♯ and G♯ with their sharps, then the scale coming down as a figure of its own,
  with no sign.
- **Step 4** (Why do C major and A minor share a key signature?): the learner's staff with its key
  signature, the house on do, and under it a small staff in the other clef that shows the same
  signature and no notes; beside them the staircase. Plays: Play C major, then A minor (6.8 s): the
  staircase is C major's, do on C, as the first scale plays, then redraws as A minor's on the same
  white piano keys, the house gliding from C down to A and every stair's syllable changing, A from
  la to do, while both staves keep their empty signature; Play C minor (3.15 s): C natural minor, its
  E♭, A♭ and B♭ written with their own signs as they sound, then moved into the signature on both
  staves, in the signature's order, B♭, E♭, A♭, at the places FACTS 27 gives for each clef, the house
  back on C (FACTS 22 to 27, 64). The staircase never shows a key past three flats (SEASON-2 § 7
  item 13).
- **Free play**, in the Wrap: the four states on one card, with Raise te and Raise le, the chord
  column, every play above and the Clef switch. Season 1's free play locks nothing, because there
  the guided steps come first on the page (`src/features/lessons/lesson-10/wrap.ts:9-12`); this one
  keeps Step 1's hold, as Lesson 22's free play keeps its steps' holds, since a learner can scroll to
  the Wrap before the choice (Lesson 22 WEB-SPEC, Toys 2). Until the cold open's choice Raise te,
  Raise le and Play the chord on so, then home are disabled with their names kept, and the chord
  column is not drawn, under the steps' line "Choose an answer at the top to unlock the rest of this
  figure."; its scale and figure plays work, none of them a chord. The predict's `unlocks` and
  `onChoice` reach it as they reach Step 1, and a return visit holds it again (FACTS 1a, 36).

Readouts and names: the staircase names each stair with its syllable, the beads with their letters,
and the staff's notes are spoken with letter and octave. A live region reads each change in words:
"Te raised to ti: G sharp 3", "E, G sharp, B: 4 and 3 semitones, E major", "Key signature: three
flats, B flat, E flat, A flat" (Contract).

### 2. The hero's staircase

The stage in the hero: Toy 1's staircase alone, A3 to A4, do re me fa so le te do, with the house on
do, between Merc and Tavi; no staff, since the voice choice comes later (FACTS 8). Its plays:

- **Play the tune, twice** (`data-free`): the four-bar tune on Merc's "ooh", 17.0 s, each note
  lighting its stair; the second time, as G♯4 sounds, the te stair lifts a semitone and reads ti,
  then settles back when the play ends (FACTS 30, 31, 59). No chord plays and no chord is drawn.
- **Play ending 1, with chords** and **Play ending 2, with chords**, locked until a choice: bars 3
  and 4 with chords under them, 4.0 s each (FACTS 34, 59). As the chord before home sounds, the
  chord column draws in to the staircase's right (0.4 s), E, G and B or E, G♯ and B, named, its gaps
  counted and its name shown; if ending 1's column is still drawn, ending 2 slides its middle bead up
  a row. The column stays until the next play.

The stage's figure is described for screen readers as "Lesson 10's minor staircase on A, do to do,
with the house on do", and each play announces what lights.

### 3. Predict widget

The kit's predict (`src/features/lessons/kit/predict.ts`), as it is (CURIOSITY-MOMENTS § 1, rule
2): two `.choice` buttons, "It turns major" and "It stays minor"; the plays `tune` (with
`data-free`, the tune play), `end1` and `end2`; `revealOn: ['end1', 'end2']` and `revealAfter:
'all'`, since the predict compares two sounds; the hints from LESSON.md, `chosen` "Locked in. Play
both endings.", `silent` "Sound is off: nothing played. Turn sound on, then play it again." and
`again` "Play any of them again.", with no `next` hint (FACTS 37); the markup's lock hint, "Choose
an answer to unlock the two endings with their chords."; `guess` giving "You said: it turns major"
or "You said: it stays minor"; `unlocks` with Step 1's Raise te and the free play's Raise te, Raise
le and Play the chord on so, then home, which the choice enables together; `onChoice`, which tells
Step 1 and the free play that a choice is in, so each draws its chord column and drops its lock line
(FACTS 36); `reveal`, two elements, the hero's `.reveal` first, since the kit writes the "You said"
line into the first, then Step 1's paragraph on the chord on so with its play, which the kit shows
together and announces in that order ("one or several elements",
`src/features/lessons/kit/predict.ts:70-71`; `showReveal`,
`src/features/lessons/kit/predict.ts:133-148`), as Lesson 22's Step 3 reveals four (Lesson 22
WEB-SPEC, Toys 3); and `onReveal`, which hides Step 1's held line and sets off Tavi's celebration
(Merc and Tavi). What a play does to the hint is the kit's: the tune play heard before a choice puts
the lock hint back; a play sound off kept silent shows `silent`; a play cut short, by another sound
or by leaving the hero, counts as not heard and changes nothing. The reveal waits for both endings
heard to their end with sound on, in either order.

On a first visit the welcome tour waits for the choice. Its step "One step at a time"
(`src/features/lessons/kit/tour-copy.ts:44-46`) scrolls to the steps' stage, so the page holds the
tour until a choice is made, through the kit's `holdTour`
(`src/features/lessons/kit/tour-gate.ts:57-69`), as Lessons 15, 19 and 23 hold theirs, with no time
limit (FACTS 36). A visit that never chooses is offered the tour again on the next lesson page it
opens at the top (`tourDue`, `src/features/lessons/kit/tour-gate.ts:36-49`); the lesson menu's "Tour
this page" still runs it at once.

### 4. Four words

The kit's words strip (`src/features/lessons/kit/words-strip.ts:1-12`), as Lessons 7 to 10 and 23
use it: a ticket per word with its figure, its word and definition from LESSON.md, and its play
button, each figure a small staircase of Toy 1's drawing in the learner's octave, lighting as its
scale plays (FACTS 60). The page passes its sound owner, so a word claims the one sound as it starts
and a newer sound anywhere stops it:

- **Natural minor**: A natural minor up.
- **Harmonic minor**: A harmonic minor up, its te stair lifting to ti before it sounds.
- **Melodic minor**: A melodic minor up and down, le and te lifting going up and settling coming
  down.
- **Relative keys**: C major up, then A minor up, on one staircase of white piano keys, the house
  gliding from C down to A.

No figure draws or plays a chord (FACTS 1a).

### 5. Sing it

Lesson 23's Sing it (Lesson 23 WEB-SPEC, Toys 5), on Lesson 12's sing flow moved into the kit, with
the guide drawn on the staff and no Move do. In order:

1. **The comfort check**, Lesson 3's, every visit, never stored (FACTS 39), through the kit's
   `mountComfort` (`src/features/lessons/kit/comfort.ts:159`).
2. **The voice choice**, Lesson 3's two buttons and lines (FACTS 41), through the kit's voice choice
   (`fyp-voice`, `src/features/lessons/kit/voice-choice.ts:20`), after either answer and before
   anything plays when none is stored. Under it, Lesson 15's line, word for word. The staff below
   follows a change at once, and the steps' staff with it.
3. **Your turn**: the learner's staff in A minor, its signature empty, with so, te, do, then so, ti,
   do as plain noteheads in two bars, E3 G3 A3 | E3 G♯3 A3 in the bass clef or E4 G4 A4 | E4 G♯4 A4
   in the treble, G♯ with its sharp, the house on do, and the pitch-line switch (FACTS 42, 45). On
   the bass staff E3 is the third space, G3 the fourth and A3 the top line; on the treble E4 is the
   bottom line, G4 the second line and A4 the second space. The stop line on its own line, then two
   buttons. Play Merc's notes plays Merc's line (lower) or Tavi's (higher) as two contours a breath
   apart, each one voice: so held 1.15 s and a 0.05 s glide, te the same, do held 1.8 s; 1.0 s of
   quiet; then so, ti and do the same way; 9.4 s in all (FACTS 45, 65; `contourOf`,
   `src/features/lessons/kit/sound.ts:296`; `playContour`, `src/features/lessons/kit/sound.ts:581`),
   each note lighting as it sounds. Start the guide waits until Merc's notes have been heard with
   sound on, with Lesson 12's two hints (`HINT`, `src/features/lessons/lesson-12/sing-flow.ts:192-197`);
   then it counts in on so, the line's first note, 0.8 s at 0.065 and 0.2 s of quiet (`countIn`,
   `src/features/lessons/kit/move-do.ts:65-74`; FACTS 46a), and a chrome sweep line runs along the six
   notes in time, 9.4 s, with no voice and nothing on the notes themselves. No Move do and no readout
   (FACTS 43).
4. **How did that feel?** after each sweep run to its end, through the kit's `mountFeelings`
   (`src/features/lessons/kit/comfort.ts:175`): Easy and Workable give LESSON.md's line; Effortful
   and Uncomfortable give Lesson 3's lines (with the doctor lines after Uncomfortable), put the guide
   away for the visit, as Lesson 12's flow does, and set the rest ending, "Effortful" included, as
   Lesson 12's flow asks (`AFTER_OPTIONS`, `src/features/lessons/lesson-12/sing-flow.ts:99-100`;
   FACTS 46, 47).
5. **Just listen today**: Merc's line on a tap, in the chosen voice, no guide, and the doctor lines
   (FACTS 40); it sets the rest ending too.

After "Effortful", "Uncomfortable" or "Just listen today" the Wrap's practice card shows its rest
version: Gravity as before, then Lesson 12's rest line naming Sight-Singing in place of the second
drill, through the kit's `VisitEnding` (`src/features/lessons/kit/comfort.ts:101-114`), as Lesson
12's wrap swaps its sung drill (FACTS 47). Nothing listens: the page never asks for the microphone.

### 6. Go deeper drawer

Lesson 2's `details` drawer, closed by default, under Step 4's text: "Do or la?" (FACTS 28). Text
only: no sound and no figure. Its bold lead-in is its summary line's words.

### 7. Recall and quick check

Two quizzes share this page through the kit's quiz (`createQuiz`,
`src/features/lessons/kit/quiz.ts:218`), each with its own prefix and keys.

- **Recall**: Lesson 10's question 4 and Lesson 21's question 2 (FACTS 7), imported from their pages
  and filtered by id, `l10-q4` and Lesson 21's second question's id, as Lesson 10's page filters
  Lesson 6's (`src/features/lessons/lesson-10/quiz-questions.ts:32-34`), so one question reports
  under one id on every page. Shown to everyone, since both lessons are prerequisites, and wired as
  Lesson 10's `initRecall` is (`src/features/lessons/lesson-10/recall.ts:21-29`): prefix `recall-`,
  keys `fyp-l25-recall-seed` and `fyp-l25-recall-v1`, no `lesson`, so it marks nothing done. Its step
  links read "Try Lesson 10, Step 5 again" and "Try Lesson 21, Step 4 again" and open
  `/learn/10#step-5` and `/learn/21#step-4` in a new tab, through `away: { href: recallStepHref }`
  (`src/features/lessons/kit/quiz.ts:142`, `src/features/lessons/kit/quiz.ts:191`). Neither question
  has a play.
- **Quick check**: LESSON.md's four questions, ids `l25-q1` to `l25-q4`, keys `fyp-l25-seed` and
  `fyp-l25-quiz-v1`, and `lesson: 25`, so answering all four marks Lesson 25 done. Three answers
  each, shuffled per question from the stored seed, one-line feedback for every answer, and a check
  icon and ink, not gold, on the right one. The kit prints "Right." or "Not quite." before each line
  (`src/features/lessons/kit/quiz.ts:315`). Question 1's "Try Step 3 again", question 2's "Try Step
  1 again", question 3's "Try Step 4 again" and question 4's "Try Step 3 again" go to that step on
  this page. Question 4's slot holds its play, "Play", which plays A melodic minor going up in the
  learner's octave, 3.15 s, the same on every visit (FACTS 65, 69), handled by one listener on the
  quiz's host in Lesson 10's form, the page's one sound
  (`src/features/lessons/lesson-10/quiz-play.ts:1-13`); it never shares a name with Step 3's plays.

### 8. Tease stills

- **This page's card** holds Lesson 26's still in its slot, the page's `[data-next-card]` mark,
  which the kit keeps in the card after its words (`src/features/lessons/kit/next-card.ts:34-37`):
  Lesson 26's opening as Lesson 26's package draws it, an SVG, `aria-hidden`, that holds no button,
  does not move and plays no sound (FACTS 5).
- **This page's opening as a still**, for Lesson 24's card: an SVG of the hero's stage at rest,
  Lesson 10's minor staircase on A, do to do, its stairs named, the house on do, te at rest, between
  Merc and Tavi; no chord column, no G♯ and no lit stair, so it answers nothing (FACTS 1a, 5b). It
  plays nothing, since a played still would sound the second ending. Its styles go under a class of
  its own, not the tease line's `.next-tease`.

## Audio

Every sound is synthesised in the page with Web Audio, through the kit's sound module, its master
bus and its house envelopes, and started only by a tap: the toy's notes, scales and chords in the
soft tone; Merc's singing in Merc's "ooh", and Tavi's the same an octave up; the guide's count-in in
the soft tone at half a tapped note's level (FACTS 58 to 65). Nothing autoplays, and the page has no
music bed.

- **The sound rules**, for every source of sound on the page (the hero's plays, the four words,
  every play and switch of the steps' toy, the quick check's play, Sing it):
  1. One sound plays at a time, across the whole page: a new play stops the one before, whichever
     toy started it.
  2. Leaving a step, by any route (Next, Back, a swipe, the lesson menu, `#step-N`, a quiz link),
     stops its sound and any queued play; scrolling Sing it off screen for 600 ms, or hiding the
     page, stops what plays there.
  3. A play that is cut short never counts as heard by the predict or by Sing it's gate.

  The kit has the helpers: a page-wide "now playing" owner (`NowPlaying`,
  `src/features/lessons/kit/now-playing.ts:39`), which every source here registers with, and a
  predict `play` that can report "not heard" (`src/features/lessons/kit/predict.ts:31-41`).

- **The tune with its chords.** The answering plays sound Merc's "ooh" at 0.2 over three soft voices
  at 0.05 each, Lesson 12's levels for chords under "ooh" (`UNDER_GAIN`,
  `src/features/lessons/lesson-12/sounds.ts:45-46`), started together on one clock (`allOf`,
  `src/features/lessons/kit/run.ts:170`), so a chord change falls on its melody note. A chord heard
  alone, Step 1's chord on so and home and the free play's, is three voices at 0.075 each
  (`CHORD_GAIN`, `src/features/lessons/lesson-12/sounds.ts:43-44`). Each chord's three voices start
  in one timer task (`playNotes`, `src/features/lessons/kit/run.ts:117`), so they share one clock
  and never flam.
- **Scales and pairs**: a scale is the soft tone at 0.13, a note every 0.4 s, each sounding 0.35 s;
  an interval is Lesson 6's pair, 0.6 s, 0.15 s of quiet and 0.8 s, two notes and no glide
  (`PAIR`, `src/features/lessons/lesson-06/examples.ts:34`).
- **Merc's and Tavi's line** in Sing it is one voice along a contour, held and glided on the audio
  clock (`src/features/lessons/kit/sound.ts:16-21`), so so, te and do join with no click.
- **Low notes.** The page's lowest note is the lower voice's A2, 110.00 Hz, in the steps and the
  answering plays' first chord, faint on a phone's speaker; the soft tone's upper partials carry it
  (FACTS 58). The owner's ear on a real phone decides whether it needs more level (Contract).

## Merc and Tavi

Lesson 1's setup through the kit (`src/features/lessons/kit/merc-duo.ts`): the app's renderer
loaded after first paint, one WebGL context per Merc, medium quality on phones, turned towards each
other, paused off screen, and the still images when WebGL fails.

- They live in the hero, on either side of the staircase. Tavi guesses and Merc answers in the
  bubbles (LESSON.md; FACTS 32). While any of the cold open's plays sounds, both listen
  (`mercListen`, `src/features/lessons/kit/merc-duo.ts:207`). Tavi celebrates once as the reveal
  shows, the guesser who then gets it (`mercCelebrate('orange', 1600)`,
  `src/features/lessons/kit/merc-duo.ts:217`), a quiet one, since the reveal calls no choice right:
  the page mounts the pair with no sparkles (`MercDuoOptions`,
  `src/features/lessons/kit/merc-duo.ts:119`).
- Tavi's other lines, in Steps 3 and 4, are written in the step text with her name, as on Lesson
  23's page; no Merc is drawn there.
- In Sing it Merc and Tavi appear as stills, the Merc who sings beside the learner's staff.
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Ear Lab's Gravity.** The link is `/ear-lab?lesson=25`, printed "mercurypitch.com/ear-lab",
  with "then tap Gravity" (FACTS 50). Gravity plays I, IV, V and I in a major key, then one note of
  the twelve inside the octave above do, and the learner taps which: the scale's seven by number and
  the other five by their leaning, the app's phrase, which the card puts as "a number with ♭ or ♯",
  each pad with its syllable. Each round picks a new key, its do from C3 to B3; answers are by tap by
  default (FACTS 48). The card names Te, "♭7", and Ti, "7", and says that a drill on those two alone
  is not in the app yet (FACTS 49). Ear Lab is free.
- **Today, second: Sight-Singing in A harmonic minor**, the card's one sung drill. The link is
  `/?lesson=25#/singing`, printed "mercurypitch.com/#/singing": the learner sets the key to A and the
  scale to Harmonic Minor, on a phone from the chip that shows the key, on a wider screen in
  Playback Setup in the sidebar, then goes straight to Exercises and taps Sight-Singing. It writes
  six notes of A harmonic minor in the saved range, G♯ with its sharp, in the treble clef only, with
  nothing played first; it wants each note in the octave written and prints each one's name under it
  (FACTS 52, 53). The card says all of that, the octave and the names in Lesson 16's words, with
  Lesson 16's care lines. Its notes can fall on the preset's floor or top, and in A harmonic minor it
  can ask for F to G♯, so the coach's list names both (FACTS 53). The Singing tab's picker plays
  nothing itself and its Melodic Minor is the going-up form both ways, so neither is named as
  practice (FACTS 52). No screen either link opens shows the app's scale descriptions (FACTS 54).
- **The rest version.** After "Effortful", "Uncomfortable" or "Just listen today" the card keeps
  Gravity and shows Lesson 12's rest line naming Sight-Singing in place of the second drill (Toys 5;
  FACTS 47).
- **The first visit.** `?lesson=25` is not a lesson marker today, so a first visit would meet First
  Light, the app's intro, before Ear Lab or the Singing tab. The page is not built before SEASON-2 §
  5.2 item 21 widens the marker, so the card and the footer carry no first-visit line (FACTS 50).
- **Needed: the `ear-drill` launch kind** (SEASON-2 § 5.2 item 12), which would open Gravity on Te
  and Ti alone. When it ships, the card's last sentence goes and the link opens the subset (FACTS
  49).
- **Needed: Scale Runner's harmonic and melodic minor** (SEASON-2 § 5.2 item 13). When they ship, a
  Scale Runner card can replace Sight-Singing as the second drill, with its own care lines and the
  coach's look (FACTS 51).
- **Needed: Sight-Singing for the lessons** (SEASON-2 § 5.2 item 10), whose parts each remove a
  sentence of the second drill, as Lesson 16's card shrinks: (g) a `key` launch field lets the link
  open Sight-Singing in A harmonic minor directly, in Lesson 16's way, and replaces the route through
  the Singing tab and its edge cases; (b) a "hear do" start replaces "It plays nothing first"; (c)
  the bass clef for lower voices and (f) octave-folded scoring replace the clef and octave sentence;
  (e) letter names off replaces the sentence on the names (FACTS 53).
- **Not linked**: the app's sheet view, whose minor signatures agree with Step 4 but which has no
  address (SEASON-2 § 5.2 item 20); the walkthrough's "Common Musical Scales" chapter (FACTS 55, 56);
  none of the premium exercises.

## Explorer and season data

Lesson 25's entry, proposed for Season 2's data, which goes in its own module that a Season 1 page
does not load (SEASON-2 § 6.2 item 1), in Season 1's entry form, as Lesson 10's is
(`src/features/lessons/kit/season.ts:346-362`):

- `n: 25`, `lane: 'theory'`, `title: 'Minor, properly'`, `short: 'Minor, properly'`, `topics:
['T15b']`, with T15b's name, "Harmonic and melodic minor; relative keys", as SEASON-2 § 4.1 gives
  it; the hook word for word (FACTS 1). `minutes: 15` and `page: '/learn/25'` once the page is
  built, under the drafts' comment in Lesson 10's form (`src/features/lessons/kit/season.ts:351`),
  naming Lessons 10's, 21's and 23's pages and the vocal coach's look. The entry decides nothing
  about being live: the draft list and the console do.
- `pr.link`: `href` `/ear-lab?lesson=25`, `addr` `mercurypitch.com/ear-lab`, `label` "Ear Lab" and
  `note` "then tap Gravity", which the explorer's card prints after the address as "Ear Lab, then tap
  Gravity" (`practiseMarkup`, `src/features/lessons/kit/explorer.ts:191-195`). `pr.needs`, "Gravity
  with only Te and Ti (the ear-drill launch kind); Scale Runner's harmonic and melodic minor;
  Sight-Singing with a key launch, a hear-do start, the bass clef, letter names off and
  octave-folded scoring", stays until they ship; it is admin only, never drawn on a lesson page
  (`src/features/lessons/kit/season.ts:102-103`).
- `EDGES` gains [10, 25], [21, 25] and [23, 25], the first a cross-season edge, as SEASON-2 § 4.3
  gives them (FACTS 2). Lesson 25's prerequisite list is then [10, 21, 23] (`PREREQ`,
  `src/features/lessons/kit/season.ts:474-480` at `ad0a099f7`).
- The tease on Lesson 24's card is this lesson's, set on Lesson 25 in the lesson copy (`LESSON_COPY`,
  `src/features/lessons/kit/lesson-copy.ts:79`): `tease` "A minor tune, played twice. The second
  ending changes one note.", with Lesson 24's planned line as a variant, `teaseAlts` `[{ id: 'plan',
text: 'Do, mi and so made a major chord. Minor keys hide another change.' }]` (FACTS 5b). The tease
  on this page's card is Lesson 26's, set on Lesson 26: `tease` "‘Twinkle’, and the same tune four
  semitones higher, played together.", with a mended form of this lesson's planned line as a variant,
  `teaseAlts` `[{ id: 'plan', text: "Lesson 24's other part was a drone. What if it's a tune?" }]`;
  the planned line itself is withdrawn (FACTS 5). Each variant's note goes in the team's notes, which
  a variant needs (`TEASE_NOTES`, `src/features/lessons/kit/team-notes.ts:85`). The lead bound both
  pairs on 2 November 2026.
- The signature line for the admin console, from the card (FACTS 29): "Lesson 10's minor staircase:
  te slides up to ti, le to ti opens into a wider stair, then le rises too, going up only." Every
  season entry has one, in the team's notes (`SIGNATURES`, `src/features/lessons/kit/team-notes.ts:31`),
  which no lesson page loads.
- The explorer opens on Season 2's tab. Its card reads "Ready · read" with "15 min" once the page is
  live.

## What the kit and the app still need

Found in the kit and the app as they stand on main at `c60f0fdcb`. Every item is proposed. Items 3,
5 and 9 are Season 2's kit PR (SEASON-2 § 8.2 item 1) or an earlier Season 2 page's, which come
first; they are listed so this page's needs are in one place.

1. **The lesson host**: `learn/25.html` at `/learn/25`, which every build takes as a lesson page, a
   draft's included (`lessonPages`, `tools/draft-lessons.ts:82-90`); `/learn/25` and
   `/learn/25.html` in `STANDALONE_DOCUMENT_PATHS` (`src/lib/sw-runtime.ts:93`); the first-paint
   budgets. The lesson pages' route already takes any two digits (`LESSON_PAGE`,
   `src/lesson-gate.ts:135`).
2. **The draft line**, in the draft list's form, as Lesson 10's names its prerequisite's page
   (`src/features/lessons/kit/drafts.ts:39`): `25: "Lessons 10, 21 and 23's pages at /learn/10,
/learn/21 and /learn/23, and the vocal coach's look at the sung checkpoint and the sung drill"`.
   Releasing it is deleting that line, then listing the page in the sitemap and llms.txt (SEARCH.md §
   12 item 3).
3. **Seasons in the kit** (SEASON-2 § 6.2 item 1): Season 2's data in its own module, Lesson 25's
   entry and its three edges, the masthead's season from the data (today a constant,
   `src/features/lessons/kit/lesson-menu.ts:111`), and the explorer's tab per season.
4. **Lesson 10's chord beads and staircase in the kit**: `lesson-10/chord-beads.ts`, its drawing and
   its layout move into the kit, and Lesson 10's page then imports them from there. Today they take
   only the seven white-key roots from C4 to B4 and a window of C4 to F♯5, and refuse any other root
   (`ROOTS`, `WINDOW` and `rootLetter`, `src/features/lessons/lesson-10/chords.ts:68-82`). They gain:
   roots and a window set per page, this page's white-key roots from A2 to B4, which take in every
   root it uses (A2, C3, E3, A3, C4 and E4), and a window from A2 to C5, every note it sounds, with
   Lesson 10's C4 to B4 and C4 to F♯5 kept for its own page; the scale state and the chord state
   side by side, a staircase with a chord column beside it, where Lesson 10 shows one or the other;
   a chord column on a degree other than the root, the chord on so; Raise te and Raise le, each a
   stair lifting a semitone, Raise le on the way up only, each able to wait for a predict's choice;
   the widened stair's outline and its "3"; a redraw from one scale to another on the same notes, C
   major to A minor, with the house gliding and the syllables changing; pure helpers with their unit
   tests (a scale's stairs from its steps and its root; which stairs a switch lifts going up and
   coming down; a chord's gaps and quality from its three notes; every white-key root from A2 to B4
   taken and a black-key root refused; every note of the page inside its window); and a layout test
   that the two states sit side by side without overlap at 344 to 390 px.
5. **Key signatures in the staff toy, in both clefs** (SEASON-2 § 6.2 item 2, as Lesson 21's page
   needs them), with three flats placed as FACTS 27 gives; written signs that move into the
   signature (0.6 s); a second, small staff in the other clef that shows the signature only; and a
   bar per figure, so the page never needs a natural sign.
6. **Lesson 12's chord levels in the kit**: `NOTE_GAIN`, `CHORD_GAIN`, `UNDER_GAIN` and `MERC_GAIN`
   (`src/features/lessons/lesson-12/sounds.ts:41-48`) move into the kit's sound module, with the way
   Lesson 12's page plays chords under "ooh" on one clock, and Lesson 12's page imports them.
7. **Lesson 6's pair in the kit**, as Lesson 23's page needs it too: `PAIR` and `pair`
   (`src/features/lessons/lesson-06/examples.ts:34`, `src/features/lessons/lesson-06/examples.ts:80-90`).
8. **The hero's stage**: `lesson-25/cold-open.ts`, new (Toys 2), on Toy 1's staircase and chord
   column.
9. **The sing flow in the kit** (Lesson 23 WEB-SPEC, What the kit and the app still need, item 6):
   Lesson 12's flow with Move do and the guide's drawing as options. This page passes no Move do,
   the staff toy's sing state with two bars, and a count-in on the line's first note, so, which
   `countIn` already takes as its note (FACTS 46a).
10. **No decorative staff** (Look; Lesson 15 WEB-SPEC, What the kit and the app still need, item
    7): no `.mv-staff` in the section heads, no `engraveClefs`, and no background staff on a Season 2
    page.
11. **Lesson 21's questions as objects**: Lesson 21's page, not yet built, registers its quick-check
    questions in its own module, as Lesson 10's do (`src/features/lessons/lesson-10/quiz-questions.ts:104-123`),
    so this page imports its question 2; until then this page waits (FACTS 7).
12. **The lesson copy and the team's notes**: Lesson 25's tease set on Lesson 25 and Lesson 26's on
    Lesson 26 (`src/features/lessons/kit/lesson-copy.ts:12`), each with its variant and each within
    `TEASE_MAX` (`src/features/lessons/kit/lesson-copy.ts:76`; FACTS 5, 5b), both variants' notes in
    `TEASE_NOTES`, and Lesson 25's signature (Explorer and season data). The admin console switches
    between them; nothing on this page changes.
13. **Season 2 in the app's lesson plumbing** (SEASON-2 § 5.2 item 21), the app's work, not the
    page's, and this page waits for it: the lesson marker's range (`src/lib/lesson-marker.ts:19`), so
    `?lesson=25` steps First Light aside (FACTS 50); the lesson-answer bounds
    (`workers/db-worker/src/mirror-metrics.ts:61-62`), which refuse Lesson 25's answers whole today
    (FACTS 57); the admin console's one row per Season 1 lesson
    (`src/features/admin/lessons/lesson-admin.ts:88`); `RELEASED_LESSONS`
    (`src/lib/current-lesson.ts:34-37`).
14. **The head, the structured data and llms.txt** (Sections, 2; SEARCH § 3.1, § 3.2 and § 12):
    the title, the descriptions, the share card `learn/lesson-25-og.jpg` and its alt, the two
    structured-data blocks with `alternativeHeadline`, `description`, `teaches` and `timeRequired`
    `PT15M`, and on release the llms.txt line, each checked against the predict (FACTS 1a).
15. **The practise links that wait** (Practice links), the app's work: the `ear-drill` launch kind
    (SEASON-2 § 5.2 item 12); Scale Runner's harmonic and melodic minor (item 13); and Sight-Singing
    for the lessons (item 10): (g) a `key` launch field, which lets the card's link open
    Sight-Singing in A harmonic minor directly, in Lesson 16's way, in place of the route through
    the Singing tab; (b) a "hear do" start; (c) the bass clef for lower voices; (e) letter names off;
    and (f) octave-folded scoring, each of which removes a sentence of the card. When any ships,
    LESSON.md's card changes as its editorial note says.
16. **The app's scale descriptions**, the app content track's, as the season's risk 16 asks: "Bright
    and happy" (`src/lib/scale-data.ts:83`); "Sad and introspective" (`src/lib/scale-data.ts:88`);
    "exotic tension" (`src/lib/scale-data.ts:93`); "Jazz minor" (`src/lib/scale-data.ts:98`). They
    are shown on no screen today, so neither of this page's links meets them (FACTS 54). Proposed,
    before any screen displays them: plain lines with no mood, such as "Do re mi fa so la ti do",
    "Do re me fa so le te do", "Natural minor with te raised to ti" and "Le and te raised going up".
    If a screen this page links ever shows "Sad and introspective", the card stops sending learners
    there until the line changes.
17. **A going-down melodic minor in the app**, proposed, the app's: the app's Melodic Minor is one
    set, its going-up degrees (`src/lib/scale-data.ts:95-99`), so a run down the Singing tab or
    Sight-Singing in Melodic Minor uses F♯ and G♯ where the textbook falls back to G and F (FACTS
    52). Until it has both forms, no card names it.

## Decisions for the owner

None open. On 2 November 2026 the lead bound both teases with their alternatives (FACTS 5, 5b), kept
Sight-Singing in A harmonic minor as the second drill (FACTS 52, 53), and chose the head title,
"Harmonic and melodic minor, relative keys | MercuryPitch" (56 characters; Sections, 2), which names
no chord's quality (FACTS 1a). The sing-along's figures and their range, and Sight-Singing's card,
are the vocal coach's to confirm before publishing (LESSON.md, For the vocal coach), not the
owner's.

## Edge cases

- **Sound off, unset or missing.** Every play obeys the kit's `canPlay`. The predict's reveal and
  Start the guide wait for heard sound (Toys 3, 5). With no Web Audio the page stays readable, every
  play runs its visuals in silence with its hint, and Sing it offers the listen-only path.
- **A hidden page or a section off screen** stops what is playing (Audio).
- **Before a choice**, Play ending 1, with chords and Play ending 2, with chords are disabled and the
  reveal hidden; Play the tune, twice still sounds and lights its stairs, lifts te to ti for its
  second ending's G♯, and draws no chord.
- **One ending heard, not the other**: the hint stays `chosen`, "Locked in. Play both endings.", and
  the reveal waits; the same after the tune play following the choice.
- **Sound off before a choice**: Play the tune, twice runs its lights silently and `silent` replaces
  the lock hint; once it is heard with sound on, still before a choice, the lock hint comes back.
- **An ending cut short** (another sound, a step link, leaving the hero): not heard, no reveal, the
  hint as it was; the column keeps what it last drew.
- **The steps' toy before a choice**: Step 1's Raise te is disabled with its name kept and the chord
  column is not drawn, under the steps' lock line; its paragraph on the chord on so, with Play the
  chord on so, then home, is hidden and the held line shows; Play so, te, do and Play so, ti, do
  work, the second lifting te for as long as it sounds. Steps 2 to 4 hold nothing back: their plays
  sound scales and pairs, no chord. A return visit starts with a new predict, so Step 1 holds them
  back again until its choice.
- **The free play before a choice**, reached by scrolling: Raise te, Raise le and its chord play
  are disabled and its column is not drawn, under the same lock line; its scale and figure plays
  work. A return visit holds it again.
- **The choice made**: Step 1 and the free play draw their columns in (0.4 s), enable Raise te (and,
  in free play, Raise le and the chord's play) and drop the lock line. Step 1's paragraph still
  waits for the reveal, and its held line still asks for both endings.
- **The reveal**: Step 1's paragraph and its play show in place of the held line, and a screen
  reader hears it after the reveal's own text.
- **Raise le with Raise te off**, in free play: Raise le implies the raised seventh, so switching it
  on switches Raise te on too, and switching Raise te off switches Raise le off; melodic minor never
  shows a raised sixth under a natural seventh.
- **The Clef switch mid-play** stops the play; the figure plays in the new octave on the next play.
- **Step 4 mid-redraw**: a new play or leaving the step lands the staircase and the house where the
  redraw was going, and C minor's flats in the signature.
- **Reduced motion**: stairs, beads, the house and the flats land in place; the reveal still waits
  for the sound.
- **A first visit that never chooses**: the welcome tour waits for the choice, and the next lesson
  page opened at the top offers it again (Toys 3); Step 1 and the free play keep the chord back,
  and Step 1's paragraph stays held.
- **No voice chosen**: the steps' staff is the bass clef from A2 with its Clef switch; nothing in Sing
  it plays until a voice is chosen, and its staff waits with no notes. A stored voice opens on its
  own staff, in the steps and in Sing it.
- **Effortful or Uncomfortable**: the guide goes for the visit; Play Merc's notes stays, as
  listening; the practice card keeps Gravity and shows its rest line for Sight-Singing, as after
  "Just listen today".
- **No WebGL**: the Mercs' stills; everything else runs.
- **No storage** (a private window): the quiz seeds and the voice last for the visit; nothing breaks.
- **Lesson 10, 21 or 23 not live** where the page is served: its chip stays a plain chip and the
  recall's step link to it keeps its words with no link (FACTS 2, 7).
- **The practice links** open Ear Lab and the Singing tab with the lesson marker, which by then steps
  First Light aside (FACTS 50). A learner who switched Playback Setup off in Settings sees no
  Playback Setup in the sidebar on a wider screen; the phone stage's chip still sets the key and
  scale, and on a wider screen the Settings toggle "Playback Setup" brings the section back. A
  learner who reloads the app loses the key and scale, which last only for the visit (FACTS 52).
  A learner who loads a song between setting the key and opening Sight-Singing gets that song's key
  and scale on the grid Sight-Singing writes from (`_alignScaleToMelody`,
  `src/stores/melody-store.ts:950-961`). The library window sets the key menu with it
  (`src/components/LibraryModal.tsx:259-267`), but the sidebar's library list does not
  (`src/components/LibraryTab.tsx:220`), and then Sight-Singing still prints "Key: A harmonic-minor"
  over notes from another key (`src/features/exercises/sight-singing/SightSingingExercise.tsx:276-278`).
  The card says to go straight to Exercises, and app-check confirms the route on both layouts before
  publishing.

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-25/`, and on the
kit parts it adds:

1. **Scales**: A natural, harmonic and melodic minor (up and down), A major, C major and C natural
   minor, spelled one letter per degree, give FACTS 11 to 13, 21, 22 and 27's notes and steps:
   harmonic minor's steps 2, 1, 2, 2, 1, 3, 1 with its 3 between degrees 6 and 7; melodic minor's
   going up 2, 1, 2, 2, 2, 2, 1 and coming down as natural minor; C minor's flats B♭, E♭, A♭; no
   A♭ in A minor and no G♯ in C minor.
2. **The chord on so**: E, G, B gives gaps 3 and 4, "E minor"; E, G♯, B gives 4 and 3, "E major";
   Raise te slides G to G♯ and back (FACTS 17).
3. **The predict's lock**: at first paint, with no choice, Step 1's Raise te is disabled and its
   column is not in the DOM, under the steps' lock line; Step 1's paragraph on the chord on so and
   its play are hidden and the held line shows; the Wrap's free play has Raise te, Raise le and its
   chord play disabled, no column in the DOM and the same lock line; the hero has no column; the
   tune play sounds no chord. After a choice Step 1's and the free play's controls are enabled and
   their columns drawn, while Step 1's paragraph stays hidden; after the reveal it shows and the
   held line goes. A new visit holds all of them again. The reveal waits for both endings heard with
   sound on, in either order; a play cut short reveals nothing and leaves the hint; the hints and the
   guess lines are LESSON.md's (FACTS 1a, 36, 37).
4. **The sing-along**: E3, G3, G♯3, A3 and E4, G4, G♯4, A4 against `VOCAL_RANGES`: every note at
   least 2 semitones inside every preset of its voice, the least room 4; Lesson 10's Move do of four
   lower and either octave fail that check, so no Move do and no octave are offered (FACTS 42, 43).
5. **Sounds**: every fixed sound's frequency equals `hz(m)` for the notes of FACTS 58; the tune play
   lasts 17.0 s, each ending 4.0 s, Step 1's plays 2.4 s, a scale 3.15 s and up and down 5.95 s,
   two scales 6.8 s, two pairs 3.6 s with 0.15 s of quiet inside each and no glide, Merc's line 9.4
   s, the count-in 1.0 s and quick check 4's play 3.15 s (FACTS 58 to 65); chords play at 0.075 a
   voice alone and 0.05 under "ooh".
6. **The staff**: each figure is its own bar, so no figure needs a natural sign; C minor's flats land
   in each clef's signature at FACTS 27's places, in the order B♭, E♭, A♭; the small staff shows the
   signature and no notes.
7. **The recall**: the questions are Lesson 10's and Lesson 21's own objects, imported, not copied;
   their links open `/learn/10#step-5` and `/learn/21#step-4`; no text in either names a chord on so
   or says what a raised third does (FACTS 1a, 7).
8. **The quick check**: ids `l25-q1` to `l25-q4`, three answers each, one right, LESSON.md's words;
   no feedback line starts with "Right", "Yes" or "Correct" (FACTS 66 to 69).
9. **Sing it's flow**, in Lesson 12's tests' form: the voice before anything plays; the guide after
   Merc's notes heard; the count-in on so; no Move do; Effortful and Uncomfortable put the guide
   away; Effortful, Uncomfortable and Just listen today show the practice card's rest version, which
   keeps Gravity and replaces Sight-Singing with its rest line (FACTS 46, 47).

Page tests, against a local or dev build, never production:

10. The head test (`src/tests/lesson-pages.test.ts`): the title within 60 characters, the
    description 80 to 160 with "A fifteen-minute lesson", the Article's description with it too,
    the chip "15 minutes" and `timeRequired` `PT15M` (`src/tests/lesson-pages.test.ts:154-159`,
    `src/tests/lesson-pages.test.ts:198-209`).
11. No planning text on the page: no topic code such as "T15b", no "planned", "deep link" or "for the
    team" (`src/e2e/learn-no-planning-text.spec.ts:22-41`).
12. The stage-fit test at the four short landscape sizes, every step's controls on screen with the
    stage stuck (`src/e2e/learn-stage-fit.spec.ts:33-54`).
13. The first-paint budgets for `learn/25.html`.
14. The claims validator over LESSON.md and WEB-SPEC.md (`validateGuidedDynamicClaim`), 0 flagged
    lines, as Lessons 12 and 14 ran it (FACTS, Claims check).
15. **One sound at a time across sources**: an ending stops a word's play, a word's play stops a
    step's scale, and Merc's notes stop any of them (Audio).
16. **No background staff**: on `learn/25.html` the body's computed `background-image` holds no
    repeating gradient and the page has no `.mv-staff` (Look).
17. **The tour's hold**: on a first visit at the top, the welcome tour does not open before the
    predict's choice and opens after it; "Tour this page" opens it at once (Toys 3).
18. **Nothing answers the predict before the choice**: at first paint, with no choice made, no
    visible text above the quick check, the predict's own two choices aside, puts "major" beside
    "E, G and B", "E, G♯ and B", "the chord on so" or "the chord before home"; no chord column is in
    the DOM in the hero, in Step 1 or in the Wrap's free play; Step 1's paragraph on the chord on so
    is hidden; the free play's Raise te, Raise le and chord play are disabled; and no play on the
    page sounds two notes together. After the choice the columns draw and the chord plays; after the
    reveal Step 1's paragraph shows (FACTS 1a).

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practice links that carry `?lesson=25` before any hash. Then the layout, accessibility, sound,
motion and storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text
children, touch targets of at least 44 px with no two tap zones overlapping (the staircase's stairs
and the beads are drawn, never tapped; Raise te and Raise le are switches), visible focus, a single
dark theme with every colour a token and an explicit body background, sound only after a tap,
localStorage only for per-viewer conveniences inside try/catch, and the whole page usable with no
sound, no WebGL and no storage (the predict and the guide then say why they wait). Every ♯ and ♭ the
page prints in text (the predict's G♯, the steps' G♯, F♯, C♯, B♭, E♭ and A♭, every sign on the
staff and in the signature, Sing it's G♯) has a spoken name, the sign `aria-hidden` and a visually
hidden word after it (`signsHtml`, `src/features/lessons/kit/notes.ts:221`); the figures' accessible
names and every live region use words only, and every note is spoken with its letter and octave.
"Piano key" means a key of the keyboard everywhere on the page, and "key" alone a musical key
(FACTS 10). The page stores the quiz seeds and records (`fyp-l25-recall-seed`, `fyp-l25-recall-v1`,
`fyp-l25-seed`, `fyp-l25-quiz-v1`), `fyp-done` (`src/features/lessons/kit/progress.ts:12-15`),
`fyp-voice` (`src/features/lessons/kit/voice-choice.ts:20`), the masthead's Pause animations choice,
`fyp-motion` (`src/features/lessons/kit/motion-switch.ts:12`), the steps the viewer reached,
`fyp-pos` (`src/features/lessons/kit/position.ts:20`), and its record of the welcome tour,
`fyp-tour` (`src/features/lessons/kit/tour-gate.ts:29`); nothing from the toys or Sing it but the
voice. The predict's choice, the Clef switch, the pitch-line switch, Raise te and Raise le hold for
the visit, in memory.

The departures from ARTICLE-PLAN.md, each argued in FACTS and listed in LESSON.md's preamble: the
predict asking what raising G to G♯ does to the chord before home, the lead's, in place of which
note was raised, with Tavi's and Merc's lines to match (FACTS 1a, 32, 33); the tune as a melody
alone before the choice, its chords only in the answering plays (31, 34); one predict, the plan's
Step 2 predict a Try and Notice (38); the steps' toy, the Wrap's free play and the tour holding back
the chord on so until the choice, and Step 1's sentences on it until the reveal (1a, 36); the cold
open in A3 to A4 for everyone, where the plan had A4 to A5 for the higher voice (8); three
prerequisite chips (2); C minor's flats once in each clef with no E♭ major (27); Step 4's sentence
on where Lesson 21's reading rule stops, in place of the plan's F♯ minor note (7, 26); no Move do
(43); Go deeper's "For instrumentalists" left out (28); the practice card saying what Gravity does
and that its Te-against-Ti drill waits (48, 49), with Sight-Singing in A harmonic minor as its
second drill in place of the Singing tab (52, 53); four quick-check lines (66 to 69); Tavi's lines
without "So" (10); and Lesson 26's tease, the lead's, with the plan's line mended as the alternative
(5).

Page QA before publishing adds, for this page, every check against a local or dev build, never
production:

- Every play, switch and button works by keyboard alone and announces what LESSON.md shows; a
  screen reader hears every note with its letter and octave, every ♯ and ♭ spoken, each chord as
  its three letters, its gaps and its name, and each key signature in words.
- At 390 x 844 every target is at least 44 px square and nothing scrolls sideways at 344, 360 and
  375 px; the staircase, its chord column and the staff fit `.viz.tall` without overlap, in both
  clefs, and Step 4's two staves stack under one another.
- On a real phone, by ear and by eye (`docs/agent/DEVICE-DEBUGGING.md`): A2 audible on the
  speaker; a chord heard as one, with no flam; the tune's "ooh" clear over its chords; Merc's line
  joined, with no click; the stairs and beads sliding in time with their sounds.
