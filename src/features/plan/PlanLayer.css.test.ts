// ============================================================
// PlanLayer's stylesheets: the box the screens stand in
// ============================================================
//
// What PlanExits.tsx asks of a host, the room the layer lends the screens
// and where it stands in the z-scale are all CSS, and jsdom applies none, so
// these cases read the stylesheets as text and hold them to the mechanism;
// where things land is for the browser check. The layer's behaviour, and that
// it wears these classes, are in PlanLayer.test.tsx.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// ── The stylesheets ────────────────────────────────────────────────────

const repo = resolve(__dirname, '../../..')

/** A sheet's text, comments gone: a rule is named in the prose too. */
const sheet = (file: string): string =>
  readFileSync(resolve(repo, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** What a rule with exactly this selector declares, by property. */
function declarations(
  source: string,
  selector: string,
): Record<string, string> {
  const body = new RegExp(`${selector} \\{([^}]*)\\}`).exec(source)?.[1] ?? ''
  return Object.fromEntries(
    body.split(';').flatMap((line) => {
      const [property, ...value] = line.split(':')
      return value.length > 0
        ? [[property.trim(), value.join(':').replace(/\s+/g, ' ').trim()]]
        : []
    }),
  )
}

/** The rules inside the first block that opens with this at-rule. */
function inside(source: string, opener: string): string {
  const start = source.indexOf(`${opener} {`)
  if (start === -1) return ''
  const from = start + opener.length + 2
  let depth = 0
  for (let i = from; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      if (depth === 0) return source.slice(from, i)
      depth--
    }
  }
  return ''
}

/** A value split at its top-level spaces: `calc(1px + 2px) 3px` is two. */
function words(value: string): string[] {
  const found: string[] = []
  let depth = 0
  let word = ''
  for (const ch of value) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ' ' && depth === 0) {
      found.push(word)
      word = ''
    } else word += ch
  }
  return [...found, word]
}

/** Anything that would make the box a containing block, scroll it, move it or pad it. */
const TRAPS =
  /^(transform|translate|rotate|scale|perspective|filter|backdrop-filter|will-change|contain|animation|transition|overflow(-x|-y)?|padding(-.+)?)$/

describe("the layer's stylesheet", () => {
  const css = sheet('src/features/plan/PlanLayer.module.css')
  const firstLight = sheet('src/features/onboarding/onboarding.module.css')
  const phone = inside(css, '@media (max-width: 640px)')

  it("covers the window, level with First Light's overlay and under the consent bar", () => {
    const layer = declarations(css, '\\.layer')

    expect(layer).toMatchObject({ position: 'fixed', inset: '0' })
    expect(layer['z-index']).toBe(
      declarations(firstLight, '\\.overlay')['z-index'],
    )
    expect(Number(layer['z-index'])).toBeLessThan(2147483000)
  })

  // The regions reach out into the room the layer lends, as far as the
  // layer's own padding, so each clip line lies on the screen's edge.
  it('lends the screens the room it pads them with, beside and below its box', () => {
    const layer = declarations(css, '\\.layer')
    const [, side, end] = words(layer.padding)

    expect(layer['--pc-overhang-side']).toBe(side)
    expect(layer['--pc-overhang-end']).toBe(end)
    // A bare 0 makes the chrome's calc() invalid and the region collapse.
    expect(side).toMatch(/px$/)
    expect(end).toMatch(/px$/)
  })

  it('gives its bottom padding up on a phone, where the screens own the home indicator, and lends none there', () => {
    expect(declarations(phone, '\\.layer')).toEqual({
      'padding-bottom': '0',
      '--pc-overhang-end': '0px',
    })
  })

  it('stands the box in a positioned, height-bounded flex column the screens can stand in', () => {
    expect(declarations(css, '\\.box')).toMatchObject({
      position: 'relative',
      display: 'flex',
      'flex-direction': 'column',
      flex: '1 1 0',
      'min-height': '0',
    })
    expect(declarations(css, '\\.layer')).toMatchObject({
      display: 'flex',
      'flex-direction': 'column',
    })
  })

  it('does not scroll, move, filter or pad the box, or the screens lose their corners and their room', () => {
    const declared = Object.keys(declarations(css, '\\.box'))

    expect(declared.length).toBeGreaterThan(0)
    expect(declared.filter((property) => TRAPS.test(property))).toEqual([])
  })

  it('places Merc without touching his display, which his still and his canvas share', () => {
    expect(declarations(css, '\\.merc')).toEqual({ flex: 'none' })
  })

  // iOS retracts its toolbars over a `position: fixed; inset: 0` box, so a
  // layer sized by its insets alone runs taller than the window a person can
  // see and its last rows sit under the browser bar (owner testing, iPhone,
  // First Light's "Keep my voiceprint"). The layer is First Light's box, so it
  // carries First Light's fix.
  it("is as tall as the window can be seen, as First Light's overlay is", () => {
    const supports = '@supports (height: 100dvh)'

    expect(inside(firstLight, supports)).not.toBe('')
    expect(declarations(inside(firstLight, supports), '\\.overlay')).toEqual({
      height: '100dvh',
    })
    expect(inside(css, supports)).not.toBe('')
    expect(declarations(inside(css, supports), '\\.layer')).toEqual({
      height: '100dvh',
    })
  })
})

describe("the way to change the answers' stylesheet", () => {
  const css = sheet('src/features/plan/PlanScreen.module.css')

  it('is the quiet link of the ways on, and so 44 px tall like them', () => {
    expect(declarations(css, '\\.change')).toEqual({ composes: 'skip' })
    expect(declarations(css, '\\.skip')['min-height']).toBe('44px')
  })
})
