// ============================================================
// Read the Note: a note on the staff, named by its letter
// ============================================================
//
// Lessons 15 and 21's drill (SEASON-2 § 5.2 item 9): a note on the treble or
// the bass staff, up to two ledger lines, answered by its letter or on a
// piano's keys. It runs on the shell every drill runs on, so it has the
// stage, Merc, a level and a place in the history, but it is the one drill
// that opens no microphone: the singer reads, and taps.
//
// Merc asks, and after a miss he gives the answer: the note's letter and
// where it sits, in the words Lesson 15 uses for the staff.

import type { Component, JSX } from 'solid-js'
import { createEffect, For, onCleanup, onMount, Show, untrack } from 'solid-js'
import { IconStaff } from '@/components/exercise-icons'
import { getDifficulty, updateDifficultyFromEma, } from '@/features/practice-intelligence/difficulty-store'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { createPersistedSignal } from '@/lib/storage'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES, vocalRangePreset } from '@/stores/settings-store'
import { ExerciseShell } from '../ExerciseShell'
import { EXERCISE_NOTE_READING, runStoppedEarly } from '../types'
import type { ClefChoice } from './note-reading-rounds'
import { ANSWER_LETTERS, isAnswerLetter, isClefChoice, NOTE_READING_ROUNDS, placeOfRound, spanFor, spanLabel, } from './note-reading-rounds'
import styles from './NoteReading.module.css'
import { NoteStaff } from './NoteStaff'
import type { Clef, Letter } from './staff-kit'
import { useNoteReadingController } from './use-note-reading-controller'

interface NoteReadingExerciseProps {
  audioEngine: AudioEngine
  onBack: () => void
  autoStart?: boolean
}

/** How the singer answers: the seven letters, or a piano's seven white keys. */
export type AnswerStyle = 'letters' | 'keys'

const isAnswerStyle = (value: unknown): value is AnswerStyle =>
  value === 'letters' || value === 'keys'

const CLEF_KEY = 'pitchperfect_note_reading_clef'
const ANSWER_KEY = 'pitchperfect_note_reading_answer'

/** How long a note sounds once its answer is on show. */
const NOTE_MS = 600

/** The C under a tenor: a voice whose range starts lower reads the bass clef. */
const BASS_CLEF_BELOW_MIDI = 48

/**
 * The clef a voice meets first: the bass clef for a bass or a baritone, the
 * treble clef for every other voice, the tenor's included, whose parts are
 * written on it. The setup screen offers the other one, and both.
 */
export const clefForRange = (preset: VocalRangePreset): Clef =>
  VOCAL_RANGES[preset].lowMidi < BASS_CLEF_BELOW_MIDI ? 'bass' : 'treble'

const CLEF_OPTIONS: readonly { value: ClefChoice; label: string }[] = [
  { value: 'treble', label: 'Treble' },
  { value: 'bass', label: 'Bass' },
  { value: 'both', label: 'Both' },
]

const ANSWER_OPTIONS: readonly { value: AnswerStyle; label: string }[] = [
  { value: 'letters', label: 'Letters' },
  { value: 'keys', label: 'Piano keys' },
]

const CLEF_HINT: Readonly<Record<ClefChoice, string>> = {
  treble: 'Treble staff',
  bass: 'Bass staff',
  both: 'Treble and bass staves',
}

/** The white keys with a black key at their right shoulder. */
const SHARP_AFTER: ReadonlySet<Letter> = new Set(['C', 'D', 'F', 'G', 'A'])

