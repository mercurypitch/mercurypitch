// ============================================================
// Lesson 5 Sing it tests — the note, the status lines, the claims check
// ============================================================
//
// The checkpoint's pure parts: where Lower and Higher may take the note
// (FACTS 55), what the status line says in each state, what the card
// offers after each answer, and the claims check over every line the
// checkpoint itself writes, beside the reader's own (hold-take.test.ts).

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { HoldReading } from '@/features/lessons/kit/hold-take'
import { holdChartWords, holdSummary } from '@/features/lessons/kit/hold-take'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { afterFeeling, emptyRecord, withTake } from './hold-flow'
import { afterLines, HOLD_HEAD, holdNote, MAX_MOVE, phaseStatus, ringLabel, STATUS, stepStatus, } from './sing'

const reading = (inBand: number, length: number): HoldReading => ({
  kind: 'read',
  length,
  inBand,
  of: length,
  stoppedAt: null,
  settled: 0.5,
  d: 0,
  octaves: 0,
  share: inBand / length,
  line: '',
  octaveLine: null,
})

describe('the note (FACTS 55)', () => {
  it('moves a semitone a tap, up to four either way: F3 to C sharp 4, or F4 to C sharp 5', () => {
    expect(MAX_MOVE).toBe(4)
    expect([
      holdNote('lower', -4),
      holdNote('lower', 0),
      holdNote('lower', 4),
    ]).toEqual([53, 57, 61])
    expect([holdNote('higher', -9), holdNote('higher', 9)]).toEqual([65, 73])
    expect(ringLabel(57)).toBe('A3 · 220 Hz')
    expect(ringLabel(58)).toContain('233 Hz')
  })
})

describe('the status line', () => {
  it('names each phase of a hold: Listen, Breathe, Sing', () => {
    expect(phaseStatus(1, 'A3', 'listen')).toBe(
      "Hold 1: ten seconds, on A3. Listen to Merc's note.",
    )
    expect(phaseStatus(2, 'A4', 'breathe')).toBe('Breathe in, low and quiet.')
    expect(phaseStatus(2, 'A4', 'sing')).toBe(
      'Sing, and hold the note until the ring closes.',
    )
  })

  it('says the rest after Easy, the gentle line after Effortful and enough after Uncomfortable', () => {
    const r = withTake(emptyRecord(), 1, { kind: 'read', share: 1 })
    expect(stepStatus(afterFeeling(1, 'easy', r), null)).toBe(
      'Rest for a few easy breaths. Ready when you are.',
    )
    expect(stepStatus(afterFeeling(1, 'effortful', r), null)).toBe(
      'Keep it gentle: rest before you sing again.',
    )
    expect(stepStatus(afterFeeling(1, 'uncomfortable', r), null)).toBe(
      "Thanks for saying so. That's enough singing for today: rest your voice.",
    )
  })

  it('gives both readings after an Easy fifteen-second hold, with Again and Done', () => {
    // Arrange
    const r = withTake(
      withTake(emptyRecord(), 1, { kind: 'read', share: 0.84 }),
      2,
      { kind: 'read', share: 0.86 },
    )
    const summary = holdSummary(reading(8.4, 10), reading(12.9, 15))

    // Act
    const step = afterFeeling(2, 'easy', r)
    const lines = afterLines(step, summary)

    // Assert
    expect(stepStatus(step, summary)).toBe(
      'This time your line was in the band for 8.4 of 10 seconds, then 12.9 of 15.',
    )
    expect(lines).toMatchObject({
      summary,
      closing: null,
      hold15: false,
      again: true,
      done: 'done',
    })
  })
})

describe('the claims check (src/lib/guided-voice/claims.ts)', () => {
  it('passes every line the checkpoint writes as a finding', () => {
    // Arrange
    const lines = new Set<string>([
      ...Object.values(STATUS),
      ...Object.values(HOLD_HEAD),
      phaseStatus(1, 'A3', 'listen'),
      phaseStatus(2, 'C♯5', 'listen'),
      holdSummary(reading(8.4, 10), null) ?? '',
      holdSummary(reading(10, 10), reading(15, 15)) ?? '',
      holdChartWords('A3', reading(8.4, 10)),
      holdChartWords('A3', { ...reading(0, 10), kind: 'silent' }),
      "If that felt tricky, good: that's learning.",
    ])

    for (const text of lines) {
      // Act
      const result = validateGuidedDynamicClaim({ surface: 'finding', text })

      // Assert
      expect(result.violations, text).toEqual([])
    }
  })
})
