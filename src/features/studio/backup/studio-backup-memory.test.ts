// Studio backup, restore and copy memory — a backup to a file holds one take, a restored backup or a copied song holds its audio once, and a lack of room says so, never that audio is missing.
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { createStudioService } from '@/db/services/studio-service'
import { encodeCanonicalPcm, sha256Bytes, } from '@/lib/studio/audio/canonical-pcm'
import type * as MemoryBudget from '@/lib/studio/memory-budget'
import { releaseStudioResource, reserveStudioMemory, setStudioWorkingBytes, studioReservedMemoryBytes, } from '@/lib/studio/memory-budget'
import { createStudioTrack } from '@/lib/studio/model/defaults'
import type { StudioAssetData, StudioProject } from '@/lib/studio/model/types'
import type { StudioArchiveSink } from './archive-writer'
import { studioArchiveHeldBytes } from './archive-writer'
import { createStudioBackup, restoreStudioBackup, writeStudioBackup, } from './studio-backup'

const peak = vi.hoisted(() => ({ bytes: 0 }))
vi.mock('@/lib/studio/memory-budget', async (importOriginal) => {
  const budget = await importOriginal<typeof MemoryBudget>()
  return {
    ...budget,
    // Every reservation passes through here, so the highest total is seen.
    reserveStudioMemory: (bytes: number) => {
      const release = budget.reserveStudioMemory(bytes)
      peak.bytes = Math.max(peak.bytes, budget.studioReservedMemoryBytes())
      return release
    },
  }
})

const MiB = 1024 * 1024
const FRAMES = 20 * 48_000

/** A 20-second stereo take: 7.7 MB of canonical PCM and a 400 kB original. */
async function take(projectId: string, id: string): Promise<StudioAssetData> {
  const left = new Float32Array(FRAMES)
  const right = new Float32Array(FRAMES)
  for (let frame = 0; frame < FRAMES; frame += 3) {
    left[frame] = Math.sin(frame * 0.01) * 0.2
    right[frame] = Math.cos(frame * 0.01) * 0.2
  }
  const canonicalPcm = await encodeCanonicalPcm({
    sampleRate: 48_000,
    numberOfChannels: 2,
    length: FRAMES,
    getChannelData: (channel) => (channel === 0 ? left : right),
  })
  const raw = new Uint8Array(400_000)
  for (let index = 0; index < raw.length; index++)
    raw[index] = (index * 131 + id.length) & 255
  const original = new Blob([raw], { type: 'audio/mpeg' })
  return {
    original,
    canonicalPcm,
    asset: {
      id,
      projectId,
      sha256: await sha256Bytes(raw.buffer),
      mimeType: 'audio/mpeg',
      byteLength: original.size,
      channels: 2,
      normalizedSampleRate: 48_000,
      normalizedFrameCount: FRAMES,
      importVersion: 1,
      canonicalPcmId: `${id}-pcm-v1`,
      canonicalPcmSha256: await sha256Bytes(await canonicalPcm.arrayBuffer()),
      canonicalPcmByteLength: canonicalPcm.size,
      preparation: { algorithmVersion: 'bs1770-48k-v1', gainDb: 0 },
      provenance: {
        kind: 'karaoke',
        sourceId: `kept-${id}`,
        importedAt: '2026-10-27T12:00:00.000Z',
      },
    },
  }
}

function arrangement(
  project: StudioProject,
  takes: readonly StudioAssetData[],
): StudioProject {
  return {
    ...project,
    revision: project.revision + 1,
    tracks: takes.map((_, index) =>
      createStudioTrack({
        id: `lane-${index}`,
        name: `Take ${index + 1}`,
        order: index,
        role: 'voice',
      }),
    ),
    clips: takes.map((data, index) => ({
      id: `clip-${index}`,
      trackId: `lane-${index}`,
      assetId: data.asset.id,
      startFrame: 0,
      sourceInFrame: 0,
      sourceOutFrame: FRAMES,
      gainDb: 0,
      fades: {
        curve: 'linear-amplitude' as const,
        in: { fromSourceFrame: 0, toSourceFrame: 4800 },
        out: { fromSourceFrame: FRAMES - 4800, toSourceFrame: FRAMES },
      },
    })),
  }
}

