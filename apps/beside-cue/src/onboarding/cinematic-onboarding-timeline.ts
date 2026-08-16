// ============================================================
// Cinematic onboarding timeline — the pure v0.2 playback contract
// ============================================================
//
// Review timing is finite so animation can be judged deterministically. The
// four user holds are different: runtime time never completes them, and only
// their named event or an explicit skip may release the next segment.

export const CINEMATIC_ONBOARDING_REVIEW_FPS = 24

export type CinematicOnboardingMode = 'normal' | 'reduced'

export type CinematicOnboardingShotId =
  | 'S01_EDGE_ENTRANCE'
  | 'S02_HELLO'
  | 'S03_TABLE_TRANSITION'
  | 'S04_CUE_ARRIVAL'
  | 'S05_SORT_SIDES'
  | 'S06_SPIN_AND_STOP'
  | 'S07_REACTION_REMINDER'
  | 'S08_TITLE_CLOSE'

export type CinematicOnboardingSegmentId =
  | 'S01_AUTO_ENTER'
  | 'S02_AUTO_HELLO'
  | 'S03_AUTO_TRACKED_TRANSITION'
  | 'S04_AUTO_CUE_ENTRANCE'
  | 'S04_SIM_CUE_TAP_HOLD'
  /** Intentional source-contract spelling; changing it breaks asset lookup. */
  | 'S05_AUTO_REFAME_SORT'
  | 'S05_SIM_SORT_HOLD'
  | 'S06_AUTO_CORKY_PRESS'
  | 'S06_SIM_USER_SPIN_STOP_HOLD'
  | 'S06_AUTO_STOP_SETTLE'
  | 'S07_AUTO_REACTION_DIAL_REVEAL'
  | 'S07_SIM_REMINDER_HOLD'
  | 'S07_AUTO_CONFIRM'
  | 'S08_AUTO_TITLE_CLOSE'

export type CinematicOnboardingRuntimeEvent =
  | 'user_taps_or_confirms_the_scroll'
  | 'user_completes_or_skips_sorting'
  | 'user_spins_and_stops_record'
  | 'user_sets_or_skips_reminder'

export interface CinematicOnboardingAutomaticSegment {
  readonly id: CinematicOnboardingSegmentId
  readonly kind: 'automatic'
  readonly reviewDurationFrames: number
}

export interface CinematicOnboardingUserHoldSegment {
  readonly id: CinematicOnboardingSegmentId
  readonly kind: 'simulated_user_hold'
  readonly reviewDurationFrames: number
  readonly runtimeDuration: 'indefinite'
  readonly runtimeExitEvent: CinematicOnboardingRuntimeEvent
  readonly skipAllowed: true
}

export type CinematicOnboardingSegment =
  | CinematicOnboardingAutomaticSegment
  | CinematicOnboardingUserHoldSegment

export interface CinematicOnboardingShot {
  readonly id: CinematicOnboardingShotId
  readonly segments: readonly CinematicOnboardingSegment[]
}

export interface CinematicOnboardingTimeline {
  readonly version: '0.2.0'
  readonly reviewFramesPerSecond: 24
  readonly reviewDurationFrames: 624
  readonly reviewDurationMilliseconds: 26_000
  readonly openingGreeting: 'Hi — I’m Corky.'
  readonly defaultCue: 'The Scroll'
  readonly shots: readonly CinematicOnboardingShot[]
}

