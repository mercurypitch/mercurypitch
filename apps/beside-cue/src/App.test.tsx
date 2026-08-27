import type { BesideCueStateV1 } from '@irchiinnuss/beside-cue-core'
import { createInitialState } from '@irchiinnuss/beside-cue-core'
import type { MobileRuntime } from '@irchiinnuss/mobile-runtime'
import { createMobileRuntimeProbe } from '@irchiinnuss/mobile-runtime/testing'
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import type { BesideCueAppConfig } from './app-config'
import { DEFAULT_BESIDE_CUE_CONFIG } from './app-config'
import type { BesideCueAppServices } from './app-services'
import type { ResettableBesideCueRepository } from './infrastructure/indexed-db-repository'
import { CORKY_ONBOARDING_MEDIA_V0_7, CORKY_ONBOARDING_MEDIA_V0_8, CORKY_ONBOARDING_MEDIA_V0_9, } from './onboarding'
import { createCinematicOnboardingPreferenceStore } from './onboarding/cinematic-onboarding-preference'

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
    now: () => new Date('2026-08-06T10:00:00'),
    createId: () => `test-${String((nextId += 1))}`,
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
