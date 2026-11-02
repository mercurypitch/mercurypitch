// ============================================================
// The Leap demo's sound: Merc's call and answer on the take's clock
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import { demoTake } from './demo-script'
import { createDemoSound } from './demo-sound'

// The kit's soundtrack, recorded: the leap's voice it would sing.
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

const ctx = { currentTime: 10 } as unknown as AudioContext

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

describe("the Leap demo's sound", () => {
  beforeEach(() => {
    track.sung = []
    track.stops = 0
  })

  it("sings take 1's call and Merc's answer through his voice, on the take's clock", () => {
    const { voice, calls } = recordedVoice()
    const sound = createDemoSound(ctx, 0.12, voice)
    const take = demoTake('off', 60)
    sound.sing(take, take.round.from)
    // The take's clock reads zero `lead` from now, less the speaker's own.
    const zero = 10 + 0.15 - 0.05
    expect(calls).toEqual([
      { midi: [take.round.from], at: [take.call[0].at], startAt: zero },
      {
        midi: [take.round.from, take.round.to],
        at: take.answer.map((n) => n.at),
        startAt: zero,
      },
    ])
    expect(track.sung).toEqual([take.round.from])
  })

  it("sings take 2's call alone: it lands, so he answers nothing", () => {
    const { voice, calls } = recordedVoice()
    const sound = createDemoSound(ctx, 0.12, voice)
    const take = demoTake('on', 60)
    sound.sing(take, take.round.from)
    expect(calls.map((c) => c.midi)).toEqual([[take.round.from]])
  })

  it('stops everything once, and sings nothing after', () => {
    const { voice, calls, stops } = recordedVoice()
    const sound = createDemoSound(ctx, 0.12, voice)
    sound.sing(demoTake('off', 60), 57)
    sound.stop()
    sound.stop()
    expect(stops()).toBe(2)
    expect(track.stops).toBe(1)
    sound.sing(demoTake('on', 60), 57)
    expect(calls).toHaveLength(2)
  })
})
