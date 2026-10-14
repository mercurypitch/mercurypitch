// ============================================================
// The reveal: the lit glass is the engine's coverage, strip for strip
// ============================================================

import { describe, expect, it } from 'vitest'
import { archCoverage, createGlideState, tickGlide, } from '@/lib/glide/glide-engine'
import { ngSlidesPath } from '@/lib/glide/glide-path'
import { NG_SLIDES_LEVELS } from '@/lib/glide/glide-presets'
import type { Voice } from '@/lib/glide/test-glides'
import { follow, framesOf, offset, silentWhen } from '@/lib/glide/test-glides'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { createBridgeReveal, litFromLeft } from './bridge-reveal'

const ROOTS = [45, 46, 47, 48, 49]

/** Every frame through the engine and the reveal, as the room does it. */
function play(
  frames: readonly PitchFrame[],
  level: keyof typeof NG_SLIDES_LEVELS = 'singer',
) {
  const preset = NG_SLIDES_LEVELS[level]
  const path = ngSlidesPath(ROOTS, preset)
  const state = createGlideState(path)
  const reveal = createBridgeReveal(path)
  const drained: ReturnType<typeof reveal.drain>[] = []
  for (const [i, frame] of frames.entries()) {
    const previous = state.previousT ?? frame.t
    tickGlide(state, frame, path, preset)
    reveal.credit(previous, frame.t, state.following)
    if (i % 3 === 2) drained.push(reveal.drain())
  }
  drained.push(reveal.drain())
  return { path, state, reveal, strips: drained.flat() }
}

const path = ngSlidesPath(ROOTS, NG_SLIDES_LEVELS.singer)

describe('the lit share of an arch', () => {
  const voices: Array<[string, Voice]> = [
    ['on the line', follow(path)],
    ['a little late', follow(path, 0.12)],
    [
      'flat in the second half of every arch',
      offset(follow(path), (t) => {
        const arch = path.arches.find((a) => t >= a.start && t <= a.end)
        return arch !== undefined && t > (arch.start + arch.end) / 2 ? -150 : 0
      }),
    ],
    ['with gaps', silentWhen(follow(path), (t) => Math.floor(t * 3) % 4 === 1)],
  ]

  it.each(voices)('is the engine coverage, %s', (_, voice) => {
    const { state, reveal } = play(framesOf(path, voice))

    for (const arch of path.arches) {
      expect(reveal.share(arch.index)).toBeCloseTo(
        archCoverage(state, path, arch.index),
        9,
      )
    }
  })

  it('caps a long gap between frames as the engine does', () => {
    // Frames 0.25 s apart: each credits 0.1 s, the latest of its stretch.
    const sparse = framesOf(path, follow(path)).filter((_, i) => i % 15 === 0)
    const { state, reveal } = play(sparse)

    for (const arch of path.arches) {
      expect(reveal.share(arch.index)).toBeCloseTo(
        archCoverage(state, path, arch.index),
        9,
      )
      expect(reveal.share(arch.index)).toBeLessThan(0.6)
    }
  })
})

describe('the strips', () => {
  it('light from the left foot as the voice follows, and never drain', () => {
    const { strips, reveal } = play(framesOf(path, follow(path)))

    // Each arch lights left to right: every strip starts where the last ended.
    for (const arch of path.arches) {
      const mine = strips.filter((s) => s.arch === arch.index)
      expect(mine[0].from).toBeLessThan(-0.9)
      for (let i = 1; i < mine.length; i++) {
        expect(mine[i].from).toBeCloseTo(mine[i - 1].to, 9)
      }
      expect(reveal.litOf(arch.index)).toHaveLength(1)
    }
    // Draining hands each strip over once.
    expect(reveal.drain()).toEqual([])
  })

  it('leaves a dark gap where the voice left the path', () => {
    const arch = path.arches[2]
    const mid = (arch.start + arch.end) / 2
    const voice = silentWhen(
      follow(path),
      (t) => t > mid - 0.2 && t < mid + 0.2,
    )
    const { reveal } = play(framesOf(path, voice))

    const ranges = reveal.litOf(2)
    expect(ranges.length).toBeGreaterThanOrEqual(2)
    // The apex (u = 0) is in the gap.
    expect(ranges.some(([from, to]) => from < 0 && to > 0)).toBe(false)
  })

  it('lights nothing in a breath or a landing', () => {
    const { strips } = play(framesOf(path, follow(path)))

    for (const strip of strips) {
      expect(strip.from).toBeGreaterThanOrEqual(-1 - 1e-9)
      expect(strip.to).toBeLessThanOrEqual(1 + 1e-9)
    }
  })
})

describe('litFromLeft', () => {
  it('lights an arch from its left foot by its coverage', () => {
    expect(litFromLeft(0)).toEqual([])
    expect(litFromLeft(0.5)).toEqual([[-1, 0]])
    expect(litFromLeft(2)).toEqual([[-1, 1]])
  })
})
