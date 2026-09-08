// Real PCM decoding/resampling tests guard timing, anti-aliasing, and bounded input reads.
import { describe, expect, it, vi } from 'vitest'
import { encodeMonoPcmSamplesToWav } from '../audio-buffer-wav'
import { guitarWavHeader } from '../guitar/recording-evidence'
import { decodeGuitarRefinementAudio, GUITAR_REFINEMENT_MAX_BYTES, } from './guitar-refinement-audio'

function tone(rate: number, hz: number, seconds = 1.1) {
  return Float32Array.from(
    { length: Math.floor(rate * seconds) },
    (_, index) => 0.5 * Math.sin((2 * Math.PI * hz * index) / rate),
  )
}

function wav(samples: Float32Array, rate: number) {
  return new Blob([encodeMonoPcmSamplesToWav(samples, rate)])
}

function rms(samples: Float32Array) {
  let sum = 0
  for (const value of samples) sum += value * value
  return Math.sqrt(sum / samples.length)
}

describe('worker-only refinement audio', () => {
  it.each([22050, 44100, 48000, 96000, 192000, 8000])(
    'preserves pitch, duration, level and the one-second read seam at %i Hz',
    async (rate) => {
      const result = await decodeGuitarRefinementAudio(
        wav(tone(rate, 440), rate),
      )
      expect(result.duration).toBeCloseTo(1.1, 4)
      expect(result.samples.length).toBe(
        Math.floor((Math.floor(rate * 1.1) / rate) * 22050),
      )
      expect(rms(result.samples.subarray(500, -500))).toBeCloseTo(
        Math.SQRT1_2 * 0.5,
        3,
      )
      let maximumError = 0
      // Includes the chunk seam: no filter phase reset, missing sample or time shift.
      for (let i = 200; i < result.samples.length - 200; i++) {
        maximumError = Math.max(
          maximumError,
          Math.abs(
            result.samples[i] - 0.5 * Math.sin((2 * Math.PI * 440 * i) / 22050),
          ),
        )
      }
      expect(maximumError).toBeLessThan(0.002)
    },
  )

  it('filters above-target-Nyquist frequencies instead of aliasing them into guitar notes', async () => {
    const result = await decodeGuitarRefinementAudio(
      wav(tone(48000, 15000), 48000),
    )
    expect(rms(result.samples.subarray(500, -500))).toBeLessThan(0.0001)
  })

  it('folds stereo equally without duplicating full recording payloads', async () => {
    const frames = 48000 * 2
    const header = guitarWavHeader(frames * 2, 48000)
    const view = new DataView(header)
    view.setUint16(22, 2, true)
    view.setUint32(28, 48000 * 4, true)
    view.setUint16(32, 4, true)
    const pcm = new Int16Array(frames * 2)
    for (let i = 0; i < frames; i++) pcm[i * 2] = 16384
    const blob = new Blob([header, pcm])
    const slices = vi.spyOn(blob, 'slice')
    const progress: number[] = []
    const result = await decodeGuitarRefinementAudio(blob, (value) =>
      progress.push(value),
    )
    expect(result.samples[22050]).toBeCloseTo(0.25, 5)
    expect(progress).toEqual([0, 0.5, 1])
    expect(
      Math.max(
        ...slices.mock.calls.map(([start, end]) => (end ?? 0) - (start ?? 0)),
      ),
    ).toBeLessThan(48000 * 4 + 2048)
  })

  it('rejects oversized, unsupported and too-long audio before reading its payload', async () => {
    const large = {
      size: GUITAR_REFINEMENT_MAX_BYTES + 1,
      slice: vi.fn(),
    } as unknown as Blob
    await expect(decodeGuitarRefinementAudio(large)).rejects.toThrow('256 MiB')
    expect(large.slice).not.toHaveBeenCalled()
    await expect(
      decodeGuitarRefinementAudio(new Blob(['not WAV'])),
    ).rejects.toThrow('PCM WAV')
    const frames = 301 * 8000
    const long = new Blob([
      guitarWavHeader(frames, 8000),
      new Uint8Array(frames * 2),
    ])
    const slices = vi.spyOn(long, 'slice')
    await expect(decodeGuitarRefinementAudio(long)).rejects.toThrow(
      'five minutes',
    )
    expect(slices.mock.calls.every(([, end]) => (end ?? 0) <= 44)).toBe(true)
    await expect(
      decodeGuitarRefinementAudio(wav(tone(4000, 440), 4000)),
    ).rejects.toThrow('8–192')
  })

  it('rejects non-finite float PCM instead of silently turning corrupt audio into notes', async () => {
    const header = guitarWavHeader(8, 22050)
    const view = new DataView(header)
    view.setUint16(20, 3, true)
    view.setUint16(34, 32, true)
    view.setUint16(32, 4, true)
    view.setUint32(28, 22050 * 4, true)
    await expect(
      decodeGuitarRefinementAudio(
        new Blob([header, new Float32Array([0, NaN, 0, 0])]),
      ),
    ).rejects.toThrow('non-finite')
  })
})
