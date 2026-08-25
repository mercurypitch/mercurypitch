// Guitar Night presents the inert Velvet Rehearsal entry before any audio or input lifetime begins.
// ============================================================
/*
THESIS: The player enters a private rehearsal room, not a configuration dashboard.
OWN-WORLD: Velvet curtains, walnut, warm ivory, amber lamps, and quiet teal room status.
STORY: Choose a first win, bring one song, or step directly into the current Guitar workspace.
FIRST VIEWPORT: One calm amp-faceplate entry surface leaves the approved room and instruments visible.
FORM: A grounded rehearsal-room welcome with three deliberately unequal paths and no synthetic activity.
*/

import { createEffect, createMemo, createSignal, For, lazy, Match, onCleanup, onMount, Show, Suspense, Switch, } from 'solid-js'
import { X } from '@/components/icons'
import { Notifications } from '@/components/Notifications'
import type { GoogleRedirectResult } from '@/db/services/auth-service'
import { PremiumBackgroundPicker } from '@/features/backgrounds/PremiumBackgroundPicker'
import type { GuitarBackingTransport } from '@/features/guitar/backing/guitar-backing-transport'
import { createGuitarBackingTransport } from '@/features/guitar/backing/guitar-backing-transport'
import { useGuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import { beatToSeconds } from '@/features/guitar/runtime/guitar-performance-contract'
import { createVoiceHelpCommands } from '@/features/voice-control/navigation-commands'
import { useVoiceControlController } from '@/features/voice-control/useVoiceControlController'
import { useVoiceToggleKey } from '@/features/voice-control/useVoiceToggleKey'
import { registerVoiceCommands } from '@/features/voice-control/voice-command-registry'
import { VoiceCommandsOverlay } from '@/features/voice-control/VoiceCommandsOverlay'
import { VoiceControlHud } from '@/features/voice-control/VoiceControlHud'
import { useBackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { FILE_PICKER_UNAVAILABLE_MESSAGE, openFilePicker, } from '@/lib/file-picker'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { DEFAULT_GUITAR_TUNING, instrumentTuningFromSource, } from '@/lib/guitar/instrument-tuning'
import { accountReady, credits, refreshAccount, refreshCredits, signedIn, } from '@/lib/standalone-account'
import { useFocusTrap } from '@/lib/use-focus-trap'
import type { CloudSplitBlocker } from '@/lib/uvr-cloud-preflight'
import { cloudSplitBlocker, cloudSplitBlockerHeading, } from '@/lib/uvr-cloud-preflight'
import { authModalMode, openAuthModal } from '@/stores/ui-store'
import type { GuitarNightBandPreparationPort } from './band-preparation-port'
import { primaryGuitarFirstWinCompletionAction, resolveGuitarFirstWinConfig, } from './first-win-config'
import type { GuitarNightGoogleSeparationIntent } from './guitar-night-google-separation-intent'
import { clearGuitarNightGoogleSeparationIntent, guitarNightBackingFingerprint, prepareGuitarNightGoogleSeparationIntent, takeGuitarNightGoogleSeparationIntent, } from './guitar-night-google-separation-intent'
import { classifyGuitarNightImport, GUITAR_NIGHT_IMPORT_ACCEPT, GUITAR_NIGHT_IMPORT_AUDIO_BUSY_ERROR, GUITAR_NIGHT_IMPORT_MULTIPLE_ERROR, guitarNightImportValidationError, } from './guitar-night-import'
import { guitarRoomLabel } from './guitar-rooms'
import styles from './GuitarNightApp.module.css'
import { GuitarNightFileDrop } from './GuitarNightFileDrop'
import { GuitarNightFirstWin } from './GuitarNightFirstWin'
import type { GuitarNightLearnActivityId } from './GuitarNightLearnActivity'
import { guitarNightLearnTuningLabel } from './GuitarNightLearnActivity'
import { GuitarNightLearnShelf } from './GuitarNightLearnShelf'
import { GuitarNightOnRecording } from './GuitarNightOnRecording'
import type { GuitarNightRoomHandSync } from './GuitarNightRoom'
import { guitarNightBackingSession, GuitarNightRoom } from './GuitarNightRoom'
import { StoppedPreparationActions } from './GuitarNightStoppedPreparation'
import { GuitarNightTunerPreflight } from './GuitarNightTunerPreflight'
import type { GuitarNightPreparationPort } from './preparation-port'
import type { GuitarNightReferencePort, GuitarNightTranscriptionPort, } from './reference-port'
import { measuredReferenceForBacking } from './reference-port'
import { readGuitarNightSession } from './session-link'
import type { GuitarNightStemKind } from './song-port'
import type { GuitarNightSongPort, GuitarNightSongSummary } from './song-port'
import { formatGuitarNightGlassValue, GUITAR_NIGHT_GLASS, GUITAR_NIGHT_GLASS_VAR, guitarNightGlassLabel, loadGuitarNightGlass, persistGuitarNightGlass, } from './stage-glass'
import { useGuitarFirstWinController } from './useGuitarFirstWinController'
import { guitarNightBandPreparationMessage, loadDefaultGuitarNightBandPreparationPort, useGuitarNightBandPreparationController, } from './useGuitarNightBandPreparationController'
import { guitarNightPreparationMessage, loadDefaultGuitarNightPreparationPort, useGuitarNightPreparationController, } from './useGuitarNightPreparationController'
import type { GuitarNightReferenceState } from './useGuitarNightReferenceController'
import { loadDefaultGuitarNightReferencePort, loadDefaultGuitarNightTranscriptionPort, useGuitarNightReferenceController, } from './useGuitarNightReferenceController'
import type { GuitarNightSelectionState } from './useGuitarNightSongController'
import { loadDefaultGuitarNightSongPort, useGuitarNightSongController, } from './useGuitarNightSongController'

/** The auth and billing services stay out of the room's first paint. */
const GuitarNightAccount = lazy(async () => {
  const module = await import('./GuitarNightAccount')
  return { default: module.GuitarNightAccount }
})

/** Shared account forms stay out of the room until someone asks to sign in. */
const AuthModal = lazy(async () => {
  const module = await import('@/components/account/AuthModal')
  return { default: module.AuthModal }
})

/** The tab-only room brings its own audio clock, so it loads on demand. */
const GuitarNightScoreRoom = lazy(async () => {
  const module = await import('./GuitarNightScoreRoom')
  return { default: module.GuitarNightScoreRoom }
})

/** Learn input and activity state stay out of the silent entry bundle. */
const GuitarNightLearnRoom = lazy(async () => {
  const module = await import('./GuitarNightLearnRoom')
  return { default: module.GuitarNightLearnRoom }
})

type LearnActivityView = Exclude<GuitarNightLearnActivityId, 'first-steps'>

type EntryView =
  | 'choices'
  | 'first-win'
  | 'song'
  | 'room'
  | 'score-room'
  | 'note-hunt'
  | 'hear-find'
  | 'echo-phrase'
  | 'shape-walk'
  | 'tuner'
type TunerReturnView = Exclude<
  EntryView,
  'room' | 'score-room' | LearnActivityView | 'tuner'
>
type LearnReturnView = Exclude<EntryView, LearnActivityView | 'tuner'>
type GuitarNightAuthIntent =
  | { kind: 'topbar' }
  | { kind: 'band-preparation'; sessionId: string }
type GuitarNightAppProps = {
  firstWinConfig?: unknown
  loadReferencePort?: () => Promise<GuitarNightReferencePort>
  loadTranscriptionPort?: () => Promise<GuitarNightTranscriptionPort>
  loadSongPort?: () => Promise<GuitarNightSongPort>
  loadPreparationPort?: () => Promise<GuitarNightPreparationPort>
  loadBandPreparationPort?: () => Promise<GuitarNightBandPreparationPort>
  /** Overrides the account/credits preflight. For tests, and for an embed
   *  whose account state does not come from the standalone module. */
  checkBandPreflight?: () => CloudSplitBlocker | null
  createBackingTransport?: () => GuitarBackingTransport
}

/**
 * What "Separate guitar" costs, said before it is pressed.
 *
 * It is a cloud GPU job billed in credits, which is not guessable from a
 * button in a rehearsal room. Same convention as the studio's own
 * separation control.
 */
const SEPARATE_GUITAR_HINT =
  'Splits the backing into drums, bass, and guitar on a cloud GPU. Needs an account and uses credits.'

/** The library opens on the newest few songs; the rest arrive on request. */
const INITIAL_LIBRARY_PAGE = 5
const LIBRARY_PAGE_STEP = 10
/**
 * A first open after a schema change re-indexes every stem this device has
 * saved, which is slow on a large library. Say so rather than letting the
 * room look stuck.
 */
const LIBRARY_SLOW_OPEN_MS = 4000

function isLearnActivityView(view: EntryView): view is LearnActivityView {
  return (
    view === 'note-hunt' ||
    view === 'hear-find' ||
    view === 'echo-phrase' ||
    view === 'shape-walk'
  )
}

function formatPreparedDate(timestamp: number): string {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function unavailableReferenceCopy(
  state: Extract<GuitarNightReferenceState, { kind: 'unavailable' }>,
): string {
  if (state.reason === 'not-found') {
    return 'That tab is not on this device. Open its file again to follow it.'
  }
  if (state.reason === 'no-playable-notes') {
    return 'That file has no playable notes, so the stage stays in free play.'
  }
  return 'Your tab library could not be opened. Try again.'
}

function unavailableSongCopy(
  state: Extract<GuitarNightSelectionState, { kind: 'unavailable' }>,
): string {
  if (state.reason === 'not-found') {
    return 'That prepared song is not available on this device.'
  }
  if (state.reason === 'not-completed') {
    return 'That song has not finished preparing yet.'
  }
  if (state.reason === 'missing-local-audio') {
    return 'The song record is here, but its local audio is missing.'
  }
  return 'Your prepared-song library could not be opened. Try again.'
}

export function GuitarNightApp(props: GuitarNightAppProps) {
  // Voice control: the room registers its command set on entry; this shell
  // owns the listener, the pill and the V shortcut, like App does in-app.
  const voiceControl = useVoiceControlController()
  useVoiceToggleKey(voiceControl.toggle, () => setShowVoiceHelp(true))
  const [showVoiceHelp, setShowVoiceHelp] = createSignal(false)
  const [authIntent, setAuthIntent] =
    createSignal<GuitarNightAuthIntent | null>(null)
  const [googleSeparationReturn, setGoogleSeparationReturn] =
    createSignal<GuitarNightGoogleSeparationIntent | null>(null)
  // A successful sign-in reconciles account state asynchronously. Keep a
  // non-reactive revision of the backing lease so that leaving or selecting
  // another song can invalidate that delayed continuation without reading a
  // Solid accessor after an await.
  let backingSelectionRevision = 0
  const voiceHelpCommands = createVoiceHelpCommands({
    openVoiceHelp: () => setShowVoiceHelp(true),
  })
  onCleanup(registerVoiceCommands(() => voiceHelpCommands))
  const firstWinConfig = createMemo(() =>
    resolveGuitarFirstWinConfig(props.firstWinConfig),
  )
  const firstWinController = useGuitarFirstWinController({
    config: firstWinConfig,
  })
  const firstWinTuning = createMemo(
    () =>
      instrumentTuningFromSource(
        'guitar',
        firstWinConfig().tuningMidiHighToLow,
      ) ?? DEFAULT_GUITAR_TUNING,
  )
  const firstWinStage: GuitarPerformanceStageSource = {
    title: () =>
      firstWinController.currentStep()?.kind === 'one-string-tab'
        ? 'Your first one-string phrase'
        : 'Your first low E groove',
    notes: firstWinController.notes,
    timeline: {
      positionSeconds: () =>
        beatToSeconds(
          firstWinController.playheadBeat(),
          firstWinController.tempoBpm(),
        ),
      durationSeconds: () => {
        const finalBeat = firstWinController
          .notes()
          .reduce(
            (latest, note) => Math.max(latest, note.startBeat + note.duration),
            0,
          )
        return beatToSeconds(finalBeat, firstWinController.tempoBpm())
      },
      playheadBeat: firstWinController.playheadBeat,
      tempoBpm: firstWinController.tempoBpm,
    },
  }
  // The rooms come from the shared background catalog, the same one Karaoke
  // Night, Jam and Piano Night draw from. Guitar Night used to keep its own
  // four-image module with its own storage key, which is exactly why it could
  // not be given a supporter room or be touched from the admin panel.
  const background = useBackgroundSurfaceController('guitar')
  const roomLabel = (): string => guitarRoomLabel(background.resolved().id)
  // How much of the chosen room actually reaches the eye. Not
  // `createPersistedSignal`: the value is clamped to the slider's own bounds
  // on the way out, which the generic helper has no opinion about.
  const [roomGlass, setRoomGlass] = createSignal(loadGuitarNightGlass())
  const updateRoomGlass = (value: number): void => {
    setRoomGlass(persistGuitarNightGlass(value))
  }
  const [venueMenuOpen, setVenueMenuOpen] = createSignal(false)
  const initialSessionId = readGuitarNightSession()
  const [view, setView] = createSignal<EntryView>(
    initialSessionId === null ? 'choices' : 'song',
  )
  const [learnOpen, setLearnOpen] = createSignal(false)
  const [learnInitialFocus, setLearnInitialFocus] =
    createSignal<GuitarNightLearnActivityId>('first-steps')
  const [learnActivityReturnView, setLearnActivityReturnView] =
    createSignal<LearnReturnView>('choices')
  const [firstWinLearnReturnView, setFirstWinLearnReturnView] =
    createSignal<LearnReturnView | null>(null)
  const [tunerReturnView, setTunerReturnView] =
    createSignal<TunerReturnView>('choices')
  // Every playable room takes the panel full-bleed and hides entry chrome.
  const isRoomView = createMemo(
    () =>
      view() === 'room' ||
      view() === 'score-room' ||
      isLearnActivityView(view()),
  )
  const isStageView = createMemo(
    () => view() === 'first-win' || view() === 'tuner' || isRoomView(),
  )
  const [visitedRoomSessionId, setVisitedRoomSessionId] = createSignal<
    string | null
  >(null)
  let detailHeading: HTMLHeadingElement | undefined
  let appRoot: HTMLDivElement | undefined
  const [fileImportError, setFileImportError] = createSignal<string | null>(
    null,
  )
  let importInput: HTMLInputElement | undefined
  // Android TV / Google TV resolve no file-picker intent, so `.click()` on a
  // file input returns silently and the button reads as broken. Say so instead.
  const [filePickerBlocked, setFilePickerBlocked] = createSignal(false)
  const pickImportFile = (): void => {
    openFilePicker(importInput, {
      onUnavailable: () => setFilePickerBlocked(true),
    })
  }
  let venueMenuContainer: HTMLDivElement | undefined
  let venueMenuButton: HTMLButtonElement | undefined
  // The panel is a sibling of the top rail now, not a child of it: a drawer
  // that lived inside the rail could not slide in from the screen edge.
  // Outside-clicks therefore have to spare both boxes, not just the rail.
  let venueMenu: HTMLElement | undefined
  let tunerReturnFocus: HTMLElement | undefined

  const referenceController = useGuitarNightReferenceController({
    loadReferencePort: () => {
      const configuredLoader = props.loadReferencePort
      return configuredLoader === undefined
        ? loadDefaultGuitarNightReferencePort()
        : configuredLoader()
    },
    loadTranscriptionPort: () => {
      const configuredLoader = props.loadTranscriptionPort
      return configuredLoader === undefined
        ? loadDefaultGuitarNightTranscriptionPort()
        : configuredLoader()
    },
    // `activeBacking` is declared below and this only ever runs from a reader's
    // gesture, long after setup, so the closure is safe.
    backingSessionId: () => activeBacking()?.sessionId ?? null,
  })
  // A focused Learn activity owns one immutable tuning snapshot. Returning to
  // the room is the only point where a later tab, tuner, or instrument change
  // can become the next activity's neck.
  const [learnActivityTuning, setLearnActivityTuning] =
    createSignal<InstrumentTuning>(referenceController.tuning())

  // Entry cards can scroll on the shortest phones. A stage is a fixed room,
  // so never carry that old scroll position into its topbar and fretboard.
  createEffect(() => {
    const currentView = view()
    if (
      currentView !== 'first-win' &&
      currentView !== 'room' &&
      currentView !== 'score-room' &&
      !isLearnActivityView(currentView) &&
      currentView !== 'tuner'
    ) {
      return
    }
    queueMicrotask(() => {
      // Not the shell. It is `overflow: clip` and was never the scroller
      // anyway — before that it only ever held the 17px of scaled backdrop,
      // so this reset has been a no-op for as long as it has existed. The
      // offset lives on the page box on a phone and in `.main` from tablet
      // width up, so clear both.
      const region = appRoot?.querySelector('main') ?? null
      if (region !== null) region.scrollTop = 0
      // `document.scrollingElement` rather than `window.scrollTo`: same
      // effect, and it neither needs a smooth-scroll implementation nor
      // trips jsdom's "not implemented" path under test.
      const page = document.scrollingElement ?? null
      if (page !== null) page.scrollTop = 0
    })
  })

  const closeVenueMenuAndRestoreFocus = (): void => {
    setVenueMenuOpen(false)
    queueMicrotask(() => venueMenuButton?.focus())
  }

  useFocusTrap(() => venueMenu, {
    isOpen: venueMenuOpen,
    onClose: closeVenueMenuAndRestoreFocus,
    initialFocus: () =>
      venueMenu?.querySelector<HTMLButtonElement>(
        '[aria-label="Close room settings"]',
      ) ?? undefined,
  })

  /**
   * Was this the button that opened something, from inside the room drawer?
   *
   * Learn and Tune are opened from inside the drawer, and opening either
   * closes it. A closed drawer keeps its buttons in the document — it slides
   * off the edge rather than being unmounted — so "focus whatever opened
   * this" would put focus on an off-screen, inert control and effectively
   * lose it. For those triggers the way back is the button that opens the
   * drawer, which is the same thing the collapsed dropdown used to do by
   * virtue of being `display: none`.
   */
  const openedFromRoomDrawer = (element: HTMLElement | undefined): boolean =>
    element !== undefined && venueMenu?.contains(element) === true

  const closeLearnShelf = (): void => {
    setLearnOpen(false)
    // Learn is opened from inside the room drawer and nowhere else, and
    // opening it closes the drawer, so the way back is always the button that
    // opens the drawer. Handing focus to the trigger instead would put it on
    // a button that is still in the document but has slid off the edge with
    // the drawer — connected, boxed, inert, and impossible to see.
    queueMicrotask(() => venueMenuButton?.focus())
  }

  const openLearnShelf = (): void => {
    if (view() === 'tuner') return
    const currentView = view()
    setLearnInitialFocus(
      isLearnActivityView(currentView) ? currentView : 'first-steps',
    )
    if (!isLearnActivityView(currentView)) {
      setLearnActivityTuning(
        currentView === 'first-win'
          ? firstWinTuning()
          : referenceController.tuning(),
      )
    }
    setVenueMenuOpen(false)
    firstWinController.stopGroove()
    playbackController.pause()
    setLearnOpen(true)
  }

  const createConfiguredBackingTransport = (): GuitarBackingTransport => {
    const configuredFactory = props.createBackingTransport
    return configuredFactory?.() ?? createGuitarBackingTransport()
  }
  const playbackController = useGuitarBackingTransportController({
    createTransport: createConfiguredBackingTransport,
  })

  const focusDetail = () => {
    queueMicrotask(() => detailHeading?.focus())
  }

  const songController = useGuitarNightSongController({
    loadSongPort: () => {
      const configuredLoader = props.loadSongPort
      return configuredLoader === undefined
        ? loadDefaultGuitarNightSongPort()
        : configuredLoader()
    },
    onRouteSession: () => {
      playbackController.configure(null)
      setVisitedRoomSessionId(null)
      setView('song')
      focusDetail()
    },
    onBackingWillRelease: () => {
      backingSelectionRevision += 1
      playbackController.configure(null)
      setVisitedRoomSessionId(null)
    },
  })
  // The song detail always renders the tab shelf beside the prepared-song
  // selection. Route restoration can enter this view without calling the
  // explicit "Load a song" action, so the shelf must follow the view itself.
  createEffect(() => {
    if (view() === 'song') referenceController.initialize()
  })
  const attachedReference = referenceController.reference
  const unavailableReference = createMemo(() => {
    const current = referenceController.state()
    return current.kind === 'unavailable' ? current : null
  })
  /**
   * One reference, two rooms — and never both at once. An authored tab carries
   * its own nominal tempo, which nothing has aligned to a recording, so it
   * rehearses on its own clock in the tab room. A measured line was read from
   * this very recording, so it is already on the recording's timeline and is
   * the only reference the play-along room will guide with.
   */
  const authoredReference = createMemo(() => {
    const attached = attachedReference()
    return attached !== null && attached.kind === 'authored' ? attached : null
  })
  const attachedMeasuredReference = createMemo(() => {
    const attached = attachedReference()
    return attached !== null && attached.kind === 'measured' ? attached : null
  })

  const preparationController = useGuitarNightPreparationController({
    loadPreparationPort: () => {
      const configuredLoader = props.loadPreparationPort
      return configuredLoader === undefined
        ? loadDefaultGuitarNightPreparationPort()
        : configuredLoader()
    },
    onPrepared: async (sessionId, signal) => {
      const cancelStaging = () => songController.clearSession('replace')
      signal.addEventListener('abort', cancelStaging, { once: true })
      try {
        const refreshed = await songController.refreshLibrary()
        if (signal.aborted) return
        if (!refreshed) {
          throw new Error('Prepared-song library did not refresh')
        }
        await songController.stageSession(sessionId, 'push')
        if (signal.aborted) cancelStaging()
      } finally {
        signal.removeEventListener('abort', cancelStaging)
      }
    },
  })
  const checkBandPreflight = async (): Promise<CloudSplitBlocker | null> => {
    const configured = props.checkBandPreflight
    if (configured !== undefined) return configured()
    // The account chip is lazy, so on a cold room this state may not have
    // loaded yet — and refusing from data we do not have would turn away
    // a signed-in singer. Ask, then decide.
    if (!accountReady()) await refreshAccount()
    // `refreshAccount` starts its credits refresh without awaiting it. For
    // a newly restored account, waiting here is what distinguishes a real
    // zero balance from the initial unknown value before a billable job.
    if (signedIn() && credits() === null) await refreshCredits()
    const balance = credits()
    return cloudSplitBlocker({
      signedIn: signedIn(),
      ...(balance === null ? {} : { balance }),
    })
  }

  const bandPreparationController = useGuitarNightBandPreparationController({
    loadPort: () => {
      const configuredLoader = props.loadBandPreparationPort
      return configuredLoader === undefined
        ? loadDefaultGuitarNightBandPreparationPort()
        : configuredLoader()
    },
    // The facts belong here, not in the controller: this page already has a
    // source of truth for who is signed in and what credits remain
    // (standalone-account, the same one the account chip reads), so the
    // answer cannot disagree with the chip in the corner.
    checkPreflight: checkBandPreflight,
    onPrepared: async (sessionId, signal) => {
      const refreshed = await songController.refreshLibrary()
      if (signal.aborted) return
      if (!refreshed) {
        throw new Error(
          'The band parts were saved, but the song library could not reopen them. Open this song again from Prepared songs.',
        )
      }
      setVisitedRoomSessionId(null)
      playbackController.configure(null)
      // The same session id is already staged as the two-stem mix; force
      // past the no-op guard so the upgraded parts actually replace it.
      await songController.stageSession(sessionId, 'replace', { force: true })
    },
  })

  const openTopbarSignIn = (): void => {
    // Defensive modal ownership: the drawer normally traps focus, but a
    // scripted activation or stale assistive-tech cursor must still leave
    // exactly one aria-modal surface in the document.
    setVenueMenuOpen(false)
    setAuthIntent({ kind: 'topbar' })
    openAuthModal('login')
  }

  const openBandPreparationSignIn = (sessionId: string): void => {
    setAuthIntent({ kind: 'band-preparation', sessionId })
    openAuthModal('login')
  }

  const handleAuthenticated = (): void => {
    // The modal closes immediately after this callback. Preserve the exact
    // song that asked for auth before any awaited account reconciliation.
    const pendingIntent = authIntent()
    const pendingBackingSelectionRevision = backingSelectionRevision
    clearGuitarNightGoogleSeparationIntent()
    setAuthIntent(null)
    void (async () => {
      await refreshAccount()
      await refreshCredits()
      if (
        pendingIntent?.kind === 'band-preparation' &&
        pendingBackingSelectionRevision === backingSelectionRevision
      ) {
        bandPreparationController.start(pendingIntent.sessionId)
      }
    })()
  }
  const activeBacking = createMemo(() => {
    const state = songController.selectionState()
    return state.kind === 'ready' ? state.lease : null
  })

  const prepareGoogleRedirect = (): (() => void) | undefined => {
    // Every Google attempt supersedes an abandoned intent. Only the sign-in
    // opened from the blocked separation action earns a new return lease.
    clearGuitarNightGoogleSeparationIntent()
    const pending = authIntent()
    const backing = activeBacking()
    if (
      pending?.kind !== 'band-preparation' ||
      backing === null ||
      backing.sessionId !== pending.sessionId ||
      backing.defaultMix.kind !== 'mixed-instrumental'
    ) {
      return
    }
    return prepareGuitarNightGoogleSeparationIntent(backing)
  }

  const handleGoogleRedirectResult = (result: GoogleRedirectResult): void => {
    // Consume even failures and expired/invalid values. A later unrelated
    // authentication can never replay this billable intent.
    const pending = takeGuitarNightGoogleSeparationIntent()
    if (!result.ok || pending === null) return
    setGoogleSeparationReturn(pending)
  }

  createEffect(() => {
    const pending = googleSeparationReturn()
    if (pending === null) return

    const routeSessionId = songController.routeSessionId()
    if (routeSessionId !== pending.sessionId) {
      setGoogleSeparationReturn(null)
      return
    }

    const selection = songController.selectionState()
    if (selection.kind === 'idle' || selection.kind === 'loading') return
    setGoogleSeparationReturn(null)
    if (
      selection.kind !== 'ready' ||
      selection.lease.defaultMix.kind !== 'mixed-instrumental' ||
      guitarNightBackingFingerprint(selection.lease) !==
        pending.backingFingerprint
    ) {
      return
    }

    const pendingBackingSelectionRevision = backingSelectionRevision
    void (async () => {
      // The standalone account module may have completed its initial refresh
      // before `consumeGoogleRedirect` installed the returned token. Force a
      // post-return reconciliation rather than trusting that stale "ready".
      await refreshAccount()
      if (pendingBackingSelectionRevision !== backingSelectionRevision) return
      await refreshCredits()
      if (pendingBackingSelectionRevision !== backingSelectionRevision) return
      const blocker = await checkBandPreflight()
      if (pendingBackingSelectionRevision !== backingSelectionRevision) return
      if (blocker !== null) {
        bandPreparationController.block(pending.sessionId, blocker)
        return
      }
      // `start` repeats the same preflight immediately before it loads the
      // port. The return intent is convenience, never billing authority.
      bandPreparationController.start(pending.sessionId)
    })()
  })
  const measuredReference = createMemo(() =>
    measuredReferenceForBacking(
      attachedMeasuredReference(),
      activeBacking()?.sessionId ?? null,
    ),
  )
  /**
   * The room's half of hanging a part by hand.
   *
   * Only the room has the recording's clock, so only the room can turn "here"
   * into a moment. Absent until a reader claims a part to place.
   */
  const handSync = createMemo<GuitarNightRoomHandSync | null>(() => {
    const placing = referenceController.handPlacement()
    if (placing === null) return null
    const reading = referenceController.readingOnRecording()
    return {
      partName: placing.trackName,
      firstMarkSeconds: placing.marks.firstAudioSeconds ?? null,
      lastMarkSeconds: placing.marks.lastAudioSeconds ?? null,
      placed: reading !== null && reading.placedBy === 'hand',
      onMark: referenceController.markScoreOnRecording,
      onClear: referenceController.clearHandPlacement,
      onNudge: referenceController.nudgeScoreOnRecording,
    }
  })
  const unavailableSelection = createMemo(() => {
    const state = songController.selectionState()
    return state.kind === 'unavailable' ? state : null
  })
  // Bass was offered alone at first, because it is effectively monophonic and
  // monophonic is the case pitch detection actually handles. Guitar is offered
  // now on the same terms and with no special pleading: the reader is the same
  // reader, and a stem holding two guitars and a chord will come back thin or
  // come back with nothing — in which case `followStem` already says so and
  // leaves the stage in free play. Nothing downstream needed changing;
  // `followStem` has always tuned the stage by `stemKind`.
  //
  // Guitar leads the list because this is Guitar Night.
  const TRANSCRIBABLE_STEMS: readonly {
    kind: GuitarNightStemKind
    label: string
  }[] = [
    { kind: 'guitar', label: 'Guitar' },
    { kind: 'bass', label: 'Bass' },
  ]
  const transcribableStems = createMemo(() => {
    const backing = activeBacking()
    if (backing === null) return []
    return TRANSCRIBABLE_STEMS.flatMap((candidate) => {
      const stem = backing.stems.find((each) => each.kind === candidate.kind)
      if (stem === undefined) return []
      return [
        {
          sessionId: backing.sessionId,
          kind: stem.kind,
          label: candidate.label,
          url: stem.url,
        },
      ]
    })
  })

  // The catalog is two libraries in one list. Only the device half is
  // "on this device", only the device half is worth paginating, and the
  // demo has to stay visible even when the device half is empty — which
  // is exactly the visitor it exists for.
  const deviceSongs = createMemo(() =>
    songController.songs().filter((song) => song.source !== 'demo'),
  )
  const demoSongs = createMemo(() =>
    songController.songs().filter((song) => song.source === 'demo'),
  )

  const [visibleSongLimit, setVisibleSongLimit] =
    createSignal(INITIAL_LIBRARY_PAGE)
  const songsWithinLimit = (limit: number) => {
    const all = deviceSongs()
    if (all.length <= limit) return all
    const head = all.slice(0, limit)
    // The routed song stays reachable even when it sits below the fold —
    // otherwise its Resume affordance hides behind the Show more button.
    const routedSessionId =
      activeBacking()?.sessionId ?? songController.routeSessionId()
    if (
      routedSessionId === null ||
      head.some((song) => song.sessionId === routedSessionId)
    ) {
      return head
    }
    const routed = all.find((song) => song.sessionId === routedSessionId)
    return routed === undefined ? head : [...head, routed]
  }
  const visibleSongs = createMemo(() => songsWithinLimit(visibleSongLimit()))
  const hiddenSongCount = createMemo(() =>
    Math.max(0, deviceSongs().length - visibleSongs().length),
  )
  // Count what the next press actually reveals: a pinned routed song is
  // already on screen, so a plain page step would overstate the reveal.
  const nextRevealCount = createMemo(() =>
    Math.max(
      0,
      songsWithinLimit(visibleSongLimit() + LIBRARY_PAGE_STEP).length -
        visibleSongs().length,
    ),
  )

  const [libraryOpenIsSlow, setLibraryOpenIsSlow] = createSignal(false)
  createEffect(() => {
    if (songController.libraryState() !== 'loading') {
      setLibraryOpenIsSlow(false)
      return
    }
    const timer = window.setTimeout(
      () => setLibraryOpenIsSlow(true),
      LIBRARY_SLOW_OPEN_MS,
    )
    onCleanup(() => window.clearTimeout(timer))
  })
  const preparingSong = createMemo(() => {
    const state = preparationController.state()
    return state.kind === 'preparing' ? state : null
  })
  const preparationError = createMemo(() => {
    const state = preparationController.state()
    return state.kind === 'error' ? state : null
  })
  const cancelledPreparation = createMemo(() => {
    const state = preparationController.state()
    return state.kind === 'cancelled' ? state : null
  })
  const bandPreparation = createMemo(() => {
    const state = bandPreparationController.state()
    return state.kind === 'preparing' ? state : null
  })
  const bandPreparationError = createMemo(() => {
    const state = bandPreparationController.state()
    return state.kind === 'error' ? state : null
  })
  const bandPreparationBlocked = createMemo(() => {
    const state = bandPreparationController.state()
    return state.kind === 'blocked' ? state : null
  })

  const openFirstWin = () => {
    if (!firstWinConfig().enabled) {
      openCurrentGuitar()
      return
    }
    setFirstWinLearnReturnView(null)
    setView('first-win')
    focusDetail()
  }

  const openFirstStepsFromLearn = (): void => {
    const currentView = view()
    if (currentView === 'tuner') return
    const returnView = isLearnActivityView(currentView)
      ? learnActivityReturnView()
      : currentView
    setLearnActivityReturnView(returnView)
    setFirstWinLearnReturnView(returnView)
    if (firstWinController.progress().status === 'completed') {
      firstWinController.replayFlow()
    }
    setLearnOpen(false)
    setView('first-win')
    focusDetail()
  }

  const openLearnActivity = (activity: LearnActivityView): void => {
    const currentView = view()
    if (currentView === 'tuner') return
    if (!isLearnActivityView(currentView)) {
      setLearnActivityReturnView(currentView)
    }
    firstWinController.stopGroove()
    playbackController.pause()
    setLearnOpen(false)
    setView(activity)
  }

  const returnFromLearnActivity = (returnView: LearnReturnView): void => {
    setView(returnView)
    setLearnOpen(true)
  }

  const returnFromFirstWin = (): void => {
    firstWinController.stopGroove()
    const returnView = firstWinLearnReturnView()
    setFirstWinLearnReturnView(null)
    if (returnView === null) {
      returnToChoices()
      return
    }
    setLearnInitialFocus('first-steps')
    returnFromLearnActivity(returnView)
  }

  const returnFromLearnExercise = (activity: LearnActivityView): void => {
    setLearnInitialFocus(activity)
    returnFromLearnActivity(learnActivityReturnView())
  }

  const openSongLibrary = () => {
    setView('song')
    songController.initialize()
    referenceController.initialize()
    focusDetail()
  }

  const openCurrentGuitar = () => {
    window.location.assign('/#/guitar')
  }

  const openTuner = (trigger?: HTMLElement): void => {
    const currentView = view()
    if (
      currentView === 'room' ||
      currentView === 'score-room' ||
      isLearnActivityView(currentView) ||
      currentView === 'tuner'
    ) {
      return
    }
    tunerReturnFocus = trigger
    setTunerReturnView(currentView)
    setVenueMenuOpen(false)
    firstWinController.stopGroove()
    playbackController.pause()
    setView('tuner')
  }

  const closeTuner = (): void => {
    const returnView = tunerReturnView()
    setView(returnView)
    queueMicrotask(() => {
      const triggerWasInsideRoomMenu = openedFromRoomDrawer(tunerReturnFocus)
      if (triggerWasInsideRoomMenu && venueMenuButton?.isConnected === true) {
        venueMenuButton.focus()
        return
      }
      if (tunerReturnFocus !== undefined && tunerReturnFocus.isConnected) {
        tunerReturnFocus.focus()
        return
      }
      const entryTrigger = document.querySelector<HTMLButtonElement>(
        '[data-entry="tuner"]',
      )
      if (entryTrigger !== null) {
        entryTrigger.focus()
        return
      }
      venueMenuButton?.focus()
    })
  }

  const enterRoom = () => {
    const backing = activeBacking()
    if (backing === null) return
    if (visitedRoomSessionId() !== backing.sessionId) {
      playbackController.configure(guitarNightBackingSession(backing))
      setVisitedRoomSessionId(backing.sessionId)
    }
    setView('room')
  }

  /**
   * Rehearse the tab alone. The recording is left paused rather than played
   * underneath it: nothing has aligned the two timelines, and a backing
   * running against an unrelated tempo is worse than silence.
   */
  const enterScoreRoom = () => {
    if (authoredReference() === null) return
    playbackController.pause()
    setView('score-room')
  }

  const returnToSongs = () => {
    playbackController.pause()
    setView('song')
    focusDetail()
  }

  const returnToChoices = () => {
    setLearnOpen(false)
    setFirstWinLearnReturnView(null)
    firstWinController.stopGroove()
    preparationController.clear()
    bandPreparationController.clear()
    playbackController.configure(null)
    setVisitedRoomSessionId(null)
    if (view() === 'song' || view() === 'room' || view() === 'score-room') {
      songController.clearSession('push')
    }
    setView('choices')
    queueMicrotask(() =>
      document
        .querySelector<HTMLButtonElement>('[data-entry="start"]')
        ?.focus(),
    )
  }

  const addPreviewHit = (input: 'touch' | 'keyboard' = 'touch') =>
    firstWinController.registerHit(input)

  const firstWinCompletionAction = createMemo(() =>
    primaryGuitarFirstWinCompletionAction(firstWinConfig()),
  )

  const advanceFirstWin = () => {
    if (firstWinController.advanceStep()) {
      focusDetail()
    }
  }

  const completeFirstWin = () => {
    firstWinController.stopGroove()
    if (firstWinCompletionAction() === 'load-song') {
      openSongLibrary()
      return
    }
    openCurrentGuitar()
  }

  const skipFirstWin = () => {
    firstWinController.skip()
    openCurrentGuitar()
  }

  const openImportPicker = (): void => {
    setFileImportError(null)
    pickImportFile()
  }

  const handleImportFile = (file: File): void => {
    const validationError = guitarNightImportValidationError(file)
    if (validationError !== null) {
      setFileImportError(validationError)
      return
    }

    setFileImportError(null)
    const kind = classifyGuitarNightImport(file)
    if (kind === 'audio') {
      if (
        preparationController.isPreparing() ||
        bandPreparationController.isPreparing() ||
        songController.selectionState().kind === 'loading'
      ) {
        setFileImportError(GUITAR_NIGHT_IMPORT_AUDIO_BUSY_ERROR)
        return
      }
      bandPreparationController.clear()
      const accepted = preparationController.start(file)
      if (accepted) songController.clearSession('push')
      setView('song')
      focusDetail()
      return
    }
    if (kind === 'midi' || kind === 'guitar-pro') {
      void referenceController.importFile(file)
    }
  }

  const handleImportChange = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file !== undefined) handleImportFile(file)
  }

  const stagePreparedSong = (sessionId: string) => {
    if (activeBacking()?.sessionId === sessionId) {
      enterRoom()
      return
    }
    preparationController.clear()
    bandPreparationController.clear()
    setVisitedRoomSessionId(null)
    void songController.stageSession(sessionId, 'push')
  }

  const prepareGuitarFreeBand = () => {
    const backing = activeBacking()
    if (backing === null || backing.defaultMix.kind !== 'mixed-instrumental') {
      return
    }
    playbackController.configure(null)
    setVisitedRoomSessionId(null)
    setView('song')
    focusDetail()
    bandPreparationController.start(backing.sessionId)
  }

  createEffect(() => {
    if (view() !== 'room' || activeBacking() !== null) return
    playbackController.configure(null)
    setView('song')
  })

  // Measured evidence belongs to one exact recording. Once another backing is
  // staged, remove the stale guide rather than showing it as "this stem" or
  // carrying it into the new room.
  createEffect(() => {
    const attached = attachedMeasuredReference()
    const backing = activeBacking()
    if (
      attached === null ||
      backing === null ||
      attached.backingSessionId === backing.sessionId
    ) {
      return
    }
    referenceController.detach()
  })

  // Removing the tab from under the tab room leaves nothing to rehearse.
  createEffect(() => {
    if (view() !== 'score-room' || authoredReference() !== null) return
    setView('song')
  })

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && venueMenuOpen()) {
        closeVenueMenuAndRestoreFocus()
        return
      }
      if (view() !== 'first-win' || event.code !== 'Space' || event.repeat) {
        return
      }
      const target = event.target
      if (
        target instanceof Element &&
        target.closest(
          'a,button,input,select,textarea,summary,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="link"],[role="slider"],[role="textbox"],[role="checkbox"],[role="radio"],[role="switch"],[role="menuitem"]',
        ) !== null
      ) {
        return
      }
      event.preventDefault()
      addPreviewHit('keyboard')
    }
    const closeVenueMenuOnOutside = (event: PointerEvent): void => {
      const target = event.target
      if (
        !venueMenuOpen() ||
        !(target instanceof Node) ||
        venueMenuContainer?.contains(target) === true ||
        venueMenu?.contains(target) === true
      ) {
        return
      }
      setVenueMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', closeVenueMenuOnOutside)
    onCleanup(() => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', closeVenueMenuOnOutside)
    })
  })

  const roomStatus = () => {
    const preparation = preparationController.state()
    if (preparation.kind === 'preparing') {
      return {
        title: 'Preparing song',
        detail: guitarNightPreparationMessage(preparation),
      }
    }
    if (preparation.kind === 'error') {
      return {
        title: 'Preparation needs attention',
        detail: 'No playback or listening has started',
      }
    }
    if (preparation.kind === 'cancelled') {
      return {
        title: 'Room ready',
        detail: 'Preparation cancelled; no audio has started',
      }
    }
    const selection = songController.selectionState()
    if (selection.kind === 'ready') {
      return {
        title: 'Room ready',
        detail: 'Song prepared; playback has not started',
      }
    }
    if (selection.kind === 'loading') {
      return {
        title: 'Opening song',
        detail: 'Reading local stems; no audio has started',
      }
    }
    return {
      title: 'Room ready',
      detail: 'No audio or listening has started',
    }
  }

  /**
   * One row of the library, wherever the song came from. The device list
   * and the demo list render the same control — a demo that looked or
   * behaved differently would be a second way to open a song, and there
   * is only one.
   */
  const songChoice = (song: GuitarNightSongSummary) => {
    const isActive = () => activeBacking()?.sessionId === song.sessionId
    return (
      <li>
        <button
          type="button"
          classList={{ [styles.songChoiceActive]: isActive() }}
          aria-current={isActive() ? 'true' : undefined}
          disabled={
            preparationController.isPreparing() ||
            bandPreparationController.isPreparing() ||
            songController.selectionState().kind === 'loading'
          }
          onClick={() => stagePreparedSong(song.sessionId)}
        >
          <span>
            <strong>{song.title}</strong>
            <small>{song.subtitle ?? formatPreparedDate(song.createdAt)}</small>
          </span>
          <i aria-hidden="true">
            {isActive()
              ? visitedRoomSessionId() === song.sessionId
                ? 'Resume'
                : 'Selected'
              : 'Open'}
          </i>
        </button>
      </li>
    )
  }

  return (
    <div
      ref={appRoot}
      class={styles.app}
      classList={{ [styles.appRoom]: isStageView() }}
      style={{ [GUITAR_NIGHT_GLASS_VAR]: String(roomGlass()) }}
      data-backdrop-treatment={background.resolved().treatment}
      data-testid="guitar-night-shell"
    >
      <a class={styles.skipLink} href="#guitar-night-main">
        Skip to Guitar Night
      </a>

      <div
        class={styles.backdrop}
        data-testid="guitar-night-backdrop"
        data-backdrop={background.resolved().id}
        style={{ '--room-backdrop': `url('${background.resolved().url}')` }}
        aria-hidden="true"
      />
      <div class={styles.roomGlow} aria-hidden="true" />

      <div
        class={styles.topbar}
        data-testid="guitar-night-topbar"
        inert={view() === 'tuner' || learnOpen()}
        aria-hidden={view() === 'tuner' || learnOpen() ? 'true' : undefined}
      >
        <a class={styles.brand} href="/" aria-label="MercuryPitch home">
          <img src="/favicon.svg" alt="" />
          <span>MercuryPitch</span>
        </a>
        <span class={styles.topbarDivider} aria-hidden="true" />
        <span class={styles.topbarTitle}>Guitar Night</span>
        <span class={styles.roomName}>{roomLabel()}</span>

        {/* The rail is where this belongs on a phone. As a fixed corner
            overlay it cleared `--tabbar-total` for a tab bar Guitar Night
            does not have, and landed squarely on the first-win deck's
            action buttons — "Start count-in" was unusable under it. The
            rail already reserves this gap: the title and room name are
            hidden on a phone, so the middle of the bar is empty. */}
        <VoiceControlHud
          controller={voiceControl}
          onShowCommands={() => setShowVoiceHelp(true)}
          placement="docked"
        />

        <div ref={venueMenuContainer} class={styles.topbarActions}>
          <button
            ref={venueMenuButton}
            type="button"
            class={styles.venueMenuButton}
            aria-expanded={venueMenuOpen()}
            aria-controls="guitar-night-venue-menu"
            aria-haspopup="dialog"
            onClick={() => setVenueMenuOpen((open) => !open)}
          >
            Room
          </button>
          <Suspense>
            <GuitarNightAccount
              onSignIn={openTopbarSignIn}
              onGoogleRedirectResult={handleGoogleRedirectResult}
            />
          </Suspense>
        </div>
      </div>

      {/* ── Room and settings ──────────────────────────────────
          One panel that slides in from the right, the way Piano Night's
          does. It replaces a native <select> that sat in the top rail on a
          desktop and turned into a cramped dropdown on a phone: a room is
          picked by looking at it, which a text list cannot offer, and the
          supporter rooms it now has to show do not fit in an <option>. */}
      <Show when={venueMenuOpen()}>
        <button
          type="button"
          class={styles.roomScrim}
          data-testid="guitar-night-room-scrim"
          aria-label="Close room settings"
          onClick={closeVenueMenuAndRestoreFocus}
        />
      </Show>
      <aside
        id="guitar-night-venue-menu"
        ref={venueMenu}
        class={styles.venueMenu}
        classList={{ [styles.venueMenuOpen]: venueMenuOpen() }}
        data-testid="guitar-night-room-drawer"
        role="dialog"
        aria-modal={venueMenuOpen() ? 'true' : undefined}
        aria-label="Guitar Night room and settings"
        aria-hidden={venueMenuOpen() ? undefined : 'true'}
        inert={!venueMenuOpen()}
        tabindex="-1"
      >
        <div class={styles.drawerTopline}>
          <div>
            <span>Guitar Night</span>
            <strong>Room</strong>
          </div>
          <button
            type="button"
            class={styles.drawerClose}
            aria-label="Close room settings"
            onClick={closeVenueMenuAndRestoreFocus}
          >
            <X />
          </button>
        </div>

        <section class={styles.drawerPanel} aria-label="Rooms">
          <h2 class={styles.drawerHeading}>Pick the light you play in.</h2>
          <p class={styles.drawerCopy}>
            Room art is visual only — it never touches your tone, tuning or
            timing. Your choice stays on this device.
          </p>
          <PremiumBackgroundPicker
            class={styles.roomPicker}
            controller={background}
            embedded
            onSelect={(option) => background.select(option.id)}
          />

          <label class={styles.roomGlass} title="How much of the room shows">
            <span class={styles.roomGlassLabel}>Room visibility</span>
            <input
              type="range"
              class={styles.roomGlassSlider}
              min={GUITAR_NIGHT_GLASS.min}
              max={GUITAR_NIGHT_GLASS.max}
              step={GUITAR_NIGHT_GLASS.step}
              value={roomGlass()}
              aria-label="Room visibility"
              aria-valuetext={formatGuitarNightGlassValue(roomGlass())}
              data-testid="guitar-night-room-glass"
              onInput={(event) =>
                updateRoomGlass(Number(event.currentTarget.value))
              }
            />
            <output class={styles.roomGlassValue} aria-hidden="true">
              {guitarNightGlassLabel(roomGlass())}
            </output>
          </label>
        </section>

        <section class={styles.drawerPanel} aria-label="Studio">
          <h2 class={styles.drawerHeading}>Studio</h2>
          <div class={styles.drawerLinks}>
            <button
              type="button"
              class={styles.studioLink}
              data-room-action="learn"
              onClick={() => openLearnShelf()}
            >
              Learn
            </button>
            <Show when={!isRoomView()}>
              <button
                type="button"
                class={styles.studioLink}
                onClick={(event) => openTuner(event.currentTarget)}
              >
                Tune guitar
              </button>
            </Show>
            <a class={styles.studioLink} href="/#/guitar">
              Full studio
            </a>
          </div>
        </section>
      </aside>

      {/* The drawer joins the tuner and the Learn shelf here: while any of
          the three is open the room behind it is inert. The drawer owns a
          focus trap, so the non-inert topbar cannot receive focus through the
          scrim; its Room trigger remains the explicit focus-return target. */}
      <main
        class={styles.main}
        classList={{ [styles.mainRoom]: isStageView() }}
        id="guitar-night-main"
        inert={view() === 'tuner' || learnOpen() || venueMenuOpen()}
        aria-hidden={
          view() === 'tuner' || learnOpen() || venueMenuOpen()
            ? 'true'
            : undefined
        }
      >
        <div
          class={styles.entryPanel}
          classList={{
            [styles.entryPanelRoom]: isRoomView(),
            [styles.entryPanelLesson]:
              view() === 'first-win' || isLearnActivityView(view()),
          }}
        >
          <Show when={!isStageView()}>
            <div class={styles.panelEdge} aria-hidden="true" />
          </Show>

          <Switch>
            <Match when={view() === 'choices'}>
              <p class={styles.eyebrow}>The room is quiet</p>
              <h1>Guitar Night</h1>
              <p class={styles.lede}>
                Your room is ready. Begin with one string, bring a song, or step
                straight into the full Guitar workspace.
              </p>

              <div
                class={styles.entryActions}
                data-testid="guitar-night-entry-actions"
              >
                <button
                  class={styles.primaryAction}
                  type="button"
                  aria-label="Start"
                  aria-describedby="guitar-night-start-description"
                  data-entry="start"
                  onClick={openFirstWin}
                >
                  <strong>Start</strong>
                  <span id="guitar-night-start-description">
                    Make a groove, then read your first tab
                  </span>
                </button>
                <button
                  class={styles.secondaryAction}
                  type="button"
                  aria-label="Load a song"
                  aria-describedby="guitar-night-song-description"
                  onClick={openSongLibrary}
                >
                  <strong>Load a song</strong>
                  <span id="guitar-night-song-description">
                    Open a prepared song or choose local audio
                  </span>
                </button>
                <button
                  class={styles.expertAction}
                  type="button"
                  aria-label="I know my way around"
                  aria-describedby="guitar-night-expert-description"
                  onClick={skipFirstWin}
                >
                  <strong>I know my way around</strong>
                  <span id="guitar-night-expert-description">
                    Open the current Guitar workspace
                  </span>
                </button>
              </div>
              <button
                class={styles.tunerEntryAction}
                type="button"
                data-entry="tuner"
                onClick={(event) => openTuner(event.currentTarget)}
              >
                <strong>Tune guitar</strong>
                <span>Quiet preflight before you play</span>
              </button>
            </Match>

            <Match when={view() === 'first-win'}>
              <GuitarNightFirstWin
                controller={firstWinController}
                stage={firstWinStage}
                tuning={firstWinTuning}
                active={() => view() === 'first-win'}
                completionAction={firstWinCompletionAction}
                headingRef={(element) => {
                  detailHeading = element
                }}
                onHit={() => addPreviewHit('touch')}
                onBack={returnFromFirstWin}
                onSkip={skipFirstWin}
                onAdvance={advanceFirstWin}
                onComplete={completeFirstWin}
              />
            </Match>

            <Match when={view() === 'song'}>
              <p class={styles.eyebrow}>Songs · this device</p>
              <h1 ref={detailHeading} tabindex="-1">
                Bring a song into the room.
              </h1>
              <p class={styles.detailCopy}>
                Open something already prepared here, or choose audio, MIDI, or
                Guitar Pro from this device. Nothing starts playing on its own.
              </p>

              <GuitarNightFileDrop
                class={styles.songWell}
                busy={preparingSong() !== null || bandPreparation() !== null}
                openingFileName={referenceController.importPendingFileName()}
                message={fileImportError()}
                onChoose={openImportPicker}
                onFile={handleImportFile}
                onRejected={() =>
                  setFileImportError(GUITAR_NIGHT_IMPORT_MULTIPLE_ERROR)
                }
              >
                <Switch>
                  <Match when={bandPreparation()}>
                    {(preparation) => (
                      <div class={styles.songState}>
                        <strong>Building the guitar-free band</strong>
                        <span role="status" aria-atomic="true">
                          {guitarNightBandPreparationMessage(preparation())}
                        </span>
                        <Show
                          when={preparation().progress !== null}
                          fallback={
                            <progress
                              class={styles.songProgress}
                              max="100"
                              aria-label="Preparing full-band parts"
                            />
                          }
                        >
                          <progress
                            class={styles.songProgress}
                            max="100"
                            value={preparation().progress ?? 0}
                            aria-label="Preparing full-band parts"
                          />
                        </Show>
                        <small>
                          The current mix stays safe on this device while its
                          drums, bass, and guitar parts are separated.
                        </small>
                      </div>
                    )}
                  </Match>
                  <Match when={bandPreparationBlocked()}>
                    {(blocked) => (
                      <div class={styles.songState}>
                        <strong>
                          {cloudSplitBlockerHeading(blocked().blocker)}
                        </strong>
                        <span>{blocked().blocker.message}</span>
                        <small>
                          Your existing vocals and accompaniment are unchanged,
                          and nothing was charged.
                        </small>
                      </div>
                    )}
                  </Match>
                  <Match when={bandPreparationError()}>
                    {(error) => (
                      <div class={styles.songState} role="alert">
                        <strong>Couldn’t build the full band</strong>
                        <span>{error().message}</span>
                        <small>
                          Your existing vocals and accompaniment are unchanged.
                        </small>
                      </div>
                    )}
                  </Match>
                  <Match when={preparingSong()}>
                    {(preparation) => (
                      <div class={styles.songState}>
                        <strong title={preparation().file.name}>
                          {preparation().file.name}
                        </strong>
                        <span role="status" aria-atomic="true">
                          {guitarNightPreparationMessage(preparation())}
                        </span>
                        <Show
                          when={preparation().progress !== null}
                          fallback={
                            <progress
                              class={styles.songProgress}
                              max="100"
                              aria-label={`Preparing ${preparation().file.name}`}
                            />
                          }
                        >
                          <progress
                            class={styles.songProgress}
                            max="100"
                            value={preparation().progress ?? 0}
                            aria-label={`Preparing ${preparation().file.name}`}
                          />
                        </Show>
                        <small>
                          {preparation().warning ??
                            'Your audio stays on this device. Nothing will play automatically.'}
                        </small>
                      </div>
                    )}
                  </Match>
                  <Match when={preparationError()}>
                    {(error) => (
                      <div class={styles.songState} role="alert">
                        <strong>{error().title}</strong>
                        <span title={error().file.name}>
                          {error().file.name}
                        </span>
                        <small>{error().message}</small>
                      </div>
                    )}
                  </Match>
                  <Match when={cancelledPreparation()}>
                    {(cancelled) => (
                      <div class={styles.songState}>
                        <strong>Preparation cancelled</strong>
                        <span title={cancelled().file.name}>
                          {cancelled().file.name}
                        </span>
                        <small>
                          This song was not staged. The file is ready if you
                          want to try again.
                        </small>
                      </div>
                    )}
                  </Match>
                  <Match when={activeBacking()}>
                    {(backing) => (
                      <>
                        <strong>{backing().title}</strong>
                        <span>
                          {backing().stems.length} local{' '}
                          {backing().stems.length === 1 ? 'stem' : 'stems'}{' '}
                          ready
                        </span>
                        <small>
                          {backing().defaultMix.kind === 'parts'
                            ? backing().defaultMix.muted.length > 0
                              ? 'The guitar part is staged separately and defaults muted.'
                              : 'The available band parts are staged without a separate guitar track.'
                            : 'Guitar is still inside this instrumental mix, so no guitar-mute control is shown.'}
                        </small>
                      </>
                    )}
                  </Match>
                  <Match
                    when={songController.selectionState().kind === 'loading'}
                  >
                    <strong>Opening the prepared song</strong>
                    <span>Reading its local stems from this device…</span>
                    <small>No playback or listening has started.</small>
                  </Match>
                  <Match when={unavailableSelection()}>
                    {(selection) => (
                      <>
                        <strong>Song unavailable here</strong>
                        <span>{unavailableSongCopy(selection())}</span>
                        <small>
                          Choose another prepared song or select the audio file
                          again.
                        </small>
                      </>
                    )}
                  </Match>
                  <Match when={true}>
                    <strong>No song or score selected</strong>
                    <span>Audio, MIDI, or Guitar Pro</span>
                    <small>
                      Your files stay on this device and open without an upload
                      or automatic playback.
                    </small>
                  </Match>
                </Switch>
              </GuitarNightFileDrop>

              <section
                class={styles.songLibrary}
                aria-labelledby="guitar-night-library-title"
                aria-busy={
                  songController.libraryState() === 'idle' ||
                  songController.libraryState() === 'loading'
                    ? 'true'
                    : 'false'
                }
              >
                <div class={styles.songLibraryHeader}>
                  <h2 id="guitar-night-library-title">Prepared songs</h2>
                  <Show when={songController.libraryState() === 'ready'}>
                    <span>
                      {hiddenSongCount() > 0
                        ? `${visibleSongs().length} of ${deviceSongs().length} on this device`
                        : `${deviceSongs().length} on this device`}
                    </span>
                  </Show>
                </div>

                <Switch>
                  <Match
                    when={
                      songController.libraryState() === 'idle' ||
                      songController.libraryState() === 'loading'
                    }
                  >
                    <p
                      class={styles.songMessage}
                      role="status"
                      aria-live="polite"
                    >
                      Opening your local library…
                      <Show when={libraryOpenIsSlow()}>
                        <small>
                          The first open after an update re-checks the audio
                          already saved on this device. A large library can take
                          a minute, and nothing is lost while it works.
                        </small>
                      </Show>
                    </p>
                  </Match>
                  <Match when={songController.libraryState() === 'error'}>
                    <div class={styles.songMessageRow} role="alert">
                      <p>Your local library could not be opened.</p>
                      <button type="button" onClick={songController.retry}>
                        Try again
                      </button>
                    </div>
                  </Match>
                  <Match
                    when={
                      songController.libraryState() === 'ready' &&
                      deviceSongs().length === 0
                    }
                  >
                    <p class={styles.songMessage}>
                      No prepared songs on this device yet.
                    </p>
                  </Match>
                  <Match when={deviceSongs().length > 0}>
                    <ul class={styles.songList}>
                      <For each={visibleSongs()}>{songChoice}</For>
                    </ul>
                    <Show when={hiddenSongCount() > 0}>
                      <button
                        type="button"
                        class={styles.songListMore}
                        onClick={() =>
                          setVisibleSongLimit(
                            (limit) => limit + LIBRARY_PAGE_STEP,
                          )
                        }
                      >
                        Show {nextRevealCount()} more
                      </button>
                    </Show>
                  </Match>
                </Switch>

                {/* The demo sits outside the Switch on purpose: the room
                    it is for is the one with an empty library, and inside
                    the Switch that is the branch it would never render
                    in. It is never paginated away either — one row. */}
                <Show when={demoSongs().length > 0}>
                  <p
                    class={styles.songDemoKicker}
                    data-testid="guitar-night-demo-kicker"
                  >
                    {deviceSongs().length === 0
                      ? 'Nothing separated yet? Play along with the demo.'
                      : 'Or play along with the demo.'}
                  </p>
                  <ul class={styles.songList}>
                    <For each={demoSongs()}>{songChoice}</For>
                  </ul>
                </Show>
              </section>

              <section
                class={styles.songLibrary}
                aria-labelledby="guitar-night-reference-title"
                aria-busy={
                  referenceController.libraryState() === 'idle' ||
                  referenceController.libraryState() === 'loading'
                }
              >
                <div class={styles.songLibraryHeader}>
                  <h2 id="guitar-night-reference-title">Score to follow</h2>
                  <Show when={attachedReference() !== null}>
                    <button
                      type="button"
                      class={styles.referenceDetach}
                      onClick={() => referenceController.detach()}
                    >
                      Remove
                    </button>
                  </Show>
                </div>

                <Switch>
                  <Match when={attachedReference()}>
                    {(attached) => (
                      <div class={styles.referenceAttached}>
                        <strong>{attached().title}</strong>
                        <small>
                          {attached().kind === 'measured'
                            ? `${attached().notes.length} notes heard across ${Math.round((attached().coverage ?? 0) * 100)}% of this stem`
                            : `${attached().notes.length} authored notes at ${attached().tempoBpm} BPM`}
                        </small>
                        <small>
                          On a {attached().tuning.stringCount}-string{' '}
                          {attached().tuning.instrument} ·{' '}
                          {attached().tuning.labels.join(' ')}
                        </small>
                        <Show when={attached().liftedOctaves === true}>
                          <small>
                            Raised by whole octaves to reach this instrument’s
                            range.
                          </small>
                        </Show>
                        <Show
                          when={
                            attached().kind === 'authored' &&
                            activeBacking() !== null
                          }
                        >
                          <small>
                            This tab keeps its own {attached().tempoBpm} BPM, so
                            it rehearses in the tab room rather than over the
                            backing — until it is hung on this recording.
                          </small>
                          <button
                            type="button"
                            class={styles.referenceOnRecordingButton}
                            onClick={() =>
                              void referenceController.placeScoreByHand(
                                attached().songId,
                                attached().trackId,
                              )
                            }
                          >
                            Place it on this recording by hand
                          </button>
                        </Show>
                        <GuitarNightOnRecording
                          scores={referenceController.alignableScores()}
                          reading={referenceController.readingOnRecording()}
                          offer={attached().kind === 'measured'}
                          status={referenceController.alignStatus()}
                          fallback={referenceController.handFallback()}
                          placingByHand={
                            referenceController.handPlacement() !== null &&
                            referenceController.readingOnRecording() === null
                          }
                          onPlaceByHand={(songId) =>
                            void referenceController.placeScoreByHand(songId)
                          }
                          onRead={(songId) =>
                            void referenceController.readScoreOnRecording(
                              songId,
                            )
                          }
                          onStop={() =>
                            referenceController.stopReadingOnRecording()
                          }
                        />
                        <Show when={attached().outOfRangeNotes > 0}>
                          <small>
                            {attached().outOfRangeNotes}{' '}
                            {attached().outOfRangeNotes === 1
                              ? 'note sits'
                              : 'notes sit'}{' '}
                            off this neck, so{' '}
                            {attached().outOfRangeNotes === 1
                              ? 'it is'
                              : 'they are'}{' '}
                            not shown. Another instrument or string count may
                            reach them.
                          </small>
                        </Show>
                        <Show when={attached().tracks.length > 1}>
                          <div
                            class={styles.referenceTracks}
                            role="group"
                            aria-label="Visible part"
                          >
                            <For each={attached().tracks}>
                              {(track) => (
                                <button
                                  type="button"
                                  classList={{
                                    [styles.referenceTrackActive]:
                                      track.id === attached().trackId,
                                  }}
                                  aria-pressed={track.id === attached().trackId}
                                  onClick={() =>
                                    void referenceController.selectTrack(
                                      track.id,
                                    )
                                  }
                                >
                                  {track.name}
                                </button>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    )}
                  </Match>
                  <Match when={unavailableReference()}>
                    {(unavailable) => (
                      <p class={styles.songMessage}>
                        {unavailableReferenceCopy(unavailable())}
                      </p>
                    )}
                  </Match>
                  <Match
                    when={
                      referenceController.libraryState() === 'idle' ||
                      referenceController.libraryState() === 'loading'
                    }
                  >
                    <p
                      class={styles.songMessage}
                      role="status"
                      aria-live="polite"
                    >
                      Opening your score library…
                    </p>
                  </Match>
                  <Match when={referenceController.references().length > 0}>
                    <ul class={styles.songList}>
                      <For each={referenceController.references()}>
                        {(summary) => (
                          <li>
                            <button
                              type="button"
                              onClick={() =>
                                void referenceController.attach(summary.songId)
                              }
                            >
                              <span>
                                <strong>{summary.title}</strong>
                                <small>
                                  {summary.trackCount}{' '}
                                  {summary.trackCount === 1 ? 'part' : 'parts'}{' '}
                                  · {formatPreparedDate(summary.importedAt)}
                                </small>
                              </span>
                              <i aria-hidden="true">Attach</i>
                            </button>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Match>
                  <Match when={true}>
                    <p class={styles.songMessage}>
                      No scores on this device yet. Use Choose a file above to
                      open Guitar Pro or MIDI — without one the stage stays in
                      honest free play.
                    </p>
                  </Match>
                </Switch>

                <Show when={referenceController.importStatus()}>
                  {(status) => (
                    <p class={styles.referenceError} role="alert">
                      {status()}
                    </p>
                  )}
                </Show>

                <Show when={transcribableStems().length > 0}>
                  <div class={styles.referenceActions}>
                    <For each={transcribableStems()}>
                      {(stem) => (
                        <Switch>
                          <Match
                            when={
                              referenceController.transcribingStem()
                                ?.stemKind === stem.kind
                            }
                          >
                            <button
                              type="button"
                              class={styles.songListMore}
                              onClick={referenceController.cancelFollowStem}
                            >
                              Reading the {stem.label.toLowerCase()} notes…{' '}
                              {Math.round(
                                (referenceController.transcribeProgress() ??
                                  0) * 100,
                              )}
                              % · Stop
                            </button>
                          </Match>
                          <Match
                            when={
                              referenceController.transcribeProgress() !== null
                            }
                          >
                            {/* One reader, one stem at a time — `followStem`
                                returns early on a second call, and a button
                                that silently does nothing is worse than one
                                that says it cannot. */}
                            <button
                              type="button"
                              class={styles.songListMore}
                              disabled
                            >
                              Transcribe the {stem.label.toLowerCase()} line
                            </button>
                          </Match>
                          <Match when={true}>
                            <button
                              type="button"
                              class={styles.songListMore}
                              onClick={() =>
                                void referenceController.followStem({
                                  sessionId: stem.sessionId,
                                  stemKind: stem.kind,
                                  stemLabel: stem.label,
                                  stemUrl: stem.url,
                                })
                              }
                            >
                              Transcribe the {stem.label.toLowerCase()} line
                            </button>
                          </Match>
                        </Switch>
                      )}
                    </For>
                  </div>
                </Show>
              </section>

              <div class={styles.detailActions}>
                <button type="button" onClick={returnToChoices}>
                  Back
                </button>
                <Switch>
                  <Match when={bandPreparation() !== null}>
                    <button
                      class={styles.completionAction}
                      type="button"
                      onClick={bandPreparationController.cancel}
                    >
                      Keep current mix
                    </button>
                  </Match>
                  <Match when={bandPreparationBlocked()}>
                    {(blocked) => (
                      <Switch
                        fallback={
                          <button
                            class={styles.completionAction}
                            type="button"
                            onClick={bandPreparationController.clear}
                          >
                            Keep current mix
                          </button>
                        }
                      >
                        <Match when={blocked().blocker.reason === 'signed-out'}>
                          <button
                            class={styles.completionAction}
                            type="button"
                            onClick={() =>
                              openBandPreparationSignIn(blocked().sessionId)
                            }
                          >
                            Sign in
                          </button>
                        </Match>
                        <Match
                          when={
                            blocked().blocker.reason === 'insufficient-credits'
                          }
                        >
                          <a
                            class={styles.completionAction}
                            href="/#/settings/credits"
                          >
                            Get credits
                          </a>
                        </Match>
                      </Switch>
                    )}
                  </Match>
                  <Match when={bandPreparationError()}>
                    {(error) => (
                      <button
                        class={styles.completionAction}
                        type="button"
                        onClick={() =>
                          bandPreparationController.start(error().sessionId)
                        }
                      >
                        Try full band again
                      </button>
                    )}
                  </Match>
                  <Match when={preparingSong() !== null}>
                    <button
                      class={styles.completionAction}
                      type="button"
                      onClick={preparationController.cancel}
                    >
                      Cancel preparation
                    </button>
                  </Match>
                  {/* A stopped separation is a dead end unless it can be put
                      down. Both of these branches used to offer retrying and
                      nothing else — and because they sit above the branches
                      that offer a room, a reader who cancelled a separation
                      and then attached a tab could not reach the tab at all.
                      Reported as: "I cannot remove that added item... all I
                      have from options is try again... but cannot rehearse and
                      close that loaded song for separation". */}
                  <Match when={preparationError()}>
                    {(error) => (
                      <>
                        <Show when={error().retryable}>
                          <button
                            class={styles.completionAction}
                            type="button"
                            onClick={preparationController.retry}
                          >
                            Try again
                          </button>
                        </Show>
                        <StoppedPreparationActions
                          onDiscard={preparationController.clear}
                          onRehearseTab={
                            authoredReference() === null
                              ? undefined
                              : enterScoreRoom
                          }
                        />
                      </>
                    )}
                  </Match>
                  <Match when={cancelledPreparation() !== null}>
                    <button
                      class={styles.completionAction}
                      type="button"
                      onClick={preparationController.retry}
                    >
                      Try again
                    </button>
                    <StoppedPreparationActions
                      onDiscard={preparationController.clear}
                      onRehearseTab={
                        authoredReference() === null
                          ? undefined
                          : enterScoreRoom
                      }
                    />
                  </Match>
                  <Match when={activeBacking()}>
                    {(backing) => (
                      <>
                        <button
                          class={styles.completionAction}
                          type="button"
                          onClick={enterRoom}
                        >
                          {authoredReference() === null
                            ? 'Enter room'
                            : 'Play along'}
                        </button>
                        {/* Two rooms, one at a time: the tab has its own
                            tempo and the recording has its own, and nothing
                            aligns them yet. */}
                        <Show when={authoredReference()}>
                          <button
                            class={styles.bandPreparationAction}
                            type="button"
                            onClick={enterScoreRoom}
                          >
                            Rehearse the tab
                          </button>
                        </Show>
                        <Show
                          when={
                            backing().defaultMix.kind === 'mixed-instrumental'
                          }
                        >
                          <button
                            class={styles.bandPreparationAction}
                            type="button"
                            title={SEPARATE_GUITAR_HINT}
                            onClick={prepareGuitarFreeBand}
                          >
                            Separate guitar
                          </button>
                        </Show>
                      </>
                    )}
                  </Match>
                  <Match when={authoredReference() !== null}>
                    {/* A tab alone is a complete rehearsal — no recording
                        needed to enter a room. */}
                    <button
                      class={styles.completionAction}
                      type="button"
                      onClick={enterScoreRoom}
                    >
                      Rehearse the tab
                    </button>
                  </Match>
                </Switch>
              </div>
            </Match>

            <Match when={view() === 'room' && activeBacking()}>
              <GuitarNightRoom
                backing={activeBacking()!}
                transport={playbackController}
                reference={measuredReference}
                tuning={referenceController.tuning}
                onInstrument={referenceController.setInstrument}
                onStringCount={referenceController.setStringCount}
                onTuning={referenceController.setTuning}
                suspended={learnOpen}
                onSongs={returnToSongs}
                authoredReference={authoredReference}
                onRehearseTab={enterScoreRoom}
                onAttachTab={returnToSongs}
                handSync={handSync}
                // Withheld for the demo. "Separate guitar" reconnects to a
                // durable separation record and then bills a cloud GPU
                // split against it; the demo has never had one, so the
                // button could only ever fail — and it names a price.
                onSeparateGuitar={
                  activeBacking()?.source === 'demo'
                    ? undefined
                    : prepareGuitarFreeBand
                }
              />
            </Match>

            <Match when={view() === 'score-room' && authoredReference()}>
              {(authored) => (
                <Suspense
                  fallback={
                    <p
                      class={styles.songMessage}
                      role="status"
                      aria-live="polite"
                    >
                      Opening the tab room…
                    </p>
                  }
                >
                  <GuitarNightScoreRoom
                    reference={authored}
                    tuning={referenceController.tuning}
                    onInstrument={referenceController.setInstrument}
                    onStringCount={referenceController.setStringCount}
                    onTuning={referenceController.setTuning}
                    suspended={learnOpen}
                    onSongs={returnToSongs}
                    onSelectTrack={(trackId) =>
                      void referenceController.selectTrack(trackId)
                    }
                    sheetLanes={referenceController.sheetLanes}
                    sheetTimeSignatures={
                      referenceController.sheetTimeSignatures
                    }
                    sheetVisibleTrackIds={
                      referenceController.sheetVisibleTrackIds
                    }
                    onToggleSheetTrack={referenceController.toggleSheetTrack}
                    secondaryLane={referenceController.secondaryLane}
                    backingMelody={
                      referenceController.rehearsalBackingMelodyNotes
                    }
                    defaultHearScore={
                      referenceController.scoredPartDefaultsAudible
                    }
                    audibleBackingTrackIds={
                      referenceController.audibleBackingTrackIds
                    }
                    mutedBackingTrackIds={
                      referenceController.mutedBackingTrackIds
                    }
                    onToggleBackingTrack={
                      referenceController.toggleBackingTrack
                    }
                    soloedBackingTrackId={
                      referenceController.soloedBackingTrackId
                    }
                    onToggleSoloBackingTrack={
                      referenceController.toggleSoloBackingTrack
                    }
                  />
                </Suspense>
              )}
            </Match>

            <Match
              when={
                isLearnActivityView(view())
                  ? (view() as LearnActivityView)
                  : null
              }
            >
              {(activity) => (
                <Suspense
                  fallback={
                    <p
                      class={styles.songMessage}
                      role="status"
                      aria-live="polite"
                    >
                      Opening Learn…
                    </p>
                  }
                >
                  <GuitarNightLearnRoom
                    activity={activity()}
                    tuning={learnActivityTuning}
                    active={() => view() === activity() && !learnOpen()}
                    onBack={returnFromLearnExercise}
                  />
                </Suspense>
              )}
            </Match>
          </Switch>
        </div>
      </main>

      <Notifications />
      <Show when={authModalMode() !== null}>
        <Suspense>
          <AuthModal
            tone="guitar-night"
            onAuthenticated={handleAuthenticated}
            prepareGoogleRedirect={prepareGoogleRedirect}
          />
        </Suspense>
      </Show>
      <Show when={showVoiceHelp()}>
        <VoiceCommandsOverlay
          tone="velvet"
          close={() => setShowVoiceHelp(false)}
        />
      </Show>

      <Show when={view() === 'tuner'}>
        <GuitarNightTunerPreflight
          tuning={referenceController.tuning}
          transport={playbackController}
          onTuning={referenceController.setTuning}
          onBack={closeTuner}
        />
      </Show>

      <Show when={learnOpen()}>
        <GuitarNightLearnShelf
          firstWinProgress={firstWinController.progress()}
          tuningLabel={guitarNightLearnTuningLabel(learnActivityTuning())}
          initialFocus={learnInitialFocus()}
          onFirstSteps={openFirstStepsFromLearn}
          onActivity={openLearnActivity}
          onClose={closeLearnShelf}
        />
      </Show>

      <Show when={!isStageView()}>
        <div
          class={styles.roomStatus}
          aria-label={`Room status: ${roomStatus().title}. ${roomStatus().detail}`}
        >
          <span aria-hidden="true" />
          <strong>{roomStatus().title}</strong>
          <small>{roomStatus().detail}</small>
        </div>
      </Show>

      <Show when={filePickerBlocked()}>
        <div
          class={styles.filePickerBlocked}
          role="alert"
          data-testid="guitar-night-file-picker-blocked"
        >
          <strong>This device has no file picker</strong>
          <small>{FILE_PICKER_UNAVAILABLE_MESSAGE}</small>
          <button type="button" onClick={() => setFilePickerBlocked(false)}>
            Dismiss
          </button>
        </div>
      </Show>

      <input
        ref={importInput}
        class={styles.fileInput}
        data-testid="guitar-night-file-input"
        type="file"
        accept={GUITAR_NIGHT_IMPORT_ACCEPT}
        disabled={referenceController.importPendingFileName() !== null}
        onChange={handleImportChange}
        tabindex="-1"
      />
    </div>
  )
}
