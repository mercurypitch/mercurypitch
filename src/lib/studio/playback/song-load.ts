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
// for each space it uses once.
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
import { reverbSpace } from '@/lib/studio-fx/fx-profile'
import { studioLaneSpec } from '../model/arrangement-plan'
import type { StudioClip, StudioProject, StudioTrack } from '../model/types'
import type { StudioPlaybackTier } from './playback-tiers'

/** What Auto reads of a song: its tracks, which of them have clips, and its macros. */
export interface StudioSongShape {
  readonly tracks: readonly StudioTrack[]
  readonly clips: readonly Pick<StudioClip, 'trackId'>[]
  readonly mix: Pick<StudioProject['mix'], 'macros'>
}

/** The chains a song's heard lanes play: its audible tracks that have clips. */
export function studioSongChains(song: StudioSongShape): ChainSpec[] {
  const withClips = new Set(song.clips.map((clip) => clip.trackId))
  const solo = song.tracks.some((track) => track.solo)
  return song.tracks
    .filter(
      (track) =>
        withClips.has(track.id) && !track.mute && (!solo || track.solo),
    )
    .map((track) => studioLaneSpec(track, song.mix.macros))
}

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
/** The master and the graph around the lanes, offline. */
const MASTER_COST = 0.21
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
    cost += LANE_COST
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

/** A 128-frame quantum at 48 kHz, in microseconds: the audio thread's budget for one. */
const QUANTUM_US = (128 / 48000) * 1e6

/**
 * The share of the audio thread a song's heard lanes need at `tier` on a
 * device whose voice chain renders in `voiceChainUs` per 128 frames.
 */
export function songLoad(
  chains: readonly ChainSpec[],
  tier: StudioPlaybackTier,
  voiceChainUs: number,
): number {
  return (songCostInVoiceChains(chains, tier) * voiceChainUs) / QUANTUM_US
}
