import { type Component, createEffect, createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import { showCelebration } from '@/stores/ui-store'
import { useBaseExercise } from '../use-base-exercise'
import { usePitchHoldController } from './use-pitch-hold-controller'

interface PitchHoldExerciseProps {
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

const PitchHoldExercise: Component<PitchHoldExerciseProps> = (props) => {
  const [targetNote, setTargetNote] = createSignal('A3')

  const base = useBaseExercise({
    audioEngine: props.audioEngine,
    practiceEngine: props.practiceEngine,
    config: { type: 'pitch-hold', targetNote: targetNote() },
  })

  const controller = usePitchHoldController(base)

  const handleStart = async () => {
    controller.setTarget(noteToMidi(targetNote()))
    await base.start()
    controller.startLoop()
  }

  const handleStop = () => {
    controller.stopAndCompute()
  }

  onCleanup(() => base.reset())

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'pitch-hold') {
      showCelebration({
        score: r.score,
        exerciseType: r.type,
        metrics: r.metrics,
      })
    }
  })

  const state = base.state()
  const result = base.result()
  const isActive = state.status === 'active'
  const isComplete = state.status === 'complete'
  const elapsed = state.elapsedMs / 1000

  // Visualize current pitch position relative to target zone
  const pitch = base.currentPitch()
  const currentCents = (() => {
    if (!pitch || pitch.freq <= 0) return 0
    const midi = 12 * Math.log2(pitch.freq / 440) + 69
    const targetMidi = noteToMidi(targetNote())
    return (midi - targetMidi) * 100
  })()
  const zoneRadius = state.metrics.zoneRadius ?? 50

  // Map cents to position in the viz (0-100, 50 = center)
  const maxVizCents = 100
  const posY = 50 - (currentCents / maxVizCents) * 50
  const zoneTop = 50 - (zoneRadius / maxVizCents) * 50
  const zoneBottom = 50 + (zoneRadius / maxVizCents) * 50
  const inZone = Math.abs(currentCents) <= zoneRadius

  return (
    <div class="exercise-runner">
      <div class="exercise-runner-header">
        <button class="back-btn" onClick={props.onBack}>
          ← Back
        </button>
        <h2 class="exercise-title">Pitch Hold</h2>
        <span class="exercise-score-display">
          {state.status === 'idle' ? '—' : `${Math.round(state.currentScore)}%`}
        </span>
      </div>

      <div class="exercise-canvas-area">
        {state.status === 'idle' && (
          <div style="text-align:center;color:var(--text-secondary)">
            <p style="font-size:1.5rem;margin-bottom:8px">🔒</p>
            <p>Keep your pitch locked inside the target zone as it shrinks over time.</p>
          </div>
        )}

        {isActive && (
          <>
            <div style="display:flex;align-items:center;gap:12px;font-size:1.2rem;font-weight:700;margin-bottom:12px">
              <span>{targetNote()}</span>
              <span style="font-size:0.85rem;color:var(--text-secondary)">
                Zone: ±{Math.round(zoneRadius)}¢
              </span>
              <span style="font-size:0.9rem;color:var(--accent);margin-left:auto">
                {elapsed.toFixed(1)}s
              </span>
            </div>

            <div class="pitch-hold-viz">
              <div
                class="pitch-hold-zone"
                style={`top:${zoneTop}%;height:${zoneBottom - zoneTop}%`}
              />
              <div class="pitch-hold-center-line" />
              <div
                class="pitch-hold-dot"
                classList={{ 'pitch-hold-dot-in': inZone, 'pitch-hold-dot-out': !inZone && pitch != null && pitch.freq > 0 }}
                style={`top:${Math.max(2, Math.min(98, posY))}%`}
              />
              <div class="pitch-hold-target-label">{targetNote()}</div>
            </div>

            <div class="pitch-hold-metrics" style="margin-top:12px">
              <div class="pitch-hold-metric">
                <span class="pitch-hold-metric-label">In Zone</span>
                <span class="pitch-hold-metric-value">
                  {state.metrics.zonePct != null ? `${state.metrics.zonePct}%` : '—'}
                </span>
              </div>
              <div class="pitch-hold-metric">
                <span class="pitch-hold-metric-label">Zone Size</span>
                <span class="pitch-hold-metric-value">
                  {zoneRadius != null ? `±${Math.round(zoneRadius)}¢` : '—'}
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
              In Zone: {result.metrics.zonePct}% · Survived: {result.metrics.survivedSec}s
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

export default PitchHoldExercise
