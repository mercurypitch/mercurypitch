// ============================================================
// The exercise picker: every premium exercise, one card each
// ============================================================
//
// A kit Sheet the Sing room owns, as it owns its song and take sheets. The
// head is the Karaoke library's (a title and a 44 px close); the cards are
// its rows grown to two lines, so a card can say what the exercise is.
//
// The last exercise opened is marked, not moved: catalogue order stays put,
// so a card is where it was the last time. Beside its name a card names the
// level the exercises are at (the accuracy tier, exercise-level.ts), picked
// in the exercise or in Settings. A card's third line says one thing a
// singer cannot see from its name: that Merc sings it first (only when its
// demo will play by itself), or the best on the note it opens on.
//
// A tap closes the sheet and hands the id to the room, which winds down
// whatever is running before the exercise opens over it.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { Volume2 } from '@/components/icons'
import { Sheet } from '@/components/mobile/Sheet'
import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import { exerciseLevel, exerciseLevelName } from '@/stores/exercise-level'
import type { PremiumExercise } from './catalogue'
import { EXERCISE_CATALOGUE } from './catalogue'
import { lastExercise } from './last-exercise'
import styles from './premium-exercises.module.css'

export interface ExercisePickerProps {
  isOpen: boolean
  close: () => void
  /** A card: the sheet has closed, open this exercise. */
  onPick: (id: PremiumExerciseId) => void
}

const CloseGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </svg>
)

/** "Best 9.4 s on A3", or null with no best on a remembered note. */
function bestLine(exercise: PremiumExercise): string | null {
  const best = exercise.progress()
  const note = exercise.note()
  return best === null || note === null ? null : `${best} on ${note}`
}

const Card: Component<{
  exercise: PremiumExercise
  onPick: (id: PremiumExerciseId) => void
}> = (props) => {
  const current = (): boolean => lastExercise() === props.exercise.id
  return (
    <li class={styles.cardItem}>
      <button
        type="button"
        class={styles.card}
        classList={{ [styles.cardCurrent]: current() }}
        aria-current={current() ? 'true' : undefined}
        onClick={() => props.onPick(props.exercise.id)}
        data-testid="sing-exercise-card"
        data-exercise={props.exercise.id}
      >
        <span class={styles.cardArt} aria-hidden="true">
          <Dynamic component={props.exercise.Glyph} />
        </span>
        <span class={styles.cardText}>
          <span class={styles.cardHead}>
            <span class={styles.cardTitle}>{props.exercise.name}</span>
            <span class={styles.cardLevel} data-testid="sing-exercise-level">
              {exerciseLevelName(exerciseLevel())}
            </span>
          </span>
          <span class={styles.cardLine}>{props.exercise.line}</span>
          <Show
            when={props.exercise.demoAutoPlays()}
            fallback={
              <Show when={bestLine(props.exercise)}>
                {(line) => (
                  <span
                    class={styles.cardMeta}
                    data-testid="sing-exercise-meta"
                  >
                    {line()}
                  </span>
                )}
              </Show>
            }
          >
            <span class={styles.cardMeta} data-testid="sing-exercise-meta">
              <Volume2 />
              Merc sings it first
            </span>
          </Show>
        </span>
      </button>
    </li>
  )
}

export const ExercisePicker: Component<ExercisePickerProps> = (props) => {
  const pick = (id: PremiumExerciseId): void => {
    props.close()
    props.onPick(id)
  }

  return (
    <Sheet
      isOpen={props.isOpen}
      close={() => props.close()}
      ariaLabel="Exercises"
      snap="content"
    >
      <div class={styles.picker} data-testid="sing-exercise-picker">
        <div class={styles.sheetHead}>
          <h2 class={styles.sheetTitle}>Exercises</h2>
          <button
            type="button"
            class={styles.sheetClose}
            aria-label="Close"
            onClick={() => props.close()}
            data-testid="sing-exercise-close"
          >
            <CloseGlyph />
          </button>
        </div>
        <ul class={styles.cards}>
          <For each={EXERCISE_CATALOGUE}>
            {(exercise) => <Card exercise={exercise} onPick={pick} />}
          </For>
        </ul>
      </div>
    </Sheet>
  )
}
