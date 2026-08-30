// Shared UVR source tests pin metadata-only selection, complete Drum partitions, budgets, and URL cleanup.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSessionRecord } from '@/db/entities'
import type { UvrStemSnapshotEntry } from '@/db/services/uvr-read-service'

const adapterReads = vi.hoisted(() => ({
  readUvrSessionRecords: vi.fn(),
  readUvrStemManifest: vi.fn(),
  readUvrStemSelectionWithinBudget: vi.fn(),
  openUvrStemLease: vi.fn(),
}))

vi.mock('@/db/services/uvr-read-service', () => ({
  readUvrSessionRecords: adapterReads.readUvrSessionRecords,
  readUvrStemManifest: adapterReads.readUvrStemManifest,
  readUvrStemSelectionWithinBudget:
    adapterReads.readUvrStemSelectionWithinBudget,
}))

vi.mock('@/lib/uvr-stem-lease', () => ({
  openUvrStemLease: adapterReads.openUvrStemLease,
}))

import { defaultPlayAlongEncodedByteBudget, DRUM_PLAY_ALONG_POLICY, } from './song-port'
import { createUvrPlayAlongSongPort } from './uvr-song-port'

function sessionRecord(sessionId: string): UvrSessionRecord {
  return {
    id: `${sessionId}-record`,
    createdAt: '2026-08-24T09:00:00.000Z',
    updatedAt: '2026-08-24T10:00:00.000Z',
    appSessionId: sessionId,
    userId: 'local-user',
    status: 'completed',
    progress: 100,
    originalFileName: `${sessionId}.wav`,
    originalFileSize: 100,
    originalFileType: 'audio/wav',
    processingMode: 'local',
    appCreatedAt: Date.UTC(2026, 7, 24),
    stemMetaJson: JSON.stringify({
      vocal: { duration: 181, size: 8 },
      instrumental: { duration: 181, size: 8 },
      drums: { duration: 181.5, size: 8 },
      bass: { duration: 181.5, size: 8 },
      guitar: { duration: 181.5, size: 8 },
      piano: { duration: 181.5, size: 8 },
      other: { duration: 182, size: 8 },
    }),
  }
}

function snapshotStem(
  kind: UvrStemSnapshotEntry['kind'],
): UvrStemSnapshotEntry {
  return {
    kind,
    mimeType: 'audio/wav',
    data: new ArrayBuffer(8),
    sizeBytes: 8,
  }
}

function successfulSelection(kinds: readonly UvrStemSnapshotEntry['kind'][]) {
  return {
    ok: true as const,
    snapshot: kinds.map(snapshotStem),
    totalBytes: kinds.length * 8,
  }
}

function objectUrlLease(kinds: readonly UvrStemSnapshotEntry['kind'][]) {
  return {
    assets: kinds.map((kind) => ({
      kind,
      url: `blob:${kind}`,
      sizeBytes: 8,
    })),
    release: vi.fn(),
  }
}

async function openSource(sessionId: string) {
  const port = createUvrPlayAlongSongPort(DRUM_PLAY_ALONG_POLICY)
  await port.initialize()
  const result = await port.openSession(sessionId, new AbortController().signal)
  if (!result.ok) throw new Error(`Expected ${sessionId} to open`)
  return result.lease
}

