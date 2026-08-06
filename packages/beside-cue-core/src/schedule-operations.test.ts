import { describe, expect, it } from 'vitest'
import { activateCue, createCue, replaceCue } from './cue-operations'
import { CueDomainError } from './errors'
import { assertLocalTime, assertScheduleRuleStateInvariants, DAILY_TARGET_TIME_DAYS, removeDailyTargetTimeRule, setDailyTargetTimeRule, updateDailyTargetTimeRule, } from './schedule-operations'
import { createInitialState } from './state'
import type { BesideCueStateV1, CueOccurrence, ScheduleRule } from './types'

const START = '2026-08-06T08:00:00+02:00'

function activeCueState(): BesideCueStateV1 {
  const created = createCue(createInitialState(), {
    id: 'cue-1',
    pullText: 'Doom scrolling',
    bSideText: 'Play guitar',
    at: START,
  })
  return activateCue(created.state, created.cue.id, START).state
}

function expectDomainErrorCode(
  operation: () => unknown,
  code: CueDomainError['code'],
): void {
  try {
    operation()
  } catch (error) {
    expect(error).toBeInstanceOf(CueDomainError)
    expect((error as CueDomainError).code).toBe(code)
    return
  }
  throw new Error(`Expected CueDomainError with code ${code}.`)
}

function setFirstRule(state = activeCueState()) {
  return setDailyTargetTimeRule(state, {
    id: 'schedule-1',
    cueId: 'cue-1',
    localTime: '09:30',
    at: START,
  })
}

