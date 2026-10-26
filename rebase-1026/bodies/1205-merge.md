Lesson 12 ("Chords and the four-chord song") draws a key's chords and their rooms, plays the four-chord loop under two tunes, and asks a quick check. This adds the facts and words its page will use, as pure modules in `src/features/lessons/lesson-12/`. No page imports them yet, and there is no `learn/12.html`, so first paint cannot move.

## What changes

- **`music.ts`**: a major key from its tonic, and its seven chords by degree, each spelled one letter per degree with its gaps, quality and numeral. It also holds:
  - each chord's room;
  - the loop I–V–vi–IV as FACTS 34 voices it;
  - the two tunes, with each note's chord and whether it lands on a corner worked out from its onset.

  G major is every sound in C, five semitones lower.
- **`numerals.ts`**: reads a numeral aloud. "vi" is "six minor", and "I–V–vi–IV" is "one, five, six minor, four". `numeralHtml` prints the numeral hidden from screen readers, with its spoken form after it, as the kit's `signsHtml` does for sharps and flats. Anything that is not a numeral throws, so a typo in fixed copy fails its test.
- **`sounds.ts`**: every fixed play as timed notes, each with its own gain and kind, so one run can start a chord and Merc's note over it together. This covers the chips, Play I then vi, the loop, the tunes, the four words and Sing it, with `slow()` and `inKey()`.
- **`lines.ts`**: the words. It holds the chips' accessible names, the live lines, Step 4's moves, the corner count, the tune buttons' names and Sing it's readout. Every name and line is words only and passes the claims check.
- **`quiz-questions.ts`**: the four quick check questions, word for word from LESSON.md, with a feedback line for each answer. Wrong answers that hold a misconception link back to their step. The two storage keys sit beside the questions.

## Commits

1. `feat(lessons): Lesson 12 music, its chords, rooms, loop and tunes`
2. `feat(lessons): Lesson 12 spoken numerals`
3. `feat(lessons): Lesson 12 sounds, every fixed play as timed notes`
4. `feat(lessons): Lesson 12 lines, the toys' names, live lines and readouts`
5. `feat(lessons): Lesson 12 quick check questions`
6. `docs(agent): regenerate the module map`

## For the owner

Two choices the spec left open, taken as recommended. Say if either should change:

1. **Single notes in the four words' arpeggios sound at 0.13**, the level of a tapped note. Chords stay at 0.075 a voice.
2. **Under Do-re-mi, the "Play I, then vi" line names the notes by syllable**: "do and mi stay, and so becomes la", where Letters reads "C and E stay, and G becomes A".

## Tests

- One test file per module, named for the spec's Tests 1 to 5, 10 and 11.
- The numerals are held against Ear Lab's own.
- The sounds test checks every fixed sound against FACTS 66 to 74: only the listed notes, each at its frequency, at the listed levels.
- Every line passes the claims check.

## Checks

Rebased onto `{{MAIN}}` on 26 October, after v0.9.22 was tagged and #1206 merged. There were no conflicts. The five code commits keep their patch-ids, and the module map commit was regenerated. On the new base:

- `pnpm check`: {{CHECK}}
- Unit tests for Lesson 12 and `src/tests/lesson-pages.test.ts`: {{UNIT}}
- `pnpm test:scripts` ({{SCRIPTS}}), `pnpm pr:validate` and `pnpm metrics:check` (no regressions): pass.
- `pnpm docs:index:check`: up to date.
- `plan-cites check`: 157 findings, the same as main.

CI runs everything again here.

On the previous base, `2404b342e`, 25 October, a few comments in `music.ts`, `sounds.ts`, `lines.ts`, `quiz-questions.ts` and two tests, and the five feature commits' messages, were reworded so that they cite only the spec, FACTS and the code. No code or test changed. There:

- `pnpm check`: no errors and the 11 warnings main already has. It changed no files.
- Unit tests for `src/features/lessons` and `src/tests/lesson-pages.test.ts`: 140 files and 1,432 tests pass.
- `pnpm test:scripts` (255 of 255) and `pnpm pr:validate`: pass.
- `pnpm metrics:check`: no regressions.
- `pnpm docs:index:check`: up to date.
- `plan-cites check`: 157 findings, the same as main.

## Left for later

- `sounds.ts` keeps its own note type. Since #1207, the kit's sound runs take a gain and a kind on each note, so the type can become the kit's `RunNote`. That is left for the Lesson 12 page, which plays these sounds.

## Merge

v0.9.22 is tagged and #1206 has merged. This merges by rebase once CI is green here. The next lesson PR is then rebased onto main and regenerates the module map.