describe('Drum UVR play-along source', () => {
  beforeEach(() => {
    adapterReads.readUvrSessionRecords.mockReset()
    adapterReads.readUvrStemManifest.mockReset()
    adapterReads.readUvrStemSelectionWithinBudget.mockReset()
    adapterReads.openUvrStemLease.mockReset()
  })

  it('selects a complete partition without reading bytes, then hydrates only on load', async () => {
    const kinds = ['vocal', 'instrumental', 'drums'] as const
    const stemLease = objectUrlLease(kinds)
    adapterReads.readUvrSessionRecords.mockResolvedValue([
      sessionRecord('backbeat'),
    ])
    adapterReads.readUvrStemManifest.mockResolvedValue([
      'vocal',
      'instrumental',
      'drums',
      'bass',
      'guitar',
      'piano',
      'other',
    ])
    adapterReads.readUvrStemSelectionWithinBudget.mockResolvedValue(
      successfulSelection(kinds),
    )
    adapterReads.openUvrStemLease.mockResolvedValue(stemLease)

    const source = await openSource('backbeat')

    expect(adapterReads.readUvrStemSelectionWithinBudget).not.toHaveBeenCalled()
    expect(adapterReads.openUvrStemLease).not.toHaveBeenCalled()
    expect(source).toMatchObject({
      stemKinds: kinds,
      durationSeconds: 181.5,
      source: 'device',
      plannedMix: {
        kind: 'parts',
        audible: kinds,
        muted: [],
      },
    })

    const signal = new AbortController().signal
    const loaded = await source.load({ signal, encodedByteBudget: 128 })

    expect(adapterReads.readUvrStemSelectionWithinBudget).toHaveBeenCalledWith(
      'backbeat',
      kinds,
      expect.objectContaining({ budgetBytes: 128 }),
    )
    expect(adapterReads.openUvrStemLease).toHaveBeenCalledWith(
      'backbeat',
      kinds,
      expect.objectContaining({ snapshot: kinds.map(snapshotStem) }),
    )
    expect(loaded).toMatchObject({
      ok: true,
      lease: {
        defaultMix: { kind: 'parts', audible: kinds, muted: [] },
      },
    })

    source.release()
    expect(stemLease.release).toHaveBeenCalledOnce()
  })

  it('keeps an incomplete 6s partition on the honest two-stem source', async () => {
    adapterReads.readUvrSessionRecords.mockResolvedValue([
      sessionRecord('partial'),
    ])
    adapterReads.readUvrStemManifest.mockResolvedValue([
      'vocal',
      'instrumental',
      'drums',
      'bass',
      'guitar',
      'other',
    ])

    const source = await openSource('partial')

    expect(source).toMatchObject({
      stemKinds: ['vocal', 'instrumental'],
      durationSeconds: 181,
      plannedMix: {
        kind: 'mixed-instrumental',
        audible: ['vocal', 'instrumental'],
        muted: [],
      },
    })
    expect(adapterReads.readUvrStemSelectionWithinBudget).not.toHaveBeenCalled()
  })

  it('falls back to two stems when a required part disappears before explicit load', async () => {
    const completeKinds = ['vocal', 'instrumental', 'drums'] as const
    const partialKinds = ['vocal', 'drums'] as const
    const fallbackKinds = ['vocal', 'instrumental'] as const
    adapterReads.readUvrSessionRecords.mockResolvedValue([
      sessionRecord('raced'),
    ])
    adapterReads.readUvrStemManifest.mockResolvedValue([
      'vocal',
      'instrumental',
      'drums',
      'bass',
      'guitar',
      'piano',
      'other',
    ])
    adapterReads.readUvrStemSelectionWithinBudget
      .mockResolvedValueOnce(successfulSelection(partialKinds))
      .mockResolvedValueOnce(successfulSelection(fallbackKinds))
    adapterReads.openUvrStemLease.mockResolvedValue(
      objectUrlLease(fallbackKinds),
    )
    const source = await openSource('raced')

    const loaded = await source.load({
      signal: new AbortController().signal,
    })

    expect(
      adapterReads.readUvrStemSelectionWithinBudget,
    ).toHaveBeenNthCalledWith(
      1,
      'raced',
      completeKinds,
      expect.objectContaining({
        budgetBytes: defaultPlayAlongEncodedByteBudget(),
      }),
    )
    expect(
      adapterReads.readUvrStemSelectionWithinBudget,
    ).toHaveBeenNthCalledWith(
      2,
      'raced',
      fallbackKinds,
      expect.objectContaining({
        budgetBytes: defaultPlayAlongEncodedByteBudget(),
      }),
    )
    expect(loaded).toMatchObject({
      ok: true,
      lease: {
        stems: [{ kind: 'vocal' }, { kind: 'instrumental' }],
        defaultMix: { kind: 'mixed-instrumental' },
      },
    })
  })

  it('revalidates the complete partition at Play before hydrating its compact representation', async () => {
    const fullManifest = [
      'vocal',
      'instrumental',
      'drums',
      'bass',
      'guitar',
      'piano',
      'other',
    ] as const
    const fallbackKinds = ['vocal', 'instrumental'] as const
    adapterReads.readUvrSessionRecords.mockResolvedValue([
      sessionRecord('manifest-race'),
    ])
    adapterReads.readUvrStemManifest
      .mockResolvedValueOnce(fullManifest)
      .mockResolvedValueOnce(fullManifest.filter((kind) => kind !== 'piano'))
    adapterReads.readUvrStemSelectionWithinBudget.mockResolvedValue(
      successfulSelection(fallbackKinds),
    )
    adapterReads.openUvrStemLease.mockResolvedValue(
      objectUrlLease(fallbackKinds),
    )

    const source = await openSource('manifest-race')
    expect(source.plannedMix.kind).toBe('parts')

    const loaded = await source.load({
      signal: new AbortController().signal,
    })

    expect(adapterReads.readUvrStemSelectionWithinBudget).toHaveBeenCalledWith(
      'manifest-race',
      fallbackKinds,
      expect.any(Object),
    )
    expect(loaded).toMatchObject({
      ok: true,
      lease: { defaultMix: { kind: 'mixed-instrumental' } },
    })
  })

  it('reports the authoritative encoded ceiling before allocating object URLs', async () => {
    const kinds = ['vocal', 'instrumental'] as const
    adapterReads.readUvrSessionRecords.mockResolvedValue([
      sessionRecord('large'),
    ])
    adapterReads.readUvrStemManifest.mockResolvedValue(kinds)
    adapterReads.readUvrStemSelectionWithinBudget.mockResolvedValue({
      ok: false,
      requiredBytes: 72,
      budgetBytes: 64,
    })
    const source = await openSource('large')

    await expect(
      source.load({
        signal: new AbortController().signal,
        encodedByteBudget: 64,
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'encoded-budget',
      requiredBytes: 72,
      budgetBytes: 64,
    })
    expect(adapterReads.openUvrStemLease).not.toHaveBeenCalled()
  })

  it('releases partially minted URLs when explicit loading is cancelled', async () => {
    const kinds = ['vocal', 'instrumental'] as const
    const stemLease = objectUrlLease(kinds)
    let finishLease!: (value: typeof stemLease) => void
    const pendingLease = new Promise<typeof stemLease>((resolve) => {
      finishLease = resolve
    })
    adapterReads.readUvrSessionRecords.mockResolvedValue([
      sessionRecord('cancelled'),
    ])
    adapterReads.readUvrStemManifest.mockResolvedValue(kinds)
    adapterReads.readUvrStemSelectionWithinBudget.mockResolvedValue(
      successfulSelection(kinds),
    )
    adapterReads.openUvrStemLease.mockReturnValue(pendingLease)
    const source = await openSource('cancelled')
    const abort = new AbortController()
    const loading = source.load({ signal: abort.signal })

    await vi.waitFor(() =>
      expect(adapterReads.openUvrStemLease).toHaveBeenCalledOnce(),
    )
    finishLease(stemLease)
    abort.abort()

    await expect(loading).resolves.toEqual({ ok: false, code: 'aborted' })
    expect(stemLease.release).toHaveBeenCalledOnce()
  })
})
