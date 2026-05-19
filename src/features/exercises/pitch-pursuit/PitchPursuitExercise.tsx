import { type Component, createEffect, createSignal, onCleanup, For } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import { midiToNoteName } from '@/lib/frequency-to-note'
import { showCelebration } from '@/stores/ui-store'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { useBaseExercise } from '../use-base-exercise'
import { usePitchPursuitController } from './use-pitch-pursuit-controller'
import { IconGame, IconCheck, IconCross, IconMic } from '@/components/exercise-icons'

interface PitchPursuitExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
}

const TARGET_ZONE_FRAC = 0.88

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
    if (base.state().status !== 'active') return
    controller.startGame()
    vizInterval = setInterval(() => setTick((t) => t + 1), 33)
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
  const met = () => base.state().metrics

  const currentNote = () => {
    tick()
    const p = base.currentPitch()
    if (!p || p.freq <= 0) return null
    const midi = 12 * Math.log2(p.freq / 440) + 69
    return { midi, name: midiToNoteName(Math.round(midi)) }
  }

  const notesView = () => {
    tick()
    const now = performance.now()
    return controller.getNotes().map((n) => {
      const elapsed = now - n.spawnedAt
      const progress = elapsed / 5000
      return {
        id: n.id,
        midi: n.midi,
        yPct: Math.min(100, progress * 100),
        opacity: n.scored ? (n.hit ? 0 : 0.3) : 1,
        color: n.scored
          ? n.hit
            ? '#22c55e'
            : '#ef4444'
          : 'var(--accent)',
        noteName: midiToNoteName(n.midi),
        scored: n.scored,
      }
    })
  }

  return (
    <div class="exercise-runner">
      <div class="exercise-runner-header">
        <button class="back-btn" onClick={props.onBack}>
          ← Back
        </button>
        <h2 class="exercise-title">Pitch Pursuit</h2>
        <span class="exercise-score-display">
          {base.state().status === 'idle' ? '—' : `${Math.round(base.state().currentScore)}%`}
        </span>
      </div>

      <div class="exercise-canvas-area">
        {base.state().status === 'idle' && (
          <div class="exercise-idle-placeholder">
            <IconGame size={48} />
            <p>Notes fall from above. Sing the matching pitch before they reach the target line.</p>
            <p style="font-size:0.8rem;margin-top:8px;opacity:0.7">12 notes · Hit within ±50 cents</p>
          </div>
        )}

        {isActive() && (
          <>
            <div class="pursuit-hud">
              <div style="display:flex;gap:16px;font-size:0.9rem">
                <span><IconCheck size={14} /> {met().hits ?? 0}</span>
                <span><IconCross size={14} /> {met().misses ?? 0}</span>
              </div>
              <div style="font-size:0.9rem;font-weight:600;color:var(--accent)">
                Combo: {met().combo ?? 0}x
              </div>
              <div style="font-size:0.8rem;color:var(--text-secondary)">
                {(() => { const n = currentNote(); return n ? <><IconMic size={14} /> {n.name}</> : '...' })()}
              </div>
            </div>

            <div class="pursuit-track">
              <div
                class="pursuit-target-line"
                style={`top:${TARGET_ZONE_FRAC * 100}%`}
              />

              <For each={notesView()}>
                {(note) => (
                  <div
                    class="pursuit-note-bar"
                    style={{
                      top: `${note.yPct}%`,
                      background: note.color,
                      opacity: note.opacity,
                      transition: note.scored ? 'opacity 0.3s' : 'none',
                    }}
                  >
                    {note.noteName}
                  </div>
                )}
              </For>
            </div>

            <div style="text-align:center;padding:8px;font-size:0.8rem;color:var(--text-secondary)">
              {(met().totalNotes ?? 0)} / 12 notes
            </div>
          </>
        )}

        {isComplete() && base.result() && (
          <div class="exercise-result-overlay">
            <div class="exercise-result-score" classList={{ 'exercise-result-score-good': base.result()!.score >= 80, 'exercise-result-score-ok': base.result()!.score >= 50 && base.result()!.score < 80, 'exercise-result-score-poor': base.result()!.score < 50 }}>
              {base.result()!.score}%
            </div>
            <div class="exercise-result-label">
              Hits: {base.result()!.metrics.hits}/{base.result()!.metrics.totalNotes} · Accuracy: {base.result()!.metrics.accuracy}% · Best Combo: {base.result()!.metrics.maxCombo}x
            </div>
            <button class="exercise-btn exercise-btn-primary" onClick={() => { base.reset(); void handleStart() }}>
              Play Again
            </button>
          </div>
        )}
      </div>

      <div class="exercise-controls">
        {base.state().status === 'idle' && (
          <>
            {base.error() && (
              <div class="exercise-error">{base.error()}</div>
            )}
            <button class="exercise-btn exercise-btn-primary" onClick={() => void handleStart()}>
              Start Game
            </button>
          </>
        )}
        {isActive() && (
          <button class="exercise-btn exercise-btn-secondary" onClick={handleStop}>
            Stop
          </button>
        )}
        {isComplete() && (
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
