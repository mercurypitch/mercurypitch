import { type Component, createEffect, createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import { showCelebration } from '@/stores/ui-store'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { useBaseExercise } from '../use-base-exercise'
import { useVibratoController } from './use-vibrato-controller'
import { IconWave } from '@/components/exercise-icons'

interface VibratoExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
}

const NOTE_OPTIONS = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']

const CLASSIFICATION_LABELS: Record<string, string> = {
  none: 'No vibrato detected',
  'slow-operatic': 'Slow & Wide',
  natural: 'Natural',
  nervous: 'Fast & Narrow',
  wide: 'Wide',
}

const VibratoExercise: Component<VibratoExerciseProps> = (props) => {
  const [targetNote, setTargetNote] = createSignal('A3')
  const [vizPhase, setVizPhase] = createSignal(0)

  const base = useBaseExercise({
    audioEngine: props.audioEngine,
    practiceEngine: props.practiceEngine,
    config: { type: 'vibrato', targetNote: targetNote() },
  })

  const controller = useVibratoController(base)

  let vizInterval: ReturnType<typeof setInterval> | undefined

  const handleStart = async () => {
    await base.start()
    // Animate the orbiting dot
    vizInterval = setInterval(() => {
      setVizPhase((p) => (p + 0.05) % (Math.PI * 2))
    }, 16)
  }

  const handleStop = () => {
    if (vizInterval) clearInterval(vizInterval)
    controller.stopAndCompute()
  }

  onCleanup(() => {
    if (vizInterval) clearInterval(vizInterval)
    base.reset()
  })

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'vibrato') {
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
  const metrics = state.metrics

  // Orbiting dot position (center of viz)
  const hasVibrato = metrics.rateHz > 0
  const orbitRadius = hasVibrato ? Math.min(60, (metrics.depthCents || 0) * 1.2) : 10
  const dotX = 50 + orbitRadius * Math.cos(vizPhase()) * (90 / 180)
  const dotY = 50 + orbitRadius * Math.sin(vizPhase()) * (90 / 180)

  return (
    <div class="exercise-runner">
      <div class="exercise-runner-header">
        <button class="back-btn" onClick={props.onBack}>
          ← Back
        </button>
        <h2 class="exercise-title">Vibrato Practice</h2>
        <span class="exercise-score-display">
          {state.status === 'idle' ? '—' : `${Math.round(state.currentScore)}%`}
        </span>
      </div>

      <div class="exercise-canvas-area">
        {state.status === 'idle' && (
          <div style="text-align:center;color:var(--text-secondary)">
            <IconWave size={48} />
            <p>Sustain a note with vibrato. Aim for 4-7 Hz rate with 10-50 cents depth.</p>
          </div>
        )}

        {isActive && (
          <>
            <div class="vibrato-viz">
              <div class="vibrato-outer-ring" />
              <div class="vibrato-inner-ring" />
              <div
                class="vibrato-dot"
                style={`left:${dotX}%;top:${dotY}%`}
              />
              <div class="vibrato-center">
                {hasVibrato ? `${(metrics.rateHz || 0).toFixed(1)} Hz` : '...'}
              </div>
            </div>
            <div class="vibrato-metrics" style="margin-top:12px">
              <div class="vibrato-metric">
                <span class="vibrato-metric-label">Rate</span>
                <span class="vibrato-metric-value">
                  {hasVibrato ? `${(metrics.rateHz || 0).toFixed(1)} Hz` : '—'}
                </span>
              </div>
              <div class="vibrato-metric">
                <span class="vibrato-metric-label">Depth</span>
                <span class="vibrato-metric-value">
                  {hasVibrato ? `${Math.round(metrics.depthCents || 0)}¢` : '—'}
                </span>
              </div>
              <div class="vibrato-metric">
                <span class="vibrato-metric-label">Style</span>
                <span class="vibrato-metric-value" style="font-size:0.75rem">
                  {hasVibrato
                    ? (CLASSIFICATION_LABELS[Object.keys(CLASSIFICATION_LABELS)[metrics.classification || 0]] || '...')
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
              Rate: {result.metrics.rateHz} Hz · Depth: {result.metrics.depthCents}¢
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
              Change Note
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default VibratoExercise
