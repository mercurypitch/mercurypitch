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
//                      END_STEP_MS apart, still at their rest places with
//                      Merc beside the stop he came from, and the path draws
//                      on to the song; END_SONG_MS after the last stop the
//                      song lights with its burst, the night's glow brightens
//                      to its end and its points grow, and Merc hops onto
//                      the song while the stops pack closer under the titles
//                      (PACK_MS, §3), landing at screen 3's size (path-layout
//                      MERC_SONG_SCALE) as they settle, where he cheers
//                      (CHEER_MS) and the phone gives its success (§5.8, §10)
//   the day's first    the path draws in from the bottom stop up, each stop
//   open               fading in as it reaches it (DRAW_IN_MS, §5.2, §10);
//                      every later open that day arrives settled
//   the onboarding's   the native onboarding ends here (S7b beat 10,
//   landing            path-landing.ts): the path draws in, and as it is in
//                      Merc hops from the floor beside the first stop
//                      (LAND_AT_MS after the open when nothing draws in)
//
// Packed from the start, the end had Merc beside Echo on "Long note 12.6 s"
// until he hopped: the rest places keep a full stop's gap on his side.
//
// A fixture (`still`) shows every view settled, with no timer and no
// countdown. Under reduced motion Merc does not hop or jump: he fades out
// where he is and in where he goes (MERC_FADE_MS each), and his cheer shows
// as the lock's smile (merc-moves.ts); the end arrives in its settled frame
// (packed, Merc on the song) and only lights; the path appears without
// drawing in, the burst only fades (WarmUpPath.module.css), and the buttons
// keep their timing.

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
/**
 * A stop's sprite crossfades to its new state, ms: the end's brightening,
 * and a finished stop from next to done (§5.5, 300 ms). A fade, so reduced
 * motion keeps it.
 */
export const ORB_FADE_MS = 300
/**
 * The end packs its stops closer (§3, screen 3) while Merc hops onto the
 * song, ms: they start just after he does.
 */
export const PACK_AFTER_HOP_MS = 50
/** The pack itself, ms: done as Merc lands (HOP_MS). */
export const PACK_MS = 600
/** The pack's pace: a slow start, so the song's name stays up as he leaves. */
export const PACK_EASE = 'cubic-bezier(0.45, 0, 0.25, 1)'

/** A straight glide over HOP_MS: the landing's way across. */
export const HOP_EASE = 'cubic-bezier(0.33, 0, 0.25, 1)'
/**
 * The end's hop goes across first and up after. He starts beside the last
 * stop, under the song's name, and that name comes down to him as the
 * stops pack: across at once, he is out from under it before it reaches
 * his height; up, he follows the song down onto it.
 */
export const END_HOP_ACROSS_EASE = 'cubic-bezier(0.2, 0.75, 0.3, 1)'
export const END_HOP_UP_EASE = 'cubic-bezier(0.55, 0, 0.6, 1)'
/**
 * Between stops he rises first, then crosses (owner, 20 Oct): he is up at
 * the next stop's height by mid-hop and crosses over to it after, high
 * above the name of the stop he leaves. Not straight up: the next stop's
 * name stands over him (the names alternate sides, and he stands on the
 * side away from his stop's name), so he leans out from under it as he
 * rises.
 */
export const BETWEEN_HOP_ACROSS_EASE = 'cubic-bezier(0.15, 0.3, 0.8, 1)'
export const BETWEEN_HOP_UP_EASE = 'cubic-bezier(0.35, 0.4, 0.15, 1)'
/**
 * The landing drops first: from the floor he hops beside the first stop, a
 * little lower, with the second stop's name over him. Down at once, he is
 * at his new height by the top of his jump; with a straight glide he was
 * still a third of the drop above it there, and at 320 x 568 his crown
 * touched the name (13g). Across, the straight glide.
 */
export const LAND_HOP_UP_EASE = 'cubic-bezier(0.2, 0.9, 0.3, 1)'

/** How a hop takes its two directions: across (his track) and up (Merc). */
export type HopPace = 'between' | 'end' | 'land'

/** Each pace's two eases, over HOP_MS. */
export const HOP_PACES: Readonly<
  Record<HopPace, { readonly across: string; readonly up: string }>
