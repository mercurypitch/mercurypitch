# The Ear Lab — ear training that proves you improved

> Status: **Phase 0 landed** — the measurement core is built and tested in
> `src/lib/ear/`. Everything from Phase 1 on is still a plan.
> Owner: TBD · Target: **a new top-level tab** alongside Exercises and The Ascent.
>
> **Decisions taken:** naming is `Ear Lab` / `Mercury Index` / `Calibration`; the
> feature gets its own top-level tab rather than living inside Exercises; the
> measurement core ships headless first, before any UI.

---

## 0. The one-sentence pitch

Every ear trainer tells you "78% correct." **The Ear Lab tells you "you resolve 9 cents —
you needed 31 cents in March,"** and can prove it with a sealed benchmark it never let you
practice on.

---

## 1. Why the existing apps fail (research summary)

Four failure modes show up over and over in the market and in the pedagogy literature.

### 1.1 The score treadmill — the big one

Every app reports **percent correct at whatever difficulty you happen to be on**. But the
difficulty adapts to keep you near ~75%. So the ruler moves with the thing it measures, and
your number sits at 75% forever. Users report "months in, skills plateau, I stopped seeing
real progress" ([Musical U][mu-motivation], [The Maestro][maestro]) — the plateau is at least
partly a *measurement artifact*. They probably did improve. The app just cannot show it.

**This is the gap the user identified, and it is the whole reason to build this.**

### 1.2 Interval-first training doesn't transfer

The classic drill — two notes, name the interval — strips away the key, so you never learn how
notes *function*. Real music is a stream of scale degrees over a tonal centre, and each degree
has its own character (♮4 leans down to ♮3, ♮7 pulls hard to ♮1, ♮5 sits still). Train
context-free intervals and you build a skill you then have to translate in real time
([StringKick][stringkick], [ToneSavvy][tonesavvy]). Functional/scale-degree training mirrors how
music actually works — and once you know both degrees you get the interval for free.
Functional Ear Trainer is the app that got this right; it's also narrow (tonal function only).

**Design consequence: functional/in-key training is the spine. Intervals are a supporting drill,
not the main event.**

### 1.3 The transfer cliff

Apps drill synthetic sine tones and then the user cannot hear a bassline in a song. Complaints
cluster here: gamification "collapses the moment you try to play something the app hasn't
pre-programmed" ([eartrainingforguitar][etfg]). Nothing bridges drill → real audio.

### 1.4 Boredom kills it in three days

Ear training is repetitive by nature; without a habit loop, consistency dies fast
([Musical U][mu-hard]). Randomised-controlled work on auditory training found gameplay
*itself* drives intrinsic motivation to keep training ([Open Research Online][oro]) — so the
game layer is not decoration, it is the delivery mechanism.

### 1.5 What MercuryPitch is uniquely positioned to do

Nobody else shipping an ear trainer already owns: sub-cent real-time pitch detection, UVR stem
separation, key detection, chord detection, a multi-instrument synth, a fretboard, a piano roll,
a streak/goal system, and a guided path. Sections 4 and 5 are built to exploit exactly that.

---

## 2. The core idea: two rulers that only move one way

Replace "% correct" with two measurement families, both of which are **monotonic** — they keep
moving as you improve, because neither is expressed as accuracy.

### Ruler A — **Resolution** (threshold tasks, absolute physical units)

Borrowed straight from psychoacoustics. Use a **transformed up-down staircase (2-down-1-up)**,
which converges on the 70.7% point of the psychometric function: two correct in a row makes it
harder, one wrong makes it easier ([Levitt][levitt], [Purdue notes][purdue]). Take the mean of
the last 6 of 8 reversals. The output is not a score — it is a **difference limen in a real
unit**:

| Drill | Unit | Typical untrained | Trained musician |
| --- | --- | --- | --- |
| Pitch discrimination | cents | 30–50¢ | 3–10¢ |
| Beat/tuning detection | cents of detune | 25¢+ | <5¢ |
| Onset timing | ms | 40–60 ms | 10–20 ms |
| Tempo drift | % BPM | 6–8% | 1–2% |
| EQ band ID | dB @ band | 9–12 dB | 2–3 dB |
| Melodic memory | notes held | 3–4 | 8–9 |

