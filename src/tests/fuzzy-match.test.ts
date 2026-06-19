// ============================================================
// fuzzy-match tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { fuzzyMatch, fuzzyScore } from '@/lib/fuzzy-match'

describe('fuzzyMatch', () => {
  it('matches everything on an empty query', () => {
    expect(fuzzyMatch('', 'anything')).toBe(true)
    expect(fuzzyMatch('   ', 'anything')).toBe(true)
  })

  it('matches a case-insensitive substring', () => {
    expect(fuzzyMatch('bright', 'Green Day - Mr. Brightside')).toBe(true)
    expect(fuzzyMatch('GREEN', 'Green Day - Mr. Brightside')).toBe(true)
  })

  it('matches an in-order subsequence across separators', () => {
    expect(fuzzyMatch('gd mr', 'Green Day - Mr. Brightside')).toBe(true)
    expect(fuzzyMatch('gdbright', 'Green Day - Mr. Brightside')).toBe(true)
  })

  it('does not match out-of-order or absent characters', () => {
    expect(fuzzyMatch('zzz', 'Green Day - Mr. Brightside')).toBe(false)
    expect(fuzzyMatch('brightgreen', 'Green Day - Mr. Brightside')).toBe(false)
  })

  it('ranks prefix/substring above scattered subsequence', () => {
    const prefix = fuzzyScore('green', 'Green Day')
    const sub = fuzzyScore('gd', 'Green Day')
    expect(prefix).toBeGreaterThan(sub)
    expect(sub).toBeGreaterThan(0)
  })
})
