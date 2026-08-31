import { describe, expect, it } from 'vitest'
import { activateCue, createCue, pauseCue, replaceCue, resumeCue, } from './cue-operations'
import { CueDomainError } from './errors'
import { createInitialState } from './state'
import { CueTextValidationError } from './text'

const FIRST_INPUT = {
  id: 'cue-1',
  pullText: '  Doom   scrolling ',
  bSideText: ' Play guitar ',
  cueContextSuggestionId: 'anchor.scrolling.in-bed',
  cueContextText: '  When I get into bed with my phone. ',
  at: '2026-08-06T08:00:00+02:00',
} as const

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

describe('cue lifecycle', () => {
  it('creates a draft and permits only one active cue', () => {
    const first = createCue(createInitialState(), FIRST_INPUT)
    const second = createCue(first.state, {
      ...FIRST_INPUT,
      id: 'cue-2',
    })
    const active = activateCue(
      second.state,
      'cue-1',
      '2026-08-06T08:01:00+02:00',
    )

    expect(active.cue).toMatchObject({
      id: 'cue-1',
      status: 'active',
      pullText: 'Doom scrolling',
      bSideText: 'Play guitar',
      cueContextSuggestionId: 'anchor.scrolling.in-bed',
      cueContextText: 'When I get into bed with my phone.',
    })
    expect(() =>
      activateCue(active.state, 'cue-2', '2026-08-06T08:02:00+02:00'),
    ).toThrowError(CueDomainError)
    expect(
      active.state.cues.filter((cue) => cue.status === 'active'),
    ).toHaveLength(1)
  })

  it('omits cue context properties when no context is chosen', () => {
    const created = createCue(createInitialState(), {
      id: 'cue-legacy',
      pullText: 'Doom scrolling',
      bSideText: 'Play guitar',
      at: FIRST_INPUT.at,
    })

    expect(created.cue).not.toHaveProperty('cueContextSuggestionId')
    expect(created.cue).not.toHaveProperty('cueContextText')
  })

  it('pauses and resumes without losing the cue', () => {
    const created = createCue(createInitialState(), FIRST_INPUT)
    const active = activateCue(created.state, 'cue-1', FIRST_INPUT.at)
    const paused = pauseCue(active.state, 'cue-1', '2026-08-06T09:00:00+02:00')
    const resumed = resumeCue(
      paused.state,
      'cue-1',
      '2026-08-06T10:00:00+02:00',
    )

    expect(paused.cue.status).toBe('paused')
    expect(resumed.cue).toMatchObject({
      status: 'active',
      cueContextSuggestionId: 'anchor.scrolling.in-bed',
      cueContextText: 'When I get into bed with my phone.',
    })
    expect(resumed.state.cues).toHaveLength(1)
  })

  it('atomically archives the previous cue and activates its replacement', () => {
    const created = createCue(createInitialState(), FIRST_INPUT)
    const active = activateCue(created.state, 'cue-1', FIRST_INPUT.at)
    const replaced = replaceCue(active.state, {
      replacedCueId: 'cue-1',
      id: 'cue-2',
      pullText: 'Sugar',
      bSideText: 'Take a short walk',
      cueContextText: '  After lunch. ',
      at: '2026-08-07T08:00:00+02:00',
    })

    expect(replaced.cue).toMatchObject({
      status: 'active',
      cueContextText: 'After lunch.',
    })
    expect(replaced.cue).not.toHaveProperty('cueContextSuggestionId')
    expect(replaced.state.cues).toHaveLength(2)
    expect(replaced.state.cues[0]).toMatchObject({
      id: 'cue-1',
      status: 'archived',
      cueContextSuggestionId: 'anchor.scrolling.in-bed',
      cueContextText: 'When I get into bed with my phone.',
      archivedAt: '2026-08-07T08:00:00+02:00',
    })
    expect(
      replaced.state.cues.filter((cue) => cue.status === 'active'),
    ).toEqual([replaced.cue])
  })

  it('leaves the original snapshot untouched when replacement is invalid', () => {
    const created = createCue(createInitialState(), FIRST_INPUT)
    const active = activateCue(created.state, 'cue-1', FIRST_INPUT.at)

    expect(() =>
      replaceCue(active.state, {
        replacedCueId: 'cue-1',
        id: 'cue-2',
        pullText: 'Sugar',
        bSideText: 'Take a short walk',
        cueContextSuggestionId: 'anchor.sugar.after-lunch',
        at: '2026-08-07T08:00:00+02:00',
      }),
    ).toThrowError(CueTextValidationError)
    expect(active.state.cues).toHaveLength(1)
    expect(active.state.cues[0].status).toBe('active')
  })

  it.each(['', ' ', ' anchor.scrolling.in-bed '])(
    'rejects a noncanonical cue context suggestion id %j before mutation',
    (cueContextSuggestionId) => {
      const created = createCue(createInitialState(), FIRST_INPUT)
      const active = activateCue(created.state, 'cue-1', FIRST_INPUT.at)

      expectDomainErrorCode(
        () =>
          replaceCue(active.state, {
            replacedCueId: 'cue-1',
            id: 'cue-2',
            pullText: 'Sugar',
            bSideText: 'Take a short walk',
            cueContextSuggestionId,
            cueContextText: 'After lunch.',
            at: '2026-08-07T08:00:00+02:00',
          }),
        'invalid_cue_context_suggestion_id',
      )
      expect(active.state.cues).toEqual([active.cue])
    },
  )

  it('rejects duplicate persisted cue ids before mutating any record', () => {
    const created = createCue(createInitialState(), FIRST_INPUT)
    const active = activateCue(created.state, 'cue-1', FIRST_INPUT.at)
    const corrupted = {
      ...active.state,
      cues: [active.cue, { ...active.cue, status: 'paused' as const }],
    }

    const mutations = [
      () =>
        createCue(corrupted, {
          ...FIRST_INPUT,
          id: 'cue-2',
        }),
      () => activateCue(corrupted, 'cue-1', '2026-08-06T09:00:00+02:00'),
      () => pauseCue(corrupted, 'cue-1', '2026-08-06T09:00:00+02:00'),
      () => resumeCue(corrupted, 'cue-1', '2026-08-06T09:00:00+02:00'),
      () =>
        replaceCue(corrupted, {
          replacedCueId: 'cue-1',
          id: 'cue-2',
          pullText: 'Sugar',
          bSideText: 'Take a short walk',
          at: '2026-08-06T09:00:00+02:00',
        }),
    ]

    for (const mutate of mutations) {
      expectDomainErrorCode(mutate, 'cue_id_conflict')
    }
    expect(corrupted.cues).toHaveLength(2)
  })
})
