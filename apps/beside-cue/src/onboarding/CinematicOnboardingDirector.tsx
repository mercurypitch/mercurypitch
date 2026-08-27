// ============================================================
// Cinematic onboarding director — real choices and resilient media
// ============================================================

import { createEffect, createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch, untrack, } from 'solid-js'
import { createCinematicOnboardingAudioClock } from './cinematic-onboarding-audio'
import type { CinematicOnboardingMediaManifest, CinematicOnboardingMode, CinematicOnboardingRuntimeEvent, CinematicOnboardingRuntimeState, CinematicOnboardingSegmentId, } from './index'
import { CINEMATIC_ONBOARDING_PICTURE_FPS, CINEMATIC_ONBOARDING_REVIEW_FPS, CINEMATIC_ONBOARDING_TIMELINE_V0_5, createCinematicOnboardingRuntime, getCinematicOnboardingAudioClockSlice, getCinematicOnboardingRuntimePosition, isCinematicOnboardingPersistenceAllowed, seekCinematicOnboardingRuntimeForReview, updateCinematicOnboardingRuntime, } from './index'

export interface CinematicOnboardingBSideOption {
  readonly id?: string
  readonly text: string
}

export interface CinematicOnboardingPlanSelection {
  readonly pullId: 'scrolling'
  readonly pullText: 'Endless scrolling'
  readonly sideAText: 'Keep scrolling'
  readonly bSideId?: string
  readonly bSideText: string
}

export type CinematicOnboardingSaveResult =
  | { readonly ok: true; readonly message?: string }
  | { readonly ok: false; readonly message: string }

export interface CinematicOnboardingReminderResult {
  readonly ok: boolean
  readonly message: string
}

export interface CinematicOnboardingDirectorProps {
  readonly media: CinematicOnboardingMediaManifest
  readonly mode?: CinematicOnboardingMode
  readonly bSideOptions: readonly CinematicOnboardingBSideOption[]
  readonly onSavePlan: (
    selection: CinematicOnboardingPlanSelection,
  ) => Promise<CinematicOnboardingSaveResult>
  readonly onSetReminder: (
    time: string,
  ) => Promise<CinematicOnboardingReminderResult>
  readonly onSkipReminder: () => void
  readonly onComplete: (outcome: 'finished' | 'dismissed') => void
  /** Replays every decision without writing plan or reminder state. */
  readonly rehearsal?: boolean
}

const FIXED_PLAN = {
  pullId: 'scrolling',
  pullText: 'Endless scrolling',
  sideAText: 'Keep scrolling',
} as const

const DEFAULT_B_SIDE_OPTIONS: readonly CinematicOnboardingBSideOption[] = [
  { text: 'Put the phone in another room' },
  { text: 'Play one guitar riff' },
  { text: 'Walk to the end of the street' },
]

const CAPTIONS: Readonly<
  Partial<Record<CinematicOnboardingSegmentId, string>>
> = {
  S01_S02_AUTO_ENTRANCE_HELLO: 'Hi there, I am Corky.',
  S03_AUTO_TRACKED_TRANSITION: 'A paper wall reveals the next scene.',
  S04_AUTO_PULL_ENTRANCE: 'The Scroll arrives beside Corky.',
  S04_AUTO_PULL_INTRO: 'The Scroll represents the endless-scrolling Pull.',
  S05_AUTO_REFRAME_SIDE_CHOICE: 'The tray makes room for another choice.',
  S05_CHOOSE_B_SIDE_HOLD: 'Choose one small action for Side B.',
  S06_AUTO_CORKY_PRESS: 'Corky starts the record.',
  S06_AUTO_RECORD_SPIN_BREATH: 'The record spins for one more beat.',
  S06_CONFIRM_AND_SAVE_PLAN_HOLD: 'Stop the record to save your plan.',
  S07_AUTO_STOPPED_ACKNOWLEDGEMENT: 'Corky notices the stop.',
  S07_REMINDER_HOLD: 'A daily reminder is optional.',
  S08_AUTO_TITLE_CLOSE: 'Your plan is ready.',
}

interface NativeOverlayCopy {
  readonly eyebrow: string
  readonly title: string
  readonly body?: string
  readonly closing?: boolean
}

interface NormalizedBSideOption {
  readonly id?: string
  readonly text: string
  readonly key: string
}

type SaveState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'error'; readonly message: string }

type ReminderState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'resolved'; readonly message: string }

type MediaRecoveryStage =
  | 'primary'
  | 'retry'
  | 'reduced-still'
  | 'poster'
  | 'last-known-good'
  | 'brand'

interface MediaCandidate {
  readonly kind: 'video' | 'still' | 'brand'
  readonly stage: MediaRecoveryStage
  readonly src?: string
  readonly poster?: string
  readonly alt: string
}

interface MediaRecoveryState {
  readonly identity: string
  readonly index: number
  readonly elapsedMilliseconds: number
}

interface KnownGoodStill {
  readonly src: string
  readonly alt: string
}

const TIMELINE_POSITIONS = CINEMATIC_ONBOARDING_TIMELINE_V0_5.shots.flatMap(
  (shot) => shot.segments.map((segment) => ({ shotId: shot.id, segment })),
)

export function isCinematicOnboardingReviewEnabled(
  environment: Readonly<Record<string, unknown>>,
): boolean {
  return environment.VITE_BESIDE_CUE_ONBOARDING_REVIEW === '1'
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function nativeOverlayCopy(
  segmentId: CinematicOnboardingSegmentId,
): NativeOverlayCopy | undefined {
  if (segmentId === 'S04_AUTO_PULL_INTRO') {
    return {
      eyebrow: 'Side A · the Pull',
      title: 'The Scroll',
      body: 'Endless scrolling—when the feed keeps going after you meant to leave.',
    }
  }
  if (segmentId === 'S08_AUTO_TITLE_CLOSE') {
    return {
      eyebrow: 'Beside Cue',
      title: 'Your plan is ready.',
      closing: true,
    }
  }
  return undefined
}

function normalizeBSideOptions(
  options: readonly CinematicOnboardingBSideOption[],
): readonly NormalizedBSideOption[] {
  const seen = new Set<string>()
  const normalized: NormalizedBSideOption[] = []
  for (const [index, option] of options.entries()) {
    const text = option.text.trim()
    if (text === '' || seen.has(text)) continue
    seen.add(text)
    normalized.push({
      ...(option.id === undefined ? {} : { id: option.id }),
      text,
      key: option.id ?? `${index}:${text}`,
    })
  }
  return normalized
}

function formatReminderTime(time: string): string {
  const [hours = '0', minutes = '00'] = time.split(':')
  return `${Number(hours)}:${minutes}`
}

function statePlaybackAttempt(state: CinematicOnboardingRuntimeState): number {
  return 'playbackAttempt' in state ? state.playbackAttempt : 0
}

function monotonicNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}

