// ============================================================
// Phrase voice — a phrase as the points of Merc's sung line
// ============================================================

import { describe, expect, it } from 'vitest'
import type { VoicePoint } from '@/lib/demo-voice'
import { echoPhrase } from './phrase-bank'
import { phraseToVoicePoints } from './phrase-voice'
import type { Phrase } from './sequence-engine'

/** Points with times in whole milliseconds, so sums compare exactly. */
const inMs = (points: readonly VoicePoint[]) =>
  points.map((p) => ({ ...p, t: Math.round(p.t * 1000) }))

describe('phraseToVoicePoints', () => {
  it('holds each note and glides into the next on its onset', () => {
    // Arrange: C4 E4 G4 (1-3-5 on C4), 0.9 s each.
    const phrase = echoPhrase([1, 3, 5], 'major', 60, 0.9)

    // Act
    const points = phraseToVoicePoints(phrase, 60)

    // Assert: the glide takes the last 60 ms of each note; the line closes
    // at the end of the last.
    expect(inMs(points)).toEqual([
      { t: 0, cents: 0, level: 0.8 },
      { t: 840, cents: 0, level: 0.8 },
      { t: 900, cents: 400, level: 0.8 },
      { t: 1740, cents: 400, level: 0.8 },
      { t: 1800, cents: 700, level: 0.8 },
      { t: 2700, cents: 700, level: 0.8 },
      { t: 2700, cents: 700, level: 0 },
    ])
  })

  it('rests between notes with a gap between them, in cents from the reference', () => {
    // Arrange
    const phrase: Phrase = {
      notes: [
        { midi: 62, at: 0, seconds: 0.5 },
        { midi: 57, at: 1, seconds: 0.5 },
      ],
    }

    // Act
    const points = phraseToVoicePoints(phrase, 57)

    // Assert
    expect(inMs(points)).toEqual([
      { t: 0, cents: 500, level: 0.8 },
      { t: 500, cents: 500, level: 0.8 },
      { t: 500, cents: 500, level: 0 },
      { t: 1000, cents: 0, level: 0.8 },
      { t: 1500, cents: 0, level: 0.8 },
      { t: 1500, cents: 0, level: 0 },
    ])
  })
})
