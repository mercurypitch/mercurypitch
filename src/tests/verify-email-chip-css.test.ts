import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * The confirm-email chip on a phone: the studio app's strip in the page flow
 * (up to 768 px) and Karaoke Night's pill at 600 px or less. Both used to
 * wrap and centre their items, so the X went to the last row with Resend:
 * at 390x844 the icon, the words and the buttons took three rows, 114 px
 * for the strip and 122 for the pill, and the X's tap area was its 22 px
 * box. Now the X sits in the top-right corner with a 44 px tap area, and the
 * words flow around that corner.
 *
 * Raw CSS, because jsdom does not evaluate CSS modules into computed styles,
 * and the e2e build has no API, so the real chip (which asks /me) cannot
 * mount there. The layout itself was measured in a browser against a
 * stubbed /me; these pin the rules it rests on.
 */

const css = readFileSync(
  resolve(__dirname, '../components/account/VerifyEmailBanner.module.css'),
  'utf-8',
).replace(/\/\*[\s\S]*?\*\//g, '')

const tsx = readFileSync(
  resolve(__dirname, '../components/account/VerifyEmailBanner.tsx'),
  'utf-8',
)

interface Block {
  prelude: string
  body: string
}

/** The top-level blocks of `source`: rules and at-rules, in order. */
function blocks(source: string): Block[] {
  const out: Block[] = []
  let depth = 0
  let start = 0
  let prelude = ''
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') {
      if (depth === 0) {
        prelude = source.slice(start, i).trim()
        start = i + 1
      }
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) {
        out.push({ prelude, body: source.slice(start, i) })
        start = i + 1
      }
    }
  }
  return out
}

/** The rules at the top level (null) or inside `@media (<query>)`. */
function scope(query: string | null): Block[] {
  if (query === null)
    return blocks(css).filter((b) => !b.prelude.startsWith('@'))
  const media = blocks(css).filter((b) => b.prelude === `@media (${query})`)
  return media.flatMap((m) => blocks(m.body))
}

const selectors = (b: Block): string[] =>
  b.prelude.split(',').map((s) => s.trim().replace(/\s+/g, ' '))

/** What the rules in `rules` set on `selector`, later rules winning. */
function style(rules: Block[], selector: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rule of rules) {
    if (!selectors(rule).includes(selector)) continue
    for (const decl of rule.body.split(';')) {
      const at = decl.indexOf(':')
      if (at < 0) continue
      out[decl.slice(0, at).trim()] = decl
        .slice(at + 1)
        .trim()
        .replace(/\s+/g, ' ')
    }
  }
  return out
}

const px = (value: string | undefined): number => {
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(value ?? '')
  return m === null ? Number.NaN : Number(m[1])
}

/** One side of a `padding` shorthand, or the longhand that overrides it. */
function padding(s: Record<string, string>, side: 'top' | 'right'): number {
  const longhand = s[`padding-${side}`]
  if (longhand !== undefined) return px(longhand)
  const parts = (s.padding ?? '').split(' ')
  return px(side === 'top' ? parts[0] : (parts[1] ?? parts[0]))
}

const TOP_LEVEL = scope(null)
const PHONE = scope('max-width: 600px')
const STRIP_WIDTHS = [...TOP_LEVEL, ...scope('max-width: 768px')]

/** The X's own box: its 14 px icon and its padding on both sides. */
const X_BOX = (() => {
  const icon = /aria-label="Dismiss"[\s\S]*?width="(\d+)"/.exec(tsx)
  return Number(icon?.[1]) + 2 * px(style(TOP_LEVEL, '.close').padding)
})()

/** Where the X sits and how far its tap area reaches past its box. */
function corner(rules: Block[], chip: '.inline' | '.banner') {
  const close = style(rules, `${chip} .close`)
  const area = style(rules, `${chip} .close::after`)
  const reach = -px(area.inset)
  return {
    position: close.position,
    top: px(close.top),
    right: px(close.right),
    reach,
    area: X_BOX + 2 * reach,
    // From the chip's corner to the far edges of the tap area.
    across: px(close.right) + X_BOX + reach,
    down: px(close.top) + X_BOX + reach,
  }
}

