// ============================================================
// Showcase — Merc hops along the real tab bar after the plan
// ============================================================
//
// "Show me around" on the plan (D6). The plan's host has closed by now; this
// draws Merc over the app, standing by one part of the tab bar at a time with
// a line about it (showcase-stops.ts), and then says it is over, done or
// skipped, so that start-showcase.ts can open the plan's Start here.
//
// - It waits. Nothing hops while `held()` (the cookie banner wants its
//   answer, spec 7): no stop shows, no timer runs and no tap moves on. Skip is
//   there from the start, so a singer who will not answer the banner yet is
//   not stuck behind Merc.
// - It moves on by itself after STOP_MS, or on a tap anywhere (the layer
//   takes the window's taps while it is up: the page under it is not for using
//   during the walk), on Enter or the right arrow; Escape and Skip end it. A
//   stop whose target is not on the page is passed over.
// - It hops. One Merc goes from stop to stop and his line follows him. Under
//   reduced motion nothing travels: each stop's Merc and line fade in where
//   they stand (`data-motion="fade"`).
// - Where it stands. Under a group of the top bar on a wide screen; above the
//   rail on a phone, Merc on the rail's edge over his tab and the line above
//   him, so neither covers the rail. The More stop opens the sheet with a tap
//   on More and Merc stands on its top edge; moving on closes it again, with
//   the Escape the sheet itself answers to. On a phone the line hangs from its
//   bottom edge (translateY(-100%)), so it stands clear of Merc from its first
//   frame, whatever its height; placed by its top, it needed its height
//   measured first, and covered Merc and the rail until it was (measured in
//   showcase.spec.ts). Its max-height keeps it inside the window's top.
// - Keys. Focus moves to the layer at the start, so the keys above work and no
//   key reaches the app's window shortcuts (Space would start playback). The
//   listener is native (`on:keydown`), as the coach layer's is
//   (src/tests/trap-key-handlers.test.ts).
// - No sound. Captions only (D11).

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { MercPresence } from '@/components/room-kit/MercPresence'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import type { MercState } from '@/lib/merc/constants'
import { stillFor } from '@/lib/merc/stills'
import { findTarget } from './find-target'
import styles from './Showcase.module.css'
import type { ShowcaseStop } from './showcase-stops'
import { STOP_MS } from './showcase-stops'

/** How long a hop takes, in ms: Merc wears his hop for it. */
export const HOP_MS = 420
/** How often a showing stop measures its target again, in ms. */
const TRACK_MS = 300
/** A target taller than this share of the window gets no ring. */
const RING_MAX_SHARE = 0.7

const MERC_WIDE = 56
const MERC_PHONE = 48
/** The ring stands this far outside its target. */
const RING_OUT = 8
const GAP = 6
const MARGIN = 12
/** A phone's line stands this far inside the window's edges. */
const EDGE = 8
const BUBBLE_MAX_W = 320

export type ShowcaseEnd = 'done' | 'skipped'

export interface ShowcaseProps {
  stops: readonly ShowcaseStop[]
  phone: boolean
  /** Something on top wants an answer first (the cookie banner): nothing hops. */
  held: () => boolean
  /** Over: the last stop is done, or the singer skipped. Called once. */
  onEnd: (result: ShowcaseEnd) => void
}

interface Box {
  top: number
  left: number
  width: number
  height: number
}

interface Spot {
  merc: { x: number; y: number }
  /**
   * The line's box: its left edge and width, and `y`, its top edge, or its
   * bottom edge when it stands `above` that (a phone's, over Merc).
   */
  bubble: { x: number; y: number; width: number; above: boolean }
}

const sameBox = (a: Box | null, b: Box | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height)

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), Math.max(low, high))

/** Where Merc and his line stand for a target at `box`. */
function spotFor(box: Box, phone: boolean, mercPx: number): Spot {
  const vw = window.innerWidth
  const centre = box.left + box.width / 2
  const mercX = clamp(centre - mercPx / 2, MARGIN, vw - mercPx - MARGIN)
  if (phone) {
    const mercY = box.top - RING_OUT - GAP - mercPx
    return {
      merc: { x: mercX, y: mercY },
      bubble: { x: EDGE, y: mercY - GAP, width: vw - 2 * EDGE, above: true },
    }
  }
  const mercY = box.top + box.height + RING_OUT + GAP
  const width = Math.min(BUBBLE_MAX_W, vw - 2 * MARGIN)
  return {
    merc: { x: mercX, y: mercY },
    bubble: {
      x: clamp(centre - width / 2, MARGIN, vw - width - MARGIN),
      y: mercY + mercPx + GAP,
      width,
      above: false,
    },
  }
}

const translate = (x: number, y: number): string =>
  `translate(${Math.round(x)}px, ${Math.round(y)}px)`

/** The line's box at `spot`: hung from its bottom edge when it stands above. */
function bubbleStyle(spot: Spot | null): JSX.CSSProperties {
  if (spot === null) {
    return { transform: translate(0, 0), width: `${BUBBLE_MAX_W}px` }
  }
  const { x, y, width, above } = spot.bubble
  if (!above) return { transform: translate(x, y), width: `${width}px` }
  return {
    transform: `${translate(x, y)} translateY(-100%)`,
    width: `${width}px`,
    'max-height': `${Math.max(0, Math.round(y) - EDGE)}px`,
  }
}

