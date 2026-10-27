// ============================================================
// Merc's sung voice in a room: the seam, the synth stand-in, the latency
// ============================================================
//
// The Ear rooms (Home note, First note) have Merc sing a note: home after
// a miss, an entry the singer missed. His voice comes in through one seam,
// RoundVoice, the shape of Echo's call voice (echo/merc-sampler.ts): the
// native screen hands a room his sampled voice, so no room's feature
// reaches into Echo's. Without one (a browser build, a test) the room
// sings him with the synth "ooh" the rooms already use (demo-audio.ts),
// at any pitch, exactly.
//
// And the one sum every room that schedules sound against its frames does:
// how far the speaker is behind the audio clock.

import { playVoiceContour } from '@/lib/demo-audio'
import { midiToFrequency } from '@/lib/frequency-to-note'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import { roomOutput } from './room-output'

/** A voice that sings Merc's notes: Echo's call voice has this shape. */
export interface RoundVoice {
  sing(
    ctx: AudioContext,
    notes: readonly PhraseNote[],
    startAt: number,
  ): {
    readonly onsets: readonly number[]
    readonly endAt: number
    stop(): void
  }
}

/** Merc's synth voice: his vibrato (merc-voice-set.ts measures the set's). */
const SYNTH_VIBRATO = { hz: 5.5, cents: 14, rampSec: 0.35 }
/** The synth voice's level while he sings (demo-audio's held level). */
const SYNTH_LEVEL = 0.8

/** Merc sung by the synth "ooh", at any pitch, exactly. */
export const SYNTH_VOICE: RoundVoice = {
  sing(ctx, notes, startAt) {
    const onsets = notes.map((note) => startAt + note.at)
    const endAt = notes.reduce(
      (latest, note) => Math.max(latest, startAt + note.at + note.seconds),
      startAt,
    )
    if (notes.length === 0) return { onsets, endAt, stop: () => undefined }
    const ref = notes[0].midi
    const points = notes.flatMap((note) => {
      const cents = (note.midi - ref) * 100
      const end = note.at + note.seconds
      return [
        { t: note.at, cents, level: SYNTH_LEVEL },
        { t: end, cents, level: SYNTH_LEVEL },
        { t: end, cents, level: 0 },
      ]
    })
    const sound = playVoiceContour(ctx, points, {
      hz: midiToFrequency(ref),
      startAt,
      destination: roomOutput(ctx),
      vibrato: SYNTH_VIBRATO,
      lowNoteOctave: true,
    })
    return { onsets, endAt, stop: () => sound.stop() }
  },
}

/** How far the speaker is behind the audio clock, s. */
export function outputLatency(ctx: AudioContext): number {
  const out = ctx.outputLatency
  if (Number.isFinite(out) && out > 0) return out
  const base = ctx.baseLatency
  return Number.isFinite(base) && base > 0 ? base : 0
}
