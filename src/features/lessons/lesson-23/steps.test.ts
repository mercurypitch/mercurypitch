// ============================================================
// Lesson 23 steps tests — one staff toy in its interval state, each step's parts, held until the choice
// ============================================================
//
// On the page's own markup and its own deck: every step shows the plays
// its `data-part` lists name and hides the rest, so no two controls on the
// stage share an accessible name (WEB-SPEC, Toys 1); the figure's label and
// the toy's state follow the step; until the cold open's choice the toy
// holds back what would answer it, and so do the plays of Steps 2 to 4;
// each play sounds its notes on the toy, its button lit while it sounds;
// and the staff is the learner's, following Sing it's voice choice. The
// markup is Step 1's.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { showParts } from '@/features/lessons/kit/step-parts'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
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

const MOVES = ['Step up', 'Step down', 'Sharp', 'Flat']
const VIEW = ['Treble', 'Bass', 'See it on the pitch line']

/** Each step's controls, in page order (WEB-SPEC, Toys 1). */
const NAMES: Readonly<Record<number, readonly string[]>> = {
  1: [...MOVES, ...VIEW, 'Play C up to E', 'Play C up to E flat'],
  2: [
    ...MOVES,
    ...VIEW,
    'Play C up to F, then F sharp',
    'Play C up to G, then G flat',
  ],
  3: [
    ...MOVES,
    'Fold',
    ...VIEW,
    'Play C up to G, then G up to C',
    'Play C up to E, then E up to C',
  ],
  4: [...MOVES, 'Curl into a ring', ...VIEW, 'Play B and F, then C and E'],
}

const held = (sel: string): boolean =>
  el(sel).getAttribute('aria-disabled') === 'true'

describe('the stage, step by step', () => {
  it("shows each step's own controls under the staff, and no two that share a name", () => {
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

  it("labels the figure for its step and opens the toy in the step's state, the readout empty", () => {
    // Arrange
    const deck = mountSteps()

    for (const n of [2, 3, 4, 1]) {
      // Act
      deck.show(n)

      // Assert
      expect(el('#toyStaff [data-fig-label]').innerHTML, `step ${n}`).toBe(
        FIG[n],
      )
      expect(deck.steps.toy.state, `step ${n}`).toBe(STEP_STATE[n])
      expect(deck.steps.toy.readout, `step ${n}`).toBe('')
    }
    // the figure names its staff and the pitch line beside it
    expect(el('#toyStaff [data-staff-svg]').getAttribute('aria-label')).toBe(
      'Bass staff, five lines and four spaces, beside the pitch line',
    )
  })

  it('names no note, no size and no tritone in a figure label (FACTS 1a)', () => {
    for (const label of Object.values(FIG))
      expect(label).not.toMatch(/[♯♭]|sharp|flat|tritone|semitone|\d+ letters/i)
  })

  it('draws the B lane below the foot in Step 4 alone: fourteen lanes, thirteen elsewhere', () => {
    // Arrange
    const deck = mountSteps()
    deck.steps.unlock()
    const lanes = (): number =>
      el('#toyStaff').querySelectorAll('.iv-lane').length

    // Act
    deck.show(3)
    const three = lanes()
    deck.show(4)
    const four = lanes()

    // Assert: FACTS 20, 39
    expect([three, four]).toEqual([13, 14])
  })
})

describe('before the choice', () => {
  it("holds back the signs, Fold, Curl and Steps 2 to 4's plays, and keeps Step 1's open", () => {
    // Arrange
    const deck = mountSteps()

    for (const n of [1, 2, 3, 4]) {
      // Act
      deck.show(n)

      // Assert: WEB-SPEC, Toys 1, Before the choice; FACTS 1a
      for (const sel of [
        '[data-iv-sign="sharp"]',
        '[data-iv-sign="flat"]',
        '[data-iv-fold]',
        '[data-iv-curl]',
        '[data-iv-play="c-f-fs"]',
        '[data-iv-play="c-g-gb"]',
        '[data-iv-play="fold-g"]',
        '[data-iv-play="fold-e"]',
        '[data-iv-play="b-f"]',
      ])
        expect(held(sel), `${sel} in step ${n}`).toBe(true)
      expect(held('[data-iv-play="c-e"]')).toBe(false)
      expect(held('[data-iv-play="c-eb"]')).toBe(false)
    }
  })

  it('plays nothing from a held play, and draws only the white-key lanes', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)

    // Act
    el<HTMLButtonElement>('[data-iv-play="c-f-fs"]').click()

    // Assert: eight white-key lanes, no black-key lane, no sound
    expect(runs).toHaveLength(0)
    expect(el('#toyStaff').querySelectorAll('.iv-lane.is-white')).toHaveLength(
      8,
    )
    expect(el('#toyStaff').querySelectorAll('.iv-lane.is-black')).toHaveLength(
      0,
    )
  })

  it("draws E flat's own lane as Step 1's second play sounds it, and no other black-key lane", () => {
    // Arrange
    mountSteps()

    // Act
    el<HTMLButtonElement>('[data-iv-play="c-eb"]').click()
    runs[0].note(0)
    runs[0].note(1)

    // Assert: C3 then E flat 3 on the bass staff, the learner's octave
    expect(runs[0].notes.map((x) => x.midi)).toEqual([48, 51])
    expect(el('#toyStaff').querySelectorAll('.iv-lane.is-black')).toHaveLength(
      1,
    )
  })

  it('offers what it held once the choice is in, the signs by their rule', () => {
    // Arrange
    const deck = mountSteps()

    // Act
    deck.steps.unlock()

    // Assert: Step 1 opens on E, which takes Flat and no Sharp
    for (const sel of [
      '[data-iv-fold]',
      '[data-iv-curl]',
      '[data-iv-play="c-f-fs"]',
      '[data-iv-play="c-g-gb"]',
      '[data-iv-play="fold-g"]',
      '[data-iv-play="fold-e"]',
      '[data-iv-play="b-f"]',
    ])
      expect(held(sel), sel).toBe(false)
    expect(held('[data-iv-sign="flat"]')).toBe(false)
    expect(held('[data-iv-sign="sharp"]')).toBe(true)
  })
})

