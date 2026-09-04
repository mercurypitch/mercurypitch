// ============================================================
// V2OnboardingMediaStage — decoded dual-layer DOM adapter
// ============================================================
//
// Readiness is evidence, not an optimistic load event: video stays effectively
// hidden until a compositor-frame callback. A nonzero loading probe keeps the
// incoming surface eligible for composition without retiring the decoded
// outgoing node before its successor is proven.

import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack, } from 'solid-js'
import type { V2OnboardingMediaMode, V2OnboardingMediaPresentationEvidence, V2OnboardingMediaPresentationRequest, V2OnboardingMediaPresenterEvent, V2OnboardingMediaPresenterState, V2OnboardingMediaRecoveryStage, V2OnboardingMediaResource, } from './v2-onboarding-media-presenter'
import { createV2OnboardingMediaPresenterState, requestV2OnboardingMediaPresentation, updateV2OnboardingMediaPresenter, } from './v2-onboarding-media-presenter'
import styles from './V2OnboardingMediaStage.module.css'

const DEFAULT_TRANSITION_DURATION_MS = 180
const TRANSITION_FALLBACK_SLACK_MS = 34
/** Bundled local video should reach its first decoded frame well inside this. */
const VIDEO_LOAD_GRACE_MS = 3000
/** How long to wait for a composited frame before recovering to authored art. */
const VIDEO_FRAME_GRACE_MS = 1200

export interface V2OnboardingMediaCorrelation {
  readonly targetId: string
  readonly token: string
}

export interface V2OnboardingMediaSettledEvent extends V2OnboardingMediaCorrelation {
  readonly recoveryStage: V2OnboardingMediaRecoveryStage
}

export interface V2OnboardingMediaStageProps {
  readonly request?: V2OnboardingMediaPresentationRequest
  readonly mode: V2OnboardingMediaMode
  readonly foreground: boolean
  readonly transitionDurationMs?: number
  readonly class?: string
  readonly onPresentationSettled?: (
    event: V2OnboardingMediaSettledEvent,
  ) => void
  readonly onVideoEnded?: (event: V2OnboardingMediaCorrelation) => void
}

type LayerPhase = 'current' | 'loading' | 'revealed'

interface MediaLayerProps {
  readonly token: string
  readonly targetId: string
  readonly recoveryStage: V2OnboardingMediaRecoveryStage
  readonly resource?: V2OnboardingMediaResource
  readonly phase: LayerPhase
  readonly foreground: boolean
  readonly transitionDurationMs: number
  readonly onMetadataReady: (token: string) => void
  readonly onPlaying: (token: string) => void
  readonly onPresented: (
    token: string,
    evidence: V2OnboardingMediaPresentationEvidence,
  ) => void
  readonly onFailed: (token: string) => void
  readonly onTransitionCompleted: (token: string) => void
  readonly onVideoEnded: (token: string) => void
  readonly onVideoMounted: (token: string, element: HTMLVideoElement) => void
  readonly onVideoUnmounted: (token: string, element: HTMLVideoElement) => void
}