function FilmBrandMark(props: { readonly closing?: boolean }) {
  return (
    <span
      class="cinematic-onboarding__brand-mark"
      classList={{
        'cinematic-onboarding__brand-mark--closing': props.closing === true,
      }}
      role="img"
      aria-label="Beside Cue"
    >
      <span aria-hidden="true">Be</span>
      <span aria-hidden="true" class="cinematic-onboarding__brand-side">
        side
      </span>
      <span aria-hidden="true" class="cinematic-onboarding__brand-cue">
        Cue
      </span>
    </span>
  )
}

function HoldHeading(props: {
  readonly eyebrow: string
  readonly children: string
  readonly headingRef: (element: HTMLHeadingElement) => void
}) {
  return (
    <>
      <p class="cinematic-onboarding__eyebrow">{props.eyebrow}</p>
      <h2 ref={props.headingRef} id="cinematic-hold-title" tabIndex={-1}>
        {props.children}
      </h2>
    </>
  )
}

interface HoldControlsProps {
  readonly segmentId: CinematicOnboardingSegmentId
  readonly bSideOptions: readonly NormalizedBSideOption[]
  readonly selectedBSide?: NormalizedBSideOption
  readonly saveState: SaveState
  readonly reminderState: ReminderState
  readonly reminderTime: string
  readonly onChooseBSide: (option: NormalizedBSideOption) => void
  readonly onConfirmBSide: () => void
  readonly onSavePlan: () => void
  readonly onReminderTime: (time: string) => void
  readonly onSetReminder: () => void
  readonly onSkipReminder: () => void
}

function HoldControls(props: HoldControlsProps) {
  const [selectionAnnouncement, setSelectionAnnouncement] = createSignal('')
  let headingElement: HTMLHeadingElement | undefined

  onMount(() => queueMicrotask(() => headingElement?.focus()))

  function choose(option: NormalizedBSideOption): void {
    props.onChooseBSide(option)
    setSelectionAnnouncement(`${option.text} selected for Side B.`)
  }

  return (
    <section
      class="cinematic-onboarding__interaction"
      aria-labelledby="cinematic-hold-title"
    >
      <Switch>
        <Match when={props.segmentId === 'S05_CHOOSE_B_SIDE_HOLD'}>
          <HoldHeading
            eyebrow="Side B · your choice"
            headingRef={(element) => {
              headingElement = element
            }}
          >
            What would you rather begin?
          </HoldHeading>
          <p>Choose one small action.</p>
          <div
            class="cinematic-onboarding__b-side-options"
            role="group"
            aria-label="Side B choices"
          >
            <For each={props.bSideOptions}>
              {(option) => (
                <button
                  type="button"
                  aria-pressed={props.selectedBSide?.key === option.key}
                  classList={{
                    'is-selected': props.selectedBSide?.key === option.key,
                  }}
                  onClick={() => choose(option)}
                >
                  {option.text}
                </button>
              )}
            </For>
          </div>
          <p class="visually-hidden" aria-live="polite" aria-atomic="true">
            {selectionAnnouncement()}
          </p>
          <button
            class="primary-button primary-button--wide"
            type="button"
            disabled={props.selectedBSide === undefined}
            onClick={() => props.onConfirmBSide()}
          >
            Use this Side B
          </button>
        </Match>

        <Match when={props.segmentId === 'S06_CONFIRM_AND_SAVE_PLAN_HOLD'}>
          <HoldHeading
            eyebrow="Your two sides"
            headingRef={(element) => {
              headingElement = element
            }}
          >
            Stop the record to save this plan.
          </HoldHeading>
          <dl class="cinematic-onboarding__plan-pair">
            <div>
              <dt>Side A</dt>
              <dd>{FIXED_PLAN.sideAText}</dd>
            </div>
            <div>
              <dt>Side B</dt>
              <dd>{props.selectedBSide?.text ?? 'Choose one small action'}</dd>
            </div>
          </dl>
          <button
            class="cinematic-onboarding__record-control is-spinning"
            type="button"
            disabled={
              props.selectedBSide === undefined ||
              props.saveState.kind === 'pending'
            }
            onClick={() => props.onSavePlan()}
          >
            <span aria-hidden="true" />
            {props.saveState.kind === 'pending'
              ? 'Saving your plan…'
              : 'Stop the record'}
          </button>
          <Show when={props.saveState.kind === 'error'}>
            <p class="cinematic-onboarding__inline-status" role="alert">
              {props.saveState.kind === 'error' ? props.saveState.message : ''}
            </p>
          </Show>
        </Match>

        <Match when={props.segmentId === 'S07_REMINDER_HOLD'}>
          <HoldHeading
            eyebrow="Optional"
            headingRef={(element) => {
              headingElement = element
            }}
          >
            Want a daily reminder?
          </HoldHeading>
          <p>Choose a time, or add one later in Settings.</p>
          <Show
            when={props.reminderState.kind !== 'resolved'}
            fallback={
              <p class="cinematic-onboarding__inline-status" aria-hidden="true">
                {props.reminderState.kind === 'resolved'
                  ? props.reminderState.message
                  : ''}
              </p>
            }
          >
            <label class="cinematic-onboarding__reminder-field">
              <span>Time</span>
              <input
                type="time"
                value={props.reminderTime}
                disabled={props.reminderState.kind === 'pending'}
                onInput={(event) =>
                  props.onReminderTime(event.currentTarget.value)
                }
              />
            </label>
            <div class="cinematic-onboarding__reminder-actions">
              <button
                class="primary-button"
                type="button"
                disabled={
                  props.reminderTime === '' ||
                  props.reminderState.kind === 'pending'
                }
                onClick={() => props.onSetReminder()}
              >
                {props.reminderState.kind === 'pending'
                  ? 'Setting reminder…'
                  : `Set for ${formatReminderTime(props.reminderTime)}`}
              </button>
              <button
                class="secondary-button"
                type="button"
                disabled={props.reminderState.kind === 'pending'}
                onClick={() => props.onSkipReminder()}
              >
                Not now
              </button>
            </div>
          </Show>
        </Match>
      </Switch>
    </section>
  )
}

