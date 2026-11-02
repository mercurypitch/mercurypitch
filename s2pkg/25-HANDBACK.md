# Lesson 25, Minor, properly: hand-back

Package: `docs/plans/find-your-pitch/lessons/25-minor-properly/` in the worktree `/dev/shm/s2plan`
(FACTS.md, LESSON.md, WEB-SPEC.md, new; RESEARCH.md and ARTICLE-PLAN.md untouched), each copied to
the scratch folder `s2pkg/25/` after every save. No shared file, no code and no other lesson's
file was touched; no git was run. This version follows the fix pass on the independent review
(`25-REVIEW.md`): every finding was taken, B1, S1 to S9 and N1 to N12, with the lead's calls.

## Counts

- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/25-minor-properly`: 0
  findings, 325 citations read.
- `node scripts/lesson-words.mjs`: 2,161 words, cap 2,379, 218 under, inside the 2,230 aim; steps'
  own text 120, 104, 117 and 120 (inside 50 to 120). Built page about 2,310 with its hints and held
  lines written out.
- Chip: 15 minutes (2,161 / 238 = 9.08 min reading + about 5.73 min of sound, toys and tasks =
  14.81).
- Head description: "Why does a minor key often raise one note just before it comes home? A
  fifteen-minute lesson with sound toys: harmonic and melodic minor, and relative keys." 156
  characters. Head title, the lead's choice: "Harmonic and melodic minor, relative keys |
  MercuryPitch", 56.

## What the fix pass changed

- **B1, the Wrap's free play.** It holds Raise te, Raise le, its chord column and its chord play
  under the steps' line "Choose an answer at the top to unlock the rest of this figure." until the
  cold open's choice, which enables them through the predict's `unlocks` and draws the column
  through `onChoice`; a return visit holds them again, as Lesson 22's free play does. The hero's
  `data-free` play is "the tune play" throughout; "free play" now means the Wrap's playground only
  (LESSON Wrap and preamble; FACTS 1a, 36, 61; WEB-SPEC Toys 1 and 3, Edge cases, Tests 3 and 18).
- **S1, Step 1's text.** Its two sentences on the chord on so, with Play the chord on so, then home,
  are the predict's second reveal element; until the reveal the held line "Choose an answer at the
  top, then hear both endings, to unlock this paragraph." stands in their place, and `onReveal`
  hides it. The hero's `.reveal` comes first in the list, since the kit writes "You said" into the
  first element. FACTS 1a says what Step 1 shows before the choice, after it and after the reveal.
- **S2, Step 4.** One sentence, "Lesson 21's "no sharps or flats, C major" now names only the major
  key's home.", with the step's own text at 120; the plan's F♯ minor note is dropped and listed as a
  departure (preamble, FACTS 7 and 26, Contract).
- **S3.** "0.15 s of quiet" in FACTS 62, WEB-SPEC Audio and Test 5.
- **S4, kit item 4.** Today's limits named (`ROOTS`, `WINDOW`, `rootLetter`); roots and a window set
  per page, this page's white-key roots A2 to B4 and window A2 to C5, Lesson 10's kept for its page;
  the scale and chord states side by side; unit tests for both, and a layout test at 344 to 390 px.
- **S5, SEASON-2 § 5.2 item 10.** Parts (g), (b), (c), (e) and (f) in kit item 15, in `pr.needs`, in
  a Practice links bullet and in the card's editorial note, each with the sentence it removes; (g)
  lets the link open Sight-Singing in A harmonic minor directly, in Lesson 16's way.
- **S6.** The card adds Lesson 16's two sentences: each note wanted in the octave written, and the
  names printed under the notes ("read the staff, not the names").
- **S7.** The coach's Sight-Singing bullet says its notes can fall anywhere in the saved preset, its
  floor and top included, and that in A harmonic minor it can ask for F to G♯.
- **S8.** Lesson 12 is now the reason the plan's tease is withdrawn (FACTS 5, the card's editorial
  note, `TEASE_NOTES` below); the "So far" reason is dropped; SEASON-2 § 3's line is below.
- **S9.** FACTS 1a adds the recall's two leaning feedback lines, Step 1 before and after the choice,
  the Wrap's free play and the two foot lines that state the answer; Test 18 is now a testable
  assertion.
- **Nits.** N1 the predict's stem (below); N2 the reveal, "of the chords, only the one before home
  changed"; N3 "The chord before home, the chord on so, changes too"; N4 Gravity's "a number with ♭
  or ♯, such as ♯4"; N5 FACTS 49 notes the pair practice in native test builds; N6 the four
  citations; N7 1,525; N8 two ledger lines below the treble; N9 the alternative head title dropped;
  N10 FACTS 5b says the alternative leans and the lead's line is the default; N11 the A3 to A4 cold
  open in the preamble and the Contract; N12 "go straight to Exercises", with an edge case and
  app-check.
- **Found while fixing.** FACTS 1a opened "Nothing a learner meets before the reveal …", which the
  answering plays and the unlocked toys contradict; it now says before the choice, with what the
  choice unlocks and what waits for the reveal. The preamble had put Step 1's chord play under the
  toy's choice hold, where Step 1 has it in the held paragraph. The N12 edge case now names which
  load paths change the key Sight-Singing prints: the library window sets it, the sidebar's
  library list does not.

## Shared-file entries for the lead

### MASTER-PLAN § 11

- Lesson 25: a written lesson, text only, in
  [`lessons/25-minor-properly/`](lessons/25-minor-properly/) (research, article plan, facts, copy
  and page spec). Its unscored sing-along and its practice card's sung drill wait on the vocal
  coach's look (§ 12 item 8). No page is built yet: it waits on Season 2's kit (seasons, the staff
  toy with both clefs and key signatures, SEASON-2 § 6.2 items 1 and 2, with Lesson 10's chord beads
  and staircase, Lesson 12's chord levels, Lesson 6's interval pair and Lesson 12's sing flow moved
  into the kit), on Lesson 21's page registering its quick-check questions, and on the lesson
  plumbing for Lessons 15 to 28 (SEASON-2 § 5.2 item 21). It goes live when the console publishes
  it, after the coach's look and once `/learn/10`, `/learn/21` and `/learn/23`, the pages its chips
  and its recall link to, are live.

### CURIOSITY-MOMENTS § 2

### Lesson 25 · Minor, properly · theory; written; no page yet · hook kept

- **Opening:** Lesson 10's minor staircase on A, A3 to A4 for everyone, the house on do, between
  Merc and Tavi. The tune play, Play the tune, twice, works before the choice: a four-bar tune
  written for the lesson, sung on "ooh" as a melody alone, its second ending's G raised to G♯, the te
  stair lifting to ti as it sounds; no chord plays or is drawn before the choice. Tavi "It's still a
  minor key. Won't the chord before home stay minor?" Merc "Choose, and we'll play each ending with
  its chords." Predict: "Each ending has chords, not yet played. In the first, the chord before home
  is E, G and B. The second raises G to G♯. What does that do to the chord?" [It turns major] [It
  stays minor]. The answering plays, Play ending 1, with chords and Play ending 2, with chords, play
  each ending's last two bars over their chords and draw the chord column, its gaps 3 and 4 or 4
  and 3; the reveal waits for both, opens "It turns major." and shows Step 1's held paragraph on the
  chord on so with it. A reasoning check on Lesson 10's thirds, the lead's: the plan's predict,
  which note was raised, was answered by the hook's "just before it comes home" and by Lesson 21's
  reveal (Lesson 25 FACTS 1a, 31, 33).
- **Visual:** Lesson 10's chord beads and their staircase (moved into the kit) beside the staff toy:
  Raise te, the le-to-ti stair widened to three semitones, Raise le going up only, and in Step 4 the
  staircase redrawn from C major to A minor, the house moving from C to A under one empty
  signature, then C minor's three flats in each clef. The chord on so is held back until the choice,
  in Step 1 and in the Wrap's free play, and Step 1's sentences on it until the reveal.
  **Payoff:** Step 1's chord on so turning major as te rises; Step 3's melodic minor; Step 4's house
  moving; the sing-along, so, te, do, then so, ti, do in A minor, unscored.
- **Tease:** on Lesson 24's card, the lead's "A minor tune, played twice. The second ending changes
  one note.", with Lesson 24's planned line as the alternative `plan`. On this page's card, Lesson
  26's: the lead's "‘Twinkle’, and the same tune four semitones higher, played together.", with the
  plan's line mended as the alternative `plan`, "Lesson 24's other part was a drone. What if it's a
  tune?"; the plan's own line is withdrawn, since a learner who reaches Lesson 26 sang over moving
  chords in Lesson 12 (Lesson 25 FACTS 5, 5b; bound by the lead on 2 November 2026).
- **Facts:** sourced in Lesson 25's FACTS: the three forms, closure, the chord on so, relative and
  parallel keys (Open Music Theory 2e, 1.13 and 4.02), the augmented second as hard to sing
  (Sharkey, Sierra College, 5.2.3), ti's and te's sounds and la-based minor's si (Wikipedia,
  Solfège, at a named revision); the app at `c60f0fdcb`. No mood is claimed for any form of minor.

### SEASON-2 § 3, Lesson 25's card, "Closes on"

The card's last line (`docs/plans/find-your-pitch/SEASON-2.md:627-628`) is false, the same mistake
as the plan's tease:

> - Closes on: Lesson 26's hook. "So far you've sung against a drone that never moves. Now let the
>   other part be a tune: can you make a harmony by singing the tune a third higher?"

A learner who reaches Lesson 26 has sung over moving chords: in Lesson 12, a prerequisite of Lesson
26 (`docs/plans/find-your-pitch/SEASON-2.md:813`), the learner sings each chord's root along with
Merc while the chords play (`docs/plans/find-your-pitch/lessons/12-chords-four-chord-song/LESSON.md:262`),
and this page's cold open plays moving chords under its tune. Proposed, true and in the mended
tease's words:

> - Closes on: Lesson 26's hook. "Lesson 24's other part was a drone that never moved. Now let the
>   other part be a tune: can you make a harmony by singing the tune a third higher?"

### `kit/season.ts` (Season 2's module)

```ts
{
  n: 25,
  lane: 'theory',
  title: 'Minor, properly',
  short: 'Minor, properly',
  topics: ['T15b'],
  // A draft until its sign-off (drafts.ts), as Lesson 3 is.
  minutes: 15,
  page: '/learn/25',
  hook: 'Why does a minor key often raise one note just before it comes home?',
  pr: {
    needs: "Gravity with only Te and Ti (the ear-drill launch kind); Scale Runner's harmonic and melodic minor; Sight-Singing with a key launch, a hear-do start, the bass clef, letter names off and octave-folded scoring",
    link: {
      href: '/ear-lab?lesson=25',
      addr: 'mercurypitch.com/ear-lab',
      label: 'Ear Lab',
      note: 'then tap Gravity',
    },
  },
},
```

T15b's name: "Harmonic and melodic minor; relative keys". `EDGES` gains `[10, 25]`, `[21, 25]` and
`[23, 25]`, so `PREREQ[25]` is `[10, 21, 23]`.

### `kit/lesson-copy.ts` and `kit/team-notes.ts`

```ts
25: {
  tease: 'A minor tune, played twice. The second ending changes one note.',
  teaseAlts: [
    { id: 'plan', text: 'Do, mi and so made a major chord. Minor keys hide another change.' },
  ],
},
26: {
  tease: '‘Twinkle’, and the same tune four semitones higher, played together.',
  teaseAlts: [{ id: 'plan', text: "Lesson 24's other part was a drone. What if it's a tune?" }],
},
```

No hook alternative for 25. `TEASE_NOTES`:

- 25 `plan`: "Lesson 24's planned line. True of Lesson 24's page, whose Step 2 plays do, mi and so over the
  drone. It answers nothing of this lesson's predict outright but leans slightly: 'major chord' beside
  a change in a minor key. The lead's line is the default."
- 26 `plan`: "Lesson 25's planned line, mended. Its 'So far the other part was a drone' is false for every
  learner who reaches Lesson 26: Lesson 12, a prerequisite, had them sing roots over moving chords.
  Only Lesson 24's other part was a drone."

`SIGNATURES[25]`: "Lesson 10's minor staircase: te slides up to ti, le to ti opens into a wider stair,
then le rises too, going up only."

`kit/drafts.ts`: `25: "Lessons 10, 21 and 23's pages at /learn/10, /learn/21 and /learn/23, and the
vocal coach's look at the sung checkpoint and the sung drill",`

