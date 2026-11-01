// Studio recorder meters the armed microphone and copies a take into pooled buffers on exact clock frames (pcm-capture.ts).
import type { StudioCaptureCommand } from '@/lib/studio/record/pcm-capture'
import { createStudioPcmCapture } from '@/lib/studio/record/pcm-capture'

declare const currentFrame: number
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(
  name: string,
  processor: typeof AudioWorkletProcessor,
): void

class StudioRecorderProcessor extends AudioWorkletProcessor {
  private readonly capture = createStudioPcmCapture((message, transfer = []) =>
    this.port.postMessage(message, transfer),
  )
  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<StudioCaptureCommand>) =>
      this.capture.command(event.data)
  }
  process(inputs: Float32Array[][]): boolean {
    this.capture.process(inputs[0]?.[0], currentFrame)
    return true
  }
}
registerProcessor('studio-recorder', StudioRecorderProcessor)
