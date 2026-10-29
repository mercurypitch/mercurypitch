// Studio persistence tests use real IndexedDB transactions, including rollback and competing editors.
import { Dexie } from 'dexie'
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter, MERCURY_PITCH_DB_NAME, } from '@/db/adapters/dexie-adapter'
import { CLOUD_ENTITIES } from '@/db/adapters/hybrid-adapter'
import { reserveStudioMemory, studioReservedMemoryBytes, studioWorkingBytes, } from '@/lib/studio/memory-budget'
import { fitsStudioProjectStorageBudget, STUDIO_PROJECT_STORAGE_LIMITS, } from '@/lib/studio/model/storage-limits'
import type { StudioProject } from '@/lib/studio/model/types'
import { studioArrangementFixture, studioAssetFixture } from './studio.fixture'
import { STUDIO_EDITOR_LEASE_MS } from './studio-editor-lease'
import type { StudioBlobRecord } from './studio-records'
import { createStudioService } from './studio-service'
import { STUDIO_STORES } from './studio-storage-types'

/** The storage error code a call is refused with, or 'resolved'. */
async function refusal(call: Promise<unknown>): Promise<string> {
  try {
    await call
    return 'resolved'
  } catch (error) {
    return (error as { code?: string }).code ?? String(error)
  }
}

