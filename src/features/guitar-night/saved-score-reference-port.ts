// The saved-score port reads Guitar Night references from the shared imported-song library.
// ============================================================
//
// `SavedMidiSong` is the app's one score identity, shared with the legacy
// Guitar tab. Guitar Night reads and writes the same library rather than
// keeping a private copy, so a tab imported in either place is attachable in
// both.

import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { parseMidiSong } from '@/lib/midi-song'
import { defaultScoreTrack } from '@/lib/midi-song'
import { parseGuitarProFile } from '@/lib/tab/gp-import'
import { getMidiSong, savedMidiSongs, saveMidiSong, updateMidiSongSelection, } from '@/stores/saved-midi-songs-store'
import type { GuitarNightOpenReferenceResult, GuitarNightReferencePort, GuitarNightReferenceSummary, } from './reference-port'
import { isGuitarProReferenceFile, isMidiReferenceFile, openGuitarNightReference, suggestReferenceInstrument, } from './reference-port'

function summarize(song: {
  id: string
  name: string
  tracks: readonly { notes: readonly unknown[] }[]
  importedAt: number
}): GuitarNightReferenceSummary {
  return {
    songId: song.id,
    title: song.name,
    trackCount: song.tracks.filter((track) => track.notes.length > 0).length,
    importedAt: song.importedAt,
  }
}

export function createSavedScoreGuitarNightReferencePort(): GuitarNightReferencePort {
  return {
    listReferences: () =>
      savedMidiSongs()
        .map(summarize)
        .sort((left, right) => right.importedAt - left.importedAt),

    openReference: (
      songId: string,
      trackId?: string,
      tuning?: InstrumentTuning,
    ): GuitarNightOpenReferenceResult => {
      const song = getMidiSong(songId)
      if (song === undefined) return { ok: false, code: 'not-found' }
      return openGuitarNightReference(song, trackId, tuning)
    },

    suggestInstrument: (songId: string, trackId?: string) => {
      const song = getMidiSong(songId)
      if (song === undefined) return null
      return suggestReferenceInstrument(song, trackId)
    },

    rememberTrack: (songId: string, trackId: string): void => {
      const song = getMidiSong(songId)
      if (song === undefined || song.scoreTrackId === trackId) return
      updateMidiSongSelection(songId, trackId, song.backingTrackIds)
    },

    importReference: async (
      file: File,
    ): Promise<GuitarNightReferenceSummary> => {
      if (isGuitarProReferenceFile(file.name)) {
        const { song, name } = await parseGuitarProFile(file)
        const scored = defaultScoreTrack(song)
        return summarize(saveMidiSong(name, song, scored.id, []))
      }

      if (!isMidiReferenceFile(file.name)) {
        throw new Error(
          'That format is not supported. Choose a Guitar Pro or MIDI file.',
        )
      }

      const song = parseMidiSong(new Uint8Array(await file.arrayBuffer()))
      if (song === null) {
        throw new Error('This file has no playable tracks to follow.')
      }
      const scored = defaultScoreTrack(song)
      const name = file.name.replace(/\.[^.]+$/, '')
      return summarize(saveMidiSong(name, song, scored.id, []))
    },
  }
}
