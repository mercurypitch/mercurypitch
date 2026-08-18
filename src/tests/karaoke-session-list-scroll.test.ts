// ============================================================
// One scroller on a phone, and cards you can fit two of
// ============================================================
//
// Reported about the Karaoke tab's session list: "the page scrolls, and then
// when you hit bottom, the inside container also scrolls, but sometimes its
// hard to get that inner container scroll" — and separately that the cards are
// "quite big on mobile, in height too, so I basically see like one and top of
// second when scrolling".
//
// Both measured in Chromium at 390x844 before the fix:
//
//   .panel-content              674 visible / 1857 scrollable
//   .history-list-inline        643 visible / 3197 scrollable, max-height 644px
//   .uvr-session-result         386px tall
//
// Two scrollers, one inside the other, and a card taller than half the
// viewport. After: one scroller, and a 322px card — two fit a 674px panel.
//
// jsdom has no layout, so the geometry is asserted in
// `src/e2e/karaoke-session-list.spec.ts`. This guards the stylesheet, which is
// where a compaction pass would put the nesting back.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/styles/uvr.css', 'utf8')

/** Every block authored under exactly `query`, concatenated. */
function mediaBlock(query: string): string {
  const opener = `${query} {`
  const blocks: string[] = []
  for (
    let start = css.indexOf(opener);
    start !== -1;
    start = css.indexOf(opener, start + 1)
  ) {
    let depth = 1
    let index = start + opener.length
    while (depth > 0 && index < css.length) {
      if (css[index] === '{') depth += 1
      else if (css[index] === '}') depth -= 1
      index += 1
    }
    blocks.push(css.slice(start + opener.length, index - 1))
  }
  expect(blocks.length, `missing ${query}`).toBeGreaterThan(0)
  return blocks.join('\n')
}

/** The declarations of the first rule whose selector list is exactly `sel`. */
function ruleBody(source: string, sel: string): string {
  const opener = `${sel} {`
  const start = source.indexOf(opener)
  expect(start, `missing rule for ${sel}`).toBeGreaterThan(-1)
  const from = start + opener.length
  return source.slice(from, source.indexOf('\n  }', from))
}

const phone = mediaBlock('@media (max-width: 600px)')

describe('the session list on a phone', () => {
  it('stops being a scroller of its own', () => {
    const list = ruleBody(phone, '.history-list')
    expect(list).toContain('overflow-y: visible')
    expect(list).toContain('max-height: none')
  })

  it('drops the inline variant out of the flex sizing too', () => {
    // `.history-list-inline` re-declares `overflow-y: auto` and `flex: 1 1 0`
    // at higher specificity, so relaxing the base rule alone changes nothing.
    const inline = ruleBody(phone, '.history-list.history-list-inline')
    expect(inline).toContain('overflow-y: visible')
    expect(inline).toContain('flex: none')
  })

  it('leaves the page as the one scroller', () => {
    expect(css).toContain('.panel-content')
    expect(ruleBody(css, '.panel-content')).toContain('overflow-y: auto')
  })
})

describe('the desktop grid is untouched', () => {
  it('keeps its three columns, its cap and its own scroll', () => {
    // The nesting is load-bearing there: three columns of cards inside a
    // fixed-height panel is exactly the case an inner scroller is for.
    const base = ruleBody(css, '.history-list')
    expect(base).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(base).toContain('overflow-y: auto')
    expect(base).toContain('max-height: calc(100vh - 200px)')
  })
})

describe('the card gives back the height it was spending', () => {
  it('wraps its actions instead of stacking them', () => {
    const actions = ruleBody(phone, '.session-result-actions')
    // `align-items: stretch` stays — it is what fixed the earlier bug where
    // a 12px icon sat in the corner of a huge padded block. The forced
    // column is the part that cost 40px a card.
    expect(actions).toContain('align-items: stretch')
    expect(actions).not.toContain('flex-direction: column')
  })

  it('keeps a wrapped action wide enough to read', () => {
    expect(ruleBody(phone, '.session-result-actions > *')).toContain(
      'min-width: 8.5rem',
    )
  })

  it('tightens the gap between the card sections', () => {
    // Six stacked sections at 12.8px is 64px of a card spent on air.
    expect(ruleBody(phone, '.uvr-session-result')).toContain('gap: 0.5rem')
  })

  it('still lets the actions wrap when there are three of them', () => {
    // A mixer button joins the row once stems are selected; two fit, the
    // third wraps. That only works if the base rule keeps wrapping on.
    expect(ruleBody(css, '.session-result-actions')).toContain(
      'flex-wrap: wrap',
    )
  })
})
