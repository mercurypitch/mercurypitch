import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CinematicOnboardingMediaManifest } from './cinematic-onboarding-media'
import { CINEMATIC_ONBOARDING_TIMELINE_V0_4 } from './cinematic-onboarding-timeline'
import type { CinematicOnboardingDirectorProps, CinematicOnboardingReminderResult, CinematicOnboardingSaveResult, } from './CinematicOnboardingDirector'
import { CinematicOnboardingDirector, isCinematicOnboardingReviewEnabled, } from './CinematicOnboardingDirector'

const audioClock = vi.hoisted(() => ({
  dispose: vi.fn(),
  load: vi.fn<(src: string) => Promise<boolean>>(),
  pause: vi.fn(),
  start: vi.fn<(offsetSeconds: number) => Promise<boolean>>(),
  unlock: vi.fn<() => Promise<boolean>>(),
}))

vi.mock('./cinematic-onboarding-audio', () => ({
  createCinematicOnboardingAudioClock: () => audioClock,
}))

const B_SIDE_OPTIONS = [
  { id: 'put-away', text: 'Put the phone in another room' },
  { id: 'guitar', text: 'Play one guitar riff' },
  { id: 'walk', text: 'Walk to the end of the street' },
] as const

function mediaManifest(): CinematicOnboardingMediaManifest {
  const segments = Object.fromEntries(
    CINEMATIC_ONBOARDING_TIMELINE_V0_4.shots.flatMap((shot) =>
      shot.segments.map((segment) => {
        const stable = {
          alt: `Stable scene for ${segment.id}`,
          poster: `/onboarding/${segment.id}.webp`,
          reducedStill: `/onboarding/${segment.id}-reduced.webp`,
        }

        if (segment.kind === 'automatic') {
          return [
            segment.id,
            {
              ...stable,
              kind: 'automatic',
              video: `/onboarding/${segment.id}.mp4`,
            },
          ]
        }
        if (segment.kind === 'automatic_native_overlay') {
          return [segment.id, { ...stable, kind: 'automatic_native_overlay' }]
        }
        return [segment.id, { ...stable, kind: 'hold' }]
      }),
    ),
  ) as unknown as CinematicOnboardingMediaManifest['segments']

  return {
    revision: 'director-test-v0.8',
    sourceContractVersion: '0.4.0',
    sourceContractSha256: 'a'.repeat(64),
    audio: {
      kind: 'continuous_review_mix',
      src: '/onboarding/review-mix.m4a',
      sourceDurationFrames: 746,
      clockPolicy: 'pause_with_picture',
    },
    segments,
  }
}

interface HarnessOptions {
  readonly mode?: 'normal' | 'reduced'
  readonly rehearsal?: boolean
  readonly onSavePlan?: CinematicOnboardingDirectorProps['onSavePlan']
  readonly onSetReminder?: CinematicOnboardingDirectorProps['onSetReminder']
  readonly onSkipReminder?: CinematicOnboardingDirectorProps['onSkipReminder']
  readonly onComplete?: CinematicOnboardingDirectorProps['onComplete']
}

interface DirectorHarness {
  readonly onSavePlan: ReturnType<
    typeof vi.fn<CinematicOnboardingDirectorProps['onSavePlan']>
  >
  readonly onSetReminder: ReturnType<
    typeof vi.fn<CinematicOnboardingDirectorProps['onSetReminder']>
  >
  readonly onSkipReminder: ReturnType<
    typeof vi.fn<CinematicOnboardingDirectorProps['onSkipReminder']>
  >
  readonly onComplete: ReturnType<
    typeof vi.fn<CinematicOnboardingDirectorProps['onComplete']>
  >
}

function renderDirector(options: HarnessOptions = {}): DirectorHarness {
  const onSavePlan = vi.fn<CinematicOnboardingDirectorProps['onSavePlan']>(
    options.onSavePlan ??
      (async (): Promise<CinematicOnboardingSaveResult> => ({ ok: true })),
  )
  const onSetReminder = vi.fn<
    CinematicOnboardingDirectorProps['onSetReminder']
  >(
    options.onSetReminder ??
      (async (): Promise<CinematicOnboardingReminderResult> => ({
        ok: true,
        message: 'Reminder set for 9:00. You can change it in Settings.',
      })),
  )
  const onSkipReminder = vi.fn<
    CinematicOnboardingDirectorProps['onSkipReminder']
  >(options.onSkipReminder ?? (() => undefined))
  const onComplete = vi.fn<CinematicOnboardingDirectorProps['onComplete']>(
    options.onComplete ?? (() => undefined),
  )

  render(() => (
    <CinematicOnboardingDirector
      media={mediaManifest()}
      bSideOptions={B_SIDE_OPTIONS}
      onSavePlan={onSavePlan}
      onSetReminder={onSetReminder}
      onSkipReminder={onSkipReminder}
      onComplete={onComplete}
      {...(options.mode === undefined ? {} : { mode: options.mode })}
      {...(options.rehearsal === undefined
        ? {}
        : { rehearsal: options.rehearsal })}
    />
  ))

  return { onSavePlan, onSetReminder, onSkipReminder, onComplete }
}

