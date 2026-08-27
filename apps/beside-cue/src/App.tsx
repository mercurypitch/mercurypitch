import type { BesideCueStateV1, Cue, CueOccurrenceOutcome, LocalDate, TargetTimeScheduleRule, } from '@irchiinnuss/beside-cue-core'
import { activateCue, aggregateSevenDayBSides, createCue, createInitialState, createManualOccurrence, createScheduledOccurrence, isDailyTargetTimeRule, normalizeCueText, pauseCue, presentCueOccurrence, recordOccurrenceOutcome, removeDailyTargetTimeRule, replaceCue, resumeCue, setDailyTargetTimeRule, updateDailyTargetTimeRule, } from '@irchiinnuss/beside-cue-core'
import type { LocalNotificationListenerHandle, MobileRuntime, } from '@irchiinnuss/mobile-runtime'
import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import type { BesideCueAppConfig } from './app-config'
import { DEFAULT_BESIDE_CUE_CONFIG } from './app-config'
import type { BesideCueAppServices } from './app-services'
import { createDefaultAppServices } from './app-services'
import type { MainView } from './components/BottomNav'
import { BrandMark } from './components/BrandMark'
import { MockPurchaseOverlay } from './components/MockPurchaseOverlay'
import { ProSection } from './components/ProSection'
import type { PullOption } from './content'
import { validateCinematicOnboardingMediaManifest } from './onboarding'
import type { CinematicOnboardingPreferenceStore } from './onboarding/cinematic-onboarding-preference'
import type { CinematicOnboardingBSideOption, CinematicOnboardingPlanSelection, CinematicOnboardingReminderResult, CinematicOnboardingSaveResult, } from './onboarding/CinematicOnboardingDirector'
import { CinematicOnboardingDirector } from './onboarding/CinematicOnboardingDirector'
import { createProAccess } from './purchases/pro-access'
import { PRO_DISPLAY_NAME } from './purchases/revenuecat-config'
import type { DailyCueCoordinator, DailyCueReconcileResult, } from './scheduling/daily-cue-coordinator'
import { createDailyCueCoordinator } from './scheduling/daily-cue-coordinator'
import type { DailyCueNotificationPayload } from './scheduling/daily-cue-plan'
import { decodeDailyCueNotificationPayload } from './scheduling/daily-cue-plan'
import { ChooseBSideScreen } from './screens/ChooseBSideScreen'
import { ChoosePullScreen } from './screens/ChoosePullScreen'
import { CueMomentScreen } from './screens/CueMomentScreen'
import { HomeScreen } from './screens/HomeScreen'
import { QuietScreen } from './screens/QuietScreen'
import type { ReflectionDay } from './screens/ReflectionScreen'
import { ReflectionScreen } from './screens/ReflectionScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'

type AppScreen =
  | 'loading'
  | 'load-error'
  | 'cinematic'
  | 'welcome'
  | 'choose-pull'
  | 'choose-b-side'
  | 'home'
  | 'cue-moment'
  | 'quiet'
  | 'reflection'
  | 'settings'

type SetupMode = 'create' | 'replace'

const CUSTOM_PULL_SUGGESTIONS = [
  'Walk outside for three minutes.',
  'Fill a glass of water.',
  'Begin one tiny part of something you care about.',
] as const

export interface AppProps {
  readonly config?: BesideCueAppConfig
  readonly services?: BesideCueAppServices
}

function currentCue(state: BesideCueStateV1): Cue | undefined {
  return state.cues.find(
    (cue) => cue.status === 'active' || cue.status === 'paused',
  )
}

function enabledDailyRule(
  state: BesideCueStateV1,
  cueId: string,
): TargetTimeScheduleRule | undefined {
  return state.scheduleRules.find(
    (rule): rule is TargetTimeScheduleRule =>
      rule.enabled && rule.cueId === cueId && isDailyTargetTimeRule(rule),
  )
}

function localDate(date: Date): LocalDate {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function plannedDailyInstant(localTime: string, openedAt: Date): Date {
  const [hoursText, minutesText] = localTime.split(':')
  const plannedAt = new Date(openedAt.getTime())
  plannedAt.setHours(Number(hoursText), Number(minutesText), 0, 0)
  if (plannedAt.getTime() > openedAt.getTime()) {
    plannedAt.setDate(plannedAt.getDate() - 1)
  }
  return plannedAt
}

function displayReminderTime(localTime: string): string {
  const [hours, minutes] = localTime.split(':')
  return `${String(Number(hours))}:${minutes ?? '00'}`
}

function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index % items.length]
  if (item === undefined) {
    throw new Error('Beside Cue content must include at least one phrase.')
  }
  return item
}

function messageForValidation(error: unknown, subject: string): string {
  if (error instanceof RangeError) {
    return `${subject} needs between 1 and 120 characters.`
  }
  return `We could not keep that ${subject.toLowerCase()}. Please try again.`
}

function firstRunScreen(
  state: BesideCueStateV1,
  onboarding: BesideCueAppConfig['onboarding'],
  preferences: CinematicOnboardingPreferenceStore,
): AppScreen {
  if (currentCue(state) !== undefined) return 'home'
  if (
    onboarding.delivery === 'cinematic-first-run' &&
    onboarding.contractVersion === '0.5.0' &&
    validateCinematicOnboardingMediaManifest(onboarding.media).length === 0 &&
    preferences.read(onboarding.revision) === undefined
  ) {
    return 'cinematic'
  }
  return 'welcome'
}

