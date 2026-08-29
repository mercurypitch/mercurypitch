// ============================================================
// V2OnboardingDirector tests — native flow, gates and write policy
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioSession, AudioSessionCue, AudioSessionFinishResult, AudioSessionScope, } from '@/audio'
import type { ContentPack, PullOption } from '@/content'
import { DEFAULT_CONTENT_PACK, pullOptions } from '@/content'
import type { V2OnboardingDirectorProps, V2OnboardingMutationResult, } from './V2OnboardingDirector'
import { V2OnboardingDirector } from './V2OnboardingDirector'
import styles from './V2OnboardingDirector.module.css'

function settledCue(assetId: string): AudioSessionCue {
  const result = { kind: 'silent', reason: 'asset-missing' } as const
  return {
    requestId: 1,
    assetId,
    started: Promise.resolve(result),
    finished: Promise.resolve(result),
    stop: () => false,
  }
}

interface TestDeferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
}

function deferred<T>(): TestDeferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

function controlledCue(assetId: string): {
  readonly cue: AudioSessionCue
  readonly finished: TestDeferred<AudioSessionFinishResult>
} {
  const finished = deferred<AudioSessionFinishResult>()
  return {
    cue: {
      requestId: 101,
      assetId,
      started: Promise.resolve({ kind: 'started' }),
      finished: finished.promise,
      stop: () => false,
    },
    finished,
  }
}

function contentPackWithDialogue(
  lineId: string,
  assetId = `dialogue.${lineId}`,
): ContentPack {
  const line = DEFAULT_CONTENT_PACK.lines.find(
    (candidate) => candidate.id === lineId,
  )
  if (line?.captionSha256 === undefined) {
    throw new Error(`${lineId} must carry a caption hash.`)
  }
  return {
    ...DEFAULT_CONTENT_PACK,
    audio: {
      schemaVersion: 1,
      revision: `director-timing-${lineId}`,
      locale: 'en',
      assets: [
        {
          id: assetId,
          lane: 'dialogue',
          playback: { kind: 'one-shot' },
          dialogue: { lineId, captionSha256: line.captionSha256 },
          sources: [
            {
              src: `audio/test/${lineId}.mp3`,
              mimeType: 'audio/mpeg',
              sha256: '0'.repeat(64),
              byteLength: 1,
              durationMs: 1,
              sampleRateHz: 44_100,
              channels: 1,
            },
          ],
        },
      ],
    },
  }
}

function createAudioProbe(): {
  readonly session: AudioSession
  readonly createScope: ReturnType<typeof vi.fn>
  readonly unlock: ReturnType<typeof vi.fn>
  readonly setMuted: ReturnType<typeof vi.fn>
  readonly play: ReturnType<typeof vi.fn>
  readonly stopLane: ReturnType<typeof vi.fn>
  readonly disposeScope: ReturnType<typeof vi.fn>
} {
  const play = vi.fn((assetId: string) => settledCue(assetId))
  const stopLane = vi.fn()
  const disposeScope = vi.fn()
  const scope: AudioSessionScope = {
    owner: 'v2-onboarding',
    play,
    stopLane,
    stopAll: vi.fn(),
    dispose: disposeScope,
  }
  const createScope = vi.fn(() => scope)
  const unlock = vi.fn(async () => true)
  const setMuted = vi.fn()
  return {
    session: {
      createScope,
      unlock,
      setMuted,
      setForeground: vi.fn(),
      dispose: vi.fn(),
    },
    createScope,
    unlock,
    setMuted,
    play,
    stopLane,
    disposeScope,
  }
}

interface DirectorProbe {
  readonly props: V2OnboardingDirectorProps
  readonly onSavePlan: ReturnType<typeof vi.fn>
  readonly onSetReminder: ReturnType<typeof vi.fn>
  readonly onComplete: ReturnType<typeof vi.fn>
  readonly onMutedChange: ReturnType<typeof vi.fn>
  readonly audio: ReturnType<typeof createAudioProbe>
}

