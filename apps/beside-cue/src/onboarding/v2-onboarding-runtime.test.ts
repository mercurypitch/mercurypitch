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

function finishPlatterStop(
  state: V2OnboardingRuntimeState,
): V2OnboardingRuntimeState {
  const token = state.stopCommit?.token
  if (token === undefined) throw new Error('Expected a stop commit token.')
  return send(state, { type: 'PLATTER_STOPPED', token })
}

function reachPullChoice(
  sessionKind: V2OnboardingRuntimeState['sessionKind'] = 'first-run',
  motionMode: V2OnboardingRuntimeState['motionMode'] = 'normal',
): V2OnboardingRuntimeState {
  let state = createV2OnboardingRuntimeState({
    sessionKind,
    motionMode,
  })
  state = finishPresentation(state)
  state = send(state, { type: 'BEGIN' })
  state = finishPresentation(state)
  state = finishPresentation(state)
  return state
}

function reachStopHold(
  sessionKind: V2OnboardingRuntimeState['sessionKind'] = 'first-run',
  motionMode: V2OnboardingRuntimeState['motionMode'] = 'normal',
): V2OnboardingRuntimeState {
  let state = reachPullChoice(sessionKind, motionMode)
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
    expect(transition.state.stopCommit).toEqual({
      token: expect.stringMatching(/^v2-platter-stop:\d+$/),
      platterStatus: 'stopping',
      planStatus: 'pending',
    })

    const rapid = reduceV2OnboardingRuntime(transition.state, {
      type: 'STOP_AND_SAVE',
    })
    expect(rapid.state).toBe(transition.state)
    expect(rapid.effects).toEqual([])
  })

  it('waits for a correlated platter stop after the plan save succeeds', () => {
    const transition = reduceV2OnboardingRuntime(reachStopHold(), {
      type: 'STOP_AND_SAVE',
    })
    const pending = transition.state
    const token = pending.stopCommit?.token
    if (token === undefined) throw new Error('Expected a stop commit token.')

    let state = send(pending, {
      type: 'PLAN_SAVE_SUCCEEDED',
      requestId: 1,
    })
    expect(state.phase).toBe('B06_SAVE_COMMIT')
    expect(state.pendingSave).toBeUndefined()
    expect(state.stopCommit?.planStatus).toBe('saved')
    expect(
      send(state, { type: 'PLATTER_STOPPED', token: `${token}:stale` }),
    ).toBe(state)

    state = finishPlatterStop(state)
    expect(state.phase).toBe('B07_SAVED_ACK')
    expect(state.stopCommit).toBeUndefined()
  })

  it('invalidates an unfinished stop when save fails and requires both fresh retry completions', () => {
    let transition = reduceV2OnboardingRuntime(reachStopHold(), {
      type: 'STOP_AND_SAVE',
    })
    const pending = transition.state
    const oldToken = pending.stopCommit?.token
    if (oldToken === undefined) throw new Error('Expected a stop commit token.')
    expect(send(pending, { type: 'PLAN_SAVE_SUCCEEDED', requestId: 99 })).toBe(
      pending,
    )

    let state = send(pending, {
      type: 'PLAN_SAVE_FAILED',
      requestId: 1,
      message: 'Could not save this plan.',
    })
    expect(state.phase).toBe('B06_STOP_SAVE_HOLD')
    expect(state.saveError).toBe('Could not save this plan.')
    expect(state.stopCommit).toBeUndefined()
    const frozen = state.frozenPlan
    expect(send(state, { type: 'PLATTER_STOPPED', token: oldToken })).toBe(
      state,
    )

    transition = reduceV2OnboardingRuntime(state, { type: 'STOP_AND_SAVE' })
    expect(transition.effects[0]).toMatchObject({
      type: 'SAVE_PLAN',
      requestId: 2,
      plan: frozen,
    })
    const newToken = transition.state.stopCommit?.token
    if (newToken === undefined) throw new Error('Expected a retry stop token.')
    expect(newToken).not.toBe(oldToken)

    state = send(transition.state, {
      type: 'PLAN_SAVE_SUCCEEDED',
      requestId: 2,
    })
    expect(state.phase).toBe('B06_SAVE_COMMIT')
    expect(send(state, { type: 'PLATTER_STOPPED', token: oldToken })).toBe(
      state,
    )
    state = send(state, { type: 'PLATTER_STOPPED', token: newToken })
    expect(state.phase).toBe('B07_SAVED_ACK')
  })

  it('invalidates an already completed stop when save fails before retry', () => {
    let transition = reduceV2OnboardingRuntime(reachStopHold(), {
      type: 'STOP_AND_SAVE',
    })
    const oldToken = transition.state.stopCommit?.token
    if (oldToken === undefined) throw new Error('Expected a stop commit token.')
    let state = finishPlatterStop(transition.state)
    expect(state.stopCommit?.platterStatus).toBe('stopped')

    state = send(state, {
      type: 'PLAN_SAVE_FAILED',
      requestId: 1,
      message: 'Try again.',
    })
    expect(state.phase).toBe('B06_STOP_SAVE_HOLD')
    expect(state.stopCommit).toBeUndefined()

    transition = reduceV2OnboardingRuntime(state, { type: 'STOP_AND_SAVE' })
    expect(transition.state.stopCommit).toMatchObject({
      platterStatus: 'stopping',
      planStatus: 'pending',
    })
    expect(transition.state.stopCommit?.token).not.toBe(oldToken)
    state = finishPlatterStop(transition.state)
    expect(state.phase).toBe('B06_SAVE_COMMIT')

    state = send(state, { type: 'PLAN_SAVE_SUCCEEDED', requestId: 2 })
    expect(state.phase).toBe('B07_SAVED_ACK')
  })

  it('waits for the platter stop in reduced, replay and developer sessions without writing', () => {
    for (const sessionKind of ['replay', 'developer-review'] as const) {
      const transition = reduceV2OnboardingRuntime(
        reachStopHold(sessionKind, 'reduced'),
        { type: 'STOP_AND_SAVE' },
      )
      expect(transition.effects).toEqual([])
      expect(transition.state.phase).toBe('B06_SAVE_COMMIT')
      expect(transition.state.stopCommit?.planStatus).toBe('write-free')
      expect(finishPlatterStop(transition.state).phase).toBe('B07_SAVED_ACK')
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

  it('keeps Back and review resets free of prior platter-stop callbacks', () => {
    let transition = reduceV2OnboardingRuntime(reachStopHold(), {
      type: 'STOP_AND_SAVE',
    })
    const firstToken = transition.state.stopCommit?.token
    if (firstToken === undefined)
      throw new Error('Expected a stop commit token.')
    const failedCommit = send(transition.state, {
      type: 'PLAN_SAVE_FAILED',
      requestId: 1,
      message: 'Try again.',
    })
    expect(failedCommit.stopCommit).toBeUndefined()

    let state = send(failedCommit, { type: 'BACK' })
    expect(state.phase).toBe('B05_SIDE_B_CHOICE_HOLD')
    expect(state.stopCommit).toBeUndefined()
    expect(state.frozenPlan).toBeUndefined()
    expect(send(state, { type: 'PLATTER_STOPPED', token: firstToken })).toBe(
      state,
    )

    transition = reduceV2OnboardingRuntime(reachStopHold('developer-review'), {
      type: 'STOP_AND_SAVE',
    })
    const reviewToken = transition.state.stopCommit?.token
    if (reviewToken === undefined) {
      throw new Error('Expected a review stop commit token.')
    }
    state = send(transition.state, {
      type: 'REVIEW_NAVIGATE',
      phase: 'B06_STOP_SAVE_HOLD',
    })
    expect(state.stopCommit).toBeUndefined()
    expect(send(state, { type: 'PLATTER_STOPPED', token: reviewToken })).toBe(
      state,
    )

    transition = reduceV2OnboardingRuntime(state, { type: 'STOP_AND_SAVE' })
    expect(transition.state.stopCommit?.token).not.toBe(reviewToken)
    state = send(transition.state, { type: 'REVIEW_REPLAY' })
    expect(state.phase).toBe('B00_BRAND_REVEAL')
    expect(state.stopCommit).toBeUndefined()
  })

  it('correlates reminder writes and keeps failure optional and retryable', () => {
    let state = reduceV2OnboardingRuntime(reachStopHold(), {
      type: 'STOP_AND_SAVE',
    }).state
    state = send(state, { type: 'PLAN_SAVE_SUCCEEDED', requestId: 1 })
    expect(state.phase).toBe('B06_SAVE_COMMIT')
    state = finishPlatterStop(state)
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