> = {
  between: { across: BETWEEN_HOP_ACROSS_EASE, up: BETWEEN_HOP_UP_EASE },
  end: { across: END_HOP_ACROSS_EASE, up: END_HOP_UP_EASE },
  land: { across: HOP_EASE, up: LAND_HOP_UP_EASE },
}

/**
 * Where the end's stops stand: at their rest places (the end arriving, so
 * Merc beside the stop he came from covers no name), moving to the end's
 * packed places, or there.
 */
export type PackPhase = 'unpacked' | 'packing' | 'settled'

/** The day's first open: the path draws in from the bottom stop up, ms (§10). */
export const DRAW_IN_MS = 700
/**
 * The onboarding's landing on a path that does not draw in (reduced
 * motion): Merc goes beside the first stop a beat after it opens, ms.
 */
export const LAND_AT_MS = 300
/** Each stop's fade as the path reaches it, ms. */
const DRAW_IN_FADE_MS = 220

/** The draw-in, stop by stop: what PathColumn hands its CSS. */
export interface DrawInSchedule {
  /** When each stop starts to fade in, ms from the open, bottom stop first. */
  readonly stops: readonly number[]
  /** How long each stop's fade takes, ms. */
  readonly fade: number
  /**
   * How long each segment of the path takes to draw, ms: from its lower
   * stop's start to its upper one's, so the path reaches a stop as it
   * appears, and the top one is in by DRAW_IN_MS whatever the plan's length.
   */
  readonly segment: number
}

export function drawInSchedule(count: number): DrawInSchedule {
  const segment = count > 1 ? (DRAW_IN_MS - DRAW_IN_FADE_MS) / (count - 1) : 0
  return {
    stops: Array.from({ length: count }, (_, i) => i * segment),
    fade: DRAW_IN_FADE_MS,
    segment,
  }
}

export interface PathMotionSetup {
  readonly view: Accessor<PathView>
  readonly last: Accessor<LastMove | null>
  readonly still: boolean
  readonly reduced: () => boolean
  /**
   * The path's first open of the day on this device (warm-up-store.ts
   * firstPathOpenToday): it draws in, unless it is a fixture's frame or a
   * return from a stop, which arrives as that stop's card.
   */
  readonly drawIn?: boolean
  /**
   * The onboarding's landing (path-landing.ts): on a run not yet started,
   * Merc hops from the floor beside the first stop once the path is in.
   * Once, on the open it lands on.
   */
  readonly land?: boolean
  /** The countdown ran out: open the next stop. */
  readonly go: () => void
  /** A finished stop lights on the path (a light tick, §10). */
  readonly onLit?: () => void
  /** The end: Merc lands on the song stop (a success, §10). */
  readonly onEnd?: () => void
}

export interface PathMotion {
  /** The day's first open: the path is drawing in (DRAW_IN_MS). */
  readonly drawingIn: Accessor<boolean>
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
  /** The end's stops: still at rest, packing, or packed (settled). */
  readonly pack: Accessor<PackPhase>
  readonly merc: Accessor<MercSpot>
  readonly mercState: Accessor<MercState>
  /** Merc is on his way between two spots (his transform eases). */
  readonly hopping: Accessor<boolean>
  /** The pace of his hop (HOP_PACES), or of his last one. */
  readonly hopPace: Accessor<HopPace>
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
  // Unpacked from the first frame too: drawn packed, the stops would jump.
  const [pack, setPack] = createSignal<PackPhase>(
    endArriving && !setup.reduced() ? 'unpacked' : 'settled',
  )
  const [merc, setMerc] = createSignal<MercSpot>(settled.merc)
  const [mercState, setMercState] = createSignal<MercState>('idle')
  const [hopping, setHopping] = createSignal(false)
  // Each hop sets its own pace, and it is read only while he hops.
  const [hopPace, setHopPace] = createSignal<HopPace>('between')
  const [mercFaded, setMercFaded] = createSignal(false)

