// Studio handoff timing tests — where a new run takes over from a held one, and how the two envelopes cross.
import { describe, expect, it } from 'vitest'
import { cancelHandoff, handoffTiming, scheduleHandoff } from './handoff'
import { PlaybackContext } from './playback.test-fixtures'
import type { StudioRun } from './run'

/** A run that has played frame 1000 since 2 s, fully open at 2.09 s, in a two-second song. */
function heldRun(overrides: Partial<StudioRun> = {}): StudioRun {
  return {
    ctx: { sampleRate: 48000 } as AudioContext,
    startFrame: 1000,
    audibleEpoch: 2,
    openAt: 2.09,
    endFrame: 96000,
    untilFrame: 96000,
    ...overrides,
  } as StudioRun
}

describe('Studio handoff timing', () => {
  it('starts the new run on the frame the held run plays at that moment', () => {
    expect(handoffTiming(heldRun(), 2.5, 96000)).toEqual({
      fromFrame: 25000,
      audibleEpoch: 2.5,
    })
  })

  it('takes the next whole frame, and float noise under a frame costs none', () => {
    const timing = handoffTiming(heldRun(), 2.5 + 0.4 / 48000, 96000)
    expect(timing).toEqual({
      fromFrame: 25001,
      audibleEpoch: 2 + 24001 / 48000,
    })
    expect(handoffTiming(heldRun(), 2.5 - 1e-12, 96000)?.fromFrame).toBe(25000)
  })

  it('waits for the held run to open fully before crossing', () => {
    expect(handoffTiming(heldRun(), 2.05, 96000)).toEqual({
      fromFrame: 5320,
      audibleEpoch: 2.09,
    })
  })

  it('counts a repeating run in passes, and starts the new one inside the pass', () => {
    const repeating = heldRun({ untilFrame: Infinity })
    expect(handoffTiming(repeating, 4.5, 96000)).toEqual({
      fromFrame: 121000 - 96000,
      audibleEpoch: 4.5,
    })
  })

  it('has no handover once the held run has played its last pass', () => {
    expect(handoffTiming(heldRun(), 4.05, 96000)).toBeNull()
  })

  it('starts the new song from the top when it now ends before that frame', () => {
    expect(handoffTiming(heldRun(), 2.5, 20000)).toEqual({
      fromFrame: 0,
      audibleEpoch: 2.5,
    })
  })

  it('starts the song from the top on the next whole frame of the clock, as a Play would', () => {
    const timing = handoffTiming(heldRun(), 2.5 + 0.4 / 48000, 20000)
    expect(timing?.fromFrame).toBe(0)
    expect(timing!.audibleEpoch * 48000).toBeCloseTo(120001, 6)
  })
})

describe('Studio handoff crossfade', () => {
  it('crosses the two envelopes linearly over 30 ms from the handover time', () => {
    const ctx = new PlaybackContext()
    const held = ctx.createGain()
    const next = ctx.createGain()
    const done = scheduleHandoff(
      held as unknown as GainNode,
      next as unknown as GainNode,
      3,
    )
    expect(done).toBeCloseTo(3.03, 12)
    expect(held.gain.events).toEqual([{ kind: 'set', time: 3, value: 1 }])
    expect(held.gain.linearRamps).toEqual([{ value: 0, time: done }])
    expect(next.gain.value).toBe(0)
    expect(next.gain.events).toEqual([{ kind: 'set', time: 3, value: 0 }])
    expect(next.gain.linearRamps).toEqual([{ value: 1, time: done }])
  })

  it("crosses a seek's two unrelated places at equal power: the gains' squares sum to one all the way", () => {
    const ctx = new PlaybackContext()
    const held = ctx.createGain()
    const next = ctx.createGain()
    const done = scheduleHandoff(
      held as unknown as GainNode,
      next as unknown as GainNode,
      3,
      true,
    )
    expect(done).toBeCloseTo(3.03, 12)
    expect(held.gain.events).toEqual([{ kind: 'set', time: 3, value: 1 }])
    expect(next.gain.events).toEqual([{ kind: 'set', time: 3, value: 0 }])
    const out = held.gain.linearRamps
    const into = next.gain.linearRamps
    expect(out.length).toBeGreaterThanOrEqual(8)
    expect(into.map(({ time }) => time)).toEqual(out.map(({ time }) => time))
    for (const [index, { value }] of out.entries())
      expect(value ** 2 + into[index].value ** 2).toBeCloseTo(1, 12)
    // Halfway each side is at -3 dB, where a linear pair would be at -6 dB.
    const middle = out[out.length / 2 - 1]
    expect(middle.time).toBeCloseTo(3.015, 12)
    expect(middle.value).toBeCloseTo(Math.SQRT1_2, 12)
    expect(out.at(-1)).toEqual({ value: 0, time: done })
    expect(into.at(-1)).toEqual({ value: 1, time: done })
  })

  it('takes back only the fade of a crossfade not begun, keeping the hold at its start', () => {
    const ctx = new PlaybackContext()
    const held = ctx.createGain()
    cancelHandoff(held as unknown as GainNode, 3)
    // Before the first point either fade draws, after the hold at 3 s.
    const [cancel] = held.gain.events
    expect(cancel).toMatchObject({ kind: 'cancel' })
    expect(cancel.time).toBeGreaterThan(3)
    expect(cancel.time).toBeLessThan(3 + 0.03 / 8)
  })
})
