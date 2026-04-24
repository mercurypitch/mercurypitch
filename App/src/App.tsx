/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/strict-boolean-expressions */
// ============================================================
// App — Main SolidJS application entry
// Matches the original JS app's HTML structure exactly
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { AppSidebar } from '@/components/AppSidebar'
import { FocusMode } from '@/components/FocusMode'
import { HistoryCanvas } from '@/components/HistoryCanvas'
import { LibraryModal } from '@/components/LibraryModal'
import { PianoRollCanvas } from '@/components/PianoRollCanvas'
import { PitchCanvas } from '@/components/PitchCanvas'
import { PresetsLibraryModal } from '@/components/PresetsLibraryModal'
import { ScaleBuilder } from '@/components/ScaleBuilder'
import { SessionBrowser } from '@/components/SessionBrowser'
import { SessionLibraryModal } from '@/components/SessionLibraryModal'
import { SessionPlayer } from '@/components/SessionPlayer'
import { SettingsPanel } from '@/components/SettingsPanel'
import type { PracticeSubMode } from '@/components/shared/SharedControlToolbar'
import { SharedControlToolbar } from '@/components/shared/SharedControlToolbar'
import { Walkthrough } from '@/components/Walkthrough'
import { WelcomeScreen } from '@/components/WelcomeScreen'
import { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackState as PianoRollPlaybackState } from '@/lib/piano-roll'
import type { PlaybackState as PlaybackEngineState } from '@/lib/playback-engine'
import type { PlaybackEvent } from '@/lib/playback-engine'
import { PlaybackEngine } from '@/lib/playback-engine'
import { PracticeEngine } from '@/lib/practice-engine'
import { buildMultiOctaveScale, melodyIndexAtBeat, melodyTotalBeats, midiToNote, } from '@/lib/scale-data'
import { hasSharedPresetInURL, loadFromURL } from '@/lib/share-url'
import { appStore } from '@/stores'
import type { InstrumentType, SessionHistoryEntry } from '@/stores/app-store'
import type { PresetData } from '@/stores/app-store'
import { getNoteAccuracyMap, getNotifications, showNotification } from '@/stores/app-store'
import { isLibraryModalOpen, isPresetsModalOpen, isSessionLibraryModalOpen } from '@/stores/app-store'
import { melodyStore } from '@/stores/melody-store'
import { playback } from '@/stores/playback-store'
import type { PitchPerfectWindow } from '@/types'
import type { PitchSample } from '@/types'
import type { EffectType, MelodyItem, NoteName, NoteResult, PitchResult, PracticeResult } from '@/types'

// Type alias for compatibility between PlaybackEngineState (with 'precount'/'complete')
// and PianoRollPlaybackState (only 'stopped'/'playing'/'paused')
type CompatiblePlaybackState =
  | 'stopped'
  | 'playing'
  | 'paused'
  | 'complete'
  | 'precount'

// Re-export PlaybackState types for use across components
export type { PlaybackEngineState, PianoRollPlaybackState }

// ── Engine instances (single shared) ────────────────────────
let audioEngine: AudioEngine
let playbackEngine: PlaybackEngine
let practiceEngine: PracticeEngine

/** Convert preset note data to melody items, preserving exact note properties */
function presetToMelody(preset: PresetData): MelodyItem[] {
  return preset.notes.map((n) => {
    // Use the scale data stored with the preset for accurate note lookup
    const scaleNote = preset.scale.find((s) => s.midi === n.midi)
    return {
      id: melodyStore.generateId(),
      note: {
        midi: n.midi,
        // Use stored scale data, fallback to computed from current scale
        name: (scaleNote?.name ??
          melodyStore.currentScale().find((s) => s.midi === n.midi)?.name ??
          'C') as NoteName,
        octave:
          scaleNote?.octave ??
          melodyStore.currentScale().find((s) => s.midi === n.midi)?.octave ??
          4,
        freq:
          scaleNote?.freq ??
          melodyStore.currentScale().find((s) => s.midi === n.midi)?.freq ??
          440,
      },
      startBeat: n.startBeat,
      duration: n.duration,
      effectType: n.effectType as EffectType | undefined,
      linkedTo: n.linkedTo,
    }
  })
}

