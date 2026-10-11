// ============================================================
// The Sing screen's way into the exercises: the last one, and all of them
// ============================================================
//
// One line in the Sing room's own column: at rest above the capsule, in a
// free run between the stage and the shell's transport. It copies the
// session pill's anatomy (44 px of glass, a 32 px accent disc), so going
// back to what you did last reads the same wherever it appears. The two
// never share a screen: the shell lets go of a parked run when the Sing
// room comes on screen.
//
// With a last exercise, the pill opens it and the 44 px door beside it
// opens the picker. With none, one labelled pill, "Exercises", opens the
// picker. Either way the row is one line high.
//
// The pill's accessible name opens with its visible words, verbatim, and
// then says what a tap does (WCAG 2.5.3): the app ships voice control, and
// a name that paraphrased the pill would leave it unspeakable.
//
// Until the room has arrived (Sing is the tab on screen) the row is drawn
// but takes no tap, as the capsule does, and it shows: it dims to half (the
// module's [aria-disabled] rule). `aria-disabled` rather than `disabled`, so
// it keeps its place in the focus order; a screen reader announces it as
// unavailable.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { ListRows } from '@/components/icons'
import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import type { PremiumExercise } from './catalogue'
import { catalogueEntry } from './catalogue'
import { PlayGlyph } from './glyphs'
import { lastExercise } from './last-exercise'
import styles from './premium-exercises.module.css'

export interface ExerciseRowProps {
  /**
   * The room has not arrived: the row is drawn dimmed, and no tap does
   * anything.
   */
  disabled: boolean
  /** The pill: open this exercise. */
  onOpen: (id: PremiumExerciseId) => void
  /** The door, or the lone "Exercises" pill: open the picker. */
  onBrowse: () => void
}

/** "Long note · A3. Best 9.4 s. Open your last exercise" */
function pillName(exercise: PremiumExercise): string {
  const note = exercise.note()
  const best = exercise.progress()
  const shown = note === null ? exercise.name : `${exercise.name} · ${note}`
  return `${shown}. ${best === null ? '' : `${best}. `}Open your last exercise`
}

export function ExerciseRow(props: ExerciseRowProps): JSX.Element {
  const last = (): PremiumExercise | null => {
    const id = lastExercise()
    return id === null ? null : catalogueEntry(id)
  }
  const quiet = (): 'true' | undefined => (props.disabled ? 'true' : undefined)
  const browse = (): void => {
    if (!props.disabled) props.onBrowse()
  }

  return (
    <div class={styles.row} data-testid="sing-exercise-row">
      <Show
        when={last()}
        fallback={
          <button
            type="button"
            class={styles.browse}
            aria-disabled={quiet()}
            onClick={browse}
            data-testid="sing-exercise-browse"
          >
            <ListRows />
            Exercises
          </button>
        }
      >
        {(exercise) => (
          <>
            <button
              type="button"
              class={styles.pill}
              aria-label={pillName(exercise())}
              aria-disabled={quiet()}
              onClick={() => {
                if (!props.disabled) props.onOpen(exercise().id)
              }}
              data-testid="sing-exercise-pill"
              data-exercise={exercise().id}
            >
              <span class={styles.glyph} aria-hidden="true">
                <Dynamic component={exercise().Glyph} />
              </span>
              <span class={styles.label}>
                <span class={styles.title} data-testid="sing-exercise-title">
                  <span class={styles.name}>{exercise().name}</span>
                  {/* The separator rides with the note, as the session
                      pill's does with its state: the name may ellipsize,
                      the note may not. */}
                  <Show when={exercise().note()}>
                    {(note) => (
                      <span class={styles.note}>{` · ${note()}`}</span>
                    )}
                  </Show>
                </span>
                <Show when={exercise().progress()}>
                  {(best) => (
                    <span class={styles.best} data-testid="sing-exercise-best">
                      {best()}
                    </span>
                  )}
                </Show>
              </span>
              <span class={styles.play} aria-hidden="true">
                <PlayGlyph />
              </span>
            </button>
            <button
              type="button"
              class={styles.door}
              aria-label="All exercises"
              aria-disabled={quiet()}
              onClick={browse}
              data-testid="sing-exercise-door"
            >
              <ListRows />
            </button>
          </>
        )}
      </Show>
    </div>
  )
}
