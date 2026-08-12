// The encoder's job is to turn a 100-400 MB WAV into something a peer can
// actually receive, or a phone can keep twenty of. These pin the decisions
// around it -- the quality tiers, the sample-rate choice and the wasm
// fallback -- rather than the codec itself, which is mediabunny's problem
// and not ours.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PORTABLE_TIER, encodeRateFor, ensureAacEncoder, PORTABLE_TIERS, resetStemEncoderProbe, STEM_BITRATE, } from '@/lib/portable/portable-audio'

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

describe('quality tiers', () => {
  it('defaults to the one a kept library wants', () => {
    // 192 rather than 128: this copy is played on a TV and sung along to
    // for months, and the difference is about 3.5 MB a song.
    expect(DEFAULT_PORTABLE_TIER).toBe('portable-192')
    expect(PORTABLE_TIERS[DEFAULT_PORTABLE_TIER]).toBe(192_000)
  })

  it('keeps the smaller tier available for a live transfer', () => {
    // A jam room asks for this one by name -- see jam-song-share.
    expect(PORTABLE_TIERS['portable-128']).toBe(128_000)
    expect(STEM_BITRATE).toBe(128_000)
  })

  it('names its tiers the way a manifest records them', () => {
    // SongManifest.quality is written from these keys, so a rename here
    // without one there would silently mislabel every synced song.
    expect(Object.keys(PORTABLE_TIERS).sort()).toEqual([
      'portable-128',
      'portable-192',
    ])
  })
})
