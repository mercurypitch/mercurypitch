# Lesson 26, A second voice: independent review

Package read in `/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/26-second-voice/` (FACTS.md,
LESSON.md, WEB-SPEC.md, uncommitted; identical to the scratch copies in `s2pkg/26/`), against its
RESEARCH.md and ARTICLE-PLAN.md, BRIEF-26, the writer's shared brief, SEASON-2 (§ 2 row 26, the
cards for Lessons 25 to 27, § 4.3, § 5, § 7), MERC-BIBLE § 2, HANDOFF (the cap and the chips), the
models (12, 18, 23, 24, 25, 27 and 28's plan) and the app at `c60f0fdcb` (the worktree's `src/`,
`workers/` and `scripts/`, which the branch does not touch: `git diff --stat c60f0fdcb HEAD` on
them is empty). The hand-back was read last.

- `node scripts/plan-cites.mjs check …/26-second-voice`: 321 citations read, 0 findings. About 60
  cited lines were also read by hand (list at the end); those that say less than the package claims
  are findings below.
- `node scripts/lesson-words.mjs …/LESSON.md`: 2,166 words, cap 2,379, 213 under; steps' own text
  103, 97, 119, 87. Matches LESSON.md, WEB-SPEC Length, FACTS 3 and the hand-back.

Counts: **2 blocking, 6 should fix, 11 nits.**

---

## Blocking

### B1. The steps' stage and free play draw the predict's answer before the choice: only their controls are locked (LESSON.md:206-211, :234-237, :253-256, :267-271, :472-474; WEB-SPEC Toys 2 :245-281; FACTS 1a, 40)

The hero is careful: its rows "all look alike", because the plan's lit C major notes "let the
predict be answered by counting" (FACTS 32). The steps' stage, one scroll or one Next below, then
undoes it. What the package locks is only the controls:

- LESSON.md Step 1's toy: "the rows of C major's notes lit as lanes ... joined by a bracket that names
  the letters and the semitones, "D up to F: 3" ... The figure waits for the cold open's choice:
  until then its controls are disabled". Steps 2 to 4 say the same ("The figure waits").
- WEB-SPEC Toys 2 (:245-250): "Before the cold open's choice every control and play of the stage
  ... is disabled, under the line ...". The step states it then specifies draw "the lanes lit"
  (Step 1, :253) and, for Step 2, "Twinkle" with "the copy a second chrome line ... a bracket at each
  note naming 4 or 3" (:260-262): the key's copy with its 3s over D, E and A, the whole answer.
  Each state's spoken summary "says what it draws whenever it changes" (:250-251).
- The kit's lock is buttons only: `unlocks` is "Controls elsewhere that the choice unlocks too"
  (`src/features/lessons/kit/predict.ts:66-67`). Nothing in the kit hides a drawing.
