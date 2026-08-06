// ============================================================
// IndexedDB repository tests — durable snapshots and corruption boundaries
// ============================================================

import type { BesideCueStateV1 } from '@irchiinnuss/beside-cue-core'
import { createInitialState } from '@irchiinnuss/beside-cue-core'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { createIndexedDbBesideCueRepository } from './indexed-db-repository'

function createRepository() {
  return createIndexedDbBesideCueRepository({
    databaseFactory: new IDBFactory(),
    databaseName: 'beside-cue-test',
  })
}

function stateWithHaptics(hapticsEnabled: boolean): BesideCueStateV1 {
  const state = createInitialState()
  return {
    ...state,
    settings: {
      ...state.settings,
      quietHours: { ...state.settings.quietHours },
      hapticsEnabled,
    },
  }
}

describe('IndexedDB Beside Cue repository', () => {
  it('saves, loads, and clears one atomic snapshot', async () => {
    const repository = createRepository()
    const state = stateWithHaptics(true)

    await expect(repository.loadState()).resolves.toBeNull()
    await repository.saveState(state)

    const loaded = await repository.loadState()
    expect(loaded).toEqual(state)
    expect(loaded).not.toBe(state)

    await repository.clear()
    await expect(repository.loadState()).resolves.toBeNull()
  })

  it('loads only after queued writes settle in call order', async () => {
    const repository = createRepository()
    const first = stateWithHaptics(true)
    const second = stateWithHaptics(false)

    const firstWrite = repository.saveState(first)
    const secondWrite = repository.saveState(second)
    const loaded = repository.loadState()

    await expect(loaded).resolves.toEqual(second)
    await expect(Promise.all([firstWrite, secondWrite])).resolves.toEqual([
      undefined,
      undefined,
    ])
  })

  it('rejects a corrupt persisted snapshot at the hydration boundary', async () => {
    const repository = createRepository()
    const valid = createInitialState()
    const corrupt = {
      ...valid,
      settings: { ...valid.settings, hapticsEnabled: 'yes' },
    } as unknown as BesideCueStateV1

    await repository.saveState(corrupt)

    await expect(repository.loadState()).rejects.toMatchObject({
      name: 'CueDomainError',
      code: 'invalid_state_shape',
    })
  })
})
