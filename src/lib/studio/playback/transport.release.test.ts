// Studio transport release — no warm-up starts while Export, Compare or auto-balance is still taking the song's audio back.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { transportFixture } from './transport.test-fixtures'

afterEach(() => vi.useRealTimers())

describe('Studio transport release', () => {
  it('starts no warm-up until a release is through, and one after it', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const released = f.transport.releaseAudio()
    // A warm-up asked for mid-release would read the audio the release frees.
    void f.transport.warm(f.project, [f.asset])
    await vi.advanceTimersByTimeAsync(240)
    await released
    expect(f.cache.acquire).not.toHaveBeenCalled()

    await f.transport.warm(f.project, [f.asset])
    expect(f.cache.acquire).toHaveBeenCalled()
    f.transport.dispose()
  })
})
