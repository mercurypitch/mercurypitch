// ============================================================
// Studio backup — portable local projects with original and canonical audio.
// ============================================================

import type { StudioService } from '@/db/services/studio-service'
import { StudioStorageError } from '@/db/services/studio-service'
import { validatePreparedStudioAsset } from '@/lib/studio/audio/prepare-studio-asset'
import { isStudioMemoryRefusal, releaseStudioResource, reserveStudioMemory, retainStudioResource, StudioMemoryError, } from '@/lib/studio/memory-budget'
import type { StudioAsset, StudioAssetBytes, StudioAssetData, StudioProject, } from '@/lib/studio/model/types'
import { validateStudioAsset, validateStudioProject, } from '@/lib/studio/model/validation'
import { readStudioArchive, studioBackupAssetPath, StudioBackupError, writeStudioArchive, } from './archive-codec'

export { StudioBackupError } from './archive-codec'

interface StudioBackupManifest {
  format: 'mercurypitch-studio'
  version: 1
  project: StudioProject
  assets: { asset: StudioAsset; originalPath: string; canonicalPath: string }[]
}

const BACKUP_MEMORY =
  'Studio needs more memory to make this backup. Stop playback and try again.'
const RESTORE_MEMORY =
  'Studio needs more memory to open this backup. Stop playback and try again.'
const AUDIO_CHECK =
  'The project backup audio failed its size, format or checksum check.'

export interface StudioBackupOptions {
  signal?: AbortSignal
  /** Assets imported into an in-memory revision whose save has not succeeded. */
  preparedAssets?: readonly StudioAssetData[]
  assetMetadata?: readonly StudioAsset[]
}

function exactKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  )
}

function manifestFromJson(value: unknown): StudioBackupManifest {
  if (
    !exactKeys(value, ['format', 'version', 'project', 'assets']) ||
    value.format !== 'mercurypitch-studio' ||
    value.version !== 1 ||
    !Array.isArray(value.assets) ||
    value.assets.length > 128
  ) {
    throw new StudioBackupError(
      'This project backup version or manifest is not supported.',
    )
  }
  const ids = new Set<string>()
  const assets = value.assets.map((entry, index) => {
    if (
      !exactKeys(entry, ['asset', 'originalPath', 'canonicalPath']) ||
      entry.originalPath !== studioBackupAssetPath(index, 'original') ||
      entry.canonicalPath !== studioBackupAssetPath(index, 'canonical')
    ) {
      throw new StudioBackupError(
        'The project backup contains an invalid audio reference.',
      )
    }
    const asset = validateStudioAsset(entry.asset)
    if (ids.has(asset.id))
      throw new StudioBackupError(
        'The project backup contains duplicate audio identities.',
      )
    ids.add(asset.id)
    return {
      asset,
      originalPath: entry.originalPath,
      canonicalPath: entry.canonicalPath,
    }
  })
  const project = validateStudioProject(
    value.project,
    assets.map((entry) => entry.asset),
  )
  const referenced = new Set(project.clips.map((clip) => clip.assetId))
  if (assets.some(({ asset }) => !referenced.has(asset.id))) {
    throw new StudioBackupError(
      'The project backup contains audio outside its arrangement.',
    )
  }
  return { format: 'mercurypitch-studio', version: 1, project, assets }
}

/** Freeze the current arrangement, including unsaved edits; never export history. */
export async function createStudioBackup(
  project: StudioProject,
  readAsset: (assetId: string) => Promise<StudioAssetData>,
  options: StudioBackupOptions = {},
): Promise<Blob> {
  const snapshot = validateStudioProject(structuredClone(project))
  const staged = new Map(
    (options.preparedAssets ?? []).map((data) => [data.asset.id, data]),
  )
  const entries = new Map<string, Blob>()
  const assets: StudioBackupManifest['assets'] = []
  const releases: (() => void)[] = []
  try {
    for (const id of new Set(snapshot.clips.map((clip) => clip.assetId))) {
      options.signal?.throwIfAborted()
      let data: StudioAssetData
      try {
        const known =
          staged.get(id)?.asset ??
          options.assetMetadata?.find((asset) => asset.id === id)
        if (!known)
          throw new Error(
            'Audio metadata is required before reading a backup source',
          )
        // The read Blobs stay held until the archive is written: count once.
        if (!staged.has(id))
          releases.push(
            reserveStudioMemory(
              known.byteLength + known.canonicalPcmByteLength,
            ),
          )
        data = staged.get(id) ?? (await readAsset(id))
        if (data.asset.id !== id || data.asset.projectId !== snapshot.id)
          throw new Error('Audio ownership mismatch')
        const releaseValidation = reserveStudioMemory(
          2 * Math.max(data.original.size, data.canonicalPcm.size),
        )
        try {
          await validatePreparedStudioAsset(data, { signal: options.signal })
        } finally {
          releaseValidation()
        }
      } catch (error) {
        throw backupFailure(error, options.signal)
      }
      const originalPath = studioBackupAssetPath(assets.length, 'original')
      const canonicalPath = studioBackupAssetPath(assets.length, 'canonical')
      assets.push({
        asset: structuredClone(data.asset),
        originalPath,
        canonicalPath,
      })
      entries.set(originalPath, data.original)
      entries.set(canonicalPath, data.canonicalPcm)
    }
    validateStudioProject(
      snapshot,
      assets.map(({ asset }) => asset),
    )
    const manifest: StudioBackupManifest = {
      format: 'mercurypitch-studio',
      version: 1,
      project: snapshot,
      assets,
    }
    // Keep the manifest first to make the archive straightforward to inspect.
    const ordered = new Map<string, Blob>([
      [
        'manifest.json',
        new Blob([JSON.stringify(manifest)], { type: 'application/json' }),
      ],
      ...entries,
    ])
    return await writeStudioArchive(ordered, options.signal)
  } finally {
    for (const release of releases) release()
  }
}

