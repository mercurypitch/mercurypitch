// ============================================================
// Lesson 2 sing it tests — four lanes and Merc's path, in the page spelling
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { Names } from '@/features/lessons/kit/names'
import { pathLength, pitchAt } from '@/features/lessons/kit/slide-guide'
import { guideLabel, slideLanes, slidePath } from './sing'

/** A label as the eye reads it: the signs shown, the spoken words dropped. */
const seen = (html: string): string =>
  html
    .replace(/<span class="sr">[^<]*<\/span>/g, '')
    .replace(/<br \/>/g, '/')
    .replace(/<[^>]+>/g, '')

afterEach(() => Names.set('sharps'))

describe('slidePath', () => {
  it("is Merc's slide: A held, up one lane, held, and back, in 4.2 s (FACTS 50)", () => {
    const path = slidePath(57)
    expect(pathLength(path)).toBe(4.2)
    expect(pitchAt(path, 0.6)).toBe(57)
    expect(pitchAt(path, 2.2)).toBe(58)
    expect(pitchAt(path, 4.2)).toBe(57)
    expect(Math.max(...slidePath(69).map((p) => p.midi))).toBe(70)
  })
})

describe('slideLanes', () => {
  it('runs G♯, A, A♯ and B, the two the path skips drawn faint', () => {
    const lanes = slideLanes(57)
    expect(lanes.map((l) => l.midi).sort((a, b) => a - b)).toEqual([
      56, 57, 58, 59,
    ])
    expect(
      lanes
        .filter((l) => l.faint === true)
        .map((l) => l.midi)
        .sort(),
    ).toEqual([56, 59])
    expect(lanes.map((l) => seen(l.label))).toEqual(['B3', 'A♯3', 'A3', 'G♯3'])
  })

  it('names the lanes in the page spelling, stacked in Both, an octave up for the octave-up slide', () => {
    Names.set('flats')
    expect(slideLanes(69).map((l) => seen(l.label))).toEqual([
      'B4',
      'B♭4',
      'A4',
      'A♭4',
    ])
    Names.set('both')
    expect(seen(slideLanes(57)[1].label)).toBe('A♯3/B♭3')
  })
})

describe('guideLabel', () => {
  it('says the lanes and the path in words', () => {
    expect(guideLabel(57)).toBe(
      "Four rows, G sharp 3, A3, A sharp 3 and B3, pitch as height, with Merc's path: A3 held, up one row to A sharp 3, held, and back to A3.",
    )
    Names.set('both')
    expect(guideLabel(57)).toContain('A sharp 3 or B flat 3')
  })
})
