// ============================================================
// Lesson 11 steps tests — the one stage, in each step's parts
// ============================================================
//
// On the page's own markup and its own deck: every step shows the controls
// its `data-part` names, and hides the rest, so no two controls on the
// stage ever share an accessible name (WEB-SPEC, Toys 1, "Keyboard and
// screen readers"); each step has the controls the spec gives it, in its
// rows ("Layout and targets"), and the figure's label and the chart's state
// follow the step. An address that names a step opens it in its own parts,
// and the step showing, shown again, changes nothing. The markup is Step
// 1's.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { el, loadPage, mountSteps } from './page-dom.test-fixtures'
import { FIG } from './steps'

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

/** Whether `e` shows: neither it nor a parent is hidden. */
function shows(e: HTMLElement): boolean {
  for (let at: HTMLElement | null = e; at !== null; at = at.parentElement)
    if (at.hidden) return false
  return true
}

/** An element's words, as a reader meets them: aria-hidden parts left out. */
function spoken(e: Element): string {
  const copy = e.cloneNode(true) as Element
  copy.querySelectorAll('[aria-hidden="true"]').forEach((h) => h.remove())
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** The names of the stage's controls that show, in reading order. */
const shownControls = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      '#toyRange button, #toyRange [role="slider"]',
    ),
  )
    .filter(shows)
    .map((b) => b.getAttribute('aria-label') ?? spoken(b))

/** Each step's controls, as WEB-SPEC Toys 1 lists them. */
const CONTROLS: Readonly<Record<number, readonly string[]>> = {
  1: ['Lower gear, G sharp 3', 'Upper gear, G sharp 3'],
  2: ['Play the slide', 'Slow', 'where the slide is'],
  3: ['Slide 1', 'Slide 2', 'Slide 3', 'Slow'],
  4: [
    'Play the five slides',
    'Slow',
    '1 of 5',
    '2 of 5',
    '3 of 5',
    '4 of 5',
    '5 of 5',
  ],
  5: ['Flip on purpose', 'Hide the switch', 'Slow'],
}

describe("Lesson 11's stage", () => {
  it("shows each step's own controls, and only those, in reading order", async () => {
    // Arrange
    const deck = mountSteps()
    const seen: Record<number, string[]> = {}

    // Act
    for (let n = 1; n <= 5; n++) {
      deck.show(n)
      await Promise.resolve()
      seen[n] = shownControls()
    }

    // Assert
    expect(seen).toEqual(CONTROLS)
  })

  it("follows the step with the figure's label and the chart's state", () => {
    // Arrange
    const deck = mountSteps()
    const root = el('#toyRange')

    // Act
    deck.show(4)

    // Assert
    expect(el('[data-fig-label]').innerHTML).toBe(FIG[4])
    expect(root.dataset.state).toBe('smoother')
  })

  it("opens at the step an address names, in that step's parts", () => {
    // Arrange
    window.location.hash = '#step-3'

    // Act
    mountSteps()

    // Assert
    expect(shownControls()).toEqual(CONTROLS[3])
    expect(el('#toyRange').dataset.state).toBe('three')
  })

  it("is Step 1's in the markup, before any script runs", () => {
    // Act
    loadPage()

    // Assert
    expect(shownControls()).toEqual(CONTROLS[1])
    expect(el('[data-fig-label]').innerHTML.replace(/\s+/g, ' ').trim()).toBe(
      FIG[1],
    )
    expect(el('#toyRange').dataset.state).toBe('gears')
  })

  it('keeps Slow pressed at first on Step 2 only, as its Try asks', () => {
    // Act
    loadPage()
    const slows = Array.from(
      document.querySelectorAll<HTMLElement>('#toyRange [data-slow]'),
      (b) => [b.dataset.slow, b.getAttribute('aria-pressed')],
    )

    // Assert
    expect(slows).toEqual([
      ['slide', 'true'],
      ['three', 'false'],
      ['smoother', 'false'],
      ['styles', 'false'],
    ])
  })
})
