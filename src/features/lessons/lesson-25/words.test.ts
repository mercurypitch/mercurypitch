// ============================================================
// Lesson 25 four words tests — four small staircases, each lit as its scale plays
// ============================================================
//
// FACTS 60 and the WEB-SPEC's Toys 4: natural, harmonic and melodic minor
// and relative keys, each the steps' own figure in the learner's octave,
// the soft tone a note every 0.4 s, each 0.35 s: 3.15, 3.15, 5.95 and 6.8
// s; harmonic minor's te lifting to ti before ti sounds, melodic minor's
// le and te lifting going up and settling coming down, and relative keys'
// house gliding from C down to A, where it stays. No chord, no two notes
// at once. On the page's markup, each play is the page's one sound, its
// line said once heard, and the figures follow the learner's voice.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { HARMONIC_MINOR_DEGREES, MELODIC_MINOR_UP_DEGREES, NATURAL_MINOR_DEGREES, } from '@/features/lessons/kit/chords'
import { MAJOR_DEGREES } from '@/features/lessons/kit/major-scale'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import type { Word } from './words'
import { initWords, wordLength, wordPlay, WORDS } from './words'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  soundOn()
  loadPage()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.textContent = ''
})

describe("the four words' plays", () => {
  it.each([
    ['natural', 3.15],
    ['harmonic', 3.15],
    ['melodic', 5.95],
    ['relative', 6.8],
  ] as const)('times %s at %f s (FACTS 60)', (word, sec) => {
    expect(wordLength(wordPlay(word, 'bass'))).toBeCloseTo(sec, 9)
  })

  it('plays each scale in the learner’s octave, A2 to A3 or A3 to A4, one note at a time', () => {
    // Act
    const lower = wordPlay('harmonic', 'bass').events.map((e) => e.midi)
    const higher = wordPlay('harmonic', 'treble').events.map((e) => e.midi)

    // Assert
    expect(lower).toEqual([45, 47, 48, 50, 52, 53, 56, 57])
    expect(higher).toEqual([57, 59, 60, 62, 64, 65, 68, 69])
    for (const w of WORDS) {
      const at = wordPlay(w, 'bass').events.map((e) => e.at)
      expect(new Set(at).size).toBe(at.length)
    }
  })

  it('lifts harmonic minor’s te as the play starts, and melodic minor’s le and te going up only (FACTS 12, 13)', () => {
    // Act
    const harmonic = wordPlay('harmonic', 'bass')
    const melodic = wordPlay('melodic', 'bass')

    // Assert: both stand on natural minor before their play
    expect(harmonic.from.degrees).toEqual(NATURAL_MINOR_DEGREES)
    expect(harmonic.moves.map((m) => [m.at, m.look.degrees])).toEqual([
      [0, HARMONIC_MINOR_DEGREES],
    ])
    expect(melodic.moves.map((m) => [m.at, m.look.degrees])).toEqual([
      [0, MELODIC_MINOR_UP_DEGREES],
      [3.2, NATURAL_MINOR_DEGREES],
    ])
    // coming down, G and F on te's and le's stairs
    expect(melodic.events.slice(8).map((e) => [e.midi, e.stair])).toEqual([
      [55, 6],
      [53, 5],
      [52, 4],
      [50, 3],
      [48, 2],
      [47, 1],
      [45, 0],
    ])
  })

  it('plays C major, then A minor, the house gliding from C down to A as A minor starts (FACTS 22, 60)', () => {
    // Act
    const p = wordPlay('relative', 'treble')

    // Assert
    expect(p.from).toEqual({ degrees: MAJOR_DEGREES, tonic: 60 })
    expect(p.events.map((e) => e.midi)).toEqual([
      60, 62, 64, 65, 67, 69, 71, 72, 57, 59, 60, 62, 64, 65, 67, 69,
    ])
    expect(p.moves.map((m) => [m.at, m.look])).toEqual([
      [0, { degrees: MAJOR_DEGREES, tonic: 60 }],
      [3.65, { degrees: NATURAL_MINOR_DEGREES, tonic: 57 }],
    ])
    expect(p.events.slice(8).map((e) => e.stair)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ])
  })
})

describe('the four words on the page', () => {
  const button = (w: Word): HTMLButtonElement =>
    el<HTMLButtonElement>(`#words [data-word-play="${w}"]`)
  const said = (): string => words(el('#words [data-words-said]'))

  it('lights the harmonic minor figure as it plays, te lifted, then settles and says the scale once heard', async () => {
    // Arrange
    const w = initWords()
    const play = vi.spyOn(w.stairs.harmonic, 'play')

    // Act
    button('harmonic').click()
    await settle()
    vi.advanceTimersByTime(10)
    const lifted = w.stairs.harmonic.degrees
    const lit = button('harmonic').classList.contains('is-on')
    vi.advanceTimersByTime(3200)
    await settle()

    // Assert
    expect(play).toHaveBeenCalledTimes(1)
    expect(lit).toBe(true)
    expect(lifted).toEqual(HARMONIC_MINOR_DEGREES)
    expect(w.stairs.harmonic.degrees).toEqual(NATURAL_MINOR_DEGREES)
    expect(said()).toBe(
      'A harmonic minor, do to do: A, B, C, D, E, F, G sharp, A. Steps of 2, 1, 2, 2, 1, 3 and 1 semitones.',
    )
    expect(button('harmonic').classList.contains('is-on')).toBe(false)
  })

  it('stops a word for another sound on the page, saying nothing and settling its stairs', async () => {
    // Arrange
    const w = initWords()
    button('melodic').click()
    await settle()
    vi.advanceTimersByTime(10)

    // Act
    NowPlaying.claim(() => undefined)
    await settle()
    vi.advanceTimersByTime(6000)
    await settle()

    // Assert: WEB-SPEC, Audio, rule 1
    expect(button('melodic').classList.contains('is-on')).toBe(false)
    expect(said()).toBe('')
    expect(w.stairs.melodic.degrees).toEqual(NATURAL_MINOR_DEGREES)
  })

  it('leaves Relative keys on A minor after its play, and moves every figure an octave with the voice', async () => {
    // Arrange
    const w = initWords()

    // Act
    button('relative').click()
    await settle()
    vi.advanceTimersByTime(7000)
    await settle()
    const after = [w.stairs.relative.tonic, w.stairs.relative.degrees]
    w.setClef('treble')

    // Assert
    expect(after).toEqual([45, NATURAL_MINOR_DEGREES])
    expect(WORDS.map((x) => w.stairs[x].tonic)).toEqual([57, 57, 57, 60])
  })
})
