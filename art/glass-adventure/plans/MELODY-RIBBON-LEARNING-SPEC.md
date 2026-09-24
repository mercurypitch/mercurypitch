# Melody ribbon — learning-island follow-up

Status: design and listening audition. Requested 2026-09-23, after the current
Cloudway asset trial. No new campaign level, microphone judge, reward migration
or recording feature is implemented by this document.

## The moment we are designing

Merc reaches a quiet portrait chamber. A luminous ribbon joins a few note
markers in the glass. **Hear melody** plays the same rising and falling shape
that the player sees. **Sing melody** quiets the room and frames Merc and the
portrait from the side. The player's pitch appears as a small travelling light;
correct singing fills the ribbon continuously from left to right. Connecting
the final note completes the phrase and shatters the glass.

The ribbon is a map of pitch through the phrase, not a generic timer. Filling
three separate held-note meters would miss the proposed experience. The first
exercise has only three notes, two easy glides and a comfortable whole-tone
range. Walking and jumping remain ordinary controls; singing happens at a safe
station. Falling platforms and singing pressure belong to separate mini-games.

## Musical direction and first audition

Compose short original phrases from a small tonal vocabulary before drawing
their curves. A smooth mathematical line alone does not make a musical phrase.
Land briefly on each intended note; glide between them with gentle acceleration
and deceleration. The preview, reference sound and later judge must consume
the same sampled pitch contour.

| Sketch       | Relative semitones            | First purpose                                 | Range          |
| ------------ | ----------------------------- | --------------------------------------------- | -------------- |
| First arc    | 0, 2, 0                       | Hear and return from one small rise           | Whole tone     |
| Sunlit steps | 0, 2, 4, 2, 0                 | Join two small ascending steps and return     | Major third    |
| Gallery arch | 0, 2, 4, 7, 4, 2, 0           | Longer arch, one wider connection             | Perfect fifth  |
| Two windows  | 0, 2, 4, 2, 0 / 0, 2, 5, 2, 0 | Two short phrases with a visible breath break | Perfect fourth |

These are audition candidates, not approved final music or measured difficulty.
Start with roughly 0.35–0.45 s landings and 0.55–0.7 s transitions; offer a slower
reference audition. Three notes should feel like one small gesture. Ten notes
must not silently become a long mandatory single breath. The slash in Two
windows is an explicit phrase boundary, with a pause and an easy restart point.

Transpose semitone offsets around the player's comfortable calibrated note.
Bound the whole phrase to the player's selected range; if the shape does not
fit, offer a smaller-range authored variant or recalibration. Do not clamp
individual notes independently: that changes the melody. Do not require
absolute-pitch naming. Start at a moderate reference volume, and stop reference,
Merc speech and music before assessed capture.

Vibrato is a later ornament on a landed note. Add it only after glides and
phrase progression feel fair. An example may use a restrained periodic wave,
but the judge should accept a suitable depth/rate and number of cycles without
requiring the singer to match the demonstration's exact phase. The current
beginner two-sway exercise is related preparation, not proof of a finished
vibrato teacher. Never reward increased loudness.

## Curve and content model

Author content separately from rendering, host applications and the microphone:

```ts
type MelodyPhrase = {
  id: string
  anchors: readonly {
    id: string
    offsetSemitones: number
    landingSeconds: number
    transitionSeconds?: number
    connection?: 'glide' | 'separate-note'
    ornament?: { kind: 'vibrato'; depthCents: number; rateHz: number }
  }[]
  allowBreathAfter: boolean
}
```

This is a proposal, not a public TypeScript API. The implementation should add
schema validation: finite values, bounded duration/range, unique IDs, supported
connections and legal ornament placement. Keep lesson content distinct from
difficulty policy. A phrase can later supply easier timing/pitch allowances
without duplicating its museum, portrait or asset configuration.

Compile once into segments plus a bounded, monotonically increasing phase
coordinate. Pitch is in MIDI/semitone space; convert to frequency only for
audio output. First use a bounded cubic Hermite ease between landed anchors.
For more complex authored slopes, use a shape-preserving monotone cubic such
as PCHIP. Avoid unconstrained B-spline overshoot creating unintended high or
low notes. A visually curved line must not silently change the target sound.

Sampling the compiled curve provides:

