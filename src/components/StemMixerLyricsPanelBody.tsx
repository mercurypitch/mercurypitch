// ============================================================
// StemMixerLyricsPanelBody — shared lyrics body content (used by both layouts)
// ============================================================

import type { Accessor, Component, Setter } from 'solid-js'
import { createEffect, createSignal, For, on, onCleanup, onMount, Show, } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import { SafeSelect } from '@/components/shared/SafeSelect'
import type { LrcGenPass, PreviewWordHighlight, } from '@/features/stem-mixer/lrc-gen-passes'
import { TapCalibrationPanel } from '@/features/stem-mixer/TapCalibrationPanel'
import type { BlockInfo, BlockInstancesMap, BlockStartsInfo, CanonicalLrcEntry, DisplayLine, GenViewLine, LrcGenInputMode, LyricsBlock, WordSweepPoint, WordTimingsMap, } from '@/features/stem-mixer/types'
import type { LyricsAlign } from '@/features/stem-mixer/useStemMixerLyricsController'
import { noteForWord } from '@/features/stem-mixer/zen-note-glyphs'
import type { LyricsSearchMatch } from '@/lib/lyrics-service'
import type { AlignmentResult } from '@/lib/pitch-word-alignment'
import { formatPlaybackSpeed, STEM_MIXER_PLAYBACK_SPEEDS, } from '@/lib/playback-speed-options'
import type { LyricsEditRow } from '@/lib/whisper-lyrics'
import { insertedLineTime, stripInlineWordStamps } from '@/lib/whisper-lyrics'
import { LrcMapperLineList } from './lrc-mapper/LrcMapperLineList'
import { LyricsSongPicker } from './LyricsSongPicker'
import type { LyricsUploadResult } from './LyricsUploader'
import { LyricsUploader } from './LyricsUploader'
import { RestCountdownDots } from './RestCountdownDots'

interface ParsedLyric {
  key: string
  time: number
  endTime: number
  words: string[]
  wordTimes?: number[]
  wordEndTimes?: number[]
  wordSweeps?: Record<number, WordSweepPoint[]>
}

export interface StemMixerLyricsPanelBodyProps {
  // State signals
  lyricsSource: Accessor<string>
  lyricsLoading: Accessor<boolean>
  showSongPicker: Accessor<boolean>
  setShowSongPicker: Setter<boolean>
  songPickerQuery: Accessor<string>
  setSongPickerQuery: Setter<string>
  songMatches: Accessor<LyricsSearchMatch[]>
  lyricsFontSize: Accessor<number>
  setLyricsFontSize: Setter<number>
  lyricsColumns: Accessor<1 | 2>
  setLyricsColumns: Setter<1 | 2>
  lyricsAlign: Accessor<LyricsAlign>
  editMode: Accessor<boolean>
  setEditMode: Setter<boolean>
  setEditBuffer: Setter<WordTimingsMap>
  editPopover: Accessor<{
    lineIdx: number
    wordIdx: number
    word: string
  } | null>
  textEditMode: Accessor<boolean>
  onTextEditSave: (rows: LyricsEditRow[]) => void
  onTextEditCancel: () => void
  lrcGenMode: Accessor<boolean>
  lrcGenLineIdx: Accessor<number>
  lrcGenWordIdx: Accessor<number>
  lrcGenInputMode: Accessor<LrcGenInputMode>
  setLrcGenInputMode: Setter<LrcGenInputMode>
  lrcTimingOffsetMs: Accessor<number>
  setLrcTimingOffsetMs: Setter<number>
  blocks: Accessor<LyricsBlock[]>
  blockInstances: Accessor<BlockInstancesMap>
  blockMarkMode: Accessor<boolean>
  setBlockMarkMode: Setter<boolean>
  markStartLine: Accessor<number | null>
  setMarkStartLine: Setter<number | null>
  markEndLine: Accessor<number | null>
  setMarkEndLine: Setter<number | null>
  blockEditTarget: Accessor<string | null>
  setBlockEditTarget: Setter<string | null>
  currentLineIdx: Accessor<number>
  handleSeekToTime?: (time: number) => void
  lyricsLines: Accessor<string[]>
  lrcLines: Accessor<{ text: string; time: number }[]>

  // Memos
  canonicalLrcLines: Accessor<CanonicalLrcEntry[]>
  stableParsedLyrics: Accessor<Map<number, ParsedLyric>>
  blockStarts: Accessor<Map<number, BlockStartsInfo>>
  displayLines: Accessor<DisplayLine[]>
  genViewData: Accessor<GenViewLine[]>
  hasMultipleSections: Accessor<boolean>

  lrcGenPass: Accessor<LrcGenPass>
  setLrcGenPass: (pass: LrcGenPass) => void
  wordPassProgress: Accessor<{ done: number; total: number }>
  genShiftMs: Accessor<number>
  shiftGenTimings: (deltaMs: number) => number
  previewLineIdx: Accessor<number | null>
  liveHighlight: Accessor<boolean>
  setLiveHighlight: (on: boolean) => void
  highlightWord: Accessor<(PreviewWordHighlight & { lineIdx: number }) | null>
  toggleLinePreview: (idx: number, loop: boolean) => boolean
  setPreviewLoop: (loop: boolean) => void

