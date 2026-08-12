// ── Portable container ───────────────────────────────────────────────
// A portable bundle as ONE file, without giving up the parts.
//
// Some transports hold files, not conversations: Google Drive stores one
// object per song, a USB stick holds a file, an email attaches one. The
// container is the bundle laid out flat -- a fixed header, the manifest,
// then every part at an offset COMPUTABLE from the manifest alone. A
// reader fetches the header, and from then on it is back in bundle land:
// each part is range-read, verified against its manifest hash, and
// written down one at a time. Nothing ever needs the whole file in
// memory, which is the same property the bundle exists for -- this is
// not a ZIP with a different name (nothing is compressed or re-encoded;
// AAC does not compress further).
//
// Layout, all integers little-endian:
//
//   bytes 0-3   magic 'MPSB'
//   bytes 4-7   u32 container version
//   bytes 8-11  u32 manifest JSON byte length
//   bytes 12-   manifest JSON (PortableBundleManifest)
//   then        each part's bytes, in manifest order, no padding
//
// See docs/plans/device-sync.md (Phase 4).

import type { PortableBundleManifest, PortablePartId } from './portable-bundle'
import { isReadableManifest } from './portable-bundle'

export const CONTAINER_MAGIC = 'MPSB'
export const CONTAINER_VERSION = 1
const FIXED_HEADER_BYTES = 12

/**
 * How much of the file a reader fetches first. Every real manifest is
 * well under a kilobyte; 64 KiB leaves room for the format to grow
 * without a second round trip.
 */
export const CONTAINER_HEAD_FETCH_BYTES = 64 * 1024

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** The header bytes for a manifest: magic, version, length, JSON. */
export function encodeContainerHeader(
  manifest: PortableBundleManifest,
): Uint8Array {
  const json = encoder.encode(JSON.stringify(manifest))
  const out = new Uint8Array(FIXED_HEADER_BYTES + json.byteLength)
  out.set(encoder.encode(CONTAINER_MAGIC), 0)
  const view = new DataView(out.buffer)
  view.setUint32(4, CONTAINER_VERSION, true)
  view.setUint32(8, json.byteLength, true)
  out.set(json, FIXED_HEADER_BYTES)
  return out
}

export interface ParsedContainerHeader {
  manifest: PortableBundleManifest
  /** Where the first part's bytes begin. */
  headerBytes: number
}

export type ContainerHeadResult =
  | { outcome: 'ok'; header: ParsedContainerHeader }
  /** A well-formed head that needs `wanted` bytes to finish parsing. */
  | { outcome: 'need-more'; wanted: number }
  | { outcome: 'unreadable' }

/**
 * Read the header out of the first bytes of a container.
 *
 * Total-length aware: `need-more` says exactly how many bytes to fetch
 * when the manifest outgrew the first read, and anything that is not a
 * container this build can trust -- wrong magic, future version, JSON
 * that is not a readable manifest -- is `unreadable` rather than a
 * guess, because misreading a song is worse than declining one.
 */
export function parseContainerHead(bytes: Uint8Array): ContainerHeadResult {
  if (bytes.byteLength < FIXED_HEADER_BYTES) {
    return { outcome: 'need-more', wanted: FIXED_HEADER_BYTES }
  }
  const magic = decoder.decode(bytes.subarray(0, 4))
  if (magic !== CONTAINER_MAGIC) return { outcome: 'unreadable' }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const version = view.getUint32(4, true)
  if (version > CONTAINER_VERSION) return { outcome: 'unreadable' }
  const manifestBytes = view.getUint32(8, true)
  // A manifest is kilobytes; a length claiming megabytes is corruption,
  // and following it would ask a transport for garbage.
  if (manifestBytes <= 0 || manifestBytes > 4 * 1024 * 1024) {
    return { outcome: 'unreadable' }
  }
  const headerBytes = FIXED_HEADER_BYTES + manifestBytes
  if (bytes.byteLength < headerBytes) {
    return { outcome: 'need-more', wanted: headerBytes }
  }
  let manifest: unknown
  try {
    manifest = JSON.parse(
      decoder.decode(bytes.subarray(FIXED_HEADER_BYTES, headerBytes)),
    )
  } catch {
    return { outcome: 'unreadable' }
  }
  if (!isReadableManifest(manifest)) return { outcome: 'unreadable' }
  return { outcome: 'ok', header: { manifest, headerBytes } }
}

export interface PartRange {
  /** Absolute offset of the part's first byte in the container. */
  start: number
  /** Absolute offset one past the part's last byte. */
  end: number
}

/**
 * Where each part lives, computed from the manifest alone -- the whole
 * point of the layout: a reader that has the header can range-read any
 * part without touching the bytes in between.
 */
export function containerPartRanges(
  header: ParsedContainerHeader,
): Map<PortablePartId, PartRange> {
  const ranges = new Map<PortablePartId, PartRange>()
  let at = header.headerBytes
  for (const part of header.manifest.parts) {
    ranges.set(part.id, { start: at, end: at + part.bytes })
    at += part.bytes
  }
  return ranges
}

/** Total container size for a manifest, header included. */
export function containerTotalBytes(manifest: PortableBundleManifest): number {
  return (
    FIXED_HEADER_BYTES +
    encoder.encode(JSON.stringify(manifest)).byteLength +
    manifest.parts.reduce((n, p) => n + p.bytes, 0)
  )
}

/**
 * Lay a built bundle out as one Blob.
 *
 * A Blob of views, not one copied buffer: the browser keeps the pieces
 * and an uploader slices what it needs, so building the container does
 * not double the bundle's memory.
 */
export function buildContainerBlob(bundle: {
  manifest: PortableBundleManifest
  parts: ReadonlyMap<PortablePartId, Uint8Array>
}): Blob {
  const pieces: BlobPart[] = [
    encodeContainerHeader(bundle.manifest) as unknown as BlobPart,
  ]
  for (const part of bundle.manifest.parts) {
    const bytes = bundle.parts.get(part.id)
    if (bytes === undefined) {
      throw new Error(`The bundle is missing its ${part.id} part.`)
    }
    if (bytes.byteLength !== part.bytes) {
      // A manifest that disagrees with its own parts would produce a
      // container whose computed offsets point at the wrong bytes.
      throw new Error(`The ${part.id} part does not match its manifest size.`)
    }
    // One copy, not two: `new Uint8Array(view)` already copies, and the
    // extra .slice() that used to follow doubled the transient memory of
    // building a container -- on top of the parts the caller is still
    // holding, on the phones this whole format exists for.
    pieces.push(new Uint8Array(bytes) as unknown as BlobPart)
  }
  return new Blob(pieces, { type: 'application/octet-stream' })
}
