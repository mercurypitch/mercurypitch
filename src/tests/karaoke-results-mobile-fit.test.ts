// ============================================================
// The stem results screen has to fit a phone
// ============================================================
//
// The real proof is `src/e2e/karaoke-results-mobile.spec.ts`, which
// measures the built page at 390px and 320px. This is the cheap guard
// that runs on every commit, and it pins the three declarations the fix
// actually turns on — each one an inch of give the layout had no other
// way to find:
//
//   * `.section-header h4` refused to shrink below its widest child (the
//     filename pill), so "Back to Upload" was shoved off the right edge
//     and the whole page scrolled sideways. A seeded example's name
//     ("Josh Woodward — Goodbye to Spring") is long enough every time.
//   * the pill needs `min-width: 0` of its own before its ellipsis can do
//     anything — `max-width: 35ch` is a ceiling, not a floor.
//   * three labelled action buttons do not fit a stem row on a phone, so
//     under 720px the labels go and the icons stay.
//
// jsdom has no layout engine, so this is read off the stylesheet the way
// `mobile-edge-gutters.test.ts` reads its two gutters.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Comments first: a comment between two declarations breaks a
 *  `;`-anchored match just as surely as a stray `}` would. */
function stylesheet(path: string): string {
  return readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
}

const uvrCss = stylesheet('src/styles/uvr.css')
const viewer = readFileSync('src/components/UvrResultViewer.tsx', 'utf8')

/** Every declaration block authored for exactly `selector`, in source order. */
function ruleBodies(css: string, selector: string): string[] {
  const opener = `${selector} {`
  const bodies: string[] = []
  for (
    let start = css.indexOf(opener);
    start !== -1;
    start = css.indexOf(opener, start + 1)
  ) {
    const from = start + opener.length
    const end = css.indexOf('}', from)
    bodies.push(css.slice(from, end === -1 ? undefined : end))
  }
  expect(bodies.length, `missing ${selector}`).toBeGreaterThan(0)
  return bodies
}

/** The last value declared for `property` across every block for `selector`. */
function declaredIn(
  css: string,
  selector: string,
  property: string,
): string | null {
  const values = ruleBodies(css, selector).flatMap((body) =>
    [
      ...body.matchAll(
        new RegExp(`(?:^|[;{])\\s*${property}\\s*:([^;]+)`, 'g'),
      ),
    ].map((match) => match[1].trim()),
  )
  return values.at(-1) ?? null
}

const declared = (selector: string, property: string): string | null =>
  declaredIn(uvrCss, selector, property)

/**
 * The body of one at-rule, brace-balanced. Slicing to the next `}` would
 * stop at the media query's first nested rule, which is where every one of
 * these assertions lives.
 */
function atRuleBody(css: string, prelude: string): string {
  const start = css.indexOf(prelude)
  expect(start, `missing ${prelude}`).toBeGreaterThan(-1)
  const from = css.indexOf('{', start) + 1
  let depth = 1
  for (let index = from; index < css.length; index++) {
    if (css[index] === '{') depth++
    else if (css[index] === '}' && --depth === 0) return css.slice(from, index)
  }
  throw new Error(`unterminated ${prelude}`)
}

/** The viewer's phone breakpoint, the one the .rv-header block already uses. */
const phone = atRuleBody(
  uvrCss.slice(uvrCss.indexOf('.rv-header {')),
  '@media (max-width: 720px)',
)

describe('a long song name cannot push the page sideways', () => {
  it('lets the results heading shrink instead of the Back button', () => {
    expect(declared('.section-header h4', 'min-width')).toBe('0')
  })

  it('lets the filename pill shrink into its own ellipsis', () => {
    expect(declared('.process-filename-pill', 'min-width')).toBe('0')
    // The ellipsis is the whole point of letting it shrink.
    expect(declared('.process-filename-pill', 'text-overflow')).toBe('ellipsis')
    expect(declared('.process-filename-pill', 'overflow')).toBe('hidden')
  })

  it('lets a stem row give at the name, never at the actions', () => {
    expect(declared('.rv-stem-card-top', 'min-width')).toBe('0')
    expect(declared('.rv-stem-info', 'min-width')).toBe('0')
    expect(declared('.rv-stem-name', 'text-overflow')).toBe('ellipsis')
    // If this ever stops being true the name has somewhere else to give
    // and the assertions above stop meaning anything.
    expect(declared('.rv-stem-card-actions', 'flex-shrink')).toBe('0')
  })

  it('wraps the parts offer rather than hanging it off the edge', () => {
    expect(declared('.rv-parts-header', 'flex-wrap')).toBe('wrap')
  })
})

describe('the stem actions on a phone', () => {
  it('drops the labels under the viewer’s phone breakpoint', () => {
    expect(declaredIn(phone, '.rv-stem-btn-label', 'display')).toBe('none')
  })

  it('keeps every action a thumb-sized square with a gap beside it', () => {
    const action = '.rv-stem-card-actions .rv-stem-btn'
    expect(declaredIn(phone, action, 'min-width')).toBe('2.5rem')
    expect(declaredIn(phone, action, 'min-height')).toBe('2.5rem')
    expect(declaredIn(phone, action, 'justify-content')).toBe('center')
    // Wider than the base 0.35rem: a gap to miss into, now that the
    // buttons no longer carry a word of text between them.
    expect(declaredIn(phone, '.rv-stem-card-actions', 'gap')).toBe('0.5rem')
  })

  it('names the buttons, because the label is what goes', () => {
    // An icon-only control with no accessible name is a worse bug than
    // the crowding it fixes.
    expect(viewer).toContain('aria-label={`Download ${stem.label}`}')
    expect(viewer).toContain('`Pause ${stem.label}`')
    expect(viewer).toContain('`Play ${stem.label}`')
    // Replace is a <label> wrapping the file input; its title carries it.
    expect(viewer).toContain('title="Replace this stem with a new file"')
  })
})
