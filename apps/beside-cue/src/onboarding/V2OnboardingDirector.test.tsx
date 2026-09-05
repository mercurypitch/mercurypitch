// ============================================================
// V2OnboardingDirector tests — native flow, gates and write policy
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createEffect, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioSession, AudioSessionCue, AudioSessionFinishResult, AudioSessionScope, } from '@/audio'
import type { ContentPack, PullOption } from '@/content'
import { DEFAULT_CONTENT_PACK, pullOptions, V2_ONBOARDING_AUDIO_ASSET_IDS, } from '@/content'
import { getLocalizedContentPack } from '@/content/localized-pack'
import { LocaleProvider } from '@/i18n/context'
import type { AppLocale } from '@/i18n/locale'
import { V2_ONBOARDING_MEDIA_PACK } from './v2-onboarding-media-pack'
import type { V2OnboardingDirectorProps, V2OnboardingMutationResult, } from './V2OnboardingDirector'
import { V2OnboardingDirector } from './V2OnboardingDirector'
import styles from './V2OnboardingDirector.module.css'
import type { V2OnboardingMediaStageProps } from './V2OnboardingMediaStage'
import type { V2OnboardingPlatterPreviewProps } from './V2OnboardingPlatterPreview'

const mediaStageHarness = vi.hoisted(() => ({
  props: undefined as
    | Pick<
        V2OnboardingMediaStageProps,
        | 'request'
        | 'mode'
        | 'foreground'
        | 'transitionDurationMs'
        | 'onPresentationSettled'
        | 'onVideoEnded'
      >
    | undefined,
}))

const platterHarness = vi.hoisted(() => ({
  props: undefined as
    | Pick<
        V2OnboardingPlatterPreviewProps,
        | 'base'
        | 'phase'
        | 'token'
        | 'foreground'
        | 'reducedMotion'
        | 'onStopped'
      >
    | undefined,
}))

vi.mock('./V2OnboardingMediaStage', () => ({
  V2OnboardingMediaStage: (props: V2OnboardingMediaStageProps) => {
    createEffect(() => {
      mediaStageHarness.props = {
        request: props.request,
        mode: props.mode,
        foreground: props.foreground,
        transitionDurationMs: props.transitionDurationMs,
        onPresentationSettled: props.onPresentationSettled,
        onVideoEnded: props.onVideoEnded,
      }
    })
    return (
      <div
        data-testid="v2-media-stage"
        data-v2-media-target={props.request?.targetId}
        aria-hidden="true"
      />
    )
  },
}))

vi.mock('./V2OnboardingPlatterPreview', () => ({
  V2OnboardingPlatterPreview: (props: V2OnboardingPlatterPreviewProps) => {
    createEffect(() => {
      platterHarness.props = {
        base: props.base,
        phase: props.phase,
        token: props.token,
        foreground: props.foreground,
        reducedMotion: props.reducedMotion,
        onStopped: props.onStopped,
      }
    })
    return (
      <div
        data-v2-platter-preview=""
        data-platter-phase={props.phase}
        data-platter-token={props.token}
        aria-hidden="true"
      />
    )
  },
}))

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
  durationMs = 1,
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
              durationMs,
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
    setGain: vi.fn(),
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
  durationMs = 1,
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
      contentPack={contentPackWithDialogue(lineId, assetId, durationMs)}
      foreground={foreground()}
    />
  ))
  return { probe, finished: controlled.finished, setForeground }
}

async function advance(milliseconds: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(milliseconds)
  await Promise.resolve()
}

function currentMediaStage(): {
  readonly props: NonNullable<(typeof mediaStageHarness)['props']>
  readonly targetId: string
} {
  const props = mediaStageHarness.props
  const targetId = props?.request?.targetId
  if (props === undefined || targetId === undefined) {
    throw new Error('Expected an active V2 onboarding media stage.')
  }
  return { props, targetId }
}

function settleCurrentMedia(
  token: string,
  recoveryStage: 'primary' | 'reduced-still' = 'primary',
): void {
  const { props, targetId } = currentMediaStage()
  props.onPresentationSettled?.({ targetId, token, recoveryStage })
}

function endCurrentMedia(token: string): void {
  const { props, targetId } = currentMediaStage()
  props.onVideoEnded?.({ targetId, token })
}

function finishCurrentPlatterStop(): void {
  const props = platterHarness.props
  if (props === undefined || props.phase !== 'stopping') {
    throw new Error('Expected a stopping V2 platter preview.')
  }
  props.onStopped(props.token)
}

