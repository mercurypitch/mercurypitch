// ============================================================
// Staircase toy tests — a page's own starts and states, outside Lesson 4
// ============================================================
//
// Lesson 4's own use, on its page's markup, is lesson-04/stairs-toy.test.ts.
// Here the toy mounts on the least markup it reads, with starts and states a
// later page might hand in: G2 alone, as Lesson 21 starts its lower voice,
// and C3 to B3, as Lesson 20's lower voice slides. The browser doubles turn
// reduced motion on, so every slide lands at once; no drawer is ever active.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { createModeStore } from './names'
import { NAMES_MODES } from './names-modes'
import type { StairsRange } from './stairs-geometry'
import type { StairsState, StairsToy } from './stairs-toy'
import { mountStairsToy, startFromKey } from './stairs-toy'

const MARKUP = `
  <div data-stairs-viz><canvas></canvas><div data-stairs-hits></div></div>
  <p data-stairs-readout></p>
  <p data-stairs-summary></p>
  <p data-stairs-said></p>
  <div data-slide-row>
    <button type="button" data-slide="-1">Start lower</button>
    <div data-start-slider tabindex="0"></div>
    <button type="button" data-slide="1">Start higher</button>
  </div>`

const STILL: StairsState = {
  group: false,
  white: false,
  slide: false,
  names: false,
  stop: false,
  keysPlay: true,
  gold: false,
}

let root: HTMLElement | null = null
let toy: StairsToy<string> | null = null

function mount(
  range: StairsRange,
  states: Readonly<Record<string, StairsState>>,
  initial: string,
): { root: HTMLElement; toy: StairsToy<string> } {
  root = document.createElement('div')
  root.innerHTML = MARKUP
  document.body.appendChild(root)
  toy = mountStairsToy(root, {
    active: () => false,
    names: createModeStore(NAMES_MODES, 'letters'),
    range,
    states,
    initial,
  })
  return { root, toy }
}

afterEach(() => {
  toy?.stop()
  root?.remove()
  toy = null
  root = null
  vi.useRealTimers()
})

const labels = (el: HTMLElement): (string | null)[] =>
  [...el.querySelectorAll('[data-stair]')].map((b) =>
    b.getAttribute('aria-label'),
  )

const press = (el: HTMLElement, key: string): void => {
  el.querySelector('[data-start-slider]')?.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true }),
  )
}

describe('startFromKey', () => {
  it("makes a key do within the page's starts, a higher one the same letter below", () => {
    expect(startFromKey(55, { lo: 48, hi: 59 })).toBe(55)
    expect(startFromKey(62, { lo: 48, hi: 59 })).toBe(50)
    expect(startFromKey(55, { lo: 43, hi: 43 })).toBe(43)
  })
})

describe("the staircase toy on a page's own starts", () => {
  it("stands on G2, below Lesson 4's starts, and names G major's stairs", () => {
    // Act
    const { root: el, toy: t } = mount({ lo: 43, hi: 43 }, { g: STILL }, 'g')

    // Assert
    expect(t.core.tonic).toBe(43)
    expect(labels(el)).toEqual([
      'Stair 1, do, G2, home',
      'Stair 2, re, A2',
      'Stair 3, mi, B2',
      'Stair 4, fa, C3',
      'Stair 5, so, D3',
      'Stair 6, la, E3',
      'Stair 7, ti, F sharp 3',
      'Stair 8, do, G3, home',
    ])
    expect(el.querySelector('[data-slide-row]')?.hasAttribute('hidden')).toBe(
      true,
    )
  })

  it('slides within its starts, Home and End to the lowest and the highest', () => {
    // Arrange
    const { root: el, toy: t } = mount(
      { lo: 48, hi: 59 },
      { slide: { ...STILL, slide: true, keysPlay: false } },
      'slide',
    )

    // Act and assert
    press(el, 'ArrowRight')
    expect(t.core.tonic).toBe(49)
    press(el, 'End')
    expect(t.core.tonic).toBe(59)
    press(el, 'ArrowRight')
    expect(t.core.tonic).toBe(59)
    expect(
      el.querySelector<HTMLButtonElement>('[data-slide="1"]')?.disabled,
    ).toBe(true)
    press(el, 'Home')
    expect(t.core.tonic).toBe(48)
    expect(
      el.querySelector<HTMLButtonElement>('[data-slide="-1"]')?.disabled,
    ).toBe(true)
  })

  it('stands on the start a state names as it opens, and keeps the gold to the states that earn it', async () => {
    // Arrange
    vi.useFakeTimers()
    const { toy: t } = mount(
      { lo: 48, hi: 59 },
      {
        home: { ...STILL, gold: true, standOn: 48 },
        away: { ...STILL, slide: true, keysPlay: false },
      },
      'home',
    )
    const played = t.playUp(false)
    await vi.runAllTimersAsync()
    await played
    expect(t.core.switches.gold).toBe(true)

    // Act
    t.setState('away')
    const slid = t.slideTo(52)
    await vi.runAllTimersAsync()
    await slid

    // Assert: the slide state shows no gold; back home, on C3, it is still earned
    expect(t.core.switches.gold).toBe(false)
    t.setState('home')
    expect(t.core.tonic).toBe(48)
    expect(t.core.switches.gold).toBe(true)
  })
})
