// ============================================================
// The key steppers' sizes, read off their stylesheets
// ============================================================
//
// jsdom lays nothing out, so a render test cannot see a 28 px button or a
// 10 px caption. The floors are the finding, and a compaction pass is what
// would undo them, so the contract is read from the CSS the way
// LyricsAlignButtons.test.tsx reads its thumb size: 12 px is the floor for
// text, and a finger needs 44 px wherever a control is hosted.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sheet = (file: string): string =>
  readFileSync(resolve(__dirname, file), 'utf8')

/** The declarations of the first rule that names `selector`, alone or in a list. */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const found = new RegExp(`(?:^|[\\s,}])${escaped}\\s*(?:,[^{}]*)?\\{`).exec(
    css,
  )
  if (found === null) throw new Error(`${selector} is not in the stylesheet`)
  const open = found.index + found[0].length
  return css.slice(open, css.indexOf('}', open))
}

/** A length declared in `declarations`, in px (rem is 16 px). */
function lengthPx(declarations: string, property: string): number {
  const found = new RegExp(
    `(?:^|[\\s;{])${property}:\\s*([\\d.]+)(px|rem)`,
  ).exec(declarations)
  if (found === null) throw new Error(`no ${property} in: ${declarations}`)
  return Number(found[1]) * (found[2] === 'rem' ? 16 : 1)
}

describe('the key control in a compact host', () => {
  const css = sheet('KeyShiftControl.module.css')
  const coarse = css.slice(css.indexOf('@media (pointer: coarse)'))

  it('reads its text at 12 px or more', () => {
    expect(
      lengthPx(rule(css, '.keyShift'), 'font-size'),
    ).toBeGreaterThanOrEqual(12)
  })

  it('gives each of its buttons 44 px to press on a coarse pointer', () => {
    const step = rule(coarse, ".keyShift[data-size='compact'] .step")
    expect(lengthPx(step, 'width')).toBeGreaterThanOrEqual(44)
    expect(lengthPx(step, 'height')).toBeGreaterThanOrEqual(44)

    const value = rule(coarse, ".keyShift[data-size='compact'] .value")
    expect(lengthPx(value, 'min-width')).toBeGreaterThanOrEqual(44)
    expect(lengthPx(value, 'height')).toBeGreaterThanOrEqual(44)
  })

  it('makes room for those buttons in the stepper that holds them', () => {
    // 44 px of button inside a 1 px border is 46 px of stepper.
    const frame = rule(coarse, ".keyShift[data-size='compact'] .stepper")
    expect(lengthPx(frame, 'height')).toBeGreaterThanOrEqual(46)
  })
})

describe("a playlist entry's key stepper", () => {
  const css = sheet('EntryKeyStepper.module.css')
  const coarse = css.slice(css.indexOf('@media (pointer: coarse)'))

  it('reads its text at 12 px or more', () => {
    expect(
      lengthPx(rule(css, '.entryKey'), 'font-size'),
    ).toBeGreaterThanOrEqual(12)
  })

  it('gives its steps and its clear button 44 px to press on a coarse pointer', () => {
    for (const selector of ['.step', '.clear']) {
      const target = rule(coarse, selector)
      expect(lengthPx(target, 'width')).toBeGreaterThanOrEqual(44)
      expect(lengthPx(target, 'height')).toBeGreaterThanOrEqual(44)
    }
  })
})
