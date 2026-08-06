import { describe, expect, it } from 'vitest'
import { CueDomainError } from './errors'
import { DAILY_TARGET_TIME_DAYS } from './schedule-operations'
import { createInitialState } from './state'
import { assertStateIdentityInvariants } from './state-validation'
import type { BesideCueStateV1, Cue, CueOccurrence, ScheduleRule, } from './types'

const NOW = '2026-08-06T08:00:00+02:00'
const JOINED_MUSICIAN = '\u{1F469}\u200D\u{1F3A4}'

const ACTIVE_CUE: Cue = {
  id: 'cue-current',
  status: 'active',
  pullText: 'Doom scrolling',
  bSideText: `Play guitar with ${JOINED_MUSICIAN}`,
  mascotSetId: 'corktop-v1',
  createdAt: NOW,
  updatedAt: NOW,
}

const ARCHIVED_CUE: Cue = {
  id: 'cue-archived',
  status: 'archived',
  pullText: 'Late-night scrolling',
  bSideText: 'Read one page',
  mascotSetId: 'corktop-v1',
  createdAt: '2026-08-01T08:00:00+02:00',
  updatedAt: '2026-08-05T08:00:00+02:00',
  archivedAt: '2026-08-05T08:00:00+02:00',
}

const CURRENT_RULE: ScheduleRule = {
  id: 'schedule-current',
  cueId: ACTIVE_CUE.id,
  kind: 'target_time',
  daysOfWeek: DAILY_TARGET_TIME_DAYS,
  localTime: '09:00',
  enabled: true,
  createdAt: NOW,
  updatedAt: NOW,
}

const HISTORICAL_RULE: ScheduleRule = {
  id: 'schedule-archived',
  cueId: ARCHIVED_CUE.id,
  kind: 'target_time',
  daysOfWeek: DAILY_TARGET_TIME_DAYS,
  localTime: '18:30',
  enabled: false,
  createdAt: '2026-08-01T08:00:00+02:00',
  updatedAt: '2026-08-05T08:00:00+02:00',
}

const HISTORICAL_OCCURRENCE: CueOccurrence = {
  id: 'occurrence-archived',
  cueId: ARCHIVED_CUE.id,
  source: 'scheduled',
  scheduleRuleId: HISTORICAL_RULE.id,
  plannedFor: '2026-08-04T16:30:00Z',
  state: 'resolved',
  openedAt: '2026-08-04T18:30:00+02:00',
  outcome: 'b_side',
  outcomeAt: '2026-08-04T18:31:00+02:00',
  outcomeLocalDate: '2026-08-04',
}

function validState(): BesideCueStateV1 {
  return {
    ...createInitialState(),
    cues: [ARCHIVED_CUE, ACTIVE_CUE],
    scheduleRules: [HISTORICAL_RULE, CURRENT_RULE],
    occurrences: [
      HISTORICAL_OCCURRENCE,
      {
        id: 'occurrence-archived-planned',
        cueId: ARCHIVED_CUE.id,
        source: 'scheduled',
        scheduleRuleId: HISTORICAL_RULE.id,
        plannedFor: '2026-08-07T16:30:00Z',
        state: 'planned',
      },
      {
        id: 'occurrence-current',
        cueId: ACTIVE_CUE.id,
        source: 'manual',
        state: 'presented',
        openedAt: '2026-08-06T08:01:00+02:00',
      },
    ],
  }
}

function expectDomainErrorCode(
  state: unknown,
  code: CueDomainError['code'],
): void {
  try {
    assertStateIdentityInvariants(state as BesideCueStateV1)
  } catch (error) {
    expect(error).toBeInstanceOf(CueDomainError)
    expect((error as CueDomainError).code).toBe(code)
    return
  }
  throw new Error(`Expected CueDomainError with code ${code}.`)
}

