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

/** Browser-mode preparation accepts larger source files than cloud mode. */
export const LOCAL_MAX_UPLOAD_BYTES = 100 * 1024 * 1024

/** Cloud preparation limit enforced before a paid job is submitted. */
export const SERVER_MAX_UPLOAD_BYTES = 50 * 1024 * 1024

/** Match either a browser-provided MIME type or a supported file extension. */
export function acceptsAudioUpload(
  file: File,
  allowedTypes: readonly string[] = AUDIO_UPLOAD_ALLOWED_TYPES,
): boolean {
  const mimeType = file.type.toLowerCase()
  const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
  return allowedTypes.includes(mimeType) || allowedTypes.includes(extension)
}

/** Return concrete recovery copy for a rejected source file, otherwise null. */
export function audioUploadValidationError(
  file: File,
  maxBytes: number,
  allowedTypes: readonly string[] = AUDIO_UPLOAD_ALLOWED_TYPES,
  limitLabel = 'upload',
): string | null {
  if (file.size === 0) {
    return 'This file is empty. Choose an MP3, WAV, or FLAC song.'
  }
  if (!acceptsAudioUpload(file, allowedTypes)) {
    return 'That format is not supported. Choose MP3, WAV, or FLAC audio.'
  }
  if (file.size > maxBytes) {
    return `This song is over the ${formatFileSize(maxBytes)} ${limitLabel} limit. Choose a smaller file.`
  }
  return null
}

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
