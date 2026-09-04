import type { BesideCueStateV1 } from '@irchiinnuss/beside-cue-core'
import { createInitialState } from '@irchiinnuss/beside-cue-core'
import type { MobileRuntime } from '@irchiinnuss/mobile-runtime'
import { createMobileRuntimeProbe } from '@irchiinnuss/mobile-runtime/testing'
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { createEffect, untrack } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import type { BesideCueAppConfig } from './app-config'
import { DEFAULT_BESIDE_CUE_CONFIG } from './app-config'
import type { BesideCueAppServices } from './app-services'
import type { AudioSession, AudioSessionOutput } from './audio'
import type { AudioSourceVariant, ContentPack, DialogueAudioAsset, VoiceAudioFinish, VoiceAudioPort, } from './content'
import { DEFAULT_CONTENT_PACK, findLine } from './content'
import type { ResettableBesideCueRepository } from './infrastructure/indexed-db-repository'
import { CORKY_ONBOARDING_MEDIA_V0_7, CORKY_ONBOARDING_MEDIA_V0_8, CORKY_ONBOARDING_MEDIA_V0_9, } from './onboarding'
import { createCinematicOnboardingPreferenceStore } from './onboarding/cinematic-onboarding-preference'
import type { V2OnboardingMediaPack } from './onboarding/v2-onboarding-media-pack'
import type { V2OnboardingPlanDraft, V2OnboardingSessionKind, } from './onboarding/v2-onboarding-runtime'

interface DirectorHarnessProps {
  readonly bSideOptions: readonly {
    readonly id?: string
    readonly text: string
  }[]
  readonly onSavePlan: (selection: {
    readonly pullId: 'scrolling'
    readonly pullText: 'Endless scrolling'
    readonly sideAText: 'Keep scrolling'
    readonly bSideId?: string
    readonly bSideText: string
  }) => Promise<{ readonly ok: boolean; readonly message?: string }>
  readonly onSetReminder: (
    time: string,
  ) => Promise<{ readonly ok: boolean; readonly message: string }>
  readonly onSkipReminder: () => void
  readonly onComplete: (outcome: 'finished' | 'dismissed') => void
  readonly rehearsal?: boolean
}

vi.mock('./onboarding/CinematicOnboardingDirector', () => ({
  CinematicOnboardingDirector: (props: DirectorHarnessProps) => {
    const selection = (option: {
      readonly id?: string
      readonly text: string
    }) => ({
      pullId: 'scrolling' as const,
      pullText: 'Endless scrolling' as const,
      sideAText: 'Keep scrolling' as const,
      ...(option.id === undefined ? {} : { bSideId: option.id }),
      bSideText: option.text,
    })
    const firstSideB = () =>
      props.bSideOptions[0] ?? { text: 'Put the phone in another room' }
    const secondSideB = () =>
      props.bSideOptions[1] ?? { text: 'Play one guitar riff' }

    return (
      <main
        aria-label="Corky introduction test harness"
        data-rehearsal={props.rehearsal === true ? 'true' : 'false'}
      >
        <h1>Corky’s introduction</h1>
        <button
          type="button"
          onClick={() => void props.onSavePlan(selection(firstSideB()))}
        >
          Save first Side B
        </button>
        <button
          type="button"
          onClick={() => void props.onSavePlan(selection(secondSideB()))}
        >
          Save second Side B
        </button>
        <button type="button" onClick={() => void props.onSetReminder('09:00')}>
          Set onboarding reminder
        </button>
        <button type="button" onClick={() => props.onSkipReminder()}>
          Skip onboarding reminder
        </button>
        <button type="button" onClick={() => props.onComplete('finished')}>
          Finish introduction
        </button>
      </main>
    )
  },
}))

interface V2DirectorHarnessProps {
  readonly sessionKind: V2OnboardingSessionKind
  readonly mediaPack?: V2OnboardingMediaPack
  readonly audioSession: AudioSession
  readonly foreground: boolean
  readonly muted: boolean
  readonly onMutedChange: (muted: boolean) => void
  readonly onSavePlan: (
    plan: V2OnboardingPlanDraft,
  ) => Promise<{ readonly ok: boolean; readonly message?: string }>
  readonly onSetReminder: (
    localTime: string,
  ) => Promise<{ readonly ok: boolean; readonly message?: string }>
  readonly onComplete: () => void
}

vi.mock('./onboarding/V2OnboardingDirector', () => ({
  V2OnboardingDirector: (props: V2DirectorHarnessProps) => {
    let audioScope: ReturnType<AudioSession['createScope']> | undefined
    let previousForeground = untrack(() => props.foreground)

    createEffect(() => {
      const foreground = props.foreground
      if (foreground && !previousForeground) {
        audioScope ??= props.audioSession.createScope('v2-app-test-harness')
        audioScope.play('test.v2.score')
      }
      previousForeground = foreground
    })

    return (
      <main
        aria-label="V2 onboarding test harness"
        data-session-kind={props.sessionKind}
        data-foreground={props.foreground ? 'true' : 'false'}
        data-muted={props.muted ? 'true' : 'false'}
        data-media-revision={props.mediaPack?.revision}
        data-scroll-present={
          props.mediaPack?.pulls.scrolling?.present?.kind === 'video'
            ? props.mediaPack.pulls.scrolling.present.src
            : undefined
        }
        data-scroll-recede={
          props.mediaPack?.pulls.scrolling?.recede?.kind === 'video'
            ? props.mediaPack.pulls.scrolling.recede.src
            : undefined
        }
        data-record-start={
          props.mediaPack?.record?.start.kind === 'video'
            ? props.mediaPack.record.start.src
            : undefined
        }
        data-record-spin={
          props.mediaPack?.record?.spin.kind === 'video'
            ? props.mediaPack.record.spin.src
            : undefined
        }
      >
        <h1>V2 introduction</h1>
        <button
          type="button"
          onClick={() =>
            void props.onSavePlan({
              pullId: 'scrolling',
              pullLabel: 'Endless scrolling',
              sideAText: 'Keep scrolling',
              cueContextSuggestionId: 'anchor.scrolling.in-bed',
              cueContextText: 'When I get into bed with my phone.',
              bSideSuggestionId: 'bside.phone-away',
              bSideText: 'Put the phone in another room',
            })
          }
        >
          Save suggested V2 plan
        </button>
        <button
          type="button"
          onClick={() =>
            void props.onSavePlan({
              pullId: 'custom',
              pullLabel: 'Late-night tabs',
              sideAText: 'Open another late-night tab',
              bSideText: 'Close the screen and stretch',
            })
          }
        >
          Save custom V2 plan
        </button>
        <button type="button" onClick={() => void props.onSetReminder('09:00')}>
          Set V2 reminder
        </button>
        <button
          type="button"
          onClick={() => {
            audioScope ??= props.audioSession.createScope('v2-app-test-harness')
            audioScope.play('test.v2.score')
          }}
        >
          Start V2 audio
        </button>
        <button
          type="button"
          onClick={() => {
            audioScope ??= props.audioSession.createScope('v2-app-test-harness')
            audioScope.play('test.v2.score')
            audioScope.play('test.v2.dialogue')
          }}
        >
          Start V2 score and dialogue
        </button>
        <button type="button" onClick={() => props.onMutedChange(!props.muted)}>
          Toggle V2 mute
        </button>
        <button type="button" onClick={() => props.onComplete()}>
          Finish V2 introduction
        </button>
      </main>
    )
  },
}))

interface MemoryRepository extends ResettableBesideCueRepository {
  snapshot(): BesideCueStateV1 | null
  saveCalls(): number
  failNextSave(): void
  deferNextSave(): Deferred
}

const WELCOME_ONLY_TEST_CONFIG: BesideCueAppConfig = {
  ...DEFAULT_BESIDE_CUE_CONFIG,
  onboarding: {
    delivery: 'welcome-only',
    revision: 'welcome-only-test',
    contractVersion: '0.2.0',
  },
}

const CINEMATIC_TEST_CONFIG: BesideCueAppConfig = {
  ...DEFAULT_BESIDE_CUE_CONFIG,
  onboarding: {
    delivery: 'cinematic-first-run',
    revision: CORKY_ONBOARDING_MEDIA_V0_9.revision,
    contractVersion: '0.5.0',
    media: CORKY_ONBOARDING_MEDIA_V0_9,
  },
}

const LEGACY_STRING_PULL_OPTIONS: BesideCueAppConfig['pullOptions'] =
  DEFAULT_BESIDE_CUE_CONFIG.pullOptions.map((option) =>
    option.id === 'scrolling'
      ? {
          id: option.id,
          label: option.label,
          moment: option.moment,
          defaultSideAText: option.defaultSideAText,
          suggestions: [
            'Stretch both arms for one breath.',
            'Look out the window for a moment.',
          ],
        }
      : option,
  )

const LEGACY_STRING_SETUP_TEST_CONFIG: BesideCueAppConfig = {
  ...WELCOME_ONLY_TEST_CONFIG,
  pullOptions: LEGACY_STRING_PULL_OPTIONS,
}

const LEGACY_STRING_CINEMATIC_TEST_CONFIG: BesideCueAppConfig = {
  ...CINEMATIC_TEST_CONFIG,
  pullOptions: LEGACY_STRING_PULL_OPTIONS,
}

const LEGACY_CINEMATIC_TEST_CONFIG: BesideCueAppConfig = {
  ...DEFAULT_BESIDE_CUE_CONFIG,
  onboarding: {
    delivery: 'cinematic-first-run',
    revision: CORKY_ONBOARDING_MEDIA_V0_7.revision,
    contractVersion: '0.3.0',
    media: CORKY_ONBOARDING_MEDIA_V0_7,
  },
}

