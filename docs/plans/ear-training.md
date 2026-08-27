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
partly a _measurement artifact_. They probably did improve. The app just cannot show it.

**This is the gap the user identified, and it is the whole reason to build this.**

### 1.2 Interval-first training doesn't transfer

The classic drill — two notes, name the interval — strips away the key, so you never learn how
notes _function_. Real music is a stream of scale degrees over a tonal centre, and each degree
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
_itself_ drives intrinsic motivation to keep training ([Open Research Online][oro]) — so the
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

| Drill                 | Unit            | Typical untrained | Trained musician |
| --------------------- | --------------- | ----------------- | ---------------- |
| Pitch discrimination  | cents           | 30–50¢            | 3–10¢            |
| Beat/tuning detection | cents of detune | 25¢+              | <5¢              |
| Onset timing          | ms              | 40–60 ms          | 10–20 ms         |
| Tempo drift           | % BPM           | 6–8%              | 1–2%             |
| EQ band ID            | dB @ band       | 9–12 dB           | 2–3 dB           |
| Melodic memory        | notes held      | 3–4               | 8–9              |

These numbers **go down (or up, for span) forever** and are directly comparable across sessions,
devices and months, because a cent is a cent. This is the honest answer to "did I improve?"

### Ruler B — **Rating** (identification tasks, Elo against a calibrated bank)

Naming a chord quality has no continuous unit, so use the approach adaptive-learning research
converged on: an **Elo rating** over an item bank with fixed, pre-calibrated item difficulties
([Pelánek][pelanek], [Elo psychometrics][elo-psy]). Player rating rises; item difficulty is
frozen after calibration so the scale doesn't drift. K-factor decays with the number of
attempts (high early for fast convergence, low later for stability).

Result: "your Harmony rating is 1420, up from 1180" stays meaningful _even though the items you
now see are harder_ — which is precisely what percent-correct cannot do.

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
- Between calibrations the dashboard shows the _practice estimate_ in a visibly lighter
  treatment. Only calibration marks the column.

This is the difference between a bathroom scale and a lab test, and it's the thing that lets the
product say _"you improved"_ and mean it.

**Test-retest matters more than absolute accuracy here.** The PROMS battery achieves composite
test-retest r > .85 with per-subtest .56–.85 ([Law & Zentner][proms]); that is the bar to aim at,
and the reason the benchmark must be sealed and protocol-identical.

---

## 4. Ear vs. voice — the diagnostic nobody else can ship

Every item accepts **three answer modes**, and the user (or the app) picks:

1. **Tap** — buttons, piano keys, or fretboard. No mic. This is what opens the product to
   guitarists, pianists, producers and bassists. _Today every "ear" exercise in the app requires
   singing, which conflates two different skills and locks out most musicians._
2. **Play** — play it on your instrument; scored via the existing pitch detector / fretboard
   quiz path (`NoteLocatorQuiz`, `guitar/tuner.ts`, `OPEN_MIDI`).
3. **Sing** — the existing pitch pipeline.

When a user answers in more than one mode, the app can **separate perception error from
production error**:

> You tapped ♮6 correctly, then sang it 34¢ flat.
> **Your ear was right. Your voice missed.** → routes you to `pitch-hold`, not to more ear drills.

And the inverse: sang it dead-on but tapped the wrong degree → you can _match_ pitch but you
can't _name_ function. Different problem, different drill.

No competitor can do this because no competitor has the real-time pitch stack. It also makes
the existing vocal exercises better: `interval-trainer` today scores a sing-back and cannot tell
you _why_ you missed.

---

## 5. The exercises

Six faculties. Each has a metric, a unit, and a visual identity.

### Faculty I — **Resolution** (threshold drills, Ruler A)

| #   | Name          | Task                                                   | Unit       | Visual                                                                                         |
| --- | ------------- | ------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------- |
| 1   | **Hairline**  | Two tones — which is higher? Gap shrinks by staircase. | cents      | Two mercury beads converging until they merge; the last gap you can still see _is_ your number |
| 2   | **Beat Hunt** | Is this dyad in tune? Detune shrinks toward zero.      | cents      | Two waveforms sliding into phase; the beating envelope made visible                            |
| 3   | **The Grid**  | One hit is off the grid — which one?                   | ms         | Pulse lattice, one dot nudged, trails showing the offset                                       |
| 4   | **Drift**     | Did the tempo change?                                  | % BPM      | Metronome column that leans                                                                    |
| 5   | **Colour**    | Which octave band got boosted? _(producers/mixers)_    | dB         | Spectrum bands, the boosted one blooming                                                       |
| 6   | **Span**      | Echo back a melody that grows one note at a time.      | notes held | A chain of beads, each held note another link                                                  |

