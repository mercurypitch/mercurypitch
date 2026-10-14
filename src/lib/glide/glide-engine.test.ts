// ============================================================
// Glide engine — Ng slides on synthetic voices: lit, trailing, breaks, tops
// ============================================================
//
// Every voice is built from the path (test-glides.ts), 60 frames a second,
// so "trailing by 250 ms" is the path read 250 ms late and the expected
// numbers follow from the design's levels: at Pro the lag allowance is
// 120 ms, so a voice 250 ms behind sits up to about 150 cents off the
// moving middle of each glide and only its flat parts stay on the path.

import { describe, expect, it } from 'vitest'
import { archCoverage, createGlideState, tickGlide } from './glide-engine'
import { computeGlideResult } from './glide-metrics'
import type { GlidePath } from './glide-path'
import { ngSlideRoots, ngSlidesPath, targetAt } from './glide-path'
import type { GlideLevelId, GlidePreset } from './glide-presets'
import { NG_SLIDES_LEVELS } from './glide-presets'
import type { Voice } from './test-glides'
import { archAt, follow, framesOf, playGlide, silentWhen, typesOf, } from './test-glides'

const LEVELS: readonly GlideLevelId[] = ['learning', 'singer', 'professional']

function ngRun(level: GlideLevelId): { path: GlidePath; preset: GlidePreset } {
  const preset = NG_SLIDES_LEVELS[level]
  return { path: ngSlidesPath(ngSlideRoots(48), preset), preset }
}

const play = (path: GlidePath, preset: GlidePreset, voice: Voice) =>
  playGlide(framesOf(path, voice), path, preset)

const coverages = (path: GlidePath, played: ReturnType<typeof play>) =>
  path.arches.map((a) => archCoverage(played.state, path, a.index))

/** A clean run's events: on the path at each slide, the top at Pro, the end. */
function cleanTypes(level: GlideLevelId): string[] {
  const slide =
    level === 'professional'
      ? ['onPath', 'top', 'archEnd']
      : ['onPath', 'archEnd']
  return [...Array.from({ length: 5 }, () => slide).flat(), 'end']
}

describe('tickGlide, Ng slides: a clean slide', () => {
  it.each(LEVELS)(
    'lights every %s slide and fires each event once',
    (level) => {
      // Arrange
      const { path, preset } = ngRun(level)

      // Act
      const played = play(path, preset, follow(path))

      // Assert
      expect(typesOf(played)).toEqual(cleanTypes(level))
      for (const coverage of coverages(path, played)) {
        expect(coverage).toBeGreaterThan(0.99)
      }
      const ends = played.events.filter((e) => e.event.type === 'archEnd')
      expect(
        ends.map((e) => e.event.type === 'archEnd' && e.event.lit),
      ).toEqual([true, true, true, true, true])
      expect(played.state.jumps).toEqual([])
      expect(played.state.breaks).toEqual([])
    },
  )

  it('fires each arch end on the frame that reaches the end of its down glide', () => {
    // Arrange
    const { path, preset } = ngRun('singer')

    // Act
    const played = play(path, preset, follow(path))

    // Assert
    const ends = played.events.filter((e) => e.event.type === 'archEnd')
    ends.forEach((end, i) => {
      expect(end.t).toBeGreaterThanOrEqual(path.arches[i].end - 1e-6)
      expect(end.t).toBeLessThan(path.arches[i].end + 1 / 60)
    })
  })

  it('does nothing once the run has ended', () => {
    // Arrange
    const { path, preset } = ngRun('learning')
    const played = play(path, preset, follow(path))
    const late = { t: path.duration + 0.5, f0: 220, conf: 0.9, rms: 0.6 }

    // Act
    tickGlide(played.state, late, path, preset)

    // Assert
    expect(played.state.ended).toBe(true)
    expect(played.state.events).toEqual([])
  })

  it('updates the one state in place and keeps its events array', () => {
    // Arrange
    const { path, preset } = ngRun('learning')
    const state = createGlideState(path)
    const events = state.events
    const frames = framesOf(path, follow(path))

    // Act
    const returned = frames.map((frame) =>
      tickGlide(state, frame, path, preset),
    )

    // Assert
    expect(returned.every((r) => r === state)).toBe(true)
    expect(state.events).toBe(events)
  })
})