const SHOTS = [
  {
    id: 'S01_EDGE_ENTRANCE',
    segments: [
      {
        id: 'S01_AUTO_ENTER',
        kind: 'automatic',
        reviewDurationFrames: 48,
      },
    ],
  },
  {
    id: 'S02_HELLO',
    segments: [
      {
        id: 'S02_AUTO_HELLO',
        kind: 'automatic',
        reviewDurationFrames: 48,
      },
    ],
  },
  {
    id: 'S03_TABLE_TRANSITION',
    segments: [
      {
        id: 'S03_AUTO_TRACKED_TRANSITION',
        kind: 'automatic',
        reviewDurationFrames: 48,
      },
    ],
  },
  {
    id: 'S04_CUE_ARRIVAL',
    segments: [
      {
        id: 'S04_AUTO_CUE_ENTRANCE',
        kind: 'automatic',
        reviewDurationFrames: 24,
      },
      {
        id: 'S04_SIM_CUE_TAP_HOLD',
        kind: 'simulated_user_hold',
        reviewDurationFrames: 24,
        runtimeDuration: 'indefinite',
        runtimeExitEvent: 'user_taps_or_confirms_the_scroll',
        skipAllowed: true,
      },
    ],
  },
  {
    id: 'S05_SORT_SIDES',
    segments: [
      {
        id: 'S05_AUTO_REFAME_SORT',
        kind: 'automatic',
        reviewDurationFrames: 24,
      },
      {
        id: 'S05_SIM_SORT_HOLD',
        kind: 'simulated_user_hold',
        reviewDurationFrames: 96,
        runtimeDuration: 'indefinite',
        runtimeExitEvent: 'user_completes_or_skips_sorting',
        skipAllowed: true,
      },
    ],
  },
  {
    id: 'S06_SPIN_AND_STOP',
    segments: [
      {
        id: 'S06_AUTO_CORKY_PRESS',
        kind: 'automatic',
        reviewDurationFrames: 48,
      },
      {
        id: 'S06_SIM_USER_SPIN_STOP_HOLD',
        kind: 'simulated_user_hold',
        reviewDurationFrames: 48,
        runtimeDuration: 'indefinite',
        runtimeExitEvent: 'user_spins_and_stops_record',
        skipAllowed: true,
      },
      {
        id: 'S06_AUTO_STOP_SETTLE',
        kind: 'automatic',
        reviewDurationFrames: 24,
      },
    ],
  },
  {
    id: 'S07_REACTION_REMINDER',
    segments: [
      {
        id: 'S07_AUTO_REACTION_DIAL_REVEAL',
        kind: 'automatic',
        reviewDurationFrames: 48,
      },
      {
        id: 'S07_SIM_REMINDER_HOLD',
        kind: 'simulated_user_hold',
        reviewDurationFrames: 48,
        runtimeDuration: 'indefinite',
        runtimeExitEvent: 'user_sets_or_skips_reminder',
        skipAllowed: true,
      },
      {
        id: 'S07_AUTO_CONFIRM',
        kind: 'automatic',
        reviewDurationFrames: 24,
      },
    ],
  },
  {
    id: 'S08_TITLE_CLOSE',
    segments: [
      {
        id: 'S08_AUTO_TITLE_CLOSE',
        kind: 'automatic',
        reviewDurationFrames: 72,
      },
    ],
  },
] as const satisfies readonly CinematicOnboardingShot[]

export const CINEMATIC_ONBOARDING_TIMELINE_V0_2: CinematicOnboardingTimeline = {
  version: '0.2.0',
  reviewFramesPerSecond: CINEMATIC_ONBOARDING_REVIEW_FPS,
  reviewDurationFrames: 624,
  reviewDurationMilliseconds: 26_000,
  openingGreeting: 'Hi — I’m Corky.',
  defaultCue: 'The Scroll',
  shots: SHOTS,
} as const

interface TimelinePosition {
  readonly shotId: CinematicOnboardingShotId
  readonly segment: CinematicOnboardingSegment
}

const POSITIONS: readonly TimelinePosition[] = SHOTS.flatMap((shot) =>
  shot.segments.map((segment) => ({ shotId: shot.id, segment })),
)

export interface CinematicOnboardingRuntimeOptions {
  readonly mode?: CinematicOnboardingMode
  /** Normal-mode comparison switch. Reduced motion always forces this off. */
  readonly cueVerticalReflection?: boolean
}

interface CinematicOnboardingRuntimeBase {
  readonly mode: CinematicOnboardingMode
  readonly cueVerticalReflectionEnabled: boolean
}

interface CinematicOnboardingPositionedRuntimeState extends CinematicOnboardingRuntimeBase {
  readonly positionIndex: number
}

export interface CinematicOnboardingLoadingRuntimeState extends CinematicOnboardingPositionedRuntimeState {
  readonly status: 'loading'
  readonly playbackAttempt: number
}

export interface CinematicOnboardingPlayingRuntimeState extends CinematicOnboardingPositionedRuntimeState {
  readonly status: 'playing'
  readonly playbackAttempt: number
}

export interface CinematicOnboardingHoldingRuntimeState extends CinematicOnboardingPositionedRuntimeState {
  readonly status: 'holding'
  readonly expectedEvent: CinematicOnboardingRuntimeEvent
}

