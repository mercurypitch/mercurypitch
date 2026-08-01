// ── ICE recovery policy tests ─────────────────────────────────────────
// A connection that fails stays failed unless ICE is restarted, which is
// how a jam went quiet with both sides still believing they were in the
// room. These pin who restarts and when it gives up.

import { describe, expect, it } from 'vitest'
import { decideIceRestart, MAX_ICE_RETRIES } from '@/lib/jam/ice-recovery'

describe('decideIceRestart', () => {
  it('lets exactly one side of a pair restart', () => {
    // Both restarting costs a rollback and an extra round trip every time,
    // and on a mesh that multiplies by the number of pairs.
    const a = decideIceRestart('aaa', 'zzz', 0)
    const b = decideIceRestart('zzz', 'aaa', 0)
    expect([a.restart, b.restart].filter(Boolean)).toHaveLength(1)
  })

  it('makes the larger id the one that acts', () => {
    // Same split the glare handling uses -- one rule, not two.
    expect(decideIceRestart('zzz', 'aaa', 0).restart).toBe(true)
    expect(decideIceRestart('aaa', 'zzz', 0)).toEqual({
      restart: false,
      why: 'polite',
    })
  })

  it('gives up after a bounded number of attempts', () => {
    expect(decideIceRestart('zzz', 'aaa', MAX_ICE_RETRIES - 1).restart).toBe(
      true,
    )
    expect(decideIceRestart('zzz', 'aaa', MAX_ICE_RETRIES)).toEqual({
      restart: false,
      why: 'exhausted',
    })
    expect(decideIceRestart('zzz', 'aaa', 99).restart).toBe(false)
  })

  it('does nothing before our own peer id is known', () => {
    // Guessing the role would make both sides impolite, which is exactly
    // the case the split exists to avoid.
    expect(decideIceRestart(null, 'aaa', 0)).toEqual({
      restart: false,
      why: 'unknown-self',
    })
    expect(decideIceRestart('', 'aaa', 0)).toEqual({
      restart: false,
      why: 'unknown-self',
    })
  })

  it('never restarts against itself', () => {
    expect(decideIceRestart('same', 'same', 0).restart).toBe(false)
  })
})
