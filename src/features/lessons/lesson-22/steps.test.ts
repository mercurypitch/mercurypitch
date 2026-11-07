// ============================================================
// Lesson 22 steps tests — one band chart in four states, held until the choice, and Step 3's predict
// ============================================================
//
// On the page's own markup and its own deck (WEB-SPEC, Toys 2 and 3; Tests
// 5 and 6): every step shows its own controls and hides the rest, so no two
// on the stage share a name, and the figure's label, the chart's window
// and Step 4's second panel follow the step; until the cold open's choice
// every control is disabled under the lock line and the chart draws only
// its band, and Step 3's predict is held with its first hint; on that
// choice the toy opens, but Step 3's Rate, Play at this rate and Drift,
// and its slow wave, wait for Step 3's own choice; Play: six a second
// heard before it brings back the second hint, never the first, and never
// reveals; the reveal, Tavi's line, the mix-up card, Try and Notice wait
// for the slow wave heard to its end with sound on.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { el, mountSteps, settle, soundOn, words, } from './page-dom.test-fixtures'
import { PREDICT_3 } from './steps'
import { WINDOW } from './vib-picture'
import { FIG } from './vib-words'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  resetRuns()
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

/** Whether `e` shows: neither it nor a parent is hidden. */
function shows(e: Element): boolean {
  for (let at: Element | null = e; at !== null; at = at.parentElement)
    if (at instanceof HTMLElement && at.hidden) return false
  return true
}

/** An element's words as a screen reader speaks them: aria-hidden parts left out. */
function spoken(e: Element): string {
  const copy = e.cloneNode(true) as Element
  copy.querySelectorAll('[aria-hidden="true"]').forEach((h) => h.remove())
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** The names of the toy's controls showing, in page order: a slider by its label's first word. */
const toyNames = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>('#toyChart button, #toyChart input'),
  )
    .filter(shows)
    .map((c) =>
      c instanceof HTMLInputElement
        ? spoken(el(`label[for="${c.id}"]`)).split(' ')[0]
        : spoken(c),
    )

/** Each step's controls, in page order (WEB-SPEC, Toys 2). */
const NAMES: Readonly<Record<number, readonly string[]>> = {
  1: ['Play straight', 'Play with a wave', 'Play a swell'],
  2: ['Rate', 'Extent', 'Play', "Play Merc's “ooh”"],
  3: ['Rate', 'Play at this rate', 'Drift'],
  4: ['Play the sung wave', 'Stretch'],
}

/** The toy's controls and Step 3's predict's, enabled or not. */
const enabled = (sel: string): boolean =>
  !el<HTMLButtonElement | HTMLInputElement>(sel).disabled

const card = (): HTMLElement => el('#predict3')

describe('the stage, step by step', () => {
  it("shows each step's own controls under the chart, and no two that share a name", () => {
    // Arrange
    const deck = mountSteps()

    for (const n of [1, 2, 3, 4]) {
      // Act
      deck.show(n)

      // Assert
      const names = toyNames()
      expect(names, `step ${n}`).toEqual(NAMES[n])
      expect(new Set(names).size, `step ${n}`).toBe(names.length)
    }
  })

  it("labels the figure for its step, opens the chart's window, and sets Step 4's mark beside the sung wave", () => {
    // Arrange
    const deck = mountSteps()

    for (const n of [2, 3, 4, 1] as const) {
      // Act
      deck.show(n)

      // Assert
      expect(el('#toyChart [data-fig-label]').innerHTML, `step ${n}`).toBe(
        FIG[n],
      )
      expect(deck.steps.toy.state).toBe(n)
      expect(deck.steps.toy.chart.window).toBe(WINDOW[n])
      expect(shows(el('#toyChart [data-vib-panel="mark"]'))).toBe(n === 4)
      expect(el('#toyChart [data-vib-panels]').classList.contains('two')).toBe(
        n === 4,
      )
      expect(shows(el('#toyChart [data-vib-meters]'))).toBe(n === 2)
    }
  })

  it('names no answer to either predict in a figure label (FACTS 1a)', () => {
    for (const label of Object.values(FIG))
      expect(label).not.toMatch(/heard|hear|one note|moves|top|slow/i)
  })
})

describe("before the cold open's choice", () => {
  it('disables every control under the lock line, and draws only the band', () => {
    // Arrange
    const deck = mountSteps()

    for (const n of [1, 2, 3, 4]) {
      // Act
      deck.show(n)

      // Assert
      for (const c of document.querySelectorAll<HTMLButtonElement>(
        '#toyChart button, #toyChart input',
      ))
        expect(c.disabled, `${spoken(c)} in step ${n}`).toBe(true)
      expect(shows(el('#toyChart [data-vib-lock]'))).toBe(true)
      expect(deck.steps.toy.chart.scene.wave ?? null).toBeNull()
      expect(deck.steps.toy.chart.scene.middle ?? null).toBeNull()
    }
  })

  it('holds Step 3\'s predict: its choices and both plays disabled, its hint "Choose an answer at the top first."', () => {
    // Arrange
    mountSteps()

    // Assert
    for (const b of card().querySelectorAll<HTMLButtonElement>(
      '.choice, [data-play]',
    ))
      expect(b.disabled, spoken(b)).toBe(true)
    expect(words(card().querySelector('.lock-hint'))).toBe(PREDICT_3.held)
  })

  it('plays nothing from a held control', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(1)

    // Act
    el<HTMLButtonElement>('[data-vib-play="straight"]').click()
    el<HTMLButtonElement>('#predict3 [data-play="six"]').click()

    // Assert
    expect(runs).toHaveLength(0)
  })
})

