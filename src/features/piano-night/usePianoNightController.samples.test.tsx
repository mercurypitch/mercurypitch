// ============================================================
// Piano Night sampled-controller tests — cancellable four-beat preparation
// ============================================================

import { cleanup, render, waitFor } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePianoNightController } from './usePianoNightController'

const sampled = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  const snapshot = {
    status: 'idle' as 'idle' | 'loading' | 'ready' | 'error',
    playable: false,
    loadedSamples: 0,
    preparedSamples: 0,
    plannedSamples: 0,
    totalSamples: 0,
    decodedBytes: 0,
    error: null as string | null,
  }
  return {
    listeners,
    snapshot,
    create: vi.fn(),
    load: vi.fn(),
    prewarm: vi.fn(),
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    pedal: vi.fn(),
    panic: vi.fn(),
    dispose: vi.fn(),
    setCharacter: vi.fn(),
    setAmbience: vi.fn(),
    getLoadSnapshot: vi.fn(),
    subscribe: vi.fn(),
  }
})

vi.mock('@/features/piano/instrument/piano-sampled-instrument', () => ({
  createPianoSampledInstrument: sampled.create,
}))

class ControllerAudioContext {
  currentTime = 0
  state: AudioContextState = 'suspended'
  failResume = false

  readonly resume = vi.fn(async () => {
    if (this.failResume) throw new Error('Audio activation failed')
    this.state = 'running'
  })

  readonly close = vi.fn(async () => {
    this.state = 'closed'
  })
}

function mountController(): ReturnType<typeof usePianoNightController> {
  let controller!: ReturnType<typeof usePianoNightController>
  const Harness: Component = () => {
    controller = usePianoNightController()
    return null
  }
  render(() => <Harness />)
  return controller
}

function deferredPrewarm(): {
  promise: Promise<void>
  resolve(): void
} {
  let resolve!: () => void
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

interface ControllerMidiInput {
  id: string
  name: string
  manufacturer: string | null
  state: MIDIPortDeviceState
  connection: MIDIPortConnectionState
  onmidimessage: ((event: MIDIMessageEvent) => void) | null
}

function sendMidi(input: ControllerMidiInput, bytes: readonly number[]): void {
  input.onmidimessage?.({
    data: new Uint8Array(bytes),
    timeStamp: performance.now(),
  } as MIDIMessageEvent)
}

let context: ControllerAudioContext
let latestFrame: FrameRequestCallback | null
let originalRequestMidiAccess: PropertyDescriptor | undefined

beforeEach(() => {
  localStorage.clear()
  context = new ControllerAudioContext()
  latestFrame = null
  vi.stubGlobal(
    'AudioContext',
    vi.fn(function AudioContextConstructor() {
      return context
    }),
  )
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      latestFrame = callback
      return 1
    }),
  )
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  originalRequestMidiAccess = Object.getOwnPropertyDescriptor(
    navigator,
    'requestMIDIAccess',
  )

  sampled.listeners.clear()
  sampled.snapshot.status = 'idle'
  sampled.snapshot.playable = false
  sampled.snapshot.loadedSamples = 0
  sampled.snapshot.preparedSamples = 0
  sampled.snapshot.plannedSamples = 0
  sampled.snapshot.totalSamples = 0
  sampled.snapshot.decodedBytes = 0
  sampled.snapshot.error = null
  for (const mock of [
    sampled.create,
    sampled.load,
    sampled.prewarm,
    sampled.noteOn,
    sampled.noteOff,
    sampled.pedal,
    sampled.panic,
    sampled.dispose,
    sampled.setCharacter,
    sampled.setAmbience,
    sampled.getLoadSnapshot,
    sampled.subscribe,
  ]) {
    mock.mockReset()
  }

  const instrument = {
    descriptor: () => ({
      id: 'test-concert-grand',
      name: 'Test Concert Grand',
      kind: 'sampled' as const,
      maximumVoices: 64,
    }),
    load: sampled.load,
    prewarm: sampled.prewarm,
    noteOn: sampled.noteOn,
    noteOff: sampled.noteOff,
    pedal: sampled.pedal,
    panic: sampled.panic,
    setVolume: vi.fn(),
    activeVoiceIds: () => [],
    dispose: sampled.dispose,
    setCharacter: sampled.setCharacter,
    setAmbience: sampled.setAmbience,
    getLoadSnapshot: sampled.getLoadSnapshot,
    subscribe: sampled.subscribe,
  }
  sampled.create.mockReturnValue(instrument)
  sampled.load.mockResolvedValue(undefined)
  sampled.prewarm.mockResolvedValue(undefined)
  sampled.noteOn.mockReturnValue(true)
  sampled.noteOff.mockReturnValue(true)
  sampled.getLoadSnapshot.mockImplementation(() => sampled.snapshot)
  sampled.subscribe.mockImplementation((listener: () => void) => {
    sampled.listeners.add(listener)
    return () => sampled.listeners.delete(listener)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (originalRequestMidiAccess === undefined) {
    Reflect.deleteProperty(navigator, 'requestMIDIAccess')
  } else {
    Object.defineProperty(
      navigator,
      'requestMIDIAccess',
      originalRequestMidiAccess,
    )
  }
})

