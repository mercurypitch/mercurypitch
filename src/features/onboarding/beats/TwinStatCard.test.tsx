// ============================================================
// The twin's stat card: the voiceprint in one piece
// ============================================================
//
// Owner testing, 11 Oct 2026: three loose stat boxes wrapped to two rows
// on a phone. One card now, with the singer's glides drawn as a gold
// ridge over a single row of numbers. These tests hold its edge cases:
// a run with no range, a range read that is not clean, a skipped match,
// nothing measured at all, the widest and narrowest ranges, and reduced
// motion.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { MirrorResult, RangeResult, SteadinessResult, } from '@/lib/mirror/metrics'
import { TwinStatCard } from './TwinStatCard'

const range = (
  lowMidi: number,
  highMidi: number,
  lowNote: string,
  highNote: string,
): RangeResult => ({
  lowMidi,
  highMidi,
  lowNote,
  highNote,
  semitones: highMidi - lowMidi,
  qualifyingMidis: [],
  voiceHint: 'Baritone',
})

const steadiness = (score: number): SteadinessResult =>
  ({
    referenceCents: 0,
    referenceNote: 'A3',
    driftCentsPerSec: 0,
    wobbleSdCents: 10,
    vibrato: null,
    score,
    voicedSeconds: 4,
  }) as SteadinessResult

/** A2 to A4, steady, with a good ear: the whole card. */
const RESULT: MirrorResult = {
  range: range(45, 69, 'A2', 'A4'),
  steadiness: steadiness(82),
  accuracy: { score: 74.4, takes: [], scoopMedianMs: null },
}

/** A glide up and back down, as voice-strip.ts hands it over. */
const STRIP = [45.5, 49, 53.2, 57, 60.8, 64.1, 68.5, 66, 61.7, 57.4, 52, 46]

const cells = (): Element[] => [...document.querySelectorAll('[data-stat]')]
const textOf = (selector: string): string[] =>
  cells().map((cell) => cell.querySelector(selector)?.textContent ?? '')

/** How far down the ridge a note's name sits, in percent, as styled. */
const placed = (which: 'high' | 'low'): number => {
  const note = document.querySelector<HTMLElement>(`[data-note="${which}"]`)
  return Number.parseFloat(note?.style.top ?? 'NaN')
}

