// ============================================================
// The z-scale — a toast has to outrank whatever raised it
// ============================================================
//
// Reported on 0.9.11's dev build: sharing from the account page's zoomed
// voiceprint put the "link copied" toast BEHIND the overlay that opened it,
// where the overlay's backdrop-filter blurred it for good measure. The
// toast sat at 1100 and the overlay at 4000 — one of a whole band of
// hand-numbered modals written before the scale existed.
//
// So this is the rule, checked against the stylesheets themselves: nothing
// may sit between the toast and the always-on-top band. Raise a modal above
// the toast and this fails here rather than on someone's screen.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Deliberately above everything, toasts included: the consent banner, the
 *  database notice, the portable console. Nothing else may live up here. */
const ALWAYS_ON_TOP = 2147483000

const SRC = join(process.cwd(), 'src')

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return cssFiles(path)
    return path.endsWith('.css') ? [path] : []
  })
}

function toastZ(): number {
  const kit = readFileSync(join(SRC, 'styles', 'mobile-kit.css'), 'utf8')
  const match = /--z-toast:\s*(\d+)/.exec(kit)
  expect(match).not.toBeNull()
  return Number(match?.[1])
}

describe('the z-scale', () => {
  it('keeps every modal below the toast that reports on it', () => {
    const toast = toastZ()
    const tooHigh: string[] = []

    for (const file of cssFiles(SRC)) {
      const css = readFileSync(file, 'utf8')
      for (const [, value] of css.matchAll(/z-index:\s*(\d+)\s*;/g)) {
        const z = Number(value)
        if (z > toast && z < ALWAYS_ON_TOP) {
          tooHigh.push(`${file.slice(SRC.length + 1)}: z-index ${z}`)
        }
      }
    }

    expect(tooHigh).toEqual([])
  })

  it('puts the toast above modals and below the always-on-top band', () => {
    const kit = readFileSync(join(SRC, 'styles', 'mobile-kit.css'), 'utf8')
    const modal = Number(/--z-modal:\s*(\d+)/.exec(kit)?.[1])
    expect(modal).toBeLessThan(toastZ())
    expect(toastZ()).toBeLessThan(ALWAYS_ON_TOP)
  })
})
