# Guided Voice Check — EARS Requirements

Requirements for the local-first assessment loop that will live inside Hear
Yourself. This specification defines the safety, evidence, quality,
recommendation, and comparison boundaries before any user-facing guided flow
ships.

> Version: 1.0 | Date: 2026-08-11 | Working names: Guided Check, Focus Take,
> Focus reading, Starting Point

**Product source:**
`<user-dotfiles>/mercurypitch/plans/guided-voice-check-plan.md`
**Implementation sources:** `src/lib/guided-voice/`,
`src/features/voice-history/GuidedVoiceCheck.tsx`,
`src/features/voice-history/guided-voice-take.ts`, and
`src/features/voice-history/guided-practice-handoff.ts`
**Tests:** colocated guided-voice tests,
`src/features/voice-history/GuidedVoiceCheck.test.tsx`, and
`src/e2e/guided-voice-check.spec.ts`

---

## 1. Entry and privacy

### REQ-GVC-001 — One Hear Yourself surface

The system shall present Guided Check as part of Hear Yourself, not as a
separate product or medical service.

### REQ-GVC-002 — Local-analysis disclosure

**When** the singer opens a local Guided Check, the system shall state that
analysis occurs on the device and does not diagnose vocal health.

### REQ-GVC-003 — No silent upload

**While** a local Guided Check is active, the system shall not upload audio,
contours, metrics, symptom answers, or reflection text.

### REQ-GVC-004 — Discard temporary work

**When** the singer closes or discards an unkept Focus Take, the system shall
remove the temporary audio and shall not create a voice-history thread.

### REQ-GVC-005 — Explicit keep

**When** the singer explicitly keeps a Focus Take, the system shall store it
through the existing durable voice-take service.

### REQ-GVC-006 — Thread navigation remains available

**WHEN** a singer selects an existing Hear Yourself thread while Guided Check
is open, the system shall return to that thread; if the guide holds an unkept
capture, the system shall first use the same discard confirmation as Close.

## 2. Protocol and capture

### REQ-GVC-010 — Versioned protocol identity

Each Guided Check shall use a stable assessment ID, protocol version, analysis
version, and task configuration.

### REQ-GVC-011 — Comfortable fitted target

**Before** capture, the system shall fit pitch targets and glide routes to a
comfortable declared or measured range without requesting extremes.

### REQ-GVC-012 — Bounded briefing

**Before** scored capture, the system shall name what the task measures and
what it cannot determine.

### REQ-GVC-013 — Gesture-gated example

**When** a check requires an example, the system shall play authored example
audio only after a user gesture.

### REQ-GVC-014 — Stable repetitions

**When** a check requires multiple repetitions, the system shall preserve
identical task parameters across those repetitions.

### REQ-GVC-015 — Independent semantic versions

The system shall keep task instructions, musical targets, and measurement
semantics independently versioned.

## 3. Comfort and safety

### REQ-GVC-020 — Pre-capture comfort check

**Before** a demanding task, the system shall ask whether the singer currently
has pain, unusual hoarseness or tiredness, sudden range loss, significant
illness, unusual effort to speak or sing, or discomfort while singing.

### REQ-GVC-021 — Conservative stop path

**If** the singer reports pain, acute change, unusual vocal tiredness or
effort, illness, or discomfort, **then** the system shall suppress demanding
capture and immediate-repeat encouragement and shall show conservative
stop/referral guidance.

### REQ-GVC-022 — Post-capture comfort report

**After** capture, the system shall let the singer mark the task Easy,
Workable, Effortful, or Uncomfortable.

### REQ-GVC-023 — Discomfort overrides celebration

**If** the singer marks a task Uncomfortable, **then** the system shall
suppress score celebration, immediate retake, and any recommendation to sing
louder, higher, longer, or more often.

### REQ-GVC-024 — Singer report is authoritative

The system shall treat singer-reported discomfort as authoritative over
acoustic performance measurements.

### REQ-GVC-025 — Safety is never paid

Safety, stop, referral, export, and deletion guidance shall remain available
without payment.

