import { describe, expect, it } from 'vitest'
import type { CinematicOnboardingRuntimeState, CinematicOnboardingSegmentId, } from './cinematic-onboarding-timeline'
import { CINEMATIC_ONBOARDING_PICTURE_ASSETS_V0_3, CINEMATIC_ONBOARDING_PICTURE_ASSETS_V0_4, CINEMATIC_ONBOARDING_TIMELINE_V0_2, CINEMATIC_ONBOARDING_TIMELINE_V0_3, CINEMATIC_ONBOARDING_TIMELINE_V0_4, createCinematicOnboardingRuntime, getCinematicOnboardingAudioClockSlice, getCinematicOnboardingNativeOverlayDurationMilliseconds, getCinematicOnboardingReducedDwellMilliseconds, getCinematicOnboardingRuntimePosition, isCinematicOnboardingPersistenceAllowed, replayCinematicOnboardingRuntimeForReview, seekCinematicOnboardingRuntimeForReview, stepCinematicOnboardingRuntimeForReview, updateCinematicOnboardingRuntime, } from './cinematic-onboarding-timeline'

function currentSegmentId(
  state: CinematicOnboardingRuntimeState,
): CinematicOnboardingSegmentId {
  const id = getCinematicOnboardingRuntimePosition(state)?.segment.id
  if (id === undefined) throw new Error('Complete runtime has no segment.')
  return id
}

function playbackAttempt(state: CinematicOnboardingRuntimeState): number {
  if (
    state.status !== 'loading' &&
    state.status !== 'playing' &&
    state.status !== 'error'
  ) {
    throw new Error(`${state.status} has no playback attempt.`)
  }
  return state.playbackAttempt
}

function ready(state: CinematicOnboardingRuntimeState) {
  if (state.status !== 'loading') return state
  return updateCinematicOnboardingRuntime(state, {
    type: 'MEDIA_READY',
    segmentId: currentSegmentId(state),
    playbackAttempt: playbackAttempt(state),
  })
}

function finishAutomatic(state: CinematicOnboardingRuntimeState) {
  const playing = ready(state)
  if (playing.status !== 'playing') {
    throw new Error(`Expected playing, received ${playing.status}.`)
  }
  const segment = getCinematicOnboardingRuntimePosition(playing)?.segment
  if (segment === undefined || segment.kind === 'native_interaction_hold') {
    throw new Error('Expected an automatic segment.')
  }
  return updateCinematicOnboardingRuntime(playing, {
    type:
      playing.mode === 'reduced'
        ? 'REDUCED_DWELL_ENDED'
        : segment.kind === 'automatic'
          ? 'MEDIA_ENDED'
          : 'NATIVE_OVERLAY_ENDED',
    segmentId: segment.id,
    playbackAttempt: playing.playbackAttempt,
  })
}

function advanceTo(
  target: CinematicOnboardingSegmentId,
  mode: 'normal' | 'reduced' = 'normal',
) {
  let state = createCinematicOnboardingRuntime({ mode })
  for (let index = 0; index < 20; index += 1) {
    if (currentSegmentId(state) === target) return state
    if (state.status === 'holding') {
      state = updateCinematicOnboardingRuntime(state, {
        type: 'USER_EVENT',
        event: state.expectedEvent,
      })
    } else {
      state = finishAutomatic(state)
    }
  }
  throw new Error(`Did not reach ${target}.`)
}