describe('usePianoNightController sampled preparation', () => {
  it('leaves a failed audio activation retryable and on the fallback', async () => {
    context.failResume = true
    const controller = mountController()

    await expect(controller.loadSampledInstrument()).resolves.toBe(false)
    expect(controller.soundLoadStatus()).toBe('error')
    expect(controller.soundLoadError()).toContain('Audio could not start')
    expect(sampled.create).not.toHaveBeenCalled()

    context.failResume = false
    await expect(controller.loadSampledInstrument()).resolves.toBe(true)
    expect(controller.soundLoadStatus()).toBe('ready')
    expect(sampled.create).toHaveBeenCalledOnce()
  })

  it('does not override a later fallback choice when preparation settles', async () => {
    const pending = deferredPrewarm()
    sampled.prewarm.mockImplementationOnce(() => pending.promise)
    const controller = mountController()

    const loading = controller.loadSampledInstrument()
    await waitFor(() => expect(sampled.prewarm).toHaveBeenCalledOnce())
    expect(sampled.load).not.toHaveBeenCalled()
    controller.setInstrumentPreference('fallback')
    sampled.snapshot.status = 'loading'
    sampled.snapshot.playable = true
    sampled.snapshot.preparedSamples = 7
    sampled.snapshot.plannedSamples = 18
    for (const listener of sampled.listeners) listener()

    expect(controller.instrumentPreference()).toBe('fallback')
    expect(controller.soundLoadStatus()).toBe('ready')
    expect(controller.soundRefining()).toBe(true)
    expect(controller.soundLoadedSamples()).toBe(7)
    expect(controller.soundTotalSamples()).toBe(18)
    expect(controller.statusMessage()).toBe('Mercury Felt Synth selected.')

    sampled.snapshot.status = 'ready'
    sampled.snapshot.preparedSamples = 18
    for (const listener of sampled.listeners) listener()
    pending.resolve()

    await expect(loading).resolves.toBe(true)
    expect(controller.instrumentPreference()).toBe('fallback')
    expect(controller.soundLoadStatus()).toBe('ready')
    expect(controller.soundRefining()).toBe(false)
    expect(controller.statusMessage()).toBe('Mercury Felt Synth selected.')
    await expect(controller.play()).resolves.toBe(true)
    expect(controller.statusMessage()).toContain('Mercury Felt Synth')
  })

  it('selects playable coverage before optional refinement settles', async () => {
    const pending = deferredPrewarm()
    sampled.prewarm.mockImplementationOnce(() => pending.promise)
    const controller = mountController()
    let settled = false
    const loading = controller.loadSampledInstrument().then((result) => {
      settled = true
      return result
    })
    await waitFor(() => expect(sampled.prewarm).toHaveBeenCalledOnce())

    sampled.snapshot.status = 'loading'
    sampled.snapshot.playable = true
    sampled.snapshot.preparedSamples = 7
    sampled.snapshot.plannedSamples = 18
    for (const listener of sampled.listeners) listener()

    expect(settled).toBe(false)
    expect(controller.instrumentPreference()).toBe('auto')
    expect(controller.soundLoadStatus()).toBe('ready')
    expect(controller.soundRefining()).toBe(true)
    expect(controller.statusMessage()).toContain('Concert Grand is ready')

    sampled.snapshot.status = 'ready'
    sampled.snapshot.preparedSamples = 18
    for (const listener of sampled.listeners) listener()
    pending.resolve()
    await expect(loading).resolves.toBe(true)
    expect(controller.soundRefining()).toBe(false)
  })

  it('cancels optional refinement after coverage when a seek supersedes it', async () => {
    sampled.prewarm
      .mockImplementationOnce(
        (_midis: readonly number[], signal?: AbortSignal) =>
          new Promise<void>((_resolve, reject) => {
            const rejectAbort = () =>
              reject(new DOMException('Cancelled', 'AbortError'))
            signal?.addEventListener('abort', rejectAbort, { once: true })
            if (signal?.aborted === true) rejectAbort()
          }),
      )
      .mockResolvedValue(undefined)
    const controller = mountController()
    const initial = controller.loadSampledInstrument()
    await waitFor(() => expect(sampled.prewarm).toHaveBeenCalledOnce())
    const refiningSignal = sampled.prewarm.mock.calls[0]?.[1] as AbortSignal

    sampled.snapshot.status = 'loading'
    sampled.snapshot.playable = true
    sampled.snapshot.preparedSamples = 7
    sampled.snapshot.plannedSamples = 18
    for (const listener of sampled.listeners) listener()
    expect(controller.soundLoadStatus()).toBe('ready')

    controller.seekToBeat(4)

    expect(refiningSignal.aborted).toBe(true)
    await expect(initial).resolves.toBe(false)
    await waitFor(() => expect(sampled.prewarm).toHaveBeenCalledTimes(2))
    expect(sampled.prewarm.mock.calls[1]?.[0]).not.toHaveLength(0)
    expect(new Set(sampled.prewarm.mock.calls[1]?.[0])).not.toEqual(
      new Set(sampled.prewarm.mock.calls[0]?.[0]),
    )
    expect(controller.instrumentPreference()).toBe('auto')
    expect(controller.soundLoadStatus()).toBe('ready')
    expect(controller.soundLoadError()).toBeNull()
  })

  it('aborts stale seek preparation before warming the new current bar', async () => {
    let rejectPending!: (reason: DOMException) => void
    sampled.prewarm
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(
        (_midis: readonly number[], signal?: AbortSignal) =>
          new Promise<void>((_resolve, reject) => {
            rejectPending = reject
            signal?.addEventListener(
              'abort',
              () => rejectPending(new DOMException('Cancelled', 'AbortError')),
              { once: true },
            )
          }),
      )
      .mockResolvedValue(undefined)
    const controller = mountController()

    await expect(controller.loadSampledInstrument()).resolves.toBe(true)
    controller.seekToBeat(4)
    await waitFor(() => expect(sampled.prewarm).toHaveBeenCalledTimes(2))
    const staleSignal = sampled.prewarm.mock.calls[1]?.[1] as AbortSignal

    controller.seekToBeat(8)

    expect(staleSignal.aborted).toBe(true)
    await waitFor(() => expect(sampled.prewarm).toHaveBeenCalledTimes(3))
    expect(new Set(sampled.prewarm.mock.calls[2]?.[0])).toEqual(
      new Set([48, 55, 60, 64, 67, 72, 70]),
    )
    expect(controller.soundLoadStatus()).toBe('ready')
    expect(controller.soundLoadError()).toBeNull()
  })

  it('aborts stale preparation and warms the replacement source', async () => {
    let rejectPending!: (reason: DOMException) => void
    sampled.prewarm
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(
        (_midis: readonly number[], signal?: AbortSignal) =>
          new Promise<void>((_resolve, reject) => {
            rejectPending = reject
            signal?.addEventListener(
              'abort',
              () => rejectPending(new DOMException('Cancelled', 'AbortError')),
              { once: true },
            )
          }),
      )
      .mockResolvedValue(undefined)
    const controller = mountController()

    await expect(controller.loadSampledInstrument()).resolves.toBe(true)
    controller.seekToBeat(4)
    await waitFor(() => expect(sampled.prewarm).toHaveBeenCalledTimes(2))
    const staleSignal = sampled.prewarm.mock.calls[1]?.[1] as AbortSignal
    const previous = controller.source()
    const seedNote = previous.stage.notes[0]
    expect(seedNote).toBeDefined()

    const replacement = Object.freeze({
      ...previous,
      id: 'piano-night:test:replacement',
      stage: Object.freeze({
        ...previous.stage,
        title: 'Replacement étude',
        notes: Object.freeze([
          Object.freeze({
            ...seedNote!,
            id: 'replacement:note',
            midi: 81,
            startBeat: 0,
          }),
        ]),
      }),
    })
    expect(controller.replaceSource(replacement)).toBe(true)

    expect(staleSignal.aborted).toBe(true)
    await waitFor(() => expect(sampled.prewarm).toHaveBeenCalledTimes(3))
    expect(sampled.prewarm.mock.calls[2]?.[0]).toEqual([81])
  })

  it('warms a note that sustains into the current window after a seek', async () => {
    const controller = mountController()
    const previous = controller.source()
    const seedNote = previous.stage.notes[0]
    expect(seedNote).toBeDefined()
    const replacement = Object.freeze({
      ...previous,
      id: 'piano-night:test:carry-in',
      stage: Object.freeze({
        ...previous.stage,
        title: 'Carry-in étude',
        notes: Object.freeze([
          Object.freeze({
            ...seedNote!,
            id: 'carry-in:note',
            midi: 81,
            startBeat: 3,
            duration: 3,
          }),
        ]),
        totalBeats: 8,
      }),
    })

    expect(controller.replaceSource(replacement)).toBe(true)
    await expect(controller.loadSampledInstrument()).resolves.toBe(true)
    sampled.prewarm.mockClear()

    controller.seekToBeat(4)

    await waitFor(() => expect(sampled.prewarm).toHaveBeenCalledOnce())
    expect(sampled.prewarm.mock.calls[0]?.[0]).toEqual([81])
  })

  it('mirrors MIDI reset, panic, and disconnect pedal state without panicking score voices', async () => {
    const midiInput: ControllerMidiInput = {
      id: 'sampled-stage-keyboard',
      name: 'Sampled Stage Keyboard',
      manufacturer: 'Mercury Test',
      state: 'connected',
      connection: 'open',
      onmidimessage: null,
    }
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: vi.fn(
        async () =>
          ({
            inputs: new Map([
              [midiInput.id, midiInput as unknown as MIDIInput],
            ]),
            outputs: new Map(),
            onstatechange: null,
          }) as unknown as MIDIAccess,
      ),
    })
    const controller = mountController()

    await expect(controller.loadSampledInstrument()).resolves.toBe(true)
    await expect(controller.connectMidi()).resolves.toBe(true)
    expect(midiInput.onmidimessage).toEqual(expect.any(Function))

    sendMidi(midiInput, [0xb2, 64, 127])
    sendMidi(midiInput, [0xb2, 67, 96])
    sampled.pedal.mockClear()
    sendMidi(midiInput, [0xb2, 121, 0])

    expect(sampled.pedal.mock.calls.map(([event]) => event)).toEqual([
      { pedal: 'sustain', value: 0 },
      { pedal: 'sostenuto', value: 0 },
      { pedal: 'soft', value: 0 },
    ])

    sendMidi(midiInput, [0xb2, 67, 127])
    sampled.pedal.mockClear()
    sendMidi(midiInput, [0xb2, 120, 0])
    expect(sampled.pedal.mock.calls.map(([event]) => event)).toEqual([
      { pedal: 'sustain', value: 0 },
      { pedal: 'sostenuto', value: 0 },
      { pedal: 'soft', value: 0 },
    ])

    sendMidi(midiInput, [0xb2, 64, 127])
    sampled.pedal.mockClear()
    controller.setInstrumentPreference('fallback')
    controller.disconnectMidi()
    expect(sampled.pedal.mock.calls.map(([event]) => event)).toEqual([
      { pedal: 'sustain', value: 0 },
      { pedal: 'sostenuto', value: 0 },
      { pedal: 'soft', value: 0 },
    ])
    expect(sampled.panic).not.toHaveBeenCalled()
  })

  it('keeps a pedal active while another MIDI channel still holds it', async () => {
    const midiInput: ControllerMidiInput = {
      id: 'multi-channel-keyboard',
      name: 'Multi-channel Keyboard',
      manufacturer: 'Mercury Test',
      state: 'connected',
      connection: 'open',
      onmidimessage: null,
    }
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: vi.fn(
        async () =>
          ({
            inputs: new Map([
              [midiInput.id, midiInput as unknown as MIDIInput],
            ]),
            outputs: new Map(),
            onstatechange: null,
          }) as unknown as MIDIAccess,
      ),
    })
    const controller = mountController()

    await expect(controller.loadSampledInstrument()).resolves.toBe(true)
    await expect(controller.connectMidi()).resolves.toBe(true)

    sendMidi(midiInput, [0xb2, 67, 127])
    sendMidi(midiInput, [0xb3, 67, 64])
    sampled.pedal.mockClear()
    sendMidi(midiInput, [0xb2, 67, 0])

    expect(sampled.pedal).toHaveBeenLastCalledWith({
      pedal: 'soft',
      value: 64 / 127,
    })

    sendMidi(midiInput, [0xb3, 67, 0])
    expect(sampled.pedal).toHaveBeenLastCalledWith({
      pedal: 'soft',
      value: 0,
    })
  })

  it('replays a held pedal when the sampled engine loads later', async () => {
    const midiInput: ControllerMidiInput = {
      id: 'late-sampled-keyboard',
      name: 'Late Sampled Keyboard',
      manufacturer: 'Mercury Test',
      state: 'connected',
      connection: 'open',
      onmidimessage: null,
    }
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: vi.fn(
        async () =>
          ({
            inputs: new Map([
              [midiInput.id, midiInput as unknown as MIDIInput],
            ]),
            outputs: new Map(),
            onstatechange: null,
          }) as unknown as MIDIAccess,
      ),
    })
    const controller = mountController()

    await expect(controller.connectMidi()).resolves.toBe(true)
    sendMidi(midiInput, [0xb2, 67, 96])
    expect(sampled.create).not.toHaveBeenCalled()

    await expect(controller.loadSampledInstrument()).resolves.toBe(true)

    expect(sampled.pedal).toHaveBeenCalledWith({
      pedal: 'soft',
      value: 96 / 127,
    })
  })

  it('aborts pending preparation when its owner is disposed', async () => {
    let rejectPending!: (reason: DOMException) => void
    sampled.prewarm.mockResolvedValueOnce(undefined).mockImplementationOnce(
      (_midis: readonly number[], signal?: AbortSignal) =>
        new Promise<void>((_resolve, reject) => {
          rejectPending = reject
          signal?.addEventListener(
            'abort',
            () => rejectPending(new DOMException('Cancelled', 'AbortError')),
            { once: true },
          )
        }),
    )
    const controller = mountController()

    await expect(controller.loadSampledInstrument()).resolves.toBe(true)
    controller.seekToBeat(4)
    await waitFor(() => expect(sampled.prewarm).toHaveBeenCalledTimes(2))
    const pendingSignal = sampled.prewarm.mock.calls[1]?.[1] as AbortSignal

    cleanup()

    expect(pendingSignal.aborted).toBe(true)
    expect(sampled.dispose).toHaveBeenCalledOnce()
  })

  it('reprioritizes a pending lookahead when that bar becomes current', async () => {
    const pendingLookahead = deferredPrewarm()
    sampled.prewarm
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(
        (_midis: readonly number[], signal?: AbortSignal) => {
          signal?.addEventListener('abort', () => pendingLookahead.resolve(), {
            once: true,
          })
          return pendingLookahead.promise
        },
      )
      .mockResolvedValue(undefined)
    const controller = mountController()

    await expect(controller.loadSampledInstrument()).resolves.toBe(true)
    expect(new Set(sampled.prewarm.mock.calls[0]?.[0])).toEqual(
      new Set([44, 55, 60, 63, 67, 68, 70]),
    )
    await expect(controller.play()).resolves.toBe(true)

    latestFrame?.(0)
    await waitFor(() => expect(sampled.prewarm).toHaveBeenCalledTimes(2))
    expect(new Set(sampled.prewarm.mock.calls[1]?.[0])).toEqual(
      new Set([44, 55, 60, 63, 67, 68, 70, 41, 53, 56, 65, 72]),
    )
    const pendingSignal = sampled.prewarm.mock.calls[1]?.[1] as AbortSignal

    context.currentTime = 4 * 0.769231 + 0.01
    latestFrame?.(context.currentTime * 1000)
    expect(pendingSignal.aborted).toBe(true)
    await waitFor(() => expect(sampled.prewarm).toHaveBeenCalledTimes(3))
    expect(new Set(sampled.prewarm.mock.calls[2]?.[0])).toEqual(
      new Set([41, 53, 56, 60, 65, 67, 68, 72, 48, 55, 64, 70]),
    )

    context.currentTime = 8 * 0.769231 + 0.01
    latestFrame?.(context.currentTime * 1000)
    await waitFor(() => expect(sampled.prewarm).toHaveBeenCalledTimes(4))
    expect(new Set(sampled.prewarm.mock.calls[3]?.[0])).toEqual(
      new Set([48, 55, 60, 64, 67, 72, 70, 46, 53, 58, 62, 65, 63]),
    )
  })
})
