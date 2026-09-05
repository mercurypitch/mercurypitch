// ============================================================
// V2OnboardingMediaStage tests — browser evidence and lifecycle correlation
// ============================================================

import { fireEvent, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { V2OnboardingMediaMode, V2OnboardingMediaPresentationRequest, } from './v2-onboarding-media-presenter'
import type { V2OnboardingMediaCorrelation, V2OnboardingMediaSettledEvent, } from './V2OnboardingMediaStage'
import { V2OnboardingMediaStage } from './V2OnboardingMediaStage'

const mediaStageCss = readFileSync(
  resolve(process.cwd(), 'src/onboarding/V2OnboardingMediaStage.module.css'),
  'utf8',
)

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

const requestedFrames = vi.fn<() => number>()
const playedElements: HTMLMediaElement[] = []
const pausedElements: HTMLMediaElement[] = []
const reloadedElements: HTMLMediaElement[] = []

function startVideo(element: HTMLVideoElement): void {
  fireEvent.loadedMetadata(element)
  fireEvent.loadedData(element)
  fireEvent.playing(element)
}

beforeEach(() => {
  vi.useFakeTimers()
  requestedFrames.mockReset()
  requestedFrames.mockImplementation(() => 1)
  playedElements.length = 0
  pausedElements.length = 0
  reloadedElements.length = 0

  Object.defineProperties(HTMLVideoElement.prototype, {
    requestVideoFrameCallback: {
      configurable: true,
      value: requestedFrames,
    },
    cancelVideoFrameCallback: {
      configurable: true,
      value: vi.fn(),
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
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    reloadedElements.push(this)
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
  it('keeps a loading video fully visible above its outgoing fallback', () => {
    expect(mediaStageCss).toMatch(
      /\.layer\[data-v2-media-kind='video'\]\[data-v2-media-phase='loading'\]\s*\{[^}]*z-index:\s*2;[^}]*opacity:\s*1;/s,
    )
    expect(mediaStageCss).not.toContain('opacity: 0.001')
  })

  it('starts a visible video only after its source metadata exists', () => {
    renderStage({ request: automaticRequest('metadata-gated') })
    const element = currentVideo()

    expect(playedElements).toEqual([])

    fireEvent.loadedMetadata(element)

    expect(playedElements).toEqual([element])
  })

  it('retains the decoded outgoing node until video playback and transition settle', () => {
    const harness = renderStage({ request: holdRequest('table') })
    const table = currentImage()
    decodeImage(table)
    fireEvent.transitionEnd(layerFor(table), { propertyName: 'opacity' })

    harness.setRequest(automaticRequest('scrolling-present'))
    const incoming = currentVideo()
    fireEvent.loadedMetadata(incoming)
    fireEvent.loadedData(incoming)

    expect(document.body.contains(table)).toBe(true)
    expect(layerFor(incoming)).toHaveAttribute('data-v2-media-phase', 'loading')
    expect(harness.onPresentationSettled).toHaveBeenCalledTimes(1)

    fireEvent.playing(incoming)

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
    expect(vi.getTimerCount()).toBe(0)

    vi.advanceTimersByTime(1_200)
    expect(currentVideo()).toBe(incoming)
    expect(harness.onPresentationSettled).toHaveBeenCalledTimes(2)
    expect(requestedFrames).not.toHaveBeenCalled()
  })

  it('keeps healthy iOS playback primary when a frame callback never fires', () => {
    const harness = renderStage({ request: automaticRequest('ios-inline') })
    const primary = currentVideo()

    startVideo(primary)
    fireEvent.transitionEnd(layerFor(primary), { propertyName: 'opacity' })
    vi.advanceTimersByTime(5_000)

    expect(currentVideo()).toBe(primary)
    expect(layerFor(primary)).toHaveAttribute('data-v2-media-stage', 'primary')
    expect(layerFor(primary)).toHaveAttribute('data-v2-media-phase', 'current')
    expect(document.querySelector('img')).toBeNull()
    expect(requestedFrames).not.toHaveBeenCalled()
    expect(harness.onPresentationSettled).toHaveBeenCalledWith({
      targetId: 'ios-inline',
      token: expect.any(String),
      recoveryStage: 'primary',
    })

    fireEvent.ended(primary)
    fireEvent.ended(primary)
    expect(harness.onVideoEnded).toHaveBeenCalledTimes(1)
  })

  it('does not demote decoded data while waiting for playback to start', () => {
    const harness = renderStage({ request: holdRequest('known-good') })
    const outgoing = currentImage()
    decodeImage(outgoing)
    fireEvent.transitionEnd(layerFor(outgoing), { propertyName: 'opacity' })

    harness.setRequest(automaticRequest('starting'))
    const primary = currentVideo()
    fireEvent.loadedMetadata(primary)
    fireEvent.loadedData(primary)
    vi.advanceTimersByTime(5_000)

    expect(currentVideo()).toBe(primary)
    expect(layerFor(primary)).toHaveAttribute('data-v2-media-phase', 'loading')
    expect(document.body.contains(outgoing)).toBe(true)
    expect(harness.onPresentationSettled).toHaveBeenCalledTimes(1)

    fireEvent.playing(primary)
    expect(layerFor(primary)).toHaveAttribute('data-v2-media-phase', 'revealed')
  })

  it('recovers when a bundled video never reaches loaded data', () => {
    const harness = renderStage({ request: automaticRequest('decode-stall') })
    const primary = currentVideo()

    vi.advanceTimersByTime(2_999)
    expect(currentVideo()).toBe(primary)
    expect(layerFor(primary)).toHaveAttribute('data-v2-media-phase', 'loading')

    vi.advanceTimersByTime(1)
    const retry = currentVideo()
    expect(retry).not.toBe(primary)
    expect(layerFor(retry)).toHaveAttribute('data-v2-media-stage', 'retry')

    vi.advanceTimersByTime(3_000)
    const reduced = currentImage()
    expect(document.querySelector('video')).toBeNull()
    expect(reduced.src).toContain('/decode-stall-reduced.webp')

    decodeImage(reduced)
    fireEvent.transitionEnd(layerFor(reduced), { propertyName: 'opacity' })
    expect(harness.onPresentationSettled).toHaveBeenCalledWith({
      targetId: 'decode-stall',
      token: expect.any(String),
      recoveryStage: 'reduced-still',
    })
  })

  it('releases a retired video decoder after its successor settles', () => {
    const harness = renderStage({ request: automaticRequest('first-video') })
    const first = currentVideo()
    startVideo(first)
    fireEvent.transitionEnd(layerFor(first), { propertyName: 'opacity' })

    harness.setRequest(automaticRequest('second-video'))
    const second = currentVideo()
    startVideo(second)

    expect(first).toHaveAttribute('src', '/first-video.mp4')
    expect(reloadedElements).not.toContain(first)

    fireEvent.transitionEnd(layerFor(second), { propertyName: 'opacity' })

    expect(document.body.contains(first)).toBe(false)
    expect(first).not.toHaveAttribute('src')
    expect(pausedElements).toContain(first)
    expect(reloadedElements).toContain(first)
    expect(second).toHaveAttribute('src', '/second-video.mp4')
  })

  it('walks video and image failures to native brand without accepting stale callbacks', async () => {
    const harness = renderStage({ request: automaticRequest('failing') })
    const primary = currentVideo()
    fireEvent.error(primary)

    const retry = currentVideo()
    expect(retry).not.toBe(primary)
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
    expect(moving).not.toHaveAttribute('src')
    expect(reloadedElements).toContain(moving)
  })

  it('reports ended once for the authoritative token and ignores a replaced outgoing video', () => {
    const harness = renderStage({ request: automaticRequest('first') })
    const first = currentVideo()
    startVideo(first)
    fireEvent.transitionEnd(layerFor(first), { propertyName: 'opacity' })
    const firstSettlement = harness.onPresentationSettled.mock.calls[0]?.[0]
    fireEvent.ended(first)
    fireEvent.ended(first)

    harness.setRequest(automaticRequest('second'))
    const second = currentVideo()
    fireEvent.ended(first)
    startVideo(second)
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
    expect(first).toHaveAttribute('src', '/first.mp4')
    expect(reloadedElements).not.toContain(first)
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

  it('requires a fresh playback signal after an event races with backgrounding', async () => {
    const harness = renderStage({
      request: automaticRequest('background-race'),
      foreground: false,
    })
    const element = currentVideo()
    fireEvent.loadedMetadata(element)
    fireEvent.loadedData(element)
    fireEvent.playing(element)

    harness.setForeground(true)
    await Promise.resolve()

    expect(layerFor(element)).toHaveAttribute('data-v2-media-phase', 'loading')
    expect(harness.onPresentationSettled).not.toHaveBeenCalled()

    fireEvent.playing(element)
    expect(layerFor(element)).toHaveAttribute('data-v2-media-phase', 'revealed')
  })

  it('pauses decode watchdogs while backgrounded and restarts their full grace on resume', () => {
    const harness = renderStage({
      request: automaticRequest('backgrounded'),
      foreground: false,
    })
    const primary = currentVideo()

    vi.advanceTimersByTime(10_000)
    expect(currentVideo()).toBe(primary)

    harness.setForeground(true)
    vi.advanceTimersByTime(2_999)
    expect(currentVideo()).toBe(primary)

    harness.setForeground(false)
    vi.advanceTimersByTime(10_000)
    expect(currentVideo()).toBe(primary)

    harness.setForeground(true)
    vi.advanceTimersByTime(2_999)
    expect(currentVideo()).toBe(primary)

    vi.advanceTimersByTime(1)
    const retry = currentVideo()
    expect(retry).not.toBe(primary)
    expect(layerFor(retry)).toHaveAttribute('data-v2-media-stage', 'retry')

    harness.setForeground(false)
    vi.advanceTimersByTime(10_000)
    expect(currentVideo()).toBe(retry)

    harness.setForeground(true)
    vi.advanceTimersByTime(2_999)
    expect(currentVideo()).toBe(retry)

    vi.advanceTimersByTime(1)
    expect(currentImage().src).toContain('/backgrounded-reduced.webp')
  })

  it('releases media resources and makes deferred work inert on cleanup', () => {
    const harness = renderStage({ request: automaticRequest('cleanup') })
    const element = currentVideo()
    fireEvent.loadedData(element)

    harness.unmount()
    vi.runAllTimers()

    expect(pausedElements).toContain(element)
    expect(element).not.toHaveAttribute('src')
    expect(reloadedElements).toContain(element)
    expect(harness.onPresentationSettled).not.toHaveBeenCalled()
    expect(harness.onVideoEnded).not.toHaveBeenCalled()
  })
})
