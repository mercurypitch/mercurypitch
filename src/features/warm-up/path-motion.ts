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
//                      END_STEP_MS apart, and the path draws on to the
//                      song; END_SONG_MS after the last stop the song
//                      lights with its burst, the night's glow brightens
//                      to its end and its points grow, and Merc hops onto
//                      the song, landing at screen 3's size (path-layout
//                      MERC_SONG_SCALE), where he cheers (CHEER_MS) and the
//                      phone gives its success (§5.8, §10)
//
// A fixture (`still`) shows every view settled, with no timer and no
// countdown. Under reduced motion Merc does not hop or jump: he fades out
// where he is and in where he goes (MERC_FADE_MS each), and his cheer shows
// as the lock's smile (merc-moves.ts); the path appears without drawing,
// the burst only fades (WarmUpPath.module.css), and the buttons keep their
// timing.

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
/**
 * The end: from the last finished stop's light to the song's, ms, while
 * the path draws on to the song (its draw is the trail's 500 ms ease-out,
 * most of the way there by now).
 */
export const END_SONG_MS = 240
/** Under reduced motion Merc fades out, then in where he goes, ms each. */
export const MERC_FADE_MS = 150

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
  /** At the end, how many finished stops have brightened, the song last. */
  readonly brightened: Accessor<number>
  /** The end has lit: the song, the night's end glow, its points grown. */
  readonly endLit: Accessor<boolean>
  /** The song's burst plays: the end arriving, never a settled view. */
  readonly burst: Accessor<boolean>
  readonly merc: Accessor<MercSpot>
  readonly mercState: Accessor<MercState>
  /** Merc is on his way between two spots (his transform eases). */
  readonly hopping: Accessor<boolean>
  /** Merc is faded out between two spots: reduced motion's crossfade. */
  readonly mercFaded: Accessor<boolean>
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
  // An arrival at the end starts unlit, as arriveAtEnd sets it: a first
  // frame drawn lit would have the night's glow fade down before it
  // brightens (the glow is there from the mount, and eases its opacity).
  const endArriving =
    !setup.still && untrack(setup.last) !== null && settled.state === 'end'
  const [unlit, setUnlit] = createSignal<number | null>(null)
  const [trailIn, setTrailIn] = createSignal(!endArriving)
  const [card, setCard] = createSignal(true)
  const [actions, setActions] = createSignal(true)
  const [counting, setCounting] = createSignal<number | null>(null)
  const [brightened, setBrightened] = createSignal(endArriving ? 0 : ALL)
  const [endLit, setEndLit] = createSignal(!endArriving)
  const [burst, setBurst] = createSignal(false)
  const [merc, setMerc] = createSignal<MercSpot>(settled.merc)
  const [mercState, setMercState] = createSignal<MercState>('idle')
  const [hopping, setHopping] = createSignal(false)
  const [mercFaded, setMercFaded] = createSignal(false)

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

  /**
   * Merc to `spot`, ending in `then`: a hop, or under reduced motion a
   * crossfade (out where he is, in where he goes). `arrived` once he is
   * there.
   */
  const moveMerc = (
    spot: MercSpot,
    then: MercState,
    arrived?: () => void,
  ): void => {
    if (setup.reduced()) {
      setMercFaded(true)
      later(MERC_FADE_MS, () => {
        batch(() => {
          setMerc(spot)
          setMercState(then === 'celebrate' ? 'lock' : then)
          setMercFaded(false)
        })
        arrived?.()
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
      arrived?.()
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
    const rooms = view.stops.filter(
      (stop) => stop.orb === 'lit' && !stop.song,
    ).length
    const songAt = rooms * END_STEP_MS + END_SONG_MS
    batch(() => {
      setBrightened(0)
      setTrailIn(false)
      setEndLit(false)
      setBurst(false)
      setMerc({ at: 'beside', index: last.index })
      setMercState('idle')
    })
    for (let i = 1; i <= rooms; i += 1) {
      later(i * END_STEP_MS, () => setBrightened(i))
    }
    later(rooms * END_STEP_MS, () => setTrailIn(true))
    later(songAt, () => {
      batch(() => {
        setBrightened(rooms + 1)
        setEndLit(true)
        setBurst(true)
      })
      moveMerc(view.merc, 'celebrate', () => {
        setup.onEnd?.()
        later(CHEER_MS, () => setMercState('idle'))
      })
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
          setTrailIn(true)
          setEndLit(true)
          setBurst(false)
          setMerc(view.merc)
          setMercState('idle')
          setMercFaded(false)
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
        if (untrack(hopping) || untrack(mercFaded)) return
        if (untrack(setup.last) !== null) return
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
    endLit,
    burst,
    merc,
    mercState,
    hopping,
    mercFaded,
    stay: stopCounting,
    lean: () => {
      stopCounting()
      if (!setup.reduced()) setMercState('point')
    },
  }
}
