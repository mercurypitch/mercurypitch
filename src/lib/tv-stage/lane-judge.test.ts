// ============================================================
// TV stage lane judge tests — the singer judged as the ribbon judges them
// ============================================================
//
// The lane's verdicts are held to the phone ribbon's own `judgeSinger`
// (stem-mixer/zen-pitch-ribbon.ts) over a sweep of readings: the same
// verdict and the same drawn height for each. Then what the lane does with
// them: strokes cut where the singer stopped or leapt, flickers dropped, and
// the stretches of a note sung on pitch.

import { describe, expect, it } from 'vitest'
import { judgeSinger } from '@/features/stem-mixer/zen-pitch-ribbon'
import { sortedNotes } from '@/lib/tv-stage/lane-band'
import type { TrailPoint } from '@/lib/tv-stage/lane-judge'
import { foldCents, JUDGE_TOLERANCE_CENTS, judgeReading, litSpans, nearestOctave, strokesOf, trailPoints, } from '@/lib/tv-stage/lane-judge'
import type { TvStageNote } from '@/lib/tv-stage/protocol'

const NOTE: TvStageNote = { t0: 10, t1: 12, midi: 64 }

const frequencyOf = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

const point = (
  time: number,
  midi: number,
  verdict: TrailPoint['verdict'] = 'free',
): TrailPoint => ({ time, midi, verdict, note: null })

describe('a reading', () => {
  it('gets the verdict and the height the phone’s ribbon gives it, across two octaves', () => {
    const target = { startBeat: NOTE.t0, endBeat: NOTE.t1, midi: NOTE.midi }

    for (let midi = 50; midi <= 78; midi += 0.13) {
      const phone = judgeSinger(frequencyOf(midi), target)
      const tv = judgeReading(midi, NOTE)
      expect(tv.verdict, `at ${midi.toFixed(2)}`).toBe(phone.state)
      expect(tv.midi).toBeCloseTo(phone.displayMidi ?? Number.NaN, 6)
    }
  })

  it('is on the note within 50 cents either way, and off it past that', () => {
    expect(JUDGE_TOLERANCE_CENTS).toBe(50)
    expect(judgeReading(64.5, NOTE).verdict).toBe('hit')
    expect(judgeReading(63.5, NOTE).verdict).toBe('hit')
    expect(judgeReading(64.51, NOTE).verdict).toBe('off')
    expect(judgeReading(63.49, NOTE).verdict).toBe('off')
  })

  it('is on the note an octave away, and drawn in the note’s octave', () => {
    const below = judgeReading(52.2, NOTE)

    expect(below.verdict).toBe('hit')
    expect(below.midi).toBeCloseTo(64.2, 6)
  })

  it('is free, never judged, with no note sounding', () => {
    expect(judgeReading(52.2, null)).toEqual({ verdict: 'free', midi: 52.2 })
  })

  it('folds cents as the score does', () => {
    expect(foldCents(1150)).toBeCloseTo(-50, 9)
    expect(foldCents(-1150)).toBeCloseTo(50, 9)
    expect(foldCents(600)).toBe(600)
  })
})

describe('the trail', () => {
  const sorted = sortedNotes([NOTE])
  const band = { low: 56, high: 70 }

  it('judges each reading against the note sounding at its moment', () => {
    const points = trailPoints(
      sorted,
      [
        [9.9, 64],
        [10.1, 52.1],
        [10.2, 66],
      ],
      { from: 9, position: 11 },
      band,
    )

    expect(points.map((p) => p.verdict)).toEqual(['free', 'hit', 'off'])
    expect(points[1]?.midi).toBeCloseTo(64.1, 6)
    expect(points[1]?.note).toBe(NOTE)
  })

  it('draws a free reading in the octave nearest the band’s middle', () => {
    const [free] = trailPoints(
      sorted,
      [[9.5, 39.5]],
      { from: 9, position: 11 },
      band,
    )

    expect(free?.midi).toBe(63.5)
    expect(nearestOctave(75, 63)).toBe(63)
  })

  it('keeps only the readings between its start and the song’s place', () => {
    const points = trailPoints(
      sorted,
      [
        [8, 64],
        [10, 64],
        [11.5, 64],
      ],
      { from: 9, position: 11 },
      band,
    )

    expect(points.map((p) => p.time)).toEqual([10])
  })

  it('cuts strokes where the singer stopped or leapt, and drops a flicker', () => {
    const strokes = strokesOf([
      point(1, 60),
      point(1.05, 60.2),
      point(1.1, 60.1),
      // A pause of 0.3 s: a new stroke.
      point(1.4, 61),
      point(1.45, 61),
      point(1.5, 61),
      // A leap of eight semitones: a new stroke, but only 0.05 s long.
      point(1.55, 69),
      point(1.6, 69),
      // Back down: the newest stroke, kept however short.
      point(1.65, 61),
    ])

    expect(strokes.map((stroke) => stroke.map((p) => p.time))).toEqual([
      [1, 1.05, 1.1],
      [1.4, 1.45, 1.5],
      [1.65],
    ])
  })
})

describe('a note sung on pitch', () => {
  it('lights where it was hit, cut at the note’s ends and at the song’s place', () => {
    const hit = (time: number): TrailPoint => ({
      time,
      midi: 64,
      verdict: 'hit',
      note: NOTE,
    })
    const points = [
      { ...hit(9.95), note: null, verdict: 'free' as const },
      hit(10.02),
      hit(10.06),
      hit(10.1),
      { ...hit(10.3), verdict: 'off' as const },
      hit(10.6),
      hit(10.64),
    ]

    const spans = litSpans(NOTE, points, 10.62)

    expect(spans).toHaveLength(2)
    expect(spans[0]?.[0]).toBe(10)
    expect(spans[0]?.[1]).toBeCloseTo(10.15, 6)
    expect(spans[1]?.[0]).toBeCloseTo(10.55, 6)
    expect(spans[1]?.[1]).toBe(10.62)
  })

  it('does not light for a hit on another note', () => {
    const other: TvStageNote = { t0: 10, t1: 12, midi: 64 }

    expect(
      litSpans(
        other,
        [{ time: 10.5, midi: 64, verdict: 'hit', note: NOTE }],
        11,
      ),
    ).toEqual([])
  })
})
