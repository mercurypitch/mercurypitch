// ============================================================
// A room picker has to show the room
// ============================================================
//
// Guitar Night and Piano Night both put their supporter rooms behind a panel
// that slid in over a 62–66% wash and a 2px blur. Picking a room then meant
// choosing, closing the panel to look, reopening it, choosing again — the one
// screen where the backdrop is the subject was the one screen that hid it.
//
// Both scrims are now a faint wash with no blur. `inert` on the stage is what
// actually holds the modality; the wash only ever said so. These numbers are
// small and easy to "tidy" back up, so they are pinned here rather than left
// to a screenshot nobody takes.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** The declarations of one top-level rule, by selector. */
function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`)
  expect(start, `${selector} not found`).toBeGreaterThan(-1)
  return source.slice(start, source.indexOf('}', start))
}

/** The alpha of the first `rgb(… / …)` or `rgba(…)` colour in a rule. */
function scrimAlpha(body: string): number {
  const slash = /rgb\([^)]*\/\s*([\d.]+)(%?)\s*\)/.exec(body)
  if (slash) {
    return slash[2] === '%' ? Number(slash[1]) / 100 : Number(slash[1])
  }
  const legacy = /rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(body)
  expect(legacy, `no scrim colour in ${body}`).not.toBeNull()
  return Number(legacy?.[1])
}

const guitar = readFileSync(
  'src/features/guitar-night/GuitarNightApp.module.css',
  'utf8',
)
const piano = readFileSync(
  'src/features/piano-night/PianoNightApp.module.css',
  'utf8',
)

describe('the scrim behind a room picker', () => {
  it('leaves the Guitar Night room readable while it is being picked', () => {
    const body = ruleBody(guitar, '.roomScrim')
    expect(scrimAlpha(body)).toBeLessThanOrEqual(0.2)
    expect(body).not.toMatch(/backdrop-filter:\s*blur/)
  })

  it('leaves the Piano Night room readable while it is being picked', () => {
    const body = ruleBody(piano, '.scrimClear')
    expect(scrimAlpha(body)).toBeLessThanOrEqual(0.2)
    expect(body).toMatch(/backdrop-filter:\s*none/)
  })

  it('keeps the full dim on Piano Night panels that are not the room', () => {
    // Only the room picker earns the clear wash. Track assignment in Music is
    // a form: focus is the right thing to ask for there, and losing the dim
    // for every panel would be a different change than the one asked for.
    const body = ruleBody(piano, '.scrim')
    expect(scrimAlpha(body)).toBeGreaterThan(0.4)
    expect(body).toMatch(/backdrop-filter:\s*blur/)
  })
})

describe('the room glass each stage derives', () => {
  it('gives Piano Night a clarity where zero is the stage as it shipped', () => {
    const body = ruleBody(piano, '.shell')
    expect(body).toMatch(/--pn-glass:\s*0\.45/)
    // Every scale must be `1 - glass * k`, so glass 0 multiplies by exactly 1
    // and nothing that shipped moves for somebody who never touches it.
    for (const token of [
      '--pn-surface-scale',
      '--pn-blur-scale',
      '--pn-veil-scale',
      '--pn-key-scale',
    ]) {
      expect(body, token).toMatch(
        new RegExp(
          `${token}:\\s*calc\\(1 - var\\(--pn-glass\\) \\* [\\d.]+\\)`,
        ),
      )
    }
    // The keybed clamps at zero rather than going negative, but it is the
    // same shape and still multiplies by exactly 1 at glass 0.
    expect(body).toMatch(
      /--pn-keybed-scale:\s*max\(0, 1 - var\(--pn-glass\) \* [\d.]+\)/,
    )
  })

  it('clears the layers behind a key before the key itself thins', () => {
    // Three painted layers deep — bed, backing, key — and three stacked
    // alphas do not add up to one. A single scale on all three left a white
    // key 99% opaque at the default and 93% at Open: it changed shade and
    // never went see-through. The two behind it must fall faster, and reach
    // zero, so the key is the only thing left to thin.
    const body = ruleBody(piano, '.shell')
    const factor = (token: string, form: 'calc' | 'max'): number => {
      const source =
        form === 'calc'
          ? `${token}:\\s*calc\\(1 - var\\(--pn-glass\\) \\* ([\\d.]+)\\)`
          : `${token}:\\s*max\\(0, 1 - var\\(--pn-glass\\) \\* ([\\d.]+)\\)`
      const found = new RegExp(source).exec(body)
      expect(found, token).not.toBeNull()
      return Number(found?.[1])
    }
    const bed = factor('--pn-keybed-scale', 'max')
    const key = factor('--pn-key-scale', 'calc')
    expect(bed).toBeGreaterThan(key)
    // Reaches zero somewhere on the slider, so Open has nothing behind it.
    expect(bed).toBeGreaterThan(1)

    // And the composite the eye actually sees, at Open: 1 - (1-bed)^2(1-key).
    const at = (glass: number): number => {
      const b = Math.max(0, 1 - glass * bed)
      const k = 1 - glass * key
      return 1 - (1 - b) ** 2 * (1 - k)
    }
    expect(at(0)).toBe(1)
    expect(at(1)).toBeLessThan(0.4)
  })

  it('thins the keys more gently than the bed behind them', () => {
    // The keys are the play surface. They are on the same slider as the bed,
    // not the same curve.
    const body = ruleBody(piano, '.shell')
    const factor = (token: string): number => {
      const found = new RegExp(
        `${token}:\\s*(?:calc|max)\\((?:0, )?1 - var\\(--pn-glass\\) \\* ([\\d.]+)\\)`,
      ).exec(body)
      expect(found, token).not.toBeNull()
      return Number(found?.[1])
    }
    expect(factor('--pn-key-scale')).toBeLessThan(factor('--pn-keybed-scale'))
  })

  it('stops the white-key seam where a sharp covers it', () => {
    // A sharp physically covers the joint between its two white keys. Solid
    // keys hid it for free; a translucent one read the opaque full-height
    // separator straight through as a line down the middle of the black key.
    const seam = ruleBody(piano, ".whiteKeys button[data-sharp-right='true']")
    expect(seam).toMatch(/border-right-color:\s*transparent/)

    const drawn = ruleBody(
      piano,
      ".whiteKeys button[data-sharp-right='true']::before",
    )
    // The covered part rides the bed's curve — so it is still the unbroken
    // line that shipped at glass 0, and gone once the sharp is see-through.
    expect(drawn).toContain('var(--pn-keybed-scale)')
    // The part IN FRONT of the sharp never fades: with the fill gone it is
    // all that says where one white key ends.
    expect(drawn).toMatch(/#171614 61%/)
  })

  it('lets the bevels leave with the solid key that had them', () => {
    // A bevel and a cast shadow are what a solid object looks like. Left on
    // the key's gentler curve they outlived it — a shadow along the bottom
    // of "transparent" ivory, and a bright line up its left that read
    // through the sharp above it.
    for (const selector of ['.whiteKeys button', '.blackKeys button']) {
      const body = ruleBody(piano, selector)
      const shadow = /box-shadow:([\s\S]*?);/.exec(body)?.[1] ?? ''
      expect(shadow, selector).toContain('--pn-keybed-scale')
      expect(shadow, selector).not.toContain('--pn-key-scale')
    }
  })

  it('never thins a key that is being held', () => {
    // "Which key just fired" must not be a matter of taste. `.keyActive`
    // repaints with its own opaque gradient at every stop.
    for (const selector of [
      '.whiteKeys button.keyActive',
      '.blackKeys button.keyActive',
    ]) {
      const body = ruleBody(piano, selector)
      expect(body, selector).toMatch(/background:\s*linear-gradient/)
      expect(body, selector).not.toContain('--pn-key-scale')
    }
  })
})
