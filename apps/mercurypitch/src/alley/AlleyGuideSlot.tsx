// ============================================================
// AlleyGuideSlot: the alley's room for Merc's welcome (S7b beat 1)
// ============================================================
//
// RoomsAlley mounts this under the headline of a new install's first
// alley, with what it has measured: the screen, the dock's top, the
// headline block and the doors. On a build with the onboarding
// (`NATIVE_ONBOARDING`) the guide is a lazy chunk of its own
// (onboarding/AlleyGuide.tsx); on any other this is nothing, and by the
// shell's ternary the store build keeps no chunk of it. The door lit for
// him is kept here, one at a time, for the doors to read.

import type { Component, JSX } from 'solid-js'
import { createSignal, lazy, Show } from 'solid-js'
import { NATIVE_ONBOARDING } from '@/lib/native-build'
import type { AlleyGuideProps } from '../onboarding/AlleyGuide'
import type { DoorLayout } from './alley-geometry'
import type { AlleyPhase } from './alley-machine'
import type { DoorKey } from './alley-plate'

const AlleyGuide: Component<AlleyGuideProps> = NATIVE_ONBOARDING
  ? lazy(async () =>
      import('../onboarding/AlleyGuide').then((module) => ({
        default: module.AlleyGuide,
      })),
    )
  : () => null

const [lit, setLit] = createSignal<DoorKey | null>(null)

/** The door lit for Merc's welcome, one at a time, or none. */
export const alleyLit = lit

export interface AlleyGuideSlotProps {
  /** A new install's first alley: its headline is up. */
  shown: () => boolean
  /** The alley as measured: the screen and the dock's top. */
  size: () => { readonly w: number; readonly h: number }
  floor: () => number
  /** The headline block: its bottom, its left padding edge and its right. */
  top: () => number
  left: () => number
  right: () => number
  doors: () => readonly DoorLayout[]
  /** The alley's reduced motion. */
  reduced: () => boolean
  /** The alley's phase: a door picked sends him aside. */
  phase: () => AlleyPhase
}

export function AlleyGuideSlot(props: AlleyGuideSlotProps): JSX.Element {
  if (!NATIVE_ONBOARDING) return null
  return (
    <Show when={props.shown()}>
      <AlleyGuide
        input={() => ({
          w: props.size().w,
          h: props.size().h,
          landscape: props.size().w > props.size().h,
          floor: props.floor(),
          top: props.top(),
          left: props.left(),
          right: props.right(),
          doors: props.doors(),
        })}
        reduced={props.reduced}
        aside={() => props.phase() !== 'rest'}
        opened={() => props.phase() === 'opening'}
        light={setLit}
      />
    </Show>
  )
}
