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
// - A flex or grid column with a definite height. The question screens'
//   root is their scroll region and pulls itself 14px up over what sits
//   above it (`margin-top: -14px`, `height: calc(100% + 14px)`), so the
//   region's padding has room for the bubble's tail and the bubble still
//   sits where it would with no region (plan-chrome.module.css). In a plain
//   block box that margin collapses through the box and moves it, and an
//   indefinite height leaves the percentage at auto, so the root grows and
//   does not scroll. Merc is `flex: none` above the root inside the same
//   box, and the root shrinks to what he leaves; if he sits outside the
//   box, nothing may clip the box's top edge. The plan's region pulls up
//   the same 14px inside a flex root of its own, so its margin cannot
//   collapse, but it needs the same definite height and the same room
//   above.
// - On a phone, the box reaches the bottom edge of the screen and adds no
//   bottom padding of its own, so the screens own the room under their last
//   row, the home indicator's inset included. First Light drops its frame's
//   bottom padding for the plan beat as it does for the twin beat
//   (`.frame:has(> [data-beat='questions'])` and `.frame:has(> .twinBeat)`,
//   onboarding.module.css). The plan's ways on carry
//   `calc(12px + env(safe-area-inset-bottom, 0px))` under their buttons, and
//   a question screen's scroll region pads its end by
//   `env(safe-area-inset-bottom, 0px)` on top of its 6px, so the last row
//   and Next clear the home indicator. A frame that kept its padding would
//   stack it under both.
// - The room it lends. A scroll region clips 6px outside its content,
//   nearer than a glow fades out: a picked card's glow and Next's shadow
//   need about 31px, and a clip line inside that draws a hard edge along
//   them. Lending nothing is the default, and it leaves two visible cuts: a
//   picked card's glow at a phone's sides, and Next's shadow under an
//   overflowing Q3 on a short desktop window. So a host lends unless it has
//   no room (a box whose sides and bottom are the screen's edges needs
//   none). It lends the room beside and under its box where nothing clips
//   (the box stands in padding of the host's own, and the next clip out is
//   the screen's edge), by setting two custom properties on the box or an
//   ancestor. The regions reach out into that room, wider and padded by as
//   much, so their clip lines move out and the content does not move
//   (plan-chrome.module.css).
//   - Each property is a length with its unit: `0px`, never a bare `0`. A
//     bare 0 makes the chrome's calc() invalid, so the declarations that
//     read it (padding, margin, width) drop whole and the region collapses.
//   - `--pc-overhang-side` is the room for each side, one value for both.
//     With unequal room beside the box, lend the smaller.
//   - `--pc-overhang-end` is the room below. Only the questions' region
//     reaches there; the plan's region has its ways on under it.
//   - Lend only room that is empty and unclipped, and no more than the box
//     has, or the host's own scroller scrolls sideways or down: the regions
//     take that room in layout and catch the pointer there.
//   - A lend that stops short of the screen's edge leaves a fainter line,
//     where its clip line falls within about 25px of the card.
//   - Show me around's glow (PlanScreen.module.css:386 and :526) sits in the
//     plan's ways-on row, outside the region, so it gets no reach. Hovered
//     it runs 42px past its button, so a host must not clip within about
//     42px under its box.
//   - With neither set, both are 0px and nothing moves. First Light lends
//     its frame's 22px sides and its 40px bottom, none below on a phone
//     (onboarding.module.css).
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
