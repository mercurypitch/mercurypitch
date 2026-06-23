// ============================================================
// App — Main SolidJS application entry
// v3 refactor: thin shell using providers + controllers
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, Suspense, } from 'solid-js'
import { lazy } from 'solid-js'
import { AppSidebar } from '@/components/AppSidebar'
import { Cpu, Ear, MusicBoard, RotateCcw, SlidersHorizontal, Voice, X, } from '@/components/icons'
import { AppNavTabs } from './components'

const CommunityLeaderboard = lazy(async () =>
  import('@/components/CommunityLeaderboard').then((m) => ({
    default: m.CommunityLeaderboard,
  })),
)
const CommunityShare = lazy(async () =>
  import('@/components/CommunityShare').then((m) => ({
    default: m.CommunityShare,
  })),
)
import { FocusMode } from '@/components/FocusMode'
import { HistoryCanvas } from '@/components/HistoryCanvas'
import KeyboardShortcutOverlay from '@/components/KeyboardShortcutOverlay'
import { LibraryModal } from '@/components/LibraryModal'
import { Notifications } from '@/components/Notifications'
import { PianoRollCanvas } from '@/components/PianoRollCanvas'
import { PitchCanvas } from '@/components/PitchCanvas'

const PitchAlgorithmTester = lazy(async () =>
  import('@/components/PitchAlgorithmTester').then((m) => ({
    default: m.PitchAlgorithmTester,
  })),
)
const PitchTestingTab = lazy(async () =>
  import('@/components/PitchTestingTab').then((m) => ({
    default: m.PitchTestingTab,
  })),
)
const VocalAnalysis = lazy(async () =>
  import('@/components/VocalAnalysis').then((m) => ({
    default: m.VocalAnalysis,
  })),
)
const VocalChallenges = lazy(async () =>
  import('@/components/VocalChallenges').then((m) => ({
    default: m.VocalChallenges,
  })),
)
import { ScaleBuilder } from '@/components/ScaleBuilder'

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
import { SessionCelebration } from '@/components/SessionCelebration'
import { SessionLibraryModal } from '@/components/SessionLibraryModal'
import { SessionPlayer } from '@/components/SessionPlayer'
import { SettingsPanel } from '@/components/SettingsPanel'
import type { PracticeSubMode } from '@/components/shared/SharedControlToolbar'
import { SharedControlToolbar } from '@/components/shared/SharedControlToolbar'
import type { UvrView } from '@/components/UvrPanel'

