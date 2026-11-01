# Lesson 23 hand-back: "Perfect, major, minor and the tritone"

Files: `docs/plans/find-your-pitch/lessons/23-perfect-tritone/` FACTS.md, LESSON.md, WEB-SPEC.md in
`/dev/shm/s2plan`, copied to `s2pkg/23/`. RESEARCH.md and ARTICLE-PLAN.md are unchanged. This note
is updated after the fix pass; the review response is section 9.

Checks after the fix pass, run from `/dev/shm/s2plan`:

- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/23-perfect-tritone`:
  285 citations read, **0 findings**.
- `node scripts/lesson-words.mjs .../23-perfect-tritone/LESSON.md`: **2,048 words**, cap 2,379
  (331 under); steps' own text 112, 119, 116, 119 (inside 50 to 120). Built page about 2,200 with
  hints and status lines, under the 2,230 aim; no cuts. Chip: 14 minutes (8.61 reading + about 5.1
  of sound and tasks).

Process notes:

- First pass: four read-only git commands (`log -1`, `cat-file -t`, `show`, `ls-tree`) in
  `/home/user/mercurypitch`, to read `spiral.ts` at `c60f0fdcb`.
- Fix pass: one more, `git -C /dev/shm/s2plan log --oneline -1`, run by reflex while checking the
  branch head, against the instruction. It printed `271dc369a` and changed nothing.
- Nothing else: no other git, no pnpm, no downloads, no shared files or code touched.

## 1. MASTER-PLAN § 11 (proposed line, after Lesson 17's)

- Lesson 23: a written lesson, text only, reviewed once and fixed, in
  [`lessons/23-perfect-tritone/`](lessons/23-perfect-tritone/) (research, article plan, facts, copy
  and page spec). Its unscored sing-along waits on the vocal coach's look (§ 12 item 8). No page is
  built yet: it waits on Season 2's kit (seasons, and the staff toy with both clefs and the
  pitch-line switch, SEASON-2 § 6.2 items 1 and 2, with a new interval state, Lesson 6's interval
  pair and Lesson 12's sing flow moved into the kit) and on the lesson plumbing for Lessons 15 to 28
  (SEASON-2 § 5.2 item 21). It goes live when the console publishes it, after the coach's look and
  once `/learn/06`, the page its chip and its recall link to, is live.

## 2. CURIOSITY-MOMENTS § 2 (proposed entry)

### Lesson 23 · Perfect, major, minor and the tritone · theory; written; no page yet · hook kept

- **Opening:** the pitch line upright between Merc and Tavi, C4 at its foot and C5 at its top, "an
  octave: 12 semitones", nothing drawn between; Play C up to C works before the choice. Tavi "It must
  be G, surely? The fifth sits right in the middle of the scale." Merc "Let's split it both ways and
  listen." Predict: "Which note between the two Cs splits the octave into two equal leaps?" [G] [F♯].
  The answering plays, C, G, C and C, F♯, C, each end with C and the middle note together; the lanes
  draw in and the leaps are counted, 7 and 5, 6 and 6; the reveal waits for both. It is a deliberate
  reasoning check, as the season's card designed it ("the fifth is 7 semitones of 12; the half is
  6"), on Lesson 6's facts; the recall asks Lesson 6's questions 3 and 4, so "7 semitones: a perfect
  fifth" is not printed under the choices. The plan's stage, Lesson 2's ring and a named ruler,
  showed F♯ across from C and in the middle before the choice, and its "exactly in half" could be
  answered G in hertz (Lesson 23 FACTS 1a, 40, 43).
- **Visual:** the staff toy's interval state, the staff and the pitch line side by side, with Sharp,
  Flat, Fold and a curl into Lesson 2's ring (new, on SEASON-2 § 6.2 item 2's staff toy), holding
  back until the choice whatever would sound, draw or read out the answer; Lesson 2's ring (exists:
  the kit's spiral seen from the top). **Payoff:** Step 3's fold, where an interval and its upside
  down fill the octave and the tritone folds onto six semitones again; Step 4's ring, B and F
  straight across, closing into C and E; the sing-along, do up to so and back in D, unscored, then
  ti and fa heard together, closing into do and mi.
- **Tease:** a still of Lesson 24's stage, a drone band on A3 and a line just above it, silent: "A
  drone, and a second note just above it, almost in tune."; the alternative `fifths` is a mended
  form of the plan's line, "Fifths sound settled; the tritone leans. Next, a note against a drone.",
  and the plan's own line is withdrawn. Lesson 23's own tease, on Lesson 22's card, is "One note,
  swinging. Now two notes together: one pair wants to move.", with Lesson 22's planned line as the
  alternative `hold` (Lesson 23 FACTS 5, 5b; settled at the lead's review on 1 November 2026, as the
  owner asked).
- **Facts:** sourced in Lesson 23's FACTS: interval number and quality, augmented and diminished,
  inversion, consonance and dissonance, the white-key tritone (Open Music Theory 2e, 1.15 and 2.01;
  1e 2.12), the ratios (Wolfe, UNSW), the tritone's name and nickname (Wikipedia, Tritone, at a named
  revision; Fux 1725 as RESEARCH reads the Latin); the app at `c60f0fdcb`. Nothing is said about a
  church ban until the card's sources are read.

## 3. `kit/season.ts` (Season 2's module) entry and prerequisites

```ts
{
  n: 23,
  lane: 'theory',
  title: 'Perfect, major, minor and the tritone',
  short: 'Interval quality',
  topics: ['T13'], // "Interval quality: major, minor, perfect; tritone; inversion"
  // A draft until Lesson 6's page is live and the vocal coach's look at Sing it (drafts.ts).
  minutes: 14, // once the page is built
  page: '/learn/23', // once the page is built
  hook: 'Which interval splits the octave exactly in half, and why does it want to move?',
  pr: {
    needs: 'Leap with only the perfect intervals and the tritone (the ear-drill launch kind)',
    link: {
      href: '/ear-lab?lesson=23',
      addr: 'mercurypitch.com/ear-lab',
      label: 'Ear Lab',
      note: 'then tap Leap',
    },
  },
}
```

- `EDGES` gains `[6, 23]` (SEASON-2 § 4.3 row 23); `PREREQ[23]` is then `[6]`.
- `drafts.ts`: `23: "Lesson 6's page at /learn/06, and the vocal coach's look at Sing it"`.
- `team-notes.ts` `SIGNATURES[23]`: "An interval and its upside down fill the octave on the pitch
  line; curled into Lesson 2's ring, the tritone is its diameter."

## 4. `kit/lesson-copy.ts` (hook and teases, settled at the lead's review on 1 November 2026)

- Lesson 23: no hook alternatives; the default hook is the season's.
  - `tease`: "One note, swinging. Now two notes together: one pair wants to move." (67).
  - `teaseAlts`: `[{ id: 'hold', text: 'One note, swinging. Now hold two together: one pair wants to
    move.' }]` (66).
  - `TEASE_NOTES[23].hold`: "Lesson 22's planned line. Its 'Now hold two together' can read as
    an instruction to the learner, who holds no two notes on Lesson 23's page; the page holds them."
- Lesson 24 (set on Lesson 24, so Lesson 24's writer should see it):
  - `tease`: "A drone, and a second note just above it, almost in tune." (57). It is Lesson 24's
    opening set-up (220 Hz with 224 Hz) and names no beat, slowing or stopping, so it does not
    answer Lesson 24's predict.
  - `teaseAlts`: `[{ id: 'fifths', text: 'Fifths sound settled; the tritone leans. Next, a note
    against a drone.' }]` (70).
  - `TEASE_NOTES[24].fifths`: "A mended form of Lesson 23's planned line, 'Fifths sit still; the
    tritone leans. Can your own voice hear it?', which is withdrawn: right above Lesson 24's hook,
    'Fifths sit still' reads as 'a fifth does not beat', where Lesson 24 shows the piano's fifth
    beating slowly, and a voice does not hear. It sums up Lesson 23 rather than setting up Lesson
    24's opening."
  - One point for the lead: the variant says "sound settled", where this page now says "counts as"
    (review finding 3). "Fifths count as settled; ..." would run to 73 characters, past
    `TEASE_MAX`, so the variant keeps the lead's wording; FACTS 5 says so.

## 5. Kit and app work the page waits for (WEB-SPEC, What the kit and the app still need)

1. Season 2's kit PR (SEASON-2 § 8.2 item 1): seasons and Season 2's data module; the staff toy with
   both clefs and the pitch-line switch; no decorative staff on a Season 2 page.
2. **New**: the staff toy's interval state.
   - Two notes: the bottom fixed on C, the top moved by Step up, Step down and taps.
   - Sharp and Flat as toggles limited to the spellings the page names (Sharp on D, F, G, A; Flat on
     D, E, G, A, B). The toy owns their enabled state.
   - A readout of letters, semitones and name.
   - Fold, with the sums and a gold octave bracket.
   - A B lane, and Curl into a ring (the kit's spiral seen from the top, or a flat ring: the lab's
     call).
   - Until the predict's choice, heard through `onChoice`, the toy holds back Sharp, Flat, Fold, the
     curl and the plays of Steps 2, 3 and 4, and draws no black-key lane. Step 1's E♭ draws only its
     own lane.
   - Free play in the Wrap is a second instance.
   - Pure helpers with unit tests.
3. **New**: Lesson 6's `PAIR` and `pair` move into the kit (Lesson 6 then imports them).
4. Lesson 12's sing flow in the kit (as Lesson 15's spec asks), plus a plain listening play outside
   the flow, open in every ending.
5. `lesson-23/cold-open.ts`, the upright pitch line.
6. SEASON-2 § 5.2 item 21 (marker, lesson-answer bounds, admin rows, `RELEASED_LESSONS`) before the
   page is built, so the practice card has no first-visit line and answers are not dropped.
7. The head, the structured data (`alternativeHeadline`, `teaches`, `PT14M`), the share card
   (`learn/lesson-23-og.jpg`) and the llms.txt line on release, each checked against the predict.
8. Later, the app's: the `ear-drill` launch kind (item 12) and `perfect-intervals` (item 16); the
   card's text changes then, as LESSON.md's editorial note says.

## 6. Departures from ARTICLE-PLAN.md, and why

1. **One predict.** The plan's Step 2 predict (do the widened fourth and narrowed fifth land on the
   same key?) and its Step 4 predict (the tritone turned over) became Try and Notice lines, as the
   lead decided for both.
2. **The cold open's stage** draws only C4 and C5 and "an octave: 12 semitones": the plan's ring
   and named ruler put F♯ in view before the choice. Merc's line changed with it.
3. **The predict.**
   - It asks "Which note between the two Cs splits the octave into two equal leaps?" (the plan:
     "exactly in half", "G, the fifth"). In hertz G is almost exactly halfway (392.44 Hz, 3:2), so
     "half" needed its measure.
   - Its choices are [G] [F♯]. Its answering plays end with C and the middle note together.
   - It stays a reasoning check on Lesson 6's facts, as the season's card designed it.
4. **The recall** asks Lesson 6's questions 3 and 4 (the plan: 2 and 3). Question 2's "7
   semitones: a perfect fifth" would sit one scroll under the choices. Question 4 checks that a
   tune lives in its intervals' sizes. Neither names six semitones, F♯, a tritone or the middle of
   the octave.
5. **The object** is Lesson 2's semitone ruler as Season 2's pitch line beside the staff: no lesson
   has "Lesson 6's interval ruler".
6. **The four words** drop "Tritone: six semitones, half an octave", which answers the predict;
   Inversion takes its place, its figure a third.
7. **The steps' toy holds back the answer until the choice**: Sharp, Flat, Fold, the curl and the
   plays of Steps 2, 3 and 4 wait for it, and the pitch line draws no black-key lane until then.
   Step 1's plays stay open (its E♭ draws only its own lane), and so do Step up, Step down and taps,
   which reach white keys only. The first pass's claim, that only Sharp, Flat, Fold and the curl were
   locked and that this kept F♯ out of reach, was wrong; the review caught it (section 9, item 1).
8. **Step 4's heading** is "Why does the halfway interval want to move?" (the plan's named the
   tritone, and the lesson menu lists headings from the first paint). Tavi's Step 4 line is a
   sincere guess, where the plan closed with "the notes either side of it pull it home". Step 4 now
   says "not settled" and "counts as", and "Lesson 27 comes back to this pair".
