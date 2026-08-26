// ============================================================
// Cinematic onboarding timeline — the v0.4 product/runtime contract
// ============================================================
//
// The 746-frame picture edit and the interactive runtime are deliberately
// separate clocks. Moving clips contribute source-picture frames; native
// overlays can share those moving beats; interaction holds remain indefinite.

export const CINEMATIC_ONBOARDING_PICTURE_FPS = 24

/** @deprecated Use CINEMATIC_ONBOARDING_PICTURE_FPS for the active contract. */
export const CINEMATIC_ONBOARDING_REVIEW_FPS = CINEMATIC_ONBOARDING_PICTURE_FPS

export type CinematicOnboardingMode = 'normal' | 'reduced'
export type CinematicOnboardingSessionKind = 'first_run' | 'review'

export type CinematicOnboardingPictureAssetId =
  | 'H01_H02_GREETING'
  | 'H03_TABLE_REVEAL'
  | 'H04_SCROLL_ARRIVAL'
  | 'H05_SORT_SIDES'
  | 'H06_PRESS_AND_PLAY'
  | 'H07_STOPPED_ACKNOWLEDGEMENT'
  | 'H08_QUIET_CLOSE'

export interface CinematicOnboardingPictureAssetContract {
  readonly id: CinematicOnboardingPictureAssetId
  /** Frames in the approved 24 fps linear editorial source. */
  readonly sourceDurationFrames: number
  /** Stable plates intentionally replace repeated-frame MP4s in the runtime. */
  readonly runtimePresentation: 'moving_video' | 'stable_plate'
  readonly deliveryStatus: 'delivery_eligible'
}

export const CINEMATIC_ONBOARDING_PICTURE_ASSETS_V0_4 = [
  {
    id: 'H01_H02_GREETING',
    sourceDurationFrames: 96,
    runtimePresentation: 'moving_video',
    deliveryStatus: 'delivery_eligible',
  },
  {
    id: 'H03_TABLE_REVEAL',
    sourceDurationFrames: 96,
    runtimePresentation: 'moving_video',
    deliveryStatus: 'delivery_eligible',
  },
  {
    id: 'H04_SCROLL_ARRIVAL',
    sourceDurationFrames: 96,
    runtimePresentation: 'moving_video',
    deliveryStatus: 'delivery_eligible',
  },
  {
    id: 'H05_SORT_SIDES',
    sourceDurationFrames: 193,
    runtimePresentation: 'moving_video',
    deliveryStatus: 'delivery_eligible',
  },
  {
    id: 'H06_PRESS_AND_PLAY',
    sourceDurationFrames: 97,
    runtimePresentation: 'moving_video',
    deliveryStatus: 'delivery_eligible',
  },
  {
    id: 'H07_STOPPED_ACKNOWLEDGEMENT',
    sourceDurationFrames: 96,
    runtimePresentation: 'moving_video',
    deliveryStatus: 'delivery_eligible',
  },
  {
    id: 'H08_QUIET_CLOSE',
    sourceDurationFrames: 72,
    runtimePresentation: 'moving_video',
    deliveryStatus: 'delivery_eligible',
  },
] as const satisfies readonly CinematicOnboardingPictureAssetContract[]

/** @deprecated Picture bytes are unchanged; use the v0.4 contract name. */
export const CINEMATIC_ONBOARDING_PICTURE_ASSETS_V0_3 =
  CINEMATIC_ONBOARDING_PICTURE_ASSETS_V0_4

export type CinematicOnboardingShotId =
  | 'S01_S02_EDGE_ENTRANCE_HELLO'
  | 'S03_TABLE_TRANSITION'
  | 'S04_PULL_ARRIVAL'
  | 'S05_SIDE_B_CHOICE'
  | 'S06_CONFIRM_PLAN'
  | 'S07_REMINDER'
  | 'S08_TITLE_CLOSE'

export type CinematicOnboardingLogicalCueId = 'S01_EDGE_ENTRANCE' | 'S02_HELLO'

export type CinematicOnboardingSegmentId =
  | 'S01_S02_AUTO_ENTRANCE_HELLO'
  | 'S03_AUTO_TRACKED_TRANSITION'
  | 'S04_AUTO_PULL_ENTRANCE'
  | 'S04_AUTO_PULL_INTRO'
  | 'S05_AUTO_REFRAME_SIDE_CHOICE'
  | 'S05_CHOOSE_B_SIDE_HOLD'
  | 'S06_AUTO_CORKY_PRESS'
  | 'S06_CONFIRM_AND_SAVE_PLAN_HOLD'
  | 'S07_AUTO_STOPPED_ACKNOWLEDGEMENT'
  | 'S07_REMINDER_HOLD'
  | 'S08_AUTO_TITLE_CLOSE'

