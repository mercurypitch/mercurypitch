// ============================================================
// Cinematic onboarding timeline tests — v0.2 timing and runtime gates
// ============================================================

import { describe, expect, it } from 'vitest'
import type { CinematicOnboardingRuntimeEvent, CinematicOnboardingRuntimeInput, CinematicOnboardingRuntimeState, CinematicOnboardingSegmentId, } from './cinematic-onboarding-timeline'
import { CINEMATIC_ONBOARDING_TIMELINE_V0_2, createCinematicOnboardingRuntime, getCinematicOnboardingReducedDwellMilliseconds, getCinematicOnboardingRuntimePosition, updateCinematicOnboardingRuntime, } from './cinematic-onboarding-timeline'

function currentSegmentId(
  state: CinematicOnboardingRuntimeState,
): CinematicOnboardingSegmentId {
  const segmentId = getCinematicOnboardingRuntimePosition(state)?.segment.id
  if (segmentId === undefined) {
    throw new Error('The completed runtime has no current segment.')
  }

  return segmentId
}

function currentPlaybackAttempt(
  state: CinematicOnboardingRuntimeState,
): number {
  if (
    state.status !== 'loading' &&
    state.status !== 'playing' &&
    state.status !== 'error'
  ) {
    throw new Error(`${state.status} has no media playback attempt.`)
  }

  return state.playbackAttempt
}

function finishCurrentAutomaticSegment(
  state: CinematicOnboardingRuntimeState,
): CinematicOnboardingRuntimeState {
  let current = state
  if (current.status === 'loading') {
    current = updateCinematicOnboardingRuntime(current, {
      type: 'MEDIA_READY',
      segmentId: currentSegmentId(current),
      playbackAttempt: currentPlaybackAttempt(current),
    })
  }
  if (current.status !== 'playing') {
    throw new Error(`Expected playing state, received ${current.status}.`)
  }

  return updateCinematicOnboardingRuntime(current, {
    type: 'MEDIA_ENDED',
    segmentId: currentSegmentId(current),
    playbackAttempt: currentPlaybackAttempt(current),
  })
}

function advanceToNextHold(
  state: CinematicOnboardingRuntimeState,
): CinematicOnboardingRuntimeState {
  let current = state
  for (let step = 0; step < 14; step += 1) {
    if (current.status === 'holding') {
      return current
    }
    if (current.status === 'complete' || current.status === 'error') {
      throw new Error(`Expected another hold, received ${current.status}.`)
    }

    current = finishCurrentAutomaticSegment(current)
  }

  throw new Error('Runtime did not reach a hold within fourteen segments.')
}

function completeRuntime(): CinematicOnboardingRuntimeState {
  const events: readonly CinematicOnboardingRuntimeEvent[] = [
    'user_taps_or_confirms_the_scroll',
    'user_completes_or_skips_sorting',
    'user_spins_and_stops_record',
    'user_sets_or_skips_reminder',
  ]
  let state = createCinematicOnboardingRuntime()

  for (const event of events) {
    state = advanceToNextHold(state)
    state = updateCinematicOnboardingRuntime(state, {
      type: 'USER_EVENT',
      event,
    })
  }

  while (state.status !== 'complete') {
    state = finishCurrentAutomaticSegment(state)
  }

  return state
}