9. **Sing it**:
   - D is kept, the only key with 2 semitones' room in all six presets.
   - No Move do (the plan said "Move do as Lesson 10"; every move leaves a preset 1 semitone or
     less) and no octave below.
   - The line "If the top note feels high, sing only do up to so." is new.
   - The listening pair is ti below fa, C♯ and G closing inwards to D and F♯ (the plan: fa below ti,
     moving outwards), matching Step 4.
10. **"Fa and ti, the two notes that lean hardest"** is not said (OMT 1e names ti and le).
11. **Go deeper**:
    - "Why perfect?" is replaced by "Halfway in hertz": no source says the name comes from the
      ratios.
    - "Another way to find a quality" is cut: Step 4 already says F and B.
    - "The devil in music" quotes no translation of Fux and does not show his Latin. It now ends
      "... bars the tritone leap in counterpoint.": nothing about a ban, as the card asks.
12. **Practice**: Leap alone. Lesson 9's sung `leap-ladder` card, optional in the plan, is not
    linked.
13. **Quick check**:
    - Q1's feedback links Step 2 (the cold open is not a step).
    - Q2's second answer says "semitones" for the plan's "size".
    - Q3's words are kept; it links Step 1 and does not mention Lesson 10.
    - Q4 asks "Which interval is this?", with a perfect fourth for the plan's octave and one fixed
      sound (the plan's "next visit's retrieval" sound is dropped).
    - The words of Q1 and Q3 are unchanged, since Lessons 27 and 24 ask them as recalls.
14. **Sound gate**: "the one distance that never sits still" is dropped ("never" is unsupported).
15. **Teases**: settled at the lead's review (section 4).
16. **Length**: 2,048 words against the plan's 1,200 budget (its own estimates add to 1,575 before
    the recall, the drawers and the practice card); 14 minutes.

