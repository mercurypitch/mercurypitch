import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { IconFire } from '@/components/exercise-icons'
import { Volume2, VolumeX } from '@/components/icons'
import { NoteDial } from '@/components/NoteDial'
import type { PracticeFrameListener } from '@/features/practice/usePracticeController'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import { launchPattern, launchTargetNote, } from '@/features/practice-intelligence/launch-override'
import { createZenNoteScheduler } from '@/features/zen/note-playback'
import { useZenPitchSession } from '@/features/zen/useZenPitchSession'
import type { ZenCanvasRenderModel } from '@/features/zen/zen-canvas-renderer'
import { ZenPitchCanvas } from '@/features/zen/ZenPitchCanvas'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToFrequency, noteToMidi } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { midiToNote } from '@/lib/scale-data'
import { createPersistedSignal } from '@/lib/storage'
import { isNarrow } from '@/lib/use-viewport'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { ExerciseShell } from '../ExerciseShell'
import type { ExerciseResult } from '../types'
import { EXERCISE_WARMUP } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import { WARMUP_EXERCISES, warmupPatternExercises } from './warmup-exercises'
import { applyLeadIn, createLeadInTicker, leadInSeconds, } from './warmup-lead-in'
import type { WarmupPattern } from './warmup-steps'
import { buildWarmupSteps, normalizeWarmupPattern, WARMUP_PATTERN_LABELS, WARMUP_STEP_GAP_SECONDS, warmupStepScore, warmupTotalSeconds, } from './warmup-steps'

interface WarmupExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  /** The app's one pitch-frame stream. The Zen session reads it; it never
   *  opens a detector or a microphone of its own. */
  subscribeFrames: (listener: PracticeFrameListener) => () => void
  onBack: () => void
  autoStart?: boolean
}

const PATTERN_ORDER: WarmupPattern[] = [
  'full',
  'gentle',
  'lip-trill',
  'sirens',
  'ascending-scale',
  'cooldown',
]

