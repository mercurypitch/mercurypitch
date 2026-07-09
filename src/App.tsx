// ============================================================
// App — Main SolidJS application entry
// v3 refactor: thin shell using providers + controllers
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, Suspense, untrack, } from 'solid-js'
import { lazy } from 'solid-js'
import { AppSidebar } from '@/components/AppSidebar'
import { FocusMode } from '@/components/FocusMode'
import { HistoryCanvas } from '@/components/HistoryCanvas'
import { MusicBoard, SlidersHorizontal } from '@/components/icons'
import KeyboardShortcutOverlay from '@/components/KeyboardShortcutOverlay'
import { LibraryModal } from '@/components/LibraryModal'
import { MicInsightHint } from '@/components/MicInsightHint'
import { Notifications } from '@/components/Notifications'
import type { PianoRollEditorApi } from '@/components/PianoRollCanvas'
import { PianoRollCanvas } from '@/components/PianoRollCanvas'
import PitchAccuracyHeatmap from '@/components/PitchAccuracyHeatmap'
import { PitchCanvas } from '@/components/PitchCanvas'
import { ScaleBuilder } from '@/components/ScaleBuilder'
import { ControlOverlay } from '@/components/shared/control-bar/ControlOverlay'
import statusBarStyles from '@/components/shared/status-bar/SongStatusBar.module.css'
import { SingingControlBar } from '@/components/singing/SingingControlBar'
import { SingingStatusBar } from '@/components/singing/SingingStatusBar'
import { SingingCanvasHud } from '@/components/SingingCanvasHud'
import { AppNavTabs } from './components'

const SessionBrowser = lazy(async () =>
  import('@/components/SessionBrowser').then((m) => ({
    default: m.SessionBrowser,
  })),
)
const SessionEditor = lazy(async () =>
  import('@/components/SessionEditor').then((m) => ({
    default: m.SessionEditor,
  })),
)
import './styles/guitar-practice.css'
import './components/AppHeader.css'
import { HeaderAccount } from '@/components/account/HeaderAccount'
import { ComposeControlBar } from '@/components/compose/ComposeControlBar'
import { ComposeTakeReview } from '@/components/compose/ComposeTakeReview'
import { SessionCelebration } from '@/components/SessionCelebration'
import { SessionLibraryModal } from '@/components/SessionLibraryModal'
import { SkeletonTabContent } from '@/components/Skeleton'
import type { UvrView } from '@/components/UvrPanel'
import { EngineProvider, useEngines } from '@/contexts/EngineContext'
import { GuitarProvider, useGuitar } from '@/contexts/GuitarContext'
import { PlaybackProvider } from '@/contexts/PlaybackContext'
import { hasValidToken, takeGoogleRedirectResult, } from '@/db/services/auth-service'
import { initSettingsSync } from '@/db/services/settings-service'
import { useEditorController } from '@/features/editor/useEditorController'
import { usePianoRollEvents } from '@/features/events/usePianoRollEvents'
import { EXERCISE_SLUG_PATH, EXERCISE_SLUGS, } from '@/features/exercises/slug-map'
import type { ExerciseConfig, ExerciseType } from '@/features/exercises/types'
import { useFallingNotesController } from '@/features/falling-notes/useFallingNotesController'
import { useKeyboardShortcuts } from '@/features/keyboard/useKeyboardShortcuts'
import { autoCalibrateSensitivity } from '@/features/mic-feedback/auto-calibrate'
import { useMicInsights } from '@/features/mic-feedback/useMicInsights'
import { usePlaybackMicNudge } from '@/features/mic-feedback/usePlaybackMicNudge'
import { usePlaybackController } from '@/features/playback/usePlaybackController'
import type { BackingNote } from '@/features/playback/useSingingBacking'
import { useSingingBacking } from '@/features/playback/useSingingBacking'
import { usePracticeController } from '@/features/practice/usePracticeController'
import { SparklineChart } from '@/features/practice-intelligence/components/SparklineChart'
import { clearLaunchOverride, setLaunchOverride, } from '@/features/practice-intelligence/launch-override'
import { computeImprovementRate, computePracticeStats, getRecentScores, } from '@/features/practice-intelligence/trends-computer'
import { generateWeaknessReport } from '@/features/practice-intelligence/weakness-analyzer'
import { useRecordingController } from '@/features/recording/useRecordingController'
import type { RoutineTemplate } from '@/features/routines/types'
import { loadSharedRoutine } from '@/features/routines/use-daily-routine'
import { useHashRouter } from '@/features/routing/useHashRouter'
import { useSessionSequencer } from '@/features/session/useSessionSequencer'
import { isTabVisible, PLAYBACK_MODE_ONCE, PLAYBACK_MODE_REPEAT, PLAYBACK_MODE_SESSION, scopeHomeTab, TAB_ANALYSIS, TAB_CHALLENGES, TAB_COMMUNITY, TAB_COMPOSE, TAB_EXERCISES, TAB_GUITAR, TAB_JAM, TAB_KARAOKE, TAB_LEADERBOARD, TAB_PIANO, TAB_SETTINGS, TAB_SINGING, tabLabel, visibleTabOrder, } from '@/features/tabs/constants'
import { usePageTourOffer } from '@/features/tours/usePageTourOffer'
import { clampLoopB, isSeekOutsideLoop, shouldLoopBack } from '@/lib/ab-loop'
import type { InstrumentType } from '@/lib/audio-engine'
import { audioRegistry } from '@/lib/audio-registry'
import { debounce } from '@/lib/debounce'
import { registerE2EBridge } from '@/lib/e2e-bridge'
import type { MidiSongNote } from '@/lib/midi-song'
import { initDefaultOGTags, setMelodyOGTags } from '@/lib/og-tags'
import { segmentContourToMelody } from '@/lib/pitch-pipeline'
import { melodyIndicesAtBeat, melodyTotalBeats, midiToFreq, midiToNote, } from '@/lib/scale-data'
import { installSelectBlurOnPointerChange } from '@/lib/select-blur'
import { buildScaleMelody, buildSessionPlaybackMelody, } from '@/lib/session-builder'
import { copyShareUrl, decodeSharePayload, encodeMelodyForShare, fetchShortPayload, generateMelodyItemsFromCompact, } from '@/lib/share-codec'
import { hasSharedPresetInURL, loadFromURL } from '@/lib/share-url'
import { buildFingerprintIndex, loadStemFingerprints, } from '@/lib/shazam/melody-fingerprints'
import { storageGet } from '@/lib/storage'
import { useFileDropZone } from '@/lib/use-file-drop-zone'
import { useMidiSongPicker } from '@/lib/use-midi-song-picker'
import { AnalysisPage } from '@/pages/AnalysisPage'
import { ChallengesPage } from '@/pages/ChallengesPage'
import { CommunityPage } from '@/pages/CommunityPage'
import { ExercisesPage } from '@/pages/ExercisesPage'
import { GuitarPage } from '@/pages/GuitarPage'
import { JamPage } from '@/pages/JamPage'
import { KaraokePage } from '@/pages/KaraokePage'
import { LeaderboardPage } from '@/pages/LeaderboardPage'
import { PianoPage } from '@/pages/PianoPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { celebrationData, dismissCelebration, dismissSurvey, dismissWelcome, openWalkthroughChapter, pendingDrill, selectedWalkthrough, setActiveTab, setActiveUserSession, setBpm, setEditorView, setInstrument, setKeyName, setPendingDrill, setPlaybackSpeed, setScaleType, setSidebarCollapsed, setSidebarOpen, showSelection, sidebarCollapsed, sidebarOpen, walkthroughModalOpen, } from '@/stores'
import { activeTab as activeTabSignal, appStore, bpm, countIn, editorView, endPracticeSession, focusMode as focusModeSignal, getNoteAccuracyMap, getSessionHistory, hideLibrary, hideSessionLibrary, hideSessionPresetsLibrary, initTheme, isLibraryModalOpen as isLibraryModalOpenSignal, isSessionLibraryModalOpen as isSessionLibraryModalOpenSignal, keyName as keyNameSignal, micActive, onTabTransition, openLearningWalkthrough, playbackSpeed, scaleType as scaleTypeSignal, sessionMode, showNotification, showSessionBrowser, showSessionPresetsLibrary, showWelcome, startWalkthrough, surveySeen, walkthroughActive, } from '@/stores'
import { advancedFeaturesEnabled, initGroupStore, initSessionStore, } from '@/stores/app-store'
import { refreshBalance } from '@/stores/billing-store'
import { selectedSongName as pianoSongName } from '@/stores/falling-notes-store'
import { setJamRoomToJoin } from '@/stores/jam-store'
import { initKaraokePlaylistStore } from '@/stores/karaoke-playlist-store'
import { melodyStore } from '@/stores/melody-store'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import { savedMidiSongs } from '@/stores/saved-midi-songs-store'
import { getSession, setSelectedMelodyIds, templateToSession, userSession, } from '@/stores/session-store'
import { CHARACTER_INFO, fontFamily, practiceScope, selectedCharacter, showHistoryPanel, showPracticeResultPopup, uiMode, VOCAL_RANGES, vocalRangePreset, } from '@/stores/settings-store'
import { openSettingsSection, settingsSection } from '@/stores/ui-store'
import { activityCount, recordActivity, startUsageTracking, usageMs, } from '@/stores/usage-store'
import type { PlaybackSession } from '@/types'
import type { ActiveTab, MelodyItem, PlaybackMode, PracticeSubMode, SpacedRestMode, } from '@/types'
import { CHORD_INTERVALS } from '@/types'
import { SupportBadge, Walkthrough, WalkthroughControl } from './components'
import { LyricsUploaderStyles, StemMixerStyles } from './components'
import styles from './components/App.module.css'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { CrashModal } from './components/CrashModal'
import { GuideSelection } from './components/GuideSelection'
import { TabErrorBoundary } from './components/TabErrorBoundary'
import UserSurveyModal from './components/UserSurveyModal'
import { WelcomeScreen } from './components/WelcomeScreen'

// ============================================================
// Tab type
// ============================================================

export type EditorView = 'piano-roll' | 'session-editor'

interface AppProps {
  onMounted?: () => void
}

/** Filter melody items based on practice sub-mode */
function applySpacedRests(
  melody: MelodyItem[],
  mode: SpacedRestMode,
): MelodyItem[] {
  if (mode === 'none') return melody
  const restBeats = mode === 'fourth' ? 1 : mode === 'half' ? 2 : 4
  const result: MelodyItem[] = []
  let cursor = 0
  for (let i = 0; i < melody.length; i++) {
    const item = melody[i]
    result.push({ ...item, startBeat: cursor })
    cursor += item.duration
    if (i < melody.length - 1) {
      result.push({
        id: -100000 - i,
        note: item.note,
        startBeat: cursor,
        duration: restBeats,
        isRest: true,
      })
      cursor += restBeats
    }
  }
  return result
}

function filterMelodyForPractice(
  melody: MelodyItem[],
  subMode: PracticeSubMode,
): MelodyItem[] {
  if (subMode === 'all') return melody

  if (subMode === 'reverse') {
    return [...melody].reverse().map((item) => ({
      ...item,
      startBeat: 0,
    }))
  }

  if (subMode === 'random') {
    return melody.filter(() => Math.random() >= 0.5)
  }

  if (subMode === 'focus') {
    const history = getSessionHistory()
    if (history.length === 0) return melody
    const errorCounts = new Map<number, number>()
    for (const session of history) {
      // Each session has noteResults with avgCents per note
      // We approximate by looking at score — low scores = many errors
      if (session.score < 70) {
        // Rough heuristic: low-scoring sessions suggest problem notes
        // Count each session as a "bad note" indicator
        for (let i = 0; i < Math.ceil((100 - session.score) / 10); i++) {
          const idx = i % melody.length
          errorCounts.set(idx, (errorCounts.get(idx) ?? 0) + 1)
        }
      }
    }
    if (errorCounts.size === 0) return melody
    const errorIndices = new Set(errorCounts.keys())
    return melody.filter((_, i) => errorIndices.has(i))
  }

  return melody
}

