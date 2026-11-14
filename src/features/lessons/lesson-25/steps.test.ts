// ============================================================
// Lesson 25 steps tests — a play in a step's text shows its own step
// ============================================================
//
// The WEB-SPEC's Toys 1, on the page's own markup and deck. On a wide page
// the deck follows a band near the screen's middle, so the next step's text
// and its plays show before the deck reaches it. A play pressed there shows
// its own step first, so the toy draws that step's state under that step's
// heading; a play in the step showing leaves the deck where it stands.

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

const button = (sel: string): HTMLButtonElement => el<HTMLButtonElement>(sel)
/** Step 3's own switch on the stage: there on Step 3 alone. */
const raiseLe = (): HTMLElement => el('#toyMinor [data-raise="le"]')

describe("the plays in the steps' text", () => {
  it('show their own step first when pressed in a step the deck has not reached, so the toy and its heading agree', () => {
    // Arrange: a wide page, Step 3's text on screen while the deck is on Step 2
    const { deck } = mount()
    deck.show(2)
    const before = raiseLe().hidden

    // Act: Step 3's play, the melodic minor scale
    button('[data-step-play="melodic"]').click()

    // Assert: Step 3 showing, its own switch on the stage, and the play sounding
    expect([deck.current, el('#stepNow').textContent]).toEqual([3, '3'])
    expect([before, raiseLe().hidden]).toEqual([true, false])
    expect(runs.length).toBeGreaterThan(0)
  })

  it('leave the deck where it stands when pressed in the step showing', () => {
    // Arrange
    const { deck } = mount()
    deck.show(3)
    const show = vi.spyOn(deck, 'show')

    // Act
    button('[data-step-play="melodic"]').click()

    // Assert
    expect(show).not.toHaveBeenCalled()
    expect(deck.current).toBe(3)
    expect(runs.length).toBeGreaterThan(0)
  })
})