### Teases checked

Both pairs were bound by the lead on 2 November 2026.

- **This lesson's (on Lesson 24's card):** the lead's line fits the final opening (one tune played
  twice, the second ending raising one note); it names no note, stair or chord and not what the
  change does. 63 characters. The alternative, 65, answers nothing outright but leans slightly
  ("major chord" beside a change in a minor key), which FACTS 5b says; the lead's line is the
  default.
- **Lesson 26's (on this card):** the plan's line, "So far the other part was a drone. What if it's
  a tune?", is withdrawn: it is false for every learner who reaches Lesson 26, since Lesson 12, a
  prerequisite, had them sing over moving chords, and this page's cold open puts moving chords under
  its tune. The mended alternative, 56 characters: "Lesson 24's other part was a drone. What if
  it's a tune?" The lead's default (68) is true and answers nothing of Lesson 26's predict.

## Kit and app work the page waits for

WEB-SPEC, What the kit and the app still need, items 1 to 17. In short: the lesson host and the
draft line; seasons in the kit; Lesson 10's chord beads and staircase moved into the kit (item 4),
which today take only white-key roots C4 to B4 in a C4 to F♯5 window and refuse any other root, and
need roots and a window set per page (this page: roots A2 to B4, window A2 to C5), the scale and
chord states side by side, a chord column on so, Raise te and Raise le able to wait for a predict's
choice, the widened-stair outline and a C major to A minor redraw, with unit tests and a layout
test; key signatures in both clefs on the staff toy with a signature-only staff in the other clef;
Lesson 12's chord levels, Lesson 6's pair and Lesson 12's sing flow in the kit (count-in on so, no
Move do); `lesson-25/cold-open.ts`; Lesson 21's page registering its quiz questions (this page
imports its question 2); SEASON-2 § 5.2 item 21 (marker, answer bounds, admin rows); the head,
structured data and llms.txt. The predict needs no kit change: `unlocks`, `onChoice`, `onReveal` and
several reveal elements exist, and the page uses them for Step 1 and the Wrap's free play. The
practise links that wait (item 15): the `ear-drill` launch (SEASON-2 § 5.2 item 12), Scale Runner's
harmonic and melodic minor (item 13), and Sight-Singing for the lessons (item 10): (g) a `key`
launch field, which would open Sight-Singing in A harmonic minor straight from the card, (b) a "hear
do" start, (c) the bass clef, (e) letter names off and (f) octave-folded scoring, each removing a
sentence of the card. App content: the four scale descriptions ("Sad and introspective" among them)
are shown on no screen today, so the card may link the Singing tab, but they should change before
any screen shows them (risk 16); and the app's Melodic Minor is the going-up form only, so no card
names it until it has a going-down form.

