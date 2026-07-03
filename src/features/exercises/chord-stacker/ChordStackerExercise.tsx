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
import { EXERCISE_CHORD_STACKER } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import { useChordStackerController } from './use-chord-stacker-controller'

interface ChordStackerExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const ChordStackerExercise: Component<ChordStackerExerciseProps> = (props) => {
  const [startNote, setStartNote] = createSignal(
    untrack(() => {
      // A challenge drill can request a starting note for this exercise.
      const requested = launchTargetNote('chord-stacker')
      const preset = vocalRangePreset()
      return requested !== undefined &&
        getNoteOptions(preset).includes(requested)
        ? requested
        : getDefaultNote(preset)
    }),
  )
  const audioEngine = untrack(() => props.audioEngine)

  const practiceEngine = untrack(() => props.practiceEngine)
  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: { type: 'chord-stacker', targetNote: untrack(() => startNote()) },
  })

  /* eslint-disable solid/reactivity */
  const controller = useChordStackerController(base, props.audioEngine)
  /* eslint-enable solid/reactivity */

  const handleStart = async () => {
    controller.setBase(noteToMidi(startNote()))
    if (!(await base.start())) return
    controller.startRounds()
  }

  const handleStop = () => {
    controller.stopRounds()
  }

  onCleanup(() => base.reset())

  onMount(() => {
    if (props.autoStart === true && base.state().status === 'idle') {
      void handleStart()
    }
  })

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'chord-stacker') {
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
  const currentMidi = () => base.state().metrics.currentMidi ?? 0
  const noteIndex = () => base.state().metrics.noteIndex ?? 0
  const chordLength = () => base.state().metrics.chordLength ?? 4
  const roundsCompleted = () => base.state().metrics.roundsCompleted ?? 0
  const totalRounds = () => base.state().metrics.totalRounds ?? 5
  const lastRoundScore = () => base.state().metrics.lastRoundScore ?? 0

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
      type={EXERCISE_CHORD_STACKER}
      title="Chord Stacker"
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <IconLayers size={48} />
          <p>
            Hear a chord arpeggiated note by note, then sing each tone back.
            Train your ear to recognize chord qualities.
          </p>
          <span class="idle-hint">5 chords · maj7, min7, dom7, dim7, maj6</span>
        </div>
      }
      idleSettings={
        <NotePillSelector
          label="Root Note"
          notes={getNoteOptions(vocalRangePreset())}
          selected={startNote()}
          onChange={setStartNote}
        />
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
                  <IconMusic size={16} /> Listen to the chord...
                </>
              ) : (
                <>
                  <IconMic size={16} /> Sing note {noteIndex() + 1} of{' '}
                  {chordLength()}: {midiToNoteName(currentMidi())}
                </>
              )}
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
                      ? {
                          background: `hsl(${Math.max(0, lastRoundScore() * 1.2)}, 70%, 50%)`,
                          'border-color': `hsl(${Math.max(0, lastRoundScore() * 1.2)}, 70%, 50%)`,
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

          {roundsCompleted() > 0 && lastRoundScore() > 0 && (
            <div class="mirror-melody-note-feedback">
              Last chord: <span>{lastRoundScore()}%</span>
            </div>
          )}
        </>
      }
      resultSummary={
        <>
          Avg Accuracy: {base.result()?.metrics.avgAccuracy}% · Best Chord:{' '}
          {base.result()?.metrics.bestRound}% · Rounds:{' '}
          {base.result()?.metrics.roundsCompleted}
        </>
      }
      onTryAgain={() => {
        base.reset()
        void handleStart()
      }}
      onChangeTarget={() => base.reset()}
      changeTargetLabel="Change Note"
    />
  )
}

export default ChordStackerExercise
