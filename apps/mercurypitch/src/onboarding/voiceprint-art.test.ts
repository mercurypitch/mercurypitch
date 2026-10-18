// ============================================================
// The voiceprint's picture: one range, one print, inside its square
// ============================================================

import { describe, expect, it } from 'vitest'
import { MAX_RIDGES, MIN_RIDGES, PRINT_REACH, PRINT_SIZE, ridgeCount, voiceprintArt, } from './voiceprint-art'

/** Every point of a ridge's path, as [x, y]. */
function points(d: string): [number, number][] {
  return d
    .replace(/^M/u, '')
    .split(' L')
    .map((pair) => {
      const [x, y] = pair.split(' ').map(Number)
      return [x, y]
    })
}

describe('voiceprintArt', () => {
  it('draws one range the same print every time', () => {
    expect(voiceprintArt(40, 67)).toEqual(voiceprintArt(40, 67))
  })

  it('draws another range another print', () => {
    const a = voiceprintArt(40, 67)
    const b = voiceprintArt(41, 67)

    expect(b.ridges.map((r) => r.d)).not.toEqual(a.ridges.map((r) => r.d))
  })

  it('gives a wider range more ridges, between the fewest and the most', () => {
    expect(ridgeCount(0)).toBe(MIN_RIDGES)
    expect(ridgeCount(12)).toBe(12)
    expect(ridgeCount(60)).toBe(MAX_RIDGES)
    expect(voiceprintArt(40, 67).ridges).toHaveLength(ridgeCount(27))
  })

  it('keeps every point of the print within reach of its centre, at any range', () => {
    const centre = PRINT_SIZE / 2
    let farthest = 0
    for (let low = 30; low <= 70; low += 3) {
      for (const span of [0, 7, 19, 30, 48]) {
        for (const ridge of voiceprintArt(low, low + span).ridges) {
          for (const [x, y] of points(ridge.d)) {
            farthest = Math.max(farthest, Math.hypot(x - centre, y - centre))
          }
        }
      }
    }

    expect(farthest).toBeGreaterThan(PRINT_REACH * 0.8)
    expect(farthest).toBeLessThanOrEqual(PRINT_REACH)
  })

  it('leans the print no more than 16 degrees either way', () => {
    for (let low = 30; low <= 70; low += 1) {
      expect(Math.abs(voiceprintArt(low, low + 12).tilt)).toBeLessThanOrEqual(
        16,
      )
    }
  })

  it('brightens the inner ridges over the outer ones', () => {
    const { ridges } = voiceprintArt(40, 67)

    expect(ridges[0].opacity).toBe(1)
    expect(ridges.at(-1)?.opacity).toBeCloseTo(0.55, 2)
    for (let i = 1; i < ridges.length; i++) {
      expect(ridges[i].opacity).toBeLessThanOrEqual(ridges[i - 1].opacity)
    }
  })
})