## Departures from ARTICLE-PLAN.md, and why

1. **Predict**: the lead's, "Each ending has chords, not yet played. In the first, the chord before
   home is E, G and B. The second raises G to G♯. What does that do to the chord?" [It turns major]
   [It stays minor], in place of "which note was raised?" [Te] [Le], which the hook and Lesson 21's
   reveal answered. Tavi's and Merc's cold-open lines changed to match (FACTS 1a, 32, 33).
2. **The tune before the choice is melody only**; its chords play only in the answering plays,
   since a chord heard first answers by ear (FACTS 31, 34).
3. **The cold open is A3 to A4 for everyone**, Merc's register, where the plan had A4 to A5 for the
   higher voice: the voice choice comes later on the page (FACTS 8).
4. **One predict**: the plan's Step 2 predict (le to ti) is a Try and Notice, since the staircase
   shows the wide stair the moment te lifts (FACTS 38).
5. **The chord on so waits for the cold open**: Step 1's Raise te and beads, and the Wrap's free
   play's Raise te, Raise le, beads and chord play, until the choice; Step 1's two sentences on the
   chord, with their play, until the reveal, as its second reveal element; the first-visit tour
   until the choice (FACTS 1a, 36).
6. **Three prerequisite chips** (10, 21, 23), as SEASON-2 § 4.3 lists, where the plan named 23
   alone (FACTS 2).
