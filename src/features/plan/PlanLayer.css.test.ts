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

  // A press on the layer's words focuses the layer itself (tabindex -1, see
  // PlanLayer.tsx), so the keys after it are still sent from inside. It is no
  // control and never a Tab stop, so it wears no ring, as First Light's
  // overlay and frame do not.
  it("wears no focus ring when a press focuses it, as First Light's overlay and frame do not", () => {
    expect(declarations(css, '\\.layer:focus')).toEqual({ outline: 'none' })
    expect(declarations(firstLight, '\\.overlay:focus')).toEqual({
      outline: 'none',
    })
    expect(declarations(firstLight, '\\.frame:focus')).toEqual({
      outline: 'none',
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

// A lesson's cover is its share image, 1200x630 with its title written in it.
// Cut to a strip as tall as the card it read "at is a no", and on a tablet
// the cards kept a phone's 440 px column. jsdom lays nothing out, so these
// hold the rules; the browser walk measures where the picture lands.
describe("the plan's stylesheet, for a lesson's cover and a tablet's width", () => {
  const css = sheet('src/features/plan/PlanScreen.module.css')
  const wide = inside(css, '@media (min-width: 900px)')
  const tablet = inside(css, '@media (min-width: 600px)')
  const WHOLE = "\\.stop\\[data-cover='whole'\\]"
  const SIDE = `${WHOLE}:not\\(\\[data-kind='start'\\]\\)`

  it('contains the picture, so no width ever cuts it', () => {
    expect(declarations(css, `${WHOLE} \\.cover img`)).toEqual({
      'object-fit': 'contain',
    })
    const bodies = [
      ...css.matchAll(/([^{}]*data-cover='whole'[^{}]*)\{([^}]*)\}/g),
    ].map((m) => m[2])
    expect(bodies.length).toBeGreaterThan(0)
    for (const body of bodies) expect(body).not.toMatch(/object-fit:\s*cover/)
  })

  it('beside the words, gives the cover its own shape, not the height of the card', () => {
    const beside = declarations(css, `${SIDE} \\.cover`)

    expect(beside['aspect-ratio']).toBe('1200 / 630')
    expect(beside['align-self']).toBe('flex-start')
  })

  it('in the right-hand column, spans the card over the words', () => {
    expect(declarations(wide, SIDE)).toEqual({ 'flex-direction': 'column' })
    expect(declarations(wide, `${SIDE} \\.cover`)).toMatchObject({
      'align-self': 'stretch',
      width: 'auto',
    })
    expect(declarations(wide, `${SIDE} \\.cover`)['aspect-ratio']).toBe(
      undefined,
    )
  })

  it('keeps Start here at its own height when the column beside it runs taller', () => {
    expect(declarations(wide, '\\.stops > \\.stop')).toEqual({
      'align-self': 'start',
    })
  })

  it("gives the one column a tablet's width from 600 px, and the main button the same", () => {
    expect(declarations(css, '\\.stops')['max-width']).toBe('var(--pl-column)')
    expect(declarations(css, '\\.primary')['max-width']).toBe(
      'var(--pl-column)',
    )
    expect(declarations(css, '\\.root')['--pl-column']).toBe('440px')
    expect(declarations(tablet, '\\.root')).toEqual({ '--pl-column': '640px' })
  })
})
