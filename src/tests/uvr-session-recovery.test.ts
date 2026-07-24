import { describe, expect, it, vi } from 'vitest'
import { canRetryUvrSession, getRecoveryCopy, loadRetainedOriginalSong, } from '@/lib/uvr-session-recovery'

describe('UVR cancelled-session recovery', () => {
  it('enables recovery when the original audio is retained', async () => {
    const retained = await loadRetainedOriginalSong(
      'session-123',
      vi
        .fn()
        .mockResolvedValue(
          new File(['audio'], 'cancelled-song.mp3', { type: 'audio/mpeg' }),
        ),
    )

    expect(retained).toBe(true)
    expect(canRetryUvrSession('cancelled', true, 'available', true)).toBe(true)
    expect(getRecoveryCopy('available')).toEqual({
      title: 'Original song kept',
      description: 'Process it again to finish creating karaoke stems.',
    })
  })

  it('does not trust stale metadata when retained audio is missing', async () => {
    const retained = await loadRetainedOriginalSong(
      'session-123',
      vi.fn().mockResolvedValue(null),
    )

    expect(retained).toBe(false)
    expect(canRetryUvrSession('cancelled', true, 'unavailable', true)).toBe(
      false,
    )
    expect(getRecoveryCopy('unavailable')).toEqual({
      title: 'Original upload unavailable',
      description: 'Delete this card or upload the song again.',
    })
  })

  it('preserves retries for errors with retained-file metadata', () => {
    expect(canRetryUvrSession('error', true, 'unavailable', true)).toBe(true)
    expect(canRetryUvrSession('error', false, 'available', true)).toBe(false)
    expect(canRetryUvrSession('cancelled', true, 'available', false)).toBe(
      false,
    )
  })
})
