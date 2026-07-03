// ============================================================
// useMidiSongPicker — shared song-picker state + MIDI import flow
// Used by the guitar + piano (falling-notes) song pickers. The only
// feature-specific part is how MIDI notes are converted into the
// feature's note/load-data type, supplied via the converter callbacks.
// ============================================================

import type { Accessor } from 'solid-js'
import { createMemo, createSignal, onMount } from 'solid-js'
import type { MidiSongNote } from '@/lib/midi-song'
import { defaultScoreTrack, parseMidiSong } from '@/lib/midi-song'
import { getAllMelodies } from '@/stores/melody-store'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import { deleteMidiSong, savedMidiSongs, saveMidiSong, updateMidiSongSelection, } from '@/stores/saved-midi-songs-store'
import type { MelodyData, MelodyItem } from '@/types'

export interface MidiSongPickerOptions<T> {
  /** Current loaded song (from the controller), for re-scoring a track. */
  currentSong: () => SavedMidiSong | null
  /** Convert a library melody's items to the feature's note type. */
  fromMelodyItems: (items: MelodyItem[]) => T[]
  /** Convert the scored track's MIDI notes to the feature's note type. */
  fromScoreNotes: (notes: MidiSongNote[]) => T[]
  /** Convert a backing track's MIDI notes (tagged with its trackId). */
  fromBackingNotes: (notes: MidiSongNote[], trackId: string) => T[]
  /** Hand the loaded song off to the feature controller. */
  onSongLoaded: (
    items: T[],
    name: string,
    bpm: number,
    backingItems: T[],
    mutedIds: string[],
    songObj: SavedMidiSong | null,
  ) => void
}

export interface MidiSongPicker {
  selectedId: Accessor<string | null>
  setSelectedId: (id: string | null) => void
  importStatus: Accessor<string>
  isModalOpen: Accessor<boolean>
  setIsModalOpen: (open: boolean) => void
  trackModalSong: Accessor<SavedMidiSong | null>
  setTrackModalSong: (song: SavedMidiSong | null) => void
  pendingScoreId: Accessor<string>
  setPendingScoreId: (id: string) => void
  pendingBackingIds: Accessor<Set<string>>
  setPendingBackingIds: (ids: Set<string>) => void
  melodies: Accessor<MelodyData[]>
  currentMelodyName: Accessor<string>
  loadMelody: (id: string) => void
  loadSavedSong: (song: SavedMidiSong) => void
  deleteSong: (id: string) => void
  openTrackModal: (song: SavedMidiSong) => void
  applyTrackSelection: () => void
  selectScoreTrack: (trackId: string) => void
  importMidi: () => void
  /** Import a .mid/.midi File directly (drag-and-drop path). */
  importMidiFile: (file: File) => Promise<void>
}

