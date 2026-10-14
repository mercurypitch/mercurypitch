// ============================================================
// EchoCityLight: the town's cyan light, one small layer per state
// ============================================================
//
// Art round 5 paints the town's light the way each storyboard screen does
// (echo-a0/geometry/echo-citylight-layer.json): screen 1's streak falling
// to the right for the intro, screen 2's diagonal ribbon rising to a
// starburst for the take. The three screens' light does not share a place,
// so each state has its own small transparent crop, cut against the world
// plate and that state's clouds. It is laid over them, under the top light
// and everything drawn, in its own box inside the plate's, scaled with the
// plate, and it never moves on its own: it is cut to the plate's lamps.
//
// The state's layer shows at once when the room opens on it. As the state
// changes, the new layer comes up while the old one goes, over
// CITY_LIGHT.crossMs; at the result the light goes over outMs (the result
// plate's town is lit its own way). With reduced motion the fades stay,
// as the spec has it: they move nothing. A fixture stands at its state.

import type { JSX } from 'solid-js'
import { createEffect, createSignal, For, on } from 'solid-js'
import { PlateImage } from '@/components/room-kit/PlateImage'
import type { CityLightState } from './echo-art'
import { CITY_LIGHT_PLATES } from './echo-art'
import { CITY_LIGHT } from './echo-geometry'
import styles from './EchoCityLight.module.css'

const STATES = Object.keys(CITY_LIGHT_PLATES) as CityLightState[]

export interface EchoCityLightProps {
  /** The state whose light is up, or none (the result). */
  state: CityLightState | null
  /** The world plate's box, px: each layer is placed inside it. */
  plate: {
    readonly left: number
    readonly top: number
    readonly width: number
    readonly height: number
  }
  /** A fixture: the state's layer at once, no fade. */
  still: boolean
}

export function EchoCityLight(props: EchoCityLightProps): JSX.Element {
  // The first state shows as it is; a fade starts with the first change.
  const [changed, setChanged] = createSignal(false)
  createEffect(
    on(
      () => props.state,
      () => setChanged(true),
      { defer: true },
    ),
  )

  const fade = (): string => {
    if (props.still || !changed()) return 'none'
    return props.state === null
      ? `opacity ${CITY_LIGHT.outMs}ms ${CITY_LIGHT.outEase}`
      : `opacity ${CITY_LIGHT.crossMs}ms ${CITY_LIGHT.crossEase}`
  }

  const box = (state: CityLightState): JSX.CSSProperties => {
    const { left, top, width, height } = CITY_LIGHT.layers[state]
    const at = (offset: number, share: number, size: number): string =>
      `${(offset + share * size).toFixed(2)}px`
    return {
      left: at(props.plate.left, left, props.plate.width),
      top: at(props.plate.top, top, props.plate.height),
      width: at(0, width, props.plate.width),
      height: at(0, height, props.plate.height),
      opacity: props.state === state ? CITY_LIGHT.opacity[state] : 0,
      transition: fade(),
    }
  }

  return (
    <div
      class={styles.cityLight}
      data-testid="echo-citylight"
      data-state={props.state ?? 'none'}
    >
      <For each={STATES}>
        {(state) => (
          <PlateImage
            spec={CITY_LIGHT_PLATES[state]}
            fallback="transparent"
            class={styles.layer}
            style={box(state)}
            testId={`echo-citylight-${state}`}
          />
        )}
      </For>
    </div>
  )
}
