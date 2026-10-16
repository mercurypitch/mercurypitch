// ============================================================
// Merc duo — blue and orange Merc, live on the lesson's stage
// ============================================================
//
// The app's own shader Merc, twice: blue as shipped, orange through the warm
// look (merc-warm.ts). The renderer loads after first paint, so the page
// opens on the two still images and the live Mercs take over once each has
// drawn a frame. One WebGL context per Merc. They pause while the stage is
// off screen and while animations are paused, except when a tap has asked
// one to sing; reduced motion and failures leave the stills in place.

import type { MercMountOptions, MercRenderer } from '@/lib/merc/renderer'
import { q } from './dom'
import { WARM_LOOK, warmFragment } from './merc-warm'
import { Motion, reducedMotion } from './motion-switch'

export type Which = 'blue' | 'orange'

const mercs: Record<Which, MercRenderer | null> = { blue: null, orange: null }
const singing: Record<Which, boolean> = { blue: false, orange: false }
const timers: Partial<Record<string, number>> = {}
let visible = true
let settle: () => void = () => undefined

/** Each Merc's sung energy, 0 or 1, which the hero's staff and rail follow. */
export const energy: Record<Which, number> = { blue: 0, orange: 0 }

/** Settles once both mounts have succeeded or failed; the hero entrance waits on it, briefly. */
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

function mountOne(which: Which, mount: MountFn): MercRenderer | null {
  const el = mercEl(which)
  const host = q('.live', el)
  const warm = which === 'orange'
  try {
    const m = mount(host, {
      transparent: true,
      quality: 'medium',
      size: 0,
      view: 'front',
      state: 'idle',
      still: reducedMotion(),
      fragmentPatch: warm ? warmFragment : undefined,
      onFailure: () => el.classList.remove('is-live'),
    })
    if (warm) m.setLook(WARM_LOOK)
    // turned towards each other
    m.setPoseBias(
      warm ? { yaw: -0.32, lookX: -0.35 } : { yaw: 0.32, lookX: 0.35 },
    )
    if (!m.ok) {
      m.destroy()
      host.textContent = ''
      return null
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (m.ok) el.classList.add('is-live')
      }),
    )
    return m
  } catch {
    host.textContent = ''
    return null
  }
}

/** Loads the renderer and mounts both Mercs; the stills stay if anything fails. */
export async function initMercs(stage: HTMLElement): Promise<void> {
  let mount: MountFn
  try {
    // its own chunk: the page reads and plays before the renderer arrives
    mount = (await import('@/lib/merc/renderer')).mount
  } catch {
    settle()
    return
  }
  mercs.blue = mountOne('blue', mount)
  mercs.orange = mountOne('orange', mount)
  // let the live canvases draw their first frame before the stills step aside
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
  settle()
  new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        visible = e.isIntersecting
        syncPause()
      }),
    { rootMargin: '40px 0px' },
  ).observe(stage)
  Motion.subscribe(syncPause)
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
    // let him settle back to idle before he pauses
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
