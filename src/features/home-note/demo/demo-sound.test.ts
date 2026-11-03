// ============================================================
// The Home note demo's sound: the band, the voice and Merc's home
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import type { VoicedChord } from '../home-note-round'
import { voiceChord } from '../home-note-round'
import { CHORD_SECONDS, RESOLVE_SECONDS } from '../home-note-rules'
import { demoTake } from './demo-script'
import { createDemoSound } from './demo-sound'

// The kit's soundtrack, recorded: the voice it would sing.
const track = vi.hoisted(() => ({ sung: [] as number[], stops: 0 }))
vi.mock('@/components/demo-kit/demo-sound', () => ({
  createDemoSoundtrack: () => ({
    lead: 0.15,
    tone: () => undefined,
    sing: (_take: unknown, midi: number) => track.sung.push(midi),
    stop: () => {
      track.stops += 1
    },
  }),
  outputLatency: () => 0.05,
}))

// The band, recorded: each chord it would play, from when, for how long.
const band = vi.hoisted(() => ({
  chords: [] as { chord: unknown; at: number; seconds: number }[],
  stops: 0,
}))
vi.mock(import('../home-note-band'), async (importOriginal) => ({
  ...(await importOriginal()),
  playChord: (
    _ctx: AudioContext,
    chord: VoicedChord,
    at: number,
    seconds: number,
  ) => {
    band.chords.push({ chord, at, seconds })
    return {
      endAt: at + seconds,
      stop: () => {
        band.stops += 1
      },
    }
  },
}))

const ctx = { currentTime: 10 } as unknown as AudioContext
/** The take's clock reads zero `lead` from now, less the speaker's own. */
const ZERO = 10 + 0.15 - 0.05

/** Merc's voice, recorded: what it was asked to sing, from when. */
function recordedVoice() {
  const calls: { midi: number[]; at: number[]; startAt: number }[] = []
  let stops = 0
  const voice: RoundVoice = {
    sing: (_ctx, notes: readonly PhraseNote[], startAt) => {
      calls.push({
        midi: notes.map((n) => n.midi),
        at: notes.map((n) => n.at),
        startAt,
      })
      return {
        onsets: [],
        endAt: startAt + 3,
        stop: () => {
          stops += 1
        },
      }
    },
  }
  return { voice, calls, stops: () => stops }
}

describe("the Home note demo's sound", () => {
  beforeEach(() => {
    track.sung = []
    track.stops = 0
    band.chords = []
    band.stops = 0
  })

  it("plays the band's intro, then home's chord at the outcome, on the take's clock", () => {
    const { voice } = recordedVoice()
    const sound = createDemoSound(ctx, 0.12, voice)
    const take = demoTake('on', 60)
    sound.sing(take, take.round.home)
    const intro = take.rules.intro.map((chord, i) => ({
      chord: voiceChord(60, chord),
      at: ZERO + take.introAt + i * CHORD_SECONDS,
      seconds: CHORD_SECONDS,
    }))
    expect(band.chords).toEqual([
      ...intro,
      {
        chord: voiceChord(60, 'I'),
        at: ZERO + take.resolveAt,
        seconds: RESOLVE_SECONDS,
      },
    ])
    expect(track.sung).toEqual([60])
  })

  it("has Merc sing home after take 1's miss, through his voice", () => {
    const { voice, calls } = recordedVoice()
    const sound = createDemoSound(ctx, 0.12, voice)
    const take = demoTake('off', 60)
    sound.sing(take, take.round.home)
    expect(calls).toEqual([
      { midi: [60], at: take.answer.map((n) => n.at), startAt: ZERO },
    ])
  })

  it('has him sing nothing after take 2: it lands', () => {
    const { voice, calls } = recordedVoice()
    const sound = createDemoSound(ctx, 0.12, voice)
    sound.sing(demoTake('on', 60), 60)
    expect(calls).toEqual([])
  })

  it('stops everything once, and plays nothing after', () => {
    const { voice, calls, stops } = recordedVoice()
    const sound = createDemoSound(ctx, 0.12, voice)
    sound.sing(demoTake('off', 60), 60)
    const chords = band.chords.length
    sound.stop()
    sound.stop()
    expect(stops()).toBe(1)
    expect(band.stops).toBe(chords)
    expect(track.stops).toBe(1)
    sound.sing(demoTake('on', 60), 60)
    expect(calls).toHaveLength(1)
    expect(band.chords).toHaveLength(chords)
  })
})
