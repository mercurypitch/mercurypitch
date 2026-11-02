// ============================================================
// Merc sings in the Leap room: his voice, and his face following it
// ============================================================
//
// His call, his answer after a miss and a leap heard again at the result
// all go one way: his voice (the screen's sampled one, else the synth
// "ooh") scheduled a moment ahead on the audio clock, and his face singing
// each note as the speaker plays it. The demo's takes sing through the
// demo's own sound instead, so for them only his face follows, on the
// take's clock (`faceFor`).

import type { MercMoves } from '@/components/room-kit/merc-moves'
import { SILENT_VOICE } from '@/components/room-kit/room-constants'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import { outputLatency } from '@/components/room-kit/round-voice'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import { SOUND_LEAD_SECONDS, VOICE_TAIL_SECONDS } from './leap-rules'

/** Merc's voice while he sings (demo-voice's held level). */
const SUNG_LEVEL = 0.8

/** Merc's face while he sings `midi`, held and on it. */
export function singing(midi: number): MercVoice {
  return { voiced: true, cents: 0, level: SUNG_LEVEL, steady: 1, midi }
}

/** A sound of Merc's, scheduled on the audio clock. */
export interface Sung {
  /** When it has died away at the speaker, audio clock, s. */
  readonly endAt: number
  stop(): void
}

export interface MercSingerDeps {
  readonly voice: RoundVoice
  /** A timer that belongs to the screen (room-kit room-life.ts). */
  later: (ms: number, fn: () => void) => void
  /** His face's voice now: a note he sings, or silence. */
  face: (voice: MercVoice) => void
  readonly merc: Pick<MercMoves, 'set' | 'stopCheering'>
  /** Where he stands once he has sung: listening in a run, else idle. */
  after: () => MercState
}

export interface MercSinger {
  /**
   * His face follows `notes` while `current()`: each note `msTo(at)` from
   * now, as the speaker plays it.
   */
  faceFor: (
    notes: readonly PhraseNote[],
    msTo: (at: number) => number,
    current: () => boolean,
  ) => void
  /** He sings `notes` from a moment from now; his face follows each one. */
  sing: (
    ctx: AudioContext,
    notes: readonly PhraseNote[],
    current: () => boolean,
  ) => Sung
}

export function createMercSinger(deps: MercSingerDeps): MercSinger {
  const faceFor: MercSinger['faceFor'] = (notes, msTo, current) => {
    const at = (t: number, then: () => void): void => {
      deps.later(Math.max(0, msTo(t)), () => {
        if (current()) then()
      })
    }
    for (const note of notes) {
      at(note.at, () => {
        deps.face(singing(note.midi))
        deps.merc.stopCheering()
        deps.merc.set('sing')
      })
    }
    const last = notes[notes.length - 1]
    if (last !== undefined) {
      at(last.at + last.seconds + 0.1, () => {
        deps.face(SILENT_VOICE)
        deps.merc.set(deps.after())
      })
    }
  }

  return {
    faceFor,
    sing: (ctx, notes, current) => {
      const start = ctx.currentTime + SOUND_LEAD_SECONDS
      const sung = deps.voice.sing(ctx, notes, start)
      const latency = outputLatency(ctx)
      faceFor(
        notes,
        (t) => (start + t - ctx.currentTime + latency) * 1000,
        current,
      )
      return {
        endAt: sung.endAt + VOICE_TAIL_SECONDS,
        stop: () => sung.stop(),
      }
    },
  }
}
