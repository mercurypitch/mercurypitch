// ============================================================
// Canonical Studio PCM — versioned, hash-checked, little-endian source samples
// ============================================================

import type { PcmAudio, StudioImportLimits } from './import-limits'
import { admitWorkingBytes, checkImportCancelled, importCheckpoint, importLimits, validatePcmDimensions, } from './import-limits'
import { sha256InPlace } from './sha256'

export const CANONICAL_PCM_VERSION = 1
export const CANONICAL_PCM_HEADER_BYTES = 32
export const CANONICAL_PCM_MIME = 'application/vnd.mercurypitch.pcm'
const MAGIC = 0x4d43504d // MPCM as little-endian bytes.
const CHUNK_SAMPLES = 65_536
// Canonical PCM is little-endian Float32, so on a little-endian platform (every
// browser in use) samples are read and written through typed views, not per value.
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1

function allFinite(samples: Float32Array, from: number, to: number): boolean {
  for (let index = from; index < to; index++)
    if (!Number.isFinite(samples[index])) return false
  return true
}

export interface CanonicalPcmMetadata {
  channels: 1 | 2
  normalizedSampleRate: 48_000
  normalizedFrameCount: number
  canonicalPcmByteLength: number
  canonicalPcmSha256: string
}

export interface CanonicalPcmOptions {
  signal?: AbortSignal
  limits?: Partial<StudioImportLimits>
}

export async function sha256Bytes(bytes: ArrayBuffer): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('')
}

async function writeChannel(
  samples: Float32Array,
  output: Float32Array,
  signal?: AbortSignal,
): Promise<void> {
  for (let from = 0; from < samples.length; from += CHUNK_SAMPLES) {
    const end = Math.min(samples.length, from + CHUNK_SAMPLES)
    if (!allFinite(samples, from, end))
      throw new Error('This audio contains invalid samples.')
    output.set(samples.subarray(from, end), from)
    await importCheckpoint(signal)
  }
}

async function writeChannelByValue(
  samples: Float32Array,
  view: DataView,
  offset: number,
  signal?: AbortSignal,
): Promise<void> {
  for (let from = 0; from < samples.length; from += CHUNK_SAMPLES) {
    const end = Math.min(samples.length, from + CHUNK_SAMPLES)
    for (let frame = from; frame < end; frame++) {
      const sample = samples[frame]
      if (!Number.isFinite(sample))
        throw new Error('This audio contains invalid samples.')
      view.setFloat32(offset + frame * 4, sample, true)
    }
    await importCheckpoint(signal)
  }
}

export async function encodeCanonicalPcm(
  audio: PcmAudio,
  options: CanonicalPcmOptions = {},
): Promise<Blob> {
  checkImportCancelled(options.signal)
  const limits = importLimits(options.limits)
  validatePcmDimensions(audio, limits)
  const size =
    CANONICAL_PCM_HEADER_BYTES + audio.length * audio.numberOfChannels * 4
  admitWorkingBytes(size * 3, limits)
  const bytes = new ArrayBuffer(size)
  const view = new DataView(bytes)
  view.setUint32(0, MAGIC, true)
  view.setUint16(4, CANONICAL_PCM_VERSION, true)
  view.setUint16(6, CANONICAL_PCM_HEADER_BYTES, true)
  view.setUint32(8, 48_000, true)
  view.setUint16(12, audio.numberOfChannels, true)
  view.setUint16(14, 1, true) // Planar Float32, little endian.
  view.setUint32(16, audio.length, true)
  view.setUint32(20, size - CANONICAL_PCM_HEADER_BYTES, true)
  // Bytes 24..31 remain reserved zeroes; readers reject unknown extensions.
  for (let channel = 0; channel < audio.numberOfChannels; channel++) {
    const samples = audio.getChannelData(channel)
    if (samples.length !== audio.length)
      throw new Error('Audio channel lengths do not match')
    const offset = CANONICAL_PCM_HEADER_BYTES + channel * audio.length * 4
    if (LITTLE_ENDIAN)
      await writeChannel(
        samples,
        new Float32Array(bytes, offset, audio.length),
        options.signal,
      )
    else await writeChannelByValue(samples, view, offset, options.signal)
  }
  return new Blob([bytes], { type: CANONICAL_PCM_MIME })
}

function validateHeader(
  bytes: ArrayBuffer,
  metadata: CanonicalPcmMetadata,
  limits: StudioImportLimits,
): DataView {
  if (bytes.byteLength < CANONICAL_PCM_HEADER_BYTES)
    throw new Error('Studio audio header is incomplete')
  const view = new DataView(bytes)
  const channels = view.getUint16(12, true)
  const frames = view.getUint32(16, true)
  if (
    view.getUint32(0, true) !== MAGIC ||
    view.getUint16(4, true) !== 1 ||
    view.getUint16(6, true) !== CANONICAL_PCM_HEADER_BYTES ||
    view.getUint16(14, true) !== 1 ||
    view.getUint32(24, true) !== 0 ||
    view.getUint32(28, true) !== 0
  ) {
    throw new Error('Studio audio format is not supported')
  }
  validatePcmDimensions(
    {
      sampleRate: view.getUint32(8, true),
      numberOfChannels: channels,
      length: frames,
      getChannelData: () => new Float32Array(),
    },
    limits,
  )
  const expectedSize = CANONICAL_PCM_HEADER_BYTES + frames * channels * 4
  if (
    view.getUint32(20, true) !== expectedSize - CANONICAL_PCM_HEADER_BYTES ||
    bytes.byteLength !== expectedSize ||
    metadata.canonicalPcmByteLength !== expectedSize ||
    metadata.channels !== channels ||
    metadata.normalizedSampleRate !== 48_000 ||
    metadata.normalizedFrameCount !== frames
  ) {
    throw new Error('Studio audio does not match its saved metadata')
  }
  return view
}

