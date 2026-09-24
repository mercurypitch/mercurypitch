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

import { hapticTap } from '@irchiinnuss/mobile-runtime/platform'
import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, untrack, } from 'solid-js'
import './alley.css'
import { roomName } from '@/features/rooms/room-names'
import { activateAudioPlayback } from '@/lib/audio-unlock'
import { exposeForE2E } from '@/lib/test-utils'
import { holdRoomArrival, registerSkipTarget, roomArrivalHeld, } from '@/stores/native-shell-store'
import { goToTab, registerDoorOpen } from '../shell/shell-navigation'
import type { AlleyAmbient } from './alley-audio'
import { createAlleyAmbient } from './alley-audio'
import { ALLEY_COPY, DOOR_LINE, doorLabel, doorTitle } from './alley-copy'
import { OPEN_MS, openDoor, REDUCED_MS } from './alley-entry'
import type { AlleyFrame, DoorLayout } from './alley-geometry'
import { alleyFit, dimPath, layoutDoors, matrix3d, PANEL_WIDTH, pickDoor, placePanel, rectToQuad, tapBand, } from './alley-geometry'
import type { AlleyEvent, AlleyState } from './alley-machine'
import { ALLEY_REST, alleyReducer, isLifted } from './alley-machine'
import type { DoorKey } from './alley-plate'
import { ALLEY_PLATE, DOORS, doorSpec, isEnterable, plateSourceFor, } from './alley-plate'
import { markWelcomeSeen, welcomeSeen } from './alley-welcome'

/** The ambient's fades (S4 §2): in over 600 ms, out over 520 from the open. */
const FADE_IN_MS = 600
const FADE_OUT_MS = 520
/** A selection cleared, or the alley left, fades faster than an open. */
const CLEAR_MS = 320
/** The door settling back after a room (keep in step with alley.css). */
const SETTLE_MS = 360

