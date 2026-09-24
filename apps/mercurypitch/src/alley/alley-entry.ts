// ============================================================
// The open: a door grows into its room
// ============================================================
//
// A clone of the door quad carrying the same content — the playing clip,
// moved in synchronously so it never leaves the document and is never paused
// by the removal steps, or the plate's own pixels warped by the inverse of the
// door's homography so the first frame is the alley unchanged — grows to the
// full screen on a per-frame `matrix3d` (lab §4). No View Transitions API:
// iOS 16 is the floor.
//
// The clone lives on <body>, not inside the alley, because the alley unmounts
// the moment the room is navigated to and the clone has to outlast it: it
// covers the screen, the room mounts under it, the clone waits for the room's
// own background to be decoded, and only then fades. Between the rail
// (`--z-rail`, 470) and a stage (`--z-stage`, 450), so the rail stays put.
//
// The room's arrival (the Sing room's automatic microphone) is held here for
// the whole hand-over and released once the clone is gone AND the ambient is
// silent — whichever is last. The hold and its failsafe are taken on the same
// line, so a lost frame, a room that never draws, or a throw while the clone
// is being built cannot leave a room waiting forever.

import type { DoorLayout } from './alley-geometry'
import { easeOut, fullQuad, invert, lerpQuad, matrix3d, rectToQuad, } from './alley-geometry'

/** The grow. The brief's "about 420 ms"; the lab ran 520. */
export const OPEN_MS = 420
/** Reduced motion: every step is a 120 ms crossfade and nothing grows. */
export const REDUCED_MS = 120
/** The clone's fade once the room behind it has drawn. */
export const REVEAL_MS = 240
/** How long the room's background is waited for before the clone goes anyway. */
export const ROOM_WAIT_MS = 1500
/** Past this the arrival is released whatever else happened. */
export const ARRIVAL_FAILSAFE_MS = 4000
/**
 * The clone's fade when the user went somewhere else after it covered. With
 * the poll below and the removal's slack, the clone is gone inside 120 ms.
 */
export const LEAVE_MS = 80
/** How often a covered clone asks whether the user is still going its way. */
const AWAY_POLL_MS = 20

export interface DoorOpenPlan {
  readonly door: DoorLayout
  readonly width: number
  readonly height: number
  readonly reduced: boolean
  /** The door's clip, if it is playing; it moves into the clone. */
  readonly video: HTMLVideoElement | null
  readonly plateSrc: string
  /** Where the alley drew the plate, CSS px (`alleyFit`). */
  readonly plateBox: {
    readonly x: number
    readonly y: number
    readonly w: number
    readonly h: number
  }
  /** Where the room draws its background, to be waited on. */
  readonly roomBackground: string
  /** Resolves once the door's ambient has faded out and stopped. */
  readonly ambientSilent: Promise<void>
  /** The clone covers the screen: mount the room under it. */
  readonly onCovered: () => void
  /**
   * Asked, once covered, until the clone is gone: has the user gone somewhere
   * other than the door's room (a rail tab, More, the pill, Back)? Then the
   * clone gets out of the way at once instead of waiting on a room that is
   * no longer coming.
   */
  readonly away: () => boolean
  /** Hold the room's own arrival; the returned function lets it start. */
  readonly holdArrival: () => () => void
}

