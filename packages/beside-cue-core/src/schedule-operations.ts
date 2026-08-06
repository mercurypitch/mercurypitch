// ============================================================
// Daily schedule intent — pure transitions, independent of device schedulers
// ============================================================

import { assertOneActiveCue } from './cue-operations'
import { CueDomainError } from './errors'
import type { BesideCueStateV1, Cue, DayOfWeek, Instant, LocalTime, ScheduleRule, ScheduleRuleId, TargetTimeScheduleRule, } from './types'

const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u

/** Canonical every-day ordering used by v0 target-time rules. */
export const DAILY_TARGET_TIME_DAYS: readonly DayOfWeek[] = Object.freeze([
  1, 2, 3, 4, 5, 6, 7,
])

export interface SetDailyTargetTimeRuleInput {
  readonly id: ScheduleRuleId
  readonly cueId: Cue['id']
  readonly localTime: string
  readonly at: Instant
}

export interface UpdateDailyTargetTimeRuleInput {
  readonly ruleId: ScheduleRuleId
  readonly localTime: string
  readonly at: Instant
}

export interface RemoveDailyTargetTimeRuleInput {
  readonly ruleId: ScheduleRuleId
  readonly at: Instant
}

export interface ScheduleRuleMutationResult {
  readonly state: BesideCueStateV1
  readonly rule: TargetTimeScheduleRule
}

/**
 * Accepts only the persisted 24-hour shape. It deliberately does not trim or
 * coerce so a UI cannot silently turn an ambiguous custom value into intent.
 */
export function assertLocalTime(value: string): asserts value is LocalTime {
  if (!LOCAL_TIME_PATTERN.test(value)) {
    throw new CueDomainError(
      'invalid_local_time',
      `Local time must use strict 24-hour HH:mm format: ${value}`,
    )
  }
}

export function isDailyTargetTimeRule(
  rule: ScheduleRule,
): rule is TargetTimeScheduleRule {
  if (rule.kind !== 'target_time' || rule.daysOfWeek.length !== 7) return false

  const days = new Set(rule.daysOfWeek)
  return DAILY_TARGET_TIME_DAYS.every((day) => days.has(day))
}

/** Validates schedule identities before any domain transition mutates state. */
export function assertUniqueScheduleRuleIds(state: BesideCueStateV1): void {
  const ids = new Set<ScheduleRuleId>()
  for (const rule of state.scheduleRules) {
    if (rule.id.trim() === '') {
      throw new CueDomainError(
        'invalid_schedule_rule_id',
        'Schedule rule id must not be empty.',
      )
    }
    if (ids.has(rule.id)) {
      throw new CueDomainError(
        'schedule_rule_id_conflict',
        `State contains duplicate schedule rule ids: ${rule.id}`,
      )
    }
    ids.add(rule.id)
  }
}

/** Validates identity and local-time fields at persistence boundaries. */
export function assertScheduleRuleStateInvariants(
  state: BesideCueStateV1,
): void {
  assertUniqueScheduleRuleIds(state)
  const enabledDailyRuleIds: ScheduleRuleId[] = []
  for (const rule of state.scheduleRules) {
    if (rule.kind === 'target_time') {
      assertLocalTime(rule.localTime)
      if (rule.enabled && isDailyTargetTimeRule(rule)) {
        enabledDailyRuleIds.push(rule.id)
      }
    } else {
      assertLocalTime(rule.windowStart)
      assertLocalTime(rule.windowEnd)
    }
  }

  if (enabledDailyRuleIds.length > 1) {
    throw new CueDomainError(
      'schedule_rule_enabled_conflict',
      `State contains multiple enabled daily schedule rules: ${enabledDailyRuleIds.join(', ')}`,
    )
  }
}

function validateNewRuleId(
  state: BesideCueStateV1,
  ruleId: ScheduleRuleId,
): void {
  if (ruleId.trim() === '') {
    throw new CueDomainError(
      'invalid_schedule_rule_id',
      'Schedule rule id must not be empty.',
    )
  }
  if (state.scheduleRules.some((rule) => rule.id === ruleId)) {
    throw new CueDomainError(
      'schedule_rule_id_conflict',
      `Schedule rule id already exists: ${ruleId}`,
    )
  }
}

function requireCurrentCue(state: BesideCueStateV1, cueId: Cue['id']): Cue {
  assertOneActiveCue(state)
  const cue = state.cues.find((candidate) => candidate.id === cueId)
  const activeCue = state.cues.find(
    (candidate) => candidate.status === 'active',
  )
  const isCurrent =
    cue?.status === 'active' ||
    (cue?.status === 'paused' && activeCue === undefined)

  if (!isCurrent || cue === undefined) {
    throw new CueDomainError(
      'schedule_rule_cue_inactive',
      `Daily schedule rules can only be changed for the current cue: ${cueId}`,
    )
  }
  return cue
}

