// ============================================================
// LRC Gen Engine — pure functions extracted from handleLrcGenFinish
// ============================================================
//
// These functions implement the partial merge, interpolation, and
// monotonic enforcement logic used when the user finishes an LRC
// generation session (whether they mapped all lines or only a subset).
//
// Tests: src/tests/lrc-gen-partial-merge.test.ts

import type { CanonicalLrcEntry, WordSweepPoint, WordSweepTimingsMap, WordTimingsMap, } from '@/features/stem-mixer/types'
import { buildLrcToCanonicalMap } from '@/lib/canonical-lrc'
import { buildLrcTextFromCanonical, estimateUnmappedTimes, formatTimeLrc, } from '@/lib/lrc-generator'

function isMappableLine(line: string | undefined): boolean {
  const text = line?.trim()
  return text !== undefined && text !== '' && text !== '~Rest~'
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** Convert JSON's null-filled sparse arrays back to optional lyric times. */
export function restoreLineTimes(
  value: unknown,
  lineCount: number,
): (number | undefined)[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, Math.max(0, lineCount))
    .map((time) => (isTime(time) ? time : undefined))
}

/** Validate a line-indexed timing map recovered from localStorage. */
export function restoreWordTimingsMap(
  value: unknown,
  lineCount: number,
): WordTimingsMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  const restored: WordTimingsMap = {}
  for (const [rawLineIdx, rawTimes] of Object.entries(value)) {
    const lineIdx = Number(rawLineIdx)
    if (
      !Number.isInteger(lineIdx) ||
      lineIdx < 0 ||
      lineIdx >= lineCount ||
      !Array.isArray(rawTimes)
    ) {
      continue
    }
    const times: number[] = []
    for (let wordIdx = 0; wordIdx < rawTimes.length; wordIdx++) {
      if (isTime(rawTimes[wordIdx])) times[wordIdx] = rawTimes[wordIdx]
    }
    if (times.length > 0) restored[lineIdx] = times
  }
  return restored
}

/** Validate compact marker curves recovered from localStorage. */
export function restoreWordSweepTimingsMap(
  value: unknown,
  lineCount: number,
): WordSweepTimingsMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  const restored: WordSweepTimingsMap = {}
  for (const [rawLineIdx, rawWords] of Object.entries(value)) {
    const lineIdx = Number(rawLineIdx)
    if (
      !Number.isInteger(lineIdx) ||
      lineIdx < 0 ||
      lineIdx >= lineCount ||
      typeof rawWords !== 'object' ||
      rawWords === null ||
      Array.isArray(rawWords)
    ) {
      continue
    }
    const words: WordSweepTimingsMap[number] = {}
    for (const [rawWordIdx, rawPoints] of Object.entries(rawWords)) {
      const wordIdx = Number(rawWordIdx)
      if (
        !Number.isInteger(wordIdx) ||
        wordIdx < 0 ||
        !Array.isArray(rawPoints)
      ) {
        continue
      }
      const points = rawPoints
        .slice(0, 512)
        .filter((point): point is WordSweepPoint => {
          if (typeof point !== 'object' || point === null) return false
          const candidate = point as { time?: unknown; progress?: unknown }
          return (
            isTime(candidate.time) &&
            typeof candidate.progress === 'number' &&
            Number.isFinite(candidate.progress) &&
            candidate.progress >= 0 &&
            candidate.progress <= 1
          )
        })
      if (points.length > 0) words[wordIdx] = points
    }
    if (Object.keys(words).length > 0) restored[lineIdx] = words
  }
  return restored
}

/**
 * Restore the explicit set of lines changed by an interrupted mapping session.
 *
 * Older saved payloads did not include this set. For those, completed lines
 * before the saved cursor are the safest recoverable approximation of the
 * mapper's forward-only workflow.
 */
