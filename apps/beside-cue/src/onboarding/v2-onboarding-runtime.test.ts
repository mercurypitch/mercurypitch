// ============================================================
// V2 onboarding runtime tests — draft, writes and correlation
// ============================================================

import { describe, expect, it } from 'vitest'
import type { V2OnboardingRuntimeEvent, V2OnboardingRuntimeState, } from './v2-onboarding-runtime'
import { createV2OnboardingRuntimeState, reduceV2OnboardingRuntime, V2_ONBOARDING_PHASE_METADATA, } from './v2-onboarding-runtime'

function send(
  state: V2OnboardingRuntimeState,
  event: V2OnboardingRuntimeEvent,
): V2OnboardingRuntimeState {
  return reduceV2OnboardingRuntime(state, event).state
}

function finishPresentation(
  state: V2OnboardingRuntimeState,
  nowMs = 0,
): V2OnboardingRuntimeState {
  const token = state.presentation?.token
  if (token === undefined) throw new Error(`No presentation in ${state.phase}.`)
  return send(state, { type: 'PRESENTATION_COMPLETED', token, nowMs })
}

function reachPullChoice(
  sessionKind: V2OnboardingRuntimeState['sessionKind'] = 'first-run',
): V2OnboardingRuntimeState {
  let state = createV2OnboardingRuntimeState({
    sessionKind,
    motionMode: 'normal',
  })
  state = finishPresentation(state)
  state = send(state, { type: 'BEGIN' })
  state = finishPresentation(state)
  state = finishPresentation(state)
  return state
}

function reachStopHold(
  sessionKind: V2OnboardingRuntimeState['sessionKind'] = 'first-run',
): V2OnboardingRuntimeState {
  let state = reachPullChoice(sessionKind)
  state = send(state, {
    type: 'SELECT_PULL',
    choice: {
      pullId: 'scrolling',
      pullLabel: 'Endless scrolling',
      sideAText: 'Keep scrolling',
    },
  })
  state = send(state, { type: 'CONFIRM_PULL' })
  state = finishPresentation(state)
  state = send(state, {
    type: 'SELECT_CUE_CONTEXT',
    choice: {
      kind: 'suggested',
      suggestionId: 'anchor.scrolling.in-bed',
      text: 'When I get into bed with my phone.',
    },
  })
  state = send(state, { type: 'CONFIRM_CUE_CONTEXT' })
  state = send(state, {
    type: 'SELECT_SIDE_B',
    choice: {
      suggestionId: 'bside.guitar-riff',
      text: 'Play one guitar riff.',
    },
  })
  state = send(state, { type: 'CONFIRM_SIDE_B' })
  state = finishPresentation(state)
  state = finishPresentation(state, 1_000)
  const readiness = state.spinReadiness
  if (readiness === undefined) throw new Error('Expected spin readiness.')
  state = send(state, {
    type: 'SPIN_READY',
    token: readiness.token,
    nowMs: readiness.notBeforeMs,
  })
  return state
}

