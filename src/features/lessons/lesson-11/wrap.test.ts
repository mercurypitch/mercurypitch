// ============================================================
// Lesson 11 wrap tests — the practice card's two versions, and free play
// ============================================================
//
// WEB-SPEC, Sections and Toys 4, on the page's own markup: the practice
// card links the Exercises tab with the lesson, until Sing it's ending
// picks the rest card, which links nothing and says to rest; free play
// mounts the steps' chart under its own state switch, Gears first.

import { afterEach, describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { el, loadPage } from './page-dom.test-fixtures'
import { initWrap } from './wrap'

afterEach(() => {
  VisitEnding.set('practise')
  document.body.textContent = ''
})

describe("Lesson 11's wrap", () => {
  it('links the Siren exercise from the practice card, with the lesson', () => {
    // Arrange
    loadPage()

    // Act
    initWrap()

    // Assert
    const card = el<HTMLAnchorElement>('#practiseCard')
    expect(card.getAttribute('href')).toBe('/pitch-training?lesson=11')
    expect(el('#practiseCard [data-ending="practise"]').hidden).toBe(false)
    expect(el('#practiseCard [data-ending="rest"]').hidden).toBe(true)
  })

  it('turns to the rest card after an ending that asks for rest, linking nothing', () => {
    // Arrange
    loadPage()
    initWrap()

    // Act
    VisitEnding.set('rest')

    // Assert
    const card = el<HTMLAnchorElement>('#practiseCard')
    expect(card.hasAttribute('href')).toBe(false)
    expect(el('#practiseCard [data-ending="rest"]').hidden).toBe(false)
    expect(el('#practiseCard .eyebrow').textContent).toBe('Rest today')
  })

  it('opens free play on Gears, under its own switches', () => {
    // Arrange
    loadPage()

    // Act
    const toy = initWrap()

    // Assert
    expect(toy.state).toBe('gears')
    expect(
      el('#freePlay [data-free-state="gears"]').getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      el('#freePlay [data-gear-play="lower"]').closest('[hidden]'),
    ).toBeNull()
  })
})