export function restoreTouchedLines(params: {
  savedTouchedLines: unknown
  lines: readonly string[]
  lineIdx: number
  wordIdx: number
}): Set<number> {
  const { savedTouchedLines, lines, lineIdx, wordIdx } = params
  if (Array.isArray(savedTouchedLines)) {
    return new Set(
      savedTouchedLines.filter(
        (index): index is number =>
          typeof index === 'number' &&
          Number.isInteger(index) &&
          index >= 0 &&
          index < lines.length &&
          isMappableLine(lines[index]),
      ),
    )
  }

  const restored = new Set<number>()
  const cursor = Number.isFinite(lineIdx)
    ? Math.max(0, Math.min(lines.length, Math.trunc(lineIdx)))
    : 0
  for (let index = 0; index < cursor; index++) {
    if (isMappableLine(lines[index])) restored.add(index)
  }
  if (wordIdx > 0 && cursor < lines.length && isMappableLine(lines[cursor])) {
    restored.add(cursor)
  }
  return restored
}

/**
 * True only when EVERY line was explicitly mapped this session. The gen
 * cursor passing the last line is NOT enough: jumping to the final lines
 * and mapping just those walks the cursor out while everything earlier
 * stays untouched — and taking the all-mapped shortcut then discards the
 * untouched lines' original timestamps, which serialize as 0:00 (owner
 * hit this remapping the last 4 lines of an 18-minute song).
 */
export function isSessionFullyMapped(
  lineCount: number,
  touchedLines: ReadonlySet<number>,
): boolean {
  for (let i = 0; i < lineCount; i++) {
    if (!touchedLines.has(i)) return false
  }
  return true
}

/**
 * Merge partial LRC gen results with pre-existing timing data.
 *
 * For each line:
 *  1. If the user explicitly touched it during gen -> use the new lineTimes
 *  2. If the original had word timings for it   -> use the first word time
 *  3. If canonical entries have a time for it   -> preserve that original time
 *  4. Otherwise                                 -> undefined (will be estimated)
 */
export function mergePartialLineTimes(
  lines: string[],
  lineTimes: (number | undefined)[],
  touchedLines: ReadonlySet<number>,
  origWtCanon: WordTimingsMap | undefined,
  canonical: readonly CanonicalLrcEntry[],
): (number | undefined)[] {
  return lines.map((_line, i) => {
    if (touchedLines.has(i)) return lineTimes[i]
    if (origWtCanon?.[i] !== undefined) return origWtCanon[i][0]
    // Fall back to canonical entry time (from original LRC parse).
    // This preserves line-level LRC timings even when no word timings exist.
    if (canonical[i] !== undefined) return canonical[i].time
    return undefined
  })
}

/**
 * Merge word timings: touched lines get new timings, untouched keep original.
 */
export function mergePartialWordTimings(
  touchedLines: ReadonlySet<number>,
  origWtCanon: WordTimingsMap | undefined,
  newWordTimings: WordTimingsMap,
): WordTimingsMap {
  const merged: WordTimingsMap = {}
  if (origWtCanon) {
    for (const k of Object.keys(origWtCanon)) {
      const ki = +k
      if (!touchedLines.has(ki)) merged[ki] = [...origWtCanon[ki]]
    }
  }
  for (const k of Object.keys(newWordTimings)) {
    if (touchedLines.has(+k)) merged[+k] = [...newWordTimings[+k]]
  }
  return merged
}

/**
 * Fold an interrupted session's saved progress back onto the timings the song
 * actually has now.
 *
 * Restoring used to be all-or-nothing: if a saved cursor existed the mapper
 * loaded the blob and skipped seeding from the stored timings entirely. That
 * loses every line the blob does not mention — so a session abandoned after a
 * handful of lines reopened holding only those lines, with nothing for the
 * highlighter to light on the rest of the song. It also let a stale blob
 * silently overrule timings written since by another route (auto word-sync,
 * an imported LRC, a version switch).
 *
 * The rule is the same one `mergePartialWordTimings` applies when a partial
 * session finishes, and for the same reason: a line the user actually mapped
 * is theirs, everything else belongs to whatever the song holds now.
 *
 * Entries are carried by reference. Both sides are freshly built per restore —
 * one from `structuredClone`d signal state, one straight out of JSON — so
 * there is nothing here for a caller to alias into.
 */
