// ============================================================
// HomePlanCardMount's sheet: the slot is the card's frame, and every card has a guess
// ============================================================
//
// Until the card's chunk is in, Home keeps a slot for it: the card's frame,
// empty, so the card lands in it and nothing below moves. The frame is copied
// from the card's own sheet (HomePlanCard.module.css's .card), so these cases
// read both sheets and hold the copy to the card: one grid item across both
// columns, its border, its corners and its ground. Where the card has not
// drawn on this device, the sheet guesses its height by the kind of card,
// for a desktop and for a phone, so every kind the card can be needs a guess
// at both.
//
// jsdom applies no CSS, so this reads the sheets as text.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PLAN_CARD_KINDS } from '@/features/plan/plan-card-rules'

/** A sheet's text, comments gone and space made single. */
const sheet = (file: string): string =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\s+/gu, ' ')

const SLOT_SHEET = sheet('src/pages/HomePlanCardMount.module.css')
const CARD_SHEET = sheet('src/features/plan/HomePlanCard.module.css')

/** The declarations of the first rule whose selector is exactly `selector` in `css`, by property. */
function rule(css: string, selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const found = new RegExp(`(?:^|[{}]) ?${escaped} ?\\{([^}]*)\\}`, 'u').exec(
    css,
  )
  return Object.fromEntries(
    (found?.[1] ?? '')
      .split(';')
      .map((declaration) => [
        declaration.slice(0, declaration.indexOf(':')).trim(),
        declaration.slice(declaration.indexOf(':') + 1).trim(),
      ])
      .filter(([property]) => property !== ''),
  )
}

/** The part of `css` inside its phone query. */
function phone(css: string): string {
  const at = css.indexOf('@media (max-width: 640px) {')
  return at < 0 ? '' : css.slice(at)
}

/** The part of `css` before its first query. */
function desktop(css: string): string {
  const at = css.indexOf('@media')
  return at < 0 ? css : css.slice(0, at)
}

const FRAME = ['grid-column', 'border', 'border-radius', 'background']

describe("the slot's frame", () => {
  const slot = rule(SLOT_SHEET, '.slot')
  const card = rule(CARD_SHEET, '.card')

  it('reads the two rules it compares', () => {
    expect(card.padding).toBe('16px')
    expect(slot['box-sizing']).toBe('border-box')
    expect(rule(SLOT_SHEET, '.nothing-like-this')).toEqual({})
  })

  it.each(FRAME)("draws the card's own %s", (property) => {
    expect(card[property]).toBeDefined()
    expect(slot[property]).toBe(card[property])
  })

  it("says, in the card's sheet, that the slot copies its frame", () => {
    expect(
      readFileSync('src/features/plan/HomePlanCard.module.css', 'utf8'),
    ).toContain('HomePlanCardMount.module.css')
  })
})

describe("the slot's guesses", () => {
  it.each(PLAN_CARD_KINDS)(
    'guesses a height for the %s card on a desktop and on a phone',
    (kind) => {
      const selector = `.slot[data-kind='${kind}']`
      const wide = rule(desktop(SLOT_SHEET), selector).height ?? ''
      const narrow = rule(phone(SLOT_SHEET), selector).height ?? ''

      expect(wide).toMatch(/^\d+(\.\d+)?px$/u)
      expect(narrow).toMatch(/^\d+(\.\d+)?px$/u)
      // On a phone the card's rows stack, so it is never shorter there.
      expect(Number.parseFloat(narrow)).toBeGreaterThanOrEqual(
        Number.parseFloat(wide),
      )
    },
  )
})