describe("the cold open's choice", () => {
  it("opens every control but Step 3's held ones, and each state's still", () => {
    // Arrange
    const deck = mountSteps()

    // Act
    deck.steps.unlock()
    deck.show(3)

    // Assert
    expect(shows(el('#toyChart [data-vib-lock]'))).toBe(false)
    for (const sel of [
      '[data-vib-play="straight"]',
      '[data-vib-play="measure"]',
      '#vibRate2',
      '#vibExtent2',
      '[data-vib-play="sung"]',
      '#vibStretch',
    ])
      expect(enabled(sel), sel).toBe(true)
    for (const sel of [
      '#vibRate3',
      '[data-vib-play="at-rate"]',
      '[data-vib-drift]',
    ])
      expect(enabled(sel), sel).toBe(false)
    expect(deck.steps.toy.chart.scene.wave?.stretches[0]).toMatchObject({
      rate: 6,
      extent: 50,
    })
    expect(deck.steps.toy.chart.scene.middle?.share).toBe(1)
  })

  it('gives Step 3\'s predict its second hint, "Choose an answer to unlock the slow wave.", its choices and Play: six a second, but not the slow wave', () => {
    // Arrange
    const deck = mountSteps()

    // Act
    deck.steps.unlock()

    // Assert
    expect(words(card().querySelector('.lock-hint'))).toBe(PREDICT_3.open)
    expect(enabled('#predict3 [data-choice="one"]')).toBe(true)
    expect(enabled('#predict3 [data-choice="moves"]')).toBe(true)
    expect(enabled('#predict3 [data-play="six"]')).toBe(true)
    expect(enabled('#predict3 [data-play="two"]')).toBe(false)
  })
})

describe("Step 3's predict", () => {
  it('puts back the second hint, never the first, after Play: six a second heard before a choice, and reveals nothing', async () => {
    // Arrange
    const deck = mountSteps()
    deck.steps.unlock()
    deck.show(3)

    // Act
    el<HTMLButtonElement>('#predict3 [data-play="six"]').click()
    await settle()
    runs[0].end(true)
    await settle()

    // Assert: the cold open's wave, drawn on Step 3's chart
    expect(runs[0].o.vibrato).toEqual({ rate: 6, extent: 50, growIn: 0.3 })
    expect(words(card().querySelector('.lock-hint'))).toBe(PREDICT_3.open)
    expect(el('#predict3 .reveal').hidden).toBe(true)
  })

  it('unlocks the slow wave, Rate, Play at this rate and Drift on its choice, and tells free play and the quick check', () => {
    // Arrange
    const onHeld = vi.fn()
    const deck = mountSteps({ onHeld })
    deck.steps.unlock()

    // Act
    el<HTMLButtonElement>('#predict3 [data-choice="moves"]').click()

    // Assert
    expect(words(card().querySelector('.lock-hint'))).toBe(
      PREDICT_3.hints.chosen,
    )
    for (const sel of [
      '#predict3 [data-play="two"]',
      '#vibRate3',
      '[data-vib-play="at-rate"]',
      '[data-vib-drift]',
    ])
      expect(enabled(sel), sel).toBe(true)
    expect(onHeld).toHaveBeenCalledOnce()
  })

  it('keeps the reveal and its parts hidden until the slow wave is heard to its end, then shows all of them', async () => {
    // Arrange
    const deck = mountSteps()
    deck.steps.unlock()
    deck.show(3)
    el<HTMLButtonElement>('#predict3 [data-choice="one"]').click()
    const parts = (): HTMLElement[] => [
      el('#predict3 .reveal'),
      ...document.querySelectorAll<HTMLElement>('[data-reveal3]'),
    ]

    // Act: the slow wave cut short, then heard to its end
    el<HTMLButtonElement>('#predict3 [data-play="two"]').click()
    await settle()
    runs[0].end(false)
    await settle()
    const afterCut = parts().map((p) => p.hidden)
    el<HTMLButtonElement>('#predict3 [data-play="two"]').click()
    await settle()
    runs[1].end(true)
    await settle()

    // Assert: the reveal, Tavi's line, the mix-up card, Try and Notice
    expect(parts()).toHaveLength(5)
    expect(afterCut).toEqual([true, true, true, true, true])
    expect(parts().map((p) => p.hidden)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ])
    expect(words(el('#predict3 .reveal .mono'))).toBe(
      'You said: still one note',
    )
    expect(runs[1].o.vibrato).toEqual({ rate: 2, extent: 50, growIn: 0.3 })
  })

  it('never reveals on Play: six a second, even after the choice', async () => {
    // Arrange
    const deck = mountSteps()
    deck.steps.unlock()
    el<HTMLButtonElement>('#predict3 [data-choice="moves"]').click()

    // Act
    el<HTMLButtonElement>('#predict3 [data-play="six"]').click()
    await settle()
    runs[0].end(true)
    await settle()

    // Assert
    expect(el('#predict3 .reveal').hidden).toBe(true)
    expect(words(card().querySelector('.lock-hint'))).toBe(
      PREDICT_3.hints.chosen,
    )
  })
})
