// ============================================================
// Lesson 12 four words tests — what each plays, and the corners each lights
// ============================================================
//
// On the page's own markup, its runs recorded (kit/run-recorder.test-
// fixtures.ts): Diatonic, Roman numeral, Diminished and Augmented each
// play their notes in the soft tone, 4.8, 2.7, 2.7 and 2.7 s long (FACTS
// 70; WEB-SPEC, Toys 4 and Tests 5); each is the page's one sound, so a
// word stops the sound before it, the cold open's four chords among them,
// and a newer sound stops the word; each figure lights the corners of the
// chord sounding, Roman numeral's I and then V each in its own ring, and
// rests once the sound ends or is stopped. Each button is named for what
// it plays, in words only: "I, then V" is "chord one, then chord five".

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { live, resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { initColdOpen } from './cold-open'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { lengthOf, WORD_SOUNDS } from './sounds'
import type { WordId } from './words'
import { initWords, WORD_BEADS, WORD_IDS } from './words'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercsReady: Promise.resolve(),
  mercListen: vi.fn(),
  mercSing: vi.fn(),
  mercCelebrate: vi.fn(),
}))

const button = (word: WordId): HTMLButtonElement =>
  el<HTMLButtonElement>(`[data-word-play="${word}"]`)

/** Which of a figure's full beads are lit, in the markup's order. */
const lit = (word: WordId): number[] =>
  Array.from(
    el(`[data-word="${word}"] .stub svg`).querySelectorAll<SVGElement>(
      'g[fill="#c3ccd6"]:not([fill-opacity]) circle',
    ),
  ).flatMap((b, i) => (b.getAttribute('fill') === '#ffffff' ? [i] : []))

/** A button's name as a screen reader hears it: the shown signs and numerals dropped. */
const spokenName = (b: HTMLElement): string => {
  const copy = b.cloneNode(true) as HTMLElement
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

beforeEach(() => {
  localStorage.clear()
  resetRuns()
  soundOn()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  loadPage()
  initWords()
})

afterEach(() => {
  NowPlaying.claim(() => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 12's four words", () => {
  it.each([
    ['diatonic', 4.8],
    ['numeral', 2.7],
    ['diminished', 2.7],
    ['augmented', 2.7],
  ] as const)('plays %s in the soft tone, %f s long', async (word, seconds) => {
    // Act
    button(word).click()
    await settle()

    // Assert: FACTS 70
    expect(runs).toHaveLength(1)
    expect(runs[0].notes).toEqual(WORD_SOUNDS[word])
    expect(runs[0].o).toMatchObject({ audible: true, kind: 'soft' })
    expect(lengthOf(runs[0].notes)).toBeCloseTo(seconds, 6)
  })

  it('names each button for what it plays, in words: "chord one, then chord five"', () => {
    // Act
    const names = WORD_IDS.map((w) => spokenName(button(w)))

    // Assert: FACTS 70; WEB-SPEC, Toys 4
    expect(names).toEqual([
      "Play: C major's seven chords",
      'Play: chord one, then chord five',
      'Play: B, D and F',
      'Play: C, E and G sharp',
    ])
    for (const name of names) expect(name).not.toMatch(/[♯♭]|\b[IV]+\b/)
  })

  it("lights each chord's three corners in turn as Diatonic plays, and rests at its end", async () => {
    // Arrange
    button('diatonic').click()
    await settle()

    // Act
    const seen: number[][] = []
    for (let chord = 0; chord < 7; chord++) {
      for (let v = 0; v < 3; v++) runs[0].note(chord * 3 + v)
      seen.push(lit('diatonic'))
      vi.advanceTimersByTime(600)
    }
    runs[0].end(true)
    await settle()

    // Assert: C E G, D F A, ... B D F, by the beads A, B, C, D, E, F, G
    expect(seen).toEqual([
      [2, 4, 6],
      [0, 3, 5],
      [1, 4, 6],
      [0, 2, 5],
      [1, 3, 6],
      [0, 2, 4],
      [1, 3, 5],
    ])
    expect(lit('diatonic')).toEqual([])
  })

  it("lights I's room in the first ring, then V's in the second", async () => {
    // Arrange
    button('numeral').click()
    await settle()

    // Act
    for (const i of [0, 1, 2]) runs[0].note(i)
    const one = lit('numeral')
    vi.advanceTimersByTime(1500)
    for (const i of [3, 4, 5]) runs[0].note(i)
    const five = lit('numeral')

    // Assert
    expect(one).toEqual([0, 1, 2])
    expect(five).toEqual([3, 4, 5])
  })

  it.each(['diminished', 'augmented'] as const)(
    "lights %s's corners one by one, then all three together",
    async (word) => {
      // Arrange
      button(word).click()
      await settle()

      // Act
      const seen: number[][] = []
      for (const i of [0, 1, 2]) {
        runs[0].note(i)
        seen.push(lit(word))
        vi.advanceTimersByTime(500)
      }
      for (const i of [3, 4, 5]) runs[0].note(i)
      seen.push(lit(word))

      // Assert
      expect(WORD_BEADS[word]).toHaveLength(3)
      expect(seen).toEqual([[0], [1], [2], [0, 1, 2]])
    },
  )

  it("claims the page's one sound: a word stops the cold open's four chords, and a newer sound stops the word", async () => {
    // Arrange
    initColdOpen({ subscribe: () => () => undefined })
    el('.hero-plays [data-play="loop-c"]').click()
    await settle()

    // Act
    button('augmented').click()
    await settle()
    const chordsStopped = runs[0].stopped
    runs[1].note(0)
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(chordsStopped).toBe(true)
    expect(runs[1].stopped).toBe(true)
    expect(live()).toEqual([])
    expect(lit('augmented')).toEqual([])
    expect(button('augmented').classList.contains('is-on')).toBe(false)
  })
})
