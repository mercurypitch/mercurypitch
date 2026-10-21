// ============================================================
// Lesson 6 tune toy tests — a play pressed again keeps what it shows
// ============================================================
//
// The steps' stage on the page's own markup, with sound on: Play pressed
// again while the line plays stays lit for the newer run and goes out
// when that run ends, and the swapped version played again stays on the
// line until its own run ends. The line itself is a canvas jsdom cannot
// read, so the second test reads what the toy tells its line to show.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { createModeStore } from '@/features/lessons/kit/names'
import { el, listen, loadPage } from './page-dom.test-fixtures'
import type { TuneStep, TuneToy } from './tune-toy'
import { mountTuneToy } from './tune-toy'
import type { NamesMode } from './tune-words'
import { NAMES_MODES } from './tune-words'

/** The steps' stage on the page's markup, on `step`. */
function mountStage(step: TuneStep = 1): TuneToy {
  loadPage()
  const toy = mountTuneToy(el('#toyTune'), {
    active: () => true,
    names: createModeStore<NamesMode>(NAMES_MODES, 'letters'),
  })
  toy.setStep(step)
  return toy
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 6's tune toy: a play pressed again", () => {
  it('keeps Play lit for the newer run, and puts it out when that run ends', async () => {
    // Arrange: the first line, a second into its 4 s run
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    listen()
    mountStage()
    const play = el('#toyTune [data-tune-play]')
    play.click()
    await vi.advanceTimersByTimeAsync(1000)

    // Act
    play.click()
    await vi.advanceTimersByTimeAsync(1000)
    const during = play.classList.contains('is-on')
    await vi.advanceTimersByTimeAsync(3100)

    // Assert
    expect(during).toBe(true)
    expect(play.classList.contains('is-on')).toBe(false)
  })

  it('keeps the swapped version on the line for the newer run, and takes it off when that run ends', async () => {
    // Arrange: Step 4, the swapped version a second into its run
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    listen()
    const toy = mountStage(4)
    void toy.playSwapped(true)
    await vi.advanceTimersByTimeAsync(1000)
    const shown = vi.spyOn(toy.core, 'setOverlay')
    const onLine = (): boolean[] => shown.mock.calls.map(([o]) => o !== null)

    // Act
    void toy.playSwapped(true)
    await vi.advanceTimersByTimeAsync(1000)
    const during = onLine()
    await vi.advanceTimersByTimeAsync(3100)

    // Assert: put on for the newer run, and taken off only once it ends
    expect(during).toEqual([true])
    expect(onLine()).toEqual([true, false])
  })
})
