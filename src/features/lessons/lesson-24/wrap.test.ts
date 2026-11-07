// ============================================================
// Lesson 24 wrap tests — free play's holds and its switch, and the practise card
// ============================================================
//
// WEB-SPEC, Toys 2 (item 5) and Practice links, on learn/24.html's own
// markup: free play holds every control, its state switch among them,
// under its lock line until the cold open's choice; after it the switch
// opens each state, pressed alone, Steps 2 to 4 held under the figure's
// own line, every play that sets the piano's mi or so against the drone
// waiting, until Step 2's choice; what it plays stops when the card has
// been off screen for 600 ms; and the practise card shows its rest version,
// with no link, after an ending that rests the voice.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollOutOfView } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { el, loadPage, soundOn } from './page-dom.test-fixtures'
import { initWrap } from './wrap'

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
  vi.useRealTimers()
  vi.restoreAllMocks()
  VisitEnding.set('practise')
  document.body.textContent = ''
})

const button = (sel: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`#freePlay ${sel}`)
const switches = (): HTMLButtonElement[] =>
  Array.from(document.querySelectorAll('#freePlay [data-free-state]'))
const usable = (): boolean[] => switches().map((b) => !b.disabled)
const pressed = (): string[] =>
  switches().map((b) => b.getAttribute('aria-pressed') ?? '')

describe('free play', () => {
  it("holds its switch and every control under the lock line until the cold open's choice", () => {
    // Arrange
    loadPage()
    const free = initWrap()
    const before = {
      switches: usable(),
      play: !button('[data-drone-play="222"]').disabled,
      top: !el<HTMLInputElement>('#freePlay input[data-drone-top]').disabled,
      lock: el('#freePlay [data-drone-lock]').hidden,
    }

    // Act
    free.unlock()

    // Assert: WEB-SPEC, Toys 2, item 5; FACTS 46
    expect(before).toEqual({
      switches: [false, false, false, false],
      play: false,
      top: false,
      lock: false,
    })
    expect(usable()).toEqual([true, true, true, true])
    expect(button('[data-drone-play="222"]').disabled).toBe(false)
    expect(el('#freePlay [data-drone-lock]').hidden).toBe(true)
  })

  it("opens each state from its switch, pressed alone; Steps 2 to 4 held under the figure's own line until Step 2's choice", () => {
    // Arrange
    loadPage()
    const free = initWrap()
    free.unlock()

    // Act
    button('[data-free-state="3"]').click()
    const held = {
      state: free.toy.state,
      line: el('#freePlay [data-drone-lock2]').hidden,
      mi: button('[data-drone-play="mi-piano"]').disabled,
    }
    free.unlockStep2()

    // Assert
    expect(pressed()).toEqual(['false', 'false', 'true', 'false'])
    expect(held).toEqual({ state: 3, line: false, mi: true })
    expect(el('#freePlay [data-drone-lock2]').hidden).toBe(true)
    expect(button('[data-drone-play="mi-piano"]').disabled).toBe(false)
  })

  it("holds Step 2's state too, where no predict sits beside it, its beads and its plays waiting", () => {
    // Arrange
    loadPage()
    const free = initWrap()
    free.unlock()

    // Act
    button('[data-free-state="2"]').click()

    // Assert: drone-toy.ts, `free`
    expect(free.toy.state).toBe(2)
    expect(el('#freePlay [data-drone-lock2]').hidden).toBe(false)
    expect(button('[data-drone-bead="mi"]').disabled).toBe(true)
    expect(button('[data-drone-play="chord"]').disabled).toBe(true)
  })

  it('stops what it plays once the card has been off screen for 600 ms', () => {
    // Arrange
    vi.useFakeTimers()
    loadPage()
    const free = initWrap()
    free.unlock()
    button('[data-drone-play="222"]').click()

    // Act
    scrollOutOfView(el('#freePlay'))
    vi.advanceTimersByTime(600)

    // Assert
    expect(runs[0].stopped).toBe(true)
  })
})

describe('the practise card', () => {
  it("shows the drill's card, and its rest version with no link after an ending that rests the voice", () => {
    // Arrange
    loadPage()
    initWrap()
    const card = el('#practiseCard')
    const before = [
      el('#practiseCard [data-ending="practise"]').hidden,
      el('#practiseCard [data-ending="rest"]').hidden,
    ]

    // Act
    VisitEnding.set('rest')

    // Assert: REQ-GVC-055
    expect(before).toEqual([false, true])
    expect(el('#practiseCard [data-ending="practise"]').hidden).toBe(true)
    expect(el('#practiseCard [data-ending="rest"]').hidden).toBe(false)
    expect(card.querySelector('[data-ending="rest"] a')).toBeNull()
  })
})
