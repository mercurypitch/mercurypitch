// ============================================================
// useLrcGenController — the LRC mapping session
// ============================================================
//
// Split out of useStemMixerLyricsController, which had grown past 3,200 lines
// and was the single file every mapper feature had to edit. This owns one
// concern end to end: the mapping session — its cursor, its passes, its tap
// and marker input, its preview, its autosave, and the merge back into the
// saved lyrics when it finishes.
//
// The seam is deliberately state-shaped rather than behaviour-shaped: the
// signals that only the mapping session touches moved in with the code, so
// the interface below is the genuinely shared state, not an accident of where
// a `createSignal` happened to be written.
//
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 0).

import type { Accessor, Setter } from 'solid-js'
import { createEffect, createMemo, createSignal, untrack } from 'solid-js'
import { buildLrcToCanonicalMap } from '@/lib/canonical-lrc'
import { buildLrcTextFromCanonical, estimateUnmappedTimes, formatTimeLrc, } from '@/lib/lrc-generator'
import type { SungNote } from '@/lib/lyric-sung-end'
import { appendWordSweepSample, beginWordSweep } from '@/lib/lyric-sweep'
import type { LrcLine } from '@/lib/lyrics-service'
import { parseLrcFile } from '@/lib/lyrics-service'
import type { LyricsVersionKind } from '@/lib/lyrics-versions'
import { createPersistedSignal } from '@/lib/storage'
import { autoTimeLineWords } from '@/lib/word-sync'
import { enforceMonotonicTimes, interpolateGaps, isSessionFullyMapped, mergePartialLineTimes, mergePartialWordTimings, restoreGenLineTimes, restoreGenMap, restoreLineTimes, restoreTouchedLines, restoreWordSweepTimingsMap, restoreWordTimingsMap, } from './lrc-gen-engine'
import type { GenCursor, LrcGenPass, PreviewWordHighlight, } from './lrc-gen-passes'
import { activeLineAt, countWordPassLines, isMappableLine, lineEndTime, nextCursorAfterLine, nextWordPassLine, normalizePass, preRollTarget, PREVIEW_TAIL_SEC, previewWordAt, seedWordPassTimings, wordPassCursorFrom, wordPassLinesBefore, } from './lrc-gen-passes'
import type { BlockInfo, BlockInstancesMap, CanonicalLrcEntry, GenViewLine, LrcGenInputMode, LyricsBlock, LyricsSource, LyricsTimingExtension, LyricsUploadResult, WordSweepTimingsMap, WordTimingsMap, } from './types'

/**
 * What the mapping session needs from the lyrics controller around it.
 *
 * Everything here is state the session reads or writes but does not own —
 * the saved lyrics it maps against, and the blocks it auto-fills through.
 * Anything the session alone touches was moved into this file instead.
 */
export interface LrcGenControllerDeps {
  sessionId: string
  elapsed: () => number
  playing: () => boolean
  seekToWithWindow: (t: number) => void
  duration: () => number
  melodyNotes?: () => SungNote[] | undefined

  // Saved lyrics — the mapping session's input and its commit target.
  lyricsLines: Accessor<string[]>
  setLyricsLines: Setter<string[]>
  lrcLines: Accessor<LrcLine[]>
  setLrcLines: Setter<LrcLine[]>
  rawLyricsText: Accessor<string>
  setRawLyricsText: Setter<string>
  lyricsSource: Accessor<LyricsSource>
  setLyricsSource: Setter<LyricsSource>
  canonicalLrcLines: Accessor<CanonicalLrcEntry[]>

  wordTimings: Accessor<WordTimingsMap>
  setWordTimings: Setter<WordTimingsMap>
  wordEndTimings: Accessor<WordTimingsMap>
  setWordEndTimings: Setter<WordTimingsMap>
  wordSweepTimings: Accessor<WordSweepTimingsMap>
  setWordSweepTimings: Setter<WordSweepTimingsMap>

  editBuffer: Accessor<WordTimingsMap>
  setEditMode: Setter<boolean>

  // Blocks — the session auto-fills repeated instances as it maps a template.
  blocks: Accessor<LyricsBlock[]>
  blockInstances: Accessor<BlockInstancesMap>
  getBlockById: (blockId: string) => LyricsBlock | undefined
  getBlockForLine: (lineIdx: number) => BlockInfo | null

  genViewData: Accessor<GenViewLine[]>
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
    timingExtension?: LyricsTimingExtension,
  ) => void
}

/**
 * The mapping session's public surface.
 *
 * Written out rather than inferred on purpose: the lyrics controller passes
 * `genViewData` back in as a dep, so an inferred return type would be
 * circular and TypeScript would silently widen the whole thing to `unknown`.
 */
export interface LrcGenController {
  lrcGenMode: Accessor<boolean>
  setLrcGenMode: Setter<boolean>
  lrcGenInputMode: Accessor<LrcGenInputMode>
  setLrcGenInputMode: Setter<LrcGenInputMode>
  lrcGenPass: Accessor<LrcGenPass>
  setLrcGenPass: (pass: LrcGenPass) => void
  lrcGenLineIdx: Accessor<number>
  lrcGenWordIdx: Accessor<number>
  lrcGenLineTimes: Accessor<(number | undefined)[]>
  setLrcGenLineTimes: Setter<(number | undefined)[]>
  lrcGenWordTimings: Accessor<WordTimingsMap>
  setLrcGenWordTimings: Setter<WordTimingsMap>
  lrcGenWordEndTimings: Accessor<WordTimingsMap>
  lrcGenWordSweepTimings: Accessor<WordSweepTimingsMap>
  lrcTimingOffsetMs: Accessor<number>
  setLrcTimingOffsetMs: Setter<number>

  previewLineIdx: Accessor<number | null>
  previewLoop: Accessor<boolean>
  setPreviewLoop: Setter<boolean>
  liveHighlight: Accessor<boolean>
  setLiveHighlight: Setter<boolean>
  highlightWord: Accessor<(PreviewWordHighlight & { lineIdx: number }) | null>
  toggleLinePreview: (idx: number, loop: boolean) => boolean
  stopLinePreview: () => void

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
  handleLrcGenReset: () => void
  applyAutoWordSync: (onsets: number[]) => { linesSynced: number }
  wordPassProgress: () => { done: number; total: number }
  /** Whether `idx` was mapped in this sitting rather than inherited. */
  isLineTouched: (idx: number) => boolean

