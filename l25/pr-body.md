## What this is

Lesson 25's page at `/learn/25`, "Minor, properly", a Season 2 page and a draft. The whole page is built and held back on mercurypitch.com until Lessons 10, 21 and 23's pages are live and the vocal coach has looked at its sung checkpoint and its sung drill; dev and the previews show it. It is built from its package (LESSON.md, FACTS.md, WEB-SPEC.md), and the spec's new "As built" section records every place the page differs from the text.

**Stacked on #1408, which is stacked on #1407 and #1406.** This branch starts from Lesson 20's, so this PR is based on `feat/lesson-20-page` and shows only Lesson 25's commits. Once #1406, #1407 and #1408 merge, the branch is rebased onto main and the PR moves to main, where CI runs.

## The page

- **Cold open.** A four-bar tune on Lesson 10's minor staircase on A, between Merc and Tavi: Play the tune, twice, the second time with G♯, te lifting to ti as it sounds. The predict asks what raising G to G♯ does to the chord before home: "It turns major" or "It stays minor". The choice ends the tune and opens Play ending 1 and Play ending 2, with chords; as each ending's chord before home sounds, a column of three beads draws beside the stairs, E, G and B, then E, G♯ and B, its gaps counted and its name shown. The reveal follows once both endings are heard.
- **Recall.** Lesson 10's and Lesson 21's own questions.
- **Four words.** Natural minor, Harmonic minor, Melodic minor and Relative keys, each a small staircase that plays its scale.
- **Four steps on one toy:** the minor staircase with its chord column, over the learner's staff. Step 1's Raise te turns the chord on so major; Step 2 outlines harmonic minor's widest stair, le to ti, 3 semitones; Step 3's Raise le gives melodic minor, raised going up and natural coming down; Step 4 plays C major, then A minor on the same white piano keys, their shared empty signature on the learner's staff and on a small staff in the other clef, then C minor, whose three flats move into both signatures.
- **Sing it.** The comfort check and the voice choice, then Merc's so, te, do, a breath, then so, ti, do on the learner's staff (Tavi's an octave higher), and the guide's sweep to sing along with. Nothing listens and nothing is scored.
- **Quick check.** Four questions, the last with its play.
- **Wrap.** Ear Lab's Gravity in the app, with Sight-Singing as the second drill, or the rest line after Effortful, Uncomfortable or Just listen today; the next-lesson card with Lesson 26's still; free play with every control from the steps, its chord held until the choice.

## Kit changes

- `kit/chords.ts`, `kit/chord-layout.ts` and `kit/chord-beads-draw.ts`: Lesson 10's chords, chord layout and bead painter move into the kit, Lesson 10's page on them unchanged. `kit/chord-column.ts` (new): a chord's three beads beside a staircase, on its rows.
- `kit/sound.ts`: Lesson 12's chord levels move into the kit's sound module.
- The staircase (`kit/stairs-core.ts`, `stairs-draw.ts`, `stairs-geometry.ts`): slides a stair, keeps room for a chord column at its right, outlines a riser, keeps do's house under the riser label in its block's corner where the two would meet, and lands a move of no time at once (a frame of no time after a tonic set with no glide left it drawing nowhere).
- The staff toy (`kit/staff.ts`, `staff-draw.ts`): writes a chord in one column, moves a sign into the signature in a page's time, and gives a score whose notes carry signs two and seven tenths spaces a note, so a sharp or a flat stands clear of the note before it on a phone.
- The step deck (`kit/step-deck.ts`): never scrolls a step taller than the screen past its own head, and `showToy()` brings a phone's stage into view for a play from a step's text.

## Measures

- First paint for `learn/25.html`: 203,405 bytes of script against a 249 KB ceiling, and 92,872 of CSS against 114 KB, both a quarter over the measure. Merc and Tavi's renderer and the last screen's way back to the plan load after first paint. Every other page is within its ceiling.
- Length: counted as the built page shows it, about 2,315 words, 64 under the series' cap of 2,379, so no cut is made.

## Testing

- `pnpm check` passes, the metrics ratchet reports no regressions, and `pr:validate` passes on every changed file.
- Unit tests: `src/features/lessons`, the lesson pages' test, the hub's and the admin console's lessons, 5,649 tests, all pass.
- Browser tests: every `learn-*` spec and the stage-and-tour focus spec: 1,337 pass and 2 are skipped, since this branch changes the kit's staircase, staff toy and step deck that every lesson page uses. Lesson 25's own spec, 18 tests: the page loads and boots, the cold open, nothing answering the predict before the choice, each step's controls, the four words, Sing it, one sound at a time, privacy (no microphone asked, nothing sent away, only the page's own keys kept), and every target at 390 and 344 px.
- Two review rounds in a real browser at 390, 344 and 1440 px and a phone held sideways, with a fresh critic for the first. No console errors, no failed requests, no sideways scroll. They found these, each fixed in its own commit:
  - Step 4's and free play's small staff in the other clef was drawn over the learner's staff, and caught its taps.
  - The four words' figures sat at 184 by 92 px in the middle of their tickets (Lesson 20's page has the same, fixed on #1408).
  - On a phone a play in a step's sentence, or low in free play, sounded with its figure scrolled away above the screen.
  - At 1440 by 900, Step 3, taller than the screen, opened with its heading under the masthead (kit step deck).
  - At 390 and 344 px Sing it's G♯ sharp overlapped the E before it (kit staff toy).
  - Before the choice, free play's melodic minor switched the held Raise te and Raise le on, where they could not be switched off.
  - Several plays said nothing to a screen reader; a switch that moved the other said only one; the figure's name left out the chord column; one line said "white keys".
  - A press on Play ending 1, which the choice focuses, did nothing while the tune still played.
  - A frame of no time after a tonic set with no glide left the staircase drawing nowhere (kit staircase).
- `plan-cites` reports 301 findings, the same as Lesson 20's branch: none from this one.
- Lesson 25's entry on the hub changes `/learn/`'s fingerprint; its own commit records it from a production build.

## For the owner's polish

- At 344 px, after the choice, the hero's staircase narrows to leave the chord column its room: its stairs are about 14 px wide, and the riser numbers crowd the house on the top do.
- "See it on the pitch line" swaps the whole figure for the staff's pitch line, chord column and all, as Toys 1 has it, so with it on, Raise te shows nothing of the chord on so.
- The figure label says "beside your staff", LESSON.md's words, while the staff stands under the staircase except on a phone held sideways.
- "Play Merc's notes" keeps its name when Tavi sings the higher line, as on Lesson 23's page.
- The practice card runs the column's full width, about 150 characters a line at 1440 px, as Lessons 21 and 23's do.
- The hero's five chips take four rows at 390 px, the spec's two or three being too few for the three prerequisite chips.
- Harmonic and melodic minor's word figures rest on natural minor until their play lifts their stairs, as Toys 4 has them, so three tickets look alike at rest.
- Lessons 20 and 24 also have plays in their step text; the kit's `showToy()` is here for them, unused there yet.

## Still to do before release

- Lessons 10, 21 and 23's pages live, which the prerequisite chips and the recall link to.
- The vocal coach's look at Sing it, its voice lines and the sung drill.
- A real phone, by ear: the tune and its two endings, the chords at their level, the scales, and Merc's and Tavi's lines.
