// Where the header folds its view controls into the View menu.

import { describe, expect, it } from 'vitest'
import { HEADER_FOLD_COARSE_PX, HEADER_FOLD_PX, headerFolds, } from './header-fold'

describe('headerFolds', () => {
  it('folds under 600 px of header on a mouse', () => {
    expect(headerFolds(HEADER_FOLD_PX - 1, false)).toBe(true)
    expect(headerFolds(HEADER_FOLD_PX, false)).toBe(false)
    // 769x600, the narrowest window with the desktop mixer: 437 px of header.
    expect(headerFolds(437, false)).toBe(true)
    // 1024x768: 692 px.
    expect(headerFolds(692, false)).toBe(false)
  })

  it('folds under 1000 px on a touch screen, where controls are 44 px', () => {
    expect(headerFolds(HEADER_FOLD_COARSE_PX - 1, true)).toBe(true)
    expect(headerFolds(HEADER_FOLD_COARSE_PX, true)).toBe(false)
  })

  it('folds nothing before the header is measured', () => {
    expect(headerFolds(0, false)).toBe(false)
    expect(headerFolds(Number.NaN, true)).toBe(false)
  })
})
