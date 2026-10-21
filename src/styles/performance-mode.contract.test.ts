// Performance mode contract — a tier may never paint an element it chose by class name.
//
// performance-mode.css matches on class-name SUBSTRINGS (`[class*='glow' i]`)
// so one attribute on <html> can reach every CSS-module class without editing
// three hundred stylesheets. A substring cannot tell a panel from the scrim
// behind it or the rows inside it. The low tier once gave everything whose
// class contained "overlay", "sheet" or "modal" an opaque background, and the
// frame sampler (src/lib/device-tier.ts) can put any device on that tier in
// the middle of a song: the spotlight tour's full-screen overlay and the Learn
// dialog's backdrop turned solid and the app vanished behind them, and the
// Zen song list's rows became grey bars.
//
// So: a substring-matched rule may only switch an effect off, and the file
// never sets a background on an element at all — a surface that needs a
// solid ground on the low tier gets it through a token (`--glass-bg`).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(
  resolve(process.cwd(), 'src/styles/performance-mode.css'),
  'utf8',
)

interface Rule {
  selectors: string[]
  declarations: { property: string; value: string }[]
}

/** Every innermost `selectors { declarations }` block, comments removed. */
function leafRules(source: string): Rule[] {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1]
      .split(',')
      .map((selector) => selector.trim())
      .filter((selector) => selector !== ''),
    declarations: match[2]
      .split(';')
      .map((declaration) => declaration.trim())
      .filter((declaration) => declaration.includes(':'))
      .map((declaration) => {
        const colon = declaration.indexOf(':')
        return {
          property: declaration.slice(0, colon).trim(),
          value: declaration.slice(colon + 1).trim(),
        }
      }),
  }))
}

const RULES = leafRules(CSS)
const BY_CLASS_NAME = /\[class\s*[*^$|~]?=/

describe('performance-mode.css', () => {
  it('parses into rules', () => {
    expect(RULES.length).toBeGreaterThan(5)
  })

  it('only switches effects off on elements it picked by class name', () => {
    const offenders = RULES.filter((rule) =>
      rule.selectors.some((selector) => BY_CLASS_NAME.test(selector)),
    ).flatMap((rule) =>
      rule.declarations
        .filter(
          ({ property, value }) =>
            !(
              (property === 'filter' || property === 'animation') &&
              /^none(\s*!important)?$/.test(value)
            ),
        )
        .map(
          ({ property, value }) =>
            `${rule.selectors[0]} … { ${property}: ${value} }`,
        ),
    )
    expect(offenders).toEqual([])
  })

  it('never sets an element background, so a scrim stays see-through', () => {
    const painted = RULES.flatMap((rule) =>
      rule.declarations
        .filter(({ property }) => /^background(-color|-image)?$/.test(property))
        .map(({ property }) => `${rule.selectors.join(', ')} { ${property} }`),
    )
    expect(painted).toEqual([])
  })

  it('gives glass chrome its solid ground through the glass token', () => {
    const ground = RULES.filter((rule) =>
      rule.selectors.includes(":root[data-perf-tier='low']"),
    )
      .flatMap((rule) => rule.declarations)
      .filter(({ property }) => property === '--glass-bg')
      .map(({ value }) => value)
    expect(ground).toEqual(['var(--bg-secondary, #161b22)'])
  })
})
