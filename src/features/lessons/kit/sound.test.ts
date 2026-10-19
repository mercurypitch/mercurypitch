// ============================================================
// Lesson sound tests — a sung contour's shape, and a stop that never pops
// ============================================================
//
// jsdom cannot render audio, so these tests record what the page schedules
// on a fake AudioContext and replay it against the Web Audio curve
// definitions: the pitch must hold and glide exponentially through every
// point, the envelope must open on the house attack from the 1e-4 floor,
// and every scheduled stop must land below -40 dB, as the app's tail net
// asks of its own voices (src/tests/audio-engine.test.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as SoundKit from './sound'

type Event = [method: string, ...args: number[]]

class FakeParam {
  value: number
  readonly events: Event[] = []
  constructor(value: number) {
    this.value = value
  }
  setValueAtTime(v: number, t: number): void {
    this.events.push(['setValueAtTime', v, t])
  }
  linearRampToValueAtTime(v: number, t: number): void {
    this.events.push(['linearRampToValueAtTime', v, t])
  }
  exponentialRampToValueAtTime(v: number, t: number): void {
    if (v <= 0) throw new RangeError('an exponential ramp cannot reach 0')
    this.events.push(['exponentialRampToValueAtTime', v, t])
  }
  setTargetAtTime(v: number, t: number, tau: number): void {
    this.events.push(['setTargetAtTime', v, t, tau])
  }
  cancelScheduledValues(t: number): void {
    this.events.push(['cancelScheduledValues', t])
  }
}

class FakeNode {
  connect(): void {}
  disconnect(): void {}
}

class FakeOscillator extends FakeNode {
  readonly frequency = new FakeParam(440)
  readonly detune = new FakeParam(0)
  readonly stops: number[] = []
  setPeriodicWave(): void {}
  start(): void {}
  stop(t: number): void {
    this.stops.push(t)
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1)
}

class FakeFilter extends FakeNode {
  type = 'lowpass'
  readonly frequency = new FakeParam(350)
  readonly Q = new FakeParam(1)
}

class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam(-24)
  readonly knee = new FakeParam(30)
  readonly ratio = new FakeParam(12)
  readonly attack = new FakeParam(0.003)
  readonly release = new FakeParam(0.25)
}

class FakeBuffer {
  readonly data: Float32Array
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.data = new Float32Array(length)
  }
  getChannelData(): Float32Array {
    return this.data
  }
}

class FakeBufferSource extends FakeNode {
  buffer: FakeBuffer | null = null
  loop = false
  readonly starts: number[] = []
  readonly stops: number[] = []
  start(t: number): void {
    this.starts.push(t)
  }
  stop(t: number): void {
    this.stops.push(t)
  }
}

class FakeContext {
  static last: FakeContext | null = null
  currentTime = 0
  state = 'running'
  readonly sampleRate = 48000
  readonly destination = new FakeNode()
  readonly oscillators: FakeOscillator[] = []
  readonly gains: FakeGain[] = []
  readonly sources: FakeBufferSource[] = []
  readonly filters: FakeFilter[] = []
  constructor() {
    FakeContext.last = this
  }
  createBuffer(channels: number, length: number, rate: number): FakeBuffer {
    return new FakeBuffer(channels, length, rate)
  }
  createBufferSource(): FakeBufferSource {
    const s = new FakeBufferSource()
    this.sources.push(s)
    return s
  }
  createOscillator(): FakeOscillator {
    const o = new FakeOscillator()
    this.oscillators.push(o)
    return o
  }
  createGain(): FakeGain {
    const g = new FakeGain()
    this.gains.push(g)
    return g
  }
  createBiquadFilter(): FakeFilter {
    const f = new FakeFilter()
    this.filters.push(f)
    return f
  }
  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor()
  }
  createPeriodicWave(): object {
    return {}
  }
  resume(): Promise<void> {
    return Promise.resolve()
  }
}

