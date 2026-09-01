// ============================================================
// V2OnboardingPlatterPreview — P02-backed rigid platter motion
// ============================================================
//
// One mounted foreground clock carries the record from a 30 rpm spin through
// its deterministic stop. The authored P02 plate remains the visual authority:
// its own record pixels rotate in local circular coordinates, while a second
// reference to the same bytes restores the stationary tonearm above them.

import { createEffect, createSignal, createUniqueId, onCleanup, Show, } from 'solid-js'
import type { V2OnboardingStillResource } from './v2-onboarding-media-presenter'
import type { V2PlatterStopMotion } from './v2-onboarding-platter-motion'
import { advanceV2PlatterSpinAngle, createV2PlatterStopMotion, sampleV2PlatterStopMotion, } from './v2-onboarding-platter-motion'
import styles from './V2OnboardingPlatterPreview.module.css'

export type V2OnboardingPlatterPhase = 'stopped' | 'spinning' | 'stopping'

export interface V2OnboardingPlatterPreviewProps {
  readonly base?: V2OnboardingStillResource
  readonly phase: V2OnboardingPlatterPhase
  readonly token: string
  readonly foreground: boolean
  readonly reducedMotion: boolean
  readonly class?: string
  readonly onStopped: (token: string) => void
}

const VIEWBOX_WIDTH = 720
const VIEWBOX_HEIGHT = 1_280

// Measured against the 720x1280 P02 v0.16 stopped authority. The record's
// rotating top is a circle in its own plane and a 100x30 ellipse in the plate.
const RECORD_CENTER_X = 205
const RECORD_CENTER_Y = 795
const RECORD_RADIUS = 100
const RECORD_Y_SCALE = 0.3

const RECORD_TEXTURE_X = -RECORD_CENTER_X
const RECORD_TEXTURE_Y = -RECORD_CENTER_Y / RECORD_Y_SCALE
const RECORD_TEXTURE_HEIGHT = VIEWBOX_HEIGHT / RECORD_Y_SCALE

function NativeRecordArtwork() {
  return (
    <>
      <circle r={RECORD_RADIUS} fill="#29231f" />
      <circle
        r="82"
        fill="none"
        stroke="#fff5dd"
        stroke-opacity="0.14"
        stroke-width="2"
      />
      <circle
        r="66"
        fill="none"
        stroke="#fff5dd"
        stroke-opacity="0.1"
        stroke-width="2"
      />
      <circle r="35" fill="#c95b25" />
      <path
        d="M 0 -30 L 0 30"
        stroke="#f0bd47"
        stroke-width="8"
        stroke-linecap="round"
      />
      <circle r="5" fill="#29231f" />
    </>
  )
}

