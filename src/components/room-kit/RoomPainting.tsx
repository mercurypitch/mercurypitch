// ============================================================
// RoomPainting: a room's painted backdrop, upright and on its side
// ============================================================
//
// The Ear rooms paint their worlds (docs/plans/ear-rooms.md): an upright
// plate, and its landscape twin for a screen held on its side. The room
// keeps its drawing until the plate has loaded, and draws the exercise over
// it either way. The plate covers the room and is pinned at one point of
// it (`pin`, CSS object-position), so however a screen crops it, that point
// of the painting stays where the room's own layout puts it: the lake's
// shore under the lamps, the valley's moon over the cliffs.
//
// Which plate shows is the picture's own choice, the screen's orientation
// (LANDSCAPE_MEDIA), not the room's shape. The room hears whether the plate
// loaded (`onLoad`) and decides when its drawing rests.

import type { JSX } from 'solid-js'
import { onMount } from 'solid-js'
import styles from './RoomPainting.module.css'

/** When the picture shows its landscape plate: its `<source>`'s media. */
export const LANDSCAPE_MEDIA = '(orientation: landscape)'

/** A painted backdrop's two plates, as URLs. */
export interface RoomPlates {
  readonly portrait: string
  readonly landscape: string
}

export interface RoomPaintingProps {
  plates: RoomPlates
  /** The point of the room the crop keeps in place: CSS object-position. */
  pin: string
  /** The plate has loaded (true), or will not (false). */
  onLoad: (loaded: boolean) => void
  /** Shown: the room's drawing rests under it. */
  shown: boolean
  /** The room's own class for the picture: its place, a dimming. */
  class?: string
  testId: string
}

export function RoomPainting(props: RoomPaintingProps): JSX.Element {
  let img: HTMLImageElement | undefined
  onMount(() => {
    // A plate the page already held has loaded before its handler could
    // hear it.
    if (img?.complete === true && img.naturalWidth > 0) props.onLoad(true)
  })
  return (
    <picture
      class={`${styles.painting} ${props.class ?? ''}`}
      classList={{ [styles.shown]: props.shown }}
    >
      <source media={LANDSCAPE_MEDIA} srcset={props.plates.landscape} />
      <img
        ref={img}
        class={styles.image}
        src={props.plates.portrait}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ 'object-position': props.pin }}
        onLoad={() => props.onLoad(true)}
        onError={() => props.onLoad(false)}
        data-testid={props.testId}
      />
    </picture>
  )
}
