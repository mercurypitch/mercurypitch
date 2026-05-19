import { type Component, createEffect, createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import { showCelebration } from '@/stores/ui-store'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { useBaseExercise } from '../use-base-exercise'
import { useSlideController } from './use-slide-controller'

interface SlideExerciseProps {
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

const CLASSIFICATION_LABELS: Record<number, string> = {
  '-1': 'No slide detected',
  0: 'Wobble',
  1: 'Scoop',
  2: 'Overshoot',
  3: 'Clean',
}

const SlideExercise: Component<SlideExerciseProps> = (props) => {
  const [fromNote, setFromNote] = createSignal('C4')
  const [toNote, setToNote] = createSignal('E4')

  const base = useBaseExercise({
    audioEngine: props.audioEngine,
    practiceEngine: props.practiceEngine,
    config: { type: 'slide', targetNotes: [fromNote(), toNote()] },
  })

  const controller = useSlideController(base)

  const handleStart = async () => {
    controller.setTargets(noteToMidi(fromNote()), noteToMidi(toNote()))
    await base.start()
  }

  const handleStop = () => {
    controller.stopAndCompute()
  }

  onCleanup(() => base.reset())

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'slide') {
      showCelebration({
        score: r.score,
        exerciseType: r.type,
        metrics: r.metrics,
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

  return (
    <div class="exercise-runner">
      <div class="exercise-runner-header">
        <button class="back-btn" onClick={props.onBack}>
          ← Back
        </button>
        <h2 class="exercise-title">Slide Practice</h2>
        <span class="exercise-score-display">
          {state.status === 'idle' ? '—' : `${Math.round(state.currentScore)}%`}
        </span>
      </div>

      <div class="exercise-canvas-area">
        {state.status === 'idle' && (
          <div style="text-align:center;color:var(--text-secondary)">
            <p style="font-size:1.5rem;margin-bottom:8px">↗️</p>
            <p>Slide cleanly from one note to another. No scooping, no overshoot.</p>
          </div>
        )}

        {isActive && (
          <>
            <div style="display:flex;align-items:center;gap:12px;font-size:1.2rem;font-weight:700;margin-bottom:8px">
              <span>{fromNote()}</span>
              <span style="color:var(--text-secondary)">→</span>
              <span>{toNote()}</span>
            </div>
            <div class="slide-viz">
              <div
                class="slide-target-start"
                style="left:10%;top:50%"
              />
              <div
                class="slide-target-end"
                style="left:90%;top:50%"
              />
              {/* Pitch trace would be drawn here with a canvas/SVG overlay */}
            </div>
            <div class="slide-metrics" style="margin-top:12px">
              <div class="slide-metric">
                <span class="slide-metric-label">Smoothness</span>
                <span class="slide-metric-value">
                  {state.metrics.smoothness != null ? `${state.metrics.smoothness}%` : '—'}
                </span>
              </div>
              <div class="slide-metric">
                <span class="slide-metric-label">Accuracy</span>
                <span class="slide-metric-value">
                  {state.metrics.arrivalAccuracy != null ? `${state.metrics.arrivalAccuracy}%` : '—'}
                </span>
              </div>
              <div class="slide-metric">
                <span class="slide-metric-label">Time</span>
                <span class="slide-metric-value">
                  {state.metrics.slideTimeMs != null ? `${state.metrics.slideTimeMs}ms` : '—'}
                </span>
              </div>
              <div class="slide-metric">
                <span class="slide-metric-label">Rating</span>
                <span class="slide-metric-value" style="font-size:0.78rem">
                  {state.metrics.classification != null
                    ? (CLASSIFICATION_LABELS[state.metrics.classification] || '...')
                    : '—'}
                </span>
              </div>
            </div>
          </>
        )}

        {isComplete && result && (
          <div class="exercise-result-overlay">
            <div class="exercise-result-score" style={`color:${result.score >= 80 ? '#22c55e' : result.score >= 50 ? '#eab308' : '#ef4444'}`}>
              {result.score}%
            </div>
            <div class="exercise-result-label">
              Smoothness: {result.metrics.smoothness}% · Accuracy: {result.metrics.arrivalAccuracy}%
            </div>
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
              <label>From:</label>
              <select value={fromNote()} onChange={(e) => setFromNote(e.currentTarget.value)}>
                {NOTE_OPTIONS.map((n) => <option value={n}>{n}</option>)}
              </select>
              <label>To:</label>
              <select value={toNote()} onChange={(e) => setToNote(e.currentTarget.value)}>
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
              Change Notes
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default SlideExercise
