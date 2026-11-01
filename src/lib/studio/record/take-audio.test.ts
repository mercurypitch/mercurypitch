// Studio take audio — chunks assemble in place, 16-bit values round-trip exactly, the WAV says what it holds, and live peaks follow the take.
import { describe, expect, it } from 'vitest'
import { createStudioLivePeaks, createStudioTakeBuffer, floatToPcm16, pcm16ToFloat, studioTakeWav, } from './take-audio'

/** jsdom's Blob has no arrayBuffer(); FileReader reads it. */
const bytesOf = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })

const pooled = (values: number[], size = 8) => {
  const buffer = new ArrayBuffer(size * 4)
  new Float32Array(buffer).set(values)
  return buffer
}

describe('createStudioTakeBuffer', () => {
  it('keeps only the frames of each pooled buffer and assembles them in place', () => {
    const take = createStudioTakeBuffer()
    take.append(0, 3, pooled([1, 2, 3, 99, 99]))
    take.append(3, 2, pooled([4, 5, 99]))

    expect(take.frames).toBe(5)
    expect([...take.assemble()]).toEqual([1, 2, 3, 4, 5])
  })

  it('leaves a stretch no chunk covers silent', () => {
    const take = createStudioTakeBuffer()
    take.append(0, 2, pooled([1, 2]))
    take.append(4, 1, pooled([5]))

    expect([...take.assemble()]).toEqual([1, 2, 0, 0, 5])
    take.clear()
    expect(take.frames).toBe(0)
  })
})

describe('16-bit values', () => {
  it('write as a WAV writes them, full scale both ways, clipping overs', () => {
    expect([
      ...floatToPcm16(Float32Array.from([0, 1, -1, 0.5, -0.5, 1.5, -2])),
    ]).toEqual([0, 32767, -32768, 16384, -16384, 32767, -32768])
  })

  it('come back as samples that write to the same values', () => {
    const pcm = Int16Array.from([0, 1, -1, 32767, -32768, 12345, -23456])

    expect([...floatToPcm16(pcm16ToFloat(pcm))]).toEqual([...pcm])
  })
})

describe('studioTakeWav', () => {
  it('is a mono 16-bit WAV at the capture rate', async () => {
    const wav = studioTakeWav(Float32Array.from([0, 0.5, -0.5]), 44100)
    const view = new DataView(await bytesOf(wav))

    expect(wav.type).toBe('audio/wav')
    expect(wav.size).toBe(44 + 3 * 2)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(44100)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getInt16(46, true)).toBe(16384)
  })
})

describe('createStudioLivePeaks', () => {
  it('keeps the loudest sample of every 10 ms, across chunk edges', () => {
    const live = createStudioLivePeaks(1000, 100)
    expect(live.bucketFrames).toBe(10)

    live.push(
      Float32Array.from({ length: 15 }, (_, i) => (i === 3 ? -0.8 : 0.1)),
    )
    live.push(Float32Array.from({ length: 10 }, (_, i) => (i === 2 ? 0.6 : 0)))

    expect(live.count).toBe(2)
    expect([...live.peaks.subarray(0, 2)].map((v) => +v.toFixed(3))).toEqual([
      0.8, 0.6,
    ])
  })

  it('keeps the loudness of every 10 ms beside its peak, as the saved waveform draws its body', () => {
    const live = createStudioLivePeaks(1000, 100)

    // A full-scale square wave, then a bucket at half scale split across chunks.
    live.push(Float32Array.from({ length: 10 }, (_, i) => (i % 2 ? 1 : -1)))
    live.push(new Float32Array(4).fill(0.5))
    live.push(new Float32Array(6).fill(-0.5))
    // A lone click in silence: loud peak, quiet body.
    live.push(Float32Array.from({ length: 10 }, (_, i) => (i === 0 ? 1 : 0)))

    expect(live.count).toBe(3)
    expect([...live.rms.subarray(0, 3)].map((v) => +v.toFixed(3))).toEqual([
      1,
      0.5,
      +Math.sqrt(0.1).toFixed(3),
    ])
    expect([...live.peaks.subarray(0, 3)]).toEqual([1, 0.5, 1])
  })

  it('never writes past the longest take', () => {
    const live = createStudioLivePeaks(1000, 20)
    live.push(new Float32Array(500).fill(0.25))

    expect(live.count).toBe(live.peaks.length)
  })
})
