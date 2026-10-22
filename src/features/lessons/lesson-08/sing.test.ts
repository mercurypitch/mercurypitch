// ============================================================
// Lesson 8 Sing it tests — the sung line on the page's own markup
// ============================================================
//
// WEB-SPEC, Toys 6, with the beat clock a recorder
// (page-dom.test-fixtures.ts): a guide cut short asks nothing, so an Again
// stopped part way, here by Move do, leaves its answer, its line and Again
// itself, and the Again after it is still the visit's second guide; Again
// hides with the feeling question while its guide runs, and the keyboard's
// place moves to the status line, never to a button; and Again sits after
// the four feelings, as the card's keyboard order has it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { el, loadPage, resetRuns, runs, settle, soundOn, } from './page-dom.test-fixtures'
import { initSing } from './sing'
import { AFTER, STATUS } from './sing-flow'

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))

/** Sing it mounted, the lower voice chosen and Merc's line heard: Start the guide is ready. */
async function ready(): Promise<void> {
  loadPage()
  initSing({ blue: 'blue.png', orange: 'orange.png' })
  el('[data-comfort="sing"]').click()
  el('[data-panel="voice"] [data-voice="lower"]').click()
  el('[data-line-play]').click()
  runs[runs.length - 1].end(true)
  await settle()
}

/** Runs the guide that `button` starts to its end. */
async function sung(button: string): Promise<void> {
  el(button).click()
  runs[runs.length - 1].end(true)
  await settle()
}

/** Whether the element and every box round it are shown. */
const shown = (selector: string): boolean =>
  el(selector).closest('[hidden]') === null

beforeEach(() => {
  resetRuns()
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 8's sung line", () => {
  it('keeps the answer, its line and Again when Again is cut short, and the next Again is the second guide', async () => {
    // Arrange: one guide sung, "Easy", then Again started
    await ready()
    await sung('[data-guide-start]')
    el('[data-feel="easy"]').click()
    el('[data-guide-again]').click()
    const again = runs[runs.length - 1]

    // Act: Move do stops it part way
    el('[data-move-do="-1"]').click()
    await settle()

    // Assert
    expect(again.stopped).toBe(true)
    expect(shown('[data-panel="feel"]')).toBe(true)
    expect(el('[data-feel="easy"]').getAttribute('aria-pressed')).toBe('true')
    expect(shown('[data-after="done"]')).toBe(true)
    expect(el('#singStatus').textContent).toBe(AFTER.done)
    expect(shown('[data-guide-again]')).toBe(true)
    // and the Again after it runs to its end as the visit's second guide
    await sung('[data-guide-again]')
    el('[data-feel="easy"]').click()
    expect(shown('[data-guide-again]')).toBe(false)
  })

  it("moves the keyboard's place to the status line when Again hides with the question", async () => {
    // Arrange
    await ready()
    await sung('[data-guide-start]')
    el('[data-feel="workable"]').click()
    el('[data-guide-again]').focus()

    // Act
    el('[data-guide-again]').click()

    // Assert
    expect(shown('[data-guide-again]')).toBe(false)
    expect(document.activeElement).toBe(el('#singStatus'))
    expect(el('#singStatus').textContent).toBe(STATUS.guiding)
  })

  it('puts Again after the four feelings, in the keyboard order of the card', () => {
    // Arrange
    loadPage()

    // Act
    const last = el('[data-feel="uncomfortable"]')
    const again = el('[data-guide-again]')
    const after = last.compareDocumentPosition(again)

    // Assert
    expect(after & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(again.closest('[data-panel]')).toBe(el('[data-panel="feel"]'))
  })
})
