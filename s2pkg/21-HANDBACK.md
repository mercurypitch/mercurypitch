# Lesson 21, "Keys and the circle of fifths": hand-back (after the fix pass)

Files, written in the worktree and copied to the scratchpad's `s2pkg/21/` after each save:

- `/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/21-keys-circle/FACTS.md`
- `/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/21-keys-circle/LESSON.md`
- `/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/21-keys-circle/WEB-SPEC.md`

RESEARCH.md and ARTICLE-PLAN.md are untouched. No git, no builds; nothing outside the folder was
edited.

**Word count**: 2,139 words of learner copy on `node scripts/lesson-words.mjs`, 240 under the cap of
2,379; steps' own text 116, 111, 115, 120 and 110. This page's own hint and status lines, counted
from the stage directions and the toys, come to about 175, so the built page lands at about 2,314,
some 65 under the cap. **Step 5 stays in the page.** The chip now reads **15 minutes** (8.99 minutes
of reading plus 6.42 of sound and tasks, 15.40). The stated counts in FACTS 3 and WEB-SPEC Length
match the counter in the golden test's form (checked with the test's own `countLesson`).

**plan-cites**: `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/21-keys-circle`
reads 209 citations, 0 findings.

## Review response

The review (0 blocking, 7 should fix, 14 nits) and the lead's calls, each in turn.

1. **Pure walk drawn short of C** (should fix): fixed as the lead asked. On Pure the thread runs on
   clockwise past C by the gap, labelled "23.46 cents", in LESSON.md's Step 5 toy line, WEB-SPEC
   Look and Toys 3, and Tests 4, which now checks that the gap is drawn past C. FACTS 31 says the
   walk ends past C, not short of it.
2. **"Now play the other one." after replaying the free play** (should fix): fixed as the lead
   asked. `next` is dropped; "Locked in. Play A major both ways." stays until the reveal (LESSON.md's
   stage direction, WEB-SPEC Toys 5, FACTS 36, which gives the kit's reason and Lesson 19's
   precedent). Tests 3 now plays D major again after the choice and checks the hint. No kit change.
3. **Circle beads past three sharps or flats** (should fix): fixed as the lead asked. The house
   moves only within three sharps and three flats: C to A in Step 2 (Step round stops at A, Step
   back at C), C to E♭ in Step 3, E♭ to A in free play, the stops `aria-disabled` as Move do's are.
   The five beads past that range (E, B or C♭, F♯ or G♭, C♯ or D♭, A♭) are drawn and named, dimmed,
   and take no tap: nothing plays and no signature shows; the bottom three carry both names, and the
   group's description names them for a screen reader (WEB-SPEC Toys 3, Edge cases, Tests 4, kit
   item 5).
4. **White keys only under a key signature** (should fix): fixed as the lead asked. With White keys
   only on, the staff drops the signature and writes G A B C D E F G plain, no sign on F; switched
   off, the next G major play writes F♯ with its sharp and moves it into the signature as the scale
   ends. No natural sign is drawn (WEB-SPEC Toys 1, kit item 4, Tests 1, Contract; LESSON.md's Step 1
   toy line).
5. **The built page's margin** (should fix): fixed. The page is cut from 2,198 to 2,139 words: Step
   2's Go deeper drawer (its item stays in FACTS 27), Step 2's last line (Step 4 says it again),
   Step 3's spelled-out F major (the mix-up card and the toy show it), the predict's choice labels
   (now the bare notes), and the guide's line (nit 12); the chips' full titles (nit 8) add 5. FACTS
   3 and WEB-SPEC Length now count this page's own hints, about 175, in place of Lesson 8's 150, and
   put the built page at about 2,314. Step 5 stays. The reviewer's other named cut, the reveal's last
   sentence, is kept in reserve (Length).
