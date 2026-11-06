// ============================================================
// TV stage store tests — the picture's offset, and what it says
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { describeTvStageOffset, nudgeTvStageOffset, setTvStageOffsetMs, TV_STAGE_OFFSET_KEY, TV_STAGE_OFFSET_LIMIT_MS, TV_STAGE_OFFSET_STEP_MS, tvStageOffsetMs, } from '@/stores/tv-stage-store'

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

  it('is kept on the device, under a key the settings sync never carries', () => {
    nudgeTvStageOffset(150)

    expect(TV_STAGE_OFFSET_KEY.startsWith('pitchperfect_')).toBe(false)
    expect(localStorage.getItem(TV_STAGE_OFFSET_KEY)).toBe('150')
  })

  it('reads nothing an older build kept, or a sync brought, under the old key', async () => {
    localStorage.setItem('pitchperfect_tv_stage_offset_ms', '400')
    try {
      vi.resetModules()
      const fresh = await import('@/stores/tv-stage-store')

      expect(fresh.tvStageOffsetMs()).toBe(0)
    } finally {
      localStorage.removeItem('pitchperfect_tv_stage_offset_ms')
    }
  })

  it('reads back what this device kept under its own key', async () => {
    localStorage.setItem(TV_STAGE_OFFSET_KEY, '250')
    try {
      vi.resetModules()
      const fresh = await import('@/stores/tv-stage-store')

      expect(fresh.tvStageOffsetMs()).toBe(250)
    } finally {
      localStorage.removeItem(TV_STAGE_OFFSET_KEY)
    }
  })

  it.each([
    [0, 'in step with the phone'],
    [150, '150 ms earlier'],
    [-200, '200 ms later'],
  ])('reads %i ms as “%s”', (offset, words) => {
    expect(describeTvStageOffset(offset)).toBe(words)
  })
})
