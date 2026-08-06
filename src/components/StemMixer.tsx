// ============================================================
// StemMixer — Play separated stems with volume control & pitch viz
// ============================================================

import type { Accessor, Component } from 'solid-js'
import { batch, createEffect, createMemo, createResource, createSignal, on, onCleanup, onMount, Show, } from 'solid-js'
import { getStemBlobUrl, listStemTypes } from '@/db/services/uvr-service'
import { PremiumBackgroundPicker } from '@/features/backgrounds/PremiumBackgroundPicker'
import { DEMO_SESSION_ID } from '@/features/karaoke-night/demo-song'
import { KARAOKE_STAGE_ALPHA, loadKaraokeStageAlpha, persistKaraokeStageAlpha, } from '@/features/karaoke-night/stage-transparency'
import { useMicInsights } from '@/features/mic-feedback/useMicInsights'
import { createMelodySynth } from '@/features/stem-mixer/melody-synth'
import { clampOverviewWindow } from '@/features/stem-mixer/overview-mapping'
import type { PlayAlongPreset, PlayAlongStemKey, } from '@/features/stem-mixer/play-along'
import { setStemVolume, stemMixHasSolo, stemTrackOutputLevel, toggleStemMute, toggleStemSolo, } from '@/features/stem-mixer/stem-mix-state'
import { useStemMixerAudioController } from '@/features/stem-mixer/useStemMixerAudioController'
import { useStemMixerCanvasController } from '@/features/stem-mixer/useStemMixerCanvasController'
import { useStemMixerLayoutController } from '@/features/stem-mixer/useStemMixerLayoutController'
import { useStemMixerLyricsController } from '@/features/stem-mixer/useStemMixerLyricsController'
import { useStemMixerMicController } from '@/features/stem-mixer/useStemMixerMicController'
import { useStemMixerPitchAnalysisController } from '@/features/stem-mixer/useStemMixerPitchAnalysisController'
import { autoAdvanceTarget, nextSessionId, orderedLibrarySessions, playlistEndAction, prevSessionId, } from '@/features/stem-mixer/zen-navigation'
import { useBackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { PREMIUM_FEATURES } from '@/lib/defaults'
import { extractTitle } from '@/lib/lyrics-service'
import { rmsOfAnalyser } from '@/lib/mic-level'
import { micManager } from '@/lib/mic-manager'
import type { ComparisonPoint, MicScore } from '@/lib/mic-scoring'
import type { MidiNoteEvent } from '@/lib/midi-generator'
import type { MergedNote, PitchDetection } from '@/lib/midi-generator'
import { mergeConsecutiveNotes } from '@/lib/midi-generator'
import type { AlignmentResult } from '@/lib/pitch-word-alignment'
import { freqToMidi } from '@/lib/scale-data'
import { createPersistedSignal } from '@/lib/storage'
import { computeAlignment, formatAlignmentDebugLog, logAlignmentComparison, selectAlignmentSegments, } from '@/lib/transcription-alignment-utils'
import { useConfirm } from '@/lib/use-confirm'
import { isNarrow } from '@/lib/use-viewport'
import { useWhisperTranscription } from '@/lib/useWhisperTranscription'
import type { StemSplitPart } from '@/lib/uvr-stem-split'
import { activeStemSplits, PART_STEM_DISPLAY } from '@/lib/uvr-stem-split'
import { detectVocalOnsets } from '@/lib/vocal-onsets'
import { sliderToGain } from '@/lib/volume-curve'
import * as playlist from '@/stores/karaoke-playlist-store'
import { showNotification } from '@/stores/notifications-store'
import { karaokeFocus, karaokeZen, setKaraokeFocus, setKaraokeZen, } from '@/stores/ui-store'
import { recordActivity } from '@/stores/usage-store'
import { getAllUvrSessionsReactive } from '@/stores/uvr-store'
import { ConfirmDialog } from './ConfirmDialog'
import { AlertTriangle, ChevronLeft, Maximize2, Minimize2, Music, Settings, Share, SkipBack, SkipForward, X, } from './icons'
import { KaraokeMobileStage } from './KaraokeMobileStage'
import { KaraokePlaylistOverlay } from './KaraokePlaylistOverlay'
import type { KaraokeLibrarySong } from './KaraokePlaylistSidebar'
import { KaraokePlaylistSidebar } from './KaraokePlaylistSidebar'
import { KaraokePlaylistSummary } from './KaraokePlaylistSummary'
import { StemMixerFixedWorkspace } from './StemMixerFixedWorkspace'
import { StemMixerGridWorkspace } from './StemMixerGridWorkspace'
import { StemMixerPerformanceWorkspace } from './StemMixerPerformanceWorkspace'
import { StemMixerPitchAnalysisPanel } from './StemMixerPitchAnalysisPanel'
import { StemMixerPitchStudio } from './StemMixerPitchStudio'
import { StemMixerScoreModal } from './StemMixerScoreModal'
import { StemMixerTransport } from './StemMixerTransport'

// ── Types ──────────────────────────────────────────────────────

/** A dynamic extra track for the mixer — an instrument part (drums, bass,
 *  guitar, …) selected on the results screen. Any combination is legal,
 *  including redundant ones (drums + the full instrumental). */
export interface ExtraStemInput {
  key: string
  label: string
  color: string
  url: string
}

interface StemMixerProps {
  stems: {
    vocal?: string
    instrumental?: string
    vocalMidi?: string
  }
  /** Extra tracks beyond vocal/instrumental/MIDI. Snapshotted at mount —
   *  the mixer is keyed-remounted per mix request. */
  extraStems?: readonly ExtraStemInput[]
  sessionId: string
  songTitle: string
  practiceMode?: 'vocal' | 'instrumental' | 'full' | 'midi'
  /** Which stems the user requested to see -- only these appear in tracks().
   *  Undefined = show all loaded stems (backwards-compat). */
  requestedStems?: { vocal?: boolean; instrumental?: boolean; midi?: boolean }
  /** Tracks that start silent for a role-based play-along mix. */
  initialMutedStems?: readonly PlayAlongStemKey[]
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
  /** Render the mixer's own stage picker/transparency controls. A host with
   *  page-level stage controls sets this false to avoid duplicate ownership. */
  showStageSettings?: boolean
  /** Guided-tour hook, injected by the studio app ('mount' = the one-time
   *  offer toast, 'button' = the header Tour button). Leaving it undefined
   *  removes the tour UI — and keeps the tour engine (app-store) out of
   *  standalone entry bundles. */
  onOfferTour?: (trigger: 'mount' | 'button') => void
  /** Fires once per mount after ~30s of cumulative playback — the Karaoke
   *  Night page uses it as the demo-engagement funnel milestone. */
  onThirtySecondsPlayed?: () => void
  /** Successful mic acquisition, after the capture graph is ready. */
  onMicGranted?: () => void
  /** First detector-validated live pitch produced during playback. */
  onValidMicPitch?: () => void
  /** A score materialized from genuine reference/mic comparison frames. */
  onScoreCreated?: (score: MicScore) => void
  /** A genuine score becoming visible in the score-card modal. */
  onScorecardViewed?: (score: MicScore) => void
  onBack?: () => void
  /** Zen mobile stage: stage another library session from the in-stage song
   *  sheet. Undefined hides the sheet (the studio has its own pickers). */
  onPickSession?: (sessionId: string) => void
  /** Launch a library song with one performer role muted. */
  onPlayAlong?: (sessionId: string, preset: PlayAlongPreset) => void
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
  const background = useBackgroundSurfaceController('karaoke')

  // ── State ────────────────────────────────────────────────────
  const [stageAlpha, setStageAlpha] = createSignal(loadKaraokeStageAlpha())
  const [midiNotes, setMidiNotes] = createSignal<MidiNoteEvent[]>([])
  const [shareToast, setShareToast] = createSignal('')

  const updateStageAlpha = (value: number) => {
    setStageAlpha(persistKaraokeStageAlpha(value))
  }

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
    muted:
      props.karaokeReferenceVocal === true ||
      props.initialMutedStems?.includes('vocal') === true,
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
    muted: props.initialMutedStems?.includes('instrumental') === true,
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
    muted: props.initialMutedStems?.includes('vocal') === true,
    soloed: false,
    volume: 0.8,
  })
  const [midi, setMidi] = createSignal<StemTrack>(midiTrack())

  // Extra tracks (instrument parts). Mount-time snapshot, like the named
  // tracks above — the mixer remounts (keyed) for every mix request.
  const extraTracks = (): StemTrack[] =>
    (props.extraStems ?? []).map((e) => ({
      label: e.label,
      url: e.url,
      color: e.color,
      buffer: null,
      gainNode: null,
      analyserNode: null,
      sourceNode: null,
      muted: props.initialMutedStems?.some((key) => key === e.key) === true,
      soloed: false,
      volume: 0.8,
    }))
  const [extras, setExtras] = createSignal<StemTrack[]>(extraTracks())

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
    // Extras are not gated by requestedStems — being passed in IS the
    // request.
    t.push(...extras())
    return t.filter((tr) => !!(tr.url || tr.buffer))
  }

  const anySoloed = createMemo(() => stemMixHasSolo(tracks()))

  // Mutable holders for audio ctx — backfilled after audio controller is created.
  // Mic controller accesses these dynamically, resolving the circular dependency.
  const audioCtxForMic = {
    getAudioCtx: (() => undefined) as () => AudioContext | null | undefined,
    ensureAudioCtx: (() => ({}) as AudioContext) as () => AudioContext,
  }

  // Styled confirm modal, shared by the destructive lyrics actions below
  // (paste-overwrite, auto word-sync) in place of native window.confirm.
  const confirm = useConfirm()

  // ── Mic / Scoring controller ─────────────────────────────────
  const mic = useStemMixerMicController({
    getAudioCtx: () => audioCtxForMic.getAudioCtx(),
    ensureAudioCtx: () => audioCtxForMic.ensureAudioCtx(),
  })
  let micGrantedReported = false
  createEffect(
    on(mic.micActive, (active) => {
      if (!active || micGrantedReported) return
      micGrantedReported = true
      props.onMicGranted?.()
    }),
  )

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
  let lyricsMappingActiveForAudio = false

  // ── Audio controller ─────────────────────────────────────────
  const audio = useStemMixerAudioController({
    vocal,
    setVocal,
    instrumental,
    setInstrumental,
    midi,
    setMidi,
    extras,
    setExtras,
    tracks,
    anySoloed,
    PITCH_WINDOW_FILL_RATIO,
    midiNotes,
    setMidiNotes,
    canvas: canvasForAudio,
    updateCurrentLine: () => updateCurrentLineForAudio(),
    setCurrentLineIdx: setCurrentLineIdxForAudio,
    setUserScrolled: setUserScrolledForAudio,
    lyricsMappingActive: () => lyricsMappingActiveForAudio,
    micActive: mic.micActive,
    getMicAnalyserNode: mic.getMicAnalyserNode,
    getMicPitchDetector: mic.getMicPitchDetector,
    getMicPitchHistory: mic.getMicPitchHistory,
    setMicPitch: mic.setMicPitch,
    comparisonData: mic.comparisonData,
    pushComparison: mic.pushComparison,
    markLoopIteration: mic.markLoopIteration,
    clearComparisonData: mic.clearComparisonData,
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
    onPlaybackEnded: () => handleSongEnded(),
    onValidMicPitch: () => props.onValidMicPitch?.(),
    onScoreCreated: (score) => props.onScoreCreated?.(score),
    showNotification,
  })

  // Backfill audio ctx holders for mic controller
  audioCtxForMic.getAudioCtx = () => audio.getAudioCtx()
  audioCtxForMic.ensureAudioCtx = () => audio.ensureAudioCtx()

  // Singing along to a song with the mic on is a scored run: the comparison
  // engine is accumulating against the reference the whole time.
  onCleanup(
    micManager.registerRunGuard(
      'karaoke-take',
      () => mic.micActive() && audio.playing(),
    ),
  )

  // Mic feedback: "can't hear you" / "too quiet" while a song plays.
  const micInsights = useMicInsights({
    micActive: mic.micActive,
    isPlaying: audio.playing,
    getLevel: () => rmsOfAnalyser(mic.getMicAnalyserNode()),
    getMinAmplitude: () =>
      mic.getMicPitchDetector()?.getSettings().minAmplitude ?? 0.02,
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
  // Mount lazily on first use, then retain the drawer so closing/reopening it
  // keeps the per-song stem inventories and editor state already loaded.
  // Destroying it on every close re-ran every IndexedDB role query.
  const [playlistSidebarMounted, setPlaylistSidebarMounted] = createSignal(
    playlistSidebarOpen(),
  )
  // Zen-mode autoplay: when on, the next library song plays automatically at
  // end-of-song. Playlists run their own advance flow (scoring/summary), so
  // this governs free-library listening. Persisted as a per-user preference.
  const [autoplayEnabled, setAutoplayEnabled] = createPersistedSignal(
    'sm-zen-autoplay',
    false,
  )
  // True between a natural song end and the score modal being dismissed, so we
  // advance the playlist only after the user has seen their score.
  let pendingAdvance = false
  let playStarted = false

  // `preset` is fixed for the lifetime of a StemMixer instance (the studio
  // mounts without it; the karaoke page remounts per song via a keyed <Show>),
  // and the controller options derived from it below are init-time-only by
  // design — they seed initial signal values and storage keys that the
  // controllers read exactly once. So this is an intentional static read, not
  // a missed reactive dependency. JSX/effect uses keep reading props.preset.
  // eslint-disable-next-line solid/reactivity
  const isPerformancePreset = props.preset === 'performance'

  // Phone-width viewports get the zen Apple-Music-style stage instead of the
  // desktop mixer — same controllers, different presentation. Width-based
  // (isNarrow, not isMobile) so touch laptops and wide tablets keep the full
  // mixer. Reactive, so a rotation or resize swaps the presentation without
  // losing playback (the audio engine lives in setup, not in either JSX tree).
  // Applies to EVERY preset now (mobile-native Phase 4): the in-app Karaoke
  // tab gets the same zen stage on phones as the standalone karaoke-night
  // page — the studio mixer is a desktop surface (decision D4).
  // karaokeZen() is the desktop opt-in — a wide-screen user can choose the
  // same clean lyrics stage the phone gets automatically.
  const zenStage = () => isNarrow() || karaokeZen()

  // The zen stage's Back: on a desktop-initiated zen it returns to the mixer
  // (keeping the song staged); otherwise it's the normal page-level back.
  const handleZenBack = (): void => {
    if (karaokeZen() && !isNarrow()) {
      setKaraokeZen(false)
    } else {
      props.onBack?.()
    }
  }

  // True when this StemMixer instance is the playlist's current song (guards
  // the brief window where a new song is loading and a stale instance lingers).
  const isCurrentPlaylistSong = () =>
    playlist.isPlaylistActive() &&
    playlist.currentSong()?.sessionId === props.sessionId

  /** Called by the audio controller when the track ends naturally. */
  const handlePlaylistSongEnded = () => {
    if (!isCurrentPlaylistSong() || playlist.phase() !== 'playing') return
    const action = playlistEndAction(
      zenStage(),
      mic.micActive(),
      mic.comparisonData().length,
    )
    if (action === 'defer-to-score-modal') {
      // Desktop mixer: handleStop() will show the score modal — advance when
      // it closes.
      pendingAdvance = true
    } else {
      // The zen stage mounts no score modal, so score (comparison data is
      // still intact — handleStop() clears it after this callback) and
      // advance right away; the result surfaces on the next song's overlay
      // and the summary instead.
      playlist.reportSongScore(
        action === 'advance-with-score' ? mic.computeScore() : null,
      )
      playlist.advance()
    }
  }

  // Safety net: an advance must never wait on a score modal that is not
  // mounted. If the zen stage is up (it renders no StemMixerScoreModal) while
  // the end-of-song score signal is showing — e.g. zen was toggled while the
  // modal was open — consume it here exactly like the modal's close would.
  createEffect(() => {
    if (!zenStage() || !mic.showScore()) return
    mic.setShowScore(false)
    if (playlist.isPlaylistActive() && pendingAdvance) {
      pendingAdvance = false
      playlist.reportSongScore(mic.score())
      playlist.advance()
    }
  })

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

  // ── Zen transport: unified song navigation ───────────────────
  // The zen stage's back/next controls span whichever context is active: an
  // in-progress playlist/group (playlist store), or free browsing of the whole
  // library (step by createdAt order via onPickSession). Ordering matches the
  // zen song sheet so the controls track the visible list. Nav decisions are
  // the pure helpers in zen-navigation.ts (unit-tested).
  const orderedLibrary = () =>
    orderedLibrarySessions(getAllUvrSessionsReactive(), DEMO_SESSION_ID)
  const orderedLibraryIds = (): string[] =>
    orderedLibrary().map((session) => session.sessionId)
  const libraryDrawerSongs = (): KaraokeLibrarySong[] =>
    orderedLibrary().map((session) => ({
      sessionId: session.sessionId,
      title: extractTitle(session.originalFile?.name ?? session.sessionId),
      availableStems: [
        ...(session.outputs?.vocal !== undefined ||
        session.stemMeta?.vocal !== undefined
          ? (['vocal'] as const)
          : []),
        ...(session.outputs?.instrumental !== undefined ||
        session.stemMeta?.instrumental !== undefined
          ? (['instrumental'] as const)
          : []),
      ],
    }))
  const canLibraryNav = (): boolean => props.onPickSession !== undefined

  const hasPrevItem = (): boolean =>
    playlist.isPlaylistActive()
      ? playlist.currentIndex() > 0
      : canLibraryNav() &&
        prevSessionId(orderedLibraryIds(), props.sessionId) !== null

  const hasNextItem = (): boolean =>
    playlist.isPlaylistActive()
      ? playlist.nextSong() !== null
      : canLibraryNav() &&
        nextSessionId(orderedLibraryIds(), props.sessionId) !== null

  const goPrevItem = (): void => {
    if (playlist.isPlaylistActive()) {
      handlePlaylistPrev()
      return
    }
    const id = prevSessionId(orderedLibraryIds(), props.sessionId)
    if (id !== null) props.onPickSession?.(id)
  }

  const goNextItem = (): void => {
    if (playlist.isPlaylistActive()) {
      handlePlaylistNext()
      return
    }
    const id = nextSessionId(orderedLibraryIds(), props.sessionId)
    if (id !== null) props.onPickSession?.(id)
  }

  // End-of-song: a running playlist advances through its own flow (scoring,
  // summary); free-library listening auto-advances only when autoplay is on.
  const handleSongEnded = (): void => {
    if (playlist.isPlaylistActive()) {
      handlePlaylistSongEnded()
      return
    }
    const target = autoAdvanceTarget(
      autoplayEnabled(),
      orderedLibraryIds(),
      props.sessionId,
    )
    if (target !== null) props.onPickSession?.(target)
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
      // This singer's preferred backing-vocal level, saved on the playlist
      // entry — applied before play so the sources start at the right gain.
      const vocalPref = playlist.currentSong()?.vocalVolume
      if (vocalPref !== undefined) setTrackVolume('Vocal', vocalPref)
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

  // Engagement milestone: ~30s of cumulative listening (wall-clock while
  // playing, so seeking around can't fake it). Effect-scoped so the prop is
  // read reactively; the interval only exists while a consumer provides the
  // callback and disappears with it (or on unmount).
  createEffect(() => {
    if (props.onThirtySecondsPlayed === undefined) return
    let playedSeconds = 0
    const engagementTimer = setInterval(() => {
      if (!audio.playing()) return
      playedSeconds += 1
      if (playedSeconds >= 30) {
        clearInterval(engagementTimer)
        props.onThirtySecondsPlayed?.()
      }
    }, 1000)
    onCleanup(() => clearInterval(engagementTimer))
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
    lrcGenInputMode,
    setLrcGenInputMode,
    lrcGenPass,
    setLrcGenPass,
    wordPassProgress,
    previewLineIdx,
    liveHighlight,
    setLiveHighlight,
    highlightWord,
    toggleLinePreview,
    setPreviewLoop,
    lrcTimingOffsetMs,
    setLrcTimingOffsetMs,
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
    wordTimings,

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

    // Actions — lyrics text editing + "From vocal" generation
    textEditMode,
    beginTextEdit,
    cancelTextEdit,
    applyTextEdit,
    importWhisperLyrics,

    // Actions — LRC gen
    startLrcGen,
    handleNextLine,
    handleNextWord,
    handleMarkerSample,
    handleRedoCurrentLine,
    handleLrcGenFinish,
    applyAutoWordSync,
    handleLrcGenReset,
    handleDownloadLrc,
    getGenLines,

    // Lyric versions
    lyricsVersions,
    activeVersionKind,
    switchVersion,
    deleteVersion,
    clearLyrics,

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
    elapsed: audio.audibleElapsed,
    // Lets the lyric display end lines when the vocal actually stops.
    // Lazy closure: pitchAnalysis is initialized after this controller,
    // and the accessor is only invoked from memos once setup completes.
    melodyNotes: () => pitchAnalysis.editableNotes(),
    seekToWithWindow: (t: number) => {
      audio.seekTo(t)
      audio.setWindowStart(Math.max(0, t - audio.windowDuration() * 0.3))
    },
    // The standalone karaoke stage reads from across the room: big centered
    // lyrics by default, with page-local alignment prefs.
    ...(isPerformancePreset
      ? {
          defaultFontSize: 2.4,
          defaultAlign: 'center' as const,
          alignPrefsKey: 'pitchperfect_kn_lyrics_align',
        }
      : {}),
  })

  createEffect(() => {
    lyricsMappingActiveForAudio = lrcGenMode()
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

  // Set an A or B loop point at an explicit time, keeping A < B (swaps when a
  // point lands on the wrong side — the "renumerate" behaviour). Shared by the
  // transport A/B buttons (playhead time) and the waveform right-click menu
  // (clicked time). Setting B enables the loop; setting A alone just marks the
  // start (drawn immediately by the canvas overlay).
  const applyLoopPoint = (which: 'A' | 'B', time: number) => {
    const t = Math.max(0, time)
    if (which === 'A') {
      const currentB = audio.loopEnd()
      if (currentB > 0 && t > currentB) {
        audio.setLoopEnd(t)
        audio.setLoopStart(currentB)
      } else {
        audio.setLoopStart(t)
      }
    } else {
      const currentA = audio.loopStart()
      if (t < currentA) {
        audio.setLoopStart(t)
        audio.setLoopEnd(currentA)
      } else {
        audio.setLoopEnd(t)
      }
      audio.setLoopEnabled(true)
    }
    canvas.queueCanvasRedraw()
  }

  // Waveform/pitch-canvas right-click → a small loop menu at the clicked time
  // (mirrors the lyric-line right-click). The native context menu offered
  // nothing useful here.
  const [loopMenu, setLoopMenu] = createSignal<{
    x: number
    y: number
    time: number
  } | null>(null)
  const openLoopMenu = (e: MouseEvent) => {
    e.preventDefault()
    const targetCanvas = e.currentTarget as HTMLCanvasElement | null
    if (!targetCanvas) return
    const time = Math.max(
      0,
      Math.min(
        audio.duration(),
        canvas.timelineTimeAtClientX(e.clientX, targetCanvas),
      ),
    )
    setLoopMenu({ x: e.clientX, y: e.clientY, time })
  }
  const clearLoopFromMenu = () => {
    audio.clearLoop()
    setLoopStartLyricIdx(null)
    setLoopEndLyricIdx(null)
    canvas.queueCanvasRedraw()
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

  const closePitchTools = (): void => {
    pitchAnalysis.setPanelOpen(false)
    pitchAnalysis.setEditMode(false)
    pitchAnalysis.setSelectedNoteId(null)
  }

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
  // Plot the user's live mic pitch as a continuous violet line over the
  // orange vocal reference, and label the user's violet note layer.
  const [showMicLine, setShowMicLine] = createPersistedSignal<boolean>(
    'pitchperfect_show_mic_line',
    false,
  )
  const [showUserNoteLabels, setShowUserNoteLabels] =
    createPersistedSignal<boolean>('pitchperfect_show_user_note_labels', false)
  // Scoring diff bars (vertical sung-vs-reference connectors) are a debug
  // visual — noisy while actually singing, so off by default.
  const [showScoreDiffBars, setShowScoreDiffBars] =
    createPersistedSignal<boolean>('pitchperfect_show_score_diff_bars', false)

  const whisper = useWhisperTranscription({
    getAudioBuffer: () => vocal().buffer,
    logTag: 'StemMixer',
    // eslint-disable-next-line solid/reactivity
    sessionId: props.sessionId,
    // Song identity in every transcription log line (owner request).
    get label() {
      return props.songTitle
    },
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
    performance: {
      start: audio.startPerformanceDebug,
      stop: audio.stopPerformanceDebug,
      snapshot: audio.getPerformanceSnapshot,
      help: 'Call start() before playback to log RAF, analysis, and canvas timings every 2 seconds; call stop() for the final sample.',
    },
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

    // Word-window source priority: word-timed LRC (user taps / enhanced LRC)
    // beats whisper. Whisper beats line-only LRC provided Whisper match quality
    // is acceptable (>= 0.25); otherwise line-only LRC is preferred.
    const lrc = canonicalLrcLines()
    const { segments, wordSource } = selectAlignmentSegments(wsSegs, lrc)

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
      `[StemMixer] Alignment using ${noteSource} notes x ${wordSource} words (${merged.length} notes, ${segments.length} word segments)`,
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
    showScoreDiffBars,
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

  const exitPitchStudio = (): void => {
    pitchAnalysis.setEditMode(false)
    pitchAnalysis.setSelectedNoteId(null)
    canvas.queueCanvasRedraw()
  }

  const enterPitchStudio = (): void => {
    setShowPitch(true)
    pitchAnalysis.setSelectedNoteId(null)
    pitchAnalysis.setEditMode(true)
    canvas.queueCanvasRedraw()
  }

  const selectedPitchNote = () => {
    const selectedId = pitchAnalysis.selectedNoteId()
    if (selectedId === null) return null
    return (
      pitchAnalysis.editableNotes().find((note) => note.id === selectedId) ??
      null
    )
  }

  const nudgeSelectedPitch = (semitones: number): void => {
    const note = selectedPitchNote()
    if (note === null) return
    const midi = Math.max(0, Math.min(127, note.midi + semitones))
    if (midi === note.midi) return

    pitchAnalysis.beginEdit()
    pitchAnalysis.previewEdit(note, {
      midi,
    })
    pitchAnalysis.endEdit()
    canvas.queueCanvasRedraw()
  }

  const setPitchStudioWindow = (nextDuration: number): void => {
    const songDuration = audio.duration()
    if (songDuration <= 0) return
    const center = audio.windowStart() + audio.windowDuration() / 2
    const next = clampOverviewWindow(
      center - nextDuration / 2,
      nextDuration,
      songDuration,
    )
    audio.setWindowDuration(next.duration)
    audio.setWindowStart(next.start)
    canvas.queueCanvasRedraw()
  }

  const fitPitchStudio = (): void => {
    const songDuration = audio.duration()
    if (songDuration <= 0) return
    audio.setWindowStart(0)
    audio.setWindowDuration(songDuration)
    canvas.queueCanvasRedraw()
  }

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
    ...(isPerformancePreset
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
    // Proportional step, clamped to the SONG — the old fixed 5s step
    // inside a hardcoded 10..150s range meant an 18-minute song snapped
    // to 150s on the first wheel tick and the window could overhang the
    // ending, which desynced the overview from the playhead.
    const prev = audio.windowDuration()
    const step = Math.max(5, prev * 0.12)
    const next = clampOverviewWindow(
      audio.windowStart(),
      prev + (e.deltaY > 0 ? step : -step),
      audio.duration(),
    )
    audio.setWindowDuration(next.duration)
    audio.setWindowStart(next.start)
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
    textEditMode,
    onTextEditSave: applyTextEdit,
    onTextEditCancel: cancelTextEdit,
    lrcGenMode,
    lrcGenLineIdx,
    lrcGenWordIdx,
    lrcGenInputMode,
    setLrcGenInputMode,
    lrcGenPass,
    setLrcGenPass,
    wordPassProgress,
    previewLineIdx,
    liveHighlight,
    setLiveHighlight,
    highlightWord,
    toggleLinePreview,
    setPreviewLoop,
    lrcTimingOffsetMs,
    setLrcTimingOffsetMs,
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
    handleMarkerSample,
    handleRedoCurrentLine,
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
    elapsed: audio.audibleElapsed,
    handleSeekToTime: (t: number) => audio.seekTo(t),
    playbackSpeed: audio.speed,
    setPlaybackSpeed: audio.setSpeed,
    handlePlay: audio.handlePlay,
    handlePause: audio.handlePause,
    formatTime: canvas.formatTime,
    // eslint-disable-next-line solid/reactivity
    songTitle: props.songTitle,
    lrclibSearchUrl,
    triggerChangeFile: () => lyricsFileInputRef?.click(),
    handleRemoveLyrics: () => {
      confirm.request({
        title: 'Remove lyrics?',
        message:
          'This deletes the lyrics and word timings for this song and returns to the "no lyrics" screen. This cannot be undone.',
        confirmLabel: 'Remove',
        confirmIcon: <AlertTriangle />,
        onConfirm: () => clearLyrics(),
      })
    },
    handlePasteLyricsHeader: () => {
      void (async () => {
        try {
          const text = await navigator.clipboard.readText()
          if (!text || text.trim().length === 0) return
          confirm.request({
            title: 'Overwrite lyrics?',
            message:
              'This replaces the current lyrics and word timings with the clipboard content. This cannot be undone.',
            confirmLabel: 'Overwrite',
            confirmIcon: <AlertTriangle />,
            onConfirm: () => {
              const isLrc = /^\[\d{1,3}:\d{2}/.test(text.trim())
              const baseName = props.songTitle
                ? props.songTitle.replace(/[^a-zA-Z0-9_-]/g, '_')
                : 'clipboard'
              handleLyricsUpload({
                text,
                format: isLrc ? 'lrc' : 'txt',
                filename: `${baseName}.${isLrc ? 'lrc' : 'txt'}`,
              })
            },
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

  // ── Auto word-sync ───────────────────────────────────────────
  // One click: detect onsets on the separated vocal stem and time every
  // lyric word automatically (docs/plans/lyrics-word-sync.md).
  const autoSyncWords = () => {
    const buf = vocal().buffer
    if (!buf) {
      showNotification(
        'Wait for the song to finish loading, then try again',
        'warning',
      )
      return
    }
    const runSync = () => {
      const { linesSynced } = applyAutoWordSync(detectVocalOnsets(buf))
      if (linesSynced > 0) {
        showNotification(
          `Word sync drafted for ${linesSynced} lines — words now light up as they're sung`,
          'success',
        )
      } else {
        showNotification(
          'Auto word-sync needs line-timed lyrics — load an LRC or run LRC Gen first',
          'warning',
        )
      }
    }
    // Same data-loss guard as the lyrics paste path: existing word timings
    // (possibly hand-tapped) are replaced wholesale and there is no undo.
    if (Object.keys(wordTimings()).length > 0) {
      confirm.request({
        title: 'Replace word timings?',
        message:
          'Auto word-sync will replace the existing word timings for this song — including any you tapped by hand. This cannot be undone.',
        confirmLabel: 'Replace',
        confirmIcon: <AlertTriangle />,
        onConfirm: runSync,
      })
      return
    }
    runSync()
  }

  // ── Volume / Mute / Solo ─────────────────────────────────────
  // One label-keyed updater covers the named tracks AND the dynamic extras
  // (labels are unique: Vocal/Instrumental/MIDI vs Drums/Bass/Guitar/…).
  const setTrackByLabel = (
    label: string,
    update: (prev: StemTrack) => StemTrack,
  ) => {
    if (label === 'Vocal') setVocal(update)
    else if (label === 'Instrumental') setInstrumental(update)
    else if (label === 'MIDI') setMidi(update)
    else
      setExtras((list) => list.map((t) => (t.label === label ? update(t) : t)))
  }

  /** Commit one coherent mixer snapshot to both Solid state and Web Audio.
   *  Every control uses this path so mute, solo, and faders cannot disagree
   *  about which tracks should reach the master bus. */
  const commitStemMix = (nextTracks: readonly StemTrack[]) => {
    const hasSolo = stemMixHasSolo(nextTracks)
    batch(() => {
      for (const next of nextTracks) {
        if (next.gainNode) {
          next.gainNode.gain.value = sliderToGain(
            stemTrackOutputLevel(next, hasSolo),
          )
        }
        setTrackByLabel(next.label, (prev) => ({
          ...prev,
          muted: next.muted,
          soloed: next.soloed,
          volume: next.volume,
        }))
      }
    })
  }

  const setTrackVolume = (label: string, volume: number) => {
    commitStemMix(setStemVolume(tracks(), label, volume))
  }

  const toggleMute = (label: string) => {
    commitStemMix(toggleStemMute(tracks(), label))
  }

  const toggleSolo = (label: string) => {
    commitStemMix(toggleStemSolo(tracks(), label))
  }

  // ── Stem controls props bundle ─────────────────────────────────
  // ── Add-stem pills ───────────────────────────────────────────
  // Session part stems on this device but not yet in the mix. stemMeta
  // is stored metadata (no blob loads); the karaoke page especially
  // needs this — it stages vocal+instrumental with no stem-results view
  // to go back to.
  const [addingStem, setAddingStem] = createSignal<string | null>(null)
  // Part stems come from the stem BLOB table, not the session's
  // stemMeta: a full-band split writes its drums/bass/guitar/piano
  // blobs and never touches stemMeta (which describes the original
  // separation only), so the metadata read always returned nothing and
  // the pills never appeared. Metadata-only query, refreshed when a
  // background split lands.
  const [deviceStems, { refetch: refetchDeviceStems }] = createResource(
    () => props.sessionId,
    listStemTypes,
  )
  createEffect(() => {
    // A full-band split finishing mid-session adds parts under us.
    activeStemSplits()
    void refetchDeviceStems()
  })

  const addableStems = (): Array<{
    key: string
    label: string
    color: string
  }> => {
    const inMix = new Set(tracks().map((t) => t.label))
    return (deviceStems() ?? [])
      .filter((k): k is StemSplitPart => k in PART_STEM_DISPLAY)
      .filter((k) => !inMix.has(PART_STEM_DISPLAY[k].label))
      .map((k) => ({
        key: k,
        label: PART_STEM_DISPLAY[k].label,
        color: PART_STEM_DISPLAY[k].color,
      }))
  }

  const handleAddStem = async (key: string): Promise<void> => {
    if (addingStem() !== null) return
    setAddingStem(key)
    try {
      const part = key as StemSplitPart
      const url = await getStemBlobUrl(props.sessionId, part)
      if (url === null) {
        showNotification(
          "That stem isn't on this device anymore — run the full-band split again to bring it back.",
          'warning',
        )
        return
      }
      const ok = await audio.addExtraStem({
        label: PART_STEM_DISPLAY[part].label,
        color: PART_STEM_DISPLAY[part].color,
        url,
      })
      if (!ok) {
        showNotification("Couldn't load that stem — try again.", 'error')
      }
    } finally {
      setAddingStem(null)
    }
  }

  const stemControls = {
    vocal,
    midi,
    instrumental,
    extras,
    anySoloed,
    toggleSolo,
    toggleMute,
    setTrackVolume,
    handleDownload: audio.handleDownload,
    addableStems,
    onAddStem: (key: string) => void handleAddStem(key),
    addingStem,
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
    if (!isPerformancePreset) whisper.initWhisper()

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

      if (lrcGenMode() && lrcGenInputMode() === 'tap') {
        if (e.key === 'w' || e.key === 'W') {
          e.preventDefault()
          handleNextWord()
          return
        }
        if (e.key === 'l' || e.key === 'L') {
          e.preventDefault()
          handleNextLine()
          return
        }
      }

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

  // Zen mic toggle: same engine the playlist scoring uses; surface a
  // denied/unavailable mic as a notification since the zen stage has no
  // inline error slot.
  const toggleZenMic = () => {
    void mic.toggleMic().then(() => {
      const err = mic.micError()
      if (err !== '') showNotification(err, 'error')
    })
  }

  // Zen note glyphs asked for notes with no analysis present — run the
  // denoised pipeline once; the alignment (and the glyphs) follow reactively.
  const ensureZenNotes = () => {
    const hasNotes =
      pitchAnalysis.offlineSegmentedNotes().length > 0 ||
      pitchAnalysis.offlineMergedNotes().length > 0
    if (!hasNotes && !pitchAnalysis.isAnalyzing()) {
      void pitchAnalysis.runAnalysis()
    }
  }

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

  // ── "From vocal" lyrics generation ─────────────────────────────
  // Turn the Whisper transcription into a synced lyric draft (the 'whisper'
  // version) and drop straight into the text editor for cleanup. Reuses a
  // cached transcription when one exists; otherwise runs the full
  // pitch-analysis-then-whisper pipeline and imports once it lands.
  const [pendingWhisperLyrics, setPendingWhisperLyrics] = createSignal(false)

  const importFromSegmentsIfReady = (): boolean => {
    const segs = whisper.segments()
    if (whisper.status() !== 'done' || segs.length === 0) return false
    const ok = importWhisperLyrics(segs)
    if (!ok) {
      showNotification(
        'No recognizable words in the vocal to build lyrics from.',
        'warning',
      )
    }
    return true
  }

  const generateLyricsFromVocal = () => {
    if (importFromSegmentsIfReady()) return
    setPendingWhisperLyrics(true)
    // Ensures pitch analysis first, then whisper (cache-aware).
    startWhisperTranscription()
  }

  createEffect(
    on(whisper.status, (s) => {
      if (!pendingWhisperLyrics()) return
      if (s === 'done') {
        setPendingWhisperLyrics(false)
        importFromSegmentsIfReady()
      } else if (s === 'error') {
        setPendingWhisperLyrics(false)
        showNotification('Could not transcribe the vocal.', 'error')
      }
    }),
  )

  const generatingFromVocal = () =>
    pendingWhisperLyrics() &&
    (whisper.status() === 'processing' ||
      whisper.status() === 'loading' ||
      pitchAnalysis.isAnalyzing())

  // Live phase label for the version menu while a From-vocal draft runs.
  const generatingLabel = () => {
    if (pitchAnalysis.isAnalyzing()) {
      return `Reading the vocal… ${Math.round(pitchAnalysis.progress())}%`
    }
    if (whisper.status() === 'loading') {
      const pct = Math.round(whisper.progress())
      return pct > 0
        ? `Fetching the listener… ${pct}%`
        : 'Fetching the listener…'
    }
    const secs = whisper.elapsed()
    return secs >= 0 ? `Transcribing… ${secs}s` : 'Transcribing…'
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
    <Show
      when={!zenStage()}
      fallback={
        <KaraokeMobileStage
          songTitle={props.songTitle}
          onBack={handleZenBack}
          playing={audio.playing}
          loading={audio.loading}
          loadError={audio.loadError}
          elapsed={audio.elapsed}
          lyricsElapsed={audio.audibleElapsed}
          duration={audio.duration}
          onPlay={audio.handlePlay}
          onPause={audio.handlePause}
          onSeekToStart={() => audio.seekTo(0)}
          seekTo={audio.seekTo}
          hasPrevItem={hasPrevItem}
          hasNextItem={hasNextItem}
          onPrevItem={goPrevItem}
          onNextItem={goNextItem}
          autoplayEnabled={autoplayEnabled}
          onToggleAutoplay={() => setAutoplayEnabled((v) => !v)}
          vocal={vocal}
          onToggleVocal={() => toggleMute('Vocal')}
          onVocalVolume={(v) => setTrackVolume('Vocal', v)}
          parsedLyrics={stableParsedLyrics}
          currentLineIdx={currentLineIdx}
          lyricsLoading={lyricsLoading}
          computeActiveWord={computeActiveWord}
          onLineClick={handleLyricLineClick}
          playlistOverlayActive={isCurrentPlaylistSong}
          onPlaylistStart={handlePlaylistStart}
          onPlaylistSkip={() => {
            audio.handlePause()
            playlist.advance()
          }}
          showStageSettings={props.showStageSettings !== false}
          onPickSession={props.onPickSession}
          onUploadLyrics={handleLyricsUpload}
          lyricsSuggestion={() => props.songTitle}
          lrclibSearchUrl={lrclibSearchUrl}
          songMatches={songMatches}
          songPickerQuery={songPickerQuery}
          onSongPickerQuery={setSongPickerQuery}
          onSongPickerRefine={() => void handleSongPickerRefine()}
          onSongPick={(m) => void handleSongPick(m)}
          alignedWords={() => alignmentResult().alignedWords}
          onEnsureNotes={ensureZenNotes}
          notesAnalyzing={pitchAnalysis.isAnalyzing}
          notesProgress={pitchAnalysis.progress}
          micActive={mic.micActive}
          onToggleMic={toggleZenMic}
          micPitch={mic.micPitch}
          ribbonNotes={pitchAnalysis.editableNotes}
        />
      }
    >
      <div
        class="stem-mixer"
        style={{
          ...background.resolvedStyle(),
          '--sm-stage-alpha':
            props.preset === 'performance'
              ? `var(--kn-alpha, ${KARAOKE_STAGE_ALPHA.defaultValue})`
              : String(stageAlpha()),
        }}
        classList={{
          'stem-mixer--focus': karaokeFocus(),
          'stem-mixer--mapping': lrcGenMode(),
          'stem-mixer--pitch-studio':
            props.preset !== 'performance' && pitchAnalysis.editMode(),
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
              <Show when={props.showStageSettings !== false}>
                <Show when={props.preset !== 'performance'}>
                  <label class="sm-stage-glass" title="Stage transparency">
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2v16a8 8 0 0 1 0-16z"
                      />
                    </svg>
                    <input
                      type="range"
                      class="sm-stage-glass-slider"
                      min={KARAOKE_STAGE_ALPHA.min}
                      max={KARAOKE_STAGE_ALPHA.max}
                      step={KARAOKE_STAGE_ALPHA.step}
                      value={stageAlpha()}
                      aria-label="Stage transparency"
                      onInput={(event) =>
                        updateStageAlpha(Number(event.currentTarget.value))
                      }
                    />
                  </label>
                </Show>
                <PremiumBackgroundPicker
                  controller={background}
                  label="Stage"
                />
              </Show>
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
                type="button"
                class="sm-btn sm-btn-secondary"
                data-tour="mixer.playlist"
                classList={{ 'sm-btn--active': playlistSidebarOpen() }}
                onClick={() => {
                  const opening = !playlistSidebarOpen()
                  if (opening) {
                    closePitchTools()
                    setPlaylistSidebarMounted(true)
                  }
                  setPlaylistSidebarOpen(opening)
                }}
                title="Open songs and playlists"
                style={{ gap: '0.4rem' }}
              >
                <Music /> Songs
              </button>
              <button
                type="button"
                class="sm-btn sm-btn-secondary sm-pitch-debug-btn"
                classList={{ 'sm-btn--active': pitchAnalysis.panelOpen() }}
                onClick={() => {
                  const opening = !pitchAnalysis.panelOpen()
                  if (opening) {
                    setPlaylistSidebarOpen(false)
                    pitchAnalysis.setEditMode(false)
                    pitchAnalysis.setSelectedNoteId(null)
                  }
                  pitchAnalysis.setPanelOpen(opening)
                }}
                title="Pitch Analysis & Settings"
                style={{ gap: '0.4rem' }}
              >
                <Settings /> Pitch
              </button>
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
                onClick={() => setKaraokeZen(true)}
                title="Zen mode — the clean, lyrics-forward karaoke view (Back returns here)"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  aria-hidden="true"
                >
                  <path d="M4 7h16M4 12h16M4 17h9" />
                </svg>
                Zen
              </button>
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
            onToggleMicMonitor={() =>
              mic.setMicMonitor(!mic.micMonitorEnabled())
            }
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
            onSetLoopA={() => applyLoopPoint('A', audio.elapsed())}
            onSetLoopB={() => applyLoopPoint('B', audio.elapsed())}
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
              comparisonData={mic.iterationComparisonData}
              loopCount={audio.loopCount}
            />
          </Show>

          <StemMixerGridWorkspace
            onCanvasContextMenu={openLoopMenu}
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
            beginTextEdit={beginTextEdit}
            startLrcGen={startLrcGen}
            autoSyncWords={autoSyncWords}
            lyricsVersions={lyricsVersions}
            activeVersionKind={activeVersionKind}
            switchVersion={switchVersion}
            deleteVersion={deleteVersion}
            onGenerateFromVocal={generateLyricsFromVocal}
            generatingFromVocal={generatingFromVocal}
            generatingLabel={generatingLabel}
            handleDownloadLrc={handleDownloadLrc}
            lyricsFileInputRef={(el) => {
              lyricsFileInputRef = el
            }}
            handleLyricsChange={handleLyricsChange}
            triggerChangeFile={() => lyricsFileInputRef?.click()}
            handlePasteLyricsHeader={lyricsPanel.handlePasteLyricsHeader}
            handleRemoveLyrics={lyricsPanel.handleRemoveLyrics}
            showMidi={showMidi}
            showNoteLabels={showNoteLabels}
            setShowNoteLabels={setShowNoteLabels}
            showLyricLabels={showLyricLabels}
            setShowLyricLabels={setShowLyricLabels}
            showLyricNoteLabels={showLyricNoteLabels}
            setShowLyricNoteLabels={setShowLyricNoteLabels}
            showScoreDiffBars={showScoreDiffBars}
            setShowScoreDiffBars={setShowScoreDiffBars}
            showMicLine={showMicLine}
            setShowMicLine={setShowMicLine}
            showUserNoteLabels={showUserNoteLabels}
            setShowUserNoteLabels={setShowUserNoteLabels}
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
            onCanvasContextMenu={openLoopMenu}
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
            beginTextEdit={beginTextEdit}
            startLrcGen={startLrcGen}
            autoSyncWords={autoSyncWords}
            lyricsVersions={lyricsVersions}
            activeVersionKind={activeVersionKind}
            switchVersion={switchVersion}
            deleteVersion={deleteVersion}
            onGenerateFromVocal={generateLyricsFromVocal}
            generatingFromVocal={generatingFromVocal}
            generatingLabel={generatingLabel}
            handleDownloadLrc={handleDownloadLrc}
            lyricsFileInputRef={(el) => {
              lyricsFileInputRef = el
            }}
            handleLyricsChange={handleLyricsChange}
            triggerChangeFile={() => lyricsFileInputRef?.click()}
            handlePasteLyricsHeader={lyricsPanel.handlePasteLyricsHeader}
            handleRemoveLyrics={lyricsPanel.handleRemoveLyrics}
            showMidi={showMidi}
            showNoteLabels={showNoteLabels}
            setShowNoteLabels={setShowNoteLabels}
            showLyricLabels={showLyricLabels}
            setShowLyricLabels={setShowLyricLabels}
            showLyricNoteLabels={showLyricNoteLabels}
            setShowLyricNoteLabels={setShowLyricNoteLabels}
            showScoreDiffBars={showScoreDiffBars}
            setShowScoreDiffBars={setShowScoreDiffBars}
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
            handleRemoveLyrics={lyricsPanel.handleRemoveLyrics}
            showWaveform={showWaveform}
          />
        </Show>

        <StemMixerScoreModal
          showScore={mic.showScore}
          score={mic.score}
          onViewed={(score) => props.onScorecardViewed?.(score)}
          onClose={() => {
            mic.setShowScore(false)
            if (playlist.isPlaylistActive() && pendingAdvance) {
              pendingAdvance = false
              playlist.reportSongScore(mic.score())
              playlist.advance()
            }
          }}
        />

        {/* Pitch Studio elevates the existing canvas instead of mounting a
          second renderer, so audio, selection, persistence, and pointer
          editing continue to share one source of truth. */}
        <Show when={props.preset !== 'performance' && pitchAnalysis.editMode()}>
          <StemMixerPitchStudio
            songTitle={props.songTitle}
            elapsed={audio.elapsed()}
            duration={audio.duration()}
            playing={audio.playing()}
            noteCount={pitchAnalysis.editableNotes().length}
            selectedNote={selectedPitchNote()}
            pitchView={pitchAnalysis.pitchView()}
            setPitchView={pitchAnalysis.setPitchView}
            hasEdits={pitchAnalysis.hasEdits()}
            onDelete={() => pitchAnalysis.deleteSelectedNote()}
            onSplit={() => pitchAnalysis.splitSelectedNote()}
            onMerge={() => pitchAnalysis.mergeSelectedWithNext()}
            onUndo={() => pitchAnalysis.undoEdit()}
            onReset={() => pitchAnalysis.resetEdits()}
            onNudgePitch={nudgeSelectedPitch}
            onPlayPause={() => {
              if (audio.playing()) audio.handlePause()
              else audio.handlePlay()
            }}
            onSeekToStart={() => audio.seekTo(0)}
            onZoomIn={() => setPitchStudioWindow(audio.windowDuration() * 0.7)}
            onZoomOut={() => setPitchStudioWindow(audio.windowDuration() * 1.4)}
            onFit={fitPitchStudio}
            onDone={exitPitchStudio}
            formatTime={canvas.formatTime}
          />
        </Show>

        <Show when={pitchAnalysis.panelOpen() && !pitchAnalysis.editMode()}>
          <div class="sm-left-rail-wrap">
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
              onToggleEditMode={enterPitchStudio}
              canEdit={
                props.preset !== 'performance' &&
                pitchAnalysis.editableNotes().length > 0
              }
              hasEdits={pitchAnalysis.hasEdits()}
              pitchView={pitchAnalysis.pitchView()}
              setPitchView={pitchAnalysis.setPitchView}
              onClose={closePitchTools}
            />
          </div>
        </Show>

        {/* ── Karaoke playlist ─────────────────────────────────── */}
        <Show when={playlistSidebarMounted()}>
          <div class="sm-left-rail-wrap" hidden={!playlistSidebarOpen()}>
            <KaraokePlaylistSidebar
              songs={libraryDrawerSongs()}
              currentSessionId={props.sessionId}
              onPickSong={props.onPickSession}
              onPlayAlong={props.onPlayAlong}
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
        <ConfirmDialog
          open={confirm.pending() !== null}
          title={confirm.pending()?.title ?? ''}
          message={confirm.pending()?.message ?? ''}
          confirmLabel={confirm.pending()?.confirmLabel}
          confirmIcon={confirm.pending()?.confirmIcon}
          onConfirm={confirm.accept}
          onCancel={confirm.cancel}
        />
        <Show when={loopMenu()}>
          {(menu) => (
            <>
              <div
                class="sm-loop-menu-backdrop"
                onPointerDown={() => setLoopMenu(null)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setLoopMenu(null)
                }}
              />
              <div
                class="sm-loop-menu"
                style={{ left: `${menu().x}px`, top: `${menu().y}px` }}
              >
                <div class="sm-loop-menu-time">
                  Loop point at {canvas.formatTime(menu().time)}
                </div>
                <button
                  class="sm-loop-menu-item"
                  onClick={() => {
                    applyLoopPoint('A', menu().time)
                    setLoopMenu(null)
                  }}
                >
                  <span class="sm-loop-menu-dot sm-loop-menu-dot--a">A</span>
                  Set loop start here
                </button>
                <button
                  class="sm-loop-menu-item"
                  onClick={() => {
                    applyLoopPoint('B', menu().time)
                    setLoopMenu(null)
                  }}
                >
                  <span class="sm-loop-menu-dot sm-loop-menu-dot--b">B</span>
                  Set loop end here
                </button>
                <Show when={audio.loopStart() > 0 || audio.loopEnd() > 0}>
                  <button
                    class="sm-loop-menu-item sm-loop-menu-item--clear"
                    onClick={() => {
                      clearLoopFromMenu()
                      setLoopMenu(null)
                    }}
                  >
                    Clear loop
                  </button>
                </Show>
              </div>
            </>
          )}
        </Show>
      </div>
    </Show>
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
  --sm-stage-alpha: ${KARAOKE_STAGE_ALPHA.defaultValue};
  --bg-primary: rgba(13, 17, 23, var(--sm-stage-alpha));
  --bg-secondary: rgba(22, 27, 34, var(--sm-stage-alpha));
  --bg-tertiary: rgba(
    33,
    38,
    45,
    min(1, calc(var(--sm-stage-alpha) + 0.08))
  );
  --sm-canvas-bg: rgba(
    13,
    17,
    23,
    min(1, calc(var(--sm-stage-alpha) + 0.12))
  );
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background:
    linear-gradient(
      rgba(13, 8, 22, min(1, calc(var(--sm-stage-alpha) + 0.08))),
      rgba(13, 8, 22, min(1, calc(var(--sm-stage-alpha) + 0.18)))
    ),
    var(--mp-stage-image) var(--mp-stage-position, 50% 50%) / cover no-repeat,
    var(--bg-secondary, #161b22);
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

/* The app sidebar leaves the full mixer with a tablet-sized content column
   before the <=768px Zen stage takes over. Keep every action reachable in
   that seam instead of letting the right side clip off-screen. */
@media (max-width: 1100px) {
  .sm-header {
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0.55rem;
  }

  .sm-header-left {
    min-width: 0;
  }

  .sm-header-actions {
    flex: 1 1 100%;
    min-width: 0;
    flex-wrap: wrap;
    justify-content: flex-start;
  }
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

.sm-stage-glass {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--fg-secondary, #8b949e);
}

.sm-stage-glass svg {
  flex: none;
}

.sm-stage-glass-slider {
  width: 88px;
  accent-color: var(--accent, #58a6ff);
  cursor: pointer;
}

.sm-stage-glass-slider:focus-visible {
  outline: 2px solid var(--accent, #58a6ff);
  outline-offset: 2px;
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

/* Shared left rail for playlists and pitch tools. Animate position rather
   than transform so native selects remain reliable on iOS Safari. */
.sm-left-rail-wrap {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 30;
  animation: sm-left-rail-in 0.18s ease-out;
}
.sm-left-rail-wrap[hidden] {
  display: none;
}
@keyframes sm-left-rail-in {
  from {
    left: -380px;
    opacity: 0.4;
  }
  to {
    left: 0;
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sm-left-rail-wrap {
    animation: none;
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

.stem-mixer--mapping
  :is(
    [data-panel-id='live'],
    [data-panel-id='pitch'],
    [data-panel-id='midi'],
    [data-fixed-panel='live'],
    [data-fixed-panel='pitch'],
    [data-fixed-panel='midi']
  )::after {
  position: absolute;
  z-index: 5;
  inset: 1.95rem 0 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  content: 'Paused for smoother lyric mapping';
  color: var(--fg-tertiary, #8b949e);
  background:
    linear-gradient(rgba(13, 17, 23, 0.9), rgba(13, 17, 23, 0.96)),
    repeating-linear-gradient(
      -18deg,
      transparent 0 10px,
      rgba(244, 211, 94, 0.04) 10px 11px
    );
  font: 600 0.68rem/1.4 monospace;
  letter-spacing: 0.02em;
  text-align: center;
  pointer-events: none;
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
  /* CSS owns the layout size; JS only maintains the device-pixel backing
     store (see canvas-size-sync.ts). display:block kills the inline-canvas
     baseline gap; flex: 1 (basis 0) keeps the backing-store height from
     feeding back into the panel's intrinsic size. */
  display: block;
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

/* Controls content — two views, toggled and persisted.
   compact:  vertical list, one horizontal row per stem
   expanded: fader deck, vertical sliders side by side (scrolls on overflow) */
.sm-strips {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
  padding: 0.4rem;
  container-type: inline-size;
}

/* "Add stem" pills — session parts on this device not yet in the mix. */
.sm-add-stem-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding-top: 0.45rem;
  margin-top: 0.15rem;
  border-top: 1px solid var(--border, #30363d);
}

/* The pills sit in their own centred row under the label. */
.sm-add-stem-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.3rem;
}

.sm-add-stem-label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-tertiary, #484f58);
}

.sm-add-stem-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--border, #30363d);
  border-radius: 999px;
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.04));
  color: var(--fg-secondary, #8b949e);
  font-size: 0.68rem;
  min-width: 6.25rem;
  justify-content: center;
  cursor: pointer;
  transition:
    border-color 0.15s,
    color 0.15s;
}

.sm-add-stem-pill:hover:not(:disabled) {
  border-color: var(--stem-color, var(--accent, #58a6ff));
  color: var(--fg-primary, #c9d1d9);
}

.sm-add-stem-pill:disabled {
  opacity: 0.55;
  cursor: default;
}

.sm-add-stem-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}

/* View toggle lives in the panel HEADER row (all three workspaces). */
.sm-strip-view-toggle {
  margin-left: auto;
}

.sm-strips-body {
  display: flex;
  gap: 0.4rem;
  min-width: 0;
  min-height: 0;
  /* Grid workspaces may grow naturally, but still keep one bounded scroll
     area on short screens. Sidebars override this with their exact remaining
     height below. */
  max-height: min(60vh, 640px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.sm-stem-strip {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  gap: 0.5rem;
  padding: 0.75rem 0.4rem;
  overflow: hidden;
  background:
    linear-gradient(
      110deg,
      color-mix(in srgb, var(--stem-color) 7%, transparent),
      transparent 42%
    ),
    var(--bg-primary, #0d1117);
  border: 1px solid color-mix(in srgb, var(--stem-color) 16%, var(--border, #30363d));
  border-radius: 0.6rem;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.sm-stem-strip::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 2px;
  background: var(--stem-color);
  content: '';
  opacity: 0.76;
}

.sm-stem-suppressed {
  border-color: var(--border, #30363d);
  background: var(--bg-primary, #0d1117);
}

.sm-stem-suppressed::before {
  opacity: 0.22;
}

.sm-stem-suppressed .sm-stem-dot,
.sm-stem-suppressed .sm-stem-label {
  opacity: 0.52;
}

/* ── Expanded: the classic deck ── */
/* A real grid, not flex-wrap: with an odd strip count the leftover strip
   must sit exactly under the column above it — flex centers the last row
   and the lone fader looked misaligned. Wraps into extra rows first
   (vertical space is usually free in the side panel). */
.sm-strips-expanded .sm-strips-body {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr));
  grid-auto-rows: max-content;
  align-content: start;
  justify-items: center;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scrollbar-width: thin;
}

.sm-strips-expanded .sm-stem-strip {
  width: 100%;
  min-width: 5rem;
  max-width: 9rem;
  flex-direction: column;
  align-items: center;
}

/* Actions run top-to-bottom above the fader, per strip. */
.sm-strips-expanded .sm-stem-actions {
  flex-direction: column;
  gap: 0.25rem;
}

/* The controls wrapper only exists for the compact wrap rule — here the
   strip lays out header/actions/fader directly, so flatten it away. */
.sm-strips-expanded .sm-stem-controls {
  display: contents;
}

/* ── Compact: one row per stem ── */
.sm-strips-compact .sm-strips-body {
  flex-direction: column;
}

.sm-strips-many.sm-strips-compact .sm-stem-strip {
  gap: 0.4rem 0.6rem;
  padding-block: 0.55rem;
}

.sm-strips-many.sm-strips-expanded .sm-strips-body {
  gap: 0.5rem;
  max-height: min(64vh, 680px);
}

/* Fixed and performance layouts know their remaining height. Let the deck
   use all of it, then scroll the strips—not the whole sidebar—when a dense
   full-band mix genuinely exceeds the panel. */
.sm-sidebar .sm-workspace-panel > .sm-strips {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.sm-sidebar .sm-strips-body,
.sm-sidebar .sm-strips-many.sm-strips-expanded .sm-strips-body {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none;
}

@container (min-width: 42rem) {
  .sm-strips-many.sm-strips-compact .sm-strips-body {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

.sm-strips-compact .sm-stem-strip {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.65rem;
  padding: 0.5rem 0.75rem;
}

.sm-strips-compact .sm-stem-header {
  flex-direction: row;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  margin-right: auto;
}

/* Buttons + slider move as ONE unit: inline after the name when the row is
   wide enough, otherwise together onto a full-width second line. Splitting
   them made the break point depend on the stem name's width — "Vocal" kept
   its buttons up top and orphaned the slider below. */
.sm-strips-compact .sm-stem-controls {
  display: flex;
  align-items: center;
  gap: 0.4rem 0.65rem;
  flex: 1 1 14rem;
  min-width: 0;
  /* A range thumb is wider than its 4px track and extends past the input's
     endpoint. Reserve half a thumb at the card edge so 100% remains visible. */
  padding-inline-end: 7px;
}

/* Fills whatever width the controls row gives it. */
.sm-strips-compact .sm-volume-slider {
  writing-mode: horizontal-tb;
  direction: ltr;
  flex: 1 1 5rem;
  width: auto;
  min-width: 3rem;
  height: 4px;
}

.sm-strips-compact .sm-volume-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 4px;
  background: linear-gradient(
    to right,
    var(--stem-color) 0 var(--stem-volume),
    var(--bg-tertiary, #21262d) var(--stem-volume) 100%
  );
}

.sm-strips-compact .sm-volume-slider::-webkit-slider-thumb {
  margin-left: 0;
  margin-top: -5px;
}

.sm-strips-compact .sm-volume-slider::-moz-range-track {
  width: 100%;
  height: 4px;
  background: linear-gradient(
    to right,
    var(--stem-color) 0 var(--stem-volume),
    var(--bg-tertiary, #21262d) var(--stem-volume) 100%
  );
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
  box-shadow: 0 0 0.55rem color-mix(in srgb, var(--stem-color) 48%, transparent);
  transition: opacity 0.15s ease;
}

.sm-stem-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-primary, #c9d1d9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: opacity 0.15s ease;
}

.sm-stem-vol-pct {
  font-size: 0.65rem;
  color: var(--fg-tertiary, #484f58);
  font-variant-numeric: tabular-nums;
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
  transition:
    background-color 0.15s,
    border-color 0.15s,
    color 0.15s,
    box-shadow 0.15s;
}

.sm-action-btn svg {
  width: 0.8rem;
  height: 0.8rem;
}

.sm-action-btn:hover {
  background: var(--bg-hover, #30363d);
  color: var(--fg-primary, #c9d1d9);
}

.sm-action-btn:focus-visible,
.sm-volume-slider:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--stem-color, var(--accent, #58a6ff)) 72%, white);
  outline-offset: 2px;
}

.sm-action-btn.sm-active {
  background: color-mix(in srgb, var(--stem-color, #f59e0b) 16%, transparent);
  border-color: color-mix(in srgb, var(--stem-color, #f59e0b) 42%, transparent);
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
  background: linear-gradient(
    to top,
    var(--stem-color) 0 var(--stem-volume),
    var(--bg-tertiary, #21262d) var(--stem-volume) 100%
  );
  border-radius: 2px;
  border: none;
}

.sm-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--stem-color, var(--accent, #58a6ff));
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
  background: linear-gradient(
    to top,
    var(--stem-color) 0 var(--stem-volume),
    var(--bg-tertiary, #21262d) var(--stem-volume) 100%
  );
  border-radius: 2px;
  border: none;
}

.sm-volume-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--stem-color, var(--accent, #58a6ff));
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
  flex-wrap: wrap;
  justify-content: center;
  max-width: calc(8 * 0.55em + 7 * 0.4em);
  gap: 0.4em;
}

.sm-lyrics-rest-dot {
  display: inline-block;
  flex: 0 0 auto;
  box-sizing: border-box;
  /* The interactive variant is a <button>, and buttons do NOT inherit
     font-size — without this the 0.55em below resolves against the UA's
     ~13px button default and the dots render as tiny squished ovals next
     to large lyrics (the zen-stage bug). font: inherit makes the em track
     the surrounding lyric text exactly like the non-interactive span. */
  appearance: none;
  font: inherit;
  width: 0.55em;
  height: 0.55em;
  padding: 0;
  border-radius: 50%;
  background: linear-gradient(
    to right,
    var(--accent, #58a6ff) var(--fill, 0%),
    var(--bg-tertiary, rgba(255, 255, 255, 0.15)) var(--fill, 0%)
  );
  border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
  transition: background 0.12s linear;
}

.sm-lyrics-rest-dot--interactive {
  cursor: pointer;
}

.sm-lyrics-rest-dot--interactive:focus-visible {
  outline: 2px solid var(--accent, #58a6ff);
  outline-offset: 2px;
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
  color: transparent;
  background: linear-gradient(
    90deg,
    var(--accent-lighter, #79c0ff) 0 var(--word-progress, 0%),
    var(--fg-secondary, #8b949e) var(--word-progress, 0%) 100%
  );
  background-clip: text;
  -webkit-background-clip: text;
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

/* ── Lyrics text editor ─────────────────────────────────── */

.sm-lyrics-textedit-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--border, #30363d);
}

.sm-lyrics-textedit-title {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--fg-secondary, #a8b3bf);
  margin-right: auto;
}

.sm-lyrics-textedit-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.5rem 0.6rem;
  overflow-y: auto;
}

.sm-lyrics-textedit-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.sm-lyrics-textedit-time {
  font-size: 0.62rem;
  font-family: monospace;
  color: var(--fg-tertiary, #484f58);
  min-width: 3.2em;
  flex-shrink: 0;
}

.sm-lyrics-textedit-input {
  flex: 1;
  min-width: 0;
  background: var(--bg-tertiary, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.35rem;
  padding: 0.3rem 0.5rem;
  font-size: 0.78rem;
  font-family: inherit;
  color: var(--text-primary, #c9d1d9);
}

.sm-lyrics-textedit-input:focus {
  outline: none;
  border-color: var(--accent, #58a6ff);
}

.sm-lyrics-textedit-rest {
  flex: 1;
  min-width: 0;
  background: var(--bg-tertiary, #161b22);
  border: 1px solid transparent;
  border-radius: 0.35rem;
  padding: 0.3rem 0.5rem;
  font-size: 0.78rem;
  color: var(--fg-tertiary, #484f58);
  user-select: none;
}

.sm-lyrics-textedit-del,
.sm-lyrics-textedit-add {
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
}

.sm-lyrics-textedit-del:hover {
  color: var(--error, #f85149);
  border-color: var(--error, #f85149);
  background: rgba(248, 81, 73, 0.08);
}

.sm-lyrics-textedit-add:hover {
  color: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
  background: rgba(88, 166, 255, 0.08);
}

.sm-lyrics-save-btn:disabled {
  opacity: 0.45;
  cursor: default;
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

/* Lyrics version switcher (Original / Edited / Auto-sync / Mapped) */
.sm-lyrics-version {
  position: relative;
  display: inline-flex;
  margin-left: 0.25rem;
}
.sm-lyrics-version-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  height: 1.15rem;
  padding: 0 0.4rem;
  background: transparent;
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
  color: var(--fg-secondary, #a8b3bf);
  font-size: 0.62rem;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.sm-lyrics-version-btn:hover,
.sm-lyrics-version-btn--open {
  color: var(--accent, #58a6ff);
  border-color: color-mix(in srgb, var(--accent, #58a6ff) 45%, transparent);
}
.sm-lyrics-version-label {
  max-width: 5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sm-lyrics-version-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
}
.sm-lyrics-version-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 61;
  min-width: 160px;
  padding: 0.25rem;
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.45rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  animation: sm-loop-menu-in 0.1s ease-out;
}
.sm-lyrics-version-row {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  border-radius: 0.3rem;
}
.sm-lyrics-version-row--active {
  background: color-mix(in srgb, var(--accent, #58a6ff) 12%, transparent);
}
.sm-lyrics-version-pick {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
  padding: 0.4rem 0.45rem;
  background: none;
  border: none;
  border-radius: 0.3rem;
  color: var(--fg-primary, #e6edf3);
  font-size: 0.78rem;
  text-align: left;
  cursor: pointer;
}
.sm-lyrics-version-pick:hover {
  background: var(--bg-tertiary, #21262d);
}
.sm-lyrics-version-check {
  display: inline-flex;
  width: 12px;
  color: var(--accent, #58a6ff);
  flex-shrink: 0;
}
.sm-lyrics-version-del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  padding: 0;
  margin-right: 0.15rem;
  background: none;
  border: none;
  border-radius: 0.3rem;
  color: var(--fg-tertiary, #8b949e);
  cursor: pointer;
}
.sm-lyrics-version-del:hover {
  color: var(--error, #f85149);
  background: color-mix(in srgb, var(--error, #f85149) 12%, transparent);
}
.sm-lyrics-version-sep {
  height: 1px;
  margin: 0.25rem 0.2rem;
  background: var(--border, #30363d);
}
.sm-lyrics-version-action {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.4rem 0.45rem;
  background: none;
  border: none;
  border-radius: 0.3rem;
  color: var(--fg-primary, #e6edf3);
  font-size: 0.78rem;
  text-align: left;
  cursor: pointer;
}
.sm-lyrics-version-action:hover:not(:disabled) {
  background: var(--bg-tertiary, #21262d);
}
.sm-lyrics-version-action:disabled {
  color: var(--fg-tertiary, #8b949e);
  cursor: default;
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
  flex-direction: column;
  align-items: stretch;
  gap: 0.35rem;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--border, #30363d);
}

.sm-lyrics-gen-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

/* Settings sit visually behind the mapping buttons: same row rhythm, quieter
   weight, so the eye lands on the controls that need a timed press. */
.sm-lyrics-gen-row--settings {
  gap: 0.5rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--border-subtle, rgba(139, 148, 158, 0.18));
}

/* Pushes Finish / Discard to the far end when there is room, and collapses to
   nothing once the row wraps. */
.sm-lyrics-gen-row-gap {
  flex: 1 1 0;
  min-width: 0;
}

.sm-lyrics-gen-field {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.sm-lyrics-gen-field-label {
  font-size: 0.52rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fg-tertiary, #8b949e);
  opacity: 0.75;
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

.sm-lyrics-gen-mode-switch {
  display: inline-flex;
  padding: 2px;
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.35rem;
}

.sm-lyrics-gen-mode-btn {
  height: 1.45rem;
  padding: 0 0.55rem;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  color: var(--fg-tertiary, #8b949e);
  font: 600 0.62rem/1 inherit;
  cursor: pointer;
}

.sm-lyrics-gen-mode-btn--active {
  background: #f4d35e;
  color: #17140a;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.24);
}

.sm-lyrics-gen-speed,
.sm-lyrics-gen-offset {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  color: var(--fg-tertiary, #8b949e);
  font-size: 0.58rem;
}

.sm-lyrics-gen-speed-select {
  min-width: 5.6rem;
  height: 1.45rem;
  color: var(--fg-primary, #c9d1d9);
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.25rem;
  font: 0.6rem/1 monospace;
}

.sm-lyrics-gen-offset input {
  width: 3.2rem;
  height: 1.45rem;
  padding: 0 0.25rem;
  color: var(--fg-primary, #c9d1d9);
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.25rem;
  font: 0.6rem/1 monospace;
}

.sm-lyrics-gen-calib-btn {
  height: 1.45rem;
  padding: 0 0.4rem;
  color: var(--fg-secondary, #8b949e);
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.25rem;
  font: 600 0.58rem/1 inherit;
  cursor: pointer;
}

.sm-lyrics-gen-calib-btn:hover {
  color: var(--fg-primary, #c9d1d9);
  border-color: #f4d35e;
}

.sm-lyrics-gen-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--fg-tertiary, #8b949e);
  font-size: 0.58rem;
  white-space: nowrap;
  cursor: pointer;
}

.sm-lyrics-gen-toggle input {
  width: 0.75rem;
  height: 0.75rem;
  accent-color: #f4d35e;
  cursor: pointer;
}

.sm-lyrics-gen-toggle:has(input:checked) {
  color: var(--fg-primary, #c9d1d9);
}

.sm-lyrics-gen-preview-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.15rem;
  height: 1.15rem;
  margin-right: 0.3rem;
  padding: 0;
  color: var(--fg-tertiary, #8b949e);
  background: transparent;
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
  cursor: pointer;
}

.sm-lyrics-gen-preview-btn:hover:not(:disabled) {
  color: #f4d35e;
  border-color: #f4d35e;
}

.sm-lyrics-gen-preview-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.sm-lyrics-gen-preview-btn--on {
  color: #17140a;
  background: #f4d35e;
  border-color: #f4d35e;
}

/* ── Reaction calibration ─────────────────────────── */

.sm-lyrics-calib {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.65rem;
  background: rgba(244, 211, 94, 0.08);
  border-bottom: 1px solid rgba(244, 211, 94, 0.22);
}

.sm-lyrics-calib-head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
}

.sm-lyrics-calib-title {
  color: var(--fg-primary, #c9d1d9);
  font: 600 0.65rem/1 inherit;
}

.sm-lyrics-calib-close {
  margin-left: auto;
  display: inline-flex;
  padding: 0.15rem;
  color: var(--fg-tertiary, #8b949e);
  background: transparent;
  border: 0;
  cursor: pointer;
}

.sm-lyrics-calib-copy {
  flex: 1 1 14rem;
  margin: 0;
  color: var(--fg-secondary, #8b949e);
  font-size: 0.6rem;
  line-height: 1.35;
}

.sm-lyrics-calib-start,
.sm-lyrics-calib-apply,
.sm-lyrics-calib-tap {
  height: 1.6rem;
  padding: 0 0.7rem;
  border: 1px solid var(--border, #30363d);
  border-radius: 0.25rem;
  background: var(--bg-tertiary, #21262d);
  color: var(--fg-primary, #c9d1d9);
  font: 600 0.62rem/1 inherit;
  cursor: pointer;
}

.sm-lyrics-calib-tap {
  min-width: 5rem;
  height: 2rem;
}

.sm-lyrics-calib-apply {
  background: #f4d35e;
  border-color: #f4d35e;
  color: #17140a;
}

.sm-lyrics-calib-dots {
  display: inline-flex;
  gap: 0.22rem;
}

.sm-lyrics-calib-dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--border, #30363d);
}

.sm-lyrics-calib-dot--hit {
  background: #f4d35e;
}

.sm-lyrics-calib-count,
.sm-lyrics-calib-was,
.sm-lyrics-calib-spread {
  color: var(--fg-tertiary, #8b949e);
  font: 0.58rem/1 monospace;
}

.sm-lyrics-calib-result {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0;
  color: var(--fg-primary, #c9d1d9);
  font-size: 0.7rem;
}

.sm-lyrics-calib-actions {
  display: inline-flex;
  gap: 0.35rem;
  margin-left: auto;
}

.sm-lyrics-gen-guidance {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.42rem 0.65rem;
  color: var(--fg-secondary, #8b949e);
  background: rgba(244, 211, 94, 0.06);
  border-bottom: 1px solid rgba(244, 211, 94, 0.18);
  font-size: 0.66rem;
  line-height: 1.4;
}

.sm-lyrics-gen-guidance-performance {
  color: var(--fg-tertiary, #6e7681);
  font-size: 0.58rem;
  text-align: right;
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

.sm-lyrics-gen-redo-btn {
  height: 1.8rem;
  padding: 0.2rem 0.7rem;
  color: var(--fg-secondary, #8b949e);
  background: transparent;
  border: 1px solid var(--border, #30363d);
  border-radius: 0.25rem;
  font: 600 0.65rem/1 inherit;
  cursor: pointer;
}

.sm-lyrics-gen-redo-btn:hover {
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

.sm-lyrics-gen-line-marker-mode {
  min-height: 4rem;
  align-items: center;
  padding-block: 0.55rem;
  /* Breathing room from the neighbouring lines, and wrapped rows of
     2.75rem marker targets get their own separation. */
  margin-block: 0.25rem;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: crosshair !important;
}

.sm-lyrics-gen-line-marker-mode .sm-lyrics-gen-line-text {
  row-gap: 0.55rem;
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
  /* The row gap is load-bearing: each word is a stacked time+text
     block, so on a WRAPPED long line a zero row gap put the second
     row's time labels flush under the first row's text — the line read
     as squeezed and, in marker mode, the touch targets overlapped and
     became unhittable after auto-advance (owner testing). */
  gap: 0.4rem 0.3rem;
}

.sm-lyrics-gen-word {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  position: relative;
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

.sm-lyrics-gen-word-marker {
  min-height: 2.75rem;
  min-width: 2rem;
  justify-content: center;
  padding: 0 0.12rem;
}

.sm-lyrics-gen-word-marker .sm-lyrics-gen-word-text {
  position: relative;
  z-index: 1;
  padding: 0.08rem 0.06rem;
}

.sm-lyrics-gen-word-marker .sm-lyrics-gen-word-text::before {
  position: absolute;
  z-index: -1;
  inset: 48% 0 5%;
  width: var(--marker-progress, 0%);
  content: '';
  background: rgba(244, 211, 94, 0.68);
  border-radius: 0.18rem 0.04rem 0.12rem 0.15rem;
  box-shadow: 0 0 0.3rem rgba(244, 211, 94, 0.16);
  transform: rotate(-0.8deg) skewX(-4deg);
  transform-origin: left center;
  pointer-events: none;
}

.sm-lyrics-gen-word-current.sm-lyrics-gen-word-marker .sm-lyrics-gen-word-text {
  color: var(--fg-primary, #f0f6fc);
  text-decoration-color: #f4d35e;
}

.sm-lyrics-gen-word-done.sm-lyrics-gen-word-marker .sm-lyrics-gen-word-text::before {
  width: 100%;
  opacity: 0.48;
}

@media (prefers-reduced-motion: reduce) {
  .sm-lyrics-word,
  .sm-lyrics-gen-line {
    transition: none;
  }
}

.sm-lyrics-gen-word-done .sm-lyrics-gen-word-text {
  color: var(--fg-secondary, #8b949e);
}

/* The line the playhead is inside, which is not necessarily the line the
   mapping cursor is standing on — that is the whole point of watching
   playback from in here. */
.sm-lyrics-gen-line-lit {
  background: rgba(88, 166, 255, 0.07);
  box-shadow: inset 2px 0 0 var(--accent, #58a6ff);
}

/* Playback highlighting inside the mapper — Live highlight, and the per-line
   preview. Deliberately mirrors the runtime renderer
   (.sm-lyrics-line-active .sm-lyrics-word-current) instead of the marker's
   highlighter-pen fill: the whole point is to show what the timings will look
   like once they ship. It also has to render in Tap mode, where no marker fill
   exists at all — which is why it is its own class and not a marker variant.

   Last in the cascade on purpose: every rule it overrides
   (--word-current green, --word-done grey) has the same specificity, so source
   order is what decides. */
.sm-lyrics-gen-word-lit .sm-lyrics-gen-word-text {
  color: transparent;
  background: linear-gradient(
    90deg,
    var(--accent-lighter, #79c0ff) 0 var(--marker-progress, 0%),
    var(--fg-secondary, #8b949e) var(--marker-progress, 0%) 100%
  );
  background-clip: text;
  -webkit-background-clip: text;
  text-decoration: none;
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

/* Let uploader and lyrics picker fill the panel with one deliberate scroll area. */
.sm-workspace-panel > .lu-root,
.sm-workspace-panel > .sm-song-picker,
.sm-perf-lyrics > .sm-song-picker {
  flex: 1;
  min-height: 0;
}

.sm-workspace-panel > .sm-song-picker,
.sm-perf-lyrics > .sm-song-picker {
  overflow: hidden;
}

.sm-workspace-panel > .sm-song-picker .sm-song-picker-list,
.sm-perf-lyrics > .sm-song-picker .sm-song-picker-list {
  max-height: none;
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

/* Only rendered in focus mode, on the glass pill — quiet grip like the
   practice ControlOverlay's: no block background, just a soft hover tint. */
.sm-transport-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  margin: -0.375rem; /* Increase hit area without changing layout size */
  cursor: grab;
  color: var(--fg-muted, #8b949e);
  background: transparent;
  border-radius: 9px;
  transition:
    background 0.15s ease,
    color 0.15s ease;
  touch-action: none;
  -webkit-touch-callout: none;
}

.sm-transport-drag-handle:hover {
  background: color-mix(in srgb, var(--fg-primary, #c9d1d9) 10%, transparent);
  color: var(--fg-primary, #c9d1d9);
}

.sm-transport-drag-handle:active {
  cursor: grabbing;
}
.sm-transport-drag-handle--open {
  background: color-mix(in srgb, var(--accent, #58a6ff) 18%, transparent);
  color: var(--accent, #58a6ff);
}

/* Click-to-dock compass — a gizmo of four direction arrows around a hub,
   the current side highlighted. Faster than drag on desktop. */
.sm-transport-dock {
  position: relative;
  display: flex;
  align-items: center;
}
.sm-dock-compass-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1001;
}
.sm-dock-compass {
  position: absolute;
  z-index: 1002;
  display: grid;
  grid-template-columns: repeat(3, 1.55rem);
  grid-template-rows: repeat(3, 1.55rem);
  place-items: center;
  padding: 0.3rem;
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.6rem;
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.45);
  animation: sm-dock-compass-in 0.12s ease-out;
}
@keyframes sm-dock-compass-in {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
/* Position the popover away from whichever edge the bar is docked on, so it
   opens toward the content, not off-screen. */
.sm-dock-compass--bottom { bottom: calc(100% + 0.4rem); left: 0; }
.sm-dock-compass--top { top: calc(100% + 0.4rem); left: 0; }
.sm-dock-compass--left { left: calc(100% + 0.4rem); top: 0; }
.sm-dock-compass--right { right: calc(100% + 0.4rem); top: 0; }
.sm-dock-compass-btn {
  grid-column: 2;
  grid-row: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0.3rem;
  color: var(--fg-secondary, #a8b3bf);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.sm-dock-compass-btn--top { grid-row: 1; }
.sm-dock-compass-btn--bottom { grid-row: 3; }
.sm-dock-compass-btn--left { grid-column: 1; grid-row: 2; }
.sm-dock-compass-btn--right { grid-column: 3; grid-row: 2; }
.sm-dock-compass-btn:hover {
  background: color-mix(in srgb, var(--accent, #58a6ff) 16%, transparent);
  color: var(--fg-primary, #e6edf3);
}
.sm-dock-compass-btn--active {
  background: var(--accent, #58a6ff);
  color: #fff;
}
.sm-dock-compass-hub {
  grid-column: 2;
  grid-row: 2;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--border, #30363d);
  pointer-events: none;
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
/* Waveform/pitch right-click loop menu */
.sm-loop-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 199;
}
.sm-loop-menu {
  position: fixed;
  z-index: 200;
  min-width: 190px;
  padding: 0.3rem;
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.5rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  animation: sm-loop-menu-in 0.1s ease-out;
}
@keyframes sm-loop-menu-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.sm-loop-menu-time {
  padding: 0.35rem 0.55rem 0.45rem;
  font-size: 0.7rem;
  color: var(--fg-tertiary, #8b949e);
  border-bottom: 1px solid var(--border, #30363d);
  margin-bottom: 0.25rem;
  font-variant-numeric: tabular-nums;
}
.sm-loop-menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.45rem 0.55rem;
  background: none;
  border: none;
  border-radius: 0.35rem;
  color: var(--fg-primary, #e6edf3);
  font-size: 0.82rem;
  text-align: left;
  cursor: pointer;
}
.sm-loop-menu-item:hover {
  background: var(--bg-tertiary, #21262d);
}
.sm-loop-menu-item--clear {
  color: var(--fg-secondary, #a8b3bf);
}
.sm-loop-menu-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 50%;
  font-size: 0.68rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.sm-loop-menu-dot--a { background: #58a6ff; }
.sm-loop-menu-dot--b { background: #ff7b72; }

.sm-mic-score-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 11, 16, 0.72);
  backdrop-filter: blur(6px);
  animation: sm-score-overlay-in 0.25s ease-out;
}
@keyframes sm-score-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.sm-mic-score-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(560px, 94%);
  padding: 2.25rem 2rem 2rem;
  border-radius: 20px;
  background: linear-gradient(
    160deg,
    rgba(28, 34, 46, 0.98),
    rgba(15, 19, 27, 0.98)
  );
  border: 1px solid var(--border, #30363d);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
  text-align: center;
  animation: sm-score-in 0.3s ease-out;
}
@keyframes sm-score-in {
  from { opacity: 0; transform: translateY(-0.75rem) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.sm-mic-score-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  background: none;
  border: none;
  border-radius: 0.4rem;
  color: var(--fg-tertiary, #8b949e);
  cursor: pointer;
}
.sm-mic-score-close:hover {
  color: var(--fg-primary, #e6edf3);
  background: rgba(255, 255, 255, 0.06);
}
.sm-mic-grade {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 6.5rem;
  height: 6.5rem;
  border-radius: 50%;
  font-size: 3.4rem;
  font-weight: 800;
  line-height: 1;
  flex-shrink: 0;
}
.sm-mic-grade--s {
  background: linear-gradient(135deg, #ffd166, #f4a52e);
  color: #1a1510;
  box-shadow: 0 0 42px rgba(255, 209, 102, 0.45);
}
.sm-mic-grade--a {
  background: linear-gradient(135deg, #6ee7b7, #34d399);
  color: #05261b;
  box-shadow: 0 0 42px rgba(110, 231, 183, 0.4);
}
.sm-mic-grade--b {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  color: #fff;
  box-shadow: 0 0 42px rgba(96, 165, 250, 0.4);
}
.sm-mic-grade--c {
  background: linear-gradient(135deg, #fbbf24, #d97706);
  color: #1a1510;
  box-shadow: 0 0 42px rgba(251, 191, 36, 0.35);
}
.sm-mic-grade--d {
  background: linear-gradient(135deg, #f87171, #dc2626);
  color: #fff;
  box-shadow: 0 0 42px rgba(248, 113, 113, 0.35);
}
.sm-mic-score-verdict {
  margin-top: 0.9rem;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--fg-secondary, #a8b3bf);
  text-transform: uppercase;
}
.sm-mic-score-accuracy {
  margin-top: 0.35rem;
  font-size: 3.6rem;
  font-weight: 800;
  line-height: 1.05;
  color: var(--fg-primary, #e6edf3);
  font-variant-numeric: tabular-nums;
}
.sm-mic-score-accuracy-unit {
  font-size: 1.9rem;
  font-weight: 700;
  color: var(--fg-secondary, #a8b3bf);
  margin-left: 0.15rem;
}
.sm-mic-score-accuracy-label {
  font-size: 0.9rem;
  color: var(--fg-tertiary, #8b949e);
  margin-bottom: 1.4rem;
}
.sm-mic-score-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
  margin-bottom: 1.6rem;
}
.sm-mic-score-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border, #30363d);
  font-size: 0.9rem;
  color: var(--fg-secondary, #a8b3bf);
  white-space: nowrap;
}
.sm-mic-score-pill svg {
  color: var(--accent, #58a6ff);
  flex-shrink: 0;
}
.sm-mic-score-pill strong {
  color: var(--fg-primary, #e6edf3);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.sm-mic-score-ok-btn {
  padding: 0.7rem 2.75rem;
  background: linear-gradient(135deg, var(--accent, #58a6ff), var(--purple, #bc8cff));
  color: #fff;
  border: none;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}
.sm-mic-score-ok-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
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

/* ── Lyrics finder: LRCLIB search picker (glass) ──────────────────
   Shared by the studio panel and the zen stage. Accent tracks the ambient
   theme (blue in the studio); the zen stage sets --lyf-accent to its purple.
   Surfaces derive from the foreground so it reads on any dark stage. */
.sm-song-picker {
  --lyf-acc: var(--lyf-accent, var(--accent, #8b5cf6));
  --lyf-acc-rgb: var(--lyf-accent-rgb, 139, 92, 246);
  --lyf-surface: color-mix(in srgb, var(--fg-primary, #e6edf3) 6%, transparent);
  --lyf-surface-2: color-mix(in srgb, var(--fg-primary, #e6edf3) 11%, transparent);
  --lyf-border: color-mix(in srgb, var(--fg-primary, #e6edf3) 14%, transparent);
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1rem;
  min-height: 0;
}

.sm-song-picker--inline {
  padding: 0;
  gap: 0.6rem;
}

.sm-song-picker-header {
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--fg-primary, #e6edf3);
  flex-shrink: 0;
}

.sm-song-picker-search {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
  flex-shrink: 0;
}

.sm-song-picker-input {
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 0.9rem;
  font-size: 0.95rem;
  font-family: inherit;
  color: var(--fg-primary, #e6edf3);
  background: var(--lyf-surface);
  border: 1px solid var(--lyf-border);
  border-radius: 12px;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.sm-song-picker-input::placeholder {
  color: var(--fg-tertiary, #6e7681);
}

.sm-song-picker-input:focus {
  background: var(--lyf-surface-2);
  border-color: rgba(var(--lyf-acc-rgb), 0.7);
  box-shadow: 0 0 0 3px rgba(var(--lyf-acc-rgb), 0.2);
}

.sm-song-picker-search-btn {
  flex: none;
  height: 44px;
  padding: 0 1.05rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  background: var(--lyf-acc);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition:
    filter 0.16s ease,
    transform 0.06s ease;
}

.sm-song-picker-search-btn:hover {
  filter: brightness(1.08);
}

.sm-song-picker-search-btn:active {
  transform: scale(0.97);
}

.sm-song-picker-search-btn svg {
  width: 0.95rem;
  height: 0.95rem;
}

.sm-song-picker-paste-btn {
  flex: none;
  height: 44px;
  padding: 0 0.9rem;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--fg-secondary, #8b949e);
  background: var(--lyf-surface);
  border: 1px solid var(--lyf-border);
  border-radius: 12px;
  cursor: pointer;
  transition:
    color 0.16s ease,
    background 0.16s ease;
}

.sm-song-picker-paste-btn:hover {
  color: var(--fg-primary, #e6edf3);
  background: var(--lyf-surface-2);
}

.sm-song-picker-count {
  font-size: 0.72rem;
  letter-spacing: 0.02em;
  color: var(--fg-tertiary, #6e7681);
  padding: 0 0.15rem;
  flex-shrink: 0;
}

.sm-song-picker-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--lyf-border);
  border-radius: 14px;
  background: var(--lyf-surface);
  -webkit-backdrop-filter: var(--glass-blur, blur(18px) saturate(1.35));
  backdrop-filter: var(--glass-blur, blur(18px) saturate(1.35));
}

.sm-song-picker-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 48px;
  padding: 0.5rem 0.85rem;
  border: none;
  border-bottom: 1px solid color-mix(in srgb, var(--fg-primary, #e6edf3) 7%, transparent);
  background: transparent;
  color: var(--fg-primary, #e6edf3);
  font-size: 0.9rem;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.14s ease;
}

.sm-song-picker-row:last-child {
  border-bottom: none;
}

.sm-song-picker-row:hover {
  background: rgba(var(--lyf-acc-rgb), 0.12);
}

.sm-song-picker-artist {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sm-song-picker-sep {
  color: var(--fg-tertiary, #6e7681);
  flex-shrink: 0;
}

.sm-song-picker-title {
  color: var(--fg-secondary, #8b949e);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sm-song-picker-badge {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  color: var(--lyf-acc);
  background: rgba(var(--lyf-acc-rgb), 0.16);
  border: 1px solid rgba(var(--lyf-acc-rgb), 0.3);
}

.sm-song-picker-no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem;
  text-align: center;
  border: 1px dashed var(--lyf-border);
  border-radius: 14px;
  background: var(--lyf-surface);
}

.sm-song-picker-no-results-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fg-primary, #e6edf3);
}

.sm-song-picker-no-results-hint {
  font-size: 0.78rem;
  color: var(--fg-tertiary, #6e7681);
  max-width: 22rem;
}

.sm-song-picker-lrclib-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.15rem;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--lyf-acc);
  text-decoration: none;
  padding: 0.45rem 0.9rem;
  border-radius: 12px;
  background: rgba(var(--lyf-acc-rgb), 0.1);
  border: 1px solid rgba(var(--lyf-acc-rgb), 0.28);
  transition:
    background 0.16s ease,
    border-color 0.16s ease;
}

.sm-song-picker-lrclib-link:hover {
  background: rgba(var(--lyf-acc-rgb), 0.16);
  border-color: rgba(var(--lyf-acc-rgb), 0.45);
}

.sm-song-picker-lrclib-link svg {
  width: 0.9rem;
  height: 0.9rem;
  flex-shrink: 0;
}

.sm-song-picker-footer-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.15rem;
  flex-shrink: 0;
}

.sm-song-picker-footer-btn {
  height: 40px;
  padding: 0 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--fg-secondary, #8b949e);
  background: var(--lyf-surface);
  border: 1px solid var(--lyf-border);
  border-radius: 12px;
  cursor: pointer;
  transition:
    color 0.16s ease,
    background 0.16s ease;
}

.sm-song-picker-footer-btn:hover {
  color: var(--fg-primary, #e6edf3);
  background: var(--lyf-surface-2);
}

.sm-song-picker-footer-btn--primary {
  color: #fff;
  background: var(--lyf-acc);
  border-color: transparent;
}

.sm-song-picker-footer-btn--primary:hover {
  filter: brightness(1.08);
  background: var(--lyf-acc);
}

@media (prefers-reduced-motion: reduce) {
  .sm-song-picker-input,
  .sm-song-picker-search-btn,
  .sm-song-picker-paste-btn,
  .sm-song-picker-row,
  .sm-song-picker-lrclib-link,
  .sm-song-picker-footer-btn {
    transition: none;
  }
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
}`