export type CinematicOnboardingRuntimeEvent =
  | 'user_chooses_b_side'
  | 'user_confirms_and_saves_plan'
  | 'user_sets_or_skips_reminder'

export interface CinematicOnboardingLogicalCue {
  readonly id: CinematicOnboardingLogicalCueId
  /** Zero-based frame within the containing moving picture asset. */
  readonly atMediaFrame: number
  readonly dialogue?: 'Hi there, I am Corky.'
}

interface CinematicOnboardingSegmentBase {
  readonly id: CinematicOnboardingSegmentId
  readonly pictureAssetId: CinematicOnboardingPictureAssetId
}

export interface CinematicOnboardingAutomaticSegment extends CinematicOnboardingSegmentBase {
  readonly kind: 'automatic'
  readonly audioClockBehavior: 'advance_with_picture'
  /** Exact decoded frame count of the moving picture file. */
  readonly mediaDurationFrames: number
  readonly logicalCues?: readonly CinematicOnboardingLogicalCue[]
}

export interface CinematicOnboardingAutomaticNativeOverlaySegment extends CinematicOnboardingSegmentBase {
  readonly kind: 'automatic_native_overlay'
  readonly audioClockBehavior: 'pause'
  /** Authored duration of native UI motion over the stable plate. */
  readonly nativeDurationFrames: number
}

export interface CinematicOnboardingNativeInteractionHoldSegment extends CinematicOnboardingSegmentBase {
  readonly kind: 'native_interaction_hold'
  readonly audioClockBehavior: 'pause'
  readonly runtimeDuration: 'indefinite'
  readonly runtimeExitEvent: CinematicOnboardingRuntimeEvent
  /** Real product decisions cannot be bypassed through the generic hold skip. */
  readonly skipAllowed: false
}

export type CinematicOnboardingSegment =
  | CinematicOnboardingAutomaticSegment
  | CinematicOnboardingAutomaticNativeOverlaySegment
  | CinematicOnboardingNativeInteractionHoldSegment

export interface CinematicOnboardingShot {
  readonly id: CinematicOnboardingShotId
  readonly segments: readonly CinematicOnboardingSegment[]
}

export interface CinematicOnboardingAudioClockContract {
  /** First prototype preserves authored cues by pausing audio with picture. */
  readonly policy: 'pause_with_picture'
  readonly status: 'prototype_requires_device_validation'
  readonly sourceDurationFrames: 746
  readonly pauseDuringNativeHolds: true
  readonly pauseDuringNonPictureOverlays: true
}

export interface CinematicOnboardingTimeline {
  readonly version: '0.4.0'
  readonly pictureFramesPerSecond: 24
  readonly pictureDurationFrames: 746
  readonly pictureDurationMilliseconds: number
  readonly openingGreeting: 'Hi there, I am Corky.'
  /** Fixed first-run domain choice; The Scroll remains a separate character. */
  readonly fixedPullId: 'scrolling'
  readonly fixedPullText: 'Endless scrolling'
  readonly fixedSideAText: 'Keep scrolling'
  readonly featuredCharacter: 'The Scroll'
  readonly audioClock: CinematicOnboardingAudioClockContract
  readonly pictureAssets: readonly CinematicOnboardingPictureAssetContract[]
  readonly shots: readonly CinematicOnboardingShot[]
}

