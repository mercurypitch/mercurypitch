// The native shell's stylesheet (shell/shell.css): the side padding of the
// dock and of the room header, against the insets each answers to. Here
// rather than beside it, because src/shell/ runs under jsdom, which gives no
// file URL to read it from.
//
// A four-value shorthand runs top, right, bottom, left, and both had their
// two side insets the wrong way round: the right padding followed the LEFT
// inset. On an iPhone on its side the two insets are equal, so nothing
// showed; on a phone whose cutout is on one side only, each padded away from
// the cutout, and its controls could run under it.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(
  new URL('./shell/shell.css', import.meta.url),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '')

/** One declaration of the first rule for exactly this selector. */
function declaration(selector: string, property: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const rule = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'u').exec(
    CSS,
  )
  if (rule === null) return null
  const value = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`, 'u').exec(
    rule[1],
  )
  return value === null ? null : value[1].replace(/\s+/gu, ' ').trim()
}

/** A shorthand's values, split at the top level only, never inside max(). */
function values(shorthand: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const ch of shorthand) {
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (ch === ' ' && depth === 0) {
      if (current !== '') out.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current !== '') out.push(current)
  return out
}

describe("the dock's side padding", () => {
  const padding = declaration('.mp-dock', 'padding')

  it('is one four-value shorthand', () => {
    expect(padding).not.toBeNull()
    expect(values(padding ?? '')).toHaveLength(4)
  })

  it('pads its right with the right inset, and its left with the left', () => {
    const [, right, , left] = values(padding ?? '')
    expect(right).toMatch(/var\(--safe-right\b/u)
    expect(right).not.toMatch(/--safe-left\b/u)
    expect(left).toMatch(/var\(--safe-left\b/u)
    expect(left).not.toMatch(/--safe-right\b/u)
  })
})

describe("the room header's side padding", () => {
  it('pads its right with the right inset, and its left with the left', () => {
    const sides = values(declaration('.mp-room-header', 'padding') ?? '')
    expect(sides).toHaveLength(4)
    const [, right, , left] = sides
    expect(right).toMatch(/var\(--safe-right\b/u)
    expect(right).not.toMatch(/--safe-left\b/u)
    expect(left).toMatch(/var\(--safe-left\b/u)
    expect(left).not.toMatch(/--safe-right\b/u)
  })
})
