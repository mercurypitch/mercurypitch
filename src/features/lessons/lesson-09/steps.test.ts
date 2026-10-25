// ============================================================
// Lesson 9 steps tests — the one stage, in each step's parts
// ============================================================
//
// On the page's own markup and its own deck: every step shows the controls
// its `data-part` lists name and hides the rest, so no two controls on the
// stage ever share an accessible name (WEB-SPEC, Toys 1, "Keyboard and
// screen readers"; Tests 8), each step has a control to press, and the
// figure's label and the chart's state follow the step. An address that
// names a step opens it in its own parts, and the step showing, shown
// again, changes nothing.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { el, loadPage, mountSteps } from './page-dom.test-fixtures'
import { FIG, partSteps, showParts } from './steps'

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

/** Whether `e` shows: neither it nor a parent inside the stage is hidden. */
function shows(e: HTMLElement): boolean {
  for (let at: HTMLElement | null = e; at !== null; at = at.parentElement)
    if (at.hidden) return false
  return true
}

/** The accessible name of each control showing on the stage, in page order. */
const stageNames = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>('#stepsStage :is(button, input)'),
  )
    .filter(shows)
    .map(
      (b) =>
        b.getAttribute('aria-label') ??
        (b.textContent ?? '').replace(/\s+/g, ' ').trim(),
    )

/** The figure label's words. */
const label = (): string =>
  (el('#toyLadder [data-fig-label]').textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()

describe("Lesson 9's stage, step by step", () => {
  it.each([1, 2, 3, 4, 5])(
    'shows step %i its own controls, none sharing a name, under its own label',
    (n) => {
      // Arrange
      const deck = mountSteps()

      // Act
      deck.show(n)

      // Assert
      const names = stageNames()
      const own = names.filter(
        (name) => !['Previous step', 'Next step'].includes(name),
      )
      expect(own.length, names.join(' | ')).toBeGreaterThan(1)
      expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([])
      expect(label()).toBe(FIG[n].replace(/<[^>]+>/g, ''))
    },
  )

  it("hides every part a step leaves out, and shows Step 1's folds only on Step 1", () => {
    // Arrange
    const deck = mountSteps()
    const strip = el('#toyLadder [data-folds-strip]')
    const scrub = el('#toyLadder [data-landing-scrub]')

    // Act
    deck.show(5)
    const onFive = [shows(strip), shows(scrub)]
    deck.show(1)

    // Assert
    expect(onFive).toEqual([false, true])
    expect([shows(strip), shows(scrub)]).toEqual([true, false])
  })

  it('opens the step an address names in its own parts, and its chart in its state', () => {
    // Arrange
    window.location.hash = '#step-3'

    // Act
    const { ladder } = mountSteps()

    // Assert
    expect(shows(el('#toyLadder [data-ladder-play="climb"]'))).toBe(true)
    expect(shows(el('#toyLadder [data-ladder-play="step"]'))).toBe(false)
    expect(label()).toBe(FIG[3].replace(/<[^>]+>/g, ''))
    expect(ladder.state).toBe('ladder')
  })

  it('shows each step its own state of the chart, and the step showing, shown again, leaves it be', () => {
    // Arrange
    const deck = mountSteps()
    const states: string[] = [deck.ladder.state]

    // Act
    for (const n of [2, 3, 4, 5]) {
      deck.show(n)
      states.push(deck.ladder.state)
    }
    const drawn = deck.ladder.play({ notes: [{ t: 0, midi: 50, dur: 1 }] })
    drawn.end()
    const before = deck.ladder.view
    deck.show(5)

    // Assert
    expect(states).toEqual(['step', 'hear', 'ladder', 'order', 'landing'])
    expect(deck.ladder.view).toBe(before)
    expect(el('#toyLadder .ladder-canvas').getAttribute('aria-label')).toBe(
      'Do, D3, and so, A3',
    )
  })

  it("draws the page in Step 1's parts before any script runs", () => {
    // Arrange
    loadPage()
    const root = el('#toyLadder')
    const before = Array.from(
      root.querySelectorAll<HTMLElement>('[data-part]'),
      (e) => e.hidden,
    )

    // Act
    showParts(root, 1)

    // Assert
    expect(
      Array.from(
        root.querySelectorAll<HTMLElement>('[data-part]'),
        (e) => e.hidden,
      ),
    ).toEqual(before)
  })

  it("reads a part's steps from its list, and nothing from an empty one", () => {
    // Arrange
    const both = document.createElement('p')
    both.setAttribute('data-part', ' 1  2 ')
    const none = document.createElement('p')
    none.setAttribute('data-part', '')

    // Act / Assert
    expect(partSteps(both)).toEqual([1, 2])
    expect(partSteps(none)).toEqual([])
  })
})