- SVG ribbon geometry and note markers with a consistent pitch scale.
- Reference frequency automation using `440 * 2 ** ((midi - 69) / 12)`.
- Judge target pitch, segment boundaries and required anchor coverage.
- Saved phrase version and difficulty identifier for future score comparison.

Breath breaks are separate segments. Do not interpolate across them or count
their silence as successful singing. The screen can show the next phrase while
the completed phrase remains visibly filled.

## Live judging: fair continuous progress

Use the existing `browser/voice-session.ts` capture owner and pitch engine.
Reuse capture sequence/timestamp validation from `core/settle-wave.ts`; the
renderer must not award progress using animation-frame time. Avoid creating a
second microphone stream or an independent calibration system.

The initial implementation should use a **local forward alignment window**:

1. Acquire the starting note with a short stable sample window. This starts the
   phrase, rather than consuming a long held-note exercise before the melody.
2. Match fresh voiced samples only near the current position on the contour.
   Advance a bounded amount according to elapsed capture time and compatible
   pitch/direction; preserve the continuous prefix already achieved.
3. Require coverage of every anchor and intervening glide. A later repeated
   tonic is not permission to jump to the end. A constant tone, an octave alias,
   a sudden destination-note jump or one noisy frame cannot trace a whole arc.
4. Give short mistakes/dropouts a forgiving freeze and simple up/down feedback.
   Do not steadily drain all progress. A sustained mismatch invites a retry
   from the current short phrase. No punishment for taking a breath at a
   designated boundary.
5. Latch completion exactly once when the final segment and landing are covered.
   Subsequent silence must not undo a completed shatter. Preserve the existing
   cinematic and shatter lifecycle before exploration resumes.

Tune pitch tolerance, small starting stability, tempo range, dropout grace,
coverage and completion landing from recorded/synthetic fixtures and owner
singing. Candidate starting values may be roughly ±60 cents and 0.65–1.6×
reference pace on easy; these are experiment values, not shipping promises.
No hidden timer should make a correct slow beginner trace impossible.

If the forward window cannot align legitimate varied pacing, evaluate bounded
online dynamic time warping with local slope and band constraints. Unconstrained
global nearest-point matching is unsuitable: it skips repeated notes and makes
the visual fill lie about what was sung. Do not add a complicated alignment
engine before the three-note case demonstrates a need.

## Player interface

- One concise goal: **Follow the ribbon**. Buttons: **Hear melody**, **Sing**,
  **Change note**, and a circular help button. Longer explanation lives in help.
- A filled gold prefix, a clear current marker and a quiet unfilled teal path.
  Use shape/brightness as well as colour; keep pitch markers large on tablets.
- A live pitch dot shows above/below the local target. No dense piano roll or
  frequency numbers in the default lesson. Optional dev telemetry is separate.
- A phrase breath gap is visibly separated and announced. Reduced-motion mode
  keeps the functional fill while removing drifting/glowing ornament.
- The side cinematic, Merc mouth, target and shatter remain visible. Measure
  the complete challenge panel at 320px, tablet portrait/landscape and desktop;
  reuse existing safe-area/header ownership instead of layering more controls.
- Retry and permission failure keep the current exhibit available. Closing help
  does not reset the attempt. Pause/background suspends capture consistently.

The first visualizer is a **reference listening audition**. It may fill along
reference playback to explain the idea, but must explicitly say that the
microphone is not being judged. Do not fake successful singing or badge awards.

## Learning-island placement

Proposed next normal-gallery lesson: **The Singing Arcade**, placed after
Twin Galleries; the exact island/order waits for the current route's acceptance.
Use the last island only as a development audition location if convenient,
without replacing the owner-accepted Conservatory exercise or its save.

1. Safe entry: hear one two-note upward connection and see its curve.
2. First vase: First arc, three notes, generous pacing and no ornament.
3. Side alcove: an optional mirrored descending arc; same small range.
4. Main exhibition: Sunlit steps only after the three-note experience works.
5. Portrait finale: the already learned shape with a different beautiful frame
   and a complete shatter. Do not introduce seven notes as a surprise exam.

Seven-note and two-phrase ten-note sketches are later replay/level candidates.
Optional vibrato lands in a later lesson that explicitly teaches it. Existing
coins, portrait ownership and pitch stars remain unchanged until the separate
replay-difficulty migration is approved.

## Implementation sequence and acceptance

