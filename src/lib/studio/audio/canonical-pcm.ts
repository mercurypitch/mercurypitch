// ============================================================
// Canonical Studio PCM — versioned, hash-checked, little-endian source samples
// ============================================================
//
// Two versions share the 32-byte header. Version 1, every song's copy at
// full quality, is planar 32-bit floats with bytes 24..31 reserved zeroes.
// Version 2, Save space's (storage-quality.ts), is planar 16-bit steps with
// the step below zero and the step above it in bytes 24..31
// (canonical-pcm16.ts). A reader takes only the version the take's metadata
// names, so a take cannot change format without its hash and metadata, and
// a build from before version 2 refuses one rather than misreading it.

import type { Pcm16Steps } from './canonical-pcm16'
import { choosePcm16Steps, readPcm16Channel, validPcm16Steps, writePcm16Channel, } from './canonical-pcm16'
import type { PcmAudio, StudioImportLimits } from './import-limits'
import { admitWorkingBytes, checkImportCancelled, importCheckpoint, importLimits, validatePcmDimensions, } from './import-limits'
import { sha256InPlace } from './sha256'

export const CANONICAL_PCM_VERSION = 1
/** The version that keeps 16-bit steps: Save space's copy. */
export const CANONICAL_PCM16_VERSION = 2
export const CANONICAL_PCM_HEADER_BYTES = 32
export const CANONICAL_PCM_MIME = 'application/vnd.mercurypitch.pcm'
const MAGIC = 0x4d43504d // MPCM as little-endian bytes.
const FLOAT32_FORMAT = 1 // Planar Float32, little endian.
const INT16_FORMAT = 2 // Planar 16-bit steps, little endian.
const CHUNK_SAMPLES = 65_536
// Canonical PCM is little-endian, so on a little-endian platform (every
// browser in use) samples are read and written through typed views, not per value.
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1

function allFinite(samples: Float32Array, from: number, to: number): boolean {
  for (let index = from; index < to; index++)
    if (!Number.isFinite(samples[index])) return false
  return true
}

/** How a canonical copy keeps its samples: 32-bit floats (version 1) or 16-bit steps (version 2). */
export type CanonicalPcmFormat = 'float32' | 'int16'

export interface CanonicalPcmMetadata {
  channels: 1 | 2
  normalizedSampleRate: 48_000
  normalizedFrameCount: number
  canonicalPcmByteLength: number
  canonicalPcmSha256: string
  /** Absent for 32-bit floats, the format every take had before Save space. */
  canonicalPcmFormat?: 'int16'
}

export interface CanonicalPcmOptions {
  signal?: AbortSignal
  limits?: Partial<StudioImportLimits>
}

export interface CanonicalPcmEncodeOptions extends CanonicalPcmOptions {
  /** 16-bit steps where the audio allows them; 32-bit floats when absent. */
  format?: CanonicalPcmFormat
}

/** Where a checked header says the samples are, and how to read them. */
export interface CanonicalPcmLayout {
  readonly format: CanonicalPcmFormat
  readonly bytesPerSample: 2 | 4
  /** The steps of a 16-bit copy; null for floats. */
  readonly steps: Pcm16Steps | null
}

export function canonicalPcmBytesPerSample(format: CanonicalPcmFormat): 2 | 4 {
  return format === 'int16' ? 2 : 4
}

/** The size of a canonical copy of this many frames: its header and its samples. */
export function canonicalPcmByteLength(
  frames: number,
  channels: number,
  format: CanonicalPcmFormat,
): number {
  return (
    CANONICAL_PCM_HEADER_BYTES +
    frames * channels * canonicalPcmBytesPerSample(format)
  )
}

/** The format a take's metadata names for its canonical copy. */
export function canonicalPcmFormatOf(
  metadata: Pick<CanonicalPcmMetadata, 'canonicalPcmFormat'>,
): CanonicalPcmFormat {
  return metadata.canonicalPcmFormat === 'int16' ? 'int16' : 'float32'
}

/** The layout of canonical PCM whose header was already checked. */
export function canonicalPcmLayout(header: DataView): CanonicalPcmLayout {
  if (header.getUint16(14, true) !== INT16_FORMAT)
    return { format: 'float32', bytesPerSample: 4, steps: null }
  return {
    format: 'int16',
    bytesPerSample: 2,
    steps: {
      negative: header.getFloat32(24, true),
      positive: header.getFloat32(28, true),
    },
  }
}

/**
 * Channel `channel` of checked canonical PCM as floats, into `output`: the
 * samples themselves for a float copy, what each step stands for in a
 * 16-bit one.
 */
