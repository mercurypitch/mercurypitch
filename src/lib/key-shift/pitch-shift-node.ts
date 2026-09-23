// ============================================================
// Pitch-shift node — Signalsmith Stretch, bundled, live input
// ============================================================
//
// Wraps the Signalsmith Stretch AudioWorklet (MIT, npm `signalsmith-stretch`)
// as a live-input pitch shifter: connect a source into `node` and `node` on to
// the output, and the audio comes out `semitones` higher or lower at the same
// tempo. The shift adds `latencySec` of delay, which callers compensate.
//
// Nothing loads from a CDN. The processor is registered from our own worklet
// entry (`?worker&url`), and the library's `moduleUrl` points at that same
// file, so its fallback never builds a blob: URL from stringified code. The
// main-thread half of the library is imported lazily: a song that never
// changes key never downloads it.

import type { StretchChange, StretchConfig, StretchNode, } from 'signalsmith-stretch'
import workletUrl from '@/workers/pitch-shift.worklet.ts?worker&url'

export type PitchShiftPreset = 'default' | 'cheaper'

export interface PitchShifterOptions {
  formantCompensation: boolean
  /** Rough fundamental for the formant analysis; 0 lets the engine track it. */
  formantBaseHz?: number
  preset?: PitchShiftPreset
}

export interface PitchShifter {
  /** Connect input → node → output. */
  readonly node: AudioNode
  /** Measured once at creation. */
  readonly latencySec: number
  setSemitones(semitones: number, atContextTime?: number): void
  /** Gives the engine back, for the next shifter on the same context. */
  dispose(): void
}

export const PITCH_SHIFT_PROCESSOR = 'signalsmith-stretch'

// Stereo in and out, always. The 1.3.x processor re-configures itself when
// the output channel count changes, and that path calls an undefined
// `configure()`: a fixed count keeps it unreachable.
export const PITCH_SHIFT_NODE_OPTIONS: AudioWorkletNodeOptions = {
  numberOfInputs: 1,
  numberOfOutputs: 1,
  outputChannelCount: [2],
  channelCount: 2,
  channelCountMode: 'explicit',
}

const ENGINE_START_TIMEOUT_MS = 10_000

export function presetConfig(preset: PitchShiftPreset): StretchConfig {
  return { blockMs: null, preset }
}

// Live input needs an active segment: an inactive engine outputs silence.
export function startChange(options: PitchShifterOptions): StretchChange {
  return {
    active: true,
    semitones: 0,
    formantCompensation: options.formantCompensation,
    formantBaseHz: options.formantBaseHz ?? 0,
  }
}

// A partial change: the engine copies every other field from the segment
// before it, so the node stays active with its formant settings.
export function semitoneChange(
  semitones: number,
  atContextTime?: number,
): StretchChange {
  return atContextTime === undefined
    ? { semitones }
    : { semitones, output: atContextTime }
}

export function canShiftPitch(ctx: BaseAudioContext): boolean {
  return (
    typeof ctx.audioWorklet?.addModule === 'function' &&
    typeof AudioWorkletNode !== 'undefined'
  )
}

const registered = new WeakMap<BaseAudioContext, Promise<void>>()

function loadWorklet(ctx: BaseAudioContext): Promise<void> {
  let module = registered.get(ctx)
  if (module === undefined) {
    module = ctx.audioWorklet.addModule(workletUrl).catch((error: unknown) => {
      registered.delete(ctx)
      throw error
    })
    registered.set(ctx, module)
  }
  return module
}

// Engines given back, per context, for the next shifter to take. The engine
// never tells Web Audio it has finished, so a node lives as long as its
// context does -- and the Jam context lives as long as the tab, while its
// stage is built again on every visit to the tab. Made fresh each time,
// every visit would leave two more engines behind.
const idle = new WeakMap<BaseAudioContext, StretchNode[]>()

// Stopped, the engine takes its silent path (see the worklet's live-input
// shim) until a shifter on the same context starts it again.
function release(ctx: BaseAudioContext, node: StretchNode): void {
  void node.stop()
  node.disconnect()
  let nodes = idle.get(ctx)
  if (nodes === undefined) {
    nodes = []
    idle.set(ctx, nodes)
  }
  nodes.push(node)
}

async function startEngine(
  created: Promise<StretchNode>,
  options: PitchShifterOptions,
): Promise<{ node: StretchNode; latencySec: number }> {
  const node = await created
  if (options.preset) void node.configure(presetConfig(options.preset))
  void node.schedule(startChange(options))
  const latency = await node.latency()
  const latencySec =
    typeof latency === 'number' && Number.isFinite(latency) && latency > 0
      ? latency
      : 0
  return { node, latencySec }
}

export async function createPitchShifter(
  ctx: BaseAudioContext,
  options: PitchShifterOptions,
): Promise<PitchShifter> {
  if (!canShiftPitch(ctx))
    throw new Error('Changing the key needs AudioWorklet support.')
  await loadWorklet(ctx)
  const { default: SignalsmithStretch } = await import('signalsmith-stretch')
  SignalsmithStretch.moduleUrl = workletUrl

  // The library waits for the WASM engine's 'ready' with no deadline.
  let abandoned = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const reused = idle.get(ctx)?.pop()
  const starting = startEngine(
    reused !== undefined
      ? Promise.resolve(reused)
      : SignalsmithStretch(ctx, PITCH_SHIFT_NODE_OPTIONS),
    options,
  )
  starting.then(
    (started) => {
      if (abandoned) release(ctx, started.node)
    },
    () => {},
  )
  // The engine starts on the audio thread, which a suspended context does
  // not run, and a song loads well before anyone presses play: the deadline
  // only counts while the context runs.
  let onStateChange = () => {}
  const timeout = new Promise<never>((_resolve, reject) => {
    const arm = () => {
      if (ctx.state === 'running') {
        timer ??= setTimeout(() => {
          abandoned = true
          reject(new Error('The key-change engine did not start in time.'))
        }, ENGINE_START_TIMEOUT_MS)
      } else if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
    }
    onStateChange = arm
    ctx.addEventListener('statechange', arm)
    arm()
  })

  try {
    const { node, latencySec } = await Promise.race([starting, timeout])
    // Given back, the engine may already be the next shifter's.
    let released = false
    return {
      node,
      latencySec,
      setSemitones(semitones, atContextTime) {
        if (released) return
        void node.schedule(semitoneChange(semitones, atContextTime))
      },
      dispose() {
        if (released) return
        released = true
        release(ctx, node)
      },
    }
  } finally {
    clearTimeout(timer)
    ctx.removeEventListener('statechange', onStateChange)
  }
}
