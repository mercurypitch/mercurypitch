// ============================================================
// Studio song load — how much of the audio thread a song's heard lanes need at each playback tier
// ============================================================
//
// Auto (playback-quality.ts) picks a tier for the song that is open, so it
// needs that song's load before it plays. A lane costs what its chain's
// effects cost, and a song its lanes, the master and what realtime playback
// runs around them, all counted in voice chains: the unit the device
// benchmark measures (playback-benchmark.ts), so one render on the device
// scales the whole table. A muted or soloed-out lane costs nothing, as it
// leaves the mix once its tails ring out (lane-idle.ts). At Balanced and
// Light a reverb that is not ducked sends to one of three shared spaces
// instead of convolving on its lane (graph-reverb-bus.ts), so a song pays
// for each space it uses once. A lane heard through its input monitor
// (input-monitor.ts) runs its chain a second time, at the monitor's
// profile, and the monitor's master stage runs once for all of them, on
// the same audio thread: those count too, as the monitor plays them at the
// tier weighed (`lite`).
//
// The costs were measured offline in headless Chromium 148 on a Ryzen 9
// 5900X, 30 Oct 2026: each effect kind on twelve lanes against the same
// lanes without it, against a voice chain of 167.7 us per 128 frames. They
// add up to the three profiling fixtures' offline cost within -9 to +8 %.
// Realtime playback adds what an offline render does not do (the device
// callback, the meters), less the reverb tails Chromium moves to a thread
// of their own: 2.1 to 2.9 voice chains over the measured sessions, 2.6 on
// average, which REALTIME_COST carries.
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import type { EffectKind } from '@/lib/studio-fx/effect-definitions'
import type { StudioLiteEffect } from '@/lib/studio-fx/fx-profile'
import { reverbSpace } from '@/lib/studio-fx/fx-profile'
import { studioLaneSpec } from '../model/arrangement-plan'
import type { StudioClip, StudioProject, StudioTrack } from '../model/types'
import type { StudioPlaybackTier } from './playback-tiers'

/** What Auto reads of a song: its tracks, which of them have clips, and its macros. */
export interface StudioSongShape {
  readonly tracks: readonly StudioTrack[]
  readonly clips: readonly Pick<StudioClip, 'trackId'>[]
  readonly mix: Pick<StudioProject['mix'], 'macros'>
  /** Lanes that play a render of their chain (lane-freeze.ts): only their own nodes cost. */
  readonly frozen?: ReadonlySet<string>
}

const FROZEN_CHAIN: ChainSpec = { version: 1, effects: [] }

/** The chains a song's heard lanes play: its audible tracks that have clips. */
export function studioSongChains(song: StudioSongShape): ChainSpec[] {
  const withClips = new Set(song.clips.map((clip) => clip.trackId))
  const solo = song.tracks.some((track) => track.solo)
  return song.tracks
    .filter(
      (track) =>
        withClips.has(track.id) && !track.mute && (!solo || track.solo),
    )
    .map((track) =>
      song.frozen?.has(track.id) === true
        ? FROZEN_CHAIN
        : studioLaneSpec(track, song.mix.macros),
    )
}

/** Lanes an input monitor plays (input-monitor.ts), as a tier's monitor plays them: their chains, and the kinds that tier passes uncut. */
export interface StudioMonitoredLanes {
  readonly chains: readonly ChainSpec[]
  readonly lite: readonly StudioLiteEffect[]
}

const NOTHING_MONITORED: StudioMonitoredLanes = { chains: [], lite: [] }

/** A cost at Best, Balanced and Light, in voice chains. */
type TierCosts = Readonly<Record<StudioPlaybackTier, number>>

const at = (best: number, balanced: number, light: number): TierCosts => ({
  best,
  balanced,
  light,
})

/**
 * Each effect kind on a lane. Light keeps only a dynamic EQ band's
 * lookahead and runs saturation at 2x; Balanced and Light run the exciter
 * and limiter shapers without oversampling (TIER_PROFILES). Reverbs are
 * counted apart (reverbCost). Not measured on a lane: the de-esser, counted
 * as a dynamic EQ band (both split a band off, compress it and add it back),
 * and a limiter added to a lane (a role's own safety limiter is left to the
 * master, so no role lane runs one), counted as a compressor and an exciter.
 */
const EFFECT_COSTS: Readonly<Record<Exclude<EffectKind, 'reverb'>, TierCosts>> =
  {
    gain: at(0, 0, 0),
    eq: at(0.06, 0.06, 0.06),
    tilt: at(0.02, 0.02, 0.02),
    dyneq: at(0.08, 0.08, 0.01),
    deesser: at(0.08, 0.08, 0.01),
    compressor: at(0.06, 0.06, 0.06),
    transient: at(0.13, 0.12, 0.12),
    saturation: at(0.2, 0.2, 0.1),
    exciter: at(0.21, 0.06, 0.05),
    stereo: at(0.05, 0.05, 0.05),
    delay: at(0.08, 0.07, 0.07),
    limiter: at(0.27, 0.12, 0.11),
  }

/** A lane's own nodes: its sources, its two gains, pan and faders. */
const LANE_COST = 0.075
/**
 * A lane chain's stereo hold (chain.ts): its zero delay, and, behind a mono
 * take, every effect before the chain's first stereo one running on two
 * channels instead of one. Measured offline, held and not in turn, on
 * mono takes as the profiling fixtures play them, 3 Nov 2026: 0.006 to
 * 0.107 voice chains a lane over the ten role chains, 0.045 their median;
 * 0.033 to 0.060 a lane over the 12- and 24-lane fixtures at Best and
 * Light. Behind a stereo take the chain ran on two channels already, and
 * the hold costs its delay alone, 0.97 us per 128 frames or 0.006 voice
 * chains, as at the master. The costs above were measured before lanes
 * were held.
 */
