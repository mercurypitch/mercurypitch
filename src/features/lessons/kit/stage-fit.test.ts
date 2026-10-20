// ============================================================
// Lesson stage fit tests — the chrome, read with the caps lifted
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { fitStage, stageChrome } from './stage-fit'

/** A card's and its figure's heights, px. */
type Heights = readonly [card: number, figure: number]

/**
 * A stage whose card and figure report `lifted` heights while the stage is
 * being measured and `capped` ones otherwise, since jsdom lays nothing out.
 * `null` gives the active toy no figure.
 */
function stagePage(
  heights: { lifted: Heights; capped: Heights } | null,
): HTMLElement {
  const figure = heights === null ? '' : '<div class="viz"></div>'
  document.body.innerHTML = `<div class="steps-stage" id="stepsStage"><div class="card stage-card"><div class="toy is-active">${figure}</div></div></div>`
  const stage = document.getElementById('stepsStage') as HTMLElement
  if (heights === null) return stage
  const report = (selector: string, i: 0 | 1): void => {
    const el = stage.querySelector(selector) as HTMLElement
    el.getBoundingClientRect = () =>
      ({
        height: stage.classList.contains('is-measuring')
          ? heights.lifted[i]
          : heights.capped[i],
      }) as DOMRect
  }
  report('.stage-card', 0)
  report('.viz', 1)
  return stage
}

const chrome = (stage: HTMLElement): string =>
  stage.style.getPropertyValue('--stage-chrome')

afterEach(() => {
  document.body.textContent = ''
})

describe('fitStage', () => {
  it('reads the chrome with the figure at its own height, so a capped figure never grows it', () => {
    // Arrange: capped, Lesson 1's octave ladder holds the card taller than its figure
    const stage = stagePage({ lifted: [641, 330], capped: [577, 253] })

    // Act
    fitStage(stage, false)

    // Assert
    expect(chrome(stage)).toBe('311px')
    expect(stage.classList.contains('is-measuring')).toBe(false)
  })

  it('rounds the chrome up, so the figure is never a fraction too tall', () => {
    // Arrange
    const stage = stagePage({ lifted: [634.8, 330], capped: [634.8, 330] })

    // Act
    fitStage(stage, false)

    // Assert
    expect(chrome(stage)).toBe('305px')
  })

  it("clears on the deck the chrome a stuck stage wrote, as the deck's stage scrolls with the page", () => {
    // Arrange
    const stage = stagePage({ lifted: [641, 330], capped: [641, 330] })
    fitStage(stage, false)
    const stuck = chrome(stage)

    // Act
    fitStage(stage, true)

    // Assert
    expect(stuck).toBe('311px')
    expect(chrome(stage)).toBe('')
  })

  it('writes no chrome for a toy with no figure to give way', () => {
    // Arrange
    const stage = stagePage(null)

    // Act
    fitStage(stage, false)

    // Assert
    expect(stageChrome(stage)).toBeNull()
    expect(chrome(stage)).toBe('')
  })
})