/** The first url() in a computed background-image, or null. */
export function backgroundUrl(value: string): string | null {
  const match = /url\(\s*(['"]?)(.*?)\1\s*\)/u.exec(value)
  return match === null ? null : match[2]
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })

/**
 * Wait for the room's background element to exist and its picture to decode,
 * or for the deadline. Ends early, answering false, when `away()` says the
 * user went elsewhere or the room's element is unmounted: nothing is coming
 * to be revealed. True otherwise.
 */
async function roomDrawn(
  selector: string,
  away: () => boolean,
): Promise<boolean> {
  const deadline = performance.now() + ROOM_WAIT_MS
  let element: Element | null = null
  let over = false
  let left = false
  const watching = new Promise<void>((resolve) => {
    const tick = (): void => {
      if (over) return resolve()
      if (away() || (element !== null && !element.isConnected)) {
        left = true
        return resolve()
      }
      window.setTimeout(tick, AWAY_POLL_MS)
    }
    tick()
  })
  const drawing = (async (): Promise<void> => {
    while (element === null && !left && performance.now() < deadline) {
      element = document.querySelector(selector)
      if (element === null) await wait(40)
    }
    if (element === null || left) return
    await backgroundDecoded(element, deadline)
    // Unmounted while its picture was being waited on: nothing to reveal.
    if (!element.isConnected) left = true
  })()
  await Promise.race([watching, drawing])
  over = true
  return !left
}

async function backgroundDecoded(
  element: Element,
  deadline: number,
): Promise<void> {
  let url: string | null = null
  while (url === null && element.isConnected && performance.now() < deadline) {
    url = backgroundUrl(window.getComputedStyle(element).backgroundImage)
    if (url === null) await wait(40)
  }
  if (url === null) return
  const image = new Image()
  image.src = url
  // Not every engine has decode() (jsdom has none); load is the fallback.
  const decoded =
    typeof image.decode === 'function'
      ? image.decode().catch(() => undefined)
      : new Promise<void>((resolve) => {
          image.onload = () => resolve()
          image.onerror = () => resolve()
        })
  await Promise.race([decoded, wait(Math.max(0, deadline - performance.now()))])
}

function buildClone(plan: DoorOpenPlan): HTMLDivElement {
  const clone = document.createElement('div')
  clone.className = 'mp-alley-morph'
  clone.dataset.testid = 'alley-morph'
  clone.dataset.door = plan.door.key
  clone.setAttribute('aria-hidden', 'true')
  clone.style.width = `${plan.width}px`
  clone.style.height = `${plan.height}px`

  if (plan.video !== null) {
    clone.dataset.content = 'clip'
    plan.video.classList.add('mp-alley-morph__clip')
    // Muted again from script: the attribute alone is not always enough.
    plan.video.muted = true
    clone.appendChild(plan.video)
  } else {
    clone.dataset.content = 'paint'
    const paint = document.createElement('div')
    paint.className = 'mp-alley-morph__paint'
    // At the start of the grow the clone IS the door quad, and this cancels
    // that map exactly: the composition is the identity and the alley does
    // not jump. The box then grows and takes the painted bay with it.
    paint.style.transform = matrix3d(
      invert(rectToQuad(plan.width, plan.height, plan.door.quad)),
    )
    const img = document.createElement('img')
    img.alt = ''
    img.src = plan.plateSrc
    img.style.left = `${plan.plateBox.x}px`
    img.style.top = `${plan.plateBox.y}px`
    img.style.width = `${plan.plateBox.w}px`
    img.style.height = `${plan.plateBox.h}px`
    paint.appendChild(img)
    clone.appendChild(paint)
  }
  return clone
}

/** An open under way: the clone, and the way to call it off. */
export interface DoorOpen {
  readonly clone: HTMLDivElement
  /**
   * Call the open off before it has covered the screen: the clone goes, the
   * clip goes back into its door (paused), and the arrival is released.
   * False once the clone has covered — the room is being mounted by then and
   * the open finishes on its own.
   */
  cancel: () => boolean
}

/**
 * Start the open. Call it inside the tap: the clip is moved and the clone is
 * in the document before the handler returns.
 */
export function openDoor(plan: DoorOpenPlan): DoorOpen {
  // The hold and its failsafe, together: nothing can run between them.
  const releaseArrival = plan.holdArrival()
  let released = false
  const release = (): void => {
    if (released) return
    released = true
    releaseArrival()
  }
  const failsafe = window.setTimeout(release, ARRIVAL_FAILSAFE_MS)
  let started = false
  try {
    const open = startOpen(plan, release, failsafe)
    started = true
    return open
  } finally {
    // A throw before the open was under way: nothing else will release it.
    if (!started) {
      window.clearTimeout(failsafe)
      release()
    }
  }
}

function startOpen(
  plan: DoorOpenPlan,
  release: () => void,
  failsafe: number,
): DoorOpen {
  // Where the clip lived, so a cancelled open can put it back.
  const home = plan.video?.parentNode ?? null
  const homeNext = plan.video?.nextSibling ?? null
  /** The clip back in its door, paused; unloaded if the door has gone. */
  const putClipBack = (): void => {
    const video = plan.video
    if (video === null) return
    video.pause()
    video.classList.remove('mp-alley-morph__clip')
    if (home !== null && home.isConnected) {
      if (video.parentNode === home) return
      home.insertBefore(
        video,
        homeNext !== null && homeNext.parentNode === home ? homeNext : null,
      )
    } else {
      video.removeAttribute('src')
      video.load()
    }
  }
  let clone: HTMLDivElement
  try {
    clone = buildClone(plan)
  } catch (error) {
    // The clip may already have moved: it goes home before the throw does.
    putClipBack()
    throw error
  }
  // The screen the clone grows to. A rotation mid-open retargets it, so the
  // grow ends covering the new screen rather than the old one on its side.
  let vw = plan.width
  let vh = plan.height
  let full = fullQuad(vw, vh)
  const at = (t: number): string =>
    matrix3d(rectToQuad(vw, vh, lerpQuad(plan.door.quad, full, t)))
  const retarget = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    if (w <= 0 || h <= 0 || (w === vw && h === vh)) return
    vw = w
    vh = h
    full = fullQuad(vw, vh)
    clone.style.width = `${vw}px`
    clone.style.height = `${vh}px`
    if (covered && !plan.reduced) clone.style.transform = at(1)
  }
  window.addEventListener('resize', retarget)

  if (plan.reduced) {
    // No transform on the clone at all: it sits over the screen and fades in.
    clone.dataset.motion = 'crossfade'
    clone.style.opacity = '0'
    clone.style.transition = `opacity ${REDUCED_MS}ms linear`
  } else {
    clone.dataset.motion = 'grow'
    clone.style.transform = at(0)
  }
  try {
    document.body.appendChild(clone)
    if (plan.video !== null) void plan.video.play().catch(() => undefined)
  } catch (error) {
    // No half-built open left behind: the clone goes, the clip goes home,
    // and `openDoor` lets the hold go.
    window.removeEventListener('resize', retarget)
    clone.remove()
    putClipBack()
    throw error
  }

  let covered = false
  let cancelled = false
  const timers: number[] = []
  let frame = 0
  const cover = (): void => {
    if (covered || cancelled) return
    covered = true
    for (const timer of timers) window.clearTimeout(timer)
    cancelAnimationFrame(frame)
    clone.style.transform = plan.reduced ? '' : at(1)
    clone.style.opacity = '1'
    clone.dataset.phase = 'covered'
    plan.onCovered()
    void reveal()
  }

  const reveal = async (): Promise<void> => {
    const drawn = await roomDrawn(plan.roomBackground, plan.away)
    // Gone elsewhere: out of the way at once, over whatever is there now.
    const fade = !drawn ? LEAVE_MS : plan.reduced ? REDUCED_MS : REVEAL_MS
    clone.dataset.phase = 'revealing'
    clone.style.transition = `opacity ${fade}ms linear`
    clone.style.opacity = '0'
    await wait(fade + 20)
    if (plan.video !== null) {
      plan.video.pause()
      plan.video.removeAttribute('src')
      plan.video.load()
    }
    clone.remove()
    window.removeEventListener('resize', retarget)
    await plan.ambientSilent.catch(() => undefined)
    window.clearTimeout(failsafe)
    release()
  }

  const cancel = (): boolean => {
    if (covered || cancelled) return false
    cancelled = true
    for (const timer of timers) window.clearTimeout(timer)
    cancelAnimationFrame(frame)
    // The door is still on screen: its clip goes back where it was.
    putClipBack()
    clone.remove()
    window.removeEventListener('resize', retarget)
    window.clearTimeout(failsafe)
    release()
    return true
  }

  const duration = plan.reduced ? REDUCED_MS : OPEN_MS
  // A frame loop does not run when the page is not compositing (MISTAKES.md);
  // the timer is what guarantees the room is reached.
  timers.push(window.setTimeout(cover, duration + 200))
  if (plan.reduced) {
    frame = requestAnimationFrame(() => {
      if (cancelled) return
      clone.style.opacity = '1'
      timers.push(window.setTimeout(cover, REDUCED_MS))
    })
  } else {
    const t0 = performance.now()
    const tick = (now: number): void => {
      if (covered || cancelled) return
      const t = Math.min(1, (now - t0) / duration)
      clone.style.transform = at(easeOut(t))
      if (t < 1) frame = requestAnimationFrame(tick)
      else cover()
    }
    frame = requestAnimationFrame(tick)
  }
  return { clone, cancel }
}
