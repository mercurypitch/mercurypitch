// Final WAV tests verify actual quantized bytes, malformed containers and cancellable analysis.
import { describe, expect, it } from 'vitest'
import { encodeAudioBufferToPcmWav } from '@/lib/audio-buffer-wav'
import { studioReservedMemoryBytes } from '../memory-budget'
import { meterTone } from '../metering/meter.test-fixtures'
import { measureStudioWav, studioWavReader } from './wav-measure'

function fixture() {
  const data = meterTone(48000, 0.5)
  const buffer = {
    numberOfChannels: 2,
    sampleRate: 48000,
    length: data.length,
    getChannelData: () => data,
  } as unknown as AudioBuffer
  return encodeAudioBufferToPcmWav(buffer)
}

describe('Studio final WAV measurement', () => {
  it('reads the signed quantized samples and measures the actual delivered stereo bytes', async () => {
    const bytes = fixture()
    const measurement = await measureStudioWav(bytes, { createWorker: null })
    expect(measurement).toMatchObject({
      frames: 24000,
      sampleRate: 48000,
      channels: 2,
      bitDepth: 16,
    })
    expect(measurement.integratedLufs).toBeCloseTo(-20, 1)
    const view = new DataView(bytes)
    view.setInt16(44, 32767, true)
    view.setInt16(46, -32768, true)
    expect(
      studioWavReader(bytes)
        .read(0, 1)
        .map((channel) => channel[0]),
    ).toEqual([32767 / 32768, -1])
    const changed = await measureStudioWav(bytes, { createWorker: null })
    expect(changed.samplePeakDb).toBe(0)
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('rejects bad headers, byte lengths and channel/depth/rate mismatches', () => {
    for (const [offset, value] of [
      [4, 7],
      [22, 1],
      [24, 44100],
      [28, 1],
      [32, 2],
      [34, 24],
      [40, 5],
    ]) {
      const bytes = fixture()
      const view = new DataView(bytes)
      if ([22, 32, 34].includes(offset)) view.setUint16(offset, value, true)
      else view.setUint32(offset, value, true)
      expect(() => studioWavReader(bytes)).toThrow('WAV')
    }
    expect(() => studioWavReader(fixture().slice(0, 100))).toThrow('WAV')
  })

  it('releases analysis admission after cancellation', async () => {
    const controller = new AbortController()
    const job = measureStudioWav(fixture(), {
      signal: controller.signal,
      createWorker: null,
    })
    controller.abort()
    await expect(job).rejects.toMatchObject({ name: 'AbortError' })
    expect(studioReservedMemoryBytes()).toBe(0)
  })
})