export function App(props: AppProps) {
  const config = createMemo(() => props.config ?? DEFAULT_BESIDE_CUE_CONFIG)
  const cinematicConfig = createMemo(() => {
    const onboarding = config().onboarding
    return onboarding.delivery === 'cinematic-first-run' &&
      onboarding.contractVersion === '0.5.0'
      ? onboarding
      : undefined
  })
  const services = createMemo(
    () => props.services ?? createDefaultAppServices(),
  )
  const initialState = createInitialState()
  const [appState, setAppState] = createSignal<BesideCueStateV1>(initialState)
  const [screen, setScreen] = createSignal<AppScreen>('loading')
  const [activeView, setActiveView] = createSignal<MainView>('cue')
  const [settingsReturnView, setSettingsReturnView] =
    createSignal<MainView>('cue')
  const [cinematicRehearsal, setCinematicRehearsal] = createSignal(false)
  const [setupMode, setSetupMode] = createSignal<SetupMode>('create')
  const [selectedPullId, setSelectedPullId] = createSignal<string>()
  const [customPullText, setCustomPullText] = createSignal('')
  const [selectedBSideText, setSelectedBSideText] = createSignal('')
  const [customBSideText, setCustomBSideText] = createSignal('')
  const [customBSideSelected, setCustomBSideSelected] = createSignal(false)
  const [setupError, setSetupError] = createSignal<string>()
  const [activeOccurrenceId, setActiveOccurrenceId] = createSignal<string>()
  const [cuePhrase, setCuePhrase] = createSignal('')
  const [quietMessage, setQuietMessage] = createSignal('')
  const [quietChoseBSide, setQuietChoseBSide] = createSignal(false)
  const [storageError, setStorageError] = createSignal<string>()
  const [resetArmed, setResetArmed] = createSignal(false)
  const [schedulePending, setSchedulePending] = createSignal(false)
  const [scheduleMessage, setScheduleMessage] = createSignal<string>()
  const [scheduleError, setScheduleError] = createSignal<string>()
  const [today, setToday] = createSignal(localDate(new Date()))
  const proAccess = createMemo(() => {
    const appServices = services()
    return createProAccess({
      runtime: appServices.runtime,
      setup: appServices.purchases,
    })
  })

  let dailyCueCoordinator!: DailyCueCoordinator
  let latestState = initialState
  let stateLoaded = false
  let disposed = false
  let midnightTimer: ReturnType<typeof setTimeout> | undefined
  let visibilityListener: (() => void) | undefined
  let pendingDailyCue: DailyCueNotificationPayload | undefined
  let notificationListener: LocalNotificationListenerHandle | undefined
  let onboardingPlanSavePromise:
    | Promise<CinematicOnboardingSaveResult>
    | undefined

  const cue = createMemo(() => currentCue(appState()))
  const dailyRule = createMemo(() => {
    const current = cue()
    return current === undefined
      ? undefined
      : enabledDailyRule(appState(), current.id)
  })
  const selectedPull = createMemo<PullOption | undefined>(() =>
    config().pullOptions.find((option) => option.id === selectedPullId()),
  )
  const pullText = createMemo(() =>
    selectedPullId() === 'custom'
      ? customPullText()
      : (selectedPull()?.label ?? ''),
  )
  const bSideSuggestions = createMemo(
    () => selectedPull()?.suggestions ?? CUSTOM_PULL_SUGGESTIONS,
  )
  const cinematicBSideOptions = createMemo<
    readonly CinematicOnboardingBSideOption[]
  >(() => {
    const scrolling = config().pullOptions.find(
      (option) => option.id === 'scrolling',
    )
    return (scrolling?.suggestions ?? []).map((suggestion) => ({
      text: suggestion.replace(/[.]$/, ''),
    }))
  })
  const progress = createMemo(() =>
    aggregateSevenDayBSides(appState(), today()),
  )
  const reflectionDays = createMemo<readonly ReflectionDay[]>(() =>
    progress().days.map((day) => ({
      key: day.date,
      label: new Date(`${day.date}T12:00:00`).toLocaleDateString(
        appState().settings.locale,
        { weekday: 'short' },
      ),
      count: day.count,
      today: day.date === today(),
    })),
  )

  function persistWithRepository(
    nextState: BesideCueStateV1,
    repository: BesideCueAppServices['repository'],
  ): void {
    latestState = nextState
    setAppState(nextState)
    setStorageError(undefined)
    void repository.saveState(nextState).catch(() => {
      setStorageError(
        'This change is visible now, but could not be saved on this device.',
      )
    })
  }

  async function persistDurablyWithRepository(
    nextState: BesideCueStateV1,
    repository: BesideCueAppServices['repository'],
  ): Promise<void> {
    latestState = nextState
    setAppState(nextState)
    setStorageError(undefined)
    try {
      await repository.saveState(nextState)
    } catch (error) {
      setStorageError(
        'This change is visible now, but could not be saved on this device.',
      )
      throw error
    }
  }

  async function persistAtomicallyWithRepository(
    nextState: BesideCueStateV1,
    repository: BesideCueAppServices['repository'],
  ): Promise<void> {
    setStorageError(undefined)
    try {
      await repository.saveState(nextState)
      latestState = nextState
      setAppState(nextState)
    } catch (error) {
      setStorageError('That change could not be saved on this device.')
      throw error
    }
  }

  function persist(nextState: BesideCueStateV1): void {
    persistWithRepository(nextState, services().repository)
  }

  function playHapticWithRuntime(
    enabled: boolean,
    kind: 'cue' | 'success' | 'quiet',
    runtimePromise: Promise<MobileRuntime>,
  ): void {
    if (!enabled) return

    void runtimePromise
      .then((runtime) => {
        if (kind === 'success') return runtime.haptics.notification('success')
        return runtime.haptics.impact(kind === 'cue' ? 'medium' : 'light')
      })
      .catch(() => undefined)
  }

  function playHaptic(
    enabled: boolean,
    kind: 'cue' | 'success' | 'quiet',
  ): void {
    playHapticWithRuntime(enabled, kind, services().runtime)
  }

  function dailyRuleForState(
    state: BesideCueStateV1,
  ): TargetTimeScheduleRule | undefined {
    const selectedCue = currentCue(state)
    if (selectedCue?.status !== 'active') return undefined
    return enabledDailyRule(state, selectedCue.id)
  }

  function messageForDailyCueResult(
    result: DailyCueReconcileResult,
  ): string | undefined {
    if (result === 'permission-denied') {
      return 'Daily reminder is off because notifications are off for this app.'
    }
    if (result === 'permission-needed') {
      return 'Daily reminder is off until notification permission is allowed.'
    }
    if (result === 'unsupported') {
      return 'Daily reminders are not available on this device.'
    }
    return undefined
  }

  function reconcileDailyCue(
    state: BesideCueStateV1,
    appConfig: BesideCueAppConfig,
    surfaceFailure: boolean,
  ): Promise<DailyCueReconcileResult> {
    const rule = dailyRuleForState(state)
    return dailyCueCoordinator
      .reconcile(rule, appConfig.dailyCue)
      .then((result) => {
        const message =
          rule === undefined ? undefined : messageForDailyCueResult(result)
        if (surfaceFailure && message !== undefined) setStorageError(message)
        return result
      })
      .catch((error: unknown) => {
        if (surfaceFailure) {
          setStorageError(
            rule === undefined
              ? 'The device reminder could not be removed. Open Settings and try again.'
              : 'Your reminder time is saved, but the device reminder could not be updated. Open Settings to retry.',
          )
        }
        throw error
      })
  }

  function restoreDailyCue(
    state: BesideCueStateV1,
    appConfig: BesideCueAppConfig,
  ): void {
    void reconcileDailyCue(state, appConfig, true).catch(() => undefined)
  }

  function presentDailyCue(
    payload: DailyCueNotificationPayload,
    appServices: BesideCueAppServices,
    appConfig: BesideCueAppConfig,
  ): void {
    if (!stateLoaded) {
      pendingDailyCue = payload
      return
    }

    const state = latestState
    const selectedCue = currentCue(state)
    const rule =
      selectedCue === undefined
        ? undefined
        : enabledDailyRule(state, selectedCue.id)
    if (
      selectedCue?.status !== 'active' ||
      selectedCue.id !== payload.cueId ||
      rule?.id !== payload.scheduleRuleId ||
      rule.updatedAt !== payload.scheduleRevision
    ) {
      return
    }

    try {
      const openedAt = appServices.now()
      const plannedAt = plannedDailyInstant(rule.localTime, openedAt)
      const occurrenceId = `daily:${rule.id}:${localDate(plannedAt)}`
      const existing = state.occurrences.find(
        (occurrence) => occurrence.id === occurrenceId,
      )
      let nextState = state
      let presentedId = occurrenceId

      if (existing === undefined) {
        const planned = createScheduledOccurrence(state, {
          id: occurrenceId,
          cueId: payload.cueId,
          scheduleRuleId: payload.scheduleRuleId,
          plannedFor: plannedAt.toISOString(),
        })
        nextState = planned.state
      } else if (existing.state !== 'planned') {
        if (existing.state !== 'presented') return
        presentedId = existing.id
      }

      const occurrence = nextState.occurrences.find(
        (candidate) => candidate.id === presentedId,
      )
      if (occurrence?.state === 'planned') {
        nextState = presentCueOccurrence(nextState, {
          occurrenceId: occurrence.id,
          openedAt: openedAt.toISOString(),
        }).state
      }

      const phraseIndex = nextState.occurrences.length - 1
      persistWithRepository(nextState, appServices.repository)
      setToday(localDate(openedAt))
      setActiveOccurrenceId(presentedId)
      setCuePhrase(itemAt(appConfig.cuePhrases, phraseIndex))
      playHapticWithRuntime(
        state.settings.hapticsEnabled,
        'cue',
        appServices.runtime,
      )
      setScreen('cue-moment')
    } catch {
      // A stale notification can arrive after its cue was paused or replaced.
      // In that case opening the app quietly lands on its current state.
    }
  }

  function listenForDailyCues(
    appServices: BesideCueAppServices,
    appConfig: BesideCueAppConfig,
  ): void {
    void appServices.runtime
      .then((runtime) =>
        runtime.localNotifications.addActionListener((action) => {
          const payload = decodeDailyCueNotificationPayload(action.extra)
          if (payload !== undefined) {
            presentDailyCue(payload, appServices, appConfig)
          }
        }),
      )
      .then((listener) => {
        if (disposed) {
          void listener.remove()
        } else {
          notificationListener = listener
        }
      })
      .catch(() => undefined)
  }

  function resetSetup(nextMode: SetupMode): void {
    setSetupMode(nextMode)
    setSelectedPullId(undefined)
    setCustomPullText('')
    setSelectedBSideText('')
    setCustomBSideText('')
    setCustomBSideSelected(false)
    setSetupError(undefined)
  }

  function beginSetup(nextMode: SetupMode): void {
    resetSetup(nextMode)
    setScreen('choose-pull')
  }

  function completeCinematicOnboarding(
    _outcome: 'finished' | 'dismissed',
  ): void {
    if (cinematicRehearsal()) {
      setCinematicRehearsal(false)
      setScreen(currentCue(latestState) === undefined ? 'welcome' : 'settings')
      return
    }

    const savedCue = currentCue(latestState)
    if (savedCue === undefined) {
      setScreen('welcome')
      return
    }

    setActiveView('cue')
    setScreen('home')
  }

  function saveCinematicPlan(
    selection: CinematicOnboardingPlanSelection,
  ): Promise<CinematicOnboardingSaveResult> {
    if (cinematicRehearsal()) {
      return Promise.resolve({ ok: true })
    }
    if (onboardingPlanSavePromise !== undefined) {
      return onboardingPlanSavePromise
    }

    const savePromise = (async (): Promise<CinematicOnboardingSaveResult> => {
      const appServices = services()
      const appConfig = config()
      const onboarding = appConfig.onboarding
      if (onboarding.delivery !== 'cinematic-first-run') {
        return {
          ok: false,
          message: 'This introduction is not available in this build.',
        }
      }

      try {
        const currentState = latestState
        const existingCue = currentCue(currentState)
        const at = appServices.now().toISOString()
        const cueInput = {
          id: appServices.createId(),
          pullCategoryId: selection.pullId,
          // The saved domain field is the visible Side A response. The fixed
          // Pull itself remains represented by pullCategoryId.
          pullText: normalizeCueText(selection.sideAText),
          ...(selection.bSideId === undefined
            ? {}
            : { bSideSuggestionId: selection.bSideId }),
          bSideText: normalizeCueText(selection.bSideText),
          mascotSetId: appConfig.mascotSetId,
          at,
        }
        const previousRule =
          existingCue === undefined
            ? undefined
            : enabledDailyRule(currentState, existingCue.id)
        const setupState =
          previousRule === undefined
            ? currentState
            : removeDailyTargetTimeRule(currentState, {
                ruleId: previousRule.id,
                at,
              }).state
        const nextState =
          existingCue === undefined
            ? activateCue(
                createCue(setupState, cueInput).state,
                cueInput.id,
                at,
              ).state
            : replaceCue(setupState, {
                ...cueInput,
                replacedCueId: existingCue.id,
              }).state

        await persistAtomicallyWithRepository(nextState, appServices.repository)
        appServices.onboardingPreferences.write(
          onboarding.revision,
          'finished',
          appServices.now,
        )
        if (previousRule !== undefined) {
          void reconcileDailyCue(nextState, appConfig, true).catch(
            () => undefined,
          )
        }
        setScheduleMessage(undefined)
        setScheduleError(undefined)
        setActiveView('cue')
        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          message:
            error instanceof RangeError
              ? 'Choose one small Side B, then try again.'
              : 'Your plan could not be saved on this device. Try again.',
        }
      }
    })()

    onboardingPlanSavePromise = savePromise
    void savePromise.then((result) => {
      if (!result.ok && onboardingPlanSavePromise === savePromise) {
        onboardingPlanSavePromise = undefined
      }
    })
    return savePromise
  }

  function choosePull(pullId: string): void {
    setSelectedPullId(pullId)
    setSetupError(undefined)
  }

  function continueFromPull(): void {
    try {
      normalizeCueText(pullText())
      setSelectedBSideText(bSideSuggestions()[0] ?? '')
      setCustomBSideSelected(false)
      setSetupError(undefined)
      setScreen('choose-b-side')
    } catch (error) {
      setSetupError(messageForValidation(error, 'Side A'))
    }
  }

  function chooseBSide(text: string): void {
    setSelectedBSideText(text)
    setCustomBSideSelected(false)
    setSetupError(undefined)
  }

  function finishSetup(): void {
    if (schedulePending()) return

    const currentState = latestState
    const existingCue = currentCue(currentState)
    const appServices = services()
    const appConfig = config()
    const now = appServices.now().toISOString()

    try {
      const normalizedPull = normalizeCueText(pullText())
      const normalizedBSide = normalizeCueText(
        customBSideSelected() ? customBSideText() : selectedBSideText(),
      )
      const cueInput = {
        id: appServices.createId(),
        ...(selectedPullId() === 'custom'
          ? {}
          : { pullCategoryId: selectedPullId() }),
        pullText: normalizedPull,
        ...(customBSideSelected()
          ? {}
          : { bSideSuggestionId: normalizedBSide }),
        bSideText: normalizedBSide,
        mascotSetId: appConfig.mascotSetId,
        at: now,
      }

      const replacing = setupMode() === 'replace' && existingCue !== undefined
      const previousRule =
        existingCue === undefined
          ? undefined
          : enabledDailyRule(currentState, existingCue.id)
      const setupState =
        replacing && previousRule !== undefined
          ? removeDailyTargetTimeRule(currentState, {
              ruleId: previousRule.id,
              at: now,
            }).state
          : currentState
      const nextState =
        replacing && existingCue !== undefined
          ? replaceCue(setupState, {
              ...cueInput,
              replacedCueId: existingCue.id,
            }).state
          : activateCue(createCue(setupState, cueInput).state, cueInput.id, now)
              .state

      setSchedulePending(true)
      setScheduleMessage(undefined)
      setScheduleError(undefined)
      void persistAtomicallyWithRepository(nextState, appServices.repository)
        .then(async () => {
          if (replacing) {
            await reconcileDailyCue(nextState, appConfig, true).catch(
              () => undefined,
            )
          }
          setSchedulePending(false)
          setActiveView('cue')
          setScreen('home')
        })
        .catch(() => {
          setSchedulePending(false)
          setSetupError(
            replacing
              ? 'Your current plan is still active. The new plan could not be saved; try again.'
              : 'Your plan could not be saved on this device. Try again.',
          )
        })
        .finally(() => setSchedulePending(false))
    } catch (error) {
      setSetupError(messageForValidation(error, 'Side B'))
    }
  }

  async function setDailyReminder(
    localTime: string,
  ): Promise<CinematicOnboardingReminderResult> {
    if (schedulePending()) {
      return {
        ok: false,
        message: 'A reminder update is already in progress.',
      }
    }

    const currentState = latestState
    const selectedCue = currentCue(currentState)
    if (selectedCue?.status !== 'active') {
      return {
        ok: false,
        message: 'Resume your plan before setting a daily reminder.',
      }
    }

    const appServices = services()
    const appConfig = config()
    const operationAt = appServices.now().toISOString()
    const existingRule = enabledDailyRule(currentState, selectedCue.id)
    const existingRuleId = existingRule?.id
    const ruleId = existingRuleId ?? appServices.createId()
    const applyRule = (state: BesideCueStateV1) =>
      existingRuleId === undefined
        ? setDailyTargetTimeRule(state, {
            id: ruleId,
            cueId: selectedCue.id,
            localTime,
            at: operationAt,
          })
        : updateDailyTargetTimeRule(state, {
            ruleId: existingRuleId,
            localTime,
            at: operationAt,
          })

    try {
      applyRule(currentState)
    } catch {
      const message = 'Choose a valid time and try again.'
      setScheduleError(message)
      setScheduleMessage(undefined)
      return { ok: false, message }
    }

    let savedRuleId: string | undefined
    const rollbackSavedRule = async (): Promise<void> => {
      if (savedRuleId === undefined) return
      const savedRule = latestState.scheduleRules.find(
        (rule) => rule.id === savedRuleId && rule.cueId === selectedCue.id,
      )
      if (savedRule === undefined) return

      const rolledBack =
        existingRule === undefined
          ? {
              ...latestState,
              scheduleRules: latestState.scheduleRules.filter(
                (rule) => rule.id !== savedRuleId,
              ),
            }
          : {
              ...latestState,
              scheduleRules: latestState.scheduleRules.map((rule) =>
                rule.id === existingRule.id ? existingRule : rule,
              ),
            }
      await persistAtomicallyWithRepository(rolledBack, appServices.repository)
      await dailyCueCoordinator.reconcile(existingRule, appConfig.dailyCue)
    }

    setSchedulePending(true)
    setScheduleError(undefined)
    setScheduleMessage(undefined)

    try {
      const permission = await dailyCueCoordinator.permission(true)
      if (appServices.platform !== 'web' && permission !== 'granted') {
        const message = 'Daily reminder is off. Cue me now still works.'
        setScheduleError(message)
        return { ok: false, message }
      }

      const rebased = applyRule(latestState)
      await persistAtomicallyWithRepository(
        rebased.state,
        appServices.repository,
      )
      savedRuleId = rebased.rule.id
      const result = await dailyCueCoordinator.reconcile(
        rebased.rule,
        appConfig.dailyCue,
      )
      if (result === 'scheduled' || result === 'foreground-only') {
        const time = displayReminderTime(localTime)
        const message =
          result === 'foreground-only'
            ? `Reminder set for ${time} while Beside Cue is open.`
            : `Reminder set for ${time}. You can change it in Settings.`
        setScheduleMessage(message)
        return { ok: true, message }
      }

      await rollbackSavedRule()
      const message = 'Daily reminder is off. Cue me now still works.'
      setScheduleError(message)
      return { ok: false, message }
    } catch {
      try {
        await rollbackSavedRule()
      } catch {
        // The storage alert already names the failed recovery. Keep the
        // reminder result literal so the film can continue with its saved plan.
      }
      const message = 'Daily reminder is off. Cue me now still works.'
      setScheduleError(message)
      return { ok: false, message }
    } finally {
      setSchedulePending(false)
    }
  }

  function keepDailyCue(localTime: string): void {
    void setDailyReminder(localTime)
  }

  function setCinematicReminder(
    localTime: string,
  ): Promise<CinematicOnboardingReminderResult> {
    if (cinematicRehearsal()) {
      return Promise.resolve({
        ok: true,
        message: 'Rehearsal only. Your reminder has not changed.',
      })
    }
    return setDailyReminder(localTime)
  }

  function disableDailyCue(): void {
    if (schedulePending()) return

    const currentState = appState()
    const selectedCue = currentCue(currentState)
    const rule =
      selectedCue === undefined
        ? undefined
        : enabledDailyRule(currentState, selectedCue.id)
    if (rule === undefined) {
      setScheduleMessage('Cue me now stays ready whenever you ask.')
      setScheduleError(undefined)
      return
    }

    const appServices = services()
    const nextState = removeDailyTargetTimeRule(latestState, {
      ruleId: rule.id,
      at: appServices.now().toISOString(),
    }).state
    const appConfig = config()

    setSchedulePending(true)
    setScheduleMessage(undefined)
    setScheduleError(undefined)
    void persistDurablyWithRepository(nextState, appServices.repository)
      .then(() => reconcileDailyCue(nextState, appConfig, false))
      .then((result) => {
        if (result !== 'cleared' && result !== 'superseded') {
          throw new Error('Daily reminder clear did not settle.')
        }
        setScheduleMessage('Cue me now stays ready whenever you ask.')
      })
      .catch(() => {
        setScheduleError(
          'The device could not remove that daily reminder. Please try again.',
        )
      })
      .finally(() => setSchedulePending(false))
  }

  function showManualCue(): void {
    const currentState = appState()
    const activeCue = currentCue(currentState)
    if (activeCue === undefined || activeCue.status !== 'active') return

    const appServices = services()
    const at = appServices.now().toISOString()
    const result = createManualOccurrence(currentState, {
      id: appServices.createId(),
      cueId: activeCue.id,
      at,
    })
    const phraseIndex = result.state.occurrences.length - 1

    persist(result.state)
    setToday(localDate(appServices.now()))
    setActiveOccurrenceId(result.occurrence.id)
    setCuePhrase(itemAt(config().cuePhrases, phraseIndex))
    playHaptic(currentState.settings.hapticsEnabled, 'cue')
    setScreen('cue-moment')
  }

  function resolveCue(outcome: CueOccurrenceOutcome): void {
    const currentState = appState()
    const occurrenceId = activeOccurrenceId()
    if (occurrenceId === undefined) {
      setScreen('home')
      return
    }

    const now = services().now()
    const result = recordOccurrenceOutcome(currentState, {
      occurrenceId,
      outcome,
      outcomeAt: now.toISOString(),
      outcomeLocalDate: localDate(now),
    })
    const acknowledgementIndex = result.state.occurrences.length - 1
    const choseBSide = outcome === 'b_side'
    const acknowledgements = choseBSide
      ? config().bSideAcknowledgements
      : config().notNowAcknowledgements

    persist(result.state)
    setToday(localDate(now))
    setActiveOccurrenceId(undefined)
    setQuietChoseBSide(choseBSide)
    setQuietMessage(itemAt(acknowledgements, acknowledgementIndex))
    playHaptic(
      currentState.settings.hapticsEnabled,
      choseBSide ? 'success' : 'quiet',
    )
    setScreen('quiet')
  }

  function togglePause(): void {
    if (schedulePending()) return

    const currentState = appState()
    const activeCue = currentCue(currentState)
    if (activeCue === undefined) return

    const appServices = services()
    const appConfig = config()
    const at = appServices.now().toISOString()
    const resuming = activeCue.status === 'paused'
    const result = resuming
      ? resumeCue(currentState, activeCue.id, at)
      : pauseCue(currentState, activeCue.id, at)
    setSchedulePending(true)
    void persistDurablyWithRepository(result.state, appServices.repository)
      .then(() => reconcileDailyCue(result.state, appConfig, true))
      .then((reconcileResult) => {
        setScheduleMessage(
          resuming ? 'Your plan is active again.' : 'Your plan is paused.',
        )
        const issue = resuming
          ? messageForDailyCueResult(reconcileResult)
          : undefined
        if (issue !== undefined) setScheduleError(issue)
      })
      .catch(() => {
        setScheduleError(
          resuming
            ? 'Your plan is active, but the daily reminder could not be restored.'
            : 'Your plan is paused, but the daily reminder could not be stopped.',
        )
      })
      .finally(() => setSchedulePending(false))
    setScheduleError(undefined)
    setResetArmed(false)
  }

  function changeMainView(view: MainView): void {
    setActiveView(view)
    setScreen(view === 'cue' ? 'home' : 'reflection')
  }

  function openSettings(): void {
    setSettingsReturnView(activeView())
    setResetArmed(false)
    setScheduleMessage(undefined)
    setScheduleError(undefined)
    setScreen('settings')
  }

  function replayIntroduction(): void {
    if (schedulePending()) return
    if (cinematicConfig() === undefined) {
      setStorageError('Corky’s introduction is not available in this build.')
      return
    }

    setResetArmed(false)
    setScheduleMessage(undefined)
    setScheduleError(undefined)
    setCinematicRehearsal(true)
    setScreen('cinematic')
  }

  function resetAllData(): void {
    if (schedulePending()) return

    if (!resetArmed()) {
      setResetArmed(true)
      return
    }

    setResetArmed(false)
    const appServices = services()
    const appConfig = config()
    setSchedulePending(true)
    void appServices.repository
      .clear()
      .then(() => {
        const nextState = createInitialState()
        latestState = nextState
        setAppState(nextState)
        onboardingPlanSavePromise = undefined
        setCinematicRehearsal(false)
        resetSetup('create')
        setScheduleMessage(undefined)
        setScheduleError(undefined)
        appServices.onboardingPreferences.clear()
        setScreen(
          firstRunScreen(
            nextState,
            appConfig.onboarding,
            appServices.onboardingPreferences,
          ),
        )
        return reconcileDailyCue(nextState, appConfig, true).catch(
          () => undefined,
        )
      })
      .catch(() => {
        setStorageError('Local data could not be reset. Please try again.')
      })
      .finally(() => setSchedulePending(false))
  }

  function load(): void {
    setScreen('loading')
    stateLoaded = false
    const appServices = services()
    const appConfig = config()
    void appServices.repository
      .loadState()
      .then((storedState) => {
        const nextState = storedState ?? createInitialState()
        onboardingPlanSavePromise = undefined
        setCinematicRehearsal(false)
        latestState = nextState
        stateLoaded = true
        setAppState(nextState)
        setScreen(
          firstRunScreen(
            nextState,
            appConfig.onboarding,
            appServices.onboardingPreferences,
          ),
        )
        restoreDailyCue(nextState, appConfig)
        if (pendingDailyCue !== undefined) {
          const pending = pendingDailyCue
          pendingDailyCue = undefined
          presentDailyCue(pending, appServices, appConfig)
        }
      })
      .catch(() => setScreen('load-error'))
  }

  function clearUnreadableData(): void {
    const appServices = services()
    const appConfig = config()
    setSchedulePending(true)
    void appServices.repository
      .clear()
      .then(() => {
        const nextState = createInitialState()
        latestState = nextState
        stateLoaded = true
        setAppState(nextState)
        onboardingPlanSavePromise = undefined
        setCinematicRehearsal(false)
        appServices.onboardingPreferences.clear()
        setScreen(
          firstRunScreen(
            nextState,
            appConfig.onboarding,
            appServices.onboardingPreferences,
          ),
        )
        return reconcileDailyCue(nextState, appConfig, true).catch(
          () => undefined,
        )
      })
      .catch(() =>
        setStorageError('Local data could not be reset. Please try again.'),
      )
      .finally(() => setSchedulePending(false))
  }

  function refreshLocalDay(appServices: BesideCueAppServices): void {
    const now = appServices.now()
    setToday(localDate(now))
    if (midnightTimer !== undefined) clearTimeout(midnightTimer)

    const nextDay = new Date(now.getTime())
    nextDay.setHours(24, 0, 0, 50)
    const delay = Math.max(1_000, nextDay.getTime() - now.getTime())
    midnightTimer = setTimeout(() => refreshLocalDay(appServices), delay)
  }

  onMount(() => {
    const appServices = services()
    const appConfig = config()
    dailyCueCoordinator = createDailyCueCoordinator(
      appServices.runtime,
      appServices.platform,
    )
    void proAccess().start()
    listenForDailyCues(appServices, appConfig)
    refreshLocalDay(appServices)
    visibilityListener = () => {
      if (document.visibilityState !== 'visible') return
      refreshLocalDay(appServices)
      restoreDailyCue(latestState, appConfig)
    }
    document.addEventListener('visibilitychange', visibilityListener)
    load()
  })

  onCleanup(() => {
    disposed = true
    if (midnightTimer !== undefined) clearTimeout(midnightTimer)
    if (visibilityListener !== undefined) {
      document.removeEventListener('visibilitychange', visibilityListener)
    }
    if (notificationListener !== undefined) {
      void notificationListener.remove()
    }
    void proAccess().dispose()
  })

  return (
    <>
      {screen() === 'loading' ? (
        <main class="system-screen app-screen" aria-busy="true">
          <BrandMark />
          <div>
            <p class="screen-kicker">Opening Beside Cue</p>
            <h1>Loading your plan…</h1>
          </div>
        </main>
      ) : null}

      {screen() === 'load-error' ? (
        <main
          class="system-screen app-screen"
          aria-labelledby="load-error-title"
        >
          <BrandMark />
          <div>
            <p class="screen-kicker">Saved data unavailable</p>
            <h1 id="load-error-title">Your saved data could not be opened.</h1>
            <p>
              Try again first. Deleting saved data removes your plan, choice
              history, reminder settings, and onboarding progress from this
              device.
            </p>
          </div>
          <div class="system-screen__actions">
            <button class="primary-button" type="button" onClick={load}>
              Try again
            </button>
            <button
              class="danger-button"
              type="button"
              onClick={clearUnreadableData}
            >
              Delete saved data
            </button>
          </div>
        </main>
      ) : null}

      {screen() === 'welcome' ? (
        <WelcomeScreen onBegin={() => beginSetup('create')} />
      ) : null}

      <Show
        when={screen() === 'cinematic' ? cinematicConfig() : undefined}
        keyed
      >
        {(onboarding) => (
          <CinematicOnboardingDirector
            media={onboarding.media}
            bSideOptions={cinematicBSideOptions()}
            onSavePlan={saveCinematicPlan}
            onSetReminder={setCinematicReminder}
            onSkipReminder={() => undefined}
            onComplete={completeCinematicOnboarding}
            rehearsal={cinematicRehearsal()}
          />
        )}
      </Show>

      {screen() === 'choose-pull' ? (
        <ChoosePullScreen
          options={config().pullOptions}
          selectedId={selectedPullId()}
          customText={customPullText()}
          error={setupError()}
          onSelect={choosePull}
          onCustomInput={(value) => {
            setCustomPullText(value)
            setSetupError(undefined)
          }}
          onBack={() =>
            setScreen(setupMode() === 'replace' ? 'settings' : 'welcome')
          }
          onContinue={continueFromPull}
        />
      ) : null}

      {screen() === 'choose-b-side' ? (
        <ChooseBSideScreen
          pullText={pullText()}
          suggestions={bSideSuggestions()}
          selectedText={selectedBSideText()}
          customText={customBSideText()}
          customSelected={customBSideSelected()}
          error={setupError()}
          pending={schedulePending()}
          onSelect={chooseBSide}
          onSelectCustom={() => {
            setCustomBSideSelected(true)
            setSetupError(undefined)
          }}
          onCustomInput={(value) => {
            setCustomBSideText(value)
            setSetupError(undefined)
          }}
          onBack={() => setScreen('choose-pull')}
          onContinue={finishSetup}
        />
      ) : null}

      {screen() === 'home' && cue() !== undefined ? (
        <HomeScreen
          pullText={cue()?.pullText ?? ''}
          bSideText={cue()?.bSideText ?? ''}
          todayCount={progress().today}
          weekCount={progress().total}
          paused={cue()?.status === 'paused'}
          cueStatePending={schedulePending()}
          activeView={activeView()}
          onChangeView={changeMainView}
          onCueNow={showManualCue}
          onPauseToggle={togglePause}
          onOpenSettings={openSettings}
        />
      ) : null}

      {screen() === 'cue-moment' && cue() !== undefined ? (
        <CueMomentScreen
          pullText={cue()?.pullText ?? ''}
          bSideText={cue()?.bSideText ?? ''}
          phrase={cuePhrase()}
          {...(cue()?.pullCategoryId === undefined
            ? {}
            : { pullId: cue()?.pullCategoryId })}
          onChooseBSide={() => resolveCue('b_side')}
          onNotNow={() => resolveCue('not_now')}
          onClose={() => resolveCue('not_now')}
        />
      ) : null}

      {screen() === 'quiet' ? (
        <QuietScreen
          choseBSide={quietChoseBSide()}
          message={quietMessage()}
          onDone={() => setScreen('home')}
        />
      ) : null}

      {screen() === 'reflection' ? (
        <ReflectionScreen
          todayCount={progress().today}
          weekCount={progress().total}
          days={reflectionDays()}
          activeView={activeView()}
          onChangeView={changeMainView}
          onOpenSettings={openSettings}
        />
      ) : null}

      {screen() === 'settings' && cue() !== undefined ? (
        <SettingsScreen
          proSection={
            <ProSection
              name={PRO_DISPLAY_NAME}
              available={proAccess().available()}
              status={proAccess().status()}
              isPro={proAccess().isPro()}
              entitlement={proAccess().entitlement()}
              busy={proAccess().busy()}
              notice={proAccess().notice()}
              error={proAccess().error()}
              locale={appState().settings.locale}
              onUpgrade={() => void proAccess().openPaywall()}
              onManage={() => void proAccess().openCustomerCenter()}
              onRestore={() => void proAccess().restore()}
            />
          }
          paused={cue()?.status === 'paused'}
          resetArmed={resetArmed()}
          dailyCuePresets={config().dailyCue.presets}
          scheduleTime={dailyRule()?.localTime}
          schedulePending={schedulePending()}
          scheduleMessage={scheduleMessage()}
          scheduleError={scheduleError()}
          onBack={() => changeMainView(settingsReturnView())}
          onPauseToggle={togglePause}
          onReplayIntroduction={replayIntroduction}
          onReplace={() => beginSetup('replace')}
          onSetSchedule={keepDailyCue}
          onDisableSchedule={disableDailyCue}
          onReset={resetAllData}
        />
      ) : null}

      <Show when={storageError()}>
        {(message) => (
          <div class="storage-alert" role="alert">
            <span>{message()}</span>
            <button type="button" onClick={() => setStorageError(undefined)}>
              Dismiss
            </button>
          </div>
        )}
      </Show>

      {/* Solid's JSX keeps the component reference past constant folding, so
          this markup does reach a production bundle — inert, because nothing
          outside a development build ever sets `mockPurchaseRequest`. The fake
          store behind it is dropped; only the empty shell remains. */}
      {import.meta.env.DEV ? (
        <Show when={services().mockPurchaseRequest}>
          {(mockRequest) => (
            <MockPurchaseOverlay
              request={mockRequest()}
              name={PRO_DISPLAY_NAME}
            />
          )}
        </Show>
      ) : null}
    </>
  )
}
