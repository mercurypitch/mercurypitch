// ============================================================
// Home's session card, brought into view by the plan: clear of the foot's chrome
// ============================================================
//
// The plan's Start here row that is today's session brings Home's session card
// into view, as little as will do (startPlannedSession, scrollIntoView with
// `block: 'nearest'`), and focuses its first button. On a phone the tab bar
// floats over the window's foot, so a card that already fitted the window
// behind the bar was not scrolled at all, and its button ended under the bar
// (the PR 1.3 gate, H-10: "Practice again" under "Primary navigation" at
// 390x844). The card's scroll margin is what the browser keeps clear when it
// brings it in: the foot stack, as lib/foot-space.ts publishes it (the tab
// bar's real height and gap, safe-area inset included, and the cookie and
// confirm bars that stand on it), and nothing where none is drawn.
//
// jsdom applies no CSS, so this reads the sheet as text; the browser walk
// measures where the button lands.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** The tab bar's footprint, as BottomTabBar publishes it (foot-stack-css.test.ts pins the name). */
const TABBAR_SPACE_VAR = '--tabbar-space'

/** The sheet's text, comments gone. */
const css = readFileSync('src/pages/HomePage.module.css', 'utf8').replace(
  /\/\*[\s\S]*?\*\//gu,
  '',
)

/** The declarations of the rule whose selector is exactly `selector`, by property. */
function rule(selector: string): Record<string, string> {
  const escaped = selector.replaceAll('.', '\\.')
  const found = new RegExp(
    `(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`,
    'u',
  ).exec(css)
  return Object.fromEntries(
    (found?.[1] ?? '')
      .split(';')
      .map((declaration) => [
        declaration.slice(0, declaration.indexOf(':')).trim(),
        declaration
          .slice(declaration.indexOf(':') + 1)
          .replace(/\s+/gu, ' ')
          .trim(),
      ])
      .filter(([property]) => property !== ''),
  )
}

describe("the session card's scroll margin", () => {
  const session = rule('.sessionInline')

  it('reads the rule the session card wears', () => {
    expect(session['border-top']).toBe(
      '1px solid var(--border-color, var(--border))',
    )
    expect(rule('.nothing-like-this')).toEqual({})
  })

  it('keeps the whole foot stack clear below it, from the spaces the stack publishes', () => {
    const bottom = session['scroll-margin-bottom'] ?? ''

    expect(bottom).toContain(`var(${TABBAR_SPACE_VAR}, 0px)`)
    expect(bottom).toContain('var(--consent-banner-space, 0px)')
    expect(bottom).toContain('var(--verify-banner-space, 0px)')
    // The tallest of them, as the toasts stand on it, plus air.
    expect(bottom).toMatch(/^calc\( ?max\(/u)
  })

  it('asks for nothing where no bar is drawn: every space falls back to 0', () => {
    const bottom = session['scroll-margin-bottom'] ?? ''
    const spaces = [...bottom.matchAll(/var\((--[\w-]+)(?:, ([^)]*))?\)/gu)]

    expect(spaces.length).toBe(3)
    expect(spaces.map((space) => space[2])).toEqual(['0px', '0px', '0px'])
  })
})