const LEGACY_V0_4_CINEMATIC_TEST_CONFIG: BesideCueAppConfig = {
  ...DEFAULT_BESIDE_CUE_CONFIG,
  onboarding: {
    delivery: 'cinematic-first-run',
    revision: CORKY_ONBOARDING_MEDIA_V0_8.revision,
    contractVersion: '0.4.0',
    media: CORKY_ONBOARDING_MEDIA_V0_8,
  },
}

function createMemoryRepository(
  initialState: BesideCueStateV1 | null = null,
): MemoryRepository {
  let state = initialState === null ? null : structuredClone(initialState)
  let saves = 0
  let rejectNextSave = false
  let nextSaveGate: Deferred | undefined

  return {
    async loadState() {
      return state
    },
    async saveState(nextState) {
      saves += 1
      const saveGate = nextSaveGate
      nextSaveGate = undefined
      if (saveGate !== undefined) await saveGate.promise
      if (rejectNextSave) {
        rejectNextSave = false
        throw new Error('Injected save failure.')
      }
      state = nextState
    },
    async clear() {
      state = null
    },
    snapshot() {
      return state
    },
    saveCalls() {
      return saves
    },
    failNextSave() {
      rejectNextSave = true
    },
    deferNextSave() {
      const saveGate = deferred()
      nextSaveGate = saveGate
      return saveGate
    },
  }
}

interface Deferred {
  readonly promise: Promise<void>
  resolve(): void
}

function deferred(): Deferred {
  let resolve!: () => void
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

function stateWithActiveCue(options: {
  readonly bSideText: string
  readonly bSideSuggestionId?: string
  readonly hapticsEnabled?: boolean
}): BesideCueStateV1 {
  const initial = createInitialState()
  const at = '2026-08-06T08:00:00.000Z'

  return {
    ...initial,
    cues: [
      {
        id: 'seed-cue',
        status: 'active',
        pullCategoryId: 'scrolling',
        pullText: 'Keep scrolling',
        ...(options.bSideSuggestionId === undefined
          ? {}
          : { bSideSuggestionId: options.bSideSuggestionId }),
        bSideText: options.bSideText,
        mascotSetId: 'corktop-v1',
        createdAt: at,
        updatedAt: at,
      },
    ],
    settings: {
      ...initial.settings,
      hapticsEnabled: options.hapticsEnabled ?? true,
    },
  }
}

function withDailyRule(state: BesideCueStateV1): BesideCueStateV1 {
  const at = '2026-08-06T08:00:00.000Z'

  return {
    ...state,
    scheduleRules: [
      {
        id: 'seed-daily-rule',
        cueId: 'seed-cue',
        kind: 'target_time',
        localTime: '09:00',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        enabled: true,
        createdAt: at,
        updatedAt: at,
      },
    ],
  }
}

function createTestServices(
  repository: MemoryRepository,
  options: {
    readonly runtime?: MobileRuntime
    readonly platform?: BesideCueAppServices['platform']
    readonly purchases?: BesideCueAppServices['purchases']
    readonly onboardingPreferences?: BesideCueAppServices['onboardingPreferences']
    readonly audioOutput?: AudioSessionOutput
    readonly voiceAudio?: VoiceAudioPort
  } = {},
): BesideCueAppServices {
  let nextId = 0
  const preferenceValues = new Map<string, string>()
  return {
    repository,
    runtime: Promise.resolve(
      options.runtime ?? createMobileRuntimeProbe().runtime,
    ),
    platform: options.platform ?? 'web',
    purchases: options.purchases ?? {
      entitlementId: 'BeSideCue Pro',
      problem: 'Purchases need the Android or iOS app.',
    },
    onboardingPreferences:
      options.onboardingPreferences ??
      createCinematicOnboardingPreferenceStore({
        getItem: (key) => preferenceValues.get(key) ?? null,
        setItem: (key, value) => preferenceValues.set(key, value),
        removeItem: (key) => preferenceValues.delete(key),
      }),
    ...(options.audioOutput === undefined
      ? {}
      : { audioOutput: options.audioOutput }),
    ...(options.voiceAudio === undefined
      ? {}
      : { voiceAudio: options.voiceAudio }),
    now: () => new Date('2026-08-06T10:00:00'),
    createId: () => `test-${String((nextId += 1))}`,
  }
}

interface ValueDeferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
}

function valueDeferred<T>(): ValueDeferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

interface RecordedVoicePlayback {
  readonly source: AudioSourceVariant
  readonly finished: ValueDeferred<VoiceAudioFinish>
  stopCalls: number
}

interface VoiceAudioProbe {
  readonly port: VoiceAudioPort
  readonly playbacks: readonly RecordedVoicePlayback[]
  finish(index: number, result?: VoiceAudioFinish): void
}

function createVoiceAudioProbe(): VoiceAudioProbe {
  const playbacks: RecordedVoicePlayback[] = []

  const port: VoiceAudioPort = {
    supportsMimeType: () => true,
    play(source) {
      const finished = valueDeferred<VoiceAudioFinish>()
      const playback: RecordedVoicePlayback = {
        source,
        finished,
        stopCalls: 0,
      }
      playbacks.push(playback)

      return {
        started: Promise.resolve(),
        finished: finished.promise,
        stop: () => {
          playback.stopCalls += 1
          finished.resolve('stopped')
        },
      }
    },
    dispose: () => undefined,
  }

  return {
    port,
    playbacks,
    finish(index, result = 'ended') {
      const playback = playbacks[index]
      if (playback === undefined) {
        throw new Error(`Expected voice playback ${String(index)}.`)
      }
      playback.finished.resolve(result)
    },
  }
}

interface RecordedAudioOutputPlayback {
  readonly source: string
  readonly initialGain: number
  readonly gains: number[]
  stopCalls: number
}

interface AudioOutputProbe {
  readonly output: AudioSessionOutput
  readonly playbacks: readonly RecordedAudioOutputPlayback[]
  readonly calls: {
    unlock: number
    dispose: number
  }
}

function createAudioOutputProbe(): AudioOutputProbe {
  const playbacks: RecordedAudioOutputPlayback[] = []
  const calls = { unlock: 0, dispose: 0 }

  const output: AudioSessionOutput = {
    supportsMimeType: () => true,
    async unlock() {
      calls.unlock += 1
      return true
    },
    play(request) {
      const finished = valueDeferred<'ended' | 'failed' | 'stopped'>()
      const recorded: RecordedAudioOutputPlayback = {
        source: request.source.src,
        initialGain: request.initialGain,
        gains: [],
        stopCalls: 0,
      }
      playbacks.push(recorded)
      return {
        started: Promise.resolve('started'),
        finished: finished.promise,
        setGain: (gain) => recorded.gains.push(gain),
        stop: () => {
          recorded.stopCalls += 1
          finished.resolve('stopped')
        },
      }
    },
    dispose() {
      calls.dispose += 1
    },
  }

  return { output, playbacks, calls }
}

function packWithV2Score(): ContentPack {
  return {
    ...DEFAULT_CONTENT_PACK,
    audio: {
      schemaVersion: 1,
      revision: 'app-test-v2-score-v1',
      locale: 'en',
      assets: [
        {
          id: 'test.v2.score',
          lane: 'score',
          playback: { kind: 'one-shot' },
          sources: [
            {
              src: 'audio/test/v2-score.m4a',
              mimeType: 'audio/mp4; codecs="mp4a.40.2"',
              sha256: 'b'.repeat(64),
              byteLength: 4_096,
              durationMs: 2_000,
              sampleRateHz: 48_000,
              channels: 2,
            },
          ],
        },
        {
          id: 'test.v2.dialogue',
          lane: 'dialogue',
          playback: { kind: 'one-shot' },
          dialogue: {
            lineId: 'corky.onboarding.greeting',
            captionSha256:
              '4d74d9080a6e32473f9a83d5956dae4e47dfc8861f0fae159e8a4e4c9febd805',
          },
          sources: [
            {
              src: 'audio/test/v2-dialogue.m4a',
              mimeType: 'audio/mp4; codecs="mp4a.40.2"',
              sha256: 'c'.repeat(64),
              byteLength: 4_096,
              durationMs: 2_000,
              sampleRateHz: 48_000,
              channels: 2,
            },
          ],
        },
      ],
    },
  }
}

function packWithRecordedLines(...lineIds: readonly string[]): ContentPack {
  const assets = lineIds.map((lineId, index): DialogueAudioAsset => {
    const line = findLine(DEFAULT_CONTENT_PACK, lineId)
    if (
      line?.captionSha256 === undefined ||
      line.fileStem === undefined ||
      line.speakerId === undefined
    ) {
      throw new Error(`Expected a recordable canonical line for ${lineId}.`)
    }

    return {
      id: `dialogue.${lineId}`,
      lane: 'dialogue',
      playback: { kind: 'one-shot' },
      dialogue: {
        lineId,
        captionSha256: line.captionSha256,
      },
      sources: [
        {
          src: `/audio/voice/en/${line.speakerId}/${line.fileStem}.m4a`,
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256: `${'a'.repeat(63)}${String(index % 10)}`,
          byteLength: 4_096 + index,
          durationMs: 2_000 + index,
          sampleRateHz: 48_000,
          channels: 1,
        },
      ],
    }
  })

  return {
    ...DEFAULT_CONTENT_PACK,
    audio: {
      schemaVersion: 1,
      revision: 'app-test-recorded-lines-v1',
      locale: 'en',
      assets,
    },
  }
}