describe('cinematic onboarding v0.4 contract', () => {
  it('preserves the complete approved 746-frame picture at 24 fps', () => {
    const frames = CINEMATIC_ONBOARDING_PICTURE_ASSETS_V0_4.map(
      ({ sourceDurationFrames }) => sourceDurationFrames,
    )

    expect(frames).toEqual([96, 96, 96, 193, 97, 96, 72])
    expect(frames.reduce((sum, count) => sum + count, 0)).toBe(746)
    expect(CINEMATIC_ONBOARDING_TIMELINE_V0_4).toMatchObject({
      version: '0.4.0',
      pictureFramesPerSecond: 24,
      pictureDurationFrames: 746,
      pictureDurationMilliseconds: 31_083.333333333332,
      openingGreeting: 'Hi there, I am Corky.',
      fixedPullId: 'scrolling',
      fixedPullText: 'Endless scrolling',
      fixedSideAText: 'Keep scrolling',
      featuredCharacter: 'The Scroll',
    })
    expect(CINEMATIC_ONBOARDING_PICTURE_ASSETS_V0_3).toBe(
      CINEMATIC_ONBOARDING_PICTURE_ASSETS_V0_4,
    )
    expect(CINEMATIC_ONBOARDING_PICTURE_ASSETS_V0_4.at(-1)).toMatchObject({
      id: 'H08_QUIET_CLOSE',
      sourceDurationFrames: 72,
      runtimePresentation: 'moving_video',
    })
  })

  it('contains only authored picture, one automatic Pull intro, and three real decisions', () => {
    const segments = CINEMATIC_ONBOARDING_TIMELINE_V0_4.shots.flatMap(
      ({ segments: shotSegments }) => shotSegments,
    )

    expect(
      segments.map((segment) => [
        segment.id,
        segment.kind,
        segment.kind === 'automatic'
          ? segment.mediaDurationFrames
          : segment.kind === 'automatic_native_overlay'
            ? segment.nativeDurationFrames
            : segment.runtimeExitEvent,
      ]),
    ).toEqual([
      ['S01_S02_AUTO_ENTRANCE_HELLO', 'automatic', 96],
      ['S03_AUTO_TRACKED_TRANSITION', 'automatic', 96],
      ['S04_AUTO_PULL_ENTRANCE', 'automatic', 96],
      ['S04_AUTO_PULL_INTRO', 'automatic_native_overlay', 48],
      ['S05_AUTO_REFRAME_SIDE_CHOICE', 'automatic', 193],
      [
        'S05_CHOOSE_B_SIDE_HOLD',
        'native_interaction_hold',
        'user_chooses_b_side',
      ],
      ['S06_AUTO_CORKY_PRESS', 'automatic', 97],
      [
        'S06_CONFIRM_AND_SAVE_PLAN_HOLD',
        'native_interaction_hold',
        'user_confirms_and_saves_plan',
      ],
      ['S07_AUTO_STOPPED_ACKNOWLEDGEMENT', 'automatic', 96],
      [
        'S07_REMINDER_HOLD',
        'native_interaction_hold',
        'user_sets_or_skips_reminder',
      ],
      ['S08_AUTO_TITLE_CLOSE', 'automatic', 72],
    ])

    const holds = segments.filter(
      (segment) => segment.kind === 'native_interaction_hold',
    )
    expect(holds).toHaveLength(3)
    expect(holds.every((hold) => hold.skipAllowed === false)).toBe(true)
    expect(segments.map(({ id }) => id)).not.toContain('S04_SIM_CUE_TAP_HOLD')
    expect(segments.map(({ id }) => id)).not.toContain('S07_AUTO_CONFIRM')
  })

  it('advances audio only for the 746 physical picture frames', () => {
    const segments = CINEMATIC_ONBOARDING_TIMELINE_V0_4.shots.flatMap(
      ({ segments: shotSegments }) => shotSegments,
    )
    const advancingFrames = segments.reduce((sum, segment) => {
      if (segment.audioClockBehavior === 'pause') return sum
      return sum + segment.mediaDurationFrames
    }, 0)

    expect(advancingFrames).toBe(746)
    expect(
      segments
        .filter(({ audioClockBehavior }) => audioClockBehavior === 'pause')
        .map(({ id }) => id),
    ).toEqual([
      'S04_AUTO_PULL_INTRO',
      'S05_CHOOSE_B_SIDE_HOLD',
      'S06_CONFIRM_AND_SAVE_PLAN_HOLD',
      'S07_REMINDER_HOLD',
    ])
  })

  it('maps every runtime position onto a continuous retry-safe audio slice', () => {
    const actual: [string, number, number, string][] = []
    let state = createCinematicOnboardingRuntime()

    while (state.status !== 'complete') {
      const slice = getCinematicOnboardingAudioClockSlice(state)
      if (slice === undefined) throw new Error('Expected an audio slice.')
      actual.push([
        currentSegmentId(state),
        slice.startFrame,
        slice.durationFrames,
        slice.behavior,
      ])
      state =
        state.status === 'holding'
          ? updateCinematicOnboardingRuntime(state, {
              type: 'USER_EVENT',
              event: state.expectedEvent,
            })
          : finishAutomatic(state)
    }

    expect(actual).toEqual([
      ['S01_S02_AUTO_ENTRANCE_HELLO', 0, 96, 'advance_with_picture'],
      ['S03_AUTO_TRACKED_TRANSITION', 96, 96, 'advance_with_picture'],
      ['S04_AUTO_PULL_ENTRANCE', 192, 96, 'advance_with_picture'],
      ['S04_AUTO_PULL_INTRO', 288, 0, 'pause'],
      ['S05_AUTO_REFRAME_SIDE_CHOICE', 288, 193, 'advance_with_picture'],
      ['S05_CHOOSE_B_SIDE_HOLD', 481, 0, 'pause'],
      ['S06_AUTO_CORKY_PRESS', 481, 97, 'advance_with_picture'],
      ['S06_CONFIRM_AND_SAVE_PLAN_HOLD', 578, 0, 'pause'],
      ['S07_AUTO_STOPPED_ACKNOWLEDGEMENT', 578, 96, 'advance_with_picture'],
      ['S07_REMINDER_HOLD', 674, 0, 'pause'],
      ['S08_AUTO_TITLE_CLOSE', 674, 72, 'advance_with_picture'],
    ])
    expect(getCinematicOnboardingAudioClockSlice(state)).toBeUndefined()
  })

  it('requires the exact event at every product decision and forbids generic skipping', () => {
    const sideB = advanceTo('S05_CHOOSE_B_SIDE_HOLD')
    if (sideB.status !== 'holding') throw new Error('Expected Side B hold.')

    expect(
      updateCinematicOnboardingRuntime(sideB, {
        type: 'USER_EVENT',
        event: 'user_sets_or_skips_reminder',
      }),
    ).toBe(sideB)
    expect(
      updateCinematicOnboardingRuntime(sideB, {
        type: 'SKIP_CURRENT_HOLD',
      }),
    ).toBe(sideB)
    expect(
      currentSegmentId(
        updateCinematicOnboardingRuntime(sideB, {
          type: 'USER_EVENT',
          event: 'user_chooses_b_side',
        }),
      ),
    ).toBe('S06_AUTO_CORKY_PRESS')
  })

  it('keeps normal and reduced-motion timing deterministic', () => {
    const intro = ready(advanceTo('S04_AUTO_PULL_INTRO'))
    const reducedIntro = ready(advanceTo('S04_AUTO_PULL_INTRO', 'reduced'))

    expect(getCinematicOnboardingNativeOverlayDurationMilliseconds(intro)).toBe(
      2_000,
    )
    expect(
      getCinematicOnboardingReducedDwellMilliseconds(intro),
    ).toBeUndefined()
    expect(getCinematicOnboardingReducedDwellMilliseconds(reducedIntro)).toBe(
      2_000,
    )
    expect(reducedIntro.cueVerticalReflectionEnabled).toBe(false)
  })

  it('plays the 72-frame H08 motion while retaining a three-second reduced dwell', () => {
    const normalClose = ready(advanceTo('S08_AUTO_TITLE_CLOSE'))
    const reducedClose = ready(advanceTo('S08_AUTO_TITLE_CLOSE', 'reduced'))

    expect(
      getCinematicOnboardingNativeOverlayDurationMilliseconds(normalClose),
    ).toBeUndefined()
    expect(
      getCinematicOnboardingReducedDwellMilliseconds(normalClose),
    ).toBeUndefined()
    expect(getCinematicOnboardingReducedDwellMilliseconds(reducedClose)).toBe(
      3_000,
    )

    if (normalClose.status !== 'playing') {
      throw new Error('Expected the H08 video to be playing.')
    }
    const staleOverlayCallback = updateCinematicOnboardingRuntime(normalClose, {
      type: 'NATIVE_OVERLAY_ENDED',
      segmentId: 'S08_AUTO_TITLE_CLOSE',
      playbackAttempt: normalClose.playbackAttempt,
    })
    expect(staleOverlayCallback).toBe(normalClose)
    expect(
      updateCinematicOnboardingRuntime(normalClose, {
        type: 'MEDIA_ENDED',
        segmentId: 'S08_AUTO_TITLE_CLOSE',
        playbackAttempt: normalClose.playbackAttempt,
      }),
    ).toMatchObject({ status: 'complete', completion: 'finished' })
  })

  it('correlates media callbacks and retries without skipping a beat', () => {
    const loading = createCinematicOnboardingRuntime()
    const wrongReady = updateCinematicOnboardingRuntime(loading, {
      type: 'MEDIA_READY',
      segmentId: 'S03_AUTO_TRACKED_TRANSITION',
      playbackAttempt: 0,
    })
    expect(wrongReady).toBe(loading)

    const playing = ready(loading)
    if (playing.status !== 'playing') throw new Error('Expected playing.')
    const failed = updateCinematicOnboardingRuntime(playing, {
      type: 'MEDIA_ERROR',
      segmentId: currentSegmentId(playing),
      playbackAttempt: playing.playbackAttempt,
      message: 'decode failed',
    })
    expect(failed).toMatchObject({
      status: 'error',
      positionIndex: 0,
      playbackAttempt: 0,
      message: 'decode failed',
    })
    expect(
      updateCinematicOnboardingRuntime(failed, { type: 'RETRY' }),
    ).toMatchObject({ status: 'loading', positionIndex: 0, playbackAttempt: 1 })
  })

  it('marks seek, step, and replay sessions as review-only for their lifetime', () => {
    expect(
      isCinematicOnboardingPersistenceAllowed(
        createCinematicOnboardingRuntime({ sessionKind: 'review' }),
      ),
    ).toBe(false)

    const firstRun = advanceTo('S06_CONFIRM_AND_SAVE_PLAN_HOLD')
    expect(isCinematicOnboardingPersistenceAllowed(firstRun)).toBe(true)

    const sought = seekCinematicOnboardingRuntimeForReview(
      firstRun,
      'S05_CHOOSE_B_SIDE_HOLD',
    )
    expect(sought).toMatchObject({
      status: 'holding',
      sessionKind: 'review',
      expectedEvent: 'user_chooses_b_side',
    })
    expect(isCinematicOnboardingPersistenceAllowed(sought)).toBe(false)

    const next = stepCinematicOnboardingRuntimeForReview(sought, 'next')
    expect(currentSegmentId(next)).toBe('S06_AUTO_CORKY_PRESS')
    expect(next.sessionKind).toBe('review')

    const replayed = replayCinematicOnboardingRuntimeForReview(ready(next))
    expect(replayed).toMatchObject({
      status: 'loading',
      sessionKind: 'review',
      playbackAttempt: 0,
    })
    expect(currentSegmentId(replayed)).toBe('S06_AUTO_CORKY_PRESS')

    const later = finishAutomatic(replayed)
    expect(later.sessionKind).toBe('review')
    expect(isCinematicOnboardingPersistenceAllowed(later)).toBe(false)
  })

  it('retains deprecated v0.2 and v0.3 identifiers without making them active', () => {
    expect(CINEMATIC_ONBOARDING_TIMELINE_V0_2.version).toBe('0.2.0')
    expect(CINEMATIC_ONBOARDING_TIMELINE_V0_3).toMatchObject({
      version: '0.3.0',
      defaultCue: 'The Scroll',
      pictureDurationFrames: 746,
    })
    expect(CINEMATIC_ONBOARDING_TIMELINE_V0_3.shots).toHaveLength(7)
    expect(
      CINEMATIC_ONBOARDING_TIMELINE_V0_3.shots.some(({ segments }) =>
        (segments as readonly { readonly id: string }[]).some(
          ({ id }) => id === 'S04_SIM_CUE_TAP_HOLD',
        ),
      ),
    ).toBe(true)
    expect(CINEMATIC_ONBOARDING_TIMELINE_V0_4.version).toBe('0.4.0')
  })
})
