// ============================================================
// The room's own notes: the first root at the count-in, the next in a breath
// ============================================================
//
// DESIGN-ng-slides.md 3: the singer hears each slide's root before it
// starts, in the count-in and, at Beginner and Singer, in the breath
// before each slide (the preset's `playsNextRoot`). Nothing plays while
// the singer slides: every tone is shorter than the breath it sits in, and
// a dropped run stops whatever still sounds.

import { roomOutput } from '@/components/room-kit/room-output'
import type { ReferenceTone } from '@/lib/reference-tone'
import { startReferenceTone } from '@/lib/reference-tone'

export interface BridgeTones {
  /** Play `midi` for `seconds`, now. */
  play: (ctx: AudioContext, midi: number, seconds: number) => void
  /** Stop every tone still sounding. */
  stop: () => void
}

export function createBridgeTones(): BridgeTones {
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
