import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { IconTarget } from '@/components/exercise-icons'
import { ExercisePitchTracker } from '@/components/ExercisePitchTracker'
import { NotePillSelector } from '@/components/NotePillSelector'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import type { AudioEngine } from '@/lib/audio-engine'
import { noteToMidi } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { showCelebration } from '@/stores/ui-store'
import { useBaseExercise } from '../use-base-exercise'
import { useLongNoteController } from './use-long-note-controller'

interface LongNoteExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const LongNoteExercise: Component<LongNoteExerciseProps> = (props) => {
  const [targetNote, setTargetNote] = createSignal(
    untrack(() => getDefaultNote(vocalRangePreset())),
  )

  const audioEngine = untrack(() => props.audioEngine)
  const practiceEngine = untrack(() => props.practiceEngine)

  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: {
      type: 'long-note',
      targetNote: untrack(() => untrack(() => targetNote())),
    },
  })

  const controller = useLongNoteController(base)

  const targetMidi = () => noteToMidi(targetNote())

  const handleStart = async () => {
    controller.setTarget(untrack(() => targetMidi()))
    await base.start()
    controller.startLoop()
  }

  const handleStop = () => {
    controller.stopAndCompute()
  }

  onCleanup(() => base.reset())

  onMount(() => {
    if (props.autoStart === true && base.state().status === 'idle') {
      void handleStart()
    }
  })

  // Trigger celebration modal when result changes
  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'long-note') {
      showCelebration({
        score: r.score,
        exerciseType: r.type,
        metrics: r.metrics,
        bestWindow: r.bestWindow,
      })
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

  const isActive = () => base.state().status === 'active'
  const isComplete = () => base.state().status === 'complete'
  const elapsed = () => base.state().elapsedMs / 1000

  const fillClass = (value: number, thresholds: [number, number]) =>
    value >= thresholds[0] ? 'good' : value >= thresholds[1] ? 'ok' : 'poor'

  return (
    <div class="exercise-runner">
      <div class="exercise-runner-header">
        <button class="back-btn" onClick={() => props.onBack?.()}>
          ← Back
        </button>
        <h2 class="exercise-title">Long Note Practice</h2>
        <span class="exercise-score-display">
          {base.state().status === 'idle'
            ? '—'
            : `${Math.round(base.state().currentScore)}%`}
        </span>
      </div>

      <div class="exercise-canvas-area">
        <Show when={base.state().status === 'idle'}>
          <div class="exercise-idle-placeholder">
            <IconTarget size={48} />
            <p>Hold a steady pitch. The longer and steadier, the better.</p>
            <p class="exercise-idle-target-note">
              Target: <strong>{targetNote()}</strong>
            </p>
          </div>
        </Show>

        <Show when={isActive()}>
          <>
            <div class="long-note-target-display">
              Target: <strong>{targetNote()}</strong>
            </div>
            <ExercisePitchTracker
              pitchHistory={base.pitchHistory}
              isActive={isActive}
              targetNoteMidi={targetMidi}
            />
            <div class="long-note-timer">{elapsed().toFixed(1)}s</div>
            <div class="long-note-metrics">
              <div class="long-note-metric">
                <span class="long-note-metric-label">Stability</span>
                <span class="long-note-metric-value">
                  {base.state().metrics.pitchStabilityCents != null
                    ? `${base.state().metrics.pitchStabilityCents}¢`
                    : '—'}
                </span>
                <div class="long-note-metric-bar">
                  <div
                    class="long-note-metric-fill good"
                    style={`width:${Math.max(0, 100 - (base.state().metrics.pitchStabilityCents || 0) * 2)}%`}
                  />
                </div>
              </div>
              <div class="long-note-metric">
                <span class="long-note-metric-label">Steady Zone</span>
                <span class="long-note-metric-value">
                  {base.state().metrics.steadyZonePct != null
                    ? `${base.state().metrics.steadyZonePct}%`
                    : '—'}
                </span>
                <div class="long-note-metric-bar">
                  <div
                    class={`long-note-metric-fill ${fillClass(base.state().metrics.steadyZonePct || 0, [80, 50])}`}
                    style={`width:${base.state().metrics.steadyZonePct || 0}%`}
                  />
                </div>
              </div>
            </div>
          </>
        </Show>

        <Show when={isComplete() && base.result()}>
          <div class="exercise-result-overlay">
            <div
              class="exercise-result-score"
              classList={{
                'exercise-result-score-good': base.result()!.score >= 80,
                'exercise-result-score-ok':
                  base.result()!.score >= 50 && base.result()!.score < 80,
                'exercise-result-score-poor': base.result()!.score < 50,
              }}
            >
              {base.result()!.score}%
            </div>
            <div class="exercise-result-label">
              Duration: {base.result()!.metrics.durationSec}s · Stability:{' '}
              {base.result()!.metrics.pitchStabilityCents}¢
            </div>
            <button
              class="exercise-btn exercise-btn-primary"
              onClick={() => {
                base.reset()
                void handleStart()
              }}
            >
              Try Again
            </button>
          </div>
        </Show>
      </div>

      <div class="exercise-controls">
        <Show when={base.state().status === 'idle'}>
          <>
            <NotePillSelector
              label="Target"
              notes={getNoteOptions(vocalRangePreset())}
              selected={targetNote()}
              onChange={setTargetNote}
            />
            <Show when={base.error() != null}>
              <div class="exercise-error">{base.error()}</div>
            </Show>
            <button
              class="exercise-btn exercise-btn-primary"
              onClick={() => void handleStart()}
            >
              Start
            </button>
          </>
        </Show>
        <Show when={isActive()}>
          <button
            class="exercise-btn exercise-btn-secondary"
            onClick={handleStop}
          >
            Stop & Score
          </button>
        </Show>
        <Show when={isComplete()}>
          <>
            <button
              class="exercise-btn exercise-btn-primary"
              onClick={() => {
                base.reset()
                void handleStart()
              }}
            >
              Try Again
            </button>
            <button
              class="exercise-btn exercise-btn-secondary"
              onClick={() => {
                base.reset()
              }}
            >
              Change Target
            </button>
          </>
        </Show>
      </div>
    </div>
  )
}

export default LongNoteExercise