## 7. Questions and notes for the lead

1. **Lesson 24's recall** imports this page's quick check 3 word for word
   (`lessons/24-drone-harmony/ARTICLE-PLAN.md:52-53`), and **Lesson 27's** imports quick check 1
   (`lessons/27-sevenths-inversions/ARTICLE-PLAN.md:43-44`). The fix pass changed neither's words or
   answers, so both writers can import them as they stand. FACTS 75 and 77 record it.
2. **RESEARCH R13** quotes Wikipedia's dating sentence as "from at least the early 18th century",
   leaving out its "or the late Middle Ages". RESEARCH.md is left as it is; FACTS 36 quotes the whole
   sentence (revision 1375041687), and the page gives no date for the nickname.
3. **The head title** stays proposed in WEB-SPEC (Sections, 2) and FACTS 1a, as Lessons 15 to 21
   leave theirs: "Interval quality: perfect, major and minor | MercuryPitch" (57). It is not an
   owner question now.
4. **The vocal coach** (LESSON.md, For the vocal coach) confirms: the key, D; no Move do and no
   octave below; the line for a top note that feels high; the listening pair, never sung; the new
   Easy and Workable line; the rest card after "Effortful".

## 8. Lesson 21 citations, now bound to path and line (Lesson 21 at `271dc369a`)

