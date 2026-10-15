// ============================================================
// A Web Audio graph and a microphone for tests, that keep score
// ============================================================
//
// jsdom has no Web Audio and no getUserMedia. The premium rooms' audio
// suites need both, and need to ask questions a stub cannot answer: is any
// microphone track still live, how loud does a note reach the speakers, is
// any gain left turned down, how many contexts were made and what state is
// each in. So this keeps the graph: every node, what it is connected to,
// every automation on every gain, the audio clock, and every track handed
// out with the constraints it was asked for.
//
// The clock only moves when a test moves it, and only while the context is
// running, as a real one does: a suspended context holds its notes armed.
// A source that reaches its stop time ends then, and its `onended` runs.
// A gain's value is computed from its automation at the clock, the way the
// browser does: set, linear and exponential ramps, and setTargetAtTime.

type ParamEvent =
  | { kind: 'set'; time: number; value: number }
  | { kind: 'linear'; time: number; value: number }
  | { kind: 'exp'; time: number; value: number }
  | { kind: 'target'; time: number; value: number; tau: number }

/** An AudioParam that remembers its automation and evaluates it. */
export class FakeParam {
  private events: ParamEvent[] = []
  private base: number

  constructor(
    private readonly ctx: FakeAudioContext,
    value: number,
    readonly name: string,
  ) {
    this.base = value
  }

  get value(): number {
    return this.valueAt(this.ctx.currentTime)
  }

  set value(next: number) {
    if (this.events.length === 0) this.base = next
    else this.setValueAtTime(next, this.ctx.currentTime)
  }

  private add(event: ParamEvent): this {
    // Stable by time: a later call at the same time comes after.
    let at = this.events.length
    while (at > 0 && this.events[at - 1].time > event.time) at -= 1
    this.events.splice(at, 0, event)
    return this
  }

  setValueAtTime(value: number, time: number): this {
    return this.add({ kind: 'set', time, value })
  }

  linearRampToValueAtTime(value: number, time: number): this {
    return this.add({ kind: 'linear', time, value })
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    return this.add({ kind: 'exp', time, value })
  }

  setTargetAtTime(value: number, time: number, tau: number): this {
    return this.add({ kind: 'target', time, value, tau })
  }

  cancelScheduledValues(time: number): this {
    this.events = this.events.filter((event) => event.time < time)
    return this
  }

  cancelAndHoldAtTime(time: number): this {
    const held = this.valueAt(time)
    this.cancelScheduledValues(time)
    return this.setValueAtTime(held, time)
  }

  /** The value at `time` on the context's clock. */
  valueAt(time: number): number {
    let value = this.base
    let from = 0
    let target: {
      value: number
      tau: number
      time: number
      start: number
    } | null = null
    const following = (t: number): number =>
      target === null
        ? value
        : target.value +
          (target.start - target.value) *
            Math.exp(-(t - target.time) / Math.max(1e-9, target.tau))
    for (const event of this.events) {
      if (event.time > time) {
        const start = following(from)
        if (event.kind === 'linear') {
          const span = event.time - from
          if (span <= 0) return event.value
          return start + ((event.value - start) * (time - from)) / span
        }
        if (event.kind === 'exp') {
          const span = event.time - from
          if (span <= 0 || start <= 0 || event.value <= 0) return start
          return start * (event.value / start) ** ((time - from) / span)
        }
        return following(time)
      }
      if (event.kind === 'target') {
        const start = following(event.time)
        target = { value: event.value, tau: event.tau, time: event.time, start }
      } else {
        value = event.value
        target = null
      }
      from = event.time
    }
    return following(time)
  }
}

let nextNodeId = 1

/** Any node: what it is, and where its output goes. */
export class FakeNode {
  readonly id = nextNodeId++
  readonly outputs = new Set<FakeNode>()
  readonly paramOutputs = new Set<FakeParam>()

  constructor(
    readonly context: FakeAudioContext,
    readonly kind: string,
  ) {
    context.nodes.push(this)
  }

  connect<T extends FakeNode | FakeParam>(destination: T): T {
    if (destination instanceof FakeParam) this.paramOutputs.add(destination)
    else this.outputs.add(destination)
    return destination
  }

  disconnect(destination?: FakeNode | FakeParam): void {
    if (destination === undefined) {
      this.outputs.clear()
      this.paramOutputs.clear()
    } else if (destination instanceof FakeParam) {
      this.paramOutputs.delete(destination)
    } else {
      this.outputs.delete(destination)
    }
  }
}

