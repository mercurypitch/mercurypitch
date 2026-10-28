// ============================================================
// Merc's call: notes in, a schedule on the audio clock out
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { phraseToVoicePoints } from '@/lib/sequence/phrase-voice'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import type { CallVoice } from './merc-call'

const played = vi.hoisted(() => ({
  calls: [] as { points: unknown; options: unknown }[],
  stops: 0,
}))

// The rooms' one way to the speakers (room-kit/room-output.ts).
const ROOM_OUTPUT = vi.hoisted(() => ({ kind: 'room output' }))
vi.mock('@/components/room-kit/room-output', () => ({
  roomOutput: () => ROOM_OUTPUT,
}))

vi.mock('@/lib/demo-voice', () => ({
  playVoiceContour: (_ctx: unknown, points: unknown, options: unknown) => {
    played.calls.push({ points, options })
    return {
      stop: () => {
        played.stops += 1
      },
    }
  },
}))

const { callTimes, scheduleCall, SYNTH_CALL } = await import('./merc-call')

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

describe("Merc's call on the frames' clock", () => {
  /** A voice that schedules on the call's own times and sounds nothing. */
  const voice: CallVoice = {
    sing: (_ctx, sung, startAt) => ({
      ...callTimes(sung, startAt),
      stop: () => undefined,
    }),
  }
  const at = (latency: Partial<AudioContext>): AudioContext =>
    ({ currentTime: 10, ...latency }) as AudioContext
  const rounded = (t: number): number => +t.toFixed(9)

  it('sings the call `lead` ahead and dates each note from now, as the speaker plays it', () => {
    const call = scheduleCall(
      voice,
      at({ outputLatency: 0.05, baseLatency: 0.01 }),
      notes,
      0.35,
    )

    expect(rounded(call.sound.onsets[0])).toBe(10.35)
    expect(
      call.notes.map((n) => [rounded(n.from), rounded(n.to), n.midi]),
    ).toEqual([
      [0.4, 1.05, 57],
      [1.05, 1.7, 61],
      [1.7, 2.35, 64],
    ])
    expect(rounded(call.endsAt)).toBe(2.35)
  })

  it('takes the base latency when the output latency is unknown, and none when both are', () => {
    const base = scheduleCall(
      voice,
      at({ outputLatency: 0, baseLatency: 0.02 }),
      notes,
      0,
    )
    const neither = scheduleCall(
      voice,
      at({ outputLatency: Number.NaN }),
      notes,
      0,
    )

    expect(rounded(base.notes[0].from)).toBe(0.02)
    expect(neither.notes[0].from).toBe(0)
  })
})