const UvrPanel = lazy(async () =>
  import('@/components/UvrPanel').then((m) => ({ default: m.UvrPanel })),
)
import './components/AppHeader.css'
import './components/TierSelector.css'
import './components/SessionEditorTimeline.css'
import { EngineProvider, useEngines } from '@/contexts/EngineContext'
import { PlaybackProvider } from '@/contexts/PlaybackContext'
import { takeGoogleRedirectResult } from '@/db/services/auth-service'
import { initSettingsSync } from '@/db/services/settings-service'
import { useEditorController } from '@/features/editor/useEditorController'
import { usePianoRollEvents } from '@/features/events/usePianoRollEvents'
import ArpeggioJumperExercise from '@/features/exercises/arpeggio-jumper/ArpeggioJumperExercise'
import CallResponseExercise from '@/features/exercises/call-response/CallResponseExercise'
import ChordStackerExercise from '@/features/exercises/chord-stacker/ChordStackerExercise'
import DroneIntonationExercise from '@/features/exercises/drone-intonation/DroneIntonationExercise'
import DynamicSwellExercise from '@/features/exercises/dynamic-swell/DynamicSwellExercise'
import ExerciseMenu from '@/features/exercises/ExerciseMenu'
import IntervalTrainerExercise from '@/features/exercises/interval-trainer/IntervalTrainerExercise'
import LongNoteExercise from '@/features/exercises/long-note/LongNoteExercise'
import MirrorMelodyExercise from '@/features/exercises/mirror-melody/MirrorMelodyExercise'
import PitchHoldExercise from '@/features/exercises/pitch-hold/PitchHoldExercise'
import PitchPursuitExercise from '@/features/exercises/pitch-pursuit/PitchPursuitExercise'
import RoutineRunnerExercise from '@/features/exercises/routine-runner/RoutineRunnerExercise'
import ScaleRunnerExercise from '@/features/exercises/scale-runner/ScaleRunnerExercise'
import SirenExercise from '@/features/exercises/siren/SirenExercise'
import SlideExercise from '@/features/exercises/slide/SlideExercise'
import StaccatoPrecisionExercise from '@/features/exercises/staccato-precision/StaccatoPrecisionExercise'
import type { ExerciseType } from '@/features/exercises/types'
import VibratoExercise from '@/features/exercises/vibrato/VibratoExercise'
import { useFallingNotesController } from '@/features/falling-notes/useFallingNotesController'
import { useKeyboardShortcuts } from '@/features/keyboard/useKeyboardShortcuts'
import { usePlaybackController } from '@/features/playback/usePlaybackController'
import { usePracticeController } from '@/features/practice/usePracticeController'
import { useRecordingController } from '@/features/recording/useRecordingController'
import type { RoutineTemplate } from '@/features/routines/types'
import { loadSharedRoutine } from '@/features/routines/use-daily-routine'
import { useHashRouter } from '@/features/routing/useHashRouter'
import { useSessionSequencer } from '@/features/session/useSessionSequencer'
import { PLAYBACK_MODE_ONCE, PLAYBACK_MODE_REPEAT, PLAYBACK_MODE_SESSION, TAB_ANALYSIS, TAB_CHALLENGES, TAB_COMMUNITY, TAB_COMPOSE, TAB_EXERCISES, TAB_JAM, TAB_KARAOKE, TAB_LEADERBOARD, TAB_PIANO, TAB_PITCH_ALGO, TAB_PITCH_TEST, TAB_SETTINGS, TAB_SINGING, tabLabel, } from '@/features/tabs/constants'
import type { InstrumentType } from '@/lib/audio-engine'
import { audioRegistry } from '@/lib/audio-registry'
import { debounce } from '@/lib/debounce'
import { registerE2EBridge } from '@/lib/e2e-bridge'
import { melodyIndicesAtBeat, melodyTotalBeats } from '@/lib/scale-data'
import { buildScaleMelody, buildSessionPlaybackMelody, } from '@/lib/session-builder'
import { copyShareUrl, decodeSharePayload, encodeMelodyForShare, fetchShortPayload, generateMelodyItemsFromCompact, } from '@/lib/share-codec'
import { hasSharedPresetInURL, loadFromURL } from '@/lib/share-url'
import { buildFingerprintIndex, loadStemFingerprints, } from '@/lib/shazam/melody-fingerprints'
import { storageGet } from '@/lib/storage'
import { celebrationData, dismissCelebration, dismissWelcome, openWalkthroughChapter, pendingDrill, selectedWalkthrough, setActiveTab, setActiveUserSession, setBpm, setEditorView, setInstrument, setKeyName, setPendingDrill, setPlaybackSpeed, setScaleType, showSelection, walkthroughModalOpen, } from '@/stores'
import { activeTab as activeTabSignal, appStore, bpm, countIn, editorView, endPracticeSession, focusMode as focusModeSignal, getNoteAccuracyMap, getSessionHistory, hideLibrary, hideSessionLibrary, hideSessionPresetsLibrary, initTheme, isLibraryModalOpen as isLibraryModalOpenSignal, isSessionLibraryModalOpen as isSessionLibraryModalOpenSignal, keyName as keyNameSignal, micActive, openLearningWalkthrough, playbackSpeed, scaleType as scaleTypeSignal, sessionActive, sessionMode, showNotification, showSessionBrowser, showSessionPresetsLibrary, showWelcome, startWalkthrough, toggleMicWaveVisible, } from '@/stores'
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
import { FallingNotesCanvas } from './components/FallingNotesCanvas'
import { FallingNotesSongPicker } from './components/FallingNotesSongPicker'
import { GuideSelection } from './components/GuideSelection'
import { JamPanel } from './components/jam/JamPanel'
import { TabErrorBoundary } from './components/TabErrorBoundary'
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

