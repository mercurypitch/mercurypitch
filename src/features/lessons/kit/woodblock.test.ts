// ============================================================
// Woodblock tests — the Ear Lab's knock, on a run's bus
// ============================================================
//
// Lesson 17 FACTS 62: the kit's knock has the Ear Lab's `wood` voice's
// shape, checked against the Ear Lab's own scheduler on one fake context,
// beat 1's at 1,575 Hz; it goes into the run's bus, never the output, and
// books nothing once that bus has closed.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { scheduleClick } from '@/features/ear-lab/click-synth'
import type { Bus } from './sound-ahead'
import type { FakeGain, FakeOscillator } from './sound-doubles.test-fixtures'
import { FakeContext, FakeNode } from './sound-doubles.test-fixtures'
import { bookWood, WOOD } from './woodblock'

function fakeBus(ctx: FakeContext, open = true): Bus {
  return {
    context: ctx as unknown as AudioContext,
    node: ctx.createGain() as unknown as GainNode,
    open,
    close() {},
  }
}

const shape = (osc: FakeOscillator, gain: FakeGain) => ({
  type: (osc as unknown as { type: string }).type,
  frequency: osc.frequency.events,
  gain: gain.gain.events,
  stops: osc.stops,
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('bookWood', () => {
  it("knocks with the Ear Lab's wood voice, at the level asked", () => {
    // Arrange: the Ear Lab's knock at half its level, which peaks at 0.3, and the kit's at 0.3
    const ctx = new FakeContext()
    const bus = fakeBus(ctx)
    scheduleClick(ctx as unknown as AudioContext, 2, {
      voice: 'wood',
      gainLevel: 0.5,
    })

    // Act
    bookWood(bus, 2, false, 0.3)

    // Assert: gains[0] is the bus's own, gains[1] the Ear Lab's knock, gains[2] the kit's
    const ear = shape(ctx.oscillators[0], ctx.gains[1])
    const kit = shape(ctx.oscillators[1], ctx.gains[2])
    expect(kit).toEqual(ear)
    expect(kit.type).toBe('triangle')
    expect(kit.frequency).toEqual([
      ['setValueAtTime', 1050, 2],
      ['exponentialRampToValueAtTime', 525, 2.05],
    ])
  })

  it('knocks beat 1 with the same voice at 1,575 Hz, 1.5 times the others', () => {
    // Arrange: the Ear Lab's knock pitched to 1,575 Hz, as its caller may pitch it
    const ctx = new FakeContext()
    const bus = fakeBus(ctx)
    scheduleClick(ctx as unknown as AudioContext, 1, {
      voice: 'wood',
      hz: 1575,
      gainLevel: 0.5,
    })

    // Act
    bookWood(bus, 1, true, 0.3)

    // Assert
    const kit = shape(ctx.oscillators[1], ctx.gains[2])
    expect(kit).toEqual(shape(ctx.oscillators[0], ctx.gains[1]))
    expect(WOOD.highHz / WOOD.hz).toBe(1.5)
    expect(kit.frequency).toEqual([
      ['setValueAtTime', 1575, 1],
      ['exponentialRampToValueAtTime', 787.5, 1.05],
    ])
  })

  it("goes into the run's bus, never straight to the output", () => {
    // Arrange
    const ctx = new FakeContext()
    const bus = fakeBus(ctx)
    const connect = vi.spyOn(FakeNode.prototype, 'connect')

    // Act
    bookWood(bus, 1, false, 0.2)

    // Assert: the oscillator into its gain, the gain into the bus
    const knock = ctx.gains[1]
    expect(connect.mock.calls).toEqual([[knock], [bus.node]])
    expect(connect.mock.calls.flat()).not.toContain(ctx.destination)
  })

  it('knocks now when its time has passed', () => {
    // Arrange
    const ctx = new FakeContext()
    ctx.currentTime = 3

    // Act
    bookWood(fakeBus(ctx), 2.5, false, 0.2)

    // Assert: its pitch and its level both start now, nothing before it
    const times = [
      ...ctx.oscillators[0].frequency.events,
      ...ctx.gains[1].gain.events,
    ].map((e) => e[2])
    expect(ctx.oscillators[0].frequency.events[0]).toEqual([
      'setValueAtTime',
      1050,
      3,
    ])
    expect(Math.min(...times)).toBe(3)
    expect(ctx.oscillators[0].stops).toEqual([3 + WOOD.len + 0.01])
  })

  it('books nothing once its bus has closed', () => {
    // Arrange
    const ctx = new FakeContext()

    // Act
    bookWood(fakeBus(ctx, false), 1, true, 0.2)

    // Assert
    expect(ctx.oscillators).toHaveLength(0)
  })
})
