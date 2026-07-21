import { describe, expect, it } from 'vitest'
import type { GroupableGroup, GroupableSong, } from '@/features/karaoke-night/library-grouping'
import { groupLibrarySongs } from '@/features/karaoke-night/library-grouping'

// Songs arrive already sorted by createdAt desc; these helpers keep the tests
// declarative about ids/groups without repeating the object shape.
const song = (sessionId: string, groupId?: string): GroupableSong => ({
  sessionId,
  ...(groupId !== undefined ? { groupId } : {}),
})
const group = (
  id: string,
  name: string,
  sessionIds: string[],
): GroupableGroup => ({
  id,
  name,
  sessionIds,
})
const ids = (songs: GroupableSong[]) => songs.map((s) => s.sessionId)

describe('groupLibrarySongs (LIB-GROUP)', () => {
  it('LIB-GROUP-1: with no groups, everything is ungrouped in input order', () => {
    const songs = [song('a'), song('b'), song('c')]
    const out = groupLibrarySongs(songs, [])
    expect(out.groups).toEqual([])
    expect(ids(out.ungrouped)).toEqual(['a', 'b', 'c'])
  })

  it('LIB-GROUP-2: resolves a group to its member songs in curated order', () => {
    const songs = [song('a'), song('b'), song('c')]
    const out = groupLibrarySongs(songs, [group('g1', 'Ballads', ['c', 'a'])])
    expect(out.groups).toHaveLength(1)
    expect(out.groups[0]).toMatchObject({ id: 'g1', name: 'Ballads' })
    expect(ids(out.groups[0].songs)).toEqual(['c', 'a'])
    expect(ids(out.ungrouped)).toEqual(['b'])
  })

  it('LIB-GROUP-3: preserves group order and leaves loose songs ungrouped', () => {
    const songs = [song('a'), song('b'), song('c'), song('d')]
    const groups = [group('g2', 'Rock', ['b']), group('g1', 'Pop', ['d'])]
    const out = groupLibrarySongs(songs, groups)
    expect(out.groups.map((g) => g.id)).toEqual(['g2', 'g1'])
    expect(ids(out.ungrouped)).toEqual(['a', 'c'])
  })

  it('LIB-GROUP-4: folds in a drifted member (groupId set, not in sessionIds) in createdAt order', () => {
    // `b` carries groupId g1 but the curated sessionIds only lists `a`.
    const songs = [song('a'), song('b', 'g1'), song('c')]
    const out = groupLibrarySongs(songs, [group('g1', 'Set', ['a'])])
    expect(ids(out.groups[0].songs)).toEqual(['a', 'b'])
    expect(ids(out.ungrouped)).toEqual(['c'])
  })

  it('LIB-GROUP-5: drops empty groups and skips stale/deleted member ids', () => {
    const songs = [song('a')]
    const groups = [
      group('g1', 'Has A', ['a']),
      group('g2', 'Empty', []),
      group('g3', 'Only Deleted', ['gone']),
    ]
    const out = groupLibrarySongs(songs, groups)
    expect(out.groups.map((g) => g.id)).toEqual(['g1'])
    expect(out.ungrouped).toEqual([])
  })

  it('LIB-GROUP-6: assigns each song to at most one group (first group wins)', () => {
    const songs = [song('a'), song('b')]
    // `a` is listed by both groups; it must not appear twice.
    const groups = [
      group('g1', 'First', ['a', 'b']),
      group('g2', 'Second', ['a']),
    ]
    const out = groupLibrarySongs(songs, groups)
    expect(ids(out.groups[0].songs)).toEqual(['a', 'b'])
    // g2's only member was already claimed -> the group drops out.
    expect(out.groups.map((g) => g.id)).toEqual(['g1'])
    expect(out.ungrouped).toEqual([])
  })
})
