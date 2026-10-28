// ============================================================
// Studio backup — portable local projects with original and canonical audio.
// ============================================================

import type { StudioService } from '@/db/services/studio-service'
import { StudioStorageError } from '@/db/services/studio-service'
import { checkCanonicalStream, checkOriginalStream, } from '@/lib/studio/audio/stream-check'
import { isStudioMemoryRefusal, releaseStudioResource, reserveStudioMemory, retainStudioResource, StudioMemoryError, } from '@/lib/studio/memory-budget'
import type { StudioAsset, StudioAssetBytes, StudioAssetData, StudioProject, } from '@/lib/studio/model/types'
import { validateStudioAsset, validateStudioProject, } from '@/lib/studio/model/validation'
import { readStudioArchive, studioBackupAssetPath, StudioBackupError, } from './archive-codec'
import type { StudioArchiveSink, StudioArchiveWriter, StudioEntryCheck, } from './archive-writer'
import { createStudioArchiveWriter, createStudioMemorySink, } from './archive-writer'

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
const BACKUP_WRITE =
  'The backup file could not be written. Check the disk has room and try again.'

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

interface BackupSource {
  id: string
  /** Audio an unsaved import already holds: read from memory, never reserved again. */
  staged: StudioAssetData | undefined
  /** The take's metadata, as the manifest records it. */
  asset: StudioAsset
}

/** Every take the arrangement plays, once each, with the metadata the manifest records. */
function backupSources(
  snapshot: StudioProject,
  options: StudioBackupOptions,
): BackupSource[] {
  const staged = new Map(
    (options.preparedAssets ?? []).map((data) => [data.asset.id, data]),
  )
  return [...new Set(snapshot.clips.map((clip) => clip.assetId))].map((id) => {
    const asset =
      staged.get(id)?.asset ??
      options.assetMetadata?.find((known) => known.id === id)
    if (!asset)
      throw backupFailure(
        new Error('Audio metadata is required before reading a backup source'),
        options.signal,
      )
    return { id, staged: staged.get(id), asset: structuredClone(asset) }
  })
}

/** The same metadata, whatever order its keys were written in. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(',')}}`
}

/**
 * Freeze the current arrangement, including unsaved edits, into the sink;
 * never export history. One take is read at a time and checked as it streams
 * into the archive, so a backup holds one take and one batch, not the song.
 * A saved take is best read as its stored buffers: a Blob made of them is a
 * second copy, held where the page cannot see it to collect it.
 */
export async function writeStudioBackup(
  project: StudioProject,
  readAsset: (assetId: string) => Promise<StudioAssetData | StudioAssetBytes>,
  sink: StudioArchiveSink,
  options: StudioBackupOptions = {},
): Promise<void> {
  const snapshot = validateStudioProject(structuredClone(project))
  const sources = backupSources(snapshot, options)
  const assets: StudioBackupManifest['assets'] = sources.map(
    ({ asset }, index) => ({
      asset,
      originalPath: studioBackupAssetPath(index, 'original'),
      canonicalPath: studioBackupAssetPath(index, 'canonical'),
    }),
  )
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
  const manifestBlob = new Blob([JSON.stringify(manifest)], {
    type: 'application/json',
  })
  try {
    sink.reserve(
      assets.reduce(
        (bytes, { asset }) =>
          bytes + asset.byteLength + asset.canonicalPcmByteLength,
        manifestBlob.size,
      ),
    )
  } catch (error) {
    throw backupFailure(error, options.signal)
  }
  const writer = createStudioArchiveWriter(sink, options.signal)
  try {
    await writer.add('manifest.json', manifestBlob)
    for (const [index, source] of sources.entries())
      await writeSource(
        writer,
        source,
        assets[index],
        readAsset,
        snapshot.id,
        options.signal,
      )
    await writer.finish()
  } catch (error) {
    throw writeFailure(error, options.signal)
  } finally {
    writer.terminate()
  }
}

/** Read one take, check it as it streams into the archive, and let it go. */
async function writeSource(
  writer: StudioArchiveWriter,
  source: BackupSource,
  entry: StudioBackupManifest['assets'][number],
  readAsset: (assetId: string) => Promise<StudioAssetData | StudioAssetBytes>,
  projectId: string,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted()
  let release = () => {}
  let data: StudioAssetData | StudioAssetBytes
  let checks: [StudioEntryCheck, StudioEntryCheck]
  try {
    // A take read from storage counts against the budget while it is held.
    if (!source.staged)
      release = reserveStudioMemory(
        source.asset.byteLength + source.asset.canonicalPcmByteLength,
      )
    data = source.staged ?? (await readAsset(source.id))
    if (
      data.asset.id !== source.id ||
      data.asset.projectId !== projectId ||
      canonicalJson(data.asset) !== canonicalJson(source.asset)
    )
      throw new Error('Audio ownership mismatch')
    checks = [
      checkOriginalStream(data.original, source.asset),
      checkCanonicalStream(data.canonicalPcm, source.asset),
    ]
  } catch (error) {
    release()
    throw backupFailure(error, signal)
  }
  try {
    await writer.add(
      entry.originalPath,
      data.original,
      guarded(checks[0], signal),
    )
    await writer.add(
      entry.canonicalPath,
      data.canonicalPcm,
      guarded(checks[1], signal),
    )
  } finally {
    release()
  }
}

/** A check's failure is the audio's, not the file's. */
function guarded(
  check: StudioEntryCheck,
  signal?: AbortSignal,
): StudioEntryCheck {
  const run = (step: () => void) => {
    try {
      step()
    } catch (error) {
      throw backupFailure(error, signal)
    }
  }
  return {
    update: (bytes) => run(() => check.update(bytes)),
    finish: () => run(() => check.finish()),
  }
}

/** The whole backup as one Blob held in memory, such as a test reads back. */
export async function createStudioBackup(
  project: StudioProject,
  readAsset: (assetId: string) => Promise<StudioAssetData>,
  options: StudioBackupOptions = {},
): Promise<Blob> {
  const sink = createStudioMemorySink()
  try {
    await writeStudioBackup(project, readAsset, sink, options)
  } catch (error) {
    sink.free()
    throw error
  }
  return retainStudioResource(sink.blob(), sink.free)
}

/** Say what stopped a backup: missing room is not missing audio. */
function backupFailure(error: unknown, signal?: AbortSignal): unknown {
  if (signal?.aborted === true) return error
  if (isStudioMemoryRefusal(error)) return new StudioMemoryError(BACKUP_MEMORY)
  return new StudioBackupError(
    'The backup could not include every audio asset. Restore the missing audio and try again.',
  )
}

/** A failure while writing: the backup's own errors as they are, anything else the file refused. */
function writeFailure(error: unknown, signal?: AbortSignal): unknown {
  if (
    signal?.aborted === true ||
    error instanceof StudioBackupError ||
    error instanceof StudioMemoryError
  )
    return error
  if (isStudioMemoryRefusal(error)) return new StudioMemoryError(BACKUP_MEMORY)
  return new StudioBackupError(BACKUP_WRITE)
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