function stateWithVoiceEnabled(voiceEnabled: boolean): BesideCueStateV1 {
  const state = createInitialState()
  return {
    ...state,
    settings: { ...state.settings, voiceEnabled },
  }
}

async function saveFirstPlanFromWelcome(): Promise<void> {
  fireEvent.click(
    await screen.findByRole('button', { name: /set up my first plan/iu }),
  )
  fireEvent.click(screen.getByRole('radio', { name: /endless scrolling/iu }))
  fireEvent.click(
    screen.getByRole('button', { name: /confirm endless scrolling/iu }),
  )
  fireEvent.click(screen.getByRole('radio', { name: /not sure yet/iu }))
  fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))
  fireEvent.click(screen.getByRole('button', { name: /save my plan/iu }))
  await screen.findByRole('heading', {
    name: /a better choice, kept close/iu,
  })
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

describe('Beside Cue character voice integration', () => {
  it('attempts a delivered Pull introduction once and leaves replay explicit', async () => {
    const repository = createMemoryRepository()
    const voice = createVoiceAudioProbe()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, { voiceAudio: voice.port })}
        contentPack={packWithRecordedLines('pull.scrolling.meet')}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /set up my first plan/iu }),
    )
    fireEvent.click(screen.getByRole('radio', { name: /endless scrolling/iu }))
    await waitFor(() => expect(voice.playbacks).toHaveLength(1))
    expect(voice.playbacks[0]?.source.src).toContain('en__the-scroll__meet.m4a')
    await screen.findByText('Voice playing.')

    voice.finish(0)
    await screen.findByRole('button', {
      name: /replay voice/iu,
    })
    fireEvent.click(screen.getByRole('radio', { name: /automatic snacking/iu }))
    fireEvent.click(screen.getByRole('radio', { name: /endless scrolling/iu }))
    expect(voice.playbacks).toHaveLength(1)

    fireEvent.click(
      screen.getByRole('button', {
        name: /replay voice/iu,
      }),
    )
    await waitFor(() => expect(voice.playbacks).toHaveLength(2))
    expect(voice.playbacks[1]?.source.src).toContain('en__the-scroll__meet.m4a')
    expect(repository.saveCalls()).toBe(0)
    expect(repository.snapshot()).toBeNull()
  })

  it('keeps the delivered caption truthful and silent when voice is muted', async () => {
    const repository = createMemoryRepository(stateWithVoiceEnabled(false))
    const voice = createVoiceAudioProbe()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, { voiceAudio: voice.port })}
        contentPack={packWithRecordedLines('pull.scrolling.meet')}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /set up my first plan/iu }),
    )
    fireEvent.click(screen.getByRole('radio', { name: /endless scrolling/iu }))

    expect(
      await screen.findByText(
        'Voice is muted in Settings. The full caption is shown.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'I’m The Scroll. I always have one more thing to show you, and then one more after that.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /hear voice|replay voice|voice playing/iu,
      }),
    ).not.toBeInTheDocument()
    expect(voice.playbacks).toHaveLength(0)
  })

  it('plays a manual Cue gesture but keeps a foreground scheduled Cue caption-only', async () => {
    const repository = createMemoryRepository(
      withDailyRule(
        stateWithActiveCue({
          bSideSuggestionId: 'bside.phone-away',
          bSideText: 'Put the phone in another room.',
        }),
      ),
    )
    const runtime = createMobileRuntimeProbe({ permission: 'granted' })
    const voice = createVoiceAudioProbe()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, {
          platform: 'android',
          runtime: runtime.runtime,
          voiceAudio: voice.port,
        })}
        contentPack={packWithRecordedLines(
          'corky.cue-open.01',
          'corky.cue-open.02',
        )}
      />
    ))

    await waitFor(() => expect(runtime.calls.scheduled.at(-1)).toHaveLength(1))
    fireEvent.click(await screen.findByRole('button', { name: /cue me now/iu }))
    await waitFor(() => expect(voice.playbacks).toHaveLength(1))
    expect(voice.playbacks[0]?.source.src).toContain(
      'en__corky__cue-open-01.m4a',
    )
    fireEvent.click(screen.getByRole('button', { name: /close cue/iu }))
    await screen.findByRole('heading', {
      name: /a better choice, kept close/iu,
    })

    const scheduled = runtime.calls.scheduled.at(-1)?.[0]
    if (scheduled === undefined) throw new Error('Expected a notification.')
    await runtime.emitNotificationAction({
      notificationId: scheduled.id,
      actionId: 'open',
      extra: scheduled.extra,
    })

    expect(
      await screen.findByText('Your plan is here when you want it.'),
    ).toBeInTheDocument()
    expect(repository.snapshot()?.occurrences).toMatchObject([
      { source: 'manual', state: 'cancelled' },
      { source: 'scheduled', state: 'presented' },
    ])
    expect(voice.playbacks).toHaveLength(1)
  })

  it.each([
    [
      'Side B',
      /choose side b/iu,
      'corky.side-b.01',
      'Side B is yours',
      'en__corky__side-b-01.m4a',
    ],
    [
      'Not now',
      /not now/iu,
      'corky.not-now.01',
      'Not now is okay',
      'en__corky__not-now-01.m4a',
    ],
  ] as const)(
    'starts the %s acknowledgement only after its atomic save succeeds',
    async (_label, buttonName, lineId, quietLabel, sourceName) => {
      const repository = createMemoryRepository(
        stateWithActiveCue({
          bSideSuggestionId: 'bside.phone-away',
          bSideText: 'Put the phone in another room.',
        }),
      )
      const voice = createVoiceAudioProbe()
      render(() => (
        <App
          config={WELCOME_ONLY_TEST_CONFIG}
          services={createTestServices(repository, {
            voiceAudio: voice.port,
          })}
          contentPack={packWithRecordedLines(lineId)}
        />
      ))

      fireEvent.click(
        await screen.findByRole('button', { name: /cue me now/iu }),
      )
      await waitFor(() =>
        expect(repository.snapshot()?.occurrences).toMatchObject([
          { state: 'presented' },
        ]),
      )
      const saveGate = repository.deferNextSave()
      const savesBeforeChoice = repository.saveCalls()

      fireEvent.click(screen.getByRole('button', { name: buttonName }))

      expect(repository.saveCalls()).toBe(savesBeforeChoice + 1)
      expect(repository.snapshot()?.occurrences).toMatchObject([
        { state: 'presented' },
      ])
      expect(voice.playbacks).toHaveLength(0)

      saveGate.resolve()
      expect(await screen.findByText(quietLabel)).toBeInTheDocument()
      await waitFor(() => expect(voice.playbacks).toHaveLength(1))
      expect(voice.playbacks[0]?.source.src).toContain(sourceName)
      const savedState = structuredClone(repository.snapshot())
      const savesAfterChoice = repository.saveCalls()

      voice.finish(0)
      await Promise.resolve()
      await Promise.resolve()

      expect(repository.saveCalls()).toBe(savesAfterChoice)
      expect(repository.snapshot()).toEqual(savedState)
    },
  )

  it('keeps an acknowledgement silent when the app hides during its atomic save', async () => {
    const repository = createMemoryRepository(
      stateWithActiveCue({
        bSideSuggestionId: 'bside.phone-away',
        bSideText: 'Put the phone in another room.',
      }),
    )
    const voice = createVoiceAudioProbe()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, { voiceAudio: voice.port })}
        contentPack={packWithRecordedLines('corky.side-b.01')}
      />
    ))

    fireEvent.click(await screen.findByRole('button', { name: /cue me now/iu }))
    await waitFor(() =>
      expect(repository.snapshot()?.occurrences).toMatchObject([
        { state: 'presented' },
      ]),
    )
    const saveGate = repository.deferNextSave()

    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    saveGate.resolve()

    expect(await screen.findByText('Side B is yours')).toBeInTheDocument()
    expect(repository.snapshot()?.occurrences).toMatchObject([
      { state: 'resolved', outcome: 'b_side' },
    ])
    expect(voice.playbacks).toHaveLength(0)
  })

  it('keeps a failed choice silent and starts one acknowledgement after retry', async () => {
    const repository = createMemoryRepository(
      stateWithActiveCue({
        bSideSuggestionId: 'bside.phone-away',
        bSideText: 'Put the phone in another room.',
      }),
    )
    const voice = createVoiceAudioProbe()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, { voiceAudio: voice.port })}
        contentPack={packWithRecordedLines('corky.side-b.01')}
      />
    ))

    fireEvent.click(await screen.findByRole('button', { name: /cue me now/iu }))
    await waitFor(() =>
      expect(repository.snapshot()?.occurrences).toMatchObject([
        { state: 'presented' },
      ]),
    )
    repository.failNextSave()
    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your choice could not be saved on this device. Please try again.',
    )
    expect(voice.playbacks).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))
    expect(await screen.findByText('Side B is yours')).toBeInTheDocument()
    await waitFor(() => expect(voice.playbacks).toHaveLength(1))
    expect(voice.playbacks[0]?.source.src).toContain('en__corky__side-b-01.m4a')
    expect(repository.snapshot()?.occurrences).toMatchObject([
      { state: 'resolved', outcome: 'b_side' },
    ])
    expect(repository.snapshot()?.occurrences).toHaveLength(1)
  })

  it('stops the current Pull voice when its route exits', async () => {
    const repository = createMemoryRepository()
    const voice = createVoiceAudioProbe()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, { voiceAudio: voice.port })}
        contentPack={packWithRecordedLines('pull.scrolling.meet')}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /set up my first plan/iu }),
    )
    fireEvent.click(screen.getByRole('radio', { name: /endless scrolling/iu }))
    await waitFor(() => expect(voice.playbacks).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: /go back/iu }))

    await waitFor(() => expect(voice.playbacks[0]?.stopCalls).toBe(1))
    expect(
      await screen.findByRole('button', { name: /set up my first plan/iu }),
    ).toBeInTheDocument()
  })

  it('stops the current character voice when the document becomes hidden', async () => {
    const repository = createMemoryRepository(
      stateWithActiveCue({
        bSideSuggestionId: 'bside.phone-away',
        bSideText: 'Put the phone in another room.',
      }),
    )
    const voice = createVoiceAudioProbe()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, { voiceAudio: voice.port })}
        contentPack={packWithRecordedLines('corky.cue-open.01')}
      />
    ))

    fireEvent.click(await screen.findByRole('button', { name: /cue me now/iu }))
    await waitFor(() => expect(voice.playbacks).toHaveLength(1))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => expect(voice.playbacks[0]?.stopCalls).toBe(1))
  })
})

