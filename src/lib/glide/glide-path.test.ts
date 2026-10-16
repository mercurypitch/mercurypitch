// ============================================================
// Glide path — the arches, targetAt, and the bridge's measured rim
// ============================================================
//
// The geometry case copies its numbers from ng-geometry (N0, 14 Oct 2026,
// fitted to the storyboard's first screen) rather than reading them from
// disk: the arch the room draws is y = deck - h * g(|x - x_c| / a), and
// one fifth (7 semitones) is h. The path must give the same pitch at every
// x the room draws, with x linear in time inside a slide.

import { describe, expect, it } from 'vitest'
import type { GlidePath, TimedTarget } from './glide-path'
import { judgedArchAt, lipRollPath, ngSlideRoots, ngSlidesPath, pathFromTargets, restToneDue, riddenSegmentAt, segmentAt, smoothstep, targetAt, } from './glide-path'
import type { GlideLevelId } from './glide-presets'
import { LIP_ROLL_LEVELS, NG_SLIDES_LEVELS } from './glide-presets'

const LEVELS: readonly GlideLevelId[] = ['learning', 'singer', 'professional']

/** ng-geometry.json, "arch": screen 1's rim, in screen widths (W). */
const GEOMETRY = {
  h: 0.3932,
  a: 0.3957,
  f: 1 / 7,
  deckY: 1.3932,
  xc: 0.7002,
  semitoneW: 0.0562,
}

/** The measured arch's g(u): flat top, then the eased fall. */
function g(u: number): number {
  if (u <= GEOMETRY.f) return 1
  if (u >= 1) return 0
  return 1 - smoothstep((u - GEOMETRY.f) / (1 - GEOMETRY.f))
}

/** The rim's height at x, W (y grows down). */
const rimY = (x: number): number =>
  GEOMETRY.deckY - GEOMETRY.h * g(Math.abs(x - GEOMETRY.xc) / GEOMETRY.a)

describe('ngSlidesPath', () => {
  it('lays five slides a semitone apart, each up a fifth, with breaths between', () => {
    // Arrange
    const preset = NG_SLIDES_LEVELS.learning

    // Act
    const path = ngSlidesPath(ngSlideRoots(48), preset)

    // Assert
    expect(path.arches.map((a) => [a.rootMidi, a.topMidi])).toEqual([
      [48, 55],
      [49, 56],
      [50, 57],
      [51, 58],
      [52, 59],
    ])
    expect(path.segments.map((s) => s.phase).slice(0, 6)).toEqual([
      'up',
      'top',
      'down',
      'landing',
      'breath',
      'up',
    ])
    // 5 x (1.5 + 0.5 + 1.5 + 0.5) + 4 x (1.0 + 1.6): the pause, the breath
    expect(path.duration).toBeCloseTo(30.4, 9)
    expect(path.arches[1].start).toBeCloseTo(6.6, 9)
    expect(path.arches[1].end).toBeCloseTo(10.1, 9)
    // One rest between slides, from the landing's end to the next slide.
    const rest = path.segments[4]
    expect([rest.kind, rest.arch, rest.fromMidi]).toEqual(['rest', 1, 49])
    expect(rest.start).toBeCloseTo(path.arches[0].landingEnd, 9)
    expect(rest.end - rest.start).toBeCloseTo(2.6, 9)
  })

  it.each(LEVELS)('runs %s at the design table timing', (level) => {
    // Arrange
    const preset = NG_SLIDES_LEVELS[level]
    const slide = preset.upSec + preset.topSec + preset.downSec
    const rest = preset.pauseSec + preset.breathSec
    const expected = 5 * (slide + preset.landingSec) + 4 * rest

    // Act
    const path = ngSlidesPath(ngSlideRoots(50), preset)

    // Assert
    expect(path.duration).toBeCloseTo(expected, 9)
    for (const arch of path.arches) {
      expect(arch.end - arch.start).toBeCloseTo(slide, 9)
      expect(arch.topEnd - arch.topStart).toBeCloseTo(preset.topSec, 9)
    }
  })

  it('reads the root, the top and the root again at the arch turns', () => {
    // Arrange
    const path = ngSlidesPath(ngSlideRoots(48), NG_SLIDES_LEVELS.learning)
    const arch = path.arches[0]

    // Act + Assert
    expect(targetAt(path, arch.start)).toBe(48)
    expect(targetAt(path, (arch.start + arch.topStart) / 2)).toBeCloseTo(
      51.5,
      9,
    )
    expect(targetAt(path, arch.topStart)).toBe(55)
    expect(targetAt(path, (arch.topStart + arch.topEnd) / 2)).toBe(55)
    expect(targetAt(path, arch.end)).toBe(48)
    expect(targetAt(path, arch.landingEnd - 0.01)).toBe(48)
  })

  it('has no target in a breath, before the path or after it', () => {
    // Arrange
    const path = ngSlidesPath(ngSlideRoots(48), NG_SLIDES_LEVELS.singer)
    const breath = path.segments.find((s) => s.phase === 'breath')

    // Act + Assert
    expect(breath).toBeDefined()
    expect(
      targetAt(path, ((breath?.start ?? 0) + (breath?.end ?? 0)) / 2),
    ).toBeNull()
    expect(targetAt(path, -0.01)).toBeNull()
    expect(targetAt(path, path.duration + 0.01)).toBeNull()
  })

  it('says which arch and phase a time belongs to; only up, top and down are judged', () => {
    // Arrange
    const path = ngSlidesPath(ngSlideRoots(48), NG_SLIDES_LEVELS.learning)
    const second = path.arches[1]

    // Act
    const inBreath = segmentAt(path, second.start - 0.1)
    const atStart = segmentAt(path, second.start)
    const inLanding = segmentAt(path, second.end + 0.1)

    // Assert
    expect([inBreath?.phase, inBreath?.arch, inBreath?.toMidi]).toEqual([
      'breath',
      1,
      49,
    ])
    expect([atStart?.phase, atStart?.arch]).toEqual(['up', 1])
    expect([inLanding?.phase, inLanding?.arch]).toEqual(['landing', 1])
    expect(judgedArchAt(path, second.start - 0.1)).toBe(-1)
    expect(judgedArchAt(path, second.topStart)).toBe(1)
    expect(judgedArchAt(path, second.end)).toBe(1)
    expect(judgedArchAt(path, second.end + 0.1)).toBe(-1)
  })
})