/** The param's value at `t` from its events (the spec's curves; cancels honoured). */
function valueAt(events: readonly Event[], t: number, initial: number): number {
  const kept: Event[] = []
  for (const e of events) {
    if (e[0] === 'cancelScheduledValues') {
      const at = e[1]
      for (let i = kept.length - 1; i >= 0; i--)
        if (kept[i][2] >= at) kept.splice(i, 1)
    } else kept.push(e)
  }
  let v = initial
  let vt = 0
  let target: { at: number; to: number; tau: number } | null = null
  const settle = (until: number): void => {
    if (target === null || until <= target.at) return
    v =
      target.to + (v - target.to) * Math.exp(-(until - target.at) / target.tau)
    vt = until
    target = { ...target, at: until }
  }
  for (const [method, to, at, tau] of kept) {
    if (at > t) {
      if (method.endsWith('RampToValueAtTime') && target === null) {
        const k = (t - vt) / (at - vt)
        return method === 'linearRampToValueAtTime'
          ? v + (to - v) * k
          : v * (to / v) ** k
      }
      break
    }
    settle(at)
    if (method === 'setTargetAtTime') target = { at, to, tau }
    else {
      v = to
      vt = at
      target = null
    }
  }
  settle(t)
  return v
}

const AUDIBLE = 0.01 // -40 dB

// Lesson 2's slide on A3 (FACTS 50): A held, up a semitone, held, and back
const A3 = 220
const A_SHARP_3 = 233.08
const SLIDE = [
  { hold: 1.2 },
  { glide: 0.5, to: A_SHARP_3 },
  { hold: 1 },
  { glide: 0.5, to: A3 },
  { hold: 1 },
]

async function soundOn(): Promise<{
  kit: typeof SoundKit
  ctx: FakeContext
}> {
  const kit = await import('./sound')
  kit.Sound.set('on')
  const ctx = FakeContext.last
  if (ctx === null) throw new Error('no context was made')
  return { kit, ctx }
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

describe('contourOf', () => {
  it('turns holds and glides into points at the right times and pitches', async () => {
    // Arrange
    const { kit } = await soundOn()

    // Act
    const points = kit.contourOf(A3, SLIDE)

    // Assert
    expect(points.map((p) => [p.t, p.hz])).toEqual([
      [0, A3],
      [1.2, A3],
      [1.7, A_SHARP_3],
      [2.7, A_SHARP_3],
      [3.2, A3],
      [4.2, A3],
    ])
    expect(kit.contourLength(points)).toBe(4.2)
  })
})

describe('contourVoice', () => {
  it('holds and glides exponentially through every point of the line', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act
    kit.contourVoice(kit.contourOf(A3, SLIDE), { kind: 'merc' })

    // Assert
    const voice = ctx.oscillators[0]
    expect(voice.frequency.events).toEqual([
      ['setValueAtTime', A3, 0],
      ['exponentialRampToValueAtTime', A3, 1.2],
      ['exponentialRampToValueAtTime', A_SHARP_3, 1.7],
      ['exponentialRampToValueAtTime', A_SHARP_3, 2.7],
      ['exponentialRampToValueAtTime', A3, 3.2],
      ['exponentialRampToValueAtTime', A3, 4.2],
    ])
    expect(valueAt(voice.frequency.events, 1.45, A3)).toBeCloseTo(
      Math.sqrt(A3 * A_SHARP_3),
      6,
    )
  })

  it('opens on an exponential attack from the floor and releases at its last point', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act
    kit.contourVoice(kit.contourOf(A3, SLIDE), { kind: 'merc' })

    // Assert: master is the first gain; then the voice's envelope
    const envelope = ctx.gains[1].gain.events
    expect(envelope).toEqual([
      ['setValueAtTime', 1e-4, 0],
      ['exponentialRampToValueAtTime', 1, 0.09],
      ['setValueAtTime', 1, 4.2],
      ['setTargetAtTime', 0, 4.2, 0.34 / 5],
    ])
  })

  it('stops the voice and its vibrato only once the release is below audibility', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act
    kit.contourVoice(kit.contourOf(A3, SLIDE), { kind: 'merc' })

    // Assert
    const [voice, vibrato] = ctx.oscillators
    const stopAt = voice.stops.at(-1) ?? 0
    expect(stopAt).toBeCloseTo(4.2 + 0.34 + 0.06, 9)
    expect(vibrato.stops.at(-1)).toBe(stopAt)
    expect(valueAt(ctx.gains[1].gain.events, stopAt, 0)).toBeLessThan(AUDIBLE)
  })

  it('releases from wherever the line is when stopped early, and still stops below audibility', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()
    const v = kit.contourVoice(kit.contourOf(A3, SLIDE), { kind: 'merc' })
    const envelope = ctx.gains[1].gain
    ctx.currentTime = 2
    envelope.value = 1

    // Act
    v?.stop()

    // Assert: the scheduled release at 4.2 is cancelled, a new one starts now
    const stopAt = ctx.oscillators[0].stops.at(-1) ?? 0
    expect(envelope.events).toContainEqual(['cancelScheduledValues', 2])
    expect(envelope.events.at(-1)).toEqual(['setTargetAtTime', 0, 2, 0.34 / 5])
    expect(valueAt(envelope.events, 4.2, 0)).toBeLessThan(AUDIBLE)
    expect(stopAt).toBeCloseTo(2 + 0.34 + 0.06, 9)
    expect(valueAt(envelope.events, stopAt, 0)).toBeLessThan(AUDIBLE)
  })

  it('moves the level along the line, never ramping it to zero', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()
    const swell = kit.contourOf(A3, [
      { hold: 1, level: 0.5 },
      { hold: 1, level: 0 },
    ])

    // Act
    kit.contourVoice(swell, { gain: 0.2 })

    // Assert: the level gain is the voice's second gain
    const level = ctx.gains[2].gain.events
    expect(level).toEqual([
      ['setValueAtTime', 0.2, 0],
      ['exponentialRampToValueAtTime', 0.1, 1],
      ['exponentialRampToValueAtTime', 1e-4, 2],
    ])
  })

  it('plays nothing while sound is off', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()
    kit.Sound.set('off')

    // Act
    const v = kit.contourVoice(kit.contourOf(A3, SLIDE))

    // Assert
    expect(v).toBeNull()
    expect(ctx.oscillators).toHaveLength(0)
  })
})

