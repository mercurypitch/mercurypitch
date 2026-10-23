// ============================================================
// PlanExits — the way back and the way out, in the top corners
// ============================================================
//
// Back (only when the host gives an onBack) and "Not now". The questions
// and the plan carry the same two buttons, so they sit in the same place on
// every screen and do not move from one to the next. They are a fragment, two
// buttons and no wrapper, and absolute: top 8px, left or right 14px, 44 px
// at least, z-index 2.
//
// What the host provides, for as long as the screens are up:
//
// - A positioned, height-bounded box that does not scroll and is not
//   transformed; each screen scrolls its own content. The buttons are placed
//   in the nearest positioned ancestor, so that box must be the size of the
//   screen, and the same box from the first question to the plan. Each screen
//   fills it and scrolls what does not fit inside itself, and the buttons
//   stay in the corners: an absolute child whose containing block is the
//   host's box is neither clipped nor scrolled by the screen. If the box
//   scrolled, the buttons would scroll away with the content; if it were
//   transformed, it would become the containing block (a transformed
//   ancestor does), so the buttons would sit on it while the transform lasts
//   and then jump to the next box. The screen's root, which holds the
//   buttons in the DOM, sets no `position` and no transform of its own, for
//   the same reason.
// - Merc directly above the screens. A question screen opens on Merc's
//   speech bubble, its tail pointing up, and the screens add no room above
//   it, so the host's one MercPresence goes directly above them. A host that
//   lays him over the screens leaves the room for him itself.
// - Nothing over the corners. The buttons carry z-index 2, above the screens
//   and Merc, so a host's layer must not sit above them in the corners.
//
// Render it after the screen in the DOM, so Tab reaches the answers before
// the way out; the corners are where the buttons sit on screen. It is a
// shared piece, so there is one copy of the placement, the 44 px floors and
// the labels.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { ChevronLeft } from '@/components/icons'
import styles from './PlanExits.module.css'

export interface PlanExitsProps {
  /** Back, top left. Given only where there is a screen to go back to. */
  onBack?: () => void
  /** Not now, top right. */
  onNotNow: () => void
}

export function PlanExits(props: PlanExitsProps): JSX.Element {
  return (
    <>
      <Show when={props.onBack !== undefined}>
        <button
          type="button"
          class={`${styles.exit} ${styles.back}`}
          aria-label="Back"
          onClick={() => props.onBack?.()}
        >
          <ChevronLeft />
        </button>
      </Show>
      <button
        type="button"
        class={`${styles.exit} ${styles.notNow}`}
        onClick={() => props.onNotNow()}
      >
        Not now
      </button>
    </>
  )
}
