// ============================================================
// The onboarding, measured: the names its steps are counted under
// ============================================================

import { describe, expect, it } from 'vitest'
import { ONBOARDING_FUNNEL_EVENTS } from '@/lib/funnel-event-catalog'
import { KEEP_CHOICE_EVENT, lineBandEvent } from './onboarding-measure'

describe('a sung line, counted by its band', () => {
  it("follows Merc's bands: all ten, seven to nine, four to six, none to three", () => {
    expect(lineBandEvent(10, 10)).toBe('native_onboarding_line_sung_all')
    expect(lineBandEvent(9, 10)).toBe('native_onboarding_line_sung_7_9')
    expect(lineBandEvent(7, 10)).toBe('native_onboarding_line_sung_7_9')
    expect(lineBandEvent(6, 10)).toBe('native_onboarding_line_sung_4_6')
    expect(lineBandEvent(4, 10)).toBe('native_onboarding_line_sung_4_6')
    expect(lineBandEvent(3, 10)).toBe('native_onboarding_line_sung_0_3')
    expect(lineBandEvent(0, 10)).toBe('native_onboarding_line_sung_0_3')
  })

  it('counts a line with no notes in it at the bottom band', () => {
    expect(lineBandEvent(0, 0)).toBe('native_onboarding_line_sung_0_3')
  })
})

describe('the names', () => {
  it('are all ones the ingest accepts', () => {
    const names = [
      ...Object.values(KEEP_CHOICE_EVENT),
      ...[10, 8, 5, 1].map((hit) => lineBandEvent(hit, 10)),
    ]
    expect(ONBOARDING_FUNNEL_EVENTS).toEqual(expect.arrayContaining(names))
  })
})
