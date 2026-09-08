// Rolling model tests exercise source clocks, independent voices, bounded history and overload without hardware.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BasicPitchPrediction } from './basic-pitch-inference'
import { BASIC_PITCH } from './basic-pitch-inference'
import { createBasicPitchLive } from './basic-pitch-live'

const rate = BASIC_PITCH.sampleRate

function output(start: number): BasicPitchPrediction {
  const notes = new Float32Array(172 * 88)
  const onsets = new Float32Array(notes.length)
  for (let frame = 0; frame < 172; frame++) {
    const globalFrame = start + frame * 256
    for (const midi of [40, 47, 52]) {
      if (globalFrame >= 2560 && globalFrame < rate * 3.5)
        notes[frame * 88 + midi - 21] = 0.8
      if (globalFrame === 2560) onsets[frame * 88 + midi - 21] = 0.9
    }
  }
  return { notes, onsets }
}
const predict = (samples: Float32Array) =>
  Promise.resolve(output(samples.at(-1)! - samples.length + 1))

function feed(
  stream: ReturnType<typeof createBasicPitchLive>,
  first: number,
  end: number,
) {
  for (let frame = first; frame < end; frame += 4096) {
    const pcm = Float32Array.from(
      { length: Math.min(4096, end - frame) },
      (_, index) => frame + index,
    )
    stream.append(frame, pcm)
  }
}
afterEach(() => vi.restoreAllMocks())

describe('bounded live chord inference', () => {
  it('keeps simultaneous pitches and one onset across overlapping windows, then ages history out', async () => {
    const stream = createBasicPitchLive(rate, predict)
    let total = 0
    let result
    for (let seconds = 0.6; seconds < 3.2; seconds += 0.4) {
      const end = Math.floor(seconds * rate)
      feed(stream, total, end)
      total = end
      result = await stream.analyse()
      expect(result?.notes.map((note) => note.midi)).toEqual([40, 47, 52])
      expect(
        result?.notes.every((note) => note.startSeconds === 2560 / rate),
      ).toBe(true)
      expect(result!.analysedSeconds).toBeLessThan(total / rate)
      expect(total / rate - result!.analysedSeconds).toBeLessThan(0.21)
    }
    for (let seconds = 3.6; seconds < 12; seconds += 0.4) {
      const end = Math.floor(seconds * rate)
      feed(stream, total, end)
      total = end
      result = await stream.analyse()
    }
    expect(result?.notes).toEqual([])
  })

  it('does not queue a second inference and skips directly to the newest window', async () => {
    const pending = Promise.withResolvers<BasicPitchPrediction>()
    const model = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockImplementation(predict)
    const stream = createBasicPitchLive(rate, model)
    feed(stream, 0, 16000)
    const first = stream.analyse()
    feed(stream, 16000, 24000)
    expect(await stream.analyse()).toBeNull()
    expect(model).toHaveBeenCalledTimes(1)
    pending.resolve(
      output(model.mock.calls[0][0].at(-1) - BASIC_PITCH.windowSamples + 1),
    )
    await first
    const result = await stream.analyse()
    expect(model).toHaveBeenCalledTimes(2)
    expect(result!.analysedSeconds).toBeGreaterThan(0.8)
    expect(await stream.analyse()).toBeNull()
  })

  it('refuses discontinuous PCM and stale inference instead of silently inventing timing', async () => {
    const stream = createBasicPitchLive(rate, predict)
    expect(() => stream.append(2, new Float32Array(128))).toThrow('interrupted')
    expect(() => stream.append(0, new Float32Array([NaN]))).toThrow('invalid')
    feed(stream, 0, 16000)
    await stream.analyse()
    feed(stream, 16000, rate * 4)
    await expect(stream.analyse()).rejects.toThrow('fell behind')
  })

  it('pauses after sustained slow work and rejects invalid model values', async () => {
    let clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    const stream = createBasicPitchLive(rate, async (samples) => {
      clock += 510
      return predict(samples)
    })
    feed(stream, 0, 16000)
    await stream.analyse()
    feed(stream, 16000, 25000)
    await stream.analyse()
    feed(stream, 25000, 34000)
    await expect(stream.analyse()).rejects.toThrow('too slow')
    const invalid = createBasicPitchLive(rate, async () => ({
      notes: new Float32Array(1),
      onsets: new Float32Array(1),
    }))
    feed(invalid, 0, 16000)
    await expect(invalid.analyse()).rejects.toThrow('model output')
  })

  it.each([8000, 44100, 48000, 192000])(
    'resamples %i Hz with finite zero padding and a fixed model input',
    async (sampleRate) => {
      const model = vi.fn(async (samples: Float32Array) => {
        expect(samples).toHaveLength(BASIC_PITCH.windowSamples)
        expect(samples.every(Number.isFinite)).toBe(true)
        return output(-100000)
      })
      const stream = createBasicPitchLive(sampleRate, model)
      feed(stream, 0, Math.ceil(sampleRate * 0.7))
      await stream.analyse()
      expect(model).toHaveBeenCalledOnce()
    },
  )
})
