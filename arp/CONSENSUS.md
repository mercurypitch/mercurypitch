# Arpeggio Jumper grading: consensus on best practice

24 October 2026. Written by the lead from:

- two research reports: RESEARCH-PRACTICE.md (how to grade a sung arpeggio) and RESEARCH-TONE.md (whether tone can be scored);
- the code facts (CODE-FACTS.md) and the lead's draft (LEAD-DRAFT.md);
- two independent critics: Critic A checked evidence and citations (CRITIC-A.md); Critic B checked product and engineering (CRITIC-B.md).

Where the critics disagreed, the lead checked the code on origin/main 5e08dd4a3. All paths are from the repo root.

## The answer

- **A drill's grade is the mean of its note scores. Nothing else goes into it.**
  - Tone, best note, evenness, consistency, stability and fatigue become feedback, or are deleted.
  - The live readout during a run already shows that mean, so the final number will match what the singer just watched.
- **Before that ships, fix which sound each note is scored on.** Today Arpeggio Jumper can score the reference tone, the previous note or silence as the singer's note. While the best-note term props up the grade, those errors stay hidden. Without it, they would show as lower grades.
- **Ship Arpeggio Jumper first, as one scoring-version bump.** Then apply the same rule to the other drills, one bump each.
- **Change the per-note rule later, as a new shared scorer that each drill adopts with its own bump.** It needs calibrating on the team's own recorded takes on dev first.

## What the evidence supports

- **Tone does not belong in a grade.**
  - Every measure a browser can compute tracks the mic, the room, phone processing and loudness more than technique: periodicity (HNR, CPP, detector clarity), spectral tilt and singer's-formant measures. None can be compared across devices or sessions without a calibrated setup.
  - "Richness" today is mean pitch-detector clarity. That is periodicity confidence: a pure sine scores perfectly.
  - Exam bodies differ on tone. ABRSM's aural tests assess pitch, not vocal quality. The RCM's voice technical tests, arpeggios included, ask for "clear vowel sounds". So the case rests on validity across devices, not on exam practice.
- **No assessment source scores a best note.** The highest of several noisy note scores is biased upward. Feedback after a learner's best trials does help learning (Chiviacowsky & Wulf 2007). That supports showing the best note as praise, not scoring it.
- **Scoring the settled part of a note is standard.** Systems use a trimmed mean after the note lands (Molina 2013), or a landing criterion (Hutchins & Campbell 2009). But listeners still weigh scoops, and rate scoops at the end of a note worst (Larrouy-Maestri & Pfordresher 2018). So trim the approach into the note, not the whole note.
- **Untrained adults sing far wider than listeners' tolerance.**
  - Listeners notice mistuned intervals at about 10-40 cents, about 65 with little musical training.
  - In Berkowska & Dalla Bella 2013, 58-78% of occasional singers averaged more than 50 cents off, and 30-58% more than 100.
  - Lenient success criteria aid learning (Chiviacowsky, Wulf & Lewthwaite 2012).
  - So a tight band with a cliff to zero would zero most beginners' notes.
- **Vibrato needs a signed measure.** A ±71-cent vibrato (the opera mean, Prame 1997) centred exactly on the target scores 32 under today's mean of absolute cents. A signed median or trimmed mean scores it as on pitch.
- **Absolute and interval accuracy come apart** (Berkowska & Dalla Bella; Pfordresher & Brown 2007). Report intervals beside absolute pitch, but do not grade them until calibrated.

## What the critique changed

