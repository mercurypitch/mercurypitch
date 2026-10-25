// ============================================================
// Lesson 4 staircase toy tests — its buttons, slider and switches, in the page's markup
// ============================================================
//
// The toy mounts on learn/04.html's own steps stage, so the markup the page
// ships is the markup these tests drive. The browser doubles turn reduced
// motion on, so every slide lands at once; no drawer is ever active.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { createModeStore } from '@/features/lessons/kit/names'
import { NAMES_MODES } from '@/features/lessons/kit/names-modes'
import type { StairsToy } from './stairs-toy'
import { mountStairsToy, startFromKey } from './stairs-toy'
import { summary } from './stairs-words'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/04.html'), 'utf8')

let root: HTMLElement
let toy: StairsToy

beforeEach(() => {
  const doc = new DOMParser().parseFromString(PAGE, 'text/html')
  const stage = doc.querySelector('#toyStairs')
  if (stage === null) throw new Error('learn/04.html has no #toyStairs')
  root = document.importNode(stage, true) as HTMLElement
  document.body.appendChild(root)
  toy = mountStairsToy(root, {
    active: () => false,
    names: createModeStore(NAMES_MODES, 'letters'),
  })
})

afterEach(() => {
  toy.stop()
  root.remove()
  vi.useRealTimers()
})

const slider = (): HTMLElement => root.querySelector('[data-start-slider]')!
const press = (key: string): void => {
  slider().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}
const stairLabels = (): (string | null)[] =>
  [...root.querySelectorAll('[data-stair]')].map((b) =>
    b.getAttribute('aria-label'),
  )

describe('startFromKey', () => {
  it("makes a key of C4 to B4 do, and a higher key the same letter's start below it", () => {
    expect(startFromKey(62)).toBe(62)
    expect(startFromKey(74)).toBe(62)
    expect(startFromKey(84)).toBe(60)
  })
})

describe('the staircase toy', () => {
  it('opens on C with eight stair buttons, each saying its stair, its name and its note', () => {
    expect(stairLabels()).toEqual([
      'Stair 1, do, C4, home',
      'Stair 2, re, D4',
      'Stair 3, mi, E4',
      'Stair 4, fa, F4',
      'Stair 5, so, G4',
      'Stair 6, la, A4',
      'Stair 7, ti, B4',
      'Stair 8, do, C5, home',
    ])
  })

  it('keeps the slider and the later switches out of steps 1 and 2', () => {
    // Act
    toy.setStep(2)

    // Assert
    expect(root.querySelector<HTMLElement>('[data-slide-row]')?.hidden).toBe(
      true,
    )
    expect(root.querySelector<HTMLElement>('[data-stairs-group]')?.hidden).toBe(
      false,
    )
    expect(root.querySelector<HTMLElement>('[data-stairs-white]')?.hidden).toBe(
      true,
    )
  })

  it('moves the slider a semitone per arrow key, and to C and B with Home and End', () => {
    // Arrange
    toy.setStep(3)

    // Act and assert
    press('ArrowRight')
    press('ArrowUp')
    expect(slider().getAttribute('aria-valuenow')).toBe('62')
    expect(slider().getAttribute('aria-valuetext')).toBe(
      'Do is D4: D major, two black keys',
    )
    expect(stairLabels()[2]).toBe('Stair 3, mi, F sharp 4')
    press('End')
    expect(slider().getAttribute('aria-valuenow')).toBe('71')
    press('ArrowUp')
    expect(slider().getAttribute('aria-valuenow')).toBe('71')
    press('Home')
    expect(slider().getAttribute('aria-valuenow')).toBe('60')
  })

  it('says the new start 700 ms after a slide', () => {
    // Arrange
    vi.useFakeTimers()
    toy.setStep(3)
    const said = root.querySelector<HTMLElement>('[data-stairs-said]')!

    // Act
    press('ArrowRight')
    vi.advanceTimersByTime(700)

    // Assert
    expect(said.textContent).toBe(summary(61))
  })

  it('drops the summary a slide has queued when it stops', () => {
    // Arrange
    vi.useFakeTimers()
    toy.setStep(3)
    const said = root.querySelector<HTMLElement>('[data-stairs-said]')!
    press('ArrowRight')
    const before = said.textContent

    // Act
    toy.stop()
    vi.advanceTimersByTime(700)

    // Assert
    expect(said.textContent).toBe(before)
  })

  it('names the slider within C4 to B4 and disables the button at each end', () => {
    // Arrange
    toy.setStep(3)
    const lower = root.querySelector<HTMLButtonElement>('[data-slide="-1"]')!
    const higher = root.querySelector<HTMLButtonElement>('[data-slide="1"]')!

    // Assert
    expect(slider().getAttribute('role')).toBe('slider')
    expect(slider().getAttribute('aria-valuemin')).toBe('60')
    expect(slider().getAttribute('aria-valuemax')).toBe('71')
    expect(lower.disabled).toBe(true)
    higher.click()
    expect(lower.disabled).toBe(false)
    expect(slider().getAttribute('aria-valuenow')).toBe('61')
  })

  it('turns White keys only off on a black start, still focusable, with its hint', () => {
    // Arrange
    toy.setStep(3)
    const white = root.querySelector<HTMLButtonElement>('[data-stairs-white]')!
    const hint = root.querySelector<HTMLElement>('[data-white-hint]')!

    // Act
    press('ArrowRight')

    // Assert
    expect(white.getAttribute('aria-disabled')).toBe('true')
    expect(white.disabled).toBe(false)
    expect(hint.hidden).toBe(false)
    expect(hint.textContent?.trim()).toBe('Start on a white key to compare')
    press('ArrowRight')
    expect(white.getAttribute('aria-disabled')).toBe('false')
    expect(hint.hidden).toBe(true)
  })

  it('spells F sharp major with E sharp on stair 7', () => {
    // Arrange
    toy.setStep(4)

    // Act
    for (let k = 0; k < 6; k++) press('ArrowUp')

    // Assert
    expect(stairLabels()[6]).toBe('Stair 7, ti, E sharp 5')
    expect(root.querySelector('[data-start-value]')?.textContent).toBe(
      'Do is F♯4',
    )
  })

  it('stands steps 1 and 2 back on C', () => {
    // Arrange
    toy.setStep(5)
    press('End')

    // Act
    toy.setStep(1)

    // Assert
    expect(toy.core.tonic).toBe(60)
    expect(stairLabels()[0]).toBe('Stair 1, do, C4, home')
  })

  it("names both of Group's brackets, shown only while Group is on", () => {
    // Arrange
    toy.setStep(2)
    const group = root.querySelector<HTMLButtonElement>('[data-stairs-group]')!
    const brackets = [
      ...root.querySelectorAll<HTMLButtonElement>('[data-bracket]'),
    ]

    // Act
    group.click()

    // Assert
    expect(group.getAttribute('aria-pressed')).toBe('true')
    expect(brackets.map((b) => b.hidden)).toEqual([false, false])
    expect(brackets.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Play the first group: C, D, E, F',
      'Play the second group: G, A, B, C',
    ])
    group.click()
    expect(brackets.map((b) => b.hidden)).toEqual([true, true])
  })
})