describe('local Studio persistence', () => {
  let db: DexieAdapter
  let service: ReturnType<typeof createStudioService>
  let clock: number
  let nextId: number
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob)
    vi.stubGlobal('crypto', webcrypto)
    clock = Date.parse('2026-10-26T12:00:00.000Z')
    nextId = 0
    db = new DexieAdapter()
    service = createStudioService({
      database: () => db,
      now: () => new Date(clock),
      createId: () => `new-${++nextId}`,
    })
  })
  afterEach(async () => {
    expect(studioReservedMemoryBytes()).toBe(0)
    vi.restoreAllMocks()
    await db.destroy()
    vi.unstubAllGlobals()
  })

  async function savedArrangement() {
    const empty = await service.createProject('Demo')
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const data = await studioAssetFixture(empty.id)
    const project = await service.saveProject(
      studioArrangementFixture(empty),
      { ...lease, expectedRevision: 0 },
      [data],
    )
    return { project, data, lease }
  }

  it('reloads owned bytes after original history deletion, with metadata-only lists', async () => {
    const { project, data } = await savedArrangement()
    await db.putStrict('voiceTakeAudio', {
      id: 'kept-one',
      takeId: 'kept-one',
      data: await data.original.arrayBuffer(),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    })
    await db.deleteByIdStrict('voiceTakeAudio', 'kept-one')
    db.close()
    db = new DexieAdapter()
    const allReads = vi.spyOn(db, 'readAllStrict')
    const indexedReads = vi.spyOn(db, 'readByIndexStrict')
    expect(await service.listProjects()).toEqual([
      expect.objectContaining({
        id: project.id,
        revision: 1,
        trackCount: 1,
        clipCount: 1,
        durationFrames: 96056,
      }),
    ])
    expect(await service.listAssets(project.id)).toEqual([data.asset])
    expect(await service.loadProject(project.id)).toEqual(project)
    expect(
      [...allReads.mock.calls, ...indexedReads.mock.calls].some(
        ([store]) => store === STUDIO_STORES.blobs,
      ),
    ).toBe(false)
    const owned = await service.readAssetBytes(project.id, data.asset.id)
    expect(await owned.original.arrayBuffer()).toEqual(
      await data.original.arrayBuffer(),
    )
    expect(await owned.canonicalPcm.arrayBuffer()).toEqual(
      await data.canonicalPcm.arrayBuffer(),
    )
    // A backup streams from the stored buffers, with no Blob copy of them.
    const stored = await service.readAssetBuffers(project.id, data.asset.id)
    expect(stored.asset).toEqual(data.asset)
    expect(stored.original).toEqual(await data.original.arrayBuffer())
    expect(stored.canonicalPcm).toEqual(await data.canonicalPcm.arrayBuffer())
  })

  it('rolls back project, metadata and both blobs after a real uniqueness violation', async () => {
    const empty = await service.createProject()
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const first = await studioAssetFixture(empty.id)
    const second = await studioAssetFixture(empty.id, 'asset-two')
    const collision = {
      ...second,
      asset: { ...second.asset, canonicalPcmId: `${first.asset.id}-original` },
    }
    await expect(
      service.saveProject(
        studioArrangementFixture(empty),
        { ...lease, expectedRevision: 0 },
        [first, collision],
      ),
    ).rejects.toMatchObject({ code: 'storage-unavailable' })
    expect(await service.loadProject(empty.id)).toEqual(empty)
    expect(await service.listAssets(empty.id)).toEqual([])
    expect(await db.readAllStrict(STUDIO_STORES.blobs)).toEqual([])
    expect((await service.listProjects())[0].clipCount).toBe(0)
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('admits serialization before reading bytes and releases after a successful retry', async () => {
    const empty = await service.createProject()
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const data = await studioAssetFixture(empty.id)
    const originalRead = vi.spyOn(data.original, 'arrayBuffer')
    const canonicalRead = vi.spyOn(data.canonicalPcm, 'arrayBuffer')
    const snapshot = studioArrangementFixture(empty)
    const releaseOtherAudio = reserveStudioMemory(studioWorkingBytes())
    try {
      await expect(
        service.saveProject(snapshot, { ...lease, expectedRevision: 0 }, [
          data,
        ]),
      ).rejects.toMatchObject({ code: 'memory-limit' })
      expect(originalRead).not.toHaveBeenCalled()
      expect(canonicalRead).not.toHaveBeenCalled()
      expect(await service.loadProject(empty.id)).toEqual(empty)
      expect(await service.listAssets(empty.id)).toEqual([])
      expect(studioReservedMemoryBytes()).toBe(studioWorkingBytes())
    } finally {
      releaseOtherAudio()
    }
    await service.saveProject(snapshot, { ...lease, expectedRevision: 0 }, [
      data,
    ])
    expect(await service.loadProject(empty.id)).toEqual(snapshot)
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('admits project copies before loading persisted audio and preserves the source on failure', async () => {
    const { project } = await savedArrangement()
    const read = vi.spyOn(db, 'readByIndexStrict')
    const release = reserveStudioMemory(studioWorkingBytes())
    try {
      await expect(service.forkProject(project)).rejects.toMatchObject({
        code: 'memory-limit',
      })
      expect(
        read.mock.calls.some((call) => call[0] === STUDIO_STORES.blobs),
      ).toBe(false)
      expect(await service.listProjects()).toHaveLength(1)
    } finally {
      release()
    }
    expect(studioReservedMemoryBytes()).toBe(0)
    const copy = await service.forkProject(project)
    expect(copy.id).not.toBe(project.id)
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('loads only selected canonical bytes and rejects another project ownership', async () => {
    const { project, data } = await savedArrangement()
    const reads = vi.spyOn(db, 'readByIdStrict')
    const indexedReads = vi.spyOn(db, 'readByIndexStrict')
    const canonical = await service.readCanonicalAsset(
      project.id,
      data.asset.id,
    )
    expect(await canonical.arrayBuffer()).toEqual(
      await data.canonicalPcm.arrayBuffer(),
    )
    expect(
      reads.mock.calls.filter(([store]) => store === STUDIO_STORES.blobs),
    ).toEqual([[STUDIO_STORES.blobs, data.asset.canonicalPcmId]])
    expect(indexedReads).not.toHaveBeenCalled()
    await expect(
      service.readCanonicalAsset('another-project', data.asset.id),
    ).rejects.toMatchObject({ code: 'not-found' })
    await db.deleteByIdStrict(STUDIO_STORES.blobs, data.asset.canonicalPcmId)
    await expect(
      service.readCanonicalAsset(project.id, data.asset.id),
    ).rejects.toMatchObject({ code: 'invalid-asset' })
  })

  it('atomically rejects one of two saves of the same base revision and permits skipped command revisions', async () => {
    const empty = await service.createProject()
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const outcomes = await Promise.allSettled([
      service.saveProject(
        { ...empty, title: 'First', revision: 3 },
        { ...lease, expectedRevision: 0 },
      ),
      service.saveProject(
        { ...empty, title: 'Second', revision: 4 },
        { ...lease, expectedRevision: 0 },
      ),
    ])
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1)
    expect(
      outcomes.find((outcome) => outcome.status === 'rejected'),
    ).toMatchObject({ reason: { code: 'conflict' } })
    const saved = await service.loadProject(empty.id)
    expect([3, 4]).toContain(saved.revision)
    expect((await service.listProjects())[0].revision).toBe(saved.revision)
  })

  it('blocks another editor until explicit takeover and never lets stale release clear the new lease', async () => {
    const empty = await service.createProject()
    const first = await service.acquireLease(empty.id, 'tab-one')
    await expect(
      service.acquireLease(empty.id, 'tab-two'),
    ).rejects.toMatchObject({ code: 'locked' })
    const second = await service.acquireLease(empty.id, 'tab-two', {
      takeover: true,
    })
    expect(second.epoch).toBe(first.epoch + 1)
    await service.releaseLease(empty.id, first)
    await expect(
      service.saveProject(
        { ...empty, revision: 1 },
        { ...first, expectedRevision: 0 },
      ),
    ).rejects.toMatchObject({ code: 'lease-lost' })
    await expect(
      service.saveProject(
        { ...empty, revision: 1 },
        { ...second, expectedRevision: 0 },
      ),
    ).resolves.toMatchObject({ revision: 1 })
  })

  it('renews a live lease, rejects expired saves, and preserves epoch across release', async () => {
    const empty = await service.createProject()
    const first = await service.acquireLease(empty.id, 'tab-one')
    clock += 10000
    const renewed = await service.renewLease(empty.id, first)
    expect(renewed.epoch).toBe(first.epoch)
    expect(renewed.expiresAt).toBe(clock + STUDIO_EDITOR_LEASE_MS)
    clock = renewed.expiresAt
    await expect(service.renewLease(empty.id, renewed)).rejects.toMatchObject({
      code: 'lease-lost',
    })
    await expect(
      service.saveProject(
        { ...empty, revision: 1 },
        { ...renewed, expectedRevision: 0 },
      ),
    ).rejects.toMatchObject({ code: 'lease-lost' })
    const recovered = await service.acquireLease(empty.id, 'tab-one')
    await service.releaseLease(empty.id, recovered)
    const next = await service.acquireLease(empty.id, 'tab-one')
    expect(next.epoch).toBe(first.epoch + 2)
  })

  it("reclaims this tab's own lapsed lease on the same epoch, so its pending saves still land", async () => {
    const empty = await service.createProject()
    const first = await service.acquireLease(empty.id, 'tab-one')
    clock = first.expiresAt + 60_000

    const reclaimed = await service.reclaimLease(empty.id, first)

    expect(reclaimed).toMatchObject({ ownerId: 'tab-one', epoch: first.epoch })
    expect(reclaimed.expiresAt).toBe(clock + STUDIO_EDITOR_LEASE_MS)
    await expect(
      service.saveProject(
        { ...empty, revision: 1 },
        { ...first, expectedRevision: 0 },
      ),
    ).resolves.toMatchObject({ revision: 1 })
  })

  it('reclaims a lease this tab released itself, when nobody has held it since', async () => {
    const empty = await service.createProject()
    const first = await service.acquireLease(empty.id, 'tab-one')
    await service.releaseLease(empty.id, first)

    const reclaimed = await service.reclaimLease(empty.id, first)

    expect(reclaimed).toMatchObject({ ownerId: 'tab-one', epoch: first.epoch })
    await expect(
      service.acquireLease(empty.id, 'tab-two'),
    ).rejects.toMatchObject({ code: 'locked' })
  })

  it('never reclaims a lease another tab has held since, lapsed or not', async () => {
    const empty = await service.createProject()
    const first = await service.acquireLease(empty.id, 'tab-one')
    clock = first.expiresAt + 1
    const second = await service.acquireLease(empty.id, 'tab-two')
    const live = await refusal(service.reclaimLease(empty.id, first))
    clock = second.expiresAt + 1
    const lapsed = await refusal(service.reclaimLease(empty.id, first))
    await service.releaseLease(empty.id, second)
    const released = await refusal(service.reclaimLease(empty.id, first))

    expect([live, lapsed, released]).toEqual([
      'lease-lost',
      'lease-lost',
      'lease-lost',
    ])
    await expect(
      service.saveProject(
        { ...empty, revision: 1 },
        { ...first, expectedRevision: 0 },
      ),
    ).rejects.toMatchObject({ code: 'lease-lost' })
  })

  /** A song whose saved revision keeps `asset-two` though no clip uses it, as a removed take is kept. */
  async function arrangementWithRemovedTake() {
    const saved = await savedArrangement()
    const removed = await studioAssetFixture(saved.project.id, 'asset-two')
    const project = await service.saveProject(
      { ...saved.project, revision: 2 },
      { ...saved.lease, expectedRevision: 1 },
      [removed],
    )
    return { ...saved, project }
  }
  const blobsOf = async (assetId: string) =>
    (await db.readAllStrict<StudioBlobRecord>(STUDIO_STORES.blobs))
      .filter((row) => row.assetId === assetId)
      .map((row) => row.id)

  it('deletes the audio no clip uses, blobs and all, and keeps the audio clips play', async () => {
    const { project, lease } = await arrangementWithRemovedTake()
    expect(await blobsOf('asset-two')).toHaveLength(2)

    const kept = await service.pruneUnusedAssets(project.id, {
      ...lease,
      expectedRevision: 2,
    })

    expect(kept.map((asset) => asset.id)).toEqual(['asset-one'])
    expect(
      (await service.listAssets(project.id)).map((asset) => asset.id),
    ).toEqual(['asset-one'])
    expect(await blobsOf('asset-two')).toEqual([])
    expect(await blobsOf('asset-one')).toHaveLength(2)
    expect(await service.loadProject(project.id)).toEqual(project)
    await expect(
      service.readAssetBuffers(project.id, 'asset-one'),
    ).resolves.toMatchObject({ asset: { id: 'asset-one' } })
  })

  it("keeps a take's waveform peaks beside its two files, and lets them go with the take", async () => {
    const saved = await savedArrangement()
    const other = await studioAssetFixture(saved.project.id, 'asset-two', 0.3)
    const project = await service.saveProject(
      { ...saved.project, revision: 2 },
      { ...saved.lease, expectedRevision: 1 },
      [other],
    )
    const [one, two] = await service.listAssets(project.id)
    const peaks = (value: number) => new Uint8Array([value, 2, 3, 4]).buffer
    await service.writeAssetPeaks(project.id, one, peaks(1))
    await service.writeAssetPeaks(project.id, two, peaks(9))
    expect(
      new Uint8Array((await service.readAssetPeaks(project.id, two))!),
    ).toEqual(new Uint8Array(peaks(9)))
    // Rows listed by a take's id are still exactly its two files, as every
    // earlier version expects: peaks never break an older reader.
    expect(await blobsOf('asset-one')).toHaveLength(2)
    await expect(
      service.readAssetBuffers(project.id, 'asset-one'),
    ).resolves.toMatchObject({ asset: { id: 'asset-one' } })

    await service.pruneUnusedAssets(project.id, {
      ...saved.lease,
      expectedRevision: 2,
    })

    expect(await service.readAssetPeaks(project.id, two)).toBeNull()
    expect(
      new Uint8Array((await service.readAssetPeaks(project.id, one))!),
    ).toEqual(new Uint8Array(peaks(1)))
    await service.deleteProject(project.id, {
      ...saved.lease,
      expectedRevision: 2,
    })
    expect(await db.readAllStrict(STUDIO_STORES.blobs)).toEqual([])
  })

  it('keeps no peaks for a take that is not saved, or saved in another song', async () => {
    const { project, data } = await savedArrangement()
    const unsaved = await studioAssetFixture(project.id, 'asset-unsaved', 0.3)
    await service.writeAssetPeaks(project.id, unsaved.asset, new ArrayBuffer(8))
    await service.writeAssetPeaks(
      'another-song',
      data.asset,
      new ArrayBuffer(8),
    )
    expect(await service.readAssetPeaks(project.id, unsaved.asset)).toBeNull()
    expect(await service.readAssetPeaks('another-song', data.asset)).toBeNull()
    expect(
      (await db.readAllStrict<StudioBlobRecord>(STUDIO_STORES.blobs)).map(
        (row) => row.kind,
      ),
    ).not.toContain('peaks')
  })

  it('deletes nothing without the live lease, or on a revision other than the one it opened', async () => {
    const { project, lease } = await arrangementWithRemovedTake()
    const unchanged = async () =>
      expect(
        (await service.listAssets(project.id)).map((asset) => asset.id).sort(),
      ).toEqual(['asset-one', 'asset-two'])

    expect(
      await refusal(
        service.pruneUnusedAssets(project.id, {
          ...lease,
          expectedRevision: 1,
        }),
      ),
    ).toBe('conflict')
    await unchanged()
    clock += STUDIO_EDITOR_LEASE_MS
    const taken = await service.acquireLease(project.id, 'tab-two')
    expect(
      await refusal(
        service.pruneUnusedAssets(project.id, {
          ...lease,
          expectedRevision: 2,
        }),
      ),
    ).toBe('lease-lost')
    await unchanged()
    expect(await blobsOf('asset-two')).toHaveLength(2)
    expect(taken.epoch).toBeGreaterThan(lease.epoch)
  })

  it("never deletes another song's audio, nor audio any song's clip still names", async () => {
    const { project, lease } = await arrangementWithRemovedTake()
    const other = await service.createProject('Other')
    const otherLease = await service.acquireLease(other.id, 'tab-one')
    const otherRemoved = await studioAssetFixture(other.id, 'other-removed')
    await service.saveProject(
      { ...other, revision: 1 },
      { ...otherLease, expectedRevision: 0 },
      [otherRemoved],
    )
    // A song from an older build whose clip names this song's removed take.
    await db.putStrict(STUDIO_STORES.projects, {
      ...studioArrangementFixture(other, 'asset-two'),
      id: 'legacy',
    })

    const kept = await service.pruneUnusedAssets(project.id, {
      ...lease,
      expectedRevision: 2,
    })

    expect(kept.map((asset) => asset.id).sort()).toEqual([
      'asset-one',
      'asset-two',
    ])
    expect(await blobsOf('asset-two')).toHaveLength(2)
    expect(
      (await service.listAssets(other.id)).map((asset) => asset.id),
    ).toEqual(['other-removed'])
    expect(await blobsOf('other-removed')).toHaveLength(2)
  })

  it('keeps every take of a restored song and of a copy, and the source keeps its own', async () => {
    const { project, data, lease } = await arrangementWithRemovedTake()
    const restored = await service.restoreProject(
      studioArrangementFixture({ ...project, revision: 0 }),
      [data],
    )
    const copy = await service.forkProject(project)
    const restoredLease = await service.acquireLease(restored.id, 'tab-one')
    const copyLease = await service.acquireLease(copy.id, 'tab-one')

    expect(
      await service.pruneUnusedAssets(restored.id, {
        ...restoredLease,
        expectedRevision: restored.revision,
      }),
    ).toHaveLength(1)
    expect(
      await service.pruneUnusedAssets(copy.id, {
        ...copyLease,
        expectedRevision: copy.revision,
      }),
    ).toHaveLength(1)
    await service.pruneUnusedAssets(project.id, {
      ...lease,
      expectedRevision: 2,
    })
    expect(await service.listAssets(restored.id)).toHaveLength(1)
    expect(await service.listAssets(copy.id)).toHaveLength(1)
    expect(await service.listAssets(project.id)).toHaveLength(1)
  })

  it('reports quota failure and leaves the last saved revision and caller snapshot intact', async () => {
    const empty = await service.createProject()
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const unsaved = { ...empty, revision: 1, title: 'Still in memory' }
    const put = db.putStrict.bind(db)
    vi.spyOn(db, 'putStrict').mockImplementation((store, value) => {
      if (store === STUDIO_STORES.summaries)
        throw new DOMException('Disk is full', 'QuotaExceededError')
      return put(store, value)
    })
    await expect(
      service.saveProject(unsaved, { ...lease, expectedRevision: 0 }),
    ).rejects.toMatchObject({ code: 'quota-exceeded' })
    expect(await service.loadProject(empty.id)).toEqual(empty)
    expect(unsaved).toMatchObject({ revision: 1, title: 'Still in memory' })
  })

  it('rejects missing and cross-project asset references without changing either project', async () => {
    const empty = await service.createProject()
    const other = await service.createProject()
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const foreign = await studioAssetFixture(other.id)
    await expect(
      service.saveProject(studioArrangementFixture(empty), {
        ...lease,
        expectedRevision: 0,
      }),
    ).rejects.toMatchObject({ code: 'invalid-project' })
    await expect(
      service.saveProject(
        studioArrangementFixture(empty),
        { ...lease, expectedRevision: 0 },
        [foreign],
      ),
    ).rejects.toMatchObject({ code: 'invalid-asset' })
    expect(await service.loadProject(empty.id)).toEqual(empty)
    expect(await service.listAssets(other.id)).toEqual([])
  })

  it('forks an unsaved snapshot with fresh identities and deletes only the owned project', async () => {
    const { project, data, lease } = await savedArrangement()
    const unsaved: StudioProject = {
      ...project,
      title: 'Alternate mix',
      revision: 7,
      mix: { ...project.mix, autoBalanceRevision: 4 },
    }
    const fork = await service.forkProject(unsaved)
    expect(fork).toMatchObject({ title: 'Alternate mix', revision: 0 })
    expect(fork.mix).not.toHaveProperty('autoBalanceRevision')
    expect(fork.id).not.toBe(project.id)
    expect(fork.clips[0].id).not.toBe(project.clips[0].id)
    expect(fork.clips[0].assetId).not.toBe(data.asset.id)
    await service.deleteProject(project.id, {
      ...lease,
      expectedRevision: project.revision,
    })
    await expect(service.loadProject(project.id)).rejects.toMatchObject({
      code: 'not-found',
    })
    const recovered = await service.readAssetBytes(
      fork.id,
      fork.clips[0].assetId,
    )
    expect(await recovered.canonicalPcm.arrayBuffer()).toEqual(
      await data.canonicalPcm.arrayBuffer(),
    )
    expect(await db.readAllStrict(STUDIO_STORES.blobs)).toHaveLength(2)
    expect((await service.listProjects()).map((entry) => entry.id)).toEqual([
      fork.id,
    ])
  })

  it('admits exactly the aggregate byte boundary while rejecting one extra byte or invalid sizes', () => {
    const half = STUDIO_PROJECT_STORAGE_LIMITS.audioBytes / 2
    expect(
      fitsStudioProjectStorageBudget([
        { byteLength: half, canonicalPcmByteLength: half },
      ]),
    ).toBe(true)
    expect(
      fitsStudioProjectStorageBudget([
        { byteLength: half, canonicalPcmByteLength: half + 1 },
      ]),
    ).toBe(false)
    expect(
      fitsStudioProjectStorageBudget([
        { byteLength: Number.NaN, canonicalPcmByteLength: 1 },
      ]),
    ).toBe(false)
  })

  it('counts retained owned audio at the asset boundary and rejects extra imports without a partial save', async () => {
    const empty = await service.createProject()
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const retained = await Promise.all(
      Array.from(
        { length: STUDIO_PROJECT_STORAGE_LIMITS.assetCount },
        (_, index) => studioAssetFixture(empty.id, `retained-${index}`),
      ),
    )
    const saved = await service.saveProject(
      { ...empty, revision: 1 },
      { ...lease, expectedRevision: 0 },
      retained,
    )
    expect(await service.listAssets(empty.id)).toHaveLength(128)
    const extra = await studioAssetFixture(empty.id, 'too-many')
    const readBytes = vi.spyOn(extra.original, 'arrayBuffer')
    await expect(
      service.saveProject(
        { ...saved, revision: 2 },
        { ...lease, expectedRevision: 1 },
        [extra],
      ),
    ).rejects.toMatchObject({ code: 'project-limit' })
    expect(readBytes).not.toHaveBeenCalled()
    expect(await service.loadProject(empty.id)).toEqual(saved)
    expect(await service.listAssets(empty.id)).toHaveLength(128)
    expect(await db.readAllStrict(STUDIO_STORES.blobs)).toHaveLength(256)
    await expect(
      service.restoreProject(saved, [...retained, extra]),
    ).rejects.toMatchObject({ code: 'project-limit' })
    expect(await service.listProjects()).toHaveLength(1)
  })

  it('upgrades an existing v12 browser without losing takes and keeps every Studio table off cloud routing', async () => {
    await db.destroy()
    const legacy = new Dexie(MERCURY_PITCH_DB_NAME)
    legacy.version(12).stores({
      voiceTakeAudio: 'id, &takeId',
      guitarRecordings: 'id, updatedAt, state, takeId',
    })
    await legacy.table('voiceTakeAudio').put({
      id: 'old-audio',
      takeId: 'old-take',
      data: new Uint8Array([1, 2, 3]).buffer,
    })
    await legacy
      .table('guitarRecordings')
      .put({ id: 'guitar-one', title: 'Original melody' })
    legacy.close()
    db = new DexieAdapter()
    await service.createProject('After upgrade')
    expect(
      await db.readByIdStrict('voiceTakeAudio', 'old-audio'),
    ).toMatchObject({ data: new Uint8Array([1, 2, 3]).buffer })
    expect(
      await db.readByIdStrict('guitarRecordings', 'guitar-one'),
    ).toMatchObject({ title: 'Original melody' })
    for (const name of Object.values(STUDIO_STORES))
      expect(CLOUD_ENTITIES.has(name)).toBe(false)
  })
})
