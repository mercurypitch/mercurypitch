// ============================================================
// Guitar Night import helpers keep audio, MIDI and Guitar Pro entry points aligned.
// ============================================================

import { acceptsAudioUpload, AUDIO_UPLOAD_ACCEPT, } from '@/lib/audio-upload-contract'
import { isGuitarProReferenceFile, isMidiReferenceFile, REFERENCE_FILE_ACCEPT, } from './reference-port'

export type GuitarNightImportKind = 'audio' | 'midi' | 'guitar-pro'

/** Ready-to-use accept list for the single Guitar Night file picker. */
export const GUITAR_NIGHT_IMPORT_ACCEPT = [
  AUDIO_UPLOAD_ACCEPT,
  REFERENCE_FILE_ACCEPT,
].join(',')

/** Calm, compact copy shared by picker and drop affordances. */
export const GUITAR_NIGHT_IMPORT_FORMATS =
  'MP3 · WAV · FLAC · MIDI · Guitar Pro'
export const GUITAR_NIGHT_IMPORT_DROP_COPY = 'Drop audio, MIDI, or Guitar Pro'
export const GUITAR_NIGHT_IMPORT_ERROR =
  'Choose MP3, WAV, FLAC, MIDI, or Guitar Pro.'
export const GUITAR_NIGHT_IMPORT_EMPTY_ERROR =
  'This file is empty. Choose MP3, WAV, FLAC, MIDI, or Guitar Pro.'
export const GUITAR_NIGHT_IMPORT_MULTIPLE_ERROR = 'Choose one file at a time.'
export const GUITAR_NIGHT_IMPORT_AUDIO_BUSY_ERROR =
  'Finish or cancel the current song preparation before choosing another audio file. You can still open MIDI or Guitar Pro now.'

/** Classify one supported file without coupling the caller to an import UI. */
export function classifyGuitarNightImport(
  file: File,
): GuitarNightImportKind | null {
  if (isMidiReferenceFile(file.name)) return 'midi'
  if (isGuitarProReferenceFile(file.name)) return 'guitar-pro'
  if (acceptsAudioUpload(file)) return 'audio'
  return null
}

/** Return recovery copy for a file Guitar Night cannot open, otherwise null. */
export function guitarNightImportValidationError(file: File): string | null {
  if (file.size === 0) return GUITAR_NIGHT_IMPORT_EMPTY_ERROR
  if (classifyGuitarNightImport(file) === null) {
    return GUITAR_NIGHT_IMPORT_ERROR
  }
  return null
}