describe('the confirm-email chip keeps its X in the corner on a phone', () => {
  it.each([
    ['the strip', TOP_LEVEL, '.inline'],
    ["Karaoke Night's pill, at 600 px or less", PHONE, '.banner'],
  ] as const)('pins it to the top-right corner of %s', (_name, rules, chip) => {
    const x = corner(rules, chip)
    expect(x.position).toBe('absolute')
    // The tap area starts at the chip's own corner, not past it.
    expect(x.top - x.reach).toBe(0)
    expect(x.right - x.reach).toBe(0)
  })

  it.each([
    ['the strip', TOP_LEVEL, '.inline'],
    ["Karaoke Night's pill", PHONE, '.banner'],
  ] as const)(
    'gives the X on %s a tap area of 44 px or more',
    (_name, rules, chip) => {
      expect(X_BOX).toBe(22)
      expect(corner(rules, chip).area).toBeGreaterThanOrEqual(44)
    },
  )

  it('keeps the words and Resend out from under it on a one-row strip', () => {
    // Between 601 and 768 px the strip is one row: the end padding is as
    // wide as the X's corner, and the row at least as tall.
    const strip = style(STRIP_WIDTHS, '.inline')
    const x = corner(TOP_LEVEL, '.inline')
    expect(padding(strip, 'right')).toBeGreaterThanOrEqual(x.across)
    const minRow = px(
      /minmax\((\d+px),/.exec(strip['grid-template-rows'] ?? '')?.[1],
    )
    expect(2 * padding(strip, 'top') + minRow).toBeGreaterThanOrEqual(x.down)
  })

  it.each([
    ['the strip', '.inline'],
    ["Karaoke Night's pill", '.banner'],
  ] as const)(
    'flows the words of %s around the X on a phone, never under it',
    (_name, chip) => {
      const card = style(PHONE, chip)
      const spacer = style(PHONE, `${chip}::before`)
      const x = corner(chip === '.inline' ? TOP_LEVEL : PHONE, chip)
      expect(card.display).toBe('flow-root')
      // A float ahead of the words, as wide and as tall as the X's corner
      // less the padding that already keeps them off it.
      expect(spacer.float).toBe('right')
      expect(padding(card, 'right') + px(spacer.width)).toBeGreaterThanOrEqual(
        x.across,
      )
      expect(padding(card, 'top') + px(spacer.height)).toBeGreaterThanOrEqual(
        x.down,
      )
      // The icon starts the words' first line rather than taking a row.
      expect(style(PHONE, `${chip} .icon`).float).toBe('left')
      expect(style(PHONE, `${chip} .resend`).display).toBe('block')
      expect(style(PHONE, `${chip} .sent`).display).toBe('block')
    },
  )

  it('leaves the desktop pill as it is', () => {
    // Nothing of the phone card is set where a desktop reads it.
    const desktop = [...TOP_LEVEL, ...scope('max-width: 768px')]
    expect(style(desktop, '.banner').display).toBe('flex')
    for (const selector of [
      '.close',
      '.banner .close',
      '.banner::before',
      '.banner .icon',
    ]) {
      const s = style(desktop, selector)
      expect(s.position, selector).not.toBe('absolute')
      expect(s.float, selector).toBeUndefined()
    }
  })

  it('cannot bring the desktop pill back on a phone', () => {
    // The phone card gives the pill a display of its own, one class strong,
    // so the rule that hides the studio's desktop pill on a phone takes two.
    expect(style(PHONE, '.banner').display).toBe('flow-root')
    expect(
      style(scope('max-width: 768px'), '.banner.floatingOnly').display,
    ).toBe('none')
  })
})
