// ============================================================
// VocalAnalysis — Vocal Analysis & Training Tab
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { AnnotationControls } from '@/components/AnnotationControls'
import { AnnotationLayer } from '@/components/AnnotationLayer'
import { IconPlay } from '@/components/hidden-features-icons'
import { useEngines } from '@/contexts/EngineContext'
import { loadSessionRecords } from '@/db/services/session-service'
import { authVersion } from '@/db/services/user-service'
import { AlignClient, OnsetClient } from '@/lib/analysis-clients'
import { computeNNLSChroma, detectChords, simplifyChordSequence, } from '@/lib/chord-detector'
import type { ColourMapId } from '@/lib/colour-maps'
import { nextColourMap } from '@/lib/colour-maps'
import { IS_DEV } from '@/lib/defaults'
import { computeCentsDeviation, midiToNoteName } from '@/lib/frequency-to-note'
import { detectKeyFromSpectra } from '@/lib/key-detector'
import type { LiveAnalysisSnapshot, LivePitchSample, } from '@/lib/live-pitch-analysis'
import { analyzeLiveBuffer } from '@/lib/live-pitch-analysis'
import { PitchDetector } from '@/lib/pitch-detector'
import { segmentAudio } from '@/lib/segmenter'
import { SpectralClient } from '@/lib/spectral-client'
import type { WindowType } from '@/lib/stft-engine'
import { getTransforms, registerBuiltinTransforms, } from '@/lib/transform-registry'
import { generateMockSessions } from '@/lib/vocal-analysis-mock'
import type { BreathinessResult, FatigueCheckpoint, FatigueResult, HarmonicRichnessResult, ResonanceResult, SlideTrackingResult, VibratoResult, } from '@/lib/vocal-analyzer'
import { analyzeFatigue, approximateBreathiness, approximateResonance, approximateRichness, computePitchStability, detectSlides, detectVibrato, intensityFromPitchResults, } from '@/lib/vocal-analyzer'
import { getSessionHistory } from '@/stores'
import { annotations, createTimeInstant, setAnnotations, } from '@/stores/annotation-store'
import { paneLayout, setPaneLayout } from '@/stores/pane-layout-store'
import { setBpm } from '@/stores/transport-store'
import type { AlignmentResult, ChordFrame, KeyResult, OnsetResult, PitchResult, SegmentationResult, SessionResult, } from '@/types'
import { CentsDeviationCanvas } from './CentsDeviationCanvas'
import type { PitchTracePoint } from './MultiPaneView'
import { MultiPaneView } from './MultiPaneView'
import { ProDashboard } from './ProDashboard/ProDashboard'
import type { NormalizeMode } from './SpectrogramCanvas'
import { SpectrogramCanvas } from './SpectrogramCanvas'
import { TransformRunner } from './TransformRunner'
import { UnitConverter } from './UnitConverter'
import { VibratoWaveformCanvas } from './VibratoWaveformCanvas'

// ============================================================
// SVG Icons
// ============================================================

const IconBolt = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)
const IconWind = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
  </svg>
)
const IconChartLine = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
)
const IconChartBar = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <line x1="18" x2="18" y1="20" y2="10" />
    <line x1="12" x2="12" y1="20" y2="4" />
    <line x1="6" x2="6" y1="20" y2="14" />
  </svg>
)
const IconGuitar = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
)
const IconKeyboard = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M6 8h.01" />
    <path d="M10 8h.01" />
    <path d="M14 8h.01" />
    <path d="M18 8h.01" />
    <path d="M6 12h.01" />
    <path d="M10 12h.01" />
    <path d="M14 12h.01" />
    <path d="M18 12h.01" />
    <path d="M7 16h10" />
  </svg>
)
const IconFire = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3.3.4.5.7 1.3 1 2.3z" />
  </svg>
)
const IconMic = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="23" />
    <line x1="8" x2="16" y1="23" y2="23" />
  </svg>
)

// ============================================================
// Types
// ============================================================

export type VocalExerciseType =
  | 'belting'
  | 'falsetto'
  | 'crescendo'
  | 'decrescendo'
  | 'riffs'
  | 'runs'

export interface ExerciseCheck {
  type: VocalExerciseType
  passed: boolean
  confidence: number
  feedback: string
  metrics: {
    noteCount: number
    minFreq: number
    maxFreq: number
    avgVolume: number
  }
}

export interface SpectrumData {
  frequency: number
  amplitude: number
  phase: number
}

type AnalysisMode = 'history' | 'live'

// ============================================================
// Component
// ============================================================

