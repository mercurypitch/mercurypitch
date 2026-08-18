// ============================================================
// The golden rail runs the length of the shelf, not of one screen
// ============================================================
//
// Reported from the Progress tab: the rail under the milestones "is only
// extending to fill that initial view, 3 first badges, but not through the
// full list when I drag and scroll to see others."
//
// The cause is one of the quieter CSS rules. `.milestoneShelf` is both
// `position: relative` and `overflow-x: auto`, and an absolutely positioned
// child of a scroll container resolves `left`/`right` against the PADDING BOX
// — the scrollport — not against the scrollable content. So the rail was
// exactly one screenful wide and, being inside the scroller, slid away with
// the content it was supposed to sit under.
//
// jsdom has no layout, so the geometry itself is asserted in
// `src/e2e/progress.spec.ts` — the contract there is that the element owning
// the rail must not be the element that scrolls. This file guards the
// stylesheet, which is where the rail would drift back.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  'src/features/progress/ProgressPage.module.css',
  'utf8',
)

/** The declarations of the first rule whose selector list is exactly `sel`. */
function ruleBody(sel: string): string {
  const opener = `\n${sel} {`
  const start = css.indexOf(opener)
  expect(start, `missing rule for ${sel}`).toBeGreaterThan(-1)
  const from = start + opener.length
  const end = css.indexOf('\n}', from)
  return css.slice(from, end)
}

describe('the milestone shelf rail', () => {
  it('is drawn on the wrapper, not on the scroller', () => {
    expect(css).toContain('.shelfRail::after')
    // The old selector survives in the comment that explains why it went, so
    // the rules have to be read without their prose.
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain(
      '.milestoneShelf::after',
    )
  })

  it('gives the wrapper a containing block and nothing that scrolls', () => {
    const rail = ruleBody('.shelfRail')
    expect(rail).toContain('position: relative')
    expect(rail).not.toMatch(/overflow/)
  })

  it('keeps the shelf the scroller, so the objects still swipe', () => {
    const shelf = ruleBody('.milestoneShelf')
    expect(shelf).toContain('overflow-x: auto')
  })

  it('sits above the scrollbar rather than under it', () => {
    // The owner's words: "the golden bottom border line, BEFORE the
    // scrollbar itself". The wrapper has no scrollbar of its own, so the
    // gutter has to be spelled out.
    expect(ruleBody('.shelfRail')).toContain('--shelf-scrollbar: 4px')
    expect(ruleBody('.shelfRail::after')).toContain(
      'bottom: var(--shelf-scrollbar)',
    )
  })

  it('drops the gutter on the phone, where the scrollbar is hidden', () => {
    const hidden = css.indexOf(
      '.milestoneShelf::-webkit-scrollbar {\n    display: none;',
    )
    expect(hidden).toBeGreaterThan(-1)
    expect(css.slice(hidden, hidden + 400)).toContain('--shelf-scrollbar: 0px')
  })

  it('still looks like a shelf edge', () => {
    const rail = ruleBody('.shelfRail::after')
    expect(rail).toContain('border-top: 1px solid rgb(216 187 121 / 42%)')
    expect(rail).toContain('pointer-events: none')
  })
})
