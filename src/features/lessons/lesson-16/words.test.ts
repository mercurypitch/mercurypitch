// ============================================================
// Lesson 16 three words tests — their figures, plays and voices
// ============================================================
//
// The plays, pure: each word's notes in each clef's octave and its length,
// Sight-singing's do in the soft tone before the voice sings do to so
// (FACTS 1a, 67). Then on the page's own markup, with the kit's runs a
// recorder and the browser's clock a fake one: each figure a small staff
// in the learner's clef, the bass when no voice is stored, its notes
// resting; a play lights its notes as they sound, Audiation's re through
// its silent beat; a chosen higher voice redraws every figure on the
// treble staff and names Tavi as Sight-singing's singer; and a word is the
// page's one sound (WEB-SPEC, Toys 4).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { initWords, playLength, WORD_IDS, wordPlay } from './words'

/** Do, G, in each clef's octave, MIDI: G3 and G4. */
const DO_MIDI = { bass: 55, treble: 67 } as const

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
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const fig = (w: string): SVGSVGElement =>
  el<SVGSVGElement>(`[data-word-fig="${w}"]`)
const count = (w: string, sel: string): number =>
  fig(w).querySelectorAll(sel).length
const button = (w: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`[data-word-play="${w}"]`)
/** A play's notes as [onset, MIDI note, length, tone]. */
const heard = (w: (typeof WORD_IDS)[number], clef: 'bass' | 'treble') =>
  wordPlay(w, clef).notes.map((n) => [n.t, n.midi, n.dur, n.kind ?? null])

/** Whether `notes` (MIDI) sound `line` in a row, in any octave. */
const soundsLine = (notes: readonly number[], line: readonly number[]) =>
  [-24, -12, 0, 12, 24].some((shift) =>
    notes
      .map((_, i) => notes.slice(i, i + line.length).join(' '))
      .includes(line.map((m) => m + shift).join(' ')),
  )

describe('the three plays', () => {
  it('give Sight-singing do alone in the soft tone, then do to so sung, 4.4 s, in the bass octave', () => {
    // Assert: FACTS 67, so no voice sings a written note before its note is heard
    expect(heard('sight', 'bass')).toEqual([
      [0, 55, 1, 'soft'],
      [1.4, 55, 0.6, null],
      [2, 57, 0.6, null],
      [2.6, 59, 0.6, null],
      [3.2, 60, 0.6, null],
      [3.8, 62, 0.6, null],
    ])
    expect(wordPlay('sight', 'bass').kind).toBe('merc')
  })

  it('give Tonic triad do, mi, so and Audiation do, a silent beat, then re, both in the soft tone', () => {
    // Assert: FACTS 67
    expect(heard('triad', 'bass')).toEqual([
      [0, 55, 0.5, null],
      [0.6, 59, 0.5, null],
      [1.2, 62, 0.5, null],
    ])
    expect(heard('audiation', 'bass')).toEqual([
      [0, 55, 0.6, null],
      [1.6, 57, 0.6, null],
    ])
    expect([
      wordPlay('triad', 'bass').kind,
      wordPlay('audiation', 'bass').kind,
    ]).toEqual(['soft', 'soft'])
  })

  it('last 4.4, 1.7 and 2.2 s, an octave up on the treble staff', () => {
    // Assert
    expect(WORD_IDS.map((w) => playLength(wordPlay(w, 'bass')))).toEqual([
      4.4, 1.7, 2.2,
    ])
    expect(WORD_IDS.map((w) => playLength(wordPlay(w, 'treble')))).toEqual([
      4.4, 1.7, 2.2,
    ])
    expect(heard('triad', 'treble').map(([, m]) => m)).toEqual([67, 71, 74])
  })
})

