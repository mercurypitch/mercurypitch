// ============================================================
// MercView — Merc's canvas, mounted once and driven by accessors
// ============================================================
//
// The renderer (src/lib/merc) loads in a chunk of its own on first use, so
// the room draws at once and Merc arrives when his shader is ready. Without
// WebGL2 the stage is a no-op and the room carries on without him: the
// exercise never depends on the picture.
//
// One canvas, and the only WebGL context in a premium room: every room draws
// its world in plates, sprites, SVG and canvas 2D around him.

import type { JSX } from 'solid-js'
import { createEffect, onCleanup, onMount, untrack } from 'solid-js'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice, SparkleSide } from '@/lib/merc/sim'
import type { GlideMouth } from '@/lib/merc/sim-glide'
import type { MercStage } from '@/lib/merc/stage'
import { prefersReducedMotion } from './reduced-motion'

/**
 * Where his feet touch the floor, as a share of the canvas height from its
 * top. The renderer's front view puts the floor point under his centre at
 * 0.789 (target 0.67 up, pitch 0.13, distance 4.2, fov 30); the fronts of
 * his feet are nearer the camera and sit lower, at about 0.81 on the phone
 * walk, so that is the point a room puts on its ground.
 */
export const MERC_FEET = 0.81

export interface MercViewProps {
  state: () => MercState
  /** Read every frame while he sings; not reactive. */
  voice: () => MercVoice
  /** Where his celebration's sparkles land; read once, at mount. */
  sparkles?: SparkleSide
  /**
   * Reduced motion for his glide states: `ride` stands upright and `hum`'s
   * rings only fade. Default: the phone's own setting.
   */
  still?: () => boolean
  /**
   * His sound rings while he hums or rides (default true); read once, at
   * mount. Lip roll turns them off: its buzz is drawn where they would be.
   */
  rings?: boolean
  /**
   * His mouth while he hums or rides (default 'closed', the hum's smile);
   * read once, at mount. Lip roll gives him a lip roll's buzzing lips.
   */
  mouth?: GlideMouth
  class?: string
  style?: JSX.CSSProperties
  /** The room's own id for him ("long-note-merc"). */
  testId: string
  /**
   * Called once, as his stage starts drawing: his chunk has arrived and
   * WebGL is up. Never called without WebGL. A room that times what he
   * does from the moment he is seen (the alley's welcome) starts there.
   */
  onReady?: () => void
}

export function MercView(props: MercViewProps): JSX.Element {
  let host: HTMLDivElement | undefined
  let stage: MercStage | null = null
  let disposed = false
  let frame = 0
  const still = (): boolean => (props.still ?? prefersReducedMotion)()
  let stillAtMount = false

  // The stage takes the voice pushed, so it is handed over once a frame.
  const feed = (): void => {
    frame = 0
    if (disposed || stage === null) return
    stage.setVoice(props.voice())
    frame = requestAnimationFrame(feed)
  }

  onMount(() => {
    void import('@/lib/merc/stage').then((merc) => {
      if (disposed || host === undefined) return
      stillAtMount = untrack(still)
      stage = merc.mountMercStage(host, {
        transparent: true,
        quality: 'medium',
        // Whatever he is doing by the time his chunk arrives.
        state: untrack(() => props.state()),
        sparkles: untrack(() => props.sparkles),
        still: stillAtMount,
        rings: untrack(() => props.rings),
        mouth: untrack(() => props.mouth),
      })
      if (!stage.ok) return
      frame = requestAnimationFrame(feed)
      props.onReady?.()
    })
  })

  createEffect(() => {
    const next = props.state()
    stage?.setState(next)
  })

  // Only a change after mount is handed over; mount took the first reading.
  createEffect(() => {
    const now = still()
    if (stage !== null && now !== stillAtMount) {
      stillAtMount = now
      stage.setStill(now)
    }
  })

  onCleanup(() => {
    disposed = true
    if (frame !== 0) cancelAnimationFrame(frame)
    stage?.destroy()
    stage = null
  })

  return (
    <div
      ref={host}
      class={props.class}
      style={props.style}
      aria-hidden="true"
      data-testid={props.testId}
      data-merc-state={props.state()}
    />
  )
}
