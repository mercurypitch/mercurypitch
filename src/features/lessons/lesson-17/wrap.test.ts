// ============================================================
// Lesson 17 wrap tests — the practice card's rest line
// ============================================================
//
// On the page's own markup (WEB-SPEC, Practice links; FACTS 56): the rest
// line shows above the card's text only while the sung bars' ending is
// rest, and The Chart's link stays either way, since it asks for no voice.

import { afterEach, describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { el, loadPage } from './page-dom.test-fixtures'
import { initWrap } from './wrap'

afterEach(() => {
  VisitEnding.set('practise')
  document.body.textContent = ''
})

describe('the practice card', () => {
  it("shows the rest line only once the sung bars' ending is rest, keeping The Chart's link", () => {
    // Arrange
    loadPage()
    initWrap()
    const rest = el('#practiseCard [data-ending="rest"]')
    const before = rest.hidden

    // Act
    VisitEnding.set('rest')
    const resting = rest.hidden
    VisitEnding.set('practise')

    // Assert
    expect([before, resting, rest.hidden]).toEqual([true, false, true])
    expect(el('#practiseCard a.addr').getAttribute('href')).toBe(
      '/ear-lab?lesson=17',
    )
  })
})
