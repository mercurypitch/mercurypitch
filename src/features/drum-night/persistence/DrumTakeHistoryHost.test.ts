// Drum Take History host tests — musician-facing beat range labels.

import { describe, expect, it } from 'vitest'
import { countedRangeLabel } from './DrumTakeHistoryHost'

describe('countedRangeLabel', () => {
  it('counts the whole pocket as beats one through eight', () => {
    expect(countedRangeLabel(0, 8)).toBe('Beats 1–8')
  })

  it('counts an exclusive loop end as its last covered beat', () => {
    expect(countedRangeLabel(4, 8)).toBe('Beats 5–8')
  })

  it('never renders a range that ends before it starts', () => {
    expect(countedRangeLabel(4, 4)).toBe('Beats 5–5')
    expect(countedRangeLabel(2, Number.NaN)).toBe('Beats 3–3')
  })
})
