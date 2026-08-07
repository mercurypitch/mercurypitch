// ============================================================
// LrcMapperStage — the full-screen mapper
// ============================================================
//
// The mapping session with the whole viewport instead of a panel: the lyric
// list gets the space, the actions you press in time with the music stay on
// the surface, and everything you set once a session moves behind a menu.
//
// Composed from the same LrcMapperLineList and LrcMapperToolbar the panel
// uses — the toolbar's `variant` splits its two rows between the footer and
// the settings popover. Nothing here re-implements a control.
//
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 2).

import type { Accessor, Component, Setter } from 'solid-js'
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import type { LrcGenPass, PreviewWordHighlight, } from '@/features/stem-mixer/lrc-gen-passes'
import type { BlockInfo, BlockInstancesMap, GenViewLine, LrcGenInputMode, LyricsBlock, } from '@/features/stem-mixer/types'
import { ExampleCredit } from '../ExampleCredit'
import { PitchStageShell } from '../pitch-stage/PitchStageShell'
import { LrcMapperLineList } from './LrcMapperLineList'
import styles from './LrcMapperStage.module.css'
import { LrcMapperToolbar } from './LrcMapperToolbar'

/** Matches the mapper's accent elsewhere in the app. */
const MAPPER_ACCENT = '#79c0ff'
const MAPPER_USER_COLOR = '#3fb950'

export interface LrcMapperStageProps {
  songTitle: string
  /** Surfaces the licence credit when the song is an example. */
  sessionId?: string
  /** Leave the full-screen surface. The session itself keeps running. */
  onClose: () => void

  genViewData: Accessor<GenViewLine[]>
  blockInstances: Accessor<BlockInstancesMap>
  getBlockById: (blockId: string) => LyricsBlock | undefined
  getBlockForLine: (lineIdx: number) => BlockInfo | null
  getBlockColor: (blockId: string) => string
  getGenLines: () => string[]
  formatTimeMs: (t: number) => string
  formatTime: (t: number) => string

  elapsed: Accessor<number>
  duration: Accessor<number>
  playing: Accessor<boolean>
  handlePlay: () => void
  handlePause: () => void
  handleSeekToTime?: (t: number) => void
  playbackSpeed: Accessor<number>
  setPlaybackSpeed: (speed: number) => void

  highlightWord: Accessor<(PreviewWordHighlight & { lineIdx: number }) | null>
  previewLineIdx: Accessor<number | null>
  toggleLinePreview: (idx: number, loop: boolean) => boolean
  setPreviewLoop: (loop: boolean) => void
  loopPreview: Accessor<boolean>
  setLoopPreview: Setter<boolean>
  liveHighlight: Accessor<boolean>
  setLiveHighlight: (on: boolean) => void
  showWordMarkers: Accessor<boolean>
  setShowWordMarkers: Setter<boolean>
  letterMode: Accessor<boolean>
  setLetterMode: (on: boolean) => void
  letterTarget: Accessor<{ lineIdx: number; wordIdx: number } | null>
  openLetterTarget: (lineIdx: number, wordIdx: number) => void
  closeLetterTarget: () => void
  letterSplits: (lineIdx: number, wordIdx: number) => Record<number, number>
  setLetterSplit: (
    lineIdx: number,
    wordIdx: number,
    letterIdx: number,
    time: number,
  ) => void
  clearLetterSplit: (
    lineIdx: number,
    wordIdx: number,
    letterIdx: number,
  ) => void
  handleLyricLineClick: (idx: number) => void

  lrcGenPass: Accessor<LrcGenPass>
  setLrcGenPass: (pass: LrcGenPass) => void
  lrcGenInputMode: Accessor<LrcGenInputMode>
  setLrcGenInputMode: Setter<LrcGenInputMode>
  lrcGenLineIdx: Accessor<number>
  lrcGenWordIdx: Accessor<number>
  wordPassProgress: Accessor<{ done: number; total: number }>
  handleMarkerSample: (
    lineIdx: number,
    wordIdx: number,
    progress: number,
    elapsedTime: number,
    phase: 'start' | 'move' | 'end',
  ) => void
  handleNextLine: () => void
  handleNextWord: () => void
  handleRedoCurrentLine: () => void
  handleLrcGenFinish: () => void
  handleLrcGenReset: () => void

