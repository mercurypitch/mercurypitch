import type { BesideCueStateV1, Cue, CueOccurrenceOutcome, LocalDate, TargetTimeScheduleRule, } from '@irchiinnuss/beside-cue-core'
import { activateCue, aggregateSevenDayBSides, cancelCueOccurrence, createCue, createInitialState, createManualOccurrence, createScheduledOccurrence, isDailyTargetTimeRule, normalizeCueText, pauseCue, presentCueOccurrence, recordOccurrenceOutcome, removeDailyTargetTimeRule, replaceCue, resumeCue, setDailyTargetTimeRule, updateDailyTargetTimeRule, } from '@irchiinnuss/beside-cue-core'
import type { LocalNotificationListenerHandle, MobileRuntime, } from '@irchiinnuss/mobile-runtime'
import { createMemo, createSignal, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { BuildStamp } from '@/components/BuildStamp'
import type { LocalActionStarter } from './action-starters/action-starter'
import { resolveLocalActionStarter } from './action-starters/action-starter'
import type { BesideCueAppConfig } from './app-config'
import { DEFAULT_BESIDE_CUE_CONFIG } from './app-config'
import type { BesideCueAppServices } from './app-services'
import { createDefaultAppServices } from './app-services'
import { createAudioSession } from './audio/audio-session'
import type { MainView } from './components/BottomNav'
import { BrandMark } from './components/BrandMark'
import { MockPurchaseOverlay } from './components/MockPurchaseOverlay'
import { ProSection } from './components/ProSection'
import type { ActionDefinition, ContentPack, PullOption, VoicePlaybackStatus, } from './content'
import { createVoicePlayer, CUSTOM_PULL_ACTIONS, DEFAULT_CONTENT_PACK, findLine, findPullCharacter, GENERIC_PULL_CHARACTER, resolveActionDefinition, resolveMoment, } from './content'
import { validateCinematicOnboardingMediaManifest } from './onboarding'
import type { CinematicOnboardingPreferenceStore } from './onboarding/cinematic-onboarding-preference'
import type { CinematicOnboardingBSideOption, CinematicOnboardingPlanSelection, CinematicOnboardingReminderResult, CinematicOnboardingSaveResult, } from './onboarding/CinematicOnboardingDirector'
import { CinematicOnboardingDirector } from './onboarding/CinematicOnboardingDirector'
import { V2_ONBOARDING_MEDIA_PACK } from './onboarding/v2-onboarding-media-pack'
import type { V2OnboardingPlanDraft, V2OnboardingSessionKind, } from './onboarding/v2-onboarding-runtime'
import type { V2OnboardingMutationResult } from './onboarding/V2OnboardingDirector'
import { V2OnboardingDirector } from './onboarding/V2OnboardingDirector'
import { createProAccess } from './purchases/pro-access'
import { PRO_DISPLAY_NAME } from './purchases/revenuecat-config'
import type { DailyCueCoordinator, DailyCueReconcileResult, } from './scheduling/daily-cue-coordinator'
import { createDailyCueCoordinator } from './scheduling/daily-cue-coordinator'
import type { DailyCueNotificationPayload } from './scheduling/daily-cue-plan'
import { decodeDailyCueNotificationPayload } from './scheduling/daily-cue-plan'
import { ChooseBSideScreen } from './screens/ChooseBSideScreen'
import type { CueContextSelection } from './screens/ChooseCueContextScreen'
import { ChooseCueContextScreen } from './screens/ChooseCueContextScreen'
import type { PullChoicePresentation, PullPreviewVoiceState, } from './screens/ChoosePullScreen'
import { ChoosePullScreen } from './screens/ChoosePullScreen'
import { CueMomentScreen } from './screens/CueMomentScreen'
import { GamesScreen } from './screens/GamesScreen'
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
  | 'v2-onboarding'
  | 'welcome'
  | 'choose-pull'
  | 'choose-cue-context'
  | 'choose-b-side'
  | 'home'
  | 'cue-moment'
  | 'quiet'
  | 'reflection'
  | 'settings'
  | 'games'

type SetupMode = 'create' | 'replace'

export interface AppProps {
  readonly config?: BesideCueAppConfig
  readonly services?: BesideCueAppServices
  /** Enables write-free V2 review navigation without changing the product flow. */
  readonly onboardingReview?: boolean
  /** A localized or recorded pack can be injected without changing app flow. */
  readonly contentPack?: ContentPack
}

interface BSideChoice {
  /** Selection identity only; legacy keys are never persisted as action ids. */
  readonly key: string
  readonly label: string
  /** Present only when this choice has a durable ActionDefinition identity. */
  readonly suggestionId?: string
}

function actionChoice(action: ActionDefinition): BSideChoice {
  return {
    key: action.id,
    label: action.label,
    suggestionId: action.id,
  }
}

function legacyChoice(
  pullId: string,
  suggestion: string,
  index: number,
): BSideChoice {
  const migrated = resolveActionDefinition(suggestion)
  return migrated === undefined
    ? {
        key: `legacy:${pullId}:${String(index)}`,
        label: suggestion,
      }
    : {
        key: migrated.id,
        label: suggestion,
        suggestionId: migrated.id,
      }
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
    onboarding.delivery === 'v2-first-run' &&
    onboarding.contractVersion === '1.0' &&
    preferences.read(onboarding.revision) === undefined
  ) {
    return 'v2-onboarding'
  }
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
  const contentPack = createMemo(
    () => props.contentPack ?? DEFAULT_CONTENT_PACK,
  )
  const cinematicConfig = createMemo(() => {
    const onboarding = config().onboarding
    return onboarding.delivery === 'cinematic-first-run' &&
      onboarding.contractVersion === '0.5.0'
      ? onboarding
      : undefined
  })
  const v2OnboardingConfig = createMemo(() => {
    const onboarding = config().onboarding
    return onboarding.delivery === 'v2-first-run' &&
      onboarding.contractVersion === '1.0'
      ? onboarding
      : undefined
  })
  const services = createMemo(
    () => props.services ?? createDefaultAppServices(),
  )
  const v2EntrySessionKind: V2OnboardingSessionKind = untrack(
    () => v2OnboardingConfig() !== undefined && props.onboardingReview === true,
  )
    ? 'developer-review'
    : 'first-run'
  const initialState = createInitialState()
  const [appState, setAppState] = createSignal<BesideCueStateV1>(initialState)
  const [screen, setScreen] = createSignal<AppScreen>('loading')
  const [activeView, setActiveView] = createSignal<MainView>('cue')
  const [settingsReturnView, setSettingsReturnView] =
    createSignal<MainView>('cue')
  const [cinematicRehearsal, setCinematicRehearsal] = createSignal(false)
  const [v2OnboardingSessionKind, setV2OnboardingSessionKind] =
    createSignal<V2OnboardingSessionKind>(v2EntrySessionKind)
  const [v2Muted, setV2Muted] = createSignal(
    !initialState.settings.voiceEnabled,
  )
  const [setupMode, setSetupMode] = createSignal<SetupMode>('create')
  const [selectedPullId, setSelectedPullId] = createSignal<string>()
  const [voiceStatus, setVoiceStatus] = createSignal<VoicePlaybackStatus>({
    phase: 'idle',
  })
  const [playedPullPreviewIds, setPlayedPullPreviewIds] = createSignal<
    readonly string[]
  >([])
  const [customPullText, setCustomPullText] = createSignal('')
  const [cueContextSelection, setCueContextSelection] =
    createSignal<CueContextSelection>()
  const [customCueContextText, setCustomCueContextText] = createSignal('')
  const [selectedBSideKey, setSelectedBSideKey] = createSignal<string>()
  const [selectedBSideText, setSelectedBSideText] = createSignal('')
  const [customBSideText, setCustomBSideText] = createSignal('')
  const [customBSideSelected, setCustomBSideSelected] = createSignal(false)
  const [setupError, setSetupError] = createSignal<string>()
  const [activeOccurrenceId, setActiveOccurrenceId] = createSignal<string>()
  const [cuePhrase, setCuePhrase] = createSignal('')
  const [quietMessage, setQuietMessage] = createSignal('')
  const [quietChoseBSide, setQuietChoseBSide] = createSignal(false)
  const [quietStarter, setQuietStarter] = createSignal<LocalActionStarter>()
  const [cueResolutionPending, setCueResolutionPending] = createSignal(false)
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
  let pageHideListener: (() => void) | undefined
  let pageShowListener: (() => void) | undefined
  let pendingDailyCue: DailyCueNotificationPayload | undefined
  let notificationListener: LocalNotificationListenerHandle | undefined
  let pullPreviewRequest = 0
  let characterVoiceForeground =
    typeof document === 'undefined' || document.visibilityState === 'visible'
  const [v2OnboardingForeground, setV2OnboardingForeground] = createSignal(
    characterVoiceForeground,
  )
  const attemptedPullPreviews = new Set<string>()
  let cueResolutionInFlight = false
  let timerCompletionHapticPlayed = false
  let onboardingPlanSavePromise:
    | Promise<CinematicOnboardingSaveResult>
    | undefined
  let v2OnboardingPlanSavePromise:
    | Promise<V2OnboardingMutationResult>
    | undefined
  const onboardingAudioSession = createAudioSession({
    manifest: untrack(contentPack).audio,
    output: untrack(services).audioOutput,
    muted: !initialState.settings.voiceEnabled,
    foreground: characterVoiceForeground,
    // The V2.4 score stem already carries its approved opening dialogue
    // automation. Preserve that authored gain instead of ducking it twice.
    dialogueDuckGain: 1,
  })
  const characterVoicePlayer = createVoicePlayer({
    pack: untrack(contentPack),
    audio: untrack(services).voiceAudio,
    muted: () => !latestState.settings.voiceEnabled,
    onStatusChange: setVoiceStatus,
  })

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
  const pullChoicePresentations = createMemo<readonly PullChoicePresentation[]>(
    () => [
      ...config().pullOptions.flatMap((option) => {
        const character = findPullCharacter(contentPack(), option.id)
        if (character === undefined) return []
        const line =
          option.previewLineId === undefined
            ? undefined
            : findLine(contentPack(), option.previewLineId)
        return [
          {
            pullId: option.id,
            art: character.token,
            previewCaption: line?.text ?? option.moment,
            recordingAvailable:
              line !== undefined && characterVoicePlayer.hasRecording(line.id),
          },
        ]
      }),
      {
        pullId: 'custom',
        art: GENERIC_PULL_CHARACTER.token,
        previewCaption:
          'Use your own words for the familiar moment you want to notice sooner.',
        recordingAvailable: false,
      },
    ],
  )
  const selectedPullPreviewVoiceState = createMemo<PullPreviewVoiceState>(
    () => {
      const selectedId = selectedPullId()
      if (selectedId === undefined) return 'unavailable'
      const presentation = pullChoicePresentations().find(
        (candidate) => candidate.pullId === selectedId,
      )
      if (presentation?.recordingAvailable !== true) return 'unavailable'
      const previewLineId = config().pullOptions.find(
        (option) => option.id === selectedId,
      )?.previewLineId
      if (
        previewLineId === undefined ||
        !characterVoicePlayer.canPlayLine(previewLineId)
      ) {
        return 'unavailable'
      }
      if (!appState().settings.voiceEnabled) return 'muted'

      const status = voiceStatus()
      if (
        status.phase !== 'idle' &&
        previewLineId !== undefined &&
        status.lineId === previewLineId
      ) {
        return status.phase
      }
      return playedPullPreviewIds().includes(selectedId) ? 'played' : 'idle'
    },
  )
  const selectedPullLabel = createMemo(() =>
    selectedPullId() === 'custom'
      ? customPullText()
      : (selectedPull()?.label ?? ''),
  )
  const selectedSideAText = createMemo(() =>
    selectedPullId() === 'custom'
      ? customPullText()
      : (selectedPull()?.defaultSideAText ?? selectedPull()?.label ?? ''),
  )
  const cueContextChoices = createMemo(() =>
    (selectedPull()?.anchorSuggestions ?? []).map((suggestion) => ({
      id: suggestion.id,
      label: suggestion.text,
    })),
  )
  const bSideChoices = createMemo<readonly BSideChoice[]>(() => {
    const pull = selectedPull()
    if (pull?.bSideSuggestions !== undefined) {
      return pull.bSideSuggestions.map(actionChoice)
    }
    const legacy = (pull?.suggestions ?? []).map((suggestion, index) =>
      legacyChoice(pull?.id ?? 'custom', suggestion, index),
    )
    return legacy.length > 0 ? legacy : CUSTOM_PULL_ACTIONS.map(actionChoice)
  })
  const cinematicBSideOptions = createMemo<
    readonly CinematicOnboardingBSideOption[]
  >(() => {
    const scrolling = config().pullOptions.find(
      (option) => option.id === 'scrolling',
    )
    if (scrolling?.bSideSuggestions !== undefined) {
      return scrolling.bSideSuggestions.map((action) => ({
        id: action.id,
        text: action.label.replace(/[.]$/, ''),
      }))
    }
    if (scrolling !== undefined && scrolling.suggestions.length > 0) {
      return scrolling.suggestions.map((suggestion) => {
        const action = resolveActionDefinition(suggestion)
        return action === undefined
          ? { text: suggestion }
          : {
              id: action.id,
              text: suggestion,
            }
      })
    }
    return CUSTOM_PULL_ACTIONS.map((action) => ({
      id: action.id,
      text: action.label.replace(/[.]$/, ''),
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

  function playTimeDialHaptic(strength: 'light' | 'medium'): void {
    const enabled = appState().settings.hapticsEnabled
    const runtimePromise = services().runtime
    if (!enabled) return

    void runtimePromise
      .then((runtime) => runtime.haptics.impact(strength))
      .catch(() => undefined)
  }

  function prepareCueMomentEntry(): void {
    setCueResolutionPending(false)
    setQuietStarter(undefined)
    timerCompletionHapticPlayed = false
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
  ): void {
    if (!stateLoaded) {
      pendingDailyCue = payload
      return
    }
    if (cueResolutionInFlight) return

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
      const presentation = resolveMoment(contentPack(), 'cue.open', {
        pullId: selectedCue.pullCategoryId,
        rotation: phraseIndex,
      })
      prepareCueMomentEntry()
      stopCharacterVoice('route-exit')
      persistWithRepository(nextState, appServices.repository)
      setToday(localDate(openedAt))
      setActiveOccurrenceId(presentedId)
      setCuePhrase(presentation.line.text)
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

  function listenForDailyCues(appServices: BesideCueAppServices): void {
    void appServices.runtime
      .then((runtime) =>
        runtime.localNotifications.addActionListener((action) => {
          const payload = decodeDailyCueNotificationPayload(action.extra)
          if (payload !== undefined) {
            untrack(() => presentDailyCue(payload, appServices))
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
    stopCharacterVoice('route-exit')
    attemptedPullPreviews.clear()
    setPlayedPullPreviewIds([])
    setCustomPullText('')
    setCueContextSelection(undefined)
    setCustomCueContextText('')
    setSelectedBSideKey(undefined)
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

  function completeV2Onboarding(): void {
    if (v2OnboardingSessionKind() !== 'first-run') {
      const persistedMuted = !latestState.settings.voiceEnabled
      setV2Muted(persistedMuted)
      onboardingAudioSession.setMuted(persistedMuted)
      setScreen(currentCue(latestState) === undefined ? 'welcome' : 'settings')
      return
    }

    if (currentCue(latestState) === undefined) {
      setScreen('welcome')
      return
    }

    setActiveView('cue')
    setScreen('home')
  }

  function saveV2OnboardingPlan(
    plan: V2OnboardingPlanDraft,
  ): Promise<V2OnboardingMutationResult> {
    if (
      v2OnboardingSessionKind() !== 'first-run' ||
      screen() !== 'v2-onboarding'
    ) {
      return Promise.resolve({ ok: true })
    }
    if (v2OnboardingPlanSavePromise !== undefined) {
      return v2OnboardingPlanSavePromise
    }

    const savePromise = (async (): Promise<V2OnboardingMutationResult> => {
      const appServices = services()
      const appConfig = config()
      const onboarding = appConfig.onboarding
      if (
        onboarding.delivery !== 'v2-first-run' ||
        onboarding.contractVersion !== '1.0'
      ) {
        return {
          ok: false,
          message: 'This V2 introduction is not available in this build.',
        }
      }

      try {
        const currentState = latestState
        const existingCue = currentCue(currentState)
        const at = appServices.now().toISOString()
        const cueInput = {
          id: appServices.createId(),
          ...(plan.pullId === 'custom' ? {} : { pullCategoryId: plan.pullId }),
          pullText: normalizeCueText(plan.sideAText),
          ...(plan.bSideSuggestionId === undefined
            ? {}
            : { bSideSuggestionId: plan.bSideSuggestionId }),
          bSideText: normalizeCueText(plan.bSideText),
          ...(plan.cueContextSuggestionId === undefined
            ? {}
            : { cueContextSuggestionId: plan.cueContextSuggestionId }),
          ...(plan.cueContextText === undefined
            ? {}
            : { cueContextText: normalizeCueText(plan.cueContextText) }),
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
              ? 'Choose one clear Side A and Side B, then try again.'
              : 'Your plan could not be saved on this device. Try again.',
        }
      }
    })()

    v2OnboardingPlanSavePromise = savePromise
    void savePromise.then((result) => {
      if (!result.ok && v2OnboardingPlanSavePromise === savePromise) {
        v2OnboardingPlanSavePromise = undefined
      }
    })
    return savePromise
  }

  function choosePull(pullId: string): void {
    const selectionChanged = selectedPullId() !== pullId
    if (selectionChanged) {
      setCueContextSelection(undefined)
      setCustomCueContextText('')
      setSelectedBSideKey(undefined)
      setSelectedBSideText('')
      setCustomBSideText('')
      setCustomBSideSelected(false)
    }
    setSelectedPullId(pullId)
    setSetupError(undefined)
    if (selectionChanged) stopCharacterVoice('replaced')
    if (selectionChanged && !attemptedPullPreviews.has(pullId)) {
      attemptedPullPreviews.add(pullId)
      playPullPreview(pullId)
    }
  }

  function stopCharacterVoice(
    reason: Parameters<typeof characterVoicePlayer.stop>[0] = 'user',
  ): void {
    pullPreviewRequest += 1
    characterVoicePlayer.stop(reason)
  }

  function playPullPreview(pullId: string): void {
    const request = (pullPreviewRequest += 1)
    const previewLineId = config().pullOptions.find(
      (option) => option.id === pullId,
    )?.previewLineId
    if (
      previewLineId === undefined ||
      !characterVoicePlayer.canPlayLine(previewLineId)
    ) {
      stopCharacterVoice('replaced')
      return
    }
    const cue = characterVoicePlayer.playLine(previewLineId)
    void cue.started.then((result) => {
      if (result.kind !== 'started' || pullPreviewRequest !== request) return
      setPlayedPullPreviewIds((current) =>
        current.includes(pullId) ? current : [...current, pullId],
      )
    })
  }

  function continueFromPull(): void {
    try {
      normalizeCueText(selectedPullLabel())
      setSetupError(undefined)
      stopCharacterVoice('route-exit')
      setScreen('choose-cue-context')
    } catch (error) {
      setSetupError(messageForValidation(error, 'Side A'))
    }
  }

  function continueFromCueContext(): void {
    const selection = cueContextSelection()
    if (selection === undefined) {
      setSetupError('Choose a cue moment, or choose Not sure yet.')
      return
    }

    try {
      if (selection.kind === 'suggested') {
        const suggestion = selectedPull()?.anchorSuggestions?.find(
          (candidate) => candidate.id === selection.id,
        )
        if (suggestion === undefined) {
          setSetupError('Choose one of the cue moments shown here.')
          return
        }
        normalizeCueText(suggestion.text)
      } else if (selection.kind === 'custom') {
        normalizeCueText(customCueContextText())
      }

      const selectedChoice = bSideChoices().find(
        (choice) => choice.key === selectedBSideKey(),
      )
      if (selectedChoice === undefined && !customBSideSelected()) {
        const firstChoice = bSideChoices()[0]
        setSelectedBSideKey(firstChoice?.key)
        setSelectedBSideText(firstChoice?.label ?? '')
        setCustomBSideSelected(false)
      }
      setSetupError(undefined)
      setScreen('choose-b-side')
    } catch (error) {
      setSetupError(messageForValidation(error, 'Your cue'))
    }
  }

  function chooseBSide(choiceKey: string): void {
    const choice = bSideChoices().find((item) => item.key === choiceKey)
    if (choice === undefined) return
    setSelectedBSideKey(choice.key)
    setSelectedBSideText(choice.label)
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
      const normalizedPull = normalizeCueText(selectedSideAText())
      const normalizedBSide = normalizeCueText(
        customBSideSelected() ? customBSideText() : selectedBSideText(),
      )
      const selectedChoice = bSideChoices().find(
        (choice) => choice.key === selectedBSideKey(),
      )
      const selectedContext = cueContextSelection()
      const suggestedContext =
        selectedContext?.kind === 'suggested'
          ? selectedPull()?.anchorSuggestions?.find(
              (suggestion) => suggestion.id === selectedContext.id,
            )
          : undefined
      const normalizedCueContext =
        selectedContext?.kind === 'custom'
          ? normalizeCueText(customCueContextText())
          : suggestedContext === undefined
            ? undefined
            : normalizeCueText(suggestedContext.text)
      const cueInput = {
        id: appServices.createId(),
        ...(selectedPullId() === 'custom'
          ? {}
          : { pullCategoryId: selectedPullId() }),
        pullText: normalizedPull,
        ...(customBSideSelected() || selectedChoice?.suggestionId === undefined
          ? {}
          : { bSideSuggestionId: selectedChoice.suggestionId }),
        bSideText: normalizedBSide,
        ...(suggestedContext === undefined
          ? {}
          : { cueContextSuggestionId: suggestedContext.id }),
        ...(normalizedCueContext === undefined
          ? {}
          : { cueContextText: normalizedCueContext }),
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

  async function setV2OnboardingReminder(
    localTime: string,
  ): Promise<V2OnboardingMutationResult> {
    if (
      v2OnboardingSessionKind() !== 'first-run' ||
      screen() !== 'v2-onboarding'
    ) {
      return { ok: true }
    }

    const result = await setDailyReminder(localTime)
    return result.ok ? { ok: true } : { ok: false, message: result.message }
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
    const presentation = resolveMoment(contentPack(), 'cue.open', {
      pullId: activeCue.pullCategoryId,
      rotation: phraseIndex,
    })

    prepareCueMomentEntry()
    persist(result.state)
    setToday(localDate(appServices.now()))
    setActiveOccurrenceId(result.occurrence.id)
    setCuePhrase(presentation.line.text)
    characterVoicePlayer.playLine(presentation.line.id)
    playHaptic(currentState.settings.hapticsEnabled, 'cue')
    setScreen('cue-moment')
  }

  async function resolveCue(outcome: CueOccurrenceOutcome): Promise<void> {
    if (cueResolutionInFlight) return

    const currentState = appState()
    const occurrenceId = activeOccurrenceId()
    if (occurrenceId === undefined) {
      setScreen('home')
      return
    }

    cueResolutionInFlight = true
    setCueResolutionPending(true)

    try {
      const appServices = services()
      const now = appServices.now()
      const result = recordOccurrenceOutcome(currentState, {
        occurrenceId,
        outcome,
        outcomeAt: now.toISOString(),
        outcomeLocalDate: localDate(now),
      })
      const acknowledgementIndex = result.state.occurrences.length - 1
      const choseBSide = outcome === 'b_side'
      const acknowledgement = resolveMoment(
        contentPack(),
        choseBSide ? 'turn.b-side' : 'turn.a-side',
        { rotation: acknowledgementIndex },
      )
      const occurrenceCue = result.state.cues.find(
        (candidate) => candidate.id === result.occurrence.cueId,
      )
      const starter =
        choseBSide && occurrenceCue !== undefined
          ? resolveLocalActionStarter(occurrenceCue)
          : undefined

      await persistAtomicallyWithRepository(
        result.state,
        appServices.repository,
      )
      if (disposed) return

      setToday(localDate(now))
      setActiveOccurrenceId(undefined)
      setQuietChoseBSide(choseBSide)
      setQuietMessage(acknowledgement.line.text)
      setQuietStarter(starter)
      if (characterVoiceForeground) {
        characterVoicePlayer.playLine(acknowledgement.line.id)
      }
      playHaptic(
        currentState.settings.hapticsEnabled,
        choseBSide ? 'success' : 'quiet',
      )
      setScreen('quiet')
    } catch {
      if (!disposed) {
        setStorageError(
          'Your choice could not be saved on this device. Please try again.',
        )
      }
    } finally {
      cueResolutionInFlight = false
      if (!disposed) setCueResolutionPending(false)
    }
  }

  function cancelCueMoment(): void {
    if (cueResolutionInFlight) return

    stopCharacterVoice('route-exit')
    const occurrenceId = activeOccurrenceId()
    if (occurrenceId === undefined) {
      setScreen('home')
      return
    }

    const result = cancelCueOccurrence(appState(), { occurrenceId })
    persist(result.state)
    setActiveOccurrenceId(undefined)
    setScreen('home')
  }

  function completeQuietTimer(): void {
    if (timerCompletionHapticPlayed) return
    timerCompletionHapticPlayed = true
    playHaptic(latestState.settings.hapticsEnabled, 'success')
  }

  function finishQuietScreen(): void {
    stopCharacterVoice('route-exit')
    setQuietStarter(undefined)
    setScreen('home')
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
    stopCharacterVoice('route-exit')
    setActiveView(view)
    setScreen(view === 'cue' ? 'home' : 'reflection')
  }

  function openSettings(): void {
    stopCharacterVoice('route-exit')
    setSettingsReturnView(activeView())
    setResetArmed(false)
    setScheduleMessage(undefined)
    setScheduleError(undefined)
    setScreen('settings')
  }

  function setCharacterVoiceEnabled(voiceEnabled: boolean): void {
    const currentState = latestState
    if (currentState.settings.voiceEnabled === voiceEnabled) return
    if (!voiceEnabled) {
      stopCharacterVoice('muted')
    }
    setV2Muted(!voiceEnabled)
    onboardingAudioSession.setMuted(!voiceEnabled)
    persist({
      ...currentState,
      settings: { ...currentState.settings, voiceEnabled },
    })
  }

  function toggleCharacterVoice(): void {
    setCharacterVoiceEnabled(!latestState.settings.voiceEnabled)
  }

  function setV2OnboardingMuted(muted: boolean): void {
    setV2Muted(muted)
    onboardingAudioSession.setMuted(muted)
    if (muted) stopCharacterVoice('muted')

    if (
      v2OnboardingSessionKind() !== 'first-run' ||
      screen() !== 'v2-onboarding'
    ) {
      return
    }

    const voiceEnabled = !muted
    const currentState = latestState
    if (currentState.settings.voiceEnabled === voiceEnabled) return
    persist({
      ...currentState,
      settings: { ...currentState.settings, voiceEnabled },
    })
  }

  function replayIntroduction(): void {
    if (schedulePending()) return
    if (v2OnboardingConfig() !== undefined) {
      const persistedMuted = !latestState.settings.voiceEnabled
      setResetArmed(false)
      stopCharacterVoice('route-exit')
      setV2Muted(persistedMuted)
      onboardingAudioSession.setMuted(persistedMuted)
      setScheduleMessage(undefined)
      setScheduleError(undefined)
      setV2OnboardingSessionKind(
        props.onboardingReview === true ? 'developer-review' : 'replay',
      )
      setScreen('v2-onboarding')
      return
    }
    if (cinematicConfig() === undefined) {
      setStorageError('Corky’s introduction is not available in this build.')
      return
    }

    setResetArmed(false)
    stopCharacterVoice('route-exit')
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
        setV2Muted(!nextState.settings.voiceEnabled)
        onboardingAudioSession.setMuted(!nextState.settings.voiceEnabled)
        onboardingPlanSavePromise = undefined
        v2OnboardingPlanSavePromise = undefined
        setCinematicRehearsal(false)
        setV2OnboardingSessionKind(v2EntrySessionKind)
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
      .then((storedState) =>
        untrack(() => {
          const nextState = storedState ?? createInitialState()
          onboardingPlanSavePromise = undefined
          v2OnboardingPlanSavePromise = undefined
          setCinematicRehearsal(false)
          setV2OnboardingSessionKind(v2EntrySessionKind)
          latestState = nextState
          stateLoaded = true
          setAppState(nextState)
          setV2Muted(!nextState.settings.voiceEnabled)
          onboardingAudioSession.setMuted(!nextState.settings.voiceEnabled)
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
            presentDailyCue(pending, appServices)
          }
        }),
      )
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
        setV2Muted(!nextState.settings.voiceEnabled)
        onboardingAudioSession.setMuted(!nextState.settings.voiceEnabled)
        onboardingPlanSavePromise = undefined
        v2OnboardingPlanSavePromise = undefined
        setCinematicRehearsal(false)
        setV2OnboardingSessionKind(v2EntrySessionKind)
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
    listenForDailyCues(appServices)
    refreshLocalDay(appServices)
    visibilityListener = () => {
      if (document.visibilityState !== 'visible') {
        characterVoiceForeground = false
        setV2OnboardingForeground(false)
        stopCharacterVoice('hidden')
        onboardingAudioSession.setForeground(false)
        return
      }
      characterVoiceForeground = true
      onboardingAudioSession.setForeground(true)
      setV2OnboardingForeground(true)
      refreshLocalDay(appServices)
      restoreDailyCue(latestState, appConfig)
    }
    pageHideListener = () => {
      characterVoiceForeground = false
      setV2OnboardingForeground(false)
      stopCharacterVoice('hidden')
      onboardingAudioSession.setForeground(false)
    }
    pageShowListener = () => visibilityListener?.()
    document.addEventListener('visibilitychange', visibilityListener)
    window.addEventListener('pagehide', pageHideListener)
    window.addEventListener('pageshow', pageShowListener)
    load()
  })

  onCleanup(() => {
    disposed = true
    characterVoicePlayer.dispose()
    onboardingAudioSession.dispose()
    if (midnightTimer !== undefined) clearTimeout(midnightTimer)
    if (visibilityListener !== undefined) {
      document.removeEventListener('visibilitychange', visibilityListener)
    }
    if (pageHideListener !== undefined) {
      window.removeEventListener('pagehide', pageHideListener)
    }
    if (pageShowListener !== undefined) {
      window.removeEventListener('pageshow', pageShowListener)
    }
    if (notificationListener !== undefined) {
      void notificationListener.remove()
    }
    void proAccess().dispose()
  })

  return (
    <>
      <BuildStamp />

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

      <Show
        when={screen() === 'v2-onboarding' ? v2OnboardingConfig() : undefined}
      >
        <V2OnboardingDirector
          sessionKind={v2OnboardingSessionKind()}
          pullOptions={config().pullOptions}
          contentPack={contentPack()}
          mediaPack={V2_ONBOARDING_MEDIA_PACK}
          audioSession={onboardingAudioSession}
          foreground={v2OnboardingForeground()}
          muted={v2Muted()}
          onMutedChange={setV2OnboardingMuted}
          onSavePlan={saveV2OnboardingPlan}
          onSetReminder={setV2OnboardingReminder}
          onTimeHaptic={playTimeDialHaptic}
          onComplete={completeV2Onboarding}
        />
      </Show>

      {screen() === 'choose-pull' ? (
        <ChoosePullScreen
          headerLabel={
            setupMode() === 'replace' ? 'Change plan' : 'Your first plan'
          }
          options={config().pullOptions}
          presentations={pullChoicePresentations()}
          selectedId={selectedPullId()}
          previewVoiceState={selectedPullPreviewVoiceState()}
          customText={customPullText()}
          error={setupError()}
          onSelect={choosePull}
          onHearPreview={playPullPreview}
          onCustomInput={(value) => {
            setCustomPullText(value)
            setSetupError(undefined)
          }}
          onBack={() => {
            stopCharacterVoice('route-exit')
            setScreen(setupMode() === 'replace' ? 'settings' : 'welcome')
          }}
          onContinue={continueFromPull}
        />
      ) : null}

      {screen() === 'choose-cue-context' ? (
        <ChooseCueContextScreen
          headerLabel={
            setupMode() === 'replace' ? 'Change plan' : 'Your first plan'
          }
          pullLabel={selectedPullLabel()}
          suggestions={cueContextChoices()}
          selection={cueContextSelection()}
          customText={customCueContextText()}
          error={setupError()}
          onSelect={(selection) => {
            setCueContextSelection(selection)
            setSetupError(undefined)
          }}
          onCustomInput={(value) => {
            setCustomCueContextText(value)
            setSetupError(undefined)
          }}
          onBack={() => {
            setSetupError(undefined)
            setScreen('choose-pull')
          }}
          onContinue={continueFromCueContext}
        />
      ) : null}

      {screen() === 'choose-b-side' ? (
        <ChooseBSideScreen
          headerLabel={
            setupMode() === 'replace' ? 'Change plan' : 'Your first plan'
          }
          pullText={selectedPullLabel()}
          suggestions={bSideChoices()}
          selectedKey={selectedBSideKey()}
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
          onBack={() => {
            setSetupError(undefined)
            setScreen('choose-cue-context')
          }}
          onContinue={finishSetup}
        />
      ) : null}

      {screen() === 'home' && cue() !== undefined ? (
        <HomeScreen
          pullText={cue()?.pullText ?? ''}
          bSideText={cue()?.bSideText ?? ''}
          cueContextText={cue()?.cueContextText}
          todayCount={progress().today}
          weekCount={progress().total}
          paused={cue()?.status === 'paused'}
          cueStatePending={schedulePending()}
          activeView={activeView()}
          onChangeView={changeMainView}
          onCueNow={showManualCue}
          onPauseToggle={togglePause}
          onOpenSettings={openSettings}
          onOpenGames={() => setScreen('games')}
        />
      ) : null}

      {screen() === 'games' ? (
        <GamesScreen onBack={() => setScreen('home')} />
      ) : null}

      {screen() === 'cue-moment' && cue() !== undefined ? (
        <CueMomentScreen
          pullText={cue()?.pullText ?? ''}
          bSideText={cue()?.bSideText ?? ''}
          cueContextText={cue()?.cueContextText}
          phrase={cuePhrase()}
          pending={cueResolutionPending()}
          {...(cue()?.pullCategoryId === undefined
            ? {}
            : { pullId: cue()?.pullCategoryId })}
          onChooseBSide={() => void resolveCue('b_side')}
          onNotNow={() => void resolveCue('not_now')}
          onClose={cancelCueMoment}
        />
      ) : null}

      {screen() === 'quiet' ? (
        <QuietScreen
          choseBSide={quietChoseBSide()}
          message={quietMessage()}
          starter={quietStarter()}
          onTimerComplete={completeQuietTimer}
          onDone={finishQuietScreen}
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
          voiceEnabled={appState().settings.voiceEnabled}
          resetArmed={resetArmed()}
          scheduleTime={dailyRule()?.localTime}
          schedulePending={schedulePending()}
          scheduleMessage={scheduleMessage()}
          scheduleError={scheduleError()}
          onBack={() => changeMainView(settingsReturnView())}
          onPauseToggle={togglePause}
          onVoiceToggle={toggleCharacterVoice}
          onReplayIntroduction={replayIntroduction}
          onReplace={() => beginSetup('replace')}
          onSetSchedule={keepDailyCue}
          onDisableSchedule={disableDailyCue}
          onTimeHaptic={playTimeDialHaptic}
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