### REQ-GVC-026 — No medical inference

The system shall not claim to detect, exclude, diagnose, or clear injury,
pathology, strain, swelling, fatigue, fold closure, or medical fitness from
audio.

## 4. Quality gate

### REQ-GVC-030 — Quality before interpretation

**Before** producing a Focus reading, the system shall evaluate microphone
continuity, clipping, noise/signal separation, required signal coverage, task
completion, duration, repetitions, and analysis capability.

### REQ-GVC-031 — Refuse a false low result

**If** evidence is insufficient, **then** the system shall produce Partial,
Needs another recording, or Unavailable here rather than a low singing result.

### REQ-GVC-032 — Confidence-filtered pitch

**Where** a metric requires F0, the system shall exclude low-confidence,
breath-only, subharmonic, noisy, or ambiguous frames.

### REQ-GVC-033 — Relative recorded level only

**Where** a task uses relative level, the system shall describe the result as
relative recorded level and shall not present uncalibrated dBFS as
sound-pressure level.

### REQ-GVC-034 — Device-aware deltas

**When** an input device or context change invalidates a spectral or level
comparison, the system shall suppress that delta and name why.

### REQ-GVC-035 — Dry assessment source

Controlled assessment and scoring shall use the dry microphone source without
accompaniment or listening-room effects.

### REQ-GVC-036 — Explain unavailable checks plainly

**When** an optional recording-quality check is unavailable, the method
disclosure shall name the missing check in plain singer language, shall not
attribute it to the browser unless a browser capability was actually tested,
and shall not expose internal quality-gate labels as user guidance.

## 5. Focus reading

### REQ-GVC-040 — One useful reading

A valid Focus reading shall present one primary direct measurement, one
positive observation, one current focus, and one practice action.

### REQ-GVC-041 — Visible denominator

Every displayed numeric score shall expose its unit or denominator in the
result or in How this was measured.

### REQ-GVC-042 — Inspectable evidence

Every algorithmic observation shall link to a measurement and, where
time-local evidence exists, one or more replay timestamps.

### REQ-GVC-043 — Evidence classes stay distinct

The system shall distinguish direct measurements, contextual acoustic
proxies, singer reports, and unavailable constructs.

### REQ-GVC-044 — No composite voice score

The system shall not combine multiple constructs into a public composite voice
score.

### REQ-GVC-045 — Describe the recording

The system shall phrase findings as observed recording behaviour and shall not
infer unsupported anatomy, physiology, causation, or health.

### REQ-GVC-046 — No least-bad finding

**If** no result clears the confidence gate, **then** the system shall say
that no reliable focus was found today rather than selecting the least
unreliable metric.

## 6. Practice prescription

### REQ-GVC-050 — Complete recommendation contract

Each practice recommendation shall carry a stable ID and version, originating
evidence ID, exercise configuration, reason, dose, stop rule, return
destination, and retake protocol.

### REQ-GVC-051 — Deterministic selection

The system shall select the recommendation through a tested deterministic rule
table.

### REQ-GVC-052 — Bounded language models

**If** a language model is used to phrase a result, **then** it shall receive
only approved structured findings and shall not create measurements,
diagnoses, safety decisions, or exercise doses.

### REQ-GVC-053 — Preserve practice context

**When** the singer launches the recommended exercise, the system shall
preserve the assessment target, range, task context, and return destination.

### REQ-GVC-054 — Return to the same check

**When** the recommended exercise ends, the system shall offer a return to the
originating Focus reading and an identical Check again task.

### REQ-GVC-055 — No escalation after discomfort

**If** the singer reports that an exercise felt worse or uncomfortable,
**then** the system shall not recommend an increased dose and may offer a
gentler eligible alternative.

## 7. Retake and comparison

### REQ-GVC-060 — Identical retake protocol

**When** a matched retake begins, the system shall reuse the protocol version,
task instructions, key or range, targets, tempo, duration, repetition count,
and scoring rules from the originating Focus Take.

### REQ-GVC-061 — Assessment-scoped compatibility

