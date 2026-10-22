# Lesson 10 web page: spec

The Lesson 10 page is the web lesson for "Major and minor": written steps, one main toy in five step
states with a compact layout and free play, a cold open on the hero's spiral, two predicts, an ear
game in two modes, an unscored sing-along, two quizzes (the recall and the quick check) and the
lesson explorer. Copy is in [LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is a
text-only package: no film exists for Lesson 10, so the page has no Watch section and the masthead's
anchors are Lesson, Sing and Explorer. It is built on the kit (`src/features/lessons/kit/`) as it
stands on main at `85e23a1af`, and like Lessons 2 to 7 it reuses and never copies: a part that still
lives in an earlier lesson's module moves into the kit first. Four parts this page needs are ones
Lesson 6's spec adds to the kit: the ear game for any number of answers, the guide's breath mark,
Move do and the names switch's modes. Lesson 6's page is not on main yet. It is PR #1149, read for
this spec on `feat/lesson-06-page` at `f6333d527`, and it moves the first two into the kit, so they
are marked here "from Lesson 6's page". It keeps Move do and its names modes on its own page, so
this page moves those two into the kit itself and takes Lesson 6's copies with it, and Move do's
buttons, Lesson 4's and Lesson 6's alike, switch from `disabled` to `aria-disabled` at their limits
(What the kit and the app still need, items 5 to 8). If this page is built first, it adds all four,
and Lesson 6's page reuses them. Where this page shares a behaviour with Lesson 3's checkpoint (the
comfort check, the voice choice, "How did that feel?" and the rest card), it is Lesson 3's,
unchanged unless this spec says otherwise, and after "Effortful" it follows Lesson 6: no further
guide, and the rest card in the Wrap.

One object carries the lesson across its steps: the chord beads (Toys 1). In Step 1 it is two beads
on semitone rows, a third; in Step 2 one more bead stacks on top and it is a triad; in Step 3 its
middle bead slides down one row and the chord turns minor; in Step 4 it plays its notes as a
pattern, slow and fast; in Step 5 it spreads into a staircase, the scale the chord belongs to. The
CURRICULUM's signature is its Step 3 move: "one bead (the third) sliding down one semitone and the
whole chord's colour changing" (FACTS 4). The hero's cold open makes the same move on the spiral
Lessons 1 and 2 built, seen from above, where one turn is a ring of twelve (Toys 2). Motion
principle 2, "One object carries the story across shots and keeps its identity"
(`research/brand-motion.md` § 3.3), and playbook rule 6 ask for it.

Its public home is `mercurypitch.com/learn/10` (MASTER-PLAN § 12 item 9): a hand-written document
`learn/10.html` with its module in `src/features/lessons/lesson-10/`, wired as Lesson 4's page is
(`src/features/lessons/lesson-04/main.ts`), the nearest page on main: a written lesson with no film,
its cold open before its recall, a recall shown to everyone, a staircase with a names switch, a
slide guide with Move do, and free play in the Wrap. It is published only after Lesson 6's page,
`/learn/06`, is, because its recall check asks Lesson 6's questions and its prerequisite chip names
Lesson 6 (FACTS 2, 7), and after the vocal coach has looked at its voice lines (LESSON.md, For the
vocal coach). Until both are done it is a draft (`src/features/lessons/kit/drafts.ts:5-24`,
`:30-38`). Every build carries `learn/10.html`, as it carries every lesson page
(`tools/draft-lessons.ts:8-14`), and its line in `drafts.ts` holds it back on mercurypitch.com: the
site worker answers `/learn/10` with the 404 page, and every page's explorer shows Lesson 10 with no
link, as a lesson not written yet (`src/lesson-gate.ts:10-12`;
`src/features/lessons/kit/publish.ts:16-25`). The dev site and every PR preview serve it. Publishing
it from the admin console puts it live on mercurypitch.com with no release
(`src/features/lessons/kit/drafts.ts:13`); the console asks first while its `drafts.ts` line stands,
naming what it waits on, but checks nothing, so the owner keeps the order above (Decisions for the
owner). Releasing it is deleting its `drafts.ts` line (What the kit and the app still need, items 2
and 15). The curiosity plan's kit work is on main at `85e23a1af`: Lesson 10's hook, its alternative
and its tease are in the kit's lesson copy (`src/features/lessons/kit/lesson-copy.ts:115-123`),
Lesson 11's tease is there too (`:131`), and the next-lesson card draws a tease above the next hook
(`src/features/lessons/kit/next-card.ts:142-143`). So the page writes only its own title into its
markup, and nothing of Lesson 11's (FACTS 1, 5).

## Look

Lessons 1 to 7's look, unchanged: the dark listening room, the series colour code, Lesson 1's type
and wordmark, and the motion rules. On this page:

- Major and minor are drawn in the same colours. No hue is given to either quality, and minor is
  never drawn darker, duller or bluer than major, because listeners match minor music to darker,
  bluer colours through its "sad" association, the link the lesson questions (FACTS 40, 40a). The
  change between them is light and shape: the halo round the chord, the shape joining its notes, and
  the chord's name printed beside it.
- Gold `#ffd84d` marks only the fit: the chord's third, in both qualities. In the hero, mi's halo
  turns gold only as the cold open's reveal shows, glowing once; before that nothing on the hero is
  gold, so the figure cannot answer the predict (FACTS, Illustrations without claims). In the steps
  the third's bead is gold from Step 2 on, where the text names it, and its stair keeps the gold in
  Step 5; in Step 1 both beads are chrome.
- Chrome `#c3ccd6` is every other note; the bead that is sounding is ink `#e6edf3`, lit.
- The contrast case is dashed ink-2 `#a8b3bf` with a "?" (MASTER-PLAN § 5), because the sing-along
  guide uses the app's canvas set, in which violet is the singer: here C, E, G♭, the chord that is
  neither major nor minor, in the cold open after its reveal (FACTS 40, 41b).
- Blue `#58a6ff` and orange `#ff7448` are the Mercs' own: their bubbles, and in Sing it the still of
  the Merc who sings. The guide takes the app's canvas colours, target amber `#f59e0b` for Merc's
  path while Merc sings; on the viewer's turn it turns plain chrome, as Lessons 2, 4 and 6's guides
  do (Lesson 2 DECISIONS 68).
- Major and minor are words on the toy, "major", "minor" and the chord's name, and the gaps carry
  their semitones as numbers. No meaning rests on colour alone, and the page passes MASTER-PLAN §
  5's colour-blindness gate (`docs/plans/find-your-pitch/MASTER-PLAN.md:214-216`).

Three things move: the Merc idle loops; a bead while it slides, on the hero's spiral or on the chord
beads; and the chord beads as they stack or spread. Only the Mercs move on their own. Under
`prefers-reduced-motion` the Mercs stop, and every slide, stack and spread lands in its end state
with no travel; what the viewer starts still sounds, and the beads still light as they sound. For
everyone else the masthead's Pause animations toggle stops the same things (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Lessons 2 to 7's departures kept: the step toys double as
the Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it; the
practice card sits in the Wrap. No Watch section (§ 4.2 item 10). The page opens in Lesson 2's
order: the hook, the stage, the sound gate and the cold open's predict, then the recall
(CURIOSITY-MOMENTS § 3.1 and § 5 item 1; MASTER-PLAN § 4.2 items 3 and 4, as § 12 item 13 decided;
FACTS 5a). Each section's heading, and the line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Lesson 4's (wordmark, "Season 1 · Lesson 10", anchors Lesson, Sing and Explorer,
   the Sound toggle off by default, Pause animations with its reduced-motion lock), through
   `initMasthead` (`src/features/lessons/kit/page-chrome.ts:107-138`) with Lesson 4's map of
   sections and `{ lesson: 10, deck }` (`lesson-04/main.ts:99-110`), which draws the lesson menu,
   remembers the steps the viewer reaches and first settles the page's links to other lessons for
   the state it was served with (`followPageState`, `src/features/lessons/kit/page-chrome.ts:111`).
2. **Hero, with the cold open**, laid out as Lesson 2's (`learn/02.html:320-493`). Its copy holds
   the kicker, the hook question as the title (the `<h1 class="hook" id="hook">` every lesson page
   has, `learn/04.html:319`), the meta as three chips, the promise and the sound gate from
   LESSON.md. The chips are "17 minutes" (FACTS 3), "After Lesson 6: Intervals: the distance between
   notes", a link to `/learn/06` as Lesson 4's prerequisite chip links Lesson 2
   (`learn/04.html:326-330`; FACTS 2), which stays a plain chip wherever Lesson 6 is not live
   (`src/features/lessons/kit/page-state.ts:16-17`), and "Sound on". Its stage holds orange's and
   blue's bubbles (`learn/02.html:374`) over the two Mercs on the floor line, the hero's own copy of
   the spiral between them (`:395`; Toys 2), and under the spiral the cold open's three plays: "Play
   the chord", which works from the start, and "Move mi down" and "Move so down", locked until a
   choice. The predict card sits under the stage, as Lesson 2's does (`:439`): LESSON.md's predict,
   its two choices, the lock hint and the reveal (Toys 3). On a phone the hero's parts run kicker,
   title, meta, the stage, the gate, the predict, then the promise
   (`src/features/lessons/kit/lesson-stage.css:354-397`), so the title and the first Play come
   before anything asks for an answer (CURIOSITY-MOMENTS § 3.1, "Above the fold"; FACTS 5a).
3. **Recall from Lesson 6**, straight after the hero (`learn/02.html:496`): Lesson 6's questions 2
   and 3, shown to everyone, since Lesson 6 is a prerequisite (Toys 8; FACTS 7).
4. **Four words you'll meet**: third, triad, quality and natural minor, each with its definition, a
   small figure and a play button (Toys 4).
5. **The steps**: Lesson 1's sticky stage and step deck ("N of 5", Previous and Next), every step on
   the one chord-bead toy (`toyFor: () => 1`, as Lesson 4's deck, `lesson-04/main.ts:72-76`), in
   five states (Toys 1), with the ear game and Step 5's predict in the step text (Toys 3, 5):
   1. How big is a third? Two beads, C and E, with Play the third, Slow and Major · Minor; Major or
      minor? on thirds under the Notice.
   2. What if I stack another third on top? Stack a third, then Play the triad, and Slow.
   3. Why does moving mi make it minor? Play the triad, Slow, Major · Minor and Slide; Major or
      minor? on chords under the Notice; the Go deeper drawer.
   4. Is minor the sad one, then? The pattern, with Major · Minor and Slow · Fast; the mix-up card;
      the Go deeper drawer.
   5. Is there a minor scale too? The predict; then Chord · Scale spreads the chord into its
      staircase, with Major · Minor, Slow and the names switch; the Go deeper drawer.
6. **Sing it**: the comfort check, the voice choice, Merc's notes, the guide, Move do and the
   feeling question (Toys 6); nothing listens.
7. **Quick check**: LESSON.md's four questions (Toys 8).
8. **Wrap**: the three recap lines, the challenge, the practice card in the version Sing it's ending
   picks, the next lesson's card, and free play. The practice card is the app card Lessons 4 and 5
   use, with LESSON.md's eyebrow, title, text, address and second drill: Drone Intonation, linked
   `/pitch-training?lesson=10`, and Ear Lab's Stack, linked `/ear-lab?lesson=10` (Practice links).
   It has no first-visit line, since the marker steps First Light aside (FACTS 46, 46a). After
   "Effortful", "Uncomfortable" or "Just listen today" it is the rest card instead, with Drone
   Intonation named and Stack still offered, since Stack needs no voice (Toys 6; FACTS 67). Both
   links open in a new tab. The two versions sit in one `#practiseCard`, shown by the visit's
   ending, as Lesson 5's are (`src/features/lessons/lesson-05/wrap.ts:22-29`). The next lesson's
   card is the kit's, drawn from the season by `createNextCard(10)` before
   `createExplorer({ current: 10 })`, as Lesson 4's page draws its own (`lesson-04/main.ts:94-96`;
   `kit/next-card.ts:181-209`, from the season as the page's state shows it). Its eyebrow reads
   "Next lesson 11 · Registers and the break" with "Coming later"; then Lesson 11's tease, "Slide up
   slowly, and your voice may flip.", above Lesson 11's hook, and "See it on the map" while Lesson
   11 is not live; once it is, "Start lesson" to `/learn/11` (FACTS 5). Its slot, the page's
   `[data-next-card]` mark, holds the tease still (Toys 9). Free play follows the card: every
   chord-bead control on one card (Toys 1; playbook rule 17), keeping the card's place after the
   challenge and the practice card (CURIOSITY-MOMENTS § 3.1).
9. **Lesson explorer**: the kit's, `createExplorer({ current: 10 })`
   (`src/features/lessons/kit/explorer.ts:250`), with Lesson 10 as the current node. Under its
   heading is Lesson 1's line, which names no lesson's state: the legend and the cards say it, from
   the season data. Its cards show only learner information: "Ready", "Coming later" or "Done", and
   "Ready · read" for a lesson with no film, with no signature, no backlog and no topic codes
   (`explorer.ts:132-157`; FACTS 6; Explorer and season data).
10. **Footer**: Lesson 1's, with "Season 1 · Lesson 10 · Major and minor"; the two practice links,
    printed `mercurypitch.com/pitch-training` and `mercurypitch.com/ear-lab`, with "Drone Intonation
    and Stack are free." and no first-visit line (FACTS 45, 46, 47); Lesson 1's fonts line and
    "Every sound on this page is synthesised in your browser" (FACTS 6, Labels); the legal links, as
    every lesson document closes (`src/tests/lesson-pages.test.ts:198-209`). With no film there are
    no voices to credit.

## Length

The learner copy is 2,376 words by the review's count (FACTS 3), under the series' cap, Lesson 3's
page at 2,382 words on the same count at `616c97edb`. The page runs about 17 minutes: 9.98 minutes
of reading at 238 words a minute and 7.0 of sound, toys and tasks, 16.98 in all. That is past
MASTER-PLAN § 4.2's 8 to 12 minutes of active time, as Lessons 3, 5, 6 and 7 are (15, 17, 15 and 16
minutes: Lesson 3 FACTS 61, Lesson 5 FACTS 2, Lesson 6 FACTS 3, Lesson 7 FACTS 4). Each step's text,
with its Try, its Notice and any predict, runs 93 to 120 words (Steps 1 to 5: 103, 98, 120, 93 and
114), inside § 4.2's 50 to 120 a step. Four parts carry more, for these reasons:

- **Step 3, 168 words with its drawer.** Its Go deeper drawer (48 words) says why the predict keeps
  do at home, and is closed by default; Major or minor?, its ear game, is a card under the Notice.
- **Step 4, 364 words with its mix-up card and drawer.** The mix-up card (141 words) sits in the
  step whose toy refutes it, as in Lessons 2 to 7, and holds the three studies the lesson's
  misconception needs; the drawer (130 words), closed by default, holds three more, the children's
  study among them, which the review of 20 October moved there to shorten the card.
- **Sing it, 295 words.** It holds the series' singing lines, which are Lesson 3's word for word and
  are not cut (LESSON.md's intro).
- **The Wrap, 356 words.** The practice card names two drills and says how Drone Intonation spells
  and scores a note, which the learner needs before opening it (FACTS 48 to 50).

The activities are timed from the spec's own lengths (FACTS 3): the cold open's three plays (1.6 s,
and 3.1 s for each move) and the four words' sounds, about three quarters of a minute; Step 1's
thirds and eight rounds of Major or minor?, about a minute and a quarter; Step 2's stacking, about a
quarter of a minute; Step 3's switch, slides and ten rounds of the game on chords, about a minute
and three quarters; Step 4's four pattern plays, about half a minute; Step 5's predict and its two
scales, about half a minute; Sing it, about a minute; the two recall and four quick-check questions,
about a minute.

## Toys: what each reuses, and what is new

| Toy                                     | Reuses                                                                                                                                                                                                                                                                                                                                                                                                                                         | New in Lesson 10                                                                                                                                                                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. The chord beads                      | The kit's sound (`kit/sound.ts`: `playTone`, the soft tone), notes (`kit/notes.ts`: `hz`, `spellOn`, `spellScale`), mode store (`kit/names.ts`), frame loop, step deck and stage fit; Lesson 4's names switch (`lesson-04/stairs-words.ts`), which this page moves into the kit with a choice of modes, Lesson 6's modes with it                                                                                                               | Beads on semitone rows, one chord in one column; the gap buttons and the fifth's bracket; Stack a third; Major · Minor; Slide; the pattern with Slow · Fast; Chord · Scale, a staircase drawn as Lesson 4 draws a scale; Slow; the name strip; the compact layout |
| 2. The hero's spiral and the bead slide | The kit's spiral (`kit/spiral.ts`), the hero's own copy seen from above, as Lesson 2's hero copy can be (`lesson-02/spiral-copy.ts`)                                                                                                                                                                                                                                                                                                           | Halos, the chord's triangle and the bead slide, drawn in the spiral's overlay                                                                                                                                                                                     |
| 3. Predict widgets                      | The kit's predict (`kit/predict.ts`), with a free play before the choice and a reveal after both of two plays                                                                                                                                                                                                                                                                                                                                  | Nothing                                                                                                                                                                                                                                                           |
| 4. Four words                           | The words strip of Lessons 1 to 5, a ticket per word with its figure and play button, each page keeping its own figures (`lesson-04/words.ts`)                                                                                                                                                                                                                                                                                                 | Four new figures                                                                                                                                                                                                                                                  |
| 5. Major or minor?                      | The kit's ear game, from Lesson 6's page: Lesson 2's (`lesson-02/ear-game.ts`), generalised to N answers, with a fresh seed each run                                                                                                                                                                                                                                                                                                           | Two modes, thirds and chords; a deal that gives each answer half the rounds                                                                                                                                                                                       |
| 6. Sing it                              | Lesson 3's comfort check, voice choice and feeling question (`kit/comfort.ts`, `kit/voice-choice.ts`, `fyp-voice`); the kit's slide guide and breathing ring (`kit/slide-guide.ts`, `kit/sing.ts`); Lesson 4's count-in note and Move do (`lesson-04/examples.ts`, `lesson-04/sing.ts`), which this page moves into the kit, Lesson 6's Move do with it; the guide's breath mark, from Lesson 6's page; Lesson 6's rest card after "Effortful" | A path of two chords with a gap; the Easy and Workable line                                                                                                                                                                                                       |
| 7. Go deeper drawers                    | Lesson 2's `details` drawer                                                                                                                                                                                                                                                                                                                                                                                                                    | Five items in three drawers                                                                                                                                                                                                                                       |
| 8. Recall and quick check               | The kit's quiz (`kit/quiz.ts`), with its prefix, slot and away links; Lesson 4's recall, shown to everyone (`lesson-04/main.ts:58-65`); Lesson 6's questions                                                                                                                                                                                                                                                                                   | Ids and keys                                                                                                                                                                                                                                                      |
| 9. Tease still                          | The kit's next-lesson card and its slot (`kit/next-card.ts`), as Lesson 2's figures sit in it                                                                                                                                                                                                                                                                                                                                                  | One still: a siren's line crossing a grey seam                                                                                                                                                                                                                    |

### 1. The chord beads

One component, `lesson-10/chord-beads.ts`, new, in the states thirds (Step 1), stack (Step 2), slide
(Step 3), pattern (Step 4), scale (Step 5) and free play, with a compact layout for short screens.
It draws on a canvas and lays its targets over the drawing as real buttons, so the keyboard and the
stage-fit test reach them. It is generic over a chord, a root and its intervals, so Lesson 12 can
draw its triads with it; it moves into the kit when Lesson 12 needs it.

- **Drawing.** Pitch is height (playbook rule 20). Each note is a bead on faint semitone rows, the
  app's piano-roll way of drawing pitch, as Lesson 6's tune line draws it (Lesson 6 FACTS 38; FACTS,
  Illustrations without claims). A chord's notes sound together, so its beads stand in one column.
  Beside each bead is its name, spelled one letter per chord tone through `spellOn`
  (`src/features/lessons/kit/notes.ts:147-155`), so C minor's third reads E♭, never D♯ (FACTS 10,
  19). The rows carry no names. To the right of the column, a button sits in each gap between two
  beads, carrying the gap in semitones, "4 · major third" or "3 · minor third" (Steps 1 to 3, and
  free play); it plays its two notes. To the left, a bracket joins the root to the fifth, labelled
  "7 · perfect fifth" (Steps 2 to 4, and free play). Along the figure's foot, the name strip names
  the chord, "C major · do-mi-so" or "C minor · do-me-so" (Steps 2 to 4), or the third, "Major third
  · 4 semitones" (Step 1).
- **The signature.** When the third changes quality, its bead slides down or up one row in 0.4 s and
  lands as its name changes, E to E♭. The gap numbers swap, 4 and 3 to 3 and 4, the bracket stays "7
  · perfect fifth", and the name strip changes "major" to "minor". A soft halo round the whole chord
  brightens once as the bead lands: the chord's "colour changing", drawn as light, never as a hue
  (Look; FACTS 40). Under reduced motion the bead lands at once and the halo does not pulse.
- **Slow**, a toggle (`aria-pressed`) in Steps 1, 2, 3 and 5, doubles every length of the stage's
  plays (MASTER-PLAN § 4.2 item 5, "play / pause / scrub / slow on every animation"; FACTS 75, 77),
  as Lessons 4 and 6 do; Step 4's Slow · Fast is its own tempo switch.
- **Thirds** (Step 1): two beads, C4 and E4, both chrome: Step 1 names an interval, not yet a
  chord's third. **Play the third**, and the gap button, play its two notes one after the other, 0.6
  s each, then together for 1.0 s (FACTS 75). **Major · Minor** is a segmented switch
  (`aria-pressed`, at least 44 px each), from Major; Minor slides the top bead down to E♭4.
- **Stack** (Step 2): it opens on Step 1's two beads in C major, so the stacking is the viewer's.
  **Stack a third** drops a new bead in from above, G4, a minor third over E4, in 0.4 s, and gives
  its place to **Play the triad**, which takes the focus and plays the three notes at 0.55 s each,
  then together for 1.2 s (FACTS 75). The middle bead turns gold: the chord's third (Look).
- **Slide** (Step 3): Major · Minor, as in Step 1, now moving the middle bead; **Slide**, two
  buttons, "Root lower" and "Root higher", that move the whole chord to the next white-key root,
  from C4 up to B4, in 0.5 s, its names respelled. The root moves by letter, so every chord the toy
  shows is one of FACTS 19's fourteen, each spelled with no double sign and no E♯, B♯, C♭ or F♭; the
  highest note it reaches is F♯5, the fifth of B major and minor (FACTS 70a). Play the triad, as in
  Step 2. A slide is silent; Play plays the chord where it now stands.
- **Pattern** (Step 4): **Play the pattern** plays root, fifth, third, fifth, four times over in
  quavers, then the chord together for 1.0 s, each bead lighting as it sounds (FACTS 42, 76).
  **Major · Minor** as before, and **Slow · Fast**, a segmented switch: Slow is 70 crotchets a
  minute (7.9 s in all), Fast 160 (4.0 s). A change while the pattern plays takes effect from the
  next quaver. The figure's readout says what is set, "C minor · slow". The same three beads sound
  at both speeds; only the tempo changes (FACTS, Illustrations without claims).
- **Scale** (Step 5): it opens on the chord, C major. **Chord · Scale**, a segmented switch, spreads
  the chord into its scale: the three beads move apart left to right while five more stairs rise
  between them, C4 to C5, one stair per note climbing left to right as Lesson 4 draws a scale
  (`lesson-04/stairs-draw.ts`), drawn by this toy in its own colours, in 0.6 s on the kit's
  `expoOut` curve (`src/features/lessons/kit/reveal.ts:17-18`); Chord folds it back. The predict's
  two plays spread the chord first if it is folded, since they play on the staircase (Toys 3). The
  chord's notes keep their beads, do, mi and so, with mi's stair gold, and me's under Minor; the
  other five are plain stairs. Under Minor, mi, la and ti each drop one row and are renamed me, le
  and te, drawn in the same chrome as the rest and labelled, never in a mood colour (FACTS 24, 25;
  FACTS, Illustrations without claims). The names switch is Lesson 4's
  (`lesson-04/stairs-words.ts:17-23`), which this page moves into the kit with a choice of modes
  (What the kit and the app still need, item 5), and shows two of its three modes, Letters ·
  Do-re-mi, as Lesson 6's page does, on a page-wide `createModeStore` (`kit/names.ts:27`), as Lesson
  4's page keeps its own (`lesson-04/main.ts:69-70`). Lesson 4's syllables are the major scale's
  (`SOLFEGE`, `stairs-words.ts:25-35`), so this page gives the switch its own: under Minor, do re me
  fa so le te do, the do-based minor the series sings (FACTS 8, 26). The letters come from
  `spellScale` (`notes.ts:165-177`; FACTS 27). Major · Minor waits for the predict's choice: in Step
  5 the toy draws it disabled until the predict's `onChoice` says a choice is in, and the predict's
  `unlocks` enables it (`src/features/lessons/kit/predict.ts:63-66`), so the stage cannot answer the
  predict first.
- **Free play** (Wrap): its own copy of the toy in a card, as Lesson 4's is
  (`lesson-04/main.ts:90-92`), with every control: Root lower and Root higher, Major · Minor, Chord
  · Scale, **Play** (the chord, note by note and together, or the scale, whichever shows), **Play
  the pattern**, **Slow** (doubling Play's lengths, and playing the pattern at Step 4's slow tempo
  rather than its fast one) and the names switch. Spread into a scale on a root slid to B4, it
  reaches B5, 987.77 Hz, the scale's top do (FACTS 70a), in the scale's own window (Layout and
  targets). Nothing locks: the guided steps come first on the page (playbook rule 17).
- **Readouts** sit inside the figure, as Lesson 1's do (`learn/01.html:605-627`, `.readout`), so no
  status line takes height.
- **Layout and targets** (FACTS 82). Rows are 15 px a semitone, so the closest two beads, a minor
  third apart, sit 45 px apart, and their 44 px targets never overlap; the two gap buttons' centres
  sit 3.5 rows, 52.5 px, apart in either quality. A bead's target plays its note in the soft tone.
  The full window runs from C4 to F♯5, every note of every chord a slide can reach, 18 semitones,
  270 px; with 22 px above and below for the targets and the 26 px name strip, the figure is 340 px
  tall. Spread into a scale, the window shows the scale's own octave instead, root to top do, on its
  lowest 12 rows, 180 px, so the root sits on the lowest row whatever the root. On C4 those are the
  full window's own rows, so Step 5's staircase rises where its chord stood; on a higher root, in
  free play, the spread carries the chord's beads down to their stairs as it opens, in the same 0.6
  s, and the fold carries them back. A slide while the scale shows renames the rows and keeps the
  stairs in place, as the compact window does, so a scale on B4 shows B4 to B5. The page's
  stylesheet sets that height on the figure's own class at every width, since the kit's figures are
  330 px on a desktop, 280 px in the deck and 250 px up to 420 px wide, or 380, 340 and 310 for a
  tall one (`lesson-stage.css:769-787`, `:1073-1078`, `:1083-1089`), as Lesson 6's 350 px figure is
  taller than the kit's own. Across the narrowest figure, 310 px at 344 px wide, a row of the
  bracket (60 px), the names (56 px), a bead's target (44 px) and the gap buttons (120 px), with
  their spaces, takes 300 px. On phones (up to 960 px wide, where the stage sits above the text) the
  figure spans the card's inner width (`.viz.wide`,
  `src/features/lessons/kit/lesson-stage.css:1271-1282`), 356 px at 390 x 844. In the scale state no
  stair is a target: the plays are the predict's buttons, so the eight stairs share the figure's
  width, 38.8 px each at 344 px. On touch the figure keeps the kit's `touch-action: pan-y`
  (`lesson-stage.css:769-777`), so a swipe still scrolls the page; every action is a button.
