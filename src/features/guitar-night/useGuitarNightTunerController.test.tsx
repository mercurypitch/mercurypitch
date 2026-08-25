// Guitar Night tuner controller tests keep capture, reference sound, and room state coordinated.
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import { standardTuning } from '@/lib/guitar/instrument-tuning'
import type { GuitarTunerListeningPort } from './useGuitarNightTunerController'
import { useGuitarNightTunerController } from './useGuitarNightTunerController'

const voices = vi.hoisted(() => ({
  connect: vi.fn(),
  dispose: vi.fn(),
  createGuitar: vi.fn(),
  createBass: vi.fn(),
}))

vi.mock('@/lib/guitar/guitar-synth', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    createGuitarVoice: (...args: unknown[]) => {
      voices.createGuitar(...args)
      return { gain: { connect: voices.connect }, dispose: voices.dispose }
    },
    createBassVoice: (...args: unknown[]) => {
      voices.createBass(...args)
      return { gain: { connect: voices.connect }, dispose: voices.dispose }
    },
  }
})

function createListeningHarness() {
  const [status, setStatus] =
    createSignal<ReturnType<GuitarTunerListeningPort['status']>>('off')
  const [profile, setProfile] =
    createSignal<GuitarInputProfileKind>('microphone')
  const [frequency, setFrequency] = createSignal<number | null>(null)
  const [clarity, setClarity] = createSignal(0)
  const [revision, setRevision] = createSignal(0)
  const [canTakeOverInput, setCanTakeOverInput] = createSignal(false)
  const [inputTakeoverPending, setInputTakeoverPending] = createSignal(false)
  const start = vi.fn(
    async (options?: { purpose?: 'performance' | 'tuner' }) => {
      void options
      setStatus('listening')
      return true
    },
  )
  const cancel = vi.fn(() => {
    setStatus('off')
    setCanTakeOverInput(false)
  })
  const selectInputProfile = vi.fn(async (next: GuitarInputProfileKind) => {
    setProfile(next)
    setStatus('off')
  })
  return {
    port: {
      status,
      error: () => null,
      canTakeOverInput,
      inputTakeoverPending,
      inputProfile: profile,
      detectedFrequency: frequency,
      clarity,
      pitchRevision: revision,
      start,
      cancel,
      selectInputProfile,
    } satisfies GuitarTunerListeningPort,
    setStatus,
    setProfile,
    setFrequency,
    setClarity,
    setInputTakeover(canTakeOver: boolean, pending = canTakeOver) {
      setCanTakeOverInput(canTakeOver)
      setInputTakeoverPending(pending)
    },
    pushReading(nextFrequency: number, nextClarity = 0.9) {
      setFrequency(nextFrequency)
      setClarity(nextClarity)
      setRevision((value) => value + 1)
    },
    clearReading() {
      setFrequency(null)
      setClarity(0)
      setRevision(0)
    },
  }
}

function withController(
  run: (
    controller: ReturnType<typeof useGuitarNightTunerController>,
    listening: ReturnType<typeof createListeningHarness>,
    pause: ReturnType<typeof vi.fn>,
    activate: ReturnType<typeof vi.fn>,
    onTuning: ReturnType<typeof vi.fn>,
  ) => void | Promise<void>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    createRoot((dispose) => {
      const listening = createListeningHarness()
      const [tuning, setTuning] = createSignal(standardTuning('guitar'))
      const pause = vi.fn()
      const activate = vi.fn(async () => true)
      const onTuning = vi.fn((next) => setTuning(next))
      const guide = {}
      const controller = useGuitarNightTunerController({
        tuning,
        listening: listening.port,
        activateAudio: activate,
        getAudioGraph: () =>
          ({ context: { currentTime: 0 }, buses: { guide } }) as never,
        pausePlayback: pause,
        onTuning,
      })
      void Promise.resolve(
        run(controller, listening, pause, activate, onTuning),
      )
        .then(() => {
          dispose()
          resolve()
        })
        .catch((error: unknown) => {
          dispose()
          reject(error)
        })
    })
  })
}

