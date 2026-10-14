import { describe, expect, it } from 'vitest'
import type { VoicePoint } from './demo-audio'
import { playHoldTone, playVoiceContour } from './demo-audio'

type Call = readonly [
  method: string,
  value: number,
  time: number,
  ...rest: number[],
]

/** An AudioParam that remembers every automation call. */
function recordingParam(initial = 1) {
  const calls: Call[] = []
  const record =
    (method: string) =>
    (value: number, time: number, ...rest: number[]) => {
      calls.push([method, value, time, ...rest])
    }
  return {
    value: initial,
    calls,
    setValueAtTime: record('set'),
    linearRampToValueAtTime: record('linear'),
    exponentialRampToValueAtTime: record('exponential'),
    setTargetAtTime: record('target'),
    cancelScheduledValues: (time: number) => calls.push(['cancel', 0, time]),
  }
}

type Param = ReturnType<typeof recordingParam>

interface FakeNode {
  kind: string
  connections: unknown[]
  disconnected: boolean
  connect: (to: unknown) => unknown
  disconnect: () => void
}

function fakeNode(kind: string): FakeNode {
  const node: FakeNode = {
    kind,
    connections: [],
    disconnected: false,
    connect: (to) => {
      node.connections.push(to)
      return to
    },
    disconnect: () => {
      node.disconnected = true
    },
  }
  return node
}

function fakeContext() {
  const gains: (FakeNode & { gain: Param })[] = []
  const oscillators: (FakeNode & {
    type: string
    frequency: Param
    detune: Param
    starts: number[]
    stops: number[]
    onended: (() => void) | null
  })[] = []
  const filters: (FakeNode & { frequency: Param; Q: Param })[] = []
  const destination = fakeNode('destination')
  const ctx = {
    currentTime: 10,
    destination,
    createGain: () => {
      const node = Object.assign(fakeNode('gain'), { gain: recordingParam() })
      gains.push(node)
      return node
    },
    createOscillator: () => {
      const node = Object.assign(fakeNode('oscillator'), {
        type: 'sine',
        frequency: recordingParam(440),
        detune: recordingParam(0),
        starts: [] as number[],
        stops: [] as number[],
        onended: null as (() => void) | null,
        setPeriodicWave: () => undefined,
        start: (when: number) => node.starts.push(when),
        stop: (when: number) => node.stops.push(when),
      })
      oscillators.push(node)
      return node
    },
    createBiquadFilter: () => {
      const node = Object.assign(fakeNode('filter'), {
        type: 'lowpass',
        frequency: recordingParam(350),
        Q: recordingParam(1),
      })
      filters.push(node)
      return node
    },
    createPeriodicWave: () => ({}),
  }
  return {
    ctx: ctx as unknown as AudioContext,
    gains,
    oscillators,
    filters,
    destination,
  }
}

/** A breath, a note that scoops up and drifts, a rest, a short second note. */
const LINE: VoicePoint[] = [
  { t: 0, cents: 0, level: 0 },
  { t: 0.5, cents: -30, level: 0.6 },
  { t: 1, cents: 0, level: 0.8 },
  { t: 2, cents: 50, level: 0.8 },
  { t: 2.5, cents: 0, level: 0 },
  { t: 3, cents: 0, level: 0 },
  { t: 3.5, cents: 10, level: 0.7 },
  { t: 4, cents: 0, level: 0.7 },
]

const VIBRATO = { hz: 5.5, cents: 14, rampSec: 0.35 }

function play() {
  const fake = fakeContext()
  const handle = playVoiceContour(fake.ctx, LINE, {
    hz: 220,
    startAt: 11,
    vibrato: VIBRATO,
  })
  // master, level, vibrato depth; voice, vibrato
  const [master, level, depth] = fake.gains
  const [voice, lfo] = fake.oscillators
  return { ...fake, handle, master, level, depth, voice, lfo }
}

