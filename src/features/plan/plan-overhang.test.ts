// ============================================================
// plan-overhang: the room a host lends the screens
// ============================================================
//
// A scroll region clips 6px outside its content, nearer than a glow fades
// out, so a host with room beside and below its box lends it, through
// `--pc-overhang-side` and `--pc-overhang-end` (PlanExits.tsx holds the
// contract). The regions reach out into that room, as much wider and as much
// more padded, so only their clip lines move and the content keeps its place.
// With nothing lent, nothing moves.
//
// jsdom applies no CSS and Vitest does not process it, so these cases read the
// two stylesheets as text and hold them to that mechanism; where the clip
// lines land is for the browser check. First Light's side of it, a lend that
// equals the frame padding it lends, is pinned beside the parser of its sheet,
// in src/features/onboarding/beats/BeatMap.test.tsx.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// ── The stylesheets ────────────────────────────────────────────────────

/** A sheet's text, comments gone: a rule is named in the prose too. */
const sheet = (file: string): string =>
  readFileSync(resolve(__dirname, file), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  )

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

describe('the room a host lends the screens', () => {
  const chrome = sheet('plan-chrome.module.css')
  const questions = sheet('PlanQuestions.module.css')

  it('is none unless the host lends it, and only the questions reach below', () => {
    expect(declarations(chrome, '\\.root')['--pc-side']).toBe(
      'var(--pc-overhang-side, 0px)',
    )
    expect(declarations(questions, '\\.root')).toMatchObject({
      '--pc-reach': 'var(--pc-overhang-end, 0px)',
      height: 'calc(100% + var(--pc-room) + var(--pc-reach))',
    })
  })

  it('widens the region by it, so only the clip lines move', () => {
    expect(declarations(chrome, '\\.scroll')).toMatchObject({
      width: 'calc(100% + 2 * var(--pc-side))',
      'max-width': 'calc(var(--pc-wide) + 2 * var(--pc-side))',
      margin: `calc(var(--pc-room) * -1) calc(var(--pc-side) * -1) calc(var(--pc-reach, 0px) * -1)`,
      padding:
        'var(--pc-room) calc(var(--pc-bleed) + var(--pc-side)) calc(var(--pc-end, var(--pc-bleed)) + var(--pc-reach, 0px))',
    })
    // .scroll's width beats .root's on the questions' root, which wears both.
    expect(chrome.indexOf('.scroll {')).toBeGreaterThan(
      chrome.indexOf('.root {'),
    )
  })

  // The region scrolls only up and down, and the lend moves its bottom clip
  // line out, so it is the bottom scroll-padding that grows with the lend.
  it("keeps a keyboard focus clear of the region's edge by the room the ring needs", () => {
    expect(declarations(chrome, '\\.scroll')['scroll-padding']).toBe(
      'var(--pc-bleed) var(--pc-bleed) calc(var(--pc-bleed) + var(--pc-reach, 0px))',
    )
  })
})
