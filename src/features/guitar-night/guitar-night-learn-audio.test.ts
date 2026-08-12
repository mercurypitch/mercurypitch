// Guitar Night Learn audio tests protect explicit, guide-only scheduling.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { GuitarRoomBand } from '@/features/guitar/backing/guitar-room-band'
import { playGuitarNightLearnGuide } from './guitar-night-learn-audio'

describe('playGuitarNightLearnGuide', () => {
  it('schedules a quiet-bus phrase with no pulse or count-in', async () => {
    const start = vi.fn(async () => ({
      expectedHitTimesMs: [],
      exerciseStartedAtSeconds: 0,
      completedAtSeconds: 1,
    }))
    const band = { start } as unknown as GuitarRoomBand

    await expect(
      playGuitarNightLearnGuide(band, [55, 57, 59]),
    ).resolves.toBe(true)
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        countInBeats: 0,
        exercisePulse: false,
        feel: 'click',
        melody: [
          expect.objectContaining({ midi: 55, startBeat: 0 }),
          expect.objectContaining({ midi: 57 }),
          expect.objectContaining({ midi: 59 }),
        ],
      }),
    )
  })

  it('does not open audio for an empty or invalid phrase', async () => {
    const start = vi.fn()
    const band = { start } as unknown as GuitarRoomBand

    await expect(
      playGuitarNightLearnGuide(band, [Number.NaN, 200]),
    ).resolves.toBe(false)
    expect(start).not.toHaveBeenCalled()
  })
})
