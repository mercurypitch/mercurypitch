// ============================================================
// StemMixer Lyrics Controller — lyrics/LRC gen/blocks state + actions
// ============================================================

import type { Setter } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import type { LrcLine, LyricsSearchMatch, LyricsSearchResult, } from '@/lib/lyrics-service'
import { computeActiveWord, extractTitle, fetchLyricsById, getCurrentLineIndex, getCurrentLrcIndex, parseLrcFile, parseLrcWordTimings, parseTextLyrics, searchLyrics, searchLyricsMulti, } from '@/lib/lyrics-service'
import type { BlockInstancesMap, BlockStartsInfo, CanonicalLrcEntry, DisplayLine, EditPopover, GenViewLine, LyricsBlock, LyricsSource, LyricsUploadResult, WordTimingsMap, } from './types'

// ── Deps ──────────────────────────────────────────────────────────

export interface StemMixerLyricsDeps {
  sessionId: string
  songTitle: string
  duration: () => number
  playing: () => boolean
  elapsed: () => number
  seekTo: (t: number) => void
  windowDuration: () => number
  setWindowStart: (v: number) => void
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
  lrcGenLineTimes: () => number[]
  lrcGenWordTimings: () => WordTimingsMap
  setLrcGenLineTimes: Setter<number[]>
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
  ) => { activeUpTo: number; charProgress: number }

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
    | (LyricsUploadResult & { wordTimings?: WordTimingsMap; rawText?: string })
    | null
  persistLyrics: (
    text: string,
    format: 'txt' | 'lrc',
    filename: string,
    wt?: WordTimingsMap,
    rawText?: string,
  ) => void
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

const formatTimeLrcWord = (secs: number): string => {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, '0')
  const s = (secs % 60).toFixed(2).padStart(5, '0')
  return `${m}:${s}`
}

// ── Controller factory ─────────────────────────────────────────────