export class FakeGainNode extends FakeNode {
  readonly gain: FakeParam
  constructor(context: FakeAudioContext) {
    super(context, 'gain')
    this.gain = new FakeParam(context, 1, 'gain')
  }
}

/** An oscillator or a buffer source: started, stopped, ended. */
export class FakeSourceNode extends FakeNode {
  readonly frequency: FakeParam
  readonly detune: FakeParam
  readonly playbackRate: FakeParam
  type = 'sine'
  buffer: unknown = null
  startAt: number | null = null
  stopAt: number | null = null
  ended = false
  onended: ((event: Event) => void) | null = null

  constructor(context: FakeAudioContext, kind: 'oscillator' | 'buffer') {
    super(context, kind)
    this.frequency = new FakeParam(context, 440, 'frequency')
    this.detune = new FakeParam(context, 0, 'detune')
    this.playbackRate = new FakeParam(context, 1, 'playbackRate')
  }

  setPeriodicWave(): void {}

  start(when = 0): void {
    if (this.startAt !== null) throw new Error('start called twice')
    this.startAt = when
  }

  stop(when = 0): void {
    if (this.startAt === null) throw new Error('stop before start')
    this.stopAt = when
    this.context.endDue()
  }

  /** Sounding at `time`: started, not stopped yet, not ended. */
  soundingAt(time: number): boolean {
    if (this.ended || this.startAt === null || time < this.startAt) return false
    return this.stopAt === null || time < this.stopAt
  }
}

export class FakeAnalyserNode extends FakeNode {
  fftSize = 2048
  constructor(context: FakeAudioContext) {
    super(context, 'analyser')
  }
  getFloatTimeDomainData(buffer: Float32Array): void {
    buffer.fill(0)
  }
  getByteTimeDomainData(buffer: Uint8Array): void {
    buffer.fill(128)
  }
}

export class FakeFilterNode extends FakeNode {
  type = 'lowpass'
  readonly frequency: FakeParam
  readonly Q: FakeParam
  readonly gain: FakeParam
  constructor(context: FakeAudioContext) {
    super(context, 'filter')
    this.frequency = new FakeParam(context, 350, 'frequency')
    this.Q = new FakeParam(context, 1, 'Q')
    this.gain = new FakeParam(context, 0, 'gain')
  }
}

export class FakeCompressorNode extends FakeNode {
  readonly threshold: FakeParam
  readonly knee: FakeParam
  readonly ratio: FakeParam
  readonly attack: FakeParam
  readonly release: FakeParam
  readonly reduction = 0
  constructor(context: FakeAudioContext) {
    super(context, 'compressor')
    this.threshold = new FakeParam(context, -24, 'threshold')
    this.knee = new FakeParam(context, 30, 'knee')
    this.ratio = new FakeParam(context, 12, 'ratio')
    this.attack = new FakeParam(context, 0.003, 'attack')
    this.release = new FakeParam(context, 0.25, 'release')
  }
}

export class FakeStreamSourceNode extends FakeNode {
  constructor(
    context: FakeAudioContext,
    readonly mediaStream: MediaStream,
  ) {
    super(context, 'media-stream')
  }
}

type FakeState = 'running' | 'suspended' | 'closed'

/** An AudioContext with a clock the test moves. */
export class FakeAudioContext {
  static made: FakeAudioContext[] = []
  readonly nodes: FakeNode[] = []
  readonly destination: FakeNode
  readonly sampleRate = 48_000
  readonly baseLatency = 0
  readonly outputLatency = 0
  currentTime = 0
  state: FakeState = 'suspended'
  onstatechange: (() => void) | null = null
  private readonly listeners = new Set<() => void>()

  constructor() {
    this.destination = new FakeNode(this, 'destination')
    FakeAudioContext.made.push(this)
  }

  private setState(next: FakeState): void {
    if (this.state === next) return
    this.state = next
    this.onstatechange?.()
    for (const listener of this.listeners) listener()
  }

  addEventListener(type: string, listener: () => void): void {
    if (type === 'statechange') this.listeners.add(listener)
  }

  removeEventListener(type: string, listener: () => void): void {
    if (type === 'statechange') this.listeners.delete(listener)
  }

  resume(): Promise<void> {
    if (this.state === 'closed') return Promise.reject(new Error('closed'))
    this.setState('running')
    return Promise.resolve()
  }

  suspend(): Promise<void> {
    if (this.state !== 'closed') this.setState('suspended')
    return Promise.resolve()
  }

  close(): Promise<void> {
    this.setState('closed')
    return Promise.resolve()
  }

