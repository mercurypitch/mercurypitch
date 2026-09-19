import { describe, expect, it } from 'vitest'
import { withLrcTimingMetadata } from '@/lib/lrc-timing-metadata'
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

  it('bare text: word ends and splits come out of its own timing tag', () => {
    // A demo song is seeded straight into storage as text, so it never
    // passes through the upload that reads this tag. Synthesis is the one
    // place every such record does pass through.
    const ends: number[] = []
    ends[2] = 4.25
    const extension = {
      wordEndTimings: { 1: ends },
      wordSweepTimings: { 1: { 2: [{ time: 4.25, progress: 1 }] } },
    }
    const text = withLrcTimingMetadata(
      '[00:01.00] One [00:01.50] two\n[00:03.00] Three [00:03.40] four [00:03.90] five',
      extension,
    )
    const out = synthesizeVersions({ text }, 5)

    expect(out.versions).toHaveLength(1)
    expect(out.versions[0].kind).toBe('imported')
    expect(out.versions[0].text).toBe(text)
    expect(out.versions[0].wordEndTimings).toEqual(extension.wordEndTimings)
    expect(out.versions[0].wordSweepTimings).toEqual(extension.wordSweepTimings)
  })

  it('bare text: an unreadable tag costs the ends, never the lyrics', () => {
    const out = synthesizeVersions(
      { text: '[x-mp-timing:not-base64]\n[00:01.00]Still here' },
      5,
    )
    expect(out.versions).toHaveLength(1)
    expect(out.versions[0].wordEndTimings).toBeUndefined()
    expect(out.versions[0].wordSweepTimings).toBeUndefined()
  })

  it('a versioned record is trusted as stored, tag or no tag', () => {
    // The singer may have cleared an end mark since; the tag in the text is
    // older than their versions and must not resurrect it.
    const text = withLrcTimingMetadata('[00:01.00] One', {
      wordEndTimings: { 0: [1.8] },
      wordSweepTimings: {},
    })
    const out = synthesizeVersions(
      { text, versions: [{ kind: 'imported', text, createdAt: 1 }] },
      5,
    )
    expect(out.versions[0].wordEndTimings).toBeUndefined()
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
