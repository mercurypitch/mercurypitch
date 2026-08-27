// ============================================================
// IndexedDB repository tests — durable snapshots and corruption boundaries
// ============================================================

import type { BesideCueStateV1 } from '@irchiinnuss/beside-cue-core'
import { activateCue, createCue, createInitialState, replaceCue, } from '@irchiinnuss/beside-cue-core'
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

  it('round-trips suggested and custom cue contexts in one snapshot', async () => {
    const repository = createRepository()
    const at = '2026-08-06T08:00:00.000Z'
    const suggested = activateCue(
      createCue(createInitialState(), {
        id: 'cue-suggested',
        pullText: 'Doom scrolling',
        bSideText: 'Play guitar',
        cueContextSuggestionId: 'anchor.scrolling.in-bed',
        cueContextText: 'When I get into bed with my phone.',
        at,
      }).state,
      'cue-suggested',
      at,
    )
    const state = replaceCue(suggested.state, {
      replacedCueId: suggested.cue.id,
      id: 'cue-custom',
      pullText: 'Automatic snacking',
      bSideText: 'Drink a glass of water',
      cueContextText: 'After lunch.',
      at: '2026-08-07T08:00:00.000Z',
    }).state

    await repository.saveState(state)
    const loaded = await repository.loadState()

    expect(loaded).toEqual(state)
    expect(loaded?.cues).toMatchObject([
      {
        id: 'cue-suggested',
        status: 'archived',
        cueContextSuggestionId: 'anchor.scrolling.in-bed',
        cueContextText: 'When I get into bed with my phone.',
      },
      {
        id: 'cue-custom',
        status: 'active',
        cueContextText: 'After lunch.',
      },
    ])
    expect(loaded?.cues[1]).not.toHaveProperty('cueContextSuggestionId')
  })

  it('loads a schema-v1 cue that predates optional context fields', async () => {
    const repository = createRepository()
    const at = '2026-08-06T08:00:00.000Z'
    const state = activateCue(
      createCue(createInitialState(), {
        id: 'cue-legacy',
        pullText: 'Doom scrolling',
        bSideText: 'Play guitar',
        at,
      }).state,
      'cue-legacy',
      at,
    ).state

    await repository.saveState(state)
    const loaded = await repository.loadState()

    expect(loaded).toEqual(state)
    expect(loaded?.schema).toEqual({
      schemaVersion: 1,
      completedMigrationVersion: 1,
    })
    expect(loaded?.cues[0]).not.toHaveProperty('cueContextSuggestionId')
    expect(loaded?.cues[0]).not.toHaveProperty('cueContextText')
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
