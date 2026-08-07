// ============================================================
// StemMixer Lyrics Controller — lyrics/LRC gen/blocks state + actions
// ============================================================

import type { Accessor, Setter } from 'solid-js'
import { createMemo, createSignal, onCleanup, untrack } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'

export type LyricsAlign = 'left' | 'center' | 'right'
import type { LyricsData } from '@/db/services/lyrics-db-service'
import { deleteLyricsFromDb, loadLyricsFromDb, saveLyricsToDb, } from '@/db/services/lyrics-db-service'
import type { RepeatRange } from '@/lib/canonical-lrc'
import { applyRepeatBlocks, buildCanonicalEntries } from '@/lib/canonical-lrc'
import { buildLrcTextFromCanonical, buildWordLevelLrc, formatTimeLrc, } from '@/lib/lrc-generator'
import { parseLrcTimingMetadata, withLrcTimingMetadata, } from '@/lib/lrc-timing-metadata'
import type { SungNote } from '@/lib/lyric-sung-end'
import { clampLineEndToVocal, synthesizeLastWordEnd, } from '@/lib/lyric-sung-end'
import type { LrcLine, LyricsSearchMatch, LyricsSearchResult, } from '@/lib/lyrics-service'
import { computeActiveWord, extractTitle, fetchLyricsById, getCurrentLineIndex, parseLrcFile, parseTextLyrics, searchLyrics, searchLyricsMulti, } from '@/lib/lyrics-service'
import type { LyricsVersion, LyricsVersionKind } from '@/lib/lyrics-versions'
import { findVersion, removeVersion, synthesizeVersions, upsertVersion, } from '@/lib/lyrics-versions'
import type { LyricsEditRow } from '@/lib/whisper-lyrics'
import { buildEditedLrc, segmentsToLrc } from '@/lib/whisper-lyrics'
import type { WhisperSegment } from '@/lib/whisper-service'
import type { LrcGenPass, PreviewWordHighlight } from './lrc-gen-passes'
import type { BlockInstancesMap, BlockStartsInfo, CanonicalLrcEntry, DisplayLine, EditPopover, GenViewLine, LrcGenInputMode, LyricsBlock, LyricsSource, LyricsTimingExtension, LyricsUploadResult, WordSweepPoint, WordSweepTimingsMap, WordTimingsMap, } from './types'
import { useLrcGenController } from './useLrcGenController'
import { useLyricsBlocksController } from './useLyricsBlocksController'
import { useLyricsScrollController } from './useLyricsScrollController'

// ── Deps ──────────────────────────────────────────────────────────

export interface StemMixerLyricsDeps {
  sessionId: string
  songTitle: string
  duration: () => number
  playing: () => boolean
  elapsed: () => number
  seekToWithWindow: (t: number) => void
  /** Starting font size in rem (default 1.3) — the standalone karaoke stage
   *  opens much bigger. A-/A+ still adjust from there. */
  defaultFontSize?: number
  /** Alignment default + storage key override, so the standalone page can
   *  default to centered lyrics without touching the studio preference. */
  defaultAlign?: LyricsAlign
  alignPrefsKey?: string
  /** Analyzed melody notes (seconds) — lets the display clamp a line's
   *  highlight to when the vocal actually finishes, instead of stretching
   *  the last word across the silence before the next line. Optional: hosts
   *  without pitch analysis keep the estimate-based behavior. */
  melodyNotes?: () => SungNote[]
}

// ── Controller return type ────────────────────────────────────────

export interface StemMixerLyricsController {
  // Signals
  lyricsLines: () => string[]
  setLyricsLines: Setter<string[]>
  lrcLines: () => LrcLine[]
  setLrcLines: Setter<LrcLine[]>
  rawLyricsText: () => string
  setRawLyricsText: Setter<string>
  currentLineIdx: () => number
  setCurrentLineIdx: Setter<number>
  lyricsSource: () => LyricsSource
  lyricsLoading: () => boolean
  songMatches: () => LyricsSearchMatch[]
  showSongPicker: () => boolean
  setShowSongPicker: Setter<boolean>
  songPickerQuery: () => string
  setSongPickerQuery: Setter<string>
  lyricsFontSize: () => number
  setLyricsFontSize: Setter<number>
  lyricsColumns: () => 1 | 2
  setLyricsColumns: Setter<1 | 2>
  lyricsAlign: () => LyricsAlign
  setLyricsAlign: Setter<LyricsAlign>
  editMode: () => boolean
  setEditMode: Setter<boolean>
  wordTimings: () => WordTimingsMap
  setWordTimings: Setter<WordTimingsMap>
  wordEndTimings: () => WordTimingsMap
  wordSweepTimings: () => WordSweepTimingsMap
  editBuffer: () => WordTimingsMap
  setEditBuffer: Setter<WordTimingsMap>
  editPopover: () => EditPopover | null
  setEditPopover: Setter<EditPopover | null>
  lrcGenMode: () => boolean
  lrcGenInputMode: () => LrcGenInputMode
  setLrcGenInputMode: Setter<LrcGenInputMode>
  lrcGenPass: () => LrcGenPass
  setLrcGenPass: (pass: LrcGenPass) => void
  wordPassProgress: () => { done: number; total: number }
  genShiftMs: () => number
  shiftGenTimings: (deltaMs: number) => number
  previewLineIdx: () => number | null
  previewLoop: () => boolean
  setPreviewLoop: (loop: boolean) => void
  liveHighlight: () => boolean
  setLiveHighlight: (on: boolean) => void
  highlightWord: () => (PreviewWordHighlight & { lineIdx: number }) | null
  toggleLinePreview: (idx: number, loop: boolean) => boolean
  stopLinePreview: () => void
  lrcTimingOffsetMs: () => number
  setLrcTimingOffsetMs: Setter<number>
  lrcGenLineIdx: () => number
  lrcGenWordIdx: () => number
  lrcGenLineTimes: () => (number | undefined)[]
  lrcGenWordTimings: () => WordTimingsMap
  lrcGenWordEndTimings: () => WordTimingsMap
  lrcGenWordSweepTimings: () => WordSweepTimingsMap
  setLrcGenLineTimes: Setter<(number | undefined)[]>
  setLrcGenWordTimings: Setter<WordTimingsMap>
  blocks: () => LyricsBlock[]
  setBlocks: Setter<LyricsBlock[]>
  blockInstances: () => BlockInstancesMap
  setBlockInstances: Setter<BlockInstancesMap>
  blockMarkMode: () => boolean
  setBlockMarkMode: Setter<boolean>
  markStartLine: () => number | null
  setMarkStartLine: Setter<number | null>
  markEndLine: () => number | null
  setMarkEndLine: Setter<number | null>
  showBlockForm: () => boolean
  setShowBlockForm: Setter<boolean>
  blockEditTarget: () => string | null
  setBlockEditTarget: Setter<string | null>
  userScrolled: () => boolean
  setUserScrolled: Setter<boolean>
  loopStartLyricIdx: () => number | null
  setLoopStartLyricIdx: Setter<number | null>
  loopEndLyricIdx: () => number | null
  setLoopEndLyricIdx: Setter<number | null>

  // Loop lyric handler
  handleSetLoopLyric: (idx: number) => void

