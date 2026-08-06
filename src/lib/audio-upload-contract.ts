// Audio upload contract keeps every song picker aligned without pulling in processing UI.
// ============================================================

// Enumerate concrete MIME types and extensions instead of `audio/*`. On iOS,
// `audio/*` can map to a narrow UTI set that greys out ordinary MP3 files in
// Files/iCloud Drive. These values match the formats the separation pipeline
// accepts and remain dependency-free for standalone routes.

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

/** Compact human-readable size label used by upload controls and queue rows. */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const unit = 1024
  const labels = ['Bytes', 'KB', 'MB', 'GB']
  const index = Math.min(
    labels.length - 1,
    Math.floor(Math.log(bytes) / Math.log(unit)),
  )
  const value = bytes / Math.pow(unit, index)
  return `${Math.round(value * 100) / 100} ${labels[index]}`
}
