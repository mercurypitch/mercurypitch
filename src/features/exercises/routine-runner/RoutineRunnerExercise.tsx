import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { For } from 'solid-js'
import { IconList, IconMic, IconMusic } from '@/components/exercise-icons'
import { ExercisePitchTracker } from '@/components/ExercisePitchTracker'
import { NotePillSelector } from '@/components/NotePillSelector'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { showCelebration } from '@/stores/ui-store'
import { useBaseExercise } from '../use-base-exercise'
import { useRoutineRunnerController } from './use-routine-runner-controller'

interface RoutineRunnerExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const PHASE_NAMES = [
  'Warm-up',
  'Scale Up',
  'Scale Down',
  'Arpeggio',
  'Cool Down',
]

const RoutineRunnerExercise: Component<RoutineRunnerExerciseProps> = (
  props,
) => {
  const [startNote, setStartNote] = createSignal(
    getDefaultNote(vocalRangePreset()),
  )
  const audioEngine = untrack(() => props.audioEngine)

  const practiceEngine = untrack(() => props.practiceEngine)
  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: { type: 'routine-runner', targetNote: untrack(() => startNote()) },
  })

  /* eslint-disable solid/reactivity */
  const controller = useRoutineRunnerController(base, props.audioEngine)
  /* eslint-enable solid/reactivity */

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
    if (props.autoStart === true && base.state().status === 'idle') {
      void handleStart()
    }
  })

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'routine-runner') {
      showCelebration({
        score: r.score,
        exerciseType: r.type,
        metrics: r.metrics,
      })
      untrack(() => {
        recordExerciseResult({
          type: r.type,
          score: r.score,
          metrics: r.metrics,
          completedAt: r.completedAt,
        })
        updateDifficultyFromEma(r.type)
      })
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
  const totalNotesCompleted = () =>
    base.state().metrics.totalNotesCompleted ?? 0
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
        <button class="back-btn" onClick={() => props.onBack?.()}>
          ← Back
        </button>
        <h2 class="exercise-title">Routine Runner</h2>
        <span class="exercise-score-display">
          {base.state().status === 'idle'
            ? '—'
            : `${Math.round(base.state().currentScore)}%`}
        </span>
      </div>

      <div class="exercise-canvas-area">
        <Show when={base.state().status === 'idle'}>
          <div class="exercise-idle-placeholder">
            <IconList size={48} />
            <p>
              Complete a full warm-up routine: gentle scales, arpeggios, and
              cool-down phrases.
            </p>
            <span class="idle-hint">5 phases · {PHASE_NAMES.join(' → ')}</span>
          </div>
        </Show>

        <Show when={isActive()}>
          <>
            <ExercisePitchTracker
              pitchHistory={base.pitchHistory}
              isActive={isActive}
            />
            <div class="mirror-melody-phase">
              <span classList={{ listen: phase() === 1, sing: phase() === 2 }}>
                {phase() === 1 ? (
                  <>
                    <IconMusic size={16} /> {currentPhaseName()} — Listen...
                  </>
                ) : (
                  <>
                    <IconMic size={16} /> {currentPhaseName()} — Sing{' '}
                    {midiToNoteName(currentMidi())}
                  </>
                )}
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
                        ? {
                            background: 'hsl(140, 70%, 50%)',
                            'border-color': 'hsl(140, 70%, 50%)',
                          }
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

            {totalNotesCompleted() > 0 && lastNoteScore() > 0 && (
              <div class="mirror-melody-note-feedback">
                Last note: <span>{lastNoteScore()}%</span>
              </div>
            )}
          </>
        </Show>

        <Show when={isComplete() && base.result()}>
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
              {base.result()!.metrics.totalNotes}
            </div>
            <button
              class="exercise-btn exercise-btn-primary"
              onClick={() => {
                base.reset()
                void handleStart()
              }}
            >
              Run Again
            </button>
          </div>
        </Show>
      </div>

      <div class="exercise-controls">
        <Show when={base.state().status === 'idle'}>
          <>
            <NotePillSelector
              label="Key"
              notes={getNoteOptions(vocalRangePreset())}
              selected={startNote()}
              onChange={setStartNote}
            />
            <Show when={base.error() != null}>
              <div class="exercise-error">{base.error()}</div>
            </Show>
            <button
              class="exercise-btn exercise-btn-primary"
              onClick={() => void handleStart()}
            >
              Start Routine
            </button>
          </>
        </Show>
        <Show when={isActive()}>
          <button
            class="exercise-btn exercise-btn-secondary"
            onClick={handleStop}
          >
            Stop
          </button>
        </Show>
        <Show when={isComplete()}>
          <>
            <button
              class="exercise-btn exercise-btn-primary"
              onClick={() => {
                base.reset()
                void handleStart()
              }}
            >
              Run Again
            </button>
            <button
              class="exercise-btn exercise-btn-secondary"
              onClick={() => {
                base.reset()
              }}
            >
              Change Key
            </button>
          </>
        </Show>
      </div>
    </div>
  )
}

export default RoutineRunnerExercise
