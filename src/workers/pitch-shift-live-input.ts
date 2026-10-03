// ============================================================
// Pitch-shift live input — nothing coming in is silence
// ============================================================
//
// Imported by pitch-shift.worklet.ts ahead of the library, so the library's
// own registerProcessor() call registers the subclass below in its place.
//
// The Signalsmith processor either shifts a live input or plays back buffers
// posted to it, and tells the two apart by whether its input has channels.
// Web Audio hands a worklet an input with NO channels whenever nothing is
// playing into it: a guide vocal parked while muted, stems stopped while the
// song is paused, a released node waiting to be reused. Taken for buffer
// playback, that runs a full analysis on every block, over nothing, and costs
// more than shifting real audio does. Nothing here ever posts buffers, so an
// empty input is silence, which the engine notices and skips.

interface Processor {
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean
}

type ProcessorClass = new (options: AudioWorkletNodeOptions) => Processor

interface WorkletScope {
  registerProcessor: (name: string, processor: ProcessorClass) => void
}

const RENDER_QUANTUM = 128

const scope = globalThis as unknown as WorkletScope
const register = scope.registerProcessor

let silence: Float32Array[][] = [[]]

/** Stereo silence one block long, made again only if the block size moves. */
function silentInput(blockSize: number): Float32Array[][] {
  if (silence[0][0]?.length !== blockSize)
    silence = [[new Float32Array(blockSize), new Float32Array(blockSize)]]
  return silence
}

function registerLiveInput(name: string, Base: ProcessorClass): void {
  class LiveInputProcessor extends Base {
    override process(
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>,
    ): boolean {
      const input =
        (inputs[0]?.length ?? 0) > 0
          ? inputs
          : silentInput(outputs[0]?.[0]?.length ?? RENDER_QUANTUM)
      return super.process(input, outputs, parameters)
    }
  }
  register(name, LiveInputProcessor)
}

// A scope that will not let the name be replaced keeps the library's own
// registration: the key still changes, only an idle shifter costs more.
try {
  scope.registerProcessor = registerLiveInput
} catch {
  /* keep the library's own */
}
