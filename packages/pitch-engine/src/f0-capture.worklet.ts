// Cutting the voice into analysis windows on the audio clock.
// ============================================================
//
// This runs on the audio render thread, once per 128-sample quantum, and
// it exists because the alternative was reading an AnalyserNode inside
// requestAnimationFrame. That made the pitch hop equal to the frame
// interval: 16 ms when the renderer was idle, 33 ms when it was not, and
// the audio between frames analysed by nobody. The harder the scene got,
// the worse the singing felt — the worst possible coupling for a game
// whose input is the voice.
//
// So the window boundaries are struck here, at a fixed hop, whatever the
// renderer is doing. `currentFrame` is the audio clock's own counter, so
// a window is stamped exactly, and the stamp is directly comparable to
// `audioContext.currentTime`.
//
// The detector itself is deliberately NOT here. YIN over 2048 samples is
// a fraction of a millisecond, but the render quantum's whole deadline is
// 2.7 ms at 48 kHz, and a missed deadline is an audible glitch in the
// singer's own monitoring. This posts the window out; a worker answers it.

import type { F0CaptureMessage } from './f0-worklet-contract'
import { F0_CAPTURE_PROCESSOR, F0_HOP, F0_WINDOW } from './f0-worklet-contract'

declare const currentFrame: number
declare function registerProcessor(
  name: string,
  processor: typeof AudioWorkletProcessorPolyfill,
): void

declare class AudioWorkletProcessorPolyfill {
  readonly port: MessagePort
  constructor()
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean
}

declare const AudioWorkletProcessor: typeof AudioWorkletProcessorPolyfill

class F0CaptureProcessor extends AudioWorkletProcessor {
  // One window of history, written round-robin. A ring rather than a
  // shifting buffer so the per-quantum cost is a copy of 128 samples and
  // nothing else — this is the thread with the 2.7 ms deadline.
  private readonly ring = new Float32Array(F0_WINDOW)
  private writeIndex = 0
  private sinceLastHop = 0
  private filled = 0
  private primed = false

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    // An input with no connected source yields an empty array. Staying
    // alive matters: the graph reconnects when the mic does.
    if (channel === undefined || channel.length === 0) return true

    for (let i = 0; i < channel.length; i++) {
      this.ring[this.writeIndex] = channel[i]
      this.writeIndex = (this.writeIndex + 1) % F0_WINDOW
    }
    if (this.filled < F0_WINDOW) {
      this.filled = Math.min(F0_WINDOW, this.filled + channel.length)
    }
    this.sinceLastHop += channel.length

    // Wait for a full window before the first hop, or the detector would
    // see a window that is mostly the silence we allocated.
    if (this.filled < F0_WINDOW) return true
    if (!this.primed) {
      // Report the first full window at once. Making the singer wait a
      // further hop for the meter to move is a worse first impression
      // than the 43 ms the window itself already costs — and the
      // priming quanta left a residual that would otherwise fire a
      // second window one quantum later, off the hop grid for good.
      this.primed = true
      this.sinceLastHop = 0
    } else if (this.sinceLastHop < F0_HOP) {
      return true
    } else {
      this.sinceLastHop -= F0_HOP
    }

    // Unwrap the ring into a flat window, oldest sample first.
    const samples = new Float32Array(F0_WINDOW)
    const head = F0_WINDOW - this.writeIndex
    samples.set(this.ring.subarray(this.writeIndex), 0)
    samples.set(this.ring.subarray(0, this.writeIndex), head)

    let sumSquares = 0
    for (let i = 0; i < F0_WINDOW; i++) sumSquares += samples[i] * samples[i]

    const message: F0CaptureMessage = {
      samples,
      atFrame: currentFrame + channel.length,
      rms: Math.sqrt(sumSquares / F0_WINDOW),
    }
    this.port.postMessage(message, [samples.buffer])
    return true
  }
}

registerProcessor(F0_CAPTURE_PROCESSOR, F0CaptureProcessor)
