// ============================================================
// Fly chips — each answer's pill flies into the card it made
// ============================================================
//
// The plan is built from the answers on screen: a chip that holds an answer
// from the last question flies in from the pill that was tapped, and the rest
// rise where they stand. That flight is the transition into the plan, not a
// wait before it (spec 5.4: no pretend loading), so every chip has landed
// within FLY_MS of the call, delays included. Under reduced motion, or where
// the browser has no Web Animations, nothing is played: the chips are already
// where they belong, and the promise is settled at once.
//
// Three things are easy to break:
//
// - A chip's place is read when this is called, so call it once the cards are
//   laid out, and with nothing around the chips moving by a transform (a
//   card that slides in would put every flight off by the slide).
// - A chip is found by its label, `data-chip`, in the map of pills; one with
//   no label, or none in the map, rises in. A pill may feed several chips.
// - The promise never rejects. An animation that is cancelled (an explicit
//   `cancel()`) settles it like a finished one. Removing the chips cancels
//   nothing: a flight on a screen that has gone keeps running on its
//   detached chip, unseen, and the promise settles when it ends.
//
// The chip is the thing animated, not a copy of it, so it stays a real part of
// its card all the way: the card must not make a stacking context of its own
// (a backdrop filter, a transform, an opacity under 1), or a chip on its way
// across the plan would go under the next card.

import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'

/** Every chip has landed by this long after the call, its delay included. */
export const FLY_MS = 900

/** A chip's own trip from its pill; what is left of FLY_MS is for staggering. */
const FLIGHT_MS = 620

/** A chip with no pill rises in over this long. */
const RISE_MS = 440

/** How long after one chip leaves the next one does, in the order they stand. */
const STAGGER_MS = 70

const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)'

/** A chip leaves its pill a little larger, as if lifted off it. */
const LIFT = 1.15

/** How far under its place a rising chip starts. */
const RISE_PX = 8

const RISE_FRAMES: Keyframe[] = [
  { transform: `translateY(${RISE_PX}px)`, opacity: 0 },
  { transform: 'none', opacity: 1 },
]

interface Flight {
  chip: HTMLElement
  frames: Keyframe[]
  duration: number
}

/**
 * From the middle of the pill to the chip's own place. The chip shows at the
 * pill for the first fifth of its trip, then travels.
 */
function flightFrames(pill: DOMRect, place: DOMRect): Keyframe[] {
  const dx = pill.left + pill.width / 2 - (place.left + place.width / 2)
  const dy = pill.top + pill.height / 2 - (place.top + place.height / 2)
  const away = `translate(${dx}px, ${dy}px) scale(${LIFT})`
  return [
    { transform: away, opacity: 0 },
    { transform: away, opacity: 1, offset: 0.2 },
    { transform: 'none', opacity: 1 },
  ]
}

/** How a chip arrives: from its pill, if the pill is known, else rising in. */
function flightOf(
  chip: HTMLElement,
  from: ReadonlyMap<string, DOMRect>,
): Flight {
  const label = chip.dataset.chip
  const pill = label === undefined ? undefined : from.get(label)
  if (pill === undefined) {
    return { chip, frames: RISE_FRAMES, duration: RISE_MS }
  }
  return {
    chip,
    frames: flightFrames(pill, chip.getBoundingClientRect()),
    duration: FLIGHT_MS,
  }
}

/** Starts one flight. `fill: backwards` holds its first frame through the delay. */
function play({ chip, frames, duration }: Flight, index: number): Animation {
  return chip.animate(frames, {
    duration,
    delay: Math.min(index * STAGGER_MS, FLY_MS - duration),
    easing: EASE,
    fill: 'backwards',
  })
}

const canAnimate = (): boolean =>
  typeof Element !== 'undefined' &&
  typeof Element.prototype.animate === 'function'

/**
 * Flies the chips into place and settles when the last has landed. `from`
 * maps an answer's label to where its pill was on screen; `reduced` is the
 * person's motion setting, read from the browser when it is not given.
 */
export function flyChips(
  chips: readonly HTMLElement[],
  from: ReadonlyMap<string, DOMRect>,
  opts: { reduced?: boolean } = {},
): Promise<void> {
  const reduced = opts.reduced ?? prefersReducedMotion()
  if (reduced || !canAnimate()) return Promise.resolve()
  // Every place is read before the first chip is moved.
  const flights = chips.map((chip) => flightOf(chip, from))
  const playing = flights.map(play)
  return Promise.allSettled(playing.map((a) => a.finished)).then(
    () => undefined,
  )
}
