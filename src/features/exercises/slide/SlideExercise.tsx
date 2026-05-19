import { type Component, createEffect, createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
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
          <div class="exercise-idle-placeholder">
            <IconSlide size={48} />
            <p>Slide cleanly from one note to another. No scooping, no overshoot.</p>
          </div>
        )}

        {isActive() && (
          <>
            <div class="slide-note-display">
              <span>{fromNote()}</span>
              <span style="color:var(--text-secondary)">→</span>
              <span>{toNote()}</span>
            </div>
            <div class="slide-viz">
              <div class="slide-target-start" style="left:10%;top:50%" />
              <div class="slide-target-end" style="left:90%;top:50%" />
              <div class="slide-pitch-trace">
                <div class="slide-pitch-dot" style={`left:${pitchPosPct()}%`} />
                {currentMidi() > 0 && (
                  <div class="slide-pitch-label" style={`left:${pitchPosPct()}%`}>
                    {midiToNoteName(Math.round(currentMidi()))}
                  </div>
                )}
              </div>
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
            <div class="exercise-result-score" classList={{ 'exercise-result-score-good': base.result()!.score >= 80, 'exercise-result-score-ok': base.result()!.score >= 50 && base.result()!.score < 80, 'exercise-result-score-poor': base.result()!.score < 50 }}>
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
