import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import { For } from 'solid-js'
import { IconLayers, IconMic, IconMusic } from '@/components/exercise-icons'
import { ExercisePitchTracker } from '@/components/ExercisePitchTracker'
import { NotePillSelector } from '@/components/NotePillSelector'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import { launchTargetNote } from '@/features/practice-intelligence/launch-override'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { ExerciseShell } from '../ExerciseShell'
import { EXERCISE_ARPEGGIO_JUMPER } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import type { ArpeggioMode } from './use-arpeggio-jumper-controller'
import { useArpeggioJumperController } from './use-arpeggio-jumper-controller'

interface ArpeggioJumperExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

type ArpeggioType = 'major' | 'minor' | 'diminished' | 'augmented'

const ARPEGGIO_TYPES: { value: ArpeggioType; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'diminished', label: 'Diminished' },
  { value: 'augmented', label: 'Augmented' },
]

const ArpeggioJumperExercise: Component<ArpeggioJumperExerciseProps> = (
  props,
) => {
  const [startNote, setStartNote] = createSignal(
    untrack(() => {
      // A challenge drill can request a starting note for this exercise.
      const requested = launchTargetNote('arpeggio-jumper')
      const preset = vocalRangePreset()
      return requested !== undefined &&
        getNoteOptions(preset).includes(requested)
        ? requested
        : getDefaultNote(preset)
    }),
  )
  const [arpeggioType, setArpeggioType] = createSignal<ArpeggioType>('major')
  const [direction, setDirection] = createSignal<'up' | 'down'>('up')
  const [mode, setMode] = createSignal<ArpeggioMode>('steps')
  const audioEngine = untrack(() => props.audioEngine)

  const practiceEngine = untrack(() => props.practiceEngine)
  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: { type: 'arpeggio-jumper', targetNote: untrack(() => startNote()) },
  })

  /* eslint-disable solid/reactivity */
  const controller = useArpeggioJumperController(base, props.audioEngine)
  /* eslint-enable solid/reactivity */

  const handleStart = async () => {
    controller.setArpeggio(
      noteToMidi(startNote()),
      arpeggioType(),
      direction(),
      mode(),
    )
    if (!(await base.start())) return
    controller.startArpeggio()
  }

  const handleStop = () => {
    controller.stopArpeggio()
  }

  onCleanup(() => base.reset())

  onMount(() => {
    if (props.autoStart === true && base.state().status === 'idle') {
      void handleStart()
    }
  })

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'arpeggio-jumper') {
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
  const phase = () => base.state().metrics.phase ?? 0
  const isEcho = () => (base.state().metrics.echo ?? 0) === 1
  const currentMidi = () => base.state().metrics.currentMidi ?? 0
  const noteIndex = () => base.state().metrics.noteIndex ?? 0
  const arpeggioLength = () => base.state().metrics.arpeggioLength ?? 4
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
    <ExerciseShell
      type={EXERCISE_ARPEGGIO_JUMPER}
      title="Arpeggio Jumper"
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <IconLayers size={48} />
          <p>
            {mode() === 'echo'
              ? 'Hear the whole arpeggio, then sing it back from memory — train your inner ear, not just your pitch.'
              : 'Sing chord tones one at a time. Master the leaps between root, third, fifth, and octave.'}
          </p>
          <span class="idle-hint">
            4 notes · {arpeggioType()} · {direction()} ·{' '}
            {mode() === 'echo' ? 'echo the phrase' : 'note by note'}
          </span>
        </div>
      }
      idleSettings={
        <>
          <NotePillSelector
            label="Root Note"
            notes={getNoteOptions(vocalRangePreset())}
            selected={startNote()}
            onChange={setStartNote}
          />
          <div class="exercise-target-selector">
            <label>Chord:</label>
            <select
              value={arpeggioType()}
              onChange={(e) =>
                setArpeggioType(e.currentTarget.value as ArpeggioType)
              }
            >
              <For each={ARPEGGIO_TYPES}>
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
          <div
            class="exercise-timer-toggle"
            role="group"
            aria-label="Interaction mode"
          >
            <button
              type="button"
              class="exercise-timer-segment"
              classList={{ active: mode() === 'steps' }}
              onClick={() => setMode('steps')}
              title="One note plays, you sing it back, then the next"
            >
              Note by note
            </button>
            <button
              type="button"
              class="exercise-timer-segment"
              classList={{ active: mode() === 'echo' }}
              onClick={() => setMode('echo')}
              title="The whole arpeggio plays first, then you repeat it from memory"
            >
              Echo the phrase
            </button>
          </div>
        </>
      }
      onStart={() => void handleStart()}
      stopLabel="Stop"
      onStop={handleStop}
      activeContent={
        <>
          <ExercisePitchTracker
            pitchHistory={base.pitchHistory}
            isActive={isActive}
            targetNoteMidi={() => base.state().metrics.currentMidi || undefined}
          />
          <div class="mirror-melody-phase">
            <span classList={{ listen: phase() === 1, sing: phase() === 2 }}>
              {phase() === 1 ? (
                <>
                  <IconMusic size={16} />{' '}
                  {isEcho()
                    ? 'Listen to the whole arpeggio...'
                    : 'Listen to the note...'}
                </>
              ) : phase() === 2 ? (
                <>
                  <IconMic size={16} />{' '}
                  {isEcho() ? 'Now sing it all back!' : 'Sing it back!'}
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
            <For each={Array.from({ length: arpeggioLength() })}>
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
      }
      resultSummary={
        <>
          Avg Accuracy: {base.result()?.metrics.avgAccuracy}% · Best Note:{' '}
          {base.result()?.metrics.bestNote}% · Notes:{' '}
          {base.result()?.metrics.notesCompleted}
        </>
      }
      onTryAgain={() => {
        base.reset()
        void handleStart()
      }}
      onChangeTarget={() => base.reset()}
      changeTargetLabel="Change Settings"
    />
  )
}

export default ArpeggioJumperExercise