describe('assertStateIdentityInvariants', () => {
  it('accepts joined emoji and complete archived cue history', () => {
    expect(() => assertStateIdentityInvariants(validState())).not.toThrow()
  })

  it('accepts an enabled rule for the one paused current cue', () => {
    const state = validState()
    const pausedCue = { ...ACTIVE_CUE, status: 'paused' as const }

    expect(() =>
      assertStateIdentityInvariants({
        ...state,
        cues: [ARCHIVED_CUE, pausedCue],
      }),
    ).not.toThrow()
  })

  it('rejects invalid schema and collection shapes', () => {
    expectDomainErrorCode(
      { ...validState(), schema: { schemaVersion: 2 } },
      'invalid_state_shape',
    )
    expectDomainErrorCode(
      { ...validState(), occurrences: null },
      'invalid_state_shape',
    )
    expectDomainErrorCode(
      {
        ...validState(),
        schema: { schemaVersion: 1, completedMigrationVersion: 1.5 },
      },
      'invalid_state_shape',
    )
  })

  it('rejects corrupt cue records without changing valid text semantics', () => {
    const state = validState()

    expectDomainErrorCode(
      {
        ...state,
        cues: [{ ...ACTIVE_CUE, status: 'sleeping' }],
        scheduleRules: [],
        occurrences: [],
      },
      'invalid_state_shape',
    )
    expectDomainErrorCode(
      {
        ...state,
        cues: [{ ...ACTIVE_CUE, pullText: '  Doom scrolling' }],
        scheduleRules: [],
        occurrences: [],
      },
      'invalid_state_shape',
    )
    expectDomainErrorCode(
      {
        ...state,
        cues: [{ ...ARCHIVED_CUE, archivedAt: undefined }],
        scheduleRules: [],
        occurrences: [],
      },
      'invalid_state_shape',
    )
    expectDomainErrorCode(
      {
        ...state,
        cues: [{ ...ACTIVE_CUE, updatedAt: 'not-an-instant' }],
        scheduleRules: [],
        occurrences: [],
      },
      'invalid_state_shape',
    )
  })

  it('rejects duplicate identities and more than one current cue', () => {
    const state = validState()
    expectDomainErrorCode(
      { ...state, cues: [ACTIVE_CUE, { ...ACTIVE_CUE }] },
      'cue_id_conflict',
    )
    expectDomainErrorCode(
      {
        ...state,
        cues: [
          ACTIVE_CUE,
          { ...ARCHIVED_CUE, status: 'paused', archivedAt: undefined },
        ],
      },
      'active_cue_conflict',
    )
  })

  it('rejects malformed settings values', () => {
    const state = validState()
    expectDomainErrorCode(
      {
        ...state,
        settings: { ...state.settings, hapticsEnabled: 'yes' },
      },
      'invalid_state_shape',
    )
    expectDomainErrorCode(
      {
        ...state,
        settings: {
          ...state.settings,
          quietHours: { ...state.settings.quietHours, start: '9:00' },
        },
      },
      'invalid_local_time',
    )
  })

  it('rejects malformed schedule fields and cue references', () => {
    const state = validState()
    expectDomainErrorCode(
      {
        ...state,
        scheduleRules: [
          { ...CURRENT_RULE, daysOfWeek: [1, 1] } as ScheduleRule,
        ],
        occurrences: [],
      },
      'invalid_state_shape',
    )
    expectDomainErrorCode(
      {
        ...state,
        scheduleRules: [
          { ...CURRENT_RULE, windowStart: '08:00' } as ScheduleRule,
        ],
        occurrences: [],
      },
      'invalid_state_shape',
    )
    expectDomainErrorCode(
      {
        ...state,
        scheduleRules: [
          { ...CURRENT_RULE, cueId: 'missing-cue' },
          HISTORICAL_RULE,
        ],
        occurrences: [HISTORICAL_OCCURRENCE],
      },
      'cue_not_found',
    )
    expectDomainErrorCode(
      {
        ...state,
        scheduleRules: [{ ...HISTORICAL_RULE, enabled: true }],
        occurrences: [HISTORICAL_OCCURRENCE],
      },
      'schedule_rule_cue_inactive',
    )
  })

  it('rejects dangling and cross-cue occurrence references', () => {
    const state = validState()
    expectDomainErrorCode(
      {
        ...state,
        occurrences: [{ ...HISTORICAL_OCCURRENCE, cueId: 'missing-cue' }],
      },
      'cue_not_found',
    )
    expectDomainErrorCode(
      {
        ...state,
        occurrences: [
          {
            ...HISTORICAL_OCCURRENCE,
            scheduleRuleId: 'missing-schedule',
          },
        ],
      },
      'schedule_rule_not_found',
    )
    expectDomainErrorCode(
      {
        ...state,
        occurrences: [{ ...HISTORICAL_OCCURRENCE, cueId: ACTIVE_CUE.id }],
      },
      'occurrence_schedule_rule_mismatch',
    )
  })

  it('rejects impossible occurrence lifecycle fields at hydration', () => {
    const state = validState()
    const impossibleManualPlan = {
      id: 'occurrence-invalid',
      cueId: ACTIVE_CUE.id,
      source: 'manual',
      state: 'planned',
    } as unknown as CueOccurrence
    expectDomainErrorCode(
      { ...state, occurrences: [impossibleManualPlan] },
      'occurrence_state_conflict',
    )
    expectDomainErrorCode(
      {
        ...state,
        occurrences: [
          {
            id: 'occurrence-invalid',
            cueId: ACTIVE_CUE.id,
            source: 'manual',
            state: 'presented',
            openedAt: NOW,
            outcome: 'b_side',
          } as unknown as CueOccurrence,
        ],
      },
      'occurrence_state_conflict',
    )
    expectDomainErrorCode(
      {
        ...state,
        occurrences: [
          {
            id: 'occurrence-invalid-time',
            cueId: ACTIVE_CUE.id,
            source: 'manual',
            state: 'presented',
            openedAt: 'not-an-instant',
          } as unknown as CueOccurrence,
        ],
      },
      'invalid_state_shape',
    )
  })
})
