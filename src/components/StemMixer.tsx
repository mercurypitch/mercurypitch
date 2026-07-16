// ============================================================
// StemMixer — Play separated stems with volume control & pitch viz
// ============================================================

import type { Accessor, Component } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show, } from 'solid-js'
import { rmsOfAnalyser } from '@/features/mic-feedback/mic-level'
import { useMicInsights } from '@/features/mic-feedback/useMicInsights'
import { createMelodySynth } from '@/features/stem-mixer/melody-synth'
import { useStemMixerAudioController } from '@/features/stem-mixer/useStemMixerAudioController'
import { useStemMixerCanvasController } from '@/features/stem-mixer/useStemMixerCanvasController'
import { useStemMixerLayoutController } from '@/features/stem-mixer/useStemMixerLayoutController'
import { useStemMixerLyricsController } from '@/features/stem-mixer/useStemMixerLyricsController'
import { useStemMixerMicController } from '@/features/stem-mixer/useStemMixerMicController'
import { useStemMixerPitchAnalysisController } from '@/features/stem-mixer/useStemMixerPitchAnalysisController'
import { PREMIUM_FEATURES } from '@/lib/defaults'
import { extractTitle } from '@/lib/lyrics-service'
import type { ComparisonPoint } from '@/lib/mic-scoring'
import type { MidiNoteEvent } from '@/lib/midi-generator'
import type { MergedNote, PitchDetection } from '@/lib/midi-generator'
import { mergeConsecutiveNotes } from '@/lib/midi-generator'
import type { AlignmentResult } from '@/lib/pitch-word-alignment'
import { lrcEntriesToSegments } from '@/lib/pitch-word-alignment'
import { freqToMidi } from '@/lib/scale-data'
import { createPersistedSignal } from '@/lib/storage'
import { computeAlignment, formatAlignmentDebugLog, logAlignmentComparison, } from '@/lib/transcription-alignment-utils'
import { useWhisperTranscription } from '@/lib/useWhisperTranscription'
import * as playlist from '@/stores/karaoke-playlist-store'
import { showNotification } from '@/stores/notifications-store'
import { karaokeFocus, setKaraokeFocus } from '@/stores/ui-store'
import { recordActivity } from '@/stores/usage-store'
import { ChevronLeft, Maximize2, Minimize2, Music, Settings, Share, SkipBack, SkipForward, X, } from './icons'
import { KaraokePlaylistOverlay } from './KaraokePlaylistOverlay'
import { KaraokePlaylistSidebar } from './KaraokePlaylistSidebar'
import { KaraokePlaylistSummary } from './KaraokePlaylistSummary'
import { StemMixerEditToolbar } from './StemMixerEditToolbar'
import { StemMixerFixedWorkspace } from './StemMixerFixedWorkspace'
import { StemMixerGridWorkspace } from './StemMixerGridWorkspace'
import { StemMixerPerformanceWorkspace } from './StemMixerPerformanceWorkspace'
import { StemMixerPitchAnalysisPanel } from './StemMixerPitchAnalysisPanel'
import { StemMixerScoreModal } from './StemMixerScoreModal'
import { StemMixerTransport } from './StemMixerTransport'

// ── Types ──────────────────────────────────────────────────────

interface StemMixerProps {
  stems: {
    vocal?: string
    instrumental?: string
    vocalMidi?: string
  }
  sessionId: string
  songTitle: string
  practiceMode?: 'vocal' | 'instrumental' | 'full' | 'midi'
  /** Which stems the user requested to see -- only these appear in tracks().
   *  Undefined = show all loaded stems (backwards-compat). */
  requestedStems?: { vocal?: boolean; instrumental?: boolean; midi?: boolean }
  /** Initial seek position in seconds (e.g. from Shazam match offset) */
  initialSeekSec?: number
  /** Auto-play after stems finish loading */
  autoPlay?: boolean
  /** Karaoke playlist mode: silence the vocal but keep it as scoring reference. */
  karaokeReferenceVocal?: boolean
  /** Rendering preset. 'studio' (default) is the full in-app toolset; the
   *  standalone karaoke page uses 'performance' — a clean stage without the
   *  pitch-analysis/edit tooling. */
  preset?: 'studio' | 'performance'
  /** Guided-tour hook, injected by the studio app ('mount' = the one-time
   *  offer toast, 'button' = the header Tour button). Leaving it undefined
   *  removes the tour UI — and keeps the tour engine (app-store) out of
   *  standalone entry bundles. */
  onOfferTour?: (trigger: 'mount' | 'button') => void
  onBack?: () => void
}

interface StemTrack {
  label: string
  url: string
  color: string
  buffer: AudioBuffer | null
  gainNode: GainNode | null
  analyserNode: AnalyserNode | null
  sourceNode: AudioBufferSourceNode | null
  muted: boolean
  soloed: boolean
  volume: number
}

// ── Constants ──────────────────────────────────────────────────

interface SmWindow {
  __smKeydown?: (e: KeyboardEvent) => void
  __smResizeMove?: (e: PointerEvent) => void
  __smResizeEnd?: (e: PointerEvent) => void
}

// ── Circular Progress ──────────────────────────────────────────

const CircularProgress = (props: { pct: number; size?: number }) => {
  const m = createMemo(() => {
    const s = props.size ?? 24
    const r = (s - 4) / 2
    const circ = 2 * Math.PI * r
    const offset = circ * (1 - props.pct / 100)
    return { s, r, circ, offset }
  })
  return (
    <svg
      width={m().s}
      height={m().s}
      viewBox={`0 0 ${m().s} ${m().s}`}
      class="circular-progress"
    >
      <circle
        cx={m().s / 2}
        cy={m().s / 2}
        r={m().r}
        fill="none"
        stroke="var(--border, #30363d)"
        stroke-width="2"
      />
      <circle
        cx={m().s / 2}
        cy={m().s / 2}
        r={m().r}
        fill="none"
        stroke="var(--accent, #8b5cf6)"
        stroke-width="2"
        stroke-dasharray={String(m().circ)}
        stroke-dashoffset={String(m().offset)}
        stroke-linecap="round"
        transform={`rotate(-90 ${m().s / 2} ${m().s / 2})`}
      />
    </svg>
  )
}

// ── Component ──────────────────────────────────────────────────

