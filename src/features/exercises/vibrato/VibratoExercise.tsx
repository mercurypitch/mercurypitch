import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import { IconWave } from '@/components/exercise-icons'
import { ExercisePitchTracker } from '@/components/ExercisePitchTracker'
import { NotePillSelector } from '@/components/NotePillSelector'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { ExerciseShell } from '../ExerciseShell'
import { EXERCISE_VIBRATO } from '../types'
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
  const metrics = () => base.state().metrics

  const currentNote = () => base.currentPitch()?.noteName ?? '...'

  return (
    <ExerciseShell
      type={EXERCISE_VIBRATO}
      title="Vibrato Practice"
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <IconWave size={48} />
          <p>
            Sustain a note with vibrato. Aim for 4-7 Hz rate with 10-50 cents
            depth.
          </p>
        </div>
      }
      idleSettings={
        <NotePillSelector
          label="Target"
          notes={getNoteOptions(vocalRangePreset())}
          selected={targetNote()}
          onChange={setTargetNote}
        />
      }
      onStart={() => void handleStart()}
      stopLabel="Stop & Score"
      onStop={handleStop}
      autoTimer={{ presets: [5, 15, 30], onElapse: handleStop }}
      activeContent={
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
      }
      resultSummary={
        <>
          Rate: {base.result()?.metrics.rateHz} Hz · Depth:{' '}
          {base.result()?.metrics.depthCents}¢
        </>
      }
      onTryAgain={() => {
        base.reset()
        void handleStart()
      }}
      onChangeTarget={() => base.reset()}
      changeTargetLabel="Change Note"
    />
  )
}

export default VibratoExercise
