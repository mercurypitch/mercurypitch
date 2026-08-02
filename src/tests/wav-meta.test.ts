// ============================================================
// wavDurationSeconds — header-only WAV duration
// ============================================================

import { describe, expect, it } from 'vitest'
import { wavDurationSeconds, wavSampleRate } from '@/lib/wav-meta'

/** Minimal RIFF/WAVE header: fmt (16 bytes) + data chunk header. */
const wavHeader = (
  byteRate: number,
  dataBytes: number,
  sampleRate = 44100,
): ArrayBuffer => {
  const buf = new ArrayBuffer(44)
  const view = new DataView(buf)
  const write = (off: number, text: string) => {
    for (let i = 0; i < text.length; i++)
      view.setUint8(off + i, text.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 2, true) // stereo
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, 4, true) // block align
  view.setUint16(34, 16, true) // bits
  write(36, 'data')
  view.setUint32(40, dataBytes, true)
  return buf
}

describe('wavDurationSeconds', () => {
  it('computes duration from byteRate and data size', () => {
    // 44.1 kHz 16-bit stereo = 176400 B/s; 30 s of audio.
    expect(wavDurationSeconds(wavHeader(176400, 176400 * 30))).toBeCloseTo(30)
  })

  it('falls back to the file size for streamed placeholder lengths', () => {
    const total = 44 + 176400 * 10
    expect(
      wavDurationSeconds(wavHeader(176400, 0xffffffff), total),
    ).toBeCloseTo(10)
    expect(wavDurationSeconds(wavHeader(176400, 0), total)).toBeCloseTo(10)
  })

  it('returns undefined for non-WAV bytes and zero byteRate', () => {
    expect(wavDurationSeconds(new ArrayBuffer(64))).toBeUndefined()
    expect(
      wavDurationSeconds(new TextEncoder().encode('OggS0000000000').buffer),
    ).toBeUndefined()
    expect(wavDurationSeconds(wavHeader(0, 176400))).toBeUndefined()
  })

  it('survives a truncated header slice', () => {
    expect(
      wavDurationSeconds(wavHeader(176400, 176400).slice(0, 20)),
    ).toBeUndefined()
  })
})

// ── wavSampleRate ──────────────────────────────────────────────────
// Read before decoding, because decodeAudioData resamples to whatever
// rate its context runs at -- so re-encoding without knowing the source
// rate quietly converts 44.1k material to 48k for nothing.

describe('wavSampleRate', () => {
  it('reads the rate off the fmt chunk', () => {
    expect(wavSampleRate(wavHeader(176400, 1000, 44100))).toBe(44100)
    expect(wavSampleRate(wavHeader(192000, 1000, 48000))).toBe(48000)
  })

  it('is undefined for something that is not a WAV', () => {
    expect(wavSampleRate(new ArrayBuffer(64))).toBeUndefined()
  })

  it('is undefined for a truncated header rather than guessing', () => {
    expect(wavSampleRate(wavHeader(176400, 1000).slice(0, 16))).toBeUndefined()
  })

  it('is undefined for a zero rate, which would be a division trap later', () => {
    expect(wavSampleRate(wavHeader(176400, 1000, 0))).toBeUndefined()
  })
})
