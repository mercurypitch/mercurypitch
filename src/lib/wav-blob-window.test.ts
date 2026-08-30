// ============================================================
// WAV blob window tests — every sample format, byte-exact windows
// ============================================================

import { describe, expect, it } from 'vitest'
import { buildBenchWav } from '@/features/lab/stem-storage-bench'
import { parseWavBlobFormat, readWavBlobWindow } from './wav-blob-window'

interface SynthOptions {
  formatTag?: number
  channelCount?: number
  sampleRate?: number
  bitsPerSample?: 8 | 16 | 24 | 32
  frameCount?: number
  /** Insert a LIST chunk of this many bytes between fmt and data. */
  listChunkBytes?: number
  /** Write this as the data chunk's declared size instead of the truth. */
  declaredDataSize?: number
  extensible?: boolean
}

/** Deterministic raw sample for frame s, channel c, in [-1, 1). */
function sampleValue(frame: number, channel: number): number {
  return (((frame * 7 + channel * 3) % 256) - 128) / 128
}

function synthWav(options: SynthOptions = {}): {
  blob: Blob
  expected: (frame: number, channel: number) => number
} {
  const {
    formatTag = 1,
    channelCount = 2,
    sampleRate = 8000,
    bitsPerSample = 16,
    frameCount = 64,
    listChunkBytes = 0,
    extensible = false,
  } = options
  const bytesPerSample = bitsPerSample / 8
  const dataBytes = frameCount * channelCount * bytesPerSample
  const fmtSize = extensible ? 40 : 16
  const listBytes = listChunkBytes > 0 ? 8 + listChunkBytes : 0
  const total = 12 + 8 + fmtSize + listBytes + 8 + dataBytes
  const view = new DataView(new ArrayBuffer(total))
  const writeTag = (offset: number, tag: string) => {
    for (let index = 0; index < 4; index++) {
      view.setUint8(offset + index, tag.charCodeAt(index))
    }
  }

  writeTag(0, 'RIFF')
  view.setUint32(4, total - 8, true)
  writeTag(8, 'WAVE')

  let offset = 12
  writeTag(offset, 'fmt ')
  view.setUint32(offset + 4, fmtSize, true)
  view.setUint16(offset + 8, extensible ? 0xfffe : formatTag, true)
  view.setUint16(offset + 10, channelCount, true)
  view.setUint32(offset + 12, sampleRate, true)
  view.setUint32(offset + 16, sampleRate * channelCount * bytesPerSample, true)
  view.setUint16(offset + 20, channelCount * bytesPerSample, true)
  view.setUint16(offset + 22, bitsPerSample, true)
  if (extensible) {
    view.setUint16(offset + 24, 22, true) // cbSize
    view.setUint16(offset + 26, bitsPerSample, true)
    view.setUint32(offset + 28, 0b11, true)
    view.setUint16(offset + 32, formatTag, true) // SubFormat GUID head
  }
  offset += 8 + fmtSize

  if (listChunkBytes > 0) {
    writeTag(offset, 'LIST')
    view.setUint32(offset + 4, listChunkBytes, true)
    offset += 8 + listChunkBytes
  }

  writeTag(offset, 'data')
  view.setUint32(offset + 4, options.declaredDataSize ?? dataBytes, true)
  offset += 8

  // Quantize exactly the way the reader de-quantizes, so expectations are
  // bit-identical rather than approximate.
  const quantized = (raw: number): number => {
    if (formatTag === 3) return Math.fround(raw)
    if (bitsPerSample === 16) return Math.round(raw * 0x8000) / 0x8000
    if (bitsPerSample === 24) return Math.round(raw * 0x800000) / 0x800000
    if (bitsPerSample === 32) return Math.round(raw * 0x80000000) / 0x80000000
    return Math.round(raw * 128) / 128
  }

  for (let frame = 0; frame < frameCount; frame++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const raw = sampleValue(frame, channel)
      const at = offset + (frame * channelCount + channel) * bytesPerSample
      if (formatTag === 3) {
        view.setFloat32(at, raw, true)
      } else if (bitsPerSample === 16) {
        view.setInt16(at, Math.round(raw * 0x8000), true)
      } else if (bitsPerSample === 24) {
        const value = Math.round(raw * 0x800000)
        const unsigned = value < 0 ? value + 0x1000000 : value
        view.setUint8(at, unsigned & 0xff)
        view.setUint8(at + 1, (unsigned >> 8) & 0xff)
        view.setUint8(at + 2, (unsigned >> 16) & 0xff)
      } else if (bitsPerSample === 32) {
        view.setInt32(at, Math.round(raw * 0x80000000), true)
      } else {
        view.setUint8(at, Math.round(raw * 128) + 128)
      }
    }
  }

  return {
    blob: new Blob([view.buffer], { type: 'audio/wav' }),
    expected: (frame, channel) => quantized(sampleValue(frame, channel)),
  }
}

