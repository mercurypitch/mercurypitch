// ============================================================
// The Warm-up's path: the screen between the stops
// ============================================================
//
// DESIGN-warm-up.md §13c, built from Codex's four frames (owner, 18 Oct
// 2026: cx-warm-frames, sky v1, stops v2 post-fixed). The plan's stops
// climb a glass path through the night, bottom up, Your song on top; the
// screen says where the run stands and opens the next stop.
//
//   top      the shell's bar (Back, "Warm-up", the level pill on its right:
//            pw-level), then the chip ("3 min", "1 of 4 today", "Warmed up
//            today" with this week's dots under it) or, at the end, "Warmed
//            up" and "4 of 4 today"; what the routine unlocked under it
//            (decision (a), 13a review)
//   middle   the path (PathColumn.tsx), standing on the floor just above
//            the buttons, scrolling when a long plan does not fit (pw-stops)
//   bottom   the state's buttons (PathActions.tsx)
//
// The path is unmounted while a stop's room is up (ShellScreens.tsx draws
// only the top screen): the run lives in the store (warm-up-store.ts), and
// each return plays from the store's last move (path-motion.ts).
//
// A tap on Start or Next: the stop's ring pulses (280 ms) and Merc leans
// toward it while its room's art starts loading, then the stop opens and
// the shell pushes its room (§5.3). Leaving the path any other way (Back,
// Done, Sing a song) lets go of its card and its unlocks.
//
// A tablet shows the phone's column, centred, on the night's colours
// (option (a), owner).
//
// What the singer feels (§10): a light tick when a stop lights or opens, a
// success as Merc lands on the song. Through `@/lib/haptics`, as the rooms'
// own: the device's haptics in the app, which installs them at boot.
//
// The native onboarding ends here (S7b beat 10, path-landing.ts): that open
// draws in as the day's first does, and Merc hops beside the first stop.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { LevelControl } from '@/components/room-kit/LevelControl'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { RoomBarEnd } from '@/components/room-kit/RoomBar'
import surface from '@/components/room-kit/RoomSurface.module.css'
import { UnlockList } from '@/components/room-kit/UnlockChip'
import { WeekDots } from '@/components/room-kit/WeekDots'
import { haptics } from '@/lib/haptics'
import { exerciseLevel } from '@/stores/exercise-level'
import { unlockShown } from '@/stores/notifications-store'
import { warmUpMinutes } from './estimate'
import { SKY_BOTTOM, SKY_TOP } from './path-art'
import { takePathLanding } from './path-landing'
import type { PathMode, ScreenBox } from './path-layout'
import { openingScroll, pathFrame } from './path-layout'
import { createPathMotion } from './path-motion'
import type { PathSource } from './path-source'
import { storeSource } from './path-source'
import type { PathView } from './path-view'
import { countdownSaid, PATH_WORDS, pathView, WARM_UP_LEVEL_LINES, } from './path-view'
import { PathActions } from './PathActions'
import { PathColumn } from './PathColumn'
import type { WarmUpRoomId } from './warm-up-plan'
import { isRoomStop } from './warm-up-plan'
import styles from './WarmUpPath.module.css'

/** The ring's pulse before a stop opens, ms (§10). */
export const PULSE_MS = 280
/** Under reduced motion: a short fade instead, ms (§10). */
export const PULSE_REDUCED_MS = 150

/** Until the screen is measured (and in a test, which has no layout). */
const PHONE: ScreenBox = { width: 390, height: 844, top: 56, bottom: 0 }

export interface WarmUpPathProps {
  /** Open a stop's room: the stop is open in the store by now. */
  onOpenRoom: (id: WarmUpRoomId) => void
  /** The tap that opens a stop: start loading its room's art. */
  onPreload?: (id: WarmUpRoomId) => void
  /** Done: leave the path. */
  onDone: () => void
  /** Sing a song, or a tap on the song stop at the end. */
  onSong: () => void
  /** Warm up with Premium: the paywall (none yet: N3). */
  onPremium?: () => void
  /** The run to draw: the store's unless a fixture or a test pins one. */
  source?: PathSource
  /** Every motion settled and no timers: a fixture's frame. */
  still?: boolean
  /** The sky is on screen (or failed): a fixture's capture waits for it. */
  onSkySettled?: () => void
}

function modeOf(view: PathView): PathMode {
  return view.state === 'end' || view.state === 'done' ? 'end' : 'rest'
}

/** The level pill shows where a run starts or goes on (Codex's frames). */
function levelShown(view: PathView): boolean {
  return view.state !== 'end' && view.state !== 'locked'
}

/** What the polite live region says now. */
function saidNow(
  view: PathView,
  counting: number | null,
  card: boolean,
): string {
  if (counting !== null && view.next !== null) {
    return countdownSaid(view.stops[view.next]?.name ?? '', counting)
  }
  if (card && view.card !== null) return view.card.line
  if (view.state === 'end') return `${PATH_WORDS.warmedUp}, ${view.today}`
  return ''
}