- **The stuck stage.** Beside the text, the stage has the room the window leaves under the masthead,
  its height less the 58 px masthead and 18 px (`lesson-stage.css:651-672`; `--mast`,
  `src/features/lessons/kit/lesson-base.css:94`): 564, 555, 604 and 581 px at the kit's four short
  landscape sizes (`src/e2e/learn-stage-fit.spec.ts:35-55`). The kit shrinks a figure to fit, never
  below its `--viz-min`, 180 px unless a lesson's stylesheet sets more (`lesson-stage.css:676-693`),
  so the page sets `--viz-min: 340px` on the stuck stage only, under
  `@media (min-width: 961px) and (min-height: 561px)`, the stage's stuck condition and the opposite
  of the deck's query (`lesson-stage.css:1026-1082`). The stage, with its head, the 340 px figure,
  at most two rows of 44 px controls and the card's padding, is about 540 px, inside the smallest
  room, 555 px. No step shows a status line under its figure, and the ear game and Step 5's predict
  sit in the step text, not on the stage, which is what keeps every step to two rows of controls.
- **The compact layout** (FACTS 82). On a phone held sideways the kit caps the deck's figure so that
  it and its toy's first row of controls share the screen, down to its `--viz-min`, 150 px unless a
  lesson's stylesheet sets more (`lesson-stage.css:1100-1117`): 162 px at 844 x 390, and 150 px on
  the shortest phones. The page leaves that floor alone, and the toy reads its figure's height
  whenever it changes and, below 340 px, draws its compact layout. Its window is the chord's own
  eight rows, root to fifth, 105 px, with 22 px above and below for the targets, 149 px in all, so
  the rows and the targets keep their sizes. The window follows the chord: a slide changes the rows'
  names and keeps the beads in place. The name strip moves into the figure's top-left corner. In the
  scale state the rows close up to 9 px, since no stair is a target: the octave's 108 px, with 20 px
  above and below, 148 px. So at 844 x 390 each step's figure and its first control share the
  screen, and every control stays at least 44 px each way, as the kit's stage-fit test asks of every
  lesson (`learn-stage-fit.spec.ts:162-213`, `:259-288`).