describe('V2 onboarding runtime', () => {
  it('requires correlated presentation tokens and an explicit Begin', () => {
    let state = createV2OnboardingRuntimeState({
      sessionKind: 'first-run',
      motionMode: 'normal',
    })
    const original = state
    state = send(state, {
      type: 'PRESENTATION_COMPLETED',
      token: 'stale',
      nowMs: 0,
    })
    expect(state).toBe(original)

    state = finishPresentation(state)
    expect(state.phase).toBe('B00_BEGIN_HOLD')
    expect(send(state, { type: 'CONFIRM_PULL' })).toBe(state)
    state = send(state, { type: 'BEGIN' })
    expect(state.phase).toBe('B01_CORKY_GREETING')
  })

  it('keeps selection separate from confirmation at every native decision', () => {
    let state = reachPullChoice()
    state = send(state, {
      type: 'SELECT_PULL',
      choice: {
        pullId: 'avoidance',
        pullLabel: 'Putting it off',
        sideAText: 'Put off beginning',
      },
    })
    expect(state.phase).toBe('B03_PULL_CHOICE_HOLD')
    expect(state.confirmedPull).toBeUndefined()
    state = send(state, { type: 'CONFIRM_PULL' })
    expect(state.phase).toBe('B03_PULL_PRESENTATION')
    expect(state.confirmedPull?.pullId).toBe('avoidance')

    state = finishPresentation(state)
    state = send(state, {
      type: 'SELECT_CUE_CONTEXT',
      choice: { kind: 'omitted' },
    })
    expect(state.phase).toBe('B04_CUE_CONTEXT_HOLD')
    state = send(state, { type: 'CONFIRM_CUE_CONTEXT' })
    expect(state.phase).toBe('B05_SIDE_B_CHOICE_HOLD')
  })

  it('keeps Stop unavailable for the complete rigid-spin dwell', () => {
    let state = reachPullChoice()
    state = send(state, {
      type: 'SELECT_PULL',
      choice: {
        pullId: 'scrolling',
        pullLabel: 'Endless scrolling',
        sideAText: 'Keep scrolling',
      },
    })
    state = send(state, { type: 'CONFIRM_PULL' })
    state = finishPresentation(state)
    state = send(state, {
      type: 'SELECT_CUE_CONTEXT',
      choice: { kind: 'omitted' },
    })
    state = send(state, { type: 'CONFIRM_CUE_CONTEXT' })
    state = send(state, {
      type: 'SELECT_SIDE_B',
      choice: { text: 'Put my phone down.' },
    })
    state = send(state, { type: 'CONFIRM_SIDE_B' })
    state = finishPresentation(state)
    state = finishPresentation(state, 10_000)
    const readiness = state.spinReadiness
    if (readiness === undefined) throw new Error('Expected spin readiness.')

    const early = send(state, {
      type: 'SPIN_READY',
      token: readiness.token,
      nowMs: readiness.notBeforeMs - 1,
    })
    expect(early).toBe(state)
    expect(readiness.notBeforeMs).toBe(11_800)
    state = send(state, {
      type: 'SPIN_READY',
      token: readiness.token,
      nowMs: readiness.notBeforeMs,
    })
    expect(state.phase).toBe('B06_STOP_SAVE_HOLD')
  })

  it('freezes the exact visible draft and emits one correlated first-run save', () => {
    const state = reachStopHold()
    const transition = reduceV2OnboardingRuntime(state, {
      type: 'STOP_AND_SAVE',
    })

    expect(transition.effects).toEqual([
      {
        type: 'SAVE_PLAN',
        requestId: 1,
        plan: {
          pullId: 'scrolling',
          pullLabel: 'Endless scrolling',
          sideAText: 'Keep scrolling',
          cueContextSuggestionId: 'anchor.scrolling.in-bed',
          cueContextText: 'When I get into bed with my phone.',
          bSideSuggestionId: 'bside.guitar-riff',
          bSideText: 'Play one guitar riff.',
        },
      },
    ])
    expect(transition.state.phase).toBe('B06_SAVE_COMMIT')
    expect(Object.isFrozen(transition.state.frozenPlan)).toBe(true)

    const rapid = reduceV2OnboardingRuntime(transition.state, {
      type: 'STOP_AND_SAVE',
    })
    expect(rapid.state).toBe(transition.state)
    expect(rapid.effects).toEqual([])
  })

  it('ignores stale save results and retries the same frozen draft after failure', () => {
    let transition = reduceV2OnboardingRuntime(reachStopHold(), {
      type: 'STOP_AND_SAVE',
    })
    const pending = transition.state
    expect(send(pending, { type: 'PLAN_SAVE_SUCCEEDED', requestId: 99 })).toBe(
      pending,
    )

    const state = send(pending, {
      type: 'PLAN_SAVE_FAILED',
      requestId: 1,
      message: 'Could not save this plan.',
    })
    expect(state.phase).toBe('B06_STOP_SAVE_HOLD')
    expect(state.saveError).toBe('Could not save this plan.')
    const frozen = state.frozenPlan

    transition = reduceV2OnboardingRuntime(state, { type: 'STOP_AND_SAVE' })
    expect(transition.effects[0]).toMatchObject({
      type: 'SAVE_PLAN',
      requestId: 2,
      plan: frozen,
    })
  })

  it('keeps replay and developer navigation permanently write-free', () => {
    for (const sessionKind of ['replay', 'developer-review'] as const) {
      const transition = reduceV2OnboardingRuntime(reachStopHold(sessionKind), {
        type: 'STOP_AND_SAVE',
      })
      expect(transition.effects).toEqual([])
      expect(transition.state.phase).toBe('B07_SAVED_ACK')
    }

    const firstRun = reachStopHold('first-run')
    expect(
      send(firstRun, {
        type: 'REVIEW_NAVIGATE',
        phase: 'B03_PULL_CHOICE_HOLD',
      }),
    ).toBe(firstRun)

    let state = reachStopHold('developer-review')
    state = send(state, {
      type: 'REVIEW_NAVIGATE',
      phase: 'B06_STOP_SAVE_HOLD',
    })
    expect(state.sessionKind).toBe('developer-review')
    const transition = reduceV2OnboardingRuntime(state, {
      type: 'STOP_AND_SAVE',
    })
    expect(transition.effects).toEqual([])
  })

  it('gives a developer replay a fresh presentation token', () => {
    const state = createV2OnboardingRuntimeState({
      sessionKind: 'developer-review',
      motionMode: 'normal',
    })
    const oldToken = state.presentation?.token
    if (oldToken === undefined) throw new Error('Expected opening token.')

    const restarted = send(state, { type: 'REVIEW_REPLAY' })
    expect(restarted.presentation?.token).not.toBe(oldToken)
    expect(
      send(restarted, {
        type: 'PRESENTATION_COMPLETED',
        token: oldToken,
        nowMs: 0,
      }),
    ).toBe(restarted)
  })

  it('correlates reminder writes and keeps failure optional and retryable', () => {
    let state = reduceV2OnboardingRuntime(reachStopHold(), {
      type: 'STOP_AND_SAVE',
    }).state
    state = send(state, { type: 'PLAN_SAVE_SUCCEEDED', requestId: 1 })
    state = finishPresentation(state)
    expect(state.phase).toBe('B07_REMINDER_HOLD')
    state = send(state, { type: 'SELECT_REMINDER', localTime: '20:30' })
    const transition = reduceV2OnboardingRuntime(state, {
      type: 'CONFIRM_REMINDER',
    })
    expect(transition.effects).toEqual([
      { type: 'SET_REMINDER', requestId: 2, localTime: '20:30' },
    ])
    expect(
      send(transition.state, { type: 'REMINDER_SUCCEEDED', requestId: 7 }),
    ).toBe(transition.state)

    state = send(transition.state, {
      type: 'REMINDER_FAILED',
      requestId: 2,
      message: 'Reminder unavailable.',
    })
    expect(state.phase).toBe('B07_REMINDER_HOLD')
    expect(state.reminderError).toBe('Reminder unavailable.')
    expect(send(state, { type: 'SKIP_REMINDER' }).phase).toBe('B08_CLOSE_HOME')
  })

  it('binds the eight frozen onboarding captions to the authored phases', () => {
    expect(
      Object.values(V2_ONBOARDING_PHASE_METADATA)
        .map(({ lineId }) => lineId)
        .filter((lineId): lineId is string => lineId !== undefined),
    ).toEqual([
      'corky.onboarding.greeting',
      'corky.onboarding.pull-choice',
      'corky.onboarding.cue-context',
      'corky.onboarding.sides',
      'corky.onboarding.spin',
      'corky.onboarding.saved',
      'corky.onboarding.reminder',
      'corky.onboarding.close',
    ])
  })
})
