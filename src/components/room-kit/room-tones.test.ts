// ============================================================
// A glide room's own notes: each one with its low-note octave
// ============================================================
//
// The rooms' notes play through reference-tone.ts, which adds a soft octave
// below C3 only when asked (low-note-reinforcement.ts). The glide rooms ask.

import { describe, expect, it, vi } from 'vitest'

const ROOM_OUTPUT = vi.hoisted(() => ({ kind: 'room output' }))
const tones = vi.hoisted(() => ({
  started: [] as { args: unknown[]; stopped: boolean }[],
}))

vi.mock('@/lib/reference-tone', () => ({
  startReferenceTone: (...args: unknown[]) => {
    const tone = {
      args,
      stopped: false,
      stop: () => {
        tone.stopped = true
      },
      done: new Promise<void>(() => undefined),
    }
    tones.started.push(tone)
    return tone
  },
}))
vi.mock('./room-output', () => ({ roomOutput: () => ROOM_OUTPUT }))

const { createRoomTones } = await import('./room-tones')

describe('createRoomTones', () => {
  it('plays each note through the room output, with its low-note octave', () => {
    const ctx = {} as AudioContext
    const room = createRoomTones()
    room.play(ctx, 45, 0.7)
    expect(tones.started.map((tone) => tone.args)).toEqual([
      [ctx, 45, 0.7, ROOM_OUTPUT, { lowNoteOctave: true }],
    ])
    room.stop()
    expect(tones.started[0].stopped).toBe(true)
  })
})
