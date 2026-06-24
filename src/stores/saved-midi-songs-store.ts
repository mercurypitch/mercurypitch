// ============================================================
// Saved MIDI Songs Store — imported MIDI songs (localStorage)
// ============================================================
//
// Imported MIDI files for guitar/piano practice are kept in a shared
// store so that they carry multiple tracks plus track selection
// (which track to score, which to hear). This store is shared between
// the guitar and piano practice tabs.

import { createSignal } from 'solid-js'
import type { MidiSong, MidiSongTrack } from '@/lib/midi-song'

export interface SavedMidiSong {
  id: string
  name: string
  bpm: number
  tracks: MidiSongTrack[]
  /** Track id whose notes the player is scored against */
  scoreTrackId: string
  /** Track ids played as backing audio (not displayed or scored) */
  backingTrackIds: string[]
  importedAt: number
}

const STORAGE_KEY = 'pitchperfect_guitar_songs'
const MAX_SAVED_SONGS = 30

function loadFromStorage(): SavedMidiSong[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as SavedMidiSong[]
  } catch {
    return []
  }
}

const [savedMidiSongs, setSavedMidiSongs] =
  createSignal<SavedMidiSong[]>(loadFromStorage())

export { savedMidiSongs }

function persist(songs: SavedMidiSong[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs))
  } catch (err) {
    console.warn('[SavedMidiSongs] Failed to persist imported songs:', err)
  }
}

/** Save an imported MIDI song. Re-importing a same-named song replaces it. */
export function saveMidiSong(
  name: string,
  song: MidiSong,
  scoreTrackId: string,
  backingTrackIds: string[],
): SavedMidiSong {
  const entry: SavedMidiSong = {
    id: `gsong-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    bpm: song.bpm,
    tracks: song.tracks,
    scoreTrackId,
    backingTrackIds,
    importedAt: Date.now(),
  }
  const next = [
    entry,
    ...savedMidiSongs().filter((s) => s.name !== name),
  ].slice(0, MAX_SAVED_SONGS)
  setSavedMidiSongs(next)
  persist(next)
  return entry
}

/** Update which tracks are scored/heard for a saved song. */
export function updateMidiSongSelection(
  id: string,
  scoreTrackId: string,
  backingTrackIds: string[],
): void {
  const next = savedMidiSongs().map((s) =>
    s.id === id ? { ...s, scoreTrackId, backingTrackIds } : s,
  )
  setSavedMidiSongs(next)
  persist(next)
}

export function deleteMidiSong(id: string): void {
  const next = savedMidiSongs().filter((s) => s.id !== id)
  setSavedMidiSongs(next)
  persist(next)
}

export function getMidiSong(id: string): SavedMidiSong | undefined {
  return savedMidiSongs().find((s) => s.id === id)
}
