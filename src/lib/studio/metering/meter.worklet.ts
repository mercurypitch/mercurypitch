// Studio live meters — every render quantum feeds the master's loudness windows and peak holds, and each lane's peak.
import { createStudioMeter } from './stream-meter'

declare const sampleRate: number
declare const currentFrame: number
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
// Every input and output carries 128 frames a call (the Web Audio render quantum).
const QUANTUM_FRAMES = 128

/**
 * A command from the page: clear the peak holds, start measuring again, or
 * stop. A lane restart names the measurement its peaks are sent under.
 */
type MeterCommand =
  | 'clear-hold'
  | 'dispose'
  | { readonly restartAt: number; readonly measurement?: number }

/** The frame a restart message asks to measure from: when a seek is heard. */
function restartFrame(command: MeterCommand): number | null {
  return typeof command === 'object'
    ? Math.round(command.restartAt * sampleRate)
    : null
}

declare function registerProcessor(
  name: string,
  processor: typeof AudioWorkletProcessor,
): void

class StudioMeterProcessor extends AudioWorkletProcessor {
  private meter: ReturnType<typeof createStudioMeter> | null =
    createStudioMeter({ sampleRate, channels: 2 })
  private startFrame: number
  private restartAt: number | null = null
  private sentFrames = 0
  private numericFrames = 0
  private momentaryLufs: number | null = null
  private shortTermLufs: number | null = null
  constructor(options: { processorOptions?: { startAtTime?: number } } = {}) {
    super()
    this.startFrame = Math.round(
      (options.processorOptions?.startAtTime ?? 0) * sampleRate,
    )
    this.port.onmessage = (event: MessageEvent<MeterCommand>) => {
      const restart = restartFrame(event.data)
      if (restart !== null) this.restartAt = restart
      else if (event.data === 'clear-hold') this.meter?.clearPeakHold()
      else if (event.data === 'dispose') {
        this.meter = null
        this.port.postMessage({ kind: 'disposed' })
      }
    }
  }
  /**
   * A seek heard from the restart frame: the loudness windows, peaks and
   * holds start again there, as a new run's meter would.
   */
  private restartBy(end: number): void {
    if (this.restartAt === null || this.restartAt >= end) return
    this.meter?.reset()
    this.startFrame = this.restartAt
    this.restartAt = null
    this.sentFrames = 0
    this.numericFrames = 0
    this.momentaryLufs = null
    this.shortTermLufs = null
  }
  process(inputs: Float32Array[][]): boolean {
    const meter = this.meter
    if (meter === null) return false
    if (inputs.length === 0) return true
    const channels = inputs[0]
    if (channels.length !== 2 || channels[0].length === 0) return true
    this.restartBy(currentFrame + channels[0].length)
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

/** The highest absolute sample in `channel` from frame `from` on, or `peak` when that is higher. */
function channelPeak(
  channel: Float32Array,
  from: number,
  peak: number,
): number {
  let highest = peak
  for (let frame = from; frame < channel.length; frame++) {
    const level = Math.abs(channel[frame])
    if (level > highest) highest = level
  }
  return highest
}

/**
 * One input per lane: the louder channel's highest sample, sent 30 times a
 * second under the measurement it belongs to. A restart's peaks go out under
 * its own measurement from the frame it is heard, so the page can drop the
 * old place's peaks still on their way when it asked.
 */
class StudioLaneMeterProcessor extends AudioWorkletProcessor {
  private peaks: Float32Array | null
  private startFrame: number
  private restartAt: number | null = null
  private measurement: number
  private nextMeasurement: number
  private frames = 0
  constructor(
    options: {
      numberOfInputs?: number
      processorOptions?: { startAtTime?: number; measurement?: number }
    } = {},
  ) {
    super()
    this.peaks = new Float32Array(options.numberOfInputs ?? 1)
    this.startFrame = Math.round(
      (options.processorOptions?.startAtTime ?? 0) * sampleRate,
    )
    this.measurement = options.processorOptions?.measurement ?? 0
    this.nextMeasurement = this.measurement
    this.port.onmessage = (event: MessageEvent<MeterCommand>) => {
      const command = event.data
      const restart = restartFrame(command)
      if (restart !== null && typeof command === 'object') {
        this.restartAt = restart
        this.nextMeasurement = command.measurement ?? this.measurement
      }
      if (command !== 'dispose') return
      this.peaks = null
      this.port.postMessage({ kind: 'disposed' })
    }
  }
  process(inputs: Float32Array[][]): boolean {
    const peaks = this.peaks
    if (peaks === null) return false
    // A seek heard from the restart frame: peaks from before it are dropped.
    if (
      this.restartAt !== null &&
      this.restartAt < currentFrame + QUANTUM_FRAMES
    ) {
      peaks.fill(0)
      this.startFrame = this.restartAt
      this.restartAt = null
      this.measurement = this.nextMeasurement
    }
    // As the master meter: only frames from the run's start count.
    const from = Math.max(0, this.startFrame - currentFrame)
    if (from >= QUANTUM_FRAMES) return true
    const lanes = Math.min(inputs.length, peaks.length)
    for (let lane = 0; lane < lanes; lane++)
      for (const channel of inputs[lane])
        peaks[lane] = channelPeak(channel, from, peaks[lane])
    this.frames += QUANTUM_FRAMES - from
    if (this.frames >= sampleRate / 30) {
      this.port.postMessage({ measurement: this.measurement, peaks })
      peaks.fill(0)
      this.frames %= Math.round(sampleRate / 30)
    }
    return true
  }
}
registerProcessor('studio-lane-meter', StudioLaneMeterProcessor)
