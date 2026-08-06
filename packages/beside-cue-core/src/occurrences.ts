// ============================================================
// Cue occurrences — pure lifecycle transitions and one immutable outcome
// ============================================================

import { assertOneActiveCue, assertUniqueCueIds } from './cue-operations'
import { assertLocalDate } from './dates'
import { CueDomainError } from './errors'
import { assertScheduleRuleStateInvariants } from './schedule-operations'
import type { BesideCueStateV1, CancelledCueOccurrence, Cue, CueId, CueOccurrence, CueOccurrenceId, CueOccurrenceOutcome, Instant, LocalDate, PlannedCueOccurrence, PresentedCueOccurrence, PresentedManualCueOccurrence, ResolvedCueOccurrence, ScheduleRuleId, } from './types'

export interface CreateManualOccurrenceInput {
  readonly id: CueOccurrenceId
  readonly cueId: CueId
  readonly at: Instant
}

export interface CreateScheduledOccurrenceInput {
  readonly id: CueOccurrenceId
  readonly cueId: CueId
  readonly scheduleRuleId: ScheduleRuleId
  readonly plannedFor: Instant
}

export interface PresentCueOccurrenceInput {
  readonly occurrenceId: CueOccurrenceId
  readonly openedAt: Instant
}

export interface CancelCueOccurrenceInput {
  readonly occurrenceId: CueOccurrenceId
}

export interface CueOccurrenceMutationResult<
  TOccurrence extends CueOccurrence = CueOccurrence,
> {
  readonly state: BesideCueStateV1
  readonly occurrence: TOccurrence
}

export interface RecordOccurrenceOutcomeInput {
  readonly occurrenceId: CueOccurrenceId
  readonly outcome: CueOccurrenceOutcome
  readonly outcomeAt: Instant
  readonly outcomeLocalDate: LocalDate
}

export interface OccurrenceOutcomeRecordResult {
  readonly state: BesideCueStateV1
  readonly occurrence: ResolvedCueOccurrence
  readonly recorded: boolean
}

function requireCue(state: BesideCueStateV1, cueId: CueId): Cue {
  assertUniqueCueIds(state)
  const cue = state.cues.find((candidate) => candidate.id === cueId)
  if (cue === undefined) {
    throw new CueDomainError('cue_not_found', `Cue not found: ${cueId}`)
  }
  return cue
}

function requireActiveCue(state: BesideCueStateV1, cueId: CueId): Cue {
  assertOneActiveCue(state)
  const cue = requireCue(state, cueId)
  if (cue.status !== 'active') {
    throw new CueDomainError(
      'occurrence_cue_inactive',
      `Cue ${cueId} must be active to present an occurrence.`,
    )
  }
  return cue
}

function requireOccurrence(
  state: BesideCueStateV1,
  occurrenceId: CueOccurrenceId,
): CueOccurrence {
  assertOccurrenceStateInvariants(state)
  const occurrence = state.occurrences.find(
    (candidate) => candidate.id === occurrenceId,
  )
  if (occurrence === undefined) {
    throw new CueDomainError(
      'occurrence_not_found',
      `Cue occurrence not found: ${occurrenceId}`,
    )
  }
  return occurrence
}

/** Asserts the occurrence identity invariant for persisted or imported state. */
export function assertUniqueOccurrenceIds(state: BesideCueStateV1): void {
  const ids = new Set<CueOccurrenceId>()
  for (const occurrence of state.occurrences) {
    if (typeof occurrence.id !== 'string' || occurrence.id.trim() === '') {
      throw new CueDomainError(
        'invalid_occurrence_id',
        'Cue occurrence id must not be empty.',
      )
    }
    if (ids.has(occurrence.id)) {
      throw new CueDomainError(
        'occurrence_id_conflict',
        `State contains duplicate cue occurrence ids: ${occurrence.id}`,
      )
    }
    ids.add(occurrence.id)
  }
}

function hasNonEmptyString(
  occurrence: Record<string, unknown>,
  field: string,
): boolean {
  const value = occurrence[field]
  return typeof value === 'string' && value.trim() !== ''
}

function hasValue(occurrence: Record<string, unknown>, field: string): boolean {
  return occurrence[field] !== undefined
}

function invalidOccurrence(
  occurrence: Record<string, unknown>,
  reason: string,
): never {
  const id =
    typeof occurrence.id === 'string' && occurrence.id.trim() !== ''
      ? occurrence.id
      : '<unknown>'
  throw new CueDomainError(
    'occurrence_state_conflict',
    `Occurrence ${id} has an invalid persisted lifecycle: ${reason}`,
  )
}

function assertNonEmptyOccurrenceInstant(value: Instant, field: string): void {
  if (value.trim() === '') {
    throw new CueDomainError(
      'occurrence_state_conflict',
      `Occurrence ${field} must be a non-empty instant.`,
    )
  }
}