function buildMediaCandidates(
  manifest: CinematicOnboardingMediaManifest,
  segmentId: CinematicOnboardingSegmentId,
  mode: CinematicOnboardingMode,
  lastKnownGood: KnownGoodStill | undefined,
): readonly MediaCandidate[] {
  const registered = manifest.segments[segmentId]
  const candidates: MediaCandidate[] = []
  if (mode === 'normal' && registered.kind === 'automatic') {
    const video = {
      kind: 'video' as const,
      src: registered.video,
      poster: registered.poster,
      alt: registered.alt,
    }
    candidates.push({ ...video, stage: 'primary' })
    candidates.push({ ...video, stage: 'retry' })
    candidates.push({
      kind: 'still',
      stage: 'reduced-still',
      src: registered.reducedStill,
      alt: registered.alt,
    })
  } else {
    const still = {
      kind: 'still' as const,
      src: registered.reducedStill,
      alt: registered.alt,
    }
    candidates.push({ ...still, stage: 'primary' })
    candidates.push({ ...still, stage: 'retry' })
  }
  candidates.push({
    kind: 'still',
    stage: 'poster',
    src: registered.poster,
    alt: registered.alt,
  })
  if (
    lastKnownGood !== undefined &&
    !candidates.some((candidate) => candidate.src === lastKnownGood.src)
  ) {
    candidates.push({
      kind: 'still',
      stage: 'last-known-good',
      src: lastKnownGood.src,
      alt: lastKnownGood.alt,
    })
  }
  candidates.push({
    kind: 'brand',
    stage: 'brand',
    alt: 'Beside Cue continues while the scene artwork is unavailable.',
  })
  return candidates
}

