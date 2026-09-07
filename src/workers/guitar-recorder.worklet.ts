// Guitar recorder copies a selected mono input into a finite transferable buffer pool.
import { createGuitarPcmCapture } from '@/lib/guitar/recording-pcm-capture'
import type { GuitarCaptureCommand } from '@/lib/guitar/recording-types'

declare const currentFrame: number
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(
  name: string,
  processor: typeof AudioWorkletProcessor,
): void

class GuitarRecorderProcessor extends AudioWorkletProcessor {
  private readonly capture = createGuitarPcmCapture((message, transfer = []) =>
    this.port.postMessage(message, transfer),
  )
  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<GuitarCaptureCommand>) =>
      this.capture.command(event.data)
  }
  process(inputs: Float32Array[][]): boolean {
    this.capture.process(inputs[0]?.[0], currentFrame)
    return true
  }
}
registerProcessor('guitar-recorder', GuitarRecorderProcessor)