function assertUnresolvedFieldsAbsent(
  occurrence: Record<string, unknown>,
): void {
  if (
    hasValue(occurrence, 'outcome') ||
    hasValue(occurrence, 'outcomeAt') ||
    hasValue(occurrence, 'outcomeLocalDate')
  ) {
    invalidOccurrence(
      occurrence,
      'an unresolved state cannot contain outcome fields.',
    )
  }
}

/**
 * Validates the runtime shape represented by the occurrence discriminated
 * union. Persisted JSON is untyped, so hydration and transitions must reject
 * impossible source/state combinations before spreading a record forward.
 */
export function assertOccurrenceStateInvariants(state: BesideCueStateV1): void {
  assertUniqueOccurrenceIds(state)

  for (const typedOccurrence of state.occurrences) {
    const occurrence = typedOccurrence as unknown as Record<string, unknown>
    if (!hasNonEmptyString(occurrence, 'cueId')) {
      invalidOccurrence(occurrence, 'cueId must be a non-empty string.')
    }

    const source = occurrence.source
    if (source === 'manual') {
      if (
        hasValue(occurrence, 'scheduleRuleId') ||
        hasValue(occurrence, 'plannedFor')
      ) {
        invalidOccurrence(
          occurrence,
          'a manual occurrence cannot contain schedule fields.',
        )
      }
    } else if (source === 'scheduled') {
      if (
        !hasNonEmptyString(occurrence, 'scheduleRuleId') ||
        !hasNonEmptyString(occurrence, 'plannedFor')
      ) {
        invalidOccurrence(
          occurrence,
          'a scheduled occurrence requires scheduleRuleId and plannedFor.',
        )
      }
    } else {
      invalidOccurrence(occurrence, 'source must be manual or scheduled.')
    }

    switch (occurrence.state) {
      case 'planned':
        if (source !== 'scheduled' || hasValue(occurrence, 'openedAt')) {
          invalidOccurrence(
            occurrence,
            'planned occurrences must be unopened and scheduled.',
          )
        }
        assertUnresolvedFieldsAbsent(occurrence)
        break

      case 'presented':
        if (!hasNonEmptyString(occurrence, 'openedAt')) {
          invalidOccurrence(
            occurrence,
            'presented occurrences require openedAt.',
          )
        }
        assertUnresolvedFieldsAbsent(occurrence)
        break

      case 'cancelled':
        if (source === 'manual' && !hasNonEmptyString(occurrence, 'openedAt')) {
          invalidOccurrence(
            occurrence,
            'cancelled manual occurrences require openedAt.',
          )
        }
        if (
          source === 'scheduled' &&
          hasValue(occurrence, 'openedAt') &&
          !hasNonEmptyString(occurrence, 'openedAt')
        ) {
          invalidOccurrence(
            occurrence,
            'openedAt must be a non-empty string when present.',
          )
        }
        assertUnresolvedFieldsAbsent(occurrence)
        break

      case 'resolved': {
        if (
          !hasNonEmptyString(occurrence, 'openedAt') ||
          !hasNonEmptyString(occurrence, 'outcomeAt') ||
          !hasNonEmptyString(occurrence, 'outcomeLocalDate') ||
          (occurrence.outcome !== 'b_side' && occurrence.outcome !== 'not_now')
        ) {
          invalidOccurrence(
            occurrence,
            'resolved occurrences require a complete valid outcome.',
          )
        }
        assertLocalDate(occurrence.outcomeLocalDate as LocalDate)
        break
      }

      default:
        invalidOccurrence(
          occurrence,
          'state must be planned, presented, cancelled, or resolved.',
        )
    }
  }
}

function validateNewOccurrenceId(
  state: BesideCueStateV1,
  occurrenceId: CueOccurrenceId,
): void {
  assertOccurrenceStateInvariants(state)
  if (occurrenceId.trim() === '') {
    throw new CueDomainError(
      'invalid_occurrence_id',
      'Cue occurrence id must not be empty.',
    )
  }
  if (state.occurrences.some((occurrence) => occurrence.id === occurrenceId)) {
    throw new CueDomainError(
      'occurrence_id_conflict',
      `Cue occurrence id already exists: ${occurrenceId}`,
    )
  }
}

function replaceOccurrenceRecord(
  state: BesideCueStateV1,
  occurrence: CueOccurrence,
): BesideCueStateV1 {
  return {
    ...state,
    occurrences: state.occurrences.map((candidate) =>
      candidate.id === occurrence.id ? occurrence : candidate,
    ),
  }
}

/** Creates the already-presented occurrence used by the v0 "Cue me now" flow. */
export function createManualOccurrence(
  state: BesideCueStateV1,
  input: CreateManualOccurrenceInput,
): CueOccurrenceMutationResult<PresentedManualCueOccurrence> {
  requireActiveCue(state, input.cueId)
  validateNewOccurrenceId(state, input.id)
  assertNonEmptyOccurrenceInstant(input.at, 'openedAt')

  const occurrence: PresentedManualCueOccurrence = {
    id: input.id,
    cueId: input.cueId,
    source: 'manual',
    state: 'presented',
    openedAt: input.at,
  }

  return {
    occurrence,
    state: {
      ...state,
      occurrences: [...state.occurrences, occurrence],
    },
  }
}