export function V2OnboardingPlatterPreview(
  props: V2OnboardingPlatterPreviewProps,
) {
  const clipIdentity = createUniqueId()
  const recordClipId = `${clipIdentity}-record`
  const tonearmClipId = `${clipIdentity}-tonearm`
  const spindleClipId = `${clipIdentity}-spindle`
  const [renderedAngleRad, setRenderedAngleRad] = createSignal(0)
  const [overlayVisible, setOverlayVisible] = createSignal(false)
  const completedTokens = new Set<string>()

  let mounted = true
  let frameHandle: number | undefined
  let activePhase: V2OnboardingPlatterPhase | undefined
  let activeToken: string | undefined
  let activeForeground = false
  let activeReducedMotion = false
  let activeOnStopped: (token: string) => void = () => undefined
  let currentAngleRad = 0
  let lastFrameTimestamp: number | undefined
  let stopElapsedSeconds = 0
  let stopMotion: V2PlatterStopMotion | undefined
  let motionVisible = false

  function setMotionVisible(visible: boolean): void {
    motionVisible = visible
    setOverlayVisible(visible)
  }

  function cancelFrame(): void {
    if (frameHandle === undefined) return
    cancelAnimationFrame(frameHandle)
    frameHandle = undefined
  }

  function emitStopped(token: string): void {
    if (!mounted || completedTokens.has(token)) return
    completedTokens.add(token)
    activeOnStopped(token)
  }

  function canAnimate(): boolean {
    return (
      mounted &&
      motionVisible &&
      activeForeground &&
      !activeReducedMotion &&
      (activePhase === 'spinning' ||
        (activePhase === 'stopping' && stopMotion !== undefined))
    )
  }

  function requestFrame(): void {
    if (frameHandle !== undefined || !canAnimate()) return
    frameHandle = requestAnimationFrame(handleFrame)
  }

  function handleFrame(timestamp: number): void {
    frameHandle = undefined
    if (!canAnimate()) return

    if (lastFrameTimestamp === undefined) {
      lastFrameTimestamp = timestamp
      requestFrame()
      return
    }

    const elapsedSeconds = Number.isFinite(timestamp)
      ? Math.max(0, timestamp - lastFrameTimestamp) / 1_000
      : 0
    lastFrameTimestamp = timestamp

    if (activePhase === 'spinning') {
      currentAngleRad = advanceV2PlatterSpinAngle(
        currentAngleRad,
        elapsedSeconds,
      )
      setRenderedAngleRad(currentAngleRad)
      requestFrame()
      return
    }

    if (activePhase !== 'stopping' || stopMotion === undefined) return
    stopElapsedSeconds += elapsedSeconds
    const sample = sampleV2PlatterStopMotion(stopMotion, stopElapsedSeconds)
    currentAngleRad = sample.angleRad
    setRenderedAngleRad(currentAngleRad)

    if (sample.completed) {
      const completedToken = activeToken
      stopMotion = undefined
      lastFrameTimestamp = undefined
      setMotionVisible(false)
      if (completedToken !== undefined) emitStopped(completedToken)
      return
    }

    requestFrame()
  }

  createEffect(() => {
    const nextPhase = props.phase
    const nextToken = props.token
    const nextForeground = props.foreground
    const nextReducedMotion = props.reducedMotion
    const nextOnStopped = props.onStopped
    const phaseChanged = activePhase !== nextPhase
    const tokenChanged = activeToken !== nextToken
    const foregroundChanged = activeForeground !== nextForeground
    const reducedMotionChanged = activeReducedMotion !== nextReducedMotion

    activePhase = nextPhase
    activeToken = nextToken
    activeForeground = nextForeground
    activeReducedMotion = nextReducedMotion
    activeOnStopped = nextOnStopped

    if (nextReducedMotion) {
      cancelFrame()
      currentAngleRad = 0
      lastFrameTimestamp = undefined
      stopElapsedSeconds = 0
      stopMotion = undefined
      setRenderedAngleRad(0)
      setMotionVisible(false)
      if (
        nextPhase === 'stopping' &&
        (phaseChanged || tokenChanged || reducedMotionChanged)
      ) {
        emitStopped(nextToken)
      }
      return
    }

    if (phaseChanged || tokenChanged) {
      if (nextPhase === 'stopped') {
        cancelFrame()
        currentAngleRad = 0
        lastFrameTimestamp = undefined
        stopElapsedSeconds = 0
        stopMotion = undefined
        setRenderedAngleRad(0)
        setMotionVisible(false)
      } else if (nextPhase === 'spinning') {
        if (activePhase === undefined || phaseChanged) {
          lastFrameTimestamp = undefined
        }
        stopElapsedSeconds = 0
        stopMotion = undefined
        setMotionVisible(true)
      } else {
        stopElapsedSeconds = 0
        stopMotion = createV2PlatterStopMotion(currentAngleRad)
        setMotionVisible(true)
      }
    }

    if (foregroundChanged) {
      cancelFrame()
      lastFrameTimestamp = undefined
    }

    requestFrame()
  })

  onCleanup(() => {
    mounted = false
    cancelFrame()
  })

  const angleDegrees = () => (renderedAngleRad() * 180) / Math.PI

  return (
    <div
      class={`${styles.stage}${props.class === undefined ? '' : ` ${props.class}`}`}
      data-v2-platter-preview=""
      data-platter-phase={props.phase}
      data-platter-token={props.token}
      data-platter-foreground={props.foreground ? 'true' : 'false'}
      data-platter-reduced-motion={props.reducedMotion ? 'true' : 'false'}
      data-platter-overlay={overlayVisible() ? 'visible' : 'hidden'}
      data-platter-source={props.base === undefined ? 'native' : 'authored'}
      data-platter-angle-rad={String(renderedAngleRad())}
    >
      <Show
        when={props.base}
        keyed
        fallback={
          <svg
            class={styles.fallback}
            viewBox={`0 0 ${String(VIEWBOX_WIDTH)} ${String(VIEWBOX_HEIGHT)}`}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <rect
              width={VIEWBOX_WIDTH}
              height={VIEWBOX_HEIGHT}
              fill="#ead6ad"
            />
            <g
              transform={`translate(${String(RECORD_CENTER_X)} ${String(RECORD_CENTER_Y)}) scale(1 ${String(RECORD_Y_SCALE)})`}
            >
              <NativeRecordArtwork />
            </g>
          </svg>
        }
      >
        {(base) => (
          <img
            class={styles.base}
            src={base.src}
            alt={base.alt}
            decoding="async"
            draggable={false}
          />
        )}
      </Show>

      <svg
        class={styles.motion}
        viewBox={`0 0 ${String(VIEWBOX_WIDTH)} ${String(VIEWBOX_HEIGHT)}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        data-visible={overlayVisible() ? 'true' : 'false'}
      >
        <defs>
          <clipPath id={recordClipId} clipPathUnits="userSpaceOnUse">
            <circle r={RECORD_RADIUS} />
          </clipPath>
          <clipPath id={tonearmClipId} clipPathUnits="userSpaceOnUse">
            <path d="M 209 824 L 237 813 L 279 775 L 285 751 L 306 738 L 328 753 L 333 773 L 318 791 L 249 833 L 247 845 L 216 848 Z" />
          </clipPath>
          <clipPath id={spindleClipId} clipPathUnits="userSpaceOnUse">
            <circle cx={RECORD_CENTER_X} cy={RECORD_CENTER_Y} r="7" />
          </clipPath>
        </defs>

        <g
          transform={`translate(${String(RECORD_CENTER_X)} ${String(RECORD_CENTER_Y)}) scale(1 ${String(RECORD_Y_SCALE)})`}
        >
          <g clip-path={`url(#${recordClipId})`}>
            <g transform={`rotate(${String(angleDegrees())})`}>
              <Show when={props.base} keyed fallback={<NativeRecordArtwork />}>
                {(base) => (
                  <image
                    href={base.src}
                    x={RECORD_TEXTURE_X}
                    y={RECORD_TEXTURE_Y}
                    width={VIEWBOX_WIDTH}
                    height={RECORD_TEXTURE_HEIGHT}
                    preserveAspectRatio="none"
                  />
                )}
              </Show>
            </g>
          </g>
        </g>

        <Show when={props.base} keyed>
          {(base) => (
            <>
              <image
                href={base.src}
                x="0"
                y="0"
                width={VIEWBOX_WIDTH}
                height={VIEWBOX_HEIGHT}
                clip-path={`url(#${tonearmClipId})`}
                preserveAspectRatio="none"
              />
              <image
                href={base.src}
                x="0"
                y="0"
                width={VIEWBOX_WIDTH}
                height={VIEWBOX_HEIGHT}
                clip-path={`url(#${spindleClipId})`}
                preserveAspectRatio="none"
              />
            </>
          )}
        </Show>
      </svg>
    </div>
  )
}
