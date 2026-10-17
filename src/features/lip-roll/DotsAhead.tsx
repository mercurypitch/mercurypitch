// ============================================================
// The dots ahead of Merc, drawn again over him
// ============================================================
//
// Merc stands on the voice line, so on a climb the next dots run behind
// his body. The bay draws the dots under the voice and under him
// (BayScene.tsx); this draws them again over him, on his box's front half
// only: a window that follows his box, holding a copy of each wave's
// dotted path (an SVG <use> of it), moved back by the window's own move so
// every dot lands on itself. It sits under the near sea, as the dots do.
// Inside the window the dots also show over the voice and its bubbles.
//
// The copy reads the paths themselves, so a zoom that rebuilds them
// rebuilds it. Not placed at the result: the window stays where the run
// left it while the take pulls back and fades.

import type { JSX } from 'solid-js'
import { createUniqueId, For } from 'solid-js'
import type { MercBox } from './bay-layout'
import styles from './LipRollRoom.module.css'

export interface DotsAheadApi {
  /** Over his box, with the dots' layer translated `dotsX` px. */
  place: (box: MercBox, dotsX: number) => void
}

/** One id per wave's dotted path: the bay names its paths, the copy uses them. */
export function dotPathIds(waves: number): readonly string[] {
  const id = createUniqueId()
  return Array.from({ length: waves }, (_, k) => `${id}-dots-${k}`)
}

export interface DotsAheadProps {
  /** The dotted paths, by id (dotPathIds). */
  ids: readonly string[]
  /** His box's size, px: the window is its front half. */
  mercSize: number
  /** The dots' SVG, px, as the bay draws it. */
  width: number
  height: number
  onReady: (api: DotsAheadApi) => void
}

export function DotsAhead(props: DotsAheadProps): JSX.Element {
  let pane: HTMLDivElement | undefined
  let copy: HTMLDivElement | undefined
  // Handed over as it is made, not on mount: the bay places Merc from its
  // own onMount, which runs before this one's.
  // eslint-disable-next-line solid/reactivity -- read once, at creation
  props.onReady({
    place: (box, dotsX) => {
      if (pane === undefined || copy === undefined) return
      const x = Number((box.left + box.size / 2).toFixed(1))
      const y = Number(box.top.toFixed(1))
      pane.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`
      copy.style.transform = `translate3d(${(dotsX - x).toFixed(2)}px,${(-y).toFixed(1)}px,0)`
    },
  })
  return (
    <div
      ref={pane}
      class={styles.ahead}
      style={{
        width: `${(props.mercSize / 2).toFixed(1)}px`,
        height: `${props.mercSize.toFixed(1)}px`,
      }}
      data-testid="lip-dots-ahead"
    >
      <div ref={copy} class={styles.world}>
        <svg
          class={styles.dots}
          style={{
            width: `${props.width.toFixed(1)}px`,
            height: `${props.height}px`,
          }}
          viewBox={`0 0 ${props.width.toFixed(1)} ${props.height}`}
          aria-hidden="true"
        >
          <For each={props.ids}>{(id) => <use href={`#${id}`} />}</For>
        </svg>
      </div>
    </div>
  )
}