  // Memos
  canonicalLrcLines: () => CanonicalLrcEntry[]
  stableParsedLyrics: () => Map<
    number,
    {
      time: number
      endTime: number
      words: string[]
      key: string
      wordTimes?: number[]
      wordEndTimes?: number[]
      wordSweeps?: Record<number, WordSweepPoint[]>
    }
  >
  blockStarts: () => Map<number, BlockStartsInfo>
  displayLines: () => DisplayLine[]
  lyricsSections: () => number[][]
  genViewData: () => GenViewLine[]

  // Actions — lyrics loading
  loadLyrics: () => Promise<void>
  cancelSearch: () => void
  handleForceSearch: () => Promise<void>
  handleSongPickerRefine: () => Promise<void>
  handleSongPick: (match: LyricsSearchMatch) => Promise<void>
  handleLyricsUpload: (result: LyricsUploadResult) => void
  handleLyricsChange: (e: Event) => void

  // Actions — playback tracking
  updateCurrentLine: () => void
  computeActiveWord: (
    words: string[],
    startTime: number,
    endTime: number,
    wordTimes: number[] | undefined,
    elapsedTime: number,
    wordEndTimes?: number[],
    wordSweeps?: Record<number, WordSweepPoint[]>,
  ) => { activeUpTo: number; charProgress: number; fraction: number }

  // Actions — lyric line click
  handleLyricLineClick: (idx: number) => void

  // Actions — edit mode
  toggleEditMode: () => void
  handleLineTimeEdit: (lineIdx: number, value: string) => void
  handleWordTimeEdit: (lineIdx: number, wordIdx: number, value: string) => void
  getEditWordTime: (lineIdx: number, wordIdx: number) => number
  getEditLineTime: (lineIdx: number) => number
  handleSaveEdits: () => void
  openWordPopover: (
    lineIdx: number,
    wordIdx: number,
    word: string,
    e: MouseEvent,
  ) => void
  closeWordPopover: () => void
  commitPopoverValue: (value: string) => void
  estimateWordTimings: () => WordTimingsMap
  formatTimeMs: (secs: number) => string
  formatTimeLrcWord: (secs: number) => string
  parseTimeInput: (input: string) => number | null

  // Actions — lyrics text editing (rewrite the words, keep the timings)
  textEditMode: () => boolean
  beginTextEdit: () => void
  cancelTextEdit: () => void
  applyTextEdit: (rows: LyricsEditRow[]) => void
  /** Build a fresh "From vocal" lyric version from Whisper segments and open
   *  the text editor on it for cleanup. False when the segments held no text. */
  importWhisperLyrics: (segments: WhisperSegment[]) => boolean

  // Actions — LRC gen
  startLrcGen: () => void
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
  applyAutoWordSync: (onsets: number[]) => { linesSynced: number }
  handleLrcGenReset: () => void
  handleDownloadLrc: () => void
  getGenLines: () => string[]

  // Actions — block management
  handleMarkBlock: (label: string, repeatCount: number) => void
  handleUnlinkInstance: (blockId: string, instanceIdx: number) => void
  handleDeleteBlock: (blockId: string) => void
  handleAddInstance: (blockId: string, startIdx: number, endIdx: number) => void
  handleEditBlock: (blockId: string, label: string, repeatCount: number) => void
  getBlockColor: (blockId: string) => string
  getBlockById: (blockId: string) => LyricsBlock | undefined
  getBlockForLine: (
    lineIdx: number,
  ) => { blockId: string; instanceIdx: number; isTemplate: boolean } | null
  detectBlockInstances: (
    textLines: string[],
    templateIndices: number[],
    existingInstances: BlockInstancesMap,
  ) => number[][]

  // Helpers
  hasMultipleSections: () => boolean

  // LRC gen persistence helpers
  loadPersistedLyrics: () =>
    | (LyricsUploadResult & {
        wordTimings?: WordTimingsMap
        originalText?: string
      })
    | null
  persistLyrics: (
    text: string,
    format: 'txt' | 'lrc',
    filename: string,
    wt?: WordTimingsMap,
    originalText?: string,
    versionKind?: LyricsVersionKind,
  ) => void

  // Lyric versions
  lyricsVersions: Accessor<LyricsVersion[]>
  activeVersionKind: Accessor<LyricsVersionKind | null>
  switchVersion: (kind: LyricsVersionKind) => void
  deleteVersion: (kind: LyricsVersionKind) => void
  clearLyrics: () => void
}

// ── Pure helpers ───────────────────────────────────────────────────

const parseTimeInput = (input: string): number | null => {
  const trimmed = input.trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/)
  if (!match) return null
  const mins = parseInt(match[1], 10)
  const secs = parseInt(match[2], 10)
  if (secs >= 60) return null
  let ms = 0
  if (match[3]) {
    ms = parseInt(match[3].padEnd(3, '0'), 10) / 1000
  }
  return mins * 60 + secs + ms
}

const formatTimeMs = (secs: number): string => {
  const m = Math.min(99, Math.floor(secs / 60))
  const wholeSecs = Math.floor(secs % 60)
  const hundredths = Math.round((secs % 1) * 100)
  const s = wholeSecs.toString().padStart(2, '0')
  const h = hundredths.toString().padStart(2, '0')
  return `${m.toString().padStart(2, '0')}:${s}.${h}`
}

const formatTimeLrcWord = formatTimeLrc

// ── Controller factory ─────────────────────────────────────────────