function currentVideo(): HTMLVideoElement {
  const video = document.querySelector('video')
  if (!(video instanceof HTMLVideoElement)) {
    throw new TypeError('Expected the current beat to use a video element.')
  }
  return video
}

function currentImage(): HTMLImageElement {
  const image = document.querySelector('.cinematic-onboarding__picture img')
  if (!(image instanceof HTMLImageElement)) {
    throw new TypeError('Expected the current beat to use an image element.')
  }
  return image
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

async function beginFilm(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
  await flushMicrotasks()
}

async function finishCurrentVideo(): Promise<HTMLVideoElement> {
  const video = currentVideo()
  fireEvent.play(video)
  fireEvent.ended(video)
  await flushMicrotasks()
  return video
}

async function advanceNativeBeat(milliseconds: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(milliseconds)
  await flushMicrotasks()
}

async function reachSideBHold(): Promise<void> {
  await beginFilm()
  await finishCurrentVideo()
  await finishCurrentVideo()
  await finishCurrentVideo()
  await advanceNativeBeat(2_000)
  await finishCurrentVideo()
  expect(
    screen.getByRole('heading', { name: 'What would you rather begin?' }),
  ).toBeVisible()
}

async function chooseGuitarAndReachSaveHold(): Promise<void> {
  await reachSideBHold()
  fireEvent.click(screen.getByRole('button', { name: 'Play one guitar riff' }))
  fireEvent.click(screen.getByRole('button', { name: 'Use this Side B' }))
  await flushMicrotasks()
  await finishCurrentVideo()
  expect(
    screen.getByRole('heading', {
      name: 'Stop the record to save this plan.',
    }),
  ).toBeVisible()
}

async function saveAndReachReminderHold(): Promise<void> {
  await chooseGuitarAndReachSaveHold()
  fireEvent.click(screen.getByRole('button', { name: 'Stop the record' }))
  await flushMicrotasks()
  await finishCurrentVideo()
  expect(
    screen.getByRole('heading', { name: 'Want a daily reminder?' }),
  ).toBeVisible()
}

async function finishClosingBeat(): Promise<void> {
  if (document.querySelector('video') instanceof HTMLVideoElement) {
    await finishCurrentVideo()
    return
  }
  await advanceNativeBeat(3_000)
}

describe('cinematic onboarding director', () => {
  let completeGetter: ReturnType<typeof vi.spyOn>
  let naturalWidthGetter: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    audioClock.load.mockResolvedValue(true)
    audioClock.start.mockResolvedValue(true)
    audioClock.unlock.mockResolvedValue(true)
    completeGetter = vi
      .spyOn(HTMLImageElement.prototype, 'complete', 'get')
      .mockReturnValue(true)
    naturalWidthGetter = vi
      .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
      .mockReturnValue(1_080)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(
      async () => {},
    )
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('uses one opaque brand action and begins with sound enabled', async () => {
    const play = vi.mocked(HTMLMediaElement.prototype.play)
    const harness = renderDirector()

    const begin = screen.getByRole('button', { name: 'Tap to begin' })
    expect(begin).toHaveClass('cinematic-onboarding__curtain')
    expect(screen.getAllByRole('button')).toEqual([begin])
    expect(screen.queryByText('Hi there, I am Corky.')).not.toBeInTheDocument()
    expect(screen.queryByText(/Watch quietly/u)).not.toBeInTheDocument()
    expect(screen.queryByText(/Begin with sound/u)).not.toBeInTheDocument()
    expect(screen.queryByText(/\d+\s*\/\s*\d+/u)).not.toBeInTheDocument()
    expect(play).not.toHaveBeenCalled()

    await beginFilm()

    expect(audioClock.unlock).toHaveBeenCalledTimes(1)
    expect(play).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Mute audio' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Pause/u }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Skip/u }),
    ).not.toBeInTheDocument()

    fireEvent.play(currentVideo())
    expect(screen.getByText('Hi there, I am Corky.')).toBeVisible()
    expect(audioClock.start).toHaveBeenCalled()
    expect(harness.onComplete).not.toHaveBeenCalled()
  })

  it('continues with captions when audio is unavailable', async () => {
    audioClock.load.mockResolvedValue(false)
    audioClock.unlock.mockResolvedValue(false)
    renderDirector()
    await flushMicrotasks()

    expect(screen.getByRole('button', { name: 'Tap to begin' })).toBeEnabled()
    await beginFilm()
    fireEvent.play(currentVideo())

    expect(
      screen.getByRole('button', {
        name: 'Sound unavailable; captions are on',
      }),
    ).toBeDisabled()
    expect(screen.getByText('Hi there, I am Corky.')).toBeVisible()
  })

  it('reveals pause and leave controls only through the escape action', async () => {
    renderDirector()
    await beginFilm()

    expect(
      screen.queryByRole('button', { name: 'Pause film' }),
    ).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Pause film' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Leave introduction' }),
    ).toBeVisible()
  })

  it('commits once, blocks dismissal while pending, then advances after success', async () => {
    vi.useFakeTimers()
    let resolveSave:
      | ((result: CinematicOnboardingSaveResult) => void)
      | undefined
    const savePromise = new Promise<CinematicOnboardingSaveResult>(
      (resolve) => {
        resolveSave = resolve
      },
    )
    const harness = renderDirector({
      onSavePlan: () => savePromise,
    })
    await chooseGuitarAndReachSaveHold()

    expect(screen.getByText('Keep scrolling')).toBeVisible()
    expect(screen.getByText('Play one guitar riff')).toBeVisible()
    const stop = screen.getByRole('button', { name: 'Stop the record' })
    fireEvent.click(stop)
    fireEvent.click(stop)

    expect(harness.onSavePlan).toHaveBeenCalledTimes(1)
    expect(harness.onSavePlan).toHaveBeenCalledWith({
      pullId: 'scrolling',
      pullText: 'Endless scrolling',
      sideAText: 'Keep scrolling',
      bSideId: 'guitar',
      bSideText: 'Play one guitar riff',
    })
    expect(
      screen.getByRole('heading', {
        name: 'Stop the record to save this plan.',
      }),
    ).toBeVisible()
    fireEvent.keyDown(document, { key: 'Escape' })
    const leave = screen.getByRole('button', { name: 'Leave introduction' })
    expect(leave).toBeDisabled()
    fireEvent.click(leave)
    expect(harness.onComplete).not.toHaveBeenCalled()

    resolveSave?.({ ok: true })
    await flushMicrotasks()
    expect(screen.getByText('Corky notices the stop.')).toBeVisible()
    expect(leave).toBeEnabled()
    fireEvent.click(leave)
    expect(harness.onComplete).toHaveBeenCalledTimes(1)
    expect(harness.onComplete).toHaveBeenCalledWith('dismissed')
  })

  it('keeps Stop retryable after a truthful save failure', async () => {
    vi.useFakeTimers()
    const onSavePlan = vi
      .fn<CinematicOnboardingDirectorProps['onSavePlan']>()
      .mockResolvedValueOnce({
        ok: false,
        message: 'Your plan could not be saved on this device. Try again.',
      })
      .mockResolvedValueOnce({ ok: true })
    renderDirector({ onSavePlan })
    await chooseGuitarAndReachSaveHold()

    fireEvent.click(screen.getByRole('button', { name: 'Stop the record' }))
    await flushMicrotasks()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your plan could not be saved on this device. Try again.',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Stop the record' }))
    await flushMicrotasks()
    expect(onSavePlan).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Corky notices the stop.')).toBeVisible()
  })

  it('sets a real reminder, shows its result, and completes exactly once', async () => {
    vi.useFakeTimers()
    const harness = renderDirector({
      onSetReminder: async (time) => ({
        ok: true,
        message: `Reminder set for ${time}. You can change it in Settings.`,
      }),
    })
    await saveAndReachReminderHold()

    const time = screen.getByLabelText('Time')
    fireEvent.input(time, { target: { value: '13:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set for 13:30' }))
    await flushMicrotasks()

    expect(harness.onSetReminder).toHaveBeenCalledTimes(1)
    expect(harness.onSetReminder).toHaveBeenCalledWith('13:30')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Reminder set for 13:30. You can change it in Settings.',
    )
    await advanceNativeBeat(1_000)
    expect(
      screen.getByRole('heading', { name: 'Your plan is ready.' }),
    ).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Reminder set for 13:30. You can change it in Settings.',
    )
    await finishClosingBeat()

    expect(harness.onComplete).toHaveBeenCalledTimes(1)
    expect(harness.onComplete).toHaveBeenLastCalledWith('finished')
    await vi.runOnlyPendingTimersAsync()
    expect(harness.onComplete).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).not.toMatch(
      /Nothing is recorded yet|Keep both in view|Now choose the stop|Preview this time|exact local time|skip this moment/iu,
    )
  })

  it('skips the optional reminder without invoking the scheduler', async () => {
    vi.useFakeTimers()
    const harness = renderDirector()
    await saveAndReachReminderHold()

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(harness.onSkipReminder).toHaveBeenCalledTimes(1)
    expect(harness.onSetReminder).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(
      'No reminder set. You can add one later in Settings.',
    )
  })

  it('makes explicit review navigation deterministic and persistence-free', async () => {
    vi.stubEnv('VITE_BESIDE_CUE_ONBOARDING_REVIEW', '1')
    vi.useFakeTimers()
    const harness = renderDirector()
    await beginFilm()

    const firstVideo = currentVideo()
    expect(screen.getByText('S01_S02_AUTO_ENTRANCE_HELLO')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Next ›' }))
    await flushMicrotasks()
    expect(screen.getByText('S03_AUTO_TRACKED_TRANSITION')).toBeVisible()
    expect(currentVideo()).not.toBe(firstVideo)
    fireEvent.ended(firstVideo)
    expect(screen.getByText('S03_AUTO_TRACKED_TRANSITION')).toBeVisible()

    const beforeReplay = currentVideo()
    fireEvent.click(screen.getByRole('button', { name: 'Replay scene' }))
    await flushMicrotasks()
    expect(currentVideo()).not.toBe(beforeReplay)

    fireEvent.click(screen.getByRole('button', { name: 'Next ›' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next ›' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next ›' }))
    await flushMicrotasks()
    expect(screen.getByText('S06_AUTO_CORKY_PRESS')).toBeVisible()
    await finishCurrentVideo()
    fireEvent.click(screen.getByRole('button', { name: 'Stop the record' }))
    await flushMicrotasks()

    expect(harness.onSavePlan).not.toHaveBeenCalled()
    await finishCurrentVideo()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(harness.onSkipReminder).not.toHaveBeenCalled()
    expect(harness.onSetReminder).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Review only. No reminder was changed.',
    )
  })

  it('rehearses the real holds without writing callbacks', async () => {
    vi.useFakeTimers()
    const harness = renderDirector({ rehearsal: true })
    await saveAndReachReminderHold()

    expect(harness.onSavePlan).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Set for 9:00' }))
    await flushMicrotasks()
    expect(harness.onSetReminder).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Replay only. Your reminder was not changed.',
    )
  })

  it('retries a transient empty still once, then uses the poster without blocking', async () => {
    completeGetter.mockReturnValue(false)
    naturalWidthGetter.mockReturnValue(0)
    renderDirector({ mode: 'reduced' })
    await beginFilm()

    const primary = currentImage()
    expect(primary.src).toContain('-reduced.webp')
    fireEvent.load(primary)
    await flushMicrotasks()
    const retry = currentImage()
    expect(retry).not.toBe(primary)
    expect(retry.src).toBe(primary.src)

    fireEvent.load(primary)
    expect(currentImage()).toBe(retry)
    fireEvent.error(retry)
    await flushMicrotasks()
    const poster = currentImage()
    expect(poster.src).toContain('.webp')
    expect(poster.src).not.toContain('-reduced.webp')

    naturalWidthGetter.mockReturnValue(1_080)
    fireEvent.load(poster)
    await flushMicrotasks()
    expect(screen.getByText('Hi there, I am Corky.')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/decoded|playback error/iu)
  })

  it('falls back from repeated video failure and ignores retired callbacks', async () => {
    renderDirector()
    await beginFilm()

    const primary = currentVideo()
    fireEvent.error(primary)
    await flushMicrotasks()
    const retry = currentVideo()
    expect(retry).not.toBe(primary)
    fireEvent.ended(primary)
    expect(currentVideo()).toBe(retry)

    fireEvent.error(retry)
    await flushMicrotasks()
    expect(currentImage().src).toContain('-reduced.webp')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('recognizes only the explicit review flag value', () => {
    expect(
      isCinematicOnboardingReviewEnabled({
        VITE_BESIDE_CUE_ONBOARDING_REVIEW: '1',
      }),
    ).toBe(true)
    expect(
      isCinematicOnboardingReviewEnabled({
        VITE_BESIDE_CUE_ONBOARDING_REVIEW: 'true',
      }),
    ).toBe(false)
    expect(isCinematicOnboardingReviewEnabled({})).toBe(false)
  })
})
