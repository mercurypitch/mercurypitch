// ============================================================
// Lesson 8 tap take tests — the status line once sound comes back on
// ============================================================
//
// WEB-SPEC, Toys 6, on the page's own markup with the beat clock a
// recorder (page-dom.test-fixtures.ts). Neither the take nor the groove
// runs with sound off, and each says so in the take's status; once sound
// is back on, whichever runs next takes that line down, the groove for
// the ready line and the take for its count-in, so the status never says
// that something didn't run while it runs.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { Sound } from '@/features/lessons/kit/sound'
import { el, loadPage, resetRuns, runs } from './page-dom.test-fixtures'
import { initTake, TAKE_STATUS } from './take'

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))

/** The take mounted on the page's markup, in a browser with Web Audio. */
function mounted(): HTMLElement {
  loadPage()
  // the take only asks whether there is one; the fake clock plays nothing
  vi.stubGlobal('AudioContext', vi.fn())
  initTake(document.body)
  return el('#takeStatus')
}

beforeEach(() => {
  resetRuns()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.textContent = ''
})

describe("Lesson 8's tap take with sound off, then on", () => {
  it("takes down Start's sound-off line when the groove plays", () => {
    // Arrange: Start pressed with sound off, then sound on
    vi.spyOn(Sound, 'canPlay').mockReturnValueOnce(false).mockReturnValue(true)
    const status = mounted()
    el('[data-take-start]').click()
    const off = status.textContent

    // Act
    el('[data-take-groove]').click()

    // Assert
    expect(off).toBe(TAKE_STATUS.soundOff)
    expect(runs).toHaveLength(1)
    expect(status.textContent).toBe(TAKE_STATUS.ready)
  })

  it("takes down the groove's sound-off line as soon as a take starts", () => {
    // Arrange: Play the groove pressed with sound off, then sound on
    vi.spyOn(Sound, 'canPlay').mockReturnValueOnce(false).mockReturnValue(true)
    const status = mounted()
    el('[data-take-groove]').click()
    const off = status.textContent

    // Act: Start, before the clock has counted a beat
    el('[data-take-start]').click()

    // Assert
    expect(off).toBe(TAKE_STATUS.grooveSoundOff)
    expect(runs).toHaveLength(1)
    expect(status.textContent).toBe(TAKE_STATUS.countIn)
  })
})
