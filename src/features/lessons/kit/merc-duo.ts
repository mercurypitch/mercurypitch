// ============================================================
// Merc duo — Merc and Tavi, live on the lesson's stage
// ============================================================
//
// The app's own shader Merc, twice: blue as shipped, orange through the warm
// look (merc-warm.ts), both with one shader text. The renderer loads after
// first paint, so the page opens on the two still images, and live Merc and
// Tavi take over once each says ready: his shader has linked and his first
// frame is drawn. A first visit can wait seconds for that, the page running
// on meanwhile. Tavi mounts once Merc is live, so her shader comes from the
// browser's cache, and stays a still when he does not; one not ready after
// LIVE_MERC_WAIT_MS of the page on screen stays a still for this page and
// lets its WebGL context go. One WebGL context per Merc. They
// pause while the stage is off screen and while animations are paused,
// except when a tap has asked one to sing; reduced motion and failures leave
// the stills in place.
//
// So does a WebGL that would run on the CPU (SwiftShader, llvmpipe: no GPU,
// or one the browser has blocklisted). Merc and Tavi drawn there hold the main
// thread for seconds at a time, and the lesson under them stops answering.
// The check is the app's one, lib/merc/gpu-gate.ts.

import { canRunLiveMerc, waitForLiveMerc } from '@/lib/merc/gpu-gate'
import type { MercMountOptions, MercRenderer } from '@/lib/merc/renderer'
import type { SparkleSide } from '@/lib/merc/sim'
import { q } from './dom'
import { WARM_LOOK } from './merc-warm'
import { Motion, reducedMotion } from './motion-switch'

export type Which = 'blue' | 'orange'

const mercs: Record<Which, MercRenderer | null> = { blue: null, orange: null }
const singing: Record<Which, boolean> = { blue: false, orange: false }
const timers: Partial<Record<string, number>> = {}
let visible = true
let settle: () => void = () => undefined

/** Each Merc's sung energy, 0 or 1, which the hero's staff and rail follow. */
export const energy: Record<Which, number> = { blue: 0, orange: 0 }

/** Settles once both Mercs are live, failed or given up; the hero entrance waits on it, briefly. */
export const mercsReady = new Promise<void>((resolve) => {
  settle = resolve
})

type MountFn = (container: HTMLElement, opts?: MercMountOptions) => MercRenderer

const mercEl = (which: Which): HTMLElement =>
  q(which === 'blue' ? '#mercBlue' : '#mercOrange')

function syncPause(): void {
  for (const which of ['blue', 'orange'] as const) {
    const m = mercs[which]
    if (!m) continue
    try {
      m.setPaused(!visible || (Motion.paused && !singing[which]))
    } catch {
      // the still image carries on
    }
  }
}

// Settles once this Merc is live (true), or has failed or been given up on.
function mountOne(
  which: Which,
  mount: MountFn,
  o: MercDuoOptions,
): Promise<boolean> {
  const el = mercEl(which)
  const host = q('.live', el)
  const warm = which === 'orange'
  return new Promise((resolve) => {
    // The still stays; the renderer, its context and its canvas go.
    const giveUp = (): void => {
      stopWaiting()
      const m = mercs[which]
      mercs[which] = null
      el.classList.remove('is-live')
      try {
        m?.destroy()
      } catch {
        // already failing
      }
      host.textContent = ''
      resolve(false)
    }
    const stopWaiting = waitForLiveMerc(giveUp)
    let m: MercRenderer
    try {
      m = mount(host, {
        transparent: true,
        quality: 'medium',
        size: 0,
        view: 'front',
        state: 'idle',
        still: reducedMotion(),
        onReady: () => {
          stopWaiting()
          el.classList.add('is-live')
          resolve(true)
        },
        onFailure: giveUp,
        ...(o.sparkles === undefined ? {} : { sparkles: o.sparkles }),
      })
      if (warm) m.setLook(WARM_LOOK)
      // turned towards each other
      m.setPoseBias(
        warm ? { yaw: -0.32, lookX: -0.35 } : { yaw: 0.32, lookX: 0.35 },
      )
    } catch {
      giveUp()
      return
    }
    mercs[which] = m
    syncPause()
  })
}

export interface MercDuoOptions {
  /**
   * Where a celebration's sparkles land; 'none' for a quiet one (Lesson 5's
   * WEB-SPEC: Merc celebrates "with no sparkles"). Default the renderer's.
   */
  readonly sparkles?: SparkleSide
}

/** Loads the renderer and mounts Merc and Tavi; the stills stay if anything fails. */
export async function initMercs(
  stage: HTMLElement,
  o: MercDuoOptions = {},
): Promise<void> {
  if (!canRunLiveMerc()) {
    settle()
    return
  }
  let mount: MountFn
  try {
    // its own chunk: the page reads and plays before the renderer arrives
    mount = (await import('@/lib/merc/renderer')).mount
  } catch {
    settle()
    return
  }
  // Tavi once Merc is live: the same shader again, which the browser has
  // then compiled and cached, where two at once would compile it twice. A
  // Merc who failed or ran out of time leaves her a still too, since her
  // shader is his and would only fail or keep the driver busy again.
  const mounted = mountOne('blue', mount, o).then(
    (live) => live && mountOne('orange', mount, o),
  )
  new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        visible = e.isIntersecting
        syncPause()
      }),
    { rootMargin: '40px 0px' },
  ).observe(stage)
  Motion.subscribe(syncPause)
  await mounted
  settle()
}

/** Starts or ends a Merc's sung note; the rail bead marks the note either way. */
export function mercSing(which: Which, midi: number, on: boolean): void {
  const el = mercEl(which)
  const react = on && !Motion.paused
  document
    .querySelector(`#heroRail [data-bead="${which}"]`)
    ?.classList.toggle('on', on)
  el.classList.toggle('is-singing', react)
  energy[which] = react ? 1 : 0
  const m = mercs[which]
  if (!m) return
  if (on && !react) return
  if (!on && !singing[which]) return
  window.clearTimeout(timers[which])
  window.clearTimeout(timers[`${which}p`])
  if (on) {
    singing[which] = true
    syncPause()
  } else {
    // let the singer settle back to idle before pausing
    timers[`${which}p`] = window.setTimeout(() => {
      singing[which] = false
      syncPause()
    }, 2200)
  }
  try {
    if (on) {
      m.setState('sing')
      m.setVoice({ voiced: true, cents: 0, level: 0.75, steady: 0.95, midi })
    } else {
      m.setState('idle')
      m.setVoice({ voiced: false, cents: 0, level: 0, steady: 1, midi })
    }
  } catch {
    // the still image carries on
  }
}

/**
 * Turns a Merc to listen while `on` (the other Merc sings, or the viewer
 * does) and back to idle after. Like every reaction it is skipped while
 * animations are paused or reduced: the still image carries the moment.
 */
export function mercListen(which: Which, on: boolean): void {
  const m = mercs[which]
  if (!m || Motion.paused) return
  try {
    m.setState(on ? 'listen' : 'idle')
  } catch {
    // the still image carries on
  }
}

export function mercCelebrate(which: Which, ms = 1600): void {
  const m = mercs[which]
  if (!m || Motion.paused) return
  window.clearTimeout(timers[which])
  try {
    m.setState('celebrate')
    timers[which] = window.setTimeout(() => {
      try {
        m.setState('idle')
      } catch {
        // ignore
      }
    }, ms)
  } catch {
    // ignore
  }
}
