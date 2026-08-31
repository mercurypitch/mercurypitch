// ============================================================
// Session humanizer bridge — groove feel engine onto scheduled GM hits
// ============================================================
//
// Adapts the pure groove humanizer to the session scheduler's hook: GM keys
// fold to the twelve shared voices, the monotonic timeline beat maps to a
// sixteenth-grid position, and unmapped auxiliary percussion passes through
// untouched. Noise indexes cycle every sixteen bars so per-call cost stays
// bounded on arbitrarily long timelines.

import { drumVoiceForMidi } from '@/lib/drum-voice-map'
import type { HumanizeOptions } from '../groove/groove-humanize'
import { humanizeDrumEvents } from '../groove/groove-humanize'
import type { DrumSessionHumanize } from './drum-session-scheduler'

const SIXTEENTH_BEATS = 0.25
const NOISE_CYCLE_BARS = 16
/** Authored hits at or above this velocity count as accents (flam-eligible). */
const ACCENT_VELOCITY = 100

export function createDrumSessionHumanizer(
  options: HumanizeOptions,
): DrumSessionHumanize {
  return (hit) => {
    const articulation = drumVoiceForMidi(hit.gmKey)
    if (articulation === null) return null
    // Nearest grid slot; authored off-grid microtiming rides along unchanged
    // because the engine only ever emits a relative offset.
    const absoluteSixteenth = Math.round(hit.timelineBeat / SIXTEENTH_BEATS)
    const bar = Math.floor(absoluteSixteenth / 16) % NOISE_CYCLE_BARS
    const step = ((absoluteSixteenth % 16) + 16) % 16
    const [event] = humanizeDrumEvents(
      [
        {
          articulation,
          bar,
          step,
          velocity: hit.velocity,
          accent: hit.velocity >= ACCENT_VELOCITY,
        },
      ],
      options,
    )
    return {
      timeOffsetMs: event.timeOffsetMs,
      velocity: event.velocity,
      ornaments: event.ornaments.map((ornament) => ({
        leadMs: ornament.leadMs,
        velocity: ornament.velocity,
      })),
    }
  }
}
