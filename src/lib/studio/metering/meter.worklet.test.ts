// Studio meter worklet restart tests — a seek heard at a frame starts the master's windows and holds, and the lanes' peaks, again there.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioMeterSnapshot } from './stream-meter'

type Processor = new (options: {
  numberOfInputs?: number
  processorOptions: { startAtTime: number; measurement?: number }
}) => { process(inputs: Float32Array[][]): boolean }

/** Load the worklet with a fake audio thread; `messages` collects what it posts. */
async function loadWorklet(name: string) {
  const messages: unknown[] = []
  const port = {
    onmessage: null as ((event: { data: unknown }) => void) | null,
    postMessage: (value: unknown) =>
      messages.push(
        typeof value === 'object' && value !== null && 'peaks' in value
          ? { ...value, peaks: [...(value.peaks as Float32Array)] }
          : value,
      ),
  }
  let loaded!: Processor
  vi.stubGlobal('sampleRate', 48000)
  vi.stubGlobal('currentFrame', 0)
  vi.stubGlobal(
    'AudioWorkletProcessor',
    class {
      port = port
    },
  )
  vi.stubGlobal('registerProcessor', (named: string, processor: Processor) => {
    if (named === name) loaded = processor
  })
  vi.resetModules()
  await import('./meter.worklet')
  const send = (data: unknown) => port.onmessage?.({ data })
  return { Processor: loaded, messages, send }
}

/** A 997 Hz tone quantum at `amplitude`, with an optional spike at its eighth frame. */
function quantum(frame: number, amplitude: number, spike = 0): Float32Array {
  return Float32Array.from({ length: 128 }, (_, index) =>
    index === 7 && spike
      ? spike
      : Math.sin(((frame + index) * 997 * Math.PI * 2) / 48000) * amplitude,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('Studio meter worklet restart', () => {
  it('starts the loudness windows, peaks and holds again from the frame a seek is heard', async () => {
    const { Processor, messages, send } = await loadWorklet('studio-meter')
    const meter = new Processor({ processorOptions: { startAtTime: 0 } })
    // Heard from 1.2 s: frame 57600.
    send({ restartAt: 1.2 })
    let restartedAt = -1
    for (let frame = 0; frame < 48000 * 2; frame += 128) {
      vi.stubGlobal('currentFrame', frame)
      const loud = frame < 57600
      const channel = loud
        ? quantum(frame, 0.5, frame === 4864 ? 0.9 : 0)
        : quantum(frame, 0.05)
      meter.process([[channel, channel]])
      if (!loud && restartedAt < 0) restartedAt = messages.length
    }
    const snapshots = messages as StudioMeterSnapshot[]
    const before = snapshots[restartedAt - 1]
    expect(before.holdL).toBeCloseTo(0.9, 6)
    expect(before.momentaryLufs).toBeGreaterThan(-15)
    // The first reading after it holds only the new place.
    const [first] = snapshots.slice(restartedAt)
    expect(first.holdL).toBeCloseTo(0.05, 2)
    expect(first.momentaryLufs).toBeNull()
    expect(first.shortTermLufs).toBeNull()
    // 400 ms on, the momentary window is full of the new place only.
    const settled = snapshots.at(-1)!
    expect(settled.holdL).toBeCloseTo(0.05, 2)
    expect(settled.momentaryLufs).toBeLessThan(before.momentaryLufs! - 15)
  })

  it("drops every lane's peaks from before the frame a seek is heard", async () => {
    const { Processor, messages, send } = await loadWorklet('studio-lane-meter')
    const lanes = new Processor({
      numberOfInputs: 1,
      processorOptions: { startAtTime: 0 },
    })
    // Heard from frame 960, inside the eighth quantum: its spike at 903 comes first.
    send({ restartAt: 0.02 })
    for (let frame = 0; frame < 1664 + 128; frame += 128) {
      vi.stubGlobal('currentFrame', frame)
      const spike = frame < 960 ? 0.9 : 0.2
      lanes.process([[quantum(frame, 0, spike), quantum(frame, 0, spike)]])
    }
    expect(messages).toEqual([
      { measurement: 0, peaks: [expect.closeTo(0.2, 6)] },
    ])
  })

  it('names the measurement each lane message belongs to, so the page can drop one sent before a restart is heard', async () => {
    const { Processor, messages, send } = await loadWorklet('studio-lane-meter')
    const lanes = new Processor({
      numberOfInputs: 1,
      processorOptions: { startAtTime: 0, measurement: 4 },
    })
    const play = (from: number, to: number) => {
      for (let frame = from; frame < to; frame += 128) {
        vi.stubGlobal('currentFrame', frame)
        const spike = frame < 2112 ? 0.9 : 0.2
        lanes.process([[quantum(frame, 0, spike), quantum(frame, 0, spike)]])
      }
    }
    // The first message, from the place playing before the seek.
    play(0, 1664)
    // The seek is heard from frame 2112; until then the old place plays on.
    send({ restartAt: 2112 / 48000, measurement: 5 })
    play(1664, 3328)
    expect(messages).toEqual([
      { measurement: 4, peaks: [expect.closeTo(0.9, 6)] },
      { measurement: 5, peaks: [expect.closeTo(0.2, 6)] },
    ])
  })
})