const SHOTS_V0_4 = [
  {
    id: 'S01_S02_EDGE_ENTRANCE_HELLO',
    segments: [
      {
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
      },
    ],
  },
  {
    id: 'S03_TABLE_TRANSITION',
    segments: [
      {
        id: 'S03_AUTO_TRACKED_TRANSITION',
        kind: 'automatic',
        audioClockBehavior: 'advance_with_picture',
        pictureAssetId: 'H03_TABLE_REVEAL',
        mediaDurationFrames: 96,
      },
    ],
  },
  {
    id: 'S04_PULL_ARRIVAL',
    segments: [
      {
        id: 'S04_AUTO_PULL_ENTRANCE',
        kind: 'automatic',
        audioClockBehavior: 'advance_with_picture',
        pictureAssetId: 'H04_SCROLL_ARRIVAL',
        mediaDurationFrames: 96,
      },
      {
        id: 'S04_AUTO_PULL_INTRO',
        kind: 'automatic_native_overlay',
        audioClockBehavior: 'pause',
        pictureAssetId: 'H04_SCROLL_ARRIVAL',
        nativeDurationFrames: 48,
      },
    ],
  },
  {
    id: 'S05_SIDE_B_CHOICE',
    segments: [
      {
        id: 'S05_AUTO_REFRAME_SIDE_CHOICE',
        kind: 'automatic',
        audioClockBehavior: 'advance_with_picture',
        pictureAssetId: 'H05_SORT_SIDES',
        mediaDurationFrames: 193,
      },
      {
        id: 'S05_CHOOSE_B_SIDE_HOLD',
        kind: 'native_interaction_hold',
        audioClockBehavior: 'pause',
        pictureAssetId: 'H05_SORT_SIDES',
        runtimeDuration: 'indefinite',
        runtimeExitEvent: 'user_chooses_b_side',
        skipAllowed: false,
      },
    ],
  },
  {
    id: 'S06_CONFIRM_PLAN',
    segments: [
      {
        id: 'S06_AUTO_CORKY_PRESS',
        kind: 'automatic',
        audioClockBehavior: 'advance_with_picture',
        pictureAssetId: 'H06_PRESS_AND_PLAY',
        mediaDurationFrames: 97,
      },
      {
        id: 'S06_CONFIRM_AND_SAVE_PLAN_HOLD',
        kind: 'native_interaction_hold',
        audioClockBehavior: 'pause',
        pictureAssetId: 'H06_PRESS_AND_PLAY',
        runtimeDuration: 'indefinite',
        runtimeExitEvent: 'user_confirms_and_saves_plan',
        skipAllowed: false,
      },
    ],
  },
  {
    id: 'S07_REMINDER',
    segments: [
      {
        id: 'S07_AUTO_STOPPED_ACKNOWLEDGEMENT',
        kind: 'automatic',
        audioClockBehavior: 'advance_with_picture',
        pictureAssetId: 'H07_STOPPED_ACKNOWLEDGEMENT',
        mediaDurationFrames: 96,
      },
      {
        id: 'S07_REMINDER_HOLD',
        kind: 'native_interaction_hold',
        audioClockBehavior: 'pause',
        pictureAssetId: 'H07_STOPPED_ACKNOWLEDGEMENT',
        runtimeDuration: 'indefinite',
        runtimeExitEvent: 'user_sets_or_skips_reminder',
        skipAllowed: false,
      },
    ],
  },
  {
    id: 'S08_TITLE_CLOSE',
    segments: [
      {
        id: 'S08_AUTO_TITLE_CLOSE',
        kind: 'automatic',
        audioClockBehavior: 'advance_with_picture',
        pictureAssetId: 'H08_QUIET_CLOSE',
        mediaDurationFrames: 72,
      },
    ],
  },
] as const satisfies readonly CinematicOnboardingShot[]

export const CINEMATIC_ONBOARDING_TIMELINE_V0_4: CinematicOnboardingTimeline = {
  version: '0.4.0',
  pictureFramesPerSecond: CINEMATIC_ONBOARDING_PICTURE_FPS,
  pictureDurationFrames: 746,
  pictureDurationMilliseconds: (746 / CINEMATIC_ONBOARDING_PICTURE_FPS) * 1_000,
  openingGreeting: 'Hi there, I am Corky.',
  fixedPullId: 'scrolling',
  fixedPullText: 'Endless scrolling',
  fixedSideAText: 'Keep scrolling',
  featuredCharacter: 'The Scroll',
  audioClock: {
    policy: 'pause_with_picture',
    status: 'prototype_requires_device_validation',
    sourceDurationFrames: 746,
    pauseDuringNativeHolds: true,
    pauseDuringNonPictureOverlays: true,
  },
  pictureAssets: CINEMATIC_ONBOARDING_PICTURE_ASSETS_V0_4,
  shots: SHOTS_V0_4,
} as const

interface TimelinePosition {
  readonly shotId: CinematicOnboardingShotId
  readonly segment: CinematicOnboardingSegment
}

const POSITIONS: readonly TimelinePosition[] = SHOTS_V0_4.flatMap((shot) =>
  shot.segments.map((segment) => ({ shotId: shot.id, segment })),
)

export interface CinematicOnboardingAudioClockSlice {
  /** Zero-based frame in the continuous 746-frame mix. */
  readonly startFrame: number
  readonly durationFrames: number
  readonly behavior: 'advance_with_picture' | 'pause'
}