- **Keyboard and screen readers.** The figure is a group named for its state, with a summary that
  changes with it: "C major: C 4, E 4, G 4. Gaps of 4 and 3 semitones; root to fifth 7, a perfect
  fifth." Each bead is a button named by its note and role, "C 4, the root"; each gap button by what
  it plays, "Play the major third, C 4 up to E 4". A polite live region says what each action
  changed, once: "Minor: the third moved down a semitone, to E flat 4. C minor." or "Stacked: C, E,
  G. C major." Every accessible name and live text uses words, never a ♯ or ♭ sign (`wordName`,
  `notes.ts:193`). Tab order: the stage's controls in reading order, then the beads from the root
  up, then the gap buttons.
- **States**: thirds; stack; slide; pattern; scale; free play, every control together; each in its
  full or compact layout. Any state can be playing or still. Leaving a step by any route (Next or
  Back, a swipe, the lesson menu's jump, `#step-N` or a quiz link) stops its sound and any queued
  replay, as `lesson-03/main.ts:80-87` stops its toys when the step changes. A new play anywhere on
  the page stops the last, so one sound plays at a time. The page-wide "now playing" owner that does
  this comes into the kit with #1149's fix pass, and every source of sound on this page goes through
  it.

### 2. The hero's spiral and the bead slide

The hero's stage holds a spiral of its own, the kit's (`src/features/lessons/kit/spiral.ts`),
mounted as Lesson 2's hero copy is (`lesson-02/spiral-copy.ts`; `lesson-02/cold-open.ts:39-58`) and
taken further without forking it (`spiral.ts:22-26`):

- **Seen from above.** `setView('top')` at mount looks straight down the axis, so one turn is a ring
  of twelve (`spiral.ts:132-133`), and `ring: 60` keeps the turn from C4 lit from above (`:96-97`),
  so do, mi and so, C4, E4 and G4, sit on it. `setTurning(false)` holds it still (`:130-131`). Every
  name on the spiral follows the page's sharps-or-flats choice (`spiral.ts:19-20`), which the page
  sets to Flats at load (`Names`, `kit/names.ts:84-88`), so the ring names every black key by its
  flat, D♭, E♭, G♭, A♭ and B♭, and each move lands on the letter it left, E♭ or G♭ (FACTS 10). The
  page shows no switch for it, and the chord beads, which spell through `spellOn`, never read it
  (`src/features/lessons/kit/notes.ts:151-177`). A black key's bead is a "?" until it is lit on that
  copy (`spiral.ts:13-14`), so the page lights the turn's five with `light` (`:122-123`), and the
  moving bead lands on a named note, E♭ or G♭.
- **The page's marks**, drawn each frame in the spiral's `overlay` (`spiral.ts:90-91`) from where
  the beads landed (`BeadHit`, `src/features/lessons/kit/spiral-draw.ts:31-37`), as Lesson 2's trail
  is (`lesson-02/spiral-copy.ts:38-40`): a chrome halo round do, mi and so, each carrying its
  syllable; a thin chrome triangle joining the three; and, from the reveal on, the chord's name in
  the ring's centre. Nothing on the figure marks which note is the chord's third before the reveal
  (FACTS, Illustrations without claims).
- **The bead slide**, new (CURIOSITY-MOMENTS § 3.1, "the bead slide (10)"). In a move, the moving
  note's halo and bead travel along the ring from its own bead to the bead a semitone below, E4 to
  E♭4 or G4 to G♭4, over the 0.4 s its pitch glides, and the triangle's corner follows it. Once the
  sound ends, it slides home, silently, in 0.4 s (FACTS 73). Under reduced motion it lands at once
  and returns at once.
- **After the reveal**, mi's halo is gold and glows once (Look). A move then shows the chord's name
  as it lands: "C minor" for mi's move; for so's, the triangle turns dashed ink-2 with a "?", the
  contrast case, and the name reads "C, E, G♭: neither major nor minor" (FACTS 41b).
- **Taps.** A tap on a bead plays its note, as on Lesson 2's hero spiral, and the spiral's keyboard
  slider works as the kit's does, A2 to A5 (FACTS 70a). The three plays are buttons under the
  spiral, at least 44 px tall.
- **Speaking for it.** The drawing is a slider for the notes, as Lesson 2's hero copy is
  (`role="slider"`, `learn/02.html:395-400`), its values set by the kit; a polite live region beside
  it speaks for the moves: "C, E and G together." as the chord plays, and LESSON.md's "Mi moved down
  a semitone: C, E flat, G." or "So moved down a semitone: C, E, G flat." as a move lands.

### 3. Predict widgets

- Both are the kit's predict (`src/features/lessons/kit/predict.ts:29-71`, `mountPredict` at `:79`):
  the choice locks, the play buttons unlock, the reveal appears after the sound and never calls a
  choice wrong; two choices each, every button at least 44 px tall. The plays start disabled in the
  markup, all but a free one, and the choice enables them and moves the focus to the first that is
  not free (`:106-124`).
- **Cold open.** The choices are [ Mi ] [ So ] (FACTS 41). Its three plays sit under the spiral on
  the hero's stage, outside the predict card, and are handed to the predict as its `plays`
  (`predict.ts:67-68`). "Play the chord" (`chord-c`) is a free play (`data-free`, `:14-15`): it sets
  up the question and answers nothing. "Move mi down" (`move-mi`) and "Move so down" (`move-so`)
  wait for the choice, and the reveal waits until both have been heard, since it compares them:
  `revealOn: ['move-mi', 'move-so']` with `revealAfter: 'all'` (`:52-58`). The two must be passed
  together: without `revealOn`, `'all'` waits on nothing (`:97-101`). Until a choice the lock hint,
  in the markup, reads LESSON.md's "Choose an answer to unlock the two moves."; after one,
  `hints.chosen` reads "Locked in. Move mi down, then move so down, and listen to each chord.";
  after a heard play that does not reveal, `hints.next` reads "Now hear both moves, mi down and so
  down, for the answer."; with sound off, `hints.silent` is LESSON.md's "Sound is off, so nothing
  played. Turn sound on to hear the chord, then play it again."; after the reveal, `hints.again`
  reads "Move either note again, or play the chord." The reveal's "You said" line is the kit's
  `guess` (`:52-53`): "You said: mi" or "You said: so", never "right" or "wrong". As it shows, mi's
  halo glows gold once (Toys 2) and orange celebrates (Mercs). The reveal's last line makes the
  other choice a fair guess (CURIOSITY-MOMENTS § 1, rule 2; FACTS 41).
- **Step 5.** The choices are [ Just one: mi ] [ Three ] (FACTS 44). Both plays, "Play C major"
  (`scale-major`) and "Play C minor" (`scale-minor`), unlock after the choice, and the reveal waits
  until both have been heard (`revealOn` both, `revealAfter: 'all'`). The hints are LESSON.md's: the
  lock hint "Choose an answer to unlock the two scales."; `hints.chosen` "Locked in. Play C major,
  then C minor, and watch the staircase."; `hints.next` "Now play the other one."; `hints.silent`
  "Sound is off, so nothing played. Turn sound on to hear them, then press Play C minor."; and
  `hints.again` "Play them again, or switch the names to do-re-mi." The plays sound on the stage's
  staircase, which shows the scale that is playing, each stair lighting as it sounds (FACTS 77). The
  choice also unlocks the stage's Major · Minor (`unlocks`, `predict.ts:65-66`; Toys 1, Scale). The
  guess lines are "You said: just one" and "You said: three".
- With sound off the reveal waits: the reveal only ever describes a sound that was heard
  (`predict.ts:5-10`).
- A play that is cut short is not heard. A new play, a stop or leaving the step ends it early, and
  the reveal waits for plays that run to their end. A cut-short play resolves `false`, which tells
  the kit's predict "not heard"; `void` keeps today's meaning. Both come with #1149's fix pass.
- States: waiting for a choice; a sound playing; choice made and sound heard, reveal shown.
- Under reduced motion the reveal appears at once, with no slide-in.

### 4. Four words

The strip of Lessons 1 to 5: a ticket per word with its small figure, its definition and a play
button, in the page's own `lesson-10/words.ts`, as each earlier lesson keeps its own figures
(`lesson-04/words.ts`). Each button is named for what it plays, LESSON.md's labels after "Play": "C
up to E", "C, E and G", "major, then minor" and "C natural minor" (FACTS 74). The figures answer
neither predict, since the strip comes after the hero and before Step 5 (FACTS, Illustrations
without claims): for third, two beads, C and E, with "4" between them; for triad, three, C, E and G,
none of them marked; for quality, the two words "major" and "minor", each lighting as its chord
sounds, with no bead drawn moving; for natural minor, its own staircase of eight, C4 to C5, with no
major scale beside it to compare. Under reduced motion the beads and words light in turn, with no
other motion.

### 5. Major or minor?

The kit's ear game, from Lesson 6's page (`kit/ear-game.ts:1-25` on `feat/lesson-06-page`): Lesson
2's Semitone or tone? (`lesson-02/ear-game.ts:1-16`) generalised to N answers. This page needs two,
which Lesson 2's game already has; if this page is built first, it moves the game into the kit in
that form. It sits in its step's text column, under the Notice, as Lesson 2's game card does (its
DECISIONS 82).

- **On thirds** (Step 1): eight rounds, each a root from C4 to G4, then the note 3 or 4 semitones
  above it, 0.6 s and 0.8 s, 0.15 s apart (FACTS 78).
- **On chords** (Step 3): ten rounds, each, as the test in the Royal Conservatory's 2019 voice
  syllabus does, the first five notes of a major or minor scale on a root from C4 to G4, 0.32 s
  each, 0.25 s of silence, then its triad together for 1.2 s (FACTS 21, 43, 78).
- **Answers**: two buttons side by side, "Major" and "Minor", each at least 44 px tall. As in Lesson
  2's game, the keys 1 and 2 answer while the card has focus and Space plays the round again, a
  focused button keeping Space for itself; the answers use `aria-disabled`, never `disabled`, so a
  keyboard user's focus stays put (`ear-game.ts:12-16`).
- **Feedback** names the interval or the chord and the sound, never the listener (playbook rule 21).
  Unlike Lesson 2's, it names no letters, since the root changes every round and the point is the
  gap: on thirds, "A major third: 4 semitones up." or "A minor third: 3 semitones up."; on chords,
  "Major: its third sat 4 semitones above the root, do-mi-so." or "Minor: its third sat 3 semitones
  above the root, do-me-so." The kit's game opens each line with "Yes." or, after a miss, "Here it
  is again, slower." (`kit/ear-game.ts:234`). A miss lights the right answer, reads its line and
  replays the round at 1.5 times its lengths, the kit game's `slower` (`kit/ear-game.ts:130-131`)
  set as Lesson 6's page sets it (`MISS_SLOWER`, `lesson-06/examples.ts:36`), where Lesson 2's own
  game replays at 1.6 (`lesson-02/ear-game.ts:29-30`); the round is not asked again, and Next moves
  on. After two misses in a row the playbook's line "If that felt tricky, good: that's learning."
  follows, once a game (rule 15; `lesson-02/ear-game-rounds.ts:29-30`). A polite live region reads
  each line.
- **Rounds** are dealt by the page's own deal, which the kit's game takes as `deal(random)`
  (`kit/ear-game.ts:121-122`), from the kit's default seed: a fresh one for each run, Play again
  included, from `Math.random()` and kept in memory only (`kit/ear-game.ts:8-10`; `freshSeed`,
  `kit/ear-game.ts:95-96`), fed to the kit's `mulberry32` (`src/features/lessons/kit/dom.ts:57-66`).
  Lesson 2's game starts every visit on one fixed seed (`lesson-02/ear-game.ts:26-27`), so its first
  run can be learnt by heart; a fresh seed cannot be. The deal gives each answer half the rounds,
  shuffled, where Lesson 2 tosses a coin for each round (`lesson-02/ear-game-rounds.ts:36-44`), so a
  short run cannot lean to one answer. The unit tests pass a fixed seed (`seed`,
  `kit/ear-game.ts:139-140`).
- **The count** at the end, "7 of 10" (or "5 of 8"), counts the rounds answered right first time; no
  rating, no streak, nothing stored. Then Play again.
- States: ready (a Play button); playing; answering; feedback shown; finished, with the count and
  Play again. Under reduced motion the answer lights and the line appear with no transition.

### 6. Sing it

The guide is the kit's slide guide (`src/features/lessons/kit/slide-guide.ts`, `mountGuide` at
`:378`), as Lesson 4's page uses it (`lesson-04/sing.ts`), on eight rows from do up to so: the four
the chords use named do, me, mi and so, and the other four faint (`GuideRow`,
`slide-guide.ts:35-42`). The rows show syllables only, no letters, so no spelling can go wrong
wherever Move do puts do; a readout names do in Lesson 4's names for the key, "do is E3", spoken "do
is E 3" (FACTS 64). Merc's path is do-mi-so, 1.2 s a note and the top note 1.8 s, then do-me-so, the
second phrase's first point marked `gap` (`:16-17`, `:48-49`), so nothing is drawn across the 1.6 s
between them: 10.0 s in all (FACTS 65). The path carries the kit's breath mark, from Lesson 6's page
(`breaths`, `slide-guide.ts` on `feat/lesson-06-page`), at the start of the gap, 4.2 s in: a small
tick in the path's own colour with the word "breathe" (FACTS 66). Beside the guide, the kit's
breathing ring (`mountRing`, `src/features/lessons/kit/sing.ts:132`) shows the still of the Merc
singing, blue for the lower voice and orange for the higher, never a microphone icon. Every state
has a visible status line that is also announced (`aria-live="polite"`). Lesson 3's rule for leaving
holds, for what plays here: if the section stays off screen for 600 ms, or the page is hidden,
whatever is playing stops (`src/features/lessons/lesson-03/sing.ts:366-382`).