interface OptionalVideoFrameCallbacks {
  requestVideoFrameCallback?: (callback: () => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

function resourceIdentity(resource: V2OnboardingMediaResource): string {
  return resource.kind === 'brand'
    ? `brand:${resource.alt}`
    : `${resource.kind}:${resource.src}:${resource.alt}`
}

function requestIdentity(
  request: V2OnboardingMediaPresentationRequest,
): string {
  return JSON.stringify([
    request.targetId,
    request.targetKind,
    resourceIdentity(request.primary),
    resourceIdentity(request.reducedStill),
    resourceIdentity(request.poster),
    resourceIdentity(request.brand),
  ])
}

function V2OnboardingMediaLayer(props: MediaLayerProps) {
  let mounted = true
  let videoElement: HTMLVideoElement | undefined
  let frameRequest: number | undefined
  let loadFallback: ReturnType<typeof setTimeout> | undefined
  let frameFallback: ReturnType<typeof setTimeout> | undefined
  let frameGateScheduled = false
  let frameGateSettled = false
  let frameCallbackExpected = false
  let brandPresented = false

  function cancelWatchdogs(): void {
    if (loadFallback !== undefined) {
      clearTimeout(loadFallback)
      loadFallback = undefined
    }
    if (frameFallback !== undefined) {
      clearTimeout(frameFallback)
      frameFallback = undefined
    }
  }

  function cancelFrameGate(): void {
    cancelWatchdogs()
    if (frameRequest !== undefined && videoElement !== undefined) {
      const capable = videoElement as unknown as OptionalVideoFrameCallbacks
      capable.cancelVideoFrameCallback?.(frameRequest)
      frameRequest = undefined
    }
  }

  function presentVideoFrame(): void {
    if (!mounted || frameGateSettled) return
    frameGateSettled = true
    if (frameFallback !== undefined) clearTimeout(frameFallback)
    frameRequest = undefined
    frameFallback = undefined
    props.onPresented(props.token, 'decoded-video-frame')
  }

  function expireVideoFrameGate(): void {
    if (!mounted || frameGateSettled) return
    frameGateSettled = true
    cancelFrameGate()
    props.onFailed(props.token)
  }

  function scheduleVideoLoadGate(): void {
    if (
      !mounted ||
      !props.foreground ||
      frameGateSettled ||
      frameGateScheduled ||
      loadFallback !== undefined
    ) {
      return
    }
    loadFallback = setTimeout(expireVideoFrameGate, VIDEO_LOAD_GRACE_MS)
  }

  function scheduleVideoFrameWatchdog(): void {
    if (
      !mounted ||
      !props.foreground ||
      frameGateSettled ||
      frameFallback !== undefined
    ) {
      return
    }
    frameFallback = setTimeout(
      expireVideoFrameGate,
      frameCallbackExpected ? VIDEO_FRAME_GRACE_MS : 0,
    )
  }

  function scheduleVideoFrameGate(element: HTMLVideoElement): void {
    if (frameGateScheduled) return
    frameGateScheduled = true
    if (loadFallback !== undefined) {
      clearTimeout(loadFallback)
      loadFallback = undefined
    }
    const capable = element as unknown as OptionalVideoFrameCallbacks
    if (capable.requestVideoFrameCallback !== undefined) {
      frameCallbackExpected = true
      frameRequest = capable.requestVideoFrameCallback(presentVideoFrame)
      // The loading layer's nonzero probe keeps it compositor-eligible while
      // this callback remains the authority for retiring the outgoing frame.
    } else {
      frameCallbackExpected = false
    }

    // If no compositor evidence arrives, use the deterministic recovery
    // chain. The watchdog pauses while backgrounded because frame composition
    // can be suspended there.
    scheduleVideoFrameWatchdog()
  }

  createEffect(() => {
    if (props.resource?.kind !== 'brand' || brandPresented) return
    brandPresented = true
    props.onPresented(props.token, 'native-brand')
  })

  createEffect(() => {
    if (!props.foreground) {
      cancelWatchdogs()
      return
    }
    if (videoElement === undefined || frameGateSettled) return
    if (frameGateScheduled) {
      scheduleVideoFrameWatchdog()
    } else {
      scheduleVideoLoadGate()
    }
  })

  onCleanup(() => {
    mounted = false
    cancelFrameGate()
    if (videoElement !== undefined) {
      props.onVideoUnmounted(props.token, videoElement)
    }
  })

  const video = () =>
    props.resource?.kind === 'video' ? props.resource : undefined
  const still = () =>
    props.resource?.kind === 'still' ? props.resource : undefined
  const brand = () => props.resource?.kind === 'brand'

  return (
    <div
      class={styles.layer}
      data-v2-media-token={props.token}
      data-v2-media-target={props.targetId}
      data-v2-media-stage={props.recoveryStage}
      data-v2-media-phase={props.phase}
      data-v2-media-kind={props.resource?.kind}
      style={{
        '--v2-media-transition-duration': `${String(
          props.transitionDurationMs,
        )}ms`,
      }}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget) {
          props.onTransitionCompleted(props.token)
        }
      }}
    >
      <Show when={video()} keyed>
        {(resource) => (
          <video
            ref={(element) => {
              videoElement = element
              // Set both runtime and markup defaults. Some WebViews reflect
              // the muted attribute only into defaultMuted until playback.
              element.defaultMuted = true
              element.muted = true
              props.onVideoMounted(props.token, element)
              scheduleVideoLoadGate()
            }}
            class={styles.media}
            style={{
              'object-fit': 'cover',
              'object-position': 'center center',
            }}
            src={resource.src}
            muted
            playsinline
            preload="metadata"
            aria-hidden="true"
            onLoadedMetadata={() => props.onMetadataReady(props.token)}
            onLoadedData={(event) =>
              scheduleVideoFrameGate(event.currentTarget)
            }
            onPlaying={() => props.onPlaying(props.token)}
            onEnded={() => props.onVideoEnded(props.token)}
            onError={() => {
              cancelFrameGate()
              props.onFailed(props.token)
            }}
          />
        )}
      </Show>
      <Show when={still()} keyed>
        {(resource) => (
          <img
            class={styles.media}
            style={{
              'object-fit': 'cover',
              'object-position': 'center center',
            }}
            src={resource.src}
            alt=""
            aria-hidden="true"
            decoding="async"
            onLoad={(event) => {
              if (event.currentTarget.naturalWidth > 0) {
                props.onPresented(props.token, 'decoded-still')
              } else {
                props.onFailed(props.token)
              }
            }}
            onError={() => props.onFailed(props.token)}
          />
        )}
      </Show>
      <Show when={brand()}>
        <div class={styles.brand} aria-hidden="true">
          Beside Cue
        </div>
      </Show>
    </div>
  )
}