- Against this, Tests 5 says the steps' stage and free play "sound and draw nothing until the
  choice" (WEB-SPEC :758-761) and Page QA says no source "lights a lane, before the cold open's
  choice" (:821-822). Neither is what Toys 2 builds, and "draw nothing" names no pre-choice state at
  all (a blank card? the hero's rows?).
- The reviewed models say exactly what their locked stage draws: Lesson 25, "the chord column is not
  drawn" (`lessons/25-minor-properly/WEB-SPEC.md:241-245`); Lesson 27, "Until the cold open's choice
  the V room has three corners" (`lessons/27-sevenths-inversions/WEB-SPEC.md:213-214`).

On a wide screen the steps' stage is a sticky figure beside the steps' column
(`kit/step-deck.ts:5-6`), showing Step 1's state, lanes lit, as soon as the column scrolls into
view; on a phone it is Step 1's card. Free play (LESSON.md:472-474; Toys 2 :279-281) has the same
gap.

A smaller instance of the same contradiction: Sing it's briefing draws "the learner's part as amber
bands on G's lanes" (WEB-SPEC Toys 5, state 5), unlocked, so the page does light lanes before the
choice, against Page QA's line. It answers nothing about C major directly (the part is below, in G),
but FACTS 1a does not list it.

**Fix.** Specify the pre-choice state once, in Toys 2, and make LESSON.md's toy lines, FACTS 40, the
Look's lane rule, Tests 5 and Page QA say the same: until the choice the steps' stage and free play
draw the tune alone on plain rows, as the hero does (no lane, no second line, no bracket, no name on
a bead), with the hero's spoken summary, under the lock line; each step's own state draws from the
choice on. Either draw Sing it's bands on plain rows before the choice too, or narrow Page QA's line
to "lights a C major lane" and add Sing it's figure, its part lines ("la ti do ti la, a third below
the tune") and "Just listen today"'s play to FACTS 1a's open list, beside Steps 3 and 4.

### B2. The Harmony Stack card's steps leave the friend in unison, on their own tune and octave (LESSON.md:419-422; FACTS 63b, 64; WEB-SPEC Practice links :519-536, Explorer `pr.link` :567-568)

The card says: "open a Jam room, pick Harmony Stack and share its link. One of you sings the room's
tune, the other a third above it". In the app at `c60f0fdcb`, a friend who joins after the host has
picked the mode never receives the mode or the host's tune:

- The mode travels only inside a melody message: `selectJamRoomMode` sets it and re-sends the melody
  with it (`src/stores/jam-store.ts:1297-1302`); `selectJamExercise` sends only from the host
  (`:2767-2769`); a guest's mode starts at `'unison'` (`:1294`) and is set only by that message
  (`applyRemoteMelody`, `:2971`).
- Messages go only to channels open at that moment (`broadcastData`,
  `src/lib/jam/service.ts:1131-1138`). When a peer joins, the host re-sends a song and nothing else:
  "if (jamIsHost() && jamSong() !== null) broadcastSongWithParts()" (`jam-store.ts:1971-1983`, whose
  comment says a newcomer otherwise "saw an empty room"); the channel's open sends only video-state
  (`service.ts:883-887`); `onPeerChannelReady` shares only the background (`jam-store.ts:2272-2281`).
  The room server stores neither the mode nor the melody (`workers/jam-worker/src/jam-room.ts`).
- The host's own default drill is seeded the moment the room goes live, before anyone joins
  (`src/components/jam/JamPanel.tsx:207-233`). The friend's page, finding no melody, seeds its own
  default scale in the friend's own octave, locally (same effect; a guest's `selectJamExercise` does
  not broadcast).

So, following the card: the friend's room is unison, on their own C major scale in their own
octave; the host's is Harmony Stack with two singers, and by sorted peer ids (`roleIndexOf`,
`src/lib/jam/jam-modes.ts:72-77`) the host gets the tune about half the time, when both sing the
tune. The repo's own two-peer check sets the mode after the guest is in
(`.claude/skills/jam-two-peer/two-peer.mjs:111-118`), the order that works. FACTS 63b's "The host's
choice of tune goes to everyone" is true only for peers already in the room.

A second gap in the same lines: the room's octave is the host's app range preset, which defaults to
tenor (`src/stores/settings-store.ts:298-299`), so a host who never set a range opens on C3; two
higher voices then sing C3 to D4, below every higher preset's floor. The card names Settings only in
the Drone Intonation line, whose "too" points back.

**Fix.** Reorder the card and say where the range comes from, for example (72 words for today's 71,
with S3's clause dropped):

> With a friend: set your range in Settings, open a Jam room and share its link; once your friend is
> in, pick Harmony Stack under More controls. One of you sings the room's tune, the other a third
> above it, in the key; each is scored on their own part. It plays nothing; its boxes name their
> notes. It scores each note in the octave your range sets, not an octave away.

("Under More controls": the mode picker is in the host's extras, `JamControlBar.tsx:40`, `:104-107`.)
Then: correct FACTS 63b and 64 with the citations above; `pr.link.note` "with a friend: once they
join, the host picks Harmony Stack"; add an app item to What the kit and the app still need (the host
sends the drill and the mode to a peer whose channel opens, as `onPeerJoined` does for a song; a test
that a late joiner gets both), after which the card's first order would also work; and make Page
QA's two-peer check (WEB-SPEC :828-831) follow the card's words in order, with the jam-two-peer
script's join and mode steps swapped once to show the late-join case.

---

## Should fix

### S1. Letters are counted two ways (LESSON.md:195-196, :246, :384; FACTS 11, 71)

Lesson 23's rule counts a span, both ends included: "C, D, E is three letters, so C up to E is a
third" (`lessons/23-perfect-tritone/LESSON.md:195-196`); Lesson 27 the same, "G, A is two letters, a
second" (`lessons/27-sevenths-inversions/LESSON.md:348`). This page mixes a span with a move:

- Step 1: "take the key's own note three letters up: C to E". Read as moves (the way "up" reads),
  three letters up from C is F. The sentence before it counts the span, so the two disagree.
- Quick check 1's E: "E is the next letter up: a second." This counts a move (one letter up is a
  second), which makes Step 1's "three letters up" a fourth.
