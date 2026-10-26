// ============================================================
// TourChip — a page's tour, offered by its title
// ============================================================
//
// The corner toast ("New to Home? Take a quick tour.") landed over whatever
// the singer was looking at, on a phone over the controls at the foot of the
// screen, and went away by itself. The chip sits in the page's own flow
// instead: Merc's still, one line that starts the tour, and a Not now. It
// imports nothing from the app shell, so a standalone page such as Karaoke
// Night can show the same chip.
//
// It also says when it has been seen: at least half of it on screen, once
// (onSeen). A page can restore its scroll below the chip (Path does), and an
// offer nobody saw is not spent (TourChipHost). The watch lives here, in the
// chip's own chunk, so the pages that never offer a tour carry none of it.

import type { JSX } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import { X } from '@/components/icons'
import { stillFor } from '@/lib/merc/stills'
import styles from './TourChip.module.css'

/** What the chip says for a Merc tour (spec 8, the owner's badge-notice direction). */
export const MERC_TOUR_LINE = 'Merc can show you around, 30 s'

/** How much of the chip has to be on screen for it to count as seen. */
export const SEEN_SHARE = 0.5

export interface TourChipProps {
  /** The line that starts the tour; Merc's own unless a legacy tour says its own. */
  line?: string
  onStart: () => void
  onDismiss: () => void
  /**
   * Called once, when at least SEEN_SHARE of the chip has been on screen.
   * Where there is no IntersectionObserver, as it mounts.
   */
  onSeen?: () => void
}

export function TourChip(props: TourChipProps): JSX.Element {
  let root: HTMLDivElement | undefined
  onMount(() => {
    const seen = props.onSeen
    if (seen === undefined || root === undefined) return
    if (typeof IntersectionObserver === 'undefined') {
      seen()
      return
    }
    const watch = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.intersectionRatio >= SEEN_SHARE)) {
          return
        }
        watch.disconnect()
        seen()
      },
      { threshold: SEEN_SHARE },
    )
    watch.observe(root)
    onCleanup(() => watch.disconnect())
  })
  return (
    <div ref={root} class={styles.chip} data-testid="tour-chip">
      <button
        type="button"
        class={styles.start}
        onClick={() => props.onStart()}
      >
        <img
          class={styles.merc}
          src={stillFor('point')}
          alt=""
          width="28"
          height="28"
          draggable={false}
        />
        <span>{props.line ?? MERC_TOUR_LINE}</span>
      </button>
      <button
        type="button"
        class={styles.dismiss}
        aria-label="Not now"
        onClick={() => props.onDismiss()}
      >
        <X />
      </button>
    </div>
  )
}