describe('the arch against the measured bridge', () => {
  it('keeps the copied geometry self-consistent: a fifth is h, a semitone 0.0562 W', () => {
    expect(GEOMETRY.h / 7).toBeCloseTo(GEOMETRY.semitoneW, 4)
  })

  it.each(LEVELS)(
    'matches ng-geometry within 1 cent at every x across every %s slide',
    (level) => {
      // Arrange
      const preset = NG_SLIDES_LEVELS[level]
      const path = ngSlidesPath(ngSlideRoots(45), preset)
      const span = 2 * GEOMETRY.a
      const left = GEOMETRY.xc - GEOMETRY.a
      const samples = 1600
      let worst = 0

      // Act: x linear in time inside each slide (ng-geometry, glide_mapping)
      for (const arch of path.arches) {
        const slide = arch.end - arch.start
        for (let i = 0; i <= samples; i++) {
          const x = left + (span * i) / samples
          const t = arch.start + ((x - left) / span) * slide
          const drawnCents = ((GEOMETRY.deckY - rimY(x)) / GEOMETRY.h) * 700
          const target = targetAt(path, t)
          const pathCents =
            target === null ? NaN : (target - arch.rootMidi) * 100
          worst = Math.max(worst, Math.abs(pathCents - drawnCents))
        }
      }

      // Assert
      expect(worst).toBeLessThan(1)
    },
  )
})

describe('lipRollPath', () => {
  it.each(LEVELS)('rolls three %s waves up an octave and back', (level) => {
    // Arrange
    const preset = LIP_ROLL_LEVELS[level]

    // Act
    const path = lipRollPath([43, 45, 47], 12, preset)

    // Assert
    expect(path.arches.map((a) => [a.rootMidi, a.topMidi])).toEqual([
      [43, 55],
      [45, 57],
      [47, 59],
    ])
    const wave = preset.upSec + preset.topSec + preset.downSec
    expect(path.duration).toBeCloseTo(
      3 * (wave + preset.landingSec) + 2 * (preset.pauseSec + preset.breathSec),
      9,
    )
    const first = path.arches[0]
    expect(targetAt(path, first.start + preset.upSec / 2)).toBeCloseTo(49, 9)
    expect(targetAt(path, first.topStart)).toBe(55)
  })
})

/** The web warm-up's siren (sirenTargets(0, 12, 'Ooo', 8) at 60 BPM, root A3). */
const SIREN: TimedTarget[] = [
  { startSec: 0, endSec: 4, startMidi: 57, endMidi: 69 },
  { startSec: 4, endSec: 8, startMidi: 69, endMidi: 57 },
]

