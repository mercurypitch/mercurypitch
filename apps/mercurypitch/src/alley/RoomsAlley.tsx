// ============================================================
// RoomsAlley — the Rooms tab, and the welcome, under the native build
// ============================================================
//
// The night alley with six lit doorways (S4, owner decisions 1-3). It is the
// first-run welcome — the same picture with a headline over it — and the
// Rooms tab on every visit after. The web keeps its card gallery: this lives
// in the app package, is mounted by the native shell, and the web bundle
// cannot see it.
//
// CONSTRUCTION A, PAINTED DOORS. At rest nothing is drawn over the plate: the
// doors ARE the plate. A selected door is a second cover-fit copy of the plate
// clipped to its quad and lifted toward the viewer, with a rim, the room's
// light on the cobbles, and a 35% dim over everything else. The Sing door
// plays its tape-reel loop mapped through the door's homography; the Ear Lab
// door drifts its own pixels for eight seconds. Both fade their room's
// ambient in. A locked door lifts and says "Coming soon".
//
// ONE SURFACE TAKES EVERY TOUCH in the door band and routes it to the nearest
// door (`pickDoor`): at 393 px the three left bays are about five px apart and
// the Ear Lab is 28 px wide against the edge, so six 44 px boxes would
// collide. The six door buttons behind it are the keyboard's and the screen
// reader's way in, with the lab's accessible names, and take no pointer.
//
// SOUND NEVER STARTS ON ARRIVAL. The clip's `play()` and the ambient's
// context are both started inside the door tap, and nowhere else.

import { fetchAssetRead } from '@irchiinnuss/mobile-runtime/asset-fetch'
import { hapticTap } from '@irchiinnuss/mobile-runtime/platform'
import type { Component } from 'solid-js'
import { batch, createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, untrack, } from 'solid-js'
import './alley.css'
import { roomName } from '@/features/rooms/room-names'
import { audioReporter } from '@/lib/audio-diagnostics'
import { activateAudioPlayback } from '@/lib/audio-unlock'
import { exposeForE2E } from '@/lib/test-utils'
import { holdRoomArrival, registerSkipTarget, roomArrivalHeld, } from '@/stores/native-shell-store'
import { currentTab, shellCovered } from '../shell/run-shell-store'
import { goToTab, registerDoorClear, registerDoorOpen, } from '../shell/shell-navigation'
import type { AlleyAmbient } from './alley-audio'
import { createAlleyAmbient } from './alley-audio'
import { ALLEY_COPY, doorLabel } from './alley-copy'
import type { DoorOpen } from './alley-entry'
import { OPEN_MS, openDoor, REDUCED_MS } from './alley-entry'
import type { AlleyFrame, DoorLayout } from './alley-geometry'
import { alleyFit, dimPath, layoutDoors, pickDoor, placePanel, tapBand, } from './alley-geometry'
import type { AlleyEvent, AlleyState } from './alley-machine'
import { ALLEY_REST, alleyReducer, isLifted } from './alley-machine'
import type { DoorKey } from './alley-plate'
import { ALLEY_PLATE, DOORS, doorSpec, isEnterable, plateSourceFor, } from './alley-plate'
import { dropRoom, pickRoom, takeRoom } from './alley-room'
import { markWelcomeSeen, welcomeSeen } from './alley-welcome'
import { AlleyCard } from './AlleyCard'
import { AlleyDoor } from './AlleyDoor'

/** The ambient's fades (S4 §2): in over 600 ms, out over 520 from the open. */
const FADE_IN_MS = 600
const FADE_OUT_MS = 520
/** A selection cleared, or the alley left, fades faster than an open. */
const CLEAR_MS = 320
/** The door settling back after a room (keep in step with alley.css). */
const SETTLE_MS = 360
/** A measured edge that moved by less than this has not moved. */
const MEASURE_EPSILON = 0.5

