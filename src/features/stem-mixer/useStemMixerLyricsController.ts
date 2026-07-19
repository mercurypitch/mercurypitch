// ============================================================
// StemMixer Lyrics Controller — lyrics/LRC gen/blocks state + actions
// ============================================================

import type { Accessor, Setter } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'

export type LyricsAlign = 'left' | 'center' | 'right'
import type { LyricsData } from '@/db/services/lyrics-db-service'
import { loadLyricsFromDb, saveLyricsToDb, } from '@/db/services/lyrics-db-service'
import type { RepeatRange } from '@/lib/canonical-lrc'
import { applyRepeatBlocks, buildCanonicalEntries, buildLrcToCanonicalMap, } from '@/lib/canonical-lrc'
import { buildLrcTextFromCanonical, buildWordLevelLrc, estimateUnmappedTimes, formatTimeLrc, } from '@/lib/lrc-generator'
import type { LrcLine, LyricsSearchMatch, LyricsSearchResult, } from '@/lib/lyrics-service'
import { computeActiveWord, extractTitle, fetchLyricsById, getCurrentLineIndex, parseLrcFile, parseTextLyrics, searchLyrics, searchLyricsMulti, } from '@/lib/lyrics-service'
import type { LyricsVersion, LyricsVersionKind } from '@/lib/lyrics-versions'
import { findVersion, removeVersion, synthesizeVersions, upsertVersion, } from '@/lib/lyrics-versions'
import { autoTimeLineWords } from '@/lib/word-sync'
import { enforceMonotonicTimes, interpolateGaps, mergePartialLineTimes, mergePartialWordTimings, } from './lrc-gen-engine'
import type { BlockInstancesMap, BlockStartsInfo, CanonicalLrcEntry, DisplayLine, EditPopover, GenViewLine, LyricsBlock, LyricsSource, LyricsUploadResult, WordTimingsMap, } from './types'

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
  editBuffer: () => WordTimingsMap
  setEditBuffer: Setter<WordTimingsMap>
  editPopover: () => EditPopover | null
  setEditPopover: Setter<EditPopover | null>
  lrcGenMode: () => boolean
  lrcGenLineIdx: () => number
  lrcGenWordIdx: () => number
  lrcGenLineTimes: () => (number | undefined)[]
  lrcGenWordTimings: () => WordTimingsMap
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

  // Actions — LRC gen
  startLrcGen: () => void
  handleNextLine: () => void
  handleNextWord: () => void
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
}

// ── Pure helpers ───────────────────────────────────────────────────