describe('parseWavBlobFormat', () => {
  it('parses plain PCM16 stereo', async () => {
    const { blob } = synthWav()
    const format = await parseWavBlobFormat(blob)
    expect(format).toMatchObject({
      formatTag: 1,
      channelCount: 2,
      sampleRate: 8000,
      bitsPerSample: 16,
      bytesPerFrame: 4,
      frameCount: 64,
    })
    expect(format?.durationSeconds).toBeCloseTo(64 / 8000)
  })

  it('parses the bench generator WAV end to end', async () => {
    const wav = buildBenchWav(64 * 1024, 3)
    const format = await parseWavBlobFormat(
      new Blob([wav], { type: 'audio/wav' }),
    )
    expect(format).toMatchObject({
      formatTag: 1,
      channelCount: 2,
      sampleRate: 44_100,
      bitsPerSample: 16,
    })
  })

  it('skips unknown chunks between fmt and data', async () => {
    const { blob } = synthWav({ listChunkBytes: 26 })
    expect((await parseWavBlobFormat(blob))?.frameCount).toBe(64)
  })

  it('resolves WAVE_FORMAT_EXTENSIBLE to its subformat', async () => {
    const pcm = synthWav({ extensible: true })
    const float = synthWav({
      extensible: true,
      formatTag: 3,
      bitsPerSample: 32,
    })
    expect((await parseWavBlobFormat(pcm.blob))?.formatTag).toBe(1)
    expect((await parseWavBlobFormat(float.blob))?.formatTag).toBe(3)
  })

  it('clamps a placeholder data size to the blob', async () => {
    const { blob } = synthWav({ declaredDataSize: 0xffffffff })
    expect((await parseWavBlobFormat(blob))?.frameCount).toBe(64)
  })

  it('rejects what it cannot window', async () => {
    expect(await parseWavBlobFormat(new Blob([new Uint8Array(64)]))).toBeNull()
    expect(
      await parseWavBlobFormat(new Blob(['ID3 not a wav at all'])),
    ).toBeNull()
    const truncated = synthWav().blob.slice(0, 20)
    expect(await parseWavBlobFormat(truncated)).toBeNull()
  })
})

describe('readWavBlobWindow', () => {
  const formats: readonly [string, SynthOptions][] = [
    ['pcm8 mono', { bitsPerSample: 8, channelCount: 1 }],
    ['pcm16 stereo', {}],
    ['pcm24 stereo', { bitsPerSample: 24 }],
    ['pcm32 stereo', { bitsPerSample: 32 }],
    ['float32 stereo', { formatTag: 3, bitsPerSample: 32 }],
  ]

  for (const [label, options] of formats) {
    it(`reads ${label} windows sample-exactly`, async () => {
      const { blob, expected } = synthWav(options)
      const format = (await parseWavBlobFormat(blob))!
      const channels = await readWavBlobWindow(blob, format, 10, 20)

      expect(channels).toHaveLength(format.channelCount)
      for (let channel = 0; channel < channels.length; channel++) {
        expect(channels[channel]).toHaveLength(20)
        for (let frame = 0; frame < 20; frame++) {
          expect(channels[channel][frame]).toBeCloseTo(
            expected(10 + frame, channel),
            6,
          )
        }
      }
    })
  }

  it('covers the whole stream when read window by window', async () => {
    const { blob, expected } = synthWav({ frameCount: 50 })
    const format = (await parseWavBlobFormat(blob))!
    const stitched: number[] = []
    for (let start = 0; start < format.frameCount; start += 16) {
      const [left] = await readWavBlobWindow(blob, format, start, 16)
      stitched.push(...left)
    }
    expect(stitched).toHaveLength(50)
    for (let frame = 0; frame < 50; frame++) {
      expect(stitched[frame]).toBeCloseTo(expected(frame, 0), 6)
    }
  })

  it('clamps a window that runs past the end', async () => {
    const { blob } = synthWav({ frameCount: 30 })
    const format = (await parseWavBlobFormat(blob))!
    const channels = await readWavBlobWindow(blob, format, 25, 100)
    expect(channels[0]).toHaveLength(5)
  })

  it('returns empty channels beyond the end', async () => {
    const { blob } = synthWav({ frameCount: 30 })
    const format = (await parseWavBlobFormat(blob))!
    const channels = await readWavBlobWindow(blob, format, 30, 16)
    expect(channels[0]).toHaveLength(0)
  })
})