Each was checked against `lessons/21-keys-circle/LESSON.md` as committed:

1. FACTS 7: Lesson 21 asks Lesson 6's question 2 as its recall → `LESSON.md:146-157`.
2. FACTS 18: "a scale uses each letter once" → `LESSON.md:215-216`. Its mix-up card, "The key
   decides which name the note takes." → `:223`. Both are quotes, checked by plan-cites. The brief
   said "Lesson 21, Step 2"; the text is in Step 3 of Lesson 21's five.
3. FACTS 32: a pure fifth "about 702 cents, against 700" → `LESSON.md:256` (quote checked).
4. FACTS 44: the hint forms → `LESSON.md:132-139`.
5. FACTS 52: key signatures in Step 4, "How do I find do from a key signature?" → `LESSON.md:231`
   (quote checked).
6. New in the fix pass: FACTS 45, "D major's seven notes" → `LESSON.md:115` (quote checked), for the
   series counting the scale's seven notes.

FACTS Sources no longer says Lesson 21 is in its fix pass.

## 9. Review response (s2pkg/23-REVIEW.md: 0 blocking, 5 should fix, 10 nits)

1. **Should fix 1, the steps' toy before the choice: fixed, as the lead decided.**
   - Before the choice, Sharp, Flat, Fold and the curl are held back, and so are Step 2's two plays
     and Step 3's two.
   - So is Step 4's one play. The lead's call did not name it, but its readout gives B up to F "6
     semitones · a diminished fifth, a tritone" under the heading "the halfway interval", so the
     same reasoning covers it.
   - The steps' pitch line draws no black-key lane until the choice. Step 1's E♭ play stays open
     and draws only its own lane.
   - The toy owns these controls and hears the choice through `onChoice`; see nit 7.
   - Reworded to say exactly what is locked: LESSON.md's preamble, its Steps 1 to 4 toy lines,
     FACTS 1a, 4, 70, 71 and 47, and WEB-SPEC Look, Toys 1 and 3, Edge cases and the Contract.
   - Test 18 now checks the lanes, all five held plays, E♭'s lone lane, and that everything works
     after the choice.
   - One residual is stated in FACTS 1a: the white-key lanes sit at their heights, so a learner who
     measures can see the middle fall between F and G, as the staff's own places put it. That is
     reasoning the predict allows; no lane, name or sound marks the middle.
   - The hand-back's old claim (§ 6 item 6) is corrected in section 6, item 7.
