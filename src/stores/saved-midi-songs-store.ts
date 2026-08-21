// ============================================================
// Saved MIDI Songs Store — imported MIDI songs (localStorage)
// ============================================================
//
// Imported MIDI files for guitar/piano practice are kept in a shared
// store so that they carry multiple tracks plus track selection
// (which track to score, which to hear). This store is shared between
// the guitar and piano practice tabs.

import { createSignal } from 'solid-js'
import type { MidiTimeSignature } from '@/lib/midi-bars'
import type { MidiSong, MidiSongTrack, MidiTempoChange } from '@/lib/midi-song'
import { defaultScoreTrack, isPitchedMidiSongTrack, normalizeMidiSong, } from '@/lib/midi-song'

export interface SavedMidiSong {
  id: string
  name: string
  bpm: number
  /** Authored tempo events, retained so rehearsal timing survives persistence. */
  tempoChanges?: MidiTempoChange[]
  /** Authored time signatures, retained so bar lines survive persistence. */
  timeSignatures?: MidiTimeSignature[]
  tracks: MidiSongTrack[]
  /** Marks an in-memory compatibility view whose authority is IndexedDB. */
  persistenceAuthority?: 'piano-project'
  /** Pitched track scored by a neck/keyboard player; null for percussion-only. */
  scoreTrackId: string | null
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
    return (parsed as SavedMidiSong[]).map(normalizeSavedMidiSong)
  } catch {
    return []
  }
}

function normalizeSavedMidiSong(song: SavedMidiSong): SavedMidiSong {
  const normalized = normalizeMidiSong(song)
  const selected = normalized.tracks.find(
    (track) => track.id === song.scoreTrackId && isPitchedMidiSongTrack(track),
  )
  const scoreTrackId = selected?.id ?? defaultScoreTrack(normalized)?.id ?? null
  const trackIds = new Set(normalized.tracks.map((track) => track.id))
  return {
    ...song,
    ...normalized,
    scoreTrackId,
    backingTrackIds: song.backingTrackIds.filter(
      (id) => id !== scoreTrackId && trackIds.has(id),
    ),
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
  scoreTrackId: string | null,
  backingTrackIds: string[],
): SavedMidiSong {
  const entry = normalizeSavedMidiSong({
    id: `gsong-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    bpm: song.bpm,
    tempoChanges: song.tempoChanges,
    timeSignatures: song.timeSignatures,
    tracks: song.tracks,
    scoreTrackId,
    backingTrackIds,
    importedAt: Date.now(),
  })
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
  scoreTrackId: string | null,
  backingTrackIds: string[],
): void {
  const next = savedMidiSongs().map((song) =>
    song.id === id
      ? normalizeSavedMidiSong({ ...song, scoreTrackId, backingTrackIds })
      : song,
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