describe('Beside Cue V2 onboarding integration', () => {
  it('makes an environment-enabled V2 review session write-free at the App boundary', async () => {
    const repository = createMemoryRepository()
    const probe = createMobileRuntimeProbe({ permission: 'granted' })
    render(() => (
      <App
        config={DEFAULT_BESIDE_CUE_CONFIG}
        onboardingReview
        services={createTestServices(repository, {
          platform: 'android',
          runtime: probe.runtime,
        })}
      />
    ))

    const harness = await screen.findByLabelText('V2 onboarding test harness')
    expect(harness).toHaveAttribute('data-session-kind', 'developer-review')
    expect(harness).toHaveAttribute(
      'data-media-revision',
      'corky-v2.5-media-v1',
    )
    expect(harness).toHaveAttribute(
      'data-scroll-present',
      '/onboarding/corky-v2.4/picture/b03-scrolling-present-v0_2.mp4',
    )
    expect(harness).toHaveAttribute(
      'data-scroll-recede',
      '/onboarding/corky-v2.4/picture/b05-scrolling-recede-v0_2.mp4',
    )
    expect(harness).toHaveAttribute(
      'data-record-start',
      '/onboarding/corky-v2.5/picture/b06-corky-starts-record-v0_1.mp4',
    )
    expect(harness).toHaveAttribute(
      'data-record-spin',
      '/onboarding/corky-v2.5/picture/b06-whole-vinyl-spin-v0_1.mp4',
    )
    expect(harness).toHaveAttribute('data-muted', 'false')
    fireEvent.click(screen.getByRole('button', { name: /toggle v2 mute/iu }))
    expect(harness).toHaveAttribute('data-muted', 'true')
    expect(repository.saveCalls()).toBe(0)
    fireEvent.click(
      screen.getByRole('button', { name: /save suggested v2 plan/iu }),
    )
    fireEvent.click(screen.getByRole('button', { name: /set v2 reminder/iu }))
    fireEvent.click(
      screen.getByRole('button', { name: /finish v2 introduction/iu }),
    )

    expect(
      await screen.findByRole('heading', {
        name: /keep your better choice beside the moment/iu,
      }),
    ).toBeInTheDocument()
    expect(repository.saveCalls()).toBe(0)
    expect(repository.snapshot()).toBeNull()
    expect(probe.calls.scheduled).toHaveLength(0)
  })

  it('writes the V2 first-run preference only after the exact plan is durable', async () => {
    const repository = createMemoryRepository()
    const saveGate = repository.deferNextSave()
    const preferenceValues = new Map<string, string>()
    const onboardingPreferences = createCinematicOnboardingPreferenceStore({
      getItem: (key) => preferenceValues.get(key) ?? null,
      setItem: (key, value) => preferenceValues.set(key, value),
      removeItem: (key) => preferenceValues.delete(key),
    })
    render(() => (
      <App
        config={DEFAULT_BESIDE_CUE_CONFIG}
        services={createTestServices(repository, { onboardingPreferences })}
      />
    ))

    const harness = await screen.findByLabelText('V2 onboarding test harness')
    expect(harness).toHaveAttribute('data-session-kind', 'first-run')
    fireEvent.click(
      screen.getByRole('button', { name: /save suggested v2 plan/iu }),
    )
    await waitFor(() => expect(repository.saveCalls()).toBe(1))
    expect(
      onboardingPreferences.read('beside-cue-v2.5-main-v1'),
    ).toBeUndefined()

    saveGate.resolve()

    await waitFor(() =>
      expect(repository.snapshot()?.cues).toMatchObject([
        {
          status: 'active',
          pullCategoryId: 'scrolling',
          pullText: 'Keep scrolling',
          cueContextSuggestionId: 'anchor.scrolling.in-bed',
          cueContextText: 'When I get into bed with my phone.',
          bSideSuggestionId: 'bside.phone-away',
          bSideText: 'Put the phone in another room',
        },
      ]),
    )
    expect(onboardingPreferences.read('beside-cue-v2.5-main-v1')).toMatchObject(
      { outcome: 'finished' },
    )

    fireEvent.click(
      screen.getByRole('button', { name: /finish v2 introduction/iu }),
    )
    expect(
      await screen.findByRole('heading', {
        name: /a better choice, kept close/iu,
      }),
    ).toBeInTheDocument()
  })

  it('omits category and cue-context fields for a custom V2 Pull', async () => {
    const repository = createMemoryRepository()
    render(() => (
      <App
        config={DEFAULT_BESIDE_CUE_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /save custom v2 plan/iu }),
    )

    await waitFor(() => expect(repository.snapshot()?.cues).toHaveLength(1))
    const savedCue = repository.snapshot()?.cues[0]
    expect(savedCue).toMatchObject({
      pullText: 'Open another late-night tab',
      bSideText: 'Close the screen and stretch',
    })
    expect(savedCue).not.toHaveProperty('pullCategoryId')
    expect(savedCue).not.toHaveProperty('cueContextSuggestionId')
    expect(savedCue).not.toHaveProperty('cueContextText')
    expect(savedCue).not.toHaveProperty('bSideSuggestionId')
  })

  it('reuses the real reminder path after the V2 plan is saved', async () => {
    const repository = createMemoryRepository()
    const probe = createMobileRuntimeProbe({ permission: 'granted' })
    render(() => (
      <App
        config={DEFAULT_BESIDE_CUE_CONFIG}
        services={createTestServices(repository, {
          platform: 'android',
          runtime: probe.runtime,
        })}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /save suggested v2 plan/iu }),
    )
    await waitFor(() => expect(repository.snapshot()?.cues).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: /set v2 reminder/iu }))

    await waitFor(() =>
      expect(repository.snapshot()?.scheduleRules).toMatchObject([
        { kind: 'target_time', localTime: '09:00', enabled: true },
      ]),
    )
    expect(probe.calls.scheduled.at(-1)).toHaveLength(1)
  })

  it('keeps replay callbacks write-free and returns to Settings', async () => {
    const repository = createMemoryRepository(
      stateWithActiveCue({
        bSideSuggestionId: 'bside.phone-away',
        bSideText: 'Put the phone in another room.',
      }),
    )
    const probe = createMobileRuntimeProbe({ permission: 'granted' })
    const output = createAudioOutputProbe()
    render(() => (
      <App
        config={DEFAULT_BESIDE_CUE_CONFIG}
        services={createTestServices(repository, {
          audioOutput: output.output,
          platform: 'android',
          runtime: probe.runtime,
        })}
        contentPack={packWithV2Score()}
      />
    ))

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('switch', { name: /voice is on/iu }))
    await waitFor(() =>
      expect(repository.snapshot()?.settings.voiceEnabled).toBe(false),
    )
    const beforeReplay = structuredClone(repository.snapshot())
    const savesBeforeReplay = repository.saveCalls()
    fireEvent.click(
      screen.getByRole('button', {
        name: /watch corky’s introduction again/iu,
      }),
    )
    const harness = await screen.findByLabelText('V2 onboarding test harness')
    expect(harness).toHaveAttribute('data-session-kind', 'replay')
    expect(harness).toHaveAttribute('data-muted', 'true')
    fireEvent.click(screen.getByRole('button', { name: /toggle v2 mute/iu }))
    expect(harness).toHaveAttribute('data-muted', 'false')
    expect(repository.snapshot()).toEqual(beforeReplay)
    expect(repository.saveCalls()).toBe(savesBeforeReplay)

    fireEvent.click(
      screen.getByRole('button', { name: /save custom v2 plan/iu }),
    )
    fireEvent.click(screen.getByRole('button', { name: /set v2 reminder/iu }))
    fireEvent.click(screen.getByRole('button', { name: /start v2 audio/iu }))
    await waitFor(() => expect(output.playbacks).toHaveLength(1))
    fireEvent.click(
      screen.getByRole('button', { name: /finish v2 introduction/iu }),
    )

    expect(await screen.findByText('Current plan')).toBeInTheDocument()
    expect(repository.snapshot()).toEqual(beforeReplay)
    expect(repository.saveCalls()).toBe(savesBeforeReplay)
    expect(probe.calls.scheduled).toHaveLength(0)
    expect(output.playbacks).toHaveLength(1)
    expect(
      screen.getByRole('switch', { name: /voice is muted/iu }),
    ).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(
      screen.getByRole('button', {
        name: /watch corky’s introduction again/iu,
      }),
    )
    const restoredHarness = await screen.findByLabelText(
      'V2 onboarding test harness',
    )
    expect(restoredHarness).toHaveAttribute('data-muted', 'true')
    fireEvent.click(screen.getByRole('button', { name: /start v2 audio/iu }))
    expect(output.playbacks).toHaveLength(1)
  })

  it('keeps the V2 sound control aligned with the persisted voice setting', async () => {
    const repository = createMemoryRepository()
    const output = createAudioOutputProbe()
    render(() => (
      <App
        config={DEFAULT_BESIDE_CUE_CONFIG}
        services={createTestServices(repository, {
          audioOutput: output.output,
        })}
        contentPack={packWithV2Score()}
      />
    ))

    const harness = await screen.findByLabelText('V2 onboarding test harness')
    expect(harness).toHaveAttribute('data-muted', 'false')
    fireEvent.click(screen.getByRole('button', { name: /toggle v2 mute/iu }))

    await waitFor(() => {
      expect(repository.snapshot()?.settings.voiceEnabled).toBe(false)
      expect(harness).toHaveAttribute('data-muted', 'true')
    })
    fireEvent.click(screen.getByRole('button', { name: /start v2 audio/iu }))
    expect(output.playbacks).toHaveLength(0)
  })

  it('preserves the pre-automated V2 score gain while dialogue is active', async () => {
    const repository = createMemoryRepository()
    const output = createAudioOutputProbe()
    render(() => (
      <App
        config={DEFAULT_BESIDE_CUE_CONFIG}
        services={createTestServices(repository, {
          audioOutput: output.output,
        })}
        contentPack={packWithV2Score()}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Start V2 score and dialogue',
      }),
    )
    await waitFor(() => expect(output.playbacks).toHaveLength(2))

    const score = output.playbacks.find(({ source }) =>
      source.endsWith('/v2-score.m4a'),
    )
    expect(score?.initialGain).toBe(1)
    expect(score?.gains).toEqual([1])
  })

  it('keeps V2 foreground truth aligned across page and visibility events', async () => {
    const repository = createMemoryRepository()
    const output = createAudioOutputProbe()
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible')
    const view = render(() => (
      <App
        config={DEFAULT_BESIDE_CUE_CONFIG}
        services={createTestServices(repository, {
          audioOutput: output.output,
        })}
        contentPack={packWithV2Score()}
      />
    ))

    const startAudio = await screen.findByRole('button', {
      name: /start v2 audio/iu,
    })
    const harness = screen.getByLabelText('V2 onboarding test harness')
    expect(harness).toHaveAttribute('data-foreground', 'true')
    fireEvent.click(startAudio)
    await waitFor(() => expect(output.playbacks).toHaveLength(1))

    window.dispatchEvent(new Event('pagehide'))
    await waitFor(() => {
      expect(output.playbacks[0]?.stopCalls).toBe(1)
      expect(harness).toHaveAttribute('data-foreground', 'false')
    })

    window.dispatchEvent(new Event('pageshow'))
    await waitFor(() => {
      expect(harness).toHaveAttribute('data-foreground', 'true')
      expect(output.playbacks).toHaveLength(2)
    })

    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => {
      expect(output.playbacks[1]?.stopCalls).toBe(1)
      expect(harness).toHaveAttribute('data-foreground', 'false')
    })
    view.unmount()
    expect(output.calls.dispose).toBe(1)
  })
})