  // Its own timer: the arrivals below clear theirs on every last move,
  // the first run included.
  const [drawingIn, setDrawingIn] = createSignal(
    setup.drawIn === true && !setup.still && untrack(setup.last) === null,
  )
  let drawn: ReturnType<typeof setTimeout> | undefined
  if (untrack(drawingIn)) {
    drawn = setTimeout(() => setDrawingIn(false), DRAW_IN_MS)
  }
  onCleanup(() => clearTimeout(drawn))

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
   * Merc to `spot`, ending in `then`: a hop at `pace`, or under reduced
   * motion a crossfade (out where he is, in where he goes). `arrived` once
   * he is there.
   */
  const moveMerc = (
    spot: MercSpot,
    then: MercState,
    pace: HopPace,
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
      setHopPace(pace)
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
      setPack('settled')
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
      moveMerc(view.merc, 'idle', 'between')
    })
    later(ACTIONS_MS, () => {
      setActions(true)
      startCounting()
    })
  }

  const arriveAtEnd = (last: LastMove): void => {
    const view = untrack(setup.view)
    const reduced = setup.reduced()
    const rooms = view.stops.filter(
      (stop) => stop.orb === 'lit' && !stop.song,
    ).length
    const songAt = rooms * END_STEP_MS + END_SONG_MS
    batch(() => {
      setBrightened(0)
      setTrailIn(false)
      setEndLit(false)
      setBurst(false)
      // The stops where they stood, and Merc beside the stop he came from:
      // packed, its neighbour's name comes within his reach. Under reduced
      // motion the end is its settled frame from the start: packed, Merc
      // already on the song, and nothing moves.
      setPack(reduced ? 'settled' : 'unpacked')
      setMerc(reduced ? view.merc : { at: 'beside', index: last.index })
      setMercState('idle')
      setMercFaded(false)
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
      const landed = (): void => {
        setup.onEnd?.()
        later(CHEER_MS, () => setMercState('idle'))
      }
      if (reduced) {
        // His cheer, still: the lock's smile (merc-moves.ts).
        setMercState('lock')
        landed()
        return
      }
      moveMerc(view.merc, 'celebrate', 'end', landed)
      later(PACK_AFTER_HOP_MS, () => setPack('packing'))
      later(PACK_AFTER_HOP_MS + PACK_MS, () => setPack('settled'))
    })
  }

  /** The onboarding's landing, still to play: only on the open it lands on. */
  let landing = setup.land === true && !setup.still
  let landTimer: ReturnType<typeof setTimeout> | undefined
  /** Merc from the floor beside the first stop, once the path is in. */
  const land = (view: PathView): void => {
    if (!landing) return
    landing = false
    if (view.state !== 'start' || view.merc.at !== 'floor') return
    landTimer = setTimeout(
      () => {
        landTimer = undefined
        moveMerc({ at: 'beside', index: 0 }, 'idle', 'land')
      },
      untrack(drawingIn) ? DRAW_IN_MS : LAND_AT_MS,
    )
  }
  /** A tap on Start, or any move, before he has hopped: he stays put. */
  const stopLanding = (): void => {
    landing = false
    clearTimeout(landTimer)
    landTimer = undefined
  }
  onCleanup(stopLanding)

  // Each new last move is an arrival: a stop finished or skipped, on the
  // path's mount or (Skip on the path) while it is up.
  createEffect(
    on(setup.last, (last) => {
      clearAll()
      stopCounting()
      const view = untrack(setup.view)
      if (setup.still || last === null) {
        batch(() => {
          setPack('settled')
          setBrightened(ALL)
          setTrailIn(true)
          setEndLit(true)
          setBurst(false)
          setMerc(view.merc)
          setMercState('idle')
          setMercFaded(false)
        })
        land(view)
        return
      }
      stopLanding()
      if (view.state === 'between') arriveBetween(last)
      else if (view.state === 'end') arriveAtEnd(last)
      else {
        batch(() => {
          setPack('settled')
          setMerc(view.merc)
        })
      }
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
    drawingIn,
    unlit,
    trailIn,
    card,
    actions,
    counting,
    brightened,
    endLit,
    burst,
    pack,
    merc,
    mercState,
    hopping,
    hopPace,
    mercFaded,
    stay: stopCounting,
    lean: () => {
      stopCounting()
      stopLanding()
      if (!setup.reduced()) setMercState('point')
    },
  }
}