| Draft said | Consensus | Why |
| --- | --- | --- |
| Fix approximateRichness to read 0-1 clarity | **Delete it, never fix it.** Remove it from every grade first. | A fixed version adds 18-23 points to six drills with no version bump. It would also call any clean tone "very-rich" and "pressed", a pure sine included (Critic B). |
| Share richness's weight among the other terms in proportion | **One rule: grade = mean of note scores.** No reweighting. | Reweighting pays 31-33 points for silence in Scale Runner and Mirror Melody, and 59-60 for singing 40 cents off every note. It grows Routine Runner's broken fatigue term to 37.5% (Critic B). |
| Each missed note scores 0, as it does today | **Wrong in steps mode.** A silent note is scored on whatever was voiced last. | The steps window trails the last voiced frame, not the note's own time (Critic A; checked). |
| Stage 1 is a formula change | **Stage 1 also fixes the scoring windows.** | The windows score the wrong samples. Dropping the best note without fixing them exposes the bug as lower grades: one modelled echo run falls from 46 to 35 (Critic A). |
| bestNote was added to offset a harsh per-note rule | **Unsupported.** It is a template copied into several drills. | Git shows it was born in the same commit as the 1.5-points-per-cent rule, with no rationale, and was copied into seven drills. Ten drills now have a best-of term (Critic A). |
| Rewarding clarity rewards pressing | **Say "rewards being louder and closer to the mic".** | No source shows that it rewards pressing. Periodicity does rise with loudness (Critic A). |
| Stage 2: full credit within ±25 cents, zero at ±50 | **Drop it.** Use the app's accuracy-tier bands, made continuous and calibrated. | A mid singer would score about 95, an S, while most beginners' notes would score 0. It would also add a third ruler beside the tier bands and the 25-cent note-hit line (both critics). |
| Octave chosen once per run, from the first note, in stage 2 | **One offset per run that minimises total error. Owner decides whether it ships in stage 1.** | The first note is where phrases start flat, so one detector error there would zero the run. The default voice preset is tenor, so a woman or child who has not set a range scores 0 on every note today (Critic A; checked). |
| Mid-range runs barely move | **Wrong.** A typical mid run gains 13 points and a strong run 20. | See the modelled runs below (Critic B). |

## Disputes, and how they were settled

- **Does steps mode's scoring window overlap the reference tone?** Critic A said yes; Critic B said the tone ends 250 ms before the window starts. **Critic A is right.**
  - `audioEngine.playTone` awaits only `init()` and `resume()`, so it resolves once the tone is scheduled, not when it ends (src/lib/audio-engine.ts:1104-1125). The playChord doc says so (:1290-1291).
  - Steps mode starts matching 250 ms after that (use-arpeggio-jumper-controller.ts:216-222). At level 5 the scored span runs from about 0.25 s to 2.25 s after the tone starts, overlapping the last 0.45 s of the 700 ms tone.
  - The echo demo does the same: its notes start 250 ms apart, and each one cuts off the last (:121-131). A four-note arpeggio plays in about 1.45 s, and the singer then gets 1.3 s per note to echo it.
- **Is ProDashboard shown to users?** No. It is referenced only in its own file. Critic B is right.
- **Which accuracy tier is the default?** Singer: `createPersistedSignal<AccuracyTier>('pitchperfect_accuracy_tier', 'singer')`. Its bands are 100 at 8 cents or less, 90 at 15, 75 at 25, 50 at 40, and 0 beyond. Its score mode is "settled", which skips the first 15% of each note (src/lib/score-window.ts). Critic A's "Learning" was wrong.
- **The allowance for a late, scooped start: a fixed 0.3 s skip (A) or a proportional trim (B)?** **Use score-window's existing "settled" mode.** It already skips the first 15% of a note's frames, so it scales with the window at every level. It is the app's default. It keeps the end of the note, where listeners judge scoops most harshly. Latency is handled separately, by offsetting each slot by the measured mic latency.
- **When to forgive the octave: stage 1 (A) or last (B)?** This is the owner's call, because it changes lesson copy. **The lead recommends stage 1.** Zeroing every note for anyone singing in their own octave is the largest harm in the review, and putting it in the same bump avoids a second reset of everyone's Progress.

## Recommendation

### Step 0: remove the dead term (no version bump; can ride in step 1's PR)

- Delete `richness * w` from the Call-Response, Mirror Melody, Scale Runner and Drone grades. Do not reweight the other terms.
- Richness is 0 or 1 today, so each score moves by at most 0.25 before rounding.

### Step 1: Arpeggio Jumper v2, one scoring bump

1. **Grade.** `score = avgAccuracy`. Delete the clarity block, its import and `metrics.richnessScore`. Keep the best note on the result line as praise.
2. **Score the right sound.**
   - Steps mode: start the note's match window when the tone ends (tone start plus its duration), not when `playTone` resolves. Score that window with `scoreNoteInRange` and `noteDeviationCentsInRange`, as echo mode does, not the trailing window.
   - Echo mode: play each demo note in full before the next starts. Scale the gap before the echo with the tone's length. Offset every slot by the measured mic latency (mic-latency store; today only the Singing tab uses it, src/lib/practice-engine.ts:490-499).
   - In both modes, apply score-window's settled trim to each note's frames.