These numbers **go down (or up, for span) forever** and are directly comparable across sessions,
devices and months, because a cent is a cent. This is the honest answer to "did I improve?"

### Ruler B — **Rating** (identification tasks, Elo against a calibrated bank)

Naming a chord quality has no continuous unit, so use the approach adaptive-learning research
converged on: an **Elo rating** over an item bank with fixed, pre-calibrated item difficulties
([Pelánek][pelanek], [Elo psychometrics][elo-psy]). Player rating rises; item difficulty is
frozen after calibration so the scale doesn't drift. K-factor decays with the number of
attempts (high early for fast convergence, low later for stability).

Result: "your Harmony rating is 1420, up from 1180" stays meaningful *even though the items you
now see are harder* — which is precisely what percent-correct cannot do.

> **The design rule this enforces:** the user should never look at a number that is pinned at
> 75% by construction. Thresholds shrink, ratings climb. Difficulty adaptation becomes invisible
> plumbing rather than the thing that eats your progress signal.

---

## 3. The proof: Calibration Day

Practice-time estimates drift and can be gamed (grind easy items, repeat a familiar bank). So
the headline number is not earned in practice — it is **audited**.

- A **sealed benchmark bank** ships with the app and is **never served as a practice item**.
  Same protocol, same items, same order-randomisation rules every time.
- Every 14 days (or on demand) the app offers **Calibration** — ~4 minutes, ~40 items, fixed
  staircase runs. No hints, no retries, no difficulty adaptation beyond the staircase itself.
- Output: a dated **Ear Certificate** — every faculty's reading, the delta since last time, and
  a confidence interval. Shareable (the app already has hash-based share links and a community
  surface).
- Between calibrations the dashboard shows the *practice estimate* in a visibly lighter
  treatment. Only calibration marks the column.

This is the difference between a bathroom scale and a lab test, and it's the thing that lets the
product say *"you improved"* and mean it.

**Test-retest matters more than absolute accuracy here.** The PROMS battery achieves composite
test-retest r > .85 with per-subtest .56–.85 ([Law & Zentner][proms]); that is the bar to aim at,
and the reason the benchmark must be sealed and protocol-identical.

---

## 4. Ear vs. voice — the diagnostic nobody else can ship

Every item accepts **three answer modes**, and the user (or the app) picks:

1. **Tap** — buttons, piano keys, or fretboard. No mic. This is what opens the product to
   guitarists, pianists, producers and bassists. *Today every "ear" exercise in the app requires
   singing, which conflates two different skills and locks out most musicians.*
2. **Play** — play it on your instrument; scored via the existing pitch detector / fretboard
   quiz path (`NoteLocatorQuiz`, `guitar/tuner.ts`, `OPEN_MIDI`).
3. **Sing** — the existing pitch pipeline.

When a user answers in more than one mode, the app can **separate perception error from
production error**:

> You tapped ♮6 correctly, then sang it 34¢ flat.
> **Your ear was right. Your voice missed.** → routes you to `pitch-hold`, not to more ear drills.

And the inverse: sang it dead-on but tapped the wrong degree → you can *match* pitch but you
can't *name* function. Different problem, different drill.

No competitor can do this because no competitor has the real-time pitch stack. It also makes
the existing vocal exercises better: `interval-trainer` today scores a sing-back and cannot tell
you *why* you missed.

---

## 5. The exercises

Six faculties. Each has a metric, a unit, and a visual identity.

### Faculty I — **Resolution** (threshold drills, Ruler A)