export function useStemMixerLyricsController(
  deps: StemMixerLyricsDeps,
): StemMixerLyricsController {
  let abortRef: AbortController | null = null

  // ── Signals ────────────────────────────────────────────────────
  const [lyricsLines, setLyricsLines] = createSignal<string[]>([])
  const [lrcLines, setLrcLines] = createSignal<LrcLine[]>([])
  const [rawLyricsText, setRawLyricsText] = createSignal('')
  const [currentLineIdx, setCurrentLineIdx] = createSignal(-1)
  const [lyricsSource, setLyricsSource] = createSignal<LyricsSource>('none')
  const [lyricsLoading, setLyricsLoading] = createSignal(false)
  const [songMatches, setSongMatches] = createSignal<LyricsSearchMatch[]>([])
  const [showSongPicker, setShowSongPicker] = createSignal(false)
  const [songPickerQuery, setSongPickerQuery] = createSignal('')
  const [lyricsFontSize, setLyricsFontSize] = createSignal(
    deps.defaultFontSize ?? 1.3,
  )
  const [lyricsColumns, setLyricsColumns] = createSignal<1 | 2>(1)
  const [lyricsAlign, setLyricsAlign] = createPersistedSignal<LyricsAlign>(
    deps.alignPrefsKey ?? 'pitchperfect_lyrics_align',
    deps.defaultAlign ?? 'left',
  )
  const [editMode, setEditMode] = createSignal(false)
  // Lyrics TEXT editor (rewrite the words; distinct from the word-timing
  // editMode above). Declared with the signals so applyVersionToLive below
  // can reset it on version switches.
  const [textEditMode, setTextEditMode] = createSignal(false)
  const [wordTimings, setWordTimings] = createSignal<WordTimingsMap>({})
  const [wordEndTimings, setWordEndTimings] = createSignal<WordTimingsMap>({})
  const [wordSweepTimings, setWordSweepTimings] =
    createSignal<WordSweepTimingsMap>({})
  // Saved lyric mappings (Original / Edited / Auto-sync / Tapped) the user can
  // switch between — see src/lib/lyrics-versions.ts.
  const [lyricsVersions, setLyricsVersions] = createSignal<LyricsVersion[]>([])
  const [activeVersionKind, setActiveVersionKind] =
    createSignal<LyricsVersionKind | null>(null)
  const [editBuffer, setEditBuffer] = createSignal<WordTimingsMap>({})
  const [editPopover, setEditPopover] = createSignal<EditPopover | null>(null)
  const blocksCtl = useLyricsBlocksController({
    persistBlocks: (b, i) => persistBlocks(b, i),
    getGenLines: () => gen.getGenLines(),
  })
  const {
    blocks,
    setBlocks,
    blockInstances,
    setBlockInstances,
    blockMarkMode,
    setBlockMarkMode,
    markStartLine,
    setMarkStartLine,
    markEndLine,
    setMarkEndLine,
    showBlockForm,
    setShowBlockForm,
    blockEditTarget,
    setBlockEditTarget,
    getBlockColor,
    getBlockForLine,
    getBlockById,
    handleMarkBlock,
    handleUnlinkInstance,
    handleDeleteBlock,
    handleAddInstance,
    handleEditBlock,
    detectBlockInstances,
  } = blocksCtl

  const [loopStartLyricIdx, setLoopStartLyricIdx] = createSignal<number | null>(
    null,
  )
  const [loopEndLyricIdx, setLoopEndLyricIdx] = createSignal<number | null>(
    null,
  )

  const handleSetLoopLyric = (idx: number) => {
    const a = loopStartLyricIdx()
    const b = loopEndLyricIdx()
    if (a === null) {
      setLoopStartLyricIdx(idx)
      setLoopEndLyricIdx(null)
    } else if (b === null) {
      if (idx > a) {
        setLoopEndLyricIdx(idx)
      } else if (idx < a) {
        setLoopStartLyricIdx(idx)
        setLoopEndLyricIdx(a)
      } else {
        setLoopStartLyricIdx(null)
      }
    } else {
      setLoopStartLyricIdx(idx)
      setLoopEndLyricIdx(null)
    }
  }

  // ── Persistence ──────────────────────────────────────────────────

  // ── Local lyrics data cache (keeps loadPersistedLyrics sync) ─────
  type CachedLyricsPayload = LyricsData & { timestamp?: number }
  const [_lyricsCache, _setLyricsCache] =
    createSignal<CachedLyricsPayload | null>(null)

  const persistLyrics = (
    text: string,
    format: 'txt' | 'lrc',
    filename: string,
    wt?: WordTimingsMap,
    originalText?: string,
    /** When set, snapshot the saved mapping as this named version and make it
     *  active. Omit for saves that don't change the mapping (font size,
     *  block edits) — those keep the existing versions untouched. */
    versionKind?: LyricsVersionKind,
    timingExtension?: LyricsTimingExtension,
  ) => {
    let versions = lyricsVersions()
    let activeKind = activeVersionKind()
    if (versionKind !== undefined) {
      // A fresh import (upload / online match) is a clean slate — it must not
      // carry over Edited/Auto-sync versions from a previously loaded file.
      // Every other kind builds on top of the current import.
      const base = versionKind === 'imported' ? [] : versions
      versions = upsertVersion(base, {
        kind: versionKind,
        text,
        wordTimings: wt && Object.keys(wt).length > 0 ? wt : undefined,
        wordEndTimings:
          timingExtension &&
          Object.keys(timingExtension.wordEndTimings).length > 0
            ? timingExtension.wordEndTimings
            : undefined,
        wordSweepTimings:
          timingExtension &&
          Object.keys(timingExtension.wordSweepTimings).length > 0
            ? timingExtension.wordSweepTimings
            : undefined,
        createdAt: Date.now(),
      })
      activeKind = versionKind
      setLyricsVersions(versions)
      setActiveVersionKind(versionKind)
    }

    const payload: CachedLyricsPayload = {
      text,
      format,
      filename,
      timestamp: Date.now(),
    }
    if (wt && Object.keys(wt).length > 0) payload.wordTimings = wt
    if (originalText !== undefined) payload.originalText = originalText
    const bl = blocks()
    if (bl.length > 0) payload.blocks = bl
    const bi = blockInstances()
    if (Object.keys(bi).length > 0) payload.blockInstances = bi
    payload.fontSize = lyricsFontSize()
    if (versions.length > 0) payload.versions = versions
    if (activeKind !== null) payload.activeVersionKind = activeKind

    // Update local cache immediately (keeps reads sync)
    _setLyricsCache(payload)

    // Persist to IndexedDB (fire-and-forget)
    void saveLyricsToDb(deps.sessionId, payload)
  }

  // ── Lyric versions (switch / delete) ─────────────────────────────
  const LRC_LINE_RE = /^\s*\[\d{1,3}:\d{2}/m
  /** Load a saved version's text + timings into the live lyric state. */
  const applyVersionToLive = (version: LyricsVersion) => {
    const isLrc = LRC_LINE_RE.test(version.text)
    setRawLyricsText(version.text)
    if (isLrc) {
      setLrcLines(parseLrcFile(version.text))
      setLyricsLines([])
    } else {
      setLyricsLines(parseTextLyrics(version.text))
      setLrcLines([])
    }
    setWordTimings(version.wordTimings ?? {})
    setWordEndTimings(version.wordEndTimings ?? {})
    setWordSweepTimings(version.wordSweepTimings ?? {})
    setEditMode(false)
    setTextEditMode(false)
    // Blocks/repeats belong to a specific mapping — reset on switch.
    setBlocks([])
    setBlockInstances({})
    setLyricsSource('upload')
  }

  /** Rebuild the versions list from a persisted payload (migrating legacy
   *  single-slot records once), setting the version signals. Returns the
   *  active version, or null when the record has no lyrics. */
  const hydrateVersions = (
    payload: CachedLyricsPayload | null,
  ): LyricsVersion | null => {
    if (payload === null) {
      setLyricsVersions([])
      setActiveVersionKind(null)
      return null
    }
    const { versions, activeVersionKind: active } = synthesizeVersions(
      {
        text: payload.text,
        // The DB's looser element type (number | undefined) is the same shape
        // at runtime; the versions module only reads keys + passes it through.
        wordTimings: payload.wordTimings as WordTimingsMap | undefined,
        originalText: payload.originalText,
        versions: payload.versions,
        activeVersionKind: payload.activeVersionKind,
      },
      Date.now(),
    )
    setLyricsVersions(versions)
    setActiveVersionKind(active ?? null)
    return findVersion(versions, active ?? undefined) ?? null
  }

  const switchVersion = (kind: LyricsVersionKind) => {
    if (kind === activeVersionKind()) return
    const version = findVersion(lyricsVersions(), kind)
    if (version === undefined) return
    clearLrcGenProgress()
    applyVersionToLive(version)
    setActiveVersionKind(kind)
    const filename = loadPersistedLyrics()?.filename ?? 'lyrics.lrc'
    persistLyrics(
      version.text,
      LRC_LINE_RE.test(version.text) ? 'lrc' : 'txt',
      filename,
      version.wordTimings,
    )
  }

  const deleteVersion = (kind: LyricsVersionKind) => {
    const remaining = removeVersion(lyricsVersions(), kind)
    setLyricsVersions(remaining)
    const filename = loadPersistedLyrics()?.filename ?? 'lyrics.lrc'
    if (kind === activeVersionKind()) {
      const next = remaining[0]
      if (next !== undefined) {
        applyVersionToLive(next)
        setActiveVersionKind(next.kind)
        persistLyrics(
          next.text,
          LRC_LINE_RE.test(next.text) ? 'lrc' : 'txt',
          filename,
          next.wordTimings,
        )
        return
      }
      setActiveVersionKind(null)
    }
    // Deleted a non-active version (or the last one) — re-save with the
    // trimmed list, keeping the current active text.
    persistLyrics(
      rawLyricsText(),
      lrcLines().length > 0 ? 'lrc' : 'txt',
      filename,
      wordTimings(),
    )
  }

  /** Remove all lyrics for this song — db record, caches, versions, and edit
   *  state — and return the panel to the "no lyrics" finder (seeded with the
   *  song title so a fresh search is one tap). There is no undo. */
  const clearLyrics = (): void => {
    void deleteLyricsFromDb(deps.sessionId)
    clearLrcGenProgress()
    _setLyricsCache(null)
    setRawLyricsText('')
    setLrcLines([])
    setLyricsLines([])
    setWordTimings({})
    setWordEndTimings({})
    setWordSweepTimings({})
    setBlocks([])
    setBlockInstances({})
    setBlockMarkMode(false)
    setMarkStartLine(null)
    setMarkEndLine(null)
    setBlockEditTarget(null)
    setLyricsVersions([])
    setActiveVersionKind(null)
    setEditMode(false)
    setTextEditMode(false)
    setEditBuffer({})
    gen.resetGenState()
    setCurrentLineIdx(-1)
    setShowSongPicker(false)
    setSongMatches([])
    const title = extractTitle(deps.songTitle ?? deps.sessionId ?? '')
    setSongPickerQuery(title && title !== 'Unknown' ? title : '')
    setLyricsSource('none')
  }

  const loadPersistedLyrics = ():
    | (LyricsUploadResult & {
        wordTimings?: WordTimingsMap
        originalText?: string
      })
    | null => {
    // Read from local cache (populated by _loadLyricsFromDbOrLocalStorage)
    const cached = _lyricsCache()
    if (cached !== null) {
      const result: LyricsUploadResult & {
        wordTimings?: WordTimingsMap
        originalText?: string
      } = {
        text: cached.text,
        format: cached.format,
        filename: cached.filename,
      }
      if (cached.originalText !== undefined) {
        result.originalText = cached.originalText
      }
      if (cached.wordTimings !== undefined) {
        result.wordTimings = cached.wordTimings as WordTimingsMap
      }
      if (typeof cached.fontSize === 'number')
        setLyricsFontSize(cached.fontSize)
      if (Array.isArray(cached.blocks))
        setBlocks(cached.blocks as LyricsBlock[])
      if (
        typeof cached.blockInstances === 'object' &&
        cached.blockInstances !== null
      ) {
        setBlockInstances(cached.blockInstances as BlockInstancesMap)
      }
      return result
    }
    return null
  }

  const persistBlocks = (
    blocks: LyricsBlock[],
    blockInstances: BlockInstancesMap,
  ) => {
    // Update the cache and re-persist everything
    const cached = _lyricsCache()
    if (cached === null) return
    const updated = {
      ...cached,
      blocks,
      blockInstances,
    }
    _setLyricsCache(updated)
    void saveLyricsToDb(deps.sessionId, updated as LyricsData)
  }

  // ── Lyrics loading ───────────────────────────────────────────────

  const applyLyricsResult = (result: LyricsSearchResult, title: string) => {
    clearLrcGenProgress()
    setWordTimings({})
    setWordEndTimings({})
    setWordSweepTimings({})
    setRawLyricsText(result.text)
    if (result.format === 'lrc') {
      setLrcLines(parseLrcFile(result.text))
      setLyricsLines([])
    } else {
      setLyricsLines(parseTextLyrics(result.text))
      setLrcLines([])
    }
    persistLyrics(
      result.text,
      result.format,
      `${title}.${result.format}`,
      undefined,
      undefined,
      'imported',
    )
    setLyricsSource('api')
  }

  const handleSongPick = async (match: LyricsSearchMatch) => {
    setShowSongPicker(false)
    setSongMatches([])
    setLyricsLoading(true)
    try {
      const lyrics = await fetchLyricsById(match.id)
      if (lyrics) {
        applyLyricsResult(lyrics, `${match.artist} - ${match.title}`)
      } else {
        setLyricsSource('none')
      }
    } catch {
      setLyricsSource('none')
    } finally {
      setLyricsLoading(false)
    }
  }

  const handleSongPickerRefine = async () => {
    const q = songPickerQuery().trim()
    if (!q) return
    setLyricsLoading(true)
    try {
      const results = await searchLyricsMulti(q)
      setSongMatches(results)
    } catch {
      /* keep existing results */
    } finally {
      setLyricsLoading(false)
    }
  }

  let preSearchSource: LyricsSource = 'none'

  const cancelSearch = () => {
    if (abortRef) {
      abortRef.abort()
      abortRef = null
    }
    setLyricsLoading(false)
    setShowSongPicker(false)
    // Restore the source that was active before the search started
    setLyricsSource(preSearchSource)
  }

  const handleForceSearch = async () => {
    // Save current source so cancelSearch can restore it
    preSearchSource = lyricsSource()
    // Cancel any ongoing auto-search and open the picker for manual search,
    // pre-seeded with the song title so it starts from a useful query.
    cancelSearch()
    setSongMatches([])
    const forced = extractTitle(deps.songTitle ?? deps.sessionId ?? '')
    const seed = forced && forced !== 'Unknown' ? forced : ''
    setSongPickerQuery(seed)
    setShowSongPicker(true)
    // Open with answers rather than an empty box. The seeded query is the
    // one the singer would have typed anyway -- the old finder made them
    // press Search to ask it, which read as "we found nothing" when in
    // fact nobody had looked yet. Refining and searching again still works.
    if (seed !== '') await handleSongPickerRefine()
  }

  const loadLyrics = async () => {
    // Populate the local cache from IndexedDB
    if (_lyricsCache() === null) {
      const dbData = await loadLyricsFromDb(deps.sessionId)
      if (dbData !== null) {
        _setLyricsCache(dbData as CachedLyricsPayload)
      }
    }

    const persisted = loadPersistedLyrics()
    if (persisted) {
      setRawLyricsText(persisted.text)
      if (persisted.format === 'lrc') {
        setLrcLines(parseLrcFile(persisted.text))
        setLyricsLines([])
      } else {
        setLyricsLines(parseTextLyrics(persisted.text))
        setLrcLines([])
      }
      if (persisted.wordTimings) setWordTimings(persisted.wordTimings)
      // Build the version list from the stored payload (migrating a legacy
      // single-slot record once). Persist the migration so it sticks.
      const cache = _lyricsCache()
      const hadVersions =
        cache?.versions !== undefined && cache.versions.length > 0
      const activeVersion = hydrateVersions(cache)
      setWordEndTimings(activeVersion?.wordEndTimings ?? {})
      setWordSweepTimings(activeVersion?.wordSweepTimings ?? {})
      if (!hadVersions && lyricsVersions().length > 0) {
        persistLyrics(
          persisted.text,
          persisted.format,
          persisted.filename,
          persisted.wordTimings,
          persisted.originalText,
        )
      }
      setLyricsSource('upload')
      return
    }

    const rawInput = deps.songTitle ?? deps.sessionId ?? ''
    const title = extractTitle(rawInput)
    if (!title || title === 'Unknown') {
      setLyricsSource('none')
      return
    }
    // Seed the picker query up front, so the zen finder (and a manual search)
    // start from the song's title even when the auto-search returns nothing.
    setSongPickerQuery(title)

    // Create new abort controller for this search session
    abortRef = new AbortController()
    const signal = abortRef.signal

    setLyricsLoading(true)
    try {
      const multiResults = await searchLyricsMulti(title, signal)
      if (multiResults.length === 1) {
        const match = multiResults[0]
        const lyrics = await fetchLyricsById(match.id, signal)
        if (lyrics) {
          applyLyricsResult(lyrics, title)
          setLyricsLoading(false)
          return
        }
      } else if (multiResults.length > 1) {
        setSongMatches(multiResults)
        setSongPickerQuery(title)
        setShowSongPicker(true)
        setLyricsLoading(false)
        return
      }

      const result = await searchLyrics(title, signal)
      if (result) {
        applyLyricsResult(result, title)
        setLyricsSource('api')
      } else {
        setLyricsSource('none')
      }
    } catch {
      // If aborted intentionally, show the uploader instead of "none"
      if (signal.aborted) {
        setLyricsSource('none')
      } else {
        setLyricsSource('none')
      }
    } finally {
      setLyricsLoading(false)
      abortRef = null
    }
  }

  const handleLyricsUpload = (result: LyricsUploadResult) => {
    clearLrcGenProgress()
    setBlocks([])
    setBlockInstances({})
    const timingExtension =
      result.format === 'lrc' ? parseLrcTimingMetadata(result.text) : null
    setWordTimings({})
    setWordEndTimings(timingExtension?.wordEndTimings ?? {})
    setWordSweepTimings(timingExtension?.wordSweepTimings ?? {})
    setRawLyricsText(result.text)
    persistLyrics(
      result.text,
      result.format,
      result.filename,
      undefined,
      undefined,
      'imported',
      timingExtension ?? undefined,
    )
    if (result.format === 'lrc') {
      setLrcLines(parseLrcFile(result.text))
      setLyricsLines([])
    } else {
      setLyricsLines(parseTextLyrics(result.text))
      setLrcLines([])
    }
    setLyricsSource('upload')
    setShowSongPicker(false)
  }

  const handleLyricsChange = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'txt' && ext !== 'lrc') return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      if (!text.trim()) return
      handleLyricsUpload({
        text,
        format: ext as 'txt' | 'lrc',
        filename: file.name,
      })
    }
    reader.readAsText(file)
  }

  // ── Playback tracking ─────────────────────────────────────────────

  const updateCurrentLine = () => {
    const canonical = canonicalLrcLines()
    if (canonical.length > 0) {
      const elapsed = deps.elapsed()
      let idx = -1
      for (let i = 0; i < canonical.length; i++) {
        if (canonical[i].time <= elapsed) idx = canonical[i].canonicalIndex
        else break
      }
      setCurrentLineIdx(idx)
    } else if (lyricsLines().length > 0 && deps.duration() > 0) {
      setCurrentLineIdx(
        getCurrentLineIndex(
          lyricsLines().length,
          deps.elapsed(),
          deps.duration(),
        ),
      )
    }
  }

  // ── Lyric line click ──────────────────────────────────────────────

  const handleLyricLineClick = (idx: number) => {
    let targetTime: number | null = null

    // If in LRC Gen mode, prioritize the newly mapped time for this line if available
    if (lrcGenMode()) {
      const timings = lrcGenWordTimings()[idx]
      if (timings !== undefined && Object.keys(timings).length > 0) {
        const firstMappedWordIdx = Math.min(...Object.keys(timings).map(Number))
        targetTime = timings[firstMappedWordIdx]
      } else if (lrcGenLineTimes()[idx] !== undefined) {
        targetTime = lrcGenLineTimes()[idx] ?? null
      }
    }

    // Fall back to previous canonical LRC time, or proportional time
    if (targetTime === null) {
      const canonical = canonicalLrcLines()
      if (canonical.length > 0 && idx < canonical.length) {
        targetTime = canonical[idx].time
      } else if (lyricsLines().length > 0 && deps.duration() > 0) {
        targetTime = (idx / lyricsLines().length) * deps.duration()
      }
    }

    if (targetTime === null) return
    deps.seekToWithWindow(targetTime)

    // In LRC gen mode, clicking a line sets it as the starting point
    // so the user can resume or fix a specific section without
    // redoing the entire song from the beginning.
    if (lrcGenMode()) {
      gen.focusGenLine(idx)
    }

    scroll.scrollToLine(idx)
  }

  // ── Edit mode helpers ─────────────────────────────────────────────

  const estimateWordTimings = (): WordTimingsMap => {
    const dur = deps.duration()
    const hasLrc = lrcLines().length > 0
    const lines: string[] = hasLrc
      ? lrcLines().map((l) => l.text)
      : lyricsLines()
    const lineTimes: number[] = hasLrc
      ? lrcLines().map((l) => l.time)
      : lines.map((_, i) => (dur > 0 ? (i / lines.length) * dur : i * 3))
    const lineEndTimes: number[] = hasLrc
      ? lrcLines().map((l, i) =>
          i + 1 < lrcLines().length ? lrcLines()[i + 1].time : l.time + 3,
        )
      : lines.map((_, i) =>
          dur > 0 ? ((i + 1) / lines.length) * dur : (i + 1) * 3,
        )

    const timings: WordTimingsMap = {}
    for (let i = 0; i < lines.length; i++) {
      const words = lines[i].split(/\s+/).filter((w: string) => w.length > 0)
      if (words.length === 0) continue
      const lineDur = Math.max(0.1, lineEndTimes[i] - lineTimes[i])
      const charTotal = words.reduce((sum, w) => sum + w.length, 0) || 1
      let charPos = 0
      timings[i] = words.map((w) => {
        const start = lineTimes[i] + (charPos / charTotal) * lineDur
        charPos += w.length
        return Math.round(start * 1000) / 1000
      })
    }
    return timings
  }

  const openWordPopover = (
    lineIdx: number,
    wordIdx: number,
    word: string,
    e: MouseEvent,
  ) => {
    e.stopPropagation()
    setEditPopover({ lineIdx, wordIdx, word })
  }

  const closeWordPopover = () => setEditPopover(null)

  const commitPopoverValue = (value: string) => {
    const pop = editPopover()
    if (!pop) return
    const parsed = parseTimeInput(value)
    if (parsed !== null) {
      handleWordTimeEdit(pop.lineIdx, pop.wordIdx, value)
    }
    setEditPopover(null)
  }

  const toggleEditMode = () => {
    if (editMode()) {
      setEditBuffer({})
      setEditMode(false)
      return
    }
    const existing = wordTimings()
    if (Object.keys(existing).length > 0) {
      setEditBuffer(structuredClone(existing))
    } else {
      setEditBuffer(estimateWordTimings())
    }
    setEditMode(true)
  }

  const handleLineTimeEdit = (lineIdx: number, value: string) => {
    const parsed = parseTimeInput(value)
    if (parsed === null) return
    const prev = editBuffer()
    const oldStart = prev[lineIdx]?.[0] ?? 0
    const delta = parsed - oldStart
    const next: WordTimingsMap = {}
    for (const key of Object.keys(prev)) next[+key] = [...prev[+key]]
    if (prev[lineIdx] !== undefined) {
      next[lineIdx] = prev[lineIdx].map((t) =>
        Math.max(0, Math.round((t + delta) * 1000) / 1000),
      )
    }
    setEditBuffer(next)
  }

  const handleWordTimeEdit = (
    lineIdx: number,
    wordIdx: number,
    value: string,
  ) => {
    const parsed = parseTimeInput(value)
    if (parsed === null) return
    const next: WordTimingsMap = {}
    for (const key of Object.keys(editBuffer()))
      next[+key] = [...editBuffer()[+key]]
    if (next[lineIdx] === undefined) next[lineIdx] = []
    const line = [...next[lineIdx]]
    line[wordIdx] = parsed
    next[lineIdx] = line
    setEditBuffer(next)
  }

  const getEditWordTime = (lineIdx: number, wordIdx: number): number => {
    return editBuffer()[lineIdx]?.[wordIdx] ?? 0
  }

  const getEditLineTime = (lineIdx: number): number => {
    return editBuffer()[lineIdx]?.[0] ?? 0
  }

  const handleSaveEdits = () => {
    const merged = { ...wordTimings(), ...editBuffer() }
    setWordTimings(merged)
    // Start edits invalidate marker-authored ends/curves. The previous mapped
    // version remains available in the version menu.
    setWordEndTimings({})
    setWordSweepTimings({})

    const filename = loadPersistedLyrics()?.filename ?? 'edited.lrc'
    const canonical = canonicalLrcLines()
    const hasCanonical = canonical.length > 0

    let text: string
    if (hasCanonical) {
      const lineTimes = canonical.map((e) => merged[e.lrcIndex]?.[0])
      text = buildLrcTextFromCanonical(canonical, lineTimes)
    } else {
      text = lyricsLines()
        .map((line, i) => {
          if (!line.trim()) return ''
          const baseTime =
            merged[i]?.[0] ??
            (deps.duration() > 0
              ? (i / lyricsLines().length) * deps.duration()
              : i * 3)
          return `[${formatTimeLrcWord(baseTime)}] ${line}`
        })
        .join('\n')
    }

    persistLyrics(text, 'lrc', filename, merged, undefined, 'edited')
    const parsed = parseLrcFile(text)
    setLrcLines(parsed)
    setLyricsLines([])
    setEditMode(false)
    setEditBuffer({})
  }

  // ── Lyrics text editing ───────────────────────────────────────────
  // Rewrite the words themselves (fix typos, drop or add lines) while the
  // untouched lines keep their word-level timings verbatim. Saves as the
  // 'edited' version; see src/lib/whisper-lyrics.ts for the row model.
  // (The textEditMode signal lives with the other signals above.)

  const beginTextEdit = () => {
    if (lrcLines().length === 0 && lyricsLines().length === 0) return
    setEditMode(false)
    setTextEditMode(true)
  }

  const cancelTextEdit = () => {
    setTextEditMode(false)
  }

  const applyTextEdit = (rows: LyricsEditRow[]) => {
    // Mirror buildEditedLrc's dropping of empty timed rows so the timing
    // maps (keyed by the NEW line index) line up with the emitted lines.
    const kept = rows.filter(
      (row) => row.time === null || buildEditedLrc([row]) !== '',
    )
    const text = buildEditedLrc(kept)
    if (text.trim() === '') {
      // Nothing left to save — the UI disables Save on empty rows anyway.
      setTextEditMode(false)
      return
    }

    const isLrc = LRC_LINE_RE.test(text)
    const wt: WordTimingsMap = {}
    const wet: WordTimingsMap = {}
    const wst: WordSweepTimingsMap = {}
    if (isLrc) {
      // Untouched lines (rawText emitted verbatim) carry their word timings
      // to the line's new position; edited/added lines start unmapped.
      const sourceWt = wordTimings()
      const sourceWet = wordEndTimings()
      const sourceWst = wordSweepTimings()
      kept.forEach((row, i) => {
        if (row.rawText === null || row.originalIndex === null) return
        const src = row.originalIndex
        if (sourceWt[src] !== undefined) wt[i] = sourceWt[src]
        if (sourceWet[src] !== undefined) wet[i] = sourceWet[src]
        if (sourceWst[src] !== undefined) wst[i] = sourceWst[src]
      })
    }
    const hasWt = Object.keys(wt).length > 0
    const hasExtension =
      Object.keys(wet).length > 0 || Object.keys(wst).length > 0

    const version: LyricsVersion = {
      kind: 'edited',
      text,
      wordTimings: hasWt ? wt : undefined,
      wordEndTimings: Object.keys(wet).length > 0 ? wet : undefined,
      wordSweepTimings: Object.keys(wst).length > 0 ? wst : undefined,
      createdAt: Date.now(),
    }
    applyVersionToLive(version)
    // persistLyrics upserts the 'edited' version and makes it active.
    persistLyrics(
      text,
      isLrc ? 'lrc' : 'txt',
      loadPersistedLyrics()?.filename ?? 'lyrics.lrc',
      hasWt ? wt : undefined,
      undefined,
      'edited',
      hasExtension ? { wordEndTimings: wet, wordSweepTimings: wst } : undefined,
    )
    setTextEditMode(false)
  }

  const importWhisperLyrics = (segments: WhisperSegment[]): boolean => {
    const text = segmentsToLrc(segments)
    if (text === '') return false
    const version: LyricsVersion = {
      kind: 'whisper',
      text,
      createdAt: Date.now(),
    }
    applyVersionToLive(version)
    // persistLyrics upserts the 'whisper' version and makes it active.
    persistLyrics(
      text,
      'lrc',
      loadPersistedLyrics()?.filename ?? 'lyrics.lrc',
      undefined,
      undefined,
      'whisper',
    )
    // Whisper drafts always want a cleanup pass — open the editor directly.
    setTextEditMode(true)
    return true
  }

  // ── LRC mapping session ──────────────────────────────────────────
  //
  // Its own controller: see ./useLrcGenController.ts. The deps below are the
  // state it reads or writes but does not own. Accessors declared later in
  // this function (canonicalLrcLines, genViewData) are passed as arrows so
  // the reference is resolved on call rather than at wiring time.
  const gen = useLrcGenController({
    sessionId: deps.sessionId,
    elapsed: deps.elapsed,
    playing: deps.playing,
    duration: deps.duration,
    seekToWithWindow: deps.seekToWithWindow,
    melodyNotes: deps.melodyNotes,
    lyricsLines,
    setLyricsLines,
    lrcLines,
    setLrcLines,
    rawLyricsText,
    setRawLyricsText,
    lyricsSource,
    setLyricsSource,
    canonicalLrcLines: () => canonicalLrcLines(),
    wordTimings,
    setWordTimings,
    wordEndTimings,
    setWordEndTimings,
    wordSweepTimings,
    setWordSweepTimings,
    editBuffer,
    setEditMode,
    blocks,
    blockInstances,
    getBlockById,
    getBlockForLine,
    genViewData: () => genViewData(),
    loadPersistedLyrics,
    persistLyrics,
  })

  const {
    lrcGenMode,
    lrcGenInputMode,
    setLrcGenInputMode,
    lrcGenPass,
    setLrcGenPass,
    lrcGenLineIdx,
    lrcGenWordIdx,
    lrcGenLineTimes,
    setLrcGenLineTimes,
    lrcGenWordTimings,
    setLrcGenWordTimings,
    lrcGenWordEndTimings,
    lrcGenWordSweepTimings,
    lrcTimingOffsetMs,
    setLrcTimingOffsetMs,
    previewLineIdx,
    previewLoop,
    setPreviewLoop,
    liveHighlight,
    setLiveHighlight,
    highlightWord,
    toggleLinePreview,
    stopLinePreview,
    startLrcGen,
    handleNextLine,
    handleNextWord,
    handleMarkerSample,
    handleRedoCurrentLine,
    handleLrcGenFinish,
    handleLrcGenReset,
    applyAutoWordSync,
    wordPassProgress,
    isLineTouched,
    getGenLines,
    getGenWords,
    isTemplateMappedInGen,
    flushLrcGenProgress,
    clearLrcGenProgress,
  } = gen

  const handleDownloadLrc = () => {
    let lrcText = ''
    const filename = loadPersistedLyrics()?.filename ?? 'lyrics.lrc'
    const wt = wordTimings()

    if (lrcLines().length > 0) {
      lrcText = buildLrcTextFromCanonical(canonicalLrcLines(), undefined, wt)
    } else if (rawLyricsText()) {
      lrcText = buildWordLevelLrc(rawLyricsText().split('\n'), wt)
    } else if (lyricsLines().length > 0) {
      lrcText = buildWordLevelLrc(lyricsLines(), wt)
    }

    if (!lrcText.trim()) return
    lrcText = withLrcTimingMetadata(lrcText, {
      wordEndTimings: wordEndTimings(),
      wordSweepTimings: wordSweepTimings(),
    })

    const blob = new Blob([lrcText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.lrc')
      ? filename
      : `${filename.replace(/\.[^.]+$/, '')}.lrc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const scroll = useLyricsScrollController({
    playing: deps.playing,
    currentLineIdx: () => currentLineIdx(),
    lyricsSource,
    editMode,
    lrcGenMode,
    lrcGenLineIdx,
  })
  const { userScrolled, setUserScrolled } = scroll

  // ── Memos ────────────────────────────────────────────────────────

  const canonicalLrcLines = createMemo<CanonicalLrcEntry[]>(() => {
    const lrc = lrcLines()
    if (lrc.length === 0) return []
    const base = buildCanonicalEntries(lrc, deps.duration())
    // Delay rests that follow a repeated block until all passes are sung.
    const bl = blocks()
    const bi = blockInstances()
    const ranges: RepeatRange[] = []
    for (const b of bl) {
      if (b.repeatCount <= 1) continue
      // An instance is either the template's full index list ([s, s+1, …]) or a
      // detected [start, end) pair; both start at inst[0] and span lineIndices.
      const len = b.lineIndices.length
      for (const inst of bi[b.id] ?? []) {
        ranges.push({
          startLrc: inst[0],
          endLrc: inst[0] + len,
          repeatCount: b.repeatCount,
        })
      }
    }
    return applyRepeatBlocks(base, lrc, ranges)
  })

  const stableParsedLyrics = createMemo(() => {
    const dur = deps.duration()
    const canonical = canonicalLrcLines()
    const txt = lyricsLines()

    const map = new Map<
      number,
      {
        time: number
        endTime: number
        words: string[]
        key: string
        wordTimes?: number[]
        wordEndTimes?: number[]
        wordSweeps?: Record<number, WordSweepPoint[]>
      }
    >()

    if (canonical.length > 0) {
      canonical.forEach((entry, i) => {
        // Find endTime by looking ahead to the next entry, skipping ~Rest~
        // entries only when they're at nearly the same timestamp as the current
        // line (within 0.5s). Rests at the same timestamp would collapse
        // lineDuration to ~0, killing word-by-word progressive highlighting —
        // but rests substantially later represent real pauses in the song and
        // should be honored as endTime so highlighting doesn't stretch across
        // long gaps.
        let endTime = dur
        for (let j = i + 1; j < canonical.length; j++) {
          const next = canonical[j]
          const timeDiff = next.time - entry.time
          if (next.type === 'rest' && timeDiff < 0.5) continue
          endTime = next.time
          break
        }
        // The vocal knows when a line really ends: clamp the display end to
        // the analyzed notes (plus release) so the last word never sweeps
        // across the silence before the next line — and give a start-only
        // mapped last word its true end the same way. Rests keep their raw
        // span (their dots ARE the silence).
        const notes = deps.melodyNotes?.() ?? []
        let displayEnd = endTime
        let wordEndTimes =
          entry.lrcIndex >= 0 ? wordEndTimings()[entry.lrcIndex] : undefined
        if (entry.words.length > 0 && notes.length > 0) {
          displayEnd = clampLineEndToVocal(entry.time, endTime, notes)
          const lastIdx = (entry.wordTimes?.length ?? 0) - 1
          if (lastIdx >= 0 && wordEndTimes?.[lastIdx] === undefined) {
            const lastEnd = synthesizeLastWordEnd(
              entry.wordTimes,
              displayEnd,
              notes,
            )
            if (lastEnd !== undefined) {
              const filled = wordEndTimes ? [...wordEndTimes] : []
              filled[lastIdx] = lastEnd
              wordEndTimes = filled
            }
          }
        }
        map.set(i, {
          key: `lrc-${i}`,
          time: entry.time,
          endTime: displayEnd,
          words: entry.words,
          wordTimes: entry.wordTimes,
          wordEndTimes,
          wordSweeps:
            entry.lrcIndex >= 0
              ? wordSweepTimings()[entry.lrcIndex]
              : undefined,
        })
      })
      return map
    }
    if (txt.length > 0 && dur > 0) {
      txt.forEach((text, i) => {
        const words = text.split(/\s+/).filter((w: string) => w.length > 0)
        const startTime = (i / txt.length) * dur
        const endTime = ((i + 1) / txt.length) * dur
        map.set(i, { key: `txt-${i}`, time: startTime, endTime, words })
      })
      return map
    }
    return map
  })

  const blockStarts = createMemo(() => {
    const starts = new Map<
      number,
      {
        blockId: string
        label: string
        instanceIdx: number
        isTemplate: boolean
        repeatCount: number
        color: string
        startLine: number
        endLine: number
      }
    >()
    for (const [blockId, instances] of Object.entries(blockInstances())) {
      const block = getBlockById(blockId)
      if (!block) continue
      const color = getBlockColor(blockId)
      for (let i = 0; i < instances.length; i++) {
        const [s, e] = instances[i]
        starts.set(s, {
          blockId,
          label: block.label,
          instanceIdx: i,
          isTemplate: i === 0,
          repeatCount: block.repeatCount,
          color,
          startLine: s,
          endLine: e,
        })
      }
    }
    return starts
  })

  const displayLines = createMemo<DisplayLine[]>(() => {
    const raw = rawLyricsText()
    const ll = lyricsLines()
    const lrc = lrcLines()

    if (lrc.length > 0) {
      const canonical = canonicalLrcLines()
      return canonical.flatMap((entry) => {
        const isRest = entry.type === 'rest'
        const gapStart = entry.gapStart ?? entry.time
        const gapEnd = entry.gapEnd ?? entry.time
        // A zero-length explicit sentinel does not describe an actual pause.
        // Keep it in canonical data for round-tripping, but never place it
        // between visible lyric lines.
        if (isRest && gapEnd <= gapStart) return []
        return [
          {
            text: entry.text,
            isBlank: false,
            isRest,
            lyricsIndex: entry.canonicalIndex,
            restGapStart: entry.gapStart,
            restGapEnd: entry.gapEnd,
            restDotCount: entry.dotCount,
          },
        ]
      })
    }
    if (!raw || ll.length === 0) return []

    const rawLines = raw.split('\n')
    let lyricIdx = 0
    return rawLines.map((rawLine) => {
      const trimmed = rawLine.trim()
      if (trimmed === '') {
        return { text: '', isBlank: true, isRest: false, lyricsIndex: -1 }
      }
      const idx = lyricIdx
      lyricIdx++
      return { text: trimmed, isBlank: false, isRest: false, lyricsIndex: idx }
    })
  })

  const lyricsSections = createMemo(() => {
    const lines =
      lrcLines().length > 0 ? lrcLines().map((l) => l.text) : lyricsLines()
    const sections: number[][] = []
    let current: number[] = []
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '') {
        if (current.length > 0) {
          sections.push(current)
          current = []
        }
      } else {
        current.push(i)
      }
    }
    if (current.length > 0) sections.push(current)
    return sections
  })

  const hasMultipleSections = createMemo(() => lyricsSections().length >= 2)

  const genViewData = createMemo(() => {
    const lines = getGenLines()
    const canonical = lrcLines().length > 0 ? canonicalLrcLines() : undefined
    const curLine = lrcGenLineIdx()
    const curWord = lrcGenWordIdx()
    const lineTimes = lrcGenLineTimes()
    const wordTimes = lrcGenWordTimings()
    // Pointer samples can arrive at display frequency. The active marker uses
    // markerVisual for live progress, so rebuilding every song row here would
    // only create redundant work. Word/line transitions still rerun this memo
    // and pick up the latest completed timing data.
    const wordEnds = untrack(lrcGenWordEndTimings)
    const wordSweeps = untrack(lrcGenWordSweepTimings)
    return lines.map((line: string, i: number) => {
      const words = getGenWords(line)
      const entry = canonical?.[i]
      const blockForLine = getBlockForLine(i)
      const isPlaceholder =
        blockForLine !== null &&
        !blockForLine.isTemplate &&
        isTemplateMappedInGen(blockForLine.blockId)
      const block = blockForLine
        ? getBlockById(blockForLine.blockId)
        : undefined
      return {
        index: i,
        line,
        words,
        isRest: entry?.type === 'rest' || line.trim() === '~Rest~',
        restGapStart: entry?.gapStart,
        restGapEnd: entry?.gapEnd,
        restDotCount: entry?.dotCount,
        isCurrent: i === curLine,
        isDone: i < curLine,
        isFuture: i > curLine,
        // Cursor position is not mapped-ness. A resumed session carries the
        // song's existing timings, so plenty of lines ahead of the cursor are
        // already mapped and dimming them like blanks said otherwise.
        isMapped: lineTimes[i] !== undefined,
        isSessionMapped: isLineTouched(i),
        lineTime: lineTimes[i],
        wordTimes: wordTimes[i],
        wordEndTimes: wordEnds[i],
        wordSweeps: wordSweeps[i] ?? {},
        activeWordIdx: i === curLine ? curWord : -1,
        blockInfo: blockForLine,
        blockLabel: block?.label,
        isPlaceholder,
        isPlaceholderStart:
          isPlaceholder &&
          i ===
            (blockInstances()[blockForLine!.blockId]?.[
              blockForLine!.instanceIdx
            ]?.[0] ?? -1),
      }
    })
  })

  // ── Cleanup ──────────────────────────────────────────────────────

  onCleanup(() => {
    flushLrcGenProgress()
  })

  // ── Return ────────────────────────────────────────────────────────

  return {
    // Signals
    lyricsLines,
    setLyricsLines,
    lrcLines,
    setLrcLines,
    rawLyricsText,
    setRawLyricsText,
    currentLineIdx,
    setCurrentLineIdx,
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
    lyricsAlign,
    setLyricsAlign,
    editMode,
    setEditMode,
    wordTimings,
    setWordTimings,
    wordEndTimings,
    wordSweepTimings,
    editBuffer,
    setEditBuffer,
    editPopover,
    setEditPopover,
    lrcGenMode,
    lrcGenPass,
    setLrcGenPass,
    wordPassProgress,
    genShiftMs: gen.genShiftMs,
    shiftGenTimings: gen.shiftGenTimings,
    previewLineIdx,
    previewLoop,
    setPreviewLoop,
    liveHighlight,
    setLiveHighlight,
    highlightWord,
    toggleLinePreview,
    stopLinePreview,
    lrcGenInputMode,
    setLrcGenInputMode,
    lrcTimingOffsetMs,
    setLrcTimingOffsetMs,
    lrcGenLineIdx,
    lrcGenWordIdx,
    lrcGenLineTimes,
    lrcGenWordTimings,
    lrcGenWordEndTimings,
    lrcGenWordSweepTimings,
    setLrcGenLineTimes,
    setLrcGenWordTimings,
    blocks,
    setBlocks,
    blockInstances,
    setBlockInstances,
    blockMarkMode,
    setBlockMarkMode,
    markStartLine,
    setMarkStartLine,
    markEndLine,
    setMarkEndLine,
    showBlockForm,
    setShowBlockForm,
    blockEditTarget,
    setBlockEditTarget,
    userScrolled,
    setUserScrolled,
    loopStartLyricIdx,
    setLoopStartLyricIdx,
    loopEndLyricIdx,
    setLoopEndLyricIdx,
    handleSetLoopLyric,

    // Memos
    canonicalLrcLines,
    stableParsedLyrics,
    blockStarts,
    displayLines,
    lyricsSections,
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
    handleWordTimeEdit,
    getEditWordTime,
    getEditLineTime,
    handleSaveEdits,
    openWordPopover,
    closeWordPopover,
    commitPopoverValue,
    estimateWordTimings,
    formatTimeMs,
    formatTimeLrcWord,
    parseTimeInput,

    // Actions — lyrics text editing (words, not timings)
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

    // Actions — block management
    handleMarkBlock,
    handleUnlinkInstance,
    handleDeleteBlock,
    handleAddInstance,
    handleEditBlock,
    getBlockColor,
    getBlockById,
    getBlockForLine,
    detectBlockInstances,

    // Helpers
    hasMultipleSections,

    // LRC gen persistence helpers (needed by handleDownloadLrc called from JSX)
    loadPersistedLyrics,
    persistLyrics,

    // Lyric versions (switch / delete between saved mappings)
    lyricsVersions,
    activeVersionKind,
    switchVersion,
    deleteVersion,
    clearLyrics,
  }
}