- Step 3: "an octave and a third, the same two letters" — two letters, a line above Tavi's "I count
  three letters", reads as another count (it means the same two letter names).
- Step 1's bracket "D up to F: 3" (LESSON.md:208; Toys 2 :255): every third is three letters, so a
  bare 3 beside one reads as its letters, not its semitones.

**Fix.** Count spans only: Step 1, "Above each note of C major, take the key's note three letters on,
counting both: C to E, D to F, E to G." (or "the key's note a third above: C, D, E puts E over C");
quick check 1's E, "D, E is two letters: a second." as Lesson 27 words it; Step 3, "the same letter
names"; the bracket "D up to F: 3 semitones" in Step 1, where it has the room. Tavi's line and quick
check 1's F feedback already count spans.

### S2. Step 1 makes a chord's quality its third alone, and its Notice reads as chord qualities (LESSON.md:197-198, :201; FACTS 12, 13)

"That's why Lesson 12's chord on re, D, F and A, is minor: D up to F is 3." A 3 at the bottom does not
make a chord minor: Lesson 12's chord on ti, B, D, F, has the same 3 and is diminished, vii°
(`lessons/12-chords-four-chord-song/LESSON.md:168-169`); Lesson 12's own reason is "D, F, A is 3 then
4 semitones: minor" (FACTS 13 quotes it). Then the Notice, "major on do, fa and so; minor on re, mi,
la and ti", sits under a sentence about chords, so a learner reads "the chord on ti is minor".

**Fix.** "... is minor: D up to F is 3, then F up to A is 4." and "major thirds on do, fa and so;
minor thirds on re, mi, la and ti." (+9 words, paid for in S4).

### S3. "Two lower or two higher voices suit it" fails the series' range rule (LESSON.md:422, :600-619; FACTS 63b; hand-back question 8)

The writer's own table gives 0 semitones of room at the tenor's floor (the tune's C3) and the
soprano's (the tune's C4). The writers' brief: range advice "must keep every preset of that voice at
least two semitones inside its floor and top, or the page must not offer it". The hand-back asks the
coach to "confirm the line"; the rule says the line does not go out as written.

**Fix.** Drop the clause (the rewrite in B2 does) and keep the table for the coach, or keep it only
with the coach's recorded exception, saying in FACTS 63b that it departs from the rule and why. The
table and arithmetic are right (checked by hand for all 36 cells).

### S4. The built page's 2-word margin is inside its estimate's error: name the cuts now (WEB-SPEC Length :170-191; FACTS 3)