6. **The predict's answer is in Lesson 4** (should fix): fixed as the lead decided. The predict asks
   which note A major adds as its third sharp. The hero lights D major (two black keys glowing) and
   plays it from D4; Merc: "A is a fifth above D. A major keeps D's F♯ and C♯, and it needs one sharp
   more."; Tavi: "F♯, then C♯. Isn't the new sharp D♯, the letter after C?"; choices [ D♯ ] [ G♯ ],
   the bare notes, as Lessons 15, 17 and 19 give theirs, so neither label leans towards the answer;
   plays A with D♯ and A with G♯, from A4; the reveal says the same thing one key later. Title and
   every step unchanged; the challenge now asks why A major's third sharp is G♯. Rechecked: the
   notes and steps (`verify21.py` section 20: A with D♯ runs 2 2 2 1 2 1 2, A with G♯ is the pattern,
   D4 to A4 is 7 semitones), the timings (3 × 3.15 s, unchanged), the frequencies (FACTS 60, 61). The
   leak check is redone in FACTS 1a: the title, promise, gate, head, share card (now D major lit, no A
   major), structured data, llms.txt line, both teases, the step headings and the menu card, the
   section headings, the recall and the four words name no A major sharp and no ti; Step 1 shows the
   rule and Step 2 names G♯, so the tour hold stays. Lesson 21's own tease changes with the hero (see
   below).
