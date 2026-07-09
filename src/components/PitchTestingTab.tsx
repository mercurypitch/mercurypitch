// ============================================================
// PitchTestingTab - Developer Debug Tab for Pitch Detection
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { OfflinePitchCanvas } from '@/components/OfflinePitchCanvas'
import { PitchCanvasToolbar } from '@/components/PitchCanvasToolbar'
import { PitchOverTimeCanvas } from '@/components/PitchOverTimeCanvas'
import { SafeSelect } from '@/components/shared/SafeSelect'
import { getDb } from '@/db'
import type { UvrSessionRecord, UvrStemBlob } from '@/db/entities'
import { loadLyricsFromDb, saveLyricsToDb, } from '@/db/services/lyrics-db-service'
import { deleteOfflineAnalysis, getOfflineAnalysis, saveOfflineAnalysis, } from '@/db/services/pitch-analysis-service'
import { saveUvrSession } from '@/db/services/uvr-service'
import { computeFileHash } from '@/lib/file-hash'
import type { LrcLine } from '@/lib/lyrics-service'
import { parseLrcFile } from '@/lib/lyrics-service'
import { mapLyricsToMelody } from '@/lib/lyrics-service'
import type { MergedNote } from '@/lib/midi-generator'
import { mergeConsecutiveNotes } from '@/lib/midi-generator'
import { melodyItemsToMergedNotes } from '@/lib/note-display-utils'
import type { PitchDetectionResult } from '@/lib/pitch-algorithms'
import { AutocorrelatorDetector, FFTDetector, SwiftF0Adapter, YINDetector, } from '@/lib/pitch-algorithms'
import { segmentPitchesToNotes } from '@/lib/pitch-algorithms/note-segmenter'
import type { AlignmentResult } from '@/lib/pitch-word-alignment'
import { alignPitchToWords, filterWordSegments, lrcLinesToSegments, splitMultiWordSegments, } from '@/lib/pitch-word-alignment'
import { freqToMidi } from '@/lib/scale-data'
import { formatAlignmentDebugLog, logAlignmentComparison, } from '@/lib/transcription-alignment-utils'
import { useWhisperTranscription } from '@/lib/useWhisperTranscription'
import { cancelUvrPipeline, runUvrPipeline, } from '@/lib/uvr-processing-pipeline'
import { completeUvrSession, getAllUvrSessions, getUvrProcessingMode, getUvrSession, saveAllUvrSessions, setCurrentUvrSession, setErrorUvrSession, startUvrSession, } from '@/stores/app-store'
import { currentScale } from '@/stores/melody-store'
import type { MelodyItem } from '@/types'
import type { TimeStampedPitchSample } from '@/types/pitch-algorithms'
import { FileText } from './icons'
import styles from './PitchTestingTab.module.css'

interface PitchTestingTabProps {
  onClose?: () => void
}

type DetectionMode = 'mic' | 'file' | 'generate'
type AlgorithmId = 'yin' | 'fft' | 'autocorr' | 'swift'

export interface AnalyzedTrack {
  id: string
  file: File
  waveform: Float32Array
  duration: number
  analysisResults: {
    algorithm: AlgorithmId
    pitches: TimeStampedPitchSample[]
  }[]
  lrcLines?: LrcLine[]
  segmentedNotes?: MelodyItem[]
  isVocalStem?: boolean
  fileHash?: string
  audioBuffer?: AudioBuffer
  uvrSessionId?: string
}

interface TestNoteResult {
  noteName: string
  targetFreq: number
  passed: boolean
  detectedFreq: number | null
  errorCents: number | null
  errorHz: number | null
}

interface EnsembleTickResult {
  algorithm: AlgorithmId
  result: PitchDetectionResult | null
}

/** Calculate cents error between detected and target frequency (absolute value). */
function centsError(detectedFreq: number, targetFreq: number): number {
  return Math.abs(1200 * Math.log2(detectedFreq / targetFreq))
}

const TEST_FREQUENCIES = [
  65.41, 73.42, 82.41, 87.31, 98.0, 110.0, 130.81, 146.83, 164.81, 196.0, 220.0,
  261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0,
  1046.5,
]

const TEST_NOTE_NAMES = [
  'C2',
  'D2',
  'E2',
  'F2',
  'G2',
  'A2',
  'C3',
  'D3',
  'E3',
  'G3',
  'A3',
  'C4',
  'D4',
  'E4',
  'G4',
  'A4',
  'C5',
  'D5',
  'E5',
  'G5',
  'A5',
  'C6',
]

// Log-scale frequency slider helpers
const FREQ_SLIDER_MIN = 65
const FREQ_SLIDER_MAX = 2100
const FREQ_LOG_RATIO = Math.log2(FREQ_SLIDER_MAX / FREQ_SLIDER_MIN)
const FREQ_SLIDER_STEPS = 1000

function freqToSliderVal(freq: number): number {
  return Math.round(
    (Math.log2(freq / FREQ_SLIDER_MIN) / FREQ_LOG_RATIO) * FREQ_SLIDER_STEPS,
  )
}

function sliderValToFreq(val: number): number {
  return Math.round(
    FREQ_SLIDER_MIN * Math.pow(2, (val / FREQ_SLIDER_STEPS) * FREQ_LOG_RATIO),
  )
}

