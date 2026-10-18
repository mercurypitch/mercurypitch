// ============================================================
// The Warm-up path's motion: back from a stop, the countdown, the end
// ============================================================
//
// The path is unmounted while a room is up (ShellScreens draws only the top
// screen), so each arrival back on it plays from its mount, keyed on the
// store's last move (warm-up-store.ts). DESIGN-warm-up.md §5.5 and §5.8,
// with the owner's pw-next "auto":
//
//   back from a stop   0        the stop goes from next to done (300 ms)
//                      0.2 s    the lit path draws to the next stop
//                      0.3 s    Merc hops beside it (HOP_MS) and the card
//                               rises: "Lip roll: 86% lit"
//                      2.5 s    Again, Skip and Next fade in, and Next
//                               counts down AUTO_CONTINUE_SECONDS, then
//                               opens the next stop (cancellable: Stay
//                               here, or any tap on the screen)
//   the end            the finished stops brighten from the bottom up,
//                      END_STEP_MS apart; Merc hops onto the song stop and
//                      cheers (CHEER_MS)
//
// A fixture (`still`) shows every view settled, with no timer and no
// countdown. Under reduced motion Merc does not hop or jump: he is where he
// goes, and his cheer shows as the lock's smile (merc-moves.ts); the
// buttons keep their timing.

import type { Accessor } from 'solid-js'
import { batch, createEffect, createSignal, on, onCleanup, untrack, } from 'solid-js'
import { CHEER_MS, HOP_MS } from '@/components/room-kit/merc-moves'
import { AUTO_CONTINUE_SECONDS } from '@/lib/auto-continue'
import type { MercState } from '@/lib/merc/constants'
import type { MercSpot } from './path-layout'
import type { PathView } from './path-view'
import type { LastMove } from './warm-up-store'

/** The finished stop lights after this, ms. */
export const LIGHT_MS = 16
/** The lit path starts to draw to the next stop, ms. */
export const TRAIL_MS = 200
/** Merc hops and the card rises, ms. */
export const HOP_AT_MS = 300
/** Again, Skip and Next show, and Next starts counting, ms (PLAN-NEXT §3). */
export const ACTIONS_MS = 2500
/** The end: one finished stop brightens after another, ms apart. */
export const END_STEP_MS = 120

export interface PathMotionSetup {
  readonly view: Accessor<PathView>
  readonly last: Accessor<LastMove | null>
  readonly still: boolean
  readonly reduced: () => boolean
  /** The countdown ran out: open the next stop. */
  readonly go: () => void
  /** A finished stop lights on the path (a light tick, §10). */
  readonly onLit?: () => void
  /** The end: Merc lands on the song stop (a success, §10). */
  readonly onEnd?: () => void
}

export interface PathMotion {
  /** The stop just finished still shows as it did before (next). */
  readonly unlit: Accessor<number | null>
  /** The lit path has reached the next stop. */
  readonly trailIn: Accessor<boolean>
  readonly card: Accessor<boolean>
  readonly actions: Accessor<boolean>
  /** Seconds the countdown started from, while it runs; null otherwise. */
  readonly counting: Accessor<number | null>
  /** At the end, how many finished stops have brightened. */
  readonly brightened: Accessor<number>
  readonly merc: Accessor<MercSpot>
  readonly mercState: Accessor<MercState>
  /** Merc is on his way between two spots (his transform eases). */
  readonly hopping: Accessor<boolean>
  /** Stop the countdown, and keep the path as it is. */
  readonly stay: () => void
  /** Merc leans toward a stop as it opens. */
  readonly lean: () => void
}

/** Every stop the end brightens, bottom up, and the song: all of them. */
const ALL = Number.MAX_SAFE_INTEGER

