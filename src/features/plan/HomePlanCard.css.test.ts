// ============================================================
// HomePlanCard's stylesheet: what it promises, read as text
// ============================================================
//
// jsdom applies no CSS, so these cases read the card's sheet as text and hold
// it to three promises nothing else would notice losing: the card spans Home's
// grid from its own class (it draws no wrapper), every target on it is at least
// 44 px, and its small text takes the colour that is made for text. What the
// card draws, and that it wears these classes, is HomePlanCard.test.tsx's.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** The sheet's text, comments gone: a rule is named in the prose too. */
const css = readFileSync(
  'src/features/plan/HomePlanCard.module.css',
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '')

/** The declarations of the rule whose selector is exactly `selector`, by property. */
function rule(selector: string): Record<string, string> {
  const escaped = selector.replaceAll('.', '\\.')
  const found = new RegExp(
    `(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`,
    'u',
  ).exec(css)
  const declarations = (found?.[1] ?? '')
    .split(';')
    .map((declaration) => [
      declaration.slice(0, declaration.indexOf(':')).trim(),
      declaration.slice(declaration.indexOf(':') + 1).trim(),
    ])
    .filter(([property]) => property !== '')
  return Object.fromEntries(declarations)
}

describe('the stylesheet', () => {
  it('reads a rule by its selector', () => {
    expect(rule('.hide')).toMatchObject({ display: 'inline-flex' })
    expect(rule('.nothing-like-this')).toEqual({})
  })

  it('spans both columns of Home grid from its own class, so the card draws no wrapper', () => {
    expect(rule('.card')['grid-column']).toBe('1 / -1')
  })

  it('makes every target at least 44 px: the X, a row, and Start', () => {
    expect(rule('.hide')).toMatchObject({ width: '44px', height: '44px' })
    expect(rule('.row')['min-height']).toBe('44px')
    expect(rule('.start')['min-height']).toBe('44px')
  })

  it('sets the kicker, which is small text, in the accent made for text and not the accent that fills', () => {
    // --accent is the fill: on a light theme it is under 4.5:1 on the row's
    // ground. --accent-text is held to 4.5:1 on every surface, in every theme,
    // by theme-tokens.contract.test.ts.
    expect(rule('.kicker').color).toBe('var(--accent-text)')
  })

  it('takes no text colour from the fill accent anywhere', () => {
    // A `color:` that names --accent bare, as a property of its own: not
    // `background: var(--accent)`, not `border-color`, and not --accent-text.
    expect(css).not.toMatch(/(?:^|[;{\s])color:\s*var\(--accent\)/u)
  })
})
