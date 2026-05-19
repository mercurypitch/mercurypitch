import { type Component, createEffect, createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import { showCelebration } from '@/stores/ui-store'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { useBaseExercise } from '../use-base-exercise'
import { useLongNoteController } from './use-long-note-controller'

interface LongNoteExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
}

const NOTE_OPTIONS = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']

function noteToMidi(note: string): number {
  const names = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  const name = note.slice(0, -1)
  const octave = parseInt(note.slice(-1))
  return names.indexOf(name) * 1 + (octave + 1) * 12
}

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

  const state = base.state()
  const result = base.result()
  const isActive = state.status === 'active'
  const isComplete = state.status === 'complete'
  const elapsed = state.elapsedMs / 1000

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
          {state.status === 'idle' ? '—' : `${Math.round(state.currentScore)}%`}
        </span>
      </div>

      <div class="exercise-canvas-area">
        {state.status === 'idle' && (
          <div style="text-align:center;color:var(--text-secondary)">
            <p style="font-size:1.5rem;margin-bottom:8px">🎯</p>
            <p>Hold a steady pitch. The longer and steadier, the better.</p>
          </div>
        )}

        {isActive && (
          <>
            <div class="long-note-timer">{elapsed.toFixed(1)}s</div>
            <div class="long-note-metrics">
              <div class="long-note-metric">
                <span class="long-note-metric-label">Stability</span>
                <span class="long-note-metric-value">
                  {state.metrics.pitchStabilityCents != null ? `${state.metrics.pitchStabilityCents}¢` : '—'}
                </span>
                <div class="long-note-metric-bar">
                  <div class="long-note-metric-fill good" style={`width:${Math.max(0, 100 - (state.metrics.pitchStabilityCents || 0) * 2)}%`} />
                </div>
              </div>
              <div class="long-note-metric">
                <span class="long-note-metric-label">Steady Zone</span>
                <span class="long-note-metric-value">
                  {state.metrics.steadyZonePct != null ? `${state.metrics.steadyZonePct}%` : '—'}
                </span>
                <div class="long-note-metric-bar">
                  <div
                    class={`long-note-metric-fill ${fillClass(state.metrics.steadyZonePct || 0, [80, 50])}`}
                    style={`width:${state.metrics.steadyZonePct || 0}%`}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {isComplete && result && (
          <div class="exercise-result-overlay">
            <div class="exercise-result-score" style={`color:${result.score >= 80 ? '#22c55e' : result.score >= 50 ? '#eab308' : '#ef4444'}`}>
              {result.score}%
            </div>
            <div class="exercise-result-label">Duration: {result.metrics.durationSec}s · Stability: {result.metrics.pitchStabilityCents}¢</div>
            <button class="exercise-btn exercise-btn-primary" onClick={() => { base.reset(); void handleStart() }}>
              Try Again
            </button>
          </div>
        )}
      </div>

      <div class="exercise-controls">
        {state.status === 'idle' && (
          <>
            <div class="exercise-target-selector">
              <label>Target:</label>
              <select value={targetNote()} onChange={(e) => setTargetNote(e.currentTarget.value)}>
                {NOTE_OPTIONS.map((n) => <option value={n}>{n}</option>)}
              </select>
            </div>
            <button class="exercise-btn exercise-btn-primary" onClick={() => void handleStart()}>
              Start
            </button>
          </>
        )}
        {isActive && (
          <button class="exercise-btn exercise-btn-secondary" onClick={handleStop}>
            Stop & Score
          </button>
        )}
        {isComplete && (
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
