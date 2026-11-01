// ============================================================
// A scroller's edges: more to see above, below, both or neither
// ============================================================
//
// jsdom lays nothing out, so each case gives the scroller its sizes.

import { afterEach, describe, expect, it } from 'vitest'
import { watchScrollEdges } from './scroll-edge'

/** A scroller `client` px tall over `content` px of content. */
function scroller(client: number, content: number): HTMLElement {
  const element = document.createElement('div')
  Object.defineProperty(element, 'clientHeight', { value: client })
  Object.defineProperty(element, 'scrollHeight', { value: content })
  document.body.append(element)
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('the edges of a scroller', () => {
  it('marks nothing where everything fits', () => {
    const element = scroller(400, 400)
    const stop = watchScrollEdges(element)
    expect(element.hasAttribute('data-more-above')).toBe(false)
    expect(element.hasAttribute('data-more-below')).toBe(false)
    stop()
  })

  it('marks the edge there is more past, as it scrolls, until stopped', () => {
    const element = scroller(400, 600)
    const stop = watchScrollEdges(element)
    expect(element.hasAttribute('data-more-above')).toBe(false)
    expect(element.hasAttribute('data-more-below')).toBe(true)

    element.scrollTop = 100
    element.dispatchEvent(new Event('scroll'))
    expect(element.hasAttribute('data-more-above')).toBe(true)
    expect(element.hasAttribute('data-more-below')).toBe(true)

    element.scrollTop = 200
    element.dispatchEvent(new Event('scroll'))
    expect(element.hasAttribute('data-more-above')).toBe(true)
    expect(element.hasAttribute('data-more-below')).toBe(false)

    stop()
    element.scrollTop = 0
    element.dispatchEvent(new Event('scroll'))
    expect(element.hasAttribute('data-more-above')).toBe(true)
  })
})
