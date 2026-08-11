// Listening runtime regressions cover coarse attacks and calibration teardown.
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarInputWorkletMessage } from '@/lib/guitar/input-events'
import { guitarInputAnalysisChannelCount, strongestGuitarInputChannel, useGuitarListeningController, } from './useGuitarListeningController'

const dependencies = vi.hoisted(() => ({
  acquire: vi.fn(),
  release: vi.fn(),
  listAudioInputs: vi.fn<() => Promise<MediaDeviceInfo[]>>(async () => []),
  setPreferredDevice: vi.fn(async () => undefined),
  getError: vi.fn(),
  takeOverFromOtherTab: vi.fn(async () => true),
  releaseTakeoverIfUnused: vi.fn(async () => undefined),
  registerRunGuard: vi.fn(),
  subscribe: vi.fn(),
  micStateListener: null as
    | ((state: {
        active: boolean
        error: { kind: string; message: string } | null
      }) => void)
    | null,
  runGuard: null as (() => boolean) | null,
  connectWorklet: vi.fn(),
  workletTap: null as { dispose(): void } | null,
  detections: [] as Array<{
    frequency: number
    clarity: number
    noteName: string
    octave: number
    cents: number
  }>,
  emitWorklet: null as ((message: GuitarInputWorkletMessage) => void) | null,
  latencyMs: 0,
  latencyByDevice: new Map<string, number>(),
  latencySpreadMs: null as number | null,
  setLatencyMeasurement:
    vi.fn<
      (
        deviceId: string | null,
        milliseconds: number,
        spreadMs: number | null,
      ) => void
    >(),
}))

vi.mock('@/lib/guitar/guitar-input-node', () => ({
  connectGuitarInputWorklet: dependencies.connectWorklet,
}))

vi.mock('@/lib/mic-manager', () => ({
  listAudioInputs: dependencies.listAudioInputs,
  micManager: {
    acquire: dependencies.acquire,
    release: dependencies.release,
    setPreferredDevice: dependencies.setPreferredDevice,
    getError: dependencies.getError,
    takeOverFromOtherTab: dependencies.takeOverFromOtherTab,
    releaseTakeoverIfUnused: dependencies.releaseTakeoverIfUnused,
    registerRunGuard: dependencies.registerRunGuard,
    subscribe: dependencies.subscribe,
  },
}))

vi.mock('@/lib/mic-sentinel', () => ({
  registerMicIndicator: vi.fn(() => () => undefined),
}))

vi.mock('@/lib/pitch-detector', () => ({
  PitchDetector: class {
    detect() {
      return (
        dependencies.detections.shift() ?? {
          frequency: 0,
          clarity: 0,
          noteName: '',
          octave: 0,
          cents: 0,
        }
      )
    }
  },
}))

describe('strongestGuitarInputChannel', () => {
  it('keeps pitch analysis on the strongest intact channel', () => {
    const quiet = new Float32Array([0.01, -0.01, 0.01, -0.01])
    const strong = new Float32Array([0.5, -0.5, 0.5, -0.5])
    const phaseOpposed = new Float32Array([-0.5, 0.5, -0.5, 0.5])

    expect(strongestGuitarInputChannel([quiet, strong])).toBe(1)
    expect(strongestGuitarInputChannel([strong, phaseOpposed])).toBe(0)
  })
})

describe('guitarInputAnalysisChannelCount', () => {
  it('keeps every browser-addressable interface channel', () => {
    expect(guitarInputAnalysisChannelCount(12, 2)).toBe(12)
    expect(guitarInputAnalysisChannelCount(Number.NaN, 16)).toBe(16)
  })

  it('fails visibly instead of silently dropping channels beyond Web Audio', () => {
    expect(() => guitarInputAnalysisChannelCount(33, 2)).toThrow(
      'can inspect at most 32',
    )
  })
})

vi.mock('@/stores/mic-latency-store', () => ({
  micLatencyMsForDevice: (deviceId: string | null) =>
    dependencies.latencyByDevice.get(deviceId ?? 'default') ??
    dependencies.latencyMs,
  micLatencySpreadMsForDevice: () => dependencies.latencySpreadMs,
  setMicLatencyMeasurementForDevice: dependencies.setLatencyMeasurement,
}))

