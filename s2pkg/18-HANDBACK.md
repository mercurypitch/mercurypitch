# Lesson 18 hand-back: Read and sing a whole line

Package: `docs/plans/find-your-pitch/lessons/18-read-a-line/` in /dev/shm/s2plan, files FACTS.md,
LESSON.md and WEB-SPEC.md (RESEARCH.md and ARTICLE-PLAN.md untouched). Copies of all three are in
`/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/18/`.
Nothing is committed, and no shared file, other lesson's file or code was edited.

- Words: 2,120 on `node scripts/lesson-words.mjs`, cap 2,379, 259 under. Each step's own text is
  82 to 118 words (Step 4 trimmed from 129). The built page comes to about 2,270 with its hints, and
  no cut is needed. If one is, the order is in WEB-SPEC, Length: the second tune first, then Step
  3's exam sentence.
- plan-cites: 221 citations, 0 findings (one finding fixed: `createTapTempo` cited at its own lines,
  `tap-pad.ts:87-120`).
- Every sung part is written in full: the start, tune 1, tune 2, both octaves, both clefs, the range
  table for all six presets. The vocal coach's lines to sign off are listed in LESSON.md, "For the
  vocal coach". Its "To confirm" items cover: the breath mark's place, nothing playing during a take,
  the key G, a so that feels high, the pass rule, the pitch line hidden during a take, and the four
  feeling answers. Its "Proposed, not applied" item lists the four answers.

## Shared-file entries for the lead to paste

### MASTER-PLAN § 11

- Lesson 18: a written lesson, text only, in
  [`lessons/18-read-a-line/`](lessons/18-read-a-line/) (research, article plan, facts, copy and page
  spec). Its scored checkpoint waits on the vocal coach's sign-off (§ 12 item 8). No page is built
  yet. It waits on:
  - Season 2's kit: seasons, the staff toy with both clefs, and rhythm on the staff
    (SEASON-2 § 6.2 items 1 to 3). Moved into the kit with them: Lesson 17's woodblock and its
    pitch-line view of a rhythm, and Lesson 12's sing flow with Lesson 16's additions. New on this
    page: a count-in, a cursor at tempo, brackets, the song sheet's marks and a take read in time.
  - The lesson plumbing for Lessons 15 to 28 (SEASON-2 § 5.2 item 21).

  It goes live with Lesson 16 (SEASON-2 § 8.2 item 4), when the console publishes it. Before that it
  needs the coach's sign-off, Sight-Singing's work for the lessons and sight-singing in time
  (SEASON-2 § 5.2 items 10 and 11), and `/learn/16` and `/learn/17` live, the pages its chips and its
  recall link to.