2. **Should fix 2, the predict and the recall: fixed, as the lead decided.**
   - FACTS 1a now calls the predict a deliberate reasoning check, as the card designed it, and names
     what it rests on, each cited: Lesson 6's cold open (`:46`), its Step 5 and table (`:171-173`,
     `:182`) and its quick check 1 (`:264-266`).
   - The stage keeps "12 semitones".
   - The recall now asks Lesson 6's questions 3 and 4, word for word, from the code's objects
     (`l06-q3`, `l06-q4`), with "Try Lesson 6, Step 2 again" and "Try Lesson 6, Step 4 again".
     Neither names six semitones, F♯, a tritone or the middle of the octave.
   - Updated to match: LESSON.md (preamble, Recall), FACTS 1a, 3, 4, 7 and 68, and WEB-SPEC
     Sections, Length, Toys 7 and Tests 7 and 18.
3. **Should fix 3, "counts as": fixed.**
   - The reveal now reads "And played with C, G counts as settled, while F♯ counts as restless, as
     if it wants to move."
   - Step 4 now reads "Exact, yes, but not settled: the tritone counts as a dissonance, less stable,
     as if it needs to resolve."
   - FACTS 25 and 26 quote both. Tavi's "calmest" stays: it is Tavi's guess.
4. **Should fix 4, the scale's count: fixed.** The reveal's aside is now "(G is so, the scale's
   fifth note, near the middle of do up to do, which made it a fair guess.)". FACTS 42 and 45 match,
   and FACTS 45 cites Lesson 10's and Lesson 21's "seven notes".
