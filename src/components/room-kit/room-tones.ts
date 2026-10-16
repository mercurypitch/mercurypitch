// ============================================================
// A glide room's own notes: the first root at the count-in, the next in a breath
// ============================================================
//
// The glide rooms (Ng slides, Lip roll) play each arch's root before it
// starts, in the count-in and, at Beginner and Singer, in the breath
// before it (the preset's `playsNextRoot`). Nothing plays while the singer
// sings: every tone is shorter than the breath it sits in, and a dropped
// run stops whatever still sounds.
//
// Every note a room or its demo plays starts here (`startRoomTone`), and
// none starts on a clock that is not running. reference-tone.ts resumes a
// suspended clock to play, which is right for the screens that call it
// from a tap, and wrong behind Control Center: the clock the app parked
// would come back with the room's next note, the singer still away. A
// room's clock comes back with the singer's next tap (useExerciseCapture).

import type { ReferenceTone } from '@/lib/reference-tone'
import { startReferenceTone } from '@/lib/reference-tone'
import { roomOutput } from './room-output'

export interface RoomTones {
  /** Play `midi` for `seconds`, now. */
  play: (ctx: AudioContext, midi: number, seconds: number) => void
  /** Stop every tone still sounding. */
  stop: () => void
}

/**
 * A room's note, low-note octave included, into `destination` (the room
 * output unless a demo has a bus of its own). Null, and nothing started,
 * while the clock is not running.
 */
export function startRoomTone(
  ctx: AudioContext,
  midi: number,
  seconds: number,
  destination: AudioNode = roomOutput(ctx),
): ReferenceTone | null {
  if (ctx.state !== 'running') return null
  return startReferenceTone(ctx, midi, seconds, destination, {
    lowNoteOctave: true,
  })
}

export function createRoomTones(): RoomTones {
  const sounding = new Set<ReferenceTone>()
  return {
    play: (ctx, midi, seconds) => {
      const tone = startRoomTone(ctx, midi, seconds)
      if (tone === null) return
      sounding.add(tone)
      void tone.done.then(() => sounding.delete(tone))
    },
    stop: () => {
      for (const tone of sounding) tone.stop()
      sounding.clear()
    },
  }
}
