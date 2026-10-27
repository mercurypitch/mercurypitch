// ============================================================
// Lesson 10 four words tests — what each plays, and what each figure lights
// ============================================================
//
// On the page's own markup, its runs recorded (kit/run-recorder.test-
// fixtures.ts): Third, Triad, Quality and Natural minor each play their
// notes in the soft tone, 1.55, 2.85, 3.2 and 4.05 s long (FACTS 74;
// WEB-SPEC, Tests 3); each is the page's one sound, so a word stops the
// sound before it, the cold open's move among them, and a newer sound
// stops the word; each figure lights a part while its note sounds, the
// beads by pitch, Quality's two words chord by chord and Natural minor's
// stairs in turn, and rests once the sound ends or is stopped. Each
// button's name says what it plays (FACTS 74).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { live, resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { initColdOpen } from './cold-open'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import type { WordId } from './sounds'
import { lengthOf, WORD_IDS, wordSounds } from './sounds'
import { initWords } from './words'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercsReady: Promise.resolve(),
  mercListen: vi.fn(),
  mercCelebrate: vi.fn(),
}))

const button = (word: WordId): HTMLButtonElement =>
  el<HTMLButtonElement>(`[data-word-play="${word}"]`)

/** Which of a word's figure's parts are lit, in the markup's order. */
function litParts(word: WordId): boolean[] {
  const stub = el(`[data-word="${word}"] .stub svg`)
  if (word === 'natural-minor')
    return Array.from(stub.querySelectorAll('rect'), (r) =>
      r.hasAttribute('fill-opacity'),
    )
  const parts = stub.querySelectorAll<SVGElement>(
    word === 'quality' ? 'text' : 'circle',
  )
  return Array.from(parts, (p) => p.getAttribute('fill') === '#ffffff')
}

beforeEach(() => {
  localStorage.clear()
  resetRuns()
  soundOn()
  loadPage()
  initWords()
})

afterEach(() => {
  live().forEach((r) => r.end(false))
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 10's four words", () => {
  it('names each button for what it plays (FACTS 74)', () => {
    // Act
    const names = WORD_IDS.map((w) =>
      (button(w).textContent ?? '').replace(/\s+/g, ' ').trim(),
    )

    // Assert
    expect(names).toEqual([
      'Play: C up to E',
      'Play: C, E and G',
      'Play: major, then minor',
      'Play: C natural minor',
    ])
  })

  it.each([
    ['third', 1.55],
    ['triad', 2.85],
    ['quality', 3.2],
    ['natural-minor', 4.05],
  ] as const)(
    'plays %s as its notes in the soft tone, %s s long',
    (word, sec) => {
      // Act
      button(word).click()

      // Assert
      expect(runs.map((r) => r.notes)).toEqual([wordSounds()[word]])
      expect(lengthOf(runs[0].notes)).toBeCloseTo(sec, 9)
      expect(runs[0].o).toMatchObject({ audible: true, kind: 'soft' })
    },
  )

  it("lights Third's beads by pitch while each sounds: C, then E", () => {
    // Arrange
    vi.useFakeTimers()
    button('third').click()

    // Act
    runs[0].note(0)
    const first = litParts('third')
    vi.advanceTimersByTime(600)
    runs[0].note(1)
    const second = litParts('third')
    vi.advanceTimersByTime(800)

    // Assert
    expect([first, second, litParts('third')]).toEqual([
      [true, false],
      [false, true],
      [false, false],
    ])
  })

  it("lights Triad's beads in turn, then all three together", () => {
    // Arrange
    button('triad').click()

    // Act
    runs[0].note(1)
    const e = litParts('triad')
    runs[0].notes.forEach((_, i) => runs[0].note(i))

    // Assert
    expect(e).toEqual([false, true, false])
    expect(litParts('triad')).toEqual([true, true, true])
  })

  it("lights Quality's words as each chord sounds, major then minor, and moves no bead", () => {
    // Arrange
    vi.useFakeTimers()
    button('quality').click()
    const notes = runs[0].notes

    // Act: the major chord, its end, then the minor one
    for (const i of [0, 1, 2]) runs[0].note(i)
    const major = litParts('quality')
    vi.advanceTimersByTime(1400)
    const between = litParts('quality')
    for (const i of [3, 4, 5]) runs[0].note(i)

    // Assert
    expect(notes.map((n) => n.midi)).toEqual([60, 64, 67, 60, 63, 67])
    expect([major, between, litParts('quality')]).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ])
    expect(
      document.querySelectorAll('[data-word="quality"] .stub circle'),
    ).toHaveLength(0)
  })

  it("lights Natural minor's eight stairs in turn, C4 to C5", () => {
    // Arrange
    vi.useFakeTimers()
    button('natural-minor').click()

    // Act: each note, then its length
    const lit = runs[0].notes.map((n, i) => {
      runs[0].note(i)
      const on = litParts('natural-minor')
      vi.advanceTimersByTime(n.dur * 1000)
      return on.flatMap((l, k) => (l ? [k] : []))
    })

    // Assert
    expect(runs[0].notes.map((n) => n.midi)).toEqual([
      60, 62, 63, 65, 67, 68, 70, 72,
    ])
    expect(lit).toEqual([[0], [1], [2], [3], [4], [5], [6], [7]])
    expect(litParts('natural-minor').includes(true)).toBe(false)
  })

  it('rests every figure once its sound ends, heard or cut short', async () => {
    // Arrange
    button('triad').click()
    runs[0].notes.forEach((_, i) => runs[0].note(i))
    button('natural-minor').click()
    runs[1].note(3)

    // Act
    runs[0].end(true)
    runs[1].end(false)
    await settle()

    // Assert
    expect(litParts('triad')).toEqual([false, false, false])
    expect(litParts('natural-minor').includes(true)).toBe(false)
  })

  it("stops the cold open's move as it plays, and a newer sound stops the word", async () => {
    // Arrange: the cold open on the same page, a choice and mi's move playing
    initColdOpen()
    el('#predict [data-choice="mi"]').click()
    el('.hero-plays [data-play="move-mi"]').click()
    const move = live()

    // Act
    button('quality').click()
    const word = runs[runs.length - 1]
    runs[runs.length - 1].note(0)
    await settle()
    const stoppedMove = move.every((r) => r.stopped)
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(stoppedMove).toBe(true)
    expect(word.stopped).toBe(true)
    expect(litParts('quality')).toEqual([false, false])
    expect(button('quality').classList.contains('is-on')).toBe(false)
  })
})
