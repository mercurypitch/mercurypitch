import { type Component, createEffect, createMemo, createSignal, onCleanup, onMount, untrack } from 'solid-js'
import { For } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import { showCelebration } from '@/stores/ui-store'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { useBaseExercise } from '../use-base-exercise'
import { useRoutineRunnerController } from './use-routine-runner-controller'
import { IconList, IconMusic, IconMic } from '@/components/exercise-icons'

interface RoutineRunnerExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const NOTE_OPTIONS = [
  'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
  'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
]

const PHASE_NAMES = ['Warm-up', 'Scale Up', 'Scale Down', 'Arpeggio', 'Cool Down']

const RoutineRunnerExercise: Component<RoutineRunnerExerciseProps> = (props) => {
  const [startNote, setStartNote] = createSignal('C4')

  const base = useBaseExercise({
    audioEngine: props.audioEngine,
    practiceEngine: props.practiceEngine,
    config: { type: 'routine-runner', targetNote: startNote() },
  })

  const controller = useRoutineRunnerController(base, props.audioEngine)

  const handleStart = async () => {
    controller.setBase(noteToMidi(startNote()))
    await base.start()
    controller.startRoutine()
  }

  const handleStop = () => {
    controller.stopRoutine()
  }

  onCleanup(() => base.reset())

  onMount(() => {
    if (props.autoStart && base.state().status === 'idle') {
      void handleStart()
    }
  })

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'routine-runner') {
      showCelebration({ score: r.score, exerciseType: r.type, metrics: r.metrics })
      untrack(() => recordExerciseResult({ type: r.type, score: r.score, metrics: r.metrics, completedAt: r.completedAt }))
    }
  })

  const isActive = () => base.state().status === 'active'
  const isComplete = () => base.state().status === 'complete'
  const phase = () => base.state().metrics.phase ?? 0
  const currentMidi = () => base.state().metrics.currentMidi ?? 0
  const phaseIndex = () => base.state().metrics.phaseIndex ?? 0
  const totalPhases = () => base.state().metrics.totalPhases ?? 5
  const noteIndex = () => base.state().metrics.noteIndex ?? 0
  const phaseLength = () => base.state().metrics.phaseLength ?? 0
  const totalNotesCompleted = () => base.state().metrics.totalNotesCompleted ?? 0
  const lastNoteScore = () => base.state().metrics.lastNoteScore ?? 0

  const currentPhaseName = createMemo(() => PHASE_NAMES[phaseIndex()] ?? '...')

  const pitch = () => base.currentPitch()
  const currentCents = () => {
    const p = pitch()
    if (!p || p.freq <= 0 || currentMidi() === 0) return 0
    const midi = 12 * Math.log2(p.freq / 440) + 69
    return (midi - currentMidi()) * 100
  }

  const posY = () => 50 - (currentCents() / 100) * 50

  return (
    <div class="exercise-runner">
      <div class="exercise-runner-header">
        <button class="back-btn" onClick={props.onBack}>← Back</button>
        <h2 class="exercise-title">Routine Runner</h2>
        <span class="exercise-score-display">
          {base.state().status === 'idle' ? '—' : `${Math.round(base.state().currentScore)}%`}
        </span>
      </div>

      <div class="exercise-canvas-area">
        {base.state().status === 'idle' && (
          <div class="exercise-idle-placeholder">
            <IconList size={48} />
            <p>Complete a full warm-up routine: gentle scales, arpeggios, and cool-down phrases.</p>
            <span class="idle-hint">5 phases · {PHASE_NAMES.join(' → ')}</span>
          </div>
        )}

        {isActive() && (
          <>
            <div class="mirror-melody-phase">
              <span classList={{ listen: phase() === 1, sing: phase() === 2 }}>
                {phase() === 1 ? <><IconMusic size={16} /> {currentPhaseName()} — Listen...</>
                  : <><IconMic size={16} /> {currentPhaseName()} — Sing {midiToNoteName(currentMidi())}</>}
              </span>
              <span class="mirror-melody-current-note">
                Note {noteIndex() + 1}/{phaseLength()}
              </span>
            </div>

            <div class="mirror-melody-progress">
              <For each={Array.from({ length: totalPhases() })}>
                {(_, i) => (
                  <div
                    class="mirror-melody-dot-progress"
                    classList={{
                      active: i() === phaseIndex(),
                      done: i() < phaseIndex(),
                    }}
                    style={
                      i() < phaseIndex()
                        ? { background: 'hsl(140, 70%, 50%)', 'border-color': 'hsl(140, 70%, 50%)' }
                        : i() === phaseIndex()
                          ? { transform: 'scale(1.3)' }
                          : undefined
                    }
                  />
                )}
              </For>
            </div>

            <div class="mirror-melody-viz">
              <div class="mirror-melody-target-line" />
              <div
                class="mirror-melody-dot"
                classList={{
                  'mirror-melody-dot-close': Math.abs(currentCents()) <= 25,
                  'mirror-melody-dot-far': Math.abs(currentCents()) > 25 && pitch() != null && pitch()!.freq > 0,
                }}
                style={`top:${Math.max(2, Math.min(98, posY()))}%`}
              />
              {phase() === 2 && (
                <div class="mirror-melody-target-label">{midiToNoteName(currentMidi())}</div>
              )}
            </div>

            {totalNotesCompleted() > 0 && lastNoteScore() > 0 && (
              <div class="mirror-melody-note-feedback">
                Last note: <span>{lastNoteScore()}%</span>
              </div>
            )}
          </>
        )}

        {isComplete() && base.result() && (
          <div class="exercise-result-overlay">
            <div
              class="exercise-result-score"
              classList={{
                'exercise-result-score-good': base.result()!.score >= 80,
                'exercise-result-score-ok': base.result()!.score >= 50 && base.result()!.score < 80,
                'exercise-result-score-poor': base.result()!.score < 50,
              }}
            >
              {base.result()!.score}%
            </div>
            <div class="exercise-result-label">
              Avg Accuracy: {base.result()!.metrics.avgAccuracy}% · Best Note: {base.result()!.metrics.bestNote}% · Notes: {base.result()!.metrics.totalNotes}
            </div>
            <button class="exercise-btn exercise-btn-primary" onClick={() => { base.reset(); void handleStart() }}>
              Run Again
            </button>
          </div>
        )}
      </div>

      <div class="exercise-controls">
        {base.state().status === 'idle' && (
          <>
            <div class="exercise-target-selector">
              <label>Key:</label>
              <select value={startNote()} onChange={(e) => setStartNote(e.currentTarget.value)}>
                {NOTE_OPTIONS.map((n) => <option value={n}>{n}</option>)}
              </select>
            </div>
            {base.error() && <div class="exercise-error">{base.error()}</div>}
            <button class="exercise-btn exercise-btn-primary" onClick={() => void handleStart()}>
              Start Routine
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
              Run Again
            </button>
            <button class="exercise-btn exercise-btn-secondary" onClick={() => { base.reset() }}>
              Change Key
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default RoutineRunnerExercise