describe('Beside Cue app', () => {
  it('starts character voice on and persists the quieter Settings choice', async () => {
    const repository = createMemoryRepository()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    await saveFirstPlanFromWelcome()
    expect(repository.snapshot()?.settings.voiceEnabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const voiceSwitch = screen.getByRole('switch', { name: /voice is on/iu })
    expect(voiceSwitch).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(voiceSwitch)

    expect(
      screen.getByRole('switch', { name: /voice is muted/iu }),
    ).toHaveAttribute('aria-checked', 'false')
    await waitFor(() =>
      expect(repository.snapshot()?.settings.voiceEnabled).toBe(false),
    )
  })

  it('persists a built-in Side B by stable id and keeps its visible label', async () => {
    const repository = createMemoryRepository()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    await saveFirstPlanFromWelcome()

    expect(repository.snapshot()?.cues).toMatchObject([
      {
        pullCategoryId: 'scrolling',
        pullText: 'Keep scrolling',
        bSideSuggestionId: 'bside.phone-away',
        bSideText: 'Put the phone in another room.',
      },
    ])
    expect(repository.snapshot()?.cues[0]).not.toHaveProperty(
      'cueContextSuggestionId',
    )
    expect(repository.snapshot()?.cues[0]).not.toHaveProperty('cueContextText')
  })

  it('saves the exact suggested cue context and keeps it visible with the plan', async () => {
    const repository = createMemoryRepository()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /set up my first plan/iu }),
    )
    fireEvent.click(screen.getByRole('radio', { name: /endless scrolling/iu }))
    fireEvent.click(
      screen.getByRole('button', { name: /confirm endless scrolling/iu }),
    )
    fireEvent.click(
      screen.getByRole('radio', {
        name: /when i get into bed with my phone/iu,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))
    fireEvent.click(screen.getByRole('button', { name: /save my plan/iu }))

    await screen.findByRole('heading', {
      name: /a better choice, kept close/iu,
    })
    expect(repository.snapshot()?.cues[0]).toMatchObject({
      cueContextSuggestionId: 'anchor.scrolling.in-bed',
      cueContextText: 'When I get into bed with my phone.',
    })
    expect(screen.getByLabelText('Your cue')).toHaveTextContent(
      'When I get into bed with my phone.',
    )

    fireEvent.click(screen.getByRole('button', { name: /cue me now/iu }))
    expect(screen.getByText('When I get into bed with my phone.')).toBeVisible()
  })

  it('saves a private custom cue context without inventing a suggestion id', async () => {
    const repository = createMemoryRepository()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /set up my first plan/iu }),
    )
    fireEvent.click(screen.getByRole('radio', { name: /endless scrolling/iu }))
    fireEvent.click(
      screen.getByRole('button', { name: /confirm endless scrolling/iu }),
    )
    fireEvent.click(screen.getByRole('radio', { name: /write my own/iu }))
    fireEvent.input(screen.getByLabelText('Your cue'), {
      target: { value: '  After   lunch  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))
    fireEvent.click(screen.getByRole('button', { name: /save my plan/iu }))

    await screen.findByRole('heading', {
      name: /a better choice, kept close/iu,
    })
    const savedCue = repository.snapshot()?.cues[0]
    expect(savedCue).toMatchObject({ cueContextText: 'After lunch' })
    expect(savedCue).not.toHaveProperty('cueContextSuggestionId')
  })

  it('preserves a cue choice when going back and clears it after changing Pull', async () => {
    const repository = createMemoryRepository()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /set up my first plan/iu }),
    )
    fireEvent.click(screen.getByRole('radio', { name: /endless scrolling/iu }))
    fireEvent.click(
      screen.getByRole('button', { name: /confirm endless scrolling/iu }),
    )
    const inBed = screen.getByRole('radio', {
      name: /when i get into bed with my phone/iu,
    })
    fireEvent.click(inBed)
    fireEvent.click(screen.getByRole('button', { name: /back/iu }))
    fireEvent.click(
      screen.getByRole('button', { name: /confirm endless scrolling/iu }),
    )
    expect(
      screen.getByRole('radio', {
        name: /when i get into bed with my phone/iu,
      }),
    ).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: /back/iu }))
    fireEvent.click(screen.getByRole('radio', { name: /automatic snacking/iu }))
    fireEvent.click(
      screen.getByRole('button', { name: /confirm automatic snacking/iu }),
    )
    expect(
      screen.queryByRole('radio', {
        name: /when i get into bed with my phone/iu,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /choose side b/iu }),
    ).toBeDisabled()
    expect(repository.snapshot()).toBeNull()
  })

  it('preserves an unresolved injected string choice without inventing an id', async () => {
    const repository = createMemoryRepository()
    render(() => (
      <App
        config={LEGACY_STRING_SETUP_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /set up my first plan/iu }),
    )
    fireEvent.click(screen.getByRole('radio', { name: /endless scrolling/iu }))
    fireEvent.click(
      screen.getByRole('button', { name: /confirm endless scrolling/iu }),
    )
    fireEvent.click(screen.getByRole('radio', { name: /not sure yet/iu }))
    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))
    fireEvent.click(
      screen.getByRole('radio', {
        name: /look out the window for a moment/iu,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: /save my plan/iu }))

    await screen.findByRole('heading', {
      name: /a better choice, kept close/iu,
    })
    const savedCue = repository.snapshot()?.cues[0]
    expect(savedCue).toMatchObject({
      pullCategoryId: 'scrolling',
      pullText: 'Keep scrolling',
      bSideText: 'Look out the window for a moment.',
    })
    expect(savedCue).not.toHaveProperty('bSideSuggestionId')
  })

  it('fails closed to setup for a deprecated cinematic contract', async () => {
    const repository = createMemoryRepository()
    render(() => (
      <App
        config={LEGACY_CINEMATIC_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    expect(
      await screen.findByRole('heading', {
        name: /keep your better choice beside the moment/iu,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /corky’s introduction/iu }),
    ).not.toBeInTheDocument()
  })

  it('fails closed rather than running the pre-breath v0.4 delivery', async () => {
    const repository = createMemoryRepository()
    render(() => (
      <App
        config={LEGACY_V0_4_CINEMATIC_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    expect(
      await screen.findByRole('heading', {
        name: /keep your better choice beside the moment/iu,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /corky’s introduction/iu }),
    ).not.toBeInTheDocument()
  })

  it('saves exactly one real plan at Stop and reopens Home after a crash', async () => {
    const preferenceValues = new Map<string, string>()
    const onboardingPreferences = createCinematicOnboardingPreferenceStore({
      getItem: (key) => preferenceValues.get(key) ?? null,
      setItem: (key, value) => preferenceValues.set(key, value),
      removeItem: (key) => preferenceValues.delete(key),
    })
    const repository = createMemoryRepository()
    const view = render(() => (
      <App
        config={CINEMATIC_TEST_CONFIG}
        services={createTestServices(repository, { onboardingPreferences })}
      />
    ))

    expect(
      await screen.findByRole('heading', { name: 'Corky’s introduction' }),
    ).toBeInTheDocument()
    const save = screen.getByRole('button', { name: /save first side b/iu })
    fireEvent.click(save)
    fireEvent.click(save)

    await waitFor(() => {
      expect(repository.snapshot()?.cues).toMatchObject([
        {
          status: 'active',
          pullCategoryId: 'scrolling',
          pullText: 'Keep scrolling',
          bSideSuggestionId: 'bside.phone-away',
          bSideText: 'Put the phone in another room',
        },
      ])
    })
    expect(repository.saveCalls()).toBe(1)
    await waitFor(() =>
      expect(
        onboardingPreferences.read(CORKY_ONBOARDING_MEDIA_V0_9.revision),
      ).toMatchObject({ outcome: 'finished' }),
    )

    // Simulate a process stop after the commit boundary but before H08 closes.
    view.unmount()
    render(() => (
      <App
        config={CINEMATIC_TEST_CONFIG}
        services={createTestServices(repository, {
          onboardingPreferences,
        })}
      />
    ))
    expect(
      await screen.findByRole('heading', {
        name: /a better choice, kept close/iu,
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Your first plan')).not.toBeInTheDocument()
  })

  it('preserves unresolved injected scrolling choices in cinematic onboarding', async () => {
    const repository = createMemoryRepository()
    render(() => (
      <App
        config={LEGACY_STRING_CINEMATIC_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /save second side b/iu }),
    )

    await waitFor(() => expect(repository.snapshot()?.cues).toHaveLength(1))
    const savedCue = repository.snapshot()?.cues[0]
    expect(savedCue).toMatchObject({
      pullCategoryId: 'scrolling',
      pullText: 'Keep scrolling',
      bSideText: 'Look out the window for a moment.',
    })
    expect(savedCue).not.toHaveProperty('bSideSuggestionId')
  })

  it('finishes the film directly on Home and leaves no reminder when skipped', async () => {
    const repository = createMemoryRepository()
    render(() => (
      <App
        config={CINEMATIC_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /save first side b/iu }),
    )
    await waitFor(() => expect(repository.snapshot()?.cues).toHaveLength(1))
    fireEvent.click(
      screen.getByRole('button', { name: /skip onboarding reminder/iu }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /finish introduction/iu }),
    )

    expect(
      await screen.findByRole('heading', {
        name: /a better choice, kept close/iu,
      }),
    ).toBeInTheDocument()
    expect(repository.snapshot()?.scheduleRules).toEqual([])
    expect(screen.queryByText('Your first plan')).not.toBeInTheDocument()

    const tracks = screen
      .getByText('Keep scrolling')
      .closest('.active-sleeve__tracks')
    const art = document.querySelector('.active-sleeve__art')
    expect(tracks).not.toBeNull()
    expect(art).not.toBeNull()
    expect(tracks?.contains(art)).toBe(false)
    expect(art?.querySelector('img')?.getAttribute('src')).toContain(
      'corky-home-rest-v0_23-1024.webp',
    )
  })

  it('sets a real onboarding reminder only after the user asks', async () => {
    const repository = createMemoryRepository()
    const probe = createMobileRuntimeProbe({ permission: 'granted' })
    render(() => (
      <App
        config={CINEMATIC_TEST_CONFIG}
        services={createTestServices(repository, {
          platform: 'android',
          runtime: probe.runtime,
        })}
      />
    ))

    expect(probe.calls.permissionRequests).toBe(0)
    fireEvent.click(
      await screen.findByRole('button', { name: /save first side b/iu }),
    )
    await waitFor(() => expect(repository.snapshot()?.cues).toHaveLength(1))
    fireEvent.click(
      screen.getByRole('button', { name: /set onboarding reminder/iu }),
    )

    await waitFor(() => {
      expect(repository.snapshot()?.scheduleRules).toMatchObject([
        { kind: 'target_time', localTime: '09:00', enabled: true },
      ])
      expect(probe.calls.scheduled.at(-1)).toHaveLength(1)
    })
    expect(probe.calls.permissionRequests).toBe(0)
    fireEvent.click(
      screen.getByRole('button', { name: /finish introduction/iu }),
    )
    expect(
      await screen.findByText('Put the phone in another room'),
    ).toBeInTheDocument()
  })

  it('does not save a reminder when notification permission is denied', async () => {
    const repository = createMemoryRepository()
    const probe = createMobileRuntimeProbe({
      permission: 'prompt',
      requestedPermission: 'denied',
    })
    render(() => (
      <App
        config={CINEMATIC_TEST_CONFIG}
        services={createTestServices(repository, {
          platform: 'android',
          runtime: probe.runtime,
        })}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /save first side b/iu }),
    )
    await waitFor(() => expect(repository.snapshot()?.cues).toHaveLength(1))
    fireEvent.click(
      screen.getByRole('button', { name: /set onboarding reminder/iu }),
    )
    await waitFor(() => expect(probe.calls.permissionRequests).toBe(1))
    expect(repository.snapshot()?.scheduleRules).toEqual([])
    expect(probe.calls.scheduled).toHaveLength(0)
  })

  it('rolls back the reminder rule when the device scheduler fails', async () => {
    const repository = createMemoryRepository()
    const probe = createMobileRuntimeProbe({
      permission: 'granted',
      onSchedule: () => {
        throw new Error('Injected scheduler failure.')
      },
    })
    render(() => (
      <App
        config={CINEMATIC_TEST_CONFIG}
        services={createTestServices(repository, {
          platform: 'android',
          runtime: probe.runtime,
        })}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /save first side b/iu }),
    )
    await waitFor(() => expect(repository.snapshot()?.cues).toHaveLength(1))
    fireEvent.click(
      screen.getByRole('button', { name: /set onboarding reminder/iu }),
    )

    await waitFor(() => expect(repository.saveCalls()).toBe(3))
    expect(probe.calls.scheduled).toHaveLength(1)
    expect(repository.snapshot()?.scheduleRules).toEqual([])
  })

  it('replays Corky’s introduction without changing plan, history, or reminder', async () => {
    const repository = createMemoryRepository()
    const probe = createMobileRuntimeProbe({ permission: 'granted' })
    render(() => (
      <App
        config={CINEMATIC_TEST_CONFIG}
        services={createTestServices(repository, {
          platform: 'android',
          runtime: probe.runtime,
        })}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /save first side b/iu }),
    )
    await waitFor(() => expect(repository.snapshot()?.cues).toHaveLength(1))
    fireEvent.click(
      screen.getByRole('button', { name: /set onboarding reminder/iu }),
    )
    await waitFor(() =>
      expect(repository.snapshot()?.scheduleRules).toHaveLength(1),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /finish introduction/iu }),
    )

    fireEvent.click(await screen.findByRole('button', { name: /cue me now/iu }))
    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))
    await waitFor(() =>
      expect(repository.snapshot()?.occurrences).toMatchObject([
        { state: 'resolved', outcome: 'b_side' },
      ]),
    )
    await screen.findByText('Side B is yours')
    fireEvent.click(screen.getByRole('button', { name: /back to home/iu }))
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

    const beforeReplay = structuredClone(repository.snapshot())
    const saveCallsBeforeReplay = repository.saveCalls()
    const replayIntroduction = screen.getByRole('button', {
      name: /watch corky’s introduction again/iu,
    })
    expect(replayIntroduction.querySelector('svg')).toBeNull()
    fireEvent.click(replayIntroduction)
    expect(
      await screen.findByLabelText('Corky introduction test harness'),
    ).toHaveAttribute('data-rehearsal', 'true')

    // App-level guards keep review/replay safe even if a harness calls them.
    fireEvent.click(
      screen.getByRole('button', { name: /save second side b/iu }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /set onboarding reminder/iu }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /finish introduction/iu }),
    )

    expect(await screen.findByText('Current plan')).toBeInTheDocument()
    expect(repository.snapshot()).toEqual(beforeReplay)
    expect(repository.saveCalls()).toBe(saveCallsBeforeReplay)
  })

  it('keeps replacement atomic and preserves the current plan on cancel or save failure', async () => {
    const repository = createMemoryRepository()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    await saveFirstPlanFromWelcome()
    const original = structuredClone(repository.snapshot())
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(
      screen.getByText(/choose a new pull, cue, and side b/iu),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/pull, cue, and side b text.*stay local/iu),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /change this plan/iu }))
    await screen.findByRole('heading', {
      name: /which pull do you want to notice sooner/iu,
    })
    fireEvent.click(screen.getByRole('button', { name: /back/iu }))
    expect(repository.snapshot()).toEqual(original)
    expect(
      await screen.findByRole('heading', { name: 'Current plan' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /change this plan/iu }))
    await screen.findByRole('heading', {
      name: /which pull do you want to notice sooner/iu,
    })
    fireEvent.click(screen.getByRole('radio', { name: /automatic snacking/iu }))
    fireEvent.click(
      screen.getByRole('button', { name: /confirm automatic snacking/iu }),
    )
    fireEvent.click(
      screen.getByRole('radio', {
        name: /when i walk into the kitchen without a plan/iu,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))
    repository.failNextSave()
    fireEvent.click(screen.getByRole('button', { name: /save my plan/iu }))

    expect(
      await screen.findByText(/your current plan is still active/iu),
    ).toBeInTheDocument()
    expect(repository.snapshot()).toEqual(original)

    fireEvent.click(screen.getByRole('button', { name: /save my plan/iu }))
    await screen.findByRole('heading', {
      name: /a better choice, kept close/iu,
    })
    const cues = repository.snapshot()?.cues ?? []
    expect(cues.filter((cue) => cue.status === 'active')).toMatchObject([
      {
        pullCategoryId: 'snacking',
        pullText: 'Reach for a snack automatically',
        cueContextSuggestionId: 'anchor.snacking.enter-kitchen',
        cueContextText: 'When I walk into the kitchen without a plan.',
      },
    ])
    expect(cues.filter((cue) => cue.status === 'archived')).toHaveLength(1)
  })

  it('resets plan, history, reminder, and onboarding preference only after confirmation', async () => {
    const repository = createMemoryRepository()
    const probe = createMobileRuntimeProbe({ permission: 'granted' })
    const preferenceValues = new Map<string, string>()
    const onboardingPreferences = createCinematicOnboardingPreferenceStore({
      getItem: (key) => preferenceValues.get(key) ?? null,
      setItem: (key, value) => preferenceValues.set(key, value),
      removeItem: (key) => preferenceValues.delete(key),
    })
    onboardingPreferences.write(
      'reset-test',
      'finished',
      () => new Date('2026-08-06T10:00:00'),
    )
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, {
          platform: 'android',
          runtime: probe.runtime,
          onboardingPreferences,
        })}
      />
    ))

    await saveFirstPlanFromWelcome()
    fireEvent.click(screen.getByRole('button', { name: /cue me now/iu }))
    fireEvent.click(screen.getByRole('button', { name: /not now/iu }))
    await waitFor(() =>
      expect(repository.snapshot()?.occurrences).toHaveLength(1),
    )
    await screen.findByText('Not now is okay')
    fireEvent.click(screen.getByRole('button', { name: /back to home/iu }))
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(
      screen.getByRole('button', {
        name: /morning a small beginning 09:00/iu,
      }),
    )
    await waitFor(() =>
      expect(repository.snapshot()?.scheduleRules).toHaveLength(1),
    )
    const cancellationCount = probe.calls.cancelled.length

    const resetButton = screen.getByRole('button', {
      name: /reset all local data/iu,
    })
    await waitFor(() => expect(resetButton).toBeEnabled())
    fireEvent.click(resetButton)
    expect(repository.snapshot()?.cues).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent(
      /deletes your saved plan, choice history, reminder settings/iu,
    )
    fireEvent.click(screen.getByRole('button', { name: /confirm reset/iu }))

    expect(
      await screen.findByRole('heading', {
        name: /keep your better choice beside the moment/iu,
      }),
    ).toBeInTheDocument()
    expect(repository.snapshot()).toBeNull()
    expect(onboardingPreferences.read('reset-test')).toBeUndefined()
    await waitFor(() =>
      expect(probe.calls.cancelled.length).toBeGreaterThan(cancellationCount),
    )
  })

  it('completes the manual cue loop and records a literal reflection', async () => {
    const repository = createMemoryRepository()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    await saveFirstPlanFromWelcome()

    fireEvent.click(screen.getByRole('button', { name: /cue me now/iu }))
    expect(
      await screen.findByRole('heading', {
        name: /put the phone in another room/iu,
      }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))

    await waitFor(() => {
      expect(repository.snapshot()?.occurrences).toMatchObject([
        { state: 'resolved', outcome: 'b_side' },
      ])
    })

    await screen.findByText('Side B is yours')
    fireEvent.click(screen.getByRole('button', { name: /back to home/iu }))
    fireEvent.click(screen.getByRole('button', { name: /reflection/iu }))
    expect(
      screen.getByRole('heading', { name: /small turns leave a trace/iu }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Side B choice totals')).toHaveTextContent(
      /Today\s*1/iu,
    )
    expect(screen.getByText('Past 7 days')).toBeInTheDocument()
    expect(screen.getByText('Side B choices')).toBeInTheDocument()
  })

  it('waits for the durable choice commit and ignores rapid decisions while saving', async () => {
    const repository = createMemoryRepository()
    const probe = createMobileRuntimeProbe()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, { runtime: probe.runtime })}
      />
    ))

    await saveFirstPlanFromWelcome()
    fireEvent.click(screen.getByRole('button', { name: /cue me now/iu }))
    await screen.findByRole('heading', {
      name: /put the phone in another room/iu,
    })
    expect(repository.snapshot()?.occurrences).toMatchObject([
      { state: 'presented' },
    ])

    const saveGate = repository.deferNextSave()
    const saveCallsBeforeChoice = repository.saveCalls()
    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))

    expect(screen.getByRole('status')).toHaveTextContent(
      'Saving your choice on this device…',
    )
    const chooseButton = screen.getByRole('button', {
      name: /saving your choice/iu,
    })
    const notNowButton = screen.getByRole('button', { name: 'Saving…' })
    const closeButton = screen.getByRole('button', { name: /close cue/iu })
    expect(chooseButton).toBeDisabled()
    expect(notNowButton).toBeDisabled()
    expect(closeButton).toBeDisabled()
    expect(repository.snapshot()?.occurrences).toMatchObject([
      { state: 'presented' },
    ])
    expect(probe.calls.hapticNotifications).toEqual([])

    fireEvent.click(chooseButton)
    fireEvent.click(notNowButton)
    fireEvent.click(closeButton)
    expect(repository.saveCalls()).toBe(saveCallsBeforeChoice + 1)

    saveGate.resolve()
    expect(await screen.findByText('Side B is yours')).toBeInTheDocument()
    await waitFor(() =>
      expect(probe.calls.hapticNotifications).toEqual(['success']),
    )
    expect(repository.snapshot()?.occurrences).toMatchObject([
      { state: 'resolved', outcome: 'b_side' },
    ])
    expect(repository.snapshot()?.occurrences).toHaveLength(1)
  })

  it('keeps the cue actionable after a failed choice save and retries once', async () => {
    const repository = createMemoryRepository()
    const probe = createMobileRuntimeProbe()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, { runtime: probe.runtime })}
      />
    ))

    await saveFirstPlanFromWelcome()
    fireEvent.click(screen.getByRole('button', { name: /cue me now/iu }))
    await screen.findByRole('heading', {
      name: /put the phone in another room/iu,
    })
    repository.failNextSave()
    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your choice could not be saved on this device. Please try again.',
    )
    expect(
      screen.getByRole('button', { name: /choose side b/iu }),
    ).toBeEnabled()
    expect(repository.snapshot()?.occurrences).toMatchObject([
      { state: 'presented' },
    ])
    expect(probe.calls.hapticNotifications).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))
    expect(await screen.findByText('Side B is yours')).toBeInTheDocument()
    await waitFor(() =>
      expect(probe.calls.hapticNotifications).toEqual(['success']),
    )
    expect(repository.snapshot()?.occurrences).toMatchObject([
      { state: 'resolved', outcome: 'b_side' },
    ])
    expect(repository.snapshot()?.occurrences).toHaveLength(1)
  })

  it('commits Not now before its neutral handoff without offering a starter', async () => {
    const repository = createMemoryRepository()
    const probe = createMobileRuntimeProbe()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, { runtime: probe.runtime })}
      />
    ))

    await saveFirstPlanFromWelcome()
    fireEvent.click(screen.getByRole('button', { name: /cue me now/iu }))
    fireEvent.click(await screen.findByRole('button', { name: /not now/iu }))

    expect(await screen.findByText('Not now is okay')).toBeInTheDocument()
    expect(repository.snapshot()?.occurrences).toMatchObject([
      { state: 'resolved', outcome: 'not_now' },
    ])
    expect(repository.snapshot()?.occurrences).toHaveLength(1)
    expect(screen.queryByText('Your Side B')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /start .* timer/iu }),
    ).not.toBeInTheDocument()
    expect(probe.calls.hapticNotifications).toEqual([])
  })

  it('offers a canonical timer only after saving and reports one enabled completion haptic', async () => {
    const repository = createMemoryRepository(
      stateWithActiveCue({
        bSideSuggestionId: 'bside.step-outside',
        bSideText: 'Step outside for three minutes.',
      }),
    )
    const probe = createMobileRuntimeProbe()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, { runtime: probe.runtime })}
      />
    ))

    fireEvent.click(await screen.findByRole('button', { name: /cue me now/iu }))
    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))
    const startTimer = await screen.findByRole('button', {
      name: 'Start 3-minute timer',
    })
    await waitFor(() =>
      expect(probe.calls.hapticNotifications).toEqual(['success']),
    )
    const savedChoice = structuredClone(repository.snapshot())
    const saveCallsAfterChoice = repository.saveCalls()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z'))
    fireEvent.click(startTimer)
    expect(screen.getByRole('timer')).toHaveTextContent('03:00')

    vi.advanceTimersByTime(180_000)
    await vi.runAllTicks()
    await Promise.resolve()

    expect(
      screen.getByRole('heading', { name: 'Timer finished' }),
    ).toBeInTheDocument()
    expect(probe.calls.hapticNotifications).toEqual(['success', 'success'])
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(180_000)
    expect(probe.calls.hapticNotifications).toEqual(['success', 'success'])
    expect(repository.saveCalls()).toBe(saveCallsAfterChoice)
    expect(repository.snapshot()).toEqual(savedChoice)
  })

  it('does not play choice or timer-completion haptics when they are disabled', async () => {
    const repository = createMemoryRepository(
      stateWithActiveCue({
        bSideSuggestionId: 'bside.step-outside',
        bSideText: 'Step outside for three minutes.',
        hapticsEnabled: false,
      }),
    )
    const probe = createMobileRuntimeProbe()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, { runtime: probe.runtime })}
      />
    ))

    fireEvent.click(await screen.findByRole('button', { name: /cue me now/iu }))
    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))
    const startTimer = await screen.findByRole('button', {
      name: 'Start 3-minute timer',
    })

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z'))
    fireEvent.click(startTimer)
    vi.advanceTimersByTime(180_000)
    await vi.runAllTicks()
    await Promise.resolve()

    expect(
      screen.getByRole('heading', { name: 'Timer finished' }),
    ).toBeInTheDocument()
    expect(probe.calls.impacts).toEqual([])
    expect(probe.calls.hapticNotifications).toEqual([])
  })

  it('does not restore an ephemeral running timer after a process relaunch', async () => {
    const repository = createMemoryRepository(
      stateWithActiveCue({
        bSideSuggestionId: 'bside.step-outside',
        bSideText: 'Step outside for three minutes.',
      }),
    )
    const view = render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    fireEvent.click(await screen.findByRole('button', { name: /cue me now/iu }))
    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Start 3-minute timer',
      }),
    )
    expect(screen.getByRole('timer')).toHaveTextContent('03:00')
    const saveCallsWhileRunning = repository.saveCalls()

    view.unmount()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    expect(
      await screen.findByRole('heading', {
        name: /a better choice, kept close/iu,
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(repository.saveCalls()).toBe(saveCallsWhileRunning)
    expect(repository.snapshot()?.occurrences).toMatchObject([
      { state: 'resolved', outcome: 'b_side' },
    ])
    expect(repository.snapshot()?.occurrences).toHaveLength(1)
  })

  it('offers a timer for a known legacy Side B label without a saved id', async () => {
    const repository = createMemoryRepository(
      stateWithActiveCue({
        bSideText: 'Step outside for three minutes.',
      }),
    )
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    fireEvent.click(await screen.findByRole('button', { name: /cue me now/iu }))
    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))

    expect(
      await screen.findByRole('button', {
        name: 'Start 3-minute timer',
      }),
    ).toBeInTheDocument()
  })

  it.each([
    [
      'an unknown stable id',
      'bside.not-in-this-version',
      'Step outside for three minutes.',
    ],
    ['custom text', undefined, 'Put one clean plate away.'],
  ] as const)(
    'falls back to the exact instruction for %s',
    async (_caseName, bSideSuggestionId, bSideText) => {
      const repository = createMemoryRepository(
        stateWithActiveCue({ bSideSuggestionId, bSideText }),
      )
      render(() => (
        <App
          config={WELCOME_ONLY_TEST_CONFIG}
          services={createTestServices(repository)}
        />
      ))

      fireEvent.click(
        await screen.findByRole('button', { name: /cue me now/iu }),
      )
      fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))

      await screen.findByText('Your Side B')
      expect(
        screen.getByRole('heading', { name: bSideText }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /start .* timer/iu }),
      ).not.toBeInTheDocument()
    },
  )

  it('cancels a closed cue without recording Not now', async () => {
    const repository = createMemoryRepository()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    await saveFirstPlanFromWelcome()
    fireEvent.click(screen.getByRole('button', { name: /cue me now/iu }))
    fireEvent.click(screen.getByRole('button', { name: /close cue/iu }))

    expect(
      await screen.findByRole('heading', {
        name: /a better choice, kept close/iu,
      }),
    ).toBeInTheDocument()
    expect(repository.snapshot()?.occurrences).toMatchObject([
      { source: 'manual', state: 'cancelled' },
    ])
    expect(repository.snapshot()?.occurrences[0]).not.toHaveProperty('outcome')
  })

  it('keeps empty onboarding neutral and validates before continuing', async () => {
    const repository = createMemoryRepository()
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository)}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: /set up my first plan/iu }),
    )
    expect(
      screen.getByRole('button', { name: /confirm your pull/iu }),
    ).toBeDisabled()
    expect(repository.snapshot()).toBeNull()
  })

  it('keeps one configurable daily reminder through the shared notification port', async () => {
    const repository = createMemoryRepository()
    const probe = createMobileRuntimeProbe({ permission: 'granted' })
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, {
          platform: 'android',
          runtime: probe.runtime,
        })}
      />
    ))

    await saveFirstPlanFromWelcome()
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    fireEvent.click(
      screen.getByRole('button', {
        name: /morning a small beginning 09:00/iu,
      }),
    )

    await waitFor(() => {
      expect(repository.snapshot()?.scheduleRules).toMatchObject([
        {
          kind: 'target_time',
          localTime: '09:00',
          enabled: true,
        },
      ])
    })
    await waitFor(() => expect(probe.calls.scheduled.at(-1)).toHaveLength(1))
    expect(probe.calls.permissionRequests).toBe(0)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Reminder set for 9:00. You can change it in Settings.',
    )

    const scheduled = probe.calls.scheduled.at(-1)?.[0]
    if (scheduled === undefined) throw new Error('Expected a notification.')
    expect(scheduled.schedule).toEqual({
      kind: 'daily',
      hour: 9,
      minute: 0,
    })
    await probe.emitNotificationAction({
      notificationId: scheduled.id,
      actionId: 'open',
      extra: scheduled.extra,
    })

    expect(
      await screen.findByRole('heading', {
        name: /put the phone in another room/iu,
      }),
    ).toBeInTheDocument()
    expect(repository.snapshot()?.occurrences).toMatchObject([
      { source: 'scheduled', state: 'presented' },
    ])
  })

  it('starts a scheduled cue with fresh starter and timer-completion state', async () => {
    const repository = createMemoryRepository(
      withDailyRule(
        stateWithActiveCue({
          bSideSuggestionId: 'bside.step-outside',
          bSideText: 'Step outside for three minutes.',
        }),
      ),
    )
    const probe = createMobileRuntimeProbe({ permission: 'granted' })
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, {
          platform: 'android',
          runtime: probe.runtime,
        })}
      />
    ))

    await waitFor(() => expect(probe.calls.scheduled.at(-1)).toHaveLength(1))
    const scheduled = probe.calls.scheduled.at(-1)?.[0]
    if (scheduled === undefined) throw new Error('Expected a notification.')

    fireEvent.click(await screen.findByRole('button', { name: /cue me now/iu }))
    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))
    const firstTimer = await screen.findByRole('button', {
      name: 'Start 3-minute timer',
    })
    await waitFor(() =>
      expect(probe.calls.hapticNotifications).toEqual(['success']),
    )

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z'))
    fireEvent.click(firstTimer)
    vi.advanceTimersByTime(180_000)
    await vi.runAllTicks()
    await Promise.resolve()
    expect(probe.calls.hapticNotifications).toEqual(['success', 'success'])
    vi.useRealTimers()

    fireEvent.click(screen.getByRole('button', { name: /back to home/iu }))
    await probe.emitNotificationAction({
      notificationId: scheduled.id,
      actionId: 'open',
      extra: scheduled.extra,
    })

    expect(
      screen.getByRole('heading', {
        name: 'Step outside for three minutes.',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /start .* timer/iu }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))
    const scheduledTimer = await screen.findByRole('button', {
      name: 'Start 3-minute timer',
    })
    await waitFor(() =>
      expect(probe.calls.hapticNotifications).toEqual([
        'success',
        'success',
        'success',
      ]),
    )
    const saveCallsBeforeTimer = repository.saveCalls()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-28T13:00:00Z'))
    fireEvent.click(scheduledTimer)
    vi.advanceTimersByTime(180_000)
    await vi.runAllTicks()
    await Promise.resolve()

    expect(
      screen.getByRole('heading', { name: 'Timer finished' }),
    ).toBeInTheDocument()
    expect(probe.calls.hapticNotifications).toEqual([
      'success',
      'success',
      'success',
      'success',
    ])
    expect(repository.saveCalls()).toBe(saveCallsBeforeTimer)
    expect(repository.snapshot()?.occurrences).toMatchObject([
      { source: 'manual', state: 'resolved', outcome: 'b_side' },
      { source: 'scheduled', state: 'resolved', outcome: 'b_side' },
    ])
  })

  it('preserves choice history while a native reminder update is still settling', async () => {
    const repository = createMemoryRepository()
    const scheduleGate = deferred()
    const probe = createMobileRuntimeProbe({
      permission: 'granted',
      onSchedule: () => scheduleGate.promise,
    })
    render(() => (
      <App
        config={WELCOME_ONLY_TEST_CONFIG}
        services={createTestServices(repository, {
          platform: 'android',
          runtime: probe.runtime,
        })}
      />
    ))

    await saveFirstPlanFromWelcome()
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    fireEvent.click(
      screen.getByRole('button', {
        name: /morning a small beginning 09:00/iu,
      }),
    )

    await waitFor(() => expect(probe.calls.scheduled).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: /back/iu }))
    fireEvent.click(screen.getByRole('button', { name: /cue me now/iu }))
    fireEvent.click(screen.getByRole('button', { name: /choose side b/iu }))

    scheduleGate.resolve()
    await waitFor(() => {
      expect(repository.snapshot()?.occurrences).toMatchObject([
        { source: 'manual', state: 'resolved', outcome: 'b_side' },
      ])
      expect(repository.snapshot()?.scheduleRules).toMatchObject([
        { localTime: '09:00', enabled: true },
      ])
    })
  })
})
