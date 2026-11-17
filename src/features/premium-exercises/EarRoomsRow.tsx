// ============================================================
// The Ear rooms, on the Ear Lab with Merc's tab
// ============================================================
//
// The same rooms as the "With Merc" row (EarMercRow.tsx), drawn for the
// native tab (features/ear-lab/merc): a heading that names them and says
// they are Premium, and a card each with its glyph, its name and its one
// line. Under the line, the room's best at the singer's level once it has
// one ("Best 5 of 6"), in the room's own light: the owner's ask of 1 Nov
// 2026. It is the best the picker's card shows, read from the entry each
// room keeps beside the catalogue (home-entry.ts, first-entry.ts,
// leap-entry.ts, harmony-entry.ts), so the tab and the room cannot
// disagree.
//
// The web's Ear Lab draws the same row (owner, 15 Nov 2026), with the rooms
// the web opens and no Premium tag: there they are free, and First note,
// whose songs are the native Karaoke's, is not among them
// (src/features/exercises/rooms/web-room-ids.ts).

import type { JSX } from 'solid-js'
import { createUniqueId, For, Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import { tasteLine } from '@/lib/free-taste'
import { tasteRunsUsed, tasteShows } from '@/stores/free-taste-store'
import type { PremiumExercise } from './catalogue'
import { catalogueGroups } from './catalogue'
import styles from './ear-rooms-row.module.css'

export interface EarRoomsRowProps {
  /** Open an Ear room. */
  onOpen: (id: PremiumExerciseId) => void
  /** The rooms this build opens, where that is fewer than the catalogue's
   *  Ear group: the web's. Every one of them where it is left out. */
  opens?: ((id: PremiumExerciseId) => boolean) | undefined
  /** The rooms are free here, so no Premium tag and no taste left: the
   *  web. */
  free?: boolean | undefined
}

function earRooms(
  opens: ((id: PremiumExerciseId) => boolean) | undefined,
): readonly PremiumExercise[] {
  const group =
    catalogueGroups().find((one) => one.id === 'ear')?.exercises ?? []
  return opens === undefined ? group : group.filter((one) => opens(one.id))
}

export function EarRoomsRow(props: EarRoomsRowProps): JSX.Element {
  const headingId = `ear-rooms-${createUniqueId()}`
  const rooms = () => earRooms(props.opens)
  return (
    <Show when={rooms().length > 0}>
      <section
        class={styles.row}
        aria-labelledby={headingId}
        data-testid="ear-rooms-row"
        data-tour="ear.rooms"
      >
        <div class={styles.head}>
          <h2 id={headingId} class={styles.title}>
            Ear rooms
          </h2>
          <Show when={props.free !== true}>
            <span class={styles.tag}>Premium</span>
          </Show>
        </div>
        <ul class={styles.cards}>
          <For each={rooms()}>
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
                    <Show when={exercise.progress()}>
                      {(best) => (
                        <span class={styles.best} data-testid="ear-rooms-best">
                          {best()}
                        </span>
                      )}
                    </Show>
                    <Show when={props.free !== true && tasteShows()}>
                      <span class={styles.best} data-testid="ear-rooms-taste">
                        {tasteLine(exercise.id, tasteRunsUsed(exercise.id))}
                      </span>
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