  // Actions
  handleNextLine: () => void
  handleNextWord: () => void
  handleMarkerSample: (
    lineIdx: number,
    wordIdx: number,
    progress: number,
    elapsedTime: number,
    phase: 'start' | 'move' | 'end',
  ) => void
  handleRedoCurrentLine: () => void
  handleLrcGenFinish: () => void
  handleLrcGenReset: () => void
  handleSaveEdits: () => void
  handleLineTimeEdit: (idx: number, value: string) => void
  getEditWordTime: (lineIdx: number, wordIdx: number) => number
  getEditLineTime: (lineIdx: number) => number
  openWordPopover: (
    lineIdx: number,
    wordIdx: number,
    word: string,
    e: MouseEvent,
  ) => void
  closeWordPopover: () => void
  commitPopoverValue: (value: string) => void
  formatTimeMs: (ms: number) => string
  handleLyricLineClick: (idx: number) => void
  handleMarkBlock: (label: string, repeat: number) => void
  handleUnlinkInstance: (blockId: string, instanceIdx: number) => void
  handleDeleteBlock: (blockId: string) => void
  handleAddInstance: (
    blockId: string,
    startLine: number,
    endLine: number,
  ) => void
  handleEditBlock: (blockId: string, label: string, repeat: number) => void
  getBlockColor: (blockId: string) => string
  getBlockById: (blockId: string) => LyricsBlock | undefined
  getBlockForLine: (lineIdx: number) => BlockInfo | null
  computeActiveWord: (
    words: string[],
    lineTime: number,
    endTime: number,
    wordTimes: number[] | undefined,
    elapsed: number,
    wordEndTimes?: number[],
    wordSweeps?: Record<number, WordSweepPoint[]>,
  ) => { activeUpTo: number; charProgress: number; fraction: number }
  getGenLines: () => string[]

  // Audio
  playing: Accessor<boolean>
  elapsed: Accessor<number>
  playbackSpeed: Accessor<number>
  setPlaybackSpeed: (speed: number) => void
  handlePlay: () => void
  handlePause: () => void

  // Canvas
  formatTime: (t: number) => string

  // Misc
  songTitle: string
  lrclibSearchUrl: Accessor<string | undefined>
  cancelSearch: () => void
  handleLyricsUpload: (result: LyricsUploadResult) => void
  handleSongPick: (match: LyricsSearchMatch) => Promise<void>
  handleSongPickerRefine: () => Promise<void>
  idSuffix?: string
  triggerChangeFile?: () => void

  // Note labels on words
  showLyricNoteLabels: Accessor<boolean>
  alignmentResult: Accessor<AlignmentResult>

  // Loop lyric marking
  loopStartLyricIdx: Accessor<number | null>
  loopEndLyricIdx: Accessor<number | null>
  onSetLoopLyric: (idx: number) => void
}

export const StemMixerLyricsPanelBody: Component<
  StemMixerLyricsPanelBodyProps
