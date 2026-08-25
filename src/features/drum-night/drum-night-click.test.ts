// ============================================================
// Drum Night click tests — one transport window, no hidden clock
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { createDrumNightClickController } from './drum-night-click'
import type { DrumRuntimeClock } from './runtime/drum-transport'
import { createDrumTransport } from './runtime/drum-transport'

interface ParameterEvent {
  readonly kind: 'cancel' | 'exponential' | 'hold' | 'linear' | 'set' | 'target'
  readonly value?: number
  readonly at: number
  readonly timeConstant?: number
}

class FakeAudioParam {
  value: number
  readonly events: ParameterEvent[] = []

  constructor(value = 0) {
    this.value = value
  }

  cancelScheduledValues(at: number): void {
    this.events.push({ kind: 'cancel', at })
  }

  cancelAndHoldAtTime(at: number): void {
    this.events.push({ kind: 'hold', at })
  }

  setValueAtTime(value: number, at: number): this {
    this.value = value
    this.events.push({ kind: 'set', value, at })
    return this
  }

  linearRampToValueAtTime(value: number, at: number): this {
    this.value = value
    this.events.push({ kind: 'linear', value, at })
    return this
  }

  exponentialRampToValueAtTime(value: number, at: number): this {
    this.value = value
    this.events.push({ kind: 'exponential', value, at })
    return this
  }

  setTargetAtTime(value: number, at: number, timeConstant: number): this {
    this.value = value
    this.events.push({ kind: 'target', value, at, timeConstant })
    return this
  }
}

class FakeAudioNode {
  readonly connect = vi.fn((destination: unknown) => destination)
  readonly disconnect = vi.fn()
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam(1)
}

class FakeOscillatorNode extends FakeAudioNode {
  type: OscillatorType = 'sine'
  readonly frequency = new FakeAudioParam()
  readonly starts: number[] = []
  readonly stops: number[] = []
  onended: (() => void) | null = null

  start(at = 0): void {
    this.starts.push(at)
  }

  stop(at = 0): void {
    this.stops.push(at)
  }

  finish(): void {
    this.onended?.()
  }
}

class FakeAudioContext {
  currentTime = 10
  state: AudioContextState = 'running'
  readonly gains: FakeGainNode[] = []
  readonly oscillators: FakeOscillatorNode[] = []
  readonly resume = vi.fn(async () => undefined)

  createGain(): GainNode {
    const gain = new FakeGainNode()
    this.gains.push(gain)
    return gain as unknown as GainNode
  }

  createOscillator(): OscillatorNode {
    const oscillator = new FakeOscillatorNode()
    this.oscillators.push(oscillator)
    return oscillator as unknown as OscillatorNode
  }
}

class FakeClock implements DrumRuntimeClock {
  private timestampMs = 0
  private nextFrameId = 1
  private frames = new Map<number, (timestampMs: number) => void>()

  nowMs = (): number => this.timestampMs

  requestFrame = (callback: (timestampMs: number) => void): number => {
    const id = this.nextFrameId++
    this.frames.set(id, callback)
    return id
  }

  cancelFrame = (handle: number): void => {
    this.frames.delete(handle)
  }

  advance(milliseconds: number): void {
    this.timestampMs += milliseconds
    const pending = [...this.frames.values()]
    this.frames.clear()
    for (const callback of pending) callback(this.timestampMs)
  }

  pendingFrames(): number {
    return this.frames.size
  }
}

function clickHarness(
  options: {
    readonly countInBeats?: number
    readonly lookaheadMs?: number
    readonly ready?: boolean
    readonly tempoBpm?: number
  } = {},
) {
  const clock = new FakeClock()
  const context = new FakeAudioContext()
  const output = new FakeAudioNode()
  let ready = options.ready ?? true
  const transport = createDrumTransport({
    clock,
    countInBeats: options.countInBeats ?? 0,
    tempoBpm: options.tempoBpm ?? 120,
  })
  const activeContext = vi.fn(() =>
    ready ? (context as unknown as AudioContext) : null,
  )
  const activeOutput = vi.fn(() =>
    ready ? (output as unknown as AudioNode) : null,
  )
  const performanceTimestampToContextTime = vi.fn((timestampMs: number) =>
    ready ? context.currentTime + (timestampMs - clock.nowMs()) / 1_000 : null,
  )
  const click = createDrumNightClickController({
    transport,
    activeContext,
    activeOutput,
    performanceTimestampToContextTime,
    timeSignatures: () => [{ beat: 0, numerator: 4, denominator: 4 }],
    lookaheadMs: options.lookaheadMs,
  })

  return {
    activeContext,
    activeOutput,
    advance(milliseconds: number) {
      context.currentTime += milliseconds / 1_000
      clock.advance(milliseconds)
    },
    click,
    clock,
    context,
    output,
    performanceTimestampToContextTime,
    setReady(nextReady: boolean) {
      ready = nextReady
    },
    transport,
  }
}

