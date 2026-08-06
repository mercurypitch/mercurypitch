// ============================================================
// Persisted state identity validation — call at repository hydration boundaries
// ============================================================

import { assertOneActiveCue, assertUniqueCueIds } from './cue-operations'
import { CueDomainError } from './errors'
import { assertOccurrenceStateInvariants } from './occurrences'
import { assertLocalTime, assertScheduleRuleStateInvariants, } from './schedule-operations'
import { normalizeCueText } from './text'
import type { AppSettings, BesideCueStateV1, Cue, CueOccurrence, DayOfWeek, ScheduleRule, } from './types'

type UnknownRecord = Record<string, unknown>

const CUE_STATUSES = new Set<Cue['status']>([
  'draft',
  'active',
  'paused',
  'archived',
])
const LOCK_SCREEN_DETAILS = new Set<AppSettings['lockScreenDetail']>([
  'discreet',
  'detailed',
])
const MOTION_SETTINGS = new Set<AppSettings['motion']>([
  'system',
  'reduced',
  'full',
])
const BOOLEAN_SETTING_FIELDS = [
  'scheduledSoundEnabled',
  'acknowledgementSoundEnabled',
  'hapticsEnabled',
  'voiceEnabled',
] as const satisfies readonly (keyof AppSettings)[]

function invalidState(path: string, reason: string): never {
  throw new CueDomainError(
    'invalid_state_shape',
    `Invalid persisted state at ${path}: ${reason}`,
  )
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireRecord(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) invalidState(path, 'expected an object.')
  return value
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    invalidState(path, 'expected a non-empty string.')
  }
  return value
}

function requireInstant(value: unknown, path: string): string {
  const instant = requireNonEmptyString(value, path)
  if (!Number.isFinite(Date.parse(instant))) {
    invalidState(path, 'expected a parseable date-time instant.')
  }
  return instant
}

function assertOptionalNonEmptyString(
  record: UnknownRecord,
  field: string,
  path: string,
): void {
  if (record[field] !== undefined) {
    requireNonEmptyString(record[field], `${path}.${field}`)
  }
}

function assertCanonicalCueText(value: unknown, path: string): void {
  const text = requireNonEmptyString(value, path)
  let normalized: string
  try {
    normalized = normalizeCueText(text)
  } catch {
    invalidState(path, 'expected valid cue text of at most 120 graphemes.')
  }
  if (normalized !== text) {
    invalidState(path, 'cue text must already be normalized.')
  }
}

function assertSchema(value: unknown): void {
  const schema = requireRecord(value, 'schema')
  if (schema.schemaVersion !== 1) {
    invalidState('schema.schemaVersion', 'expected schema version 1.')
  }
  if (schema.completedMigrationVersion !== 1) {
    invalidState(
      'schema.completedMigrationVersion',
      'expected completed migration version 1.',
    )
  }
}

function assertCueShape(value: unknown, index: number): void {
  const path = `cues[${index}]`
  const cue = requireRecord(value, path)
  requireNonEmptyString(cue.id, `${path}.id`)
  if (
    typeof cue.status !== 'string' ||
    !CUE_STATUSES.has(cue.status as Cue['status'])
  ) {
    invalidState(`${path}.status`, 'expected a valid cue status.')
  }

  assertOptionalNonEmptyString(cue, 'pullCategoryId', path)
  assertCanonicalCueText(cue.pullText, `${path}.pullText`)
  assertOptionalNonEmptyString(cue, 'bSideSuggestionId', path)
  assertCanonicalCueText(cue.bSideText, `${path}.bSideText`)
  requireNonEmptyString(cue.mascotSetId, `${path}.mascotSetId`)
  requireInstant(cue.createdAt, `${path}.createdAt`)
  requireInstant(cue.updatedAt, `${path}.updatedAt`)

  if (cue.status === 'archived') {
    requireInstant(cue.archivedAt, `${path}.archivedAt`)
  } else if (cue.archivedAt !== undefined) {
    invalidState(
      `${path}.archivedAt`,
      'only archived cues may carry an archive instant.',
    )
  }
}

