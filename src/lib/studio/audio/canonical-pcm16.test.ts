// @vitest-environment node
// Canonical PCM at 16 bits — Save space's copy reads back exactly for 16-bit sources, and within half a step of the take's peak for any other.
import { describe, expect, it } from 'vitest'
import { sampledAudio } from './audio.fixture'
import type { CanonicalPcmMetadata } from './canonical-pcm'
import { canonicalPcmByteLength, decodeCanonicalPcm, encodeCanonicalPcm, sha256Bytes, } from './canonical-pcm'
import { choosePcm16Steps } from './canonical-pcm16'

/** What Chromium's decodeAudioData gives for each 16-bit WAV value (measured, every value). */
const chromiumFloat = (whole: number) =>
  Math.fround(whole * (whole < 0 ? 2 ** -15 : Math.fround(1 / 32_767)))

async function roundTrip(channels: Float32Array[]) {
  const audio = sampledAudio(channels)
  const blob = await encodeCanonicalPcm(audio, { format: 'int16' })
  const bytes = await blob.arrayBuffer()
  const metadata: CanonicalPcmMetadata = {
    channels: channels.length as 1 | 2,
    normalizedSampleRate: 48_000,
    normalizedFrameCount: channels[0].length,
    canonicalPcmByteLength: blob.size,
    canonicalPcmSha256: await sha256Bytes(bytes),
    canonicalPcmFormat: 'int16',
  }
  const decoded = await decodeCanonicalPcm(blob, metadata)
  return { blob, view: new DataView(bytes), decoded }
}

/** A song-like float signal off every 16-bit grid: two partials, a slow swell and seeded noise. */
function floatSignal(frames: number, peak: number, seed: number): Float32Array {
  let state = seed
  return Float32Array.from({ length: frames }, (_, frame) => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    const noise = (state / 2 ** 32 - 0.5) * 0.02
    const tone =
      0.6 * Math.sin((2 * Math.PI * 220.3 * frame) / 48_000) +
      0.3 * Math.sin((2 * Math.PI * 659.9 * frame) / 48_000)
    return peak * (tone + noise) * (0.5 + 0.5 * Math.sin(frame / 3000))
  })
}

describe('canonical PCM at 16 bits', () => {
  it('reads every 16-bit WAV value back exactly as Chromium decodes it, in half the float copy', async () => {
    const values = Float32Array.from({ length: 65_536 }, (_, index) =>
      chromiumFloat(index - 32_768),
    )
    const reversed = values.slice().reverse()

    const { blob, view, decoded } = await roundTrip([values, reversed])

    expect(Array.from(decoded.getChannelData(0))).toEqual(Array.from(values))
    expect(Array.from(decoded.getChannelData(1))).toEqual(Array.from(reversed))
    expect(blob.size).toBe(canonicalPcmByteLength(65_536, 2, 'int16'))
    expect(blob.size - 32).toBe(
      (canonicalPcmByteLength(65_536, 2, 'float32') - 32) / 2,
    )
    // Version 2, 16-bit steps, Chromium's two step sizes in bytes 24..31.
    expect([view.getUint16(4, true), view.getUint16(14, true)]).toEqual([2, 2])
    expect(view.getFloat32(24, true)).toBe(2 ** -15)
    expect(view.getFloat32(28, true)).toBe(Math.fround(1 / 32_767))
  })

  it('reads a symmetric 16-bit grid, as Firefox decodes a WAV, back exactly', async () => {
    const values = Float32Array.from(
      { length: 4096 },
      (_, index) => ((index * 37) % 65_535) / 32_768 - 1,
    )

    const { view, decoded } = await roundTrip([values])

    expect(Array.from(decoded.getChannelData(0))).toEqual(Array.from(values))
    expect(view.getFloat32(28, true)).toBe(2 ** -15)
  })

  it('keeps audio off every grid within half a step of its own peak, overs included', async () => {
    const left = floatSignal(96_000, 1.4, 7)
    const right = floatSignal(96_000, 0.05, 11)
    let peak = 0
    for (const value of [...left, ...right])
      peak = Math.max(peak, Math.abs(value))

    const { view, decoded } = await roundTrip([left, right])

    const step = view.getFloat32(24, true)
    expect(step).toBe(Math.fround(peak / 32_767))
    expect(view.getFloat32(28, true)).toBe(step)
    let worst = 0
    for (const [channel, source] of [left, right].entries()) {
      const read = decoded.getChannelData(channel)
      for (let frame = 0; frame < source.length; frame++)
        worst = Math.max(worst, Math.abs(read[frame] - source[frame]))
    }
    // Half a step, and the float rounding of the step itself.
    expect(worst).toBeLessThanOrEqual(step / 2 + peak * 2 ** -23)
    expect(worst).toBeGreaterThan(0)
    // 98 dB under the peak, as the setting promises.
    expect(20 * Math.log10(worst / peak)).toBeLessThan(-96)
  })

  it('keeps silence as silence', async () => {
    const { decoded } = await roundTrip([new Float32Array(100)])

    expect(decoded.getChannelData(0).every((value) => value === 0)).toBe(true)
  })

  it('refuses samples that are not finite numbers, as the float copy does', async () => {
    await expect(
      encodeCanonicalPcm(sampledAudio([[0.5, NaN]]), { format: 'int16' }),
    ).rejects.toThrow('invalid samples')
  })

  it('keeps floats for a peak no 16-bit copy can hold', async () => {
    // The largest float: 32768 of its 32767th parts are past the float range.
    const huge = Math.fround(3.4028234663852886e38)
    await expect(
      choosePcm16Steps([Float32Array.of(0.25, huge)]),
    ).resolves.toBeNull()

    const blob = await encodeCanonicalPcm(sampledAudio([[0.25, huge]]), {
      format: 'int16',
    })

    expect(blob.size).toBe(canonicalPcmByteLength(2, 1, 'float32'))
    expect(new DataView(await blob.arrayBuffer()).getUint16(4, true)).toBe(1)
  })
})
