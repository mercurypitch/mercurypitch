// ============================================================
// The Lip roll demo's count-in note: the room's own, low octave included
// ============================================================
//
// Each take opens with its root, as the room's count-in plays it: so the
// demo asks reference-tone.ts for the same octave below C3 the room does.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COUNT_IN_TONE_SEC } from '../lip-run'
import type { LipDemoTake } from './demo-script'

const ROOM_OUTPUT = vi.hoisted(() => ({ kind: 'room output' }))
const started = vi.hoisted(() => [] as unknown[][])

vi.mock('@/lib/reference-tone', () => ({
  startReferenceTone: (...args: unknown[]) => {
    started.push(args)
    return { stop: () => undefined, done: new Promise<void>(() => undefined) }
  },
}))
vi.mock('@/components/room-kit/room-output', () => ({
  roomOutput: () => ROOM_OUTPUT,
}))
vi.mock('@/components/demo-kit/demo-sound', () => ({
  outputLatency: () => 0,
  createDemoSoundtrack: () => ({
    lead: 0.12,
    tone: () => undefined,
    sing: () => undefined,
    stop: () => undefined,
  }),
}))

const { createDemoSound } = await import('./demo-sound')

beforeEach(() => {
  started.length = 0
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('the Lip roll demo sound', () => {
  it("plays each take's root with its low-note octave", () => {
    const ctx = {} as AudioContext
    const sound = createDemoSound(ctx, 0.12)
    sound.sing({ root: 45 } as unknown as LipDemoTake, 45)
    vi.advanceTimersByTime(1000)
    expect(started).toEqual([
      [ctx, 45, COUNT_IN_TONE_SEC, ROOM_OUTPUT, { lowNoteOctave: true }],
    ])
    sound.stop()
  })
})
