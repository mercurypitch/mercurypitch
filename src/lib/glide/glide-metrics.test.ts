// ============================================================
// Glide metrics — the result read off whole runs
// ============================================================

import { describe, expect, it } from 'vitest'
import { runGlide } from './glide-engine'
import type { GlideNote } from './glide-metrics'
import { computeGlideResult, flipNoteOf } from './glide-metrics'
import { ngSlideRoots, ngSlidesPath } from './glide-path'
import type { GlideLevelId } from './glide-presets'
import { NG_SLIDES_LEVELS } from './glide-presets'
import { follow, framesOf, silentWhen } from './test-glides'

function ngResult(
  level: GlideLevelId,
  voiceOf: (
    path: ReturnType<typeof ngSlidesPath>,
  ) => Parameters<typeof framesOf>[1],
) {
  const preset = NG_SLIDES_LEVELS[level]
  const path = ngSlidesPath(ngSlideRoots(48), preset)
  const state = runGlide(framesOf(path, voiceOf(path)), path, preset)
  return computeGlideResult(state, path, preset)
}

describe('computeGlideResult', () => {
  it('reads a clean Beginner run: all lit, nothing to name', () => {
    // Act
    const result = ngResult('learning', (path) => follow(path))

    // Assert
    expect(result.litShare).toBeGreaterThan(0.99)
    expect(result.archesLit).toBe(5)
    expect(result.jumps).toEqual([])
    expect(result.breaks).toEqual([])
    expect(result.flipNote).toBeNull()
    expect(result.meanLagMs).toBeCloseTo(0, 6)
    expect(result.topsReached).toBeNull()
  })

  it.each([
    ['learning', 250],
    ['singer', 200],
    ['professional', 120],
  ] as const)(
    'reads a voice 250 ms behind as %s ms late, no more than the level allows',
    (level, expected) => {
      // Act
      const result = ngResult(level, (path) => follow(path, 0.25))

      // Assert
      expect(result.meanLagMs).not.toBeNull()
      expect(Math.abs((result.meanLagMs ?? 0) - expected)).toBeLessThan(5)
    },
  )

  it('weighs the lit share by time: one arch at 6/7 of five', () => {
    // Arrange: half a second of slide 2's 3.5 s silent
    const result = ngResult('learning', (path) => {
      const from = path.arches[1].topEnd + 0.3
      return silentWhen(follow(path), (t) => t > from && t < from + 0.5)
    })

    // Assert
    expect(result.arches[1].coverage).toBeCloseTo(3 / 3.5, 2)
    expect(result.litShare).toBeCloseTo((4 + 3 / 3.5) / 5, 2)
    expect(result.archesLit).toBe(5)
    expect(result.breaks).toHaveLength(1)
  })

  it('counts the Pro tops, which a clean run reaches every time', () => {
    // Act
    const result = ngResult('professional', (path) => follow(path))

    // Assert
    expect(result.topsReached).toBe(5)
    expect(result.arches.every((a) => a.topReached === true)).toBe(true)
  })
})

describe('flipNoteOf', () => {
  const at = (note: number, arch: number): GlideNote => ({
    note,
    arch,
    t: arch,
  })

  it('names a note the voice jumps at in two arches or more', () => {
    expect(flipNoteOf([at(53, 0), at(57, 0), at(53, 2)])).toBe(53)
  })

  it('names nothing when a note repeats only inside one arch', () => {
    expect(flipNoteOf([at(53, 0), at(53, 0), at(57, 1)])).toBeNull()
  })

  it('takes the note in the most arches, then the lower', () => {
    expect(
      flipNoteOf([at(57, 0), at(57, 1), at(57, 2), at(53, 0), at(53, 1)]),
    ).toBe(57)
    expect(flipNoteOf([at(57, 0), at(57, 1), at(53, 2), at(53, 3)])).toBe(53)
  })
})