function requireDailyTargetTimeRule(
  state: BesideCueStateV1,
  ruleId: ScheduleRuleId,
): TargetTimeScheduleRule {
  if (ruleId.trim() === '') {
    throw new CueDomainError(
      'invalid_schedule_rule_id',
      'Schedule rule id must not be empty.',
    )
  }

  const rule = state.scheduleRules.find((candidate) => candidate.id === ruleId)
  if (rule === undefined) {
    throw new CueDomainError(
      'schedule_rule_not_found',
      `Schedule rule not found: ${ruleId}`,
    )
  }
  if (!isDailyTargetTimeRule(rule)) {
    throw new CueDomainError(
      'schedule_rule_kind_conflict',
      `Schedule rule is not a daily target-time rule: ${ruleId}`,
    )
  }
  return rule
}

/**
 * Disables prior daily rules instead of deleting them. Scheduled occurrences
 * can therefore retain valid references after a cue is replaced or rescheduled.
 */
function retireOtherDailyRules(
  rules: readonly ScheduleRule[],
  retainedRuleId: ScheduleRuleId,
  at: Instant,
): readonly ScheduleRule[] {
  return rules.map((rule) =>
    rule.id !== retainedRuleId && rule.enabled && isDailyTargetTimeRule(rule)
      ? { ...rule, enabled: false, updatedAt: at }
      : rule,
  )
}

function replaceRule(
  rules: readonly ScheduleRule[],
  replacement: TargetTimeScheduleRule,
): readonly ScheduleRule[] {
  return rules.map((rule) => (rule.id === replacement.id ? replacement : rule))
}

/**
 * Creates and enables one fresh daily target-time rule. Any earlier daily rule
 * is retained as disabled history, including rules belonging to an archived cue.
 */
export function setDailyTargetTimeRule(
  state: BesideCueStateV1,
  input: SetDailyTargetTimeRuleInput,
): ScheduleRuleMutationResult {
  assertScheduleRuleStateInvariants(state)
  requireCurrentCue(state, input.cueId)
  validateNewRuleId(state, input.id)
  assertLocalTime(input.localTime)

  const rule: TargetTimeScheduleRule = {
    id: input.id,
    cueId: input.cueId,
    kind: 'target_time',
    daysOfWeek: DAILY_TARGET_TIME_DAYS,
    localTime: input.localTime,
    enabled: true,
    createdAt: input.at,
    updatedAt: input.at,
  }
  const retiredRules = retireOtherDailyRules(
    state.scheduleRules,
    rule.id,
    input.at,
  )

  return {
    rule,
    state: { ...state, scheduleRules: [...retiredRules, rule] },
  }
}

/** Updates and re-enables an existing current-cue daily rule in place. */
export function updateDailyTargetTimeRule(
  state: BesideCueStateV1,
  input: UpdateDailyTargetTimeRuleInput,
): ScheduleRuleMutationResult {
  assertScheduleRuleStateInvariants(state)
  const current = requireDailyTargetTimeRule(state, input.ruleId)
  requireCurrentCue(state, current.cueId)
  assertLocalTime(input.localTime)

  const rule: TargetTimeScheduleRule = {
    ...current,
    localTime: input.localTime,
    enabled: true,
    updatedAt: input.at,
  }
  const updatedRules = replaceRule(state.scheduleRules, rule)
  const scheduleRules = retireOtherDailyRules(updatedRules, rule.id, input.at)

  return { rule, state: { ...state, scheduleRules } }
}

/**
 * Removes a daily rule from active intent by disabling it. The persisted record
 * remains available to historical occurrences that reference its id.
 */
export function removeDailyTargetTimeRule(
  state: BesideCueStateV1,
  input: RemoveDailyTargetTimeRuleInput,
): ScheduleRuleMutationResult {
  assertScheduleRuleStateInvariants(state)
  const current = requireDailyTargetTimeRule(state, input.ruleId)
  requireCurrentCue(state, current.cueId)
  if (!current.enabled) return { state, rule: current }

  const rule: TargetTimeScheduleRule = {
    ...current,
    enabled: false,
    updatedAt: input.at,
  }

  return {
    rule,
    state: {
      ...state,
      scheduleRules: replaceRule(state.scheduleRules, rule),
    },
  }
}
