// ============================================================
// App — Main SolidJS application entry
// v3 refactor: thin shell using providers + controllers
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, Suspense, } from 'solid-js'
import { lazy } from 'solid-js'
import { AppSidebar } from '@/components/AppSidebar'
import { FocusMode } from '@/components/FocusMode'
import { HistoryCanvas } from '@/components/HistoryCanvas'
import { MusicBoard, SlidersHorizontal } from '@/components/icons'
import KeyboardShortcutOverlay from '@/components/KeyboardShortcutOverlay'
import { LibraryModal } from '@/components/LibraryModal'
import { Notifications } from '@/components/Notifications'
import { PianoRollCanvas } from '@/components/PianoRollCanvas'
import PitchAccuracyHeatmap from '@/components/PitchAccuracyHeatmap'
import { PitchCanvas } from '@/components/PitchCanvas'
import { ScaleBuilder } from '@/components/ScaleBuilder'
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
import './components/TierSelector.css'
import './components/SessionEditorTimeline.css'
import { SessionCelebration } from '@/components/SessionCelebration'
import { SessionLibraryModal } from '@/components/SessionLibraryModal'
import { SessionPlayer } from '@/components/SessionPlayer'
import type { PracticeSubMode } from '@/components/shared/SharedControlToolbar'
import { SharedControlToolbar } from '@/components/shared/SharedControlToolbar'
import { SkeletonTabContent } from '@/components/Skeleton'
import type { UvrView } from '@/components/UvrPanel'
import { EngineProvider, useEngines } from '@/contexts/EngineContext'
import { PlaybackProvider } from '@/contexts/PlaybackContext'
import { hasValidToken, takeGoogleRedirectResult, } from '@/db/services/auth-service'
import { initSettingsSync } from '@/db/services/settings-service'
import { useEditorController } from '@/features/editor/useEditorController'
import { usePianoRollEvents } from '@/features/events/usePianoRollEvents'
import type { ExerciseConfig, ExerciseType } from '@/features/exercises/types'
import { useFallingNotesController } from '@/features/falling-notes/useFallingNotesController'
import { useGuitarPracticeController } from '@/features/guitar-practice/useGuitarPracticeController'
import { useKeyboardShortcuts } from '@/features/keyboard/useKeyboardShortcuts'
import { usePlaybackController } from '@/features/playback/usePlaybackController'
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
import { PLAYBACK_MODE_ONCE, PLAYBACK_MODE_REPEAT, PLAYBACK_MODE_SESSION, TAB_ANALYSIS, TAB_CHALLENGES, TAB_COMMUNITY, TAB_COMPOSE, TAB_EXERCISES, TAB_GUITAR, TAB_JAM, TAB_KARAOKE, TAB_LEADERBOARD, TAB_PIANO, TAB_PITCH_ALGO, TAB_PITCH_TEST, TAB_SETTINGS, TAB_SINGING, tabLabel, } from '@/features/tabs/constants'
import type { InstrumentType } from '@/lib/audio-engine'
import { audioRegistry } from '@/lib/audio-registry'
import { debounce } from '@/lib/debounce'
import { registerE2EBridge } from '@/lib/e2e-bridge'
import { buildChordToneMidis } from '@/lib/guitar/chord-utils'
import { DrumMachine } from '@/lib/guitar/drum-machine'
import { NOTE_NAMES } from '@/lib/note-utils'
import { initDefaultOGTags, setMelodyOGTags } from '@/lib/og-tags'
import { KEY_OFFSETS, melodyIndicesAtBeat, melodyTotalBeats, midiToFreq, SCALE_DEFINITIONS, } from '@/lib/scale-data'
import { buildScaleMelody, buildSessionPlaybackMelody, } from '@/lib/session-builder'
import { copyShareUrl, decodeSharePayload, encodeMelodyForShare, fetchShortPayload, generateMelodyItemsFromCompact, } from '@/lib/share-codec'
import { hasSharedPresetInURL, loadFromURL } from '@/lib/share-url'
import { buildFingerprintIndex, loadStemFingerprints, } from '@/lib/shazam/melody-fingerprints'
import { storageGet } from '@/lib/storage'
import { AnalysisPage } from '@/pages/AnalysisPage'
import { ChallengesPage } from '@/pages/ChallengesPage'
import { CommunityPage } from '@/pages/CommunityPage'
import { ExercisesPage } from '@/pages/ExercisesPage'
import { JamPage } from '@/pages/JamPage'
import { KaraokePage } from '@/pages/KaraokePage'
import { LeaderboardPage } from '@/pages/LeaderboardPage'
import { PianoPage } from '@/pages/PianoPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { celebrationData, dismissCelebration, dismissSurvey, dismissWelcome, openWalkthroughChapter, pendingDrill, selectedWalkthrough, setActiveTab, setActiveUserSession, setBpm, setEditorView, setInstrument, setKeyName, setPendingDrill, setPlaybackSpeed, setScaleType, showSelection, walkthroughModalOpen, } from '@/stores'
import { activeTab as activeTabSignal, appStore, bpm, countIn, editorView, endPracticeSession, focusMode as focusModeSignal, getNoteAccuracyMap, getSessionHistory, hideLibrary, hideSessionLibrary, hideSessionPresetsLibrary, initTheme, isLibraryModalOpen as isLibraryModalOpenSignal, isSessionLibraryModalOpen as isSessionLibraryModalOpenSignal, keyName as keyNameSignal, micActive, openLearningWalkthrough, playbackSpeed, scaleType as scaleTypeSignal, sessionActive, sessionMode, showNotification, showSessionBrowser, showSessionPresetsLibrary, showWelcome, startWalkthrough, surveySeen, toggleMicWaveVisible, } from '@/stores'
import { advancedFeaturesEnabled, initGroupStore, initSessionStore, } from '@/stores/app-store'
import { setJamRoomToJoin } from '@/stores/jam-store'
import { initKaraokePlaylistStore } from '@/stores/karaoke-playlist-store'
import { melodyStore } from '@/stores/melody-store'
import { getSession, setSelectedMelodyIds, templateToSession, userSession, } from '@/stores/session-store'
import { fontFamily, showPracticeResultPopup, VOCAL_RANGES, vocalRangePreset, } from '@/stores/settings-store'
import type { PlaybackSession } from '@/types'
import type { ActiveTab, MelodyItem, PlaybackMode, SpacedRestMode, } from '@/types'
import { CHORD_INTERVALS } from '@/types'
import { Walkthrough, WalkthroughControl } from './components'
import { LyricsUploaderStyles, StemMixerStyles } from './components'
import styles from './components/App.module.css'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { CrashModal } from './components/CrashModal'
import { GuideSelection } from './components/GuideSelection'
import { ChordSelector } from './components/guitar/ChordSelector'
import { DrumMachinePanel } from './components/guitar/DrumMachinePanel'
import { GuitarFretboardCanvas } from './components/guitar/GuitarFretboardCanvas'
import type { FretboardMode } from './components/guitar/GuitarFretboardModeTabs'
import { GuitarFretboardModeTabs } from './components/guitar/GuitarFretboardModeTabs'
import { GuitarPracticeSongPicker } from './components/guitar/GuitarPracticeSongPicker'
import { GuitarViewToggle } from './components/guitar/GuitarViewToggle'
import { InteractiveGuitarFretboardCanvas } from './components/guitar/InteractiveGuitarFretboardCanvas'
import { KeyScaleSelector } from './components/guitar/KeyScaleSelector'
import { TabErrorBoundary } from './components/TabErrorBoundary'
import UserSurveyModal from './components/UserSurveyModal'
import { WelcomeScreen } from './components/WelcomeScreen'
import { createAdaptiveJam } from './features/guitar-practice/AdaptiveJamState'
import { createCagedTrainer } from './features/guitar-practice/CagedTrainerState'
import { createCallResponse } from './features/guitar-practice/CallResponseState'
import { createChordProgression } from './features/guitar-practice/ChordProgressionState'
import { createEarTraining } from './features/guitar-practice/EarTrainingPanel'
import { createMelodyTranscription } from './features/guitar-practice/MelodyTranscriptionState'
import { createNoteLocatorQuiz } from './features/guitar-practice/NoteLocatorQuiz'
import { createSingToFretboard } from './features/guitar-practice/SingToFretboardState'
import { createTranscriptionTrainer } from './features/guitar-practice/TranscriptionTrainerState'

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

