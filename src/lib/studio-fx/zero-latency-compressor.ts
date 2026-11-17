// ============================================================
// Zero-latency compressor — the monitor's compressor: the browser's own processing on an AudioWorklet, looking nowhere ahead
// ============================================================
//
// A monitored input plays through its lane's compressor, de-esser and
// dynamic EQ as playback plays the lane, at the lane's own settings, and no
// later than a dry input (fx-profile.ts MONITOR_FX_PROFILE). A
// DynamicsCompressorNode cannot do that: its 6 ms pre-delay is fixed. This
// runs the node's processing without it (compressor-kernel.ts) in an
// AudioWorkletNode, which hands back each render quantum it is given, so it
// adds no latency. Its parameters are a DynamicsCompressorNode's, by name,
// range and rate. Each of those effects runs one, on the signal its
// browser's node compresses: the whole input for the compressor, the
// sibilant band for the de-esser, the band for a dynamic EQ.
//
// Its module must be on the context before a unit asks for a node:
// `prepareZeroLatencyCompressor` loads it once per context, and the
// recorder loads it with its own worklet, before any lane's monitor is
// built (useStudioRecorder.ts). Until it has loaded, or where it cannot,
// `createZeroLatencyCompressor` gives null, and each of those effects passes
// its input straight through, as the monitor's did before
// (effects/latency-only.ts).
//
// A worklet runs on after it is disconnected, for as long as its process()
// says it has work; `dispose` tells it it has none.
//
// The worklet's URL is imported only when a context loads it. Every browser
// spec loads in plain Node with what it imports from src/
// (scripts/playwright-list.test.mjs), and effects/compressor.ts, deesser.ts
// and dyneq.ts are on that path: a static `?worker&url` import there pulls
// the worklet itself into Node, which cannot load it, and the whole browser
// suite fails to list.
import { STUDIO_COMPRESSOR_DISPOSE, STUDIO_COMPRESSOR_PROCESSOR, } from './compressor-kernel'

const loading = new WeakMap<BaseAudioContext, Promise<boolean>>()
const ready = new WeakSet<BaseAudioContext>()

export interface ZeroLatencyCompressor {
  readonly node: AudioNode
  readonly threshold: AudioParam
  readonly knee: AudioParam
  readonly ratio: AudioParam
  readonly attack: AudioParam
  readonly release: AudioParam
  /** Stop its processor; disconnect the node as any other. */
  dispose(): void
}

/** Load the compressor's module into `context` once: true once it is there, false where it cannot be. */
export function prepareZeroLatencyCompressor(
  context: BaseAudioContext,
): Promise<boolean> {
  if (
    typeof context.audioWorklet?.addModule !== 'function' ||
    typeof AudioWorkletNode === 'undefined'
  )
    return Promise.resolve(false)
  let pending = loading.get(context)
  if (pending === undefined) {
    const { audioWorklet } = context
    pending = import('@/workers/studio-compressor.worklet.ts?worker&url')
      .then(({ default: workletUrl }) => audioWorklet.addModule(workletUrl))
      .then(() => {
        ready.add(context)
        return true
      })
      .catch(() => {
        loading.delete(context)
        return false
      })
    loading.set(context, pending)
  }
  return pending
}

/** A compressor with no lookahead on `context`, or null until its module has loaded there. */
export function createZeroLatencyCompressor(
  context: BaseAudioContext,
): ZeroLatencyCompressor | null {
  if (!ready.has(context)) return null
  const node = new AudioWorkletNode(context, STUDIO_COMPRESSOR_PROCESSOR, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    // As a DynamicsCompressorNode: at most two channels in, always two out.
    outputChannelCount: [2],
    channelCount: 2,
    channelCountMode: 'clamped-max',
    channelInterpretation: 'speakers',
  })
  const param = (name: string): AudioParam => {
    const found = node.parameters.get(name)
    if (found === undefined) throw new Error(`No compressor ${name}`)
    return found
  }
  let disposed = false
  return {
    node,
    threshold: param('threshold'),
    knee: param('knee'),
    ratio: param('ratio'),
    attack: param('attack'),
    release: param('release'),
    dispose() {
      if (disposed) return
      disposed = true
      node.port.postMessage(STUDIO_COMPRESSOR_DISPOSE)
    },
  }
}