function createDirectorProbe(
  sessionKind: V2OnboardingDirectorProps['sessionKind'] = 'first-run',
  mutationResult: V2OnboardingMutationResult = { ok: true },
): DirectorProbe {
  const audio = createAudioProbe()
  const onSavePlan = vi.fn(async () => mutationResult)
  const onSetReminder = vi.fn(async () => mutationResult)
  const onComplete = vi.fn()
  const onMutedChange = vi.fn()
  return {
    props: {
      sessionKind,
      pullOptions,
      contentPack: DEFAULT_CONTENT_PACK,
      audioSession: audio.session,
      foreground: true,
      muted: false,
      onMutedChange,
      reminderPresets: [
        { id: 'morning', label: 'Morning', localTime: '08:30' },
        { id: 'evening', label: 'Evening', localTime: '20:30' },
      ],
      onSavePlan,
      onSetReminder,
      onComplete,
    },
    onSavePlan,
    onSetReminder,
    onComplete,
    onMutedChange,
    audio,
  }
}

function renderWithControlledDialogue(
  lineId: string,
  sessionKind: V2OnboardingDirectorProps['sessionKind'] = 'first-run',
): {
  readonly probe: DirectorProbe
  readonly finished: TestDeferred<AudioSessionFinishResult>
  readonly setForeground: (foreground: boolean) => void
} {
  const assetId = `dialogue.${lineId}`
  const controlled = controlledCue(assetId)
  const probe = createDirectorProbe(sessionKind)
  probe.audio.play.mockImplementation((playedAssetId: string) =>
    playedAssetId === assetId ? controlled.cue : settledCue(playedAssetId),
  )
  const [foreground, setForeground] = createSignal(true)
  render(() => (
    <V2OnboardingDirector
      {...probe.props}
      contentPack={contentPackWithDialogue(lineId, assetId)}
      foreground={foreground()}
    />
  ))
  return { probe, finished: controlled.finished, setForeground }
}

async function advance(milliseconds: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(milliseconds)
  await Promise.resolve()
}

async function reachPullChoice(): Promise<void> {
  await advance(1_300)
  fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
  await advance(2_300)
  expect(
    screen.getByRole('heading', {
      name: 'Which Pull do you want to notice sooner?',
    }),
  ).toBeVisible()
}

