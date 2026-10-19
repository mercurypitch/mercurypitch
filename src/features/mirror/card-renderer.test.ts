// ============================================================
// The returning visitor's change line: plain words, no arrow
// ============================================================
//
// It read "▲ +2 semitones · accuracy +1 · steadiness -11 since 7 Jul": an up
// arrow for a wider span reads as a reward for range (REQ-GVC-072), and every
// change, however small, got a direction (REQ-GVC-065, REQ-GVC-066). No
// validated noise figure exists for these readings, so only an unchanged
// reading is "similar"; any other change is its two readings, earlier then
// today, and no word says which way is better.

import { describe, expect, it } from 'vitest'
import type { MirrorSummary } from '@/lib/mirror/metrics'
import { formatDeltaLine } from './card-renderer'

const SINCE = new Date('2026-05-12T12:00:00Z')
// The line uses the browser's own short date, so the test asks for the same.
const DAY = SINCE.toLocaleDateString(undefined, {
  day: 'numeric',
  month: 'short',
})

function run(
  semitones: number | null,
  accuracy: number | null,
  steadiness: number | null,
): MirrorSummary {
  return {
    lowMidi: semitones === null ? null : 48,
    highMidi: semitones === null ? null : 48 + semitones,
    semitones,
    accuracy,
    steadiness,
  }
}

describe('formatDeltaLine', () => {
  it('says "Similar today" when no reading changed', () => {
    expect(formatDeltaLine(run(14, 71, 71), run(14, 71, 71), SINCE)).toBe(
      `Similar today to your run on ${DAY}`,
    )
  })

  it('gives a wider span as its two readings, with no arrow and no sign', () => {
    expect(formatDeltaLine(run(14, 71, 71), run(16, 71, 71), SINCE)).toBe(
      `Since ${DAY}: span 14 to 16 semitones · accuracy similar · steadiness similar`,
    )
  })

  it('gives a narrower span in the same words', () => {
    expect(formatDeltaLine(run(16, 71, 71), run(14, 71, 71), SINCE)).toBe(
      `Since ${DAY}: span 16 to 14 semitones · accuracy similar · steadiness similar`,
    )
  })

  it('gives accuracy and steadiness the same way', () => {
    expect(formatDeltaLine(run(14, 71, 71), run(14, 72, 60), SINCE)).toBe(
      `Since ${DAY}: span similar · accuracy 71 to 72 · steadiness 71 to 60`,
    )
  })

  it('leaves out a reading either run lacks', () => {
    expect(formatDeltaLine(run(14, null, 71), run(15, 80, 71), SINCE)).toBe(
      `Since ${DAY}: span 14 to 15 semitones · steadiness similar`,
    )
    expect(formatDeltaLine(run(null, null, null), run(15, 80, 71), SINCE)).toBe(
      '',
    )
  })

  it('never gives a change an arrow, a sign or a direction', () => {
    const lines: string[] = []
    for (let earlier = 0; earlier <= 30; earlier += 3) {
      for (let today = 0; today <= 30; today += 2) {
        lines.push(
          formatDeltaLine(
            run(earlier, earlier * 3, 100 - earlier),
            run(today, today * 3, 100 - today),
            SINCE,
          ),
        )
      }
    }

    expect(lines.filter((line) => line === '')).toEqual([])
    expect(
      lines.filter((line) =>
        /[▲▼↑↓+−-]|\b(?:up|down|wider|narrower|more|less|better|worse|improv\w*|grew|gain\w*|lost)\b/iu.test(
          line,
        ),
      ),
    ).toEqual([])
  })
})
