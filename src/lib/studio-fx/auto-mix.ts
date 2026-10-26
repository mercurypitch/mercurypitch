// ============================================================
// Auto mix — a finished-sounding chain for every track, with no controls moved
// ============================================================
//
// For somebody who has never touched a compressor, every track should come
// out sounding produced. This follows the logic of fx-lab's vocal front end,
// "normalize first, then fixed thresholds": each clip is measured (BS.1770)
// and its chain opens with the gain that brings it to REFERENCE_LUFS, so every
// threshold after it was voiced for one level and a whisper and a belt get the
// same treatment.
//
// A track's chain is then:
//
//   level-match -> the role's chain (role-chains.ts) -> tone -> balance
//
// `tone` is a flat tilt that the Tone macro moves; `balance` places the role
// against the lead vocal (ROLE_BALANCE_DB) plus the track's own level. The
// beginner macros (mix-macros.ts) move values inside this chain without
// changing its shape, and the master (master.ts) finishes the song.
//
// A role chain changes loudness on its own — a low cut and a mud cut take
// level out, compression with makeup puts some back — and by how much depends
// on the material. `autoMixTrack` therefore renders the clip through its chain
// once, measures the result and folds a trim into the balance stage, so every
// track lands exactly where its role belongs in the balance.

import type { ChainSpec } from './chain-spec'
import { normalizeChainSpec } from './chain-spec'
import { clamp } from './dsp'
import type { SampledAudio } from './loudness'
import { measureLoudness } from './loudness'
import type { MixMacros } from './mix-macros'
import { applyMixMacros, TONE_STAGE_ID } from './mix-macros'
import type { RenderThroughChainOptions } from './render'
import { renderThroughChain } from './render'
import type { TrackRole } from './role-chains'
import { ROLE_BALANCE_DB, roleTemplate } from './role-chains'

/** Every role chain is voiced for a clip at this loudness (fx-lab's front-end reference). */
export const REFERENCE_LUFS = -18

const MIN_LEVEL_MATCH_DB = -24
/** Past +36 dB a chain only raises the hiss of a near-silent take. */
const MAX_LEVEL_MATCH_DB = 36

/** The gain that brings a clip measured at `measuredLufs` to the reference. */
export function levelMatchGainDb(
  measuredLufs: number,
  referenceLufs: number = REFERENCE_LUFS,
): number {
  if (!Number.isFinite(measuredLufs)) return 0
  return clamp(
    referenceLufs - measuredLufs,
    MIN_LEVEL_MATCH_DB,
    MAX_LEVEL_MATCH_DB,
  )
}

export interface RoleChainOptions {
  /** The clip's integrated loudness; sets the level-match gain. */
  readonly measuredLufs?: number
  /** The song's tempo; sets tempo-aware times such as echoes and pre-delay. */
  readonly bpm?: number
  /** Beginner macros; the chain as voiced when left out. */
  readonly macros?: MixMacros
  /** The track's own level against its role's balance, in dB. */
  readonly levelDb?: number
  /** The post-chain correction `autoMixTrack` measured, in dB. */
  readonly trimDb?: number
}

/** The auto-mix chain for a track role, level-matched when the loudness is known. */
export function roleChain(
  role: TrackRole,
  options: RoleChainOptions = {},
): ChainSpec {
  const levelMatch =
    options.measuredLufs === undefined
      ? 0
      : levelMatchGainDb(options.measuredLufs)
  const spec = normalizeChainSpec({
    effects: [
      { id: 'level-match', kind: 'gain', params: { gainDb: levelMatch } },
      ...roleTemplate(role, { bpm: options.bpm }),
      { id: TONE_STAGE_ID, kind: 'tilt', params: {} },
      {
        id: 'balance',
        kind: 'gain',
        params: {
          gainDb:
            ROLE_BALANCE_DB[role] +
            (options.levelDb ?? 0) +
            (options.trimDb ?? 0),
        },
      },
    ],
  })
  return options.macros === undefined
    ? spec
    : applyMixMacros(spec, options.macros)
}

/** Measure a clip and return its role's chain, level-matched to it. */
export function autoMixChain(
  role: TrackRole,
  audio: SampledAudio,
  options: Omit<RoleChainOptions, 'measuredLufs'> = {},
): ChainSpec {
  return roleChain(role, {
    ...options,
    measuredLufs: measureLoudness(audio).integratedLufs,
  })
}

/** Past this a trim is hiding a problem, not correcting a chain. */
const MAX_TRIM_DB = 12

/**
 * The trim that lands a processed track at its role's place in the balance,
 * REFERENCE_LUFS + ROLE_BALANCE_DB[role], whatever its chain's EQ and
 * compression did to its loudness.
 */
export function balanceTrimDb(role: TrackRole, processedLufs: number): number {
  if (!Number.isFinite(processedLufs)) return 0
  return clamp(
    REFERENCE_LUFS + ROLE_BALANCE_DB[role] - processedLufs,
    -MAX_TRIM_DB,
    MAX_TRIM_DB,
  )
}

export interface AutoMixedTrack {
  readonly role: TrackRole
  /** The clip's loudness as recorded. */
  readonly measuredLufs: number
  /** The post-chain correction folded into the balance stage. */
  readonly trimDb: number
  /** The finished chain: level match, role chain, trim, macros and level. */
  readonly spec: ChainSpec
  /**
   * The clip through its chain as voiced (no trim, macros or level), tail
   * included and latency-compensated: scaled by the trim, it is the track's
   * contribution to a neutral mixdown, so nothing has to render it twice.
   */
  readonly processed: AudioBuffer
}

/**
 * Auto-mix one track: measure it, render it through its role chain as voiced
 * (one offline pass), and trim the chain so the result sits at its role's
 * balance. Macros and the track's own level are applied on top afterwards,
 * so moving them is heard as a change rather than corrected away.
 */
export async function autoMixTrack(
  role: TrackRole,
  clip: AudioBuffer,
  options: Omit<RoleChainOptions, 'measuredLufs' | 'trimDb'> &
    Pick<RenderThroughChainOptions, 'createContext'> = {},
): Promise<AutoMixedTrack> {
  const measuredLufs = measureLoudness(clip).integratedLufs
  const voiced = roleChain(role, { measuredLufs, bpm: options.bpm })
  const processed = await renderThroughChain(clip, voiced, {
    createContext: options.createContext,
  })
  const trimDb = balanceTrimDb(role, measureLoudness(processed).integratedLufs)
  return {
    role,
    measuredLufs,
    trimDb,
    processed,
    spec: roleChain(role, {
      bpm: options.bpm,
      macros: options.macros,
      levelDb: options.levelDb,
      measuredLufs,
      trimDb,
    }),
  }
}
