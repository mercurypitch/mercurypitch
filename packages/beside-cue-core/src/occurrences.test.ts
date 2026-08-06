import { describe, expect, it } from 'vitest'
import { CueDomainError } from './errors'
import { assertOccurrenceStateInvariants, cancelCueOccurrence, createManualOccurrence, createScheduledOccurrence, presentCueOccurrence, recordOccurrenceOutcome, } from './occurrences'
import { aggregateSevenDayBSides } from './progress'
import { createInitialState } from './state'
import type { BesideCueStateV1, Cue, CueOccurrence, TargetTimeScheduleRule, } from './types'

function cue(id: string, status: Cue['status']): Cue {
  return {
    id,
    status,
    pullText: `Pull ${id}`,
    bSideText: `B-side ${id}`,
    mascotSetId: 'corktop-v1',
    createdAt: '2026-07-01T08:00:00+02:00',
    updatedAt: '2026-08-01T08:00:00+02:00',
  }
}

function presented(id: string, cueId: string): CueOccurrence {
  return {
    id,
    cueId,
    source: 'manual',
    state: 'presented',
    openedAt: '2026-08-06T08:00:00+02:00',
  }
}

function planned(id: string, cueId: string): CueOccurrence {
  return {
    id,
    cueId,
    source: 'scheduled',
    state: 'planned',
    scheduleRuleId: 'schedule-1',
    plannedFor: '2026-08-06T08:00:00+02:00',
  }
}

function withOccurrences(
  occurrences: readonly CueOccurrence[],
): BesideCueStateV1 {
  return {
    ...createInitialState(),
    cues: [
      cue('active', 'active'),
      cue('paused', 'paused'),
      cue('old', 'archived'),
    ],
    occurrences,
  }
}