/** Creates a planned occurrence tied to one enabled rule for the active cue. */
export function createScheduledOccurrence(
  state: BesideCueStateV1,
  input: CreateScheduledOccurrenceInput,
): CueOccurrenceMutationResult<PlannedCueOccurrence> {
  requireActiveCue(state, input.cueId)
  assertScheduleRuleStateInvariants(state)
  validateNewOccurrenceId(state, input.id)
  assertNonEmptyOccurrenceInstant(input.plannedFor, 'plannedFor')

  const rule = state.scheduleRules.find(
    (candidate) => candidate.id === input.scheduleRuleId,
  )
  if (rule === undefined) {
    throw new CueDomainError(
      'schedule_rule_not_found',
      `Schedule rule not found: ${input.scheduleRuleId}`,
    )
  }
  if (rule.cueId !== input.cueId) {
    throw new CueDomainError(
      'occurrence_schedule_rule_mismatch',
      `Schedule rule ${rule.id} does not belong to cue ${input.cueId}.`,
    )
  }
  if (!rule.enabled) {
    throw new CueDomainError(
      'occurrence_schedule_rule_disabled',
      `Schedule rule ${rule.id} is disabled.`,
    )
  }

  const occurrence: PlannedCueOccurrence = {
    id: input.id,
    cueId: input.cueId,
    source: 'scheduled',
    scheduleRuleId: input.scheduleRuleId,
    plannedFor: input.plannedFor,
    state: 'planned',
  }

  return {
    occurrence,
    state: {
      ...state,
      occurrences: [...state.occurrences, occurrence],
    },
  }
}

/** Presents an existing planned occurrence without exposing array mutation. */
export function presentCueOccurrence(
  state: BesideCueStateV1,
  input: PresentCueOccurrenceInput,
): CueOccurrenceMutationResult<PresentedCueOccurrence> {
  const current = requireOccurrence(state, input.occurrenceId)
  requireCue(state, current.cueId)

  if (current.state === 'presented') {
    return { state, occurrence: current }
  }
  if (current.state !== 'planned') {
    throw new CueDomainError(
      'occurrence_state_conflict',
      `A ${current.state} occurrence cannot be presented.`,
    )
  }
  requireActiveCue(state, current.cueId)
  assertNonEmptyOccurrenceInstant(input.openedAt, 'openedAt')

  const occurrence: PresentedCueOccurrence = {
    ...current,
    state: 'presented',
    openedAt: input.openedAt,
  }
  return { occurrence, state: replaceOccurrenceRecord(state, occurrence) }
}

/** Cancels an unresolved occurrence; repeated cancellation is a no-op. */
export function cancelCueOccurrence(
  state: BesideCueStateV1,
  input: CancelCueOccurrenceInput,
): CueOccurrenceMutationResult<CancelledCueOccurrence> {
  const current = requireOccurrence(state, input.occurrenceId)

  if (current.state === 'cancelled') {
    return { state, occurrence: current }
  }
  if (current.state === 'resolved') {
    throw new CueDomainError(
      'occurrence_state_conflict',
      'A resolved occurrence cannot be cancelled.',
    )
  }

  const occurrence: CancelledCueOccurrence = {
    ...current,
    state: 'cancelled',
  }
  return { occurrence, state: replaceOccurrenceRecord(state, occurrence) }
}

export function recordOccurrenceOutcome(
  state: BesideCueStateV1,
  input: RecordOccurrenceOutcomeInput,
): OccurrenceOutcomeRecordResult {
  const current = requireOccurrence(state, input.occurrenceId)

  if (current.state === 'resolved') {
    if (current.outcome !== input.outcome) {
      throw new CueDomainError(
        'occurrence_outcome_conflict',
        `Occurrence ${current.id} already has an outcome.`,
      )
    }
    return { state, occurrence: current, recorded: false }
  }

  if (current.state === 'cancelled') {
    throw new CueDomainError(
      'occurrence_state_conflict',
      'A cancelled occurrence cannot record an outcome.',
    )
  }
  if (current.state === 'planned') {
    throw new CueDomainError(
      'occurrence_state_conflict',
      'An occurrence must be presented before it can record an outcome.',
    )
  }

  assertLocalDate(input.outcomeLocalDate)
  assertNonEmptyOccurrenceInstant(input.outcomeAt, 'outcomeAt')
  const occurrence: ResolvedCueOccurrence = {
    ...current,
    state: 'resolved',
    outcome: input.outcome,
    outcomeAt: input.outcomeAt,
    outcomeLocalDate: input.outcomeLocalDate,
  }

  return {
    occurrence,
    recorded: true,
    state: replaceOccurrenceRecord(state, occurrence),
  }
}