export function useMidiSongPicker<T>(
  opts: MidiSongPickerOptions<T>,
): MidiSongPicker {
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [importStatus, setImportStatus] = createSignal<string>('')
  const [isModalOpen, setIsModalOpen] = createSignal(false)
  const [trackModalSong, setTrackModalSong] =
    createSignal<SavedMidiSong | null>(null)
  const [pendingScoreId, setPendingScoreId] = createSignal('')
  const [pendingBackingIds, setPendingBackingIds] = createSignal<Set<string>>(
    new Set(),
  )

  const melodies = createMemo(() => {
    try {
      return getAllMelodies().filter((m) => m.items.length > 0)
    } catch {
      return []
    }
  })

  const currentMelodyName = createMemo(() => {
    const id = selectedId()
    if (id === null || id === '') return 'Select a song...'
    const m = melodies().find((x) => x.id === id)
    if (m) return m.name
    const s = savedMidiSongs().find((x) => x.id === id)
    return s ? s.name : 'Select a song...'
  })

  const loadMelody = (id: string) => {
    const melody = melodies().find((m) => m.id === id)
    if (!melody) return
    opts.onSongLoaded(
      opts.fromMelodyItems(melody.items),
      melody.name,
      melody.bpm,
      [],
      [],
      null,
    )
  }

  const loadSavedSong = (song: SavedMidiSong) => {
    const scoreTrack =
      song.tracks.find((t) => t.id === song.scoreTrackId) ?? song.tracks[0]
    const backing: T[] = []
    for (const t of song.tracks) {
      if (t.id === scoreTrack.id) continue
      backing.push(...opts.fromBackingNotes(t.notes, t.id))
    }
    const mutedIds = song.tracks
      .filter(
        (t) => t.id !== scoreTrack.id && !song.backingTrackIds.includes(t.id),
      )
      .map((t) => t.id)
    setSelectedId(song.id)
    opts.onSongLoaded(
      opts.fromScoreNotes(scoreTrack.notes),
      song.name,
      song.bpm,
      backing,
      mutedIds,
      song,
    )
    setImportStatus(
      `Loaded: ${song.name} — scoring "${scoreTrack.name}" (${scoreTrack.noteCount} notes)${
        backing.length > 0 ? ` + ${backing.length} backing notes` : ''
      }`,
    )
  }

  const deleteSong = (id: string) => {
    deleteMidiSong(id)
    if (selectedId() === id) setSelectedId(null)
  }

  const openTrackModal = (song: SavedMidiSong) => {
    setPendingScoreId(song.scoreTrackId)
    setPendingBackingIds(new Set(song.backingTrackIds))
    setTrackModalSong(song)
  }

  const applyTrackSelection = () => {
    const song = trackModalSong()
    if (!song) return
    const scoreId = pendingScoreId()
    const backingIds = [...pendingBackingIds()].filter((id) => id !== scoreId)
    updateMidiSongSelection(song.id, scoreId, backingIds)
    const updated: SavedMidiSong = {
      ...song,
      scoreTrackId: scoreId,
      backingTrackIds: backingIds,
    }
    setTrackModalSong(null)
    setIsModalOpen(false)
    loadSavedSong(updated)
  }

  const selectScoreTrack = (trackId: string) => {
    const song = opts.currentSong()
    if (!song || song.scoreTrackId === trackId) return

    const oldScoreId = song.scoreTrackId
    const newBacking = new Set(song.backingTrackIds)
    newBacking.add(oldScoreId)
    newBacking.delete(trackId)

    const backingTrackIds = [...newBacking]
    updateMidiSongSelection(song.id, trackId, backingTrackIds)

    const updated: SavedMidiSong = {
      ...song,
      scoreTrackId: trackId,
      backingTrackIds,
    }
    loadSavedSong(updated)
  }

  const importMidiFile = async (file: File) => {
    try {
      setImportStatus('Parsing...')
      const buffer = await file.arrayBuffer()
      const data = new Uint8Array(buffer)
      const song = parseMidiSong(data)

      if (!song) {
        setImportStatus('No notes found in MIDI file')
        return
      }

      const name = file.name.replace(/\.(mid|midi)$/i, '')
      const score = defaultScoreTrack(song)
      const backingIds = song.tracks
        .filter((t) => t.id !== score.id)
        .map((t) => t.id)
      const saved = saveMidiSong(name, song, score.id, backingIds)

      if (song.tracks.length > 1) {
        // Let the user pick which track to practice before loading
        openTrackModal(saved)
      } else {
        loadSavedSong(saved)
      }
    } catch (err) {
      setImportStatus(`Import failed: ${String(err)}`)
    }
  }

  const importMidi = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.mid,.midi'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      void importMidiFile(file)
    }
    input.click()
  }

  onMount(() => {
    const list = melodies()
    if (list.length > 0) {
      setSelectedId(list[0].id)
      loadMelody(list[0].id)
    }
  })

  return {
    selectedId,
    setSelectedId,
    importStatus,
    isModalOpen,
    setIsModalOpen,
    trackModalSong,
    setTrackModalSong,
    pendingScoreId,
    setPendingScoreId,
    pendingBackingIds,
    setPendingBackingIds,
    melodies,
    currentMelodyName,
    loadMelody,
    loadSavedSong,
    deleteSong,
    openTrackModal,
    applyTrackSelection,
    selectScoreTrack,
    importMidi,
    importMidiFile,
  }
}
