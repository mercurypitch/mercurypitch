import { describe, expect, it } from 'vitest'
import type { LyricsVersion } from '@/lib/lyrics-versions'
import { findVersion, nextActiveAfterDelete, removeVersion, sortVersions, synthesizeVersions, upsertVersion, } from '@/lib/lyrics-versions'

const v = (
  kind: LyricsVersion['kind'],
  text: string = kind,
  wordTimings?: Record<number, number[]>,
): LyricsVersion => ({ kind, text, wordTimings, createdAt: 1 })

describe('upsertVersion', () => {
  it('adds a new kind', () => {
    const out = upsertVersion([v('imported')], v('auto-sync'))
    expect(out.map((x) => x.kind)).toEqual(['imported', 'auto-sync'])
  })

  it('replaces the same kind in place (no duplicates)', () => {
    const out = upsertVersion([v('auto-sync', 'old')], v('auto-sync', 'new'))
    expect(out).toHaveLength(1)
    expect(out[0].text).toBe('new')
  })

  it('keeps a stable display order regardless of insertion order', () => {
    let list: LyricsVersion[] = []
    list = upsertVersion(list, v('lrc-gen'))
    list = upsertVersion(list, v('imported'))
    list = upsertVersion(list, v('edited'))
    expect(list.map((x) => x.kind)).toEqual(['imported', 'edited', 'lrc-gen'])
  })
})

describe('removeVersion / nextActiveAfterDelete', () => {
  const list = [v('imported'), v('edited'), v('auto-sync')]

  it('removes by kind', () => {
    expect(removeVersion(list, 'edited').map((x) => x.kind)).toEqual([
      'imported',
      'auto-sync',
    ])
  })

  it('picks the front-most remaining version as next active', () => {
    expect(nextActiveAfterDelete(list, 'imported')).toBe('edited')
    expect(nextActiveAfterDelete(list, 'edited')).toBe('imported')
  })

  it('returns undefined when the last version is deleted', () => {
    expect(nextActiveAfterDelete([v('edited')], 'edited')).toBeUndefined()
  })
})

describe('findVersion', () => {
  it('finds by kind, undefined-safe', () => {
    const list = [v('imported')]
    expect(findVersion(list, 'imported')?.kind).toBe('imported')
    expect(findVersion(list, 'auto-sync')).toBeUndefined()
    expect(findVersion(list, undefined)).toBeUndefined()
  })
})

describe('synthesizeVersions (migration)', () => {
  it('passes through an already-versioned record and resolves active', () => {
    const versions = [v('imported'), v('auto-sync')]
    const out = synthesizeVersions(
      { versions, activeVersionKind: 'auto-sync' },
      99,
    )
    expect(out.activeVersionKind).toBe('auto-sync')
    expect(out.versions.map((x) => x.kind)).toEqual(['imported', 'auto-sync'])
  })

  it('falls back to the first version when the active kind is gone', () => {
    const out = synthesizeVersions(
      { versions: [v('edited')], activeVersionKind: 'auto-sync' },
      99,
    )
    expect(out.activeVersionKind).toBe('edited')
  })

  it('legacy: plain text with no timings → a single Original version', () => {
    const out = synthesizeVersions({ text: '[00:01.00]hi' }, 5)
    expect(out.versions).toHaveLength(1)
    expect(out.versions[0].kind).toBe('imported')
    expect(out.activeVersionKind).toBe('imported')
  })

  it('legacy: text WITH timings → an Edited active version', () => {
    const out = synthesizeVersions(
      { text: 'sung', wordTimings: { 0: [1, 2] } },
      5,
    )
    expect(out.activeVersionKind).toBe('edited')
    expect(out.versions[0].wordTimings).toEqual({ 0: [1, 2] })
  })

  it('legacy: a distinct originalText becomes its own Original version', () => {
    const out = synthesizeVersions(
      { text: 'edited', wordTimings: { 0: [1] }, originalText: 'original' },
      5,
    )
    expect(out.versions.map((x) => x.kind)).toEqual(['imported', 'edited'])
    expect(findVersion(out.versions, 'imported')?.text).toBe('original')
  })

  it('legacy: originalText equal to text is not duplicated', () => {
    const out = synthesizeVersions(
      { text: 'same', wordTimings: { 0: [1] }, originalText: 'same' },
      5,
    )
    expect(out.versions).toHaveLength(1)
  })

  it('empty record → no versions', () => {
    expect(synthesizeVersions({}, 5)).toEqual({
      versions: [],
      activeVersionKind: undefined,
    })
  })
})

describe('sortVersions', () => {
  it('does not mutate its input', () => {
    const list = [v('lrc-gen'), v('imported')]
    const out = sortVersions(list)
    expect(list.map((x) => x.kind)).toEqual(['lrc-gen', 'imported'])
    expect(out.map((x) => x.kind)).toEqual(['imported', 'lrc-gen'])
  })
})