async function reachStopHold(): Promise<void> {
  await reachPullChoice()
  fireEvent.click(screen.getByRole('radio', { name: 'Endless scrolling' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await advance(1_450)
  fireEvent.click(screen.getByRole('radio', { name: /Not sure yet/u }))
  fireEvent.click(screen.getByRole('button', { name: 'Choose Side B' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Play one guitar riff.' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start the record' }))
  await advance(2_400)
  expect(screen.getByRole('heading', { name: 'Let it spin.' })).toBeVisible()
  expect(screen.getByText('Let it spin for a moment.')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Stop and save' }),
  ).not.toBeInTheDocument()
  await advance(1_799)
  expect(
    screen.queryByRole('button', { name: 'Stop and save' }),
  ).not.toBeInTheDocument()
  await advance(1)
  expect(screen.getByRole('button', { name: 'Stop and save' })).toBeVisible()
}

describe('V2OnboardingDirector', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reveals the brand before one sound-enabled begin action', async () => {
    const probe = createDirectorProbe()
    const view = render(() => <V2OnboardingDirector {...probe.props} />)

    const openingHeading = screen.getByRole('heading', { name: 'Beside Cue' })
    expect(openingHeading).toBeVisible()
    expect(openingHeading.closest('section')).toHaveClass(styles.stageBrand)
    expect(
      screen.queryByRole('button', { name: 'Tap to begin' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', {
        name: 'Onboarding review controls',
      }),
    ).not.toBeInTheDocument()

    await advance(1_300)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    expect(probe.audio.unlock).toHaveBeenCalledTimes(1)
    expect(probe.audio.createScope).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Mute audio' }))
    expect(probe.onMutedChange).toHaveBeenCalledWith(true)

    view.unmount()
    expect(probe.audio.disposeScope).toHaveBeenCalledTimes(1)
  })

  it('waits for the visual dwell when automatic dialogue finishes first', async () => {
    const { finished } = renderWithControlledDialogue(
      'corky.onboarding.greeting',
    )

    await advance(1_300)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    finished.resolve({ kind: 'ended' })
    await Promise.resolve()

    await advance(1_549)
    expect(screen.getByRole('heading', { name: 'Meet Corky.' })).toBeVisible()
    await advance(1)
    expect(
      screen.getByRole('heading', { name: 'Let’s make one plan.' }),
    ).toBeVisible()
  })

  it('waits for automatic dialogue when the visual dwell finishes first', async () => {
    const { finished } = renderWithControlledDialogue(
      'corky.onboarding.greeting',
    )

    await advance(1_300)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    await advance(1_550)
    expect(screen.getByRole('heading', { name: 'Meet Corky.' })).toBeVisible()

    finished.resolve({ kind: 'ended' })
    await Promise.resolve()
    expect(
      screen.getByRole('heading', { name: 'Let’s make one plan.' }),
    ).toBeVisible()
  })

  it.each([
    [
      'asset-missing silence',
      { kind: 'silent', reason: 'asset-missing' } as const,
    ],
    ['muted silence', { kind: 'silent', reason: 'muted' } as const],
    ['failed playback', { kind: 'failed' } as const],
  ])('keeps the ordinary dwell after %s', async (_label, result) => {
    const { finished } = renderWithControlledDialogue(
      'corky.onboarding.greeting',
    )

    await advance(1_300)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    finished.resolve(result)
    await Promise.resolve()
    await advance(1_549)
    expect(screen.getByRole('heading', { name: 'Meet Corky.' })).toBeVisible()
    await advance(1)
    expect(
      screen.getByRole('heading', { name: 'Let’s make one plan.' }),
    ).toBeVisible()
  })

  it('keeps the ordinary dwell when dialogue completion rejects', async () => {
    const { finished } = renderWithControlledDialogue(
      'corky.onboarding.greeting',
    )

    await advance(1_300)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    finished.reject(new Error('output failed'))
    await Promise.resolve()
    await advance(1_549)
    expect(screen.getByRole('heading', { name: 'Meet Corky.' })).toBeVisible()
    await advance(1)
    expect(
      screen.getByRole('heading', { name: 'Let’s make one plan.' }),
    ).toBeVisible()
  })

  it('uses a bounded safety timeout for dialogue that never settles', async () => {
    renderWithControlledDialogue('corky.onboarding.greeting')

    await advance(1_300)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    await advance(14_999)
    expect(screen.getByRole('heading', { name: 'Meet Corky.' })).toBeVisible()
    await advance(1)
    expect(
      screen.getByRole('heading', { name: 'Let’s make one plan.' }),
    ).toBeVisible()
  })

  it('pauses an automatic scene while backgrounded without replaying dialogue', async () => {
    const { probe, finished, setForeground } = renderWithControlledDialogue(
      'corky.onboarding.greeting',
    )

    await advance(1_300)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    await advance(500)
    setForeground(false)
    finished.resolve({ kind: 'stopped', reason: 'backgrounded' })
    await Promise.resolve()
    await advance(20_000)

    expect(screen.getByRole('heading', { name: 'Meet Corky.' })).toBeVisible()
    setForeground(true)
    await advance(1_049)
    expect(screen.getByRole('heading', { name: 'Meet Corky.' })).toBeVisible()
    await advance(1)
    expect(
      screen.getByRole('heading', { name: 'Let’s make one plan.' }),
    ).toBeVisible()
    expect(probe.audio.play).toHaveBeenCalledTimes(1)
  })

  it('defers a ready automatic scene until it returns to the foreground', async () => {
    const { finished, setForeground } = renderWithControlledDialogue(
      'corky.onboarding.greeting',
    )

    await advance(1_300)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    await advance(1_550)
    setForeground(false)
    finished.resolve({ kind: 'stopped', reason: 'backgrounded' })
    await Promise.resolve()
    expect(screen.getByRole('heading', { name: 'Meet Corky.' })).toBeVisible()

    setForeground(true)
    await Promise.resolve()
    expect(
      screen.getByRole('heading', { name: 'Let’s make one plan.' }),
    ).toBeVisible()
  })

  it('counts the dialogue safety timeout in foreground time only', async () => {
    const { setForeground } = renderWithControlledDialogue(
      'corky.onboarding.greeting',
    )

    await advance(1_300)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    await advance(5_000)
    setForeground(false)
    await advance(20_000)
    expect(screen.getByRole('heading', { name: 'Meet Corky.' })).toBeVisible()

    setForeground(true)
    await advance(9_999)
    expect(screen.getByRole('heading', { name: 'Meet Corky.' })).toBeVisible()
    await advance(1)
    expect(
      screen.getByRole('heading', { name: 'Let’s make one plan.' }),
    ).toBeVisible()
  })

  it('ignores a stale dialogue finish after developer navigation', async () => {
    const { finished } = renderWithControlledDialogue(
      'corky.onboarding.greeting',
      'developer-review',
    )
    const next = screen.getByRole('button', { name: 'Next scene' })

    fireEvent.click(next)
    fireEvent.click(next)
    expect(screen.getByRole('heading', { name: 'Meet Corky.' })).toBeVisible()
    fireEvent.click(next)
    expect(
      screen.getByRole('heading', { name: 'Let’s make one plan.' }),
    ).toBeVisible()

    finished.resolve({ kind: 'ended' })
    await Promise.resolve()
    expect(
      screen.getByRole('heading', { name: 'Let’s make one plan.' }),
    ).toBeVisible()
  })

  it('does not let reduced motion truncate automatic dialogue', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
    const { finished } = renderWithControlledDialogue(
      'corky.onboarding.greeting',
    )

    await advance(650)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    await advance(650)
    expect(screen.getByRole('heading', { name: 'Meet Corky.' })).toBeVisible()
    finished.resolve({ kind: 'ended' })
    await Promise.resolve()
    expect(
      screen.getByRole('heading', { name: 'Let’s make one plan.' }),
    ).toBeVisible()
  })

  it('never auto-advances a decision hold with unfinished dialogue', async () => {
    renderWithControlledDialogue('corky.onboarding.pull-choice')

    await reachPullChoice()
    await advance(15_001)
    expect(
      screen.getByRole('heading', {
        name: 'Which Pull do you want to notice sooner?',
      }),
    ).toBeVisible()
  })

  it('preserves the remaining record-spin gate while backgrounded', async () => {
    const probe = createDirectorProbe()
    const [foreground, setForeground] = createSignal(true)
    render(() => (
      <V2OnboardingDirector {...probe.props} foreground={foreground()} />
    ))

    await reachPullChoice()
    fireEvent.click(screen.getByRole('radio', { name: 'Endless scrolling' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await advance(1_450)
    fireEvent.click(screen.getByRole('radio', { name: /Not sure yet/u }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose Side B' }))
    fireEvent.click(
      screen.getByRole('radio', { name: 'Play one guitar riff.' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start the record' }))
    await advance(2_400)
    expect(screen.getByRole('heading', { name: 'Let it spin.' })).toBeVisible()

    await advance(600)
    setForeground(false)
    await advance(20_000)
    expect(screen.getByRole('heading', { name: 'Let it spin.' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Stop and save' }),
    ).not.toBeInTheDocument()

    setForeground(true)
    await advance(1_199)
    expect(
      screen.queryByRole('button', { name: 'Stop and save' }),
    ).not.toBeInTheDocument()
    await advance(1)
    expect(screen.getByRole('button', { name: 'Stop and save' })).toBeVisible()
  })

  it('renders controlled muted truth on the first frame', () => {
    const probe = createDirectorProbe('replay')
    render(() => <V2OnboardingDirector {...probe.props} muted={true} />)

    const button = screen.getByRole('button', { name: 'Unmute audio' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button)
    expect(probe.onMutedChange).toHaveBeenCalledWith(false)
  })

  it('invalidates stale built-in choices when each custom path is opened', async () => {
    const probe = createDirectorProbe()
    render(() => <V2OnboardingDirector {...probe.props} />)

    await reachPullChoice()
    const pullRadios = screen.getAllByRole('radio')
    expect(pullRadios.every((radio) => radio.tagName === 'INPUT')).toBe(true)
    expect(
      pullRadios.every((radio) => radio.getAttribute('name') === 'v2-pull'),
    ).toBe(true)

    fireEvent.click(screen.getByRole('radio', { name: 'Endless scrolling' }))
    expect(
      screen.getByText(
        DEFAULT_CONTENT_PACK.lines.find(
          (line) => line.id === 'pull.scrolling.meet',
        )?.text ?? '',
      ),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('radio', { name: 'Something else' }))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(screen.queryByText(/I’m The Scroll/u)).not.toBeInTheDocument()
    fireEvent.input(screen.getByRole('textbox', { name: 'Your Pull' }), {
      target: { value: 'Opening the feed again' },
    })
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await advance(1_450)
    fireEvent.click(screen.getByRole('radio', { name: /Not sure yet/u }))
    expect(screen.getByRole('button', { name: 'Choose Side B' })).toBeEnabled()
    fireEvent.click(screen.getByRole('radio', { name: 'Write my own' }))
    expect(screen.getByRole('button', { name: 'Choose Side B' })).toBeDisabled()
    fireEvent.input(screen.getByRole('textbox', { name: 'Your cue' }), {
      target: { value: 'When I sit down after lunch' },
    })
    expect(screen.getByRole('button', { name: 'Choose Side B' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Choose Side B' }))

    fireEvent.click(screen.getAllByRole('radio')[0]!)
    expect(
      screen.getByRole('button', { name: 'Start the record' }),
    ).toBeEnabled()
    fireEvent.click(screen.getByRole('radio', { name: 'Write my own' }))
    expect(
      screen.getByRole('button', { name: 'Start the record' }),
    ).toBeDisabled()
    fireEvent.input(screen.getByRole('textbox', { name: 'Your Side B' }), {
      target: { value: 'Open the book' },
    })
    expect(
      screen.getByRole('button', { name: 'Start the record' }),
    ).toBeEnabled()
  })

  it('stops an earlier Pull voice when the next Pull has no recording', async () => {
    const line = DEFAULT_CONTENT_PACK.lines.find(
      (candidate) => candidate.id === 'pull.scrolling.meet',
    )
    if (line?.captionSha256 === undefined) {
      throw new Error('Scrolling preview line must carry a caption hash.')
    }
    const contentPack: ContentPack = {
      ...DEFAULT_CONTENT_PACK,
      audio: {
        schemaVersion: 1,
        revision: 'director-mixed-preview-test',
        locale: 'en',
        assets: [
          {
            id: 'dialogue.pull.scrolling.meet',
            lane: 'dialogue',
            playback: { kind: 'one-shot' },
            dialogue: {
              lineId: line.id,
              captionSha256: line.captionSha256,
            },
            sources: [
              {
                src: 'audio/test/scrolling-meet.mp3',
                mimeType: 'audio/mpeg',
                sha256: '0'.repeat(64),
                byteLength: 1,
                durationMs: 1,
                sampleRateHz: 44_100,
                channels: 1,
              },
            ],
          },
        ],
      },
    }
    const probe = createDirectorProbe()
    render(() => (
      <V2OnboardingDirector {...probe.props} contentPack={contentPack} />
    ))

    await reachPullChoice()
    fireEvent.click(screen.getByRole('radio', { name: 'Endless scrolling' }))
    expect(probe.audio.play).toHaveBeenCalledWith(
      'dialogue.pull.scrolling.meet',
    )

    const dialogueStopCount = () =>
      probe.audio.stopLane.mock.calls.filter(([lane]) => lane === 'dialogue')
        .length
    const stopsBeforeMissingPull = dialogueStopCount()
    fireEvent.click(screen.getByRole('radio', { name: 'Automatic snacking' }))
    expect(probe.audio.play).toHaveBeenCalledTimes(1)
    expect(dialogueStopCount()).toBe(stopsBeforeMissingPull + 1)

    const stopsBeforeCustomPull = dialogueStopCount()
    fireEvent.click(screen.getByRole('radio', { name: 'Something else' }))
    expect(dialogueStopCount()).toBe(stopsBeforeCustomPull + 1)

    const stopsBeforeCustomTyping = dialogueStopCount()
    fireEvent.input(screen.getByRole('textbox', { name: 'Your Pull' }), {
      target: { value: 'Opening another feed' },
    })
    expect(dialogueStopCount()).toBe(stopsBeforeCustomTyping)

    const stopsBeforePhaseChange = dialogueStopCount()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(dialogueStopCount()).toBe(stopsBeforePhaseChange + 1)
  })

  it('keeps a custom Pull free of the first built-in mapping', async () => {
    const probe = createDirectorProbe()
    render(() => <V2OnboardingDirector {...probe.props} />)

    await reachPullChoice()
    fireEvent.click(screen.getByRole('radio', { name: 'Something else' }))
    fireEvent.input(screen.getByRole('textbox', { name: 'Your Pull' }), {
      target: { value: 'Opening another shopping tab' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await advance(1_450)

    expect(
      screen.queryByRole('radio', {
        name: 'When I open the feed without deciding to.',
      }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Not sure yet/u }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose Side B' }))
    expect(
      screen.queryByRole('radio', { name: 'Play one guitar riff.' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: 'Step outside for three minutes.' }),
    ).toBeVisible()
  })

  it('clears downstream radio state when an earlier choice is reconfirmed', async () => {
    const probe = createDirectorProbe()
    render(() => <V2OnboardingDirector {...probe.props} />)

    await reachPullChoice()
    fireEvent.click(screen.getByRole('radio', { name: 'Endless scrolling' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await advance(1_450)
    fireEvent.click(screen.getByRole('radio', { name: /Not sure yet/u }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose Side B' }))
    const sideB = screen.getByRole('radio', { name: 'Play one guitar riff.' })
    fireEvent.click(sideB)
    expect(sideB).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose Side B' }))
    const resetSideB = screen.getByRole('radio', {
      name: 'Play one guitar riff.',
    })
    expect(resetSideB).not.toBeChecked()
    expect(
      screen.getByRole('button', { name: 'Start the record' }),
    ).toBeDisabled()
    fireEvent.click(resetSideB)

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    const context = screen.getByRole('radio', {
      name: 'When I open the feed without deciding to.',
    })
    fireEvent.click(context)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await advance(1_450)
    const resetContext = screen.getByRole('radio', {
      name: 'When I open the feed without deciding to.',
    })
    expect(resetContext).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Choose Side B' })).toBeDisabled()
    fireEvent.click(resetContext)
    expect(screen.getByRole('button', { name: 'Choose Side B' })).toBeEnabled()
  })

  it('saves the exact visible plan only after the 1.8 second spin gate', async () => {
    const probe = createDirectorProbe()
    render(() => <V2OnboardingDirector {...probe.props} />)

    await reachStopHold()
    expect(
      document.querySelector('[data-record-spinning="true"]'),
    ).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Stop and save' }))
    await Promise.resolve()
    await Promise.resolve()

    expect(probe.onSavePlan).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-record-spinning="true"]')).toBeNull()
    expect(probe.onSavePlan).toHaveBeenCalledWith({
      pullId: 'scrolling',
      pullLabel: 'Endless scrolling',
      sideAText: 'Keep scrolling',
      bSideSuggestionId: 'bside.guitar-riff',
      bSideText: 'Play one guitar riff.',
    })

    await advance(950)
    fireEvent.click(screen.getByRole('radio', { name: /Evening/u }))
    const reminderButton = screen.getByRole('button', { name: 'Set reminder' })
    expect(reminderButton).toBeEnabled()
    fireEvent.input(screen.getByLabelText('Choose a time'), {
      target: { value: '' },
    })
    expect(reminderButton).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: /Evening/u }))
    fireEvent.click(reminderButton)
    await Promise.resolve()
    await Promise.resolve()
    expect(probe.onSetReminder).toHaveBeenCalledWith('20:30')

    await advance(1_300)
    expect(probe.onComplete).toHaveBeenCalledTimes(1)
  })

  it('keeps replay sessions write-free while preserving the whole journey', async () => {
    const probe = createDirectorProbe('replay')
    render(() => <V2OnboardingDirector {...probe.props} />)

    await reachStopHold()
    fireEvent.click(screen.getByRole('button', { name: 'Stop and save' }))
    await Promise.resolve()

    expect(probe.onSavePlan).not.toHaveBeenCalled()
    await advance(950)
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    await advance(1_300)
    expect(probe.onSetReminder).not.toHaveBeenCalled()
    expect(probe.onComplete).toHaveBeenCalledTimes(1)
  })

  it('lets a replay return immediately without invoking persistence', async () => {
    const probe = createDirectorProbe('replay')
    render(() => <V2OnboardingDirector {...probe.props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Return to settings' }))
    await Promise.resolve()

    expect(probe.onComplete).toHaveBeenCalledTimes(1)
    expect(probe.onSavePlan).not.toHaveBeenCalled()
    expect(probe.onSetReminder).not.toHaveBeenCalled()
  })

  it('shows scene navigation only in developer review and never completes it', async () => {
    const probe = createDirectorProbe('developer-review')
    render(() => <V2OnboardingDirector {...probe.props} />)

    const review = screen.getByRole('navigation', {
      name: 'Onboarding review controls',
    })
    expect(review).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Next scene' }))
    expect(screen.getByText('B00_BEGIN_HOLD')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Previous scene' }))
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }))
    await advance(1_300)
    expect(probe.onSavePlan).not.toHaveBeenCalled()
    expect(probe.onSetReminder).not.toHaveBeenCalled()
    expect(probe.onComplete).not.toHaveBeenCalled()
  })

  it('clears local choices when developer review replays', () => {
    const probe = createDirectorProbe('developer-review')
    render(() => <V2OnboardingDirector {...probe.props} />)

    const next = screen.getByRole('button', { name: 'Next scene' })
    fireEvent.click(next)
    fireEvent.click(next)
    fireEvent.click(next)
    fireEvent.click(next)
    const pull = screen.getByRole('radio', { name: 'Endless scrolling' })
    fireEvent.click(pull)
    expect(pull).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Replay' }))
    fireEvent.click(next)
    fireEvent.click(next)
    fireEvent.click(next)
    fireEvent.click(next)
    expect(
      screen.getByRole('radio', { name: 'Endless scrolling' }),
    ).not.toBeChecked()
  })

  it('uses a 1.5 second static dwell when reduced motion is requested', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
    const probe = createDirectorProbe()
    render(() => <V2OnboardingDirector {...probe.props} />)

    await advance(650)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    await advance(1_300)
    fireEvent.click(screen.getByRole('radio', { name: 'Endless scrolling' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await advance(650)
    fireEvent.click(screen.getByRole('radio', { name: /Not sure yet/u }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose Side B' }))
    fireEvent.click(
      screen.getByRole('radio', { name: 'Play one guitar riff.' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start the record' }))
    await advance(1_300)
    expect(screen.getByRole('heading', { name: 'Let it spin.' })).toBeVisible()
    await advance(1_499)
    expect(
      screen.queryByRole('button', { name: 'Stop and save' }),
    ).not.toBeInTheDocument()
    await advance(1)
    expect(screen.getByRole('button', { name: 'Stop and save' })).toBeVisible()
  })

  it('persists injected string-only Side B choices without an invented id', async () => {
    const legacyPull: PullOption = {
      id: 'legacy-pull',
      label: 'Legacy Pull',
      moment: 'A configuration supplied by an older build.',
      defaultSideAText: 'Follow the old pattern',
      anchorSuggestions: [],
      suggestions: ['Open the window.'],
    }
    const probe = createDirectorProbe()
    const props: V2OnboardingDirectorProps = {
      ...probe.props,
      pullOptions: [legacyPull],
    }
    render(() => <V2OnboardingDirector {...props} />)

    await reachPullChoice()
    fireEvent.click(screen.getByRole('radio', { name: 'Legacy Pull' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await advance(1_450)
    fireEvent.click(screen.getByRole('radio', { name: /Not sure yet/u }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose Side B' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Open the window.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start the record' }))
    await advance(2_400 + 1_800)
    fireEvent.click(screen.getByRole('button', { name: 'Stop and save' }))
    await Promise.resolve()

    expect(probe.onSavePlan).toHaveBeenCalledWith({
      pullId: 'legacy-pull',
      pullLabel: 'Legacy Pull',
      sideAText: 'Follow the old pattern',
      bSideText: 'Open the window.',
    })
  })
})