export const PitchTestingTab: Component<PitchTestingTabProps> = (props) => {
  const [detectors] = createSignal([
    new YINDetector(),
    new FFTDetector(),
    new AutocorrelatorDetector(),
    new SwiftF0Adapter(),
  ])

  const [selectedAlgorithm, setSelectedAlgorithm] =
    createSignal<AlgorithmId>('yin')
  const [ensembleMode, setEnsembleMode] = createSignal(false)
  const [ensembleAlgorithms, setEnsembleAlgorithms] = createSignal<
    Set<AlgorithmId>
  >(new Set(['yin', 'fft']))
  const [ensembleTickResults, setEnsembleTickResults] = createSignal<
    EnsembleTickResult[]
  >([])
  const [detectionMode, _setDetectionMode] = createSignal<DetectionMode>(
    (localStorage.getItem('pitch_test_mode') as DetectionMode) || 'mic',
  )
  const setDetectionMode = (mode: DetectionMode) => {
    localStorage.setItem('pitch_test_mode', mode)
    _setDetectionMode(mode)
  }
  const [frequency, setFrequency] = createSignal(440)
  const [generatedWaveform, setGeneratedWaveform] =
    createSignal<Float32Array | null>(null)

  // Gallery state
  const [analyzedTracks, setAnalyzedTracks] = createSignal<AnalyzedTrack[]>([])
  const [activeTrackId, setActiveTrackId] = createSignal<string | null>(null)

  const activeTrack = createMemo(
    () => analyzedTracks().find((t) => t.id === activeTrackId()) || null,
  )

  const [showSegmentedNotes, setShowSegmentedNotes] = createSignal(true)
  const [showNoteLabels, setShowNoteLabels] = createSignal(false)
  const [showLyricLabels, setShowLyricLabels] = createSignal(false)

  // ── Whisper transcription ────────────────────────────────────
  const whisper = useWhisperTranscription({
    getAudioBuffer: () => activeTrack()?.audioBuffer,
    logTag: 'PitchTestingTab',
    onTranscriptionComplete: (segments) => {
      setTimeout(() => {
        const r = activeAlignment()
        formatAlignmentDebugLog('PitchTestingTab', r)
        // Compare raw vs denoised
        const track = activeTrack()
        const rawNotes: MergedNote[] = []
        const denoisedNotes: MergedNote[] = []
        if (
          track?.analysisResults != null &&
          track.analysisResults.length > 0
        ) {
          const primaryPitches = track.analysisResults[0].pitches
          const detections = primaryPitches
            .filter((p) => p.freq != null && p.freq > 0)
            .map((p) => ({
              midi: freqToMidi(p.freq!),
              noteName: p.noteName ?? '',
              timeSec: p.time,
            }))
          rawNotes.push(...mergeConsecutiveNotes(detections))
        }
        if (track?.segmentedNotes != null && track.segmentedNotes.length > 0) {
          denoisedNotes.push(
            ...melodyItemsToMergedNotes(track.segmentedNotes, 120),
          )
        }
        logAlignmentComparison(
          'PitchTestingTab',
          rawNotes,
          denoisedNotes,
          segments,
        )
      }, 0)
    },
  })
  // Aliases for backward compatibility
  const whisperStatus = whisper.status
  const whisperProgress = whisper.progress
  const whisperSegments = whisper.segments
  const transcribeElapsed = whisper.elapsed

  // Clear whisper state when active track changes -- each track has its own
  // transcription. Without this, stale words from a previous track leak over.
  createEffect(() => {
    activeTrackId() // track the signal for reactivity
    // Reset segments and status so old results don't bleed into new tracks
    whisper.setSegments([])
    if (whisper.status() === 'done') {
      whisper.setStatus('ready')
    }
  })

  // ── Pitch-word alignment memo ────────────────────────────────
  const activeAlignment = createMemo<AlignmentResult>(() => {
    const track = activeTrack()
    const useDenoised = showSegmentedNotes()

    // Determine note source based on denoised toggle
    let merged: MergedNote[] = []
    if (
      useDenoised &&
      track?.segmentedNotes &&
      track.segmentedNotes.length > 0
    ) {
      merged = melodyItemsToMergedNotes(track.segmentedNotes, 120)
    } else if (track?.analysisResults && track.analysisResults.length > 0) {
      // Fall back to raw pitches from primary algorithm
      const primaryPitches = track.analysisResults[0].pitches
      if (primaryPitches.length > 0) {
        const detections = primaryPitches
          .filter((p) => p.freq != null && p.freq > 0)
          .map((p) => ({
            midi: freqToMidi(p.freq!),
            noteName: p.noteName ?? '',
            timeSec: p.time,
          }))
        merged = mergeConsecutiveNotes(detections)
      }
    }

    if (merged.length === 0) {
      return {
        alignedWords: [],
        totalWords: 0,
        mappedWords: 0,
        unmappedWords: 0,
        accuracy: 0,
        debugEntries: [],
      }
    }

    // Prefer whisper segments; fall back to LRC word timings
    let segments = whisperSegments()
    if (segments.length === 0) {
      const lrc = track?.lrcLines
      if (lrc && lrc.length > 0) {
        segments = lrcLinesToSegments(lrc)
      }
    }

    if (segments.length === 0) {
      return {
        alignedWords: [],
        totalWords: 0,
        mappedWords: 0,
        unmappedWords: 0,
        accuracy: 0,
        debugEntries: [],
      }
    }

    const filtered = filterWordSegments(segments)
    const split = splitMultiWordSegments(filtered)
    const noteSource = useDenoised ? 'denoised' : 'raw'
    console.log(
      `[PitchTestingTab] Alignment using ${noteSource} notes (${merged.length} notes, ${split.length} words)`,
    )
    return alignPitchToWords(merged, split)
  })

  const uploadedFile = createMemo(() => activeTrack()?.file || null)
  const fileWaveform = createMemo(() => activeTrack()?.waveform || null)
  const fileDuration = createMemo(() => activeTrack()?.duration ?? 0)
  const offlineAnalysisResults = createMemo(
    () => activeTrack()?.analysisResults || [],
  )
  const currentSegmentedNotes = createMemo(() =>
    showSegmentedNotes() ? activeTrack()?.segmentedNotes : undefined,
  )

  const [isAnalyzingOffline, setIsAnalyzingOffline] = createSignal(false)
  const [isSeparating, setIsSeparating] = createSignal(false)
  const [activeUvrSessionId, setActiveUvrSessionId] = createSignal<
    string | undefined
  >()
  const [offlineProgress, setOfflineProgress] = createSignal(0)

  // Microphone state
  const [audioContext, setAudioContext] = createSignal<AudioContext | null>(
    null,
  )
  const [mediaStream, setMediaStream] = createSignal<MediaStream | null>(null)
  const [sourceNode, setSourceNode] = createSignal<AudioNode | null>(null)
  const [analyser, setAnalyser] = createSignal<AnalyserNode | null>(null)
  const [isMicStartedByUser, setIsMicStartedByUser] = createSignal(false)

  // Detection results over time
  const [liveResults, setLiveResults] = createSignal<
    (PitchDetectionResult | null)[]
  >([])
  const [pitchSamples, setPitchSamples] = createSignal<
    TimeStampedPitchSample[]
  >([])
  const [isDetecting, setIsDetecting] = createSignal(false)

  // Metrics display
  const [_totalDetections, setTotalDetections] = createSignal(0)
  const [_avgClarity, setAvgClarity] = createSignal(0)
  const [_avgErrorHz, setAvgErrorHz] = createSignal(0)

  // Test results
  const [testResults, setTestResults] = createSignal<{
    passed: number
    failed: number
    errors: number[]
    noteResults: TestNoteResult[]
  }>({ passed: 0, failed: 0, errors: [], noteResults: [] })

  // UI state
  const [isRunningTest, setIsRunningTest] = createSignal(false)
  const [zoomLevel, setZoomLevel] = createSignal(1)
  const [sensitivity, setSensitivity] = createSignal(7)
  const [minConfidence, setMinConfidence] = createSignal(0.1)
  const [centsThreshold, setCentsThreshold] = createSignal(15)

  onMount(() => {
    void (async () => {
      try {
        const db = await getDb()
        const sessions = await db
          .getRepository<UvrSessionRecord>('uvrSessions')
          .findAll({ where: { status: 'completed' } })
        for (const session of sessions) {
          const sessionId = session.appSessionId
          const vocalBlobs = await db
            .getRepository<UvrStemBlob>('uvrStemBlobs')
            .findAll({ where: { sessionId, stemType: 'vocal' } })

          if (vocalBlobs.length > 0) {
            const blob = vocalBlobs[0]
            const fileName = session.originalFileName
              ? `${session.originalFileName} (Vocal).wav`
              : 'Vocal Stem.wav'
            const file = new File([blob.data], fileName, {
              type: blob.mimeType,
            })

            let lrcLines: LrcLine[] | undefined = undefined
            const dbLyrics = await loadLyricsFromDb(sessionId)
            if (dbLyrics !== null && dbLyrics.format === 'lrc') {
              lrcLines = parseLrcFile(dbLyrics.text)
            }

            const newId = Math.random().toString(36).substring(2, 9)
            const fileHash = session.fileHash

            let cachedAnalysis: {
              analysisResults: unknown
              lrcLines?: unknown
              segmentedNotes?: unknown
            } | null = null
            if (fileHash !== undefined && fileHash !== '') {
              cachedAnalysis = await getOfflineAnalysis(fileHash)
            }

            const newTrack: AnalyzedTrack = {
              id: newId,
              file,
              waveform: new Float32Array(),
              duration: 0,
              analysisResults:
                (cachedAnalysis?.analysisResults as typeof newTrack.analysisResults) ??
                [],
              lrcLines:
                (cachedAnalysis?.lrcLines as typeof lrcLines) ?? lrcLines,
              segmentedNotes:
                (cachedAnalysis?.segmentedNotes as typeof newTrack.segmentedNotes) ??
                undefined,
              isVocalStem: true,
              fileHash,
              uvrSessionId: sessionId,
            }

            setAnalyzedTracks((prev) => [...prev, newTrack])

            let ctx = audioContext()
            if (!ctx) {
              ctx = new (
                typeof window.AudioContext !== 'undefined'
                  ? window.AudioContext
                  : (
                      window as unknown as {
                        webkitAudioContext: typeof AudioContext
                      }
                    ).webkitAudioContext
              )()
              setAudioContext(ctx)
            }

            const bufferCopy = blob.data.slice(0)
            const audioBuffer = await ctx.decodeAudioData(bufferCopy)
            const rawData = audioBuffer.getChannelData(0)
            const sampleRate = audioBuffer.sampleRate

            let samples = rawData
            if (sampleRate > 44100) {
              const ratio = 44100 / sampleRate
              const newLength = Math.floor(rawData.length * ratio)
              samples = new Float32Array(newLength)
              for (let i = 0; i < newLength; i++) {
                // Map the (shorter) output index to the (longer) source
                // index by dividing by ratio, not multiplying — otherwise
                // only the first `ratio` fraction of the source is ever
                // read and the rest of the audio is silently dropped.
                samples[i] = rawData[Math.floor(i / ratio)]
              }
            }

            setAnalyzedTracks((prev) =>
              prev.map((t) => {
                if (t.id === newId) {
                  return {
                    ...t,
                    waveform: samples,
                    duration: audioBuffer.duration,
                    audioBuffer,
                  }
                }
                return t
              }),
            )
          }
        }
      } catch (err) {
        console.error('Failed to auto-load separated stems from DB', err)
      }
    })()

    // ── Whisper service init ──────────────────────────────────
    whisper.initWhisper()
  })

  let detectionTimerId: number | null = null
  let detectionStartTime = 0
  let streamStopTimeout: number | null = null
  let cancelTest = false

  // Resize state
  let waveformHeight = 280
  let isResizing = false
  let resizeStartY = 0
  let resizeStartHeight = 0

  const onResizeMouseDown = (e: MouseEvent) => {
    isResizing = true
    resizeStartY = e.clientY
    resizeStartHeight = waveformHeight
    document.addEventListener('mousemove', onResizeMouseMove)
    document.addEventListener('mouseup', onResizeMouseUp)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }

  const onResizeMouseMove = (e: MouseEvent) => {
    if (!isResizing) return
    const delta = e.clientY - resizeStartY
    waveformHeight = Math.max(150, Math.min(600, resizeStartHeight + delta))
    const el = document.querySelector('.waveform-canvas') as HTMLElement | null
    if (el) el.style.height = `${waveformHeight}px`
  }

  const onResizeMouseUp = () => {
    isResizing = false
    document.removeEventListener('mousemove', onResizeMouseMove)
    document.removeEventListener('mouseup', onResizeMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  const zoomIn = () => {
    const steps = [1, 2, 3, 5, 8]
    const current = zoomLevel()
    const idx = steps.indexOf(current)
    if (idx < steps.length - 1) setZoomLevel(steps[idx + 1]!)
  }

  const zoomOut = () => {
    const steps = [1, 2, 3, 5, 8]
    const current = zoomLevel()
    const idx = steps.indexOf(current)
    if (idx > 0) setZoomLevel(steps[idx - 1]!)
  }

  // Load audio file
  const handleLrcUpload = async (file: File, trackId: string) => {
    try {
      const text = await file.text()
      const lrcLines = parseLrcFile(text)
      setAnalyzedTracks((prev) =>
        prev.map((t) => {
          if (t.id === trackId) {
            const updated = { ...t, lrcLines }
            if (updated.segmentedNotes) {
              mapLyricsToMelody(updated.segmentedNotes, lrcLines)
            }
            // Persist to IndexedDB if this is a UVR session track
            if (t.uvrSessionId !== undefined && t.uvrSessionId !== '') {
              void saveLyricsToDb(t.uvrSessionId, {
                text,
                format: 'lrc',
                filename: file.name,
              })
            }
            return updated
          }
          return t
        }),
      )
    } catch (err) {
      console.error('Error parsing LRC file', err)
    }
  }

  const handleFileUpload = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    const newId = Math.random().toString(36).substring(2, 9)
    const newTrack: AnalyzedTrack = {
      id: newId,
      file,
      waveform: new Float32Array(),
      duration: 0,
      analysisResults: [],
    }

    setAnalyzedTracks((prev) => [...prev, newTrack])
    setActiveTrackId(newId)

    const reader = new FileReader()
    reader.onload = (e) => {
      const audioData = e.target?.result as ArrayBuffer
      processAudioFile(audioData)
    }
    reader.readAsArrayBuffer(file)
  }

  const processAudioFile = async (audioData: ArrayBuffer) => {
    let ctx = audioContext()
    if (!ctx) {
      ctx = new (
        typeof window.AudioContext !== 'undefined'
          ? window.AudioContext
          : (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext
      )()
      setAudioContext(ctx)
    }

    try {
      const audioBuffer = await ctx.decodeAudioData(audioData)

      // Convert to Float32Array and normalize
      const rawData = audioBuffer!.getChannelData(0)
      const sampleRate = audioBuffer!.sampleRate

      // Downsample if necessary for performance
      let samples = rawData
      if (sampleRate > 44100) {
        const ratio = 44100 / sampleRate
        const newLength = Math.floor(rawData.length * ratio)
        samples = new Float32Array(newLength)
        for (let i = 0; i < newLength; i++) {
          samples[i] = rawData[Math.floor(i / ratio)]
        }
      }

      const currentTracks = analyzedTracks()
      const currentActiveId = activeTrackId()
      const newTracks = await Promise.all(
        currentTracks.map(async (t) => {
          if (t.id === currentActiveId) {
            const fileHash = await computeFileHash(t.file)
            let cachedAnalysis: {
              analysisResults: unknown
              lrcLines?: unknown
              segmentedNotes?: unknown
            } | null = null
            if (fileHash !== undefined && fileHash !== '') {
              cachedAnalysis = await getOfflineAnalysis(fileHash)
            }

            return {
              ...t,
              waveform: samples,
              duration: audioBuffer!.duration,
              audioBuffer: audioBuffer!,
              analysisResults:
                (cachedAnalysis?.analysisResults as typeof t.analysisResults) ??
                [],
              lrcLines:
                (cachedAnalysis?.lrcLines as typeof t.lrcLines) ?? undefined,
              segmentedNotes:
                (cachedAnalysis?.segmentedNotes as typeof t.segmentedNotes) ??
                undefined,
              fileHash,
            }
          }
          return t
        }),
      )
      setAnalyzedTracks(newTracks)
      setOfflineProgress(0)
      stopLiveDetection() // Reset detection
    } catch (error) {
      console.error('Error processing audio file:', error)
      alert('Failed to process audio file')
    }
  }

  const analyzeUploadedAudio = async () => {
    const samples = fileWaveform()
    const activeId = activeTrackId()
    if (!samples || isAnalyzingOffline() || activeId == null || activeId === '')
      return

    setIsAnalyzingOffline(true)
    setOfflineProgress(0)

    // Determine algorithms to run
    const activeAlgosArr = Array.from(
      ensembleMode() ? ensembleAlgorithms() : [selectedAlgorithm()],
    )

    const results: {
      algorithm: AlgorithmId
      pitches: TimeStampedPitchSample[]
    }[] = activeAlgosArr.map((algo) => ({
      algorithm: algo as AlgorithmId,
      pitches: [],
    }))

    const sampleRate = audioContext()?.sampleRate ?? 44100
    const windowSize = 2048 // 2048 samples per chunk
    const stepSize = 1024 // 1024 samples hop size
    const totalSteps = Math.floor((samples.length - windowSize) / stepSize)

    // Using existing detectors which might have state.
    // For a cleaner offline run, we could instantiate new ones, but this is fine for debug.
    const currentDetectors = detectors()

    for (let i = 0; i < totalSteps; i++) {
      const startIndex = i * stepSize
      const chunk = samples.slice(startIndex, startIndex + windowSize)
      const timestamp = (startIndex + windowSize / 2) / sampleRate

      for (let j = 0; j < activeAlgosArr.length; j++) {
        const algoId = activeAlgosArr[j] as AlgorithmId
        const detector = currentDetectors.find((d) => d.algorithm === algoId)
        if (detector) {
          let res: PitchDetectionResult | null = null
          if (
            'detectAsync' in detector &&
            typeof detector.detectAsync === 'function'
          ) {
            res = await (
              detector as {
                detectAsync: (
                  chunk: Float32Array,
                ) => Promise<PitchDetectionResult | null>
              }
            ).detectAsync(chunk)
          } else {
            res = detector.detect(chunk)
          }
          if (res && res.clarity >= minConfidence() && res.frequency > 0) {
            results[j]?.pitches.push({
              freq: res.frequency,
              clarity: res.clarity ?? 1.0,
              time: timestamp,
              noteName: res.noteName ?? null,
            })
          }
        }
      }

      if (i % 50 === 0) {
        setOfflineProgress((i / totalSteps) * 100)
        await new Promise((r) => setTimeout(r, 0)) // yield to UI
      }
    }

    const currentResults = [...offlineAnalysisResults()]
    for (const res of results) {
      const existingIdx = currentResults.findIndex(
        (r) => r.algorithm === res.algorithm,
      )
      if (existingIdx !== -1) {
        currentResults[existingIdx] = res
      } else {
        currentResults.push(res)
      }
    }

    setAnalyzedTracks((prev) =>
      prev.map((t) => {
        if (t.id === activeId) {
          // Automatically segment pitches from the primary (first) algorithm
          const primaryPitches =
            currentResults.length > 0 ? currentResults[0].pitches : []
          const newSegmentedNotes = segmentPitchesToNotes(primaryPitches, {
            minClarity: 0.7,
          })

          // Re-map lyrics if they exist
          if (t.lrcLines) {
            mapLyricsToMelody(newSegmentedNotes, t.lrcLines)
          }

          const updatedTrack = {
            ...t,
            analysisResults: currentResults,
            segmentedNotes: newSegmentedNotes,
          }
          if (updatedTrack.fileHash !== undefined) {
            saveOfflineAnalysis(
              updatedTrack.fileHash,
              updatedTrack.analysisResults,
              updatedTrack.lrcLines,
              updatedTrack.segmentedNotes,
            ).catch(console.error)
          }

          return updatedTrack
        }
        return t
      }),
    )
    setOfflineProgress(100)
    setIsAnalyzingOffline(false)
  }

  const separateVocalsFirst = async () => {
    const samples = fileWaveform()
    const activeId = activeTrackId()
    const track = analyzedTracks().find((t) => t.id === activeId)
    // Synchronously extract context to avoid reactivity warnings inside async onComplete
    const currentAudioCtx = audioContext()

    if (
      !samples ||
      isAnalyzingOffline() ||
      isSeparating() ||
      activeId == null ||
      activeId === '' ||
      !track
    )
      return

    setIsSeparating(true)
    setOfflineProgress(0)
    setAnalyzedTracks((prev) =>
      prev.map((t) => {
        if (t.id === activeId) return { ...t, analysisResults: [] }
        return t
      }),
    )

    try {
      const file = track.file
      const hash = await computeFileHash(file)
      const mode = getUvrProcessingMode()
      const sessionId = startUvrSession(
        file.name,
        file.size,
        file.type,
        'separate',
        mode,
        hash,
      )

      const sessions = getAllUvrSessions()
      const session = sessions.find((s) => s.sessionId === sessionId)
      if (session) {
        session.status = 'processing'
        saveAllUvrSessions(sessions)
        setCurrentUvrSession({ ...session })
      }

      await runUvrPipeline(file, sessionId, mode, {
        onProgress: (pct) => {
          setOfflineProgress(pct * 0.5) // First 50% is separation
        },
        onComplete: (result) => {
          void (async () => {
            try {
              completeUvrSession(sessionId, result.outputs, result.stemMeta)

              const s = getUvrSession(sessionId)
              if (s) {
                await saveUvrSession({
                  sessionId,
                  status: 'completed',
                  progress: 100,
                  fileHash: s.fileHash,
                  originalFileName: s.originalFile?.name ?? file.name,
                  originalFileSize: s.originalFile?.size ?? file.size,
                  originalFileType: s.originalFile?.mimeType ?? file.type,
                  processingMode: mode,
                  processingTime: s.processingTime,
                })
              }

              // Now fetch the vocal stem back to Float32Array to continue with pitch detection
              if (
                result.outputs !== undefined &&
                result.outputs.vocal !== undefined
              ) {
                const resp = await fetch(result.outputs.vocal)
                const ab = await resp.arrayBuffer()
                let ctx = currentAudioCtx
                if (!ctx) {
                  ctx = new (
                    typeof window.AudioContext !== 'undefined'
                      ? window.AudioContext
                      : (
                          window as unknown as {
                            webkitAudioContext: typeof AudioContext
                          }
                        ).webkitAudioContext
                  )()
                  setAudioContext(ctx)
                }
                const decoded = await ctx.decodeAudioData(ab)

                const mono = new Float32Array(decoded.length)
                if (decoded.numberOfChannels > 1) {
                  const ch0 = decoded.getChannelData(0)
                  const ch1 = decoded.getChannelData(1)
                  for (let i = 0; i < decoded.length; i++) {
                    mono[i] = (ch0[i] + ch1[i]) * 0.5
                  }
                } else {
                  mono.set(decoded.getChannelData(0))
                }

                setAnalyzedTracks((prev) =>
                  prev.map((t) => {
                    if (t.id === activeId)
                      return {
                        ...t,
                        waveform: mono,
                        analysisResults: [],
                        isVocalStem: true,
                        audioBuffer: decoded,
                      }
                    return t
                  }),
                )
              }

              setOfflineProgress(50)
              // Since analyzeUploadedAudio expects fileWaveform() to be updated, yield to reactivity
              await new Promise((r) => setTimeout(r, 0))
              await analyzeUploadedAudio()
            } catch (err) {
              console.error('Error post-processing vocal stem:', err)
              alert('Failed to process separated vocals. See console.')
            } finally {
              setIsSeparating(false)
              setActiveUvrSessionId(undefined)
            }
          })()
        },
        onError: (err) => {
          setErrorUvrSession(sessionId, err)
          if (err !== 'Cancelled') {
            console.error('Failed to separate vocals:', err)
            alert('Failed to separate vocals. See console for details.')
          }
          setIsSeparating(false)
          setActiveUvrSessionId(undefined)
        },
      })
    } catch (err) {
      console.error('Failed to initialize separation:', err)
      alert('Failed to initialize separation. See console for details.')
      setIsSeparating(false)
    }
  }

  // Start microphone input (only sets up, doesn't start detection loop)
  const startMicrophoneInput = async () => {
    try {
      const ctx = new AudioContext({ sampleRate: 44100 })
      setAudioContext(ctx)
      await ctx.resume()

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMediaStream(stream)

      const source = ctx.createMediaStreamSource(stream)
      setSourceNode(source)

      const analyserNode = ctx.createAnalyser()
      analyserNode.fftSize = 2048
      analyserNode.smoothingTimeConstant = 0.1
      setAnalyser(analyserNode)

      source.connect(analyserNode)
      setIsMicStartedByUser(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert(
        'Failed to access microphone. Please ensure you have granted permission.',
      )
    }
  }

  // Dedicated cleanup for microphone resources (no reactivity)
  const cleanupMicrophoneResources = () => {
    mediaStream()
      ?.getTracks()
      .forEach((track) => track.stop())
    setMediaStream(null)
    sourceNode()?.disconnect()
    setSourceNode(null)
    audioContext()?.close()
    setAudioContext(null)
  }

  const stopMicrophoneInput = () => {
    cleanupMicrophoneResources()
    // Don't call stopLiveDetection here to avoid circular calls
  }

  // Unified detection tick — called on a throttled setInterval (10 Hz)
  const detectionTick = () => {
    if (!isDetecting()) {
      if (detectionTimerId !== null) {
        clearInterval(detectionTimerId)
        detectionTimerId = null
      }
      return
    }

    const isEnsemble = ensembleMode()

    if (!isEnsemble) {
      const detector = detectorForAlgorithm()
      if (detector === undefined) return
    }

    const mode = detectionMode()
    let dataArray: Float32Array

    if (mode === 'mic') {
      if (!isMicStartedByUser()) return
      const analyserVal = analyser()
      if (!analyserVal) return
      dataArray = new Float32Array(analyserVal.fftSize)
      analyserVal.getFloatTimeDomainData(dataArray as Float32Array<ArrayBuffer>)
    } else if (mode === 'generate') {
      const wave = generatedWaveform()
      if (!wave) return
      dataArray = wave
    } else if (mode === 'file') {
      const wave = fileWaveform()
      if (!wave) {
        stopLiveDetection()
        return
      }
      dataArray = wave
    } else {
      return
    }

    let result: PitchDetectionResult | null
    let tickPerAlgorithm: EnsembleTickResult[] = []

    if (isEnsemble) {
      const ensembleOutput = ensembleDetect(dataArray)
      result = ensembleOutput.result
      tickPerAlgorithm = ensembleOutput.perAlgorithm
      setEnsembleTickResults(tickPerAlgorithm)
    } else {
      const detector = detectorForAlgorithm()!
      result = detector.detect(dataArray)
    }

    setLiveResults((prev) => [...prev.slice(-100), result])

    const now = performance.now()
    const elapsed =
      detectionStartTime > 0 ? (now - detectionStartTime) / 1000 : 0
    const sample: TimeStampedPitchSample = {
      time: elapsed,
      freq: result?.frequency ?? null,
      noteName: result?.noteName ?? null,
      clarity: result?.clarity ?? 0,
    }
    setPitchSamples((prev) => {
      const next = [...prev, sample]
      return next.length > 1200 ? next.slice(-1200) : next
    })
  }

  // Load generated waveform
  const loadGeneratedWaveform = () => {
    stopLiveDetection()
    const sampleRate = 44100
    const duration = 0.5
    const samples = Math.floor(duration * sampleRate)
    const wave = new Float32Array(samples)

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate
      const amplitude = t < 0.01 ? t / 0.01 : 1
      wave[i] = Math.sin(2 * Math.PI * frequency() * t) * amplitude
    }

    setGeneratedWaveform(wave)
    setActiveTrackId(null)
    setAnalyzedTracks([])
  }

  // Generate test waveform
  const generateWaveform = () => {
    const sampleRate = 44100
    const duration = 0.5
    const samples = Math.floor(duration * sampleRate)
    const wave = new Float32Array(samples)

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate
      const amplitude = t < 0.01 ? t / 0.01 : 1
      wave[i] = Math.sin(2 * Math.PI * frequency() * t) * amplitude
    }

    setGeneratedWaveform(wave)
  }

  createEffect(() => {
    generateWaveform()
  })

  const startWhisperTranscription = () => {
    whisper.startTranscription()
  }

  // Start live detection
  const startLiveDetection = () => {
    setIsDetecting(true)
    setLiveResults([])
    setPitchSamples([])
    detectionStartTime = performance.now()

    // For mic mode, start mic if needed — detectionTick will pick up when ready
    if (detectionMode() === 'mic' && !isMicStartedByUser()) {
      void startMicrophoneInput()
    }

    // Stop any existing timer before starting a new one
    if (detectionTimerId !== null) {
      clearInterval(detectionTimerId)
    }
    detectionTimerId = window.setInterval(detectionTick, 100)
  }

  // Stop live detection
  const stopLiveDetection = () => {
    setIsDetecting(false)
    if (detectionTimerId !== null) {
      clearInterval(detectionTimerId)
      detectionTimerId = null
    }
    if (streamStopTimeout !== null) {
      clearTimeout(streamStopTimeout)
      streamStopTimeout = null
    }
  }

  // Run automated test
  const runTest = () => {
    setIsRunningTest(true)
    cancelTest = false
    setTestResults({ passed: 0, failed: 0, errors: [], noteResults: [] })

    // Stop any ongoing detection modes (mic, file, generate)
    stopLiveDetection()
    setIsMicStartedByUser(false)

    // Reset all detectors to clear pitch history — accumulated mic
    // detections would otherwise contaminate the stability filter and
    // cause new test frequencies to be rejected as outliers.
    detectors().forEach((d) => d.reset())

    const isEnsemble = ensembleMode()
    const testSampleRate = 44100

    if (!isEnsemble) {
      const detector = detectors().find(
        (d) => d.algorithm === selectedAlgorithm(),
      )
      if (detector == null) {
        setIsRunningTest(false)
        return
      }
    }

    const errors: number[] = []
    let passed = 0
    const noteResults: TestNoteResult[] = []

    // Run tests sequentially to avoid race conditions with async detectors
    const runAll = async () => {
      for (let index = 0; index < TEST_FREQUENCIES.length; index++) {
        if (cancelTest) break
        const freq = TEST_FREQUENCIES[index]!
        const wave = new Float32Array(testSampleRate * 0.5)
        for (let i = 0; i < wave.length; i++) {
          const t = i / testSampleRate
          wave[i] = Math.sin(2 * Math.PI * freq * t)
        }

        let detectedFreq: number | null

        if (isEnsemble) {
          detectors().forEach((d) => d.reset())
          const ensembleOutput = ensembleDetect(wave)
          detectedFreq = ensembleOutput.result?.frequency ?? null
        } else {
          const detector = detectors().find(
            (d) => d.algorithm === selectedAlgorithm(),
          )
          detector?.reset()
          let result: PitchDetectionResult | null
          const asyncDetector = detector as {
            detectAsync?: (
              data: Float32Array,
            ) => Promise<PitchDetectionResult | null>
          }
          if (asyncDetector.detectAsync) {
            result = await asyncDetector.detectAsync(wave)
          } else {
            result = detector!.detect(wave)
          }
          detectedFreq = result?.frequency ?? null
        }

        const errorHz =
          detectedFreq !== null ? Math.abs(detectedFreq - freq) : null
        const errorCents =
          detectedFreq !== null ? centsError(detectedFreq, freq) : null
        const isPass = errorCents !== null && errorCents <= centsThreshold()

        if (isPass) {
          passed++
        } else {
          errors.push(index)
        }

        noteResults.push({
          noteName: TEST_NOTE_NAMES[index] ?? '?',
          targetFreq: freq,
          passed: isPass,
          detectedFreq,
          errorCents,
          errorHz,
        })

        setTestResults({
          passed,
          failed: errors.length,
          errors: [...errors],
          noteResults: [...noteResults],
        })

        // Yield to UI between notes so progress updates render
        await new Promise<void>((r) => setTimeout(r, 20))
      }
      setIsRunningTest(false)
    }
    void runAll()
  }

  // Stop everything — detection and/or running test
  const stopAll = () => {
    cancelTest = true
    setIsRunningTest(false)
    stopLiveDetection()
  }

  // Reset everything
  const resetAll = () => {
    cancelTest = true
    stopLiveDetection()
    detectors().forEach((d) => d.reset())
    setLiveResults([])
    setPitchSamples([])
    setTestResults({ passed: 0, failed: 0, errors: [], noteResults: [] })
    setEnsembleTickResults([])
    setTotalDetections(0)
    setAvgClarity(0)
    setAvgErrorHz(0)
    setIsRunningTest(false)
  }

  onCleanup(() => {
    stopLiveDetection()
    whisper.destroy()
  })

  // Memoized detector lookup to avoid reactivity loops
  const currentDetector = createMemo(() => {
    const selected = selectedAlgorithm()
    for (const d of detectors()) {
      if (d.algorithm === selected) return d
    }
    return undefined
  })

  // Use createMemo to get the current detector without calling find repeatedly
  const detectorForAlgorithm = createMemo(() => {
    const alg = selectedAlgorithm()
    return detectors().find((d) => d.algorithm === alg)
  })

  const toggleEnsembleAlgorithm = (algo: AlgorithmId) => {
    const current = new Set(ensembleAlgorithms())
    if (current.has(algo)) {
      if (current.size <= 2) return // minimum 2 for ensemble
      current.delete(algo)
    } else {
      current.add(algo)
    }
    setEnsembleAlgorithms(current)
  }

  // Ensemble voting: run all selected algorithms on the same data,
  // vote on note name, pick majority winner with confidence tiebreaker.
  const ensembleDetect = (
    dataArray: Float32Array,
  ): {
    result: PitchDetectionResult | null
    perAlgorithm: EnsembleTickResult[]
    votes: Record<string, { count: number; algos: string[]; avgFreq: number }>
  } => {
    const activeDetectors = detectors().filter((d) =>
      ensembleAlgorithms().has(d.algorithm as AlgorithmId),
    )
    const perAlgorithm: EnsembleTickResult[] = []

    for (const det of activeDetectors) {
      const r = det.detect(dataArray)
      perAlgorithm.push({ algorithm: det.algorithm as AlgorithmId, result: r })
    }

    // Vote by note name
    const votes: Record<
      string,
      { count: number; algos: string[]; freqs: number[]; clarities: number[] }
    > = {}
    for (const item of perAlgorithm) {
      if (typeof item.result?.noteName !== 'string') continue
      const note = item.result.noteName
      if (!(note in votes))
        votes[note] = { count: 0, algos: [], freqs: [], clarities: [] }
      votes[note].count++
      votes[note].algos.push(item.algorithm)
      votes[note].freqs.push(item.result.frequency)
      votes[note].clarities.push(item.result.clarity)
    }

    const entries = Object.entries(votes)
    if (entries.length === 0) {
      return { result: null, perAlgorithm, votes: {} }
    }

    // Sort by votes (desc), then avg clarity (desc) as tiebreaker
    entries.sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count
      const avgA =
        a[1].clarities.reduce((s, v) => s + v, 0) / a[1].clarities.length
      const avgB =
        b[1].clarities.reduce((s, v) => s + v, 0) / b[1].clarities.length
      return avgB - avgA
    })

    const [winningNote, winningData] = entries[0]!
    const avgFreq =
      winningData.freqs.reduce((s, v) => s + v, 0) / winningData.freqs.length
    const agreement = winningData.count / perAlgorithm.length

    // Build simplified votes for display
    const displayVotes: Record<
      string,
      { count: number; algos: string[]; avgFreq: number }
    > = {}
    for (const [note, data] of entries) {
      displayVotes[note] = {
        count: data.count,
        algos: data.algos,
        avgFreq: data.freqs.reduce((s, v) => s + v, 0) / data.freqs.length,
      }
    }

    // Build ensemble result
    const midi = 69 + 12 * Math.log2(avgFreq / 440)
    const result: PitchDetectionResult = {
      frequency: avgFreq,
      clarity: agreement,
      noteName: winningNote,
      octave: Math.floor(midi / 12) - 1,
      cents: (midi - Math.round(midi)) * 100,
      midi: Math.round(midi),
      timestamp: performance.now(),
      computationTime: perAlgorithm.reduce(
        (s, p) => s + (p.result?.computationTime ?? 0),
        0,
      ),
    }

    return { result, perAlgorithm, votes: displayVotes }
  }

  // Latest valid result from liveResults (for reactive metrics panel)
  const latestResult = createMemo(() => {
    const results = liveResults()
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i]) return results[i]
    }
    return null
  })

  return (
    <div class={styles.pitchTestingTab}>
      <div class={styles.pitchTestingHeader}>
        <h2>Pitch Detection Testing</h2>
        {props.onClose && (
          <button class={styles.closeBtn} onclick={props.onClose}>
            ×
          </button>
        )}
      </div>

      <div class={styles.pitchTestingLayout}>
        {/* Left Panel - Controls */}
        <div class={styles.pitchTestingControls}>
          <div class={styles.controlGroup}>
            <div class={styles.algorithmHeaderRow}>
              <label>Algorithm</label>
              <label class={styles.ensembleToggleLabel}>
                <input
                  type="checkbox"
                  checked={ensembleMode()}
                  disabled={isDetecting() || isRunningTest()}
                  onChange={(e) => setEnsembleMode(e.currentTarget.checked)}
                />
                <span class={styles.ensembleToggleText}>Ensemble</span>
              </label>
            </div>
            <Show
              when={ensembleMode()}
              fallback={
                <SafeSelect
                  disabled={isDetecting() || isRunningTest()}
                  value={selectedAlgorithm()}
                  onChange={(e) =>
                    setSelectedAlgorithm(e.currentTarget.value as AlgorithmId)
                  }
                >
                  <option value="yin">YIN Algorithm</option>
                  <option value="autocorr">Autocorrelation</option>
                  <option value="fft">FFT Max Bin</option>
                  <option value="swift">SwiftF0 ML (ONNX)</option>
                </SafeSelect>
              }
            >
              <div class={styles.ensemblePills}>
                <For each={detectors()}>
                  {(d) => {
                    const algo = d.algorithm as AlgorithmId
                    return (
                      <button
                        classList={{
                          'ensemble-pill': true,
                          selected: ensembleAlgorithms().has(algo),
                        }}
                        disabled={isDetecting() || isRunningTest()}
                        onClick={() => toggleEnsembleAlgorithm(algo)}
                      >
                        {d.getName()}
                      </button>
                    )
                  }}
                </For>
              </div>
            </Show>
          </div>

          <Show when={ensembleMode() || selectedAlgorithm() !== 'swift'}>
            <div class={styles.controlGroup}>
              <label>
                Sensitivity{' '}
                <span class={styles.sliderValueBadge}>{sensitivity()}</span>
              </label>
              <input
                type="range"
                class="sensitivity-slider"
                min="1"
                max="10"
                step="1"
                value={sensitivity()}
                disabled={isRunningTest()}
                onInput={(e) => {
                  const val = Number(e.currentTarget.value)
                  setSensitivity(val)
                  if (ensembleMode()) {
                    detectors().forEach((d) => d.setSensitivity(val))
                  } else {
                    detectorForAlgorithm()?.setSensitivity(val)
                  }
                }}
              />
              <div class={styles.sliderRangeLabels}>
                <span>1</span>
                <span>10</span>
              </div>
            </div>

            <div class={styles.controlGroup}>
              <label>
                Min Confidence{' '}
                <span class={styles.sliderValueBadge}>
                  {minConfidence().toFixed(1)}
                </span>
              </label>
              <input
                type="range"
                class="confidence-slider"
                min="0.1"
                max="0.9"
                step="0.05"
                value={minConfidence()}
                disabled={isRunningTest()}
                onInput={(e) => {
                  const val = Number(e.currentTarget.value)
                  setMinConfidence(val)
                  if (ensembleMode()) {
                    detectors().forEach((d) => d.setMinConfidence(val))
                  } else {
                    detectorForAlgorithm()?.setMinConfidence(val)
                  }
                }}
              />
              <div class={styles.sliderRangeLabels}>
                <span>0.1</span>
                <span>0.9</span>
              </div>
            </div>
          </Show>

          <div class={styles.controlGroup}>
            <label>
              Cents Threshold{' '}
              <span class={styles.sliderValueBadge}>{centsThreshold()}¢</span>
            </label>
            <div class={styles.presetButtons}>
              <button
                class={`btn ${styles.btnPreset}`}
                classList={{ active: centsThreshold() === 0 }}
                disabled={isRunningTest()}
                onClick={() => setCentsThreshold(0)}
              >
                Perfect (0¢)
              </button>
              <button
                class={`btn ${styles.btnPreset}`}
                classList={{ active: centsThreshold() === 5 }}
                disabled={isRunningTest()}
                onClick={() => setCentsThreshold(5)}
              >
                Great (±5¢)
              </button>
              <button
                class={`btn ${styles.btnPreset}`}
                classList={{ active: centsThreshold() === 10 }}
                disabled={isRunningTest()}
                onClick={() => setCentsThreshold(10)}
              >
                Okay (±10¢)
              </button>
            </div>
            <input
              type="range"
              class="cents-threshold-slider"
              min="0"
              max="20"
              step="1"
              value={centsThreshold()}
              disabled={isRunningTest()}
              onInput={(e) => setCentsThreshold(Number(e.currentTarget.value))}
            />
            <div class={styles.sliderRangeLabels}>
              <span>0¢</span>
              <span>20¢</span>
            </div>
          </div>

          <div class={styles.controlGroup}>
            <label for="detection-mode-select">Detection Mode</label>
            <SafeSelect
              id="detection-mode-select"
              disabled={isDetecting() || isRunningTest()}
              value={detectionMode()}
              onChange={(e) =>
                setDetectionMode(e.currentTarget.value as DetectionMode)
              }
            >
              <option value="generate">Generate Sine Wave</option>
              <option value="file">Load Audio File</option>
              <option value="mic">Microphone Input</option>
            </SafeSelect>
          </div>

          {/* Microphone Mode UI */}
          <Show when={detectionMode() === 'mic'}>
            <div class={styles.micControls}>
              {!audioContext() && (
                <>
                  <button
                    class={`btn ${styles.btnPrimary} ${styles.btnSm}`}
                    onclick={() => void startMicrophoneInput()}
                  >
                    Enable Microphone
                  </button>
                  <span class={styles.micHint}>
                    Allows live testing with your voice or instrument
                  </span>
                </>
              )}
              {audioContext() && (
                <button
                  class={`btn ${styles.btnSecondary} ${styles.btnSm}`}
                  onclick={stopMicrophoneInput}
                >
                  Stop Microphone
                </button>
              )}
              {audioContext() && (
                <span class={`${styles.micStatus} active`}>
                  Microphone Active
                </span>
              )}
              {!audioContext() && (
                <span class={styles.micStatus}>Microphone Inactive</span>
              )}
            </div>
          </Show>

          {/* File Upload Mode UI */}
          <Show when={detectionMode() === 'file'}>
            <div
              class={styles.fileControls}
              style={{
                display: 'flex',
                'flex-direction': 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '12px',
                  'flex-wrap': 'nowrap',
                  overflow: 'hidden',
                }}
              >
                <label
                  class={`btn ${styles.btnSecondary} ${styles.btnSm}`}
                  style={{
                    display: 'inline-flex',
                    'align-items': 'center',
                    'justify-content': 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    margin: 0,
                    'white-space': 'nowrap',
                    'flex-shrink': 0,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Browse Audio
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              <Show when={fileWaveform()}>
                <div
                  style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap' }}
                >
                  <button
                    class={`btn ${styles.btnPrimary} ${styles.btnSm}`}
                    onclick={() => {
                      void analyzeUploadedAudio()
                    }}
                    disabled={isAnalyzingOffline() || isSeparating()}
                  >
                    {isAnalyzingOffline()
                      ? `Processing... ${Math.round(offlineProgress())}%`
                      : 'Analyze Pitch'}
                  </button>
                  <button
                    class={`btn ${styles.btnOutline} ${styles.btnSm}`}
                    style={{ transition: 'all 0.2s', cursor: 'pointer' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.filter = 'brightness(1.2)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.filter = 'none')
                    }
                    onclick={() => {
                      void separateVocalsFirst()
                    }}
                    disabled={
                      isAnalyzingOffline() ||
                      isSeparating() ||
                      activeTrack()?.isVocalStem === true
                    }
                  >
                    {activeTrack()?.isVocalStem === true
                      ? 'Using Vocal Stem'
                      : isSeparating()
                        ? `Separating... ${Math.round(offlineProgress() * 2)}%`
                        : 'Separate Vocals First'}
                  </button>
                  <Show when={isSeparating()}>
                    <button
                      class={`btn ${styles.btnSm}`}
                      style={{
                        background: 'var(--danger)',
                        color: 'white',
                        border: 'none',
                      }}
                      onClick={() =>
                        cancelUvrPipeline(
                          getUvrProcessingMode(),
                          activeUvrSessionId(),
                        )
                      }
                    >
                      Cancel Separation
                    </button>
                  </Show>
                  <Show
                    when={
                      (activeTrack()?.analysisResults?.length ?? 0) > 0 &&
                      activeTrack()?.fileHash
                    }
                  >
                    <button
                      class={`btn ${styles.btnSm}`}
                      style={{
                        background: 'var(--danger)',
                        color: 'white',
                        border: 'none',
                      }}
                      onClick={() => {
                        const track = activeTrack()
                        const fileHash = track?.fileHash
                        if (!track || fileHash == null || fileHash === '')
                          return
                        void (async () => {
                          await deleteOfflineAnalysis(fileHash)
                          setAnalyzedTracks((prev) =>
                            prev.map((t) =>
                              t.id === track.id
                                ? {
                                    ...t,
                                    analysisResults: [],
                                    lrcLines: undefined,
                                    segmentedNotes: undefined,
                                  }
                                : t,
                            ),
                          )
                        })()
                      }}
                    >
                      Clear Analysis Cache
                    </button>
                  </Show>
                </div>
              </Show>
              <Show when={!fileWaveform()}>
                <span class={styles.fileInfo}>No file loaded</span>
              </Show>
            </div>
          </Show>

          {/* Generate Mode UI */}
          <Show when={detectionMode() === 'generate'}>
            <div class={styles.generateControls}>
              <button
                class={`btn ${styles.btnSecondary} ${styles.btnSm}`}
                onclick={loadGeneratedWaveform}
              >
                Regenerate Waveform
              </button>
              <span class={styles.waveformInfo}>
                Generated: {frequency()} Hz • 0.5 s
              </span>
            </div>
          </Show>

          <div class={styles.controlGroup}>
            <label>Test Frequency (Hz)</label>
            <input
              type="number"
              value={frequency()}
              onChange={(e) => setFrequency(Number(e.currentTarget.value))}
              step="0.01"
            />
            <input
              type="range"
              class={styles.freqSlider}
              min="0"
              max={FREQ_SLIDER_STEPS}
              value={freqToSliderVal(frequency())}
              disabled={isRunningTest()}
              onInput={(e) => {
                setFrequency(sliderValToFreq(Number(e.currentTarget.value)))
              }}
            />
            <span class={styles.controlHint}>{frequency()} Hz</span>
          </div>

          <button
            class={`btn ${styles.btnPrimary}`}
            onclick={startLiveDetection}
            disabled={isDetecting() || isRunningTest()}
          >
            {isDetecting() ? 'Detecting...' : 'Start Detection'}
          </button>

          <button
            class={`btn ${styles.btnSecondary}`}
            onclick={stopAll}
            disabled={!isDetecting() && !isRunningTest()}
          >
            Stop
          </button>

          <button
            class={`btn ${styles.btnTest}`}
            onclick={runTest}
            disabled={isRunningTest() || isDetecting()}
          >
            {isRunningTest() ? 'Running Test...' : 'Run Benchmark'}
          </button>

          <button class={`btn ${styles.btnOutline}`} onclick={resetAll}>
            Reset All
          </button>
        </div>

        {/* Right Panel - Visualization */}
        <div class={styles.pitchTestingVisualization}>
          {/* Live Detection Display */}
          <Show when={isDetecting()}>
            <div class={styles.detectionPanel}>
              <h3>Live Detection</h3>

              <Show when={ensembleMode() && ensembleTickResults().length > 0}>
                <div class={styles.ensembleVoteBar}>
                  <For each={ensembleTickResults()}>
                    {(item) => (
                      <div
                        classList={{
                          [styles.ensembleVoteChip]: true,
                          [styles.detected]: item.result !== null,
                          [styles.noDetect]: item.result === null,
                        }}
                      >
                        <span class={styles.voteChipAlgo}>
                          {item.algorithm}
                        </span>
                        <span class={styles.voteChipNote}>
                          {item.result?.noteName ?? '—'}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              <div class={styles.metricsGrid}>
                <div class={styles.metricItem}>
                  <span class={styles.metricLabel}>Status</span>
                  <span class={styles.metricValue}>
                    {latestResult() ? 'detected' : 'listening...'}
                  </span>
                </div>
                <div class={styles.metricItem}>
                  <span class={styles.metricLabel}>Frequency</span>
                  <span class={styles.metricValue}>
                    {latestResult()?.frequency.toFixed(2) ?? '—'} Hz
                  </span>
                </div>
                <div class={styles.metricItem}>
                  <span class={styles.metricLabel}>Note</span>
                  <span class={styles.metricValue}>
                    {latestResult()?.noteName ?? '—'}
                  </span>
                </div>
                <div class={styles.metricItem}>
                  <span class={styles.metricLabel}>Midi</span>
                  <span class={styles.metricValue}>
                    {latestResult()?.midi.toFixed(0) ?? '—'}
                  </span>
                </div>
                <div class={styles.metricItem}>
                  <span class={styles.metricLabel}>Cents</span>
                  <span class={styles.metricValue}>
                    {latestResult()?.cents.toFixed(1) ?? '—'}
                  </span>
                </div>
                <div class={styles.metricItem}>
                  <span class={styles.metricLabel}>
                    {ensembleMode() ? 'Agreement' : 'Clarity'}
                  </span>
                  <span class={styles.metricValue}>
                    {latestResult()?.clarity.toFixed(2) ?? '—'}
                  </span>
                </div>
                <div class={styles.metricItem}>
                  <span class={styles.metricLabel}>Detections</span>
                  <span class={styles.metricValue}>
                    {liveResults().filter(Boolean).length}
                  </span>
                </div>
              </div>

              {/* Waveform and Frequency Over Time */}
              <div class={styles.waveformDisplay}>
                <div class={styles.waveformDisplayHeader}>
                  <h4>Detection Over Time</h4>
                  <div class={styles.zoomControls}>
                    <button
                      class={styles.zoomBtn}
                      onclick={zoomOut}
                      disabled={zoomLevel() <= 1}
                      title="Zoom out"
                    >
                      −
                    </button>
                    <span class={styles.zoomValue}>{zoomLevel()}x</span>
                    <button
                      class={styles.zoomBtn}
                      onclick={zoomIn}
                      disabled={zoomLevel() >= 8}
                      title="Zoom in"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div
                  class={styles.waveformCanvas}
                  style={{ height: `${waveformHeight}px` }}
                >
                  <div class={styles.waveformCanvasInner}>
                    <PitchOverTimeCanvas
                      samples={pitchSamples}
                      isDetecting={isDetecting}
                      visibleWindowSeconds={10}
                      zoomLevel={zoomLevel}
                      onZoomChange={setZoomLevel}
                      scaleNotes={currentScale}
                    />
                  </div>
                  <div
                    class={styles.resizeHandle}
                    onMouseDown={onResizeMouseDown}
                  >
                    <div class={styles.resizeGrip}>
                      <span class={styles.gripDash} />
                      <span class={styles.gripDash} />
                      <span class={styles.gripDash} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Show>

          {/* Offline File Analysis Display */}
          <Show
            when={
              detectionMode() === 'file' &&
              analyzedTracks().length > 0 &&
              !isDetecting()
            }
          >
            <div class={styles.resultsPanel}>
              <h4
                style={{
                  margin: '0 0 12px 0',
                  'font-size': '0.9rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Session Gallery
              </h4>
              <div class={styles.galleryContainer}>
                <For each={analyzedTracks()}>
                  {(track) => (
                    <div
                      classList={{
                        [styles.galleryItem]: true,
                        [styles.active]: activeTrackId() === track.id,
                      }}
                      onClick={() => setActiveTrackId(track.id)}
                    >
                      <div
                        style={{
                          display: 'flex',
                          'justify-content': 'space-between',
                          'align-items': 'center',
                        }}
                      >
                        <span
                          style={{
                            'font-size': '0.75rem',
                            'font-weight': '600',
                            overflow: 'hidden',
                            'text-overflow': 'ellipsis',
                            'white-space': 'nowrap',
                            'max-width': '140px',
                          }}
                        >
                          {track.file.name}
                        </span>
                        <button
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '0 4px',
                            'font-size': '1.1rem',
                            'line-height': '1',
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            const filtered = analyzedTracks().filter(
                              (t) => t.id !== track.id,
                            )
                            setAnalyzedTracks(filtered)
                            if (activeTrackId() === track.id) {
                              setActiveTrackId(filtered[0]?.id || null)
                            }
                          }}
                        >
                          ×
                        </button>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: '4px',
                          'flex-wrap': 'wrap',
                          'min-height': '18px',
                        }}
                      >
                        <For each={track.analysisResults}>
                          {(res) => (
                            <span
                              style={{
                                'font-size': '0.6rem',
                                padding: '2px 6px',
                                background: 'var(--bg-secondary-hover)',
                                'border-radius': '4px',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {res.algorithm.toUpperCase()}
                            </span>
                          )}
                        </For>
                        <Show when={track.analysisResults.length === 0}>
                          <span class={styles.tagEmpty}>No algorithms run</span>
                        </Show>
                      </div>
                      <div class={styles.galleryItemActions}>
                        <div class={styles.lyricsControls}>
                          <button
                            classList={{
                              [styles.lyricsBtn]: true,
                              [styles.lyricsBtnPrimary]: !!track.lrcLines,
                              [styles.lyricsBtnSecondary]: !track.lrcLines,
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              const input = document.createElement('input')
                              input.type = 'file'
                              input.accept = '.lrc,.txt'
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement)
                                  .files?.[0]
                                if (file) void handleLrcUpload(file, track.id)
                              }
                              input.click()
                            }}
                          >
                            <FileText />
                            {track.lrcLines
                              ? `Lyrics Loaded (${track.lrcLines.length} lines)`
                              : 'Add Lyrics (LRC)'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>

              <Show when={fileWaveform() !== null}>
                <div class={styles.waveformDisplay}>
                  <div
                    class={styles.waveformDisplayHeader}
                    style={{
                      display: 'flex',
                      'justify-content': 'space-between',
                      'align-items': 'center',
                      'margin-bottom': '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        gap: '12px',
                      }}
                    >
                      <h4 style={{ margin: 0, 'font-size': '0.85rem' }}>
                        {uploadedFile()?.name}
                      </h4>
                      <Show when={activeTrack()?.segmentedNotes}>
                        <label
                          style={{
                            display: 'flex',
                            'align-items': 'center',
                            gap: '6px',
                            'font-size': '0.75rem',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={showSegmentedNotes()}
                            onChange={(e) =>
                              setShowSegmentedNotes(e.currentTarget.checked)
                            }
                          />
                          Denoised Melody
                        </label>
                      </Show>
                      <Show when={activeTrack()?.segmentedNotes}>
                        <PitchCanvasToolbar
                          showNoteLabels={showNoteLabels}
                          setShowNoteLabels={setShowNoteLabels}
                          showLyricLabels={showLyricLabels}
                          setShowLyricLabels={setShowLyricLabels}
                        />
                      </Show>
                      <Show when={whisperStatus() === 'loading'}>
                        <span class="pitch-alignment-stats whisper-processing">
                          Downloading Model...{' '}
                          {Math.round(whisperProgress() ?? 0)}%
                        </span>
                      </Show>
                      <Show when={whisperStatus() === 'processing'}>
                        <span class="pitch-alignment-stats whisper-processing">
                          Transcribing
                          {transcribeElapsed() >= 0
                            ? ` (${transcribeElapsed()}s)`
                            : '...'}
                        </span>
                      </Show>
                      <Show when={whisperStatus() === 'ready'}>
                        <select
                          class="sm-whisper-lang-select"
                          value={whisper.language()}
                          onChange={(e) =>
                            whisper.setLanguage(e.currentTarget.value)
                          }
                          title="Whisper transcription language"
                        >
                          <option value="en">EN</option>
                          <option value="hr">HR</option>
                        </select>
                        <button
                          class="sm-transcribe-btn"
                          style={{ 'margin-left': 'auto' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            startWhisperTranscription()
                          }}
                          title="Transcribe words from vocal stem"
                        >
                          Transcribe
                        </button>
                      </Show>
                      <Show
                        when={
                          whisperStatus() === 'done' &&
                          activeAlignment().totalWords > 0
                        }
                      >
                        <span
                          class="pitch-alignment-stats"
                          title={`${activeAlignment().mappedWords} of ${activeAlignment().totalWords} words mapped to pitch`}
                        >
                          {Math.round(activeAlignment().accuracy * 100)}% mapped
                        </span>
                      </Show>
                    </div>
                    <span
                      style={{
                        'font-size': '0.75rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {fileDuration().toFixed(2)}s
                    </span>
                  </div>
                  <div
                    class={styles.waveformCanvas}
                    style={{ height: `${waveformHeight}px` }}
                  >
                    <div class={styles.waveformCanvasInner}>
                      <OfflinePitchCanvas
                        waveform={fileWaveform()}
                        durationSec={fileDuration()}
                        analysisResults={offlineAnalysisResults()}
                        segmentedNotes={currentSegmentedNotes()}
                        audioFile={uploadedFile()}
                        showNoteLabels={showNoteLabels()}
                        showLyricLabels={showLyricLabels()}
                        alignedWords={activeAlignment().alignedWords}
                      />
                    </div>
                    <div
                      class={styles.resizeHandle}
                      onMouseDown={onResizeMouseDown}
                    >
                      <div class={styles.resizeGrip}>
                        <span class={styles.gripDash} />
                        <span class={styles.gripDash} />
                        <span class={styles.gripDash} />
                      </div>
                    </div>
                  </div>
                </div>
              </Show>
            </div>
          </Show>

          {/* Test Results Display */}
          <Show when={testResults().noteResults.length > 0 || isRunningTest()}>
            <div class={styles.resultsPanel}>
              <h3>Test Results</h3>

              <Show when={isRunningTest()}>
                <p class={styles.testRunningHint}>
                  Running benchmark on {TEST_FREQUENCIES.length} notes with{' '}
                  {ensembleMode()
                    ? `${[...ensembleAlgorithms()].join(' + ')} ensemble`
                    : (currentDetector()?.getName() ?? selectedAlgorithm())}
                  ...
                </p>
              </Show>

              <Show
                when={!isRunningTest() && testResults().noteResults.length > 0}
              >
                <p class={styles.testDescription}>
                  {TEST_FREQUENCIES.length} pentatonic notes from C2 (65.41 Hz)
                  to C6 (1046.5 Hz), tested with{' '}
                  {ensembleMode()
                    ? `${[...ensembleAlgorithms()].join(' + ')} ensemble (majority vote)`
                    : (currentDetector()?.getName() ?? selectedAlgorithm())}
                  . Pass = detected within &plusmn;{centsThreshold()}¢ of
                  target.
                </p>
              </Show>

              <div class={styles.testSummaryBar}>
                <div class={styles.testSummaryItem}>
                  <span class={styles.testSummaryLabel}>Total</span>
                  <span class={styles.testSummaryValue}>
                    {testResults().passed + testResults().failed}
                  </span>
                </div>
                <div class={`${styles.testSummaryItem} passed`}>
                  <span class={styles.testSummaryLabel}>Passed</span>
                  <span class={styles.testSummaryValue}>
                    {testResults().passed}
                  </span>
                </div>
                <div class={`${styles.testSummaryItem} failed`}>
                  <span class={styles.testSummaryLabel}>Failed</span>
                  <span class={styles.testSummaryValue}>
                    {testResults().failed}
                  </span>
                </div>
                <Show when={testResults().passed + testResults().failed > 0}>
                  <div class={`${styles.testSummaryItem} rate`}>
                    <span class={styles.testSummaryLabel}>Rate</span>
                    <span class={styles.testSummaryValue}>
                      {(
                        (testResults().passed /
                          (testResults().passed + testResults().failed)) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                </Show>
              </div>

              <Show when={testResults().noteResults.length > 0}>
                <div class={styles.testTableScroll}>
                  <table class={styles.testResultsTable}>
                    <thead>
                      <tr>
                        <th>Note</th>
                        <th>Target (Hz)</th>
                        <th>Result (Hz)</th>
                        <th>Error</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={testResults().noteResults}>
                        {(nr) => (
                          <tr
                            classList={{
                              'row-pass': nr.passed,
                              'row-fail': !nr.passed,
                            }}
                          >
                            <td class={styles.testNoteName}>{nr.noteName}</td>
                            <td class={styles.testNoteFreq}>
                              {nr.targetFreq.toFixed(2)}
                            </td>
                            <td class={styles.testNoteResult}>
                              {nr.detectedFreq !== null
                                ? `${nr.detectedFreq.toFixed(1)}`
                                : '—'}
                            </td>
                            <td class={styles.testNoteError}>
                              {nr.errorCents !== null
                                ? `${nr.errorCents < 0.05 ? '0.0' : nr.errorCents.toFixed(1)}¢ / ${nr.errorHz!.toFixed(1)} Hz`
                                : '—'}
                            </td>
                            <td class={styles.testNoteStatus}>
                              <Show when={nr.passed}>
                                <span class={`${styles.resultBadge} pass`}>
                                  Pass
                                </span>
                              </Show>
                              <Show when={!nr.passed}>
                                <span class={`${styles.resultBadge} fail`}>
                                  Fail
                                </span>
                              </Show>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </div>
          </Show>

          {/* Algorithm Info */}
          <Show
            when={!ensembleMode() && currentDetector() !== undefined}
            fallback={
              <Show when={ensembleMode()}>
                <div class={styles.infoPanel}>
                  <Show when={isSeparating()}>
                    <div
                      class="processing-progress"
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        gap: '10px',
                      }}
                    >
                      <span class={styles.progressText}>
                        Separating... {Math.round(offlineProgress())}%
                      </span>
                      <button
                        class={`btn ${styles.btnSecondary}`}
                        style={{ padding: '4px 8px', 'font-size': '12px' }}
                        onClick={() =>
                          cancelUvrPipeline(
                            getUvrProcessingMode(),
                            activeUvrSessionId(),
                          )
                        }
                      >
                        Cancel
                      </button>
                    </div>
                  </Show>
                  <h3>Ensemble Mode</h3>
                  <p>
                    {[...ensembleAlgorithms()]
                      .map((a) => {
                        const d = detectors().find((dd) => dd.algorithm === a)
                        return d?.getName() ?? a
                      })
                      .join(' + ')}{' '}
                    — majority vote on detected note name. Highest agreement
                    wins; clarity breaks ties.
                  </p>
                  <Show when={ensembleTickResults().length > 0}>
                    <div class={styles.lastResult}>
                      <h4>Last Tick Per-Algorithm</h4>
                      <div class={styles.resultDetails}>
                        <For each={ensembleTickResults()}>
                          {(item) => (
                            <div>
                              <strong>{item.algorithm}:</strong>{' '}
                              {item.result
                                ? `${item.result.frequency.toFixed(1)} Hz (${item.result.noteName}, clarity ${item.result.clarity.toFixed(2)})`
                                : 'no detection'}
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                </div>
              </Show>
            }
          >
            <div class={styles.infoPanel}>
              <h3>{currentDetector()?.getName()}</h3>
              <p>{currentDetector()?.getDescription()}</p>

              {currentDetector()?.getMetrics().lastResult !== null && (
                <div class={styles.lastResult}>
                  <h4>Last Detection</h4>
                  <div class={styles.resultDetails}>
                    <div>
                      Frequency:{' '}
                      {currentDetector()
                        ?.getMetrics()
                        .lastResult!.frequency.toFixed(4)}{' '}
                      Hz
                    </div>
                    <div>
                      Note:{' '}
                      {currentDetector()?.getMetrics().lastResult!.noteName}
                    </div>
                    <div>
                      Midi:{' '}
                      {currentDetector()
                        ?.getMetrics()
                        .lastResult!.midi.toFixed(2)}
                    </div>
                    <div>
                      Cents:{' '}
                      {currentDetector()
                        ?.getMetrics()
                        .lastResult!.cents.toFixed(4)}
                    </div>
                    <div>
                      Clarity:{' '}
                      {currentDetector()
                        ?.getMetrics()
                        .lastResult!.clarity.toFixed(4)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