7. **C minor's flats once in each clef**, on the learner's staff and a signature-only staff in the
   other clef; no E♭ major (lead's answer 2; FACTS 27).
8. **Step 4 says where Lesson 21's rule stops**, in one sentence, and the plan's note that A major's
   three sharps are also F♯ minor's signature is dropped: the page gives relative keys one sentence,
   on C major and A minor, as the lead asked (FACTS 7, 26).
9. **No Move do and no octave** in the sing-along: Lesson 10's four lower leaves 0 room at the
   tenor's and soprano's floors; the line already sits 4 or more inside every preset (FACTS 42, 43).
10. **Go deeper keeps "Do or la?"** (with la-based si, sourced) and drops "For instrumentalists",
    whose second sentence has no source (FACTS 28).
11. **Practice card**: Gravity's text says what Gravity really does (a major key's cadence, any of
    twelve notes) and that a Te-against-Ti drill isn't in the app yet (lead's answer 3; FACTS 48,
    49). Its second drill is Sight-Singing set to A harmonic minor through the Singing tab, where
    the plan linked the Singing tab itself: the picker plays nothing, and the app's Melodic Minor is
    going-up only (FACTS 52, 53). The card says what the drill does (no do first, treble only, the
    octave as written, the names printed) and has a rest version in Lesson 12's form.
