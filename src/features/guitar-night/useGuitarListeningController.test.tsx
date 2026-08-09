// Listening runtime regressions cover coarse attacks and calibration teardown.
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarInputWorkletMessage } from '@/lib/guitar/input-events'
import { useGuitarListeningController } from './useGuitarListeningController'

const dependencies = vi.hoisted(() => ({
  acquire: vi.fn(),
  release: vi.fn(),
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
  setLatency: vi.fn<(milliseconds: number) => void>(),
}))

vi.mock('@/lib/guitar/guitar-input-node', () => ({
  connectGuitarInputWorklet: dependencies.connectWorklet,
}))

vi.mock('@/lib/mic-manager', () => ({
  micManager: {
    acquire: dependencies.acquire,
    release: dependencies.release,
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

vi.mock('@/stores/mic-latency-store', () => ({
  micLatencyMs: () => dependencies.latencyMs,
  micLatencySec: () => dependencies.latencyMs / 1000,
  setMicLatencyMs: dependencies.setLatency,
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
    dependencies.detections = []
    dependencies.workletTap = null
    dependencies.emitWorklet = null
    dependencies.latencyMs = 0
    dependencies.setLatency.mockImplementation((milliseconds: number) => {
      dependencies.latencyMs = milliseconds
    })
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
      expect(dependencies.setLatency).toHaveBeenCalledWith(80)
      expect(controller.take()?.id).not.toBe(previousTakeId)
      expect(controller.take()?.clock.latency).toEqual({
        seconds: 0.08,
        frames: 3_840,
        provenance: 'stored-round-trip',
        uncertaintySeconds: null,
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
