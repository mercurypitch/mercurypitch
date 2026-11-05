// ============================================================
// Lesson 15 steps tests — one staff toy, in each step's state and parts
// ============================================================
//
// On the page's own markup and its own deck: every step shows the plays
// its `data-part` lists name and hides the rest, so no two controls on the
// stage ever share an accessible name (WEB-SPEC, Toys 1); the figure's
// label and the toy's state follow the step; each play sounds its notes on
// the toy, its button lit while it sounds; and leaving a step stops what
// the toy plays. The markup is Step 1's.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { showParts } from '@/features/lessons/kit/step-parts'
import { el, mountSteps, settle, soundOn, words, } from './page-dom.test-fixtures'
import { STEP_STATE } from './sounds'
import { FIG } from './steps'

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
function shows(e: HTMLElement): boolean {
  for (let at: HTMLElement | null = e; at !== null; at = at.parentElement)
    if (at.hidden) return false
  return true
}

/** An element's words as a screen reader speaks them: aria-hidden parts left out. */
function spoken(e: Element): string {
  const copy = e.cloneNode(true) as Element
  copy.querySelectorAll('[aria-hidden="true"]').forEach((h) => h.remove())
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** The names of the staff toy's controls showing, in page order. */
const toyNames = (): string[] =>
  Array.from(document.querySelectorAll<HTMLElement>('#toyStaff button'))
    .filter(shows)
    .map((b) => b.getAttribute('aria-label') ?? spoken(b))

/** The controls each step shows, after Step up, Step down and the switch (WEB-SPEC, Toys 1). */
const OWN: Readonly<Record<number, readonly string[]>> = {
  1: ['Play G4'],
  2: [
    'Play E, F, G',
    'Play B, C, D',
    'Play F, then F sharp',
    'Play B, then B flat',
  ],
  3: ['Play G, A, C above', 'Play D, C, A below'],
  4: ['Treble', 'Bass', "Play Merc's F", 'Play G2 up to D4'],
  5: [
    'Play middle C on each staff',
    'Play the white keys from G2 to F5',
    'Lower keys',
    'Higher keys',
  ],
}

const ALWAYS = ['Step up', 'Step down', 'See it on the pitch line']

describe('the stage, step by step', () => {
  it("shows each step's own plays under the staff, and no two controls that share a name", () => {
    // Arrange
    const deck = mountSteps()

    for (const n of [1, 2, 3, 4, 5]) {
      // Act
      deck.show(n)

      // Assert
      const names = toyNames()
      expect(names, `step ${n}`).toEqual([...ALWAYS, ...OWN[n]])
      expect(new Set(names).size, `step ${n}`).toBe(names.length)
    }
  })

  it("is Step 1's in the markup, before any script runs", () => {
    // Arrange: the page's markup, its parts as Step 1 shows them
    mountSteps()
    const before = toyNames()

    // Act
    showParts(el('#toyStaff'), 1)

    // Assert
    expect(toyNames()).toEqual(before)
    expect(el('#toyStaff [data-fig-label]').innerHTML.trim()).toBe(FIG[1])
  })

  it("labels the figure for its step and opens the toy in the step's state", () => {
    // Arrange
    const deck = mountSteps()

    for (const n of [2, 3, 4, 5, 1]) {
      // Act
      deck.show(n)

      // Assert
      expect(el('#toyStaff [data-fig-label]').innerHTML, `step ${n}`).toBe(
        FIG[n],
      )
      expect(deck.staff.state, `step ${n}`).toBe(STEP_STATE[n])
    }
    // the grand staff names itself for its group, the single staff for its clef
    deck.show(5)
    expect(el('#toyStaff [data-staff-svg]').getAttribute('aria-label')).toMatch(
      /^Grand staff/,
    )
    deck.show(1)
    expect(el('#toyStaff [data-staff-svg]').getAttribute('aria-label')).toBe(
      'Treble staff, five lines and four spaces',
    )
  })

  it('opens Step 3 on its one note, F5, and Step 5 with its key strip', () => {
    // Arrange
    const deck = mountSteps()

    // Act
    deck.show(3)
    const heads = el('#toyStaff').querySelectorAll('.st-head').length
    deck.show(5)

    // Assert
    expect(heads).toBe(1)
    expect(el('#toyStaff').querySelectorAll('.st-key').length).toBeGreaterThan(
      0,
    )
  })
})

describe("the steps' plays", () => {
  it('play their notes on the toy, the button lit while they sound', async () => {
    // Arrange
    mountSteps()
    const play = el<HTMLButtonElement>('[data-staff-play="g4"]')

    // Act
    play.click()
    const lit = play.classList.contains('is-on')
    runs[0].note(0)
    const gold = el('#toyStaff').querySelectorAll('.st-gold').length
    runs[0].end(true)
    await settle()

    // Assert: G4 for a second, its clef's line gold (FACTS 64)
    expect(runs).toHaveLength(1)
    expect(runs[0].notes).toEqual([{ t: 0, midi: 67, dur: 1, kind: 'soft' }])
    expect(lit).toBe(true)
    expect(gold).toBe(1)
    expect(play.classList.contains('is-on')).toBe(false)
    expect(words(el('#toyStaff [data-staff-said]'))).toBe('G4, the second line')
  })

  it('stop the play before, and put out its button', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)
    const efg = el<HTMLButtonElement>('[data-staff-play="efg"]')
    const bcd = el<HTMLButtonElement>('[data-staff-play="bcd"]')
    efg.click()

    // Act
    bcd.click()
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(efg.classList.contains('is-on')).toBe(false)
    expect(bcd.classList.contains('is-on')).toBe(true)
  })

  it("open Merc's F on the bass clef, its button pressed, in Merc's voice", () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)

    // Act
    el<HTMLButtonElement>('[data-staff-play="merc-f"]').click()

    // Assert: FACTS 67
    expect(deck.staff.clef).toBe('bass')
    expect(
      el('#toyStaff button[data-clef="bass"]').getAttribute('aria-pressed'),
    ).toBe('true')
    expect(runs[runs.length - 1].o.kind).toBe('merc')
    expect(runs[runs.length - 1].notes[0].midi).toBe(53)
  })

  it('stop when the deck leaves the step, by any route', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)
    el<HTMLButtonElement>('[data-staff-play="efg"]').click()

    // Act
    deck.show(3)

    // Assert
    expect(runs[0].stopped).toBe(true)
  })

  it('play nothing when the step showing is shown again', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)
    el<HTMLButtonElement>('[data-staff-play="efg"]').click()

    // Act
    deck.show(2)

    // Assert
    expect(runs[0].stopped).toBe(false)
  })
})
