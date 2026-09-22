// ── Jam input monitor tests ──────────────────────────────────────────
// The point of this module is answering "is my guitar reaching the
// browser, and on which channel" without touching what the room hears. So
// the cases that matter are: the meter works while monitoring is off, the
// selected channel is the one metered and heard, and nothing here throws
// on a browser that will not build the graph -- because the alternative to
// a missing meter must never be a room that does not open.

import { describe, expect, it, vi } from 'vitest'
import { createJamInputMonitor, loudestChannel, monitorChannelCount, } from '@/lib/jam/jam-input-monitor'

/** A Web Audio stand-in that records the graph it was asked to build. */
function fakeContext(opts: { baseLatency?: number } = {}) {
  const connections: Array<{ from: string; to: string; ch?: number }> = []
  const node = (name: string) => ({
    name,
    gain: {
      value: 0,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn((v: number) => {
        ctx.lastRampTarget = v
      }),
    },
    channelCount: 2,
    channelCountMode: 'max',
    channelInterpretation: 'speakers',
    fftSize: 2048,
    smoothingTimeConstant: 0,
    connect: vi.fn((to: { name: string }, ch?: number) => {
      connections.push({ from: name, to: to.name, ch })
    }),
    disconnect: vi.fn(),
    getFloatTimeDomainData: vi.fn(),
  })

  const analysers: ReturnType<typeof node>[] = []
  const ctx = {
    connections,
    analysers,
    lastRampTarget: 0,
    closed: false,
    currentTime: 0,
    baseLatency: opts.baseLatency,
    destination: node('destination'),
    createMediaStreamSource: vi.fn(() => {
      const n = node('source')
      n.channelCount = 2
      return n
    }),
    createChannelSplitter: vi.fn((count: number) => node(`splitter:${count}`)),
    createGain: vi.fn(() => node('gain')),
    createAnalyser: vi.fn(() => {
      const a = node(`analyser:${analysers.length}`)
      analysers.push(a)
      return a
    }),
    resume: vi.fn(),
    close: vi.fn(() => {
      ctx.closed = true
    }),
  }
  return ctx
}

const streamWith = (channelCount: number | undefined) =>
  ({
    getAudioTracks: () => [{ getSettings: () => ({ channelCount }) }],
  }) as unknown as MediaStream

describe('monitorChannelCount', () => {
  it('takes what the track reports', () => {
    expect(monitorChannelCount(4, 2)).toBe(4)
  })

  it('falls back to the source when the track will not say', () => {
    // Safari omits most of the settings block.
    expect(monitorChannelCount(undefined, 2)).toBe(2)
    expect(monitorChannelCount(0, 6)).toBe(6)
  })

  it('is one channel when nothing says otherwise, never zero', () => {
    expect(monitorChannelCount(undefined, undefined)).toBe(1)
    expect(monitorChannelCount(Number.NaN, -1)).toBe(1)
  })

  it('clamps rather than throwing on an absurd count', () => {
    // Guitar Night throws here because a missing channel is a wrong pitch
    // answer. A monitor losing a channel it cannot address is worth much
    // less than a room that will not open.
    expect(monitorChannelCount(64, 1)).toBe(32)
  })
})

describe('loudestChannel', () => {
  it('names the channel the signal is actually on', () => {
    // The whole question a guitarist has: which input am I plugged into.
    expect(loudestChannel([0.001, 0.4, 0.002])).toBe(1)
  })

  it('says nothing rather than guessing when everything is silent', () => {
    // A guess here points somebody at the wrong cable.
    expect(loudestChannel([0, 0, 0])).toBeNull()
    expect(loudestChannel([0.001, 0.002])).toBeNull()
    expect(loudestChannel([])).toBeNull()
  })
})

