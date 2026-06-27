import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import { For } from 'solid-js'
import { IconExpand, IconMic, IconMusic } from '@/components/exercise-icons'
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
import { EXERCISE_DYNAMIC_SWELL } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import { useDynamicSwellController } from './use-dynamic-swell-controller'

interface DynamicSwellExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const DynamicSwellExercise: Component<DynamicSwellExerciseProps> = (props) => {
  const [startNote, setStartNote] = createSignal(
    untrack(() => {
      // A challenge drill can request a starting note for this exercise.
      const requested = launchTargetNote('dynamic-swell')
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
    config: { type: 'dynamic-swell', targetNote: untrack(() => startNote()) },
  })

  /* eslint-disable solid/reactivity */
  const controller = useDynamicSwellController(base, props.audioEngine)
  /* eslint-enable solid/reactivity */

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
    if (props.autoStart === true && base.state().status === 'idle') {
      void handleStart()
    }
  })

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'dynamic-swell') {
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
  const roundsCompleted = () => base.state().metrics.roundsCompleted ?? 0
  const totalRounds = () => base.state().metrics.totalRounds ?? 4
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
      type={EXERCISE_DYNAMIC_SWELL}
      title="Dynamic Swell"
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <IconExpand size={48} />
          <p>
            Hold a note and swell your volume from soft to loud and back. Master
            pitch stability under dynamic change.
          </p>
          <span class="idle-hint">
            4 rounds · 8-second holds · Varying pitches
          </span>
        </div>
      }
      idleSettings={
        <NotePillSelector
          label="Starting Note"
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
                  <IconMusic size={16} /> Listen to{' '}
                  {midiToNoteName(currentMidi())}...
                </>
              ) : (
                <>
                  <IconMic size={16} /> Hold {midiToNoteName(currentMidi())} —
                  swell!
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
              Last hold: <span>{lastRoundScore()}%</span>
            </div>
          )}
        </>
      }
      resultSummary={
        <>
          Avg Accuracy: {base.result()?.metrics.avgAccuracy}% · Best Round:{' '}
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

export default DynamicSwellExercise
