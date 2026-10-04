// ============================================================
// Presses that waited while the app slept
// ============================================================
//
// A paused song lets iOS suspend the app. The lock screen still shows the
// song, but WebKit keeps a press there until the page runs again, and hands
// it over then, with any others, as the app comes back to the front: a play
// would start the song, and a seek move it, long after it was pressed.
//
// Behind the app with a song on the lock screen, the page beats once a
// second. A frozen page misses its beats, so a press that comes after a
// long gap, or just after the gap ended, may be one that waited for the app
// to run again. Such a press is held a moment: the app coming to the front
// in that moment means it came with the app, and it is dropped. A page
// still behind the app after it was woken by the press itself, if WebKit
// ever does that, carries it out. Wall-clock time throughout: a phone that
// sleeps stops `performance.now()` with it.

/** A beat a second, which a hidden page's timers keep to the whole second. */
const BEAT_MS = 1000
/** No beat for this long behind the app: the page was frozen. */
const SLEPT_MS = 5000
/** How long after waking a press may still be one that waited. */
const WOKEN_MS = 1500
/** How long a press that may have waited is held to see where the app goes. */
const HOLD_MS = 400

/** A press of a lock-screen button, as the guard hears it. */
export interface Press {
  /** The button's name, for the log. */
  readonly action: string
  /** What the press does. */
  readonly carryOut: () => void
}

/** What the guard watches. */
export interface PressGuardHost {
  /** The app is behind another one: the page is hidden. */
  readonly hidden: () => boolean
  /** A song is on the lock screen. */
  readonly songShown: () => boolean
}

export interface PressGuard {
  /** A press: carried out at once, held a moment, or dropped. */
  hear: (press: Press) => void
  /**
   * The page hid or showed, or the song came or went: the page beats while
   * it is hidden with a song on the lock screen, and a page in front drops
   * what was held.
   */
  follow: () => void
  /** Stop beating, and forget what was held. */
  stop: () => void
}

export function guardPresses(host: PressGuardHost): PressGuard {
  let beating: ReturnType<typeof setInterval> | undefined
  let lastBeat = 0
  let wokeAt = Number.NEGATIVE_INFINITY
  let held: Press[] = []
  let holdTimer: ReturnType<typeof setTimeout> | undefined

  const beat = (): void => {
    const at = Date.now()
    if (at - lastBeat > SLEPT_MS) wokeAt = at
    lastBeat = at
  }

  /** Whether a press now may be one that waited while the app slept. */
  const mayHaveWaited = (): boolean => {
    const at = Date.now()
    if (at - wokeAt < WOKEN_MS) return true
    return beating !== undefined && at - lastBeat > SLEPT_MS
  }

  const drop = (press: Press): void => {
    console.info(
      `[now playing] ${press.action} waited while the app slept: dropped`,
    )
  }

  const dropHeld = (): void => {
    clearTimeout(holdTimer)
    holdTimer = undefined
    const presses = held
    held = []
    for (const press of presses) drop(press)
  }

  /** The hold over and the app still behind another one: the presses were new. */
  const letHeldGo = (): void => {
    holdTimer = undefined
    if (!host.hidden()) {
      dropHeld()
      return
    }
    const presses = held
    held = []
    for (const press of presses) {
      console.info(
        `[now playing] ${press.action} came as the app woke behind another app: carried out`,
      )
      press.carryOut()
    }
  }

  return {
    hear: (press) => {
      if (!mayHaveWaited()) {
        press.carryOut()
        return
      }
      if (!host.hidden()) {
        drop(press)
        return
      }
      held.push(press)
      holdTimer ??= setTimeout(letHeldGo, HOLD_MS)
    },
    follow: () => {
      if (host.hidden() && host.songShown()) {
        if (beating !== undefined) return
        lastBeat = Date.now()
        beating = setInterval(beat, BEAT_MS)
        return
      }
      if (beating !== undefined) {
        // A last beat notices a freeze that ends as the app comes back.
        beat()
        clearInterval(beating)
        beating = undefined
      }
      if (!host.hidden()) dropHeld()
    },
    stop: () => {
      clearInterval(beating)
      beating = undefined
      clearTimeout(holdTimer)
      holdTimer = undefined
      held = []
    },
  }
}
