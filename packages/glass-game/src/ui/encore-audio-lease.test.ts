// Encore audio lease checks — stale playback cleanup cannot release a newer quiet capture.
import { describe, expect, it, vi } from 'vitest'
import { createEncoreAudioLeaseOwner, createEncorePlaybackClaims, retireEncoreAudioLease, } from './encore-audio-lease'

describe('encore audio lease owner', () => {
  it('ignores an old dialog release after a reopened dialog takes ownership', async () => {
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

  it('releases a concrete active lease exactly once', async () => {
    const release = vi.fn()
    const owner = createEncoreAudioLeaseOwner(async () => {}, release)
    const playback = owner.acquire()
    await playback.quiet

    playback.release()
    playback.release()
    expect(release).toHaveBeenCalledOnce()
  })

  it('keeps a newer same-asset playback when the replaced one completes', () => {
    const claims = createEncorePlaybackClaims()
    const firstRelease = vi.fn()
    const secondRelease = vi.fn()
    const first = claims.claim(
      { quiet: Promise.resolve(), release: firstRelease },
      'voice.same',
    )
    const second = claims.claim(
      { quiet: Promise.resolve(), release: secondRelease },
      'voice.same',
    )

    expect(claims.release(first)).toEqual({ latest: false, owned: false })
    expect(firstRelease).toHaveBeenCalledOnce()
    expect(claims.currentAssetId()).toBe('voice.same')
    expect(claims.release(second)).toEqual({ latest: true, owned: true })
    expect(secondRelease).toHaveBeenCalledOnce()
    expect(claims.currentAssetId()).toBeNull()
  })

  it('reports a current load failure after output cleanup but ignores a superseded one', () => {
    const claims = createEncorePlaybackClaims()
    const failed = claims.claim(
      { quiet: Promise.resolve(), release: vi.fn() },
      'voice.failed',
    )

    expect(claims.release(failed)).toEqual({ latest: true, owned: true })
    expect(claims.release(failed)).toEqual({ latest: true, owned: false })

    const superseded = claims.claim(
      { quiet: Promise.resolve(), release: vi.fn() },
      'voice.same',
    )
    claims.claim({ quiet: Promise.resolve(), release: vi.fn() }, 'voice.same')
    expect(claims.release(superseded)).toEqual({
      latest: false,
      owned: false,
    })
  })
})