States:

1. **Comfort check**, always first and asked every visit (never stored): Lesson 3's line, its list
   naming all six of REQ-GVC-020's conditions, and its two buttons, through `mountComfort`
   (`src/features/lessons/kit/comfort.ts:111-119`; FACTS 57).
2. **Voice choice**, after either comfort answer: Lesson 3's two buttons with the Mercs' stills
   (`aria-pressed`, at least 44 px), read from and stored in `fyp-voice` through `VoiceChoice` and
   `bindVoiceButtons` (`src/features/lessons/kit/voice-choice.ts:30-47`, `:60-77`; FACTS 59). Its
   line has the two forms Lessons 5, 6 and 7 write: with none stored, "Choose a voice to sing with.
   If you chose one in an earlier lesson, pick it again:", neither button pressed, and the next
   state waits for a choice, before "Just listen today" plays anything too, because the voice picks
   the Merc who sings; with one stored, "Keep the voice you chose before, or change it:", that
   button pressed, and nothing waits on it.
3. **Just listen today** (listen-only mode): LESSON.md's line with the doctor lines (FACTS 58, 62).
   **Play Merc's notes** sings both chords on a tap in the chosen voice, the path lighting as they
   play; Start the guide and Move do are not shown, and nothing asks the viewer to sing
   (REQ-GVC-021). The answer holds for the visit, and the Wrap shows the rest card (`VisitEnding`,
   `comfort.ts:84-102`).
4. **Ready**: the controls in LESSON.md's order, under the Your turn text and the stop line, which
   sits in one place, on its own line above the buttons. **Play Merc's notes** sings do-mi-so, then
   do-me-so, on do = E3 (lower) or E4 (higher), in Merc's "ooh", 10.0 s (FACTS 63, 65, 80), the path
   lighting in amber in step while the ring shows the singing Merc's still. **Move do** is Lesson
   4's group, "Move do:" with lower and higher (`learn/04.html:1243-1252`), moved into the kit (What
   the kit and the app still need, item 7): a semitone each, up to four either way (`MOVE_MAX`,
   `lesson-04/sing.ts:32-35`, `:168-176`), moving Merc's notes, the guide's count-in and its readout
   together, from "do is C3" to "do is A♭3" for the lower voice (spoken "do is A flat 3"), or C4 to
   A♭4 for the higher (FACTS 64). At four either way its button is `aria-disabled`.
