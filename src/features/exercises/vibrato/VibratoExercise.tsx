import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { IconWave } from '@/components/exercise-icons'
import { ExercisePitchTracker } from '@/components/ExercisePitchTracker'
import { NotePillSelector } from '@/components/NotePillSelector'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { showCelebration } from '@/stores/ui-store'
import { useBaseExercise } from '../use-base-exercise'
import { useVibratoController } from './use-vibrato-controller'

interface VibratoExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const CLASSIFICATION_LABELS: Record<number, string> = {
  0: 'No vibrato detected',
  1: 'Slow & Wide',
  2: 'Natural',
  3: 'Fast & Narrow',
  4: 'Wide',
}

const VibratoExercise: Component<VibratoExerciseProps> = (props) => {
  const [targetNote, setTargetNote] = createSignal(
    getDefaultNote(vocalRangePreset()),
  )
  const audioEngine = untrack(() => props.audioEngine)

  const practiceEngine = untrack(() => props.practiceEngine)
  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: { type: 'vibrato', targetNote: untrack(() => targetNote()) },
  })

  const controller = useVibratoController(base)

  const handleStart = async () => {
    await base.start()
    controller.startLoop()
  }

  const handleStop = () => {
    controller.stopAndCompute()
  }

  onCleanup(() => {
    base.reset()
  })

  onMount(() => {
    if (props.autoStart === true && base.state().status === 'idle') {
      void handleStart()
    }
  })

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'vibrato') {
      showCelebration({
        score: r.score,
        exerciseType: r.type,
        metrics: r.metrics,
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
  const metrics = () => base.state().metrics

  const currentNote = () => base.currentPitch()?.noteName ?? '...'

  return (
    <div class="exercise-runner">
      <div class="exercise-runner-header">
        <button class="back-btn" onClick={() => props.onBack?.()}>
          ← Back
        </button>
        <h2 class="exercise-title">Vibrato Practice</h2>
        <span class="exercise-score-display">
          {base.state().status === 'idle'
            ? '—'
            : `${Math.round(base.state().currentScore)}%`}
        </span>
      </div>

      <div class="exercise-canvas-area">
        <Show when={base.state().status === 'idle'}>
          <div class="exercise-idle-placeholder">
            <IconWave size={48} />
            <p>
              Sustain a note with vibrato. Aim for 4-7 Hz rate with 10-50 cents
              depth.
            </p>
          </div>
        </Show>

        <Show when={isActive()}>
          <>
            <ExercisePitchTracker
              pitchHistory={base.pitchHistory}
              isActive={isActive}
            />
            <div class="vibrato-current-note">{currentNote()}</div>
            <div class="vibrato-metrics">
              <div class="vibrato-metric">
                <span class="vibrato-metric-label">Rate</span>
                <span class="vibrato-metric-value">
                  {metrics().rateHz > 0
                    ? `${(metrics().rateHz || 0).toFixed(1)} Hz`
                    : '—'}
                </span>
              </div>
              <div class="vibrato-metric">
                <span class="vibrato-metric-label">Depth</span>
                <span class="vibrato-metric-value">
                  {metrics().rateHz > 0
                    ? `${Math.round(metrics().depthCents || 0)}¢`
                    : '—'}
                </span>
              </div>
              <div class="vibrato-metric">
                <span class="vibrato-metric-label">Style</span>
                <span class="vibrato-metric-value" style="font-size:0.75rem">
                  {metrics().rateHz > 0
                    ? CLASSIFICATION_LABELS[metrics().classification ?? 0] ||
                      '...'
                    : '—'}
                </span>
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
              Rate: {base.result()!.metrics.rateHz} Hz · Depth:{' '}
              {base.result()!.metrics.depthCents}¢
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
              Change Note
            </button>
          </>
        </Show>
      </div>
    </div>
  )
}

export default VibratoExercise
