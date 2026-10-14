// ============================================================
// Glide engine — jumps: steps, a register flip, and the tracker's slips
// ============================================================
//
// A jump is the voice moving 150 cents within 50 ms while the path moves
// under 50, and staying moved for a tenth of a second. A tracker's octave
// slip moves 1200 cents and comes back two frames later; it must never
// read as a jump, nor its return.

import { describe, expect, it } from 'vitest'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { JUMP_CONFIRM_SEC } from './glide-engine'
import { computeGlideResult } from './glide-metrics'
import type { GlidePath } from './glide-path'
import { ngSlideRoots, ngSlidesPath, segmentAt, targetAt } from './glide-path'
import type { GlideLevelId, GlidePreset } from './glide-presets'
import { NG_SLIDES_LEVELS } from './glide-presets'
import type { Voice } from './test-glides'
import { archAt, follow, framesOf, playGlide, typesOf } from './test-glides'

const LEVELS: readonly GlideLevelId[] = ['learning', 'singer', 'professional']

function ngRun(level: GlideLevelId): { path: GlidePath; preset: GlidePreset } {
  const preset = NG_SLIDES_LEVELS[level]
  return { path: ngSlidesPath(ngSlideRoots(48), preset), preset }
}

/**
 * Root, a third, the fifth on the way up; the fifth, the third, the root
 * on the way down: each a third of the glide, sudden steps between.
 */
const stepped =
  (path: GlidePath): Voice =>
  (t) => {
    const segment = segmentAt(path, t)
    if (segment === null || segment.kind === 'rest') return null
    const r = path.arches[segment.arch].rootMidi
    const q = (t - segment.start) / (segment.end - segment.start)
    const third = q < 1 / 3 ? 0 : q < 2 / 3 ? 1 : 2
    if (segment.phase === 'up') return r + [0, 4, 7][third]
    if (segment.phase === 'down') return r + [7, 4, 0][third]
    return targetAt(path, t)
  }

/** The register flip: on the way up the voice pops from 53 to 55. */
const FLIP_FROM = 53
const flipping =
  (path: GlidePath): Voice =>
  (t) => {
    const midi = targetAt(path, t)
    if (midi === null) return null
    const rising = segmentAt(path, t)?.phase === 'up'
    return rising && midi >= FLIP_FROM && midi < FLIP_FROM + 2
      ? FLIP_FROM + 2
      : midi
  }

/** The clean slide with the tracker an octave up for two frames, three times a slide. */
function slipping(path: GlidePath): PitchFrame[] {
  const slips = new Set<number>()
  for (const a of path.arches) {
    for (const t of [
      (a.start + a.topStart) / 2,
      (a.topStart + a.topEnd) / 2,
      (a.topEnd + a.end) / 2,
    ]) {
      const i = Math.round(t * 60)
      slips.add(i)
      slips.add(i + 1)
    }
  }
  return framesOf(path, follow(path)).map((frame, i) =>
    slips.has(i) ? { ...frame, f0: frame.f0 * 2 } : frame,
  )
}

describe('tickGlide, jumps: a stepped slide', () => {
  it.each(LEVELS)(
    'fires a %s jump at every step, from the note it left',
    (level) => {
      // Arrange
      const { path, preset } = ngRun(level)

      // Act
      const played = playGlide(framesOf(path, stepped(path)), path, preset)

      // Assert: four steps a slide, five slides
      const expected = ngSlideRoots(48).flatMap((r, arch) =>
        [
          [r, r + 4],
          [r + 4, r + 7],
          [r + 7, r + 4],
          [r + 4, r],
        ].map(([from, to]) => ({ arch, from, to })),
      )
      expect(
        played.state.jumps.map((j) => ({
          arch: j.arch,
          from: Math.round(j.fromMidi),
          to: Math.round(j.toMidi),
        })),
      ).toEqual(expected)
    },
  )

  it('fires each jump once, a tenth of a second after it, dated when it happened', () => {
    // Arrange
    const { path, preset } = ngRun('learning')

    // Act
    const played = playGlide(framesOf(path, stepped(path)), path, preset)

    // Assert
    const fired = played.events.filter((e) => e.event.type === 'jump')
    expect(fired).toHaveLength(20)
    fired.forEach((e, i) => {
      const jump = played.state.jumps[i]
      expect(e.event).toEqual({ type: 'jump', ...jump })
      expect(e.t - jump.t).toBeGreaterThanOrEqual(JUMP_CONFIRM_SEC - 1e-6)
      expect(e.t - jump.t).toBeLessThan(JUMP_CONFIRM_SEC + 1 / 60)
    })
  })
})