describe('playVoiceContour', () => {
  it('follows the line in cents, on the note it is given', () => {
    const { voice } = play()
    expect(voice.frequency.value).toBe(220)
    const detune = voice.detune.calls
    // Each run jumps to its first point, then ramps through the rest.
    expect(detune.filter(([m]) => m === 'set')).toEqual([
      ['set', -30, 11.5],
      ['set', 10, 14.5],
    ])
    expect(detune.filter(([m]) => m === 'linear')).toEqual([
      ['linear', 0, 12],
      ['linear', 50, 13],
      ['linear', 0, 15],
    ])
  })

  it('opens each note from the floor and closes each rest on a target', () => {
    const { level } = play()
    const calls = level.gain.calls
    // First note: exponential attack from 1e-4.
    expect(calls).toContainEqual(['set', 0.0001, 11.5])
    expect(calls).toContainEqual([
      'exponential',
      expect.closeTo(0.18, 3),
      11.59,
    ])
    // Its rest: anchored at its level, then a setTargetAtTime (len 0.18).
    expect(calls).toContainEqual(['set', expect.closeTo(0.24, 3), 13.5])
    expect(calls).toContainEqual(['target', 0, 13.5, expect.closeTo(0.036, 6)])
    // The second note opens from the floor again.
    expect(calls).toContainEqual(['set', 0.0001, 14.5])
    expect(calls.some(([m, v]) => m === 'linear' && v === 0)).toBe(false)
  })

  it('grows the vibrato in after every onset', () => {
    const { depth, lfo, voice } = play()
    expect(lfo.frequency.value).toBe(5.5)
    expect(depth.connections).toContain(voice.detune)
    expect(depth.gain.calls).toEqual([
      ['set', 0, 11],
      ['set', 0, 11.5],
      ['linear', 14, 11.85],
      ['set', 0, 14.5],
      ['linear', 14, 14.85],
    ])
    expect(lfo.starts).toEqual([11])
  })

  it('stops only after the last release has died away', () => {
    const { voice, lfo, level } = play()
    const lastClose = level.gain.calls.filter(([m]) => m === 'target').pop()
    expect(lastClose).toBeDefined()
    if (lastClose === undefined) return
    const [, , close, tau] = lastClose
    const stop = voice.stops[0]
    expect(lfo.stops[0]).toBe(stop)
    // Below -50 dB of its level by the time the oscillator stops.
    expect(Math.exp(-(stop - close) / (tau ?? 1))).toBeLessThan(0.003)
  })

  it('closes on stop() with a setTargetAtTime, never a linear ramp', () => {
    const { handle, master, voice, lfo } = play()
    handle.stop()
    handle.stop()
    const calls = master.gain.calls
    expect(calls).toContainEqual(['cancel', 0, 10])
    expect(calls).toContainEqual(['target', 0, 10, expect.closeTo(0.036, 6)])
    expect(calls.some(([m]) => m === 'linear')).toBe(false)
    expect(voice.stops[voice.stops.length - 1]).toBeCloseTo(10.24, 6)
    expect(lfo.stops[lfo.stops.length - 1]).toBeCloseTo(10.24, 6)
    // Called twice, closed once.
    expect(calls.filter(([m]) => m === 'target')).toHaveLength(1)
  })

  it('leaves nothing connected once it has ended', () => {
    const { voice, gains } = play()
    voice.onended?.()
    expect(voice.disconnected).toBe(true)
    expect(gains.every((gain) => gain.disconnected)).toBe(true)
  })

  it('goes where it is sent', () => {
    const fake = fakeContext()
    const bus = fakeNode('bus')
    playVoiceContour(fake.ctx, LINE, {
      hz: 220,
      destination: bus as unknown as AudioNode,
    })
    expect(fake.gains[0].connections).toEqual([bus])
  })
})

describe("playVoiceContour's timbres", () => {
  const colourOf = (timbre?: 'ooh' | 'hum') => {
    const fake = fakeContext()
    playVoiceContour(fake.ctx, LINE, { hz: 110, timbre })
    const [filter] = fake.filters
    return { hz: filter.frequency.value, q: filter.Q.value }
  }

  it('sings an open "ooh" unless told otherwise', () => {
    expect(colourOf()).toEqual(colourOf('ooh'))
    expect(colourOf('ooh').hz).toBe(2600)
  })

  it('hums through a lower, slightly resonant filter: the same partials, duller', () => {
    const ooh = colourOf('ooh')
    const hum = colourOf('hum')
    expect(hum.hz).toBeLessThan(ooh.hz / 2)
    expect(hum.q).toBeGreaterThan(ooh.q)
    // A low hum on a phone speaker still reaches its overtones: A2's 8th.
    expect(hum.hz).toBeGreaterThan(110 * 8)
  })
})

describe('the older demo sounds', () => {
  it('still close on their quick ramp', () => {
    const fake = fakeContext()
    playHoldTone(fake.ctx, 220).stop()
    const [master] = fake.gains
    expect(master.gain.calls).toContainEqual(['linear', 0.0001, 10.04])
    expect(master.connections).toEqual([fake.destination])
  })
})
