// ============================================================
// Phrase voice — a phrase as Merc's sung line for playVoiceContour (pure)
// ============================================================
//
// Merc sings each note from its onset and holds it. Between notes sung
// straight on he glides into the next one over its last GLIDE_SECONDS, so
// the pitch arrives on the next note's onset, the time the engine's rhythm
// judge measures against. A gap between notes is a rest.

import type { VoicePoint } from '@/lib/demo-voice'
import type { Phrase } from './sequence-engine'

/** His level on a held note (demo-voice.ts measured a held note at 0.8). */
const SUNG_LEVEL = 0.8

/** How long he takes to move into the next note sung straight on, s. */
export const GLIDE_SECONDS = 0.06

const EPS = 1e-6

/**
 * The line in cents from `refMidi`, timed from the start of the call. Play
 * it with `playVoiceContour(ctx, points, { hz: midiToFrequency(refMidi) })`.
 */
export function phraseToVoicePoints(
  phrase: Phrase,
  refMidi: number,
): VoicePoint[] {
  const points: VoicePoint[] = []
  for (const [i, note] of phrase.notes.entries()) {
    const cents = (note.midi - refMidi) * 100
    const end = note.at + note.seconds
    const next = phrase.notes[i + 1]
    points.push({ t: note.at, cents, level: SUNG_LEVEL })
    if (next !== undefined && next.at <= end + EPS) {
      const glide = Math.max(note.at, next.at - GLIDE_SECONDS)
      points.push({ t: glide, cents, level: SUNG_LEVEL })
    } else {
      points.push({ t: end, cents, level: SUNG_LEVEL })
      points.push({ t: end, cents, level: 0 })
    }
  }
  return points
}
