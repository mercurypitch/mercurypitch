// ============================================================
// Guitar Pro file import (client entry)
// ============================================================
//
// Dynamically imports alphaTab only when a user actually opens a .gp* file, so
// the (large) library is code-split out of the initial bundle. The caller owns
// the execution environment: interactive consumers may call this directly,
// while Drum Night runs it in a terminable import Worker.

import type { MidiSong } from '@/lib/midi-song'
import type { GpSongProjectionOptions } from '@/lib/tab/gp-to-midi-song'
import { GpSongProjectionLimitError, scoreName, scoreToMidiSong, } from '@/lib/tab/gp-to-midi-song'

export { GpSongProjectionLimitError }

export interface GpImportResult {
  song: MidiSong
  name: string
}

/** Accepted Guitar Pro file extensions. */
export const GP_FILE_EXTENSIONS = '.gp,.gp3,.gp4,.gp5,.gpx'

/** Parse a Guitar Pro file into the app's MidiSong shape. */
export async function parseGuitarProFile(
  file: File,
  options: GpSongProjectionOptions = {},
): Promise<GpImportResult> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const alphaTab = await import('@coderline/alphatab')
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes)
  const song = scoreToMidiSong(score, options)
  if (song.tracks.length === 0) {
    throw new Error('No playable tracks found in this tab.')
  }
  return { song, name: scoreName(score, file.name) }
}
