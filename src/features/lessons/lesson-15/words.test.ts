// ============================================================
// Lesson 15 four words tests — each figure drawn, lit as its notes sound, one sound
// ============================================================
//
// On the page's own markup (WEB-SPEC, Toys 4; FACTS 63): each ticket's
// figure is a small staff, Staff's with no clef, Ledger line's with middle
// C on its ledger line, Grand staff's two staves with their three Cs; each
// play sounds its notes, lights them as they sound, Clef's G line gold;
// and every play is the page's one sound.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { playLength } from './sounds'
import { initWords, WORD_IDS, WORD_SOUNDS } from './words'

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

describe('the four figures', () => {
  it('draws each word as its staff, at rest', () => {
    // Act
    initWords()

    // Assert
    expect([count('staff', '.st-line'), count('staff', '.st-clef')]).toEqual([
      5, 0,
    ])
    expect([count('clef', '.st-line'), count('clef', '.st-clef')]).toEqual([
      5, 1,
    ])
    expect([
      count('ledger', '.st-head'),
      count('ledger', '.st-ledger'),
    ]).toEqual([1, 1])
    expect(count('grand', '.st-brace')).toBe(1)
    expect(count('grand', '.st-clef')).toBe(2)
    expect(count('grand', '.st-head')).toBe(3)
    expect(count('grand', '.st-head.is-lit, .st-lane')).toBe(0)
  })
})

describe('the four plays', () => {
  it('sound their notes for as long as LESSON.md gives', () => {
    // Assert: FACTS 63
    expect(
      WORD_IDS.map((w) => playLength({ show: 'run', notes: WORD_SOUNDS[w] })),
    ).toEqual([expect.closeTo(5.3, 5), 1, 1, expect.closeTo(2.8, 5)])
  })

  it("light the climb's places in turn on Staff, one at a time", () => {
    // Arrange
    initWords()

    // Act
    press('staff')
    runs[0].note(0)
    const first = count('staff', '.st-head.is-lit')
    runs[0].note(4)

    // Assert
    expect(runs[0].notes.map((n) => n.midi)).toEqual([
      64, 65, 67, 69, 71, 72, 74, 76, 77,
    ])
    expect([first, count('staff', '.st-head.is-lit')]).toEqual([1, 1])
  })

  it("light Clef's G line gold while G4 sounds, and put it out as the play ends", async () => {
    // Arrange
    initWords()

    // Act
    press('clef')
    runs[0].note(0)
    const gold = count('clef', '.st-gold')
    runs[0].end(true)
    await settle()

    // Assert
    expect(runs[0].notes).toEqual([{ t: 0, midi: 67, dur: 1 }])
    expect(gold).toBe(1)
    expect(count('clef', '.st-gold')).toBe(0)
  })

  it('light the grand staff’s three Cs in turn, middle C on the line between the staves', () => {
    // Arrange
    initWords()

    // Act
    press('grand')
    runs[0].note(1)

    // Assert
    expect(runs[0].notes.map((n) => n.midi)).toEqual([48, 60, 72])
    expect(count('grand', '.st-head.is-lit')).toBe(1)
    expect(count('grand', '.st-ledger')).toBe(1)
  })

  it("are the page's one sound: a newer sound stops a word, and a word stops the sound before it", async () => {
    // Arrange
    initWords()
    press('ledger')
    runs[0].note(0)

    // Act
    press('grand')
    await settle()
    const ledgerStopped = runs[0].stopped
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(ledgerStopped).toBe(true)
    expect(runs[1].stopped).toBe(true)
    expect(count('ledger', '.st-head.is-lit')).toBe(0)
    expect(el('[data-word-play="grand"]').classList.contains('is-on')).toBe(
      false,
    )
  })
})
