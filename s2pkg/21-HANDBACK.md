# Lesson 21, "Keys and the circle of fifths": hand-back

Files, written in the worktree and copied to the scratchpad's `s2pkg/21/`:

- `/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/21-keys-circle/FACTS.md`
- `/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/21-keys-circle/LESSON.md`
- `/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/21-keys-circle/WEB-SPEC.md`

RESEARCH.md and ARTICLE-PLAN.md are untouched. No git, no builds; nothing outside the folder was
edited.

**Word count**: 2,198 words of learner copy on `node scripts/lesson-words.mjs`, 181 under the cap of
2,379; steps' own text 116, 119, 120, 120 and 110. A built page's hints add about 150, so about
2,348, still 31 under: no cut needed. **Step 5 stays in the page** (2,198 is under the brief's
2,230), and FACTS 3 says why: it carries T29 and the second half of the card's signature, and
Quick check 4 and the Wrap's last line rest on it. The stated counts in FACTS 3 and WEB-SPEC Length
match the counter in the golden test's form (checked with the test's own `countLesson`).

**plan-cites**: `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/21-keys-circle`
reads 200 citations, 0 findings.

## Entries for the shared files

### MASTER-PLAN § 11

- Lesson 21: a written lesson, text only, in
  [`lessons/21-keys-circle/`](lessons/21-keys-circle/) (research, article plan, facts, copy and page
  spec). Its unscored sing-along waits on the vocal coach's look (§ 12 item 8). No page is built yet:
  it waits on Season 2's kit (seasons, the staff toy with both clefs and key signatures, the
  circle-of-fifths toy and Lesson 4's staircase moved into the kit, SEASON-2 § 6.2 items 1, 2 and 4)
  and on the lesson plumbing for Lessons 15 to 28 (SEASON-2 § 5.2 item 21). It goes live when the
  console publishes it, after the coach's look and once `/learn/06` and `/learn/15`, the pages its
  chips and its recall link to, are live.

(After the review and fix pass: "reviewed once and fixed", as Lessons 15 and 17 read.)

### CURIOSITY-MOMENTS

### Lesson 21 · Keys and the circle of fifths · theory; written; no page yet · hook kept

- **Opening:** Lesson 2's ring of twelve beads over Lesson 1's keyboard, G major lit on both and its
  one black key, F♯, glowing; Play G major works before a choice. Merc "D is a fifth above G. D major
  keeps G's F♯, and it needs one sharp more." Tavi "F, then the next letter up. Isn't the new sharp
  G♯?" Predict: "Which note does D major add as its second sharp?" [G♯, the next letter after F]
  [C♯, the note just below do]. Play D with G♯ and Play D with C♯ unlock with the choice; the reveal
  waits until both are heard, and the page's tour waits for the choice, since Step 1's stage shows
  G major's ti (Lesson 21 FACTS 1a, 36).
- **Visual:** the ring (exists) threaded by fifths into the circle-of-fifths toy, with the house,
  Step round · Step back and Pure · Equal (new, SEASON-2 § 6.2 item 4); the staff toy with key
  signatures at each clef's places (new, § 6.2 item 2 extended); Lesson 4's staircase with White keys
  only (exists, moves into the kit). **Payoff:** Step 2, where the house steps from C to A and the
  signature gains a sharp at each step; Step 5, where twelve pure fifths miss C by 23.46 cents and
  equal temperament closes the ring; the checkpoint, so, la, ti, do in C, then in G, sung along a
  guide on the learner's own staff, unscored.
- **Tease:** a still of Lesson 5's band with a pitch line waving across both its edges and no centre
  line, which does not play: "Merc holds one note, and its line swings past both edges of the band."
  The plan's line, cut to fit a card, is the alternative `nudged`: "Each fifth is nudged two cents. A
  held note can move far more." Lesson 21's own tease, on Lesson 20's card, is "G major: seven notes,
  one black key, F♯. Now step up a fifth.", with Lesson 20's planned line, cut to fit, as the
  alternative `lesson-4`: "Lesson 4 slid the scale to G, with one sharp, and to D, with two."
  (Lesson 21 FACTS 5 and 5b; proposed for the lead.)
