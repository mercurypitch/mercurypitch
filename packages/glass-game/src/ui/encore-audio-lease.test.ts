// Encore audio lease checks — stale playback cleanup cannot release a newer quiet capture.
import { describe, expect, it, vi } from 'vitest'
import { createEncoreAudioLeaseOwner, retireEncoreAudioLease, } from './encore-audio-lease'

describe('encore audio lease owner', () => {
  it('ignores a retiring playback release after a newer capture takes ownership', async () => {
    const silence = vi.fn(async () => {})
    const release = vi.fn()
    const owner = createEncoreAudioLeaseOwner(silence, release)
    const playback = owner.acquire()
    const capture = owner.acquire()
    await Promise.all([playback.quiet, capture.quiet])

    let finishStop!: () => void
    const stopped = new Promise<void>((resolve) => {
      finishStop = resolve
    })
    const retiring = retireEncoreAudioLease(playback, () => stopped)
    finishStop()
    await retiring
    expect(release).not.toHaveBeenCalled()
    capture.release()
    expect(release).toHaveBeenCalledOnce()
  })

  it('releases playback after a background stop even when the player rejects', async () => {
    const release = vi.fn()
    const owner = createEncoreAudioLeaseOwner(async () => {}, release)
    const playback = owner.acquire()
    await retireEncoreAudioLease(playback, async () => {
      throw new Error('output already retired')
    })
    expect(release).toHaveBeenCalledOnce()
  })

  it('releases an active lease on disposal exactly once', async () => {
    const release = vi.fn()
    const owner = createEncoreAudioLeaseOwner(async () => {}, release)
    const playback = owner.acquire()
    await playback.quiet

    owner.releaseAll()
    playback.release()
    owner.releaseAll()
    expect(release).toHaveBeenCalledOnce()
  })
})
