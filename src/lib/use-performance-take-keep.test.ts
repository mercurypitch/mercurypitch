// ============================================================
// Performance Take Keep tests — explicit temporary save boundary
// ============================================================

import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { performanceTakeKeepLabel, usePerformanceTakeKeep, } from '@/lib/use-performance-take-keep'

function createKeepController() {
  let dispose: () => void = () => undefined
  const controller = createRoot((disposeRoot) => {
    dispose = disposeRoot
    return usePerformanceTakeKeep()
  })
  return { controller, dispose }
}

describe('usePerformanceTakeKeep', () => {
  it('saves only an explicitly ready candidate and becomes one-shot on success', async () => {
    const { controller, dispose } = createKeepController()
    const save = vi.fn(async () => ({
      ok: true,
      quotaExceeded: false,
      roomAvailable: true,
    }))

    expect(await controller.keep()).toBe(false)
    controller.beginCapture()
    controller.beginProcessing()
    controller.ready(save)
    expect(controller.state()).toBe('ready')

    expect(await controller.keep()).toBe(true)
    expect(save).toHaveBeenCalledTimes(1)
    expect(controller.state()).toBe('saved')
    expect(await controller.keep()).toBe(false)
    expect(save).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('retains the temporary replay for retry after quota or write failure', async () => {
    const { controller, dispose } = createKeepController()
    const quotaFailure = vi.fn(async () => ({
      ok: false,
      quotaExceeded: true,
      roomAvailable: false,
    }))
    controller.ready(quotaFailure)

    expect(await controller.keep()).toBe(false)
    expect(controller.state()).toBe('ready')
    expect(controller.message()).toContain('enough local space')
    expect(await controller.keep()).toBe(false)
    expect(quotaFailure).toHaveBeenCalledTimes(2)
    dispose()
  })

  it('allows a ready candidate to be dismissed but not an active save', async () => {
    const { controller, dispose } = createKeepController()
    let resolveSave: (() => void) | undefined
    const save = vi.fn(
      () =>
        new Promise<{
          ok: boolean
          quotaExceeded: boolean
          roomAvailable: boolean
        }>((resolve) => {
          resolveSave = () =>
            resolve({ ok: true, quotaExceeded: false, roomAvailable: true })
        }),
    )
    controller.ready(save)
    const pending = controller.keep()

    expect(controller.state()).toBe('saving')
    expect(controller.dismiss()).toBe(false)
    resolveSave?.()
    await pending
    expect(controller.dismiss()).toBe(true)
    expect(controller.state()).toBe('idle')
    dispose()
  })
})

describe('performanceTakeKeepLabel', () => {
  it('gives concise progress and completion labels', () => {
    expect(performanceTakeKeepLabel('processing')).toBe('Preparing replay')
    expect(performanceTakeKeepLabel('saving')).toBe('Keeping take')
    expect(performanceTakeKeepLabel('saved')).toBe('Kept in Hear Yourself')
    expect(performanceTakeKeepLabel('ready')).toBe('Keep in Hear Yourself')
  })
})