async function reachPullChoice(): Promise<void> {
  await advance(1_300)
  fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
  if (mediaStageHarness.props?.request?.targetId === 'intro:b01') {
    settleCurrentMedia('intro-b01-token')
    endCurrentMedia('intro-b01-token')
    await advance(1_550)
  } else {
    await advance(1_550)
  }
  expect(
    screen.getByRole('heading', {
      name: 'Choose your Pull',
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
    screen.queryByRole('button', { name: 'Stop and save plan' }),
  ).not.toBeInTheDocument()
  await advance(1_799)
  expect(
    screen.queryByRole('button', { name: 'Stop and save plan' }),
  ).not.toBeInTheDocument()
  await advance(1)
  expect(
    screen.getByRole('button', { name: 'Stop and save plan' }),
  ).toHaveTextContent('Stop the record')
}

async function reachRecordStartWithMedia(): Promise<void> {
  await reachPullChoice()
  fireEvent.click(screen.getByRole('radio', { name: 'Endless scrolling' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  settleCurrentMedia('scrolling-present-token')
  endCurrentMedia('scrolling-present-token')
  await advance(1_450)
  fireEvent.click(screen.getByRole('radio', { name: /Not sure yet/u }))
  fireEvent.click(screen.getByRole('button', { name: 'Choose Side B' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Play one guitar riff.' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start the record' }))
  settleCurrentMedia('scrolling-recede-token')
  endCurrentMedia('scrolling-recede-token')
  await advance(1_150)

  expect(
    screen.getByRole('heading', { name: 'Corky starts the record.' }),
  ).toBeVisible()
  expect(currentMediaStage().targetId).toBe('record:start')
}

async function enterRecordSpinWithMedia(): Promise<void> {
  await reachRecordStartWithMedia()
  await advance(1_250)
  settleCurrentMedia('record-start-token')
  expect(
    screen.getByRole('heading', { name: 'Corky starts the record.' }),
  ).toBeVisible()
  endCurrentMedia('record-start-token')

  expect(screen.getByRole('heading', { name: 'Let it spin.' })).toBeVisible()
  expect(currentMediaStage().targetId).toBe('record:spin')
}

function currentRecordMediaLayer(): HTMLElement {
  const layer = screen
    .getByTestId('v2-media-stage')
    .closest<HTMLElement>(`.${styles.recordMediaLayer}`)
  if (layer === null) throw new Error('Expected a V2 record media layer.')
  return layer
}

describe('V2OnboardingDirector', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mediaStageHarness.props = undefined
    platterHarness.props = undefined
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

  it('locks premium previews until Pro is active, then clears an expired uncommitted selection', async () => {
    const probe = createDirectorProbe()
    const [isPro, setPro] = createSignal(false)
    const view = render(() => (
      <V2OnboardingDirector
        {...probe.props}
        isPro={isPro()}
        mediaPack={V2_ONBOARDING_MEDIA_PACK}
      />
    ))
    await reachPullChoice()
    fireEvent.click(screen.getByText('Show premium'))
    await advance(1)
    const tape = screen.getByRole('radio', { name: 'Another quick fix' })
    expect(tape).toBeDisabled()
    // The shelf now contains real packaged premium recordings. Revealing a
    // locked preview must still be silent, including a synthetic click.
    fireEvent.click(tape)
    expect(
      probe.audio.play.mock.calls.some(([assetId]) =>
        String(assetId).startsWith('dialogue.pull.the-'),
      ),
    ).toBe(false)
    expect(
      screen.getByRole('radio', { name: 'Endless scrolling' }),
    ).toBeEnabled()
    setPro(true)
    expect(tape).toBeEnabled()
    fireEvent.click(tape)
    expect(probe.audio.play).toHaveBeenCalledWith('dialogue.pull.the-tape.meet')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(probe.audio.play).toHaveBeenCalledWith(
      'dialogue.pull.the-tape.present',
    )
    expect(currentMediaStage().props.request?.primary?.src).toContain(
      'b03-the-tape-present',
    )
    const dialogueStopCount = () =>
      probe.audio.stopLane.mock.calls.filter(([lane]) => lane === 'dialogue')
        .length
    const stopsBeforeRevocation = dialogueStopCount()
    setPro(false)
    expect(dialogueStopCount()).toBeGreaterThan(stopsBeforeRevocation)
    expect(view.container.querySelector('main')).toHaveAttribute(
      'data-phase',
      'B03_PULL_CHOICE_HOLD',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Pro is no longer active',
    )
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(probe.onSavePlan).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: 'Endless scrolling' }))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
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

  it('offers language on the first-run brand only and updates copy before the tap', async () => {
    const probe = createDirectorProbe()
    const [locale, setLocale] = createSignal<AppLocale>('en')
    render(() => (
      <LocaleProvider locale={locale()} onLocaleChange={setLocale}>
        <V2OnboardingDirector
          {...probe.props}
          contentPack={getLocalizedContentPack(locale())}
        />
      </LocaleProvider>
    ))

    const language = screen.getByRole('combobox', {
      name: 'Choose interface language',
    })
    fireEvent.change(language, { target: { value: 'de' } })
    expect(
      screen.getByRole('combobox', {
        name: 'Sprache der Benutzeroberfläche wählen',
      }),
    ).toHaveValue('de')

    await advance(1_300)
    fireEvent.click(screen.getByRole('button', { name: 'Zum Starten tippen' }))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Lerne Corky kennen.' }),
    ).toBeVisible()
  })

  it('starts Corky dialogue without replacing the app-owned score', async () => {
    const probe = createDirectorProbe()
    render(() => <V2OnboardingDirector {...probe.props} />)

    await advance(1_300)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))

    expect(probe.audio.play).not.toHaveBeenCalledWith(
      V2_ONBOARDING_AUDIO_ASSET_IDS.score,
    )
    expect(probe.audio.play).toHaveBeenCalledWith(
      V2_ONBOARDING_AUDIO_ASSET_IDS.greeting,
    )
    expect(probe.audio.play).not.toHaveBeenCalledWith(
      V2_ONBOARDING_AUDIO_ASSET_IDS.introTableSlide,
    )

    await advance(1_550)
    expect(probe.audio.play).not.toHaveBeenCalledWith(
      V2_ONBOARDING_AUDIO_ASSET_IDS.introTableSlide,
    )
    expect(
      screen.getByRole('heading', {
        name: 'Choose your Pull',
      }),
    ).toBeVisible()
  })

  it('unlocks the app-owned music synchronously before the replay greeting', async () => {
    const probe = createDirectorProbe('replay')
    const calls: string[] = []
    const unlockMusic = vi.fn(() => calls.push('unlock-music'))
    probe.audio.play.mockImplementation((assetId: string) => {
      calls.push(assetId)
      return settledCue(assetId)
    })
    render(() => (
      <V2OnboardingDirector {...probe.props} onUnlockAudio={unlockMusic} />
    ))

    await advance(1_300)
    expect(unlockMusic).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))

    expect(calls[0]).toBe('unlock-music')
    expect(calls).toContain(V2_ONBOARDING_AUDIO_ASSET_IDS.greeting)
    expect(unlockMusic).toHaveBeenCalledOnce()
    expect(probe.audio.unlock).not.toHaveBeenCalled()
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
      screen.getByRole('heading', {
        name: 'Choose your Pull',
      }),
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
      screen.getByRole('heading', {
        name: 'Choose your Pull',
      }),
    ).toBeVisible()
  })

  it('uses the direct-to-P02 V2.5 greeting and skips the duplicate B02 scene', async () => {
    const probe = createDirectorProbe()
    render(() => (
      <V2OnboardingDirector
        {...probe.props}
        mediaPack={V2_ONBOARDING_MEDIA_PACK}
      />
    ))

    await advance(1_300)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    expect(currentMediaStage()).toMatchObject({ targetId: 'intro:b01' })
    expect(currentMediaStage().props.request?.primary).toMatchObject({
      kind: 'video',
      src: expect.stringContaining('b01-corky-greeting-direct-to-p02-v0_1.mp4'),
    })
    expect(currentMediaStage().props.request?.reducedStill).toMatchObject({
      kind: 'still',
      src: expect.stringContaining('p02-table-ready-v0_17.webp'),
    })
    expect(currentMediaStage().props.transitionDurationMs).toBe(0)
    expect(screen.getByRole('main')).toHaveAttribute('data-layout', 'cinematic')
    expect(screen.getByRole('region', { name: 'Meet Corky.' })).toHaveAttribute(
      'data-v2-scene-surface',
      'full-viewport',
    )

    settleCurrentMedia('intro-b01-token')
    endCurrentMedia('intro-b01-token')
    await advance(1_550)
    expect(
      screen.getByRole('heading', {
        name: 'Choose your Pull',
      }),
    ).toBeVisible()
    expect(screen.getByTestId('v2-media-stage')).toHaveAttribute(
      'data-v2-media-target',
      'plate:p02',
    )
  })

  it('keeps the animated Corky entrance visible until its delayed greeting finishes', async () => {
    const lineId = 'corky.onboarding.greeting'
    const assetId = `dialogue.${lineId}`
    const controlled = controlledCue(assetId)
    const probe = createDirectorProbe()
    probe.audio.play.mockImplementation((playedAssetId: string) =>
      playedAssetId === assetId ? controlled.cue : settledCue(playedAssetId),
    )
    render(() => (
      <V2OnboardingDirector
        {...probe.props}
        contentPack={contentPackWithDialogue(lineId, assetId)}
        mediaPack={V2_ONBOARDING_MEDIA_PACK}
      />
    ))

    await advance(1_300)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    settleCurrentMedia('intro-b01-token')
    endCurrentMedia('intro-b01-token')
    await advance(1_550)

    expect(screen.getByRole('heading', { name: 'Meet Corky.' })).toBeVisible()
    expect(currentMediaStage().targetId).toBe('intro:b01')

    controlled.finished.resolve({ kind: 'ended' })
    await Promise.resolve()

    expect(
      screen.getByRole('heading', {
        name: 'Choose your Pull',
      }),
    ).toBeVisible()
    expect(currentMediaStage().targetId).toBe('plate:p02')
  })

  it('waits for the current Scroll picture, dialogue and dwell across Present and Recede', async () => {
    const lineId = 'pull.scrolling.present'
    const assetId = `dialogue.${lineId}`
    const controlled = controlledCue(assetId)
    const probe = createDirectorProbe()
    probe.audio.play.mockImplementation((playedAssetId: string) =>
      playedAssetId === assetId ? controlled.cue : settledCue(playedAssetId),
    )
    render(() => (
      <V2OnboardingDirector
        {...probe.props}
        contentPack={contentPackWithDialogue(lineId, assetId)}
        mediaPack={V2_ONBOARDING_MEDIA_PACK}
      />
    ))

    await reachPullChoice()
    fireEvent.click(screen.getByRole('radio', { name: 'Endless scrolling' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    const presentStage = currentMediaStage()
    expect(presentStage.props.request?.primary).toMatchObject({
      kind: 'video',
      src: expect.stringContaining('b03-scrolling-present-v0_3.mp4'),
    })
    expect(presentStage.targetId).toContain(':present')
    expect(screen.getByTestId('v2-media-stage')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(
      screen.getByText('I can keep going for you. That’s what I do.'),
    ).toHaveAttribute('aria-live', 'polite')

    await advance(1_450)
    settleCurrentMedia('present-token')
    controlled.finished.resolve({ kind: 'ended' })
    await Promise.resolve()
    expect(
      screen.getByRole('heading', { name: 'Endless scrolling' }),
    ).toBeVisible()

    endCurrentMedia('present-token')
    expect(
      screen.getByRole('heading', {
        name: 'When does it show up?',
      }),
    ).toBeVisible()
    expect(currentMediaStage().targetId).toBe('pull:scrolling:hold')

    fireEvent.click(screen.getByRole('radio', { name: /Not sure yet/u }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose Side B' }))
    expect(currentMediaStage().targetId).toBe('pull:scrolling:hold')
    fireEvent.click(
      screen.getByRole('radio', { name: 'Play one guitar riff.' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start the record' }))

    const recedeStage = currentMediaStage()
    expect(recedeStage.props.request?.primary).toMatchObject({
      kind: 'video',
      src: expect.stringContaining('b05-scrolling-recede-v0_3.mp4'),
    })
    expect(recedeStage.targetId).toContain(':recede')
    await advance(1_150)

    recedeStage.props.onVideoEnded?.({
      targetId: presentStage.targetId,
      token: 'present-token',
    })
    expect(
      screen.getByRole('heading', { name: 'A second side comes into view.' }),
    ).toBeVisible()

    settleCurrentMedia('recede-token')
    endCurrentMedia('recede-token')
    expect(
      screen.getByRole('heading', { name: 'Corky starts the record.' }),
    ).toBeVisible()
  })

  it('gates the full H06 press and starts the spin dwell at the correlated visible frame', async () => {
    const probe = createDirectorProbe()
    render(() => (
      <V2OnboardingDirector
        {...probe.props}
        mediaPack={V2_ONBOARDING_MEDIA_PACK}
      />
    ))

    await reachRecordStartWithMedia()
    expect(currentMediaStage().props.request).toMatchObject({
      targetKind: 'automatic',
      primary: {
        kind: 'video',
        src: expect.stringContaining('b06-corky-starts-record-v0_1.mp4'),
      },
    })
    expect(document.querySelector('[data-v2-platter-preview]')).not.toBeNull()
    expect(platterHarness.props?.phase).toBe('stopped')

    await advance(5_000)
    expect(
      screen.getByRole('heading', { name: 'Corky starts the record.' }),
    ).toBeVisible()
    endCurrentMedia('record-start-token')
    expect(
      screen.getByRole('heading', { name: 'Corky starts the record.' }),
    ).toBeVisible()
    settleCurrentMedia('record-start-token')

    expect(screen.getByRole('heading', { name: 'Let it spin.' })).toBeVisible()
    expect(currentMediaStage()).toMatchObject({ targetId: 'record:spin' })
    expect(currentMediaStage().props.request).toMatchObject({
      targetKind: 'hold',
      primary: {
        kind: 'video',
        src: expect.stringContaining('b06-whole-vinyl-spin-v0_1.mp4'),
      },
    })
    expect(platterHarness.props?.phase).toBe('stopped')
    expect(currentRecordMediaLayer()).not.toHaveClass(
      styles.recordMediaLayerHidden,
    )
    expect(mediaStageHarness.props?.foreground).toBe(true)

    await advance(5_000)
    expect(
      screen.queryByRole('button', { name: 'Stop and save plan' }),
    ).not.toBeInTheDocument()
    expect(platterHarness.props?.phase).toBe('stopped')

    settleCurrentMedia('record-spin-token')
    expect(platterHarness.props?.phase).toBe('stopped')
    await advance(1_799)
    expect(
      screen.queryByRole('button', { name: 'Stop and save plan' }),
    ).not.toBeInTheDocument()
    await advance(1)
    expect(
      screen.getByRole('button', { name: 'Stop and save plan' }),
    ).toBeVisible()

    endCurrentMedia('record-spin-token')
    expect(currentRecordMediaLayer()).toHaveClass(styles.recordMediaLayerHidden)
    expect(mediaStageHarness.props?.foreground).toBe(false)
    expect(platterHarness.props?.phase).toBe('spinning')
  })

  it('retires a live standing-spin overlay on Stop and still waits for the correlated native stop', async () => {
    const probe = createDirectorProbe()
    render(() => (
      <V2OnboardingDirector
        {...probe.props}
        mediaPack={V2_ONBOARDING_MEDIA_PACK}
      />
    ))

    await enterRecordSpinWithMedia()
    expect(currentRecordMediaLayer()).not.toHaveClass(
      styles.recordMediaLayerHidden,
    )
    settleCurrentMedia('record-spin-token')
    expect(platterHarness.props?.phase).toBe('stopped')
    await advance(1_800)
    fireEvent.click(screen.getByRole('button', { name: 'Stop and save plan' }))
    await Promise.resolve()
    await Promise.resolve()

    expect(currentRecordMediaLayer()).toHaveClass(styles.recordMediaLayerHidden)
    expect(mediaStageHarness.props?.foreground).toBe(false)
    expect(platterHarness.props?.phase).toBe('stopping')
    expect(
      screen.getByRole('heading', { name: 'Saving your plan…' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Your plan is saved.' }),
    ).not.toBeInTheDocument()

    finishCurrentPlatterStop()
    expect(
      screen.getByRole('heading', { name: 'Your plan is saved.' }),
    ).toBeVisible()
  })

  it('fails open to the native platter when the standing spin never presents', async () => {
    const probe = createDirectorProbe()
    render(() => (
      <V2OnboardingDirector
        {...probe.props}
        mediaPack={V2_ONBOARDING_MEDIA_PACK}
      />
    ))

    await enterRecordSpinWithMedia()
    await advance(0)
    await advance(7_999)
    expect(currentRecordMediaLayer()).not.toHaveClass(
      styles.recordMediaLayerHidden,
    )
    expect(platterHarness.props?.phase).toBe('stopped')
    expect(
      screen.queryByRole('button', { name: 'Stop and save plan' }),
    ).not.toBeInTheDocument()

    await advance(1)
    expect(currentRecordMediaLayer()).toHaveClass(styles.recordMediaLayerHidden)
    expect(mediaStageHarness.props?.foreground).toBe(false)
    expect(platterHarness.props?.phase).toBe('spinning')
    await advance(1_799)
    expect(
      screen.queryByRole('button', { name: 'Stop and save plan' }),
    ).not.toBeInTheDocument()
    await advance(1)
    expect(
      screen.getByRole('button', { name: 'Stop and save plan' }),
    ).toBeVisible()
  })

  it('retires a presented standing-spin overlay when its end event never arrives', async () => {
    const probe = createDirectorProbe()
    render(() => (
      <V2OnboardingDirector
        {...probe.props}
        mediaPack={V2_ONBOARDING_MEDIA_PACK}
      />
    ))

    await enterRecordSpinWithMedia()
    settleCurrentMedia('record-spin-stalled-token')
    await advance(5_999)
    expect(currentRecordMediaLayer()).not.toHaveClass(
      styles.recordMediaLayerHidden,
    )
    expect(platterHarness.props?.phase).toBe('stopped')

    await advance(1)
    expect(currentRecordMediaLayer()).toHaveClass(styles.recordMediaLayerHidden)
    expect(platterHarness.props?.phase).toBe('spinning')
    expect(
      screen.getByRole('button', { name: 'Stop and save plan' }),
    ).toBeVisible()
  })

  it('counts the standing-spin presentation watchdog only while foregrounded', async () => {
    const probe = createDirectorProbe()
    const [foreground, setForeground] = createSignal(true)
    render(() => (
      <V2OnboardingDirector
        {...probe.props}
        foreground={foreground()}
        mediaPack={V2_ONBOARDING_MEDIA_PACK}
      />
    ))

    await enterRecordSpinWithMedia()
    await advance(4_000)
    setForeground(false)
    await Promise.resolve()
    await advance(20_000)
    expect(currentRecordMediaLayer()).not.toHaveClass(
      styles.recordMediaLayerHidden,
    )
    expect(platterHarness.props?.phase).toBe('stopped')

    setForeground(true)
    await Promise.resolve()
    await advance(3_999)
    expect(currentRecordMediaLayer()).not.toHaveClass(
      styles.recordMediaLayerHidden,
    )
    await advance(1)
    expect(currentRecordMediaLayer()).toHaveClass(styles.recordMediaLayerHidden)
    expect(platterHarness.props?.phase).toBe('spinning')
  })

  it.each([
    {
      label: 'Automatic snacking',
      pullId: 'snacking',
      presentFile: 'b03-snacking-present-v0_3.mp4',
      recedeFile: 'b05-snacking-recede-v0_4.mp4',
    },
    {
      label: 'Putting it off',
      pullId: 'avoidance',
      presentFile: 'b03-avoidance-present-v0_1.mp4',
      recedeFile: 'b05-avoidance-recede-v0_1.mp4',
    },
  ])(
    'keeps the $label V2.4 performance mounted across Present, Hold and Recede',
    async ({ label, pullId, presentFile, recedeFile }) => {
      const probe = createDirectorProbe()
      render(() => (
        <V2OnboardingDirector
          {...probe.props}
          mediaPack={V2_ONBOARDING_MEDIA_PACK}
        />
      ))

      await reachPullChoice()
      fireEvent.click(screen.getByRole('radio', { name: label }))
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

      expect(currentMediaStage()).toMatchObject({
        targetId: `pull:${pullId}:present`,
      })
      expect(currentMediaStage().props.request?.primary).toMatchObject({
        kind: 'video',
        src: expect.stringContaining(presentFile),
      })

      await advance(1_450)
      settleCurrentMedia(`${pullId}-present-token`)
      endCurrentMedia(`${pullId}-present-token`)
      expect(currentMediaStage().targetId).toBe(`pull:${pullId}:hold`)

      fireEvent.click(screen.getByRole('radio', { name: /Not sure yet/u }))
      fireEvent.click(screen.getByRole('button', { name: 'Choose Side B' }))
      fireEvent.click(screen.getAllByRole('radio')[0]!)
      fireEvent.click(screen.getByRole('button', { name: 'Start the record' }))

      expect(currentMediaStage()).toMatchObject({
        targetId: `pull:${pullId}:recede`,
      })
      expect(currentMediaStage().props.request?.primary).toMatchObject({
        kind: 'video',
        src: expect.stringContaining(recedeFile),
      })
    },
  )

  it('releases an authored movie gate through its still recovery', async () => {
    const probe = createDirectorProbe()
    render(() => (
      <V2OnboardingDirector
        {...probe.props}
        mediaPack={V2_ONBOARDING_MEDIA_PACK}
      />
    ))

    await reachPullChoice()
    fireEvent.click(screen.getByRole('radio', { name: 'Endless scrolling' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    settleCurrentMedia('fallback-token', 'reduced-still')

    await advance(1_449)
    expect(
      screen.getByRole('heading', { name: 'Endless scrolling' }),
    ).toBeVisible()
    await advance(1)
    expect(
      screen.getByRole('heading', {
        name: 'When does it show up?',
      }),
    ).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('counts the media fail-open timeout only while foregrounded', async () => {
    const probe = createDirectorProbe()
    const [foreground, setForeground] = createSignal(true)
    render(() => (
      <V2OnboardingDirector
        {...probe.props}
        mediaPack={V2_ONBOARDING_MEDIA_PACK}
        foreground={foreground()}
      />
    ))

    await reachPullChoice()
    fireEvent.click(screen.getByRole('radio', { name: 'Endless scrolling' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await advance(500)
    setForeground(false)
    await advance(20_000)
    expect(
      screen.getByRole('heading', { name: 'Endless scrolling' }),
    ).toBeVisible()

    setForeground(true)
    await advance(14_499)
    expect(
      screen.getByRole('heading', { name: 'Endless scrolling' }),
    ).toBeVisible()
    await advance(1)
    expect(
      screen.getByRole('heading', {
        name: 'When does it show up?',
      }),
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
      screen.getByRole('heading', {
        name: 'Choose your Pull',
      }),
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
      screen.getByRole('heading', {
        name: 'Choose your Pull',
      }),
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
      screen.getByRole('heading', {
        name: 'Choose your Pull',
      }),
    ).toBeVisible()
  })

  it('extends dialogue safety beyond 15 seconds for a declared 17-second line', async () => {
    renderWithControlledDialogue(
      'corky.onboarding.greeting',
      'first-run',
      17_000,
    )

    await advance(1_300)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    await advance(15_000)
    expect(screen.getByRole('heading', { name: 'Meet Corky.' })).toBeVisible()
    await advance(4_999)
    expect(screen.getByRole('heading', { name: 'Meet Corky.' })).toBeVisible()
    await advance(1)
    expect(
      screen.getByRole('heading', { name: 'Choose your Pull' }),
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
      screen.getByRole('heading', {
        name: 'Choose your Pull',
      }),
    ).toBeVisible()
    expect(
      probe.audio.play.mock.calls.filter(
        ([assetId]) => assetId === 'dialogue.corky.onboarding.greeting',
      ),
    ).toHaveLength(1)
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
      screen.getByRole('heading', {
        name: 'Choose your Pull',
      }),
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
      screen.getByRole('heading', {
        name: 'Choose your Pull',
      }),
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
      screen.getByRole('heading', {
        name: 'Choose your Pull',
      }),
    ).toBeVisible()
  })

  it('never auto-advances a decision hold with unfinished dialogue', async () => {
    renderWithControlledDialogue('corky.onboarding.pull-choice')

    await reachPullChoice()
    await advance(15_001)
    expect(
      screen.getByRole('heading', {
        name: 'Choose your Pull',
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
      screen.queryByRole('button', { name: 'Stop and save plan' }),
    ).not.toBeInTheDocument()

    setForeground(true)
    await advance(1_199)
    expect(
      screen.queryByRole('button', { name: 'Stop and save plan' }),
    ).not.toBeInTheDocument()
    await advance(1)
    expect(
      screen.getByRole('button', { name: 'Stop and save plan' }),
    ).toBeVisible()
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

  it('replays an available Pull voice and stops it when the next Pull has no recording', async () => {
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
    expect(
      probe.audio.play.mock.calls.filter(
        ([assetId]) => assetId === 'dialogue.pull.scrolling.meet',
      ),
    ).toHaveLength(1)
    fireEvent.click(screen.getByRole('radio', { name: 'Endless scrolling' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hear again' }))
    expect(
      probe.audio.play.mock.calls.filter(
        ([assetId]) => assetId === 'dialogue.pull.scrolling.meet',
      ),
    ).toHaveLength(3)

    const dialogueStopCount = () =>
      probe.audio.stopLane.mock.calls.filter(([lane]) => lane === 'dialogue')
        .length
    const stopsBeforeMissingPull = dialogueStopCount()
    fireEvent.click(screen.getByRole('radio', { name: 'Automatic snacking' }))
    expect(
      probe.audio.play.mock.calls.filter(
        ([assetId]) => assetId === 'dialogue.pull.scrolling.meet',
      ),
    ).toHaveLength(3)
    expect(dialogueStopCount()).toBe(stopsBeforeMissingPull + 1)
    expect(
      screen.queryByRole('button', { name: 'Hear again' }),
    ).not.toBeInTheDocument()

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

  it('keeps Continue off for a custom Pull that is only invisible characters', async () => {
    // A pasted zero-width space passed the form's own "not empty" check and
    // then failed the save's, which left the record hold with no way out.
    const probe = createDirectorProbe()
    render(() => <V2OnboardingDirector {...probe.props} />)

    await reachPullChoice()
    fireEvent.click(screen.getByRole('radio', { name: 'Something else' }))
    fireEvent.input(screen.getByRole('textbox', { name: 'Your Pull' }), {
      target: { value: '\u200B' },
    })
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    fireEvent.input(screen.getByRole('textbox', { name: 'Your Pull' }), {
      target: { value: ' \u00AD\u200B ' },
    })
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    fireEvent.input(screen.getByRole('textbox', { name: 'Your Pull' }), {
      target: { value: 'Opening the feed again' },
    })
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('offers a way back from a save that keeps failing', async () => {
    // Retry re-froze the same plan and failed the same way; only killing
    // the app left the hold. The runtime took BACK from it all along.
    const probe = createDirectorProbe('first-run', {
      ok: false,
      message: 'Choose one clear Side A and Side B, then try again.',
    })
    render(() => <V2OnboardingDirector {...probe.props} />)

    await reachStopHold()
    fireEvent.click(screen.getByRole('button', { name: 'Stop and save plan' }))
    expect(
      await screen.findByText(
        'Choose one clear Side A and Side B, then try again.',
      ),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(
      screen.queryByRole('button', { name: 'Stop and save plan' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: 'Play one guitar riff.' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Start the record' }),
    ).toBeInTheDocument()
    expect(probe.onSavePlan).toHaveBeenCalledTimes(1)
  })

  it('keeps a custom Pull free of the first built-in mapping', async () => {
    const probe = createDirectorProbe()
    render(() => (
      <V2OnboardingDirector
        {...probe.props}
        mediaPack={V2_ONBOARDING_MEDIA_PACK}
      />
    ))

    await reachPullChoice()
    fireEvent.click(screen.getByRole('radio', { name: 'Something else' }))
    fireEvent.input(screen.getByRole('textbox', { name: 'Your Pull' }), {
      target: { value: 'Opening another shopping tab' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(currentMediaStage()).toMatchObject({ targetId: 'plate:p02' })
    expect(currentMediaStage().props.request?.primary).toMatchObject({
      kind: 'still',
      src: expect.stringContaining('p02-table-ready-v0_17.webp'),
    })
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
    expect(platterHarness.props?.phase).toBe('spinning')
    expect(probe.audio.play).not.toHaveBeenCalledWith(
      V2_ONBOARDING_AUDIO_ASSET_IDS.platterStop,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Stop and save plan' }))
    await Promise.resolve()
    await Promise.resolve()

    expect(probe.onSavePlan).toHaveBeenCalledTimes(1)
    expect(
      probe.audio.play.mock.calls.filter(
        ([assetId]) => assetId === V2_ONBOARDING_AUDIO_ASSET_IDS.platterStop,
      ),
    ).toHaveLength(1)
    expect(platterHarness.props?.phase).toBe('stopping')
    expect(
      screen.getByRole('heading', { name: 'Saving your plan…' }),
    ).toBeVisible()
    expect(probe.onSavePlan).toHaveBeenCalledWith({
      pullId: 'scrolling',
      pullLabel: 'Endless scrolling',
      sideAText: 'Keep scrolling',
      bSideSuggestionId: 'bside.guitar-riff',
      bSideText: 'Play one guitar riff.',
    })

    finishCurrentPlatterStop()
    expect(platterHarness.props?.phase).toBe('stopped')
    expect(
      screen.getByRole('heading', { name: 'Your plan is saved.' }),
    ).toBeVisible()

    await advance(950)
    const reminderHeading = screen.getByRole('heading', {
      name: 'A reminder for later?',
    })
    const reminderDial = screen.getByRole('slider', {
      name: 'Turn the record to choose a reminder time',
    })
    expect(reminderDial).toBeVisible()
    expect(
      reminderHeading.compareDocumentPosition(reminderDial) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0)
    const reminderButton = screen.getByRole('button', { name: 'Set reminder' })
    expect(reminderButton).toBeDisabled()
    fireEvent.input(screen.getByLabelText('Choose a time'), {
      target: { value: '20:30' },
    })
    expect(reminderButton).toBeEnabled()
    fireEvent.input(screen.getByLabelText('Choose a time'), {
      target: { value: '' },
    })
    expect(reminderButton).toBeDisabled()
    fireEvent.input(screen.getByLabelText('Choose a time'), {
      target: { value: '20:30' },
    })
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
    fireEvent.click(screen.getByRole('button', { name: 'Stop and save plan' }))
    await Promise.resolve()

    expect(probe.onSavePlan).not.toHaveBeenCalled()
    expect(platterHarness.props?.phase).toBe('stopping')
    finishCurrentPlatterStop()
    await advance(950)
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    await advance(1_300)
    expect(probe.onSetReminder).not.toHaveBeenCalled()
    expect(probe.onComplete).toHaveBeenCalledTimes(1)
  })

  it('resumes the mounted platter and requires a fresh stop after a save failure', async () => {
    const probe = createDirectorProbe()
    probe.onSavePlan
      .mockResolvedValueOnce({
        ok: false,
        message: 'Could not save this plan.',
      })
      .mockResolvedValueOnce({ ok: true })
    render(() => <V2OnboardingDirector {...probe.props} />)

    await reachStopHold()
    const mountedPlatter = document.querySelector('[data-v2-platter-preview]')
    fireEvent.click(screen.getByRole('button', { name: 'Stop and save plan' }))
    const failedToken = platterHarness.props?.token
    const failedCallback = platterHarness.props?.onStopped
    if (failedToken === undefined || failedCallback === undefined) {
      throw new Error('Expected the first correlated platter stop.')
    }
    await Promise.resolve()
    await Promise.resolve()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not save this plan.',
    )
    expect(platterHarness.props?.phase).toBe('spinning')
    expect(
      probe.audio.play.mock.calls.filter(
        ([assetId]) => assetId === V2_ONBOARDING_AUDIO_ASSET_IDS.platterStop,
      ),
    ).toHaveLength(1)
    expect(document.querySelector('[data-v2-platter-preview]')).toBe(
      mountedPlatter,
    )
    failedCallback(failedToken)
    expect(platterHarness.props?.phase).toBe('spinning')

    fireEvent.click(screen.getByRole('button', { name: 'Stop and save plan' }))
    expect(platterHarness.props?.phase).toBe('stopping')
    expect(platterHarness.props?.token).not.toBe(failedToken)
    await Promise.resolve()
    await Promise.resolve()
    expect(
      screen.getByRole('heading', { name: 'Saving your plan…' }),
    ).toBeVisible()

    finishCurrentPlatterStop()
    expect(
      screen.getByRole('heading', { name: 'Your plan is saved.' }),
    ).toBeVisible()
    expect(probe.onSavePlan).toHaveBeenCalledTimes(2)
    expect(
      probe.audio.play.mock.calls.filter(
        ([assetId]) => assetId === V2_ONBOARDING_AUDIO_ASSET_IDS.platterStop,
      ),
    ).toHaveLength(2)
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

  it('restores record media after developer review re-enters the start or spin scene', () => {
    const probe = createDirectorProbe('developer-review')
    render(() => (
      <V2OnboardingDirector
        {...probe.props}
        mediaPack={V2_ONBOARDING_MEDIA_PACK}
      />
    ))

    const next = screen.getByRole('button', { name: 'Next scene' })
    for (let index = 0; index < 10; index += 1) {
      fireEvent.click(next)
    }
    expect(currentMediaStage().targetId).toBe('record:spin')
    const staleSpinSettled = currentMediaStage().props.onPresentationSettled
    const staleSpinEnded = currentMediaStage().props.onVideoEnded
    settleCurrentMedia('review-spin-token')
    expect(platterHarness.props?.phase).toBe('stopped')
    endCurrentMedia('review-spin-token')
    expect(currentRecordMediaLayer()).toHaveClass(styles.recordMediaLayerHidden)
    expect(platterHarness.props?.phase).toBe('spinning')

    fireEvent.click(next)
    expect(platterHarness.props?.phase).toBe('spinning')
    expect(currentRecordMediaLayer()).toHaveClass(styles.recordMediaLayerHidden)
    fireEvent.click(screen.getByRole('button', { name: 'Previous scene' }))
    expect(currentMediaStage().targetId).toBe('record:spin')
    expect(platterHarness.props?.phase).toBe('spinning')
    expect(currentRecordMediaLayer()).toHaveClass(styles.recordMediaLayerHidden)

    fireEvent.click(screen.getByRole('button', { name: 'Previous scene' }))
    expect(currentMediaStage().targetId).toBe('record:start')
    expect(currentRecordMediaLayer()).not.toHaveClass(
      styles.recordMediaLayerHidden,
    )
    staleSpinSettled?.({
      targetId: 'record:spin',
      token: 'late-review-spin-token',
      recoveryStage: 'reduced-still',
    })
    staleSpinEnded?.({
      targetId: 'record:spin',
      token: 'late-review-spin-token',
    })
    expect(currentRecordMediaLayer()).not.toHaveClass(
      styles.recordMediaLayerHidden,
    )

    fireEvent.click(next)
    expect(currentMediaStage().targetId).toBe('record:spin')
    expect(currentRecordMediaLayer()).not.toHaveClass(
      styles.recordMediaLayerHidden,
    )
  })

  it('keeps an unsettled review spin gated when Stop is visited and reversed', async () => {
    const probe = createDirectorProbe('developer-review')
    render(() => (
      <V2OnboardingDirector
        {...probe.props}
        mediaPack={V2_ONBOARDING_MEDIA_PACK}
      />
    ))

    const next = screen.getByRole('button', { name: 'Next scene' })
    for (let index = 0; index < 10; index += 1) {
      fireEvent.click(next)
    }
    expect(currentMediaStage().targetId).toBe('record:spin')
    expect(platterHarness.props?.phase).toBe('stopped')

    fireEvent.click(next)
    expect(platterHarness.props?.phase).toBe('stopped')
    fireEvent.click(screen.getByRole('button', { name: 'Previous scene' }))
    expect(currentMediaStage().targetId).toBe('record:spin')
    expect(platterHarness.props?.phase).toBe('stopped')
    expect(currentRecordMediaLayer()).not.toHaveClass(
      styles.recordMediaLayerHidden,
    )

    await advance(7_999)
    expect(platterHarness.props?.phase).toBe('stopped')
    await advance(1)
    expect(platterHarness.props?.phase).toBe('spinning')
    expect(currentRecordMediaLayer()).toHaveClass(styles.recordMediaLayerHidden)
  })

  it('uses P02 instead of moving record media and a 1.5 second reduced-motion spin dwell', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
    const probe = createDirectorProbe()
    render(() => (
      <V2OnboardingDirector
        {...probe.props}
        mediaPack={V2_ONBOARDING_MEDIA_PACK}
      />
    ))

    await advance(650)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to begin' }))
    await advance(1_300)
    fireEvent.click(screen.getByRole('radio', { name: 'Endless scrolling' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(currentMediaStage().props.mode).toBe('reduced')
    await advance(650)
    fireEvent.click(screen.getByRole('radio', { name: /Not sure yet/u }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose Side B' }))
    fireEvent.click(
      screen.getByRole('radio', { name: 'Play one guitar riff.' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start the record' }))
    await advance(650)
    expect(
      screen.getByRole('heading', { name: 'Corky starts the record.' }),
    ).toBeVisible()
    expect(currentMediaStage()).toMatchObject({ targetId: 'record:start' })
    expect(currentMediaStage().props.mode).toBe('reduced')
    expect(currentMediaStage().props.request?.reducedStill).toMatchObject({
      kind: 'still',
      src: expect.stringContaining('p02-table-ready-v0_17.webp'),
    })

    await advance(650)
    expect(screen.getByRole('heading', { name: 'Let it spin.' })).toBeVisible()
    expect(currentMediaStage()).toMatchObject({ targetId: 'record:spin' })
    expect(currentMediaStage().props.mode).toBe('reduced')
    expect(currentMediaStage().props.request?.reducedStill).toMatchObject({
      kind: 'still',
      src: expect.stringContaining('p02-table-ready-v0_17.webp'),
    })
    settleCurrentMedia('record-spin-reduced-token', 'reduced-still')
    await advance(1_499)
    expect(
      screen.queryByRole('button', { name: 'Stop and save plan' }),
    ).not.toBeInTheDocument()
    await advance(1)
    expect(
      screen.getByRole('button', { name: 'Stop and save plan' }),
    ).toBeVisible()
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
    fireEvent.click(screen.getByRole('button', { name: 'Stop and save plan' }))
    await Promise.resolve()

    expect(probe.onSavePlan).toHaveBeenCalledWith({
      pullId: 'legacy-pull',
      pullLabel: 'Legacy Pull',
      sideAText: 'Follow the old pattern',
      bSideText: 'Open the window.',
    })
  })
})
