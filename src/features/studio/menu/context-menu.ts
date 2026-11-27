// ============================================================
// Studio context menu logic — where a menu opens at the pointer, how the arrow keys move through it, and the long press that opens it on touch
// ============================================================
//
// A right-click in REAPER opens a menu at the pointer: the track's on a
// track panel, the arrange view's on empty space. The Studio does the same
// on its lanes (StudioLaneMenus.tsx), and a finger gets it from a press held
// still. iOS Safari never fires `contextmenu` for a held finger and Chrome on
// Android does, so the long press is counted here for every touch screen, and
// the browser's own event that may follow it opens nothing twice.

/** Kept clear of every viewport edge, as the app's popovers are. */
export const STUDIO_MENU_MARGIN = 8

/**
 * The menu's top-left corner: right of and below the point, else left of
 * or above it where that side has the room, and inside the viewport either
 * way, `margin` clear of its edges.
 */
export function placeStudioMenu(
  point: { readonly x: number; readonly y: number },
  menu: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
  margin = STUDIO_MENU_MARGIN,
): { x: number; y: number } {
  const axis = (at: number, size: number, room: number) => {
    const start =
      at + size <= room - margin || at - size < margin ? at : at - size
    return Math.max(margin, Math.min(start, room - size - margin))
  }
  return {
    x: axis(point.x, menu.width, viewport.width),
    y: axis(point.y, menu.height, viewport.height),
  }
}

export type StudioMenuKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End'

export function isStudioMenuKey(key: string): key is StudioMenuKey {
  return (
    key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End'
  )
}

/**
 * The item `key` moves to from `current`, over items that can be chosen:
 * the arrows wrap round, Home and End go to the first and the last. -1 when
 * none can be chosen.
 */
export function stepStudioMenu(
  enabled: readonly boolean[],
  current: number,
  key: StudioMenuKey,
): number {
  const count = enabled.length
  if (!enabled.some(Boolean)) return -1
  if (key === 'Home') return enabled.indexOf(true)
  if (key === 'End') return enabled.lastIndexOf(true)
  const direction = key === 'ArrowDown' ? 1 : -1
  let at = current < 0 && direction < 0 ? count : current
  for (let tries = 0; tries < count; tries++) {
    at = (at + direction + count) % count
    if (enabled[at]) return at
  }
  return -1
}

/** How long a finger holds still before the menu opens, as a phone's own long press. */
export const STUDIO_LONG_PRESS_MS = 500
/** How far a finger may drift and still be holding still. */
export const STUDIO_LONG_PRESS_SLOP = 8
/**
 * How long after a long press's lift its click may still come. Chromium
 * sends it a task after the pointerup (about 1 ms, measured with touch
 * emulation), so the next task is too soon; a browser that waits to tell a
 * double tap may take up to 300 ms. Past this the press lets go: a browser
 * that sends no click must not leave a later one swallowed.
 */
export const STUDIO_LONG_PRESS_LIFT_MS = 400

export interface StudioLongPressTimers {
  set(run: () => void, ms: number): unknown
  clear(handle: unknown): void
}

const WINDOW_TIMERS: StudioLongPressTimers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export interface StudioLongPressPoint {
  readonly pointerId: number
  readonly pointerType: string
  readonly clientX: number
  readonly clientY: number
  readonly target: EventTarget | null
}

/**
 * A finger's long press: `down` starts counting, a drift past the slop, a
 * lift or a cancel stops it, and `onPress` runs once the finger has held
 * still long enough. `swallow` then says whether the click the lift makes,
 * or the browser's own `contextmenu`, belongs to that press and should do
 * nothing. Some browsers send no click after a long press, so the press
 * lets go a moment after the lift (`lift`, STUDIO_LONG_PRESS_LIFT_MS), or at
 * the next key (`reset`): it must not swallow a later click it never made.
 */
export function createStudioLongPress(options: {
  onPress(point: StudioLongPressPoint): void
  timers?: StudioLongPressTimers
  ms?: number
  slop?: number
}) {
  const timers = options.timers ?? WINDOW_TIMERS
  const slop = options.slop ?? STUDIO_LONG_PRESS_SLOP
  let held: { point: StudioLongPressPoint; handle: unknown } | null = null
  let pressed = false
  /** The lift's let-go, waiting for the click the lift makes. */
  let letGo: { handle: unknown } | null = null

  function stop(): void {
    if (held !== null) timers.clear(held.handle)
    held = null
  }

  function reset(): void {
    if (letGo !== null) timers.clear(letGo.handle)
    letGo = null
    pressed = false
  }

  return {
    down(point: StudioLongPressPoint): void {
      stop()
      reset()
      if (point.pointerType !== 'touch') return
      const handle = timers.set(() => {
        held = null
        pressed = true
        options.onPress(point)
      }, options.ms ?? STUDIO_LONG_PRESS_MS)
      held = { point, handle }
    },
    move(
      point: Pick<StudioLongPressPoint, 'pointerId' | 'clientX' | 'clientY'>,
    ): void {
      if (held === null || held.point.pointerId !== point.pointerId) return
      const drift = Math.hypot(
        point.clientX - held.point.clientX,
        point.clientY - held.point.clientY,
      )
      if (drift > slop) stop()
    },
    /** The browser took the touch. */
    end: stop,
    /** The finger lifted: a press it ends swallows the lift's click, and nothing after it. */
    lift(): void {
      stop()
      if (!pressed || letGo !== null) return
      letGo = { handle: timers.set(reset, STUDIO_LONG_PRESS_LIFT_MS) }
    },
    /** The press opened the menu: its lift's click and the browser's own menu do nothing. */
    swallow(): boolean {
      return pressed
    },
    /** A new gesture, or a key: what came after the last press is no longer its. */
    reset,
  }
}
