// ============================================================
// Staircase turn — each stair turns onto its place on the staff
// ============================================================
//
// Lesson 16's Step 1 (its WEB-SPEC, Toys 3): Lesson 4's staircase stands
// beside the staff, then turns into it, each stair landing on its line or
// space, the short stair from mi to fa too. A page hands in where each
// stair's block is and where its note's head will be, both in page pixels,
// and the layer the stairs turn across (any element holding both figures,
// laid out as a containing block); the turn lays a ghost of each stair over
// the layer and turns it a quarter turn as it travels and shrinks onto its
// head, in 0.8 s, then takes the ghosts away, so the page can show the
// staff's own notes. With motion paused (reduced motion, or the page's
// Pause animations) nothing travels: the ghosts are the heads themselves,
// fading in at their places, a cross-fade from the staircase to the staff.
// The ghosts take no taps and are hidden from screen readers; the page says
// what the turn shows.

import { Motion } from './motion-switch'

/** A box in page pixels: a stair's block, or a note's head. */
export interface Box {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface TurnOptions {
  /** Each stair's block, from do up, in page pixels. */
  readonly from: readonly Box[]
  /** Each stair's note's head, in the same order. */
  readonly to: readonly Box[]
  /** The element the ghosts are laid in. */
  readonly layer: HTMLElement
}

/** A turn on its way: `done` is true when it ran to its end, false when cut short. */
export interface Turn {
  readonly done: Promise<boolean>
  cancel(): void
}

/** The turn, s (Lesson 16 FACTS 68). */
export const TURN_SEC = 0.8
/** The cross-fade that stands in for it with motion paused, s. */
export const FADE_SEC = 0.3

/**
 * The transform that takes a box onto another, about its centre: the
 * travel, a quarter turn, and the scale that makes it, once turned, the
 * other box's size.
 */
export function turnTransform(a: Box, b: Box): string {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2)
  const dy = b.y + b.h / 2 - (a.y + a.h / 2)
  // turned a quarter, its height is drawn across and its width down
  const sx = b.h / Math.max(1, a.w)
  const sy = b.w / Math.max(1, a.h)
  return `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(-90deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`
}

/** Turns each stair onto its head; the ghosts are gone once `done` settles. */
export function turnStairs(o: TurnOptions): Turn {
  const origin = o.layer.getBoundingClientRect()
  const still = Motion.paused
  const group = document.createElement('div')
  group.className = 'stairs-turn'
  group.setAttribute('aria-hidden', 'true')
  o.layer.append(group)
  const animations: Animation[] = []
  const count = Math.min(o.from.length, o.to.length)
  for (let i = 0; i < count; i++) {
    // with motion paused, each ghost starts where its head will be
    const box = still ? o.to[i] : o.from[i]
    const ghost = document.createElement('i')
    ghost.className = still ? 'stairs-ghost is-head' : 'stairs-ghost'
    ghost.style.left = `${(box.x - origin.left).toFixed(1)}px`
    ghost.style.top = `${(box.y - origin.top).toFixed(1)}px`
    ghost.style.width = `${box.w.toFixed(1)}px`
    ghost.style.height = `${box.h.toFixed(1)}px`
    group.append(ghost)
    if (typeof ghost.animate !== 'function') continue
    animations.push(
      still
        ? ghost.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: FADE_SEC * 1000,
            fill: 'forwards',
          })
        : ghost.animate(
            [
              { transform: 'none', borderRadius: '2px' },
              {
                transform: turnTransform(o.from[i], o.to[i]),
                borderRadius: '50%',
              },
            ],
            {
              duration: TURN_SEC * 1000,
              easing: 'cubic-bezier(0.45, 0, 0.2, 1)',
              fill: 'forwards',
            },
          ),
    )
  }
  let settle: (ran: boolean) => void = () => undefined
  const done = new Promise<boolean>((resolve) => {
    settle = (ran) => {
      settle = () => undefined
      group.remove()
      resolve(ran)
    }
  })
  const length = (still ? FADE_SEC : TURN_SEC) * 1000
  const timer = window.setTimeout(() => settle(true), length)
  return {
    done,
    cancel() {
      window.clearTimeout(timer)
      animations.forEach((a) => a.cancel())
      settle(false)
    },
  }
}

/** A box of an element, in page pixels. */
export const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height }
}