/** The web warm-up's lip trill (melodyTargets([0, 7, 0], ..., 6, 0.25)). */
const TRILL: TimedTarget[] = [
  { startSec: 0, endSec: 1.75, startMidi: 57, endMidi: 57 },
  { startSec: 2, endSec: 3.75, startMidi: 64, endMidi: 64 },
  { startSec: 4, endSec: 5.75, startMidi: 57, endMidi: 57 },
]

/** targetMidiAt's linear glide (src/features/zen/zen-model.ts). */
function linearAt(targets: readonly TimedTarget[], t: number): number | null {
  const target = targets.find((c) => t >= c.startSec && t <= c.endSec)
  if (target === undefined) return null
  const p = (t - target.startSec) / (target.endSec - target.startSec)
  return target.startMidi + (target.endMidi - target.startMidi) * p
}

describe('pathFromTargets', () => {
  it('takes the web siren as it is: one arch, linear like targetMidiAt', () => {
    // Act
    const path: GlidePath = pathFromTargets(SIREN)

    // Assert
    expect(path.arches).toHaveLength(1)
    expect(path.segments.map((s) => [s.phase, s.ease])).toEqual([
      ['up', 'linear'],
      ['down', 'linear'],
    ])
    expect([path.arches[0].rootMidi, path.arches[0].topMidi]).toEqual([57, 69])
    for (let t = 0; t <= 8; t += 0.05) {
      expect(targetAt(path, t)).toBeCloseTo(linearAt(SIREN, t) ?? NaN, 9)
    }
  })

  it('takes the web lip trill as three one-note arches with breaths between', () => {
    // Act
    const path = pathFromTargets(TRILL)

    // Assert
    expect(path.arches.map((a) => [a.start, a.end, a.rootMidi])).toEqual([
      [0, 1.75, 57],
      [2, 3.75, 64],
      [4, 5.75, 57],
    ])
    expect(path.segments.map((s) => s.phase)).toEqual([
      'landing',
      'breath',
      'landing',
      'breath',
      'landing',
    ])
    expect(targetAt(path, 1.9)).toBeNull()
    expect(targetAt(path, 2.5)).toBe(64)
  })
})

describe('riddenSegmentAt', () => {
  it.each(LEVELS)(
    "is the singer's turn on a %s arch: its up, top and down, not the count-in, its landing or the rest",
    (level) => {
      // Arrange
      const preset = LIP_ROLL_LEVELS[level]
      const path = lipRollPath([48, 50, 52], 12, preset)
      const [first, second] = path.arches
      const phaseAt = (t: number) => riddenSegmentAt(path, t)?.phase ?? null

      // Act + Assert
      expect(phaseAt(-0.5)).toBeNull()
      expect(phaseAt(first.start)).toBe('up')
      expect(phaseAt(first.topStart)).toBe('top')
      expect(phaseAt(first.end - 0.01)).toBe('down')
      // The arch's last instant is its landing's, though the engine still
      // judges it (judgedArchAt): the room shows the mic's side.
      expect(phaseAt(first.end)).toBeNull()
      expect(judgedArchAt(path, first.end)).toBe(0)
      expect(phaseAt(first.landingEnd + preset.pauseSec / 2)).toBeNull()
      expect(phaseAt(second.start - 0.01)).toBeNull()
      expect(riddenSegmentAt(path, second.start)?.arch).toBe(1)
    },
  )
})

describe('restToneDue', () => {
  it("plays each rest's root once, after the rest's pause", () => {
    // Arrange
    const preset = LIP_ROLL_LEVELS.singer
    const path = lipRollPath([48, 50, 52], 12, preset)
    const played = new Set<number>()
    const [first, second] = path.arches
    const due = (t: number) => restToneDue(path, preset, t, played)

    // Act + Assert: nothing in a wave, its landing, or the pause.
    expect(due(first.start + 1)).toBeNull()
    expect(due(first.end + 0.1)).toBeNull()
    expect(due(first.landingEnd + 0.01)).toBeNull()
    expect(due(first.landingEnd + preset.pauseSec - 0.01)).toBeNull()
    // Then the next wave's root, once.
    expect(due(first.landingEnd + preset.pauseSec)).toBe(1)
    expect(due(first.landingEnd + preset.pauseSec + 0.1)).toBeNull()
    expect(due(second.landingEnd + preset.pauseSec + 0.02)).toBe(2)
    expect([...played]).toEqual([1, 2])
  })

  it('plays nothing at a level that plays no root', () => {
    // Arrange
    const preset = NG_SLIDES_LEVELS.professional
    const path = ngSlidesPath(ngSlideRoots(48), preset)

    // Act + Assert
    for (let t = 0; t < path.duration; t += 0.05) {
      expect(restToneDue(path, preset, t, new Set())).toBeNull()
    }
  })
})
