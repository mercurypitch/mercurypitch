import { type Component, createEffect, createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import { noteToMidi } from '@/lib/frequency-to-note'
import { showCelebration } from '@/stores/ui-store'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { useBaseExercise } from '../use-base-exercise'
import { useLongNoteController } from './use-long-note-controller'
import { IconTarget } from '@/components/exercise-icons'

interface LongNoteExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
}

const NOTE_OPTIONS = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']

const LongNoteExercise: Component<LongNoteExerciseProps> = (props) => {
  const [targetNote, setTargetNote] = createSignal('A3')

  const base = useBaseExercise({
    audioEngine: props.audioEngine,
    practiceEngine: props.practiceEngine,
    config: { type: 'long-note', targetNote: targetNote() },
  })

  const controller = useLongNoteController(base)

  const handleStart = async () => {
    controller.setTarget(noteToMidi(targetNote()))
    await base.start()
  }

  const handleStop = () => {
    controller.stopAndCompute()
  }

  onCleanup(() => base.reset())

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
      recordExerciseResult({
        type: r.type,
        score: r.score,
        metrics: r.metrics,
        completedAt: r.completedAt,
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
        <button class="back-btn" onClick={props.onBack}>
          ← Back
        </button>
        <h2 class="exercise-title">Long Note Practice</h2>
        <span class="exercise-score-display">
          {base.state().status === 'idle' ? '—' : `${Math.round(base.state().currentScore)}%`}
        </span>
      </div>

      <div class="exercise-canvas-area">
        {base.state().status === 'idle' && (
          <div class="exercise-idle-placeholder">
            <IconTarget size={48} />
            <p>Hold a steady pitch. The longer and steadier, the better.</p>
          </div>
        )}

        {isActive() && (
          <>
            <div class="long-note-timer">{elapsed().toFixed(1)}s</div>
            <div class="long-note-metrics">
              <div class="long-note-metric">
                <span class="long-note-metric-label">Stability</span>
                <span class="long-note-metric-value">
                  {base.state().metrics.pitchStabilityCents != null ? `${base.state().metrics.pitchStabilityCents}¢` : '—'}
                </span>
                <div class="long-note-metric-bar">
                  <div class="long-note-metric-fill good" style={`width:${Math.max(0, 100 - (base.state().metrics.pitchStabilityCents || 0) * 2)}%`} />
                </div>
              </div>
              <div class="long-note-metric">
                <span class="long-note-metric-label">Steady Zone</span>
                <span class="long-note-metric-value">
                  {base.state().metrics.steadyZonePct != null ? `${base.state().metrics.steadyZonePct}%` : '—'}
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
        )}

        {isComplete() && base.result() && (
          <div class="exercise-result-overlay">
            <div class="exercise-result-score" classList={{ 'exercise-result-score-good': base.result()!.score >= 80, 'exercise-result-score-ok': base.result()!.score >= 50 && base.result()!.score < 80, 'exercise-result-score-poor': base.result()!.score < 50 }}>
              {base.result()!.score}%
            </div>
            <div class="exercise-result-label">Duration: {base.result()!.metrics.durationSec}s · Stability: {base.result()!.metrics.pitchStabilityCents}¢</div>
            <button class="exercise-btn exercise-btn-primary" onClick={() => { base.reset(); void handleStart() }}>
              Try Again
            </button>
          </div>
        )}
      </div>

      <div class="exercise-controls">
        {base.state().status === 'idle' && (
          <>
            <div class="exercise-target-selector">
              <label>Target:</label>
              <select value={targetNote()} onChange={(e) => setTargetNote(e.currentTarget.value)}>
                {NOTE_OPTIONS.map((n) => <option value={n}>{n}</option>)}
              </select>
            </div>
            {base.error() && (
              <div class="exercise-error">{base.error()}</div>
            )}
            <button class="exercise-btn exercise-btn-primary" onClick={() => void handleStart()}>
              Start
            </button>
          </>
        )}
        {isActive() && (
          <button class="exercise-btn exercise-btn-secondary" onClick={handleStop}>
            Stop & Score
          </button>
        )}
        {isComplete() &&(
          <>
            <button class="exercise-btn exercise-btn-primary" onClick={() => { base.reset(); void handleStart() }}>
              Try Again
            </button>
            <button class="exercise-btn exercise-btn-secondary" onClick={() => { base.reset() }}>
              Change Target
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default LongNoteExercise