describe('tickGlide, Ng slides: trailing the line by 250 ms', () => {
  it.each(['learning', 'singer'] as const)(
    'still lights every %s slide: the lag allowance covers it',
    (level) => {
      // Arrange
      const { path, preset } = ngRun(level)

      // Act
      const played = play(path, preset, follow(path, 0.25))

      // Assert: lit but for the 250 ms of silence at each slide's start
      for (const coverage of coverages(path, played)) {
        expect(coverage).toBeGreaterThan(preset.litShare)
        expect(coverage).toBeLessThan(
          1 - 0.25 / (path.arches[0].end - path.arches[0].start) + 0.01,
        )
      }
      expect(played.state.breaks).toEqual([])
      expect(played.state.jumps).toEqual([])
    },
  )

  it('lights the Pro slides only in part: 120 ms of lag is allowed, not 250', () => {
    // Arrange
    const { path, preset } = ngRun('professional')

    // Act
    const played = play(path, preset, follow(path, 0.25))

    // Assert
    for (const coverage of coverages(path, played)) {
      expect(coverage).toBeGreaterThan(0.1)
      expect(coverage).toBeLessThan(0.3)
    }
    expect(typesOf(played)).toContain('offPath')
    // The silent quarter second before the voice starts is not a break.
    expect(played.state.breaks).toEqual([])
  })
})

describe('tickGlide, Ng slides: breaks', () => {
  /** On the path, silent for half a second on slide 2's way down. */
  function brokenVoice(path: GlidePath): { voice: Voice; stopsAt: number } {
    const stopsAt = path.arches[1].topEnd + 0.3
    const voice = silentWhen(
      follow(path),
      (t) => t > stopsAt && t < stopsAt + 0.5,
    )
    return { voice, stopsAt }
  }

  it.each(LEVELS)('breaks %s once, at the note the path was on', (level) => {
    // Arrange
    const { path, preset } = ngRun(level)
    const { voice, stopsAt } = brokenVoice(path)

    // Act
    const played = play(path, preset, voice)

    // Assert
    const lastVoiced = Math.floor(stopsAt * 60) / 60
    const breaks = played.events.filter((e) => e.event.type === 'break')
    expect(breaks).toHaveLength(1)
    // Fired on the frame the gap reached the level's break time.
    const gap = breaks[0].t - lastVoiced
    expect(gap).toBeGreaterThanOrEqual(preset.breakMs / 1000 - 1e-6)
    expect(gap).toBeLessThan(preset.breakMs / 1000 + 1 / 60)
    expect(played.state.breaks).toEqual([
      { arch: 1, t: lastVoiced, midi: targetAt(path, lastVoiced) },
    ])
    const note = computeGlideResult(played.state, path, preset).breaks[0].note
    expect(note).toBe(Math.round(targetAt(path, lastVoiced) ?? NaN))
    // Slide 2 (root 49, top 56), 0.3 s into Beginner's 1.5 s fall: 55.3.
    if (level === 'learning') expect(note).toBe(55)
  })

  it('counts the gap as unlit: half a second off the slide', () => {
    // Arrange
    const { path, preset } = ngRun('learning')

    // Act
    const played = play(path, preset, brokenVoice(path).voice)

    // Assert: 3.0 of 3.5 s on the path
    expect(archCoverage(played.state, path, 1)).toBeCloseTo(3 / 3.5, 2)
  })

  it('is no break when the voice lets go just before the slide ends', () => {
    // Arrange: silent from 0.1 s before the down glide ends
    const { path, preset } = ngRun('learning')
    const voice = silentWhen(follow(path), (t) => {
      const arch = archAt(path, t)
      return arch !== null && t > arch.end - 0.1
    })

    // Act
    const played = play(path, preset, voice)

    // Assert
    expect(played.state.breaks).toEqual([])
  })
})