`Span` deserves a call-out: **melodic memory span in notes** is a beautifully legible metric.
"You hold 7 notes; in April you held 4." Nobody reports this and everybody understands it.

### Faculty II — **Function** (in-key, scale degrees — the spine, per §1.2)

| #   | Name         | Task                                                                      | Ruler |
| --- | ------------ | ------------------------------------------------------------------------- | ----- |
| 7   | **Home**     | A cadence plants the key, then a note sounds — name the degree.           | Elo   |
| 8   | **Gravity**  | Same, with chromatic degrees (♭3, ♯4, ♭7…).                               | Elo   |
| 9   | **The Pull** | Two degrees; which one _wants to move more_? Trains tendency, not labels. | Elo   |

**The signature visualisation:** degrees as bodies orbiting the tonic. Each carries a **pull
vector** toward its resolution — ♮7 strains at the tonic, ♮4 leans on ♮3, ♮5 sits dead still.
Answer correctly and the note snaps along its pull line and resolves, with the interval sounding.
This teaches the _feeling_ the literature says is the actual skill, instead of a label.

### Faculty III — **Shape** (melody & contour)

| #   | Name        | Task                                                                                          |
| --- | ----------- | --------------------------------------------------------------------------------------------- |
| 10  | **Echo**    | Melodic dictation — tap/play/sing it back. Adaptive length feeds `Span`.                      |
| 11  | **Contour** | Up / down / same, at speed. Fast, low-stakes, great for warm-up.                              |
| 12  | **Leap**    | Interval ID out of context. _Explicitly framed in-app as the supporting drill, not the goal._ |

### Faculty IV — **Colour** (harmony)

| #   | Name         | Task                                                                                                                                |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 13  | **Stack**    | Chord quality → inversion → extensions → voicing.                                                                                   |
| 14  | **Cadence**  | Progression and cadence ID in Roman numerals, played in a real style via the existing guitar synth + drum machine, not block sines. |
| 15  | **Bassline** | Root motion only. The single most practical harmonic skill for a working musician.                                                  |

### Faculty V — **Time**

