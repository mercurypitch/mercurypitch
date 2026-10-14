// ============================================================
// Glide engine — Lip roll: a trill's wobble, the tracker's gaps, a stall
// ============================================================
//
// A lip trill's pitch wobbles with the lips, and the tracker can drop it
// for a few frames (DESIGN-lip-roll.md §3). The preset is wider than Ng's
// and bridges gaps of up to 150 ms until the tracker check says the stream
// holds a phone's trill.

import { describe, expect, it } from 'vitest'
import { archCoverage } from './glide-engine'
import { computeGlideResult } from './glide-metrics'
import type { GlidePath } from './glide-path'
import { lipRollPath } from './glide-path'
import type { GlideLevelId, GlidePreset } from './glide-presets'
import { LIP_ROLL_BRIDGE_GAP_MS, LIP_ROLL_LEVELS } from './glide-presets'
import type { Voice } from './test-glides'
import { follow, framesOf, offset, playGlide, silentWhen, typesOf, } from './test-glides'

const LEVELS: readonly GlideLevelId[] = ['learning', 'singer', 'professional']

/** Three waves from G2: G2, A2 and B2, each up an octave. */
function lipRun(level: GlideLevelId): { path: GlidePath; preset: GlidePreset } {
  const preset = LIP_ROLL_LEVELS[level]
  return { path: lipRollPath([43, 45, 47], 12, preset), preset }
}

const play = (path: GlidePath, preset: GlidePreset, voice: Voice) =>
  playGlide(framesOf(path, voice), path, preset)

/** The siren with a +-40 cent, 25 Hz wobble on it. */
const wobbling = (path: GlidePath): Voice =>
  offset(follow(path), (t) => 40 * Math.sin(2 * Math.PI * 25 * t))

/** The siren with the tracker dropping it for 80 ms in every 300 ms. */
const dropping = (path: GlidePath): Voice =>
  silentWhen(follow(path), (t) => t % 0.3 < 0.08)

describe('tickGlide, Lip roll: a trill wobbling +-40 cents at 25 Hz', () => {
  it.each(LEVELS)('stays on the %s path the whole way', (level) => {
    // Arrange
    const { path, preset } = lipRun(level)

    // Act
    const played = play(path, preset, wobbling(path))

    // Assert
    expect(typesOf(played)).not.toContain('offPath')
    expect(played.state.jumps).toEqual([])
    expect(played.state.breaks).toEqual([])
    for (const arch of path.arches) {
      expect(archCoverage(played.state, path, arch.index)).toBeGreaterThan(0.99)
    }
  })
})

describe('tickGlide, Lip roll: 80 ms tracker dropouts every 300 ms', () => {
  it.each(LEVELS)('calls no %s break and lights every wave', (level) => {
    // Arrange
    const { path, preset } = lipRun(level)

    // Act
    const played = play(path, preset, dropping(path))
    const result = computeGlideResult(played.state, path, preset)

    // Assert
    expect(played.state.breaks).toEqual([])
    expect(typesOf(played)).not.toContain('offPath')
    expect(result.archesLit).toBe(3)
  })

  it('bridges the gaps: without the bridge a quarter of each wave goes dark', () => {
    // Arrange
    const { path, preset } = lipRun('singer')
    const unbridged = { ...preset, bridgeGapMs: 0 }

    // Act
    const bridged = computeGlideResult(
      play(path, preset, dropping(path)).state,
      path,
      preset,
    )
    const bare = computeGlideResult(
      play(path, unbridged, dropping(path)).state,
      path,
      unbridged,
    )

    // Assert
    expect(LIP_ROLL_BRIDGE_GAP_MS).toBe(150)
    expect(bridged.litShare).toBeGreaterThan(0.98)
    expect(bare.litShare).toBeLessThan(0.75)
    expect(bare.archesLit).toBe(0)
  })

  it('bridges a Pro gap of exactly 150 ms, as long as the Pro break time', () => {
    // Arrange: nine silent frames, the last 150 ms after the last voiced one
    const { path, preset } = lipRun('professional')
    const first = Math.round((path.arches[1].start + 0.5) * 60) + 1
    const frames = framesOf(path, follow(path)).map((frame, i) =>
      i >= first && i < first + 9 ? { ...frame, f0: 0, conf: 0 } : frame,
    )

    // Act
    const played = playGlide(frames, path, preset)

    // Assert
    expect(preset.breakMs).toBe(LIP_ROLL_BRIDGE_GAP_MS)
    expect(played.state.breaks).toEqual([])
  })

  it('still breaks on a gap longer than the bridge', () => {
    // Arrange: Pro breaks at 150 ms, which the bridge would cover alone
    const { path, preset } = lipRun('professional')
    const wave = path.arches[1]
    const stopsAt = wave.start + 0.5
    const voice = silentWhen(
      follow(path),
      (t) => t > stopsAt && t < stopsAt + 0.2,
    )

    // Act
    const played = play(path, preset, voice)

    // Assert
    expect(played.state.breaks.map((b) => b.arch)).toEqual([1])
  })
})

describe('tickGlide, Lip roll: a voice off the dots', () => {
  it.each(LEVELS)(
    'lights no %s wave half an octave under the path',
    (level) => {
      // Arrange: past every level's band, even with its lag allowed. (Three
      // semitones is not: on the steepest stretch of a Learning wave, the
      // dots 350 ms back are about that far down.)
      const { path, preset } = lipRun(level)

      // Act
      const played = play(
        path,
        preset,
        offset(follow(path), () => -600),
      )
      const result = computeGlideResult(played.state, path, preset)

      // Assert
      for (const arch of path.arches) {
        expect(archCoverage(played.state, path, arch.index)).toBeLessThan(0.01)
      }
      expect(result.archesLit).toBe(0)
    },
  )

  it('still lights Learning 90 cents flat: inside its semitone band', () => {
    // Arrange
    const { path, preset } = lipRun('learning')

    // Act
    const played = play(
      path,
      preset,
      offset(follow(path), () => -90),
    )
    const result = computeGlideResult(played.state, path, preset)

    // Assert
    expect(preset.bandCents).toBe(100)
    expect(result.archesLit).toBe(3)
  })
})

describe('tickGlide, Lip roll: stalling at the top', () => {
  /** The voice stops halfway through each crest and stays silent to the wave's end. */
  const stalling = (path: GlidePath): Voice =>
    silentWhen(follow(path), (t) =>
      path.arches.some((a) => t >= (a.topStart + a.topEnd) / 2 && t <= a.end),
    )

  it.each(LEVELS)('breaks every %s wave at its crest', (level) => {
    // Arrange
    const { path, preset } = lipRun(level)

    // Act
    const played = play(path, preset, stalling(path))
    const result = computeGlideResult(played.state, path, preset)

    // Assert: one break a wave, each at its crest (G3, A3, B3)
    expect(typesOf(played).filter((t) => t === 'break')).toHaveLength(3)
    expect(result.breaks.map((b) => [b.arch, b.note])).toEqual([
      [0, 55],
      [1, 57],
      [2, 59],
    ])
    expect(result.archesLit).toBe(0)
  })
})
