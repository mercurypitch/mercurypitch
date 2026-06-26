// ============================================================
// Guitar Pro file import (client entry)
// ============================================================
//
// Dynamically imports alphaTab only when a user actually opens a .gp* file, so
// the (large) library is code-split out of the initial bundle. Parsing happens
// on the main thread — GP files are small and parse in tens of milliseconds.
// (A Web Worker is a future optimisation; alphaTab's browser build touches DOM
// globals at import time, which complicates worker use.)

import type { MidiSong } from '@/lib/midi-song'
import { scoreName, scoreToMidiSong } from '@/lib/tab/gp-to-midi-song'

export interface GpImportResult {
  song: MidiSong
  name: string
}

/** Accepted Guitar Pro file extensions. */
export const GP_FILE_EXTENSIONS = '.gp,.gp3,.gp4,.gp5,.gpx'

/** Parse a Guitar Pro file into the app's MidiSong shape. */
export async function parseGuitarProFile(file: File): Promise<GpImportResult> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const alphaTab = await import('@coderline/alphatab')
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes)
  const song = scoreToMidiSong(score)
  if (song.tracks.length === 0) {
    throw new Error('No playable (non-percussion) tracks found in this tab.')
  }
  return { song, name: scoreName(score, file.name) }
}