5. **Guide**: **Start the guide** is enabled once Merc's notes have played with sound on (hear it
   first: playbook rule 16); until then it is `aria-disabled`, with the hint "Play Merc's notes
   first". With sound off, Play Merc's notes runs its lights silently and the hint says why, in the
   series' form: "Sound is off, so nothing played. Turn sound on to hear Merc's notes, then start
   the guide." It is the viewer's turn, so the amber goes, the rows turn plain chrome and Merc's
   path is drawn dashed in chrome. The count-in is Lesson 4's: do, once, softly, at half a tapped
   note's level, for 0.8 s, then 0.2 s of quiet (`lesson-04/examples.ts:137-141`; FACTS 80). Then a
   vertical chrome line sweeps the path for 10.0 s, past the gap, with nothing riding the path
   itself, while the ring breathes through the gap with the still of the Merc last heard at its
   centre. Merc does not sing in the guide: it is the viewer's turn. Space never starts the guide,
   and focus never moves to a button when a state changes, only to its text (REQ-GVC-080, as
   `lesson-03/sing-view.ts:1-9` does). When the sweep ends, the feeling question follows.
6. **How did that feel?** appears under the guide each time a sweep ends, asked afresh with no
   answer pressed: Lesson 3's four answers through `mountFeelings` (`comfort.ts:121-152`; FACTS 67).
   The kit locks the answer once given, until the next sweep resets it; Lesson 6's page passes the
   kit's new `changeable`, so its answer can change until then (`mountFeelings`, `comfort.ts` on
   `feat/lesson-06-page`). This page keeps the lock until the coach settles it for the series
   (Decisions for the owner).
   - Easy or Workable shows LESSON.md's line, "Do-mi-so, then do-me-so: you just moved the third.",
     which names the task, never the voice or how the notes went, since nothing listened, and leaves
     the guide as it was.
   - Effortful shows Lesson 3's gentle line, "Keep it gentle: rest before you sing again.", and puts
     the guide and Move do away for the visit (REQ-GVC-021: a report of effort suppresses
     immediate-repeat encouragement). Play Merc's notes still plays, at the do Move do last set. The
     Wrap shows the rest card (REQ-GVC-055; FACTS 67), which this page sets itself, as Lesson 6's
     does, since the kit's `afterFeeling` leaves "Effortful" off the rest card for the coach to
     decide (`comfort.ts:58-67`); LESSON.md's coach list asks the coach to confirm it.
   - Uncomfortable shows Lesson 3's enough-for-today line, "Thanks for saying so. That's enough
     singing for today: rest your voice.", and the doctor lines, puts the guide and Move do away for
     the visit, and the Wrap shows the rest card (REQ-GVC-023, REQ-GVC-055).
   - A guide put away and a rest card picked stay so for the visit. The page keeps the ending in
     memory for the visit, never in storage.

The flow is a pure rule (`lesson-10/sing-flow.ts`), as Lesson 6's page makes its own
(`lesson-06/sing-flow.ts` on `feat/lesson-06-page`, the shape to follow): from the comfort answer,
the voice, whether Merc's notes have been heard, how many sweeps have run and the latest answer, it
gives the state, the controls shown, the line and the Wrap's card, so every branch above is
unit-tested (Tests, unit 8).

Nothing listens and nothing is scored: the page has no microphone and never calls `getUserMedia`, so
it produces no reading to get wrong (REQ-GVC-031), and its lines describe the chords and the task,
never the body (REQ-GVC-045; FACTS 68). The doctor lines appear only after "Just listen today" and
"Uncomfortable", as on Lesson 3's page. Keyboard order follows the flow: the comfort buttons, the
voice buttons, Play Merc's notes, Start the guide, Move do, then the four feelings. Under reduced
motion the path's notes light one after another instead of the travelling line, and the ring keeps
the kit's reduced-motion form.

### 7. Go deeper drawers

`details` disclosures, closed by default, as Lesson 2's are: under Step 3's text, "Why do stays
home"; under Step 4's, "Happy and sad at once", "Tempo first" and "The other way round"; under Step
5's, "Do or la?" (LESSON.md).

### 8. Recall and quick check

Two quizzes share this page through the kit's quiz (`src/features/lessons/kit/quiz.ts`, `createQuiz`
at `:205`), with the options it already has (`:73-97`): an id prefix for each quiz's elements;
`lesson` optional; a question `id`, the telemetry's `question_id`; a slot for a question's own
controls (`:52-58`); and, for a question from another lesson, a step link that reads "Try Lesson 6,
Step 5 again" and opens in a new tab, through `away` (`:87-94`, `linkAway` at `:173-203`), which
keeps a link's words and drops the link wherever that lesson is not live.

- **Recall**: Lesson 6's questions 2 and 3, word for word with their feedback (LESSON.md; FACTS 7),
  under Lesson 6's ids, `l06-q2` and `l06-q3`. If Lesson 6's page lands first, they are imported
  from its `lesson-06/quiz-questions.ts` and filtered by id, as Lesson 4's page takes Lesson 2's
  (`lesson-04/quiz-questions.ts:28-29`); otherwise they are written into this page's
  `lesson-10/quiz-questions.ts` as Lesson 3 writes Lesson 2's (`lesson-03/quiz-questions.ts:116`),
  and give way to the import when Lesson 6's lands. Shown to everyone, as Lesson 4's recall is
  (`lesson-04/main.ts:58-65`), since Lesson 6 is a prerequisite (CURRICULUM § 3.3). Prefix
  `recall-`, keys `fyp-l10-recall-seed` and `fyp-l10-recall-v1`; earlier answers are never shown, so
  the answers measure delayed retrieval (MASTER-PLAN § 9). It takes no `lesson`, so it marks nothing
  done. Its links open Lesson 6's page at the step, `/learn/06#step-5` and `/learn/06#step-2`, in a
  new tab, through `away: { href: recallStepHref }`; the kit's step deck opens a page at the step
  its address names (`src/features/lessons/kit/step-deck.ts:19-23`). Its second question's slot
  holds its play button, Lesson 6's C4 then F4 (FACTS 71), named "Play two notes".
- **Quick check**: LESSON.md's four questions, ids `l10-q1` to `l10-q4`, keys `fyp-l10-seed` and
  `fyp-l10-quiz-v1`, and `lesson: 10`, so answering all four marks Lesson 10 done in the explorer.
  Three answers each, shuffled per question from the stored seed, one-line feedback for every
  answer, and a check icon and ink (not gold) on the right one. The kit prints "Right." or "Not
  quite." before each line (`quiz.ts:278`), so no feedback line starts with "Right", "Yes" or
  "Correct". Question 2's slot holds its play button, D4, F4 and A4 together for 1.4 s, a D minor
  triad (FACTS 79), named "Play the question's chord", so it never shares a name with the cold
  open's Play the chord; the kit keeps a slot's controls across answers, and the page handles them
  with a listener on the quiz's `host`. "Try Step 1 again" to "Try Step 5 again" use the kit's
  `data-goto-step`. Answers stay in the viewer's browser until the telemetry track exists.

### 9. Tease still

The drawing in the next-lesson card's slot, the page's `[data-next-card]` mark, which the kit keeps
in the card after its words (`kit/next-card.ts:27-30`, as Lesson 2's figures sit there): an SVG,
`aria-hidden`, of a siren's line climbing Lesson 7's range chart and crossing a shaded grey seam,
never red, with no words or notes on it (CURIOSITY-MOMENTS § 2, Lesson 10, Tease; FACTS,
Illustrations without claims). The seam's place and width are drawn, not measured. It holds no
button, since the card is a link, and it plays no sound. Its styles go under a class of its own: not
Lesson 2's `.tease` (`src/features/lessons/lesson-02/lesson-02.css:477`), which
`learn-next-card.spec.ts` tests, and not the tease line's `.next-tease`
(`src/features/lessons/kit/lesson-sections.css:198-200`); in the kit's shared still styles, if the
page that first adds them (CURIOSITY-MOMENTS § 3.1, "one still per card") lands first, else in this
page's stylesheet. It does not move.

## Audio

Every sound is synthesised in the page with Web Audio, through the kit's sound module, its master
bus and its house envelopes (`.claude/memory/audio-pop-free-playback.md`), and started only by a
tap: a tapped note, a chord and the toys' plays in the soft tone; Merc's singing in Merc's "ooh",
each note its own voice; the guide's count-in in the soft tone at half a tapped note's level (FACTS
70 to 81). Nothing autoplays, one sound plays at a time, and the page has no music bed.

- **A chord** is three voices started in one task, so they share one start on the audio clock, each
  at 0.075, about 1.7 times one tapped note under the master's compressor (FACTS 81), through
  `playTone` (`src/features/lessons/kit/sound.ts:560-569`), whose visuals run even when sound is
  off.
- **A move** is the two held notes as voices for its 3.1 s and the moving note as one voice along a
  contour, `contourOf(329.63, [{ hold: 1.2 }, { glide: 0.4, to: 311.13 }, { hold: 1.5 }])` for mi,
  or from 392.00 to 369.99 for so, through `playContour` (`sound.ts:285-308`, `:571-584`), whose
  pitch glides on the audio clock (`:314-347`; FACTS 73). The bead's slide is timed from the same
  start, so it lands as the note lands.
- **Levels**: a tapped note at the soft tone's 0.13; a chord's voices at 0.075 each; Merc's "ooh" at
  the kit's level; the count-in at 0.065 (FACTS 80, 81).
- **Sound off or none.** Every play asks the kit's `Sound.canPlay` (`sound.ts:510-522`): the first
  tap turns sound on; with sound off the kit's toast says so and the visuals play silently; with no
  Web Audio nothing sounds and the visuals still play. The kit stops every sound when the page is
  hidden (`sound.ts:475-477`).

## Mercs

Lesson 1's setup through the kit (`src/features/lessons/kit/merc-duo.ts`,
`src/features/lessons/kit/merc-warm.ts`): the app's renderer loaded after first paint, one WebGL
context per Merc, medium quality on phones, turned towards each other, paused off screen, and the
still images when WebGL fails or would run on the CPU.

