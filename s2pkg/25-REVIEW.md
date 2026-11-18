# Lesson 25, Minor, properly: review

Reviewed: FACTS.md, LESSON.md and WEB-SPEC.md in
`/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/25-minor-properly/` (identical to the scratch
copies in `s2pkg/25/`), against RESEARCH.md, ARTICLE-PLAN.md, BRIEF-25, the writer's common brief,
SEASON-2 (card, § 4.3, § 5, § 7, § 8), the house rules, Lessons 10, 12, 16, 21, 22, 23 and Lesson
24's draft, and the app at `c60f0fdcb`. The hand-back was read last.

Counts: **1 blocking, 9 should fix, 12 nits.**

- `node scripts/plan-cites.mjs check …/25-minor-properly`: 288 citations, 0 findings.
- `node scripts/lesson-words.mjs …/25-minor-properly`: 2,117 words, 262 under the cap; steps' own
  text 118, 104, 117, 120. Matches FACTS 3 and WEB-SPEC Length.

---

## Blocking

### B1. The Wrap's free play answers the predict before the choice

**Where:** WEB-SPEC 227-228 (Toys 1, "Free play, in the Wrap: Raise te and Raise le, the chord
column, every play above"); WEB-SPEC 618-619 (Edge cases: "the Wrap's free play, its own instance,
offers everything from the start"); against WEB-SPEC 56-57 (Look: the chord column "is never drawn
before the cold open's choice"), WEB-SPEC 702-706 (Test 18: "no play before the choice sounds two
notes together"), FACTS 1a (line 40: "Nothing a learner meets before the reveal prints, draws or
plays the cold open's answer") and LESSON.md 57-59 (preamble).

**What is wrong:** the Wrap's free play is a second instance of the steps' toy with Raise te, the
chord column (beads named "E minor", gaps "3" and "4") and Play the chord on so, then home, and the
spec opens all of it from first paint. A learner who scrolls to the Wrap before choosing can lift
te and watch the column read "E major", or hear the chord. That is the predict's answer by eye and
by ear. Four places in the package say it cannot happen, and Test 18 would fail against the spec
as written. This is the case the common brief names: "Lesson 23's toy could sound F♯ … before the
choice, while four places in the package said it could not."

**Evidence:** Season 1's free play "locks nothing, since the guided steps come first on the page"
(`src/features/lessons/lesson-10/wrap.ts:10-12`). Lesson 22, the newest reviewed model, changed
that for Season 2: its free play "keeps the steps' holds, since a learner can scroll to the Wrap
before either choice" (lessons/22-vibrato/WEB-SPEC.md:301-308). WEB-SPEC 262 already has
`onChoice` telling "the steps' toy and the free play that a choice is in", in Lesson 22's words,
but nothing in the free play acts on it.

There is also a naming clash that hides the problem: "the free play" means the hero's `data-free`
tune play in FACTS 31, 36, 38 and WEB-SPEC 21, 262 and 659 (Test 3: "the free play sounds no
chord"), and the Wrap's playground in WEB-SPEC 227 and 618-622.

**Fix:**
- Hold the Wrap's Raise te, its chord column and its chord play until the cold open's choice, as
  Lesson 22 does. Put them under a lock line such as "Choose an answer at the top to unlock this."
  and enable them through `onChoice`. Raise le can stay open: it implies Raise te (WEB-SPEC 620-622),
  so it must wait too, or switch only the sixth until the choice. Holding both is simpler.
- Correct WEB-SPEC 618-619 and the Toys 1 free-play bullet, and add the Wrap's free play to Test 3
  and Test 18.
- Add a line to FACTS 1a. Name the hero's play "the tune play" (or "Play the tune, twice")
  everywhere, and keep "free play" for the Wrap.

---

## Should fix

### S1. Step 1's text states the answer, on the steps' first card

**Where:** LESSON.md 197-199 ("so, te and re, E, G and B, make a minor chord; so, ti and re, E, G♯
and B, a major one."); FACTS 1a (line 40: "Step 1's text, after the reveal in the page's order, is
the first place the page says so, ti and re make a major chord, as Lesson 23's Step 2 is …").

**What is wrong:** the toy beside this sentence is locked because it would answer the predict, but
the sentence answers it in words. Step 1 is what `start()` shows by default: "the step the address
names, or step 1" (`src/features/lessons/kit/step-deck.ts`). On a phone it is the deck's one
visible card, straight after the Words section. On a wide screen it is the top of the steps'
column.

The precedents are weaker than 1a makes out:
- Lesson 23's answer sits in Step 2, a Next away.
- Lesson 22's sits in Step 3, "two Nexts from Step 1" (lessons/22-vibrato/FACTS.md:47).
- Lesson 21's Step 1 shows a rule that leads to the answer, not the answer itself.

The common brief asks for what sits below the predict to be kept free of the answer.

**Fix (recommended):** make Step 1's chord sentences a second reveal element of the cold open's
predict, which the kit already supports ("What the reveal shows … one or several elements",
`src/features/lessons/kit/predict.ts:70-71`; Lesson 22 does this for its Step 3). Until the reveal,
show one held line in their place, such as "What raising te does to the chord on so: choose an
answer at the top first." The [Play the chord on so, then home] button is already locked.

**Alternative:** keep the text, and have FACTS 1a say plainly that Step 1, the first card, states
the answer, and that a learner who reads it has passed the predict. Do not compare it to Lesson
23's Step 2.

### S2. Step 4 breaks Lesson 21's rule without saying so

**Where:** LESSON.md 248-257 (Step 4); FACTS 7.

**What is wrong:** Lesson 21's Step 4 taught "Read the signature, then find home … no sharps or
flats, C major" (lessons/21-keys-circle/LESSON.md, Step 4). This page's recall asks that rule
again: three sharps, so "On A … A major". Step 4 then shows the same empty signature with do on A.
The rule now gives the major key's do only, and the common brief asks: "When an earlier lesson's
rule stops being true, say so where it breaks" (Lesson 19 restates the old rule and says what
changes).

The plan meant the recall to set this up: "the same signature, with do on A for A major, is F♯
minor's in do-based singing" (ARTICLE-PLAN.md:51-52). The package drops that without listing it as
a departure.

**Fix:** add one sentence to Step 4 and trim to stay at 120 words. For example: "Lesson 21 read no
sharps or flats as C major. A minor has the same signature, so the signature alone can't say which
is home." Tavi's line then answers it: the house shows where home is. List the change from the
plan's F♯ minor note in the preamble and in FACTS 7.

### S3. Lesson 6's pair has 0.15 s of quiet, not a glide

**Where:** FACTS 62 (line 132: "0.6 s, 0.15 s of glide and 0.8 s"); WEB-SPEC 404-406 (Audio:
"0.6 s, a 0.15 s glide and 0.8 s").

**Evidence:** `PAIR = { first: 0.6, second: 0.8, gap: 0.15 }`
(`src/features/lessons/lesson-06/examples.ts:34`), and `pair()` places the second note at
`(PAIR.first + PAIR.gap)` with no glide: "Two notes one after the other, 0.6 s and 0.8 s, 0.15 s
apart" (`:80-90`). Lesson 23 FACTS 66 has it right: "then 0.15 s of quiet". A builder following
this spec would slide F up to G♯, which blurs the three-semitone step that Step 2 asks the learner
to hear. The total, 1.55 s a pair, is unchanged.

**Fix:** write "0.15 s of quiet" in both places.

### S4. Lesson 10's chord beads cannot take this page's roots or octaves

**Where:** WEB-SPEC 182-194 (Toys 1) and 520-527 (What the kit and the app still need, item 4:
"a root of A in Minor (they are generic over a white-key root today)").

**What is wrong:** the beads take only "the seven white keys from C4 to B4" (`ROOTS`,
`src/features/lessons/lesson-10/chords.ts:68-69`). Their window is C4 to F♯5 (`WINDOW`, `:71-72`),
and `rootLetter` throws for any other root: "is not a white-key root from C4 to B4" (`:76-82`).

This page needs:
- staircases on A2 and A3 (the lower voice's and the hero's);
- chords down to A2 C3 E3 and E3 G3 B3;
- two states side by side, a staircase and a chord column (Lesson 10 shows one or the other);
- a chord column on so.

"Generic over a white-key root" is the module header's phrase, not what the code allows.

**Fix:** item 4 should list roots and a window from A2 up (A2 to B4 covers the page). It should
also list the side-by-side scale and chord state as new, with the tests.

### S5. "What the kit and the app still need" leaves out SEASON-2 § 5.2 item 10

**Where:** WEB-SPEC 565-567 (item 15) and 477-479 (`pr.needs`); LESSON.md 372-379 (the card's
editorial note).

**What is wrong:** SEASON-2 § 5.2 item 10, "Sight-Singing for the lessons", names Lesson 25
(SEASON-2.md, § 5.2 item 10: "… Lessons 16, 18, 21, 25"). Its parts change this card directly:
- (g) "a `key` launch field (key and scale come from the Singing tab)" would replace the route
  through two tabs and a menu with one link;
- (b) "hear do", (c) the bass clef and (e) letter names off would each remove a caveat.

The package never mentions item 10. Lesson 16's editorial note lists each part and what it removes
from that card (lessons/16-sing-what-you-see/LESSON.md:376-384).

**Fix:** add item 10 (b), (c), (e), (f) and (g) to item 15 and to `pr.needs`. Add to the card's
editorial note what each one changes, above all that (g) lets the link open Sight-Singing in A
harmonic minor directly.

### S6. The Sight-Singing card leaves out two things the drill does

**Where:** LESSON.md 360-367 (second drill); FACTS 53 (line 120).

**What is wrong:** SEASON-2's risk 2 lists what Sight-Singing contradicts ("no do, sharps only, no
key signature, letter names, treble only, written octave …") and rules "Its cards say what it
does" (SEASON-2.md, § 8.1, risk 2). The card covers no do, sharps (G♯) and treble only. It leaves
out:
- that the drill prints each note's name under it: `{p.note.name}{p.note.octave}`, drawn under
  every note (`src/features/exercises/sight-singing/SightSingingExercise.tsx:130-140`), printed as
  "G#4";
- that it scores each note in the octave written (`use-sight-singing-controller.ts:192-199`).

FACTS 53 knows both. Lesson 16's card, the model this one carries, says both: "it wants each note
in the octave written. It prints each note's name under it: read the staff, not the names."

**Fix:** add Lesson 16's two sentences, about 25 words; the Wrap stays well under the cap.

### S7. The vocal coach is not told what Sight-Singing in A harmonic minor can ask for

**Where:** LESSON.md 478-480 (For the vocal coach, the Sight-Singing bullet); FACTS 53.

**What is wrong:** the drill draws its notes from the whole saved preset, from `lowMidi` to
`highMidi`, with no margin (`getComfortableMidiRange`, `src/lib/vocal-range.ts:14-25`;
`generateSequence`, `use-sight-singing-controller.ts:103-127`). So it can ask for a preset's floor
or top note, where the page's own rule keeps two semitones of room. In A harmonic minor its random
walk can also jump F to G♯ or G♯ to F, the augmented second that Step 2 calls "a challenging
interval to sing", with no reference note played first. The coach should see both before
publishing.

**Fix:** add to the coach's Sight-Singing bullet: "Its notes can fall anywhere in the saved preset,
its floor and top included, and in A harmonic minor it can ask for F to G♯, the step Step 2 calls
challenging to sing."

### S8. The withdrawn tease: the decisive reason is Lesson 12, and SEASON-2's card is false too

**Where:** FACTS 5 (line 44); LESSON.md 385-387; hand-back (`TEASE_NOTES` 26 `plan`, and "Teases
checked").

**What is wrong:** the package withdraws "So far the other part was a drone." because this page's
cold-open chords move. The stronger reason is a sung one: Lesson 12's Your turn has the learner sing
over moving chords ("the chords play again, and Merc sings each chord's root: do, so, la, fa"),
lessons/12-chords-four-chord-song/LESSON.md:262. Lesson 12 is a prerequisite of Lesson 26, so the
line is false for every learner, whatever this page plays.

Two smaller points:
- The same mistake is in a shared file: SEASON-2's card for Lesson 25 closes on "So far you've sung
  against a drone that never moves." (SEASON-2.md, § 3, Lesson 25, "Closes on").
- The writer's third reason, that "So far" uses "so", does not hold. "So far" does not mean
  "therefore", and that is the only use the page rules out.

The mended alternative, "Lesson 24's other part was a drone. What if it's a tune?" (56), is true.

**Fix:** cite Lesson 12 in FACTS 5 and in the `TEASE_NOTES` note. Drop the "So far" reason. Tell
the lead in the hand-back that SEASON-2's "Closes on" line for Lesson 25 is false.

### S9. FACTS 1a leaves out places that lean towards the answer or state it

**Where:** FACTS 1a (line 40).

**What is wrong:** 1a is the list a reviewer reruns, and it says "neither [recall question] says
what a raised note does to a chord". Four things are missing from it:
1. Recall question 1's feedback for "Only E" says "That one change makes the minor chord." This is
   the mirror of the answer: the premise the predict asks the learner to use. That is legitimate,
   but 1a should name it, as Lesson 24's 1a names its recall's lean.
2. Recall question 2's feedback, "G♯ is ti, and do sits just above it: A major.", pairs G♯ with
   "major" one scroll under a predict about G♯.
3. The Wrap's second line, "Harmonic minor raises te to ti, which … turns the chord on so major"
   (LESSON.md 343-344), states the answer. Lesson 22's 1a lists its Wrap line.
4. Lesson 10's page already shows E minor and E major side by side:
   - Step 3's toy moves the root with Root higher, and Major · Minor names "E major" with G♯
     (`src/features/lessons/lesson-10/chords.ts:68-69`; `lines.ts:67-68`);
   - Lesson 10's free play does the same;
   - Lesson 10's sing-along sang E, G♯, B, then E, G, B (Lesson 10 FACTS 63).

   1a's "No earlier lesson says what raising G to G♯ does to E, G and B" is true of the text, but
   should name these. They support the reasoning; they do not give this page's answer.

**Fix:** add all four to 1a. Rewrite Test 18 as a testable assertion. As written, "the recall …
name[s] no chord's quality" fails on question 1's "the minor chord", and the four words name
"major" and "minor" keys. Say instead that no text above the quick check puts "major" beside E,
G and B, "the chord on so" or "the chord before home", and that the Wrap's free play is held
(B1).

---

## Nits

**N1. The predict stem names a chord the learner has not heard.** LESSON.md 136: "Under the first
ending, the chord before home is E, G and B." The tune played before the choice has no chords, so
nothing was "under" it. Suggest: "Played with chords, the first ending's chord before home is E, G
and B."

**N2. The reveal says "only the chord before home changed", but the melody's G changed too.**
LESSON.md 156. Suggest: "The key is still A minor, and so is the chord on home: only the chord
before home changed."

**N3. Two names for one chord.** The cold open says "the chord before home" and Step 1 onwards says
"the chord on so", and nothing links them. Step 1 could say "The chord before home, the chord on
so, changes too: …".

**N4. "The other five by their leaning" is unclear.** LESSON.md 355-356, the Gravity text. It is
the app's own phrase (`src/features/ear-lab/GravityDrill.tsx:24`), but a learner cannot read it.
Suggest "the other five as a number with ♭ or ♯, such as ♭7".

**N5. Gravity's pair practice exists in native test builds.** FACTS 49. Gravity offers practice on
"the two items a rated run mixed up" (`src/features/ear-lab/pair-practice.ts:1-11`;
`HomeDrill.tsx:21-22`, `:411-424`). It is drawn only where `EAR_LAB_WITH_MERC` is on
(`HomeDrill.tsx:335-336`), and that is on in native test builds only
(`src/lib/native-build.ts:82-93`). So the card's "isn't in the app yet" is true for the web and
the store app. Note this in FACTS 49 so the card changes when that build ships.

**N6. Four citations are off by a line or point at a comment.**
- FACTS 52: `src/stores/app-store.ts:42-43` misses `scaleType`, which is on `:44`.
- FACTS 52: `KEY_OFFSETS` runs `src/lib/scale-data.ts:47-69`, not 47-63.
- FACTS 50: `src/lib/hash-router.ts:174` is a doc comment. The code is `VALID_TABS` with
  `TAB_SINGING`, `:84-108`, and `isValidTab`, `:151-153`.
- FACTS 54: the list of readers that "take its degrees only" leaves out
  `src/components/guitar/ChordSelector.tsx:20-23`, which also reads degrees only, so the claim
  stands.

**N7. The plan's section estimates add up to 1,525, not 1,545.** WEB-SPEC 162-163. The sum is
55 + 30 + 160 + 70 + 140 + 130 + 200 + 190 + 230 + 230 + 90.

**N8. The treble staff needs two ledger lines below.** FACTS 70 (line 146) gives the staff "a
ledger line's room each way". For the higher voice the treble staff shows A3 to A4, and Step 1's
home chord A3 C4 E4. A3 sits on the second ledger line below the treble staff, so it needs two
ledger lines' room below (the bass clef needs one above, for Step 4's C4).

**N9. The head-title alternative contradicts Step 3.** WEB-SPEC 592-595: "The three minor scales
and relative keys" frames minor as three scales, which Step 3's mix-up card calls half right (one
minor key whose sixth and seventh move). Keep the default, "Harmonic and melodic minor, relative
keys".

**N10. Lesson 24's alternative tease leans slightly.** "Do, mi and so made a major chord. Minor
keys hide another change." (FACTS 5b) puts "major chord" next to a change in a minor key. A learner
can read that as "the change makes a chord major". It answers nothing outright, and the lead's line
is the default. Say so in 5b, so the lead weighs it when binding.

**N11. One departure is missing from two lists.** The cold open plays A3 to A4 for everyone, not A4
to A5 for the higher voice as the plan had it (FACTS 8; hand-back departure 2). LESSON.md's
preamble and WEB-SPEC's Contract do not list it.

**N12. A route edge case for Sight-Singing.** Loading a song in the Singing tab after setting the
key re-keys the grid that Sight-Singing reads (`_alignScaleToMelody`, `src/stores/melody-store.ts`,
`refreshScale` with the melody's key). The `keyName` that Sight-Singing prints ("Key: A
harmonic-minor") does not change, so the screen would print A harmonic minor while writing notes
from another key. Worth one line in WEB-SPEC Edge cases ("set the key and scale last, just before
Exercises"), or for app-check to confirm.

---

## Checked and sound

**The predict and leaks.** The new predict is a sound reasoning check, and the hook no longer
answers it. A learner from Lessons 10, 21 and 23 alone has what it needs:
- Lesson 10, Step 1: thirds of 4 and 3 semitones;
- Lesson 10, Step 2: the middle note is the third;
- Lesson 10, Step 3: a chord is named after its third;
- Lesson 10's Go deeper: E, G, B is E minor;
- Lesson 23: major and minor thirds.

Lesson 10's reveal and quick checks, and Lesson 21's reveal and quick checks, give the premise but
never this answer. Lessons 21 and 23 contain no chord content. Each of these names neither chord
quality nor the answer:
- the title, the promise and the sound gate;
- the head title, the description and its alternative, og and twitter, the share alt, the
  structured data and the llms.txt line;
- the step headings and the menu card ("Lesson 25 · Why raise te?", built from
  `lesson-menu.ts:216-218`);
- the steps' section heading;
- the four words' text and plays;
- the hero before the choice: the tune is melody only and no column is drawn;
- Lesson 24's card: the lead's tease "A minor tune, played twice. The second ending changes one
  note." (63, true of the tune play) and the silent still.

Tavi voicing the wrong guess follows MERC-BIBLE ("voices the intuitive guess"). The tour hold uses
`holdTour` correctly.

**Music, worked independently:**
- A natural, harmonic and melodic minor (up and down), A major and C natural minor: the steps and
  the one-letter spellings are right.
- E–G is 3 and E–G♯ is 4. E minor is 3 + 4 and E major is 4 + 3. F–G♯ is 3 semitones over two
  letters, an augmented second. La–ti in melodic minor is 2. A3 up to C4 is 3.
- Melodic minor going up differs from A major only at C/C♯.
- C minor's flats are right in both clefs: treble B♭4 on the middle line, E♭5 in the top space,
  A♭4 in the second space; bass B♭2 on the second line, E♭3 in the third space, A♭2 in the bottom
  space.
- Sing-along staff places: bass E3 in the third space, G3 in the fourth space, A3 on the top line;
  treble E4 on the bottom line, G4 on the second line, A4 in the second space.
- The tune is in 4/4 and lasts 8.0 s. All 27 frequencies are right.
- Timings: 3.15, 5.95, 6.8, 2.4, 1.55/3.6, 4.2/9.4/10.4, 17.0 and 4.0 s. The run time is
  2117/238 = 8.89 + 5.73 = 14.62 min, so 15.

**Range.** Checked against `VOCAL_RANGES` (`src/stores/settings-store.ts:91-152`):
- The six-preset table is exact: 12/7, 9/10, 4/15, 11/8, 7/12 and 4/15.
- Move do is safe from 2 semitones lower to 5 higher for both voices, and to 6 higher for the
  higher voice.
- Lesson 10's four lower puts so on the tenor's and the soprano's floors.
- Either octave fails: an octave lower is 8 below the floor, and an octave higher is 5 and 4 past
  the top.

The reasons for offering no Move do hold: four semitones of room is the minimum, and a moved do
leads to keys the page does not teach, such as C minor, whose raised seventh would need a natural
sign.

**The app at `c60f0fdcb`:**
- **Gravity:** the twelve degrees with "♭7" Te and "7" Ti; I IV V I in a major key; the probe note
  inside the octave above do; do roved over C3 to B3; tap by default; the pads show syllables.
- **Singing tab, Playback Setup:** A among its eight keys; Harmonic Minor and Melodic Minor offered;
  closed by default; shown by default.
- **Singing tab, phone:** the stage's chip opens a sheet whose Scale menu includes Harmonic Minor.
- **The pickers:** they only call `refreshScale`, so they play nothing. The Play button builds the
  picked scale only when no melody is loaded (`usePlaybackController.ts:382-385`), which the default
  session prevents.
- **Melodic Minor:** one going-up set of degrees.
- **Sight-Singing:** six notes; each step within 7 semitones; sharps with a drawn ♯; treble only;
  60 cents; "No audio preview."; "Key: A harmonic-minor · in your range". A learner can set A
  harmonic minor on both layouts and reach the drill.
- **Scale Runner:** its Minor is natural minor only.
- **"Sad and introspective":** it appears only at `scale-data.ts:88`. No screen either link opens
  shows it, and every reader of the table takes its degrees only. The walkthrough and the sheet
  renderer agree with Step 4.
- **Plumbing:** the lesson marker reads 01 to 14 only, and the answer bounds run 1 to 14.

**Other checks:**
- The shared lines (comfort check, "Just listen today", voice choice, Lesson 15's line, the stop
  line, the guide line, the feelings and the doctor lines) match Lesson 23 word for word.
- The rest version is in Lesson 12's form.
- The head description is 156 characters, with "A fifteen-minute lesson" and "15 minutes" and
  `PT15M`, as `lesson-pages.test.ts:154-159` and `:195-209` ask. The title is 56 characters, og 44,
  the share alt 155.
- The teases are 63, 65, 68 and 56 characters, all within `TEASE_MAX` 70. The lead's Lesson 26 line
  matches Lesson 26's plan (ARTICLE-PLAN.md:27-36) and answers nothing of its predict.
- No emojis, model names or paths; British spelling throughout. Tavi's lines are a guess, a
  question and a self-explanation.
- Departures 1 to 12 in the hand-back are justified, apart from S2's unlisted one and N11.
