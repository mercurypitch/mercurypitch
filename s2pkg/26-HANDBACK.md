# Lesson 26 hand-back: "A second voice" (fix pass)

Files: `docs/plans/find-your-pitch/lessons/26-second-voice/` FACTS.md, LESSON.md, WEB-SPEC.md in
`/dev/shm/s2plan`, copied to `s2pkg/26/`. RESEARCH.md and ARTICLE-PLAN.md are unchanged. Lesson 27's
folder was read, never touched; since its commit (94997815c) it is cited by path and line (section
8). This pass answers the independent review (`26-REVIEW.md`: 2 blocking, 6 should fix, 11 nits)
with the lead's calls in `26-FIXPASS-MSG.md` (section 0).

Checks, run from `/dev/shm/s2plan` after the last edit:

- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/26-second-voice`: **350
  citations read, 0 findings** (321 before the pass).
- `node scripts/lesson-words.mjs docs/plans/find-your-pitch/lessons/26-second-voice`: **2,052
  words**, cap 2,379 (327 under); steps' own text 108, 83, 101, 83 (before the pass 2,166; 103, 97,
  119, 87).
- Built page, counted as the review counts it: 2,052 + 150 (Lesson 8 FACTS 4) + 168 for every line
  this page adds that the counter would count, the review's list among them = **about 2,370, 9
  under the cap** (WEB-SPEC Length and FACTS 3 list the 168 line by line; `verify26.py` section 12).
  Marks on a figure that are a numeral or a single name (the brackets' 4s and 3s, the beads'
  sharps, the lines' tags, the syllables under Sing it's bands) are not counted, as a chart's ticks
  are not. Next cut if a build still runs over: the reading's example of the octave line, "Added
  when it applies: "You sang it an octave lower: same note."" (11), which the reader still gives.
- Chip: **16 minutes**: 2,370 / 238 = 9.96 minutes of reading + 5.90 of sound, toys and tasks =
  15.86 (the text count alone gives 14.52); FACTS 3 says the lab may move it. Head description **121
  characters**, "Can you make a harmony by singing the tune a third higher? A sixteen-minute lesson
  with sound toys and a harmony to sing."; `timeRequired` `PT16M`; `minutes: 16`; the explorer's
  "16 min"; the head test has "sixteen" (`lesson-pages.test.ts:84`). Head title "How to sing a
  harmony in thirds | MercuryPitch" (46), the lead's choice.
- No emoji (only ♯), no model name, no scratch path, no agent id in the three files.

Process: no git, no pnpm, no builds, no browsers; no shared file or code touched; only the two node
scripts ran. Nothing was fetched or downloaded in this pass. Arithmetic: `s2pkg/26-tools/verify26.py`
(`python3 -I verify26.py 2052`); section 12 is the built page's list, section 13 Harmony Stack's
range against all six presets and its boxes' names.

Lesson 27, as the lead's two notes set it: the card shows "G, B and D going home to C, E and G. Now
add one note on top." (61) as the default, with the alternative `three-notes`, "Three notes make a
chord. Add one more to V, and hear where it goes." (68); the plan's "Stack thirds ... it pulls." is
dropped (FACTS 5b). Quick check 1 keeps "the third above D in C is F", which Lesson 27's preamble
says "Lesson 26 teaches and tests" (`27-sevenths-inversions/LESSON.md:42-45`; FACTS 71).

## 0. The fix pass, finding by finding

- **B1, taken.** Toys 2 specifies the pre-choice state once: until the cold open's choice the steps'
  stage and free play draw the hero's state, "Twinkle" alone on plain rows (no lane, no second line,
  no bracket, no name on a bead), with the hero's spoken summary, every control and play disabled
  with its name kept under "Choose an answer at the top to unlock this figure."; `onChoice` draws
  each step's own state, `unlocks` enables the controls, and a return visit holds them again.
  LESSON.md's four toy lines and free play's line, FACTS 40, the Look's lane rule, Tests 5, Page QA
  and kit item 7 say the same, citing Lessons 25 and 27's locked stages
  (`25-minor-properly/WEB-SPEC.md:241-245`, `27-sevenths-inversions/WEB-SPEC.md:213-214`). Sing it,
  the second option: Page QA's line is narrowed to "lights a C major lane", and Sing it's figure (G's
  lanes), its part lines and "Just listen today"'s Play the two parts are in FACTS 1a's open list,
  beside Steps 3 and 4, with the tour-hold argument.
- **B2, taken.** The card's order is the one that works today: "With a friend: set your Singing
  Voice Range in Settings, open a Jam room and share its link; once your friend is in, pick Harmony
  Stack under More controls." FACTS 63b (the range read as tenor until set,
  `settings-store.ts:298-299`) and FACTS 64 (the late-join gap, each step cited: `selectJamRoomMode`,
  `broadcastData`, `onPeerJoined`, the new channel's video state and background, the guest's start in
  unison, the two-peer check's order) are corrected; `pr.link.note` is "with a friend: once they
  join, the host picks Harmony Stack"; Page QA's two-peer check follows the card's order, with one run
  swapped to show the late-join case. New app item, WEB-SPEC item 16: the host sends the drill and
  the mode to a peer whose channel opens, as it does a song, with a test that a late joiner gets
  both.
- **Call 3, Harmony Stack's names.** The card's line is the as-is sentence, "It plays nothing; on the
  third, its boxes print the tune's letters.", counted in the length. Practice links, item 15, FACTS
  63a, the card's editorial and LESSON.md's preamble say it becomes "It plays nothing; its boxes name
  their notes." when item 15 ships; the preamble no longer says the page waits on an app fix.
- **S1, taken.** Spans only, Lesson 23's rule: Step 1, "A third spans three letters, both ends
  included, as in Lesson 23: C, D, E. Above each note of C major, take the key's own note a third
  up: C to E, D to F, E to G."; quick check 1's E, "D, E is two letters: a second.", Lesson 27's form;
  Step 3, "the same letter names"; Step 1's bracket, "D up to F: 3 semitones". FACTS 11 and 71 match,
  citing `23-perfect-tritone/LESSON.md:195-196` and `27-sevenths-inversions/LESSON.md:348`.
- **S2, taken.** "That's why Lesson 12's chord on re, D, F and A, is minor: D up to F is 3, then F up
  to A is 4." and the Notice "4, 3, 3, 4, 4, 3, 3: major thirds on do, fa and so; minor thirds on re,
  mi, la and ti." FACTS 12 and 13 match, with Lesson 12's vii° (`12-chords-four-chord-song/LESSON.md:168-169`).
- **S3, taken.** "Two lower or two higher voices suit it" went with B2's rewrite; FACTS 63b says why
  (0 semitones of room at the tenor's floor and the soprano's, under the series' two); the six-row
  table stays on the coach's list, with "Should the card advise on pairing at all?".
- **S4, taken.** Cuts 1 to 5 in the review's order: the Wrap's tenth line (9); Step 3's Sing it line
  (16); "Both sizes count as consonances." (5); "your pitch line appears, with" (5); Drone
  Intonation's range line, now "It too wants each note in the octave your range sets." (N4). Then
  the built page counted as the review counts it, and cut further: the reserve line "Listen to the
  tune as you sing." (7) first, with Your turn rewritten so one briefing serves every set, then this
  package's own choices, named in WEB-SPEC Length and FACTS 3. Added in the same pass: S2's 9 words,
  question 4's "in C major" (3) and B2's steps.
- **S5, taken.** 16 minutes everywhere: the chip, "A sixteen-minute lesson", `PT16M`, `minutes: 16`,
  "16 min"; FACTS 3 says the lab may move it.
- **S6, taken.** The learner's own part keeps Lesson 18's anchor unchanged, so a late start still
  reads its notes; the "on the other part's note" line compares each frame with the note the other
  part is sounding at that frame's audio-clock time, the part as played, never an anchored beat
  (Toys 5; FACTS 58; kit item 4; the round trip measured in the lab, item 8). Tests 7 adds the
  synthetic case: the lower part's singer one beat late on Merc's sounding notes reads "La · That was
  Merc's note: re.", then mi, re, do and do.
- **Nits, all taken.** N1: 20 rows, about 180 px (FACTS 80; Toys 2 Layout). N2: Toys 1's summary,
  "six of its notes, on C sharp 5, G sharp 4 and F sharp 4", and the beads' names C♯, G♯ and F♯ in
  both files. N3: Toys 2 Layout makes only the controls targets; beads and brackets are drawn, not
  buttons (`beadButtons`, `brackets`, `tune-line.ts:70-73`). N4: with S4's cut 5. N5: "Duet: two
  parts, and any octave counts"; the section is "Sing it: two parts". N6: Your turn's first line
  names the set's part ("la ti do ti la, a third below the tune"; the higher voice's "mi fa so fa mi,
  a third above the tune"; the swap's "do re mi re do, the tune"), the rest of it the same in every
  set. N7: question 4, "A tune in C major with two parts above it". N8: FACTS 50 calls the voice
  buttons Lesson 3's, word for word, naming the voice. N9: section 3, entry 7. N10: quick check 2's
  answers wait for the choice under "Choose an answer at the top to try this." (FACTS 1a, 40, 72;
  Tests 5 and 6). N11: item 15 and FACTS 63a note the stale comment (`jam-modes.ts:210-211`).

## 1. MASTER-PLAN § 11 (proposed line, after Lesson 25's)

- Lesson 26: a written lesson, text only, in
  [`lessons/26-second-voice/`](lessons/26-second-voice/) (research, article plan, facts, copy and
  page spec). A voice lesson with a scored checkpoint, a part a third from Merc's tune sung with it,
  then the tune against the part, in G, with headphones, read note by note in time, and an unscored
  sing-along without them; both gates of the vocal coach bind it (§ 12 item 8). No page is built
  yet: it waits on Season 2's kit (seasons), on Lesson 18's in-time reader and count-in, on Lesson
  24's headphones and quiet checks and its kept source under a take, widened here to a sung part,
  on its own kit work (the tune line's two-part states and its locked stage, the reader's line for a
  note sung on the note the other part is sounding), on a lab test (silence with Merc's part from
  the speakers) and on the lesson plumbing for Lessons 15 to 28 (SEASON-2 § 5.2 item 21). Until the
  lab test passes, its Sing it ships as the sing-along only. Its practice card describes Jam's
  Harmony Stack as the app is today; two app items would mend the room (section 3, entry 6). It goes
  live after the coach's sign-off and once `/learn/12` and `/learn/24`, the pages its chips and its
  recall link to, are live.

## 2. CURIOSITY-MOMENTS § 2 (proposed entry; the predict and choices word for word)

### Lesson 26 · A second voice · voice; written; no page yet · hook kept

- **Opening:** Lesson 6's tune line between Merc and Tavi, "Twinkle"'s two lines in C as fourteen
  chrome beads on plain rows, the house on do, labelled "‘Twinkle’ in C major"; Play the tune works
  before the choice. Tavi: "A harmony is just the tune, higher. Move every note up a third and
  you've got one." Merc: "Let's try a major third, four semitones, above every note." Predict:
  "‘Twinkle’ is in C major. Merc moves every note up four semitones and plays the copy with the tune.
  Will every note of the copy fit the key?" [ Every note fits the key ] [ Some notes leave the key ].
  The answering play, unlocked by the choice, lights C major's rows as lanes and draws the copy, six
  of its beads landing off them, named C♯, G♯ and F♯; the reveal, "Some notes leave the key.", waits
  for its end, and Steps 1 and 2's words show with it. The plan's word "Diatonic third" is cut. Until
  the choice the steps' stage and free play draw only the hero's plain "Twinkle", their controls
  disabled, and quick check 2's answers, quick check 4's play and the first-visit tour wait too
  (Lesson 26 FACTS 1a, 31 to 42).
- **Visual:** the tune line with a second part a third away, brackets naming the semitones: the
  key's thirds walked up the scale ("D up to F: 3 semitones"), "Twinkle"'s copy bending to the key
  (the signature), a part above or below, Merc and Tavi a tenth apart in blue and orange, a C major
  chord lighting chord notes gold and leaving a passing note hollow. **Payoff:** the reveal (a copy
  moved four semitones leaves the key; the key's own thirds fit); Step 1 (major thirds on do, fa and
  so; minor thirds on re, mi, la and ti); Sing it, a part a third from Merc's tune sung with it, then
  the tune against it.
- **Tease:** Lesson 27's still, its ring with the V room lit and the I room faint, Merc and Tavi,
  silent: "G, B and D going home to C, E and G. Now add one note on top." (the lead's line, default),
  with the lead's alternative `three-notes`, "Three notes make a chord. Add one more to V, and hear
  where it goes." Lesson 26's own tease, on Lesson 25's card, is "‘Twinkle’, and the same tune four
  semitones higher, played together.", with the alternative `plan`, "Lesson 24's other part was a
  drone. What if it's a tune?" (Lesson 26 FACTS 5, 5b).
- **Facts:** sourced in Lesson 26's FACTS: thirds in a key, counted as spans as Lesson 23 counts
  them, and compound intervals (OMT 2e 1.15), passing notes (OMT 2e 4.04; MyMusicTheory; Collins;
  Merriam-Webster; Wikipedia), "part" (Wikipedia), singers in pairs (Dai & Dixon 2019, as Lesson 24
  reads it); the app at `c60f0fdcb` (Jam's Harmony Stack, its diatonic harmony, its boxes' names and
  its late joiner, Drone Intonation's thirds, the kit).

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
   (Lesson 26 FACTS 72). Lesson 28 imports the object, so it takes these words. On Lesson 26's page
   the question waits for the cold open's choice; as Lesson 28's recall it needs no hold.
6. **SEASON-2 § 5.2** (app work), two proposed items, numbered on from item 21 (the lead lists both
   for the owner):
   - **Harmony Stack's note names** (code with a test, small): `harmoniseItems` moves a part's notes
     but keeps the tune's note name (`src/lib/jam/jam-modes.ts:134-153`), so the third's boxes over
     the C major scale on C4 read C4 to G4, A5 and B5 where they sit at E4 to D5; the fix names each
     moved note from its MIDI number, and the test that pins the octave and frequency
     (`src/tests/jam-modes.test.ts:108-114`) pins the name too. The same edit can mend the comment
     "a fourth singer lands on the seventh" (`src/lib/jam/jam-modes.ts:210-211`): `roleCountFor`
     caps the parts at three, and a fourth singer sings the tune. Lesson 26's card describes the
     boxes as they are until it ships (Lesson 26 WEB-SPEC item 15).
   - **Harmony Stack for a friend who joins late** (code with a test, small): the mode and the drill
     go only to channels open when the host picks the mode (`selectJamRoomMode`,
     `src/stores/jam-store.ts:1297-1302`; `broadcastData`, `src/lib/jam/service.ts:1131-1138`), and
     a joining peer is sent only a song (`onPeerJoined`, `src/stores/jam-store.ts:1970-1983`), so a
     friend who joins after the pick stays in unison on their own scale. The host sends the drill
     and the mode to a peer whose channel opens, as it does a song, with a test that a late joiner
     gets both. Until it ships, Lesson 26's card has the friend join first (Lesson 26 WEB-SPEC item
     16).
7. **Lesson 25's FACTS 5** (`lessons/25-minor-properly/FACTS.md:44`), the review's N9: it quotes
   Lesson 26's predict choices as the plan's. Replace `("Every note fits" or "Some notes stick out")`
   with `("Every note fits the key" or "Some notes leave the key", Lesson 26 FACTS 34)`. The rest of
   the line holds against the final opening: the tease names no key and no note, and the still draws
   Lesson 26's hero, "Twinkle" on plain rows. No other file outside Lesson 26 quotes the plan's
   choices.

## 4. `kit/season.ts` (Season 2's module) entry and prerequisites

```ts
{
  n: 26,
  lane: 'voice',
  title: 'A second voice',
  short: 'Second voice',
  topics: ['S20b', 'T23'], // "Sing a second part with a melody"; "Chord tones and non-chord tones" (light)
  // A draft until its sign-off (drafts.ts), as Lesson 3 is.
  minutes: 16, // once the page is built; the lab may move it
  page: '/learn/26', // once the page is built
  hook: 'Can you make a harmony by singing the tune a third higher?',
  pr: {
    needs: 'The harmony-line drill (SEASON-2 § 5.2 item 17)',
    link: {
      href: '/jam?lesson=26',
      addr: 'mercurypitch.com/jam',
      label: 'Harmony Stack',
      note: 'with a friend: once they join, the host picks Harmony Stack',
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

## 6. Kit and app work the page waits for, and the app's two items (WEB-SPEC, What the kit and the app still need)

1. The lesson host, the draft line, seasons in the kit (items 1 to 3).
2. Lesson 18's pieces, cited by path and line (item 4): the sing flow with a take read in time and
   `kit/read-in-time.ts` (its item 7), the woodblock and count-in (its item 5), the planning-text
   test's codes, S20b among them (its item 16). This page's additions to the reader: the other part's
   notes as input, with their times on the audio clock as booked; the rule and line for a note sung
   on the note the other part is sounding ("Do · That was Merc's note: mi."), each frame compared by
   its clock time, never by an anchored beat, the learner's own part on Lesson 18's anchor unchanged,
   read before the neighbour rule; three takes a set and a model before each run.
3. Lesson 24's checks (its item 6), with the check's line naming "Merc's part" or "Tavi's part" and
   the quiet check playing the set's other part (item 5).
4. A part under a take (item 6): Lesson 24's one kept source widened to any one voice built before
   the hush; the other part as one contour voice booked through `at` on bar 1's first beat; a level
   dip between two notes on one pitch, for Lesson 28's song.
5. The tune line's two-part states on the kit's `tune-line.ts` (item 7): a second solid line, lanes,
   brackets between lines, names on off-lane beads, Step 1's pair walk, Step 2's switch, Step 3's
   switch and Merc and Tavi state, Step 4's chord bar with gold and hollow beads; the lock in the
   step and in free play, drawing the hero's state, the tune alone on plain rows, until the choice
   and each step's own from the page's `onChoice`; spoken summaries.
6. The lab test (item 8): silence with Merc's part from the speakers must fail the quiet check or
   read no voice, never notes in the band or "That was Merc's note"; Bluetooth earbuds; Lesson 18's
   reader values with a part playing, and how far each device's round trip shifts a take's frames
   against the part as played; the other part's level; C3 and E3 on a phone's speaker; the states'
   timing for the chip.
7. The head and share card (`PT16M`; the head test already has "sixteen", `lesson-pages.test.ts:84`),
   Lesson 24's questions as a module, the lesson copy, the plumbing (SEASON-2 § 5.2 item 21) (items 9
   to 12).
8. The app (item 13): the harmony-line drill (SEASON-2 § 5.2 item 17), which then takes the card's
   first place.
9. The app (item 15), not blocking the page: Harmony Stack's boxes name each part's own notes
   (`harmoniseItems` names a moved note from its MIDI number; the jam-modes test pins the name), and
   the same edit mends the stale comment (`jam-modes.ts:210-211`). The card's line switches from "It
   plays nothing; on the third, its boxes print the tune's letters." to "It plays nothing; its boxes
   name their notes." when it ships (4 words fewer).
10. The app (item 16), not blocking the page: the host sends the drill and the mode to a peer whose
    channel opens, as `onPeerJoined` does a song, with a test that a late joiner gets both. The
    card's order, the friend in first and the mode picked after, works before and after it.

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
6. **Locks and held words**: until the choice the steps' stage and free play draw only the hero's
   plain "Twinkle", their controls disabled, and quick check 2's answers and quick check 4's play
   wait for it; Steps 1 and 2's words wait for the reveal; the tour for the choice (1a, 40, 41).
7. **A third spans three letters, both ends included**, Lesson 23's rule, where the plan said "two
   letters up"; the page counts letters only as spans (11).
8. **Step 2's heading** "Is a harmony the tune moved up?" for "Why not move every note the same
   distance?", which presumed the answer from the lesson menu (42). Its text counts the thirds by the
   tune's six notes, three of each size, where RESEARCH counted eight pairs, five and three (14); it
   drops "which is why the pair blends", which no source says, and the first draft's "Both sizes
   count as consonances." went with it (16).
9. **Step 3** leaves which voice takes which part to Sing it's briefing, and says the tenth as its
   source does: the same letter names, still major or minor (17 to 19).
10. **Step 4 has no predict**: the plan's named the chord's notes in its question, so it answered
    itself (21).
11. **Sing it in G, each voice in its own octave**: the plan's tune on C4 for both voices left the
    bass preset 0 semitones at its top and the soprano 0 at its floor in the swap, so its "inside
    every preset" was not true; in G every preset keeps 3 or more (50). No Move do (three semitones of
    reach) and no other octave (both fail a preset), with the coach asked.
12. **One pass of the tune a run**, the last note held two beats, where the plan played it twice: a
    run is one take of five notes for Lesson 18's reader, and Again sings it again (54).
13. **A model before each run**: Merc or Tavi sings the learner's part alone first (54, 55).
14. **Lesson 18's reader with one new line**, for a note sung on the note the other part is sounding,
    each frame compared at its audio-clock time with the part as played, the learner's own part on
    Lesson 18's anchor; read before the neighbour rule (58), the lead's answer 2.
15. **The sets and the swap**: three takes a set, as Lesson 24's sets; the swap after Easy or
    Workable, with new lines; one briefing serves every set, its first line naming the set's part
    (56, 57).
16. **No turn-taking version and no recorder**: without headphones the learner sings along with the
    other part and nothing listens, where the plan's interim had the line sung after the tune with
    nothing to harmonise with; the recorder is Lesson 28's, the lead's answer 3 (30, 61, 62).
17. **The quick check**: question 1 reworded and sent to Step 1, its wrong answer E read as a span;
    question 2 names the key, its wrong answers in the predict's words and as Lesson 6's
    misconception, and waits for the choice; question 4's play, do re mi re do in C major with the
    two parts, is new and locked until the choice (71 to 74).
18. **The practice card**: Harmony Stack first, in the order that works today (the range, the room
    and its link, the mode once the friend is in), with what the room does to a learner (nothing
    played; on the third its boxes print the tune's letters, until item 15; scored unfolded in the
    host's octave), the tune for the plan's "root", no fifth and no advice on pairing voices; Drone
    Intonation second, in Lesson 24's words, cut, naming its note; the rest card names Harmony Stack
    (63 to 68).
19. **The chips** name both prerequisites and read 16 minutes, the plan's figure, from the built
    page's estimate; "Microphone optional" and "Headphones optional" (2, 3). **The sound gate** drops
    "how one fits the other", which pointed at the predict (6). **The promise** says what the
    learner does (1).
20. **The next-lesson tease** is the lead's new line; the plan's is dropped (5b).

## 8. Citations of other lessons' new work

None is left in words. **Lesson 27**, committed: FACTS 5b (its tease and `three-notes`,
`FACTS.md:45`, `WEB-SPEC.md:385-388`; its predict, `LESSON.md:140-142`; its still,
`WEB-SPEC.md:314-317`), 11 (`LESSON.md:348`), 40 (`WEB-SPEC.md:213-214`), 71 (`LESSON.md:42-45`)
and the illustrations; LESSON.md, the next-lesson editorial and the card's stage direction (its
FACTS 5b, its predict and its still); WEB-SPEC, Toys 2 (its locked V room, beside Lesson 25's
locked stage) and Toys 6, and Explorer and season data. **Lesson 28's
ARTICLE-PLAN.md**, in the checkout from the start, is cited by path and line too: FACTS 18
(`:137-140`), 30 (`:162-163`), 72 (`:72-74`). If it turns out not to be committed, those three go
back to words.

## 9. Questions still open

The lead has answered the head's title, the chip and the note names. Still open:

1. **For the coach**, kept on the coach's list as the lead asked: Move do (not offered; a do moved
   two semitones down or one up keeps every preset two inside: should a learner for whom the top or
   the bottom feels hard get those three semitones?); the reader's new line, "Do · That was Merc's
   note: mi.", which says where the note sat, never why, and which Lesson 28 will reuse; and Harmony
   Stack's range table, with "Should the card advise on pairing at all?".
