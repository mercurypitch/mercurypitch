// ============================================================
// Drum project persistence — bounded First Pocket snapshots
// ============================================================
//
// A saved project contains only portable authored state. Catalogue evidence is
// reconstructed from the bundled First Pocket source; undo history, view state,
// devices, rooms, kits, media and live performance evidence never cross this
// boundary.

import type { EditableDrumGrooveHit, EditableDrumGrooveState, } from '@/features/drum-night/groove/groove-editor'
import { createEditableDrumGroove, DRUM_GROOVE_STEPS_PER_BAR, MAX_DRUM_GROOVE_HITS, } from '@/features/drum-night/groove/groove-editor'
import type { DrumKitAuthoredFamily } from '@/features/drum-night/runtime/drum-pad-layout'
import { DRUM_KIT_AUTHORED_FAMILIES } from '@/features/drum-night/runtime/drum-pad-layout'
import type { DrumLoopRange } from '@/features/drum-night/runtime/drum-transport'
import { DRUM_LOOP_MINIMUM_LENGTH_BEATS, DRUM_TEMPO_MAX_BPM, DRUM_TEMPO_MIN_BPM, } from '@/features/drum-night/runtime/drum-transport'
import { drumScoreVoiceForGmKey } from '@/features/drum-night/session/drum-score'
import type { FirstPocketVariantId } from '@/features/drum-night/session/prepared-grooves'
import { createFirstPocketGroove, FIRST_POCKET_VARIANTS, } from '@/features/drum-night/session/prepared-grooves'
import { normalizeGeneralMidiPercussionKey } from '@/lib/percussion'

export const DRUM_PROJECT_SCHEMA_VERSION = 1
export const DRUM_PROJECT_LIMIT = 32
export const DRUM_PROJECT_MAX_BYTES = 256 * 1024
export const FIRST_POCKET_CATALOG_REVISION = 1
export const DRUM_PROJECT_SOURCE_KIND = 'prepared-first-pocket' as const
export const DRUM_PROJECT_SOURCE_REF = 'first-pocket:1' as const

const PROJECT_ID_MAX_LENGTH = 128
const PROJECT_TITLE_MAX_CODE_POINTS = 80
const HIT_ID_MAX_LENGTH = 192
const TRACK_ID_MAX_LENGTH = 128
const MAX_CREATED_ORDINAL = 1_000_000
const MAX_WRITTEN_DURATION_BEATS = 8
const STEP_BEATS = 0.25

export type DrumProjectCountInBeats = 0 | 4

export interface DrumProjectSource {
  readonly kind: typeof DRUM_PROJECT_SOURCE_KIND
  readonly catalogRevision: typeof FIRST_POCKET_CATALOG_REVISION
}

export interface DrumProjectFamilyMixValue {
  readonly level: number
  readonly muted: boolean
}

export type DrumProjectFamilyMix = Readonly<
  Record<DrumKitAuthoredFamily, DrumProjectFamilyMixValue>
>

export type DrumProjectHitOrigin =
  | { readonly kind: 'source' }
  | { readonly kind: 'editor'; readonly createdOrdinal: number }

export interface DrumProjectHit {
  readonly id: string
  readonly trackId: string
  readonly gmKey: number
  readonly velocity: number
  readonly writtenDuration: number | null
  readonly stepIndex: number
  readonly offsetBeats: number
  readonly origin: DrumProjectHitOrigin
}

export interface DrumProjectGroove {
  readonly barCount: 1 | 2
  readonly revision: number
  readonly swing: number
  readonly density: number
  readonly nextCreatedOrdinal: number
  readonly hits: readonly DrumProjectHit[]
}

export interface DrumProject {
  readonly schemaVersion: typeof DRUM_PROJECT_SCHEMA_VERSION
  readonly id: string
  readonly title: string
  readonly revision: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly source: DrumProjectSource
  readonly selectedVariantId: FirstPocketVariantId
  readonly variants: Readonly<Record<FirstPocketVariantId, DrumProjectGroove>>
  readonly authoredFamilyMix: DrumProjectFamilyMix
  readonly tempoBpm: number
  readonly countInBeats: DrumProjectCountInBeats
  readonly clickEnabled: boolean
  readonly loopRange: DrumLoopRange | null
}

