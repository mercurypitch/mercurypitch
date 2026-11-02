# Lesson 24 review: "Harmony against a drone"

Reviewed: FACTS.md, LESSON.md and WEB-SPEC.md, uncommitted in
`/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/24-drone-harmony/`. They are byte-identical to the
copies in `s2pkg/24/`. App claims were read at `c60f0fdcb` and plan files at the branch head
(`984c2c2dc`). I read the hand-back last.

Counts: **2 blocking, 12 should fix, 21 nits.**

`node scripts/plan-cites.mjs check …/24-drone-harmony`: 240 citations, **0 findings**.
`node scripts/lesson-words.mjs`: **2,227** words, as the package says. Steps' own text runs 111,
120, 100 and 83 words.

---

## Blocking

### B1. Step 3's text answers Step 2's predict, and it is readable before that choice

LESSON.md:257-267; preamble :66-68; FACTS 48 (FACTS.md:116); WEB-SPEC Toys 2 state 3 (:288-295),
Toys 3 (:326-327).

Step 2 asks which of the piano's intervals beats faster above the drone, the fifth or the major
third. Only Step 2's own reveal, text, Try, Notice and drawer are hidden until its reveal (WEB-SPEC
:326-327). Step 3 sits directly under that predict, one Next away in a phone's deck and one scroll
down on a wide screen, and nothing hides it. Before the choice it prints:

- Tavi: "So should I sing the piano's **major third**, or the pure one?"
- "A pure major third is 386 cents, **14 below** the piano's 400; a pure fifth is **2 above** the
  piano's 700."
- Notice: "both sit in the band, but **only the pure one is still**". So the piano's third beats.

The cold open has just taught that closer notes beat more slowly. With that, "14 cents off" against
"2 cents off" gives the answer straight away. No earlier lesson gives the third's 14 cents; I
searched Lessons 1 to 23 for "386", "5:4" and "pure third". Only the fifth's 2 cents is given there
(Lesson 21:255-256, Lesson 23:235).

The package argues the opposite case. It took "third" out of Step 3's heading because the menu lists
the heading before Step 2's choice. Its preamble (:67-68) and FACTS 48 also say "Tavi's line names
it after Step 2's reveal". No line in WEB-SPEC makes that true. FACTS 1a calls the cents "a reason a
learner may use", but the text is more than a hint: it gives the learner the reasoning that lands on
the answer.

**Fix.** Hold Step 3's Tavi line, its text, Try and Notice until Step 2's reveal, as Step 2's own
text is held. The kit's predict takes "one or several elements" as its reveal
(`src/features/lessons/kit/predict.ts:70-71`). Then:

- Say so in WEB-SPEC Toys 3, Edge cases and Tests 5 and 6.
- Make the preamble's and FACTS 48's sentence true.
- Rewrite FACTS 1a's line on Step 3.

### B2. Step 4's wave does not do what the copy says it does

LESSON.md:284-290; FACTS 38 (FACTS.md:103); WEB-SPEC :296-303, :496-498.

Step 4 plays the piano's fifth with "Merc's usual wave, 5.5 swings a second, 14 cents either side".
The copy says: "the even throb is lost"; Notice: "With the wave, that even throb is gone."

FACTS 38's argument uses the gap in instantaneous frequency (E4's second harmonic swings ±5.35 Hz,
so the gap runs from 6.05 under to 4.61 over). A beat follows the phase difference, not that gap.

- The phase swing of a ±5.35 Hz wobble at 5.5 Hz is only 5.35 / 5.5 = **±0.97 rad (±56°)**.
- The slow drift of 0.745 Hz carries on under it.
- I simulated the envelope of E4's second harmonic (0.62) and the drone's third (0.38) over 8 s
  (`python3 -I`).
- Straight, the 0.745 Hz component has amplitude 0.363.
- With the ±14-cent wave it keeps **0.275, about 76 %**, with flutter sidebands of 0.15 at 4.76 and
  6.25 Hz.
