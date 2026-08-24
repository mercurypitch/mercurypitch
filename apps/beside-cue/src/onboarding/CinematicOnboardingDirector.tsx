// ============================================================
// Cinematic onboarding director — media, audio, and native holds
// ============================================================

import { createEffect, createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch, untrack, } from 'solid-js'
import { createCinematicOnboardingAudioClock } from './cinematic-onboarding-audio'
import type { CinematicOnboardingMediaManifest, CinematicOnboardingMode, CinematicOnboardingRuntimeEvent, CinematicOnboardingRuntimeState, CinematicOnboardingSegmentId, } from './index'
import { CINEMATIC_ONBOARDING_REVIEW_FPS, CINEMATIC_ONBOARDING_TIMELINE_V0_3, createCinematicOnboardingRuntime, getCinematicOnboardingAudioClockSlice, getCinematicOnboardingNativeOverlayDurationMilliseconds, getCinematicOnboardingReducedDwellMilliseconds, getCinematicOnboardingRuntimePosition, resolveCinematicOnboardingMedia, updateCinematicOnboardingRuntime, } from './index'

export interface CinematicOnboardingDirectorProps {
  readonly media: CinematicOnboardingMediaManifest
  readonly mode?: CinematicOnboardingMode
  readonly onComplete: (outcome: 'finished' | 'dismissed') => void
}

const CAPTIONS: Readonly<
  Partial<Record<CinematicOnboardingSegmentId, string>>
> = {
  S01_S02_AUTO_ENTRANCE_HELLO: 'Hi there, I am Corky.',
  S03_AUTO_TRACKED_TRANSITION: 'Come see how a small cue can change direction.',
  S04_AUTO_CUE_ENTRANCE: 'The Scroll arrives beside Corky.',
  S04_SIM_CUE_TAP_HOLD: 'Meet the pull you want to notice.',
  S05_AUTO_REFRAME_SORT: 'The reasons settle into two clear sides.',
  S05_SIM_SORT_HOLD: 'Both sides can stay visible without judgment.',
  S06_AUTO_CORKY_PRESS: 'Corky starts the record.',
  S06_SIM_USER_SPIN_STOP_HOLD: 'The record is turning. Choose when to stop.',
  S07_AUTO_STOPPED_ACKNOWLEDGEMENT: 'Corky notices the pause.',
  S07_AUTO_REMINDER_DIAL_REVEAL: 'A gentle cue can return when you choose.',
  S07_SIM_REMINDER_HOLD: 'Choose a time, or leave it for later.',
  S07_AUTO_CONFIRM: 'Nothing is scheduled during this preview.',
  S08_AUTO_TITLE_CLOSE: 'Keep your better choice beside the moment.',
}

interface NativeOverlayCopy {
  readonly eyebrow: string
  readonly title: string
  readonly body: string
}

