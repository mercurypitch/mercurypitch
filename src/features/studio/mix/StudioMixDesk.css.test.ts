// Studio mix desk strip edge — the hue line across a strip's top follows the strip's own corner radius.
//
// The line used to be a 3 px box with 10 px top corners. A browser shrinks
// radii that do not fit their box (CSS Backgrounds 3, "Overlapping Curves"),
// so the line was drawn with 3 px corners and ended square inside the
// strip's rounded ones. As the top border of a box over the whole strip, it
// keeps the strip's radius.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, 'StudioMixDesk.module.css'), 'utf8')

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): Map<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  if (match === null) throw new Error(`No rule for ${selector}`)
  return new Map(
    match[1]
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(';')
      .map((line) => line.trim())
      .filter((line) => line.includes(':'))
      .map((line) => {
        const at = line.indexOf(':')
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()]
      }),
  )
}

describe('Studio mix desk strip edge', () => {
  it('draws the hue line over the whole strip, so its corners keep the strip radius', () => {
    const strip = rule('.strip')
    const line = rule('.strip::before')

    expect(strip.get('border-radius')).toBe('10px')
    // The same radius as the strip, whatever it becomes.
    expect(line.get('border-radius')).toBe('inherit')
    // From the strip's outer edge on every side: no short box to clamp it.
    expect(line.get('inset')).toBe('-1px')
    expect(line.has('height')).toBe(false)
    expect(line.get('border-top')).toBe('3px solid var(--studio-track)')
    expect(line.get('pointer-events')).toBe('none')
  })
})
