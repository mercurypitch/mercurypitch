// ============================================================
// A glide room's own notes: the first root at the count-in, the next in a breath
// ============================================================
//
// The glide rooms (Ng slides, Lip roll) play each arch's root before it
// starts, in the count-in and, at Beginner and Singer, in the breath
// before it (the preset's `playsNextRoot`). Ng slides' bridge-tones.ts,
// made shared. Nothing plays while
// the singer sings: every tone is shorter than the breath it sits in, and
// a dropped run stops whatever still sounds.

import type { ReferenceTone } from '@/lib/reference-tone'
import { startReferenceTone } from '@/lib/reference-tone'
import { roomOutput } from './room-output'

export interface RoomTones {
  /** Play `midi` for `seconds`, now. */
  play: (ctx: AudioContext, midi: number, seconds: number) => void
  /** Stop every tone still sounding. */
  stop: () => void
}

export function createRoomTones(): RoomTones {
  const sounding = new Set<ReferenceTone>()
  return {
    play: (ctx, midi, seconds) => {
      const tone = startReferenceTone(ctx, midi, seconds, roomOutput(ctx))
      sounding.add(tone)
      void tone.done.then(() => sounding.delete(tone))
    },
    stop: () => {
      for (const tone of sounding) tone.stop()
      sounding.clear()
    },
  }
}