/** Say what stopped a backup: missing room is not missing audio. */
function backupFailure(error: unknown, signal?: AbortSignal): unknown {
  if (signal?.aborted === true) return error
  if (isStudioMemoryRefusal(error)) return new StudioMemoryError(BACKUP_MEMORY)
  return new StudioBackupError(
    'The backup could not include every audio asset. Restore the missing audio and try again.',
  )
}

/**
 * Check the archive, its manifest and every entry's size before any rows are
 * created. The audio is handed over as the bytes the archive was read into;
 * the service checks their hashes and samples, in place, before it writes.
 */
export async function readStudioBackup(
  archive: Blob,
  options: Pick<StudioBackupOptions, 'signal'> = {},
): Promise<{ project: StudioProject; assets: StudioAssetBytes[] }> {
  options.signal?.throwIfAborted()
  const entries = await readStudioArchive(archive, options.signal)
  let transferred = false
  try {
    let manifest: StudioBackupManifest
    try {
      manifest = manifestFromJson(
        JSON.parse(new TextDecoder().decode(entries.get('manifest.json'))),
      )
    } catch (error) {
      if (error instanceof StudioBackupError) throw error
      throw new StudioBackupError(
        'The project backup manifest contains invalid or unsupported data.',
      )
    }
    if (entries.size !== 1 + manifest.assets.length * 2) {
      throw new StudioBackupError(
        'The project backup contains missing or unrelated files.',
      )
    }
    const assets = manifest.assets.map((entry): StudioAssetBytes => {
      const original = entries.get(entry.originalPath)
      const canonicalPcm = entries.get(entry.canonicalPath)
      if (!original || !canonicalPcm)
        throw new StudioBackupError(
          'The project backup is missing audio files.',
        )
      if (
        original.byteLength !== entry.asset.byteLength ||
        canonicalPcm.byteLength !== entry.asset.canonicalPcmByteLength
      )
        throw new StudioBackupError(AUDIO_CHECK)
      return { asset: entry.asset, original, canonicalPcm }
    })
    const result = { project: manifest.project, assets }
    transferred = true
    return retainStudioResource(result, () => releaseStudioResource(entries))
  } finally {
    if (!transferred) releaseStudioResource(entries)
  }
}

/**
 * Restore holds the song's audio once: the archive's entries, read into
 * buffers that the service checks in place and stores as they are.
 */
export async function restoreStudioBackup(
  archive: Blob,
  service: Pick<StudioService, 'restoreProject'>,
  options: Pick<StudioBackupOptions, 'signal'> = {},
): Promise<StudioProject> {
  try {
    const validated = await readStudioBackup(archive, options)
    try {
      options.signal?.throwIfAborted()
      return await service.restoreProject(validated.project, validated.assets, {
        signal: options.signal,
      })
    } finally {
      releaseStudioResource(validated)
    }
  } catch (error) {
    throw restoreFailure(error, options.signal)
  }
}

/** Say what stopped a restore in the backup's own terms. */
function restoreFailure(error: unknown, signal?: AbortSignal): unknown {
  if (signal?.aborted === true) return error
  // Missing room, not a damaged backup.
  if (isStudioMemoryRefusal(error)) return new StudioMemoryError(RESTORE_MEMORY)
  if (error instanceof StudioStorageError && error.code === 'invalid-asset')
    return new StudioBackupError(AUDIO_CHECK)
  return error
}
