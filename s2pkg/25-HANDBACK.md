# Lesson 25, Minor, properly: hand-back

Package: `docs/plans/find-your-pitch/lessons/25-minor-properly/` in the worktree `/dev/shm/s2plan`
(FACTS.md, LESSON.md, WEB-SPEC.md, new; RESEARCH.md and ARTICLE-PLAN.md untouched), each copied to
the scratch folder `s2pkg/25/` after every save. No shared file, no code and no other lesson's
file was touched; no git was run.

## Counts

- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/25-minor-properly`: 0
  findings, 288 citations read.
- `node scripts/lesson-words.mjs`: 2,117 words, cap 2,379, 262 under; steps' own text 118, 104, 117
  and 120 (inside 50 to 120). Built page about 2,270 with its hints written out.
- Chip: 15 minutes (2,117 / 238 = 8.89 min reading + about 5.73 min of sound, toys and tasks).
- Head description: "Why does a minor key often raise one note just before it comes home? A
  fifteen-minute lesson with sound toys: harmonic and melodic minor, and relative keys." 156
  characters. Head title "Harmonic and melodic minor, relative keys | MercuryPitch", 56.

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

- **Opening:** Lesson 10's minor staircase on A, A3 to A4, the house on do, between Merc and Tavi;
  Play the tune, twice works before the choice and plays a four-bar tune written for the lesson as a
  melody alone, its second ending's G raised to G♯, the te stair lifting to ti as it sounds. Tavi
  "It's still a minor key. Won't the chord before home stay minor?" Merc "Choose, and we'll play
  each ending with its chords." Predict: "Under the first ending, the chord before home is E, G and
  B. The second ending raises G to G♯. What does that do to the chord?" [It turns major] [It stays
  minor]. The answering plays, the last two bars of each ending with their chords, draw the chord
  column, its gaps 3 and 4 or 4 and 3; the reveal waits for both. A reasoning check on Lesson 10's
  thirds, the lead's: the plan's predict, which note was raised, was answered by the hook's "just
  before it comes home" and by Lesson 21's reveal (Lesson 25 FACTS 1a, 31, 33).
- **Visual:** Lesson 10's chord beads and their staircase (moved into the kit) beside the staff toy:
  Raise te, the le-to-ti stair widened to three semitones, Raise le going up only, and in Step 4 the
  staircase redrawn from C major to A minor, the house moving from C to A under one empty
  signature, then C minor's three flats in each clef; the chord on so held back until the choice.
  **Payoff:** Step 1's chord on so turning major as te rises; Step 3's melodic minor; Step 4's house
  moving; the sing-along, so, te, do, then so, ti, do in A minor, unscored.
- **Tease:** on Lesson 24's card, the lead's "A minor tune, played twice. The second ending changes
  one note.", with Lesson 24's planned line as the alternative `plan`. On this page's card, Lesson
  26's: the lead's "‘Twinkle’, and the same tune four semitones higher, played together.", with the
  plan's line mended as the alternative `plan`, "Lesson 24's other part was a drone. What if it's a
  tune?"; the plan's own line is withdrawn (Lesson 25 FACTS 5, 5b).
- **Facts:** sourced in Lesson 25's FACTS: the three forms, closure, the chord on so, relative and
  parallel keys (Open Music Theory 2e, 1.13 and 4.02), the augmented second as hard to sing
  (Sharkey, Sierra College, 5.2.3), ti's and te's sounds and la-based minor's si (Wikipedia,
  Solfège, at a named revision); the app at `c60f0fdcb`. No mood is claimed for any form of minor.

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
    needs: "Gravity with only Te and Ti (the ear-drill launch kind); Scale Runner's harmonic and melodic minor",
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
  drone; it names no note and no chord quality of this lesson's opening."
- 26 `plan`: "Lesson 25's planned line, mended: its 'So far the other part was a drone' was false on Lesson
  25's page, where chords move under the cold open's tune."

`SIGNATURES[25]`: "Lesson 10's minor staircase: te slides up to ti, le to ti opens into a wider stair,
then le rises too, going up only."

`kit/drafts.ts`: `25: "Lessons 10, 21 and 23's pages at /learn/10, /learn/21 and /learn/23, and the
vocal coach's look at the sung checkpoint and the sung drill",`

### Teases checked

- **This lesson's (on Lesson 24's card):** the lead's line still fits the final opening (one tune
  played twice, the second ending raising one note); it names no note, stair or chord and not what
  the change does. 63 characters. The alternative, 65, answers nothing either.
- **Lesson 26's (on this card):** the plan's alternative, "So far the other part was a drone. What
  if it's a tune?", is **not true on this page**: the cold open's answering plays and Step 1 put
  moving chords under or after the tune, so the other part here is not a drone (Lesson 24's page has
  the drone). Proposed mend, 56 characters, as the `plan` variant: "Lesson 24's other part was a
  drone. What if it's a tune?" It also drops "So far", since this page keeps "so" for the syllable.
  The lead's default (68) is true and answers nothing of Lesson 26's predict.

## Kit and app work the page waits for