function assertDaySet(value: unknown, path: string): void {
  if (!Array.isArray(value) || value.length === 0 || value.length > 7) {
    invalidState(path, 'expected one to seven weekdays.')
  }

  const days = new Set<DayOfWeek>()
  for (const day of value) {
    if (!Number.isInteger(day) || day < 1 || day > 7) {
      invalidState(path, 'weekdays must be unique integers from 1 through 7.')
    }
    if (days.has(day as DayOfWeek)) {
      invalidState(path, 'weekdays must not contain duplicates.')
    }
    days.add(day as DayOfWeek)
  }
}

function assertPersistedLocalTime(value: unknown, path: string): void {
  if (typeof value !== 'string') {
    invalidState(path, 'expected a strict 24-hour local time.')
  }
  assertLocalTime(value)
}

function assertScheduleRuleShape(value: unknown, index: number): void {
  const path = `scheduleRules[${index}]`
  const rule = requireRecord(value, path)
  requireNonEmptyString(rule.id, `${path}.id`)
  requireNonEmptyString(rule.cueId, `${path}.cueId`)
  assertDaySet(rule.daysOfWeek, `${path}.daysOfWeek`)
  if (typeof rule.enabled !== 'boolean') {
    invalidState(`${path}.enabled`, 'expected a boolean.')
  }
  requireInstant(rule.createdAt, `${path}.createdAt`)
  requireInstant(rule.updatedAt, `${path}.updatedAt`)

  if (rule.kind === 'target_time') {
    assertPersistedLocalTime(rule.localTime, `${path}.localTime`)
    if (rule.windowStart !== undefined || rule.windowEnd !== undefined) {
      invalidState(path, 'a target-time rule cannot contain window fields.')
    }
    return
  }
  if (rule.kind === 'window') {
    assertPersistedLocalTime(rule.windowStart, `${path}.windowStart`)
    assertPersistedLocalTime(rule.windowEnd, `${path}.windowEnd`)
    if (rule.localTime !== undefined) {
      invalidState(path, 'a window rule cannot contain localTime.')
    }
    return
  }
  invalidState(`${path}.kind`, 'expected target_time or window.')
}

function assertOccurrenceShape(value: unknown, index: number): void {
  const path = `occurrences[${index}]`
  const occurrence = requireRecord(value, path)
  requireNonEmptyString(occurrence.id, `${path}.id`)
  requireNonEmptyString(occurrence.cueId, `${path}.cueId`)
  for (const field of ['plannedFor', 'openedAt', 'outcomeAt'] as const) {
    if (occurrence[field] !== undefined) {
      requireInstant(occurrence[field], `${path}.${field}`)
    }
  }
}

function assertSettings(value: unknown): void {
  const settings = requireRecord(value, 'settings')
  const quietHours = requireRecord(settings.quietHours, 'settings.quietHours')
  if (typeof quietHours.enabled !== 'boolean') {
    invalidState('settings.quietHours.enabled', 'expected a boolean.')
  }
  assertPersistedLocalTime(quietHours.start, 'settings.quietHours.start')
  assertPersistedLocalTime(quietHours.end, 'settings.quietHours.end')

  if (
    typeof settings.lockScreenDetail !== 'string' ||
    !LOCK_SCREEN_DETAILS.has(
      settings.lockScreenDetail as AppSettings['lockScreenDetail'],
    )
  ) {
    invalidState('settings.lockScreenDetail', 'expected discreet or detailed.')
  }
  for (const field of BOOLEAN_SETTING_FIELDS) {
    if (typeof settings[field] !== 'boolean') {
      invalidState(`settings.${field}`, 'expected a boolean.')
    }
  }
  if (
    typeof settings.motion !== 'string' ||
    !MOTION_SETTINGS.has(settings.motion as AppSettings['motion'])
  ) {
    invalidState('settings.motion', 'expected system, reduced, or full.')
  }
  requireNonEmptyString(settings.locale, 'settings.locale')
}

interface ValidatedCollections {
  readonly state: BesideCueStateV1
  readonly cues: readonly Cue[]
  readonly rules: readonly ScheduleRule[]
  readonly occurrences: readonly CueOccurrence[]
}

