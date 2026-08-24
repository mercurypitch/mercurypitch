// ============================================================
// Cinematic onboarding timeline tests — v0.3 picture and runtime gates
// ============================================================

import { describe, expect, it } from 'vitest'
import type { CinematicOnboardingRuntimeEvent, CinematicOnboardingRuntimeInput, CinematicOnboardingRuntimeState, CinematicOnboardingSegmentId, } from './cinematic-onboarding-timeline'
import { CINEMATIC_ONBOARDING_PICTURE_ASSETS_V0_3, CINEMATIC_ONBOARDING_TIMELINE_V0_2, CINEMATIC_ONBOARDING_TIMELINE_V0_3, createCinematicOnboardingRuntime, getCinematicOnboardingAudioClockSlice, getCinematicOnboardingNativeOverlayDurationMilliseconds, getCinematicOnboardingReducedDwellMilliseconds, getCinematicOnboardingRuntimePosition, updateCinematicOnboardingRuntime, } from './cinematic-onboarding-timeline'

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

function readyCurrentPresentation(
  state: CinematicOnboardingRuntimeState,
): CinematicOnboardingRuntimeState {
  if (state.status !== 'loading') return state

  return updateCinematicOnboardingRuntime(state, {
    type: 'MEDIA_READY',
    segmentId: currentSegmentId(state),
    playbackAttempt: currentPlaybackAttempt(state),
  })
}

function finishCurrentAutomaticState(
  state: CinematicOnboardingRuntimeState,
): CinematicOnboardingRuntimeState {
  const playing = readyCurrentPresentation(state)
  if (playing.status !== 'playing') {
    throw new Error(`Expected playing state, received ${playing.status}.`)
  }

  const position = getCinematicOnboardingRuntimePosition(playing)
  if (
    position === undefined ||
    position.segment.kind === 'native_interaction_hold'
  ) {
    throw new Error('Expected an automatic runtime position.')
  }

  const type =
    playing.mode === 'reduced'
      ? 'REDUCED_DWELL_ENDED'
      : position.segment.kind === 'automatic'
        ? 'MEDIA_ENDED'
        : 'NATIVE_OVERLAY_ENDED'

  return updateCinematicOnboardingRuntime(playing, {
    type,
    segmentId: position.segment.id,
    playbackAttempt: playing.playbackAttempt,
  })
}

function advanceToNextHold(
  state: CinematicOnboardingRuntimeState,
): CinematicOnboardingRuntimeState {
  let current = state
  for (let step = 0; step < 13; step += 1) {
    if (current.status === 'holding') return current
    if (current.status === 'complete' || current.status === 'error') {
      throw new Error(`Expected another hold, received ${current.status}.`)
    }
    current = finishCurrentAutomaticState(current)
  }

  throw new Error('Runtime did not reach a hold within thirteen states.')
}

function advanceToSegment(
  target: CinematicOnboardingSegmentId,
  mode: 'normal' | 'reduced' = 'normal',
): CinematicOnboardingRuntimeState {
  const events: Partial<
    Record<CinematicOnboardingSegmentId, CinematicOnboardingRuntimeEvent>
  > = {
    S04_SIM_CUE_TAP_HOLD: 'user_taps_or_confirms_the_scroll',
    S05_SIM_SORT_HOLD: 'user_completes_or_skips_sorting',
    S06_SIM_USER_SPIN_STOP_HOLD: 'user_spins_and_stops_record',
    S07_SIM_REMINDER_HOLD: 'user_sets_or_skips_reminder',
  }
  let state = createCinematicOnboardingRuntime({ mode })

  for (let step = 0; step < 20; step += 1) {
    if (currentSegmentId(state) === target) return state
    if (state.status === 'holding') {
      const event = events[currentSegmentId(state)]
      if (event === undefined) throw new Error('Hold has no test event.')
      state = updateCinematicOnboardingRuntime(state, {
        type: 'USER_EVENT',
        event,
      })
    } else {
      state = finishCurrentAutomaticState(state)
    }
  }

  throw new Error(`Runtime did not reach ${target}.`)
}

