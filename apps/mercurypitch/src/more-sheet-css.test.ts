// ============================================================
// The More sheet's stylesheet holds to its spec, and to its portal
// ============================================================
//
// The sheet portals to <body> and takes its custom properties with it as a
// snapshot made when it opens (src/components/portal-skin.ts), the inks
// among them. So its grounds are tokens on `.mp-shell`, light and dark, and
// never a theme selector on the portalled panel: one of those would follow a
// theme the phone switched while the sheet was open, and draw the old
// theme's ink on the new theme's card. Here rather than beside shell.css,
// because src/shell/ runs under jsdom, which gives no file URL to read from.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./shell/shell.css', import.meta.url), 'utf8')
const bare = css.replace(/\/\*[\s\S]*?\*\//gu, '')

/** Every innermost rule, as its selectors and its declarations. */
const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map((m) => ({
  selectors: m[1].split(',').map((one) => one.trim()),
  body: m[2],
}))

function bodyOf(selector: string): string {
  return rules
    .filter((rule) => rule.selectors.includes(selector))
    .map((rule) => rule.body)
    .join('\n')
}

const moreRules = rules.filter((rule) =>
  rule.selectors.some((selector) => selector.includes('mp-more')),
)

describe("the More sheet's stylesheet", () => {
  it('keys no rule of the portalled sheet on the theme', () => {
    const themed = moreRules.filter((rule) =>
      rule.selectors.some((selector) => selector.includes('data-theme')),
    )
    expect(themed.map((rule) => rule.selectors.join(', '))).toEqual([])
  })

  it('puts its grounds on the shell, for the dark and for the light', () => {
    for (const selector of [
      '.mp-shell',
      ":root[data-theme='light'] .mp-shell",
    ]) {
      expect(bodyOf(selector), selector).toMatch(/--mp-more-sheet:/u)
      expect(bodyOf(selector), selector).toMatch(/--mp-more-card:/u)
    }
    expect(bodyOf("[role='dialog'].mp-more")).toMatch(
      /--sheet-bg:\s*var\(--mp-more-sheet\)/u,
    )
  })

  it('draws nothing under 13 px', () => {
    const sizes = moreRules.flatMap((rule) =>
      [...rule.body.matchAll(/font:\s*\d+\s+(\d+)px/gu)].map((m) =>
        Number(m[1]),
      ),
    )
    expect(sizes.length).toBeGreaterThan(0)
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(13)
  })

  it('makes every row 56 px, with a 30 px chip', () => {
    expect(bodyOf('.mp-more-row')).toMatch(/min-height:\s*56px/u)
    expect(bodyOf('.mp-more-row__chip')).toMatch(/width:\s*30px/u)
    expect(bodyOf('.mp-more-row__chip')).toMatch(/height:\s*30px/u)
  })

  // A tablet keeps :hover on the last row a finger tapped (MISTAKES.md).
  it('keeps hover for a pointer that hovers', () => {
    expect(bare.match(/\.mp-more-row:hover/gu)?.length).toBe(1)
    expect(bare).toMatch(/@media \(hover: hover\)\s*\{\s*\.mp-more-row:hover/u)
  })
})