  /** Move the mapping cursor onto `idx`, skipping blanks and rests. */
  focusGenLine: (idx: number) => void
  /** Clear the whole session — used when the lyrics underneath change. */
  resetGenState: () => void

  getGenLines: () => string[]
  getGenWords: (line: string) => string[]
  isTemplateMappedInGen: (blockId: string) => boolean
  expandAllBlockInstances: () => void
  saveLrcGenProgress: () => void
  flushLrcGenProgress: () => void
  clearLrcGenProgress: () => void
}

export function useLrcGenController(
  deps: LrcGenControllerDeps,
): LrcGenController {
  const genKey = () => `lyrics_gen_v1_${deps.sessionId}`

  const [lrcGenMode, setLrcGenMode] = createSignal(false)
  const [lrcGenInputMode, setLrcGenInputMode] =
    createSignal<LrcGenInputMode>('marker')
  // 'all' maps everything in one stream, 'lines'/'words' split the two jobs.
  // See ./lrc-gen-passes.ts. Defaults to 'all' — the flow that existed before
  // the split, so nobody is moved into a new mode without asking for it.
  const [lrcGenPass, setLrcGenPassSignal] = createSignal<LrcGenPass>('all')
  // Line being auditioned with the runtime highlighter. Independent of the
  // mapping cursor: you can preview a line you are not standing on.
  const [previewLineIdx, setPreviewLineIdx] = createSignal<number | null>(null)
  const [previewLoop, setPreviewLoop] = createSignal(false)
  // Runtime-style highlighting across every mapped line while the song plays,
  // driven by the timings being edited. Lets the operator check their work
  // where they made it instead of leaving the mapper to watch playback.
  const [liveHighlight, setLiveHighlight] = createSignal(false)
  const [lrcTimingOffsetMs, setPersistedLrcTimingOffsetMs] =
    createPersistedSignal<number>('pitchperfect_lyrics_timing_offset_ms', 180)
  const clampTimingOffset = (value: number) => Math.max(0, Math.min(500, value))
  let timingOffsetSec = clampTimingOffset(lrcTimingOffsetMs()) / 1000
  const setLrcTimingOffsetMs: Setter<number> = (value) => {
    const resolved =
      typeof value === 'function' ? value(lrcTimingOffsetMs()) : value
    const clamped = clampTimingOffset(resolved)
    timingOffsetSec = clamped / 1000
    return setPersistedLrcTimingOffsetMs(clamped)
  }
  createEffect(() => {
    timingOffsetSec = clampTimingOffset(lrcTimingOffsetMs()) / 1000
  })
  const [lrcGenLineIdx, setLrcGenLineIdx] = createSignal(0)
  const [lrcGenWordIdx, setLrcGenWordIdx] = createSignal(0)
  const [lrcGenLineTimes, setLrcGenLineTimes] = createSignal<
    (number | undefined)[]
  >([])
  const [lrcGenWordTimings, setLrcGenWordTimings] =
    createSignal<WordTimingsMap>({})
  const [lrcGenWordEndTimings, setLrcGenWordEndTimings] =
    createSignal<WordTimingsMap>({})
  const [lrcGenWordSweepTimings, setLrcGenWordSweepTimings] =
    createSignal<WordSweepTimingsMap>({})

  // Snapshot of pre-gen LRC state so Cancel can restore
  let preGenSnapshot: {
    wordTimings: WordTimingsMap
    wordEndTimings: WordTimingsMap
    wordSweepTimings: WordSweepTimingsMap
    lrcLines: LrcLine[]
    rawLyricsText: string
    lyricsLines: string[]
    lyricsSource: LyricsSource
  } | null = null

  // Track which lines were explicitly mapped during this gen session.
  //
  // A plain Set rather than a signal: it is written on every word transition,
  // and reallocating it there to satisfy Solid's equality check would put an
  // allocation on the hottest path in the mapper. The counter beside it is
  // what the view subscribes to — bumped by markTouched/unmarkTouched, which
  // are the only writers.
  let touchedLines = new Set<number>()
  const [touchedVersion, setTouchedVersion] = createSignal(0)
  const bumpTouched = () => setTouchedVersion((v) => v + 1)

  const markTouched = (idx: number) => {
    if (touchedLines.has(idx)) return
    touchedLines.add(idx)
    bumpTouched()
  }

  const unmarkTouched = (idx: number) => {
    if (!touchedLines.delete(idx)) return
    bumpTouched()
  }

  /**
   * Whether `idx` was mapped in this sitting, as opposed to inherited from
   * whatever the song already held. Reactive — the mapper distinguishes the
   * two, because after a resume most of the timings on screen are not yours.
   */
  const isLineTouched = (idx: number): boolean => {
    touchedVersion()
    return touchedLines.has(idx)
  }

  // ── LRC gen helpers ───────────────────────────────────────────────

  let cachedGenCanonical: CanonicalLrcEntry[] | null = null
  let cachedGenLines: string[] = []
  const genWordsCache = new Map<string, string[]>()
  const getGenLines = (): string[] => {
    if (deps.lrcLines().length > 0) {
      const canonical = deps.canonicalLrcLines()
      if (canonical !== cachedGenCanonical) {
        cachedGenCanonical = canonical
        cachedGenLines = canonical.map((entry) => entry.text)
      }
      return cachedGenLines
    }
    return deps.lyricsLines()
  }
  const getGenWords = (line: string): string[] => {
    const cached = genWordsCache.get(line)
    if (cached !== undefined) return cached
    const words = line.split(/\s+/).filter((word) => word.length > 0)
    genWordsCache.set(line, words)
    return words
  }
  const getGenProgressIdentity = (): string => {
    const text =
      deps.rawLyricsText() ||
      (deps.lrcLines().length > 0 ? '' : deps.lyricsLines().join('\n'))
    let hash = 2166136261
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    return `${text.length}:${hash >>> 0}`
  }

  const isTemplateMappedInGen = (blockId: string): boolean => {
    const block = deps.getBlockById(blockId)
    if (!block) return false
    const lineTimes = lrcGenLineTimes()
    return block.lineIndices.every((i) => lineTimes[i] !== undefined)
  }

  const autoFillBlockInstance = (
    blockId: string,
    instanceIdx: number,
    instanceStartTime: number,
  ) => {
    const block = deps.getBlockById(blockId)
    if (!block) return

    const instances = deps.blockInstances()[blockId]
    if (instances === undefined || instanceIdx >= instances.length) return

    const [tplStart, tplEnd] = instances[0]
    const [instStart] = instances[instanceIdx]
    const tplBlockStart = lrcGenLineTimes()[tplStart]
    if (tplBlockStart === undefined) return

    const tplLineCount = tplEnd - tplStart
    const templateWordTimes = lrcGenWordTimings()
    const templateWordEnds = lrcGenWordEndTimings()
    const templateWordSweeps = lrcGenWordSweepTimings()

    for (let j = 0; j < tplLineCount; j++) markTouched(instStart + j)
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
    setLrcGenWordEndTimings((prev) => {
      const next = structuredClone(prev)
      for (let j = 0; j < tplLineCount; j++) {
        const ends = templateWordEnds[tplStart + j]
        if (ends?.length) {
          next[instStart + j] = ends.map(
            (time) =>
              Math.round((instanceStartTime + time - tplBlockStart) * 1000) /
              1000,
          )
        }
      }
      return next
    })
    setLrcGenWordSweepTimings((prev) => {
      const next = structuredClone(prev)
      for (let j = 0; j < tplLineCount; j++) {
        if (!(tplStart + j in templateWordSweeps)) continue
        const sweeps = templateWordSweeps[tplStart + j]
        next[instStart + j] = {}
        for (const [wordIdx, points] of Object.entries(sweeps)) {
          next[instStart + j][+wordIdx] = points.map((point) => ({
            ...point,
            time:
              Math.round(
                (instanceStartTime + point.time - tplBlockStart) * 1000,
              ) / 1000,
          }))
        }
      }
      return next
    })
  }

  const expandAllBlockInstances = () => {
    const lineTimes = lrcGenLineTimes()
    for (const block of deps.blocks()) {
      if (!isTemplateMappedInGen(block.id)) continue
      const instances = deps.blockInstances()[block.id]
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

  interface LrcGenProgressPayload {
    lineTimes: (number | undefined)[]
    wordTimings: WordTimingsMap
    wordEndTimings: WordTimingsMap
    wordSweepTimings: WordSweepTimingsMap
    lineIdx: number
    wordIdx: number
    inputMode: LrcGenInputMode
    /** Absent in sessions saved before the pass split — see `normalizePass`. */
    pass?: LrcGenPass
    touchedLines: number[]
    lyricsIdentity: string
    timestamp: number
  }

  let pendingGenProgress: LrcGenProgressPayload | null = null
  let genProgressTimer: ReturnType<typeof setTimeout> | undefined

  const flushLrcGenProgress = () => {
    const payload = pendingGenProgress
    pendingGenProgress = null
    genProgressTimer = undefined
    if (payload === null) return
    try {
      localStorage.setItem(genKey(), JSON.stringify(payload))
    } catch {
      /* storage full */
    }
  }

  const saveLrcGenProgress = () => {
    // Signal values are immutable references. Capturing them here is O(1);
    // serialization and the synchronous localStorage write happen at most once
    // per short burst instead of blocking every fast word transition.
    pendingGenProgress = {
      lineTimes: lrcGenLineTimes(),
      wordTimings: lrcGenWordTimings(),
      wordEndTimings: lrcGenWordEndTimings(),
      wordSweepTimings: lrcGenWordSweepTimings(),
      lineIdx: lrcGenLineIdx(),
      wordIdx: lrcGenWordIdx(),
      inputMode: lrcGenInputMode(),
      pass: lrcGenPass(),
      touchedLines: [...touchedLines].sort((a, b) => a - b),
      lyricsIdentity: getGenProgressIdentity(),
      timestamp: Date.now(),
    }
    if (genProgressTimer !== undefined) return
    genProgressTimer = setTimeout(flushLrcGenProgress, 1500)
  }

  const clearLrcGenProgress = () => {
    pendingGenProgress = null
    if (genProgressTimer !== undefined) {
      clearTimeout(genProgressTimer)
      genProgressTimer = undefined
    }
    try {
      localStorage.removeItem(genKey())
    } catch {
      /* ignore */
    }
  }

  // ── LRC gen actions ──────────────────────────────────────────────

  /** What an interrupted session left behind, once validated. */
  interface SavedGenProgress {
    lineTimes: (number | undefined)[]
    wordTimings: WordTimingsMap
    wordEndTimings: WordTimingsMap
    wordSweepTimings: WordSweepTimingsMap
    touchedLines: Set<number>
    lineIdx: number
    wordIdx: number
    pass: LrcGenPass
    /** null when the blob predates the setting or holds something unknown. */
    inputMode: LrcGenInputMode | null
  }

  const readSavedGenProgress = (lines: string[]): SavedGenProgress | null => {
    try {
      const saved = localStorage.getItem(genKey())
      if (saved === null) return null
      const data: Record<string, unknown> = JSON.parse(saved)
      const belongsToCurrentLyrics =
        data.lyricsIdentity === undefined ||
        data.lyricsIdentity === getGenProgressIdentity()
      if (
        !belongsToCurrentLyrics ||
        !Array.isArray(data.lineTimes) ||
        data.lineTimes.length === 0
      ) {
        return null
      }
      const lineIdx =
        typeof data.lineIdx === 'number' && Number.isInteger(data.lineIdx)
          ? Math.max(0, Math.min(data.lineIdx, lines.length))
          : 0
      const wordIdx =
        typeof data.wordIdx === 'number' &&
        Number.isInteger(data.wordIdx) &&
        data.wordIdx >= 0
          ? data.wordIdx
          : 0
      return {
        lineTimes: restoreLineTimes(data.lineTimes, lines.length),
        wordTimings: restoreWordTimingsMap(data.wordTimings, lines.length),
        wordEndTimings: restoreWordTimingsMap(
          data.wordEndTimings,
          lines.length,
        ),
        wordSweepTimings: restoreWordSweepTimingsMap(
          data.wordSweepTimings,
          lines.length,
        ),
        touchedLines: restoreTouchedLines({
          savedTouchedLines: data.touchedLines,
          lines,
          lineIdx,
          wordIdx,
        }),
        lineIdx,
        wordIdx,
        pass: normalizePass(data.pass),
        inputMode:
          data.inputMode === 'marker' || data.inputMode === 'tap'
            ? data.inputMode
            : null,
      }
    } catch {
      return null
    }
  }

  /**
   * The state a session starts from: whatever the song already holds, re-keyed
   * from LRC indices to canonical ones (which may include synthetic ~Rest~
   * entries for large gaps). Computed on every start, resumed or not — the
   * mapper has to show the lines it is not about to touch, or the highlighter
   * has nothing to light and the song looks unmapped.
   */
  const seedGenTimings = (lines: string[]) => {
    const lrcToCanonical = buildLrcToCanonicalMap(deps.canonicalLrcLines())

    const lineTimes = new Array<number | undefined>(lines.length)
    const wordTimings: WordTimingsMap = {}
    // The edit buffer holds work that has not been committed yet, so it
    // outranks the saved map wherever both have a line.
    const editBuffer = deps.editBuffer()
    const starts =
      Object.keys(editBuffer).length > 0 ? editBuffer : deps.wordTimings()
    for (const lrcIdx of Object.keys(starts)) {
      const canonIdx = lrcToCanonical.get(+lrcIdx)
      if (canonIdx === undefined) continue
      lineTimes[canonIdx] = starts[+lrcIdx][0] ?? 0
      wordTimings[canonIdx] = [...starts[+lrcIdx]]
    }

    const wordEndTimings: WordTimingsMap = {}
    for (const [lrcIdx, ends] of Object.entries(deps.wordEndTimings())) {
      const canonIdx = lrcToCanonical.get(+lrcIdx)
      if (canonIdx !== undefined) wordEndTimings[canonIdx] = [...ends]
    }
    const wordSweepTimings: WordSweepTimingsMap = {}
    for (const [lrcIdx, sweeps] of Object.entries(deps.wordSweepTimings())) {
      const canonIdx = lrcToCanonical.get(+lrcIdx)
      if (canonIdx !== undefined) {
        wordSweepTimings[canonIdx] = structuredClone(sweeps)
      }
    }
    return { lineTimes, wordTimings, wordEndTimings, wordSweepTimings }
  }

  const startLrcGen = () => {
    const lines = getGenLines()
    if (lines.length === 0) return

    // Snapshot current LRC state so Cancel can restore it
    preGenSnapshot = {
      wordTimings: structuredClone(deps.wordTimings()),
      wordEndTimings: structuredClone(deps.wordEndTimings()),
      wordSweepTimings: structuredClone(deps.wordSweepTimings()),
      lrcLines: structuredClone(deps.lrcLines()),
      rawLyricsText: deps.rawLyricsText(),
      lyricsLines: structuredClone(deps.lyricsLines()),
      lyricsSource: deps.lyricsSource(),
    }

    const seed = seedGenTimings(lines)
    const saved = readSavedGenProgress(lines)
    touchedLines = saved?.touchedLines ?? new Set()
    bumpTouched()

    if (saved === null) {
      setLrcGenLineTimes(seed.lineTimes)
      setLrcGenWordTimings(seed.wordTimings)
      setLrcGenWordEndTimings(seed.wordEndTimings)
      setLrcGenWordSweepTimings(seed.wordSweepTimings)
    } else {
      // The blob is a delta on top of the song, not a replacement for it.
      setLrcGenLineTimes(
        restoreGenLineTimes(
          seed.lineTimes,
          saved.lineTimes,
          touchedLines,
          lines.length,
        ),
      )
      setLrcGenWordTimings(
        restoreGenMap(seed.wordTimings, saved.wordTimings, touchedLines),
      )
      setLrcGenWordEndTimings(
        restoreGenMap(seed.wordEndTimings, saved.wordEndTimings, touchedLines),
      )
      setLrcGenWordSweepTimings(
        restoreGenMap(
          seed.wordSweepTimings,
          saved.wordSweepTimings,
          touchedLines,
        ),
      )
      if (saved.inputMode !== null) setLrcGenInputMode(saved.inputMode)
    }

    setLrcGenPassSignal(saved?.pass ?? 'all')
    setPreviewLineIdx(null)
    setPreviewLoop(false)
    setLrcGenLineIdx(saved?.lineIdx ?? 0)
    setLrcGenWordIdx(saved?.wordIdx ?? 0)
    deps.setEditMode(false)
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

  // The correction is visible and user-adjustable in the mapper. Positive
  // values compensate audio-to-motor reaction time by moving marks earlier.
  const correctedTime = (elapsedTime: number) =>
    Math.max(0, Math.round((elapsedTime - timingOffsetSec) * 1000) / 1000)
  const tapTime = () => correctedTime(deps.elapsed())

  // ── Two-pass mapping ─────────────────────────────────────────────

  /** Best known start for a line: this session's mark, else the fetched LRC. */
  const genLineStart = (idx: number): number | undefined =>
    lrcGenLineTimes()[idx] ?? deps.canonicalLrcLines()[idx]?.time

  /** Jump so the line arrives after a run-in instead of starting mid-word. */
  const seekToLinePreRoll = (idx: number) => {
    const start = genLineStart(idx)
    if (start === undefined) return
    deps.seekToWithWindow(preRollTarget(start))
  }

  /** Put the cursor where `nextCursorAfterLine` and friends decided it goes. */
  const applyGenCursor = (cursor: GenCursor) => {
    setLrcGenLineIdx(cursor.lineIdx)
    setLrcGenWordIdx(cursor.wordIdx)
    if (cursor.finish) {
      handleLrcGenFinish()
      return
    }
    if (cursor.preRoll) seekToLinePreRoll(cursor.lineIdx)
    saveLrcGenProgress()
  }

  /**
   * Move the pass-2 cursor to the next line that has words to place, seeking
   * so it is heard from its run-in. Finishing the last one ends the session.
   */
  const advanceWordPass = (fromLineIdx: number) => {
    applyGenCursor(wordPassCursorFrom(getGenLines(), fromLineIdx))
  }

  /**
   * Switch passes. Entering the word pass freezes the line starts by seeding
   * them as word 0 of every line, so the word cursor can begin at word 1 and
   * the line times are never re-stamped by a word tap.
   */
  const setLrcGenPass = (pass: LrcGenPass) => {
    if (pass === lrcGenPass()) return
    stopLinePreview()
    setLrcGenPassSignal(pass)
    if (pass === 'words') {
      const lines = getGenLines()
      setLrcGenWordTimings((prev) =>
        seedWordPassTimings(lines, lrcGenLineTimes(), prev),
      )
      advanceWordPass(0)
      return
    }
    const lines = getGenLines()
    let idx = lrcGenLineIdx()
    while (idx < lines.length && !isMappableLine(lines[idx])) idx++
    setLrcGenLineIdx(Math.min(idx, lines.length))
    setLrcGenWordIdx(0)
    saveLrcGenProgress()
  }

  /** Word-pass readout — lines that actually need words, not all lines. */
  const wordPassProgress = (): { done: number; total: number } => {
    const lines = getGenLines()
    return {
      done: wordPassLinesBefore(lines, lrcGenLineIdx()),
      total: countWordPassLines(lines),
    }
  }

  // ── Line preview ─────────────────────────────────────────────────

  const stopLinePreview = () => {
    if (previewLineIdx() === null) return
    setPreviewLineIdx(null)
    setPreviewLoop(false)
  }

  /**
   * Audition one line with the production highlighter, driven by the timings
   * being edited rather than the saved ones — so what plays here is what will
   * ship, without leaving the mapper to check it.
   */
  /** Returns whether a preview is now running, so the caller can start
   *  playback — the controller can seek but has no transport of its own. */
  const startLinePreview = (idx: number, loop: boolean): boolean => {
    const lines = getGenLines()
    if (!isMappableLine(lines[idx])) return false
    if (genLineStart(idx) === undefined) return false
    setPreviewLineIdx(idx)
    setPreviewLoop(loop)
    seekToLinePreRoll(idx)
    return true
  }

  const toggleLinePreview = (idx: number, loop: boolean): boolean => {
    // Loop is a property of the running preview, not a separate target, so
    // re-pressing the same line always stops it rather than restarting it
    // under a different loop setting.
    if (previewLineIdx() === idx) {
      stopLinePreview()
      return false
    }
    return startLinePreview(idx, loop)
  }

  /** Where the previewed line stops sounding. */
  const previewEnd = (idx: number): number | null =>
    lineEndTime(getGenLines(), lrcGenLineTimes(), lrcGenWordTimings(), idx)

  // Bound the preview: loop back to the run-in, or drop out of preview so the
  // song keeps playing normally.
  createEffect(() => {
    const idx = previewLineIdx()
    if (idx === null) return
    const end = untrack(() => previewEnd(idx))
    if (end === null) return
    if (deps.elapsed() <= end + PREVIEW_TAIL_SEC) return
    if (untrack(previewLoop)) seekToLinePreRoll(idx)
    else stopLinePreview()
  })

  /** The word lit at `time` on `idx`, against the timings being edited. */
  const highlightAt = (
    idx: number,
    time: number,
  ): (PreviewWordHighlight & { lineIdx: number }) | null => {
    const end = previewEnd(idx)
    if (end === null) return null
    const hit = previewWordAt(
      lrcGenWordTimings()[idx],
      lrcGenWordEndTimings()[idx],
      end,
      time,
    )
    return hit === null ? null : { ...hit, lineIdx: idx }
  }

  /**
   * The word the highlighter should light right now — from the previewed line
   * when one is running, otherwise from whichever mapped line the playhead is
   * inside, so the whole song lights up as it plays.
   *
   * Kept out of `deps.genViewData` on purpose: that memo deliberately does not
   * track `elapsed`, and making it do so would rebuild every lyric row at
   * frame rate. Returning null when neither mode is on keeps the cost at one
   * signal read for everyone who has not asked for this.
   */
  const highlightWord = createMemo<
    (PreviewWordHighlight & { lineIdx: number }) | null
  >(() => {
    const previewIdx = previewLineIdx()
    if (previewIdx !== null) return highlightAt(previewIdx, deps.elapsed())
    if (!liveHighlight()) return null
    const time = deps.elapsed()
    const idx = activeLineAt(getGenLines(), lrcGenLineTimes(), time)
    return idx < 0 ? null : highlightAt(idx, time)
  })

  const handleNextLine = () => {
    const t = tapTime()
    const lines = getGenLines()
    const idx = lrcGenLineIdx()
    if (idx >= lines.length) return

    if (!lines[idx].trim() || lines[idx].trim() === '~Rest~') {
      advancePastBlankLine(idx, lines)
      return
    }

    markTouched(idx)
    setLrcGenLineTimes((prev) => {
      const next = [...prev]
      next[idx] = t
      return next
    })

    const blockInfo = deps.getBlockForLine(idx)
    if (
      blockInfo &&
      !blockInfo.isTemplate &&
      isTemplateMappedInGen(blockInfo.blockId)
    ) {
      autoFillBlockInstance(blockInfo.blockId, blockInfo.instanceIdx, t)
      const instanceEnd =
        deps.blockInstances()[blockInfo.blockId]?.[
          blockInfo.instanceIdx
        ]?.[1] ?? idx + 1
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
    // Back-fill the words left behind on an abandoned line — except in the
    // line pass, where they have not been mapped yet by design and a flat
    // 0.25s ladder would hand the word pass fake data to walk over.
    if (lrcGenPass() !== 'lines' && words.length > 0 && lrcGenWordIdx() > 0) {
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

    applyGenCursor(nextCursorAfterLine(lrcGenPass(), lines, idx))
  }

  const handleNextWord = () => {
    // The line pass is line starts only — a tap advances the line, never a
    // word. 'all' and 'words' both fall through to per-word stamping.
    if (lrcGenPass() === 'lines') {
      handleNextLine()
      return
    }

    const lines = getGenLines()
    const lineIdx = lrcGenLineIdx()
    if (lineIdx >= lines.length) return

    if (!lines[lineIdx].trim() || lines[lineIdx].trim() === '~Rest~') {
      advancePastBlankLine(lineIdx, lines)
      return
    }

    const t = tapTime()
    const words = getGenWords(lines[lineIdx])
    const wordIdx = lrcGenWordIdx()

    if (wordIdx === 0) {
      markTouched(lineIdx)
      setLrcGenLineTimes((prev) => {
        const next = [...prev]
        next[lineIdx] = t
        return next
      })

      const blockInfo = deps.getBlockForLine(lineIdx)
      if (
        blockInfo &&
        !blockInfo.isTemplate &&
        isTemplateMappedInGen(blockInfo.blockId)
      ) {
        autoFillBlockInstance(blockInfo.blockId, blockInfo.instanceIdx, t)
        const instanceEnd =
          deps.blockInstances()[blockInfo.blockId]?.[
            blockInfo.instanceIdx
          ]?.[1] ?? lineIdx + 1
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
      const arr = [...(prev[lineIdx] ?? [])]
      arr[wordIdx] = t
      return { ...prev, [lineIdx]: arr }
    })

    if (wordIdx + 1 >= words.length) {
      applyGenCursor(nextCursorAfterLine(lrcGenPass(), lines, lineIdx))
    } else {
      setLrcGenWordIdx(wordIdx + 1)
      saveLrcGenProgress()
    }
  }

  const setMarkerWordStart = (
    lineIdx: number,
    wordIdx: number,
    time: number,
  ) => {
    markTouched(lineIdx)
    if (wordIdx === 0) {
      setLrcGenLineTimes((prev) => {
        const next = [...prev]
        next[lineIdx] = time
        return next
      })
    }
    setLrcGenWordTimings((prev) => {
      const line = [...(prev[lineIdx] ?? [])]
      line[wordIdx] = time
      return { ...prev, [lineIdx]: line }
    })
    setLrcGenWordEndTimings((prev) => {
      const line = [...(prev[lineIdx] ?? [])]
      delete line[wordIdx]
      return { ...prev, [lineIdx]: line }
    })
    setLrcGenWordSweepTimings((prev) => {
      return beginWordSweep(prev, lineIdx, wordIdx, time)
    })
  }

  const appendMarkerSweep = (
    lineIdx: number,
    wordIdx: number,
    time: number,
    progress: number,
  ) => {
    setLrcGenWordSweepTimings((prev) => {
      return appendWordSweepSample(prev, lineIdx, wordIdx, time, progress)
    })
  }

  const closeMarkerWord = (
    lineIdx: number,
    wordIdx: number,
    time: number,
  ): number => {
    const start = lrcGenWordTimings()[lineIdx]?.[wordIdx]
    const end = start === undefined ? time : Math.max(time, start + 0.001)
    setLrcGenWordEndTimings((prev) => {
      const line = [...(prev[lineIdx] ?? [])]
      line[wordIdx] = end
      return { ...prev, [lineIdx]: line }
    })
    appendMarkerSweep(lineIdx, wordIdx, end, 1)
    return end
  }

  const advanceAfterMarkerLine = (lineIdx: number, lines: string[]) => {
    if (lineIdx + 1 >= lines.length) {
      setLrcGenLineIdx(lines.length)
      setLrcGenWordIdx(0)
      handleLrcGenFinish()
      return
    }
    let nextLine = lineIdx + 1
    while (
      nextLine < lines.length &&
      (!lines[nextLine].trim() || lines[nextLine].trim() === '~Rest~')
    ) {
      nextLine++
    }
    if (nextLine >= lines.length) {
      setLrcGenLineIdx(lines.length)
      setLrcGenWordIdx(0)
      handleLrcGenFinish()
      return
    }
    setLrcGenLineIdx(nextLine)
    setLrcGenWordIdx(0)
    saveLrcGenProgress()
  }

  /**
   * Record the direct marker path. Entering a word stamps its onset, moving
   * within it records the highlight curve, and leaving/releasing at its end
   * closes the audible interval. The mapper advances only forward.
   */
  const handleMarkerSample = (
    lineIdx: number,
    wordIdx: number,
    progress: number,
    elapsedTime: number,
    phase: 'start' | 'move' | 'end',
  ) => {
    if (!lrcGenMode() || lrcGenInputMode() !== 'marker') return
    if (lineIdx !== lrcGenLineIdx()) return
    const lines = getGenLines()
    const words = getGenWords(lines[lineIdx] ?? '')
    if (words.length === 0) return

    const currentWord = lrcGenWordIdx()
    if (wordIdx < currentWord || wordIdx > currentWord + 1) return
    const time = correctedTime(elapsedTime)
    const safeProgress = Math.max(0, Math.min(1, progress))

    if (wordIdx === currentWord + 1) {
      const boundary = closeMarkerWord(lineIdx, currentWord, time)
      setMarkerWordStart(lineIdx, wordIdx, boundary)
      setLrcGenWordIdx(wordIdx)
      appendMarkerSweep(lineIdx, wordIdx, boundary, safeProgress)
      saveLrcGenProgress()
      return
    }

    const hasStart = lrcGenWordTimings()[lineIdx]?.[wordIdx] !== undefined
    if (phase === 'start' || !hasStart) {
      setMarkerWordStart(lineIdx, wordIdx, time)
    }
    appendMarkerSweep(lineIdx, wordIdx, time, safeProgress)

    if (phase !== 'end') return
    closeMarkerWord(lineIdx, wordIdx, time)
    if (wordIdx + 1 < words.length) {
      // A lift at the word's right edge represents a real pause. The next
      // gesture will stamp the following word when its first sound arrives.
      setLrcGenWordIdx(wordIdx + 1)
      saveLrcGenProgress()
      return
    }
    advanceAfterMarkerLine(lineIdx, lines)
  }

  const handleRedoCurrentLine = () => {
    const lines = getGenLines()
    let lineIdx = Math.min(lrcGenLineIdx(), lines.length - 1)
    if (lrcGenWordIdx() === 0 && lineIdx > 0) lineIdx--
    while (
      lineIdx >= 0 &&
      (!lines[lineIdx]?.trim() || lines[lineIdx].trim() === '~Rest~')
    ) {
      lineIdx--
    }
    if (lineIdx < 0 || !lines[lineIdx]?.trim()) return

    // The word pass treats line starts as settled, so a redo there clears the
    // words from 1 on and leaves word 0 (and the line time) alone. Clearing
    // them would silently undo the line pass from a button labelled "redo
    // line".
    const wordPass = lrcGenPass() === 'words'
    if (!wordPass) {
      unmarkTouched(lineIdx)
      setLrcGenLineTimes((prev) => {
        const next = [...prev]
        delete next[lineIdx]
        return next
      })
    }
    setLrcGenWordTimings((prev) => {
      const next = structuredClone(prev)
      if (wordPass) {
        const lineStart = next[lineIdx]?.[0]
        if (lineStart === undefined) delete next[lineIdx]
        else next[lineIdx] = [lineStart]
      } else {
        delete next[lineIdx]
      }
      return next
    })
    setLrcGenWordEndTimings((prev) => {
      const next = structuredClone(prev)
      delete next[lineIdx]
      return next
    })
    setLrcGenWordSweepTimings((prev) => {
      const next = structuredClone(prev)
      delete next[lineIdx]
      return next
    })
    setLrcGenLineIdx(lineIdx)
    setLrcGenWordIdx(wordPass ? 1 : 0)

    const originalTime =
      deps.canonicalLrcLines()[lineIdx]?.time ?? lrcGenLineTimes()[lineIdx] ?? 0
    deps.seekToWithWindow(preRollTarget(originalTime))
    saveLrcGenProgress()
  }

  const handleLrcGenFinish = () => {
    expandAllBlockInstances()

    const canonical = deps.canonicalLrcLines()
    const lines = getGenLines()
    const lineTimes = lrcGenLineTimes()
    const wordTimes = lrcGenWordTimings()
    // Sweep samples update at pointer frequency. They are not needed to rebuild
    // every lyric row; read their latest values only when another generator
    // state change (word/line transition) already requires a view update.
    const wordEnds = untrack(lrcGenWordEndTimings)
    const wordSweeps = untrack(lrcGenWordSweepTimings)

    // Guard: if no lines were mapped, treat as cancel
    if (touchedLines.size === 0 && lrcGenLineIdx() < lines.length) {
      handleLrcGenReset()
      return
    }

    // Build canonical<->LRC index maps for correct output
    const lrcToCanon = buildLrcToCanonicalMap(canonical)

    // Convert preGenSnapshot deps.wordTimings from LRC->canonical indices
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
    const origEndsCanon: WordTimingsMap = {}
    for (const [lrcIdx, ends] of Object.entries(
      preGenSnapshot?.wordEndTimings ?? {},
    )) {
      const canonicalIdx = lrcToCanon.get(+lrcIdx)
      if (canonicalIdx !== undefined) {
        origEndsCanon[canonicalIdx] = [...ends]
      }
    }
    const origSweepsCanon: WordSweepTimingsMap = {}
    for (const [lrcIdx, sweeps] of Object.entries(
      preGenSnapshot?.wordSweepTimings ?? {},
    )) {
      const canonicalIdx = lrcToCanon.get(+lrcIdx)
      if (canonicalIdx !== undefined) {
        origSweepsCanon[canonicalIdx] = structuredClone(sweeps)
      }
    }

    // Honest "all mapped": every line explicitly touched — the cursor
    // reaching the end only means the user finished at the end, not that
    // they started there (see isSessionFullyMapped).
    const allMapped = isSessionFullyMapped(lines.length, touchedLines)

    let finalTimes: (number | undefined)[]
    let mergedWordTimesCanon: WordTimingsMap
    let mergedWordEndsCanon: WordTimingsMap
    let mergedWordSweepsCanon: WordSweepTimingsMap

    if (allMapped) {
      finalTimes = lineTimes.slice()
      mergedWordTimesCanon = wordTimes
      mergedWordEndsCanon = wordEnds
      mergedWordSweepsCanon = wordSweeps
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
      mergedWordEndsCanon = mergePartialWordTimings(
        touchedLines,
        origEndsCanon,
        wordEnds,
      )
      mergedWordSweepsCanon = {}
      for (const [lineIdx, sweeps] of Object.entries(origSweepsCanon)) {
        if (!touchedLines.has(+lineIdx)) {
          mergedWordSweepsCanon[+lineIdx] = structuredClone(sweeps)
        }
      }
      for (const [lineIdx, sweeps] of Object.entries(wordSweeps)) {
        if (touchedLines.has(+lineIdx)) {
          mergedWordSweepsCanon[+lineIdx] = structuredClone(sweeps)
        }
      }

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
      const persistedText = deps.loadPersistedLyrics()?.originalText
      if (persistedText != null && persistedText.length > 0)
        return persistedText
      return deps.rawLyricsText()
    })()

    let lrcText: string
    let mergedWordTimes: WordTimingsMap
    const mergedWordEnds: WordTimingsMap = {}
    const mergedWordSweeps: WordSweepTimingsMap = {}

    if (canonical.length > 0) {
      // LRC source: build from canonical entries with correct indices
      mergedWordTimes = {}
      for (const entry of canonical) {
        if (entry.lrcIndex < 0) continue // skip synthetic ~Rest~
        const ci = entry.canonicalIndex
        const wts = mergedWordTimesCanon[ci]
        if (wts !== undefined) mergedWordTimes[entry.lrcIndex] = wts
        const ends = mergedWordEndsCanon[ci]
        if (ends !== undefined) mergedWordEnds[entry.lrcIndex] = ends
        const sweeps = mergedWordSweepsCanon[ci]
        if (sweeps !== undefined) {
          mergedWordSweeps[entry.lrcIndex] = sweeps
        }
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
      Object.assign(mergedWordEnds, mergedWordEndsCanon)
      Object.assign(mergedWordSweeps, mergedWordSweepsCanon)

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

    const filename = deps.loadPersistedLyrics()?.filename ?? 'generated.lrc'
    deps.persistLyrics(
      lrcText,
      'lrc',
      filename,
      mergedWordTimes,
      snapshotOriginalText,
      'lrc-gen',
      {
        wordEndTimings: mergedWordEnds,
        wordSweepTimings: mergedWordSweeps,
      },
    )
    const parsed = parseLrcFile(lrcText)
    deps.setLrcLines(parsed)
    deps.setLyricsLines([])
    deps.setWordTimings(mergedWordTimes)
    deps.setWordEndTimings(mergedWordEnds)
    deps.setWordSweepTimings(mergedWordSweeps)

    // Reset gen state fully
    setLrcGenMode(false)
    setLrcGenPassSignal('all')
    setPreviewLineIdx(null)
    setPreviewLoop(false)
    setLrcGenLineIdx(0)
    setLrcGenWordIdx(0)
    setLrcGenLineTimes([])
    setLrcGenWordTimings({})
    setLrcGenWordEndTimings({})
    setLrcGenWordSweepTimings({})
    touchedLines = new Set()
    bumpTouched()
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
    const canonical = deps.canonicalLrcLines()
    const dur = deps.duration()
    if (canonical.length === 0 || dur <= 0) return { linesSynced: 0 }

    const lineEntries = canonical.filter((e) => e.type === 'line')
    const auto: WordTimingsMap = {} // keyed by lrcIndex, like deps.wordTimings()
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
    const persisted = deps.loadPersistedLyrics()
    deps.setWordEndTimings({})
    deps.setWordSweepTimings({})
    deps.persistLyrics(
      lrcText,
      'lrc',
      persisted?.filename ?? 'auto-synced.lrc',
      auto,
      persisted?.originalText ?? deps.rawLyricsText(),
      'auto-sync',
    )
    deps.setLrcLines(parseLrcFile(lrcText))
    deps.setLyricsLines([])
    deps.setWordTimings(auto)
    return { linesSynced: synced }
  }

  const handleLrcGenReset = () => {
    // Cancel: restore pre-gen LRC state, don't touch anything
    if (preGenSnapshot) {
      deps.setWordTimings(preGenSnapshot.wordTimings)
      deps.setWordEndTimings(preGenSnapshot.wordEndTimings)
      deps.setWordSweepTimings(preGenSnapshot.wordSweepTimings)
      deps.setLrcLines(preGenSnapshot.lrcLines)
      deps.setRawLyricsText(preGenSnapshot.rawLyricsText)
      deps.setLyricsLines(preGenSnapshot.lyricsLines)
      deps.setLyricsSource(preGenSnapshot.lyricsSource)
      preGenSnapshot = null
    }
    setLrcGenLineIdx(0)
    setLrcGenWordIdx(0)
    setLrcGenLineTimes([])
    setLrcGenWordTimings({})
    setLrcGenWordEndTimings({})
    setLrcGenWordSweepTimings({})
    setLrcGenMode(false)
    setLrcGenPassSignal('all')
    setPreviewLineIdx(null)
    setPreviewLoop(false)
    touchedLines = new Set()
    bumpTouched()
    clearLrcGenProgress()
  }

  /**
   * Move the mapping cursor onto `idx` — used when a line is clicked, so a
   * section can be fixed without redoing the song from the top. Blanks and
   * rests are skipped, and the word pass lands on word 1 because word 0 is
   * the frozen line start.
   */
  const focusGenLine = (idx: number) => {
    const genLines = getGenLines()
    let targetIdx = idx
    while (
      targetIdx < genLines.length &&
      (!genLines[targetIdx].trim() || genLines[targetIdx].trim() === '~Rest~')
    ) {
      targetIdx++
    }
    if (targetIdx >= genLines.length) targetIdx = genLines.length
    if (lrcGenPass() === 'words') {
      targetIdx = nextWordPassLine(genLines, targetIdx)
      setLrcGenLineIdx(targetIdx)
      setLrcGenWordIdx(targetIdx < genLines.length ? 1 : 0)
    } else {
      setLrcGenLineIdx(targetIdx)
      setLrcGenWordIdx(0)
    }
    saveLrcGenProgress()
  }

  /** Drop the whole session. The lyrics underneath it have changed. */
  const resetGenState = () => {
    setLrcGenMode(false)
    setLrcGenPassSignal('all')
    setPreviewLineIdx(null)
    setPreviewLoop(false)
    setLrcGenLineIdx(0)
    setLrcGenWordIdx(0)
    setLrcGenLineTimes([])
    setLrcGenWordTimings({})
    setLrcGenWordEndTimings({})
    setLrcGenWordSweepTimings({})
    touchedLines = new Set()
    bumpTouched()
    preGenSnapshot = null
  }

  return {
    // session state
    lrcGenMode,
    setLrcGenMode,
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

    // preview + highlighting
    previewLineIdx,
    previewLoop,
    setPreviewLoop,
    liveHighlight,
    setLiveHighlight,
    highlightWord,
    toggleLinePreview,
    stopLinePreview,

    // actions
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
    focusGenLine,
    resetGenState,

    // shared with the lyrics controller
    getGenLines,
    getGenWords,
    isTemplateMappedInGen,
    expandAllBlockInstances,
    saveLrcGenProgress,
    flushLrcGenProgress,
    clearLrcGenProgress,
  }
}