3. **Not sung.** A note with no voiced frames scores 0 and logs no deviation, so the tally says "not sung", not "missed". A run in which nothing was voiced is not recorded at all (silence guard; REQ-GVC-031: refuse a false low result).
4. **Octave, if the owner agrees.** Choose one offset per run (an octave down, none, or an octave up) that minimises total error. Score every note in that octave, and count the note tally in it too. Tell the singer, for example: "Scored an octave above the guide tone." The leap to the top do still has to be sung.
5. **Singing time, if the owner agrees.** Keep each note's singing time at or above about 1.2 s at every level. Let higher levels shorten the demo instead.
   - Once the cap goes, the levels above 5 become reachable for the first time. Level 10 shrinks an echo slot to 780 ms, too short for a latency offset plus a settled reading.
6. **Migration checklist** (below).
7. **Copy** (below).

### Step 2: the other capped drills, one bump each

- **Scale Runner:** `score = avgAccuracy`. Evenness leaves the grade.
- **Mirror Melody:** `score = avgAccuracy`. Delete the weights and the consistency term.
- **Routine Runner:**
  - `score = avgAccuracy`.
  - Delete the fatigue checkpoints, the `analyzeFatigue` call and the fatigue, richness and trend metrics. The fatigue term is clarity noise. Inferring fatigue from audio is also what REQ-GVC-026 forbids, and the claims validator flags the word.
  - Replace the "Endurance" tag.
- **Drone:** drop the best-round term. Whether stability stays in the grade is the owner's call. Critic B's lean: show it as feedback ("held within N cents") until stage 2 can measure it on the settled part.
- Score each of these on the note's own time slot in the same bump, where the controller knows it. Scale Runner, Mirror Melody and Routine Runner use the trailing window today.

### Step 3: delete the approximations

- **Delete:**
  - `approximateRichness`, `approximateBreathiness`, `approximateTimbre` and `analyzeFatigue`;
  - `computeTonalQuality` and the unmounted ProDashboard;
  - the unit tests that feed clarity on a 0-100 scale.
- **TimbreCard:** show a waiting state until spectral frames arrive, instead of "thin, 0/100".
- **The intensity fallback:** `intensityFromPitchResults` also reads clarity as 0-100 (vocal-analyzer.ts:248-252). Fix its scale or drop it. It runs only when no loudness level is carried.

### Step 4: the remaining drills

- **Call-Response.** Rescore it only after its per-note slots land. Today each phrase note scores by its single closest frame anywhere in a 3-second window, in any order, so a glide through the phrase models at about 94. Its 75 cap is the only thing stopping that glide from earning an S and the Echo Champion challenge.
- **The other best-of terms.** Siren (25%), Staccato (20%), Chord Stacker (30%) and Dynamic Swell (20%) still carry one. Siren's survived its rescore in #1192.
  - Apply the one rule to each, with its own bump, in an order the owner sets.
  - Siren's glide quality is a pitch measure, not a best-of term, so it can stay in Siren's note score.

### Stage 2: a new per-note scorer

Build it as a new module that each drill adopts with its own version bump. Do not edit `scoreSamples`, which Jam, Interval Trainer and Chord Stacker share; Jam has no scoring version.