function checkCanonicalSize(
  byteLength: number,
  metadata: CanonicalPcmMetadata,
  limits: StudioImportLimits,
): void {
  const maximumSize = CANONICAL_PCM_HEADER_BYTES + limits.maxFrames * 2 * 4
  if (
    byteLength !== metadata.canonicalPcmByteLength ||
    byteLength > maximumSize ||
    byteLength < CANONICAL_PCM_HEADER_BYTES ||
    !/^[a-f0-9]{64}$/.test(metadata.canonicalPcmSha256)
  ) {
    throw new Error('Studio audio size or hash is invalid')
  }
}

/** Every sample must be a finite number; the header was checked first. */
async function checkSamples(
  bytes: ArrayBuffer,
  view: DataView,
  signal?: AbortSignal,
): Promise<void> {
  const sampleCount = (bytes.byteLength - CANONICAL_PCM_HEADER_BYTES) / 4
  if (LITTLE_ENDIAN) {
    const samples = new Float32Array(
      bytes,
      CANONICAL_PCM_HEADER_BYTES,
      sampleCount,
    )
    for (let from = 0; from < sampleCount; from += CHUNK_SAMPLES) {
      if (
        !allFinite(samples, from, Math.min(sampleCount, from + CHUNK_SAMPLES))
      )
        throw new Error('Studio audio contains invalid samples')
      await importCheckpoint(signal)
    }
    return
  }
  for (let from = 0; from < sampleCount; from += CHUNK_SAMPLES) {
    for (
      let sample = from;
      sample < Math.min(sampleCount, from + CHUNK_SAMPLES);
      sample++
    ) {
      if (
        !Number.isFinite(
          view.getFloat32(CANONICAL_PCM_HEADER_BYTES + sample * 4, true),
        )
      ) {
        throw new Error('Studio audio contains invalid samples')
      }
    }
    await importCheckpoint(signal)
  }
}

export async function readCanonicalPcmBytes(
  blob: Blob,
  metadata: CanonicalPcmMetadata,
  options: CanonicalPcmOptions = {},
): Promise<ArrayBuffer> {
  checkImportCancelled(options.signal)
  const limits = importLimits(options.limits)
  checkCanonicalSize(blob.size, metadata, limits)
  admitWorkingBytes(blob.size * 3, limits)
  const bytes = await blob.arrayBuffer()
  checkImportCancelled(options.signal)
  const view = validateHeader(bytes, metadata, limits)
  if ((await sha256Bytes(bytes)) !== metadata.canonicalPcmSha256)
    throw new Error('Studio audio checksum failed')
  checkImportCancelled(options.signal)
  await checkSamples(bytes, view, options.signal)
  return bytes
}

/**
 * The same checks for canonical PCM the caller already holds as bytes. The
 * hash reads them in place, so checking a take needs no second copy of it.
 */
export async function validateCanonicalPcmBytes(
  bytes: ArrayBuffer,
  metadata: CanonicalPcmMetadata,
  options: CanonicalPcmOptions = {},
): Promise<void> {
  checkImportCancelled(options.signal)
  const limits = importLimits(options.limits)
  checkCanonicalSize(bytes.byteLength, metadata, limits)
  const view = validateHeader(bytes, metadata, limits)
  if (
    (await sha256InPlace(bytes, options.signal)) !== metadata.canonicalPcmSha256
  )
    throw new Error('Studio audio checksum failed')
  await checkSamples(bytes, view, options.signal)
}

/** Validate restore bytes without creating an AudioContext or allocating channels. */
export async function validateCanonicalPcm(
  blob: Blob,
  metadata: CanonicalPcmMetadata,
  options: CanonicalPcmOptions = {},
): Promise<void> {
  await readCanonicalPcmBytes(blob, metadata, options)
}

/** Rebuild derived channel arrays from durable PCM, never a browser codec. */
export async function decodeCanonicalPcm(
  blob: Blob,
  metadata: CanonicalPcmMetadata,
  options: CanonicalPcmOptions = {},
): Promise<PcmAudio> {
  const bytes = await readCanonicalPcmBytes(blob, metadata, options)
  const view = new DataView(bytes)
  const channels: Float32Array[] = []
  for (let channel = 0; channel < metadata.channels; channel++) {
    if (LITTLE_ENDIAN) {
      // Views share the bytes just read, so decoding adds no second copy.
      channels.push(
        new Float32Array(
          bytes,
          CANONICAL_PCM_HEADER_BYTES +
            channel * metadata.normalizedFrameCount * 4,
          metadata.normalizedFrameCount,
        ),
      )
      continue
    }
    const samples = new Float32Array(metadata.normalizedFrameCount)
    for (let from = 0; from < samples.length; from += CHUNK_SAMPLES) {
      for (
        let frame = from;
        frame < Math.min(samples.length, from + CHUNK_SAMPLES);
        frame++
      ) {
        samples[frame] = view.getFloat32(
          CANONICAL_PCM_HEADER_BYTES + (channel * samples.length + frame) * 4,
          true,
        )
      }
      await importCheckpoint(options.signal)
    }
    channels.push(samples)
  }
  return {
    sampleRate: 48_000,
    numberOfChannels: channels.length,
    length: metadata.normalizedFrameCount,
    getChannelData: (channel) => {
      const samples = channels[channel]
      if (samples === undefined)
        throw new RangeError('Audio channel is out of range')
      return samples
    },
  }
}
