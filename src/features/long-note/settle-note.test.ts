import { describe, expect, it } from 'vitest'
import { sequence, silence, tone } from '@/lib/glass/test-frames'
import { SETTLE_ONSET_TRIM_SEC, SETTLE_SECONDS, settleLiveNote, } from './settle-note'

const ENOUGH = SETTLE_ONSET_TRIM_SEC + SETTLE_SECONDS + 0.05

describe('settleLiveNote', () => {
  it('names a note held still long enough', () => {
    const midi = settleLiveNote(tone(57, ENOUGH))
    expect(midi).not.toBeNull()
    expect(Math.round(midi ?? 0)).toBe(57)
  })

  it('waits while the note is still short', () => {
    expect(settleLiveNote(tone(57, SETTLE_SECONDS))).toBeNull()
  })

  it('does not name a slide', () => {
    // A third up across the take: never still for long enough.
    const slide = sequence(
      (t) => tone(55, 0.3, { startT: t }),
      (t) => tone(57, 0.3, { startT: t }),
      (t) => tone(59, 0.3, { startT: t }),
    )
    expect(settleLiveNote(slide)).toBeNull()
  })

  it('reads only the latest run after a silence', () => {
    const frames = sequence(
      (t) => tone(50, ENOUGH, { startT: t }),
      (t) => silence(0.5, t),
      (t) => tone(62, 0.4, { startT: t }),
    )
    // The new run is too short to name, and the old one is over.
    expect(settleLiveNote(frames)).toBeNull()
  })

  it('names nothing in silence', () => {
    expect(settleLiveNote(silence(2, 0))).toBeNull()
  })
})
