// Studio live meter — every render quantum contributes to bounded loudness windows and peak holds.
import { createStudioMeter } from './stream-meter'

declare const sampleRate: number
declare const currentFrame: number
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(
  name: string,
  processor: typeof AudioWorkletProcessor,
): void

class StudioMeterProcessor extends AudioWorkletProcessor {
  private meter: ReturnType<typeof createStudioMeter> | null =
    createStudioMeter({ sampleRate, channels: 2 })
  private readonly startFrame: number
  private sentFrames = 0
  private numericFrames = 0
  private momentaryLufs: number | null = null
  private shortTermLufs: number | null = null
  constructor(options: { processorOptions?: { startAtTime?: number } } = {}) {
    super()
    this.startFrame = Math.round(
      (options.processorOptions?.startAtTime ?? 0) * sampleRate,
    )
    this.port.onmessage = (event: MessageEvent<string>) => {
      if (event.data === 'clear-hold') this.meter?.clearPeakHold()
      else if (event.data === 'dispose') {
        this.meter = null
        this.port.postMessage({ kind: 'disposed' })
      }
    }
  }
  process(inputs: Float32Array[][]): boolean {
    const meter = this.meter
    if (meter === null) return false
    if (inputs.length === 0) return true
    const channels = inputs[0]
    if (channels.length !== 2 || channels[0].length === 0) return true
    const from = Math.max(0, this.startFrame - currentFrame)
    if (from >= channels[0].length) return true
    meter.push(channels, from)
    this.sentFrames += channels[0].length - from
    this.numericFrames += channels[0].length - from
    if (this.sentFrames >= sampleRate / 30) {
      const snapshot = meter.snapshot(true)
      if (this.numericFrames >= sampleRate / 10) {
        this.momentaryLufs = snapshot.momentaryLufs
        this.shortTermLufs = snapshot.shortTermLufs
        this.numericFrames %= Math.round(sampleRate / 10)
      }
      this.port.postMessage({
        ...snapshot,
        momentaryLufs: this.momentaryLufs,
        shortTermLufs: this.shortTermLufs,
      })
      this.sentFrames %= Math.round(sampleRate / 30)
    }
    return true
  }
}
registerProcessor('studio-meter', StudioMeterProcessor)