export interface DrumProjectSerializationInput {
  readonly id: string
  readonly title: string
  readonly revision: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly selectedVariantId: FirstPocketVariantId
  readonly drafts: Readonly<
    Record<FirstPocketVariantId, EditableDrumGrooveState>
  >
  readonly authoredFamilyMix: DrumProjectFamilyMix
  readonly tempoBpm: number
  readonly countInBeats: DrumProjectCountInBeats
  readonly clickEnabled: boolean
  readonly loopRange: DrumLoopRange | null
}

export interface HydratedDrumProject {
  readonly project: DrumProject
  readonly drafts: Readonly<
    Record<FirstPocketVariantId, EditableDrumGrooveState>
  >
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every((key) => key in value)
}

function isBoundedString(
  value: unknown,
  maxLength: number,
  trim = false,
): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    (!trim || value.trim() === value)
  )
}

function isProjectTitle(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0 &&
    [...value].length <= PROJECT_TITLE_MAX_CODE_POINTS
  )
}

function isSafeCount(
  value: unknown,
  maximum = Number.MAX_SAFE_INTEGER,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maximum
  )
}

function isFiniteBetween(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  )
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    return new Date(value).toISOString() === value
  } catch {
    return false
  }
}

function jsonByteLength(value: unknown): number | null {
  try {
    const json = JSON.stringify(value)
    return typeof json === 'string'
      ? new TextEncoder().encode(json).byteLength
      : null
  } catch {
    return null
  }
}

function isVariantId(value: unknown): value is FirstPocketVariantId {
  return FIRST_POCKET_VARIANTS.some((variant) => variant.id === value)
}

function readOrigin(value: unknown): DrumProjectHitOrigin | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null
  if (value.kind === 'source' && hasExactKeys(value, ['kind'])) {
    return Object.freeze({ kind: 'source' })
  }
  if (
    value.kind === 'editor' &&
    hasExactKeys(value, ['kind', 'createdOrdinal']) &&
    isSafeCount(value.createdOrdinal, MAX_CREATED_ORDINAL) &&
    value.createdOrdinal > 0
  ) {
    return Object.freeze({
      kind: 'editor',
      createdOrdinal: value.createdOrdinal,
    })
  }
  return null
}

function readHit(value: unknown, stepCount: number): DrumProjectHit | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'id',
      'trackId',
      'gmKey',
      'velocity',
      'writtenDuration',
      'stepIndex',
      'offsetBeats',
      'origin',
    ]) ||
    !isBoundedString(value.id, HIT_ID_MAX_LENGTH) ||
    !isBoundedString(value.trackId, TRACK_ID_MAX_LENGTH) ||
    typeof value.gmKey !== 'number' ||
    !Number.isInteger(value.gmKey) ||
    normalizeGeneralMidiPercussionKey(value.gmKey) === null ||
    typeof value.velocity !== 'number' ||
    !Number.isInteger(value.velocity) ||
    value.velocity < 1 ||
    value.velocity > 127 ||
    !(
      value.writtenDuration === null ||
      isFiniteBetween(value.writtenDuration, 0, MAX_WRITTEN_DURATION_BEATS)
    ) ||
    value.writtenDuration === 0 ||
    !isSafeCount(value.stepIndex, stepCount - 1) ||
    !isFiniteBetween(value.offsetBeats, -STEP_BEATS, STEP_BEATS) ||
    value.offsetBeats === STEP_BEATS
  ) {
    return null
  }
  const origin = readOrigin(value.origin)
  if (origin === null) return null
  const authoredBeat = value.stepIndex * STEP_BEATS + value.offsetBeats
  if (authoredBeat < 0 || authoredBeat >= stepCount * STEP_BEATS) return null
  if (
    origin.kind === 'editor' &&
    value.id !== `editor:${String(origin.createdOrdinal).padStart(4, '0')}`
  ) {
    return null
  }
  return Object.freeze({
    id: value.id,
    trackId: value.trackId,
    gmKey: value.gmKey,
    velocity: value.velocity,
    writtenDuration: value.writtenDuration,
    stepIndex: value.stepIndex,
    offsetBeats: value.offsetBeats,
    origin,
  })
}

