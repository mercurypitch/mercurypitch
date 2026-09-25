// The guided exercise's example waveform, read the way each platform answers.
//
// The example is a bundled mp3 (/exercises/examples/*.mp3, in the native
// asset manifest). The web and Android answer it with a 200. Capacitor's iOS
// scheme handler answers the same non-Range GET with a bare URLResponse, so
// WebKit reports `ok: false, status: 0` with the whole file -- and a reader
// that threw on `!resp.ok` never drew the waveform on iOS.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const EXAMPLE = '/exercises/examples/exercises-develop-strong.mp3'

/** Decodes anything to one short channel with a clear loudest sample. */
class FakeAudioContext {
  decodeAudioData = vi.fn(async (_bytes: ArrayBuffer) => ({
    numberOfChannels: 1,
    getChannelData: () => new Float32Array([0, 0.5, -1, 0.25]),
  }))
}

function answer(response: { ok: boolean; status: number }, bytes = 42_700) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ...response,
      arrayBuffer: async () => new ArrayBuffer(bytes),
    })),
  )
}

beforeEach(() => {
  // The cache and the shared context live at module level.
  vi.resetModules()
  vi.stubGlobal('AudioContext', FakeAudioContext)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('peaks for a bundled example', () => {
  it.each([
    ['a 200 (the web, Android)', { ok: true, status: 200 }],
    ['status 0 and the whole body (iOS, packaged)', { ok: false, status: 0 }],
  ])('draws from %s', async (_label, response) => {
    answer(response)
    const { getStemPeaks } = await import('./stem-peaks')
    const peaks = await getStemPeaks(EXAMPLE)
    expect(peaks).toHaveLength(240)
    expect(Math.max(...peaks)).toBe(1)
  })

  it('still refuses a response that really failed', async () => {
    answer({ ok: false, status: 404 })
    const { getStemPeaks } = await import('./stem-peaks')
    await expect(getStemPeaks(EXAMPLE)).rejects.toThrow(/404/)
  })

  it('refuses status 0 with nothing in it', async () => {
    answer({ ok: false, status: 0 }, 0)
    const { getStemPeaks } = await import('./stem-peaks')
    await expect(getStemPeaks(EXAMPLE)).rejects.toThrow()
  })
})
