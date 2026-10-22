// ============================================================
// Lesson 8 Count the bar tests — six rounds from a fixed seed
// ============================================================
//
// WEB-SPEC, Tests 7 (FACTS 74, 77): a round is two bars and the next bar's
// first beat, beat 1 on the high click; six rounds, each size twice, never
// the same twice running; and every line a round says passes the app's
// claims check and names the bar, never the listener.

import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/features/lessons/kit/dom'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { BAR_WORDS, barClicks, barOrder, clicksAsBar, dealCountTheBar, HIGH_MIDI, PLAIN_MIDI, SIZES, } from './bar-rounds'

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1)

describe('a round', () => {
  it('clicks two bars and the next bar’s first beat, beat 1 on the high click', () => {
    // Act
    const three = barClicks(3)

    // Assert: 5, 7 or 9 clicks
    expect([2, 3, 4].map((n) => barClicks(n).length)).toEqual([5, 7, 9])
    expect(three.map((e) => e.midi)).toEqual([
      HIGH_MIDI,
      PLAIN_MIDI,
      PLAIN_MIDI,
      HIGH_MIDI,
      PLAIN_MIDI,
      PLAIN_MIDI,
      HIGH_MIDI,
    ])
    // seven clicks over 4.0 s at 90 BPM, as quiz question 2 plays them
    expect(three[6].at).toBeCloseTo(4, 9)
  })

  it('carries the clicks nearest 1,500 and 1,000 Hz', () => {
    const hz = (m: number) => 440 * 2 ** ((m - 69) / 12)
    // Assert: FACTS 74
    expect(Math.round(hz(HIGH_MIDI))).toBe(1480)
    expect(Math.round(hz(PLAIN_MIDI))).toBe(988)
  })

  it('becomes one bar for the beat clock, at 90 BPM, or 60 for a miss played slower', () => {
    // Act
    const { bar, bpm } = clicksAsBar(barClicks(2))
    const slower = clicksAsBar(
      barClicks(2).map((e) => ({ ...e, at: e.at * 1.5 })),
    )

    // Assert
    expect(bar.beats).toBe(5)
    expect(bar.hits.map((h) => h.data)).toEqual([
      { kind: 'click', high: true },
      { kind: 'click', high: false },
      { kind: 'click', high: true },
      { kind: 'click', high: false },
      { kind: 'click', high: true },
    ])
    expect(bpm).toBeCloseTo(90, 9)
    expect(slower.bpm).toBeCloseTo(60, 9)
  })
})

describe('the game', () => {
  it('deals six rounds, each size twice, never the same twice running', () => {
    for (const seed of SEEDS) {
      // Act
      const rounds = dealCountTheBar(mulberry32(seed))
      const order = rounds.map((r) => r.answer)

      // Assert
      expect(rounds).toHaveLength(6)
      for (const size of SIZES)
        expect(order.filter((s) => s === size)).toHaveLength(2)
      for (let i = 1; i < order.length; i++)
        expect(order[i], `seed ${seed}`).not.toBe(order[i - 1])
      for (const r of rounds)
        expect(r.events).toEqual(barClicks(Number(r.answer)))
    }
  })

  it('deals the same six from the same seed', () => {
    expect(barOrder(mulberry32(42))).toEqual(barOrder(mulberry32(42)))
  })

  it('names the bar and the click, never the listener, in lines the claims check passes', () => {
    for (const size of SIZES) {
      const line = BAR_WORDS[size]
      // Assert
      expect(line.startsWith(`Bars of ${size}:`)).toBe(true)
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text: line })
          .violations,
        line,
      ).toEqual([])
      expect(line).not.toMatch(/\byou\b/i)
    }
  })
})
