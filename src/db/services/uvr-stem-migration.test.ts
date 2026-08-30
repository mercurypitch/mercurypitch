// ============================================================
// Lazy stem migration tests — legacy ArrayBuffer rows through real reads
// ============================================================
//
// These run against the real DexieAdapter over fake-indexeddb, seeding rows
// exactly as the pre-Blob storage wrote them (data: ArrayBuffer), then
// exercising the production read APIs. That makes them the migration
// contract: old databases keep working, and quietly become new databases.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import type { UvrStemBlob, UvrStemType } from '@/db/entities'
import { readUvrStemSelectionWithinBudget, readUvrStemSnapshot, } from '@/db/services/uvr-read-service'
import { getStemBlob, getStemBlobEntry } from '@/db/services/uvr-service'
import { queueStemRowBlobMigration, resetStemRowMigrationsForTests, stemRowMigrationsSettled, } from '@/db/services/uvr-stem-migration'
import { buildBenchWav } from '@/features/lab/stem-storage-bench'

const SESSION = 'migration-session'
const WAV = buildBenchWav(64 * 1024, 42)

async function repo() {
  return (await getDb()).getRepository<UvrStemBlob>('uvrStemBlobs')
}

async function seedLegacyRow(
  stemType: UvrStemType = 'vocal',
  sessionId: string = SESSION,
): Promise<UvrStemBlob> {
  // Exactly what the pre-Blob writer stored: a raw ArrayBuffer value.
  return (await repo()).create({
    sessionId,
    stemType,
    mimeType: 'audio/wav',
    data: WAV.slice(0),
    size: WAV.byteLength,
    fileName: `${stemType}.wav`,
  })
}

async function rowById(id: string): Promise<UvrStemBlob | undefined> {
  const rows = await (await repo()).findAll({})
  return rows.find((row) => row.id === id)
}

async function readBytes(data: ArrayBuffer | Blob): Promise<Uint8Array> {
  if (!(data instanceof Blob)) return new Uint8Array(data)
  return new Uint8Array(
    await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error ?? new Error('read failed'))
      reader.readAsArrayBuffer(data)
    }),
  )
}

