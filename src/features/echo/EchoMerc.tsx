// ============================================================
// EchoMerc: Merc's place on the ridge, at the lower left of the sky
// ============================================================
//
// He sits on the foreground roof's ridge at the seat A0 traced
// (MERC_SEAT), his feet on it, his canvas as wide as storyboard screen 1
// gives him and his sound (0.04 to 0.50 W). He belongs to the plate: when
// a short room slides the plate down he goes with it, and the sky's
// content gathering above him never changes his size.

import type { JSX } from 'solid-js'
import { MERC_FEET } from '@/components/room-kit/MercView'
import { MERC_SEAT } from './echo-geometry'
import styles from './EchoMerc.module.css'
import type { SkyLayout } from './sky-layout'
import { onPlate } from './sky-layout'

/** His canvas, square, in W. */
export const MERC_SIZE_W = 0.46

export interface MercBox {
  readonly left: number
  readonly top: number
  readonly size: number
}

/** His canvas's box in the room: his feet on the seat. */
export function mercBox(layout: SkyLayout): MercBox {
  const seat = onPlate(layout, MERC_SEAT)
  const size = MERC_SIZE_W * layout.unit
  return { left: seat.x - size / 2, top: seat.y - size * MERC_FEET, size }
}

export interface EchoMercProps {
  box: MercBox
  children: JSX.Element
}

export function EchoMerc(props: EchoMercProps): JSX.Element {
  return (
    <div
      class={styles.merc}
      style={{
        width: `${props.box.size.toFixed(1)}px`,
        height: `${props.box.size.toFixed(1)}px`,
        transform: `translate(${props.box.left.toFixed(1)}px, ${props.box.top.toFixed(1)}px)`,
      }}
    >
      {props.children}
    </div>
  )
}
