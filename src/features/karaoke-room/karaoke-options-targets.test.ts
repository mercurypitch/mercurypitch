// ============================================================
// The Karaoke options' segments and switches take a tap over 44 px
// ============================================================
//
// Text size's segments are drawn 36 px tall and the option switches 26,
// and each took a tap over just that (measured in the options sheet at
// every phone size). Each now takes it over 44 px through a pseudo-element,
// drawn as before. Worked out from the stylesheet as written, since jsdom
// lays nothing out: the drawn height, grown by the pseudo-element's
// negative inset above and below, the last rule for each selector winning.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(
  resolve(process.cwd(), 'src/features/karaoke-room/karaoke-room.module.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '')

/** A property's value in the last rule naming the selector. */
function declared(selector: string, property: string): string | null {
  let found: string | null = null
  for (const [, selectors, body] of CSS.matchAll(
    /([^{}]+?)\s*\{([^{}]*)\}/gu,
  )) {
    const names = selectors.split(',').map((name) => name.trim())
    if (!names.includes(selector)) continue
    const value = new RegExp(
      `(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`,
      'u',
    ).exec(body)
    if (value !== null) found = value[1].trim()
  }
  return found
}

const px = (value: string | null): number =>
  value === null ? Number.NaN : Number(/^(-?[\d.]+)px$/u.exec(value)?.[1])

/** The tappable height: drawn, grown by the `::after` area's inset. */
function tapHeight(selector: string, drawn: 'height' | 'min-height'): number {
  const height = px(declared(selector, drawn))
  const inset = declared(`${selector}::after`, 'inset')
  if (inset === null) return height
  const vertical = px(inset.split(/\s+/u)[0])
  return height - 2 * Math.min(0, vertical)
}

describe("the Karaoke options' controls", () => {
  it.each([
    ['a text size segment', '.segment', 'min-height'],
    ['an option switch', '.switch', 'height'],
  ] as const)('takes a tap over 44 px of height: %s', (_, selector, drawn) => {
    expect(tapHeight(selector, drawn)).toBeGreaterThanOrEqual(44)
  })
})
