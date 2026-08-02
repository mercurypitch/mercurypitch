import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }))
const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({
  getDb: getDbMock,
  ensurePersistentStorage: vi.fn().mockResolvedValue(false),
}))

import { ensurePersistentStorage } from '@/db'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { CLOUD_ENTITIES, HybridAdapter } from '@/db/adapters/hybrid-adapter'
import type { VoiceTakeAudioRecord, VoiceTakeRecord } from '@/db/entities'
import { deleteVoiceTake, deleteVoiceThread, getVoiceTakeBlob, listVoiceTakes, renameFreeformVoiceThread, saveVoiceTake, updateVoiceTake, wipeVoiceTakes, } from '@/db/services/voice-take-service'
import { InMemoryAdapter } from './utils/in-memory-db'

function draft(capturedAt = '2026-08-01T12:00:00.000Z') {
  const data = new Uint8Array([1, 2, 3, 4])
  const blob = new Blob([data], { type: 'audio/webm' })
  Object.defineProperty(blob, 'arrayBuffer', {
    configurable: true,
    value: async () => data.buffer.slice(0),
  })
  return {
    source: 'glass' as const,
    comparisonKey: 'glass:target-midi:60:v1',
    contextVersion: 1,
    capturedAt,
    durationMs: 4200,
    blob,
    peaks: new Float32Array([0.1, 0.5, 1.2]),
    title: 'Glass · C4 · Take 1',
    context: { targetMidi: 60, targetLabel: 'C4', rep: 1 },
    metrics: { meanAbsCents: 12, bestLockSec: 1.4 },
    metricsVersion: 1,
  }
}

beforeEach(async () => {
  await adapter.destroy()
  getDbMock.mockReset()
  getDbMock.mockResolvedValue(adapter)
  vi.mocked(ensurePersistentStorage).mockClear()
})