function assertStateShape(value: unknown): ValidatedCollections {
  const snapshot = requireRecord(value, 'state')
  assertSchema(snapshot.schema)
  if (!Array.isArray(snapshot.cues)) {
    invalidState('cues', 'expected an array.')
  }
  if (!Array.isArray(snapshot.scheduleRules)) {
    invalidState('scheduleRules', 'expected an array.')
  }
  if (!Array.isArray(snapshot.occurrences)) {
    invalidState('occurrences', 'expected an array.')
  }

  for (const [index, cue] of snapshot.cues.entries()) {
    assertCueShape(cue, index)
  }
  for (const [index, rule] of snapshot.scheduleRules.entries()) {
    assertScheduleRuleShape(rule, index)
  }
  for (const [index, occurrence] of snapshot.occurrences.entries()) {
    assertOccurrenceShape(occurrence, index)
  }
  assertSettings(snapshot.settings)

  return {
    state: snapshot as unknown as BesideCueStateV1,
    cues: snapshot.cues as unknown as readonly Cue[],
    rules: snapshot.scheduleRules as unknown as readonly ScheduleRule[],
    occurrences: snapshot.occurrences as unknown as readonly CueOccurrence[],
  }
}

function assertCrossRecordInvariants(
  cues: readonly Cue[],
  rules: readonly ScheduleRule[],
  occurrences: readonly CueOccurrence[],
): void {
  const currentCues = cues.filter(
    (cue) => cue.status === 'active' || cue.status === 'paused',
  )
  if (currentCues.length > 1) {
    throw new CueDomainError(
      'active_cue_conflict',
      `State contains multiple current cues: ${currentCues
        .map((cue) => cue.id)
        .join(', ')}`,
    )
  }
  const currentCue = currentCues[0]
  const cuesById = new Map(cues.map((cue) => [cue.id, cue]))
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]))

  for (const rule of rules) {
    const cue = cuesById.get(rule.cueId)
    if (cue === undefined) {
      throw new CueDomainError(
        'cue_not_found',
        `Schedule rule ${rule.id} references missing cue ${rule.cueId}.`,
      )
    }
    if (cue.status === 'draft' || (rule.enabled && cue.id !== currentCue?.id)) {
      throw new CueDomainError(
        'schedule_rule_cue_inactive',
        `Schedule rule ${rule.id} does not belong to the current cue.`,
      )
    }
  }

  for (const occurrence of occurrences) {
    const cue = cuesById.get(occurrence.cueId)
    if (cue === undefined) {
      throw new CueDomainError(
        'cue_not_found',
        `Occurrence ${occurrence.id} references missing cue ${occurrence.cueId}.`,
      )
    }
    if (cue.status === 'draft') {
      throw new CueDomainError(
        'occurrence_cue_inactive',
        `Occurrence ${occurrence.id} references draft cue ${cue.id}.`,
      )
    }
    if (occurrence.source !== 'scheduled') continue

    const rule = rulesById.get(occurrence.scheduleRuleId)
    if (rule === undefined) {
      throw new CueDomainError(
        'schedule_rule_not_found',
        `Occurrence ${occurrence.id} references missing schedule rule ${occurrence.scheduleRuleId}.`,
      )
    }
    if (rule.cueId !== occurrence.cueId) {
      throw new CueDomainError(
        'occurrence_schedule_rule_mismatch',
        `Schedule rule ${rule.id} does not belong to occurrence cue ${occurrence.cueId}.`,
      )
    }
  }
}

/** Validates all persistence-sensitive invariants after decoding a snapshot. */
export function assertStateIdentityInvariants(state: BesideCueStateV1): void {
  const validated = assertStateShape(state)
  assertUniqueCueIds(validated.state)
  assertOneActiveCue(validated.state)
  assertScheduleRuleStateInvariants(validated.state)
  assertOccurrenceStateInvariants(validated.state)
  assertCrossRecordInvariants(
    validated.cues,
    validated.rules,
    validated.occurrences,
  )
}
