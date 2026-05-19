import { type Component, createEffect, createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import { showCelebration } from '@/stores/ui-store'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { useBaseExercise } from '../use-base-exercise'
import { useSlideController } from './use-slide-controller'
import { IconSlide } from '@/components/exercise-icons'

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

function midiToNoteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const note = midi % 12
  const octave = Math.floor(midi / 12) - 1
  return `${names[note]}${octave}`
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

  const isActive = () => base.state().status === 'active'
  const isComplete = () => base.state().status === 'complete'

  const currentMidi = () => {
    const p = base.currentPitch()
    if (!p || p.freq <= 0) return 0
    return 12 * Math.log2(p.freq / 440) + 69
  }

  const pitchPosPct = () => {
    const midi = currentMidi()
    if (midi === 0) return 50
    const from = noteToMidi(fromNote())
    const to = noteToMidi(toNote())
    const range = to - from
    if (range === 0) return 50
    return Math.max(5, Math.min(95, ((midi - from) / range) * 90 + 5))
  }

  return (
    <div class="exercise-runner">
      <div class="exercise-runner-header">
        <button class="back-btn" onClick={props.onBack}>
          ← Back
        </button>
        <h2 class="exercise-title">Slide Practice</h2>
        <span class="exercise-score-display">
          {base.state().status === 'idle' ? '—' : `${Math.round(base.state().currentScore)}%`}
        </span>
      </div>

      <div class="exercise-canvas-area">
        {base.state().status === 'idle' && (
          <div style="text-align:center;color:var(--text-secondary)">
            <IconSlide size={48} />
            <p>Slide cleanly from one note to another. No scooping, no overshoot.</p>
          </div>
        )}

        {isActive() && (
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
              <div
                style={{
                  position: 'absolute',
                  left: `${pitchPosPct()}%`,
                  top: '50%',
                  width: '14px',
                  height: '14px',
                  'border-radius': '50%',
                  background: 'var(--accent)',
                  transform: 'translate(-50%, -50%)',
                  transition: 'left 0.1s linear',
                  'z-index': '3',
                  'box-shadow': '0 0 10px rgba(99, 102, 241, 0.6)',
                }}
              />
              {currentMidi() > 0 && (
                <div style={{
                  position: 'absolute',
                  left: `${pitchPosPct()}%`,
                  top: '30%',
                  transform: 'translate(-50%, -50%)',
                  'font-size': '0.7rem',
                  color: 'var(--accent)',
                  'font-weight': '600',
                }}>
                  {midiToNoteName(Math.round(currentMidi()))}
                </div>
              )}
            </div>
            <div class="slide-metrics" style="margin-top:12px">
              <div class="slide-metric">
                <span class="slide-metric-label">Smoothness</span>
                <span class="slide-metric-value">
                  {base.state().metrics.smoothness != null ? `${base.state().metrics.smoothness}%` : '—'}
                </span>
              </div>
              <div class="slide-metric">
                <span class="slide-metric-label">Accuracy</span>
                <span class="slide-metric-value">
                  {base.state().metrics.arrivalAccuracy != null ? `${base.state().metrics.arrivalAccuracy}%` : '—'}
                </span>
              </div>
              <div class="slide-metric">
                <span class="slide-metric-label">Time</span>
                <span class="slide-metric-value">
                  {base.state().metrics.slideTimeMs != null ? `${base.state().metrics.slideTimeMs}ms` : '—'}
                </span>
              </div>
              <div class="slide-metric">
                <span class="slide-metric-label">Rating</span>
                <span class="slide-metric-value" style="font-size:0.78rem">
                  {base.state().metrics.classification != null
                    ? (CLASSIFICATION_LABELS[base.state().metrics.classification] || '...')
                    : '—'}
                </span>
              </div>
            </div>
          </>
        )}

        {isComplete() && base.result() && (
          <div class="exercise-result-overlay">
            <div class="exercise-result-score" style={`color:${base.result()!.score >= 80 ? '#22c55e' : base.result()!.score >= 50 ? '#eab308' : '#ef4444'}`}>
              {base.result()!.score}%
            </div>
            <div class="exercise-result-label">
              Smoothness: {base.result()!.metrics.smoothness}% · Accuracy: {base.result()!.metrics.arrivalAccuracy}%
            </div>
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
        {isActive() && (
          <button class="exercise-btn exercise-btn-secondary" onClick={handleStop}>
            Stop & Score
          </button>
        )}
        {isComplete() && (
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