// Instrument glyphs for the header practice-context pill (Piano / Guitar).
// Guitar path mirrors the nav-tab icon for continuity; the character avatar is
// used instead on the Singing tab.
const PianoGlyph = () => (
  <svg
    class="header-melody-glyph"
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M8 5v9M12 5v9M16 5v9" stroke-width="1.3" />
  </svg>
)
const GuitarGlyph = () => (
  <svg
    class="header-melody-glyph"
    viewBox="0 0 24 24"
    width="18"
    height="18"
    aria-hidden="true"
  >
    <g transform="rotate(45 12 12)" fill="currentColor">
      <path d="M10.7 1.6h2.6l.55 3.1h-3.7z" />
      <path d="M11.05 5.4h1.9l.25 5.2h-2.4z" />
      <path
        fill-rule="evenodd"
        d="M12 10.3c2.7 0 3.9 1.3 3.5 2.8-.2.9-.2 1.4.4 2.4 1 1.7.1 6.2-3.9 6.2s-4.9-4.5-3.9-6.2c.6-1 .6-1.5.4-2.4-.4-1.5.8-2.8 3.5-2.8zm0 2.7a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5z"
      />
    </g>
  </svg>
)

const AppShell: Component<AppProps> = (props) => {
  const { audioEngine, playbackRuntime, practiceEngine } = useEngines()
  const guitarCtx = useGuitar()

  // ── Local UI state ──────────────────────────────────────────
  const activeTab = (): ActiveTab => activeTabSignal()
  const focusMode = focusModeSignal

  // Store-backed (ui-store) so the tour engine can open the mobile sidebar
  // and expand the desktop-collapsed rail (sidebarCollapsed lives there too).
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen())
  const closeSidebar = () => setSidebarOpen(false)

  // Sync audio engine instrument when switching tabs
  createEffect(() => {
    const tab = activeTab()
    const engine = audioEngine

    if (tab === TAB_GUITAR) {
      engine.setInstrument(guitarCtx.guitar.instrumentType())
    } else if (tab === TAB_PIANO) {
      engine.setInstrument('piano')
    }
  })

  const [showScaleBuilder, setShowScaleBuilder] = createSignal(false)
  const [savedVol, setSavedVol] = createSignal<number>(80)
  const [metronomeEnabled, setMetronomeEnabled] = createSignal(false)

  // ── Play mode ───────────────────────────────────────────────
  const [playMode, setPlayMode] = createSignal<PlaybackMode>(PLAYBACK_MODE_ONCE)
  const [repeatCycles, setRepeatCycles] = createSignal<number>(5)
  const [currentRepeat, setCurrentRepeat] = createSignal<number>(1)
  const [practiceSubMode, setPracticeSubMode] =
    createSignal<PracticeSubMode>('all')
  const [spacedRestMode, setSpacedRestMode] =
    createSignal<SpacedRestMode>('none')

  const [initialUvrSessionId, setInitialUvrSessionId] = createSignal<
    string | null
  >(null)
  const [initialUvrView, setInitialUvrView] = createSignal<UvrView | null>(null)
  const [activeUvrSessionId, setActiveUvrSessionId] = createSignal<
    string | null
  >(null)
  const [activeUvrView, setActiveUvrView] =
    createSignal<UvrView>('shazam-listen')

  // ── Exercises ────────────────────────────────────────────────
  const [selectedExercise, setSelectedExercise] =
    createSignal<ExerciseType | null>(null)
  const [autoStartExercise, setAutoStartExercise] = createSignal(false)
  const clearExercise = () => {
    setSelectedExercise(null)
    setPendingDrill(null)
    setAutoStartExercise(false)
    clearLaunchOverride()
  }
  const handleQuickStart = (type: ExerciseType, config?: ExerciseConfig) => {
    // A targeted drill carries a one-shot difficulty / target note; a normal
    // launch passes no config, which clears any stale override.
    setLaunchOverride(type, config)
    setSelectedExercise(type)
    setAutoStartExercise(true)
  }

  // Apply a marketing deep-link slug (`/exercises/<slug>`, see slug-map.ts) to
  // a launch intent: open a tab, or open a pre-configured exercise on its setup
  // screen (the user presses Start). Unknown slugs warn and fall through to the
  // default tab — never throw, so a stale/mistyped link still loads a usable app.
  const applyExerciseSlug = (slug: string) => {
    // `Object.hasOwn` (not `EXERCISE_SLUGS[slug]` truthiness) so an unknown
    // slug that collides with a prototype key (e.g. `constructor`) still
    // resolves to "not found" rather than an inherited value.
    if (!Object.hasOwn(EXERCISE_SLUGS, slug)) {
      showNotification('Exercise not found', 'warning')
      return
    }
    const launch = EXERCISE_SLUGS[slug]
    if (launch.kind === 'tab') {
      setActiveTab(launch.tab)
      return
    }
    // Resolve the target notes: explicit list wins, otherwise derive them from
    // the named seeded scale melody (its note names, in order).
    const notes =
      launch.notes && launch.notes.length > 0
        ? launch.notes
        : launch.scaleId !== undefined
          ? melodyStore
              .getMelody(launch.scaleId)
              ?.items.map((it) => `${it.note.name}${it.note.octave}`)
          : undefined
    setActiveTab(TAB_EXERCISES)
    setSelectedExercise(launch.exercise)
    setLaunchOverride(launch.exercise, {
      type: launch.exercise,
      ...(notes && notes.length > 0
        ? { targetNote: notes[0], targetNotes: notes }
        : {}),
      ...(launch.difficulty !== undefined
        ? { difficulty: launch.difficulty }
        : {}),
    })
    // Intentionally do NOT auto-start. Starting acquires the mic, which
    // browsers only grant from a user gesture; a fresh deep-link load has none,
    // so an auto-start would stall on a blank count-in screen waiting for a
    // prompt that never fires. The pre-configured setup screen (target note
    // filled in) renders immediately and its Start button is that gesture.
    setAutoStartExercise(false)
  }

  // Auto-launch exercise drill from challenge "Practice" button.
  // Stash the drill's curated target notes as a one-shot launch override so
  // the exercise starts on the challenge's notes, then consume the pending
  // drill once so it doesn't re-fire and trap the user on that exercise.
  createEffect(() => {
    const drill = pendingDrill()
    if (drill && activeTab() === TAB_EXERCISES) {
      if (drill.notes.length > 0 || drill.pattern != null) {
        setLaunchOverride(drill.exercise, {
          type: drill.exercise,
          targetNote: drill.notes[0],
          targetNotes: drill.notes.length > 0 ? drill.notes : undefined,
          pattern: drill.pattern,
        })
      }
      // Exercises read their launch override at mount. If the same type is
      // already selected (it survives tab switches), the component would keep
      // its old config — force a fresh mount so the new drill takes effect.
      // The re-select must land AFTER this effect flushes: writes inside an
      // effect coalesce, so back-to-back writes never unmount anything.
      if (untrack(selectedExercise) === drill.exercise) {
        setSelectedExercise(null)
        queueMicrotask(() => setSelectedExercise(drill.exercise))
      } else {
        setSelectedExercise(drill.exercise)
      }
      setPendingDrill(null)
    }
  })

  // ── Guide Selection dialog ──────────────────────────────────
  const [showSurvey, setShowSurvey] = createSignal(false)
  const [surveyChecked, setSurveyChecked] = createSignal(false)

  const [showShortcutHelp, setShowShortcutHelp] = createSignal(false)
  const toggleShortcutHelp = () => setShowShortcutHelp((v) => !v)

  const [showGuideSelection, setShowGuideSelection] = createSignal(false)
  const openGuideSelection = () => setShowGuideSelection(true)
  const closeGuideSelection = () => setShowGuideSelection(false)
  const startGuideTour = (sectionIds: string[]) => {
    // Start before closing the dialog so a tour surface stays open across the
    // hand-off (the deferred survey checks for one — see tourSurfaceOpen).
    startWalkthrough(sectionIds)
    closeGuideSelection()
  }

  // ── Swipe to Change Tabs ──────────────────────────────────
  let touchStartX = 0
  let touchStartY = 0

  const handleTouchStart = (e: TouchEvent) => {
    const target = e.target as HTMLElement
    // Allow swiping on canvas now, but still ignore buttons, inputs, and modals
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'BUTTON' ||
      target.closest('button, input, select, .fn-modal-content, .library-modal')
    ) {
      return
    }
    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX === 0) return
    const touchEndX = e.changedTouches[0].clientX
    const touchEndY = e.changedTouches[0].clientY

    const deltaX = touchStartX - touchEndX
    const deltaY = touchStartY - touchEndY

    // Require swiping across at least 35% of the screen width to prevent accidental tab changes
    const swipeThreshold = window.innerWidth * 0.35

    if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaY) < 80) {
      // Swipe order follows the same canonical order the tab bar renders,
      // filtered by scope/UI mode, so the gesture and the visible tabs can
      // never drift out of sync.
      const order = visibleTabOrder(practiceScope(), uiMode())
      const currentIdx = order.indexOf(activeTab())
      if (currentIdx !== -1) {
        if (deltaX > 0 && currentIdx < order.length - 1) {
          void handleTabChange(order[currentIdx + 1])
        } else if (deltaX < 0 && currentIdx > 0) {
          void handleTabChange(order[currentIdx - 1])
        }
      }
    }

    touchStartX = 0
    touchStartY = 0
  }

  // ── Share handlers ─────────────────────────────────────────
  const handleShareMelody = (payload: string) => {
    const decoded = decodeSharePayload(payload)
    if (!decoded || decoded.t !== 'melody') return
    const data = decoded.d as unknown as Record<string, unknown>
    const name = typeof data.n === 'string' ? data.n : 'Shared Melody'
    const bpmVal = typeof data.b === 'number' ? data.b : 120
    const keyVal = typeof data.k === 'string' ? data.k : undefined
    const scaleVal = typeof data.s === 'string' ? data.s : undefined
    const items = Array.isArray(data.i)
      ? generateMelodyItemsFromCompact(
          data.i as Parameters<typeof generateMelodyItemsFromCompact>[0],
        )
      : []
    if (items.length === 0) {
      showNotification('Shared melody is empty or invalid', 'warning')
      return
    }
    melodyStore.setMelody(items)
    if (bpmVal > 0) setBpm(bpmVal)
    if (keyVal != null && keyVal !== '') setKeyName(keyVal)
    if (scaleVal != null && scaleVal !== '') setScaleType(scaleVal)
    setActiveTab(TAB_COMPOSE)
    showNotification(`Loaded shared melody: ${name}`, 'info')
  }

  const handleShareExercise = (payload: string) => {
    const decoded = decodeSharePayload(payload)
    if (!decoded || decoded.t !== 'exercise') return
    const data = decoded.d as unknown as Record<string, unknown>
    if (typeof data.e !== 'string') {
      showNotification('Shared exercise is invalid', 'warning')
      return
    }
    setActiveTab(TAB_EXERCISES)
    setSelectedExercise(data.e as ExerciseType)
    setAutoStartExercise(true)
    showNotification(`Loaded shared exercise: ${decoded.n ?? data.e}`, 'info')
  }

  const handleShareRoutine = (payload: string) => {
    const decoded = decodeSharePayload(payload)
    if (!decoded || decoded.t !== 'routine') return
    const data = decoded.d as unknown as Record<string, unknown>
    const id = typeof data.id === 'string' ? data.id : ''
    const name = typeof data.n === 'string' ? data.n : 'Shared Routine'
    const description = typeof data.desc === 'string' ? data.desc : ''
    const segs = Array.isArray(data.seg) ? data.seg : []
    if (segs.length === 0) {
      showNotification('Shared routine has no segments', 'warning')
      return
    }
    const routine: RoutineTemplate = {
      id,
      name,
      description,
      segments: segs.map((s: unknown) => {
        const seg = s as Record<string, unknown>
        return {
          type: (typeof seg.k === 'string'
            ? seg.k
            : 'exercise') as RoutineTemplate['segments'][0]['type'],
          durationSec: typeof seg.d === 'number' ? seg.d : 60,
          config: (typeof seg.c === 'object' && seg.c !== null
            ? seg.c
            : {}) as RoutineTemplate['segments'][0]['config'],
        }
      }),
    }
    const hadProgress = loadSharedRoutine(routine)
    setActiveTab(TAB_EXERCISES)
    setAutoStartExercise(true)
    if (hadProgress) {
      showNotification(
        `Loaded shared routine. Your previous progress was replaced.`,
        'warning',
      )
    } else {
      showNotification(`Loaded shared routine: ${decoded.n ?? name}`, 'info')
    }
  }

  const handleShareFallback = (_shareType: string, _shareId: string) => {
    showNotification(
      'This shared link may have expired or was created in an older version.',
      'warning',
    )
  }

  const handleShareShort = (shortId: string) => {
    void (async () => {
      const raw = await fetchShortPayload(shortId)
      if (raw == null || raw === '') {
        showNotification(
          'This shared link has expired or is invalid.',
          'warning',
        )
        return
      }
      const decoded = decodeSharePayload(raw)
      if (!decoded) {
        showNotification(
          'Shared content is corrupted or in an older format.',
          'warning',
        )
        return
      }
      if (decoded.t === 'melody') {
        handleShareMelody(raw)
      } else if (decoded.t === 'exercise') {
        handleShareExercise(raw)
      } else if (decoded.t === 'routine') {
        handleShareRoutine(raw)
      }
    })()
  }

  const handleCopyShareLink = () => {
    const items = melodyStore.items()
    if (items.length === 0) {
      showNotification('No melody to share', 'warning')
      return
    }
    const encoded = encodeMelodyForShare(
      items,
      bpm(),
      keyNameSignal(),
      scaleTypeSignal(),
      melodyTotalBeats(items),
      melodyStore.currentMelody()?.name,
    )
    void copyShareUrl(encoded).then((ok) => {
      if (ok) showNotification('Share link copied!', 'info')
      else showNotification('Failed to copy link', 'error')
    })
  }

  // ── Hash routing ────────────────────────────────────────────
  // Return from Stripe checkout: the router already navigated to Settings
  // (Account is its default sub-tab); confirm and refresh the balance. The
  // credit grant arrives via webhook, which can trail the redirect by a few
  // seconds — refresh again after a delay so the new balance shows up.
  const handleBillingReturn = (outcome: 'success' | 'cancel'): void => {
    if (outcome === 'success') {
      showNotification(
        'Payment received — credits are being added to your account.',
        'success',
      )
      refreshBalance()
      window.setTimeout(refreshBalance, 3000)
      window.setTimeout(refreshBalance, 10000)
    } else {
      showNotification('Checkout cancelled.', 'info')
    }
  }

  useHashRouter({
    setActiveTab,
    setInitialUvrView,
    setInitialUvrSessionId,
    setActiveUvrSessionId,
    openLearningWalkthrough,
    openWalkthroughChapter,
    startWalkthrough,
    setShowGuideSelection,
    setJamRoomToJoin,
    dismissWelcome,
    handleShareMelody,
    handleShareExercise,
    handleShareRoutine,
    handleShareFallback,
    handleShareShort,
    handleBillingReturn,
    openSettingsSection,
    settingsSection,
    activeTab,
    activeUvrView,
    activeUvrSessionId,
    showSelection,
    walkthroughModalOpen,
    showGuideSelection,
    selectedWalkthrough,
  })

  // Imperative bridge to the piano-roll editor, set once it mounts. Used to
  // commit recorded takes through the editor's undo history so a take is a
  // single undo step.
  const [editorApi, setEditorApi] = createSignal<PianoRollEditorApi | null>(
    null,
  )
  const applyTake = (merged: MelodyItem[]): void => {
    const api = editorApi()
    if (api !== null) api.applyMelody(merged)
    else melodyStore.setMelody(merged)
  }

  // ── Recording controller ────────────────────────────────────
  const recording = useRecordingController({
    audioEngine,
    playbackRuntime,
    practiceEngine,
    applyTake,
  })

  // ── Playback controller ─────────────────────────────────────
  const totalBeatsAccessor = createMemo(() =>
    melodyTotalBeats(melodyStore.items()),
  )

  const [_shouldAutoStartPlayback, setShouldAutoStartPlayback] =
    createSignal(false)

  // Practice controller will be wired after we have play state from playback controller.
  // Forward declarations via lazy holders (controllers are constructed in order):

  const playbackController = usePlaybackController({
    audioEngine,
    playbackRuntime,
    practiceEngine,
    playMode,
    setPlayMode,
    practiceSubMode,
    setPitchHistory: ((v: unknown) =>
      practice.setPitchHistory(v as never)) as never,
    setNoteResults: ((v: unknown) =>
      practice.setNoteResults(v as never)) as never,
    setPracticeResult: ((v: unknown) =>
      practice.setPracticeResult(v as never)) as never,
    setLiveScore: ((v: unknown) => practice.setLiveScore(v as never)) as never,
    closeSidebar,
    filterMelodyForPractice: (melody, subMode) =>
      playMode() === PLAYBACK_MODE_ONCE
        ? applySpacedRests(melody, spacedRestMode())
        : filterMelodyForPractice(melody, subMode),
    buildSessionPlaybackMelody,
    buildScaleMelody,
    isRecording: recording.isRecording,
    finalizeRecording: recording.finalizeRecording,
    totalBeats: totalBeatsAccessor,
    endPracticeSession,
    setShouldAutoStartPlayback,
  })

  const {
    isPlaying,
    isPaused,
    currentBeat,
    currentNoteIndex,
    activeNoteIndices,
    activePlaybackItems,
    totalBeats,
    handlePlay,
    handlePause,
    handleResume,
    handleStop,
    resetPlaybackState,
    editorPlaybackState,
    editorIsPlaying,
    editorIsPaused,
    handleEditorPlay,
    handleEditorPause,
    handleEditorResume,
    handleEditorStop,
  } = playbackController

  // ── Practice controller (animation loop, callbacks) ─────────
  const practice = usePracticeController({
    audioEngine,
    playbackRuntime,
    practiceEngine,
    recording,
    isPlaying,
    isPaused,
    editorIsPlaying,
    activeTab,
  })

  const {
    pitchHistory,
    setPitchHistory,
    currentPitch,
    noteResults,
    setNoteResults,
    practiceResult,
    setPracticeResult,
    liveScore,
    setLiveScore,
    frequencyData,
    waveformData,
    targetPitch,
    setTargetPitch,
    countInBeat,
    isCountingIn,
  } = practice

  // ── Compose live recording preview (Phase 2) ───────────────
  // Notes captured so far this take, plus the currently-held note growing with
  // the playhead. Kept out of melodyStore until the take is finalized.
  const liveRecordingMelody = createMemo<MelodyItem[]>(() => {
    if (!recording.isRecording()) return []
    const items = [...recording.recordedMelody()]
    const prov = recording.provisionalNote()
    if (prov != null) {
      const dur = Math.max(0.05, currentBeat() - prov.startBeat)
      const info = midiToNote(prov.midi)
      items.push({
        id: -1,
        note: {
          midi: prov.midi,
          name: info.name,
          octave: info.octave,
          freq: midiToFreq(prov.midi),
        },
        duration: dur,
        startBeat: prov.startBeat,
      })
    }
    return items
  })

  // ── Take review (Phase 3) ──────────────────────────────────
  // After a take stops, re-segment its retained contour at the chosen cleanup
  // amount (gentle: as-sung -> strong: key-snapped + quantized). This drives
  // both the on-roll preview and what Keep commits.
  const [reviewAmount, setReviewAmount] = createSignal(0.5)
  const reviewMelody = createMemo<MelodyItem[]>(() => {
    const take = recording.pendingTake()
    if (take === null) return []
    return segmentContourToMelody(take.frames, {
      bpm: bpm(),
      key: keyNameSignal(),
      scaleType: scaleTypeSignal(),
      cleanupAmount: reviewAmount(),
    })
  })

  // The piano roll's preview channel shows the live take while recording, then
  // the re-segmented candidate while reviewing.
  const previewMelody = createMemo<MelodyItem[]>(() =>
    recording.isRecording() ? liveRecordingMelody() : reviewMelody(),
  )

  const commitTake = (): void => {
    recording.commitTake(reviewMelody())
  }

  // During recording the grid grows to follow the playhead so the take is not
  // capped at the default arrangement length (the old 16-beat stop); during
  // review it stays large enough to show the whole take.
  const composeTotalBeats = createMemo(() => {
    const base = totalBeats()
    const BEATS_PER_BAR = 4
    if (recording.isRecording()) {
      const grown =
        (Math.floor((currentBeat() + 8) / BEATS_PER_BAR) + 1) * BEATS_PER_BAR
      return Math.max(base, 16, grown)
    }
    const take = recording.pendingTake()
    if (take !== null) {
      const end = Math.ceil((take.endBeat + 4) / BEATS_PER_BAR) * BEATS_PER_BAR
      return Math.max(base, 16, end)
    }
    return base
  })

  // Track playNote IDs by melody index so noteEnd can stop individual notes
  const activeNoteIds = new Map<number, number>()

  // Chord member target frequencies (polyphonic playback). Excludes the
  // primary note (first in activeNoteIndices) which is covered by targetPitch.
  const targetPitches = createMemo(() => {
    const active = activeNoteIndices()
    const items = activePlaybackItems()
    const freqs: number[] = []
    let first = true
    for (const idx of active) {
      if (first) {
        first = false
        continue
      }
      const item = items[idx]
      if (item != null && item.isRest !== true && item.note.freq > 0) {
        freqs.push(item.note.freq)
      }
    }
    return freqs
  })

  // ── Session sequencer ───────────────────────────────────────
  // Wire the sequencer to the SAME playback display setters the
  // playback controller owns. Previously these were noops, which meant
  // every per-item advance inside useSessionSequencer (next melody,
  // rest, scale) silently failed to update the practice canvas — so
  // canvas froze on whatever melody was loaded at Play time, and rest
  // items never produced a visible "rest" state. The controller now
  // exports `setPlaybackDisplayMelody` / `setPlaybackDisplayBeats` so
  // both modules mutate one shared signal pair.
  const sessionSequencer = useSessionSequencer({
    playbackRuntime,
    practiceEngine,
    liveScore,
    practiceResult,
    setPitchHistory: setPitchHistory as never,
    setNoteResults,
    setLiveScore,
    setPlaybackDisplayMelody: playbackController.setPlaybackDisplayMelody,
    setPlaybackDisplayBeats: playbackController.setPlaybackDisplayBeats,

    handleStop,
    handlePlay,
    setPlayMode,
    closeSidebar,
    currentRepeat,
    setCurrentRepeat,
    repeatCycles,
    buildScaleMelody,
    setCurrentBeat: ((_v: number) => {}) as never,
    setCurrentNoteIndex: ((_v: number) => {}) as never,
  })

  const {
    sessionSummary,
    setSessionSummary,
    handleSessionItemComplete,
    handleRepeatModeComplete,
    handleSessionSkip,
    handleSessionEnd,
    loadAndPlayMelodyForSession,
    playSessionSequence,
    playNextInSessionSequence,
    sessionMelodyIds,
    sessionCurrentMelodyIndex,
  } = sessionSequencer

  // ── Auto-select melody for vocal range ──────────────────────
  // If the user is on the default session, auto-select the major scale
  // corresponding to their chosen vocal range preset (Soprano, Tenor, etc.)
  createEffect(
    on(
      [vocalRangePreset, userSession],
      ([preset, sessionState]) => {
        const session = sessionState as PlaybackSession | null | undefined
        if (
          session !== null &&
          session !== undefined &&
          session.id === 'default'
        ) {
          const defaultOctave = VOCAL_RANGES[preset].defaultOctave
          const targetMelodyId = `scale-major-c${defaultOctave}`
          const match = session.items.find(
            (item) =>
              item.type === 'melody' &&
              (item as unknown as { melodyId: string }).melodyId ===
                targetMelodyId,
          )

          if (match !== undefined) {
            // Load it into the piano roll without starting playback
            loadAndPlayMelodyForSession(match.id)
            // Select it in the sidebar
            setSelectedMelodyIds([match.id])
          }
        }
      },
      { defer: false },
    ),
  )

  // ── Editor controller ──────────────────────────────────────
  // Handlers (handleShare, handleExportMIDI, handleImportMIDI) are exposed
  // for future toolbar integration. Currently unused at the App level.
  useEditorController({ audioEngine })

  // ── Falling Notes controller ─────────────────────────────────
  const fallingNotes = useFallingNotesController(audioEngine)

  // ── Header practice-context pill ─────────────────────────────
  // On the practice tabs the header sub-title becomes a contextual pill that
  // reads each tab's OWN loaded song. Singing also shows the guide character
  // (avatar + name); character playback is singing-only, so Piano/Guitar show
  // an instrument glyph and no character. Returns null elsewhere (plain title).
  const headerPracticeContext = (): {
    tab: typeof TAB_SINGING | typeof TAB_PIANO | typeof TAB_GUITAR
    name: string
    character?: string
    avatar?: string
  } | null => {
    const tab = activeTab()
    if (tab === TAB_SINGING) {
      const m = melodyStore.currentMelody()
      if (m == null) return null
      return {
        tab: TAB_SINGING,
        name: m.name ?? 'Untitled',
        character: CHARACTER_INFO[selectedCharacter()].displayName,
        avatar: `characters/${selectedCharacter()}_idle.svg`,
      }
    }
    if (tab === TAB_PIANO) {
      // selectedSongName covers built-in melodies AND imported MIDI (currentSong
      // is set only for imported songs, so it would miss the built-ins).
      const name = pianoSongName()
      return name === '' ? null : { tab: TAB_PIANO, name }
    }
    if (tab === TAB_GUITAR) {
      const name = guitarCtx.guitar.selectedSongName()
      return name === '' ? null : { tab: TAB_GUITAR, name }
    }
    return null
  }

  // Guitar-tab state (controller, drum machine, fretboard signals, 9 mode
  // states, handleFretNotePlayed, mode-lifecycle effect) lives in
  // GuitarContext now — consumed via guitarCtx above.

  const pianoIsPlaying = createMemo(
    () =>
      fallingNotes.gameState() === 'playing' ||
      fallingNotes.gameState() === 'countdown',
  )
  const pianoIsPaused = createMemo(() => fallingNotes.gameState() === 'paused')

  // ── Keyboard shortcuts & piano roll events ─────────────────
  useKeyboardShortcuts({
    isPlaying,
    isPaused,
    play: handlePlay,
    pause: handlePause,
    resume: handleResume,
    // handleStop is async (awaits audio teardown); wrap to satisfy
    // the keyboard hook's `() => void` stop signature.
    stop: () => {
      void handleStop()
    },
    seekToStart: () => {
      playbackRuntime.seekTo(0)
    },
    playMode,
    setPlayMode,
    activeTab,
    piano: {
      isPlaying: pianoIsPlaying,
      isPaused: pianoIsPaused,
      gameState: fallingNotes.gameState,
      startGame: () => {
        fallingNotes.setPianoCurrentCycle(1)
        void fallingNotes.startGame()
      },
      pauseGame: fallingNotes.pauseGame,
      resumeGame: fallingNotes.resumeGame,
      resetGame: fallingNotes.resetGame,
    },
    modals: {
      practiceResult,
      closePracticeResult: () => setPracticeResult(null),
      sessionSummary,
      closeSessionSummary: () => setSessionSummary(null),
      showScaleBuilder,
      closeScaleBuilder: () => setShowScaleBuilder(false),
      showGuideSelection,
      closeGuideSelection,
    },
    editor: {
      isPlaying: () => editorIsPlaying(),
      isPaused: () => editorIsPaused(),
      play: async () => {
        await handleEditorPlay()
      },
      pause: handleEditorPause,
      resume: handleEditorResume,
    },
    onMicToggle: () => {
      void handleMicToggle()
    },
    onToggleShortcutHelp: toggleShortcutHelp,
    guitar: {
      strumKeyboard: guitarCtx.guitar.strumKeyboard,
      togglePlayback: () => {
        // Only the interactive fretboard (jam) view owns the drum loop. The
        // playback views (Practice/hero and 3D) toggle the tab/melody playback
        // — i.e. the main toolbar play/pause.
        if (guitarCtx.fretboard.guitarView() === 'interactive') {
          if (guitarCtx.drumMachine.playing) {
            guitarCtx.drumMachine.stop()
          } else {
            void guitarCtx.drumMachine.init().then(() => {
              void guitarCtx.drumMachine.start()
            })
          }
        } else {
          guitarCtx.guitar.togglePlay()
        }
      },
    },
  })

  usePianoRollEvents({
    audioEngine,
    playbackRuntime,
    isPlaying,
    isPaused,
    setCurrentBeat: ((_b: number) => {
      // currentBeat is owned by playbackController; PianoRollEvents uses seekTo
      // which propagates back through playbackRuntime.on('beat') already.
    }) as never,
  })

  // Clean up pending session sequencer timeouts on unmount
  onCleanup(() => sessionSequencer.destroy())

  // ── Tab-change cleanup ──────────────────────────────────────
  // Registered as a SYNCHRONOUS listener at the setActiveTab choke point
  // (nav clicks, hash router and the E2E bridge all funnel through it).
  //
  // This was a `createEffect(on(activeTab, ..., { defer: true }))` before —
  // but with defer the initial run is skipped, so `on` never records a
  // previous input and the FIRST tab change after load fired with
  // prevTab === undefined, returning early: whichever tab you switched to
  // first kept the previous tab's audio running (e.g. singing playback kept
  // sounding under the piano tab). The listener runs before the signal
  // flips and cannot miss a transition.
  onTabTransition((prevTab, _newTab) => {
    // 1. Stop singing/compose playback + mic. resetPlaybackState ends the
    // practice session but leaves the mic running, so without this the mic
    // lingers after leaving and micActive stays stuck on — making the mic
    // button look active (and react to playback) on the next visit. Mirrors
    // the Piano/Guitar cleanup below.
    if (prevTab === TAB_SINGING || prevTab === TAB_COMPOSE) {
      void resetPlaybackState()
      if (micActive()) practiceEngine.stopMic()
    }

    // 2. Pause a running piano game (it otherwise keeps playing — and
    // sounding — invisibly on the previous tab; pause rather than stop so
    // coming back can resume, and discard a run still counting in) and
    // stop the piano mic if active.
    if (prevTab === TAB_PIANO) {
      const pianoState = fallingNotes.gameState()
      if (pianoState === 'playing') fallingNotes.pauseGame()
      else if (pianoState === 'countdown') fallingNotes.resetGame()
      if (fallingNotes.isMicActive()) fallingNotes.stopMic()
    }

    // 3. Stop guitar practice if active
    if (prevTab === TAB_GUITAR && guitarCtx.guitar.gameState() !== 'idle') {
      guitarCtx.guitar.stopGame()
    }

    // 4. Stop guitar mic if active. The guitar controller owns its mic
    // (shared MicManager), so stop it directly; practiceEngine.stopMic()
    // covers the singToFretboard mode's own mic.
    if (prevTab === TAB_GUITAR) {
      guitarCtx.guitar.stopMic()
      practiceEngine.stopMic()
    }
  })

  const handleTabChange = (newTab: ActiveTab) => {
    setActiveTab(newTab)
  }

  // ── Debounced auto-save for melody changes ─────────────────
  const debouncedAutoSave = debounce(() => {
    const currentMelody = melodyStore.getCurrentMelody()
    if (currentMelody === null) return
    showNotification('Melody saved!', 'success')
  }, 500)

  // If the active tab gets filtered out (scope/UI-mode change, or a deep link
  // into a hidden tab), land on the scope's home tab instead of a blank shell.
  //
  // The redirect is deferred to a microtask so it never runs mid-navigation:
  // hash dispatch and share handlers set one-shot intents (jam room to join,
  // exercise auto-start) around their setActiveTab call, and a synchronous
  // redirect would fire before those intents exist — leaving them stranded to
  // go off as stale surprises when the tab becomes visible later. By microtask
  // time the whole dispatch has finished (and the state→URL sync is no longer
  // muted, so the hash follows the redirect too).
  //
  // While a tour runs the guard stands down entirely: tour steps re-assert
  // their requiredTab, and redirecting against that is an unbounded loop.
  // walkthroughActive is tracked, so the guard re-evaluates when it ends.
  const appMountedAt = performance.now()
  createEffect(() => {
    const scope = practiceScope()
    const mode = uiMode()
    if (walkthroughActive()) return
    if (isTabVisible(activeTab(), scope, mode)) return
    queueMicrotask(() => {
      const s = untrack(practiceScope)
      const m = untrack(uiMode)
      if (untrack(walkthroughActive)) return
      if (isTabVisible(untrack(activeTab), s, m)) return
      // Drop one-shot intents aimed at the hidden tab.
      setJamRoomToJoin(null)
      setPendingDrill(null)
      setAutoStartExercise(false)
      setInitialUvrView(null)
      setInitialUvrSessionId(null)
      // Explain the bounce — but not during startup, where landing on the
      // scope's home tab is the expected behavior, not a surprise.
      if (performance.now() - appMountedAt > 2000) {
        showNotification(
          'That page is hidden by your App Mode settings (Settings → General).',
          'info',
          { channel: 'app-mode-guard' },
        )
      }
      void handleTabChange(scopeHomeTab(s))
    })
  })

  // ── Singing song picker (library melodies + imported MIDI songs) ────
  // Imports go through the same picker flow as Piano/Guitar: a multi-track
  // MIDI opens the track picker, and the CHOSEN track (not a flatten of all
  // tracks — which buried the melody and tanked canvas/audio performance)
  // becomes the practice melody.
  const [singingSong, setSingingSong] = createSignal<SavedMidiSong | null>(null)

  // ── A-B Loop state for Singing tab ──────────────────────────
  // Loop math lives in the framework-free `ab-loop` helpers so the
  // boundary/seek/geometry rules match the canonical stem-mixer loop.
  const [loopEnabled, setLoopEnabled] = createSignal(false)
  const [loopA, setLoopA] = createSignal(0)
  const [loopB, setLoopB] = createSignal(0)
  // Mirrors the stem-mixer's `seekedOutsideLoop`: while true (the user
  // manually seeked outside [A, B)), we stop yanking the playhead back to A
  // until playback re-enters the region.
  const [seekedOutsideLoop, setSeekedOutsideLoop] = createSignal(false)

  // The A-B loop state is shared across tabs, but each tab has its OWN
  // transport: Singing and Compose both drive the shared PlaybackRuntime
  // (currentBeat / totalBeats), while Piano runs on the separate falling-notes
  // controller (playheadBeat / seekToBeat). Route every loop operation — set
  // A/B, clamp, marker-drag, auto-seek-back — through the ACTIVE tab's
  // transport so the loop tracks the playhead the user is actually watching.
  // (Before this, all of them used the singing transport, so Set A/B read a
  // stale singing beat and the loop-back seeked a runtime the Piano tab isn't
  // even using — the loop simply did nothing on Piano.)
  const loopTransport = (): {
    beat: () => number
    total: () => number
    seekTo: (beat: number) => void
  } => {
    if (activeTab() === TAB_PIANO) {
      return {
        beat: fallingNotes.playheadBeat,
        total: fallingNotes.totalBeats,
        seekTo: fallingNotes.seekToBeat,
      }
    }
    return {
      beat: currentBeat,
      total: totalBeats,
      seekTo: (beat: number) => playbackRuntime.seekTo(beat),
    }
  }

  const handleSetLoopA = () => {
    const beat = loopTransport().beat()
    if (beat < 0) return
    setLoopA(Math.max(0, beat))
    // Re-marking A at/after B empties the region — clear B and disable the
    // loop so we don't enforce a backwards/degenerate boundary.
    if (loopB() > 0 && beat >= loopB()) {
      setLoopB(0)
      setLoopEnabled(false)
    }
  }

  const handleSetLoopB = () => {
    const t = loopTransport()
    const beat = clampLoopB(t.beat(), loopA(), t.total())
    if (beat <= loopA()) return
    setLoopB(beat)
    // Setting B arms the loop right away (matches the stem-mixer): playback
    // starts cycling A→B immediately, with no separate "enable loop" click.
    setSeekedOutsideLoop(false)
    setLoopEnabled(true)
  }

  const handleToggleLoop = () => {
    setLoopEnabled((v) => !v)
  }

  const handleClearLoop = () => {
    setLoopEnabled(false)
    setLoopA(0)
    setLoopB(0)
    setSeekedOutsideLoop(false)
  }

  // Dragging the A/B markers on the seek rail — pure bounds adjustment (the
  // toggle still owns enabled). Clamp to the timeline and keep a minimum gap so
  // the region can't collapse or invert. Mirrors the stem-mixer marker drag.
  const LOOP_MIN_GAP_BEATS = 0.25
  const handleMoveLoopA = (beat: number) => {
    const b = loopB()
    const upper = b > 0 ? b - LOOP_MIN_GAP_BEATS : loopTransport().total()
    setLoopA(Math.max(0, Math.min(beat, upper)))
  }
  const handleMoveLoopB = (beat: number) => {
    const lower = loopA() + LOOP_MIN_GAP_BEATS
    setLoopB(Math.min(Math.max(beat, lower), loopTransport().total()))
  }

  // Manual seek from a tab's scrubber/overview: record whether it escaped the
  // loop region so the auto-seek-back below stays suppressed until we're back
  // inside [A, B). (Fixes: a manual seek past B used to be instantly reverted.)
  // Seeks the ACTIVE tab's transport so it works on Singing, Compose and Piano.
  const handleLoopSeek = (beat: number) => {
    setSeekedOutsideLoop(isSeekOutsideLoop(beat, loopA(), loopB()))
    loopTransport().seekTo(beat)
  }

  // Keep the Piano controller's own loop state in sync. Piano wraps B→A INSIDE
  // its RAF loop (atomic with its note scheduler), so it is deliberately NOT
  // driven by the auto-seek-back effect below: an external seek landing
  // mid-frame there rewound the playhead while checkHits() still held the
  // stale past-B beat, replaying the whole [A, B] span at once.
  createEffect(() => {
    fallingNotes.setLoop(loopA(), loopB(), loopEnabled())
  })

  // Auto-seek back to A when the playhead reaches B (loop enabled) — for the
  // shared PlaybackRuntime (Singing + Compose only; Piano loops in-controller).
  // Only fire while short of the track end, so we don't race the runtime's
  // natural-end / complete handling.
  createEffect(() => {
    const t = loopTransport()
    const beat = t.beat()
    // Once playback re-enters [A, B), drop the manual-seek escape flag.
    if (
      seekedOutsideLoop() &&
      loopA() < loopB() &&
      beat >= loopA() &&
      beat < loopB()
    ) {
      setSeekedOutsideLoop(false)
    }
    // Piano's loop wrap is owned by its controller (see setLoop above).
    if (activeTab() === TAB_PIANO) return
    if (
      shouldLoopBack(beat, {
        enabled: loopEnabled(),
        a: loopA(),
        b: loopB(),
        seekedOutside: seekedOutsideLoop(),
      }) &&
      beat < t.total()
    ) {
      // Reset the pitch trail each lap so the green line shows only the current
      // pass, not every overlaid loop iteration.
      setPitchHistory([])
      t.seekTo(loopA())
    }
  })

  // Karaoke backing: the "heard" (non-scored) tracks play as audio while the
  // scored track stays the reference/scored melody.
  const singingBacking = useSingingBacking({
    playbackRuntime,
    audioEngine,
    isPlaying,
    bpm,
  })

  const midiNotesToMelodyItems = (notes: MidiSongNote[]): MelodyItem[] =>
    notes.map((n, i) => {
      const { name, octave } = midiToNote(n.midi)
      return {
        id: i,
        note: { midi: n.midi, name, octave, freq: midiToFreq(n.midi) },
        startBeat: n.startBeat,
        duration: n.duration,
      }
    })

  // Karaoke backing = only the "heard" tracks (song.backingTrackIds). The
  // picker's flattened `backing` param lumps heard + muted tracks together
  // and splits them via a separate mutedIds list, but flattening to
  // MelodyItem[] drops track identity — so derive straight from the song to
  // honour the Hear/mute toggle. (Same derivation as the reload path below.)
  const backingFromSong = (song: SavedMidiSong | null): BackingNote[] =>
    song === null
      ? []
      : song.tracks
          .filter((t) => song.backingTrackIds.includes(t.id))
          .flatMap((t) =>
            t.notes.map((n) => ({
              freq: midiToFreq(n.midi),
              startBeat: n.startBeat,
              duration: n.duration,
            })),
          )

  const handleSingingSongLoaded = (
    items: MelodyItem[],
    name: string,
    songBpm: number,
    song: SavedMidiSong | null,
  ) => {
    // Loading a different song replaces the current one, so stop the run first:
    // while playing/paused the controller holds a *frozen* display melody +
    // length (playbackDisplayMelody/Beats) for the in-progress run and only
    // auto-clears it when stopped — without this, switching songs during/after
    // a loop leaves the previous song frozen on the canvas and timeline.
    // resetPlaybackState is synchronous (clears the display + rewinds to 0).
    void resetPlaybackState()
    // The old A-B loop was set against the previous song's beats — drop it.
    handleClearLoop()
    setSingingSong(song)
    singingBacking.setBacking(backingFromSong(song))
    // A pending stopped-state seek belongs to the previous song.
    playbackRuntime.clearPendingStart()
    const existing = melodyStore.getAllMelodies().find((m) => m.name === name)
    if (song === null && existing) {
      // Library melody picked from the modal — just make it current.
      melodyStore.setCurrentMelody(existing)
      return
    }
    // Imported MIDI song: upsert a library melody named after it so the
    // singing pipeline (and the sidebar library) can see it.
    const target = existing ?? melodyStore.createNewMelody(name)
    const updated = melodyStore.updateMelody(target.id, {
      items,
      bpm: songBpm,
    })
    if (updated) melodyStore.setCurrentMelody(updated)
    showNotification(`Loaded "${name}" (${items.length} notes)`, 'success')
  }

  const singingPicker = useMidiSongPicker<MelodyItem>({
    currentSong: singingSong,
    fromMelodyItems: (items) => items,
    fromScoreNotes: midiNotesToMelodyItems,
    // Heard tracks become karaoke backing audio (played, not scored).
    fromBackingNotes: (notes) => midiNotesToMelodyItems(notes),
    onSongLoaded: (items, name, songBpm, _backing, _muted, song) =>
      handleSingingSongLoaded(items, name, songBpm, song),
    // The singing page always has a current melody — never clobber it with
    // the picker's first-melody auto-load on mount.
    skipAutoLoad: () => true,
  })

  const singingDropZone = useFileDropZone({
    accept: /\.(mid|midi)$/i,
    onFiles: (files) => void singingPicker.importMidiFile(files[0]),
    onRejected: () =>
      showNotification(
        'Drop a .mid or .midi file to load it as a melody.',
        'info',
      ),
  })

  // Restore the imported song behind the current melody on reload. Melodies
  // persist (melody store), but singingSong is a fresh signal each load, so
  // the Track button vanished after a refresh. Imports are stored as a saved
  // MIDI song named after the melody — match by name to bring it back.
  onMount(() => {
    if (singingSong() !== null) return
    const name = melodyStore.currentMelody()?.name
    if (name === undefined || name === '') return
    const match = savedMidiSongs().find((s) => s.name === name)
    if (match && match.tracks.length > 0) {
      setSingingSong(match)
      // Rehydrate the karaoke backing from the song's heard tracks so it
      // plays after a reload, not just right after import.
      singingBacking.setBacking(backingFromSong(match))
    }
  })

  // ── Mic handler ────────────────────────────────────────────
  const handleMicToggle = async () => {
    if (micActive()) {
      practiceEngine.stopMic()
    } else {
      await practiceEngine.startMic()
    }
  }

  // Welcome overlay "Enable Mic": enable-only (never toggles an active mic
  // off), and surface denial — startMic() swallows getUserMedia errors and
  // returns false, so without this check the welcome screen would show its
  // "Mic enabled" chip even when permission was refused.
  const handleWelcomeEnableMic = async () => {
    if (micActive()) return
    const ok = await practiceEngine.startMic()
    if (!ok) throw new Error('Microphone permission denied')
  }

  // Nudge once if singing playback starts while the mic is off.
  usePlaybackMicNudge({
    isPlaying,
    micActive,
    isRelevantTab: () => activeTab() === TAB_SINGING,
    onEnableMic: () => void handleMicToggle(),
  })

  // Each singing playback start counts as real app usage (gates the survey).
  // Edge-triggered via on(): the effect must depend only on the playing
  // signal, never on anything recordActivity() touches.
  createEffect(
    on(isPlaying, (playing) => {
      if (playing) recordActivity()
    }),
  )

  // Offer a page's spotlight tour the first time it's visited.
  usePageTourOffer(activeTab)

  // Live mic insights → inline "can't hear you" / "too quiet" hints (Singing).
  const micInsights = useMicInsights({
    enabled: () => activeTab() === TAB_SINGING,
    micActive,
    isPlaying,
    getLevel: () => practiceEngine.getInputLevel(),
    isDetecting: () => (currentPitch()?.frequency ?? 0) > 0,
  })

  // Sidebar "Auto-calibrate": ensure the mic is on, then sample the room.
  const handleAutoCalibrate = async () => {
    if (!micActive()) {
      const ok = await practiceEngine.startMic()
      if (!ok) {
        showNotification('Enable your mic to auto-calibrate.', 'warning')
        return
      }
    }
    await autoCalibrateSensitivity(() => practiceEngine.getInputLevel())
  }

  // ── Octave shift ──────────────────────────────────────────
  const handleOctaveShift = (delta: number) => {
    const newOctave = melodyStore.getCurrentOctave() + delta
    if (newOctave < 1) return

    const keyName = keyNameSignal()
    const scaleType = scaleTypeSignal()

    // Check if we have notes that can be transposed
    if (melodyStore.items().length > 0) {
      // Transpose all notes by the octave delta
      const MIDI_OCTAVE_SHIFT = 12
      const transposed = melodyStore.items().map((item) => ({
        ...item,
        note: {
          ...item.note,
          midi: item.note.midi + delta * MIDI_OCTAVE_SHIFT,
          octave: item.note.octave + delta,
          freq:
            440 *
            Math.pow(2, (item.note.midi + delta * MIDI_OCTAVE_SHIFT - 69) / 12),
        },
      }))
      melodyStore.setMelody(transposed)
    }

    // Rebuild scale with new octave
    melodyStore.refreshScale(keyName, newOctave, scaleType)
  }

  // ── Target note for pitch display ──────────────────────────
  const targetNote = createMemo(() => {
    const idx = currentNoteIndex()
    const items = melodyStore.items()
    if (idx < 0 || idx >= items.length) return null
    return items[idx].note
  })

  const targetNoteName = createMemo(() => {
    const note = targetNote()
    if (note === null) return null
    return note.name + note.octave
  })

  // ── Accuracy heatmap ───────────────────────────────────────
  const noteAccuracyMap = createMemo(() => {
    void getSessionHistory().length
    return getNoteAccuracyMap() as Map<number, number>
  })

  const scoreGrade = createMemo(() => {
    const pr = practiceResult()
    if (!pr) return ''
    if (pr.score >= 90) return 'grade-perfect'
    if (pr.score >= 80) return 'grade-excellent'
    if (pr.score >= 65) return 'grade-good'
    if (pr.score >= 50) return 'grade-okay'
    return 'grade-needs-work'
  })

  const scoreLabel = createMemo(() => {
    const pr = practiceResult()
    if (!pr) return ''
    if (pr.score >= 90) return 'Pitch Perfect!'
    if (pr.score >= 80) return 'Excellent!'
    if (pr.score >= 65) return 'Good!'
    if (pr.score >= 50) return 'Okay!'
    return 'Needs Work'
  })

  const closeScoreOverlay = () => {
    setPracticeResult(null)
    setLiveScore(null)
  }

  const handleReset = () => {
    void resetPlaybackState()
  }

  const handlePracticePlay = () => {
    // Fresh user-triggered Play should always begin Repeat mode at
    // cycle 1/N. Otherwise after a completed N/N run, the next run
    // starts with currentRepeat still at N and stops after one pass.
    if (isPaused() === false) {
      setCurrentRepeat(1)
    }

    // handlePlay() correctly branches internally based on playMode() === 'practice'.
    handlePlay()
  }

  const handlePracticeModeChange = (mode: PlaybackMode) => {
    setPlayMode(mode)
    if (mode === PLAYBACK_MODE_REPEAT) {
      setCurrentRepeat(1)
    }
  }

  const handlePlayMelodyFromModal = (_melody: unknown) => {
    // Delegated to LibraryModal's own internal handlers.
  }

  // ── PlaybackRuntime event subscriptions specific to App ─────
  // Note: count-in events handled inside usePracticeController.
  // Sequencing events:
  const setupRuntimeEvents = () => {
    playbackRuntime.on('noteStart', (e) => {
      const { note: item, index } = e
      melodyStore.setCurrentNoteIndex(index)

      // Suppress audio for rest items. Session rests reuse the runtime
      // (so the playhead can advance visibly across the rest bar),
      // which means PlaybackRuntime emits noteStart for the synthetic
      // rest MelodyItem. Without this guard the placeholder note would
      // play at full volume during what's supposed to be silent.
      // Spaced-rest items take the same path and benefit from the same
      // guard. We also avoid passing rests to the practiceEngine.
      const isRestItem = item.isRest === true

      if (!isRestItem) {
        setTargetPitch(item.note.freq)
        if (activeTab() === TAB_SINGING) {
          practiceEngine.onNoteStart(item.note, index)
        }
      } else {
        setTargetPitch(null)
      }

      if (isRestItem) return

      if (
        !recording.isRecording() &&
        (isPlaying() || editorPlaybackState() === 'playing')
      ) {
        const beatDurationMs = 60000 / bpm()
        const noteDurationMs = item.duration * beatDurationMs

        let targetFreq: number | undefined
        if (item.effectType) {
          if (item.slideInterval !== undefined) {
            targetFreq = item.note.freq * Math.pow(2, item.slideInterval / 12)
          } else if (
            item.effectType === 'trill' &&
            item.trillInterval !== undefined
          ) {
            targetFreq = item.note.freq * Math.pow(2, item.trillInterval / 12)
          }
        }

        const chordIntervals =
          item.effectType === 'chord' && item.chordType
            ? CHORD_INTERVALS[item.chordType]
            : undefined

        audioEngine
          .playNote(
            item.note.freq,
            noteDurationMs,
            item.effectType,
            targetFreq,
            item.vibratoAmplitude,
            item.tremoloRate,
            item.tremoloDepth,
            item.trillInterval,
            item.trillRate,
            item.staccatoRatio,
            chordIntervals,
          )
          .then((noteId) => {
            if (noteId !== undefined) {
              activeNoteIds.set(index, noteId)
            }
          })
      }
    })

    playbackRuntime.on('noteEnd', (e) => {
      const { index } = e
      const noteId = activeNoteIds.get(index)
      if (noteId !== undefined) {
        audioEngine.stopNote(noteId)
        activeNoteIds.delete(index)
      }
      // If this was the last active note, clear target pitch
      if (activeNoteIndices().size === 0) {
        setTargetPitch(null)
      }
    })

    playbackRuntime.on('beat', (e: { beat?: number }) => {
      const beat = e.beat ?? 0
      const indices = melodyIndicesAtBeat(activePlaybackItems(), beat)
      melodyStore.setCurrentNoteIndex(indices.length > 0 ? indices[0] : -1)
    })

    playbackRuntime.setMetronomeEnabled(metronomeEnabled)

    playbackRuntime.on(
      'metronome',
      // eslint-disable-next-line solid/reactivity
      (e: { beat?: number; isDownbeat?: boolean; isCountIn?: boolean }) => {
        if (e.isCountIn === true || metronomeEnabled() === true) {
          audioEngine.playMetronomeClick(e?.isDownbeat ?? false)
        }
      },
    )

    // eslint-disable-next-line solid/reactivity
    playbackRuntime.on('complete', () => {
      practiceEngine.onPlaybackComplete()
      const mode = playMode()

      const ids = sessionMelodyIds()
      if (ids.length > 0 && sessionCurrentMelodyIndex() >= 0) {
        playNextInSessionSequence()
        return
      }

      const sessionModeValue = sessionMode()
      if (sessionModeValue === true && mode === PLAYBACK_MODE_SESSION) {
        handleSessionItemComplete()
        return
      }

      if (mode === PLAYBACK_MODE_REPEAT) {
        handleRepeatModeComplete()
        return
      }

      // Once mode → stop. handleStop is async (waits for audio teardown
      // before resolving) — `void` here to satisfy no-floating-promises.
      void handleStop()
    })
  }

  onMount(() => {
    initTheme()
    initDefaultOGTags()

    // Blur a <select> after a pointer pick so Spacebar hits the global
    // play/pause shortcut instead of re-opening the focused dropdown
    // (guitar key/scale/mode/chord, drum-machine preset, and any other).
    onCleanup(installSelectBlurOnPointerChange())

    // Cloud settings sync: pull on startup/auth change, write-through
    // on preference changes. Inert when no API is configured.
    initSettingsSync()

    // Surface the outcome of a Google sign-in redirect (token handling
    // itself ran in index.tsx before render). App-level so the toast
    // shows no matter which route the user signed in from.
    const googleRedirect = takeGoogleRedirectResult()
    if (googleRedirect != null) {
      if (googleRedirect.ok) {
        showNotification('Signed in with Google', 'info')
      } else {
        showNotification(
          `Google sign-in failed: ${googleRedirect.error}`,
          'error',
        )
      }
    }

    // Load UVR sessions and groups from IndexedDB into the in-memory cache.
    // Fire-and-forget: the cache starts empty and populates async.
    void initSessionStore()
    void initGroupStore()
    void initKaraokePlaylistStore()

    createEffect(() => {
      const font = fontFamily()
      const root = document.documentElement
      if (font === 'inter') {
        root.style.setProperty(
          '--app-font',
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        )
      } else if (font === 'outfit') {
        root.style.setProperty(
          '--app-font',
          "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        )
      } else if (font === 'plus-jakarta-sans') {
        root.style.setProperty(
          '--app-font',
          "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        )
      } else {
        root.style.setProperty(
          '--app-font',
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        )
      }
    })

    // Inject UVR component styles
    const styleElements = [LyricsUploaderStyles, StemMixerStyles]

    styleElements.forEach((styleString) => {
      if (typeof styleString === 'string' && styleString.trim()) {
        const style = document.createElement('style')
        style.textContent = styleString
        document.head.appendChild(style)
      }
    })

    melodyStore.seedDefaultSession()

    // Build melody fingerprint index for Shazam Sing matching
    const fpResult = buildFingerprintIndex()
    if (fpResult.errors.length > 0) {
      console.warn(
        '[shazam] fingerprint build warnings:',
        fpResult.errors.map((e) => `${e.name}: ${e.reason}`).join(', '),
      )
    }

    // Load persisted stem fingerprints from IndexedDB
    void loadStemFingerprints().then((count) => {
      if (count > 0) {
        console.log(`[shazam] loaded ${count} stem fingerprint(s)`)
      }
    })

    // Initialize active user session from saved default
    const activeSessionId = melodyStore.getActiveSessionId()
    if (activeSessionId === null) {
      const defaultSession = getSession('default')
      if (defaultSession !== undefined) {
        setActiveUserSession(defaultSession)
        melodyStore.setActiveSessionId(defaultSession.id)
      }
    } else {
      const activeSession = getSession(activeSessionId)
      if (activeSession !== undefined) {
        setActiveUserSession(activeSession)
      }
    }

    // Always register the bridge — production code (e.g. LibraryTab Play All)
    // currently relies on `__loadAndPlayMelodyForSession` and `__playSessionSequence`
    // being available. The bridge itself is gated by build mode internally.
    registerE2EBridge({
      appStore,
      melodyStore,
      playbackRuntime,
      audioEngine,
      loadAndPlayMelodyForSession,
      playSessionSequence,
      setPlayMode,
    })

    // Shared preset URL
    if (typeof hasSharedPresetInURL === 'function' && hasSharedPresetInURL()) {
      const sharedData = loadFromURL() as {
        melody: MelodyItem[]
        bpm?: number
        key?: string
        scaleType?: string
        totalBeats?: number
      } | null
      if (sharedData !== null) {
        melodyStore.setMelody(sharedData.melody)
        if (sharedData.bpm !== undefined && sharedData.bpm !== 0) {
          setBpm(sharedData.bpm)
        }
        if (sharedData.key !== undefined && sharedData.key !== '') {
          setKeyName(sharedData.key)
        }
        if (sharedData.scaleType !== undefined && sharedData.scaleType !== '') {
          setScaleType(sharedData.scaleType)
        }
        showNotification('Shared preset loaded from URL', 'info')
        setMelodyOGTags({
          noteCount: sharedData.melody.length,
          bpm: sharedData.bpm,
          key: sharedData.key,
        })
      }
    }

    // Marketing exercise deep-links: /exercises/<slug> (see slug-map.ts). The
    // worker serves index.html for these paths (not_found_handling =
    // single-page-application), so the slug arrives here on a fresh load.
    // Runs after seedDefaultSession() above so scaleId-based slugs resolve.
    const slugMatch = window.location.pathname.match(EXERCISE_SLUG_PATH)
    if (slugMatch) {
      applyExerciseSlug(slugMatch[1])
      // Clean the deep path so a reload/share doesn't re-trigger the launch;
      // the hash router takes over the URL (e.g. #/exercises) from here.
      history.replaceState(null, '', '/')
    }

    // Saved volume
    const vol = parseInt(storageGet('pp_volume', '80')!, 10)
    setSavedVol(isNaN(vol) ? 80 : vol)

    // Wire runtime events
    setupRuntimeEvents()

    // Accumulate foreground usage time (gates the onboarding survey).
    startUsageTracking()

    props.onMounted?.()
  })

  // The onboarding survey is shown on real deployments only — never on the
  // local dev server or in E2E (both run on localhost), so it can't block
  // dev work or tests. A dev can force it locally by setting localStorage
  // 'pitchperfect_survey_force' = '1'.
  const surveyEnabledHere = (): boolean => {
    if (typeof window === 'undefined') return false
    try {
      if (localStorage.getItem('pitchperfect_survey_force') === '1') return true
    } catch {
      /* localStorage unavailable — treat as not forced */
    }
    const host = window.location.hostname
    return host !== 'localhost' && host !== '127.0.0.1' && host !== ''
  }

  // True while any guide/tour surface is up: the guide-section dialog, the
  // spotlight walkthrough, or the Learn chapter modals. The survey must never
  // pop over these (it used to occlude a tour started from the welcome screen).
  const tourSurfaceOpen = () =>
    showGuideSelection() ||
    walkthroughActive() ||
    showSelection() ||
    walkthroughModalOpen()

  // Don't ask for feedback the moment a first-time visitor closes the welcome
  // screen: wait until they have genuinely used the app — enough cumulative
  // foreground time AND at least one real action (playback run, exercise or
  // practice session finished) — so they have something to say.
  const SURVEY_MIN_USAGE_MS = 12 * 60_000
  const surveyUsageGateMet = () => {
    try {
      // The dev force flag skips the usage gate along with the host gate.
      if (localStorage.getItem('pitchperfect_survey_force') === '1') return true
    } catch {
      /* localStorage unavailable — fall through to the usage signals */
    }
    return usageMs() >= SURVEY_MIN_USAGE_MS && activityCount() > 0
  }

  // Show optional survey after welcome screen is dismissed (once per browser,
  // tracked via the persisted surveySeen flag — same as the welcome screen).
  createEffect(() => {
    if (showWelcome() || surveyChecked()) return
    // Defer while a tour surface is open — the effect re-runs when it closes,
    // so the survey is postponed until after the tour, not lost.
    if (tourSurfaceOpen()) return
    // Defer until real usage: both signals are reactive, so the effect
    // re-runs as time accrues / activity lands and the survey shows then.
    if (!surveyUsageGateMet()) return
    setSurveyChecked(true)
    if (!surveyEnabledHere() || surveySeen()) return
    // The survey persists to the cloud, so only prompt signed-in users —
    // a signed-out submit hits the user-scoped write guard and fails. (On
    // deployed builds where the survey shows, a fresh visitor is signed in
    // anonymously at startup; an upgraded-then-signed-out device is not.)
    if (!hasValidToken()) return
    void import('@/db/services/survey-service').then(({ hasSubmittedSurvey }) =>
      // Show-time snapshot reads by design: the re-arm below re-runs the
      // effect when the tour surfaces close, so tracking isn't needed here.
      // eslint-disable-next-line solid/reactivity
      hasSubmittedSurvey().then((already) => {
        if (already) return
        // Re-check at show time: effects run synchronously on signal writes,
        // so "Take a Tour" dismisses the welcome (running this effect) a tick
        // before the guide dialog opens — and the async check above widens
        // the window further. Re-arm instead of showing over a tour.
        if (tourSurfaceOpen()) {
          setSurveyChecked(false)
          return
        }
        setShowSurvey(true)
      }),
    )
  })

  // Hash routing: state → URL syncing is handled by useHashRouter above

  // ============================================================
  // Render
  // ============================================================

  return (
    <PlaybackProvider
      playSessionSequence={playSessionSequence}
      loadAndPlayMelodyForSession={loadAndPlayMelodyForSession}
    >
      <div id="app" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <a class="skip-link" href="#main-content">
          Skip to main content
        </a>
        {/* Welcome Screen (shown on first visit) */}
        <Show when={showWelcome()}>
          <WelcomeScreen
            onTakeTour={openGuideSelection}
            onEnableMic={handleWelcomeEnableMic}
          />
        </Show>

        {/* Guide Selection dialog */}
        <GuideSelection
          isOpen={showGuideSelection()}
          onClose={closeGuideSelection}
          onStartTour={startGuideTour}
        />

        {/* Guide Tour — Interactive spotlight overlay */}
        <Walkthrough />

        <Show when={sidebarOpen() === true}>
          <div class="sidebar-backdrop" onClick={closeSidebar} />
        </Show>

        <Show when={!focusMode()}>
          <header>
            <div class="header-left">
              <button
                class="sidebar-toggle-btn"
                onClick={toggleSidebar}
                title="Menu"
                aria-label="Menu"
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path
                    fill="currentColor"
                    d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"
                  />
                </svg>
              </button>
              <button
                id="app-title"
                class="logo-btn"
                onClick={() => void handleTabChange(TAB_SINGING)}
                title="Go to Practice"
                aria-label="MercuryPitch — Go to Practice"
              >
                <span class="app-title" role="heading" aria-level="1">
                  MercuryPitch
                </span>
              </button>
              <Show
                when={headerPracticeContext()}
                fallback={<p class="subtitle">Voice Pitch Practice</p>}
                keyed
              >
                {/* Dynamic practice context — each tab's loaded song (plus the
                    guide character on Singing). Own class (not .subtitle) so it
                    stays visible on mobile. */}
                {(ctx) => (
                  <div
                    class="header-melody-context"
                    title={
                      ctx.character != null
                        ? `Now loaded: ${ctx.name} · ${ctx.character}`
                        : `Now loaded: ${ctx.name}`
                    }
                  >
                    <Show
                      when={ctx.tab === TAB_SINGING}
                      fallback={
                        ctx.tab === TAB_PIANO ? <PianoGlyph /> : <GuitarGlyph />
                      }
                    >
                      <img
                        class="header-melody-avatar"
                        src={ctx.avatar}
                        alt=""
                        aria-hidden="true"
                      />
                    </Show>
                    <span class="header-melody-name">{ctx.name}</span>
                    <Show when={ctx.character != null}>
                      <span class="header-melody-char">{ctx.character}</span>
                    </Show>
                  </div>
                )}
              </Show>
            </div>
            <div class="header-right">
              {/* Current melody indicator pill */}

              {/* Walkthrough Control Button */}
              <WalkthroughControl
                showOnStart={false}
                onOpenGuide={openGuideSelection}
              />
            </div>
            <AppNavTabs
              activeTab={activeTab}
              handleTabChange={(tab) => {
                handleTabChange(tab)
              }}
              tabLabel={tabLabel}
              advancedFeaturesEnabled={advancedFeaturesEnabled}
            />

            {/* Version + support (Ko-fi) double-pill, pinned to the far
                right of the header row (after the nav tabs) */}
            <div class="header-support">
              <HeaderAccount />
              <SupportBadge />
            </div>
          </header>

          {/* Main layout: sidebar + content */}
          <div class={styles.mainLayout} id="main-layout">
            {/* Shared sidebar — with mobile open class */}
            <AppSidebar
              class={sidebarOpen() === true ? 'open' : ''}
              onPresetLoad={(_name) => {
                // Presets now handled by melodyStore/LibraryModal
              }}
              onOctaveShift={handleOctaveShift}
              onOpenScaleBuilder={() => setShowScaleBuilder(true)}
              onOpenLearn={openLearningWalkthrough}
              onOpenGuide={openGuideSelection}
              melody={() => melodyStore.items()}
              currentNoteIndex={currentNoteIndex}
              noteResults={noteResults}
              isPlaying={isPlaying}
              pitch={currentPitch}
              targetNoteName={targetNoteName}
              onClose={closeSidebar}
              collapsed={sidebarCollapsed()}
              onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
              onAutoCalibrate={handleAutoCalibrate}
            />

            {/* Tab content */}
            <main class="main-content" id="main-content" tabindex="-1">
              <Show when={activeTab() === TAB_SINGING}>
                <TabErrorBoundary tabName={tabLabel(TAB_SINGING)}>
                  {/* Practice panel */}
                  <div id="practice-panel">
                    {/* The status bar sits in flow above the canvas (it also
                        carries the live session/playback state that the old
                        green SessionPlayer banner showed here). */}
                    <div style={{ position: 'relative' }}>
                      <SingingStatusBar
                        keyName={keyNameSignal}
                        scaleType={scaleTypeSignal}
                        melodyName={() =>
                          melodyStore.currentMelody()?.name ?? null
                        }
                        bpm={bpm}
                        currentBeat={currentBeat}
                        isPlaying={isPlaying}
                        picker={singingPicker}
                        currentSong={singingSong}
                        playheadBeat={currentBeat}
                        totalBeats={totalBeats}
                        onSeek={handleLoopSeek}
                        onSessionSkip={handleSessionSkip}
                        onSessionEnd={handleSessionEnd}
                        loopA={loopA}
                        loopB={loopB}
                        loopEnabled={loopEnabled}
                        onMoveLoopA={handleMoveLoopA}
                        onMoveLoopB={handleMoveLoopB}
                      />
                    </div>

                    <div id="canvas-container" ref={singingDropZone.bind}>
                      {/* Below the top-docked control bar, in the empty band
                          above the notes — matches the Piano/Guitar hint
                          placement. Centring it on the status bar occluded
                          the song timeline. */}
                      <MicInsightHint
                        message={micInsights.message}
                        insight={micInsights.insight}
                        style={{
                          position: 'absolute',
                          top: '68px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          'z-index': '6',
                          'white-space': 'nowrap',
                        }}
                      />
                      <PitchCanvas
                        melody={activePlaybackItems}
                        scale={() => melodyStore.currentScale()}
                        totalBeats={totalBeats}
                        currentBeat={currentBeat}
                        pitchHistory={pitchHistory}
                        currentNoteIndex={currentNoteIndex}
                        activeNoteIndices={activeNoteIndices}
                        isPlaying={isPlaying}
                        isPaused={isPaused}
                        isScrolling={() => true}
                        targetPitch={targetPitch}
                        targetPitches={targetPitches}
                        livePitch={currentPitch}
                        noteAccuracyMap={noteAccuracyMap}
                        isRecording={recording.isRecording}
                        getWaveform={() =>
                          audioEngine?.getWaveformData() ?? null
                        }
                        noteResults={noteResults}
                        countInBeats={() => countIn()}
                        loopA={loopA}
                        loopB={loopB}
                        loopEnabled={loopEnabled}
                        onMoveLoopA={handleMoveLoopA}
                        onMoveLoopB={handleMoveLoopB}
                      />
                      <SingingCanvasHud
                        noteResults={noteResults}
                        pitch={currentPitch}
                        targetNoteName={targetNoteName}
                        liveScore={liveScore}
                        isPlaying={isPlaying}
                      />
                      <Show when={singingDropZone.isDragOver()}>
                        <div class={statusBarStyles.dropOverlay}>
                          <span class={statusBarStyles.dropLabel}>
                            Drop MIDI to load as melody
                          </span>
                        </div>
                      </Show>
                      <ControlOverlay defaultDock="top">
                        <SingingControlBar
                          isPlaying={isPlaying}
                          isPaused={isPaused}
                          onPlay={handlePracticePlay}
                          onPause={handlePause}
                          onResume={handleResume}
                          onStop={() => void handleStop()}
                          volume={savedVol}
                          onVolumeChange={(vol) => {
                            setSavedVol(vol)
                            audioEngine?.setVolume(vol / 100)
                          }}
                          speed={playbackSpeed()}
                          onSpeedChange={setPlaybackSpeed}
                          metronomeEnabled={() => metronomeEnabled()}
                          onMetronomeToggle={() =>
                            setMetronomeEnabled(metronomeEnabled() === false)
                          }
                          playMode={() => playMode()}
                          playModeChange={handlePracticeModeChange}
                          practiceCycles={() => repeatCycles()}
                          onCyclesChange={setRepeatCycles}
                          currentCycle={() => currentRepeat()}
                          practiceSubMode={() => practiceSubMode()}
                          onPracticeSubModeChange={setPracticeSubMode}
                          spacedRestMode={spacedRestMode}
                          onSpacedRestModeChange={setSpacedRestMode}
                          isCountingIn={() => isCountingIn()}
                          countInBeat={() => countInBeat()}
                          onMicToggle={() => {
                            void handleMicToggle()
                          }}
                          loopEnabled={loopEnabled}
                          loopA={loopA}
                          loopB={loopB}
                          onSetLoopA={handleSetLoopA}
                          onSetLoopB={handleSetLoopB}
                          onToggleLoop={handleToggleLoop}
                          onClearLoop={handleClearLoop}
                        />
                      </ControlOverlay>
                    </div>

                    <PitchAccuracyHeatmap
                      scale={() => melodyStore.currentScale()}
                      onSeekNote={(midi, _name) => {
                        const items = melodyStore.items()
                        const idx = items.findIndex(
                          (item) => item.note.midi === midi,
                        )
                        if (idx >= 0) {
                          playbackRuntime.seekTo(items[idx].startBeat)
                        }
                      }}
                    />

                    <Show when={showHistoryPanel()}>
                      <div id="history-container">
                        <HistoryCanvas
                          frequencyData={frequencyData}
                          waveformData={waveformData}
                          liveScore={liveScore}
                        />
                      </div>
                    </Show>
                  </div>
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_COMPOSE}>
                <TabErrorBoundary tabName={tabLabel(TAB_COMPOSE)}>
                  <div class={styles.composeToolbarOuter}>
                    <div class={styles.composeToolbar}>
                      <div
                        class={styles.editorTabs}
                        role="tablist"
                        aria-label="Editor view"
                        data-tour="compose.editor"
                      >
                        <button
                          type="button"
                          role="tab"
                          class={styles.editorTab}
                          classList={{
                            [styles.editorTabActive]:
                              editorView() === 'piano-roll',
                          }}
                          aria-selected={editorView() === 'piano-roll'}
                          onClick={() => setEditorView('piano-roll')}
                          title="Piano Roll"
                        >
                          <MusicBoard /> Piano Roll
                        </button>
                        <button
                          type="button"
                          role="tab"
                          class={styles.editorTab}
                          classList={{
                            [styles.editorTabActive]:
                              editorView() === 'session-editor',
                          }}
                          aria-selected={editorView() === 'session-editor'}
                          data-testid="view-session-editor"
                          onClick={() => setEditorView('session-editor')}
                          title="Session Editor"
                        >
                          <SlidersHorizontal /> Session Editor
                        </button>
                      </div>

                      <ControlOverlay static inline idPrefix="compose">
                        <ComposeControlBar
                          isPlaying={editorIsPlaying}
                          isPaused={editorIsPaused}
                          onPlay={() => void handleEditorPlay()}
                          onPause={handleEditorPause}
                          onResume={handleEditorResume}
                          onStop={handleEditorStop}
                          volume={savedVol}
                          onVolumeChange={(vol) => {
                            setSavedVol(vol)
                            audioEngine?.setVolume(vol / 100)
                          }}
                          speed={playbackSpeed}
                          onSpeedChange={setPlaybackSpeed}
                          metronomeEnabled={() => metronomeEnabled()}
                          onMetronomeToggle={() =>
                            setMetronomeEnabled(metronomeEnabled() === false)
                          }
                          isRecording={() => recording.isRecording()}
                          onRecordToggle={() => {
                            // Stopping a take routes through the full editor
                            // stop so playback halts (open-ended mode is
                            // cleared) and the recording is finalized; starting
                            // just arms the mic.
                            if (recording.isRecording()) {
                              handleEditorStop()
                            } else {
                              void recording.handleRecordToggle()
                            }
                          }}
                          onShareMelody={handleCopyShareLink}
                          onMicToggle={() => {
                            void handleMicToggle()
                          }}
                          loopEnabled={loopEnabled}
                          loopA={loopA}
                          loopB={loopB}
                          onSetLoopA={handleSetLoopA}
                          onSetLoopB={handleSetLoopB}
                          onToggleLoop={handleToggleLoop}
                          onClearLoop={handleClearLoop}
                        />
                      </ControlOverlay>
                    </div>
                  </div>

                  <Show when={editorView() === 'session-editor'}>
                    <div class={styles.sessionEditorContainer}>
                      <Suspense fallback={<SkeletonTabContent />}>
                        <SessionEditor />
                      </Suspense>
                    </div>
                  </Show>

                  {/* Editor playhead is rendered by the piano-roll itself
                  on its internal ruler/grid canvases via
                  drawRulerWithPlayhead / drawGridWithPlayhead.  See
                  PianoRollCanvas + PianoRollEditor.setRemoteBeat. */}
                  <Show when={editorView() === 'piano-roll'}>
                    <div style={{ position: 'relative' }}>
                      <Show when={recording.pendingTake() !== null}>
                        <ComposeTakeReview
                          amount={reviewAmount}
                          onAmount={setReviewAmount}
                          noteCount={() => reviewMelody().length}
                          onCommit={commitTake}
                          onDiscard={recording.discardTake}
                        />
                      </Show>
                      <PianoRollCanvas
                        melody={() => melodyStore.items()}
                        previewMelody={previewMelody}
                        liveMidi={recording.liveMidi}
                        isRecording={recording.isRecording}
                        onEditorReady={setEditorApi}
                        scale={() => melodyStore.currentScale()}
                        bpm={() => bpm()}
                        totalBeats={composeTotalBeats}
                        playbackState={editorPlaybackState}
                        currentNoteIndex={() => melodyStore.currentNoteIndex()}
                        currentBeat={currentBeat}
                        countInBeats={() => countIn()}
                        loopA={loopA}
                        loopB={loopB}
                        loopEnabled={loopEnabled}
                        onMoveLoopA={handleMoveLoopA}
                        onMoveLoopB={handleMoveLoopB}
                        isPlaying={editorIsPlaying}
                        isPaused={editorIsPaused}
                        isScrolling={() => false}
                        targetPitch={() => null}
                        noteAccuracyMap={() => new Map()}
                        onMelodyChange={(melody) => {
                          debouncedAutoSave()
                          melodyStore.setMelody(melody)
                        }}
                        onInstrumentChange={(instrument) => {
                          // Update three things at once:
                          //   1. App's primary AudioEngine (used during practice
                          //      playback).
                          //   2. The piano-roll's secondary AudioEngine (used
                          //      for in-editor preview clicks). Without this
                          //      fanout via the audioRegistry, changing the
                          //      instrument dropdown wouldn't audibly affect
                          //      the editor's playback because the secondary
                          //      engine kept its default 'sine' instrument.
                          //   3. The global `instrument` signal so EngineContext's
                          //      reactive createEffect can re-sync any future
                          //      engine that's registered later.
                          audioEngine.setInstrument(
                            instrument as InstrumentType,
                          )
                          audioRegistry.setInstrumentAll(
                            instrument as InstrumentType,
                          )
                          setInstrument(instrument as InstrumentType)
                        }}
                        onPlaybackStateChange={(_state) => {
                          // editor playback state owned by playbackController now
                        }}
                        getWaveform={() =>
                          audioEngine?.getWaveformData() ?? null
                        }
                      />
                    </div>
                  </Show>
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_ANALYSIS}>
                <TabErrorBoundary tabName={tabLabel(TAB_ANALYSIS)}>
                  <AnalysisPage />
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_JAM}>
                <TabErrorBoundary tabName={tabLabel(TAB_JAM)}>
                  <JamPage />
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_COMMUNITY}>
                <TabErrorBoundary tabName={tabLabel(TAB_COMMUNITY)}>
                  <CommunityPage />
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_LEADERBOARD}>
                <TabErrorBoundary tabName={tabLabel(TAB_LEADERBOARD)}>
                  <LeaderboardPage />
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_CHALLENGES}>
                <TabErrorBoundary tabName={tabLabel(TAB_CHALLENGES)}>
                  <ChallengesPage />
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_EXERCISES}>
                <TabErrorBoundary tabName={tabLabel(TAB_EXERCISES)}>
                  <ExercisesPage
                    selectedExercise={selectedExercise}
                    autoStartExercise={autoStartExercise}
                    onSelect={setSelectedExercise}
                    onQuickStart={handleQuickStart}
                    onBack={clearExercise}
                  />
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_SETTINGS}>
                <TabErrorBoundary tabName={tabLabel(TAB_SETTINGS)}>
                  <SettingsPage />
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_KARAOKE}>
                <TabErrorBoundary tabName={tabLabel(TAB_KARAOKE)}>
                  <KaraokePage
                    initialView={initialUvrView}
                    initialSessionId={initialUvrSessionId}
                    onSessionChange={setActiveUvrSessionId}
                    onViewChange={setActiveUvrView}
                  />
                </TabErrorBoundary>
              </Show>
              <Show when={activeTab() === TAB_PIANO}>
                <TabErrorBoundary tabName={tabLabel(TAB_PIANO)}>
                  <PianoPage
                    fallingNotes={fallingNotes}
                    isPlaying={pianoIsPlaying}
                    isPaused={pianoIsPaused}
                    volume={savedVol}
                    onVolumeChange={(vol) => {
                      setSavedVol(vol)
                      audioEngine?.setVolume(vol / 100)
                    }}
                    loopEnabled={loopEnabled}
                    loopA={loopA}
                    loopB={loopB}
                    onSetLoopA={handleSetLoopA}
                    onSetLoopB={handleSetLoopB}
                    onToggleLoop={handleToggleLoop}
                    onClearLoop={handleClearLoop}
                    onMoveLoopA={handleMoveLoopA}
                    onMoveLoopB={handleMoveLoopB}
                    onSeek={handleLoopSeek}
                  />
                </TabErrorBoundary>
              </Show>
              <Show when={activeTab() === TAB_GUITAR}>
                <TabErrorBoundary tabName={tabLabel(TAB_GUITAR)}>
                  <GuitarPage volume={savedVol} setVolume={setSavedVol} />
                </TabErrorBoundary>
              </Show>
            </main>
          </div>
        </Show>

        <Show when={focusMode()}>
          <FocusMode
            melody={activePlaybackItems}
            isPlaying={isPlaying}
            isPaused={isPaused}
            currentPitch={currentPitch}
            pitchHistory={pitchHistory}
            noteResults={noteResults}
            practiceResult={practiceResult}
            liveScore={liveScore}
            countInBeat={countInBeat}
            isCountingIn={isCountingIn}
            currentBeat={currentBeat}
            currentNoteIndex={currentNoteIndex}
            onPlay={handlePlay}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleReset}
          />
        </Show>

        {/* Score overlay */}
        <Show when={showPracticeResultPopup() && practiceResult() !== null}>
          <div class={styles.overlay} onClick={closeScoreOverlay}>
            <div
              id="score-card"
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              <button class={styles.overlayClose} onClick={closeScoreOverlay}>
                &times;
              </button>
              <h2 id="score-title">Run Complete!</h2>
              <div id="score-grade" class={scoreGrade()}>
                {scoreLabel()}
              </div>
              <div id="score-pct">{practiceResult()!.score}%</div>
              <div id="score-detail">
                {practiceResult()!.noteCount} notes ·{' '}
                {practiceResult()!.avgCents.toFixed(1)}¢ avg
              </div>
              <div id="score-stats">
                <div class={styles.scoreStatPerfect}>
                  <div class={styles.scoreStatValue}>
                    {
                      (noteResults() ?? []).filter(
                        (r) => r.rating === 'perfect',
                      ).length
                    }
                  </div>
                  <div class={styles.scoreStatLabel}>Perfect</div>
                </div>
                <div class={styles.scoreStatExcellent}>
                  <div class={styles.scoreStatValue}>
                    {
                      (noteResults() ?? []).filter(
                        (r) => r.rating === 'excellent',
                      ).length
                    }
                  </div>
                  <div class={styles.scoreStatLabel}>Excellent</div>
                </div>
                <div class={styles.scoreStatGood}>
                  <div class={styles.scoreStatValue}>
                    {
                      (noteResults() ?? []).filter((r) => r.rating === 'good')
                        .length
                    }
                  </div>
                  <div class={styles.scoreStatLabel}>Good</div>
                </div>
                <div class={styles.scoreStatOkay}>
                  <div class={styles.scoreStatValue}>
                    {
                      (noteResults() ?? []).filter((r) => r.rating === 'okay')
                        .length
                    }
                  </div>
                  <div class={styles.scoreStatLabel}>Okay</div>
                </div>
                <div class={styles.scoreStatOff}>
                  <div class={styles.scoreStatValue}>
                    {
                      (noteResults() ?? []).filter((r) => r.rating === 'off')
                        .length
                    }
                  </div>
                  <div class={styles.scoreStatLabel}>Off</div>
                </div>
              </div>
              <div id="score-actions">
                <button
                  class={[styles.overlayBtn, 'primary'].join(' ')}
                  onClick={() => {
                    closeScoreOverlay()
                    handleReset()
                    handlePlay()
                  }}
                  aria-label="Try again"
                  title="Try again"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>{' '}
                  Try Again
                </button>
                <button
                  class={styles.overlayBtn}
                  onClick={closeScoreOverlay}
                  aria-label="Close"
                  title="Close"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>{' '}
                  Close
                </button>
              </div>

              <Show when={getSessionHistory().length > 0}>
                <div id="score-history">
                  <h3 class={styles.historyTitle}>Recent Progress</h3>
                  <div class={styles.historyChart}>
                    <For each={getSessionHistory().slice(0, 10)}>
                      {(session) => (
                        <div
                          class={styles.historyBar}
                          style={{ height: `${session.score}%` }}
                          title={`Score: ${session.score}%`}
                        />
                      )}
                    </For>
                  </div>
                  {/* Practice Intelligence trend insights */}
                  {(() => {
                    const scores = getRecentScores(20)
                    if (scores.length < 1) return null
                    const stats = computePracticeStats()
                    const improvement = computeImprovementRate()
                    const report = generateWeaknessReport()
                    return (
                      <div class={styles.trendSection}>
                        <div class={styles.trendSparkline}>
                          <SparklineChart
                            data={scores}
                            width={180}
                            height={36}
                          />
                        </div>
                        <div class={styles.trendStats}>
                          <span>
                            {stats.sessionsThisWeek} session
                            {stats.sessionsThisWeek !== 1 ? 's' : ''} this week
                            · {stats.overallAvg}% avg
                          </span>
                          {improvement !== null && (
                            <span
                              classList={{
                                [styles.trendUp]: improvement > 0,
                                [styles.trendDown]: improvement < 0,
                              }}
                            >
                              {improvement > 0
                                ? '↑'
                                : improvement < 0
                                  ? '↓'
                                  : '→'}{' '}
                              {Math.abs(improvement).toFixed(1)} pts/week
                            </span>
                          )}
                        </div>
                        {report.weakPitches.length > 0 && (
                          <div class={styles.weakNoteRow}>
                            <For each={report.weakPitches.slice(0, 3)}>
                              {(p) => (
                                <span
                                  class={styles.weakNoteBadge}
                                  title={`${p.avgDeviation}¢ avg deviation`}
                                >
                                  {p.noteName} {p.avgDeviation}¢
                                </span>
                              )}
                            </For>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </Show>
            </div>
          </div>
        </Show>

        <ScaleBuilder
          isOpen={showScaleBuilder()}
          onClose={() => setShowScaleBuilder(false)}
        />

        <Show when={showPracticeResultPopup() && sessionSummary() !== null}>
          <div class={styles.overlay} onClick={() => setSessionSummary(null)}>
            <div
              id="session-summary-card"
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              <button
                class={styles.overlayClose}
                onClick={() => setSessionSummary(null)}
              >
                &times;
              </button>
              <h2>Session Complete!</h2>
              <p id="session-summary-name">{sessionSummary()!.name}</p>
              <div id="session-summary-score">{sessionSummary()!.score}%</div>
              <div id="session-summary-items">
                {sessionSummary()!.items} items completed
              </div>
              <div id="score-actions">
                <button
                  class={[styles.overlayBtn, 'primary'].join(' ')}
                  onClick={() => {
                    setSessionSummary(null)
                    showSessionPresetsLibrary()
                  }}
                >
                  New Session
                </button>
                <button
                  class={styles.overlayBtn}
                  onClick={() => setSessionSummary(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Show>

        <Notifications />

        <Show when={isLibraryModalOpenSignal()}>
          <LibraryModal
            isOpen={true}
            close={() => hideLibrary()}
            onPlayMelody={handlePlayMelodyFromModal}
          />
        </Show>

        <Show when={isSessionLibraryModalOpenSignal()}>
          <SessionLibraryModal
            isOpen={true}
            close={() => hideSessionLibrary()}
          />
        </Show>

        <Show when={showSessionBrowser()}>
          <Suspense fallback={<SkeletonTabContent />}>
            <SessionBrowser
              onClose={hideSessionPresetsLibrary}
              onStartSession={(template) => {
                const practiceSess =
                  getSession(template.id) ?? templateToSession(template)
                setActiveUserSession(practiceSess)
                playSessionSequence([])
                hideSessionPresetsLibrary()
              }}
            />
          </Suspense>
        </Show>

        <SessionCelebration
          data={celebrationData()}
          onClose={dismissCelebration}
        />

        <Show when={showShortcutHelp()}>
          <KeyboardShortcutOverlay onClose={() => setShowShortcutHelp(false)} />
        </Show>

        <Show when={showSurvey()}>
          <UserSurveyModal
            onClose={() => {
              dismissSurvey()
              setShowSurvey(false)
            }}
          />
        </Show>
      </div>
    </PlaybackProvider>
  )
}

export const App: Component<AppProps> = (props) => {
  return (
    <AppErrorBoundary>
      <EngineProvider>
        <GuitarProvider>
          <AppShell {...props} />
        </GuitarProvider>
        <CrashModal />
      </EngineProvider>
    </AppErrorBoundary>
  )
}
