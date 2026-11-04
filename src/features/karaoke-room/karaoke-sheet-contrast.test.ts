// ============================================================
// The Karaoke room's sheets — small words read in both themes
// ============================================================
//
// Two places where a small, quiet word fell under 4.5:1. Find by singing's
// clock sits on a backing of its own over the newest stretch of the sung
// line; the backing was a fixed dark under the theme's grey ink, so on the
// light theme's sheet the clock read 1.8:1, and it follows the theme now,
// as its ink does. And the library's song length kept its muted ink on the
// current song's accent tint, 4.3:1 in either theme; there it takes the
// secondary ink. Worked out from the rules as written and the two themes'
// tokens in app.css, over the sheet's ground; jsdom applies no stylesheet.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8')

const APP_CSS = source('src/styles/app.css')
const ROOM_CSS = source('src/features/karaoke-room/karaoke-room.module.css')

type Rgb = readonly [number, number, number]
type Theme = ReadonlyMap<string, string>

/** A theme's hex tokens: the dark `:root` block, or the light override. */
function tokens(block: ':root' | "[data-theme='light']"): Map<string, string> {
  const at = APP_CSS.indexOf(`\n${block} {`)
  const body = APP_CSS.slice(at, APP_CSS.indexOf('\n}', at))
  const found = new Map<string, string>()
  for (const [, name, hex] of body.matchAll(
    /(--[\w-]+):\s*(#[\da-f]{6});/giu,
  )) {
    found.set(name, hex)
  }
  return found
}

const DARK: Theme = tokens(':root')
const LIGHT: Theme = new Map([...DARK, ...tokens("[data-theme='light']")])
const THEMES = [
  ['dark', DARK],
  ['light', LIGHT],
] as const

const rgb = (hex: string): Rgb => {
  const [r, g, b] = (hex.match(/[\da-f]{2}/giu) ?? []).map((pair) =>
    Number.parseInt(pair, 16),
  )
  return [r, g, b]
}

const over = (top: Rgb, alpha: number, under: Rgb): Rgb => [
  top[0] * alpha + under[0] * (1 - alpha),
  top[1] * alpha + under[1] * (1 - alpha),
  top[2] * alpha + under[2] * (1 - alpha),
]

const luminance = (color: Rgb): number => {
  const [r, g, b] = color.map((channel) => {
    const v = channel / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** A token's value in a theme: its alias followed, else the fallback. */
function resolveToken(theme: Theme, name: string, fallback: string): Rgb {
  const alias: Record<string, string> = { '--text-tertiary': '--text-muted' }
  return rgb(theme.get(alias[name] ?? name) ?? fallback)
}

/** A rule's body, by its selector as written. */
const rule = (selector: string): string =>
  new RegExp(
    `\\n${selector.replace(/\./gu, '\\.')}\\s*\\{([\\s\\S]*?)\\n\\}`,
    'u',
  ).exec(ROOM_CSS)?.[1] ?? ''

/** The ink a rule writes, in a theme. */
function inkOf(body: string, theme: Theme): Rgb | null {
  const said = /\n\s*color:\s*var\((--[\w-]+), (#[\da-f]{6})\);/u.exec(body)
  return said === null ? null : resolveToken(theme, said[1], said[2])
}

/** The sheet's own ground. */
const sheetGround = (theme: Theme): Rgb =>
  rgb(theme.get('--bg-secondary') ?? '#000000')

/** The clock's backing over the sheet's ground, as the rule writes it. */
function clockBacking(theme: Theme): Rgb {
  const clock = rule('.findClock')
  const mixed =
    /background:\s*color-mix\(in srgb, var\((--[\w-]+), (#[\da-f]{6})\) (\d+)%, transparent\);/u.exec(
      clock,
    )
  if (mixed !== null) {
    const color = resolveToken(theme, mixed[1], mixed[2])
    return over(color, Number(mixed[3]) / 100, sheetGround(theme))
  }
  const fixed = /background:\s*rgb\((\d+) (\d+) (\d+) \/ (\d+)%\);/u.exec(clock)
  if (fixed === null) throw new Error('the clock has no backing this reads')
  const color: Rgb = [Number(fixed[1]), Number(fixed[2]), Number(fixed[3])]
  return over(color, Number(fixed[4]) / 100, sheetGround(theme))
}

/** The current song row's tint over the sheet's ground. */
function currentRowGround(theme: Theme): Rgb {
  const tint =
    /background:\s*color-mix\(in srgb, var\(--accent, (#[\da-f]{6})\) (\d+)%, transparent\);/u.exec(
      rule('.songRowCurrent'),
    )
  if (tint === null) throw new Error('the current row has no tint this reads')
  const accent = resolveToken(theme, '--accent', tint[1])
  return over(accent, Number(tint[2]) / 100, sheetGround(theme))
}

describe("the Karaoke room's sheets", () => {
  it.each(THEMES)(
    "write Find by singing's clock at 4.5:1 or more on its backing in %s",
    (_, theme) => {
      const ink = inkOf(rule('.findClock'), theme)

      expect(ink).not.toBeNull()
      expect(
        contrast(ink ?? [0, 0, 0], clockBacking(theme)),
      ).toBeGreaterThanOrEqual(4.5)
    },
  )

  it.each(THEMES)(
    "write the current song's length at 4.5:1 or more on its tint in %s",
    (_, theme) => {
      const ink =
        inkOf(rule('.songRowCurrent .songLength'), theme) ??
        inkOf(rule('.songLength'), theme)

      expect(ink).not.toBeNull()
      expect(
        contrast(ink ?? [0, 0, 0], currentRowGround(theme)),
      ).toBeGreaterThanOrEqual(4.5)
    },
  )
})
