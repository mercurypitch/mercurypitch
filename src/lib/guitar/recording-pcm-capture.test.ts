// Recorder PCM ownership tests exercise the real render-thread pool and transferable detachment.
import { describe, expect, it } from 'vitest'
import { createGuitarPcmCapture } from './recording-pcm-capture'
import type { GuitarCaptureMessage } from './recording-types'
import { GUITAR_RECORDING_LIMIT_SECONDS, GUITAR_RECORDING_PCM_FRAMES, GUITAR_RECORDING_POOL_SIZE, } from './recording-types'

describe('bounded guitar PCM delivery', () => {
  it.each([false, true])(
    'preserves recorder clock reporting and optionally stops live analysis on a gap: %s',
    (stopOnClockGap) => {
      const messages: GuitarCaptureMessage[] = []
      const capture = createGuitarPcmCapture((message) =>
        messages.push(message),
      )
      capture.command({ type: 'buffer', buffer: new ArrayBuffer(8192) })
      capture.command({ type: 'start', maxFrames: 48000, stopOnClockGap })
      capture.process(new Float32Array(128), 0)
      capture.process(new Float32Array(128), 256)
      if (!stopOnClockGap) capture.command({ type: 'stop', reason: null })
      expect(messages.at(-1)).toEqual({
        type: 'stopped',
        frames: stopOnClockGap ? 128 : 256,
        clockAnomalies: 1,
        reason: stopOnClockGap ? 'The live audio clock was interrupted.' : null,
      })
    },
  )

  it('delivers every 2048 frames with the original pooled sample capacity and stops explicitly on exhaustion', () => {
    const messages: GuitarCaptureMessage[] = []
    const capture = createGuitarPcmCapture((message, transfer = []) =>
      messages.push(structuredClone(message, { transfer })),
    )
    for (let index = 0; index < GUITAR_RECORDING_POOL_SIZE; index++)
      capture.command({
        type: 'buffer',
        buffer: new ArrayBuffer(GUITAR_RECORDING_PCM_FRAMES * 4),
      })
    capture.command({
      type: 'start',
      maxFrames: 48000 * GUITAR_RECORDING_LIMIT_SECONDS,
    })
    for (let frame = 0; frame <= 65536; frame += 128)
      capture.process(new Float32Array(128).fill(frame / 65536), frame + 5000)
    const pcm = messages.filter((message) => message.type === 'pcm')
    expect(GUITAR_RECORDING_PCM_FRAMES).toBe(2048)
    expect(GUITAR_RECORDING_POOL_SIZE * GUITAR_RECORDING_PCM_FRAMES).toBe(
      8 * 8192,
    )
    expect(pcm).toHaveLength(32)
    expect(pcm.map((message) => message.firstFrame)).toEqual(
      Array.from({ length: 32 }, (_, index) => index * 2048),
    )
    expect(pcm.every((message) => message.frames === 2048)).toBe(true)
    expect(new Float32Array(pcm[31].buffer).at(-1)).toBe(65408 / 65536)
    expect(messages.at(-1)).toEqual({
      type: 'stopped',
      frames: 65536,
      clockAnomalies: 0,
      reason:
        'Saving fell behind, so recording stopped. Everything captured before that is safe.',
    })
    capture.command({ type: 'buffer', buffer: pcm[0].buffer })
    capture.process(new Float32Array(128), 70664)
    expect(
      messages.filter((message) => message.type === 'stopped'),
    ).toHaveLength(1)
  })

  it('reuses only a returned lease and flushes a short final block exactly once', () => {
    const messages: GuitarCaptureMessage[] = []
    const capture = createGuitarPcmCapture((message, transfer = []) =>
      messages.push(structuredClone(message, { transfer })),
    )
    capture.command({ type: 'buffer', buffer: new ArrayBuffer(8192) })
    capture.command({ type: 'start', maxFrames: 48000 })
    capture.process(new Float32Array(2048).fill(0.25), 0)
    const first = messages.find((message) => message.type === 'pcm')!
    const returned = structuredClone(first.buffer, { transfer: [first.buffer] })
    expect(first.buffer.byteLength).toBe(0)
    capture.command({ type: 'buffer', buffer: returned })
    capture.process(new Float32Array(128).fill(0.5), 2048)
    capture.command({ type: 'stop', reason: null })
    capture.command({ type: 'stop', reason: null })
    const pcm = messages.filter((message) => message.type === 'pcm')
    expect(pcm.map((message) => [message.firstFrame, message.frames])).toEqual([
      [0, 2048],
      [2048, 128],
    ])
    expect(new Float32Array(pcm[1].buffer).slice(0, 128)).toEqual(
      new Float32Array(128).fill(0.5),
    )
    expect(messages.at(-1)).toEqual({
      type: 'stopped',
      frames: 2176,
      clockAnomalies: 0,
      reason: null,
    })
    expect(
      messages.filter((message) => message.type === 'stopped'),
    ).toHaveLength(1)
  })
})
