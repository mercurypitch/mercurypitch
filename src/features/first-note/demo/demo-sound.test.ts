// ============================================================
// The First note demo's sound: the band's clip, the voice, Merc's note
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import { entryPitch } from '../first-note-songs'
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

// The band's clip, recorded: when it would start.
const band = vi.hoisted(() => ({ starts: [] as number[], stops: 0 }))
vi.mock('./demo-band', () => ({
  playBand: (_ctx: AudioContext, _clip: AudioBuffer, at: number) => {
    band.starts.push(at)
    return {
      stop: () => {
        band.stops += 1
      },
    }
  },
}))

const ctx = { currentTime: 10 } as unknown as AudioContext
const CLIP = { duration: 8 } as unknown as AudioBuffer
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

describe("the First note demo's sound", () => {
  beforeEach(() => {
    track.sung = []
    track.stops = 0
    band.starts = []
    band.stops = 0
  })

  it("starts the band's clip at the lead-in, on the take's clock, and the voice with it", () => {
    const { voice } = recordedVoice()
    const sound = createDemoSound(ctx, 0.12, voice, CLIP)
    const take = demoTake('on')
    const note = entryPitch(take.round.entry)
    sound.sing(take, note)
    expect(band.starts).toEqual([ZERO + take.introAt])
    expect(track.sung).toEqual([note])
  })

  it("has Merc sing the note after take 1's miss, through his voice", () => {
    const { voice, calls } = recordedVoice()
    const sound = createDemoSound(ctx, 0.12, voice, CLIP)
    const take = demoTake('off')
    sound.sing(take, entryPitch(take.round.entry))
    expect(calls).toEqual([
      {
        midi: [entryPitch(take.round.entry)],
        at: take.answer.map((n) => n.at),
        startAt: ZERO,
      },
    ])
  })

  it('has him sing nothing after take 2: it lands', () => {
    const { voice, calls } = recordedVoice()
    const sound = createDemoSound(ctx, 0.12, voice, CLIP)
    sound.sing(demoTake('on'), 52)
    expect(calls).toEqual([])
  })

  it('plays the takes without their band when the clip would not load', () => {
    const { voice } = recordedVoice()
    const sound = createDemoSound(ctx, 0.12, voice, null)
    sound.sing(demoTake('on'), 52)
    expect(band.starts).toEqual([])
    expect(track.sung).toEqual([52])
  })

  it('stops everything once, and plays nothing after', () => {
    const { voice, calls, stops } = recordedVoice()
    const sound = createDemoSound(ctx, 0.12, voice, CLIP)
    sound.sing(demoTake('off'), 52)
    sound.stop()
    sound.stop()
    expect(stops()).toBe(1)
    expect(band.stops).toBe(1)
    expect(track.stops).toBe(1)
    sound.sing(demoTake('on'), 52)
    expect(calls).toHaveLength(1)
    expect(band.starts).toHaveLength(1)
  })
})
