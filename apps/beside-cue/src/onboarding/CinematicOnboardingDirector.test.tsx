import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CinematicOnboardingMediaManifest } from './cinematic-onboarding-media'
import { CINEMATIC_ONBOARDING_TIMELINE_V0_3 } from './cinematic-onboarding-timeline'
import { CinematicOnboardingDirector } from './CinematicOnboardingDirector'

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

function mediaManifest(): CinematicOnboardingMediaManifest {
  const segments = Object.fromEntries(
    CINEMATIC_ONBOARDING_TIMELINE_V0_3.shots.flatMap((shot) =>
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
    revision: 'director-test-v0.7',
    sourceContractVersion: '0.3.0',
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

function currentVideo(): HTMLVideoElement {
  const video = document.querySelector('video')
  if (!(video instanceof HTMLVideoElement)) {
    throw new TypeError('Expected the current beat to use a video element.')
  }
  return video
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

async function finishCurrentVideo(): Promise<HTMLVideoElement> {
  const video = currentVideo()
  fireEvent.play(video)
  fireEvent.ended(video)
  await flushMicrotasks()
  return video
}

async function beginQuietly(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Watch quietly' }))
  await flushMicrotasks()
}

async function reachSortHold(): Promise<void> {
  await beginQuietly()
  await finishCurrentVideo()
  await finishCurrentVideo()
  await finishCurrentVideo()

  fireEvent.click(screen.getByRole('button', { name: 'The Scroll' }))
  await flushMicrotasks()
  await finishCurrentVideo()
}

function completeSixCardSort(): void {
  const chips = [
    ...document.querySelectorAll<HTMLButtonElement>(
      '.cinematic-onboarding__sort-chip',
    ),
  ]
  expect(chips.map((chip) => chip.textContent?.trim())).toEqual([
    'Pause',
    'Familiar',
    'Ten minutes',
    'Reach out',
    'Step away',
    'Tomorrow',
  ])

  chips[0]?.focus()
  expect(document.activeElement).toBe(chips[0])

  const sideA = screen.getByRole('button', {
    name: 'Move selected card to Side A',
  })
  const bSide = screen.getByRole('button', {
    name: 'Move selected card to B-side',
  })
  for (const [index, chip] of chips.entries()) {
    fireEvent.click(chip)
    fireEvent.click(index % 2 === 0 ? sideA : bSide)
  }
}

async function reachReminderReveal(): Promise<void> {
  await reachSortHold()
  completeSixCardSort()
  fireEvent.click(screen.getByRole('button', { name: 'Keep both in view' }))
  await flushMicrotasks()

  await finishCurrentVideo()
  fireEvent.click(screen.getByRole('button', { name: 'Stop the record' }))
  await flushMicrotasks()
  await finishCurrentVideo()
}

describe('cinematic onboarding director', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    audioClock.load.mockResolvedValue(true)
    audioClock.start.mockResolvedValue(true)
    audioClock.unlock.mockResolvedValue(true)
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(
      true,
    )
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(
      1_080,
    )
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(
      async () => {},
    )
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('gates autoplay behind the preroll while quiet playback preserves the exact caption', async () => {
    audioClock.load.mockReturnValue(new Promise(() => {}))
    const play = vi.mocked(HTMLMediaElement.prototype.play)
    const onComplete = vi.fn()

    render(() => (
      <CinematicOnboardingDirector
        media={mediaManifest()}
        onComplete={onComplete}
      />
    ))

    expect(play).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Preparing sound…' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Watch quietly' })).toBeEnabled()

    await beginQuietly()

    expect(play).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Hi there, I am Corky.')).toBeVisible()
    expect(audioClock.start).not.toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('uses six focusable native card controls and requires every placement before continuing', async () => {
    const onComplete = vi.fn()
    render(() => (
      <CinematicOnboardingDirector
        media={mediaManifest()}
        onComplete={onComplete}
      />
    ))
    await reachSortHold()

    const continueButton = screen.getByRole('button', {
      name: 'Keep both in view',
    })
    expect(continueButton).toBeDisabled()

    completeSixCardSort()

    expect(continueButton).toBeEnabled()
    const sideCounts = screen.getAllByText('3 cards', { selector: 'small' })
    expect(sideCounts).toHaveLength(2)
    for (const count of sideCounts) expect(count).toBeVisible()
    expect(screen.getByText(/6 of 6 sorted\.$/u)).toBeVisible()

    fireEvent.click(continueButton)
    await flushMicrotasks()

    expect(screen.getByText('Corky starts the record.')).toBeVisible()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('accepts the native reminder choice, presents H08, and completes exactly once', async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    render(() => (
      <CinematicOnboardingDirector
        media={mediaManifest()}
        onComplete={onComplete}
      />
    ))
    await reachReminderReveal()

    expect(
      screen.getByRole('heading', {
        name: 'When should it come beside you?',
      }),
    ).toBeVisible()
    await vi.advanceTimersByTimeAsync(2_000)

    const time = screen.getByLabelText('Reminder time')
    expect(time).toHaveValue('09:00')
    fireEvent.input(time, { target: { value: '13:30' } })
    expect(time).toHaveValue('13:30')
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(
      screen.getByRole('heading', { name: 'Nothing scheduled.' }),
    ).toBeVisible()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(
      screen.getByRole('heading', {
        name: 'Keep your better choice beside the moment.',
      }),
    ).toBeVisible()
    await vi.advanceTimersByTimeAsync(3_000)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenLastCalledWith('finished')
    await vi.runOnlyPendingTimersAsync()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('ignores callbacks from a retired retry attempt and dismisses only once', async () => {
    const onComplete = vi.fn()
    render(() => (
      <CinematicOnboardingDirector
        media={mediaManifest()}
        onComplete={onComplete}
      />
    ))
    await beginQuietly()

    const retiredVideo = currentVideo()
    fireEvent.error(retiredVideo)
    expect(screen.getByRole('alert')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await flushMicrotasks()
    const activeVideo = currentVideo()
    expect(activeVideo).not.toBe(retiredVideo)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.error(retiredVideo)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.play(activeVideo)

    const skip = screen.getByRole('button', { name: 'Skip' })
    fireEvent.click(skip)
    fireEvent.click(skip)
    fireEvent.ended(activeVideo)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenLastCalledWith('dismissed')
  })

  it('does not turn an intentional pause of pending playback into an error', async () => {
    const rejectPlay: Array<(error: DOMException) => void> = []
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectPlay.push(reject)
        }),
    )
    const onComplete = vi.fn()
    render(() => (
      <CinematicOnboardingDirector
        media={mediaManifest()}
        onComplete={onComplete}
      />
    ))
    await beginQuietly()

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    await flushMicrotasks()
    rejectPlay[0]?.(new DOMException('Playback interrupted', 'AbortError'))
    await flushMicrotasks()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeVisible()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('preserves the remaining reduced-motion dwell while paused', async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    render(() => (
      <CinematicOnboardingDirector
        media={mediaManifest()}
        mode="reduced"
        onComplete={onComplete}
      />
    ))
    await beginQuietly()

    expect(screen.getByText('Hi there, I am Corky.')).toBeVisible()
    await vi.advanceTimersByTimeAsync(1_000)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(screen.getByText('Hi there, I am Corky.')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    await flushMicrotasks()
    await vi.advanceTimersByTimeAsync(2_999)
    expect(screen.getByText('Hi there, I am Corky.')).toBeVisible()

    await vi.advanceTimersByTimeAsync(1)
    expect(
      screen.getByText('Come see how a small cue can change direction.'),
    ).toBeVisible()
    expect(onComplete).not.toHaveBeenCalled()
  })
})
