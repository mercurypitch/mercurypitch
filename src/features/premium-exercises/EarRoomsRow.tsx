// ============================================================
// The Ear rooms, on the Ear Lab with Merc's tab
// ============================================================
//
// The same rooms as the "With Merc" row (EarMercRow.tsx), drawn for the
// native tab (features/ear-lab/merc): a heading that names them and says
// they are Premium, and a card each with its glyph, its name and its one
// line. No best and no level on the card: the tab's numbers are the
// bench's, and a room keeps its own.

import type { JSX } from 'solid-js'
import { createUniqueId, For, Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import type { PremiumExercise } from './catalogue'
import { catalogueGroups } from './catalogue'
import styles from './ear-rooms-row.module.css'

export interface EarRoomsRowProps {
  /** Open an Ear room. */
  onOpen: (id: PremiumExerciseId) => void
}

function earRooms(): readonly PremiumExercise[] {
  return catalogueGroups().find((group) => group.id === 'ear')?.exercises ?? []
}

export function EarRoomsRow(props: EarRoomsRowProps): JSX.Element {
  const headingId = `ear-rooms-${createUniqueId()}`
  return (
    <Show when={earRooms().length > 0}>
      <section
        class={styles.row}
        aria-labelledby={headingId}
        data-testid="ear-rooms-row"
      >
        <div class={styles.head}>
          <h2 id={headingId} class={styles.title}>
            Ear rooms
          </h2>
          <span class={styles.tag}>Premium</span>
        </div>
        <ul class={styles.cards}>
          <For each={earRooms()}>
            {(exercise) => (
              <li>
                <button
                  type="button"
                  class={styles.card}
                  onClick={() => props.onOpen(exercise.id)}
                  data-testid="ear-rooms-card"
                  data-exercise={exercise.id}
                >
                  <span class={styles.art} aria-hidden="true">
                    <Dynamic component={exercise.Glyph} />
                  </span>
                  <span class={styles.text}>
                    <span class={styles.name}>{exercise.name}</span>
                    <span class={styles.line}>{exercise.line}</span>
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