2,166 + 150 + 61 = 2,377 follows the brief's rule of thumb, but Season 1's builds added 50 (Lesson 5:
2,351 to 2,401), 116 (Lesson 7), 174 at build and 206 today (Lesson 8 FACTS 4, the source the 150 is
cited to) and 332 (Lesson 6, HANDOFF.md:262-263). On Lesson 8's own figures the page lands at 2,401
to 2,433, 22 to 54 over. And the 61 leaves out lines this page adds that the counter would count on
a built LESSON.md: both "You said" lines (14; the counter's header says they count), the higher
voice's part line, "mi fa so fa mi, a third above the tune" (10), the stored voice's line (9), Sing
it's two status lines (11), Step 4's Play the part, Play the tune and Play both (8), the switches
and the tenth's bracket (15), and the lock line's second copy in free play (10).

**Fix.** Name these in Length, in order (each checked with the counter's word rule):

1. The Wrap's "An octave further apart, a third is a tenth." (9), the writer's own first cut.
2. Step 3's "In Sing it, the lower voice takes the part below, the higher voice the part above."
   (16): Sing it's Your turn names each voice's part; Step 3's own text drops from 119 to 103, off
   the 120 ceiling.
3. Step 2's "Both sizes count as consonances." (5): with "which is why the pair blends" gone, it
   says nothing the page uses, in a word the page never defines.
4. Sing it's "After each run, your pitch line appears, with a line a note, such as:" to "After each
   run, a line a note, such as:" (5); "What this does" already says the pitch line shows.
5. N4's Drone Intonation line (6 net).

That is 41, less S2's 9: about 2,345 built on the brief's rule. In reserve, with the coach: "Listen
to the tune as you sing." (7), resting on a Weak to Moderate study.

### S5. The chip: the package's own built count gives 16 minutes (FACTS 3; WEB-SPEC Sections 2, Length)

On the text count the chip sits exactly on 15.00. On the package's own built estimate, 2,377 / 238 =
9.99 minutes, plus 5.90 = 15.89: 16, the plan's figure. Lesson 8's chip went from 15 to 16 for this
reason when built, and the owner chose real run times on every chip (HANDOFF.md:262-267). **Fix:**
say in FACTS 3 and Length that the built page reads 16 unless the lab says otherwise; the head's
"A sixteen-minute lesson" keeps the description at 121 characters, and the head test has "sixteen"
(`src/tests/lesson-pages.test.ts:84`); `timeRequired` and `minutes` follow. Or set 16 now.

### S6. The reader's new rule does not say which beat is "the same beat", and a part sung a beat late reads as in the band (WEB-SPEC Toys 5 :415-439; FACTS 58; Tests 7)

The new rule compares a note's frames with "the other part's note in the same beat". Lesson 18's
anchor moves "every note's beats" by the singer's first note, up to two beats late
(`lessons/18-read-a-line/WEB-SPEC.md:461-467`), while Merc's part is booked on bar 1's first beat
(Audio :482-487) and does not move. So for a learner who comes in a beat late, the anchored beat i
is clock beat i+1: a learner who drifts onto the tune is compared with the tune's note i, misses
the rule, and falls through to a gap reading of 400 or 500 cents. Separately, the spec's own case
"sung a whole beat late, the same" (:432) reads every note of a part a beat behind the tune "in the
band", though every third against the tune is then a fourth or a second (E3 under A3, F♯3 under B3,
G3 under A3). "It doesn't score your timing" keeps that honest, but this is the first reader that
listens against a played part, and Lesson 28 reuses it.

**Fix.** Define the other part's note by the frames' audio-clock time against the part as played,
or state that both grids move with the anchor and why; decide, with the lead, whether a part sung
against a played part keeps Lesson 18's two-beat span or a narrower one (enough for the device's
round trip); add a synthetic case: the lower part's singer one beat late, on Merc's sounding notes.

---

## Nits

- **N1. FACTS 80 and Toys 2 Layout (:286):** Step 3's Merc and Tavi state, C3 to G4, is MIDI 48 to 67:
  20 rows, about 180 px at 9 px a row, not "32 rows, about 280 px". The conclusion holds (Lesson 6's
  one-line states drew 21 rows).
- **N2. Toys 1's spoken summary (:236-237):** "The copy: three of its notes, C sharp 5, G sharp 4 and F
  sharp 4, are off C major's rows." Six of its fourteen notes are (FACTS 15). Say "six of its notes,
  on C sharp 5, G sharp 4 and F sharp 4". The bead labels differ too: LESSON.md "C♯, G♯ or F♯"
  (:144), Toys 1 "C♯5", "G♯4" or "F♯4" (:223-224); pick one.
- **N3. Toys 2 Layout (:283-285):** "every bead, bracket and control a target of at least 44 px with no
  two overlapping" cannot hold in Step 2, where two beads 3 or 4 rows (27 to 36 px) apart and their
  bracket share one 44.25 px column. Say which parts are buttons in each state (the kit's
  `beadButtons` and `brackets`); probably only the controls.
- **N4. "So" as "therefore" in learner copy:** the card's "It too wants each note in the octave it asks
  for, so set your range in Settings first (under Singing Voice Range)." (LESSON.md:427-428), against
  the preamble's "none of its own lines uses it to mean 'and therefore'" (:28-29) on a page full of
  the syllable. With B2's rewrite the range is set in the first line, and this can read "It too
  wants each note in the octave your range sets." (move "(under Singing Voice Range)" to the
  Harmony Stack line).
- **N5. Sing it's heading line, "Duet: your part with Merc's, and any octave counts"** (LESSON.md:494,
  and the heading at :273), is static and names Merc for the higher voice, who sings with Tavi.
  "Duet: two parts, and any octave counts".