| # | Name | Task | Unit | Visual |
| --- | --- | --- | --- | --- |
| 1 | **Hairline** | Two tones — which is higher? Gap shrinks by staircase. | cents | Two mercury beads converging until they merge; the last gap you can still see *is* your number |
| 2 | **Beat Hunt** | Is this dyad in tune? Detune shrinks toward zero. | cents | Two waveforms sliding into phase; the beating envelope made visible |
| 3 | **The Grid** | One hit is off the grid — which one? | ms | Pulse lattice, one dot nudged, trails showing the offset |
| 4 | **Drift** | Did the tempo change? | % BPM | Metronome column that leans |
| 5 | **Colour** | Which octave band got boosted? *(producers/mixers)* | dB | Spectrum bands, the boosted one blooming |
| 6 | **Span** | Echo back a melody that grows one note at a time. | notes held | A chain of beads, each held note another link |

`Span` deserves a call-out: **melodic memory span in notes** is a beautifully legible metric.
"You hold 7 notes; in April you held 4." Nobody reports this and everybody understands it.

### Faculty II — **Function** (in-key, scale degrees — the spine, per §1.2)

| # | Name | Task | Ruler |
| --- | --- | --- | --- |
| 7 | **Home** | A cadence plants the key, then a note sounds — name the degree. | Elo |
| 8 | **Gravity** | Same, with chromatic degrees (♭3, ♯4, ♭7…). | Elo |
| 9 | **The Pull** | Two degrees; which one *wants to move more*? Trains tendency, not labels. | Elo |

**The signature visualisation:** degrees as bodies orbiting the tonic. Each carries a **pull
vector** toward its resolution — ♮7 strains at the tonic, ♮4 leans on ♮3, ♮5 sits dead still.
Answer correctly and the note snaps along its pull line and resolves, with the interval sounding.
This teaches the *feeling* the literature says is the actual skill, instead of a label.

### Faculty III — **Shape** (melody & contour)

| # | Name | Task |
| --- | --- | --- |
| 10 | **Echo** | Melodic dictation — tap/play/sing it back. Adaptive length feeds `Span`. |
| 11 | **Contour** | Up / down / same, at speed. Fast, low-stakes, great for warm-up. |
| 12 | **Leap** | Interval ID out of context. *Explicitly framed in-app as the supporting drill, not the goal.* |

### Faculty IV — **Colour** (harmony)

| # | Name | Task |
| --- | --- | --- |
| 13 | **Stack** | Chord quality → inversion → extensions → voicing. |
| 14 | **Cadence** | Progression and cadence ID in Roman numerals, played in a real style via the existing guitar synth + drum machine, not block sines. |
| 15 | **Bassline** | Root motion only. The single most practical harmonic skill for a working musician. |

### Faculty V — **Time**

