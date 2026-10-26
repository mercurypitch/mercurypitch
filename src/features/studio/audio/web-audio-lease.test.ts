// Studio gesture tests distinguish engine preloading from synchronous context activation.
import { describe, expect, it, vi } from 'vitest'
import { createStudioWebLease } from './web-audio-lease'

describe('Studio web audio gesture', () => {
  it('preloads without sound and activates before unlock yields to a microtask', async () => {
    let context: AudioContext | null = null
    let complete!: () => void
    const engine = {
      init: vi.fn(() => {
        context = { state: 'running' } as AudioContext
        return new Promise<void>((resolve) => {
          complete = resolve
        })
      }),
      resume: vi.fn().mockResolvedValue(undefined),
      getAudioContext: () => context,
    }
    const activate = vi.fn((target: typeof engine) =>
      target.init().then(() => target.resume()),
    )
    const ready = vi.fn()
    const lease = createStudioWebLease(Promise.resolve(engine), ready, activate)
    await Promise.resolve()
    expect(ready).toHaveBeenCalledWith(true)
    expect(engine.init).not.toHaveBeenCalled()
    const unlocking = lease.unlock()
    expect(engine.init).toHaveBeenCalledOnce()
    expect(lease.ensure()).toBe(context)
    complete()
    expect(await unlocking).toBe(true)
  })

  it('does not start audio later when a request predates engine readiness', async () => {
    let loaded!: (engine: {
      init(): Promise<void>
      resume(): Promise<void>
      getAudioContext(): AudioContext | null
    }) => void
    const loading = new Promise<{
      init(): Promise<void>
      resume(): Promise<void>
      getAudioContext(): AudioContext | null
    }>((resolve) => {
      loaded = resolve
    })
    const activate = vi.fn().mockResolvedValue(undefined)
    const lease = createStudioWebLease(loading, vi.fn(), activate)
    expect(await lease.unlock()).toBe(false)
    loaded({
      init: async () => undefined,
      resume: async () => undefined,
      getAudioContext: () => null,
    })
    await Promise.resolve()
    expect(activate).not.toHaveBeenCalled()
  })
})
