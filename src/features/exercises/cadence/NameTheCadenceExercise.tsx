// ============================================================
// Name the Cadence: hear a phrase end, and name how it ends
// ============================================================
//
// Lesson 28's drill (SEASON-2 § 5.2 item 19): the key's own chord, then
// two chords, and four names to choose from. It runs on the shell every
// drill runs on, and like Read the Note it opens no microphone: the singer
// listens, and taps.
//
// Merc asks, and after a miss he names the cadence, says its two chords and
// what they do, and the cadence plays once more under its name.

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { IconCadence } from '@/components/exercise-icons'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { ExerciseShell } from '../ExerciseShell'
import { EXERCISE_CADENCE, runStoppedEarly } from '../types'
import { createCadenceDemo, EXAMPLE_CADENCE, exampleLine } from './cadence-demo'
import { CADENCE_NAME, CADENCE_ROUNDS, CADENCE_SAYS, chordsOf, typesFor, typesLabel, } from './cadence-rounds'
import { CadenceChords } from './CadenceChords'
import styles from './NameTheCadence.module.css'
import { useCadenceController } from './use-cadence-controller'

interface NameTheCadenceExerciseProps {
  audioEngine: AudioEngine
  onBack: () => void
  autoStart?: boolean
}

const NameTheCadenceExercise: Component<NameTheCadenceExerciseProps> = (
  props,
) => {
  const audioEngine = untrack(() => props.audioEngine)
  const quiz = useCadenceController({
    playChord: (midis, ms) => {
      audioEngine.playChord(midis.map(midiToFrequency), ms).catch(() => {
        // A chord that cannot sound ends nothing: the round can be heard again.
      })
    },
    stopSound: () => audioEngine.stopTone(),
  })

  const level = () => launchDifficulty(EXERCISE_CADENCE)
  const types = () => typesFor(level())

  const handleStart = (): void => {
    quiz.start({ difficulty: level() })
  }

  onCleanup(() => quiz.reset())

  // "Hear it first": Merc plays one cadence and names it before a run. The
  // setup screen shows that cadence as a round's figure: each tile lights as
  // its chord sounds, and once the ending has been heard its two chords say
  // what they are.
  const [exampleSounding, setExampleSounding] = createSignal(-1)
  const [exampleHeard, setExampleHeard] = createSignal(false)
  const demo = createCadenceDemo({
    playChord: (midis, ms) => {
      audioEngine.playChord(midis.map(midiToFrequency), ms).catch(() => {
        // A chord that cannot sound ends nothing: the example runs on.
      })
    },
    stopSound: () => audioEngine.stopTone(),
    onSounding: (index, last) => {
      setExampleSounding(index)
      if (last) setExampleHeard(true)
    },
  })
  onCleanup(() => demo.stop())

  onMount(() => {
    if (props.autoStart === true && quiz.status() === 'idle') handleStart()
  })

  createEffect(() => {
    const r = quiz.result()
    if (r === null) return
    untrack(() => {
      recordExerciseResult({
        type: r.type,
        score: r.score,
        metrics: r.metrics,
        completedAt: r.completedAt,
      })
      updateDifficultyFromEma(r.type)
    })
  })

  const tone = () => {
    const shown = quiz.feedback()
    return shown === null ? 'ask' : shown.right ? 'right' : 'wrong'
  }

  /** What Merc says: listen, the question, or the cadence and what it does. */
  const say = (): string => {
    const round = quiz.round()
    if (round === null) return ''
    const shown = quiz.feedback()
    if (shown === null) return quiz.heard() ? 'How does it end?' : 'Listen.'
    const told = `${CADENCE_NAME[round.type].toLowerCase()}: ${chordsOf(round)}, ${CADENCE_SAYS[round.type]}.`
    return shown.right ? `Yes, ${told}` : `That was ${told}`
  }

  const metrics = () => quiz.result()?.metrics

  return (
    <ExerciseShell
      type={EXERCISE_CADENCE}
      title="Name the Cadence"
      status={quiz.status}
      currentScore={quiz.score}
      resultScore={() => quiz.result()?.score ?? null}
      resultStoppedEarly={() => runStoppedEarly(quiz.result()?.metrics)}
      micless
      onBack={() => props.onBack()}
      icon={<IconCadence size={20} />}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <p>
            A phrase ends on two chords: its cadence. Hear the key's own chord,
            then the ending, and name it. Nothing listens here.
          </p>
          <span class="idle-hint">
            {CADENCE_ROUNDS} cadences · {typesLabel(types())}
          </span>
        </div>
      }
      demo={{
        play: () => demo.play(),
        stop: demo.stop,
        line: () => exampleLine(),
      }}
      idleSettings={
        <div class={styles.preview}>
          <CadenceChords
            round={EXAMPLE_CADENCE}
            sounding={exampleSounding()}
            revealed={exampleHeard()}
            testId="cadence-preview"
          />
          <p class={styles.previewNote}>
            {exampleHeard()
              ? `${chordsOf(EXAMPLE_CADENCE)}: a ${CADENCE_NAME[EXAMPLE_CADENCE.type].toLowerCase()} cadence.`
              : "A round is three chords: the key's own, then the two of an ending."}
          </p>
        </div>
      }
      onStart={handleStart}
      stopLabel="Stop"
      onStop={() => quiz.stop()}
      activePhase={
        <div
          class={styles.say}
          classList={{
            [styles.sayRight]: tone() === 'right',
            [styles.sayWrong]: tone() === 'wrong',
          }}
          role="status"
          aria-live="polite"
        >
          {say()}
        </div>
      }
      activeContent={
        <Show when={quiz.round()}>
          {(round) => (
            <div class={styles.run}>
              <div class="mirror-melody-progress">
                <For each={quiz.rounds()}>
                  {(_, i) => (
                    <div
                      class="mirror-melody-dot-progress"
                      classList={{
                        active: i() === quiz.index(),
                        done: i() < quiz.marks().length,
                        [styles.dotRight]: quiz.marks()[i()] === true,
                        [styles.dotWrong]: quiz.marks()[i()] === false,
                      }}
                    />
                  )}
                </For>
              </div>

              {/* The figure: the three chords of the round, each lit while
                  it sounds. The key's own chord is named; the ending's two
                  keep their names until the answer is on show. */}
              <CadenceChords
                round={round()}
                sounding={quiz.sounding()}
                revealed={quiz.feedback() !== null}
                tone={tone()}
                testId="cadence-chords"
              />

              <div
                class={styles.answers}
                role="group"
                aria-label="Name the cadence"
                // Space on an answer gives the answer; it does not stop
                // the run, as the shell's Space would.
                data-exercise-native-space="true"
              >
                <For each={types()}>
                  {(type) => (
                    <button
                      type="button"
                      class={styles.answer}
                      classList={{
                        [styles.answerRight]:
                          quiz.feedback() !== null && round().type === type,
                        [styles.answerWrong]:
                          quiz.feedback()?.right === false &&
                          quiz.feedback()?.chosen === type,
                      }}
                      aria-disabled={!quiz.heard()}
                      data-cadence={type}
                      onClick={() => quiz.answer(type)}
                    >
                      {CADENCE_NAME[type]}
                    </button>
                  )}
                </For>
              </div>
              <button
                type="button"
                class={styles.again}
                data-exercise-native-space="true"
                disabled={quiz.feedback() !== null}
                onClick={() => quiz.replay()}
              >
                Hear it again
              </button>
            </div>
          )}
        </Show>
      }
      resultSummary={
        <>
          Named right: {metrics()?.correct ?? 0} of {metrics()?.answered ?? 0}
        </>
      }
      onTryAgain={() => {
        quiz.reset()
        handleStart()
      }}
      onChangeTarget={() => quiz.reset()}
    />
  )
}

export default NameTheCadenceExercise