/** Filter melody items based on practice sub-mode */
function _filterMelodyForPractice(
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

export type ActiveTab = 'practice' | 'editor' | 'settings'

interface AppProps {
  onMounted?: () => void
}

export const App: Component<AppProps> = (props) => {
  // ── Local reactive aliases for appStore signals ─────────────
  const activeTab = (): 'practice' | 'editor' | 'settings' =>
    appStore.activeTab()
  const showWelcome = () => appStore.showWelcome()
  const isFocusMode = () => appStore.focusMode()

  // Tab handlers - audio cleanup handled by handleTabChange
  const _handleTabPractice = () => void appStore.setActiveTab('practice')
  const _handleTabEditor = () => void appStore.setActiveTab('editor')
  const _handleTabSettings = () => void appStore.setActiveTab('settings')

  // ── Reset all playback-related state ─────────────────────────
  const resetPlaybackState = () => {
    void audioEngine.stopTone()
    void audioEngine.stopAllNotes()
    void playbackEngine.stop()
    void practiceEngine.endSession()
    playbackEngine.reset()
    setIsPlaying(false)
    setIsPaused(false)
    setEditorPlaybackState('stopped')
    setCurrentBeat(0)
    setCurrentNoteIndex(-1)
    melodyStore.setCurrentNoteIndex(-1)
    setPitchHistory([])
    setNoteResults([])
  }

  // ── Tab change handler with audio cleanup ───────────────────────────────────
  const handleTabChange = (newTab: ActiveTab) => {
    const currentTab = activeTab()

    // Stop audio when leaving practice or editor tabs - but preserve playback state for Editor tab
    if (currentTab === 'practice') {
      // Only reset for practice tab (practice tab has session-based playback)
      resetPlaybackState()
    } else if (currentTab === 'editor') {
      // For editor tab, just stop audio but don't reset entire state
      void audioEngine.stopAllNotes()
      void audioEngine.stopTone()
      void playbackEngine.stop()
      playbackEngine.reset()
      setEditorPlaybackState('stopped')
      setCurrentBeat(0)
      setCurrentNoteIndex(-1)
      melodyStore.setCurrentNoteIndex(-1)
    }

    // Switch to new tab
    appStore.setActiveTab(newTab)

    // Load a default melody for Practice tab if no melody exists
    if (newTab === 'practice' && melodyStore.getCurrentItems().length === 0) {
      // Build a default C Major scale melody (8 notes)
      const numOctaves = 1
      const scale = buildMultiOctaveScale(
        appStore.keyName(),
        melodyStore.currentOctave(),
        numOctaves,
        'major',
      )
      if (scale !== null && scale.length > 0) {
        const items = scale.slice(0, 8).map((note, i: number) => ({
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
    }
  }

  // ── Derived state ──────────────────────────────────────────

  const totalBeats = createMemo(() =>
    melodyTotalBeats(melodyStore.getCurrentItems()),
  )

  // ── Practice mode signals ───────────────────────────────────

  const [isPlaying, setIsPlaying] = createSignal(false)
  const [isPaused, setIsPaused] = createSignal(false)

  // ── Editor tab playback state ───────────────────────────────
  const [editorPlaybackState, setEditorPlaybackState] =
    createSignal<CompatiblePlaybackState>('stopped')
  const editorIsPlaying = () => editorPlaybackState() === 'playing'
  const editorIsPaused = () => editorPlaybackState() === 'paused'

  const [currentBeat, setCurrentBeat] = createSignal(0)
  const [currentNoteIndex, setCurrentNoteIndex] = createSignal(-1)
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
  const [currentCycle, setCurrentCycle] = createSignal<number>(1)
  const [practiceCycles, setPracticeCycles] = createSignal<number>(5)
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

  // ── Mobile sidebar toggle ─────────────────────────────────────
  const [sessionSummary, setSessionSummary] = createSignal<{
    score: number
    items: number
    name: string
  } | null>(null)

  // Track if we've already built the current session item's melody
  let builtSessionMelodyKey = ''
  let pendingSessionTransition = false

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
    }

    // Create PlaybackEngine - unified audio orchestration
    // Note: BPM is managed by appStore, passed to AudioEngine for timing
    playbackEngine = new PlaybackEngine({
      audioEngine,
      instrumentType: appStore.instrument(),
      metronomeEnabled: metronomeEnabled,
      countIn: 0,
      mode: playMode(),
    })

    // Setup playbackEngine callbacks
    playbackEngine.setCallbacks({
      onStateChange: (state) => {
        setEditorPlaybackState(state === 'precount' ? 'playing' : state)
      },
      onBeatUpdate: (beat) => {
        setCurrentBeat(beat)
      },
      onNoteStart: (item, noteIndex) => {
        setCurrentNoteIndex(noteIndex)
        setTargetPitch(item.note.freq)
        if (practiceEngine) {
          practiceEngine.onNoteStart(item.note, noteIndex)
        }
        // Play tone for the note — use the full note duration from the melody item
        const beatDurationMs = 60000 / appStore.bpm()
        const noteDurationMs = item.duration * beatDurationMs
        audioEngine.playTone(item.note.freq, noteDurationMs)
      },
      onNoteEnd: () => {
        audioEngine.stopTone()
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
      onCountIn: (beat) => {
        setCountInBeat(beat)
        setIsCountingIn(true)
        if (metronomeEnabled() && audioEngine) {
          audioEngine.playClick()
        }
      },
      onCountInComplete: () => {
        setIsCountingIn(false)
        setCountInBeat(0)
      },
      onMetronome: (beat, isDownbeat) => {
        if (metronomeEnabled() && audioEngine) {
          audioEngine.playMetronomeClick(isDownbeat)
        }
      },
    })

    // EXPOSE PLAYBACK ENGINE FOR E2E TESTING
    if (typeof window !== 'undefined') {
      ;(
        window as unknown as { __playbackEngine: PlaybackEngine }
      ).__playbackEngine = playbackEngine
    }

    practiceEngine = new PracticeEngine(audioEngine, { sensitivity: 5 })

    // Sync settings to PracticeEngine
    createEffect(() => {
      const s = appStore.settings()
      practiceEngine?.syncSettings({
        sensitivity: s.sensitivity,
        minConfidence: s.minConfidence,
        minAmplitude: s.minAmplitude,
        bands: s.bands.map((b) => ({ threshold: b.threshold, band: b.band })),
      } as any)
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
      if (audioEngine && type !== lastReverbType) {
        lastReverbType = type
        audioEngine.setReverbType(type as any)
      }
    })

    // Sync settings to playbackEngine when they change
    createEffect(() => {
      const bpm = appStore.bpm()
      const melody = melodyStore.getCurrentItems()
      const instrument = appStore.instrument()

      // Update AudioEngine with BPM and instrument
      audioEngine?.setBPM(bpm)
      audioEngine?.setInstrument(instrument)
      // Tell PlaybackEngine about new melody (BPM handled by AudioEngine)
      playbackEngine?.setMelody(melody)
    })

    // Keydown handler for playback control
    // Must be defined AFTER engines are initialized so they can be accessed
    const onKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input/select/textarea
      const isTyping = (e.target as Element | null)?.closest(
        'input,textarea,select,[contenteditable]',
      )

      if (e.code === 'Space' && !isTyping) {
        e.preventDefault()
        if (isFocusMode()) {
          if (isPlaying()) handlePause()
          else if (isPaused()) handleResume()
          else handlePlay()
        }
      }

      // Escape → exit focus mode, or stop playback
      if (e.code === 'Escape' && !isTyping) {
        e.preventDefault()
        if (isFocusMode()) {
          appStore.exitFocusMode()
        } else {
          handleStop()
          setCurrentBeat(0)
          playbackEngine.seekTo(0)
        }
      }

      // Home → go to beginning
      if (e.code === 'Home' && !isTyping) {
        e.preventDefault()
        setCurrentBeat(0)
        playbackEngine.seekTo(0)
        if (isPlaying()) {
          playbackEngine.seekTo(0)
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

      // O → Once mode
      if (e.code === 'KeyO' && !isTyping) {
        e.preventDefault()
        if (playMode() !== 'once') {
          setPlayMode('once')
          appStore.showNotification('Mode: Once', 'info')
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

    // EXPOSE PLAYBACK ENGINE FOR E2E TESTING
    if (typeof window !== 'undefined') {
      ;(
        window as unknown as { __playbackEngine: PlaybackEngine }
      ).__playbackEngine = playbackEngine
    }

    // Link practice callbacks
    if (practiceEngine) {
      practiceEngine.setCallbacks({
        onPitchDetected: (pitch) => {
          setCurrentPitch(pitch)
          if (pitch.frequency > 0 && pitch.clarity >= 0.2) {
            setFrequencyData(audioEngine?.getFrequencyData() ?? null)
          }
        },
        onNoteComplete: (result) => {
          setNoteResults((prev) => [...prev, result])
          // Update live score
          const allResults = [...noteResults(), result]
          setLiveScore(practiceEngine?.calculateScore(allResults) ?? null)
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
    }

    // Listen for preset events from piano roll
    const handlePresetSaved = (e: CustomEvent) => {
      appStore.showNotification(`Preset "${e.detail.name}" saved`, 'success')
    }
    const handlePresetLoaded = (e: CustomEvent) => {
      if (e.detail.bpm !== undefined && e.detail.bpm !== '') {
        appStore.setBpm(e.detail.bpm)
        audioEngine?.setBPM(e.detail.bpm)
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
      // Only allow seeking when playing or paused (not stopped)
      if (!playback.isPlaying() && !playback.isPaused()) return
      const targetBeat = e.detail.beat as number
      playbackEngine.seekTo(targetBeat)
      setCurrentBeat(targetBeat)
    }
    window.addEventListener(
      'pitchperfect:seekToBeat',
      handleSeek as EventListener,
    )

    // Listen to playbackEngine events for synchronization (both tabs)
    playbackEngine.on('beat', (e: { beat?: number }) => {
      setCurrentBeat(e.beat ?? 0)
      // Also update editor state
      if (activeTab() === 'editor') {
        // Editor uses melodyStore to track current note index
        melodyStore.setCurrentNoteIndex(
          melodyIndexAtBeat(melodyStore.getCurrentItems(), e.beat ?? 0),
        )
      }
      // Sync playback state to practice tab signals
      if (!appStore.sessionActive() || activeTab() !== 'practice') {
        setIsPlaying(playback.isPlaying)
        setIsPaused(playback.isPaused)
      }
    })
    playbackEngine.on('countIn', (e: { countIn?: number }) => {
      setCountInBeat(e?.countIn ?? 0)
      setIsCountingIn(true)
    })
    playbackEngine.on('countInComplete', () => {
      setIsCountingIn(false)
      setCountInBeat(0)
    })
    playbackEngine.on(
      'metronome',
      (e: { beat?: number; isDownbeat?: boolean }) => {
        if (metronomeEnabled() && audioEngine) {
          audioEngine.playMetronomeClick(e?.isDownbeat ?? false)
        }
      },
    )
    playbackEngine.on(
      'noteStart',
      (e: { note?: MelodyItem; index?: number }) => {
        const noteItem = e?.note
        setCurrentNoteIndex(e?.index ?? -1)
        setTargetPitch(noteItem?.note?.freq ?? 440)
        if (noteItem) {
          practiceEngine.onNoteStart(noteItem.note!, e?.index ?? -1)
          const beatDurationMs = 60000 / appStore.bpm()
          const noteDurationMs = noteItem.duration ?? 1 * beatDurationMs
          audioEngine.playTone(noteItem.note.freq, noteDurationMs)
        }
        // Also update editor state
        if (activeTab() === 'editor') {
          melodyStore.setCurrentNoteIndex(e?.index ?? -1)
        }
      },
    )
    playbackEngine.on('noteEnd', () => {
      audioEngine.stopTone()
    })
    playbackEngine.on('state', (e: PlaybackEvent) => {
      setEditorPlaybackState(e.state ?? 'stopped')
      if (activeTab() === 'editor') {
        setIsPlaying(editorIsPlaying())
        setIsPaused(editorIsPaused())
      }
    })

    playbackEngine.on('complete', () => {
      practiceEngine.onPlaybackComplete()
      console.info(
        '[onComplete] fired, mode:',
        playMode(),
        'sessionMode:',
        appStore.sessionMode(),
        'idx:',
        appStore.sessionItemIndex(),
      )

      // Handle session mode: record result and advance/end session
      if (appStore.sessionMode() && playMode() === 'practice') {
        const currentScore = liveScore()
        console.info(
          '[onComplete] session handler, score:',
          currentScore,
          'idx:',
          appStore.sessionItemIndex(),
        )
        if (currentScore !== null) {
          appStore.recordSessionItemResult(currentScore)
        }

        // Check if more items remain
        const current = appStore.getCurrentSessionItem()
        console.info('[onComplete] current:', current?.label, current?.type)
        if (current) {
          const session = appStore.practiceSession()
          const idx = appStore.sessionItemIndex()
          console.info(
            '[onComplete] idx:',
            idx,
            'total:',
            session?.items.length,
          )
          if (idx < (session?.items.length ?? 0) - 1) {
            // More items — advance to next session item, rebuild melody, restart engine
            appStore.advanceSessionItem()
            console.info(
              '[onComplete] advanced, new idx:',
              appStore.sessionItemIndex(),
              'repeat:',
              appStore.currentSessionItemRepeat(),
            )
            setNoteResults([])
            setLiveScore(null)
            setCurrentBeat(0)
            setCurrentNoteIndex(-1)
            melodyStore.setCurrentNoteIndex(-1)
            setPitchHistory([])
            practiceEngine.resetSession()
            // Load next item and restart engine (don't call handleStop — it resets isPlaying)
            const nextItem = appStore.getCurrentSessionItem()
            console.info(
              '[onComplete] nextItem:',
              nextItem?.label,
              nextItem?.type,
            )
            if (nextItem && nextItem.type === 'rest') {
              // Rest item — start the melody engine so onComplete fires (rest has a silent note)
              // Then in onComplete, we'll handle the rest delay before building the real scale
              const restDuration = nextItem.restMs ?? 2000
              console.info(
                '[onComplete] starting rest item, duration:',
                restDuration,
                'ms',
              )
              playbackEngine.stop()
              playbackEngine.setMelody(melodyStore.getCurrentItems())
              // BPM synced via AudioEngine in the createEffect above
              playbackEngine.start()
              // Store the rest duration so onComplete knows to wait before loading next scale
              // We do this by setting a flag on the melodyStore or checking the item repeat count
              // Actually, let's use a simpler approach: the onComplete for rest items will
              // detect rest items by checking if getCurrentSessionItem().type === 'rest'
              // and call advanceSessionItem() then wait restDuration before loading the scale
              console.info('[onComplete] rest timeout for', restDuration, 'ms')
              setTimeout(() => {
                console.info(
                  '[onComplete rest timeout] firing, idx:',
                  appStore.sessionItemIndex(),
                )
                const afterRest = appStore.getCurrentSessionItem()
                console.info(
                  '[onComplete rest timeout] afterRest:',
                  afterRest?.label,
                  afterRest?.type,
                )
                if (afterRest && afterRest.type === 'scale') {
                  console.info(
                    '[onComplete rest timeout] building scale:',
                    afterRest.label,
                  )
                  // Check if this scale was already built for this item to avoid loop
                  const afterRestKey = getSessionItemKey(afterRest)
                  if (builtSessionMelodyKey === afterRestKey) {
                    console.info(
                      '[onComplete rest timeout] already built, skipping',
                    )
                    return
                  }
                  // Mark transition in progress so createEffect doesn't fire
                  pendingSessionTransition = true
                  builtSessionMelodyKey = afterRestKey
                  // Reset for new item
                  setCurrentCycle(1)
                  setAllCycleResults([])
                  setIsPracticeComplete(false)
                  buildScaleMelody(
                    afterRest.scaleType ?? 'major',
                    afterRest.beats ?? 8,
                    afterRest.label,
                  )
                  playbackEngine.stop()
                  playbackEngine.setMelody(melodyStore.getCurrentItems())
                  // BPM synced via AudioEngine in the createEffect above
                  console.info(
                    '[onComplete rest timeout] starting playbackEngine',
                  )
                  playbackEngine.start()
                }
                // If afterRest is still 'rest', onComplete will handle it on the next cycle
              }, restDuration)
            } else if (nextItem && nextItem.type === 'scale') {
              console.info('[onComplete] building scale:', nextItem.label)
              // Check if this scale was already built for this item to avoid loop
              const nextItemKey = getSessionItemKey(nextItem)
              if (builtSessionMelodyKey === nextItemKey) {
                console.info('[onComplete] already built, skipping')
                return
              }
              pendingSessionTransition = true
              builtSessionMelodyKey = nextItemKey
              // Reset for new item
              setCurrentCycle(1)
              setAllCycleResults([])
              setIsPracticeComplete(false)
              buildScaleMelody(
                nextItem.scaleType ?? 'major',
                nextItem.beats ?? 8,
                nextItem.label,
              )
              playbackEngine.stop()
              playbackEngine.setMelody(melodyStore.getCurrentItems())
              // BPM synced via AudioEngine in the createEffect above
              console.info('[onComplete rest timeout] starting playbackRuntime')
              playbackEngine.start()
            }
          }
        }
      }
    })

    // Animation loop for pitch history
    let animId: number
    const loop = () => {
      const pitch = practiceEngine.update()
      // During free recording, compute beat from performance.now() independently.
      // During playback-backed recording, use playbackEngine's beat position.

      const perfNow = (performance as unknown as { now: () => number }).now()
      const beat = isRecording()
        ? ((perfNow - freeRecordStartTime) / 60000) * appStore.bpm()
        : playbackEngine.getCurrentBeat()
      if (pitch && pitch.frequency > 0 && pitch.clarity >= 0.2) {
        // Use beat time for samples during playback, real time for recording
        const sampleTime = isRecording()
          ? perfNow
          : (beat * 60000) / appStore.bpm()
        setPitchHistory((prev) => {
          const next = [
            ...prev,
            {
              freq: pitch.frequency,
              time: sampleTime,
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
      playbackEngine.destroy()
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
  // All engine operations are now handled by engine-bridge module

  const handlePlay = () => {
    if (isPaused()) {
      // Resume from paused state
      handleResume()
      return
    }

    setIsPlaying(true)
    setIsPaused(false)

    // Start playbackEngine for practice mode (when not in a session)
    if (!appStore.sessionActive()) {
      if (playbackEngine.isPlaying) {
        // Already playing, just reset for fresh start
        playbackEngine.stop()
      }
      playbackEngine.setMelody(melodyStore.getCurrentItems())
      playbackEngine.start()
    }
  }

  const handlePause = () => {
    if (!playbackEngine.isPlaying) {
      return
    }
    setIsPlaying(false)
    setIsPaused(true)

    // Pause playbackEngine for practice mode
    if (!appStore.sessionActive()) {
      playbackEngine.pause()
    }
  }

  const handleResume = () => {
    if (!playbackEngine.isPaused) {
      return
    }
    setIsPlaying(true)
    setIsPaused(false)
    playbackEngine.resume()
  }

  const handleStop = () => {
    setIsPlaying(false)
    setIsPaused(false)
    setCurrentBeat(0)
    setCurrentNoteIndex(-1)
    melodyStore.setCurrentNoteIndex(-1)
    setPitchHistory([])
    appStore.setSessionActive(false)

    // Always stop playbackEngine (practice mode)
    playbackEngine.stop()

    // Also reset editor state
    setEditorPlaybackState('stopped')
  }

  const handleReset = () => {
    handleStop()
    setNoteResults([])
    setPracticeResult(null)
    setLiveScore(null)
    // Reset practice mode state
    setAllCycleResults([])
    setCurrentCycle(1)
    setIsPracticeComplete(false)
  }

  /** Build a scale-based melody for session items */
  const buildScaleMelody = (
    scaleType: string,
    beats: number,
    _label?: string,
  ) => {
    const numOctaves = beats > 12 ? 2 : 1
    const scale = buildMultiOctaveScale(
      appStore.keyName(),
      melodyStore.currentOctave(),
      numOctaves,
      scaleType,
    )
    if (scale === null || scale === undefined || scale.length === 0) return

    // Use ALL notes from the scale (no 8-note cap) — respect the beats parameter
    const noteCount = Math.min(scale.length, beats)
    const items: MelodyItem[] = scale
      .slice(0, noteCount)
      .map((note, i: number) => ({
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

  /** Get unique key for a session item */
  const getSessionItemKey = (item: {
    scaleType?: string
    beats?: number
    label?: string
  }) => {
    return `${item.scaleType ?? 'major'}-${item.beats ?? 8}-${item.label ?? 'scale'}`
  }

  /** Handle session skip — advance to next item or end session */
  const handleSessionSkip = () => {
    handleStop()
    builtSessionMelodyKey = '' // Clear flag for next item

    const session = appStore.practiceSession()
    const idx = appStore.sessionItemIndex()
    if (session && idx < session.items.length - 1) {
      pendingSessionTransition = true
      appStore.advanceSessionItem()
      const nextItem = appStore.getCurrentSessionItem()
      if (nextItem) {
        if (nextItem.type === 'scale') {
          // Don't build here - let createEffect handle it
          // Just update the play mode and start playback
          setPlayMode('practice')
          setPracticeCycles(1)
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
      builtSessionMelodyKey = ''
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

  /** Handle session item change when it advances */
  createEffect(() => {
    // Initialize effect once when entering session mode
    if (!appStore.sessionMode()) return

    const item = appStore.getCurrentSessionItem()
    // Only rebuild for scale items - rest items trigger rest timeout callback instead
    if (item && item.type === 'scale') {
      const itemKey = `${item.scaleType}-${item.beats}-${item.label}`
      // Only rebuild if this is a NEW item (different from what was built)
      // AND we're not in the middle of a pending transition (e.g., rest timeout)
      if (builtSessionMelodyKey !== itemKey && !pendingSessionTransition) {
        console.log('[createEffect] new session item:', item.label)
        builtSessionMelodyKey = itemKey
        buildScaleMelody(item.scaleType ?? 'major', item.beats ?? 8, item.label)
      }
    }
  })

  /** Auto-play melody when loaded from library */
  createEffect(() => {
    // Check if melody library key is in window for auto-play trigger
    if (
      typeof window !== 'undefined' &&
      (window as PitchPerfectWindow).__autoPlayMelody
    ) {
      console.log(
        '[createEffect] detected window.__autoPlayMelody:',
        (window as PitchPerfectWindow).__autoPlayMelody,
      )
      const melodyKey = (window as PitchPerfectWindow).__autoPlayMelody
      delete (window as PitchPerfectWindow).__autoPlayMelody // Clear after processing

      // Only auto-play if not already in a session
      if (!appStore.sessionActive()) {
        console.log('[createEffect] auto-playing melody:', melodyKey)
        // Use a small delay to ensure the melody is loaded
        setTimeout(() => void handlePlay(), 300)
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
        const beat = playbackEngine.getCurrentBeat()
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
        melodyStore.setMelody([...melodyStore.getCurrentItems(), ...items])
      }
      setRecordedMelody([])
      currentNoteMidi = -1
      currentNoteStartBeat = -1
      setIsRecording(false)
      appStore.setActiveTab('editor')
    } else {
      // Start recording
      const micOk = (await practiceEngine?.startMic()) ?? false
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
    if (melodyStore.getCurrentItems().length > 0) {
      // Transpose all notes by the octave delta
      const MIDI_OCTAVE_SHIFT = 12
      const transposed = melodyStore.getCurrentItems().map((item) => ({
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
    if (idx < 0 || idx >= melodyStore.getCurrentItems().length) return null
    return melodyStore.getCurrentItems()[idx].note
  })

  const targetNoteName = createMemo(() => {
    const note = targetNote()
    if (!note) return null
    return note.name + note.octave
  })

  // ── Accuracy heatmap ───────────────────────────────────────

  const noteAccuracyMap = createMemo(() => {
    // Track session history so this recomputes when history changes
    void appStore.sessionHistory().length
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
      {/* Welcome screen overlay (GH #131) */}
      <Show when={showWelcome()}>
        <WelcomeScreen onEnableMic={handleMicToggle} />
      </Show>
      <Walkthrough />

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
      <Show when={!isFocusMode()}>
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
              <Show when={melodyStore.getCurrentItems().length > 0}>
                <span class="tab-badge">
                  {melodyStore.getCurrentItems().length}
                </span>
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
            onPresetLoad={(preset) => {
              melodyStore.setMelody(presetToMelody(preset))
              if (preset.bpm) {
                appStore.setBpm(preset.bpm)
                // BPM already set via appStore.setBpm() above
              }
            }}
            onOctaveShift={handleOctaveShift}
            onOpenScaleBuilder={() => setShowScaleBuilder(true)}
            melody={() => melodyStore.getCurrentItems()}
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
                  onStop={handleReset}
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
                  practiceCycles={() => practiceCycles()}
                  onCyclesChange={setPracticeCycles}
                  currentCycle={() => currentCycle()}
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
                    melody={() => melodyStore.getCurrentItems()}
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
                onPlay={() => {
                  // Start shared playbackEngine for audio playback
                  playbackEngine.setMelody(melodyStore.getCurrentItems())
                  void playbackEngine.start()
                }}
                onPause={() => {
                  // Pause the shared playbackEngine
                  playbackEngine.pause()
                }}
                onResume={() => {
                  // Resume the shared playbackEngine
                  playbackEngine.resume()
                }}
                onStop={() => {
                  // Stop both shared playbackEngine and reset editor state
                  void playbackEngine.stop()
                  setEditorPlaybackState('stopped')
                }}
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
                currentCycle={() => 1}
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
                onSaveMelody={() => {
                  const melody = melodyStore.getCurrentItems()
                  if (melody.length === 0) {
                    showNotification('No melody to save', 'warning')
                    return
                  }
                  const saved = melodyStore.saveCurrentMelody()
                  showNotification(`Melody saved: ${saved.name}`, 'success')
                }}
                onSaveMelodyLabel="Save"
              />
              <PianoRollCanvas
                melody={() => melodyStore.getCurrentItems()}
                scale={() => melodyStore.currentScale()}
                bpm={() => appStore.bpm()}
                totalBeats={() => totalBeats()}
                playbackState={() => {
                  const s = editorPlaybackState()
                  return s === 'precount' || s === 'complete' ? 'stopped' : s
                }}
                currentNoteIndex={() => melodyStore.currentNoteIndex()}
                currentBeat={currentBeat}
                isPlaying={editorIsPlaying}
                isPaused={editorIsPaused}
                isScrolling={() => false}
                targetPitch={() => null}
                noteAccuracyMap={() => new Map()}
                onMelodyChange={(melody) => {
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

            <Show when={activeTab() === 'settings'}>
              <div id="settings-panel">
                <SettingsPanel />
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Focus Mode — full-screen minimal practice UI */}
      <Show when={isFocusMode()}>
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
                  <For each={appStore.sessionHistory().slice(0, 10)}>
                    {(session: SessionHistoryEntry) => (
                      <div
                        class="history-bar"
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

      {/* Library Modal */}
      <LibraryModal
        isOpen={isLibraryModalOpen()}
        close={() => appStore.hideLibrary()}
      />

      {/* Presets Library Modal */}
      <PresetsLibraryModal
        isOpen={isPresetsModalOpen()}
        close={() => appStore.hidePresetsLibrary()}
      />

      {/* Session Library Modal */}
      <SessionLibraryModal
        isOpen={isSessionLibraryModalOpen()}
        close={() => appStore.hideSessionLibrary()}
      />

      {/* Notification Toast */}
      <For each={(() => getNotifications() as unknown as Array<{ type: 'info' | 'success' | 'warning' | 'error', message: string }>)()}>
        {(notif) => (
          <div
            class="notification-toast"
            classList={{
              'notification-toast--info': notif.type === 'info',
              'notification-toast--success': notif.type === 'success',
              'notification-toast--warning': notif.type === 'warning',
              'notification-toast--error': notif.type === 'error',
            }}
          >
            <span class="notification-toast-icon">
              {notif.type === 'success' && '✓'}
              {notif.type === 'warning' && '⚠'}
              {notif.type === 'error' && '✕'}
              {notif.type === 'info' && 'ℹ'}
            </span>
            <span class="notification-toast-message">{notif.message}</span>
          </div>
        )}
      </For>
    </div>
  )
}
