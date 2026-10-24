// ============================================================
// Lesson sound doubles — a fake AudioContext that records its schedule
// ============================================================
//
// jsdom cannot render audio, so the sound tests (sound.test.ts,
// sound-ahead.test.ts, and the run tests through run.test-fixtures.ts's
// `soundOn`) stub AudioContext with this one: every node it makes records
// what the page schedules on its params, and `valueAt` replays those events
// against the Web Audio curve definitions.

export type Event = [method: string, ...args: number[]]

export class FakeParam {
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

export class FakeNode {
  connect(): void {}
  disconnect(): void {}
}

export class FakeOscillator extends FakeNode {
  readonly frequency = new FakeParam(440)
  readonly detune = new FakeParam(0)
  readonly stops: number[] = []
  setPeriodicWave(): void {}
  start(): void {}
  stop(t: number): void {
    this.stops.push(t)
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1)
}

export class FakeFilter extends FakeNode {
  /** The context that made it: a timbre builds its own nodes from it. */
  context: FakeContext | null = null
  type = 'lowpass'
  readonly frequency = new FakeParam(350)
  readonly Q = new FakeParam(1)
}

export class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam(-24)
  readonly knee = new FakeParam(30)
  readonly ratio = new FakeParam(12)
  readonly attack = new FakeParam(0.003)
  readonly release = new FakeParam(0.25)
}

export class FakeBuffer {
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

export class FakeBufferSource extends FakeNode {
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

export class FakeContext {
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
    f.context = this
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
export function valueAt(
  events: readonly Event[],
  t: number,
  initial: number,
): number {
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

export const AUDIBLE = 0.01 // -40 dB
