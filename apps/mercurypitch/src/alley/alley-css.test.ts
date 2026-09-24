// The alley's stylesheet on the oldest engine it ships to. iOS 16.0 and 16.1
// have no color-mix(): a declaration using it is dropped at parse time, and
// without a plain one before it the property is left unset.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(
  new URL('./alley.css', import.meta.url),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '')

describe('every color-mix() in alley.css', () => {
  const uses = [...CSS.matchAll(/^\s*([\w-]+):\s*color-mix\(/gmu)]

  it('is there to check', () => {
    expect(uses.length).toBeGreaterThan(0)
  })

  it('comes after a plain declaration of the same property in its rule', () => {
    for (const use of uses) {
      const property = use[1]
      const ruleStart = CSS.lastIndexOf('{', use.index)
      const before = CSS.slice(ruleStart, use.index)
      const fallback = new RegExp(
        `^\\s*${property}:\\s*(?!color-mix)[^;]+;`,
        'mu',
      )
      expect(before, `${property} at offset ${use.index}`).toMatch(fallback)
    }
  })
})
