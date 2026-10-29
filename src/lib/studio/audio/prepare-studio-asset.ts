// ============================================================
// Studio asset preparation — one selected source, decoded once, owned immutably
// ============================================================

import { reserveStudioMemory } from '@/lib/studio/memory-budget'
import type { StudioAsset, StudioAssetBytes, StudioAssetData, } from '@/lib/studio/model/types'
import { validateStudioAsset } from '@/lib/studio/model/validation'
import { CANONICAL_PCM_HEADER_BYTES, encodeCanonicalPcm, sha256Bytes, validateCanonicalPcm, validateCanonicalPcmBytes, } from './canonical-pcm'
import type { PcmAudio, StudioImportLimits } from './import-limits'
import { admitWorkingBytes, checkImportCancelled, importLimits, validatePcmDimensions, } from './import-limits'
import { PREPARATION_ANALYSIS_BYTES, sourcePreparation, } from './preparation-gain'
import { sha256InPlace } from './sha256'

export interface StudioAssetInfo {
  id: string
  projectId: string
  originalName?: string
  provenance: StudioAsset['provenance']
}

export interface StudioDecodeContext {
  readonly sampleRate: number
  decodeAudioData(bytes: ArrayBuffer): Promise<PcmAudio>
}

export interface PrepareStudioAssetOptions {
  signal?: AbortSignal
  limits?: Partial<StudioImportLimits>
  /** Owned offline decoder only. Studio never resumes or closes a host context. */
  createDecodeContext?: () => StudioDecodeContext
  /** Known kept-source size permits admission before reading its stored payload. */
  encodedByteLength?: number
}

let activePreparation = false

async function withPreparation<T>(
  signal: AbortSignal | undefined,
  work: () => Promise<T>,
): Promise<T> {
  checkImportCancelled(signal)
  if (activePreparation)
    throw new Error(
      'Another audio import is still finishing. Try again in a moment.',
    )
  activePreparation = true
  try {
    return await work()
  } finally {
    // Aborting does not release this slot early: native decoding cannot be
    // cancelled, so another import must wait until its Promise has settled.
    activePreparation = false
  }
}

function offlineDecoder(): StudioDecodeContext {
  return new OfflineAudioContext(2, 1, 48_000)
}

function validateEncodedSize(blob: Blob, limits: StudioImportLimits): void {
  if (
    !Number.isSafeInteger(blob.size) ||
    blob.size <= 0 ||
    blob.size > limits.maxEncodedBytes
  ) {
    throw new Error('This audio is empty or too large. Choose a smaller file.')
  }
}

function reservePreparation(
  encodedBytes: number,
  options: PrepareStudioAssetOptions,
): () => void {
  const limits = importLimits(options.limits)
  if (
    !Number.isSafeInteger(encodedBytes) ||
    encodedBytes <= 0 ||
    encodedBytes > limits.maxEncodedBytes
  )
    throw new Error('This audio is empty or too large. Choose a smaller file.')
  // Read copies and rolling analysis. The decode, canonical and hash copies are
  // admitted once the decode reports its real length (reserveDecoded), not at
  // the five-minute maximum, which alone took most of the Studio budget.
  // Browser-private codec scratch memory cannot be bounded here.
  const maximumPcmBytes = limits.maxFrames * 2 * 4 + CANONICAL_PCM_HEADER_BYTES
  admitWorkingBytes(
    encodedBytes * 2 + maximumPcmBytes * 3 + PREPARATION_ANALYSIS_BYTES,
    limits,
  )
  return reserveStudioMemory(encodedBytes * 2 + PREPARATION_ANALYSIS_BYTES)
}

/** The decoded channels, the canonical encode and its hash copy. */
function reserveDecoded(audio: PcmAudio): () => void {
  return reserveStudioMemory(
    (audio.length * audio.numberOfChannels * 4 + CANONICAL_PCM_HEADER_BYTES) *
      3,
  )
}

async function prepareSelectedBlob(
  blob: Blob,
  info: StudioAssetInfo,
  options: PrepareStudioAssetOptions,
): Promise<StudioAssetData> {
  checkImportCancelled(options.signal)
  const limits = importLimits(options.limits)
  validateEncodedSize(blob, limits)
  const bytes = await blob.arrayBuffer()
  checkImportCancelled(options.signal)
  const sha256 = await sha256Bytes(bytes)
  checkImportCancelled(options.signal)
  const context = (options.createDecodeContext ?? offlineDecoder)()
  if (context.sampleRate !== 48_000)
    throw new Error('Studio decoding needs a 48 kHz offline context')
  let decoded: PcmAudio
  try {
    decoded = await context.decodeAudioData(bytes)
  } catch {
    checkImportCancelled(options.signal)
    throw new Error(
      'This browser could not read the audio. Try a WAV or MP3 file.',
    )
  }
  checkImportCancelled(options.signal)
  validatePcmDimensions(decoded, limits)
  const releaseDecoded = reserveDecoded(decoded)
  let preparation: StudioAsset['preparation']
  let canonicalPcm: Blob
  let canonicalPcmSha256: string
  try {
    preparation = await sourcePreparation(decoded, options.signal)
    canonicalPcm = await encodeCanonicalPcm(decoded, options)
    checkImportCancelled(options.signal)
    canonicalPcmSha256 = await sha256Bytes(await canonicalPcm.arrayBuffer())
    checkImportCancelled(options.signal)
  } finally {
    releaseDecoded()
  }
  const asset = validateStudioAsset({
    id: info.id,
    projectId: info.projectId,
    sha256,
    mimeType: blob.type || 'application/octet-stream',
    byteLength: blob.size,
    channels: decoded.numberOfChannels,
    normalizedSampleRate: 48_000,
    normalizedFrameCount: decoded.length,
    importVersion: 1,
    ...(info.originalName === undefined
      ? {}
      : { originalName: info.originalName }),
    canonicalPcmId: globalThis.crypto.randomUUID(),
    canonicalPcmSha256,
    canonicalPcmByteLength: canonicalPcm.size,
    preparation,
    provenance: {
      kind: info.provenance.kind,
      ...(info.provenance.sourceId === undefined
        ? {}
        : { sourceId: info.provenance.sourceId }),
      importedAt: info.provenance.importedAt,
    },
  })
  return { asset, original: blob, canonicalPcm }
}

