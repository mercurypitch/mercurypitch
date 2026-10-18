// ============================================================
// The range's slides: when one starts and ends, and what two of them measure
// ============================================================

import { describe, expect, it } from 'vitest'
import { FLOOR_SEC, NUDGE_SEC } from './first-note'
import { glide, heldWindow, hold, noiseWindow, room, slideWindow, } from './range-frames.test-fixtures'
import { readRange, readSlide, SLIDE_MAX_SEC } from './range-take'

/** The frames of a slide that is over. */
function slideOf(frames: ReturnType<typeof room>) {
  const reading = readSlide(frames)
  if (reading.kind !== 'done') throw new Error(`not done: ${reading.kind}`)
  return reading.frames
}

describe('readSlide', () => {
  it('listens to the room before it judges anything', () => {
    expect(readSlide([])).toEqual({ kind: 'floor' })
    expect(readSlide(room(0, FLOOR_SEC - 0.05))).toEqual({ kind: 'floor' })
  })

  it('waits for a voice, and nudges once NUDGE_SEC have gone without one', () => {
    expect(readSlide(room(0, 3))).toEqual({ kind: 'waiting', nudge: false })
    expect(readSlide(room(0, NUDGE_SEC + 0.1))).toEqual({
      kind: 'waiting',
      nudge: true,
    })
  })

  it('slides from the onset of the voice while the voice goes on', () => {
    const frames = [...room(0, 1), ...glide(1, 52, 46, 1)]

    expect(readSlide(frames)).toEqual({ kind: 'sliding', onset: 1 })
  })

  it('takes a breath before SLIDE_MIN_SEC of voice as part of the slide', () => {
    // Under a second of voice, then a second of quiet: not over yet, as
    // SLIDE_MIN_SEC (1.5) of voice has not come.
    const frames = [...room(0, 1), ...glide(1, 52, 49, 0.8), ...room(1.8, 1.2)]

    expect(readSlide(frames).kind).toBe('sliding')
  })

  it('ends a slide at the quiet after it, keeping its frames from the onset on', () => {
    const frames = slideWindow(52, 40)

    const slide = slideOf(frames)

    expect(slide[0].t).toBe(1)
    expect(slide.at(-1)?.t).toBe(frames.at(-1)?.t)
    expect(slide.some((frame) => frame.f0 > 0)).toBe(true)
  })

  it('ends a slide that never stops SLIDE_MAX_SEC after its onset', () => {
    const frames = [...room(0, 1), ...hold(1, 52, SLIDE_MAX_SEC + 0.5)]

    const slide = slideOf(frames)

    expect(slide[0].t).toBe(1)
    expect(slide.at(-1)?.t).toBeLessThanOrEqual(1 + SLIDE_MAX_SEC)
    expect(slide.at(-1)?.t).toBeGreaterThan(1 + SLIDE_MAX_SEC - 0.02)
  })
})

describe('readRange', () => {
  it('measures the two slides together: down to E2, up to G4', () => {
    const down = slideOf(slideWindow(52, 40))
    const up = slideOf(slideWindow(45, 67))

    const outcome = readRange([down, up])

    expect(outcome.kind).toBe('range')
    if (outcome.kind !== 'range') return
    expect(outcome.range).toMatchObject({
      lowNote: 'E2',
      highNote: 'G4',
      semitones: 27,
    })
  })

  it('calls one note held on both slides narrow, not a range', () => {
    const held = slideOf(heldWindow(57))

    expect(readRange([held, held]).kind).toBe('narrow')
  })

  it('counts a fourth as a range, and a major third as a held note', () => {
    const at = (high: number) => [
      [...hold(1, 52, 0.5), ...hold(1.5, high, 0.5)],
    ]

    // E3 to A3, and E3 to G#3.
    expect(readRange(at(57)).kind).toBe('range')
    expect(readRange(at(56)).kind).toBe('narrow')
  })

  it('finds no range in sound with no pitch in it', () => {
    const loud = slideOf(noiseWindow(SLIDE_MAX_SEC + 0.2))

    expect(readRange([loud, loud])).toEqual({ kind: 'unheard' })
  })
})