describe('the twin stat card', () => {
  afterEach(cleanup)

  it('shows the three numbers in one row, each a big number over its label', () => {
    render(() => <TwinStatCard result={RESULT} strip={STRIP} />)

    expect(cells().map((cell) => cell.getAttribute('data-stat'))).toEqual([
      'range',
      'steadiness',
      'accuracy',
    ])
    expect(textOf('[data-value]')).toEqual(['24', '82', '74'])
    expect(textOf('[data-label]')).toEqual([
      'semitones',
      'steadiness',
      'pitch accuracy',
    ])
    expect(
      document.querySelector('[data-stat-row]')?.getAttribute('data-cells'),
    ).toBe('3')
  })

  it("draws the singer's ridge, named at its lowest and highest notes", () => {
    render(() => <TwinStatCard result={RESULT} strip={STRIP} />)

    expect(
      document.querySelector('[data-ridge-line]')?.getAttribute('d'),
    ).toMatch(/^M\d/)
    expect(document.querySelector('[data-note="high"]')?.textContent).toBe('A4')
    expect(document.querySelector('[data-note="low"]')?.textContent).toBe('A2')
    // Each name sits level with the point it names: the top note high,
    // the bottom note low.
    expect(placed('high')).toBeLessThan(20)
    expect(placed('low')).toBeGreaterThan(80)
  })

  it('reads as one group with the range spelled out for a screen reader', () => {
    render(() => <TwinStatCard result={RESULT} strip={STRIP} />)

    const card = screen.getByRole('group', { name: 'Your voiceprint' })
    expect(
      card.querySelector('[data-ridge]')?.getAttribute('aria-hidden'),
    ).toBe('true')
    expect(
      card
        .querySelector('[data-stat="range"]')
        ?.textContent?.replace(/\s+/g, ' '),
    ).toBe('24semitones, from A2 to A4')
  })

  it('leaves the match out when it was skipped', () => {
    render(() => (
      <TwinStatCard result={{ ...RESULT, accuracy: null }} strip={STRIP} />
    ))

    expect(textOf('[data-label]')).toEqual(['semitones', 'steadiness'])
    expect(
      document.querySelector('[data-stat-row]')?.getAttribute('data-cells'),
    ).toBe('2')
  })

  it('has no ridge and no range without a range, and keeps what it has', () => {
    render(() => (
      <TwinStatCard
        result={{ range: null, steadiness: steadiness(61), accuracy: null }}
        strip={null}
      />
    ))

    expect(document.querySelector('[data-ridge]')).toBeNull()
    expect(textOf('[data-value]')).toEqual(['61'])
    expect(textOf('[data-label]')).toEqual(['steadiness'])
  })

  it('draws no ridge, notes or range for a read that is not clean', () => {
    // Arrange: a steady tone reads A3 to A3, 0 semitones, no voice type, and
    // the twin beat above the card says Merc could not read the range.
    const steadyTone: MirrorResult = {
      ...RESULT,
      range: { ...range(57, 57, 'A3', 'A3'), voiceHint: null },
    }

    // Act
    render(() => <TwinStatCard result={steadyTone} strip={[57, 57, 57]} />)

    // Assert: the scores stay; nothing claims a range.
    expect(document.querySelector('[data-ridge]')).toBeNull()
    expect(document.querySelector('[data-note]')).toBeNull()
    expect(document.querySelector('[data-stat="range"]')).toBeNull()
    expect(textOf('[data-label]')).toEqual(['steadiness', 'pitch accuracy'])
  })

  it('shows nothing at all when nothing was measured', () => {
    render(() => (
      <TwinStatCard
        result={{ range: null, steadiness: null, accuracy: null }}
        strip={null}
      />
    ))

    expect(document.querySelector('[data-stat-card]')).toBeNull()
  })

  it("draws the range's own shape when the glides did not come with it", () => {
    render(() => <TwinStatCard result={RESULT} strip={null} />)

    expect(
      document.querySelector('[data-ridge-line]')?.getAttribute('d'),
    ).toMatch(/^M\d/)
    expect(document.querySelector('[data-note="high"]')?.textContent).toBe('A4')
  })

  it('keeps both note names inside the card for the widest and narrowest ranges', () => {
    for (const [low, high, lowNote, highNote, strip] of [
      // Three and a half octaves, ending on the lowest note.
      [36, 78, 'C2', 'F#5', [40, 52, 66, 78, 70, 55, 36]],
      // One semitone, starting on the highest.
      [57, 58, 'A3', 'A#3', [58, 57.6, 57.2, 57]],
    ] as const) {
      render(() => (
        <TwinStatCard
          result={{ ...RESULT, range: range(low, high, lowNote, highNote) }}
          strip={[...strip]}
        />
      ))

      // Inside the ridge's height, and never one on top of the other.
      expect(placed('high')).toBeGreaterThanOrEqual(8)
      expect(placed('low')).toBeLessThanOrEqual(92)
      expect(placed('low') - placed('high')).toBeGreaterThanOrEqual(26)
      expect(textOf('[data-label]')[0]).toBe(
        high - low === 1 ? 'semitone' : 'semitones',
      )
      cleanup()
    }
  })

  it('draws the ridge in one go when motion is reduced', () => {
    // jsdom applies no stylesheet, so this reads the rule itself: under
    // reduced motion nothing on the card animates and the line is whole.
    const css = readFileSync(
      resolve(__dirname, 'TwinStatCard.module.css'),
      'utf8',
    )
    const reduced = css.slice(css.indexOf('prefers-reduced-motion: reduce'))

    expect(reduced).toMatch(/animation:\s*none/)
    expect(reduced).toMatch(/stroke-dashoffset:\s*0/)
    expect(reduced).toMatch(/opacity:\s*1/)
  })
})
