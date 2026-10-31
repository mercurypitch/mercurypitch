// Studio clock tests — one web lease for every song opened in a visit, closed once the Studio closes and the last song has let it go.
import { describe, expect, it, vi } from 'vitest'
import { createStudioClock } from './studio-clock'
import type { StudioWebLease } from './web-audio-lease'

function fakeLease(): StudioWebLease & { close: ReturnType<typeof vi.fn> } {
  return {
    ensure: () => null,
    unlock: () => Promise.resolve(true),
    sampleRate: 48000,
    close: vi.fn(() => Promise.resolve()),
  }
}

describe('Studio clock', () => {
  it('lends the same lease to every song opened while the Studio is open', () => {
    const lease = fakeLease()
    const clock = createStudioClock(lease)
    const first = clock.hold()
    first.release()
    const second = clock.hold()
    expect(first.lease).toBe(lease)
    expect(second.lease).toBe(lease)
    expect(lease.close).not.toHaveBeenCalled()
    second.release()
    expect(lease.close).not.toHaveBeenCalled()
  })

  it('closes once the Studio has closed and the last song has let go, after its fade', () => {
    const lease = fakeLease()
    const clock = createStudioClock(lease)
    const song = clock.hold()
    clock.close()
    // The song still fades out on it.
    expect(lease.close).not.toHaveBeenCalled()
    song.release()
    expect(lease.close).toHaveBeenCalledOnce()
    song.release()
    expect(lease.close).toHaveBeenCalledOnce()
  })

  it('closes at once when no song holds it', () => {
    const lease = fakeLease()
    const clock = createStudioClock(lease)
    clock.close()
    expect(lease.close).toHaveBeenCalledOnce()
    clock.close()
    expect(lease.close).toHaveBeenCalledOnce()
  })
})