7. **"Key" for a piano key** (should fix): fixed as the lead asked. "Piano key" in Tavi's Step 3
   line, the mix-up card's belief and its "why it seems right", and Quick check 3's feedback; the
   better idea now ends "The key decides which name the note takes."; Step 5's "Counting keys" is now
   "Counting semitones". "Black key" and "white keys" stay, Season 1's terms, which cannot be read as
   a scale (FACTS 22 records the card's wording change).
8. **The chips** (nit): taken. "After Lesson 6: Intervals: the distance between notes · After Lesson
   15: The staff: where notes sit · Also useful: Lesson 13, Vowels", as the built pages print them
   (FACTS 2, citing `learn/09.html` and `learn/08.html`).
9. **Frequency lists** (nit): taken. FACTS 60 adds B♭5, B5, C6 and D6 (Find do's top answers) and
   D♯5 (the hero); FACTS 31 lists the walk's thirteen frequencies.
10. **Unstated note lengths** (nit): taken: 0.27 s for Step 2's scales and 0.25 s for the semitones
    word (FACTS 62, 63; WEB-SPEC Audio).
11. **"F major's fourth note, B"** (nit): taken: "the fourth note from F, B".
12. **The guide's line** (nit): taken, reworded shorter than the reviewer's: "The guide counts you in
    on so before each run, and a line sweeps along the notes."
13. **The coach list's feeling question** (nit): taken: "asked each time the guide runs to its end".
14. **The stairs' syllable hold** (nit): taken: the hold is dropped, since Step 1's text and caption
    name ti; FACTS 1a and Toys 1 say the tour's hold is what protects a first visit.
15. **Citing the brief** (nit): taken. The lesson files now cite "the lead's decision of 1 November
    2026" (the sing-along) or "the lead's decision at review" (the predict, the length, "piano key"),
    and give the reason for the length target. Request below for SEASON-2 § 3's card.
16. **The alternative tease's number** (nit): taken: FACTS 5 now rests "far more than two cents" on
    Lesson 22's plan (Merc's ±50 cents, `ARTICLE-PLAN.md:27-28`) with Sundberg's ceiling (R3), not
    Timmers and Desain.
17. **Structured data and llms.txt** (nit): taken: `timeRequired` `PT15M`, four `teaches` items and
    the llms.txt line, each checked against the predict (WEB-SPEC kit item 2; FACTS 1a).
18. **Note colours for the soft tone** (nit): taken, but resolved as Lesson 15's Look does rather
    than by clef colour: noteheads, beads and keys chrome at rest and ink while the soft tone sounds
    them; amber while the voice sings in Sing it; blue and orange only for Merc's and Tavi's bubbles
    and stills. That keeps "Lesson 15's look, unchanged" true.
19. **FACTS 40's source** (nit): taken: Compose's sidebar from `sidebar-registry.ts:118`; the panel's
    setting (`PlaybackSetupPanel.tsx:35`, `settings-store.ts:677-678`, its switch in Settings); a new
    edge case for Playback Setup turned off.
20. **Octaves stay pure** (nit): taken: FACTS 32 now says equal temperament keeps every octave at
    exactly 2 to 1 (Lesson 1 FACTS 7; the formula), used by Quick check 4's feedback.
21. **Test 8 and the Contract's leak line** (nit): taken: Test 8 checks G♯, "ti" and "just below do"
    in the head, share card, structured data, title, promise, gate, menu card and list, step and
    section headings, recall and four words, and exempts the predict's own choices and locked plays
    and the tour-held stages; the Contract line matches.
- **The smaller points**: taken. FACTS 3 no longer lists the step counts twice; Find do, the
  predict's small staircases and the four words' figures are now kit item 7, with the lesson host,
  the draft line and the no-decorative-staff work as items 3 and 9.

Nothing in the review was left.

Beyond the findings, two consequences of the fixes: the chip moves from 16 to 15 minutes (FACTS 3,
WEB-SPEC, the season entry, the description and `PT15M`); and the Toys numbering loses the Go deeper
drawer, so the tease still is now Toys 9.

## Entries for the shared files

### MASTER-PLAN § 11

- Lesson 21: a written lesson, text only, reviewed once and fixed, in
  [`lessons/21-keys-circle/`](lessons/21-keys-circle/) (research, article plan, facts, copy and page
  spec). Its unscored sing-along waits on the vocal coach's look (§ 12 item 8). No page is built yet:
  it waits on Season 2's kit (seasons, the staff toy with both clefs and key signatures, the
  circle-of-fifths toy and Lesson 4's staircase moved into the kit, SEASON-2 § 6.2 items 1, 2 and 4)
  and on the lesson plumbing for Lessons 15 to 28 (SEASON-2 § 5.2 item 21). It goes live when the
  console publishes it, after the coach's look and once `/learn/06` and `/learn/15`, the pages its
  chips and its recall link to, are live.

### CURIOSITY-MOMENTS

### Lesson 21 · Keys and the circle of fifths · theory; written; no page yet · hook kept

- **Opening:** Lesson 2's ring of twelve beads over Lesson 1's keyboard, D major lit on both and its
  two black keys, F♯ and C♯, glowing; Play D major works before a choice. Merc "A is a fifth above
  D. A major keeps D's F♯ and C♯, and it needs one sharp more." Tavi "F♯, then C♯. Isn't the new
  sharp D♯, the letter after C?" Predict: "Which note does A major add as its third sharp?" [D♯]
  [G♯]. Play A with D♯ and Play A with G♯ unlock with the choice; the reveal waits until both are
  heard, and the page's tour waits for the choice, since Step 1's stage shows the rule and Step 2
  names G♯. The plan asked for D major's second sharp, which Lesson 4's page already gives ("from D,
  ti is C♯"), so the lead moved the predict one key on at review (Lesson 21 FACTS 1a, 35, 36).
- **Visual:** the ring (exists) threaded by fifths into the circle-of-fifths toy, with the house,
  Step round · Step back within three sharps and three flats, and Pure · Equal (new, SEASON-2 § 6.2
  item 4); the staff toy with key signatures at each clef's places (new, § 6.2 item 2 extended);
  Lesson 4's staircase with White keys only (exists, moves into the kit). **Payoff:** Step 2, where
  the house steps from C to A and the signature gains a sharp at each step; Step 5, where twelve
  pure fifths run past C by 23.46 cents and equal temperament closes the ring; the checkpoint, so,
  la, ti, do in C, then in G, sung along a guide on the learner's own staff, unscored.
- **Tease:** a still of Lesson 5's band with a pitch line waving across both its edges and no centre
  line, which does not play: "Merc holds one note, and its line swings past both edges of the band."
  The plan's line, cut to fit a card, is the alternative `nudged`: "Each fifth is nudged two cents. A
  held note can move far more." Lesson 21's own tease, on Lesson 20's card, is "D major: seven notes,
  two black keys, F♯ and C♯. Now step up a fifth.", with Lesson 20's planned line, cut to fit, as the
  alternative `lesson-4`: "Lesson 4 slid the scale to G, with one sharp, and to D, with two."
  (Lesson 21 FACTS 5 and 5b; for the lead to settle at review.)
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
    minutes: 15,
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

### `kit/lesson-copy.ts` and `kit/team-notes.ts`

The hook is the season entry's, word for word; no `hookAlts`. Both versions of each tease, for the
lead to settle at review:

```ts
  21: {
    tease: 'D major: seven notes, two black keys, F♯ and C♯. Now step up a fifth.',
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

69, 65, 69 and 62 characters, all inside `TEASE_MAX` (70). Team notes:

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

1. Seasons in the kit, with `TOPICS` gaining T17, T18 and T29.
2. The head (title 54 characters; description 151, "A 15-minute lesson ..."), the share card of
   the hero's ring with D major lit and no A major, the structured data (`PT15M`, four `teaches`) and
   the llms.txt line.
3. The lesson host and the draft line, as Lesson 15's.
4. Key signatures on the staff toy (§ 6.2 item 2, extended): signs at each clef's places, spelling by
   key, a signature that grows a sign as a scale ends and drops under White keys only, Spell it; no
   natural sign.
5. The circle-of-fifths toy (§ 6.2 item 4), the house within three sharps and three flats, the other
   five beads named but not buttons, the gap drawn past C.
6. Lesson 4's staircase moved into the kit, with starts outside C4 to B4 (G2, G4 here).
7. This page's own parts: Find do, the predict's small staircases, the four words' figures.
8. Lesson 15's sing-along taking two runs with a key change and a second count-in.
9. No decorative staff, as Lesson 15's item 7.
10. Lesson 15's page first: the recall imports its `l15-q2` and slot.
11. The lesson plumbing (SEASON-2 § 5.2 item 21).
12. For the lead: SEASON-2 § 5.1's row 21 to Compose (the lead's, at commit time), and § 3's card for
    Lesson 21, whose checkpoint still says do re mi fa so, to record the lead's 1 November decision,
    so la ti do in C, then in G.

## Departures from ARTICLE-PLAN.md, and why

1. **The predict asks for A major's third sharp**, not D major's second (the lead's decision at
   review: Lesson 4 already gives C♯), with the bare notes as choices; the hero plays D major from D4
   and A major from A4 for everyone (FACTS 1a, 34, 35).
2. **The reveal waits for both A major plays, the locked-in hint until then; the tour waits for the
   choice** (FACTS 1a, 36).
3. **Sing-along so, la, ti, do in C, then in G** (the plan's alternative, the lead's decision of 1
   November 2026): every note at least 2 semitones inside every preset (FACTS 54).
4. **Recall 1 is Lesson 6's question 2** (the fifth's size, which T18 needs) (FACTS 7).
5. **Practice card opens Compose, in Sheet Music, not the Singing tab**, whose key picker is
   view-only and which has no sheet view on an upright phone (FACTS 41, 42).
6. **Step 1's toy is Lesson 4's staircase with White keys only**; Step 3's heading is a question.
7. **The guide counts in on so before each run** (FACTS 56).
8. **Both teases are new proposals**, each with the planned line cut to fit as the alternative
   (FACTS 5, 5b).
9. **Signature places rest on the app's notation library** (VexFlow 5.0.0), graded Moderate (FACTS
   21).
10. **Go deeper is cut whole**, for length; none of the plan's four items is on the page (FACTS 3, 27,
    68 to 70).
11. **"Piano key"** wherever "key" means a key on the keyboard (FACTS 22).
12. Smaller ones (FACTS 4): the lock line; the reveal's fair-guess line; Lesson 15's sing speed;
    Lesson 15's "Just listen today" and Season 1's voice buttons; the Easy and Workable line; the
    chips as the built pages print them; "so" kept for the syllable.

## Questions for the lead

1. **The two teases** (FACTS 5, 5b): proposal or alternative, for each; both versions are above.
2. **For the vocal coach** (on the coach's list): the key and notes (least room 2 semitones, at the
   tenor's and soprano's floors), and the line "If the second run starts low for you, join in on ti."