describe('useGuitarNightTunerController', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('opens silently and starts the long-window tuner only from its action', async () => {
    await withController(async (controller, listening, pause, activate) => {
      controller.prepare()
      expect(pause).toHaveBeenCalledOnce()
      expect(activate).not.toHaveBeenCalled()
      expect(listening.port.start).not.toHaveBeenCalled()

      expect(await controller.startListening()).toBe(true)
      expect(listening.port.start).toHaveBeenCalledWith({ purpose: 'tuner' })
    })
  })

  it('requires an audio route rather than pretending MIDI measures tuning', async () => {
    await withController(async (controller, listening) => {
      listening.setProfile('midi')

      expect(await controller.startListening()).toBe(false)
      expect(controller.error()).toBe(
        'Choose Room mic or Direct input to measure tuning.',
      )
      expect(listening.port.start).not.toHaveBeenCalled()
    })
  })

  it('parks capture for a reference and resumes the listening session afterward', async () => {
    vi.useFakeTimers()
    await withController(async (controller, listening, pause, activate) => {
      listening.setStatus('listening')

      expect(await controller.playReference(5)).toBe(true)

      expect(listening.port.cancel).toHaveBeenCalledBefore(activate)
      expect(pause).toHaveBeenCalled()
      expect(voices.createGuitar).toHaveBeenCalledOnce()
      expect(voices.connect).toHaveBeenCalledOnce()
      expect(controller.referenceStringIndex()).toBe(5)
      expect(controller.listeningWillResume()).toBe(true)

      await vi.advanceTimersByTimeAsync(2_200)

      expect(controller.referenceStringIndex()).toBeNull()
      expect(controller.listeningWillResume()).toBe(false)
      expect(listening.port.start).toHaveBeenCalledWith({ purpose: 'tuner' })
      expect(controller.isListening()).toBe(true)
    })
  })

  it('keeps capture active while changing target mode or manual string', async () => {
    await withController((controller, listening) => {
      listening.setStatus('listening')

      controller.selectTarget(5)
      controller.selectTarget(null)

      expect(listening.port.cancel).not.toHaveBeenCalled()
      expect(controller.isListening()).toBe(true)
    })
  })

  it('restores an enabled tuner after changing its physical input route', async () => {
    await withController(async (controller, listening) => {
      listening.setStatus('listening')

      await controller.selectInputProfile('interface')

      expect(listening.port.selectInputProfile).toHaveBeenCalledWith(
        'interface',
      )
      expect(listening.port.start).toHaveBeenCalledWith({ purpose: 'tuner' })
      expect(controller.isListening()).toBe(true)
    })
  })

  it('leaves an enabled tuner alone when its selected route is tapped again', async () => {
    await withController(async (controller, listening) => {
      listening.setStatus('listening')

      await controller.selectInputProfile('microphone')

      expect(listening.port.selectInputProfile).not.toHaveBeenCalled()
      expect(listening.port.cancel).not.toHaveBeenCalled()
      expect(listening.port.start).not.toHaveBeenCalled()
      expect(controller.isListening()).toBe(true)
    })
  })

  it('does not restart a route change after the player stops listening', async () => {
    await withController(async (controller, listening) => {
      let finishRouteChange!: () => void
      const routeChange = new Promise<void>((resolve) => {
        finishRouteChange = resolve
      })
      listening.port.selectInputProfile.mockReturnValueOnce(routeChange)
      listening.setStatus('listening')

      const pendingRouteChange = controller.selectInputProfile('interface')
      expect(controller.listeningWillResume()).toBe(true)

      controller.stopListening()
      finishRouteChange()
      await pendingRouteChange

      expect(controller.listeningWillResume()).toBe(false)
      expect(listening.port.start).not.toHaveBeenCalled()
    })
  })

  it('does not restart capture when the player stops during a reference', async () => {
    vi.useFakeTimers()
    await withController(async (controller, listening) => {
      listening.setStatus('listening')
      await controller.playReference(5)

      controller.stopListening()
      await vi.advanceTimersByTimeAsync(2_200)

      expect(controller.listeningWillResume()).toBe(false)
      expect(listening.port.start).not.toHaveBeenCalled()
    })
  })

  it('silently abandons a reference request cancelled during audio activation', async () => {
    await withController(async (controller, _listening, _pause, activate) => {
      let finishActivation!: (activated: boolean) => void
      const activation = new Promise<boolean>((resolve) => {
        finishActivation = resolve
      })
      activate.mockReturnValueOnce(activation)

      const pendingReference = controller.playReference(5)
      controller.stopReferenceTone()
      finishActivation(true)

      expect(await pendingReference).toBe(false)
      expect(controller.error()).toBeNull()
      expect(voices.createGuitar).not.toHaveBeenCalled()
      expect(controller.referenceStringIndex()).toBeNull()
    })
  })

  it('invalidates a pending cross-tab handoff before sounding a reference', async () => {
    await withController(async (controller, listening, _pause, activate) => {
      listening.setStatus('error')
      listening.setInputTakeover(true)

      expect(await controller.playReference(5)).toBe(true)

      expect(listening.port.cancel).toHaveBeenCalledBefore(activate)
      expect(listening.port.canTakeOverInput()).toBe(false)
    })
  })

  it('keeps legacy presets truthful in the stage tuning', async () => {
    await withController(
      (controller, _listening, _pause, _activate, onTuning) => {
        controller.selectPreset('Drop D')

        expect(onTuning).toHaveBeenCalledOnce()
        expect(controller.tuningName()).toBe('Drop D')
        expect(controller.targets()[5]?.targetMidi).toBe(38)
      },
    )
  })

  it('locks a string ready only after stable in-tune readings', async () => {
    await withController(async (controller, listening) => {
      await Promise.resolve()
      const lowE = controller.targets()[5]
      for (let index = 0; index < 5; index += 1) {
        listening.pushReading(lowE.targetHz)
      }
      expect(controller.readyStringIndices()).toEqual([])

      listening.pushReading(lowE.targetHz)
      expect(controller.readyStringIndices()).toEqual([5])
    })
  })

  it('keeps direction evidence outside Auto without claiming target acquisition', async () => {
    await withController(async (controller, listening) => {
      const lowE = controller.targets()[5]
      listening.pushReading(lowE.targetHz * 2 ** (88 / 1200))

      expect(controller.reading()).toBeNull()
      expect(controller.manualTargetIndex()).toBeNull()
      expect(controller.evidenceReading()).toMatchObject({
        stringIndex: 5,
      })
      expect(controller.evidenceReading()?.centsDeviation).toBeCloseTo(88, 5)
      expect(controller.readyStringIndices()).toEqual([])
    })
  })

  it('requires consecutive readings again after the string falls silent', async () => {
    await withController(async (controller, listening) => {
      await Promise.resolve()
      const lowE = controller.targets()[5]
      for (let index = 0; index < 4; index += 1) {
        listening.pushReading(lowE.targetHz)
      }
      listening.clearReading()
      for (let index = 0; index < 2; index += 1) {
        listening.pushReading(lowE.targetHz)
      }

      expect(controller.readyStringIndices()).toEqual([])
    })
  })

  it('closes without resuming playback and restores the previous review', async () => {
    await withController((controller, listening) => {
      listening.setStatus('listening')
      controller.close()

      expect(listening.port.cancel).toHaveBeenCalledOnce()
      expect(controller.isListening()).toBe(false)
    })
  })
})