- They live in the hero, on either side of the spiral, and are on screen while the cold open plays.
  Orange asks and blue answers in the bubbles (LESSON.md). While a chord sounds, both listen
  (`mercListen`, `merc-duo.ts:206`); neither sings, since the chord is not sung. Orange celebrates
  once as the reveal shows, the puzzled guesser who then gets it (`mercCelebrate('orange', 1600)`,
  `:216`, as Lesson 2's cold open does, `lesson-02/cold-open.ts:56`; playbook rule 15), a quiet one,
  since the reveal calls no choice right: the page mounts the pair with `{ sparkles: 'none' }`
  (`MercDuoOptions`, `merc-duo.ts:120-126`). The page asks for no other state.
- In Sing it the Mercs appear as stills, in the ring (Toys 6).
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Drone Intonation.** `mercurypitch.com/pitch-training` opens the Exercises tab (FACTS 46);
  the viewer taps Drone Intonation, which holds a drone low in the saved voice range and names a
  note to sing above it without playing that note: at the default difficulty six rounds, Unison to
  Octave, each drone 6 s with 4 s to sing (FACTS 48). It scores each note in plain cents against the
  octave it asks for (FACTS 49), so the card says so and sends the viewer to Settings, Singing Voice
  Range, first (CURRICULUM § 4 item 7). It names black keys with sharps, typed with a #, so the card
  says how this lesson's E♭ shows there (FACTS 50). The link is `/pitch-training?lesson=10`, and the
  marker lets First Light, the main app's intro, step aside on a first visit (FACTS 46a), so the
  card, the rest card and the footer carry no first-visit line.
- **Today, Ear Lab's Stack.** `mercurypitch.com/ear-lab`, then tap Stack (FACTS 47, 51): twelve
  rounds, each one chord on a roved root, named from six qualities, of which this lesson teaches
  two. On the public host `/ear-lab?lesson=10`, the marker before the hash the entry document adds
  (`src/seo/entry-pages.ts:439-444`). Stack needs no voice, so it stays on the rest card (FACTS 67).
- **Needed, proposed: `/exercises/thirds-on-a-drone`** (CURRICULUM § 4 item 2, the planned
  `intervals` launch field; FACTS 52, 53): Drone Intonation with the field set to the minor and
  major thirds, 3 and 4 semitones up, registered in `EXERCISE_SLUGS`
  (`src/features/exercises/slug-map.ts:47-65`) with a line in `src/tests/slug-map.test.ts`. Beyond
  the field it needs repeats: `pickIntervals` draws each interval at most once and a run's rounds
  are capped at the pool's size
  (`src/features/exercises/drone-intonation/use-drone-intonation-controller.ts:26-31`, `:72-76`), so
  a two-interval pool must be allowed to repeat, with no interval twice running, or the run is two
  rounds long. The pairing with Lesson 6's proposed `fourths-and-fifths` is the App track's to keep
  (FACTS 53).
- **Needed, proposed: `/exercises/major-or-minor`** (CURRICULUM § 4 item 5, the planned `ear-drill`
  launch kind): Stack with `stack:maj` and `stack:min` only. As Lesson 2 decided for its two-answer
  Leap run, it rates on a track of its own (`RunTrack`,
  `src/features/ear-lab/use-identification-controller.ts:56-63`), never the shared Stack rating; its
  guess floor matches the two pads it shows, a half (`src/lib/ear/drills.ts:58-60`, `:233-237`); and
  it passes `updateItem: false` (FACTS 53).
- When either ships, LESSON.md's editorial note gives the copy, and the card, the rest card and the
  footer switch to the slug, which carries `?lesson=10` too.
- **Proposed, App content** (FACTS 49, 55), for the App content track and, for Drone Intonation's
  score, the coach: the Learn chapter "Common Musical Scales" calls C major "Bright, cheerful, and
  uplifting." and natural minor "Emotional, reflective, and sometimes sad.", and gives C minor's
  relative major as A major, where it is E♭ major (`src/types/walkthrough.ts:887-907`); Drone
  Intonation's copy promises "just intonation" and "pure intonation" while every target is
  equal-tempered, and its score folds in a "richness" reading, a fifth of the total. And
  `/ear-lab`'s entry document should link back to Lesson 10 once it is out, as `/piano-night`'s and
  `/guitar-night`'s should (`docs/plans/find-your-pitch/SEARCH.md` § 8). SEARCH.md § 4 lists Piano
  Night among the rooms this lesson practises in; the page links only the two drills the CURRICULUM
  card names (FACTS 4).
- Not linked: none of the premium exercises (`src/lib/native-build.ts:58-68`; FACTS 54).

## Explorer and season data

Lesson 10's entry (`src/features/lessons/kit/season.ts:342-350`), proposed for when this page is
built:

- `minutes: 17` and `page: '/learn/10'`, written plainly, as Lesson 3's entry is
  (`season.ts:204-213`, its comment `:210-211`) and Lesson 5's after it (`:250`):

  ```ts
  // A draft until its sign-off (drafts.ts), as Lesson 3 is.
  minutes: 17,
  page: '/learn/10',
  ```

  The entry decides nothing about being live. Its line in `drafts.ts` holds the lesson back on
  mercurypitch.com until the console publishes it, and `seasonFor` then gives every list Lesson 10
  with no page and no reading time, so it reads as coming later
  (`src/features/lessons/kit/publish.ts:102-124`; the season's own rule,
  `src/features/lessons/kit/season.ts:15-25`). No lessons module but `publish.ts` may read the draft
  list, and none but `page-state.ts` the build's default
  (`src/features/lessons/kit/drafts.test.ts:57-68`), so the entry folds nothing away.

- `pr.link`, proposed: `href` `/ear-lab?lesson=10`, `addr` `mercurypitch.com/ear-lab`, `label` "Ear
  Lab" and `note` "then tap Stack", which `practiseMarkup` prints after the address as "Ear Lab,
  then tap Stack" (`kit/explorer.ts:174-179`). Stack is the lesson's ear drill and needs no voice,
  so the card stays right whatever Sing it's ending, as Lesson 6's card links Leap
  (`season.ts:278-281`). For the owner (Decisions for the owner), the other choice: Drone
  Intonation, `href` `/pitch-training?lesson=10`, `label` "Exercises" and `note` "then tap Drone
  Intonation", as Lesson 4's card links the drill its Wrap leads with (`season.ts:236-241`).
  `pr.needs`, "Drone Intonation and Ear Lab Stack", stays until the slugs ship: it is "Admin only,
  never drawn on a lesson page" (`season.ts:102-103`, and the fields the team keeps, `:27-31`).
- The signature stays as it is (`kit/team-notes.ts:42`). The entry has no `fig`, so the card draws no figure.
- The hook stays word for word (`season.ts:348`; FACTS 1). The tease Lesson 9's card shows for this
  lesson, and Lesson 11's tease on this page's card, are the kit's lesson copy
  (`kit/lesson-copy.ts:122`, `:131`; FACTS 5, 5b).
- The card reads "Ready · read", with "17 min", once the page is live (`explorer.ts:150-157`).

## What the kit and the app still need

Found in the kit and the app as they stand on main at `85e23a1af` (20 October 2026), beyond the
parts Lessons 2 to 7 promote into the kit (Toys table). Every item is proposed. Main has since moved
to `d59c00ad6` (21 October), which adds the Content Studio's Lessons page: no line this spec cites
at `85e23a1af` changed there, and that page's own lines are cited at `d59c00ad6`.

1. The lesson host: `learn/10.html` at `/learn/10`. The dev and preview servers and every build take
   every `learn/NN.html` as a lesson page, a draft's included, with no entry of its own
   (`vite.config.ts:77-86`, `:138-140`, `:474`; `lessonPages` and `lessonInputs`,
   `tools/draft-lessons.ts:77-86`, `:109-117`). Still needed: `/learn/10` and `/learn/10.html` in
   `STANDALONE_DOCUMENT_PATHS` (`src/lib/sw-runtime.ts:93`), beside the drafts' entries, whose
   comment gives the reason: where a draft is not published, its address must reach the site
   worker's 404 page, never the app shell (`:140-156`).
2. `src/features/lessons/kit/drafts.ts:30-38`: Lesson 10's line, in the form of Lessons 3 and 5's:
   `10: "Lesson 6's page at /learn/06, and the vocal coach's look at the sung checkpoint"`. While it
   stands, the page is held back on mercurypitch.com and served on the dev site and every PR
   preview, and the console can publish it there before both are done, with no release
   (`src/features/lessons/kit/drafts.ts:5-13`), once it has asked "Publish ${name} before its
   sign-off?" and named what the line says the page waits on
   (`src/features/admin/AdminLessonsPage.tsx:186-207`, at `d59c00ad6`). Releasing it is deleting
   that line once both are done, then listing it as item 15 says
   (`src/features/lessons/kit/drafts.ts:18-21`; SEARCH.md § 12 item 3).
3. `lesson-10/chord-beads.ts`, new (Toys 1): the chord beads, generic over a chord, with its pure
   layout helper for the targets and the compact layout.
4. `lesson-10/cold-open.ts`, new (Toys 2): the hero's spiral, its overlay and the bead slide. The
   kit's spiral needs nothing: `setView('top')`, `ring`, `overlay`, `light` and `setTurning` are on
   main (`kit/spiral.ts:73-98`, `:111-138`).
5. The names switch (Toys 1): Lesson 4's (`lesson-04/stairs-words.ts`), promoted into the kit with a
   choice of modes and the page's own syllables, as Lesson 6's spec lists it. Lesson 6's page keeps
   its two modes on its own page (`NamesMode` and `NAMES_MODES`, `lesson-06/tune-words.ts:19-21`,
   its store at `lesson-06/main.ts:70-71`, on `feat/lesson-06-page`), so this page moves the switch
   into the kit and takes Lesson 6's modes with it; if this page lands first, Lesson 6's page takes
   the kit's. The page-wide store is the kit's already (`createModeStore`, `kit/names.ts:27`).
6. The ear game (Toys 5): the kit's, from Lesson 6's page (`kit/ear-game.ts` on
   `feat/lesson-06-page`), Lesson 2's Semitone or tone? generalised to N answers, with a deal of the
   page's own (`deal(random)`, `kit/ear-game.ts:106-107`), a replay factor (`slower`,
   `kit/ear-game.ts:110-111`) and a fresh seed for each run (`freshSeed`, `kit/ear-game.ts:87-88`).
   The page's deal balances its rounds, so the game needs nothing more; if this page lands first, it
   adds the game in that form.
7. Move do and the count-in's note (Toys 6): Lesson 4's (`lesson-04/sing.ts:32-35`, `:168-176`;
   `lesson-04/examples.ts:137-141`), promoted into the kit beside the slide guide, as Lesson 6's
   spec lists it. Lesson 6's page keeps its own on its page (`MOVE_MAX` and `clampMove`,
   `lesson-06/sing-guide.ts:37`, `lesson-06/sing-guide.ts:50-51`, on `feat/lesson-06-page`), so this
   page moves Move do into the kit itself and takes Lesson 6's copy with it. The kit's guide already
   waits through a count-in before its sweep (`sweep`,
   `src/features/lessons/kit/slide-guide.ts:74-75`). Lesson 4's Move do and Lesson 6's both set
   `disabled` at their limits (`lesson-04/sing.ts:90-97`; `lesson-06/sing.ts:113-116`), which drops
   a keyboard user's focus there; the kit's takes `aria-disabled`, and both pages switch to it.
8. The breath mark on the slide guide (Toys 6): the kit's, from Lesson 6's page (`breaths`,
   `slide-guide.ts` on `feat/lesson-06-page`). Until that lands, the gap alone shows where to
   breathe (FACTS 66); if this page lands first, it adds the mark in that form.
9. `kit/quiz.ts`: `recallStepHref` promoted beside `lessonPageHref` (`:124-126`). This page would be
   its fourth user, after `lesson-03/quiz-questions.ts:23-24`, `lesson-04/quiz-questions.ts:31-32`
   and `lesson-05/quiz-questions.ts:19-20`, which then import it from there. The quiz needs nothing
   else: its prefix, slot and away links are on main (`quiz.ts:52-58`, `:73-97`, `:173-203`).
10. `kit/comfort.ts` needs nothing: this page's `sing-flow.ts` picks the rest card after
    "Effortful", as Lesson 6's does, leaving the kit's default for the coach (`comfort.ts:58-67`),
    and it keeps the kit's lock on the feeling answer, where Lesson 6's page passes the new
    `changeable` (Toys 6; Decisions for the owner).
