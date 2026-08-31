// ============================================================
// F0 worklet — the pitch pass, on the clock the samples arrive on
// ============================================================
//
// The main thread used to poll an AnalyserNode from requestAnimationFrame and
// run YIN per tick. That works on an idle machine and fails in exactly the
// cases that matter: a busy renderer, a backgrounded tab (rAF throttles to
// ~1 Hz), several browsers sharing a core. A missed tick is not a late frame,
// it is a lost one — the analyser only ever holds the most recent 2048 samples
// — so the Pitch Centre gate would refuse a perfectly good take for having too
// few confident frames in its 1.8 s landing window. Measured on the guided
// check at eight Playwright workers on four cores: 22-96 frames per landing
// against a floor of 18, and gaps between frames of up to 921 ms against a
// ceiling of 100 ms.
//
// Here the hop is counted in render quanta, so the frame rate is a property of
// the audio clock. Every sample is seen once, the timestamps are exact
// (`currentFrame`, not `performance.now()`), and a starved main thread delays
// delivery instead of destroying evidence. Same load, same measurement, with
// this in place: 102-104 frames per landing and a 17 ms worst gap, every run.
//
// Delay still has to be paid for, though — a renderer that drains a take
// before it has received those frames throws them away just as thoroughly.
// That is what `flush` in pitch-f0-stream.ts is for.
//
// The detector itself is src/lib/pitch-yin-core.ts, shared with PitchDetector
// and tested there. This file is the thin shell that feeds it, and it must
// stay import-light: AudioWorkletGlobalScope has no DOM, no timers, and no
// network, so anything this pulls in has to be a pure leaf.

import type { PitchF0ProcessorOptions, PitchF0WorkletCommand, PitchF0WorkletFrame, } from '@/lib/pitch-f0-worklet-protocol'
import { PITCH_F0_HOP_QUANTA, PITCH_F0_PROCESSOR, } from '@/lib/pitch-f0-worklet-protocol'
import type { YinFrameAnalyser } from '@/lib/pitch-yin-core'
import { bufferRms, createYinFrameAnalyser } from '@/lib/pitch-yin-core'

declare const currentFrame: number
declare const sampleRate: number
declare function registerProcessor(
  name: string,
  processor: typeof AudioWorkletProcessorPolyfill,
): void

declare class AudioWorkletProcessorPolyfill {
  readonly port: MessagePort
  constructor(options?: AudioWorkletNodeOptions)
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean
}

declare const AudioWorkletProcessor: typeof AudioWorkletProcessorPolyfill

/** Stand-in for a render quantum the graph did not deliver. */
const SILENT_QUANTUM = new Float32Array(128)

class PitchF0Processor extends AudioWorkletProcessor {
  /** The most recent `bufferSize` samples, oldest first. */
  private readonly window: Float32Array
  private readonly analyser: YinFrameAnalyser
  private quantaSinceHop = 0
  private recording = false
  private taskId = 0
  private taskStartFrame = 0

  constructor(options?: AudioWorkletNodeOptions) {
    super(options)
    const settings = options?.processorOptions as
      | PitchF0ProcessorOptions
      | undefined
    const bufferSize = settings?.bufferSize ?? 2048
    this.window = new Float32Array(bufferSize)
    this.analyser = createYinFrameAnalyser({
      sampleRate,
      bufferSize,
      sensitivity: settings?.sensitivity ?? 7,
      minFrequency: settings?.minFrequency ?? 60,
      maxFrequency: settings?.maxFrequency ?? 1600,
      minAmplitude: settings?.minAmplitude ?? 0.005,
      minConfidence: settings?.minConfidence ?? 0.3,
    })

    this.port.onmessage = (event: MessageEvent<PitchF0WorkletCommand>) => {
      const command = event.data
      if (command?.type === 'flush') {
        // Posted from here, so it queues behind every frame already sent.
        this.port.postMessage({ type: 'flushed', id: command.id })
        return
      }
      if (command?.type !== 'record') return
      this.recording = command.on
      this.taskId = command.taskId
      if (!command.on) return
      // The take clock is kept here rather than on the main thread: only this
      // side knows which sample the take begins on, and a frame index cannot
      // drift the way a wall clock under load can.
      this.taskStartFrame =
        currentFrame - Math.round(command.startedSecondsAgo * sampleRate)
      this.analyser.reset()
    }
  }

  process(inputs: Float32Array[][]): boolean {
    // An input with no channels is one nothing is connected to yet. Advancing
    // the window with silence rather than returning early keeps the hop clock
    // running, so a take that starts before the microphone is wired in still
    // produces frames instead of nothing at all.
    const channel = inputs[0]?.[0] ?? SILENT_QUANTUM

    const size = this.window.length
    const taken = Math.min(channel.length, size)
    if (taken > 0) {
      this.window.copyWithin(0, taken)
      this.window.set(
        taken === channel.length ? channel : channel.subarray(-taken),
        size - taken,
      )
    }

    this.quantaSinceHop += 1
    if (this.quantaSinceHop < PITCH_F0_HOP_QUANTA) return true
    this.quantaSinceHop = 0

    // Every hop reports a level — the singer wants the meter to move while
    // they position the mic — but only a recording take pays for YIN.
    const frame: PitchF0WorkletFrame = this.recording
      ? this.analysedFrame(taken)
      : {
          type: 'frame',
          taskId: 0,
          t: 0,
          f0: 0,
          conf: 0,
          rms: bufferRms(this.window),
        }
    this.port.postMessage(frame)
    return true
  }

  private analysedFrame(quantumLength: number): PitchF0WorkletFrame {
    const detected = this.analyser.analyse(this.window)
    return {
      type: 'frame',
      taskId: this.taskId,
      // `currentFrame` indexes the first sample of this quantum, so the window
      // this pass just read ends one quantum later.
      t: (currentFrame + quantumLength - this.taskStartFrame) / sampleRate,
      f0: detected.frequency,
      conf: detected.confidence,
      rms: detected.rms,
    }
  }
}

registerProcessor(PITCH_F0_PROCESSOR, PitchF0Processor)