The system shall group Focus Takes for comparison only when their
assessment-scoped comparison fingerprints are compatible.

### REQ-GVC-062 — Twin Trails at two

**At** two compatible takes, the system shall make Earlier/Later comparison
available through the existing Twin Trails experience.

### REQ-GVC-063 — Practice Loom at three

**At** three compatible takes, the system shall make the existing Practice
Loom pattern view available.

### REQ-GVC-064 — No invented seven-take unlock

The system shall not require an invented seven-take threshold for a
longitudinal view.

### REQ-GVC-065 — Validated uncertainty

The system shall not call a change improvement unless it exceeds the validated
uncertainty or noise floor for that metric and context.

### REQ-GVC-066 — Neutral small deltas

**If** compatible takes differ less than the validated uncertainty, **then**
the system shall use neutral language such as Similar today or report the
direct values without a directional claim.

## 8. Exercise-specific boundaries

### REQ-GVC-070 — Fixed-duration steady sound

A Steady Sound task shall use a fixed comfortable duration and shall not
reward maximum phonation time as universally better.

### REQ-GVC-071 — No support or health label

A Steady Sound result shall not be labelled breath support, airflow
efficiency, lung capacity, fatigue, or vocal health.

### REQ-GVC-072 — Range-fitted glide

A Connected Glide task shall stay inside a comfortable range and shall not
reward maximal span.

### REQ-GVC-073 — No pathology from a glide gap

A glide gap shall not be labelled a register disorder, passaggio problem,
paresis, swelling, muscle tension, or unsafe range.

### REQ-GVC-074 — Comfortable optional SOVT

A lip-trill, hum, straw, or other semi-occluded vocal-tract exercise shall be
optional, comfortable, short, and accompanied by a stop rule.

### REQ-GVC-075 — No unsupported SOVT score

The system shall not derive pitch accuracy, fold closure, breath support,
healing, or vocal-health claims from an occluded-task waveform.

### REQ-GVC-076 — Descriptive onset prototype only

A Gentle Start prototype shall expose descriptive timing or consistency only
and shall not classify balanced, breathy, pressed, hard, healthy, or damaging
onset.

### REQ-GVC-077 — Shared input floor

An amplitude or hiss task shall use the shared calibrated input floor and
shall not infer respiratory physiology.

## 9. Accessibility and responsive behaviour

### REQ-GVC-080 — Keyboard and touch

Guided Check controls, evidence markers, replay, keep, discard, practice, and
retake shall be operable by keyboard and touch.

### REQ-GVC-081 — Mobile bottom drawer

**On** narrow screens, contextual task and result tools shall use the app's
regular bottom drawer rather than squeezing the listening canvas or opening a
browser-native dialog.

### REQ-GVC-082 — Redundant state communication

Recording, processing, playback, quality, and safety state shall not rely on
colour, motion, or sound alone.

### REQ-GVC-083 — Reduced motion

Motion shall respect reduced-motion preferences.

### REQ-GVC-084 — Playback keyboard contract

Space shall control the active replay outside editable controls, and scrubbing
shall seek without auto-playing.

### REQ-GVC-085 — Accessible canvas evidence

Canvas evidence shall have equivalent text labels and accessible seek actions.

## 10. Analytics and failure containment

### REQ-GVC-090 — Coarse analytics only

Guided Check analytics shall use count-only or coarse categorical events and
shall exclude audio, contours, metric values, symptom answers, effort answers,
exact range, and free text.

### REQ-GVC-091 — Remote failure cannot invent a result

A remote, worker, model, or language-model failure shall preserve the singer's
dry local take and shall not fabricate a fallback result.

### REQ-GVC-092 — Recoverable analysis failure

**If** analysis fails after capture, **then** the system shall let the singer
retry analysis, replay or discard the temporary take, or keep it as an
ordinary unanalysed take where the storage contract permits.

### REQ-GVC-093 — Name unavailable evidence

The system shall name unavailable evidence rather than substituting a proxy
that changes the claim.
