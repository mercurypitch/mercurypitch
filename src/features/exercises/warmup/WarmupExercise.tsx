import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { IconFire } from '@/components/exercise-icons'
import { NoteDial } from '@/components/NoteDial'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import { launchPattern, launchTargetNote, } from '@/features/practice-intelligence/launch-override'
import type { AudioEngine } from '@/lib/audio-engine'
import { noteToMidi } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { ExerciseShell } from '../ExerciseShell'
import { EXERCISE_WARMUP } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import { useWarmupController } from './use-warmup-controller'
import type { WarmupPattern } from './warmup-steps'
import { buildWarmupSteps, normalizeWarmupPattern, WARMUP_PATTERN_LABELS, warmupTotalSeconds, } from './warmup-steps'

interface WarmupExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
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

  const controller = useWarmupController(base, audioEngine)

  const steps = createMemo(() => buildWarmupSteps(pattern()))

  const handleStart = async () => {
    controller.setup(
      untrack(() => noteToMidi(comfortNote())),
      steps(),
    )
    if (!(await base.start())) return
    controller.startSteps()
  }

  const handleStop = () => {
    controller.stopSteps()
  }

  onCleanup(() => base.reset())

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

  const metrics = () => base.state().metrics
  const currentStep = () => steps()[metrics().stepIndex ?? 0]
  const phase = () => metrics().phase ?? 0

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
      tracker={{
        pitchHistory: base.pitchHistory,
        targetNoteMidi: () => metrics().currentMidi,
        when: () => currentStep()?.kind === 'sing',
      }}
      activeContent={
        <>
          <div class="warmup-step-display">
            <div class="warmup-step-progress">
              Step {(metrics().stepIndex ?? 0) + 1} of {metrics().totalSteps}
            </div>
            <h3 class="warmup-step-name">{currentStep()?.name}</h3>
            <p class="warmup-step-instruction">{currentStep()?.instruction}</p>
            <div class="warmup-step-countdown">
              <Show
                when={phase() === 1}
                fallback={`${metrics().stepRemaining ?? 0}s`}
              >
                Listen…
              </Show>
            </div>
          </div>
        </>
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