interface FakeOscillator {
  stop: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

function createAudioHarness() {
  let amplitude = 0
  const oscillators: FakeOscillator[] = []
  const analyser = {
    fftSize: 2048,
    smoothingTimeConstant: 0,
    disconnect: vi.fn(),
    getFloatTimeDomainData(samples: Float32Array) {
      samples.fill(amplitude)
    },
  }
  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
  const context = {
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    createMediaStreamSource: vi.fn(() => source),
    createAnalyser: vi.fn(() => analyser),
    createOscillator: vi.fn(() => {
      const oscillator = {
        type: 'sine',
        frequency: { value: 0 },
        onended: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      oscillators.push(oscillator)
      return oscillator
    }),
    createGain: vi.fn(() => ({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
  }

  return {
    context: context as unknown as AudioContext,
    oscillators,
    setAmplitude(next: number) {
      amplitude = next
    },
  }
}

function installFrameHarness(context: AudioContext) {
  let nextId = 1
  const callbacks = new Map<number, FrameRequestCallback>()
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      const id = nextId
      nextId += 1
      callbacks.set(id, callback)
      return id
    }),
  )
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => callbacks.delete(id)),
  )

  return {
    run(atSeconds: number) {
      const next = callbacks.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined
      if (next === undefined) throw new Error('No input frame was scheduled')
      callbacks.delete(next[0])
      Object.assign(context, { currentTime: atSeconds })
      next[1](atSeconds * 1000)
    },
  }
}

async function withController(
  context: AudioContext,
  run: (
    controller: ReturnType<typeof useGuitarListeningController>,
  ) => Promise<void>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    createRoot((dispose) => {
      const controller = useGuitarListeningController({
        activateAudio: async () => true,
        getAudioGraph: () => ({ context }) as never,
      })
      void run(controller).then(
        () => {
          dispose()
          resolve()
        },
        (error: unknown) => {
          dispose()
          reject(error)
        },
      )
    })
  })
}

const E4 = {
  frequency: 329.63,
  clarity: 0.92,
  noteName: 'E',
  octave: 4,
  cents: 0,
}

