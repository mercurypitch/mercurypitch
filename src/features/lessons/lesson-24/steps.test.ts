// ============================================================
// Lesson 24 steps tests — the deck, the steps' plays and Step 2's predict
// ============================================================
//
// WEB-SPEC, Toys 2 and 3, and FACTS 46: Step 2's predict waits for the cold
// open's choice under its first hint, then mounts with the hint the kit
// keeps; its choice opens the toy's Step 2, Steps 3 and 4 and their plays,
// and tells free play and Sing it; its reveal waits until both intervals
// have been heard to their end, and shows Step 3's text with it, hiding
// Step 3's held line; a play cut short reveals nothing; Step 1's plays
// open with the cold open's choice and its text with the cold open's
// reveal; and each step's plays draw on the toy in their own state.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MotionModule from '@/features/lessons/kit/motion-switch'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { el, mountSteps, settle, soundOn, words, } from './page-dom.test-fixtures'
import { WIDE_WAVE } from './sounds'
import { PREDICT_2 } from './steps'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

vi.mock('@/features/lessons/kit/motion-switch', async (actual) => {
  await import('@/features/lessons/kit/browser-doubles.test-fixtures')
  return {
    ...(await actual<typeof MotionModule>()),
    reducedMotion: vi.fn(() => true),
  }
})

beforeEach(() => {
  resetRuns()
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

const btn = (sel: string): HTMLButtonElement => el<HTMLButtonElement>(sel)
const hint = (): string => words(el('#predict2 .lock-hint'))

describe("Step 2's predict", () => {
  it("is held until the cold open's choice: its choices and plays disabled under its first hint", () => {
    // Arrange
    mountSteps()

    // Assert
    expect(hint()).toBe(PREDICT_2.held)
    for (const sel of [
      '.choice[data-choice="fifth"]',
      '.choice[data-choice="third"]',
      '[data-play="fifth"]',
      '[data-play="third"]',
    ])
      expect(btn(`#predict2 ${sel}`).disabled, sel).toBe(true)
  })

  it("mounts on the cold open's choice, with the hint the kit keeps and its choices open", () => {
    // Arrange
    const deck = mountSteps()

    // Act
    deck.steps.unlock()

    // Assert
    expect(hint()).toBe(PREDICT_2.open)
    expect(btn('#predict2 .choice[data-choice="third"]').disabled).toBe(false)
    expect(btn('#predict2 [data-play="third"]').disabled).toBe(true)
  })

  it("opens the toy's Step 2, Steps 3 and 4 and their plays on its choice, and tells free play and Sing it", () => {
    // Arrange
    const onStep2 = vi.fn()
    const deck = mountSteps({ onStep2 })
    deck.steps.unlock()

    // Act
    btn('#predict2 .choice[data-choice="third"]').click()

    // Assert
    expect(onStep2).toHaveBeenCalledTimes(1)
    expect(hint()).toBe(PREDICT_2.hints.chosen)
    for (const sel of [
      '#toyChart [data-drone-bead="mi"]',
      '#toyChart [data-drone-play="chord"]',
      '[data-step-play="mi-piano"]',
      '[data-step-play="wave"]',
    ])
      expect(btn(sel).disabled, sel).toBe(false)
  })

  it("reveals once both intervals have been heard to their end, with Step 3's text, and hides Step 3's held line", async () => {
    // Arrange
    const deck = mountSteps()
    deck.steps.unlock()
    btn('#predict2 .choice[data-choice="fifth"]').click()
    const reveal = el('#predict2 .reveal')

    // Act
    btn('#predict2 [data-play="fifth"]').click()
    runs[0].end(true)
    await settle()
    const afterOne = reveal.hidden
    btn('#predict2 [data-play="third"]').click()
    runs[1].end(true)
    await settle()

    // Assert
    expect(afterOne).toBe(true)
    expect(reveal.hidden).toBe(false)
    expect(words(reveal)).toContain('You said: the fifth')
    for (const e of document.querySelectorAll<HTMLElement>('[data-reveal2]'))
      expect(e.hidden).toBe(false)
    expect(el('[data-held="3"]').hidden).toBe(true)
  })

  it('reveals nothing after a play cut short', async () => {
    // Arrange
    const deck = mountSteps()
    deck.steps.unlock()
    btn('#predict2 .choice[data-choice="third"]').click()

    // Act
    btn('#predict2 [data-play="fifth"]').click()
    runs[0].end(true)
    await settle()
    btn('#predict2 [data-play="third"]').click()
    runs[1].end(false)
    await settle()

    // Assert
    expect(el('#predict2 .reveal').hidden).toBe(true)
    expect(el('[data-held="3"]').hidden).toBe(false)
  })

  it("draws its plays on the toy in Step 2's state", () => {
    // Arrange
    const deck = mountSteps()
    deck.steps.unlock()
    btn('#predict2 .choice[data-choice="fifth"]').click()

    // Act
    btn('#predict2 [data-play="third"]').click()

    // Assert
    expect(deck.steps.toy.state).toBe(2)
    expect(runs[0].lines.map((l) => l.points[0].hz)).toEqual([
      220,
      expect.closeTo(277.18, 2),
    ])
  })
})

describe("the steps' own plays", () => {
  it("opens Step 1's with the cold open's choice, and shows its text with the cold open's reveal", () => {
    // Arrange
    const deck = mountSteps()
    const play = btn('[data-step-play="222"]')
    const before = play.disabled

    // Act
    deck.steps.unlock()
    deck.steps.revealStep1()

    // Assert
    expect(before).toBe(true)
    expect(play.disabled).toBe(false)
    for (const e of document.querySelectorAll<HTMLElement>('[data-reveal1]'))
      expect(e.hidden).toBe(false)
    expect(el('[data-held="1"]').hidden).toBe(true)
  })

  it("holds Steps 3 and 4's until Step 2's choice, then plays each in its own state", () => {
    // Arrange
    const deck = mountSteps()
    deck.steps.unlock()
    const wave = btn('[data-step-play="wave"]')
    const before = wave.disabled
    btn('#predict2 .choice[data-choice="fifth"]').click()

    // Act
    wave.click()

    // Assert: Step 4's state, the wave on the top note alone
    expect(before).toBe(true)
    expect(deck.steps.toy.state).toBe(4)
    expect(runs[0].lines.map((l) => l.vibrato)).toEqual([null, WIDE_WAVE])
  })
})