export function restoreGenMap<T>(
  seed: Readonly<Record<number, T>>,
  saved: Readonly<Record<number, T>>,
  touchedLines: ReadonlySet<number>,
): Record<number, T> {
  const merged: Record<number, T> = { ...seed }
  for (const key of Object.keys(saved)) {
    if (touchedLines.has(+key)) merged[+key] = saved[+key]
  }
  return merged
}

/** {@link restoreGenMap} for the sparse line-start array. */
export function restoreGenLineTimes(
  seed: readonly (number | undefined)[],
  saved: readonly (number | undefined)[],
  touchedLines: ReadonlySet<number>,
  lineCount: number,
): (number | undefined)[] {
  const merged = new Array<number | undefined>(lineCount)
  for (let i = 0; i < lineCount; i++) {
    merged[i] = touchedLines.has(i) ? (saved[i] ?? seed[i]) : seed[i]
  }
  return merged
}

/**
 * Interpolate timestamps for unmapped lines between touched lines.
 *
 * Only fills gaps within the range [0, lastTouched].
 * Lines beyond lastTouched are left for estimateUnmappedTimes.
 */
export function interpolateGaps(
  finalTimes: (number | undefined)[],
  touchedLines: ReadonlySet<number>,
  songDuration: number,
): (number | undefined)[] {
  const result = finalTimes.slice()
  const lastTouched = Math.max(-1, ...Array.from(touchedLines))

  let prevMappedIdx = -1
  let prevMappedTime = 0

  for (let i = 0; i <= lastTouched; i++) {
    if (touchedLines.has(i)) {
      if (result[i] !== undefined) {
        prevMappedIdx = i
        prevMappedTime = result[i]!
      }
    } else if (result[i] === undefined) {
      let nextMappedTime = songDuration
      for (let j = i + 1; j <= lastTouched; j++) {
        if (touchedLines.has(j) && result[j] !== undefined) {
          nextMappedTime = result[j]!
          break
        }
      }
      const gap = nextMappedTime - prevMappedTime
      const posInGap = i - prevMappedIdx
      const gapLen =
        (() => {
          let n = prevMappedIdx + 1
          while (n <= lastTouched && !touchedLines.has(n)) n++
          return n
        })() - prevMappedIdx
      result[i] =
        Math.round((prevMappedTime + gap * (posInGap / gapLen)) * 1000) / 1000
    }
  }

  return result
}

/**
 * Enforce monotonic non-decreasing time order.
 *
 * If a user mapped line 5 at 1:00 then line 20 at 0:30, interpolated
 * lines between them could go backwards. This clamps each line time
 * to be >= the previous so timestamps always flow forward.
 */
export function enforceMonotonicTimes(
  finalTimes: (number | undefined)[],
): (number | undefined)[] {
  const result = finalTimes.slice()
  let prev = 0
  for (let i = 0; i < result.length; i++) {
    if (result[i] !== undefined) {
      if (result[i]! < prev) {
        result[i] = prev
      }
      prev = result[i]!
    }
  }
  return result
}

/**
 * Full pipeline: merge partial times -> interpolate gaps ->
 * estimate unmapped -> enforce monotonic.
 */
export function buildFinalPartialTimes(params: {
  lines: string[]
  lineTimes: (number | undefined)[]
  touchedLines: ReadonlySet<number>
  origWtCanon: WordTimingsMap | undefined
  canonical: readonly CanonicalLrcEntry[]
  duration: number
}): (number | undefined)[] {
  const { lines, lineTimes, touchedLines, origWtCanon, canonical, duration } =
    params

  // 1. Merge: touched -> origWordTimings -> canonical fallback
  let result = mergePartialLineTimes(
    lines,
    lineTimes,
    touchedLines,
    origWtCanon,
    canonical,
  )

  // 2. Interpolate gaps between touched lines
  result = interpolateGaps(result, touchedLines, duration)

  // 3. Estimate times for completely unmapped lines beyond last touched
  if (duration > 0) {
    result = estimateUnmappedTimes(result, lines, duration)
  }

  // 4. Enforce monotonic ordering
  result = enforceMonotonicTimes(result)

  return result
}