  createGain(): FakeGainNode {
    return new FakeGainNode(this)
  }

  createOscillator(): FakeSourceNode {
    return new FakeSourceNode(this, 'oscillator')
  }

  createBufferSource(): FakeSourceNode {
    return new FakeSourceNode(this, 'buffer')
  }

  createBiquadFilter(): FakeFilterNode {
    return new FakeFilterNode(this)
  }

  createDynamicsCompressor(): FakeCompressorNode {
    return new FakeCompressorNode(this)
  }

  createAnalyser(): FakeAnalyserNode {
    return new FakeAnalyserNode(this)
  }

  createMediaStreamSource(stream: MediaStream): FakeStreamSourceNode {
    return new FakeStreamSourceNode(this, stream)
  }

  createPeriodicWave(): object {
    return {}
  }

  /** Move the clock on by `seconds`, if it runs; end what is due. */
  advance(seconds: number): void {
    if (this.state !== 'running') return
    this.currentTime += seconds
    this.endDue()
  }

  /** End every source whose stop time the clock has reached. */
  endDue(): void {
    for (const node of this.nodes) {
      if (!(node instanceof FakeSourceNode) || node.ended) continue
      if (node.stopAt === null || node.stopAt > this.currentTime) continue
      node.ended = true
      node.onended?.(new Event('ended'))
    }
  }

  /** Sources that sound now. */
  sounding(): FakeSourceNode[] {
    return this.nodes.filter(
      (node): node is FakeSourceNode =>
        node instanceof FakeSourceNode && node.soundingAt(this.currentTime),
    )
  }

  /** Every gain on a path from a sound to the speakers. */
  gainsToDestination(): FakeGainNode[] {
    return this.nodes.filter(
      (node): node is FakeGainNode =>
        node instanceof FakeGainNode && this.reaches(node),
    )
  }

  /** Whether `node`'s output reaches the speakers. */
  reaches(node: FakeNode, seen = new Set<FakeNode>()): boolean {
    if (node === this.destination) return true
    if (seen.has(node)) return false
    seen.add(node)
    for (const next of node.outputs) if (this.reaches(next, seen)) return true
    return false
  }

  /**
   * How much of `node`'s output reaches the speakers at `time`: the gains on
   * its loudest path multiplied. Filters and compressors count as 1.
   */
  gainToDestination(
    node: FakeNode,
    time: number,
    seen = new Set<FakeNode>(),
  ): number {
    if (node === this.destination) return 1
    if (seen.has(node)) return 0
    const own =
      node instanceof FakeGainNode ? Math.abs(node.gain.valueAt(time)) : 1
    let best = 0
    for (const next of node.outputs) {
      best = Math.max(
        best,
        this.gainToDestination(next, time, new Set([...seen, node])),
      )
    }
    return own * best
  }
}

/** A microphone track the test can see the state of. */
export class FakeTrack {
  readonly kind = 'audio'
  readyState: 'live' | 'ended' = 'live'
  readonly label = 'Fake microphone'
  constructor(readonly constraints: MediaStreamConstraints) {}
  stop(): void {
    this.readyState = 'ended'
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  getSettings(): MediaTrackSettings {
    const audio = this.constraints.audio
    const asked = typeof audio === 'object' ? audio : {}
    return {
      deviceId: 'fake-mic',
      echoCancellation: asked.echoCancellation === true,
      noiseSuppression: asked.noiseSuppression === true,
      autoGainControl: asked.autoGainControl === true,
    }
  }
}

export interface FakeMedia {
  /** Every track handed out, in order. */
  readonly tracks: FakeTrack[]
  /** The constraints of every getUserMedia call, in order. */
  readonly asked: MediaStreamConstraints[]
  live: () => number
}

/** navigator.mediaDevices with a getUserMedia that keeps score. */
export function installFakeMedia(): FakeMedia {
  const tracks: FakeTrack[] = []
  const asked: MediaStreamConstraints[] = []
  const getUserMedia = (constraints: MediaStreamConstraints) => {
    asked.push(constraints)
    const track = new FakeTrack(constraints)
    tracks.push(track)
    const stream = {
      id: `stream-${String(tracks.length)}`,
      getTracks: () => [track],
      getAudioTracks: () => [track],
      getVideoTracks: () => [],
    }
    return Promise.resolve(stream as unknown as MediaStream)
  }
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia,
      enumerateDevices: () => Promise.resolve([]),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
  })
  return {
    tracks,
    asked,
    live: () => tracks.filter((track) => track.readyState === 'live').length,
  }
}