> = (props) => {
  const sfx = () => props.idSuffix ?? ''

  const [showCalibration, setShowCalibration] = createSignal(false)
  const [loopPreview, setLoopPreview] = createSignal(false)

  // Pinch-to-zoom font size state
  let lyricsLinesRef: HTMLDivElement | undefined
  let lyricsPinchDist = 0
  let lyricsPinchStartSize = 0

  const handleLyricsTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      lyricsPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
      lyricsPinchStartSize = props.lyricsFontSize()
    }
  }

  const handleLyricsTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 2 || lyricsPinchDist === 0) return
    e.preventDefault()
    const curDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    )
    const ratio = curDist / lyricsPinchDist
    const dampenedRatio = 1 + (ratio - 1) * 0.3
    const newSize = Math.min(
      4,
      Math.max(0.45, lyricsPinchStartSize * dampenedRatio),
    )
    props.setLyricsFontSize(newSize)
  }

  const handleLyricsTouchEnd = () => {
    lyricsPinchDist = 0
  }

  onMount(() => {
    const el = lyricsLinesRef
    if (!el) return
    el.addEventListener('touchstart', handleLyricsTouchStart, {
      passive: false,
    })
    el.addEventListener('touchmove', handleLyricsTouchMove, { passive: false })
    el.addEventListener('touchend', handleLyricsTouchEnd)
  })

  onCleanup(() => {
    const el = lyricsLinesRef
    if (!el) return
    el.removeEventListener('touchstart', handleLyricsTouchStart)
    el.removeEventListener('touchmove', handleLyricsTouchMove)
    el.removeEventListener('touchend', handleLyricsTouchEnd)
  })

  // The mapper list is followed by useLyricsScrollController, which parks the
  // active line at the shared anchor and knows when the user has scrolled away
  // themselves. A second effect here used to scrollIntoView({block:'center'})
  // on the same element for the same reason, so during mapper playback two
  // smooth scrolls raced to different resting positions on every line change.

  // Look up the mapped note for a word by temporal overlap with alignment data
  // The one word-to-note lookup, shared with the zen stage
  // (zen-note-glyphs). It used to live here alone, and the zen copy
  // keyed on display word times instead — which uploaded sheets do not
  // have, so its glyphs vanished while these kept working. One
  // implementation is what stops that recurring.
  const getWordNote = (
    parsedLyric: ParsedLyric,
    wi: number,
  ): { noteName: string; midi: number } | null => {
    if (!props.showLyricNoteLabels()) return null
    return noteForWord(props.alignmentResult().alignedWords, parsedLyric, wi)
  }

  // ── Lyrics text editing ─────────────────────────────────────
  // Local editable copy of the lines, (re)built each time the mode opens.
  // A store keeps row identity stable so typing never recreates the input.
  interface TextEditRowLocal {
    originalIndex: number | null
    time: number | null
    text: string
    rawText: string | null
    dirty: boolean
  }

  const [textRows, setTextRows] = createStore<TextEditRowLocal[]>([])

  createEffect(
    on(
      () => props.textEditMode(),
      (active) => {
        if (!active) return
        const lrc = props.lrcLines()
        if (lrc.length > 0) {
          setTextRows(
            lrc.map((line, i) => ({
              originalIndex: i,
              time: line.time,
              text: stripInlineWordStamps(line.text),
              rawText: line.text,
              dirty: false,
            })),
          )
        } else {
          setTextRows(
            props.lyricsLines().map((line, i) => ({
              originalIndex: i,
              time: null,
              text: line,
              rawText: null,
              dirty: false,
            })),
          )
        }
      },
    ),
  )

  const textEditRowTime = (secs: number): string => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const textEditSaveDisabled = () =>
    textRows.length === 0 || textRows.every((row) => row.text.trim() === '')

  const collectTextEditRows = (): LyricsEditRow[] =>
    textRows.map((row) => ({
      time: row.time,
      text: row.text,
      // A touched or added row is re-emitted from its clean text; untouched
      // rows keep the raw body so inline word stamps survive.
      rawText: row.dirty || row.originalIndex === null ? null : row.rawText,
      originalIndex: row.originalIndex,
    }))

  const deleteTextEditRow = (index: number) => {
    setTextRows(
      produce((rows) => {
        rows.splice(index, 1)
      }),
    )
  }

  const addTextEditRowBelow = (index: number) => {
    setTextRows(
      produce((rows) => {
        const row = rows[index]
        if (row === undefined) return
        const nextTime = rows[index + 1]?.time ?? undefined
        rows.splice(index + 1, 0, {
          originalIndex: null,
          time:
            row.time === null
              ? null
              : insertedLineTime(row.time, nextTime ?? undefined),
          text: '',
          rawText: null,
          dirty: false,
        })
      }),
    )
  }

  return (
    <>
      <Show when={props.lyricsLoading()}>
        <div class="sm-lyrics-loading">
          <div class="sm-lyrics-loading-inner">
            <div class="sm-lyrics-loading-spinner" />
            <div class="sm-lyrics-loading-text">Searching for lyrics...</div>
            <div class="sm-lyrics-loading-actions">
              <button
                class="sm-lyrics-loading-btn sm-lyrics-loading-cancel"
                onClick={() => props.cancelSearch()}
              >
                Cancel
              </button>
              <button
                class="sm-lyrics-loading-btn sm-lyrics-loading-upload"
                onClick={() => {
                  props.cancelSearch()
                  props.triggerChangeFile?.()
                }}
              >
                Upload LRC / TXT
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show
        when={
          !props.lyricsLoading() &&
          props.lyricsSource() !== 'none' &&
          !props.showSongPicker()
        }
      >
        {/* ── LRC Generator toolbar ─────────────────────── */}
        <Show when={props.lrcGenMode()}>
          <div class="sm-lyrics-gen-toolbar">
            {/* Row 1 — what you press while mapping. Row 2 is how it behaves.
                Splitting them keeps the buttons that take a tap-accurate press
                away from the settings that only get touched once a session. */}
            <div class="sm-lyrics-gen-row">
              <Show when={!props.playing()}>
                <button
                  class="sm-lyrics-gen-play-btn"
                  onClick={() => props.handlePlay()}
                  title="Play"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12">
                    <path fill="currentColor" d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </Show>
              <Show when={props.playing()}>
                <button
                  class="sm-lyrics-gen-pause-btn"
                  onClick={() => props.handlePause()}
                  title="Pause"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12">
                    <path
                      fill="currentColor"
                      d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"
                    />
                  </svg>
                </button>
              </Show>
              <span class="sm-lyrics-gen-progress">
                {(() => {
                  // The word pass only stops on lines that have words to
                  // place, so counting every line there would understate it.
                  if (props.lrcGenPass() === 'words') {
                    const { done, total } = props.wordPassProgress()
                    return `${Math.min(done, total)}/${total}`
                  }
                  return `${Math.min(
                    props.lrcGenLineIdx(),
                    props.getGenLines().length,
                  )}/${props.getGenLines().length}`
                })()}
                {(() => {
                  const lines = props.getGenLines()
                  const idx = props.lrcGenLineIdx()
                  if (idx < lines.length) {
                    const wc = lines[idx]
                      .split(/\s+/)
                      .filter((w: string) => w.length > 0).length
                    return (
                      <>
                        {' '}
                        w{Math.min(props.lrcGenWordIdx(), wc)}/{wc}
                      </>
                    )
                  }
                  return null
                })()}
              </span>
              {(() => {
                const idx = props.lrcGenLineIdx()
                const lines = props.getGenLines()
                if (idx < lines.length) {
                  const bi = props.getBlockForLine(idx)
                  if (bi) {
                    const block = props.getBlockById(bi.blockId)
                    const total =
                      props.blockInstances()[bi.blockId]?.length ?? 1
                    if (block) {
                      return (
                        <span class="sm-lyrics-gen-instance-badge">
                          {block.label} ({bi.instanceIdx + 1}/{total})
                        </span>
                      )
                    }
                  }
                }
                return null
              })()}
              <Show when={props.lrcGenInputMode() === 'tap'}>
                <button
                  class="sm-lyrics-gen-nextword-btn"
                  onClick={() => props.handleNextWord()}
                  title="Stamp the next word onset [W]"
                >
                  Next Word
                </button>
                <button
                  class="sm-lyrics-gen-nextline-btn"
                  onClick={() => props.handleNextLine()}
                  title="Stamp the next line onset [L]"
                >
                  Next Line
                </button>
              </Show>
              <button
                class="sm-lyrics-gen-redo-btn"
                onClick={() => props.handleRedoCurrentLine()}
                title="Clear and replay the current line"
              >
                Redo line
              </button>
              <span class="sm-lyrics-gen-row-gap" />
              <button
                class="sm-lyrics-gen-finish-btn"
                onClick={() => props.handleLrcGenFinish()}
                title="Save LRC"
              >
                Finish
              </button>
              <button
                class="sm-lyrics-gen-reset-btn"
                onClick={() => props.handleLrcGenReset()}
                title="Restore the lyrics and timings from before this mapping session"
              >
                Discard changes
              </button>
            </div>

            <div class="sm-lyrics-gen-row sm-lyrics-gen-row--settings">
              <div class="sm-lyrics-gen-field">
                <span class="sm-lyrics-gen-field-label">Map</span>
                <div
                  class="sm-lyrics-gen-mode-switch"
                  role="group"
                  aria-label="Mapping pass"
                >
                  <button
                    classList={{
                      'sm-lyrics-gen-mode-btn': true,
                      'sm-lyrics-gen-mode-btn--active':
                        props.lrcGenPass() === 'all',
                    }}
                    aria-pressed={props.lrcGenPass() === 'all'}
                    onClick={() => props.setLrcGenPass('all')}
                    title="Everything in one go — each tap places the next word, and a line's first word places its start"
                  >
                    All
                  </button>
                  <button
                    classList={{
                      'sm-lyrics-gen-mode-btn': true,
                      'sm-lyrics-gen-mode-btn--active':
                        props.lrcGenPass() === 'lines',
                    }}
                    aria-pressed={props.lrcGenPass() === 'lines'}
                    onClick={() => props.setLrcGenPass('lines')}
                    title="Place the start of each line only"
                  >
                    Lines
                  </button>
                  <button
                    classList={{
                      'sm-lyrics-gen-mode-btn': true,
                      'sm-lyrics-gen-mode-btn--active':
                        props.lrcGenPass() === 'words',
                    }}
                    aria-pressed={props.lrcGenPass() === 'words'}
                    onClick={() => props.setLrcGenPass('words')}
                    title="Line starts are frozen; place the words inside each line"
                  >
                    Words
                  </button>
                </div>
              </div>
              <div class="sm-lyrics-gen-field">
                <span class="sm-lyrics-gen-field-label">Input</span>
                <div
                  class="sm-lyrics-gen-mode-switch"
                  role="group"
                  aria-label="Lyric mapping input"
                >
                  <button
                    classList={{
                      'sm-lyrics-gen-mode-btn': true,
                      'sm-lyrics-gen-mode-btn--active':
                        props.lrcGenInputMode() === 'marker',
                    }}
                    aria-pressed={props.lrcGenInputMode() === 'marker'}
                    onClick={() => props.setLrcGenInputMode('marker')}
                  >
                    Marker
                  </button>
                  <button
                    classList={{
                      'sm-lyrics-gen-mode-btn': true,
                      'sm-lyrics-gen-mode-btn--active':
                        props.lrcGenInputMode() === 'tap',
                    }}
                    aria-pressed={props.lrcGenInputMode() === 'tap'}
                    onClick={() => props.setLrcGenInputMode('tap')}
                  >
                    Tap
                  </button>
                </div>
              </div>
              <label
                class="sm-lyrics-gen-toggle"
                title="While the song plays, light the words from the timings you have mapped so far — the same highlighting you get outside the mapper"
              >
                <input
                  type="checkbox"
                  checked={props.liveHighlight()}
                  onChange={(e) =>
                    props.setLiveHighlight(e.currentTarget.checked)
                  }
                />
                <span>Live highlight</span>
              </label>
              <label
                class="sm-lyrics-gen-toggle"
                title="When you preview a line with its play button, repeat it instead of stopping at the end"
              >
                <input
                  type="checkbox"
                  checked={loopPreview()}
                  onChange={(e) => {
                    const on = e.currentTarget.checked
                    setLoopPreview(on)
                    // Apply to a preview that is already running, so the toggle
                    // is never a control that appears to do nothing.
                    props.setPreviewLoop(on)
                  }}
                />
                <span>Repeat line</span>
              </label>
              <label class="sm-lyrics-gen-speed">
                <span>Speed</span>
                <SafeSelect
                  class="sm-lyrics-gen-speed-select"
                  value={String(props.playbackSpeed())}
                  onChange={(e) =>
                    props.setPlaybackSpeed(Number(e.currentTarget.value))
                  }
                  aria-label="Mapping playback speed"
                >
                  <For each={STEM_MIXER_PLAYBACK_SPEEDS}>
                    {(speed) => (
                      <option value={speed}>
                        {formatPlaybackSpeed(speed)}
                      </option>
                    )}
                  </For>
                </SafeSelect>
              </label>
              <label class="sm-lyrics-gen-offset">
                <span>Reaction</span>
                <input
                  type="number"
                  min="0"
                  max="500"
                  step="10"
                  value={props.lrcTimingOffsetMs()}
                  onChange={(e) => {
                    const value = Number(e.currentTarget.value)
                    props.setLrcTimingOffsetMs(
                      Number.isFinite(value)
                        ? Math.max(0, Math.min(500, value))
                        : 0,
                    )
                  }}
                  aria-label="Reaction correction in milliseconds"
                />
                <span>ms</span>
                <button
                  class="sm-lyrics-gen-calib-btn"
                  onClick={() => setShowCalibration((prev) => !prev)}
                  aria-expanded={showCalibration()}
                  title="Measure your reaction time instead of guessing it"
                >
                  Calibrate
                </button>
              </label>
              {/* Reaction corrects the taps you are about to make. This moves
                  the ones already placed — a different job, so it gets its own
                  field rather than another number in that one. */}
              <div
                class="sm-lyrics-gen-shift"
                role="group"
                aria-label="Shift every mapped timing"
              >
                <span class="sm-lyrics-gen-field-label">Shift all</span>
                <For each={[-100, -10] as const}>
                  {(step) => (
                    <button
                      class="sm-lyrics-gen-shift-btn"
                      onClick={() => props.shiftGenTimings(step)}
                      title={`Move every mapped timing ${-step} ms earlier`}
                    >
                      {step}
                    </button>
                  )}
                </For>
                <span
                  class="sm-lyrics-gen-shift-readout"
                  aria-live="polite"
                  title="How far this session has moved the whole mapping"
                >
                  {props.genShiftMs() > 0 ? '+' : ''}
                  {props.genShiftMs()} ms
                </span>
                <For each={[10, 100] as const}>
                  {(step) => (
                    <button
                      class="sm-lyrics-gen-shift-btn"
                      onClick={() => props.shiftGenTimings(step)}
                      title={`Move every mapped timing ${step} ms later`}
                    >
                      +{step}
                    </button>
                  )}
                </For>
                <button
                  class="sm-lyrics-gen-shift-btn"
                  disabled={props.genShiftMs() === 0}
                  onClick={() => props.shiftGenTimings(-props.genShiftMs())}
                  title="Undo this session's shift"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
          <Show when={showCalibration()}>
            <TapCalibrationPanel
              currentOffsetMs={props.lrcTimingOffsetMs()}
              onApply={(ms) => props.setLrcTimingOffsetMs(ms)}
              onClose={() => setShowCalibration(false)}
            />
          </Show>
          <div class="sm-lyrics-gen-guidance" role="note">
            <Show
              when={props.lrcGenPass() === 'lines'}
              fallback={
                <>
                  <Show
                    when={props.lrcGenInputMode() === 'marker'}
                    fallback={
                      <>
                        Tap at the first audible sound of each word, not after
                        the singer finishes it. Use Next Line only to skip the
                        remaining words.
                      </>
                    }
                  >
                    Press the highlighted word when its first sound begins, then
                    drag through the text as it is sung. Hold still on long
                    vowels and lift at a pause or after the final sound.
                  </Show>
                  <Show when={props.lrcGenPass() === 'words'}>
                    {' '}
                    Line starts are frozen, so the cursor begins at the second
                    word and single-word lines are skipped.
                  </Show>
                </>
              }
            >
              Lines — place only the start of each line. Fetched lyrics usually
              have these already, so play through and re-tap only the lines that
              drift, then switch to Words. Map everything in one stream with
              All.
            </Show>
            <span class="sm-lyrics-gen-guidance-performance">
              Pitch and live monitors pause for smoother input; the vocal
              overview stays active. Discard changes restores your pre-mapping
              snapshot.
            </span>
          </div>
        </Show>

        {/* ── LRC Generator view ────────────────────────── */}
        <Show when={props.lrcGenMode()}>
          <LrcMapperLineList
            blockInstances={props.blockInstances}
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
            loopPreview={loopPreview}
            lrcGenInputMode={props.lrcGenInputMode}
            lrcGenLineIdx={props.lrcGenLineIdx}
            lrcGenWordIdx={props.lrcGenWordIdx}
            lyricsFontSize={props.lyricsFontSize}
            playing={props.playing}
            previewLineIdx={props.previewLineIdx}
            setLyricsFontSize={props.setLyricsFontSize}
            toggleLinePreview={props.toggleLinePreview}
          />
        </Show>

        {/* ── Edit mode toolbar ────────────────────────── */}
        <Show when={props.editMode()}>
          <div class="sm-lyrics-edit-toolbar">
            <button
              class="sm-lyrics-save-btn"
              onClick={() => props.handleSaveEdits()}
            >
              Save
            </button>
            <button
              class="sm-lyrics-cancel-btn"
              onClick={() => {
                props.setEditBuffer({})
                props.setEditMode(false)
              }}
            >
              Cancel
            </button>
          </div>
        </Show>

        {/* ── Edit mode view ───────────────────────────── */}
        <Show when={props.editMode()}>
          <div
            class="sm-lyrics-lines sm-lyrics-lines-edit"
            style={{ 'font-size': `${props.lyricsFontSize()}rem` }}
            onWheel={(e) => {
              e.stopPropagation()
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                props.setLyricsFontSize((prev) =>
                  Math.min(
                    3,
                    Math.max(0.45, +(prev - e.deltaY * 0.001).toFixed(2)),
                  ),
                )
              }
            }}
          >
            <For each={props.canonicalLrcLines()}>
              {(entry) => {
                if (entry.type === 'rest') {
                  return (
                    <div class="sm-lyrics-line-edit sm-lyrics-line-rest">
                      <span class="sm-lyrics-time-input sm-time-display">
                        {props.formatTimeMs(entry.time)}
                      </span>
                      <span class="sm-lyrics-rest-label">~Rest~</span>
                    </div>
                  )
                }
                const lineIdx = entry.lrcIndex
                return (
                  <div class="sm-lyrics-line-edit">
                    <input
                      class="sm-lyrics-time-input"
                      type="text"
                      value={props.formatTimeMs(props.getEditLineTime(lineIdx))}
                      onChange={(e) =>
                        props.handleLineTimeEdit(lineIdx, e.currentTarget.value)
                      }
                    />
                    <For each={entry.words}>
                      {(word, wi) => (
                        <span class="sm-lyrics-word-edit">
                          <span class="sm-lyrics-word-text">{word}</span>
                          <span
                            class="sm-lyrics-word-time-label"
                            onClick={(e) =>
                              props.openWordPopover(lineIdx, wi(), word, e)
                            }
                          >
                            {props.formatTimeMs(
                              props.getEditWordTime(lineIdx, wi()),
                            )}
                          </span>
                        </span>
                      )}
                    </For>
                  </div>
                )
              }}
            </For>
          </div>

          {/* ── Word time edit popover ──────────────── */}
          <Show when={props.editPopover() !== null}>
            <div
              class="sm-lyrics-popover-backdrop"
              onClick={() => props.closeWordPopover()}
            >
              <div
                class="sm-lyrics-popover-card"
                onClick={(e) => e.stopPropagation()}
              >
                <div class="sm-lyrics-popover-word">
                  {props.editPopover()!.word}
                </div>
                <input
                  class="sm-lyrics-popover-input"
                  type="text"
                  value={
                    props.editPopover()
                      ? props.formatTimeMs(
                          props.getEditWordTime(
                            props.editPopover()!.lineIdx,
                            props.editPopover()!.wordIdx,
                          ),
                        )
                      : ''
                  }
                  onChange={(e) =>
                    props.commitPopoverValue(e.currentTarget.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') props.closeWordPopover()
                    if (e.key === 'Enter')
                      props.commitPopoverValue(e.currentTarget.value)
                  }}
                  ref={(el) => {
                    setTimeout(() => (el as HTMLInputElement)?.select(), 10)
                  }}
                />
                <div class="sm-lyrics-popover-hint">
                  Enter time (MM:SS) – press Enter or click outside to save
                </div>
              </div>
            </div>
          </Show>
        </Show>

        {/* ── Lyrics text editor ───────────────────────── */}
        <Show
          when={
            props.textEditMode() && !props.editMode() && !props.lrcGenMode()
          }
        >
          <div class="sm-lyrics-textedit-toolbar">
            <span class="sm-lyrics-textedit-title">Edit lyrics</span>
            <button
              class="sm-lyrics-cancel-btn"
              onClick={() => props.onTextEditCancel()}
            >
              Cancel
            </button>
            <button
              class="sm-lyrics-save-btn"
              disabled={textEditSaveDisabled()}
              onClick={() => props.onTextEditSave(collectTextEditRows())}
            >
              Save
            </button>
          </div>
          <div class="sm-lyrics-textedit-list">
            <For each={textRows}>
              {(row, i) => (
                <div class="sm-lyrics-textedit-row">
                  <Show when={row.time !== null}>
                    <span class="sm-lyrics-textedit-time">
                      {textEditRowTime(row.time ?? 0)}
                    </span>
                  </Show>
                  <Show
                    when={row.rawText === '~Rest~'}
                    fallback={
                      <input
                        class="sm-lyrics-textedit-input"
                        type="text"
                        value={row.text}
                        onInput={(e) =>
                          setTextRows(i(), {
                            text: e.currentTarget.value,
                            dirty: true,
                          })
                        }
                      />
                    }
                  >
                    <span class="sm-lyrics-textedit-rest">Rest</span>
                  </Show>
                  <button
                    class="sm-lyrics-textedit-del"
                    title="Delete line"
                    aria-label="Delete line"
                    onClick={() => deleteTextEditRow(i())}
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11">
                      <path
                        fill="currentColor"
                        d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                      />
                    </svg>
                  </button>
                  <button
                    class="sm-lyrics-textedit-add"
                    title="Add a line below"
                    aria-label="Add a line below"
                    onClick={() => addTextEditRowBelow(i())}
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11">
                      <path
                        fill="currentColor"
                        d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* ── Normal view ──────────────────────────────── */}
        <Show
          when={
            !props.editMode() && !props.lrcGenMode() && !props.textEditMode()
          }
        >
          {/* ── Block edit popover ─────────────────────── */}
          <Show when={props.blockEditTarget() !== null}>
            <div class="sm-lyrics-block-edit-popover">
              {(() => {
                const b = props.getBlockById(props.blockEditTarget()!)
                if (!b) return null
                return (
                  <>
                    <input
                      type="text"
                      class="sm-lyrics-block-form-label"
                      value={b.label}
                      id={`block-edit-label-input${sfx()}`}
                    />
                    <input
                      type="number"
                      class="sm-lyrics-block-form-repeat"
                      value={b.repeatCount}
                      min="1"
                      max="20"
                      id={`block-edit-repeat-input${sfx()}`}
                      title="Repeat count"
                    />
                    <button
                      class="sm-lyrics-block-form-btn"
                      onClick={() => {
                        const label =
                          (
                            document.getElementById(
                              `block-edit-label-input${sfx()}`,
                            ) as HTMLInputElement
                          )?.value?.trim() || b.label
                        const repeat = parseInt(
                          (
                            document.getElementById(
                              `block-edit-repeat-input${sfx()}`,
                            ) as HTMLInputElement
                          )?.value || '1',
                          10,
                        )
                        props.handleEditBlock(b.id, label, repeat)
                      }}
                    >
                      Save
                    </button>
                    <button
                      class="sm-lyrics-block-form-cancel"
                      onClick={() => props.setBlockEditTarget(null)}
                    >
                      Cancel
                    </button>
                    <button
                      class="sm-lyrics-block-delete-btn"
                      onClick={() => props.handleDeleteBlock(b.id)}
                      title="Delete block"
                    >
                      <svg viewBox="0 0 24 24" width="10" height="10">
                        <path
                          fill="currentColor"
                          d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                        />
                      </svg>
                    </button>
                  </>
                )
              })()}
            </div>
          </Show>

          {/* ── Mark mode toolbar ─────────────────────── */}
          <Show when={props.blockMarkMode()}>
            <div class="sm-lyrics-mark-toolbar">
              <span class="sm-lyrics-mark-status">
                {props.markStartLine() === null
                  ? 'Select a range of lines'
                  : props.markEndLine() === null
                    ? `Line ${props.markStartLine()! + 1} — click end line`
                    : `${props.markEndLine()! - props.markStartLine()!} line${props.markEndLine()! - props.markStartLine()! !== 1 ? 's' : ''} selected`}
              </span>
              <Show
                when={
                  props.markStartLine() !== null && props.markEndLine() !== null
                }
              >
                <div class="sm-lyrics-mark-actions">
                  <input
                    type="text"
                    class="sm-lyrics-block-form-label"
                    placeholder="Chorus, Verse 1..."
                    id={`block-label-input${sfx()}`}
                  />
                  <input
                    type="number"
                    class="sm-lyrics-block-form-repeat"
                    value="1"
                    min="1"
                    max="20"
                    id={`block-repeat-input${sfx()}`}
                    title="Repeat count"
                  />
                  <button
                    class="sm-lyrics-block-form-btn"
                    onClick={() => {
                      const label =
                        (
                          document.getElementById(
                            `block-label-input${sfx()}`,
                          ) as HTMLInputElement
                        )?.value?.trim() || 'Block'
                      const repeat = parseInt(
                        (
                          document.getElementById(
                            `block-repeat-input${sfx()}`,
                          ) as HTMLInputElement
                        )?.value || '1',
                        10,
                      )
                      props.handleMarkBlock(label, repeat)
                    }}
                  >
                    Mark as New Block
                  </button>
                  <Show when={props.blocks().length > 0}>
                    <SafeSelect
                      class="sm-lyrics-mark-add-select"
                      onChange={(e) => {
                        const val = e.currentTarget.value
                        if (val)
                          props.handleAddInstance(
                            val,
                            props.markStartLine()!,
                            props.markEndLine()!,
                          )
                      }}
                    >
                      <option value="">Add to existing block...</option>
                      <For each={props.blocks()}>
                        {(b) => <option value={b.id}>{b.label}</option>}
                      </For>
                    </SafeSelect>
                  </Show>
                </div>
              </Show>
              <button
                class="sm-lyrics-mark-toolbar-cancel"
                onClick={() => {
                  props.setMarkStartLine(null)
                  props.setMarkEndLine(null)
                  props.setBlockMarkMode(false)
                }}
              >
                Cancel
              </button>
            </div>
          </Show>

          <div
            class="sm-lyrics-lines"
            classList={{
              'sm-lyrics-columns-2': props.lyricsColumns() === 2,
              'sm-lyrics-lines--marking': props.blockMarkMode(),
            }}
            style={{
              'font-size': `${props.lyricsFontSize()}rem`,
              'text-align': props.lyricsAlign(),
            }}
            onContextMenu={(e) => e.preventDefault()}
            onWheel={(e) => {
              e.stopPropagation()
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                props.setLyricsFontSize((prev) =>
                  Math.min(
                    4,
                    Math.max(0.45, +(prev - e.deltaY * 0.001).toFixed(2)),
                  ),
                )
              }
            }}
            ref={lyricsLinesRef}
          >
            <For each={props.displayLines()}>
              {(dl: DisplayLine) => {
                if (dl.isBlank) {
                  return (
                    <div
                      class="sm-lyrics-line-spacer"
                      style={{ height: `${props.lyricsFontSize() * 0.5}rem` }}
                    />
                  )
                }

                if (dl.isRest) {
                  const gapStart = dl.restGapStart ?? 0
                  const gapEnd = dl.restGapEnd ?? 0
                  const dotCount = dl.restDotCount ?? 0
                  // Countdown only for a real, sized gap (word-level timing);
                  // otherwise keep the simple rest marker.
                  if (dotCount > 0 && gapEnd > gapStart) {
                    const active = () =>
                      props.elapsed() >= gapStart && props.elapsed() < gapEnd
                    return (
                      <div
                        class="sm-lyrics-rest"
                        data-lyrics-index={dl.lyricsIndex}
                        classList={{ 'sm-lyrics-rest--active': active() }}
                        style={{
                          'font-size': `${props.lyricsFontSize()}rem`,
                          'justify-content':
                            props.lyricsAlign() === 'center'
                              ? 'center'
                              : props.lyricsAlign() === 'right'
                                ? 'flex-end'
                                : 'flex-start',
                        }}
                      >
                        <RestCountdownDots
                          dotCount={dotCount}
                          elapsed={props.elapsed}
                          gapEnd={gapEnd}
                          gapStart={gapStart}
                          onSeek={props.handleSeekToTime}
                        />
                      </div>
                    )
                  }
                  return (
                    <div
                      class="sm-lyrics-rest"
                      data-lyrics-index={dl.lyricsIndex}
                      style={{
                        'font-size': `${props.lyricsFontSize()}rem`,
                        'justify-content':
                          props.lyricsAlign() === 'center'
                            ? 'center'
                            : props.lyricsAlign() === 'right'
                              ? 'flex-end'
                              : 'flex-start',
                      }}
                    >
                      <span
                        class="sm-lyrics-rest-dots"
                        aria-label="Rest"
                        role="img"
                      >
                        <span
                          class="sm-lyrics-rest-dot"
                          style={{ '--fill': '0%' }}
                        />
                      </span>
                    </div>
                  )
                }

                const idx = dl.lyricsIndex
                const parsedLyric = props.stableParsedLyrics().get(idx)
                if (!parsedLyric) return null

                const blockInfo = () => props.blockStarts().get(idx)
                const blockForLine = () => props.getBlockForLine(idx)
                const blockColor = () =>
                  blockForLine()
                    ? props.getBlockColor(blockForLine()!.blockId)
                    : undefined
                const isMarkSelected = () =>
                  props.blockMarkMode() &&
                  props.markStartLine() !== null &&
                  props.markEndLine() !== null &&
                  idx >= props.markStartLine()! &&
                  idx < props.markEndLine()!

                const isLoopA = () => props.loopStartLyricIdx() === idx
                const isLoopB = () => props.loopEndLyricIdx() === idx
                const isLoopRange = () => {
                  const a = props.loopStartLyricIdx()
                  const b = props.loopEndLyricIdx()
                  return a !== null && b !== null && idx > a && idx < b
                }

                const isActive = () => idx === props.currentLineIdx()
                const activeWordInfo = () =>
                  isActive()
                    ? props.computeActiveWord(
                        parsedLyric.words,
                        parsedLyric.time,
                        parsedLyric.endTime,
                        parsedLyric.wordTimes,
                        props.elapsed(),
                        parsedLyric.wordEndTimes,
                        parsedLyric.wordSweeps,
                      )
                    : { activeUpTo: -1, charProgress: 0, fraction: 0 }

                return (
                  <>
                    {blockInfo() && (
                      <div
                        class={`sm-lyrics-block-badge ${blockInfo()!.isTemplate ? 'sm-lyrics-block-badge--template' : 'sm-lyrics-block-badge--instance'}`}
                        style={{
                          '--block-color': blockInfo()!.color,
                          'margin-top': '0.4rem',
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!props.blockMarkMode()) {
                            props.setBlockEditTarget(blockInfo()!.blockId)
                          }
                        }}
                      >
                        {blockInfo()!.label}
                        {blockInfo()!.isTemplate &&
                          blockInfo()!.repeatCount > 1 && (
                            <span class="sm-lyrics-block-repeat">
                              x{blockInfo()!.repeatCount}
                            </span>
                          )}
                        {!blockInfo()!.isTemplate && (
                          <span
                            class="sm-lyrics-block-unlink"
                            onClick={(e) => {
                              e.stopPropagation()
                              props.handleUnlinkInstance(
                                blockInfo()!.blockId,
                                blockInfo()!.instanceIdx,
                              )
                            }}
                            title="Unlink this instance"
                          >
                            x
                          </span>
                        )}
                      </div>
                    )}
                    <span
                      class={`sm-lyrics-line${isActive() ? ' sm-lyrics-line-active' : ''}${blockForLine() ? ' sm-lyrics-line--blocked' : ''}${blockForLine() && !blockForLine()!.isTemplate ? ' sm-lyrics-line--block-instance' : ''}${props.blockMarkMode() ? ' sm-lyrics-line-markable' : ''}${isMarkSelected() ? ' sm-lyrics-line-mark-selected' : ''}${isLoopA() ? ' sm-lyrics-line--loop-a' : ''}${isLoopB() ? ' sm-lyrics-line--loop-b' : ''}${isLoopRange() ? ' sm-lyrics-line--loop-range' : ''}`}
                      data-lyrics-index={idx}
                      style={
                        blockColor() !== undefined
                          ? { '--block-color': blockColor() }
                          : {}
                      }
                      onClick={() => {
                        if (props.blockMarkMode()) {
                          const start = props.markStartLine()
                          if (start === null) {
                            props.setMarkStartLine(idx)
                            props.setMarkEndLine(null)
                          } else if (props.markEndLine() !== null) {
                            props.setMarkStartLine(idx)
                            props.setMarkEndLine(null)
                          } else {
                            if (idx > start) {
                              props.setMarkEndLine(idx + 1)
                            } else if (idx < start) {
                              props.setMarkStartLine(idx)
                              props.setMarkEndLine(start + 1)
                            } else {
                              props.setMarkEndLine(start + 1)
                            }
                          }
                        } else {
                          props.handleLyricLineClick(idx)
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        if (!props.blockMarkMode()) {
                          props.onSetLoopLyric(idx)
                        }
                      }}
                    >
                      {isLoopA() && (
                        <span class="sm-lyrics-loop-badge sm-lyrics-loop-badge--a">
                          A
                        </span>
                      )}
                      {isLoopB() && (
                        <span class="sm-lyrics-loop-badge sm-lyrics-loop-badge--b">
                          B
                        </span>
                      )}
                      {blockForLine() && !blockForLine()!.isTemplate && (
                        <span
                          class="sm-lyrics-block-unlink"
                          onClick={(e) => {
                            e.stopPropagation()
                            props.handleUnlinkInstance(
                              blockForLine()!.blockId,
                              blockForLine()!.instanceIdx,
                            )
                          }}
                          title="Unlink this instance"
                        >
                          x
                        </span>
                      )}
                      <span class="sm-lyrics-time">
                        {props.formatTime(parsedLyric.time)}
                      </span>
                      {parsedLyric.words.length === 0
                        ? parsedLyric.key.startsWith('lrc-')
                          ? props.lrcLines()[idx]?.text || ''
                          : props.lyricsLines()[idx] || ''
                        : parsedLyric.words.map((word, wi) => {
                            const noteInfo = getWordNote(parsedLyric, wi)
                            const noteLabel = noteInfo ? (
                              <span class="sm-lyrics-word-note">
                                {noteInfo.noteName}
                              </span>
                            ) : (
                              <span class="sm-lyrics-word-note sm-lyrics-word-note-spacer">
                                {'\u00A0'}
                              </span>
                            )
                            if (wi <= activeWordInfo().activeUpTo) {
                              return (
                                <>
                                  <span class="sm-lyrics-word-with-note">
                                    {noteLabel}
                                    <span class="sm-lyrics-word sm-lyrics-word-done">
                                      {word}
                                    </span>
                                  </span>{' '}
                                </>
                              )
                            }
                            if (
                              wi === activeWordInfo().activeUpTo + 1 &&
                              activeWordInfo().fraction > 0
                            ) {
                              return (
                                <>
                                  <span class="sm-lyrics-word-with-note">
                                    {noteLabel}
                                    <span
                                      class="sm-lyrics-word sm-lyrics-word-current"
                                      style={{
                                        '--word-progress': `${(
                                          activeWordInfo().fraction * 100
                                        ).toFixed(1)}%`,
                                      }}
                                    >
                                      {word}
                                    </span>
                                  </span>{' '}
                                </>
                              )
                            }
                            return (
                              <>
                                <span class="sm-lyrics-word-with-note">
                                  {noteLabel}
                                  <span class="sm-lyrics-word">{word}</span>
                                </span>{' '}
                              </>
                            )
                          })}
                    </span>
                  </>
                )
              }}
            </For>
          </div>
        </Show>
      </Show>

      <Show
        when={
          !props.lyricsLoading() &&
          (props.lyricsSource() === 'none' || props.showSongPicker())
        }
      >
        <Show
          when={props.showSongPicker()}
          fallback={
            <LyricsUploader
              onUpload={props.handleLyricsUpload}
              suggestion={props.songTitle}
              searchUrl={props.lrclibSearchUrl()}
            />
          }
        >
          <LyricsSongPicker
            variant="panel"
            autoFocus
            matches={props.songMatches()}
            query={props.songPickerQuery()}
            onQueryChange={props.setSongPickerQuery}
            onPick={(m) => {
              void props.handleSongPick(m)
            }}
            onRefine={() => {
              void props.handleSongPickerRefine()
            }}
            onUploadFile={() => {
              props.triggerChangeFile?.()
            }}
            onPasteText={(text, isLrc) => {
              const baseName = props.songTitle
                ? props.songTitle.replace(/[^a-zA-Z0-9_-]/g, '_')
                : 'clipboard'
              props.handleLyricsUpload({
                text,
                format: isLrc ? 'lrc' : 'txt',
                filename: `${baseName}.${isLrc ? 'lrc' : 'txt'}`,
              })
            }}
            onCancel={() => props.setShowSongPicker(false)}
          />
        </Show>
      </Show>
    </>
  )
}
