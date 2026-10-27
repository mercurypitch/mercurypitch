import { describe, expect, it } from 'vitest'
import { TRAIL_REACH_CENTS } from '@/components/room-kit/voice-trail'
import { bandHalfHeight, layoutStage } from './first-note-layout'
import { LINE_SHARES } from './first-note-songs'

describe("First note's stage", () => {
  it("puts the note's line at the round's own height", () => {
    const stage = layoutStage(390, 844, 0.4, 0.9)
    expect(stage.lineY).toBeCloseTo(337.6)
    expect(stage.trail.lineY).toBe(stage.lineY)
  })

  it('keeps the trail clear of the head and the dock on a short phone', () => {
    for (const share of [LINE_SHARES.low, LINE_SHARES.high]) {
      const stage = layoutStage(360, 640, share, 0.9)
      // The chip and the song sit in the top 120 px; the mic in the bottom 150.
      expect(stage.lineY - stage.trail.reach).toBeGreaterThan(100)
      expect(stage.lineY + stage.trail.reach).toBeLessThan(640 - 150)
    }
  })

  it('stands Merc on the boards at the right, clear of the mic in the middle', () => {
    const stage = layoutStage(390, 844, 0.43, 0.9)
    expect(stage.merc.left).toBeGreaterThan(390 * 0.6)
    expect(stage.merc.left + stage.merc.size).toBeLessThanOrEqual(390)
  })

  it('draws the band as wide as the level hears', () => {
    const stage = layoutStage(390, 844, 0.43, 0.9)
    expect(bandHalfHeight(TRAIL_REACH_CENTS, stage)).toBeCloseTo(
      stage.trail.reach,
    )
    expect(bandHalfHeight(35, stage)).toBeCloseTo(
      (35 / TRAIL_REACH_CENTS) * stage.trail.reach,
    )
  })
})
