import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import { For } from 'solid-js'
import { IconArrowUpDown, IconMic, IconMusic, } from '@/components/exercise-icons'
import { ExercisePitchTracker } from '@/components/ExercisePitchTracker'
import { NotePillSelector } from '@/components/NotePillSelector'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { showCelebration } from '@/stores/ui-store'
import { useBaseExercise } from '../use-base-exercise'
import { useScaleRunnerController } from './use-scale-runner-controller'

interface ScaleRunnerExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

type ScaleType = 'major' | 'minor' | 'pentatonic' | 'chromatic'

const SCALE_TYPES: { value: ScaleType; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'pentatonic', label: 'Pentatonic' },
  { value: 'chromatic', label: 'Chromatic' },
]

const ScaleRunnerExercise: Component<ScaleRunnerExerciseProps> = (props) => {
  const [startNote, setStartNote] = createSignal(
    getDefaultNote(vocalRangePreset()),
  )
  const [scaleType, setScaleType] = createSignal<ScaleType>('major')
  const [direction, setDirection] = createSignal<'up' | 'down'>('up')

  const base = useBaseExercise({
    audioEngine: props.audioEngine,
    practiceEngine: props.practiceEngine,
    config: { type: 'scale-runner', targetNote: startNote() },
  })

  const controller = useScaleRunnerController(base, props.audioEngine)

  const handleStart = async () => {
    controller.setScale(noteToMidi(startNote()), scaleType(), direction())
    await base.start()
    controller.startScale()
  }

  const handleStop = () => {
    controller.stopScale()
  }

  onCleanup(() => base.reset())

  onMount(() => {
    if (props.autoStart === true && base.state().status === 'idle') {
      void handleStart()
    }
  })

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'scale-runner') {
      showCelebration({
        score: r.score,
        exerciseType: r.type,
        metrics: r.metrics,
      })
      untrack(() =>
        recordExerciseResult({
          type: r.type,
          score: r.score,
          metrics: r.metrics,
          completedAt: r.completedAt,
        }),
      )
    }
  })

  const isActive = () => base.state().status === 'active'
  const isComplete = () => base.state().status === 'complete'
  const phase = () => base.state().metrics.phase ?? 0
  const currentMidi = () => base.state().metrics.currentMidi ?? 0
  const noteIndex = () => base.state().metrics.noteIndex ?? 0
  const scaleLength = () => base.state().metrics.scaleLength ?? 0
  const notesCompleted = () => base.state().metrics.notesCompleted ?? 0
  const lastNoteScore = () => base.state().metrics.lastNoteScore ?? 0

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
        <button class="back-btn" onClick={props.onBack}>
          ← Back
        </button>
        <h2 class="exercise-title">Scale Runner</h2>
        <span class="exercise-score-display">
          {base.state().status === 'idle'
            ? '—'
            : `${Math.round(base.state().currentScore)}%`}
        </span>
      </div>

      <div class="exercise-canvas-area">
        {base.state().status === 'idle' && (
          <div class="exercise-idle-placeholder">
            <IconArrowUpDown size={48} />
            <p>
              Sing each note of the scale in tune. Build your scale fluency note
              by note.
            </p>
            <span class="idle-hint">
              {scaleLength() || 8} notes · {scaleType()} · {direction()}
            </span>
          </div>
        )}

        {isActive() && (
          <>
            <ExercisePitchTracker
              pitchHistory={base.pitchHistory}
              isActive={isActive}
            />
            <div class="mirror-melody-phase">
              <span classList={{ listen: phase() === 1, sing: phase() === 2 }}>
                {phase() === 1 ? (
                  <>
                    <IconMusic size={16} /> Listen to the note...
                  </>
                ) : phase() === 2 ? (
                  <>
                    <IconMic size={16} /> Sing it back!
                  </>
                ) : (
                  '...'
                )}
              </span>
              {phase() === 2 && (
                <span class="mirror-melody-current-note">
                  {midiToNoteName(currentMidi())}
                </span>
              )}
            </div>

            <div class="mirror-melody-progress">
              <For each={Array.from({ length: scaleLength() })}>
                {(_, i) => (
                  <div
                    class="mirror-melody-dot-progress"
                    classList={{
                      active: i() === noteIndex(),
                      done: i() < noteIndex(),
                    }}
                    style={
                      i() < noteIndex()
                        ? {
                            background: `hsl(${Math.max(0, lastNoteScore() * 1.2)}, 70%, 50%)`,
                            'border-color': `hsl(${Math.max(0, lastNoteScore() * 1.2)}, 70%, 50%)`,
                          }
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
                  'mirror-melody-dot-far':
                    Math.abs(currentCents()) > 25 && (pitch()?.freq ?? 0) > 0,
                }}
                style={`top:${Math.max(2, Math.min(98, posY()))}%`}
              />
              {phase() === 2 && (
                <div class="mirror-melody-target-label">
                  {midiToNoteName(currentMidi())}
                </div>
              )}
            </div>

            {notesCompleted() > 0 && lastNoteScore() > 0 && (
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
                'exercise-result-score-ok':
                  base.result()!.score >= 50 && base.result()!.score < 80,
                'exercise-result-score-poor': base.result()!.score < 50,
              }}
            >
              {base.result()!.score}%
            </div>
            <div class="exercise-result-label">
              Avg Accuracy: {base.result()!.metrics.avgAccuracy}% · Best Note:{' '}
              {base.result()!.metrics.bestNote}% · Notes:{' '}
              {base.result()!.metrics.notesCompleted}
            </div>
            <button
              class="exercise-btn exercise-btn-primary"
              onClick={() => {
                base.reset()
                void handleStart()
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      <div class="exercise-controls">
        {base.state().status === 'idle' && (
          <>
            <NotePillSelector
              label="Starting Note"
              notes={getNoteOptions(vocalRangePreset())}
              selected={startNote()}
              onChange={setStartNote}
            />
            <div class="exercise-target-selector">
              <label>Scale:</label>
              <select
                value={scaleType()}
                onChange={(e) =>
                  setScaleType(e.currentTarget.value as ScaleType)
                }
              >
                <For each={SCALE_TYPES}>
                  {(s) => <option value={s.value}>{s.label}</option>}
                </For>
              </select>
            </div>
            <div class="exercise-target-selector">
              <label>Direction:</label>
              <select
                value={direction()}
                onChange={(e) =>
                  setDirection(e.currentTarget.value as 'up' | 'down')
                }
              >
                <option value="up">Ascending</option>
                <option value="down">Descending</option>
              </select>
            </div>
            {base.error() != null && (
              <div class="exercise-error">{base.error()}</div>
            )}
            <button
              class="exercise-btn exercise-btn-primary"
              onClick={() => void handleStart()}
            >
              Start
            </button>
          </>
        )}
        {isActive() && (
          <button
            class="exercise-btn exercise-btn-secondary"
            onClick={handleStop}
          >
            Stop
          </button>
        )}
        {isComplete() && (
          <>
            <button
              class="exercise-btn exercise-btn-primary"
              onClick={() => {
                base.reset()
                void handleStart()
              }}
            >
              Try Again
            </button>
            <button
              class="exercise-btn exercise-btn-secondary"
              onClick={() => {
                base.reset()
              }}
            >
              Change Settings
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default ScaleRunnerExercise