| # | Name | Task |
| --- | --- | --- |
| 16 | **Pulse** | Rhythm dictation — tap it back. (Closes feature-proposal #14, still open.) |
| 17 | **Subdivide** | Meter and subdivision ID; find beat 1 in an odd metre. |

### Faculty VI — **In The Wild** — the transfer bridge

**This is the differentiator that closes §1.3, and it is only possible in this codebase.**

Point it at a real song — one the user already separated with UVR, or anything in the karaoke
library — and generate ear items *from the actual audio*:

- Key detection (`lib/key-detection/`) plants the tonic → "what degree does the vocal land on
  in this hook?"
- Chord detection (`lib/chord-detector.ts`) → "what's the root motion in this turnaround?"
- Isolated bass stem → **Bassline** on real music.
- Isolated vocal stem → **Echo** against a real melody.
- Mute a stem and ask the user to sing/play the missing part; score with the existing mic path.

Every other ear trainer stops at synthetic tones. This one graduates you onto the music you
actually listen to — and it reuses stem separation, key detection, chord detection and the
karaoke library that are already shipped.

---

## 6. The gamified frame

### The Mercury Column

Mercury is the brand *and* the instrument: a thermometer is a calibrated column that rises.
The dashboard hero is a vertical quicksilver column — the **Mercury Index**, one number
(0–1000) that composites the six faculties.

- Rises **only on Calibration Day**, with a slow, weighty liquid-metal fill and a single
  audible "tick" per notch — earned, rare, satisfying.
- Between calibrations, a lighter mercury *meniscus* floats above the marked line showing the
  live practice estimate. You can see where you're heading and where you've been *proved*.
- Historical marks etch permanently into the glass, dated. The column becomes a record.

Fits "Liquid Precision" exactly (BRAND.md §1, §5), reuses the droplet/ripple motif, and gives
Merc a job — the mascot lives inside the column and reacts.

### Secondary loop: **Resolution as focus**

The recurring animation metaphor across all threshold drills: **blurred → sharp.** A smeared,
doubled waveform that snaps into a single clean line as your resolution improves. Your session
opens with the spectrum at *your* current blur level. It is instantly legible and it makes an
abstract number physical.

### The confusion matrix — "The Ear Report"

A heatmap of what you confuse *with what*: "you hear ♭7 as ♮6 41% of the time." Actionable,
specific, and it visibly **cools** week over week as cells drain. No shipping app shows this,
and it's cheap to compute from data we're already storing.

### Habit layer

- **3–5 minute sessions.** Consistency beats intensity; the app already has streaks, daily
  goals, streak freezes and practice minutes (`UserProfile`, `usage-store`, `practice-minutes`).
- **Item-level spaced repetition** — half-life regression per item, Duolingo-style
  ([Settles & Meeder][hlr]), so weak degrees resurface exactly when they're about to decay.
- **Ear Path** — its own orb path parallel to The Ascent, unlocking faculties. `WeekTheme`
  already has an `'ear'` theme; The Ascent's Week 4 gets rebuilt on this engine rather than
  duplicating it.
- **Daily Calibration Sprint** — 60 seconds, one faculty, leaderboard-eligible. Feeds the
  existing weekly-challenge machinery.

---

## 7. Technical design

### Modules

Pure logic goes in `src/lib/ear/` and UI in `src/features/ear-lab/`, matching the
existing `lib/glass` ↔ `features/glass` split. It also puts the engine inside vitest's
`src/lib/**/*.test.ts` glob, so the tests run without touching the config.

```
src/lib/ear/                  # ── built (Phase 0) ──
  staircase.ts                # 2-down-1-up transformed up-down + reversal averaging
  elo.ts                      # rating update, decaying K, guess floor, item freezing
  calibration.ts              # interleaved tracks + pooling into one reading
  drills.ts                   # the drill catalogue: units, staircase configs, scales
  mercury-index.ts            # readings in mixed units → one 0–1000 number

src/lib/ear/                  # ── still to build ──
  item-bank.ts                # calibrated practice items
  benchmark-bank.ts           # SEALED — never served in practice
  scheduler.ts                # half-life regression / next-review selection
  confusion.ts                # confusion matrix accumulation + decay

src/features/ear-lab/
  ear-lab-store.ts            # session state, current item, answer mode
  answer-modes/               # tap | play | sing → normalised Answer
  drills/<one dir per drill>  # mirrors features/exercises/<drill>/ convention
  components/                 # MercuryColumn, EarReport, ConfusionHeatmap, PullOrbit
```

### What Phase 0 established (simulation, 150–300 runs per condition)

Against a simulated listener with a known 70.7% threshold, on a Weibull psychometric
function — see `staircase.test.ts` and `calibration.test.ts`:

| Protocol | Trials | Bias | Precision (±, p10–p90) |
| --- | --- | --- | --- |
| 1 track, 8 reversals | ~30 | +1–4% | **±28%** |
| 1 track, 12 reversals | ~42 | <2% | ±23% |
| 1 track, 20 reversals | ~66 | <2% | ±19% |
| **3 pooled tracks × 8 reversals** | ~90 | <5% | **<±20%**, tighter than 20 reversals |

Two things fall out of this, and both changed the design:

1. **The staircase is essentially unbiased and converges in ~30 trials** — about a minute.
   A practice drill can produce a usable reading inside a coffee break.
2. **A single track is only precise to ±28%, and lengthening it barely helps.** Precision
   improves as 1/√(tracks) but only weakly with track length, so Calibration Day runs
   **three short interleaved tracks and pools them geometrically** rather than one long
   one. Random track selection (not round-robin) also denies the listener the chance to
   predict which way the next trial moves.

This is exactly why the practice estimate and the calibrated reading are shown
differently: a ±28% practice number would swing by a third on an ear that did not change.
The pooled reading is tight enough that a real 20¢ → 12¢ gain reads as a gain — there is a
test asserting precisely that.

### Persistence (Dexie, `src/db/entities.ts`)

```ts
interface EarItemState  { userId; itemId; elo; attempts; lastSeenAt; halfLifeDays; lapses }
interface EarThreshold  { userId; facultyId; unit; value; ci; measuredAt; source: 'practice'|'calibration' }
interface CalibrationRun{ userId; runAt; readings: EarThreshold[]; ratings: Record<Faculty,number>; certificateId }
interface EarConfusion  { userId; expected; answered; count; lastAt }
```

### Reuse, not rebuild

- `ExerciseShell` / `use-base-exercise` — same chrome, count-in, stop button, mobile polish
  (and the `mobile-ui-check` audit keeps working).
- `AudioEngine` already does multi-instrument voices and chords (`_createVoice`, chord members)
  — no new synth needed for **Stack** / **Cadence**.
- `guitar-synth.ts`, `drum-machine.ts`, `chord-progression.ts` for the real-style playback.
- `practice-intelligence/` — `weakness-analyzer` and `drill-generator` extend naturally to ear
  items; the confusion matrix is a better input than what they have today.
- `EarTrainingPanel.tsx` (guitar) is the existing prototype of Faculty II answer-by-fretboard;
  fold it into the new engine rather than leaving a second implementation.

### The one hard correctness requirement

**Audio timing.** Threshold drills measure milliseconds and cents; they are worthless if
playback jitters. Everything must be scheduled on `AudioContext.currentTime` (never
`setTimeout`), and the app must measure and subtract **output latency**
(`AudioContext.outputLatency`) plus mic round-trip for tap-response timing. Feature proposal #5
(mic latency calibration wizard) becomes a **hard dependency** for Faculty V, not a nice-to-have.
Without it, "you resolve 14 ms" is a lie.

---

## 8. Phasing

| Phase | Ships | Why this order |
| --- | --- | --- |
| **0. Spike** (done) | `staircase.ts`, `elo.ts`, `calibration.ts`, `drills.ts`, `mercury-index.ts` + 74 tests, headless | The measurement core is the product. Prove it converges before any UI. **Done** — see the table above. |
| **1. Vertical slice** | **Home** (Faculty II) + **Hairline** (Faculty I), tap-only, Mercury Column, one Calibration | Proves both rulers, both interaction models, and the hero visual end to end. |
| **2. Answer modes** (built) | Play + Sing, ear-vs-voice split diagnostic | The differentiator of §4. **Built** — latency wizard + Home mic mode; hardware pass pending (`docs/ear-lab-testing.md`). |
| **3. Breadth** (built) | Faculties III, IV, V; Ear Report + confusion matrix | Enough content that spaced repetition has something to schedule. **Built** — The Grid, Leap, Stack, Contour + Ear Report; hardware pass pending. |
| **4. Habit** | Ear Path orbs, daily sprint, streak integration, Ascent Week 4 rebuilt on the engine | Retention. |
| **5. In The Wild** | Real-song items from UVR stems + key/chord detection | The moat. Deliberately last — it needs everything above to be worth playing. |
| **6. Producer pack** | **Colour**, **Weight**, mix-critique drills | New audience, mostly reuses the threshold engine. |

Phase 1 is the honest MVP: **you can measure your ear in cents, and prove the number moved.**

---

## 9. Open questions

Settled: naming (`Ear Lab` / `Mercury Index` / `Calibration`), placement (new top-level tab),
and build order (measurement core first). Still open:

1. **Item-bank calibration.** Ship with author-estimated difficulties and let Elo refine them
   from real play, or hand-calibrate a seed set first? The engine already freezes an item after
   200 attempts; the question is only what difficulty it starts at. (Recommendation:
   author-estimate, and log how far each item drifts before freezing as a sanity check on the
   authoring.)
2. **Does the Mercury Index replace or sit beside the existing score/leaderboard?**
3. **Offline/local-first.** Everything above works fully client-side in Dexie. Does calibration
   history need to sync to the D1 worker for cross-device continuity?
4. **The novice/expert anchors in `drills.ts` are authored estimates**, drawn from the
   published JND literature rather than from MercuryPitch users. They set where 0 and 1000 sit
   on the column, so they should be re-fitted against real percentiles once there is a cohort —
   until then the Mercury Index is correctly *ordered* but its absolute value is a guess.
5. **Timbre.** Every reading so far is on synthetic tones. Do thresholds measured on a sine
   transfer to the guitar and piano voices the drills will actually use? Worth a calibration
   run per timbre before claiming one number covers all instruments.

---

## 10. Status, decisions and handoff

Running log so nothing lives only in a conversation. Newest first.

### Decision log

| Date | Decision |
| --- | --- |
| 2026-08-09 | **Rebased onto `main` and squashed to one commit.** `main` had moved 516 commits since the branch point, so the 9 Phase 0-3 commits were squashed first and the rebase resolved once; all three conflicts were import-list unions (`TAB_EAR_LAB` against `main`'s `TAB_LAB`/`TAB_PITCH_ALGO`/`TAB_PITCH_TEST`). Verified lossless — every Ear Lab-owned file byte-identical to the pre-rebase backup. Full suite 6218 passed. Handoff written: [`ear-lab-handoff-2026-08-09.md`](ear-lab-handoff-2026-08-09.md). |
| 2026-08-09 | **Latency wizard over-reads by a constant** (hardware: 274 ms ± 1.2 where `main`'s `MicLatencyWizard` reads ~150 ms on the same audio path). Cause: the Ear Lab anchors its capture buffer with `AudioProcessingEvent.playbackTime`, which is an *output*-side reference scheduled ahead of `currentTime`; `main` correctly uses `currentTime - input.length / sampleRate`. At 4096 samples / 48 kHz the buffer alone is 85 ms, and with output latency that accounts for the ~124 ms gap. **Deferred, not urgent:** The Grid is perception-only, so no drill consumes the number yet. Fix is to delete the Ear Lab's wizard and consume `mic-latency-store` — one number app-wide — before any drill actually uses it. |
| 2026-08-09 | **PR opened: [#404](https://github.com/mercurypitch/mercurypitch/pull/404)** — Phases 0-3 as one reviewable unit (54 files, +8962/-3, purely additive). Held open pending the hardware pass on Phases 2-3 (`docs/ear-lab-testing.md` §1, §2, §2b-2d, §3b); Phase 4 continues on `feat/ear-lab` behind it rather than on a second branch, so the habit surfaces land against a merged engine. |
| 2026-07-31 | **Review pass + hardware bug fixes.** (1) **Stop now cancels the run, not just its timer** — the reported Grid bug: the end card showed, the clicks kept sounding, and the run re-armed its own question when the in-flight stimulus resolved. All three engines set the cancel flag *before* finishing, `scheduleClick` returns a cancel handle (a scheduled oscillator cannot be un-scheduled by clearing a `setTimeout`), and every engine registers its own `onCleanup`. Six regression tests in `src/tests/ear-threshold-run.test.ts`. (2) **`src/lib/ear/timing.ts`** now holds every drill's pacing — the one file to edit when a drill feels rushed; presentation only, never the measurement. (3) **Mercury Column**: the tube runs *into* the bulb and the bulb is painted last, so its rounded cap is no longer stroked as an oval across the silver ball. (4) Refactors: `ThresholdDrillView` extracted (Hairline + Grid), `grade()` reuses `scoreReading` so a grade and a column contribution cannot disagree, Home's answer-mode preference moved into the store, dashboard index memoized, mic released when switching back to tap, latency capture given a timeout so a dead mic cannot strand the wizard, and the test PRNG deduplicated into `test-rng.ts`. |
| 2026-07-31 | **Phase 3 built** (hardware pass pending): **The Grid** (first ms drill — six clicks, one off a 500 ms lattice, scheduled sample-accurately; perception-only so the device round trip cannot contaminate it), **Leap**, **Stack**, **Contour**, and the **Ear Report** (confusion heatmaps + ranked sentences with rates, threshold sparklines plotted inverted so rising means improving). Two engines extracted so drills stay thin: `use-threshold-run` (Hairline refitted onto it) and `use-identification-controller` + `IdentificationDrillView`. `mercuryIndex` now **averages** several drills sharing one faculty rather than letting the last one win — Shape is Leap and Contour together. Contour's bank items are gap *tiers*, not answers: direction is drawn fresh each trial, so climbing the rating narrows the gaps toward Hairline territory. |
| 2026-07-30 | **Phase 2 built** (pending hardware test — script in [`docs/ear-lab-testing.md`](../ear-lab-testing.md)): the mic-latency wizard (5 clicks scheduled on the AudioContext clock, mic capture on the same clock, MAD-pooled round trip stored in the ear store; ms drills stay locked until it exists) and Home's **Sing or play** answer mode (octave-folded degree classification with circular-distance scoring, one retry then skip on unclear takes, intonation cents on every answer). Mic answers rate under `home-sing` with **no guess floor** and **never update item difficulties** — items stay tap-calibrated yardsticks, and comparing the `home` vs `home-sing` ratings is the ear-vs-voice diagnostic. |
| 2026-07-30 | **First real-hardware test done** (mobile Safari over LAN). Feedback applied: Hairline trials tightened (tone 600→500ms, gap 260→220ms, reveal 550→420ms — the run's *length in trials* is the staircase converging and stays untouched); Home cadence slowed so the key can settle (chords 380→520ms, gap 90→130ms, probe 850→950ms); Mercury Column fixes from the screenshot — glass-sheen strip removed from empty glass (now a specular strip on the mercury fill only), the unmeasured-faculties dashed cap floats clearly above the tube instead of crossing its apex, the tube is centred in the viewBox, and the column caps at 138px on phones so it reads as a gauge, not the whole page. Calibration copy now explains interleaving in plain words. |
| 2026-07-30 | **Phase 1 slice built** (pending real-hardware test): Hairline + Home drills, Mercury Column, calibration flow, `ear-lab-store`, Home item bank, and the Ear Lab as a new top-level tab (`TAB_EAR_LAB`, practice group, all instrument scopes; lands in the More sheet on mobile). Ear Lab CSS is deliberately separate from `exercises.css` so it never trips the vocal-exercise mobile audit. No page tour yet — deferred so the PR doesn't trigger the full tour walk. |
| 2026-07-30 | Branch renamed `claude/ear-training-feature-plan-hvpzvj` → **`feat/ear-lab`**; old remote branch deleted. All Ear Lab work continues on `feat/ear-lab`. |
| 2026-07-29 | Phase 0 landed: `src/lib/ear/` measurement core, 74 tests, full suite green (3389 passed). Simulation findings in §7 reshaped Calibration Day into 3 pooled interleaved tracks. |
| 2026-07-29 | Naming locked: **Ear Lab / Mercury Index / Calibration**. Placement locked: **new top-level tab**. Build order locked: **measurement core headless first**. |
| 2026-07-29 | Progress is never reported as percent-correct. Ruler A = thresholds in physical units via 2-down-1-up staircase; Ruler B = Elo vs. frozen-difficulty items with a guess floor. Only Calibration marks the Mercury Column; practice estimates render lighter. |

### Phase 1 scope (the slice being built now)

Tap-only, no mic, so nothing in it depends on latency calibration:

- **Hairline** (Resolution) — 2AFC pitch discrimination: two tones, "which is higher?",
  staircase-driven gap, base frequency roved between trials so absolute-pitch memory can't
  substitute for discrimination. Practice mode = 1 track → practice reading; Calibration
  mode = 3 interleaved tracks → pooled reading that marks the column.
- **Home** (Function) — cadence plants the key, a probe note sounds, answer the scale
  degree (7 buttons). Elo with 1/7 guess floor; per-item difficulties start from authored
  seeds (tonic easiest → ♮7 hardest) and self-calibrate until frozen; confusions recorded
  from day one so the Ear Report (Phase 3) has data waiting.
- **Mercury Column** — the dashboard hero: calibrated fill, lighter practice meniscus,
  etched dated marks, per-faculty readouts. Dashed cap while faculties are unmeasured.
- **Persistence** — local-first via the existing persisted-signal store pattern
  (`src/stores/`), matching `exercise-history-store.ts`; Dexie/D1 sync stays an open
  question (§9.3) and is not blocking.
- **Deliberately deferred:** page tour (added later so this PR doesn't trigger the full
  two-viewport tour walk), sing/play answer modes (Phase 2), any ms-unit drill (blocked on
  the latency wizard), Dexie entities.

Ear Lab drills are *not* added to the vocal `ExerciseType` union — the Ear Lab owns its
own catalogue (`src/lib/ear/drills.ts`) and its own page, keeping the two progression
systems from tangling.

### What the user tests on real hardware (owner: Komediruzecki)

1. **Phase 1 smoke** — `pnpm dev`, open the Ear Lab tab: run a Hairline practice track
   (should land near your real discrimination threshold, ~1 min), run a Calibration
   (~3 min), watch the column mark. Run Home rounds; check the rating moves sensibly and
   wrong answers replay the correct resolution.
2. **Audio sanity** — tones audible and click-free on real speakers/headphones at short
   durations; no clipping when the cadence chords play.
3. **Phase 2 gate (when the wizard exists)** — mic-latency calibration on real
   microphone hardware; until that reads a stable round-trip number, no ms-based drill
   (The Grid, tap-response timing) ships. This is §7's hard correctness requirement.

---

## Sources

- [Musical U — How do you stay motivated with ear training?][mu-motivation]
- [Musical U — Why is ear training so hard?][mu-hard]
- [The Maestro — The piano app plateau][maestro]
- [StringKick — Why interval ear training isn't working][stringkick]
- [ToneSavvy — Functional (scale degree) ear training][tonesavvy]
- [Ear Training Apps Suck — eartrainingforguitar][etfg]
- [Levitt — Transformed up-down methods in psychoacoustics][levitt]
- [Purdue — Adaptive psychophysical methods (Tan & Pizlo)][purdue]
- [Law & Zentner — PROMS: Assessing Musical Abilities Objectively (PLOS ONE)][proms]
- [Pelánek — Applications of the Elo rating system in adaptive educational systems][pelanek]
- [Keeping Elo alive: measurement properties of Elo-based learning systems][elo-psy]
- [Settles & Meeder — A trainable spaced repetition model (Duolingo HLR)][hlr]
- [Gameplay as a source of intrinsic motivation in auditory training (RCT)][oro]

[mu-motivation]: https://www.musical-u.com/learn/how-do-you-stay-motivated-with-ear-training/
[mu-hard]: https://www.musical-u.com/learn/why-is-ear-training-so-hard/
[maestro]: https://www.the-maestro-online.com/blog/piano-app-plateau-holistic-coaching-vs-apps/
[stringkick]: https://www.stringkick.com/blog-lessons/interval-ear-training/
[tonesavvy]: https://tonesavvy.com/music-practice-exercise/220/functional-solfege-scale-degree-ear/
[etfg]: https://eartrainingforguitar.com/eartrainingapssuck
[levitt]: https://link.springer.com/content/pdf/10.3758/BF03205497.pdf
[purdue]: https://engineering.purdue.edu/~ece511/LectureNotes/pp12.pdf
[proms]: https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0052508
[pelanek]: https://www.sciencedirect.com/science/article/abs/pii/S036013151630080X
[elo-psy]: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12784335/
[hlr]: https://research.duolingo.com/papers/settles.acl16.pdf
[oro]: https://oro.open.ac.uk/41059
