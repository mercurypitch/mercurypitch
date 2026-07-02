# Voice Mirror — Phase 2+ Plan: What Else Can We Measure?

Status: Phase 2 implemented on `feat/voice-mirror` (this branch). Phases 3–4
are designs awaiting a go.

## 1. How the v1 metrics were chosen

The v1 spec picked **range / accuracy / steadiness** deliberately, not
exhaustively, from three product principles:

- **Range is the hero because it is non-judgmental.** Nobody feels bad about
  "E2–G4". Accuracy and steadiness are sub-stats; there is intentionally no
  composite "62/100 voice" score, which would discourage exactly the
  beginners the funnel targets.
- **Each metric had to be measurable from a guided micro-task in under a
  minute** (glide → range, hold → steadiness, match → accuracy), with a
  pitch detector we already ship (YIN/MPM) and no ML weights in the bundle.
- **Each metric had to survive a phone mic.** Pitch-based metrics are robust
  to cheap microphones; timbre metrics are much less so (see §4).

So v1 is not "the best things to measure" — it is the best *first* things.
This document is about what comes next.

## 2. Research: what the field measures

### Competitor landscape (consumer tools)

Existing vocal-range testers ([ToneGym](https://www.tonegym.co/tool/item?id=vocal-range-test-tool),
[Singing Carrots](https://singingcarrots.com/range-test),
[vocalrangetester.com](https://vocalrangetester.com/) and a dozen clones)
converge on: lowest/highest note, octave span, voice-type label, and — the
single most shared feature — **"singers with a similar range to you"**
(Singing Carrots' famous-singer match). AI raters
([Rate My Voice](https://screenapp.io/features/voice-test-online) and
similar) score recordings on pitch accuracy (±cents), tonal consistency
(vibrato stability), rhythm against a beat, **breath control (phrase
length)** and **dynamic range**. None of them do the guided
glide/hold/match task structure we have, and none keep audio on-device —
both are our differentiators.

### Voice science (clinical / research acoustics)

The standard objective voice-quality metrics are **jitter** (cycle-to-cycle
F0 perturbation, normal < ~0.5 %), **shimmer** (amplitude perturbation,
normal < ~3–5 %), **HNR** (harmonics-to-noise ratio; low = breathy/hoarse)
and composites like CPP/AVQI
([Phonalyze overview](https://blog.phonalyze.com/voice-quality-metrics-and-their-clinical-interpretation/),
[Teixeira et al.](https://www.sciencedirect.com/science/article/pii/S2212017313002788/pdf?md5=4d530a7f820136a8528868643590b45d&pid=1-s2.0-S2212017313002788-main.pdf)).
Singing-specific literature adds **vibrato rate** (typically ~4.5–7 Hz) and
**extent**, onset behaviour, and source-spectrum tilt
([warm-up study](https://www.sciencedirect.com/science/article/abs/pii/S0892199723000747)).
Notably, a 2024 study found **perceptual, not acoustic, features predict
singing-voice preference** ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11026466/))
— a warning against over-promising from raw acoustics.

**Deliberate exclusion:** jitter/shimmer/HNR-as-numbers read as *health
diagnostics*. They need a sustained /a/, a close calibrated mic, and clinical
framing; presenting them in a fun share card invites misinterpretation
("your voice is 2.1 % damaged"). We use HNR-adjacent signals only as
*soft, positively-framed* proxies (e.g. "clarity"), never as clinical values.

### What the repo already has (the underused goldmine)

`src/lib/vocal-analyzer.ts` (pure, import-free — safe for the mirror bundle):

| Existing function | Measures | Mirror use |
|---|---|---|
| `detectVibrato` (FFT, 3–10 Hz band) | rate Hz, depth cents, classification | **Phase 2 (done)** |
| `computeHNR`, `approximateBreathiness` | clarity / breathiness proxy | Phase 3, framed as "tone clarity" |
| `computeHarmonicRichness` | overtone content | Phase 3 candidate (mic-sensitive) |
| `detectSlides` | slide events, smoothness | Phase 3 agility |
| `computeRMSEnvelope`, `compareIntensity` | dynamics | Phase 3 dynamic range |
| fatigue checkpoints | drift over session | Phase 4 |

Plus `src/lib/key-detection/` (home-key estimation) and
`src/lib/onset-detector.ts` — both directly reusable for Free Sing.

## 3. The "just sing for 40 seconds" idea (Free Sing mode) — Phase 3

Yes — this is worth building, as a **second mode next to the guided test**,
not a replacement. The guided tasks exist because each metric needs a
controlled stimulus (you can't measure match-accuracy without a target).
But a free sing measures things the guided flow *can't*, and it is a far
lower-anxiety entry point ("sing anything — your shower song counts").

Architecture is already in place: the F0 stream is mode-agnostic, all
analysis is post-processing over retained `F0Frame[]` (+ per-frame RMS
scalars) — **never audio** — and the pure-metrics + synthetic-track-test
pattern extends directly.

Metrics for a 40-second free sing (all pure functions over frames):

1. **Range-in-use + tessitura** — dwell histogram per semitone; the range
   you actually sing vs. the extremes ("you live around A3, spanning C3–E4").
2. **Home note / key estimate** — reuse `key-detection` over the dwell
   histogram ("you gravitate to F major-ish").
3. **Phrase length & breath** — voiced-run durations between gaps: median
   phrase seconds, longest phrase ("~6.5 s phrases — solid breath support").
4. **Melodic agility** — interval-change rate and slide smoothness
   (`detectSlides`): "mover" vs "sustainer" singing style.
5. **Vibrato** — same detector as Phase 2, now on found sustained notes.
6. **Dynamics** — RMS envelope range (relative only; AGC is off so it's
   honest): "you sing in one dynamic" vs "you shape phrases".
7. **Melody map share card** — the actual 40 s pitch trace as a
   constellation (reuse card renderer), with the home note as the
   brightest star. This is the shareable payoff; a free sing trace is
   *personal* in a way a siren glide isn't.

Sequencing: reuse session reducer with a new `free-sing` phase; entry
chooser on the landing ("Guided test · 60 s" / "Just sing · 40 s"); results
screen reuses the stat components. Estimated at roughly the size of Phase 2,
because every hard part (stream, session, card, baseline, funnel) is built.

## 4. Phase roadmap

- **Phase 2 — deepen the guided test (implemented on this branch)**
  - Vibrato as a *feature*: FFT detector on the hold take; reported as
    "vibrato: 5.6 Hz, ±38 c" and **excluded from wobble** (variance
    subtraction), so vibrato no longer reads as unsteadiness.
  - Onset/scoop from match takes: ms from voicing onset to the first
    100 ms sustained within ±50 c ("you scoop ~180 ms into notes").
  - Results copy for both; funnel metrics unchanged.
- **"Sing the Universe" (spec v2) — implemented on this branch.** Three
  melodies from real data (`cosmic-melodies.ts`): Orion by Gaia/Hipparcos
  declinations, five pulsars by ATNF spin rates octave-folded, and the
  Perseus black-hole B♭ (pinned to B♭ by pitch class). Fitted into the
  singer's detected range, scored by the same octave-folded engine,
  entered from the results screen.
- **Free Sing mode (§3) — implemented on this branch** ("Just sing · 40 s"
  on the landing): range-in-use, home note + tessitura, phrase/breath
  stats, mover-vs-sustainer agility, vibrato on the longest note, and a
  free-sing share card. Deferred from §3 for later: home-key estimate
  (key-detection reuse), dynamics.
- **Later — shareability & content**
  - Famous-singer range match (pure data table; the most-shared feature in
    every competitor).
  - Croatian localization (spec v1.1, deferred).
  - More cosmic melodies as the weekly content format.
- **Not planned:** clinical jitter/shimmer numbers, composite voice score,
  server-side audio anything.

## 5. Sources

- [ToneGym vocal range test](https://www.tonegym.co/tool/item?id=vocal-range-test-tool)
- [Singing Carrots range test](https://singingcarrots.com/range-test)
- [Vocal Range Tester](https://vocalrangetester.com/)
- [Rate My Voice — AI singing test](https://screenapp.io/features/voice-test-online)
- [Phonalyze: objective voice quality metrics (CPP, jitter, shimmer, HNR)](https://blog.phonalyze.com/voice-quality-metrics-and-their-clinical-interpretation/)
- [Teixeira et al., Vocal Acoustic Analysis — Jitter, Shimmer and HNR](https://www.sciencedirect.com/science/article/pii/S2212017313002788/pdf?md5=4d530a7f820136a8528868643590b45d&pid=1-s2.0-S2212017313002788-main.pdf)
- [Acoustic analysis of warm-up influence on singing voice](https://www.sciencedirect.com/science/article/abs/pii/S0892199723000747)
- [Perceptual (but not acoustic) features predict singing voice preferences](https://pmc.ncbi.nlm.nih.gov/articles/PMC11026466/)