export const LANE_HOLD_COST = 0.045
/** The master and the graph around the lanes, offline, and the master chain's hold. */
const MASTER_COST = 0.21 + 0.006
/** What realtime playback adds over an offline render of the same song. */
const REALTIME_COST = 2.6
/** A reverb sending to a shared space: its pre-delay, cuts and send. */
const SEND_COST = 0.035
/** One shared space on the reverb bus. */
const SPACE_COST = 0.22

/** A reverb convolving on its lane: a longer decay is a longer impulse (0.21 at 0.8 s, 0.35 at 2.8 s). */
function reverbCost(decayS: number): number {
  return 0.16 + 0.067 * decayS
}

/** What a song's heard lanes cost at `tier`, in voice chains, master and realtime included. */
export function songCostInVoiceChains(
  chains: readonly ChainSpec[],
  tier: StudioPlaybackTier,
): number {
  let cost = MASTER_COST + REALTIME_COST
  const spaces = new Set<string>()
  for (const chain of chains) {
    // An empty chain is wired straight through, with no hold.
    cost += LANE_COST + (chain.effects.length > 0 ? LANE_HOLD_COST : 0)
    for (const effect of chain.effects) {
      if (effect.kind !== 'reverb') {
        cost += EFFECT_COSTS[effect.kind][tier]
      } else if (tier !== 'best' && effect.params.duck === 0) {
        // On the bus, as reverb.ts builds it: not at Best, never when ducked.
        cost += SEND_COST
        spaces.add(reverbSpace(effect.params.decayS))
      } else {
        cost += reverbCost(effect.params.decayS)
      }
    }
  }
  return cost + spaces.size * SPACE_COST
}

/**
 * Each effect kind on a monitored lane (input-monitor.ts), at the monitor's
 * profile (MONITOR_FX_PROFILE): no shaper oversampled, the compressor,
 * de-esser and dynamic EQ on the zero-latency worklet, the limiter a soft
 * clip and the transient shaper with no lookahead. A reverb convolves on
 * the lane, as at Best: reverbCost, which reads 3 to 9 % over the
 * monitor's own at 0.8, 1.6 and 2.8 s. A kind in the lite list live
 * playback's tier hands the monitor is a wire (MONITOR_WIRE_COST): Light's
 * de-esser and dynamic EQ.
 *
 * Measured offline in headless Chromium 148 on the desktop the table above
 * came from, 17 Nov 2026 (studio-monitor-browser-probes.mjs `cost`, its
 * `voiceChains`): twelve lanes monitored on one input, each kind alone at
 * its defaults against a gain alone, plus that gain, in voice chains of
 * each run's own benchmark (163.5 to 173.3 us), the median of five runs.
 * They add up to each role's whole lane monitored, measured alongside,
 * within -3.4 to +5.5 % (song-load.test.ts).
 */
const MONITOR_EFFECT_COSTS: Readonly<
  Record<Exclude<EffectKind, 'reverb'>, number>
> = {
  gain: 0.008,
  eq: 0.054,
  tilt: 0.011,
  dyneq: 0.076,
  deesser: 0.091,
  compressor: 0.061,
  transient: 0.186,
  saturation: 0.032,
  exciter: 0.046,
  stereo: 0.039,
  delay: 0.082,
  limiter: 0.028,
}
/** A kind the monitor passes uncut (`lite`): a wire in the effect's place. */
const MONITOR_WIRE_COST = 0.005
/** A monitor's own nodes: its fold, spread, faders and level. */
const MONITOR_LANE_COST = 0.014
/** A monitored chain's stereo hold: its zero delay, on the two channels the monitor spreads the input to. */
const MONITOR_HOLD_COST = 0.005
/** The monitor's master stage (monitor-master.ts): a new song's master at the monitor's profile, once however many lanes play through it. */
const MONITOR_MASTER_COST = 0.217

/**
 * What monitored lanes cost while their monitors play, in voice chains:
 * each lane's path and its chain at the monitor's profile, the kinds in
 * `lite` passed uncut, and the master stage they share.
 */
export function monitorCostInVoiceChains(
  chains: readonly ChainSpec[],
  lite: readonly StudioLiteEffect[],
): number {
  if (chains.length === 0) return 0
  let cost = MONITOR_MASTER_COST
  for (const chain of chains) {
    cost +=
      MONITOR_LANE_COST + (chain.effects.length > 0 ? MONITOR_HOLD_COST : 0)
    for (const effect of chain.effects) {
      if (effect.kind === 'reverb') cost += reverbCost(effect.params.decayS)
      else if ((lite as readonly EffectKind[]).includes(effect.kind))
        cost += MONITOR_WIRE_COST
      else cost += MONITOR_EFFECT_COSTS[effect.kind]
    }
  }
  return cost
}

/** A 128-frame quantum at 48 kHz, in microseconds: the audio thread's budget for one. */
const QUANTUM_US = (128 / 48000) * 1e6

/**
 * The share of the audio thread a song's heard lanes need at `tier` on a
 * device whose voice chain renders in `voiceChainUs` per 128 frames, and
 * the monitored lanes on top as that tier's monitor plays them (its `lite`).
 */
export function songLoad(
  chains: readonly ChainSpec[],
  tier: StudioPlaybackTier,
  voiceChainUs: number,
  monitored: StudioMonitoredLanes = NOTHING_MONITORED,
): number {
  const cost =
    songCostInVoiceChains(chains, tier) +
    monitorCostInVoiceChains(monitored.chains, monitored.lite)
  return (cost * voiceChainUs) / QUANTUM_US
}