describe('tickGlide, Ng slides: the top', () => {
  /** The voice capped `cents` under each slide's top. */
  const shortOf =
    (path: GlidePath, cents: number): Voice =>
    (t) => {
      const midi = targetAt(path, t)
      const arch = archAt(path, t)
      return midi === null || arch === null
        ? null
        : Math.min(midi, arch.topMidi - cents / 100)
    }

  /** The voice stretched so each slide peaks a semitone over its top. */
  const pastTop =
    (path: GlidePath): Voice =>
    (t) => {
      const midi = targetAt(path, t)
      const arch = archAt(path, t)
      return midi === null || arch === null
        ? null
        : arch.rootMidi + ((midi - arch.rootMidi) * 8) / 7
    }

  it('reaches every Pro top on a clean slide, and leans neither way', () => {
    // Arrange
    const { path, preset } = ngRun('professional')

    // Act
    const result = computeGlideResult(
      play(path, preset, follow(path)).state,
      path,
      preset,
    )

    // Assert
    expect(result.topsReached).toBe(5)
    expect(result.topTendencyCents).toBeCloseTo(0, 6)
  })

  it('reaches no Pro top a semitone short of it, and reads the tops flat', () => {
    // Arrange
    const { path, preset } = ngRun('professional')

    // Act
    const played = play(path, preset, shortOf(path, 100))
    const result = computeGlideResult(played.state, path, preset)

    // Assert
    expect(typesOf(played)).not.toContain('top')
    expect(result.topsReached).toBe(0)
    expect(result.topTendencyCents).toBeCloseTo(-100, 6)
  })

  it('reaches no Pro top a semitone past it, and reads the tops sharp', () => {
    // Arrange
    const { path, preset } = ngRun('professional')

    // Act
    const played = play(path, preset, pastTop(path))
    const result = computeGlideResult(played.state, path, preset)

    // Assert
    expect(typesOf(played)).not.toContain('top')
    expect(result.topsReached).toBe(0)
    expect(result.topTendencyCents).toBeCloseTo(100, 6)
  })

  it('needs 200 ms on the top note: brushing it on the way up is not enough', () => {
    // Arrange: on the path, but 100 c under the top through most of it
    const { path, preset } = ngRun('professional')
    const voice: Voice = (t) => {
      const arch = archAt(path, t)
      if (arch === null) return null
      const inDip = t >= arch.topStart + 0.05 && t < arch.topEnd + 0.2
      return inDip ? arch.topMidi - 1 : targetAt(path, t)
    }

    // Act
    const played = play(path, preset, voice)

    // Assert
    expect(typesOf(played)).not.toContain('top')
  })

  it('does not judge the top below Pro, but still reads its lean', () => {
    // Arrange
    const { path, preset } = ngRun('learning')

    // Act
    const played = play(path, preset, shortOf(path, 100))
    const result = computeGlideResult(played.state, path, preset)

    // Assert
    expect(typesOf(played)).not.toContain('top')
    expect(result.topsReached).toBeNull()
    expect(result.topTendencyCents).toBeCloseTo(-100, 6)
  })
})

describe('tickGlide, Ng slides: the breath and the landing are not judged', () => {
  it('ignores a voice wandering through every breath and landing', () => {
    // Arrange: the clean slide, plus a note a fourth off in every breath
    // and landing, flipping up and down every 30 ms
    const { path, preset } = ngRun('singer')
    const voice: Voice = (t) => {
      const arch = archAt(path, t)
      const sung = arch !== null && t >= arch.start && t <= arch.end
      if (sung) return targetAt(path, t)
      const wander = Math.floor(t / 0.03) % 2 === 0 ? 5 : -5
      return (arch?.rootMidi ?? 48) + wander
    }

    // Act
    const played = play(path, preset, voice)

    // Assert
    expect(typesOf(played)).toEqual(cleanTypes('singer'))
    expect(played.state.jumps).toEqual([])
    for (const coverage of coverages(path, played)) {
      expect(coverage).toBeGreaterThan(0.97)
    }
  })
})
