// Studio compressor worklet — a DynamicsCompressorNode's processing with no lookahead, for a monitored input (src/lib/studio-fx/compressor-kernel.ts).
import type { CompressorKernelSettings } from '@/lib/studio-fx/compressor-kernel'
import { COMPRESSOR_PARAMETERS, createCompressorKernel, STUDIO_COMPRESSOR_DISPOSE, STUDIO_COMPRESSOR_PROCESSOR, } from '@/lib/studio-fx/compressor-kernel'

declare const sampleRate: number
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(
  name: string,
  processor: typeof AudioWorkletProcessor,
): void

type ParameterValues = Readonly<
  Record<(typeof COMPRESSOR_PARAMETERS)[number]['name'], Float32Array>
>

class StudioCompressorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return COMPRESSOR_PARAMETERS
  }

  private readonly kernel = createCompressorKernel(sampleRate)
  /** Disposed: a disconnected worklet still runs until its process() says it is done. */
  private done = false
  /** Filled afresh each quantum: the kernel reads the values, never keeps the object. */
  private readonly settings: CompressorKernelSettings = {
    thresholdDb: 0,
    kneeDb: 0,
    ratio: 1,
    attackSeconds: 0,
    releaseSeconds: 0,
  }

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === STUDIO_COMPRESSOR_DISPOSE) this.done = true
    }
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: ParameterValues,
  ): boolean {
    if (this.done) return false
    const settings = this.settings
    settings.thresholdDb = parameters.threshold[0]
    settings.kneeDb = parameters.knee[0]
    settings.ratio = parameters.ratio[0]
    settings.attackSeconds = parameters.attack[0]
    settings.releaseSeconds = parameters.release[0]
    this.kernel.process(inputs[0] ?? [], outputs[0], settings)
    // A compressor rings on after its input, as the browser's does.
    return true
  }
}
registerProcessor(STUDIO_COMPRESSOR_PROCESSOR, StudioCompressorProcessor)