function withSchedule(
  overrides: Partial<TargetTimeScheduleRule> = {},
  occurrences: readonly CueOccurrence[] = [],
): BesideCueStateV1 {
  const rule: TargetTimeScheduleRule = {
    id: 'schedule-1',
    cueId: 'active',
    kind: 'target_time',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    localTime: '09:00',
    enabled: true,
    createdAt: '2026-08-06T08:00:00+02:00',
    updatedAt: '2026-08-06T08:00:00+02:00',
    ...overrides,
  }

  return { ...withOccurrences(occurrences), scheduleRules: [rule] }
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

describe('cue occurrence lifecycle', () => {
  it('creates and presents a unique manual occurrence for the active cue', () => {
    const state = withOccurrences([])
    const result = createManualOccurrence(state, {
      id: 'manual-1',
      cueId: 'active',
      at: '2026-08-06T08:05:00+02:00',
    })

    expect(result.occurrence).toEqual({
      id: 'manual-1',
      cueId: 'active',
      source: 'manual',
      state: 'presented',
      openedAt: '2026-08-06T08:05:00+02:00',
    })
    expect(result.state.occurrences).toEqual([result.occurrence])
    expect(state.occurrences).toEqual([])
  })

  it('rejects empty or duplicate occurrence ids', () => {
    const state = withOccurrences([presented('existing', 'active')])

    expectDomainErrorCode(
      () =>
        createManualOccurrence(state, {
          id: '   ',
          cueId: 'active',
          at: '2026-08-06T08:05:00+02:00',
        }),
      'invalid_occurrence_id',
    )
    expectDomainErrorCode(
      () =>
        createManualOccurrence(state, {
          id: 'existing',
          cueId: 'active',
          at: '2026-08-06T08:05:00+02:00',
        }),
      'occurrence_id_conflict',
    )
  })

  it('requires an existing active cue for a manual occurrence', () => {
    const state = withOccurrences([])

    expectDomainErrorCode(
      () =>
        createManualOccurrence(state, {
          id: 'manual-paused',
          cueId: 'paused',
          at: '2026-08-06T08:05:00+02:00',
        }),
      'occurrence_cue_inactive',
    )
    expectDomainErrorCode(
      () =>
        createManualOccurrence(state, {
          id: 'manual-missing',
          cueId: 'missing',
          at: '2026-08-06T08:05:00+02:00',
        }),
      'cue_not_found',
    )
  })

  it('creates a planned scheduled occurrence for one enabled matching rule', () => {
    const state = withSchedule()
    const result = createScheduledOccurrence(state, {
      id: 'scheduled-1',
      cueId: 'active',
      scheduleRuleId: 'schedule-1',
      plannedFor: '2026-08-07T09:00:00+02:00',
    })

    expect(result.occurrence).toEqual({
      id: 'scheduled-1',
      cueId: 'active',
      source: 'scheduled',
      scheduleRuleId: 'schedule-1',
      plannedFor: '2026-08-07T09:00:00+02:00',
      state: 'planned',
    })
    expect(result.state.occurrences).toEqual([result.occurrence])
    expect(state.occurrences).toEqual([])
  })

  it('requires a present, enabled schedule rule belonging to the cue', () => {
    const input = {
      id: 'scheduled-1',
      cueId: 'active',
      scheduleRuleId: 'schedule-1',
      plannedFor: '2026-08-07T09:00:00+02:00',
    } as const

    expectDomainErrorCode(
      () =>
        createScheduledOccurrence(
          { ...withOccurrences([]), scheduleRules: [] },
          input,
        ),
      'schedule_rule_not_found',
    )
    expectDomainErrorCode(
      () => createScheduledOccurrence(withSchedule({ enabled: false }), input),
      'occurrence_schedule_rule_disabled',
    )
    expectDomainErrorCode(
      () => createScheduledOccurrence(withSchedule({ cueId: 'paused' }), input),
      'occurrence_schedule_rule_mismatch',
    )
  })

  it('requires the scheduled occurrence cue to be active', () => {
    const state = withSchedule({ cueId: 'paused' })

    expectDomainErrorCode(
      () =>
        createScheduledOccurrence(state, {
          id: 'scheduled-1',
          cueId: 'paused',
          scheduleRuleId: 'schedule-1',
          plannedFor: '2026-08-07T09:00:00+02:00',
        }),
      'occurrence_cue_inactive',
    )
  })

  it('rejects a reused identity for a scheduled occurrence', () => {
    const state = withSchedule({}, [planned('scheduled-1', 'active')])

    expectDomainErrorCode(
      () =>
        createScheduledOccurrence(state, {
          id: 'scheduled-1',
          cueId: 'active',
          scheduleRuleId: 'schedule-1',
          plannedFor: '2026-08-07T09:00:00+02:00',
        }),
      'occurrence_id_conflict',
    )
  })

  it('presents a planned occurrence only while its cue is active', () => {
    const activeState = withOccurrences([planned('scheduled-1', 'active')])
    const presentedResult = presentCueOccurrence(activeState, {
      occurrenceId: 'scheduled-1',
      openedAt: '2026-08-06T08:01:00+02:00',
    })

    expect(presentedResult.occurrence).toMatchObject({
      id: 'scheduled-1',
      state: 'presented',
      openedAt: '2026-08-06T08:01:00+02:00',
    })
    expect(
      presentCueOccurrence(presentedResult.state, {
        occurrenceId: 'scheduled-1',
        openedAt: '2026-08-06T08:02:00+02:00',
      }).state,
    ).toBe(presentedResult.state)

    const pausedState = withOccurrences([planned('scheduled-2', 'paused')])
    expectDomainErrorCode(
      () =>
        presentCueOccurrence(pausedState, {
          occurrenceId: 'scheduled-2',
          openedAt: '2026-08-06T08:01:00+02:00',
        }),
      'occurrence_cue_inactive',
    )
  })

  it('cancels an unresolved occurrence and prevents a later outcome', () => {
    const state = withOccurrences([presented('manual-1', 'active')])
    const cancelled = cancelCueOccurrence(state, {
      occurrenceId: 'manual-1',
    })

    expect(cancelled.occurrence.state).toBe('cancelled')
    expect(
      cancelCueOccurrence(cancelled.state, { occurrenceId: 'manual-1' }).state,
    ).toBe(cancelled.state)
    expectDomainErrorCode(
      () =>
        recordOccurrenceOutcome(cancelled.state, {
          occurrenceId: 'manual-1',
          outcome: 'b_side',
          outcomeAt: '2026-08-06T08:02:00+02:00',
          outcomeLocalDate: '2026-08-06',
        }),
      'occurrence_state_conflict',
    )
  })

  it('rejects impossible persisted lifecycle shapes before transitioning', () => {
    const impossibleManualPlan = {
      id: 'invalid',
      cueId: 'active',
      source: 'manual',
      state: 'planned',
    } as unknown as CueOccurrence
    const state = withOccurrences([
      planned('scheduled-1', 'active'),
      impossibleManualPlan,
    ])

    expectDomainErrorCode(
      () => assertOccurrenceStateInvariants(state),
      'occurrence_state_conflict',
    )
    expectDomainErrorCode(
      () =>
        presentCueOccurrence(state, {
          occurrenceId: 'scheduled-1',
          openedAt: '2026-08-06T08:01:00+02:00',
        }),
      'occurrence_state_conflict',
    )
    expect(state.occurrences[0]?.state).toBe('planned')
  })
})

describe('recordOccurrenceOutcome', () => {
  it('records one outcome and treats an identical retry as a no-op', () => {
    const state = withOccurrences([presented('occurrence-1', 'active')])
    const input = {
      occurrenceId: 'occurrence-1',
      outcome: 'b_side',
      outcomeAt: '2026-08-06T08:01:00+02:00',
      outcomeLocalDate: '2026-08-06',
    } as const
    const first = recordOccurrenceOutcome(state, input)
    const retry = recordOccurrenceOutcome(first.state, {
      ...input,
      outcomeAt: '2026-08-06T08:02:00+02:00',
    })

    expect(first.recorded).toBe(true)
    expect(first.occurrence).toMatchObject({
      state: 'resolved',
      outcome: 'b_side',
      outcomeAt: input.outcomeAt,
    })
    expect(retry.recorded).toBe(false)
    expect(retry.state).toBe(first.state)
    expect(retry.occurrence).toBe(first.occurrence)
  })

  it('refuses to overwrite an occurrence with a different outcome', () => {
    const state = withOccurrences([presented('occurrence-1', 'active')])
    const first = recordOccurrenceOutcome(state, {
      occurrenceId: 'occurrence-1',
      outcome: 'b_side',
      outcomeAt: '2026-08-06T08:01:00+02:00',
      outcomeLocalDate: '2026-08-06',
    })

    expect(() =>
      recordOccurrenceOutcome(first.state, {
        occurrenceId: 'occurrence-1',
        outcome: 'not_now',
        outcomeAt: '2026-08-06T08:02:00+02:00',
        outcomeLocalDate: '2026-08-06',
      }),
    ).toThrowError(CueDomainError)
    expect(first.occurrence.outcome).toBe('b_side')
  })

  it('requires an occurrence to be presented before recording an outcome', () => {
    const state = withOccurrences([planned('scheduled-1', 'active')])

    expectDomainErrorCode(
      () =>
        recordOccurrenceOutcome(state, {
          occurrenceId: 'scheduled-1',
          outcome: 'b_side',
          outcomeAt: '2026-08-06T08:01:00+02:00',
          outcomeLocalDate: '2026-08-06',
        }),
      'occurrence_state_conflict',
    )
  })
})

describe('aggregateSevenDayBSides', () => {
  it('counts B-side choices from active, paused, and archived cue history', () => {
    let state = withOccurrences([
      presented('outside', 'old'),
      presented('from-active', 'active'),
      presented('from-paused', 'paused'),
      presented('from-archived', 'old'),
      presented('not-now', 'active'),
    ])
    const outcomes = [
      ['outside', 'b_side', '2026-07-30'],
      ['from-active', 'b_side', '2026-08-01'],
      ['from-paused', 'b_side', '2026-08-04'],
      ['from-archived', 'b_side', '2026-08-06'],
      ['not-now', 'not_now', '2026-08-06'],
    ] as const

    for (const [occurrenceId, outcome, outcomeLocalDate] of outcomes) {
      state = recordOccurrenceOutcome(state, {
        occurrenceId,
        outcome,
        outcomeAt: `${outcomeLocalDate}T12:00:00+02:00`,
        outcomeLocalDate,
      }).state
    }

    expect(aggregateSevenDayBSides(state, '2026-08-06')).toEqual({
      startDate: '2026-07-31',
      endDate: '2026-08-06',
      today: 1,
      total: 3,
      days: [
        { date: '2026-07-31', count: 0 },
        { date: '2026-08-01', count: 1 },
        { date: '2026-08-02', count: 0 },
        { date: '2026-08-03', count: 0 },
        { date: '2026-08-04', count: 1 },
        { date: '2026-08-05', count: 0 },
        { date: '2026-08-06', count: 1 },
      ],
    })
  })

  it('rejects duplicate persisted occurrence ids instead of double-counting', () => {
    const duplicate = presented('duplicate', 'active')
    const state = withOccurrences([duplicate, { ...duplicate }])

    expectDomainErrorCode(
      () => aggregateSevenDayBSides(state, '2026-08-06'),
      'occurrence_id_conflict',
    )
  })
})
