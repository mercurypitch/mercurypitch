// ============================================================
// Drone Intonation: intervals sung and held over a drone
// ============================================================
//
// Lessons 10 and 24's drill (SEASON-2 § 5.2 item 15). The setup chooses the
// drone's note and the tuning a run is scored in: the piano's notes, or
// pure intervals over the drone (drone-tuning.ts), which Lesson 24's
// `harmony-on-a-drone` opens on. Every line a run says names the tuning, and
// so does its result, since a pure third and the piano's are scored on two
// rulers and kept as two records.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { IconDrone, IconMic } from '@/components/exercise-icons'
import { NoteDial } from '@/components/NoteDial'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import { launchDifficulty, launchTargetNote, launchTuning, } from '@/features/practice-intelligence/launch-override'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { createPersistedSignal } from '@/lib/storage'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { ExerciseShell } from '../ExerciseShell'
import { SetupChoice, SetupChoices } from '../SetupChoice'
import { createNoteDemo } from '../stage/note-demo'
import { EXERCISE_DRONE_INTONATION, runStoppedEarly } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import type { DroneTuning } from './drone-tuning'
import { DRONE_TUNING_OPTIONS, droneTargetMidi, isDroneTuning, offsetInWords, tuningInWords, } from './drone-tuning'
import styles from './DroneIntonation.module.css'
import { droneIntervalLabel, droneIntervalNames, droneLaunchIntervals, plannedRounds, useDroneIntonationController, } from './use-drone-intonation-controller'

interface DroneIntonationExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const TUNING_KEY = 'pitchperfect_drone_intonation_tuning'

/** What the brief says each tuning scores against. */
const TUNING_BRIEF: Readonly<Record<DroneTuning, string>> = {
  piano:
    'Each target is an equal-tempered note, in the same tuning as the rest of the app.',
  pure: "Each target is the pure interval over the drone, not the piano's note.",
}

/** The tuning a launch (a lesson's slug) asked for, if it is one of the two. */
export function droneLaunchTuning(): DroneTuning | undefined {
  const asked = launchTuning(EXERCISE_DRONE_INTONATION)
  return isDroneTuning(asked) ? asked : undefined
}