interface ChoiceProps<T extends string> {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/** One of the setup screen's pickers: a label over a row of chips. */
function Choice<T extends string>(props: ChoiceProps<T>): JSX.Element {
  return (
    <div class={styles.choice} role="group" aria-label={props.label}>
      <span class={styles.choiceLabel}>{props.label}</span>
      <div class={styles.segments}>
        <For each={props.options}>
          {(option) => (
            <button
              type="button"
              class={styles.segment}
              classList={{ [styles.segmentOn]: props.value === option.value }}
              aria-pressed={props.value === option.value}
              onClick={() => props.onChange(option.value)}
            >
              {option.label}
            </button>
          )}
        </For>
      </div>
    </div>
  )
}

const NoteReadingExercise: Component<NoteReadingExerciseProps> = (props) => {
  const audioEngine = untrack(() => props.audioEngine)
  const [clef, setClef] = createPersistedSignal<ClefChoice>(
    CLEF_KEY,
    untrack(() => clefForRange(vocalRangePreset())),
    { validator: isClefChoice },
  )
  const [answerWith, setAnswerWith] = createPersistedSignal<AnswerStyle>(
    ANSWER_KEY,
    'letters',
    { validator: isAnswerStyle },
  )

  const quiz = useNoteReadingController({
    // The note is heard once it is named: the eye's answer, then the ear's.
    onNote: (midi) => {
      audioEngine.playNote(midiToFrequency(midi), NOTE_MS).catch(() => {
        // No sound is no reason to stop a reading drill.
      })
    },
  })

  const level = () => getDifficulty(EXERCISE_NOTE_READING)

  const handleStart = (): void => {
    quiz.start({ clef: clef(), difficulty: level() })
  }

  onCleanup(() => quiz.reset())

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

  // A letter typed is a letter tapped. Caught before the app's own keys,
  // and only while a note is up, so A to G mean nothing else during a run
  // and everything they meant before and after it.
  const onKey = (event: KeyboardEvent): void => {
    if (quiz.status() !== 'active') return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const letter = event.key.toUpperCase()
    if (!isAnswerLetter(letter)) return
    event.preventDefault()
    event.stopPropagation()
    quiz.answer(letter)
  }
  onMount(() => window.addEventListener('keydown', onKey, true))
  onCleanup(() => window.removeEventListener('keydown', onKey, true))

  const tone = () => {
    const shown = quiz.feedback()
    return shown === null ? 'ask' : shown.right ? 'right' : 'wrong'
  }

  /** What Merc says: the question, a yes, or the answer and where it sits. */
  const say = (): string => {
    const shown = quiz.feedback()
    const round = quiz.round()
    if (shown === null || round === null) return 'Which note is this?'
    return shown.right
      ? `Yes, ${shown.letter}.`
      : `That is ${shown.letter}: ${placeOfRound(round)}.`
  }

  const metrics = () => quiz.result()?.metrics

  return (
    <ExerciseShell
      type={EXERCISE_NOTE_READING}
      title="Read the Note"
      status={quiz.status}
      currentScore={quiz.score}
      resultScore={() => quiz.result()?.score ?? null}
      resultStoppedEarly={() => runStoppedEarly(quiz.result()?.metrics)}
      micless
      onBack={() => props.onBack()}
      icon={<IconStaff size={20} />}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <p>
            A note appears on the staff. Name it by its letter. Nothing listens
            here: you read, and tap.
          </p>
          <span class="idle-hint">
            {NOTE_READING_ROUNDS} notes · {CLEF_HINT[clef()]} ·{' '}
            {spanLabel(spanFor(level()))}
          </span>
        </div>
      }
      idleSettings={
        // Space on a chip presses the chip: the shell's own Space starts
        // the run from anywhere else on the page.
        <div class={styles.setup} data-exercise-native-space="true">
          <Choice
            label="Clef"
            options={CLEF_OPTIONS}
            value={clef()}
            onChange={setClef}
          />
          <Choice
            label="Answer with"
            options={ANSWER_OPTIONS}
            value={answerWith()}
            onChange={setAnswerWith}
          />
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
              <NoteStaff
                clef={round().clef}
                place={round().place}
                tone={tone()}
                name={quiz.feedback()?.letter}
              />
              <div
                class={styles.answers}
                classList={{ [styles.keys]: answerWith() === 'keys' }}
                role="group"
                aria-label="Name the note"
                // Space on an answer gives the answer; it does not stop
                // the run, as the shell's Space would.
                data-exercise-native-space="true"
              >
                <For each={ANSWER_LETTERS}>
                  {(letter) => (
                    <button
                      type="button"
                      class={styles.answer}
                      classList={{
                        [styles.sharpAfter]: SHARP_AFTER.has(letter),
                        [styles.answerRight]:
                          quiz.feedback()?.letter === letter,
                        [styles.answerWrong]:
                          quiz.feedback()?.right === false &&
                          quiz.feedback()?.chosen === letter,
                      }}
                      aria-label={letter}
                      data-letter={letter}
                      onClick={() => quiz.answer(letter)}
                    >
                      <span class={styles.answerName} aria-hidden="true">
                        {letter}
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </div>
          )}
        </Show>
      }
      resultSummary={
        <>
          Read right: {metrics()?.correct ?? 0} of {metrics()?.answered ?? 0}
          <Show when={(metrics()?.avgMs ?? 0) > 0}>
            {' '}
            · {((metrics()?.avgMs ?? 0) / 1000).toFixed(1)} s a note
          </Show>
        </>
      }
      onTryAgain={() => {
        quiz.reset()
        handleStart()
      }}
      onChangeTarget={() => quiz.reset()}
      changeTargetLabel="Change Clef"
    />
  )
}

export default NoteReadingExercise