- [x] M1 — Listening/visual audition: original 3/5/7/10-note candidates, range
      and pace controls, clear reference-only fill, responsive layout and safe audio
      stop on selection, explicit Stop, background and navigation.
- [ ] M2 — Pure contour compiler and judge prototype in `packages/glass-game`.
      Add a discriminated challenge type and resolver through the existing core
      contracts. Validate authored data; keep old hold/pair/sway behavior unchanged.
- [ ] M3 — Reuse shared microphone/calibration/reference and side cinematic;
      add the ribbon panel in both shared hosts behind a development lesson entry.
- [ ] M4 — Owner sings the three-note case on tablet and desktop. Tune timing
      and range from evidence, then review the five-note case. No paid asset batch
      is necessary to learn whether the mechanic is enjoyable.
- [ ] M5 — Author the handcrafted gallery and portrait finale after approval;
      add narration, polished assets, progress migration and normal campaign entry.

Required behavioral cases: correct ascending/descending glides; distinct legal
tempos; repeated tonic without skipping; constant pitch rejected; missing middle
anchor rejected; octave error rejected; boundary tolerance; brief/long dropout;
duplicate/out-of-order/stale capture rejected; silence after completion does not
cancel; pause/retry/permission/cancel cleanup; explicit phrase breath; completion
once. Feed representative PCM through the real pitch engine as well as testing
the pure judge. Synthetic pitch arrays alone do not establish singing fairness.

Required visual cases: three and ten notes, live/paused/help/error states,
keyboard and real tablet touch, all supported viewports, reduced motion, and
portrait/shatter visibility. An automated pass is not owner musical acceptance.

## Delivered audition checkpoint

The [standalone audition](../melody-ribbon/v1/index.html) implements M1 with all
four original phrase sketches, starting-pitch and pace controls, actual Web Audio
reference playback and audio-clock SVG fill. It has no microphone, judge,
campaign entry, persistence or rewards. The ten-note sketch contains a silent
breath gap. Short note markers become complete only after their landing ends.

The [browser proof](../melody-ribbon/v1/proofs/review.json) exercises real mouse,
keyboard and emulated touch at 1440, 820 and 320px; controls remain at least 44px,
with no horizontal overflow or page errors. The
[independent review](../melody-ribbon/v1/proofs/INDEPENDENT-REVIEW.md) checks
play/stop/switch/replay, breath timing, keyboard single-choice controls, contrast,
background resume and history restoration. Dashed target versus solid gold fill
provides a non-colour cue. Final syntax/format checks pass. Physical-device audio
and owner musical preferences remain to be tested.

## Earlier research carried forward

`personal/mercurypitch/plans/game-mechanics-research.md` contains Glissando Rails
(#8), Echo Panes (#13) and Shard Sculptor (#18). This proposal combines contour
following and short call-and-response at a stationary exhibit. It does not
revive voice-driven locomotion. The separate portrait-finale plan covers future
reference-versus-player listening and opt-in recordings/sharing; this lesson
needs neither storage of microphone recordings nor a singing clone of Merc.
Use a pitch-verified instrumental reference first. Merc's approved spoken voice
can introduce the exercise, but is not automatically a reliable sung reference.

## Technical references

- [PCHIP interpolation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.PchipInterpolator.html):
  shape-preserving cubic interpolation and avoidance of overshoot; a design
  reference, not a proposed SciPy browser dependency.
- [AudioLabs DTW basics](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C3/C3S2_DTWbasic.html)
  and [constraints](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C3/C3S2_DTWvariants.html):
  monotone sequence alignment and constrained paths. The proposed local judge
  is an engineering design to test, not a claim that DTW is already installed.
- [Web Audio value-curve scheduling](https://www.w3.org/TR/webaudio/#dom-audioparam-setvaluecurveattime):
  schedule the reference from the same compiled pitch contour. Use the project's
  short attack/release envelopes and capture-isolation rules.

Related plans: [master](NEXT-MASTER-PLAN.md),
[optional exhibits and portrait finales](OPTIONAL-EXHIBITS-REWARDS-PORTRAIT-FINALES.md),
[replay difficulty](REPLAY-DIFFICULTY-AND-LEVEL-STARS.md),
[Cloudway asset production](ULTRA-PLATFORM-PRODUCTION-2026-09-23.md).
