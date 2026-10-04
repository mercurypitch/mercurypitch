// ============================================================
// The carrier's silence: WAV and FLAC, byte by byte
// ============================================================

import { describe, expect, it } from 'vitest'
import { silenceBlob, silentFlac, silentWav } from './carrier-silence'

/** A CRC worked out a bit at a time, as FLAC's format describes it. */
function crcBitwise(
  bytes: Uint8Array,
  polynomial: number,
  width: number,
): number {
  let crc = 0
  for (const byte of bytes) {
    for (let bit = 7; bit >= 0; bit -= 1) {
      const top = ((crc >> (width - 1)) & 1) ^ ((byte >> bit) & 1)
      crc = (crc << 1) & ((1 << width) - 1)
      if (top === 1) crc ^= polynomial
    }
  }
  return crc
}

describe('the short silence', () => {
  it('is a 16-bit PCM WAV file longer than WebKit’s floor for Now Playing', () => {
    const wav = new DataView(silentWav(4, 48_000))
    const text = (at: number, length: number): string =>
      String.fromCharCode(...new Uint8Array(wav.buffer, at, length))
    const dataBytes = wav.getUint32(40, true)

    expect([text(0, 4), text(8, 4), text(12, 4), text(36, 4)]).toEqual([
      'RIFF',
      'WAVE',
      'fmt ',
      'data',
    ])
    expect(wav.getUint32(4, true)).toBe(36 + dataBytes)
    expect(wav.getUint16(20, true)).toBe(1)
    expect(wav.getUint16(22, true)).toBe(2)
    expect(wav.getUint32(24, true)).toBe(48_000)
    expect(wav.getUint16(34, true)).toBe(16)
    expect(wav.byteLength).toBe(44 + dataBytes)
    // WebKit shows an audio element as Now Playing past 0.95 s.
    expect(dataBytes / wav.getUint32(28, true)).toBe(4)
    expect(new Uint8Array(wav.buffer, 44).every((byte) => byte === 0)).toBe(
      true,
    )
  })
})

describe('the long silence', () => {
  it('is FLAC: whole frames of 4096 silent samples, each with its CRCs', () => {
    const flac = new Uint8Array(silentFlac(1, 48_000))
    const info = new DataView(flac.buffer, 8, 34)

    // "fLaC", then STREAMINFO, the last metadata block, 34 bytes.
    expect([...flac.subarray(0, 8)]).toEqual([
      0x66, 0x4c, 0x61, 0x43, 0x80, 0, 0, 34,
    ])
    expect([info.getUint16(0), info.getUint16(2)]).toEqual([4096, 4096])
    // 20 bits of rate, 3 of channels less one, 5 of bits less one.
    expect(info.getUint32(10) >>> 12).toBe(48_000)
    expect((info.getUint8(12) >> 1) & 0b111).toBe(1)
    expect(((info.getUint8(12) & 1) << 4) | (info.getUint8(13) >> 4)).toBe(15)
    // A second comes to 12 whole frames.
    expect(info.getUint32(14)).toBe(12 * 4096)

    let at = 42
    for (let n = 0; n < 12; n += 1) {
      // Sync, 4096 samples at 48 kHz, stereo, 16 bits, the frame's number.
      expect([...flac.subarray(at, at + 5)]).toEqual([
        0xff,
        0xf8,
        0xca,
        0x18,
        n,
      ])
      expect(flac[at + 5]).toBe(crcBitwise(flac.subarray(at, at + 5), 0x07, 8))
      // Two CONSTANT subframes of 0.
      expect([...flac.subarray(at + 6, at + 12)]).toEqual([0, 0, 0, 0, 0, 0])
      expect((flac[at + 12]! << 8) | flac[at + 13]!).toBe(
        crcBitwise(flac.subarray(at, at + 12), 0x8005, 16),
      )
      at += 14
    }
    expect(at).toBe(flac.length)
  })

  it('numbers an hour’s frames the way UTF-8 codes a character', () => {
    const flac = new Uint8Array(silentFlac(3600, 48_000))

    // 42 188 frames: 128 numbered in one byte, 1920 in two, the rest in three.
    expect(flac.length).toBe(42 + 128 * 14 + 1920 * 15 + 40_140 * 16)
    const frame128 = 42 + 128 * 14
    expect([...flac.subarray(frame128 + 4, frame128 + 6)]).toEqual([0xc2, 0x80])
    const frame2048 = 42 + 128 * 14 + 1920 * 15
    expect([...flac.subarray(frame2048 + 4, frame2048 + 7)]).toEqual([
      0xe0, 0xa0, 0x80,
    ])
  })
})

describe('the silence a carrier is given', () => {
  it('is FLAC when long and WAV when short', () => {
    expect(silenceBlob('long').type).toBe('audio/flac')
    expect(silenceBlob('short').type).toBe('audio/wav')
  })
})
