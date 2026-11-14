// ============================================================
// Lesson 28 steps tests — four states on one stage, held for the cold open
// ============================================================
//
// The WEB-SPEC's Toys 2 and 3, on the page's own markup and deck, its
// score a double: each step's own controls on the stage, the lock line on
// every step until the cold open's choice and on none after it; the plays
// in the steps' text disabled, with their names, until the choice, then
// playing on the toy in their step's state; and Step 2's words behind its
// held line until the reveal (FACTS 46).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { resetScores } from './score-double.test-fixtures'
import { A, B, barsOf, bothNotes, GOING, join } from './song'
import type { Steps } from './steps'
import { initSteps } from './steps'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))
vi.mock(
  '@/features/lessons/kit/score',
  async () => (await import('./score-double.test-fixtures')).scoreDouble,
)

beforeEach(() => {
  resetRuns()
  resetScores()
  soundOn()
})

afterEach(() => {
  // a newer sound stops what the test started
  NowPlaying.claim(() => undefined)
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

const lastRun = () => runs[runs.length - 1]
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
      rows.push([
        shows(el('#toyScore [data-form-strip]')),
        shows(el('#toyScore .controls[data-part="2"]')),
        shows(el('#toyScore .controls[data-part="4"]')),
        shows(el('#toyScore [data-pitch-line]')),
        shows(el('#toyScore [data-lock-line]')),
      ])
    }

    // Assert: the form strip on 3, the ways on 2, Play both on 4, the pitch line on 1 and 4
    expect(rows).toEqual([
      [false, false, false, true, true],
      [false, true, false, false, true],
      [true, false, false, false, true],
      [false, false, true, true, true],
    ])
    expect(steps.toy.state).toBe(4)
  })

  it('puts the lock line away with the choice, on every step, and opens the toy', () => {
    const { deck, steps } = mount()
    steps.unlock()
    const lines: boolean[] = []
    for (const n of [1, 2, 3, 4]) {
      deck.show(n)
      lines.push(shows(el('#toyScore [data-lock-line]')))
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
      'phrase1',
      'phrase2',
      'interrupted',
      'plagal',
      'bridge',
      'tavi',
      'merc',
    ])
    expect(plays.every((b) => b.disabled && b.textContent.trim() !== '')).toBe(
      true,
    )
  })

  it("play on the toy, in their step's state, once the choice is in", async () => {
    // Arrange
    const { deck, steps } = mount()
    steps.unlock()
    deck.show(3)

    // Act
    el<HTMLButtonElement>('[data-step-play="bridge"]').click()
    await settle()

    // Assert: B, then A, bars 17 to 32
    expect(steps.toy.state).toBe(3)
    expect(lastRun().notes).toEqual(bothNotes(join(B, A)))
  })

  it('show their own step first when pressed in a step the deck has not reached, so the toy and its heading agree', async () => {
    // Arrange: a wide page, Step 2's text on screen while the deck is on Step 1
    const { deck, steps } = mount()
    steps.unlock()
    steps.reveal()

    // Act
    el<HTMLButtonElement>('[data-step-play="interrupted"]').click()
    await settle()

    // Assert: Toys 2, each step draws its own state
    expect([deck.current, el('#stepNow').textContent]).toEqual([2, '2'])
    expect(steps.toy.state).toBe(2)
    expect(lastRun().notes).toEqual(bothNotes(barsOf(GOING, 7, 10)))
  })
})

describe("Step 2's held words", () => {
  it('stay behind their held line until the reveal, then show', () => {
    // Arrange
    const { steps } = mount()
    const before = [
      shows(el('.held-body[data-held="2"]')),
      shows(el('.held-line[data-held-line="2"]')),
    ]

    // Act
    steps.reveal()

    // Assert
    expect(before).toEqual([false, true])
    expect(el('.held-line[data-held-line="2"]').hidden).toBe(true)
    expect(el('.held-body[data-held="2"]').hidden).toBe(false)
  })
})