const ROOM_BACKGROUND: Partial<Record<DoorKey, string>> = {
  sing: '[data-testid="sing-cover"]',
  ear: '[data-testid="ear-room-art"]',
}

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
    load: async (url) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${url}: ${response.status}`)
      return response.arrayBuffer()
    },
    activate: (target) => activateAudioPlayback(target),
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
  const landscape = (): boolean => size().w > size().h
  const frame = (): AlleyFrame =>
    landscape()
      ? { top: topPad(), bottom: floor(), left: topRight() }
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
    tapBand(doors(), size().w, size().h, landscape() ? 0 : topBottom()),
  )
  const layoutOf = (key: DoorKey): DoorLayout =>
    doors().find((door) => door.key === key) ?? doors()[0]
  // The 1x file unless it would be upscaled on this screen.
  const plate = createMemo(() =>
    plateSourceFor(size().w, size().h, window.devicePixelRatio || 1),
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

  const quiet = (fadeMs: number): Promise<void> => {
    singVideo?.pause()
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
    if (before.door !== null && before.door !== key) {
      // Another door was out: its clip stops, its ambient hands over below
      // (or fades out, for a locked door that has none).
      singVideo?.pause()
      if (spec.ambient === null) void ambient().stop(CLEAR_MS)
    }
    if (spec.tab !== null) {
      if (spec.clip !== null && singVideo !== undefined) {
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
    const handle = openDoor({
      door: layoutOf(key),
      width: size().w,
      height: size().h,
      reduced: reduced(),
      video: clip,
      plateSrc: plate(),
      plateBox: {
        x: -fit().ox,
        y: -fit().oy,
        w: fit().width,
        h: fit().height,
      },
      roomBackground: ROOM_BACKGROUND[key] ?? '[data-room-background]',
      ambientSilent,
      onCovered: () => {
        finishOpen()
        dispatch({ type: 'covered' })
        // The welcome is over when a room is reached, not when Enter is
        // pressed: an open called off leaves it to be seen again.
        markWelcomeSeen()
        goToTab(tab)
      },
      holdArrival: holdRoomArrival,
    })
    const unregister = registerDoorOpen(cancelOpen)
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
    const measure = (): void => {
      if (root === undefined) return
      const w = root.clientWidth
      const h = root.clientHeight
      const now = untrack(size)
      if (w > 0 && h > 0 && (w !== now.w || h !== now.h)) setSize({ w, h })
      if (top !== undefined) {
        const bottom = Math.ceil(top.offsetTop + top.offsetHeight)
        if (bottom !== untrack(topBottom)) setTopBottom(bottom)
        const right = Math.ceil(top.offsetLeft + top.offsetWidth)
        if (right !== untrack(topRight)) setTopRight(right)
        const pad = Math.ceil(
          Number.parseFloat(window.getComputedStyle(top).paddingTop) || 0,
        )
        if (pad !== untrack(topPad)) setTopPad(pad)
      }
      const dock = document.querySelector('.mp-dock')
      const dockTop =
        dock === null ? h : Math.floor(dock.getBoundingClientRect().top)
      if (dockTop > 0 && dockTop !== untrack(floor)) setFloor(dockTop)
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

    // Escape puts a door back, as a tap on the plate does: the card goes and
    // the ambient fades out.
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const phase = alley().phase
      // Mid-grow it is Back: the open is called off and the alley stays.
      if (phase === 'opening') {
        if (cancelOpen()) event.preventDefault()
        return
      }
      if (phase !== 'selected' && phase !== 'alive') return
      event.preventDefault()
      const door = alley().door
      clear()
      // The card that had focus is gone: focus goes back to the door it was
      // for, not to <body>, so the next Tab starts where the reader was.
      root
        ?.querySelector<HTMLButtonElement>(
          `.mp-alley__key[data-door="${door}"]`,
        )
        ?.focus({ preventScroll: true })
    }
    window.addEventListener('keydown', onKey)
    onCleanup(() => window.removeEventListener('keydown', onKey))

    // The app going to the background takes the door's sound with it.
    const onVisibility = (): void => {
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
    // Leaving mid-selection (the rail, More): no sound left behind. An open
    // that has covered owns its own fade, and the clip has moved into the clone.
    const phase = untrack(alley).phase
    if (phase === 'selected' || phase === 'alive' || phase === 'settling') {
      dispatch({ type: 'leave' })
      void quiet(REDUCED_MS)
    }
    // The Sing door's clip lets go of its decoder: an unmounted <video> with
    // a src keeps its buffer and its hardware decoder until it is collected.
    // Not while it is in the clone: that one is the open's, and the open
    // unloads it once the room has drawn.
    const clip = singVideo
    if (clip !== undefined && clip.closest('.mp-alley-morph') === null) {
      clip.pause()
      clip.removeAttribute('src')
      clip.load()
    }
  })

  const quadCss = (door: DoorLayout): string =>
    `polygon(${door.quad.map((p) => `${p[0]}px ${p[1]}px`).join(', ')})`

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
          {(spec) => {
            const door = (): DoorLayout => layoutOf(spec.key)
            const artW = (): number =>
              Math.max(1, Math.round(door().x1 - door().x0))
            const artH = (): number =>
              Math.max(1, Math.round(door().y1 - door().y0))
            return (
              <div
                class="mp-alley__door"
                data-door={spec.key}
                data-locked={spec.tab === null ? 'yes' : 'no'}
                classList={{
                  'is-lifted': isLifted(alley(), spec.key),
                  'is-selected': selected() === spec.key,
                  'is-alive': aliveDoor() === spec.key,
                  'is-settling':
                    alley().phase === 'settling' && alley().door === spec.key,
                  'is-drifting': spec.drift,
                }}
                style={{
                  '--cx': `${door().cx}px`,
                  '--cy': `${door().cy}px`,
                  '--sx': `${Math.round((door().quad[2][0] + door().quad[3][0]) / 2)}px`,
                  '--sy': `${Math.round((door().quad[2][1] + door().quad[3][1]) / 2)}px`,
                  '--sw': `${Math.round((door().x1 - door().x0) * 2.4)}px`,
                  '--spill': spec.spill,
                }}
              >
                <div
                  class="mp-alley__paint"
                  style={{ 'clip-path': quadCss(door()) }}
                >
                  <img src={plate()} alt="" style={plateStyle()} />
                </div>
                <Show when={spec.clip}>
                  {(clip) => (
                    <div
                      class="mp-alley__art"
                      style={{
                        width: `${artW()}px`,
                        height: `${artH()}px`,
                        transform: matrix3d(
                          rectToQuad(artW(), artH(), door().quad),
                        ),
                      }}
                    >
                      <video
                        ref={(element) => {
                          singVideo = element
                          element.muted = true
                          element.defaultMuted = true
                        }}
                        class="mp-alley__clip"
                        src={clip()}
                        muted
                        loop
                        playsinline
                        preload={selected() === 'sing' ? 'auto' : 'metadata'}
                        disablepictureinpicture
                        tabIndex={-1}
                        data-testid="alley-clip"
                      />
                    </div>
                  )}
                </Show>
                <svg
                  class="mp-alley__rim"
                  viewBox={`0 0 ${size().w} ${size().h}`}
                >
                  <polygon class="mp-alley__rim-halo" points={door().points} />
                  <polygon class="mp-alley__rim-line" points={door().points} />
                </svg>
                <div class="mp-alley__spill" />
              </div>
            )
          }}
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

      <div
        ref={panel}
        class="mp-alley__panel"
        classList={{ 'is-shown': cardDoor() !== null }}
        style={{ width: `${PANEL_WIDTH}px` }}
        data-testid="alley-panel"
        aria-hidden={cardDoor() === null}
      >
        <Show when={cardDoor()}>
          {(key) => (
            <>
              <div
                ref={card}
                class="mp-alley__card"
                tabIndex={-1}
                role="group"
                aria-label={doorTitle(key(), roomName(doorSpec(key()).roomId))}
                data-testid="alley-card"
              >
                <Show when={!isEnterable(key())}>
                  <div class="mp-alley__eyebrow" data-testid="alley-eyebrow">
                    {ALLEY_COPY.comingSoon}
                  </div>
                </Show>
                <div class="mp-alley__name" data-testid="alley-name">
                  {doorTitle(key(), roomName(doorSpec(key()).roomId))}
                </div>
                <div class="mp-alley__line" data-testid="alley-line">
                  {DOOR_LINE[key()]}
                </div>
              </div>
              <Show when={isEnterable(key())}>
                <button
                  type="button"
                  class="mp-alley__enter"
                  data-testid="alley-enter"
                  onClick={() => open()}
                >
                  {ALLEY_COPY.enter}
                </button>
              </Show>
            </>
          )}
        </Show>
      </div>
    </div>
  )
}
