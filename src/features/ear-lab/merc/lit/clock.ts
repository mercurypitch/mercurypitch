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
import { batch, createEffect, createSignal, on, onCleanup } from 'solid-js'
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

  onCleanup(() => {
    alive = false
    loop.stop()
  })

  return { beat: room.beat, t, ambient, reduced }
}