const DroneIntonationExercise: Component<DroneIntonationExerciseProps> = (
  props,
) => {
  const [startNote, setStartNote] = createSignal(
    untrack(() => {
      // A challenge drill can request a starting note for this exercise.
      const requested = launchTargetNote('drone-intonation')
      const preset = vocalRangePreset()
      return requested !== undefined &&
        getNoteOptions(preset).includes(requested)
        ? requested
        : getDefaultNote(preset)
    }),
  )

  // The singer's tuning persists. A lesson's launch opens the drill on its
  // own for this visit without changing what was saved; a tap on a chip
  // hands the choice back.
  const [savedTuning, saveTuning] = createPersistedSignal<DroneTuning>(
    TUNING_KEY,
    'piano',
    { validator: isDroneTuning },
  )
  const [tuning, setTuning] = createSignal<DroneTuning>(
    untrack(() => droneLaunchTuning() ?? savedTuning()),
  )
  const pickTuning = (choice: DroneTuning): void => {
    setTuning(choice)
    saveTuning(choice)
  }

  const audioEngine = untrack(() => props.audioEngine)

  const practiceEngine = untrack(() => props.practiceEngine)
  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: () => ({
      type: 'drone-intonation',
      targetNote: startNote(),
    }),
  })

  /* eslint-disable solid/reactivity */
  const controller = useDroneIntonationController(base, props.audioEngine)
  /* eslint-enable solid/reactivity */

  const handleStart = async () => {
    controller.setBase(noteToMidi(startNote()), tuning())
    if (!(await base.start())) return
    await controller.startRounds()
  }

  const handleStop = () => {
    controller.stopRounds()
  }

  onCleanup(() => base.reset())

  // "Hear it first": Merc plays one example before the singer tries. The
  // drone, then one note above it: a launch's first interval, or a fifth,
  // pure in Pure tuning.
  const demo = createNoteDemo(audioEngine)
  const exampleDrone = () => noteToMidi(startNote())
  const exampleSpan = () => droneLaunchIntervals()?.[0] ?? 7
  const exampleTop = () =>
    droneTargetMidi(exampleDrone(), exampleSpan(), tuning())
  const exampleLine = (): string => {
    const label = droneIntervalLabel(exampleSpan())
    const opening = `Listen: the drone, ${midiToNoteName(exampleDrone())}, then ${midiToNoteName(exampleTop())} above it`
    if (label === undefined) return `${opening}.`
    return tuning() === 'pure'
      ? `${opening}, a pure ${label}.`
      : `${opening} (${label}).`
  }
  onCleanup(() => demo.stop())

  onMount(() => {
    if (props.autoStart === true && base.state().status === 'idle') {
      void handleStart()
    }
  })

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'drone-intonation') {
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

  const phase = () => base.state().metrics.phase ?? 0
  const currentMidi = () => base.state().metrics.currentMidi ?? 0
  const droneMidi = () => base.state().metrics.droneMidi ?? 0
  const intervalSemitones = () => base.state().metrics.intervalSemitones ?? 0
  const targetCents = () => base.state().metrics.targetCents ?? 0
  const roundsCompleted = () => base.state().metrics.roundsCompleted ?? 0
  const totalRounds = () => base.state().metrics.totalRounds ?? 6
  const lastRoundScore = () => base.state().metrics.lastRoundScore ?? 0

  const intervalLabel = createMemo(
    () => droneIntervalLabel(intervalSemitones()) ?? '??',
  )
  /** What a round asks for: "a Major 3rd", "an Octave", and in Pure
   *  tuning "a pure Major 3rd". */
  const roundAsk = (): string => {
    const label = intervalLabel()
    if (base.state().metrics.pureTuning === 1) return `a pure ${label}`
    return `${/^[AEIO]/.test(label) ? 'an' : 'a'} ${label}`
  }
  /** Where a pure target sits from the piano's note under the dot, "14
   *  cents low"; '' for the piano's own note, the unison and the octave. */
  const targetOffset = (): string => offsetInWords(targetCents())
  // The hint promises what setBase will play: the same difficulty and the
  // same intervals, read from the same launch.
  const launchedIntervals = () => droneLaunchIntervals()
  const promisedRounds = () =>
    plannedRounds(
      launchDifficulty(EXERCISE_DRONE_INTONATION),
      launchedIntervals(),
    )

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
      type={EXERCISE_DRONE_INTONATION}
      title="Drone Intonation"
      record={() => (tuning() === 'pure' ? 'pure' : '')}
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      resultStoppedEarly={() => runStoppedEarly(base.result()?.metrics)}
      voiceCapture={base.voiceCapture}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      icon={<IconDrone size={20} />}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <p>
            Sing intervals against a sustained drone. {TUNING_BRIEF[tuning()]}
          </p>
          <span class="idle-hint">
            {promisedRounds()} rounds ·{' '}
            <Show when={launchedIntervals()}>
              {(given) => `${droneIntervalNames(given())} · `}
            </Show>
            {tuningInWords(tuning())} · Drone: {startNote()}
          </span>
        </div>
      }
      demo={{
        play: () =>
          demo.play([exampleDrone(), exampleTop()], {
            noteMs: 1100,
          }),
        stop: demo.stop,
        line: exampleLine,
      }}
      idleSettings={
        <>
          <NoteDial
            label="Drone Note"
            notes={getNoteOptions(vocalRangePreset())}
            selected={startNote()}
            onChange={setStartNote}
          />
          <SetupChoices>
            <SetupChoice
              label="Tuning"
              options={DRONE_TUNING_OPTIONS}
              value={tuning()}
              onChange={pickTuning}
            />
          </SetupChoices>
        </>
      }
      onStart={() => void handleStart()}
      stopLabel="Stop"
      onStop={handleStop}
      tracker={{
        pitchHistory: base.pitchHistory,
        targetNoteMidi: () => base.state().metrics.currentMidi || undefined,
      }}
      activePhase={
        <div class="mirror-melody-phase">
          <span classList={{ listen: phase() === 1, sing: phase() === 2 }}>
            {phase() === 1 ? (
              <>
                <IconDrone size={16} /> Drone playing...
              </>
            ) : (
              <>
                <IconMic size={16} /> Sing {roundAsk()} above{' '}
                {midiToNoteName(droneMidi())}
              </>
            )}
          </span>
        </div>
      }
      activeContent={
        <>
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

          <div class="mirror-melody-viz exercise-tall-viz">
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
                <Show when={targetOffset()}>
                  {(offset) => <span class={styles.offset}>{offset()}</span>}
                </Show>
              </div>
            )}
          </div>

          {roundsCompleted() > 0 && lastRoundScore() > 0 && (
            <div class="mirror-melody-note-feedback">
              Last round: <span>{lastRoundScore()}%</span>
            </div>
          )}
        </>
      }
      resultSummary={
        <>
          <Show when={base.result()}>
            {(r) => (
              <>
                {tuningInWords(r().metrics.pureTuning === 1 ? 'pure' : 'piano')}
                <br />
              </>
            )}
          </Show>
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

export default DroneIntonationExercise
