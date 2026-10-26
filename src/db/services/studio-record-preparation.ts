// Studio record preparation — admit serialization and validation copies before reading audio.
import { validatePreparedStudioAsset } from '@/lib/studio/audio/prepare-studio-asset'
import { reserveStudioMemory } from '@/lib/studio/memory-budget'
import type { StudioAssetData, StudioProject } from '@/lib/studio/model/types'
import { validateStudioAsset } from '@/lib/studio/model/validation'
import type { PreparedStudioRecords } from './studio-records'
import { StudioStorageError } from './studio-storage-types'

async function prepareRecords(
  project: StudioProject,
  inputs: readonly StudioAssetData[],
  now: string,
): Promise<PreparedStudioRecords[]> {
  const result: PreparedStudioRecords[] = []
  const ids = new Set<string>()
  for (const input of inputs) {
    try {
      const asset = validateStudioAsset(structuredClone(input.asset))
      if (asset.projectId !== project.id || ids.has(asset.id))
        throw new Error('Asset ownership or identity mismatch')
      ids.add(asset.id)
      await validatePreparedStudioAsset({ ...input, asset })
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
          data: await input.original.arrayBuffer(),
        },
        canonical: {
          ...base,
          id: asset.canonicalPcmId,
          kind: 'canonical',
          data: await input.canonicalPcm.arrayBuffer(),
        },
      })
    } catch (cause) {
      throw new StudioStorageError(
        'invalid-asset',
        'The selected audio is incomplete or does not match its metadata.',
        cause,
      )
    }
  }
  return result
}

/** Input Blobs belong to the caller; this reservation covers only additional copies. */
export async function withPreparedStudioRecords<T>(
  project: StudioProject,
  inputs: readonly StudioAssetData[],
  now: string,
  operation: (records: readonly PreparedStudioRecords[]) => Promise<T>,
): Promise<T> {
  let retainedBytes = 0
  let peakBytes = 0
  for (const input of inputs) {
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
    throw new StudioStorageError(
      'memory-limit',
      'Studio needs more memory to save this audio. Stop playback and retry. Your unsaved edits are still available.',
      cause,
    )
  }
  try {
    return await operation(await prepareRecords(project, inputs, now))
  } finally {
    // Even cancellation or an IndexedDB rollback must finish before release.
    release()
  }
}
