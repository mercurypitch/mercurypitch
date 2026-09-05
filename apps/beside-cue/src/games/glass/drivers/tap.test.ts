// ============================================================
// The tap driver's lifecycle around a slow resume: a stop() that
// lands while start() is still waiting must not put listeners on
// the window that nothing will take off.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  lease: {
    ensure: vi.fn(() => ({ currentTime: 1 })),
    unlock: vi.fn<() => Promise<boolean>>(async () => true),
    peek: vi.fn(() => ({ currentTime: 3 })),
    release: vi.fn(),
  },
}))

vi.mock('@/audio/shared-audio-context', () => ({
  acquireSharedAudioContext: () => mocks.lease,
}))

import { createTapDriver } from './tap'

const tap = (): void => {
  window.dispatchEvent(
    new MouseEvent('pointerdown', { clientX: 4, clientY: 8, bubbles: true }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.lease.unlock.mockResolvedValue(true)
})

describe('createTapDriver', () => {
  it('queues taps stamped on the shared clock, and stop() takes them off', async () => {
    const driver = createTapDriver()
    await driver.start()
    tap()
    expect(driver.drainIntents()).toEqual([
      { type: 'tap', tAudio: 3, x: 4, y: 8 },
    ])
    driver.stop()
    tap()
    expect(driver.drainIntents()).toEqual([])
    expect(mocks.lease.release).toHaveBeenCalledTimes(1)
  })

  it('a stop() during the resume puts no listeners on', async () => {
    let ready!: (ok: boolean) => void
    mocks.lease.unlock.mockReturnValue(
      new Promise<boolean>((resolve) => {
        ready = resolve
      }),
    )
    const driver = createTapDriver()
    const started = driver.start()
    driver.stop()
    ready(true)
    await started
    tap()
    expect(driver.drainIntents()).toEqual([])
    expect(mocks.lease.release).toHaveBeenCalledTimes(1)
  })
})
