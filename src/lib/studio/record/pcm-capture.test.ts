// Studio PCM capture — a take starts and stops on exact clock frames, keeps sample i on frame start + i through hiccups, and stops cleanly for every reason.
import { describe, expect, it } from 'vitest'
import type { StudioCaptureMessage } from './pcm-capture'
import { createStudioPcmCapture, STUDIO_LEVEL_FRAMES, STUDIO_MAX_CLOCK_GAP_FRAMES, STUDIO_SILENT_INPUT_FRAMES, } from './pcm-capture'

const QUANTUM = 128

/** A capture fed quanta whose samples are their own clock frame numbers. */
function harness(pool = 16, chunk = 1024) {
  const messages: StudioCaptureMessage[] = []
  const transfers: Transferable[][] = []
  const capture = createStudioPcmCapture((message, transfer = []) => {
    messages.push(message)
    transfers.push(transfer)
  })
  for (let i = 0; i < pool; i++)
    capture.command({ type: 'buffer', buffer: new ArrayBuffer(chunk * 4) })
  let clock = 0
  const ramp = (from: number) =>
    Float32Array.from({ length: QUANTUM }, (_, i) => from + i)
  return {
    capture,
    messages,
    transfers,
    get clock() {
      return clock
    },
    /** Run `quanta` render quanta; `input` may leave a quantum without input. */
    run(quanta: number, input?: (frame: number) => Float32Array | undefined) {
      for (let q = 0; q < quanta; q++) {
        capture.process(input ? input(clock) : ramp(clock), clock)
        clock += QUANTUM
      }
    },
    jump(frames: number) {
      clock += frames
    },
    ofType<T extends StudioCaptureMessage['type']>(type: T) {
      return messages.filter(
        (message): message is Extract<StudioCaptureMessage, { type: T }> =>
          message.type === type,
      )
    },
    /** Every captured sample, in order. */
    samples(): number[] {
      const out: number[] = []
      for (const message of messages)
        if (message.type === 'pcm')
          out.push(
            ...new Float32Array(message.buffer).subarray(0, message.frames),
          )
      return out
    },
  }
}

const range = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => from + i)