const AppShell: Component<AppProps> = (props) => {
  const { audioEngine, playbackRuntime, practiceEngine } = useEngines()
  const drumMachine = new DrumMachine()
  const [drumBpm, setDrumBpm] = createSignal(drumMachine.bpm)
  drumMachine.onChange(() => setDrumBpm(drumMachine.bpm))

  // ── Local UI state ──────────────────────────────────────────
  const activeTab = (): ActiveTab => activeTabSignal()
  const focusMode = focusModeSignal

  const [sidebarOpen, setSidebarOpen] = createSignal(false)
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen())
  const closeSidebar = () => setSidebarOpen(false)
  const savedSidebarCollapsed =
    localStorage.getItem('pitchperfect_sidebar_collapsed') === 'true'
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(
    savedSidebarCollapsed,
  )

  createEffect(() => {
    localStorage.setItem(
      'pitchperfect_sidebar_collapsed',
      String(sidebarCollapsed()),
    )
  })

  // Sync audio engine instrument when switching tabs
  createEffect(() => {
    const tab = activeTab()
    const engine = audioEngine

    if (tab === TAB_GUITAR) {
      engine.setInstrument(guitar.instrumentType())
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

  // Auto-launch exercise drill from challenge "Practice" button.
  // Stash the drill's curated target notes as a one-shot launch override so
  // the exercise starts on the challenge's notes, then consume the pending
  // drill once so it doesn't re-fire and trap the user on that exercise.
  createEffect(() => {
    const drill = pendingDrill()
    if (drill && activeTab() === TAB_EXERCISES) {
      if (drill.notes.length > 0) {
        setLaunchOverride(drill.exercise, {
          type: drill.exercise,
          targetNote: drill.notes[0],
          targetNotes: drill.notes,
        })
      }
      setSelectedExercise(drill.exercise)
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
    closeGuideSelection()
    startWalkthrough(sectionIds)
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
      const TABS_ORDER: ActiveTab[] = [
        TAB_SINGING,
        TAB_PIANO,
        TAB_KARAOKE,
        TAB_COMMUNITY,
        TAB_LEADERBOARD,
        TAB_CHALLENGES,
        TAB_JAM,
        TAB_COMPOSE,
        TAB_ANALYSIS,
        TAB_SETTINGS,
        TAB_GUITAR,
      ]

      // Community / Leaderboard / Challenges are always available now; only
      // the dev-only pitch-test / pitch-algo tabs stay behind the flag.
      let availableTabs = TABS_ORDER
      if (!advancedFeaturesEnabled()) {
        availableTabs = TABS_ORDER.filter(
          (t) => t !== TAB_PITCH_TEST && t !== TAB_PITCH_ALGO,
        )
      }

      const currentIdx = availableTabs.indexOf(activeTab())
      if (currentIdx !== -1) {
        if (deltaX > 0 && currentIdx < availableTabs.length - 1) {
          void handleTabChange(availableTabs[currentIdx + 1])
        } else if (deltaX < 0 && currentIdx > 0) {
          void handleTabChange(availableTabs[currentIdx - 1])
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
    activeTab,
    activeUvrView,
    activeUvrSessionId,
    showSelection,
    walkthroughModalOpen,
    showGuideSelection,
    selectedWalkthrough,
  })

  // ── Recording controller ────────────────────────────────────
  const recording = useRecordingController({
    audioEngine,
    playbackRuntime,
    practiceEngine,
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

  // ── Guitar Practice controller ────────────────────────────────
  const guitar = useGuitarPracticeController(audioEngine)

  const [guitarView, setGuitarView] = createSignal<'interactive' | 'hero'>(
    'hero',
  )
  const [fretboardKey, setFretboardKey] = createSignal('C')
  const [fretboardScale, setFretboardScale] = createSignal('major')
  const [lastPlayedNote, setLastPlayedNote] = createSignal<{
    midi: number
    stringIndex: number
    fret: number
  } | null>(null)

  const highlightedNotes = createMemo(() => {
    const keyOffset = KEY_OFFSETS[fretboardKey()] ?? 0
    const degrees =
      SCALE_DEFINITIONS[fretboardScale()]?.degrees ??
      SCALE_DEFINITIONS.major.degrees
    const openMidi = [40, 45, 50, 55, 59, 64]
    const set = new Set<number>()
    for (let s = 0; s < 6; s++)
      for (let f = 0; f <= 15; f++) {
        const midi = openMidi[s] + f
        const deg = (((midi - keyOffset) % 12) + 12) % 12
        if (degrees.includes(deg)) set.add(midi)
      }
    return set
  })

  const [fretboardMode, setFretboardMode] =
    createSignal<FretboardMode>('explore')
  const [selectedChord, setSelectedChord] = createSignal<string | null>(null)

  const chordToneMidis = createMemo(() => {
    const chord = selectedChord()
    const key = fretboardKey()
    if (chord === null) return new Set<number>()
    const rootMidi = (KEY_OFFSETS[key] ?? 0) + 60
    return buildChordToneMidis(rootMidi, chord)
  })

  const noteQuiz = createNoteLocatorQuiz()
  const earTraining = createEarTraining(audioEngine!)
  const melodyTranscription = createMelodyTranscription(
    audioEngine!,
    fretboardKey,
    fretboardScale,
  )
  const callResponse = createCallResponse(
    audioEngine!,
    fretboardKey,
    fretboardScale,
  )

  const cagedTrainer = createCagedTrainer()
  const chordProgression = createChordProgression(
    fretboardKey,
    setSelectedChord,
  )

  const singToFretboard = createSingToFretboard(audioEngine!)
  const transcriptionTrainer = createTranscriptionTrainer(audioEngine!)
  const adaptiveJam = createAdaptiveJam(
    fretboardKey,
    drumMachine,
    setSelectedChord,
  )

  const handleFretNotePlayed = (
    midi: number,
    stringIndex: number,
    fret: number,
  ) => {
    const mode = fretboardMode()
    if (mode === 'noteQuiz') {
      noteQuiz.handleNotePlayed(midi)
    } else if (mode === 'earTraining') {
      earTraining.handleNotePlayed(midi)
    } else if (mode === 'melodyTranscription') {
      melodyTranscription.handleNotePlayed(midi)
    } else if (mode === 'callResponse') {
      callResponse.handleNotePlayed(midi)
    } else if (mode === 'singToFretboard') {
      singToFretboard.handleFretNotePlayed(midi)
    } else if (mode === 'transcriptionTrainer') {
      transcriptionTrainer.handleFretNotePlayed(midi)
    } else if (mode === 'adaptiveJam') {
      adaptiveJam.handleFretNotePlayed(midi)
    } else {
      audioEngine?.playTone(midiToFreq(midi), 600)
    }
    setLastPlayedNote({ midi, stringIndex, fret })
  }

  // ── Guitar mode lifecycle ────────────────────────────────────
  // Single createEffect dispatches on the active mode, starting
  // the correct sub-mode on enter and stopping/disabling it on
  // leave.  Previously 9 separate createEffect blocks.
  createEffect(() => {
    const active = activeTab() === TAB_GUITAR && guitarView() === 'interactive'
    const mode = active ? fretboardMode() : null

    // Modes that auto-start on enter
    if (mode === 'noteQuiz' && !noteQuiz.roundActive()) {
      noteQuiz.startRound()
    }
    if (mode === 'earTraining' && earTraining.targetMidi() === null) {
      earTraining.playNewNote()
    }
    if (
      mode === 'melodyTranscription' &&
      melodyTranscription.phase() === 'idle'
    ) {
      melodyTranscription.startNewPhrase()
    }
    if (mode === 'callResponse' && callResponse.phase() === 'idle') {
      callResponse.startRound()
    }

    // Modes that auto-start on enter AND auto-stop on leave
    if (mode === 'chordProgression') {
      if (!chordProgression.playing()) chordProgression.start()
    } else if (chordProgression.playing()) {
      chordProgression.stop()
    }

    if (mode === 'adaptiveJam') {
      if (!adaptiveJam.playing()) adaptiveJam.start()
    } else if (adaptiveJam.playing()) {
      adaptiveJam.stop()
    }

    // singToFretboard: start/stop with mic lifecycle
    if (mode === 'singToFretboard') {
      if (!singToFretboard.running()) {
        void practiceEngine.startMic()
        singToFretboard.start()
      }
    } else if (singToFretboard.running()) {
      singToFretboard.stop()
      practiceEngine.stopMic()
    }

    // transcriptionTrainer: stop when leaving mode
    if (mode !== 'transcriptionTrainer') {
      transcriptionTrainer.stop()
    }

    // Hero mode: mic only during active gameplay with audio input enabled
    const heroActive = activeTab() === TAB_GUITAR && guitarView() === 'hero'
    const heroState = guitar.gameState()
    if (
      heroActive &&
      guitar.isMicActive() &&
      (heroState === 'playing' || heroState === 'countdown')
    ) {
      void practiceEngine.startMic()
    } else if (!guitar.isMicActive() || !heroActive) {
      practiceEngine.stopMic()
    }
  })

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
      strumKeyboard: guitar.strumKeyboard,
      togglePlayback: () => {
        if (guitarView() === 'hero') {
          guitar.togglePlay()
        } else {
          if (drumMachine.playing) {
            drumMachine.stop()
          } else {
            void drumMachine.init().then(() => {
              void drumMachine.start()
            })
          }
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
  // Dispose the drum machine's AudioContext + scheduling loop on unmount.
  onCleanup(() => drumMachine.dispose())

  // ── Tab change handler with audio cleanup ──────────────────
  // ── Tab-change cleanup ──────────────────────────────────────
  // We use an effect to ensure cleanup runs whenever activeTab changes,
  // regardless of whether it was triggered by a UI click, hash router,
  // or an E2E bridge call.
  createEffect(
    on(
      activeTab,
      (_newTab, prevTab) => {
        if (prevTab === undefined) return // Initial mount

        // 1. Stop singing/compose playback
        if (prevTab === TAB_SINGING || prevTab === TAB_COMPOSE) {
          void resetPlaybackState()
        }

        // 2. Stop piano mic if active
        if (prevTab === TAB_PIANO && fallingNotes.isMicActive()) {
          fallingNotes.stopMic()
        }

        // 3. Stop guitar practice if active
        if (prevTab === TAB_GUITAR && guitar.gameState() !== 'idle') {
          guitar.stopGame()
        }

        // 4. Stop guitar mic if active
        if (prevTab === TAB_GUITAR) {
          practiceEngine.stopMic()
        }

        // 5. Clear any active walkthroughs if switching away from study-related tabs
        // (Optional, based on UX needs)
      },
      { defer: true },
    ),
  )

  const handleTabChange = (newTab: ActiveTab) => {
    setActiveTab(newTab)
  }

  // ── Debounced auto-save for melody changes ─────────────────
  const debouncedAutoSave = debounce(() => {
    const currentMelody = melodyStore.getCurrentMelody()
    if (currentMelody === null) return
    showNotification('Melody saved!', 'success')
  }, 500)

  // ── Mic handler ────────────────────────────────────────────
  const handleMicToggle = async () => {
    if (micActive()) {
      practiceEngine.stopMic()
    } else {
      await practiceEngine.startMic()
    }
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

    // Saved volume
    const vol = parseInt(storageGet('pp_volume', '80')!, 10)
    setSavedVol(isNaN(vol) ? 80 : vol)

    // Wire runtime events
    setupRuntimeEvents()

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

  // Show optional survey after welcome screen is dismissed (once per browser,
  // tracked via the persisted surveySeen flag — same as the welcome screen).
  createEffect(() => {
    if (showWelcome() || surveyChecked()) return
    setSurveyChecked(true)
    if (!surveyEnabledHere() || surveySeen()) return
    // The survey persists to the cloud, so only prompt signed-in users —
    // a signed-out submit hits the user-scoped write guard and fails. (On
    // deployed builds where the survey shows, a fresh visitor is signed in
    // anonymously at startup; an upgraded-then-signed-out device is not.)
    if (!hasValidToken()) return
    void import('@/db/services/survey-service').then(({ hasSubmittedSurvey }) =>
      hasSubmittedSurvey().then((already) => {
        if (!already) setShowSurvey(true)
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
            // Wire the welcome overlay's "Enable Mic" button to the same
            // mic toggle the SharedToolbar uses, so first-run permission
            // grants actually start the mic stream + pitch detection.
            // Previously this prop wasn't passed at all, so clicking only
            // flipped a local "micEnabled" UI signal in WelcomeScreen and
            // the mic was never opened.
            onEnableMic={handleMicToggle}
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
              <p class="subtitle">Voice Pitch Practice</p>
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
            />

            {/* Tab content */}
            <main class="main-content" id="main-content" tabindex="-1">
              <Show when={activeTab() === TAB_SINGING}>
                <TabErrorBoundary tabName={tabLabel(TAB_SINGING)}>
                  {/* Practice panel */}
                  <div id="practice-panel">
                    {/* Shared control toolbar with practice-specific options */}
                    <SharedControlToolbar
                      activeTab={() => activeTab()}
                      singingTab={() => activeTab() === TAB_SINGING}
                      editorTab={() => activeTab() === TAB_COMPOSE}
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
                      countInBeats={() => countIn()}
                      onMicToggle={() => {
                        void handleMicToggle()
                      }}
                      onWaveToggle={toggleMicWaveVisible}
                    />

                    <Show when={sessionActive()}>
                      <SessionPlayer
                        onSkip={handleSessionSkip}
                        onEnd={handleSessionEnd}
                      />
                    </Show>

                    <div id="canvas-container">
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
                        noteAccuracyMap={noteAccuracyMap}
                        isRecording={recording.isRecording}
                        getWaveform={() =>
                          audioEngine?.getWaveformData() ?? null
                        }
                        noteResults={noteResults}
                        countInBeats={() => countIn()}
                      />
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

                    <div id="history-container">
                      <HistoryCanvas
                        frequencyData={frequencyData}
                        waveformData={waveformData}
                        liveScore={liveScore}
                      />
                    </div>
                  </div>
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_COMPOSE}>
                <TabErrorBoundary tabName={tabLabel(TAB_COMPOSE)}>
                  <SharedControlToolbar
                    activeTab={() => activeTab()}
                    editorTab={() => activeTab() === TAB_COMPOSE}
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
                    speed={playbackSpeed()}
                    onSpeedChange={setPlaybackSpeed}
                    metronomeEnabled={() => metronomeEnabled()}
                    onMetronomeToggle={() =>
                      setMetronomeEnabled(metronomeEnabled() === false)
                    }
                    playMode={() => PLAYBACK_MODE_ONCE}
                    playModeChange={() => {}}
                    practiceCycles={() => 1}
                    onCyclesChange={() => {}}
                    currentCycle={() => currentRepeat()}
                    practiceSubMode={() => 'all'}
                    onPracticeSubModeChange={() => {}}
                    isCountingIn={() => false}
                    countInBeat={() => 0}
                    countInBeats={() => countIn()}
                    isRecording={() => recording.isRecording()}
                    onRecordToggle={recording.handleRecordToggle}
                    onShareMelody={handleCopyShareLink}
                    onMicToggle={() => {
                      void handleMicToggle()
                    }}
                    onWaveToggle={toggleMicWaveVisible}
                  />

                  <div class={styles.editorViewToggle}>
                    <button
                      class={styles.viewBtn}
                      classList={{
                        [styles.activeViewBtn]: editorView() === 'piano-roll',
                      }}
                      onClick={() => setEditorView('piano-roll')}
                      aria-label="Piano Roll"
                      title="Piano Roll"
                    >
                      <MusicBoard /> Piano Roll
                    </button>
                    <button
                      class={styles.viewBtn}
                      classList={{
                        [styles.activeViewBtn]:
                          editorView() === 'session-editor',
                      }}
                      data-testid="view-session-editor"
                      onClick={() => setEditorView('session-editor')}
                      aria-label="Session Editor"
                      title="Session Editor"
                    >
                      <SlidersHorizontal /> Session Editor
                    </button>
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
                    <PianoRollCanvas
                      // FIXME: Check if playbck items or items should be sent
                      melody={() => melodyStore.items()}
                      scale={() => melodyStore.currentScale()}
                      bpm={() => bpm()}
                      totalBeats={() => totalBeats()}
                      playbackState={editorPlaybackState}
                      currentNoteIndex={() => melodyStore.currentNoteIndex()}
                      currentBeat={currentBeat}
                      countInBeats={() => countIn()}
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
                        audioEngine.setInstrument(instrument as InstrumentType)
                        audioRegistry.setInstrumentAll(
                          instrument as InstrumentType,
                        )
                        setInstrument(instrument as InstrumentType)
                      }}
                      onPlaybackStateChange={(_state) => {
                        // editor playback state owned by playbackController now
                      }}
                      getWaveform={() => audioEngine?.getWaveformData() ?? null}
                    />
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
                  />
                </TabErrorBoundary>
              </Show>
              <Show when={activeTab() === TAB_GUITAR}>
                <TabErrorBoundary tabName={tabLabel(TAB_GUITAR)}>
                  <div id="guitar-practice-panel">
                    <SharedControlToolbar
                      activeTab={activeTab}
                      guitarTab={() => activeTab() === TAB_GUITAR}
                      isPlaying={() =>
                        guitar.gameState() === 'playing' ||
                        guitar.gameState() === 'countdown'
                      }
                      isPaused={() => guitar.gameState() === 'paused'}
                      onPlay={() => void guitar.startGame()}
                      onPause={guitar.pauseGame}
                      onResume={guitar.resumeGame}
                      onStop={guitar.stopGame}
                      volume={savedVol}
                      onVolumeChange={(vol) => {
                        setSavedVol(vol)
                        audioEngine?.setVolume(vol / 100)
                      }}
                      speed={1}
                      onSpeedChange={() => {}}
                      metronomeEnabled={() => false}
                      onMetronomeToggle={() => {}}
                      playMode={() => PLAYBACK_MODE_ONCE}
                      playModeChange={() => {}}
                      practiceCycles={() => 1}
                      onCyclesChange={() => {}}
                      currentCycle={() => 1}
                      practiceSubMode={() => 'all' as const}
                      onPracticeSubModeChange={() => {}}
                      isCountingIn={() => guitar.gameState() === 'countdown'}
                      countInBeat={() =>
                        guitar.playheadBeat() < 0
                          ? Math.ceil(-guitar.playheadBeat())
                          : 0
                      }
                      countInBeats={() => countIn()}
                      showNoteLabels={guitar.showNoteLabels}
                      onToggleNoteLabels={() =>
                        guitar.setShowNoteLabels((p) => !p)
                      }
                      showUserNotes={guitar.showUserNotes}
                      onToggleUserNotes={() =>
                        guitar.setShowUserNotes((p) => !p)
                      }
                      bpmValue={
                        guitarView() === 'interactive'
                          ? drumBpm
                          : guitar.songBpm
                      }
                      onBpmChange={
                        guitarView() === 'interactive'
                          ? (b: number) => {
                              drumMachine.setBpm(b)
                              setDrumBpm(b)
                            }
                          : () => {}
                      }
                      onMicToggle={() =>
                        guitar.isMicActive()
                          ? guitar.stopMic()
                          : void guitar.startMic()
                      }
                      onMidiToggle={() =>
                        guitar.midiConnected()
                          ? guitar.midiDisconnect()
                          : void guitar.midiConnect()
                      }
                      midiConnected={guitar.midiConnected}
                    />
                    <div class="gp-header-controls">
                      <div class="gp-header-left">
                        <GuitarPracticeSongPicker
                          onSongLoaded={guitar.loadSong}
                          currentSong={guitar.currentSong}
                          mutedTrackIds={guitar.mutedTrackIds}
                          onToggleMute={guitar.toggleTrackMute}
                          visibleTrackIds={guitar.visibleTrackIds}
                          onToggleVisibility={guitar.toggleTrackVisibility}
                          playheadBeat={guitar.playheadBeat}
                          totalBeats={guitar.totalBeats}
                          songBpm={guitar.songBpm}
                          onSeek={guitar.seekToBeat}
                        />
                      </div>
                      <div class="gp-header-right">
                        <div class="gp-instrument-selector">
                          <span class="gp-instrument-label">Sound:</span>
                          <For
                            each={
                              [
                                {
                                  value: 'guitar-acoustic' as InstrumentType,
                                  label: 'Acoustic',
                                },
                                {
                                  value: 'guitar-electric' as InstrumentType,
                                  label: 'Electric',
                                },
                                {
                                  value: 'bass' as InstrumentType,
                                  label: 'Bass',
                                },
                              ] as const
                            }
                          >
                            {(opt) => (
                              <button
                                class="gp-instrument-btn"
                                classList={{
                                  'gp-instrument-active':
                                    guitar.instrumentType() === opt.value,
                                }}
                                onClick={() =>
                                  guitar.setInstrumentType(opt.value)
                                }
                              >
                                {opt.label}
                              </button>
                            )}
                          </For>
                        </div>
                        <GuitarViewToggle
                          activeView={guitarView}
                          onViewChange={setGuitarView}
                        />
                      </div>
                    </div>
                    <Show when={guitarView() === 'interactive'}>
                      <KeyScaleSelector
                        selectedKey={fretboardKey}
                        selectedScale={fretboardScale}
                        onKeyChange={setFretboardKey}
                        onScaleChange={setFretboardScale}
                      >
                        <GuitarFretboardModeTabs
                          activeMode={fretboardMode}
                          onModeChange={setFretboardMode}
                        />
                        <Show
                          when={
                            fretboardMode() === 'explore' ||
                            fretboardMode() === 'jam'
                          }
                        >
                          <ChordSelector
                            selectedKey={fretboardKey}
                            selectedScale={fretboardScale}
                            selectedChord={selectedChord}
                            onChordChange={setSelectedChord}
                          />
                        </Show>
                      </KeyScaleSelector>
                      <Show when={fretboardMode() === 'noteQuiz'}>
                        <div class="gp-quiz-hud">
                          <div class="gp-quiz-target">
                            Find all{' '}
                            <span
                              style={{
                                color: 'var(--accent)',
                                'font-weight': '700',
                              }}
                            >
                              {NOTE_NAMES[noteQuiz.targetMidiClass()]}
                            </span>{' '}
                            on the neck
                          </div>
                          <div class="gp-quiz-stats">
                            <span class="gp-quiz-timer">
                              {noteQuiz.roundActive()
                                ? `${noteQuiz.timeLeft()}s`
                                : '--'}
                            </span>
                            <span class="gp-quiz-progress">
                              {noteQuiz.foundMidis().size}/
                              {(() => {
                                const target = noteQuiz.targetMidiClass()
                                const openMidi = [40, 45, 50, 55, 59, 64]
                                let count = 0
                                for (let s = 0; s < 6; s++)
                                  for (let f = 0; f <= 15; f++) {
                                    if ((openMidi[s] + f) % 12 === target)
                                      count++
                                  }
                                return count
                              })()}{' '}
                              found
                            </span>
                            <span class="gp-quiz-score">
                              Score: {noteQuiz.score()}
                            </span>
                          </div>
                        </div>
                      </Show>
                      <Show when={fretboardMode() === 'earTraining'}>
                        <div class="gp-ear-panel">
                          <div class="gp-ear-difficulty">
                            <span class="gp-key-scale-label">Difficulty</span>
                            <select
                              class="gp-key-scale-select"
                              value={earTraining.difficulty()}
                              onChange={(e) =>
                                earTraining.setDifficulty(
                                  e.currentTarget.value as
                                    | 'easy'
                                    | 'medium'
                                    | 'hard',
                                )
                              }
                            >
                              <option value="easy">Easy (frets 0-3)</option>
                              <option value="medium">Medium (frets 0-7)</option>
                              <option value="hard">Hard (full neck)</option>
                            </select>
                          </div>
                          <div class="gp-ear-hud">
                            <span class="gp-ear-label">What note is this?</span>
                            <span class="gp-ear-streak">
                              Streak: {earTraining.streak()}
                            </span>
                            <span class="gp-ear-accuracy">
                              {Math.round(earTraining.accuracy() * 100)}%
                            </span>
                            {earTraining.feedback() && (
                              <span
                                class="gp-ear-feedback"
                                classList={{
                                  'gp-ear-correct':
                                    earTraining.feedback() === 'correct',
                                  'gp-ear-wrong':
                                    earTraining.feedback() === 'wrong',
                                }}
                              >
                                {earTraining.feedback() === 'correct'
                                  ? 'Correct!'
                                  : 'Try again'}
                              </span>
                            )}
                          </div>
                        </div>
                      </Show>
                      <Show when={fretboardMode() === 'melodyTranscription'}>
                        <div class="gp-transcription-hud">
                          <div class="gp-transcription-left">
                            <span class="gp-transcription-label">
                              {melodyTranscription.phase() === 'playing'
                                ? 'Listen...'
                                : melodyTranscription.phase() === 'listening'
                                  ? 'Your turn! Play the melody'
                                  : melodyTranscription.phase() === 'feedback'
                                    ? 'Feedback'
                                    : 'Ready'}
                            </span>
                            <span class="gp-transcription-progress">
                              Note {melodyTranscription.currentNoteIndex() + 1}/
                              {melodyTranscription.phraseLength()}
                            </span>
                          </div>
                          <div class="gp-transcription-right">
                            <span class="gp-transcription-score">
                              Score: {melodyTranscription.score()}
                            </span>
                            <div class="gp-transcription-length">
                              <span class="gp-key-scale-label">Length</span>
                              <select
                                class="gp-key-scale-select"
                                value={melodyTranscription.phraseLength()}
                                onChange={(e) =>
                                  melodyTranscription.setPhraseLength(
                                    Number(e.currentTarget.value),
                                  )
                                }
                              >
                                <option value={2}>2 notes</option>
                                <option value={3}>3 notes</option>
                                <option value={4}>4 notes</option>
                                <option value={5}>5 notes</option>
                              </select>
                            </div>
                            <button
                              class="gp-btn"
                              onClick={() =>
                                melodyTranscription.startNewPhrase()
                              }
                            >
                              New Phrase
                            </button>
                            <button
                              class="gp-btn"
                              onClick={() => melodyTranscription.skipPhrase()}
                            >
                              Skip
                            </button>
                          </div>
                        </div>
                      </Show>
                      <Show when={fretboardMode() === 'callResponse'}>
                        <div class="gp-callresponse-hud">
                          <div class="gp-callresponse-left">
                            <span class="gp-callresponse-label">
                              {callResponse.phase() === 'callPlaying'
                                ? 'Listen to the call...'
                                : callResponse.phase() === 'callEcho'
                                  ? 'Your turn! Echo the call'
                                  : callResponse.phase() === 'responsePlaying'
                                    ? 'Listen to the response...'
                                    : callResponse.phase() === 'responseImprov'
                                      ? 'Improvise your reply!'
                                      : callResponse.phase() === 'feedback'
                                        ? 'Round feedback'
                                        : 'Ready'}
                            </span>
                            <span class="gp-callresponse-phase-indicator">
                              {callResponse.phase() === 'callEcho'
                                ? `Echo: ${callResponse.userEchoNotes().length}/${callResponse.callNotes().length}`
                                : callResponse.phase() === 'responseImprov'
                                  ? `Notes: ${callResponse.userImprovNotes().length}`
                                  : ''}
                            </span>
                          </div>
                          <div class="gp-callresponse-right">
                            <span class="gp-callresponse-score">
                              Score: {callResponse.totalScore()}
                            </span>
                            <Show when={callResponse.phase() === 'callEcho'}>
                              <button
                                class="gp-btn"
                                onClick={() => callResponse.finishEcho()}
                              >
                                Echo Done
                              </button>
                            </Show>
                            <Show
                              when={callResponse.phase() === 'responseImprov'}
                            >
                              <button
                                class="gp-btn"
                                onClick={() => callResponse.finishImprov()}
                              >
                                Improv Done
                              </button>
                            </Show>
                            <Show
                              when={
                                callResponse.phase() === 'callPlaying' ||
                                callResponse.phase() === 'responsePlaying'
                              }
                            >
                              <button
                                class="gp-btn"
                                onClick={() => callResponse.skipRound()}
                              >
                                Skip
                              </button>
                            </Show>
                          </div>
                        </div>
                      </Show>
                      <Show when={fretboardMode() === 'cagedTrainer'}>
                        <div class="gp-caged-hud">
                          <div class="gp-caged-left">
                            <span class="gp-caged-label">
                              {cagedTrainer.activeShape()} Position
                            </span>
                            <span class="gp-caged-chord">
                              Chord: {cagedTrainer.activeChord()}
                            </span>
                          </div>
                          <div class="gp-caged-right">
                            <button
                              class="gp-btn"
                              onClick={() => cagedTrainer.prevShape()}
                            >
                              Prev
                            </button>
                            <button
                              class="gp-btn"
                              onClick={() => cagedTrainer.nextShape()}
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      </Show>
                      <Show when={fretboardMode() === 'chordProgression'}>
                        <div class="gp-chordprog-hud">
                          <div class="gp-chordprog-left">
                            <span class="gp-chordprog-progression">
                              {chordProgression.progressionName()}
                            </span>
                            <span class="gp-chordprog-chord">
                              {chordProgression.currentChordName()}
                            </span>
                          </div>
                          <div class="gp-chordprog-controls">
                            <button
                              class="gp-btn gp-btn-sm"
                              onClick={() => chordProgression.prevProgression()}
                            >
                              Prev
                            </button>
                            <button
                              class="gp-btn gp-btn-sm"
                              onClick={() => chordProgression.toggle()}
                            >
                              {chordProgression.playing() ? 'Stop' : 'Start'}
                            </button>
                            <button
                              class="gp-btn gp-btn-sm"
                              onClick={() => chordProgression.nextProgression()}
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      </Show>
                      <Show when={fretboardMode() === 'singToFretboard'}>
                        <div class="gp-singtofret-hud">
                          <div class="gp-singtofret-left">
                            <span class="gp-singtofret-phase">
                              {singToFretboard.phase() === 'listening'
                                ? 'Sing a note...'
                                : singToFretboard.phase() === 'locked'
                                  ? `Find ${singToFretboard.targetNoteName()}`
                                  : 'Found!'}
                            </span>
                          </div>
                          <div class="gp-singtofret-right">
                            <span class="gp-singtofret-streak">
                              Streak: {singToFretboard.streak()}
                            </span>
                            <span class="gp-singtofret-total">
                              Found: {singToFretboard.totalFound()}
                            </span>
                          </div>
                        </div>
                      </Show>
                      <Show when={fretboardMode() === 'transcriptionTrainer'}>
                        <div class="gp-tt-hud">
                          <div class="gp-tt-left">
                            <span class="gp-tt-label">Transcribe</span>
                            <span class="gp-tt-progress">
                              {transcriptionTrainer.phase() === 'idle'
                                ? 'Load audio to start'
                                : transcriptionTrainer.phase() === 'loaded'
                                  ? 'Ready — press Play'
                                  : `${transcriptionTrainer.currentTime().toFixed(1)}s / ${transcriptionTrainer.duration().toFixed(1)}s`}
                            </span>
                          </div>
                          <div class="gp-tt-right">
                            <span class="gp-tt-score">
                              Notes: {transcriptionTrainer.foundNotes().length}
                            </span>
                            <Show
                              when={transcriptionTrainer.phase() === 'idle'}
                            >
                              <label class="gp-tt-load-btn">
                                Load Audio
                                <input
                                  type="file"
                                  accept="audio/*"
                                  style="display:none"
                                  onChange={(e) => {
                                    const file = e.currentTarget.files?.[0]
                                    if (file)
                                      transcriptionTrainer.loadAudio(file)
                                  }}
                                />
                              </label>
                            </Show>
                            <Show
                              when={transcriptionTrainer.phase() !== 'idle'}
                            >
                              <button
                                class="gp-btn gp-btn-sm"
                                onClick={() => transcriptionTrainer.play()}
                              >
                                Play
                              </button>
                              <button
                                class="gp-btn gp-btn-sm"
                                onClick={() => transcriptionTrainer.pause()}
                              >
                                Pause
                              </button>
                              <button
                                class="gp-btn gp-btn-sm"
                                onClick={() => transcriptionTrainer.stop()}
                              >
                                Stop
                              </button>
                              <button
                                class="gp-btn gp-btn-sm"
                                onClick={() =>
                                  transcriptionTrainer.toggleLoop()
                                }
                              >
                                {transcriptionTrainer.loopEnabled()
                                  ? 'Loop'
                                  : 'No Loop'}
                              </button>
                            </Show>
                          </div>
                        </div>
                        <Show when={transcriptionTrainer.phase() !== 'idle'}>
                          <div class="gp-tt-controls">
                            <span class="gp-tt-speed-label">
                              Speed:{' '}
                              {transcriptionTrainer.playbackRate().toFixed(2)}x
                            </span>
                            <input
                              type="range"
                              class="gp-tt-speed-slider"
                              min="0.25"
                              max="2"
                              step="0.05"
                              value={transcriptionTrainer.playbackRate()}
                              onInput={(e) =>
                                transcriptionTrainer.setPlaybackRate(
                                  Number(e.currentTarget.value),
                                )
                              }
                            />
                            <button
                              class="gp-btn gp-btn-sm"
                              onClick={() =>
                                transcriptionTrainer.clearFoundNotes()
                              }
                            >
                              Clear Notes
                            </button>
                          </div>
                        </Show>
                      </Show>
                    </Show>
                    <Show when={fretboardMode() === 'adaptiveJam'}>
                      <div class="gp-aj-hud">
                        <div class="gp-aj-left">
                          <span class="gp-aj-label">Adaptive Jam</span>
                          <span class="gp-aj-chord">
                            {adaptiveJam.currentChordRoot()}
                            {adaptiveJam.currentChord()}
                          </span>
                        </div>
                        <div class="gp-aj-right">
                          <span class="gp-aj-density">
                            {adaptiveJam.userNoteDensity().toFixed(1)} n/s
                          </span>
                          <div class="gp-aj-history">
                            <For each={adaptiveJam.chordHistory()}>
                              {(c) => (
                                <span class="gp-aj-history-chip">{c}</span>
                              )}
                            </For>
                          </div>
                        </div>
                      </div>
                    </Show>
                    <div id="guitar-fretboard-container">
                      <Show
                        when={guitarView() === 'interactive'}
                        fallback={
                          <GuitarFretboardCanvas
                            fallingNotes={guitar.fallingNotes}
                            gameState={guitar.gameState}
                            playheadBeat={guitar.playheadBeat}
                            hitResults={guitar.hitResults}
                            combo={guitar.combo}
                            score={guitar.score}
                            visibleBeatWindow={guitar.visibleBeatWindow}
                            showNoteLabels={guitar.showNoteLabels}
                            songBpm={guitar.songBpm}
                            isActive={() => activeTab() === TAB_GUITAR}
                            detectedMidi={guitar.detectedMidi}
                            detectedClarity={guitar.detectedClarity}
                            showUserNotes={guitar.showUserNotes}
                            onStrum={guitar.strumString}
                          />
                        }
                      >
                        <InteractiveGuitarFretboardCanvas
                          selectedKey={fretboardKey}
                          selectedScale={fretboardScale}
                          highlightedNotes={highlightedNotes}
                          isActive={() =>
                            activeTab() === TAB_GUITAR &&
                            guitarView() === 'interactive'
                          }
                          lastPlayedNote={lastPlayedNote}
                          onNotePlayed={handleFretNotePlayed}
                          selectedChord={selectedChord}
                          chordToneMidis={chordToneMidis}
                          mode={fretboardMode}
                          quizFoundMidis={noteQuiz.foundMidis}
                          earTargetMidi={earTraining.targetMidi}
                          earFeedback={earTraining.feedback}
                          transcriptionResults={
                            fretboardMode() === 'callResponse'
                              ? callResponse.echoResults
                              : melodyTranscription.noteResults
                          }
                          transcriptionPhase={
                            fretboardMode() === 'callResponse'
                              ? () =>
                                  callResponse.phase() === 'callEcho'
                                    ? 'listening'
                                    : 'feedback'
                              : melodyTranscription.phase
                          }
                          cagedHighlight={cagedTrainer.highlightedFrets}
                          viewFretRange={cagedTrainer.viewFretRange}
                          singTargetMidi={singToFretboard.targetMidi}
                        />
                      </Show>
                    </div>

                    <Show
                      when={
                        guitarView() === 'interactive' &&
                        (fretboardMode() === 'jam' ||
                          fretboardMode() === 'adaptiveJam' ||
                          fretboardMode() === 'chordProgression')
                      }
                    >
                      <DrumMachinePanel drumMachine={drumMachine} />
                    </Show>
                    <Show when={guitar.gameState() === 'finished'}>
                      <div class="gp-score-overlay">
                        <div class="gp-score-card">
                          <h2>Complete!</h2>
                          <div class="gp-score-grade">
                            {(() => {
                              const s = guitar.score()
                              const t = guitar.totalNotes()
                              const pct =
                                t > 0 ? Math.round((s / (t * 100)) * 100) : 0
                              return pct >= 90
                                ? 'Pitch Perfect!'
                                : pct >= 80
                                  ? 'Excellent!'
                                  : pct >= 65
                                    ? 'Good!'
                                    : pct >= 50
                                      ? 'Okay!'
                                      : 'Keep Practicing!'
                            })()}
                          </div>
                          <div class="gp-score-pct">
                            {guitar.totalNotes() > 0
                              ? Math.round(
                                  (guitar.score() /
                                    (guitar.totalNotes() * 100)) *
                                    100,
                                )
                              : 0}
                            %
                          </div>
                          <div class="gp-score-detail">
                            {guitar.totalNotes()} notes · Max Combo:{' '}
                            {guitar.maxCombo()}x
                          </div>
                          <div class="gp-score-actions">
                            <button
                              class="gp-btn gp-btn-play"
                              onClick={() => void guitar.startGame()}
                            >
                              Play Again
                            </button>
                            <button
                              class="gp-btn gp-btn-close"
                              onClick={guitar.stopGame}
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      </div>
                    </Show>
                  </div>
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
        <AppShell {...props} />
        <CrashModal />
      </EngineProvider>
    </AppErrorBoundary>
  )
}