- **The note's pitch:**
  - the signed median, or a trimmed mean, of the settled frames, weighted by detector confidence (YIN's intended use);
  - taken over whole vibrato cycles, so a centred vibrato scores as on pitch.
- **Credit:** the user's accuracy-tier bands, interpolated so there is no cliff to zero.
  - Put the tier and the score mode in the comparability key.
  - Keep the 25-cent note-hit line for the tally.
  - The open question is the default: the Singer tier zeroes anything beyond 40 cents, which is most of an untrained adult's notes. Calibration should settle it.
- **Feedback only:** landing time, interval accuracy and steadiness.
- **Calibration:**
  - Record team takes on dev, keeping the audio and the per-frame contour, and have people rate them blind.
  - Model each drill's score shifts before it ships.
  - Use synthetic voices for mechanics tests only.
  - Never use production takes.
- **Revisit the challenge targets with the calibrated numbers.** Arpeggio Ace (88) is impossible today, and would become trivial under a lenient curve.

## Migration checklist for every scoring bump

The Siren pattern from #1192, plus what #1192 left out:

1. Add `[EXERCISE_X]: 2` to SCORING_VERSION (src/features/exercises/exercise-comparability.ts:23), with a dated comment, in the same commit as the formula change.
2. Filter the readers the version does not reach yet by `onCurrentScoring`:
   - computeEma and playCount (adaptive difficulty);
   - findWeakExercises;
   - computePerExerciseStats.

   Without this, the difficulty EMA blends old, capped scores for about ten runs.
3. Tests:
   - Add the key and version to the comparability, challenge-attempt and record-payload tests.
   - In the drill's own test, pin a flawless run at 100 and a silent run at 0, with realistic clarity (0.9). Today's "scores high" tests assert only a score above 40, which is how a 75 cap shipped unnoticed.
4. Progress: label superseded Skill Threads (for example "earlier scoring"), or drop them. Otherwise a period that spans the release shows two threads with the same name.
5. The CHANGELOG line, which renders in the app. Say that leaderboard averages mix the old and new scoring.
6. Re-anchor lesson citations with plan-cites.

## Copy fixes

**Fix now** (false today, whatever is decided):
- Call-Response help and menu card: they promise timing and rhythm, and nothing scores either.
- Drone: the idle line and help say "just intonation", but every target is equal-tempered. Say so plainly.
- Routine Runner's "Endurance" tag.

**With Arpeggio Jumper v2:**
- The help line, "scored on how accurately you hit each note", becomes true. Add a pinned "Scored on ..." card line, as Dynamic Swell has.
- Lesson 9:
  - LESSON.md:424-426: delete "which also counts a measure of how clear the pitch track was". Update FACTS 50 and WEB-SPEC.md:552-557 to match.
  - If the octave offset ships, the Practise it card's "each note in the octave they play" (LESSON.md:294-295) changes too.
- Lesson 12: LESSON.md:447-449, FACTS 46 and WEB-SPEC.md:779.

**With the other bumps:**
- Lesson 10's Drone copy: LESSON.md:432-433, FACTS 49 and WEB-SPEC.md:709.
- Lesson 4's card that links Scale Runner.

## Effect on scores

Modelled on today's per-note rule, before the window fixes:

| Arpeggio Jumper run | Today | v2 |
| --- | --- | --- |
| Flawless | 75 (B at best) | 100 |
| Strong: notes 93/90/87/82 | 68 C | 88 A |
| Mid: notes 82/73/67/55 | 56 C | 69 C |
| Beginner: notes 63/33/10/0 | 31 D | 27 D |
| One good note: average 25, best 100 | 42 | 25 |
| Optional top do skipped | about −11 | −25 |

- Beginners lose a few points. That is acceptable. Soften it with feedback, not points: a "notes landed" count and the best-note praise.
- Because of the version bump, nobody sees a "−19 vs last".
- Today the A and S grades, the Great and Elite marks, the success haptic and every difficulty step up are out of reach in Arpeggio Jumper. Its silver badge, Agile Voice, cannot be earned either. All of these become reachable.

## Device checks before v2 ships

1. **Does the speaker tone get scored?** Run Arpeggio Jumper's steps mode on laptop speakers without singing (two minutes on dev). Nothing gates frames while the tone plays, and the mic runs with echo cancellation off. If the tone scores, gate frames during playback.
2. **Does iOS honour the request** to turn off echo cancellation, noise suppression and auto gain? Read `getSettings()` on a real iPhone.
3. **Echo timing by ear:** whether singers come in late after the demo, and by how much, once the demo plays at full length.

## Decisions for the owner

1. **The one rule:** a drill's grade is the mean of its note scores, and everything else is feedback. Does it hold for every drill?
2. **Arpeggio Jumper v2's scope:**
   - Include the octave offset? It changes the Lesson 9 and 12 card copy.
   - Include the 1.2-second singing floor?
3. **The order of the other drills.** Does Drone's stability stay in its grade?
4. **Stage 2:** the direction (tier bands made continuous), the calibration plan, and which tier exercises default to.
5. **The release-note wording,** including the leaderboard note.
6. **Timing.** Arpeggio Jumper v2 does not depend on the Lesson 9 page, so it can go in the coming release or the next one. Lesson 9's page copy must match whichever grading is live when the page ships.

## What nobody could check

- Device behaviour: tone bleed on speakers; real clarity on phones and in rooms; latency per audio route; how singers time their echoes; whether iOS honours the constraints.
- Production data: how many users run these drills; whether production challenges match seed-data.json; whether anyone already holds the badges that are unearnable today.
- ABRSM's page, which was blocked. Its wording comes from search summaries.