5. **Should fix 5, the ban sentence: fixed.** The drawer now ends "... quotes the phrase in a proverb
   and bars the tritone leap in counterpoint." FACTS 38 is now "Not said", with the card's
   instruction. Sources, FACTS 36 and 37, the Unsupported list, LESSON.md's preamble, WEB-SPEC Toys
   6 and the Contract all match.
6. **Nit 6, lanes: fixed.**
   - A lane is one note's row: thirteen from C to C, fourteen with Step 4's B lane.
   - FACTS 79's arithmetic is redone (260 / 13 = 20 px; 260 / 14 = 18.6 px).
   - The B lane merges into the ring's B bead.
   - Updated in FACTS 39, 44 and 79 and the Illustrations, and in WEB-SPEC Look and Toys 1 and 2.
7. **Nit 7, who owns Sharp and Flat: fixed.**
   - The predict's `onChoice` tells the toy that a choice is in. `unlocks` is not used, since it
     enables every listed button (`predict.ts:124-126`). The toy owns its buttons and applies its
     per-letter rule before the choice and after, as Lesson 8's Step 5 does for its Tempo.
   - Free play is a second instance, as Lesson 8's wrap mounts its own beat machine (`wrap.ts:26`).
   - Tests 3 and 6 and the Edge cases cover it.
8. **Nit 8: fixed.** Step 4 now ends "Lesson 27 comes back to this pair." FACTS 30 says why
   (Lesson 27's predict and promise, cited).
9. **Nit 9: fixed.** FACTS 75 and WEB-SPEC Toys 7 and Test 8 record Lesson 27's use of quick check
   1, and the LESSON preamble names both recalls. Neither question's wording changed.
10. **Nit 10: fixed.** Step 4 now reads "Among the white keys, only F and B are a tritone apart: fa
    and ti in C major." FACTS 27 matches and notes the many F and B key pairs on a piano.
11. **Nit 11: fixed.** The predict now reads "Which note between the two Cs splits the octave into two
    equal leaps?" FACTS 43 matches.
12. **Nit 12: fixed** (section 8). All five citations are bound, plus one new one, and Sources is
    updated.
13. **Nit 13: fixed.** WEB-SPEC Sections 2 and What the kit needs item 11 now propose:
    - the Article's `headline` and `alternativeHeadline` (the hook);
    - `teaches`: "Naming an interval by its number and quality", "Perfect, major and minor
      intervals", "Augmented and diminished intervals, and the tritone", "Turning an interval upside
      down";
    - the llms.txt line, which names the tritone as a topic, since no learner meets it before the
      choice.
    FACTS 1a covers them.
14. **Nit 14: fixed.** FACTS 1a now lists the lesson menu's row by title (`rowOf`,
    `lesson-menu.ts:166-176`).
15. **Nit 15: fixed.** The six-preset table is now in FACTS 52, beside the prose margins. LESSON.md's
    coach list keeps its copy.

Also done at the lead's direction:

- The teases are settled in FACTS 5 and 5b, LESSON.md and WEB-SPEC (Explorer, Decisions). FACTS 5
  names the withdrawn plan line with its reason.
- WEB-SPEC "Decisions for the owner" now records the settled teases only. The head title stays
  proposed, as noted above.

Left: nothing from the review. One small extra, noted rather than changed: Lesson 6's question 4
says "the line's seven notes" for the tune's first line, where this page also says "the line" for
the pitch line. The words are Lesson 6's own object, imported, so FACTS 7 notes the double meaning
and keeps them.
