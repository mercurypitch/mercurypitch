# Lesson 23 hand-back: "Perfect, major, minor and the tritone"

Files: `docs/plans/find-your-pitch/lessons/23-perfect-tritone/` FACTS.md, LESSON.md, WEB-SPEC.md in
`/dev/shm/s2plan`, copied to `s2pkg/23/`. RESEARCH.md and ARTICLE-PLAN.md are unchanged.

Checks, run from `/dev/shm/s2plan`:

- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/23-perfect-tritone`:
  265 citations read, **0 findings**.
- `node scripts/lesson-words.mjs .../23-perfect-tritone/LESSON.md`: **2,020 words**, cap 2,379
  (359 under); steps' own text 112, 119, 116, 120 (inside 50 to 120). Built page about 2,170 with
  hints and status lines, under the 2,230 aim; no cuts. Chip: 14 minutes (8.49 reading + about 5.1
  of sound and tasks).

Process note: early in this pass I ran four read-only git commands (`log -1`, `cat-file -t`, `show`,
`ls-tree`) in `/home/user/mercurypitch` to read `spiral.ts` at `c60f0fdcb`, then switched to reading
the worktree's own files. Nothing was changed by them. No other git, no pnpm, no downloads.

## 1. MASTER-PLAN § 11 (proposed line, after Lesson 17's)

- Lesson 23: a written lesson, text only, for review, in
  [`lessons/23-perfect-tritone/`](lessons/23-perfect-tritone/) (research, article plan, facts, copy
  and page spec). Its unscored sing-along waits on the vocal coach's look (§ 12 item 8). No page is
  built yet: it waits on Season 2's kit (seasons, and the staff toy with both clefs and the
  pitch-line switch, SEASON-2 § 6.2 items 1 and 2, with a new interval state, Lesson 6's interval
  pair and Lesson 12's sing flow moved into the kit) and on the lesson plumbing for Lessons 15 to 28
  (SEASON-2 § 5.2 item 21). It goes live when the console publishes it, after the coach's look and
  once `/learn/06`, the page its chip and its recall link to, is live.

(Add "reviewed once and fixed" after the review and fix pass.)

## 2. CURIOSITY-MOMENTS § 2 (proposed entry)

### Lesson 23 · Perfect, major, minor and the tritone · theory; written; no page yet · hook kept

- **Opening:** the pitch line upright between Merc and Tavi, C4 at its foot and C5 at its top, "an
  octave: 12 semitones", nothing drawn between; Play C up to C works before the choice. Tavi "It must
  be G, surely? The fifth sits right in the middle of the scale." Merc "Let's split it both ways and
  listen." Predict: "Merc will play one note between the two Cs. Which one splits the octave into two
  equal leaps?" [G] [F♯]. The answering plays, C, G, C and C, F♯, C, each end with C and the middle
  note together; the lanes draw in and the leaps are counted, 7 and 5, 6 and 6; the reveal waits for
  both. The plan's stage, Lesson 2's ring and a named ruler, showed F♯ across from C and in the
  middle before the choice, and its "exactly in half" could be answered G in hertz (Lesson 23 FACTS
  40, 43).
- **Visual:** the staff toy's interval state, the staff and the pitch line side by side, with Sharp,
  Flat, Fold and a curl into Lesson 2's ring (new, on SEASON-2 § 6.2 item 2's staff toy); Lesson 2's
  ring (exists: the kit's spiral seen from the top). **Payoff:** Step 3's fold, where an interval and
  its upside down fill the octave and the tritone folds onto six semitones again; Step 4's ring, B
  and F straight across, closing into C and E; the sing-along, do up to so and back in D, unscored,
  then ti and fa heard together, closing into do and mi.
- **Tease:** a still of Lesson 24's stage, a drone band on A3 and a line just above it, silent: "A
  drone, and a second note just above it, almost in tune." (proposed); the plan's line, "Fifths sit
  still; the tritone leans. Can your own voice hear it?", is the alternative `plan`. Lesson 23's own
  tease, on Lesson 22's card, is Lesson 22's planned line, kept: "One note, swinging. Now hold two
  together: one pair wants to move." (Lesson 23 FACTS 5, 5b; for the lead's review).
- **Facts:** sourced in Lesson 23's FACTS: interval number and quality, augmented and diminished,
  inversion, consonance and dissonance, the white-key tritone (Open Music Theory 2e, 1.15 and 2.01;
  1e 2.12), the ratios (Wolfe, UNSW), the tritone's name and nickname and the ban story (Wikipedia,
  Tritone, at a named revision; Fux 1725 as RESEARCH reads the Latin; Sword 2022, Weak); the app at
  `c60f0fdcb`.

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

## 4. `kit/lesson-copy.ts` (hook and teases)

- Lesson 23: no hook alternatives; the default hook is the season's. `tease`: "One note, swinging.
  Now hold two together: one pair wants to move." (66; Lesson 22's planned line, kept: no leak,
  true of the page, within `TEASE_MAX`). Not proposed, for the lead only if "Now hold two together"
  reads as an instruction: "One note, swinging. Now two notes together: one pair wants to move." (67).
- Lesson 24 (set on Lesson 24, so Lesson 24's writer should see it): `tease` "A drone, and a second
  note just above it, almost in tune." (57), Lesson 24's opening set-up (220 Hz with 224 Hz), naming
  no beat, slowing or stopping, so it does not answer Lesson 24's predict. `teaseAlts`:
  `[{ id: 'plan', text: 'Fifths sit still; the tritone leans. Can your own voice hear it?' }]` (64).
  `TEASE_NOTES[24].plan`: "Lesson 23's planned line. It sums up Lesson 23 rather than setting up
  Lesson 24's opening, and right above Lesson 24's hook its 'Fifths sit still' can read as 'a fifth
  does not beat', where Lesson 24 shows the piano's fifth beating slowly." A mended form, if the
  lead wants the plan's idea, fits at 70: "Fifths sound settled; the tritone leans. Next, a note
  against a drone."

## 5. Kit and app work the page waits for (WEB-SPEC, What the kit and the app still need)

1. Season 2's kit PR (SEASON-2 § 8.2 item 1): seasons and Season 2's data module; the staff toy
   with both clefs and the pitch-line switch; no decorative staff on a Season 2 page.
2. **New**: the staff toy's interval state: bottom note fixed on C, top note moved by Step up, Step
   down and taps; Sharp and Flat as toggles limited to the spellings the page names (Sharp on D, F,
   G, A; Flat on D, E, G, A, B); a readout of letters, semitones and name; Fold with the sums and a
   gold octave bracket; a B lane and Curl into a ring (the kit's spiral seen from the top, or a flat
   ring, the lab's call). Pure helpers with unit tests.
3. **New**: Lesson 6's `PAIR` and `pair` move into the kit (Lesson 6 then imports them).
4. Lesson 12's sing flow in the kit (as Lesson 15's spec asks), plus a plain listening play outside
   the flow, open in every ending.
5. `lesson-23/cold-open.ts` (the upright pitch line) and the predict's `unlocks` on the steps' Sharp,
   Flat, Fold and Curl (the kit already has `unlocks`).
6. SEASON-2 § 5.2 item 21 (marker, lesson-answer bounds, admin rows, `RELEASED_LESSONS`) before the
   page is built, so the practice card has no first-visit line and answers are not dropped.
7. The head and share card (`learn/lesson-23-og.jpg`), `timeRequired` `PT14M`.
8. Later, the app's: the `ear-drill` launch kind (item 12) and `perfect-intervals` (item 16); the
   card's text changes then, as LESSON.md's editorial note says.

## 6. Departures from ARTICLE-PLAN.md, and why

1. **One predict.** The plan's Step 2 predict (do the widened fourth and narrowed fifth land on the
   same key?) and Step 4 predict (the tritone turned over) became Try and Notice lines, per the
   lead's answer 3 ("The page has one predict"). If the lead meant only Step 4's, Step 2's returns.
2. **The cold open's stage** draws only C4 and C5 and "an octave: 12 semitones": the plan's ring
   and named ruler put F♯ in view before the choice. Merc's line changed with it.
3. **The predict asks for "two equal leaps"**, choices [G] [F♯] (the plan: "exactly in half", "G,
   the fifth"): in hertz G is almost exactly halfway (392.44 Hz, 3:2), so "half" needed its measure.
   Its answering plays end with C and the middle note together, so the cold open also plants "why
   does it want to move?".
4. **The object** is Lesson 2's semitone ruler as Season 2's pitch line beside the staff: no lesson
   has "Lesson 6's interval ruler".
5. **The four words** drop "Tritone: six semitones, half an octave" (it answers the predict, and sits
   where a phone shows it before the choice); Inversion takes its place, its figure a third, not the
   fifth, so nothing below the predict splits the octave at G.
6. **The steps' toy waits for the choice** (new): Sharp, Flat, Fold and Curl unlock with it, so the
   toy cannot reach F♯ or fold the fifth before the choice.
7. **Step 4's heading** is "Why does the halfway interval want to move?" (the plan's named the
   tritone, and the lesson menu lists headings from the first paint); Tavi's Step 4 line is a sincere
   guess where the plan closed with "the notes either side of it pull it home".
8. **Sing it**: D kept (the only key with 2 semitones' room in all six presets); no Move do (the
   plan said "Move do as Lesson 10"; every move leaves a preset 1 semitone or less) and no octave
   below; "If the top note feels high, sing only do up to so." The listening pair is ti below fa, C♯
   and G closing inwards to D and F♯ (the plan: fa below ti, moving outwards), matching Step 4.
9. **"Fa and ti, the two notes that lean hardest"** is not said (OMT 1e names ti and le).
10. **Go deeper**: "Why perfect?" replaced by "Halfway in hertz" (no source says the name comes
    from the ratios); "Another way to find a quality" cut (Step 4 already says F and B); "The devil
    in music" quotes no translation of Fux and does not show his Latin; the ban is "probably just
    that: stories".
11. **Practice**: Leap alone; Lesson 9's sung `leap-ladder` card (optional in the plan) not linked.
12. **Quick check**: Q1's feedback links Step 2 (the cold open is not a step); Q2's second answer
    says "semitones" for the plan's "size"; Q3's words kept (Lesson 24's recall), its link to Step 1
    and no mention of Lesson 10; Q4 asks "Which interval is this?" with a perfect fourth for the
    plan's octave, and one fixed sound (the plan's "next visit's retrieval" sound dropped).
13. **Sound gate**: "the one distance that never sits still" dropped ("never" unsupported).
14. **Teases**: Lesson 23's kept; Lesson 24's new, the plan's line the alternative.
15. **Length**: 2,020 words against the plan's 1,200 budget (its own estimates add to 1,575 before
    the recall, drawers and practice card); 14 minutes.

## 7. Questions

For the owner:

1. The head title: recommended "Interval quality: perfect, major and minor | MercuryPitch" (57);
   alternative "Perfect, major and minor intervals explained | MercuryPitch" (59). Neither names
   the tritone.

For the lead:

2. The one-predict reading (6.1 above).
3. Both teases (section 4), and whether Lesson 24's writer adopts the proposal.
4. Lesson 24's plan asks this page's quick check 3 word for word as its recall
   (`lessons/24-drone-harmony/ARTICLE-PLAN.md:52-53`); I kept its words. If Lesson 24 changes that
   recall, nothing here needs to change; if this page's Q3 changes, Lesson 24's recall must follow.
5. RESEARCH R13 quotes Wikipedia's dating sentence as "from at least the early 18th century",
   leaving out its "or the late Middle Ages". RESEARCH.md is left as it is; FACTS 36 and 38 quote the
   whole sentence (revision 1375041687) and the page gives no date for the nickname.

For the vocal coach (LESSON.md, For the vocal coach): the key, D; no Move do and no octave below;
the line for a top note that feels high; the listening pair, never sung; the new Easy and Workable
line; the rest card after "Effortful".

## 8. Lesson 21 citations made in words (to bind once Lesson 21 lands)

Read in Lesson 21's working copy at 20:16 on 1 November 2026; its line numbers will move.

1. FACTS 7: "Lesson 21 asks question 2" (Lesson 6's question 2 as its recall): Lesson 21
   LESSON.md, Recall from Lessons 6 and 15 (now about lines 146-157).
2. FACTS 18: "Lesson 21's Step 3 adds that a scale uses each letter once, so a key's notes take the
   names its letters need", and "Lesson 21, Step 3 and its mix-up card": Lesson 21 LESSON.md, Step 3
   ("a scale uses each letter once", now about line 216) and its mix-up card ("The key decides which
   name the note takes.", now about line 223). The brief said "Lesson 21, Step 2"; the text is in
   Step 3 of Lesson 21's current five steps.
3. FACTS 32: "Lesson 21, Step 5 (in its package: a pure fifth "about 702 cents, against 700")":
   Lesson 21 LESSON.md, Step 5 (now about line 256). The quotation is exact today.
4. FACTS 44: "Lesson 21's forms of the hints (in its package)": Lesson 21 LESSON.md, Cold open (now
   about lines 132-140).
5. FACTS 52: "key signatures are Lesson 21's, which is not a prerequisite": Lesson 21 LESSON.md,
   Step 4, "How do I find do from a key signature?" (now about line 231).
6. FACTS, Sources: the general note that Lesson 21 is cited in words.
