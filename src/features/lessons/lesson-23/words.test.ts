// ============================================================
// Lesson 23 four words tests — each figure a small staff, written as it sounds, one sound
// ============================================================
//
// On the page's own markup (WEB-SPEC, Toys 4; FACTS 69): each ticket's
// figure is a small staff in the learner's clef with nothing written
// before a play; each play sounds its pairs, Lesson 6's, in the learner's
// octave, writing the notes as they sound, lit in the singer's colour, with
// Number's "3 letters" and Quality's "major" and "minor" under their
// pairs; Inversion turns a third over, never the fifth; no figure draws a
// pitch line or counts a semitone; the figures follow Sing it's voice
// choice; and every play is the page's one sound.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { initWords, WORD_IDS, WORD_PAIRS, wordNotes } from './words'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  loadPage()
  resetRuns()
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const fig = (w: string): SVGSVGElement =>
  el<SVGSVGElement>(`[data-word-fig="${w}"]`)
const count = (w: string, sel: string): number =>
  fig(w).querySelectorAll(sel).length
const press = (w: string): void =>
  el<HTMLButtonElement>(`[data-word-play="${w}"]`).click()
const caption = (w: string): string =>
  words(fig(w).querySelector('.wf-caption'))
/** Starts every note of the last run, as its timers would. */
const sound = (): void => {
  const r = runs[runs.length - 1]
  r.notes.forEach((_n, i) => r.note(i))
}

describe('the four figures', () => {
  it("draws each word as a small staff in the learner's clef, nothing written before a play", () => {
    // Act
    initWords()

    // Assert: the bass clef with no voice stored (FACTS 8)
    for (const w of WORD_IDS) {
      expect(count(w, '.st-line'), w).toBe(5)
      expect(count(w, '.st-clef'), w).toBe(1)
      expect(count(w, '.st-head'), w).toBe(0)
    }
  })

  it('draws no pitch line and counts no semitone in any figure (FACTS 1a)', () => {
    // Arrange
    initWords()

    for (const w of WORD_IDS) {
      // Act
      press(w)
      sound()

      // Assert
      expect(count(w, '.st-lane, .iv-lane'), w).toBe(0)
      expect(fig(w).textContent ?? '', w).not.toMatch(/semitone/)
    }
  })
})

describe('the four plays', () => {
  it("play each word's pairs as Lesson 6's, two of them 0.5 s apart, in the learner's octave", () => {
    // Arrange
    initWords()

    for (const w of WORD_IDS) {
      // Act
      press(w)
      const r = runs[runs.length - 1]

      // Assert: FACTS 69, on the bass staff an octave down
      expect(
        r.notes.map((n) => [n.t, n.midi, n.dur]),
        w,
      ).toEqual(
        wordNotes(WORD_PAIRS[w], 'bass').map((n) => [n.t, n.midi, n.dur]),
      )
    }
    expect(wordNotes(WORD_PAIRS.number, 'bass').map((n) => n.midi)).toEqual([
      48, 52,
    ])
    expect(
      wordNotes(WORD_PAIRS.quality, 'treble').map((n) => [n.t, n.midi]),
    ).toEqual([
      [0, 60],
      [0.75, 64],
      [2.05, 60],
      [2.8, 63],
    ])
  })

  it('turns a third over in Inversion, never the fifth, so no figure splits the octave at G (FACTS 1a)', () => {
    // Assert
    expect(
      wordNotes(WORD_PAIRS.inversion, 'treble').map((n) => n.midi),
    ).toEqual([60, 64, 64, 72])
    for (const w of WORD_IDS)
      if (w !== 'perfect')
        expect(
          wordNotes(WORD_PAIRS[w], 'treble').map((n) => n.midi),
          w,
        ).not.toContain(67)
  })

  it("writes Number's two notes as they sound, lit in the singer's colour, then '3 letters' under them", () => {
    // Arrange
    initWords()

    // Act
    press('number')
    const r = runs[0]
    r.note(0)
    const first = [count('number', '.st-head'), caption('number')]
    r.note(1)

    // Assert
    expect(first).toEqual([1, ''])
    expect(count('number', '.st-head')).toBe(2)
    expect(count('number', '.st-head.is-blue')).toBe(1)
    expect(caption('number')).toBe('3 letters')
  })

  it("writes Quality's minor third over its major one, 'minor' then under it", () => {
    // Arrange
    initWords()

    // Act
    press('quality')
    const r = runs[0]
    r.note(0)
    r.note(1)
    const major = caption('quality')
    r.note(2)
    r.note(3)

    // Assert
    expect(major).toBe('major')
    expect(caption('quality')).toBe('minor')
    expect(count('quality', '.st-head')).toBe(2)
    expect(count('quality', '.st-sign')).toBe(1)
  })

  it('keeps the last pair written, at rest, once the play ends', async () => {
    // Arrange
    initWords()

    // Act
    press('perfect')
    sound()
    runs[0].end(true)
    await settle()

    // Assert
    expect(count('perfect', '.st-head')).toBe(2)
    expect(count('perfect', '.st-head.is-blue')).toBe(0)
  })

  it("is the page's one sound: a newer sound stops it", () => {
    // Arrange
    initWords()
    press('number')

    // Act
    NowPlaying.claim(() => undefined)

    // Assert
    expect(runs[0].stopped).toBe(true)
  })
})

describe("the learner's staff", () => {
  it("follows Sing it's choice of the higher voice, the treble staff written afresh", async () => {
    // Arrange
    initWords()
    press('number')
    sound()

    // Act
    VoiceChoice.set('higher')
    await settle()

    // Assert: written as it sounds, the treble an octave up
    expect(runs[0].stopped).toBe(true)
    expect(count('number', '.st-head')).toBe(0)
    press('number')
    expect(runs[runs.length - 1].notes.map((n) => n.midi)).toEqual([60, 64])
  })
})