export const VocalAnalysis: Component = () => {
  // ── Engine refs (must be declared before any createMemo) ────
  let engines: ReturnType<typeof useEngines> | null = null
  let spectralClient: SpectralClient | null = null
  // Try to get engine context (may fail outside EngineProvider)
  try {
    engines = useEngines()
  } catch {
    engines = null
  }

  const [activeExercise, setActiveExercise] =
    createSignal<VocalExerciseType | null>(null)
  const [spectralData, setSpectralData] = createSignal<SpectrumData[]>([])
  const [vocalRunData, setVocalRunData] = createSignal<PitchResult[]>([])
  const [isAnalyzing, setIsAnalyzing] = createSignal(false)
  const [dbSessionRecords, setDbSessionRecords] = createSignal<SessionResult[]>(
    [],
  )

  // Phase 1 analysis signals
  const [intensityProfile, setIntensityProfile] = createSignal<{
    avgDb: number
    peakDb: number
    dynamicRange: number
  } | null>(null)
  const [breathiness, setBreathiness] = createSignal<BreathinessResult | null>(
    null,
  )
  const [slideTracking, setSlideTracking] =
    createSignal<SlideTrackingResult | null>(null)

  // Phase 2 analysis signals
  const [vibratoAnalysis, setVibratoAnalysis] =
    createSignal<VibratoResult | null>(null)
  const [harmonicRichness, setHarmonicRichness] =
    createSignal<HarmonicRichnessResult | null>(null)
  const [resonanceData, setResonanceData] =
    createSignal<ResonanceResult | null>(null)
  const [fatigueData, setFatigueData] = createSignal<FatigueResult | null>(null)

  // Spectral Worker Output
  const [spectralMagnitude, setSpectralMagnitude] =
    createSignal<Float32Array | null>(null)
  const [spectralPhase, setSpectralPhase] = createSignal<Float32Array | null>(
    null,
  )
  const [currentCentsOffset, setCurrentCentsOffset] = createSignal<
    number | null
  >(null)
  const [currentTargetNote, setCurrentTargetNote] = createSignal<string | null>(
    null,
  )
  const [pitchStability, setPitchStability] = createSignal<number | null>(null)

  // ── Live Mic Mode State ────────────────────────────────────
  const [analysisMode, setAnalysisMode] = createSignal<AnalysisMode>('history')
  const [dashboardTab, setDashboardTab] = createSignal<
    'standard' | 'pro' | 'panes'
  >('standard')
  const [colourMap, setColourMap] = createSignal<ColourMapId>(
    (localStorage.getItem('pitchperfect_colour_map') as ColourMapId) ??
      'viridis',
  )
  const cycleColourMap = () => {
    const next = nextColourMap(colourMap())
    setColourMap(next)
    localStorage.setItem('pitchperfect_colour_map', next)
  }
  const [peakBinsOnly, setPeakBinsOnly] = createSignal(false)
  const [normalizeMode, setNormalizeMode] =
    createSignal<NormalizeMode>('column')
  const cycleNormalizeMode = () => {
    const modes: NormalizeMode[] = ['column', 'view', 'hybrid']
    const idx = modes.indexOf(normalizeMode())
    setNormalizeMode(modes[(idx + 1) % modes.length])
  }
  const [colourRotation, setColourRotation] = createSignal(0)
  const [showHarmonicCursor, setShowHarmonicCursor] = createSignal(false)
  const [hoverFrequency, setHoverFrequency] = createSignal<number | null>(null)
  const [vocalRangeOnly, setVocalRangeOnly] = createSignal(false)
  const [playheadPosition, setPlayheadPosition] = createSignal(0)

  const [windowType, setWindowType] = createSignal<WindowType>(
    (localStorage.getItem('pitchperfect_stft_window') as WindowType) ?? 'hann',
  )
  const cycleWindowType = () => {
    const windows: WindowType[] = ['hann', 'hamming', 'blackman-harris']
    const idx = windows.indexOf(windowType())
    const next = windows[(idx + 1) % windows.length]
    setWindowType(next)
    localStorage.setItem('pitchperfect_stft_window', next)
    spectralClient?.setWindowType(next)
  }

  // ── Annotations ────────────────────────────────────────────
  const [selectedAnnotationId, setSelectedAnnotationId] = createSignal<
    string | null
  >(null)
  /** Input ref for keyboard handler exclusion */
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.code === 'Space') {
      // Only if not typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      if (isLiveActive() || analysisMode() === 'live') {
        createTimeInstant(playheadPosition(), undefined)
      }
    }
  }
  const [isLiveActive, setIsLiveActive] = createSignal(false)
  const [livePitchBuffer, setLivePitchBuffer] = createSignal<LivePitchSample[]>(
    [],
  )
  const [liveError, setLiveError] = createSignal<string | null>(null)
  const [liveSnapshot, setLiveSnapshot] =
    createSignal<LiveAnalysisSnapshot | null>(null)
  const [demoLoaded, setDemoLoaded] = createSignal(false)
  const [micSpectrum, setMicSpectrum] = createSignal<Float32Array>(
    new Float32Array(0),
  )

  const micBars = createMemo(() => {
    const data = micSpectrum()
    if (data.length === 0) return []
    const bars: Array<{ height: number; active: boolean }> = []
    const step = Math.max(1, Math.floor(data.length / 24))
    for (let i = 0; i < 24; i++) {
      const idx = Math.min(i * step, data.length - 1)
      const normalized = (data[idx] + 100) / 100
      const height = Math.max(2, Math.min(100, normalized * 100))
      bars.push({ height, active: normalized > 0.15 })
    }
    return bars
  })

  // ── Phase 4: Analysis Tools state ────────────────────────────
  const [onsetResults, setOnsetResults] = createSignal<OnsetResult[]>([])
  const [detectedBpm, setDetectedBpm] = createSignal<number | null>(null)
  const [detectedKey, setDetectedKey] = createSignal<KeyResult | null>(null)
  const [alignmentResult, setAlignmentResult] =
    createSignal<AlignmentResult | null>(null)
  const [isDetecting, setIsDetecting] = createSignal(false)
  const [isAligning, setIsAligning] = createSignal(false)
  // Accumulated spectra buffers (for onset detection)
  const [accumulatedSpectra, setAccumulatedSpectra] = createSignal<
    Float32Array[]
  >([])

  // ── Phase 5: Advanced Features state ────────────────────────
  const [chordFrames, setChordFrames] = createSignal<ChordFrame[]>([])
  const [segmentationResult, setSegmentationResult] =
    createSignal<SegmentationResult | null>(null)
  const [availableTransforms, setAvailableTransforms] = createSignal(0)

  // ── MultiPaneView derived data ──────────────────────────────
  const panePitchHistory = createMemo<PitchTracePoint[]>(() => {
    const buffer = livePitchBuffer()
    return buffer.map((s) => {
      const midi = 69 + 12 * Math.log2(Math.max(1, s.frequency) / 440)
      return { time: s.timestamp, midi, clarity: s.clarity * 100 }
    })
  })

  const paneWaveformData = createMemo<Float32Array | null>(() => {
    if (!engines) return null
    try {
      return engines.audioEngine.getTimeData()
    } catch {
      return null
    }
  })

  const liveDuration = createMemo(() => {
    const buffer = livePitchBuffer()
    if (buffer.length > 0) return buffer[buffer.length - 1].timestamp + 2
    return 60
  })

  const panePlayheadPosition = createMemo(() => {
    if (liveDuration() <= 0) return 0
    const buffer = livePitchBuffer()
    return buffer[buffer.length - 1]?.timestamp ?? 0
  })

  // ── Live mode refs (engines + spectralClient declared at top) ──
  let pitchDetector: PitchDetector | null = null
  let rafId = 0
  let lastAnalysisTime = 0
  let recordingStartTime = 0
  let frameCount = 0

  // Load on mount and whenever the signed-in identity changes
  createEffect(() => {
    authVersion()
    void (async () => {
      try {
        const records = await loadSessionRecords(50)
        if (records.length > 0) {
          setDbSessionRecords(
            records.map((r) => ({
              sessionId: r.id,
              name: r.melodyName,
              sessionName: r.melodyName,
              completedAt: new Date(r.endedAt).getTime(),
              itemsCompleted: r.notesHit,
              practiceItemResult: [],
              totalItems: r.notesTotal,
              score: r.score,
            })),
          )
        }
      } catch {
        // IndexedDB not available — non-fatal
      }
    })()
  })

  // ── Live Mic Analysis ──────────────────────────────────────

  const startLiveAnalysis = async () => {
    if (!engines) {
      setLiveError(
        'Microphone access is only available from the main app (not in tests).',
      )
      return
    }

    setLiveError(null)
    setLivePitchBuffer([])
    setLiveSnapshot(null)

    try {
      const started = await engines.practiceEngine.startMic()
      if (!started) {
        setLiveError(
          'Could not access microphone. Please check permissions and try again.',
        )
        return
      }

      pitchDetector = new PitchDetector({
        sampleRate: engines.audioEngine.getSampleRate(),
        bufferSize: 2048,
        minConfidence: 0.4,
        minAmplitude: 0.02,
      })

      spectralClient = new SpectralClient()
      spectralClient.setCallback((result) => {
        setSpectralMagnitude(result.magnitudeSpectrum)
        if (result.phaseSpectrum) setSpectralPhase(result.phaseSpectrum)
        setBreathiness(result.breathiness)
        setHarmonicRichness(result.richness)
        setResonanceData(result.resonance)
        // Accumulate for onset detection (keep last ~600 frames ≈ 30s at 50ms)
        setAccumulatedSpectra((prev) => {
          const next = [...prev, result.magnitudeSpectrum]
          return next.length > 600 ? next.slice(-600) : next
        })
      })

      setIsLiveActive(true)
      recordingStartTime = performance.now()
      lastAnalysisTime = recordingStartTime

      const tick = () => {
        if (!isLiveActive()) return

        frameCount++
        const timeData = engines!.audioEngine.getTimeData()
        const now = performance.now()
        const elapsed = (now - recordingStartTime) / 1000
        setPlayheadPosition(elapsed)

        let currentDetectedFreq: number | null = null

        if (timeData.length > 0) {
          const detected = pitchDetector!.detect(timeData)
          if (
            detected !== null &&
            detected.clarity > 0.3 &&
            detected.frequency > 65
          ) {
            currentDetectedFreq = detected.frequency
            const sample: LivePitchSample = {
              frequency: detected.frequency,
              clarity: detected.clarity,
              amplitude: rmsAmplitude(timeData),
              noteName: detected.noteName,
              timestamp: elapsed,
            }
            setLivePitchBuffer((prev) => {
              const next = [...prev, sample]
              if (next.length > 2000) return next.slice(-1500)
              return next
            })
          }
        }

        // Update frequency spectrum every 4th frame (~15fps)
        if (frameCount % 4 === 0) {
          const freqData = engines!.audioEngine.getFrequencyData()
          if (freqData.length > 0) {
            setMicSpectrum(new Float32Array(freqData))
          }

          if (timeData.length > 0 && currentDetectedFreq !== null) {
            spectralClient?.analyzeFrame(
              timeData,
              engines!.audioEngine.getSampleRate(),
              currentDetectedFreq,
            )

            const buffer = livePitchBuffer()
            const stabilityHist = buffer.map((s) => {
              const midi = 69 + 12 * Math.log2(Math.max(1, s.frequency) / 440)
              return { time: s.timestamp, midi, clarity: s.clarity }
            })
            setPitchStability(computePitchStability(stabilityHist))

            const midiPitch =
              69 + 12 * Math.log2(Math.max(1, currentDetectedFreq) / 440)
            const targetNoteName = midiToNoteName(Math.round(midiPitch))
            setCurrentCentsOffset(computeCentsDeviation(midiPitch))
            setCurrentTargetNote(targetNoteName)
          } else {
            setCurrentCentsOffset(null)
          }
        }

        // Run full analysis every ~2 seconds
        if (now - lastAnalysisTime > 2000) {
          lastAnalysisTime = now
          const buffer = livePitchBuffer()
          if (buffer.length > 10) {
            setLiveSnapshot(analyzeLiveBuffer(buffer))

            // Wire live buffer → vocalRunData for exercise checks
            const pitchResults: PitchResult[] = buffer.map((s) => {
              const midi = 69 + 12 * Math.log2(Math.max(1, s.frequency) / 440)
              return {
                freq: s.frequency,
                midi,
                note: s.noteName || '',
                noteName: s.noteName || '',
                targetMidi: midi,
                targetNote: s.noteName || '',
                cents: 0,
                frequency: s.frequency,
                clarity: s.clarity * 100,
                octave: Math.floor(midi / 12) - 1,
              }
            })
            setVocalRunData(pitchResults)

            const vibrato = detectVibrato(
              pitchResults.map((p, i) => ({
                time: buffer[i].timestamp,
                freq: p.freq,
                midi: p.midi,
              })),
            )
            setVibratoAnalysis(vibrato)

            // Update spectrogram from live mic spectrum
            const freqData = engines!.audioEngine.getFrequencyData()
            if (freqData.length > 0) {
              const spectral: SpectrumData[] = []
              const NUM_BINS = 64
              const step = Math.max(1, Math.floor(freqData.length / NUM_BINS))
              for (let i = 0; i < NUM_BINS; i++) {
                const idx = Math.min(i * step, freqData.length - 1)
                spectral.push({
                  frequency: (idx / freqData.length) * 8000,
                  amplitude: Math.max(0, (freqData[idx] + 100) * 1.5),
                  phase: (i / NUM_BINS) * Math.PI * 2,
                })
              }
              setSpectralData(spectral)
            }
          }
        }

        rafId = requestAnimationFrame(tick)
      }

      rafId = requestAnimationFrame(tick)
    } catch (err) {
      setLiveError(
        `Microphone error: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  const stopLiveAnalysis = () => {
    setIsLiveActive(false)
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    if (engines) {
      engines.practiceEngine.stopMic()
    }
    pitchDetector = null
    if (spectralClient) {
      spectralClient.destroy()
      spectralClient = null
    }
    frameCount = 0
    // Keep buffer + snapshot for display
  }

  // ── Phase 4: Analysis tool handlers ──────────────────────────

  let onsetClient: OnsetClient | null = null
  let alignClient: AlignClient | null = null

  const handleDetectBeats = () => {
    const spectra = accumulatedSpectra()
    if (spectra.length < 10) return
    setIsDetecting(true)
    if (onsetClient) onsetClient.destroy()
    const sampleRate = engines?.audioEngine.getSampleRate() ?? 44100
    onsetClient = new OnsetClient(
      (result) => {
        setOnsetResults(result.onsets)
        setDetectedBpm(result.bpm)
        setIsDetecting(false)
      },
      () => setIsDetecting(false),
    )
    // hopSize: 2048 samples / sampleRate
    const hopSize = 2048
    onsetClient.detect(spectra, sampleRate, hopSize)
  }

  const handleDetectKey = () => {
    const spectra = accumulatedSpectra()
    if (spectra.length < 10) return
    setIsDetecting(true)
    // Run synchronously (fast enough for typical spectra counts)
    const sampleRate = engines?.audioEngine.getSampleRate() ?? 44100
    setTimeout(() => {
      try {
        const result = detectKeyFromSpectra(spectra, sampleRate, 2048)
        setDetectedKey(result)
      } catch {
        /* ignore */
      }
      setIsDetecting(false)
    }, 0)
  }

  const handleAlign = () => {
    const spectra = accumulatedSpectra()
    if (spectra.length < 10) return
    setIsAligning(true)

    // Use accumulated spectra as the "user" recording
    // In a real scenario, users would load a reference track
    // For now, auto-generate a synthetic reference by time-stretching
    const sampleRate = engines?.audioEngine.getSampleRate() ?? 44100

    setTimeout(() => {
      try {
        // Build a synthetic reference from the same spectra (shifted)
        // Actual use case: user loads reference track via file picker
        const chroma = spectra.map((s) => {
          // Convert magnitude spectrum to chroma
          const avg = new Float32Array(12)
          for (let i = 0; i < s.length; i++) {
            const freq = (i / s.length) * (sampleRate / 2)
            if (freq > 65) {
              const midi = 69 + 12 * Math.log2(Math.max(1, freq) / 440)
              const pc = Math.round(midi) % 12
              const p = pc < 0 ? pc + 12 : pc
              avg[p] += s[i]
            }
          }
          const total = avg.reduce((a, b) => a + b, 0)
          if (total > 0) for (let j = 0; j < 12; j++) avg[j] /= total
          return avg
        })

        if (chroma.length < 5) {
          setIsAligning(false)
          return
        }

        // Use onset worker to align (for simplicity, align chroma to itself with shift)
        if (alignClient) alignClient.destroy()
        alignClient = new AlignClient(
          (result) => {
            setAlignmentResult(result)
            setIsAligning(false)
          },
          () => setIsAligning(false),
        )
        // For demonstration: align against a time-stretched version
        const stretched = chroma.slice(0, Math.floor(chroma.length * 0.9))
        alignClient.align(chroma, stretched)
      } catch {
        setIsAligning(false)
      }
    }, 0)
  }

  // ── Phase 5: Advanced feature handlers ──────────────────────

  const handleDetectChords = () => {
    const spectra = accumulatedSpectra()
    if (spectra.length < 10) return
    setIsDetecting(true)
    setTimeout(() => {
      try {
        const sampleRate = engines?.audioEngine.getSampleRate() ?? 44100
        const chromaFrames = spectra.map((s) =>
          computeNNLSChroma(s, sampleRate, 2048),
        )
        const hopSize = 2048 / sampleRate
        const chords = detectChords(chromaFrames, hopSize, {
          medianWindow: 3,
          minDuration: 0.25,
        })
        const simplified = simplifyChordSequence(chords)
        setChordFrames(simplified)
      } catch {
        /* ignore */
      }
      setIsDetecting(false)
    }, 0)
  }

  const handleSegment = () => {
    const spectra = accumulatedSpectra()
    if (spectra.length < 20) return
    setIsDetecting(true)
    setTimeout(() => {
      try {
        const sampleRate = engines?.audioEngine.getSampleRate() ?? 44100
        const result = segmentAudio(spectra, sampleRate, 2048, {
          minSegmentDuration: 4,
          maxSegments: 12,
        })
        setSegmentationResult(result)
      } catch {
        /* ignore */
      }
      setIsDetecting(false)
    }, 0)
  }

  // Register built-in transforms on first render
  let transformsRegistered = false
  if (!transformsRegistered) {
    registerBuiltinTransforms()
    setAvailableTransforms(getTransforms().length)
    transformsRegistered = true
  }

  onCleanup(() => {
    if (isLiveActive()) stopLiveAnalysis()
    window.removeEventListener('keydown', handleKeyDown)
    onsetClient?.destroy()
    alignClient?.destroy()
  })

  // Attach keyboard listener for annotation tap-to-mark
  onMount(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  // ── Demo Data ──────────────────────────────────────────────

  const loadDemoData = () => {
    const mock = generateMockSessions()
    setDbSessionRecords(mock)
    setDemoLoaded(true)
    // Also run analysis immediately
    setTimeout(() => startAnalysis(), 50)
  }

  // ── Merge localStorage and DB session history ──────────────

  const history = createMemo(() => {
    const local = getSessionHistory()
    const db = dbSessionRecords()
    const dbIds = new Set(local.map((s) => s.sessionId))
    const newFromDb = db.filter((s) => !dbIds.has(s.sessionId))
    return [...local, ...newFromDb].sort(
      (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0),
    )
  })

  // Get recent session scores
  const recentSessions = createMemo(() => {
    const sessions = history()
    return sessions.slice(0, 20)
  })

  // Average scores by day of week
  const weeklyScores = createMemo(() => {
    const scores = [0, 0, 0, 0, 0, 0, 0]
    const counts = [0, 0, 0, 0, 0, 0, 0]
    for (const session of history()) {
      const date = new Date(session.completedAt)
      const dayIndex = date.getDay() || 7
      if (dayIndex > 0 && dayIndex < 8) {
        scores[dayIndex - 1] += session.score || 0
        counts[dayIndex - 1]++
      }
    }
    return scores.map((s, i) => ({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
      score: counts[i] ? Math.round(s / counts[i]) : 0,
      count: counts[i],
    }))
  })

  const streakInfo = createMemo(() => {
    const sessions = [...history()]
      .sort((a, b) => b.completedAt - a.completedAt)
      .filter((s) => s.score !== undefined && s.score > 0)
    if (sessions.length === 0) return { currentStreak: 0, maxStreak: 0 }

    let currentStreak = 0
    let maxStreak = 0
    const dates = new Set<string>()
    for (const session of sessions) {
      const dateStr = new Date(session.completedAt).toISOString().split('T')[0]
      if (!dates.has(dateStr)) {
        dates.add(dateStr)
        currentStreak++
        maxStreak = Math.max(maxStreak, currentStreak)
      }
    }
    return { currentStreak, maxStreak, totalSessions: sessions.length }
  })

  // ── Exercise Checks ────────────────────────────────────────

  const checkBelting = (): ExerciseCheck => {
    const runData = vocalRunData()
    if (runData.length < 5) {
      return {
        type: 'belting',
        passed: false,
        confidence: 0,
        feedback:
          'Sing longer (at least 5 notes) to analyze belting technique.',
        metrics: {
          noteCount: runData.length,
          minFreq: 0,
          maxFreq: 0,
          avgVolume: 0,
        },
      }
    }

    let totalFreq = 0
    let minFreq = Infinity
    let maxFreq = -Infinity
    let totalVolume = 0
    let minV = Infinity
    let maxV = -Infinity

    for (let i = 0; i < runData.length; i++) {
      const r = runData[i]
      const f = r.freq
      const v = r.clarity || 0

      totalFreq += f
      if (f < minFreq) minFreq = f
      if (f > maxFreq) maxFreq = f

      totalVolume += v
      if (v < minV) minV = v
      if (v > maxV) maxV = v
    }

    const avgFreq = totalFreq / runData.length
    const avgV = totalVolume / runData.length
    const midFreq = 440 // A4
    const isHighRange = avgFreq > midFreq * 1.5 // Belting is usually above A4
    const volumeVariation = maxV / minV

    return {
      type: 'belting',
      passed: isHighRange && volumeVariation > 1.3,
      confidence: Math.min(95, Math.round((volumeVariation - 1) * 50)),
      feedback: isHighRange
        ? 'Great belting technique! Your chest voice projection is strong.'
        : 'Try singing at a higher intensity to engage your chest voice.',
      metrics: {
        noteCount: runData.length,
        minFreq,
        maxFreq,
        avgVolume: avgV,
      },
    }
  }

  const checkFalsetto = (): ExerciseCheck => {
    const runData = vocalRunData()
    if (runData.length < 3) {
      return {
        type: 'falsetto',
        passed: false,
        confidence: 0,
        feedback: 'Sing at least 3 notes to check falsetto usage.',
        metrics: {
          noteCount: runData.length,
          minFreq: 0,
          maxFreq: 0,
          avgVolume: 0,
        },
      }
    }

    let totalFreq = 0
    let minFreq = Infinity
    let maxFreq = -Infinity
    let totalVolume = 0

    for (let i = 0; i < runData.length; i++) {
      const r = runData[i]
      const f = r.freq
      const v = r.clarity || 0

      totalFreq += f
      if (f < minFreq) minFreq = f
      if (f > maxFreq) maxFreq = f
      totalVolume += v
    }

    const avgFreq = totalFreq / runData.length
    const avgV = totalVolume / runData.length
    const midFreq = 440 // A4 frequency
    const isHighRange = avgFreq > midFreq * 1.2

    return {
      type: 'falsetto',
      passed: isHighRange && avgV < 60,
      confidence: Math.min(90, Math.round((120 - avgV) * 1.2)),
      feedback:
        avgV < 60
          ? 'Clean falsetto! Your head voice resonance is smooth.'
          : 'Try reducing volume slightly to let your head voice ring more.',
      metrics: {
        noteCount: runData.length,
        minFreq,
        maxFreq,
        avgVolume: avgV,
      },
    }
  }

  const checkDynamics = (): ExerciseCheck => {
    const runData = vocalRunData()
    if (runData.length < 8) {
      return {
        type: 'crescendo',
        passed: false,
        confidence: 0,
        feedback: 'Sing at least 8 notes to check dynamic control.',
        metrics: {
          noteCount: runData.length,
          minFreq: 0,
          maxFreq: 0,
          avgVolume: 0,
        },
      }
    }

    let minV = Infinity
    let maxV = -Infinity
    let minFreq = Infinity
    let maxFreq = -Infinity

    for (let i = 0; i < runData.length; i++) {
      const r = runData[i]
      const f = r.freq
      const v = r.clarity || 0

      if (v < minV) minV = v
      if (v > maxV) maxV = v
      if (f < minFreq) minFreq = f
      if (f > maxFreq) maxFreq = f
    }

    const range = maxV - minV
    const isDynamic = range > 25
    return {
      type: 'crescendo',
      passed: isDynamic,
      confidence: Math.min(95, Math.round(range)),
      feedback: isDynamic
        ? 'Excellent dynamic control! Your volume changes smoothly.'
        : 'Try gradually increasing and decreasing your volume across notes.',
      metrics: {
        noteCount: runData.length,
        minFreq,
        maxFreq,
        avgVolume: (minV + maxV) / 2,
      },
    }
  }

  // ── Start Analysis (History Mode) ──────────────────────────

  // Start analyzing session history
  const startAnalysis = () => {
    if (isAnalyzing()) return
    setIsAnalyzing(true)
    setVocalRunData([])
    setSpectralData([])
    setIntensityProfile(null)
    setBreathiness(null)
    setSlideTracking(null)
    setVibratoAnalysis(null)
    setHarmonicRichness(null)
    setResonanceData(null)
    setFatigueData(null)

    // Make it async to let UI update and show the Analyzing state
    setTimeout(() => {
      const allData = history()
      if (allData.length > 0) {
        // Convert SessionResult[] to PitchResult[] by flattening practiceItemResult
        const practiceResults = allData.flatMap((s) => s.practiceItemResult)
        const pitchResults = practiceResults
          .flatMap((p) => p.noteResult)
          .map((r) => ({
            freq: r.pitchFreq || 0,
            midi: r.item.note.midi,
            note: r.item.note.name,
            noteName: r.item.note.name,
            clarity: r.avgCents || 0,
          })) as PitchResult[]
        setVocalRunData(pitchResults)

        // Phase 1: Intensity Profile
        const intensity = intensityFromPitchResults(
          pitchResults.map((p, i) => ({
            time: i * 0.01,
            clarity: p.clarity,
            midi: p.midi,
          })),
        )
        setIntensityProfile({
          avgDb: intensity.avgDb,
          peakDb: intensity.peakDb,
          dynamicRange: intensity.dynamicRange,
        })

        // Phase 1: Breathiness
        const breath = approximateBreathiness(
          pitchResults.map((p) => ({ freq: p.freq, clarity: p.clarity })),
        )
        setBreathiness(breath)

        // Phase 1: Slide Tracking
        const slides = detectSlides(
          pitchResults.map((p, i) => ({
            time: i * 0.01,
            midi: p.midi,
            freq: p.freq,
          })),
        )
        setSlideTracking(slides)

        // Phase 2: Vibrato Detection
        const vibrato = detectVibrato(
          pitchResults.map((p, i) => ({
            time: i * 0.01,
            freq: p.freq,
            midi: p.midi,
          })),
        )
        setVibratoAnalysis(vibrato)

        // Phase 2: Harmonic Richness
        const richness = approximateRichness(
          pitchResults.map((p) => ({ freq: p.freq, clarity: p.clarity })),
        )
        setHarmonicRichness({
          richnessScore: richness.richnessScore,
          harmonicCount: richness.harmonicCount,
          harmonicProfile: [],
          quality: richness.quality,
        })

        // Phase 2: Resonance Zone
        const resonance = approximateResonance(
          pitchResults.map((p) => ({ freq: p.freq })),
        )
        setResonanceData(resonance)

        // Phase 2: Vocal Fatigue (build checkpoints from session history)
        const sessionData = allData
        const checkpoints: FatigueCheckpoint[] = []
        for (let ci = 0; ci < Math.min(sessionData.length, 10); ci++) {
          const s = sessionData[ci]
          const sPitch = s.practiceItemResult.flatMap((pr) =>
            pr.noteResult.map((r) => ({
              freq: r.item.note.freq,
              clarity: r.avgCents || 0,
            })),
          )
          const sBreath = approximateBreathiness(sPitch)
          const sRichness = approximateRichness(sPitch)
          checkpoints.push({
            time: s.completedAt || ci,
            hnrDb: sBreath.hnrDb,
            richnessScore: sRichness.richnessScore,
            pitchStability: s.score || 50,
          })
        }
        if (checkpoints.length >= 3) {
          setFatigueData(analyzeFatigue(checkpoints))
        }

        // Synthesize a beautiful 64-bin harmonic spectrum from the session's pitch data
        const NUM_BINS = 64
        const bins = new Array(NUM_BINS).fill(0)
        const maxFreq = 8000

        if (pitchResults.length > 0) {
          // Aggregate harmonic energy across all pitches
          pitchResults.forEach((p: PitchResult) => {
            if (!p.midi) return
            const freq = 440 * Math.pow(2, (p.midi - 69) / 12)
            // Add fundamental and up to 4 harmonics
            for (let h = 1; h <= 5; h++) {
              const hFreq = freq * h
              const energy = 100 / h // Higher harmonics have less energy
              // Spread energy across nearby bins
              for (let b = 0; b < NUM_BINS; b++) {
                const binFreq = (b / NUM_BINS) * maxFreq
                const dist = Math.abs(binFreq - hFreq)
                if (dist < 500) {
                  // Gaussian spread
                  bins[b] += energy * Math.exp(-(dist * dist) / 50000)
                }
              }
            }
          })

          // Normalize bins to 0-100 range
          const maxBin = Math.max(...bins, 1)
          for (let b = 0; b < NUM_BINS; b++) {
            bins[b] = (bins[b] / maxBin) * 100
          }
        }

        const spectral: SpectrumData[] = bins.map((amp, i) => ({
          frequency: (i / NUM_BINS) * maxFreq,
          amplitude: amp,
          phase: (i / NUM_BINS) * Math.PI * 2,
        }))
        setSpectralData(spectral)

        setIsAnalyzing(false)
      } else {
        setIsAnalyzing(false)
      }
    }, 600)
  }

  // ── Helpers ────────────────────────────────────────────────

  const getExerciseCheck = (type: VocalExerciseType): ExerciseCheck => {
    switch (type) {
      case 'belting':
        return checkBelting()
      case 'falsetto':
        return checkFalsetto()
      case 'crescendo':
      case 'decrescendo':
        return checkDynamics()
      case 'riffs':
        return getRiffCheck()
      case 'runs':
        return getRunCheck()
      default:
        return {
          type: 'belting',
          passed: false,
          confidence: 0,
          feedback: 'Select an exercise to analyze.',
          metrics: { noteCount: 0, minFreq: 0, maxFreq: 0, avgVolume: 0 },
        }
    }
  }

  const getRiffCheck = (): ExerciseCheck => {
    const runData = vocalRunData()
    if (runData.length < 6) {
      return {
        type: 'riffs',
        passed: false,
        confidence: 0,
        feedback: 'Sing a longer phrase (6+ notes) to detect riffs.',
        metrics: {
          noteCount: runData.length,
          minFreq: 0,
          maxFreq: 0,
          avgVolume: 0,
        },
      }
    }
    const midis = runData.map((r) => r.midi).filter((m) => m > 0)
    let alternationCount = 0
    let prevDir = 0
    for (let i = 1; i < midis.length - 1; i++) {
      const interval = Math.abs(midis[i] - midis[i - 1])
      const dir = midis[i] - midis[i - 1]
      if (
        interval > 0 &&
        interval <= 3 &&
        prevDir !== 0 &&
        dir !== 0 &&
        Math.sign(dir) !== Math.sign(prevDir)
      ) {
        alternationCount++
      }
      if (dir !== 0) prevDir = dir
    }
    const density = alternationCount / Math.max(1, midis.length - 2)
    const passed = density >= 0.25
    const freqs = runData.map((r) => r.freq).filter((f) => f > 0)
    const vol = runData.map((r) => r.clarity || 0).filter((v) => v > 0)
    return {
      type: 'riffs',
      passed,
      confidence: Math.min(95, Math.round(density * 150)),
      feedback: passed
        ? 'Nice riff! Rapid note alternations detected.'
        : 'Try quick back-and-forth between adjacent notes for a riff.',
      metrics: {
        noteCount: runData.length,
        minFreq: freqs.length > 0 ? Math.min(...freqs) : 0,
        maxFreq: freqs.length > 0 ? Math.max(...freqs) : 0,
        avgVolume:
          vol.length > 0 ? vol.reduce((a, b) => a + b, 0) / vol.length : 0,
      },
    }
  }

  const getRunCheck = (): ExerciseCheck => {
    const runData = vocalRunData()
    if (runData.length < 6) {
      return {
        type: 'runs',
        passed: false,
        confidence: 0,
        feedback: 'Sing a longer phrase (6+ notes) to detect runs.',
        metrics: {
          noteCount: runData.length,
          minFreq: 0,
          maxFreq: 0,
          avgVolume: 0,
        },
      }
    }
    const midis = runData.map((r) => r.midi).filter((m) => m > 0)
    let maxConsecutive = 0
    let currentRun = 0
    let currentDir = 0
    for (let i = 1; i < midis.length; i++) {
      const diff = midis[i] - midis[i - 1]
      const step = Math.abs(diff)
      if (step >= 1 && step <= 2) {
        const dir = Math.sign(diff)
        if (dir === currentDir) {
          currentRun++
        } else {
          currentRun = 1
          currentDir = dir
        }
        maxConsecutive = Math.max(maxConsecutive, currentRun)
      } else {
        currentRun = 0
        currentDir = 0
      }
    }
    const passed = maxConsecutive >= 4
    const freqs = runData.map((r) => r.freq).filter((f) => f > 0)
    const vol = runData.map((r) => r.clarity || 0).filter((v) => v > 0)
    return {
      type: 'runs',
      passed,
      confidence: Math.min(95, maxConsecutive * 15),
      feedback: passed
        ? `Great run! ${maxConsecutive} consecutive stepwise notes detected.`
        : 'Try a sequence of adjacent notes moving up or down for a run.',
      metrics: {
        noteCount: runData.length,
        minFreq: freqs.length > 0 ? Math.min(...freqs) : 0,
        maxFreq: freqs.length > 0 ? Math.max(...freqs) : 0,
        avgVolume:
          vol.length > 0 ? vol.reduce((a, b) => a + b, 0) / vol.length : 0,
      },
    }
  }

  const feedbackMessage = (): string => {
    if (isAnalyzing()) return ''
    if (vocalRunData().length === 0) return ''
    const checkFn = getExerciseCheck(activeExercise() ?? 'belting')
    return checkFn.feedback
  }

  const metrics = (): {
    noteCount: number
    minFreq: number
    maxFreq: number
    avgVolume: number
  } => {
    if (isAnalyzing())
      return { noteCount: 0, minFreq: 0, maxFreq: 0, avgVolume: 0 }
    if (vocalRunData().length === 0)
      return { noteCount: 0, minFreq: 0, maxFreq: 0, avgVolume: 0 }
    const checkFn = getExerciseCheck(activeExercise() ?? 'belting')
    return checkFn.metrics
  }

  const getBarColor = (score: number): string => {
    if (score >= 90) return '#3fb950'
    if (score >= 75) return '#58a6ff'
    if (score >= 60) return '#2dd4bf'
    return '#d29922'
  }

  const showDemoHint = (): boolean => {
    return (
      analysisMode() === 'history' &&
      history().length === 0 &&
      !demoLoaded() &&
      !isLiveActive()
    )
  }

  const pitchChartData = createMemo(() => {
    const data = vocalRunData().slice(-50)
    const valid = data.filter((d) => d.midi > 0 && d.freq > 0)
    if (valid.length < 2) return null
    const midis = valid.map((d) => d.midi)
    const minMidi = Math.min(...midis)
    const maxMidi = Math.max(...midis)
    const range = Math.max(12, maxMidi - minMidi)
    const pad = range * 0.25
    const yMin = minMidi - pad
    const yMax = maxMidi + pad
    const gridStep = range > 36 ? 12 : range > 24 ? 6 : range > 12 ? 3 : 1
    const gridLines: number[] = []
    const gridStart = Math.ceil(yMin / gridStep) * gridStep
    for (let g = gridStart; g <= yMax; g += gridStep) {
      gridLines.push(g)
    }
    return { points: valid, yMin, yMax, gridLines }
  })

  // ── Exercise Definitions ───────────────────────────────────

  const exercises: Array<{
    type: VocalExerciseType
    name: string
    icon: typeof IconBolt
    color: string
  }> = [
    {
      type: 'belting',
      name: 'Belting Check',
      icon: IconBolt,
      color: '#f85149',
    },
    {
      type: 'falsetto',
      name: 'Falsetto Check',
      icon: IconWind,
      color: '#58a6ff',
    },
    {
      type: 'crescendo',
      name: 'Crescendo',
      icon: IconChartLine,
      color: '#3fb950',
    },
    {
      type: 'decrescendo',
      name: 'Decrescendo',
      icon: IconChartBar,
      color: '#d29922',
    },
    { type: 'riffs', name: 'Riffs', icon: IconGuitar, color: '#bc8cff' },
    { type: 'runs', name: 'Runs', icon: IconKeyboard, color: '#2dd4bf' },
  ]

  // ============================================================
  // Render
  // ============================================================

  return (
    <div class="vocal-analysis-tab">
      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.6); }
          50% { opacity: 0.6; box-shadow: 0 0 0 6px rgba(63, 185, 80, 0); }
        }
      `}</style>
      {/* Header */}
      <div class="vocal-header">
        <div class="vocal-header-content">
          <h2>Vocal Analysis</h2>
          <p class="vocal-subtitle">
            Track your progress, analyze technique, and improve your voice
          </p>
        </div>
        <div class="vocal-header-actions">
          {/* Mode Toggle */}
          <div class="mode-toggle" data-testid="analysis-mode-toggle">
            <button
              data-testid="analysis-mode-history"
              class={`mode-toggle-btn ${analysisMode() === 'history' ? 'active' : ''}`}
              onClick={() => {
                setAnalysisMode('history')
                if (isLiveActive()) stopLiveAnalysis()
              }}
            >
              Session History
            </button>
            <button
              data-testid="analysis-mode-live"
              class={`mode-toggle-btn ${analysisMode() === 'live' ? 'active' : ''}`}
              onClick={() => setAnalysisMode('live')}
            >
              <IconMic />
              Live Mic
            </button>
          </div>
          <Show when={analysisMode() === 'live'}>
            <div
              class="mode-toggle"
              data-testid="analysis-dashboard-toggle"
              style={{ 'margin-left': '8px' }}
            >
              <button
                data-testid="analysis-dashboard-standard"
                class={`mode-toggle-btn ${dashboardTab() === 'standard' ? 'active' : ''}`}
                onClick={() => setDashboardTab('standard')}
              >
                Standard
              </button>
              <button
                data-testid="analysis-dashboard-pro"
                class={`mode-toggle-btn ${dashboardTab() === 'pro' ? 'active' : ''}`}
                onClick={() => setDashboardTab('pro')}
              >
                Pro
              </button>
              <button
                data-testid="analysis-dashboard-panes"
                class={`mode-toggle-btn ${dashboardTab() === 'panes' ? 'active' : ''}`}
                onClick={() => setDashboardTab('panes')}
              >
                Panes
              </button>
            </div>
          </Show>

          {/* Action Button */}
          <Show when={analysisMode() === 'history'}>
            <button
              data-testid="analyze-history-start"
              class="analyze-btn"
              onClick={startAnalysis}
              disabled={isAnalyzing() || history().length === 0}
            >
              {isAnalyzing() ? (
                'Analyzing...'
              ) : (
                <>
                  <IconPlay /> Start Vocal Analysis
                </>
              )}
            </button>
          </Show>
          <Show when={analysisMode() === 'live'}>
            <Show
              when={!isLiveActive()}
              fallback={
                <button
                  class="analyze-btn live-stop"
                  onClick={stopLiveAnalysis}
                >
                  Stop Live Analysis
                </button>
              }
            >
              <button
                data-testid="analyze-live-start"
                class="analyze-btn live-start"
                onClick={() => void startLiveAnalysis()}
              >
                <IconMic /> Start Live Analysis
              </button>
            </Show>
          </Show>
        </div>
      </div>

      {/* Live Error */}
      <Show when={liveError()}>
        <div class="live-error">{liveError()}</div>
      </Show>

      {/* Demo Data Hint */}
      <Show when={showDemoHint()}>
        <div class="demo-hint">
          <p>
            <strong>No practice sessions yet.</strong> Try loading demo data to
            see how the analysis works, or switch to{' '}
            <button
              class="demo-hint-link"
              onClick={() => setAnalysisMode('live')}
            >
              Live Mic
            </button>{' '}
            mode to sing into your microphone.
          </p>
          <div class="demo-hint-actions">
            <button class="demo-load-btn" onClick={loadDemoData}>
              Load Demo Data
            </button>
          </div>
        </div>
      </Show>

      {/* IS_DEV: Inject Mock Sessions */}
      <Show when={IS_DEV && analysisMode() === 'history'}>
        <div class="demo-hint dev-hint">
          <button class="demo-load-btn" onClick={loadDemoData}>
            Inject Mock Sessions
          </button>
        </div>
      </Show>

      {/* Main Grid */}
      <div class="vocal-grid">
        {/* Left Column: Stats */}
        <div class="vocal-column-left">
          {/* Streak Card */}
          <div class="stat-card streak-card">
            <div class="streak-icon">
              <IconFire />
            </div>
            <div class="streak-info">
              <div class="streak-number">{streakInfo().currentStreak}</div>
              <div class="streak-label">Current Streak</div>
            </div>
            <div class="streak-divider" />
            <div class="streak-info">
              <div class="streak-number">{streakInfo().maxStreak}</div>
              <div class="streak-label">Best Streak</div>
            </div>
          </div>

          {/* Weekly Chart */}
          <div class="stat-card weekly-chart">
            <h3>Weekly Progress</h3>
            <div class="chart-bar-container">
              <For each={weeklyScores()}>
                {(item) => (
                  <div class="chart-bar-wrapper">
                    <div
                      class="chart-bar"
                      style={{
                        width: `${Math.min(100, (item.score / 100) * 100)}%`,
                        background: getBarColor(item.score),
                      }}
                    />
                    <span class="chart-label">{item.day}</span>
                    <span class="chart-score">{item.score}</span>
                  </div>
                )}
              </For>
            </div>
            <div class="chart-legend">
              <span>Avg Score by Day</span>
              <span>{streakInfo().totalSessions} sessions this week</span>
            </div>
          </div>

          {/* Recent Sessions */}
          <div class="stat-card recent-sessions">
            <h3>Recent Practice</h3>
            <div class="session-list">
              <For each={recentSessions()}>
                {(session) => (
                  <div class="session-item">
                    <div class="session-info">
                      <span class="session-name">
                        {session.name || 'Untitled'}
                      </span>
                      <span class="session-date">
                        {new Date(
                          session.completedAt || 0,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    <div class="session-score">
                      <span class="score-value">{session.score || 0}%</span>
                      <span class="score-bar">
                        <div
                          class="score-fill"
                          style={{ width: `${session.score || 0}%` }}
                        />
                      </span>
                    </div>
                  </div>
                )}
              </For>
              {recentSessions().length === 0 && (
                <div class="no-sessions">
                  Start practicing to see your session history here.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Analysis */}
        <div class="vocal-column-right">
          {/* Live Dashboard */}
          <Show when={isLiveActive()}>
            <Show when={dashboardTab() === 'pro'}>
              <div style={{ 'margin-bottom': '24px' }}>
                <ProDashboard
                  isActive={isLiveActive()}
                  pitchStability={pitchStability()}
                  centsOffset={currentCentsOffset()}
                  targetNote={currentTargetNote()}
                  liveSnapshot={liveSnapshot()}
                  vibrato={vibratoAnalysis()}
                  spectralMagnitude={spectralMagnitude()}
                  fftBreathiness={breathiness()}
                  fftRichness={harmonicRichness()}
                  fftResonance={resonanceData()}
                  sampleRate={engines?.audioEngine.getSampleRate() ?? 44100}
                />
              </div>
            </Show>
            <Show when={dashboardTab() === 'panes'}>
              <div style={{ 'margin-bottom': '24px', height: '600px' }}>
                <MultiPaneView
                  audioDuration={liveDuration()}
                  playheadPosition={panePlayheadPosition()}
                  isPlaying={isLiveActive()}
                  magnitudeSpectrum={spectralMagnitude()}
                  phaseSpectrum={spectralPhase()}
                  pitchHistory={panePitchHistory()}
                  centsOffset={currentCentsOffset()}
                  targetNote={currentTargetNote()}
                  vibratoRate={vibratoAnalysis()?.rateHz ?? null}
                  vibratoDepth={vibratoAnalysis()?.depthCents ?? null}
                  waveformData={paneWaveformData()}
                  sampleRate={engines?.audioEngine.getSampleRate() ?? 44100}
                  annotationCount={annotations().length}
                />
              </div>
            </Show>
            <Show when={dashboardTab() === 'standard'}>
              <div class="live-dashboard">
                <div class="live-dashboard-header">
                  <span class="live-dot" />
                  <span class="live-dashboard-title">Live Analysis</span>
                  <span class="live-status-chip">
                    {livePitchBuffer().length} samples
                  </span>
                  <Show when={liveSnapshot()}>
                    <span class="live-status-chip">
                      {liveSnapshot()!.resonance.zone} zone
                    </span>
                    <span class="live-status-chip">
                      {liveSnapshot()!.resonance.avgFrequency.toFixed(0)} Hz
                    </span>
                  </Show>
                </div>
                <div class="live-dashboard-body">
                  <Show when={liveSnapshot()}>
                    <div class="live-cards-grid">
                      <LiveMetricCard
                        label="Intensity"
                        value={`${liveSnapshot()!.intensity.avgDb} dB`}
                        detail={`Peak ${liveSnapshot()!.intensity.peakDb} dB`}
                        highlight={liveSnapshot()!.intensity.isConsistent}
                        icon={IconBolt}
                        color="#f85149"
                      />
                      <LiveMetricCard
                        label="Breathiness"
                        value={liveSnapshot()!.breathiness.label}
                        detail={`Score ${liveSnapshot()!.breathiness.score}/100`}
                        highlight={liveSnapshot()!.breathiness.hasGoodClosure}
                        icon={IconWind}
                        color="#58a6ff"
                      />
                      <LiveMetricCard
                        label="Slides"
                        value={`${liveSnapshot()!.slides.count} detected`}
                        detail={`Avg ${liveSnapshot()!.slides.avgDistance} semitones`}
                        highlight={liveSnapshot()!.slides.isSmooth}
                        icon={IconChartLine}
                        color="#d29922"
                      />
                      <LiveMetricCard
                        label="Vibrato"
                        value={
                          liveSnapshot()!.vibrato.detected
                            ? `${liveSnapshot()!.vibrato.rate} Hz`
                            : 'None'
                        }
                        detail={`${liveSnapshot()!.vibrato.quality}`}
                        highlight={liveSnapshot()!.vibrato.quality === 'Good'}
                        icon={IconChartBar}
                        color="#bc8cff"
                      />
                      <LiveMetricCard
                        label="Harmonics"
                        value={liveSnapshot()!.richness.label}
                        detail={`~${liveSnapshot()!.richness.harmonicCount} harmonics`}
                        highlight={
                          liveSnapshot()!.richness.label === 'Rich' ||
                          liveSnapshot()!.richness.label === 'Full'
                        }
                        icon={IconGuitar}
                        color="#3fb950"
                      />
                      <LiveMetricCard
                        label="Resonance"
                        value={`${liveSnapshot()!.resonance.zone} (${liveSnapshot()!.resonance.confidence}%)`}
                        detail={`Avg ${liveSnapshot()!.resonance.avgFrequency} Hz`}
                        highlight={liveSnapshot()!.resonance.confidence > 50}
                        icon={IconKeyboard}
                        color="#2dd4bf"
                      />
                    </div>
                  </Show>

                  {/* Mic Input Spectrum */}
                  <div class="mic-spectrum-display">
                    <h3>Mic Input Spectrum</h3>
                    <div class="mic-spectrum-bars">
                      <For each={micBars()}>
                        {(bar) => (
                          <div
                            class={`mic-spectrum-bar ${bar.active ? 'active' : ''}`}
                            style={{ height: `${bar.height}%` }}
                          />
                        )}
                      </For>
                    </div>
                  </div>
                </div>
              </div>
            </Show>
          </Show>

          {/* Horizontal Layout for Techniques and Results */}
          <div class="analysis-blocks-row">
            {/* Vocal Techniques */}
            <div class="vocal-techniques">
              <h3>Vocal Techniques</h3>
              <div class="technique-grid">
                <For each={exercises}>
                  {(exercise) => (
                    <button
                      class={`technique-card ${activeExercise() === exercise.type ? 'active' : ''}`}
                      style={{ '--exercise-color': exercise.color }}
                      onClick={() => setActiveExercise(exercise.type)}
                    >
                      <span class="exercise-icon">{exercise.icon()}</span>
                      <span class="exercise-name">{exercise.name}</span>
                    </button>
                  )}
                </For>
              </div>

              {/* Exercise Results */}
              <Show when={activeExercise()}>
                <Show when={isAnalyzing()}>
                  <div class="analyzing-overlay">
                    <div class="analyzing-spinner" />
                    <p>Analyzing your voice...</p>
                  </div>
                </Show>
                <Show when={!isAnalyzing() && vocalRunData().length > 0}>
                  <div
                    class={`exercise-feedback ${getExerciseCheck(activeExercise() ?? 'belting').passed ? 'feedback-pass' : 'feedback-neutral'}`}
                  >
                    <span class="feedback-icon">
                      {getExerciseCheck(activeExercise() ?? 'belting')
                        .passed ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      ) : (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      )}
                    </span>
                    <span>{feedbackMessage()}</span>
                    <span class="feedback-metrics">
                      <span>{metrics().noteCount} notes</span>
                      <span>
                        {metrics().minFreq.toFixed(0)}–
                        {metrics().maxFreq.toFixed(0)} Hz
                      </span>
                    </span>
                  </div>
                </Show>
                <Show when={!isAnalyzing() && vocalRunData().length === 0}>
                  <div class="exercise-empty">
                    <span>
                      {analysisMode() === 'live' && isLiveActive()
                        ? `Listening... sing to analyze your ${activeExercise()} technique.`
                        : `Start singing to analyze your ${activeExercise()} technique.`}
                    </span>
                    <Show when={analysisMode() === 'history'}>
                      <button
                        class="start-analysis-btn"
                        onClick={startAnalysis}
                      >
                        Start Analysis
                      </button>
                    </Show>
                    <Show when={analysisMode() === 'live' && !isLiveActive()}>
                      <button
                        class="start-analysis-btn"
                        onClick={() => void startLiveAnalysis()}
                      >
                        <IconMic /> Start Live Mic
                      </button>
                    </Show>
                    <Show when={analysisMode() === 'live' && isLiveActive()}>
                      <div class="live-listening-indicator">
                        <span class="live-dot" />
                        <span>Capturing audio...</span>
                      </div>
                    </Show>
                  </div>
                </Show>
              </Show>
            </div>

            {/* Phase 1 & 2 History Analysis Grid */}
            <div class="live-cards-grid analysis-results-grid">
              <Show when={intensityProfile()}>
                <LiveMetricCard
                  label="Intensity"
                  value={`${intensityProfile()!.avgDb.toFixed(1)} dB`}
                  detail={`Peak ${intensityProfile()!.peakDb.toFixed(1)} dB (Range ${intensityProfile()!.dynamicRange.toFixed(1)} dB)`}
                  highlight={intensityProfile()!.dynamicRange > 20}
                  icon={IconBolt}
                  color="#f85149"
                />
              </Show>
              <Show when={breathiness()}>
                <LiveMetricCard
                  label="Breathiness"
                  value={breathiness()!.quality}
                  detail={`HNR: ${breathiness()!.hnrDb} dB (Eff. ${breathiness()!.efficiency}%)`}
                  highlight={breathiness()!.quality === 'resonant'}
                  icon={IconWind}
                  color="#58a6ff"
                />
              </Show>
              <Show when={slideTracking()}>
                <LiveMetricCard
                  label="Slides & Transitions"
                  value={`${slideTracking()!.totalTransitions} detected`}
                  detail={`Clean: ${slideTracking()!.cleanCount} | Score: ${slideTracking()!.overallScore}%`}
                  highlight={slideTracking()!.overallScore >= 80}
                  icon={IconChartLine}
                  color="#d29922"
                />
              </Show>
              <Show when={vibratoAnalysis()}>
                <LiveMetricCard
                  label="Vibrato"
                  value={
                    vibratoAnalysis()!.detected
                      ? `${vibratoAnalysis()!.rateHz.toFixed(1)} Hz`
                      : 'None'
                  }
                  detail={
                    vibratoAnalysis()!.detected
                      ? `${vibratoAnalysis()!.classification} (Depth ${vibratoAnalysis()!.depthCents}¢)`
                      : 'No vibrato detected'
                  }
                  highlight={vibratoAnalysis()!.classification === 'natural'}
                  icon={IconChartBar}
                  color="#bc8cff"
                />
              </Show>
              <Show when={harmonicRichness()}>
                <LiveMetricCard
                  label="Harmonics"
                  value={harmonicRichness()!.quality}
                  detail={`Score: ${harmonicRichness()!.richnessScore}/100 (~${harmonicRichness()!.harmonicCount} harmonics)`}
                  highlight={
                    harmonicRichness()!.quality === 'rich' ||
                    harmonicRichness()!.quality === 'very-rich'
                  }
                  icon={IconGuitar}
                  color="#3fb950"
                />
              </Show>
              <Show when={resonanceData()}>
                <LiveMetricCard
                  label="Resonance"
                  value={resonanceData()!.dominantZone}
                  detail={`Centroid: ${resonanceData()!.spectralCentroid.toFixed(0)} Hz`}
                  highlight={
                    resonanceData()!.dominantZone === 'mixed' ||
                    resonanceData()!.dominantZone === 'mask'
                  }
                  icon={IconKeyboard}
                  color="#2dd4bf"
                />
              </Show>
              <Show when={fatigueData()}>
                <LiveMetricCard
                  label="Fatigue Tracker"
                  value={fatigueData()!.fatigued ? 'Fatigued' : 'Stable'}
                  detail={
                    fatigueData()!.fatigued
                      ? (fatigueData()!.alert ?? 'Fatigue detected')
                      : fatigueData()!.checkpoints.length < 3
                        ? 'Need more data'
                        : 'No fatigue detected'
                  }
                  highlight={
                    !fatigueData()!.fatigued &&
                    fatigueData()!.checkpoints.length >= 3
                  }
                  icon={IconFire}
                  color={fatigueData()!.fatigued ? '#f85149' : '#3fb950'}
                />
              </Show>
            </div>
          </div>

          {/* Spectrogram Display */}
          <div class="spectrogram-display">
            <h3>Spectrum Analysis</h3>

            <Show when={analysisMode() === 'history'}>
              <div class="spectrogram-container">
                <div class="spectrogram-grid">
                  <div class="freq-axis">
                    <div class="freq-label">100%</div>
                    <div class="freq-label">75%</div>
                    <div class="freq-label">50%</div>
                    <div class="freq-label">25%</div>
                    <div class="freq-label">0%</div>
                  </div>
                  <div class="time-axis">
                    <div class="time-label">0 Hz</div>
                    <div class="time-label">2 kHz</div>
                    <div class="time-label">4 kHz</div>
                    <div class="time-label">6 kHz</div>
                    <div class="time-label">8 kHz</div>
                  </div>
                  <div class="spectrogram-bars">
                    {spectralData().length === 0 && (
                      <div class="spectrogram-empty">
                        No spectrum data yet — start singing or playing audio
                      </div>
                    )}
                    <For each={spectralData()}>
                      {(data, i) => {
                        // Color accessor to ensure reactivity for the index i()
                        const barColor = createMemo(() => {
                          // Low freq (warm) → mid (accent blue) → high (cool teal)
                          const t = i() / Math.max(1, spectralData().length - 1)
                          let r: number, g: number, b: number
                          if (t < 0.5) {
                            // Orange (#f0883e) → Blue (#58a6ff)
                            const s = t / 0.5
                            r = Math.round(240 - s * 152)
                            g = Math.round(136 + s * 30)
                            b = Math.round(62 + s * 193)
                          } else {
                            // Blue (#58a6ff) → Teal (#2dd4bf)
                            const s = (t - 0.5) / 0.5
                            r = Math.round(88 - s * 43)
                            g = Math.round(166 + s * 46)
                            b = Math.round(255 - s * 64)
                          }
                          return `rgb(${r},${g},${b})`
                        })

                        return (
                          <div
                            class="spectrogram-bar"
                            style={{
                              height: `${Math.min(100, Math.max(0.5, data.amplitude))}%`,
                              background: barColor(),
                            }}
                          />
                        )
                      }}
                    </For>
                  </div>
                </div>
              </div>
              <div class="spectrogram-legend">
                <span class="legend-gradient">
                  <span class="gradient-bar" />
                  Low
                </span>
                <span>→ Freq →</span>
                <span>High</span>
                <span class="legend-sep">|</span>
                <span>Height = Amplitude</span>
              </div>
            </Show>

            <Show when={analysisMode() === 'live'}>
              <div
                class="live-canvases-container"
                style={{
                  display: 'flex',
                  'flex-direction': 'column',
                  gap: '1rem',
                }}
              >
                <div
                  class="live-canvas-wrap"
                  style={{
                    height: '200px',
                    'margin-top': '0.5rem',
                    position: 'relative',
                  }}
                >
                  <h4
                    style={{
                      'margin-bottom': '0.5rem',
                      color: 'rgba(255,255,255,0.7)',
                      'font-size': '0.875rem',
                    }}
                  >
                    <span style={{ 'margin-right': '8px' }}>
                      Real-time Spectrogram
                    </span>
                    <button
                      class="spectrogram-cycle-btn"
                      onClick={cycleColourMap}
                      title={`Colour map: ${colourMap()}. Click to cycle.`}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: 'rgba(255,255,255,0.6)',
                        'font-size': '0.65rem',
                        padding: '2px 8px',
                        'border-radius': '4px',
                        cursor: 'pointer',
                      }}
                    >
                      {colourMap()}
                    </button>
                    <button
                      class="spectrogram-peak-btn"
                      onClick={() => setPeakBinsOnly((v) => !v)}
                      title={
                        peakBinsOnly()
                          ? 'Peak bins: ON (click for full)'
                          : 'Peak bins: OFF (click for peaks only)'
                      }
                      style={{
                        background: peakBinsOnly()
                          ? 'rgba(34,197,94,0.2)'
                          : 'rgba(255,255,255,0.08)',
                        border: peakBinsOnly()
                          ? '1px solid rgba(34,197,94,0.4)'
                          : '1px solid rgba(255,255,255,0.15)',
                        color: peakBinsOnly()
                          ? '#22c55e'
                          : 'rgba(255,255,255,0.6)',
                        'font-size': '0.65rem',
                        padding: '2px 8px',
                        'border-radius': '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Peaks
                    </button>
                    <button
                      class="spectrogram-window-btn"
                      onClick={cycleWindowType}
                      title={`Window: ${windowType()}. Click to cycle.`}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: 'rgba(255,255,255,0.5)',
                        'font-size': '0.6rem',
                        padding: '2px 8px',
                        'border-radius': '4px',
                        cursor: 'pointer',
                      }}
                    >
                      {windowType()}
                    </button>
                    <button
                      class="spectrogram-window-btn"
                      onClick={cycleNormalizeMode}
                      title={`Normalize: ${normalizeMode()}. Click to cycle.`}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: 'rgba(255,255,255,0.5)',
                        'font-size': '0.6rem',
                        padding: '2px 8px',
                        'border-radius': '4px',
                        cursor: 'pointer',
                      }}
                    >
                      {normalizeMode()}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.01"
                      value={colourRotation()}
                      onInput={(e) =>
                        setColourRotation(parseFloat(e.currentTarget.value))
                      }
                      title={`Colour rotation: ${colourRotation().toFixed(2)}`}
                      style={{
                        width: '40px',
                        height: '14px',
                        cursor: 'pointer',
                        'accent-color': '#58a6ff',
                      }}
                    />
                    <button
                      class="spectrogram-peak-btn"
                      onClick={() => setShowHarmonicCursor((v) => !v)}
                      title={
                        showHarmonicCursor()
                          ? 'Harmonic cursor: ON'
                          : 'Harmonic cursor: OFF'
                      }
                      style={{
                        background: showHarmonicCursor()
                          ? 'rgba(88,166,255,0.15)'
                          : 'rgba(255,255,255,0.06)',
                        border: showHarmonicCursor()
                          ? '1px solid rgba(88,166,255,0.3)'
                          : '1px solid rgba(255,255,255,0.12)',
                        color: showHarmonicCursor()
                          ? '#58a6ff'
                          : 'rgba(255,255,255,0.4)',
                        'font-size': '0.6rem',
                        padding: '2px 8px',
                        'border-radius': '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Harmonics
                    </button>
                    {hoverFrequency() !== null && (
                      <span
                        style={{
                          'font-size': '0.6rem',
                          color: 'rgba(255,255,255,0.4)',
                        }}
                      >
                        {hoverFrequency()!.toFixed(0)}Hz
                      </span>
                    )}
                    <button
                      class="spectrogram-window-btn"
                      onClick={() => setVocalRangeOnly((v) => !v)}
                      title={
                        vocalRangeOnly()
                          ? 'Vocal range: ON (65-1500Hz)'
                          : 'Vocal range: OFF'
                      }
                      style={{
                        background: vocalRangeOnly()
                          ? 'rgba(188,140,255,0.15)'
                          : 'rgba(255,255,255,0.06)',
                        border: vocalRangeOnly()
                          ? '1px solid rgba(188,140,255,0.3)'
                          : '1px solid rgba(255,255,255,0.12)',
                        color: vocalRangeOnly()
                          ? '#bc8cff'
                          : 'rgba(255,255,255,0.4)',
                        'font-size': '0.6rem',
                        padding: '2px 8px',
                        'border-radius': '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Vocal
                    </button>
                  </h4>
                  <SpectrogramCanvas
                    isActive={isLiveActive()}
                    magnitudeSpectrum={spectralMagnitude()}
                    sampleRate={engines?.audioEngine.getSampleRate() ?? 44100}
                    colourMap={colourMap()}
                    peakBinsOnly={peakBinsOnly()}
                    phaseSpectrum={spectralPhase()}
                    normalizeMode={normalizeMode()}
                    colourRotation={colourRotation()}
                    showHarmonicCursor={showHarmonicCursor()}
                    onHoverFrequency={(f) => setHoverFrequency(f)}
                    freqMin={vocalRangeOnly() ? 65 : undefined}
                    freqMax={vocalRangeOnly() ? 1500 : undefined}
                  />
                  <Show when={isLiveActive()}>
                    <AnnotationLayer
                      annotations={annotations()}
                      timeRange={[0, Math.max(60, playheadPosition() + 5)]}
                      yRange={[0, 100]}
                      isActive={true}
                      selectedId={selectedAnnotationId()}
                      onSelect={(id) => setSelectedAnnotationId(id)}
                      onDoubleClickAt={(time) => {
                        createTimeInstant(time, undefined)
                      }}
                    />
                  </Show>
                </div>

                {/* Annotation controls */}
                <Show when={isLiveActive() && annotations().length > 0}>
                  <div style={{ 'margin-top': '0.5rem' }}>
                    <AnnotationControls
                      annotations={annotations()}
                      selectedId={selectedAnnotationId()}
                      onSelect={(id) => setSelectedAnnotationId(id)}
                      onDeselectAll={() => setSelectedAnnotationId(null)}
                    />
                  </div>
                </Show>

                <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                  <div
                    class="live-canvas-wrap"
                    style={{
                      height: '100px',
                      flex: 1,
                      'min-width': 0,
                      'margin-top': '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        'justify-content': 'space-between',
                        'align-items': 'center',
                        'margin-bottom': '0.5rem',
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          color: 'rgba(255,255,255,0.7)',
                          'font-size': '0.875rem',
                        }}
                      >
                        Cents Deviation
                      </h4>
                      <span
                        style={{
                          color: 'rgba(255,255,255,0.5)',
                          'font-size': '0.75rem',
                          'white-space': 'nowrap',
                          overflow: 'hidden',
                          'text-overflow': 'ellipsis',
                        }}
                      >
                        Pitch Stability:{' '}
                        {pitchStability() !== null ? pitchStability() : '--'} /
                        100
                      </span>
                    </div>
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: 'calc(100% - 1.5rem)',
                      }}
                    >
                      <CentsDeviationCanvas
                        isActive={isLiveActive()}
                        centsOffset={currentCentsOffset()}
                        targetNote={currentTargetNote()}
                      />
                    </div>
                  </div>
                  <div
                    class="live-canvas-wrap"
                    style={{
                      height: '100px',
                      flex: 1,
                      'min-width': 0,
                      'margin-top': '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        'justify-content': 'space-between',
                        'align-items': 'center',
                        'margin-bottom': '0.5rem',
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          color: 'rgba(255,255,255,0.7)',
                          'font-size': '0.875rem',
                        }}
                      >
                        Vibrato
                      </h4>
                    </div>
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: 'calc(100% - 1.5rem)',
                      }}
                    >
                      <VibratoWaveformCanvas
                        isActive={isLiveActive()}
                        vibrato={vibratoAnalysis()}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Show>
          </div>

          {/* Phase 4: Analysis Tools */}
          <div
            class="analysis-tools-section"
            style={{
              'margin-top': '16px',
              padding: '12px',
              background: 'rgba(255,255,255,0.02)',
              'border-radius': '8px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <h3
              style={{
                margin: '0 0 10px 0',
                'font-size': '0.85rem',
                color: 'rgba(255,255,255,0.6)',
              }}
            >
              🔬 Analysis Tools
            </h3>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                'flex-wrap': 'wrap',
                'margin-bottom': '12px',
              }}
            >
              <button
                class="spectrogram-cycle-btn"
                onClick={handleDetectBeats}
                disabled={isDetecting() || accumulatedSpectra().length < 10}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.7)',
                  'font-size': '0.72rem',
                  padding: '6px 12px',
                  'border-radius': '4px',
                  cursor:
                    accumulatedSpectra().length < 10
                      ? 'not-allowed'
                      : 'pointer',
                  opacity: accumulatedSpectra().length < 10 ? 0.4 : 1,
                }}
              >
                {isDetecting() ? 'Detecting…' : '🥁 Detect Beats'}
              </button>
              <button
                class="spectrogram-cycle-btn"
                onClick={handleDetectKey}
                disabled={isDetecting() || accumulatedSpectra().length < 10}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.7)',
                  'font-size': '0.72rem',
                  padding: '6px 12px',
                  'border-radius': '4px',
                  cursor:
                    accumulatedSpectra().length < 10
                      ? 'not-allowed'
                      : 'pointer',
                  opacity: accumulatedSpectra().length < 10 ? 0.4 : 1,
                }}
              >
                {isDetecting() ? 'Detecting…' : '🎹 Detect Key'}
              </button>
              <button
                class="spectrogram-cycle-btn"
                onClick={handleAlign}
                disabled={isAligning() || accumulatedSpectra().length < 10}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.7)',
                  'font-size': '0.72rem',
                  padding: '6px 12px',
                  'border-radius': '4px',
                  cursor:
                    accumulatedSpectra().length < 10
                      ? 'not-allowed'
                      : 'pointer',
                  opacity: accumulatedSpectra().length < 10 ? 0.4 : 1,
                }}
              >
                {isAligning() ? 'Aligning…' : '↔ Align to Ref'}
              </button>
              <button
                class="spectrogram-cycle-btn"
                onClick={handleDetectChords}
                disabled={isDetecting() || accumulatedSpectra().length < 10}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.7)',
                  'font-size': '0.72rem',
                  padding: '6px 12px',
                  'border-radius': '4px',
                  cursor:
                    accumulatedSpectra().length < 10
                      ? 'not-allowed'
                      : 'pointer',
                  opacity: accumulatedSpectra().length < 10 ? 0.4 : 1,
                }}
              >
                {isDetecting() ? 'Detecting…' : '🎸 Detect Chords'}
              </button>
              <button
                class="spectrogram-cycle-btn"
                onClick={handleSegment}
                disabled={isDetecting() || accumulatedSpectra().length < 20}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.7)',
                  'font-size': '0.72rem',
                  padding: '6px 12px',
                  'border-radius': '4px',
                  cursor:
                    accumulatedSpectra().length < 20
                      ? 'not-allowed'
                      : 'pointer',
                  opacity: accumulatedSpectra().length < 20 ? 0.4 : 1,
                }}
              >
                {isDetecting() ? 'Segmenting…' : '🧩 Segment Song'}
              </button>
              <span
                style={{
                  'font-size': '0.65rem',
                  color: 'rgba(255,255,255,0.3)',
                  'align-self': 'center',
                  'margin-left': '8px',
                }}
              >
                {accumulatedSpectra().length} frames · {availableTransforms()}{' '}
                plug-ins
              </span>
              <button
                class="spectrogram-cycle-btn"
                onClick={() => {
                  void (async () => {
                    const { exportWorkspace } = await import('@/lib/session-io')
                    exportWorkspace({
                      version: '1.0.0',
                      exportedAt: Date.now(),
                      annotations: annotations(),
                      paneLayout: paneLayout(),
                      analysisResults: {
                        onsets: onsetResults(),
                        key: detectedKey() ?? undefined,
                        chords: chordFrames(),
                        segments: segmentationResult()?.segments,
                        detectedBpm: detectedBpm() ?? undefined,
                      },
                    })
                  })()
                }}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.5)',
                  'font-size': '0.65rem',
                  padding: '2px 8px',
                  'border-radius': '4px',
                  cursor: 'pointer',
                  'margin-left': '8px',
                }}
              >
                💾 Export
              </button>
              <label
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.5)',
                  'font-size': '0.65rem',
                  padding: '2px 8px',
                  'border-radius': '4px',
                  cursor: 'pointer',
                }}
              >
                📂 Import
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    void (async () => {
                      const file = e.currentTarget.files?.[0]
                      if (file === undefined) return
                      const { importWorkspace } =
                        await import('@/lib/session-io')
                      const ws = await importWorkspace(file)
                      if (ws !== null) {
                        if (ws.annotations.length > 0)
                          setAnnotations(ws.annotations)
                        setPaneLayout(ws.paneLayout)
                        if (ws.analysisResults?.detectedBpm !== undefined) {
                          setDetectedBpm(ws.analysisResults.detectedBpm)
                        }
                      }
                    })()
                  }}
                />
              </label>
            </div>

            {/* Results cards */}
            <Show
              when={
                onsetResults().length > 0 ||
                detectedKey() ||
                alignmentResult() ||
                chordFrames().length > 0 ||
                segmentationResult()
              }
            >
              <div
                style={{ display: 'flex', gap: '10px', 'flex-wrap': 'wrap' }}
              >
                <Show when={onsetResults().length > 0}>
                  <div
                    style={{
                      flex: '1',
                      'min-width': '200px',
                      padding: '10px',
                      background: 'rgba(88,166,255,0.08)',
                      'border-radius': '6px',
                      border: '1px solid rgba(88,166,255,0.2)',
                    }}
                  >
                    <div
                      style={{
                        'font-size': '0.75rem',
                        color: 'rgba(255,255,255,0.5)',
                        'margin-bottom': '4px',
                      }}
                    >
                      🥁 Beat Detection
                    </div>
                    <div
                      style={{
                        'font-size': '0.85rem',
                        color: '#58a6ff',
                        'font-weight': '600',
                      }}
                    >
                      {onsetResults().filter((o) => o.isBeat).length} beats
                      <Show when={detectedBpm()}>
                        <span
                          style={{
                            'margin-left': '8px',
                            color: 'rgba(255,255,255,0.6)',
                          }}
                        >
                          ({detectedBpm()} BPM)
                        </span>
                      </Show>
                      <Show when={detectedBpm()}>
                        <button
                          onClick={() => setBpm(detectedBpm()!)}
                          style={{
                            'margin-left': '8px',
                            background: 'rgba(88,166,255,0.15)',
                            border: '1px solid rgba(88,166,255,0.3)',
                            color: '#58a6ff',
                            'font-size': '0.65rem',
                            padding: '1px 6px',
                            'border-radius': '3px',
                            cursor: 'pointer',
                          }}
                        >
                          Set Tempo
                        </button>
                      </Show>
                    </div>
                    <div
                      style={{
                        'font-size': '0.7rem',
                        color: 'rgba(255,255,255,0.4)',
                        'margin-top': '4px',
                      }}
                    >
                      {onsetResults().length} onsets · strongest at{' '}
                      {(onsetResults()[0]?.strength ?? 0).toFixed(2)}
                    </div>
                  </div>
                </Show>
                <Show when={detectedKey()}>
                  <div
                    style={{
                      flex: '1',
                      'min-width': '200px',
                      padding: '10px',
                      background: 'rgba(188,140,255,0.08)',
                      'border-radius': '6px',
                      border: '1px solid rgba(188,140,255,0.2)',
                    }}
                  >
                    <div
                      style={{
                        'font-size': '0.75rem',
                        color: 'rgba(255,255,255,0.5)',
                        'margin-bottom': '4px',
                      }}
                    >
                      🎹 Key Detection
                    </div>
                    <div
                      style={{
                        'font-size': '0.85rem',
                        color: '#bc8cff',
                        'font-weight': '600',
                      }}
                    >
                      {detectedKey()!.key}
                      <span
                        style={{
                          'margin-left': '8px',
                          color: 'rgba(255,255,255,0.5)',
                          'font-size': '0.7rem',
                        }}
                      >
                        ({(detectedKey()!.confidence * 100).toFixed(0)}% conf.)
                      </span>
                    </div>
                    <div
                      style={{
                        'font-size': '0.7rem',
                        color: 'rgba(255,255,255,0.4)',
                        'margin-top': '4px',
                      }}
                    >
                      Alt:{' '}
                      {detectedKey()!
                        .alternatives.slice(0, 2)
                        .map((a) => `${a.key} (${(a.score * 100).toFixed(0)}%)`)
                        .join(', ')}
                    </div>
                  </div>
                </Show>
                <Show when={alignmentResult()}>
                  <div
                    style={{
                      flex: '1',
                      'min-width': '200px',
                      padding: '10px',
                      background: 'rgba(63,185,80,0.08)',
                      'border-radius': '6px',
                      border: '1px solid rgba(63,185,80,0.2)',
                    }}
                  >
                    <div
                      style={{
                        'font-size': '0.75rem',
                        color: 'rgba(255,255,255,0.5)',
                        'margin-bottom': '4px',
                      }}
                    >
                      ↔ Alignment
                    </div>
                    <div
                      style={{
                        'font-size': '0.85rem',
                        color: '#3fb950',
                        'font-weight': '600',
                      }}
                    >
                      {(alignmentResult()!.similarityScore * 100).toFixed(0)}%
                      match
                      <span
                        style={{
                          'margin-left': '8px',
                          color: 'rgba(255,255,255,0.5)',
                          'font-size': '0.7rem',
                        }}
                      >
                        tempo ×{alignmentResult()!.tempoRatio.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </Show>
                <Show when={chordFrames().length > 0}>
                  <div
                    style={{
                      flex: '1',
                      'min-width': '280px',
                      padding: '10px',
                      background: 'rgba(242,145,73,0.08)',
                      'border-radius': '6px',
                      border: '1px solid rgba(242,145,73,0.2)',
                    }}
                  >
                    <div
                      style={{
                        'font-size': '0.75rem',
                        color: 'rgba(255,255,255,0.5)',
                        'margin-bottom': '4px',
                      }}
                    >
                      🎸 Chord Detection
                    </div>
                    <div
                      style={{
                        'font-size': '0.8rem',
                        color: '#f29149',
                        'font-weight': '600',
                        display: 'flex',
                        gap: '6px',
                        'flex-wrap': 'wrap',
                      }}
                    >
                      <For each={chordFrames().slice(0, 8)}>
                        {(c) => (
                          <span
                            style={{
                              padding: '1px 4px',
                              background: 'rgba(242,145,73,0.15)',
                              'border-radius': '3px',
                            }}
                          >
                            {c.chord}
                          </span>
                        )}
                      </For>
                    </div>
                    <div
                      style={{
                        'font-size': '0.7rem',
                        color: 'rgba(255,255,255,0.4)',
                        'margin-top': '4px',
                      }}
                    >
                      {chordFrames().length} chords ·{' '}
                      {new Set(chordFrames().map((c) => c.chord)).size} unique
                    </div>
                  </div>
                </Show>
                <Show when={segmentationResult()}>
                  <div
                    style={{
                      flex: '1',
                      'min-width': '300px',
                      padding: '10px',
                      background: 'rgba(45,212,191,0.08)',
                      'border-radius': '6px',
                      border: '1px solid rgba(45,212,191,0.2)',
                    }}
                  >
                    <div
                      style={{
                        'font-size': '0.75rem',
                        color: 'rgba(255,255,255,0.5)',
                        'margin-bottom': '4px',
                      }}
                    >
                      🧩 Song Structure
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        'flex-wrap': 'wrap',
                      }}
                    >
                      <For each={segmentationResult()!.segments}>
                        {(s) => (
                          <span
                            style={{
                              padding: '2px 6px',
                              'border-radius': '4px',
                              'font-size': '0.7rem',
                              'font-weight': '500',
                              background:
                                s.label === 'Chorus'
                                  ? 'rgba(63,185,80,0.2)'
                                  : s.label === 'Verse'
                                    ? 'rgba(88,166,255,0.2)'
                                    : 'rgba(255,255,255,0.08)',
                              color:
                                s.label === 'Chorus'
                                  ? '#3fb950'
                                  : s.label === 'Verse'
                                    ? '#58a6ff'
                                    : 'rgba(255,255,255,0.6)',
                            }}
                          >
                            {s.label}
                          </span>
                        )}
                      </For>
                    </div>
                    <div
                      style={{
                        'font-size': '0.7rem',
                        color: 'rgba(255,255,255,0.4)',
                        'margin-top': '4px',
                      }}
                    >
                      {segmentationResult()!.segments.length} sections ·{' '}
                      {segmentationResult()!.labels.length} types
                    </div>
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          {/* Pitch History */}
          <Show when={pitchChartData()}>
            <div class="pitch-history">
              <h3>Pitch History</h3>
              <div class="pitch-chart-wrap">
                <svg
                  viewBox="0 0 600 120"
                  class="pitch-chart-svg"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {(() => {
                    const chart = pitchChartData()!
                    const w = 600
                    const h = 120
                    const pL = 42
                    const pR = 10
                    const pT = 8
                    const pB = 20
                    const plotW = w - pL - pR
                    const plotH = h - pT - pB
                    const toX = (i: number) =>
                      pL + (i / Math.max(1, chart.points.length - 1)) * plotW
                    const toY = (midi: number) =>
                      pT +
                      ((chart.yMax - midi) / (chart.yMax - chart.yMin)) * plotH
                    const linePoints = chart.points
                      .map((d, i) => `${toX(i)},${toY(d.midi)}`)
                      .join(' ')
                    const areaPoints = `${pL},${h - pB} ${chart.points
                      .map((d, i) => `${toX(i)},${toY(d.midi)}`)
                      .join(' ')} ${pR + plotW},${h - pB}`
                    return (
                      <>
                        {/* Grid lines */}
                        <For each={chart.gridLines}>
                          {(g) => (
                            <g>
                              <line
                                x1={pL}
                                y1={toY(g)}
                                x2={w - pR}
                                y2={toY(g)}
                                stroke="var(--border)"
                                stroke-width="0.5"
                                stroke-dasharray="3,3"
                              />
                              <text
                                x={pL - 4}
                                y={toY(g) + 3}
                                text-anchor="end"
                                fill="var(--text-muted)"
                                font-size="8"
                                font-family="inherit"
                              >
                                {midiToNoteName(g)}
                              </text>
                            </g>
                          )}
                        </For>
                        {/* Area fill under the pitch line */}
                        <polygon
                          points={areaPoints}
                          fill="url(#pitchAreaGrad)"
                          opacity="0.35"
                        />
                        {/* Pitch line */}
                        <polyline
                          points={linePoints}
                          fill="none"
                          stroke="url(#pitchLineGrad)"
                          stroke-width="2.5"
                          stroke-linejoin="round"
                          stroke-linecap="round"
                          filter="url(#glow)"
                        />
                        {/* Data dots */}
                        <For each={chart.points}>
                          {(d, i) => {
                            const onPitch =
                              d.cents !== undefined && Math.abs(d.cents) < 25
                            return (
                              <circle
                                cx={toX(i())}
                                cy={toY(d.midi)}
                                r={onPitch ? 3 : 3.5}
                                fill={onPitch ? '#3fb950' : '#f85149'}
                                opacity="0.9"
                              >
                                <animate
                                  attributeName="opacity"
                                  from="0"
                                  to="0.9"
                                  dur="0.2s"
                                  begin={`${i() * 5}ms`}
                                  fill="freeze"
                                />
                              </circle>
                            )
                          }}
                        </For>
                        {/* SVG defs for gradients */}
                        <defs>
                          <filter
                            id="glow"
                            x="-20%"
                            y="-20%"
                            width="140%"
                            height="140%"
                          >
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite
                              in="SourceGraphic"
                              in2="blur"
                              operator="over"
                            />
                          </filter>
                          <linearGradient
                            id="pitchLineGrad"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="0"
                          >
                            <stop offset="0%" stop-color="#58a6ff" />
                            <stop offset="50%" stop-color="#bc8cff" />
                            <stop offset="100%" stop-color="#f85149" />
                          </linearGradient>
                          <linearGradient
                            id="pitchAreaGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stop-color="#58a6ff"
                              stop-opacity="0.6"
                            />
                            <stop
                              offset="100%"
                              stop-color="#58a6ff"
                              stop-opacity="0"
                            />
                          </linearGradient>
                        </defs>
                      </>
                    )
                  })()}
                </svg>
              </div>
              <div class="pitch-legend">
                <span class="legend-item">
                  <span class="dot good" /> Within 25¢
                </span>
                <span class="legend-item">
                  <span class="dot bad" /> Off pitch
                </span>
                <span class="legend-item">
                  Last {pitchChartData()!.points.length} notes
                </span>
              </div>
            </div>
          </Show>

          {/* Unit Converter */}
          <UnitConverter />

          {/* Transform Runner */}
          <TransformRunner />
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Live Metric Card Sub-component
// ============================================================

function LiveMetricCard(props: {
  label: string
  value: string
  detail: string
  highlight: boolean
  icon: () => ReturnType<typeof IconBolt>
  color: string
}) {
  return (
    <div
      class={`live-metric-card ${props.highlight ? 'highlight' : ''}`}
      style={{ '--metric-color': props.color }}
    >
      <div class="live-metric-icon" style={{ color: props.color }}>
        {props.icon()}
      </div>
      <div class="live-metric-body">
        <span class="live-metric-value">{props.value}</span>
        <span class="live-metric-label">{props.label}</span>
        <span class="live-metric-detail">{props.detail}</span>
      </div>
    </div>
  )
}

// ============================================================
// Helpers
// ============================================================

function rmsAmplitude(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i]
  }
  return Math.sqrt(sum / samples.length)
}
