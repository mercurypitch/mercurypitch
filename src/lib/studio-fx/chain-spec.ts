// ============================================================
// Studio FX chain spec — the serialisable description of an insert chain
// ============================================================
//
// A chain spec is plain data: it is what a preset holds, what gets saved with
// a project and what a share link carries. Everything that reads one goes
// through `normalizeChainSpec` first, so the audio graph only ever sees known
// effect kinds, unique ids and in-range parameter values. The edit helpers are
// pure and return a new spec, so UI state can hold the spec and hand each new
// version to the engine.

import type { EffectKind, EffectParams } from './effect-definitions'
import { isEffectKind, paramDescriptors } from './effect-definitions'

export const CHAIN_SPEC_VERSION = 1
export const MAX_CHAIN_EFFECTS = 16

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export interface EffectSpecOf<K extends EffectKind> {
  readonly id: string
  readonly kind: K
  readonly enabled: boolean
  readonly params: EffectParams<K>
}

export type EffectSpec = { [K in EffectKind]: EffectSpecOf<K> }[EffectKind]

export interface ChainSpec {
  readonly version: typeof CHAIN_SPEC_VERSION
  readonly effects: readonly EffectSpec[]
}

export type ParamValues = Readonly<Record<string, number>>

export const EMPTY_CHAIN: ChainSpec = {
  version: CHAIN_SPEC_VERSION,
  effects: [],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Every parameter of `kind`, taken from `raw` when it is a finite number. */
export function normalizeEffectParams<K extends EffectKind>(
  kind: K,
  raw: unknown,
): EffectParams<K> {
  const source = isRecord(raw) ? raw : {}
  const params: Record<string, number> = {}
  for (const descriptor of paramDescriptors(kind)) {
    const value = source[descriptor.key]
    params[descriptor.key] =
      typeof value === 'number' && Number.isFinite(value)
        ? clamp(value, descriptor.min, descriptor.max)
        : descriptor.defaultValue
  }
  return params as EffectParams<K>
}

export function defaultEffectParams<K extends EffectKind>(
  kind: K,
): EffectParams<K> {
  return normalizeEffectParams(kind, undefined)
}

function uniqueId(
  candidate: unknown,
  kind: EffectKind,
  taken: ReadonlySet<string>,
): string {
  if (
    typeof candidate === 'string' &&
    ID_PATTERN.test(candidate) &&
    !taken.has(candidate)
  ) {
    return candidate
  }
  if (!taken.has(kind)) return kind
  let suffix = 2
  while (taken.has(`${kind}-${suffix}`)) suffix += 1
  return `${kind}-${suffix}`
}

function normalizeEffect(
  raw: unknown,
  taken: ReadonlySet<string>,
): EffectSpec | null {
  if (!isRecord(raw) || !isEffectKind(raw.kind)) return null
  const kind = raw.kind
  return {
    id: uniqueId(raw.id, kind, taken),
    kind,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    params: normalizeEffectParams(kind, raw.params),
  } as EffectSpec
}

/**
 * Turn anything — a stored project, a share link, a preset — into a chain the
 * engine can build. Unknown effects are dropped, ids made unique, missing or
 * out-of-range parameters replaced or clamped, and the chain capped at
 * `MAX_CHAIN_EFFECTS`.
 */
export function normalizeChainSpec(input: unknown): ChainSpec {
  const rawEffects =
    isRecord(input) && Array.isArray(input.effects) ? input.effects : []
  const taken = new Set<string>()
  const effects: EffectSpec[] = []
  for (const raw of rawEffects) {
    if (effects.length >= MAX_CHAIN_EFFECTS) break
    const effect = normalizeEffect(raw, taken)
    if (effect === null) continue
    taken.add(effect.id)
    effects.push(effect)
  }
  return { version: CHAIN_SPEC_VERSION, effects }
}

/** A new effect with default parameters and an id unused in `chain`. */
export function createEffectSpec<K extends EffectKind>(
  kind: K,
  chain: ChainSpec = EMPTY_CHAIN,
  params: Partial<Record<string, number>> = {},
): EffectSpecOf<K> {
  const taken = new Set(chain.effects.map((effect) => effect.id))
  return {
    id: uniqueId(undefined, kind, taken),
    kind,
    enabled: true,
    params: normalizeEffectParams(kind, params),
  }
}

export function insertEffect(
  chain: ChainSpec,
  effect: EffectSpec,
  index: number = chain.effects.length,
): ChainSpec {
  const effects = [...chain.effects]
  effects.splice(clamp(Math.round(index), 0, effects.length), 0, effect)
  return normalizeChainSpec({ effects })
}

export function removeEffect(chain: ChainSpec, id: string): ChainSpec {
  return {
    version: CHAIN_SPEC_VERSION,
    effects: chain.effects.filter((effect) => effect.id !== id),
  }
}

export function moveEffect(
  chain: ChainSpec,
  id: string,
  toIndex: number,
): ChainSpec {
  const from = chain.effects.findIndex((effect) => effect.id === id)
  if (from < 0) return chain
  const effects = [...chain.effects]
  const [moved] = effects.splice(from, 1)
  effects.splice(clamp(Math.round(toIndex), 0, effects.length), 0, moved)
  return { version: CHAIN_SPEC_VERSION, effects }
}

export function updateEffect(
  chain: ChainSpec,
  id: string,
  change: { readonly enabled?: boolean; readonly params?: ParamValues },
): ChainSpec {
  return {
    version: CHAIN_SPEC_VERSION,
    effects: chain.effects.map((effect) =>
      effect.id === id ? withChange(effect, change) : effect,
    ),
  }
}

function withChange(
  effect: EffectSpec,
  change: { readonly enabled?: boolean; readonly params?: ParamValues },
): EffectSpec {
  return {
    ...effect,
    enabled: change.enabled ?? effect.enabled,
    params: normalizeEffectParams(effect.kind, {
      ...effect.params,
      ...change.params,
    }),
  } as EffectSpec
}
