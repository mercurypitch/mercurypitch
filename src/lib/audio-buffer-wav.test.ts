// ============================================================
// AudioBuffer WAV tests — RIFF header and mono sample integrity
// ============================================================

import { describe, expect, it } from 'vitest'
import { encodeAudioBufferToMonoPcmWav, encodeMonoPcmSamplesToWav, } from './audio-buffer-wav'

function testAudioBuffer(): AudioBuffer {
  const channels = [
    new Float32Array([1, -1, 0.5]),
    new Float32Array([0, 0, -0.5]),
  ]
  return {
    duration: 3 / 8_000,
    sampleRate: 8_000,
    length: 3,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => channels[channel]!,
  } as AudioBuffer
}

describe('encodeAudioBufferToMonoPcmWav', () => {
  it('writes a mono 16-bit PCM header and averages every input channel', () => {
    const bytes = encodeAudioBufferToMonoPcmWav(testAudioBuffer())
    const view = new DataView(bytes)
    const text = (start: number, length: number): string =>
      new TextDecoder().decode(new Uint8Array(bytes, start, length))

    expect(text(0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(42)
    expect(text(8, 4)).toBe('WAVE')
    expect(text(12, 4)).toBe('fmt ')
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(8_000)
    expect(view.getUint32(28, true)).toBe(16_000)
    expect(view.getUint16(32, true)).toBe(2)
    expect(view.getUint16(34, true)).toBe(16)
    expect(text(36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(6)
    expect(view.getInt16(44, true)).toBe(16_384)
    expect(view.getInt16(46, true)).toBe(-16_384)
    expect(view.getInt16(48, true)).toBe(0)
  })

  it('encodes only the requested frame range', () => {
    const bytes = encodeAudioBufferToMonoPcmWav(testAudioBuffer(), {
      startFrame: 1,
      endFrame: 3,
    })
    const view = new DataView(bytes)

    expect(bytes.byteLength).toBe(48)
    expect(view.getUint32(40, true)).toBe(4)
    expect(view.getInt16(44, true)).toBe(-16_384)
    expect(view.getInt16(46, true)).toBe(0)
  })
})

describe('encodeMonoPcmSamplesToWav', () => {
  it('writes an already-mono sample array without changing its frames', () => {
    const bytes = encodeMonoPcmSamplesToWav(
      new Float32Array([-1, -0.5, 0, 0.5, 1]),
      16_000,
    )
    const view = new DataView(bytes)

    expect(view.getUint32(24, true)).toBe(16_000)
    expect(view.getUint32(40, true)).toBe(10)
    expect(view.getInt16(44, true)).toBe(-32_768)
    expect(view.getInt16(46, true)).toBe(-16_384)
    expect(view.getInt16(48, true)).toBe(0)
    expect(view.getInt16(50, true)).toBe(16_384)
    expect(view.getInt16(52, true)).toBe(32_767)
  })

  it('rejects an invalid sample rate', () => {
    expect(() => encodeMonoPcmSamplesToWav(new Float32Array([0.5]), 0)).toThrow(
      'sample rate',
    )
  })
})