// ── Composing what the finished session saves ────────────────────

/**
 * The song's timings as they stood before the session opened, keyed by LRC
 * index the way they were persisted. Everything the merge does is relative to
 * this: an untouched line keeps what is here, a touched one replaces it.
 */
export interface GenPreSnapshot {
  wordTimings?: WordTimingsMap
  wordEndTimings?: WordTimingsMap
  wordSweepTimings?: WordSweepTimingsMap
}

export interface ComposeGenResultInput {
  canonical: CanonicalLrcEntry[]
  lines: string[]
  /** The session's line starts, canonical-indexed. */
  lineTimes: (number | undefined)[]
  wordTimes: WordTimingsMap
  wordEnds: WordTimingsMap
  wordSweeps: WordSweepTimingsMap
  touchedLines: ReadonlySet<number>
  snapshot: GenPreSnapshot | null
  duration: number
}

/** Everything the finished session hands back, LRC-indexed and ready to save. */
export interface ComposedGenResult {
  lrcText: string
  wordTimings: WordTimingsMap
  wordEndTimings: WordTimingsMap
  wordSweepTimings: WordSweepTimingsMap
  /** Canonical-indexed line starts, for callers that want them. */
  lineTimes: (number | undefined)[]
}

/**
 * Re-key an LRC-indexed map onto canonical indices, dropping entries whose
 * line no longer exists. `clone` is per-map because word arrays only need a
 * shallow copy while sweep curves are nested.
 */
function toCanonicalMap<T>(
  source: Record<number, T> | undefined,
  lrcToCanon: ReadonlyMap<number, number>,
  clone: (value: T) => T,
): Record<number, T> {
  const out: Record<number, T> = {}
  if (source === undefined) return out
  for (const key of Object.keys(source)) {
    const canonicalIdx = lrcToCanon.get(+key)
    if (canonicalIdx !== undefined) out[canonicalIdx] = clone(source[+key])
  }
  return out
}

/** Word-level LRC for a line that has starts, line-level for one that does not. */
function plainLineToLrc(
  line: string,
  wordTimes: number[] | undefined,
  lineTime: number,
): string {
  if (line.trim() === '') return ''
  const words = line.split(/\s+/).filter((word) => word.length > 0)
  if (wordTimes !== undefined && wordTimes.length > 0 && words.length > 0) {
    return words
      .map((word, wordIdx) => {
        const time = wordTimes[wordIdx]
        return time !== undefined ? `[${formatTimeLrc(time)}] ${word}` : word
      })
      .join(' ')
  }
  return `[${formatTimeLrc(lineTime)}] ${line}`
}

/**
 * Turn a finished mapping session into the LRC text and timing maps that get
 * saved. Pure, because this is the step that decides what the singer keeps:
 * it merges the session over the pre-session snapshot, fills the lines nobody
 * touched, and re-keys everything from canonical indices back to LRC ones.
 *
 * The caller still owns the decisions around it — whether the session counts
 * as a cancel, and what to do if `lrcText` comes back empty.
 */
