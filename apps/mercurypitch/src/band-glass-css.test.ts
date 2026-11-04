// ============================================================
// The band's words read over the darkest room, in the light theme
// ============================================================
//
// The rail, the More circle and the transport float over the rooms, and
// every room is a dark picture in either theme. In light their glass was
// the kit's 72 % of the light grey: over the alley, the Sing room's studio,
// the Ear Lab or a stage it turned a mid grey, and the rail's labels fell
// to 3:1, the selected one, in the fill accent on its plate, to 2:1 (3.6:1
// even over a light page). The band reads one glass token now, a white
// glass in light, and the selected item writes in the theme's accent for
// text. Worked out here from shell.css and the light theme's tokens in
// app.css, over black, the darkest room there is; jsdom applies no
// stylesheet.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(
    /\/\*[\s\S]*?\*\//gu,
    '',
  )

const SHELL = read('./shell/shell.css')
const APP = read('../../../src/styles/app.css')

type Rgb = readonly [number, number, number]

/** The light theme's hex tokens over the dark `:root` ones. */
const LIGHT = ((): Map<string, string> => {
  const tokens = new Map<string, string>()
  for (const block of [':root', "[data-theme='light']"]) {
    const at = APP.indexOf(`\n${block} {`)
    const body = APP.slice(at, APP.indexOf('\n}', at))
    for (const [, name, hex] of body.matchAll(
      /(--[\w-]+):\s*(#[\da-f]{6});/giu,
    )) {
      tokens.set(name, hex)
    }
  }
  return tokens
})()

const rgb = (hex: string): Rgb => {
  const [r, g, b] = (hex.match(/[\da-f]{2}/giu) ?? []).map((pair) =>
    Number.parseInt(pair, 16),
  )
  return [r, g, b]
}

const token = (name: string): Rgb => {
  const hex = LIGHT.get(name)
  if (hex === undefined) throw new Error(`no ${name} in the light theme`)
  return rgb(hex)
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

/** Every rule's body for exactly this selector, in order, joined. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  return [
    ...SHELL.matchAll(
      new RegExp(`(?<=^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'gu'),
    ),
  ]
    .map((match) => match[1])
    .join(';')
}

/** The light band glass over black, as the light rule mixes it. */
function lightGlassOverBlack(): Rgb {
  const mixed =
    /--mp-band-glass:\s*color-mix\(in srgb, (#[\da-f]{6}|var\((--[\w-]+)\)) (\d+)%, transparent\);/u.exec(
      rule(":root[data-theme='light'] .mp-shell"),
    )
  if (mixed === null) throw new Error('no light band glass this reads')
  const color = mixed[2] === undefined ? rgb(mixed[1]) : token(mixed[2])
  return over(color, Number(mixed[3]) / 100, [0, 0, 0])
}

/** The ink a rule writes in light: a token, or its first fallback. */
function inkOf(body: string): Rgb {
  const said = /(?:^|;)\s*color:\s*var\((--[\w-]+)/u.exec(body)
  if (said === null) throw new Error('no ink this reads')
  return token(said[1])
}

describe("the band's glass", () => {
  it.each(['.mp-rail', '.mp-more-aside', '.mp-transport'])(
    '%s reads the band glass, which is the kit glass in dark',
    (selector) => {
      expect(rule(selector)).toMatch(/background:\s*var\(--mp-band-glass\);/u)
      expect(rule('.mp-shell')).toMatch(
        /--mp-band-glass:\s*var\(--glass-bg\);/u,
      )
    },
  )

  it("writes the rail's labels and the transport's time at 4.5:1 or more over the darkest room, in light", () => {
    const ground = lightGlassOverBlack()

    expect(
      contrast(inkOf(rule('.mp-rail__item')), ground),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrast(inkOf(rule('.mp-transport__time')), ground),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it('writes the selected item at 4.5:1 or more on its plate over the darkest room, in light', () => {
    const selected = rule(".mp-rail__item[aria-current='page']")
    const plate =
      /background:\s*color-mix\(in srgb, var\(--accent\) (\d+)%, transparent\);/u.exec(
        selected,
      )

    expect(plate).not.toBeNull()
    const ground = over(
      token('--accent'),
      Number(plate?.[1]) / 100,
      lightGlassOverBlack(),
    )
    expect(contrast(inkOf(selected), ground)).toBeGreaterThanOrEqual(4.5)
  })
})
