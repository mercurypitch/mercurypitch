import type { BesideCueStateV1 } from '@irchiinnuss/beside-cue-core'
import type { MobileRuntime } from '@irchiinnuss/mobile-runtime'
import { createMobileRuntimeProbe } from '@irchiinnuss/mobile-runtime/testing'
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'
import type { BesideCueAppConfig } from './app-config'
import { DEFAULT_BESIDE_CUE_CONFIG } from './app-config'
import type { BesideCueAppServices } from './app-services'
import type { ResettableBesideCueRepository } from './infrastructure/indexed-db-repository'
import { CORKY_ONBOARDING_MEDIA_V0_7, CORKY_ONBOARDING_MEDIA_V0_8, CORKY_ONBOARDING_MEDIA_V0_9, } from './onboarding'
import { createCinematicOnboardingPreferenceStore } from './onboarding/cinematic-onboarding-preference'

interface DirectorHarnessProps {
  readonly bSideOptions: readonly { readonly text: string }[]
  readonly onSavePlan: (selection: {
    readonly pullId: 'scrolling'
    readonly pullText: 'Endless scrolling'
    readonly sideAText: 'Keep scrolling'
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
    const selection = (bSideText: string) => ({
      pullId: 'scrolling' as const,
      pullText: 'Endless scrolling' as const,
      sideAText: 'Keep scrolling' as const,
      bSideText,
    })
    const firstSideB = () =>
      props.bSideOptions[0]?.text ?? 'Put the phone in another room'
    const secondSideB = () =>
      props.bSideOptions[1]?.text ?? 'Play one guitar riff'

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

function createMemoryRepository(): MemoryRepository {
  let state: BesideCueStateV1 | null = null
  let saves = 0
  let rejectNextSave = false

  return {
    async loadState() {
      return state
    },
    async saveState(nextState) {
      saves += 1
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
    screen.getByRole('button', { name: /choose what i’ll do instead/iu }),
  )
  fireEvent.click(screen.getByRole('button', { name: /save my plan/iu }))
  await screen.findByRole('heading', {
    name: /a better choice, kept close/iu,
  })
}

describe('Beside Cue app', () => {
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
      screen.getByRole('button', { name: /choose what i’ll do instead/iu }),
    )
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
      { pullCategoryId: 'snacking', pullText: 'Automatic snacking' },
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

    fireEvent.click(
      screen.getByRole('button', { name: /reset all local data/iu }),
    )
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
    fireEvent.click(
      screen.getByRole('button', { name: /choose what i’ll do instead/iu }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Side A needs between 1 and 120 characters.',
    )
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