export function Showcase(props: ShowcaseProps): JSX.Element {
  const reduced = prefersReducedMotion()
  const mercPx = props.phone ? MERC_PHONE : MERC_WIDE
  const [index, setIndex] = createSignal(-1)
  const [box, setBox] = createSignal<Box | null>(null)
  const [hopping, setHopping] = createSignal(false)
  let layer: HTMLDivElement | undefined
  let over = false

  const stop = createMemo((): ShowcaseStop | null => {
    const at = index()
    return at < 0 ? null : (props.stops[at] ?? null)
  })

  /** What Merc stands by at `at`: what the stop opened, once it is open, else its target. */
  const standBy = (at: ShowcaseStop): HTMLElement | null =>
    (at.opens === undefined ? null : findTarget(at.opens)) ??
    findTarget(at.target)

  const measure = (): void => {
    const at = untrack(stop)
    const el = at === null ? null : standBy(at)
    const r = el?.getBoundingClientRect()
    const next =
      r === undefined
        ? null
        : { top: r.top, left: r.left, width: r.width, height: r.height }
    if (!sameBox(untrack(box), next)) setBox(next)
  }

  const finish = (result: ShowcaseEnd): void => {
    if (over) return
    over = true
    props.onEnd(result)
  }

  /** Closes what the stop on screen opened (More's sheet), if it is still open. */
  const leave = (): void => {
    const at = untrack(stop)
    if (at?.opens === undefined) return
    const opened = findTarget(at.opens)
    opened?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
  }

  /** Shows the first stop from `from` whose target is on the page; past the last, done. */
  const enter = (from: number): void => {
    for (let at = from; at < props.stops.length; at++) {
      const next = props.stops[at]
      const target = findTarget(next.target)
      if (target === null) continue
      if (next.opens !== undefined && findTarget(next.opens) === null) {
        target.click()
      }
      if (at > 0 && !reduced) setHopping(true)
      setIndex(at)
      measure()
      return
    }
    finish('done')
  }

  const next = (): void => {
    if (over || untrack(index) < 0 || props.held()) return
    leave()
    enter(untrack(index) + 1)
  }

  const skip = (): void => {
    if (over) return
    leave()
    finish('skipped')
  }

  // The first stop, once nothing is held.
  createEffect(
    on(props.held, (held) => {
      if (!held && !over && untrack(index) < 0) enter(0)
    }),
  )

  // On by itself after STOP_MS, while nothing is held.
  createEffect(
    on([index, props.held], ([at, held]) => {
      if (at < 0 || held) return
      const timer = setTimeout(next, STOP_MS)
      onCleanup(() => clearTimeout(timer))
    }),
  )

  // His hop lasts HOP_MS.
  createEffect(
    on(hopping, (on) => {
      if (!on) return
      const timer = setTimeout(() => setHopping(false), HOP_MS)
      onCleanup(() => clearTimeout(timer))
    }),
  )

  // A showing stop follows its target as the page moves.
  createEffect(
    on(index, (at) => {
      if (at < 0) return
      measure()
      const timer = setInterval(measure, TRACK_MS)
      window.addEventListener('resize', measure)
      window.addEventListener('scroll', measure, {
        capture: true,
        passive: true,
      })
      onCleanup(() => {
        clearInterval(timer)
        window.removeEventListener('resize', measure)
        window.removeEventListener('scroll', measure, { capture: true })
      })
    }),
  )

  const onKey = (event: KeyboardEvent): void => {
    // While the walk is up, no key reaches the app's shortcuts.
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      skip()
    } else if (
      event.key === 'ArrowRight' ||
      (event.key === 'Enter' && event.target === layer)
    ) {
      event.preventDefault()
      next()
    }
  }

  onMount(() => {
    queueMicrotask(() => layer?.focus({ preventScroll: true }))
  })
  onCleanup(() => {
    if (!over) leave()
  })

  const pose = (): MercState => (hopping() ? 'hop' : 'point')
  const spot = (): Spot | null => {
    const b = box()
    return b === null ? null : spotFor(b, props.phone, mercPx)
  }
  const ring = (): Box | null => {
    const b = box()
    return b === null || b.height > window.innerHeight * RING_MAX_SHARE
      ? null
      : b
  }

  const guide = (at: () => ShowcaseStop): JSX.Element => (
    <>
      <div
        class={styles.merc}
        data-testid="showcase-merc-box"
        data-hopping={hopping() ? '' : undefined}
        style={{
          transform: translate(spot()?.merc.x ?? 0, spot()?.merc.y ?? 0),
        }}
      >
        <MercPresence
          state={pose}
          stillSrc={stillFor(pose())}
          size={mercPx}
          testId="showcase-merc"
        />
      </div>
      <div
        class={styles.bubble}
        data-testid="showcase-bubble"
        style={bubbleStyle(spot())}
        onClick={next}
      >
        <p class={styles.line} aria-live="polite" data-testid="showcase-line">
          {at().line}
        </p>
      </div>
    </>
  )

  return (
    <div
      ref={layer}
      class={styles.layer}
      role="dialog"
      aria-label="Show me around"
      data-testid="showcase"
      data-motion={reduced ? 'fade' : 'hop'}
      data-stop={stop()?.id}
      tabindex="-1"
      on:keydown={onKey}
    >
      <Show when={stop()}>
        <div
          class={styles.catcher}
          data-testid="showcase-catcher"
          aria-hidden="true"
          onClick={next}
        />
        <Show when={ring()}>
          {(b) => (
            <div
              class={styles.ring}
              aria-hidden="true"
              style={{
                top: `${b().top}px`,
                left: `${b().left}px`,
                width: `${b().width}px`,
                height: `${b().height}px`,
              }}
            />
          )}
        </Show>
      </Show>
      {reduced ? (
        // Keyed: each stop's Merc and line are new, and fade in where they stand.
        <Show when={stop()} keyed>
          {(at) => guide(() => at)}
        </Show>
      ) : (
        <Show when={stop()}>{(at) => guide(at)}</Show>
      )}
      <button
        type="button"
        class={styles.skip}
        data-testid="showcase-skip"
        onClick={skip}
      >
        Skip
      </button>
    </div>
  )
}
