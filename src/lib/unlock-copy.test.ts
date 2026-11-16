// ============================================================
// Unlock copy: the words an unlock is announced with
// ============================================================

import { describe, expect, it } from 'vitest'
import type { UnlockItem } from './unlock-copy'
import { unlockHeading, unlockNames, unlockSummary } from './unlock-copy'

const STEADY: UnlockItem = { kind: 'badge', name: 'Steady Hold' }
const FIRST_NOTE: UnlockItem = { kind: 'achievement', name: 'First Note' }
const DRILL: UnlockItem = { kind: 'achievement', name: 'Drill Sergeant' }

describe('a heading over the names', () => {
  it('says what one unlock is, leaving its name to the line under it', () => {
    expect(unlockHeading([STEADY])).toBe('New badge')
    expect(unlockHeading([FIRST_NOTE])).toBe('New achievement')
  })

  it('counts a set, as its summary does', () => {
    expect(unlockHeading([FIRST_NOTE, DRILL])).toBe('2 new achievements')
    expect(unlockHeading([STEADY, FIRST_NOTE])).toBe(
      unlockSummary([STEADY, FIRST_NOTE]),
    )
  })

  it('has its names in the order they were earned', () => {
    expect(unlockNames([FIRST_NOTE, DRILL])).toBe('First Note, Drill Sergeant')
  })
})
