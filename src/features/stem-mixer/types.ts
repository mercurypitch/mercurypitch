// ============================================================
// StemMixer shared types
// ============================================================

export type WordTimingsMap = Record<number, number[]>

export interface WordSweepPoint {
  /** Absolute song time in seconds. */
  time: number
  /** Visual position through the word, from 0 (first glyph) to 1 (last). */
  progress: number
}

/** Per line, then per word, a time-to-highlight-position curve. */
export type WordSweepTimingsMap = Record<
  number,
  Record<number, WordSweepPoint[]>
>

export interface LyricsTimingExtension {
  /** Exact audible end of each word. Uses the same line/word indices as starts. */
  wordEndTimings: WordTimingsMap
  /** Optional non-linear marker path for held and segmented vowels. */
  wordSweepTimings: WordSweepTimingsMap
}

export type LrcGenInputMode = 'marker' | 'tap'

export interface LyricsBlock {
  id: string
  label: string
  lineIndices: number[]
  repeatCount: number
}

export type BlockInstancesMap = Record<string, number[][]>

export interface CanonicalLrcEntry {
  type: 'line' | 'rest'
  lrcIndex: number
  canonicalIndex: number
  time: number
  text: string
  words: string[]
  wordTimes?: number[]
  /** Rest entries only: when the silence begins (seconds). Equals `time`. */
  gapStart?: number
  /** Rest entries only: when the next line starts (seconds). */
  gapEnd?: number
  /** Rest entries only: number of countdown dots (~5s each, min 1). */
  dotCount?: number
}

export interface DisplayLine {
  text: string
  isBlank: boolean
  isRest: boolean
  lyricsIndex: number
  /** Rest rows only: drives the karaoke countdown dots. */
  restGapStart?: number
  restGapEnd?: number
  restDotCount?: number
}

export interface BlockInfo {
  blockId: string
  instanceIdx: number
  isTemplate: boolean
}

export interface BlockStartsInfo {
  blockId: string
  label: string
  instanceIdx: number
  isTemplate: boolean
  repeatCount: number
  color: string
  startLine: number
  endLine: number
}

export interface GenViewLine {
  index: number
  line: string
  words: string[]
  isCurrent: boolean
  isDone: boolean
  isFuture: boolean
  lineTime: number | undefined
  wordTimes: number[]
  wordEndTimes: number[]
  wordSweeps: Record<number, WordSweepPoint[]>
  activeWordIdx: number
  blockInfo: BlockInfo | null
  blockLabel: string | undefined
  isPlaceholder: boolean
  isPlaceholderStart: boolean
}

export interface EditPopover {
  lineIdx: number
  wordIdx: number
  word: string
}

export interface LyricsUploadResult {
  text: string
  format: 'txt' | 'lrc'
  filename: string
  wordTimings?: WordTimingsMap
  originalText?: string
}

export type LyricsSource = 'api' | 'upload' | 'none'

export interface PitchNote {
  time: number
  noteName: string
  frequency: number
  octave: number
}
