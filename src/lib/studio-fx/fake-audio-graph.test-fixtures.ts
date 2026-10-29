// ============================================================
// Fake audio graph — records connections and automation for Studio FX tests
// ============================================================
//
// Just enough of BaseAudioContext for the Studio FX graphs to build: nodes
// remember where they are connected, params remember every automation call.
// It does not process audio; the DSP itself is checked in a real browser.

export interface ParamEvent {
  readonly kind: 'set' | 'target' | 'cancel' | 'hold'
  readonly time: number
  readonly value?: number
  readonly timeConstant?: number
}

interface Connection {
  readonly node: FakeNode
  readonly output: number
  readonly input: number
}

export class FakeNode {
  connections: Connection[] = []
  disconnectAllCount = 0
  channelCount = 2
  channelCountMode: ChannelCountMode = 'max'
  channelInterpretation: ChannelInterpretation = 'speakers'

  constructor(readonly nodeType: string) {}

  connect(node: FakeNode, output = 0, input = 0): FakeNode {
    this.connections.push({ node, output, input })
    return node
  }

  disconnect(node?: FakeNode): void {
    if (node === undefined) {
      this.connections = []
      this.disconnectAllCount += 1
      return
    }
    const before = this.connections.length
    this.connections = this.connections.filter((c) => c.node !== node)
    if (this.connections.length === before) {
      throw new Error('InvalidAccessError: not connected to that node')
    }
  }

  get targets(): FakeNode[] {
    return this.connections.map((c) => c.node)
  }
}

/** An AudioParam; a node subclass so that `node.connect(param)` is recorded. */
export class FakeParam extends FakeNode {
  value: number
  readonly events: ParamEvent[] = []

  constructor(value = 0) {
    super('param')
    this.value = value
  }

  setValueAtTime(value: number, time: number): this {
    this.events.push({ kind: 'set', time, value })
    this.value = value
    return this
  }

  setTargetAtTime(value: number, time: number, timeConstant: number): this {
    this.events.push({ kind: 'target', time, value, timeConstant })
    return this
  }

  cancelScheduledValues(time: number): this {
    this.events.push({ kind: 'cancel', time })
    return this
  }

  cancelAndHoldAtTime(time: number): this {
    this.events.push({ kind: 'hold', time })
    return this
  }

  /** The last value written, whether set outright or glided towards. */
  get destination(): number {
    return this.lastWrite?.value ?? this.value
  }

  get lastWrite(): ParamEvent | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (this.events[i].value !== undefined) return this.events[i]
    }
    return undefined
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1)

  constructor() {
    super('gain')
  }
}

export class FakeBiquad extends FakeNode {
  type: BiquadFilterType = 'lowpass'
  readonly frequency = new FakeParam(350)
  readonly Q = new FakeParam(1)
  readonly gain = new FakeParam(0)

  constructor() {
    super('biquad')
  }
}

export class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam(-24)
  readonly knee = new FakeParam(30)
  readonly ratio = new FakeParam(12)
  readonly attack = new FakeParam(0.003)
  readonly release = new FakeParam(0.25)
  reduction = -3

  constructor() {
    super('compressor')
  }
}

export class FakeShaper extends FakeNode {
  curve: Float32Array | null = null
  oversample: OverSampleType = 'none'

  constructor() {
    super('shaper')
  }
}

export class FakeDelay extends FakeNode {
  readonly delayTime = new FakeParam(0)

  constructor(readonly maxDelayTime: number) {
    super('delay')
  }
}

export class FakeIir extends FakeNode {
  constructor(
    readonly feedforward: readonly number[],
    readonly feedback: readonly number[],
  ) {
    super('iir')
  }
}

export class FakeBuffer {
  readonly channels: Float32Array[]

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.channels = Array.from(
      { length: numberOfChannels },
      () => new Float32Array(length),
    )
  }

  copyToChannel(source: Float32Array, channel: number): void {
    this.channels[channel].set(source)
  }

  getChannelData(channel: number): Float32Array {
    return this.channels[channel]
  }
}

export class FakeConvolver extends FakeNode {
  normalize = true
  /** Every buffer ever assigned, in order. */
  readonly loads: (FakeBuffer | null)[] = []
  private current: FakeBuffer | null = null

  constructor() {
    super('convolver')
  }

  get buffer(): FakeBuffer | null {
    return this.current
  }

