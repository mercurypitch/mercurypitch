// ============================================================
// EchoClouds: the take's cloud banks over the plate, faded by the room's state
// ============================================================
//
// Art round 3 paints the cloud banks of storyboard screens 2 and 3 as a
// transparent layer per state (echo-a0/geometry/echo-cloud-layer.json),
// cut round the towers, spires and glass roof. Each shares the world
// plate's box and never moves on its own, or the cut-outs would slip off
// the towers. The intro has no layer (screen 1's dim clouds are the
// plate's own), a take has the mid-take layer (screen 2), the demo's "not
// like this" take the demo-off layer (screen 3), the result none
// (CLOUD_LAYER.opacity).
//
// A layer comes up over CLOUD_LAYER.inMs as the intro ends, crosses over
// crossMs to the other state's layer, and goes over outMs as the result or
// the intro comes back; a layer that is simply there (a fixture) shows at
// once, and with reduced motion it appears and goes without a fade. The
// mid-take layer is mounted while a run is on, so its decode starts with
// the run; the demo-off layer only while it is the look. Each is released
// once it has faded: two layers live together only while they cross.

import type { JSX } from 'solid-js'
import { createEffect, createSignal, onCleanup, Show, untrack } from 'solid-js'
import type { PlateSpec } from '@/components/room-kit/plate-loader'
import { PlateImage } from '@/components/room-kit/PlateImage'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { CLOUD_PLATE, DEMO_CLOUD_PLATE } from './echo-art'
import { CLOUD_LAYER } from './echo-geometry'
import styles from './EchoClouds.module.css'

/** Which state's clouds: a take's, or the demo's "not like this". */
export type CloudLook = 'mid-take' | 'demo-off'

/** What the room asks of its clouds. */
export interface CloudState {
  /** A run is on: the layer is loaded and placed (unseen until `on`). */
  readonly present: boolean
  /** The take's state: the layer is up. */
  readonly on: boolean
  /** The state's layer; a take's when not given. */
  readonly look?: CloudLook
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

interface LayerProps {
  /** Loaded and placed, seen or not. */
  wanted: boolean
  /** Up. */
  up: boolean
  /** The other look's layer is up: coming or going is a cross. */
  crossing: boolean
  instant: boolean
  spec: PlateSpec
  box: JSX.CSSProperties
  class?: string
  testId: string
  onMounted: (mounted: boolean) => void
}

/** One state's layer: mounted while wanted or fading, faded by `up`. */
function CloudLayer(props: LayerProps): JSX.Element {
  const [mounted, setMounted] = createSignal(untrack(() => props.wanted))
  let release: ReturnType<typeof setTimeout> | undefined

  createEffect(() => {
    if (props.wanted || props.up) {
      clearTimeout(release)
      release = undefined
      setMounted(true)
      return
    }
    if (!untrack(mounted) || release !== undefined) return
    if (untrack(() => props.instant)) {
      setMounted(false)
      return
    }
    const ms = untrack(() => props.crossing)
      ? CLOUD_LAYER.crossMs
      : CLOUD_LAYER.outMs
    release = setTimeout(() => {
      release = undefined
      setMounted(false)
    }, ms)
  })
  createEffect(() => props.onMounted(mounted()))
  onCleanup(() => clearTimeout(release))

  const fade = (): string => {
    if (props.instant) return 'none'
    if (props.crossing) return `opacity ${CLOUD_LAYER.crossMs}ms ease-in-out`
    return props.up
      ? `opacity ${CLOUD_LAYER.inMs}ms ease-out`
      : `opacity ${CLOUD_LAYER.outMs}ms ease-in`
  }

  return (
    <Show when={mounted()}>
      <div
        class={styles.clouds}
        style={{ opacity: props.up ? 1 : 0, transition: fade() }}
        data-testid={props.testId}
        data-on={props.up ? 'true' : 'false'}
      >
        <PlateImage
          spec={props.spec}
          fallback="transparent"
          class={props.class}
          style={props.box}
          testId={`${props.testId}-plate`}
        />
      </div>
    </Show>
  )
}

export function EchoClouds(props: EchoCloudsProps): JSX.Element {
  const instant = (): boolean => props.still || prefersReducedMotion()
  const look = (): CloudLook => props.state.look ?? 'mid-take'
  const up = (which: CloudLook): boolean => props.state.on && look() === which
  const [takeMounted, setTakeMounted] = createSignal(false)
  const [demoMounted, setDemoMounted] = createSignal(false)
  // A cross, while a take is up: the layer coming up over the other one
  // still there, or the one giving way to it. Without a take up, a layer
  // only comes up from nothing or goes to nothing.
  const crossing = (which: CloudLook): boolean => {
    if (!props.state.on) return false
    if (!up(which)) return true
    return which === 'mid-take' ? demoMounted() : takeMounted()
  }

  return (
    <>
      <CloudLayer
        wanted={props.state.present && look() === 'mid-take'}
        up={up('mid-take')}
        crossing={crossing('mid-take')}
        instant={instant()}
        spec={CLOUD_PLATE}
        box={props.box}
        class={props.class}
        testId="echo-clouds"
        onMounted={setTakeMounted}
      />
      <CloudLayer
        wanted={props.state.present && look() === 'demo-off'}
        up={up('demo-off')}
        crossing={crossing('demo-off')}
        instant={instant()}
        spec={DEMO_CLOUD_PLATE}
        box={props.box}
        class={props.class}
        testId="echo-clouds-demo"
        onMounted={setDemoMounted}
      />
    </>
  )
}
