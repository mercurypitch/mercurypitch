// ============================================================
// Studio FX render — bounce a buffer through a chain, offline
// ============================================================
//
// The same chain spec, the same effect graphs and the same seeded impulse
// responses as live playback, rendered in an OfflineAudioContext: what gets
// exported is what was heard. Three corrections make the bounce line up with
// its source:
//
//   PRE-ROLL — a new DynamicsCompressorNode fades in: it starts about 17 dB
//   down and needs ~300 ms to reach unity (Chrome 153). The source therefore
//   starts after half a second of silence, which is cut away afterwards.
//
//   LATENCY — compressors carry a lookahead and oversampled shapers a
//   resampling delay (6 ms and 4 ms at 48 kHz on Chrome 153). The chain's
//   total is measured, not assumed, by sending an impulse through a bypassed
//   copy of it: bypassed, every effect is its own latency twin, a pure delay.
//   The output is shifted back by that amount, so a bounced track still sits
//   on the beat. `measureChainLatencyFrames` is exported for live playback,
//   where tracks with different chains have to be aligned the same way.
//
//   TAIL — the render runs on past the source by the chain's tail (reverb
//   decay, delay repeats), so an export never cuts a tail.

import { createStudioFxChain } from './chain'
import type { ChainSpec } from './chain-spec'
import { normalizeChainSpec } from './chain-spec'
import { measureCompressorLatency } from './compressor-twin'
import { delayTailSeconds } from './dsp'
import { measureShaperDelays } from './shaper-delay'

const TAIL_MARGIN_SECONDS = 0.05
const MAX_TAIL_SECONDS = 30
const PRE_ROLL_SECONDS = 0.5
const LATENCY_WINDOW_FRAMES = 8192

type ContextFactory = (
  options: OfflineAudioContextOptions,
) => OfflineAudioContext

export interface RenderThroughChainOptions {
  /** Native work already started settles normally; abort prevents later stages and result copying. */
  readonly signal?: AbortSignal
  /** Override the estimated tail. */
  readonly tailSeconds?: number
  /** Injectable for tests and non-browser runtimes. */
  readonly createContext?: ContextFactory
}

/**
 * How long the chain keeps sounding after its input stops. Effects run in
 * series, so their tails add up: the last echo of a delay still has a full
 * reverb tail of its own.
 */
export function estimateTailSeconds(spec: ChainSpec): number {
  let tail = 0
  for (const effect of spec.effects) {
    if (!effect.enabled) continue
    if (effect.kind === 'reverb') {
      tail += effect.params.preDelayMs / 1000 + effect.params.decayS
    } else if (effect.kind === 'delay') {
      tail += delayTailSeconds(
        effect.params.timeMs / 1000,
        effect.params.feedback / 100,
      )
    }
  }
  return Math.min(MAX_TAIL_SECONDS, tail + TAIL_MARGIN_SECONDS)
}

function defaultContext(
  options: OfflineAudioContextOptions,
): OfflineAudioContext {
  return new OfflineAudioContext(options)
}

function preRollFrames(spec: ChainSpec, sampleRate: number): number {
  return spec.effects.length > 0 ? Math.round(PRE_ROLL_SECONDS * sampleRate) : 0
}

function peakIndexFrom(data: Float32Array, from: number): number {
  let best = from
  for (let i = from + 1; i < data.length; i++) {
    if (Math.abs(data[i]) > Math.abs(data[best])) best = i
  }
  return best
}

/** Render `input` through a fresh chain built from `spec`, after a pre-roll. */
async function renderChain(
  spec: ChainSpec,
  input: AudioBuffer,
  length: number,
  createContext: ContextFactory,
): Promise<{
  rendered: AudioBuffer
  ctx: OfflineAudioContext
  preRoll: number
}> {
  const preRoll = preRollFrames(spec, input.sampleRate)
  const ctx = createContext({
    numberOfChannels: 2,
    length: preRoll + length,
    sampleRate: input.sampleRate,
  })
  const chain = createStudioFxChain(ctx, spec)
  const player = ctx.createBufferSource()
  player.buffer = input
  player.connect(chain.input)
  chain.output.connect(ctx.destination)
  player.start(preRoll / input.sampleRate)
  try {
    return { rendered: await ctx.startRendering(), ctx, preRoll }
  } finally {
    player.disconnect()
    chain.dispose()
  }
}

/**
 * Frames between a sample entering the chain and leaving it. The same with
 * every effect enabled or bypassed, because each bypass path is a latency twin
 * of the processed one; bypassed, the chain is a pure delay to measure.
 */
export async function measureChainLatencyFrames(
  spec: unknown,
  sampleRate: number,
  createContext: ContextFactory = defaultContext,
): Promise<number> {
  const chainSpec = normalizeChainSpec(spec)
  if (chainSpec.effects.length === 0) return 0
  // Every chain build follows a measurement, so twins can be plain delays.
  // Beside this render, not before it: a twin's delay equals the lookahead
  // either way, so the latency read here does not depend on which it is.
  const twins = Promise.all([
    measureCompressorLatency(sampleRate),
    measureShaperDelays(sampleRate),
  ])
  const bypassed = normalizeChainSpec({
    effects: chainSpec.effects.map((effect) => ({ ...effect, enabled: false })),
  })
  const probe = createContext({ numberOfChannels: 1, length: 1, sampleRate })
  const impulse = probe.createBuffer(1, 1, sampleRate)
  impulse.getChannelData(0)[0] = 1
  const { rendered, preRoll } = await renderChain(
    bypassed,
    impulse,
    LATENCY_WINDOW_FRAMES,
    createContext,
  )
  await twins
  return peakIndexFrom(rendered.getChannelData(0), preRoll) - preRoll
}

/** Render `source` through `spec` into a new stereo buffer, tail included. */
export async function renderThroughChain(
  source: AudioBuffer,
  spec: unknown,
  options: RenderThroughChainOptions = {},
): Promise<AudioBuffer> {
  options.signal?.throwIfAborted()
  const chainSpec = normalizeChainSpec(spec)
  const createContext = options.createContext ?? defaultContext
  const tail = Math.max(
    0,
    options.tailSeconds ?? estimateTailSeconds(chainSpec),
  )
  const length = source.length + Math.ceil(tail * source.sampleRate)
  const latency = await measureChainLatencyFrames(
    chainSpec,
    source.sampleRate,
    createContext,
  )
  options.signal?.throwIfAborted()
  const { rendered, ctx, preRoll } = await renderChain(
    chainSpec,
    source,
    latency + length,
    createContext,
  )
  options.signal?.throwIfAborted()
  const start = preRoll + latency
  const output = ctx.createBuffer(2, length, source.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    output.copyToChannel(
      rendered.getChannelData(channel).subarray(start, start + length),
      channel,
    )
  }
  return output
}
