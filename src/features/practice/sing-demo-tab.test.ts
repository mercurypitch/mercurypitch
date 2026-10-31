// While Merc sings through the Sing tab (sing-demo-host.ts), the tab's own
// controllers follow him: the frame loop draws his pitch at the transport's
// beat and leaves the mic and its detector alone, Play plays his melody and
// not the library's, and Stop keeps nothing (no session saved, no result).

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlaybackController } from '@/features/playback/usePlaybackController'
import type { RecordingController } from '@/features/recording/useRecordingController'
import { PLAYBACK_MODE_ONCE } from '@/features/tabs/constants'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { melodyStore } from '@/stores/melody-store'
import type { MelodyItem, PitchResult } from '@/types'
import { setSingDemo } from './sing-demo-host'
import { usePracticeController } from './usePracticeController'

vi.mock('@/lib/audio-unlock', () => ({
  activateAudioPlayback: async () => {},
}))

const MERC: PitchResult = {
  freq: 216,
  frequency: 216,
  midi: 56.7,
  note: 'A3',
  noteName: 'A',
  targetMidi: 57,
  targetNote: 'A3',
  cents: -30,
  clarity: 1,
  octave: 3,
}

const DEMO_MELODY: MelodyItem[] = [
  {
    id: -300000,
    note: { midi: 57, name: 'A', octave: 3, freq: 220 },
    startBeat: 0,
    duration: 1,
  },
]

let frames: FrameRequestCallback[]

beforeEach(() => {
  frames = []
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    }),
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  setSingDemo(null)
  vi.unstubAllGlobals()
})

describe('the frame loop, while Merc sings', () => {
  function mount() {
    const [playing, setPlaying] = createSignal(true)
    let beat = 2.25
    const practiceEngine = {
      addCallbacks: vi.fn(),
      update: vi.fn().mockReturnValue(null),
      isMicActive: vi.fn().mockReturnValue(true),
      getWaveformData: vi.fn().mockReturnValue(new Float32Array(8)),
      stopMic: vi.fn(),
    } as unknown as PracticeEngine
    const runtime = {
      on: vi.fn(),
      getCurrentBeat: () => beat,
    } as unknown as PlaybackRuntime
    const recording = {
      processPitchFrame: vi.fn(),
    } as unknown as RecordingController
    const audioEngine = {
      getFrequencyData: vi.fn(),
      getBpm: () => 60,
    } as unknown as AudioEngine
    let dispose!: () => void
    const controller = createRoot((rootDispose) => {
      dispose = rootDispose
      return usePracticeController({
        audioEngine,
        playbackRuntime: runtime,
        practiceEngine,
        recording,
        isPlaying: playing,
        isPaused: () => false,
        editorIsPlaying: () => false,
        singingOnScreen: () => true,
      })
    })
    const frame = (): void => {
      const next = frames.shift()
      expect(next).toBeDefined()
      next?.(16)
    }
    return {
      controller,
      dispose,
      practiceEngine,
      recording,
      frame,
      setPlaying,
      setBeat: (to: number) => {
        beat = to
      },
    }
  }

  it("draws his pitch at the transport's beat, and leaves the mic's detector and listeners alone", () => {
    const tab = mount()
    const listener = vi.fn()
    tab.controller.subscribeFrames(listener)
    const pitchAt = vi.fn((beat: number) => (beat < 3 ? MERC : null))
    setSingDemo({ melody: DEMO_MELODY, pitchAt })

    tab.frame()

    expect(pitchAt).toHaveBeenCalledWith(2.25)
    expect(tab.controller.pitchHistory()).toEqual([
      { freq: 216, time: 2.25, cents: -30 },
    ])
    expect(tab.controller.currentPitch()).toBe(MERC)
    expect(tab.practiceEngine.update).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
    expect(tab.recording.processPitchFrame).not.toHaveBeenCalled()

    // a rest closes his line with one gap, however long it lasts
    tab.setBeat(3.5)
    tab.frame()
    tab.frame()
    expect(tab.controller.pitchHistory()).toEqual([
      { freq: 216, time: 2.25, cents: -30 },
      { freq: null, time: 3.5 },
    ])
    tab.dispose()
  })

  it('draws nothing once the transport stops, and gives the frame back to the mic when he is done', () => {
    const tab = mount()
    setSingDemo({ melody: DEMO_MELODY, pitchAt: () => MERC })
    tab.setPlaying(false)

    tab.frame()
    expect(tab.controller.pitchHistory()).toEqual([])
    expect(tab.controller.currentPitch()).toBeNull()

    setSingDemo(null)
    tab.frame()
    expect(tab.practiceEngine.update).toHaveBeenCalledOnce()
    tab.dispose()
  })
})

