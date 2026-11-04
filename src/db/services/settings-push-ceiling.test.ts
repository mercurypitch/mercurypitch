// ============================================================
// Settings sync — a value too large to push is not overwritten by a pull
// ============================================================
//
// The push skips any value over 8 KB, so a synced key that grows past that
// stops reaching the account. Annotations are the one that does: they are
// content, not a preference, and a few months of them is well over 8 KB. The
// account then keeps the last copy that fitted, and every pull (each launch,
// each sign-in) used to apply that copy over the singer's newer, larger one.
//
// These run the real service and the real annotation store over a fake
// account, as settings-precedence.test.ts does.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Annotation } from '@/types'

type Row = { id: string; userId: string; key: string; value: string }
const state = vi.hoisted(() => ({ rows: [] as Row[] }))
vi.mock('@/lib/defaults', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  API_BASE_URL: 'https://api.test',
}))
vi.mock('@/db/services/auth-service', () => ({
  hasValidToken: () => true,
  hasUpgradedAccount: () => true,
  storedTokenProvider: () => 'password',
  isRegisteredProvider: (provider: string | null | undefined) =>
    provider != null && provider !== 'anonymous',
  currentAccountId: () => 'a',
}))
vi.mock('@/db/services/user-service', () => ({
  getUserId: () => 'a',
  getDeviceId: () => 'device',
  authVersion: () => 0,
  getAuthToken: () => 'a:0',
}))
vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: () => ({
      findAll: async (options?: { where?: { key?: string } }) =>
        state.rows
          .filter(
            (row) =>
              options?.where?.key === undefined ||
              row.key === options.where.key,
          )
          .map((row) => ({ ...row })),
      update: async (id: string, patch: { value: string }) => {
        const row = state.rows.find((candidate) => candidate.id === id)
        if (row !== undefined) row.value = patch.value
      },
      create: async (input: { key: string; value: string }) => {
        const row = { ...input, userId: 'a', id: `row-${state.rows.length}` }
        state.rows.push(row)
        return row
      },
    }),
  }),
}))

const ANNOTATIONS = 'pitchperfect_annotations'

/** `count` annotations, about 120 bytes each once serialised. */
function annotations(count: number): Annotation[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `ann_${i}`,
    type: 'instant' as const,
    time: i * 1.5,
    label: `Breath before the high note, take ${i}`,
    source: 'manual' as const,
    createdAt: 1_700_000_000_000 + i,
  }))
}

let dispose: (() => void) | undefined

/** A page load: the annotation store reads this device's copy, then the sync pulls. */
async function boot() {
  vi.resetModules()
  const store = await import('@/stores/annotation-store')
  const sync = await import('./settings-service')
  createRoot((cleanup) => {
    dispose = cleanup
    sync.initSettingsSync()
  })
  await vi.advanceTimersByTimeAsync(0)
  return store
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  state.rows = []
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(async () => {
  dispose?.()
  dispose = undefined
  await vi.advanceTimersByTimeAsync(0)
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('a synced value over the push ceiling', () => {
  it('keeps the annotations this device holds when the account has an older, smaller copy', async () => {
    const mine = JSON.stringify(annotations(150))
    expect(mine.length).toBeGreaterThan(8 * 1024)
    localStorage.setItem(ANNOTATIONS, mine)
    state.rows.push({
      id: 'a-annotations',
      userId: 'a',
      key: ANNOTATIONS,
      value: JSON.stringify(annotations(20)),
    })

    const store = await boot()

    expect(localStorage.getItem(ANNOTATIONS)).toBe(mine)
    expect(store.annotations()).toHaveLength(150)
  })

  it("still takes the account's copy over a local value small enough to have been sent", async () => {
    localStorage.setItem(ANNOTATIONS, JSON.stringify(annotations(2)))
    const theirs = JSON.stringify(annotations(20))
    state.rows.push({
      id: 'a-annotations',
      userId: 'a',
      key: ANNOTATIONS,
      value: theirs,
    })

    const store = await boot()

    expect(localStorage.getItem(ANNOTATIONS)).toBe(theirs)
    expect(store.annotations()).toHaveLength(20)
  })
})