const AppShell: Component<AppProps> = (props) => {
  const { audioEngine, playbackRuntime, practiceEngine } = useEngines()

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

  const [showScaleBuilder, setShowScaleBuilder] = createSignal(false)
  const [savedVol, setSavedVol] = createSignal<number>(80)
  const [analysisSubTab, setAnalysisSubTab] = createSignal<
    'vocal' | 'detection' | 'algorithms'
  >('vocal')

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
  }
  const handleQuickStart = (type: ExerciseType) => {
    setSelectedExercise(type)
    setAutoStartExercise(true)
  }

  // Auto-launch exercise drill from challenge "Practice" button
  createEffect(() => {
    const drill = pendingDrill()
    if (drill && activeTab() === TAB_EXERCISES) {
      setSelectedExercise(drill.exercise)
    }
  })

  // ── Guide Selection dialog ──────────────────────────────────
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
      ]

      let availableTabs = TABS_ORDER
      if (!advancedFeaturesEnabled()) {
        availableTabs = TABS_ORDER.filter(
          (t) =>
            t !== TAB_COMMUNITY &&
            t !== TAB_LEADERBOARD &&
            t !== TAB_CHALLENGES &&
            t !== TAB_PITCH_TEST &&
            t !== TAB_PITCH_ALGO,
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

        // 3. Clear any active walkthroughs if switching away from study-related tabs
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
      }
    }

    // Saved volume
    const vol = parseInt(storageGet('pp_volume', '80')!, 10)
    setSavedVol(isNaN(vol) ? 80 : vol)

    // Wire runtime events
    setupRuntimeEvents()

    props.onMounted?.()
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
                      <Suspense fallback={<div class="tab-loading" />}>
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
                  <div
                    class="analysis-container"
                    style="display: flex; flex-direction: column; width: 100%; height: 100%;"
                  >
                    <div
                      class="analysis-tabs"
                      style="display: flex; gap: 1rem; padding: 1rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);"
                    >
                      <button
                        class={styles.viewBtn}
                        classList={{
                          [styles.activeViewBtn]: analysisSubTab() === 'vocal',
                        }}
                        onClick={() => setAnalysisSubTab('vocal')}
                        aria-label="Vocal Analysis"
                        title="Vocal Analysis"
                      >
                        <Voice /> Vocal Analysis
                      </button>
                      <button
                        class={styles.viewBtn}
                        classList={{
                          [styles.activeViewBtn]:
                            analysisSubTab() === 'detection',
                        }}
                        onClick={() => setAnalysisSubTab('detection')}
                        aria-label="Pitch Detection"
                        title="Pitch Detection"
                      >
                        <Ear /> Pitch Detection
                      </button>
                      <button
                        class={styles.viewBtn}
                        classList={{
                          [styles.activeViewBtn]:
                            analysisSubTab() === 'algorithms',
                        }}
                        onClick={() => setAnalysisSubTab('algorithms')}
                        aria-label="Pitch Algorithms"
                        title="Pitch Algorithms"
                      >
                        <Cpu /> Pitch Algorithms
                      </button>
                    </div>

                    <div
                      class="analysis-content"
                      style="flex: 1; overflow: hidden; position: relative;"
                    >
                      <Show when={analysisSubTab() === 'vocal'}>
                        <div
                          class="vocal-analysis-panel"
                          style="width: 100%; height: 100%;"
                        >
                          <Suspense fallback={<div class="tab-loading" />}>
                            <VocalAnalysis />
                          </Suspense>
                        </div>
                      </Show>
                      <Show when={analysisSubTab() === 'detection'}>
                        <PitchTestingTab
                          onClose={() => setActiveTab(TAB_SINGING)}
                        />
                      </Show>
                      <Show when={analysisSubTab() === 'algorithms'}>
                        <PitchAlgorithmTester
                          onClose={() => setActiveTab(TAB_SINGING)}
                        />
                      </Show>
                    </div>
                  </div>
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_JAM}>
                <TabErrorBoundary tabName={tabLabel(TAB_JAM)}>
                  <div id="jam-panel">
                    <JamPanel />
                  </div>
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_COMMUNITY}>
                <TabErrorBoundary tabName={tabLabel(TAB_COMMUNITY)}>
                  <div class="community-panel">
                    <Suspense fallback={<div class="tab-loading" />}>
                      <CommunityShare />
                    </Suspense>
                  </div>
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_LEADERBOARD}>
                <TabErrorBoundary tabName={tabLabel(TAB_LEADERBOARD)}>
                  <div class="leaderboard-panel">
                    <Suspense fallback={<div class="tab-loading" />}>
                      <CommunityLeaderboard
                        onOpenChallenges={() => setActiveTab(TAB_CHALLENGES)}
                      />
                    </Suspense>
                  </div>
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_CHALLENGES}>
                <TabErrorBoundary tabName={tabLabel(TAB_CHALLENGES)}>
                  <div class="vocal-challenges-panel">
                    <Suspense fallback={<div class="tab-loading" />}>
                      <VocalChallenges />
                    </Suspense>
                  </div>
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_EXERCISES}>
                <TabErrorBoundary tabName={tabLabel(TAB_EXERCISES)}>
                  <div id="exercises-panel">
                    <Show
                      when={selectedExercise()}
                      fallback={
                        <ExerciseMenu
                          onSelect={(type) => setSelectedExercise(type)}
                          onQuickStart={handleQuickStart}
                        />
                      }
                    >
                      <Show when={selectedExercise() === 'long-note'}>
                        <LongNoteExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                      <Show when={selectedExercise() === 'vibrato'}>
                        <VibratoExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                      <Show when={selectedExercise() === 'slide'}>
                        <SlideExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                      <Show when={selectedExercise() === 'pitch-hold'}>
                        <PitchHoldExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                      <Show when={selectedExercise() === 'mirror-melody'}>
                        <MirrorMelodyExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                      <Show when={selectedExercise() === 'pitch-pursuit'}>
                        <PitchPursuitExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                      <Show when={selectedExercise() === 'interval-trainer'}>
                        <IntervalTrainerExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                      <Show when={selectedExercise() === 'scale-runner'}>
                        <ScaleRunnerExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                      <Show when={selectedExercise() === 'arpeggio-jumper'}>
                        <ArpeggioJumperExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                      <Show when={selectedExercise() === 'drone-intonation'}>
                        <DroneIntonationExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                      <Show when={selectedExercise() === 'siren'}>
                        <SirenExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                      <Show when={selectedExercise() === 'call-response'}>
                        <CallResponseExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                      <Show when={selectedExercise() === 'dynamic-swell'}>
                        <DynamicSwellExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                      <Show when={selectedExercise() === 'chord-stacker'}>
                        <ChordStackerExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                      <Show when={selectedExercise() === 'staccato-precision'}>
                        <StaccatoPrecisionExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                      <Show when={selectedExercise() === 'routine-runner'}>
                        <RoutineRunnerExercise
                          audioEngine={audioEngine}
                          practiceEngine={practiceEngine}
                          onBack={clearExercise}
                          autoStart={autoStartExercise()}
                        />
                      </Show>
                    </Show>
                  </div>
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_SETTINGS}>
                <TabErrorBoundary tabName={tabLabel(TAB_SETTINGS)}>
                  <div id="settings-panel">
                    <SettingsPanel />
                  </div>
                </TabErrorBoundary>
              </Show>

              <Show when={activeTab() === TAB_KARAOKE}>
                <TabErrorBoundary tabName={tabLabel(TAB_KARAOKE)}>
                  <div id="uvr-panel">
                    <Suspense fallback={<div class="tab-loading" />}>
                      <UvrPanel
                        initialView={initialUvrView() ?? 'upload'}
                        initialSessionId={initialUvrSessionId() ?? undefined}
                        onSessionChange={(sessionId) =>
                          setActiveUvrSessionId(sessionId)
                        }
                        onViewChange={(view) => setActiveUvrView(view)}
                        onSelectMelody={(melodyId) => {
                          melodyStore.loadMelody(melodyId)
                          setActiveTab(TAB_SINGING)
                        }}
                        onPracticeStart={(mode) => {
                          console.log('Starting practice with mode:', mode)
                        }}
                        onExport={(type) => {
                          console.log('Exporting:', type)
                        }}
                        onSessionView={(sessionId) => {
                          console.log('Viewing session:', sessionId)
                        }}
                      />
                    </Suspense>
                  </div>
                </TabErrorBoundary>
              </Show>
              <Show when={activeTab() === TAB_PIANO}>
                <TabErrorBoundary tabName={tabLabel(TAB_PIANO)}>
                  <div id="falling-notes-panel">
                    <SharedControlToolbar
                      activeTab={activeTab}
                      pianoTab={() => activeTab() === TAB_PIANO}
                      isPlaying={pianoIsPlaying}
                      isPaused={pianoIsPaused}
                      onPlay={() => {
                        // Fresh user-triggered Play resets cycle counter
                        if (fallingNotes.gameState() !== 'paused') {
                          fallingNotes.setPianoCurrentCycle(1)
                        }
                        void fallingNotes.startGame()
                      }}
                      onPause={fallingNotes.pauseGame}
                      onResume={fallingNotes.resumeGame}
                      onStop={fallingNotes.resetGame}
                      volume={savedVol}
                      onVolumeChange={(vol) => {
                        setSavedVol(vol)
                        audioEngine?.setVolume(vol / 100)
                      }}
                      speed={fallingNotes.speed()}
                      onSpeedChange={fallingNotes.setSpeed}
                      metronomeEnabled={() => false}
                      onMetronomeToggle={() => {}}
                      playMode={() =>
                        fallingNotes.pianoPlayMode() === 'repeat'
                          ? PLAYBACK_MODE_REPEAT
                          : PLAYBACK_MODE_ONCE
                      }
                      playModeChange={(mode) => {
                        fallingNotes.setPianoPlayMode(
                          mode === PLAYBACK_MODE_REPEAT ? 'repeat' : 'once',
                        )
                        if (mode === PLAYBACK_MODE_REPEAT) {
                          fallingNotes.setPianoCurrentCycle(1)
                        }
                      }}
                      practiceCycles={() => fallingNotes.pianoRepeatCycles()}
                      onCyclesChange={(n) =>
                        fallingNotes.setPianoRepeatCycles(n)
                      }
                      currentCycle={() => fallingNotes.pianoCurrentCycle()}
                      practiceSubMode={() => 'all' as const}
                      onPracticeSubModeChange={() => {}}
                      isCountingIn={() => fallingNotes.isCountingIn()}
                      countInBeat={() => fallingNotes.countInBeat()}
                      countInBeats={() => countIn()}
                      onMicToggle={() => {
                        if (fallingNotes.isMicActive()) {
                          fallingNotes.stopMic()
                        } else {
                          void fallingNotes.startMic()
                        }
                      }}
                      inputMode={fallingNotes.inputMode}
                      midiConnected={fallingNotes.midiConnected}
                      onMidiToggle={() => {
                        if (fallingNotes.midiConnected()) {
                          fallingNotes.midiDisconnect()
                        } else {
                          void fallingNotes.midiConnect()
                        }
                      }}
                      zoomLevel={fallingNotes.zoomPercent}
                      onZoomIn={fallingNotes.zoomIn}
                      onZoomOut={fallingNotes.zoomOut}
                      showNoteLabels={fallingNotes.showNoteLabels}
                      onToggleNoteLabels={fallingNotes.toggleNoteLabels}
                      bpmValue={fallingNotes.currentSongBpm}
                      onBpmChange={fallingNotes.setBpm}
                    />
                    <FallingNotesSongPicker
                      onSongLoaded={fallingNotes.loadSong}
                    />
                    <div id="falling-notes-canvas-container">
                      <FallingNotesCanvas
                        songNotes={fallingNotes.songNotes}
                        gameState={fallingNotes.gameState}
                        playheadBeat={fallingNotes.playheadBeat}
                        hitResults={fallingNotes.hitResults}
                        combo={fallingNotes.combo}
                        score={fallingNotes.score}
                        totalNotes={fallingNotes.totalNotes}
                        notesMissed={fallingNotes.notesMissed}
                        currentPitch={fallingNotes.currentPitch}
                        isMicActive={fallingNotes.isMicActive}
                        inputMode={fallingNotes.inputMode}
                        visibleBeatWindow={fallingNotes.visibleBeatWindow}
                        midiHeldNotes={fallingNotes.midiHeldNotes}
                        onClickPianoOn={fallingNotes.clickPianoNoteOn}
                        onClickPianoOff={fallingNotes.clickPianoNoteOff}
                        clickPianoEnabled={fallingNotes.clickPianoEnabled}
                      />
                    </div>
                    {/* Score overlay for finished game */}
                    <Show when={fallingNotes.gameState() === 'finished'}>
                      <div class="fn-score-overlay">
                        <div class="fn-score-card">
                          <h2>Complete!</h2>
                          <div class="fn-score-grade">
                            {(() => {
                              const s = fallingNotes.score()
                              const t = fallingNotes.totalNotes()
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
                          <div class="fn-score-pct">
                            {fallingNotes.totalNotes() > 0
                              ? Math.round(
                                  (fallingNotes.score() /
                                    (fallingNotes.totalNotes() * 100)) *
                                    100,
                                )
                              : 0}
                            %
                          </div>
                          <div class="fn-score-detail">
                            {fallingNotes.totalNotes()} notes · Max Combo:{' '}
                            {fallingNotes.maxCombo()}x
                          </div>
                          <div class="fn-score-actions">
                            <button
                              class="fn-btn fn-btn-play"
                              onClick={() => void fallingNotes.startGame()}
                              aria-label="Play again"
                              title="Play again"
                            >
                              <RotateCcw /> Play Again
                            </button>
                            <button
                              class="fn-btn fn-btn-close"
                              onClick={fallingNotes.resetGame}
                              aria-label="Close"
                              title="Close"
                            >
                              <X /> Close
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
                  <RotateCcw /> Try Again
                </button>
                <button
                  class={styles.overlayBtn}
                  onClick={closeScoreOverlay}
                  aria-label="Close"
                  title="Close"
                >
                  <X /> Close
                </button>
              </div>

              <Show when={getSessionHistory().length > 1}>
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
          <Suspense fallback={<div class="tab-loading" />}>
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
