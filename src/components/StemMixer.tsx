// ============================================================
// StemMixer — Play separated stems with volume control & pitch viz
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { PitchDetector, type DetectedPitch } from '@/lib/pitch-detector'
import { freqToNote } from '@/lib/scale-data'
import { ChevronLeft, Download, Ear, Mic, Midi, Pause, Play, SkipBack, Volume2, VolumeX } from './icons'
import { extractTitle, getCurrentLineIndex, getCurrentLrcIndex, parseLrcFile, parseTextLyrics, searchLyrics, type LrcLine, type LyricsSearchResult } from '@/lib/lyrics-service'
import { LyricsUploader, type LyricsUploadResult } from './LyricsUploader'

// ── Types ──────────────────────────────────────────────────────

interface StemMixerProps {
  stems: {
    vocal?: string
    instrumental?: string
    vocalMidi?: string
  }
  sessionId: string
  songTitle?: string
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

interface PitchNote {
  time: number
  noteName: string
  frequency: number
  octave: number
}

// ── Constants ──────────────────────────────────────────────────

const FFT_SIZE = 256
const PITCH_FFT_SIZE = 2048

// ── Component ──────────────────────────────────────────────────

export const StemMixer: Component<StemMixerProps> = (props) => {
  // ── State ────────────────────────────────────────────────────
  const [loading, setLoading] = createSignal(true)
  const [loadError, setLoadError] = createSignal('')
  const [loadProgress, setLoadProgress] = createSignal(0)
  const [playing, setPlaying] = createSignal(false)
  const [duration, setDuration] = createSignal(0)
  const [elapsed, setElapsed] = createSignal(0)
  const [currentPitch, setCurrentPitch] = createSignal<DetectedPitch | null>(null)
  const [anySoloed, setAnySoloed] = createSignal(false)

  // ── Lyrics state ──────────────────────────────────────────────
  const [lyricsLines, setLyricsLines] = createSignal<string[]>([])
  const [lrcLines, setLrcLines] = createSignal<LrcLine[]>([])
  const [rawLyricsText, setRawLyricsText] = createSignal('')  // unfiltered original text
  const [currentLineIdx, setCurrentLineIdx] = createSignal(-1)
  const [lyricsSource, setLyricsSource] = createSignal<'api' | 'upload' | 'none'>('none')
  const [lyricsLoading, setLyricsLoading] = createSignal(false)
  const [lyricsFontSize, setLyricsFontSize] = createSignal(1.0)    // rem
  const [lyricsColumns, setLyricsColumns] = createSignal<1 | 2>(1)
  const [editMode, setEditMode] = createSignal(false)
  type WordTimingsMap = Record<number, number[]>  // line idx → word start times (seconds)
  const [wordTimings, setWordTimings] = createSignal<WordTimingsMap>({})
  // Unsaved edit buffer — merged into wordTimings on save
  const [editBuffer, setEditBuffer] = createSignal<WordTimingsMap>({})
  const [editPopover, setEditPopover] = createSignal<{ lineIdx: number; wordIdx: number; word: string } | null>(null)
  // LRC generator mode — real-time word/line timing via playback
  const [lrcGenMode, setLrcGenMode] = createSignal(false)
  const [lrcGenLineIdx, setLrcGenLineIdx] = createSignal(0)
  const [lrcGenWordIdx, setLrcGenWordIdx] = createSignal(0)
  const [lrcGenLineTimes, setLrcGenLineTimes] = createSignal<number[]>([])
  const [lrcGenWordTimings, setLrcGenWordTimings] = createSignal<WordTimingsMap>({})
  const [windowDuration, setWindowDuration] = createSignal(30) // seconds, range 10-150
  const [windowStart, setWindowStart] = createSignal(0)

  // ── Repeat blocks state ─────────────────────────────────────────
  interface LyricsBlock {
    id: string             // unique ID: "chorus-1", "verse-2"
    label: string          // user label: "Chorus", "Verse 1"
    lineIndices: number[]  // line indices of the template instance
    repeatCount: number    // how many times this block repeats (default 1)
  }
  type BlockInstancesMap = Record<string, number[][]>  // block ID → array of [start, endExclusive]
  const [blocks, setBlocks] = createSignal<LyricsBlock[]>([])
  const [blockInstances, setBlockInstances] = createSignal<BlockInstancesMap>({})
  const [blockMarkMode, setBlockMarkMode] = createSignal(false)
  const [markStartLine, setMarkStartLine] = createSignal<number | null>(null)
  const [markEndLine, setMarkEndLine] = createSignal<number | null>(null)
  const [showBlockForm, setShowBlockForm] = createSignal(false)
  const [blockEditTarget, setBlockEditTarget] = createSignal<string | null>(null)  // block ID being edited

  // ── Mic pitch comparison state ────────────────────────────────
  const [micEnabled, setMicEnabled] = createSignal(false)
  const [micActive, setMicActive] = createSignal(false)
  const [micPitch, setMicPitch] = createSignal<DetectedPitch | null>(null)
  const [micError, setMicError] = createSignal('')

  // ── Scoring state ───────────────────────────────────────────
  interface ComparisonPoint {
    time: number
    vocalNote: string
    micNote: string
    centsOff: number       // positive = mic is sharp
    inTolerance: boolean
  }
  interface MicScore {
    totalNotes: number
    matchedNotes: number
    accuracyPct: number
    avgCentsOff: number
    grade: 'S' | 'A' | 'B' | 'C' | 'D'
  }
  const [comparisonData, setComparisonData] = createSignal<ComparisonPoint[]>([])
  const [toleranceCents, setToleranceCents] = createSignal(50)
  const [score, setScore] = createSignal<MicScore | null>(null)
  const [showScore, setShowScore] = createSignal(false)

  // ── Workspace panel state ─────────────────────────────────────
  interface WorkspacePanel {
    id: 'overview' | 'live' | 'pitch' | 'controls' | 'lyrics'
    label: string
    order: number
    height: number | null  // null = auto (fit-content)
  }

  const [workspaceColumns, setWorkspaceColumns] = createSignal<1 | 2>(2)

  const [panels, setPanels] = createSignal<WorkspacePanel[]>([
    { id: 'overview', label: 'Waveform Overview', order: 0, height: 180 },
    { id: 'live', label: 'Live Waveform', order: 1, height: 180 },
    { id: 'pitch', label: 'Vocal Pitch', order: 2, height: 200 },
    { id: 'controls', label: 'Stem Controls', order: 3, height: null },
    { id: 'lyrics', label: 'Lyrics', order: 4, height: 360 },
  ])

  const reorderPanels = (fromId: string, toOrder: number) => {
    setPanels(prev => {
      const next = prev.map(p => ({ ...p }))
      const fromIdx = next.findIndex(p => p.id === fromId)
      if (fromIdx === -1) return prev
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toOrder, 0, moved)
      return next.map((p, i) => ({ ...p, order: i }))
    })
  }

  // ── Drag state (module-level lets — no signals to avoid re-renders) ──
  let dragPanelId: string | null = null
  let dragStartOrder = -1
  let dragTargetOrder = -1
  let dragOffsetX = 0
  let dragOffsetY = 0

  // ── Resize drag state ──────────────────────────────────────────
  let resizePanelId: string | null = null
  let resizeStartY = 0
  let resizeStartHeight = 0

  // ── Refs ─────────────────────────────────────────────────────
  let audioCtx: AudioContext | null = null
  let mainGain: GainNode | null = null
  let vocalAnalyser: AnalyserNode | null = null
  let pitchDetector: PitchDetector | null = null
  let rafId = 0
  let startTime = 0
  let pauseOffset = 0
  let pitchHistory: PitchNote[] = []

  // Mic pitch comparison refs (not signals — no reactivity needed in RAF loop)
  let micStream: MediaStream | null = null
  let micGainNode: GainNode | null = null
  let micAnalyserNode: AnalyserNode | null = null
  let micPitchDetector: PitchDetector | null = null
  let micPitchHistory: PitchNote[] = []

  let waveformCanvasRef: HTMLCanvasElement | undefined
  let pitchCanvasRef: HTMLCanvasElement | undefined
  let liveWaveCanvasRef: HTMLCanvasElement | undefined
  let progressBarRef: HTMLDivElement | undefined
  let workspaceRef: HTMLDivElement | undefined
  let lyricsFileInputRef: HTMLInputElement | undefined

  // Cached canvas dimensions — updated only on resize, not every frame
  let overviewRect = { w: 0, h: 0 }
  let liveRect = { w: 0, h: 0 }
  let pitchRect = { w: 0, h: 0 }

