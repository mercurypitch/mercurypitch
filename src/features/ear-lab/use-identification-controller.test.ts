// A miss's slow replay finishes before the next round starts — the two
// would otherwise sound over each other — and Stop still cuts it short.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LEAP_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { REVEAL_TIMING } from '@/lib/ear/timing'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))

const REPLAY_MS = 2000

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('useIdentificationController on a miss', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    resetEarLabStore()
  })
  afterEach(() => vi.useRealTimers())

  function setUp() {
    const drill = findIdentificationDrill('leap')
    if (!drill) throw new Error('leap missing')
    const plays: string[] = []
    let dispose: () => void = () => undefined
    const controller = createRoot((d) => {
      dispose = d
      return useIdentificationController(
        drill,
        LEAP_BANK,
        (item): IdentificationTrial => ({
          expectedId: item.itemId,
          play: async () => {
            plays.push(item.itemId)
          },
          replayOnWrong: () => wait(REPLAY_MS),
        }),
      )
    })
    return { controller, plays, dispose }
  }

  it('holds the next round until the replay has finished', async () => {
    const { controller, plays, dispose } = setUp()
    controller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(controller.phase()).toBe('answer')
    expect(plays).toHaveLength(1)

    controller.answer('not-the-answer')
    expect(controller.phase()).toBe('reveal')
    expect(controller.replaying()).toBe(true)

    // The old hold alone is not enough: the replay is still sounding.
    await vi.advanceTimersByTimeAsync(REVEAL_TIMING.identificationWrongMs + 5)
    expect(controller.round()).toBe(0)
    expect(plays).toHaveLength(1)

    // Up to the moment the replay ends: still on the reveal, not replaying.
    await vi.advanceTimersByTimeAsync(
      REPLAY_MS - REVEAL_TIMING.identificationWrongMs - 5,
    )
    expect(controller.replaying()).toBe(false)
    expect(controller.round()).toBe(0)
    // The hold counts from the end of the replay.
    await vi.advanceTimersByTimeAsync(REVEAL_TIMING.identificationWrongMs - 5)
    expect(controller.round()).toBe(0)
    await vi.advanceTimersByTimeAsync(10)
    expect(controller.round()).toBe(1)
    expect(plays).toHaveLength(2)
    dispose()
  })

  it('a right answer moves on after the short hold, with no replay', async () => {
    const { controller, plays, dispose } = setUp()
    controller.start()
    await vi.advanceTimersByTimeAsync(0)
    controller.answer(controller.expectedId() ?? '')
    expect(controller.replaying()).toBe(false)
    await vi.advanceTimersByTimeAsync(REVEAL_TIMING.identificationCorrectMs + 5)
    expect(controller.round()).toBe(1)
    expect(plays).toHaveLength(2)
    dispose()
  })

  it('Stop during the replay ends the run and never starts another round', async () => {
    const { controller, plays, dispose } = setUp()
    controller.start()
    await vi.advanceTimersByTimeAsync(0)
    controller.answer('not-the-answer')
    await vi.advanceTimersByTimeAsync(500)
    controller.stop()
    expect(controller.phase()).toBe('done')
    await vi.advanceTimersByTimeAsync(
      REPLAY_MS + REVEAL_TIMING.identificationWrongMs + 100,
    )
    expect(plays).toHaveLength(1)
    expect(controller.phase()).toBe('done')
    dispose()
  })
})
