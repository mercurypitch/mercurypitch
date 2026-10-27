// Studio record preparation — admit serialization and validation copies before reading audio.
import { validatePreparedStudioAsset, validatePreparedStudioBytes, } from '@/lib/studio/audio/prepare-studio-asset'
import { isStudioMemoryRefusal, reserveStudioMemory, } from '@/lib/studio/memory-budget'
import type { StudioAsset, StudioAssetBytes, StudioAssetData, StudioProject, } from '@/lib/studio/model/types'
import { validateStudioAsset } from '@/lib/studio/model/validation'
import type { PreparedStudioRecords } from './studio-records'
import { StudioStorageError } from './studio-storage-types'

/** Audio a write receives: Blobs still to be read, or bytes handed over. */
export type StudioAssetInput = StudioAssetData | StudioAssetBytes

export function isStudioAssetBytes(
  input: StudioAssetInput,
): input is StudioAssetBytes {
  return input.original instanceof ArrayBuffer
}

const SAVE_MEMORY =
  'Studio needs more memory to save this audio. Stop playback and retry. Your unsaved edits are still available.'

/** Check one input's audio against its validated metadata, and give its bytes. */
async function checkedBytes(
  input: StudioAssetInput,
  asset: StudioAsset,
  signal?: AbortSignal,
): Promise<{ original: ArrayBuffer; canonical: ArrayBuffer }> {
  if (isStudioAssetBytes(input)) {
    // Handed over: hashed in place and stored as they are, never copied.
    await validatePreparedStudioBytes({ ...input, asset }, { signal })
    return { original: input.original, canonical: input.canonicalPcm }
  }
  await validatePreparedStudioAsset({ ...input, asset }, { signal })
  return {
    original: await input.original.arrayBuffer(),
    canonical: await input.canonicalPcm.arrayBuffer(),
  }
}

async function prepareRecords(
  project: StudioProject,
  inputs: readonly StudioAssetInput[],
  now: string,
  signal?: AbortSignal,
): Promise<PreparedStudioRecords[]> {
  const result: PreparedStudioRecords[] = []
  const ids = new Set<string>()
  for (const input of inputs) {
    try {
      const asset = validateStudioAsset(structuredClone(input.asset))
      if (asset.projectId !== project.id || ids.has(asset.id))
        throw new Error('Asset ownership or identity mismatch')
      ids.add(asset.id)
      const bytes = await checkedBytes(input, asset, signal)
      const base = {
        projectId: project.id,
        assetId: asset.id,
        createdAt: now,
        updatedAt: now,
      }
      result.push({
        metadata: {
          id: asset.id,
          projectId: project.id,
          sha256: asset.sha256,
          asset,
          createdAt: now,
          updatedAt: now,
        },
        original: {
          ...base,
          id: `${asset.id}-original`,
          kind: 'original',
          data: bytes.original,
        },
        canonical: {
          ...base,
          id: asset.canonicalPcmId,
          kind: 'canonical',
          data: bytes.canonical,
        },
      })
    } catch (cause) {
      if (signal?.aborted === true) throw cause
      if (isStudioMemoryRefusal(cause))
        throw new StudioStorageError('memory-limit', SAVE_MEMORY, cause)
      throw new StudioStorageError(
        'invalid-asset',
        'The selected audio is incomplete or does not match its metadata.',
        cause,
      )
    }
  }
  return result
}

/**
 * Input Blobs belong to the caller; this reservation covers only additional
 * copies. Bytes handed over are hashed in place and stored as they are, so
 * they add nothing here: whoever holds them has admitted them already.
 */
export async function withPreparedStudioRecords<T>(
  project: StudioProject,
  inputs: readonly StudioAssetInput[],
  now: string,
  operation: (records: readonly PreparedStudioRecords[]) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  let retainedBytes = 0
  let peakBytes = 0
  for (const input of inputs) {
    if (isStudioAssetBytes(input)) continue
    // Validation hashes originals then canonical PCM sequentially. Each needs
    // a read buffer and digest input copy; no decoded channel arrays are made.
    peakBytes = Math.max(
      peakBytes,
      retainedBytes +
        2 * Math.max(input.original.size, input.canonicalPcm.size),
    )
    retainedBytes += input.original.size + input.canonicalPcm.size
    peakBytes = Math.max(peakBytes, retainedBytes)
  }
  let release: () => void
  try {
    release = reserveStudioMemory(peakBytes)
  } catch (cause) {
    throw new StudioStorageError('memory-limit', SAVE_MEMORY, cause)
  }
  try {
    const records = await prepareRecords(project, inputs, now, signal)
    // Cancelled while the audio was checked: nothing has been written yet.
    signal?.throwIfAborted()
    return await operation(records)
  } finally {
    // Even cancellation or an IndexedDB rollback must finish before release.
    release()
  }
}
