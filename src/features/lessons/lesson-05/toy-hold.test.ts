// ============================================================
// Lesson 5 hold demo tests — its readouts come from the checkpoint's reader
// ============================================================

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import * as reader from '@/features/lessons/kit/hold-take'
import { bandAt, holdValueText, readDemo } from './toy-hold'

describe("the demo's readouts (WEB-SPEC, Toys 5)", () => {
  it('reads the line as a take would: settled before a second, in the band for most of the ten', () => {
    // Act
    const { whole } = readDemo(reader)

    // Assert
    expect(whole.kind).toBe('read')
    expect(whole.settled).not.toBeNull()
    expect(whole.settled ?? 9).toBeGreaterThan(0.4)
    expect(whole.settled ?? 9).toBeLessThan(1)
    expect(whole.inBand).toBeGreaterThan(9)
    expect(whole.inBand).toBeLessThan(10)
    expect(whole.line).toBe(
      `In the band for ${reader.fmtSeconds(whole.inBand)} of the 10 seconds. It settled after about ${reader.fmtSeconds(whole.settled ?? 0)} seconds.`,
    )
    expect(whole.octaveLine).toBeNull()
  })

  it('counts the time in the band up as the line plays, never past the whole', () => {
    // Act
    const { whole, upTo } = readDemo(reader)

    // Assert
    expect(upTo).toHaveLength(101)
    expect(upTo[0]).toBe(0)
    for (let k = 1; k < upTo.length; k++)
      expect(upTo[k]).toBeGreaterThanOrEqual(upTo[k - 1])
    expect(upTo[100]).toBe(whole.inBand)
  })

  it('says where the line is on the scrub bar, in words', () => {
    expect(holdValueText(0)).toBe('0.0 seconds of 10: below the band')
    expect(holdValueText(1.2)).toBe('1.2 seconds of 10: in the band')
    expect(bandAt(9.5)).toBe('in the band')
  })
})
