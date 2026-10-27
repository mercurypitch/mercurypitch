// ============================================================
// The Ear Lab's way into the Ear rooms: "With Merc", over the bench
// ============================================================
//
// The Ear Lab is a measuring bench: every drill on it is free and reads a
// threshold or a rating. The Ear rooms are Merc's: guided, premium, and
// built on the voice (docs/plans/ear-rooms.md). This row sits at the top of
// the bench on the phone and opens them, one card each, from the
// catalogue's Ear group, so a new Ear room is one catalogue entry and no
// change here.
//
// Each card is the picker's (ExercisePicker.tsx): the glyph, the name, its
// line, and the best at the singer's level once there is one.

import type { JSX } from 'solid-js'
import { createUniqueId, For, Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import { exerciseLevel, exerciseLevelName } from '@/stores/exercise-level'
import type { PremiumExercise } from './catalogue'
import { catalogueGroups } from './catalogue'
import styles from './premium-exercises.module.css'

export interface EarMercRowProps {
  /** Open an Ear room. */
  onOpen: (id: PremiumExerciseId) => void
}

/** The Ear rooms, in catalogue order. */
function earRooms(): readonly PremiumExercise[] {
  return catalogueGroups().find((group) => group.id === 'ear')?.exercises ?? []
}

export function EarMercRow(props: EarMercRowProps): JSX.Element {
  const headingId = `ear-merc-${createUniqueId()}`
  return (
    <Show when={earRooms().length > 0}>
      <section
        class={styles.earRow}
        aria-labelledby={headingId}
        data-testid="ear-merc-row"
      >
        <h2 id={headingId} class={styles.earKicker}>
          With Merc
        </h2>
        <ul class={styles.cards}>
          <For each={earRooms()}>
            {(exercise) => (
              <li class={styles.cardItem}>
                <button
                  type="button"
                  class={styles.card}
                  onClick={() => props.onOpen(exercise.id)}
                  data-testid="ear-merc-card"
                  data-exercise={exercise.id}
                >
                  <span class={styles.cardArt} aria-hidden="true">
                    <Dynamic component={exercise.Glyph} />
                  </span>
                  <span class={styles.cardText}>
                    <span class={styles.cardHead}>
                      <span class={styles.cardTitle}>{exercise.name}</span>
                      <span class={styles.cardLevel}>
                        {exerciseLevelName(exerciseLevel())}
                      </span>
                    </span>
                    <span class={styles.cardLine}>{exercise.line}</span>
                    <Show when={exercise.progress()}>
                      {(best) => (
                        <span
                          class={styles.cardMeta}
                          data-testid="ear-merc-best"
                        >
                          {best()}
                        </span>
                      )}
                    </Show>
                  </span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  )
}
