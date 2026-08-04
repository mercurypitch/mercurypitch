import type { Component } from 'solid-js'
import { createEffect, createSignal, Match, onCleanup, onMount, Switch, untrack, } from 'solid-js'
import { For } from 'solid-js'
import { IconMic, IconMusic, IconSiren } from '@/components/exercise-icons'
import { NoteDial } from '@/components/NoteDial'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import { launchTargetNote } from '@/features/practice-intelligence/launch-override'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { getComfortableMidiRange, getDefaultNote, getNoteOptions, } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { ExerciseShell } from '../ExerciseShell'
import { EXERCISE_SIREN } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import { SIREN_PHASE_GLIDE, SIREN_PHASE_LISTEN, SIREN_PHASE_READY, sirenGuideMidi, useSirenController, } from './use-siren-controller'

interface SirenExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const SirenExercise: Component<SirenExerciseProps> = (props) => {
  const [startNote, setStartNote] = createSignal(
    untrack(() => {
      // A challenge drill can request a starting note for this exercise.
      const requested = launchTargetNote('siren')
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
    config: { type: 'siren', targetNote: untrack(() => startNote()) },
  })

  /* eslint-disable solid/reactivity */
  const controller = useSirenController(base, props.audioEngine)
  /* eslint-enable solid/reactivity */

  const handleStart = async () => {
    const range = getComfortableMidiRange(vocalRangePreset())
    controller.setBase(noteToMidi(startNote()), range.min, range.max)
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
    if (r && r.type === 'siren') {
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
  const readyIn = () => base.state().metrics.readyIn ?? 0
  const currentMidi = () => base.state().metrics.currentMidi ?? 0
  const roundsCompleted = () => base.state().metrics.roundsCompleted ?? 0
  const totalRounds = () => base.state().metrics.totalRounds ?? 6
  const lastRoundScore = () => base.state().metrics.lastRoundScore ?? 0

  const pitch = () => base.currentPitch()
  const currentCents = () => {
    const p = pitch()
    if (!p || p.freq <= 0 || currentMidi() === 0) return 0
    const midi = 12 * Math.log2(p.freq / 440) + 69
    return (midi - currentMidi()) * 100
  }

  const posY = () => 50 - (currentCents() / 100) * 50

  const startMidi = () => base.state().metrics.startMidi ?? 0
  const endMidi = () => base.state().metrics.endMidi ?? 0

  // While matching, show the end note as a target line and a guide dot that
  // glides start↔end so the singer can see the path to trace. The travel is
  // measured from when THIS window opened — see sirenGuideMidi.
  const targetMidi = () =>
    phase() === SIREN_PHASE_GLIDE ? endMidi() : startMidi()
  const movingTarget = (): number | null => {
    if (!isActive() || phase() !== SIREN_PHASE_GLIDE) return null
    const from = startMidi()
    const to = endMidi()
    if (from === 0 || to === 0) return null
    const since =
      base.state().elapsedMs - (base.state().metrics.glideFromMs ?? 0)
    return 440 * 2 ** ((sirenGuideMidi(from, to, since) - 69) / 12)
  }

  return (
    <ExerciseShell
      type={EXERCISE_SIREN}
      title="Siren"
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <IconSiren size={48} />
          <p>
            Hear two notes, then glide your voice smoothly between them. Develop
            vocal flexibility and range control.
          </p>
          <span class="idle-hint">
            6 rounds · Ascending and descending sirens
          </span>
        </div>
      }
      idleSettings={
        <NoteDial
          label="Center Note"
          notes={getNoteOptions(vocalRangePreset())}
          selected={startNote()}
          onChange={setStartNote}
        />
      }
      onStart={() => void handleStart()}
      stopLabel="Stop"
      onStop={handleStop}
      tracker={{
        pitchHistory: base.pitchHistory,
        targetNoteMidi: targetMidi,
        movingTarget,
      }}
      activeContent={
        <>
          <div class="mirror-melody-phase">
            <span
              classList={{
                listen: phase() === SIREN_PHASE_LISTEN,
                ready: phase() === SIREN_PHASE_READY,
                sing: phase() === SIREN_PHASE_GLIDE,
              }}
            >
              <Switch>
                <Match when={phase() === SIREN_PHASE_LISTEN}>
                  <IconMusic size={16} /> Listen: {midiToNoteName(startMidi())}{' '}
                  → {midiToNoteName(endMidi())}
                </Match>
                <Match when={phase() === SIREN_PHASE_READY}>
                  <IconMic size={16} /> Breathe — start on{' '}
                  {midiToNoteName(startMidi())} in{' '}
                  <span class="mirror-melody-count">{readyIn()}</span>
                </Match>
                <Match when={phase() === SIREN_PHASE_GLIDE}>
                  <IconMic size={16} /> Glide {midiToNoteName(startMidi())} →{' '}
                  {midiToNoteName(endMidi())} — follow the dot!
                </Match>
              </Switch>
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
            {phase() === SIREN_PHASE_GLIDE && (
              <div class="mirror-melody-target-label">
                {midiToNoteName(currentMidi())}
              </div>
            )}
          </div>

          {roundsCompleted() > 0 && lastRoundScore() > 0 && (
            <div class="mirror-melody-note-feedback">
              Last siren: <span>{lastRoundScore()}%</span>
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

export default SirenExercise
