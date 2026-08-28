// ============================================================
// Voice Take Export — friendly, container-honest local downloads
// ============================================================
//
// New recordings prefer an Apple-friendly MP4 container. Older WebM takes are
// decoded to PCM WAV when the browser can do so; otherwise their original
// bytes and extension are preserved instead of disguising one format as
// another.

import { encodeAudioBufferToMonoPcmWav } from '@/lib/audio-buffer-wav'

const EXPORT_DECODE_SAMPLE_RATE = 48_000
const DOWNLOAD_URL_LIFETIME_MS = 1000
const MAX_EXPORT_FILENAME_BYTES = 240
const INVALID_FILENAME_CHARACTERS = new Set('<>:"/\\|?*')

export interface VoiceTakeExportIdentity {
  threadTitle: string
  ordinal: number
  mimeType: string
}

export interface PreparedVoiceTakeExport {
  file: File
  convertedToWav: boolean
  usedOriginalWebmFallback: boolean
}

export type VoiceTakeAudioDecoder = (blob: Blob) => Promise<AudioBuffer>

function normalizedMimeType(mimeType: string): string {
  return mimeType.split(';', 1)[0]?.trim().toLowerCase() ?? ''
}

function sourceMimeType(blob: Blob, storedMimeType: string): string {
  const blobMimeType = blob.type.trim()
  const normalizedBlobMimeType = normalizedMimeType(blobMimeType)
  if (
    normalizedBlobMimeType !== '' &&
    normalizedBlobMimeType !== 'application/octet-stream'
  ) {
    return blobMimeType
  }
  return storedMimeType.trim() || 'application/octet-stream'
}

/** Return an extension that describes the bytes' real media container. */
export function voiceTakeExtensionForMime(mimeType: string): string {
  switch (normalizedMimeType(mimeType)) {
    case 'audio/mp4':
    case 'audio/x-m4a':
      return 'm4a'
    case 'video/mp4':
      return 'mp4'
    case 'audio/webm':
    case 'video/webm':
      return 'webm'
    case 'audio/wav':
    case 'audio/wave':
    case 'audio/x-wav':
      return 'wav'
    case 'audio/mpeg':
    case 'audio/mp3':
      return 'mp3'
    case 'audio/ogg':
      return 'ogg'
    case 'audio/aac':
      return 'aac'
    case 'audio/flac':
      return 'flac'
    default:
      return 'bin'
  }
}

function truncateUtf8(value: string, maxBytes: number): string {
  const encoder = new TextEncoder()
  let bytes = 0
  let result = ''
  for (const character of value) {
    const characterBytes = encoder.encode(character).byteLength
    if (bytes + characterBytes > maxBytes) break
    result += character
    bytes += characterBytes
  }
  return result
}

function safeThreadTitle(value: string, maxBytes: number): string {
  const sanitized = Array.from(value.normalize('NFC'), (character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 0x1f ||
      codePoint === 0x7f ||
      INVALID_FILENAME_CHARACTERS.has(character)
      ? ' '
      : character
  }).join('')
  const normalized = sanitized
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '')
  const bounded = truncateUtf8(normalized, maxBytes).replace(/[. ]+$/g, '')
  return bounded || 'Voice Take'
}

/** Build a readable filename without discarding non-ASCII song names. */
export function voiceTakeExportFilename(
  identity: VoiceTakeExportIdentity,
  mimeType = identity.mimeType,
): string {
  const ordinal = Number.isFinite(identity.ordinal)
    ? Math.min(999_999, Math.max(1, Math.floor(identity.ordinal)))
    : 1
  const extension = voiceTakeExtensionForMime(mimeType)
  const prefix = 'MercuryPitch - '
  const suffix = ` - Take ${ordinal}.${extension}`
  const reservedBytes = new TextEncoder().encode(prefix + suffix).byteLength
  const title = safeThreadTitle(
    identity.threadTitle,
    MAX_EXPORT_FILENAME_BYTES - reservedBytes,
  )
  return `${prefix}${title}${suffix}`
}

async function decodeVoiceTakeAudio(blob: Blob): Promise<AudioBuffer> {
  if (typeof OfflineAudioContext === 'undefined') {
    throw new Error('This browser cannot prepare a WAV copy.')
  }
  const context = new OfflineAudioContext(1, 1, EXPORT_DECODE_SAMPLE_RATE)
  const decoded = await context.decodeAudioData(await blob.arrayBuffer())
  if (decoded.numberOfChannels < 1 || decoded.length < 1) {
    throw new Error('The decoded recording has no playable audio.')
  }
  return decoded
}

/**
 * Prepare a take without ever pairing one container's bytes with another
 * container's extension. Decoding is injectable so conversion stays focused
 * and deterministic in tests.
 */
export async function prepareVoiceTakeExport(
  blob: Blob,
  identity: VoiceTakeExportIdentity,
  decodeAudio: VoiceTakeAudioDecoder = decodeVoiceTakeAudio,
): Promise<PreparedVoiceTakeExport> {
  const mimeType = sourceMimeType(blob, identity.mimeType)
  const normalized = normalizedMimeType(mimeType)
  const isWebm = normalized === 'audio/webm' || normalized === 'video/webm'

  if (isWebm) {
    try {
      const decoded = await decodeAudio(blob)
      const wavBytes = encodeAudioBufferToMonoPcmWav(decoded)
      return {
        file: new File(
          [wavBytes],
          voiceTakeExportFilename(identity, 'audio/wav'),
          { type: 'audio/wav' },
        ),
        convertedToWav: true,
        usedOriginalWebmFallback: false,
      }
    } catch {
      return {
        file: new File([blob], voiceTakeExportFilename(identity, mimeType), {
          type: mimeType,
        }),
        convertedToWav: false,
        usedOriginalWebmFallback: true,
      }
    }
  }

  return {
    file: new File([blob], voiceTakeExportFilename(identity, mimeType), {
      type: mimeType,
    }),
    convertedToWav: false,
    usedOriginalWebmFallback: false,
  }
}

/** Trigger a download from a document-attached anchor, then release its URL. */
export function downloadPreparedVoiceTake(file: File): void {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  document.body.appendChild(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS)
  }
}
