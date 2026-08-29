// ============================================================
// Session humanizer bridge tests — GM mapping, grid mapping, determinism
// ============================================================

import { describe, expect, it } from 'vitest'
import { swingShiftMs } from '../groove/groove-humanize'
import { createDrumSessionHumanizer } from './drum-session-humanize'

const BASE = {
  style: 'jazz' as const,
  intensity: 0.6,
  seed: 42,
  tempoBpm: 200,
}

function hit(
  overrides: Partial<
    Parameters<ReturnType<typeof createDrumSessionHumanizer>>[0]
  > = {},
) {
  return {
    gmKey: 38,
    velocity: 112,
    startBeat: 1,
    timelineBeat: 1,
    loopIteration: 0,
    ...overrides,
  }
}

describe('createDrumSessionHumanizer', () => {
  it('returns null for GM keys without a mapped voice', () => {
    const humanize = createDrumSessionHumanizer(BASE)
    expect(humanize(hit({ gmKey: 0 }))).toBeNull()
    expect(humanize(hit({ gmKey: 54 }))).toBeNull()
  })

  it('is deterministic and bounded for a mapped hit', () => {
    const humanize = createDrumSessionHumanizer(BASE)
    const first = humanize(hit())
    const second = createDrumSessionHumanizer(BASE)(hit())
    expect(first).toEqual(second)
    expect(first).not.toBeNull()
    expect(first?.velocity).toBeGreaterThanOrEqual(1)
    expect(first?.velocity).toBeLessThanOrEqual(127)
  })

  it('applies jazz swing at off-eighth timeline positions', () => {
    const humanize = createDrumSessionHumanizer({
      ...BASE,
      intensity: 0,
    })
    // timelineBeat 0.5 = sixteenth step 2 = the swung off-eighth.
    const swung = humanize(hit({ timelineBeat: 0.5, velocity: 80 }))
    expect(swung?.timeOffsetMs).toBeCloseTo(swingShiftMs('jazz', 2, 200), 6)
    const downbeat = humanize(hit({ timelineBeat: 1, velocity: 80 }))
    expect(downbeat?.timeOffsetMs).toBeCloseTo(0, 6)
  })

  it('varies across loop passes unless locked', () => {
    const free = createDrumSessionHumanizer({ ...BASE, intensity: 1 })
    const locked = createDrumSessionHumanizer({
      ...BASE,
      intensity: 1,
      locked: true,
    })
    const freeOffsets = [0, 4, 8].map(
      (bars) => free(hit({ timelineBeat: 1 + bars * 4 }))?.timeOffsetMs,
    )
    const lockedOffsets = [0, 4, 8].map(
      (bars) => locked(hit({ timelineBeat: 1 + bars * 4 }))?.timeOffsetMs,
    )
    expect(new Set(freeOffsets).size).toBeGreaterThan(1)
    expect(new Set(lockedOffsets).size).toBe(1)
  })
})