describe('Drum Night click controller', () => {
  it('is off and entirely silent on construction', () => {
    const room = clickHarness()

    expect(room.click.snapshot()).toEqual({
      status: 'disabled',
      enabled: false,
      level: 0.5,
      transportRevision: 0,
      scheduledClickCount: 0,
      lateOmittedClickCount: 0,
      dedupeLedgerSize: 0,
      activeVoiceCount: 0,
      lastClick: null,
      error: null,
    })
    expect(room.activeContext).not.toHaveBeenCalled()
    expect(room.activeOutput).not.toHaveBeenCalled()
    expect(room.performanceTimestampToContextTime).not.toHaveBeenCalled()
    expect(room.context.gains).toHaveLength(0)
    expect(room.context.oscillators).toHaveLength(0)
    expect(room.clock.pendingFrames()).toBe(0)

    room.transport.start()
    expect(room.clock.pendingFrames()).toBe(1)
    expect(room.activeContext).not.toHaveBeenCalled()
    expect(room.context.oscillators).toHaveLength(0)
    expect(room.context.resume).not.toHaveBeenCalled()

    room.click.dispose()
    room.transport.dispose()
  })

  it('waits truthfully when enabled before gesture-owned audio exists', () => {
    const room = clickHarness({ ready: false })

    room.click.enable(true)
    expect(room.click.snapshot()).toMatchObject({
      status: 'waiting-for-audio',
      enabled: true,
      scheduledClickCount: 0,
    })
    expect(room.activeContext).toHaveBeenCalledOnce()
    expect(room.activeOutput).not.toHaveBeenCalled()
    expect(room.context.gains).toHaveLength(0)

    room.setReady(true)
    room.transport.start()
    expect(room.click.snapshot()).toMatchObject({
      status: 'playing',
      scheduledClickCount: 1,
    })
    expect(room.context.oscillators).toHaveLength(1)
    expect(room.context.resume).not.toHaveBeenCalled()

    room.click.dispose()
    room.transport.dispose()
  })

  it('schedules count-in and authored quarter clicks with distinct downbeats', () => {
    const room = clickHarness({ countInBeats: 2, lookaheadMs: 600 })

    room.click.enable(true)
    expect(room.click.snapshot().status).toBe('ready')
    expect(room.context.gains).toHaveLength(0)
    room.transport.start()

    expect(room.click.snapshot()).toMatchObject({
      status: 'count-in',
      scheduledClickCount: 2,
      dedupeLedgerSize: 2,
      activeVoiceCount: 2,
    })
    expect(room.context.oscillators.map((voice) => voice.starts[0])).toEqual([
      10, 10.5,
    ])
    expect(
      room.context.oscillators.map((voice) => voice.frequency.value),
    ).toEqual([1_320, 860])

    room.advance(100)
    expect(room.context.oscillators).toHaveLength(2)
    room.advance(400)
    expect(room.context.oscillators.map((voice) => voice.starts[0])).toEqual([
      10, 10.5, 11,
    ])
    room.advance(500)
    expect(room.context.oscillators.map((voice) => voice.starts[0])).toEqual([
      10, 10.5, 11, 11.5,
    ])
    expect(room.click.snapshot().lastClick).toMatchObject({
      kind: 'playback',
      accent: false,
      authoredBeat: 1,
      timelineBeat: 1,
      atContextTime: 11.5,
    })
    expect(
      room.context.gains
        .flatMap((gain) => gain.gain.events)
        .filter((event) => event.kind === 'target'),
    ).toHaveLength(4)
    expect(room.context.oscillators).toHaveLength(4)
    expect(room.click.snapshot().scheduledClickCount).toBe(4)

    room.click.dispose()
    room.transport.dispose()
  })

  it('sounds the enabled count-in without enabling the playback click', () => {
    const room = clickHarness({ countInBeats: 2, lookaheadMs: 600 })

    room.transport.start()

    expect(room.click.snapshot()).toMatchObject({
      status: 'count-in',
      enabled: false,
      scheduledClickCount: 2,
    })
    expect(room.context.oscillators.map((voice) => voice.starts[0])).toEqual([
      10, 10.5,
    ])
    expect(
      room.context.oscillators.map((voice) => voice.frequency.value),
    ).toEqual([1_320, 860])

    room.advance(1_000)

    expect(room.click.snapshot()).toMatchObject({
      status: 'disabled',
      enabled: false,
    })
    expect(room.context.oscillators).toHaveLength(2)

    room.click.dispose()
    room.transport.dispose()
  })

  it('places quarter clicks across authored tempo-map windows', () => {
    const room = clickHarness({ lookaheadMs: 2_000 })
    room.transport.setAuthoredTiming({
      tempoBpm: 120,
      tempoChanges: [
        { beat: 0, usPerBeat: 500_000 },
        { beat: 1, usPerBeat: 1_000_000 },
      ],
      durationBeats: 4,
    })
    room.click.enable(true)
    room.transport.start()

    expect(room.context.oscillators.map((voice) => voice.starts[0])).toEqual([
      10, 10.5, 11.5,
    ])
    expect(room.click.snapshot()).toMatchObject({
      status: 'playing',
      scheduledClickCount: 3,
    })

    room.click.dispose()
    room.transport.dispose()
  })

  it('dedupes overlapping windows and preserves each loop occurrence once', () => {
    const room = clickHarness({ lookaheadMs: 600 })
    room.click.enable(true)
    expect(room.transport.setLoop({ startBeat: 0, endBeat: 1 })).toBe(true)
    room.transport.start()

    expect(room.context.oscillators.map((voice) => voice.starts[0])).toEqual([
      10, 10.5,
    ])
    room.advance(0)
    expect(room.context.oscillators).toHaveLength(2)

    room.advance(500)
    expect(room.context.oscillators.map((voice) => voice.starts[0])).toEqual([
      10, 10.5, 11,
    ])
    expect(room.click.snapshot()).toMatchObject({
      status: 'playing',
      scheduledClickCount: 3,
      dedupeLedgerSize: 2,
    })
    expect(room.click.snapshot().lastClick).toMatchObject({
      accent: true,
      authoredBeat: 0,
      timelineBeat: 2,
    })

    room.click.dispose()
    room.transport.dispose()
  })

  it('releases queued clicks on pause and disable without a second timer', () => {
    const room = clickHarness({ lookaheadMs: 600 })
    room.click.enable(true)
    room.transport.start()
    const firstGraph = room.context.gains[0]!
    const currentVoice = room.context.oscillators[0]!
    const futureVoice = room.context.oscillators[1]!

    room.transport.pause()
    expect(room.click.snapshot()).toMatchObject({
      status: 'ready',
      scheduledClickCount: 0,
      dedupeLedgerSize: 0,
      activeVoiceCount: 0,
    })
    expect(currentVoice.stops.at(-1)).toBeCloseTo(10.035)
    expect(futureVoice.stops.at(-1)).toBe(10)
    expect(futureVoice.disconnect).toHaveBeenCalledOnce()
    expect(firstGraph.gain.events.at(-1)).toMatchObject({
      kind: 'target',
      value: 0,
    })
    currentVoice.finish()
    expect(firstGraph.disconnect).toHaveBeenCalledOnce()

    room.transport.start()
    const voiceCountBeforeDisable = room.context.oscillators.length
    room.click.enable(false)
    expect(room.click.snapshot()).toMatchObject({
      status: 'disabled',
      enabled: false,
      activeVoiceCount: 0,
    })
    room.advance(500)
    expect(room.context.oscillators).toHaveLength(voiceCountBeforeDisable)
    expect(room.context.resume).not.toHaveBeenCalled()

    room.click.dispose()
    room.transport.dispose()
  })

  it('disposes idempotently, disconnects its graph, and unsubscribes', () => {
    const room = clickHarness({ lookaheadMs: 600 })
    const listener = vi.fn()
    room.click.subscribe(listener)
    room.click.enable(true)
    room.transport.start()
    const scheduledBeforeDispose = room.context.oscillators.length

    room.click.dispose()
    room.click.dispose()
    expect(room.click.snapshot()).toMatchObject({
      status: 'disposed',
      enabled: false,
      scheduledClickCount: 0,
      dedupeLedgerSize: 0,
      activeVoiceCount: 0,
    })
    for (const oscillator of room.context.oscillators) oscillator.finish()
    expect(room.context.gains[0]?.disconnect).toHaveBeenCalledOnce()

    room.transport.stop()
    room.transport.start()
    room.advance(500)
    room.click.enable(true)
    room.click.setLevel(1)
    expect(room.context.oscillators).toHaveLength(scheduledBeforeDispose)
    expect(listener).toHaveBeenCalled()
    expect(room.context.resume).not.toHaveBeenCalled()

    room.transport.dispose()
  })
})
