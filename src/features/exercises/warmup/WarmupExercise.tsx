import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, untrack, } from 'solid-js'
import { IconFire } from '@/components/exercise-icons'
import { NoteDial } from '@/components/NoteDial'
import type { PracticeFrameListener } from '@/features/practice/usePracticeController'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import { launchPattern, launchTargetNote, } from '@/features/practice-intelligence/launch-override'
import { useZenPitchSession } from '@/features/zen/useZenPitchSession'
import type { ZenCanvasRenderModel } from '@/features/zen/zen-canvas-renderer'
import { ZenPitchCanvas } from '@/features/zen/ZenPitchCanvas'
import type { AudioEngine } from '@/lib/audio-engine'
import { noteToMidi } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { midiToNote } from '@/lib/scale-data'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { ExerciseShell } from '../ExerciseShell'
import type { ExerciseResult } from '../types'
import { EXERCISE_WARMUP } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import { WARMUP_EXERCISES, warmupPatternExercises } from './warmup-exercises'
import type { WarmupPattern } from './warmup-steps'
import { buildWarmupSteps, normalizeWarmupPattern, WARMUP_PATTERN_LABELS, warmupTotalSeconds, } from './warmup-steps'

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

  /** The authored exercises this pattern runs, in order. */
  const stepExercises = createMemo(() => warmupPatternExercises(pattern()))
  const steps = createMemo(() => buildWarmupSteps(pattern()))

  const [stepIndex, setStepIndex] = createSignal(0)
  const currentStep = () => steps()[stepIndex()]
  let scores: number[] = []
  let running = false

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
    exerciseDefinitions: WARMUP_EXERCISES,
    initialExerciseId: untrack(() => stepExercises()[0]?.id),
    subscribeFrames: (listener) => props.subscribeFrames(listener),
    micActive: () => base.state().status === 'active',
    startMic: () => Promise.resolve(base.state().status === 'active'),
    stopMic: () => undefined,
    loopLimit: 1,
    onLoopLimitReached: () => advanceStep(),
  })

  const startStep = (index: number): void => {
    const exercise = stepExercises()[index]
    if (exercise === undefined) return
    setStepIndex(index)
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
    const total = finished[finished.length - 1]?.score?.total
    if (total !== undefined) {
      scores.push(total)
      base._updateScore(averageScore())
    }

    const next = stepIndex() + 1
    if (next < stepExercises().length) {
      startStep(next)
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
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <IconFire size={48} />
          <p>
            A coached vocal warmup: breathing, hums, lip trills, sirens, and a
            light scale. Follow the steps — no grades, just get the voice
            moving.
          </p>
          <p class="exercise-idle-target-note">
            {WARMUP_PATTERN_LABELS[pattern()]} · ~
            {Math.round(warmupTotalSeconds(steps()) / 60)} min · around{' '}
            <strong>{comfortNote()}</strong>
          </p>
        </div>
      }
      settingsSheetLabel="Routine & comfort note"
      idleSettings={
        <>
          <div class="routine-picker">
            <span class="routine-picker-label">Routine</span>
            <div class="routine-row">
              <For each={PATTERN_ORDER}>
                {(p) => (
                  <button
                    type="button"
                    class={`routine-pill${pattern() === p ? ' routine-pill-selected' : ''}`}
                    onClick={() => setPattern(p)}
                    aria-pressed={pattern() === p}
                  >
                    {WARMUP_PATTERN_LABELS[p]}
                  </button>
                )}
              </For>
            </div>
          </div>
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
