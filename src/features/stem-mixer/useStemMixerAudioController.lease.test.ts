// ============================================================
// StemMixer — the room's one audio context (REQ-NRM-033/036/038)
// ============================================================
//
// A room hosted by the native shell does not build an AudioContext; it is
// lent one, the app's (packages/audio-io), and closing it would cost a
// gesture the singer has no reason to give. So a mixer handed a lease
// builds its graph on the lent context, resumes it through the lease, and
// on the way out takes its own nodes off it and leaves the context alone.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StemMixerAudioDeps } from './useStemMixerAudioController'
import { useStemMixerAudioController } from './useStemMixerAudioController'

interface FakeNode {
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

function fakeContext(state: AudioContextState = 'suspended') {
  const nodes: FakeNode[] = []
  const node = <T extends object>(extra: T): FakeNode & T => {
    const made = { connect: vi.fn(), disconnect: vi.fn(), ...extra }
    nodes.push(made)
    return made
  }
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  })
  return {
    nodes,
    context: {
      state,
      currentTime: 0,
      sampleRate: 48_000,
      destination: {},
      resume: vi.fn(async () => Promise.resolve()),
      close: vi.fn(async () => Promise.resolve()),
      createGain: vi.fn(() => node({ gain: param() })),
      createWaveShaper: vi.fn(() =>
        node({ curve: null as Float32Array | null, oversample: 'none' }),
      ),
      createAnalyser: vi.fn(() =>
        node({
          fftSize: 2048,
          smoothingTimeConstant: 0,
          getFloatTimeDomainData: vi.fn(),
        }),
      ),
    },
  }
}

function stemTrack(label: string, url: string) {
  return {
    label,
    url,
    color: '#fff',
    buffer: null,
    gainNode: null,
    analyserNode: null,
    sourceNode: null,
    muted: false,
    soloed: false,
    volume: 1,
  }
}

function harness(over: Partial<StemMixerAudioDeps>) {
  const [vocal, setVocal] = createSignal(stemTrack('Vocal', '/v.m4a'))
  const [instrumental, setInstrumental] = createSignal(
    stemTrack('Instrumental', '/i.m4a'),
  )
  const [midi, setMidi] = createSignal(stemTrack('MIDI', ''))
  const [extras, setExtras] = createSignal([])
  const [midiNotes, setMidiNotes] = createSignal([])
  const noop = (): void => undefined
  const deps = {
    vocal,
    setVocal,
    instrumental,
    setInstrumental,
    midi,
    setMidi,
    extras,
    setExtras,
    tracks: () => [vocal(), instrumental()],
    anySoloed: () => false,
    PITCH_WINDOW_FILL_RATIO: 0.8,
    midiNotes,
    setMidiNotes,
    canvas: {
      syncCanvasSizes: noop,
      drawWaveformOverview: noop,
      drawLiveWaveform: noop,
      drawPitchCanvas: noop,
      drawMidiCanvas: noop,
    },
    updateCurrentLine: noop,
    setCurrentLineIdx: noop,
    setUserScrolled: noop,
    micActive: () => false,
    getMicAnalyserNode: () => null,
    getMicPitchDetector: () => null,
    getMicPitchHistory: () => [],
    setMicPitch: noop,
    comparisonData: () => [],
    pushComparison: noop,
    markLoopIteration: noop,
    clearComparisonData: noop,
    resetMicPitchHistory: noop,
    computeScore: () => ({}),
    setScore: noop,
    setShowScore: noop,
    resetScore: noop,
    stems: { vocal: '/v.m4a', instrumental: '/i.m4a' },
    songTitle: 'Goodbye to Spring',
    showNotification: noop,
    ...over,
  } as unknown as StemMixerAudioDeps
  let controller!: ReturnType<typeof useStemMixerAudioController>
  const dispose = createRoot((disposeRoot) => {
    controller = useStemMixerAudioController(deps)
    return disposeRoot
  })
  return { controller, dispose }
}

let constructed = 0

beforeEach(() => {
  constructed = 0
  vi.stubGlobal('AudioContext', function AudioContextStub(): unknown {
    constructed += 1
    return fakeContext('running').context
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('a mixer lent the room audio context', () => {
  it('builds on the lent context and constructs none of its own', () => {
    const lent = fakeContext()
    const lease = {
      ensure: vi.fn(() => lent.context as unknown as AudioContext),
      unlock: vi.fn(async () => Promise.resolve(true)),
    }
    const { controller, dispose } = harness({
      audioLease: lease,
    } as Partial<StemMixerAudioDeps>)
    const ctx = controller.ensureAudioCtx()

    expect(ctx).toBe(lent.context)
    expect(constructed).toBe(0)
    expect(lease.ensure).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('resumes a suspended context through the lease, not by itself', () => {
    const lent = fakeContext('suspended')
    const lease = {
      ensure: vi.fn(() => lent.context as unknown as AudioContext),
      unlock: vi.fn(async () => Promise.resolve(true)),
    }
    const { controller, dispose } = harness({
      audioLease: lease,
    } as Partial<StemMixerAudioDeps>)
    controller.ensureAudioCtx()

    expect(lease.unlock).toHaveBeenCalledTimes(1)
    expect(lent.context.resume).not.toHaveBeenCalled()
    dispose()
  })

  it('takes its own nodes off the context on the way out, and never closes it', () => {
    const lent = fakeContext('running')
    const lease = {
      ensure: vi.fn(() => lent.context as unknown as AudioContext),
      unlock: vi.fn(async () => Promise.resolve(true)),
    }
    const { controller, dispose } = harness({
      audioLease: lease,
    } as Partial<StemMixerAudioDeps>)
    controller.ensureAudioCtx()
    expect(lent.nodes.length).toBeGreaterThan(0)

    controller.detachGraph()

    for (const made of lent.nodes) expect(made.disconnect).toHaveBeenCalled()
    expect(lent.context.close).not.toHaveBeenCalled()
    // A song after this one builds its graph afresh on the same context.
    expect(controller.getAudioCtx()).toBeNull()
    expect(controller.ensureAudioCtx()).toBe(lent.context)
    dispose()
  })

  it('wires the key graph to the new master when the context is lent again', () => {
    const lent = fakeContext('running')
    const lease = {
      ensure: vi.fn(() => lent.context as unknown as AudioContext),
      unlock: vi.fn(async () => Promise.resolve(true)),
    }
    const { controller, dispose } = harness({
      audioLease: lease,
    } as Partial<StemMixerAudioDeps>)
    const feeds = (from: FakeNode, to: FakeNode) =>
      from.connect.mock.calls.some(([target]) => target === to)
    controller.ensureAudioCtx()
    controller.detachGraph()
    const before = lent.nodes.length

    controller.ensureAudioCtx()

    // The master gain is the first node a fresh graph makes, and only the key
    // graph's output feeds it. A key graph left on the old master feeds nothing.
    const rebuilt = lent.nodes.slice(before)
    const master = rebuilt[0]
    expect(rebuilt.filter((made) => feeds(made, master))).toHaveLength(1)
    dispose()
  })

  it('without a lease it is the mixer it was: its own context', () => {
    const { controller, dispose } = harness({})
    controller.ensureAudioCtx()
    expect(constructed).toBe(1)
    dispose()
  })
})