export const StemMixer: Component<StemMixerProps> = (props) => {
  // ── State ────────────────────────────────────────────────────
  const [midiNotes, setMidiNotes] = createSignal<MidiNoteEvent[]>([])
  const [anySoloed, setAnySoloed] = createSignal(false)
  const [shareToast, setShareToast] = createSignal('')

  // ── Karaoke Focus Mode ────────────────────────────────────────
  const [showWaveform, setShowWaveform] = createSignal(true)
  const [showPitch, setShowPitch] = createSignal(true)
  const [showLyrics, setShowLyrics] = createSignal(true)
  const [karaokeToolbarPosition, setKaraokeToolbarPosition] =
    createPersistedSignal<'top' | 'bottom' | 'left' | 'right'>(
      'karaoke_toolbar_position',
      'bottom',
    )

  // Esc key to exit focus mode
  createEffect(() => {
    if (!karaokeFocus()) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setKaraokeFocus(false)
    }
    document.addEventListener('keydown', handler)
    onCleanup(() => document.removeEventListener('keydown', handler))
  })

  const PITCH_WINDOW_FILL_RATIO = 0.75

  const lrclibSearchUrl = () => {
    const title = extractTitle(props.songTitle ?? '')?.trim()
    if (!title) return 'https://lrclib.net'
    return `https://lrclib.net/search/${encodeURIComponent(title)}`
  }

  let workspaceRef: HTMLDivElement | undefined
  let lyricsFileInputRef: HTMLInputElement | undefined

  const vocalTrack = (): StemTrack => ({
    label: 'Vocal',
    url: props.stems.vocal ?? '',
    color: '#f59e0b',
    buffer: null,
    gainNode: null,
    analyserNode: null,
    sourceNode: null,
    // Karaoke playlist mode: vocal starts muted (kept only as the silent
    // scoring reference). Unmute it to hear a guide vocal.
    muted: props.karaokeReferenceVocal === true,
    soloed: false,
    volume: 0.8,
  })

  const instTrack = (): StemTrack => ({
    label: 'Instrumental',
    url: props.stems.instrumental ?? '',
    color: '#3b82f6',
    buffer: null,
    gainNode: null,
    analyserNode: null,
    sourceNode: null,
    muted: false,
    soloed: false,
    volume: 0.8,
  })

  const [vocal, setVocal] = createSignal<StemTrack>(vocalTrack())
  const [instrumental, setInstrumental] = createSignal<StemTrack>(instTrack())

  const midiTrack = (): StemTrack => ({
    label: 'MIDI',
    url: '',
    color: '#8b5cf6',
    buffer: null,
    gainNode: null,
    analyserNode: null,
    sourceNode: null,
    muted: false,
    soloed: false,
    volume: 0.8,
  })
  const [midi, setMidi] = createSignal<StemTrack>(midiTrack())

  const tracks = () => {
    const req = props.requestedStems
    const show = (stem: string) => {
      if (!req) return true
      return req[stem as keyof typeof req] === true
    }
    const t: StemTrack[] = []
    if (show('vocal')) t.push(vocal())
    if (show('instrumental')) t.push(instrumental())
    if (show('midi') && midi().buffer) t.push(midi())
    return t.filter((tr) => !!(tr.url || tr.buffer))
  }

  // Mutable holders for audio ctx — backfilled after audio controller is created.
  // Mic controller accesses these dynamically, resolving the circular dependency.
  const audioCtxForMic = {
    getAudioCtx: (() => undefined) as () => AudioContext | null | undefined,
    ensureAudioCtx: (() => ({}) as AudioContext) as () => AudioContext,
  }

  // ── Mic / Scoring controller ─────────────────────────────────
  const mic = useStemMixerMicController({
    getAudioCtx: () => audioCtxForMic.getAudioCtx(),
    ensureAudioCtx: () => audioCtxForMic.ensureAudioCtx(),
  })

  // Mutable holders — backfilled after canvas/lyrics controllers are created.
  // Audio controller accesses these dynamically (not at construction time), so
  // the indirection through mutable refs resolves the circular dependency.
  const canvasForAudio = {
    syncCanvasSizes: () => {},
    drawWaveformOverview: () => {},
    drawLiveWaveform: () => {},
    drawPitchCanvas: () => {},
    drawMidiCanvas: () => {},
  }
  let updateCurrentLineForAudio = () => {}
  let setCurrentLineIdxForAudio = (_idx: number) => {}
  let setUserScrolledForAudio = (_v: boolean) => {}

  // ── Audio controller ─────────────────────────────────────────
  const audio = useStemMixerAudioController({
    vocal,
    setVocal,
    instrumental,
    setInstrumental,
    midi,
    setMidi,
    tracks,
    anySoloed,
    PITCH_WINDOW_FILL_RATIO,
    midiNotes,
    setMidiNotes,
    canvas: canvasForAudio,
    updateCurrentLine: () => updateCurrentLineForAudio(),
    setCurrentLineIdx: setCurrentLineIdxForAudio,
    setUserScrolled: setUserScrolledForAudio,
    micActive: mic.micActive,
    getMicAnalyserNode: mic.getMicAnalyserNode,
    getMicPitchDetector: mic.getMicPitchDetector,
    getMicPitchHistory: mic.getMicPitchHistory,
    setMicPitch: mic.setMicPitch,
    comparisonData: mic.comparisonData,
    setComparisonData: mic.setComparisonData,
    toleranceCents: mic.toleranceCents,
    resetMicPitchHistory: mic.resetMicPitchHistory,
    computeScore: mic.computeScore,
    setScore: mic.setScore,
    setShowScore: mic.setShowScore,
    resetScore: mic.resetScore,
    /* eslint-disable solid/reactivity */
    stems: props.stems,
    practiceMode: props.practiceMode,
    requestedStems: props.requestedStems,
    songTitle: props.songTitle,
    /* eslint-enable solid/reactivity */
    karaokeReferenceVocal: () => props.karaokeReferenceVocal === true,
    onPlaybackEnded: () => handlePlaylistSongEnded(),
    showNotification,
  })

  // Backfill audio ctx holders for mic controller
  audioCtxForMic.getAudioCtx = () => audio.getAudioCtx()
  audioCtxForMic.ensureAudioCtx = () => audio.ensureAudioCtx()

  // Mic feedback: "can't hear you" / "too quiet" while a song plays.
  const micInsights = useMicInsights({
    micActive: mic.micActive,
    isPlaying: audio.playing,
    getLevel: () => rmsOfAnalyser(mic.getMicAnalyserNode()),
    isDetecting: () => (mic.micPitch()?.frequency ?? 0) > 0,
  })

  // Each karaoke playback counts as real app usage (gates the survey).
  // Edge-triggered via on() so the effect depends only on the playing flag.
  createEffect(
    on(audio.playing, (playing) => {
      if (playing) recordActivity()
    }),
  )

  // ── Karaoke playlist integration ─────────────────────────────
  const [playlistSidebarOpen, setPlaylistSidebarOpen] = createPersistedSignal(
    'sm-karaoke-playlist-sidebar',
    false,
  )
  // True between a natural song end and the score modal being dismissed, so we
  // advance the playlist only after the user has seen their score.
  let pendingAdvance = false
  let playStarted = false

  // True when this StemMixer instance is the playlist's current song (guards
  // the brief window where a new song is loading and a stale instance lingers).
  const isCurrentPlaylistSong = () =>
    playlist.isPlaylistActive() &&
    playlist.currentSong()?.sessionId === props.sessionId

  /** Called by the audio controller when the track ends naturally. */
  const handlePlaylistSongEnded = () => {
    if (!isCurrentPlaylistSong() || playlist.phase() !== 'playing') return
    if (mic.micActive() && mic.comparisonData().length > 0) {
      // handleStop() will show the score modal — advance when it closes.
      pendingAdvance = true
    } else {
      playlist.reportSongScore(null)
      playlist.advance()
    }
  }

  /** Overlay "Start": request the mic (user gesture) then run the countdown. */
  const handlePlaylistStart = () => {
    if (!mic.micActive()) {
      void mic.toggleMic().finally(() => playlist.beginCountdown())
    } else {
      playlist.beginCountdown()
    }
  }

  // Manual playlist transport (header controls). Pause first — without scoring —
  // so audio stops even when the action doesn't remount the mixer (skipping the
  // last song into the summary, or stopping the playlist).
  const handlePlaylistPrev = () => {
    audio.handlePause()
    playlist.prev()
  }
  const handlePlaylistNext = () => {
    audio.handlePause()
    playlist.advance()
  }
  const handlePlaylistStopAll = () => {
    audio.handlePause()
    playlist.stopPlaylist()
  }

  // Start playback once the countdown flips the phase to 'playing'. Wait for a
  // real duration too: if the countdown ends before this song's stems finish
  // decoding, starting at duration 0 makes the end-detector fire on the first
  // frame and the song is skipped instantly. The effect re-runs when duration
  // arrives, so a slow-loading song just starts a beat later.
  createEffect(() => {
    if (
      isCurrentPlaylistSong() &&
      playlist.phase() === 'playing' &&
      !playStarted &&
      !audio.loading() &&
      !audio.loadError() &&
      audio.duration() > 0
    ) {
      playStarted = true
      audio.handlePlay()
      // Get the playlist builder out of the way once the song is playing.
      setPlaylistSidebarOpen(false)
    }
  })

  // Reflect the playing song in the browser tab title.
  const baseDocTitle = typeof document !== 'undefined' ? document.title : ''
  createEffect(() => {
    if (typeof document === 'undefined') return
    const songName = (props.songTitle ?? '').replace(/\.[^.]+$/, '').trim()
    document.title =
      audio.playing() && songName ? `MercuryPitch — ${songName}` : baseDocTitle
  })
  onCleanup(() => {
    if (typeof document !== 'undefined') document.title = baseDocTitle
  })

  const handleSeek = (e: MouseEvent) => {
    if (!audio.duration()) return
    const bar = e.currentTarget as HTMLDivElement
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const target = ratio * audio.duration()
    audio.seekTo(target)
  }

  // ── Lyrics controller ─────────────────────────────────────────
  const {
    // Signals
    lyricsAlign,
    setLyricsAlign,
    lyricsLines,
    lrcLines,
    currentLineIdx,
    lyricsSource,
    lyricsLoading,
    songMatches,
    showSongPicker,
    setShowSongPicker,
    songPickerQuery,
    setSongPickerQuery,
    lyricsFontSize,
    setLyricsFontSize,
    lyricsColumns,
    setLyricsColumns,
    editMode,
    setEditMode,
    setEditBuffer,
    editPopover,
    lrcGenMode,
    lrcGenLineIdx,
    lrcGenWordIdx,
    blocks,
    blockInstances,
    blockMarkMode,
    setBlockMarkMode,
    markStartLine,
    setMarkStartLine,
    markEndLine,
    setMarkEndLine,
    blockEditTarget,
    setBlockEditTarget,
    setUserScrolled,
    setCurrentLineIdx,

    // Memos
    canonicalLrcLines,
    stableParsedLyrics,
    blockStarts,
    displayLines,
    genViewData,

    // Actions — lyrics loading
    loadLyrics,
    cancelSearch,
    handleForceSearch,
    handleSongPickerRefine,
    handleSongPick,
    handleLyricsUpload,
    handleLyricsChange,

    // Actions — playback tracking
    updateCurrentLine,
    computeActiveWord,

    // Actions — lyric line click
    handleLyricLineClick,

    // Actions — edit mode
    toggleEditMode,
    handleLineTimeEdit,
    getEditWordTime,
    getEditLineTime,
    handleSaveEdits,
    openWordPopover,
    closeWordPopover,
    commitPopoverValue,
    formatTimeMs,

    // Actions — LRC gen
    startLrcGen,
    handleNextLine,
    handleNextWord,
    handleLrcGenFinish,
    handleLrcGenReset,
    handleDownloadLrc,
    getGenLines,

    // Actions — block management
    handleMarkBlock,
    handleUnlinkInstance,
    handleDeleteBlock,
    handleAddInstance,
    handleEditBlock,
    getBlockColor,
    getBlockById,
    getBlockForLine,

    // Loop lyrics
    loopStartLyricIdx,
    setLoopStartLyricIdx,
    loopEndLyricIdx,
    setLoopEndLyricIdx,
    handleSetLoopLyric,

    // Helpers
    hasMultipleSections,
  } = useStemMixerLyricsController({
    /* eslint-disable solid/reactivity */
    sessionId: props.sessionId,
    songTitle: props.songTitle,
    /* eslint-enable solid/reactivity */
    duration: audio.duration,
    playing: audio.playing,
    elapsed: audio.elapsed,
    seekToWithWindow: (t: number) => {
      audio.seekTo(t)
      audio.setWindowStart(Math.max(0, t - audio.windowDuration() * 0.3))
    },
    // The standalone karaoke stage reads from across the room: big centered
    // lyrics by default, with page-local alignment prefs.
    ...(props.preset === 'performance'
      ? {
          defaultFontSize: 2.4,
          defaultAlign: 'center' as const,
          alignPrefsKey: 'pitchperfect_kn_lyrics_align',
        }
      : {}),
  })

  // Backfill holder refs that audio controller needs
  setUserScrolledForAudio = setUserScrolled

  // ── Loop lyric → audio time sync ──────────────────────────────────
  const onSetLoopLyric = (idx: number) => {
    handleSetLoopLyric(idx)
    const a = loopStartLyricIdx()
    const b = loopEndLyricIdx()
    const parsed = stableParsedLyrics()
    if (a !== null) {
      const entryA = parsed.get(a)
      if (entryA) audio.setLoopStart(entryA.time)
    }
    if (b !== null) {
      const entryB = parsed.get(b)
      if (entryB) {
        audio.setLoopEnd(entryB.endTime)
        audio.setLoopEnabled(true)
      }
    } else {
      audio.setLoopEnd(0)
      audio.setLoopEnabled(false)
    }
  }

  // ── Pitch Analysis controller ──────────────────────────────────
  const pitchAnalysis = useStemMixerPitchAnalysisController({
    // eslint-disable-next-line solid/reactivity
    sessionId: props.sessionId,
    vocalBuffer: () => vocal().buffer,
    sampleRate: () => audio.getAudioCtx()?.sampleRate ?? 44100,
    setPitchHistory: (h) => {
      audio.setPitchHistory(h)
    },
    showNotification,
  })

  // ── Canvas controller ──────────────────────────────────────────
  const [showNoteLabels, setShowNoteLabels] = createPersistedSignal<boolean>(
    'pitchperfect_show_note_labels',
    false,
  )
  const [showLyricLabels, setShowLyricLabels] = createPersistedSignal<boolean>(
    'pitchperfect_show_lyric_labels',
    false,
  )
  const [showLyricNoteLabels, setShowLyricNoteLabels] =
    createPersistedSignal<boolean>('pitchperfect_show_lyric_note_labels', false)
  // Plot the user's live mic pitch as a continuous red line over the vocal-stem
  // line, and label the note on each red user outline.
  const [showMicLine, setShowMicLine] = createPersistedSignal<boolean>(
    'pitchperfect_show_mic_line',
    false,
  )
  const [showUserNoteLabels, setShowUserNoteLabels] =
    createPersistedSignal<boolean>('pitchperfect_show_user_note_labels', false)

  const whisper = useWhisperTranscription({
    getAudioBuffer: () => vocal().buffer,
    logTag: 'StemMixer',
    // eslint-disable-next-line solid/reactivity
    sessionId: props.sessionId,
    onTranscriptionComplete: (segments) => {
      // Log alignment comparison after transcription
      setTimeout(() => {
        const r = alignmentResult()
        const currentSegmented = pitchAnalysis.offlineSegmentedNotes()
        const currentMerged = pitchAnalysis.offlineMergedNotes()
        formatAlignmentDebugLog('StemMixer', r)
        logAlignmentComparison(
          'StemMixer',
          currentMerged,
          currentSegmented,
          segments,
        )

        // Show warnings if transcription was poor or failed — but stay quiet
        // during karaoke playlist playback, where the focus is singing, not
        // lyric-sync accuracy. (Still shown for single, non-playlist sessions.)
        if (!playlist.isPlaylistActive()) {
          if (segments.length === 0) {
            showNotification(
              'Transcription timed out or failed. You may need to provide better lyrics or sync manually.',
              'error',
            )
          } else if (r.totalWords > 0 && r.accuracy < 0.25) {
            showNotification(
              `Alignment accuracy is very low (${(r.accuracy * 100).toFixed(0)}%). The lyrics might be incorrect.`,
              'error',
            )
          }
        }
      }, 0)
    },
  })
  // Aliases for backward compatibility with prop-passing
  const whisperStatus = whisper.status
  const whisperProgress = whisper.progress
  const transcribeElapsed = whisper.elapsed
  const whisperLanguage = whisper.language
  const setWhisperLanguage = whisper.setLanguage

  // ── Alignment note source toggle ────────────────────────────────
  const [useDenoised, setUseDenoised] = createSignal(true)
  // Expose for console debugging: window.__stemMixerDebug.setUseDenoised(false)
  ;(globalThis as Record<string, unknown>).__stemMixerDebug = {
    ...(((globalThis as Record<string, unknown>).__stemMixerDebug as object) ??
      {}),
    useDenoised,
    setUseDenoised,
  }

  // ── Pitch-word alignment memo ────────────────────────────────
  const alignmentResult = createMemo<AlignmentResult>(() => {
    // Prefer denoised (segmented) notes, fall back to raw merged
    let merged: MergedNote[] = []
    let noteSource = 'none'

    // Always read both signals unconditionally for proper SolidJS tracking
    const segmentedNotes = pitchAnalysis.offlineSegmentedNotes()
    const mergedNotes = pitchAnalysis.offlineMergedNotes()
    const wsSegs = whisper.segments()

    if (useDenoised() && segmentedNotes.length > 0) {
      merged = segmentedNotes
      noteSource = 'denoised'
    }

    if (merged.length === 0 && mergedNotes.length > 0) {
      merged = mergedNotes
      noteSource = 'raw-offline'
    }

    // Fallback: use realtime pitch history when offline analysis hasn't run
    if (merged.length === 0) {
      const pitchHistory = audio.getPitchHistory()
      if (pitchHistory.length > 0) {
        const detections: PitchDetection[] = pitchHistory.map((p) => ({
          midi: freqToMidi(p.frequency),
          noteName: p.noteName,
          timeSec: p.time,
        }))
        merged = mergeConsecutiveNotes(detections)
        if (merged.length > 0) noteSource = 'raw-realtime'
      }
    }

    if (merged.length === 0) {
      console.log(
        `[StemMixer] Alignment: no notes available (denoised=${segmentedNotes.length}, raw-offline=${mergedNotes.length}, whisper=${wsSegs.length})`,
      )
      return {
        alignedWords: [],
        totalWords: 0,
        mappedWords: 0,
        unmappedWords: 0,
        accuracy: 0,
        debugEntries: [],
      }
    }

    // Prefer whisper segments; fall back to LRC word timings
    let segments = wsSegs
    if (segments.length === 0) {
      const lrc = canonicalLrcLines()
      if (lrc.length > 0) {
        segments = lrcEntriesToSegments(lrc)
      }
    }

    if (segments.length === 0) {
      console.log(
        `[StemMixer] Alignment: no word segments (${noteSource} has ${merged.length} notes but no whisper/LRC segments)`,
      )
      return {
        alignedWords: [],
        totalWords: 0,
        mappedWords: 0,
        unmappedWords: 0,
        accuracy: 0,
        debugEntries: [],
      }
    }

    console.log(
      `[StemMixer] Alignment using ${noteSource} notes (${merged.length} notes, ${segments.length} word segments)`,
    )
    return computeAlignment(merged, segments)
  })

  const canvas = useStemMixerCanvasController({
    duration: audio.duration,
    elapsed: audio.elapsed,
    windowStart: audio.windowStart,
    windowDuration: audio.windowDuration,
    tracks,
    vocal,
    getPitchHistory: () =>
      pitchAnalysis.pitchSourceMode() === 'offline'
        ? pitchAnalysis.offlinePitchHistory()
        : audio.getPitchHistory(),
    getMicPitchHistory: mic.getMicPitchHistory,
    micActive: mic.micActive,
    currentPitch: audio.currentPitch,
    midiNotes,
    showNoteLabels,
    showLyricLabels,
    showMicLine,
    showUserNoteLabels,
    alignedWords: () => alignmentResult().alignedWords,
    seekTo: audio.seekTo,
    setWindowStart: audio.setWindowStart,
    setWindowDuration: audio.setWindowDuration,
    PITCH_WINDOW_FILL_RATIO,
    loopEnabled: audio.loopEnabled,
    loopStart: audio.loopStart,
    loopEnd: audio.loopEnd,
    setLoopStart: audio.setLoopStart,
    setLoopEnd: audio.setLoopEnd,
    onCanvasVerticalPinch: (canvasId: string, deltaY: number) => {
      if (layout.workspaceLayout() !== 'fixed-2col') return
      const cur = layout.fixedPanelHeights()
      const current = (cur as Record<string, number>)[canvasId] ?? 180
      layout.setFixedPanelHeights({
        ...cur,
        [canvasId]: Math.max(40, current + deltaY),
      })
    },
    // Pitch edit mode
    editMode: pitchAnalysis.editMode,
    editableNotes: pitchAnalysis.editableNotes,
    baseNotes: pitchAnalysis.baseNotes,
    pitchView: pitchAnalysis.pitchView,
    selectedNoteId: pitchAnalysis.selectedNoteId,
    onSelectNote: pitchAnalysis.setSelectedNoteId,
    onBeginEdit: pitchAnalysis.beginEdit,
    onPreviewEdit: pitchAnalysis.previewEdit,
    onEndEdit: pitchAnalysis.endEdit,
  })

  // Backfill mutable holders so audio controller can reach canvas + lyrics
  Object.assign(canvasForAudio, {
    syncCanvasSizes: canvas.syncCanvasSizes,
    drawWaveformOverview: canvas.drawWaveformOverview,
    drawLiveWaveform: canvas.drawLiveWaveform,
    drawPitchCanvas: canvas.drawPitchCanvas,
    drawMidiCanvas: canvas.drawMidiCanvas,
    isUserPanning: canvas.isUserPanning,
  })

  // Repaint the pitch canvas when edit-mode state changes (toggle, selection,
  // or the effective notes after an edit).
  createEffect(() => {
    pitchAnalysis.editMode()
    pitchAnalysis.selectedNoteId()
    pitchAnalysis.editableNotes()
    pitchAnalysis.pitchView()
    pitchAnalysis.baseNotes()
    canvas.queueCanvasRedraw()
  })

  // ── Melody audition synth ──────────────────────────────────────
  // Optionally sound the detected notes as a monophonic synth, following the
  // playhead, so the user can hear how the cleaned melody sounds.
  const [melodyAudio, setMelodyAudio] = createSignal(false)
  const melodySynth = createMelodySynth()
  onCleanup(() => melodySynth.dispose())
  createEffect(() => {
    const on = melodyAudio() && audio.playing()
    const t = audio.elapsed()
    if (!on) {
      melodySynth.setNote(null)
      return
    }
    const notes = pitchAnalysis.offlineSegmentedNotes()
    const active = notes.find((n) => t >= n.startSec && t < n.endSec)
    melodySynth.setNote(active !== undefined ? active.midi : null)
  })
  const toggleMelodyAudio = (): void => {
    const next = !melodyAudio()
    setMelodyAudio(next)
    if (next) melodySynth.resume()
  }
  updateCurrentLineForAudio = updateCurrentLine
  setCurrentLineIdxForAudio = setCurrentLineIdx

  // ── Layout Management ──────────────────────────────────────────
  const layout = useStemMixerLayoutController({
    getWorkspaceRef: () => workspaceRef,
    canvas,
    // The standalone karaoke page opens on the performance stage (big
    // centered lyrics) and keeps its layout prefs apart from the studio's.
    ...(props.preset === 'performance'
      ? {
          prefsKey: 'pitchperfect_kn_workspace_prefs',
          defaultLayout: 'performance' as const,
        }
      : {}),
  })

  // ── Derived helpers ───────────────────────────────────────────
  const showMidi = () =>
    props.practiceMode === 'midi' || props.requestedStems?.midi === true

  const onWorkspaceWheel = (e: WheelEvent) => {
    e.preventDefault()
    audio.setWindowDuration((prev) =>
      Math.min(150, Math.max(10, prev + (e.deltaY > 0 ? 5 : -5))),
    )
  }

  // ── Lyrics panel props bundle ──────────────────────────────────
  const lyricsPanel = {
    lyricsAlign,
    lyricsLines,
    lrcLines,
    currentLineIdx,
    lyricsSource,
    lyricsLoading,
    songMatches,
    showSongPicker,
    setShowSongPicker,
    songPickerQuery,
    setSongPickerQuery,
    lyricsFontSize,
    setLyricsFontSize,
    lyricsColumns,
    setLyricsColumns,
    editMode,
    setEditMode,
    setEditBuffer,
    editPopover,
    lrcGenMode,
    lrcGenLineIdx,
    lrcGenWordIdx,
    blocks,
    blockInstances,
    blockMarkMode,
    setBlockMarkMode,
    markStartLine,
    setMarkStartLine,
    markEndLine,
    setMarkEndLine,
    blockEditTarget,
    setBlockEditTarget,
    canonicalLrcLines,
    stableParsedLyrics,
    blockStarts,
    displayLines,
    genViewData,
    hasMultipleSections,
    handleNextLine,
    handleNextWord,
    handleLrcGenFinish,
    handleLrcGenReset,
    handleSaveEdits,
    handleLineTimeEdit,
    getEditWordTime,
    getEditLineTime,
    openWordPopover,
    closeWordPopover,
    commitPopoverValue,
    formatTimeMs,
    handleLyricLineClick,
    handleMarkBlock,
    handleUnlinkInstance,
    handleDeleteBlock,
    handleAddInstance,
    handleEditBlock,
    getBlockColor,
    getBlockById,
    getBlockForLine,
    computeActiveWord,
    getGenLines,
    cancelSearch,
    handleLyricsUpload,
    handleSongPick,
    handleSongPickerRefine,
    playing: audio.playing,
    elapsed: audio.elapsed,
    handlePlay: audio.handlePlay,
    handlePause: audio.handlePause,
    formatTime: canvas.formatTime,
    // eslint-disable-next-line solid/reactivity
    songTitle: props.songTitle,
    lrclibSearchUrl,
    triggerChangeFile: () => lyricsFileInputRef?.click(),
    handlePasteLyricsHeader: () => {
      void (async () => {
        try {
          const text = await navigator.clipboard.readText()
          if (!text || text.trim().length === 0) return
          if (
            !window.confirm(
              'Are you sure you want to overwrite current lyrics and word timings with clipboard content? This action cannot be undone.',
            )
          )
            return

          const isLrc = /^\[\d{1,3}:\d{2}/.test(text.trim())
          const baseName = props.songTitle
            ? props.songTitle.replace(/[^a-zA-Z0-9_-]/g, '_')
            : 'clipboard'
          handleLyricsUpload({
            text,
            format: isLrc ? 'lrc' : 'txt',
            filename: `${baseName}.${isLrc ? 'lrc' : 'txt'}`,
          })
        } catch (err) {
          console.warn('Clipboard paste failed', err)
          import('@/stores/notifications-store').then(
            ({ showNotification }) => {
              showNotification(
                'Browser blocked clipboard access. Cannot paste from header.',
                'warning',
              )
            },
          )
        }
      })()
    },
    loopStartLyricIdx,
    loopEndLyricIdx,
    onSetLoopLyric,
  }

  // ── Volume / Mute / Solo ─────────────────────────────────────
  const setTrackVolume = (label: string, volume: number) => {
    const setter =
      label === 'Vocal'
        ? setVocal
        : label === 'Instrumental'
          ? setInstrumental
          : setMidi
    setter((prev) => {
      if (prev.gainNode) prev.gainNode.gain.value = volume
      return { ...prev, volume, muted: false }
    })
  }

  const toggleMute = (label: string) => {
    const setter =
      label === 'Vocal'
        ? setVocal
        : label === 'Instrumental'
          ? setInstrumental
          : setMidi
    const hasSolo = anySoloed()
    setter((prev) => {
      const muted = !prev.muted
      const isAudible = prev.soloed || (!muted && !hasSolo)
      if (prev.gainNode) prev.gainNode.gain.value = isAudible ? prev.volume : 0
      return { ...prev, muted }
    })
  }

  const toggleSolo = (label: string) => {
    const setter =
      label === 'Vocal'
        ? setVocal
        : label === 'Instrumental'
          ? setInstrumental
          : setMidi
    const otherTracks = tracks().filter((t) => t.label !== label)

    setter((prev) => {
      const soloed = !prev.soloed
      const newAnySoloed = soloed || otherTracks.some((t) => t.soloed)
      setAnySoloed(newAnySoloed)

      if (prev.gainNode)
        prev.gainNode.gain.value = soloed
          ? prev.volume
          : prev.muted || newAnySoloed
            ? 0
            : prev.volume

      for (const ot of otherTracks) {
        const otherSetter =
          ot.label === 'Vocal'
            ? setVocal
            : ot.label === 'Instrumental'
              ? setInstrumental
              : setMidi
        otherSetter((oPrev) => {
          if (oPrev.gainNode)
            oPrev.gainNode.gain.value =
              oPrev.soloed || (!oPrev.muted && !soloed) ? oPrev.volume : 0
          return oPrev
        })
      }
      return { ...prev, soloed }
    })
  }

  // ── Stem controls props bundle ─────────────────────────────────
  const stemControls = {
    vocal,
    midi,
    instrumental,
    anySoloed,
    toggleSolo,
    toggleMute,
    setTrackVolume,
    handleDownload: audio.handleDownload,
    /* eslint-disable solid/reactivity */
    practiceMode: props.practiceMode,
    requestedStems: props.requestedStems,
    /* eslint-enable solid/reactivity */
  }

  const micMonitor = {
    micActive: mic.micActive,
    monitorEnabled: mic.micMonitorEnabled,
    monitorVolume: mic.micMonitorVolume,
    onToggleMonitor: (enabled: boolean) => mic.setMicMonitor(enabled),
    onVolumeChange: (v: number) => mic.setMicMonitorVolume(v),
  }

  onMount(() => {
    audio.loadStems()
    loadLyrics()

    // Load cached data from IndexedDB in parallel:
    // 1. Whisper transcription (words + timestamps)
    // 2. Pitch analysis (denoised notes)
    // 3. Initialize whisper service (so re-transcription is possible) — the
    //    performance preset skips it: its transcription tooling isn't
    //    reachable there, and the model download is too heavy to pay on a
    //    landing-page demo.
    void whisper.loadCachedTranscription()
    void pitchAnalysis.loadCachedAnalysis()
    if (props.preset !== 'performance') whisper.initWhisper()

    canvas.initObserver()
    canvas.queueCanvasRedraw()

    // Offer the mixer tour once — but not mid-playlist, where the focus is
    // singing, not learning the UI.
    if (!playlist.isPlaylistActive()) {
      props.onOfferTour?.('mount')
    }

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return

      if (e.code === 'Space') {
        e.preventDefault()
        if (audio.loading() || audio.loadError()) return
        if (audio.playing()) {
          audio.handlePause()
        } else {
          audio.handlePlay()
        }
      }

      if (e.key === 'm' || e.key === 'M') {
        if (layout.workspaceLayout() === 'fixed-2col') {
          layout.setSidebarHidden((prev) => !prev)
        }
      }

      // Loop shortcuts: A = set start, B = set end, S = seek to loop start,
      // L = toggle loop
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        audio.setLoopStart(audio.elapsed())
      }
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        audio.setLoopEnd(audio.elapsed())
        audio.setLoopEnabled(true)
      }
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        if (audio.loopEnabled() && audio.loopStart() > 0) {
          audio.seekTo(audio.loopStart())
        }
      }
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        audio.setLoopEnabled((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    ;(window as unknown as SmWindow).__smKeydown = handleKeyDown

    // Resize document-level listeners (grid + fixed)
    document.addEventListener('pointermove', layout.docResizeMove)
    document.addEventListener('pointerup', layout.docResizeEnd)
    ;(window as unknown as SmWindow).__smResizeMove = layout.docResizeMove
    ;(window as unknown as SmWindow).__smResizeEnd = layout.docResizeEnd
  })

  // SolidJS swaps canvas elements via Show blocks, so old observers are stale.
  createEffect(() => {
    layout.workspaceLayout() // track this signal
    canvas.reconnectObserver()
  })

  createEffect(() => {
    if (!audio.loading()) {
      canvas.queueCanvasRedraw()
    }
  })

  // Auto-seek + autoplay from Shazam match offset
  let autoPlayHandled = false
  createEffect(() => {
    if (autoPlayHandled) return
    if (audio.loading()) return
    if (audio.midiGenerating()) return
    if (audio.loadError()) return
    autoPlayHandled = true

    const seekSec = props.initialSeekSec
    console.log(
      '[StemMixer] Auto-play triggered. seekSec=',
      seekSec,
      'autoPlay=',
      props.autoPlay,
      'duration=',
      audio.duration(),
    )

    if (seekSec !== undefined && seekSec >= 0 && audio.duration() > 0) {
      const target = Math.min(seekSec, audio.duration() - 0.5)
      console.log(`[StemMixer] Seeking to match offset: ${target.toFixed(2)}s`)
      audio.seekTo(target)
    }
    if (props.autoPlay === true) {
      console.log('[StemMixer] Scheduling auto-play...')
      // Small delay to let the seek settle before starting playback
      setTimeout(() => {
        console.log('[StemMixer] Executing auto-play handlePlay()')
        audio.handlePlay()
      }, 150)
    }
  })

  const startWhisperTranscription = () => {
    // If pitch analysis hasn't been run yet, run it first with default
    // settings so the alignment has notes to work with.
    const hasPitchData =
      pitchAnalysis.offlineSegmentedNotes().length > 0 ||
      pitchAnalysis.offlineMergedNotes().length > 0
    if (!hasPitchData && !pitchAnalysis.isAnalyzing()) {
      showNotification('Running pitch denoising first...', 'info')
      void pitchAnalysis.runAnalysis().then(() => {
        whisper.startTranscription()
      })
      return
    }
    whisper.startTranscription()
  }

  onCleanup(() => {
    audio.disconnectSources()
    cancelAnimationFrame(audio.getRafId())
    whisper.destroy()
    canvas.disconnectObserver()
    const smWin = window as unknown as SmWindow
    if (smWin.__smKeydown !== undefined) {
      window.removeEventListener('keydown', smWin.__smKeydown)
      delete smWin.__smKeydown
    }
    if (smWin.__smResizeMove !== undefined) {
      document.removeEventListener('pointermove', smWin.__smResizeMove)
      delete smWin.__smResizeMove
    }
    if (smWin.__smResizeEnd !== undefined) {
      document.removeEventListener('pointerup', smWin.__smResizeEnd)
      delete smWin.__smResizeEnd
    }
    const ctx = audio.getAudioCtx()
    if (ctx) {
      ctx.close().catch(() => {
        /* */
      })
    }
  })

  // ── Render ───────────────────────────────────────────────────
  return (
    <div
      class="stem-mixer"
      classList={{
        'stem-mixer--focus': karaokeFocus(),
        [`stem-mixer--focus-docked-${karaokeToolbarPosition()}`]:
          karaokeFocus(),
      }}
    >
      {/* Header */}
      <Show when={!karaokeFocus()}>
        <div class="sm-header">
          <div class="sm-header-left">
            <Show when={props.onBack}>
              <button
                class="sm-back-btn"
                onClick={() => props.onBack?.()}
                title="Back"
              >
                <ChevronLeft />
              </button>
            </Show>
            <div class="sm-header-titles">
              <h2>{props.songTitle.replace(/\.[^.]+$/, '')} (session)</h2>
              <Show
                when={playlist.isPlaylistActive() && playlist.currentSong()}
                fallback={
                  <Show when={audio.duration() > 0}>
                    <span class="sm-session-id">
                      {canvas.formatTime(audio.duration())}
                    </span>
                  </Show>
                }
              >
                <div class="sm-playlist-subtitle">
                  <Show when={playlist.currentSong()!.singerName}>
                    <span class="sm-playlist-singer">
                      {playlist.currentSong()!.singerName}
                    </span>
                    <span class="sm-playlist-dot">·</span>
                  </Show>
                  <span>{playlist.currentSong()!.songTitle}</span>
                  <Show when={playlist.nextSong()}>
                    <span class="sm-playlist-next">
                      · Next: {playlist.nextSong()!.songTitle}
                      <Show when={playlist.nextSong()!.singerName}>
                        {' '}
                        ({playlist.nextSong()!.singerName})
                      </Show>
                    </span>
                  </Show>
                  <span class="sm-playlist-controls">
                    <button
                      class="sm-playlist-ctrl-btn"
                      title="Previous song"
                      disabled={playlist.currentIndex() === 0}
                      onClick={handlePlaylistPrev}
                    >
                      <SkipBack />
                    </button>
                    <button
                      class="sm-playlist-ctrl-btn"
                      title="Skip to next song"
                      onClick={handlePlaylistNext}
                    >
                      <SkipForward />
                    </button>
                    <button
                      class="sm-playlist-ctrl-btn"
                      title="Stop playlist"
                      onClick={handlePlaylistStopAll}
                    >
                      <X />
                    </button>
                  </span>
                </div>
              </Show>
            </div>
          </div>
          <div
            class="sm-header-actions"
            style={{ display: 'flex', gap: '0.5rem' }}
            data-tour="mixer.header"
          >
            <Show when={props.onOfferTour}>
              <button
                class="sm-btn sm-btn-secondary"
                onClick={() => props.onOfferTour?.('button')}
                title="Take a guided tour of the mixer"
                style={{ gap: '0.4rem' }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4l5 2.5L12 11 7 8.5 12 6zm-5 4l5 2.5V18l-5-2.5V10zm10 0v5.5L12 18v-5.5L17 10z"
                  />
                </svg>{' '}
                Tour
              </button>
            </Show>
            <button
              class="sm-btn sm-btn-secondary"
              data-tour="mixer.playlist"
              classList={{ 'sm-btn--active': playlistSidebarOpen() }}
              onClick={() => setPlaylistSidebarOpen((prev) => !prev)}
              title="Karaoke playlists"
              style={{ gap: '0.4rem' }}
            >
              <Music /> Playlist
            </button>
            <Show when={props.preset !== 'performance'}>
              <button
                class="sm-btn sm-btn-secondary sm-pitch-debug-btn"
                onClick={() => pitchAnalysis.setPanelOpen((prev) => !prev)}
                title="Pitch Analysis & Settings"
                style={{ gap: '0.4rem' }}
              >
                <Settings /> Pitch
              </button>
            </Show>
            {/* Share links are only useful once songs are cloud-synced across
                devices — gated behind the premium flag (off by default). */}
            <Show when={PREMIUM_FEATURES}>
              <button
                class="sm-share-btn"
                classList={{ 'sm-share-btn--copied': shareToast() !== '' }}
                onClick={() => {
                  const url = `${window.location.origin}/#/uvr/session/${props.sessionId}/mixer`
                  void navigator.clipboard.writeText(url).then(() => {
                    setShareToast('Link copied to clipboard!')
                    setTimeout(() => setShareToast(''), 2500)
                  })
                }}
                title="Copy share link"
              >
                <Share /> {shareToast() || 'Share'}
              </button>
            </Show>
            <button
              class="sm-btn sm-btn-secondary"
              data-tour="mixer.focus"
              onClick={() => setKaraokeFocus((prev) => !prev)}
              title={
                karaokeFocus()
                  ? 'Exit karaoke mode (Esc)'
                  : 'Karaoke focus mode'
              }
            >
              {karaokeFocus() ? (
                <Minimize2 size={14} />
              ) : (
                <Maximize2 size={14} />
              )}
            </button>
          </div>
        </div>
      </Show>

      {/* Focus-mode now-playing bar — the header (with the playlist subtitle and
          transport) is hidden in focus mode, so surface the current
          singer/song + Prev/Skip/Stop here when a playlist is running. */}
      <Show
        when={
          karaokeFocus() &&
          playlist.isPlaylistActive() &&
          playlist.currentSong()
        }
      >
        <div class="sm-focus-nowplaying">
          <div class="sm-focus-np-info">
            <Show when={playlist.currentSong()!.singerName}>
              <span class="sm-playlist-singer">
                {playlist.currentSong()!.singerName}
              </span>
            </Show>
            <span class="sm-focus-song">
              {playlist.currentSong()!.songTitle}
            </span>
            <Show when={playlist.nextSong()}>
              <span class="sm-playlist-next">
                · Next: {playlist.nextSong()!.songTitle}
                <Show when={playlist.nextSong()!.singerName}>
                  {' '}
                  ({playlist.nextSong()!.singerName})
                </Show>
              </span>
            </Show>
          </div>
          <span class="sm-playlist-controls">
            <button
              class="sm-playlist-ctrl-btn"
              title="Previous song"
              disabled={playlist.currentIndex() === 0}
              onClick={handlePlaylistPrev}
            >
              <SkipBack />
            </button>
            <button
              class="sm-playlist-ctrl-btn"
              title="Skip to next song"
              onClick={handlePlaylistNext}
            >
              <SkipForward />
            </button>
            <button
              class="sm-playlist-ctrl-btn"
              title="Stop playlist"
              onClick={handlePlaylistStopAll}
            >
              <X />
            </button>
          </span>
        </div>
      </Show>

      {/* Loading / Error */}
      <Show when={audio.loading() || audio.midiGenerating()}>
        <div class="sm-loading">
          <Show
            when={audio.midiGenerating()}
            fallback={<div class="sm-loading-spinner" />}
          >
            <CircularProgress pct={audio.midiProgress()} size={40} />
          </Show>
          <span>
            {audio.midiGenerating()
              ? audio.midiPhase() === 'rendering'
                ? 'Rendering MIDI audio...'
                : audio.midiPhase() === 'synthesizing'
                  ? `Building MIDI graph... ${audio.midiProgress()}%`
                  : `Detecting pitches... ${audio.midiProgress()}%`
              : `Loading stems... ${audio.loadProgress()}%`}
          </span>
        </div>
      </Show>

      <Show when={audio.loadError()}>
        <div class="sm-error">
          <span>{audio.loadError()}</span>
          <button
            class="sm-error-retry"
            onClick={() => {
              void audio.loadStems()
            }}
          >
            Retry
          </button>
        </div>
      </Show>

      <Show when={!audio.loading() && !audio.loadError()}>
        <StemMixerTransport
          playing={audio.playing}
          elapsed={audio.elapsed}
          duration={audio.duration}
          onStop={audio.handleStop}
          onRestart={audio.handleRestart}
          onPlay={audio.handlePlay}
          onPause={audio.handlePause}
          onSeek={handleSeek}
          workspaceLayout={layout.workspaceLayout}
          setWorkspaceLayout={layout.setWorkspaceLayout}
          sidebarHidden={layout.sidebarHidden}
          setSidebarHidden={layout.setSidebarHidden}
          onQueueRedraw={() => canvas.queueCanvasRedraw()}
          micActive={mic.micActive}
          micError={mic.micError}
          onToggleMic={() => void mic.toggleMic()}
          micMonitorEnabled={mic.micMonitorEnabled}
          onToggleMicMonitor={() => mic.setMicMonitor(!mic.micMonitorEnabled())}
          formatTime={canvas.formatTime}
          speed={audio.speed}
          onSpeedChange={audio.setSpeed}
          karaokeFocus={karaokeFocus}
          setKaraokeFocus={setKaraokeFocus}
          toolbarPosition={karaokeToolbarPosition}
          setToolbarPosition={setKaraokeToolbarPosition}
          showWaveform={showWaveform}
          setShowWaveform={setShowWaveform}
          showPitch={showPitch}
          setShowPitch={setShowPitch}
          showLyrics={showLyrics}
          setShowLyrics={setShowLyrics}
          loopEnabled={audio.loopEnabled}
          loopStart={audio.loopStart}
          loopEnd={audio.loopEnd}
          onSetLoopA={() => {
            const newTime = audio.elapsed()
            const currentB = audio.loopEnd()
            if (currentB > 0 && newTime > currentB) {
              audio.setLoopEnd(newTime)
              audio.setLoopStart(currentB)
            } else {
              audio.setLoopStart(newTime)
            }
            canvas.queueCanvasRedraw()
          }}
          onSetLoopB={() => {
            const newTime = audio.elapsed()
            const currentA = audio.loopStart()
            if (newTime < currentA) {
              audio.setLoopStart(newTime)
              audio.setLoopEnd(currentA)
            } else {
              audio.setLoopEnd(newTime)
            }
            audio.setLoopEnabled(true)
            canvas.queueCanvasRedraw()
          }}
          onClearLoop={() => {
            audio.clearLoop()
            setLoopStartLyricIdx(null)
            setLoopEndLyricIdx(null)
            canvas.queueCanvasRedraw()
          }}
          onToggleLoop={() => {
            audio.setLoopEnabled(!audio.loopEnabled())
            canvas.queueCanvasRedraw()
          }}
        />

        <Show
          when={audio.loopEnabled() && audio.loopEnd() > 0 && mic.micActive()}
        >
          <LoopMetricsBar
            comparisonData={mic.comparisonData}
            loopCount={audio.loopCount}
          />
        </Show>

        <StemMixerGridWorkspace
          workspaceLayout={layout.workspaceLayout}
          panelStyle={layout.panelStyle}
          getPanel={layout.getPanel}
          handlePanelDragStart={layout.handlePanelDragStart}
          handlePanelDragMove={layout.handlePanelDragMove}
          handlePanelDragEnd={layout.handlePanelDragEnd}
          handleResizeStart={layout.handleResizeStart}
          setCanvasRef={canvas.setCanvasRef}
          handleCanvasWheel={canvas.handleCanvasWheel}
          handleCanvasPointerDown={canvas.handleCanvasPointerDown}
          handleCanvasPointerMove={canvas.handleCanvasPointerMove}
          handleCanvasPointerUp={canvas.handleCanvasPointerUp}
          setWindowDuration={audio.setWindowDuration}
          stemControls={stemControls}
          micMonitor={micMonitor}
          lyricsPanel={lyricsPanel}
          handleForceSearch={() => void handleForceSearch()}
          toggleEditMode={toggleEditMode}
          startLrcGen={startLrcGen}
          handleDownloadLrc={handleDownloadLrc}
          lyricsFileInputRef={(el) => {
            lyricsFileInputRef = el
          }}
          handleLyricsChange={handleLyricsChange}
          triggerChangeFile={() => lyricsFileInputRef?.click()}
          handlePasteLyricsHeader={lyricsPanel.handlePasteLyricsHeader}
          showMidi={showMidi}
          showNoteLabels={showNoteLabels}
          setShowNoteLabels={setShowNoteLabels}
          showLyricLabels={showLyricLabels}
          setShowLyricLabels={setShowLyricLabels}
          showLyricNoteLabels={showLyricNoteLabels}
          setShowLyricNoteLabels={setShowLyricNoteLabels}
          melodyAudio={melodyAudio}
          onToggleMelodyAudio={toggleMelodyAudio}
          whisperStatus={whisperStatus}
          whisperProgress={whisperProgress}
          transcribeElapsed={transcribeElapsed}
          alignmentResult={alignmentResult}
          startWhisperTranscription={startWhisperTranscription}
          whisperLanguage={whisperLanguage}
          setWhisperLanguage={setWhisperLanguage}
          workspaceRef={(el) => {
            workspaceRef = el
          }}
          onWorkspaceWheel={onWorkspaceWheel}
          showWaveform={showWaveform}
          showPitch={showPitch}
          showLyrics={showLyrics}
        />
        <StemMixerFixedWorkspace
          workspaceLayout={layout.workspaceLayout}
          fixedPanelHeights={layout.fixedPanelHeights}
          handleFixedResizeStart={layout.handleFixedResizeStart}
          sidebarHidden={layout.sidebarHidden}
          setCanvasRef={canvas.setCanvasRef}
          handleCanvasWheel={canvas.handleCanvasWheel}
          handleCanvasPointerDown={canvas.handleCanvasPointerDown}
          handleCanvasPointerMove={canvas.handleCanvasPointerMove}
          handleCanvasPointerUp={canvas.handleCanvasPointerUp}
          stemControls={stemControls}
          micMonitor={micMonitor}
          lyricsPanel={lyricsPanel}
          handleForceSearch={() => void handleForceSearch()}
          toggleEditMode={toggleEditMode}
          startLrcGen={startLrcGen}
          handleDownloadLrc={handleDownloadLrc}
          lyricsFileInputRef={(el) => {
            lyricsFileInputRef = el
          }}
          handleLyricsChange={handleLyricsChange}
          triggerChangeFile={() => lyricsFileInputRef?.click()}
          handlePasteLyricsHeader={lyricsPanel.handlePasteLyricsHeader}
          showMidi={showMidi}
          showNoteLabels={showNoteLabels}
          setShowNoteLabels={setShowNoteLabels}
          showLyricLabels={showLyricLabels}
          setShowLyricLabels={setShowLyricLabels}
          showLyricNoteLabels={showLyricNoteLabels}
          setShowLyricNoteLabels={setShowLyricNoteLabels}
          melodyAudio={melodyAudio}
          onToggleMelodyAudio={toggleMelodyAudio}
          whisperStatus={whisperStatus}
          whisperProgress={whisperProgress}
          transcribeElapsed={transcribeElapsed}
          alignmentResult={alignmentResult}
          startWhisperTranscription={startWhisperTranscription}
          whisperLanguage={whisperLanguage}
          setWhisperLanguage={setWhisperLanguage}
          showMicLine={showMicLine}
          setShowMicLine={setShowMicLine}
          showUserNoteLabels={showUserNoteLabels}
          setShowUserNoteLabels={setShowUserNoteLabels}
          micMessage={micInsights.message}
          micInsight={micInsights.insight}
          micLevel={mic.micLevel}
          micActive={mic.micActive}
          showWaveform={showWaveform}
          showPitch={showPitch}
          showLyrics={showLyrics}
        />
        <StemMixerPerformanceWorkspace
          workspaceLayout={layout.workspaceLayout}
          sidebarHidden={layout.sidebarHidden}
          setCanvasRef={canvas.setCanvasRef}
          handleCanvasPointerDown={canvas.handleCanvasPointerDown}
          handleCanvasPointerMove={canvas.handleCanvasPointerMove}
          handleCanvasPointerUp={canvas.handleCanvasPointerUp}
          stemControls={stemControls}
          micMonitor={micMonitor}
          lyricsPanel={lyricsPanel}
          showLyricNoteLabels={showLyricNoteLabels}
          alignmentResult={alignmentResult}
          lyricsAlign={lyricsAlign}
          setLyricsAlign={setLyricsAlign}
          handleForceSearch={() => void handleForceSearch()}
          triggerChangeFile={() => lyricsFileInputRef?.click()}
          showWaveform={showWaveform}
        />
      </Show>

      <StemMixerScoreModal
        showScore={mic.showScore}
        score={mic.score}
        onClose={() => {
          mic.setShowScore(false)
          if (playlist.isPlaylistActive() && pendingAdvance) {
            pendingAdvance = false
            playlist.reportSongScore(mic.score())
            playlist.advance()
          }
        }}
      />

      {/* In edit mode the panel collapses and a floating toolbar takes over,
          so the pitch lane stays visible and clickable. */}
      <Show when={props.preset !== 'performance' && pitchAnalysis.editMode()}>
        <StemMixerEditToolbar
          pitchView={pitchAnalysis.pitchView()}
          setPitchView={pitchAnalysis.setPitchView}
          hasEdits={pitchAnalysis.hasEdits()}
          hasSelection={pitchAnalysis.selectedNoteId() !== null}
          onDelete={() => pitchAnalysis.deleteSelectedNote()}
          onSplit={() => pitchAnalysis.splitSelectedNote()}
          onMerge={() => pitchAnalysis.mergeSelectedWithNext()}
          onUndo={() => pitchAnalysis.undoEdit()}
          onReset={() => pitchAnalysis.resetEdits()}
          onDone={() => {
            pitchAnalysis.setEditMode(false)
            pitchAnalysis.setSelectedNoteId(null)
          }}
        />
      </Show>

      <Show
        when={
          props.preset !== 'performance' &&
          pitchAnalysis.panelOpen() &&
          !pitchAnalysis.editMode()
        }
      >
        <StemMixerPitchAnalysisPanel
          algorithm={pitchAnalysis.algorithm()}
          setAlgorithm={pitchAnalysis.setAlgorithm}
          bufferSize={pitchAnalysis.bufferSize()}
          setBufferSize={pitchAnalysis.setBufferSize}
          sensitivity={pitchAnalysis.sensitivity()}
          setSensitivity={pitchAnalysis.setSensitivity}
          minConfidence={pitchAnalysis.minConfidence()}
          setMinConfidence={pitchAnalysis.setMinConfidence}
          minAmplitude={pitchAnalysis.minAmplitude()}
          setMinAmplitude={pitchAnalysis.setMinAmplitude}
          isAnalyzing={pitchAnalysis.isAnalyzing()}
          progress={pitchAnalysis.progress()}
          pitchSourceMode={pitchAnalysis.pitchSourceMode()}
          setPitchSourceMode={(mode) => {
            pitchAnalysis.setPitchSourceMode(mode)
            canvas.queueCanvasRedraw()
          }}
          runAnalysis={() => {
            void pitchAnalysis.runAnalysis().then(() => {
              // After re-analysis with new settings, auto re-run whisper
              // transcription so alignment stays in sync
              if (whisper.segments().length > 0) {
                showNotification(
                  'Re-running transcription with updated pitch...',
                  'info',
                )
                whisper.startTranscription()
              }
            })
          }}
          cleanupAmount={pitchAnalysis.cleanupAmount()}
          setCleanupAmount={(n) => {
            pitchAnalysis.setCleanupAmount(n)
            canvas.queueCanvasRedraw()
          }}
          songKey={pitchAnalysis.songKey()}
          setSongKey={(k) => {
            pitchAnalysis.setSongKey(k)
            canvas.queueCanvasRedraw()
          }}
          songScale={pitchAnalysis.songScale()}
          setSongScale={(s) => {
            pitchAnalysis.setSongScale(s)
            canvas.queueCanvasRedraw()
          }}
          songBpm={pitchAnalysis.songBpm()}
          setSongBpm={(b) => {
            pitchAnalysis.setSongBpm(b)
            canvas.queueCanvasRedraw()
          }}
          contourReady={pitchAnalysis.contourReady()}
          detectedKeyLabel={(() => {
            const k = pitchAnalysis.detectedKey()
            return k !== null
              ? `${k.keyName} ${k.scaleType === 'major' ? 'major' : 'minor'}`
              : ''
          })()}
          keyRegionCount={pitchAnalysis.keyRegions().length}
          editMode={pitchAnalysis.editMode()}
          onToggleEditMode={() => {
            pitchAnalysis.setEditMode((v) => !v)
            pitchAnalysis.setSelectedNoteId(null)
          }}
          canEdit={pitchAnalysis.editableNotes().length > 0}
          hasEdits={pitchAnalysis.hasEdits()}
          pitchView={pitchAnalysis.pitchView()}
          setPitchView={pitchAnalysis.setPitchView}
          onClose={() => pitchAnalysis.setPanelOpen(false)}
        />
      </Show>

      {/* ── Karaoke playlist ─────────────────────────────────── */}
      <Show when={playlistSidebarOpen()}>
        <div class="sm-playlist-sidebar-wrap">
          <KaraokePlaylistSidebar
            onClose={() => setPlaylistSidebarOpen(false)}
          />
        </div>
      </Show>

      {/* Only the StemMixer for the current song drives the overlay/Start, so a
          stale instance during a song switch can't begin the wrong song. */}
      <Show when={isCurrentPlaylistSong()}>
        <KaraokePlaylistOverlay
          onStart={handlePlaylistStart}
          onSkip={() => playlist.advance()}
          durationSec={audio.duration}
          loading={audio.loading}
        />
      </Show>
      <KaraokePlaylistSummary />
    </div>
  )
}

