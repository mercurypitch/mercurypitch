// ============================================================
// Merc's voice in Long note: what he sings along with
// ============================================================
//
// He sings after the singer (the controller's `mercVoice`): quiet on the
// note at rest, on the note at the voice's own offset while a take follows
// it, and on the voice's own pitch while the room listens for an easy note.

import { levelFromRms } from '@/components/room-kit/voice-level'
import type { HoldTick } from '@/lib/hold/hold-engine'
import type { MercVoice } from '@/lib/merc/sim'

/** At rest on `midi`: no voice to follow. */
export function restingVoice(midi: number): MercVoice {
  return { voiced: false, cents: 0, level: 0, steady: 0, midi }
}

/**
 * Following a take on `target`: the engine's smoothed offset (`cents`) and
 * the newest tick's level, steadier the nearer the band's middle (its
 * half-width `tolCents`).
 */
export function heldVoice(
  step: HoldTick | null,
  cents: number,
  target: number,
  tolCents: number,
): MercVoice {
  const voiced = step !== null && step.offCents !== null
  return {
    voiced,
    cents,
    level: levelFromRms(step?.level ?? 0),
    steady: voiced ? 1 - Math.min(1, Math.abs(cents) / tolCents) : 0,
    midi: target + cents / 100,
  }
}

/**
 * Listening for the singer's own note: the voice's pitch, read against
 * MIDI 0 so the offset is the pitch itself, or `from` while it is silent.
 */
export function searchingVoice(step: HoldTick, from: number): MercVoice {
  return {
    voiced: step.offCents !== null,
    cents: 0,
    level: levelFromRms(step.level),
    steady: 0,
    midi: step.offCents === null ? from : step.offCents / 100,
  }
}
