// ============================================================
// App — Main SolidJS application entry
// Matches the original JS app's HTML structure exactly
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { AppSidebar } from '@/components/AppSidebar'
import { FocusMode } from '@/components/FocusMode'
import { HistoryCanvas } from '@/components/HistoryCanvas'
import { LibraryModal } from '@/components/LibraryModal'
import { _MelodyPillList } from '@/components/MelodyPillList'
import { Notifications } from '@/components/Notifications'
import { PianoRollCanvas } from '@/components/PianoRollCanvas'
import { PitchCanvas } from '@/components/PitchCanvas'
import { PresetsLibraryModal } from '@/components/PresetsLibraryModal'
import { ScaleBuilder } from '@/components/ScaleBuilder'
import { SessionBrowser } from '@/components/SessionBrowser'
import { SessionEditor } from '@/components/SessionEditor'
import { SessionLibraryModal } from '@/components/SessionLibraryModal'
import { SessionPlayer } from '@/components/SessionPlayer'
import { SettingsPanel } from '@/components/SettingsPanel'
import type { PracticeSubMode } from '@/components/shared/SharedControlToolbar'
import { SharedControlToolbar } from '@/components/shared/SharedControlToolbar'
import { WalkthroughControl } from '@/components/WalkthroughControl'
import { _WelcomeScreen } from '@/components/WelcomeScreen'
import type { InstrumentType } from '@/lib/audio-engine'
import { AudioEngine } from '@/lib/audio-engine'
import { debounce } from '@/lib/debounce'
import { downloadMIDI, importMelodyFromMIDI } from '@/lib/piano-roll'
import { PlaybackRuntime } from '@/lib/playback-runtime'
import { PracticeEngine } from '@/lib/practice-engine'
import { melodyIndexAtBeat } from '@/lib/scale-data'
import { buildMultiOctaveScale, keyTonicFreq, melodyTotalBeats, midiToNote, } from '@/lib/scale-data'
import { generateShareURL, hasSharedPresetInURL, loadFromURL, } from '@/lib/share-url'
import { appStore, getNoteAccuracyMap } from '@/stores/app-store'
import { getActiveSessionId, melodyStore } from '@/stores/melody-store'
import { getSessionStore } from '@/stores/session-store'
import { addItemToSession } from '@/stores/session-store'
import { playback } from '@/stores/playback-store'
import type { PitchSample } from '@/types'
import type { MelodyItem, NoteName, NoteResult, PitchResult, PracticeResult, } from '@/types'
import type { PlaybackState } from '@/types'

// ── Engine instances (single shared) ────────────────────────

let audioEngine: AudioEngine
let playbackRuntime: PlaybackRuntime
let practiceEngine: PracticeEngine

/** Filter melody items based on practice sub-mode */
function filterMelodyForPractice(
  melody: MelodyItem[],
  subMode: PracticeSubMode,
): MelodyItem[] {
  if (subMode === 'all') return melody

  if (subMode === 'reverse') {
    return [...melody].reverse().map((item) => ({
      ...item,
      startBeat: 0, // Reset timing — will be recalculated by engine
    }))
  }

  if (subMode === 'random') {
    // Keep ~50% of notes, preserving their timing
    return melody.filter(() => Math.random() >= 0.5)
  }

  if (subMode === 'focus') {
    // Use session history to find worst-performing notes
    const history = appStore.sessionHistory()
    if (history.length === 0) return melody // No history — practice all

    // Find notes with the most errors
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

    // Include notes that appear in error counts (the "problem" notes)
    const errorIndices = new Set(errorCounts.keys())
    return melody.filter((_, i) => errorIndices.has(i))
  }

  return melody
}

// ============================================================
// Tab type - reused across the application
// ============================================================

export type EditorView = 'piano-roll' | 'session-editor'

export type ActiveTab = 'practice' | 'editor' | 'settings'

const [editorView, setEditorView] = createSignal<EditorView>('piano-roll')

interface AppProps {
  onMounted?: () => void
}