describe('the three figures', () => {
  it('draw each word on a small bass staff before a voice is chosen, its notes resting', () => {
    // Act
    initWords()

    // Assert: C4 on a ledger line over the bass staff, and D4 above it, a
    // short ledger under each
    expect(WORD_IDS.map((w) => count(w, '.st-head'))).toEqual([5, 3, 2])
    expect(WORD_IDS.map((w) => count(w, '.st-clef'))).toEqual([1, 1, 1])
    expect(WORD_IDS.map((w) => count(w, '.st-ledger'))).toEqual([2, 1, 0])
    expect(WORD_IDS.map((w) => count(w, '.st-head.is-lit'))).toEqual([0, 0, 0])
    expect(words(button('sight'))).toBe(
      'Play: do first, then Merc sings do to so',
    )
  })

  it('light each note as it sounds and put it out after, Sight-singing’s do lit alone first', async () => {
    // Arrange
    vi.useFakeTimers()
    initWords()

    // Act
    button('sight').click()
    vi.advanceTimersByTime(500)
    const alone = count('sight', '.st-head.is-lit')
    vi.advanceTimersByTime(700)
    const quiet = count('sight', '.st-head.is-lit')
    vi.advanceTimersByTime(1000)
    const sung = count('sight', '.st-head.is-lit')
    vi.advanceTimersByTime(2300)
    runs[0].end(true)
    await settle()

    // Assert
    expect([alone, quiet, sung]).toEqual([1, 0, 1])
    expect(count('sight', '.st-head.is-lit')).toBe(0)
    expect(button('sight').classList.contains('is-on')).toBe(false)
  })

  it("light Audiation's re through the silent beat, before it sounds", () => {
    // Arrange
    vi.useFakeTimers()
    initWords()
    const [, re] = Array.from(fig('audiation').querySelectorAll('.st-head'))

    // Act
    button('audiation').click()
    vi.advanceTimersByTime(1000)

    // Assert: 1.0 s in, nothing sounds and re is lit
    const lit = fig('audiation').querySelectorAll('.st-head.is-lit')
    expect(lit).toHaveLength(1)
    expect(lit[0].getAttribute('cx')).toBe(re.getAttribute('cx'))
  })

  it('stop at once for a newer sound, the figure put out', () => {
    // Arrange
    vi.useFakeTimers()
    initWords()
    button('triad').click()
    vi.advanceTimersByTime(100)

    // Act
    NowPlaying.claim(() => undefined)

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(count('triad', '.st-head.is-lit')).toBe(0)
    expect(button('triad').classList.contains('is-on')).toBe(false)
  })

  it('run silent with sound off, still lighting their notes', () => {
    // Arrange
    vi.useFakeTimers()
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    initWords()

    // Act
    button('triad').click()
    vi.advanceTimersByTime(100)

    // Assert
    expect(runs[0].o.audible).toBe(false)
    expect(count('triad', '.st-head.is-lit')).toBe(1)
  })

  it('move to the treble staff once the higher voice is chosen, and name Tavi as the singer', () => {
    // Arrange
    initWords()
    const bass = fig('triad').innerHTML

    // Act
    VoiceChoice.set('higher')
    button('triad').click()

    // Assert: FACTS 67
    expect(fig('triad').innerHTML).not.toBe(bass)
    expect(WORD_IDS.map((w) => count(w, '.st-ledger'))).toEqual([0, 0, 0])
    expect(runs[0].notes.map((n) => n.midi)).toEqual([67, 71, 74])
    expect(words(button('sight'))).toBe(
      'Play: do first, then Tavi sings do to so',
    )
  })
})

describe('the second phrase, never heard in a word', () => {
  it('sounds G, D, B, A, G in no word’s play, in either clef', () => {
    for (const clef of ['bass', 'treble'] as const) {
      // Arrange: do, so, mi, re, do in the clef's octave
      const [g, a, b, , d] = [0, 2, 4, 5, 7].map((s) => DO_MIDI[clef] + s)
      const second = [g, d, b, a, g]

      for (const w of WORD_IDS) {
        // Act
        const notes = wordPlay(w, clef).notes.map((n) => n.midi)

        // Assert: FACTS 43, WEB-SPEC Tests 9
        expect(soundsLine(notes, second), `${w} in the ${clef}`).toBe(false)
      }
    }
  })
})
