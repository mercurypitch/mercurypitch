// ============================================================
// TourChip — a page's tour, offered by its title
// ============================================================
//
// The corner toast ("New to Home? Take a quick tour.") landed over whatever
// the singer was looking at, on a phone over the controls at the foot of the
// screen, and went away by itself. The chip is Merc's still, one line that
// starts the tour, and a Not now. It imports nothing from the app shell, so
// a standalone page such as Karaoke Night can show the same chip.
//
// Given a room (its page's column, and a bar over it), it floats: it stands
// where nothing is, so it covers no text, control or stage, and showing it
// or taking it down moves nothing (chip-float.ts, by chip-place.ts's rule).
// Where its line does not fit it shrinks to Merc and a short line, and where
// that does not either, to Merc alone. Its start button keeps the whole line
// as its name in every form, so a screen reader hears what it always has and
// the short line is part of the name it reads (WCAG 2.5.3). It stays first
// in its column's order, where the keyboard has always found it, and it
// takes no focus by itself.
//
// It also says when it has been seen: at least half of it on screen, once
// (onSeen). A page can restore its scroll below the chip (Path does), and an
// offer nobody saw is not spent (TourChipHost). The watch lives here, in the
// chip's own chunk, so the pages that never offer a tour carry none of it.

import type { JSX } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { X } from '@/components/icons'
import { stillFor } from '@/lib/merc/stills'
import type { ChipRoomSource } from './chip-float'
import { floatChip } from './chip-float'
import type { ChipForm } from './chip-place'
import styles from './TourChip.module.css'

/** What the chip says for a Merc tour (spec 8, the owner's badge-notice direction). */
export const MERC_TOUR_LINE = 'Merc can show you around, 30 s'
/** Merc's line where it does not fit: words of it, so it stays the button's name. */
export const MERC_TOUR_SHORT = 'Show you around'

export type { ChipRoomSource } from './chip-float'

/** How much of the chip has to be on screen for it to count as seen. */
export const SEEN_SHARE = 0.5

export interface TourChipProps {
  /**
   * The line that starts the tour; Merc's own unless the offer says its own:
   * a legacy tour's, or Karaoke Night's, whose tour sings the demo.
   */
  line?: string
  /**
   * The few words the chip shrinks to where its line does not fit: words of
   * the line, which stays the button's name. Merc's own unless given; a line
   * given without one does not shrink to words, only to Merc.
   */
  short?: string
  /** Where it floats. Without one it stands in its parent's flow. */
  room?: ChipRoomSource
  onStart: () => void
  onDismiss: () => void
  /**
   * Called once, when at least SEEN_SHARE of the chip has been on screen.
   * Where there is no IntersectionObserver, as it mounts.
   */
  onSeen?: () => void
}

/** Calls `seen` once at least SEEN_SHARE of `el` has been on screen. */
function watchSeen(el: Element, seen: () => void): void {
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
  watch.observe(el)
  onCleanup(() => watch.disconnect())
}

export function TourChip(props: TourChipProps): JSX.Element {
  let root: HTMLDivElement | undefined
  const [form, setForm] = createSignal<ChipForm>('full')
  const line = (): string => props.line ?? MERC_TOUR_LINE
  const short = (): string | undefined =>
    props.short ?? (props.line === undefined ? MERC_TOUR_SHORT : undefined)
  // Whether it has been on screen: until it has, a page that scrolls it
  // away (Path restoring its place) has it placed where the page now is.
  let seenYet = false
  onMount(() => {
    const el = root
    if (el === undefined) return
    // Placed before it is watched, so it is seen where it stands.
    const room = props.room
    if (room !== undefined) {
      const hasShort = short() !== undefined
      onCleanup(
        floatChip(el, { room, onForm: setForm, hasShort, seen: () => seenYet }),
      )
    }
    const onSeen = props.onSeen
    if (onSeen === undefined && room === undefined) return
    watchSeen(el, () => {
      seenYet = true
      onSeen?.()
    })
  })
  return (
    <div
      ref={root}
      class={styles.chip}
      data-testid="tour-chip"
      data-floating={props.room === undefined ? undefined : ''}
    >
      <button
        type="button"
        class={styles.start}
        aria-label={form() === 'full' ? undefined : line()}
        title={form() === 'full' ? undefined : line()}
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
        <span class={styles.line}>{line()}</span>
        <Show when={short()}>
          {(words) => (
            <span class={styles.short} aria-hidden="true">
              {words()}
            </span>
          )}
        </Show>
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