export function CinematicOnboardingDirector(
  props: CinematicOnboardingDirectorProps,
) {
  const requestedMode = createMemo(
    () => props.mode ?? (prefersReducedMotion() ? 'reduced' : 'normal'),
  )
  const mode = untrack(requestedMode)
  const reviewToolsEnabled = isCinematicOnboardingReviewEnabled(
    import.meta.env as Readonly<Record<string, unknown>>,
  )
  const rehearsal = untrack(() => props.rehearsal === true)
  const [runtime, setRuntime] = createSignal(
    createCinematicOnboardingRuntime({
      mode,
      sessionKind: rehearsal || reviewToolsEnabled ? 'review' : 'first_run',
    }),
  )
  const [begun, setBegun] = createSignal(false)
  const [muted, setMuted] = createSignal(false)
  const [playbackPaused, setPlaybackPaused] = createSignal(false)
  const [transientControlsVisible, setTransientControlsVisible] =
    createSignal(false)
  const [audioStatus, setAudioStatus] = createSignal<
    'loading' | 'ready' | 'unavailable'
  >('loading')
  const [documentVisible, setDocumentVisible] = createSignal(true)
  const [selectedBSide, setSelectedBSide] =
    createSignal<NormalizedBSideOption>()
  const [saveState, setSaveState] = createSignal<SaveState>({ kind: 'idle' })
  const [reminderState, setReminderState] = createSignal<ReminderState>({
    kind: 'idle',
  })
  const [reminderTime, setReminderTime] = createSignal('09:00')
  const [mediaGeneration, setMediaGeneration] = createSignal(0)
  const [mediaRecovery, setMediaRecovery] = createSignal<MediaRecoveryState>({
    identity: '',
    index: 0,
    elapsedMilliseconds: 0,
  })
  const [readyPresentationKey, setReadyPresentationKey] = createSignal<string>()
  const [lastKnownGoodStill, setLastKnownGoodStill] =
    createSignal<KnownGoodStill>()
  const initialMedia = untrack(
    () => props.media.segments.S01_S02_AUTO_ENTRANCE_HELLO,
  )
  const [transitionBridge, setTransitionBridge] = createSignal<
    KnownGoodStill | undefined
  >({
    src: initialMedia.poster,
    alt: initialMedia.alt,
  })
  const [revealedVideoKey, setRevealedVideoKey] = createSignal<string>()
  const audioClock = createCinematicOnboardingAudioClock()

  let videoElement: HTMLVideoElement | undefined
  let imageElement: HTMLImageElement | undefined
  let imagePresentationKey: string | undefined
  let dwellTimer: ReturnType<typeof setTimeout> | undefined
  let dwellIdentity: string | undefined
  let dwellRemainingMilliseconds = 0
  let dwellStartedAt: number | undefined
  let visibilityListener: (() => void) | undefined
  let keydownListener: ((event: KeyboardEvent) => void) | undefined
  let controlsTimer: ReturnType<typeof setTimeout> | undefined
  let reminderAdvanceTimer: ReturnType<typeof setTimeout> | undefined
  let videoPlayRequest = 0
  let videoFrameRequest = 0
  let pendingVideoFrameKey: string | undefined
  let activeVideoStartKey: string | undefined
  let saveRequest = 0
  let reminderRequest = 0
  let completionDelivered = false
  let mounted = true
  let audioUnlockFailed = false
  const preloadedStillSources = new Set<string>()

  const position = createMemo(() =>
    getCinematicOnboardingRuntimePosition(runtime()),
  )
  const segmentId = createMemo(() => position()?.segment.id)
  const normalizedBSideOptions = createMemo(() => {
    const supplied = normalizeBSideOptions(props.bSideOptions)
    return supplied.length > 0
      ? supplied
      : normalizeBSideOptions(DEFAULT_B_SIDE_OPTIONS)
  })
  const overlay = createMemo(() => {
    const id = segmentId()
    return id === undefined ? undefined : nativeOverlayCopy(id)
  })
  const presentationIdentity = createMemo(
    () =>
      `${runtime().positionIndex}|${statePlaybackAttempt(runtime())}|${mediaGeneration()}`,
  )
  const effectiveRecovery = createMemo<MediaRecoveryState>(() => {
    const identity = presentationIdentity()
    const recovery = mediaRecovery()
    return recovery.identity === identity
      ? recovery
      : { identity, index: 0, elapsedMilliseconds: 0 }
  })
  const mediaCandidates = createMemo(() => {
    const id = segmentId()
    return id === undefined
      ? []
      : buildMediaCandidates(props.media, id, mode, lastKnownGoodStill())
  })
  const mediaCandidate = createMemo<MediaCandidate | undefined>(() => {
    const candidates = mediaCandidates()
    const recovery = effectiveRecovery()
    return candidates[recovery.index] ?? candidates.at(-1)
  })
  const presentationKey = createMemo(() => {
    const id = segmentId()
    const candidate = mediaCandidate()
    return id === undefined || candidate === undefined
      ? undefined
      : `${presentationIdentity()}|${effectiveRecovery().index}|${candidate.stage}`
  })
  const canPause = createMemo(() => {
    const status = runtime().status
    return status === 'loading' || status === 'playing'
  })
  const persistenceMutationPending = createMemo(
    () => saveState().kind === 'pending' || reminderState().kind === 'pending',
  )
  const reminderOutcomeMessage = createMemo(() => {
    const state = reminderState()
    return state.kind === 'resolved' ? state.message : ''
  })
  const persistenceAllowed = createMemo(
    () =>
      !rehearsal &&
      !reviewToolsEnabled &&
      isCinematicOnboardingPersistenceAllowed(runtime()),
  )

  function pauseSound(): void {
    audioClock.pause()
  }

  function resetDwell(): void {
    if (dwellTimer !== undefined) clearTimeout(dwellTimer)
    dwellTimer = undefined
    dwellIdentity = undefined
    dwellRemainingMilliseconds = 0
    dwellStartedAt = undefined
  }

  function currentDwellDuration(): number | undefined {
    if (runtime().status !== 'playing' || mediaCandidate()?.kind === 'video') {
      return undefined
    }
    const segment = position()?.segment
    if (segment?.kind === 'automatic') {
      return (
        (segment.mediaDurationFrames / CINEMATIC_ONBOARDING_PICTURE_FPS) * 1_000
      )
    }
    if (segment?.kind === 'automatic_native_overlay') {
      return (
        (segment.nativeDurationFrames / CINEMATIC_ONBOARDING_PICTURE_FPS) *
        1_000
      )
    }
    return undefined
  }

  function currentDwellIdentity(): string | undefined {
    return presentationKey()
  }

  function prepareDwell(identity: string, duration: number): void {
    if (dwellIdentity === identity) return
    resetDwell()
    dwellIdentity = identity
    dwellRemainingMilliseconds = Math.max(
      0,
      duration - effectiveRecovery().elapsedMilliseconds,
    )
  }

  function pauseDwell(): void {
    if (dwellStartedAt !== undefined) {
      dwellRemainingMilliseconds = Math.max(
        0,
        dwellRemainingMilliseconds - (monotonicNow() - dwellStartedAt),
      )
    }
    if (dwellTimer !== undefined) clearTimeout(dwellTimer)
    dwellTimer = undefined
    dwellStartedAt = undefined
  }

  function dwellElapsedMilliseconds(): number {
    const duration = currentDwellDuration()
    const identity = currentDwellIdentity()
    if (duration === undefined || identity === undefined) return 0
    prepareDwell(identity, duration)
    const runningElapsed =
      dwellStartedAt === undefined ? 0 : monotonicNow() - dwellStartedAt
    return Math.min(
      duration,
      Math.max(0, duration - dwellRemainingMilliseconds + runningElapsed),
    )
  }

  function playSoundForCurrentPicture(): void {
    const slice = getCinematicOnboardingAudioClockSlice(runtime())
    const candidate = mediaCandidate()
    if (
      slice === undefined ||
      slice.behavior !== 'advance_with_picture' ||
      audioStatus() !== 'ready' ||
      muted() ||
      playbackPaused() ||
      !documentVisible() ||
      readyPresentationKey() !== presentationKey()
    ) {
      return
    }
    const mediaOffsetSeconds =
      candidate?.kind === 'video'
        ? (videoElement?.currentTime ?? 0)
        : dwellElapsedMilliseconds() / 1_000
    const offset =
      slice.startFrame / CINEMATIC_ONBOARDING_REVIEW_FPS + mediaOffsetSeconds
    void audioClock.start(offset)
  }

  function deliverCompletion(outcome: 'finished' | 'dismissed'): void {
    if (completionDelivered) return
    completionDelivered = true
    resetDwell()
    pauseSound()
    props.onComplete(outcome)
  }

  function dispatch(
    input: Parameters<typeof updateCinematicOnboardingRuntime>[1],
  ): boolean {
    const previous = runtime()
    const next = updateCinematicOnboardingRuntime(previous, input)
    if (next === previous) return false
    setRuntime(next)
    if (previous.status !== 'complete' && next.status === 'complete') {
      deliverCompletion(next.completion)
    }
    return true
  }

  function isCurrentPresentation(token: string): boolean {
    return mounted && presentationKey() === token
  }

  function preloadStill(src: string): void {
    if (typeof Image === 'undefined' || preloadedStillSources.has(src)) return
    preloadedStillSources.add(src)
    const image = new Image()
    image.src = src
    if (typeof image.decode === 'function') {
      void image.decode().catch(() => undefined)
    }
  }

  function stageCurrentFinalBridge(): void {
    const id = segmentId()
    if (id === undefined) return
    const registered = props.media.segments[id]
    preloadStill(registered.reducedStill)
    setTransitionBridge({
      src: registered.reducedStill,
      alt: registered.alt,
    })
  }

  function invalidatePendingVideoFrame(): void {
    videoFrameRequest += 1
    pendingVideoFrameKey = undefined
  }

  function revealVideoPresentation(
    video: HTMLVideoElement,
    id: CinematicOnboardingSegmentId,
    attempt: number,
    token: string,
  ): void {
    if (
      !isCurrentPresentation(token) ||
      videoElement !== video ||
      playbackPaused() ||
      !documentVisible() ||
      video.seeking ||
      revealedVideoKey() === token ||
      pendingVideoFrameKey === token
    ) {
      return
    }

    const request = ++videoFrameRequest
    pendingVideoFrameKey = token
    const reveal = () =>
      untrack(() => {
        if (
          request !== videoFrameRequest ||
          pendingVideoFrameKey !== token ||
          !isCurrentPresentation(token) ||
          videoElement !== video ||
          playbackPaused() ||
          !documentVisible()
        ) {
          return
        }
        pendingVideoFrameKey = undefined
        setRevealedVideoKey(token)
        setReadyPresentationKey(token)
        if (runtime().status === 'loading') {
          dispatch({
            type: 'MEDIA_READY',
            segmentId: id,
            playbackAttempt: attempt,
          })
        }
      })

    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => reveal())
      return
    }
    reveal()
  }

  function retireTransitionBridge(token: string): void {
    if (!isCurrentPresentation(token) || revealedVideoKey() !== token) return
    setTransitionBridge(undefined)
  }

  function recordRecovery(
    event: string,
    candidate: MediaCandidate,
    nextCandidate: MediaCandidate,
  ): void {
    if (!reviewToolsEnabled && !import.meta.env.DEV) return
    console.info('[beside-cue:onboarding-media]', {
      segment: segmentId(),
      asset: candidate.src ?? 'native-brand',
      attempt: effectiveRecovery().index,
      event,
      platform: navigator.userAgent,
      fallback: nextCandidate.stage,
    })
  }

  function recoverMedia(token: string, event: string): void {
    if (!isCurrentPresentation(token)) return
    const candidate = mediaCandidate()
    const candidates = mediaCandidates()
    const recovery = effectiveRecovery()
    const nextIndex = Math.min(recovery.index + 1, candidates.length - 1)
    const nextCandidate = candidates[nextIndex]
    if (candidate === undefined || nextCandidate === undefined) return

    recordRecovery(event, candidate, nextCandidate)
    const elapsedMilliseconds =
      candidate.kind === 'video'
        ? Math.max(
            recovery.elapsedMilliseconds,
            (videoElement?.currentTime ?? 0) * 1_000,
          )
        : recovery.elapsedMilliseconds
    if (transitionBridge() === undefined) stageCurrentFinalBridge()
    videoPlayRequest += 1
    invalidatePendingVideoFrame()
    setRevealedVideoKey(undefined)
    activeVideoStartKey = undefined
    videoElement?.pause()
    pauseDwell()
    pauseSound()
    setReadyPresentationKey(undefined)
    setMediaRecovery({
      identity: recovery.identity,
      index: nextIndex,
      elapsedMilliseconds,
    })
    queueMicrotask(startCurrentBeat)
  }

  function reportStillElement(
    image: HTMLImageElement,
    id: CinematicOnboardingSegmentId,
    attempt: number,
    token: string,
    candidate: MediaCandidate,
  ): void {
    if (!begun() || !isCurrentPresentation(token)) return
    if (image.naturalWidth <= 0 || candidate.src === undefined) {
      recoverMedia(token, 'still-empty')
      return
    }
    setLastKnownGoodStill({ src: candidate.src, alt: candidate.alt })
    setReadyPresentationKey(token)
    setTransitionBridge(undefined)
    if (runtime().status === 'loading') {
      dispatch({
        type: 'MEDIA_READY',
        segmentId: id,
        playbackAttempt: attempt,
      })
    }
  }

  function armDwell(): void {
    const state = runtime()
    const id = segmentId()
    const duration = currentDwellDuration()
    const identity = currentDwellIdentity()
    if (
      !begun() ||
      playbackPaused() ||
      !documentVisible() ||
      state.status !== 'playing' ||
      id === undefined ||
      duration === undefined ||
      identity === undefined ||
      readyPresentationKey() !== presentationKey()
    ) {
      return
    }

    prepareDwell(identity, duration)
    if (dwellTimer !== undefined) return
    const attempt = state.playbackAttempt
    const segment = position()?.segment
    dwellStartedAt = monotonicNow()
    dwellTimer = setTimeout(() => {
      if (dwellIdentity !== identity || presentationKey() !== identity) return
      dwellTimer = undefined
      dwellStartedAt = undefined
      dwellRemainingMilliseconds = 0
      pauseSound()
      resetDwell()
      stageCurrentFinalBridge()
      const input =
        mode === 'reduced'
          ? ({
              type: 'REDUCED_DWELL_ENDED',
              segmentId: id,
              playbackAttempt: attempt,
            } as const)
          : segment?.kind === 'automatic'
            ? ({
                type: 'MEDIA_ENDED',
                segmentId: id,
                playbackAttempt: attempt,
              } as const)
            : ({
                type: 'NATIVE_OVERLAY_ENDED',
                segmentId: id,
                playbackAttempt: attempt,
              } as const)
      if (dispatch(input)) queueMicrotask(startCurrentBeat)
    }, dwellRemainingMilliseconds)
  }

  function startCurrentBeat(): void {
    const state = runtime()
    const candidate = mediaCandidate()
    const token = presentationKey()
    const id = segmentId()
    if (
      !begun() ||
      playbackPaused() ||
      !documentVisible() ||
      candidate === undefined ||
      token === undefined ||
      id === undefined
    ) {
      return
    }
    if (state.status === 'holding' || state.status === 'complete') {
      pauseSound()
      return
    }
    if (state.status !== 'loading' && state.status !== 'playing') return

    const attempt = state.playbackAttempt
    if (candidate.kind === 'brand') {
      setReadyPresentationKey(token)
      setTransitionBridge(undefined)
      if (state.status === 'loading') {
        dispatch({
          type: 'MEDIA_READY',
          segmentId: id,
          playbackAttempt: attempt,
        })
      }
      queueMicrotask(armDwell)
      return
    }

    if (candidate.kind === 'still') {
      const image = imageElement
      if (
        image === undefined ||
        imagePresentationKey !== token ||
        !image.complete
      ) {
        return
      }
      reportStillElement(image, id, attempt, token, candidate)
      return
    }

    const video = videoElement
    if (video === undefined) return
    if (state.status === 'playing') {
      void video
        .play()
        .catch(() => untrack(() => recoverMedia(token, 'video-resume')))
      return
    }
    if (activeVideoStartKey === token) return
    activeVideoStartKey = token
    const playRequest = ++videoPlayRequest
    void video.play().catch(() => {
      untrack(() => {
        if (
          playRequest !== videoPlayRequest ||
          playbackPaused() ||
          !documentVisible() ||
          videoElement !== video ||
          !isCurrentPresentation(token)
        ) {
          return
        }
        activeVideoStartKey = undefined
        recoverMedia(token, 'video-start')
      })
    })
  }

  function completeHold(event: CinematicOnboardingRuntimeEvent): void {
    stageCurrentFinalBridge()
    if (dispatch({ type: 'USER_EVENT', event })) {
      queueMicrotask(startCurrentBeat)
    }
  }

  function chooseBSide(option: NormalizedBSideOption): void {
    setSelectedBSide(option)
  }

  function confirmBSide(option: NormalizedBSideOption): void {
    setSelectedBSide(option)
    setSaveState({ kind: 'idle' })
    completeHold('user_chooses_b_side')
  }

  async function savePlan(): Promise<void> {
    const option = selectedBSide() ?? normalizedBSideOptions()[0]
    if (
      option === undefined ||
      saveState().kind === 'pending' ||
      runtime().status !== 'holding'
    ) {
      return
    }
    setSaveState({ kind: 'pending' })
    const request = ++saveRequest
    const positionIndex = runtime().positionIndex
    let result: CinematicOnboardingSaveResult
    if (!persistenceAllowed()) {
      result = { ok: true }
    } else {
      try {
        result = await props.onSavePlan({
          ...FIXED_PLAN,
          ...(option.id === undefined ? {} : { bSideId: option.id }),
          bSideText: option.text,
        })
      } catch {
        result = {
          ok: false,
          message: 'Your plan was not saved. Try again.',
        }
      }
    }
    if (
      !mounted ||
      request !== saveRequest ||
      runtime().positionIndex !== positionIndex
    ) {
      return
    }
    if (!result.ok) {
      setSaveState({ kind: 'error', message: result.message })
      return
    }
    setSaveState({ kind: 'idle' })
    completeHold('user_confirms_and_saves_plan')
  }

  function finishReminder(message: string): void {
    setReminderState({ kind: 'resolved', message })
    if (reminderAdvanceTimer !== undefined) clearTimeout(reminderAdvanceTimer)
    const positionIndex = runtime().positionIndex
    reminderAdvanceTimer = setTimeout(() => {
      reminderAdvanceTimer = undefined
      if (runtime().positionIndex !== positionIndex) return
      completeHold('user_sets_or_skips_reminder')
    }, 1_000)
  }

  function noWriteReminderMessage(): string {
    return rehearsal
      ? 'Replay only. Your reminder was not changed.'
      : 'Review only. No reminder was changed.'
  }

  async function setReminder(): Promise<void> {
    const time = reminderTime()
    if (
      time === '' ||
      reminderState().kind === 'pending' ||
      runtime().status !== 'holding'
    ) {
      return
    }
    setReminderState({ kind: 'pending' })
    const request = ++reminderRequest
    const positionIndex = runtime().positionIndex
    let result: CinematicOnboardingReminderResult
    if (!persistenceAllowed()) {
      result = {
        ok: true,
        message: noWriteReminderMessage(),
      }
    } else {
      try {
        result = await props.onSetReminder(time)
      } catch {
        result = {
          ok: false,
          message: 'Daily reminder is off. Cue me now still works.',
        }
      }
    }
    if (
      !mounted ||
      request !== reminderRequest ||
      runtime().positionIndex !== positionIndex
    ) {
      return
    }
    finishReminder(result.message)
  }

  function skipReminder(): void {
    if (
      reminderState().kind === 'pending' ||
      reminderState().kind === 'resolved' ||
      runtime().status !== 'holding'
    ) {
      return
    }
    reminderRequest += 1
    if (persistenceAllowed()) props.onSkipReminder()
    finishReminder(
      persistenceAllowed()
        ? 'No reminder set. You can add one later in Settings.'
        : noWriteReminderMessage(),
    )
  }

  function begin(): void {
    if (begun()) return
    setMuted(false)
    setPlaybackPaused(false)
    setBegun(true)
    void audioClock
      .unlock()
      .then((ready) => {
        if (!ready && mounted) {
          audioUnlockFailed = true
          setAudioStatus('unavailable')
        }
      })
      .catch(() => {
        if (mounted) {
          audioUnlockFailed = true
          setAudioStatus('unavailable')
        }
      })
    queueMicrotask(startCurrentBeat)
  }

  function togglePlayback(): void {
    if (!canPause()) return
    const nextPaused = !playbackPaused()
    setPlaybackPaused(nextPaused)
    setTransientControlsVisible(true)
    if (nextPaused) {
      videoPlayRequest += 1
      invalidatePendingVideoFrame()
      activeVideoStartKey = undefined
      videoElement?.pause()
      pauseDwell()
      pauseSound()
      return
    }
    queueMicrotask(resumeCurrentBeat)
    scheduleControlsHide()
  }

  function toggleSound(): void {
    if (audioStatus() !== 'ready') return
    const nextMuted = !muted()
    setMuted(nextMuted)
    if (nextMuted) {
      pauseSound()
      return
    }
    void audioClock.unlock()
    queueMicrotask(playSoundForCurrentPicture)
  }

  function resumeCurrentBeat(): void {
    if (!begun() || !documentVisible() || playbackPaused()) return
    if (runtime().status === 'loading') {
      startCurrentBeat()
      return
    }
    if (runtime().status !== 'playing') return
    if (mediaCandidate()?.kind === 'video') {
      void videoElement?.play().catch(() =>
        untrack(() => {
          const token = presentationKey()
          if (token !== undefined) recoverMedia(token, 'video-resume')
        }),
      )
      return
    }
    armDwell()
  }

  function scheduleControlsHide(): void {
    if (controlsTimer !== undefined) clearTimeout(controlsTimer)
    if (playbackPaused()) return
    controlsTimer = setTimeout(() => {
      controlsTimer = undefined
      setTransientControlsVisible(false)
    }, 4_000)
  }

  function revealTransientControls(): void {
    if (!begun() || reviewToolsEnabled) return
    setTransientControlsVisible(true)
    scheduleControlsHide()
  }

  function resetInteractionStateForReview(targetShotIndex: number): void {
    saveRequest += 1
    reminderRequest += 1
    if (reminderAdvanceTimer !== undefined) clearTimeout(reminderAdvanceTimer)
    reminderAdvanceTimer = undefined
    setSaveState({ kind: 'idle' })
    setReminderState({ kind: 'idle' })
    if (targetShotIndex <= 3) {
      setSelectedBSide(undefined)
    } else if (selectedBSide() === undefined) {
      setSelectedBSide(normalizedBSideOptions()[0])
    }
  }

  function seekReview(action: 'previous' | 'replay' | 'next'): void {
    if (persistenceMutationPending()) return
    const currentShotId = position()?.shotId
    const currentShotIndex = CINEMATIC_ONBOARDING_TIMELINE_V0_5.shots.findIndex(
      (shot) => shot.id === currentShotId,
    )
    if (currentShotIndex < 0) return
    const targetShotIndex =
      action === 'previous'
        ? Math.max(0, currentShotIndex - 1)
        : action === 'next'
          ? Math.min(
              CINEMATIC_ONBOARDING_TIMELINE_V0_5.shots.length - 1,
              currentShotIndex + 1,
            )
          : currentShotIndex
    const firstSegment =
      CINEMATIC_ONBOARDING_TIMELINE_V0_5.shots[targetShotIndex]?.segments[0]
    if (firstSegment === undefined) return

    videoPlayRequest += 1
    invalidatePendingVideoFrame()
    stageCurrentFinalBridge()
    setRevealedVideoKey(undefined)
    activeVideoStartKey = undefined
    videoElement?.pause()
    resetDwell()
    pauseSound()
    setReadyPresentationKey(undefined)
    setMediaGeneration((value) => value + 1)
    resetInteractionStateForReview(targetShotIndex)
    setRuntime(
      action === 'replay'
        ? seekCinematicOnboardingRuntimeForReview(runtime(), firstSegment.id)
        : seekCinematicOnboardingRuntimeForReview(runtime(), firstSegment.id),
    )
    queueMicrotask(startCurrentBeat)
  }

  function dismiss(): void {
    if (persistenceMutationPending()) return
    dispatch({ type: 'DISMISS' })
  }

  createEffect(() => {
    const identity = presentationIdentity()
    untrack(() => {
      if (mediaRecovery().identity === identity) return
      setMediaRecovery({ identity, index: 0, elapsedMilliseconds: 0 })
      setReadyPresentationKey(undefined)
      invalidatePendingVideoFrame()
      setRevealedVideoKey(undefined)
      activeVideoStartKey = undefined
      resetDwell()
    })
  })

  createEffect(() => {
    const state = runtime()
    const candidate = mediaCandidate()
    const isBegun = begun()
    const isVisible = documentVisible()
    const isPaused = playbackPaused()
    const ready = readyPresentationKey() === presentationKey()

    if (
      !isBegun ||
      state.status !== 'playing' ||
      candidate?.kind === 'video' ||
      !ready
    ) {
      resetDwell()
      return
    }
    const duration = currentDwellDuration()
    const identity = currentDwellIdentity()
    if (duration === undefined || identity === undefined) {
      resetDwell()
      return
    }
    prepareDwell(identity, duration)
    if (!isVisible || isPaused) {
      pauseDwell()
      return
    }
    armDwell()
  })

  createEffect(() => {
    const shouldPlay =
      audioStatus() === 'ready' &&
      begun() &&
      documentVisible() &&
      !playbackPaused() &&
      !muted() &&
      runtime().status === 'playing' &&
      readyPresentationKey() === presentationKey()
    segmentId()
    mediaCandidate()
    if (shouldPlay) playSoundForCurrentPicture()
    else pauseSound()
  })

  createEffect(() => {
    const index = runtime().positionIndex
    for (const targetIndex of [index, index + 1]) {
      const target = TIMELINE_POSITIONS[targetIndex]
      if (target === undefined) continue
      const registered = props.media.segments[target.segment.id]
      preloadStill(registered.poster)
      preloadStill(registered.reducedStill)
    }
  })

  createEffect(() => {
    const token = presentationKey()
    if (
      !begun() ||
      token === undefined ||
      mediaCandidate()?.kind !== 'brand' ||
      readyPresentationKey() === token
    ) {
      return
    }
    queueMicrotask(() =>
      untrack(() => {
        if (!isCurrentPresentation(token)) return
        setReadyPresentationKey(token)
        startCurrentBeat()
      }),
    )
  })

  onMount(() => {
    setDocumentVisible(document.visibilityState !== 'hidden')
    void audioClock
      .load(props.media.audio.src)
      .catch(() => false)
      .then((ready) => {
        if (!mounted || audioUnlockFailed) return
        setAudioStatus(ready ? 'ready' : 'unavailable')
      })
    visibilityListener = () =>
      untrack(() => {
        if (document.visibilityState === 'hidden') {
          setDocumentVisible(false)
          videoPlayRequest += 1
          invalidatePendingVideoFrame()
          activeVideoStartKey = undefined
          videoElement?.pause()
          pauseDwell()
          pauseSound()
          return
        }
        setDocumentVisible(true)
        if (!playbackPaused()) queueMicrotask(resumeCurrentBeat)
      })
    keydownListener = (event) =>
      untrack(() => {
        if (!begun() || reviewToolsEnabled || event.key !== 'Escape') return
        event.preventDefault()
        revealTransientControls()
      })
    document.addEventListener('visibilitychange', visibilityListener)
    document.addEventListener('keydown', keydownListener)
  })

  onCleanup(() => {
    mounted = false
    saveRequest += 1
    reminderRequest += 1
    videoPlayRequest += 1
    invalidatePendingVideoFrame()
    resetDwell()
    if (controlsTimer !== undefined) clearTimeout(controlsTimer)
    if (reminderAdvanceTimer !== undefined) clearTimeout(reminderAdvanceTimer)
    if (visibilityListener !== undefined) {
      document.removeEventListener('visibilitychange', visibilityListener)
    }
    if (keydownListener !== undefined) {
      document.removeEventListener('keydown', keydownListener)
    }
    videoElement?.pause()
    pauseSound()
    audioClock.dispose()
  })

  const currentShotIndex = createMemo(() =>
    CINEMATIC_ONBOARDING_TIMELINE_V0_5.shots.findIndex(
      (shot) => shot.id === position()?.shotId,
    ),
  )

  return (
    <main
      class="cinematic-onboarding app-screen"
      aria-label="Meet Corky and make your first plan"
    >
      <div
        class="cinematic-onboarding__picture"
        onPointerUp={revealTransientControls}
      >
        <Show when={transitionBridge()} keyed>
          {(bridge) => (
            <img
              class="cinematic-onboarding__transition-bridge"
              src={bridge.src}
              alt=""
              aria-hidden="true"
            />
          )}
        </Show>
        <Show
          when={presentationKey()}
          fallback={
            <div
              class="cinematic-onboarding__picture-fallback"
              role="img"
              aria-label="Beside Cue opening"
            >
              <FilmBrandMark />
            </div>
          }
          keyed
        >
          {(token) => {
            const id = segmentId()
            const candidate = mediaCandidate()
            const attempt = statePlaybackAttempt(runtime())
            if (id === undefined || candidate === undefined) return null
            if (candidate.kind === 'brand') {
              return (
                <div
                  class="cinematic-onboarding__picture-fallback"
                  role="img"
                  aria-label={candidate.alt}
                >
                  <FilmBrandMark />
                </div>
              )
            }
            if (candidate.kind === 'video') {
              return (
                <video
                  classList={{
                    'cinematic-onboarding__media--revealed':
                      revealedVideoKey() === token,
                  }}
                  ref={(element) => {
                    videoElement = element
                    queueMicrotask(startCurrentBeat)
                  }}
                  src={candidate.src}
                  poster={candidate.poster}
                  aria-label={candidate.alt}
                  playsinline
                  muted
                  preload="auto"
                  onLoadedMetadata={(event) => {
                    const elapsed = effectiveRecovery().elapsedMilliseconds
                    if (elapsed <= 0 || !isCurrentPresentation(token)) return
                    try {
                      event.currentTarget.currentTime = elapsed / 1_000
                    } catch {
                      // The stable-plate fallback retains the authored duration.
                    }
                  }}
                  onLoadedData={(event) =>
                    revealVideoPresentation(
                      event.currentTarget,
                      id,
                      attempt,
                      token,
                    )
                  }
                  onPlay={(event) => {
                    if (!isCurrentPresentation(token)) return
                    if (playbackPaused() || !documentVisible()) {
                      event.currentTarget.pause()
                    }
                  }}
                  onPlaying={(event) =>
                    revealVideoPresentation(
                      event.currentTarget,
                      id,
                      attempt,
                      token,
                    )
                  }
                  onSeeked={(event) =>
                    revealVideoPresentation(
                      event.currentTarget,
                      id,
                      attempt,
                      token,
                    )
                  }
                  onTransitionEnd={() => retireTransitionBridge(token)}
                  onEnded={() => {
                    if (!isCurrentPresentation(token)) return
                    stageCurrentFinalBridge()
                    if (
                      dispatch({
                        type: 'MEDIA_ENDED',
                        segmentId: id,
                        playbackAttempt: attempt,
                      })
                    ) {
                      pauseSound()
                      queueMicrotask(startCurrentBeat)
                    }
                  }}
                  onError={() => recoverMedia(token, 'video-element')}
                />
              )
            }
            return (
              <img
                classList={{
                  'cinematic-onboarding__media--revealed':
                    readyPresentationKey() === token,
                }}
                ref={(element) => {
                  imageElement = element
                  imagePresentationKey = token
                  if (element.complete) {
                    queueMicrotask(() =>
                      untrack(() =>
                        reportStillElement(
                          element,
                          id,
                          attempt,
                          token,
                          candidate,
                        ),
                      ),
                    )
                  }
                }}
                src={candidate.src}
                alt={candidate.alt}
                onLoad={(event) =>
                  reportStillElement(
                    event.currentTarget,
                    id,
                    attempt,
                    token,
                    candidate,
                  )
                }
                onError={() => recoverMedia(token, 'still-element')}
              />
            )
          }}
        </Show>
        <span class="cinematic-onboarding__shade" aria-hidden="true" />
      </div>

      <Show when={!begun()}>
        <button
          class="cinematic-onboarding__curtain"
          type="button"
          aria-label="Tap to begin"
          onClick={begin}
        >
          <FilmBrandMark />
          <span class="cinematic-onboarding__curtain-line" aria-hidden="true">
            One Pull. One chosen turn.
          </span>
          <span class="cinematic-onboarding__begin-label" aria-hidden="true">
            Tap to begin
          </span>
          <span class="cinematic-onboarding__curtain-note" aria-hidden="true">
            Sound starts after your tap. Captions stay on.
          </span>
        </button>
      </Show>

      <Show when={begun()}>
        <div class="cinematic-onboarding__sound-control">
          <button
            type="button"
            aria-label={
              audioStatus() === 'unavailable'
                ? 'Sound unavailable; captions are on'
                : muted()
                  ? 'Unmute audio'
                  : 'Mute audio'
            }
            aria-pressed={muted()}
            disabled={audioStatus() !== 'ready'}
            classList={{ 'is-muted': muted() || audioStatus() !== 'ready' }}
            onClick={toggleSound}
          >
            <span
              class="cinematic-onboarding__speaker-icon"
              aria-hidden="true"
            />
          </button>
        </div>

        <Show when={reviewToolsEnabled}>
          <nav
            class="cinematic-onboarding__review-tools"
            aria-label="Onboarding review controls"
          >
            <code>{segmentId() ?? 'complete'}</code>
            <div>
              <button
                type="button"
                disabled={
                  persistenceMutationPending() || currentShotIndex() <= 0
                }
                onClick={() => seekReview('previous')}
              >
                ‹ Previous
              </button>
              <button
                type="button"
                disabled={persistenceMutationPending()}
                onClick={() => seekReview('replay')}
              >
                Replay scene
              </button>
              <button
                type="button"
                disabled={
                  persistenceMutationPending() ||
                  currentShotIndex() >=
                    CINEMATIC_ONBOARDING_TIMELINE_V0_5.shots.length - 1
                }
                onClick={() => seekReview('next')}
              >
                Next ›
              </button>
            </div>
          </nav>
        </Show>

        <Show when={transientControlsVisible() && !reviewToolsEnabled}>
          <section
            class="cinematic-onboarding__transient-controls"
            aria-label="Temporary film controls"
          >
            <button
              type="button"
              disabled={!canPause()}
              aria-pressed={playbackPaused()}
              onClick={togglePlayback}
            >
              {playbackPaused() ? 'Resume film' : 'Pause film'}
            </button>
            <button
              type="button"
              disabled={persistenceMutationPending()}
              title={
                persistenceMutationPending()
                  ? 'Wait for this change to finish.'
                  : undefined
              }
              onClick={dismiss}
            >
              Leave introduction
            </button>
            <button
              type="button"
              aria-label="Hide film controls"
              onClick={() => setTransientControlsVisible(false)}
            >
              Close
            </button>
          </section>
        </Show>

        <Show when={runtime().status === 'holding' && segmentId()} keyed>
          {(id) => (
            <HoldControls
              segmentId={id}
              bSideOptions={normalizedBSideOptions()}
              selectedBSide={selectedBSide()}
              saveState={saveState()}
              reminderState={reminderState()}
              reminderTime={reminderTime()}
              onChooseBSide={chooseBSide}
              onConfirmBSide={() => {
                const option = selectedBSide()
                if (option !== undefined) confirmBSide(option)
              }}
              onSavePlan={() => void savePlan()}
              onReminderTime={setReminderTime}
              onSetReminder={() => void setReminder()}
              onSkipReminder={skipReminder}
            />
          )}
        </Show>

        <Show when={overlay()} keyed>
          {(copy) => (
            <section
              class="cinematic-onboarding__native-overlay"
              classList={{
                'cinematic-onboarding__native-overlay--closing':
                  copy.closing === true,
              }}
              aria-live="polite"
            >
              <Show when={copy.closing}>
                <FilmBrandMark closing />
              </Show>
              <p class="cinematic-onboarding__eyebrow">{copy.eyebrow}</p>
              <h2>{copy.title}</h2>
              <Show when={copy.body}>{(body) => <p>{body()}</p>}</Show>
            </section>
          )}
        </Show>

        <p
          class="visually-hidden"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {reminderOutcomeMessage()}
        </p>

        <Show when={segmentId()} keyed>
          {(id) => (
            <p
              class="cinematic-onboarding__caption"
              aria-live="polite"
              aria-atomic="true"
            >
              {CAPTIONS[id] ?? 'Beside Cue keeps your chosen action in view.'}
            </p>
          )}
        </Show>
      </Show>
    </main>
  )
}