describe('voice take persistence', () => {
  it('round-trips metadata and its separate audio payload', async () => {
    const result = await saveVoiceTake(draft())

    expect(result.ok).toBe(true)
    expect(result.value).toMatchObject({
      source: 'glass',
      comparisonKey: 'glass:target-midi:60:v1',
      sizeBytes: 4,
    })
    expect(result.value!.peaks[0]).toBeCloseTo(0.1)
    expect(result.value!.peaks.slice(1)).toEqual([0.5, 1])
    expect(JSON.parse(result.value!.contextJson)).toEqual({
      targetMidi: 60,
      targetLabel: 'C4',
      rep: 1,
    })
    expect(JSON.parse(result.value!.metricsJson!)).toEqual({
      meanAbsCents: 12,
      bestLockSec: 1.4,
    })

    const audio = await getVoiceTakeBlob(result.value!.id)
    expect(audio?.type).toBe('audio/webm')
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.addEventListener('load', () =>
        resolve(reader.result as ArrayBuffer),
      )
      reader.addEventListener('error', () => reject(reader.error))
      reader.readAsArrayBuffer(audio!)
    })
    expect([...new Uint8Array(bytes)]).toEqual([1, 2, 3, 4])
    expect(ensurePersistentStorage).toHaveBeenCalledWith('voice-takes')
  })

  it('returns an actionable failure when the local blob cannot be read', async () => {
    const unreadable = draft()
    const arrayBuffer = vi
      .fn<() => Promise<ArrayBuffer>>()
      .mockRejectedValue(
        new DOMException('Blob read failed', 'NotReadableError'),
      )
    Object.defineProperty(unreadable.blob, 'arrayBuffer', {
      value: arrayBuffer,
    })
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    await expect(saveVoiceTake(unreadable)).resolves.toMatchObject({
      ok: false,
      quotaExceeded: false,
      roomAvailable: true,
    })
    expect(arrayBuffer).toHaveBeenCalledTimes(2)
    errorSpy.mockRestore()
  })

  it('lists newest first and updates list-safe metadata', async () => {
    const older = await saveVoiceTake(draft('2026-07-01T12:00:00.000Z'))
    const newer = await saveVoiceTake(draft('2026-08-01T12:00:00.000Z'))

    expect((await listVoiceTakes()).map((take) => take.id)).toEqual([
      newer.value!.id,
      older.value!.id,
    ])
    expect(
      await updateVoiceTake(older.value!.id, {
        title: 'My C4 baseline',
        favorite: true,
      }),
    ).toMatchObject({ title: 'My C4 baseline', favorite: true })
  })

  it('renames every take in a freeform thread without changing its identity', async () => {
    const comparisonKey = 'freeform:chorus-thread:v1'
    const first = await saveVoiceTake({
      ...draft('2026-08-01T12:00:00.000Z'),
      source: 'freeform',
      comparisonKey,
      title: 'Old chorus name',
      context: {
        threadTitle: 'Old chorus name',
        prompt: 'Old chorus name',
        preserved: true,
      },
    })
    const second = await saveVoiceTake({
      ...draft('2026-08-02T12:00:00.000Z'),
      source: 'freeform',
      comparisonKey,
      title: 'Old chorus name',
      context: { threadTitle: 'Old chorus name', prompt: 'Old chorus name' },
    })

    expect(
      await renameFreeformVoiceThread(comparisonKey, '  New chorus name  '),
    ).toBe(true)

    const renamed = (await listVoiceTakes()).filter(
      (take) => take.comparisonKey === comparisonKey,
    )
    expect(renamed).toHaveLength(2)
    expect(renamed.map((take) => take.title)).toEqual([
      'New chorus name',
      'New chorus name',
    ])
    expect(
      JSON.parse(
        renamed.find((take) => take.id === first.value!.id)!.contextJson,
      ),
    ).toEqual({
      threadTitle: 'New chorus name',
      prompt: 'New chorus name',
      preserved: true,
    })
    expect(renamed.map((take) => take.comparisonKey)).toEqual([
      second.value!.comparisonKey,
      first.value!.comparisonKey,
    ])
  })

  it('deletes takes, complete threads, and the full local history', async () => {
    const first = await saveVoiceTake(draft())
    const second = await saveVoiceTake(draft('2026-08-02T12:00:00.000Z'))
    const otherThread = await saveVoiceTake({
      ...draft('2026-08-03T12:00:00.000Z'),
      comparisonKey: 'glass:target-midi:61:v1',
      title: 'Glass · C-sharp 4 · Take 1',
    })

    expect(await deleteVoiceTake(first.value!.id)).toBe(true)
    expect(await getVoiceTakeBlob(first.value!.id)).toBeNull()
    expect(await listVoiceTakes()).toHaveLength(2)

    expect(await deleteVoiceThread(second.value!.comparisonKey)).toBe(true)
    expect(await getVoiceTakeBlob(second.value!.id)).toBeNull()
    expect((await listVoiceTakes()).map((take) => take.id)).toEqual([
      otherThread.value!.id,
    ])

    expect(await wipeVoiceTakes()).toBe(true)
    expect(await listVoiceTakes()).toEqual([])
    expect(await getVoiceTakeBlob(otherThread.value!.id)).toBeNull()
  })

  it('clears local voice stores through the preview HybridAdapter path', async () => {
    const cloud = new InMemoryAdapter()
    const local = new DexieAdapter()
    const hybrid = new HybridAdapter(cloud, local)
    const cloudTransaction = vi.spyOn(cloud, 'transaction')
    getDbMock.mockResolvedValue(hybrid)

    try {
      const saved = await saveVoiceTake(draft())
      expect(saved.ok).toBe(true)
      expect(await wipeVoiceTakes()).toBe(true)
      expect(await listVoiceTakes()).toEqual([])
      expect(await getVoiceTakeBlob(saved.value!.id)).toBeNull()
      expect(cloudTransaction).not.toHaveBeenCalled()
    } finally {
      await hybrid.destroy()
    }
  })
})

describe('voice take Dexie schema', () => {
  let dexie: DexieAdapter

  beforeEach(() => {
    dexie = new DexieAdapter()
  })

  afterEach(async () => {
    await dexie.destroy()
  })

  it('creates the v6 metadata and audio stores', async () => {
    const take = await dexie
      .getRepository<VoiceTakeRecord>('voiceTakes')
      .create({
        source: 'glass',
        comparisonKey: 'glass:target-midi:60:v1',
        contextVersion: 1,
        capturedAt: '2026-08-01T12:00:00.000Z',
        durationMs: 4200,
        mimeType: 'audio/webm',
        sizeBytes: 4,
        peaks: [0.2, 0.7],
        title: 'Glass · C4 · Take 1',
        favorite: false,
        contextJson: '{}',
      })
    const audio = await dexie
      .getRepository<VoiceTakeAudioRecord>('voiceTakeAudio')
      .create({
        takeId: take.id,
        mimeType: 'audio/webm',
        size: 4,
        data: new Uint8Array([1, 2, 3, 4]).buffer,
      })

    expect(
      await dexie
        .getRepository<VoiceTakeRecord>('voiceTakes')
        .findById(take.id),
    ).toMatchObject({ source: 'glass', comparisonKey: take.comparisonKey })
    expect(
      await dexie
        .getRepository<VoiceTakeAudioRecord>('voiceTakeAudio')
        .findById(audio.id),
    ).toMatchObject({ takeId: take.id, size: 4 })
  })

  it('keeps both voice stores out of cloud routing', () => {
    expect(CLOUD_ENTITIES.has('voiceTakes')).toBe(false)
    expect(CLOUD_ENTITIES.has('voiceTakeAudio')).toBe(false)
  })
})
