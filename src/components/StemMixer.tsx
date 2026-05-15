// ============================================================
// StemMixer — Play separated stems with volume control & pitch viz
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, } from 'solid-js'
import { useStemMixerAudioController } from '@/features/stem-mixer/useStemMixerAudioController'
import { useStemMixerCanvasController } from '@/features/stem-mixer/useStemMixerCanvasController'
import { useStemMixerLayoutController } from '@/features/stem-mixer/useStemMixerLayoutController'
import { useStemMixerLyricsController } from '@/features/stem-mixer/useStemMixerLyricsController'
import { useStemMixerMicController } from '@/features/stem-mixer/useStemMixerMicController'
import { extractTitle } from '@/lib/lyrics-service'
import type { MidiNoteEvent } from '@/lib/midi-generator'
import { showNotification } from '@/stores/notifications-store'
import { ChevronLeft, Share } from './icons'
import { StemMixerFixedWorkspace } from './StemMixerFixedWorkspace'
import { StemMixerGridWorkspace } from './StemMixerGridWorkspace'
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
  /** Which stems the user requested to see — only these appear in tracks().
   *  Undefined = show all loaded stems (backwards-compat). */
  requestedStems?: { vocal?: boolean; instrumental?: boolean; midi?: boolean }
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
  const PITCH_WINDOW_FILL_RATIO = 0.75

  const lrclibSearchUrl = () => {
    const title = extractTitle(props.songTitle ?? '')
    if (!title) return undefined
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
    muted: false,
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
    micActive: mic.micActive,
    getMicAnalyserNode: mic.getMicAnalyserNode,
    getMicPitchDetector: mic.getMicPitchDetector,
    setMicPitch: mic.setMicPitch,
    comparisonData: mic.comparisonData,
    setComparisonData: mic.setComparisonData,
    toleranceCents: mic.toleranceCents,
    resetMicPitchHistory: mic.resetMicPitchHistory,
    computeScore: mic.computeScore,
    setScore: mic.setScore,
    setShowScore: mic.setShowScore,
    resetScore: mic.resetScore,
    stems: props.stems,
    practiceMode: props.practiceMode,
    requestedStems: props.requestedStems,
    songTitle: props.songTitle,
    showNotification,
  })

  // Backfill audio ctx holders for mic controller
  audioCtxForMic.getAudioCtx = () => audio.getAudioCtx()
  audioCtxForMic.ensureAudioCtx = () => audio.ensureAudioCtx()

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

    // Memos
    stableParsedLyrics,
    blockStarts,
    displayLines,
    genViewData,

    // Actions — lyrics loading
    loadLyrics,
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

    // Helpers
    hasMultipleSections,
  } = useStemMixerLyricsController({
    sessionId: props.sessionId,
    songTitle: props.songTitle,
    duration: audio.duration,
    playing: audio.playing,
    elapsed: audio.elapsed,
    seekTo: audio.seekTo,
    windowDuration: audio.windowDuration,
    setWindowStart: audio.setWindowStart,
  })

  // ── Canvas controller ──────────────────────────────────────────
  const canvas = useStemMixerCanvasController({
    duration: audio.duration,
    elapsed: audio.elapsed,
    windowStart: audio.windowStart,
    windowDuration: audio.windowDuration,
    tracks,
    vocal,
    getPitchHistory: audio.getPitchHistory,
    getMicPitchHistory: mic.getMicPitchHistory,
    micActive: mic.micActive,
    currentPitch: audio.currentPitch,
    midiNotes,
    seekTo: audio.seekTo,
    setWindowStart: audio.setWindowStart,
    setWindowDuration: audio.setWindowDuration,
    PITCH_WINDOW_FILL_RATIO,
  })

  // Backfill mutable holders so audio controller can reach canvas + lyrics
  Object.assign(canvasForAudio, {
    syncCanvasSizes: canvas.syncCanvasSizes,
    drawWaveformOverview: canvas.drawWaveformOverview,
    drawLiveWaveform: canvas.drawLiveWaveform,
    drawPitchCanvas: canvas.drawPitchCanvas,
    drawMidiCanvas: canvas.drawMidiCanvas,
  })
  updateCurrentLineForAudio = updateCurrentLine

  // ── Layout Management ──────────────────────────────────────────
  const layout = useStemMixerLayoutController({
    getWorkspaceRef: () => workspaceRef,
    canvas,
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
    handleLyricsUpload,
    handleSongPick,
    handleSongPickerRefine,
    playing: audio.playing,
    elapsed: audio.elapsed,
    handlePlay: audio.handlePlay,
    handlePause: audio.handlePause,
    formatTime: canvas.formatTime,
    songTitle: props.songTitle,
    lrclibSearchUrl,
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
    practiceMode: props.practiceMode,
    requestedStems: props.requestedStems,
  }

  onMount(() => {
    audio.loadStems()
    loadLyrics()

    canvas.initObserver()
    canvas.queueCanvasRedraw()

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

  onCleanup(() => {
    audio.disconnectSources()
    cancelAnimationFrame(audio.getRafId())
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
    <div class="stem-mixer">
      {/* Header */}
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
          <h2>{props.songTitle.replace(/\.[^.]+$/, '')} (session)</h2>
          <span class="sm-session-id">
            karaoke-session-{props.sessionId.replace(/^.*-session-/, '')}
          </span>
        </div>
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
      </div>

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
              ? `Generating MIDI melody... ${audio.midiProgress()}%`
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
          windowDuration={audio.windowDuration}
          setWindowDuration={audio.setWindowDuration}
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
          formatTime={canvas.formatTime}
        />

        <StemMixerGridWorkspace
          workspaceLayout={layout.workspaceLayout}
          panelStyle={layout.panelStyle}
          getPanel={layout.getPanel}
          handlePanelDragStart={layout.handlePanelDragStart}
          handlePanelDragMove={layout.handlePanelDragMove}
          handlePanelDragEnd={layout.handlePanelDragEnd}
          handleResizeStart={layout.handleResizeStart}
          setCanvasRef={canvas.setCanvasRef}
          handleWaveformClick={canvas.handleWaveformClick}
          handleCanvasWheel={canvas.handleCanvasWheel}
          setWindowDuration={audio.setWindowDuration}
          stemControls={stemControls}
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
          showMidi={showMidi}
          workspaceRef={(el) => {
            workspaceRef = el
          }}
          onWorkspaceWheel={onWorkspaceWheel}
        />
        <StemMixerFixedWorkspace
          workspaceLayout={layout.workspaceLayout}
          fixedPanelHeights={layout.fixedPanelHeights}
          handleFixedResizeStart={layout.handleFixedResizeStart}
          sidebarHidden={layout.sidebarHidden}
          setCanvasRef={canvas.setCanvasRef}
          handleWaveformClick={canvas.handleWaveformClick}
          handleCanvasWheel={canvas.handleCanvasWheel}
          stemControls={stemControls}
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
          showMidi={showMidi}
        />
      </Show>

      <StemMixerScoreModal
        showScore={mic.showScore}
        score={mic.score}
        onClose={() => mic.setShowScore(false)}
      />
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
  font-size: 0.7rem;
  color: var(--fg-tertiary, #484f58);
  background: var(--bg-tertiary, #21262d);
  padding: 0.15rem 0.5rem;
  border-radius: 0.3rem;
  font-family: monospace;
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
  color: var(--bg-primary, #0d1117);
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
  grid-auto-rows: minmax(120px, 1fr);
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
}

.sm-panel-header:active {
  cursor: grabbing;
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
  appearance: none;
  width: 4px;
  height: 100px;
  background: var(--bg-tertiary, #21262d);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.sm-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--accent, #58a6ff);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--bg-primary, #0d1117);
}

.sm-volume-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--accent, #58a6ff);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--bg-primary, #0d1117);
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
  padding: 0.5rem;
  font-size: 0.62rem;
  color: var(--fg-tertiary, #484f58);
  text-align: center;
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

.sm-lyrics-change-btn {
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

.sm-lyrics-change-btn:hover {
  color: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
  background: rgba(88, 166, 255, 0.08);
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
  color: var(--bg-primary, #0d1117);
}

.sm-lyrics-col-active:hover {
  color: var(--bg-primary, #0d1117);
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
  color: var(--bg-primary, #0d1117);
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

.sm-lyrics-markmode-btn--active {
  background: var(--accent, #58a6ff);
  color: var(--bg-primary, #0d1117);
  border-color: var(--accent, #58a6ff);
}

.sm-lyrics-markmode-btn--active:hover {
  background: var(--accent-hover, #79b8ff);
  color: var(--bg-primary, #0d1117);
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
  color: var(--bg-primary, #0d1117);
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
  gap: 0.3rem;
  padding: 0.3rem 0.4rem;
  border-bottom: 1px solid var(--border, #30363d);
  flex-wrap: wrap;
}

.sm-lyrics-gen-play-btn,
.sm-lyrics-gen-pause-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.3rem;
  padding: 0;
  background: var(--accent, #58a6ff);
  color: var(--bg-primary, #0d1117);
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
  font-size: 0.55rem;
  font-family: monospace;
  color: var(--fg-secondary, #8b949e);
  margin: 0 0.2rem;
  flex-shrink: 0;
}

.sm-lyrics-gen-nextword-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.4rem;
  height: 1.25rem;
  font-size: 0.52rem;
  font-weight: 600;
  font-family: inherit;
  background: var(--accent, #58a6ff);
  color: var(--bg-primary, #0d1117);
  border: none;
  border-radius: 0.2rem;
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
  padding: 0 0.4rem;
  height: 1.25rem;
  font-size: 0.52rem;
  font-weight: 600;
  font-family: inherit;
  background: var(--bg-tertiary, #21262d);
  color: var(--fg-secondary, #8b949e);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
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
  padding: 0 0.4rem;
  height: 1.25rem;
  font-size: 0.52rem;
  font-weight: 600;
  font-family: inherit;
  background: var(--ok-green, #3fb950);
  color: var(--bg-primary, #0d1117);
  border: none;
  border-radius: 0.2rem;
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
  padding: 0 0.4rem;
  height: 1.25rem;
  font-size: 0.52rem;
  font-weight: 500;
  font-family: inherit;
  background: transparent;
  color: var(--fg-tertiary, #484f58);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.2rem;
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
  color: var(--bg-primary, #0d1117);
}
.sm-col-active:hover {
  color: var(--bg-primary, #0d1117);
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
}

.sm-transport-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
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

.sm-transport-btn:hover:not(:disabled) {
  background: var(--bg-hover, #30363d);
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
  color: var(--bg-primary, #0d1117);
  border-radius: 50%;
}

.sm-transport-play:hover:not(:disabled) {
  opacity: 0.85;
  color: var(--bg-primary, #0d1117);
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
  color: var(--bg-primary, #0d1117);
  animation: sm-mic-pulse 1.5s ease-in-out infinite;
}

.sm-mic-toggle-btn--active:hover:not(:disabled) {
  opacity: 0.85;
  color: var(--bg-primary, #0d1117);
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
  min-height: 550px;
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

`