describe('useGuitarListeningController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    dependencies.detections = []
    dependencies.workletTap = null
    dependencies.emitWorklet = null
    dependencies.latencyMs = 0
    dependencies.latencyByDevice.clear()
    dependencies.latencySpreadMs = null
    dependencies.micStateListener = null
    dependencies.runGuard = null
    dependencies.getError.mockReturnValue(null)
    dependencies.takeOverFromOtherTab.mockResolvedValue(true)
    dependencies.listAudioInputs.mockResolvedValue([])
    dependencies.registerRunGuard.mockImplementation(
      (_id: string, guard: () => boolean) => {
        dependencies.runGuard = guard
        return () => undefined
      },
    )
    dependencies.subscribe.mockImplementation(
      (
        listener: (state: {
          active: boolean
          error: { kind: string; message: string } | null
        }) => void,
      ) => {
        dependencies.micStateListener = listener
        listener({ active: false, error: null })
        return () => undefined
      },
    )
    dependencies.setLatencyMeasurement.mockImplementation(
      (
        deviceId: string | null,
        milliseconds: number,
        spreadMs: number | null,
      ) => {
        dependencies.latencyMs = milliseconds
        dependencies.latencyByDevice.set(deviceId ?? 'default', milliseconds)
        dependencies.latencySpreadMs = spreadMs
      },
    )
    dependencies.acquire.mockResolvedValue({})
    dependencies.connectWorklet.mockImplementation(
      async (
        _context: AudioContext,
        _source: AudioNode,
        onMessage: (message: GuitarInputWorkletMessage) => void,
      ) => {
        dependencies.emitWorklet = onMessage
        return dependencies.workletTap
      },
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('admits a same-pitch coarse restrike after the debounce', async () => {
    const audio = createAudioHarness()
    const frames = installFrameHarness(audio.context)
    dependencies.detections = [
      E4,
      { frequency: 0, clarity: 0, noteName: '', octave: 0, cents: 0 },
      E4,
      { frequency: 0, clarity: 0, noteName: '', octave: 0, cents: 0 },
      E4,
    ]

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(true)

      audio.setAmplitude(0.1)
      frames.run(1)
      audio.setAmplitude(0.01)
      frames.run(1.02)
      audio.setAmplitude(0.1)
      frames.run(1.05)
      audio.setAmplitude(0.01)
      frames.run(1.07)
      audio.setAmplitude(0.1)
      frames.run(1.12)

      expect(
        controller.events().filter((event) => event.kind === 'attack'),
      ).toHaveLength(2)
    })
  })

  it('keeps one pinned latency and enriches an exact attack in place', async () => {
    const audio = createAudioHarness()
    const frames = installFrameHarness(audio.context)
    dependencies.workletTap = { dispose: vi.fn() }
    dependencies.latencyMs = 40
    dependencies.detections = [E4]

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(true)
      dependencies.emitWorklet?.({
        type: 'attack',
        atFrame: 4_800,
        level: 0.2,
      })
      const provisional = controller.events()[0]
      expect(provisional?.clock).toEqual({
        kind: 'audio-worklet',
        atFrame: 4_800,
        sampleRate: 48_000,
      })
      expect(provisional?.at).toBeCloseTo(0.06, 6)
      expect(provisional?.rawTransportFrame).toBe(4_800)
      expect(provisional?.compensatedTransportFrame).toBe(2_880)

      dependencies.latencyMs = 180
      frames.run(0.13)

      expect(controller.events()).toHaveLength(1)
      expect(controller.events()[0]?.id).toBe(provisional?.id)
      expect(controller.events()[0]?.pitch?.midi).toBe(64)

      dependencies.emitWorklet?.({
        type: 'attack',
        atFrame: 24_000,
        level: 0.25,
      })
      expect(controller.events()[1]?.at).toBeCloseTo(0.46, 6)
      expect(controller.take()?.clock.latency).toEqual({
        seconds: 0.04,
        frames: 1_920,
        provenance: 'stored-round-trip',
        uncertaintySeconds: null,
      })

      Object.assign(audio.context, { currentTime: 0.75 })
      controller.stop()
      expect(controller.take()?.lifecycle).toBe('completed')
      expect(controller.take()?.durationFrames).toBe(36_000)
      expect(controller.events()).toHaveLength(2)
      expect(controller.timingSource()).toBe('audio-clock')
    })
  })

  it('arms at a future score boundary and excludes count-in attacks', async () => {
    const audio = createAudioHarness()
    installFrameHarness(audio.context)
    dependencies.workletTap = { dispose: vi.fn() }

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(true)
      expect(controller.armTakeAt(1)).toBe(true)

      dependencies.emitWorklet?.({
        type: 'attack',
        atFrame: Math.round(0.8 * 48_000),
        level: 0.2,
      })
      dependencies.emitWorklet?.({
        type: 'attack',
        atFrame: Math.round(1.1 * 48_000),
        level: 0.24,
      })

      expect(controller.take()?.clock.startedAtFrame).toBe(48_000)
      expect(controller.take()?.filteredBeforeStart).toBe(1)
      expect(controller.events()).toHaveLength(1)
      expect(controller.events()[0]?.rawTransportFrame).toBe(4_800)
    })
  })

  it('retains the final pitch enrichment and completes at the scheduled boundary', async () => {
    vi.useFakeTimers()
    const audio = createAudioHarness()
    const frames = installFrameHarness(audio.context)
    dependencies.workletTap = { dispose: vi.fn() }
    dependencies.detections = [E4]

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(true)
      expect(controller.armTakeAt(1)).toBe(true)
      dependencies.emitWorklet?.({
        type: 'attack',
        atFrame: Math.round(1.95 * 48_000),
        level: 0.25,
      })

      Object.assign(audio.context, { currentTime: 2 })
      expect(controller.completeTakeAt(2)).toBe(true)
      frames.run(2.01)
      await vi.advanceTimersByTimeAsync(120)

      expect(controller.status()).toBe('off')
      expect(controller.take()?.lifecycle).toBe('completed')
      expect(controller.take()?.durationFrames).toBe(48_000)
      expect(controller.events()).toHaveLength(1)
      expect(controller.events()[0]?.pitch?.midi).toBe(64)
    })
  })

  it('does not let an old scheduled completion overwrite a newly armed take', async () => {
    vi.useFakeTimers()
    const audio = createAudioHarness()
    installFrameHarness(audio.context)
    dependencies.workletTap = { dispose: vi.fn() }

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(true)
      expect(controller.armTakeAt(1)).toBe(true)
      expect(controller.completeTakeAt(2)).toBe(true)
      const scheduledTakeId = controller.take()?.id

      expect(controller.armTakeAt(3)).toBe(true)
      dependencies.emitWorklet?.({
        type: 'attack',
        atFrame: Math.round(3.1 * 48_000),
        level: 0.22,
      })
      await vi.runAllTimersAsync()

      expect(controller.status()).toBe('listening')
      expect(controller.take()?.id).not.toBe(scheduledTakeId)
      expect(controller.take()?.lifecycle).toBe('recording')
      expect(controller.events()).toHaveLength(1)
      expect(controller.events()[0]?.rawTransportFrame).toBe(4_800)
    })
  })

  it('preserves the completed review when reopening the microphone fails', async () => {
    const audio = createAudioHarness()
    installFrameHarness(audio.context)
    dependencies.workletTap = { dispose: vi.fn() }

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(true)
      dependencies.emitWorklet?.({
        type: 'attack',
        atFrame: 4_800,
        level: 0.2,
      })
      Object.assign(audio.context, { currentTime: 0.5 })
      controller.stop()
      const completed = controller.take()
      expect(completed?.lifecycle).toBe('completed')

      dependencies.acquire.mockRejectedValueOnce(new Error('Permission denied'))
      expect(await controller.start()).toBe(false)

      expect(controller.take()).toEqual(completed)
      expect(controller.status()).toBe('error')
      expect(controller.error()).toBe('Permission denied')
    })
  })

  it('completes the current take when the active audio input disappears', async () => {
    const audio = createAudioHarness()
    installFrameHarness(audio.context)
    dependencies.workletTap = { dispose: vi.fn() }

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(true)
      dependencies.emitWorklet?.({
        type: 'attack',
        atFrame: 4_800,
        level: 0.2,
      })
      Object.assign(audio.context, { currentTime: 0.2 })

      dependencies.micStateListener?.({
        active: false,
        error: {
          kind: 'no-device',
          message: 'The selected audio input disconnected.',
        },
      })

      expect(controller.status()).toBe('error')
      expect(controller.error()).toBe('The selected audio input disconnected.')
      expect(controller.take()?.lifecycle).toBe('completed')
      expect(controller.events()).toHaveLength(1)
    })
  })

  it('offers an explicit cross-tab handoff and starts after taking ownership', async () => {
    const audio = createAudioHarness()
    installFrameHarness(audio.context)
    dependencies.acquire.mockRejectedValueOnce(
      new Error('The microphone is open in another MercuryPitch tab.'),
    )
    dependencies.getError.mockReturnValue({
      kind: 'held-elsewhere',
      message: 'The microphone is open in another MercuryPitch tab.',
    })

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(false)
      expect(controller.canTakeOverInput()).toBe(true)

      dependencies.getError.mockReturnValue(null)
      expect(await controller.useInputHere()).toBe(true)

      expect(dependencies.takeOverFromOtherTab).toHaveBeenCalledOnce()
      expect(controller.canTakeOverInput()).toBe(false)
      expect(controller.status()).toBe('listening')
    })
  })

  it('coalesces repeated cross-tab handoff requests', async () => {
    const audio = createAudioHarness()
    installFrameHarness(audio.context)
    dependencies.acquire.mockRejectedValueOnce(
      new Error('The microphone is open in another MercuryPitch tab.'),
    )
    dependencies.getError.mockReturnValue({
      kind: 'held-elsewhere',
      message: 'The microphone is open in another MercuryPitch tab.',
    })
    let finishHandoff: ((moved: boolean) => void) | undefined
    dependencies.takeOverFromOtherTab.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishHandoff = resolve
        }),
    )

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(false)
      dependencies.getError.mockReturnValue(null)

      const first = controller.useInputHere()
      expect(controller.inputTakeoverPending()).toBe(true)
      await expect(controller.useInputHere()).resolves.toBe(false)
      expect(dependencies.takeOverFromOtherTab).toHaveBeenCalledOnce()

      finishHandoff?.(true)
      await expect(first).resolves.toBe(true)
      expect(controller.inputTakeoverPending()).toBe(false)
    })
  })

  it('does not reopen input when a pending cross-tab handoff outlives the room', async () => {
    const audio = createAudioHarness()
    installFrameHarness(audio.context)
    dependencies.acquire.mockRejectedValueOnce(
      new Error('The microphone is open in another MercuryPitch tab.'),
    )
    dependencies.getError.mockReturnValue({
      kind: 'held-elsewhere',
      message: 'The microphone is open in another MercuryPitch tab.',
    })
    let finishHandoff: ((moved: boolean) => void) | undefined
    dependencies.takeOverFromOtherTab.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishHandoff = resolve
        }),
    )
    let dispose: () => void = () => undefined
    const controller = createRoot((rootDispose) => {
      dispose = rootDispose
      return useGuitarListeningController({
        activateAudio: async () => true,
        getAudioGraph: () => ({ context: audio.context }) as never,
      })
    })

    expect(await controller.start()).toBe(false)
    dependencies.getError.mockReturnValue(null)
    const pending = controller.useInputHere()
    expect(controller.inputTakeoverPending()).toBe(true)

    dispose()
    finishHandoff?.(true)

    await expect(pending).resolves.toBe(false)
    expect(dependencies.acquire).toHaveBeenCalledOnce()
    expect(dependencies.releaseTakeoverIfUnused).toHaveBeenCalledOnce()
  })

  it('gives back a handoff when the player changes route while it is pending', async () => {
    const audio = createAudioHarness()
    installFrameHarness(audio.context)
    dependencies.acquire.mockRejectedValueOnce(
      new Error('The microphone is open in another MercuryPitch tab.'),
    )
    dependencies.getError.mockReturnValue({
      kind: 'held-elsewhere',
      message: 'The microphone is open in another MercuryPitch tab.',
    })
    let finishHandoff: ((moved: boolean) => void) | undefined
    dependencies.takeOverFromOtherTab.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishHandoff = resolve
        }),
    )
    vi.stubGlobal('navigator', {
      ...navigator,
      requestMIDIAccess: vi.fn(async () => ({
        inputs: new Map([
          [
            'midi-guitar',
            {
              id: 'midi-guitar',
              name: 'MIDI guitar',
              state: 'connected',
              onmidimessage: null,
            },
          ],
        ]),
        onstatechange: null,
      })),
    })

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(false)
      const pending = controller.useInputHere()
      expect(controller.inputTakeoverPending()).toBe(true)

      await controller.selectInputProfile('midi')
      finishHandoff?.(true)

      await expect(pending).resolves.toBe(false)
      expect(controller.inputProfile()).toBe('midi')
      expect(dependencies.acquire).toHaveBeenCalledOnce()
      expect(dependencies.releaseTakeoverIfUnused).toHaveBeenCalledOnce()
    })
  })

  it('clears a stale MIDI-open error after a successful retry', async () => {
    const requestMIDIAccess = vi
      .fn()
      .mockRejectedValueOnce(new Error('MIDI permission was not granted.'))
      .mockResolvedValueOnce({
        inputs: new Map([
          [
            'midi-guitar',
            {
              id: 'midi-guitar',
              name: 'MIDI guitar',
              state: 'connected',
              onmidimessage: null,
            },
          ],
        ]),
        onstatechange: null,
      })
    vi.stubGlobal('navigator', { ...navigator, requestMIDIAccess })
    const audio = createAudioHarness()

    await withController(audio.context, async (controller) => {
      await controller.selectInputProfile('midi')
      expect(controller.midiConnectionStatus()).toBe('error')
      expect(controller.error()).toBe('MIDI permission was not granted.')

      await expect(controller.refreshMidiInputs()).resolves.toBe(true)
      expect(controller.midiConnectionStatus()).toBe('ready')
      expect(controller.midiInputs()).toEqual([
        { id: 'midi-guitar', label: 'MIDI guitar' },
      ])
      expect(controller.error()).toBeNull()
    })
  })

  it('releases a successful handoff when the room audio clock cannot start', async () => {
    const audio = createAudioHarness()
    installFrameHarness(audio.context)
    const activateAudio = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    dependencies.acquire.mockRejectedValueOnce(
      new Error('The microphone is open in another MercuryPitch tab.'),
    )
    dependencies.getError.mockReturnValue({
      kind: 'held-elsewhere',
      message: 'The microphone is open in another MercuryPitch tab.',
    })
    let dispose: () => void = () => undefined
    const controller = createRoot((rootDispose) => {
      dispose = rootDispose
      return useGuitarListeningController({
        activateAudio,
        getAudioGraph: () => ({ context: audio.context }) as never,
      })
    })

    expect(await controller.start()).toBe(false)
    expect(controller.canTakeOverInput()).toBe(true)
    expect(await controller.useInputHere()).toBe(false)
    expect(dependencies.releaseTakeoverIfUnused).toHaveBeenCalledOnce()

    dispose()
  })

  it('records the actual interface route when the saved device falls back', async () => {
    localStorage.setItem('mp.guitarNight.inputProfile', 'interface')
    localStorage.setItem('mp.guitarInputDevice', 'saved-interface')
    dependencies.listAudioInputs.mockResolvedValue([
      {
        deviceId: 'system-default',
        label: 'Built-in input',
        kind: 'audioinput',
        groupId: '',
        toJSON: () => ({}),
      },
    ])
    dependencies.acquire.mockResolvedValue({
      getAudioTracks: () => [
        {
          label: 'Built-in input',
          getSettings: () => ({ deviceId: 'system-default' }),
        },
      ],
    })
    const audio = createAudioHarness()
    installFrameHarness(audio.context)

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(true)
      expect(controller.inputProfile()).toBe('interface')
      expect(controller.selectedAudioInputId()).toBe('system-default')
      expect(controller.take()?.input).toEqual({
        kind: 'interface',
        requestedDeviceId: 'saved-interface',
        activeDeviceId: 'system-default',
        activeDeviceLabel: 'Built-in input',
      })
      expect(controller.error()).toBeNull()
      expect(controller.notice()).toContain('saved input is unavailable')
    })
  })

  it('reads calibration from the actual device behind the system default', async () => {
    dependencies.latencyByDevice.set('system-default', 37)
    dependencies.listAudioInputs.mockResolvedValue([
      {
        deviceId: 'system-default',
        label: 'Built-in input',
        kind: 'audioinput',
        groupId: '',
        toJSON: () => ({}),
      },
    ])
    dependencies.acquire.mockResolvedValue({
      getAudioTracks: () => [
        {
          label: 'Built-in input',
          getSettings: () => ({ deviceId: 'system-default' }),
        },
      ],
    })
    const audio = createAudioHarness()
    installFrameHarness(audio.context)

    await withController(audio.context, async (controller) => {
      expect(controller.selectedAudioInputId()).toBeNull()
      expect(await controller.start()).toBe(true)
      expect(controller.selectedAudioInputId()).toBeNull()
      expect(controller.latencyMs()).toBe(37)
    })
  })

  it('announces signal without a stable note as uncertain evidence', async () => {
    const audio = createAudioHarness()
    const frames = installFrameHarness(audio.context)
    dependencies.workletTap = { dispose: vi.fn() }

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(true)
      audio.setAmplitude(0.1)
      frames.run(1)
      frames.run(1.02)
      frames.run(1.04)

      expect(controller.health()).toEqual({
        state: 'uncertain',
        hint: 'Signal is present, but the note is not stable enough to name.',
      })
      controller.stop()
      expect(controller.take()?.inputHealth.states.uncertain).toBe(1)
    })
  })

  it('registers a guard that is true only while an audio take is recording', async () => {
    const audio = createAudioHarness()
    installFrameHarness(audio.context)

    await withController(audio.context, async (controller) => {
      expect(dependencies.registerRunGuard).toHaveBeenCalledWith(
        'guitar-night-listening-take',
        expect.any(Function),
      )
      expect(dependencies.runGuard?.()).toBe(false)

      expect(await controller.start()).toBe(true)
      expect(dependencies.runGuard?.()).toBe(true)

      controller.stop()
      expect(dependencies.runGuard?.()).toBe(false)
    })
  })

  it('restores the completed review when a failed calibration is cancelled', async () => {
    vi.useFakeTimers()
    const audio = createAudioHarness()
    installFrameHarness(audio.context)
    dependencies.workletTap = { dispose: vi.fn() }

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(true)
      dependencies.emitWorklet?.({
        type: 'attack',
        atFrame: 4_800,
        level: 0.2,
      })
      Object.assign(audio.context, { currentTime: 0.5 })
      controller.stop()
      const completed = controller.take()
      expect(completed?.lifecycle).toBe('completed')

      expect(await controller.start()).toBe(true)
      const calibration = controller.calibrate()
      Object.assign(audio.context, { currentTime: 7.4 })
      await vi.runAllTimersAsync()

      await expect(calibration).resolves.toBe(false)
      expect(controller.status()).toBe('listening')
      expect(controller.take()?.lifecycle).toBe('recording')
      expect(controller.notice()).toContain('clicks never came back')

      controller.cancel({ preserveNotice: true })
      expect(controller.status()).toBe('off')
      expect(controller.take()).toEqual(completed)
      expect(controller.error()).toBeNull()
      expect(controller.notice()).toContain('clicks never came back')
    })
  })

  it('keeps calibration returns out of the active take', async () => {
    vi.useFakeTimers()
    const audio = createAudioHarness()
    installFrameHarness(audio.context)
    dependencies.workletTap = { dispose: vi.fn() }

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(true)
      const calibration = controller.calibrate()

      dependencies.emitWorklet?.({
        type: 'attack',
        atFrame: 4_800,
        level: 0.25,
      })
      expect(controller.events()).toEqual([])

      controller.stop()
      await expect(calibration).resolves.toBe(false)
    })
  })

  it('starts a clean take with the newly calibrated latency', async () => {
    vi.useFakeTimers()
    localStorage.setItem('mp.guitarInputDevice', 'missing-device')
    dependencies.acquire.mockResolvedValueOnce({
      getAudioTracks: () => [
        {
          label: 'Fallback input',
          getSettings: () => ({ deviceId: 'system-default' }),
        },
      ],
    })
    const audio = createAudioHarness()
    installFrameHarness(audio.context)
    dependencies.workletTap = { dispose: vi.fn() }

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(true)
      const previousTakeId = controller.take()?.id
      const calibration = controller.calibrate()

      for (let click = 0; click < 8; click += 1) {
        const returnAt = 1 + click * 0.75 + 0.08
        dependencies.emitWorklet?.({
          type: 'attack',
          atFrame: Math.round(returnAt * 48_000),
          level: 0.25,
        })
      }
      Object.assign(audio.context, { currentTime: 7.4 })
      await vi.runAllTimersAsync()

      await expect(calibration).resolves.toBe(true)
      expect(dependencies.setLatencyMeasurement).toHaveBeenCalledWith(
        'system-default',
        80,
        0,
      )
      expect(controller.take()?.id).not.toBe(previousTakeId)
      expect(controller.take()?.clock.latency).toEqual({
        seconds: 0.08,
        frames: 3_840,
        provenance: 'stored-round-trip',
        uncertaintySeconds: 0,
      })
      expect(controller.events()).toEqual([])

      dependencies.emitWorklet?.({
        type: 'attack',
        atFrame: Math.round(7.6 * 48_000),
        level: 0.2,
      })
      expect(controller.events()[0]?.rawTransportFrame).toBe(9_600)
      expect(controller.events()[0]?.compensatedTransportFrame).toBe(5_760)
    })
  })

  it('rotates Clear take without turning Listening off', async () => {
    const audio = createAudioHarness()
    installFrameHarness(audio.context)
    dependencies.workletTap = { dispose: vi.fn() }

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(true)
      dependencies.emitWorklet?.({
        type: 'attack',
        atFrame: 4_800,
        level: 0.2,
      })
      const firstEventId = controller.events()[0]?.id

      Object.assign(audio.context, { currentTime: 0.25 })
      controller.clearTake()
      expect(controller.status()).toBe('listening')
      expect(controller.events()).toEqual([])

      dependencies.emitWorklet?.({
        type: 'attack',
        atFrame: 14_400,
        level: 0.24,
      })
      expect(controller.events()).toHaveLength(1)
      expect(controller.events()[0]?.id).not.toBe(firstEventId)
      expect(controller.events()[0]?.rawTransportFrame).toBe(2_400)
      expect(controller.events()[0]?.compensatedTransportFrame).toBe(2_400)
    })
  })

  it('cancels calibration clicks and its timeout when Listening stops', async () => {
    vi.useFakeTimers()
    const audio = createAudioHarness()
    installFrameHarness(audio.context)
    dependencies.workletTap = { dispose: vi.fn() }

    await withController(audio.context, async (controller) => {
      expect(await controller.start()).toBe(true)
      const calibration = controller.calibrate()
      expect(controller.status()).toBe('calibrating')
      expect(audio.oscillators.length).toBeGreaterThan(0)
      expect(vi.getTimerCount()).toBe(1)

      controller.stop()

      expect(controller.status()).toBe('off')
      expect(vi.getTimerCount()).toBe(0)
      for (const oscillator of audio.oscillators) {
        expect(oscillator.stop).toHaveBeenCalledTimes(2)
        expect(oscillator.disconnect).toHaveBeenCalledOnce()
      }
      await expect(calibration).resolves.toBe(false)
    })
  })
})