describe('the transport, while Merc sings', () => {
  function mount(keeps: boolean) {
    const played: MelodyItem[][] = []
    const endPracticeSession = vi.fn(() => null)
    const setPracticeResult = vi.fn()
    const practiceEngine = {
      startSession: vi.fn(),
      // a run that scored notes, had anyone scored it
      endSession: vi.fn(() => [{ score: 50 }]),
      calculatePracticeResult: vi.fn(() => ({ score: 50 })),
    } as unknown as PracticeEngine
    const runtime = {
      stop: vi.fn(),
      start: vi.fn(),
      setMelody: (items: MelodyItem[]) => played.push(items),
      setDurationBeats: vi.fn(),
      getBPM: () => 60,
      on: vi.fn(),
    } as unknown as PlaybackRuntime
    const controller = createRoot(() =>
      usePlaybackController({
        audioEngine: {
          stopTone: vi.fn(),
          stopAllNotes: vi.fn(),
        } as unknown as AudioEngine,
        playbackRuntime: runtime,
        practiceEngine,
        playMode: () => PLAYBACK_MODE_ONCE,
        setPlayMode: vi.fn() as never,
        practiceSubMode: () => 'all',
        setPitchHistory: vi.fn() as never,
        setNoteResults: vi.fn() as never,
        setPracticeResult: setPracticeResult as never,
        setLiveScore: vi.fn() as never,
        closeSidebar: vi.fn(),
        filterMelodyForPractice: (melody) => melody,
        buildSessionPlaybackMelody: (() => ({
          items: [],
          durationBeats: 0,
        })) as never,
        buildScaleMelody: vi.fn(),
        isRecording: () => false,
        finalizeRecording: vi.fn(),
        totalBeats: () => 0,
        endPracticeSession,
        setShouldAutoStartPlayback: vi.fn() as never,
        melodyOverride: () => (keeps ? null : DEMO_MELODY),
        keepsRun: () => keeps,
      }),
    )
    return { controller, played, endPracticeSession, setPracticeResult }
  }

  it("plays his melody, not the library's, and writes nothing to it", () => {
    const library = [...melodyStore.items()]
    const write = vi.spyOn(melodyStore, 'setMelody')
    const tab = mount(false)

    tab.controller.handlePlay()

    expect(tab.played).toEqual([DEMO_MELODY])
    expect(tab.played[0]).not.toBe(DEMO_MELODY)
    expect(write).not.toHaveBeenCalled()
    expect(melodyStore.items()).toEqual(library)
    expect(tab.controller.activePlaybackItems()).toEqual(DEMO_MELODY)
  })

  it('keeps nothing when his run stops: no session saved, no result', async () => {
    const tab = mount(false)
    tab.controller.handlePlay()
    frames.splice(0)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(16)
      return 1
    })

    await tab.controller.handleStop()

    expect(tab.endPracticeSession).not.toHaveBeenCalled()
    expect(tab.setPracticeResult).not.toHaveBeenCalledWith(
      expect.objectContaining({ score: 50 }),
    )
  })

  it("still keeps a singer's run as it always has", async () => {
    const tab = mount(true)
    tab.controller.handlePlay()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(16)
      return 1
    })

    await tab.controller.handleStop()

    expect(tab.endPracticeSession).toHaveBeenCalledOnce()
    expect(tab.setPracticeResult).toHaveBeenCalledWith(
      expect.objectContaining({ score: 50 }),
    )
  })
})
