// ============================================================
// noteWasSung — the unsung note is 'off' with exactly 0 cents
// ============================================================

import { describe, expect, it } from 'vitest'
import { centsToRating } from '@/lib/practice-engine'
import { noteWasSung } from './note-sung'

describe('noteWasSung', () => {
  it('reads a note the engine heard no pitch for as unsung', () => {
    // finalizeNoteResult writes `avgCents ?? 0` and `centsToRating(null)`.
    expect(noteWasSung({ rating: centsToRating(null), avgCents: 0 })).toBe(
      false,
    )
  })

  it('reads a note sung dead on as sung: 0 cents rates perfect', () => {
    expect(noteWasSung({ rating: centsToRating(0), avgCents: 0 })).toBe(true)
  })

  it('reads a note sung far off as sung, though it rates off', () => {
    expect(noteWasSung({ rating: centsToRating(80), avgCents: 80 })).toBe(true)
  })
})