describe("the steps' plays", () => {
  it('play their pair on the toy, the button lit while it sounds, and the readout counts it', async () => {
    // Arrange
    mountSteps()
    const play = el<HTMLButtonElement>('[data-iv-play="c-e"]')

    // Act
    play.click()
    const lit = play.classList.contains('is-on')
    runs[0].note(0)
    runs[0].note(1)
    runs[0].end(true)
    await settle()

    // Assert: C3, then E3 0.75 s later (FACTS 66, 70)
    expect(runs[0].notes.map((x) => [x.t, x.midi, x.dur])).toEqual([
      [0, 48, 0.6],
      [0.75, 52, 0.8],
    ])
    expect(lit).toBe(true)
    expect(play.classList.contains('is-on')).toBe(false)
    expect(words(el('#toyStaff [data-iv-readout]'))).toBe(
      'C up to E: 3 letters · 4 semitones · a major third',
    )
    expect(words(el('#toyStaff [data-staff-said]'))).toBe(
      'C3 up to E3: 3 letters, 4 semitones, a major third.',
    )
  })

  it("play Step 4's pairs together, B and F, then C and E, 3.0 s", () => {
    // Arrange
    const deck = mountSteps()
    deck.steps.unlock()
    deck.show(4)

    // Act
    el<HTMLButtonElement>('[data-iv-play="b-f"]').click()

    // Assert: FACTS 29, 70; on the bass staff, B2 and F3, then C3 and E3
    expect(runs[0].notes.map((x) => [x.t, x.midi, x.dur])).toEqual([
      [0, 47, 1.5],
      [0, 53, 1.5],
      [1.5, 48, 1.5],
      [1.5, 52, 1.5],
    ])
  })

  it("stop when the step changes, the toy's play cut short", () => {
    // Arrange
    const deck = mountSteps()
    el<HTMLButtonElement>('[data-iv-play="c-e"]').click()

    // Act
    deck.show(2)

    // Assert
    expect(runs[0].stopped).toBe(true)
  })
})

describe("the learner's staff", () => {
  it("is the bass staff with no voice stored, and follows Sing it's choice of the higher voice at once", () => {
    // Arrange
    const deck = mountSteps()
    const before = deck.steps.toy.clef

    // Act
    VoiceChoice.set('higher')

    // Assert: FACTS 8; written as it sounds, the treble an octave up
    expect(before).toBe('bass')
    expect(deck.steps.toy.clef).toBe('treble')
    el<HTMLButtonElement>('[data-iv-play="c-e"]').click()
    expect(runs[0].notes.map((x) => x.midi)).toEqual([60, 64])
  })
})
