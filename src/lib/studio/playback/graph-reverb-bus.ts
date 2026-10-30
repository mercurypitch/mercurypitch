// ============================================================
// Studio reverb bus — shared reverb spaces a lighter playback quality sends to
// ============================================================
//
// At Balanced and Light (playback-quality.ts), a lane's reverb that is not
// ducked does not convolve on its own: it sends, after its own pre-delay,
// cuts and mix, to one of three shared spaces (fx-profile.ts
// REVERB_SPACES), each one convolver for every lane in it. A convolver is
// the dearest node Studio builds, in work and in memory, so a song of
// nineteen reverbs runs three.
//
// The send follows the lane's faders, pan and mute (post-fader, a pair of
// gains beside the lane's own), and the gain effects after the reverb in
// the lane's chain (sendTrim), as its reverb did when it ran through them.
// What a send skips is the rest of the chain after the reverb: the tilt
// and, on drums, the limiter. A lane crossing to a new chain (graph-swap.ts)
// crosses its sends with it, on the same frames.
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { dbToGain } from '@/lib/studio-fx/dsp'
import type { StudioEffectSend } from '@/lib/studio-fx/effect-shell'
import { isRealtimeRunning, writeParam } from '@/lib/studio-fx/effect-shell'
import type { StudioReverbSpace } from '@/lib/studio-fx/fx-profile'
import { REVERB_SPACES } from '@/lib/studio-fx/fx-profile'
import { generateReverbImpulse } from '@/lib/studio-fx/reverb-impulse'

/** The shared spaces of one graph, each built when a lane first sends to it. */
export interface StudioReverbBuses {
  input(space: StudioReverbSpace): AudioNode
  dispose(): void
}

export function createReverbBuses(
  ctx: BaseAudioContext,
  output: AudioNode,
): StudioReverbBuses {
  const buses = new Map<StudioReverbSpace, readonly AudioNode[]>()
  return {
    input(space) {
      const built = buses.get(space)
      if (built) return built[0]
      const input = ctx.createGain()
      const convolver = ctx.createConvolver()
      convolver.normalize = true
      const { decayS, damping } = REVERB_SPACES[space]
      const [left, right] = generateReverbImpulse({
        sampleRate: ctx.sampleRate,
        decaySeconds: decayS,
        damping: damping / 100,
      })
      const impulse = ctx.createBuffer(2, left.length, ctx.sampleRate)
      impulse.copyToChannel(left, 0)
      impulse.copyToChannel(right, 1)
      convolver.buffer = impulse
      input.connect(convolver).connect(output)
      buses.set(space, [input, convolver])
      return input
    },
    dispose() {
      for (const [input, convolver] of buses.values()) {
        input.disconnect()
        convolver.disconnect()
        ;(convolver as ConvolverNode).buffer = null
      }
      buses.clear()
    },
  }
}

/** One space a lane sends to: its reverbs' sends in, its own fader pair out. */
export interface StudioLaneSend {
  /** The sends sum here, trimmed by the gains after the reverb (sendTrim). */
  readonly input: GainNode
  readonly split: ChannelSplitterNode
  /** Left and right, moved with the lane's own faders. */
  readonly mixes: readonly GainNode[]
  readonly merge: ChannelMergerNode
}

/**
 * The gain the effects after a lane's first sending reverb add: the
 * product of its gain effects' levels. 1 when the chain sends nothing.
 */
export function sendTrim(spec: ChainSpec): number {
  const from = spec.effects.findIndex(
    (effect) =>
      effect.kind === 'reverb' && effect.enabled && effect.params.duck === 0,
  )
  if (from < 0) return 1
  let trim = 1
  for (const effect of spec.effects.slice(from + 1))
    if (effect.kind === 'gain' && effect.enabled)
      trim *= dbToGain(effect.params.gainDb)
  return trim
}

/** Wire a chain's sends into the spaces they name, through fader pairs at `values`. */
export function connectLaneSends(
  ctx: BaseAudioContext,
  sends: readonly StudioEffectSend[],
  spec: ChainSpec,
  values: readonly number[],
  buses: StudioReverbBuses,
): StudioLaneSend[] {
  const bySpace = new Map<StudioReverbSpace, StudioLaneSend>()
  for (const send of sends) {
    let lane = bySpace.get(send.space)
    if (!lane) {
      const input = ctx.createGain()
      input.gain.value = sendTrim(spec)
      const split = ctx.createChannelSplitter(2)
      const merge = ctx.createChannelMerger(2)
      const mixes = values.map((value, index) => {
        const gain = ctx.createGain()
        gain.gain.value = value
        split.connect(gain, index)
        gain.connect(merge, 0, index)
        return gain
      })
      input.connect(split)
      merge.connect(buses.input(send.space))
      lane = { input, split, mixes, merge }
      bySpace.set(send.space, lane)
    }
    send.output.connect(lane.input)
  }
  return [...bySpace.values()]
}

/** Take a lane's sends apart. */
export function disconnectLaneSends(sends: readonly StudioLaneSend[]): void {
  for (const send of sends) {
    send.input.disconnect()
    send.split.disconnect()
    for (const mix of send.mixes) mix.disconnect()
    send.merge.disconnect()
  }
}

/**
 * Cross a lane's sends from one chain's to another's over `at` to `end`,
 * linearly, as the chains themselves cross (graph-swap.ts): each set goes
 * to or from the trim of its own chain.
 */
export function crossLaneSends(
  from: readonly StudioLaneSend[],
  fromTrim: number,
  to: readonly StudioLaneSend[],
  toTrim: number,
  at: number,
  end: number,
): void {
  for (const { input } of from) {
    input.gain.setValueAtTime(fromTrim, at)
    input.gain.linearRampToValueAtTime(0, end)
  }
  for (const { input } of to) {
    input.gain.setValueAtTime(0, at)
    input.gain.linearRampToValueAtTime(toTrim, end)
  }
}

/**
 * Move a lane's sends to `trim` as its chain changes in place. While the
 * lane is still crossing to that chain, its sends' fade-in ends at the new
 * trim instead, so they keep coming in with the chain.
 */
export function retrimLaneSends(
  ctx: BaseAudioContext,
  sends: readonly StudioLaneSend[],
  trim: number,
  crossing: { readonly at: number; readonly end: number } | null,
): void {
  const now = ctx.currentTime
  for (const { input } of sends) {
    if (crossing === null || now >= crossing.end) {
      writeParam(input.gain, trim, ctx, isRealtimeRunning(ctx))
      continue
    }
    input.gain.cancelScheduledValues(now)
    if (now < crossing.at) input.gain.setValueAtTime(0, crossing.at)
    input.gain.linearRampToValueAtTime(trim, crossing.end)
  }
}