function completeRuntime(): CinematicOnboardingRuntimeState {
  let state = createCinematicOnboardingRuntime()

  while (state.status !== 'complete') {
    if (state.status === 'holding') {
      state = updateCinematicOnboardingRuntime(state, {
        type: 'USER_EVENT',
        event: state.expectedEvent,
      })
    } else {
      state = finishCurrentAutomaticState(state)
    }
  }

  return state
}

describe('cinematic onboarding timeline', () => {
  it('preserves all seven approved picture sources without trimming 746 frames', () => {
    const frames = CINEMATIC_ONBOARDING_PICTURE_ASSETS_V0_3.map(
      (asset) => asset.sourceDurationFrames,
    )

    expect(frames).toEqual([96, 96, 96, 193, 97, 96, 72])
    expect(frames.reduce((total, frameCount) => total + frameCount, 0)).toBe(
      746,
    )
    expect(CINEMATIC_ONBOARDING_PICTURE_ASSETS_V0_3.at(-2)).toEqual({
      id: 'H07_STOPPED_ACKNOWLEDGEMENT',
      sourceDurationFrames: 96,
      runtimePresentation: 'moving_video',
      deliveryStatus: 'delivery_eligible',
    })
    expect(CINEMATIC_ONBOARDING_PICTURE_ASSETS_V0_3.at(-1)).toMatchObject({
      id: 'H08_QUIET_CLOSE',
      runtimePresentation: 'stable_plate',
    })
  })

  it('locks the v0.3 picture truth, exact greeting, and prototype audio policy', () => {
    const timeline = CINEMATIC_ONBOARDING_TIMELINE_V0_3

    expect(timeline.version).toBe('0.3.0')
    expect(timeline.pictureFramesPerSecond).toBe(24)
    expect(timeline.pictureDurationFrames).toBe(746)
    expect(timeline.pictureDurationMilliseconds).toBeCloseTo(31_083.333333, 5)
    expect(timeline.openingGreeting).toBe('Hi there, I am Corky.')
    expect(timeline.defaultCue).toBe('The Scroll')
    expect(timeline.audioClock).toEqual({
      policy: 'pause_with_picture',
      status: 'prototype_requires_device_validation',
      sourceDurationFrames: 746,
      pauseDuringNativeHolds: true,
      pauseDuringNonPictureOverlays: true,
    })
  })

  it('uses six moving files, three native overlays, and four indefinite holds', () => {
    const segments = CINEMATIC_ONBOARDING_TIMELINE_V0_3.shots.flatMap(
      (shot) => shot.segments,
    )

    expect(
      segments.map((segment) => [
        segment.id,
        segment.kind,
        segment.kind === 'automatic'
          ? segment.mediaDurationFrames
          : segment.kind === 'automatic_native_overlay'
            ? segment.nativeDurationFrames
            : 'indefinite',
      ]),
    ).toEqual([
      ['S01_S02_AUTO_ENTRANCE_HELLO', 'automatic', 96],
      ['S03_AUTO_TRACKED_TRANSITION', 'automatic', 96],
      ['S04_AUTO_CUE_ENTRANCE', 'automatic', 96],
      ['S04_SIM_CUE_TAP_HOLD', 'native_interaction_hold', 'indefinite'],
      ['S05_AUTO_REFRAME_SORT', 'automatic', 193],
      ['S05_SIM_SORT_HOLD', 'native_interaction_hold', 'indefinite'],
      ['S06_AUTO_CORKY_PRESS', 'automatic', 97],
      ['S06_SIM_USER_SPIN_STOP_HOLD', 'native_interaction_hold', 'indefinite'],
      ['S07_AUTO_STOPPED_ACKNOWLEDGEMENT', 'automatic', 96],
      ['S07_AUTO_REMINDER_DIAL_REVEAL', 'automatic_native_overlay', 48],
      ['S07_SIM_REMINDER_HOLD', 'native_interaction_hold', 'indefinite'],
      ['S07_AUTO_CONFIRM', 'automatic_native_overlay', 24],
      ['S08_AUTO_TITLE_CLOSE', 'automatic_native_overlay', 72],
    ])
    expect(
      segments.filter((segment) => segment.kind === 'automatic'),
    ).toHaveLength(6)
    expect(
      segments.filter((segment) => segment.kind === 'automatic_native_overlay'),
    ).toHaveLength(3)
    expect(
      segments.filter((segment) => segment.kind === 'native_interaction_hold'),
    ).toHaveLength(4)
  })

  it('keeps H01 and H02 as logical cues inside one continuous 96-frame decode', () => {
    const first = CINEMATIC_ONBOARDING_TIMELINE_V0_3.shots[0]?.segments[0]

    expect(first).toEqual({
      id: 'S01_S02_AUTO_ENTRANCE_HELLO',
      kind: 'automatic',
      audioClockBehavior: 'advance_with_picture',
      pictureAssetId: 'H01_H02_GREETING',
      mediaDurationFrames: 96,
      logicalCues: [
        { id: 'S01_EDGE_ENTRANCE', atMediaFrame: 0 },
        {
          id: 'S02_HELLO',
          atMediaFrame: 48,
          dialogue: 'Hi there, I am Corky.',
        },
      ],
    })
  })

  it('advances the continuous audio for exactly the 746 physical picture frames', () => {
    const segments = CINEMATIC_ONBOARDING_TIMELINE_V0_3.shots.flatMap(
      (shot) => shot.segments,
    )
    const advancingFrames = segments.reduce((total, segment) => {
      if (segment.audioClockBehavior === 'pause') return total
      return (
        total +
        (segment.kind === 'automatic'
          ? segment.mediaDurationFrames
          : segment.nativeDurationFrames)
      )
    }, 0)

    expect(advancingFrames).toBe(746)
    expect(
      segments
        .filter((segment) => segment.audioClockBehavior === 'pause')
        .map((segment) => segment.id),
    ).toEqual([
      'S04_SIM_CUE_TAP_HOLD',
      'S05_SIM_SORT_HOLD',
      'S06_SIM_USER_SPIN_STOP_HOLD',
      'S07_AUTO_REMINDER_DIAL_REVEAL',
      'S07_SIM_REMINDER_HOLD',
      'S07_AUTO_CONFIRM',
    ])
  })

  it('maps every runtime state onto an exact retry-safe continuous-audio slice', () => {
    const slices: [CinematicOnboardingSegmentId, number, number, string][] = []
    let state = createCinematicOnboardingRuntime()

    while (state.status !== 'complete') {
      const slice = getCinematicOnboardingAudioClockSlice(state)
      if (slice === undefined)
        throw new Error('Runtime state has no audio slice.')
      slices.push([
        currentSegmentId(state),
        slice.startFrame,
        slice.durationFrames,
        slice.behavior,
      ])

      if (state.status === 'holding') {
        state = updateCinematicOnboardingRuntime(state, {
          type: 'USER_EVENT',
          event: state.expectedEvent,
        })
      } else {
        state = finishCurrentAutomaticState(state)
      }
    }

    expect(slices).toEqual([
      ['S01_S02_AUTO_ENTRANCE_HELLO', 0, 96, 'advance_with_picture'],
      ['S03_AUTO_TRACKED_TRANSITION', 96, 96, 'advance_with_picture'],
      ['S04_AUTO_CUE_ENTRANCE', 192, 96, 'advance_with_picture'],
      ['S04_SIM_CUE_TAP_HOLD', 288, 0, 'pause'],
      ['S05_AUTO_REFRAME_SORT', 288, 193, 'advance_with_picture'],
      ['S05_SIM_SORT_HOLD', 481, 0, 'pause'],
      ['S06_AUTO_CORKY_PRESS', 481, 97, 'advance_with_picture'],
      ['S06_SIM_USER_SPIN_STOP_HOLD', 578, 0, 'pause'],
      ['S07_AUTO_STOPPED_ACKNOWLEDGEMENT', 578, 96, 'advance_with_picture'],
      ['S07_AUTO_REMINDER_DIAL_REVEAL', 674, 0, 'pause'],
      ['S07_SIM_REMINDER_HOLD', 674, 0, 'pause'],
      ['S07_AUTO_CONFIRM', 674, 0, 'pause'],
      ['S08_AUTO_TITLE_CLOSE', 674, 72, 'advance_with_picture'],
    ])
    expect(getCinematicOnboardingAudioClockSlice(state)).toBeUndefined()
  })

  it('gives every native interaction hold one named exit and an explicit skip', () => {
    const holds = CINEMATIC_ONBOARDING_TIMELINE_V0_3.shots
      .flatMap((shot) => shot.segments)
      .filter((segment) => segment.kind === 'native_interaction_hold')

    expect(
      holds.map((hold) => [
        hold.id,
        hold.runtimeDuration,
        hold.runtimeExitEvent,
        hold.skipAllowed,
      ]),
    ).toEqual([
      [
        'S04_SIM_CUE_TAP_HOLD',
        'indefinite',
        'user_taps_or_confirms_the_scroll',
        true,
      ],
      [
        'S05_SIM_SORT_HOLD',
        'indefinite',
        'user_completes_or_skips_sorting',
        true,
      ],
      [
        'S06_SIM_USER_SPIN_STOP_HOLD',
        'indefinite',
        'user_spins_and_stops_record',
        true,
      ],
      [
        'S07_SIM_REMINDER_HOLD',
        'indefinite',
        'user_sets_or_skips_reminder',
        true,
      ],
    ])
    expect(holds.every((hold) => !('mediaDurationFrames' in hold))).toBe(true)
  })

  it('retains the disabled v0.2 architecture version for old config readers', () => {
    expect(CINEMATIC_ONBOARDING_TIMELINE_V0_2).toMatchObject({
      version: '0.2.0',
      reviewDurationFrames: 624,
      reviewDurationMilliseconds: 26_000,
    })
  })

  it('defaults normal motion to Cue reflection and forces it off when reduced', () => {
    const normal = createCinematicOnboardingRuntime()
    const normalWithoutReflection = createCinematicOnboardingRuntime({
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

  it('uses authored video and overlay durations for reduced stable-plate dwells', () => {
    const opening = readyCurrentPresentation(
      createCinematicOnboardingRuntime({ mode: 'reduced' }),
    )
    const overlay = readyCurrentPresentation(
      advanceToSegment('S07_AUTO_REMINDER_DIAL_REVEAL', 'reduced'),
    )

    expect(getCinematicOnboardingReducedDwellMilliseconds(opening)).toBe(4_000)
    expect(getCinematicOnboardingReducedDwellMilliseconds(overlay)).toBe(2_000)
    expect(
      getCinematicOnboardingNativeOverlayDurationMilliseconds(overlay),
    ).toBeUndefined()
  })

  it('advances a normal native overlay only for its correlated native completion', () => {
    const loading = advanceToSegment('S07_AUTO_REMINDER_DIAL_REVEAL')
    const playing = readyCurrentPresentation(loading)
    const segmentId = currentSegmentId(playing)
    const playbackAttempt = currentPlaybackAttempt(playing)

    expect(
      getCinematicOnboardingNativeOverlayDurationMilliseconds(playing),
    ).toBe(2_000)
    expect(
      updateCinematicOnboardingRuntime(playing, {
        type: 'MEDIA_ENDED',
        segmentId,
        playbackAttempt,
      }),
    ).toBe(playing)
    expect(
      getCinematicOnboardingRuntimePosition(
        updateCinematicOnboardingRuntime(playing, {
          type: 'NATIVE_OVERLAY_ENDED',
          segmentId,
          playbackAttempt,
        }),
      )?.segment.id,
    ).toBe('S07_SIM_REMINDER_HOLD')
  })

  it('does not let a native-overlay completion finish a moving clip', () => {
    const playing = readyCurrentPresentation(createCinematicOnboardingRuntime())

    const afterWrongCompletion = updateCinematicOnboardingRuntime(playing, {
      type: 'NATIVE_OVERLAY_ENDED',
      segmentId: currentSegmentId(playing),
      playbackAttempt: currentPlaybackAttempt(playing),
    })

    expect(afterWrongCompletion).toBe(playing)
    expect(
      getCinematicOnboardingNativeOverlayDurationMilliseconds(playing),
    ).toBeUndefined()
  })

  it('stops at every hold and releases only for its matching user event', () => {
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
      expect(currentSegmentId(state)).toBe(gate.hold)
      const wrongEvent: CinematicOnboardingRuntimeEvent =
        gate.event === 'user_taps_or_confirms_the_scroll'
          ? 'user_completes_or_skips_sorting'
          : 'user_taps_or_confirms_the_scroll'
      expect(
        updateCinematicOnboardingRuntime(state, {
          type: 'USER_EVENT',
          event: wrongEvent,
        }),
      ).toBe(state)

      state = updateCinematicOnboardingRuntime(state, {
        type: 'USER_EVENT',
        event: gate.event,
      })
      expect(state.status).not.toBe('holding')
    }
  })

  it('never lets media completion or time release an indefinite hold', () => {
    const holding = advanceToNextHold(createCinematicOnboardingRuntime())
    const unrelatedInputs = [
      {
        type: 'MEDIA_ENDED',
        segmentId: 'S04_SIM_CUE_TAP_HOLD',
        playbackAttempt: 0,
      },
      {
        type: 'NATIVE_OVERLAY_ENDED',
        segmentId: 'S04_SIM_CUE_TAP_HOLD',
        playbackAttempt: 0,
      },
      {
        type: 'REDUCED_DWELL_ENDED',
        segmentId: 'S04_SIM_CUE_TAP_HOLD',
        playbackAttempt: 0,
      },
    ] as const satisfies readonly CinematicOnboardingRuntimeInput[]

    expect(
      unrelatedInputs.every(
        (input) => updateCinematicOnboardingRuntime(holding, input) === holding,
      ),
    ).toBe(true)
  })

  it('lets an explicit skip release the current hold', () => {
    const holding = advanceToNextHold(createCinematicOnboardingRuntime())

    const afterSkip = updateCinematicOnboardingRuntime(holding, {
      type: 'SKIP_CURRENT_HOLD',
    })

    expect(afterSkip.status).toBe('loading')
    expect(currentSegmentId(afterSkip)).toBe('S05_AUTO_REFRAME_SORT')
  })

  it('surfaces current-presentation errors and retries the same state', () => {
    const initial = createCinematicOnboardingRuntime()

    const failed = updateCinematicOnboardingRuntime(initial, {
      type: 'MEDIA_ERROR',
      segmentId: 'S01_S02_AUTO_ENTRANCE_HELLO',
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
    expect(currentSegmentId(retried)).toBe('S01_S02_AUTO_ENTRANCE_HELLO')
    expect(
      updateCinematicOnboardingRuntime(retried, {
        type: 'MEDIA_READY',
        segmentId: 'S01_S02_AUTO_ENTRANCE_HELLO',
        playbackAttempt: 0,
      }),
    ).toBe(retried)
  })

  it('continues with a poster after failure and always permits dismiss', () => {
    const initial = createCinematicOnboardingRuntime()
    const failed = updateCinematicOnboardingRuntime(initial, {
      type: 'MEDIA_ERROR',
      segmentId: 'S01_S02_AUTO_ENTRANCE_HELLO',
      playbackAttempt: 0,
      message: 'Unable to decode the opening clip.',
    })

    expect(
      currentSegmentId(
        updateCinematicOnboardingRuntime(failed, {
          type: 'CONTINUE_WITH_POSTER',
        }),
      ),
    ).toBe('S03_AUTO_TRACKED_TRANSITION')
    expect(
      updateCinematicOnboardingRuntime(failed, { type: 'DISMISS' }),
    ).toMatchObject({ status: 'complete', completion: 'dismissed' })
  })

  it('finishes all thirteen states and keeps completion stable', () => {
    const complete = completeRuntime()
    const laterInputs = [
      {
        type: 'MEDIA_READY',
        segmentId: 'S01_S02_AUTO_ENTRANCE_HELLO',
        playbackAttempt: 0,
      },
      { type: 'RETRY' },
      { type: 'USER_EVENT', event: 'user_sets_or_skips_reminder' },
      { type: 'SKIP_CURRENT_HOLD' },
      { type: 'DISMISS' },
    ] as const satisfies readonly CinematicOnboardingRuntimeInput[]

    expect(complete).toMatchObject({
      status: 'complete',
      completion: 'finished',
    })
    expect(getCinematicOnboardingRuntimePosition(complete)).toBeUndefined()
    expect(
      laterInputs.every(
        (input) =>
          updateCinematicOnboardingRuntime(complete, input) === complete,
      ),
    ).toBe(true)
  })
})
