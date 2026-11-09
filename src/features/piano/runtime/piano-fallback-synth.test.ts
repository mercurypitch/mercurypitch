// ============================================================
// Piano fallback synth tests — lazy graph, bounded voices, and cleanup
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { createPianoFallbackSynth, PIANO_FALLBACK_MAX_VOICES, } from './piano-fallback-synth'

interface ParamEvent {
  kind: 'cancel' | 'hold' | 'set' | 'target' | 'exponential'
  value?: number
  at: number
}

class FakeAudioParam {
  value = 1
  readonly events: ParamEvent[] = []

  setValueAtTime(value: number, at: number): this {
    this.value = value
    this.events.push({ kind: 'set', value, at })
    return this
  }

  setTargetAtTime(value: number, at: number): this {
    this.value = value
    this.events.push({ kind: 'target', value, at })
    return this
  }

  exponentialRampToValueAtTime(value: number, at: number): this {
    this.value = value
    this.events.push({ kind: 'exponential', value, at })
    return this
  }

  cancelScheduledValues(at: number): this {
    this.events.push({ kind: 'cancel', at })
    return this
  }

  cancelAndHoldAtTime(at: number): this {
    this.events.push({ kind: 'hold', at })
    return this
  }
}

class FakeAudioNode {
  readonly connect = vi.fn(() => this)
  readonly disconnect = vi.fn()
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam()
}

class FakeCompressorNode extends FakeAudioNode {
  readonly threshold = new FakeAudioParam()
  readonly knee = new FakeAudioParam()
  readonly ratio = new FakeAudioParam()
  readonly attack = new FakeAudioParam()
  readonly release = new FakeAudioParam()
}

class FakeOscillatorNode extends FakeAudioNode {
  type: OscillatorType = 'sine'
  readonly frequency = new FakeAudioParam()
  readonly detune = new FakeAudioParam()
  readonly starts: number[] = []
  readonly stops: number[] = []
  onended: (() => void) | null = null

  start(at = 0): void {
    this.starts.push(at)
  }

  stop(at = 0): void {
    this.stops.push(at)
  }
}

class FakeAudioContext {
  currentTime = 5
  state: AudioContextState = 'running'
  readonly destination = new FakeAudioNode()
  readonly gains: FakeGainNode[] = []
  readonly compressors: FakeCompressorNode[] = []
  readonly oscillators: FakeOscillatorNode[] = []

  createGain(): GainNode {
    const node = new FakeGainNode()
    this.gains.push(node)
    return node as unknown as GainNode
  }

  createDynamicsCompressor(): DynamicsCompressorNode {
    const node = new FakeCompressorNode()
    this.compressors.push(node)
    return node as unknown as DynamicsCompressorNode
  }

  createOscillator(): OscillatorNode {
    const node = new FakeOscillatorNode()
    this.oscillators.push(node)
    return node as unknown as OscillatorNode
  }
}

function harness(
  options: {
    maxVoices?: number
    context?: FakeAudioContext
    offline?: boolean
  } = {},
) {
  const context = options.context ?? new FakeAudioContext()
  const getAudioContext = vi.fn(() => context as unknown as AudioContext)
  const synth = createPianoFallbackSynth({
    getAudioContext,
    ...(options.maxVoices === undefined
      ? {}
      : { maxVoices: options.maxVoices }),
    ...(options.offline === undefined ? {} : { offline: options.offline }),
  })
  return { context, getAudioContext, synth }
}

/** `count` notes a quarter second apart from clock time 6, each held half a second, as a render schedules them before they sound. */
function scheduleAhead(
  synth: ReturnType<typeof createPianoFallbackSynth>,
  count: number,
): void {
  for (let index = 0; index < count; index += 1) {
    const at = 6 + index / 4
    synth.noteOn({
      id: `ahead:${index}`,
      midi: 48 + (index % 36),
      velocity: 0.7,
      atContextTime: at,
    })
    synth.noteOff({ id: `ahead:${index}`, atContextTime: at + 0.5 })
  }
}