export function useStemMixerLyricsController(
  deps: StemMixerLyricsDeps,
): StemMixerLyricsController {
  const storageKey = () => `lyrics_v1_${deps.sessionId}`
  const genKey = () => `lyrics_gen_v1_${deps.sessionId}`

  const LYRICS_CONTAINER_SELECTOR =
    '.sm-lyrics-lines:not(.sm-lyrics-gen-lines):not(.sm-lyrics-lines-edit)'

  let lyricsScrollContainer: HTMLElement | null = null
  let isAutoScrolling = false
  let lyricsScrollTimeout: ReturnType<typeof setTimeout> | null = null

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
  const [lyricsFontSize, setLyricsFontSize] = createSignal(1.3)
  const [lyricsColumns, setLyricsColumns] = createSignal<1 | 2>(1)
  const [editMode, setEditMode] = createSignal(false)
  const [wordTimings, setWordTimings] = createSignal<WordTimingsMap>({})
  const [editBuffer, setEditBuffer] = createSignal<WordTimingsMap>({})
  const [editPopover, setEditPopover] = createSignal<EditPopover | null>(null)
  const [lrcGenMode, setLrcGenMode] = createSignal(false)
  const [lrcGenLineIdx, setLrcGenLineIdx] = createSignal(0)
  const [lrcGenWordIdx, setLrcGenWordIdx] = createSignal(0)
  const [lrcGenLineTimes, setLrcGenLineTimes] = createSignal<number[]>([])
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

  // ── Persistence ──────────────────────────────────────────────────

  const persistLyrics = (
    text: string,
    format: 'txt' | 'lrc',
    filename: string,
    wt?: WordTimingsMap,
    rawText?: string,
  ) => {
    try {
      const payload: Record<string, unknown> = {
        text,
        format,
        filename,
        timestamp: Date.now(),
      }
      if (wt && Object.keys(wt).length > 0) payload.wordTimings = wt
      if (rawText !== undefined) payload.rawText = rawText
      const bl = blocks()
      if (bl.length > 0) payload.blocks = bl
      const bi = blockInstances()
      if (Object.keys(bi).length > 0) payload.blockInstances = bi
      payload.fontSize = lyricsFontSize()
      localStorage.setItem(storageKey(), JSON.stringify(payload))
    } catch {
      /* storage full or unavailable */
    }
  }

  const loadPersistedLyrics = ():
    | (LyricsUploadResult & {
        wordTimings?: WordTimingsMap
        rawText?: string
      })
    | null => {
    try {
      const raw = localStorage.getItem(storageKey())
      if (raw === null) return null
      const data: Record<string, unknown> = JSON.parse(raw)
      if (
        typeof data.text === 'string' &&
        (data.format === 'txt' || data.format === 'lrc')
      ) {
        const result: LyricsUploadResult & {
          wordTimings?: WordTimingsMap
          rawText?: string
        } = {
          text: data.text,
          format: data.format,
          filename:
            typeof data.filename === 'string' ? data.filename : 'saved.txt',
        }
        if (typeof data.rawText === 'string') {
          result.rawText = data.rawText
        }
        if (typeof data.wordTimings === 'object') {
          result.wordTimings = data.wordTimings as WordTimingsMap
        }
        if (typeof data.fontSize === 'number') setLyricsFontSize(data.fontSize)
        if (Array.isArray(data.blocks)) setBlocks(data.blocks as LyricsBlock[])
        if (typeof data.blockInstances === 'object') {
          setBlockInstances(data.blockInstances as BlockInstancesMap)
        }
        return result
      }
    } catch {
      /* corrupted data */
    }
    return null
  }

  const persistBlocks = () => {
    try {
      const key = storageKey()
      const raw = localStorage.getItem(key)
      if (raw === null) return
      const data = JSON.parse(raw)
      data.blocks = blocks()
      data.blockInstances = blockInstances()
      localStorage.setItem(key, JSON.stringify(data))
    } catch {
      /* ignore */
    }
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
    persistLyrics(result.text, result.format, `${title}.${result.format}`)
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

  const handleForceSearch = async () => {
    setLyricsLoading(true)
    const title = extractTitle(deps.songTitle ?? deps.sessionId ?? '')
    try {
      const results = await searchLyricsMulti(title)
      setSongMatches(results)
      setSongPickerQuery(title)
      setShowSongPicker(true)
    } catch {
      // keep existing
    } finally {
      setLyricsLoading(false)
    }
  }

  const loadLyrics = async () => {
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
      setLyricsSource('upload')
      return
    }

    const rawInput = deps.songTitle ?? deps.sessionId ?? ''
    const title = extractTitle(rawInput)
    if (!title || title === 'Unknown') {
      setLyricsSource('none')
      return
    }

    setLyricsLoading(true)
    try {
      const multiResults = await searchLyricsMulti(title)
      if (multiResults.length === 1) {
        const match = multiResults[0]
        const lyrics = await fetchLyricsById(match.id)
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

      const result = await searchLyrics(title)
      if (result) {
        applyLyricsResult(result, title)
        setLyricsSource('api')
      } else {
        setLyricsSource('none')
      }
    } catch {
      setLyricsSource('none')
    } finally {
      setLyricsLoading(false)
    }
  }

  const handleLyricsUpload = (result: LyricsUploadResult) => {
    setBlocks([])
    setBlockInstances({})
    setRawLyricsText(result.text)
    persistLyrics(result.text, result.format, result.filename)
    if (result.format === 'lrc') {
      setLrcLines(parseLrcFile(result.text))
      setLyricsLines([])
    } else {
      setLyricsLines(parseTextLyrics(result.text))
      setLrcLines([])
    }
    setLyricsSource('upload')
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
    if (lrcLines().length > 0) {
      setCurrentLineIdx(getCurrentLrcIndex(lrcLines(), deps.elapsed()))
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
    const canonical = canonicalLrcLines()
    if (canonical.length > 0 && idx < canonical.length) {
      targetTime = canonical[idx].time
    } else if (lyricsLines().length > 0 && deps.duration() > 0) {
      targetTime = (idx / lyricsLines().length) * deps.duration()
    }
    if (targetTime === null) return
    deps.seekTo(targetTime)
    deps.setWindowStart(Math.max(0, targetTime - deps.windowDuration() * 0.3))

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
      text = canonical
        .map((entry) => {
          if (entry.type === 'rest') {
            if (entry.lrcIndex === -1) return ''
            const lineTime = merged[entry.lrcIndex]?.[0] ?? entry.time
            return `[${formatTimeLrcWord(lineTime)}] ~Rest~`
          }
          const lineTime = merged[entry.lrcIndex]?.[0] ?? entry.time
          return `[${formatTimeLrcWord(lineTime)}] ${entry.text}`
        })
        .filter((l) => l !== '')
        .join('\n')
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

    persistLyrics(text, 'lrc', filename, merged)
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
      const eb = editBuffer()
      if (Object.keys(eb).length > 0) {
        setLrcGenLineTimes(
          Object.keys(eb)
            .map((k) => eb[+k][0] ?? 0)
            .slice(0, lines.length),
        )
        setLrcGenWordTimings(structuredClone(eb))
      } else if (Object.keys(wordTimings()).length > 0) {
        const wt = wordTimings()
        setLrcGenLineTimes(
          Object.keys(wt)
            .map((k) => wt[+k][0] ?? 0)
            .slice(0, lines.length),
        )
        setLrcGenWordTimings(structuredClone(wt))
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

  const handleNextLine = () => {
    const t = Math.round(deps.elapsed() * 1000) / 1000
    const lines = getGenLines()
    const idx = lrcGenLineIdx()
    if (idx >= lines.length) return

    if (!lines[idx].trim() || lines[idx].trim() === '~Rest~') {
      advancePastBlankLine(idx, lines)
      return
    }

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

    const t = Math.round(deps.elapsed() * 1000) / 1000
    const words = lines[lineIdx]
      .split(/\s+/)
      .filter((w: string) => w.length > 0)
    const wordIdx = lrcGenWordIdx()

    if (wordIdx === 0) {
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

    const lines = getGenLines()
    const lineTimes = lrcGenLineTimes()
    const wordTimes = lrcGenWordTimings()
    const rawText = lines.join('\n')

    const lastMappedIdx =
      lineTimes.length > 0
        ? lineTimes.reduce(
            (best, _t, i) => (lineTimes[i] !== undefined ? i : best),
            -1,
          )
        : -1
    const lastMappedTime = lastMappedIdx >= 0 ? lineTimes[lastMappedIdx] : 0
    const allUnmapped = lines.reduce<number[]>((acc, _line, i) => {
      if (i > lastMappedIdx && lineTimes[i] === undefined) acc.push(i)
      return acc
    }, [])
    const songEnd = deps.duration() || lastMappedTime + allUnmapped.length * 4

    const finalTimes: (number | undefined)[] = lineTimes.slice()
    if (allUnmapped.length > 0) {
      const gap = songEnd - lastMappedTime
      allUnmapped.forEach((lineIdx, pos) => {
        finalTimes[lineIdx] =
          Math.round(
            (lastMappedTime + gap * ((pos + 1) / (allUnmapped.length + 1))) *
              1000,
          ) / 1000
      })
    }

    const lrcText = lines
      .map((line: string, i: number) => {
        const lt = finalTimes[i]
        if (!line.trim()) {
          if (lt === undefined) return ''
          return `[${formatTimeLrcWord(lt)}] ~Rest~`
        }
        if (lt === undefined) return `[00:00.00] ${line}`
        return `[${formatTimeLrcWord(lt)}] ${line}`
      })
      .join('\n')

    const filename = loadPersistedLyrics()?.filename ?? 'generated.lrc'
    persistLyrics(lrcText, 'lrc', filename, wordTimes, rawText)
    const parsed = parseLrcFile(lrcText)
    setLrcLines(parsed)
    setLyricsLines([])
    setWordTimings(wordTimes)
    setLrcGenMode(false)
    clearLrcGenProgress()
  }

  const handleLrcGenReset = () => {
    setLrcGenLineIdx(0)
    setLrcGenWordIdx(0)
    setLrcGenLineTimes([])
    setLrcGenWordTimings({})
    clearLrcGenProgress()
  }

  const handleDownloadLrc = () => {
    let lrcText = ''
    const filename = loadPersistedLyrics()?.filename ?? 'lyrics.lrc'

    const persisted = loadPersistedLyrics()
    const savedWt = persisted?.wordTimings
    const hasWordTimings = savedWt && Object.keys(savedWt).length > 0
    const rawText = persisted?.rawText

    if (hasWordTimings === true && rawText !== undefined) {
      const lines = rawText.split('\n')
      lrcText = lines
        .map((line: string, i: number) => {
          if (!line.trim()) return ''
          const wordList = line.split(/\s+/).filter((w: string) => w.length > 0)
          const lineWt = savedWt[i]
          if (
            lineWt === undefined ||
            lineWt.length === 0 ||
            wordList.length === 0
          ) {
            return `[00:00.00] ${line}`
          }
          return wordList
            .map((w: string, wi: number) => {
              const t = lineWt[wi]
              return t !== undefined ? `[${formatTimeLrcWord(t)}] ${w}` : w
            })
            .join(' ')
        })
        .filter((l: string) => l !== '')
        .join('\n')
    } else if (lrcLines().length > 0) {
      const canonical = canonicalLrcLines()
      const wt = wordTimings()
      const hasWt = Object.keys(wt).length > 0
      lrcText = canonical
        .map((entry) => {
          if (entry.type === 'rest') {
            if (entry.lrcIndex === -1) return ''
            return `[${formatTimeLrcWord(entry.time)}] ~Rest~`
          }
          const i = entry.lrcIndex
          if (hasWt) {
            const lineWt = wt[i]
            if (
              lineWt !== undefined &&
              lineWt.length > 0 &&
              entry.words.length > 0
            ) {
              return entry.words
                .map((w: string, wi: number) => {
                  const t = lineWt[wi]
                  return t !== undefined ? `[${formatTimeLrcWord(t)}] ${w}` : w
                })
                .join(' ')
            }
          }
          return `[${formatTimeLrcWord(entry.time)}] ${entry.text}`
        })
        .filter((l: string) => l !== '')
        .join('\n')
    } else if (lyricsLines().length > 0) {
      const wt = wordTimings()
      const hasWt = Object.keys(wt).length > 0
      lrcText = lyricsLines()
        .map((line, i) => {
          if (!line.trim()) return ''
          if (hasWt) {
            const lineWt = wt[i]
            const words = line.split(/\s+/).filter((w: string) => w.length > 0)
            if (lineWt !== undefined && lineWt.length > 0 && words.length > 0) {
              return words
                .map((w: string, wi: number) => {
                  const t = lineWt[wi]
                  return t !== undefined ? `[${formatTimeLrcWord(t)}] ${w}` : w
                })
                .join(' ')
            }
          }
          return `[00:00.00] ${line}`
        })
        .join('\n')
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

    const REST_THRESHOLD = 20
    const result: CanonicalLrcEntry[] = []

    for (let i = 0; i < lrc.length; i++) {
      const line = lrc[i]
      const gap = i > 0 ? line.time - lrc[i - 1].time : 0

      // Insert synthetic ~Rest~ for large gaps (only when prev line wasn't already ~Rest~)
      if (gap > REST_THRESHOLD) {
        result.push({
          type: 'rest',
          lrcIndex: -1,
          canonicalIndex: result.length,
          time: lrc[i - 1].time + gap / 2,
          text: '~Rest~',
          words: [],
        })
      }

      // If lrcLine itself is ~Rest~, treat it as type rest with real lrcIndex
      if (line.text === '~Rest~') {
        result.push({
          type: 'rest',
          lrcIndex: i,
          canonicalIndex: result.length,
          time: line.time,
          text: '~Rest~',
          words: [],
        })
        continue
      }

      const parsedWt = parseLrcWordTimings(line.text, line.time)
      const words = parsedWt
        ? parsedWt.words
        : line.text.split(/\s+/).filter((w: string) => w.length > 0)

      result.push({
        type: 'line',
        lrcIndex: i,
        canonicalIndex: result.length,
        time: line.time,
        text: line.text,
        words,
        wordTimes: parsedWt?.wordTimes,
      })
    }

    return result
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
        const endTime = i + 1 < canonical.length ? canonical[i + 1].time : dur
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

  const hasMultipleSections = () => lyricsSections().length >= 2

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
      const threshold = containerRect.top + containerRect.height * 0.57
      if (lineRect.bottom > threshold) {
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

    // Memos
    canonicalLrcLines,
    stableParsedLyrics,
    blockStarts,
    displayLines,
    lyricsSections,
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
  }
}