WEB-SPEC, What the kit and the app still need, items 1 to 17. In short: the lesson host and the
draft line; seasons in the kit; Lesson 10's chord beads and staircase moved into the kit with Raise
te, Raise le, the widened-stair outline, a chord on so and a C major to A minor redraw; key
signatures in both clefs on the staff toy with a signature-only staff in the other clef; Lesson 12's
chord levels, Lesson 6's pair and Lesson 12's sing flow in the kit (count-in on so, no Move do);
`lesson-25/cold-open.ts`; Lesson 21's page registering its quiz questions (this page imports its
question 2); SEASON-2 § 5.2 item 21 (marker, answer bounds, admin rows); the head, structured data
and llms.txt; the `ear-drill` launch (item 12) and Scale Runner's harmonic and melodic minor (item
13), which change the card when they ship. App content: the four scale descriptions ("Sad and
introspective" among them) are shown on no screen today, so the card may link the Singing tab, but
they should change before any screen shows them (risk 16); and the app's Melodic Minor is the
going-up form only, so no card names it until it has a going-down form.

## Departures from ARTICLE-PLAN.md, and why

1. **Predict**: the lead's, "what does G to G♯ do to the chord before home?" [It turns major] [It
   stays minor], in place of "which note was raised?" [Te] [Le], which the hook and Lesson 21's
   reveal answered. Tavi's and Merc's cold-open lines changed to match (FACTS 1a, 32, 33).
2. **The tune before the choice is melody only**; its chords play only in the answering plays,
   since a chord heard first answers by ear (FACTS 31, 34). The stage is A3 to A4 for everyone (the
   voice choice comes later), not A4 to A5 for the higher voice (FACTS 8).
3. **One predict**: the plan's Step 2 predict (le to ti) is a Try and Notice, since the staircase
   shows the wide stair the moment te lifts (FACTS 38).
4. **Step 1's chord on so is held back until the choice**, with the first-visit tour (FACTS 36).
5. **Three prerequisite chips** (10, 21, 23), as SEASON-2 § 4.3 lists, where the plan named 23
   alone (FACTS 2).
6. **C minor's flats once in each clef**, on the learner's staff and a signature-only staff in the
   other clef; no E♭ major (lead's answer 2; FACTS 27).
7. **No Move do and no octave** in the sing-along: Lesson 10's four lower leaves 0 room at the
   tenor's and soprano's floors; the line already sits 4 or more inside every preset (FACTS 42, 43).
8. **Go deeper keeps "Do or la?"** (with la-based si, sourced) and drops "For instrumentalists",
   whose second sentence has no source (FACTS 28).
9. **Practice card**: Gravity's text says what Gravity really does (a major key's cadence, any of
   twelve notes) and that a Te-against-Ti drill isn't in the app yet (lead's answer 3; FACTS 48,
   49). Its second drill is Sight-Singing set to A harmonic minor through the Singing tab, where the
   plan linked the Singing tab itself: the picker plays nothing, and the app's Melodic Minor is
   going-up only (FACTS 52, 53). Rest version in Lesson 12's form.
10. **Quick check**: Q1's third feedback (the plan's pointed at a step that never raises me); Q2's
    correct feedback (the plan's "pulls to do" has no source); Q3's third answer A major for E minor
    (E minor's sharp is not taught); Q4's stem, since it offers three answers (FACTS 66 to 69).
11. **Wording**: the plan's sound gate and promise are kept; Tavi's two plan lines lose their
    opening "So" (FACTS 10); "white keys" becomes "white piano keys".
12. **Lesson 26's tease**: the lead's default, the plan's line mended as the alternative (FACTS 5).

## Citations of uncommitted lessons, made in words

- Lesson 24's recall asks Lesson 10's question 1 (FACTS 1a, 7).
- Lesson 24's chips, as the model for this page's three (FACTS 2).
- Lesson 24's card and its claim that its `plan` tease is true of its Step 2 (FACTS 5b).
- Lesson 24's page holds the drone, which the mended Lesson 26 alternative names (FACTS 5).
- Lesson 26's package draws the still in this card's slot (FACTS 5, LESSON.md next card, WEB-SPEC
  Toys 8). Lesson 26's planned opening and predict are cited by path from its ARTICLE-PLAN.md
  (lines 27-36), a planning file; please confirm it is committed.
- Lesson 21's page and its quiz-question object for question 2, which do not exist in code yet
  (FACTS 7; WEB-SPEC item 11). Its words are cited from Lesson 21's committed LESSON.md.

## For the lead or the owner to decide

1. **The teases** (FACTS 5, 5b): bind the lead's defaults, and accept or replace the mended Lesson
   26 alternative.
2. **The second drill** (WEB-SPEC, Decisions 2): keep Sight-Singing in A harmonic minor
   (recommended: the only drill that has the learner meet G♯ in minor; it needs the Singing tab
   first and plays no do), or Gravity alone, which saves about 110 words.
3. **Head title**: "Harmonic and melodic minor, relative keys | MercuryPitch" (56), or "The three
   minor scales and relative keys | MercuryPitch" (55).
4. For the vocal coach (not blocking the lead): the two figures and their range, no Move do, the
   "tay"/"tee" syllables, "Listen for ti leaning up to do.", and Sight-Singing's card lines.
