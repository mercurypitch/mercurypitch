// Studio backups round-trip through a fresh database and reject damaged archives before writing.
import { zipSync } from 'fflate'
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { studioArrangementFixture, studioAssetFixture, } from '@/db/services/studio.fixture'
import { createStudioService } from '@/db/services/studio-service'
import { sha256Bytes } from '@/lib/studio/audio/canonical-pcm'
import { releaseStudioResource, reserveStudioMemory, setStudioWorkingBytes, studioReservedMemoryBytes, studioWorkingBytes, } from '@/lib/studio/memory-budget'
import { readStudioArchive as rawReadStudioArchive, STUDIO_BACKUP_LIMITS, writeStudioArchive as rawWriteStudioArchive, } from './archive-codec'
import { createStudioBackup as rawCreateStudioBackup, readStudioBackup as rawReadStudioBackup, restoreStudioBackup, } from './studio-backup'

describe('portable Studio backups', () => {
  const resources: object[] = []

  function track<T extends (...args: never[]) => Promise<object>>(fn: T) {
    return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
      const result = await fn(...args)
      resources.push(result)
      return result as Awaited<ReturnType<T>>
    }
  }
  const createStudioBackup = track(rawCreateStudioBackup)
  const readStudioArchive = track(rawReadStudioArchive)
  const writeStudioArchive = track(rawWriteStudioArchive)
  const readStudioBackup = track(rawReadStudioBackup)
  const text = (bytes: ArrayBuffer | undefined) =>
    new TextDecoder().decode(bytes)
  /** Read entries back into the Blobs the writer takes. */
  const blobs = (entries: ReadonlyMap<string, ArrayBuffer | Blob>) =>
    new Map(
      [...entries].map(([path, value]) => [
        path,
        value instanceof ArrayBuffer ? new Blob([value]) : value,
      ]),
    )
  let db: DexieAdapter
  let service: ReturnType<typeof createStudioService>
  let sequence: number
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob)
    vi.stubGlobal('crypto', webcrypto)
    db = new DexieAdapter()
    sequence = 0
    service = createStudioService({
      database: () => db,
      now: () => new Date('2026-10-26T12:00:00.000Z'),
      createId: () => `backup-${++sequence}`,
    })
  })
  afterEach(async () => {
    for (const resource of resources.splice(0)) releaseStudioResource(resource)
    expect(studioReservedMemoryBytes()).toBe(0)
    await db.destroy()
    vi.unstubAllGlobals()
  })

  async function fixture() {
    const empty = await service.createProject('A small song')
    const data = await studioAssetFixture(empty.id)
    const project = studioArrangementFixture(empty)
    const lease = await service.acquireLease(empty.id, 'tab-one')
    await service.saveProject(project, { ...lease, expectedRevision: 0 }, [
      data,
    ])
    const archive = await createStudioBackup(
      project,
      (id) => service.readAssetBytes(project.id, id),
      { assetMetadata: [data.asset] },
    )
    return { project, data, archive }
  }

  it('restores original/canonical bytes and all edits into a fresh database with new identities', async () => {
    const { project, data, archive } = await fixture()
    await db.destroy()
    db = new DexieAdapter()
    const restored = await restoreStudioBackup(archive, service)
    expect(restored.id).not.toBe(project.id)
    expect(restored.revision).toBe(0)
    expect(restored.title).toBe(project.title)
    expect(restored.clips[0]).toMatchObject({
      startFrame: 96000,
      sourceInFrame: 4,
      sourceOutFrame: 60,
      gainDb: -2,
      fades: project.clips[0].fades,
    })
    expect(restored.clips[0].id).not.toBe(project.clips[0].id)
    expect(restored.tracks[0].id).not.toBe(project.tracks[0].id)
    const recovered = await service.readAssetBytes(
      restored.id,
      restored.clips[0].assetId,
    )
    expect(recovered.asset.canonicalPcmId).not.toBe(data.asset.canonicalPcmId)
    expect(recovered.asset.preparation).toEqual(data.asset.preparation)
    expect(await recovered.original.arrayBuffer()).toEqual(
      await data.original.arrayBuffer(),
    )
    expect(await recovered.canonicalPcm.arrayBuffer()).toEqual(
      await data.canonicalPcm.arrayBuffer(),
    )
    expect(await service.loadProject(restored.id)).toEqual(restored)
    expect(await service.listProjects()).toHaveLength(1)
  })

  it('backs up an unsaved revision and staged audio without pretending it was persisted', async () => {
    const empty = await service.createProject('Unsaved idea')
    const data = await studioAssetFixture(empty.id)
    const project = {
      ...studioArrangementFixture(empty),
      revision: 8,
      title: 'Unsaved mix',
    }
    const read = vi.fn().mockRejectedValue(new Error('Not saved yet'))
    const archive = await createStudioBackup(project, read, {
      preparedAssets: [data],
    })
    const backup = await readStudioBackup(archive)
    expect(backup.project).toEqual(project)
    expect(read).not.toHaveBeenCalled()
    expect((await service.loadProject(empty.id)).revision).toBe(0)
    expect(await service.listAssets(empty.id)).toEqual([])
  })

  it('fails an incomplete unsaved backup explicitly and never returns partial success', async () => {
    const empty = await service.createProject()
    await expect(
      createStudioBackup(studioArrangementFixture(empty), () =>
        Promise.reject(new Error('Missing original')),
      ),
    ).rejects.toThrow('every audio asset')
  })

  it('rejects future project/effect versions and invalid references before inserting any restored rows', async () => {
    const { archive } = await fixture()
    const entries = await readStudioArchive(archive)
    const base = JSON.parse(text(entries.get('manifest.json')))
    const mutations = [
      (manifest: typeof base) => {
        manifest.version = 2
      },
      (manifest: typeof base) => {
        manifest.project.schemaVersion = 2
      },
      (manifest: typeof base) => {
        manifest.project.tracks[0].fx.baseSpec.version = 2
      },
      (manifest: typeof base) => {
        manifest.project.tracks[0].fx.baseSpec.effects.push({
          id: 'future',
          kind: 'unknown-effect',
          enabled: true,
          params: {},
        })
      },
      (manifest: typeof base) => {
        manifest.project.clips[0].assetId = 'not-in-archive'
      },
      (manifest: typeof base) => {
        manifest.assets[0].asset.practiceScore = 98
      },
      (manifest: typeof base) => {
        manifest.assets[0].canonicalPath = '../elsewhere'
      },
    ]
    for (const mutate of mutations) {
      const manifest = structuredClone(base)
      mutate(manifest)
      const changed = new Map<string, ArrayBuffer | Blob>(entries)
      changed.set('manifest.json', new Blob([JSON.stringify(manifest)]))
      await expect(
        restoreStudioBackup(await writeStudioArchive(blobs(changed)), service),
      ).rejects.toThrow()
      expect(await service.listProjects()).toHaveLength(1)
    }
  })

  it('verifies original hashes and canonical finite samples even if an attacker updates the declared hash', async () => {
    const { archive } = await fixture()
    const entries = await readStudioArchive(archive)
    const badOriginal = new Map<string, ArrayBuffer | Blob>(entries)
    badOriginal.set(
      'assets/0/original.bin',
      new Blob([
        'corrupt original'.padEnd(
          entries.get('assets/0/original.bin')!.byteLength,
        ),
      ]),
    )
    await expect(
      restoreStudioBackup(
        await writeStudioArchive(blobs(badOriginal)),
        service,
      ),
    ).rejects.toThrow('checksum')

    const manifest = JSON.parse(text(entries.get('manifest.json')))
    const damaged = entries.get('assets/0/canonical.pcm')!.slice(0)
    new DataView(damaged).setFloat32(32, Number.NaN, true)
    manifest.assets[0].asset.canonicalPcmSha256 = await sha256Bytes(damaged)
    const badCanonical = new Map<string, ArrayBuffer | Blob>(entries)
    badCanonical.set('assets/0/canonical.pcm', damaged)
    badCanonical.set('manifest.json', new Blob([JSON.stringify(manifest)]))
    await expect(
      restoreStudioBackup(
        await writeStudioArchive(blobs(badCanonical)),
        service,
      ),
    ).rejects.toThrow('checksum')
    expect(await service.listProjects()).toHaveLength(1)
  })

  it('rejects same-length valid JSON corruption of saved edits through the ZIP checksum', async () => {
    const { archive } = await fixture()
    const bytes = new Uint8Array(await archive.arrayBuffer())
    const needle = new TextEncoder().encode('"gainDb":-2')
    let changed = false
    for (let offset = 0; offset <= bytes.length - needle.length; offset++) {
      if (!needle.every((byte, index) => bytes[offset + index] === byte))
        continue
      bytes[offset + needle.length - 1] = 51
      changed = true
      break
    }
    expect(changed).toBe(true)
    await expect(
      restoreStudioBackup(new Blob([bytes]), service),
    ).rejects.toThrow('checksum')
    expect(await service.listProjects()).toHaveLength(1)
  })

  it('rejects unsafe paths, duplicate ZIP entries, missing files and truncated directories', async () => {
    const { archive } = await fixture()
    const unsafe = new Blob([
      zipSync({
        'manifest.json': new TextEncoder().encode('{}'),
        '../escape': new Uint8Array([1]),
      }),
    ])
    await expect(readStudioBackup(unsafe)).rejects.toThrow('path')
    await expect(
      readStudioBackup(archive.slice(0, archive.size - 10)),
    ).rejects.toThrow('directory')
    const entries = await readStudioArchive(archive)
    entries.delete('assets/0/original.bin')
    await expect(
      readStudioBackup(await writeStudioArchive(blobs(entries))),
    ).rejects.toThrow('missing')
    const duplicateBytes = zipSync({
      'manifest.json': new TextEncoder().encode('{}'),
      'assets/0/original.bin': new Uint8Array([1]),
      'assets/1/original.bin': new Uint8Array([2]),
    })
    // Replace both local and directory names without changing the ZIP layout.
    const duplicateText = new TextDecoder('latin1').decode(duplicateBytes)
    const needle = new TextEncoder().encode('assets/1/original.bin')
    for (
      let offset = 0;
      offset <= duplicateBytes.length - needle.length;
      offset++
    ) {
      if (
        needle.every((byte, index) => duplicateBytes[offset + index] === byte)
      )
        duplicateBytes[offset + 7] = 48
    }
    expect(duplicateText).toContain('assets/1/original.bin')
    await expect(readStudioArchive(new Blob([duplicateBytes]))).rejects.toThrow(
      'duplicate',
    )
  })

  it('rejects excessive declared sizes before inflation and honors cancellation', async () => {
    const { archive } = await fixture()
    const bytes = await archive.arrayBuffer()
    const view = new DataView(bytes)
    const directoryOffset = view.getUint32(bytes.byteLength - 6, true)
    view.setUint32(
      directoryOffset + 24,
      STUDIO_BACKUP_LIMITS.manifestBytes + 1,
      true,
    )
    await expect(readStudioBackup(new Blob([bytes]))).rejects.toThrow(
      'oversized',
    )
    const cancelled = new AbortController()
    cancelled.abort()
    await expect(
      readStudioBackup(archive, { signal: cancelled.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('rejects backup and restore before audio reads when working memory is already occupied', async () => {
    const { project, data, archive } = await fixture()
    const held = studioReservedMemoryBytes()
    const release = reserveStudioMemory(studioWorkingBytes() - held - 64)
    const read = vi.fn()
    try {
      await expect(
        createStudioBackup(project, read, { assetMetadata: [data.asset] }),
      ).rejects.toThrow(/Studio needs more memory/)
      expect(read).not.toHaveBeenCalled()
      await expect(restoreStudioBackup(archive, service)).rejects.toThrow(
        /memory/,
      )
      expect(await service.listProjects()).toHaveLength(1)
    } finally {
      release()
    }
    expect(studioReservedMemoryBytes()).toBe(held)
  })

  it('reads an archive into one buffer per entry, holding its contents once', async () => {
    const MiB = 1024 * 1024
    const audio = new Uint8Array(4 * MiB).fill(7)
    const stored = await writeStudioArchive(
      new Map([
        ['manifest.json', new Blob(['{}'])],
        ['assets/0/canonical.pcm', new Blob([audio])],
      ]),
    )
    const before = studioReservedMemoryBytes()

    const entries = await readStudioArchive(stored)

    // A byte-for-byte comparison of 4 MiB through toEqual takes seconds.
    const same = (bytes: ArrayBuffer | undefined) =>
      Buffer.from(bytes!).equals(Buffer.from(audio.buffer))
    expect(studioReservedMemoryBytes() - before).toBe(4 * MiB + 2)
    expect(same(entries.get('assets/0/canonical.pcm'))).toBe(true)
    // Deflated entries, as other ZIP tools write them, read the same way.
    const deflated = await readStudioArchive(
      new Blob([
        zipSync({
          'manifest.json': new TextEncoder().encode('{}'),
          'assets/0/original.bin': audio,
        }),
      ]),
    )
    expect(same(deflated.get('assets/0/original.bin'))).toBe(true)
  })

  it('writes an archive within its own size plus one fold, not twice its size', async () => {
    const held = studioReservedMemoryBytes()
    const MiB = 1024 * 1024
    const entries = new Map<string, Blob>([
      ['manifest.json', new Blob(['{}'])],
      ['assets/0/canonical.pcm', new Blob([new Uint8Array(20 * MiB)])],
    ])
    setStudioWorkingBytes(held + 30 * MiB)
    try {
      const archive = await writeStudioArchive(entries)
      expect(archive.size).toBeGreaterThan(20 * MiB)
    } finally {
      setStudioWorkingBytes(null)
    }
  })
})
