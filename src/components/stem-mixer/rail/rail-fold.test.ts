// Where the rail folds Speed into More.

import { describe, expect, it } from 'vitest'
import { SPEED_FOLD_COARSE_PX, SPEED_FOLD_PX, speedFolds } from './rail-fold'

describe('speedFolds', () => {
  it('folds Speed under 860 px of rail on a mouse', () => {
    expect(speedFolds(SPEED_FOLD_PX - 1, false)).toBe(true)
    expect(speedFolds(SPEED_FOLD_PX, false)).toBe(false)
  })

  it('keeps it down to 640 px on a touch screen', () => {
    expect(speedFolds(700, true)).toBe(false)
    expect(speedFolds(SPEED_FOLD_COARSE_PX - 1, true)).toBe(true)
  })

  it('keeps the chip before the rail is measured', () => {
    expect(speedFolds(0, false)).toBe(false)
    expect(speedFolds(Number.NaN, false)).toBe(false)
  })
})
