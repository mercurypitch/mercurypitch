// ============================================================
// Mixdown — every track through its own chain, aligned, summed offline
// ============================================================
//
// Chains delay their tracks by different amounts: a lead vocal chain with
// four dynamic bands, a compressor and a limiter runs 44 ms late at 48 kHz,
// a piano chain 6 ms. Summed as they come, the vocal would trail the band.
// So every track starts early by the difference between the slowest chain's
// latency and its own — plugin delay compensation — and the whole song comes
// out late by exactly the slowest latency, which is cut away. A live player
// does the same with `alignmentOffsets`.
//
// One OfflineAudioContext renders all tracks together after the usual
// pre-roll (see render.ts), so a mixdown is one pass, not one per track.

import { createStudioFxChain } from './chain'
import type { ChainSpec } from './chain-spec'
import { normalizeChainSpec } from './chain-spec'
import { dbToGain } from './dsp'
import type { RenderThroughChainOptions } from './render'
import { estimateTailSeconds, measureChainLatencyFrames } from './render'

const PRE_ROLL_SECONDS = 0.5

export interface MixdownTrack {
  readonly buffer: AudioBuffer
  readonly spec: ChainSpec
  /** The fader after the chain; muted tracks are simply left out. */
  readonly gainDb?: number
  /** Where the clip starts in the song. */
  readonly startSeconds?: number
}

/**
 * How many frames each track must start EARLY so that all of them leave
 * their chains together: the slowest chain's latency minus its own.
 */
export function alignmentOffsets(latencies: readonly number[]): number[] {
  const slowest = Math.max(0, ...latencies)
  return latencies.map((latency) => slowest - latency)
}

/** The latency of every track's chain, in frames at `sampleRate`. */
export async function measureTrackLatencies(
  specs: readonly ChainSpec[],
  sampleRate: number,
  createContext?: RenderThroughChainOptions['createContext'],
): Promise<number[]> {
  const cache = new Map<string, number>()
  const latencies: number[] = []
  for (const spec of specs) {
    // Latency depends on which effects there are, not on their settings.
    const key = spec.effects.map((effect) => effect.kind).join(',')
    let latency = cache.get(key)
    if (latency === undefined) {
      latency = await measureChainLatencyFrames(spec, sampleRate, createContext)
      cache.set(key, latency)
    }
    latencies.push(latency)
  }
  return latencies
}

/** Render every track through its chain, aligned, into one stereo buffer. */
export async function renderMixdown(
  tracks: readonly MixdownTrack[],
  options: RenderThroughChainOptions & { readonly sampleRate?: number } = {},
): Promise<AudioBuffer> {
  const createContext =
    options.createContext ??
    ((init: OfflineAudioContextOptions) => new OfflineAudioContext(init))
  const sampleRate = options.sampleRate ?? tracks[0]?.buffer.sampleRate ?? 48000
  const specs = tracks.map((track) => normalizeChainSpec(track.spec))
  const latencies = await measureTrackLatencies(
    specs,
    sampleRate,
    createContext,
  )
  const offsets = alignmentOffsets(latencies)
  const slowest = Math.max(0, ...latencies)
  const tail =
    options.tailSeconds ?? Math.max(0, ...specs.map(estimateTailSeconds))
  const songSeconds = Math.max(
    0,
    ...tracks.map((t) => (t.startSeconds ?? 0) + t.buffer.duration),
  )
  const length = Math.ceil((songSeconds + tail) * sampleRate)
  const preRoll = Math.round(PRE_ROLL_SECONDS * sampleRate)
  const ctx = createContext({
    numberOfChannels: 2,
    length: preRoll + slowest + length,
    sampleRate,
  })
  const cleanup: (() => void)[] = []
  tracks.forEach((track, index) => {
    const chain = createStudioFxChain(ctx, specs[index])
    const fader = ctx.createGain()
    fader.gain.value = dbToGain(track.gainDb ?? 0)
    const player = ctx.createBufferSource()
    player.buffer = track.buffer
    player.connect(chain.input)
    chain.output.connect(fader)
    fader.connect(ctx.destination)
    const startFrame =
      preRoll +
      offsets[index] +
      Math.round((track.startSeconds ?? 0) * sampleRate)
    player.start(startFrame / sampleRate)
    cleanup.push(() => {
      player.disconnect()
      fader.disconnect()
      chain.dispose()
    })
  })
  try {
    const rendered = await ctx.startRendering()
    const output = ctx.createBuffer(2, length, sampleRate)
    const start = preRoll + slowest
    for (let channel = 0; channel < 2; channel++) {
      output.copyToChannel(
        rendered.getChannelData(channel).subarray(start, start + length),
        channel,
      )
    }
    return output
  } finally {
    for (const dispose of cleanup) dispose()
  }
}
