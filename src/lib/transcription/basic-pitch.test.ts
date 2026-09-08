// Polyphonic candidate tests exercise independent voices and the real windowing/decoding seam.
import { describe, expect, it, vi } from 'vitest'
import { createBasicPitchDecoder } from './basic-pitch-decoder'
import { BASIC_PITCH, transcribeBasicPitch } from './basic-pitch-inference'

function row(values: Record<number, number> = {}) {
  const result = new Float32Array(88)
  for (const [midi, value] of Object.entries(values))
    result[Number(midi) - 21] = value
  return result
}

describe('polyphonic note decoder', () => {
  it('retains simultaneous notes with separate releases and actual confidence', () => {
    const decoder = createBasicPitchDecoder({
      onsetThreshold: 0.5,
      frameThreshold: 0.3,
      minDurationSeconds: 0.1,
      gapFrames: 2,
      frameStartThreshold: null,
    })
    for (let i = 0; i < 70; i++) {
      decoder.push(
        i / 100,
        row({
          40: i >= 10 && i < 60 ? 0.8 : 0,
          47: i >= 10 && i < 40 ? 0.6 : 0,
        }),
        row(i === 10 ? { 40: 0.9, 47: 0.8 } : {}),
      )
    }
    expect(decoder.finish(0.7)).toEqual([
      {
        midi: 40,
        startSeconds: 0.1,
        endSeconds: 0.6,
        confidence: expect.closeTo(0.8, 5),
      },
      {
        midi: 47,
        startSeconds: 0.1,
        endSeconds: 0.4,
        confidence: expect.closeTo(0.6, 5),
      },
    ])
  })

  it('separates repeated attacks without creating a note for each sustain frame', () => {
    const decoder = createBasicPitchDecoder({ minDurationSeconds: 0.1 })
    for (let i = 0; i < 80; i++)
      decoder.push(
        i / 100,
        row({ 52: 0.8 }),
        row([0, 30, 50].includes(i) ? { 52: 0.9 } : {}),
      )
    const notes = decoder.finish(0.8)
    expect(notes.map((n) => [n.midi, n.startSeconds, n.endSeconds])).toEqual([
      [52, 0, 0.3],
      [52, 0.3, 0.5],
      [52, 0.5, 0.8],
    ])
  })

  it('bridges bounded dropouts, rejects short/harmonic weak blips and does not invent a chord', () => {
    const decoder = createBasicPitchDecoder({
      gapFrames: 3,
      minDurationSeconds: 0.1,
    })
    for (let i = 0; i < 60; i++)
      decoder.push(
        i / 100,
        row({
          40: i >= 10 && i < 50 && i !== 25 ? 0.8 : 0,
          52: i === 15 ? 0.7 : 0,
          47: 0.1,
        }),
        row(i === 10 ? { 40: 0.9 } : i === 15 ? { 52: 0.9 } : {}),
      )
    expect(
      decoder.finish(0.6).map((n) => [n.midi, n.startSeconds, n.endSeconds]),
    ).toEqual([[40, 0.1, 0.5]])
  })

  it('makes frame-only recovery an explicit candidate choice', () => {
    const assisted = createBasicPitchDecoder({ frameStartThreshold: 0.5 })
    const onsets = createBasicPitchDecoder({ frameStartThreshold: null })
    for (let i = 0; i < 50; i++) {
      assisted.push(i / 100, row({ 64: 0.7 }), row())
      onsets.push(i / 100, row({ 64: 0.7 }), row())
    }
    expect(assisted.finish(0.5)).toHaveLength(1)
    expect(onsets.finish(0.5)).toEqual([])
  })

  it('rejects invalid settings, non-monotonic frames and reuse after finishing', () => {
    expect(() => createBasicPitchDecoder({ onsetThreshold: NaN })).toThrow(
      'thresholds',
    )
    expect(() => createBasicPitchDecoder({ gapFrames: 0 })).toThrow('gap')
    expect(() => createBasicPitchDecoder({ minDurationSeconds: 0 })).toThrow(
      'duration',
    )
    const decoder = createBasicPitchDecoder()
    decoder.push(0.1, row(), row())
    expect(() => decoder.push(0.1, row(), row())).toThrow('time')
    expect(() => decoder.finish(0)).toThrow('duration')
    expect(decoder.finish(0.2)).toEqual([])
    expect(() => decoder.push(0.3, row(), row())).toThrow('finished')
    expect(() => decoder.finish(0.4)).toThrow('finished')
  })
})

function prediction() {
  return {
    notes: new Float32Array(172 * 88),
    onsets: new Float32Array(172 * 88),
  }
}

