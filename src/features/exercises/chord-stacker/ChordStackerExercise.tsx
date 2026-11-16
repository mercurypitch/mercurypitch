// ============================================================
// Chord Stacker: a chord heard a note at a time, each note sung back
// ============================================================
//
// Lesson 27's drill (SEASON-2 § 5.2 item 18). The setup chooses the chords,
// triads, the five sevenths it always had or both, and whether a run turns
// them over; a lesson's launch may name its own chords and positions for
// the visit. Merc names each round's chord as it plays ("C major, first
// inversion") and asks for its notes from the bottom up.

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { IconLayers, IconMic, IconMusic } from '@/components/exercise-icons'
import { NoteDial } from '@/components/NoteDial'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import { launchChords, launchInversions, launchTargetNote, } from '@/features/practice-intelligence/launch-override'
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
import { EXERCISE_CHORD_STACKER, runStoppedEarly } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import type { ChordSet, ChordStackerChord } from './chord-stacker-chords'
import { CHORD_SET_OPTIONS, CHORD_SETS, CHORD_STACKER_CHORDS, CHORD_STACKER_ROUNDS, chordName, chordNotes, chordQuality, chordSetFor, chordsInWords, chordsOfMask, chordStackerRecord, DEFAULT_CHORD_SET, isChordSet, isChordStackerChord, positionsInWords, } from './chord-stacker-chords'
import styles from './ChordStacker.module.css'
import { useChordStackerController } from './use-chord-stacker-controller'

interface ChordStackerExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

/** The Inversions picker's two chips. */
type InversionsChoice = 'off' | 'on'

const isInversionsChoice = (value: unknown): value is InversionsChoice =>
  value === 'off' || value === 'on'

const INVERSION_OPTIONS: readonly { value: InversionsChoice; label: string }[] =
  [
    { value: 'off', label: 'Off' },
    { value: 'on', label: 'On' },
  ]

const CHORDS_KEY = 'pitchperfect_chord_stacker_chords'
const INVERSIONS_KEY = 'pitchperfect_chord_stacker_inversions'

/**
 * The chords a launch (a lesson's slug) asked Chord Stacker to deal, those
 * on its own list, in the order given. Undefined when no launch asked, or
 * asked for none of them, so the run deals from the setup's set.
 */
export function chordStackerLaunchChords(): ChordStackerChord[] | undefined {
  const named = launchChords(EXERCISE_CHORD_STACKER)?.filter(
    isChordStackerChord,
  )
  return named !== undefined && named.length > 0 ? named : undefined
}

