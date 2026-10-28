// ============================================================
// Lesson 12 steps tests — the one stage, in each step's parts
// ============================================================
//
// On the page's own markup and its own deck: every step shows the chord
// strip and the controls its `data-part` lists name, and hides the rest, so
// no two controls on the stage ever share an accessible name (WEB-SPEC,
// Toys 1, "Keyboard and screen readers"); each step has the controls the
// spec gives it, the strip's seven chips first, in one row of its own
// beside the text (Toys 1, "The stuck stage"), and the figure's label
// follows the step. An address that names a step opens it in its own
// parts, and the step showing, shown again, changes nothing. The markup is
// Step 1's: its chips named as the toy names them, and its figure summed
// up as the toy sums it up.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { MAJOR_SOLFEGE } from '@/features/lessons/kit/names-modes'
import { chipName, figureSummary } from './lines'
import { chordsOf } from './music'
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

/** An element's words, as a reader meets them: aria-hidden parts left out. */
function spoken(e: Element): string {
  const copy = e.cloneNode(true) as Element
  copy.querySelectorAll('[aria-hidden="true"]').forEach((h) => h.remove())
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** The accessible name of each control showing on the stage, in page order. */
const stageNames = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>('#stepsStage :is(button, input)'),
  )
    .filter(shows)
    .map((b) => b.getAttribute('aria-label') ?? spoken(b))

/** The step's own controls: the stage's names less its nav and the seven chips. */
const ownNames = (): string[] =>
  stageNames().filter(
    (name) =>
      !['Previous step', 'Next step'].includes(name) &&
      !name.startsWith('The chord on '),
  )

/** The figure label's words. */
const label = (): string =>
  (el('#toyRooms [data-fig-label]').textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()

/** The stage's rows of the step's own controls that show. */
const rows = (): HTMLElement[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>('#toyRooms .rooms-row'),
  ).filter(shows)

/** The chord strip's chips that show. */
const chips = (): HTMLElement[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      '#toyRooms [data-chord-strip] button',
    ),
  ).filter(shows)

describe("Lesson 12's stage, step by step", () => {
  it.each([1, 2, 3, 4, 5])(
    'shows step %i the seven chips and its own controls, in one row, none sharing a name, under its own label',
    (n) => {
      // Arrange
      const deck = mountSteps()

      // Act
      deck.show(n)

      // Assert
      const names = stageNames()
      expect(chips()).toHaveLength(7)
      expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([])
      expect(rows()).toHaveLength(n === 1 ? 0 : 1)
      expect(label()).toBe(FIG[n].replace(/<[^>]+>/g, ''))
    },
  )

  it.each([
    [1, []],
    [2, ['C', 'G']],
    [3, ['Play one, then six minor', 'Letters', 'Do-re-mi', 'Slow']],
    [4, ['Play the loop', 'Play the roots', 'Slow']],
    [5, ['Play tune 1', 'Play tune 2', 'Play tune 2 with even notes', 'Slow']],
  ])('gives step %i the controls the spec lists, in its order', (n, want) => {
    // Arrange
    const deck = mountSteps()

    // Act
    deck.show(n)

    // Assert: WEB-SPEC, Sections, item 5, and Toys 1 and 5
    expect(ownNames()).toEqual(want)
  })

  it("keeps Step 4's moves readout inside the figure, and only on Step 4", () => {
    // Arrange
    const deck = mountSteps()
    const moves = el('#toyRooms [data-rooms-moves]')

    // Act
    const byStep = [1, 2, 3, 4, 5].map((n) => {
      deck.show(n)
      return shows(moves)
    })

    // Assert: WEB-SPEC, Toys 1, Readouts
    expect(moves.closest('.viz')).not.toBeNull()
    expect(byStep).toEqual([false, false, false, true, false])
  })

  it('hides every part a step leaves out', () => {
    // Arrange
    const deck = mountSteps()
    const key = el('#toyRooms [data-rooms-key]')
    const slide = el('#toyRooms [data-rooms-play="slide"]')

    // Act
    deck.show(3)
    const onThree = [shows(key), shows(slide)]
    deck.show(2)

    // Assert
    expect(onThree).toEqual([false, true])
    expect([shows(key), shows(slide)]).toEqual([true, false])
  })

  it('opens the step an address names in its own parts', () => {
    // Arrange
    window.location.hash = '#step-4'

    // Act
    mountSteps()

    // Assert
    expect(shows(el('#toyRooms [data-rooms-play="loop"]'))).toBe(true)
    expect(shows(el('#toyRooms [data-rooms-key]'))).toBe(false)
    expect(label()).toBe(FIG[4].replace(/<[^>]+>/g, ''))
  })

  it("draws the page in Step 1's parts before any script runs, its chips named and its figure summed up as the toy names and sums up Step 1", () => {
    // Arrange
    loadPage()
    const root = el('#toyRooms')
    const before = Array.from(
      root.querySelectorAll<HTMLElement>('[data-part]'),
      (e) => e.hidden,
    )
    const naming = {
      syllable: (degree: number) => MAJOR_SOLFEGE[degree],
      solfege: false,
    }

    // Act
    showParts(root, 1)

    // Assert
    expect(
      Array.from(
        root.querySelectorAll<HTMLElement>('[data-part]'),
        (e) => e.hidden,
      ),
    ).toEqual(before)
    expect(label()).toBe(FIG[1].replace(/<[^>]+>/g, ''))
    expect(chips().map((c) => c.getAttribute('aria-label'))).toEqual(
      chordsOf('C').map((c) => chipName(c, 'build', naming)),
    )
    expect(chips().map((c) => c.dataset.chip)).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ])
    expect(
      (el('#toyRooms [data-rooms-summary]').textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim(),
    ).toBe(figureSummary('C', []))
  })

  it("reads a part's steps from its list, and nothing from an empty one", () => {
    // Arrange
    const both = document.createElement('p')
    both.setAttribute('data-part', ' 3  5 ')
    const none = document.createElement('p')
    none.setAttribute('data-part', '')

    // Act / Assert
    expect(partSteps(both)).toEqual([3, 5])
    expect(partSteps(none)).toEqual([])
  })
})
