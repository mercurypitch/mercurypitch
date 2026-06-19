// ============================================================
// Karaoke Playlist Store — buildQueue unit tests
// ============================================================

import { describe, expect, it } from 'vitest'
import type { KaraokePlaylistRecord } from '@/db'
import { buildQueue } from '@/stores/karaoke-playlist-store'

// Fixtures: two groups and a handful of sessions.
const GROUPS: Record<string, { name: string; sessionIds: string[] }> = {
  g1: { name: 'Rock Night', sessionIds: ['s1', 's2', 's3'] },
  g2: { name: 'Ballads', sessionIds: ['s4'] },
}
const TITLES: Record<string, string> = {
  s1: 'Song One',
  s2: 'Song Two',
  s3: 'Song Three',
  s4: 'Song Four',
  s5: 'Solo Track',
}

const deps = {
  groupSessionIds: (id: string) => GROUPS[id]?.sessionIds ?? [],
  groupName: (id: string) => GROUPS[id]?.name,
  sessionTitle: (id: string) => TITLES[id],
}

function playlist(
  partial: Partial<KaraokePlaylistRecord>,
): KaraokePlaylistRecord {
  return {
    id: 'pl1',
    name: 'Test',
    items: [],
    createdAt: '',
    updatedAt: '',
    ...partial,
  } as KaraokePlaylistRecord
}

describe('buildQueue', () => {
  it('returns an empty queue for an empty playlist', () => {
    expect(buildQueue(playlist({ items: [] }), deps)).toEqual([])
  })

  it('QUEUE-2: contributes one entry per standalone session item', () => {
    const q = buildQueue(
      playlist({
        items: [
          { id: 'i1', kind: 'session', refId: 's5', singerName: 'Alice' },
        ],
      }),
      deps,
    )
    expect(q).toEqual([
      { sessionId: 's5', songTitle: 'Solo Track', singerName: 'Alice' },
    ])
  })

  it('QUEUE-1: expands a group item into its member sessions in order', () => {
    const q = buildQueue(
      playlist({
        items: [{ id: 'i1', kind: 'group', refId: 'g1', singerName: 'Bob' }],
      }),
      deps,
    )
    expect(q.map((e) => e.sessionId)).toEqual(['s1', 's2', 's3'])
    expect(q.every((e) => e.groupName === 'Rock Night')).toBe(true)
    expect(q.every((e) => e.singerName === 'Bob')).toBe(true)
  })

  it('QUEUE-3: preserves item order across mixed session + group items', () => {
    const q = buildQueue(
      playlist({
        items: [
          { id: 'i1', kind: 'session', refId: 's5' },
          { id: 'i2', kind: 'group', refId: 'g2' },
          { id: 'i3', kind: 'session', refId: 's1' },
        ],
      }),
      deps,
    )
    expect(q.map((e) => e.sessionId)).toEqual(['s5', 's4', 's1'])
  })

  it('QUEUE-4: falls back to "Unknown" when a session title is missing', () => {
    const q = buildQueue(
      playlist({
        items: [{ id: 'i1', kind: 'session', refId: 'missing' }],
      }),
      deps,
    )
    expect(q[0].songTitle).toBe('Unknown')
  })

  it('QUEUE-5: keeps the same sessions when shuffling within a group', () => {
    const q = buildQueue(
      playlist({
        items: [
          {
            id: 'i1',
            kind: 'group',
            refId: 'g1',
            shuffleWithinGroup: true,
          },
        ],
      }),
      deps,
    )
    expect([...q.map((e) => e.sessionId)].sort()).toEqual(['s1', 's2', 's3'])
    expect(q).toHaveLength(3)
  })

  it('QUEUE-6: keeps the same songs when shuffling the top-level order', () => {
    const q = buildQueue(
      playlist({
        shuffleOrder: true,
        items: [
          { id: 'i1', kind: 'session', refId: 's5' },
          { id: 'i2', kind: 'session', refId: 's1' },
          { id: 'i3', kind: 'session', refId: 's4' },
        ],
      }),
      deps,
    )
    expect([...q.map((e) => e.sessionId)].sort()).toEqual(['s1', 's4', 's5'])
    expect(q).toHaveLength(3)
  })

  describe('round-robin', () => {
    it('QUEUE-7: interleaves one song per group per round', () => {
      // g1 = [s1,s2,s3], g2 = [s4]. Round 1: s1, s4. Round 2: s2. Round 3: s3.
      const q = buildQueue(
        playlist({
          playMode: 'roundRobin',
          items: [
            { id: 'i1', kind: 'group', refId: 'g1' },
            { id: 'i2', kind: 'group', refId: 'g2' },
          ],
        }),
        deps,
      )
      expect(q.map((e) => e.sessionId)).toEqual(['s1', 's4', 's2', 's3'])
    })

    it('QUEUE-8: treats a standalone session as a one-song group', () => {
      // g2 = [s4], session s5. Round 1: s4, s5 (s4 group exhausted after).
      const q = buildQueue(
        playlist({
          playMode: 'roundRobin',
          items: [
            { id: 'i1', kind: 'group', refId: 'g2' },
            { id: 'i2', kind: 'session', refId: 's5' },
          ],
        }),
        deps,
      )
      expect(q.map((e) => e.sessionId)).toEqual(['s4', 's5'])
    })

    it('QUEUE-9: plays every song exactly once across all groups', () => {
      const q = buildQueue(
        playlist({
          playMode: 'roundRobin',
          shuffleOrder: true,
          items: [
            { id: 'i1', kind: 'group', refId: 'g1', shuffleWithinGroup: true },
            { id: 'i2', kind: 'group', refId: 'g2' },
          ],
        }),
        deps,
      )
      expect([...q.map((e) => e.sessionId)].sort()).toEqual([
        's1',
        's2',
        's3',
        's4',
      ])
      expect(q).toHaveLength(4)
    })
  })
})
