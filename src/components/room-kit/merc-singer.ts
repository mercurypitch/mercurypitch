// ============================================================
// Merc sings in a room: his voice, and his face following it
// ============================================================
//
// His call, his answer after a miss and a line heard again at the result
// all go one way in the Ear rooms that sing him (Leap, Harmony): his voice
// (the screen's sampled one, else the synth "ooh") scheduled a moment
// ahead on the audio clock, and his face singing each note as the speaker
// plays it. A demo's takes sing through the demo's own sound instead, so
// for them only his face follows, on the take's clock (`faceFor`).

import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import type { MercMoves } from './merc-moves'
import { SILENT_VOICE } from './room-constants'
import type { RoundVoice } from './round-voice'
import { outputLatency } from './round-voice'

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
  /** A sound is scheduled this far ahead of now, s. */
  readonly lead: number
  /** His voice's tail through the speaker, past the end of his last note, s. */
  readonly tail: number
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
   * now, as the speaker plays it, and `onNote` hears which one.
   */
  faceFor: (
    notes: readonly PhraseNote[],
    msTo: (at: number) => number,
    current: () => boolean,
    onNote?: (index: number) => void,
  ) => void
  /** He sings `notes` from a moment from now; his face follows each one. */
  sing: (
    ctx: AudioContext,
    notes: readonly PhraseNote[],
    current: () => boolean,
    onNote?: (index: number) => void,
  ) => Sung
}

export function createMercSinger(deps: MercSingerDeps): MercSinger {
  const faceFor: MercSinger['faceFor'] = (notes, msTo, current, onNote) => {
    const at = (t: number, then: () => void): void => {
      deps.later(Math.max(0, msTo(t)), () => {
        if (current()) then()
      })
    }
    notes.forEach((note, index) => {
      at(note.at, () => {
        deps.face(singing(note.midi))
        deps.merc.stopCheering()
        deps.merc.set('sing')
        onNote?.(index)
      })
    })
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
    sing: (ctx, notes, current, onNote) => {
      const start = ctx.currentTime + deps.lead
      const sung = deps.voice.sing(ctx, notes, start)
      const latency = outputLatency(ctx)
      faceFor(
        notes,
        (t) => (start + t - ctx.currentTime + latency) * 1000,
        current,
        onNote,
      )
      return {
        endAt: sung.endAt + deps.tail,
        stop: () => sung.stop(),
      }
    },
  }
}
