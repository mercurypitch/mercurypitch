// ============================================================
// Audio upload accept list — shared by every "choose a song" picker.
// ============================================================
//
// We deliberately enumerate concrete MIME types AND file extensions instead of
// the shorthand `accept="audio/*"`. On iOS Safari `audio/*` maps to a narrow
// UTI set and GREYS OUT plain .mp3 files sitting in the Files app / iCloud
// Drive, so users literally cannot pick the song they want (they can on the
// old in-app karaoke tab, which has always used this explicit list). Listing
// the concrete types + extensions restores selection on iOS while still
// covering the formats the separation pipeline accepts (mp3 / wav / flac).
//
// Keep this as the single source of truth so the pickers can never drift apart
// again — that drift is exactly what regressed the Karaoke Night uploader.

/** Accepted audio MIME types + extensions for song-upload file inputs. */
export const AUDIO_UPLOAD_ALLOWED_TYPES: string[] = [
  'audio/mpeg',
  'audio/wav',
  'audio/mp3',
  'audio/wave',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  '.mp3',
  '.wav',
  '.flac',
]

/** Ready-to-use `accept` attribute string (comma-joined). */
export const AUDIO_UPLOAD_ACCEPT = AUDIO_UPLOAD_ALLOWED_TYPES.join(',')