/** Each note's fundamental: when it starts, and when its last stop says it ends. */
function noteSpans(context: FakeAudioContext) {
  return context.oscillators
    .filter((_, index) => index % 2 === 0)
    .map((oscillator) => ({
      start: oscillator.starts[0],
      end: oscillator.stops.at(-1) ?? Number.POSITIVE_INFINITY,
    }))
}

function strikePeak(gain: FakeGainNode): number {
  const event = gain.gain.events.find(
    (candidate) => candidate.kind === 'exponential',
  )
  if (event?.value === undefined) throw new Error('Missing strike envelope')
  return event.value
}

describe('createPianoFallbackSynth', () => {
  it('constructs silently and refuses notes until the transport owns a context', () => {
    const getAudioContext = vi.fn(() => null)
    const synth = createPianoFallbackSynth({ getAudioContext })

    expect(getAudioContext).not.toHaveBeenCalled()
    expect(synth.noteOn({ id: 'live:1', midi: 60, velocity: 0.8 })).toBe(false)
    expect(getAudioContext).toHaveBeenCalledOnce()
    expect(synth.activeVoiceIds()).toEqual([])
  })

  it("plays into the host's output node when it names one, and into the destination when it does not", () => {
    // Arrange
    const owned = new FakeAudioContext()
    const output = new FakeAudioNode()
    const routed = createPianoFallbackSynth({
      getAudioContext: () => owned as unknown as AudioContext,
      getOutput: () => output as unknown as AudioNode,
    })
    const { context, synth } = harness()

    // Act
    routed.noteOn({ id: 'routed', midi: 60, velocity: 0.8 })
    synth.noteOn({ id: 'plain', midi: 60, velocity: 0.8 })

    // Assert
    expect(owned.compressors[0].connect).toHaveBeenCalledExactlyOnceWith(output)
    expect(context.compressors[0].connect).toHaveBeenCalledExactlyOnceWith(
      context.destination,
    )
  })

  it('stages normalized master volume without constructing an audio graph', () => {
    const { context, getAudioContext, synth } = harness()

    synth.setVolume(0.4)

    expect(getAudioContext).not.toHaveBeenCalled()
    expect(context.gains).toHaveLength(0)
    expect(synth.noteOn({ id: 'quiet-master', midi: 60, velocity: 1 })).toBe(
      true,
    )
    expect(context.gains[0].gain.value).toBeCloseTo(0.72 * 0.4)

    synth.setVolume(5)
    expect(context.gains[0].gain.events.at(-1)).toMatchObject({
      kind: 'target',
      value: 0.72,
      at: 5,
    })
    synth.setVolume(-1)
    expect(context.gains[0].gain.events.at(-1)).toMatchObject({
      kind: 'target',
      value: 0,
      at: 5,
    })
    expect(context.gains).toHaveLength(2)
  })

  it('starts live and scheduled string voices on the shared audio clock', () => {
    const { context, synth } = harness()

    expect(synth.noteOn({ id: 'live:pointer:4', midi: 69, velocity: 1 })).toBe(
      true,
    )
    expect(
      synth.noteOn({
        id: 'score:project-a:17',
        midi: 72,
        velocity: 0.7,
        atContextTime: 8.25,
      }),
    ).toBe(true)

    expect(synth.activeVoiceIds()).toEqual([
      'live:pointer:4',
      'score:project-a:17',
    ])
    expect(
      context.oscillators.map((oscillator) => oscillator.starts[0]),
    ).toEqual([5, 5, 8.25, 8.25])
    expect(context.oscillators[0].frequency.events[0]).toMatchObject({
      kind: 'set',
      value: 440,
      at: 5,
    })
  })

  it('scales the strike with normalized velocity and the captured soft pedal', () => {
    const { context, synth } = harness()

    synth.noteOn({ id: 'forte', midi: 60, velocity: 1, softPedalValue: 0 })
    synth.noteOn({ id: 'soft', midi: 64, velocity: 1, softPedalValue: 1 })
    synth.noteOn({ id: 'quiet', midi: 67, velocity: 0.25 })

    const fortePeak = strikePeak(context.gains[1])
    const softPeak = strikePeak(context.gains[2])
    const quietPeak = strikePeak(context.gains[3])
    expect(softPeak).toBeLessThan(fortePeak)
    expect(quietPeak).toBeLessThan(softPeak)
  })

  it('caps polyphony at 32 and releases the oldest voice first', () => {
    const { context, synth } = harness({ maxVoices: 200 })

    for (let index = 0; index <= PIANO_FALLBACK_MAX_VOICES; index += 1) {
      synth.noteOn({
        id: `voice:${index}`,
        midi: 36 + index,
        velocity: 0.8,
      })
    }

    expect(synth.activeVoiceIds()).toHaveLength(PIANO_FALLBACK_MAX_VOICES)
    expect(synth.activeVoiceIds()).not.toContain('voice:0')
    expect(synth.activeVoiceIds()).toContain('voice:32')
    expect(context.oscillators[0].stops).toHaveLength(1)
    expect(context.oscillators[1].stops).toHaveLength(1)
  })

  it('steals a note scheduled ahead before it sounds once 32 are waiting live, so the ceiling stays as it was', () => {
    // Arrange
    const { context, synth } = harness()

    // Act
    scheduleAhead(synth, 40)

    // Assert: the first eight are stopped before they start, the rest play out.
    const spans = noteSpans(context)
    expect(synth.descriptor().maximumVoices).toBe(32)
    expect(spans.filter((span) => span.end < span.start)).toHaveLength(8)
    expect(spans.slice(8).every((span) => span.end > span.start)).toBe(true)
  })

  it('keeps every note an offline render schedules ahead, each to its release', () => {
    // Arrange
    const { context, synth } = harness({ offline: true, maxVoices: 2 })

    // Act
    scheduleAhead(synth, 1000)

    // Assert: each note ends 0.1 s after its note-off, half a second after it starts.
    const spans = noteSpans(context)
    expect(spans).toHaveLength(1000)
    expect(
      spans.every((span) => Math.abs(span.end - span.start - 0.6) < 1e-9),
    ).toBe(true)
    expect(synth.activeVoiceIds()).toHaveLength(1000)
    expect(synth.descriptor().maximumVoices).toBe(Number.POSITIVE_INFINITY)
  })

  it('can pull a scheduled release earlier during panic', () => {
    const { context, synth } = harness()
    synth.noteOn({
      id: 'score:future',
      midi: 60,
      velocity: 0.8,
      atContextTime: 10,
    })

    expect(
      synth.noteOff({
        id: 'score:future',
        releaseVelocity: 0.7,
        atContextTime: 12,
      }),
    ).toBe(true)
    expect(context.oscillators[0].stops.at(-1)).toBeCloseTo(12.1)
    synth.panic(6)

    expect(context.oscillators[0].stops.at(-1)).toBeCloseTo(6.1)
    expect(synth.activeVoiceIds()).toEqual([])
  })

  it('cleans ended voices and disposes the graph idempotently', () => {
    const { context, synth } = harness()
    synth.noteOn({ id: 'live:cleanup', midi: 60, velocity: 0.8 })
    expect(synth.noteOff({ id: 'live:cleanup' })).toBe(true)

    context.oscillators[0].onended?.()
    expect(synth.activeVoiceIds()).toEqual([])

    synth.noteOn({ id: 'live:dispose', midi: 64, velocity: 0.8 })
    synth.dispose()
    synth.dispose()
    expect(synth.activeVoiceIds()).toEqual([])
    expect(context.gains[0].disconnect).toHaveBeenCalledOnce()
    expect(context.compressors[0].disconnect).toHaveBeenCalledOnce()
    expect(synth.noteOn({ id: 'live:late', midi: 67, velocity: 0.8 })).toBe(
      false,
    )
  })
})