- **N6. The swap has no briefing:** Your turn's "la ti do ti la, a third below the tune ... Listen to the
  tune as you sing" stays on screen while the learner sings the tune (LESSON.md:324-327, :360-361;
  Toys 5 state 10). Give the swap its line, such as "Your turn: the tune, do re mi re do, while Merc
  sings your part.", or say the briefing's words swap.
- **N7. Quick check 4 names no key** (LESSON.md:396): do re mi re do alone does not fix one, so "Which
  part stays in the key?" needs "A tune in C major with two parts above it", as question 2 names it.
- **N8. FACTS 50:** '"around A3" and "around A4" are true, A being re' — the learner's own part (la ti
  do, mi fa so) never sings A; only the swap's tune does. Say they are Lesson 3's buttons, word for
  word, naming the voice.
- **N9. Lesson 25 FACTS 5** (`lessons/25-minor-properly/FACTS.md:44`) still quotes this predict's
  choices as the plan's, "Every note fits" or "Some notes stick out". A hand-back line for the lead.
- **N10. Quick check 2 is the predict word for word,** with the same correct text, "Some notes leave the
  key", and its feedback states the answer once tapped. FACTS 1a lists it, as Lessons 23 and 25 list
  theirs, so it may stand; holding question 2 until the choice, as question 4's play is held, would
  close it for a few words of spec.
- **N11. Hand-back § 3 or WEB-SPEC item 15** could note the stale comment in `targetForRole`, "a fourth
  singer lands on the seventh" (`jam-modes.ts:211`): the code gives a fourth singer the tune
  (`roleCountFor` caps at three), as FACTS 63 says.

---

## Checked and sound

- **The predict and its leaks, apart from B1:** title, promise, sound gate, chips, head title,
  description (121 characters, counted; "A fifteen-minute lesson"; 80 to 160 per
  `lesson-pages.test.ts:158-159`), og and twitter lines, share card and alt (135), the hero on
  plain rows, Merc's and Tavi's bubbles, the predict's choices and hints (no "Now play the other
  one."), the reveal held for the play heard to its end, the lesson menu's headings and card, the
  section heading lines, the Words (no size, no four-semitone copy), the recall (Lesson 12's `l12-q3`
  and Lesson 24's question 1, word for word with `quiz-questions.ts:73-91` and Lesson 24's
  LESSON.md:417-420; `linkAway` rewrites the step links as FACTS 7 says), quick check 4's held play,
  the tour's hold (`holdTour`; the tour's step targets `#stepsStage`, `tour-copy.ts:44-46`), Lesson
  25's tease and still. The structured data and llms.txt name the answer, as Lesson 24's did.
  Lesson 12's ii and vi make the predict reasoned, not answered: FACTS 1a weighs it fairly.
- **Lesson 27's tease and the two pages:** the default and `three-notes` lines match Lesson 27's
  FACTS 5b and WEB-SPEC :385-388 character for character (61 and 68, under `TEASE_MAX` 70); neither
  answers Lesson 27's F-or-F♯ predict. Lesson 27's claim that this page teaches "the third above D in
  C is F" holds three times: Step 1 ("D to F"), the mix-up card (F♯ against F over re) and quick
  check 1 (F). Lesson 27 counts letters as spans; S1 brings this page into line.