- At ±30 cents it falls to 0.054. At ±50 cents it is gone (0.005).

So Merc's narrow wave leaves the slow throb clearly audible, with a shimmer on it. The Notice would
be false against its own sound. Sundberg's "no beats will occur" (R6) concerns sung vibrato, which
is typically ±50 cents or more, not ±14.

**Fix**, either way:

- **(a)** Play a singer's wave: Lesson 22's cold-open wave, ±50 cents at six a second, or at least
  ±30. Recompute FACTS 38 from the envelope, not the instantaneous gap, and test it (Tests 1).
- **(b)** Keep ±14 and reword: "With the wave, a flutter rides on the throb, and it is harder to
  follow." Option (a) is closer to what a learner's own vibrato does in Sing it.

Either way, "Merc's usual wave" should not be the demonstration if the claim stays as written.

---

## Should fix

### S1. FACTS 1a leaves out the text that states the answers below the predicts

FACTS.md:52.

The cold open's answer ("It slows, then stops") is stated in the open, before the choice, in all of
these:

- **Step 1's text**: "The closer the notes, the slower the beats", and "In tune, it's still"
  (LESSON :200-207).
- **Sing it's cue**: "a throb that slows means you're close" (:350-351).
- **The mix-up card**: "Its beats tell you how close you are" (:282).
- **Quick check 1's third feedback** (:393) and **the Wrap's first line** (:415-416).

Step 2's answer is stated in the Wrap's second line (:417), and quick check 2's options name it
among three (:395-399).

Lesson 22's 1a names its equivalents and holds the tour for them (Lesson 22 FACTS.md:47). Here the
list is missing.

Step 1 is also the first card of the deck: no Nexts at all, where Lesson 22's answer sat two Nexts
in.

**Fix.** List each item in 1a with the tour-hold argument. Also consider holding Step 1's text until
the cold open's choice, as B1 holds Step 3's. The page already hides a step's text for a predict, so
it would be consistent.

### S2. Step 2's heading puts "beat" in the menu before the reveal, and reads two ways

LESSON :216; FACTS 12 (FACTS.md:68), 48.

"Do notes that aren't the same beat too?" is in the lesson menu from first paint. FACTS 12 says
"Before the reveal the page says 'throb'". The menu breaks that.

"The same beat" also reads first as a noun, Lesson 8's beat ("notes that aren't the same beat"),
which the page's own one-meaning rule is meant to avoid.

**Fix.** "Can notes further apart throb too?", or "Do two different notes throb too?" Then fix
FACTS 12's sentence.

### S3. The quiet check fails on an unclear rule, and its line names a cause it cannot know

LESSON :338-344; WEB-SPEC :390-395, :609-615; FACTS 52.

Item 6 says the check fails on "a voiced run of 0.3 s or more **in any octave**", which does not say
of what. Its tests use only a tone on the drone's pitch or an octave from it.

If the rule is any voiced run, then a learner who hums or answers early, a television, or a second
singer all fail it. The line still says "The microphone can hear the drone", which may be false. The
hold reader's rule is that a line describes the recording and nothing else (REQ-GVC-045,
`kit/hold-take.ts:28-31`).

**Fix.**

- Say what fails the check: any voiced run, or one within, say, 50 cents of do's pitch class in any
  octave.
- Word the line to what was heard, with a next step: "The microphone heard a note while the drone
  played, so nothing will listen this time. Check your headphones, stay quiet, then press Start
  again."
- Add a test: a voiced run at an unrelated pitch fails or passes, as the rule chooses.

### S4. The speaker-drone lab test misses the case it most needs to cover

WEB-SPEC :616-630.

The test requires that silence never reads in the band. The dangerous case is **a voice that stops
on do**.

1. The singer stops two seconds into the unison hold.
2. A speaker drone, or one leaking from open-back headphones, near the detector's threshold keeps
   giving voiced frames.
