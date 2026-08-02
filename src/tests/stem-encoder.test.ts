// The encoder's job is to turn a 100-400 MB WAV into something a peer can
// actually receive. These pin the decisions around it -- the sample-rate
// choice and the wasm fallback -- rather than the codec itself, which is
// mediabunny's problem and not ours.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeRateFor, ensureAacEncoder, resetStemEncoderProbe, STEM_BITRATE, } from '@/lib/jam/stem-encoder'

const canEncodeAudio = vi.hoisted(() => vi.fn())
const registerAacEncoder = vi.hoisted(() => vi.fn())

// Only canEncodeAudio matters here; the rest are stubbed so the module
// imports. The encode path itself is mediabunny's to test, and is verified
// end-to-end in a real browser rather than against a mock that would only
// ever confirm the mock.
vi.mock('mediabunny', () => ({
  canEncodeAudio,
  AudioBufferSource: function () {},
  BufferTarget: function () {},
  Mp4OutputFormat: function () {},
  Output: function () {},
}))
vi.mock('@mediabunny/aac-encoder', () => ({ registerAacEncoder }))

describe('encodeRateFor', () => {
  it('keeps a rate AAC can carry, so 44.1k material is not resampled', () => {
    expect(encodeRateFor(44100)).toBe(44100)
    expect(encodeRateFor(48000)).toBe(48000)
  })

  it('falls back for a rate AAC does not carry', () => {
    // decodeAudioData resamples to the context rate either way; this just
    // picks a sane one rather than an exotic one.
    expect(encodeRateFor(96000)).toBe(48000)
    expect(encodeRateFor(undefined)).toBe(48000)
  })
})

describe('ensureAacEncoder', () => {
  beforeEach(() => {
    resetStemEncoderProbe()
    canEncodeAudio.mockReset()
    registerAacEncoder.mockReset()
  })

  it('uses the native encoder where the platform has one', async () => {
    canEncodeAudio.mockResolvedValue(true)
    expect(await ensureAacEncoder()).toBe(true)
    // The wasm fallback must not be pulled in on a machine that can do it
    // in hardware -- that is the whole point of loading it dynamically.
    expect(registerAacEncoder).not.toHaveBeenCalled()
  })

  it('registers the wasm fallback on Firefox and Linux, where AAC is missing', async () => {
    // WebCodecs AAC encoding is absent in Firefox everywhere, and in every
    // browser on desktop Linux. Without this path the feature is dead on
    // the development machine.
    canEncodeAudio.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    expect(await ensureAacEncoder()).toBe(true)
    expect(registerAacEncoder).toHaveBeenCalledOnce()
  })

  it('reports failure rather than throwing when neither path works', async () => {
    canEncodeAudio.mockResolvedValue(false)
    expect(await ensureAacEncoder()).toBe(false)
  })

  it('survives the fallback import failing', async () => {
    canEncodeAudio.mockResolvedValueOnce(false)
    registerAacEncoder.mockImplementation(() => {
      throw new Error('wasm blocked')
    })
    expect(await ensureAacEncoder()).toBe(false)
  })

  it('probes once and reuses the answer', async () => {
    canEncodeAudio.mockResolvedValue(true)
    await ensureAacEncoder()
    await ensureAacEncoder()
    // Re-registering the fallback twice is the bug this guards against.
    expect(canEncodeAudio).toHaveBeenCalledOnce()
  })
})

describe('STEM_BITRATE', () => {
  it('is the 128k the transfer estimates are sized around', () => {
    // 128 kbps x 240 s = 3.8 MB a stem, 7.6 MB for both -- the numbers in
    // docs/plans/jam-song-p2p-transfer.md depend on this constant.
    expect(STEM_BITRATE).toBe(128_000)
  })
})
