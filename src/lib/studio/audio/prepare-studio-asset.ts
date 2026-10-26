// ============================================================
// Studio asset preparation — one selected source, decoded once, owned immutably
// ============================================================

import type { StudioAsset, StudioAssetData } from '@/lib/studio/model/types'
import { validateStudioAsset } from '@/lib/studio/model/validation'
import { CANONICAL_PCM_HEADER_BYTES, encodeCanonicalPcm, sha256Bytes, validateCanonicalPcm, } from './canonical-pcm'
import type { PcmAudio, StudioImportLimits } from './import-limits'
import { admitWorkingBytes, checkImportCancelled, importLimits, validatePcmDimensions, } from './import-limits'
import { PREPARATION_ANALYSIS_BYTES, sourcePreparation, } from './preparation-gain'

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

async function prepareSelectedBlob(
  blob: Blob,
  info: StudioAssetInfo,
  options: PrepareStudioAssetOptions,
): Promise<StudioAssetData> {
  checkImportCancelled(options.signal)
  const limits = importLimits(options.limits)
  validateEncodedSize(blob, limits)
  // Source/read copies + admitted stereo decoded PCM + canonical/hash copies.
  // This reserves the maximum supported decoded size before invoking the
  // browser codec, whose private scratch allocation cannot be controlled here.
  const maximumPcmBytes = limits.maxFrames * 2 * 4 + CANONICAL_PCM_HEADER_BYTES
  admitWorkingBytes(
    blob.size * 2 + maximumPcmBytes * 3 + PREPARATION_ANALYSIS_BYTES,
    limits,
  )
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
  const preparation = await sourcePreparation(decoded, options.signal)
  const canonicalPcm = await encodeCanonicalPcm(decoded, options)
  checkImportCancelled(options.signal)
  const canonicalPcmSha256 = await sha256Bytes(await canonicalPcm.arrayBuffer())
  checkImportCancelled(options.signal)
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
  return withPreparation(options.signal, () =>
    prepareSelectedBlob(blob, info, options),
  )
}

/** Acquire admission before a selected kept take's DB payload is read. */
export async function prepareStudioAssetFrom(
  readBlob: () => Promise<Blob>,
  info: StudioAssetInfo,
  options: PrepareStudioAssetOptions = {},
): Promise<StudioAssetData> {
  return withPreparation(options.signal, async () => {
    const blob = await readBlob()
    checkImportCancelled(options.signal)
    return prepareSelectedBlob(blob, info, options)
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