// The alley's state outlives the component: the open unmounts it (the tab
// changes under the clone), and Back has to find the door it opened.
const [alley, setAlley] = createSignal<AlleyState>(ALLEY_REST)

function dispatch(event: AlleyEvent): AlleyState {
  const next = alleyReducer(untrack(alley), event, isEnterable)
  setAlley(next)
  return next
}

// The open in flight, if any. Back and a rail tab reach it through the
// shell's registry, a tap anywhere outside the alley (More, the corner chip)
// through a capture listener, and the alley's own unmount directly. Whichever
// comes first calls it off and the door goes back to rest.
interface InFlight {
  readonly cancel: () => boolean
  /** Unregister and stop listening; the open is over either way. */
  readonly done: () => void
}
let inFlight: InFlight | null = null

function finishOpen(): void {
  const open = inFlight
  inFlight = null
  open?.done()
}

function cancelOpen(): boolean {
  const open = inFlight
  if (open === null) return false
  finishOpen()
  const cancelled = open.cancel()
  if (cancelled) dispatch({ type: 'cancel' })
  return cancelled
}

function onPressOutside(event: Event): void {
  const target = event.target
  if (target instanceof Element && target.closest('.mp-alley') !== null) return
  cancelOpen()
}

let ambientInstance: AlleyAmbient | null = null

function ambient(): AlleyAmbient {
  ambientInstance ??= createAlleyAmbient({
    createContext: () => {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      return Ctor === undefined ? null : new Ctor()
    },
    // Not `response.ok`: iOS serves a packaged .m4a with status 0 and the
    // whole body (@irchiinnuss/mobile-runtime/asset-fetch). The status is
    // kept for the report, which is the Developer screen's Audio section.
    load: (url) => fetchAssetRead(url),
    activate: (target) => activateAudioPlayback(target),
    report: audioReporter('alley'),
  })
  return ambientInstance
}