describe('createStudioPcmCapture', () => {
  it('meters the input while armed, before any take', () => {
    const h = harness()
    h.run(STUDIO_LEVEL_FRAMES / QUANTUM, () =>
      new Float32Array(QUANTUM).fill(-0.5),
    )

    expect(h.messages).toEqual([
      { type: 'level', peak: 0.5, frame: STUDIO_LEVEL_FRAMES },
    ])
  })

  it('starts and stops on exact clock frames inside a quantum', () => {
    const h = harness()
    h.capture.command({ type: 'start', atFrame: 200, maxFrames: 48000 })
    h.capture.command({ type: 'stop', atFrame: 5200, reason: 'stopped' })

    h.run(60)

    expect(h.ofType('started')).toEqual([{ type: 'started', frame: 200 }])
    expect(h.samples()).toEqual(range(200, 5000))
    expect(h.ofType('stopped')).toEqual([
      { type: 'stopped', frames: 5000, reason: 'stopped' },
    ])
  })

  it('hands every full buffer back transferred, numbered and placed', () => {
    const h = harness(16, 1024)
    h.capture.command({ type: 'start', atFrame: 0, maxFrames: 48000 })
    h.run(24)
    h.capture.command({ type: 'stop', atFrame: null, reason: 'stopped' })

    const pcm = h.ofType('pcm')
    expect(pcm.map((m) => [m.sequence, m.firstFrame, m.frames])).toEqual([
      [0, 0, 1024],
      [1, 1024, 1024],
      [2, 2048, 1024],
    ])
    const at = h.messages.indexOf(pcm[1])
    expect(h.transfers[at]).toEqual([pcm[1].buffer])
  })

  it('begins at once when the start frame has already gone by', () => {
    const h = harness()
    h.run(10)
    h.capture.command({ type: 'start', atFrame: 300, maxFrames: 48000 })

    h.run(2)
    h.capture.command({ type: 'stop', atFrame: null, reason: 'stopped' })

    expect(h.ofType('started')).toEqual([{ type: 'started', frame: 1280 }])
    expect(h.samples()).toEqual(range(1280, 256))
  })

  it('reports a take cancelled before its first frame as empty', () => {
    const h = harness()
    h.capture.command({ type: 'start', atFrame: 48000, maxFrames: 48000 })
    h.run(4)

    h.capture.command({ type: 'stop', atFrame: null, reason: 'cancelled' })
    h.run(400)

    expect(h.ofType('started')).toEqual([])
    expect(h.ofType('pcm')).toEqual([])
    expect(h.ofType('stopped')).toEqual([
      { type: 'stopped', frames: 0, reason: 'cancelled' },
    ])
  })

  it('stops at the frame limit with every frame before it kept', () => {
    const h = harness()
    h.capture.command({ type: 'start', atFrame: 0, maxFrames: 1000 })

    h.run(20)

    expect(h.samples()).toEqual(range(0, 1000))
    expect(h.ofType('stopped')).toEqual([
      { type: 'stopped', frames: 1000, reason: 'limit' },
    ])
  })

  it('stops when the main thread never hands buffers back, keeping the pool', () => {
    const h = harness(2, 512)
    h.capture.command({ type: 'start', atFrame: 0, maxFrames: 48000 })

    h.run(20)

    expect(h.samples()).toEqual(range(0, 1024))
    expect(h.ofType('stopped')).toEqual([
      { type: 'stopped', frames: 1024, reason: 'fell-behind' },
    ])
  })

  it('writes a quantum without input as silence, so later samples stay on their frames', () => {
    const h = harness()
    h.capture.command({ type: 'start', atFrame: 0, maxFrames: 48000 })
    h.run(2)
    h.run(3, () => undefined)
    h.run(2)
    h.capture.command({ type: 'stop', atFrame: null, reason: 'stopped' })

    const samples = h.samples()
    expect(samples).toHaveLength(7 * QUANTUM)
    expect(samples.slice(2 * QUANTUM, 5 * QUANTUM)).toEqual(
      new Array(3 * QUANTUM).fill(0),
    )
    expect(samples.slice(5 * QUANTUM)).toEqual(range(5 * QUANTUM, 2 * QUANTUM))
  })

  it('ends the take when the input stays missing for half a second', () => {
    const h = harness(64, 4096)
    h.capture.command({ type: 'start', atFrame: 0, maxFrames: 480000 })
    h.run(4)

    h.run(STUDIO_SILENT_INPUT_FRAMES / QUANTUM + 4, () => undefined)

    const [stopped] = h.ofType('stopped')
    expect(stopped.reason).toBe('input-lost')
    // The 188th missing quantum crosses half a second; the 187 before it stay as silence.
    expect(STUDIO_SILENT_INPUT_FRAMES / QUANTUM).toBe(187.5)
    expect(stopped.frames).toBe(4 * QUANTUM + 187 * QUANTUM)
  })

  it('fills a short skip of the clock with silence and stops on a long one', () => {
    const h = harness(64, 4096)
    h.capture.command({ type: 'start', atFrame: 0, maxFrames: 480000 })
    h.run(2)
    h.jump(256)
    h.run(1)
    h.capture.command({ type: 'stop', atFrame: null, reason: 'stopped' })

    const all = h.samples()
    expect(all.slice(0, 256)).toEqual(range(0, 256))
    expect(all.slice(256, 512)).toEqual(new Array(256).fill(0))
    expect(all.slice(512)).toEqual(range(512, QUANTUM))

    const long = harness(64, 4096)
    long.capture.command({ type: 'start', atFrame: 0, maxFrames: 480000 })
    long.run(2)
    long.jump(STUDIO_MAX_CLOCK_GAP_FRAMES + QUANTUM)
    long.run(1)
    expect(long.ofType('stopped')).toEqual([
      { type: 'stopped', frames: 256, reason: 'interrupted' },
    ])
  })

  it('keeps a quantum handed the clock frame of the one before as the next quantum', () => {
    // Chromium measured 2026-11-01: now and then process() reads the
    // previous quantum's currentFrame (385792 twice), then the right one.
    const h = harness(64, 4096)
    h.capture.command({ type: 'start', atFrame: 0, maxFrames: 480000 })
    h.run(2)
    h.capture.process(
      Float32Array.from({ length: QUANTUM }, (_, i) => 256 + i),
      QUANTUM,
    )
    h.jump(QUANTUM)
    h.run(2)
    h.capture.command({ type: 'stop', atFrame: null, reason: 'stopped' })

    expect(h.ofType('stopped')).toEqual([
      { type: 'stopped', frames: 5 * QUANTUM, reason: 'stopped' },
    ])
    expect(h.samples()).toEqual(range(0, 5 * QUANTUM))
  })

  it('ends the take when the clock runs backwards past a few quanta', () => {
    const h = harness(64, 4096)
    h.capture.command({ type: 'start', atFrame: 0, maxFrames: 480000 })
    h.run(8)
    h.jump(-8 * QUANTUM)
    h.run(1)

    expect(h.ofType('stopped')).toEqual([
      { type: 'stopped', frames: 8 * QUANTUM, reason: 'interrupted' },
    ])
  })

  it('stops inside a skipped stretch when the stop frame falls in it', () => {
    const h = harness()
    h.capture.command({ type: 'start', atFrame: 0, maxFrames: 48000 })
    h.capture.command({ type: 'stop', atFrame: 300, reason: 'stopped' })
    h.run(2)
    h.jump(256)
    h.run(1)

    expect(h.samples()).toEqual([...range(0, 256), ...new Array(44).fill(0)])
    expect(h.ofType('stopped')[0].frames).toBe(300)
  })

  it('takes one start and one stop: a finished capture ignores the rest', () => {
    const h = harness()
    h.capture.command({ type: 'start', atFrame: 0, maxFrames: 48000 })
    h.capture.command({ type: 'start', atFrame: 640, maxFrames: 48000 })
    h.run(2)
    h.capture.command({ type: 'stop', atFrame: null, reason: 'stopped' })
    h.capture.command({ type: 'stop', atFrame: null, reason: 'cancelled' })
    h.capture.command({ type: 'start', atFrame: 0, maxFrames: 48000 })
    h.run(2)

    expect(h.ofType('started')).toEqual([{ type: 'started', frame: 0 }])
    expect(h.ofType('stopped')).toHaveLength(1)
    expect(h.samples()).toEqual(range(0, 256))
  })

  it('stops at once for a stop frame before a pending start', () => {
    const h = harness()
    h.capture.command({ type: 'start', atFrame: 48000, maxFrames: 48000 })
    h.capture.command({ type: 'stop', atFrame: 24000, reason: 'stopped' })
    h.run(400)

    expect(h.ofType('started')).toEqual([])
    expect(h.ofType('stopped')).toEqual([
      { type: 'stopped', frames: 0, reason: 'stopped' },
    ])
  })

  it('ignores a stop before any start', () => {
    const h = harness()
    h.capture.command({ type: 'stop', atFrame: null, reason: 'stopped' })
    h.run(2)

    expect(h.ofType('stopped')).toEqual([])
  })
})