function segmentAudioDurationFrames(
  segment: CinematicOnboardingSegment,
): number {
  if (segment.audioClockBehavior === 'pause') return 0
  return segment.mediaDurationFrames
}

const AUDIO_CLOCK_SLICES: readonly CinematicOnboardingAudioClockSlice[] =
  (() => {
    let startFrame = 0
    return POSITIONS.map(({ segment }) => {
      const durationFrames = segmentAudioDurationFrames(segment)
      const slice: CinematicOnboardingAudioClockSlice = {
        startFrame,
        durationFrames,
        behavior: segment.audioClockBehavior,
      }
      startFrame += durationFrames
      return slice
    })
  })()

export interface CinematicOnboardingRuntimeOptions {
  readonly mode?: CinematicOnboardingMode
  /** Review sessions are navigable but must never persist product choices. */
  readonly sessionKind?: CinematicOnboardingSessionKind
  /** Normal-mode comparison switch. Reduced motion always forces this off. */
  readonly cueVerticalReflection?: boolean
}

interface CinematicOnboardingRuntimeBase {
  readonly mode: CinematicOnboardingMode
  readonly sessionKind: CinematicOnboardingSessionKind
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
      readonly type: 'NATIVE_OVERLAY_ENDED'
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
      /** Authored stable-plate dwell elapsed in reduced-motion playback. */
      readonly type: 'REDUCED_DWELL_ENDED'
      readonly segmentId: CinematicOnboardingSegmentId
      readonly playbackAttempt: number
    }
  | { readonly type: 'RETRY' }
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

/** Maps a retry-safe runtime position onto the continuous authored mix. */
export function getCinematicOnboardingAudioClockSlice(
  state: CinematicOnboardingRuntimeState,
): CinematicOnboardingAudioClockSlice | undefined {
  return AUDIO_CLOCK_SLICES[state.positionIndex]
}

function framesToMilliseconds(frames: number): number {
  return (frames / CINEMATIC_ONBOARDING_PICTURE_FPS) * 1_000
}

/** Stable reduced-motion states retain each authored beat's duration. */
export function getCinematicOnboardingReducedDwellMilliseconds(
  state: CinematicOnboardingRuntimeState,
): number | undefined {
  if (state.mode !== 'reduced' || state.status !== 'playing') return undefined

  const segment = POSITIONS[state.positionIndex]?.segment
  if (segment?.kind === 'automatic') {
    return framesToMilliseconds(segment.mediaDurationFrames)
  }
  if (segment?.kind === 'automatic_native_overlay') {
    return framesToMilliseconds(segment.nativeDurationFrames)
  }

  return undefined
}

/** Duration for native motion; the director dispatches NATIVE_OVERLAY_ENDED. */
export function getCinematicOnboardingNativeOverlayDurationMilliseconds(
  state: CinematicOnboardingRuntimeState,
): number | undefined {
  if (state.mode !== 'normal' || state.status !== 'playing') return undefined

  const segment = POSITIONS[state.positionIndex]?.segment
  return segment?.kind === 'automatic_native_overlay'
    ? framesToMilliseconds(segment.nativeDurationFrames)
    : undefined
}

