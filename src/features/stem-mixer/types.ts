// ============================================================
// StemMixer shared types
// ============================================================

export type WordTimingsMap = Record<number, number[]>

export interface LyricsBlock {
  id: string
  label: string
  lineIndices: number[]
  repeatCount: number
}

export type BlockInstancesMap = Record<string, number[][]>

export interface DisplayLine {
  text: string
  isBlank: boolean
  isRest: boolean
  lyricsIndex: number
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
  line: string
  words: string[]
  isCurrent: boolean
  isDone: boolean
  isFuture: boolean
  lineTime: number | undefined
  wordTimes: number[]
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
  rawText?: string
}

export type LyricsSource = 'api' | 'upload' | 'none'

export interface PitchNote {
  time: number
  noteName: string
  frequency: number
  octave: number
}
