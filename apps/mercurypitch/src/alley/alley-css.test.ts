// The alley's stylesheet on the oldest engine it ships to. iOS 16.0 and 16.1
// have no color-mix(): a declaration using it is dropped at parse time, and
// without a plain one before it the property is left unset.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PANEL_WIDTH } from './alley-geometry'

const CSS = readFileSync(
  new URL('./alley.css', import.meta.url),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '')

describe('every color-mix() in alley.css', () => {
  const uses = [...CSS.matchAll(/^\s*([\w-]+):\s*color-mix\(/gmu)]

  it('is there to check', () => {
    expect(uses.length).toBeGreaterThan(0)
  })

  it('comes after a plain declaration of the same property in its rule', () => {
    for (const use of uses) {
      const property = use[1]
      const ruleStart = CSS.lastIndexOf('{', use.index)
      const before = CSS.slice(ruleStart, use.index)
      const fallback = new RegExp(
        `^\\s*${property}:\\s*(?!color-mix)[^;]+;`,
        'mu',
      )
      expect(before, `${property} at offset ${use.index}`).toMatch(fallback)
    }
  })
})

describe('the column on a screen on its side', () => {
  const landscape = (): string => {
    const start = CSS.indexOf('@media (orientation: landscape)')
    expect(start).toBeGreaterThan(-1)
    // The block runs to its own closing brace, the first at a line's start.
    return CSS.slice(start, CSS.indexOf('\n}', start))
  }

  it("is the card's own width, so the card never reaches the doors", () => {
    // placePanelInColumn puts a PANEL_WIDTH card at the column's padding
    // edge, and alleyFit keeps the doors right of the column's own edge.
    expect(landscape()).toContain(
      `width: calc(max(16px, var(--safe-left, 0px)) + ${PANEL_WIDTH}px + 16px);`,
    )
    expect(landscape()).toMatch(/padding-right:\s*16px/u)
  })

  it('gives the welcome up to the card while a door is picked', () => {
    for (const phase of ['selected', 'alive']) {
      expect(landscape()).toMatch(
        new RegExp(
          `\\.mp-alley\\[data-phase='${phase}'\\] \\.mp-alley__intro(?![\\w-])[^{]*\\{[^}]*opacity:\\s*0`,
          'u',
        ),
      )
    }
  })
})

describe("the Ear Lab's drift", () => {
  it("pivots in the paint img's own coordinates", () => {
    const rule = /\.is-drifting \.mp-alley__paint img\s*\{([^}]*)\}/u.exec(CSS)
    expect(rule?.[1]).toMatch(/transform-origin:\s*var\(--px\) var\(--py\)/u)
  })
})