11. `kit/season.ts`, Lesson 10's entry (Explorer and season data).
12. The head, from SEARCH.md § 3 and Lesson 4's document (`learn/04.html:9-137`), held by
    `src/features/lessons/kit/lesson-copy.test.ts:325-360` on every page from its first commit, and
    by `src/tests/lesson-pages.test.ts:85-183` once released:
    - title, at most 60 characters with the headline in it: in the form Lessons 1, 2, 3 and 5 use,
      "Major and minor: Find Your Pitch, Lesson 10 | MercuryPitch" (58 characters), until SEARCH.md
      § 13 item 1 settles titles for the series; if it settles them query-led, as it recommends,
      SEARCH.md § 4's draft, "Major and minor: the one note that changes | MercuryPitch" (57
      characters) (Decisions for the owner). The site worker never rewrites the title, whichever
      hook the console picks;
    - description, 80 to 160 characters: "Which single note turns a major chord into a minor one? A
      seventeen-minute lesson with sound toys: thirds, major and minor triads, and the natural minor
      scale." (159 characters; 171 with the alternative hook, Edge cases);
    - `og:title` and `twitter:title` "Major and minor: Find Your Pitch, Lesson 10", the lesson's
      name and the series', as on Lessons 1, 2, 3 and 5 (`learn/02.html:26-29`, `:45-48`);
      `og:description` and `twitter:description` the hook, as on Lessons 3 and 5;
    - `og:image` and `twitter:image` the share card (item 13), with `og:image:width` 1200,
      `og:image:height` 630, and `og:image:alt` and `twitter:image:alt` naming it, as on Lesson 2
      (`learn/02.html:34-60`);
    - canonical and `og:url` `https://mercurypitch.com/learn/10`;
    - robots `index, follow, max-image-preview:large` and `twitter:card` `summary_large_image`;
    - the Article block: `@id` `https://mercurypitch.com/learn/10#lesson`, `url` the canonical,
      `image` the same URL as `og:image` (`lesson-pages.test.ts:146-147`, `:159`), headline "Major
      and minor", `alternativeHeadline` the hook, the same description, `inLanguage` `en-GB`,
      `learningResourceType` "Lesson", `educationalLevel` "Beginner", `timeRequired` `PT17M`,
      `teaches` ["Major and minor thirds", "Building major and minor triads", "Telling a major from
      a minor chord by ear", "The natural minor scale"],
      `isAccessibleForFree`, `position` 10, `isPartOf` the series, author and publisher the site's
      `Organization` (`https://mercurypitch.com/#organization`), and `datePublished`, the date the
      page first goes live on mercurypitch.com. Nothing writes it at run time: the site worker
      changes the page's state, the hook's copies and its links (`src/lesson-gate.ts:10-21`),
      never a date, so a published draft is served without one. It is set either in the commit
      that deletes the page's `drafts.ts` line or in a commit straight after the console
      publishes it, and the owner picks which (SEARCH.md § 3.2). Last, the BreadcrumbList, ending
      on the headline.
13. `public/learn/lesson-10-og.jpg`: the share card, 1200 x 630, a still of the hero: the title over
    the ring of twelve seen from above, do, mi and so in chrome joined by their triangle, between
    blue Merc and orange Merc, with alt text naming it. It marks no note as the one that moves, so
    the card does not answer the cold open's predict (FACTS 1a).
14. The first-paint budget, in the change that adds the page: `learn/10.html` in both of
    `scripts/assert-first-paint-budgets.mjs`'s tables, its JavaScript and its render-blocking CSS,
    measured, with the lessons' headroom, a quarter over. Every build emits every lesson page, a
    draft's included (`scripts/assert-first-paint-budgets.mjs:103-105`); `build:e2e` runs the check
    (`package.json:20`), and a document it emits with no budget fails it (FACTS 83).
15. On release (SEARCH.md § 12), once its `drafts.ts` line is deleted: `public/sitemap.xml` and
    `public/llms.txt` (its Lessons list, `:66-77`), one line each. Until then the draft's rules hold
    on the repository: in neither file, linked from no entry document, its service-worker rule kept
    (`src/tests/lesson-pages.test.ts:242-279`). While the console has it published, the site worker
    adds it to the sitemap and llms.txt it serves, and takes it out again if it is held back
    (`src/lesson-gate.ts:22-24`; `src/features/lessons/kit/drafts.ts:18-21`). So indexing is
    requested when the console publishes the page, not at the release.
16. Lessons 1 to 9's pages, when this one goes live: nothing to edit. Their explorers and their
    Wraps' next-lesson cards read the season as their page state shows it (`pageLessons`,
    `src/features/lessons/kit/page-state.ts:54-57`), so Lesson 9's card, once Lesson 9 is live,
    turns from "Coming later" to "Start lesson" and links this page.
17. The App content items under Practice links.

## Decisions for the owner

Each with the package's recommendation. The review of 20 October came to the same judgement on every
item it weighed, items 2 to 11; item 1 follows from its findings and from the owner's answer to
CURIOSITY-MOMENTS § 5 item 2.

1. **The alternative hook, `bright-dark`.** Keep it switchable, as the owner's answer to
   CURIOSITY-MOMENTS § 5 item 2 keeps every changed hook's old wording
   (`src/features/lessons/kit/lesson-copy.test.ts:269-284`), or retire it. The Content Studio's hook
   picker offers it with its note, which names the mood labels. Picked, it puts "bright" and "dark"
   in the h1, the head's copies of the hook and the structured data, on Lesson 10's card in every
   lesson page's explorer and on Lesson 9's next-lesson card, and runs the description to 171
   characters (Edge cases, "The admin console's hook"). Recommended: keep it switchable, as the
   answer has it, and leave it unpicked.
2. **The page's title.** The series' form, "Major and minor: Find Your Pitch, Lesson 10 |
   MercuryPitch" (58 characters), until SEARCH.md § 13 item 1 settles titles for every lesson; then
   its answer, which is SEARCH.md § 4's query-led draft if the recommendation stands (What the kit
   and the app still need, item 12).
3. **The publish order.** Lesson 10 is published only after Lesson 6 is, because its recall asks
   Lesson 6's questions and its chip names Lesson 6 (Edge cases, "Lesson 6 not yet live"). The
   console asks before it publishes Lesson 10 while its draft line stands, and the line names Lesson
   6's page, but it never checks that Lesson 6 is live and asks nothing once the line is deleted:
   the owner keeps the order. Proposed: a console warning when a lesson is published before the
   lesson it recalls.
4. **The explorer card's practice link: Stack**, `/ear-lab?lesson=10` and "then tap Stack" (Explorer
   and season data). It needs no microphone, Ear Lab locks nothing, Lesson 6's card links Leap the
   same way, and it is right whatever Sing it's ending. The other choice: Drone Intonation.
5. **The rest card after "Effortful".** Shown, as on Lessons 6 and 7 (Toys 6; FACTS 67). The kit's
   default, `afterFeeling`, keeps the practice card after "Effortful" (`comfort.ts:58-67`): the
   outlier, and a question for the vocal coach across the series.
6. **The ear game's seeds.** The kit's default, a fresh seed for each run, as the game on Lesson 6's
   page takes it; a fixed first seed, as Lesson 2's game has, can be learnt by heart (Toys 5).
7. **The replay after a miss, at 1.5 times the lengths**, as Lesson 6's games set it; Lesson 2's is
   1.6 (Toys 5).
8. **Locking the feeling answer.** The kit locks it once given; Lesson 6's page lets it change until
   the next sweep. For the vocal coach to settle for the whole series; this page keeps the lock
   until then (Toys 6).
9. **The quizzes' play buttons in the kit quiz's slot**, which keeps a slot's controls across
   answers (`quiz.ts:52-58`; Toys 8). Lesson 6's spec says the kit rebuilds the questions on every
   answer (`docs/plans/find-your-pitch/lessons/06-intervals/WEB-SPEC.md:415-416`): that line is out
   of date.
10. **The coach's volume line.** "Sing at about speaking volume." stays, the series' line; "or a
    little softer, never a whisper" is a safe addition for the coach to make (LESSON.md, For the
    vocal coach; FACTS 60).
11. **The recall's step links**, `/learn/06#step-5` and `/learn/06#step-2`: the `#step-N` form the
    built Lessons 3 to 5 use (`recallStepHref`), which the kit's step deck opens at, with
    `recallStepHref` moved into the kit (What the kit and the app still need, item 9).

## Edge cases

- **Sound off, unset or missing.** Every play obeys the kit's `canPlay` (Audio). The predicts'
  reveals and Start the guide wait for heard sound (Toys 3, 6). With no Web Audio the page stays
  readable, every play runs its visuals in silence with its hint, and Sing it offers the listen-only
  path.
- **A hidden page or a section off screen** stops what is playing (Audio; Toys 6).
- **Leaving a step** stops the stage's sound; starting any play stops every other.
- **Before a choice**, Move mi down and Move so down are disabled, and the reveal stays hidden; Play
  the chord and a tap on any bead still sound.
- **One move heard, then a wait**: the reveal stays hidden, with `hints.next` showing, until the
  other move has been heard with sound on.
- **Back to Step 5 after its choice**: Major · Minor stays enabled, since the toy keeps what the
  predict's `onChoice` told it (Toys 1, Scale).
- **Storage blocked** (`src/features/lessons/kit/dom.ts:68-88` never throws): the quizzes run
  without their seed and record, the voice choice is asked each time, the done list is empty;
  nothing breaks.
- **A stored voice** is used at once; changing it takes effect at the next play.
- **The root at its ends**: C4 and B4. Root lower is `aria-disabled` at C4, and Root higher at B4.
- **Move do at its ends**: four semitones either way, then its button is `aria-disabled` (FACTS 64).
- **Held back** (mercurypitch.com, until the console or a release publishes it): the site worker
  answers `/learn/10` with the 404 page, and the page state gives every list Lesson 10 with no page
  and no reading time (`src/features/lessons/kit/publish.ts:102-124`), so every explorer shows it as
  coming later with no link, and Lesson 9's card, once it exists, reads "Coming later". A page no
  worker served takes its build's default instead: shown in `pnpm dev` and the e2e bundle, held back
  in a production bundle (`src/features/lessons/kit/page-state.ts:5-10`;
  `src/features/lessons/kit/draft-switch.ts:5-6`, `:21`).
- **Lesson 6 not yet live**: this page stays held back until it is, by the owner's hand: the
  console's question before it publishes a draft names Lesson 6's page, but nothing checks it
  (Decisions for the owner, item 3). Published first, it would break nothing: its chip would stay as
  a plain chip, and its recall's step links would keep their words with no link
  (`src/features/lessons/kit/page-state.ts:84-108`; `src/features/lessons/kit/quiz.ts:173-203`). But
  the recall would ask about a lesson the learner cannot open.
