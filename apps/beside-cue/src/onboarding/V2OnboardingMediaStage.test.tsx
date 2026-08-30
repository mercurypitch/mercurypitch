// ============================================================
// V2OnboardingMediaStage tests — browser evidence and lifecycle correlation
// ============================================================

import { fireEvent, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { V2OnboardingMediaMode, V2OnboardingMediaPresentationRequest, } from './v2-onboarding-media-presenter'
import type { V2OnboardingMediaCorrelation, V2OnboardingMediaSettledEvent, } from './V2OnboardingMediaStage'
import { V2OnboardingMediaStage } from './V2OnboardingMediaStage'

const BRAND = { kind: 'brand', alt: '' } as const

function still(src: string) {
  return { kind: 'still', src, alt: '' } as const
}

function video(src: string) {
  return { kind: 'video', src, alt: '' } as const
}

function automaticRequest(
  targetId: string,
  primary = video(`/${targetId}.mp4`),
): V2OnboardingMediaPresentationRequest {
  return {
    targetId,
    targetKind: 'automatic',
    primary,
    reducedStill: still(`/${targetId}-reduced.webp`),
    poster: still(`/${targetId}-poster.webp`),
    brand: BRAND,
  }
}

function holdRequest(targetId: string): V2OnboardingMediaPresentationRequest {
  return {
    targetId,
    targetKind: 'hold',
    primary: still(`/${targetId}-hold.webp`),
    reducedStill: still(`/${targetId}-reduced.webp`),
    poster: still(`/${targetId}-poster.webp`),
    brand: BRAND,
  }
}

interface StageHarness {
  readonly onPresentationSettled: ReturnType<
    typeof vi.fn<(event: V2OnboardingMediaSettledEvent) => void>
  >
  readonly onVideoEnded: ReturnType<
    typeof vi.fn<(event: V2OnboardingMediaCorrelation) => void>
  >
  readonly setForeground: (foreground: boolean) => void
  readonly setMode: (mode: V2OnboardingMediaMode) => void
  readonly setRequest: (
    request: V2OnboardingMediaPresentationRequest | undefined,
  ) => void
  readonly unmount: () => void
}

function renderStage(options: {
  readonly request?: V2OnboardingMediaPresentationRequest
  readonly mode?: V2OnboardingMediaMode
  readonly foreground?: boolean
}): StageHarness {
  const [request, setRequest] = createSignal(options.request)
  const [mode, setMode] = createSignal<V2OnboardingMediaMode>(
    options.mode ?? 'normal',
  )
  const [foreground, setForeground] = createSignal(options.foreground ?? true)
  const onPresentationSettled =
    vi.fn<(event: V2OnboardingMediaSettledEvent) => void>()
  const onVideoEnded = vi.fn<(event: V2OnboardingMediaCorrelation) => void>()

  const result = render(() => (
    <V2OnboardingMediaStage
      request={request()}
      mode={mode()}
      foreground={foreground()}
      transitionDurationMs={0}
      onPresentationSettled={onPresentationSettled}
      onVideoEnded={onVideoEnded}
    />
  ))

  return {
    onPresentationSettled,
    onVideoEnded,
    setForeground,
    setMode,
    setRequest,
    unmount: result.unmount,
  }
}

function currentVideo(): HTMLVideoElement {
  const videos = document.querySelectorAll('video')
  const element = videos.item(videos.length - 1)
  if (!(element instanceof HTMLVideoElement)) {
    throw new TypeError('Expected a V2 onboarding video.')
  }
  return element
}

function currentImage(): HTMLImageElement {
  const images = document.querySelectorAll('img')
  const element = images.item(images.length - 1)
  if (!(element instanceof HTMLImageElement)) {
    throw new TypeError('Expected a V2 onboarding still.')
  }
  return element
}

function layerFor(element: Element): HTMLElement {
  const layer = element.closest<HTMLElement>('[data-v2-media-token]')
  if (layer === null) throw new TypeError('Expected a media layer.')
  return layer
}

function decodeImage(element: HTMLImageElement): void {
  Object.defineProperty(element, 'naturalWidth', {
    configurable: true,
    value: 1_080,
  })
  fireEvent.load(element)
}

type FrameCallback = () => void

const frameCallbacks = new Map<HTMLVideoElement, FrameCallback>()
const cancelledFrames = vi.fn<(handle: number) => void>()
const playedElements: HTMLMediaElement[] = []
const pausedElements: HTMLMediaElement[] = []
let frameHandle = 0

function presentFrame(element: HTMLVideoElement): void {
  const callback = frameCallbacks.get(element)
  if (callback === undefined) {
    throw new TypeError('Expected a pending video-frame callback.')
  }
  callback()
}

beforeEach(() => {
  vi.useFakeTimers()
  frameCallbacks.clear()
  cancelledFrames.mockClear()
  playedElements.length = 0
  pausedElements.length = 0
  frameHandle = 0

  Object.defineProperties(HTMLVideoElement.prototype, {
    requestVideoFrameCallback: {
      configurable: true,
      value: vi.fn(function (this: HTMLVideoElement, callback: FrameCallback) {
        frameCallbacks.set(this, callback)
        frameHandle += 1
        return frameHandle
      }),
    },
    cancelVideoFrameCallback: {
      configurable: true,
      value: cancelledFrames,
    },
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    playedElements.push(this)
    return Promise.resolve()
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    pausedElements.push(this)
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>)
    .requestVideoFrameCallback
  delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>)
    .cancelVideoFrameCallback
})

describe('V2OnboardingMediaStage', () => {
  it('starts a visible video only after its source metadata exists', () => {
    renderStage({ request: automaticRequest('metadata-gated') })
    const element = currentVideo()

    expect(playedElements).toEqual([])

    fireEvent.loadedMetadata(element)

    expect(playedElements).toEqual([element])
  })

  it('retains the decoded outgoing node until a compositor frame and transition settle', () => {
    const harness = renderStage({ request: holdRequest('table') })
    const table = currentImage()
    decodeImage(table)
    fireEvent.transitionEnd(layerFor(table), { propertyName: 'opacity' })

    harness.setRequest(automaticRequest('scrolling-present'))
    const incoming = currentVideo()
    fireEvent.loadedMetadata(incoming)
    fireEvent.playing(incoming)
    fireEvent.loadedData(incoming)

    expect(document.body.contains(table)).toBe(true)
    expect(layerFor(incoming)).toHaveAttribute('data-v2-media-phase', 'loading')
    expect(harness.onPresentationSettled).toHaveBeenCalledTimes(1)

    presentFrame(incoming)

    expect(layerFor(incoming)).toHaveAttribute(
      'data-v2-media-phase',
      'revealed',
    )
    expect(document.body.contains(table)).toBe(true)
    expect(harness.onPresentationSettled).toHaveBeenCalledTimes(1)

    fireEvent.transitionEnd(layerFor(incoming), { propertyName: 'opacity' })

    expect(document.body.contains(table)).toBe(false)
    expect(currentVideo()).toBe(incoming)
    expect(incoming).toHaveAttribute('preload', 'metadata')
    expect(incoming.muted).toBe(true)
    expect(incoming.playsInline).toBe(true)
    expect(incoming).toHaveStyle({
      objectFit: 'cover',
      objectPosition: 'center center',
    })
    expect(harness.onPresentationSettled).toHaveBeenLastCalledWith({
      targetId: 'scrolling-present',
      token: expect.any(String),
      recoveryStage: 'primary',
    })
  })

  it('uses one deferred loaded-data task when the WebView has no video-frame callback', () => {
    delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>)
      .requestVideoFrameCallback
    delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>)
      .cancelVideoFrameCallback
    const harness = renderStage({ request: automaticRequest('legacy') })
    const element = currentVideo()

    fireEvent.loadedData(element)
    expect(layerFor(element)).toHaveAttribute('data-v2-media-phase', 'loading')
    vi.advanceTimersByTime(0)

    expect(layerFor(element)).toHaveAttribute('data-v2-media-phase', 'revealed')
    vi.runAllTimers()
    expect(harness.onPresentationSettled).toHaveBeenCalledWith({
      targetId: 'legacy',
      token: expect.any(String),
      recoveryStage: 'primary',
    })
  })

  it('walks video and image failures to native brand without accepting stale callbacks', async () => {
    const harness = renderStage({ request: automaticRequest('failing') })
    const primary = currentVideo()
    fireEvent.loadedData(primary)
    const staleFrame = frameCallbacks.get(primary)
    fireEvent.error(primary)

    const retry = currentVideo()
    expect(retry).not.toBe(primary)
    staleFrame?.()
    expect(layerFor(retry)).toHaveAttribute('data-v2-media-stage', 'retry')
    expect(layerFor(retry)).toHaveAttribute('data-v2-media-phase', 'loading')

    fireEvent.error(retry)
    const reduced = currentImage()
    expect(reduced.src).toContain('/failing-reduced.webp')
    fireEvent.error(reduced)

    const poster = currentImage()
    expect(poster).not.toBe(reduced)
    expect(poster.src).toContain('/failing-poster.webp')
    decodeImage(reduced)
    expect(currentImage()).toBe(poster)
    fireEvent.error(poster)
    await Promise.resolve()

    const brand = document.querySelector<HTMLElement>(
      '[data-v2-media-stage="brand"]',
    )
    expect(brand).toHaveAttribute('data-v2-media-phase', 'revealed')
    expect(brand).toHaveTextContent('Beside Cue')
    await vi.runAllTimersAsync()

    expect(harness.onPresentationSettled).toHaveBeenCalledTimes(1)
    expect(harness.onPresentationSettled).toHaveBeenCalledWith({
      targetId: 'failing',
      token: expect.any(String),
      recoveryStage: 'brand',
    })
  })

  it('never mounts moving media in reduced-motion mode or after switching into it', () => {
    const harness = renderStage({
      request: automaticRequest('reduced'),
      mode: 'reduced',
    })

    expect(document.querySelector('video')).toBeNull()
    expect(currentImage().src).toContain('/reduced-reduced.webp')

    harness.setMode('normal')
    const moving = currentVideo()
    expect(moving.src).toContain('/reduced.mp4')
    fireEvent.loadedData(moving)
    harness.setMode('reduced')

    expect(document.querySelector('video')).toBeNull()
    expect(currentImage().src).toContain('/reduced-reduced.webp')
    expect(pausedElements).toContain(moving)
    expect(cancelledFrames).toHaveBeenCalled()
  })

  it('reports ended once for the authoritative token and ignores a replaced outgoing video', () => {
    const harness = renderStage({ request: automaticRequest('first') })
    const first = currentVideo()
    fireEvent.loadedData(first)
    presentFrame(first)
    fireEvent.transitionEnd(layerFor(first), { propertyName: 'opacity' })
    const firstSettlement = harness.onPresentationSettled.mock.calls[0]?.[0]
    fireEvent.ended(first)
    fireEvent.ended(first)

    harness.setRequest(automaticRequest('second'))
    const second = currentVideo()
    fireEvent.ended(first)
    fireEvent.loadedData(second)
    presentFrame(second)
    fireEvent.transitionEnd(layerFor(second), { propertyName: 'opacity' })
    const secondSettlement = harness.onPresentationSettled.mock.calls[1]?.[0]
    fireEvent.ended(first)
    fireEvent.ended(second)

    expect(harness.onVideoEnded.mock.calls).toEqual([
      [
        {
          targetId: 'first',
          token: firstSettlement?.token,
        },
      ],
      [
        {
          targetId: 'second',
          token: secondSettlement?.token,
        },
      ],
    ])
  })

  it('pauses while hidden and resumes only the still-current clip on an explicit foreground transition', () => {
    const harness = renderStage({
      request: automaticRequest('first'),
      foreground: false,
    })
    const first = currentVideo()
    expect(playedElements).toEqual([])
    expect(pausedElements).toContain(first)

    harness.setForeground(true)
    expect(playedElements).toEqual([])
    fireEvent.loadedMetadata(first)
    expect(playedElements).toEqual([first])

    harness.setForeground(false)
    const playsBeforeReplacement = playedElements.length
    harness.setRequest(automaticRequest('second'))
    const second = currentVideo()
    expect(playedElements).toHaveLength(playsBeforeReplacement)
    expect(pausedElements).toContain(second)
    fireEvent.loadedMetadata(second)

    harness.setForeground(true)

    expect(playedElements.slice(playsBeforeReplacement)).toEqual([second])
    expect(playedElements.slice(playsBeforeReplacement)).not.toContain(first)
  })

  it('cancels frame work and makes every deferred callback inert on cleanup', () => {
    const harness = renderStage({ request: automaticRequest('cleanup') })
    const element = currentVideo()
    fireEvent.loadedData(element)
    const deferredFrame = frameCallbacks.get(element)

    harness.unmount()
    deferredFrame?.()
    vi.runAllTimers()

    expect(cancelledFrames).toHaveBeenCalled()
    expect(pausedElements).toContain(element)
    expect(harness.onPresentationSettled).not.toHaveBeenCalled()
    expect(harness.onVideoEnded).not.toHaveBeenCalled()
  })
})
