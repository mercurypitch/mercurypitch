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

import type { JSX } from 'solid-js'
import { X } from '@/components/icons'
import { stillFor } from '@/lib/merc/stills'
import styles from './TourChip.module.css'

/** What the chip says for a Merc tour (spec 8, the owner's badge-notice direction). */
export const MERC_TOUR_LINE = 'Merc can show you around, 30 s'

export interface TourChipProps {
  /** The line that starts the tour; Merc's own unless a legacy tour says its own. */
  line?: string
  onStart: () => void
  onDismiss: () => void
}

export function TourChip(props: TourChipProps): JSX.Element {
  return (
    <div class={styles.chip} data-testid="tour-chip">
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