function enterPosition(
  base: CinematicOnboardingRuntimeBase,
  positionIndex: number,
): CinematicOnboardingRuntimeState {
  const runtimeBase: CinematicOnboardingRuntimeBase = {
    mode: base.mode,
    sessionKind: base.sessionKind,
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

  if (position.segment.kind === 'native_interaction_hold') {
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
    sessionKind: options.sessionKind ?? 'first_run',
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

/** Product writes are allowed only in the uninterrupted first-run session. */
export function isCinematicOnboardingPersistenceAllowed(
  state: CinematicOnboardingRuntimeState,
): boolean {
  return state.sessionKind === 'first_run'
}

function enterReviewPosition(
  state: CinematicOnboardingRuntimeState,
  positionIndex: number,
): CinematicOnboardingRuntimeState {
  return enterPosition(
    {
      mode: state.mode,
      sessionKind: 'review',
      cueVerticalReflectionEnabled: state.cueVerticalReflectionEnabled,
    },
    positionIndex,
  )
}

/**
 * Seeks without replaying product events. The returned state is permanently
 * marked as review-only, including after later runtime updates.
 */
export function seekCinematicOnboardingRuntimeForReview(
  state: CinematicOnboardingRuntimeState,
  segmentId: CinematicOnboardingSegmentId,
): CinematicOnboardingRuntimeState {
  const positionIndex = POSITIONS.findIndex(
    ({ segment }) => segment.id === segmentId,
  )
  const fallbackIndex = Math.min(state.positionIndex, POSITIONS.length - 1)
  return enterReviewPosition(
    state,
    positionIndex < 0 ? Math.max(0, fallbackIndex) : positionIndex,
  )
}

/** Moves one authored runtime position while suppressing product persistence. */
export function stepCinematicOnboardingRuntimeForReview(
  state: CinematicOnboardingRuntimeState,
  direction: 'previous' | 'next',
): CinematicOnboardingRuntimeState {
  const currentIndex = Math.min(state.positionIndex, POSITIONS.length - 1)
  const delta = direction === 'previous' ? -1 : 1
  const positionIndex = Math.max(
    0,
    Math.min(currentIndex + delta, POSITIONS.length - 1),
  )
  return enterReviewPosition(state, positionIndex)
}

/** Restarts the current authored position as a persistence-suppressed review. */
export function replayCinematicOnboardingRuntimeForReview(
  state: CinematicOnboardingRuntimeState,
): CinematicOnboardingRuntimeState {
  const positionIndex = Math.min(state.positionIndex, POSITIONS.length - 1)
  return enterReviewPosition(state, Math.max(0, positionIndex))
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
    sessionKind: state.sessionKind,
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
    sessionKind: state.sessionKind,
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
    sessionKind: state.sessionKind,
    cueVerticalReflectionEnabled: state.cueVerticalReflectionEnabled,
    status: 'complete',
    positionIndex: POSITIONS.length,
    completion: 'dismissed',
  }
}

/** Applies one correlated media, native-overlay, interaction, or skip input. */
export function updateCinematicOnboardingRuntime(
  state: CinematicOnboardingRuntimeState,
  input: CinematicOnboardingRuntimeInput,
): CinematicOnboardingRuntimeState {
  if (state.status === 'complete') return state
  if (input.type === 'DISMISS') return dismissRuntime(state)

  if (state.status === 'loading') {
    if (!('segmentId' in input) || !isCurrentPlayback(state, input)) {
      return state
    }
    if (input.type === 'MEDIA_READY') return enterPlaying(state)
    if (input.type === 'MEDIA_ERROR') return enterError(state, input.message)
    return state
  }

  if (state.status === 'playing') {
    if (!('segmentId' in input) || !isCurrentPlayback(state, input)) {
      return state
    }

    const segment = POSITIONS[state.positionIndex]?.segment
    const finished =
      (state.mode === 'reduced' && input.type === 'REDUCED_DWELL_ENDED') ||
      (state.mode === 'normal' &&
        segment?.kind === 'automatic' &&
        input.type === 'MEDIA_ENDED') ||
      (state.mode === 'normal' &&
        segment?.kind === 'automatic_native_overlay' &&
        input.type === 'NATIVE_OVERLAY_ENDED')
    if (finished) return enterPosition(state, state.positionIndex + 1)
    if (input.type === 'MEDIA_ERROR') return enterError(state, input.message)
    return state
  }

  if (state.status === 'error') {
    if (input.type === 'RETRY') {
      return {
        mode: state.mode,
        sessionKind: state.sessionKind,
        cueVerticalReflectionEnabled: state.cueVerticalReflectionEnabled,
        status: 'loading',
        positionIndex: state.positionIndex,
        playbackAttempt: state.playbackAttempt + 1,
      }
    }
    return state
  }

  if (input.type === 'SKIP_CURRENT_HOLD') {
    const segment = POSITIONS[state.positionIndex]?.segment
    return segment?.kind === 'native_interaction_hold' && segment.skipAllowed
      ? exitCurrentHold(state)
      : state
  }

  return input.type === 'USER_EVENT' && input.event === state.expectedEvent
    ? exitCurrentHold(state)
    : state
}

/** Architecture-only compatibility for the disabled welcome prototype. */
export const CINEMATIC_ONBOARDING_TIMELINE_V0_2 = {
  version: '0.2.0',
  reviewFramesPerSecond: 24,
  reviewDurationFrames: 624,
  reviewDurationMilliseconds: 26_000,
  openingGreeting: 'Hi — I’m Corky.',
  defaultCue: 'The Scroll',
} as const

const LEGACY_SHOTS_V0_3 = [
  {
    id: 'S01_S02_EDGE_ENTRANCE_HELLO',
    segments: [
      {
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
      },
    ],
  },
  {
    id: 'S03_TABLE_TRANSITION',
    segments: [
      {
        id: 'S03_AUTO_TRACKED_TRANSITION',
        kind: 'automatic',
        audioClockBehavior: 'advance_with_picture',
        pictureAssetId: 'H03_TABLE_REVEAL',
        mediaDurationFrames: 96,
      },
    ],
  },
  {
    id: 'S04_CUE_ARRIVAL',
    segments: [
      {
        id: 'S04_AUTO_CUE_ENTRANCE',
        kind: 'automatic',
        audioClockBehavior: 'advance_with_picture',
        pictureAssetId: 'H04_SCROLL_ARRIVAL',
        mediaDurationFrames: 96,
      },
      {
        id: 'S04_SIM_CUE_TAP_HOLD',
        kind: 'native_interaction_hold',
        audioClockBehavior: 'pause',
        pictureAssetId: 'H04_SCROLL_ARRIVAL',
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
        id: 'S05_AUTO_REFRAME_SORT',
        kind: 'automatic',
        audioClockBehavior: 'advance_with_picture',
        pictureAssetId: 'H05_SORT_SIDES',
        mediaDurationFrames: 193,
      },
      {
        id: 'S05_SIM_SORT_HOLD',
        kind: 'native_interaction_hold',
        audioClockBehavior: 'pause',
        pictureAssetId: 'H05_SORT_SIDES',
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
        audioClockBehavior: 'advance_with_picture',
        pictureAssetId: 'H06_PRESS_AND_PLAY',
        mediaDurationFrames: 97,
      },
      {
        id: 'S06_SIM_USER_SPIN_STOP_HOLD',
        kind: 'native_interaction_hold',
        audioClockBehavior: 'pause',
        pictureAssetId: 'H06_PRESS_AND_PLAY',
        runtimeDuration: 'indefinite',
        runtimeExitEvent: 'user_spins_and_stops_record',
        skipAllowed: true,
      },
    ],
  },
  {
    id: 'S07_REACTION_REMINDER',
    segments: [
      {
        id: 'S07_AUTO_STOPPED_ACKNOWLEDGEMENT',
        kind: 'automatic',
        audioClockBehavior: 'advance_with_picture',
        pictureAssetId: 'H07_STOPPED_ACKNOWLEDGEMENT',
        mediaDurationFrames: 96,
      },
      {
        id: 'S07_AUTO_REMINDER_DIAL_REVEAL',
        kind: 'automatic_native_overlay',
        audioClockBehavior: 'pause',
        pictureAssetId: 'H07_STOPPED_ACKNOWLEDGEMENT',
        nativeDurationFrames: 48,
      },
      {
        id: 'S07_SIM_REMINDER_HOLD',
        kind: 'native_interaction_hold',
        audioClockBehavior: 'pause',
        pictureAssetId: 'H07_STOPPED_ACKNOWLEDGEMENT',
        runtimeDuration: 'indefinite',
        runtimeExitEvent: 'user_sets_or_skips_reminder',
        skipAllowed: true,
      },
      {
        id: 'S07_AUTO_CONFIRM',
        kind: 'automatic_native_overlay',
        audioClockBehavior: 'pause',
        pictureAssetId: 'H07_STOPPED_ACKNOWLEDGEMENT',
        nativeDurationFrames: 24,
      },
    ],
  },
  {
    id: 'S08_TITLE_CLOSE',
    segments: [
      {
        id: 'S08_AUTO_TITLE_CLOSE',
        kind: 'automatic_native_overlay',
        audioClockBehavior: 'advance_with_picture',
        pictureAssetId: 'H08_QUIET_CLOSE',
        nativeDurationFrames: 72,
      },
    ],
  },
] as const

/**
 * @deprecated Frozen compatibility metadata for integrations that still
 * identify the preceding contract. Runtime/media delivery targets v0.4.
 */
export const CINEMATIC_ONBOARDING_TIMELINE_V0_3 = {
  version: '0.3.0',
  pictureFramesPerSecond: 24,
  pictureDurationFrames: 746,
  pictureDurationMilliseconds: (746 / 24) * 1_000,
  openingGreeting: 'Hi there, I am Corky.',
  defaultCue: 'The Scroll',
  audioClock: {
    policy: 'pause_with_picture',
    status: 'prototype_requires_device_validation',
    sourceDurationFrames: 746,
    pauseDuringNativeHolds: true,
    pauseDuringNonPictureOverlays: true,
  },
  pictureAssets: CINEMATIC_ONBOARDING_PICTURE_ASSETS_V0_3,
  shots: LEGACY_SHOTS_V0_3,
} as const