3. The hold reader ends a hold only after a heard quiet gap of more than a second
   (`kit/hold-take.ts:142-148`), so the drone carries the run on.
4. The hold reads "In the band for all 5 seconds".

The quiet check catches only runs of 0.3 s or more in two seconds of drone alone. Intermittent
drone frames pass it, then fill a stopped hold.

**Add to the lab test:**

- Sing do for 2 s, then stop. The reading must be Lesson 5's stopped-early line, never a full hold.
  Run it at the holds' level and at full volume.
- **Bluetooth earbuds**, the commonest headphones on a phone. Record whether opening the microphone
  switches the headset's profile or moves the drone to the loudspeaker. The quiet check makes this
  safe, but the lab should know how often it sends people to the sing-along.
- The fifth over D4 (0.99 a second) in the timbre test. Item 7 lists A3 and D3 only.

### S5. Two identical notes can cancel each other: say how the unison lands in phase

WEB-SPEC :217-221, :268-277, :492-495; Tests 1.

Two harmonic tones at one frequency add by their relative phase. At 180° every odd harmonic cancels:
Σa_k(1 + (−1)^k), leaving only the even ones. The "still" note then sounds an octave up and thinner.
The app already guards against this in Beat Hunt (`src/features/ear-lab/dyad-synth.ts:1-12`).

- **The cold open's slide** is safe if both voices start on the same audio time. They then run 6
  beats in the first 1.5 s and 11.92 during the glide, landing about 29° apart, close to in phase.
  The kit's `build` starts each voice at `currentTime + at` (`kit/sound.ts:167-200`), so say both
  start together.
- **Step 1's drag** snaps to 220 Hz, or 440 Hz in the octave, at whatever phase it reaches. It can
  land near 180°.

**Fix.**

- Start the drone and every note set against it on one audio time, and test the slide's end phase.
- On a snap, restart the top note in phase with the drone, or keep the top note's level a few dB
  under the drone's so nothing cancels fully.
- Add both to Tests 1.

### S6. The reason given for no Move do does not hold

LESSON :559-564; FACTS 57.

My arithmetic agrees with the writer's: moving do up 1 to 5 semitones keeps every preset two inside
(the higher voice could go to 6), and any move down fails at the tenor or the soprano. The text then
says "So the page offers no move", which does not follow.

Lesson 20 had the same layout, do on D3 and D4 with the tenor and the soprano 2 semitones above
their floors, and offered "Move do: higher" only (Lesson 20 LESSON.md:474-484). Here the tenor's and
the soprano's do sits 2 semitones over their floor, exactly where a do that feels low needs a way
up.

**Fix.** Either:

- offer "Move do: higher", up to five, with the drone moving with it and the lab's speaker and
  timbre tests covering the moved drones; or
