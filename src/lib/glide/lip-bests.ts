// ============================================================
// Lip roll bests: the best run at each level, and two tables as one
// ============================================================
//
// One best per level, keyed by the tier id (LIP_ROLL_LEVELS), as Ng
// slides keeps its own (ng-bests.ts): the levels ride at different speeds
// and judge a different band. A best is the share of the bay lit, as the
// result's big number shows it (whole per cent); fewer jumps break a tie.
// The row has Ng's shape (its `arches` are the waves lit, of three), so
// the checks, the ordering and the settings pull's merge are Ng's own; only
// the key differs.
//
// Here in lib, not in the room, because the settings sync (src/db) names
// the merge, and a build without the premium exercises folds the key and
// the merge away with it.

import type { NgBest, NgBestTable } from './ng-bests'
import { isNgBestTable, mergeNgBestsOnPull, ngBeats } from './ng-bests'

/** Where the table lives, and the settings row it syncs as. */
export const LIP_BESTS_KEY = 'pitchperfect_lip_roll_bests'

/** A level's best: lit per cent, waves lit (of three), jumps, when. */
export type LipBest = NgBest
export type LipBestTable = NgBestTable

export const isLipBestTable = isNgBestTable
/** Whether `run` beats `previous`: more of the bay lit, or as much with fewer jumps. */
export const lipBeats = ngBeats
/** The settings pull's resolver (MERGE_ON_PULL), as Ng slides'. */
export const mergeLipBestsOnPull = mergeNgBestsOnPull