| #   | Name          | Task                                                                       |
| --- | ------------- | -------------------------------------------------------------------------- |
| 16  | **Pulse**     | Rhythm dictation — tap it back. (Closes feature-proposal #14, still open.) |
| 17  | **Subdivide** | Meter and subdivision ID; find beat 1 in an odd metre.                     |

### Faculty VI — **In The Wild** — the transfer bridge

**This is the differentiator that closes §1.3, and it is only possible in this codebase.**

Point it at a real song — one the user already separated with UVR, or anything in the karaoke
library — and generate ear items _from the actual audio_:

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

Mercury is the brand _and_ the instrument: a thermometer is a calibrated column that rises.
The dashboard hero is a vertical quicksilver column — the **Mercury Index**, one number
(0–1000) that composites the six faculties.

- Rises **only on Calibration Day**, with a slow, weighty liquid-metal fill and a single
  audible "tick" per notch — earned, rare, satisfying.
- Between calibrations, a lighter mercury _meniscus_ floats above the marked line showing the
  live practice estimate. You can see where you're heading and where you've been _proved_.
- Historical marks etch permanently into the glass, dated. The column becomes a record.

Fits "Liquid Precision" exactly (BRAND.md §1, §5), reuses the droplet/ripple motif, and gives
Merc a job — the mascot lives inside the column and reacts.

### Secondary loop: **Resolution as focus**

The recurring animation metaphor across all threshold drills: **blurred → sharp.** A smeared,
doubled waveform that snaps into a single clean line as your resolution improves. Your session
opens with the spectrum at _your_ current blur level. It is instantly legible and it makes an
abstract number physical.

### The confusion matrix — "The Ear Report"

A heatmap of what you confuse _with what_: "you hear ♭7 as ♮6 41% of the time." Actionable,
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

| Protocol                          | Trials | Bias  | Precision (±, p10–p90)               |
| --------------------------------- | ------ | ----- | ------------------------------------ |
| 1 track, 8 reversals              | ~30    | +1–4% | **±28%**                             |
| 1 track, 12 reversals             | ~42    | <2%   | ±23%                                 |
| 1 track, 20 reversals             | ~66    | <2%   | ±19%                                 |
| **3 pooled tracks × 8 reversals** | ~90    | <5%   | **<±20%**, tighter than 20 reversals |

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
interface EarItemState {
  userId
  itemId
  elo
  attempts
  lastSeenAt
  halfLifeDays
  lapses
}
interface EarThreshold {
  userId
  facultyId
  unit
  value
  ci
  measuredAt
  source: 'practice' | 'calibration'
}
interface CalibrationRun {
  userId
  runAt
  readings: EarThreshold[]
  ratings: Record<Faculty, number>
  certificateId
}
interface EarConfusion {
  userId
  expected
  answered
  count
  lastAt
}
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

| Phase                       | Ships                                                                                            | Why this order                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0. Spike** (done)         | `staircase.ts`, `elo.ts`, `calibration.ts`, `drills.ts`, `mercury-index.ts` + 74 tests, headless | The measurement core is the product. Prove it converges before any UI. **Done** — see the table above.                                           |
| **1. Vertical slice**       | **Home** (Faculty II) + **Hairline** (Faculty I), tap-only, Mercury Column, one Calibration      | Proves both rulers, both interaction models, and the hero visual end to end.                                                                     |
| **2. Answer modes** (built) | Play + Sing, ear-vs-voice split diagnostic                                                       | The differentiator of §4. **Built** — latency wizard + Home mic mode; hardware pass pending (`docs/ear-lab-testing.md`).                         |
| **3. Breadth** (built)      | Faculties III, IV, V; Ear Report + confusion matrix                                              | Enough content that spaced repetition has something to schedule. **Built** — The Grid, Leap, Stack, Contour + Ear Report; hardware pass pending. |
| **4. Habit**                | Ear Path orbs, daily sprint, streak integration, Ascent Week 4 rebuilt on the engine             | Retention.                                                                                                                                       |
| **5. In The Wild**          | Real-song items from UVR stems + key/chord detection                                             | The moat. Deliberately last — it needs everything above to be worth playing.                                                                     |
| **6. Producer pack**        | **Colour**, **Weight**, mix-critique drills                                                      | New audience, mostly reuses the threshold engine.                                                                                                |

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
   until then the Mercury Index is correctly _ordered_ but its absolute value is a guess.
5. **Timbre.** Every reading so far is on synthetic tones. Do thresholds measured on a sine
   transfer to the guitar and piano voices the drills will actually use? Worth a calibration
   run per timbre before claiming one number covers all instruments.

---

## 10. Status, decisions and handoff

Running log so nothing lives only in a conversation. Newest first.

### Decision log

| Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-27 | **Polish plan written — the room, the instruments, the phone.** The engine is right and the surface is generic app chrome, so the next body of work is visual: the Ear Lab joins the Night Rooms family (photographed room, console bridge, one signature object, serif coaching + sans controls + tabular readings, no cards / glass / glow), gets a reusable instrument stage the coming rhythm drills can stand on, and becomes native-shell ready (safe areas, `dvh`, 44px targets, silent entry). Direction assigned by the impeccable roll (seed `e231a43e`): **The Regulator Room** — a chronometer workshop whose regulators carry mercury-compensated pendulums, which is what the Mercury Column has been all along. Six phases, art last: direction + mock → the bench (dashboard) → the instruments (stages) → calibration / report / one latency number (closes the wizard bug) → doors + native readiness → a six-room background pack generated per the dotfiles procedure. Full plan, references (Mobbin, the jammer mocks) and the founder's five decisions: `~/.dotfiles/personal/mercurypitch/plans/ear-lab-polish-plan.md`; summary in §11.                                                                                                                                                                                                                                                                                                                    |
| 2026-08-27 | **Rebased onto `main` `8fd7f84f` (495 commits of drift, 5 commits replayed, no squash needed).** Conflicts: the same import-list unions as before in `App.tsx`, `AppNavTabs.tsx`, `hash-router.ts`, plus `main`'s regrouped tab bar — `TAB_GROUPS` is now You / Practice / Play / Studio with three inline tabs per group and an overflow, so the Ear Lab joined the **Practice** group after Exercises (its `MAX_INLINE_GROUP_TABS` comment had already reserved the seat). Two registrations `main` added since the branch point: `SIDEBAR_LAYOUT` (`sidebar-registry.ts`, a full `Record<ActiveTab>`) gets `['mic', 'activity']`, and the sidebar matrix doc gets a row. `docs/agent/INDEX.md` regenerated. Verified lossless against tag `ear-lab-pre-rebase-2026-08-27`; suite 866 files / 10598 passed; pushed with `--force-with-lease`. PR #404 is mergeable again.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-08-27 | **Polish Phase 1 — the bench is the Regulator Room.** The mock in `~/.dotfiles/personal/mercurypitch/ear-jammer/` was approved ("for a mock and initial looks great, approved") and ported on the same branch. `BackgroundSurface` gains `'ear'` (catalogue, default, selection key, global controller, admin filter, picker copy, D1 migration `0034` widening the surface CHECK) with one free room, `ear-regulator-room`, shipped from `public/ear-lab/` as a ~1K stand-in pair until Phase 6. The dashboard is rebuilt as `EarRoomShell` (room plate + grade + vignette driven by a room-glass slider, `ear-glass.ts`; session bar with the readiness chip, the "why no percent" plate and the room chip; console bridge with the one amber Run Calibration; a rack drawer for instruments, room, readiness and the rulers) around `EarLabDashboard` (the Regulator replaces `MercuryColumn`; `IndexDials` for the index and the six faculties; `SprintCard` restyled as the regulation plate with a brass day seal; `instruments.ts` feeds the strip and the rack). Every `data-tour="ear.*"` hook and `#ear-lab-panel` survive; tour placements retargeted. `EarLabDashboard.test.tsx` and `scripts/audit-ear-lab-mobile.mjs` (`pnpm audit:ear-lab`) guard the hooks, the phone bridge and the strip. Founder notes folded in: the rulers note is an info plate, not a front-page card; the room dim slider ships with the surface. Drill views are unchanged until Phase 2. |
| 2026-08-27 | Polish Phase 2 — every drill runs on `EarStage` inside the room: drill bar, one SVG instrument per drill (vernier loupe, tuning fork, escapement lattice, index arc, gear train, stylus trace, track pendulums), the answer console where the bridge was, the plate for the reading. Engines and `timing.ts` untouched; `use-threshold-run` only gained per-track accessors. The room moved up to `EarLabPage`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | The mock's stages, ported; the instrument never shows the answer before the reveal, and a reveal is colour + mark + words + sound.                                        |
| 2026-08-27 | Polish Phase 3 — one latency number: the Ear Lab's own wizard (`LatencyWizard`, `lib/ear/latency`) is deleted and the readiness chip reads `mic-latency-store`; the rack hosts main's `MicLatencyWizard`. Calibration opens as a sealed-protocol ritual with a fourteen-day due date (`calibrationDueAt`). The Ear Report runs on a stage inside the room: range control, Mercury Index and threshold traces (`ReadingTrace`, inverted with honest axis labels), confusion matrices with the diagonal in signal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Handoff §3's fix, the mock's calibration and report stages. One number for the whole app; the seal is a ritual; charts hand-built because no `dataviz` skill exists here. |
| 2026-08-27 | Polish retest fixes (the founder's hardware pass on Phases 2-3): a stage volume and three click voices in the room panel (`ear-sound.ts`, `click-synth.ts` voices, `audioEngine.setToneTrim`), Home's cadence chords voiced as chords with the lamps in step (`playTone` resolves on scheduling, so the controller waits each chord out), Contour's trace kept through the answer, Stack's wheels meshing side by side, Today as a rack panel instead of a scroll. The audit script now checks the trace, the wheel geometry, the Sound section and the Today slots.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Retest findings 1-5. The piercing click was the latency wizard's 2 kHz design copied into the Grid at full level, straight to the destination past the volume slider.     |
| 2026-08-27 | Polish Phase 4 — doors and native readiness: an Ear Lab card on Home (`visual: 'earLab'`, the free room master under brass lamplight), the page tour rewritten in the bench's words, the Ascent's ear chips in brass, `unlockAudio` inside every play pad's tap and the click preview, the `@smoke` e2e (`src/e2e/ear-lab.spec.ts`), and a share-card script (`generate-ear-lab-og.mjs`) with no PNG shipped. The tab icon stays the thermometer: it already is the Mercury Column.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Plan §Phase 4. A1-A4 were already true of the surface except the unlock chain; a card without a page to serve it would be dead weight in `public/`.                       |
| 2026-08-27 | Polish Phase 5 — the rhythm seam: `lib/ear/tap-input.ts` (a tap ledger measuring from the first beat's scheduled instant with the round trip subtracted; nearest-beat deviations; a take summary), `TapPad` on the stage (pointer down + Space/Enter, stamped by the event), one `VIEW_FOR_DRILL` for every door with a test holding the sprint list to it, and a **Tap check** in the readiness panel so the subtraction can be judged on hardware. Pulse and Echo are specified in `docs/plans/ear-rhythm-drills.md` and stay off every door until built.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Plan §Phase 5 (thin, may slip). The round trip stands in for output + touch latency; the residual is shown rather than hidden.                                            |
| 2026-08-27 | Polish Phase 6 — the rooms: six plates of the Regulator Room's world generated through the dotfiles background pipeline (Antigravity brief mode from `ear-jammer/BACKDROPS.md`, Real-ESRGAN x4 then Lanczos to the master size; every master 1.66-2.09 against the 1.30 detail gate). Free: Regulator Room (master replaces the stand-in) and Glasshouse Bench in `public/ear-lab/`; supporter: Transit Observatory, Bell Loft, Planetarium, Anechoic Booth as catalogue entries (`EAR_ROOMS_BACKGROUND_IDS`, edition `ear-rooms`), the worker map, the picker wash and seed migration `0035`. Packs `v6` and `free-ear-v6` in dotfiles; the dev sync dry-run reaches Studio and waits on `0035` being applied there.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Plan §Phase 6. The judgement round is the founder's; the supporter publish is a separate step after the dev deploy.                                                       |
| 2026-08-27 | Light rooms ink the bench: the founder's look at the Glasshouse Bench found the parchment text on the room invisible. Ink tokens (`--ear-ink`, `--ear-ink-muted`, `--ear-ink-brass`, `--ear-ink-halo`) carry everything written straight on the room and invert under `[data-room-treatment='light']`; plates keep parchment. The audit measures the bench title's luminance in the light room.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | One token set rather than per-rule overrides, so the next light room gets it for free.                                                                                    |
| 2026-08-09 | **Phase 4 complete: The Ascent's ear week now points into the Ear Lab.** Week 4 ("Tuning & Ear") gains `earDrills: ['hairline','home','leap']` — a **new optional field on `PathWeek`, deliberately separate from `exercises`**, because that array is typed `ExerciseType[]` and Ear Lab drills are kept out of that union so the two progression systems cannot tangle. The week card renders them as their own quicksilver chips, and `startEarDrill(id)` in `ui-store` mirrors the existing `startExercise` pattern: set a pending signal, switch tab, and let `EarLabPage` consume and clear it — so returning to the tab later lands on the dashboard rather than replaying the request. `src/tests/path-ear-drills.test.ts` guards the link, since referencing a drill by id means only a test stops a typo from shipping as a chip that navigates nowhere.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-08-09 | **Phase 4 part 1: the Daily Sprint and the page tour.** The sprint is `src/lib/ear/sprint.ts` — pure, no dates or randomness inside: two slots go to the neediest drills (unmeasured first, then weakest sub-score) and the third **rotates on the day index**, so one stubborn weak faculty cannot monopolise the sprint forever while the rest of the ear decays. Every segment carries the reason it was picked and the card renders it — the scheduler is shown, not hidden, which is the same auditability the Index is built on. A provisional Elo rating counts as _unmeasured_ rather than as a low score, so the sprint sends you back to settle it. Segments are booked by **finishing the drill anywhere in the Lab** (the three engines call `markSprintSegmentDone` where they already call `creditEarSession`), so the sprint names what to practise without owning the only door into it. `completeSprint` deliberately credits **nothing** — each segment already credited its own run, and crediting again would count a sprint twice. Eight-step page tour added (`PAGE_TOURS[TAB_EAR_LAB]`), covering column, index, faculties, sprint, calibration, drills, latency and the no-percent rationale.                                                                                                                                                                                                                                                              |
| 2026-08-09 | **Rebased onto `main` and squashed to one commit.** `main` had moved 516 commits since the branch point, so the 9 Phase 0-3 commits were squashed first and the rebase resolved once; all three conflicts were import-list unions (`TAB_EAR_LAB` against `main`'s `TAB_LAB`/`TAB_PITCH_ALGO`/`TAB_PITCH_TEST`). Verified lossless — every Ear Lab-owned file byte-identical to the pre-rebase backup. Full suite 6218 passed. Handoff written: [`ear-lab-handoff-2026-08-09.md`](ear-lab-handoff-2026-08-09.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-08-09 | **Latency wizard over-reads by a constant** (hardware: 274 ms ± 1.2 where `main`'s `MicLatencyWizard` reads ~150 ms on the same audio path). Cause: the Ear Lab anchors its capture buffer with `AudioProcessingEvent.playbackTime`, which is an _output_-side reference scheduled ahead of `currentTime`; `main` correctly uses `currentTime - input.length / sampleRate`. At 4096 samples / 48 kHz the buffer alone is 85 ms, and with output latency that accounts for the ~124 ms gap. **Deferred, not urgent:** The Grid is perception-only, so no drill consumes the number yet. Fix is to delete the Ear Lab's wizard and consume `mic-latency-store` — one number app-wide — before any drill actually uses it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-08-09 | **PR opened: [#404](https://github.com/mercurypitch/mercurypitch/pull/404)** — Phases 0-3 as one reviewable unit (54 files, +8962/-3, purely additive). Held open pending the hardware pass on Phases 2-3 (`docs/ear-lab-testing.md` §1, §2, §2b-2d, §3b); Phase 4 continues on `feat/ear-lab` behind it rather than on a second branch, so the habit surfaces land against a merged engine.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-07-31 | **Review pass + hardware bug fixes.** (1) **Stop now cancels the run, not just its timer** — the reported Grid bug: the end card showed, the clicks kept sounding, and the run re-armed its own question when the in-flight stimulus resolved. All three engines set the cancel flag _before_ finishing, `scheduleClick` returns a cancel handle (a scheduled oscillator cannot be un-scheduled by clearing a `setTimeout`), and every engine registers its own `onCleanup`. Six regression tests in `src/tests/ear-threshold-run.test.ts`. (2) **`src/lib/ear/timing.ts`** now holds every drill's pacing — the one file to edit when a drill feels rushed; presentation only, never the measurement. (3) **Mercury Column**: the tube runs _into_ the bulb and the bulb is painted last, so its rounded cap is no longer stroked as an oval across the silver ball. (4) Refactors: `ThresholdDrillView` extracted (Hairline + Grid), `grade()` reuses `scoreReading` so a grade and a column contribution cannot disagree, Home's answer-mode preference moved into the store, dashboard index memoized, mic released when switching back to tap, latency capture given a timeout so a dead mic cannot strand the wizard, and the test PRNG deduplicated into `test-rng.ts`.                                                                                                                                                                                                     |
| 2026-07-31 | **Phase 3 built** (hardware pass pending): **The Grid** (first ms drill — six clicks, one off a 500 ms lattice, scheduled sample-accurately; perception-only so the device round trip cannot contaminate it), **Leap**, **Stack**, **Contour**, and the **Ear Report** (confusion heatmaps + ranked sentences with rates, threshold sparklines plotted inverted so rising means improving). Two engines extracted so drills stay thin: `use-threshold-run` (Hairline refitted onto it) and `use-identification-controller` + `IdentificationDrillView`. `mercuryIndex` now **averages** several drills sharing one faculty rather than letting the last one win — Shape is Leap and Contour together. Contour's bank items are gap _tiers_, not answers: direction is drawn fresh each trial, so climbing the rating narrows the gaps toward Hairline territory.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-07-30 | **Phase 2 built** (pending hardware test — script in [`docs/ear-lab-testing.md`](../ear-lab-testing.md)): the mic-latency wizard (5 clicks scheduled on the AudioContext clock, mic capture on the same clock, MAD-pooled round trip stored in the ear store; ms drills stay locked until it exists) and Home's **Sing or play** answer mode (octave-folded degree classification with circular-distance scoring, one retry then skip on unclear takes, intonation cents on every answer). Mic answers rate under `home-sing` with **no guess floor** and **never update item difficulties** — items stay tap-calibrated yardsticks, and comparing the `home` vs `home-sing` ratings is the ear-vs-voice diagnostic.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-07-30 | **First real-hardware test done** (mobile Safari over LAN). Feedback applied: Hairline trials tightened (tone 600→500ms, gap 260→220ms, reveal 550→420ms — the run's _length in trials_ is the staircase converging and stays untouched); Home cadence slowed so the key can settle (chords 380→520ms, gap 90→130ms, probe 850→950ms); Mercury Column fixes from the screenshot — glass-sheen strip removed from empty glass (now a specular strip on the mercury fill only), the unmeasured-faculties dashed cap floats clearly above the tube instead of crossing its apex, the tube is centred in the viewBox, and the column caps at 138px on phones so it reads as a gauge, not the whole page. Calibration copy now explains interleaving in plain words.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-07-30 | **Phase 1 slice built** (pending real-hardware test): Hairline + Home drills, Mercury Column, calibration flow, `ear-lab-store`, Home item bank, and the Ear Lab as a new top-level tab (`TAB_EAR_LAB`, practice group, all instrument scopes; lands in the More sheet on mobile). Ear Lab CSS is deliberately separate from `exercises.css` so it never trips the vocal-exercise mobile audit. No page tour yet — deferred so the PR doesn't trigger the full tour walk.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-07-30 | Branch renamed `claude/ear-training-feature-plan-hvpzvj` → **`feat/ear-lab`**; old remote branch deleted. All Ear Lab work continues on `feat/ear-lab`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-07-29 | Phase 0 landed: `src/lib/ear/` measurement core, 74 tests, full suite green (3389 passed). Simulation findings in §7 reshaped Calibration Day into 3 pooled interleaved tracks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-07-29 | Naming locked: **Ear Lab / Mercury Index / Calibration**. Placement locked: **new top-level tab**. Build order locked: **measurement core headless first**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-07-29 | Progress is never reported as percent-correct. Ruler A = thresholds in physical units via 2-down-1-up staircase; Ruler B = Elo vs. frozen-difficulty items with a guess floor. Only Calibration marks the Mercury Column; practice estimates render lighter.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

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

Ear Lab drills are _not_ added to the vocal `ExerciseType` union — the Ear Lab owns its
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

## 11. The polish plan (2026-08-27) — summary

The full plan lives in the dotfiles
(`~/.dotfiles/personal/mercurypitch/plans/ear-lab-polish-plan.md`) beside the
jammer mocks it borrows from; this is the map so an agent working in the repo
knows the shape without leaving it.

**Why.** Measurement done; surface generic. The Ear Lab must look like the
product's other rooms, work on a phone as well as on a desktop, read as an
instrument rather than a quiz, and leave a stage for rhythm drills.

**Direction.** _The Regulator Room_: a chronometer maker's workshop; the
Mercury Column is the mercury-compensated pendulum jar of a regulator clock;
faculties are its sub-dials; each drill is a bench instrument (Hairline a
vernier under a loupe, Home a tuning fork and the tonal ladder, The Grid an
escapement lattice with a chase light, Leap a dividing-engine arc, Stack a
gear train, Contour a stylus trace, Calibration three pendulums brought into
phase). Palette: oiled steel, slate, brass, mercury, one copper-green signal,
garnet for faults, parchment type. System old-style serif for coaching, Inter
for controls, tabular numerals for readings.

| Phase | Lands                                                                                                                                          | Gate                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 0     | Direction contract, three comps, static mock in `~/.dotfiles/personal/mercurypitch/ear-jammer/`, surface brief, `docs/plans/ear-lab-design.md` | founder approves direction and comp          |
| 1     | The bench: `'ear'` background surface, the Regulator hero, sub-dials, sprint as regulation card, instrument row, phone stage layout            | tour selectors, store tests, mobile audit    |
| 2     | `EarStage` shell + the seven instruments, 44px pads, audible reveal, engraved end card                                                         | stop-behaviour tests stay green              |
| 3     | Calibration ritual, Ear Report charts, **delete the Ear Lab latency wizard and consume `mic-latency-store`**                                   | closes handoff §3 before any ms drill        |
| 4     | Home destination card, tab icon, tour copy, Ascent chips, capacitor-readiness A1-A4, `@smoke` e2e                                              | e2e green with `VITE_E2E_PORT`               |
| 5     | Tap input on the stage; Pulse and Echo specs (built in the follow-up)                                                                          | nothing in `SPRINT_DRILL_IDS` without a view |
| 6     | Six rooms (two free, four supporter) generated, QA'd (detail ratio ≥ 1.30), cut, catalogued, seeded, published to dev                          | founder judges the pack                      |

**Invariants the polish must not touch** (handoff §4): no percent on screen;
only Calibration marks the column; mic answers never update item
difficulties; difficulties freeze at 200 attempts; pacing lives in
`timing.ts`; Stop cancels the run; Ear Lab drills stay out of `ExerciseType`.

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
