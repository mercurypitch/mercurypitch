// ============================================================
// Studio backup — portable local projects with original and canonical audio.
// ============================================================

import type { StudioService } from '@/db/services/studio-service'
import { CANONICAL_PCM_MIME } from '@/lib/studio/audio/canonical-pcm'
import { validatePreparedStudioAsset } from '@/lib/studio/audio/prepare-studio-asset'
import { releaseStudioResource, reserveStudioMemory, retainStudioResource, } from '@/lib/studio/memory-budget'
import type { StudioAsset, StudioAssetData, StudioProject, } from '@/lib/studio/model/types'
import { validateStudioAsset, validateStudioProject, } from '@/lib/studio/model/validation'
import { readStudioArchive, studioBackupAssetPath, StudioBackupError, writeStudioArchive, } from './archive-codec'

export { StudioBackupError } from './archive-codec'

interface StudioBackupManifest {
  format: 'mercurypitch-studio'
  version: 1
  project: StudioProject
  assets: { asset: StudioAsset; originalPath: string; canonicalPath: string }[]
}

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
        if (options.signal?.aborted === true || isMemoryError(error))
          throw error
        throw new StudioBackupError(
          'The backup could not include every audio asset. Restore the missing audio and try again.',
        )
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

/** Validate every byte/reference before creating any rows in the local database. */
export async function readStudioBackup(
  archive: Blob,
  options: Pick<StudioBackupOptions, 'signal'> = {},
): Promise<{ project: StudioProject; assets: StudioAssetData[] }> {
  options.signal?.throwIfAborted()
  const entries = await readStudioArchive(archive, options.signal)
  let transferred = false
  try {
    let manifest: StudioBackupManifest
    try {
      manifest = manifestFromJson(
        JSON.parse(await entries.get('manifest.json')!.text()),
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
    const assets: StudioAssetData[] = []
    for (const entry of manifest.assets) {
      options.signal?.throwIfAborted()
      const original = entries.get(entry.originalPath)
      const canonical = entries.get(entry.canonicalPath)
      if (!original || !canonical)
        throw new StudioBackupError(
          'The project backup is missing audio files.',
        )
      const data: StudioAssetData = {
        asset: entry.asset,
        original: original.slice(0, original.size, entry.asset.mimeType),
        canonicalPcm: canonical.slice(0, canonical.size, CANONICAL_PCM_MIME),
      }
      try {
        const releaseValidation = reserveStudioMemory(
          2 * Math.max(data.original.size, data.canonicalPcm.size),
        )
        try {
          await validatePreparedStudioAsset(data, { signal: options.signal })
        } finally {
          releaseValidation()
        }
      } catch (error) {
        if (options.signal?.aborted === true) throw error
        throw new StudioBackupError(
          'The project backup audio failed its size, format or checksum check.',
        )
      }
      assets.push(data)
    }
    const result = { project: manifest.project, assets }
    transferred = true
    return retainStudioResource(result, () => releaseStudioResource(entries))
  } finally {
    if (!transferred) releaseStudioResource(entries)
  }
}

export async function restoreStudioBackup(
  archive: Blob,
  service: Pick<StudioService, 'restoreProject'>,
  options: Pick<StudioBackupOptions, 'signal'> = {},
): Promise<StudioProject> {
  const validated = await readStudioBackup(archive, options)
  try {
    options.signal?.throwIfAborted()
    return await service.restoreProject(validated.project, validated.assets)
  } finally {
    releaseStudioResource(validated)
  }
}

/** The budget's own refusal: missing room, not missing audio. */
function isMemoryError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith('Studio needs more memory')
  )
}