function readGroove(value: unknown): DrumProjectGroove | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'barCount',
      'revision',
      'swing',
      'density',
      'nextCreatedOrdinal',
      'hits',
    ]) ||
    (value.barCount !== 1 && value.barCount !== 2) ||
    !isSafeCount(value.revision) ||
    !isFiniteBetween(value.swing, 0, 1) ||
    !isFiniteBetween(value.density, 0, 1) ||
    !isSafeCount(value.nextCreatedOrdinal, MAX_CREATED_ORDINAL) ||
    value.nextCreatedOrdinal < 1 ||
    !Array.isArray(value.hits) ||
    value.hits.length > MAX_DRUM_GROOVE_HITS
  ) {
    return null
  }
  const stepCount = value.barCount * DRUM_GROOVE_STEPS_PER_BAR
  const hits = value.hits.map((hit) => readHit(hit, stepCount))
  if (hits.some((hit) => hit === null)) return null
  const validHits = hits as DrumProjectHit[]
  if (new Set(validHits.map((hit) => hit.id)).size !== validHits.length) {
    return null
  }
  const editorOrdinals = validHits.flatMap((hit) =>
    hit.origin.kind === 'editor' ? [hit.origin.createdOrdinal] : [],
  )
  const nextCreatedOrdinal = value.nextCreatedOrdinal
  if (
    new Set(editorOrdinals).size !== editorOrdinals.length ||
    editorOrdinals.some((ordinal) => ordinal >= nextCreatedOrdinal)
  ) {
    return null
  }
  const orderedHits = Object.freeze(
    [...validHits].sort(
      (left, right) =>
        left.stepIndex - right.stepIndex ||
        left.offsetBeats - right.offsetBeats ||
        left.trackId.localeCompare(right.trackId) ||
        left.gmKey - right.gmKey ||
        left.id.localeCompare(right.id),
    ),
  )
  return Object.freeze({
    barCount: value.barCount,
    revision: value.revision,
    swing: value.swing,
    density: value.density,
    nextCreatedOrdinal,
    hits: orderedHits,
  })
}

function readFamilyMix(value: unknown): DrumProjectFamilyMix | null {
  if (!isRecord(value) || !hasExactKeys(value, DRUM_KIT_AUTHORED_FAMILIES)) {
    return null
  }
  const entries: Array<
    readonly [DrumKitAuthoredFamily, DrumProjectFamilyMixValue]
  > = []
  for (const family of DRUM_KIT_AUTHORED_FAMILIES) {
    const candidate = value[family]
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, ['level', 'muted']) ||
      !isFiniteBetween(candidate.level, 0, 1) ||
      typeof candidate.muted !== 'boolean'
    ) {
      return null
    }
    entries.push([
      family,
      Object.freeze({ level: candidate.level, muted: candidate.muted }),
    ])
  }
  return Object.freeze(Object.fromEntries(entries) as DrumProjectFamilyMix)
}

function readLoopRange(
  value: unknown,
  durationBeats: number,
): DrumLoopRange | null | undefined {
  if (value === null) return null
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['startBeat', 'endBeat']) ||
    !isFiniteBetween(value.startBeat, 0, durationBeats) ||
    !isFiniteBetween(value.endBeat, 0, durationBeats) ||
    value.endBeat - value.startBeat < DRUM_LOOP_MINIMUM_LENGTH_BEATS ||
    !Number.isInteger(value.startBeat / STEP_BEATS) ||
    !Number.isInteger(value.endBeat / STEP_BEATS)
  ) {
    return undefined
  }
  return Object.freeze({
    startBeat: value.startBeat,
    endBeat: value.endBeat,
  })
}

function editableHitFromProjectHit(
  hit: DrumProjectHit,
  base: EditableDrumGrooveState,
): EditableDrumGrooveHit {
  if (hit.origin.kind === 'source') {
    const sourceHit = base.sourceHits.find(
      (candidate) => candidate.id === hit.id,
    )
    if (
      sourceHit === undefined ||
      sourceHit.trackId !== hit.trackId ||
      sourceHit.gmKey !== hit.gmKey ||
      sourceHit.velocity !== hit.velocity ||
      sourceHit.writtenDuration !== hit.writtenDuration
    ) {
      throw new Error(
        'Saved source hit does not match the First Pocket catalogue.',
      )
    }
    return Object.freeze({
      ...sourceHit,
      stepIndex: hit.stepIndex,
      offsetBeats: hit.offsetBeats,
    })
  }
  if (!base.trackIds.includes(hit.trackId)) {
    throw new Error(
      'Saved editor hit references an unknown First Pocket track.',
    )
  }
  return Object.freeze({
    ...hit,
    family: drumScoreVoiceForGmKey(hit.gmKey).family,
    origin: Object.freeze({ ...hit.origin }),
  })
}

