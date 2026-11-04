// ============================================================
// A settings row's value keeps its width, and the label wraps first
// ============================================================
//
// The label and the value shared a row's shortage in step, so a short value
// was cut before the label had wrapped at all: on a 320 px phone the Account
// card's "Sign in" read "Sig…" beside "Practicing on this phone only". The
// value keeps its own width now, up to half the row, where a long one still
// ellipsizes, and the label takes the shortage and wraps. Read from the
// stylesheet: jsdom lays nothing out.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(
  new URL('./shell/settings/settings.css', import.meta.url),
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
  return value === null ? null : value[1].trim()
}

/** A `flex` shorthand's shrink factor. */
const shrinkOf = (flex: string | null): number =>
  Number((flex ?? '').split(/\s+/u)[1])

describe("a settings row's value", () => {
  it('does not shrink while the label can, and is held to half the row', () => {
    expect(shrinkOf(declaration('.mp-set-row__value', 'flex'))).toBe(0)
    expect(declaration('.mp-set-row__value', 'max-width')).toBe('50%')
    expect(shrinkOf(declaration('.mp-set-row__label', 'flex'))).toBe(1)
    expect(declaration('.mp-set-row__label', 'min-width')).toBe('0')
  })

  it('still cuts a value too long for half the row with an ellipsis', () => {
    expect(declaration('.mp-set-row__value', 'text-overflow')).toBe('ellipsis')
    expect(declaration('.mp-set-row__value', 'white-space')).toBe('nowrap')
  })
})
