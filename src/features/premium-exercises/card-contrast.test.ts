// ============================================================
// The picker's cards keep their edge in every theme
// ============================================================
//
// The exercise picker is a kit Sheet, and the Sheet follows the app theme:
// its panel is the theme's --bg-secondary. The cards were tinted with Dark's
// text colour, light on dark, and under Light that tint matched the sheet:
// fill, edge and art square all at 1.00 against what lies under them
// (review C of PR 973, minor 2), so a card read as loose text.
//
// This reads the shipped CSS, works out each theme's colours, and asks for
// a card that reads as a card: an edge of at least 1.2 against the sheet, a
// fill of 1.05, and an art square of 1.1 against the card. Dark meets them
// at 1.37, 1.10 and 1.24, as it always did; with the tints taken from each
// theme's own text colour, Light meets them at 1.25, 1.08 and 1.16.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { THEME_PRESETS } from '@/stores/theme-store'

const APP_CSS = readFileSync('src/styles/app.css', 'utf8')
const CARDS_CSS = readFileSync(
  'src/features/premium-exercises/premium-exercises.module.css',
  'utf8',
)

type Rgb = readonly [number, number, number]
interface Paint {
  readonly rgb: Rgb
  readonly alpha: number
}

/** The body of the first rule whose selector is exactly `selector`. */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const head = new RegExp(`^${escaped} \\{`, 'mu').exec(css)
  if (head === null) throw new Error(`no rule ${selector}`)
  const start = head.index + head[0].length
  const end = css.indexOf('}', start)
  return css.slice(start, end)
}

function property(body: string, name: string): string {
  const found = new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'mu').exec(body)
  if (found === null) throw new Error(`no ${name}`)
  return found[1].trim()
}

function tokens(body: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const [, name, value] of body.matchAll(
    /^\s*(--[\w-]+):\s*([^;]+);/gmu,
  )) {
    found.set(name, value.trim())
  }
  return found
}

const ROOT = tokens(rule(APP_CSS, ':root'))

function themeTokens(theme: string): Map<string, string> {
  if (theme === 'dark') return ROOT
  return new Map([...ROOT, ...tokens(rule(APP_CSS, `[data-theme='${theme}']`))])
}

/** A colour as the CSS writes it, in the forms these rules use. */
function paint(value: string, theme: Map<string, string>): Paint {
  const text = value.trim()
  const token = /^var\((--[\w-]+)(?:,\s*(.+))?\)$/u.exec(text)
  if (token !== null) {
    const next = theme.get(token[1]) ?? token[2]
    if (next === undefined) throw new Error(`unset ${token[1]}`)
    return paint(next, theme)
  }
  const hex = /^#([\da-f]{6})$/iu.exec(text)
  if (hex !== null) {
    const channels = [0, 2, 4].map((at) =>
      Number.parseInt(hex[1].slice(at, at + 2), 16),
    )
    return { rgb: channels as unknown as Rgb, alpha: 1 }
  }
  const rgb = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+)%)?\)$/u.exec(text)
  if (rgb !== null) {
    return {
      rgb: [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])],
      alpha: rgb[4] === undefined ? 1 : Number(rgb[4]) / 100,
    }
  }
  const mix = /^color-mix\(in srgb, (.+) ([\d.]+)%, transparent\)$/u.exec(text)
  if (mix !== null) {
    // Mixed with transparent, the colour keeps its channels and takes the
    // share as its alpha (CSS Color 5, premultiplied interpolation).
    const base = paint(mix[1], theme)
    return { rgb: base.rgb, alpha: (base.alpha * Number(mix[2])) / 100 }
  }
  throw new Error(`unread colour ${text}`)
}

function over(top: Paint, under: Rgb): Rgb {
  return top.rgb.map(
    (channel, i) => channel * top.alpha + under[i] * (1 - top.alpha),
  ) as unknown as Rgb
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** One theme's card, as contrast ratios against what lies under each part. */
function card(theme: string): { edge: number; fill: number; art: number } {
  const colours = themeTokens(theme)
  const sheet = paint('var(--bg-secondary)', colours).rgb
  const body = rule(CARDS_CSS, '.card')
  const fill = over(paint(property(body, 'background'), colours), sheet)
  // The background runs under the border (background-clip: border-box).
  const border = property(body, 'border').replace(/^\d+px solid /u, '')
  const edge = over(paint(border, colours), fill)
  const artPaint = property(rule(CARDS_CSS, '.cardArt'), 'background')
  const art = over(paint(artPaint, colours), fill)
  return {
    edge: contrast(edge, sheet),
    fill: contrast(fill, sheet),
    art: contrast(art, fill),
  }
}

const round = (ratio: number): number => Math.round(ratio * 100) / 100

describe("the exercise picker's cards, in every theme", () => {
  it.each(THEME_PRESETS)(
    '%s: an edge, a fill and an art square that show',
    (theme) => {
      const seen = card(theme)

      expect(round(seen.edge), 'edge against the sheet').toBeGreaterThanOrEqual(
        1.2,
      )
      expect(round(seen.fill), 'fill against the sheet').toBeGreaterThanOrEqual(
        1.05,
      )
      expect(
        round(seen.art),
        'art square against the card',
      ).toBeGreaterThanOrEqual(1.1)
    },
  )

  it('leaves Dark as it was', () => {
    expect(Object.values(card('dark')).map(round)).toEqual([1.37, 1.1, 1.24])
  })
})
