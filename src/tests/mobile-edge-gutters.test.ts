// ============================================================
// Two controls that sat on the screen's own edge
// ============================================================
//
// Both are layout, and jsdom has no layout engine, so the contract is read
// off the stylesheet the way HeaderAccount's touch targets and Guitar
// Night's phone chrome are. Both also failed for the same reason twice
// over — a value that looks like a gutter but resolves to zero:
//
//   * the phone drawer named `padding-left` inside its media block, which
//     replaced the base rule's `padding: 14px` shorthand outright, leaving
//     the inset alone to hold the gutter. In portrait `env(safe-area-
//     inset-left)` is 0, so the drawer's contents began at pixel zero.
//   * the warmup guide toggle is absolutely positioned, and `right` on an
//     absolutely positioned child resolves against the containing block's
//     PADDING box — so `right: 0` looked straight through the caption row's
//     12px gutter and parked the pill on the screen edge.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Comments are stripped before anything is parsed: every rule below is
 * annotated, and a comment sitting between two declarations breaks a
 * `;`-anchored match just as surely as a stray `}` inside one would end a
 * rule early.
 */
function stylesheet(path: string): string {
  return readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
}

const sidebarCss = stylesheet('src/components/AppSidebar.module.css')
const exercisesCss = stylesheet('src/styles/exercises.css')

/**
 * Every declaration block authored for exactly `selector`, in source order.
 * Both stylesheets open the same selector more than once (a base rule and a
 * media-query override), and reading only the first one answers the wrong
 * half of the question.
 */
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

/** The last value declared for `property` in `body`, trimmed. */
function declaration(body: string, property: string): string | null {
  const matches = [
    ...body.matchAll(new RegExp(`(?:^|[;{])\\s*${property}\\s*:([^;]+)`, 'g')),
  ]
  const last = matches.at(-1)
  return last === undefined ? null : last[1].trim()
}

/** Every px length in a value, so `calc(... + 14px)` reads as 14. */
function pixelLengths(value: string): number[] {
  return [...value.matchAll(/(-?[\d.]+)px/g)].map((m) => Number(m[1]))
}

describe('the phone drawer keeps a gutter of its own', () => {
  // The off-canvas rule is the one that pins itself to the viewport; the
  // other blocks for this selector are the desktop rail and the collapsed
  // rail, neither of which touches the screen edge.
  const drawer = ruleBodies(sidebarCss, ':global(.app-sidebar)').find((body) =>
    /position:\s*fixed/.test(body),
  )

  it('is the off-canvas rule that owns the phone padding', () => {
    expect(drawer).toBeDefined()
  })

  it('adds the safe-area inset to the gutter instead of standing in for it', () => {
    const paddingLeft = declaration(drawer ?? '', 'padding-left')
    expect(paddingLeft).not.toBeNull()
    // Still honours a notch in landscape…
    expect(paddingLeft).toContain('--safe-left')
    // …and still leaves a gutter on the phones where that inset is 0.
    expect(Math.max(0, ...pixelLengths(paddingLeft ?? ''))).toBeGreaterThan(0)
  })

  it('leaves the same gutter on the drawer’s inner edge', () => {
    const paddingRight = declaration(drawer ?? '', 'padding-right')
    expect(paddingRight).not.toBeNull()
    expect(Math.max(0, ...pixelLengths(paddingRight ?? ''))).toBeGreaterThan(0)
  })
})

describe('the warmup guide toggle sits inside its row', () => {
  const row = ruleBodies(exercisesCss, '.warmup-caption-row')[0]
  const pill = ruleBodies(exercisesCss, '.warmup-guide-mute')[0]

  it('is positioned against the caption row', () => {
    expect(row).toMatch(/position:\s*relative/)
    expect(pill).toMatch(/position:\s*absolute/)
  })

  it('offsets by the row’s own gutter rather than zero', () => {
    const padding = declaration(row, 'padding')
    const right = declaration(pill, 'right')
    expect(padding).not.toBeNull()
    expect(right).not.toBeNull()

    // `padding: 0 12px` — the horizontal half is the gutter the pill has to
    // clear, and the two must agree or the pill drifts back out of the row.
    const gutter = pixelLengths(padding ?? '').at(-1) ?? 0
    expect(gutter).toBeGreaterThan(0)
    expect(pixelLengths(right ?? '')).toEqual([gutter])
  })
})
