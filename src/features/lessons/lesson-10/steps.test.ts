// ============================================================
// Lesson 10 steps tests — the one stage, in each step's parts
// ============================================================
//
// On the page's own markup and its own deck: every step shows the controls
// its `data-part` lists name and hides the rest, so no two controls on the
// stage ever share an accessible name (WEB-SPEC, Toys 1, "Keyboard and
// screen readers"), each step has a control to press, in at most two rows
// (Toys 1, "The stuck stage"), and the figure's label follows the step.
// Step 5's Major · Minor is its own, and waits for its predict. Step 2
// opens with Stack a third, and Play the triad takes its place once the
// third is stacked (steps-thirds.test.ts). An address that names a step
// opens it in its own parts, and the step showing, shown again, changes
// nothing.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { summary } from './lines'
import { el, loadPage, mountSteps } from './page-dom.test-fixtures'
import { FIG, partSteps, showParts, STEP_STATE } from './steps'

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

/** The accessible name of each control showing on the stage, in page order, the beads' own buttons aside. */
const stageNames = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>('#stepsStage :is(button, input)'),
  )
    .filter((b) => b.closest('[data-chord-targets]') === null)
    .filter(shows)
    .map(
      (b) =>
        b.getAttribute('aria-label') ??
        (b.textContent ?? '').replace(/\s+/g, ' ').trim(),
    )

/** The figure label's words. */
const label = (): string =>
  (el('#toyChord [data-fig-label]').textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()

/** The stage's rows of controls that show. */
const rows = (): HTMLElement[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>('#toyChord .chord-row'),
  ).filter(shows)

describe("Lesson 10's stage, step by step", () => {
  it.each([1, 2, 3, 4, 5])(
    'shows step %i its own controls, in at most two rows, none sharing a name, under its own label',
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
      expect(rows().length).toBeGreaterThan(0)
      expect(rows().length).toBeLessThanOrEqual(2)
      expect(label()).toBe(FIG[n].replace(/<[^>]+>/g, ''))
    },
  )

  it.each([
    [1, ['Play the third', 'Slow', 'Major', 'Minor']],
    [2, ['Stack a third', 'Slow']],
    [
      3,
      ['Play the triad', 'Slow', 'Major', 'Minor', 'Root lower', 'Root higher'],
    ],
    [4, ['Play the pattern', 'Major', 'Minor', 'Slow', 'Fast']],
    [5, ['Chord', 'Scale', 'Slow', 'Major', 'Minor', 'Letters', 'Do-re-mi']],
  ])('gives step %i the controls the spec lists, in its order', (n, want) => {
    // Arrange
    const deck = mountSteps()

    // Act
    deck.show(n)

    // Assert: WEB-SPEC, Sections, item 5, and Toys 1
    expect(
      stageNames().filter(
        (name) => !['Previous step', 'Next step'].includes(name),
      ),
    ).toEqual(want)
  })

  it("keeps Step 5's Major · Minor its own, disabled until its predict's choice, and Steps 1, 3 and 4's free", () => {
    // Arrange
    const deck = mountSteps()
    const states = (): (boolean | null)[][] =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '#toyChord :is([data-chord-quality], [data-scale-quality])',
        ),
      )
        .filter(shows)
        .map((seg) =>
          Array.from(
            seg.querySelectorAll<HTMLButtonElement>('button'),
            (b) => b.disabled,
          ),
        )

    // Act
    const byStep = [1, 3, 4, 5].map((n) => {
      deck.show(n)
      return states()
    })

    // Assert: WEB-SPEC, Toys 1, Scale
    expect(byStep).toEqual([
      [[false, false]],
      [[false, false]],
      [[false, false]],
      [[true, true]],
    ])
  })

  it('opens the chord beads in each step’s state, on C4, as the step shows', () => {
    // Arrange
    const deck = mountSteps()

    // Act
    const byStep = [1, 2, 3, 4, 5, 3].map((n) => {
      deck.show(n)
      return [deck.beads.settings.state, deck.beads.settings.root]
    })

    // Assert: WEB-SPEC, Sections, item 5, and Toys 1's states
    expect(byStep).toEqual([
      [STEP_STATE[1], 60],
      ['stack', 60],
      ['slide', 60],
      ['pattern', 60],
      ['scale', 60],
      ['slide', 60],
    ])
    expect(STEP_STATE[1]).toBe('thirds')
  })

  it('stops the beads’ sound when the step changes', async () => {
    // Arrange
    const deck = mountSteps()
    const played = deck.beads.play([{ t: 0, midi: 60, dur: 1 }], false)

    // Act
    deck.show(2)

    // Assert
    await expect(played).resolves.toBe(false)
  })

  it('hides every part a step leaves out', () => {
    // Arrange
    const deck = mountSteps()
    const root = el('#toyChord [data-chord-root="1"]')
    const stack = el('#toyChord [data-chord-stack]')

    // Act
    deck.show(3)
    const onThree = [shows(root), shows(stack)]
    deck.show(2)

    // Assert
    expect(onThree).toEqual([true, false])
    expect([shows(root), shows(stack)]).toEqual([false, true])
  })

  it('opens the step an address names in its own parts', () => {
    // Arrange
    window.location.hash = '#step-4'

    // Act
    mountSteps()

    // Assert
    expect(shows(el('#toyChord [data-chord-play="pattern"]'))).toBe(true)
    expect(shows(el('#toyChord [data-chord-play="third"]'))).toBe(false)
    expect(label()).toBe(FIG[4].replace(/<[^>]+>/g, ''))
  })

  it("draws the page in Step 1's parts before any script runs, its figure summed up as the toy sums up Step 1", () => {
    // Arrange
    loadPage()
    const root = el('#toyChord')
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
    expect(label()).toBe(FIG[1].replace(/<[^>]+>/g, ''))
    expect(
      (el('#toyChord [data-chord-summary]').textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim(),
    ).toBe(summary({ kind: 'third', root: 60, quality: 'major' }))
  })

  it("reads a part's steps from its list, and nothing from an empty one", () => {
    // Arrange
    const both = document.createElement('p')
    both.setAttribute('data-part', ' 1  3 ')
    const none = document.createElement('p')
    none.setAttribute('data-part', '')

    // Act / Assert
    expect(partSteps(both)).toEqual([1, 3])
    expect(partSteps(none)).toEqual([])
  })
})