const WarmupExercise: Component<WarmupExerciseProps> = (props) => {
  const [comfortNote, setComfortNote] = createSignal(
    untrack(() => {
      const requested = launchTargetNote(EXERCISE_WARMUP)
      const preset = vocalRangePreset()
      return requested !== undefined &&
        getNoteOptions(preset).includes(requested)
        ? requested
        : getDefaultNote(preset)
    }),
  )
  const [pattern, setPattern] = createSignal<WarmupPattern>(
    untrack(() => normalizeWarmupPattern(launchPattern(EXERCISE_WARMUP))),
  )

  const audioEngine = untrack(() => props.audioEngine)
  const practiceEngine = untrack(() => props.practiceEngine)

  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: {
      type: EXERCISE_WARMUP,
      targetNote: untrack(() => comfortNote()),
    },
  })

  /** The authored exercises this pattern runs, in order — count-in intact. */
  const stepExercises = createMemo(() => warmupPatternExercises(pattern()))
  const steps = createMemo(() => buildWarmupSteps(pattern()))

  const [stepIndex, setStepIndex] = createSignal(0)
  const currentStep = () => steps()[stepIndex()]
  const currentExercise = () => stepExercises()[stepIndex()]
  let scores: number[] = []
  let running = false

  /** Between steps: the finished loop settles and the next name shows. */
  const [nextStepName, setNextStepName] = createSignal<string | null>(null)
  let stepGapTimer: ReturnType<typeof setTimeout> | undefined

  /**
   * Guide sounds: the count-in clicks, the first note's reference tone, and
   * a tone per target as the playhead reaches it. Persisted because a mute
   * is a room decision (headphones off, kid asleep), not a session one.
   */
  const [guideMuted, setGuideMuted] = createPersistedSignal<boolean>(
    'pitchperfect_warmup_guide_muted',
    false,
  )

  // ── The Zen session ─────────────────────────────────────────
  //
  // One session walks every step: each authored exercise runs for exactly one
  // loop, then hands control back so the next can be selected. `loopLimit`
  // exists for this — without it the Zen stage loops until told to stop, which
  // is the right shape for open practice and the wrong one for a warm-up.
  //
  // The mic is deliberately not the session's. `useBaseExercise` already holds
  // it for the whole warm-up, and closing it between steps is exactly the
  // reopen cost the routine mic hold removed. So `startMic` reports what base
  // already did, and `stopMic` does nothing at all.
  const session = useZenPitchSession({
    // The lead-in applied at the seam between authoring and running: same
    // ids, every target shifted late by its count-in so each step has an
    // approach run. See warmup-lead-in.ts.
    exerciseDefinitions: WARMUP_EXERCISES.map(applyLeadIn),
    initialExerciseId: untrack(() => stepExercises()[0]?.id),
    subscribeFrames: (listener) => props.subscribeFrames(listener),
    micActive: () => base.state().status === 'active',
    startMic: () => Promise.resolve(base.state().status === 'active'),
    stopMic: () => undefined,
    loopLimit: 1,
    onLoopLimitReached: () => advanceStep(),
  })

  // ── Guide sounds ────────────────────────────────────────────
  //
  // Both samplers are pure (note-playback.ts, warmup-lead-in.ts) and driven
  // off the session clock — the same clock the canvas draws from, so what
  // sounds is what the singer sees. All tones go through the app's
  // AudioEngine: it already owns a context, an instrument voice and the
  // documented envelopes. (The Zen stage's private-AudioContext wiring is
  // NOT copied here — it connects tones straight to the destination and
  // closes the context mid-tone, both confirmed pop sources.)
  const ticker = createLeadInTicker()
  const guideScheduler = createZenNoteScheduler()

  const leadInFor = (index: number): number => {
    const exercise = stepExercises()[index]
    return exercise === undefined ? 0 : leadInSeconds(exercise)
  }

  /** True while the playhead is still in the current step's approach run. */
  const inLeadIn = (): boolean =>
    session.status() === 'running' &&
    session.elapsedSec() < leadInFor(stepIndex())

  // Unmuting must be audible now: sound whatever window the playhead is in,
  // and never the lap so far (the Zen stage's own rule).
  createEffect(() => {
    if (!guideMuted()) guideScheduler.rearm({ soundCurrent: true })
  })

  // Count-in clicks and the first note's reference tone. The ticker is
  // sampled even while muted so a mid-lead-in unmute cannot burst the beats
  // already passed.
  createEffect(() => {
    if (session.status() !== 'running') return
    const exercise = currentExercise()
    if (exercise === undefined) return
    const beat = ticker.sample(
      session.elapsedSec(),
      leadInSeconds(exercise),
      60 / exercise.bpm,
    )
    if (beat === null || guideMuted()) return
    audioEngine.playMetronomeClick(beat === 0)
    if (beat !== 0) return
    // The pitch the step opens on, sounded while the playhead approaches it
    // — the singer hears where the first note lives before it arrives.
    const first = [...exercise.targets]
      .filter((target) => (target.kind ?? 'pitch') === 'pitch')
      .sort((a, b) => a.startBeat - b.startBeat)[0]
    if (first === undefined) return
    void audioEngine.playTone(
      midiToFrequency(noteToMidi(comfortNote()) + first.semitone),
      700,
    )
  })

  // A tone per target as the playhead reaches it, crossing-based so heavy
  // frames drop nothing. Breath and amplitude blocks stay silent — there is
  // no pitch to guide.
  createEffect(() => {
    if (session.status() !== 'running') return
    const elapsedSec = session.elapsedSec()
    const loopIndex = session.loopsCompleted()
    if (guideMuted()) return
    const cues = guideScheduler.sample({
      elapsedSec,
      loopIndex,
      targets: session.targets(),
    })
    for (const cue of cues) {
      if ((cue.target.kind ?? 'pitch') !== 'pitch') continue
      void audioEngine.playTone(
        midiToFrequency(cue.target.startMidi),
        cue.durationSec * 1000,
      )
    }
  })

  const startStep = (index: number): void => {
    const exercise = stepExercises()[index]
    if (exercise === undefined) return
    setStepIndex(index)
    // Fresh step, fresh audio state: beat zero may click again, and the
    // guide scheduler must not back-fill the previous step's targets —
    // loopsCompleted resets per start, so the seam detector cannot see the
    // step change on its own.
    ticker.reset()
    guideScheduler.rearm()
    session.selectExercise(exercise.id)
    session.setRootMidi(noteToMidi(comfortNote()))
    base._updateMetrics({
      stepIndex: index,
      totalSteps: stepExercises().length,
    })
    void session.start()
  }

  const advanceStep = (): void => {
    if (!running) return
    // A step with nothing scoreable in it — the breathing cycle is the only
    // one — finalizes without a score, and averaging it as a zero would say
    // the singer failed at breathing.
    const finished = session.runs()
    const banked = warmupStepScore(finished[finished.length - 1]?.score)
    if (banked !== null) {
      scores.push(banked)
      base._updateScore(averageScore())
    }

    const next = stepIndex() + 1
    if (next < stepExercises().length) {
      // Never straight into the next step: the finished loop settles, the
      // next step's name is announced, and only then does its own count-in
      // begin. This gap plus the lead-in is what un-collides the breathing
      // step from the first sung note.
      setNextStepName(stepExercises()[next]?.title ?? null)
      clearTimeout(stepGapTimer)
      stepGapTimer = setTimeout(() => {
        if (!running) return
        setNextStepName(null)
        startStep(next)
      }, WARMUP_STEP_GAP_SECONDS * 1000)
      return
    }
    finishWarmup(stepExercises().length)
  }

  const averageScore = (): number =>
    scores.length === 0
      ? 0
      : Math.round(
          scores.reduce((sum, value) => sum + value, 0) / scores.length,
        )

  const finishWarmup = (stepsCompleted: number): void => {
    running = false
    session.finish()
    const result: ExerciseResult = {
      type: EXERCISE_WARMUP,
      score: averageScore(),
      metrics: {
        stepsCompleted,
        totalSteps: stepExercises().length,
        participation: averageScore(),
      },
      completedAt: Date.now(),
    }
    base._completeWithResult(result)
  }

  const handleStart = async (): Promise<void> => {
    if (running) return
    scores = []
    clearTimeout(stepGapTimer)
    setNextStepName(null)
    setStepIndex(0)
    if (!(await base.start())) return
    running = true
    startStep(0)
  }

  const handleStop = (): void => {
    if (!running) return
    // The steps behind the singer are done; the one they stopped inside is not.
    finishWarmup(stepIndex())
  }

  onCleanup(() => {
    running = false
    clearTimeout(stepGapTimer)
    session.finish()
    base.reset()
  })

  onMount(() => {
    if (props.autoStart === true && base.state().status === 'idle') {
      void handleStart()
    }
  })

  createEffect(() => {
    const r = base.result()
    if (r && r.type === EXERCISE_WARMUP) {
      untrack(() => {
        recordExerciseResult({
          type: r.type,
          score: r.score,
          metrics: r.metrics,
          completedAt: r.completedAt,
        })
        updateDifficultyFromEma(r.type)
      })
    }
  })

  // ── The canvas ──────────────────────────────────────────────
  // The live pass only. Reviewing takes is what the Zen stage is for; a
  // warm-up is a thing you get through, and a strip of finished passes in the
  // middle of one is an invitation to stop and study a hum.
  const canvasModel = createMemo<ZenCanvasRenderModel>(() => ({
    durationSec: session.loopDurationSec(),
    elapsedSec: session.elapsedSec(),
    viewport: session.viewport(),
    targets: session.targets(),
    targetVisibility: session.targetVisibility(),
    showPlayhead: session.progressCue() === 'playhead',
    points: session.activePoints(),
  }))

  const canvasSummary = createMemo(() => {
    const heading = `${currentStep()?.name ?? 'Warm-up'}, step ${
      stepIndex() + 1
    } of ${steps().length}`
    const voiced = [...session.activePoints()]
      .reverse()
      .find((point) => point.midi !== null)
    if (voiced?.midi === null || voiced === undefined) {
      return `${heading}; waiting for your voice.`
    }
    const note = midiToNote(Math.round(voiced.midi))
    return `${heading}; current pitch ${note.name}${note.octave}.`
  })

  return (
    <ExerciseShell
      type={EXERCISE_WARMUP}
      title="Guided Warmup"
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      icon={<IconFire size={20} />}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <p>
            A coached warmup — breathing, hums, lip trills, sirens, a light
            scale. No grades, just get the voice moving.
          </p>
          {/* Only where the settings are behind the sheet button. Beside a
              routine picker and a dial that both say the same thing, this
              line was a row spent restating the two rows under it. */}
          <Show when={isNarrow()}>
            <p class="exercise-idle-target-note">
              {WARMUP_PATTERN_LABELS[pattern()]} · ~
              {Math.round(warmupTotalSeconds(steps()) / 60)} min · around{' '}
              <strong>{comfortNote()}</strong>
            </p>
          </Show>
        </div>
      }
      settingsSheetLabel="Routine & comfort note"
      idleSettings={
        <>
          {/* Six routines were six pills wrapping to three rows of a panel
              that is short of them, and the only multi-choice control in the
              drills drawn as pills. A select is one row and the same control
              the scale and arpeggio drills already use. */}
          <label class="exercise-target-selector">
            <span class="routine-picker-label">Routine</span>
            <select
              value={pattern()}
              onChange={(e) =>
                setPattern(e.currentTarget.value as WarmupPattern)
              }
            >
              <For each={PATTERN_ORDER}>
                {(p) => <option value={p}>{WARMUP_PATTERN_LABELS[p]}</option>}
              </For>
            </select>
          </label>
          <NoteDial
            class="warmup-comfort-note"
            label="Comfort note"
            notes={getNoteOptions(vocalRangePreset())}
            selected={comfortNote()}
            onChange={setComfortNote}
          />
        </>
      }
      onStart={() => void handleStart()}
      startLabel="Start Warmup"
      stopLabel="End Warmup"
      onStop={handleStop}
      activeContent={
        <div class="warmup-stage">
          <div class="warmup-step-display">
            <div class="warmup-step-progress">
              Step {stepIndex() + 1} of {steps().length}
            </div>
            <h3 class="warmup-step-name">{currentStep()?.name}</h3>
            <p class="warmup-step-instruction">{currentStep()?.instruction}</p>
          </div>
          {/* One row, directly above the canvas, doing the work two rows
              used to do: the approach-run announcement centred in it and
              the guide toggle parked in a corner. The announcement is
              transient, so the row keeps its height whether or not it has
              text — a line that appears between steps must not shove the
              canvas down, and on a short screen the two rows it replaces
              were the difference between the step fitting and not. */}
          <div class="warmup-caption-row">
            <Show when={nextStepName() !== null || inLeadIn()}>
              <span class="warmup-phase-line">
                {nextStepName() !== null
                  ? `Nice — next: ${nextStepName()}`
                  : 'Get ready\u2026'}
              </span>
            </Show>
            <button
              type="button"
              class="warmup-guide-mute"
              data-testid="warmup-guide-mute"
              aria-pressed={guideMuted()}
              aria-label={
                guideMuted() ? 'Unmute guide sounds' : 'Mute guide sounds'
              }
              onClick={() => setGuideMuted((muted) => !muted)}
            >
              {guideMuted() ? <VolumeX /> : <Volume2 />}
              <span>{guideMuted() ? 'Guide muted' : 'Guide on'}</span>
            </button>
          </div>
          {/* The same canvas the Zen stage draws on: targets ahead of the
              playhead, the voice trace behind it, an amber lane for blocks
              scored on loudness and a breathing ring for the ones scored on
              nothing at all. */}
          <div class="warmup-canvas">
            <ZenPitchCanvas model={canvasModel} summary={canvasSummary} />
          </div>
        </div>
      }
      resultSummary={
        <>
          Steps: {base.result()?.metrics.stepsCompleted}/
          {base.result()?.metrics.totalSteps} · Participation:{' '}
          {base.result()?.metrics.participation}%
        </>
      }
      onTryAgain={() => {
        base.reset()
        void handleStart()
      }}
      onChangeTarget={() => base.reset()}
      changeTargetLabel="Change Routine"
    />
  )
}

export default WarmupExercise
