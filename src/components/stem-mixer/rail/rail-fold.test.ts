// Where the rail folds Speed, Key and Play from the start into More.

import { describe, expect, it } from 'vitest'
import { KEY_FOLD_COARSE_PX, KEY_FOLD_PX, keyFolds, RESTART_FOLD_COARSE_PX, RESTART_FOLD_PX, restartFolds, SPEED_FOLD_COARSE_PX, SPEED_FOLD_PX, speedFolds, } from './rail-fold'

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

describe('keyFolds', () => {
  it('folds Key under 574 px of rail on a touch screen, 406 on a mouse', () => {
    expect(keyFolds(KEY_FOLD_COARSE_PX - 1, true)).toBe(true)
    expect(keyFolds(KEY_FOLD_COARSE_PX, true)).toBe(false)
    expect(keyFolds(KEY_FOLD_PX - 1, false)).toBe(true)
    expect(keyFolds(KEY_FOLD_PX, false)).toBe(false)
  })

  it('folds only once Speed has folded', () => {
    expect(KEY_FOLD_COARSE_PX).toBeLessThan(SPEED_FOLD_COARSE_PX)
    expect(KEY_FOLD_PX).toBeLessThan(SPEED_FOLD_PX)
  })

  it('keeps the chip before the rail is measured', () => {
    expect(keyFolds(0, true)).toBe(false)
    expect(keyFolds(Number.NaN, true)).toBe(false)
  })
})

describe('restartFolds', () => {
  it('folds Play from the start under 486 px on a touch screen, 332 on a mouse', () => {
    expect(restartFolds(RESTART_FOLD_COARSE_PX - 1, true)).toBe(true)
    expect(restartFolds(RESTART_FOLD_COARSE_PX, true)).toBe(false)
    expect(restartFolds(RESTART_FOLD_PX - 1, false)).toBe(true)
    expect(restartFolds(RESTART_FOLD_PX, false)).toBe(false)
  })

  it('folds last, after Key', () => {
    expect(RESTART_FOLD_COARSE_PX).toBeLessThan(KEY_FOLD_COARSE_PX)
    expect(RESTART_FOLD_PX).toBeLessThan(KEY_FOLD_PX)
  })

  it('keeps the button before the rail is measured', () => {
    expect(restartFolds(0, true)).toBe(false)
  })
})
