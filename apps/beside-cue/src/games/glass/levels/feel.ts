// ============================================================
// applyFeel — per-level difficulty as data.
//
// LevelDef.feel is a deep-partial JOURNEY_CONFIG overlay ("wide bands,
// long sink grace" on a first song; "tight bands, real voids" on a hard
// one). Merging happens once when a stage builds; the engine then reads
// one merged config, so nothing in the tick knows overlays exist.
// Sections a level does not touch are shared by reference — the overlay
// never mutates the defaults.
// ============================================================

import type { JourneyConfig } from '../journey-config'
import { JOURNEY_CONFIG } from '../journey-config'

type Widen<T> = T extends number
  ? number
  : T extends string
    ? string
    : T extends boolean
      ? boolean
      : T
type WidenDeep<T> = T extends readonly (infer E)[]
  ? readonly WidenDeep<E>[]
  : T extends object
    ? { readonly [K in keyof T]: WidenDeep<T[K]> }
    : Widen<T>
type PartialDeep<T> = T extends readonly (infer E)[]
  ? readonly WidenDeep<E>[]
  : T extends object
    ? { readonly [K in keyof T]?: PartialDeep<T[K]> }
    : Widen<T>

/** `typeof JOURNEY_CONFIG` with its literal leaves widened — the type a
 * MERGED config has (a level may set any number, not just the default). */
export type GameFeel = WidenDeep<JourneyConfig>

/** What a level may declare: any subset of the config tree. Arrays
 * (bridge steps, boss crystals) replace wholesale, never merge. */
export type FeelOverlay = PartialDeep<JourneyConfig>

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const mergeDeep = (
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(over)) {
    const b = base[k]
    out[k] = isRecord(b) && isRecord(v) ? mergeDeep(b, v) : v
  }
  return out
}

export const applyFeel = (feel?: FeelOverlay): GameFeel =>
  feel === undefined
    ? JOURNEY_CONFIG
    : (mergeDeep(
        JOURNEY_CONFIG as unknown as Record<string, unknown>,
        feel as unknown as Record<string, unknown>,
      ) as unknown as GameFeel)