2. **The coach's list in full** (LESSON.md, For the vocal coach): the two parts and their table, the
   tempo and the run, the cues ("hold your last note until Merc's ends", new), the swap, the sets,
   the sing-along, the headphones and quiet checks' lines with "Merc's part", and the plain-language
   labels question shared with Lessons 3 to 24.
3. **No turn-taking** (lead), not yet answered: the season's fallback is not offered, since the
   sing-along gives the harmony live on every device; confirm.

## 10. Taken another way, and why

- **Figure marks are not in the built count**: the brackets' 4s and 3s, the beads' sharps, the
  lines' tags and the syllables under Sing it's bands, as a chart's ticks are not counted. Every line
  of words the page adds is in the 168, the review's list included (both "You said" lines, the
  higher voice's and the swap's part lines, the stored voice's line, three status lines, the
  switches, the buttons, the brackets' words and the lock line's copy in free play). The predict's
  hints stay in the brief's 150, as on every page.
- **Lesson 23's sentence is not copied whole**: its "C, D, E is three letters, so C up to E is a
  third" uses "so" for "therefore", which this page's preamble rules out on a page full of the
  syllable; Step 1 keeps its rule and its letters, "A third spans three letters, both ends included,
  as in Lesson 23: C, D, E."
- **N6 by Your turn's first line, not a new briefing**: the review's "Your turn: the tune, do re mi
  re do, while Merc sings your part." would add a line for the swap; here the one briefing serves
  every set, its first line naming the set's part, which also paid for the reserve cut.
- **S4's further cuts are the package's own choices** after the reserve line, each named in WEB-SPEC
  Length and FACTS 3; every fact they carried stays in FACTS.
- **Lesson 28's plan is cited by path and line** (section 8), on the assumption that it is
  committed.
