// ============================================================
// Seek-then-play regression tests (piano + guitar controllers).
// Clicking the progress bar while stopped, then pressing Play,
// used to snap the playhead back to 0 — the seeked position is
// now consumed as the start position.
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFallingNotesController } from '@/features/falling-notes/useFallingNotesController'
import { useGuitarPracticeController } from '@/features/guitar-practice/useGuitarPracticeController'
import type { AudioEngine } from '@/lib/audio-engine'
import { micManager } from '@/lib/mic-manager'
import type { FallingNote } from '@/stores/falling-notes-store'
import { countIn, setCountIn } from '@/stores/transport-store'

const mockAudioEngine = () =>
  ({
    init: () => Promise.resolve(),
    resume: () => Promise.resolve(),
    getAudioContext: () => null,
    getSampleRate: () => 44100,
    getBufferSize: () => 2048,
    getTimeData: () => new Float32Array(2048),
    playMetronomeClick: () => {},
    playClick: () => {},
    playNote: () => Promise.resolve(undefined),
    setInstrument: () => {},
    stopAllNotes: () => {},
    stopMic: () => {},
    stopTone: () => {},
    isMicActive: () => false,
    onMicLost: () => () => {},
    audioCtx: null,
  }) as unknown as AudioEngine

const guitarControllerDeps = (audioEngine: AudioEngine) => ({
  audioEngine,
  countIn,
  setMicActive: () => undefined,
  updateMidiSongSelection: () => undefined,
})

const pianoNotes: FallingNote[] = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  midi: 60 + (i % 12),
  name: 'C4',
  startBeat: i,
  duration: 1,
  targetFreq: 261.6,
}))

// NOTE: the guitar controller's startGame() reads fallingNotes(), which is
// derived from baseNotes in a createEffect — and Solid effects do not fire
// inside createRoot in vitest/jsdom (see exercise-recursion-repro.test.ts).
// The guitar path shares the exact pending-seek pattern tested here for the
// piano controller and is verified live in the browser instead.

