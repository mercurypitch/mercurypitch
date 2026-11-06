// ============================================================
// Drum hits tests — Subdivide's bars as hits, struck into a run's bus
// ============================================================
//
// Lesson 19 plays Subdivide's drums (its WEB-SPEC, Audio; FACTS 18, 63): a
// bar's steps in order, its accent full and the rest at 0.7, each struck
// with the app's drum voice into the bus it is given, at its time.

import { describe, expect, it, vi } from 'vitest'
import { patternOf } from '@/lib/ear/metre'
import type { Bus } from './sound-ahead'

const struck: unknown[][] = []
vi.mock('@/lib/drum-voices', () => ({
  triggerDrumVoice: (...args: unknown[]) => struck.push(args),
}))

const { bookDrum, DRUM_LEVEL, drumsOf } = await import('./drum-hits')

describe('drum hits', () => {
  it("reads Subdivide's two bars of 6/8 step by step, the kick full and the rest at 0.7", () => {
    // Arrange
    const a = patternOf('metre:6-8:a')
    const b = patternOf('metre:6-8:b')
    if (a === undefined || b === undefined) throw new Error('no 6/8')

    // Act
    const hits = [drumsOf(a), drumsOf(b)].map((bar) =>
      bar.map((h) => `${h.voice} ${h.level}`),
    )

    // Assert: in threes, then the quick check's second bar (FACTS 18, 68)
    expect(DRUM_LEVEL).toBe(0.7)
    expect(hits).toEqual([
      [
        'kick 1',
        'hh-closed 0.7',
        'hh-closed 0.7',
        'snare 0.7',
        'hh-closed 0.7',
        'hh-closed 0.7',
      ],
      [
        'kick 1',
        'hh-closed 0.7',
        'sidestick 0.7',
        'kick 0.7',
        'hh-closed 0.7',
        'sidestick 0.7',
      ],
    ])
  })

  it('strikes a hit with its voice and level at its time, into the bus it is given', () => {
    // Arrange
    const context = {} as AudioContext
    const node = {} as GainNode
    const bus: Bus = { context, node, open: true, close: () => undefined }

    // Act
    bookDrum({ voice: 'snare', level: 0.7 }, 2.5, bus)

    // Assert
    expect(struck).toEqual([['snare', context, 2.5, 0.7, node]])
  })
})
