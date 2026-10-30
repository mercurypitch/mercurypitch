// ============================================================
// The lit instruments' clock: how long the room's beat has run, and how
// long the instrument has been on the stage, advanced once a screen frame
// while a question is on (listen, answer, reveal) and the screen is there.
//
// Under reduced motion it does not run: `t` stands at the far end of any
// beat, so every reveal is drawn whole at once, and `ambient` stays at
// zero, so nothing sways or breathes.
// ============================================================

import type { Accessor } from 'solid-js'
import { batch, createEffect, createSignal, on, onCleanup, untrack, } from 'solid-js'
import type { FrameLoop } from '@/components/room-kit/frame-loop'
import { createFrameLoop } from '@/components/room-kit/frame-loop'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import type { RoomBeat } from '@/features/ear-lab/stage-room'
import { useRoom } from '../room-context'

/** Where `t` stands under reduced motion: past the end of any beat. */
export const STILL_MS = 1e7

export interface StageClock {
  /** The room's beat. */
  beat: Accessor<RoomBeat>
  /** Ms since the beat began. */
  t: Accessor<number>
  /** Ms of ambient motion since the instrument came on the stage. */
  ambient: Accessor<number>
  /** The phone asks for less motion: draw stills. */
  reduced: boolean
}

/** A question is on the stage, and its instrument moves with it. */
function moving(beat: RoomBeat): boolean {
  return beat === 'listen' || beat === 'answer' || beat === 'reveal'
}

/**
 * Starts `loop` again when the screen comes back, if it is still `wanted`.
 * A loop stops asking for frames while the screen is away; without this,
 * one put away mid-beat stayed still until the beat changed, and holding
 * a question does not change it.
 */
export function startWhenShown(loop: FrameLoop, wanted: () => boolean): void {
  if (typeof document === 'undefined') return
  const back = (): void => {
    if (document.visibilityState !== 'hidden' && untrack(wanted)) loop.start()
  }
  document.addEventListener('visibilitychange', back)
  onCleanup(() => document.removeEventListener('visibilitychange', back))
}

export function useStageClock(): StageClock {
  const room = useRoom()
  const reduced = prefersReducedMotion()
  const [t, setT] = createSignal(reduced ? STILL_MS : 0)
  const [ambient, setAmbient] = createSignal(0)
  const startedAt = performance.now()
  let beatAt = startedAt
  let alive = true

  const loop = createFrameLoop(
    () => {
      const now = performance.now()
      batch(() => {
        setT(now - beatAt)
        setAmbient(now - startedAt)
      })
    },
    {
      alive: () =>
        alive &&
        (typeof document === 'undefined' ||
          document.visibilityState !== 'hidden'),
      running: () => !reduced && moving(room.beat()),
    },
  )

  createEffect(
    on(room.beat, (beat) => {
      beatAt = performance.now()
      if (reduced) return
      setT(0)
      if (moving(beat)) loop.start()
    }),
  )
  startWhenShown(loop, () => !reduced && moving(room.beat()))

  onCleanup(() => {
    alive = false
    loop.stop()
  })

  return { beat: room.beat, t, ambient, reduced }
}

/**
 * When each sound of a train arrived, in the clock's ambient ms, in the
 * order they came. `lit` counts the train's sounds from 1 as the drill
 * lights them, and the train starts again when it comes back from rest
 * (0) to 1; a bar that starts again at 1 without resting runs on.
 */
export function useArrivals(
  lit: Accessor<number>,
  clock: StageClock,
): Accessor<readonly number[]> {
  const [arrivals, setArrivals] = createSignal<readonly number[]>([])
  createEffect(
    on(lit, (now, before) => {
      if (now <= 0) return
      const at = untrack(clock.ambient)
      setArrivals((list) => ((before ?? 0) <= 0 ? [at] : [...list, at]))
    }),
  )
  return arrivals
}

/**
 * Ms since the train's `index`th sound arrived (from 0), or null before
 * it has. Under reduced motion the latest has only just arrived and every
 * earlier one long since, so each instrument draws a still of the moment.
 */
export function arrivalAge(
  arrivals: readonly number[],
  index: number,
  clock: StageClock,
): number | null {
  if (index < 0 || index >= arrivals.length) return null
  if (clock.reduced) return index === arrivals.length - 1 ? 0 : STILL_MS
  return Math.max(0, clock.ambient() - arrivals[index])
}