export const RoomsAlley: Component = () => {
  let root: HTMLDivElement | undefined
  let panel: HTMLDivElement | undefined
  let card: HTMLDivElement | undefined
  let singVideo: HTMLVideoElement | undefined
  let top: HTMLDivElement | undefined

  const [size, setSize] = createSignal({
    w: window.innerWidth,
    h: window.innerHeight,
  })
  // The headline block's measured bottom: the band starts under it, whatever
  // the safe area and the headline's line count make of it. A tap on the
  // words falls through to the plate and clears a selection.
  const [topBottom, setTopBottom] = createSignal(0)
  // On its side the block stands left of the doors instead (alley.css): its
  // right edge and its top padding (the safe top) bound the band there.
  const [topRight, setTopRight] = createSignal(0)
  const [topPad, setTopPad] = createSignal(0)
  // The dock's top. With the headline's bottom it is the room a landscape
  // screen gives the doors (`alleyFit`).
  const [floor, setFloor] = createSignal(window.innerHeight)
  // The right safe-area inset (--safe-right): an Android cutout on its side.
  const [safeRight, setSafeRight] = createSignal(0)
  const landscape = (): boolean => size().w > size().h
  const frame = (): AlleyFrame =>
    landscape()
      ? {
          top: topPad(),
          bottom: floor(),
          left: topRight(),
          right: size().w - safeRight(),
        }
      : { top: topBottom(), bottom: floor() }
  const fit = createMemo(() =>
    alleyFit(ALLEY_PLATE, DOORS, size().w, size().h, frame()),
  )
  const doors = createMemo(() =>
    layoutDoors(ALLEY_PLATE, DOORS, size().w, size().h, frame()),
  )
  /** The plate as `alleyFit` placed it, for every copy of it drawn. */
  const plateStyle = (): Record<string, string> => ({
    left: `${-fit().ox}px`,
    top: `${-fit().oy}px`,
    width: `${fit().width}px`,
    height: `${fit().height}px`,
  })
  const band = createMemo(() =>
    // Beside the block on its side, the band needs no clamp from above.
    tapBand(
      doors(),
      size().w,
      size().h,
      landscape() ? 0 : topBottom(),
      size().w - safeRight(),
    ),
  )
  const layoutOf = (key: DoorKey): DoorLayout =>
    doors().find((door) => door.key === key) ?? doors()[0]
  // The 1x file unless it would be upscaled at the scale it is drawn at.
  const plate = createMemo(() =>
    plateSourceFor(fit().scale, window.devicePixelRatio || 1),
  )

  const reduced = (): boolean =>
    root?.closest('.mp-shell')?.getAttribute('data-reduced') === 'on' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const selected = (): DoorKey | null => {
    const state = alley()
    return state.phase === 'selected' ||
      state.phase === 'alive' ||
      state.phase === 'opening'
      ? state.door
      : null
  }
  const aliveDoor = (): DoorKey | null =>
    alley().phase === 'alive' || alley().phase === 'opening'
      ? alley().door
      : null
  const cardDoor = (): DoorKey | null => {
    const state = alley()
    return state.phase === 'selected' || state.phase === 'alive'
      ? state.door
      : null
  }
  // The headline is taken off only by a remount: flipping the flag on the
  // open must not pull it while the door is still growing. It comes BACK at
  // once, though — "Replay the welcome" resets the flag with the alley
  // already on screen.
  const [first, setFirst] = createSignal(!welcomeSeen())
  createEffect(() => {
    if (!welcomeSeen()) setFirst(true)
  })

  /**
   * The Sing door's clip lets go of its source and its decoder. It has one
   * only while Sing is out: a <video> with a src, even paused, holds a media
   * pipeline (and on Chrome a decoded first frame) for as long as it exists.
   * Not while it is in the clone: that one is the open's, and the open
   * unloads it once the room has drawn.
   */
  const releaseClip = (): void => {
    const clip = singVideo
    if (clip === undefined || clip.closest('.mp-alley-morph') !== null) return
    clip.pause()
    if (clip.getAttribute('src') === null) return
    clip.removeAttribute('src')
    clip.load()
  }

  const quiet = (fadeMs: number): Promise<void> => {
    releaseClip()
    return ambient().stop(fadeMs)
  }

  /** Everything a door tap does, inside the tap. */
  const tapDoor = (key: DoorKey): void => {
    const before = alley()
    const next = dispatch({
      type: 'tap-door',
      key,
      enterable: isEnterable(key),
    })
    if (next === before) return
    if (next.phase === 'opening') {
      open()
      return
    }
    void hapticTap()
    const spec = doorSpec(key)
    // The room's own picture starts decoding now, not on Enter.
    pickRoom(spec)
    if (before.door !== null && before.door !== key) {
      // Another door was out: its clip stops, its ambient hands over below
      // (or fades out, for a locked door that has none).
      releaseClip()
      if (spec.ambient === null) void ambient().stop(CLEAR_MS)
    }
    if (spec.tab !== null) {
      if (spec.clip !== null && singVideo !== undefined) {
        // The source is set here, in the tap, and not at mount: a visit that
        // never picks Sing never loads the loop.
        if (singVideo.getAttribute('src') !== spec.clip) {
          singVideo.src = spec.clip
        }
        singVideo.muted = true
        void singVideo.play().catch(() => undefined)
      }
      if (spec.ambient !== null) {
        ambient().start(spec.ambient, reduced() ? REDUCED_MS : FADE_IN_MS)
      }
      dispatch({ type: 'wake' })
    }
    queueMicrotask(() => card?.focus({ preventScroll: true }))
  }

  const clear = (): void => {
    const state = alley()
    if (state.phase !== 'selected' && state.phase !== 'alive') return
    dispatch({ type: 'tap-plate' })
    void quiet(reduced() ? REDUCED_MS : CLEAR_MS)
  }

  // Covered without being left: More, a pushed screen, the chip's column or
  // the Keep alert. The alley stays mounted under all of them, so nothing
  // else would stop a picked door's ambient and clip — they played on under
  // Settings for as long as it was up. The door goes back into the plate.
  createEffect(
    on(shellCovered, (covered) => {
      if (!covered) return
      const phase = untrack(alley).phase
      if (phase !== 'selected' && phase !== 'alive') return
      dispatch({ type: 'leave' })
      void quiet(reduced() ? REDUCED_MS : CLEAR_MS)
    }),
  )
  // Whatever brought the alley back to rest — a clear, a leave, an open
  // called off with the clip put back in its door — the clip lets go, and so
  // does the room's picture (an open has taken its own over by then).
  createEffect(
    on(
      () => alley().phase,
      (phase) => {
        if (phase !== 'rest') return
        releaseClip()
        dropRoom()
      },
    ),
  )

  /** Focus on the door's key: where a keyboard reader goes back to. */
  const focusKey = (door: DoorKey | null): void => {
    if (door === null) return
    root
      ?.querySelector<HTMLButtonElement>(`.mp-alley__key[data-door="${door}"]`)
      ?.focus({ preventScroll: true })
  }

  /**
   * Call the open off from here — Escape, or Back through the shell — and
   * give focus back to the door that was opening. Enter was unmounted with
   * the card when the open began, so focus was on <body>. Only when it still
   * is and the alley is still where it was: a rail tab calls the open off on
   * its way out, and its own button keeps the focus it has.
   */
  const cancelHere = (): boolean => {
    const door = untrack(alley).door
    const hash = window.location.hash
    const cancelled = cancelOpen()
    if (cancelled) {
      queueMicrotask(() => {
        const active = document.activeElement
        const lost = active === null || active === document.body
        if (lost && root?.isConnected === true && window.location.hash === hash)
          focusKey(door)
      })
    }
    return cancelled
  }

  /** Enter, or the selected door tapped again. Inside the tap. */
  const open = (): void => {
    let state = alley()
    if (state.phase === 'selected' || state.phase === 'alive') {
      state = dispatch({ type: 'enter' })
    }
    if (state.phase !== 'opening' || state.door === null) return
    const key = state.door
    const spec = doorSpec(key)
    if (spec.tab === null) return
    const tab = spec.tab
    const ambientSilent = ambient().stop(reduced() ? REDUCED_MS : FADE_OUT_MS)
    const clip =
      spec.clip !== null && singVideo !== undefined && !singVideo.paused
        ? singVideo
        : null
    // The door's own route, as the cover left it: the room may rewrite the
    // hash as it mounts, so "elsewhere" is a different hash AND a different
    // tab, or a sheet or screen the shell put over the room.
    let arrivedHash: string | null = null
    // Held until the clone is gone, not until this unmounts (alley-room.ts).
    const room = takeRoom(spec)
    let handle: DoorOpen
    try {
      handle = openDoor({
        door: layoutOf(key),
        width: size().w,
        height: size().h,
        reduced: reduced(),
        video: clip,
        room: room?.source() ?? null,
        plateSrc: plate(),
        plateBox: {
          x: -fit().ox,
          y: -fit().oy,
          w: fit().width,
          h: fit().height,
        },
        ambientSilent,
        onCovered: () => {
          finishOpen()
          dispatch({ type: 'covered' })
          // The welcome is over when a room is reached, not when Enter is
          // pressed: an open called off leaves it to be seen again.
          markWelcomeSeen()
          goToTab(tab)
          arrivedHash = window.location.hash
        },
        away: () =>
          untrack(shellCovered) ||
          (untrack(currentTab) !== tab && window.location.hash !== arrivedHash),
        holdArrival: holdRoomArrival,
      })
    } catch (error) {
      // Nothing is growing and nothing can call it off: left in 'opening',
      // the alley dropped every tap, Escape and Back until a tab change.
      // openDoor has let the hold go and put the clip back; the door goes
      // back into the plate and the alley takes taps again.
      dispatch({ type: 'cancel' })
      room?.release()
      console.error('The door did not open:', error)
      return
    }
    void handle.done.then(() => room?.release())
    const unregister = registerDoorOpen(cancelHere)
    document.addEventListener('pointerdown', onPressOutside, true)
    inFlight = {
      cancel: handle.cancel,
      done: () => {
        unregister()
        document.removeEventListener('pointerdown', onPressOutside, true)
      },
    }
  }

  const onSurface = (event: MouseEvent): void => {
    if (root === undefined) return
    const box = root.getBoundingClientRect()
    const x = ((event.clientX - box.left) * size().w) / box.width
    const y = ((event.clientY - box.top) * size().h) / box.height
    tapDoor(pickDoor([x, y], doors()).key)
  }

  const onRoot = (event: MouseEvent): void => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('.mp-alley__hit, .mp-alley__panel, .mp-alley__key')) {
      return
    }
    clear()
  }

  // Where the card sits: measured, so a card with no Enter sits lower, and
  // kept above whatever the dock is drawing (the rail, or the pill over it).
  createEffect(
    on([cardDoor, doors], ([key]) => {
      if (key === null || panel === undefined) return
      const dock = document.querySelector('.mp-dock')
      const floor = dock?.getBoundingClientRect().top ?? size().h
      const spot = placePanel(
        layoutOf(key),
        size().w,
        floor,
        panel.offsetHeight,
      )
      panel.style.left = `${spot.x}px`
      panel.style.top = `${spot.y}px`
    }),
  )

  onMount(() => {
    // Every read first, then every write in one batch. A write restyles the
    // alley and a read after it forces a layout, so interleaving them paid up
    // to four synchronous layouts per rotation. Nothing read here depends on
    // what is written — the root is fixed to the viewport, the top block's
    // box is its own CSS, the dock is the shell's — so a delivery settles in
    // one pass, and a value that moved by less than half a pixel is not news.
    const measure = (): void => {
      if (root === undefined) return
      const w = root.clientWidth
      const h = root.clientHeight
      const block =
        top === undefined
          ? null
          : {
              bottom: Math.ceil(top.offsetTop + top.offsetHeight),
              right: Math.ceil(top.offsetLeft + top.offsetWidth),
              pad: Math.ceil(
                Number.parseFloat(window.getComputedStyle(top).paddingTop) || 0,
              ),
            }
      const dock = document.querySelector('.mp-dock')
      const dockTop =
        dock === null ? h : Math.floor(dock.getBoundingClientRect().top)
      const inset = Math.ceil(
        Number.parseFloat(
          window.getComputedStyle(root).getPropertyValue('--safe-right'),
        ) || 0,
      )
      const moved = (value: number, was: number): boolean =>
        Math.abs(value - was) > MEASURE_EPSILON
      batch(() => {
        const now = untrack(size)
        if (w > 0 && h > 0 && (moved(w, now.w) || moved(h, now.h))) {
          setSize({ w, h })
        }
        if (block !== null) {
          if (moved(block.bottom, untrack(topBottom))) {
            setTopBottom(block.bottom)
          }
          if (moved(block.right, untrack(topRight))) setTopRight(block.right)
          if (moved(block.pad, untrack(topPad))) setTopPad(block.pad)
        }
        if (dockTop > 0 && moved(dockTop, untrack(floor))) setFloor(dockTop)
        if (moved(inset, untrack(safeRight))) setSafeRight(inset)
      })
    }
    measure()
    // iPad and Android rotate; the doors are recomputed, not assumed. The
    // top block is watched too: the safe area and the headline size it.
    const observer = new ResizeObserver(measure)
    if (root !== undefined) observer.observe(root)
    // Border box: the safe area is padding, and the content box ignores it.
    if (top !== undefined) observer.observe(top, { box: 'border-box' })
    // And the dock, whose top is the landscape band's floor: its safe-bottom
    // padding and its accessory slot move that top without resizing us.
    const dock = document.querySelector('.mp-dock')
    if (dock !== null) observer.observe(dock, { box: 'border-box' })
    onCleanup(() => observer.disconnect())

    // Back from a room: the door it opened settles into place.
    const state = untrack(alley)
    if (state.phase === 'open' || state.phase === 'opening') {
      dispatch({ type: 'returned' })
      const timer = window.setTimeout(
        () => dispatch({ type: 'settled' }),
        reduced() ? REDUCED_MS : SETTLE_MS,
      )
      onCleanup(() => window.clearTimeout(timer))
    }

    // "Skip to main content" lands here: <main> is empty on this tab.
    if (root !== undefined) onCleanup(registerSkipTarget(root))

    // Escape and Back put a door back, as a tap on the plate does: the card
    // goes and the ambient fades out. True when there was one to put back.
    const putBack = (): boolean => {
      const state = alley()
      if (state.phase !== 'selected' && state.phase !== 'alive') return false
      clear()
      // The card that had focus is gone: focus goes back to the door it was
      // for, not to <body>, so the next Tab starts where the reader was.
      focusKey(state.door)
      return true
    }
    onCleanup(registerDoorClear(putBack))
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // Mid-grow it is Back: the open is called off and the alley stays.
      if (alley().phase === 'opening') {
        if (cancelHere()) event.preventDefault()
        return
      }
      if (putBack()) event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    onCleanup(() => window.removeEventListener('keydown', onKey))

    // The app going to the background takes the door's sound with it, and
    // coming back leaves the ambient's context suspect (alley-audio.ts).
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        ambientInstance?.recover()
        return
      }
      if (document.visibilityState !== 'hidden') return
      const phase = alley().phase
      if (phase === 'selected' || phase === 'alive') {
        dispatch({ type: 'leave' })
        void quiet(REDUCED_MS)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    onCleanup(() => {
      document.removeEventListener('visibilitychange', onVisibility)
    })

    // For the walk: what the alley thinks, and what its ambient is doing.
    // Written only under `window.E2E_TEST_MODE`. Deliberately not a tracked
    // scope: a walk polls it, one call at a time.
    // eslint-disable-next-line solid/reactivity
    exposeForE2E('mpAlley', () => ({
      phase: alley().phase,
      door: alley().door,
      welcomeSeen: welcomeSeen(),
      firstRun: first(),
      sounding: ambientInstance?.sounding() ?? null,
      level: ambientInstance?.level() ?? 0,
      sources: ambientInstance?.sourcesStarted() ?? 0,
      reduced: reduced(),
      openMs: OPEN_MS,
      held: roomArrivalHeld(),
      silentAt: ambientInstance?.stoppedAt() ?? null,
    }))
  })

  onCleanup(() => {
    // Unmounted under an open that has not covered (a deep link, a tab
    // change nothing here saw coming): the open is called off, not left to
    // navigate on top of wherever the app went.
    if (untrack(alley).phase === 'opening') cancelOpen()
    // Leaving mid-selection (a rail tab): no sound left behind. An open
    // that has covered owns its own fade, and the clip has moved into the clone.
    const phase = untrack(alley).phase
    if (phase === 'selected' || phase === 'alive' || phase === 'settling') {
      dispatch({ type: 'leave' })
      void quiet(REDUCED_MS)
    }
    // Its context and decoded buffers go once the last fade has run; the
    // next door tap rebuilds them.
    ambientInstance?.dispose()
    // The Sing door's clip lets go of its decoder: an unmounted <video> with
    // a src keeps its buffer and its hardware decoder until it is collected.
    releaseClip()
    dropRoom()
  })

  return (
    <div
      ref={root}
      class="mp-alley"
      id="rooms-alley"
      tabIndex={-1}
      data-testid="rooms-alley"
      data-phase={alley().phase}
      data-door={alley().door ?? ''}
      data-first={first() ? 'on' : 'off'}
      onClick={onRoot}
    >
      <div class="mp-alley__plate" aria-hidden="true">
        <img
          src={plate()}
          alt=""
          decoding="async"
          style={plateStyle()}
          data-testid="alley-plate"
        />
        <div class="mp-alley__scrim" />
      </div>

      {/* The top: the mark, and the headline on a first run or the compact
          title after. First in the alley, so a screen reader entering it
          starts here (S4 §2) — but not first in the document: the shell is
          portalled after the app, so the app's skip link is what brings a
          reader here (`registerSkipTarget` above). A div, not a <header>:
          app.css styles every header as the web's top bar. */}
      <div ref={top} class="mp-alley__top" data-testid="alley-top">
        <img
          class="mp-alley__mark"
          src="/brand-mark.svg"
          alt={ALLEY_COPY.brand}
          width="28"
          height="28"
        />
        <Show
          when={first()}
          fallback={
            <h1 class="mp-alley__title" data-testid="alley-title">
              {ALLEY_COPY.returnTitle}
            </h1>
          }
        >
          <div class="mp-alley__intro" data-testid="alley-welcome">
            <h1 class="mp-alley__headline" data-testid="alley-headline">
              {ALLEY_COPY.headline}
            </h1>
            <p class="mp-alley__subline" data-testid="alley-subline">
              {ALLEY_COPY.subline}
            </p>
          </div>
        </Show>
      </div>

      <div class="mp-alley__stage" aria-hidden="true">
        {/* Over the static specs, not the layout: a resize must move the
            doors, not rebuild them — a rebuilt Sing door is a new <video>. */}
        <For each={DOORS}>
          {(spec) => (
            <AlleyDoor
              spec={spec}
              layout={() => layoutOf(spec.key)}
              fit={fit}
              plateSrc={plate}
              plateStyle={plateStyle}
              lifted={() => isLifted(alley(), spec.key)}
              selected={() => selected() === spec.key}
              alive={() => aliveDoor() === spec.key}
              settling={() =>
                alley().phase === 'settling' && alley().door === spec.key
              }
              clipRef={(element) => {
                singVideo = element
              }}
            />
          )}
        </For>
        <svg class="mp-alley__dim" viewBox={`0 0 ${size().w} ${size().h}`}>
          <path
            fill="#05070c"
            fill-opacity="0.35"
            fill-rule="evenodd"
            d={dimPath(
              size().w,
              size().h,
              selected() === null ? null : layoutOf(selected() as DoorKey),
            )}
          />
        </svg>
      </div>

      <div
        class="mp-alley__hit"
        role="presentation"
        data-testid="alley-hit"
        style={{
          left: `${band().x}px`,
          top: `${band().y}px`,
          width: `${band().w}px`,
          height: `${band().h}px`,
        }}
        onClick={onSurface}
      />

      <div
        class="mp-alley__keys"
        role="group"
        aria-label={ALLEY_COPY.doorsLabel}
      >
        <For each={DOORS}>
          {(spec) => {
            const door = (): DoorLayout => layoutOf(spec.key)
            return (
              <button
                type="button"
                class="mp-alley__key"
                data-testid={`alley-door-${spec.key}`}
                data-door={spec.key}
                aria-label={doorLabel(
                  spec.key,
                  roomName(doorSpec(spec.key).roomId),
                  isEnterable(spec.key),
                )}
                aria-pressed={selected() === spec.key}
                style={{
                  left: `${door().x0}px`,
                  top: `${door().y0}px`,
                  width: `${Math.round((door().x1 - door().x0) * 10) / 10}px`,
                  height: `${Math.round((door().y1 - door().y0) * 10) / 10}px`,
                }}
                onClick={() => tapDoor(spec.key)}
              />
            )
          }}
        </For>
      </div>

      <AlleyCard
        panelRef={(element) => {
          panel = element
        }}
        cardRef={(element) => {
          card = element
        }}
        door={cardDoor}
        onEnter={open}
      />
    </div>
  )
}