describe('post-stop inference boundary', () => {
  it('pads and overlaps exact input samples without mutating the source', async () => {
    const samples = new Float32Array(44100)
    samples[0] = 0.4
    samples[40000] = 0.6
    const before = samples.slice()
    const windows: Float32Array[] = []
    const progress: number[] = []
    const result = await transcribeBasicPitch(
      samples,
      async (window) => {
        windows.push(window.slice())
        return prediction()
      },
      { onProgress: (value) => progress.push(value) },
    )
    expect(windows).toHaveLength(2)
    expect(windows.every((window) => window.length === 43844)).toBe(true)
    expect(windows[0][3840]).toBeCloseTo(0.4)
    expect(windows[1][40000 - 36164 + 3840]).toBeCloseTo(0.6)
    expect(windows[1].at(-1)).toBe(0)
    expect(samples.every((value, index) => value === before[index])).toBe(true)
    expect(progress).toEqual([0, 0.5, 1])
    expect(result.notes).toEqual([])
  })

  it('anchors every chunk to input time, preserving a sustain across seams and final trimming', async () => {
    let index = 0
    const duration = 4.25
    const result = await transcribeBasicPitch(
      new Float32Array(Math.floor(duration * 22050)),
      async () => {
        const output = prediction()
        for (let frame = 0; frame < 172; frame++) {
          output.notes[frame * 88 + 40 - 21] = 0.8
          if (index === 0 && frame === 15)
            output.onsets[frame * 88 + 40 - 21] = 0.9
        }
        index++
        return output
      },
    )
    expect(result.notes).toHaveLength(1)
    expect(result.notes[0]).toMatchObject({
      midi: 40,
      startSeconds: 0,
      endSeconds: Math.floor(duration * 22050) / 22050,
    })
    expect(index).toBe(3)
  })

  it('does not start inference for invalid, too long or cancelled input', async () => {
    const predict = vi.fn(async () => prediction())
    const abort = new AbortController()
    abort.abort()
    await expect(
      transcribeBasicPitch(new Float32Array(10), predict, {
        signal: abort.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    await expect(
      transcribeBasicPitch(new Float32Array([NaN]), predict),
    ).rejects.toThrow('finite')
    await expect(
      transcribeBasicPitch(
        new Float32Array(BASIC_PITCH.maxSamples + 1),
        predict,
      ),
    ).rejects.toThrow('five minutes')
    expect(predict).not.toHaveBeenCalled()
    expect(
      (await transcribeBasicPitch(new Float32Array(), predict)).notes,
    ).toEqual([])
  })

  it('bounds five-minute working windows and avoids cumulative timing drift at the tail', async () => {
    const samples = new Float32Array(BASIC_PITCH.maxSamples)
    const windows = Math.ceil(samples.length / 36164)
    const inputBuffers = new Set<ArrayBufferLike>()
    let index = 0
    const result = await transcribeBasicPitch(samples, async (input) => {
      inputBuffers.add(input.buffer)
      const output = prediction()
      for (let frame = 0; frame < 172; frame++) {
        output.notes[frame * 88 + 40 - 21] = 0.8
        if (index === 0 && frame === 15)
          output.onsets[frame * 88 + 40 - 21] = 0.9
        if (index === windows - 1) {
          output.notes[frame * 88 + 64 - 21] = 0.7
          if (frame === 15) output.onsets[frame * 88 + 64 - 21] = 0.9
        }
      }
      index++
      return output
    })
    expect(inputBuffers.size).toBe(1)
    expect(result.windows).toBe(windows)
    expect(result.notes).toEqual([
      {
        midi: 40,
        startSeconds: 0,
        endSeconds: 300,
        confidence: expect.closeTo(0.8, 5),
      },
      {
        midi: 64,
        startSeconds: ((windows - 1) * 36164) / 22050,
        endSeconds: 300,
        confidence: expect.closeTo(0.7, 5),
      },
    ])
  })

  it('drops late results after cancellation and never reports completion', async () => {
    const abort = new AbortController()
    const progress = vi.fn()
    const predict = vi.fn(async () => {
      abort.abort()
      return prediction()
    })
    await expect(
      transcribeBasicPitch(new Float32Array(44100), predict, {
        signal: abort.signal,
        onProgress: progress,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(predict).toHaveBeenCalledTimes(1)
    expect(progress).toHaveBeenCalledExactlyOnceWith(0)
  })

  it('fails on incompatible model shapes or non-finite output rather than returning a false success', async () => {
    await expect(
      transcribeBasicPitch(new Float32Array(22050), async () => ({
        notes: new Float32Array(1),
        onsets: new Float32Array(1),
      })),
    ).rejects.toThrow('shape')
    const bad = prediction()
    bad.notes[0] = NaN
    await expect(
      transcribeBasicPitch(new Float32Array(22050), async () => bad),
    ).rejects.toThrow('finite')
  })

  it('propagates inference failure without partial notes or a completed progress signal', async () => {
    const progress = vi.fn()
    let windows = 0
    await expect(
      transcribeBasicPitch(
        new Float32Array(44100),
        async () => {
          if (windows++ > 0) throw new Error('Model failed')
          return prediction()
        },
        { onProgress: progress },
      ),
    ).rejects.toThrow('Model failed')
    expect(windows).toBe(2)
    expect(progress.mock.calls.map(([value]) => value)).toEqual([0, 0.5])
  })
})
