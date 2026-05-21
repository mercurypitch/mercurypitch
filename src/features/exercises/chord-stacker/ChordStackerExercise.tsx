import { type Component, createEffect, createMemo, createSignal, onCleanup, onMount, untrack } from 'solid-js'
import { For } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import { showCelebration } from '@/stores/ui-store'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { useBaseExercise } from '../use-base-exercise'
import { useChordStackerController } from './use-chord-stacker-controller'
import { IconLayers, IconMusic, IconMic } from '@/components/exercise-icons'

interface ChordStackerExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const NOTE_OPTIONS = [
  'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
  'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
]

const CHORD_LABELS: Record<string, string> = {
  maj7: 'Major 7th',
  min7: 'Minor 7th',
  dom7: 'Dominant 7th',
  dim7: 'Diminished 7th',
  maj6: 'Major 6th',
}

const ChordStackerExercise: Component<ChordStackerExerciseProps> = (props) => {
  const [startNote, setStartNote] = createSignal('C4')

  const base = useBaseExercise({
    audioEngine: props.audioEngine,
    practiceEngine: props.practiceEngine,
    config: { type: 'chord-stacker', targetNote: startNote() },
  })

  const controller = useChordStackerController(base, props.audioEngine)

  const handleStart = async () => {
    controller.setBase(noteToMidi(startNote()))
    await base.start()
    controller.startRounds()
  }

  const handleStop = () => {
    controller.stopRounds()
  }

  onCleanup(() => base.reset())

  onMount(() => {
    if (props.autoStart && base.state().status === 'idle') {
      void handleStart()
    }
  })

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'chord-stacker') {
      showCelebration({ score: r.score, exerciseType: r.type, metrics: r.metrics })
      untrack(() => recordExerciseResult({ type: r.type, score: r.score, metrics: r.metrics, completedAt: r.completedAt }))
    }
  })

  const isActive = () => base.state().status === 'active'
  const isComplete = () => base.state().status === 'complete'
  const phase = () => base.state().metrics.phase ?? 0
  const currentMidi = () => base.state().metrics.currentMidi ?? 0
  const noteIndex = () => base.state().metrics.noteIndex ?? 0
  const chordLength = () => base.state().metrics.chordLength ?? 4
  const roundsCompleted = () => base.state().metrics.roundsCompleted ?? 0
  const totalRounds = () => base.state().metrics.totalRounds ?? 5
  const lastRoundScore = () => base.state().metrics.lastRoundScore ?? 0
  const notesCompleted = () => base.state().metrics.notesCompleted ?? 0

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
        <h2 class="exercise-title">Chord Stacker</h2>
        <span class="exercise-score-display">
          {base.state().status === 'idle' ? '—' : `${Math.round(base.state().currentScore)}%`}
        </span>
      </div>

      <div class="exercise-canvas-area">
        {base.state().status === 'idle' && (
          <div class="exercise-idle-placeholder">
            <IconLayers size={48} />
            <p>Hear a chord arpeggiated note by note, then sing each tone back. Train your ear to recognize chord qualities.</p>
            <span class="idle-hint">5 chords · maj7, min7, dom7, dim7, maj6</span>
          </div>
        )}

        {isActive() && (
          <>
            <div class="mirror-melody-phase">
              <span classList={{ listen: phase() === 1, sing: phase() === 2 }}>
                {phase() === 1 ? <><IconMusic size={16} /> Listen to the chord...</>
                  : <><IconMic size={16} /> Sing note {noteIndex() + 1} of {chordLength()}: {midiToNoteName(currentMidi())}</>}
              </span>
            </div>

            <div class="mirror-melody-progress">
              <For each={Array.from({ length: totalRounds() })}>
                {(_, i) => (
                  <div
                    class="mirror-melody-dot-progress"
                    classList={{
                      active: i() === roundsCompleted(),
                      done: i() < roundsCompleted(),
                    }}
                    style={
                      i() < roundsCompleted()
                        ? { background: `hsl(${Math.max(0, lastRoundScore() * 1.2)}, 70%, 50%)`, 'border-color': `hsl(${Math.max(0, lastRoundScore() * 1.2)}, 70%, 50%)` }
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

            {roundsCompleted() > 0 && lastRoundScore() > 0 && (
              <div class="mirror-melody-note-feedback">
                Last chord: <span>{lastRoundScore()}%</span>
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
              Avg Accuracy: {base.result()!.metrics.avgAccuracy}% · Best Chord: {base.result()!.metrics.bestRound}% · Rounds: {base.result()!.metrics.roundsCompleted}
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
              <label>Root Note:</label>
              <select value={startNote()} onChange={(e) => setStartNote(e.currentTarget.value)}>
                {NOTE_OPTIONS.map((n) => <option value={n}>{n}</option>)}
              </select>
            </div>
            {base.error() && <div class="exercise-error">{base.error()}</div>}
            <button class="exercise-btn exercise-btn-primary" onClick={() => void handleStart()}>
              Start
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

export default ChordStackerExercise
