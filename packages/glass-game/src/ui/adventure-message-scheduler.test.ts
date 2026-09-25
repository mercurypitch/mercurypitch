// ============================================================
// Adventure message scheduling tests — two live rows replace overlapping HUD text.
// ============================================================

import { describe, expect, it } from 'vitest'
import { scheduleAdventureMessageKinds } from './adventure-message-scheduler'

describe('adventure message scheduler', () => {
  it('gives active narration and a precise notice the two available rows', () => {
    expect(
      scheduleAdventureMessageKinds({
        narration: true,
        notice: true,
        guidance: true,
      }),
    ).toEqual(['narration', 'notice'])
  })

  it('reveals live guidance only after a transient row finishes', () => {
    expect(
      scheduleAdventureMessageKinds({
        narration: false,
        notice: true,
        guidance: true,
      }),
    ).toEqual(['notice', 'guidance'])
  })

  it('does not replay guidance that became irrelevant while waiting', () => {
    expect(
      scheduleAdventureMessageKinds({
        narration: false,
        notice: true,
        guidance: false,
      }),
    ).toEqual(['notice'])
  })
})