describe('cinematic onboarding timeline', () => {
  it('keeps the approved eight shots and fourteen segments in order', () => {
    const shots = CINEMATIC_ONBOARDING_TIMELINE_V0_2.shots

    expect(
      shots.map((shot) => ({
        id: shot.id,
        segments: shot.segments.map((segment) => [
          segment.id,
          segment.reviewDurationFrames,
        ]),
      })),
    ).toEqual([
      { id: 'S01_EDGE_ENTRANCE', segments: [['S01_AUTO_ENTER', 48]] },
      { id: 'S02_HELLO', segments: [['S02_AUTO_HELLO', 48]] },
      {
        id: 'S03_TABLE_TRANSITION',
        segments: [['S03_AUTO_TRACKED_TRANSITION', 48]],
      },
      {
        id: 'S04_CUE_ARRIVAL',
        segments: [
          ['S04_AUTO_CUE_ENTRANCE', 24],
          ['S04_SIM_CUE_TAP_HOLD', 24],
        ],
      },
      {
        id: 'S05_SORT_SIDES',
        segments: [
          ['S05_AUTO_REFAME_SORT', 24],
          ['S05_SIM_SORT_HOLD', 96],
        ],
      },
      {
        id: 'S06_SPIN_AND_STOP',
        segments: [
          ['S06_AUTO_CORKY_PRESS', 48],
          ['S06_SIM_USER_SPIN_STOP_HOLD', 48],
          ['S06_AUTO_STOP_SETTLE', 24],
        ],
      },
      {
        id: 'S07_REACTION_REMINDER',
        segments: [
          ['S07_AUTO_REACTION_DIAL_REVEAL', 48],
          ['S07_SIM_REMINDER_HOLD', 48],
          ['S07_AUTO_CONFIRM', 24],
        ],
      },
      {
        id: 'S08_TITLE_CLOSE',
        segments: [['S08_AUTO_TITLE_CLOSE', 72]],
      },
    ])
    expect(shots).toHaveLength(8)
    expect(shots.flatMap((shot) => shot.segments)).toHaveLength(14)
    expect(shots[4]?.segments[0]?.id).toBe('S05_AUTO_REFAME_SORT')
  })

  it('locks the 24 fps review, greeting, and default cue', () => {
    const reviewFrames = CINEMATIC_ONBOARDING_TIMELINE_V0_2.shots
      .flatMap((shot) => shot.segments)
      .reduce((total, segment) => total + segment.reviewDurationFrames, 0)

    expect(CINEMATIC_ONBOARDING_TIMELINE_V0_2.reviewFramesPerSecond).toBe(24)
    expect(reviewFrames).toBe(624)
    expect(CINEMATIC_ONBOARDING_TIMELINE_V0_2.reviewDurationFrames).toBe(624)
    expect(CINEMATIC_ONBOARDING_TIMELINE_V0_2.reviewDurationMilliseconds).toBe(
      26_000,
    )
    expect(CINEMATIC_ONBOARDING_TIMELINE_V0_2.openingGreeting).toBe(
      'Hi — I’m Corky.',
    )
    expect(CINEMATIC_ONBOARDING_TIMELINE_V0_2.defaultCue).toBe('The Scroll')
  })

  it('makes all four review holds indefinite runtime gates with named exits', () => {
    const holds = CINEMATIC_ONBOARDING_TIMELINE_V0_2.shots
      .flatMap((shot) => shot.segments)
      .filter((segment) => segment.kind === 'simulated_user_hold')

    expect(
      holds.map((hold) => ({
        id: hold.id,
        runtimeDuration: hold.runtimeDuration,
        runtimeExitEvent: hold.runtimeExitEvent,
        skipAllowed: hold.skipAllowed,
      })),
    ).toEqual([
      {
        id: 'S04_SIM_CUE_TAP_HOLD',
        runtimeDuration: 'indefinite',
        runtimeExitEvent: 'user_taps_or_confirms_the_scroll',
        skipAllowed: true,
      },
      {
        id: 'S05_SIM_SORT_HOLD',
        runtimeDuration: 'indefinite',
        runtimeExitEvent: 'user_completes_or_skips_sorting',
        skipAllowed: true,
      },
      {
        id: 'S06_SIM_USER_SPIN_STOP_HOLD',
        runtimeDuration: 'indefinite',
        runtimeExitEvent: 'user_spins_and_stops_record',
        skipAllowed: true,
      },
      {
        id: 'S07_SIM_REMINDER_HOLD',
        runtimeDuration: 'indefinite',
        runtimeExitEvent: 'user_sets_or_skips_reminder',
        skipAllowed: true,
      },
    ])
  })

  it('defaults normal motion to the Cue reflection and forces it off when reduced', () => {
    const normal = createCinematicOnboardingRuntime()
    const normalWithoutReflection = createCinematicOnboardingRuntime({
      mode: 'normal',
      cueVerticalReflection: false,
    })
    const reduced = createCinematicOnboardingRuntime({
      mode: 'reduced',
      cueVerticalReflection: true,
    })

    expect(normal.mode).toBe('normal')
    expect(normal.cueVerticalReflectionEnabled).toBe(true)
    expect(normalWithoutReflection.cueVerticalReflectionEnabled).toBe(false)
    expect(reduced.mode).toBe('reduced')
    expect(reduced.cueVerticalReflectionEnabled).toBe(false)
  })

  it('advances reduced automatic beats only after their authored still dwell', () => {
    const loading = createCinematicOnboardingRuntime({ mode: 'reduced' })
    const playing = updateCinematicOnboardingRuntime(loading, {
      type: 'MEDIA_READY',
      segmentId: 'S01_AUTO_ENTER',
      playbackAttempt: 0,
    })

    expect(getCinematicOnboardingReducedDwellMilliseconds(playing)).toBe(2_000)
    expect(
      updateCinematicOnboardingRuntime(playing, {
        type: 'MEDIA_ENDED',
        segmentId: 'S01_AUTO_ENTER',
        playbackAttempt: 0,
      }),
    ).toBe(playing)

    const next = updateCinematicOnboardingRuntime(playing, {
      type: 'REDUCED_DWELL_ENDED',
      segmentId: 'S01_AUTO_ENTER',
      playbackAttempt: 0,
    })
    expect(getCinematicOnboardingRuntimePosition(next)?.segment.id).toBe(
      'S02_AUTO_HELLO',
    )
  })

  it('ignores reduced dwell callbacks in normal motion', () => {
    const playing = updateCinematicOnboardingRuntime(
      createCinematicOnboardingRuntime(),
      {
        type: 'MEDIA_READY',
        segmentId: 'S01_AUTO_ENTER',
        playbackAttempt: 0,
      },
    )

    expect(getCinematicOnboardingReducedDwellMilliseconds(playing)).toBe(
      undefined,
    )
    expect(
      updateCinematicOnboardingRuntime(playing, {
        type: 'REDUCED_DWELL_ENDED',
        segmentId: 'S01_AUTO_ENTER',
        playbackAttempt: 0,
      }),
    ).toBe(playing)
  })

  it('starts loading and cannot finish media before it is playing', () => {
    const initial = createCinematicOnboardingRuntime()

    const prematureEnd = updateCinematicOnboardingRuntime(initial, {
      type: 'MEDIA_ENDED',
      segmentId: 'S01_AUTO_ENTER',
      playbackAttempt: 0,
    })
    const playing = updateCinematicOnboardingRuntime(initial, {
      type: 'MEDIA_READY',
      segmentId: 'S01_AUTO_ENTER',
      playbackAttempt: 0,
    })

    expect(initial.status).toBe('loading')
    expect(prematureEnd).toBe(initial)
    expect(playing.status).toBe('playing')
  })

  it('advances exactly one automatic segment for the current media completion', () => {
    const playing = updateCinematicOnboardingRuntime(
      createCinematicOnboardingRuntime(),
      {
        type: 'MEDIA_READY',
        segmentId: 'S01_AUTO_ENTER',
        playbackAttempt: 0,
      },
    )

    const next = updateCinematicOnboardingRuntime(playing, {
      type: 'MEDIA_ENDED',
      segmentId: 'S01_AUTO_ENTER',
      playbackAttempt: 0,
    })
    const afterStaleCompletion = updateCinematicOnboardingRuntime(next, {
      type: 'MEDIA_ENDED',
      segmentId: 'S01_AUTO_ENTER',
      playbackAttempt: 0,
    })

    expect(next.status).toBe('loading')
    expect(getCinematicOnboardingRuntimePosition(next)?.segment.id).toBe(
      'S02_AUTO_HELLO',
    )
    expect(afterStaleCompletion).toBe(next)
  })

  it('stops automatic completion at the first user hold', () => {
    const waiting = advanceToNextHold(createCinematicOnboardingRuntime())

    expect(waiting.status).toBe('holding')
    expect(getCinematicOnboardingRuntimePosition(waiting)).toMatchObject({
      shotId: 'S04_CUE_ARRIVAL',
      segment: { id: 'S04_SIM_CUE_TAP_HOLD' },
    })
  })

  it('does not let media completion release an indefinite hold', () => {
    const holding = advanceToNextHold(createCinematicOnboardingRuntime())

    const afterMediaEnd = updateCinematicOnboardingRuntime(holding, {
      type: 'MEDIA_ENDED',
      segmentId: 'S04_SIM_CUE_TAP_HOLD',
      playbackAttempt: 0,
    })

    expect(afterMediaEnd).toBe(holding)
    expect(afterMediaEnd.status).toBe('holding')
  })

  it('does not let the wrong user event release a hold', () => {
    const holding = advanceToNextHold(createCinematicOnboardingRuntime())

    const afterWrongEvent = updateCinematicOnboardingRuntime(holding, {
      type: 'USER_EVENT',
      event: 'user_spins_and_stops_record',
    })

    expect(afterWrongEvent).toBe(holding)
    expect(
      getCinematicOnboardingRuntimePosition(afterWrongEvent)?.segment.id,
    ).toBe('S04_SIM_CUE_TAP_HOLD')
  })

  it('releases each hold only for its matching user event', () => {
    const expected: readonly {
      hold: CinematicOnboardingSegmentId
      event: CinematicOnboardingRuntimeEvent
    }[] = [
      {
        hold: 'S04_SIM_CUE_TAP_HOLD',
        event: 'user_taps_or_confirms_the_scroll',
      },
      {
        hold: 'S05_SIM_SORT_HOLD',
        event: 'user_completes_or_skips_sorting',
      },
      {
        hold: 'S06_SIM_USER_SPIN_STOP_HOLD',
        event: 'user_spins_and_stops_record',
      },
      {
        hold: 'S07_SIM_REMINDER_HOLD',
        event: 'user_sets_or_skips_reminder',
      },
    ]
    let state = createCinematicOnboardingRuntime()

    for (const gate of expected) {
      state = advanceToNextHold(state)
      expect(getCinematicOnboardingRuntimePosition(state)?.segment.id).toBe(
        gate.hold,
      )

      state = updateCinematicOnboardingRuntime(state, {
        type: 'USER_EVENT',
        event: gate.event,
      })
      expect(state.status).toBe('loading')
    }
  })

  it('lets an explicit skip release the current hold', () => {
    const holding = advanceToNextHold(createCinematicOnboardingRuntime())

    const afterSkip = updateCinematicOnboardingRuntime(holding, {
      type: 'SKIP_CURRENT_HOLD',
    })

    expect(afterSkip.status).toBe('loading')
    expect(getCinematicOnboardingRuntimePosition(afterSkip)).toMatchObject({
      shotId: 'S05_SORT_SIDES',
      segment: { id: 'S05_AUTO_REFAME_SORT' },
    })
  })

  it('surfaces current-media errors and retries the same segment', () => {
    const initial = createCinematicOnboardingRuntime()

    const failed = updateCinematicOnboardingRuntime(initial, {
      type: 'MEDIA_ERROR',
      segmentId: 'S01_AUTO_ENTER',
      playbackAttempt: 0,
      message: 'Unable to decode the opening clip.',
    })
    const retried = updateCinematicOnboardingRuntime(failed, { type: 'RETRY' })

    expect(failed).toMatchObject({
      status: 'error',
      positionIndex: 0,
      message: 'Unable to decode the opening clip.',
    })
    expect(retried.status).toBe('loading')
    expect(currentPlaybackAttempt(retried)).toBe(1)
    expect(getCinematicOnboardingRuntimePosition(retried)?.segment.id).toBe(
      'S01_AUTO_ENTER',
    )

    const afterLateReady = updateCinematicOnboardingRuntime(retried, {
      type: 'MEDIA_READY',
      segmentId: 'S01_AUTO_ENTER',
      playbackAttempt: 0,
    })
    expect(afterLateReady).toBe(retried)
  })

  it('lets someone continue from a failed clip while its poster stays visible', () => {
    const failed = updateCinematicOnboardingRuntime(
      createCinematicOnboardingRuntime(),
      {
        type: 'MEDIA_ERROR',
        segmentId: 'S01_AUTO_ENTER',
        playbackAttempt: 0,
        message: 'Unable to decode the opening clip.',
      },
    )

    const next = updateCinematicOnboardingRuntime(failed, {
      type: 'CONTINUE_WITH_POSTER',
    })

    expect(next.status).toBe('loading')
    expect(getCinematicOnboardingRuntimePosition(next)?.segment.id).toBe(
      'S02_AUTO_HELLO',
    )
  })

  it('supports an always-available global dismiss', () => {
    const loading = createCinematicOnboardingRuntime()
    const holding = advanceToNextHold(loading)
    const failed = updateCinematicOnboardingRuntime(loading, {
      type: 'MEDIA_ERROR',
      segmentId: 'S01_AUTO_ENTER',
      playbackAttempt: 0,
      message: 'Unable to decode the opening clip.',
    })

    for (const state of [loading, holding, failed]) {
      expect(
        updateCinematicOnboardingRuntime(state, { type: 'DISMISS' }),
      ).toMatchObject({ status: 'complete', completion: 'dismissed' })
    }
  })

  it('keeps completion stable for every later input', () => {
    const complete = completeRuntime()
    const laterInputs = [
      {
        type: 'MEDIA_READY',
        segmentId: 'S01_AUTO_ENTER',
        playbackAttempt: 0,
      },
      {
        type: 'MEDIA_ENDED',
        segmentId: 'S01_AUTO_ENTER',
        playbackAttempt: 0,
      },
      {
        type: 'MEDIA_ERROR',
        segmentId: 'S01_AUTO_ENTER',
        playbackAttempt: 0,
        message: 'late callback',
      },
      { type: 'RETRY' },
      { type: 'USER_EVENT', event: 'user_sets_or_skips_reminder' },
      { type: 'SKIP_CURRENT_HOLD' },
      { type: 'DISMISS' },
    ] as const satisfies readonly CinematicOnboardingRuntimeInput[]

    const results = laterInputs.map((input) =>
      updateCinematicOnboardingRuntime(complete, input),
    )

    expect(complete.status).toBe('complete')
    expect(complete).toMatchObject({ completion: 'finished' })
    expect(getCinematicOnboardingRuntimePosition(complete)).toBeUndefined()
    expect(results.every((result) => result === complete)).toBe(true)
  })
})
