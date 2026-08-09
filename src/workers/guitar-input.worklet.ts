// Guitar input worklet — timestamps attacks where the timestamps are real.
// ============================================================
//
// Everything here runs on the audio render thread, once per 128-sample
// quantum. That is the entire reason it exists: on the main thread the earliest
// anything can notice a strike is the next animation frame, which is up to
// 16 ms later and later still whenever the 3D stage is busy. Musical timing
// measured that way is measuring the renderer, not the player.
//
// `currentFrame` is the audio clock's own frame counter, so an attack found at
// sample N of this quantum is stamped `currentFrame + N` — exact, and directly
// comparable to anything the band scheduled.
//
// The detector itself lives in src/lib/guitar/attack-detector.ts and is tested
// there against real waveforms. This file is the deliberately thin shell that
// feeds it.

import { createAttackDetector } from '@/lib/guitar/attack-detector'
import { createNoiseFloorFollower } from '@/lib/guitar/input-events'

declare const currentFrame: number
declare const sampleRate: number
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

export const GUITAR_INPUT_PROCESSOR = 'guitar-input-processor'

/** Level updates every this many quanta — about twelve a second at 48 kHz. */
const LEVEL_INTERVAL_QUANTA = 32

class GuitarInputProcessor extends AudioWorkletProcessor {
  private readonly detector = createAttackDetector({ sampleRate })
  private readonly noiseFloor = createNoiseFloorFollower()
  private quantaSinceLevel = 0
  private levelPeak = 0

  /**
   * Follow the loudest input channel for this render quantum.
   *
   * Averaging is unsafe for interfaces: a guitar on input two would be halved
   * by an empty input one, and polarity-opposed stereo channels could cancel
   * entirely. Selecting one intact waveform preserves both attack level and
   * phase without allocating on the audio thread.
   */
  private selectInputChannel(
    channels: readonly Float32Array[],
  ): Float32Array | null {
    let selected: Float32Array | null = null
    let selectedPeak = -1
    for (const channel of channels) {
      if (channel.length === 0) continue
      let peak = 0
      for (let index = 0; index < channel.length; index += 1) {
        const level = Math.abs(channel[index] ?? 0)
        if (level > peak) peak = level
      }
      if (peak <= selectedPeak) continue
      selected = channel
      selectedPeak = peak
    }
    return selected
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = this.selectInputChannel(inputs[0] ?? [])
    // No input block at all means the graph has nothing upstream yet. Staying
    // alive is right: the microphone may still be arriving.
    if (channel === null) return true

    for (const attack of this.detector.process(channel)) {
      this.port.postMessage({
        type: 'attack',
        atFrame: currentFrame + attack.offsetSamples,
        level: attack.level,
      })
    }

    const blockPeak = this.detector.peak()
    if (blockPeak > this.levelPeak) this.levelPeak = blockPeak
    const floor = this.noiseFloor.push(blockPeak, channel.length / sampleRate)

    this.quantaSinceLevel += 1
    if (this.quantaSinceLevel >= LEVEL_INTERVAL_QUANTA) {
      this.port.postMessage({
        type: 'level',
        atFrame: currentFrame,
        peak: this.levelPeak,
        noiseFloor: floor,
      })
      this.quantaSinceLevel = 0
      this.levelPeak = 0
    }
    return true
  }
}

registerProcessor(GUITAR_INPUT_PROCESSOR, GuitarInputProcessor)
