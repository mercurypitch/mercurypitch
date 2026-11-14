// ============================================================
// Part contour tests — a part's notes as one voice's line
// ============================================================
//
// Lesson 26 WEB-SPEC, What the kit and the app still need, item 6: each
// note a held point at its pitch with a 0.05 s glide to the next, arriving
// on the next note's beat; a repeated note dips to a quarter for 0.08 s
// between the two; the last note holds to its end. Lesson 28 WEB-SPEC,
// Audio: a note a breath follows falls to a quarter for its last half
// beat, then the voice glides into the next note at its full level.

import { describe, expect, it } from 'vitest'
import { hz } from './notes'
import { PART_BREATH, PART_DIP, PART_GLIDE_SEC, partContour, } from './part-contour'
import { contourLength } from './sound'

const E3 = 52
const FS3 = 54
const G3 = 55

describe('a part as one voice’s line', () => {
  it('holds each note at its pitch and glides to the next over the last 0.05 s of its length', () => {
    // Act: the lower part's first three notes, la ti do, a second each
    const points = partContour([
      { midi: E3, sec: 1 },
      { midi: FS3, sec: 1 },
      { midi: G3, sec: 2 },
    ])

    // Assert
    expect(points).toEqual([
      { t: 0, hz: hz(E3), level: 1 },
      { t: 1 - PART_GLIDE_SEC, hz: hz(E3), level: 1 },
      { t: 1, hz: hz(FS3), level: 1 },
      { t: 2 - PART_GLIDE_SEC, hz: hz(FS3), level: 1 },
      { t: 2, hz: hz(G3), level: 1 },
      { t: 4, hz: hz(G3), level: 1 },
    ])
  })

  it('lasts as long as its notes, the voice’s release starting as the last ends', () => {
    // Act: the lower part, la ti do ti la, the last two beats
    const points = partContour(
      [E3, FS3, G3, FS3, E3].map((midi, i) => ({ midi, sec: i === 4 ? 2 : 1 })),
    )

    // Assert
    expect(contourLength(points)).toBe(6)
    expect(points.at(-1)).toEqual({ t: 6, hz: hz(E3), level: 1 })
  })

  it('dips to a quarter for 0.08 s between two notes on one pitch, and keeps the pitch', () => {
    // Act
    const points = partContour([
      { midi: G3, sec: 1 },
      { midi: G3, sec: 1 },
    ])

    // Assert
    expect(PART_DIP).toEqual({ level: 0.25, sec: 0.08 })
    expect(points).toEqual([
      { t: 0, hz: hz(G3), level: 1 },
      { t: 0.96, hz: hz(G3), level: 1 },
      { t: 1, hz: hz(G3), level: 0.25 },
      { t: 1.04, hz: hz(G3), level: 1 },
      { t: 2, hz: hz(G3), level: 1 },
    ])
  })

  it('falls to a quarter for a breath at the end of the note it follows, then glides into the next at full level', () => {
    // Act: a half note at 72 BPM, its last half beat a breath, then the next
    const points = partContour([
      { midi: G3, sec: 1.6, breath: 0.4 },
      { midi: E3, sec: 1 },
    ])

    // Assert
    expect(PART_BREATH).toEqual({ level: 0.25, fall: 0.05 })
    expect(points).toEqual([
      { t: 0, hz: hz(G3), level: 1 },
      { t: 1.2, hz: hz(G3), level: 1 },
      { t: 1.25, hz: hz(G3), level: 0.25 },
      { t: 1.6 - PART_GLIDE_SEC, hz: hz(G3), level: 0.25 },
      { t: 1.6, hz: hz(E3), level: 1 },
      { t: 2.6, hz: hz(E3), level: 1 },
    ])
  })

  it('keeps a breath before a note on the same pitch, its dip the breath', () => {
    // Act
    const points = partContour([
      { midi: G3, sec: 1, breath: 0.4 },
      { midi: G3, sec: 1 },
    ])

    // Assert: no rise to full level before the boundary
    expect(points).toEqual([
      { t: 0, hz: hz(G3), level: 1 },
      { t: 0.6, hz: hz(G3), level: 1 },
      { t: 0.65, hz: hz(G3), level: 0.25 },
      { t: 1, hz: hz(G3), level: 0.25 },
      { t: 1.04, hz: hz(G3), level: 1 },
      { t: 2, hz: hz(G3), level: 1 },
    ])
  })

  it('draws nothing for no notes', () => {
    expect(partContour([])).toEqual([])
  })
})