/** "a major seventh", "an augmented": a quality with its article. */
const withArticle = (quality: string): string =>
  `${/^[aeiou]/i.test(quality) ? 'an' : 'a'} ${quality}`

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

  // The singer's choices persist. A lesson's launch opens the drill on its
  // own chords and positions for this visit without changing what was
  // saved, and a tap on a chip hands the choice back to the singer.
  const [savedSet, saveSet] = createPersistedSignal<ChordSet>(
    CHORDS_KEY,
    DEFAULT_CHORD_SET,
    { validator: isChordSet },
  )
  const [savedInversions, saveInversions] =
    createPersistedSignal<InversionsChoice>(INVERSIONS_KEY, 'off', {
      validator: isInversionsChoice,
    })
  const launched = untrack(chordStackerLaunchChords)
  const launchedTurns = untrack(() => launchInversions(EXERCISE_CHORD_STACKER))
  const [launchedChords, setLaunchedChords] = createSignal(launched)
  const [chordSet, setChordSet] = createSignal<ChordSet>(
    launched !== undefined ? chordSetFor(launched) : untrack(savedSet),
  )
  const [inversions, setInversions] = createSignal<InversionsChoice>(
    launchedTurns === undefined
      ? untrack(savedInversions)
      : launchedTurns
        ? 'on'
        : 'off',
  )
  const pickSet = (set: ChordSet): void => {
    setLaunchedChords(undefined)
    setChordSet(set)
    saveSet(set)
  }
  const pickInversions = (choice: InversionsChoice): void => {
    setInversions(choice)
    saveInversions(choice)
  }
  /** The chords a run deals from, and whether it turns them over. */
  const runChords = (): readonly ChordStackerChord[] =>
    launchedChords() ?? CHORD_SETS[chordSet()]
  const turnsOver = (): boolean => inversions() === 'on'

  const audioEngine = untrack(() => props.audioEngine)

  const practiceEngine = untrack(() => props.practiceEngine)
  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: () => ({ type: 'chord-stacker', targetNote: startNote() }),
  })

  /* eslint-disable solid/reactivity */
  const controller = useChordStackerController(base, props.audioEngine)
  /* eslint-enable solid/reactivity */

  const handleStart = async () => {
    controller.setBase(noteToMidi(startNote()), {
      chords: runChords(),
      inversions: turnsOver(),
    })
    if (!(await base.start())) return
    controller.startRounds()
  }

  const handleStop = () => {
    controller.stopRounds()
  }

  onCleanup(() => base.reset())

  // "Hear it first": Merc plays one example before the singer tries, the
  // first chord of the chosen set in root position.
  const demo = createNoteDemo(audioEngine)
  const exampleChord = (): ChordStackerChord => runChords()[0] ?? 'maj7'
  onCleanup(() => demo.stop())

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

  const metric = (key: string): number | undefined => base.state().metrics[key]
  const phase = () => metric('phase') ?? 0
  const currentMidi = () => metric('currentMidi') ?? 0
  const noteIndex = () => metric('noteIndex') ?? 0
  const chordLength = () => metric('chordLength') ?? 4
  const roundsCompleted = () => metric('roundsCompleted') ?? 0
  const totalRounds = () => metric('totalRounds') ?? CHORD_STACKER_ROUNDS
  const lastRoundScore = () => metric('lastRoundScore') ?? 0

  /** The round's chord by name: "C major, first inversion". */
  const roundChord = (): string => {
    const chord = CHORD_STACKER_CHORDS[metric('chordIndex') ?? -1]
    if (chord === undefined) return ''
    const position = metric('chordPosition') ?? -1
    return chordName(
      metric('rootMidi') ?? 60,
      chord,
      position >= 0 ? position : null,
    )
  }

  /** What the finished run dealt from, read off its own result. */
  const resultWords = (): string => {
    const m = base.result()?.metrics
    const chords = chordsOfMask(m?.chordMask ?? 0)
    if (chords.length === 0) return ''
    return `${chordsInWords(chords)} · ${positionsInWords(m?.inversions === 1)}`
  }

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
      record={() => chordStackerRecord(runChords(), turnsOver()).key}
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      resultStoppedEarly={() => runStoppedEarly(base.result()?.metrics)}
      voiceCapture={base.voiceCapture}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      icon={<IconLayers size={20} />}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <p>
            Hear a chord one note at a time, from the bottom note up, then sing
            each note back on its own.
          </p>
          <span class="idle-hint">
            {CHORD_STACKER_ROUNDS} chords · {chordsInWords(runChords())} ·{' '}
            {positionsInWords(turnsOver())}
          </span>
        </div>
      }
      demo={{
        play: () =>
          demo.play(chordNotes(noteToMidi(startNote()), exampleChord()), {
            noteMs: 520,
            gapMs: 80,
          }),
        stop: demo.stop,
        line: () =>
          `Listen: ${withArticle(chordQuality(exampleChord()))} chord, up from ${startNote()}.`,
      }}
      idleSettings={
        <>
          <NoteDial
            label="Root Note"
            notes={getNoteOptions(vocalRangePreset())}
            selected={startNote()}
            onChange={setStartNote}
          />
          <SetupChoices>
            <SetupChoice
              label="Chords"
              options={CHORD_SET_OPTIONS}
              value={chordSet()}
              onChange={pickSet}
            />
            <SetupChoice
              label="Inversions"
              options={INVERSION_OPTIONS}
              value={inversions()}
              onChange={pickInversions}
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
                <IconMusic size={16} /> Listen: {roundChord()}
              </>
            ) : (
              <>
                <IconMic size={16} /> Sing note {noteIndex() + 1} of{' '}
                {chordLength()}: {midiToNoteName(currentMidi())}
              </>
            )}
          </span>
        </div>
      }
      activeContent={
        <>
          <Show when={roundChord()}>
            {(name) => (
              <div class={styles.chordName} data-testid="chord-stacker-chord">
                {name()}
              </div>
            )}
          </Show>
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
          <Show when={resultWords()}>
            {(words) => (
              <span class={styles.resultWords}>
                {words()}
                <br />
              </span>
            )}
          </Show>
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
