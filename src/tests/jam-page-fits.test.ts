// ============================================================
// The jam page fits its container
// ============================================================
//
// The jam session stacks a room header, a transport row, an exercise
// canvas and a pitch strip inside .main-content, which is the app's
// scroll container. The canvas measures its parent and writes its size
// inline, so if any ancestor is allowed to grow to its content, the
// canvas's height becomes the page's height and the whole app scrolls —
// which is what happened: a permanent vertical scrollbar in every room.
//
// Every ancestor between .main-content and the canvas already carries
// min-height:0 and overflow:hidden for exactly this reason. .page did
// not, and `flex: 1 0 auto` (shrink 0) made it structurally unable to.
// jsdom cannot lay this out, so the guard is on the declarations
// themselves: they are the contract the layout depends on.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = (file: string): string =>
  readFileSync(resolve(__dirname, '../..', file), 'utf8')

/** The declarations of one top-level rule, by selector. */
function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`)
  expect(start, `${selector} not found`).toBeGreaterThan(-1)
  return source.slice(start, source.indexOf('}', start))
}

describe('jam page height chain', () => {
  const page = () => ruleBody(css('src/pages/JamPage.module.css'), '.page')

  it('can shrink to its container', () => {
    const body = page()
    // flex-shrink must not be 0 — in any of its spellings.
    expect(body).not.toMatch(/flex:\s*\d+\s+0\s/)
    expect(body).not.toMatch(/flex-shrink:\s*0/)
  })

  it('does not fall back to its content as a minimum height', () => {
    expect(page()).toMatch(/min-height:\s*0/)
  })

  it('keeps every ancestor of the canvas bounded', () => {
    const panel = css('src/components/jam/JamPanel.module.css')
    for (const selector of ['.sessionLayout', '.mainArea', '.canvasArea']) {
      const body = ruleBody(panel, selector)
      expect(body, `${selector} must allow shrinking`).toMatch(
        /min-height:\s*0/,
      )
      expect(body, `${selector} must not scroll`).toMatch(/overflow:\s*hidden/)
    }
  })

  it('lets the exercise canvas shrink rather than push', () => {
    const body = ruleBody(
      css('src/components/jam/JamPanel.module.css'),
      '.exerciseCanvas',
    )
    expect(body).toMatch(/min-height:\s*0/)
    expect(body).toMatch(/flex:\s*1/)
  })
})
