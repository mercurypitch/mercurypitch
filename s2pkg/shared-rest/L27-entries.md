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

