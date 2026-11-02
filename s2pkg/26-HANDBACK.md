# Lesson 26 hand-back: "A second voice" (first draft)

Files: `docs/plans/find-your-pitch/lessons/26-second-voice/` FACTS.md, LESSON.md, WEB-SPEC.md in
`/dev/shm/s2plan`, copied to `s2pkg/26/`. RESEARCH.md and ARTICLE-PLAN.md are unchanged. Lesson 27's
folder was read, never touched; since its commit (94997815c) it is cited by path and line (section 8).

Checks, run from `/dev/shm/s2plan`:

- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/26-second-voice`: **321
  citations read, 0 findings**.
- `node scripts/lesson-words.mjs docs/plans/find-your-pitch/lessons/26-second-voice`: **2,166
  words**, cap 2,379 (213 under), under the lead's 2,230; steps' own text 103, 97, 119, 87.
- Built page: 2,166 + about 150 (Lesson 8 FACTS 4) + 61 for this page's six lock, held and status
  lines = **about 2,377, 2 under the cap** (WEB-SPEC Length; `verify26.py` section 12). Next cut if a
  build runs over: the Wrap's "An octave further apart, a third is a tenth." (9 words), which Step 3
  says in full.
- Chip: **15 minutes** (9.10 of reading + 5.90 of sound and tasks = 15.00), where the plan said
  about 16; description **121 characters**, "Can you make a harmony by singing the tune a third
  higher? A fifteen-minute lesson with sound toys and a harmony to sing."; `timeRequired` `PT15M`;
  the head test has "fifteen" (`lesson-pages.test.ts:83`).
- No emoji (only ♯), no model name, no scratch path, no agent id in the three files.

Process: no git, no pnpm, no builds; no shared file or code touched; only the two node scripts ran.
Web sources by WebFetch (OMT 2e 1.15, 2.01, 4.04; MyMusicTheory; dictionary.com's Collins entry;
Merriam-Webster; Wikipedia, Nonchord tone and Part (music)); nothing downloaded. Arithmetic:
`s2pkg/26-tools/verify26.py` (`python3 -I verify26.py 2166`); section 13 checks Harmony Stack's
range against all six presets and its boxes' names.

The lead's note on Lesson 27's tease is applied: the card shows "G, B and D going home to C, E and
G. Now add one note on top." (61) as the default, with the lead's alternative "Three notes make a
chord. Add one more to V, and hear where it goes." (68); the plan's "Stack thirds ... it pulls." is
dropped. The check against this page is FACTS **5b** (this package numbers its own tease 5 and the
next lesson's 5b, as Lesson 24 does): neither line names a note to add or how a chord pulls, and
neither presumes anything this page does not teach.

The lead's second note (Lesson 27 committed) is applied: every citation of Lesson 27 is bound to
path and line (FACTS 5b, 71, the sources and the illustrations; WEB-SPEC, Toys 6 and Explorer and
season data), the alternative carries its id, `three-notes`, and quick check 1 keeps "the third
above D in C is F", which Lesson 27's preamble says "Lesson 26 teaches and tests"
(`27-sevenths-inversions/LESSON.md:42-45`; FACTS 71).

**The practice card now says what its drills do to a learner**, as the writers' brief asks, read
from the app (FACTS 63a, 63b, 65): Harmony Stack plays nothing, not even a first note; its scoring is
not octave-folded (`jam-pitch-view.ts:14-16`), so "not an octave away", where this page's own reader
folds; the room's tune sits in the octave the host's voice range sets (the C major scale on C3 or
C4), which, checked against all six presets, suits two lower or two higher voices and leaves a note
outside a preset for a lower and a higher voice; its boxes name their notes. One app bug found:
`harmoniseItems` (`jam-modes.ts:134-153`) moves a part's notes but keeps the tune's note names, so
the third's boxes read C4 to G4, A5 and B5 at E4 to D5; WEB-SPEC item 15 specifies the fix and its
test, and the page waits for it. The card drops the fifth (it runs a semitone past the bass preset's
top). Drone Intonation now "names a third to sing above it", as it prints the interval and the note.
Paid for by the mix-up card's app line ("MercuryPitch's Jam builds its harmony from the key's notes
on purpose.", not evidence of a key's thirds) and small trims: 3 words more in all.

## 1. MASTER-PLAN § 11 (proposed line, after Lesson 25's)

- Lesson 26: a written lesson, text only, in
  [`lessons/26-second-voice/`](lessons/26-second-voice/) (research, article plan, facts, copy and
  page spec). A voice lesson with a scored checkpoint, a part a third from Merc's tune sung with it,
  then the tune against the part, in G, with headphones, read note by note in time, and an unscored
  sing-along without them; both gates of the vocal coach bind it (§ 12 item 8). No page is built
  yet: it waits on Season 2's kit (seasons), on Lesson 18's in-time reader and count-in, on Lesson
  24's headphones and quiet checks and its kept source under a take, widened here to a sung part,
  on its own kit work (the tune line's two-part states, the reader's line for a note sung on the
  other part's note), on a lab test (silence with Merc's part from the speakers) and on the lesson
  plumbing for Lessons 15 to 28 (SEASON-2 § 5.2 item 21). Until the lab test passes, its Sing it
  ships as the sing-along only. It goes live after the coach's sign-off and once `/learn/12` and
  `/learn/24`, the pages its chips and its recall link to, are live.

## 2. CURIOSITY-MOMENTS § 2 (proposed entry; the predict and choices word for word)

### Lesson 26 · A second voice · voice; written; no page yet · hook kept

- **Opening:** Lesson 6's tune line between Merc and Tavi, "Twinkle"'s two lines in C as fourteen
  chrome beads on plain rows, the house on do, labelled "‘Twinkle’ in C major"; Play the tune works
  before the choice. Tavi: "A harmony is just the tune, higher. Move every note up a third and
  you've got one." Merc: "Let's try a major third, four semitones, above every note." Predict:
  "‘Twinkle’ is in C major. Merc moves every note up four semitones and plays the copy with the tune.
  Will every note of the copy fit the key?" [ Every note fits the key ] [ Some notes leave the key ].
  The answering play lights C major's rows as lanes and draws the copy, C♯, G♯ and F♯ landing off
  them; the reveal waits for its end, and Steps 1 and 2's words show with it. The plan's word
  "Diatonic third" is cut; the steps' stage, quick check 4's play, free play and the tour wait for
  the choice (Lesson 26 FACTS 1a, 31 to 42).
- **Visual:** the tune line with a second part a third away, brackets naming 4 or 3: the thirds up
  the scale, "Twinkle"'s copy bending to the key (the signature), a part above or below, Merc and
  Tavi a tenth apart in blue and orange, a C major chord lighting chord notes gold and leaving a
  passing note hollow. **Payoff:** the reveal (a copy moved four semitones leaves the key; the key's
  own thirds fit); Step 1 (major on do, fa and so, minor on re, mi, la and ti); Sing it, a part a
  third from Merc's tune sung with it, then the tune against it.
- **Tease:** Lesson 27's still, its ring with the V room lit, silent: "G, B and D going
  home to C, E and G. Now add one note on top." (the lead's line, default), with the lead's
  alternative "Three notes make a chord. Add one more to V, and hear where it goes." Lesson 26's own
  tease, on Lesson 25's card, is "‘Twinkle’, and the same tune four semitones higher, played
  together.", with the alternative `plan` (Lesson 26 FACTS 5, 5b).
- **Facts:** sourced in Lesson 26's FACTS: thirds in a key and compound intervals (OMT 2e 1.15),
  consonances (2.01), passing notes (OMT 2e 4.04; MyMusicTheory; Collins; Merriam-Webster; Wikipedia),
  "part" (Wikipedia), singers in pairs (Dai & Dixon 2019, as Lesson 24 reads it); the app at
  `c60f0fdcb` (Jam's Harmony Stack and its diatonic harmony, Drone Intonation's thirds, the kit).

## 3. Shared-file entries for the lead

1. **SEASON-2's card for Lesson 25, "Closes on"** (`SEASON-2.md:627-628`), already flagged by Lesson
   25's package (its FACTS 5): "So far you've sung against a drone that never moves." is false, since
   Lesson 12's sing-along sang roots over moving chords. Proposed: "Lesson 24's other part was a
   drone. Now let the other part be a tune: can you make a harmony by singing the tune a third
   higher?"
2. **SEASON-2's card for Lesson 26, "Closes on"** (`SEASON-2.md:653-654`), optional: its lead-in,
   "Stack thirds and you get chords: three notes, Lesson 12. Add a fourth to the V chord and it pulls
   towards home.", is the dropped `plan` tease's idea; if the lead aligns the card with the bound
   tease, "G, B and D going home to C, E and G. Now add one note on top. Add one note to the V chord
   and it pulls towards home. Which note, and why?"
3. **SEASON-2 § 6.2 item 5** (`SEASON-2.md:981-983`), a note: two parts note against note already
   play together through `playNotes` (one timer task per onset, `kit/run.ts:9-10`); what is missing
   is a part under a take, which Lesson 26's WEB-SPEC item 6 specifies as Lesson 24's kept source
   widened to a sung contour voice, booked through `at`, with a level dip for repeated notes, for
   Lesson 28 too.
4. **SEASON-2 § 6.2 item 7** (`SEASON-2.md:985-990`), a note: Lesson 26 offers no turn-taking
   fallback; without headphones the learner sings along with the other part and nothing listens, so
   the harmony is heard live on every device (Lesson 26 FACTS 62). Lesson 28 may decide otherwise
   for its playback.
5. **Lesson 28's plan, its recall** (`lessons/28-cadences-form/ARTICLE-PLAN.md:72-74`): it quotes
   Lesson 26's question 2 "as Lesson 26's ARTICLE-PLAN writes it"; the page's words are now "A friend
   harmonises a tune in C major by moving every note up four semitones. What happens?" with "Some
   notes leave the key", "Every note stays in the key" and "It turns into a different tune"
   (Lesson 26 FACTS 72). Lesson 28 imports the object, so it takes these words.
6. **SEASON-2 § 5.2** (app work), a proposed item: Jam's Harmony Stack names each part's own notes
   on its boxes; today a part above the tune keeps the tune's names (`jam-modes.ts:134-153`). One
   line and a test; Lesson 26's page waits for it (its WEB-SPEC item 15).

## 4. `kit/season.ts` (Season 2's module) entry and prerequisites

```ts
{
  n: 26,
  lane: 'voice',
  title: 'A second voice',
  short: 'Second voice',
  topics: ['S20b', 'T23'], // "Sing a second part with a melody"; "Chord tones and non-chord tones" (light)
  // A draft until its sign-off (drafts.ts), as Lesson 3 is.
  minutes: 15, // once the page is built
  page: '/learn/26', // once the page is built
  hook: 'Can you make a harmony by singing the tune a third higher?',
  pr: {
    needs: 'The harmony-line drill (SEASON-2 § 5.2 item 17)',
    link: {
      href: '/jam?lesson=26',
      addr: 'mercurypitch.com/jam',
      label: 'Harmony Stack',
      note: 'with a friend: the host picks Harmony Stack',
    },
  },
}
```

- `EDGES` gains `[12, 26]` and `[24, 26]`; `PREREQ[26]` is then `[12, 24]`.
- `drafts.ts`: `26: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`.
- `team-notes.ts` `SIGNATURES[26]`: "Lesson 6's ‘Twinkle’ copied a third higher, the copy bending to
  the key's rows: some thirds four semitones and some three."

## 5. `kit/lesson-copy.ts` and `kit/team-notes.ts`

- Lesson 26 (set on Lesson 26): no hook alternatives; `tease` "‘Twinkle’, and the same tune four
  semitones higher, played together." (68), bound by the lead; `teaseAlts` `[{ id: 'plan', text:
  "Lesson 24's other part was a drone. What if it's a tune?" }]` (56); `TEASE_NOTES[26].plan`: "The
  plan's line, mended: its ‘So far the other part was a drone’ was false, since Lesson 12's
  sing-along had the learner sing over moving chords. It is true of Lesson 24 and answers nothing of
  the predict; the lead's line, the opening in miniature, is the default."
- Lesson 27 (set on Lesson 27, by its package, `27-sevenths-inversions/WEB-SPEC.md:385-388`): the
  lead's "G, B and D going home to C, E and G. Now add one note on top." (61) as default, the lead's
  "Three notes make a chord. Add one more to V, and hear where it goes." (68) as `three-notes`.

## 6. Kit and app work the page waits for (WEB-SPEC, What the kit and the app still need)

1. The lesson host, the draft line, seasons in the kit (items 1 to 3).
2. Lesson 18's pieces, cited by path and line (item 4): the sing flow with a take read in time and
   `kit/read-in-time.ts` (its item 7), the woodblock and count-in (its item 5), the planning-text
   test's codes, S20b among them (its item 16). This page's additions to the reader: the other part's
   notes as input, and the rule and line for a note sung on the other part's note ("Do · That was
   Merc's note: mi."), read before the neighbour rule; three takes a set and a model before each run.
3. Lesson 24's checks (its item 6), with the check's line naming "Merc's part" or "Tavi's part" and
   the quiet check playing the set's other part (item 5).
4. A part under a take (item 6): Lesson 24's one kept source widened to any one voice built before
   the hush; the other part as one contour voice booked through `at` on bar 1's first beat; a level
   dip between two notes on one pitch, for Lesson 28's song.
5. The tune line's two-part states on the kit's `tune-line.ts` (item 7): a second solid line, lanes,
   brackets between lines, names on off-lane beads, Step 1's pair walk, Step 2's switch, Step 3's
   switch and Merc and Tavi state, Step 4's chord bar with gold and hollow beads, the lock in the
   step and in free play, spoken summaries.
6. The lab test (item 8): silence with Merc's part from the speakers must fail the quiet check or
   read no voice, never notes in the band or "That was Merc's note"; Bluetooth earbuds; Lesson 18's
   reader values with a part playing; the other part's level; C3 and E3 on a phone's speaker; the
   states' timing for the chip.
7. The head and share card, Lesson 24's questions as a module, the lesson copy, the plumbing
   (SEASON-2 § 5.2 item 21) (items 9 to 12).
8. The app (item 13): the harmony-line drill (SEASON-2 § 5.2 item 17), which then takes the card's
   first place.
9. The app (item 15), before the page: Harmony Stack's boxes name each part's own notes
   (`harmoniseItems` names a moved note from its MIDI number; the jam-modes test pins the name).

## 7. Departures from ARTICLE-PLAN.md, and why

Each is argued in FACTS (numbers in brackets) and listed in LESSON.md's preamble.

1. **One object, the tune line**, with C major's rows lit as lanes, in place of Lesson 2's ring
   beside the contour and as Step 1's toy: one object for one idea, pitch as height throughout (31).
2. **The hero on plain rows**: the plan lit C major's notes before the choice, which lets the predict
   be counted out; the lanes light with the answering play (1a, 32).
3. **The predict's choices**, "Every note fits the key" and "Some notes leave the key", for "Every
   note fits" and "Some notes stick out", which claimed how notes sound; Merc names "a major third,
   four semitones" (33, 34). The reveal counts the copy's notes off the key by the tune's notes, and
   its fair-guess line leans on Lesson 6's transposing, not "works in Lesson 6" (35, 36).
4. **The recall asks Lesson 12's question 3**, not question 2, whose answer ("it's minor", "D, F, A")
   gave the predict's premise right under it (7).
5. **Three words**: "Diatonic third", "sometimes 4 semitones, sometimes 3", is cut: it answered the
   predict from below it (1a, 39). "Harmony part" became "Part", which the swap needs for the tune
   too (24).
6. **Locks and held words**: the steps' figure, quick check 4's play and free play wait for the
   choice; Steps 1 and 2's words for the reveal; the tour for the choice (40, 41).
7. **A third counts three letters, both ends counted**, as Lessons 10 and 23 count, where the plan
   said "two letters up" (11).
8. **Step 2's heading** "Is a harmony the tune moved up?" for "Why not move every note the same
   distance?", which presumed the answer from the lesson menu (42). Its text counts the thirds by the
   tune's six notes, three of each size, where RESEARCH counted eight pairs, five and three (14); it
   drops "which is why the pair blends", which no source says (16).
9. **Step 4 has no predict**: the plan's named the chord's notes in its question, so it answered
   itself (21).
10. **Sing it in G, each voice in its own octave**: the plan's tune on C4 for both voices left the
    bass preset 0 semitones at its top and the soprano 0 at its floor in the swap, so its "inside
    every preset" was not true; in G every preset keeps 3 or more (50). No Move do (three semitones of
    reach) and no other octave (both fail a preset), with the coach asked.
11. **One pass of the tune a run**, the last note held two beats, where the plan played it twice: a
    run is one take of five notes for Lesson 18's reader, and Again sings it again (54).
12. **A model before each run**: Merc or Tavi sings the learner's part alone first (54, 55).
13. **Lesson 18's reader with one new line**, for a note sung on the other part's note, read before
    the neighbour rule (58), the lead's answer 2.
14. **The sets and the swap**: three takes a set, as Lesson 24's sets; the swap after Easy or
    Workable, with new lines (56, 57).
15. **No turn-taking version and no recorder**: without headphones the learner sings along with the
    other part and nothing listens, where the plan's interim had the line sung after the tune with
    nothing to harmonise with; the recorder is Lesson 28's, the lead's answer 3 (30, 61, 62).
16. **The quick check**: question 1 reworded and sent to Step 1; question 2 names the key, its wrong
    answers in the predict's words and as Lesson 6's misconception; question 4's play, do re mi re do
    with the two parts, is new and locked until the choice (71 to 74).
17. **The practice card**: Harmony Stack first, with how a friend joins and what the room does to a
    learner (nothing played, the octave scored and who sets it, the pairs of voices it suits, its
    boxes' names), the tune for the plan's "root", and no fifth; Drone Intonation second, in Lesson
    24's words, cut, naming its note; the rest card names Harmony Stack (63 to 68).
18. **The chips** name both prerequisites and read 15 minutes; "Microphone optional" and "Headphones
    optional" (2, 3). **The sound gate** drops "how one fits the other", which pointed at the predict
    (6). **The promise** says what the learner does (1).
19. **The next-lesson tease** is the lead's new line; the plan's is dropped (5b).

## 8. Citations of other lessons' new work

None is left in words. **Lesson 27**, committed: FACTS 5b (its tease and `three-notes`,
`FACTS.md:45`, `WEB-SPEC.md:385-388`; its predict, `LESSON.md:140-142`; its still,
`WEB-SPEC.md:314-317`), 71 (`LESSON.md:42-45`) and the illustrations; WEB-SPEC, Toys 6 and Explorer
and season data. **Lesson 28's ARTICLE-PLAN.md**, which was in the checkout from the start, is now
cited by path and line too: FACTS 18 (`:137-140`), 30 (`:162-163`), 72 (`:72-74`). If it turns out
not to be committed, those three go back to words.

## 9. Questions for the owner, the lead and the coach

1. **The head's title** (lead): "How to sing a harmony in thirds | MercuryPitch" (46), proposed;
   it names no answer (WEB-SPEC, Decisions for the owner).
2. **The chip** (lead): 15 minutes by the series' method, where the plan said about 16; the lab
   sets it.
3. **Move do** (coach): not offered; a do moved two semitones down or one up would keep every preset
   two inside. Should a learner for whom the top or bottom feels hard get those three semitones?
4. **The reader's new line** (coach and lead): "Do · That was Merc's note: mi." for a note sung on the
   other part's note. It says where the note sat, never why; Lesson 28 will reuse it.
5. **No turn-taking** (lead): the season's fallback is not offered, since the sing-along gives the
   harmony live on every device; confirm.
6. **The coach's list** in LESSON.md: the two parts and the table, the tempo and the run, the cues,
   the swap, the sets, the sing-along and its line, the headphones and quiet checks' lines with
   "Merc's part", Harmony Stack's range and its table, and the plain-language labels question shared
   with Lessons 3 to 24.
7. **Harmony Stack's note names** (lead): fix first (WEB-SPEC item 15), as the package assumes, or
   link the room before it with the card's fallback, "It plays nothing; on the third, its boxes print
   the tune's letters." (4 words more, paid by the next cut).
8. **"Two lower or two higher voices suit it"** (coach): true against all six presets for the tune
   and the third, but the tenor's and the soprano's floors meet the tune's first note, C3 or C4, with
   no room; confirm the line.
