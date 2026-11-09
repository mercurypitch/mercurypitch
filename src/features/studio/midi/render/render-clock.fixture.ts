// ============================================================
// Studio MIDI render clock — an OfflineAudioContext stand-in for render tests: the nodes the real instruments make, what each source was told, and a render that walks its suspends
// ============================================================
//
// It processes no audio. A render walks its suspend points in time order,
// as a browser's does, and waits at each one for the page to resume it. At
// each point every source that has started by then, and reaches the
// destination and plays for a moment at least, leaves a mark of 1 on its
// start frame in the output; then every source that has ended by then
// fires `ended`, so an instrument frees its voices as it would in a
// browser. Before its render, the clock refuses to resume, as an offline
// context does. The sound itself is checked in a real browser.
import { PlaybackParam } from '@/lib/studio/playback/playback.test-fixtures'
import { FakeBuffer, FakeNode, reaches, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'

class RenderBuffer extends FakeBuffer {
  get duration(): number {
    return this.length / this.sampleRate
  }
}

/** A gain that remembers every node it was ever wired to: a sound's teardown clears its live connections. */
class RenderGain extends FakeNode {
  readonly gain = new PlaybackParam(1)
  readonly wired: FakeNode[] = []
  constructor() {
    super('gain')
  }

  override connect(node: FakeNode, output = 0, input = 0): FakeNode {
    this.wired.push(node)
    return super.connect(node, output, input)
  }
}

class RenderFilter extends FakeNode {
  type: BiquadFilterType = 'lowpass'
  readonly frequency = new PlaybackParam(350)
  readonly Q = new PlaybackParam(1)
  readonly gain = new PlaybackParam(0)
  constructor() {
    super('biquad')
  }
}

class RenderDelay extends FakeNode {
  readonly delayTime = new PlaybackParam(0)
  constructor(readonly maxDelayTime = 1) {
    super('delay')
  }
}

class RenderCompressor extends FakeNode {
  readonly threshold = new PlaybackParam(-24)
  readonly knee = new PlaybackParam(30)
  readonly ratio = new PlaybackParam(12)
  readonly attack = new PlaybackParam(0.003)
  readonly release = new PlaybackParam(0.25)
  readonly reduction = 0
  constructor() {
    super('compressor')
  }
}

/** An oscillator or a buffer source: when it was told to start and to stop. */
export class RenderSource extends FakeNode {
  type: OscillatorType = 'sine'
  buffer: { readonly duration: number } | null = null
  loop = false
  readonly frequency = new PlaybackParam(440)
  readonly detune = new PlaybackParam(0)
  readonly playbackRate = new PlaybackParam(1)
  onended: (() => void) | null = null
  startedAt: number | null = null
  readonly stopTimes: number[] = []
  marked = false
  ended = false
  private readonly endedListeners: (() => void)[] = []

  start(when = 0): void {
    this.startedAt = when
  }

  stop(when = 0): void {
    this.stopTimes.push(when)
  }

  addEventListener(type: string, listener: () => void): void {
    if (type === 'ended') this.endedListeners.push(listener)
  }

  removeEventListener(): void {}

  setPeriodicWave(): void {}

  /** When it falls silent: its last stop, or the end of its buffer, whichever is first. */
  get endsAt(): number {
    const stop = this.stopTimes.at(-1) ?? Number.POSITIVE_INFINITY
    const natural =
      this.buffer === null || this.loop || this.startedAt === null
        ? Number.POSITIVE_INFINITY
        : this.startedAt + this.buffer.duration / this.playbackRate.value
    return Math.min(stop, natural)
  }

  end(): void {
    this.ended = true
    this.onended?.()
    for (const listener of this.endedListeners) listener()
  }
}

export class RenderClock {
  readonly destination = new FakeNode('destination')
  readonly sources: RenderSource[] = []
  readonly gains: RenderGain[] = []
  readonly sampleRate: number
  readonly length: number
  readonly numberOfChannels: number
  currentTime = 0
  state: AudioContextState = 'suspended'
  /** Every suspend the render was asked for, in the order asked. */
  readonly suspends: number[] = []
  /** What the last render made, kept for a render whose promise was refused. */
  output: RenderBuffer | null = null
  private readonly pending: { at: number; reached: () => void }[] = []
  private resumed: (() => void) | null = null

  constructor(options: OfflineAudioContextOptions) {
    this.sampleRate = options.sampleRate
    this.length = options.length
    this.numberOfChannels = options.numberOfChannels ?? 1
  }

  createGain(): RenderGain {
    const gain = new RenderGain()
    this.gains.push(gain)
    return gain
  }

  createBiquadFilter(): RenderFilter {
    return new RenderFilter()
  }

  createDelay(maxDelayTime?: number): RenderDelay {
    return new RenderDelay(maxDelayTime)
  }

  createDynamicsCompressor(): RenderCompressor {
    return new RenderCompressor()
  }

  createOscillator(): RenderSource {
    const source = new RenderSource('oscillator')
    this.sources.push(source)
    return source
  }

  createBufferSource(): RenderSource {
    const source = new RenderSource('buffer-source')
    this.sources.push(source)
    return source
  }

  createBuffer(channels: number, length: number, rate: number): RenderBuffer {
    return new RenderBuffer(channels, length, rate)
  }

  /** A two-second stereo sample, whatever the bytes. */
  decodeAudioData(_encoded: ArrayBuffer): Promise<RenderBuffer> {
    return Promise.resolve(
      new RenderBuffer(2, this.sampleRate * 2, this.sampleRate),
    )
  }

  suspend(at: number): Promise<void> {
    this.suspends.push(at)
    return new Promise((reached) => this.pending.push({ at, reached }))
  }

  resume(): Promise<void> {
    if (this.resumed === null)
      return Promise.reject(
        new DOMException(
          'cannot resume an offline context that has not started',
          'InvalidStateError',
        ),
      )
    this.resumed()
    this.resumed = null
    return Promise.resolve()
  }

  async startRendering(): Promise<RenderBuffer> {
    const output = new RenderBuffer(
      this.numberOfChannels,
      this.length,
      this.sampleRate,
    )
    this.output = output
    this.state = 'running'
    for (const step of [...this.pending].sort((a, b) => a.at - b.at)) {
      this.advanceTo(step.at, output)
      this.state = 'suspended'
      const resumed = new Promise<void>((resolve) => {
        this.resumed = resolve
      })
      step.reached()
      await resumed
      this.state = 'running'
    }
    this.advanceTo(this.length / this.sampleRate, output)
    this.state = 'closed'
    return output
  }

  /** The sources started, in the order they were made, each with its start frame. */
  startFrames(kind: 'oscillator' | 'buffer-source'): number[] {
    return this.sources
      .filter((source) => source.nodeType === kind && source.startedAt !== null)
      .map((source) => (source.startedAt as number) * this.sampleRate)
  }

  /** The clock, typed as what the code under test expects. */
  get asContext(): OfflineAudioContext {
    return this as unknown as OfflineAudioContext
  }

  private advanceTo(time: number, output: FakeBuffer): void {
    this.currentTime = time
    const marks = output.getChannelData(0)
    for (const source of this.sources) {
      const at = source.startedAt
      if (source.marked || at === null || at >= time) continue
      source.marked = true
      const frame = Math.round(at * this.sampleRate)
      if (
        source.endsAt > at &&
        frame < this.length &&
        reaches(source, this.destination)
      )
        marks[frame] += 1
    }
    for (const source of this.sources)
      if (!source.ended && source.endsAt <= time) source.end()
  }
}

/** A factory handing out fresh clocks, each kept for the test to read. */
export function renderClocks() {
  const made: RenderClock[] = []
  return {
    made,
    create: (options: OfflineAudioContextOptions): OfflineAudioContext => {
      const clock = new RenderClock(options)
      made.push(clock)
      return clock.asContext
    },
  }
}
