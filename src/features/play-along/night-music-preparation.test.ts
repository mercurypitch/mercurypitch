// Night preparation regressions enforce reuse, cancellation and credit preflight before room replacement.
import { describe, expect, it, vi } from 'vitest'
import type { UvrSongPreparationResult } from '@/lib/uvr-song-preparation'
import type { PlayAlongBandPreparationPort } from './band-preparation-port'
import type { NightMusicTask } from './night-music-import'
import { prepareBandWithPreflight } from './prepare-band'
import type { NightAudioPreparationPort } from './prepare-night-music'
import { prepareNightMusicAudio } from './prepare-night-music'

function task() {
  const abort = new AbortController()
  const context: NightMusicTask = {
    signal: abort.signal,
    assertCurrent: () => abort.signal.throwIfAborted(),
    report: vi.fn(),
    warn: vi.fn(),
  }
  return { abort, context }
}

describe('night audio preparation', () => {
  it.each(['completed', 'existing'] as const)(
    'opens the %s durable identity through the existing pipeline',
    async (status) => {
      const { context } = task()
      const prepare = vi.fn<NightAudioPreparationPort['prepare']>(
        async (_file, options) => {
          options.onUpdate({ phase: 'separating', progress: 50 })
          options.onWarning('Original audio could not be saved.')
          return { status, sessionId: 'prepared' }
        },
      )
      expect(
        await prepareNightMusicAudio(
          new File(['x'], 'song.wav'),
          context,
          async () => ({ prepare }),
        ),
      ).toBe('prepared')
      expect(context.report).toHaveBeenCalledWith(
        expect.stringContaining('Separating'),
        0.5,
      )
      expect(context.warn).toHaveBeenCalledWith(
        'Original audio could not be saved.',
      )
      expect(prepare).toHaveBeenCalledOnce()
    },
  )
  it.each([
    [{ status: 'cancelled' }, 'Cancelled'],
    [{ status: 'error', message: 'Decode failed' }, 'Decode failed'],
    [{ status: 'in-flight', sessionId: 'pending' }, 'already being prepared'],
  ] satisfies [UvrSongPreparationResult, string][])(
    'does not stage non-ready result %j',
    async (result, message) => {
      const { context } = task()
      await expect(
        prepareNightMusicAudio(
          new File(['x'], 'song.wav'),
          context,
          async () => ({ prepare: async () => result }),
        ),
      ).rejects.toThrow(message)
    },
  )
  it('does not begin preparation after cancelled port loading', async () => {
    const { context, abort } = task()
    const prepare = vi.fn()
    await expect(
      prepareNightMusicAudio(new File(['x'], 'song.wav'), context, async () => {
        abort.abort()
        return { prepare }
      }),
    ).rejects.toThrow()
    expect(prepare).not.toHaveBeenCalled()
  })
})

describe('band split admission', () => {
  function port() {
    return {
      reusePreparedBand: vi.fn<
        NonNullable<PlayAlongBandPreparationPort['reusePreparedBand']>
      >(async () => null),
      prepareBand: vi.fn<PlayAlongBandPreparationPort['prepareBand']>(
        async () => ({ saved: ['guitar', 'drums'] }),
      ),
    } satisfies PlayAlongBandPreparationPort
  }
  it('uses saved parts before checking credits or starting a cloud job', async () => {
    const band = port()
    band.reusePreparedBand.mockResolvedValue({ saved: ['guitar', 'drums'] })
    const checkPreflight = vi.fn()
    const { context } = task()
    expect(
      await prepareBandWithPreflight(band, 'song', {
        ...context,
        checkPreflight,
        onUpdate: vi.fn(),
      }),
    ).toBeNull()
    expect(checkPreflight).not.toHaveBeenCalled()
    expect(band.prepareBand).not.toHaveBeenCalled()
  })
  it('does not start a paid job when the room changed during account preflight', async () => {
    const band = port()
    let changed = false
    const { context } = task()
    await expect(
      prepareBandWithPreflight(band, 'song', {
        ...context,
        assertCurrent: () => {
          if (changed) throw new Error('Changed room')
        },
        checkPreflight: async () => {
          changed = true
          return null
        },
        onUpdate: vi.fn(),
      }),
    ).rejects.toThrow('Changed room')
    expect(band.prepareBand).not.toHaveBeenCalled()
  })
  it('does not start a cloud job after cancellation during preflight', async () => {
    const band = port()
    const { context, abort } = task()
    await expect(
      prepareBandWithPreflight(band, 'song', {
        ...context,
        checkPreflight: async () => {
          abort.abort()
          return null
        },
        onUpdate: vi.fn(),
      }),
    ).rejects.toThrow()
    expect(band.prepareBand).not.toHaveBeenCalled()
  })
})
