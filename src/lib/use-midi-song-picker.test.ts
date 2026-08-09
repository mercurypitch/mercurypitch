// ============================================================
// MIDI song picker import seam tests — canonical hosts bypass legacy storage
// ============================================================

import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MidiSongNote } from '@/lib/midi-song'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import type { MelodyItem } from '@/types'
import { useMidiSongPicker } from './use-midi-song-picker'

interface TestNote {
  midi: number
  startBeat: number
  duration: number
  trackId?: string
}

function compatibilitySong(trackCount = 1): SavedMidiSong {
  return {
    id: 'project-1',
    name: 'Canonical Study',
    bpm: 84,
    tracks: Array.from({ length: trackCount }, (_, index) => ({
      id: `track-${index}`,
      name: `Track ${index + 1}`,
      instrumentName: 'Acoustic Grand Piano',
      noteCount: 1,
      notes: [{ midi: 60 + index, startBeat: index, duration: 1 }],
    })),
    scoreTrackId: 'track-0',
    backingTrackIds: Array.from(
      { length: Math.max(0, trackCount - 1) },
      (_, index) => `track-${index + 1}`,
    ),
    importedAt: 1,
  }
}

function createPicker(
  prepareImportedMidi?: (
    file: File,
    options: { signal: AbortSignal },
  ) => Promise<SavedMidiSong | null>,
  persistMidiSelection?: (song: SavedMidiSong) => void | Promise<void>,
) {
  const onSongLoaded = vi.fn()
  let dispose: () => void = () => undefined
  const picker = createRoot((disposeRoot) => {
    dispose = disposeRoot
    return useMidiSongPicker<TestNote>({
      currentSong: () => null,
      fromMelodyItems: (items: MelodyItem[]) =>
        items.map((item) => ({
          midi: item.note.midi,
          startBeat: item.startBeat,
          duration: item.duration,
        })),
      fromScoreNotes: (notes: MidiSongNote[]) => notes,
      fromBackingNotes: (notes: MidiSongNote[], trackId: string) =>
        notes.map((note) => ({ ...note, trackId })),
      onSongLoaded,
      skipAutoLoad: () => true,
      ...(prepareImportedMidi === undefined ? {} : { prepareImportedMidi }),
      ...(persistMidiSelection === undefined ? {} : { persistMidiSelection }),
    })
  })

  return { dispose, onSongLoaded, picker }
}

beforeEach(() => {
  localStorage.clear()
})