export const App: Component<AppProps> = (props) => {
  // ── Local reactive aliases for appStore signals ─────────────
  const activeTab = (): 'practice' | 'editor' | 'settings' =>
    appStore.activeTab()
  const _showWelcome = () => appStore.showWelcome()
  const focusMode = () => appStore.focusMode()

  // Tab handlers - audio cleanup handled by handleTabChange
  const _handleTabPractice = () => void appStore.setActiveTab('practice')
  const _handleTabEditor = () => void appStore.setActiveTab('editor')
  const _handleTabSettings = () => void appStore.setActiveTab('settings')

  // ── Reset all playback-related state ─────────────────────────
  const resetPlaybackState = () => {
    console.log('[resetPlaybackState] Called, resetting all playback state')
    void audioEngine.stopTone()
    void audioEngine.stopAllNotes()
    void playbackRuntime.stop()
    void practiceEngine.endSession()
    playback.resetPlayback()
    setIsPlaying(false)
    setIsPaused(false)
    setEditorPlaybackState('stopped')
    setCurrentBeat(0)
    setCurrentNoteIndex(-1)
    melodyStore.setCurrentNoteIndex(-1)
    setPitchHistory([])
    setNoteResults([])

    // Reset session playback state
    setSessionMelodyIds([])
    setSessionCurrentMelodyIndex(-1)

    // Force reset PlaybackRuntime animation loop and state
    playbackRuntime.isPlaying = false
    playbackRuntime.isPaused = false
    playbackRuntime.animationFrameId = null

    // Verify all states are reset
    console.log('[resetPlaybackState] Playback state reset complete', {
      audioEngineTonePlaying: audioEngine.isTonePlaying(),
      audioEngineActiveVoices: audioEngine._activeVoices.size,
      playbackRuntimePlaying: playbackRuntime.getIsPlaying(),
      playbackRuntimePaused: playbackRuntime.getIsPaused(),
      editorPlaybackState: editorPlaybackState(),
      currentBeat: currentBeat(),
      currentNoteIndex: currentNoteIndex(),
      melodyStoreNoteIndex: melodyStore.currentNoteIndex(),
      sessionMelodyIds: sessionMelodyIds(),
    })
  }

  // ── Debounced auto-save for melody changes (notes only) ─────────────────────────
  const debouncedAutoSave = debounce(() => {
    const currentMelody = melodyStore.getCurrentMelody()
    if (currentMelody === null) return

    // Save to library (the melody is already persisted via melodyStore.setMelody)
    appStore.showNotification('Melody saved!', 'success')

    // Add to active session if one is loaded
    const sessionId = getActiveSessionId()
    if (sessionId !== null) {
      addItemToSession(sessionId, {
        type: 'melody',
        label: currentMelody.name,
        melodyId: currentMelody.id,
        startBeat: 0,
      })
    }
  }, 500)

  // ── Tab change handler with audio cleanup ───────────────────────────────────
  const handleTabChange = (newTab: ActiveTab) => {
    console.log('[handleTabChange] Switching from', activeTab(), 'to', newTab)
    const currentTab = activeTab()

    // Stop audio when leaving practice or editor tabs
    if (currentTab === 'practice' || currentTab === 'editor') {
      console.log('[handleTabChange] Calling resetPlaybackState')
      resetPlaybackState()
    } else {
      console.log('[handleTabChange] NOT calling resetPlaybackState (tab is not practice or editor)')
    }

    // Switch to new tab
    appStore.setActiveTab(newTab)
  }

  // ── Derived state ──────────────────────────────────────────

  const totalBeats = createMemo(() => melodyTotalBeats(melodyStore.items()))

  // ── Practice mode signals ───────────────────────────────────

  const [isPlaying, setIsPlaying] = createSignal(false)
  const [isPaused, setIsPaused] = createSignal(false)

  // ── Editor tab playback state ───────────────────────────────
  const [editorPlaybackState, setEditorPlaybackState] =
    createSignal<PlaybackState>('stopped')
  const editorIsPlaying = () => editorPlaybackState() === 'playing'
  const editorIsPaused = () => editorPlaybackState() === 'paused'

  const [currentBeat, setCurrentBeat] = createSignal(0)
  const [currentNoteIndex, setCurrentNoteIndex] = createSignal(-1)

  // ── Session Playback State (new melody-ID model) ──────────────
  const [sessionCurrentMelodyIndex, setSessionCurrentMelodyIndex] =
    createSignal(-1)
  const [sessionMelodyIds, setSessionMelodyIds] = createSignal<string[]>([])

  /** Flag to track if playback should auto-start (set by user, not session load) */
  const [shouldAutoStartPlayback, setShouldAutoStartPlayback] =
    createSignal(false)

  /**
   * Load and play a specific melody in the session context
   * Sets up the app to use the melody's BPM and items
   * Note: Does NOT auto-start playback - user must explicitly click Play
   */
  const loadAndPlayMelodyForSession = (melodyId: string): void => {
    const melody = melodyStore.getMelody(melodyId)
    if (melody === undefined) return

    // Auto-close sidebar on mobile before starting playback
    closeSidebar()

    // Update app state with this melody's settings
    appStore.setBpm(melody.bpm)
    appStore.setKeyName(melody.key)
    appStore.setScaleType(melody.scaleType)

    // Load the melody (sets currentMelody in melodyStore)
    melodyStore.loadMelody(melodyId)

    // Reset playback state
    setCurrentBeat(0)
    setCurrentNoteIndex(-1)
    melodyStore.setCurrentNoteIndex(-1)
    setPitchHistory([])

    // Sync playback runtime with melody items
    playbackRuntime.setMelody(melody.items ?? [])

    // Set session as active so SessionPlayer shows
    appStore.setSessionActive(true)
  }

  /**
   * Play all melodies in the session sequentially
   * Auto-closes sidebar on mobile before starting playback
   */
  const playSessionSequence = (melodyIds: string[]): void => {
    if (melodyIds.length === 0) return

    // Auto-close sidebar on mobile before starting playback
    closeSidebar()

    setSessionMelodyIds(melodyIds)
    setSessionCurrentMelodyIndex(0)
    loadAndPlayMelodyForSession(melodyIds[0])
  }

  /**
   * Play the next melody in the session sequence
   * Called when current melody playback completes
   */
  const playNextInSessionSequence = (): void => {
    const ids = sessionMelodyIds()
    const currentIdx = sessionCurrentMelodyIndex()

    if (currentIdx < ids.length - 1) {
      const nextIdx = currentIdx + 1
      setSessionCurrentMelodyIndex(nextIdx)
      loadAndPlayMelodyForSession(ids[nextIdx])
    } else {
      // Session complete
      setSessionMelodyIds([])
      setSessionCurrentMelodyIndex(-1)
    }
  }

  const [pitchHistory, setPitchHistory] = createSignal<PitchSample[]>([])
  const [currentPitch, setCurrentPitch] = createSignal<PitchResult | null>(null)
  const [noteResults, setNoteResults] = createSignal<NoteResult[]>([])
  const [practiceResult, setPracticeResult] =
    createSignal<PracticeResult | null>(null)
  const [liveScore, setLiveScore] = createSignal<number | null>(null)
  const [frequencyData, setFrequencyData] = createSignal<Float32Array | null>(
    null,
  )
  const [waveformData, setWaveformData] = createSignal<Float32Array | null>(
    null,
  )
  const [countInBeat, setCountInBeat] = createSignal<number>(0)
  const [isCountingIn, setIsCountingIn] = createSignal(false)
  const [metronomeEnabled, setMetronomeEnabled] = createSignal(false)
  const [targetPitch, setTargetPitch] = createSignal<number | null>(null)

  // ── Editor features ────────────────────────────────────────────────
  const [_currentInstrument, _setCurrentInstrument] =
    createSignal<InstrumentType>('piano')

  const _handleShare = () => {
    const melody = melodyStore.items()
    const key = appStore.keyName()
    const scaleType = appStore.scaleType()
    const bpm = appStore.bpm()
    const totalBeats = melodyTotalBeats(melody)

    const url = generateShareURL(melody, bpm, key, scaleType, totalBeats)
    navigator.clipboard.writeText(url).then(() => {
      appStore.showNotification('Share URL copied to clipboard!', 'success')
    })
  }

  const _handleExportMIDI = () => {
    const melody = melodyStore.items()
    const bpm = appStore.bpm()
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19)
    const _result = downloadMIDI(melody, bpm, `pitchperfect-${timestamp}.mid`)
    if (_result !== null) {
      appStore.showNotification('MIDI file exported!', 'success')
    }
  }

  const _handleImportMIDI = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.mid,.midi'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file === null || file === undefined) return

      try {
        const buffer = await file.arrayBuffer()
        const data = new Uint8Array(buffer)
        const melody = importMelodyFromMIDI(data)
        if (melody !== null && melody.length > 0) {
          melodyStore.setMelody(melody)
          appStore.showNotification(
            `Imported ${melody.length} note(s) from MIDI`,
            'success',
          )
        } else {
          appStore.showNotification('Could not parse MIDI file', 'error')
        }
      } catch (_err) {
        appStore.showNotification('Error reading MIDI file', 'error')
      }
    }
    input.click()
  }

  // ── Recording ────────────────────────────────────────────────
  const [isRecording, setIsRecording] = createSignal(false)
  const [recordedMelody, setRecordedMelody] = createSignal<MelodyItem[]>([])
  let silenceFrames = 0
  let currentNoteStartBeat = -1
  let currentNoteMidi = -1
  let pendingNoteId = 0
  let freeRecordStartTime = 0 // performance.now() when recording started, for free recording

  // ── Play mode ────────────────────────────────────────────────
  type PlayMode = 'once' | 'repeat' | 'practice'
  const [playMode, setPlayMode] = createSignal<PlayMode>('once')
  // Repeat mode: tracks current repeat iteration (for repeat N times)
  const [repeatCycles, setRepeatCycles] = createSignal<number>(5)
  const [currentRepeat, setCurrentRepeat] = createSignal<number>(1)
  const [_allCycleResults, setAllCycleResults] = createSignal<NoteResult[][]>(
    [],
  )
  const [_isPracticeComplete, setIsPracticeComplete] =
    createSignal<boolean>(false)
  const [practiceSubMode, setPracticeSubMode] =
    createSignal<PracticeSubMode>('all')
  const [savedVol, setSavedVol] = createSignal<number>(80)
  const [showScaleBuilder, setShowScaleBuilder] = createSignal<boolean>(false)

  // ── Session state ────────────────────────────────────────────
  const [showSessionBrowser, setShowSessionBrowser] = createSignal(false)
  const [sessionSummary, setSessionSummary] = createSignal<{
    score: number
    items: number
    name: string
  } | null>(null)

  // ── Mobile sidebar toggle ─────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = createSignal(false)
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen())
  const closeSidebar = () => setSidebarOpen(false)

  // ── Stats panel ──────────────────────────────────────────────

  const statsCounts = createMemo(() => {
    const results = noteResults()
    return {
      perfect: results.filter((r) => r.rating === 'perfect').length,
      excellent: results.filter((r) => r.rating === 'excellent').length,
      good: results.filter((r) => r.rating === 'good').length,
      okay: results.filter((r) => r.rating === 'okay').length,
      off: results.filter((r) => r.rating === 'off').length,
    }
  })

  createEffect(() => {
    const counts = statsCounts()
    const total = Math.max(
      1,
      counts.perfect +
        counts.excellent +
        counts.good +
        counts.okay +
        counts.off,
    )

    const updateBar = (id: string, count: number) => {
      const el = document.getElementById(id)
      if (el) el.style.width = `${(count / total) * 100}%`
      const cntEl = document.getElementById(`cnt-${id}`)
      if (cntEl) cntEl.textContent = String(count)
    }

    updateBar('bar-100', counts.perfect)
    updateBar('bar-90', counts.excellent)
    updateBar('bar-75', counts.good)
    updateBar('bar-50', counts.okay)
    updateBar('bar-0', counts.off)
  })

  // ── Engine lifecycle ────────────────────────────────────────

  onMount(() => {
    // Initialize theme and settings from localStorage
    appStore.initTheme()
    appStore.initBpm()
    appStore.initPresets()
    appStore.initSessionHistory()
    appStore.initSettings()
    appStore.initReverb()

    // Initialize active user session from saved default
    const activeSessionId = melodyStore.getActiveSessionId()
    if (activeSessionId === null) {
      // No active session - load default session
      const defaultSession = getSessionStore('default')
      if (defaultSession !== undefined && defaultSession !== null) {
        appStore.setActiveUserSession(defaultSession)
        melodyStore.setActiveSessionId(defaultSession.id)
      }
    } else {
      // Load the previously active session
      const activeSession = getSessionStore(activeSessionId)
      if (activeSession !== null) {
        appStore.setActiveUserSession(activeSession)
      }
    }

    // Expose appStore to window for e2e tests
    ;(window as unknown as { __appStore: typeof appStore }).__appStore =
      appStore
    ;(window as unknown as { melodyStore: typeof melodyStore }).melodyStore =
      melodyStore

    // Expose session playback handlers for LibraryTab
    ;(
      window as unknown as {
        __loadAndPlayMelodyForSession: (melodyId: string) => void
        __playSessionSequence: (melodyIds: string[]) => void
      }
    ).__loadAndPlayMelodyForSession = loadAndPlayMelodyForSession
    ;(
      window as unknown as {
        __playSessionSequence: (melodyIds: string[]) => void
      }
    ).__playSessionSequence = playSessionSequence

    // Fallback: direct click listeners on tab buttons in case SolidJS delegation misses them
    // This handles the edge case where innerHTML-created elements need explicit handlers
    const tabBtn = document.getElementById('tab-settings')
    if (tabBtn) {
      tabBtn.addEventListener('click', () => void handleTabChange('settings'))
    }
    const tabPracticeBtn = document.getElementById('tab-practice')
    if (tabPracticeBtn) {
      tabPracticeBtn.addEventListener(
        'click',
        () => void handleTabChange('practice'),
      )
    }
    const tabEditorBtn = document.getElementById('tab-editor')
    if (tabEditorBtn) {
      tabEditorBtn.addEventListener(
        'click',
        () => void handleTabChange('editor'),
      )
    }

    // Space key handler for play/pause (Focus Mode friendly)
    // Additional shortcuts: Escape (stop), Home (go to beginning), R (repeat), P (practice)
    const onKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input/select/textarea
      const isTyping = (e.target as Element | null)?.closest(
        'input,textarea,select,[contenteditable]',
      )

      if (e.code === 'Space' && !isTyping) {
        e.preventDefault()
        const focusModeValue = appStore.focusMode()
        if (focusModeValue === true) {
          if (isPlaying()) handlePause()
          else if (isPaused()) handleResume()
          else handlePlay()
        }
      }

      // Escape → exit focus mode, or stop playback
      if (e.code === 'Escape' && !isTyping) {
        e.preventDefault()
        const focusModeValue = appStore.focusMode()
        if (focusModeValue === true) {
          appStore.exitFocusMode()
        } else {
          handleStop()
          setCurrentBeat(0)
          playbackRuntime.seekTo(0)
        }
      }

      // Home → go to beginning
      if (e.code === 'Home' && !isTyping) {
        e.preventDefault()
        setCurrentBeat(0)
        playbackRuntime.seekTo(0)
        if (isPlaying()) {
          playbackRuntime.seekTo(0)
          setCurrentBeat(0)
        }
      }

      // R → toggle Repeat mode (but allow Ctrl+R / Cmd+R for browser reload)
      if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && !isTyping) {
        e.preventDefault()
        if (playMode() !== 'repeat') {
          setPlayMode('repeat')
          appStore.showNotification('Mode: Repeat', 'info')
        }
      }

      // P → toggle Practice mode
      if (e.code === 'KeyP' && !isTyping) {
        e.preventDefault()
        if (playMode() !== 'practice') {
          setPlayMode('practice')
          appStore.showNotification('Mode: Practice', 'info')
        }
      }

      // ↑ → faster playback
      if (e.code === 'ArrowUp' && !isTyping) {
        e.preventDefault()
        const current = appStore.playbackSpeed()
        const steps = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0]
        const idx = steps.indexOf(current)
        if (idx < steps.length - 1) {
          const next = steps[idx + 1]
          appStore.setPlaybackSpeed(next)
        }
      }

      // ↓ → slower playback
      if (e.code === 'ArrowDown' && !isTyping) {
        e.preventDefault()
        const current = appStore.playbackSpeed()
        const steps = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0]
        const idx = steps.indexOf(current)
        if (idx > 0) {
          const next = steps[idx - 1]
          appStore.setPlaybackSpeed(next)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)

    // Check for shared preset in URL
    let hasPreset: boolean = false
    if (typeof hasSharedPresetInURL === 'function') {
      hasPreset = hasSharedPresetInURL()
    }
    if (hasPreset) {
      const sharedData = loadFromURL() as {
        melody: MelodyItem[]
        bpm?: number
        key?: string
        scaleType?: string
        totalBeats?: number
      } | null
      if (sharedData !== null) {
        // Load shared preset into melody store
        melodyStore.setMelody(sharedData.melody)
        if (sharedData.bpm !== undefined && sharedData.bpm !== 0) {
          appStore.setBpm(sharedData.bpm)
        }
        if (sharedData.key !== undefined && sharedData.key !== '') {
          appStore.setKeyName(sharedData.key)
        }
        if (sharedData.scaleType !== undefined && sharedData.scaleType !== '') {
          appStore.setScaleType(sharedData.scaleType)
        }
        appStore.showNotification('Shared preset loaded from URL', 'info')
      }
    }

    // Load saved volume
    const savedVol = parseInt(localStorage.getItem('pp_volume') ?? '80', 10)
    setSavedVol(isNaN(savedVol) ? 80 : savedVol)
    audioEngine = new AudioEngine()
    audioEngine.setVolume((isNaN(savedVol) ? 80 : savedVol) / 100)
    // Sync ADSR settings from appStore
    audioEngine.syncFromAppStore(appStore.adsr())
    // Apply saved reverb settings to audio engine
    audioEngine.setReverbType(appStore.reverb().type)
    audioEngine.setReverbWetness(appStore.reverb().wetness)

    // EXPOSE ENGINES FOR E2E TESTING
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __appStore: typeof appStore }).__appStore =
        appStore
      ;(
        window as unknown as { __playbackRuntime: PlaybackRuntime }
      ).__playbackRuntime = playbackRuntime
    }

    // Create PlaybackRuntime - orchestrates audio and timing
    // Note: BPM is managed by appStore, passed to AudioEngine for timing
    playbackRuntime = new PlaybackRuntime({
      metronomeEnabled: metronomeEnabled,
      instrumentType: appStore.instrument(),
      onNoteStart: (item, noteIndex) => {
        setCurrentNoteIndex(noteIndex)
        setTargetPitch(item.note.freq)
        practiceEngine.onNoteStart(item.note, noteIndex)
        // Play tone for the note — use the full note duration from the melody item
        const beatDurationMs = 60000 / appStore.bpm()
        const noteDurationMs = item.duration * beatDurationMs
        audioEngine.playTone(item.note.freq, noteDurationMs)
      },
      onNoteEnd: () => {
        audioEngine.stopTone()
      },
      onBeatUpdate: (beat) => {
        setCurrentBeat(beat)
      },
      onComplete: () => {
        practiceEngine.onPlaybackComplete()
        const mode = playMode()
        console.info(
          '[onComplete] fired, mode:',
          mode,
          'sessionMode:',
          appStore.sessionMode(),
          'idx:',
          appStore.sessionItemIndex(),
        )
      },
    })

    // EXPOSE PLAYBACK RUNTIME FOR E2E TESTING
    if (typeof window !== 'undefined') {
      ;(
        window as unknown as { __playbackRuntime: PlaybackRuntime }
      ).__playbackRuntime = playbackRuntime
    }

    practiceEngine = new PracticeEngine(audioEngine, { sensitivity: 5 })

    // Sync settings to PracticeEngine
    createEffect(() => {
      const s = appStore.settings()
      practiceEngine.syncSettings({
        sensitivity: s.sensitivity,
        minConfidence: s.minConfidence,
        minAmplitude: s.minAmplitude,
        bands: s.bands.map((b) => ({ threshold: b.threshold, band: b.band })),
      })
    })

    // Sync ADSR settings to AudioEngine when they change
    createEffect(() => {
      const adsr = appStore.adsr()
      if (audioEngine !== null) {
        audioEngine.syncFromAppStore(adsr)
      }
    })

    // Sync reverb wetness to AudioEngine when it changes
    createEffect(() => {
      const wetness = appStore.reverb().wetness
      if (audioEngine !== null) {
        audioEngine.setReverbWetness(wetness)
      }
    })

    // Sync reverb type to AudioEngine when it changes (async, avoid on wetness changes)
    let lastReverbType = appStore.reverb().type
    createEffect(() => {
      const type = appStore.reverb().type
      if (audioEngine !== null && type !== lastReverbType) {
        lastReverbType = type
        audioEngine.setReverbType(type)
      }
    })

    // Sync settings to PlaybackRuntime when they change
    // Changed to avoid re-running on every items() call - use items directly
    const currentMelody = melodyStore.currentMelody
    createEffect(() => {
      const melody = currentMelody()
      if (melody !== null) {
        const bpm = appStore.bpm()
        const instrument = appStore.instrument()

        // Update AudioEngine with BPM and instrument
        audioEngine.setBPM(bpm)
        audioEngine.setInstrument(instrument)
        // Tell PlaybackRuntime about new melody (BPM handled by AudioEngine)
        console.log('[createEffect melody sync] Setting melody to playbackRuntime, items count:', melody.items?.length ?? 0)
        playbackRuntime.setMelody(melody.items ?? [])
      }
    })

    // Link practice callbacks
    practiceEngine.setCallbacks({
      onPitchDetected: (pitch) => {
        setCurrentPitch(pitch)
        if (pitch && pitch.frequency > 0 && pitch.clarity >= 0.2) {
          setFrequencyData(audioEngine.getFrequencyData())
        }
      },
      onNoteComplete: (result) => {
        setNoteResults((prev) => [...prev, result])
        // Update live score
        const allResults = [...noteResults(), result]
        setLiveScore(practiceEngine.calculateScore(allResults))
      },
      onMicStateChange: (active, error) => {
        console.info(
          '[App] Mic state changed:',
          active ? 'ACTIVE' : 'INACTIVE',
          error !== undefined && error !== '' ? `Error: ${error}` : '',
        )
        appStore.setMicActive(active)
        if (error !== undefined && error !== '') {
          appStore.setMicError(error)
          appStore.showNotification(error, 'error')
        }
      },
    })

    // Listen for preset events from piano roll
    const handlePresetSaved = (e: CustomEvent) => {
      appStore.showNotification(`Preset "${e.detail.name}" saved`, 'success')
    }
    const handlePresetLoaded = (e: CustomEvent) => {
      if (e.detail.bpm !== undefined && e.detail.bpm !== '') {
        appStore.setBpm(e.detail.bpm)
        audioEngine.setBPM(e.detail.bpm)
      }
      if (e.detail.melody !== undefined) {
        melodyStore.setMelody(e.detail.melody)
      }
      appStore.showNotification(`Preset "${e.detail.name}" loaded`, 'info')
    }
    const handleOctaveChange = (e: CustomEvent) => {
      // Sync octave and numOctaves to the scale builder
      melodyStore.setOctave(e.detail.octave)
      melodyStore.setNumOctaves(e.detail.numOctaves)
    }
    const handleModeChange = (e: CustomEvent) => {
      appStore.setScaleType(e.detail.mode)
    }
    window.addEventListener(
      'pitchperfect:presetSaved',
      handlePresetSaved as EventListener,
    )
    window.addEventListener(
      'pitchperfect:presetLoaded',
      handlePresetLoaded as EventListener,
    )
    window.addEventListener(
      'pitchperfect:octaveChange',
      handleOctaveChange as EventListener,
    )
    window.addEventListener(
      'pitchperfect:modeChange',
      handleModeChange as EventListener,
    )

    // Listen for seek events from PitchCanvas (playhead drag)
    const handleSeek = (e: CustomEvent) => {
      if (!isPlaying() && !isPaused()) return
      const targetBeat = e.detail.beat as number
      playbackRuntime.seekTo(targetBeat)
      setCurrentBeat(targetBeat)
    }
    window.addEventListener(
      'pitchperfect:seekToBeat',
      handleSeek as EventListener,
    )

    // Listen to PlaybackRuntime events for synchronization (both tabs)
    playbackRuntime.on('beat', (e: { beat?: number }) => {
      setCurrentBeat(e.beat ?? 0)
      // Also update editor state
      if (activeTab() === 'editor') {
        // Editor uses melodyStore to track current note index
        melodyStore.setCurrentNoteIndex(
          melodyIndexAtBeat(melodyStore.items(), e.beat ?? 0),
        )
      }
    })
    playbackRuntime.on('countIn', (e: { countIn?: number }) => {
      setCountInBeat(e?.countIn ?? 0)
      setIsCountingIn(true)
      if (metronomeEnabled()) {
        audioEngine?.playClick()
      }
    })
    playbackRuntime.on('countInComplete', () => {
      setIsCountingIn(false)
      setCountInBeat(0)
    })
    playbackRuntime.on('metronome', (e: { isDownbeat?: boolean }) => {
      if (metronomeEnabled()) {
        audioEngine?.playMetronomeClick(e?.isDownbeat ?? false)
      }
    })
    playbackRuntime.on('complete', () => {
      practiceEngine.onPlaybackComplete()
      const mode = playMode()
      console.info(
        '[onComplete] fired, mode:',
        mode,
        'sessionMode:',
        appStore.sessionMode(),
        'idx:',
        appStore.sessionItemIndex(),
        'repeat:',
        currentRepeat(),
      )

      // Handle melody session sequence playback (user-defined melodies in order)
      const ids = sessionMelodyIds()
      if (ids.length > 0 && sessionCurrentMelodyIndex() >= 0) {
        console.info('[onComplete] melody session sequence - playing next')
        playNextInSessionSequence()
        return
      }

      // Handle session mode (multi-item sessions)
      const sessionModeValue = appStore.sessionMode()
      if (sessionModeValue === true && mode === 'practice') {
        handleSessionModeComplete()
        return
      }

      // Handle repeat mode (repeat melody N times)
      if (mode === 'repeat') {
        handleRepeatModeComplete()
        return
      }

      // Once mode: playback is done
      console.info('[onComplete] once mode - playback complete')
    })

    // Animation loop for pitch history
    let animId: number
    const loop = () => {
      const pitch = practiceEngine.update()
      // During free recording, compute beat from performance.now() independently.
      // During playback-backed recording, use playbackRuntime's beat position.

      const perfNow = (performance as unknown as { now: () => number }).now()
      const beat = isRecording()
        ? ((perfNow - freeRecordStartTime) / 60000) * appStore.bpm()
        : playbackRuntime.getCurrentBeat()
      if (pitch && pitch.frequency > 0 && pitch.clarity >= 0.2) {
        setPitchHistory((prev) => {
          const next = [
            ...prev,
            {
              freq: pitch.frequency,
              time: perfNow,
              cents: pitch.cents,
            },
          ]
          return next.length > 800 ? next.slice(-800) : next
        })

        // Record to piano roll
        if (isRecording()) {
          const midi = Math.round(69 + 12 * Math.log2(pitch.frequency / 440))
          if (midi !== currentNoteMidi) {
            // New pitch detected — finalize previous note
            if (currentNoteMidi > 0 && currentNoteStartBeat > 0) {
              const duration = Math.max(0.25, beat - currentNoteStartBeat)
              const note = midiToNote(currentNoteMidi)
              setRecordedMelody((prev) => [
                ...prev,
                {
                  id: pendingNoteId++,
                  note: {
                    name: note?.name ?? '',
                    octave: note?.octave ?? 4,
                    midi: currentNoteMidi,
                    freq: 440 * Math.pow(2, (currentNoteMidi - 69) / 12),
                  },
                  duration,
                  startBeat: currentNoteStartBeat,
                },
              ])
            }
            currentNoteMidi = midi
            currentNoteStartBeat = beat
          }
          silenceFrames = 0
        }
      } else if (isRecording()) {
        silenceFrames++
        // 10+ frames of silence ends the current note
        if (silenceFrames >= 10 && currentNoteMidi > 0) {
          const duration = Math.max(0.25, beat - currentNoteStartBeat)
          const note = midiToNote(currentNoteMidi)
          setRecordedMelody((prev) => [
            ...prev,
            {
              id: pendingNoteId++,
              note: {
                name: note?.name ?? '',
                octave: note?.octave ?? 4,
                midi: currentNoteMidi,
                freq: 440 * Math.pow(2, (currentNoteMidi - 69) / 12),
              },
              duration,
              startBeat: currentNoteStartBeat,
            },
          ])
          currentNoteMidi = -1
          currentNoteStartBeat = -1
        }
      }
      // Capture waveform data when mic is active
      if (practiceEngine.isMicActive()) {
        setWaveformData(practiceEngine.getWaveformData())
      }
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)

    onCleanup(() => {
      cancelAnimationFrame(animId)
      playbackRuntime.destroy()
      practiceEngine.destroy()
      audioEngine.destroy()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(
        'pitchperfect:presetSaved',
        handlePresetSaved as EventListener,
      )
      window.removeEventListener(
        'pitchperfect:presetLoaded',
        handlePresetLoaded as EventListener,
      )
      window.removeEventListener(
        'pitchperfect:octaveChange',
        handleOctaveChange as EventListener,
      )
      window.removeEventListener(
        'pitchperfect:modeChange',
        handleModeChange as EventListener,
      )
      window.removeEventListener(
        'pitchperfect:seekToBeat',
        handleSeek as EventListener,
      )
    })

    // Signal that app has fully initialized (for FOUC prevention)
    props.onMounted?.()
  })

  // ── Playback handlers ───────────────────────────────────────

  const handlePlay = () => {
    if (isPlaying()) return // already playing
    if (isPaused()) {
      // Resume from paused state
      handleResume()
      return
    }

    // Start fresh playback (if not playing)
    // Reset state
    setPitchHistory([])
    setNoteResults([])
    setPracticeResult(null)
    setLiveScore(null)
    setCurrentBeat(0)
    setCurrentNoteIndex(-1)
    melodyStore.setCurrentNoteIndex(-1)

    // Initialize audio engine
    audioEngine.init()
    audioEngine.resume()

    // Sync engine with current melody/bpm
    const baseMelody = melodyStore.items()
    const subMode = playMode() === 'practice' ? practiceSubMode() : 'all'
    const filteredMelody = filterMelodyForPractice(baseMelody, subMode)
    playbackRuntime.setMelody(filteredMelody)
    // BPM synced via AudioEngine in the createEffect above

    practiceEngine.startSession()

    // Set session active for practice mode (for FocusMode display)
    appStore.setSessionActive(true)

    // Mark playback as explicitly requested by user (not auto-start)
    setShouldAutoStartPlayback(true)

    setIsPlaying(true)
    setIsPaused(false)
    playback.startPlayback()

    // Play tonic anchor tone if enabled — helps singer lock in to the key
    const settingsValue = appStore.settings()
    if (settingsValue.tonicAnchor === true) {
      const tonicFreq = keyTonicFreq(
        appStore.keyName(),
        melodyStore.currentOctave(),
      )
      const bpm = appStore.bpm()
      const tonicDuration = Math.round(60000 / bpm) // 1 beat
      audioEngine.playTone(tonicFreq, tonicDuration)
    }

    // Start with count-in if configured
    playbackRuntime.start(appStore.countIn())
  }

  const handlePause = () => {
    // Only pause if currently playing
    if (!isPlaying()) {
      return
    }
    void playbackRuntime.pause()
    void audioEngine.stopAllNotes()
    void audioEngine.stopTone()
    setIsPlaying(false)
    setIsPaused(true)
    void playback.pausePlayback()
  }

  const handleResume = () => {
    // Only resume if currently paused (not stopped)
    if (!isPaused()) {
      return
    }
    void playbackRuntime.resume()
    setIsPlaying(true)
    setIsPaused(false)
    playback.continuePlayback()
    // Sync editor playback state since it's separate from practice state
    setEditorPlaybackState('playing')
  }

  const handleStop = () => {
    void playbackRuntime.stop()
    void practiceEngine.endSession()
    void audioEngine.stopTone()
    setIsPlaying(false)
    setIsPaused(false)
    setCurrentBeat(0)
    setCurrentNoteIndex(-1)
    melodyStore.setCurrentNoteIndex(-1)
    setPitchHistory([])
    playback.resetPlayback()
    appStore.setSessionActive(false)
    // Also reset editor state
    setEditorPlaybackState('stopped')
  }

  // ── Editor tab playback handlers (connect to actual PlaybackRuntime) ─────────────────────────────────
  const handleEditorPlay = () => {
    console.log('[handleEditorPlay] Starting playback, current state:', editorPlaybackState())
    if (editorIsPlaying()) {
      console.log('[handleEditorPlay] Already playing, returning')
      return
    }
    if (editorIsPaused()) {
      console.log('[handleEditorPlay] Resuming from pause')
      handleEditorResume()
      return
    }

    // Reset state
    setPitchHistory([])
    setCurrentBeat(0)
    setCurrentNoteIndex(-1)

    // Initialize audio engine - CRITICAL: must init and resume for sound to work
    audioEngine.init()
    audioEngine.resume()

    // Sync engine with current melody/bpm
    playbackRuntime.setMelody(melodyStore.items())
    // BPM synced via AudioEngine in the createEffect above

    // Start playbackRuntime with count-in
    const countInBeats = appStore.countIn()
    console.log('[handleEditorPlay] Starting playbackRuntime with countInBeats:', countInBeats)
    playbackRuntime.start(countInBeats)
    setEditorPlaybackState('playing')
    console.log('[handleEditorPlay] Playback state set to playing')
  }

  const handleEditorPause = () => {
    void playbackRuntime.pause()
    void audioEngine.stopTone()
    setEditorPlaybackState('paused')
  }

  const handleEditorResume = () => {
    void playbackRuntime.resume()
    setEditorPlaybackState('playing')
  }

  const handleEditorStop = () => {
    void playbackRuntime.stop()
    void audioEngine.stopTone()
    setCurrentBeat(0)
    setCurrentNoteIndex(-1)
    setEditorPlaybackState('stopped')
  }

  const handleReset = () => {
    handleStop()
    setNoteResults([])
    setPracticeResult(null)
    setLiveScore(null)
    // Reset practice mode state
    setAllCycleResults([])
    setCurrentRepeat(1)
    setIsPracticeComplete(false)
  }

  /** Build a scale-based melody for session items */
  const buildScaleMelody = (
    scaleType: string,
    beats: number,
    _label?: string,
  ) => {
    const numOctaves = beats > 12 ? 2 : 1
    let scale = buildMultiOctaveScale(
      appStore.keyName(),
      melodyStore.currentOctave(),
      numOctaves,
      scaleType,
    )
    if (scale === null || scale.length === 0) {
      // Fallback to a minimum scale (C major, 2 octaves) if scale is empty
      console.warn('Scale is empty, using fallback')
      const fallbackScale = buildMultiOctaveScale(
        'C',
        melodyStore.currentOctave(),
        2,
        'major',
      )
      if (fallbackScale === null || fallbackScale.length === 0) return
      scale = fallbackScale
    }

    // Use ALL notes from the scale (no 8-note cap) — respect the beats parameter
    const noteCount = Math.min(scale.length, beats)
    const items: MelodyItem[] = scale.slice(0, noteCount).map((note, i) => ({
      id: melodyStore.generateId(),
      note: {
        midi: note.midi,
        name: note.name as NoteName,
        octave: note.octave,
        freq: note.freq,
      },
      startBeat: i,
      duration: 1,
    }))
    melodyStore.setMelody(items)
  }

  /** Handle session skip — advance to next item or end session */
  const handleSessionSkip = () => {
    handleStop()
    const sessionValue = appStore.practiceSession()
    const idx = appStore.sessionItemIndex()
    if (sessionValue && idx < sessionValue.items.length - 1) {
      appStore.advanceSessionItem()
      const nextItem = appStore.getCurrentSessionItem()
      if (nextItem !== null) {
        if (nextItem.type === 'scale') {
          buildScaleMelody(
            nextItem.scaleType ?? 'major',
            nextItem.beats ?? 8,
            nextItem.label,
          )
          setTimeout(() => void handlePlay(), 500)
        } else if (nextItem.type === 'rest') {
          setTimeout(() => {
            handleSessionSkip()
          }, nextItem.restMs ?? 2000)
        }
      }
    } else {
      const summary = appStore.endPracticeSession()
      if (summary)
        setSessionSummary({
          score: summary.score,
          items: summary.itemsCompleted,
          name: summary.sessionName,
        })
    }
  }

  /** Handle session end — end session early */
  const handleSessionEnd = () => {
    handleStop()
    const summary = appStore.endPracticeSession()
    if (summary)
      setSessionSummary({
        score: summary.score,
        items: summary.itemsCompleted,
        name: summary.sessionName,
      })
  }

  /** Auto-start session playback when explicitly requested by user */
  createEffect(() => {
    const sessionMode = appStore.sessionMode()
    const practiceSession = appStore.practiceSession()
    const playModeValue = playMode()
    const shouldAutoStart = shouldAutoStartPlayback()

    console.log(
      '[auto-start session] sessionMode:',
      sessionMode,
      'practiceSession:',
      !!practiceSession,
      'playMode:',
      playModeValue,
      'shouldAutoStart:',
      shouldAutoStart
    )

    // Only auto-start if user explicitly requested AND in practice mode with session
    if (shouldAutoStart && sessionMode && practiceSession && playModeValue === 'practice') {
      const item = appStore.getCurrentSessionItem()
      if (item && item.type === 'scale') {
        console.log('[auto-start session] Starting playback for scale item:', item.label)
        buildScaleMelody(item.scaleType ?? 'major', item.beats ?? 8, item.label)
        setRepeatCycles(1)
        setTimeout(() => void handlePlay(), 500)
        setShouldAutoStartPlayback(false) // Reset flag after starting
      }
    }
  })

  // ── Mic handlers ─────────────────────────────────────────────

  const handleMicToggle = async () => {
    if (appStore.micActive()) {
      practiceEngine.stopMic()
    } else {
      practiceEngine.startMic()
    }
  }

  // ── Recording ────────────────────────────────────────────────

  const handleRecordToggle = async () => {
    if (isRecording()) {
      // Stop recording — finalize any pending note
      if (currentNoteMidi > 0 && currentNoteStartBeat > 0) {
        const beat = playbackRuntime.getCurrentBeat()
        const duration = Math.max(0.25, beat - currentNoteStartBeat)
        const note = midiToNote(currentNoteMidi)
        setRecordedMelody((prev) => [
          ...prev,
          {
            id: pendingNoteId++,
            note: {
              name: note?.name ?? '',
              octave: note?.octave ?? 4,
              midi: currentNoteMidi,
              freq: 440 * Math.pow(2, (currentNoteMidi - 69) / 12),
            },
            duration,
            startBeat: currentNoteStartBeat,
          },
        ])
      }
      const items = recordedMelody()
      if (items.length > 0) {
        melodyStore.setMelody([...melodyStore.items(), ...items])
      }
      setRecordedMelody([])
      currentNoteMidi = -1
      currentNoteStartBeat = -1
      setIsRecording(false)
      appStore.setActiveTab('editor')
    } else {
      // Start recording
      const micOk = await practiceEngine.startMic()
      if (!micOk) return
      setRecordedMelody([])
      currentNoteMidi = -1
      currentNoteStartBeat = -1
      silenceFrames = 0

      freeRecordStartTime = (
        performance as unknown as { now: () => number }
      ).now()
      setIsRecording(true)
    }
  }

  // ── Octave shift ─────────────────────────────────────────────

  const handleOctaveShift = (delta: number) => {
    const newOctave = melodyStore.currentOctave() + delta
    if (newOctave < 1 || newOctave > 6) return

    const keyName = appStore.keyName()
    const scaleType = appStore.scaleType()

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

  // ── Target note for pitch display ───────────────────────────

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

  // ── Session mode complete handler ───────────────────────────────────────
  const handleSessionModeComplete = (): void => {
    const currentScore = liveScore()
    if (currentScore !== null) {
      appStore.recordSessionItemResult(currentScore)
    }

    const current = appStore.getCurrentSessionItem()
    if (!current) {
      // No active item — session was cleared
      handleStop()
      return
    }

    const session = appStore.practiceSession()
    const idx = appStore.sessionItemIndex()

    if (idx < (session?.items.length ?? 0) - 1) {
      // More items — advance to next session item, rebuild melody, restart
      appStore.advanceSessionItem()
      setNoteResults([])
      setLiveScore(null)
      setCurrentBeat(0)
      setCurrentNoteIndex(-1)
      melodyStore.setCurrentNoteIndex(-1)
      setPitchHistory([])
      practiceEngine.resetSession()
      loadNextSessionItem()
    } else {
      // Session complete — end and show summary
      console.info('[onComplete] session complete!')
      handleStop()
      const summary = appStore.endPracticeSession()
      if (summary) {
        setSessionSummary({
          score: summary.score,
          items: summary.itemsCompleted,
          name: summary.sessionName,
        })
        appStore.showNotification(
          `Session complete! Score: ${summary.score}%`,
          summary.score >= 80 ? 'success' : 'info',
        )
      }
    }
  }

  // ── Repeat mode complete handler ───────────────────────────────────────
  const handleRepeatModeComplete = (): void => {
    const current = currentRepeat()
    const total = repeatCycles()

    if (current < total) {
      // More repeats — restart playback
      console.info(
        '[onComplete] repeat, cycle',
        current,
        '/',
        total,
        '- restarting',
      )
      setCurrentRepeat(current + 1)
      setNoteResults([])
      setLiveScore(null)
      setPitchHistory([])
      practiceEngine.resetSession()
      // Restart playback (keep the same melody, restart from beginning)
      playbackRuntime.start(appStore.countIn())
    } else {
      // All repeats complete
      console.info('[onComplete] repeat complete - all cycles done')
      handleStop()
    }
  }

  // ── Load next session item ───────────────────────────────────────
  const loadNextSessionItem = (): void => {
    const nextItem = appStore.getCurrentSessionItem()
    if (!nextItem) {
      console.log('[loadNextSessionItem] No current item')
      return
    }

    console.log(
      '[loadNextSessionItem] Type:',
      nextItem.type,
      'label:',
      nextItem.label,
      'isPlaying:',
      playbackRuntime.getIsPlaying()
    )

    if (nextItem.type === 'rest') {
      // Rest item — start playback so onComplete fires, then wait before loading real scale
      const restDuration = nextItem.restMs ?? 2000
      playbackRuntime.stop()
      playbackRuntime.setMelody(melodyStore.items())
      console.log('[loadNextSessionItem] Starting rest playback')
      playbackRuntime.start(appStore.countIn())
      setTimeout(() => {
        const afterRest = appStore.getCurrentSessionItem()
        console.log('[loadNextSessionItem] After rest, next item:', afterRest?.type)
        if (afterRest && afterRest.type === 'scale') {
          buildScaleMelody(
            afterRest.scaleType ?? 'major',
            afterRest.beats ?? 8,
            afterRest.label,
          )
          playbackRuntime.stop()
          playbackRuntime.setMelody(melodyStore.items())
          console.log('[loadNextSessionItem] Starting scale playback after rest')
          playbackRuntime.start(appStore.countIn())
        }
      }, restDuration)
    } else if (nextItem.type === 'scale') {
      console.log('[loadNextSessionItem] Starting scale playback')
      buildScaleMelody(
        nextItem.scaleType ?? 'major',
        nextItem.beats ?? 8,
        nextItem.label,
      )
      playbackRuntime.stop()
      playbackRuntime.setMelody(melodyStore.items())
      playbackRuntime.start(appStore.countIn())
    }
  }

  // ── Accuracy heatmap ───────────────────────────────────────

  const noteAccuracyMap = createMemo(() => {
    // Track session history so this recomputes when history changes
    void appStore.sessionHistory.length
    return getNoteAccuracyMap()
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

  return (
    <div id="app">
      {/* Walkthrough Selection (shown on app start if walkthroughs remain) */}
      <WalkthroughControl showOnStart={true} />

      {/* Sidebar backdrop (mobile) */}
      <Show when={sidebarOpen()}>
        <div class="sidebar-backdrop" onClick={closeSidebar} />
      </Show>

      {/* Sidebar toggle (mobile only — CSS hides on desktop) */}
      <button class="sidebar-toggle-btn" onClick={toggleSidebar} title="Menu">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path
            fill="currentColor"
            d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"
          />
        </svg>
        Menu
      </button>

      {/* Full app UI — hidden when in Focus Mode */}
      <Show when={!focusMode()}>
        {/* Header */}
        <header>
          <div class="header-left">
            <button
              id="app-title"
              class="logo-btn"
              onClick={() => handleTabChange('practice')}
              title="Go to Practice"
            >
              <h1 id="app-title" class="app-title">
                PitchPerfect
              </h1>
            </button>
            <p class="subtitle">Voice Pitch Practice</p>
          </div>
          <div class="header-right">
            {/* Walkthrough Control Button */}
            <WalkthroughControl showOnStart={false} />
          </div>
          <nav id="app-tabs">
            <button
              id="tab-practice"
              class={`app-tab ${activeTab() === 'practice' ? 'active' : ''}`}
              onClick={() => handleTabChange('practice')}
            >
              Practice
            </button>
            <button
              id="tab-editor"
              class={`app-tab ${activeTab() === 'editor' ? 'active' : ''}`}
              onClick={() => handleTabChange('editor')}
            >
              Editor
              <Show when={melodyStore.items().length > 0}>
                <span class="tab-badge">{melodyStore.items().length}</span>
              </Show>
            </button>
            <button
              id="tab-settings"
              class={`app-tab ${activeTab() === 'settings' ? 'active' : ''}`}
              onClick={() => handleTabChange('settings')}
            >
              Settings
            </button>
          </nav>
        </header>

        {/* Main layout: sidebar + content */}
        <div class="main-layout" id="main-layout">
          {/* Shared sidebar — with mobile open class */}
          <AppSidebar
            class={sidebarOpen() ? 'open' : ''}
            onPresetLoad={(_name) => {
              // Presets now handled by melodyStore/LibraryModal
            }}
            onOctaveShift={handleOctaveShift}
            onOpenScaleBuilder={() => setShowScaleBuilder(true)}
            melody={() => melodyStore.items()}
            currentNoteIndex={currentNoteIndex}
            noteResults={noteResults}
            isPlaying={isPlaying}
            pitch={currentPitch}
            targetNoteName={targetNoteName}
            onClose={closeSidebar}
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
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onResume={handleResume}
                  onStop={handleStop}
                  volume={savedVol}
                  onVolumeChange={(vol) => {
                    setSavedVol(vol)
                    audioEngine?.setVolume(vol / 100)
                  }}
                  speed={appStore.playbackSpeed()}
                  onSpeedChange={appStore.setPlaybackSpeed}
                  metronomeEnabled={() => metronomeEnabled()}
                  onMetronomeToggle={() =>
                    setMetronomeEnabled(!metronomeEnabled())
                  }
                  playMode={() => playMode()}
                  playModeChange={setPlayMode}
                  practiceCycles={() => repeatCycles()}
                  onCyclesChange={setRepeatCycles}
                  currentCycle={() => currentRepeat()}
                  practiceSubMode={() => practiceSubMode()}
                  onPracticeSubModeChange={setPracticeSubMode}
                  isCountingIn={() => isCountingIn()}
                  countInBeat={() => countInBeat()}
                  onSessionsClick={() => setShowSessionBrowser(true)}
                  onMicToggle={() => {
                    void handleMicToggle()
                  }}
                  onWaveToggle={appStore.toggleMicWaveVisible}
                />

                {/* Session Player — shown when a session is active */}
                <Show when={appStore.sessionActive()}>
                  <SessionPlayer
                    onSkip={handleSessionSkip}
                    onEnd={handleSessionEnd}
                  />
                </Show>

                {/* Canvas */}
                <div id="canvas-container">
                  <PitchCanvas
                    melody={() => melodyStore.items()}
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
                    isRecording={isRecording}
                    getWaveform={() => audioEngine?.getWaveformData() ?? null}
                  />
                  <div
                    id="playhead"
                    style={{
                      display: isPlaying() || isPaused() ? 'block' : 'none',
                      left: `${(currentBeat() / Math.max(1, totalBeats())) * 100}%`,
                    }}
                  />
                </div>

                {/* History */}
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
              {/* Shared control toolbar with editor-specific options */}
              <SharedControlToolbar
                activeTab={activeTab}
                editorTab={() => activeTab() === 'editor'}
                isPlaying={editorIsPlaying}
                isPaused={editorIsPaused}
                onPlay={handleEditorPlay}
                onPause={handleEditorPause}
                onResume={handleEditorResume}
                onStop={handleEditorStop}
                volume={savedVol}
                onVolumeChange={(vol) => {
                  setSavedVol(vol)
                  audioEngine?.setVolume(vol / 100)
                }}
                speed={appStore.playbackSpeed()}
                onSpeedChange={appStore.setPlaybackSpeed}
                metronomeEnabled={() => metronomeEnabled()}
                onMetronomeToggle={() =>
                  setMetronomeEnabled(!metronomeEnabled())
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
                isRecording={() => isRecording()}
                onRecordToggle={handleRecordToggle}
                onMicToggle={() => {
                  void handleMicToggle()
                }}
                onWaveToggle={appStore.toggleMicWaveVisible}
              />
              {/* Editor View Toggle */}
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
              {/* Session Editor View */}
              <Show when={editorView() === 'session-editor'}>
                <div class="session-editor-container">
                  <SessionEditor />
                </div>
              </Show>
              {/* Piano Roll View */}
              <Show when={editorView() === 'piano-roll'}>
                <PianoRollCanvas
                melody={() => melodyStore.items()}
                scale={() => melodyStore.currentScale()}
                bpm={() => appStore.bpm()}
                totalBeats={() => totalBeats()}
                playbackState={() =>
                  playback.state() as unknown as PlaybackState
                }
                currentNoteIndex={() => melodyStore.currentNoteIndex()}
                currentBeat={currentBeat}
                isPlaying={editorIsPlaying}
                isPaused={editorIsPaused}
                isScrolling={() => false}
                targetPitch={() => null}
                noteAccuracyMap={() => new Map()}
                onMelodyChange={(melody) => {
                  // Debounced auto-save before setting melody
                  debouncedAutoSave()
                  melodyStore.setMelody(melody)
                }}
                onInstrumentChange={(instrument) => {
                  audioEngine.setInstrument(instrument as InstrumentType)
                }}
                onPlaybackStateChange={(state) => {
                  setEditorPlaybackState(state)
                }}
                getWaveform={() => audioEngine?.getWaveformData() ?? null}
              />
              </Show>
            </Show>

            <Show when={activeTab() === 'settings'}>
              <div id="settings-panel">
                <SettingsPanel />
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Focus Mode — full-screen minimal practice UI */}
      <Show when={focusMode()}>
        <FocusMode
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
                  {noteResults().filter((r) => r.rating === 'perfect').length}
                </div>
                <div class="score-stat-label">Perfect</div>
              </div>
              <div class="score-stat score-stat-excellent">
                <div class="score-stat-value">
                  {noteResults().filter((r) => r.rating === 'excellent').length}
                </div>
                <div class="score-stat-label">Excellent</div>
              </div>
              <div class="score-stat score-stat-good">
                <div class="score-stat-value">
                  {noteResults().filter((r) => r.rating === 'good').length}
                </div>
                <div class="score-stat-label">Good</div>
              </div>
              <div class="score-stat score-stat-okay">
                <div class="score-stat-value">
                  {noteResults().filter((r) => r.rating === 'okay').length}
                </div>
                <div class="score-stat-label">Okay</div>
              </div>
              <div class="score-stat score-stat-off">
                <div class="score-stat-value">
                  {noteResults().filter((r) => r.rating === 'off').length}
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

            {/* Session history mini chart */}
            <Show when={appStore.sessionHistory().length > 1}>
              <div id="score-history">
                <h3 class="history-title">Recent Progress</h3>
                <div class="history-chart">
                  {appStore
                    .sessionHistory()
                    .slice(0, 10)
                    .map((session) => (
                      <div
                        class="history-bar"
                        style={{ height: `${session.score}%` }}
                        title={`Score: ${session.score}%`}
                      />
                    ))}
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Scale Builder Modal */}
      <ScaleBuilder
        isOpen={showScaleBuilder()}
        onClose={() => setShowScaleBuilder(false)}
      />

      {/* Session Browser Modal */}
      <Show when={showSessionBrowser()}>
        <SessionBrowser
          onClose={() => setShowSessionBrowser(false)}
          onStartSession={(session) => {
            appStore.startPracticeSession(session)
            setShowSessionBrowser(false)
          }}
        />
      </Show>

      {/* Session Summary Overlay */}
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
                  setShowSessionBrowser(true)
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

      {/* Notifications */}
      <Notifications />

      {/* Library Modal */}
      <Show when={appStore.isLibraryModalOpen()}>
        <LibraryModal isOpen={true} close={() => appStore.hideLibrary()} />
      </Show>

      {/* Session Library Modal */}
      <Show when={appStore.isSessionLibraryModalOpen()}>
        <SessionLibraryModal
          isOpen={true}
          close={() => appStore.hideSessionLibrary()}
        />
      </Show>

      {/* Presets Library Modal */}
      <Show when={appStore.isPresetsModalOpen()}>
        <PresetsLibraryModal
          isOpen={true}
          close={() => appStore.hidePresetsLibrary()}
        />
      </Show>
    </div>
  )
}