describe('piano: seek while stopped then play', () => {
  beforeEach(() => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('startGame begins at the seeked beat instead of 0', async () => {
    await createRoot(async (dispose) => {
      setCountIn(0)
      const ctl = useFallingNotesController(mockAudioEngine())
      ctl.loadSong(pianoNotes, 'Seek Test', 120)
      ctl.seekToBeat(8)
      await ctl.startGame()
      expect(ctl.gameState()).toBe('playing')
      // The rAF loop may tick between start and assert — allow drift forward.
      expect(ctl.playheadBeat()).toBeGreaterThanOrEqual(7.5)
      expect(ctl.playheadBeat()).toBeLessThan(10)
      dispose()
    })
  })

  it('stop clears the pending position: play starts from 0 again', async () => {
    await createRoot(async (dispose) => {
      setCountIn(0)
      const ctl = useFallingNotesController(mockAudioEngine())
      ctl.loadSong(pianoNotes, 'Seek Test', 120)
      ctl.seekToBeat(8)
      ctl.resetGame()
      await ctl.startGame()
      expect(ctl.playheadBeat()).toBeLessThan(2)
      dispose()
    })
  })
})

describe('guitar: seek while stopped', () => {
  it('seekToBeat while idle moves the playhead and stop resets it', () => {
    createRoot((dispose) => {
      setCountIn(0)
      const ctl = useGuitarPracticeController(
        guitarControllerDeps(mockAudioEngine()),
      )
      ctl.loadSong(
        Array.from({ length: 16 }, (_, i) => ({
          midi: 52 + (i % 12),
          startBeat: i,
          duration: 1,
        })),
        'Seek Test',
        120,
      )
      ctl.seekToBeat(8)
      expect(ctl.playheadBeat()).toBe(8)
      ctl.stopGame()
      expect(ctl.playheadBeat()).toBe(0)
      dispose()
    })
  })

  it('unregisters its mic run guard when the controller is disposed', () => {
    const unregister = vi.fn()
    const register = vi
      .spyOn(micManager, 'registerRunGuard')
      .mockReturnValue(unregister)
    let disposeController = () => {}

    createRoot((dispose) => {
      disposeController = dispose
      useGuitarPracticeController(guitarControllerDeps(mockAudioEngine()))
    })

    expect(register).toHaveBeenCalledWith('guitar-song', expect.any(Function))
    expect(unregister).not.toHaveBeenCalled()
    disposeController()
    expect(unregister).toHaveBeenCalledTimes(1)
    register.mockRestore()
  })

  it('releases a mic start that resolves after controller disposal', async () => {
    let resolveStart = (_started: boolean) => {}
    const audio = mockAudioEngine()
    const stopMic = vi.fn()
    audio.startMic = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveStart = resolve
        }),
    )
    audio.stopMic = stopMic
    let disposeController = () => {}
    let controller!: ReturnType<typeof useGuitarPracticeController>

    createRoot((dispose) => {
      disposeController = dispose
      controller = useGuitarPracticeController(guitarControllerDeps(audio))
    })

    const starting = controller.startMic()
    disposeController()
    resolveStart(true)

    await expect(starting).resolves.toBe(false)
    // Once during unconditional teardown, then again when the late acquire
    // resolves successfully after its owner is already gone.
    expect(stopMic).toHaveBeenCalledTimes(2)
  })

  it('releases a mic start that resolves after an explicit stop', async () => {
    let resolveStart = (_started: boolean) => {}
    const audio = mockAudioEngine()
    const stopMic = vi.fn()
    audio.startMic = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveStart = resolve
        }),
    )
    audio.stopMic = stopMic
    let disposeController = () => {}
    let controller!: ReturnType<typeof useGuitarPracticeController>

    createRoot((dispose) => {
      disposeController = dispose
      controller = useGuitarPracticeController(guitarControllerDeps(audio))
    })

    const starting = controller.startMic()
    controller.stopMic()
    resolveStart(true)

    await expect(starting).resolves.toBe(false)
    expect(controller.isMicActive()).toBe(false)
    expect(stopMic).toHaveBeenCalledTimes(2)
    disposeController()
  })

  it('adopts a pending physical start for a newer mic claim', async () => {
    let resolveStart = (_started: boolean) => {}
    const audio = mockAudioEngine()
    const stopMic = vi.fn()
    audio.startMic = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveStart = resolve
        }),
    )
    audio.stopMic = stopMic
    let disposeController = () => {}
    let controller!: ReturnType<typeof useGuitarPracticeController>

    createRoot((dispose) => {
      disposeController = dispose
      controller = useGuitarPracticeController(guitarControllerDeps(audio))
    })

    const staleStart = controller.startMic()
    controller.stopMic()
    const currentStart = controller.startMic()

    expect(audio.startMic).toHaveBeenCalledTimes(1)
    resolveStart(true)
    await expect(staleStart).resolves.toBe(false)
    await expect(currentStart).resolves.toBe(true)
    expect(controller.isMicActive()).toBe(true)
    expect(stopMic).toHaveBeenCalledTimes(1)
    disposeController()
  })

  it('keeps the mic inactive when a replacement claim shares a failed start', async () => {
    let resolveStart = (_started: boolean) => {}
    const audio = mockAudioEngine()
    const stopMic = vi.fn()
    audio.startMic = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveStart = resolve
        }),
    )
    audio.stopMic = stopMic
    let disposeController = () => {}
    let controller!: ReturnType<typeof useGuitarPracticeController>

    createRoot((dispose) => {
      disposeController = dispose
      controller = useGuitarPracticeController(guitarControllerDeps(audio))
    })

    const staleStart = controller.startMic()
    controller.stopMic()
    const currentStart = controller.startMic()

    expect(audio.startMic).toHaveBeenCalledTimes(1)
    resolveStart(false)
    await expect(staleStart).resolves.toBe(false)
    await expect(currentStart).resolves.toBe(false)
    expect(controller.isMicActive()).toBe(false)
    expect(stopMic).toHaveBeenCalledTimes(1)
    disposeController()
    expect(stopMic).toHaveBeenCalledTimes(2)
  })
})