- **The admin console's hook.** The console can switch Lesson 10's hook to its alternative,
  `bright-dark`, "Which single note turns a bright major chord into a dark minor one?"
  (`kit/lesson-copy.ts:115-123`): the pick is the `hook` field of the lesson's override, set through
  PUT `/api/admin/lessons/:n` (`src/lib/lesson-state.ts:41`, `:49-50`, `:182-189`) from the Content
  Studio's hook picker, which prints the variant's note under it
  (`src/features/admin/lessons/LessonControls.tsx:447-451`, at `d59c00ad6`). The page's markup keeps
  the default; picked, the alternative goes wherever the hook goes. The site worker writes it into
  the page's h1, into every head copy that quotes the hook, the description and the og and twitter
  descriptions, and into the structured data (`src/lesson-gate.ts:14-21`, `:444-460`, `:476-487`,
  `:561-591`). Its list takes in the og and twitter titles too, but they carry the lesson's name,
  not the hook (What the kit and the app still need, item 12), and it never touches `<title>`. The
  page state gives it to every list (`src/features/lessons/kit/publish.ts:22-25`; `seasonFor`,
  `src/features/lessons/kit/publish.ts:108-124`): Lesson 10's card in every lesson page's explorer
  prints it (`src/features/lessons/kit/explorer.ts:244`), even while Lesson 10 is coming later, and
  so does Lesson 9's next-lesson card (`src/features/lessons/kit/next-card.ts:114-115`). So "bright"
  and "dark", mood labels, would stand on every surface the lesson's own rule covers, the rule it
  teaches (FACTS 1, 40). The description would run to 171 characters, over the 160 cap, which
  `src/tests/lesson-pages.test.ts:129-132` checks only on the page as written. Neither hook names a
  note, so the title never answers the predict (FACTS 1a). The package recommends leaving it
  unpicked (Decisions for the owner, item 1).

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-10/`, and on the kit
parts it adds:

1. Spelling: the fourteen triads of FACTS 19 and the fourteen scales of FACTS 27, from `spellOn` and
   `spellScale`, with no double sign and no E♯, B♯, C♭ or F♭; C minor's third is E♭4, never D♯4.
2. The chords: major is 4 then 3 semitones and minor 3 then 4, each 7 to the fifth (FACTS 17); in
   the cold open, C, E♭, G is minor, and C, E, G♭ has a 6-semitone fifth and is neither (FACTS 41b);
   B, E, G stacks in thirds as E, G, B, E minor (FACTS 41a); natural minor steps 2, 1, 2, 2, 1, 2, 2
   and lowers degrees 3, 6 and 7 (FACTS 22, 24).
3. Sounds: every fixed sound's frequency equals `hz(m)` for the notes of FACTS 70; `chord-c` lasts
   1.6 s and each move 3.1 s, its glide 0.4 s from 1.2 s in (FACTS 72, 73); the four words last
   1.55, 2.85, 3.2 and 4.05 s (FACTS 74); the pattern lasts 7.9 s slow and 4.0 s fast (FACTS 76); a
   scale 4.05 s (FACTS 77); Slow doubles every length; a chord's voices sound at 0.075 each (FACTS
   81).
4. The cold open's predict: "Play the chord" plays before a choice and never reveals; the reveal
   waits for both moves heard with sound on; `revealOn` and `revealAfter: 'all'` are passed
   together; a move stopped before its end, by a new play, a stop or leaving the step, counts as
   not heard and reveals nothing; the guess lines and the four hints are LESSON.md's.
5. The bead slide: its position along the ring at each moment of a move, from its own bead to the
   one a semitone below over the glide, and home after; at once under reduced motion.
6. Layout, the pure helper behind Toys 1's targets: at every width from 344 to 1440 px every bead
   target, gap button and control is at least 44 px each way and none overlaps another; the full
   figure is 340 px tall; the compact layout fits 150 px with the same targets, and is the one drawn
   below 340 px (FACTS 82).
7. Major or minor? from a fixed seed: eight rounds on thirds and ten on chords, each answer half the
   rounds; every round's notes inside C4 to D5 (FACTS 70a); the feedback templates; the count counts
   first-time answers only; a miss replays at 1.5 times its lengths, and leaving the step before
   the replay starts, including a jump to another step, cancels it, so nothing new plays.
   Starting any other sound on the page stops a round that is sounding: one sound at a time.
8. The Sing it flow (`lesson-10/sing-flow.ts`, Toys 6): with no stored voice the voice choice comes
   before either path, under its first line, and a stored voice starts pressed, under its second
   line, and can be changed; "Just listen today" hides Start the guide and Move do and picks the
   rest card; Start the guide waits for Merc's notes heard with sound on; the feeling question
   follows every sweep, asked afresh; "Easy" and "Workable" give "Do-mi-so, then do-me-so: you just
   moved the third." and keep the guide; "Effortful" and "Uncomfortable" put the guide and Move do
   away for the visit and pick the rest card, and no later answer brings them back; nothing is
   written to storage but `fyp-voice`.
9. Move do: clamps at four semitones either way; at every position both chords lie inside every
   preset of the chosen voice, checked against `VOCAL_RANGES` imported from
   `src/stores/settings-store.ts` (FACTS 63, 64); the readouts, in Lesson 4's names.
10. Copy: every line of LESSON.md's page copy and every template in Toys 2, 3, 5 and 6 passes
    `validateGuidedDynamicClaim` (`src/lib/guided-voice/claims.ts:116`, surface `finding`); no quiz
    feedback line starts with "Right", "Yes" or "Correct"; no accessible name or live text holds a ♯
    or ♭ sign.
11. The quizzes: the recall's two questions equal Lesson 6's `l06-q2` and `l06-q3`, imported or,
    until Lesson 6's page lands, held equal to Lesson 6's LESSON.md; the quick check's ids and keys;
    `recallStepHref(6, 5)` is `/learn/06#step-5`.
12. The season entry: `seasonFor` with a state that holds Lesson 10 back, by its draft default or by
    `{ 10: { published: false } }`, gives it no `page` and no `minutes`, as
    `src/features/lessons/kit/publish.test.ts:57-73` checks Lessons 2 and 3. On a page no worker
    served, with `VITE_DRAFT_LESSONS` stubbed to '0' and the modules reloaded (`vi.stubEnv`,
    `vi.resetModules`), Lesson 1's explorer shows Lesson 10 as "Coming later", with no link to
    `/learn/10` and its practice link kept, and with '1' links it to read, as
    `src/features/lessons/kit/explorer.test.ts:354-379` checks Lesson 5 (the block, `:311-380`). Its
    link's `note` matches none of the backlog words (`/needs|slug|deep link|for now/i`).
13. The names switch: under Minor, Do-re-mi names the staircase do re me fa so le te do, and under
    Major do re mi fa so la ti do (FACTS 8, 26); Letters gives `spellScale`'s names on every root
    (FACTS 27).

End to end (Playwright, `src/e2e/learn-lesson-10.spec.ts`, at 390 x 844 and 1440 x 900, on the e2e
bundle, which no site worker serves and which shows drafts: `build:e2e` sets `VITE_DRAFT_LESSONS=1`,
`package.json:20`):

1. A hard load of `/learn/10` answers 200 with the lesson; no AudioContext before the first tap;
   nothing plays before a play button.
2. The cold open: "Play the chord" plays before any choice and reveals nothing; "Move mi down" and
   "Move so down" are disabled until a choice and enabled after; the reveal stays hidden until both
   moves have been heard, then reads "You said: mi" or "You said: so"; until the reveal no halo is
   gold and the ring shows no chord name; with sound off the hint shows and the reveal waits.
3. Step 5: the stage's Major · Minor is disabled until the choice, and stays enabled after leaving
   the step and coming back; the reveal waits until both scales have been heard.
4. The chord beads by keyboard alone: Tab reaches every control, bead and gap button; Major · Minor,
   Slow · Fast and Slow toggle `aria-pressed`; Stack a third hands the focus to Play the triad; each
   announcement reaches the live region; at 390 x 844 every target measures at least 44 x 44 px with
   none overlapping.
5. The stage fits: the kit's `src/e2e/learn-stage-fit.spec.ts` takes every lesson page in the
   repository (`lessonPages(REPO)`, `:27-32`), so Lesson 10 joins it with its page: every control of
   every step in reach at the four short sizes with at most 60 px of the stage's own scroll
   (`:57-58`), and at 844 x 390 each step's figure and first control on screen together, every
   control at least 44 px (`:259-288`), which the compact layout is for.
6. The first screen: the kit's `src/e2e/learn-cold-open-fold.spec.ts` takes every lesson page too
   (`lessonPages(REPO)`, `:27-32`): it holds the title on the first screen at its seven sizes and
   reports where the first Play and the predict's choices sit (`:12-17`). At 390 x 844, "Play the
   chord" should be on the first screen; the app-check sweep confirms it with screenshots.
7. Sing it: the comfort check shows first, every visit; with no stored voice the voice choice
   follows either answer, under "Choose a voice to sing with. If you chose one in an earlier lesson,
   pick it again:", and nothing plays until a voice is chosen; a stored `fyp-voice` shows pressed
   under "Keep the voice you chose before, or change it:", and a tap on the other voice changes it;
   "Just listen today" shows no guide and no Move do, shows the doctor lines and leaves the rest
   card in the Wrap; Start the guide stays `aria-disabled` until Merc's notes have played; the
   feeling question appears when each sweep ends; "Easy" shows "Do-mi-so, then do-me-so: you just
   moved the third."; "Effortful" hides the guide and Move do and shows the gentle line;
   "Uncomfortable" does the same with the doctor lines; after either, the Wrap shows the rest card
   with Stack still offered, and answering "Easy" later does not bring the practice card back on
   this visit.
8. No call to `navigator.mediaDevices.getUserMedia` at any point (a spy, as
   `src/e2e/learn-lesson-03.spec.ts:318-327` sets one).
9. The recall: shown open to everyone, with an empty `fyp-done` too; its answers mark nothing done;
   its step links are `<a href="/learn/06#step-5" target="_blank">` and `/learn/06#step-2`;
   answering all four quick-check questions marks Lesson 10 done in the explorer; each feedback line
   starts "Right." or "Not quite.".
10. Every practice link carries `?lesson=10` before any hash: `/pitch-training?lesson=10` and
    `/ear-lab?lesson=10`.
11. The next-lesson card: a row for `/learn/10` in `src/e2e/learn-next-card.spec.ts`'s cards
    (`:27-76`), with the eyebrow "Next lesson 11 · Registers and the break Coming later", the link
    `#explorer` and "See it on the map" while Lesson 11 has no page, as Lesson 7's row reads for
    Lesson 8; its `.next-tease` reads Lesson 11's tease, one line above its hook, as the spec checks
    Lesson 1's card (`:102-119`); its still inside the card holds no button.
12. No planning words: the kit's `src/e2e/learn-no-planning-text.spec.ts` reads every lesson page,
    this one included (`lessonPages`, `:45-47`), for the team's words (`:22-40`), and the
    alternative hook's note never reaches the page (`:77-79`).
13. With reduced motion emulated, no bead travels, the stack and the spread land in their end
    states, the Mercs hold still, and nothing moves on its own.
14. A visitor with the studio installed still gets the lesson, not the shell (the service worker's
    document list), as Lesson 3's spec checks (`learn-lesson-03.spec.ts:154`).

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practice links that carry `?lesson=10` before any hash. Then the layout, accessibility, sound,
motion and storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text
children, touch targets of at least 44 px with no two tap zones overlapping, visible focus, a single
dark theme with every colour a token and an explicit body background, sound only after a tap,
localStorage only for per-viewer conveniences inside try/catch, and the whole page usable with no
sound, no WebGL and no storage (the predicts and the guide then say why they wait). Every ♯ and ♭
the page prints in text (E♭ and G♭ in the four words, the steps, the reveals, the quiz and the
practice card, and the readouts) has a spoken name, as Lesson 2's contract sets: the sign is
`aria-hidden` and a visually hidden word follows it, so a screen reader says "E flat" (`signsHtml`,
`src/features/lessons/kit/notes.ts:221`); the figures' accessible names and every live region use
words only. The page stores the quiz seeds and records (`fyp-l10-recall-seed`, `fyp-l10-recall-v1`,
`fyp-l10-seed`, `fyp-l10-quiz-v1`), `fyp-done` (`src/features/lessons/kit/progress.ts:12`),
`fyp-voice` (`voice-choice.ts:20`), the masthead's Pause animations choice, `fyp-motion`
(`src/features/lessons/kit/motion-switch.ts:12`), and the steps the viewer reached, the kit's
`fyp-pos` (`src/features/lessons/kit/position.ts:20`), which `initMasthead` keeps
(`page-chrome.ts:107-138`); nothing from the toys, the ear game or Sing it but the voice.

Page QA before publishing (PRODUCTION-PIPELINE § 5) adds, for this page, every check against a local
or dev build, never production:

- Every control, bead, gap button and switch works by keyboard alone and announces what LESSON.md
  shows; the whole of Sing it runs by keyboard, and a screen reader hears every state.
- At 390 x 844 every target is at least 44 px square and nothing scrolls sideways at 344, 360 and
  375 px; at 1024 x 640 and 1133 x 631 every step's controls are on screen with the stage stuck, and
  at 844 x 390 the compact layout shows each step's figure with its first control, as the kit's
  stage-fit test checks.
- On a real phone, by ear and by eye (`docs/agent/DEVICE-DEBUGGING.md`): the chord's three notes
  sound together and none drowns the others; the glide is smooth, with no click where it starts or
  ends; the moving bead lands as its note lands; the pattern stays even at Fast.
- With a colour-blindness simulation, major and minor still read apart by their names and gaps alone
  (MASTER-PLAN § 5).
- The network panel and the browser's microphone indicator stay quiet through Sing it: no request,
  no microphone.
- The Wrap shows the rest card after "Effortful", after "Uncomfortable" and after "Just listen
  today", and the Drone Intonation card otherwise; every link opens in a new tab.
- The app-check sweep at phone and desktop width, with Sing it open in each state and the cold open
  before and after its reveal.
