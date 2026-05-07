// ============================================================
// App — Main SolidJS application entry
// v3 refactor: thin shell using providers + controllers
// ============================================================

import type { Component } from 'solid-js'
import { For } from 'solid-js'
import { createEffect, createMemo, createSignal, onMount, Show } from 'solid-js'
import { VocalAnalysis, VocalChallenges } from '@/components'
import { AppSidebar } from '@/components/AppSidebar'
import { CommunityLeaderboard } from '@/components/CommunityLeaderboard'
import { CommunityShare } from '@/components/CommunityShare'
import { FocusMode } from '@/components/FocusMode'
import { HistoryCanvas } from '@/components/HistoryCanvas'
import { LibraryModal } from '@/components/LibraryModal'
import { Notifications } from '@/components/Notifications'
import { PianoRollCanvas } from '@/components/PianoRollCanvas'
import { PitchCanvas } from '@/components/PitchCanvas'
import { ScaleBuilder } from '@/components/ScaleBuilder'
import { SessionBrowser } from '@/components/SessionBrowser'
import { SessionEditor } from '@/components/SessionEditor'
import { SessionLibraryModal } from '@/components/SessionLibraryModal'
import { SessionPlayer } from '@/components/SessionPlayer'
import { SettingsPanel } from '@/components/SettingsPanel'
import type { PracticeSubMode } from '@/components/shared/SharedControlToolbar'
import { SharedControlToolbar } from '@/components/shared/SharedControlToolbar'
import { UvrPanel } from '@/components/UvrPanel'
import { EngineProvider, useEngines } from '@/contexts/EngineContext'
import { useEditorController } from '@/features/editor/useEditorController'
import { usePianoRollEvents } from '@/features/events/usePianoRollEvents'
import { useKeyboardShortcuts } from '@/features/keyboard/useKeyboardShortcuts'
import { usePlaybackController } from '@/features/playback/usePlaybackController'
import { usePracticeController } from '@/features/practice/usePracticeController'
import { useRecordingController } from '@/features/recording/useRecordingController'
import { useSessionSequencer } from '@/features/session/useSessionSequencer'
import type { InstrumentType } from '@/lib/audio-engine'
import { audioRegistry } from '@/lib/audio-registry'
import { debounce } from '@/lib/debounce'
import { registerE2EBridge } from '@/lib/e2e-bridge'
import { buildHash, parseHash, replaceHash } from '@/lib/hash-router'
import { melodyIndexAtBeat, melodyTotalBeats } from '@/lib/scale-data'
import { buildScaleMelody, buildSessionPlaybackMelody, } from '@/lib/session-builder'
import { hasSharedPresetInURL, loadFromURL } from '@/lib/share-url'
import { setActiveTab, setActiveUserSession, setBpm, setEditorView, setInstrument, setKeyName, setPlaybackSpeed, setScaleType, } from '@/stores'
import { activeTab as activeTabSignal, appStore, bpm, countIn, editorView, endPracticeSession, focusMode as focusModeSignal, getNoteAccuracyMap, getSessionHistory, hideLibrary, hideSessionLibrary, hideSessionPresetsLibrary, initBpm, initPresets, initReverb, initSessionHistory, initSettings, initTheme, isLibraryModalOpen as isLibraryModalOpenSignal, isSessionLibraryModalOpen as isSessionLibraryModalOpenSignal, keyName as keyNameSignal, micActive, openLearningWalkthrough, playbackSpeed, scaleType as scaleTypeSignal, sessionActive, sessionMode, showNotification, showSessionBrowser, showSessionPresetsLibrary, showWelcome, startWalkthrough, toggleMicWaveVisible, } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import { getSession, templateToSession } from '@/stores/session-store'
import { selectedCharacter } from '@/stores/settings-store'
import type { ActiveTab, MelodyItem, PlaybackMode, SpacedRestMode, } from '@/types'
import { Walkthrough, WalkthroughControl } from './components'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { CrashModal } from './components/CrashModal'
import { GuideSelection } from './components/GuideSelection'
import { WelcomeScreen } from './components/WelcomeScreen'
import { _UvrGuideStyles } from './components/UvrGuide'
import { LyricsUploaderStyles, StemMixerStyles, UvrPanelStyles, UvrUploadControlStyles, UvrProcessControlStyles, UvrResultViewerStyles, UvrSessionResultStyles, } from './components'

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
  const toggleSidebar = () => setSidebarOpen(sidebarOpen() === false)
  const closeSidebar = () => setSidebarOpen(false)
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false)

  const [showScaleBuilder, setShowScaleBuilder] = createSignal(false)
  const [savedVol, setSavedVol] = createSignal<number>(80)
  const [metronomeEnabled, setMetronomeEnabled] = createSignal(false)

  // ── Play mode ───────────────────────────────────────────────
  const [playMode, setPlayMode] = createSignal<PlaybackMode>('once')
  const [repeatCycles, setRepeatCycles] = createSignal<number>(5)
  const [currentRepeat, setCurrentRepeat] = createSignal<number>(1)
  const [practiceSubMode, setPracticeSubMode] =
    createSignal<PracticeSubMode>('all')
  const [spacedRestMode, setSpacedRestMode] =
    createSignal<SpacedRestMode>('none')

  // Hash routing — prevents effect loop when hash is being updated from code
  let hashSyncing = false
  const [initialUvrSessionId, setInitialUvrSessionId] = createSignal<string | null>(null)

  // ── Guide Selection dialog ──────────────────────────────────
  const [showGuideSelection, setShowGuideSelection] = createSignal(false)
  const openGuideSelection = () => setShowGuideSelection(true)
  const closeGuideSelection = () => setShowGuideSelection(false)
  const startGuideTour = (sectionIds: string[]) => {
    closeGuideSelection()
    startWalkthrough(sectionIds)
  }

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
      playMode() === 'once'
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
    activePlaybackItems,
    totalBeats,
    playheadPosition,
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

  // ── Editor controller ──────────────────────────────────────
  // Handlers (handleShare, handleExportMIDI, handleImportMIDI) are exposed
  // for future toolbar integration. Currently unused at the App level.
  useEditorController({ audioEngine })

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

  // ── Tab change handler with audio cleanup ──────────────────
  const handleTabChange = async (newTab: ActiveTab) => {
    const currentTab = activeTab()
    if (currentTab === 'practice' || currentTab === 'editor') {
      await resetPlaybackState()
    }
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
    if (newOctave < 1 || newOctave > 6) return

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
    if (mode === 'repeat') {
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
      const isRestItem = (item as { isRest?: boolean }).isRest === true

      if (!isRestItem) {
        setTargetPitch(item.note.freq)
        if (activeTab() === 'practice') {
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
        // Pass the per-note effectType (vibrato/slide-up/etc) through to
        // audioEngine so effects on session/editor playback are audible.
        // We MUST call this as a method (audioEngine.playTone(...)) — extracting
        // it into a local variable loses `this` binding and produces:
        //   "TypeError: can't access property 'init', this is undefined"
        // because playTone internally calls this.init() / this.audioCtx.
        void (
          audioEngine.playTone as unknown as (
            this: typeof audioEngine,
            freq: number,
            duration?: number,
            effectType?: string,
          ) => Promise<void> | void
        ).call(
          audioEngine,
          item.note.freq,
          noteDurationMs,
          (item as { effectType?: string }).effectType,
        )
      }
    })

    playbackRuntime.on('beat', (e: { beat?: number }) => {
      const beat = e.beat ?? 0
      const noteIndex = melodyIndexAtBeat(activePlaybackItems(), beat)
      melodyStore.setCurrentNoteIndex(noteIndex)
    })

    playbackRuntime.setMetronomeEnabled(metronomeEnabled)

    playbackRuntime.on(
      'metronome',
      // eslint-disable-next-line solid/reactivity
      (e: { beat?: number; isDownbeat?: boolean }) => {
        const isCounting =
          playbackRuntime.getCountIn() > 0 &&
          playbackRuntime.getCurrentBeat() < playbackRuntime.getCountIn()
        if (isCounting || metronomeEnabled() === true) {
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
      if (sessionModeValue === true && mode === 'practice') {
        handleSessionItemComplete()
        return
      }

      if (mode === 'repeat') {
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
    initBpm()
    initPresets()
    initSessionHistory()
    initSettings()
    initReverb()

    // ── Hash routing: initial load ──────────────────────────
    const initialRoute = parseHash(window.location.hash)
    if (initialRoute.type === 'tab') {
      setActiveTab(initialRoute.tab)
    } else if (initialRoute.type === 'uvr-session') {
      setActiveTab('uvr')
      setInitialUvrSessionId(initialRoute.sessionId)
    }

    // ── Hash routing: back/forward navigation ───────────────
    window.addEventListener('hashchange', () => {
      const route = parseHash(window.location.hash)
      hashSyncing = true
      if (route.type === 'tab') {
        setActiveTab(route.tab)
      } else if (route.type === 'uvr-session') {
        setActiveTab('uvr')
        setInitialUvrSessionId(route.sessionId)
      }
      hashSyncing = false
    })

    // Inject UVR component styles
    const styleElements = [
      LyricsUploaderStyles,
      StemMixerStyles,
      UvrPanelStyles,
      UvrUploadControlStyles,
      UvrProcessControlStyles,
      UvrResultViewerStyles,
      UvrSessionResultStyles,
      _UvrGuideStyles,
    ]

    styleElements.forEach((styleString) => {
      if (typeof styleString === 'string' && styleString.trim()) {
        const style = document.createElement('style')
        style.textContent = styleString
        document.head.appendChild(style)
      }
    })

    melodyStore.seedDefaultSession()

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
    const vol = parseInt(localStorage.getItem('pp_volume') ?? '80', 10)
    setSavedVol(isNaN(vol) ? 80 : vol)

    // Wire runtime events
    setupRuntimeEvents()

    props.onMounted?.()
  })

  // ── Hash routing: sync activeTab → URL hash ───────────────
  createEffect(() => {
    if (hashSyncing) return
    const tab = activeTab()
    const expectedHash = `#/${tab}`
    if (window.location.hash !== expectedHash) {
      replaceHash({ type: 'tab', tab })
    }
  })

  // ============================================================
  // Render
  // ============================================================

  return (
    <div id="app">
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

      <Show when={sidebarOpen()}>
        <div class="sidebar-backdrop" onClick={closeSidebar} />
      </Show>

      <button class="sidebar-toggle-btn" onClick={toggleSidebar} title="Menu">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path
            fill="currentColor"
            d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"
          />
        </svg>
        Menu
      </button>

      <Show when={!focusMode()}>
        <header>
          <div class="header-left">
            <button
              id="app-title"
              class="logo-btn"
              onClick={() => void handleTabChange('practice')}
              title="Go to Practice"
            >
              <h1 class="app-title">PitchPerfect</h1>
            </button>
            <p class="subtitle">Voice Pitch Practice</p>
          </div>
          <div class="header-right">
            {/* Current melody indicator pill */}
            <Show when={melodyStore.getCurrentMelody()}>
              <button
                class="melody-indicator-pill"
                onClick={() => void handleTabChange('practice')}
                title={`Now loaded: ${melodyStore.getCurrentMelody()?.name ?? 'Untitled'}`}
              >
                <svg
                  class="melody-indicator-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                <span class="melody-indicator-info">
                  <span class="melody-indicator-name">
                    {melodyStore.getCurrentMelody()?.name ?? 'Untitled'}
                  </span>
                  <span class="melody-indicator-character">
                    {selectedCharacter()}
                  </span>
                </span>
              </button>
            </Show>
            {/* Walkthrough Control Button */}
            <WalkthroughControl
              showOnStart={false}
              onOpenGuide={openGuideSelection}
            />
          </div>
          <nav id="app-tabs">
            <button
              id="tab-practice"
              class={`app-tab ${activeTab() === 'practice' ? 'active' : ''}`}
              onClick={() => void handleTabChange('practice')}
            >
              Practice
            </button>
            <button
              id="tab-editor"
              class={`app-tab ${activeTab() === 'editor' ? 'active' : ''}`}
              onClick={() => void handleTabChange('editor')}
            >
              Editor
              <Show when={melodyStore.items().length > 0}>
                <span class="tab-badge">{melodyStore.items().length}</span>
              </Show>
            </button>
            <button
              id="tab-vocal-analysis"
              class={`app-tab ${activeTab() === 'vocal-analysis' ? 'active' : ''}`}
              onClick={() => void handleTabChange('vocal-analysis')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="currentColor"
                  d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                />
              </svg>
              Analysis
            </button>
            <button
              id="tab-community"
              class={`app-tab ${activeTab() === 'community' ? 'active' : ''}`}
              onClick={() => void handleTabChange('community')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="currentColor"
                  d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                />
              </svg>
              Community
            </button>
            <button
              id="tab-leaderboard"
              class={`app-tab ${activeTab() === 'leaderboard' ? 'active' : ''}`}
              onClick={() => void handleTabChange('leaderboard')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="currentColor"
                  d="M5 3H3v18h2V3zm4 0H7v18h2V3zm4 0h-2v18h2V3zm4 0h-2v18h2V3zm4 0h-2v18h2V3z"
                />
              </svg>
              Leaderboard
            </button>
            <button
              id="tab-vocal-challenges"
              class={`app-tab ${activeTab() === 'vocal-challenges' ? 'active' : ''}`}
              onClick={() => void handleTabChange('vocal-challenges')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="currentColor"
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                />
              </svg>
              Challenges
            </button>
            <button
              id="tab-uvr"
              class={`app-tab ${activeTab() === 'uvr' ? 'active' : ''}`}
              onClick={() => void handleTabChange('uvr')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              Vocal Sep
            </button>
            <button
              id="tab-settings"
              class={`app-tab ${activeTab() === 'settings' ? 'active' : ''}`}
              onClick={() => void handleTabChange('settings')}
            >
              Settings
            </button>
          </nav>
        </header>

        {/* Main layout: sidebar + content */}
        <div class="main-layout" id="main-layout">
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
            onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
          />

          {/* Tab content */}
          <div class="main-content">
            <Show when={activeTab() === 'practice'}>
              {/* Practice panel */}
              <div id="practice-panel">
                {/* Shared control toolbar with practice-specific options */}
                <SharedControlToolbar
                  activeTab={activeTab}
                  practiceTab={() => activeTab() === 'practice'}
                  editorTab={() => activeTab() === 'editor'}
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
                    isPlaying={isPlaying}
                    isPaused={isPaused}
                    isScrolling={() => false}
                    targetPitch={targetPitch}
                    noteAccuracyMap={noteAccuracyMap}
                    isRecording={recording.isRecording}
                    getWaveform={() => audioEngine?.getWaveformData() ?? null}
                    noteResults={noteResults}
                  />
                  <div
                    id="playhead"
                    style={{
                      display: isPlaying() || isPaused() ? 'block' : 'none',
                      left: `${playheadPosition()}%`,
                    }}
                  >
                    <div class="playhead-marker" style={{ left: '0' }} />
                  </div>
                </div>

                <div id="history-container">
                  <HistoryCanvas
                    frequencyData={frequencyData}
                    waveformData={waveformData}
                    liveScore={liveScore}
                  />
                </div>
              </div>
            </Show>

            <Show when={activeTab() === 'editor'}>
              <SharedControlToolbar
                activeTab={activeTab}
                editorTab={() => activeTab() === 'editor'}
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
                playMode={() => 'once'}
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
                onMicToggle={() => {
                  void handleMicToggle()
                }}
                onWaveToggle={toggleMicWaveVisible}
              />

              <div class="editor-view-toggle">
                <button
                  class={`view-btn ${editorView() === 'piano-roll' ? 'active' : ''}`}
                  onClick={() => setEditorView('piano-roll')}
                >
                  Piano Roll
                </button>
                <button
                  class={`view-btn ${editorView() === 'session-editor' ? 'active' : ''}`}
                  onClick={() => setEditorView('session-editor')}
                >
                  Session Editor
                </button>
              </div>

              <Show when={editorView() === 'session-editor'}>
                <div class="session-editor-container">
                  <SessionEditor />
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
                    audioRegistry.setInstrumentAll(instrument)
                    setInstrument(instrument as InstrumentType)
                  }}
                  onPlaybackStateChange={(_state) => {
                    // editor playback state owned by playbackController now
                  }}
                  getWaveform={() => audioEngine?.getWaveformData() ?? null}
                />
              </Show>
            </Show>

            <Show when={activeTab() === 'vocal-analysis'}>
              <div class="vocal-analysis-panel">
                <VocalAnalysis />
              </div>
            </Show>

            <Show when={activeTab() === 'community'}>
              <div class="community-panel">
                <CommunityShare />
              </div>
            </Show>

            <Show when={activeTab() === 'leaderboard'}>
              <div class="leaderboard-panel">
                <CommunityLeaderboard />
              </div>
            </Show>

            <Show when={activeTab() === 'vocal-challenges'}>
              <div class="vocal-challenges-panel">
                <VocalChallenges />
              </div>
            </Show>

            <Show when={activeTab() === 'settings'}>
              <div id="settings-panel">
                <SettingsPanel />
              </div>
            </Show>

            <Show when={activeTab() === 'uvr'}>
              <div id="uvr-panel">
                <UvrPanel
                  defaultView="upload"
                  initialSessionId={initialUvrSessionId() ?? undefined}
                  onPracticeStart={(mode) => {
                    // For now, this could load a session from UVR
                    console.log('Starting practice with mode:', mode)
                  }}
                  onExport={(type) => {
                    console.log('Exporting:', type)
                  }}
                  onSessionView={(sessionId) => {
                    console.log('Viewing session:', sessionId)
                  }}
                />
              </div>
            </Show>
          </div>
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
      <Show when={practiceResult() !== null}>
        <div class="overlay" onClick={closeScoreOverlay}>
          <div
            id="score-card"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <button class="overlay-close" onClick={closeScoreOverlay}>
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
              <div class="score-stat score-stat-perfect">
                <div class="score-stat-value">
                  {
                    (noteResults() ?? []).filter((r) => r.rating === 'perfect')
                      .length
                  }
                </div>
                <div class="score-stat-label">Perfect</div>
              </div>
              <div class="score-stat score-stat-excellent">
                <div class="score-stat-value">
                  {
                    (noteResults() ?? []).filter(
                      (r) => r.rating === 'excellent',
                    ).length
                  }
                </div>
                <div class="score-stat-label">Excellent</div>
              </div>
              <div class="score-stat score-stat-good">
                <div class="score-stat-value">
                  {
                    (noteResults() ?? []).filter((r) => r.rating === 'good')
                      .length
                  }
                </div>
                <div class="score-stat-label">Good</div>
              </div>
              <div class="score-stat score-stat-okay">
                <div class="score-stat-value">
                  {
                    (noteResults() ?? []).filter((r) => r.rating === 'okay')
                      .length
                  }
                </div>
                <div class="score-stat-label">Okay</div>
              </div>
              <div class="score-stat score-stat-off">
                <div class="score-stat-value">
                  {
                    (noteResults() ?? []).filter((r) => r.rating === 'off')
                      .length
                  }
                </div>
                <div class="score-stat-label">Off</div>
              </div>
            </div>
            <div id="score-actions">
              <button
                class="overlay-btn primary"
                onClick={() => {
                  closeScoreOverlay()
                  handleReset()
                  handlePlay()
                }}
              >
                Try Again
              </button>
              <button class="overlay-btn" onClick={closeScoreOverlay}>
                Close
              </button>
            </div>

            <Show when={getSessionHistory().length > 1}>
              <div id="score-history">
                <h3 class="history-title">Recent Progress</h3>
                <div class="history-chart">
                  <For each={getSessionHistory().slice(0, 10)}>
                    {(session) => (
                      <div
                        class="history-bar"
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        style={{ height: `${(session as any).score}%` }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        title={`Score: ${(session as any).score}%`}
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

      <Show when={sessionSummary() !== null}>
        <div class="overlay" onClick={() => setSessionSummary(null)}>
          <div
            id="session-summary-card"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <button
              class="overlay-close"
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
                class="overlay-btn primary"
                onClick={() => {
                  setSessionSummary(null)
                  showSessionPresetsLibrary()
                }}
              >
                New Session
              </button>
              <button
                class="overlay-btn"
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
        <SessionLibraryModal isOpen={true} close={() => hideSessionLibrary()} />
      </Show>

      <Show when={showSessionBrowser()}>
        <SessionBrowser
          onClose={hideSessionPresetsLibrary}
          onStartSession={(template) => {
            // 1. Try to find the session in the library (if user previously saved/edited it)
            // 2. Otherwise, convert the template to a regular session object
            const practiceSess =
              getSession(template.id) ?? templateToSession(template)

            // Path B (SessionBrowser template start). Set the active
            // session, then trigger the unified session-sequence path
            // by passing an empty `ids` array so playSessionSequence
            // falls back to userSession() which we just set.
            setActiveUserSession(practiceSess)
            playSessionSequence([])
            hideSessionPresetsLibrary()
          }}
        />
      </Show>
    </div>
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
