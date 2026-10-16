// ============================================================
// Merc's call: notes in, a schedule on the audio clock out
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { phraseToVoicePoints } from '@/lib/sequence/phrase-voice'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'

const played = vi.hoisted(() => ({
  calls: [] as { points: unknown; options: unknown }[],
  stops: 0,
}))

// The rooms' one way to the speakers (room-kit/room-output.ts).
const ROOM_OUTPUT = vi.hoisted(() => ({ kind: 'room output' }))
vi.mock('@/components/room-kit/room-output', () => ({
  roomOutput: () => ROOM_OUTPUT,
}))

vi.mock('@/lib/demo-audio', () => ({
  playVoiceContour: (_ctx: unknown, points: unknown, options: unknown) => {
    played.calls.push({ points, options })
    return {
      stop: () => {
        played.stops += 1
      },
    }
  },
}))

const { callTimes, SYNTH_CALL } = await import('./merc-call')

const notes: PhraseNote[] = [
  { midi: 57, at: 0, seconds: 0.65 },
  { midi: 61, at: 0.65, seconds: 0.65 },
  { midi: 64, at: 1.3, seconds: 0.65 },
]
const ctx = {} as AudioContext

describe("Merc's call", () => {
  it("puts each note's onset and the call's end on the audio clock", () => {
    const times = callTimes(notes, 10)

    expect(times.onsets.map((t) => +t.toFixed(9))).toEqual([10, 10.65, 11.3])
    expect(times.endAt).toBeCloseTo(11.95, 9)
  })

  it('ends on the latest note to end, not the last one listed', () => {
    const overlapping: PhraseNote[] = [
      { midi: 60, at: 0, seconds: 2 },
      { midi: 62, at: 0.5, seconds: 0.5 },
    ]

    expect(callTimes(overlapping, 1).endAt).toBe(3)
  })

  it('sings the phrase as the synth line, from its first note, at the start asked for, through the room output, with its low-note octave', () => {
    played.calls = []
    const schedule = SYNTH_CALL.sing(ctx, notes, 4.2)

    expect(played.calls).toEqual([
      {
        points: phraseToVoicePoints({ notes }, 57),
        options: {
          hz: midiToFrequency(57),
          startAt: 4.2,
          destination: ROOM_OUTPUT,
          lowNoteOctave: true,
        },
      },
    ])
    expect(schedule.onsets.map((t) => +t.toFixed(9))).toEqual([4.2, 4.85, 5.5])
  })

  it('stops the sound it scheduled', () => {
    played.stops = 0
    SYNTH_CALL.sing(ctx, notes, 0).stop()

    expect(played.stops).toBe(1)
  })

  it('schedules nothing for an empty phrase', () => {
    played.calls = []
    const schedule = SYNTH_CALL.sing(ctx, [], 2)

    expect(played.calls).toEqual([])
    expect(schedule.onsets).toEqual([])
    expect(schedule.endAt).toBe(2)
    expect(() => schedule.stop()).not.toThrow()
  })
})