describe('useMidiSongPicker canonical import seam', () => {
  it('loads a prepared single-track compatibility view without legacy persistence', async () => {
    const song = compatibilitySong()
    const prepareImportedMidi = vi.fn(async () => song)
    const { dispose, onSongLoaded, picker } = createPicker(prepareImportedMidi)
    const file = new File([new Uint8Array([1, 2, 3])], 'study.mid')

    await picker.importMidiFile(file)

    expect(prepareImportedMidi).toHaveBeenCalledOnce()
    expect(prepareImportedMidi).toHaveBeenCalledWith(file, {
      signal: expect.any(AbortSignal),
    })
    expect(onSongLoaded).toHaveBeenCalledWith(
      song.tracks[0].notes,
      'Canonical Study',
      84,
      [],
      [],
      song,
    )
    expect(localStorage.getItem('pitchperfect_guitar_songs')).toBeNull()
    dispose()
  })

  it('keeps the existing track-choice flow for prepared multi-track songs', async () => {
    const song = compatibilitySong(2)
    const { dispose, onSongLoaded, picker } = createPicker(async () => song)

    await picker.importMidiFile(new File([], 'ensemble.mid'))

    expect(picker.trackModalSong()).toBe(song)
    expect(picker.pendingScoreId()).toBe('track-0')
    expect(picker.pendingBackingIds()).toEqual(new Set(['track-1']))
    expect(onSongLoaded).not.toHaveBeenCalled()
    expect(localStorage.getItem('pitchperfect_guitar_songs')).toBeNull()
    dispose()
  })

  it('delegates prepared-song choices without rewriting the legacy catalogue', async () => {
    const song = compatibilitySong(2)
    const persistMidiSelection = vi.fn(async () => undefined)
    const { dispose, onSongLoaded, picker } = createPicker(
      async () => song,
      persistMidiSelection,
    )

    await picker.importMidiFile(new File([], 'ensemble.mid'))
    picker.setPendingScoreId('track-1')
    picker.setPendingBackingIds(new Set(['track-0']))
    picker.applyTrackSelection()

    expect(persistMidiSelection).toHaveBeenCalledWith({
      ...song,
      scoreTrackId: 'track-1',
      backingTrackIds: ['track-0'],
    })
    expect(onSongLoaded).toHaveBeenCalledOnce()
    expect(localStorage.getItem('pitchperfect_guitar_songs')).toBeNull()
    dispose()
  })

  it('reports empty and failed prepared imports without loading a song', async () => {
    const empty = createPicker(async () => null)
    await empty.picker.importMidiFile(new File([], 'empty.mid'))
    expect(empty.picker.importStatus()).toBe('No notes found in MIDI file')
    expect(empty.onSongLoaded).not.toHaveBeenCalled()
    empty.dispose()

    const failed = createPicker(async () => {
      throw new Error('worker stopped')
    })
    await failed.picker.importMidiFile(new File([], 'broken.mid'))
    expect(failed.picker.importStatus()).toContain('Import failed:')
    expect(failed.picker.importStatus()).toContain('worker stopped')
    expect(failed.onSongLoaded).not.toHaveBeenCalled()
    failed.dispose()
  })

  it('keeps the legacy parse-and-save fallback for callers without an injected importer', async () => {
    const midi = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0, 0x4d, 0x54, 0x72,
      0x6b, 0, 0, 0, 13, 0, 0x90, 60, 100, 0x83, 0x60, 0x80, 60, 0, 0, 0xff,
      0x2f, 0,
    ])
    const { dispose, onSongLoaded, picker } = createPicker()
    const file = {
      name: 'legacy.mid',
      arrayBuffer: async () => midi.buffer,
    } as File

    await picker.importMidiFile(file)

    expect(onSongLoaded).toHaveBeenCalledOnce()
    expect(onSongLoaded.mock.calls[0][1]).toBe('legacy')
    expect(
      JSON.parse(localStorage.getItem('pitchperfect_guitar_songs') ?? '[]'),
    ).toHaveLength(1)
    dispose()
  })

  it('aborts a replaced import and ignores its stale completion', async () => {
    const pending: Array<{
      resolve: (song: SavedMidiSong | null) => void
      signal: AbortSignal
    }> = []
    const prepareImportedMidi = vi.fn(
      (_file: File, options: { signal: AbortSignal }) =>
        new Promise<SavedMidiSong | null>((resolve) => {
          pending.push({ resolve, signal: options.signal })
        }),
    )
    const { dispose, onSongLoaded, picker } = createPicker(prepareImportedMidi)

    const firstImport = picker.importMidiFile(new File([], 'first.mid'))
    const secondImport = picker.importMidiFile(new File([], 'second.mid'))

    expect(pending[0].signal.aborted).toBe(true)
    expect(pending[1].signal.aborted).toBe(false)

    pending[0].resolve({
      ...compatibilitySong(),
      id: 'stale-project',
      name: 'Stale Project',
    })
    await firstImport
    expect(onSongLoaded).not.toHaveBeenCalled()
    expect(picker.importStatus()).toBe('Parsing...')

    pending[1].resolve({
      ...compatibilitySong(),
      id: 'current-project',
      name: 'Current Project',
    })
    await secondImport
    expect(onSongLoaded).toHaveBeenCalledOnce()
    expect(onSongLoaded.mock.calls[0][1]).toBe('Current Project')
    dispose()
  })

  it('aborts an active injected import on owner cleanup', async () => {
    let resolveImport: (song: SavedMidiSong | null) => void = () => undefined
    let importSignal: AbortSignal | undefined
    const { dispose, onSongLoaded, picker } = createPicker(
      (_file, options) =>
        new Promise((resolve) => {
          resolveImport = resolve
          importSignal = options.signal
        }),
    )

    const importing = picker.importMidiFile(new File([], 'leaving.mid'))
    dispose()
    expect(importSignal?.aborted).toBe(true)

    resolveImport(compatibilitySong())
    await importing
    expect(onSongLoaded).not.toHaveBeenCalled()
  })
})
