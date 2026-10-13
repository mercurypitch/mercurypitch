// Community melody reconciliation keeps uncertain legacy copies and distinct publications.

import { describe, expect, it } from 'vitest'
import type { MelodyItem } from '@/types'
import { mergeMelodyCards, mergeSessionCards, removalMessage, } from './community-share-merge'

function melody(id: string, userId?: string) {
  const items: MelodyItem[] = [
    {
      id: 1,
      note: { midi: 60, name: 'C', octave: 4, freq: 261.63 },
      startBeat: 0,
      duration: 1,
    },
  ]
  return {
    id,
    userId,
    name: 'Melody',
    author: 'Singer',
    date: 100,
    items,
    bpm: undefined as number | undefined,
    key: undefined as string | undefined,
    scale: undefined as string | undefined,
  }
}

const ids = (rows: { id: string }[]) => rows.map((row) => row.id)

describe('mergeMelodyCards', () => {
  it('groups only the display of one exact own match and preserves all input records', () => {
    const board = [
      { ...melody('canonical', 'owner'), date: 999, tags: ['current'] },
    ]
    const local = [
      { ...melody('legacy'), bpm: 87, key: 'E', scale: 'minor', tags: ['old'] },
    ]
    const before = JSON.stringify({ board, local })
    const merged = mergeMelodyCards(board, local, 'owner')
    expect(merged).toEqual([
      {
        ...board[0],
        bpm: 87,
        key: 'E',
        scale: 'minor',
        shareFingerprint: undefined,
        retainedLocalCopy: true,
      },
    ])
    expect(JSON.stringify({ board, local })).toBe(before)
    expect(mergeMelodyCards([], local, 'owner')).toEqual(local)
  })

  it('ignores editor IDs and object key order but retains all musical content in matching', () => {
    const board = melody('canonical', 'owner')
    const local = melody('legacy')
    local.items = [
      {
        duration: 1,
        startBeat: 0,
        note: { freq: 261.63, octave: 4, name: 'C', midi: 60 },
        id: 52,
      },
    ]
    expect(ids(mergeMelodyCards([board], [local], 'owner'))).toEqual([
      'canonical',
    ])
    const changes: Partial<MelodyItem>[] = [
      { duration: 2 },
      { startBeat: 1 },
      { velocity: 0.5 },
      { lyricText: 'la' },
      { isRest: true },
      { effectType: 'vibrato' },
      { note: { midi: 62, name: 'D', octave: 4, freq: 293.66 } },
    ]
    for (const change of changes) {
      const different = { ...local, items: [{ ...local.items[0], ...change }] }
      expect(ids(mergeMelodyCards([board], [different], 'owner'))).toEqual([
        'canonical',
        'legacy',
      ])
    }
  })

  it('keeps foreign owners separate even when the name, author and notes match', () => {
    expect(
      ids(
        mergeMelodyCards(
          [melody('foreign', 'other')],
          [melody('local')],
          'owner',
        ),
      ),
    ).toEqual(['foreign', 'local'])
    expect(
      ids(
        mergeMelodyCards(
          [melody('mine', 'owner')],
          [melody('foreign-local', 'other')],
          'owner',
        ),
      ),
    ).toEqual(['mine', 'foreign-local'])
    expect(
      ids(
        mergeMelodyCards(
          [melody('mine', 'owner')],
          [melody('my-local', 'owner')],
          'owner',
        ),
      ),
    ).toEqual(['mine'])
  })

  it('preserves intentionally separate identical server publications and ambiguous local candidates', () => {
    expect(
      ids(
        mergeMelodyCards(
          [melody('first', 'owner'), melody('second', 'owner')],
          [melody('legacy')],
          'owner',
        ),
      ),
    ).toEqual(['first', 'second', 'legacy'])
    expect(
      ids(
        mergeMelodyCards(
          [melody('canonical', 'owner')],
          [melody('first-local'), melody('second-local')],
          'owner',
        ),
      ),
    ).toEqual(['canonical', 'first-local', 'second-local'])
  })

  it('does not group different names or authors based on identical notes alone', () => {
    const local = melody('local')
    for (const change of [
      { name: 'Other title' },
      { author: 'Other singer' },
    ]) {
      expect(
        ids(
          mergeMelodyCards(
            [melody('canonical', 'owner')],
            [{ ...local, ...change }],
            'owner',
          ),
        ),
      ).toEqual(['canonical', 'local'])
    }
  })

  it('uses canonical metadata only for the same owner, with server settings taking precedence', () => {
    const board = {
      ...melody('canonical', 'owner'),
      name: 'New title',
      bpm: 140,
    }
    const local = { ...melody('canonical', 'owner'), bpm: 87, key: 'E' }
    expect(mergeMelodyCards([board], [local], 'owner')).toEqual([
      { ...board, key: 'E', shareFingerprint: undefined },
    ])
    expect(
      mergeMelodyCards([board], [{ ...local, userId: 'other' }], 'owner'),
    ).toEqual([board])
    expect(
      mergeMelodyCards([board], [{ ...local, userId: undefined }], 'owner'),
    ).toEqual([board])
  })
})

describe('mergeSessionCards', () => {
  const result = (id: string, userId?: string, sourceSessionId?: string) => ({
    id,
    userId,
    sourceSessionId,
    name: 'Same result',
    results: [80],
    date: 100,
  })

  it('leaves historical results distinct without guessing from matching scores, titles or times', () => {
    const local = result('old-local')
    const board = result('canonical', 'owner')
    expect(mergeSessionCards([board], [local], 'owner')).toEqual([board, local])
    expect(
      mergeSessionCards([{ ...board, sourceSessionId: '' }], [local], 'owner'),
    ).toHaveLength(2)
  })

  it('groups a unique stable source ID for the same owner without mutating local history', () => {
    const local = result('local', 'owner', 'source-run')
    const board = {
      ...result('canonical', 'owner', 'source-run'),
      name: 'Published title',
      results: [91],
    }
    expect(mergeSessionCards([board], [local], 'owner')).toEqual([
      { ...board, retainedLocalCopy: true },
    ])
    expect(local).toEqual(result('local', 'owner', 'source-run'))
    expect(mergeSessionCards([], [local], 'owner')).toEqual([local])
    expect(mergeSessionCards([board], [local], 'other')).toEqual([board, local])
  })

  it('keeps distinct server publications and ambiguous or foreign local sources', () => {
    const board = result('canonical', 'owner', 'source-run')
    const local = result('local', 'owner', 'source-run')
    expect(
      ids(
        mergeSessionCards(
          [board, { ...board, id: 'second' }],
          [local],
          'owner',
        ),
      ),
    ).toEqual(['canonical', 'second', 'local'])
    expect(
      ids(
        mergeSessionCards(
          [board],
          [local, { ...local, id: 'other-local' }],
          'owner',
        ),
      ),
    ).toEqual(['canonical', 'local', 'other-local'])
    expect(
      mergeSessionCards([board], [{ ...local, userId: 'other' }], 'owner'),
    ).toHaveLength(2)
    expect(
      mergeSessionCards([board], [{ ...local, userId: undefined }], 'owner'),
    ).toHaveLength(2)
  })

  it('explains that removing local results cannot revoke already copied links', () => {
    const message = removalMessage({
      kind: 'session',
      name: 'Local result',
      published: false,
    })
    expect(message).toContain('This only removes the browser copy')
    expect(message).toContain('Existing links still work.')
    expect(
      removalMessage({
        kind: 'session',
        name: 'Public result',
        published: true,
      }),
    ).not.toContain('Existing links still work.')
  })
})
