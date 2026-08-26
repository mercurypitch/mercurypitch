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
  })

  it('thins the keys more gently than the floating chrome', () => {
    // The keys are the play surface. They are on the same slider, not the
    // same curve.
    const body = ruleBody(piano, '.shell')
    const factor = (token: string): number => {
      const found = new RegExp(
        `${token}:\\s*calc\\(1 - var\\(--pn-glass\\) \\* ([\\d.]+)\\)`,
      ).exec(body)
      expect(found, token).not.toBeNull()
      return Number(found?.[1])
    }
    expect(factor('--pn-key-scale')).toBeLessThan(factor('--pn-surface-scale'))
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
