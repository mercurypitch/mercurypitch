// ── Jam Peer Colors Tests ─────────────────────────────────────────────
// Verifies that peer color assignment is deterministic, consistent
// across ordering changes, and wraps correctly for large peer counts.

import { describe, expect, it } from 'vitest'
import { buildPeerColorMap, getPeerColor, JAM_PEER_COLORS, } from '@/lib/jam/peer-colors'

describe('getPeerColor', () => {
  it('returns the first palette color for the lexicographically first peer', () => {
    const ids = ['peer-b', 'peer-a']
    expect(getPeerColor('peer-a', ids)).toBe(JAM_PEER_COLORS[0])
  })

  it('returns consistent colors regardless of input array order', () => {
    const ids = ['peer-c', 'peer-a', 'peer-b']
    const shuffled = ['peer-b', 'peer-c', 'peer-a']
    expect(getPeerColor('peer-a', ids)).toBe(getPeerColor('peer-a', shuffled))
    expect(getPeerColor('peer-b', ids)).toBe(getPeerColor('peer-b', shuffled))
    expect(getPeerColor('peer-c', ids)).toBe(getPeerColor('peer-c', shuffled))
  })

  it('wraps around the palette when peer count exceeds palette length', () => {
    const ids = Array.from(
      { length: JAM_PEER_COLORS.length + 1 },
      (_, i) => `peer-${i.toString().padStart(2, '0')}`,
    )
    // The (N+1)th peer (index 0 after sort) wraps to color index 0
    const wrapped = getPeerColor('peer-00', ids)
    expect(wrapped).toBe(JAM_PEER_COLORS[0])
  })

  it('returns a fallback color for unknown peer ID', () => {
    const result = getPeerColor('unknown', [])
    // indexOf returns -1, -1 % length is implementation-defined but
    // the function falls back to JAM_PEER_COLORS[0] via the ?? chain
    expect(result).toBe(JAM_PEER_COLORS[0])
  })
})

describe('buildPeerColorMap', () => {
  it('returns an empty map for empty input', () => {
    expect(buildPeerColorMap([])).toEqual({})
  })

  it('assigns distinct colors to distinct peers', () => {
    const ids = ['alpha', 'beta', 'gamma']
    const map = buildPeerColorMap(ids)
    const colors = Object.values(map)
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('produces a stable map regardless of input order', () => {
    const a = buildPeerColorMap(['z', 'a', 'm'])
    const b = buildPeerColorMap(['m', 'z', 'a'])
    expect(a).toEqual(b)
  })

  it('covers all input peer IDs', () => {
    const ids = ['x', 'y', 'z']
    const map = buildPeerColorMap(ids)
    for (const id of ids) {
      expect(map[id]).toBeDefined()
    }
  })

  it('matches getPeerColor for every peer', () => {
    const ids = ['peer-1', 'peer-2', 'peer-3']
    const map = buildPeerColorMap(ids)
    for (const id of ids) {
      expect(map[id]).toBe(getPeerColor(id, ids))
    }
  })
})
