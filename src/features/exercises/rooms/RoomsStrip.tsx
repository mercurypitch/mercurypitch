// ============================================================
// RoomsStrip: the rooms, at the top of the web's Exercises tab
// ============================================================
//
// One card a room: a picture cut from the room itself, its name, the
// catalogue's line about it, and what the native picker's card says under
// that (its best, or that Merc sings it first). A card opens the room over
// the whole window (WebRoomHost.tsx).

import type { JSX } from 'solid-js'
import { For, onMount, Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { Volume2 } from '@/components/icons'
import { bestLine } from '@/features/premium-exercises/catalogue'
import { EXERCISE_ECHO_STARS, EXERCISE_HARMONY_LAKE, EXERCISE_HOME_NOTE_LIGHTHOUSE, EXERCISE_LEAP_CLIFFS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, } from '@/lib/domain/exercise-contracts'
import echoArt from './art/echo.webp'
import harmonyArt from './art/harmony.webp'
import homeNoteArt from './art/home-note.webp'
import leapArt from './art/leap.webp'
import lipRollArt from './art/lip-roll.webp'
import longNoteArt from './art/long-note.webp'
import ngSlidesArt from './art/ng-slides.webp'
import styles from './RoomsStrip.module.css'
import type { WebRoomId } from './web-room-ids'
import type { WebRoom } from './web-room-list'
import { webRooms } from './web-room-list'

/** A card's picture: a frame of the room, or its painting. */
const ART: Readonly<Record<WebRoomId, string>> = {
  [EXERCISE_LONG_NOTE_LANTERN]: longNoteArt,
  [EXERCISE_ECHO_STARS]: echoArt,
  [EXERCISE_LIP_ROLL_BAY]: lipRollArt,
  [EXERCISE_NG_SLIDES_BRIDGE]: ngSlidesArt,
  [EXERCISE_HOME_NOTE_LIGHTHOUSE]: homeNoteArt,
  [EXERCISE_LEAP_CLIFFS]: leapArt,
  [EXERCISE_HARMONY_LAKE]: harmonyArt,
}

/**
 * The room the singer last opened from here. The tab draws the room in the
 * list's place, so the list is new when they come back: the focus goes to
 * the card they left by, once, and not to the top of the page.
 */
let lastOpened: WebRoomId | null = null

export interface RoomsStripProps {
  /** The singer picked a room. */
  onOpen: (id: WebRoomId) => void
}

const Card = (props: {
  room: WebRoom
  onOpen: (id: WebRoomId) => void
}): JSX.Element => (
  <li class={styles.item}>
    <button
      type="button"
      class={styles.card}
      onClick={() => props.onOpen(props.room.id)}
      data-testid="exercise-room-card"
      data-room={props.room.id}
    >
      <span class={styles.art}>
        <img
          src={ART[props.room.id]}
          alt=""
          width="560"
          height="350"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </span>
      <span class={styles.text}>
        <span class={styles.name}>
          <span class={styles.glyph} aria-hidden="true">
            <Dynamic component={props.room.entry.Glyph} />
          </span>
          {props.room.entry.name}
        </span>
        <span class={styles.line}>{props.room.entry.line}</span>
        <Show
          when={props.room.entry.demoAutoPlays()}
          fallback={
            <Show when={bestLine(props.room.entry)}>
              {(best) => <span class={styles.meta}>{best()}</span>}
            </Show>
          }
        >
          <span class={styles.meta}>
            <Volume2 />
            Merc sings it first
          </span>
        </Show>
      </span>
    </button>
  </li>
)

export default function RoomsStrip(props: RoomsStripProps): JSX.Element {
  let list: HTMLUListElement | undefined

  onMount(() => {
    if (lastOpened === null) return
    const card = list?.querySelector<HTMLElement>(`[data-room="${lastOpened}"]`)
    lastOpened = null
    card?.focus({ preventScroll: true })
  })

  const open = (id: WebRoomId): void => {
    lastOpened = id
    props.onOpen(id)
  }

  return (
    <section
      class={styles.rooms}
      aria-labelledby="exercise-rooms-title"
      data-testid="exercise-rooms"
    >
      <div class={styles.head}>
        <h3 id="exercise-rooms-title" class={styles.title}>
          Sing with Merc
        </h3>
        <p class={styles.lead}>
          Each exercise is a place of its own. Merc shows you how, and it lights
          up as you sing.
        </p>
      </div>
      <ul ref={list} class={styles.cards}>
        <For each={webRooms()}>
          {(room) => <Card room={room} onOpen={open} />}
        </For>
      </ul>
    </section>
  )
}
