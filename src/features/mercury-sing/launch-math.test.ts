// ============================================================
// Launch math — the seek that makes the band meet the singer
// ============================================================
//
// One line of arithmetic decides where Karaoke Night opens. A sign flip
// or a dropped clamp here would still render, still navigate, still look
// green — and land the singer in the wrong minute of the song.

import { describe, expect, it } from 'vitest'
import { launchStartSec, PRE_ROLL_SEC } from './launch-math'

describe('launchStartSec', () => {
  it('is match start + sung time − pre-roll', () => {
    // Matched the excerpt starting at 100s, sang for 12s: the singer is
    // near 112s, so the backing enters 2s behind them.
    expect(launchStartSec(100, 12)).toBe(110)
    expect(PRE_ROLL_SEC).toBe(2)
  })

  it('never seeks before the top of the song', () => {
    // Matched at the very start after 1s of singing: 1 − 2 would be −1.
    expect(launchStartSec(0, 1)).toBe(0)
    expect(launchStartSec(0, 0)).toBe(0)
  })

  it('an unplaced match launches relative to zero', () => {
    // The matcher scored the song but could not anchor the excerpt: treat
    // the start as 0 rather than refusing to launch.
    expect(launchStartSec(null, 12)).toBe(10)
    expect(launchStartSec(null, 1)).toBe(0)
  })

  it('the pre-roll is why "joining you" feels early, not late', () => {
    // Sub-second precision passes through untouched — rounding is the URL
    // contract's job (karaokeNightSessionUrl rounds to 0.1s), not ours.
    expect(launchStartSec(30.55, 4.25)).toBeCloseTo(32.8)
  })
})
