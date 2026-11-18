# Lesson 27, Seventh chords and inversions: hand-back (after the fix pass)

Package: `docs/plans/find-your-pitch/lessons/27-sevenths-inversions/` in the worktree `/dev/shm/s2plan`:
FACTS.md, LESSON.md and WEB-SPEC.md. RESEARCH.md and ARTICLE-PLAN.md are untouched. Each file is
copied to the scratch folder `s2pkg/27/`, and the copies match. No shared file, no code and no
other lesson's file was touched (Lesson 26's folder included). No git and no pnpm were run, only
the two node scripts. The arithmetic is in `s2pkg/27-tools/verify27.py`, which now has the Turn
over cycles (section 3), the level timings (6), the chord power (7) and Stack's picks (10).

## Counts

- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/27-sevenths-inversions`: 0
  findings, 273 citations read.
- `node scripts/lesson-words.mjs`: 2,195 words, under the cap of 2,379 by 184 and inside the
  2,230 aim. The steps' own text is 119, 57, 119 and 120 words, inside 50 to 120. Before the fix
  pass it was 2,178.
- Built page: about 2,345 words with its hints and held lines written out, under the cap.
- Chip: 15 minutes. That is 2,195 / 238 = 9.22 min of reading, plus 328 s (5.47 min) of sound,
  toys and tasks, 14.69 in all.
- Head: the title "Seventh chords and chord inversions | MercuryPitch" (50 characters). The
  description, with "A fifteen-minute lesson", is 147 characters.

## What changed, by finding

1. **Blocking 1, the cold open: taken, with the review's predict as the lead bound it.**
   - Tavi: "F♯ sits a semitone under G, and G is in the home chord. Won't F♯ pull hardest?"
   - Merc: "Choose, then hear both go home."
   - The stem, the choices and the reveal are the review's, word for word. Both choices still
     play.
   - FACTS 34 to 38 are rewritten. The answer is held as a convention: "counts as" for the
     restless and settled intervals, "one open textbook says" for the pull, plus the fair-guess
     sentence (FACTS 17, 18, 22, 23, 38).
   - FACTS 1a is redone in Lesson 22's way:
     - It covers each place that states or leans on the answer.
     - It gives the tour-hold argument (`step-deck.ts:5-8`, Lesson 21 FACTS 1a).
     - It says Lessons 12 and 15 give the stacking, not the pull.
     - It cites Lesson 26's teaching as taught there and no longer asked.
   - Step 2's text and card are held as a further reveal element, with the steps' held line in
     their place (`predict.ts:70-71`). This is now in WEB-SPEC Toys 1 and 3, Edge cases, and
     Tests 3.
   - The new promise is in.
   - Step 3 gains "With F♯ instead, B and F♯ are seven semitones apart, a perfect fifth, which
     counts as settled." (B3 to F♯4 is 7.)
   - WEB-SPEC Decisions 1 is gone.
2. **This lesson's tease: bound.** The line is "G, B and D going home to C, E and G. Now add one
   note on top." (61 characters).
   - The alternative is "Three notes make a chord. Add one more to V, and hear where it goes."
     (68), under the id `three-notes`, since it is not the plan's line.
   - Lesson 26's planned line and "Now stack one more third." are withdrawn.
   - FACTS 5b checks the tease against the new opening.
3. **Chord Stacker's timing: taken.** The card, the coach's list, FACTS 62, 63 and 65, and WEB-SPEC
   Practice links 1 now say:
   - notes 1 to 3 are about 0.3 s apart and cut off there, at every level;
   - the level changes the top note and the time to sing, not the pace;
   - below level 10 the top note's tail overlaps the first time to sing: up to 392 ms at level 1,
     200 ms at level 5, 8 ms at level 9.

   The help's summary line is added to the proposed help text. The wait-out fix is listed under
   kit and app work (WEB-SPEC item 10).
4. **The ring, FACTS 1a and 30.** F♯ is drawn as a black piano key: smaller (6.5 against 10.5),
   lit, with its name beside it (`spiral-draw.ts:13-15`, `:393`). That shows which note is in the
   key, not which pulls. On the ring each choice sits one bead from a corner of I.
5. **One count.** Quick check 1's A feedback now reads "G, A is two letters, a second. The seventh
   spans seven letters, G up to F." The words say "seven letters, both ends counted". FACTS 10 and
   13 cite Lesson 23 at `:195-196`.
6. **Step 4.** The reveal now reads "(Lesson 23's intervals changed names upside down, and Lessons
   10 and 12 called the root the bottom note, which made E minor a fair guess.)" It is ordered so
   that "That holds in root position." follows the bottom-note rule. "A seventh chord's third
   inversion has its seventh in the bass." To stay inside the cap, "stacked in thirds" and the
   three-positions play are cut. FACTS 1b and 49 are updated.
7. **Turn over: fixed.**
   - The press after the last inversion returns the chord to its first pitches: the third press for
     a triad, the fourth for a seventh chord.
   - Step 4's toy shows the position's name.
   - FACTS 72 lists every Turn over pitch. G5 (783.99 Hz) is the page's highest, from free play's I
     with its seventh. In the higher voice it sits in the space above the treble staff; in the
     lower voice, G4 sits on the third ledger line above the bass staff.
   - New Tests 19 checks that no press sounds a pitch outside FACTS 72.
8. **The nits**, all taken but nit 8:
   - Lesson 28's tease is bound as "seems to end". FACTS 5 says why "it sounds finished" went.
   - The sharps are printed "A#3", now on the card.
   - FACTS 62 says `CHORD_LABELS` is read by no file.
   - Step 1 reads "stacking thirds as Lesson 12 did".
   - Step 3 reads "Lesson 23's last step".
   - I is lit at first paint.
   - Tests 8 says the low notes hang under the ledger lines.
   - Length's parts are recounted: eight, with the cuts named.
   - G2 sounds in V and in V7.
   - FACTS 73 gives the power, about 1.3 dB quieter.
   - `pr.needs` is now the same here and in WEB-SPEC.
   - Also: "black key" now reads "black piano key" on the card (Lesson 21's rule).

## Not taken

- **Nit 8, the line on how Stack picks its chords.** It fits the word count, but its premise holds
  only part of the way (`verify27.py`, section 10; FACTS 67).
  - At a new ear's rating of 1200, with Stack's guess floor of 1/6, the dominant seventh comes up
    about 21% of the time. That is as often as major (21%); minor is 27%.
  - Its share rises to about 31% near a rating of 1300, then falls to 13% at 1500.
  - So "more often as you improve" holds only part of the way. A true line would cost words and
    tell the learner little.
- **The review's size predict**, offered as a fallback, is not used. The lead chose the pull
  predict.

## Departures from ARTICLE-PLAN.md

Each departure is argued in FACTS and listed in LESSON.md's preamble and WEB-SPEC's Contract:

- The predict asks the hook's own question. Both choices play.
- The hero draws two rooms, not four.
- Tavi argues F♯. The plan's Tavi line moves to Step 2's card.
- Both prerequisites are on the chips.
- The promise and the words keep the answers back.
- Step 1's V7 paragraph and the text of Steps 2 and 3 wait for the reveal.
- Step 3 has no predict, no sentence on minor and no Tavi line, and gains the F♯ sentence.
- Step 4 has a new heading. Its reveal names the two rules it breaks.
- Go deeper keeps two of its three items.
- The quick check is reworded.
- The practice card says what Chord Stacker does.
- The chip reads 15 minutes, not 14.
- Both teases are the lead's.

## Shared-file entries for the lead

### MASTER-PLAN § 11 (unchanged)

- Lesson 27: a written lesson, text only, in
  [`lessons/27-sevenths-inversions/`](lessons/27-sevenths-inversions/) (research, article plan,
  facts, copy and page spec). Its unscored sing-along and its practice card's sung drill wait on the
  vocal coach's look (§ 12 item 8). No page is built yet: it waits on Season 2's kit (seasons, the
  staff toy with both clefs and chords, SEASON-2 § 6.2, with Lesson 12's ring of rooms, its chord
  levels and Lesson 6's interval pair moved into the kit), on Lesson 23's page registering its
  quick-check questions, and on the lesson plumbing for Lessons 15 to 28 (SEASON-2 § 5.2 item 21).
  It goes live when the console publishes it, after the coach's look and once `/learn/12` and
  `/learn/23`, the pages its chips and its recall link to, are live.

### CURIOSITY-MOMENTS § 2 (the final predicts and choices, word for word)

### Lesson 27 · Seventh chords and inversions · theory; written; no page yet · hook kept

- **Opening:** Lesson 12's ring of rooms seen from above between Merc and Tavi, two rooms drawn, V
  (G, B, D) lit and I (C, E, G) faint, the black piano keys smaller and named beside their beads;
  it plays in Merc's register for everyone. Play V, then I works before the choice. Tavi "F♯ sits a
  semitone under G, and G is in the home chord. Won't F♯ pull hardest?" Merc "Choose, then hear
  both go home." Predict: "Merc puts one more note on top of G, B and D, then goes home to C, E and
  G. Which note makes the chord pull harder towards home?" [F] [F♯]. The answering plays, Play it
  with F and Play it with F♯, sound V with its fourth note and then I, growing the V room's fourth
  corner; the reveal waits for both, opens "F.", and shows Step 1's held paragraph and Steps 2 and
  3's text with it. It asks the hook's own question, a reasoning check on Lesson 23's B and F ("Lesson
  27 comes back to this pair"); F♯'s fair guess is the semitone under G. The first version asked
  which note stacks a third above D in C major, which Lesson 12 prints ("On re it's D, F, A") and
  Lesson 26 teaches and tests; the review caught it, and the lead bound this predict (Lesson 27
  FACTS 1a, 34 to 38).
- **Visual:** Lesson 12's ring (moved into the kit) beside the staff toy: a room grows a fourth
  corner; V7's diagonal, B to F, crosses the centre and folds into C and E; in Step 4 a chord turns
  over, its bottom note climbing an octave on the staff while its room on the ring stays and a mark
  moves to the corner in the bass, and the press after the last inversion brings it back. Step 4's
  predict, "Merc plays C, E and G, then moves C up an octave: E, G and C. What is the chord now?"
  [Still C major] [E minor], waits for the cold open's choice; its reveal sets Lesson 23's
  intervals, whose names changed upside down, against a chord, which keeps its name. **Payoff:**
  Step 3's tritone closing to a major third, with B and F♯ a settled fifth beside it; Step 4's room
  staying put; the sing-along, so, ti, re and fa, then mi, then do in G, unscored.
- **Tease:** on Lesson 26's card, the lead's "G, B and D going home to C, E and G. Now add one note
  on top.", with "Three notes make a chord. Add one more to V, and hear where it goes." as the
  alternative `three-notes`; the lead's first line ("Now stack one more third.") and Lesson 26's
  planned line are withdrawn, since after Lesson 26's teaching they lean on the predict. On this
  page's card, Lesson 28's: the lead's "A song in two parts. At bar 8 it seems to end, then keeps
  going."; the plan's "V7 to I sounds like the end. Songs use it to finish." is withdrawn, since no
  source says the second sentence (Lesson 27 FACTS 5, 5b).
- **Facts:** sourced in Lesson 27's FACTS: seventh chords, their names, the dominant seventh's pull,
  inversions and figures (Open Music Theory 2e, 1.17, 1.18 and 4.2), the tendencies of ti and of a
  chord's seventh (Open Music Theory 1e, 2.12); the app at `c60f0fdcb`. The "happy and jazzy" and
  "unresolved" sounds, and which of F and F♯ pulls harder, are given as one textbook's account and
  Lesson 23's convention, not as fact.

### SEASON-2 § 3, Lesson 27's card, "Closes on"

The card's last line (`docs/plans/find-your-pitch/SEASON-2.md:682-683`) is not supported:

> - Closes on: Lesson 28's hook. "V7 to I: the strongest way home, and songs use it to end. So how
>   can a song sound as if it's ending, then keep going?"

OMT's "strongest" belongs to the perfect authentic cadence. No source read says songs use V7 to I
to end. Proposed, to agree with the bound tease:

> - Closes on: Lesson 28's hook. "A song in two parts, and at bar 8 it seems to end. How can a song
>   sound as if it's ending, then keep going?"

This replaces the earlier proposal, "V7 leans towards I, and a perfect cadence lands there. …".

### `kit/season.ts` (Season 2's module)

```ts
{
  n: 27,
  lane: 'theory',
  title: 'Seventh chords and inversions',
  short: 'Sevenths',
  topics: ['T24', 'T25'],
  // A draft until its sign-off (drafts.ts), as Lesson 3 is.
  minutes: 15,
  page: '/learn/27',
  hook: 'Add one note to the V chord and it pulls towards home. Which note, and why?',
  pr: {
    needs: 'Chord Stacker opening on the dominant seventh, with triads and inversions (today it shuffles maj7, min7, dom7, dim7 and maj6); Stack with major against dominant seventh alone (the ear-drill launch kind)',
    link: {
      href: '/pitch-training?lesson=27',
      addr: 'mercurypitch.com/pitch-training',
      label: 'Exercises',
      note: 'then tap Chord Stacker',
    },
  },
},
```

`pr.needs` is word for word the same as WEB-SPEC's Explorer section. `EDGES` gains `[12, 27]` and
`[23, 27]`, so `PREREQ[27]` is `[12, 23]`.

### `kit/lesson-copy.ts` and `kit/team-notes.ts`

```ts
27: {
  tease: 'G, B and D going home to C, E and G. Now add one note on top.',
  teaseAlts: [
    { id: 'three-notes', text: 'Three notes make a chord. Add one more to V, and hear where it goes.' },
  ],
},
28: {
  tease: 'A song in two parts. At bar 8 it seems to end, then keeps going.',
},
```

No hook alternative for 27. No alternative for 28: the plan's line has no source.

`TEASE_NOTES`:

- 27 (default): "The lead's line: this page's opening in miniature, V going home, then one note on top. It names
  no note and no third, so it does not lean on the predict after Lesson 26's teaching."
- 27 `three-notes`: "Restates the predict's play and names no note. Lesson 26's planned line ('Stack one more
  on V, and it pulls.') was withdrawn: it leans on the predict."
- 28: "The lead's line, Lesson 28's opening in miniature. It names no part, note or chord, so it does
  not answer Lesson 28's predict. 'Seems to end' is as strong as Lesson 28's source, which calls the
  cadence weak; the plan's 'Songs use it to finish' was withdrawn: no source."

`SIGNATURES[27]`: "Lesson 12's rooms on the ring: the V room grows a fourth corner, ti and fa lie
straight across and fold inwards to do and mi, and a chord turns over and keeps its room."

`kit/drafts.ts`: `27: "Lessons 12 and 23's pages at /learn/12 and /learn/23, and the vocal coach's
look at the sung checkpoint and the sung drill",`