describe('daily target-time schedule intent', () => {
  it('creates one enabled every-day rule for the current cue', () => {
    const result = setFirstRule()

    expect(result.rule).toEqual({
      id: 'schedule-1',
      cueId: 'cue-1',
      kind: 'target_time',
      daysOfWeek: DAILY_TARGET_TIME_DAYS,
      localTime: '09:30',
      enabled: true,
      createdAt: START,
      updatedAt: START,
    })
    expect(result.state.scheduleRules).toEqual([result.rule])
  })

  it.each(['00:00', '09:05', '23:59'])(
    'accepts strict 24-hour local time %s',
    (localTime) => {
      expect(() => assertLocalTime(localTime)).not.toThrow()
    },
  )

  it.each(['0:00', '7:05', '24:00', '23:60', '09:30 ', ' 09:30', '09.30'])(
    'rejects malformed or ambiguous local time %s',
    (localTime) => {
      expectDomainErrorCode(
        () => assertLocalTime(localTime),
        'invalid_local_time',
      )
    },
  )

  it('rejects empty and previously used schedule identities', () => {
    const first = setFirstRule()

    expectDomainErrorCode(
      () =>
        setDailyTargetTimeRule(activeCueState(), {
          id: '   ',
          cueId: 'cue-1',
          localTime: '09:30',
          at: START,
        }),
      'invalid_schedule_rule_id',
    )
    expectDomainErrorCode(
      () =>
        setDailyTargetTimeRule(first.state, {
          id: first.rule.id,
          cueId: 'cue-1',
          localTime: '12:00',
          at: '2026-08-06T09:00:00+02:00',
        }),
      'schedule_rule_id_conflict',
    )
  })

  it('updates a current rule in place and accepts fixed or custom times equally', () => {
    const first = setFirstRule()
    const updated = updateDailyTargetTimeRule(first.state, {
      ruleId: first.rule.id,
      localTime: '18:15',
      at: '2026-08-06T09:00:00+02:00',
    })

    expect(updated.rule).toMatchObject({
      id: first.rule.id,
      localTime: '18:15',
      enabled: true,
      createdAt: START,
      updatedAt: '2026-08-06T09:00:00+02:00',
    })
    expect(updated.state.scheduleRules).toHaveLength(1)
  })

  it('sets a fresh rule by disabling and retaining the previous intent', () => {
    const first = setFirstRule()
    const second = setDailyTargetTimeRule(first.state, {
      id: 'schedule-2',
      cueId: 'cue-1',
      localTime: '12:45',
      at: '2026-08-06T09:00:00+02:00',
    })

    expect(second.state.scheduleRules).toHaveLength(2)
    expect(second.state.scheduleRules[0]).toMatchObject({
      id: first.rule.id,
      enabled: false,
      updatedAt: '2026-08-06T09:00:00+02:00',
    })
    expect(second.state.scheduleRules[1]).toEqual(second.rule)
    expect(second.rule.enabled).toBe(true)
  })

  it('semantically removes a rule while retaining occurrence references', () => {
    const first = setFirstRule()
    const occurrence: CueOccurrence = {
      id: 'occurrence-1',
      cueId: 'cue-1',
      source: 'scheduled',
      scheduleRuleId: first.rule.id,
      plannedFor: '2026-08-07T07:30:00Z',
      state: 'planned',
    }
    const state = { ...first.state, occurrences: [occurrence] }
    const removed = removeDailyTargetTimeRule(state, {
      ruleId: first.rule.id,
      at: '2026-08-06T10:00:00+02:00',
    })

    expect(removed.rule.enabled).toBe(false)
    expect(removed.state.scheduleRules).toEqual([removed.rule])
    expect(removed.state.occurrences).toEqual([occurrence])
    expect(removed.state.occurrences[0]?.scheduleRuleId).toBe(removed.rule.id)
  })

  it('retires archived-cue intent without deleting its rule or history', () => {
    const first = setFirstRule()
    const occurrence: CueOccurrence = {
      id: 'occurrence-1',
      cueId: 'cue-1',
      source: 'scheduled',
      scheduleRuleId: first.rule.id,
      plannedFor: '2026-08-07T07:30:00Z',
      state: 'planned',
    }
    const replaced = replaceCue(
      { ...first.state, occurrences: [occurrence] },
      {
        replacedCueId: 'cue-1',
        id: 'cue-2',
        pullText: 'Sugar',
        bSideText: 'Take a short walk',
        at: '2026-08-07T08:00:00+02:00',
      },
    )
    const second = setDailyTargetTimeRule(replaced.state, {
      id: 'schedule-2',
      cueId: 'cue-2',
      localTime: '13:00',
      at: '2026-08-07T08:01:00+02:00',
    })

    expect(second.state.scheduleRules).toHaveLength(2)
    expect(second.state.scheduleRules[0]).toMatchObject({
      id: first.rule.id,
      cueId: 'cue-1',
      enabled: false,
    })
    expect(second.state.scheduleRules[1]).toEqual(second.rule)
    expect(second.state.occurrences).toEqual([occurrence])
  })

  it('rejects mutation of archived rules and non-daily future rules', () => {
    const first = setFirstRule()
    const replaced = replaceCue(first.state, {
      replacedCueId: 'cue-1',
      id: 'cue-2',
      pullText: 'Sugar',
      bSideText: 'Take a short walk',
      at: '2026-08-07T08:00:00+02:00',
    })
    expectDomainErrorCode(
      () =>
        updateDailyTargetTimeRule(replaced.state, {
          ruleId: first.rule.id,
          localTime: '10:00',
          at: '2026-08-07T09:00:00+02:00',
        }),
      'schedule_rule_cue_inactive',
    )

    const windowRule: ScheduleRule = {
      id: 'window-1',
      cueId: 'cue-2',
      kind: 'window',
      daysOfWeek: DAILY_TARGET_TIME_DAYS,
      windowStart: '09:00',
      windowEnd: '17:00',
      enabled: true,
      createdAt: START,
      updatedAt: START,
    }
    expectDomainErrorCode(
      () =>
        removeDailyTargetTimeRule(
          { ...replaced.state, scheduleRules: [windowRule] },
          { ruleId: windowRule.id, at: START },
        ),
      'schedule_rule_kind_conflict',
    )
  })

  it('rejects malformed persisted schedule identity and enabled intent', () => {
    const first = setFirstRule()
    const duplicateRule = { ...first.rule, localTime: '12:00' }
    expectDomainErrorCode(
      () =>
        assertScheduleRuleStateInvariants({
          ...first.state,
          scheduleRules: [first.rule, duplicateRule],
        }),
      'schedule_rule_id_conflict',
    )

    const secondRule = {
      ...first.rule,
      id: 'schedule-2',
      localTime: '12:00',
    }
    expectDomainErrorCode(
      () =>
        assertScheduleRuleStateInvariants({
          ...first.state,
          scheduleRules: [first.rule, secondRule],
        }),
      'schedule_rule_enabled_conflict',
    )

    expectDomainErrorCode(
      () =>
        assertScheduleRuleStateInvariants({
          ...first.state,
          scheduleRules: [{ ...first.rule, localTime: '9:30' }],
        }),
      'invalid_local_time',
    )
  })
})
