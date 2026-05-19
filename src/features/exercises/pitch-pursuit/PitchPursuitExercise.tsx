import { type Component, createEffect, createSignal, onCleanup, For } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import { showCelebration } from '@/stores/ui-store'
import { useBaseExercise } from '../use-base-exercise'
import { usePitchPursuitController } from './use-pitch-pursuit-controller'

interface PitchPursuitExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
}

function midiToNoteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const note = midi % 12
  const octave = Math.floor(midi / 12) - 1
  return `${names[note]}${octave}`
}

const TARGET_ZONE_FRAC = 0.88
const FALL_DURATION_MS = 5000

const PitchPursuitExercise: Component<PitchPursuitExerciseProps> = (props) => {
  const [tick, setTick] = createSignal(0)

  const base = useBaseExercise({
    audioEngine: props.audioEngine,
    practiceEngine: props.practiceEngine,
    config: { type: 'pitch-pursuit' },
  })

  const controller = usePitchPursuitController(base)

  let vizInterval: ReturnType<typeof setInterval> | undefined

  const handleStart = async () => {
    await base.start()
    controller.startGame()
    vizInterval = setInterval(() => setTick((t) => t + 1), 33) // 30fps refresh
  }

  const handleStop = () => {
    if (vizInterval) clearInterval(vizInterval)
    controller.stopGame()
  }

  onCleanup(() => {
    if (vizInterval) clearInterval(vizInterval)
    base.reset()
  })

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'pitch-pursuit') {
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
  const met = state.metrics

  // Compute note positions each tick
  const notesView = () => {
    tick() // reactive dependency
    const now = performance.now()
    return controller.getNotes().map((n) => {
      const elapsed = now - n.spawnedAt
      const progress = elapsed / FALL_DURATION_MS
      const yPct = Math.min(100, progress * 100)
      const opacity = n.scored ? (n.hit ? 0 : 0.3) : 1
      const color = n.scored
        ? n.hit
          ? '#22c55e'
          : '#ef4444'
        : 'var(--accent)'
      return {
        ...n,
        yPct,
        opacity,
        color,
        noteName: midiToNoteName(n.midi),
      }
    })
  }

  // Current pitch indicator
  const pitch = base.currentPitch()
  const currentNote = (() => {
    if (!pitch || pitch.freq <= 0) return null
    const midi = 12 * Math.log2(pitch.freq / 440) + 69
    return { midi, name: midiToNoteName(Math.round(midi)) }
  })()

  return (
    <div class="exercise-runner">
      <div class="exercise-runner-header">
        <button class="back-btn" onClick={props.onBack}>
          ← Back
        </button>
        <h2 class="exercise-title">Pitch Pursuit</h2>
        <span class="exercise-score-display">
          {state.status === 'idle' ? '—' : `${Math.round(state.currentScore)}%`}
        </span>
      </div>

      <div class="exercise-canvas-area" style="position:relative;overflow:hidden;background:var(--surface);border-radius:12px;min-height:320px">
        {state.status === 'idle' && (
          <div style="text-align:center;color:var(--text-secondary);display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:280px">
            <p style="font-size:1.5rem;margin-bottom:8px">🎮</p>
            <p>Notes fall from above. Sing the matching pitch before they reach the target line.</p>
            <p style="font-size:0.8rem;margin-top:8px;opacity:0.7">12 notes · Hit within ±50 cents</p>
          </div>
        )}

        {isActive && (
          <>
            {/* Game HUD */}
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px;background:var(--surface-hover);border-bottom:1px solid var(--border)">
              <div style="display:flex;gap:16px;font-size:0.9rem">
                <span>✅ {met.hits ?? 0}</span>
                <span>❌ {met.misses ?? 0}</span>
              </div>
              <div style="font-size:0.9rem;font-weight:600;color:var(--accent)">
                Combo: {met.combo ?? 0}x
              </div>
              <div style="font-size:0.8rem;color:var(--text-secondary)">
                {currentNote ? `🎤 ${currentNote.name}` : '...'}
              </div>
            </div>

            {/* Falling notes track */}
            <div style="position:relative;height:240px;overflow:hidden">
              {/* Target zone line */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: `${TARGET_ZONE_FRAC * 100}%`,
                  height: '2px',
                  background: 'var(--accent)',
                  opacity: 0.5,
                  'z-index': 10,
                }}
              />

              {/* Notes */}
              <For each={notesView()}>
                {(note) => (
                  <div
                    style={{
                      position: 'absolute',
                      left: '15%',
                      right: '15%',
                      top: `${note.yPct}%`,
                      height: '28px',
                      background: note.color,
                      opacity: note.opacity,
                      'border-radius': '4px',
                      display: 'flex',
                      'align-items': 'center',
                      'justify-content': 'center',
                      'font-size': '0.8rem',
                      'font-weight': '700',
                      color: '#fff',
                      transform: 'translateY(-50%)',
                      transition: note.scored ? 'opacity 0.3s' : 'none',
                      'z-index': 5,
                    }}
                  >
                    {note.noteName}
                  </div>
                )}
              </For>
            </div>

            {/* Status */}
            <div style="text-align:center;padding:8px;font-size:0.8rem;color:var(--text-secondary)">
              {(met.totalNotes ?? 0)} / 12 notes
            </div>
          </>
        )}

        {isComplete && result && (
          <div class="exercise-result-overlay" style="position:absolute">
            <div class="exercise-result-score" style={`color:${result.score >= 80 ? '#22c55e' : result.score >= 50 ? '#eab308' : '#ef4444'}`}>
              {result.score}%
            </div>
            <div class="exercise-result-label">
              Hits: {result.metrics.hits}/{result.metrics.totalNotes} · Accuracy: {result.metrics.accuracy}% · Best Combo: {result.metrics.maxCombo}x
            </div>
            <button class="exercise-btn exercise-btn-primary" onClick={() => { base.reset(); void handleStart() }}>
              Play Again
            </button>
          </div>
        )}
      </div>

      <div class="exercise-controls">
        {state.status === 'idle' && (
          <button class="exercise-btn exercise-btn-primary" onClick={() => void handleStart()}>
            Start Game
          </button>
        )}
        {isActive && (
          <button class="exercise-btn exercise-btn-secondary" onClick={handleStop}>
            Stop
          </button>
        )}
        {isComplete && (
          <>
            <button class="exercise-btn exercise-btn-primary" onClick={() => { base.reset(); void handleStart() }}>
              Play Again
            </button>
            <button class="exercise-btn exercise-btn-secondary" onClick={() => { base.reset() }}>
              Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default PitchPursuitExercise
