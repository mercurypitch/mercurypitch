# The Ear Lab — ear training that proves you improved

> Status: **proposal / plan**. Nothing implemented yet.
> Owner: TBD · Target: a new top-level surface alongside Exercises and The Ascent.

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

### New modules

```
src/features/ear-lab/
  ear-lab-store.ts            # session state, current item, answer mode
  staircase.ts                # 2-down-1-up transformed up-down + reversal averaging
  elo.ts                      # rating update, decaying K, uncertainty tracking
  item-bank.ts                # calibrated practice items (difficulty frozen post-calibration)
  benchmark-bank.ts           # SEALED — never served in practice
  scheduler.ts                # half-life regression / next-review selection
  confusion.ts                # confusion matrix accumulation + decay
  faculties.ts                # the six faculties, their units, drills, display config
  answer-modes/               # tap | play | sing → normalised Answer
  drills/<one dir per drill>  # mirrors features/exercises/<drill>/ convention
  components/                 # MercuryColumn, EarReport, ConfusionHeatmap, PullOrbit
```

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
| **0. Spike** | `staircase.ts` + `elo.ts` + unit tests, headless | The measurement core is the product. Prove it converges before any UI. |
| **1. Vertical slice** | **Home** (Faculty II) + **Hairline** (Faculty I), tap-only, Mercury Column, one Calibration | Proves both rulers, both interaction models, and the hero visual end to end. |
| **2. Answer modes** | Play + Sing, ear-vs-voice split diagnostic | The differentiator of §4. |
| **3. Breadth** | Faculties III, IV, V; Ear Report + confusion matrix | Enough content that spaced repetition has something to schedule. |
| **4. Habit** | Ear Path orbs, daily sprint, streak integration, Ascent Week 4 rebuilt on the engine | Retention. |
| **5. In The Wild** | Real-song items from UVR stems + key/chord detection | The moat. Deliberately last — it needs everything above to be worth playing. |
| **6. Producer pack** | **Colour**, **Weight**, mix-critique drills | New audience, mostly reuses the threshold engine. |

Phase 1 is the honest MVP: **you can measure your ear in cents, and prove the number moved.**

---

## 9. Open questions

1. **Naming.** `Ear Lab` / `Mercury Index` / `Calibration` is the recommendation — instrument-
   grade, on-brand, not childish. Alternatives: "The Resolve", "Signal", "Perfect Column".
2. **Where does it live?** New top-level tab, or a mode inside Exercises? (Recommendation: new
   tab — it has its own path, dashboard and progression, and burying it undersells it.)
3. **Item-bank calibration.** Ship with author-estimated difficulties and let Elo refine them
   from real play, or hand-calibrate a seed set first? (Recommendation: author-estimate + freeze
   after N=200 attempts per item.)
4. **Does the Mercury Index replace or sit beside the existing score/leaderboard?**
5. **Offline/local-first.** Everything above works fully client-side in Dexie. Does calibration
   history need to sync to the D1 worker for cross-device continuity?

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
