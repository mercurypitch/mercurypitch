// ============================================================
// Lesson 28 three words tests — Cadence, Section, Form
// ============================================================
//
// The WEB-SPEC's Toys 4 and FACTS 47, on the page's own markup with the
// kit's runs a recorder: Cadence plays bars 3 and 4, both parts, 6.67 s,
// its two bars lighting on the small strip, Tavi's row over Merc's, and
// says what was heard only when heard to its end; Section has no play;
// Form's Show the letters fades the four letters in and plays nothing.
// None sounds bar 8.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { A, BAR_SEC, barsOf, bothNotes } from './song'
import { initWords, WORD_SAID } from './words'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  loadPage()
  soundOn()
  resetRuns()
})

afterEach(() => {
  NowPlaying.claim(() => undefined)
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const lastRun = () => runs[runs.length - 1]
const said = (): string => words(el('[data-words-said]'))
/** The cadence strip's boxes, bar 3's Tavi and Merc, then bar 4's. */
const boxes = (): Element[] =>
  Array.from(document.querySelectorAll('[data-word-fig="cadence"] .w-box'))
/** The lit boxes, by their place in `boxes`. */
const lit = (): number[] =>
  boxes().flatMap((b, i) => (b.classList.contains('is-lit') ? [i] : []))

describe('Cadence', () => {
  it('plays bars 3 and 4, both parts, 6.67 s, and never bar 8 (FACTS 47)', async () => {
    // Act
    initWords()
    el<HTMLButtonElement>('[data-word-play="cadence"]').click()
    await settle()

    // Assert
    expect(lastRun().notes).toEqual(bothNotes(barsOf(A, 3, 4)))
    const end = Math.max(...lastRun().notes.map((n) => n.t + n.dur))
    expect(end).toBeCloseTo(2 * BAR_SEC, 6)
  })

  it("lights each bar's pair of boxes as it sounds, Tavi's over Merc's, and says what was heard", async () => {
    // Arrange
    initWords()
    el<HTMLButtonElement>('[data-word-play="cadence"]').click()
    await settle()
    const bar4 = lastRun().notes.findIndex((n) => n.t >= BAR_SEC - 1e-6)

    // Act
    lastRun().note(0)
    const first = lit()
    lastRun().note(bar4)
    const second = lit()
    lastRun().end(true)
    await settle()

    // Assert
    expect(boxes().map((b) => b.getAttribute('class'))).toEqual([
      'w-box w-tavi',
      'w-box w-merc',
      'w-box w-tavi',
      'w-box w-merc',
    ])
    expect(first).toEqual([0, 1])
    expect(second).toEqual([2, 3])
    expect(lit()).toEqual([])
    expect(said()).toBe(WORD_SAID.cadence)
  })

  it('says nothing when another sound cuts it short', async () => {
    // Arrange
    initWords()
    el<HTMLButtonElement>('[data-word-play="cadence"]').click()
    await settle()

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(lastRun().stopped).toBe(true)
    expect(said()).toBe('')
    expect(lit()).toEqual([])
  })
})

describe('Section and Form', () => {
  it('gives Section a still of eight bars under one bracket, and no play', () => {
    initWords()
    const fig = el('[data-word-fig="section"]')
    expect(fig.querySelectorAll('.w-box')).toHaveLength(8)
    expect(fig.querySelectorAll('.w-bracket')).toHaveLength(1)
    expect(
      el('[data-word="section"]').querySelector('[data-word-play]'),
    ).toBeNull()
  })

  it('fades the letters A A B A in at Show the letters, and plays nothing', () => {
    // Arrange
    initWords()
    const letters = () =>
      Array.from(document.querySelectorAll('[data-word-fig="form"] .w-letter'))
    const hiddenBefore = letters().every((l) =>
      l.classList.contains('is-hidden'),
    )

    // Act
    el<HTMLButtonElement>('[data-word-show="form"]').click()

    // Assert
    expect(hiddenBefore).toBe(true)
    expect(
      letters()
        .map((l) => l.textContent)
        .join(' '),
    ).toBe('A A B A')
    expect(letters().some((l) => l.classList.contains('is-hidden'))).toBe(false)
    expect(said()).toBe(WORD_SAID.form)
    expect(runs).toHaveLength(0)
  })
})