- **The music:** every third up C and G major (4, 3, 3, 4, 4, 3, 3); "Twinkle"'s key copy and its six
  notes, three of each size, eight 4s and six 3s by the fourteen; the four-semitone copy's C♯5, G♯4,
  F♯4 and nothing else off the key; it is "Twinkle" in E (Lesson 6's table); Step 3's parts (4, 3,
  3, 3, 4 and 3, 3, 4, 3, 3); the tenth's 16 and 15; Step 4's chord notes, passing notes and
  twelfth; quick check 4's F♯4 and G♯4; the frequency table; every play's length; the 354 s of
  tasks and 15.00 minutes on the text count.
- **Sing it's range:** both parts and the swap's tunes against `VOCAL_RANGES`
  (`settings-store.ts:91-152`): lower E3 to B3 and higher G4 to D5 keep every preset 3 or more
  inside (least 3 at the alto's top, 4 at the tenor's floor); the plan's C4 line fails as FACTS 50
  says; Move do's three semitones and the octaves away fail exactly as stated. The reader's examples
  ("Do · That was Merc's note: mi.", the swap's la, the higher part's mi on beat 3) match the parts.
- **Shared lines:** comfort check, voice choice, "Just listen today" (Lesson 18's form), doctor lines,
  stop and volume lines, feelings, headphones and quiet-check lines (Lesson 24's, with "Merc's part"),
  "What this does" (Lesson 18's with two swaps), the rest card (Lesson 10's form), the sound gate
  (Lesson 5's form). The coach's list carries every new line, both parts, the range table, tempo,
  sets, swap, sing-along and Harmony Stack's table.
- **Harmony Stack's other claims:** nothing played (the beat timer, `jam-store.ts:3127-3179`, and no
  synth in a drill room), the count-in drawn 4 to 1, parts by sorted place, the badge, a part pinned
  at a take's start, scoring unfolded (`jam-pitch-view.ts:14-16`, `averageDeviationCents`), the
  default C major scale of seven notes in the host's octave, and the writer's bug: `harmoniseItems`
  keeps `name` while rewriting MIDI, octave and frequency (`jam-modes.ts:134-153`), and the canvas
  prints `${noteName}${octave}` (`JamExerciseCanvas.tsx:68`, `:362`), so the third over C4 to B4
  reads C4, D4, E4, F4, G4, A5, B5, as FACTS 63a says. Item 15's fix and test are right (the fifth
  over B4 is F5). Drone Intonation's slug, labels and printed names as Lesson 24 read them.
- **The kit claims:** `playNotes` and `allOf` (`run.ts`), the hush and `contourVoice` with `at`
  (`sound.ts:39-43`, `:315-347`, `:533-541`), `MAX_TRIES`, `gapWords`' `whose`, `homeOf` and
  `mercOf`, the tune line's brackets and contrast overlay (`tune-line.ts`), the comfort module's
  `afterFeeling`, `VisitEnding` and `mountPractiseCard`, `next-card.ts`'s tease above the hook and
  "Coming later", `page-state.ts`, the lesson marker and the answer bounds (1 to 14), the lesson
  route and the service worker paths. Lesson 18's and Lesson 24's cited spec lines say what this
  spec builds on.
- **Copy:** British spelling, no emoji, model name, path or agent id in the three files; headings are
  Tavi's questions; Tavi's Step 3 line is a re-explanation, which MERC-BIBLE allows.

Cited lines read by hand at `c60f0fdcb` included: `jam-modes.ts:25-160`, `:190-225`;
`jam-store.ts:1290-1375`, `:1965-2010`, `:2272-2290`, `:2755-2800`, `:2933-2990`, `:3101-3185`,
`:3260-3270`; `service.ts:878-892`, `:1131-1138`; `JamPanel.tsx:196-234`, `:424-430`;
`JamExerciseCanvas.tsx:55-80`, `:345-370`, `:812-842`; `JamControlBar.tsx:170-195`;
`JamRoomCode.tsx:1-12`; `jam-room.ts:511-590`; `jam-catalog.ts:234-244`; `vocal-range.ts:140-165`;
`melody-store.ts:295-370`; `jam-scoring.ts:1-110`; `exercise-scoring-utils.ts:100-135`;
`jam-modes.test.ts:105-116`; `settings-store.ts:85-155`, `:298-299`; `predict.ts:1-80`;
`tour-gate.ts:57-69`; `tour-copy.ts:44-46`; `step-deck.ts:5-8`; `voice-choice.ts:49-53`;
`run.ts:9-18`, `:38-39`; `sound.ts:16-19`, `:39-43`, `:78-80`, `:181`, `:315-321`, `:533-541`;
`take.ts:1-3`, `:54`; `listen.ts:13-22`; `band-words.ts:55-61`; `comfort.ts:10-45`, `:99-128`;
`next-card.ts:13-30`, `:140-144`; `quiz.ts:185-210`; `lesson-12/quiz-questions.ts:50-95`;
`slug-map.ts:70-85`; `use-drone-intonation-controller.ts:15-30`;
`DroneIntonationExercise.tsx:160-220`; `lesson-pages.test.ts:75-95`, `:150-215`;
`lesson-marker.ts:11-19`; `mirror-metrics.ts:57-62`; `sw-runtime.ts:90-95`, `:130-135`;
`lesson-gate.ts:132-136`; `mic-manager.ts:47-56`; `voice-capture.ts:1-3`, `:82`;
`guided-voice-check.ears.md:96-101`, `:238-241`.