export function createPathMotion(setup: PathMotionSetup): PathMotion {
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const later = (ms: number, fn: () => void): void => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      fn()
    }, ms)
    timers.add(timer)
  }
  const clearAll = (): void => {
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  }
  onCleanup(clearAll)

  const settled = untrack(setup.view)
  const [unlit, setUnlit] = createSignal<number | null>(null)
  const [trailIn, setTrailIn] = createSignal(true)
  const [card, setCard] = createSignal(true)
  const [actions, setActions] = createSignal(true)
  const [counting, setCounting] = createSignal<number | null>(null)
  const [brightened, setBrightened] = createSignal(ALL)
  const [merc, setMerc] = createSignal<MercSpot>(settled.merc)
  const [mercState, setMercState] = createSignal<MercState>('idle')
  const [hopping, setHopping] = createSignal(false)

  let countdown: ReturnType<typeof setTimeout> | undefined
  const stopCounting = (): void => {
    clearTimeout(countdown)
    countdown = undefined
    setCounting(null)
  }
  onCleanup(stopCounting)

  const startCounting = (): void => {
    if (setup.still || untrack(setup.view).next === null) return
    stopCounting()
    setCounting(AUTO_CONTINUE_SECONDS)
    countdown = setTimeout(() => {
      countdown = undefined
      setCounting(null)
      setup.go()
    }, AUTO_CONTINUE_SECONDS * 1000)
  }

  /** Merc to `spot`: a hop, or straight there under reduced motion. */
  const moveMerc = (spot: MercSpot, then: MercState): void => {
    if (setup.reduced()) {
      batch(() => {
        setMerc(spot)
        setMercState(then === 'celebrate' ? 'lock' : then)
      })
      return
    }
    batch(() => {
      setHopping(true)
      setMerc(spot)
      setMercState('hop')
    })
    later(HOP_MS, () => {
      batch(() => {
        setHopping(false)
        setMercState(then)
      })
    })
  }

  const arriveBetween = (last: LastMove): void => {
    const view = untrack(setup.view)
    batch(() => {
      setUnlit(last.state === 'done' ? last.index : null)
      setTrailIn(false)
      setCard(false)
      setActions(false)
      setMerc({ at: 'beside', index: last.index })
      setMercState('idle')
    })
    later(LIGHT_MS, () => {
      setUnlit(null)
      if (last.state === 'done') setup.onLit?.()
    })
    later(TRAIL_MS, () => setTrailIn(true))
    later(HOP_AT_MS, () => {
      setCard(true)
      moveMerc(view.merc, 'idle')
    })
    later(ACTIONS_MS, () => {
      setActions(true)
      startCounting()
    })
  }

  const arriveAtEnd = (last: LastMove): void => {
    const view = untrack(setup.view)
    const lit = view.stops.filter((stop) => stop.orb === 'lit').length
    batch(() => {
      setBrightened(0)
      setMerc({ at: 'beside', index: last.index })
      setMercState('idle')
    })
    for (let i = 1; i <= lit; i += 1) {
      later(i * END_STEP_MS, () => setBrightened(i))
    }
    later(lit * END_STEP_MS, () => {
      setup.onEnd?.()
      moveMerc(view.merc, 'celebrate')
      later(HOP_MS + CHEER_MS, () => setMercState('idle'))
    })
  }

  // Each new last move is an arrival: a stop finished or skipped, on the
  // path's mount or (Skip on the path) while it is up.
  createEffect(
    on(setup.last, (last) => {
      clearAll()
      stopCounting()
      const view = untrack(setup.view)
      if (setup.still || last === null) {
        batch(() => {
          setBrightened(ALL)
          setMerc(view.merc)
          setMercState('idle')
        })
        return
      }
      if (view.state === 'between') arriveBetween(last)
      else if (view.state === 'end') arriveAtEnd(last)
      else setMerc(view.merc)
    }),
  )

  // A view that moves with no new last move (a stop opened, the day turned
  // over): Merc goes where it puts him.
  createEffect(
    on(
      () => setup.view().merc,
      (spot) => {
        if (untrack(hopping) || untrack(setup.last) !== null) return
        setMerc(spot)
      },
      { defer: true },
    ),
  )

  return {
    unlit,
    trailIn,
    card,
    actions,
    counting,
    brightened,
    merc,
    mercState,
    hopping,
    stay: stopCounting,
    lean: () => {
      stopCounting()
      if (!setup.reduced()) setMercState('point')
    },
  }
}
