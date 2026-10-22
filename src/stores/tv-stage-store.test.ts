// ============================================================
// TV stage store tests — the picture's offset, and what it says
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import { describeTvStageOffset, nudgeTvStageOffset, setTvStageOffsetMs, TV_STAGE_OFFSET_LIMIT_MS, TV_STAGE_OFFSET_STEP_MS, tvStageOffsetMs, } from '@/stores/tv-stage-store'

afterEach(() => {
  setTvStageOffsetMs(0)
})

describe('the TV stage’s offset', () => {
  it('moves by a step either way', () => {
    nudgeTvStageOffset(TV_STAGE_OFFSET_STEP_MS)
    nudgeTvStageOffset(TV_STAGE_OFFSET_STEP_MS)
    nudgeTvStageOffset(-TV_STAGE_OFFSET_STEP_MS)

    expect(tvStageOffsetMs()).toBe(TV_STAGE_OFFSET_STEP_MS)
  })

  it('goes no further than its limit either way', () => {
    nudgeTvStageOffset(TV_STAGE_OFFSET_LIMIT_MS * 3)
    expect(tvStageOffsetMs()).toBe(TV_STAGE_OFFSET_LIMIT_MS)

    nudgeTvStageOffset(-TV_STAGE_OFFSET_LIMIT_MS * 5)
    expect(tvStageOffsetMs()).toBe(-TV_STAGE_OFFSET_LIMIT_MS)
  })

  it('is kept on the device', () => {
    nudgeTvStageOffset(150)

    expect(localStorage.getItem('pitchperfect_tv_stage_offset_ms')).toBe('150')
  })

  it.each([
    [0, 'in step with the phone'],
    [150, '150 ms earlier'],
    [-200, '200 ms later'],
  ])('reads %i ms as “%s”', (offset, words) => {
    expect(describeTvStageOffset(offset)).toBe(words)
  })
})