function nativeOverlayCopy(
  segmentId: CinematicOnboardingSegmentId,
  reminderChoice: string,
): NativeOverlayCopy | undefined {
  if (segmentId === 'S07_AUTO_REMINDER_DIAL_REVEAL') {
    return {
      eyebrow: 'Preview only',
      title: 'When should it come beside you?',
      body: 'This introduction does not schedule anything.',
    }
  }
  if (segmentId === 'S07_AUTO_CONFIRM') {
    return {
      eyebrow: 'Preview only',
      title:
        reminderChoice === 'Not now'
          ? 'Nothing scheduled.'
          : `${reminderChoice} is only a preview.`,
      body: 'You can set a private reminder after making your first cue.',
    }
  }
  if (segmentId === 'S08_AUTO_TITLE_CLOSE') {
    return {
      eyebrow: 'Beside Cue',
      title: 'Keep your better choice beside the moment.',
      body: 'Private by design, ready when a small turn matters.',
    }
  }
  return undefined
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

type SortSide = 'a' | 'b'

const SORT_CHIPS = [
  { id: 'pause', label: 'Pause', color: 'cream' },
  { id: 'familiar', label: 'Familiar', color: 'coral' },
  { id: 'ten-minutes', label: 'Ten minutes', color: 'cream' },
  { id: 'reach-out', label: 'Reach out', color: 'coral' },
  { id: 'step-away', label: 'Step away', color: 'cream' },
  { id: 'tomorrow', label: 'Tomorrow', color: 'coral' },
] as const

type SortChipId = (typeof SORT_CHIPS)[number]['id']

const SORT_SIDE_LABELS: Readonly<Record<SortSide, string>> = {
  a: 'Side A',
  b: 'B-side',
}

interface HoldControlsProps {
  readonly segmentId: CinematicOnboardingSegmentId
  readonly onEvent: (event: CinematicOnboardingRuntimeEvent) => void
  readonly onSkip: () => void
  readonly onReminderChoice: (choice: string) => void
}

function HoldControls(props: HoldControlsProps) {
  const [selectedChip, setSelectedChip] = createSignal<SortChipId>()
  const [placements, setPlacements] = createSignal<
    Readonly<Partial<Record<SortChipId, SortSide>>>
  >({})
  const [sortAnnouncement, setSortAnnouncement] = createSignal(
    'Choose a card, then choose either side.',
  )
  const [reminderTime, setReminderTime] = createSignal('09:00')
  const sortedCount = createMemo(() => Object.keys(placements()).length)
  let headingElement: HTMLHeadingElement | undefined

  onMount(() => {
    queueMicrotask(() => headingElement?.focus())
  })

  function placeSelectedChip(side: SortSide): void {
    const chipId = selectedChip()
    if (chipId === undefined) return
    const chip = SORT_CHIPS.find((candidate) => candidate.id === chipId)
    if (chip === undefined) return

    const nextPlacements = { ...placements(), [chipId]: side }
    setPlacements(nextPlacements)
    setSelectedChip(undefined)
    setSortAnnouncement(
      `${chip.label} moved to ${SORT_SIDE_LABELS[side]}. ${Object.keys(nextPlacements).length} of ${SORT_CHIPS.length} sorted.`,
    )
  }

  function placedChips(side: SortSide) {
    const current = placements()
    return SORT_CHIPS.filter((chip) => current[chip.id] === side)
  }

  function setReminder(): void {
    const time = reminderTime()
    if (time === '') return
    props.onReminderChoice(time)
    props.onEvent('user_sets_or_skips_reminder')
  }

  return (
    <section
      class="cinematic-onboarding__interaction"
      aria-labelledby="cinematic-hold-title"
    >
      <Switch>
        <Match when={props.segmentId === 'S04_SIM_CUE_TAP_HOLD'}>
          <p class="cinematic-onboarding__eyebrow">The pull</p>
          <h2 ref={headingElement} id="cinematic-hold-title" tabIndex={-1}>
            Meet The Scroll.
          </h2>
          <p>Tap the cue to bring it into focus. Nothing is recorded yet.</p>
          <button
            class="cinematic-onboarding__cue-token"
            type="button"
            onClick={() => props.onEvent('user_taps_or_confirms_the_scroll')}
          >
            <span aria-hidden="true">↳</span>
            The Scroll
          </button>
        </Match>

        <Match when={props.segmentId === 'S05_SIM_SORT_HOLD'}>
          <p class="cinematic-onboarding__eyebrow">Two sides, both visible</p>
          <h2 ref={headingElement} id="cinematic-hold-title" tabIndex={-1}>
            Sort six small pulls.
          </h2>
          <p id="cinematic-sort-instructions">
            Choose a card, then choose either destination. There is no wrong
            side.
          </p>
          <div
            class="cinematic-onboarding__sort-chips"
            aria-describedby="cinematic-sort-instructions"
          >
            <For each={SORT_CHIPS}>
              {(chip) => (
                <button
                  class={`cinematic-onboarding__sort-chip cinematic-onboarding__sort-chip--${chip.color}`}
                  classList={{
                    'is-selected': selectedChip() === chip.id,
                    'is-sorted': placements()[chip.id] !== undefined,
                  }}
                  type="button"
                  aria-pressed={selectedChip() === chip.id}
                  disabled={placements()[chip.id] !== undefined}
                  onClick={() => setSelectedChip(chip.id)}
                >
                  {chip.label}
                </button>
              )}
            </For>
          </div>
          <div class="cinematic-onboarding__sort-wells">
            <For each={['a', 'b'] as const}>
              {(side) => (
                <button
                  class={`cinematic-onboarding__sort-well cinematic-onboarding__sort-well--${side}`}
                  type="button"
                  disabled={selectedChip() === undefined}
                  aria-label={`Move selected card to ${SORT_SIDE_LABELS[side]}`}
                  onClick={() => placeSelectedChip(side)}
                >
                  <span>{SORT_SIDE_LABELS[side]}</span>
                  <small>{placedChips(side).length} cards</small>
                  <span
                    class="cinematic-onboarding__well-items"
                    aria-hidden="true"
                  >
                    <For each={placedChips(side)}>
                      {(chip) => <i>{chip.label}</i>}
                    </For>
                  </span>
                </button>
              )}
            </For>
          </div>
          <p
            class="cinematic-onboarding__sort-status"
            aria-live="polite"
            aria-atomic="true"
          >
            {sortAnnouncement()}
          </p>
          <button
            class="primary-button primary-button--wide"
            type="button"
            disabled={sortedCount() !== SORT_CHIPS.length}
            onClick={() => props.onEvent('user_completes_or_skips_sorting')}
          >
            Keep both in view
          </button>
        </Match>

        <Match when={props.segmentId === 'S06_SIM_USER_SPIN_STOP_HOLD'}>
          <p class="cinematic-onboarding__eyebrow">Your timing</p>
          <h2 ref={headingElement} id="cinematic-hold-title" tabIndex={-1}>
            Now choose the stop.
          </h2>
          <p>
            The record is already turning. Pause it when the moment feels right.
          </p>
          <button
            class="cinematic-onboarding__record-control is-spinning"
            type="button"
            onClick={() => props.onEvent('user_spins_and_stops_record')}
          >
            <span aria-hidden="true" />
            Stop the record
          </button>
        </Match>

        <Match when={props.segmentId === 'S07_SIM_REMINDER_HOLD'}>
          <p class="cinematic-onboarding__eyebrow">Optional reminder</p>
          <h2 ref={headingElement} id="cinematic-hold-title" tabIndex={-1}>
            When should it return?
          </h2>
          <p>Choose an exact local time, or leave it for later.</p>
          <label class="cinematic-onboarding__reminder-field">
            <span>Reminder time</span>
            <input
              type="time"
              value={reminderTime()}
              onInput={(event) => setReminderTime(event.currentTarget.value)}
            />
          </label>
          <div class="cinematic-onboarding__reminder-actions">
            <button
              class="primary-button"
              type="button"
              disabled={reminderTime() === ''}
              onClick={setReminder}
            >
              Preview this time
            </button>
            <button
              class="secondary-button"
              type="button"
              onClick={() => {
                props.onReminderChoice('Not now')
                props.onEvent('user_sets_or_skips_reminder')
              }}
            >
              Not now
            </button>
          </div>
        </Match>
      </Switch>

      <button
        class="text-button cinematic-onboarding__skip-hold"
        type="button"
        onClick={() => props.onSkip()}
      >
        Skip this moment
      </button>
    </section>
  )
}

function monotonicNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}

