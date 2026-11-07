// ============================================================
// Lesson 22 wrap tests — free play's holds and its switch, and the practise card
// ============================================================
//
// WEB-SPEC, Toys 2 (item 5) and Practice links, on learn/22.html's own
// markup: free play holds every control, its state switch among them,
// under its lock line until the cold open's choice, and Step 3's held
// controls until Step 3's; its switch opens each state, pressed alone,
// with that state's controls and its still; what it plays stops when the
// card has been off screen for 600 ms; and the practise card shows its
// rest version, with no link, after an ending that rests the voice.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollOutOfView } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { el, loadPage, soundOn, words } from './page-dom.test-fixtures'
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

describe('free play', () => {
  it("holds its switch with every other control under the lock line until the cold open's choice, then all but Step 3's held ones", () => {
    // Arrange
    loadPage()
    const free = initWrap()
    const before = {
      switches: usable(),
      wave: !button('[data-vib-play="wave"]').disabled,
      lock: el('#freePlay [data-vib-lock]').hidden,
    }

    // Act
    free.unlock()

    // Assert: WEB-SPEC, Toys 2, item 5
    expect(before).toEqual({
      switches: [false, false, false, false],
      wave: false,
      lock: false,
    })
    expect(usable()).toEqual([true, true, true, true])
    expect(button('[data-vib-play="wave"]').disabled).toBe(false)
    expect(el('#freePlay [data-vib-lock]').hidden).toBe(true)
    expect(button('[data-vib-play="two"]').disabled).toBe(true)
    expect(button('[data-vib-drift]').disabled).toBe(true)
  })

  it('opens each state from its switch, pressed alone, with its controls and its still', () => {
    // Arrange
    loadPage()
    const free = initWrap()
    free.unlock()

    // Act
    button('[data-free-state="2"]').click()

    // Assert
    expect(free.state).toBe(2)
    expect(switches().map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ])
    expect(el('#freePlay .vib-sliders[data-part="2"]').hidden).toBe(false)
    expect(el('#freePlay .vib-plays[data-part="1"]').hidden).toBe(true)
    // Step 2's still: the wave at the sliders' rate and extent, with its ruler
    expect(free.chart.scene.wave).not.toBeNull()
    expect(free.chart.scene.ruler).not.toBeNull()
  })

  it("puts Step 3's line under its held controls on its state, until Step 3's choice opens them", () => {
    // Arrange
    loadPage()
    const free = initWrap()
    free.unlock()
    const line = el('#freePlay [data-vib-lock3]')

    // Act
    button('[data-free-state="3"]').click()
    const held = {
      line: line.hidden,
      two: button('[data-vib-play="two"]').disabled,
    }
    free.unlockHeld()

    // Assert
    expect(held).toEqual({ line: false, two: true })
    expect(line.hidden).toBe(true)
    expect(button('[data-vib-play="two"]').disabled).toBe(false)
    expect(words(line)).toBe("Answer Step 3's question first to hear this.")
  })

  it('leaves a disabled switch as it is: no state opens before the choice', () => {
    // Arrange
    loadPage()
    const free = initWrap()

    // Act
    button('[data-free-state="4"]').dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )

    // Assert
    expect(free.state).toBe(1)
    expect(button('[data-free-state="1"]').getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('stops what it plays once the card has been off screen for 600 ms', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    loadPage()
    const free = initWrap()
    free.unlock()
    button('[data-vib-play="wave"]').click()
    const playing = runs.at(-1)

    // Act
    scrollOutOfView(el('#freePlay'))
    await vi.advanceTimersByTimeAsync(599)
    const early = playing?.stopped
    await vi.advanceTimersByTimeAsync(1)

    // Assert
    expect(playing?.kind).toBe('line')
    expect(early).toBe(false)
    expect(playing?.stopped).toBe(true)
  })
})

describe('the practise card', () => {
  it('rests the voice after an ending that asks it to, with no link, and is Voice Mirror again after one that does not', () => {
    // Arrange
    loadPage()
    initWrap()
    const card = el('#practiseCard')
    const practise = el('#practiseCard [data-ending="practise"]')
    const rest = el('#practiseCard [data-ending="rest"]')

    // Act
    VisitEnding.set('rest')
    const resting = {
      practise: practise.hidden,
      rest: rest.hidden,
      eyebrow: words(card.querySelector('.eyebrow')),
      address: card.querySelector<HTMLElement>('.addr')?.hidden,
    }
    VisitEnding.set('practise')

    // Assert: WEB-SPEC, Practice links; REQ-GVC-055
    expect(resting).toEqual({
      practise: true,
      rest: false,
      eyebrow: 'Rest today',
      address: true,
    })
    expect([practise.hidden, rest.hidden]).toEqual([false, true])
    expect(words(card.querySelector('.eyebrow'))).toBe(
      'Practise it in MercuryPitch',
    )
  })
})
