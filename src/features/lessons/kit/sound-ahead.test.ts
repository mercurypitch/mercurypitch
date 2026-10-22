// ============================================================
// Lesson sound booked ahead — a bus that closes with every sound, and a note the clock releases
// ============================================================
//
// What the beat clock books ahead must stop on the audio clock: a bus
// fades out on its owner's close and drops once silent, and closes when
// sound goes off, a take opens or the page is hidden; a note starts at its
// time and releases at its end with no timer involved. The fake context
// records the schedule (sound-doubles.test-fixtures.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as SoundKit from './sound'
import type * as AheadKit from './sound-ahead'
import type { FakeGain } from './sound-doubles.test-fixtures'
import { AUDIBLE, FakeContext, FakeNode, valueAt, } from './sound-doubles.test-fixtures'

const A3 = 220

/** The sound module and this one, fresh, with sound on and the context made. */
async function soundOn(): Promise<{
  kit: typeof SoundKit
  ahead: typeof AheadKit
  ctx: FakeContext
}> {
  const kit = await import('./sound')
  const ahead = await import('./sound-ahead')
  kit.Sound.set('on')
  const ctx = FakeContext.last
  if (ctx === null) throw new Error('no context was made')
  return { kit, ahead, ctx }
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  FakeContext.last = null
  vi.stubGlobal('AudioContext', FakeContext)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('a bus (Lesson 8, the beat clock)', () => {
  it("fades out over 30 ms on its owner's close, tells its owner, and drops once silent", async () => {
    // Arrange
    const { ahead, ctx } = await soundOn()
    const onClose = vi.fn()
    const bus = ahead.openBus(onClose)
    if (bus === null) throw new Error('no bus')
    const dropped = vi.spyOn(bus.node, 'disconnect')
    ctx.currentTime = 1

    // Act
    bus.close()

    // Assert
    expect(bus.open).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect((bus.node as unknown as FakeGain).gain.events.at(-1)).toEqual([
      'setTargetAtTime',
      0,
      1,
      0.006,
    ])
    expect(dropped).not.toHaveBeenCalled()
    vi.advanceTimersByTime(90)
    expect(dropped).toHaveBeenCalledTimes(1)
  })

  it('closes with every voice when sound goes off or a take opens, and is not made meanwhile', async () => {
    // Arrange
    const { kit, ahead } = await soundOn()
    const first = ahead.openBus()
    const second = ahead.openBus()

    // Act
    kit.Sound.set('off')
    const whileOff = ahead.openBus()
    kit.Sound.set('on')
    const third = ahead.openBus()
    kit.Sound.hush(true)
    const whileHushed = ahead.openBus()

    // Assert
    expect([first?.open, second?.open, third?.open]).toEqual([
      false,
      false,
      false,
    ])
    expect(whileOff).toBeNull()
    expect(whileHushed).toBeNull()
  })
})

describe('a note booked ahead (Lesson 8, a sung syllable on the beat)', () => {
  it('starts at its time and releases on the audio clock, never by a timer', async () => {
    // Arrange
    const { ahead, ctx } = await soundOn()
    ctx.currentTime = 1

    // Act
    const v = ahead.bookNote(A3, { kind: 'merc', when: 2, dur: 0.5 })
    vi.advanceTimersByTime(5000)

    // Assert: the master is the first gain; then the voice's envelope
    expect(v).not.toBeNull()
    expect(ctx.gains[1].gain.events).toEqual([
      ['setValueAtTime', 1e-4, 2],
      ['exponentialRampToValueAtTime', 1, 2.09],
      ['setValueAtTime', 1, 2.5],
      ['setTargetAtTime', 0, 2.5, 0.068],
    ])
    expect(ctx.oscillators[0].stops).toEqual([2.5 + 0.34 + 0.06])
    expect(valueAt(ctx.gains[1].gain.events, 2.9, 1)).toBeLessThan(AUDIBLE)
  })

  it('plays into the bus it is given, not the master', async () => {
    // Arrange
    const { ahead, ctx } = await soundOn()
    const bus = ahead.openBus()
    if (bus === null) throw new Error('no bus')
    const into = vi.spyOn(FakeNode.prototype, 'connect')
    const off = vi.spyOn(FakeNode.prototype, 'disconnect')

    // Act
    ahead.bookNote(A3, { when: 0.2, dur: 0.3, to: bus.node })

    // Assert
    expect(off).toHaveBeenCalledTimes(1)
    expect(into).toHaveBeenLastCalledWith(bus.node)
    expect(ctx.oscillators).toHaveLength(1)
    into.mockRestore()
    off.mockRestore()
  })
})
