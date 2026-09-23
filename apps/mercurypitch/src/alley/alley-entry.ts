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
// The room's arrival (the Sing room's automatic microphone) is held by the
// caller for the whole hand-over and released here once the clone is gone AND
// the ambient is silent — whichever is last, with a failsafe so a lost frame
// or a room that never draws cannot leave a room waiting forever.

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

export interface DoorOpenPlan {
  readonly door: DoorLayout
  readonly width: number
  readonly height: number
  readonly reduced: boolean
  /** The door's clip, if it is playing; it moves into the clone. */
  readonly video: HTMLVideoElement | null
  readonly plateSrc: string
  readonly platePosition: string
  /** Where the room draws its background, to be waited on. */
  readonly roomBackground: string
  /** Resolves once the door's ambient has faded out and stopped. */
  readonly ambientSilent: Promise<void>
  /** The clone covers the screen: mount the room under it. */
  readonly onCovered: () => void
  /** Let the room start its own arrival. */
  readonly releaseArrival: () => void
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

/** The room's background element, once it exists and its picture decodes. */
async function roomDrawn(selector: string): Promise<void> {
  const deadline = performance.now() + ROOM_WAIT_MS
  let element: Element | null = null
  while (element === null && performance.now() < deadline) {
    element = document.querySelector(selector)
    if (element === null) await wait(40)
  }
  if (element === null) return
  let url: string | null = null
  while (url === null && performance.now() < deadline) {
    url = backgroundUrl(window.getComputedStyle(element).backgroundImage)
    if (url === null) await wait(40)
  }
  if (url === null) return
  const image = new Image()
  image.src = url
  await Promise.race([
    image.decode().catch(() => undefined),
    wait(Math.max(0, deadline - performance.now())),
  ])
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
    img.style.objectPosition = plan.platePosition
    paint.appendChild(img)
    clone.appendChild(paint)
  }
  return clone
}

/**
 * Start the open. Call it inside the tap: the clip is moved and the clone is
 * in the document before the handler returns.
 */
export function openDoor(plan: DoorOpenPlan): HTMLDivElement {
  const clone = buildClone(plan)
  const full = fullQuad(plan.width, plan.height)
  const at = (t: number): string =>
    matrix3d(
      rectToQuad(plan.width, plan.height, lerpQuad(plan.door.quad, full, t)),
    )

  let released = false
  const release = (): void => {
    if (released) return
    released = true
    plan.releaseArrival()
  }
  const failsafe = window.setTimeout(release, ARRIVAL_FAILSAFE_MS)

  if (plan.reduced) {
    // No transform on the clone at all: it sits over the screen and fades in.
    clone.dataset.motion = 'crossfade'
    clone.style.opacity = '0'
    clone.style.transition = `opacity ${REDUCED_MS}ms linear`
  } else {
    clone.dataset.motion = 'grow'
    clone.style.transform = at(0)
  }
  document.body.appendChild(clone)
  if (plan.video !== null) void plan.video.play().catch(() => undefined)

  let covered = false
  const cover = (): void => {
    if (covered) return
    covered = true
    clone.style.transform = plan.reduced ? '' : at(1)
    clone.style.opacity = '1'
    clone.dataset.phase = 'covered'
    plan.onCovered()
    void reveal()
  }

  const reveal = async (): Promise<void> => {
    await roomDrawn(plan.roomBackground)
    const fade = plan.reduced ? REDUCED_MS : REVEAL_MS
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
    await plan.ambientSilent.catch(() => undefined)
    window.clearTimeout(failsafe)
    release()
  }

  const duration = plan.reduced ? REDUCED_MS : OPEN_MS
  // A frame loop does not run when the page is not compositing (MISTAKES.md);
  // the timer is what guarantees the room is reached.
  window.setTimeout(cover, duration + 200)
  if (plan.reduced) {
    requestAnimationFrame(() => {
      clone.style.opacity = '1'
      window.setTimeout(cover, REDUCED_MS)
    })
  } else {
    const t0 = performance.now()
    const tick = (now: number): void => {
      if (covered) return
      const t = Math.min(1, (now - t0) / duration)
      clone.style.transform = at(easeOut(t))
      if (t < 1) requestAnimationFrame(tick)
      else cover()
    }
    requestAnimationFrame(tick)
  }
  return clone
}