export function composeGenResult(
  input: ComposeGenResultInput,
): ComposedGenResult {
  const { canonical, lines, touchedLines, snapshot, duration } = input

  const lrcToCanon = buildLrcToCanonicalMap(canonical)
  const copyTimes = (times: number[]): number[] => [...times]

  const origWtCanon: WordTimingsMap | undefined =
    snapshot?.wordTimings === undefined
      ? undefined
      : toCanonicalMap(snapshot.wordTimings, lrcToCanon, copyTimes)
  const origEndsCanon = toCanonicalMap(
    snapshot?.wordEndTimings,
    lrcToCanon,
    copyTimes,
  )
  const origSweepsCanon = toCanonicalMap(
    snapshot?.wordSweepTimings,
    lrcToCanon,
    (sweeps: Record<number, WordSweepPoint[]>) => structuredClone(sweeps),
  )

  // Honest "all mapped": every line explicitly touched — the cursor reaching
  // the end only means the user finished at the end, not that they started
  // there (see isSessionFullyMapped).
  const allMapped = isSessionFullyMapped(lines.length, touchedLines)

  let finalTimes: (number | undefined)[]
  let wordTimesCanon: WordTimingsMap
  let wordEndsCanon: WordTimingsMap
  let wordSweepsCanon: WordSweepTimingsMap

  if (allMapped) {
    finalTimes = enforceMonotonicTimes(
      duration > 0
        ? estimateUnmappedTimes(input.lineTimes.slice(), lines, duration)
        : input.lineTimes.slice(),
    )
    wordTimesCanon = input.wordTimes
    wordEndsCanon = input.wordEnds
    wordSweepsCanon = input.wordSweeps
  } else {
    // Only touched lines get the session's times. The canonical fallback
    // inside mergePartialLineTimes is what keeps line-level LRC alive: without
    // it an untouched line goes undefined, gets re-estimated, and the singer's
    // original timestamp is gone.
    finalTimes = buildFinalPartialTimes({
      lines,
      lineTimes: input.lineTimes,
      touchedLines,
      origWtCanon,
      canonical,
      duration,
    })
    wordTimesCanon = mergePartialWordTimings(
      touchedLines,
      origWtCanon,
      input.wordTimes,
    )
    wordEndsCanon = mergePartialWordTimings(
      touchedLines,
      origEndsCanon,
      input.wordEnds,
    )
    wordSweepsCanon = {}
    for (const [lineIdx, sweeps] of Object.entries(origSweepsCanon)) {
      if (!touchedLines.has(+lineIdx)) {
        wordSweepsCanon[+lineIdx] = structuredClone(sweeps)
      }
    }
    for (const [lineIdx, sweeps] of Object.entries(input.wordSweeps)) {
      if (touchedLines.has(+lineIdx)) {
        wordSweepsCanon[+lineIdx] = structuredClone(sweeps)
      }
    }
  }

  const wordTimings: WordTimingsMap = {}
  const wordEndTimings: WordTimingsMap = {}
  const wordSweepTimings: WordSweepTimingsMap = {}

  if (canonical.length === 0) {
    // Plain-text source: there is no canonical list to index against, so the
    // session's own indices are already the LRC ones.
    Object.assign(wordTimings, wordTimesCanon)
    Object.assign(wordEndTimings, wordEndsCanon)
    Object.assign(wordSweepTimings, wordSweepsCanon)
    const lrcText = lines
      .map((line, i) =>
        plainLineToLrc(line, wordTimings[i], finalTimes[i] ?? 0),
      )
      .filter((line) => line !== '')
      .join('\n')
    return {
      lrcText,
      wordTimings,
      wordEndTimings,
      wordSweepTimings,
      lineTimes: finalTimes,
    }
  }

  for (const entry of canonical) {
    if (entry.lrcIndex < 0) continue // synthetic ~Rest~ rows have no LRC line
    const canonicalIdx = entry.canonicalIndex
    const starts = wordTimesCanon[canonicalIdx]
    if (starts !== undefined) wordTimings[entry.lrcIndex] = starts
    const ends = wordEndsCanon[canonicalIdx]
    if (ends !== undefined) wordEndTimings[entry.lrcIndex] = ends
    const sweeps = wordSweepsCanon[canonicalIdx]
    if (sweeps !== undefined) wordSweepTimings[entry.lrcIndex] = sweeps
  }

  const lrcText = buildLrcTextFromCanonical(
    canonical,
    finalTimes.map((time) => time ?? 0),
    wordTimings,
  )
  return {
    lrcText,
    wordTimings,
    wordEndTimings,
    wordSweepTimings,
    lineTimes: finalTimes,
  }
}