function hydrateGroove(
  variantId: FirstPocketVariantId,
  groove: DrumProjectGroove,
): EditableDrumGrooveState {
  const base = createEditableDrumGroove(
    createFirstPocketGroove(variantId).document,
    { barCount: groove.barCount },
  )
  const hits = Object.freeze(
    groove.hits.map((hit) => editableHitFromProjectHit(hit, base)),
  )
  const occupied = new Set<string>()
  for (const hit of hits) {
    const key = `${hit.trackId}\u0000${hit.gmKey}\u0000${hit.stepIndex}`
    if (occupied.has(key)) {
      throw new Error(
        'Saved groove contains two hits in one articulation cell.',
      )
    }
    occupied.add(key)
  }
  return Object.freeze({
    ...base,
    hits,
    swing: groove.swing,
    density: groove.density,
    nextCreatedOrdinal: groove.nextCreatedOrdinal,
    revision: groove.revision,
    undoDepth: 0,
    undoHistory: Object.freeze([]),
  })
}

function readProject(value: unknown): DrumProject | null {
  if (
    jsonByteLength(value) === null ||
    (jsonByteLength(value) ?? Infinity) > DRUM_PROJECT_MAX_BYTES ||
    !isRecord(value) ||
    !hasExactKeys(value, [
      'schemaVersion',
      'id',
      'title',
      'revision',
      'createdAt',
      'updatedAt',
      'source',
      'selectedVariantId',
      'variants',
      'authoredFamilyMix',
      'tempoBpm',
      'countInBeats',
      'clickEnabled',
      'loopRange',
    ]) ||
    value.schemaVersion !== DRUM_PROJECT_SCHEMA_VERSION ||
    !isBoundedString(value.id, PROJECT_ID_MAX_LENGTH) ||
    !isProjectTitle(value.title) ||
    !isSafeCount(value.revision) ||
    !isIsoTimestamp(value.createdAt) ||
    !isIsoTimestamp(value.updatedAt) ||
    value.updatedAt < value.createdAt ||
    !isRecord(value.source) ||
    !hasExactKeys(value.source, ['kind', 'catalogRevision']) ||
    value.source.kind !== DRUM_PROJECT_SOURCE_KIND ||
    value.source.catalogRevision !== FIRST_POCKET_CATALOG_REVISION ||
    !isVariantId(value.selectedVariantId) ||
    !isRecord(value.variants) ||
    !hasExactKeys(
      value.variants,
      FIRST_POCKET_VARIANTS.map((variant) => variant.id),
    ) ||
    !isFiniteBetween(value.tempoBpm, DRUM_TEMPO_MIN_BPM, DRUM_TEMPO_MAX_BPM) ||
    (value.countInBeats !== 0 && value.countInBeats !== 4) ||
    typeof value.clickEnabled !== 'boolean'
  ) {
    return null
  }

  const variantValues = value.variants
  const variants = Object.fromEntries(
    FIRST_POCKET_VARIANTS.map((variant) => [
      variant.id,
      readGroove(variantValues[variant.id]),
    ]),
  ) as Record<FirstPocketVariantId, DrumProjectGroove | null>
  if (Object.values(variants).some((groove) => groove === null)) return null
  const validVariants = variants as Record<
    FirstPocketVariantId,
    DrumProjectGroove
  >
  const authoredFamilyMix = readFamilyMix(value.authoredFamilyMix)
  if (authoredFamilyMix === null) return null
  const selectedDuration = validVariants[value.selectedVariantId].barCount * 4
  const loopRange = readLoopRange(value.loopRange, selectedDuration)
  if (loopRange === undefined) return null

  try {
    for (const variant of FIRST_POCKET_VARIANTS) {
      hydrateGroove(variant.id, validVariants[variant.id])
    }
  } catch {
    return null
  }

  return Object.freeze({
    schemaVersion: DRUM_PROJECT_SCHEMA_VERSION,
    id: value.id,
    title: value.title,
    revision: value.revision,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    source: Object.freeze({
      kind: DRUM_PROJECT_SOURCE_KIND,
      catalogRevision: FIRST_POCKET_CATALOG_REVISION,
    }),
    selectedVariantId: value.selectedVariantId,
    variants: Object.freeze(validVariants),
    authoredFamilyMix,
    tempoBpm: value.tempoBpm,
    countInBeats: value.countInBeats,
    clickEnabled: value.clickEnabled,
    loopRange,
  })
}