- **Facts:** sourced in Lesson 21's FACTS: the pattern, one letter per degree, the orders of sharps
  and flats, finding do and the circle (Open Music Theory 2e, 1.12; Ewell and Schmidt-Jones, 1.7 and
  1.8; Lesson 4's Hutchinson and Mount), the reading scope (ABRSM 2023), where a signature's signs
  sit in each clef (VexFlow 5.0.0, the app's notation library), the comma and equal temperament
  (arithmetic; Wolfe 2011; Rubinstein's cents figure only); the app at `c60f0fdcb`. The circle's
  history is left out until Jensen 1992 is read.

### `kit/season.ts` (Season 2's data module)

```ts
  {
    n: 21,
    lane: 'theory',
    title: 'Keys and the circle of fifths',
    short: 'Circle of fifths',
    topics: ['T17', 'T18', 'T29'],
    // A draft until the vocal coach's look at Sing it (drafts.ts).
    minutes: 16,
    page: '/learn/21',
    hook: 'G major needs one sharp and D major two. Why does each key a fifth up keep its sharps and add one?',
    pr: {
      needs:
        'A note-reading drill that reads key signatures, and Sight-Singing that spells by key',
      link: {
        href: '/?lesson=21#/compose',
        addr: 'mercurypitch.com/#/compose',
        label: 'Compose',
        note: 'then choose Sheet Music',
      },
    },
  },
```

- `minutes` and `page` only once the page is built. No `fig` (no figure, as Lesson 14's card).
- `TOPICS` gains T17 "Keys, key signatures, transposition", T18 "Circle of fifths" and T29 "Tuning
  systems: why twelve, equal temperament" (SEASON-2 § 4.1).
- Prerequisites: `EDGES` gains [6, 21] and [15, 21] (SEASON-2 § 4.3, row 21); `PREREQ[21]` is then
  [6, 15]. Lesson 13 is "Also useful", a plain chip, not an edge.
- The short name is proposed ("Keys" alone reads like a keyboard's keys); the lead decides.

### `kit/lesson-copy.ts` and `kit/team-notes.ts`

The hook is the season entry's, word for word; no `hookAlts`.

```ts
  21: {
    tease: 'G major: seven notes, one black key, F♯. Now step up a fifth.',
    teaseAlts: [
      { id: 'lesson-4', text: 'Lesson 4 slid the scale to G, with one sharp, and to D, with two.' },
    ],
  },
  22: {
    tease: 'Merc holds one note, and its line swings past both edges of the band.',
    teaseAlts: [
      { id: 'nudged', text: 'Each fifth is nudged two cents. A held note can move far more.' },
    ],
  },
```

61, 65, 69 and 62 characters, all inside `TEASE_MAX` (70). Team notes:

- `SIGNATURES[21]`: "Lesson 2's ring of twelve beads, threaded by fifths; the house walks round it and each step adds
  a sharp to the signature beside it, the flats the other way; then twelve pure fifths miss by 23.46
  cents, and equal temperament closes the ring."
- `TEASE_NOTES[21]['lesson-4']`: "Lesson 20's planned line, cut to fit a card. It recalls Lesson 4's
  G and D rather than setting up this lesson's opening, so it is the alternative."
- `TEASE_NOTES[22]['nudged']`: "The season plan's line, cut to fit a card. Its first sentence is
  Lesson 21's Step 5, and it sets up Lesson 22's hook more than its opening, so it is the
  alternative."

Lesson 22's tease needs Lesson 22's season entry to exist before `team-notes.test.ts` will accept
its note; Lesson 22's writer should check the line against Lesson 22's final predict.

## Kit and app work the page waits for (WEB-SPEC, What the kit and the app still need)

1. Seasons in the kit (SEASON-2 § 6.2 item 1), with `TOPICS` gaining T17, T18 and T29.
2. The head: title "Key signatures and the circle of fifths | MercuryPitch" (54), description the
   hook and "A 16-minute lesson on keys and the circle of fifths." (151), share card of the hero's
   ring with G major lit and no D major.
3. Key signatures on the staff toy (§ 6.2 item 2, extended): signs at each clef's places (FACTS 21),
   spelling by key, a signature that grows a sign at a time, Spell it: A♯ · B♭.
4. The circle-of-fifths toy (§ 6.2 item 4), grown from the spiral's top view: twelve key names (the
   bottom three with two), the house, Step round · Step back, Pure · Equal with the gap.
5. Lesson 4's staircase moved into the kit, with starts outside C4 to B4 (G2, G4 here).
6. Lesson 15's sing-along taking two runs with a key change and a second count-in (the count-in
   already plays any note).
7. Lesson 15's page first: the recall imports its `l15-q2` and slot.
8. The lesson plumbing (SEASON-2 § 5.2 item 21).
9. For the lead: SEASON-2 § 5.1's row 21 names the Singing tab's key picker and sheet view; the
   package links Compose instead (below).

## Departures from ARTICLE-PLAN.md, and why

1. **Sing-along so, la, ti, do in C, then in G** (the plan's alternative, the lead's decision):
   every note at least 2 semitones inside every preset; the card's do re mi fa so in C starts on the
   tenor's and soprano's floors (FACTS 54, with the table; LESSON.md's coach list).
2. **Recall 1 is Lesson 6's question 2** (the fifth's size, which T18 needs), not question 1 (FACTS
   7).
3. **Practice card opens Compose, in Sheet Music, not the Singing tab**: at `c60f0fdcb` the Singing
   tab's key picker is view-only (the tune does not move, so its sheet view would write C major
   under G's signature), and on a phone held upright the Singing tab has no sheet view at all; in
   Compose the picker moves the tune and Sheet Music writes the signature (FACTS 41, 42). Ear Lab's
   Home stays as the second drill.
4. **Hero plays G3 and D4 for everyone** (a fifth apart, as Merc says; no staff, no singing), not by
   the stored voice (FACTS 34).
5. **Reveal waits for both D major plays; tour waits for the choice** (FACTS 1a, 36).
6. **Step 1's toy is Lesson 4's staircase with White keys only**, for the plan's black-key toggle.
7. **Step 3's heading is a question**, "Where do the flats come from?", for "And the flats?".
8. **The guide counts in twice**, on so and on the new so, since run 2 starts a seventh below run 1's
   last note (FACTS 56).
9. **Tease to Lesson 22 is new**; the plan's (107 characters) is cut to fit as the alternative (FACTS
   5). **Own tease proposed anew**; Lesson 20's planned line (79 characters) cut to fit as the
   alternative (FACTS 5b).
10. **Signature places rest on the app's notation library** (VexFlow 5.0.0), since no textbook text
    read gives them in words (FACTS 21, graded Moderate).
11. Smaller ones (FACTS 4): the lock line ("unlock D major, played both ways"); Merc's and Tavi's
    wording; the reveal's fair-guess line; Lesson 15's sing speed (1.2 s a note) for the plan's 0.8
    s; Lesson 15's "Just listen today" and Season 1's voice buttons, not Lesson 10's form or buttons
    named by clef; the Easy and Workable line; "so" kept for the syllable (mix-up belief, Quick check
    1 and 2 reworded); Go deeper keeps one item (the pentatonic and C major as circle neighbours);
    why-twelve by 7/12, the circle's history and the mnemonics are left out (FACTS 68 to 70).

## Questions for the lead and the owner

1. **The two teases** (FACTS 5, 5b): proposal or alternative, for each.
2. **The short name on the map**: "Circle of fifths" (proposed) or "Keys".
3. **SEASON-2 § 5.1 row 21**: update it to Compose (the Singing tab's picker changes only the view);
   § 1.1 and § 7 item 13 can also say the ABRSM comparison is now checked (RESEARCH, contradiction 1).
4. **Lesson 4 overlap**: Lesson 4's page already says D major needs F♯ and C♯ and "from D, ti is
   C♯", so a learner who remembers it knows the predict's answer; the package keeps the plan's
   predict (it asks for the reason) and leaves Lesson 4's question 2 out of the recall (FACTS 1a).
   Say if a different predict is wanted.
5. **For the vocal coach**: the key and notes (least room 2 semitones, at the tenor's and soprano's
   floors), and the line "If the second run starts low for you, join in on ti." (LESSON.md, For the
   vocal coach).