  genShiftMs: Accessor<number>
  shiftGenTimings: (deltaMs: number) => number
  lrcTimingOffsetMs: Accessor<number>
  setLrcTimingOffsetMs: Setter<number>

  lyricsFontSize: Accessor<number>
  setLyricsFontSize: Setter<number>
}

export const LrcMapperStage: Component<LrcMapperStageProps> = (props) => {
  const [settingsOpen, setSettingsOpen] = createSignal(false)
  let settingsRef: HTMLDivElement | undefined

  // Escape closes the menu before it closes the stage, so the first press is
  // never a surprise exit from a session someone is mid-way through.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    if (settingsOpen()) {
      e.stopPropagation()
      setSettingsOpen(false)
    }
  }

  const onPointerDown = (e: PointerEvent) => {
    if (!settingsOpen()) return
    if (settingsRef?.contains(e.target as Node) === true) return
    setSettingsOpen(false)
  }

  createEffect(() => {
    if (!settingsOpen()) return
    document.addEventListener('pointerdown', onPointerDown, true)
    onCleanup(() =>
      document.removeEventListener('pointerdown', onPointerDown, true),
    )
  })

  const progressLabel = () => {
    if (props.lrcGenPass() === 'words') {
      const { done, total } = props.wordPassProgress()
      return `${Math.min(done, total)}/${total} words`
    }
    const total = props.getGenLines().length
    return `${Math.min(props.lrcGenLineIdx(), total)}/${total} lines`
  }

  return (
    <div onKeyDown={onKeyDown}>
      <PitchStageShell
        ariaLabel={`Lyric mapper — ${props.songTitle}`}
        canvas={
          <>
            <ExampleCredit class={styles.credit} sessionId={props.sessionId} />
            <LrcMapperLineList
              blockInstances={props.blockInstances}
              class={styles.lines}
              elapsed={props.elapsed}
              formatTimeMs={props.formatTimeMs}
              genViewData={props.genViewData}
              getBlockById={props.getBlockById}
              getBlockColor={props.getBlockColor}
              handleLyricLineClick={props.handleLyricLineClick}
              handleMarkerSample={props.handleMarkerSample}
              handlePlay={props.handlePlay}
              handleSeekToTime={props.handleSeekToTime}
              highlightWord={props.highlightWord}
              loopPreview={props.loopPreview}
              lrcGenInputMode={props.lrcGenInputMode}
              lrcGenLineIdx={props.lrcGenLineIdx}
              lrcGenWordIdx={props.lrcGenWordIdx}
              clearLetterSplit={props.clearLetterSplit}
              closeLetterTarget={props.closeLetterTarget}
              letterMode={props.letterMode}
              letterSplits={props.letterSplits}
              letterTarget={props.letterTarget}
              openLetterTarget={props.openLetterTarget}
              setLetterSplit={props.setLetterSplit}
              lyricsFontSize={props.lyricsFontSize}
              playing={props.playing}
              previewLineIdx={props.previewLineIdx}
              setLyricsFontSize={props.setLyricsFontSize}
              toggleLinePreview={props.toggleLinePreview}
            />
          </>
        }
        eyebrow="Lyric mapper"
        footer={
          <>
            <div class={styles.transport}>
              <button
                aria-label={props.playing() ? 'Pause' : 'Play'}
                class={styles.playBtn}
                onClick={() =>
                  props.playing() ? props.handlePause() : props.handlePlay()
                }
              >
                <svg height="16" viewBox="0 0 24 24" width="16">
                  <Show
                    fallback={<path d="M8 5v14l11-7z" fill="currentColor" />}
                    when={props.playing()}
                  >
                    <path
                      d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"
                      fill="currentColor"
                    />
                  </Show>
                </svg>
              </button>
              <span>
                {props.formatTime(props.elapsed())} /{' '}
                {props.formatTime(props.duration())}
              </span>
            </div>

            <div class={styles.actions}>
              <LrcMapperToolbar
                blockInstances={props.blockInstances}
                genShiftMs={props.genShiftMs}
                getBlockById={props.getBlockById}
                getBlockForLine={props.getBlockForLine}
                getGenLines={props.getGenLines}
                handleLrcGenFinish={props.handleLrcGenFinish}
                handleLrcGenReset={props.handleLrcGenReset}
                handleNextLine={props.handleNextLine}
                handleNextWord={props.handleNextWord}
                handlePause={props.handlePause}
                handlePlay={props.handlePlay}
                handleRedoCurrentLine={props.handleRedoCurrentLine}
                letterMode={props.letterMode}
                liveHighlight={props.liveHighlight}
                setLetterMode={props.setLetterMode}
                setShowWordMarkers={props.setShowWordMarkers}
                showWordMarkers={props.showWordMarkers}
                loopPreview={props.loopPreview}
                lrcGenInputMode={props.lrcGenInputMode}
                lrcGenLineIdx={props.lrcGenLineIdx}
                lrcGenPass={props.lrcGenPass}
                lrcGenWordIdx={props.lrcGenWordIdx}
                lrcTimingOffsetMs={props.lrcTimingOffsetMs}
                playbackSpeed={props.playbackSpeed}
                playing={props.playing}
                setLiveHighlight={props.setLiveHighlight}
                setLoopPreview={props.setLoopPreview}
                setLrcGenInputMode={props.setLrcGenInputMode}
                setLrcGenPass={props.setLrcGenPass}
                setLrcTimingOffsetMs={props.setLrcTimingOffsetMs}
                setPlaybackSpeed={props.setPlaybackSpeed}
                setPreviewLoop={props.setPreviewLoop}
                shiftGenTimings={props.shiftGenTimings}
                variant="stage-actions"
                wordPassProgress={props.wordPassProgress}
              />
            </div>

            <div class={styles.settings} ref={settingsRef}>
              <button
                aria-expanded={settingsOpen()}
                class={styles.settingsBtn}
                onClick={() => setSettingsOpen((open) => !open)}
              >
                Settings
              </button>
              <Show when={settingsOpen()}>
                <div class={styles.settingsPanel}>
                  <LrcMapperToolbar
                    blockInstances={props.blockInstances}
                    genShiftMs={props.genShiftMs}
                    getBlockById={props.getBlockById}
                    getBlockForLine={props.getBlockForLine}
                    getGenLines={props.getGenLines}
                    handleLrcGenFinish={props.handleLrcGenFinish}
                    handleLrcGenReset={props.handleLrcGenReset}
                    handleNextLine={props.handleNextLine}
                    handleNextWord={props.handleNextWord}
                    handlePause={props.handlePause}
                    handlePlay={props.handlePlay}
                    handleRedoCurrentLine={props.handleRedoCurrentLine}
                    letterMode={props.letterMode}
                    liveHighlight={props.liveHighlight}
                    setLetterMode={props.setLetterMode}
                    setShowWordMarkers={props.setShowWordMarkers}
                    showWordMarkers={props.showWordMarkers}
                    loopPreview={props.loopPreview}
                    lrcGenInputMode={props.lrcGenInputMode}
                    lrcGenLineIdx={props.lrcGenLineIdx}
                    lrcGenPass={props.lrcGenPass}
                    lrcGenWordIdx={props.lrcGenWordIdx}
                    lrcTimingOffsetMs={props.lrcTimingOffsetMs}
                    playbackSpeed={props.playbackSpeed}
                    playing={props.playing}
                    setLiveHighlight={props.setLiveHighlight}
                    setLoopPreview={props.setLoopPreview}
                    setLrcGenInputMode={props.setLrcGenInputMode}
                    setLrcGenPass={props.setLrcGenPass}
                    setLrcTimingOffsetMs={props.setLrcTimingOffsetMs}
                    setPlaybackSpeed={props.setPlaybackSpeed}
                    setPreviewLoop={props.setPreviewLoop}
                    shiftGenTimings={props.shiftGenTimings}
                    variant="stage-settings"
                    wordPassProgress={props.wordPassProgress}
                  />
                </div>
              </Show>
            </div>
          </>
        }
        headerMeta={<span>{progressLabel()}</span>}
        icon={
          <svg height="21" viewBox="0 0 24 24" width="21">
            <path
              d="M4 6h11v2H4V6zm0 5h16v2H4v-2zm0 5h8v2H4v-2z"
              fill="currentColor"
            />
            <circle cx="18.5" cy="6.5" fill="currentColor" r="2.5" />
          </svg>
        }
        mode="lrc-mapper"
        primaryAction={
          <button class={styles.doneBtn} onClick={() => props.onClose()}>
            Done
          </button>
        }
        referenceColor={MAPPER_ACCENT}
        testId="lrc-mapper-stage"
        title={props.songTitle}
        userColor={MAPPER_USER_COLOR}
      />
    </div>
  )
}
