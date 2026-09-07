// Draft locks must hold the exact recording until release, without waiting on another tab.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { acquireGuitarRecordingLock } from './recording-lock'

type DraftLockCallback = (lock: Lock | null) => Promise<void>

afterEach(() => vi.unstubAllGlobals())

describe('recording draft lock', () => {
  it('holds the exact origin-local recording lock until its owner releases it', async () => {
    let held: Promise<void> | undefined
    const request = vi.fn(
      (_name: string, _options: LockOptions, callback: DraftLockCallback) => {
        held = Promise.resolve(
          callback({ name: 'guitar-recording:take-1', mode: 'exclusive' }),
        )
        return held
      },
    )
    vi.stubGlobal('navigator', { locks: { request } })
    const release = await acquireGuitarRecordingLock('take-1')
    expect(request).toHaveBeenCalledWith(
      'guitar-recording:take-1',
      { ifAvailable: true },
      expect.any(Function),
    )
    expect(release).toBeTypeOf('function')
    const settled = vi.fn()
    void held!.then(settled)
    await Promise.resolve()
    expect(settled).not.toHaveBeenCalled()
    release!()
    release!()
    await held
    expect(settled).toHaveBeenCalledOnce()
  })

  it('reports another tab ownership without waiting for or stealing its lock', async () => {
    const request = vi.fn(
      async (
        _name: string,
        _options: LockOptions,
        callback: DraftLockCallback,
      ) => callback(null),
    )
    vi.stubGlobal('navigator', { locks: { request } })
    await expect(acquireGuitarRecordingLock('busy')).resolves.toBeNull()
    expect(request).toHaveBeenCalledWith(
      'guitar-recording:busy',
      { ifAvailable: true },
      expect.any(Function),
    )
  })

  it('surfaces a lock manager failure instead of pretending the draft is owned', async () => {
    vi.stubGlobal('navigator', {
      locks: {
        request: vi.fn().mockRejectedValue(new Error('locks unavailable')),
      },
    })
    await expect(acquireGuitarRecordingLock('failed')).rejects.toThrow(
      'locks unavailable',
    )
  })

  it('keeps the existing best-effort fallback explicit when Web Locks are unsupported', async () => {
    vi.stubGlobal('navigator', {})
    const release = await acquireGuitarRecordingLock('fallback')
    expect(release).toBeTypeOf('function')
    expect(release!()).toBeUndefined()
  })
})