12. **Quick check**: Q1's third feedback (the plan's pointed at a step that never raises me); Q2's
    correct feedback (the plan's "pulls to do" has no source); Q3's third answer A major for E minor
    (E minor's sharp is not taught); Q4's stem, since it offers three answers (FACTS 66 to 69).
13. **Wording**: the plan's sound gate and promise are kept; Tavi's two plan lines lose their
    opening "So" (FACTS 10); "white keys" becomes "white piano keys".
14. **Lesson 26's tease**: the lead's default, the plan's line mended as the alternative (FACTS 5).

## Citations of uncommitted lessons, made in words

- Lesson 24's recall asks Lesson 10's question 1 (FACTS 1a, 7).
- Lesson 24's chips, as the model for this page's three (FACTS 2).
- Lesson 24's card and its claim that its `plan` tease is true of its Step 2 (FACTS 5b).
- Lesson 24's page holds the drone, which the mended Lesson 26 alternative names (FACTS 5).
- Lesson 26's package draws the still in this card's slot (FACTS 5, LESSON.md next card, WEB-SPEC
  Toys 8). Lesson 26's planned opening and predict are cited by path from its ARTICLE-PLAN.md
  (lines 27-36), which the lead confirmed is committed on the branch.
- Lesson 21's page and its quiz-question object for question 2, which do not exist in code yet
  (FACTS 7; WEB-SPEC item 11). Its words are cited from Lesson 21's committed LESSON.md.

## For the lead or the owner to decide

None open. On 2 November 2026 the lead bound both teases with their alternatives, kept Sight-Singing
in A harmonic minor as the second drill (with S5, S6 and S7 taken), and chose the head title,
"Harmonic and melodic minor, relative keys | MercuryPitch"; the alternative title is gone.

For the vocal coach (not blocking the lead): the two figures and their range, no Move do, the
"tay"/"tee" syllables, "Listen for ti leaning up to do.", and Sight-Singing's card lines, with its
notes anywhere in the saved preset, floor and top included, and its F to G♯ step in A harmonic
minor.