(Add "reviewed once and fixed" after the lead's review, as the other entries have it.)

### CURIOSITY-MOMENTS § 2

### Lesson 18 · Read and sing a whole line · voice; written; no page yet · hook kept

- **Opening:** a bass staff of two bars of 4/4 over Lesson 17's beat grid, between Merc and Tavi.
  The tune is Merc's: G3 A3 B3 A3, then G3 B3 and a long D4.
  - Tavi "Seven notes. Don't you have to work out each one's name, then sing it?"
  - Merc "Watch what my eyes catch."
  - Predict: "Merc reads this tune and sings it in time, at 60 BPM. How many separate things does
    he read?" [Seven: one note at a time] [Two: a run of steps, then do-mi-so].
  - Until the choice, the read and Steps 1 and 2's toys are locked, and the page's tour waits.
  - The read: do, a bar's count-in, then the tune on "ooh". The cursor moves on the beat, and a gold
    bracket lights over each pattern as the cursor reaches it.
  - Two changes from the plan. Its choice "a run and a chord" would clash with Lesson 20's Run word.
    Its reveal said "the eye takes in a group", and no source says so (Lesson 18 FACTS 24, 33).
- **Visual:** Lesson 16's staff over Lesson 17's beat grid (new with Season 2's kit, SEASON-2 § 6.2
  items 2 and 3). On it, all new: a cursor at tempo, gold brackets over patterns, and the song
  sheet's marks written as they sound.
- **Payoff:**
  - Step 1's two reads. Read note by note leaves do, mi and so unsung when the bars end. Merc's way
    keeps up.
  - The checkpoint: after do and a count-in, two bars read and sung in time. Each note is scored in
    its own beats. Timing is shown, not scored.
- **Tease:** Lesson 19's stage as a still, six of Lesson 8's pads in a row, all one size and
  ungrouped. It does not play. "Same six notes, same speed. Only the accents move.", with its
  alternative `written` (Lesson 19 FACTS 5b). Lesson 18's own tease, on Lesson 17's card, is "Now you
  can read when each note comes, and where it sits." (Lesson 18 FACTS 5b).
- **Facts:** sourced in Lesson 18's FACTS. Not claimed: how readers see or group a line.
  - The count-in and the exam's two-bar unaccompanied tune: RCM 2025, pp. 7 and 9.
  - Dynamics, hairpins, staccato, slurs, ties and breath marks: Open Music Theory 2e, 1.7 and 1.8;
    ABRSM 2023; the hairpins' shapes from Wikipedia, Dynamics, at a named revision.
  - Pattern teaching: Henry 2004, abstract only.
  - The app at `c60f0fdcb`.

### kit/season.ts (Season 2's data module), with the prerequisites

```ts
  {
    n: 18,
    lane: 'voice',
    title: 'Read and sing a whole line',
    short: 'Reading in time',
    topics: ['S11b', 'T32'],
    // A draft until its sign-off (drafts.ts), as Lesson 3 is.
    minutes: 16, // once the page is built
    page: '/learn/18', // once the page is built
    hook: "How do singers read a tune they've never heard without stopping on every note?",
    pr: {
      needs:
        'Sight-singing in time: a count-in, a click and notes that move on the beat, pitch scored per note (SEASON-2 § 5.2 item 11)',
      link: {
        href: '/pitch-training?lesson=18',
        addr: 'mercurypitch.com/pitch-training',
        label: 'Exercises',
        note: 'then tap Sight-Singing',
      },
    },
  },
```

- `EDGES`: [16, 18] and [17, 18] (SEASON-2 § 4.3).
- Topic names: S11b and T32 as SEASON-2 § 4.1 gives them.

### kit/lesson-copy.ts

```ts
  18: { tease: 'Now you can read when each note comes, and where it sits.' },
```

- 57 characters, inside `TEASE_MAX` (70). There is no alternative, so no `teaseAlts` and no team
  note. It is the tease Lesson 17's package settled; it drops the season card's "Put the two
  together".
- The hook is the season's, word for word, and goes in season.ts, so there are no `hookAlts`.

### Other one-liners

- drafts.ts: `18: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",`
- The admin console's signature line: "Lesson 16's staff over Lesson 17's beat grid; a cursor moves at
  tempo, patterns bracket themselves as it reaches them, and the song sheet's marks appear over the
  sounds they ask for."
- llms.txt, on release: "Lesson 18, Read and sing a whole line: count in, read and sing a short tune
  in time, and read the marks a song sheet carries."

### Lesson 17's package needs three edits, for the lead

Lesson 17's still of this lesson's stage is out of date. It uses the plan's C pitches and "the
learner's clef". This lesson's stage is Merc's tune on the bass staff, in G, for everyone. Lesson
17's FACTS also quotes the plan's old predict choices.

- `lessons/17-note-lengths/FACTS.md:52` (fact 5):
  - Choices: ("Seven: one per note" or "Two: a run and a chord") becomes ("Seven: one note at a time"
    or "Two: a run of steps, then do-mi-so").
  - The still: "in the learner's clef: ... C4 D4 E4 D4 and C4 E4 G4 on the treble staff, or an octave
    lower on the bass" becomes "on the bass staff with its clef and 4/4, for everyone, since the tune
    is Merc's: ... G3 A3 B3 A3 and G3 B3 D4" (Lesson 18 FACTS 34).
- `lessons/17-note-lengths/LESSON.md:362-363`: "in the learner's clef" becomes "on the bass staff, as
  Lesson 18's stage draws it for everyone".
- `lessons/17-note-lengths/WEB-SPEC.md:539-542` (Toys 11): replace the clause from "in the learner's
  clef from `fyp-voice`" to "an octave lower on the bass" with the bass staff and G3 A3 B3 A3, G3 B3
  D4. Lesson 17's Toys 1 engraves only A3 or A4, so "engraved as Toys 1 engraves" needs the pitch
  generalised. This page asks for the same in its kit item 4.

## Kit and app work

In full in WEB-SPEC, "What the kit and the app still need", items 1 to 16. In short:

1. The host, `learn/18.html`, and the draft line.
2. Seasons in the kit.
3. The reading staff. It is Lesson 15's staff toy plus Lesson 17's rhythm on the staff, with these
   additions:
   - quarters and halves at any pitch in either clef, each stem set by its side of the middle line;
   - the beat grid under two bars, and a count-in strip;
   - a cursor at tempo;
   - gold brackets that are buttons;
   - the marks, each written as it sounds and a button once drawn. p and f come from the snippet's
     `dynP` and `dynF`. Hairpins, staccato dots, slurs and the breath mark are paths, "checked, then
     built";
   - a lock until the predict's choice;
   - loudness shown as brightness.
4. The woodblock in the kit (Lesson 17's item 11) and a count-in.
5. The tap pad's tempo readout, from the existing `createTapTempo`.
6. The sing flow in the kit with Lesson 16's additions, and a take read in time:
   - the start, do and then the count-in, on the audio clock;
   - a take that keeps frames from a quarter of a beat before bar 1 and ends at a fixed time, through
     Lesson 16's proposed `until`;
   - `kit/read-in-time.ts`, new. Each note gets a window of plus or minus a quarter of a beat, then
     the device's delay. A note passes with 0.45 s in all within 60 cents, folded, with half-back.
     Its reading comes from the in-band frames, or else the window's steady frames, or else "not
     steady";
   - the silent cursor during the take;
   - the pitch line on the bars' time axis.
7. Dynamics, staccato, slurs and breaths in the kit's runs.
8. No decorative staff.
9. The lesson copy.
10. The app's lesson plumbing (SEASON-2 § 5.2 item 21).
11. Sight-singing in time and Sight-Singing for the lessons (§ 5.2 items 11 and 10).
12. The head and share card.
13. Lessons 16 and 17's questions as modules.
14. The lab on a phone: the device's delay, the window edges, whether the 0.45 s hold is reachable,
    the p and f levels.
15. Found here, and it matters beyond this page: `src/e2e/learn-no-planning-text.spec.ts:39`'s
    topic-code pattern, `\b[TS]\d\d\b`, misses Season 2's lettered codes S11a, S11b, S20a and S20b.
    A letter after the digits leaves no word boundary. It needs an optional `a` or `b` before Lesson
    16, 18, 24 or 26 is built.

## Departures from ARTICLE-PLAN.md

Each is explained in FACTS. The first fifteen are in LESSON.md's preamble or its coach list.

1. Every pitch is in G (the lead's answer), not C: do is G3 or G4. The range table, run for all six
   presets, is Lesson 16's.
2. The predict's choices are "Seven: one note at a time" and "Two: a run of steps, then do-mi-so",
   not "one per note" and "a run and a chord". This keeps "run" in agreement with Lesson 20's Run
   word.
3. The reveal says what Merc reads, not "the eye takes in a group", which no source supports.
   "Readers see patterns" is gone from the Wrap too.
4. The predict asks about "this tune", not "this line". "Line" means a line of the staff on this
   page.
5. No step heading names a pattern: the plan's "Do readers really name every note?" and "Which
   patterns should my eye look for?" are changed. Steps 1 and 2's toys lock until the choice, and
   the tour waits for it.
6. The cold open's tune is Merc's, on the bass staff for everyone. Merc sings on "ooh", not on
   syllables, since the kit's voices cannot speak them.
7. The checkpoint's tune is never played before it is read. The plan's Step 3 example was that tune,
   so Step 3 now has tune C.
8. Tune 2 is new. The plan's second try was the cold open's tune with its last note changed. Tune 2
   holds do-mi-so and repeated notes but no step; tune 1 carries the card's "steps and do-mi-so".
9. The start is do and the count-in, with no tonic triad, which would sing tune 1's opening. Nothing
   plays during a take, the click included, since the microphone takes the raw signal. Scoring is per
   note in windows (the lead's answer). The plan's open question 2 is closed.
10. Step 2's second tune is new, so each bracket covers notes of its own. Its "Patterns on · off"
    switch is dropped: brackets draw as each tune plays.
11. Step 4's breath mark plays on Step 3's tune, since the cold open's tune sounds only after the
    choice.
12. The quick check asks one question a step. The plan's question 2 repeated the recall, and its
    "three lines in a row" left out the bass staff's spaces.
13. The practice card says what Sight-Singing does today:
    - it reads pitch, not rhythm;
    - it gives up to eight seconds a note;
    - Lesson 16's limits apply;
    - The Chart is the second drill.

    The plan's "practise the patterns here" is dropped, since the drill never repeats a note.
14. The promise drops "two-bar", so nothing above the predict says "two".
15. There is no Go deeper drawer, for length. FACTS keeps its three items.
16. The sound gate and chips use Lesson 16's form: the gate adds "and your voice" and the
    microphone line, and the chips add "Microphone optional".
17. The mix-up card cites Henry 2004 alone. It ends "shows a gain, not a winner", and its evidence
    says "Teachers train patterns too", not "instead of names", since the abstract does not say
    names were dropped. Mishra 2014 is left out (Unsupported).
18. Step 3 names the Royal Conservatory's voice exams, not "exam singers" in general. Half notes are
    counted "1 (2) 3 (4)".
19. The feedback is Lesson 16's lines, one a note, not the plan's summary line. The Easy or Workable
    lines are "Now another tune you've never heard." and "Two tunes, read in time from the page."
20. The tease on this page's card is Lesson 19's own, settled in Lesson 19's package. The plan's
    "Every bar so far has walked in twos and fours." is false (Lesson 19 FACTS 5b).
21. The coach list's range is G3 to D4 and G4 to D5. The plan's "Lesson 20 sings staccato" is
    corrected: Lesson 20's Step 4 plays staccato and legato and asks no one to sing them.
22. The length is 2,120 words, against the plan's budget of about 1,950. It is still 259 under the
    cap.

## Citations of an uncommitted lesson, made in words

Only Lesson 20, whose package was uncommitted when this one was written. I could not check whether
it has since landed, since git was off limits. Each citation was re-read against Lesson 20's files
as they stand in the worktree (read only). Once it has landed, the lead may turn each into a path.

- LESSON.md, preamble, the predict departure: "so "run" means what it means on Lesson 20's page".
- LESSON.md, For the vocal coach, "Heard, never sung": "Lesson 20's Step 4 plays staccato and legato
  and asks no one to sing them either". This is `lessons/20-runs-pentatonic/LESSON.md:225-233` and
  :447-451.
- FACTS.md, Sources: "Lesson 20's package was not committed when this one was written, so it is cited
  in words."
- FACTS 10: Lesson 20's Run word, "quick notes one after another, by step or by leap"
  (`lessons/20-runs-pentatonic/LESSON.md:156`).
- FACTS 27: Lesson 20 leaves the staccato dot to this page. Its Step 4 plays staccato and legato and
  defines staccato in its own words, with no dot drawn (Lesson 20's Step 4 and its FACTS 29 and 30;
  `lessons/20-runs-pentatonic/LESSON.md:61-64`).
- FACTS 33: "so "run" means on this page what it means on Lesson 20's (10)".
- FACTS 42: Lesson 20's Step 4 plays staccato and asks no one to sing it, and Lesson 20's package
  corrects the plan's coach line.

## Owner questions

None is open. Both of the plan's owner decisions were taken as recommended, per the owner's
instruction (WEB-SPEC, Decisions for the owner):

1. The title is "How to sight-sing a melody in time | MercuryPitch" (49 characters).
2. The release is after SEASON-2 § 5.2 items 10, 11 and 21, with Lesson 16.

The plan's other open questions were settled by the lead's answers:

- the breath mark at the bar line, for the coach to confirm;
- scoring in windows;
- the second tune kept, as the first cut.