describe('createJamInputMonitor', () => {
  it('splits every channel the capture exposes', () => {
    const ctx = fakeContext()
    const m = createJamInputMonitor({
      stream: streamWith(4),
      context: ctx as unknown as AudioContext,
    })
    expect(m?.channelCount).toBe(4)
    expect(ctx.createChannelSplitter).toHaveBeenCalledWith(4)
    // One analyser per channel: the meter has to answer for all of them,
    // not just the one being listened to.
    expect(ctx.analysers).toHaveLength(4)
  })

  it('meters without being audible', () => {
    // The reason the two are separate. "Can the browser see my guitar" is
    // a question you want answered without putting it in your ears, and in
    // a room with speakers hearing yourself is a feedback loop.
    const ctx = fakeContext()
    const m = createJamInputMonitor({
      stream: streamWith(2),
      context: ctx as unknown as AudioContext,
    })
    expect(m?.enabled()).toBe(false)
    expect(() => m?.channelLevels()).not.toThrow()
    expect(m?.channelLevels()).toHaveLength(2)
  })

  it('ramps the monitor rather than stepping it', () => {
    // A gain that jumps to 1 on a guitar already being played is a click
    // straight into somebody's headphones.
    const ctx = fakeContext()
    const m = createJamInputMonitor({
      stream: streamWith(2),
      context: ctx as unknown as AudioContext,
    })
    m?.setEnabled(true)
    expect(m?.enabled()).toBe(true)
    expect(ctx.lastRampTarget).toBe(1)
    m?.setEnabled(false)
    expect(ctx.lastRampTarget).toBe(0)
  })

  it('rewires when the channel changes', () => {
    const ctx = fakeContext()
    const m = createJamInputMonitor({
      stream: streamWith(4),
      context: ctx as unknown as AudioContext,
    })
    const before = ctx.connections.filter((c) => c.ch === 2).length
    m?.setChannel(2)
    expect(m?.channel()).toBe(2)
    expect(ctx.connections.filter((c) => c.ch === 2).length).toBeGreaterThan(
      before,
    )
  })

  it('refuses a channel the capture does not have', () => {
    // Connecting a splitter outlet that does not exist throws in Web
    // Audio, which would take the panel down.
    const ctx = fakeContext()
    const m = createJamInputMonitor({
      stream: streamWith(2),
      context: ctx as unknown as AudioContext,
    })
    m?.setChannel(9)
    expect(m?.channel()).toBe(1)
    m?.setChannel(-3)
    expect(m?.channel()).toBe(0)
  })

  it('reports the latency this graph really adds', () => {
    // The budget guesses a platform constant for capture; this is the one
    // figure script can actually read.
    const ctx = fakeContext({ baseLatency: 0.0026 })
    const m = createJamInputMonitor({
      stream: streamWith(2),
      context: ctx as unknown as AudioContext,
    })
    expect(m?.baseLatencyMs()).toBeCloseTo(2.6, 5)
  })

  it('says it does not know rather than inventing a latency', () => {
    const ctx = fakeContext()
    const m = createJamInputMonitor({
      stream: streamWith(2),
      context: ctx as unknown as AudioContext,
    })
    expect(m?.baseLatencyMs()).toBeNull()
  })

  it('returns null for a stream with no audio, rather than throwing', () => {
    const empty = { getAudioTracks: () => [] } as unknown as MediaStream
    expect(
      createJamInputMonitor({
        stream: empty,
        context: fakeContext() as unknown as AudioContext,
      }),
    ).toBeNull()
  })

  it('survives a browser that will not build the graph', () => {
    // An AudioContext refused before a user gesture, on the device least
    // able to show you why.
    const hostile = {
      ...fakeContext(),
      createMediaStreamSource: () => {
        throw new Error('NotSupportedError')
      },
    }
    expect(
      createJamInputMonitor({
        stream: streamWith(2),
        context: hostile as unknown as AudioContext,
      }),
    ).toBeNull()
  })

  it('leaves a borrowed context open and closes its own', () => {
    // Closing a context the caller owns would silence whatever else is
    // using it.
    const ctx = fakeContext()
    const m = createJamInputMonitor({
      stream: streamWith(2),
      context: ctx as unknown as AudioContext,
    })
    m?.dispose()
    expect(ctx.closed).toBe(false)
  })

  it('goes quiet after disposal instead of reading a dead graph', () => {
    const ctx = fakeContext()
    const m = createJamInputMonitor({
      stream: streamWith(2),
      context: ctx as unknown as AudioContext,
    })
    m?.dispose()
    expect(m?.level()).toBe(0)
    expect(m?.channelLevels()).toEqual([])
    expect(() => m?.dispose()).not.toThrow()
  })
})