describe('tickGlide, jumps: a register flip', () => {
  it.each(LEVELS)(
    'finds the %s flip at the same note in every slide',
    (level) => {
      // Arrange
      const { path, preset } = ngRun(level)

      // Act
      const played = playGlide(framesOf(path, flipping(path)), path, preset)
      const result = computeGlideResult(played.state, path, preset)

      // Assert
      expect(
        played.state.jumps.map((j) => [j.arch, j.fromMidi, j.toMidi]),
      ).toEqual(
        // From the last frame under 53 (up to a frame's glide below it) to 55.
        [0, 1, 2, 3, 4].map((arch) => [
          arch,
          expect.closeTo(52.75, 0),
          expect.closeTo(55, 6),
        ]),
      )
      expect(result.jumps.map((j) => j.note)).toEqual([53, 53, 53, 53, 53])
      expect(result.flipNote).toBe(53)
    },
  )
})

describe('tickGlide, jumps: the tracker slips an octave for two frames', () => {
  it.each(LEVELS)('fires no %s jump, going or coming back', (level) => {
    // Arrange
    const { path, preset } = ngRun(level)

    // Act
    const played = playGlide(slipping(path), path, preset)

    // Assert
    expect(played.state.jumps).toEqual([])
    expect(typesOf(played)).not.toContain('jump')
  })

  it.each(['learning', 'singer'] as const)(
    'never leaves the %s path: the reading is held to a semitone',
    (level) => {
      // Arrange
      const { path, preset } = ngRun(level)

      // Act
      const played = playGlide(slipping(path), path, preset)

      // Assert: the clean slide's events exactly
      expect(
        typesOf(played).filter((t) => t === 'onPath' || t === 'offPath'),
      ).toEqual(Array<string>(5).fill('onPath'))
      const result = computeGlideResult(played.state, path, preset)
      expect(result.litShare).toBeGreaterThan(0.99)
    },
  )
})

describe('tickGlide, jumps: only while the path holds still', () => {
  /**
   * The voice sags 160 cents under the path over 0.3 s (never a jump),
   * waits, then catches up in 50 ms at `at`.
   */
  const catchUp =
    (path: GlidePath, at: number): Voice =>
    (t) => {
      const midi = targetAt(path, t)
      if (midi === null) return null
      const sag =
        t < at - 0.4 || t >= at + 0.05
          ? 0
          : t < at - 0.1
            ? (t - (at - 0.4)) / 0.3
            : t < at
              ? 1
              : 1 - (t - at) / 0.05
      return midi - 1.6 * sag
    }

  it('is no jump in the middle of a Pro glide, where the path moves 58 c in 50 ms', () => {
    // Arrange
    const { path, preset } = ngRun('professional')
    const arch = path.arches[0]
    const middle = (arch.start + arch.topStart) / 2

    // Act
    const played = playGlide(
      framesOf(path, catchUp(path, middle)),
      path,
      preset,
    )

    // Assert
    expect(played.state.jumps).toEqual([])
  })

  it('is a jump when the same catch-up happens on the flat top', () => {
    // Arrange: the sag starts on the way up, the catch-up on the top
    const { path, preset } = ngRun('professional')
    const arch = path.arches[0]
    const at = arch.topStart + 0.2
    const voice: Voice = (t) => {
      const inArch = archAt(path, t)?.index === 0
      const midi = targetAt(path, t)
      if (!inArch || midi === null || t < arch.topStart || t >= at + 0.05)
        return midi
      const sag =
        t < arch.topStart + 0.15
          ? (t - arch.topStart) / 0.15
          : t < at
            ? 1
            : 1 - (t - at) / 0.05
      return midi - 1.6 * sag
    }

    // Act
    const played = playGlide(framesOf(path, voice), path, preset)

    // Assert
    expect(played.state.jumps).toHaveLength(1)
    expect(played.state.jumps[0].arch).toBe(0)
  })
})