- state the real reason (for example, the lab tests and Lesson 26's shared drone are fixed on D) and
  keep the question in the coach's list.

### S7. The hold flow for a set of three notes is not specified

WEB-SPEC :396-445, :631-636; Tests 10.

Lesson 5's flow is per hold (`HoldNo = 1 | 2`, `TAKES_PER_HOLD`, `lesson-05/hold-flow.ts:26-32`).
This page runs sets of three notes, then two, and item 8 only lists "a set of three notes … then a
set of two". The spec does not say:

- what **Again** repeats: the whole set, or one note;
- what a hold with **no voice in 6 s** does in the middle of a set: state 8 offers Again or Done for
  today, with no feelings question, but does so still follow do?
- what counts as one of "three takes a set";
- whether a set with one unread hold can earn the celebration ("every hold … at least 80 %") or the
  summary.

Lesson 22's flow has none of these questions, because it has one note per hold.

**Fix.** Write the set's rules in Toys 6 and test them in Tests 10.

### S8. The practice card leaves out the headphones point this page teaches

LESSON :427-433; WEB-SPEC :528-537.

Drone Intonation plays its drone through the speakers
(`use-drone-intonation-controller.ts:155`) while the app listens on the same raw microphone chain
(`src/lib/mic-manager.ts:47-56`). This page's own argument for headphones (FACTS 51) applies to it in
full. The card says nothing about it.

**Fix.** Add "Headphones help here too: its drone plays while it listens." (11 words). It can take
the place of Length cut 2's sentence on the drone's timbre (see N17).

### S9. Step 2's choice is never wired to unlock Steps 3 and 4

WEB-SPEC Toys 3 :324-328, against :286-287, :293-295, :302-303, :304-306 and :376-381.

Toys 3 says the choice `unlocks` "the beads' taps, Piano · Pure and Play all three", and that
`onChoice` unlocks "free play's Step 2 state". Toys 2 (states 3 and 4, free play), Toys 6 state 3
and Edge cases all say these also wait for Step 2's choice:

- Steps 3 and 4's plays and drag;
- free play's states 3 and 4;
- "Just listen today"'s play.

Nothing says who unlocks them.

**Fix.** Name them all in Toys 3's `onChoice`.

### S10. The tease alternative for Lesson 25 was checked against its hook, not its predict

FACTS 5b (FACTS.md:58); LESSON :454-458.

FACTS 5b checks that neither line "names te, ti, the seventh, a raised note or a harmonic minor, so
neither answers Lesson 25's question". That is the hook. Lesson 25's predict, as it now stands,
asks whether raising G to G♯ turns E, G, B major (Lesson 25 FACTS 33).

The `plan` line, "Do, mi and so made a major chord. Minor keys hide another change.", sits one line
above that hook. It primes "major chord" for "another change" in a minor key. The lean is soft:
Lesson 25 frames its predict as a reasoning check on Lesson 10's thirds. But HANDOFF § 5 asks for
the console's alternatives to be checked against the predict.

The lead's line, "A minor tune, played twice. The second ending changes one note.", is clean. It is
true of Lesson 25's opening and names no note or chord.

The `plan` line is true of this page, but only because Step 2 now plays the chord. The tease rule
also asks for "the next opening in miniature" (CURIOSITY-MOMENTS.md:36-37), and this line is not
that.

**Fix.** Check the alternative against the predict in 5b and say what you find. My suggestion for
the lead is to bind the lead's line alone, or keep `plan` only if the lead accepts the soft lean.

### S11. The centre-line reader is restated, not cited, and has no test at 5 seconds

WEB-SPEC :447-452, :600-603; Tests.

"The reader" paragraph rewords Lesson 22's spec. It says "unchanged", but it is a second copy that
can drift.

Lesson 22 is committed (`5a283f8d9`), so bind these citations:

| What | Where in Lesson 22 |
| --- | --- |
| The reader | WEB-SPEC.md:486-516 |
| Item 4 (Merc's vibrato as a parameter) | WEB-SPEC.md:684 |
| Item 6 (the centre-line reader) | WEB-SPEC.md:717 |
| Item 7 (Lesson 5's hold flow in the kit) | WEB-SPEC.md:732 |
| Item 5's no live band state and violet middle line | WEB-SPEC.md:698-716 |
| The straight-note answer | LESSON.md:18-19 |
| The summary's wording | LESSON.md:329-330 |

Item 5 is also needed here (state 8 draws the dashed violet middle). It is missing from this page's
list of Lesson 22 pieces, which names only items 4, 6 and 7.

Lesson 22's reader tests are all on 10-second holds, apart from an early stop and the "3.0 s or
less is one window" case (Lesson 22 WEB-SPEC.md:858-884).

**Add tests:**

- A ±50 wave at six a second round mi for 5 s reads all 5 s.
- Merc's ±14 wave on a pure third reads in full.
- A 5-second hold that stops at 2.5 s gives the stopped-early line, read on the middle line.

### S12. The coach's list is missing two lines

LESSON :496-609.

- **Step 4's Try and Notice.** "With the wave, that even throb is gone." carries the same risk as
  the lines already listed, of reading as a rule against vibrato. B2 will change it anyway.
- **Headphone volume.** The drone's level in the ears depends on the device's volume, which the
  page cannot set. Add a coach line on it, for example "Keep the volume low enough that you hear
  yourself clearly", or confirm it is not needed.

Two more things for the coach to look at:

- the 4-second wait between Merc's model note and the learner's entry, with the drone on do in
  between (2 s Listen and 2 s Breathe), which asks a beginner to hold so or mi in memory against do;
- the sing-along's "Sing along again", which has no cap, where the scored sets cap at three takes.

---

## Nits

- **N1.** WEB-SPEC:269: 216 Hz is **31.8** cents under 220 (1200 × log2(216/220) = −31.77), not
  31.4.
- **N2.** FACTS 69 (:165) has Play all three as "A3, C♯4 and E4 … with the drone", a second A3.
  WEB-SPEC :283-284 has "the drone, do, with mi and so". Make them agree; do is the drone.
- **N3. "So" as a conjunction** in learner copy, on a page that sings do, so and mi: :158 ("So
  against a drone"), :237, :259 (Tavi's "So should I sing…", one step after so is played), :326,
  :342, :398-399, :429. Lessons 20 (FACTS 73) and 25 (FACTS 10) reworded the same thing. At least
  drop Tavi's "So".
- **N4. "Tone" for a sound.** The card's "a plain tone" (:430) sits on a page whose recall says "Two
  semitones make a tone". Lesson 22 ruled "straight note, not straight tone". Use "a plain sound". Beat
  Hunt's "two pairs of tones" is the app's own wording and can stay.
- **N5. "Its beats"** in the mix-up card (:282) and the Wrap (:418): the beats belong to the pair,
  not the other part. "The beats between you tell you how close you are."
- **N6. Pure's definition** says "make an exact ratio" (:186). Any two frequencies make a ratio.
  "Whose frequencies are exactly in a ratio of small whole numbers: 3 to 2 …", as Lesson 21's "two
  notes whose frequencies are exactly 3 to 2".
- **N7. The llms.txt line** (WEB-SPEC :118-120) should take the file's form, "- [Lesson 24: Harmony
  against a drone](https://mercurypitch.com/learn/24): …" (`public/llms.txt:78`), as Lesson 23's
  spec does.
- **N8. Step 2's Notice**, "pure, do, mi and so, Lesson 10's major chord, ring still." (:242), reads
  badly. Try "Tuned pure, do, mi and so, Lesson 10's major chord, ring still."
- **N9. A gap between Merc's note and the drone.** Toys 6 state 7 should give a gap, as the
  sing-along's 1.0 s of quiet does, or say the drone starts after Merc's release. Otherwise the
  piano's so or mi sounds over the drone for about 0.3 s before Step 2's choice, which Tests 6
  forbids.
- **N10. "Just listen today"'s play** holds Merc's so and mi over the drone. Say whether they are
  straight or carry his usual wave (WEB-SPEC :376-381).
- **N11. After "Just listen today".** State 3 says "nothing asks the viewer to sing". Make it
  explicit that the headphones check, Start and the sing-along do not show (REQ-GVC-055), and add
  that to Tests 11.
- **N12. Lesson 22's vibrato line.** State 8 should say whether "The note had a wave: about …"
  shows. It should not, since this page teaches no rate or extent.
- **N13. "One note throughout".** WEB-SPEC :310-311 says a state change keeps the drone's band "so
  the drone reads as one note throughout". From Step 3 the drone stops being the amber band and
  becomes a chrome line, while an amber band appears on mi. I agree with the hand-back that the
  change is acceptable, but the sentence is not true across Step 2 to 3. Reword it, and add a line
  to the stage's summary when the colour changes.
- **N14. The drag's 0.6-second tail.** Step 1's drag stops 0.6 s after release (:270-271), too short
  to hear a beat every 2 s at the spot just found. Let it ring 3 to 4 s after release. The preset
  plays cover the gap in the meantime.
- **N15.** FACTS 61: Beat Hunt's rove tops out at 110 × 2^1.5 = 311.1 Hz, D♯4, not "about E4". The
  code comment says "~E4". FACTS only.
- **N16.** FACTS 60: the engine's instrument is also set by the guitar practice controller
  (`useGuitarPracticeController.ts:399`) and the playback runtime (`playback-runtime.ts:100`). The
  Piano tab leaves it on 'piano' after the learner moves on (`App.tsx:672-681` sets it only on
  entering). "By default" still holds; tighten "changes only on…".
- **N17. Length cut 2** (WEB-SPEC :183-185) removes the one line telling a learner the drill's drone
  will not beat. If the cut is made, the editorial (:441-448) and FACTS 66 must follow. A
  same-length swap for S8's headphones line may be the better use of the words.
- **N18. The chord against the season's topic note.** SEASON-2 § 4.1's S20a row (:754) says
  "against a drone the third and fifth are intervals, not yet a chord". Step 2's chord departs from
  it. That is fair, since Lesson 10 taught the triad, but the hand-back should tell the lead, so the
  row can follow.
- **N19.** WEB-SPEC :85-86 says the mix-up card "sits in the step whose toy refutes it". Step 4's toy
  (wave against straight) does not refute "shut out the other voice"; the study does. Reword.
- **N20.** WEB-SPEC :63: WCAG 2.3.1's general flash is a change of 0.1 or more in relative
  luminance. Write "a swing under 0.1 in relative luminance" for "under 10 % relative luminance".
- **N21.** Step 3's band: "at least 40 px" (WEB-SPEC :289) against "at least 43 px" (FACTS 78).
  Pick one.

---

## Checked and found sound

### Leaks

- **Head and opening.** The title, promise, sound gate, head title, description, og and share
  titles, and the share card's alt name no beat, slowing, stopping or faster interval. Lengths
  counted: 136 for the description, 51, 52, 71 and 153, the two teases 57 and 69, Lesson 25's 63
  and 65. "A sixteen-minute lesson" passes `lesson-pages.test.ts:156-159`, `:191-210`, and the word
  is at `:84`.
- **Hero.** It matches Lesson 23's still (Lesson 23 WEB-SPEC.md:430-434): band on A3, a thin chrome
  line at 31.2 cents, no glow.
- **Lesson 23's tease.** "A drone, and a second note just above it, almost in tune." is true of the
  cold open as written: 220 against 224 Hz plays first, and 224 Hz is 31.19 cents up, in the band.
  The free play is set-up only.
- **Four words.** Harmonic and Equal-tempered play single tones. Drone plays A3 alone. Pure's pure
  fifth is locked until the cold open's choice. No word sets two close notes together.
- **Toys and plays before each choice.** Every step toy, Pure's play and quick check 4's play are
  locked until the cold open's choice. Step 2's plays, taps and chord, and Steps 3 and 4's plays,
  are locked until Step 2's choice (wiring aside, S9). The tour waits.
- **Recall.** Its two questions match `l10-q1` (`lesson-10/quiz-questions.ts:41-61`) and Lesson 23
  LESSON.md:341-344 word for word.

### Arithmetic

All worked with `python3 -I`:

- **Pitches:** every equal-tempered frequency in FACTS' table.
- **Cents:** pure M3 386.31, 13.69 under; pure P5 701.96; ET/pure third ratio 1.0079.
- **Beat rates:**
  - fifth over A3, D3 and D4: 0.745, 0.497 and 0.994;
  - major third over A3, D3 and D4: 8.731, 5.827 and 11.654;
  - in the piano chord: mi–so 14.96, do–so's fourth harmonic against sixth 1.49;
  - the pure chord: on 55 Hz multiples, none beats.
- **The slide:** 4.00, 2.99, 1.99 and 0.99 at 0, 1.5, 3.0 and 4.5 s into the glide; about 12 beats
  in the glide and 6 before it.
- **The octave:** 441 Hz against A3 beats at 1, 2, 3 and 4 Hz.
- **The band:** a pure M3 sits 21.31 inside the band's edge, a pure P5 33.04.
- **The ranges:** all six presets against D3, F♯3, A3 and D4, F♯4, A4, room 10/7, 7/10, 2/15,
  9/8, 5/12, 2/15. Move do's limits too: up 5 (6 for the higher voice), nothing down.
- **Drone Intonation's score:** 100 − 13.69 × 1.5 = 79.47, so "about 79 a round" at the default
  difficulty. 84 to 66 at difficulties 1 to 10. Run ceiling 0.4 + 0.15 + 0.25 = 80.

### App

All read at `c60f0fdcb`.

- **Drone Intonation.**
  - Its pool is six intervals (`:18-25`); a launch keeps to them (`:33-45`).
  - The target is ET with no octave fold (`:152`, `:183`, `:192-193`).
  - The drone plays for the window plus 2 s (`:155`); the window is 4 s (`:13`).
  - The score is `SCORE_K` / factor (`:16`, `:127`, `:198`); run weights at `:289-291`.
  - The idle line (`DroneIntonationExercise.tsx:133-134`) and "Last round" (`:220`).
  - The slug `thirds-on-a-drone` is [3, 4] (`slug-map.ts:75-81`).
  - The instrument defaults to a sine (`app-store.ts:45`, `audio-engine.ts:149`, `:1909-1932`).
- **Beat Hunt.** Two sines a pair (`dyad-synth.ts`), the prompt (`:163`), the staircase from 40
  (`drills.ts:83-90`), `beatWord` (`beat.ts:23-33`).
- **The demo voice's partials** (`demo-voice.ts:123`) equal the kit's `merc` wave
  (`sound.ts:121-124`). The levels in dB in FACTS 72 are right: 17.1/12.4, 8.4/4.2, 26.0/32.4,
  20.0/14.0.
- **The hold reader.** ±35 cents, folded, rounded down, no reading for too little voice. It plays
  nothing during a take (`sound.ts:533-541`). `NO_START_LINE`, `holdSummary`, `HOLD_WAIT_SEC` and
  Lesson 5's 0.4-second take gap (`sing-hold.ts:12-17`) all match.
- **Other app claims:**
  - the microphone chain (`mic-manager.ts:47-56`, `listen.ts:10-22`);
  - the lesson marker (`lesson-marker.ts:11-19`) and answer bounds (`mirror-metrics.ts:57-67`, `:77`);
  - `holdTour` and the tour step;
  - the predict API (`predict.ts:5-17`, `:53-71`, `:155-174`);
  - the comfort module's lines;
  - `season.ts` fields and `EDGES`, and `drafts.ts`;
  - the host paths.

### Shared lines, safety and rules

- **Shared lines.** Word for word against Lesson 5 LESSON.md:25-33 and 198-247: the comfort check,
  Just listen (adapted as stated), the voice choice, the briefing, the stop line, the doctor lines,
  the four feelings and their lines, the tricky line, and the rest card in Lesson 10's form.
- **Voice safety.** Holds of 5 and 10 s, within the house rules. Nothing scores beats, vibrato or
  length. Headphones are asked for before the scored path, which stays unscored without them. The
  scored path is gated on the lab test, and the lead's four answers are applied.
- **Rules.** British spelling throughout. No emojis (only ♯ and ♭), no model names, paths or agent
  ids in the lesson files.
- **Plan files.** Lesson 26's recall (`26-second-voice/ARTICLE-PLAN.md:47-49`) gets quick check 1's
  question and answers unchanged.

### Hand-back

Its departures match LESSON's preamble and FACTS. One claim is not borne out by the spec: that
Step 3's Tavi line shows "after Step 2's reveal" (B1). The writer's questions 2 to 4 and 6 are for
the lead.