export interface CinematicOnboardingErrorRuntimeState extends CinematicOnboardingPositionedRuntimeState {
  readonly status: 'error'
  readonly playbackAttempt: number
  readonly message: string
}

export interface CinematicOnboardingCompleteRuntimeState extends CinematicOnboardingRuntimeBase {
  readonly status: 'complete'
  readonly positionIndex: number
  readonly completion: 'finished' | 'dismissed'
}

export type CinematicOnboardingRuntimeState =
  | CinematicOnboardingLoadingRuntimeState
  | CinematicOnboardingPlayingRuntimeState
  | CinematicOnboardingHoldingRuntimeState
  | CinematicOnboardingErrorRuntimeState
  | CinematicOnboardingCompleteRuntimeState

export type CinematicOnboardingRuntimeInput =
  | {
      readonly type: 'MEDIA_READY'
      readonly segmentId: CinematicOnboardingSegmentId
      readonly playbackAttempt: number
    }
  | {
      readonly type: 'MEDIA_ENDED'
      readonly segmentId: CinematicOnboardingSegmentId
      readonly playbackAttempt: number
    }
  | {
      readonly type: 'MEDIA_ERROR'
      readonly segmentId: CinematicOnboardingSegmentId
      readonly playbackAttempt: number
      readonly message: string
    }
  | {
      /** Authored still dwell elapsed; valid only in reduced-motion playback. */
      readonly type: 'REDUCED_DWELL_ENDED'
      readonly segmentId: CinematicOnboardingSegmentId
      readonly playbackAttempt: number
    }
  | { readonly type: 'RETRY' }
  | { readonly type: 'CONTINUE_WITH_POSTER' }
  | {
      readonly type: 'USER_EVENT'
      readonly event: CinematicOnboardingRuntimeEvent
    }
  | { readonly type: 'SKIP_CURRENT_HOLD' }
  | { readonly type: 'DISMISS' }

export interface CinematicOnboardingRuntimePosition {
  readonly shotId: CinematicOnboardingShotId
  readonly segment: CinematicOnboardingSegment
}

/**
 * Reduced motion presents each automatic beat as a stable still for the same
 * authored duration as its review beat. The director dispatches a correlated
 * REDUCED_DWELL_ENDED after this dwell instead of inventing a video `ended`
 * event for an image.
 */
export function getCinematicOnboardingReducedDwellMilliseconds(
  state: CinematicOnboardingRuntimeState,
): number | undefined {
  if (state.mode !== 'reduced' || state.status !== 'playing') return undefined

  const segment = POSITIONS[state.positionIndex]?.segment
  if (segment === undefined || segment.kind !== 'automatic') return undefined

  return (
    (segment.reviewDurationFrames / CINEMATIC_ONBOARDING_REVIEW_FPS) * 1_000
  )
}

function enterPosition(
  base: CinematicOnboardingRuntimeBase,
  positionIndex: number,
): CinematicOnboardingRuntimeState {
  const runtimeBase: CinematicOnboardingRuntimeBase = {
    mode: base.mode,
    cueVerticalReflectionEnabled: base.cueVerticalReflectionEnabled,
  }
  const position = POSITIONS[positionIndex]
  if (position === undefined) {
    return {
      ...runtimeBase,
      status: 'complete',
      positionIndex: POSITIONS.length,
      completion: 'finished',
    }
  }

  if (position.segment.kind === 'simulated_user_hold') {
    return {
      ...runtimeBase,
      status: 'holding',
      positionIndex,
      expectedEvent: position.segment.runtimeExitEvent,
    }
  }

  return {
    ...runtimeBase,
    status: 'loading',
    positionIndex,
    playbackAttempt: 0,
  }
}

export function createCinematicOnboardingRuntime(
  options: CinematicOnboardingRuntimeOptions = {},
): CinematicOnboardingRuntimeState {
  const mode = options.mode ?? 'normal'
  const base: CinematicOnboardingRuntimeBase = {
    mode,
    cueVerticalReflectionEnabled:
      mode === 'normal' ? (options.cueVerticalReflection ?? true) : false,
  }

  return enterPosition(base, 0)
}

export function getCinematicOnboardingRuntimePosition(
  state: CinematicOnboardingRuntimeState,
): CinematicOnboardingRuntimePosition | undefined {
  return POSITIONS[state.positionIndex]
}

