// ============================================================
// Whisper init: an unmount is not a load failure
// ============================================================
//
// `WhisperService.destroy()` rejects every pending `init()` with a sentinel
// error, on purpose: a teardown mid-init would otherwise leave the caller
// awaiting a worker that has already been terminated, holding the song's PCM
// alive until the 300s timeout finally fired.
//
// The init caller treated any rejection as a failed download, so it logged
// `console.error` and set "Whisper failed to load. Check your connection and
// try again." on a component that was already gone. A green PR Gate run shows
// that line 13 times, and a real visitor who opens the Stem Mixer and leaves
// before the model lands hits the same path.
//
// Both halves are covered: the predicate that names the sentinel, and the
// catch block that has to consult it. The predicate alone proves nothing —
// it was already possible to write a correct predicate and never call it.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { isTeardownRejection, useWhisperTranscription, } from '@/lib/useWhisperTranscription'
import { WHISPER_SERVICE_DESTROYED_MESSAGE } from '@/lib/whisper-service'

const initMock = vi.hoisted(() => ({ fn: vi.fn() }))

vi.mock('@/lib/whisper-service', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    WhisperService: class {
      onStatusChange: ((s: string) => void) | null = null
      onProgressChange: ((p: number) => void) | null = null
      init = initMock.fn
      destroy = (): void => {}
    },
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  initMock.fn.mockReset()
})

function mountController(): ReturnType<typeof useWhisperTranscription> {
  return useWhisperTranscription({
    getAudioBuffer: () => null,
    logTag: 'TestHost',
  })
}

describe('isTeardownRejection', () => {
  it('names the destroy sentinel', () => {
    expect(
      isTeardownRejection(new Error(WHISPER_SERVICE_DESTROYED_MESSAGE)),
    ).toBe(true)
  })

  it('does not swallow a real load failure', () => {
    expect(isTeardownRejection(new Error('fetch failed'))).toBe(false)
  })

  it('does not mistake a non-Error rejection for teardown', () => {
    // A bare string carrying the same text is not the sentinel: only
    // `destroy()` constructs an Error with it, and widening the check would
    // let a stray rejection silence a genuine failure.
    expect(isTeardownRejection(WHISPER_SERVICE_DESTROYED_MESSAGE)).toBe(false)
    expect(isTeardownRejection(undefined)).toBe(false)
    expect(isTeardownRejection(null)).toBe(false)
  })
})

describe('whisper init failure handling', () => {
  it('stays silent when init rejects because the service was destroyed', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    initMock.fn.mockRejectedValue(new Error(WHISPER_SERVICE_DESTROYED_MESSAGE))

    const whisper = mountController()
    whisper.initWhisper()
    await vi.waitFor(() => expect(initMock.fn).toHaveBeenCalled())
    await Promise.resolve()
    await Promise.resolve()

    expect(err).not.toHaveBeenCalled()
    expect(whisper.status()).not.toBe('error')
    expect(whisper.errorMessage()).toBeNull()
  })

  it('still reports a genuine init failure to the visitor', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    initMock.fn.mockRejectedValue(new Error('fetch failed'))

    const whisper = mountController()
    whisper.initWhisper()
    await vi.waitFor(() => expect(whisper.status()).toBe('error'))

    expect(err).toHaveBeenCalled()
    expect(whisper.errorMessage()).toContain('Whisper failed to load')
  })
})