beforeEach(async () => {
  resetStemRowMigrationsForTests()
  const stems = await repo()
  for (const row of await stems.findAll({})) await stems.delete(row.id)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('queueStemRowBlobMigration', () => {
  it('rewrites a legacy row as a Blob with identical bytes', async () => {
    const seeded = await seedLegacyRow()

    queueStemRowBlobMigration(seeded)
    await stemRowMigrationsSettled()

    const migrated = await rowById(seeded.id)
    expect(migrated?.data).toBeInstanceOf(Blob)
    expect(migrated?.size).toBe(WAV.byteLength)
    expect(await readBytes(migrated!.data)).toEqual(new Uint8Array(WAV))
    // Newest-row selection keys off createdAt; migration must not touch it.
    expect(migrated?.createdAt).toBe(seeded.createdAt)
  })

  it('leaves Blob rows alone', async () => {
    const stems = await repo()
    const created = await stems.create({
      sessionId: SESSION,
      stemType: 'vocal',
      mimeType: 'audio/wav',
      data: new Blob([WAV], { type: 'audio/wav' }),
      size: WAV.byteLength,
      fileName: 'vocal.wav',
    })

    queueStemRowBlobMigration(created)
    await stemRowMigrationsSettled()

    const after = await rowById(created.id)
    expect(after?.updatedAt).toBe(created.updatedAt)
  })

  it('attempts each row at most once per page load', async () => {
    const seeded = await seedLegacyRow()
    queueStemRowBlobMigration(seeded)
    await stemRowMigrationsSettled()

    // Flip the row back to a legacy shape behind the migrator's back.
    await (await repo()).update(seeded.id, { data: WAV.slice(0) })
    queueStemRowBlobMigration({ ...seeded, data: WAV.slice(0) })
    await stemRowMigrationsSettled()

    expect((await rowById(seeded.id))?.data instanceof Blob).toBe(false)
  })

  it('skips silently when storage is too tight for old + new copies', async () => {
    const seeded = await seedLegacyRow()
    vi.stubGlobal('navigator', {
      ...navigator,
      storage: {
        estimate: async () => ({
          usage: 1000,
          quota: 1000 + WAV.byteLength, // room for one copy, not two
        }),
      },
    })

    queueStemRowBlobMigration(seeded)
    await stemRowMigrationsSettled()

    expect((await rowById(seeded.id))?.data instanceof Blob).toBe(false)
  })

  it('survives the row being deleted before the rewrite lands', async () => {
    const seeded = await seedLegacyRow()
    await (await repo()).delete(seeded.id)

    queueStemRowBlobMigration(seeded)
    await expect(stemRowMigrationsSettled()).resolves.toBeUndefined()
    expect(await rowById(seeded.id)).toBeUndefined()
  })
})

describe('legacy rows through the production read paths', () => {
  it('getStemBlob serves legacy bytes and migrates the row', async () => {
    const seeded = await seedLegacyRow()

    const blob = await getStemBlob(SESSION, 'vocal')
    expect(blob).not.toBeNull()
    expect(await readBytes(blob!)).toEqual(new Uint8Array(WAV))

    await stemRowMigrationsSettled()
    expect((await rowById(seeded.id))?.data).toBeInstanceOf(Blob)
  })

  it('getStemBlobEntry reads the WAV duration from either era', async () => {
    await seedLegacyRow()
    const legacy = await getStemBlobEntry(SESSION, 'vocal')
    await stemRowMigrationsSettled()
    const migrated = await getStemBlobEntry(SESSION, 'vocal')

    expect(legacy?.duration).toBeGreaterThan(0)
    expect(migrated?.duration).toBe(legacy?.duration)
    expect(migrated?.size).toBe(legacy?.size)
  })

  it('snapshot reads migrate what they touch', async () => {
    const vocal = await seedLegacyRow('vocal')
    const drums = await seedLegacyRow('drums')

    const snapshot = await readUvrStemSnapshot(SESSION)
    expect(snapshot.map((stem) => stem.kind).sort()).toEqual(['drums', 'vocal'])

    await stemRowMigrationsSettled()
    expect((await rowById(vocal.id))?.data).toBeInstanceOf(Blob)
    expect((await rowById(drums.id))?.data).toBeInstanceOf(Blob)
  })

  it('budgeted selection prices legacy rows off size, then migrates them', async () => {
    const seeded = await seedLegacyRow()

    const selection = await readUvrStemSelectionWithinBudget(
      SESSION,
      ['vocal'],
      { signal: new AbortController().signal, budgetBytes: WAV.byteLength },
    )
    expect(selection.ok).toBe(true)

    await stemRowMigrationsSettled()
    expect((await rowById(seeded.id))?.data).toBeInstanceOf(Blob)
  })

  it('a mixed-era session reads consistently before and after migration', async () => {
    // One row per era in the same store — the exact state a half-migrated
    // database is in.
    const legacy = await seedLegacyRow('vocal')
    const stems = await repo()
    const modern = await stems.create({
      sessionId: SESSION,
      stemType: 'instrumental',
      mimeType: 'audio/wav',
      data: new Blob([WAV], { type: 'audio/wav' }),
      size: WAV.byteLength,
      fileName: 'instrumental.wav',
    })

    const snapshot = await readUvrStemSnapshot(SESSION)
    for (const stem of snapshot) {
      expect(await readBytes(stem.data)).toEqual(new Uint8Array(WAV))
    }

    await stemRowMigrationsSettled()
    expect((await rowById(legacy.id))?.data).toBeInstanceOf(Blob)
    expect((await rowById(modern.id))?.updatedAt).toBe(modern.updatedAt)
  })
})
