// ============================================================
// Studio service — atomic local projects, immutable audio and revision CAS.
// ============================================================

import type { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { getLocalDatabase } from '@/db/local-database'
import { CANONICAL_PCM_MIME } from '@/lib/studio/audio/canonical-pcm'
import { isStudioMemoryRefusal, reserveStudioMemory, } from '@/lib/studio/memory-budget'
import { createStudioProject, summarizeStudioProject, } from '@/lib/studio/model/defaults'
import { fitsStudioProjectStorageBudget } from '@/lib/studio/model/storage-limits'
import type { StudioAsset, StudioAssetBytes, StudioAssetData, StudioProject, StudioProjectSummary, } from '@/lib/studio/model/types'
import { validateStudioAsset, validateStudioProject, } from '@/lib/studio/model/validation'
import { acquireStudioEditor, reclaimStudioEditor, releaseStudioEditor, renewStudioEditor, requireStudioEditor, } from './studio-editor-lease'
import type { StudioAssetInput } from './studio-record-preparation'
import { withPreparedStudioRecords } from './studio-record-preparation'
import type { PreparedStudioRecords, StudioAssetRecord, StudioBlobRecord, } from './studio-records'
import type { StudioEditorLease, StudioEditorToken, StudioWriteToken, } from './studio-storage-types'
import { STUDIO_STORES, StudioStorageError, studioStorageOperation, } from './studio-storage-types'

export { StudioStorageError } from './studio-storage-types'
export type {
  StudioEditorLease,
  StudioEditorToken,
  StudioWriteToken,
} from './studio-storage-types'

export interface StudioService {
  listProjects(): Promise<StudioProjectSummary[]>
  createProject(title?: string): Promise<StudioProject>
  loadProject(id: string): Promise<StudioProject>
  listAssets(projectId: string): Promise<StudioAsset[]>
  readAssetBytes(projectId: string, assetId: string): Promise<StudioAssetData>
  /** The stored buffers themselves, with no Blob copy: what a backup streams from. */
  readAssetBuffers(
    projectId: string,
    assetId: string,
  ): Promise<StudioAssetBytes>
  readCanonicalAsset(projectId: string, assetId: string): Promise<Blob>
  acquireLease(
    projectId: string,
    ownerId: string,
    options?: { takeover?: boolean },
  ): Promise<StudioEditorLease>
  renewLease(
    projectId: string,
    token: StudioEditorToken,
  ): Promise<StudioEditorLease>
  /** Extend this tab's own lease, lapsed or released, while nobody else has held it since. */
  reclaimLease(
    projectId: string,
    token: StudioEditorToken,
  ): Promise<StudioEditorLease>
  releaseLease(projectId: string, token: StudioEditorToken): Promise<void>
  saveProject(
    project: StudioProject,
    token: StudioWriteToken,
    assets?: readonly StudioAssetData[],
  ): Promise<StudioProject>
  forkProject(
    project: StudioProject,
    assets?: readonly StudioAssetData[],
  ): Promise<StudioProject>
  /** Bytes handed over are stored as they are; Blobs are read and copied. */
  restoreProject(
    project: StudioProject,
    assets: readonly StudioAssetInput[],
    options?: { signal?: AbortSignal },
  ): Promise<StudioProject>
  deleteProject(id: string, token: StudioWriteToken): Promise<void>
}

export interface StudioServiceDependencies {
  database?: () => DexieAdapter
  now?: () => Date
  createId?: () => string
}

function projectSnapshot(
  value: unknown,
  assets?: readonly StudioAsset[],
): StudioProject {
  try {
    return validateStudioProject(structuredClone(value), assets)
  } catch (cause) {
    throw new StudioStorageError(
      'invalid-project',
      'The project contains unsupported or invalid data.',
      cause,
    )
  }
}

function assetMetadata(
  record: StudioAssetRecord,
  projectId: string,
): StudioAsset {
  try {
    const asset = validateStudioAsset(record.asset)
    if (
      record.id !== asset.id ||
      record.projectId !== projectId ||
      asset.projectId !== projectId ||
      record.sha256 !== asset.sha256
    )
      throw new Error('Asset ownership mismatch')
    return asset
  } catch (cause) {
    throw new StudioStorageError(
      'invalid-asset',
      'The saved audio metadata is damaged.',
      cause,
    )
  }
}

const COPY_MEMORY =
  'Studio needs more memory to copy this song. Stop playback and try again.'

function assertStorageBudget(assets: readonly StudioAsset[]): void {
  if (!fitsStudioProjectStorageBudget(assets)) {
    throw new StudioStorageError(
      'project-limit',
      'A project can hold up to 128 audio assets and 480 MiB of original and prepared audio. No changes were saved. Start another project to add more audio.',
    )
  }
}

async function insertRecords(
  db: DexieAdapter,
  records: readonly PreparedStudioRecords[],
): Promise<void> {
  for (const record of records) {
    await db.addStrict(STUDIO_STORES.assets, record.metadata)
    await db.addStrict(STUDIO_STORES.blobs, record.original)
    await db.addStrict(STUDIO_STORES.blobs, record.canonical)
  }
}

export function createStudioService(
  dependencies: StudioServiceDependencies = {},
): StudioService {
  const database = dependencies.database ?? getLocalDatabase
  const now = dependencies.now ?? (() => new Date())
  const createId =
    dependencies.createId ?? (() => globalThis.crypto.randomUUID())

  const listAssets = async (projectId: string): Promise<StudioAsset[]> => {
    const records = await database().readByIndexStrict<StudioAssetRecord>(
      STUDIO_STORES.assets,
      'projectId',
      projectId,
    )
    return records.map((record) => assetMetadata(record, projectId))
  }
  const readProject = async (id: string): Promise<StudioProject> => {
    const project = await database().readByIdStrict<StudioProject>(
      STUDIO_STORES.projects,
      id,
    )
    if (!project)
      throw new StudioStorageError(
        'not-found',
        'The local project was not found.',
      )
    return projectSnapshot(project, await listAssets(id))
  }
  /** The stored rows' own buffers: a copy of a song reads each take once. */
  const readAssetRows = async (
    projectId: string,
    assetId: string,
  ): Promise<StudioAssetBytes> => {
    const db = database()
    const row = await db.readByIdStrict<StudioAssetRecord>(
      STUDIO_STORES.assets,
      assetId,
    )
    if (!row || row.projectId !== projectId)
      throw new StudioStorageError(
        'not-found',
        'This project audio is missing.',
      )
    const asset = assetMetadata(row, projectId)
    const records = await db.readByIndexStrict<StudioBlobRecord>(
      STUDIO_STORES.blobs,
      'assetId',
      asset.id,
    )
    const original = records.find((record) => record.kind === 'original')
    const canonical = records.find((record) => record.kind === 'canonical')
    if (
      records.length !== 2 ||
      !original ||
      !canonical ||
      records.some((record) => record.projectId !== projectId) ||
      canonical.id !== asset.canonicalPcmId ||
      original.data.byteLength !== asset.byteLength ||
      canonical.data.byteLength !== asset.canonicalPcmByteLength
    ) {
      throw new StudioStorageError(
        'invalid-asset',
        'This project audio is incomplete.',
      )
    }
    return { asset, original: original.data, canonicalPcm: canonical.data }
  }
  const readAsset = async (
    projectId: string,
    assetId: string,
  ): Promise<StudioAssetData> => {
    const rows = await readAssetRows(projectId, assetId)
    return {
      asset: rows.asset,
      original: new Blob([rows.original], { type: rows.asset.mimeType }),
      canonicalPcm: new Blob([rows.canonicalPcm], { type: CANONICAL_PCM_MIME }),
    }
  }
  const insertProject = async (
    project: StudioProject,
    assets: readonly StudioAssetInput[],
    signal?: AbortSignal,
  ): Promise<StudioProject> => {
    const snapshot = projectSnapshot(
      project,
      assets.map((value) => value.asset),
    )
    assertStorageBudget(assets.map((value) => value.asset))
    return withPreparedStudioRecords(
      snapshot,
      assets,
      now().toISOString(),
      async (records) => {
        const db = database()
        await db.transaction(async () => {
          assertStorageBudget(records.map((record) => record.metadata.asset))
          await insertRecords(db, records)
          await db.addStrict(STUDIO_STORES.projects, snapshot)
          await db.addStrict(
            STUDIO_STORES.summaries,
            summarizeStudioProject(snapshot),
          )
        })
        return snapshot
      },
      signal,
    )
  }
  const restoreProject = async (
    project: StudioProject,
    assets: readonly StudioAssetInput[],
    signal?: AbortSignal,
  ): Promise<StudioProject> => {
    const source = projectSnapshot(
      project,
      assets.map((value) => value.asset),
    )
    assertStorageBudget(assets.map((value) => value.asset))
    const projectId = createId()
    const assetIds = new Map(assets.map(({ asset }) => [asset.id, createId()]))
    const trackIds = new Map(
      source.tracks.map((track) => [track.id, createId()]),
    )
    const timestamp = now().toISOString()
    const restored: StudioProject = {
      ...source,
      id: projectId,
      revision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      mix: { flavourId: source.mix.flavourId, macros: source.mix.macros },
      tracks: source.tracks.map((track) => ({
        ...track,
        id: trackIds.get(track.id)!,
      })),
      clips: source.clips.map((clip) => ({
        ...clip,
        id: createId(),
        trackId: trackIds.get(clip.trackId)!,
        assetId: assetIds.get(clip.assetId)!,
      })),
    }
    const copied = assets.map((data) => ({
      ...data,
      asset: {
        ...data.asset,
        id: assetIds.get(data.asset.id)!,
        projectId,
        canonicalPcmId: createId(),
      },
    }))
    return insertProject(restored, copied, signal)
  }

  return {
    listProjects: () =>
      studioStorageOperation(async () => {
        const rows = await database().readAllStrict<StudioProjectSummary>(
          STUDIO_STORES.summaries,
        )
        return rows.sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt),
        )
      }),
    createProject: (title) =>
      studioStorageOperation(() =>
        insertProject(
          createStudioProject({ id: createId(), title, now: now() }),
          [],
        ),
      ),
    loadProject: (id) =>
      studioStorageOperation(() =>
        database().transaction(() => readProject(id)),
      ),
    listAssets: (id) => studioStorageOperation(() => listAssets(id)),
    readAssetBytes: (projectId, assetId) =>
      studioStorageOperation(() =>
        database().transaction(() => readAsset(projectId, assetId)),
      ),
    readAssetBuffers: (projectId, assetId) =>
      studioStorageOperation(() =>
        database().transaction(() => readAssetRows(projectId, assetId)),
      ),
    readCanonicalAsset: (projectId, assetId) =>
      studioStorageOperation(() =>
        database().transaction(async () => {
          const db = database()
          const metadata = await db.readByIdStrict<StudioAssetRecord>(
            STUDIO_STORES.assets,
            assetId,
          )
          if (!metadata || metadata.projectId !== projectId)
            throw new StudioStorageError(
              'not-found',
              'This project audio is missing.',
            )
          const asset = assetMetadata(metadata, projectId)
          const row = await db.readByIdStrict<StudioBlobRecord>(
            STUDIO_STORES.blobs,
            asset.canonicalPcmId,
          )
          if (
            !row ||
            row.projectId !== projectId ||
            row.assetId !== assetId ||
            row.kind !== 'canonical' ||
            row.data.byteLength !== asset.canonicalPcmByteLength
          ) {
            throw new StudioStorageError(
              'invalid-asset',
              'This project audio is incomplete.',
            )
          }
          return new Blob([row.data], { type: CANONICAL_PCM_MIME })
        }),
      ),
    acquireLease: (id, ownerId, options = {}) =>
      studioStorageOperation(() =>
        acquireStudioEditor(database(), id, ownerId, now, options.takeover),
      ),
    renewLease: (id, token) =>
      studioStorageOperation(() =>
        renewStudioEditor(database(), id, token, now),
      ),
    reclaimLease: (id, token) =>
      studioStorageOperation(() =>
        reclaimStudioEditor(database(), id, token, now),
      ),
    releaseLease: (id, token) =>
      studioStorageOperation(() =>
        releaseStudioEditor(database(), id, token, now),
      ),
    saveProject: (project, token, assets = []) =>
      studioStorageOperation(async () => {
        const snapshot = projectSnapshot(project)
        if (
          !Number.isSafeInteger(token.expectedRevision) ||
          token.expectedRevision < 0 ||
          snapshot.revision <= token.expectedRevision
        ) {
          throw new StudioStorageError(
            'conflict',
            'The project revision must advance before saving.',
          )
        }
        assertStorageBudget([
          ...(await listAssets(snapshot.id)),
          ...assets.map((input) => input.asset),
        ])
        return withPreparedStudioRecords(
          snapshot,
          assets,
          now().toISOString(),
          async (records) => {
            const db = database()
            await db.transaction(async () => {
              await requireStudioEditor(db, snapshot.id, token, now().getTime())
              const current = await readProject(snapshot.id)
              if (
                current.revision !== token.expectedRevision ||
                current.createdAt !== snapshot.createdAt
              ) {
                throw new StudioStorageError(
                  'conflict',
                  'A newer project revision is already saved. Reload or make a copy.',
                )
              }
              const metadata = [
                ...(await listAssets(snapshot.id)),
                ...records.map((record) => record.metadata.asset),
              ]
              projectSnapshot(snapshot, metadata)
              assertStorageBudget(metadata)
              await insertRecords(db, records)
              await db.putStrict(STUDIO_STORES.projects, snapshot)
              await db.putStrict(
                STUDIO_STORES.summaries,
                summarizeStudioProject(snapshot),
              )
            })
            return snapshot
          },
        )
      }),
    restoreProject: (project, assets, options = {}) =>
      studioStorageOperation(() =>
        restoreProject(project, assets, options.signal),
      ),
    forkProject: (project, assets = []) =>
      studioStorageOperation(async () => {
        const supplied = new Map(assets.map((data) => [data.asset.id, data]))
        const used = [...new Set(project.clips.map((clip) => clip.assetId))]
        const metadata = await listAssets(project.id)
        let storedBytes = 0
        for (const id of used) {
          if (supplied.has(id)) continue
          const asset = metadata.find((value) => value.id === id)
          if (!asset)
            throw new StudioStorageError(
              'not-found',
              'This project audio is missing.',
            )
          storedBytes += asset.byteLength + asset.canonicalPcmByteLength
        }
        // The copy holds each saved take once: the rows' own buffers are
        // checked in place and written to the new project as they are.
        let release: () => void
        try {
          release = reserveStudioMemory(storedBytes)
        } catch (cause) {
          throw new StudioStorageError('memory-limit', COPY_MEMORY, cause)
        }
        try {
          const selected: StudioAssetInput[] = []
          for (const id of used)
            selected.push(
              supplied.get(id) ?? (await readAssetRows(project.id, id)),
            )
          return await restoreProject(project, selected)
        } catch (error) {
          if (isStudioMemoryRefusal(error))
            throw new StudioStorageError('memory-limit', COPY_MEMORY, error)
          throw error
        } finally {
          release()
        }
      }),
    deleteProject: (id, token) =>
      studioStorageOperation(async () => {
        const db = database()
        await db.transaction(async () => {
          await requireStudioEditor(db, id, token, now().getTime())
          const project = await readProject(id)
          if (project.revision !== token.expectedRevision)
            throw new StudioStorageError(
              'conflict',
              'The saved project has changed.',
            )
          await db.deleteByIndexStrict(STUDIO_STORES.blobs, 'projectId', id)
          await db.deleteByIndexStrict(STUDIO_STORES.assets, 'projectId', id)
          await db.deleteByIdStrict(STUDIO_STORES.projects, id)
          await db.deleteByIdStrict(STUDIO_STORES.summaries, id)
          await db.deleteByIdStrict(STUDIO_STORES.leases, id)
        })
      }),
  }
}