### App content: Chord Stacker's help (`src/features/exercises/exercise-help.ts:193-200`)

Today the summary reads "Add notes one at a time to build a chord in tune." The body says "each one
tuned against the notes already sounding" and "Listen for each new note to "lock in" with the
others". But nothing sounds while the learner sings: `_setTargetPitch` sets a value and plays
nothing (`use-base-exercise.ts:566-567`). Proposed:

- summary: "Hear a chord one note at a time, then sing each note back in tune."
- body: "You hear a chord one note at a time, from the root up, then sing each note back on its own." /
  "Each note is scored against the note played, in the octave it was played." / "It runs in rounds
  of five chords and scores how in tune each sung note is."

The menu card is right as it stands.

## Kit and app work the page waits for

These are WEB-SPEC's "What the kit and the app still need", items 1 to 10:

1. the lesson host;
2. the draft line;
3. seasons in the kit;
4. Lesson 12's ring of rooms in the kit, with:
   - four-corner rooms;
   - the diagonal and its arrows;
   - the bass mark;
   - Turn over, with the position's name and the return to the first pitches;
   - held chips;
   - the centre's text;
5. the staff toy's chords;
6. the chord levels (with a four-voice 0.056) and Lesson 6's pair in the kit;
7. Step 4's predict wired as Lesson 22's second predict (no kit change);
8. Lesson 23's question object;
9. Season 2 in the app's plumbing (SEASON-2 § 5.2 item 21);
10. Chord Stacker's help text and its note lengths (an app fix, not blocking).
    - Its play loop awaits `playTone`, which settles when the tone is scheduled
      (`audio-engine.ts:1104-1279`), then only `GAP_BETWEEN_NOTES_MS`, 300 ms
      (`use-chord-stacker-controller.ts:144-162`).
    - So notes 1 to 3 are cut off 0.3 s in at every level.
    - It should wait each note out, as Arpeggio Jumper does
      (`use-arpeggio-jumper-controller.ts:316-319`).
    - When that lands, the card's "about a third of a second apart" and the coach's list are looked
      at again.

Not blocking:

- Chord Stacker's chord-type field, triads and inversions (§ 5.2 item 18);
- the `ear-drill` launch kind for Stack (item 12).

## Citations of uncommitted lessons, in words

- **Lesson 26's package**, being written beside this one, is cited in words:
  - FACTS Sources, 1a (its card, its tease and its still) and 5b;
  - LESSON.md's preamble and teases;
  - WEB-SPEC's opening and Toys 8.

  Lesson 26's ARTICLE-PLAN.md is committed and cited by path: its Step 1 (`:64`), its mix-up card
  (`:77`), its quick check 1 (`:139-141`) and its tease (`:180`).
- **Lesson 28's package**, cited in words: LESSON.md's Wrap, WEB-SPEC Toys 8 and FACTS 5. Lesson
  28's ARTICLE-PLAN.md and RESEARCH.md are cited by path.

## Open

- **For the coach:** whether a figure spanning a minor seventh, reached by thirds, suits a
  sing-along. Two shorter figures are ready (LESSON.md, For the vocal coach; WEB-SPEC, Decisions 1).
