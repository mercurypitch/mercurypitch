import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'

const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({
  getDb: async () => adapter,
}))

import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { CLOUD_ENTITIES } from '@/db/adapters/hybrid-adapter'
import type { ZenTakeRecord } from '@/db/entities'
import type { ZenTakeDraft } from '@/db/services/zen-take-service'
import { listZenTakes, MAX_ZEN_TAKES, MAX_ZEN_TRACE_POINTS, saveZenTake, } from '@/db/services/zen-take-service'
import { InMemoryAdapter } from './utils/in-memory-db'

if (
  typeof window !== 'undefined' &&
  (window.crypto === undefined ||
    typeof window.crypto.randomUUID !== 'function')
) {
  Object.defineProperty(window, 'crypto', {
    value: globalThis.crypto,
    configurable: true,
  })
}

function draft(completedAt: number, exerciseId = 'ng-five-tone'): ZenTakeDraft {
  return {
    takeNumber: completedAt + 1,
    completedAt,
    mode: 'exercise',
    exerciseId,
    exerciseVersion: 1,
    rootMidi: 57,
    durationSec: 8,
    points: [
      { timeSec: 1.23456, midi: 60.12345, clarity: 0.9876 },
      { timeSec: 2, midi: null },
    ],
    viewport: { minMidi: 48, maxMidi: 72 },
    score: {
      total: 91,
      pitch: 94,
      coverage: 89,
      steadiness: 88,
      averageCents: 5.4,
    },
  }
}

beforeEach(async () => {
  await adapter.destroy()
})

describe('Zen take persistence', () => {
  it('round-trips compact traces and returns newest takes first', async () => {
    const older = await saveZenTake(draft(100))
    const newer = await saveZenTake(draft(200))

    expect(older).not.toBeNull()
    expect(newer).not.toBeNull()
    const stored = await adapter
      .getRepository<ZenTakeRecord>('zenTakes')
      .findById(newer!.id)
    expect(JSON.parse(stored!.traceJson)).toEqual([
      [1.235, 60.123, 0.988],
      [2, null],
    ])

    const loaded = await listZenTakes()
    expect(loaded.map((take) => take.completedAt)).toEqual([200, 100])
    expect(loaded[0]).toMatchObject({
      exerciseId: 'ng-five-tone',
      exerciseVersion: 1,
      rootMidi: 57,
      score: { total: 91, averageCents: 5.4 },
      viewport: { minMidi: 48, maxMidi: 72 },
    })
    expect(loaded[0]!.points).toEqual([
      { timeSec: 1.235, midi: 60.123, clarity: 0.988 },
      { timeSec: 2, midi: null },
    ])
  })

  it('filters by exercise/version and applies the limit after decoding', async () => {
    await saveZenTake(draft(100, 'ng-five-tone'))
    await saveZenTake(draft(200, 'mam-arpeggio'))
    await saveZenTake(draft(300, 'ng-five-tone'))

    const loaded = await listZenTakes({
      exerciseId: 'ng-five-tone',
      exerciseVersion: 1,
      limit: 1,
    })
    expect(loaded).toHaveLength(1)
    expect(loaded[0]!.completedAt).toBe(300)
  })

  it('skips corrupt rows while retaining valid rows behind them', async () => {
    await saveZenTake(draft(100))
    await adapter.getRepository<ZenTakeRecord>('zenTakes').create({
      mode: 'exercise',
      takeNumber: 2,
      exerciseId: 'ng-five-tone',
      exerciseVersion: 1,
      completedAt: 200,
      durationSec: 8,
      traceVersion: 1,
      traceJson: '{not-json',
      viewportMinMidi: 48,
      viewportMaxMidi: 72,
    })

    const loaded = await listZenTakes({ limit: 1 })
    expect(loaded).toHaveLength(1)
    expect(loaded[0]!.completedAt).toBe(100)
  })

  it('prunes the oldest rows after the bounded history is exceeded', async () => {
    for (let index = 0; index < MAX_ZEN_TAKES + 5; index++) {
      expect(await saveZenTake(draft(index))).not.toBeNull()
    }

    const repo = adapter.getRepository<ZenTakeRecord>('zenTakes')
    expect(await repo.count()).toBe(MAX_ZEN_TAKES)
    const loaded = await listZenTakes()
    expect(loaded[0]!.completedAt).toBe(MAX_ZEN_TAKES + 4)
    expect(loaded[loaded.length - 1]!.completedAt).toBe(5)
  })

  it('downsamples oversized input while retaining its final point', async () => {
    const input = draft(100)
    input.points = Array.from(
      { length: MAX_ZEN_TRACE_POINTS * 2 },
      (_, index) => ({
        timeSec: index / 60,
        midi: 60 + index / 100_000,
      }),
    )

    const saved = await saveZenTake(input)
    expect(saved!.points).toHaveLength(MAX_ZEN_TRACE_POINTS)
    expect(saved!.points.at(-1)?.timeSec).toBeCloseTo(
      input.points.at(-1)!.timeSec,
      3,
    )
  })

  it('retains breath gaps while downsampling an oversized trace', async () => {
    const input = draft(100)
    input.points = Array.from(
      { length: MAX_ZEN_TRACE_POINTS * 2 },
      (_, index) => ({
        timeSec: index / 40,
        midi: index === 317 ? null : 60 + index / 100_000,
      }),
    )

    const saved = await saveZenTake(input)
    expect(saved!.points).toHaveLength(MAX_ZEN_TRACE_POINTS)
    expect(saved!.points).toContainEqual({
      timeSec: 317 / 40,
      midi: null,
    })
  })
})

describe('Zen take Dexie schema', () => {
  let dexie: DexieAdapter

  beforeEach(() => {
    dexie = new DexieAdapter()
  })

  afterEach(async () => {
    await dexie.destroy()
  })

  it('creates the v5 local zenTakes store', async () => {
    const created = await dexie
      .getRepository<ZenTakeRecord>('zenTakes')
      .create({
        mode: 'monitor',
        takeNumber: 1,
        completedAt: 100,
        durationSec: 8,
        traceVersion: 1,
        traceJson: '[]',
        viewportMinMidi: 48,
        viewportMaxMidi: 72,
      })
    expect(
      await dexie.getRepository<ZenTakeRecord>('zenTakes').findById(created.id),
    ).toMatchObject({ mode: 'monitor', traceVersion: 1 })
  })

  it('keeps zenTakes out of cloud routing', () => {
    expect(CLOUD_ENTITIES.has('zenTakes')).toBe(false)
  })
})
