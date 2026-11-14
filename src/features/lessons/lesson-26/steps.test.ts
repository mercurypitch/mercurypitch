// ============================================================
// Lesson 26 steps tests — four states on one stage, held for the cold open
// ============================================================
//
// The WEB-SPEC's Toys 2 and Tests 5, on the page's own markup and deck:
// each step's own controls on the stage, the lock line on every step until
// the cold open's choice and on none after it; the plays in the steps'
// text disabled, with their names, until the choice, then playing on the
// toy in that step's state; and Steps 1 and 2's words behind their held
// lines until the reveal.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { el, loadPage, soundOn } from './page-dom.test-fixtures'
import type { Steps } from './steps'
import { initSteps } from './steps'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  resetRuns()
  soundOn()
})

afterEach(() => {
  // a newer sound stops what the test started, before its timers are real again
  NowPlaying.claim(() => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

/** The steps on the page's own markup and deck, as main.ts mounts them. */
function mount(): { deck: StepDeck; steps: Steps } {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  const steps = initSteps(deck)
  deck.start()
  return { deck, steps }
}

/** Whether `e` shows: neither it nor a parent is hidden. */
function shows(e: Element): boolean {
  for (let at: Element | null = e; at !== null; at = at.parentElement)
    if (at instanceof HTMLElement && at.hidden) return false
  return true
}

const last = () => runs[runs.length - 1]
const button = (sel: string): HTMLButtonElement => el<HTMLButtonElement>(sel)
const textPlays = (): HTMLButtonElement[] =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('[data-step-play]'))

describe('the stage, step by step', () => {
  it("shows each step's own controls, and on every step the lock line, until the choice", () => {
    // Arrange
    const { deck, steps } = mount()
    const rows: boolean[][] = []

    // Act
    for (const n of [1, 2, 3, 4]) {
      deck.show(n)
      rows.push(
        [1, 2, 3, 4].map((k) =>
          shows(el(`#toyTune .controls[data-part="${k}"]`)),
        ),
      )
      rows[rows.length - 1].push(shows(el('#toyTune [data-lock-line]')))
    }

    // Assert
    expect(rows).toEqual([
      [true, false, false, false, true],
      [false, true, false, false, true],
      [false, false, true, false, true],
      [false, false, false, true, true],
    ])
    expect(steps.toy.state).toBe(4)
  })

  it('puts the lock line away with the choice, on every step, and opens the toy', () => {
    const { deck, steps } = mount()
    steps.unlock()
    const lines: boolean[] = []
    for (const n of [1, 2, 3, 4]) {
      deck.show(n)
      lines.push(shows(el('#toyTune [data-lock-line]')))
    }
    expect(lines).toEqual([false, false, false, false])
    expect(steps.toy.held).toBe(false)
  })
})

describe("the plays in the steps' text", () => {
  it('wait, disabled with their names, until the choice', () => {
    mount()
    const plays = textPlays()
    expect(plays.map((b) => b.dataset.stepPlay)).toEqual([
      'thirds',
      'copy',
      'above',
      'below',
      'duet',
      'part-chord',
      'tune-chord',
    ])
    expect(plays.every((b) => b.disabled && b.textContent.trim() !== '')).toBe(
      true,
    )
  })

  it("play on the toy, in their step's state, once the choice is in", () => {
    // Arrange
    const { deck, steps } = mount()
    steps.unlock()
    deck.show(3)

    // Act
    button('[data-step-play="below"]').click()

    // Assert: la ti do ti la under do re mi re do
    expect(steps.toy.settings.side).toBe('below')
    expect(last().notes.map((n) => n.midi)).toEqual([
      60, 57, 62, 59, 64, 60, 62, 59, 60, 57,
    ])
  })

  it('show their own step first when pressed in a step the deck has not reached, so the toy and its heading agree', () => {
    // Arrange: a wide page, Step 3's text on screen while the deck is on Step 2
    const { deck, steps } = mount()
    steps.unlock()
    deck.show(2)

    // Act
    button('[data-step-play="below"]').click()

    // Assert: Toys 2, each step draws its own state
    expect([deck.current, el('#stepNow').textContent]).toEqual([3, '3'])
    expect([steps.toy.state, steps.toy.settings.side]).toEqual([3, 'below'])
    expect(last().notes.map((n) => n.midi)).toEqual([
      60, 57, 62, 59, 64, 60, 62, 59, 60, 57,
    ])
  })
})

describe("Steps 1 and 2's held words", () => {
  it('stay behind their held lines until the reveal, then show', () => {
    // Arrange
    const { steps } = mount()
    const before = [
      shows(el('.held-body[data-held="1"]')),
      shows(el('.held-line[data-held-line="1"]')),
    ]

    // Act
    steps.reveal()

    // Assert
    expect(before).toEqual([false, true])
    for (const n of [1, 2]) {
      expect(el(`.held-line[data-held-line="${n}"]`).hidden).toBe(true)
      expect(el(`.held-body[data-held="${n}"]`).hidden).toBe(false)
    }
  })
})