export function V2OnboardingMediaStage(props: V2OnboardingMediaStageProps) {
  const [presenter, setPresenter] =
    createSignal<V2OnboardingMediaPresenterState>(
      createV2OnboardingMediaPresenterState(untrack(() => props.mode)),
    )
  const videoElements = new Map<string, HTMLVideoElement>()
  const metadataReadyTokens = new Set<string>()
  const playAttempts = new Map<string, number>()
  const foregroundPausedTokens = new Set<string>()
  const reportedEndedTokens = new Set<string>()
  let mounted = true
  let foregroundActive = untrack(() => props.foreground)
  let previousForeground = foregroundActive
  let synchronizedMode: V2OnboardingMediaMode | undefined
  let synchronizedRequestIdentity = ''
  let transitionFallback: ReturnType<typeof setTimeout> | undefined

  const transitionDurationMs = () =>
    Math.max(0, props.transitionDurationMs ?? DEFAULT_TRANSITION_DURATION_MS)

  function sendPresenterEvent(event: V2OnboardingMediaPresenterEvent): void {
    if (!mounted) return
    setPresenter((state) => updateV2OnboardingMediaPresenter(state, event))
  }

  function completeTransition(token: string): void {
    if (!mounted) return
    let settled: V2OnboardingMediaSettledEvent | undefined
    setPresenter((state) => {
      const incoming = state.incoming
      const next = updateV2OnboardingMediaPresenter(state, {
        type: 'TRANSITION_COMPLETED',
        token,
      })
      if (
        next !== state &&
        incoming?.token === token &&
        next.incoming === undefined &&
        next.current?.token === token
      ) {
        settled = {
          targetId: incoming.targetId,
          token,
          recoveryStage: incoming.candidate.stage,
        }
      }
      return next
    })
    if (settled !== undefined && mounted) {
      props.onPresentationSettled?.(settled)
    }
  }

  function activeVideoToken(): string | undefined {
    const state = presenter()
    const incoming = state.incoming
    if (
      incoming?.candidate.resource.kind === 'video' &&
      incoming.phase === 'revealed'
    ) {
      return incoming.token
    }
    if (
      incoming === undefined &&
      state.current?.candidate.resource.kind === 'video'
    ) {
      return state.current.token
    }
    return undefined
  }

  function invalidatePlayAttempt(token: string): void {
    playAttempts.set(token, (playAttempts.get(token) ?? 0) + 1)
  }

  function pauseVideo(token: string, element: HTMLVideoElement): void {
    invalidatePlayAttempt(token)
    element.pause()
  }

  function playVideo(token: string, element: HTMLVideoElement): void {
    if (!mounted || !foregroundActive || videoElements.get(token) !== element) {
      return
    }
    const attempt = (playAttempts.get(token) ?? 0) + 1
    playAttempts.set(token, attempt)
    void element.play().catch(() => {
      if (
        mounted &&
        foregroundActive &&
        playAttempts.get(token) === attempt &&
        videoElements.get(token) === element
      ) {
        sendPresenterEvent({ type: 'INCOMING_FAILED', token })
      }
    })
  }

  function renderedLayer(token: string) {
    const state = presenter()
    const incoming = state.incoming
    if (incoming?.token === token) {
      return {
        targetId: incoming.targetId,
        candidate: incoming.candidate,
        phase: incoming.phase,
      } as const
    }
    const current = state.current
    if (current?.token === token) {
      return {
        targetId: current.targetId,
        candidate: current.candidate,
        phase: 'current',
      } as const
    }
    return undefined
  }

  const renderedTokens = createMemo(() => {
    const state = presenter()
    const tokens: string[] = []
    if (state.current !== undefined) tokens.push(state.current.token)
    if (
      state.incoming !== undefined &&
      state.incoming.token !== state.current?.token
    ) {
      tokens.push(state.incoming.token)
    }
    return tokens
  })

  createEffect(() => {
    const mode = props.mode
    const request = props.request
    const identity = request === undefined ? '' : requestIdentity(request)

    if (synchronizedMode !== mode) {
      synchronizedMode = mode
      synchronizedRequestIdentity = identity
      reportedEndedTokens.clear()
      let next: V2OnboardingMediaPresenterState = {
        ...createV2OnboardingMediaPresenterState(mode),
        // Preserve monotonic tokens across mode changes so Solid retires the
        // old media node instead of reusing it for a different resource kind.
        generation: untrack(presenter).generation,
      }
      if (request !== undefined) {
        next = requestV2OnboardingMediaPresentation(next, request)
      }
      setPresenter(next)
      return
    }

    if (identity === synchronizedRequestIdentity) return
    synchronizedRequestIdentity = identity
    if (request === undefined) {
      setPresenter((state) =>
        state.incoming === undefined
          ? state
          : {
              ...state,
              generation: state.generation + 1,
              incoming: undefined,
            },
      )
      return
    }
    setPresenter((state) =>
      requestV2OnboardingMediaPresentation(state, request),
    )
  })

  createEffect(() => {
    const incoming = presenter().incoming
    const duration = transitionDurationMs()
    if (transitionFallback !== undefined) {
      clearTimeout(transitionFallback)
      transitionFallback = undefined
    }
    if (incoming?.phase !== 'revealed') return
    const token = incoming.token
    transitionFallback = setTimeout(
      () => completeTransition(token),
      duration + TRANSITION_FALLBACK_SLACK_MS,
    )
  })

  createEffect(() => {
    const foreground = props.foreground
    foregroundActive = foreground
    if (!foreground) {
      for (const [token, element] of videoElements) {
        foregroundPausedTokens.add(token)
        pauseVideo(token, element)
      }
    } else if (!previousForeground) {
      const token = presenter().incoming?.token ?? presenter().current?.token
      const element = token === undefined ? undefined : videoElements.get(token)
      if (
        token !== undefined &&
        element !== undefined &&
        metadataReadyTokens.has(token) &&
        foregroundPausedTokens.has(token)
      ) {
        playVideo(token, element)
      }
      foregroundPausedTokens.clear()
    }
    previousForeground = foreground
  })

  onCleanup(() => {
    mounted = false
    if (transitionFallback !== undefined) clearTimeout(transitionFallback)
    for (const [token, element] of videoElements) pauseVideo(token, element)
    videoElements.clear()
    metadataReadyTokens.clear()
    foregroundPausedTokens.clear()
  })

  return (
    <div
      class={styles.stage}
      classList={{ [props.class ?? '']: props.class !== undefined }}
      aria-hidden="true"
      data-v2-media-mode={props.mode}
    >
      <For each={renderedTokens()}>
        {(token) => (
          <V2OnboardingMediaLayer
            token={token}
            targetId={renderedLayer(token)?.targetId ?? ''}
            recoveryStage={renderedLayer(token)?.candidate.stage ?? 'brand'}
            resource={renderedLayer(token)?.candidate.resource}
            phase={renderedLayer(token)?.phase ?? 'loading'}
            foreground={props.foreground}
            transitionDurationMs={transitionDurationMs()}
            onMetadataReady={(eventToken) => {
              sendPresenterEvent({
                type: 'INCOMING_METADATA_READY',
                token: eventToken,
              })
              // Solid may invoke the ref before the browser has attached the
              // source. Metadata is the first safe playback boundary.
              metadataReadyTokens.add(eventToken)
              const element = videoElements.get(eventToken)
              if (props.foreground && element !== undefined) {
                playVideo(eventToken, element)
              }
            }}
            onPlaying={(eventToken) =>
              sendPresenterEvent({
                type: 'INCOMING_PLAYING',
                token: eventToken,
              })
            }
            onPresented={(eventToken, evidence) =>
              sendPresenterEvent({
                type: 'INCOMING_PRESENTED',
                token: eventToken,
                evidence,
              })
            }
            onFailed={(eventToken) =>
              sendPresenterEvent({
                type: 'INCOMING_FAILED',
                token: eventToken,
              })
            }
            onTransitionCompleted={completeTransition}
            onVideoEnded={(eventToken) => {
              const activeToken = activeVideoToken()
              if (
                activeToken !== eventToken ||
                reportedEndedTokens.has(eventToken)
              ) {
                return
              }
              const layer = renderedLayer(eventToken)
              if (layer === undefined) return
              reportedEndedTokens.add(eventToken)
              props.onVideoEnded?.({
                targetId: layer.targetId,
                token: eventToken,
              })
            }}
            onVideoMounted={(eventToken, element) => {
              videoElements.set(eventToken, element)
              metadataReadyTokens.delete(eventToken)
              reportedEndedTokens.delete(eventToken)
              if (!props.foreground) {
                foregroundPausedTokens.add(eventToken)
                pauseVideo(eventToken, element)
              }
            }}
            onVideoUnmounted={(eventToken, element) => {
              if (videoElements.get(eventToken) !== element) return
              pauseVideo(eventToken, element)
              videoElements.delete(eventToken)
              metadataReadyTokens.delete(eventToken)
              foregroundPausedTokens.delete(eventToken)
            }}
          />
        )}
      </For>
    </div>
  )
}
