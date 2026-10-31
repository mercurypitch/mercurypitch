// ============================================================
// Falling Notes controller persistence regressions
// ============================================================
//
// Canonical Piano compatibility songs must keep IndexedDB as their authority
// when the status-bar mute controls update the in-memory song projection.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from '@/lib/audio-engine'
import type * as AudioUnlock from '@/lib/audio-unlock'
import { resetFirstValueForTests } from '@/lib/first-value'
import { GUIDE_FUNNEL_STORAGE_KEY } from '@/lib/guide-funnel'
import type { MidiSongTrack } from '@/lib/midi-song'
import type { FallingNote } from '@/stores/falling-notes-store'
import { setGameState, setHitResults } from '@/stores/falling-notes-store'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import { setBpm, setCountIn } from '@/stores/transport-store'
import { useFallingNotesController } from './useFallingNotesController'

const persistPianoCompatibilitySelection = vi.hoisted(() =>
  vi.fn(async () => undefined),
)

vi.mock('@/features/piano-project/import-piano-project-for-legacy', () => ({
  persistPianoCompatibilitySelection,
}))

// jsdom cannot play the silent unlock clip; the unlock is a browser edge.
vi.mock('@/lib/audio-unlock', async (importOriginal) => ({
  ...(await importOriginal<typeof AudioUnlock>()),
  activateAudioPlayback: vi.fn(async () => undefined),
}))

function mockAudioEngine(): AudioEngine {
  return {
    getAudioContext: () => null,
    init: async () => undefined,
    getBufferSize: () => 2048,
    getInputLevel: () => 0,
    getSampleRate: () => 44_100,
    getTimeData: () => new Float32Array(2048),
    isMicActive: () => false,
    onMicLost: () => () => undefined,
    playClick: () => undefined,
    playMetronomeClick: () => undefined,
    playNote: async () => undefined,
    playTone: async () => undefined,
    resume: async () => undefined,
    setInstrument: () => undefined,
    stopAllNotes: () => undefined,
    stopMic: () => undefined,
    stopTone: () => undefined,
  } as unknown as AudioEngine
}

function track(id: string): MidiSongTrack {
  return {
    id,
    kind: 'pitched',
    name: id,
    instrumentName: 'Acoustic Grand Piano',
    noteCount: 1,
    notes: [{ midi: 60, startBeat: 0, duration: 1 }],
  }
}

beforeEach(() => {
  localStorage.clear()
  resetFirstValueForTests()
  setHitResults([])
})

afterEach(() => {
  persistPianoCompatibilitySelection.mockClear()
  localStorage.clear()
})

describe('useFallingNotesController track persistence', () => {
  it('routes a canonical backing-track mute through its declared authority', async () => {
    const song: SavedMidiSong = {
      id: 'project-canonical',
      name: 'Canonical study',
      bpm: 96,
      tracks: [track('score'), track('backing-one'), track('backing-two')],
      persistenceAuthority: 'piano-project',
      scoreTrackId: 'score',
      backingTrackIds: ['backing-one', 'backing-two'],
      importedAt: Date.now(),
    }

    let dispose: () => void = () => undefined
    let controller!: ReturnType<typeof useFallingNotesController>
    createRoot((rootDispose) => {
      dispose = rootDispose
      controller = useFallingNotesController(mockAudioEngine())
      controller.loadSong([], song.name, song.bpm, [], [], song)
      controller.toggleTrackMute('backing-one')
    })

    expect(controller.mutedTrackIds()).toEqual(new Set(['backing-one']))
    expect(controller.currentSong()).toMatchObject({
      id: song.id,
      persistenceAuthority: 'piano-project',
      scoreTrackId: 'score',
      backingTrackIds: ['backing-two'],
    })
    await vi.waitFor(() => {
      expect(persistPianoCompatibilitySelection).toHaveBeenCalledWith(
        expect.objectContaining({
          id: song.id,
          persistenceAuthority: 'piano-project',
          scoreTrackId: 'score',
          backingTrackIds: ['backing-two'],
        }),
      )
    })
    expect(localStorage.getItem('pitchperfect_guitar_songs')).toBeNull()
    dispose()
  })
})

