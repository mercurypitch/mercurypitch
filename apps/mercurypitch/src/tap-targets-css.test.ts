// ============================================================
// The shell's small controls take a tap over 44 px
// ============================================================
//
// A control may be drawn smaller than the 44 px a finger needs, as the
// system's own switch is, if the area that takes the tap is not. The
// settings switch is drawn at iOS's 51 x 31, and its target was those 31 px
// (measured on the Account screen at every phone size); a pseudo-element
// now takes the tap over 45. Worked out here from the stylesheet as
// written, since jsdom lays nothing out: the drawn size, grown by the
// pseudo-element's negative inset on each side.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const SETTINGS = readFileSync(
  new URL('./shell/settings/settings.css', import.meta.url),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '')

/** One declaration of the first rule for exactly this selector. */
function declaration(
  css: string,
  selector: string,
  property: string,
): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const rule = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'u').exec(
    css,
  )
  if (rule === null) return null
  const value = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`, 'u').exec(
    rule[1],
  )
  return value === null ? null : value[1].trim()
}

const px = (value: string | null): number =>
  value === null ? Number.NaN : Number(/^(-?[\d.]+)px$/u.exec(value)?.[1])

/**
 * The tappable box: the drawn size, grown by the `::after` area's negative
 * inset (`inset: <vertical> <horizontal>`), or the drawn size alone.
 */
function target(
  css: string,
  selector: string,
): { width: number; height: number } {
  const width = px(declaration(css, selector, 'width'))
  const height = px(declaration(css, selector, 'height'))
  const inset = declaration(css, `${selector}::after`, 'inset')
  if (inset === null) return { width, height }
  const [vertical, horizontal = vertical] = inset.split(/\s+/u).map(px)
  return {
    width: width - 2 * Math.min(0, horizontal),
    height: height - 2 * Math.min(0, vertical),
  }
}

describe("the shell's small controls", () => {
  it('draws the settings switch at 51 x 31 and takes a tap over 44 px or more each way', () => {
    const switchBox = target(SETTINGS, '.mp-switch')

    expect(px(declaration(SETTINGS, '.mp-switch', 'height'))).toBe(31)
    expect(switchBox.width).toBeGreaterThanOrEqual(44)
    expect(switchBox.height).toBeGreaterThanOrEqual(44)
  })
})
