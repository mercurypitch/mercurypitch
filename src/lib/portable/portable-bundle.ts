// ── Portable song bundle ─────────────────────────────────────────────
// The shape a song travels in: a manifest naming its parts, and the parts.
//
// Deliberately NOT an archive. A ZIP has to exist somewhere in one piece
// -- built in memory to send, inflated in memory to read -- which is
// exactly what must not happen on a phone receiving a library. A bundle
// is a description: each part is produced, sent, verified and written on
// its own, so neither side ever holds more than the part in hand. The
// jam room already moves single stems this way; this is the same idea
// with a name, plus the prepared-song data that makes a synced song feel
// like the one you left behind.
//
// Pure format, no database: the building and importing live in
// src/db/services/portable-bundle-service.ts. Transports carry the
// manifest as JSON and the parts as bytes, in any order they like, over
// anything -- a DataChannel, a Drive file, a QR-coded room.
//
// See docs/plans/device-sync.md (Phase 1).

import { sha256Hex } from './hash'
import type { PortableTier } from './portable-audio'

/**
 * Version of the bundle format itself, not of the app. Bump only for a
 * change an older reader would misread; adding an optional field is not
 * one.
 */
export const PORTABLE_BUNDLE_VERSION = 1

/** The parts a song can travel as. */
export type PortablePartId = 'stem:vocal' | 'stem:instrumental' | 'prep'

/** The same three ids as a value, so a manifest can be checked against them. */
export const PORTABLE_PART_IDS: readonly PortablePartId[] = [
  'stem:vocal',
  'stem:instrumental',
  'prep',
]

/**
 * The largest a single part may claim to be.
 *
 * An hour of 192 kbps AAC is about 86 MB, so this is far above any song
 * anyone will send and far below "fills the phone". The exact number is
 * not the point: an announced size decides how much a receiver
 * accumulates BEFORE it can verify anything, so it has to have a ceiling
 * at all. Without one a peer can announce half a terabyte.
 */
export const MAX_PART_BYTES = 512 * 1024 * 1024

export interface PortablePartInfo {
  id: PortablePartId
  bytes: number
  /** SHA-256 of the part's bytes, hex. Verified before anything is kept. */
  sha256: string
  mime: string
}

/**
 * What the receiver is told before any bytes move.
 *
 * `fileHash` is the song's identity across devices -- the same key the
 * cloud manifest list uses -- so a receiver can answer "already have it"
 * from the manifest alone.
 */
export interface PortableBundleManifest {
  format: 'mercurypitch-song'
  version: number
  song: {
    fileHash: string
    title: string
    durationSec?: number
    /** The tier the audio parts were encoded at. */
    quality: PortableTier
  }
  parts: PortablePartInfo[]
}

/**
 * The prepared-song data, as one small JSON part.
 *
 * Lyrics, word timings, the transcription and the pitch analysis are
 * kilobytes beside the stems, and they are most of what makes a song
 * *prepared* rather than merely separated -- a copy arriving without
 * them would look broken to the person who spent an evening timing the
 * words. Shapes are the export service's own (`ExportPayload`), so a
 * bundle and a ZIP cannot drift apart about what preparation means.
 */
export interface PortablePrep {
  version: 1
  lyrics: unknown | null
  transcription: unknown | null
  pitchAnalysis: unknown | null
  fingerprint: unknown | null
}

export function encodePrep(prep: PortablePrep): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(prep))
}

export function decodePrep(bytes: Uint8Array): PortablePrep | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as PortablePrep
  } catch {
    return null
  }
}

export class PortablePartCorruptError extends Error {
  constructor(part: PortablePartId) {
    super(`The ${part} part did not arrive intact.`)
    this.name = 'PortablePartCorruptError'
  }
}

/**
 * Refuse bytes that are not the ones the manifest promised.
 *
 * Length first because it is free; the hash catches everything else. A
 * transport that reorders, truncates or corrupts a part is caught HERE,
 * once, instead of by every transport separately -- this check is the
 * reason the bundle can be carried over anything.
 */
export async function verifyPart(
  info: PortablePartInfo,
  bytes: Uint8Array,
): Promise<void> {
  if (bytes.byteLength !== info.bytes) {
    throw new PortablePartCorruptError(info.id)
  }
  // Copy into a fresh ArrayBuffer: a view's backing buffer may be shared
  // or larger than the view, and the digest wants exactly these bytes.
  const exact = new Uint8Array(bytes).slice()
  const hash = await sha256Hex(exact.buffer as ArrayBuffer)
  if (hash !== info.sha256) throw new PortablePartCorruptError(info.id)
}

/** The stem a part carries, or null for the ones that are not audio. */
export function stemOfPart(
  id: PortablePartId,
): 'vocal' | 'instrumental' | null {
  if (id === 'stem:vocal') return 'vocal'
  if (id === 'stem:instrumental') return 'instrumental'
  return null
}

/**
 * Whether a parsed object is a bundle manifest this build can read.
 *
 * A manifest arrives over a wire or out of a Drive file, so it is data,
 * not a type -- everything is checked. Newer minor additions pass (extra
 * fields are ignored); a higher version does not, because misreading a
 * song is worse than declining one.
 */
export function isReadableManifest(
  value: unknown,
): value is PortableBundleManifest {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Record<string, unknown>
  if (m.format !== 'mercurypitch-song') return false
  if (typeof m.version !== 'number' || m.version > PORTABLE_BUNDLE_VERSION) {
    return false
  }
  const song = m.song as Record<string, unknown> | undefined
  if (typeof song !== 'object' || song === null) return false
  if (typeof song.fileHash !== 'string' || song.fileHash === '') return false
  if (typeof song.title !== 'string') return false
  if (!Array.isArray(m.parts) || m.parts.length === 0) return false
  // At most one of each known part. The ids are a closed set, so this is
  // also the part-count bound -- a manifest cannot announce a hundred
  // thousand parts and make the receiver ask for each in turn.
  if (m.parts.length > PORTABLE_PART_IDS.length) return false
  const seen = new Set<string>()
  return m.parts.every((p: unknown) => {
    if (typeof p !== 'object' || p === null) return false
    const part = p as Record<string, unknown>
    if (typeof part.id !== 'string') return false
    if (!(PORTABLE_PART_IDS as readonly string[]).includes(part.id))
      return false
    if (seen.has(part.id)) return false
    seen.add(part.id)
    // A byte count is a promise the receiver accumulates against, so it
    // has to be a real, bounded, positive number. `typeof === 'number'`
    // alone let NaN and Infinity through, and against those the
    // receiver's "more than you announced" guard can never trip and its
    // "that is all of it" test can never pass: it buffered chunks for
    // ever. No real part is empty either -- an absent one is omitted
    // from the manifest, never announced as zero bytes.
    return (
      typeof part.bytes === 'number' &&
      Number.isSafeInteger(part.bytes) &&
      part.bytes > 0 &&
      part.bytes <= MAX_PART_BYTES &&
      typeof part.sha256 === 'string' &&
      typeof part.mime === 'string'
    )
  })
}