  const vocalTrack = (): StemTrack => ({
    label: 'Vocal',
    url: props.stems.vocal || '',
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
    url: props.stems.instrumental || '',
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

  const tracks = () => [vocal(), instrumental()].filter(t => t.url)

  // ── Audio Context ────────────────────────────────────────────
  const ensureAudioCtx = () => {
    if (!audioCtx) {
      audioCtx = new AudioContext()
      mainGain = audioCtx.createGain()
      mainGain.gain.value = 0.7
      mainGain.connect(audioCtx.destination)
      vocalAnalyser = audioCtx.createAnalyser()
      vocalAnalyser.fftSize = PITCH_FFT_SIZE
      vocalAnalyser.smoothingTimeConstant = 0.3
      pitchDetector = new PitchDetector({
        sampleRate: audioCtx.sampleRate,
        bufferSize: PITCH_FFT_SIZE,
        minConfidence: 0.4,
        minAmplitude: 0.02,
      })
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    return audioCtx
  }

  // ── Load Stems ───────────────────────────────────────────────
  const loadStems = async () => {
    setLoading(true)
    setLoadError('')
    setLoadProgress(0)

    const ctx = ensureAudioCtx()
    const urls = [props.stems.vocal, props.stems.instrumental].filter(Boolean) as string[]
    const total = urls.length
    let loaded = 0

    const loadOne = async (url: string): Promise<AudioBuffer> => {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`)
      const arrayBuf = await resp.arrayBuffer()
      const buf = await ctx.decodeAudioData(arrayBuf)
      loaded++
      setLoadProgress(Math.round((loaded / total) * 100))
      return buf
    }

    try {
      const results = await Promise.allSettled([
        props.stems.vocal ? loadOne(props.stems.vocal) : Promise.reject('no vocal'),
        props.stems.instrumental ? loadOne(props.stems.instrumental) : Promise.reject('no inst'),
      ])

      const [vocalResult, instResult] = results

      if (vocalResult.status === 'fulfilled') {
        setVocal(prev => ({ ...prev, buffer: vocalResult.value }))
        const d = vocalResult.value.duration
        if (d > duration()) setDuration(d)
      } else if (props.stems.vocal) {
        console.warn('Failed to load vocal stem:', vocalResult.reason)
      }

      if (instResult.status === 'fulfilled') {
        setInstrumental(prev => ({ ...prev, buffer: instResult.value }))
        const d = instResult.value.duration
        if (d > duration()) setDuration(d)
      } else if (props.stems.instrumental) {
        console.warn('Failed to load instrumental stem:', instResult.reason)
      }

      if (total > 0 && loaded === 0) {
        setLoadError('Failed to load any stems')
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load stems')
    } finally {
      setLoading(false)
    }
  }

  // ── Lyrics Loading ────────────────────────────────────────────
  const LYRICS_STORE_KEY = () => `lyrics_v1_${props.sessionId}`

  const persistLyrics = (text: string, format: 'txt' | 'lrc', filename: string, wt?: WordTimingsMap) => {
    try {
      const payload: Record<string, unknown> = { text, format, filename, timestamp: Date.now() }
      if (wt && Object.keys(wt).length > 0) payload.wordTimings = wt
      const bl = blocks()
      if (bl.length > 0) payload.blocks = bl
      const bi = blockInstances()
      if (Object.keys(bi).length > 0) payload.blockInstances = bi
      payload.fontSize = lyricsFontSize()
      localStorage.setItem(LYRICS_STORE_KEY(), JSON.stringify(payload))
    } catch { /* storage full or unavailable */ }
  }

  const loadPersistedLyrics = (): (LyricsUploadResult & { wordTimings?: WordTimingsMap }) | null => {
    try {
      const raw = localStorage.getItem(LYRICS_STORE_KEY())
      if (!raw) return null
      const data = JSON.parse(raw)
      if (data.text && (data.format === 'txt' || data.format === 'lrc')) {
        const result: LyricsUploadResult & { wordTimings?: WordTimingsMap } = {
          text: data.text, format: data.format, filename: data.filename || 'saved.txt',
        }
        if (data.wordTimings && typeof data.wordTimings === 'object') {
          result.wordTimings = data.wordTimings as WordTimingsMap
        }
        // Restore font size
        if (typeof data.fontSize === 'number') setLyricsFontSize(data.fontSize)
        // Restore blocks
        if (Array.isArray(data.blocks)) setBlocks(data.blocks as LyricsBlock[])
        if (data.blockInstances && typeof data.blockInstances === 'object') {
          setBlockInstances(data.blockInstances as BlockInstancesMap)
        }
        return result
      }
    } catch { /* corrupted data */ }
    return null
  }

  const loadLyrics = async () => {
    // Check persisted lyrics first — no need for API call if user already uploaded
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

    const rawInput = props.songTitle || props.sessionId || ''
    const title = extractTitle(rawInput)
    if (!title || title === 'Unknown') {
      setLyricsSource('none')
      return
    }

    setLyricsLoading(true)
    try {
      const result = await searchLyrics(title)
      if (result) {
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
      handleLyricsUpload({ text, format: ext as 'txt' | 'lrc', filename: file.name })
    }
    reader.readAsText(file)
  }

  const updateCurrentLine = () => {
    if (lrcLines().length > 0) {
      setCurrentLineIdx(getCurrentLrcIndex(lrcLines(), elapsed()))
    } else if (lyricsLines().length > 0 && duration() > 0) {
      setCurrentLineIdx(getCurrentLineIndex(lyricsLines().length, elapsed(), duration()))
    }
  }

  // ── Word-level timing + render data ─────────────────────────
  // Single memo that pre-computes ALL active states so the template
  // re-renders reliably when elapsed / currentLineIdx change.
  // Using .map() instead of <For> because <For> skips re-renders
  // when the source array identity hasn't changed (which it doesn't
  // during playback — lrcLines/textLines stay the same).

  interface LyricRenderLine {
    key: string
    time: number
    words: string[]
    isActive: boolean
    activeUpTo: number  // -1 = no words active, N = words 0..N are "done"
    activeCharProgress: number  // 0..word.length, chars "done" in the word at activeUpTo+1
  }

  const lyricsRenderData = createMemo<LyricRenderLine[]>(() => {
    const dur = duration()
    const lrc = lrcLines()
    const txt = lyricsLines()
    const curIdx = currentLineIdx()
    const elapsedTime = elapsed()

    const computeActiveWord = (words: string[], startTime: number, endTime: number): { activeUpTo: number; charProgress: number } => {
      if (words.length === 0) return { activeUpTo: -1, charProgress: 0 }
      const lineDuration = Math.max(0.05, endTime - startTime)
      const progress = (elapsedTime - startTime) / lineDuration
      if (progress < 0) return { activeUpTo: -1, charProgress: 0 }
      if (progress >= 1) return { activeUpTo: words.length - 1, charProgress: words[words.length - 1]?.length || 0 }

      const wordDuration = lineDuration / words.length
      const currentWordIdx = Math.floor(progress * words.length)
      const activeUpTo = currentWordIdx - 1

      const elapsedInWord = elapsedTime - startTime - (currentWordIdx * wordDuration)
      const currentWord = words[currentWordIdx]
      const charProgress = Math.min(Math.floor((elapsedInWord / wordDuration) * currentWord.length), currentWord.length)

      return { activeUpTo, charProgress }
    }

    if (lrc.length > 0) {
      return lrc.map((line, i) => {
        const words = line.text.split(/\s+/).filter(w => w.length > 0)
        const endTime = i + 1 < lrc.length ? lrc[i + 1].time : dur
        const isActive = i === curIdx
        const { activeUpTo, charProgress } = isActive ? computeActiveWord(words, line.time, endTime) : { activeUpTo: -1, charProgress: 0 }
        return {
          key: `lrc-${i}`,
          time: line.time,
          words,
          isActive,
          activeUpTo,
          activeCharProgress: charProgress,
        }
      })
    }
    if (txt.length > 0 && dur > 0) {
      return txt.map((text, i) => {
        const words = text.split(/\s+/).filter(w => w.length > 0)
        const startTime = (i / txt.length) * dur
        const endTime = ((i + 1) / txt.length) * dur
        const isActive = i === curIdx
        const { activeUpTo, charProgress } = isActive ? computeActiveWord(words, startTime, endTime) : { activeUpTo: -1, charProgress: 0 }
        return {
          key: `txt-${i}`,
          time: startTime,
          words,
          isActive,
          activeUpTo,
          activeCharProgress: charProgress,
        }
      })
    }
    return []
  })

  // Display lines — preserves blank lines from raw text for visual spacing
  interface DisplayLine {
    text: string
    isBlank: boolean
    lyricsIndex: number  // index into lyricsLines(), -1 if blank
  }

  const displayLines = createMemo<DisplayLine[]>(() => {
    const raw = rawLyricsText()
    const ll = lyricsLines()
    const lrc = lrcLines()

    if (lrc.length > 0) {
      // LRC — no blank lines to preserve
      return lrc.map((l, i) => ({ text: l.text, isBlank: false, lyricsIndex: i }))
    }
    if (!raw || ll.length === 0) return []

    const rawLines = raw.split('\n')
    let lyricIdx = 0
    return rawLines.map((rawLine) => {
      const trimmed = rawLine.trim()
      if (trimmed === '') {
        return { text: '', isBlank: true, lyricsIndex: -1 }
      }
      const idx = lyricIdx
      lyricIdx++
      return { text: trimmed, isBlank: false, lyricsIndex: idx }
    })
  })

  // Detect blank-line-separated sections for optional multi-column layout
  const lyricsSections = createMemo(() => {
    const lines = lrcLines().length > 0
      ? lrcLines().map(l => l.text)
      : lyricsLines()
    const sections: number[][] = []
    let current: number[] = []
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '') {
        if (current.length > 0) { sections.push(current); current = [] }
      } else {
        current.push(i)
      }
    }
    if (current.length > 0) sections.push(current)
    return sections
  })

  const hasMultipleSections = () => lyricsSections().length >= 2

  // ── Lyric line click ────────────────────────────────────────
  const handleLyricLineClick = (idx: number) => {
    if (lrcLines().length > 0 && idx < lrcLines().length) {
      const time = lrcLines()[idx].time
      pauseOffset = Math.min(time, duration())
    } else if (lyricsLines().length > 0 && duration() > 0) {
      pauseOffset = (idx / lyricsLines().length) * duration()
    }
    setElapsed(pauseOffset)
    if (playing()) {
      disconnectSources()
      createSources(pauseOffset)
      startTime = audioCtx!.currentTime - pauseOffset
      pitchHistory = []
      pitchDetector?.resetHistory()
    }
  }

  // ── Edit mode helpers ─────────────────────────────────────────

  /** Parse "MM:SS" → total seconds. Returns null if invalid. */
  const parseTimeInput = (input: string): number | null => {
    const trimmed = input.trim()
    const match = trimmed.match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return null
    const mins = parseInt(match[1], 10)
    const secs = parseInt(match[2], 10)
    if (secs >= 60) return null
    return mins * 60 + secs
  }

  /** Format seconds → "MM:SS" (minutes capped at 99, seconds 0-59) */
  const formatTimeMs = (secs: number): string => {
    const m = Math.min(99, Math.floor(secs / 60))
    const s = Math.min(59, Math.round(secs % 60))
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const formatTimeLrcWord = (secs: number): string => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toFixed(2).padStart(5, '0')
    return `${m}:${s}`
  }

  // Popover handlers
  const openWordPopover = (lineIdx: number, wordIdx: number, word: string, e: MouseEvent) => {
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

  const estimateWordTimings = (): WordTimingsMap => {
    const dur = duration()
    const hasLrc = lrcLines().length > 0
    const lines: string[] = hasLrc
      ? lrcLines().map(l => l.text)
      : lyricsLines()
    const lineTimes: number[] = hasLrc
      ? lrcLines().map(l => l.time)
      : lines.map((_, i) => dur > 0 ? (i / lines.length) * dur : i * 3)
    const lineEndTimes: number[] = hasLrc
      ? lrcLines().map((l, i) => i + 1 < lrcLines().length ? lrcLines()[i + 1].time : l.time + 3)
      : lines.map((_, i) => dur > 0 ? ((i + 1) / lines.length) * dur : (i + 1) * 3)

    const timings: WordTimingsMap = {}
    for (let i = 0; i < lines.length; i++) {
      const words = lines[i].split(/\s+/).filter(w => w.length > 0)
      if (words.length === 0) continue
      const lineDur = Math.max(0.1, lineEndTimes[i] - lineTimes[i])
      const charTotal = words.reduce((sum, w) => sum + w.length, 0) || 1
      let charPos = 0
      timings[i] = words.map(w => {
        const start = lineTimes[i] + (charPos / charTotal) * lineDur
        charPos += w.length
        return Math.round(start * 1000) / 1000
      })
    }
    return timings
  }

  const toggleEditMode = () => {
    if (editMode()) {
      // Cancel — discard buffer
      setEditBuffer({})
      setEditMode(false)
      return
    }
    // Enter edit mode — load or estimate word timings
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
    const lineData = (lrcLines().length > 0 ? lrcLines()[lineIdx]?.text : lyricsLines()[lineIdx]) || ''
    const wordList = lineData.split(/\s+/).filter(w => w.length > 0)
    const oldStart = prev[lineIdx]?.[0] ?? 0
    const delta = parsed - oldStart
    const next: WordTimingsMap = {}
    for (const key of Object.keys(prev)) next[+key] = [...prev[+key]]
    if (prev[lineIdx]) {
      next[lineIdx] = prev[lineIdx].map(t => Math.max(0, Math.round((t + delta) * 1000) / 1000))
    }
    setEditBuffer(next)
  }

  const handleWordTimeEdit = (lineIdx: number, wordIdx: number, value: string) => {
    const parsed = parseTimeInput(value)
    if (parsed === null) return
    const next: WordTimingsMap = {}
    for (const key of Object.keys(editBuffer())) next[+key] = [...editBuffer()[+key]]
    if (!next[lineIdx]) next[lineIdx] = []
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

    const filename = loadPersistedLyrics()?.filename || 'edited.lrc'
    const hasLrc = lrcLines().length > 0

    // Build clean LRC text (no word tags) + persist wordTimings as metadata
    let text: string
    if (hasLrc) {
      text = lrcLines().map((l, i) => {
        // Use edited line start time from merged word timings, falling back to original
        const lineTime = merged[i]?.[0] ?? l.time
        return `[${formatTimeLrcWord(lineTime)}] ${l.text}`
      }).join('\n')
    } else {
      text = lyricsLines().map((line, i) => {
        if (!line.trim()) return ''
        const baseTime = merged[i]?.[0] ?? (duration() > 0 ? (i / lyricsLines().length) * duration() : i * 3)
        return `[${formatTimeLrcWord(baseTime)}] ${line}`
      }).join('\n')
    }

    persistLyrics(text, 'lrc', filename, merged)
    const parsed = parseLrcFile(text)
    setLrcLines(parsed)
    setLyricsLines([])
    setEditMode(false)
    setEditBuffer({})
  }

  // ── LRC Generator mode ──────────────────────────────────────────
  const getGenLines = (): string[] => {
    if (lrcLines().length > 0) return lrcLines().map(l => l.text)
    return lyricsLines()
  }

  // ── Repeat blocks helpers ────────────────────────────────────────

  const BLOCK_COLORS = ['#f0a060', '#60a0f0', '#60d080', '#d080e0', '#e0c050', '#f06080']

  const getBlockColor = (blockId: string): string => {
    let hash = 0
    for (let i = 0; i < blockId.length; i++) hash = ((hash << 5) - hash) + blockId.charCodeAt(i)
    return BLOCK_COLORS[Math.abs(hash) % BLOCK_COLORS.length]
  }

  /** Which block does a given line index belong to? Returns block ID + instance index, or null. */
  const getBlockForLine = (lineIdx: number): { blockId: string; instanceIdx: number; isTemplate: boolean } | null => {
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

  /** Get the block definition by ID. */
  const getBlockById = (blockId: string): LyricsBlock | undefined => {
    return blocks().find(b => b.id === blockId)
  }

  /** Auto-detect identical text sequences in remaining lines. */
  const detectBlockInstances = (
    textLines: string[],
    templateIndices: number[],
    existingInstances: BlockInstancesMap,
  ): number[][] => {
    const templateText = templateIndices.map(i => textLines[i].trim())
    if (templateText.every(t => !t)) return [templateIndices]

    const instances: number[][] = [templateIndices]

    // Collect already-taken line indices
    const taken = new Set<number>()
    for (const insts of Object.values(existingInstances)) {
      for (const inst of insts) {
        for (let i = inst[0]; i < inst[1]; i++) taken.add(i)
      }
    }

    for (let i = 0; i < textLines.length; i++) {
      if (taken.has(i)) continue
      // Skip if this range overlaps the template itself
      if (i >= templateIndices[0] && i <= templateIndices[templateIndices.length - 1]) continue

      let match = true
      for (let j = 0; j < templateText.length; j++) {
        const checkLine = textLines[i + j]?.trim()
        if (checkLine !== templateText[j]) { match = false; break }
      }
      if (match) {
        const instStart = i
        const instEnd = i + templateText.length
        instances.push([instStart, instEnd])
        // Mark these lines as taken
        for (let k = instStart; k < instEnd; k++) taken.add(k)
        i += templateText.length - 1
      }
    }
    return instances
  }

  /** Save just the blocks/instances to localStorage without touching lyrics text. */
  const persistBlocks = () => {
    try {
      const key = LYRICS_STORE_KEY()
      const raw = localStorage.getItem(key)
      if (!raw) return
      const data = JSON.parse(raw)
      data.blocks = blocks()
      data.blockInstances = blockInstances()
      localStorage.setItem(key, JSON.stringify(data))
    } catch { /* ignore */ }
  }

  /** Which block ID does a line's instance belong to? */
  const getBlockIdForLine = (lineIdx: number): string | null => {
    return getBlockForLine(lineIdx)?.blockId ?? null
  }

  /** Is this line the first line of a block instance? */
  const isBlockInstanceStart = (lineIdx: number): boolean => {
    const bi = blockInstances()
    for (const instances of Object.values(bi)) {
      for (const inst of instances) {
        if (inst[0] === lineIdx) return true
      }
    }
    return false
  }

  /** Get all lines that belong to any block (for checking overlaps in mark mode). */
  const getBlockedLineSet = (): Set<number> => {
    const s = new Set<number>()
    for (const instances of Object.values(blockInstances())) {
      for (const [start, end] of instances) {
        for (let i = start; i < end; i++) s.add(i)
      }
    }
    return s
  }

  // ── Block-aware LRC gen helpers ───────────────────────────────────

  /** Check if a block's template has been fully mapped in the LRC gen session. */
  const isTemplateMappedInGen = (blockId: string): boolean => {
    const block = getBlockById(blockId)
    if (!block) return false
    const lineTimes = lrcGenLineTimes()
    return block.lineIndices.every(i => lineTimes[i] !== undefined)
  }

  /** Get template block start time from lrcGenLineTimes. */
  const getTemplateStartTime = (blockId: string): number | undefined => {
    const block = getBlockById(blockId)
    if (!block) return undefined
    return lrcGenLineTimes()[block.lineIndices[0]]
  }

  /** Auto-fill a block instance's line times and word timings using template relative offsets. */
  const autoFillBlockInstance = (blockId: string, instanceIdx: number, instanceStartTime: number) => {
    const block = getBlockById(blockId)
    if (!block) return

    const instances = blockInstances()[blockId]
    if (!instances || instanceIdx >= instances.length) return

    const [tplStart, tplEnd] = instances[0]
    const [instStart] = instances[instanceIdx]
    const tplBlockStart = lrcGenLineTimes()[tplStart]
    if (tplBlockStart === undefined) return

    const tplLineCount = tplEnd - tplStart
    const templateWordTimes = lrcGenWordTimings()

    setLrcGenLineTimes(prev => {
      const next = [...prev]
      for (let j = 0; j < tplLineCount; j++) {
        const tplTime = prev[tplStart + j]
        if (tplTime !== undefined) {
          next[instStart + j] = Math.round((instanceStartTime + tplTime - tplBlockStart) * 1000) / 1000
        }
      }
      return next
    })

    setLrcGenWordTimings(prev => {
      const next: WordTimingsMap = {}
      for (const k of Object.keys(prev)) next[+k] = [...prev[+k]]
      for (let j = 0; j < tplLineCount; j++) {
        const tplWordTimes = templateWordTimes[tplStart + j]
        if (tplWordTimes && tplWordTimes.length > 0) {
          next[instStart + j] = tplWordTimes.map(tt =>
            Math.round((instanceStartTime + tt - tplBlockStart) * 1000) / 1000,
          )
        }
      }
      return next
    })
  }

  /** Expand all block instances into lineTimes/wordTimings before finishing LRC gen. */
  const expandAllBlockInstances = () => {
    const lineTimes = lrcGenLineTimes()
    for (const block of blocks()) {
      if (!isTemplateMappedInGen(block.id)) continue
      const instances = blockInstances()[block.id]
      if (!instances || instances.length <= 1) continue
      const tplBlockStart = lineTimes[instances[0][0]]
      if (tplBlockStart === undefined) continue
      for (let i = 1; i < instances.length; i++) {
        const instStartTime = lineTimes[instances[i][0]]
        if (instStartTime === undefined) continue
        autoFillBlockInstance(block.id, i, instStartTime)
      }
    }
  }

  // ── Block mark / unmark / delete handlers ────────────────────────

  const handleMarkBlock = (label: string, repeatCount: number) => {
    const start = markStartLine()
    const end = markEndLine()
    if (start === null || end === null || start >= end) return

    const lines = getGenLines()
    const templateIndices: number[] = []
    for (let i = start; i < end; i++) templateIndices.push(i)

    const blockId = `${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`

    // Auto-detect instances (skip for single-line templates)
    const instances = templateIndices.length >= 2
      ? detectBlockInstances(lines, templateIndices, blockInstances())
      : [templateIndices]

    // Create block
    const block: LyricsBlock = {
      id: blockId,
      label,
      lineIndices: templateIndices,
      repeatCount: Math.max(1, repeatCount),
    }
    setBlocks(prev => [...prev, block])
    setBlockInstances(prev => ({ ...prev, [blockId]: instances }))

    // Clear mark state
    setMarkStartLine(null)
    setMarkEndLine(null)
    setBlockMarkMode(false)
    setShowBlockForm(false)
    persistBlocks()
  }

  const handleUnlinkInstance = (blockId: string, instanceIdx: number) => {
    if (instanceIdx === 0) {
      // Unlinking the template — delete the whole block
      handleDeleteBlock(blockId)
      return
    }
    setBlockInstances(prev => {
      const next = { ...prev }
      next[blockId] = prev[blockId].filter((_, i) => i !== instanceIdx)
      if (next[blockId].length <= 1) {
        // Only template left — remove the block entirely
        delete next[blockId]
        setBlocks(prev => prev.filter(b => b.id !== blockId))
      }
      return next
    })
    persistBlocks()
  }

  const handleDeleteBlock = (blockId: string) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId))
    setBlockInstances(prev => {
      const next = { ...prev }
      delete next[blockId]
      return next
    })
    setBlockEditTarget(null)
    persistBlocks()
  }

  const handleAddInstance = (blockId: string, startIdx: number, endIdx: number) => {
    const block = getBlockById(blockId)
    if (!block) return
    setBlockInstances(prev => {
      const next = { ...prev }
      next[blockId] = [...(prev[blockId] || []), [startIdx, endIdx]]
      return next
    })
    setMarkStartLine(null)
    setMarkEndLine(null)
    persistBlocks()
  }

  const handleEditBlock = (blockId: string, label: string, repeatCount: number) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, label, repeatCount: Math.max(1, repeatCount) } : b))
    setBlockEditTarget(null)
    persistBlocks()
  }

  const genViewData = createMemo(() => {
    const lines = getGenLines()
    const curLine = lrcGenLineIdx()
    const curWord = lrcGenWordIdx()
    const lineTimes = lrcGenLineTimes()
    const wordTimes = lrcGenWordTimings()
    return lines.map((line, i) => {
      const words = line.split(/\s+/).filter(w => w.length > 0)
      const blockForLine = getBlockForLine(i)
      const isPlaceholder = blockForLine !== null && !blockForLine.isTemplate && isTemplateMappedInGen(blockForLine.blockId)
      const block = blockForLine ? getBlockById(blockForLine.blockId) : undefined
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
        isPlaceholderStart: isPlaceholder && i === (blockInstances()[blockForLine!.blockId]?.[blockForLine!.instanceIdx]?.[0] ?? -1),
      }
    })
  })

  const LRC_GEN_KEY = () => `lyrics_gen_v1_${props.sessionId}`

  const saveLrcGenProgress = () => {
    try {
      const payload = {
        lineTimes: lrcGenLineTimes(),
        wordTimings: lrcGenWordTimings(),
        lineIdx: lrcGenLineIdx(),
        wordIdx: lrcGenWordIdx(),
        timestamp: Date.now(),
      }
      localStorage.setItem(LRC_GEN_KEY(), JSON.stringify(payload))
    } catch { /* storage full */ }
  }

  const clearLrcGenProgress = () => {
    try { localStorage.removeItem(LRC_GEN_KEY()) } catch { /* ignore */ }
  }

  const startLrcGen = () => {
    const lines = getGenLines()
    if (lines.length === 0) return

    // Check for saved in-progress gen state
    let resumeLineIdx = 0
    let resumeWordIdx = 0
    try {
      const saved = localStorage.getItem(LRC_GEN_KEY())
      if (saved) {
        const data = JSON.parse(saved)
        if (data.lineTimes && Array.isArray(data.lineTimes) && data.lineTimes.length > 0) {
          setLrcGenLineTimes(data.lineTimes)
          if (data.wordTimings && typeof data.wordTimings === 'object') {
            setLrcGenWordTimings(data.wordTimings)
          }
          resumeLineIdx = Math.min(data.lineIdx ?? 0, lines.length)
          resumeWordIdx = data.wordIdx ?? 0
        }
      }
    } catch { /* ignore */ }

    // Only load edit buffer if not resuming from saved progress
    if (resumeLineIdx === 0 && resumeWordIdx === 0) {
      const eb = editBuffer()
      if (Object.keys(eb).length > 0) {
        setLrcGenLineTimes(Object.keys(eb).map(k => eb[+k][0] ?? 0).slice(0, lines.length))
        setLrcGenWordTimings(structuredClone(eb))
      } else if (Object.keys(wordTimings()).length > 0) {
        const wt = wordTimings()
        setLrcGenLineTimes(Object.keys(wt).map(k => wt[+k][0] ?? 0).slice(0, lines.length))
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

  const handleNextLine = () => {
    const t = Math.round(elapsed() * 1000) / 1000
    const lines = getGenLines()
    const idx = lrcGenLineIdx()
    if (idx >= lines.length) return

    // Record line start time
    setLrcGenLineTimes(prev => {
      const next = [...prev]
      next[idx] = t
      return next
    })

    // Check if current line is the first line of a linked block instance whose template is mapped
    const blockInfo = getBlockForLine(idx)
    if (blockInfo && !blockInfo.isTemplate && isTemplateMappedInGen(blockInfo.blockId)) {
      autoFillBlockInstance(blockInfo.blockId, blockInfo.instanceIdx, t)
      const instanceEnd = blockInstances()[blockInfo.blockId]?.[blockInfo.instanceIdx]?.[1] ?? idx + 1
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

    // Auto-fill remaining words in current line if any word-level timings exist
    const currentLine = lines[idx]
    const words = currentLine.split(/\s+/).filter(w => w.length > 0)
    if (words.length > 0 && lrcGenWordIdx() > 0) {
      // Fill remaining words with estimated times based on last word time
      const lastWordTime = lrcGenWordTimings()[idx]?.[lrcGenWordIdx() - 1] ?? t
      const remain = words.length - lrcGenWordIdx()
      if (remain > 0) {
        setLrcGenWordTimings(prev => {
          const next = { ...prev }
          next[idx] = [...(next[idx] || [])]
          for (let w = lrcGenWordIdx(); w < words.length; w++) {
            next[idx][w] = Math.round((lastWordTime + (w - lrcGenWordIdx() + 1) * 0.25) * 1000) / 1000
          }
          return next
        })
      }
    }

    // Advance to next line, or finish if this was the last
    if (idx + 1 >= lines.length) {
      setLrcGenLineIdx(idx + 1) // mark all lines done before finishing
      setLrcGenWordIdx(0)
      handleLrcGenFinish()
      return
    }
    setLrcGenLineIdx(idx + 1)
    setLrcGenWordIdx(0)
    saveLrcGenProgress()
  }

  const handleNextWord = () => {
    const t = Math.round(elapsed() * 1000) / 1000
    const lines = getGenLines()
    const lineIdx = lrcGenLineIdx()
    if (lineIdx >= lines.length) return

    const words = lines[lineIdx].split(/\s+/).filter(w => w.length > 0)
    const wordIdx = lrcGenWordIdx()

    // If this is the first word of the line, also record the line start time
    if (wordIdx === 0) {
      setLrcGenLineTimes(prev => {
        const next = [...prev]
        next[lineIdx] = t
        return next
      })

      // If this line is the start of a linked block instance with mapped template, auto-fill
      const blockInfo = getBlockForLine(lineIdx)
      if (blockInfo && !blockInfo.isTemplate && isTemplateMappedInGen(blockInfo.blockId)) {
        autoFillBlockInstance(blockInfo.blockId, blockInfo.instanceIdx, t)
        const instanceEnd = blockInstances()[blockInfo.blockId]?.[blockInfo.instanceIdx]?.[1] ?? lineIdx + 1
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

    // Record word start time
    setLrcGenWordTimings(prev => {
      const next: WordTimingsMap = {}
      for (const k of Object.keys(prev)) next[+k] = [...prev[+k]]
      if (!next[lineIdx]) next[lineIdx] = []
      const arr = [...next[lineIdx]]
      arr[wordIdx] = t
      next[lineIdx] = arr
      return next
    })

    // Advance word cursor; auto-advance line if at end of words
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
    // Expand any remaining block instances that haven't been auto-filled yet
    expandAllBlockInstances()

    const lines = getGenLines()
    const lineTimes = lrcGenLineTimes()
    const wordTimes = lrcGenWordTimings()

    // Build clean LRC text
    const lrcText = lines.map((line, i) => {
      if (!line.trim()) return ''
      const lt = lineTimes[i]
      if (lt === undefined) return line // untimed line
      return `[${formatTimeLrcWord(lt)}] ${line}`
    }).join('\n')

    const filename = loadPersistedLyrics()?.filename || 'generated.lrc'
    persistLyrics(lrcText, 'lrc', filename, wordTimes)
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
    const filename = loadPersistedLyrics()?.filename || 'lyrics.lrc'

    if (lrcLines().length > 0) {
      // Export existing LRC with timestamps
      lrcText = lrcLines().map(l => `[${formatTimeLrcWord(l.time)}] ${l.text}`).join('\n')
    } else if (lyricsLines().length > 0) {
      // Export plain text — build LRC from wordTimings if available
      const wt = wordTimings()
      const hasTimings = Object.keys(wt).length > 0
      const lineTimes = hasTimings
        ? lyricsLines().map((_, i) => {
            const words = wt[i]
            return words && words.length > 0 ? words[0] : undefined
          })
        : lyricsLines().map(() => undefined)
      lrcText = lyricsLines().map((line, i) => {
        if (!line.trim()) return ''
        const lt = lineTimes[i]
        return lt !== undefined ? `[${formatTimeLrcWord(lt)}] ${line}` : line
      }).join('\n')
    }

    if (!lrcText.trim()) return

    const blob = new Blob([lrcText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.lrc') ? filename : filename.replace(/\.[^.]+$/, '') + '.lrc'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Create Source Nodes ──────────────────────────────────────
  const createSources = (offset: number) => {
    const ctx = audioCtx!
    const now = ctx.currentTime

    for (const track of tracks()) {
      if (!track.buffer) continue

      const isAudible = track.soloed || (!track.muted && !anySoloed())
      if (!isAudible) continue

      const src = ctx.createBufferSource()
      src.buffer = track.buffer

      const gain = ctx.createGain()
      gain.gain.value = track.volume

      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.8

      src.connect(gain)
      gain.connect(analyser)
      analyser.connect(mainGain!)

      // Connect vocal to pitch analyser too
      if (track.label === 'Vocal' && vocalAnalyser) {
        gain.connect(vocalAnalyser)
      }

      src.start(now, offset)
      src.onended = () => {
        try { src.disconnect(); gain.disconnect(); analyser.disconnect() } catch (_) { /* already disconnected */ }
      }

      if (track.label === 'Vocal') {
        setVocal(prev => ({ ...prev, sourceNode: src, gainNode: gain, analyserNode: analyser }))
      } else {
        setInstrumental(prev => ({ ...prev, sourceNode: src, gainNode: gain, analyserNode: analyser }))
      }
    }
  }

  const disconnectSources = () => {
    for (const track of tracks()) {
      try { track.sourceNode?.stop() } catch (_) { /* already stopped */ }
      try { track.sourceNode?.disconnect() } catch (_) { /* */ }
      try { track.gainNode?.disconnect() } catch (_) { /* */ }
      try { track.analyserNode?.disconnect() } catch (_) { /* */ }
    }
    setVocal(prev => ({ ...prev, sourceNode: null, gainNode: null, analyserNode: null }))
    setInstrumental(prev => ({ ...prev, sourceNode: null, gainNode: null, analyserNode: null }))
  }

  // ── Transport ────────────────────────────────────────────────
  const handlePlay = () => {
    ensureAudioCtx()
    disconnectSources()
    createSources(pauseOffset)
    startTime = audioCtx!.currentTime - pauseOffset
    setPlaying(true)
    pitchHistory = []
    pitchDetector?.resetHistory()
    startRafLoop()
  }

  const handlePause = () => {
    pauseOffset = audioCtx!.currentTime - startTime
    disconnectSources()
    setPlaying(false)
    cancelAnimationFrame(rafId)
    syncCanvasSizes()
    drawWaveformOverview()
    drawPitchCanvas()
    drawLiveWaveform()
  }

  const handleStop = () => {
    // Compute score if mic was active during playback
    if (micActive() && comparisonData().length > 0) {
      const s = computeScore()
      setScore(s)
      setShowScore(true)
    }
    pauseOffset = 0
    disconnectSources()
    setPlaying(false)
    setElapsed(0)
    setCurrentPitch(null)
    pitchHistory = []
    setWindowStart(0)
    cancelAnimationFrame(rafId)
    drawWaveformOverview()
    drawPitchCanvas()
    drawLiveWaveform()
  }

  const handleRestart = () => {
    resetScore()
    pauseOffset = 0
    disconnectSources()
    setPlaying(false)
    setElapsed(0)
    setCurrentPitch(null)
    pitchHistory = []
    pitchDetector?.resetHistory()
    setWindowStart(0)
    cancelAnimationFrame(rafId)
    drawWaveformOverview()
    drawPitchCanvas()
    drawLiveWaveform()
    // Start playing from beginning
    handlePlay()
  }

  const handleSeek = (e: MouseEvent) => {
    if (!progressBarRef || !duration()) return
    const rect = progressBarRef.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekTo(ratio * duration())
  }

  const seekTo = (time: number) => {
    pauseOffset = Math.min(time, duration())
    setElapsed(pauseOffset)
    if (playing()) {
      disconnectSources()
      createSources(pauseOffset)
      startTime = audioCtx!.currentTime - pauseOffset
      pitchHistory = []
      pitchDetector?.resetHistory()
    }
    // Always redraw canvases so playhead moves immediately
    requestAnimationFrame(() => {
      syncCanvasSizes()
      drawWaveformOverview()
      drawLiveWaveform()
      drawPitchCanvas()
    })
  }

  const handleWaveformClick = (e: MouseEvent) => {
    const canvas = waveformCanvasRef
    if (!canvas || !duration()) return
    const rect = canvas.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const winStart = windowStart()
    seekTo(winStart + ratio * windowDuration())
  }

  // ── Volume / Mute / Solo ─────────────────────────────────────
  const setTrackVolume = (label: string, volume: number) => {
    if (label === 'Vocal') {
      setVocal(prev => {
        if (prev.gainNode) prev.gainNode.gain.value = volume
        return { ...prev, volume }
      })
    } else {
      setInstrumental(prev => {
        if (prev.gainNode) prev.gainNode.gain.value = volume
        return { ...prev, volume }
      })
    }
  }

  const toggleMute = (label: string) => {
    if (label === 'Vocal') {
      setVocal(prev => {
        const muted = !prev.muted
        const isAudible = prev.soloed || (!muted && !anySoloed())
        if (prev.gainNode) prev.gainNode.gain.value = isAudible ? prev.volume : 0
        return { ...prev, muted }
      })
    } else {
      setInstrumental(prev => {
        const muted = !prev.muted
        const isAudible = prev.soloed || (!muted && !anySoloed())
        if (prev.gainNode) prev.gainNode.gain.value = isAudible ? prev.volume : 0
        return { ...prev, muted }
      })
    }
  }

  const toggleSolo = (label: string) => {
    if (label === 'Vocal') {
      setVocal(prev => {
        const soloed = !prev.soloed
        const newAnySoloed = soloed || instrumental().soloed
        setAnySoloed(newAnySoloed)

        if (prev.gainNode) prev.gainNode.gain.value = soloed ? prev.volume : (prev.muted || newAnySoloed ? 0 : prev.volume)
        const inst = instrumental()
        if (inst.gainNode) inst.gainNode.gain.value = (inst.soloed || (!inst.muted && !soloed)) ? inst.volume : 0
        return { ...prev, soloed }
      })
    } else {
      setInstrumental(prev => {
        const soloed = !prev.soloed
        const newAnySoloed = soloed || vocal().soloed
        setAnySoloed(newAnySoloed)

        if (prev.gainNode) prev.gainNode.gain.value = soloed ? prev.volume : (prev.muted || newAnySoloed ? 0 : prev.volume)
        const voc = vocal()
        if (voc.gainNode) voc.gainNode.gain.value = (voc.soloed || (!voc.muted && !soloed)) ? voc.volume : 0
        return { ...prev, soloed }
      })
    }
  }

  const handleDownload = async (track: StemTrack) => {
    if (!track.url) return
    try {
      const resp = await fetch(track.url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${track.label.toLowerCase()}_stem.wav`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  // ── Mic Toggle ──────────────────────────────────────────────
  const toggleMic = async () => {
    if (micActive()) {
      // Stop mic
      micStream?.getTracks().forEach(t => t.stop())
      micGainNode?.disconnect()
      micAnalyserNode?.disconnect()
      micStream = null
      micGainNode = null
      micAnalyserNode = null
      micPitchDetector = null
      micPitchHistory = []
      setMicActive(false)
      setMicEnabled(false)
      setMicPitch(null)
      setMicError('')
    } else {
      // Start mic
      try {
        if (!audioCtx) {
          await ensureAudioCtx()
          if (!audioCtx) throw new Error('Failed to create AudioContext')
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        })
        const source = audioCtx.createMediaStreamSource(stream)
        micGainNode = audioCtx.createGain()
        micGainNode.gain.value = 1.0
        micAnalyserNode = audioCtx.createAnalyser()
        micAnalyserNode.fftSize = PITCH_FFT_SIZE
        micAnalyserNode.smoothingTimeConstant = 0.3
        source.connect(micGainNode)
        micGainNode.connect(micAnalyserNode)

        micPitchDetector = new PitchDetector({
          sampleRate: audioCtx.sampleRate,
          bufferSize: PITCH_FFT_SIZE,
          minConfidence: 0.35,
          minAmplitude: 0.01,
        })

        micStream = stream
        micPitchHistory = []
        setComparisonData([])
        setScore(null)
        setShowScore(false)
        setMicActive(true)
        setMicEnabled(true)
        setMicPitch(null)
        setMicError('')
      } catch (err: any) {
        const msg = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
          ? 'Microphone access denied'
          : err?.message || 'Microphone unavailable'
        setMicError(msg)
        setMicEnabled(false)
      }
    }
  }

  // ── Scoring ─────────────────────────────────────────────────
  const computeScore = (): MicScore => {
    const data = comparisonData()
    if (data.length === 0) {
      return { totalNotes: 0, matchedNotes: 0, accuracyPct: 0, avgCentsOff: 0, grade: 'D' }
    }
    const total = data.length
    const matched = data.filter(d => d.inTolerance).length
    const sumCents = data.reduce((s, d) => s + Math.abs(d.centsOff), 0)
    const accuracy = (matched / total) * 100
    const grade = accuracy >= 95 ? 'S' : accuracy >= 85 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 50 ? 'C' : 'D'
    return {
      totalNotes: total,
      matchedNotes: matched,
      accuracyPct: Math.round(accuracy),
      avgCentsOff: Math.round(sumCents / total),
      grade,
    }
  }

  const resetScore = () => {
    setComparisonData([])
    setScore(null)
    setShowScore(false)
  }

  // ── RAF Loop ─────────────────────────────────────────────────
  const startRafLoop = () => {
    const tick = () => {
      if (!audioCtx || !playing()) return

      const now = audioCtx.currentTime
      const elapsedTime = now - startTime
      setElapsed(Math.min(elapsedTime, duration()))

      // Pitch detection from vocal analyser
      if (vocalAnalyser && vocal().buffer) {
        const timeData = new Float32Array(PITCH_FFT_SIZE)
        vocalAnalyser.getFloatTimeDomainData(timeData)
        const pitch = pitchDetector!.detect(timeData)
        setCurrentPitch(pitch.frequency > 0 ? pitch : null)

        if (pitch.frequency > 0) {
          pitchHistory.push({
            time: elapsedTime,
            noteName: pitch.noteName,
            frequency: pitch.frequency,
            octave: pitch.octave,
          })
        }
      }

      // Mic pitch detection
      if (micActive() && micAnalyserNode) {
        const micData = new Float32Array(PITCH_FFT_SIZE)
        micAnalyserNode.getFloatTimeDomainData(micData)
        const mp = micPitchDetector!.detect(micData)
        setMicPitch(mp.frequency > 0 ? mp : null)
        if (mp.frequency > 0) {
          micPitchHistory.push({
            time: elapsedTime,
            noteName: mp.noteName,
            frequency: mp.frequency,
            octave: mp.octave,
          })
        }
        // Collect comparison data for scoring
        const vocalPitch = currentPitch()
        if (mp.frequency > 0 && vocalPitch && vocalPitch.frequency > 0) {
          const centsOff = 1200 * Math.log2(mp.frequency / vocalPitch.frequency)
          const tol = toleranceCents()
          setComparisonData(prev => [...prev.slice(-12000), {
            time: elapsedTime,
            vocalNote: vocalPitch.noteName,
            micNote: mp.noteName,
            centsOff,
            inTolerance: Math.abs(centsOff) <= tol,
          }])
        }
      }

      // Continuous-scroll time window: keep playhead at 30% from left
      const newStart = elapsedTime - windowDuration() * 0.3
      setWindowStart(Math.max(0, newStart))

      syncCanvasSizes()
      drawWaveformOverview()
      drawPitchCanvas()
      drawLiveWaveform()
      updateCurrentLine()

      if (elapsedTime >= duration()) {
        handleStop()
        return
      }

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  // ── Canvas Sizing ───────────────────────────────────────────
  // Lock CSS pixel dimensions first, then set internal buffer from those
  // exact integers — ensures canvas.width = cssW * dpr with no rounding gap.
  const syncCanvasSizes = () => {
    const dpr = window.devicePixelRatio || 1
    for (const ref of [waveformCanvasRef, pitchCanvasRef, liveWaveCanvasRef]) {
      if (!ref) continue
      const rect = ref.getBoundingClientRect()
      const cssW = Math.round(rect.width)
      const cssH = Math.round(rect.height)
      const w = cssW * dpr
      const h = cssH * dpr
      if (ref.width !== w || ref.height !== h) {
        ref.style.width = `${cssW}px`
        ref.style.height = `${cssH}px`
        ref.width = w
        ref.height = h
      }
    }
  }

  // ── Canvas Drawing ───────────────────────────────────────────
  const drawWaveformOverview = () => {
    const canvas = waveformCanvasRef
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    if (h <= 0) { overviewRect = { w, h }; return }
    overviewRect = { w, h }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, w, h)

    const activeTracks = tracks().filter(t => t.buffer)
    if (activeTracks.length === 0) return

    const trackHeight = h / activeTracks.length
    const totalDur = duration() || 1
    const winStart = windowStart()
    const winEnd = winStart + windowDuration()

    for (let ti = 0; ti < activeTracks.length; ti++) {
      const track = activeTracks[ti]
      const buffer = track.buffer!
      const data = buffer.getChannelData(0)
      const totalSamples = data.length

      // Only iterate samples within the visible window
      const visibleStart = Math.floor((winStart / totalDur) * totalSamples)
      const visibleEnd = Math.min(totalSamples, Math.floor((winEnd / totalDur) * totalSamples))
      const visibleSamples = visibleEnd - visibleStart
      const step = Math.max(1, Math.floor(visibleSamples / w))
      const yOff = ti * trackHeight

      // Center line
      const midY = yOff + trackHeight / 2
      ctx.strokeStyle = track.color + '40'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, midY)
      ctx.lineTo(w, midY)
      ctx.stroke()

      // Waveform
      ctx.strokeStyle = track.color
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x < w; x++) {
        const start = visibleStart + Math.floor(x * step)
        let min = 1, max = -1
        const end = Math.min(Math.floor(start + step), visibleEnd)
        for (let s = start; s < end; s++) {
          const v = data[s]
          if (v < min) min = v
          if (v > max) max = v
        }
        const amp = trackHeight * 0.35
        ctx.moveTo(x, midY + min * amp)
        ctx.lineTo(x, midY + max * amp)
      }
      ctx.stroke()

      // Playhead
      if (elapsed() >= winStart && elapsed() <= winEnd) {
        const px = ((elapsed() - winStart) / windowDuration()) * w
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(px, yOff)
        ctx.lineTo(px, yOff + trackHeight)
        ctx.stroke()
      }

      // Label
      ctx.fillStyle = track.color
      ctx.font = '10px monospace'
      ctx.fillText(track.label, 6, yOff + 14)
    }
  }

  const drawLiveWaveform = () => {
    const canvas = liveWaveCanvasRef
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    if (h <= 0) { liveRect = { w, h }; return }
    liveRect = { w, h }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)

    const activeTracks = tracks().filter(t => t.analyserNode)
    if (activeTracks.length === 0) return

    const trackHeight = h / activeTracks.length

    for (let ti = 0; ti < activeTracks.length; ti++) {
      const track = activeTracks[ti]
      const analyser = track.analyserNode!
      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteTimeDomainData(data)
      const yOff = ti * trackHeight
      const midY = yOff + trackHeight / 2

      ctx.strokeStyle = track.color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < data.length; i++) {
        const x = (i / data.length) * w
        const y = midY + ((data[i] / 128) - 1) * (trackHeight * 0.4)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Track label
      ctx.fillStyle = track.color + '80'
      ctx.font = '9px monospace'
      ctx.fillText(track.label, 4, yOff + 12)
    }
  }

  const drawPitchCanvas = () => {
    const canvas = pitchCanvasRef
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    if (h <= 0) { pitchRect = { w, h }; return }
    pitchRect = { w, h }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)

    if (!vocal().buffer) {
      ctx.fillStyle = '#484f58'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('No vocal stem — pitch display unavailable', w / 2, h / 2)
      ctx.textAlign = 'start'
      return
    }

    // Grid lines for note rows (C through B)
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const rowH = h / 13
    ctx.strokeStyle = '#21262d'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 13; i++) {
      const y = i * rowH
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Note labels
    ctx.fillStyle = '#484f58'
    ctx.font = '9px monospace'
    for (let i = 0; i < 12; i++) {
      const note = notes[11 - i] // C at bottom, B at top
      ctx.fillText(note, 3, i * rowH + rowH * 0.65 + rowH)
    }

    // Pitch history — consolidated into Melodyne-style pills
    const winStart = windowStart()
    const winEnd = winStart + windowDuration()
    const winDur = windowDuration()

    type PillGroup = { noteIdx: number; startTime: number; endTime: number }
    const buildPillGroups = (history: PitchNote[]): PillGroup[] => {
      if (history.length === 0) return []
      const groups: PillGroup[] = []
      let cur: PillGroup = {
        noteIdx: notes.indexOf(history[0].noteName.replace(/\d/g, '')),
        startTime: history[0].time,
        endTime: history[0].time,
      }
      for (let i = 1; i < history.length; i++) {
        const pn = history[i]
        const noteIdx = notes.indexOf(pn.noteName.replace(/\d/g, ''))
        if (noteIdx === cur.noteIdx) {
          cur.endTime = pn.time
        } else {
          if (cur.noteIdx >= 0) groups.push({ ...cur })
          cur = { noteIdx, startTime: pn.time, endTime: pn.time }
        }
      }
      if (cur.noteIdx >= 0) groups.push({ ...cur })
      return groups
    }

    const drawPill = (x1: number, x2: number, y: number, pillH: number, r: number) => {
      const pillW = Math.max(x2 - x1, 3)
      ctx.beginPath()
      ctx.moveTo(x1 + r, y)
      ctx.lineTo(x1 + pillW - r, y)
      ctx.arcTo(x1 + pillW, y, x1 + pillW, y + r, r)
      ctx.lineTo(x1 + pillW, y + pillH - r)
      ctx.arcTo(x1 + pillW, y + pillH, x1 + pillW - r, y + pillH, r)
      ctx.lineTo(x1 + r, y + pillH)
      ctx.arcTo(x1, y + pillH, x1, y + pillH - r, r)
      ctx.lineTo(x1, y + r)
      ctx.arcTo(x1, y, x1 + r, y, r)
      ctx.closePath()
    }

    const vocalPills = buildPillGroups(pitchHistory)

    // Draw vocal pitch pills (filled amber)
    for (const g of vocalPills) {
      if (g.endTime < winStart || g.startTime > winEnd) continue
      const x1 = Math.max(0, ((g.startTime - winStart) / winDur) * w)
      const x2 = Math.min(w, ((g.endTime - winStart) / winDur) * w)
      const y = (11 - g.noteIdx) * rowH + rowH * 0.16
      const pillH = rowH * 0.68
      const r = Math.min(pillH / 2, 3)
      drawPill(x1, x2, y, pillH, r)
      ctx.fillStyle = 'rgba(245, 158, 11, 0.5)'
      ctx.fill()
    }

    // Mic pitch overlay — thin dashed stroke, no fill
    if (micActive() && micPitchHistory.length > 0) {
      const micPills = buildPillGroups(micPitchHistory)
      for (const g of micPills) {
        if (g.endTime < winStart || g.startTime > winEnd) continue
        const x1 = Math.max(0, ((g.startTime - winStart) / winDur) * w)
        const x2 = Math.min(w, ((g.endTime - winStart) / winDur) * w)
        const y = (11 - g.noteIdx) * rowH + rowH * 0.16
        const pillH = rowH * 0.68
        const r = Math.min(pillH / 2, 3)
        drawPill(x1, x2, y, pillH, r)
        ctx.strokeStyle = '#ff6b8a'
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 3])
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Diff bars — connect vocal and mic pitch at time-aligned points
    const TOLERANCE_CENTS = 50
    if (micActive() && pitchHistory.length > 0 && micPitchHistory.length > 0) {
      let vi = 0
      let mi = 0
      let lastDiffX = -999
      while (vi < pitchHistory.length && mi < micPitchHistory.length) {
        const vt = pitchHistory[vi].time
        const mt = micPitchHistory[mi].time

        if (Math.abs(vt - mt) < 0.06) {
          const vocalNoteIdx = notes.indexOf(pitchHistory[vi].noteName.replace(/\d/g, ''))
          const micNoteIdx = notes.indexOf(micPitchHistory[mi].noteName.replace(/\d/g, ''))
          if (vocalNoteIdx >= 0 && micNoteIdx >= 0 && vt >= winStart && vt <= winEnd) {
            const x = ((vt - winStart) / winDur) * w
            if (x - lastDiffX > 3) {
              lastDiffX = x
              const vocalY = (11 - vocalNoteIdx) * rowH + rowH * 0.5
              const micY = (11 - micNoteIdx) * rowH + rowH * 0.5
              const centsOff = 1200 * Math.log2(micPitchHistory[mi].frequency / pitchHistory[vi].frequency)
              const absOff = Math.abs(centsOff)

              ctx.strokeStyle = absOff <= TOLERANCE_CENTS
                ? 'rgba(96, 208, 128, 0.55)'
                : absOff <= TOLERANCE_CENTS * 2
                  ? 'rgba(224, 192, 80, 0.5)'
                  : 'rgba(248, 81, 73, 0.45)'
              ctx.lineWidth = 1.2
              ctx.beginPath()
              ctx.moveTo(x, Math.min(vocalY, micY))
              ctx.lineTo(x, Math.max(vocalY, micY))
              ctx.stroke()
            }
          }
          vi++; mi++
        } else if (vt < mt) {
          vi++
        } else {
          mi++
        }
      }
    }

    // Current pitch highlight
    const cp = currentPitch()
    if (cp && cp.frequency > 0) {
      const elapsedTime = elapsed()
      const noteIdx = notes.indexOf(cp.noteName.replace(/\d/g, ''))
      if (noteIdx >= 0 && elapsedTime >= winStart && elapsedTime <= winEnd) {
        const x = ((elapsedTime - winStart) / winDur) * w
        const y = (11 - noteIdx) * rowH + rowH * 0.5

        // Glow
        ctx.shadowColor = '#f59e0b'
        ctx.shadowBlur = 12
        ctx.fillStyle = '#f59e0b'
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        // Note label
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 11px monospace'
        ctx.fillText(`${cp.noteName}${cp.octave}`, Math.min(x + 10, w - 40), y + 4)
      }
    }

    // Playhead
    const elapsedTime = elapsed()
    if (elapsedTime >= winStart && elapsedTime <= winEnd) {
      const px = ((elapsedTime - winStart) / winDur) * w
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, h)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // ── Resize handling ──────────────────────────────────────────
  let resizeObserver: ResizeObserver | null = null

  onMount(() => {
    loadStems()
    loadLyrics()

    resizeObserver = new ResizeObserver(() => {
      syncCanvasSizes()
      drawWaveformOverview()
      drawLiveWaveform()
      drawPitchCanvas()
    })

    if (waveformCanvasRef) resizeObserver.observe(waveformCanvasRef)
    if (liveWaveCanvasRef) resizeObserver.observe(liveWaveCanvasRef)
    if (pitchCanvasRef) resizeObserver.observe(pitchCanvasRef)

    // Initial canvas draws after a frame
    requestAnimationFrame(() => {
      syncCanvasSizes()
      drawWaveformOverview()
      drawLiveWaveform()
      drawPitchCanvas()
    })

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Space') {
        e.preventDefault()
        if (loading() || loadError()) return
        playing() ? handlePause() : handlePlay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    ;(window as any).__smKeydown = handleKeyDown

    // Resize document-level listeners
    const handleResizeDocMove = (e: PointerEvent) => { handleResizeMove(e) }
    const handleResizeDocEnd = (e: PointerEvent) => { handleResizeEnd(e) }
    document.addEventListener('pointermove', handleResizeDocMove)
    document.addEventListener('pointerup', handleResizeDocEnd)
    ;(window as any).__smResizeMove = handleResizeDocMove
    ;(window as any).__smResizeEnd = handleResizeDocEnd
  })

  createEffect(() => {
    if (!loading()) {
      requestAnimationFrame(() => {
        syncCanvasSizes()
        drawWaveformOverview()
        drawLiveWaveform()
        drawPitchCanvas()
      })
    }
  })

  onCleanup(() => {
    disconnectSources()
    cancelAnimationFrame(rafId)
    resizeObserver?.disconnect()
    if ((window as any).__smKeydown) {
      window.removeEventListener('keydown', (window as any).__smKeydown)
      delete (window as any).__smKeydown
    }
    if ((window as any).__smResizeMove) {
      document.removeEventListener('pointermove', (window as any).__smResizeMove)
      delete (window as any).__smResizeMove
    }
    if ((window as any).__smResizeEnd) {
      document.removeEventListener('pointerup', (window as any).__smResizeEnd)
      delete (window as any).__smResizeEnd
    }
    if (audioCtx) {
      audioCtx.close().catch(() => { /* */ })
    }
  })

  // ── Helpers ──────────────────────────────────────────────────
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const getPanel = (id: string) => panels().find(p => p.id === id)!
  const panelStyle = (id: string) => {
    const p = getPanel(id)
    return {
      order: p.order,
      ...(p.height !== null ? { height: `${p.height}px` } : {}),
    }
  }

  // ── Drag-to-reorder ──────────────────────────────────────────
  const handlePanelDragStart = (panelId: string, panelOrder: number, e: PointerEvent) => {
    if (!(e.target instanceof HTMLElement)) return
    const header = e.target.closest('.sm-panel-header') as HTMLElement | null
    if (!header) return

    e.preventDefault()
    header.setPointerCapture(e.pointerId)

    dragPanelId = panelId
    dragStartOrder = panelOrder
    dragTargetOrder = panelOrder
    dragOffsetX = e.clientX
    dragOffsetY = e.clientY
  }

  const handlePanelDragMove = (e: PointerEvent) => {
    if (!dragPanelId) return
    e.preventDefault()

    // Find the panel under the pointer
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    if (!el) return
    const panel = el.closest('.sm-workspace-panel') as HTMLElement | null
    if (!panel) return

    const targetId = panel.dataset.panelId
    if (!targetId || targetId === dragPanelId) return

    const targetOrder = panels().find(p => p.id === targetId)?.order
    if (targetOrder !== undefined && targetOrder !== dragTargetOrder) {
      dragTargetOrder = targetOrder
    }
  }

  const handlePanelDragEnd = (e: PointerEvent) => {
    if (!dragPanelId) return
    e.preventDefault()

    if (dragTargetOrder !== dragStartOrder) {
      reorderPanels(dragPanelId, dragTargetOrder)
      // Redraw canvases after grid reflow settles
      requestAnimationFrame(() => {
        syncCanvasSizes()
        drawWaveformOverview()
        drawLiveWaveform()
        drawPitchCanvas()
      })
    }

    dragPanelId = null
    dragStartOrder = -1
    dragTargetOrder = -1
  }

  // Redraw canvases after layout change (column toggle, etc.)
  const queueCanvasRedraw = () => {
    requestAnimationFrame(() => {
      syncCanvasSizes()
      drawWaveformOverview()
      drawLiveWaveform()
      drawPitchCanvas()
    })
  }

  // ── Resize handlers ──────────────────────────────────────────
  const handleResizeStart = (panelId: string, e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const panel = panels().find(p => p.id === panelId)
    if (!panel) return

    const panelEl = document.querySelector(`[data-panel-id="${panelId}"]`) as HTMLElement | null
    resizePanelId = panelId
    resizeStartY = e.clientY
    resizeStartHeight = panel.height ?? (panelEl?.getBoundingClientRect().height ?? 200)

    // Prevent canvas from capturing pointer during resize
    const canvas = panelEl?.querySelector('canvas') as HTMLElement | null
    if (canvas) canvas.style.pointerEvents = 'none'

    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleResizeMove = (e: PointerEvent) => {
    if (!resizePanelId || !workspaceRef) return
    e.preventDefault()
    const delta = e.clientY - resizeStartY
    const maxH = workspaceRef.clientHeight - 60
    const newHeight = Math.max(40, Math.min(maxH, resizeStartHeight + delta))
    setPanels(prev => prev.map(p =>
      p.id === resizePanelId ? { ...p, height: newHeight } : p
    ))
    syncCanvasSizes()
    drawWaveformOverview()
    drawLiveWaveform()
    drawPitchCanvas()
  }

  const handleResizeEnd = (_e: PointerEvent) => {
    if (!resizePanelId) return
    const panelEl = document.querySelector(`[data-panel-id="${resizePanelId}"]`)
    const canvas = panelEl?.querySelector('canvas') as HTMLElement | null
    if (canvas) canvas.style.pointerEvents = ''
    resizePanelId = null
    syncCanvasSizes()
    drawWaveformOverview()
    drawLiveWaveform()
    drawPitchCanvas()
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div class="stem-mixer">
      {/* Header */}
      <div class="sm-header">
        <div class="sm-header-left">
          <Show when={props.onBack}>
            <button class="sm-back-btn" onClick={props.onBack} title="Back">
              <ChevronLeft />
            </button>
          </Show>
          <h2>Stem Mixer</h2>
          <span class="sm-session-id">{props.sessionId.slice(0, 8)}</span>
        </div>
      </div>

        {/* Loading / Error */}
        <Show when={loading()}>
          <div class="sm-loading">
            <div class="sm-loading-spinner" />
            <span>Loading stems... {loadProgress()}%</span>
          </div>
        </Show>

        <Show when={loadError()}>
          <div class="sm-error">
            <span>{loadError()}</span>
            <button class="sm-error-retry" onClick={loadStems}>Retry</button>
          </div>
        </Show>

        <Show when={!loading() && !loadError()}>
          {/* Transport Bar — top */}
          <div class="sm-transport">
            <div class="sm-transport-controls">
              <button class="sm-transport-btn" onClick={handleStop} title="Stop">
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
              </button>
              <button class="sm-transport-btn" onClick={handleRestart} title="Restart (play from beginning)">
                <SkipBack />
              </button>
              <button
                class="sm-transport-btn sm-transport-play"
                onClick={playing() ? handlePause : handlePlay}
              >
                {playing() ? <Pause /> : <Play />}
              </button>

              <div class="sm-col-toggle">
                <button
                  class={`sm-col-btn${workspaceColumns() === 1 ? ' sm-col-active' : ''}`}
                  onClick={() => { setWorkspaceColumns(1); queueCanvasRedraw() }}
                  title="Single column"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12"><rect x="4" y="4" width="16" height="16" rx="1" fill="currentColor"/></svg>
                </button>
                <button
                  class={`sm-col-btn${workspaceColumns() === 2 ? ' sm-col-active' : ''}`}
                  onClick={() => { setWorkspaceColumns(2); queueCanvasRedraw() }}
                  title="Two columns"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12"><rect x="3" y="4" width="8" height="16" rx="1" fill="currentColor"/><rect x="13" y="4" width="8" height="16" rx="1" fill="currentColor"/></svg>
                </button>
              </div>

              <button
                class={`sm-mic-toggle-btn${micActive() ? ' sm-mic-toggle-btn--active' : ''}${micError() ? ' sm-mic-toggle-btn--error' : ''}`}
                onClick={toggleMic}
                title={micError() ? micError() : micActive() ? 'Disable microphone' : 'Enable microphone pitch comparison'}
                disabled={!!micError()}
              >
                <Mic />
              </button>

              <div class="sm-zoom-control">
                <button class="sm-zoom-btn" onClick={() => setWindowDuration(prev => Math.max(10, prev - 5))} title="Zoom in (shorter window)">−</button>
                <span class="sm-zoom-value">{windowDuration()}s</span>
                <button class="sm-zoom-btn" onClick={() => setWindowDuration(prev => Math.min(150, prev + 5))} title="Zoom out (longer window)">+</button>
              </div>
            </div>

            <div class="sm-progress-area">
              <span class="sm-time">{formatTime(elapsed())}</span>
              <div
                ref={progressBarRef}
                class="sm-progress-bar"
                onClick={handleSeek}
              >
                <div
                  class="sm-progress-fill"
                  style={{
                    width: `${duration() > 0 ? (elapsed() / duration()) * 100 : 0}%`,
                  }}
                />
              </div>
              <span class="sm-time">{formatTime(duration())}</span>
            </div>

          </div>

          {/* Score card — shown when playback stops and mic was active */}
          <Show when={showScore() && score()}>
            <div class="sm-mic-score-card">
              <div class="sm-mic-score-card-inner">
                <button
                  class="sm-mic-score-close"
                  onClick={() => setShowScore(false)}
                  aria-label="Close score"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                <div class="sm-mic-score-grade-row">
                  <span class={`sm-mic-grade sm-mic-grade--${score()!.grade.toLowerCase()}`}>{score()!.grade}</span>
                  <div class="sm-mic-score-stats">
                    <span class="sm-mic-score-accuracy">{score()!.accuracyPct}% accuracy</span>
                    <span class="sm-mic-score-detail">
                      {score()!.matchedNotes}/{score()!.totalNotes} notes in tolerance
                    </span>
                    <span class="sm-mic-score-detail">
                      ±{score()!.avgCentsOff}¢ avg deviation
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Show>

          <div
            ref={workspaceRef}
            class="sm-workspace"
            style={{ 'grid-template-columns': workspaceColumns() === 1 ? '1fr' : '1fr 1fr' }}
            onWheel={(e) => { e.preventDefault(); setWindowDuration(prev => Math.min(150, Math.max(10, prev + (e.deltaY > 0 ? 5 : -5)))) }}
          >
            {/* Panel: Waveform Overview */}
            <div
              class="sm-workspace-panel"
              style={panelStyle('overview')}
              data-panel-id="overview"
            >
              <div
                class="sm-panel-header"
                onPointerDown={(e) => handlePanelDragStart('overview', getPanel('overview').order, e)}
                onPointerMove={handlePanelDragMove}
                onPointerUp={handlePanelDragEnd}
                onPointerCancel={handlePanelDragEnd}
              >
                <svg viewBox="0 0 24 24" width="10" height="10" class="sm-drag-icon"><path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/></svg>
                Waveform Overview
              </div>
              <canvas ref={waveformCanvasRef} class="sm-canvas sm-canvas-overview" onClick={handleWaveformClick} />
              <div
                class="sm-resize-handle"
                onPointerDown={(e) => handleResizeStart('overview', e)}
              />
            </div>

            {/* Panel: Live Waveform */}
            <div
              class="sm-workspace-panel"
              style={panelStyle('live')}
              data-panel-id="live"
            >
              <div
                class="sm-panel-header"
                onPointerDown={(e) => handlePanelDragStart('live', getPanel('live').order, e)}
                onPointerMove={handlePanelDragMove}
                onPointerUp={handlePanelDragEnd}
                onPointerCancel={handlePanelDragEnd}
              >
                <svg viewBox="0 0 24 24" width="10" height="10" class="sm-drag-icon"><path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/></svg>
                Live Waveform
              </div>
              <canvas ref={liveWaveCanvasRef} class="sm-canvas sm-canvas-live" />
              <div
                class="sm-resize-handle"
                onPointerDown={(e) => handleResizeStart('live', e)}
              />
            </div>

            {/* Panel: Vocal Pitch */}
            <div
              class="sm-workspace-panel"
              style={panelStyle('pitch')}
              data-panel-id="pitch"
            >
              <div
                class="sm-panel-header"
                onPointerDown={(e) => handlePanelDragStart('pitch', getPanel('pitch').order, e)}
                onPointerMove={handlePanelDragMove}
                onPointerUp={handlePanelDragEnd}
                onPointerCancel={handlePanelDragEnd}
              >
                <svg viewBox="0 0 24 24" width="10" height="10" class="sm-drag-icon"><path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/></svg>
                Vocal Pitch
              </div>
              <canvas ref={pitchCanvasRef} class="sm-canvas sm-canvas-pitch" />
              <div
                class="sm-resize-handle"
                onPointerDown={(e) => handleResizeStart('pitch', e)}
              />
            </div>

            {/* Panel: Stem Controls */}
            <div
              class="sm-workspace-panel"
              style={panelStyle('controls')}
              data-panel-id="controls"
            >
              <div
                class="sm-panel-header"
                onPointerDown={(e) => handlePanelDragStart('controls', getPanel('controls').order, e)}
                onPointerMove={handlePanelDragMove}
                onPointerUp={handlePanelDragEnd}
                onPointerCancel={handlePanelDragEnd}
              >
                <svg viewBox="0 0 24 24" width="10" height="10" class="sm-drag-icon"><path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/></svg>
                Stem Controls
              </div>
              <div class="sm-strips-row">
                {vocal().url && (
                  <div class="sm-stem-strip">
                    <div class="sm-stem-header">
                      <span
                        class="sm-stem-dot"
                        style={{ background: vocal().color }}
                      />
                      <span class="sm-stem-label">{vocal().label}</span>
                      <span class="sm-stem-vol-pct">
                        {Math.round((vocal().muted || (anySoloed() && !vocal().soloed)) ? 0 : vocal().volume * 100)}%
                      </span>
                    </div>
                    <div class="sm-stem-actions">
                      <button
                        class={`sm-action-btn ${vocal().soloed ? 'sm-active' : ''}`}
                        onClick={() => toggleSolo('Vocal')}
                        title="Solo"
                        style={{ color: vocal().soloed ? vocal().color : '' }}
                      >
                        <Ear />
                      </button>
                      <button
                        class={`sm-action-btn ${vocal().muted ? 'sm-muted' : ''}`}
                        onClick={() => toggleMute('Vocal')}
                        title="Mute"
                      >
                        {vocal().muted ? <VolumeX /> : <Volume2 />}
                      </button>
                      <button
                        class="sm-action-btn"
                        onClick={() => handleDownload(vocal())}
                        title="Download"
                      >
                        <Download />
                      </button>
                    </div>
                    <input
                      type="range"
                      class="sm-volume-slider"
                      min="0"
                      max="100"
                      value={Math.round(vocal().volume * 100)}
                      onInput={(e) =>
                        setTrackVolume('Vocal', parseInt(e.currentTarget.value) / 100)
                      }
                    />
                  </div>
                )}

                {props.stems.vocalMidi && (
                  <div class="sm-midi-substem">
                    <span class="sm-midi-icon"><Midi /></span>
                    <span class="sm-midi-label">MIDI</span>
                    <button
                      class="sm-midi-dl-btn"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = props.stems.vocalMidi!;
                        a.download = "vocal_midi.mid";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                      title="Download MIDI"
                    >
                      <Download />
                    </button>
                  </div>
                )}

                {instrumental().url && (
                  <div class="sm-stem-strip">
                    <div class="sm-stem-header">
                      <span
                        class="sm-stem-dot"
                        style={{ background: instrumental().color }}
                      />
                      <span class="sm-stem-label">{instrumental().label}</span>
                      <span class="sm-stem-vol-pct">
                        {Math.round((instrumental().muted || (anySoloed() && !instrumental().soloed)) ? 0 : instrumental().volume * 100)}%
                      </span>
                    </div>
                    <div class="sm-stem-actions">
                      <button
                        class={`sm-action-btn ${instrumental().soloed ? 'sm-active' : ''}`}
                        onClick={() => toggleSolo('Instrumental')}
                        title="Solo"
                        style={{ color: instrumental().soloed ? instrumental().color : '' }}
                      >
                        <Ear />
                      </button>
                      <button
                        class={`sm-action-btn ${instrumental().muted ? 'sm-muted' : ''}`}
                        onClick={() => toggleMute('Instrumental')}
                        title="Mute"
                      >
                        {instrumental().muted ? <VolumeX /> : <Volume2 />}
                      </button>
                      <button
                        class="sm-action-btn"
                        onClick={() => handleDownload(instrumental())}
                        title="Download"
                      >
                        <Download />
                      </button>
                    </div>
                    <input
                      type="range"
                      class="sm-volume-slider"
                      min="0"
                      max="100"
                      value={Math.round(instrumental().volume * 100)}
                      onInput={(e) =>
                        setTrackVolume('Instrumental', parseInt(e.currentTarget.value) / 100)
                      }
                    />
                  </div>
                )}
              </div>
              <div
                class="sm-resize-handle"
                onPointerDown={(e) => handleResizeStart('controls', e)}
              />
            </div>

            {/* Panel: Lyrics */}
            <div
              class="sm-workspace-panel"
              style={panelStyle('lyrics')}
              data-panel-id="lyrics"
            >
              <div
                class="sm-panel-header"
                onPointerDown={(e) => handlePanelDragStart('lyrics', getPanel('lyrics').order, e)}
                onPointerMove={handlePanelDragMove}
                onPointerUp={handlePanelDragEnd}
                onPointerCancel={handlePanelDragEnd}
              >
                <svg viewBox="0 0 24 24" width="10" height="10" class="sm-drag-icon"><path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/></svg>
                Lyrics
                <Show when={lyricsSource() === 'api'}>
                  <span class="sm-lyrics-source">found</span>
                </Show>
                <Show when={lyricsSource() === 'upload'}>
                  <span class="sm-lyrics-source sm-lyrics-source-upload">uploaded</span>
                </Show>
                <Show when={lyricsSource() === 'upload' && !editMode() || lyricsSource() === 'api' && !editMode()}>
                  <button
                    class="sm-lyrics-edit-btn"
                    onClick={(e) => { e.stopPropagation(); toggleEditMode() }}
                    title="Edit word timings"
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11"><path fill="currentColor" d="M16.474 5.408l2.118 2.117-10.8 10.8-2.544.426.426-2.544 10.8-10.8zM13.296 2.38l1.414 1.414-1.908 1.908-1.414-1.414L13.296 2.38zM3.5 20.5h3l9.9-9.9-3-3L3.5 17.5v3z"/></svg>
                  </button>
                </Show>
                <Show when={lyricsSource() !== 'none' && !editMode() && !lrcGenMode()}>
                  <button
                    class="sm-lyrics-gen-btn"
                    onClick={(e) => { e.stopPropagation(); startLrcGen() }}
                    title="Generate LRC timings with playback"
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                  </button>
                </Show>
                <Show when={lrcGenMode()}>
                  <span class="sm-lyrics-gen-label">LRC Gen</span>
                </Show>
                <Show when={lyricsSource() !== 'none' && !editMode() && !lrcGenMode()}>
                  <button
                    class={`sm-lyrics-markmode-btn${blockMarkMode() ? ' sm-lyrics-markmode-btn--active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setBlockMarkMode(prev => !prev); setMarkStartLine(null); setMarkEndLine(null) }}
                    title={blockMarkMode() ? 'Exit mark mode' : 'Mark repeat blocks'}
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11"><path fill="currentColor" d="M3 3h18v4H3V3zm0 7h12v4H3v-4zm0 7h18v4H3v-4z"/></svg>
                  </button>
                </Show>
                <Show when={lyricsSource() !== 'none' && !editMode()}>
                  <button
                    class="sm-lyrics-download-btn"
                    onClick={(e) => { e.stopPropagation(); handleDownloadLrc() }}
                    title="Download LRC file"
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                  </button>
                </Show>
                <Show when={lyricsSource() === 'upload' && !editMode()}>
                  <button
                    class="sm-lyrics-change-btn"
                    onClick={(e) => { e.stopPropagation(); lyricsFileInputRef?.click() }}
                    title="Change lyrics file"
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                  </button>
                </Show>
                <input
                  type="file"
                  accept=".txt,.lrc"
                  ref={lyricsFileInputRef}
                  hidden
                  onChange={handleLyricsChange}
                />
                <div class="sm-lyrics-toolbar">
                  <div class="sm-lyrics-zoom">
                    <button
                      class="sm-lyrics-zoom-btn"
                      onClick={() => setLyricsFontSize(prev => Math.max(0.45, +(prev - 0.1).toFixed(2)))}
                      title="Smaller text"
                    >A−</button>
                    <button
                      class="sm-lyrics-zoom-btn"
                      onClick={() => setLyricsFontSize(prev => Math.min(1.5, +(prev + 0.1).toFixed(2)))}
                      title="Larger text"
                    >A+</button>
                  </div>
                  <Show when={hasMultipleSections()}>
                    <div class="sm-lyrics-col-toggle">
                      <button
                        class={`sm-lyrics-col-btn${lyricsColumns() === 1 ? ' sm-lyrics-col-active' : ''}`}
                        onClick={() => setLyricsColumns(1)}
                        title="Single column"
                      >
                        <svg viewBox="0 0 24 24" width="10" height="10"><rect x="4" y="4" width="16" height="16" rx="1" fill="currentColor"/></svg>
                      </button>
                      <button
                        class={`sm-lyrics-col-btn${lyricsColumns() === 2 ? ' sm-lyrics-col-active' : ''}`}
                        onClick={() => setLyricsColumns(2)}
                        title="Two columns"
                      >
                        <svg viewBox="0 0 24 24" width="10" height="10"><rect x="3" y="4" width="8" height="16" rx="1" fill="currentColor"/><rect x="13" y="4" width="8" height="16" rx="1" fill="currentColor"/></svg>
                      </button>
                    </div>
                  </Show>
                </div>
              </div>
              <Show when={lyricsLoading()}>
                <div class="sm-lyrics-loading">Searching...</div>
              </Show>
              <Show when={!lyricsLoading() && lyricsSource() !== 'none'}>
                {/* ── LRC Generator toolbar ─────────────────────── */}
                <Show when={lrcGenMode()}>
                  <div class="sm-lyrics-gen-toolbar">
                    <Show when={!playing()}>
                      <button class="sm-lyrics-gen-play-btn" onClick={handlePlay} title="Play">
                        <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                      </button>
                    </Show>
                    <Show when={playing()}>
                      <button class="sm-lyrics-gen-pause-btn" onClick={handlePause} title="Pause">
                        <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      </button>
                    </Show>
                    <span class="sm-lyrics-gen-progress">
                      {Math.min(lrcGenLineIdx(), getGenLines().length)}/{getGenLines().length}
                      {(() => {
                        const lines = getGenLines()
                        const idx = lrcGenLineIdx()
                        if (idx < lines.length) {
                          const wc = lines[idx].split(/\s+/).filter(w => w.length > 0).length
                          return <> w{Math.min(lrcGenWordIdx(), wc)}/{wc}</>
                        }
                        return null
                      })()}
                    </span>
                    {(() => {
                      const idx = lrcGenLineIdx()
                      const lines = getGenLines()
                      if (idx < lines.length) {
                        const bi = getBlockForLine(idx)
                        if (bi) {
                          const block = getBlockById(bi.blockId)
                          const total = blockInstances()[bi.blockId]?.length ?? 1
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
                    <button class="sm-lyrics-gen-nextword-btn" onClick={handleNextWord} title="Mark next word time [W]">
                      Next Word
                    </button>
                    <button class="sm-lyrics-gen-nextline-btn" onClick={handleNextLine} title="Mark next line time [L]">
                      Next Line
                    </button>
                    <button class="sm-lyrics-gen-finish-btn" onClick={handleLrcGenFinish} title="Save LRC">Finish</button>
                    <button class="sm-lyrics-gen-reset-btn" onClick={handleLrcGenReset} title="Reset all timings">Reset</button>
                  </div>
                </Show>

                {/* ── LRC Generator view ────────────────────────── */}
                <Show when={lrcGenMode()}>
                  <div class="sm-lyrics-lines sm-lyrics-gen-lines"
                    style={{ 'font-size': `${lyricsFontSize()}rem` }}
                    onWheel={(e) => {
                      e.stopPropagation()
                      if (e.ctrlKey || e.metaKey) {
                        e.preventDefault()
                        setLyricsFontSize(prev =>
                          Math.min(1.5, Math.max(0.45, +(prev - e.deltaY * 0.001).toFixed(2)))
                        )
                      }
                    }}
                  >
                    {(() => {
                      const items = genViewData()
                      const result: any[] = []
                      let skipUntil = -1
                      for (let i = 0; i < items.length; i++) {
                        if (i < skipUntil) continue
                        const item = items[i]

                        // If this is a placeholder line, show a collapsed placeholder row
                        if (item.isPlaceholder) {
                          if (item.isPlaceholderStart) {
                            const bi = item.blockInfo!
                            const block = getBlockById(bi.blockId)
                            const total = blockInstances()[bi.blockId]?.length ?? 1
                            const instance = blockInstances()[bi.blockId]?.[bi.instanceIdx]
                            skipUntil = instance?.[1] ?? i + 1
                            result.push(
                              <div
                                class="sm-lyrics-gen-line sm-lyrics-gen-line-placeholder"
                                style={{ '--block-color': getBlockColor(bi.blockId) }}
                              >
                                <span class="sm-lyrics-gen-line-time">
                                  {item.lineTime !== undefined ? formatTimeMs(item.lineTime) : '--:--'}
                                </span>
                                <span class="sm-lyrics-gen-placeholder-text">
                                  {block?.label || 'Block'} (repeat {bi.instanceIdx + 1}/{total}) — timings copied from template
                                </span>
                              </div>,
                            )
                          }
                          continue
                        }

                        result.push(
                          <div
                            class={`sm-lyrics-gen-line${item.isCurrent ? ' sm-lyrics-gen-line-current' : ''}${item.isDone ? ' sm-lyrics-gen-line-done' : ''}${item.isFuture ? ' sm-lyrics-gen-line-future' : ''}${item.blockInfo?.isTemplate ? ' sm-lyrics-gen-line-template' : ''}`}
                            style={item.blockInfo?.isTemplate ? { '--block-color': getBlockColor(item.blockInfo.blockId) } : {}}
                          >
                            <span class="sm-lyrics-gen-line-time">
                              {item.lineTime !== undefined ? formatTimeMs(item.lineTime) : '--:--'}
                            </span>
                            <span class="sm-lyrics-gen-line-text">
                              {item.words.length === 0
                                ? item.line
                                : item.words.map((word, wi) => (
                                    <span
                                      class={`sm-lyrics-gen-word${
                                        item.activeWordIdx === wi ? ' sm-lyrics-gen-word-current' : ''
                                      }${
                                        item.activeWordIdx >= 0 && wi < item.activeWordIdx ? ' sm-lyrics-gen-word-done' : ''
                                      }`}
                                    >
                                      <span class="sm-lyrics-gen-word-time">
                                        {item.wordTimes?.[wi] !== undefined ? formatTimeMs(item.wordTimes[wi]) : ''}
                                      </span>
                                      <span class="sm-lyrics-gen-word-text">{word}</span>
                                    </span>
                                  ))
                              }
                            </span>
                          </div>,
                        )
                      }
                      return result
                    })()}
                  </div>
                </Show>

                {/* ── Edit mode toolbar ────────────────────────── */}
                <Show when={editMode()}>
                  <div class="sm-lyrics-edit-toolbar">
                    <button class="sm-lyrics-save-btn" onClick={handleSaveEdits}>Save</button>
                    <button
                      class="sm-lyrics-cancel-btn"
                      onClick={() => { setEditBuffer({}); setEditMode(false) }}
                    >Cancel</button>
                  </div>
                </Show>

                {/* ── Edit mode view ───────────────────────────── */}
                <Show when={editMode()}>
                  <div class="sm-lyrics-lines sm-lyrics-lines-edit"
                    style={{ 'font-size': `${lyricsFontSize()}rem` }}
                    onWheel={(e) => {
                      e.stopPropagation()
                      if (e.ctrlKey || e.metaKey) {
                        e.preventDefault()
                        setLyricsFontSize(prev =>
                          Math.min(1.5, Math.max(0.45, +(prev - e.deltaY * 0.001).toFixed(2)))
                        )
                      }
                    }}
                  >
                    <For each={lyricsRenderData()}>
                      {(rl) => {
                        const idx = parseInt(rl.key.split('-')[1])
                        return (
                          <div class="sm-lyrics-line-edit">
                            <input
                              class="sm-lyrics-time-input"
                              type="text"
                              value={formatTimeMs(getEditLineTime(idx))}
                              onChange={(e) => handleLineTimeEdit(idx, e.currentTarget.value)}
                            />
                            <For each={rl.words}>
                              {(word, wi) => (
                                <span class="sm-lyrics-word-edit">
                                  <span class="sm-lyrics-word-text">{word}</span>
                                  <span
                                    class="sm-lyrics-word-time-label"
                                    onClick={(e) => openWordPopover(idx, wi(), word, e)}
                                  >{formatTimeMs(getEditWordTime(idx, wi()))}</span>
                                </span>
                              )}
                            </For>
                          </div>
                        )
                      }}
                    </For>
                  </div>

                  {/* ── Word time edit popover ──────────────── */}
                  <Show when={editPopover() !== null}>
                    <div class="sm-lyrics-popover-backdrop" onClick={closeWordPopover}>
                      <div class="sm-lyrics-popover-card" onClick={(e) => e.stopPropagation()}>
                        <div class="sm-lyrics-popover-word">{editPopover()!.word}</div>
                        <input
                          class="sm-lyrics-popover-input"
                          type="text"
                          value={editPopover() ? formatTimeMs(getEditWordTime(editPopover()!.lineIdx, editPopover()!.wordIdx)) : ''}
                          onChange={(e) => commitPopoverValue(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') closeWordPopover()
                            if (e.key === 'Enter') commitPopoverValue(e.currentTarget.value)
                          }}
                          ref={(el) => {
                            setTimeout(() => (el as HTMLInputElement)?.select(), 10)
                          }}
                        />
                        <div class="sm-lyrics-popover-hint">Enter time (MM:SS) – press Enter or click outside to save</div>
                      </div>
                    </div>
                  </Show>
                </Show>

                {/* ── Normal view ──────────────────────────────── */}
                <Show when={!editMode() && !lrcGenMode()}>
                  {/* ── Mark mode toolbar ─────────────────────── */}
                  <Show when={blockMarkMode()}>
                    <div class="sm-lyrics-mark-toolbar">
                      <span class="sm-lyrics-mark-status">
                        {markStartLine() === null
                          ? 'Select a range of lines'
                          : markEndLine() === null
                            ? `Line ${markStartLine()! + 1} — click end line`
                            : `${markEndLine()! - markStartLine()!} line${markEndLine()! - markStartLine()! !== 1 ? 's' : ''} selected`
                        }
                      </span>
                      <Show when={markStartLine() !== null && markEndLine() !== null}>
                        <div class="sm-lyrics-mark-actions">
                          <input
                            type="text"
                            class="sm-lyrics-block-form-label"
                            placeholder="Chorus, Verse 1..."
                            id="block-label-input"
                          />
                          <input
                            type="number"
                            class="sm-lyrics-block-form-repeat"
                            value="1"
                            min="1"
                            max="20"
                            id="block-repeat-input"
                            title="Repeat count"
                          />
                          <button
                            class="sm-lyrics-block-form-btn"
                            onClick={() => {
                              const label = (document.getElementById('block-label-input') as HTMLInputElement)?.value?.trim() || 'Block'
                              const repeat = parseInt((document.getElementById('block-repeat-input') as HTMLInputElement)?.value || '1', 10)
                              handleMarkBlock(label, repeat)
                            }}
                          >Mark as New Block</button>
                          <Show when={blocks().length > 0}>
                            <select
                              class="sm-lyrics-mark-add-select"
                              onChange={(e) => {
                                const val = e.currentTarget.value
                                if (val) handleAddInstance(val, markStartLine()!, markEndLine()!)
                              }}
                            >
                              <option value="">Add to existing block...</option>
                              {blocks().map(b => <option value={b.id}>{b.label}</option>)}
                            </select>
                          </Show>
                        </div>
                      </Show>
                      <button
                        class="sm-lyrics-mark-toolbar-cancel"
                        onClick={() => { setMarkStartLine(null); setMarkEndLine(null); setBlockMarkMode(false) }}
                      >Cancel</button>
                    </div>
                  </Show>

                  {/* ── Block edit popover ─────────────────────── */}
                  <Show when={blockEditTarget() !== null}>
                    <div class="sm-lyrics-block-edit-popover">
                      {(() => {
                        const b = getBlockById(blockEditTarget()!)
                        if (!b) return null
                        return (
                          <>
                            <input
                              type="text"
                              class="sm-lyrics-block-form-label"
                              value={b.label}
                              id="block-edit-label-input"
                            />
                            <input
                              type="number"
                              class="sm-lyrics-block-form-repeat"
                              value={b.repeatCount}
                              min="1"
                              max="20"
                              id="block-edit-repeat-input"
                              title="Repeat count"
                            />
                            <button
                              class="sm-lyrics-block-form-btn"
                              onClick={() => {
                                const label = (document.getElementById('block-edit-label-input') as HTMLInputElement)?.value?.trim() || b.label
                                const repeat = parseInt((document.getElementById('block-edit-repeat-input') as HTMLInputElement)?.value || '1', 10)
                                handleEditBlock(b.id, label, repeat)
                              }}
                            >Save</button>
                            <button
                              class="sm-lyrics-block-form-cancel"
                              onClick={() => setBlockEditTarget(null)}
                            >Cancel</button>
                            <button
                              class="sm-lyrics-block-delete-btn"
                              onClick={() => handleDeleteBlock(b.id)}
                              title="Delete block"
                            >
                              <svg viewBox="0 0 24 24" width="10" height="10"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                            </button>
                          </>
                        )
                      })()}
                    </div>
                  </Show>

                  <div
                    class="sm-lyrics-lines"
                    classList={{ 'sm-lyrics-columns-2': lyricsColumns() === 2, 'sm-lyrics-lines--marking': blockMarkMode() }}
                    style={{ 'font-size': `${lyricsFontSize()}rem` }}
                    onWheel={(e) => {
                      e.stopPropagation()
                      if (e.ctrlKey || e.metaKey) {
                        e.preventDefault()
                        setLyricsFontSize(prev =>
                          Math.min(1.5, Math.max(0.45, +(prev - e.deltaY * 0.001).toFixed(2)))
                        )
                      }
                    }}
                  >
                    {/* ── Block instance badge + line group rendering ── */}
                    {(() => {
                      const rl = lyricsRenderData()
                      const rlByLyricIdx = new Map<number, LyricRenderLine>()
                      for (const item of rl) {
                        rlByLyricIdx.set(parseInt(item.key.split('-')[1]), item)
                      }

                      // Map line index → block info for badge placement
                      const blockStarts = new Map<number, { blockId: string; label: string; instanceIdx: number; isTemplate: boolean; repeatCount: number; color: string; startLine: number; endLine: number }>()
                      for (const [blockId, instances] of Object.entries(blockInstances())) {
                        const block = getBlockById(blockId)
                        if (!block) continue
                        const color = getBlockColor(blockId)
                        for (let i = 0; i < instances.length; i++) {
                          const [s, e] = instances[i]
                          blockStarts.set(s, { blockId, label: block.label, instanceIdx: i, isTemplate: i === 0, repeatCount: block.repeatCount, color, startLine: s, endLine: e })
                        }
                      }

                      return displayLines().map((dl) => {
                        if (dl.isBlank) {
                          return (
                            <div
                              class="sm-lyrics-line-spacer"
                              style={{ height: `${lyricsFontSize() * 0.5}rem` }}
                            />
                          )
                        }

                        const idx = dl.lyricsIndex
                        const rlItem = rlByLyricIdx.get(idx)
                        if (!rlItem) return null

                        const blockInfo = blockStarts.get(idx)
                        const blockForLine = getBlockForLine(idx)
                        const blockColor = blockForLine ? getBlockColor(blockForLine.blockId) : undefined
                        const block = blockForLine ? getBlockById(blockForLine.blockId) : undefined
                        const isMarkSelected = blockMarkMode() && markStartLine() !== null && markEndLine() !== null &&
                          idx >= markStartLine()! && idx < markEndLine()!

                        return (
                          <>
                            {/* Badge at start of block instance */}
                            {blockInfo && (
                              <div
                                class={`sm-lyrics-block-badge ${blockInfo.isTemplate ? 'sm-lyrics-block-badge--template' : 'sm-lyrics-block-badge--instance'}`}
                                style={{ '--block-color': blockInfo.color, 'margin-top': '0.4rem' }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (!blockMarkMode()) {
                                    setBlockEditTarget(blockInfo.blockId)
                                  }
                                }}
                              >
                                {blockInfo.label}
                                {blockInfo.isTemplate && blockInfo.repeatCount > 1 && (
                                  <span class="sm-lyrics-block-repeat">x{blockInfo.repeatCount}</span>
                                )}
                                {!blockInfo.isTemplate && (
                                  <span
                                    class="sm-lyrics-block-unlink"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleUnlinkInstance(blockInfo.blockId, blockInfo.instanceIdx)
                                    }}
                                    title="Unlink this instance"
                                  >x</span>
                                )}
                              </div>
                            )}
                            <span
                              class={`sm-lyrics-line${rlItem.isActive ? ' sm-lyrics-line-active' : ''}${blockForLine ? ' sm-lyrics-line--blocked' : ''}${blockForLine && !blockForLine.isTemplate ? ' sm-lyrics-line--block-instance' : ''}${blockMarkMode() ? ' sm-lyrics-line-markable' : ''}${isMarkSelected ? ' sm-lyrics-line-mark-selected' : ''}`}
                              style={blockColor ? { '--block-color': blockColor } : {}}
                              onClick={() => {
                                if (blockMarkMode()) {
                                  const start = markStartLine()
                                  if (start === null) {
                                    setMarkStartLine(idx)
                                    setMarkEndLine(null)
                                  } else if (markEndLine() !== null) {
                                    // Reset and start new selection
                                    setMarkStartLine(idx)
                                    setMarkEndLine(null)
                                  } else {
                                    // Second click — set end
                                    if (idx > start) {
                                      setMarkEndLine(idx + 1)  // end is exclusive
                                    } else if (idx < start) {
                                      setMarkStartLine(idx)
                                      setMarkEndLine(start + 1)
                                    } else {
                                      // Same line clicked — select single line
                                      setMarkEndLine(start + 1)
                                    }
                                  }
                                } else {
                                  handleLyricLineClick(idx)
                                }
                              }}
                            >
                              {/* Show unlink button on hover for non-template blocked lines */}
                              {blockForLine && !blockForLine.isTemplate && (
                                <span
                                  class="sm-lyrics-block-unlink"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleUnlinkInstance(blockForLine.blockId, blockForLine.instanceIdx)
                                  }}
                                  title="Unlink this instance"
                                >x</span>
                              )}
                              <span class="sm-lyrics-time">{formatTime(rlItem.time)}</span>
                              {rlItem.words.length === 0
                                ? (rlItem.key.startsWith('lrc-')
                                    ? lrcLines()[idx]?.text || ''
                                    : lyricsLines()[idx] || '')
                                : rlItem.words.map((word, wi) => {
                                    if (wi <= rlItem.activeUpTo) {
                                      return <span class="sm-lyrics-word sm-lyrics-word-done">{word}{' '}</span>
                                    }
                                    if (wi === rlItem.activeUpTo + 1 && rlItem.activeCharProgress > 0) {
                                      return (
                                        <span class="sm-lyrics-word sm-lyrics-word-current">
                                          <span class="sm-lyrics-char-done">{word.slice(0, rlItem.activeCharProgress)}</span>
                                          <span class="sm-lyrics-char-remaining">{word.slice(rlItem.activeCharProgress)}</span>
                                          {' '}
                                        </span>
                                      )
                                    }
                                    return <span class="sm-lyrics-word">{word}{' '}</span>
                                  })
                              }
                            </span>
                          </>
                        )
                      })
                    })()}
                  </div>
                </Show>
              </Show>
              <Show when={!lyricsLoading() && lyricsSource() === 'none'}>
                <LyricsUploader
                  onUpload={handleLyricsUpload}
                  suggestion={props.songTitle}
                />
              </Show>
              <div
                class="sm-resize-handle"
                onPointerDown={(e) => handleResizeStart('lyrics', e)}
              />
            </div>
          </div>
        </Show>
    </div>
  )
}

// ============================================================
// CSS Styles
// ============================================================

export const StemMixerStyles: string = `
.stem-mixer {
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
  grid-auto-rows: auto;
  align-content: start;
  gap: 0.5rem;
  flex: 1;
  overflow: hidden;
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
  min-height: 0;
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
  height: 100%;
  width: 100%;
  min-height: 0;
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

/* Score card */
.sm-mic-score-card {
  position: relative;
  z-index: 10;
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.5rem;
  margin: 0 1rem 0.5rem;
  padding: 1rem 1.25rem;
  animation: sm-score-in 0.3s ease-out;
}
@keyframes sm-score-in {
  from { opacity: 0; transform: translateY(-0.5rem); }
  to { opacity: 1; transform: translateY(0); }
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

`