const BLOCK_COLORS = [
  '#f0a060',
  '#60a0f0',
  '#60d080',
  '#d080e0',
  '#e0c050',
  '#f06080',
]

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
  const genKey = () => `lyrics_gen_v1_${deps.sessionId}`

  const LYRICS_CONTAINER_SELECTOR =
    '.sm-lyrics-lines:not(.sm-lyrics-gen-lines):not(.sm-lyrics-lines-edit)'

  let lyricsScrollContainer: HTMLElement | null = null
  let isAutoScrolling = false
  let lyricsScrollTimeout: ReturnType<typeof setTimeout> | null = null
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
  const [wordTimings, setWordTimings] = createSignal<WordTimingsMap>({})
  // Saved lyric mappings (Original / Edited / Auto-sync / Tapped) the user can
  // switch between — see src/lib/lyrics-versions.ts.
  const [lyricsVersions, setLyricsVersions] = createSignal<LyricsVersion[]>([])
  const [activeVersionKind, setActiveVersionKind] =
    createSignal<LyricsVersionKind | null>(null)
  const [editBuffer, setEditBuffer] = createSignal<WordTimingsMap>({})
  const [editPopover, setEditPopover] = createSignal<EditPopover | null>(null)
  const [lrcGenMode, setLrcGenMode] = createSignal(false)
  const [lrcGenLineIdx, setLrcGenLineIdx] = createSignal(0)
  const [lrcGenWordIdx, setLrcGenWordIdx] = createSignal(0)
  const [lrcGenLineTimes, setLrcGenLineTimes] = createSignal<
    (number | undefined)[]
  >([])
  const [lrcGenWordTimings, setLrcGenWordTimings] =
    createSignal<WordTimingsMap>({})
  const [blocks, setBlocks] = createSignal<LyricsBlock[]>([])
  const [blockInstances, setBlockInstances] = createSignal<BlockInstancesMap>(
    {},
  )
  const [blockMarkMode, setBlockMarkMode] = createSignal(false)
  const [markStartLine, setMarkStartLine] = createSignal<number | null>(null)
  const [markEndLine, setMarkEndLine] = createSignal<number | null>(null)
  const [showBlockForm, setShowBlockForm] = createSignal(false)
  const [blockEditTarget, setBlockEditTarget] = createSignal<string | null>(
    null,
  )
  const [userScrolled, setUserScrolled] = createSignal(false)
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

  // Snapshot of pre-gen LRC state so Cancel can restore
  let preGenSnapshot: {
    wordTimings: WordTimingsMap
    lrcLines: LrcLine[]
    rawLyricsText: string
    lyricsLines: string[]
    lyricsSource: LyricsSource
  } | null = null

  // Track which lines were explicitly mapped during this gen session
  let touchedLines = new Set<number>()

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
    setEditMode(false)
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

  const persistBlocks = () => {
    // Update the cache and re-persist everything
    const cached = _lyricsCache()
    if (cached === null) return
    const updated = {
      ...cached,
      blocks: blocks(),
      blockInstances: blockInstances(),
    }
    _setLyricsCache(updated)
    void saveLyricsToDb(deps.sessionId, updated as LyricsData)
  }

  // ── Lyrics loading ───────────────────────────────────────────────

  const applyLyricsResult = (result: LyricsSearchResult, title: string) => {
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
    // Cancel any ongoing auto-search and open the picker for manual search
    cancelSearch()
    setSongMatches([])
    setSongPickerQuery('')
    setShowSongPicker(true)
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
      hydrateVersions(cache)
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
    setBlocks([])
    setBlockInstances({})
    setRawLyricsText(result.text)
    persistLyrics(
      result.text,
      result.format,
      result.filename,
      undefined,
      undefined,
      'imported',
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
      const genLines = getGenLines()
      let targetIdx = idx
      // Skip Rest/blank lines — land on the next real line
      while (
        targetIdx < genLines.length &&
        (!genLines[targetIdx].trim() || genLines[targetIdx].trim() === '~Rest~')
      ) {
        targetIdx++
      }
      if (targetIdx >= genLines.length) targetIdx = genLines.length
      setLrcGenLineIdx(targetIdx)
      setLrcGenWordIdx(0)
      saveLrcGenProgress()
    }

    const container = document.querySelector(
      LYRICS_CONTAINER_SELECTOR,
    ) as HTMLElement | null
    if (!container) return
    const lines = container.querySelectorAll('.sm-lyrics-line')
    if (idx < lines.length) {
      const line = lines[idx] as HTMLElement
      const containerRect = container.getBoundingClientRect()
      const lineRect = line.getBoundingClientRect()
      const scrollTarget =
        container.scrollTop +
        (lineRect.top - containerRect.top) -
        containerRect.height * 0.35
      isAutoScrolling = true
      container.scrollTo({ top: scrollTarget, behavior: 'smooth' })
      const resetAutoScroll = () => {
        isAutoScrolling = false
      }
      container.addEventListener('scrollend', resetAutoScroll, { once: true })
      setTimeout(() => {
        container.removeEventListener('scrollend', resetAutoScroll)
        isAutoScrolling = false
      }, 500)
    }
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

  // ── Block helpers ─────────────────────────────────────────────────

  const getBlockColor = (blockId: string): string => {
    let hash = 0
    for (let i = 0; i < blockId.length; i++)
      hash = (hash << 5) - hash + blockId.charCodeAt(i)
    return BLOCK_COLORS[Math.abs(hash) % BLOCK_COLORS.length]
  }

  const getBlockForLine = (
    lineIdx: number,
  ): { blockId: string; instanceIdx: number; isTemplate: boolean } | null => {
    const bi = blockInstances()
    for (const [blockId, instances] of Object.entries(bi)) {
      for (let i = 0; i < instances.length; i++) {
        const [start, end] = instances[i]
        if (lineIdx >= start && lineIdx < end) {
          return { blockId, instanceIdx: i, isTemplate: i === 0 }
        }
      }
    }
    return null
  }

  const getBlockById = (blockId: string): LyricsBlock | undefined => {
    return blocks().find((b) => b.id === blockId)
  }

  const detectBlockInstances = (
    textLines: string[],
    templateIndices: number[],
    existingInstances: BlockInstancesMap,
  ): number[][] => {
    const templateText = templateIndices.map((i) => textLines[i].trim())
    if (templateText.every((t) => !t)) return [templateIndices]

    const instances: number[][] = [templateIndices]
    const taken = new Set<number>()
    for (const insts of Object.values(existingInstances)) {
      for (const inst of insts) {
        for (let i = inst[0]; i < inst[1]; i++) taken.add(i)
      }
    }

    for (let i = 0; i < textLines.length; i++) {
      if (taken.has(i)) continue
      if (
        i >= templateIndices[0] &&
        i <= templateIndices[templateIndices.length - 1]
      )
        continue

      let match = true
      for (let j = 0; j < templateText.length; j++) {
        const checkLine = textLines[i + j]?.trim()
        if (checkLine !== templateText[j]) {
          match = false
          break
        }
      }
      if (match) {
        const instStart = i
        const instEnd = i + templateText.length
        instances.push([instStart, instEnd])
        for (let k = instStart; k < instEnd; k++) taken.add(k)
        i += templateText.length - 1
      }
    }
    return instances
  }

  // ── Block mark / unlink / delete handlers ──────────────────────────

  const handleMarkBlock = (label: string, repeatCount: number) => {
    const start = markStartLine()
    const end = markEndLine()
    if (start === null || end === null || start >= end) return

    const lines = getGenLines()
    const templateIndices: number[] = []
    for (let i = start; i < end; i++) templateIndices.push(i)

    const blockId = `${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`

    const instances =
      templateIndices.length >= 2
        ? detectBlockInstances(lines, templateIndices, blockInstances())
        : [templateIndices]

    const block: LyricsBlock = {
      id: blockId,
      label,
      lineIndices: templateIndices,
      repeatCount: Math.max(1, repeatCount),
    }
    setBlocks((prev) => [...prev, block])
    setBlockInstances((prev) => ({ ...prev, [blockId]: instances }))

    setMarkStartLine(null)
    setMarkEndLine(null)
    setBlockMarkMode(false)
    setShowBlockForm(false)
    persistBlocks()
  }

  const handleUnlinkInstance = (blockId: string, instanceIdx: number) => {
    if (instanceIdx === 0) {
      handleDeleteBlock(blockId)
      return
    }
    setBlockInstances((prev) => {
      const next = { ...prev }
      next[blockId] = prev[blockId].filter((_, i) => i !== instanceIdx)
      if (next[blockId].length <= 1) {
        delete next[blockId]
        setBlocks((prev) => prev.filter((b) => b.id !== blockId))
      }
      return next
    })
    persistBlocks()
  }

  const handleDeleteBlock = (blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId))
    setBlockInstances((prev) => {
      const next = { ...prev }
      delete next[blockId]
      return next
    })
    setBlockEditTarget(null)
    persistBlocks()
  }

  const handleAddInstance = (
    blockId: string,
    startIdx: number,
    endIdx: number,
  ) => {
    const block = getBlockById(blockId)
    if (!block) return
    setBlockInstances((prev) => {
      const next = { ...prev }
      next[blockId] = [...(prev[blockId] ?? []), [startIdx, endIdx]]
      return next
    })
    setMarkStartLine(null)
    setMarkEndLine(null)
    persistBlocks()
  }

  const handleEditBlock = (
    blockId: string,
    label: string,
    repeatCount: number,
  ) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? { ...b, label, repeatCount: Math.max(1, repeatCount) }
          : b,
      ),
    )
    setBlockEditTarget(null)
    persistBlocks()
  }

  // ── LRC gen helpers ───────────────────────────────────────────────

  const getGenLines = (): string[] => {
    if (lrcLines().length > 0) return canonicalLrcLines().map((e) => e.text)
    return lyricsLines()
  }

  const isTemplateMappedInGen = (blockId: string): boolean => {
    const block = getBlockById(blockId)
    if (!block) return false
    const lineTimes = lrcGenLineTimes()
    return block.lineIndices.every((i) => lineTimes[i] !== undefined)
  }

  const autoFillBlockInstance = (
    blockId: string,
    instanceIdx: number,
    instanceStartTime: number,
  ) => {
    const block = getBlockById(blockId)
    if (!block) return

    const instances = blockInstances()[blockId]
    if (instances === undefined || instanceIdx >= instances.length) return

    const [tplStart, tplEnd] = instances[0]
    const [instStart] = instances[instanceIdx]
    const tplBlockStart = lrcGenLineTimes()[tplStart]
    if (tplBlockStart === undefined) return

    const tplLineCount = tplEnd - tplStart
    const templateWordTimes = lrcGenWordTimings()

    for (let j = 0; j < tplLineCount; j++) touchedLines.add(instStart + j)
    setLrcGenLineTimes((prev) => {
      const next = [...prev]
      for (let j = 0; j < tplLineCount; j++) {
        const tplTime = prev[tplStart + j]
        if (tplTime !== undefined) {
          next[instStart + j] =
            Math.round((instanceStartTime + tplTime - tplBlockStart) * 1000) /
            1000
        }
      }
      return next
    })

    setLrcGenWordTimings((prev) => {
      const next: WordTimingsMap = {}
      for (const k of Object.keys(prev)) next[+k] = [...prev[+k]]
      for (let j = 0; j < tplLineCount; j++) {
        const tplWordTimes = templateWordTimes[tplStart + j]
        if (tplWordTimes !== undefined && tplWordTimes.length > 0) {
          next[instStart + j] = tplWordTimes.map(
            (tt) =>
              Math.round((instanceStartTime + tt - tplBlockStart) * 1000) /
              1000,
          )
        }
      }
      return next
    })
  }

  const expandAllBlockInstances = () => {
    const lineTimes = lrcGenLineTimes()
    for (const block of blocks()) {
      if (!isTemplateMappedInGen(block.id)) continue
      const instances = blockInstances()[block.id]
      if (instances === undefined || instances.length <= 1) continue
      const tplBlockStart = lineTimes[instances[0][0]]
      if (tplBlockStart === undefined) continue
      for (let i = 1; i < instances.length; i++) {
        const instStartTime = lineTimes[instances[i][0]]
        if (instStartTime === undefined) continue
        autoFillBlockInstance(block.id, i, instStartTime)
      }
    }
  }

  // ── LRC gen persistence ───────────────────────────────────────────

  const saveLrcGenProgress = () => {
    try {
      const payload = {
        lineTimes: lrcGenLineTimes(),
        wordTimings: lrcGenWordTimings(),
        lineIdx: lrcGenLineIdx(),
        wordIdx: lrcGenWordIdx(),
        timestamp: Date.now(),
      }
      localStorage.setItem(genKey(), JSON.stringify(payload))
    } catch {
      /* storage full */
    }
  }

  const clearLrcGenProgress = () => {
    try {
      localStorage.removeItem(genKey())
    } catch {
      /* ignore */
    }
  }

  // ── LRC gen actions ──────────────────────────────────────────────

  const startLrcGen = () => {
    const lines = getGenLines()
    if (lines.length === 0) return

    // Snapshot current LRC state so Cancel can restore it
    preGenSnapshot = {
      wordTimings: structuredClone(wordTimings()),
      lrcLines: structuredClone(lrcLines()),
      rawLyricsText: rawLyricsText(),
      lyricsLines: structuredClone(lyricsLines()),
      lyricsSource: lyricsSource(),
    }
    touchedLines = new Set()

    let resumeLineIdx = 0
    let resumeWordIdx = 0
    try {
      const saved = localStorage.getItem(genKey())
      if (saved !== null) {
        const data: Record<string, unknown> = JSON.parse(saved)
        if (Array.isArray(data.lineTimes) && data.lineTimes.length > 0) {
          setLrcGenLineTimes(data.lineTimes)
          if (
            typeof data.wordTimings === 'object' &&
            data.wordTimings !== null
          ) {
            setLrcGenWordTimings(data.wordTimings as Record<number, number[]>)
          }
          resumeLineIdx = Math.min((data.lineIdx as number) ?? 0, lines.length)
          resumeWordIdx = (data.wordIdx as number) ?? 0
        }
      }
    } catch {
      /* ignore */
    }

    if (resumeLineIdx === 0 && resumeWordIdx === 0) {
      // Build LRC→canonical index map so wordTimings (keyed by LRC index)
      // are placed at the correct canonical positions (which may include
      // synthetic ~Rest~ entries for large gaps).
      const canonical = canonicalLrcLines()
      const lrcToCanonical = buildLrcToCanonicalMap(canonical)

      const eb = editBuffer()
      if (Object.keys(eb).length > 0) {
        const lineTimes = new Array<number | undefined>(lines.length)
        const wordT: WordTimingsMap = {}
        for (const k of Object.keys(eb)) {
          const canonIdx = lrcToCanonical.get(+k)
          if (canonIdx !== undefined) {
            lineTimes[canonIdx] = eb[+k][0] ?? 0
            wordT[canonIdx] = [...eb[+k]]
          }
        }
        setLrcGenLineTimes(lineTimes)
        setLrcGenWordTimings(wordT)
      } else if (Object.keys(wordTimings()).length > 0) {
        const wt = wordTimings()
        const lineTimes = new Array<number | undefined>(lines.length)
        const wordT: WordTimingsMap = {}
        for (const k of Object.keys(wt)) {
          const canonIdx = lrcToCanonical.get(+k)
          if (canonIdx !== undefined) {
            lineTimes[canonIdx] = wt[+k][0] ?? 0
            wordT[canonIdx] = [...wt[+k]]
          }
        }
        setLrcGenLineTimes(lineTimes)
        setLrcGenWordTimings(wordT)
      } else {
        setLrcGenLineTimes([])
        setLrcGenWordTimings({})
      }
    }

    setLrcGenLineIdx(resumeLineIdx)
    setLrcGenWordIdx(resumeWordIdx)
    setEditMode(false)
    setLrcGenMode(true)
  }

  const advancePastBlankLine = (fromIdx: number, lines: string[]) => {
    let next = fromIdx + 1
    while (
      next < lines.length &&
      (!lines[next].trim() || lines[next].trim() === '~Rest~')
    )
      next++
    if (next >= lines.length) {
      setLrcGenLineIdx(lines.length)
      setLrcGenWordIdx(0)
      handleLrcGenFinish()
      return
    }
    setLrcGenLineIdx(next)
    setLrcGenWordIdx(0)
    saveLrcGenProgress()
  }

  // Taps land ~180ms after the sung sound (human audio→motor latency), so
  // every gen-mode stamp subtracts it — otherwise the whole map trails the
  // singer. A per-user metronome calibration can replace the constant later
  // (docs/plans/lyrics-word-sync.md).
  const TAP_LATENCY_SEC = 0.18
  const tapTime = () =>
    Math.max(0, Math.round((deps.elapsed() - TAP_LATENCY_SEC) * 1000) / 1000)

  const handleNextLine = () => {
    const t = tapTime()
    const lines = getGenLines()
    const idx = lrcGenLineIdx()
    if (idx >= lines.length) return

    if (!lines[idx].trim() || lines[idx].trim() === '~Rest~') {
      advancePastBlankLine(idx, lines)
      return
    }

    touchedLines.add(idx)
    setLrcGenLineTimes((prev) => {
      const next = [...prev]
      next[idx] = t
      return next
    })

    const blockInfo = getBlockForLine(idx)
    if (
      blockInfo &&
      !blockInfo.isTemplate &&
      isTemplateMappedInGen(blockInfo.blockId)
    ) {
      autoFillBlockInstance(blockInfo.blockId, blockInfo.instanceIdx, t)
      const instanceEnd =
        blockInstances()[blockInfo.blockId]?.[blockInfo.instanceIdx]?.[1] ??
        idx + 1
      if (instanceEnd >= lines.length) {
        setLrcGenLineIdx(lines.length)
        setLrcGenWordIdx(0)
        handleLrcGenFinish()
        return
      }
      setLrcGenLineIdx(instanceEnd)
      setLrcGenWordIdx(0)
      saveLrcGenProgress()
      return
    }

    const currentLine = lines[idx]
    const words = currentLine.split(/\s+/).filter((w: string) => w.length > 0)
    if (words.length > 0 && lrcGenWordIdx() > 0) {
      const lastWordTime = lrcGenWordTimings()[idx]?.[lrcGenWordIdx() - 1] ?? t
      const remain = words.length - lrcGenWordIdx()
      if (remain > 0) {
        setLrcGenWordTimings((prev) => {
          const next = { ...prev }
          next[idx] = [...(next[idx] ?? [])]
          for (let w = lrcGenWordIdx(); w < words.length; w++) {
            next[idx][w] =
              Math.round(
                (lastWordTime + (w - lrcGenWordIdx() + 1) * 0.25) * 1000,
              ) / 1000
          }
          return next
        })
      }
    }

    if (idx + 1 >= lines.length) {
      setLrcGenLineIdx(idx + 1)
      setLrcGenWordIdx(0)
      handleLrcGenFinish()
      return
    }
    setLrcGenLineIdx(idx + 1)
    setLrcGenWordIdx(0)
    saveLrcGenProgress()
  }

  const handleNextWord = () => {
    const lines = getGenLines()
    const lineIdx = lrcGenLineIdx()
    if (lineIdx >= lines.length) return

    if (!lines[lineIdx].trim() || lines[lineIdx].trim() === '~Rest~') {
      advancePastBlankLine(lineIdx, lines)
      return
    }

    const t = tapTime()
    const words = lines[lineIdx]
      .split(/\s+/)
      .filter((w: string) => w.length > 0)
    const wordIdx = lrcGenWordIdx()

    if (wordIdx === 0) {
      touchedLines.add(lineIdx)
      setLrcGenLineTimes((prev) => {
        const next = [...prev]
        next[lineIdx] = t
        return next
      })

      const blockInfo = getBlockForLine(lineIdx)
      if (
        blockInfo &&
        !blockInfo.isTemplate &&
        isTemplateMappedInGen(blockInfo.blockId)
      ) {
        autoFillBlockInstance(blockInfo.blockId, blockInfo.instanceIdx, t)
        const instanceEnd =
          blockInstances()[blockInfo.blockId]?.[blockInfo.instanceIdx]?.[1] ??
          lineIdx + 1
        if (instanceEnd >= lines.length) {
          setLrcGenLineIdx(lines.length)
          setLrcGenWordIdx(0)
          handleLrcGenFinish()
          return
        }
        setLrcGenLineIdx(instanceEnd)
        setLrcGenWordIdx(0)
        saveLrcGenProgress()
        return
      }
    }

    setLrcGenWordTimings((prev) => {
      const next: WordTimingsMap = {}
      for (const k of Object.keys(prev)) next[+k] = [...prev[+k]]
      if (next[lineIdx] === undefined) next[lineIdx] = []
      const arr = [...next[lineIdx]]
      arr[wordIdx] = t
      next[lineIdx] = arr
      return next
    })

    if (wordIdx + 1 >= words.length) {
      if (lineIdx + 1 >= lines.length) {
        setLrcGenLineIdx(lineIdx + 1)
        setLrcGenWordIdx(0)
        handleLrcGenFinish()
        return
      }
      setLrcGenLineIdx(lineIdx + 1)
      setLrcGenWordIdx(0)
      saveLrcGenProgress()
    } else {
      setLrcGenWordIdx(wordIdx + 1)
      saveLrcGenProgress()
    }
  }

  const handleLrcGenFinish = () => {
    expandAllBlockInstances()

    const canonical = canonicalLrcLines()
    const lines = getGenLines()
    const lineTimes = lrcGenLineTimes()
    const wordTimes = lrcGenWordTimings()

    // Guard: if no lines were mapped, treat as cancel
    if (touchedLines.size === 0 && lrcGenLineIdx() < lines.length) {
      handleLrcGenReset()
      return
    }

    // Build canonical<->LRC index maps for correct output
    const lrcToCanon = buildLrcToCanonicalMap(canonical)

    // Convert preGenSnapshot wordTimings from LRC->canonical indices
    const origWtLrc = preGenSnapshot?.wordTimings
    const origWtCanon: WordTimingsMap | undefined = origWtLrc
      ? (() => {
          const m: WordTimingsMap = {}
          for (const k of Object.keys(origWtLrc)) {
            const ci = lrcToCanon.get(+k)
            if (ci !== undefined) m[ci] = [...origWtLrc[+k]]
          }
          return m
        })()
      : undefined

    const allMapped = lrcGenLineIdx() >= lines.length

    let finalTimes: (number | undefined)[]
    let mergedWordTimesCanon: WordTimingsMap

    if (allMapped) {
      finalTimes = lineTimes.slice()
      mergedWordTimesCanon = wordTimes
    } else {
      // Partial merge: only update explicitly touched lines, preserve
      // original timings for untouched lines (from word timings or canonical
      // entries).  The canonical fallback is critical for line-level LRC that
      // has no word timings -- without it those lines become undefined and get
      // re-estimated, destroying the user's original timestamps.
      finalTimes = mergePartialLineTimes(
        lines,
        lineTimes,
        touchedLines,
        origWtCanon,
        canonical,
      )

      // Merge word timings: touched lines get new, rest keep original
      mergedWordTimesCanon = mergePartialWordTimings(
        touchedLines,
        origWtCanon,
        wordTimes,
      )

      // Fill gaps: interpolate between touched lines
      finalTimes = interpolateGaps(finalTimes, touchedLines, deps.duration())
    }

    // Estimate times for completely unmapped lines beyond the last touched line
    // so they get distributed across the remaining song duration instead of
    // collapsing to 0.
    const dur = deps.duration()
    if (dur > 0) {
      finalTimes = estimateUnmappedTimes(finalTimes, lines, dur)
    }

    // Enforce monotonic non-decreasing time order.
    finalTimes = enforceMonotonicTimes(finalTimes)

    // Determine original text to preserve for future re-gen.
    // Use the pre-gen snapshot's raw text if available, otherwise fall back
    // to the currently persisted original text or raw lyrics text.
    const snapshotOriginalText = (() => {
      const snapText = preGenSnapshot?.rawLyricsText
      if (snapText != null && snapText.length > 0) return snapText
      const persistedText = loadPersistedLyrics()?.originalText
      if (persistedText != null && persistedText.length > 0)
        return persistedText
      return rawLyricsText()
    })()

    let lrcText: string
    let mergedWordTimes: WordTimingsMap

    if (canonical.length > 0) {
      // LRC source: build from canonical entries with correct indices
      mergedWordTimes = {}
      for (const entry of canonical) {
        if (entry.lrcIndex < 0) continue // skip synthetic ~Rest~
        const ci = entry.canonicalIndex
        const wts = mergedWordTimesCanon[ci]
        if (wts !== undefined) mergedWordTimes[entry.lrcIndex] = wts
      }

      const rawLinesForText = finalTimes.map((t) => t ?? 0)
      lrcText = buildLrcTextFromCanonical(
        canonical,
        rawLinesForText,
        mergedWordTimes,
      )
    } else {
      // Plain text source: canonical is empty, build LRC directly from lines.
      // Use word-level output for lines with word timings, line-level for the rest.
      mergedWordTimes = { ...mergedWordTimesCanon }

      lrcText = lines
        .map((line, i) => {
          if (!line.trim()) return ''
          const lineWt = mergedWordTimes[i]
          const words = line.split(/\s+/).filter((w) => w.length > 0)
          if (lineWt !== undefined && lineWt.length > 0 && words.length > 0) {
            // Word-level output
            return words
              .map((w, wi) => {
                const t = lineWt[wi]
                return t !== undefined ? `[${formatTimeLrc(t)}] ${w}` : w
              })
              .join(' ')
          }
          // Line-level output with estimated/interpolated time
          const t = finalTimes[i] ?? 0
          return `[${formatTimeLrc(t)}] ${line}`
        })
        .filter((l) => l !== '')
        .join('\n')
    }

    // Safeguard: if the generated LRC is empty, do NOT overwrite the
    // persisted lyrics — treat this as a failed gen and restore snapshot.
    if (!lrcText.trim()) {
      console.warn(
        '[LRC Gen] Finish produced empty LRC text — aborting to prevent data loss',
      )
      handleLrcGenReset()
      return
    }

    const filename = loadPersistedLyrics()?.filename ?? 'generated.lrc'
    persistLyrics(
      lrcText,
      'lrc',
      filename,
      mergedWordTimes,
      snapshotOriginalText,
      'lrc-gen',
    )
    const parsed = parseLrcFile(lrcText)
    setLrcLines(parsed)
    setLyricsLines([])
    setWordTimings(mergedWordTimes)

    // Reset gen state fully
    setLrcGenMode(false)
    setLrcGenLineIdx(0)
    setLrcGenWordIdx(0)
    setLrcGenLineTimes([])
    setLrcGenWordTimings({})
    touchedLines = new Set()
    clearLrcGenProgress()
    preGenSnapshot = null
  }

  // ── Auto word-sync (vocal-stem onsets → word timings) ───────────
  /**
   * Generate word timings for every line automatically: words are laid out
   * across each line's [start, next start) span by syllable weight, then
   * snapped to vocal onsets detected on the separated stem. Needs
   * line-timed lyrics (canonical LRC). Returns how many lines got timings.
   */
  const applyAutoWordSync = (onsets: number[]): { linesSynced: number } => {
    const canonical = canonicalLrcLines()
    const dur = deps.duration()
    if (canonical.length === 0 || dur <= 0) return { linesSynced: 0 }

    const lineEntries = canonical.filter((e) => e.type === 'line')
    const auto: WordTimingsMap = {} // keyed by lrcIndex, like wordTimings()
    let synced = 0
    for (let i = 0; i < lineEntries.length; i++) {
      const entry = lineEntries[i]
      if (entry.lrcIndex < 0 || entry.words.length === 0) continue
      const lineStart = entry.time
      const lineEnd = Math.min(dur, lineEntries[i + 1]?.time ?? dur)
      if (lineEnd - lineStart < 0.1) continue
      const wt = autoTimeLineWords(entry.words, lineStart, lineEnd, onsets)
      if (wt.length === entry.words.length) {
        auto[entry.lrcIndex] = wt
        synced++
      }
    }
    if (synced === 0) return { linesSynced: 0 }

    const lrcText = buildLrcTextFromCanonical(canonical, undefined, auto)
    if (!lrcText.trim()) return { linesSynced: 0 }
    const persisted = loadPersistedLyrics()
    persistLyrics(
      lrcText,
      'lrc',
      persisted?.filename ?? 'auto-synced.lrc',
      auto,
      persisted?.originalText ?? rawLyricsText(),
      'auto-sync',
    )
    setLrcLines(parseLrcFile(lrcText))
    setLyricsLines([])
    setWordTimings(auto)
    return { linesSynced: synced }
  }

  const handleLrcGenReset = () => {
    // Cancel: restore pre-gen LRC state, don't touch anything
    if (preGenSnapshot) {
      setWordTimings(preGenSnapshot.wordTimings)
      setLrcLines(preGenSnapshot.lrcLines)
      setRawLyricsText(preGenSnapshot.rawLyricsText)
      setLyricsLines(preGenSnapshot.lyricsLines)
      setLyricsSource(preGenSnapshot.lyricsSource)
      preGenSnapshot = null
    }
    setLrcGenLineIdx(0)
    setLrcGenWordIdx(0)
    setLrcGenLineTimes([])
    setLrcGenWordTimings({})
    setLrcGenMode(false)
    clearLrcGenProgress()
  }

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

  // ── Memos ────────────────────────────────────────────────────────

  const canonicalLrcLines = createMemo<CanonicalLrcEntry[]>(() => {
    const lrc = lrcLines()
    if (lrc.length === 0) return []
    const base = buildCanonicalEntries(lrc)
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
        map.set(i, {
          key: `lrc-${i}`,
          time: entry.time,
          endTime,
          words: entry.words,
          wordTimes: entry.wordTimes,
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
      return canonical.map((entry) => ({
        text: entry.text,
        isBlank: false,
        isRest: entry.type === 'rest',
        lyricsIndex: entry.canonicalIndex,
        restGapStart: entry.gapStart,
        restGapEnd: entry.gapEnd,
        restDotCount: entry.dotCount,
      }))
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
    const curLine = lrcGenLineIdx()
    const curWord = lrcGenWordIdx()
    const lineTimes = lrcGenLineTimes()
    const wordTimes = lrcGenWordTimings()
    return lines.map((line: string, i: number) => {
      const words = line.split(/\s+/).filter((w: string) => w.length > 0)
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
        isCurrent: i === curLine,
        isDone: i < curLine,
        isFuture: i > curLine,
        lineTime: lineTimes[i],
        wordTimes: wordTimes[i],
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

  // ── Lyric scroll: user-scroll detection ────────────────────────

  const onLyricsScroll = () => {
    if (isAutoScrolling) return
    setUserScrolled(true)
    if (lyricsScrollTimeout) {
      clearTimeout(lyricsScrollTimeout)
      lyricsScrollTimeout = null
    }
    lyricsScrollTimeout = setTimeout(() => {
      const container = document.querySelector(
        LYRICS_CONTAINER_SELECTOR,
      ) as HTMLElement | null
      if (!container) return
      const idx = currentLineIdx()
      if (idx < 0) return
      const lines = container.querySelectorAll('.sm-lyrics-line')
      if (idx < lines.length) {
        const activeLine = lines[idx] as HTMLElement
        const containerRect = container.getBoundingClientRect()
        const lineRect = activeLine.getBoundingClientRect()
        if (lineRect.top - containerRect.top < containerRect.height * 0.6) {
          setUserScrolled(false)
        }
      }
      lyricsScrollTimeout = null
    }, 800)
  }

  const attachScrollListener = () => {
    const container = document.querySelector(
      LYRICS_CONTAINER_SELECTOR,
    ) as HTMLElement | null
    if (container !== lyricsScrollContainer) {
      if (lyricsScrollContainer) {
        lyricsScrollContainer.removeEventListener('scroll', onLyricsScroll)
      }
      lyricsScrollContainer = container
      if (container) {
        container.addEventListener('scroll', onLyricsScroll, { passive: true })
      }
    }
  }

  createEffect(() => {
    const _lyrics = lyricsSource()
    const _edit = editMode()
    const _lrcGen = lrcGenMode()
    void _lyrics
    void _edit
    void _lrcGen
    setTimeout(() => attachScrollListener(), 0)
  })

  // ── Auto-scroll effect ────────────────────────────────────────────

  createEffect(() => {
    const idx = currentLineIdx()
    if (!deps.playing() || idx < 0) return
    if (userScrolled()) return
    const container = document.querySelector(
      LYRICS_CONTAINER_SELECTOR,
    ) as HTMLElement | null
    if (!container) return
    const lines = container.querySelectorAll('.sm-lyrics-line')
    if (idx < lines.length) {
      const activeLine = lines[idx] as HTMLElement
      const containerRect = container.getBoundingClientRect()
      const lineRect = activeLine.getBoundingClientRect()
      const thresholdBottom = containerRect.top + containerRect.height * 0.57
      const thresholdTop = containerRect.top + containerRect.height * 0.15
      const needsScrollDown = lineRect.bottom > thresholdBottom
      const needsScrollUp = lineRect.top < thresholdTop
      if (needsScrollDown || needsScrollUp) {
        const scrollTarget =
          container.scrollTop +
          (lineRect.top - containerRect.top) -
          containerRect.height * 0.35
        isAutoScrolling = true
        container.scrollTo({ top: scrollTarget, behavior: 'smooth' })
        const resetAutoScroll = () => {
          isAutoScrolling = false
        }
        container.addEventListener('scrollend', resetAutoScroll, { once: true })
        setTimeout(() => {
          container.removeEventListener('scrollend', resetAutoScroll)
          isAutoScrolling = false
        }, 500)
      }
    }
  })

  // ── Auto-scroll effect for LRC gen mode ──────────────────────────

  createEffect(() => {
    const idx = lrcGenLineIdx()
    if (!lrcGenMode()) return
    const container = document.querySelector(
      '.sm-lyrics-gen-lines',
    ) as HTMLElement | null
    if (!container) return
    const lineEls = container.querySelectorAll('.sm-lyrics-gen-line')
    if (idx < lineEls.length) {
      const activeLine = lineEls[idx] as HTMLElement
      const containerRect = container.getBoundingClientRect()
      const lineRect = activeLine.getBoundingClientRect()
      const thresholdBottom = containerRect.top + containerRect.height * 0.6
      const thresholdTop = containerRect.top + containerRect.height * 0.15
      const needsScrollDown = lineRect.bottom > thresholdBottom
      const needsScrollUp = lineRect.top < thresholdTop
      if (needsScrollDown || needsScrollUp) {
        const scrollTarget =
          container.scrollTop +
          (lineRect.top - containerRect.top) -
          containerRect.height * 0.35
        container.scrollTo({ top: scrollTarget, behavior: 'smooth' })
      }
    }
  })

  // ── Cleanup ───────────────────────────────────────────────────────

  onCleanup(() => {
    if (lyricsScrollContainer) {
      lyricsScrollContainer.removeEventListener('scroll', onLyricsScroll)
      lyricsScrollContainer = null
    }
    if (lyricsScrollTimeout) {
      clearTimeout(lyricsScrollTimeout)
      lyricsScrollTimeout = null
    }
    isAutoScrolling = false
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
    editBuffer,
    setEditBuffer,
    editPopover,
    setEditPopover,
    lrcGenMode,
    lrcGenLineIdx,
    lrcGenWordIdx,
    lrcGenLineTimes,
    lrcGenWordTimings,
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

    // Actions — LRC gen
    startLrcGen,
    handleNextLine,
    handleNextWord,
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
  }
}