function exitCurrentHold(
  state: CinematicOnboardingHoldingRuntimeState,
): CinematicOnboardingRuntimeState {
  return enterPosition(state, state.positionIndex + 1)
}

function isCurrentSegment(
  state: CinematicOnboardingPositionedRuntimeState,
  segmentId: CinematicOnboardingSegmentId,
): boolean {
  return POSITIONS[state.positionIndex]?.segment.id === segmentId
}

function isCurrentPlayback(
  state:
    | CinematicOnboardingLoadingRuntimeState
    | CinematicOnboardingPlayingRuntimeState,
  input: {
    readonly segmentId: CinematicOnboardingSegmentId
    readonly playbackAttempt: number
  },
): boolean {
  return (
    isCurrentSegment(state, input.segmentId) &&
    input.playbackAttempt === state.playbackAttempt
  )
}

function enterPlaying(
  state: CinematicOnboardingLoadingRuntimeState,
): CinematicOnboardingPlayingRuntimeState {
  return {
    mode: state.mode,
    cueVerticalReflectionEnabled: state.cueVerticalReflectionEnabled,
    status: 'playing',
    positionIndex: state.positionIndex,
    playbackAttempt: state.playbackAttempt,
  }
}

function enterError(
  state:
    | CinematicOnboardingLoadingRuntimeState
    | CinematicOnboardingPlayingRuntimeState,
  message: string,
): CinematicOnboardingErrorRuntimeState {
  return {
    mode: state.mode,
    cueVerticalReflectionEnabled: state.cueVerticalReflectionEnabled,
    status: 'error',
    positionIndex: state.positionIndex,
    playbackAttempt: state.playbackAttempt,
    message,
  }
}

function dismissRuntime(
  state: Exclude<
    CinematicOnboardingRuntimeState,
    CinematicOnboardingCompleteRuntimeState
  >,
): CinematicOnboardingCompleteRuntimeState {
  return {
    mode: state.mode,
    cueVerticalReflectionEnabled: state.cueVerticalReflectionEnabled,
    status: 'complete',
    positionIndex: POSITIONS.length,
    completion: 'dismissed',
  }
}

/**
 * Applies one media, interaction, retry, or explicit-skip input. Review frames
 * never drive this reducer: only the current segment's MEDIA_ENDED advances an
 * automatic beat, and media completion is inert at every user hold.
 */
export function updateCinematicOnboardingRuntime(
  state: CinematicOnboardingRuntimeState,
  input: CinematicOnboardingRuntimeInput,
): CinematicOnboardingRuntimeState {
  if (state.status === 'complete') {
    return state
  }

  if (input.type === 'DISMISS') {
    return dismissRuntime(state)
  }

  if (state.status === 'loading') {
    if (!('segmentId' in input) || !isCurrentPlayback(state, input)) {
      return state
    }
    if (input.type === 'MEDIA_READY') {
      return enterPlaying(state)
    }
    if (input.type === 'MEDIA_ERROR') {
      return enterError(state, input.message)
    }

    return state
  }

  if (state.status === 'playing') {
    if (!('segmentId' in input) || !isCurrentPlayback(state, input)) {
      return state
    }
    if (
      (state.mode === 'normal' && input.type === 'MEDIA_ENDED') ||
      (state.mode === 'reduced' && input.type === 'REDUCED_DWELL_ENDED')
    ) {
      return enterPosition(state, state.positionIndex + 1)
    }
    if (input.type === 'MEDIA_ERROR') {
      return enterError(state, input.message)
    }

    return state
  }

  if (state.status === 'error') {
    if (input.type === 'RETRY') {
      return {
        mode: state.mode,
        cueVerticalReflectionEnabled: state.cueVerticalReflectionEnabled,
        status: 'loading',
        positionIndex: state.positionIndex,
        playbackAttempt: state.playbackAttempt + 1,
      }
    }
    return input.type === 'CONTINUE_WITH_POSTER'
      ? enterPosition(state, state.positionIndex + 1)
      : state
  }

  if (input.type === 'SKIP_CURRENT_HOLD') {
    return exitCurrentHold(state)
  }

  return input.type === 'USER_EVENT' && input.event === state.expectedEvent
    ? exitCurrentHold(state)
    : state
}