export async function prepareStudioAsset(
  blob: Blob,
  info: StudioAssetInfo,
  options: PrepareStudioAssetOptions = {},
): Promise<StudioAssetData> {
  return withPreparation(options.signal, async () => {
    const release = reservePreparation(blob.size, options)
    try {
      return await prepareSelectedBlob(blob, info, options)
    } finally {
      release()
    }
  })
}

/** Acquire admission before a selected kept take's DB payload is read. */
export async function prepareStudioAssetFrom(
  readBlob: () => Promise<Blob>,
  info: StudioAssetInfo,
  options: PrepareStudioAssetOptions = {},
): Promise<StudioAssetData> {
  return withPreparation(options.signal, async () => {
    const admittedSize =
      options.encodedByteLength ?? importLimits(options.limits).maxEncodedBytes
    const release = reservePreparation(admittedSize, options)
    try {
      const blob = await readBlob()
      checkImportCancelled(options.signal)
      if (blob.size > admittedSize)
        throw new Error(
          'This audio changed since it was selected. Choose it again.',
        )
      return await prepareSelectedBlob(blob, info, options)
    } finally {
      release()
    }
  })
}

/** Shared by storage and restore. Never re-decodes originals or changes gain. */
export async function validatePreparedStudioAsset(
  data: StudioAssetData,
  options: Omit<PrepareStudioAssetOptions, 'createDecodeContext'> = {},
): Promise<void> {
  checkImportCancelled(options.signal)
  const asset = validateStudioAsset(data.asset)
  const limits = importLimits(options.limits)
  validateEncodedSize(data.original, limits)
  if (
    data.original.size !== asset.byteLength ||
    (data.original.type || 'application/octet-stream') !== asset.mimeType
  ) {
    throw new Error('Original audio does not match its saved metadata')
  }
  admitWorkingBytes(data.original.size * 2 + data.canonicalPcm.size * 3, limits)
  const originalHash = await sha256Bytes(await data.original.arrayBuffer())
  checkImportCancelled(options.signal)
  if (originalHash !== asset.sha256)
    throw new Error('Original audio checksum failed')
  await validateCanonicalPcm(data.canonicalPcm, asset, options)
}

type BytesCheckOptions = Omit<PrepareStudioAssetOptions, 'createDecodeContext'>

/** Checks handed-over audio somewhere other than this thread, and gives back the bytes to keep. */
export type StudioBytesChecker = (
  data: StudioAssetBytes,
  options: BytesCheckOptions,
) => Promise<StudioAssetBytes>

let offThreadChecker: StudioBytesChecker | null = null

/** Route checks of handed-over audio through `checker` until it is cleared with null. */
export function setStudioBytesChecker(
  checker: StudioBytesChecker | null,
): void {
  offThreadChecker = checker
}

function checkBytesSize(
  data: StudioAssetBytes,
  options: BytesCheckOptions,
): StudioAsset {
  checkImportCancelled(options.signal)
  const asset = validateStudioAsset(data.asset)
  const limits = importLimits(options.limits)
  const size = data.original.byteLength
  if (size <= 0 || size > limits.maxEncodedBytes)
    throw new Error('This audio is empty or too large. Choose a smaller file.')
  if (size !== asset.byteLength)
    throw new Error('Original audio does not match its saved metadata')
  return asset
}

/** Both hashes and every sample of audio held as bytes, read in place. */
export async function checkStudioBytesHere(
  data: StudioAssetBytes,
  options: BytesCheckOptions = {},
): Promise<void> {
  if (
    (await sha256InPlace(data.original, options.signal)) !== data.asset.sha256
  )
    throw new Error('Original audio checksum failed')
  await validateCanonicalPcmBytes(data.canonicalPcm, data.asset, options)
}

/**
 * The same checks for audio held as bytes. Both hashes read the bytes in
 * place, so this allocates nothing the size of the audio.
 */
export async function validatePreparedStudioBytes(
  data: StudioAssetBytes,
  options: BytesCheckOptions = {},
): Promise<void> {
  const asset = checkBytesSize(data, options)
  await checkStudioBytesHere({ ...data, asset }, options)
}

/**
 * The same checks, giving back the bytes to store. While the Studio is open
 * the hashes and the sample scan run in its audio worker: the bytes go there
 * and come back without a copy, so the ones handed back are the ones to
 * keep, and the ones handed in are no longer usable.
 */
export async function checkPreparedStudioBytes(
  data: StudioAssetBytes,
  options: BytesCheckOptions = {},
): Promise<StudioAssetBytes> {
  const asset = checkBytesSize(data, options)
  if (offThreadChecker && options.limits === undefined)
    return offThreadChecker({ ...data, asset }, options)
  await checkStudioBytesHere({ ...data, asset }, options)
  return { ...data, asset }
}