export async function readCanonicalChannel(
  pcm: DataView<ArrayBuffer>,
  layout: CanonicalPcmLayout,
  frames: number,
  channel: number,
  output: Float32Array,
  signal?: AbortSignal,
): Promise<void> {
  const offset =
    pcm.byteOffset +
    CANONICAL_PCM_HEADER_BYTES +
    channel * frames * layout.bytesPerSample
  if (layout.steps !== null) {
    await readPcm16Channel(
      pcm.buffer,
      offset,
      frames,
      layout.steps,
      output,
      signal,
    )
    return
  }
  for (let from = 0; from < frames; from += CHUNK_SAMPLES) {
    const to = Math.min(frames, from + CHUNK_SAMPLES)
    if (LITTLE_ENDIAN)
      output.set(
        new Float32Array(pcm.buffer, offset + from * 4, to - from),
        from,
      )
    else
      for (let frame = from; frame < to; frame++)
        output[frame] = pcm.getFloat32(
          offset - pcm.byteOffset + frame * 4,
          true,
        )
    await importCheckpoint(signal)
  }
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

function writeHeader(
  view: DataView,
  audio: PcmAudio,
  size: number,
  steps: Pcm16Steps | null,
): void {
  view.setUint32(0, MAGIC, true)
  view.setUint16(
    4,
    steps === null ? CANONICAL_PCM_VERSION : CANONICAL_PCM16_VERSION,
    true,
  )
  view.setUint16(6, CANONICAL_PCM_HEADER_BYTES, true)
  view.setUint32(8, 48_000, true)
  view.setUint16(12, audio.numberOfChannels, true)
  view.setUint16(14, steps === null ? FLOAT32_FORMAT : INT16_FORMAT, true)
  view.setUint32(16, audio.length, true)
  view.setUint32(20, size - CANONICAL_PCM_HEADER_BYTES, true)
  // Version 1 leaves bytes 24..31 reserved zeroes; readers reject unknown
  // extensions. Version 2 keeps its steps there.
  if (steps === null) return
  view.setFloat32(24, steps.negative, true)
  view.setFloat32(28, steps.positive, true)
}

function channelsOf(audio: PcmAudio): Float32Array[] {
  return Array.from({ length: audio.numberOfChannels }, (_, channel) => {
    const samples = audio.getChannelData(channel)
    if (samples.length !== audio.length)
      throw new Error('Audio channel lengths do not match')
    return samples
  })
}

/** The 16-bit copy: steps chosen over every channel, then each written as whole steps. */
async function encodePcm16(
  audio: PcmAudio,
  channels: readonly Float32Array[],
  steps: Pcm16Steps,
  limits: StudioImportLimits,
  signal?: AbortSignal,
): Promise<Blob> {
  const size = canonicalPcmByteLength(audio.length, channels.length, 'int16')
  admitWorkingBytes(size * 3, limits)
  const bytes = new ArrayBuffer(size)
  writeHeader(new DataView(bytes), audio, size, steps)
  for (const [channel, samples] of channels.entries())
    await writePcm16Channel(
      samples,
      steps,
      bytes,
      CANONICAL_PCM_HEADER_BYTES + channel * audio.length * 2,
      signal,
    )
  return new Blob([bytes], { type: CANONICAL_PCM_MIME })
}

export async function encodeCanonicalPcm(
  audio: PcmAudio,
  options: CanonicalPcmEncodeOptions = {},
): Promise<Blob> {
  checkImportCancelled(options.signal)
  const limits = importLimits(options.limits)
  validatePcmDimensions(audio, limits)
  if (options.format === 'int16') {
    const channels = channelsOf(audio)
    const steps = await choosePcm16Steps(channels, options.signal)
    // Audio no 16-bit copy can hold keeps 32-bit floats; the take's
    // metadata reads its format from what was written.
    if (steps !== null)
      return encodePcm16(audio, channels, steps, limits, options.signal)
  }
  const size = canonicalPcmByteLength(
    audio.length,
    audio.numberOfChannels,
    'float32',
  )
  admitWorkingBytes(size * 3, limits)
  const bytes = new ArrayBuffer(size)
  const view = new DataView(bytes)
  writeHeader(view, audio, size, null)
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
  const view = new DataView(bytes)
  checkCanonicalPcmHeader(view, bytes.byteLength, metadata, limits)
  return view
}

/** Whether a header's version, format and bytes 24..31 are those of the format its take names. */
function supportedLayout(view: DataView, format: CanonicalPcmFormat): boolean {
  if (format === 'float32')
    return (
      view.getUint16(4, true) === CANONICAL_PCM_VERSION &&
      view.getUint16(14, true) === FLOAT32_FORMAT &&
      view.getUint32(24, true) === 0 &&
      view.getUint32(28, true) === 0
    )
  return (
    view.getUint16(4, true) === CANONICAL_PCM16_VERSION &&
    view.getUint16(14, true) === INT16_FORMAT &&
    validPcm16Steps({
      negative: view.getFloat32(24, true),
      positive: view.getFloat32(28, true),
    })
  )
}

/**
 * The header of canonical PCM `byteLength` bytes long, read from its first
 * bytes: what a reader that streams the take checks before its samples.
 */
export function checkCanonicalPcmHeader(
  view: DataView,
  byteLength: number,
  metadata: CanonicalPcmMetadata,
  limits: StudioImportLimits,
): void {
  if (view.byteLength < CANONICAL_PCM_HEADER_BYTES)
    throw new Error('Studio audio header is incomplete')
  const channels = view.getUint16(12, true)
  const frames = view.getUint32(16, true)
  const format = canonicalPcmFormatOf(metadata)
  if (
    view.getUint32(0, true) !== MAGIC ||
    view.getUint16(6, true) !== CANONICAL_PCM_HEADER_BYTES ||
    !supportedLayout(view, format)
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
  const expectedSize = canonicalPcmByteLength(frames, channels, format)
  if (
    view.getUint32(20, true) !== expectedSize - CANONICAL_PCM_HEADER_BYTES ||
    byteLength !== expectedSize ||
    metadata.canonicalPcmByteLength !== expectedSize ||
    metadata.channels !== channels ||
    metadata.normalizedSampleRate !== 48_000 ||
    metadata.normalizedFrameCount !== frames
  ) {
    throw new Error('Studio audio does not match its saved metadata')
  }
}

/** The size and hash a take of canonical PCM declares must be possible before any of it is read. */
export function checkCanonicalSize(
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

/**
 * Every sample must be a finite number; the header was checked first. A
 * 16-bit copy has nothing to scan: any whole number of its checked steps is
 * a finite float.
 */
async function checkSamples(
  bytes: ArrayBuffer,
  view: DataView,
  signal?: AbortSignal,
): Promise<void> {
  if (canonicalPcmLayout(view).steps !== null) return
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

/** Reads canonical PCM somewhere other than this thread: the Studio's audio worker, while the Studio is open. */
export type CanonicalPcmReader = (
  blob: Blob,
  metadata: CanonicalPcmMetadata,
  options: CanonicalPcmOptions,
) => Promise<ArrayBuffer>

let offThreadReader: CanonicalPcmReader | null = null

/** Route canonical PCM reads through `reader` until it is cleared with null. */
export function setCanonicalPcmReader(reader: CanonicalPcmReader | null): void {
  offThreadReader = reader
}

/**
 * Header and hash of canonical PCM already read. The sample scan is left to
 * the caller, which may scan them anyway while it builds something from them.
 */
export async function checkCanonicalPcmHash(
  bytes: ArrayBuffer,
  metadata: CanonicalPcmMetadata,
  options: CanonicalPcmOptions = {},
): Promise<DataView> {
  const limits = importLimits(options.limits)
  checkCanonicalSize(bytes.byteLength, metadata, limits)
  const view = validateHeader(bytes, metadata, limits)
  if ((await sha256Bytes(bytes)) !== metadata.canonicalPcmSha256)
    throw new Error('Studio audio checksum failed')
  checkImportCancelled(options.signal)
  return view
}

/** Header, hash and every sample of canonical PCM already read. */
export async function checkCanonicalPcm(
  bytes: ArrayBuffer,
  metadata: CanonicalPcmMetadata,
  options: CanonicalPcmOptions = {},
): Promise<void> {
  const view = await checkCanonicalPcmHash(bytes, metadata, options)
  await checkSamples(bytes, view, options.signal)
}

/** The bytes of a take's canonical PCM, read and checked on this thread. */
export async function readCanonicalPcmBytesHere(
  blob: Blob,
  metadata: CanonicalPcmMetadata,
  options: CanonicalPcmOptions = {},
): Promise<ArrayBuffer> {
  const bytes = await blob.arrayBuffer()
  checkImportCancelled(options.signal)
  await checkCanonicalPcm(bytes, metadata, options)
  return bytes
}

/**
 * The bytes of a take's canonical PCM, checked: header, hash and every
 * sample. While the Studio is open the reading and checking happen in its
 * audio worker, and the checked bytes are handed back without a copy.
 */
export async function readCanonicalPcmBytes(
  blob: Blob,
  metadata: CanonicalPcmMetadata,
  options: CanonicalPcmOptions = {},
): Promise<ArrayBuffer> {
  checkImportCancelled(options.signal)
  const limits = importLimits(options.limits)
  checkCanonicalSize(blob.size, metadata, limits)
  admitWorkingBytes(blob.size * 3, limits)
  return (offThreadReader ?? readCanonicalPcmBytesHere)(blob, metadata, options)
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
  const layout = canonicalPcmLayout(view)
  const channels: Float32Array[] = []
  for (let channel = 0; channel < metadata.channels; channel++) {
    if (LITTLE_ENDIAN && layout.steps === null) {
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
    await readCanonicalChannel(
      view,
      layout,
      samples.length,
      channel,
      samples,
      options.signal,
    )
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
