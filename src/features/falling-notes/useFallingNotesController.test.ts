// ============================================================
// Falling Notes controller persistence regressions
// ============================================================
//
// Canonical Piano compatibility songs must keep IndexedDB as their authority
// when the status-bar mute controls update the in-memory song projection.

import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from '@/lib/audio-engine'
import type { MidiSongTrack } from '@/lib/midi-song'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import { useFallingNotesController } from './useFallingNotesController'

const persistPianoCompatibilitySelection = vi.hoisted(() =>
  vi.fn(async () => undefined),
)

vi.mock('@/features/piano-project/import-piano-project-for-legacy', () => ({
  persistPianoCompatibilitySelection,
}))

function mockAudioEngine(): AudioEngine {
  return {
    getAudioContext: () => null,
    getBufferSize: () => 2048,
    getInputLevel: () => 0,
    getSampleRate: () => 44_100,
    getTimeData: () => new Float32Array(2048),
    isMicActive: () => false,
    onMicLost: () => () => undefined,
    playClick: () => undefined,
    playMetronomeClick: () => undefined,
    playNote: async () => undefined,
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
    name: id,
    instrumentName: 'Acoustic Grand Piano',
    noteCount: 1,
    notes: [{ midi: 60, startBeat: 0, duration: 1 }],
  }
}

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
