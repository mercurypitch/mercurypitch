// ============================================================
// click-synth: each voice's onset is scheduled on the audio clock,
// the caller's level scales the peak within 0..1, and cancel
// silences a click already committed to the clock exactly once.
// ============================================================

import { describe, expect, it } from 'vitest'
import { scheduleClick } from './click-synth'

interface Call {
  method: string
  args: unknown[]
}

function fakeContext(currentTime = 1) {
  const oscillators: Array<{
    calls: Call[]
    type: string
    onended: (() => void) | null
    stopThrows: boolean
  }> = []
  const gains: Array<{ calls: Call[] }> = []
  const record =
    (calls: Call[], method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args })
    }
  return {
    currentTime,
    destination: {},
    oscillators,
    gains,
    createOscillator() {
      const calls: Call[] = []
      const osc = {
        calls,
        type: 'sine',
        onended: null as (() => void) | null,
        stopThrows: false,
        frequency: {
          setValueAtTime: record(calls, 'frequency.setValueAtTime'),
          exponentialRampToValueAtTime: record(
            calls,
            'frequency.exponentialRampToValueAtTime',
          ),
        },
        connect: record(calls, 'connect'),
        disconnect: record(calls, 'disconnect'),
        start: record(calls, 'start'),
        stop(at: number) {
          if (osc.stopThrows) throw new Error('already stopped')
          calls.push({ method: 'stop', args: [at] })
        },
      }
      oscillators.push(osc)
      return osc
    },
    createGain() {
      const calls: Call[] = []
      const gain = {
        calls,
        gain: {
          setValueAtTime: record(calls, 'gain.setValueAtTime'),
          linearRampToValueAtTime: record(
            calls,
            'gain.linearRampToValueAtTime',
          ),
          cancelScheduledValues: record(calls, 'gain.cancelScheduledValues'),
        },
        connect: record(calls, 'connect'),
        disconnect: record(calls, 'disconnect'),
      }
      gains.push(gain)
      return gain
    },
  }
}

const asContext = (ctx: ReturnType<typeof fakeContext>) =>
  ctx as unknown as AudioContext

const peakOf = (gain: { calls: Call[] }) =>
  gain.calls.find((c) => c.method === 'gain.linearRampToValueAtTime')?.args[0]

describe('voices', () => {
  it('ticks by default: a 2 kHz sine that starts at the instant asked', () => {
    const ctx = fakeContext()
    scheduleClick(asContext(ctx), 2.5)
    const [osc] = ctx.oscillators
    expect(osc.type).toBe('sine')
    expect(osc.calls).toContainEqual({
      method: 'frequency.setValueAtTime',
      args: [2000, 2.5],
    })
    expect(
      osc.calls.some(
        (c) => c.method === 'frequency.exponentialRampToValueAtTime',
      ),
    ).toBe(false)
    expect(osc.calls).toContainEqual({ method: 'start', args: [2.5] })
    expect(osc.calls).toContainEqual({
      method: 'stop',
      args: [2.5 + 0.03 + 0.01],
    })
    expect(peakOf(ctx.gains[0])).toBe(0.5)
    expect(ctx.gains[0].calls).toContainEqual({
      method: 'connect',
      args: [ctx.destination],
    })
  })

  it('knocks as wood: a triangle that falls to half its pitch as it dies', () => {
    const ctx = fakeContext()
    scheduleClick(asContext(ctx), 1, { voice: 'wood' })
    const [osc] = ctx.oscillators
    expect(osc.type).toBe('triangle')
    expect(osc.calls).toContainEqual({
      method: 'frequency.setValueAtTime',
      args: [1050, 1],
    })
    expect(osc.calls).toContainEqual({
      method: 'frequency.exponentialRampToValueAtTime',
      args: [525, 1.05],
    })
    expect(peakOf(ctx.gains[0])).toBe(0.6)
  })

  it('taps softly: a low sine with the gentlest onset', () => {
    const ctx = fakeContext()
    scheduleClick(asContext(ctx), 1, { voice: 'soft' })
    const [osc] = ctx.oscillators
    expect(osc.type).toBe('sine')
    expect(osc.calls).toContainEqual({
      method: 'frequency.setValueAtTime',
      args: [620, 1],
    })
    expect(ctx.gains[0].calls).toContainEqual({
      method: 'gain.linearRampToValueAtTime',
      args: [0.6, 1.003],
    })
  })

  it('takes a pitch override', () => {
    const ctx = fakeContext()
    scheduleClick(asContext(ctx), 1, { hz: 880 })
    expect(ctx.oscillators[0].calls).toContainEqual({
      method: 'frequency.setValueAtTime',
      args: [880, 1],
    })
  })
})

describe('level', () => {
  it('scales the peak by the caller’s gain, clamped to 0..1', () => {
    const half = fakeContext()
    scheduleClick(asContext(half), 1, { gainLevel: 0.5 })
    expect(peakOf(half.gains[0])).toBe(0.25)

    const loud = fakeContext()
    scheduleClick(asContext(loud), 1, { gainLevel: 4 })
    expect(peakOf(loud.gains[0])).toBe(0.5)

    const mute = fakeContext()
    scheduleClick(asContext(mute), 1, { gainLevel: -1 })
    expect(peakOf(mute.gains[0])).toBe(0)
  })
})

describe('cancel', () => {
  it('drops the envelope to silence now and stops the oscillator, once', () => {
    const ctx = fakeContext(3)
    const click = scheduleClick(asContext(ctx), 3.4)
    click.cancel()
    click.cancel()
    const [osc] = ctx.oscillators
    const [gain] = ctx.gains
    expect(gain.calls).toContainEqual({
      method: 'gain.cancelScheduledValues',
      args: [3],
    })
    expect(gain.calls).toContainEqual({
      method: 'gain.setValueAtTime',
      args: [0, 3],
    })
    const stops = osc.calls
      .filter((c) => c.method === 'stop')
      .map((c) => c.args[0] as number)
    expect(stops).toHaveLength(2)
    expect(stops[0]).toBeCloseTo(3.44)
    expect(stops[1]).toBe(3)
  })

  it('tears the nodes down when the oscillator ends', () => {
    const ctx = fakeContext()
    const click = scheduleClick(asContext(ctx), 1)
    click.cancel()
    const [osc] = ctx.oscillators
    expect(osc.onended).not.toBeNull()
    osc.onended?.()
    expect(osc.calls).toContainEqual({ method: 'disconnect', args: [] })
    expect(ctx.gains[0].calls).toContainEqual({
      method: 'disconnect',
      args: [],
    })
  })

  it('survives a click that already stopped on its own schedule', () => {
    const ctx = fakeContext()
    const click = scheduleClick(asContext(ctx), 1)
    ctx.oscillators[0].stopThrows = true
    expect(() => click.cancel()).not.toThrow()
  })
})
