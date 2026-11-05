// ============================================================
// The native Progress page's stylesheet: its twins, its themes, its floor
// ============================================================
//
// Read from the stylesheets, since jsdom lays nothing out:
//   - the tab's scroller keeps a focused control as clear of the chrome as
//     its padding keeps a hand's (MISTAKES.md, the scroll padding's twin):
//     the rail and the parked run's pill at the foot, the small bar at the
//     top;
//   - every colour the night draws, the day draws too, so the light theme
//     never shows a night ink on a white card;
//   - nothing is set under 13 px.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(
    /\/\*[\s\S]*?\*\//gu,
    '',
  )

const PAGE = read('./progress.css')
/** The page's three stylesheets, as its chunk loads them. */
const ALL = [
  PAGE,
  read('./progress-cards.css'),
  read('./progress-sheets.css'),
].join('\n')
const KIT = read('../../../../../src/styles/mobile-kit.css')

/** The declarations of the first rule for exactly this selector. */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const found = new RegExp(
    `(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`,
    'u',
  ).exec(css)
  if (found === null) throw new Error(`no rule for ${selector}`)
  return found[1]
}

/** One declaration's value, spaced flat. */
function value(css: string, selector: string, property: string): string {
  const found = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`, 'u').exec(
    rule(css, selector),
  )
  if (found === null) throw new Error(`no ${property} on ${selector}`)
  return found[1]
    .replace(/\s+/gu, ' ')
    .replace(/\( /gu, '(')
    .replace(/ \)/gu, ')')
    .trim()
}

/** The custom properties a rule declares, by name. */
function tokens(css: string, selector: string): string[] {
  return [...rule(css, selector).matchAll(/(--[\w-]+)\s*:/gu)].map(
    (match) => match[1],
  )
}

describe("the Progress tab's scroll padding", () => {
  it('keeps the rail clear of a focused control as the padding keeps it of a hand', () => {
    expect(
      value(
        PAGE,
        ':root[data-native-shell] .main-content:has(.mp-prog)',
        'scroll-padding-bottom',
      ),
    ).toBe(
      value(KIT, ':root[data-native-shell] .main-content', 'padding-bottom'),
    )
  })

  it('keeps the parked run’s pill clear the same way', () => {
    expect(
      value(
        PAGE,
        ":root[data-native-shell][data-shell-pill='on'] .main-content:has(.mp-prog)",
        'scroll-padding-bottom',
      ),
    ).toBe(
      value(
        KIT,
        ":root[data-native-shell][data-shell-pill='on'] .main-content",
        'padding-bottom',
      ),
    )
  })

  it('keeps the small bar clear at the top, as tall as the bar is', () => {
    expect(
      value(
        PAGE,
        ':root[data-native-shell] .main-content:has(.mp-prog)',
        'scroll-padding-top',
      ),
    ).toBe(value(PAGE, '.mp-prog-bar', 'height'))
  })
})

describe("the Progress page's two themes", () => {
  it('draws by day every colour it draws at night', () => {
    const night = tokens(PAGE, '.mp-prog').filter(
      (name) => name.startsWith('--prog-') || name.startsWith('--sheet-'),
    )
    const day = new Set(tokens(PAGE, ":root[data-theme='light'] .mp-prog"))
    const geometry = new Set(['--sheet-radius', '--sheet-max-h'])
    expect(night.length).toBeGreaterThan(40)
    expect(
      night.filter((name) => !geometry.has(name) && !day.has(name)),
    ).toEqual([])
  })
})

describe("the Progress page's type", () => {
  it('sets nothing under 13 px', () => {
    const sizes = [
      ...ALL.matchAll(/font:\s*\d+\s+(\d+(?:\.\d+)?)px/gu),
      ...ALL.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/gu),
    ].map((match) => Number(match[1]))
    expect(sizes.length).toBeGreaterThan(30)
    expect(sizes.filter((size) => size < 13)).toEqual([])
  })
})
