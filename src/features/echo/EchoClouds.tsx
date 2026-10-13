// ============================================================
// EchoClouds: the take's cloud banks over the plate, faded by the room's state
// ============================================================
//
// Art round 3 paints the cloud banks of storyboard screens 2 and 3 as a
// transparent layer per state (echo-a0/geometry/echo-cloud-layer.json),
// cut round the towers, spires and glass roof. It shares the world plate's
// box and never moves on its own, or the cut-outs would slip off the
// towers. The intro has no layer (screen 1's dim clouds are the plate's
// own), the take has its own, the result none (CLOUD_LAYER.opacity).
//
// The layer comes up over CLOUD_LAYER.inMs as the intro ends and goes over
// outMs as the result or the intro comes back; a layer that is simply there
// (a fixture) shows at once, and with reduced motion it appears and goes
// without a fade. It is mounted while a run is on, so its decode starts
// with the run, and it is released once it has faded: the plates decoded
// at once are the world, the clouds and, from the last phrase, the result.

import type { JSX } from 'solid-js'
import { createEffect, createSignal, onCleanup, Show, untrack } from 'solid-js'
import { PlateImage } from '@/components/room-kit/PlateImage'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { CLOUD_PLATE } from './echo-art'
import { CLOUD_LAYER } from './echo-geometry'
import styles from './EchoClouds.module.css'

/** What the room asks of its clouds. */
export interface CloudState {
  /** A run is on: the layer is loaded and placed (unseen until `on`). */
  readonly present: boolean
  /** The take's state: the layer is up. */
  readonly on: boolean
}

export interface EchoCloudsProps {
  state: CloudState
  /** The world plate's box: the layer's own. */
  box: JSX.CSSProperties
  /** The plate's class beyond its box (a tablet's feathered edges). */
  class?: string
  /** A fixture: the layer at its state's opacity, no fade. */
  still: boolean
}

export function EchoClouds(props: EchoCloudsProps): JSX.Element {
  const instant = (): boolean => props.still || prefersReducedMotion()
  const wanted = (): boolean => props.state.present || props.state.on
  const [mounted, setMounted] = createSignal(untrack(wanted))
  let release: ReturnType<typeof setTimeout> | undefined

  createEffect(() => {
    if (wanted()) {
      clearTimeout(release)
      release = undefined
      setMounted(true)
      return
    }
    if (!untrack(mounted) || release !== undefined) return
    if (untrack(instant)) {
      setMounted(false)
      return
    }
    release = setTimeout(() => {
      release = undefined
      setMounted(false)
    }, CLOUD_LAYER.outMs)
  })
  onCleanup(() => clearTimeout(release))

  const fade = (): string => {
    if (instant()) return 'none'
    return props.state.on
      ? `opacity ${CLOUD_LAYER.inMs}ms ease-out`
      : `opacity ${CLOUD_LAYER.outMs}ms ease-in`
  }

  return (
    <Show when={mounted()}>
      <div
        class={styles.clouds}
        style={{ opacity: props.state.on ? 1 : 0, transition: fade() }}
        data-testid="echo-clouds"
        data-on={props.state.on ? 'true' : 'false'}
      >
        <PlateImage
          spec={CLOUD_PLATE}
          fallback="transparent"
          class={props.class}
          style={props.box}
          testId="echo-clouds-plate"
        />
      </div>
    </Show>
  )
}