describe('useFallingNotesController first value', () => {
  const sentFunnelEvents = (): string[] =>
    (
      JSON.parse(localStorage.getItem(GUIDE_FUNNEL_STORAGE_KEY) ?? '[]') as {
        event: string
      }[]
    ).map((e) => e.event)

  // One scored note, C4 on the first beat, at 60 bpm: a beat is a second.
  const NOTE: FallingNote = {
    id: 0,
    midi: 60,
    name: 'C4',
    startBeat: 1,
    duration: 1,
    targetFreq: 261.63,
  }

  let nowMs = 0
  let frame: FrameRequestCallback | null = null
  let controller!: ReturnType<typeof useFallingNotesController>
  let dispose: () => void = () => undefined

  /** Move the clock to `ms` and run one animation frame. */
  const frameAt = (ms: number): void => {
    nowMs = ms
    const callback = frame
    frame = null
    callback?.(ms)
  }

  beforeEach(() => {
    nowMs = 1_000
    frame = null
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frame = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
      frame = null
    })
    setCountIn(0)
    setBpm(60)
    createRoot((rootDispose) => {
      dispose = rootDispose
      controller = useFallingNotesController(mockAudioEngine())
      controller.loadSong([NOTE], 'One note', 60)
    })
  })

  afterEach(() => {
    dispose()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Play one pass from `startMs`, hitting the note or leaving it to be missed. */
  const playPass = (startMs: number, hit: boolean): void => {
    nowMs = startMs
    if (hit) {
      frameAt(startMs + 1_000)
      controller.clickPianoNoteOn(60)
      frameAt(startMs + 1_010)
      controller.clickPianoNoteOff()
    }
    // Past the note's late window and its end: the pass finishes.
    frameAt(startMs + 3_000)
  }

  it('sends no first_value_piano when a finished run had no hit', async () => {
    await controller.startGame()
    playPass(1_000, false)
    expect(controller.gameState()).toBe('finished')
    expect(controller.hitResults().map((h) => h.timing)).toEqual(['miss'])
    expect(sentFunnelEvents()).toEqual([])
  })

  it('sends first_value_piano when a finished run had a hit', async () => {
    await controller.startGame()
    playPass(1_000, true)
    expect(controller.gameState()).toBe('finished')
    expect(sentFunnelEvents()).toEqual(['first_value_piano'])
  })

  it('still sends one first_value_piano when only an earlier repeat cycle had a hit', async () => {
    controller.setPianoPlayMode('repeat')
    controller.setPianoRepeatCycles(2)
    await controller.startGame()

    playPass(1_000, true)
    // Cycle 1 ended: the second cycle began with its own empty results.
    expect(controller.pianoCurrentCycle()).toBe(2)
    expect(controller.hitResults()).toEqual([])
    expect(sentFunnelEvents()).toEqual([])

    playPass(nowMs, false)
    expect(controller.gameState()).toBe('finished')
    expect(controller.hitResults().map((h) => h.timing)).toEqual(['miss'])
    expect(sentFunnelEvents()).toEqual(['first_value_piano'])
  })
})

describe('useFallingNotesController frame loop', () => {
  const NOTE: FallingNote = {
    id: 0,
    midi: 60,
    name: 'C4',
    startBeat: 8,
    duration: 1,
    targetFreq: 261.63,
  }

  let queued: FrameRequestCallback[] = []
  let controller!: ReturnType<typeof useFallingNotesController>
  let dispose: () => void = () => undefined

  const runFrame = (): void => {
    const due = queued
    queued = []
    for (const callback of due) callback(performance.now())
  }

  beforeEach(() => {
    queued = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queued.push(cb)
      return queued.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
      queued = []
    })
    setGameState('idle')
    setCountIn(0)
    setBpm(60)
    const audioEngine = {
      ...mockAudioEngine(),
      startMic: async () => true,
      isMicActive: () => true,
    } as unknown as AudioEngine
    createRoot((rootDispose) => {
      dispose = rootDispose
      controller = useFallingNotesController(audioEngine)
      controller.loadSong([NOTE], 'One note', 60)
    })
  })

  afterEach(() => {
    dispose()
    setGameState('idle')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('asks for no frame while no run plays and the mic is off', () => {
    expect(queued).toHaveLength(0)
  })

  it('runs while a run plays, stops one frame after a pause, and starts again on resume', async () => {
    await controller.startGame()
    expect(controller.gameState()).toBe('playing')
    expect(queued).toHaveLength(1)
    runFrame()
    expect(queued).toHaveLength(1)

    controller.pauseGame()
    runFrame()
    expect(queued).toHaveLength(0)

    controller.resumeGame()
    expect(queued).toHaveLength(1)
    runFrame()
    expect(queued).toHaveLength(1)
  })

  it('runs while the mic listens, and stops one frame after it goes off', async () => {
    await controller.startMic()
    expect(controller.isMicActive()).toBe(true)
    expect(queued).toHaveLength(1)
    runFrame()
    expect(queued).toHaveLength(1)

    controller.stopMic()
    runFrame()
    expect(queued).toHaveLength(0)
  })

  it('stops with the run when the game resets', async () => {
    await controller.startGame()
    controller.resetGame()
    runFrame()
    expect(queued).toHaveLength(0)
    expect(controller.playheadBeat()).toBe(0)
  })
})