describe('Studio restore and copy memory', () => {
  let db: DexieAdapter
  let service: ReturnType<typeof createStudioService>
  let takes: StudioAssetData[]
  let song: StudioProject
  /** The song's audio: every take's original and canonical PCM. */
  let audioBytes: number

  beforeEach(async () => {
    vi.stubGlobal('Blob', NodeBlob)
    vi.stubGlobal('crypto', webcrypto)
    setStudioWorkingBytes(512 * MiB)
    db = new DexieAdapter()
    let sequence = 0
    service = createStudioService({
      database: () => db,
      now: () => new Date('2026-10-27T12:00:00.000Z'),
      createId: () => `copy-${++sequence}`,
    })
    const empty = await service.createProject('Two takes')
    takes = [await take(empty.id, 'take-one'), await take(empty.id, 'take-two')]
    audioBytes = takes.reduce(
      (sum, data) =>
        sum + data.asset.byteLength + data.asset.canonicalPcmByteLength,
      0,
    )
    const lease = await service.acquireLease(empty.id, 'tab-one')
    song = await service.saveProject(
      arrangement(empty, takes),
      { ...lease, expectedRevision: 0 },
      takes,
    )
  })
  afterEach(async () => {
    setStudioWorkingBytes(null)
    expect(studioReservedMemoryBytes()).toBe(0)
    await db.destroy()
    vi.unstubAllGlobals()
  })

  function backup(): Promise<Blob> {
    return createStudioBackup(
      song,
      (id) => service.readAssetBytes(song.id, id),
      { assetMetadata: takes.map((data) => data.asset) },
    )
  }

  /** The most memory reserved while `work` ran, above what was held before. */
  async function peakOf<T>(work: () => Promise<T>): Promise<[T, number]> {
    const before = studioReservedMemoryBytes()
    peak.bytes = before
    const result = await work()
    return [result, peak.bytes - before]
  }

  it('writes a backup to a file holding one take at a time, where memory held the song twice', async () => {
    let release = () => {}
    const file: StudioArchiveSink = {
      reserve(archiveBytes) {
        release = reserveStudioMemory(
          studioArchiveHeldBytes(archiveBytes, false),
        )
      },
      write: async () => {},
    }
    const [, held] = await peakOf(() =>
      writeStudioBackup(
        song,
        (id) => service.readAssetBuffers(song.id, id),
        file,
        {
          assetMetadata: takes.map((data) => data.asset),
        },
      ),
    )
    release()
    const [archive, inMemory] = await peakOf(backup)
    releaseStudioResource(archive)

    const take =
      takes[0].asset.byteLength + takes[0].asset.canonicalPcmByteLength
    expect(held).toBeLessThanOrEqual(take + studioArchiveHeldBytes(0, false))
    expect(held).toBeLessThan(audioBytes)
    // In memory, the archive and the take being read.
    expect(inMemory).toBeGreaterThan(audioBytes)
    expect(inMemory).toBeLessThanOrEqual(audioBytes + take + 10 * MiB)
  })

  it('restores a backup holding the song audio once, not three times over', async () => {
    const archive = await backup()
    try {
      const [restored, held] = await peakOf(() =>
        restoreStudioBackup(archive, service),
      )

      expect(held).toBeLessThanOrEqual(1.5 * audioBytes)
      const audio = await service.readAssetBytes(
        restored.id,
        restored.clips[1].assetId,
      )
      expect(await audio.canonicalPcm.arrayBuffer()).toEqual(
        await takes[1].canonicalPcm.arrayBuffer(),
      )
    } finally {
      releaseStudioResource(archive)
    }
  })

  it('reads a backup Studio wrote in 4 MiB pieces, where it took 16 KiB ones', async () => {
    const archive = await backup()
    try {
      const slice = vi.spyOn(archive, 'slice')
      await restoreStudioBackup(archive, service)
      // The entries in 4 MiB reads, and the directory at the end in two.
      const reads = Math.ceil(archive.size / (4 * MiB))
      expect(slice.mock.calls.length).toBeLessThanOrEqual(reads + 2)
      expect(archive.size / (16 * 1024)).toBeGreaterThan(100)
    } finally {
      releaseStudioResource(archive)
    }
  })

  it('copies a song holding its saved audio once, not three times over', async () => {
    const [copy, held] = await peakOf(() => service.forkProject(song))

    expect(held).toBeLessThanOrEqual(1.5 * audioBytes)
    expect(copy.id).not.toBe(song.id)
    const audio = await service.readAssetBytes(copy.id, copy.clips[0].assetId)
    expect(await audio.original.arrayBuffer()).toEqual(
      await takes[0].original.arrayBuffer(),
    )
  })

  it('says a restore needs more memory when the room runs out, and writes nothing', async () => {
    const archive = await backup()
    try {
      setStudioWorkingBytes(studioReservedMemoryBytes() + audioBytes / 2)

      await expect(restoreStudioBackup(archive, service)).rejects.toThrow(
        'Studio needs more memory to open this backup. Stop playback and try again.',
      )
      expect(await service.listProjects()).toHaveLength(1)
    } finally {
      releaseStudioResource(archive)
    }
  })

  it('says a copy needs more memory when the room runs out, and writes nothing', async () => {
    setStudioWorkingBytes(audioBytes / 2)

    await expect(service.forkProject(song)).rejects.toMatchObject({
      code: 'memory-limit',
      message:
        'Studio needs more memory to copy this song. Stop playback and try again.',
    })
    expect(await service.listProjects()).toHaveLength(1)
  })

  it('says a backup needs more memory when the browser cannot allocate the audio, not that audio is missing', async () => {
    const read = vi
      .fn()
      .mockRejectedValue(new RangeError('Array buffer allocation failed'))

    await expect(
      createStudioBackup(song, read, {
        assetMetadata: takes.map((data) => data.asset),
      }),
    ).rejects.toThrow(
      'Studio needs more memory to make this backup. Stop playback and try again.',
    )
  })

  it('stops a restore cancelled while its audio is checked, before writing anything', async () => {
    const archive = await backup()
    const cancel = new AbortController()
    const restore = service.restoreProject
    vi.spyOn(service, 'restoreProject').mockImplementation(
      (project, assets, options) => {
        cancel.abort()
        return restore(project, assets, options)
      },
    )
    try {
      await expect(
        restoreStudioBackup(archive, service, { signal: cancel.signal }),
      ).rejects.toMatchObject({ name: 'AbortError' })
      expect(await service.listProjects()).toHaveLength(1)
    } finally {
      releaseStudioResource(archive)
    }
  })
})
