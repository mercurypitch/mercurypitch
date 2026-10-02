// The rail's custom properties set with color-mix() each have an rgba twin.
// ============================================================
//
// An engine without color-mix() (Chromium before 111, Safari before 16.2,
// Firefox before 113) keeps a custom property whose value uses it, because a
// custom property is never invalid when the sheet is parsed, and then cannot
// use it: every var() that reads it is invalid when the style is computed,
// and the control or the track loses its fill. The fallback the build writes
// before a color-mix() declaration cannot help a custom property, so each
// one is set again, as rgba, under @supports not (color: color-mix(...)).

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIL = resolve(process.cwd(), 'src/components/stem-mixer/rail')
const NO_COLOR_MIX =
  /@supports\s+not\s*\(\s*color:\s*color-mix\([^)]*\)\s*\)\s*\{/g

const read = (sheet: string): string =>
  readFileSync(resolve(RAIL, sheet), 'utf8')

/** The text of a block, from just inside `{` at `open` to its own `}`. */
function blockAt(css: string, open: number): { body: string; end: number } {
  let depth = 1
  let at = open
  while (depth > 0 && at < css.length) {
    if (css[at] === '{') depth += 1
    else if (css[at] === '}') depth -= 1
    at += 1
  }
  return { body: css.slice(open, at - 1), end: at }
}

/** Every `--name: value;` in some CSS, value read to its own semicolon. */
function customProperties(css: string): [string, string][] {
  const found: [string, string][] = []
  const name = /(--[\w-]+)\s*:/g
  let match: RegExpExecArray | null
  while ((match = name.exec(css)) !== null) {
    let depth = 0
    let at = name.lastIndex
    while (at < css.length) {
      const c = css[at]
      if (c === '(') depth += 1
      else if (c === ')') depth -= 1
      else if (depth === 0 && (c === ';' || c === '}')) break
      at += 1
    }
    found.push([match[1]!, css.slice(name.lastIndex, at).trim()])
  }
  return found
}

/** A sheet split into its @supports not (color-mix) blocks and the rest. */
function split(css: string): { fallbacks: string; rest: string } {
  let fallbacks = ''
  let rest = ''
  let from = 0
  for (const match of css.matchAll(NO_COLOR_MIX)) {
    const open = match.index + match[0].length
    const { body, end } = blockAt(css, open)
    rest += css.slice(from, match.index)
    fallbacks += body
    from = end
  }
  return { fallbacks, rest: rest + css.slice(from) }
}

const sheets = readdirSync(RAIL).filter((name) => name.endsWith('.module.css'))
const mixed = sheets.flatMap((sheet) =>
  customProperties(split(read(sheet)).rest)
    .filter(([, value]) => value.includes('color-mix('))
    .map(([property]) => [sheet, property] as const),
)

describe('the rail without color-mix()', () => {
  it('finds the custom properties set with color-mix()', () => {
    expect(mixed).toEqual(
      expect.arrayContaining([
        ['MixerCapsule.module.css', '--mixer-control-bg'],
        ['MixerTimeline.module.css', '--loop-range-track'],
      ]),
    )
  })

  it.each(mixed)('%s sets %s again as rgba', (sheet, property) => {
    const again = new Map(customProperties(split(read(sheet)).fallbacks))

    expect(again.get(property)).toMatch(
      /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/,
    )
  })
})
