// Listening runtime regressions cover coarse attacks and calibration teardown.
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  setLatency: vi.fn(),
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
  micLatencyMs: () => 0,
  micLatencySec: () => 0,
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
    dependencies.acquire.mockResolvedValue({})
    dependencies.connectWorklet.mockImplementation(
      async () => dependencies.workletTap,
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
