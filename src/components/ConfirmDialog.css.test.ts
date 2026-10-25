// ============================================================
// ConfirmDialog's stylesheet, read as text
// ============================================================
//
// jsdom applies no CSS, so what a rule covers is read from the sheet. The
// stay variant's two buttons are disabled while the dialog is busy, as the
// pair's are, and must say so the same way.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SHEET = readFileSync(
  resolve(__dirname, 'ConfirmDialog.module.css'),
  'utf8',
)

/** The selectors of every rule whose body sets `property: value`. */
function selectorsSetting(property: string, value: string): string[] {
  const rules = SHEET.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(
    /([^{}]+)\{([^{}]*)\}/g,
  )
  return [...rules]
    .filter(([, , body]) =>
      new RegExp(`(^|;|\\s)${property}\\s*:\\s*${value}\\s*(;|$)`).test(body),
    )
    .flatMap(([, selectors]) => selectors.split(',').map((s) => s.trim()))
}

describe("the stay variant's buttons", () => {
  it('fade while the dialog is busy, as the pair do', () => {
    const faded = selectorsSetting('opacity', '0.55')

    expect(faded).toEqual(
      expect.arrayContaining([
        '.cancel:disabled',
        '.delete:disabled',
        '.keep:disabled',
        '.quiet:disabled',
      ]),
    )
  })
})
