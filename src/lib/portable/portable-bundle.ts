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
  return m.parts.every((p: unknown) => {
    if (typeof p !== 'object' || p === null) return false
    const part = p as Record<string, unknown>
    return (
      typeof part.id === 'string' &&
      typeof part.bytes === 'number' &&
      typeof part.sha256 === 'string' &&
      typeof part.mime === 'string'
    )
  })
}