function statePlaybackAttempt(state: CinematicOnboardingRuntimeState): number {
  return 'playbackAttempt' in state ? state.playbackAttempt : 0
}

export function CinematicOnboardingDirector(
  props: CinematicOnboardingDirectorProps,
) {
  const requestedMode = createMemo(
    () => props.mode ?? (prefersReducedMotion() ? 'reduced' : 'normal'),
  )
  const mode = untrack(requestedMode)
  const [runtime, setRuntime] = createSignal(
    createCinematicOnboardingRuntime({ mode }),
  )
  const [begun, setBegun] = createSignal(false)
  const [muted, setMuted] = createSignal(false)
  const [playbackPaused, setPlaybackPaused] = createSignal(false)
  const [reminderChoice, setReminderChoice] = createSignal('Not now')
  const [audioStatus, setAudioStatus] = createSignal<
    'loading' | 'ready' | 'unavailable'
  >('loading')
  const [documentVisible, setDocumentVisible] = createSignal(true)
  const audioClock = createCinematicOnboardingAudioClock()
  let videoElement: HTMLVideoElement | undefined
  let imageElement: HTMLImageElement | undefined
  let imagePresentationKey: string | undefined
  let dwellTimer: ReturnType<typeof setTimeout> | undefined
  let dwellIdentity: string | undefined
  let dwellRemainingMilliseconds = 0
  let dwellStartedAt: number | undefined
  let visibilityListener: (() => void) | undefined
  let videoPlayRequest = 0
  let completionDelivered = false
  let mounted = true

  const position = createMemo(() =>
    getCinematicOnboardingRuntimePosition(runtime()),
  )
  const segmentId = createMemo(() => position()?.segment.id)
  const media = createMemo(() => {
    const id = segmentId()
    return id === undefined
      ? undefined
      : resolveCinematicOnboardingMedia(props.media, id, mode)
  })
  const presentationKey = createMemo(() => {
    const id = segmentId()
    return id === undefined
      ? undefined
      : `${id}|${statePlaybackAttempt(runtime())}`
  })
  const shotNumber = createMemo(() => {
    const shotId = position()?.shotId
    const index = CINEMATIC_ONBOARDING_TIMELINE_V0_3.shots.findIndex(
      (shot) => shot.id === shotId,
    )
    return Math.max(0, index) + 1
  })
  const overlay = createMemo(() => {
    const id = segmentId()
    return id === undefined
      ? undefined
      : nativeOverlayCopy(id, reminderChoice())
  })
  const playbackError = createMemo(() => {
    const state = runtime()
    return state.status === 'error' ? state.message : ''
  })
  const canPause = createMemo(() => {
    const status = runtime().status
    return status === 'loading' || status === 'playing'
  })
  const audioReady = createMemo(() => audioStatus() === 'ready')

  function pauseSound(): void {
    audioClock.pause()
  }

  function currentDwellDuration(): number | undefined {
    const state = runtime()
    return mode === 'reduced'
      ? getCinematicOnboardingReducedDwellMilliseconds(state)
      : getCinematicOnboardingNativeOverlayDurationMilliseconds(state)
  }

  function currentDwellIdentity(): string | undefined {
    const state = runtime()
    const id = segmentId()
    return id === undefined
      ? undefined
      : `${state.positionIndex}|${id}|${statePlaybackAttempt(state)}|${mode}`
  }

  function resetDwell(): void {
    if (dwellTimer !== undefined) clearTimeout(dwellTimer)
    dwellTimer = undefined
    dwellIdentity = undefined
    dwellRemainingMilliseconds = 0
    dwellStartedAt = undefined
  }

  function prepareDwell(identity: string, duration: number): void {
    if (dwellIdentity === identity) return
    resetDwell()
    dwellIdentity = identity
    dwellRemainingMilliseconds = duration
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
    if (
      slice === undefined ||
      slice.behavior !== 'advance_with_picture' ||
      !audioReady() ||
      muted() ||
      playbackPaused() ||
      !documentVisible()
    ) {
      return
    }
    const mediaOffsetSeconds =
      media()?.kind === 'video'
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

  function armDwell(): void {
    const state = runtime()
    const id = segmentId()
    const resolved = media()
    const duration = currentDwellDuration()
    const identity = currentDwellIdentity()
    if (
      !begun() ||
      playbackPaused() ||
      !documentVisible() ||
      state.status !== 'playing' ||
      id === undefined ||
      resolved?.kind !== 'still' ||
      duration === undefined ||
      identity === undefined
    ) {
      return
    }

    prepareDwell(identity, duration)
    if (dwellTimer !== undefined) return
    const attempt = state.playbackAttempt
    dwellStartedAt = monotonicNow()
    dwellTimer = setTimeout(() => {
      if (dwellIdentity !== identity) return
      dwellTimer = undefined
      dwellStartedAt = undefined
      dwellRemainingMilliseconds = 0
      pauseSound()
      resetDwell()
      const advanced = dispatch(
        mode === 'reduced'
          ? {
              type: 'REDUCED_DWELL_ENDED',
              segmentId: id,
              playbackAttempt: attempt,
            }
          : {
              type: 'NATIVE_OVERLAY_ENDED',
              segmentId: id,
              playbackAttempt: attempt,
            },
      )
      if (advanced) queueMicrotask(startCurrentBeat)
    }, dwellRemainingMilliseconds)
  }

  function startCurrentBeat(): void {
    const state = runtime()
    const currentMedia = media()
    const id = segmentId()
    if (
      !begun() ||
      playbackPaused() ||
      !documentVisible() ||
      id === undefined ||
      currentMedia === undefined
    ) {
      return
    }
    if (state.status === 'holding' || state.status === 'complete') {
      pauseSound()
      return
    }
    if (state.status !== 'loading') return

    const attempt = state.playbackAttempt
    if (currentMedia.kind === 'video') {
      const video = videoElement
      if (video === undefined) return
      const key = `${id}|${attempt}`
      const playRequest = ++videoPlayRequest
      video.load()
      void video.play().catch(() => {
        untrack(() => {
          if (
            playRequest !== videoPlayRequest ||
            playbackPaused() ||
            !documentVisible() ||
            videoElement !== video ||
            presentationKey() !== key
          ) {
            return
          }
          dispatch({
            type: 'MEDIA_ERROR',
            segmentId: id,
            playbackAttempt: attempt,
            message: 'This scene could not begin on this device.',
          })
        })
      })
      return
    }

    const image = imageElement
    if (
      image === undefined ||
      imagePresentationKey !== `${id}|${attempt}` ||
      !image.complete
    ) {
      return
    }
    dispatch(
      image.naturalWidth > 0
        ? {
            type: 'MEDIA_READY',
            segmentId: id,
            playbackAttempt: attempt,
          }
        : {
            type: 'MEDIA_ERROR',
            segmentId: id,
            playbackAttempt: attempt,
            message: 'This scene image could not be decoded.',
          },
    )
  }

  function reportStillElement(
    image: HTMLImageElement,
    id: CinematicOnboardingSegmentId,
    attempt: number,
  ): void {
    if (!begun()) return
    dispatch(
      image.naturalWidth > 0
        ? {
            type: 'MEDIA_READY',
            segmentId: id,
            playbackAttempt: attempt,
          }
        : {
            type: 'MEDIA_ERROR',
            segmentId: id,
            playbackAttempt: attempt,
            message: 'This scene image could not be decoded.',
          },
    )
  }

  function resumeCurrentBeat(): void {
    const state = runtime()
    if (!begun() || !documentVisible() || playbackPaused()) return
    if (state.status === 'loading') {
      startCurrentBeat()
      return
    }
    if (state.status !== 'playing') return
    if (media()?.kind === 'video') {
      void videoElement?.play().catch(() => undefined)
      return
    }
    armDwell()
  }

  function begin(quiet: boolean): void {
    if (!quiet) void audioClock.unlock()
    setMuted(quiet)
    setPlaybackPaused(false)
    setBegun(true)
    startCurrentBeat()
  }

  function completeHold(event: CinematicOnboardingRuntimeEvent): void {
    if (dispatch({ type: 'USER_EVENT', event })) {
      queueMicrotask(startCurrentBeat)
    }
  }

  function togglePlayback(): void {
    if (!canPause()) return
    const nextPaused = !playbackPaused()
    setPlaybackPaused(nextPaused)
    if (nextPaused) {
      videoPlayRequest += 1
      videoElement?.pause()
      pauseDwell()
      pauseSound()
      return
    }
    queueMicrotask(resumeCurrentBeat)
  }

  function toggleSound(): void {
    const nextMuted = !muted()
    if (!nextMuted) void audioClock.unlock()
    setMuted(nextMuted)
    if (nextMuted) {
      pauseSound()
    }
  }

  createEffect(() => {
    const state = runtime()
    const resolved = media()
    const isBegun = begun()
    const isVisible = documentVisible()
    const isPaused = playbackPaused()

    if (!isBegun || state.status !== 'playing' || resolved?.kind !== 'still') {
      resetDwell()
      return
    }

    const duration =
      mode === 'reduced'
        ? getCinematicOnboardingReducedDwellMilliseconds(state)
        : getCinematicOnboardingNativeOverlayDurationMilliseconds(state)
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
      audioReady() &&
      begun() &&
      documentVisible() &&
      !playbackPaused() &&
      !muted() &&
      runtime().status === 'playing'
    segmentId()
    media()
    if (shouldPlay) playSoundForCurrentPicture()
    else pauseSound()
  })

  onMount(() => {
    setDocumentVisible(document.visibilityState !== 'hidden')
    void audioClock
      .load(props.media.audio.src)
      .catch(() => false)
      .then((ready) => {
        if (mounted) setAudioStatus(ready ? 'ready' : 'unavailable')
      })
    visibilityListener = () =>
      untrack(() => {
        if (document.visibilityState === 'hidden') {
          setDocumentVisible(false)
          videoPlayRequest += 1
          videoElement?.pause()
          pauseDwell()
          pauseSound()
          return
        }
        setDocumentVisible(true)
        if (!playbackPaused()) queueMicrotask(resumeCurrentBeat)
      })
    document.addEventListener('visibilitychange', visibilityListener)
  })

  onCleanup(() => {
    mounted = false
    videoPlayRequest += 1
    resetDwell()
    if (visibilityListener !== undefined) {
      document.removeEventListener('visibilitychange', visibilityListener)
    }
    videoElement?.pause()
    pauseSound()
    audioClock.dispose()
  })

  return (
    <main
      class="cinematic-onboarding app-screen"
      aria-label="Meet Corky and Beside Cue"
    >
      <div class="cinematic-onboarding__picture">
        <Show
          when={presentationKey()}
          fallback={<div class="cinematic-onboarding__picture-fallback" />}
          keyed
        >
          {(key) => {
            const [rawId, rawAttempt] = key.split('|')
            const id = rawId as CinematicOnboardingSegmentId
            const attempt = Number(rawAttempt)
            const resolved = resolveCinematicOnboardingMedia(
              props.media,
              id,
              mode,
            )
            return resolved.kind === 'video' ? (
              <video
                ref={(element) => {
                  videoElement = element
                }}
                src={resolved.src}
                poster={resolved.poster}
                aria-label={resolved.alt}
                playsinline
                muted
                preload="auto"
                onPlay={(event) => {
                  if (playbackPaused() || !documentVisible()) {
                    event.currentTarget.pause()
                    return
                  }
                  dispatch({
                    type: 'MEDIA_READY',
                    segmentId: id,
                    playbackAttempt: attempt,
                  })
                }}
                onEnded={() => {
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
                onError={() => {
                  if (
                    dispatch({
                      type: 'MEDIA_ERROR',
                      segmentId: id,
                      playbackAttempt: attempt,
                      message: 'This scene could not be decoded.',
                    })
                  ) {
                    pauseSound()
                  }
                }}
              />
            ) : (
              <img
                ref={(element) => {
                  imageElement = element
                  imagePresentationKey = key
                  if (element.complete) {
                    queueMicrotask(() => {
                      untrack(() => {
                        reportStillElement(element, id, attempt)
                      })
                    })
                  }
                }}
                src={resolved.src}
                alt={resolved.alt}
                onLoad={(event) => {
                  reportStillElement(event.currentTarget, id, attempt)
                }}
                onError={(event) => {
                  reportStillElement(event.currentTarget, id, attempt)
                }}
              />
            )
          }}
        </Show>
        <span class="cinematic-onboarding__shade" aria-hidden="true" />
      </div>

      <Show when={!begun()}>
        <section
          class="cinematic-onboarding__preroll"
          aria-labelledby="cinematic-title"
        >
          <p class="cinematic-onboarding__eyebrow">A 31-second pocket film</p>
          <h1 id="cinematic-title">Meet Corky.</h1>
          <p>
            See one pull, one small turn, and how Beside Cue keeps the choice
            private. Captions stay on throughout.
          </p>
          <div class="cinematic-onboarding__preroll-actions">
            <button
              class="primary-button primary-button--wide"
              type="button"
              disabled={!audioReady()}
              onClick={() => begin(false)}
            >
              {audioStatus() === 'ready'
                ? 'Begin with sound'
                : audioStatus() === 'unavailable'
                  ? 'Sound unavailable'
                  : 'Preparing sound…'}
            </button>
            <button
              class="secondary-button"
              type="button"
              onClick={() => begin(true)}
            >
              Watch quietly
            </button>
          </div>
          <Show when={audioStatus() === 'unavailable'}>
            <p class="cinematic-onboarding__audio-status" role="status">
              Sound is unavailable on this device. The quiet film is ready.
            </p>
          </Show>
          <button
            class="text-button"
            type="button"
            onClick={() => dispatch({ type: 'DISMISS' })}
          >
            Skip introduction
          </button>
        </section>
      </Show>

      <Show when={begun()}>
        <nav class="cinematic-onboarding__toolbar" aria-label="Film controls">
          <span
            aria-label={`Scene ${shotNumber()} of ${CINEMATIC_ONBOARDING_TIMELINE_V0_3.shots.length}`}
          >
            {shotNumber()} / {CINEMATIC_ONBOARDING_TIMELINE_V0_3.shots.length}
          </span>
          <div>
            <button
              type="button"
              aria-pressed={playbackPaused()}
              disabled={!canPause()}
              onClick={togglePlayback}
            >
              {playbackPaused() ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              aria-pressed={muted()}
              disabled={!audioReady()}
              onClick={toggleSound}
            >
              {muted() ? 'Sound' : 'Mute'}
            </button>
            <button type="button" onClick={() => dispatch({ type: 'DISMISS' })}>
              Skip
            </button>
          </div>
        </nav>

        <Show when={mode === 'reduced'}>
          <p class="cinematic-onboarding__motion-note">Reduced motion</p>
        </Show>

        <Show when={runtime().status === 'holding' && segmentId()} keyed>
          {(id) => (
            <HoldControls
              segmentId={id}
              onEvent={completeHold}
              onSkip={() => {
                if (dispatch({ type: 'SKIP_CURRENT_HOLD' })) {
                  queueMicrotask(startCurrentBeat)
                }
              }}
              onReminderChoice={setReminderChoice}
            />
          )}
        </Show>

        <Show when={overlay()} keyed>
          {(copy) => (
            <section
              class="cinematic-onboarding__native-overlay"
              aria-live="polite"
            >
              <p class="cinematic-onboarding__eyebrow">{copy.eyebrow}</p>
              <h2>{copy.title}</h2>
              <p>{copy.body}</p>
            </section>
          )}
        </Show>

        <Show when={runtime().status === 'error'}>
          <section class="cinematic-onboarding__error" role="alert">
            <p class="cinematic-onboarding__eyebrow">Playback paused</p>
            <h2>This beat needs another try.</h2>
            <p>{playbackError()}</p>
            <div>
              <button
                class="primary-button"
                type="button"
                onClick={() => {
                  if (dispatch({ type: 'RETRY' })) {
                    queueMicrotask(startCurrentBeat)
                  }
                }}
              >
                Try again
              </button>
              <button
                class="secondary-button"
                type="button"
                onClick={() => {
                  if (dispatch({ type: 'CONTINUE_WITH_POSTER' })) {
                    queueMicrotask(startCurrentBeat)
                  }
                }}
              >
                Continue to next scene
              </button>
            </div>
          </section>
        </Show>

        <Show when={segmentId()} keyed>
          {(id) => (
            <p
              class="cinematic-onboarding__caption"
              aria-live="polite"
              aria-atomic="true"
            >
              {CAPTIONS[id] ?? 'Beside Cue keeps the next small turn in view.'}
            </p>
          )}
        </Show>
      </Show>
    </main>
  )
}
