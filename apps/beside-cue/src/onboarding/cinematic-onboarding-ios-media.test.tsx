import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CinematicOnboardingMediaManifest } from './cinematic-onboarding-media'
import { CINEMATIC_ONBOARDING_TIMELINE_V0_5 } from './cinematic-onboarding-timeline'
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

const B_SIDE_OPTIONS = [
  { id: 'put-away', text: 'Put the phone in another room' },
] as const

function mediaManifest(): CinematicOnboardingMediaManifest {
  const segments = Object.fromEntries(
    CINEMATIC_ONBOARDING_TIMELINE_V0_5.shots.flatMap((shot) =>
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
    revision: 'ios-media-test',
    sourceContractVersion: '0.5.0',
    sourceContractSha256: 'a'.repeat(64),
    audio: {
      kind: 'continuous_review_mix',
      src: '/onboarding/review-mix.m4a',
      sourceDurationFrames: 788,
      clockPolicy: 'pause_with_picture',
    },
    segments,
  }
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('a video the platform never composites', () => {
  // The failure this pins is the black half of "the onboarding intro does
  // not play on native iOS. Black, flickering between scenes, no sound."
  //
  // `requestVideoFrameCallback` fires when a frame is COMPOSITED, and the
  // reveal was gated on it alone. A WKWebView that refuses to play -- the
  // autoplay policy, a decoder it will not hand a WebView, a range request
  // the Capacitor asset handler answered wrongly -- never composites, so
  // the callback never fires, and the surface stays at opacity 0. A black
  // rectangle, for as long as the player is willing to wait.
  //
  // jsdom cannot refuse to play, so the refusal is modelled the only way
  // that matters here: an rVFC that registers its callback and never calls
  // it. Every other test in this suite installs a callback that fires
  // immediately, which is why none of them saw this.
  const registered: Array<() => void> = []

  beforeEach(() => {
    registered.length = 0
    vi.useFakeTimers()
    audioClock.load.mockResolvedValue(true)
    audioClock.start.mockResolvedValue(true)
    audioClock.unlock.mockResolvedValue(true)
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(
      true,
    )
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(
      1080,
    )
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(
      async () => {},
    )
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    Object.defineProperty(
      HTMLVideoElement.prototype,
      'requestVideoFrameCallback',
      {
        configurable: true,
        value: function registerAndNeverFire(cb: () => void) {
          registered.push(cb)
          return registered.length
        },
      },
    )
  })

  afterEach(() => {
    delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>)
      .requestVideoFrameCallback
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const begin = async (): Promise<HTMLVideoElement> => {
    render(() => (
      <CinematicOnboardingDirector
        media={mediaManifest()}
        bSideOptions={B_SIDE_OPTIONS}
        onSavePlan={async () => ({ ok: true })}
        onSetReminder={async () => ({ ok: true, message: 'ok' })}
        onSkipReminder={() => undefined}
        onComplete={() => undefined}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    await flush()
    const video = document.querySelector('video')
    expect(video).not.toBeNull()
    fireEvent.play(video!)
    fireEvent.loadedData(video!)
    fireEvent.playing(video!)
    await flush()
    return video!
  }

  const surface = (video: HTMLVideoElement): Element =>
    video.closest('.cinematic-onboarding__media') ?? video

  it('registers the frame callback, and does not depend on it firing', async () => {
    const video = await begin()
    expect(registered.length).toBeGreaterThan(0)

    // Before the grace runs out, the reveal is still the callback's to
    // make -- nothing here is trying to pre-empt a real frame.
    expect(
      surface(video).classList.contains(
        'cinematic-onboarding__media--revealed',
      ),
    ).toBe(false)

    await vi.advanceTimersByTimeAsync(2000)
    await flush()

    // ...and after it, the picture is on screen anyway. A still is a far
    // better failure than a void.
    expect(
      surface(video).classList.contains(
        'cinematic-onboarding__media--revealed',
      ),
    ).toBe(true)
  })

  it('still shows the caption, so the intro is readable either way', async () => {
    await begin()
    await vi.advanceTimersByTimeAsync(2000)
    await flush()
    expect(screen.getByText('Hi there, I am Corky.')).toBeVisible()
  })
})
