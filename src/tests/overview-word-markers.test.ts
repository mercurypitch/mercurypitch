// ============================================================
// Overview word markers — hit-testing and thinning
// ============================================================
//
// The pure layer under the waveform's per-word ticks: which tick a click
// lands on, and which ticks are worth drawing at all. Both are decisions a
// canvas cannot be asked about after the fact, so they live here.

import { describe, expect, it } from 'vitest'
import type { OverviewWindow, WordMarker, } from '@/features/stem-mixer/overview-mapping'
import { nearestMarker, timeToX, visibleMarkers, wordMarkersFrom, xToTime, } from '@/features/stem-mixer/overview-mapping'

/** 100 s of song across 1000 px: 10 px per second. */
const WIN: OverviewWindow = { start: 20, duration: 100 }
const WIDTH = 1000

const marker = (time: number, wordIdx: number, lineIdx = 0): WordMarker => ({
  time,
  lineIdx,
  wordIdx,
  isLineStart: wordIdx === 0,
})

describe('xToTime', () => {
  it('is the exact inverse of timeToX', () => {
    for (const t of [20, 45.5, 119.999]) {
      expect(xToTime(timeToX(t, WIN, WIDTH), WIN, WIDTH)).toBeCloseTo(t, 9)
    }
  })

  it('reads off the window start on a zero-width canvas', () => {
    // Before layout the canvas is 0 px wide; dividing by it would give a
    // NaN time that then poisons a seek.
    expect(xToTime(50, WIN, 0)).toBe(20)
  })
})

describe('nearestMarker', () => {
  const markers = [marker(30, 0), marker(31, 1), marker(40, 2)]

  it('finds the marker under the pointer', () => {
    expect(
      nearestMarker(markers, timeToX(40, WIN, WIDTH), WIN, WIDTH)?.time,
    ).toBe(40)
  })

  it('returns null when nothing is within tolerance', () => {
    // 35 s is 50 px from either neighbour.
    expect(
      nearestMarker(markers, timeToX(35, WIN, WIDTH), WIN, WIDTH),
    ).toBeNull()
  })

  it('honours a wider tolerance when asked', () => {
    const x = timeToX(35, WIN, WIDTH)
    expect(nearestMarker(markers, x, WIN, WIDTH, 60)?.time).toBe(31)
  })

  it('gives a tie to the word that has already started', () => {
    // Exactly between 30 s and 31 s. The earlier word is the one being sung.
    const x = timeToX(30.5, WIN, WIDTH)
    expect(nearestMarker(markers, x, WIN, WIDTH, 20)?.time).toBe(30)
  })

  it('has nothing to find in an empty mapping', () => {
    expect(nearestMarker([], 100, WIN, WIDTH)).toBeNull()
  })
})

describe('visibleMarkers', () => {
  it('drops markers outside the window', () => {
    const markers = [marker(5, 0), marker(50, 0), marker(500, 0)]
    expect(visibleMarkers(markers, WIN, WIDTH).map((m) => m.time)).toEqual([50])
  })

  it('thins inner words that would overplot', () => {
    // Four words 0.1 s apart is 1 px between ticks at this zoom, then one
    // 0.6 s out. Deliberately not sitting on the 4 px threshold: at exactly
    // the gap, float dust in the time->pixel maths decides it either way,
    // and a test pinning that would be testing IEEE 754, not thinning.
    const markers = [
      marker(30, 0),
      marker(30.1, 1),
      marker(30.2, 2),
      marker(30.3, 3),
      marker(30.6, 4),
    ]
    const visible = visibleMarkers(markers, WIN, WIDTH, 4)
    expect(visible.map((m) => m.wordIdx)).toEqual([0, 4])
  })

  it('never drops a line start, however dense', () => {
    // Ten line starts 0.1 s apart: the song's structure has to survive.
    const markers = Array.from({ length: 10 }, (_, i) =>
      marker(30 + i * 0.1, 0, i),
    )
    expect(visibleMarkers(markers, WIN, WIDTH, 4)).toHaveLength(10)
  })

  it('keeps everything once zoomed in far enough', () => {
    const markers = [marker(30, 0), marker(30.1, 1), marker(30.2, 2)]
    const zoomed: OverviewWindow = { start: 29, duration: 2 }
    expect(visibleMarkers(markers, zoomed, WIDTH, 4)).toHaveLength(3)
  })

  it('lets an off-screen tick keep its pixel gap', () => {
    // Otherwise the first visible inner word blinks in and out as the
    // window scrolls, because whether it is thinned depends on a
    // neighbour that just left the canvas.
    const markers = [marker(19.9, 1), marker(20.05, 2)]
    expect(visibleMarkers(markers, WIN, WIDTH, 4)).toHaveLength(1)
  })
})

describe('wordMarkersFrom', () => {
  it('flattens the mapper timings into sorted markers', () => {
    const markers = wordMarkersFrom({ 1: [20, 20.5], 0: [10, 10.5] })
    expect(markers.map((m) => m.time)).toEqual([10, 10.5, 20, 20.5])
    expect(markers.map((m) => m.isLineStart)).toEqual([
      true,
      false,
      true,
      false,
    ])
    expect(markers[2].lineIdx).toBe(1)
  })

  it('skips words that were never given a time', () => {
    const sparse: number[] = []
    sparse[0] = 10
    sparse[2] = 12
    const markers = wordMarkersFrom({ 0: sparse })
    expect(markers.map((m) => m.wordIdx)).toEqual([0, 2])
  })

  it('has nothing to show for an unmapped song', () => {
    expect(wordMarkersFrom({})).toEqual([])
  })
})
