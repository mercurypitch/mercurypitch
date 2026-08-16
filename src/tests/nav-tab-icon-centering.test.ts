// ============================================================
// The selected tab's icon sits centred in its pill
// ============================================================
//
// In icon-only mode (`#app-tabs.tabs-icon-only`, and the phone block's
// font-size:0 tabs) the name is hidden and the icon is the whole label, so
// the active pill's padding is all that positions it. A stray
// `.app-tab svg { margin-right: 6px }` in vocal-analysis.css — a leftover
// "Tab styles" block from the page that class was borrowed from years ago
// — survived the hidden label and pushed every icon 6px left of centre,
// which is exactly what the owner saw on the selected tab. jsdom has no
// layout, so the contract is read off the stylesheets: nothing outside the
// nav's own module may size or space `.app-tab` icons.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Every rule body whose selector mentions `.app-tab` in the given file. */
function appTabRules(css: string): { selector: string; body: string }[] {
  const rules: { selector: string; body: string }[] = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  for (const match of css.matchAll(re)) {
    const selector = match[1]!.trim()
    if (selector.includes('.app-tab')) {
      rules.push({ selector, body: match[2]! })
    }
  }
  return rules
}

describe('the selected tab icon stays centred in its pill', () => {
  const styleDir = 'src/styles'
  const globalSheets = readdirSync(styleDir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => join(styleDir, f))

  it('no global sheet gives .app-tab icons a margin', () => {
    for (const sheet of globalSheets) {
      const offenders = appTabRules(readFileSync(sheet, 'utf8')).filter(
        (rule) =>
          /\bsvg\b|tab-icon|tabIcon/.test(rule.selector) &&
          /margin/.test(rule.body),
      )
      expect(
        offenders,
        `${sheet}: ${offenders.map((o) => o.selector).join(', ')}`,
      ).toEqual([])
    }
  })

  it('the icon-only pill keeps symmetric side padding', () => {
    // 5px 8px: with the label display:none and no icon margin, equal side
    // padding is what centres the icon. A one-sided padding tweak here
    // would reintroduce the drift this test exists to stop.
    const app = readFileSync('src/styles/app.css', 'utf8')
    const iconOnly = app.match(
      /#app-tabs\.tabs-icon-only \.app-tab\s*\{([^}]*)\}/,
    )
    expect(iconOnly).not.toBeNull()
    expect(iconOnly![1]).toMatch(/padding:\s*5px 8px/)
    expect(iconOnly![1]).toMatch(/gap:\s*0/)
  })

  it('the nav module owns icon spacing through the flex gap', () => {
    const module = readFileSync('src/components/AppNavTabs.module.css', 'utf8')
    // The labelled tab's icon-to-name distance is the button's gap — the
    // one knob that vanishes cleanly when the label is hidden.
    expect(module).toMatch(/:global\(\.app-tab\)\s*\{[^}]*gap:\s*5px/)
    expect(module).not.toMatch(/\.tabIcon\s*\{[^}]*margin/)
  })
})