/** The screen's size and the shell's insets, measured. */
function createScreenBox(): {
  box: () => ScreenBox
  bind: (root: HTMLElement, top: HTMLElement, bottom: HTMLElement) => void
} {
  const [box, setBox] = createSignal<ScreenBox>(PHONE)
  const bind = (
    root: HTMLElement,
    top: HTMLElement,
    bottom: HTMLElement,
  ): void => {
    const measure = (): void => {
      const rect = root.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const next: ScreenBox = {
        width: rect.width,
        height: rect.height,
        top: top.getBoundingClientRect().top - rect.top,
        bottom: rect.bottom - bottom.getBoundingClientRect().bottom,
      }
      // The observer's first call measures what the mount just did: the
      // same box is not a new frame (nothing on the path is placed again).
      const was = untrack(box)
      if (
        next.width === was.width &&
        next.height === was.height &&
        next.top === was.top &&
        next.bottom === was.bottom
      ) {
        return
      }
      setBox(next)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    onCleanup(() => observer.disconnect())
  }
  return { box, bind }
}

export function WarmUpPath(props: WarmUpPathProps): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- the run, chosen once
  const source = props.source ?? storeSource()
  // eslint-disable-next-line solid/reactivity -- a fixture, read once
  const still = props.still === true
  const view = createMemo(() =>
    pathView({
      day: source.day(),
      last: source.last(),
      canStart: source.canStart(),
      minutes: warmUpMinutes(source.day().plan, exerciseLevel()),
      days: source.days(),
    }),
  )
  const mode = createMemo(() => modeOf(view()))
  const [pulsing, setPulsing] = createSignal<number | null>(null)
  let opening: ReturnType<typeof setTimeout> | undefined

  const roomOf = (index: number): WarmUpRoomId | null => {
    const stop = source.day().plan.stops[index]
    return isRoomStop(stop) ? stop.id : null
  }

  // The day's first open draws the path in; a return from a stop arrives as
  // its card instead. Asked as the path opens, so under reduced motion the
  // open still counts for the day, though nothing draws in. The
  // onboarding's landing draws in too, whichever open of the day it is.
  const landing = !still && takePathLanding()
  const drawIn =
    !still &&
    untrack(source.last) === null &&
    (source.firstOpenToday() || landing) &&
    !prefersReducedMotion()
  const motion = createPathMotion({
    view,
    last: source.last,
    still,
    reduced: prefersReducedMotion,
    drawIn,
    land: landing,
    go: () => enter(untrack(view).next),
    onLit: () => haptics.tapLight(),
    onEnd: () => haptics.success(),
  })

  /** Start, Next, Again, the countdown's end: pulse, then open the stop. */
  function enter(index: number | null): void {
    if (index === null || pulsing() !== null) return
    const id = roomOf(index)
    if (id === null) return
    motion.lean()
    props.onPreload?.(id)
    haptics.tapLight()
    setPulsing(index)
    opening = setTimeout(
      () => {
        opening = undefined
        setPulsing(null)
        if (source.enter(index)) props.onOpenRoom(id)
      },
      prefersReducedMotion() ? PULSE_REDUCED_MS : PULSE_MS,
    )
  }
  onCleanup(() => clearTimeout(opening))

  // The path holds the routine's unlocks while it is up, and leaving it,
  // except for a stop's room, lets go of its card and what it said.
  onMount(() => onCleanup(source.claim()))
  onCleanup(() => {
    if (!source.inRoom()) source.leave()
  })
  createEffect(
    on(
      () => source.unlocks().length,
      (count, before) => {
        if (!still && count > (before ?? 0)) unlockShown()
      },
    ),
  )

  // Hidden, the countdown stops (nobody is there to see it go); back, the
  // date is read again, so a path left open past midnight starts a new day.
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') motion.stay()
    else source.refresh()
  }
  document.addEventListener('visibilitychange', onVisibility)
  onCleanup(() =>
    document.removeEventListener('visibilitychange', onVisibility),
  )

  // Any tap but Next's stops the countdown: the singer is doing something.
  const onPointerDown = (event: PointerEvent): void => {
    if (motion.counting() === null) return
    const target = event.target as Element | null
    if (target?.closest('[data-countdown-go]')) return
    motion.stay()
  }

  let root: HTMLDivElement | undefined
  let topZone: HTMLDivElement | undefined
  let bottomEdge: HTMLDivElement | undefined
  let scroller: HTMLDivElement | undefined
  const screen = createScreenBox()
  onMount(() => {
    if (root && topZone && bottomEdge) screen.bind(root, topZone, bottomEdge)
  })
  const frame = createMemo(() =>
    pathFrame(
      screen.box(),
      view().stops.length,
      mode(),
      view().state === 'locked',
    ),
  )
  // A path taller than the screen opens at its floor, where the run is,
  // and the end at its top, where the titles and Merc on the song are
  // (openingScroll). One that fits stays put: its column is the screen.
  createEffect(
    on(
      () => [openingScroll(frame(), mode()), frame().height] as const,
      ([at]) => {
        if (!scroller) return
        scroller.scrollTop = at === 'floor' ? scroller.scrollHeight : 0
      },
    ),
  )

  // What the routine unlocked goes where the path has room for it: on top
  // between stops, where no chip is, and over the buttons otherwise, where
  // the card's room is free. Under a chip or the end's titles it would
  // stand on the top stop, or on Merc on the song.
  const unlocksOnTop = (): boolean => view().state === 'between'

  const litTo = (): number => {
    const v = view()
    return v.next ?? v.stops.length - 1
  }

  return (
    <div
      ref={root}
      class={`${styles.path} ${surface.surface} mp-dark-stage`}
      style={{ '--sky-top': SKY_TOP, '--sky-bottom': SKY_BOTTOM }}
      data-state={view().state}
      data-still={still ? 'true' : 'false'}
      data-wide={screen.box().width > frame().column ? 'true' : 'false'}
      data-testid="warm-up-path"
      onPointerDown={onPointerDown}
    >
      <div
        ref={scroller}
        class={styles.scroller}
        data-scrolls={frame().scrolls ? 'true' : 'false'}
      >
        <PathColumn
          frame={frame()}
          mode={mode()}
          stops={view().stops}
          drawingIn={motion.drawingIn()}
          litTo={
            view().state === 'start' || view().state === 'locked' ? 0 : litTo()
          }
          trailIn={motion.trailIn()}
          unlit={motion.unlit()}
          brightened={motion.brightened()}
          endLit={motion.endLit()}
          burst={motion.burst()}
          pack={motion.pack()}
          pulsing={pulsing()}
          merc={motion.merc()}
          mercState={motion.mercState()}
          hopping={motion.hopping()}
          hopPace={motion.hopPace()}
          mercFaded={motion.mercFaded()}
          still={still || prefersReducedMotion()}
          onSong={() => props.onSong()}
          onSkySettled={() => props.onSkySettled?.()}
        />
      </div>
      <div
        class={styles.glow}
        data-end={mode() === 'end' && motion.endLit()}
        aria-hidden="true"
      />
      <div ref={topZone} class={styles.top} data-testid="warm-up-top">
        <Show
          when={view().state === 'end'}
          fallback={
            <>
              <Show when={view().chip}>
                {(chip) => (
                  <span class={styles.chip} data-testid="warm-up-chip">
                    {chip()}
                  </span>
                )}
              </Show>
              <Show when={view().week}>
                {(week) => (
                  <span class={styles.week}>
                    <WeekDots dots={week()} size="path" testId="warm-up-week" />
                  </span>
                )}
              </Show>
            </>
          }
        >
          <h2 class={styles.title} data-testid="warm-up-title">
            {PATH_WORDS.warmedUp}
          </h2>
          <p class={styles.today}>{view().today}</p>
        </Show>
        <Show when={view().state === 'locked'}>
          <p class={styles.freeUsed}>{PATH_WORDS.freeUsed}</p>
        </Show>
        <Show when={unlocksOnTop()}>
          <div class={styles.unlocks}>
            <UnlockList items={source.unlocks} testId="warm-up-unlock" />
          </div>
        </Show>
      </div>
      <div class={styles.bottom} data-testid="warm-up-bottom">
        <Show when={!unlocksOnTop()}>
          <div class={styles.unlocks}>
            <UnlockList items={source.unlocks} testId="warm-up-unlock" />
          </div>
        </Show>
        <PathActions
          view={view()}
          card={motion.card()}
          actions={motion.actions()}
          counting={motion.counting()}
          onNext={() => enter(view().next)}
          onAgain={(index) => enter(index)}
          onSkip={() => source.skipNext()}
          onStay={() => motion.stay()}
          onDone={() => props.onDone()}
          onSong={() => props.onSong()}
          onWarmUpAgain={() => source.again()}
          onPremium={props.onPremium}
        />
      </div>
      <div ref={bottomEdge} class={styles.bottomEdge} aria-hidden="true" />
      <p class={styles.said} role="status" aria-live="polite">
        {saidNow(view(), motion.counting(), motion.card())}
      </p>
      <Show when={levelShown(view())}>
        <RoomBarEnd>
          {/* A tap on the level stops the countdown: its sheet must not
              open over a room. */}
          <span class={styles.level} onClick={() => motion.stay()}>
            <LevelControl lines={WARM_UP_LEVEL_LINES} testId="warm-up-level" />
          </span>
        </RoomBarEnd>
      </Show>
    </div>
  )
}
