// ============================================================
// Lesson 27 words tests — three words, their notes, their timing and their staffs
// ============================================================
//
// The WEB-SPEC's Toys 4 and Tests 11: Seventh chord, Major seventh and
// Minor seventh, each on C, none built on G; C, E, G and B a note every
// 0.4 s and then together for 1.2 s, 2.8 s, the chord at 0.056 a voice;
// Lesson 6's pair for the two sevenths, C up to B and C up to B flat; the
// higher voice from C4 and the lower from C3 (FACTS 41, 72).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signName } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { writtenOf } from '@/features/lessons/kit/staff-places'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import type { WordNote } from './words'
import { initWords, WORD_IDS, wordNotes, wordSaid } from './words'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

/** A word's notes as written, each with its onset and length: "0+0.4 C4". */
const heard = (notes: readonly WordNote[]): string[] =>
  notes.map((n) => `${n.t}+${n.dur} ${signName(writtenOf(n.midi))}`)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  loadPage()
  soundOn()
  resetRuns()
})

afterEach(() => {
  // a newer sound stops what the test started, before its timers are real again
  NowPlaying.claim(() => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe('the three words', () => {
  it('plays C, E, G and B a note every 0.4 s, then together for 1.2 s at 0.056 a voice, 2.8 s (FACTS 41, 73)', () => {
    // Act
    const notes = wordNotes('seventh', 'treble')

    // Assert
    expect(heard(notes)).toEqual([
      '0+0.4 C4',
      '0.4+0.4 E4',
      '0.8+0.4 G4',
      '1.2+0.4 B4',
      '1.6+1.2 C4',
      '1.6+1.2 E4',
      '1.6+1.2 G4',
      '1.6+1.2 B4',
    ])
    expect(notes.slice(4).every((n) => n.gain === 0.056)).toBe(true)
    expect(notes.slice(0, 4).every((n) => n.gain === undefined)).toBe(true)
    expect(Math.max(...notes.map((n) => n.t + n.dur))).toBeCloseTo(2.8, 9)
  })

  it('plays the two sevenths as Lesson 6’s pair, from C4 for the higher voice and C3 for the lower', () => {
    // Assert
    expect(heard(wordNotes('major', 'treble'))).toEqual([
      '0+0.6 C4',
      '0.75+0.8 B4',
    ])
    expect(heard(wordNotes('minor', 'bass'))).toEqual([
      '0+0.6 C3',
      '0.75+0.8 A♯3',
    ])
    // B flat is written as a flat
    expect(signName(wordNotes('minor', 'treble')[1].written)).toBe('B♭4')
    expect(wordSaid('minor', 'treble')).toBe('C up to B flat.')
    expect(wordSaid('seventh', 'bass')).toBe(
      'C, E, G and B, one by one, then together.',
    )
  })

  it('builds no word on G (FACTS 1a, 41)', () => {
    // Assert
    for (const w of WORD_IDS)
      expect(wordNotes(w, 'treble')[0].written.letter).toBe('C')
  })

  it('writes the arpeggio into one column of the word’s staff, and says it once heard', async () => {
    // Arrange
    initWords()

    // Act
    el<HTMLButtonElement>('[data-word-play="seventh"]').click()
    await settle()
    const r = runs[runs.length - 1]
    for (let i = 0; i < 4; i++) r.note(i)
    const fig = el('[data-word-fig="seventh"]')
    const cols = new Set(
      Array.from(fig.querySelectorAll('.st-head'), (h) =>
        h.getAttribute('transform')?.replace(/ .*/, ''),
      ),
    )
    r.end(true)
    await settle()

    // Assert: four heads, one column, the lower voice's C3 to B3
    expect(fig.querySelectorAll('.st-head')).toHaveLength(4)
    expect(cols.size).toBe(1)
    expect(words(el('[data-words-said]'))).toBe(
      'C, E, G and B, one by one, then together.',
    )
  })
})
