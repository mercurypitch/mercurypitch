// Unified song import classification keeps play-along hosts on one lightweight file contract.
// ============================================================

import { acceptsAudioUpload, AUDIO_UPLOAD_ACCEPT, } from '@/lib/audio-upload-contract'

export type UnifiedSongImportKind = 'audio' | 'midi' | 'guitar-pro'

/** Standard MIDI and supported Guitar Pro extensions, without importing a parser. */
export const SONG_REFERENCE_FILE_ACCEPT = '.gp,.gp3,.gp4,.gp5,.gpx,.mid,.midi'

/** Audio plus authored-song formats for a single unified picker. */
export const UNIFIED_SONG_IMPORT_ACCEPT = [
  AUDIO_UPLOAD_ACCEPT,
  SONG_REFERENCE_FILE_ACCEPT,
].join(',')

export function isMidiSongFile(fileName: string): boolean {
  return /\.midi?$/i.test(fileName)
}

export function isGuitarProSongFile(fileName: string): boolean {
  return /\.(gp|gp3|gp4|gp5|gpx)$/i.test(fileName)
}

/**
 * Classify a supported song without choosing how it will be opened.
 *
 * In particular, this function never imports a MIDI or Guitar Pro parser.
 * Drum Night can route those kinds to its terminable Worker while another
 * host may route the same classification to its own saved-score adapter.
 */
export function classifyUnifiedSongImport(
  file: File,
): UnifiedSongImportKind | null {
  if (isMidiSongFile(file.name)) return 'midi'
  if (isGuitarProSongFile(file.name)) return 'guitar-pro'
  if (acceptsAudioUpload(file)) return 'audio'
  return null
}
