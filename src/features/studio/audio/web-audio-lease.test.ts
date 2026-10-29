// Studio web lease tests — its own 48 kHz clock, made inside the press after the session clip, kept across plays and closed with the Studio.
import { describe, expect, it, vi } from 'vitest'
import { createStudioAudioContext, createStudioWebLease, } from './web-audio-lease'

/** A clock that starts suspended, as one made by a page does. */
function fakeContext() {
  const ctx = {
    state: 'suspended' as AudioContextState,
    resume: vi.fn(async () => {
      ctx.state = 'running'
    }),
    close: vi.fn(async () => {
      ctx.state = 'closed'
    }),
  }
  return ctx
}

describe('Studio web audio lease', () => {
  it('makes its clock inside the press, after the session clip, and keeps it for every Play', async () => {
    const order: string[] = []
    const made: ReturnType<typeof fakeContext>[] = []
    const create = vi.fn(() => {
      order.push('make')
      const ctx = fakeContext()
      made.push(ctx)
      return ctx as unknown as AudioContext
    })
    const unlock = (ensure: () => AudioContext | null) => {
      order.push('clip')
      const ctx = ensure()
      order.push('clock')
      return ctx
    }
    const lease = createStudioWebLease(create, unlock)
    // Nothing is made, and nothing sounds, before a press.
    expect(lease.ensure()).toBeNull()
    expect(create).not.toHaveBeenCalled()
    expect(await lease.unlock()).toBe(true)
    expect(order).toEqual(['clip', 'make', 'clock'])
    expect(lease.ensure()).toBe(made[0])
    expect(await lease.unlock()).toBe(true)
    expect(create).toHaveBeenCalledOnce()
    expect(lease.ensure()).toBe(made[0])
  })

  it('makes a new clock when the browser closed the last one', async () => {
    const create = vi.fn(() => fakeContext() as unknown as AudioContext)
    const lease = createStudioWebLease(create, (ensure) => ensure())
    await lease.unlock()
    const first = lease.ensure()!
    await first.close()
    expect(await lease.unlock()).toBe(true)
    expect(create).toHaveBeenCalledTimes(2)
    expect(lease.ensure()).not.toBe(first)
  })

  it('closes its clock with the Studio and starts none after', async () => {
    const create = vi.fn(() => fakeContext() as unknown as AudioContext)
    const lease = createStudioWebLease(create, (ensure) => ensure())
    await lease.unlock()
    const ctx = lease.ensure()!
    await lease.close()
    expect(ctx.close).toHaveBeenCalledOnce()
    expect(lease.ensure()).toBeNull()
    expect(await lease.unlock()).toBe(false)
    expect(create).toHaveBeenCalledOnce()
  })

  it('says no when the clock cannot start', async () => {
    const ctx = fakeContext()
    ctx.resume.mockRejectedValue(new Error('not allowed'))
    const lease = createStudioWebLease(
      () => ctx as unknown as AudioContext,
      (ensure) => ensure(),
    )
    expect(await lease.unlock()).toBe(false)
  })

  it('asks for 48 kHz with playback buffers, and takes the device rate where 48 kHz is refused', () => {
    const make = vi.fn((options: AudioContextOptions) => {
      if (options.sampleRate !== undefined)
        throw new DOMException('Unsupported rate', 'NotSupportedError')
      return { sampleRate: 44100 } as AudioContext
    })
    expect(createStudioAudioContext(make).sampleRate).toBe(44100)
    expect(make.mock.calls).toEqual([
      [{ sampleRate: 48000, latencyHint: 'playback' }],
      [{ latencyHint: 'playback' }],
    ])
  })
})