// ============================================================
// LoopMetricsBar
// ============================================================

const LoopMetricsBar: Component<{
  comparisonData: Accessor<ComparisonPoint[]>
  loopCount: () => number
}> = (props) => {
  const accuracy = () => {
    const data = props.comparisonData()
    if (data.length === 0) return 0
    const inTol = data.filter((d) => d.inTolerance).length
    return Math.round((inTol / data.length) * 100)
  }
  const avgCents = () => {
    const data = props.comparisonData()
    if (data.length === 0) return 0
    const sum = data.reduce((a, d) => a + Math.abs(d.centsOff), 0)
    return Math.round(sum / data.length)
  }

  return (
    <div class="sm-loop-metrics">
      <span class="sm-loop-metrics-item">
        Accuracy:&nbsp;<strong>{accuracy()}%</strong>
      </span>
      <span class="sm-loop-metrics-item">
        Avg&nbsp;offset:&nbsp;<strong>{avgCents()}&cent;</strong>
      </span>
      <span class="sm-loop-metrics-item">
        Loop:&nbsp;<strong>{props.loopCount()}x</strong>
      </span>
    </div>
  )
}

// ============================================================
// CSS Styles
// ============================================================

export const StemMixerStyles: string = `
.stem-mixer {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary, #161b22);
  overflow: hidden;
}

/* Header */
.sm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.25rem;
  background: var(--bg-primary, #0d1117);
  border-bottom: 1px solid var(--border, #30363d);
  flex-shrink: 0;
}

.sm-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sm-header-left h2 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--fg-primary, #c9d1d9);
}

.sm-session-id {
  /* Flex child in a column — only as wide as its content, not stretched to the
     song-title width above it. */
  align-self: flex-start;
  max-width: 100%;
  font-size: 0.7rem;
  color: var(--fg-tertiary, #484f58);
  background: var(--bg-tertiary, #21262d);
  padding: 0.15rem 0.5rem;
  border-radius: 0.3rem;
  font-family: monospace;
}

.sm-header-titles {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.sm-playlist-subtitle {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  font-size: 0.78rem;
  color: var(--fg-tertiary, #768390);
  overflow: hidden;
  text-overflow: ellipsis;
}
.sm-playlist-singer {
  font-weight: 600;
  color: #ffd166;
}
.sm-playlist-dot {
  opacity: 0.6;
}
.sm-playlist-next {
  opacity: 0.7;
  font-style: italic;
}

.sm-playlist-controls {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  margin-left: 0.4rem;
  padding-left: 0.4rem;
  border-left: 1px solid var(--border, #30363d);
}
.sm-playlist-ctrl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--fg-tertiary, #768390);
  cursor: pointer;
}
.sm-playlist-ctrl-btn svg {
  width: 14px;
  height: 14px;
}
.sm-playlist-ctrl-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: var(--fg-primary, #c9d1d9);
}
.sm-playlist-ctrl-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

/* Focus-mode now-playing bar */
.sm-focus-nowplaying {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  flex-shrink: 0;
  padding: 0.35rem 0.75rem;
  background: linear-gradient(
    90deg,
    rgba(88, 166, 255, 0.12),
    rgba(88, 166, 255, 0.03)
  );
  border-bottom: 1px solid var(--border, #30363d);
  font-size: 0.82rem;
}
.sm-focus-np-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-width: 0;
  overflow: hidden;
}
.sm-focus-song {
  font-weight: 600;
  color: var(--fg-primary, #c9d1d9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 40ch;
}

/* Karaoke playlist sidebar (slides in from the left) */
.sm-playlist-sidebar-wrap {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 30;
  animation: sm-playlist-slide-in 0.2s ease-out;
}
@keyframes sm-playlist-slide-in {
  from {
    transform: translateX(-100%);
    opacity: 0.4;
  }
  to {
    transform: none;
    opacity: 1;
  }
}

.sm-btn--active {
  background: var(--accent, #58a6ff) !important;
  color: #fff !important;
  border-color: var(--accent, #58a6ff) !important;
}

.sm-back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.4rem;
  color: var(--fg-secondary, #8b949e);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.sm-back-btn:hover {
  background: var(--bg-hover, #30363d);
  color: var(--fg-primary, #c9d1d9);
}

.sm-back-btn svg {
  width: 0.9rem;
  height: 0.9rem;
}

.sm-share-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--accent, #8b5cf6);
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.4rem;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  white-space: nowrap;
}

.sm-share-btn:hover {
  background: var(--bg-hover, #30363d);
  border-color: var(--accent, #8b5cf6);
}

.sm-share-btn svg {
  width: 0.85rem;
  height: 0.85rem;
}

.sm-share-btn--copied {
  color: var(--success, #3fb950);
  border-color: var(--success, #3fb950);
  background: rgba(63, 185, 80, 0.1);
}

/* Loading */
.sm-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex: 1;
  color: var(--fg-secondary, #8b949e);
  font-size: 0.9rem;
}

.sm-loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--border, #30363d);
  border-top-color: var(--accent, #58a6ff);
  border-radius: 50%;
  animation: sm-spin 0.8s linear infinite;
}

@keyframes sm-spin {
  to { transform: rotate(360deg); }
}

/* Error */
.sm-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex: 1;
  color: var(--error, #f85149);
  font-size: 0.9rem;
}

.sm-error-retry {
  padding: 0.5rem 1.25rem;
  background: var(--accent, #58a6ff);
  color: var(--on-accent, #0d1117);
  border: none;
  border-radius: 0.4rem;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
}

.sm-error-retry:hover {
  opacity: 0.85;
}

/* Workspace grid */
.sm-workspace {
  display: grid;
  grid-auto-rows: auto;
  align-content: stretch;
  gap: 0.5rem;
  flex: 1;
  overflow: auto;
  padding: 0.5rem;
  min-height: 0;
}

.sm-workspace-panel {
  display: flex;
  flex-direction: column;
  position: relative;
  background: var(--bg-primary, #0d1117);
  border-radius: 0.5rem;
  overflow: hidden;
  min-height: 120px;
  transition: box-shadow 0.15s ease;
}

.sm-workspace-panel.dragging {
  opacity: 0.5;
  box-shadow: 0 0 0 2px var(--accent, #58a6ff);
}

/* Drag handle header */
.sm-panel-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
  color: var(--fg-tertiary, #484f58);
  padding: 0.4rem 0.65rem;
  background: var(--bg-tertiary, #21262d);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.sm-panel-header:active {
  cursor: grabbing;
}

/* Live mic input-level "fill" meter in the Vocal Pitch header. */
.sm-mic-meter {
  width: 48px;
  height: 6px;
  border-radius: 999px;
  background: var(--bg-primary, #0d1117);
  border: 1px solid var(--border, #30363d);
  overflow: hidden;
  flex-shrink: 0;
}

.sm-mic-meter-fill {
  height: 100%;
  width: calc(var(--mic-level, 0) * 100%);
  background: var(--accent, #58a6ff);
  transition: width 0.06s linear;
}

/* Mic monitor (hear yourself) — sidebar control */
.sm-mic-monitor {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.55rem 0.65rem;
  border-top: 1px solid var(--border, #30363d);
}
.sm-mic-monitor-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  font-size: 0.78rem;
  color: var(--fg-secondary, #8b949e);
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.375rem;
  cursor: pointer;
}
.sm-mic-monitor-toggle svg {
  width: 14px;
  height: 14px;
}
.sm-mic-monitor-toggle--active {
  color: #fff;
  background: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
}
.sm-mic-monitor-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.sm-mic-monitor-slider {
  flex: 1;
  min-width: 0;
  accent-color: var(--accent, #58a6ff);
  cursor: pointer;
}
.sm-mic-monitor-slider:disabled {
  opacity: 0.4;
  cursor: default;
}
.sm-mic-monitor-pct {
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  color: var(--fg-tertiary, #768390);
  min-width: 2.4rem;
  text-align: right;
}
.sm-mic-monitor-hint {
  margin: 0;
  font-size: 0.65rem;
  color: var(--fg-tertiary, #768390);
}

/* Pitch Canvas Toolbar */
.pitch-canvas-toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
}

.pitch-canvas-toggle {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.4rem;
  font-size: 0.55rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--fg-tertiary, #484f58);
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
  cursor: pointer;
  transition: all 0.15s;
  text-transform: none;
  letter-spacing: 0;
  white-space: nowrap;
}

.pitch-canvas-toggle:hover {
  color: var(--fg-secondary, #8b949e);
  border-color: var(--fg-tertiary, #484f58);
}

.pitch-canvas-toggle.active {
  background: var(--accent, #8b5cf6);
  border-color: var(--accent, #8b5cf6);
  color: #fff;
}

.pitch-canvas-toggle svg {
  flex-shrink: 0;
}

.pitch-alignment-stats {
  font-size: 0.55rem;
  padding: 0.05rem 0.3rem;
  border-radius: 0.2rem;
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  text-transform: none;
  letter-spacing: 0;
  white-space: nowrap;
}

.pitch-alignment-stats.whisper-processing {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  animation: sm-pulse 1.5s ease-in-out infinite;
}

@keyframes sm-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.sm-drag-icon {
  flex-shrink: 0;
  opacity: 0.5;
  color: var(--fg-tertiary, #484f58);
}

.sm-canvas {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  touch-action: none;
  /* The canvas draws light-on-dark ink (#fff labels, dark gridlines), so the
     studio keeps an opaque dark backdrop in EVERY theme — matching the old
     hard-coded #0d1117 fillRect. Only the karaoke page overrides
     --sm-canvas-bg (to a translucent value) to let its stage glass through. */
  background: var(--sm-canvas-bg, #0d1117);
}

.sm-resize-handle {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
  background: transparent;
  z-index: 5;
  transition: background 0.15s;
  touch-action: none;
}
.sm-resize-handle:hover {
  background: var(--accent, #58a6ff);
}

/* Controls content */
.sm-strips-row {
  display: flex;
  gap: 0.5rem;
}

.sm-stem-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  padding: 0.75rem 0.4rem;
  background: var(--bg-primary, #0d1117);
  border-radius: 0.6rem;
}

.sm-stem-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.sm-stem-dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
}

.sm-stem-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-primary, #c9d1d9);
}

.sm-stem-vol-pct {
  font-size: 0.65rem;
  color: var(--fg-tertiary, #484f58);
}

.sm-stem-actions {
  display: flex;
  gap: 0.15rem;
}

.sm-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.65rem;
  height: 1.65rem;
  padding: 0;
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.35rem;
  color: var(--fg-secondary, #8b949e);
  cursor: pointer;
  transition: all 0.15s;
}

.sm-action-btn svg {
  width: 0.8rem;
  height: 0.8rem;
}

.sm-action-btn:hover {
  background: var(--bg-hover, #30363d);
  color: var(--fg-primary, #c9d1d9);
}

.sm-action-btn.sm-active {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.3);
}

.sm-action-btn.sm-muted {
  color: var(--error, #f85149);
}

.sm-volume-slider {
  writing-mode: vertical-lr;
  direction: rtl;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  width: 4px;
  height: 100px;
  background: transparent;
  border-radius: 2px;
  outline: none;
  border: none;
  cursor: pointer;
}

/* WebKit track */
.sm-volume-slider::-webkit-slider-runnable-track {
  width: 4px;
  height: 100%;
  background: var(--bg-tertiary, #21262d);
  border-radius: 2px;
  border: none;
}

.sm-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--accent, #58a6ff);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--on-accent, #0d1117);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  margin-left: -5px;
}

/* Firefox track */
.sm-volume-slider::-moz-range-track {
  width: 4px;
  height: 100%;
  background: var(--bg-tertiary, #21262d);
  border-radius: 2px;
  border: none;
}

.sm-volume-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--accent, #58a6ff);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--on-accent, #0d1117);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}


  /* MIDI sub-stem */
  .sm-midi-substem {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.5rem;
    margin: -0.25rem 0.25rem 0.25rem 1rem;
    background: rgba(245, 158, 11, 0.06);
    border: 1px solid rgba(245, 158, 11, 0.15);
    border-radius: 0.35rem;
    font-size: 0.65rem;
  }

  .sm-midi-icon {
    display: flex;
    align-items: center;
    color: rgba(245, 158, 11, 0.7);
  }

  .sm-midi-icon svg {
    width: 0.75rem;
    height: 0.75rem;
  }

  .sm-midi-label {
    color: rgba(245, 158, 11, 0.8);
    font-weight: 500;
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .sm-midi-dl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.2rem;
    height: 1.2rem;
    padding: 0;
    margin-left: auto;
    background: transparent;
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 0.25rem;
    color: rgba(245, 158, 11, 0.6);
    cursor: pointer;
    transition: all 0.15s;
  }

  .sm-midi-dl-btn:hover {
    background: rgba(245, 158, 11, 0.15);
    color: rgba(245, 158, 11, 0.9);
  }

  .sm-midi-dl-btn svg {
    width: 0.6rem;
    height: 0.6rem;
  }
.sm-lyrics-source {
  font-size: 0.55rem;
  padding: 0.05rem 0.3rem;
  border-radius: 0.2rem;
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  text-transform: none;
  letter-spacing: 0;
}

.sm-lyrics-source-upload {
  background: rgba(139, 92, 246, 0.15);
  color: #8b5cf6;
}

.sm-lyrics-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 160px;
  padding: 1rem;
}

.sm-lyrics-loading-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.sm-lyrics-loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-primary, #30363d);
  border-top-color: var(--accent, #58a6ff);
  border-radius: 50%;
  animation: sm-spin 0.8s linear infinite;
}

@keyframes sm-spin {
  to { transform: rotate(360deg); }
}

.sm-lyrics-loading-text {
  font-size: 0.85rem;
  color: var(--fg-secondary, #c9d1d9);
  font-weight: 500;
}

.sm-lyrics-loading-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.sm-lyrics-loading-btn {
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--border-primary, #30363d);
  border-radius: 6px;
  background: var(--bg-secondary, #161b22);
  color: var(--fg-secondary, #c9d1d9);
  font-size: 0.72rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.sm-lyrics-loading-btn:hover {
  background: var(--bg-tertiary, #21262d);
  border-color: var(--border-secondary, #484f58);
}

.sm-lyrics-loading-cancel {
  color: #f85149;
  border-color: rgba(248, 81, 73, 0.3);
}

.sm-lyrics-loading-cancel:hover {
  background: rgba(248, 81, 73, 0.1);
  border-color: rgba(248, 81, 73, 0.5);
}

.sm-lyrics-loading-upload {
  color: #8b5cf6;
  border-color: rgba(139, 92, 246, 0.3);
}

.sm-lyrics-loading-upload:hover {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.5);
}

.sm-lyrics-lines {
  flex: 1;
  overflow-y: auto;
  padding: 0.35rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.sm-lyrics-line {
  color: var(--fg-tertiary, #484f58);
  padding: 0.12rem 0.3rem;
  border-radius: 0.2rem;
  cursor: pointer;
  transition: all 0.1s;
  line-height: 1.3;
}

.sm-lyrics-line:hover {
  color: var(--fg-secondary, #8b949e);
  background: var(--bg-tertiary, #21262d);
}

.sm-lyrics-line-active {
  color: var(--accent, #58a6ff);
  background: rgba(88, 166, 255, 0.1);
  font-weight: 500;
}

.sm-lyrics-line-spacer {
  width: 100%;
  min-height: 0.3rem;
}

.sm-lyrics-rest {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  opacity: 0.5;
  user-select: none;
}

.sm-lyrics-rest-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--fg-tertiary);
  animation: sm-rest-pulse 2s ease-in-out infinite;
}

.sm-lyrics-rest-label {
  font-style: italic;
  color: var(--fg-tertiary);
  font-size: 0.75em;
}

@keyframes sm-rest-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* Karaoke rest countdown — each dot fills as the wait elapses so the singer
   knows when to come back in (driven by playback time, so it stays correct
   under reduced-motion; only the per-dot fill easing is decorative). */
.sm-lyrics-rest--active {
  opacity: 1;
}

.sm-lyrics-rest-dots {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
}

.sm-lyrics-rest-dot {
  width: 0.55em;
  height: 0.55em;
  border-radius: 50%;
  background: linear-gradient(
    to right,
    var(--accent, #58a6ff) var(--fill, 0%),
    var(--bg-tertiary, rgba(255, 255, 255, 0.15)) var(--fill, 0%)
  );
  box-shadow: inset 0 0 0 1px var(--border, rgba(255, 255, 255, 0.2));
  transition: background 0.12s linear;
}

.sm-lyrics-time {
  display: inline-block;
  font-size: 0.55rem;
  font-family: monospace;
  color: var(--fg-tertiary, #484f58);
  background: var(--bg-tertiary, #21262d);
  padding: 0.05rem 0.3rem;
  border-radius: 0.2rem;
  margin-right: 0.35rem;
  vertical-align: middle;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.sm-lyrics-line-active .sm-lyrics-time {
  color: var(--accent, #58a6ff);
  background: rgba(88, 166, 255, 0.15);
}

.sm-lyrics-change-btn,
.sm-lyrics-paste-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 1.15rem;
  padding: 0;
  background: transparent;
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
  color: var(--fg-tertiary, #484f58);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  margin-left: 0.15rem;
}

.sm-lyrics-change-btn:hover,
.sm-lyrics-paste-btn:hover {
  color: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
  background: rgba(88, 166, 255, 0.08);
}

.sm-lyrics-upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 1.15rem;
  padding: 0;
  background: transparent;
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
  color: var(--fg-tertiary, #484f58);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  margin-left: 0.15rem;
}

.sm-lyrics-upload-btn:hover {
  color: #8b5cf6;
  border-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.08);
}

/* Lyrics toolbar (zoom + column toggle) */
.sm-lyrics-toolbar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
}

.sm-lyrics-zoom {
  display: flex;
  gap: 1px;
  background: var(--bg-tertiary, #21262d);
  border-radius: 0.25rem;
  padding: 1px;
}

.sm-lyrics-zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 1.2rem;
  height: 1rem;
  padding: 0 0.2rem;
  background: transparent;
  border: none;
  border-radius: 0.2rem;
  color: var(--fg-tertiary, #484f58);
  cursor: pointer;
  font-size: 0.5rem;
  font-weight: 600;
  font-family: inherit;
  transition: all 0.15s;
}

.sm-lyrics-zoom-btn:hover {
  color: var(--fg-secondary, #8b949e);
  background: var(--bg-hover, #30363d);
}

.sm-lyrics-col-toggle {
  display: flex;
  gap: 1px;
  background: var(--bg-tertiary, #21262d);
  border-radius: 0.25rem;
  padding: 1px;
}

.sm-lyrics-col-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 1rem;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0.2rem;
  color: var(--fg-tertiary, #484f58);
  cursor: pointer;
  transition: all 0.15s;
}

.sm-lyrics-col-btn:hover {
  color: var(--fg-secondary, #8b949e);
}

.sm-lyrics-col-active {
  background: var(--accent, #58a6ff);
  color: var(--on-accent, #0d1117);
}

.sm-lyrics-col-active:hover {
  color: var(--on-accent, #0d1117);
}

/* Two-column lyrics layout with section-aware breaks */
.sm-lyrics-columns-2 {
  column-count: 2;
  column-gap: 1rem;
  display: block;
}

/* Per-word highlighting */
.sm-lyrics-word {
  transition: color 0.2s ease;
}

.sm-lyrics-line-active .sm-lyrics-word {
  color: var(--fg-secondary, #8b949e);
}

.sm-lyrics-line-active .sm-lyrics-word-done {
  color: var(--accent, #58a6ff);
}

.sm-lyrics-line-active .sm-lyrics-word-current {
  /* container for the in-progress word */
}

.sm-lyrics-char-done {
  color: var(--accent-lighter, #79c0ff);
}

.sm-lyrics-char-remaining {
  color: var(--fg-secondary, #8b949e);
}

/* Word-with-note label (word-to-pitch mapping) */
.sm-lyrics-word-with-note {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  vertical-align: top;
}

.sm-lyrics-word-note {
  font-size: 0.5rem;
  font-weight: 600;
  color: var(--accent, #58a6ff);
  line-height: 1;
  white-space: nowrap;
  margin-bottom: 1px;
  opacity: 0.85;
}

.sm-lyrics-word-note-spacer {
  visibility: hidden;
}

/* Note label toggle in lyrics toolbar */
.sm-lyrics-note-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.2rem;
  height: 1.15rem;
  padding: 0;
  background: transparent;
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
  color: var(--fg-tertiary, #484f58);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  margin-left: 0.15rem;
}

.sm-lyrics-note-toggle:hover {
  color: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
  background: rgba(88, 166, 255, 0.08);
}

.sm-lyrics-note-toggle.active {
  color: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
  background: rgba(88, 166, 255, 0.12);
}

/* ── Edit mode ──────────────────────────────────────────── */

.sm-lyrics-edit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.2rem;
  height: 1.15rem;
  padding: 0;
  background: transparent;
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
  color: var(--fg-tertiary, #484f58);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  margin-left: 0.15rem;
}

.sm-lyrics-edit-btn:hover {
  color: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
  background: rgba(88, 166, 255, 0.08);
}

.sm-lyrics-edit-toolbar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.4rem;
  border-bottom: 1px solid var(--border, #30363d);
}

.sm-lyrics-save-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.5rem;
  height: 1.2rem;
  font-size: 0.55rem;
  font-weight: 600;
  font-family: inherit;
  background: var(--accent, #58a6ff);
  color: var(--on-accent, #0d1117);
  border: none;
  border-radius: 0.2rem;
  cursor: pointer;
  transition: opacity 0.15s;
}

.sm-lyrics-save-btn:hover {
  opacity: 0.85;
}

.sm-lyrics-cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.5rem;
  height: 1.2rem;
  font-size: 0.55rem;
  font-weight: 500;
  font-family: inherit;
  background: transparent;
  color: var(--fg-tertiary, #484f58);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
  cursor: pointer;
  transition: all 0.15s;
}

.sm-lyrics-cancel-btn:hover {
  color: var(--fg-primary, #c9d1d9);
  border-color: var(--fg-tertiary, #484f58);
}

.sm-lyrics-lines-edit {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.sm-lyrics-line-edit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.15rem;
  padding: 0.2rem 0.3rem;
  border-bottom: 1px solid var(--border, #30363d);
}

.sm-lyrics-time-input {
  width: 3rem;
  height: 1.25rem;
  font-size: 0.55rem;
  font-family: monospace;
  background: var(--bg-tertiary, #21262d);
  color: var(--accent, #58a6ff);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
  padding: 0 0.2rem;
  margin-right: 0.35rem;
  text-align: center;
}

.sm-lyrics-time-input:focus {
  outline: none;
  border-color: var(--accent, #58a6ff);
}

.sm-lyrics-word-edit {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.sm-lyrics-word-text {
  font-size: inherit;
  line-height: 1.3;
}

.sm-lyrics-word-time-label {
  font-size: 0.45rem;
  font-family: monospace;
  color: var(--fg-tertiary, #484f58);
  background: var(--bg-tertiary, #21262d);
  border: 1px solid transparent;
  border-radius: 0.15rem;
  padding: 0 0.2rem;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.sm-lyrics-word-time-label:hover {
  color: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
  background: rgba(88, 166, 255, 0.08);
}

/* ── Edit popover ──────────────────────────────────────── */

.sm-lyrics-popover-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.sm-lyrics-popover-card {
  background: var(--bg-primary, #0d1117);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.4rem;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
  min-width: 10rem;
}

.sm-lyrics-popover-word {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-primary, #c9d1d9);
}

.sm-lyrics-popover-input {
  width: 6rem;
  height: 1.8rem;
  font-size: 1.2rem;
  font-family: monospace;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.1em;
  background: var(--bg-tertiary, #21262d);
  color: var(--accent, #58a6ff);
  border: 2px solid var(--accent, #58a6ff);
  border-radius: 0.3rem;
  padding: 0 0.35rem;
  outline: none;
}

.sm-lyrics-popover-input:focus {
  border-color: var(--accent, #58a6ff);
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
}

.sm-lyrics-popover-hint {
  font-size: 0.5rem;
  color: var(--fg-tertiary, #484f58);
}

/* ── LRC Generator mode ─────────────────────────────────── */

.sm-lyrics-gen-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.2rem;
  height: 1.15rem;
  padding: 0;
  background: transparent;
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
  color: var(--fg-tertiary, #484f58);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  margin-left: 0.15rem;
}

.sm-lyrics-gen-btn:hover {
  color: var(--ok-green, #3fb950);
  border-color: var(--ok-green, #3fb950);
  background: rgba(63, 185, 80, 0.08);
}

.sm-lyrics-gen-label {
  font-size: 0.5rem;
  font-weight: 600;
  color: var(--ok-green, #3fb950);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-left: 0.35rem;
}

/* ── Mark Blocks mode ─────────────────────────────────────── */

.sm-lyrics-markmode-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.2rem;
  height: 1.15rem;
  padding: 0;
  background: transparent;
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
  color: var(--fg-tertiary, #484f58);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  margin-left: 0.15rem;
}

.sm-lyrics-markmode-btn:hover {
  color: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
  background: rgba(88, 166, 255, 0.08);
}

/* ── Whisper Transcribe button ─────────────────────────────── */

.sm-transcribe-btn {
  padding: 0 0.45rem;
  height: 1.15rem;
  font-size: 0.5rem;
  font-weight: 600;
  font-family: inherit;
  background: transparent;
  border: 1px solid var(--accent, #58a6ff);
  border-radius: 0.2rem;
  color: var(--accent, #58a6ff);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  margin-left: 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sm-transcribe-btn:hover {
  background: var(--accent, #58a6ff);
  color: var(--on-accent, #0d1117);
}

.sm-whisper-lang-select {
  height: 1.15rem;
  padding: 0 0.2rem;
  font-size: 0.5rem;
  font-weight: 600;
  font-family: inherit;
  background: transparent;
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
  color: var(--fg-secondary, #8b949e);
  cursor: pointer;
  flex-shrink: 0;
  margin-left: 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  appearance: none;
  -webkit-appearance: none;
  outline: none;
}

.sm-whisper-lang-select:hover,
.sm-whisper-lang-select:focus {
  border-color: var(--accent, #58a6ff);
  color: var(--accent, #58a6ff);
}

.sm-whisper-lang-select option {
  background: var(--bg-secondary, #161b22);
  color: var(--fg-primary, #c9d1d9);
}

.sm-lyrics-markmode-btn--active {
  background: var(--accent, #58a6ff);
  color: var(--on-accent, #0d1117);
  border-color: var(--accent, #58a6ff);
}

.sm-lyrics-markmode-btn--active:hover {
  background: var(--accent-hover, #79b8ff);
  color: var(--on-accent, #0d1117);
}

.sm-lyrics-download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.2rem;
  height: 1.15rem;
  padding: 0;
  background: transparent;
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
  color: var(--fg-tertiary, #484f58);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  margin-left: 0.15rem;
}

.sm-lyrics-download-btn:hover {
  color: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
  background: rgba(88, 166, 255, 0.08);
}

.sm-lyrics-line-markable {
  cursor: pointer;
  border-radius: 0.2rem;
  transition: background 0.12s;
}

.sm-lyrics-line-markable:hover {
  background: var(--bg-tertiary);
}

.sm-lyrics-line-mark-selected {
  background: rgba(88, 166, 255, 0.1);
  outline: 1px solid rgba(88, 166, 255, 0.3);
}

/* ── Mark mode toolbar ─────────────────────────────────────── */

.sm-lyrics-lines--marking {
  border: 1px solid var(--accent, #58a6ff);
  border-radius: 0.35rem;
  padding: 0.35rem;
}

.sm-lyrics-mark-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  background: rgba(88, 166, 255, 0.06);
  border: 1px solid rgba(88, 166, 255, 0.2);
  border-radius: 0.3rem;
  margin-bottom: 0.35rem;
  font-size: 0.7rem;
  flex-wrap: wrap;
}

.sm-lyrics-mark-status {
  color: var(--accent, #58a6ff);
  font-weight: 500;
  font-size: 0.68rem;
  white-space: nowrap;
}

.sm-lyrics-mark-actions {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.sm-lyrics-mark-add-select {
  padding: 0.2rem 0.35rem;
  background: var(--bg-primary, #0d1117);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
  color: var(--fg-primary, #c9d1d9);
  font-size: 0.65rem;
  font-family: inherit;
  cursor: pointer;
}

.sm-lyrics-mark-toolbar-cancel {
  padding: 0.2rem 0.6rem;
  background: var(--bg-tertiary, #21262d);
  color: var(--fg-secondary, #8b949e);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
  font-size: 0.65rem;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}

.sm-lyrics-mark-toolbar-cancel:hover {
  color: var(--fg-primary, #c9d1d9);
  background: var(--bg-hover, #30363d);
}

/* ── Block badges ──────────────────────────────────────────── */

.sm-lyrics-block-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.42rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.05rem 0.4rem;
  border-radius: 0.18rem;
  color: var(--block-color, var(--accent));
  cursor: pointer;
  user-select: none;
  line-height: 1.4;
}

.sm-lyrics-block-badge--template {
  background: color-mix(in srgb, var(--block-color, #58a6ff) 16%, transparent);
  border: 1px solid var(--block-color, var(--accent));
  opacity: 0.9;
}

.sm-lyrics-block-badge--instance {
  background: transparent;
  border: 1px dashed var(--block-color, var(--accent));
  opacity: 0.65;
}

.sm-lyrics-block-repeat {
  font-size: 0.38rem;
  opacity: 0.7;
}

.sm-lyrics-block-badge:hover {
  opacity: 1;
}

/* ── Block line styling ────────────────────────────────────── */

.sm-lyrics-line--blocked {
  border-left: 3px solid var(--block-color, var(--accent));
  padding-left: 0.35rem;
}

.sm-lyrics-line--block-instance {
  border-left-style: dashed;
}

/* ── Loop A/B markers on lyric lines ───────────────────────── */

.sm-lyrics-line--loop-a {
  border-left-color: var(--accent, #58a6ff);
  background: rgba(88, 166, 255, 0.08);
}

.sm-lyrics-line--loop-b {
  border-left-color: var(--accent, #58a6ff);
  background: rgba(88, 166, 255, 0.12);
}

.sm-lyrics-line--loop-range {
  background: rgba(88, 166, 255, 0.04);
}

.sm-lyrics-loop-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 3px;
  font-size: 0.5rem;
  font-weight: 700;
  margin-right: 0.3rem;
  vertical-align: middle;
  user-select: none;
  flex-shrink: 0;
}

.sm-lyrics-loop-badge--a {
  background: var(--accent, #58a6ff);
  color: #fff;
}

.sm-lyrics-loop-badge--b {
  border: 1.5px solid var(--accent, #58a6ff);
  color: var(--accent, #58a6ff);
}

/* ── Block unlink ──────────────────────────────────────────── */

.sm-lyrics-block-unlink {
  opacity: 0;
  cursor: pointer;
  font-size: 0.48rem;
  font-weight: 700;
  line-height: 1;
  padding: 0 0.15rem;
  color: var(--fg-tertiary, #484f58);
  transition: all 0.12s;
  user-select: none;
}

.sm-lyrics-line:hover .sm-lyrics-block-unlink,
.sm-lyrics-block-badge:hover .sm-lyrics-block-unlink {
  opacity: 0.5;
}

.sm-lyrics-block-unlink:hover {
  opacity: 1 !important;
  color: var(--danger, #f85149);
}

/* ── Block form ────────────────────────────────────────────── */

.sm-lyrics-block-form {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.4rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.25rem;
  margin-bottom: 0.3rem;
}

.sm-lyrics-block-form-label {
  height: 1.2rem;
  width: 5rem;
  font-size: 0.55rem;
  background: var(--bg-primary, #0d1117);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.18rem;
  color: var(--fg-primary);
  padding: 0 0.3rem;
}

.sm-lyrics-block-form-label:focus {
  outline: none;
  border-color: var(--accent, #58a6ff);
}

.sm-lyrics-block-form-repeat {
  height: 1.2rem;
  width: 2.5rem;
  font-size: 0.55rem;
  background: var(--bg-primary, #0d1117);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.18rem;
  color: var(--fg-primary);
  padding: 0 0.2rem;
  text-align: center;
}

.sm-lyrics-block-form-repeat:focus {
  outline: none;
  border-color: var(--accent, #58a6ff);
}

.sm-lyrics-block-form-btn {
  height: 1.2rem;
  font-size: 0.55rem;
  font-weight: 600;
  background: var(--accent, #58a6ff);
  color: var(--on-accent, #0d1117);
  border: none;
  border-radius: 0.18rem;
  cursor: pointer;
  padding: 0 0.5rem;
  transition: opacity 0.12s;
}

.sm-lyrics-block-form-btn:hover {
  opacity: 0.85;
}

.sm-lyrics-block-form-cancel {
  height: 1.2rem;
  font-size: 0.5rem;
  background: transparent;
  color: var(--fg-tertiary, #484f58);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.18rem;
  cursor: pointer;
  padding: 0 0.4rem;
  transition: color 0.12s;
}

.sm-lyrics-block-form-cancel:hover {
  color: var(--fg-primary);
}

.sm-lyrics-block-delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.2rem;
  width: 1.2rem;
  background: transparent;
  color: var(--fg-tertiary, #484f58);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.18rem;
  cursor: pointer;
  padding: 0;
  margin-left: auto;
  transition: all 0.12s;
}

.sm-lyrics-block-delete-btn:hover {
  color: var(--danger, #f85149);
  border-color: var(--danger, #f85149);
}

/* ── Block edit popover ────────────────────────────────────── */

.sm-lyrics-block-edit-popover {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.4rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--accent, #58a6ff);
  border-radius: 0.25rem;
  margin-bottom: 0.3rem;
}

/* ── LRC gen block instance indicator ──────────────────────── */

.sm-lyrics-gen-instance-badge {
  font-size: 0.5rem;
  color: var(--fg-tertiary, #484f58);
  margin: 0 0.2rem;
  padding: 0.08rem 0.3rem;
  background: var(--bg-tertiary);
  border-radius: 0.15rem;
  white-space: nowrap;
}

.sm-lyrics-gen-toolbar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--border, #30363d);
  flex-wrap: wrap;
}

.sm-lyrics-gen-play-btn,
.sm-lyrics-gen-pause-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 1.8rem;
  padding: 0;
  background: var(--accent, #58a6ff);
  color: var(--on-accent, #0d1117);
  border: none;
  border-radius: 0.2rem;
  cursor: pointer;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.sm-lyrics-gen-play-btn:hover,
.sm-lyrics-gen-pause-btn:hover {
  opacity: 0.85;
}

.sm-lyrics-gen-progress {
  font-size: 0.65rem;
  font-family: monospace;
  color: var(--fg-secondary, #8b949e);
  margin: 0 0.5rem;
  flex-shrink: 0;
}

.sm-lyrics-gen-nextword-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.8rem;
  height: 1.8rem;
  font-size: 0.7rem;
  font-weight: 600;
  font-family: inherit;
  background: var(--accent, #58a6ff);
  color: var(--on-accent, #0d1117);
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: opacity 0.15s;
}

.sm-lyrics-gen-nextword-btn:hover {
  opacity: 0.85;
}

.sm-lyrics-gen-nextline-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.8rem;
  height: 1.8rem;
  font-size: 0.7rem;
  font-weight: 600;
  font-family: inherit;
  background: var(--bg-tertiary, #21262d);
  color: var(--fg-secondary, #8b949e);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s;
}

.sm-lyrics-gen-nextline-btn:hover {
  color: var(--fg-primary, #c9d1d9);
  border-color: var(--fg-tertiary, #484f58);
}

.sm-lyrics-gen-finish-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.8rem;
  height: 1.8rem;
  font-size: 0.7rem;
  font-weight: 600;
  font-family: inherit;
  background: var(--ok-green, #3fb950);
  color: var(--on-accent, #0d1117);
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: opacity 0.15s;
  margin-left: auto;
}

.sm-lyrics-gen-finish-btn:hover {
  opacity: 0.85;
}

.sm-lyrics-gen-reset-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.8rem;
  height: 1.8rem;
  font-size: 0.7rem;
  font-weight: 500;
  font-family: inherit;
  background: transparent;
  color: var(--fg-tertiary, #484f58);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s;
}

.sm-lyrics-gen-reset-btn:hover {
  color: var(--error-red, #f85149);
  border-color: var(--error-red, #f85149);
}

.sm-lyrics-gen-lines {
  display: flex;
  flex-direction: column;
}

.sm-lyrics-gen-line {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  padding: 0.15rem 0.3rem;
  border-bottom: 1px solid transparent;
  transition: background 0.2s;
}

.sm-lyrics-gen-line-done {
  color: var(--fg-secondary, #8b949e);
}

.sm-lyrics-gen-line-current {
  background: rgba(63, 185, 80, 0.12);
  border-bottom-color: var(--ok-green, #3fb950);
  color: var(--fg-primary, #c9d1d9);
}

.sm-lyrics-gen-line-future {
  color: var(--fg-tertiary, #484f58);
}

.sm-lyrics-gen-line-time {
  display: inline-block;
  font-size: 0.5rem;
  font-family: monospace;
  color: var(--fg-tertiary, #484f58);
  background: var(--bg-tertiary, #21262d);
  padding: 0.05rem 0.25rem;
  border-radius: 0.15rem;
  flex-shrink: 0;
  min-width: 2.8rem;
  text-align: center;
}

.sm-lyrics-gen-line-current .sm-lyrics-gen-line-time {
  color: var(--ok-green, #3fb950);
  background: rgba(63, 185, 80, 0.12);
}

.sm-lyrics-gen-line-text {
  line-height: 1.4;
  display: flex;
  flex-wrap: wrap;
  gap: 0 0.3rem;
}

.sm-lyrics-gen-word {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.sm-lyrics-gen-word-time {
  font-size: 0.4rem;
  font-family: monospace;
  color: var(--fg-tertiary, #484f58);
  min-height: 0.6rem;
}

.sm-lyrics-gen-word-done .sm-lyrics-gen-word-time {
  color: var(--accent, #58a6ff);
}

.sm-lyrics-gen-word-current .sm-lyrics-gen-word-time {
  color: var(--ok-green, #3fb950);
}

.sm-lyrics-gen-word-text {
  font-size: inherit;
}

.sm-lyrics-gen-word-current .sm-lyrics-gen-word-text {
  color: var(--ok-green, #3fb950);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.sm-lyrics-gen-word-done .sm-lyrics-gen-word-text {
  color: var(--fg-secondary, #8b949e);
}

/* Block placeholders in gen view */
.sm-lyrics-gen-line-placeholder {
  border-left: 3px solid var(--block-color, #58a6ff);
  background: color-mix(in srgb, var(--block-color, #58a6ff) 8%, transparent);
  opacity: 0.75;
  font-style: italic;
}

.sm-lyrics-gen-line-placeholder .sm-lyrics-gen-line-time {
  color: var(--block-color, #58a6ff);
}

.sm-lyrics-gen-placeholder-text {
  font-size: 0.55rem;
  color: var(--fg-tertiary, #8b949e);
}

/* Template line indicator in gen view */
.sm-lyrics-gen-line-template {
  border-left: 2px solid var(--block-color, #58a6ff);
}

/* Block instance badge in gen toolbar */
.sm-lyrics-gen-instance-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.5rem;
  color: var(--fg-tertiary, #8b949e);
  margin: 0 0.3rem;
  white-space: nowrap;
}

/* Let uploader fill remaining panel height so dropzone is fully visible */
.sm-workspace-panel > .lu-root {
  flex: 1;
  min-height: 0;
}

/* Column toggle */
.sm-col-toggle {
  display: flex;
  gap: 2px;
  background: var(--bg-tertiary, #21262d);
  border-radius: 0.3rem;
  padding: 2px;
  margin: 0 0.5rem;
}
.sm-col-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.25rem;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0.2rem;
  color: var(--fg-tertiary, #484f58);
  cursor: pointer;
  transition: all 0.15s;
}
.sm-col-btn:hover {
  color: var(--fg-secondary, #8b949e);
}
.sm-col-active {
  background: var(--accent, #58a6ff);
  color: var(--on-accent, #0d1117);
}
.sm-col-active:hover {
  color: var(--on-accent, #0d1117);
}

/* Transport */
.sm-transport {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: var(--bg-primary, #0d1117);
  border-top: 1px solid var(--border, #30363d);
  flex-shrink: 0;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.sm-transport-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

/* Docked Toolbar Styles */

.sm-transport--docked-top {
  order: -1;
}

.sm-transport--docked-bottom {
  order: 999;
}

.sm-transport--docked-left {
  order: -1;
}

.sm-transport--docked-right {
  order: 999;
}

.sm-transport--vertical {
  flex-direction: column;
  padding: 1.25rem 0.5rem;
  border-top: none;
  border-right: 1px solid var(--border, #30363d);
}

.sm-transport--vertical.sm-transport--docked-right {
  border-right: none;
  border-left: 1px solid var(--border, #30363d);
}

.sm-transport--vertical .sm-transport-controls {
  flex-direction: column;
}

.sm-transport-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  margin: -0.375rem; /* Increase hit area without changing layout size */
  cursor: grab;
  color: var(--fg-muted, #8b949e);
  border-radius: 0.25rem;
  transition: all 0.15s;
  touch-action: none;
  -webkit-touch-callout: none;
}

.sm-transport-drag-handle:hover {
  background: var(--bg-hover, #30363d);
  color: var(--fg-primary, #c9d1d9);
}

.sm-transport-drag-handle:active {
  cursor: grabbing;
}

.sm-drag-overlay {
  position: absolute;
  background: var(--accent, #58a6ff);
  opacity: 0.15;
  pointer-events: none;
  z-index: 1000;
  transition: all 0.15s;
}

.sm-drag-overlay--top {
  top: 0; left: 0; right: 0; height: 100px;
}
.sm-drag-overlay--bottom {
  bottom: 0; left: 0; right: 0; height: 100px;
}
.sm-drag-overlay--left {
  top: 0; bottom: 0; left: 0; width: 100px;
}
.sm-drag-overlay--right {
  top: 0; bottom: 0; right: 0; width: 100px;
}

.sm-transport-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.4rem;
  color: var(--fg-secondary, #8b949e);
  cursor: pointer;
  transition: all 0.15s;
}

.sm-transport-btn svg {
  width: 0.85rem;
  height: 0.85rem;
}

/* Base loop icon styles */
.sm-loop-icon circle {
  fill: var(--bg-tertiary, #21262d);
  stroke: var(--border, #30363d);
  stroke-width: 1.5px;
  transition: all 0.2s ease;
}

/* Hover effects */
.sm-loop-icon-a:hover circle {
  stroke: var(--accent, #58a6ff);
  fill: rgba(88, 166, 255, 0.1);
}
.sm-loop-icon-a:hover text {
  fill: var(--accent, #58a6ff);
}
.sm-icon-btn.sm-loop-icon-a text {
  fill: var(--fg-secondary, #8b949e);
  transition: all 0.2s ease;
}

.sm-loop-icon-b:hover circle {
  stroke: #ff7b72;
  fill: rgba(255, 123, 114, 0.1);
}
.sm-loop-icon-b:hover text {
  fill: #ff7b72;
}
.sm-icon-btn.sm-loop-icon-b text {
  fill: var(--fg-secondary, #8b949e);
  transition: all 0.2s ease;
}

/* Active effects */
.sm-loop-btn--a-set.sm-loop-icon-a text {
  fill: #0d1117 !important;
}
.sm-loop-btn--a-set.sm-loop-icon-a circle {
  fill: var(--accent, #58a6ff);
  stroke: var(--accent, #58a6ff);
}

.sm-loop-btn--b-set.sm-loop-icon-b text {
  fill: #0d1117 !important;
}
.sm-loop-btn--b-set.sm-loop-icon-b circle {
  fill: #ff7b72;
  stroke: #ff7b72;
}

.sm-icon-btn svg.sm-loop-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.sm-icon-btn svg {
  width: 1.2rem;
  height: 1.2rem;
}

.sm-transport-btn:hover:not(:disabled) {
  background: var(--bg-hover, #30363d);
  color: var(--fg-primary, #c9d1d9);
}

.sm-icon-btn {
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  color: var(--fg-secondary, #8b949e);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  transition: all 0.15s;
}

.sm-icon-btn:hover:not(:disabled) {
  color: var(--fg-primary, #c9d1d9);
}

.sm-transport-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.sm-transport-play {
  width: 2.5rem;
  height: 2.5rem;
  background: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
  color: var(--on-accent, #0d1117);
  border-radius: 50%;
}

.sm-transport-play:hover:not(:disabled) {
  opacity: 0.85;
  color: var(--on-accent, #0d1117);
}

.sm-zoom-control {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  margin: 0 0.5rem;
}

.sm-zoom-btn {
  width: 1.35rem;
  height: 1.35rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border-primary, #30363d);
  color: var(--fg-secondary, #8b949e);
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1;
  padding: 0;
}

.sm-zoom-btn:hover {
  background: var(--bg-secondary, #161b22);
  color: var(--fg-primary, #c9d1d9);
}

.sm-zoom-value {
  font-size: 0.65rem;
  color: var(--fg-tertiary, #484f58);
  font-family: monospace;
  min-width: 28px;
  text-align: center;
}

.sm-speed-select {
  appearance: none;
  -webkit-appearance: none;
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.3rem;
  color: var(--fg-secondary, #8b949e);
  font-size: 0.65rem;
  font-family: monospace;
  padding: 0 0.4rem;
  text-align: center;
  text-align-last: center;
  cursor: pointer;
  margin: 0 0.3rem;
  height: 1.75rem;
}
.sm-speed-select:hover {
  border-color: var(--fg-tertiary, #484f58);
}
.sm-speed-select:focus {
  outline: none;
  border-color: var(--accent, #58a6ff);
}

.sm-progress-area {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sm-time {
  font-size: 0.7rem;
  color: var(--fg-tertiary, #484f58);
  font-family: monospace;
  min-width: 32px;
  flex-shrink: 0;
}

.sm-time:last-child {
  text-align: right;
}

.sm-progress-bar {
  flex: 1;
  height: 0.35rem;
  background: var(--bg-tertiary, #21262d);
  border-radius: 0.2rem;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.sm-progress-bar:hover {
  height: 0.5rem;
}

.sm-progress-fill {
  height: 100%;
  background: var(--accent, #58a6ff);
  border-radius: 0.2rem;
  transition: width 0.1s linear;
}

/* Loop range highlight on progress bar */
.sm-progress-loop {
  position: absolute;
  top: 0;
  height: 100%;
  background: rgba(88, 166, 255, 0.25);
  border-left: 1px solid rgba(88, 166, 255, 0.5);
  border-right: 1px solid rgba(88, 166, 255, 0.5);
  pointer-events: none;
}

/* Loop A/B buttons */
.sm-loop-btn--a-set {
  color: var(--accent, #58a6ff) !important;
}

.sm-loop-btn--b-set {
  color: #d2a8ff !important;
}

/* Loop toggle active state */
.sm-loop-toggle--active {
  color: var(--accent, #58a6ff) !important;
}

/* Loop metrics bar (appears above transport when loop is active) */
.sm-loop-metrics {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.4rem 1.25rem;
  background: rgba(88, 166, 255, 0.06);
  border-top: 1px solid var(--border, #30363d);
  font-size: 0.72rem;
  color: var(--text-secondary, #8b949e);
  flex-shrink: 0;
}

.sm-loop-metrics span {
  white-space: nowrap;
}

.sm-loop-metrics strong {
  color: var(--accent, #58a6ff);
}

/* Mic toggle button */
.sm-mic-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.4rem;
  color: var(--fg-secondary, #8b949e);
  cursor: pointer;
  transition: all 0.15s;
  margin: 0 0.5rem;
}

.sm-mic-toggle-btn svg {
  width: 0.85rem;
  height: 0.85rem;
}

.sm-mic-toggle-btn:hover:not(:disabled) {
  background: var(--bg-hover, #30363d);
  color: var(--fg-primary, #c9d1d9);
}

.sm-mic-toggle-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.sm-mic-toggle-btn--active {
  background: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
  color: var(--on-accent, #0d1117);
  animation: sm-mic-pulse 1.5s ease-in-out infinite;
}

.sm-mic-toggle-btn--active:hover:not(:disabled) {
  opacity: 0.85;
  color: var(--on-accent, #0d1117);
}

.sm-mic-toggle-btn--error {
  background: var(--danger, #da3633);
  border-color: var(--danger, #da3633);
  color: var(--fg-primary, #c9d1d9);
}

@keyframes sm-mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(88, 166, 255, 0.4); }
  50% { box-shadow: 0 0 0 4px rgba(88, 166, 255, 0); }
}

/* Score modal overlay */
.sm-mic-score-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  animation: sm-score-overlay-in 0.25s ease-out;
}
@keyframes sm-score-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.sm-mic-score-card {
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.75rem;
  padding: 1.25rem 1.5rem;
  min-width: 280px;
  max-width: 360px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  animation: sm-score-in 0.3s ease-out;
}
@keyframes sm-score-in {
  from { opacity: 0; transform: translateY(-0.75rem) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.sm-mic-score-card-inner {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.sm-mic-score-close {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  padding: 0;
  background: none;
  border: none;
  border-radius: 0.25rem;
  color: var(--fg-tertiary, #8b949e);
  cursor: pointer;
}
.sm-mic-score-close:hover {
  color: var(--fg-primary, #e6edf3);
  background: var(--bg-tertiary, #21262d);
}
.sm-mic-score-grade-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.sm-mic-grade {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1;
  flex-shrink: 0;
}
.sm-mic-grade--s { background: #238636; color: #fff; }
.sm-mic-grade--a { background: #1a7f37; color: #fff; }
.sm-mic-grade--b { background: #9e6a03; color: #fff; }
.sm-mic-grade--c { background: #d29922; color: #0d1117; }
.sm-mic-grade--d { background: #da3633; color: #fff; }
.sm-mic-score-stats {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.sm-mic-score-accuracy {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--fg-primary, #e6edf3);
}
.sm-mic-score-detail {
  font-size: 0.6rem;
  color: var(--fg-tertiary, #8b949e);
}
.sm-mic-score-ok-btn {
  margin-top: 0.5rem;
  padding: 0.5rem 1.5rem;
  background: var(--accent, #58a6ff);
  color: #fff;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  align-self: center;
  transition: background 0.15s;
}
.sm-mic-score-ok-btn:hover {
  background: var(--accent-hover, #79c0ff);
}

/* Fixed 2-Column Layout */
.sm-fixed-layout {
  display: flex;
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.sm-fixed-main {
  display: flex;
  flex: 1;
  gap: 0.5rem;
  padding: 0.5rem;
  overflow: hidden;
  min-height: 0;
}

.sm-fixed-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 0;
  overflow: auto;
}

/* Right Sidebar */
/* Performance ("karaoke stage") layout — big centred lyrics + mixer */
.sm-perf-layout {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 0.5rem;
  padding: 0.5rem;
}
.sm-perf-waveform {
  height: 84px;
  flex-shrink: 0;
}
.sm-perf-waveform .sm-canvas {
  width: 100%;
  height: 100%;
}
.sm-perf-main {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 0.5rem;
}
.sm-perf-lyrics {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.sm-perf-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.sm-perf-title {
  font-weight: 600;
}
.sm-lyrics-align-toggle {
  display: inline-flex;
  gap: 2px;
}
.sm-lyrics-align-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 5px;
  background: transparent;
  border: 1px solid var(--border, #30363d);
  border-radius: 4px;
  color: var(--fg-tertiary);
  cursor: pointer;
}
.sm-lyrics-align-btn.sm-lyrics-align-active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-dim, rgba(88, 166, 255, 0.15));
}

.sm-sidebar {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem 0.5rem 0;
  overflow-y: auto;
  transition: width 0.25s ease, opacity 0.2s ease, padding 0.25s ease;
}

.sm-sidebar-hidden {
  width: 0 !important;
  min-width: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  opacity: 0;
}

/* Sidebar toggle button */
.sm-sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.4rem;
  color: var(--fg-secondary, #8b949e);
  cursor: pointer;
  transition: all 0.15s;
  margin: 0 0.5rem;
}

.sm-sidebar-toggle svg {
  width: 0.85rem;
  height: 0.85rem;
}

.sm-sidebar-toggle:hover {
  background: var(--bg-hover, #30363d);
  color: var(--fg-primary, #c9d1d9);
}

.sm-sidebar-toggle--active {
  background: var(--accent, #58a6ff);
  color: #fff;
  border-color: var(--accent, #58a6ff);
}

.sm-sidebar-toggle--active:hover {
  background: var(--accent-hover, #79c0ff);
  color: #fff;
}

.sm-song-picker {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  height: 100%;
  overflow: hidden;
}

.sm-song-picker-header {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fg-primary, #c9d1d9);
}

.sm-song-picker-search {
  display: flex;
  gap: 0.5rem;
}

.sm-song-picker-input {
  flex: 1;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border, #30363d);
  border-radius: 0.375rem;
  background: var(--bg-primary, #0d1117);
  color: var(--fg-primary, #c9d1d9);
  font-size: 0.85rem;
  outline: none;
}

.sm-song-picker-input:focus {
  border-color: var(--accent, #58a6ff);
}

.sm-song-picker-list {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--border, #30363d);
  border-radius: 0.375rem;
  background: var(--bg-primary, #0d1117);
}

.sm-song-picker-row {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.45rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--fg-primary, #c9d1d9);
  font-size: 0.825rem;
  cursor: pointer;
  text-align: left;
  gap: 0.15rem;
  border-bottom: 1px solid var(--border, #30363d);
  transition: background 0.1s;
}

.sm-song-picker-row:last-child {
  border-bottom: none;
}

.sm-song-picker-row:hover {
  background: var(--bg-hover, #1c2128);
}

.sm-song-picker-artist {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sm-song-picker-sep {
  color: var(--fg-muted, #8b949e);
  flex-shrink: 0;
}

.sm-song-picker-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sm-song-picker-badge {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
  background: var(--accent, #58a6ff);
  color: #fff;
}

.sm-song-picker-footer {
  flex-shrink: 0;
}

.sm-song-picker-upload-link {
  background: none;
  border: none;
  color: var(--fg-muted, #8b949e);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.sm-song-picker-upload-link:hover {
  color: var(--accent, #58a6ff);
}

.sm-song-picker-no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
  gap: 0.5rem;
  border: 1px dashed var(--border, #30363d);
  border-radius: 0.375rem;
  background: var(--bg-secondary, #161b22);
  margin-top: 0.5rem;
}

.sm-song-picker-no-results-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-primary, #c9d1d9);
}

.sm-song-picker-no-results-hint {
  font-size: 0.75rem;
  color: var(--fg-muted, #8b949e);
  margin-bottom: 0.25rem;
}

.sm-song-picker-lrclib-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--accent, #58a6ff);
  text-decoration: none;
  padding: 0.35rem 0.7rem;
  border-radius: 0.375rem;
  background: rgba(88, 166, 255, 0.08);
  border: 1px solid rgba(88, 166, 255, 0.2);
  transition: all 0.15s;
}

.sm-song-picker-lrclib-link:hover {
  background: rgba(88, 166, 255, 0.15);
  border-color: rgba(88, 166, 255, 0.4);
  text-decoration: none;
}

.sm-song-picker-lrclib-link svg {
  width: 0.85rem;
  height: 0.85rem;
  flex-shrink: 0;
}

.sm-song-picker-footer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
}


/* Standard Buttons */
.sm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 0.8rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.sm-btn-secondary {
  background: var(--bg-tertiary, #21262d);
  border-color: var(--border, #30363d);
  color: var(--fg-secondary, #8b949e);
}

.sm-btn-secondary:hover {
  background: var(--bg-hover, #30363d);
  color: var(--fg-primary, #c9d1d9);
}

.sm-pitch-debug-btn svg {
  width: 0.8rem;
  height: 0.8rem;
}

.sm-btn-primary {
  background: var(--accent, #58a6ff);
  color: #fff;
}

.sm-btn-primary:hover:not(:disabled) {
  background: var(--accent-hover, #79c0ff);
}

.sm-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Pitch Analysis Panel (Debug Modal) */
.sm-pitch-analysis-panel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg-tertiary, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.5rem;
  padding: 1.25rem;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sm-pitch-analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border, #30363d);
  padding-bottom: 0.75rem;
}

.sm-pitch-analysis-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--fg-primary, #c9d1d9);
}

.sm-pitch-analysis-body {
  display: flex;
  flex-direction: column;
}

.sm-pitch-analysis-controls {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.sm-pitch-analysis-controls label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: var(--fg-primary, #c9d1d9);
  font-size: 0.85rem;
  font-weight: 500;
}

.sm-pitch-analysis-controls select {
  background: var(--bg-primary, #0d1117);
  border: 1px solid var(--border, #30363d);
  color: var(--fg-primary, #c9d1d9);
  border-radius: 0.25rem;
  padding: 0.4rem;
  outline: none;
}

.sm-pitch-analysis-info {
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--fg-muted, #8b949e);
  margin-top: 1rem;
}

`
