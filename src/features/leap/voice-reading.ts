// ============================================================
// The singer's voice against a leap's two notes, one frame at a time
// ============================================================
//
// What one frame of the singer's turn shows: the trail's point (read
// against the leap's middle, cliff-layout.ts), whether the voice sits on
// Merc's note (his line brightens) or in the target's band (the lantern
// warms), and Merc's face, which follows the voice toward the target. Pure:
// the controller keeps when the voice entered the band, and the turn's
// voice between frames.

import { levelFromRms } from '@/components/room-kit/voice-level'
import type { TrailPoint } from '@/components/room-kit/voice-trail'
import { offTarget } from '@/lib/hold/hold-reading'
import type { MercVoice } from '@/lib/merc/sim'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { trailNote } from './cliff-layout'
import type { LeapRound } from './leap-round'

export interface LeapVoiceReading {
  /** The trail's point: the voice off the leap's middle, cents, or none. */
  readonly point: TrailPoint
  /** Merc's face following the voice; null when the frame has no voice. */
  readonly voice: MercVoice | null
  /** The voice sits on Merc's note, within the band. */
  readonly onFrom: boolean
  /** The voice sits in the target's band: the lantern warms. */
  readonly inTarget: boolean
}

/** One frame of the turn, heard against `round` with a band of `tolCents`. */
export function readLeapVoice(
  frame: PitchFrame,
  round: LeapRound,
  tolCents: number,
): LeapVoiceReading {
  const toTarget = offTarget(frame, round.to)
  const toFrom = offTarget(frame, round.from)
  const point = { t: frame.t, cents: offTarget(frame, trailNote(round)) }
  if (toTarget === null || toFrom === null) {
    return { point, voice: null, onFrom: false, inTarget: false }
  }
  return {
    point,
    voice: {
      voiced: true,
      cents: toTarget,
      level: levelFromRms(frame.rms),
      steady: 1 - Math.min(1, Math.abs(toTarget) / (tolCents * 4)),
      midi: round.to + toTarget / 100,
    },
    onFrom: Math.abs(toFrom) <= tolCents,
    inTarget: Math.abs(toTarget) <= tolCents,
  }
}