describe('a voice that starts later (Lesson 5, the air-first start)', () => {
  it('opens on the house attack at its own time on the audio clock', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act
    kit.Sound.voice(A3, { kind: 'merc', at: 0.25, attack: 0.25 })

    // Assert: the master is the first gain; then the voice's envelope
    expect(ctx.oscillators[0].frequency.events).toEqual([
      ['setValueAtTime', A3, 0.25],
    ])
    expect(ctx.gains[1].gain.events).toEqual([
      ['setValueAtTime', 1e-4, 0.25],
      ['exponentialRampToValueAtTime', 1, 0.5],
    ])
  })
})

describe('playNoise', () => {
  it('plays a band-passed burst on the house envelope, stopped only once its release is below audibility', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act: the air of an "h", 0.35 s
    kit.playNoise({
      dur: 0.35,
      gain: 0.06,
      band: { hz: 2400, q: 0.8 },
      release: 0.12,
    })

    // Assert
    const [source] = ctx.sources
    const envelope = ctx.gains[1].gain.events
    expect(envelope).toEqual([
      ['setValueAtTime', 1e-4, 0],
      ['exponentialRampToValueAtTime', 0.06, 0.02],
      ['setValueAtTime', 0.06, 0.35],
      ['setTargetAtTime', 0, 0.35, 0.12 / 5],
    ])
    expect(ctx.filters.at(-1)?.type).toBe('bandpass')
    expect(source.starts).toEqual([0])
    const stopAt = source.stops.at(-1) ?? 0
    expect(stopAt).toBeCloseTo(0.35 + 0.12 + 0.06, 9)
    expect(valueAt(envelope, stopAt, 0)).toBeLessThan(AUDIBLE / 10)
  })

  it('makes a 3 ms click at its own time, white, with no band', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()
    const filtersBefore = ctx.filters.length

    // Act
    kit.playNoise({
      dur: 0.003,
      gain: 0.25,
      attack: 0.0005,
      release: 0.002,
      at: 0.15,
    })

    // Assert
    expect(ctx.sources[0].starts).toEqual([0.15])
    expect(ctx.filters).toHaveLength(filtersBefore)
    expect(ctx.gains[1].gain.events[0]).toEqual(['setValueAtTime', 1e-4, 0.15])
  })

  it('plays nothing while sound is off or a take is open', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act
    kit.Sound.hush(true)
    kit.playNoise({ dur: 0.35 })
    kit.Sound.hush(false)
    kit.Sound.set('off')
    kit.playNoise({ dur: 0.35 })

    // Assert
    expect(ctx.sources).toHaveLength(0)
  })
})