  set buffer(value: FakeBuffer | null) {
    this.loads.push(value)
    this.current = value
  }
}

export class FakeAudioContext {
  currentTime = 0
  state: AudioContextState = 'running'
  readonly destination = new FakeNode('destination')
  readonly created: FakeNode[] = []

  constructor(readonly sampleRate = 48000) {}

  private track<T extends FakeNode>(node: T): T {
    this.created.push(node)
    return node
  }

  createGain(): FakeGain {
    return this.track(new FakeGain())
  }

  createBiquadFilter(): FakeBiquad {
    return this.track(new FakeBiquad())
  }

  createDynamicsCompressor(): FakeCompressor {
    return this.track(new FakeCompressor())
  }

  createWaveShaper(): FakeShaper {
    return this.track(new FakeShaper())
  }

  createDelay(maxDelayTime = 1): FakeDelay {
    return this.track(new FakeDelay(maxDelayTime))
  }

  createConvolver(): FakeConvolver {
    return this.track(new FakeConvolver())
  }

  createChannelMerger(): FakeNode {
    return this.track(new FakeNode('merger'))
  }

  createChannelSplitter(): FakeNode {
    return this.track(new FakeNode('splitter'))
  }

  createIIRFilter(feedforward: number[], feedback: number[]): FakeIir {
    return this.track(new FakeIir(feedforward, feedback))
  }

  createBuffer(
    channels: number,
    length: number,
    sampleRate: number,
  ): FakeBuffer {
    return new FakeBuffer(channels, length, sampleRate)
  }

  /** The fake, typed as what the code under test expects. */
  get asContext(): BaseAudioContext {
    return this as unknown as BaseAudioContext
  }

  ofType<T extends FakeNode>(nodeType: string): T[] {
    return this.created.filter((node) => node.nodeType === nodeType) as T[]
  }
}

/** An OfflineAudioContext stand-in: the code tells them apart by this method. */
export class FakeOfflineAudioContext extends FakeAudioContext {
  constructor(sampleRate = 48000) {
    super(sampleRate)
    this.state = 'suspended'
  }

  startRendering(): Promise<FakeBuffer> {
    return Promise.resolve(new FakeBuffer(2, 1, this.sampleRate))
  }
}

/**
 * An offline-context factory whose render answers an impulse with `response`
 * starting `delay` frames after it: how a compressor lookahead is measured.
 */
export function fakeImpulseRenderContext(
  delay: number,
  response: readonly number[] = [0.99998],
) {
  return (options: OfflineAudioContextOptions): OfflineAudioContext => {
    const ctx = new FakeOfflineAudioContext(options.sampleRate)
    let impulseAt = -1
    const source = Object.assign(new FakeNode('source'), {
      buffer: null as FakeBuffer | null,
      start: () => {
        impulseAt = source.buffer?.getChannelData(0).indexOf(1) ?? -1
      },
    })
    return Object.assign(ctx, {
      createBufferSource: () => source,
      startRendering: () => {
        const out = new FakeBuffer(1, options.length, options.sampleRate)
        response.forEach((value, i) => {
          out.getChannelData(0)[impulseAt + delay + i] = value
        })
        return Promise.resolve(out)
      },
    }) as unknown as OfflineAudioContext
  }
}

/** True when audio entering `from` can reach `to` along connections. */
export function reaches(from: FakeNode, to: FakeNode): boolean {
  const seen = new Set<FakeNode>()
  const stack = [from]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node === to) return true
    if (seen.has(node)) continue
    seen.add(node)
    stack.push(...node.targets)
  }
  return false
}

/** A scheduler the test advances by hand. */
export function createManualScheduler() {
  let pending: { at: number; callback: () => void; cancelled: boolean }[] = []
  let now = 0
  return {
    schedule(callback: () => void, delayMs: number): () => void {
      const job = { at: now + delayMs, callback, cancelled: false }
      pending.push(job)
      return () => {
        job.cancelled = true
      }
    },
    /** Run every job due within `ms` from now, in time order. */
    advance(ms: number): void {
      const until = now + ms
      for (;;) {
        const due = pending
          .filter((job) => !job.cancelled && job.at <= until)
          .sort((a, b) => a.at - b.at)[0]
        if (due === undefined) break
        pending = pending.filter((job) => job !== due)
        now = due.at
        due.callback()
      }
      now = until
    },
    get pendingCount(): number {
      return pending.filter((job) => !job.cancelled).length
    },
  }
}