function serializeHit(hit: EditableDrumGrooveHit): DrumProjectHit {
  return Object.freeze({
    id: hit.id,
    trackId: hit.trackId,
    gmKey: hit.gmKey,
    velocity: hit.velocity,
    writtenDuration: hit.writtenDuration,
    stepIndex: hit.stepIndex,
    offsetBeats: hit.offsetBeats,
    origin:
      hit.origin.kind === 'source'
        ? Object.freeze({ kind: 'source' as const })
        : Object.freeze({
            kind: 'editor' as const,
            createdOrdinal: hit.origin.createdOrdinal,
          }),
  })
}

function serializeGroove(state: EditableDrumGrooveState): DrumProjectGroove {
  return Object.freeze({
    barCount: state.barCount,
    revision: state.revision,
    swing: state.swing,
    density: state.density,
    nextCreatedOrdinal: state.nextCreatedOrdinal,
    hits: Object.freeze(state.hits.map(serializeHit)),
  })
}

/** Validate, canonicalize and deeply freeze one untrusted project payload. */
export function validateDrumProject(value: unknown): DrumProject {
  const project = readProject(value)
  if (project === null) throw new Error('Invalid Drum Night project.')
  return project
}

/** Strip runtime-only editor state and produce a validated persistence DTO. */
export function serializeDrumProject(
  input: DrumProjectSerializationInput,
): DrumProject {
  const variants = Object.fromEntries(
    FIRST_POCKET_VARIANTS.map((variant) => [
      variant.id,
      serializeGroove(input.drafts[variant.id]),
    ]),
  ) as Record<FirstPocketVariantId, DrumProjectGroove>
  return validateDrumProject({
    schemaVersion: DRUM_PROJECT_SCHEMA_VERSION,
    id: input.id,
    title: input.title,
    revision: input.revision,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    source: {
      kind: DRUM_PROJECT_SOURCE_KIND,
      catalogRevision: FIRST_POCKET_CATALOG_REVISION,
    },
    selectedVariantId: input.selectedVariantId,
    variants,
    authoredFamilyMix: input.authoredFamilyMix,
    tempoBpm: input.tempoBpm,
    countInBeats: input.countInBeats,
    clickEnabled: input.clickEnabled,
    loopRange: input.loopRange,
  })
}

/** Restore canonical editor drafts without reviving undo or UI state. */
export function hydrateDrumProject(project: DrumProject): HydratedDrumProject {
  const validated = validateDrumProject(project)
  const drafts = Object.fromEntries(
    FIRST_POCKET_VARIANTS.map((variant) => [
      variant.id,
      hydrateGroove(variant.id, validated.variants[variant.id]),
    ]),
  ) as Record<FirstPocketVariantId, EditableDrumGrooveState>
  return Object.freeze({
    project: validated,
    drafts: Object.freeze(drafts),
  })
}

/** Stable, bounded content identity; project metadata deliberately contributes nothing. */
export function drumProjectContentFingerprint(project: DrumProject): string {
  const validated = validateDrumProject(project)
  const variants = Object.fromEntries(
    FIRST_POCKET_VARIANTS.map((variant) => {
      const groove = validated.variants[variant.id]
      return [
        variant.id,
        {
          barCount: groove.barCount,
          swing: groove.swing,
          density: groove.density,
          hits: groove.hits.map((hit) => ({
            trackId: hit.trackId,
            gmKey: hit.gmKey,
            velocity: hit.velocity,
            writtenDuration: hit.writtenDuration,
            stepIndex: hit.stepIndex,
            offsetBeats: hit.offsetBeats,
          })),
        },
      ] as const
    }),
  )
  const canonical = JSON.stringify({
    schemaVersion: validated.schemaVersion,
    source: validated.source,
    selectedVariantId: validated.selectedVariantId,
    variants,
    authoredFamilyMix: validated.authoredFamilyMix,
    tempoBpm: validated.tempoBpm,
    countInBeats: validated.countInBeats,
    clickEnabled: validated.clickEnabled,
    loopRange: validated.loopRange,
  })
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < canonical.length; index += 1) {
    const code = canonical.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ code, 0x85ebca6b)
  }
  return `drum-v1-${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`
}
