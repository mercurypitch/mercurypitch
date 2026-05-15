// ============================================================
// VocalAnalysis — Vocal Analysis & Training Tab
// ============================================================

import type { Component } from 'solid-js'
import { onCleanup, createMemo, createSignal, For, onMount, Show } from 'solid-js'
import { IconPlay } from '@/components/hidden-features-icons'
import { useEngines } from '@/contexts/EngineContext'
import { IS_DEV } from '@/lib/defaults'
import type { LiveAnalysisSnapshot, LivePitchSample, } from '@/lib/live-pitch-analysis'
import { analyzeLiveBuffer } from '@/lib/live-pitch-analysis'
import { PitchDetector } from '@/lib/pitch-detector'
import { generateMockSessions } from '@/lib/vocal-analysis-mock'
import type { BreathinessResult, FatigueCheckpoint, FatigueResult, HarmonicRichnessResult, ResonanceResult, SlideTrackingResult, VibratoResult, } from '@/lib/vocal-analyzer'
import { analyzeFatigue, approximateBreathiness, approximateResonance, approximateRichness, detectSlides, detectVibrato, intensityFromPitchResults, } from '@/lib/vocal-analyzer'
import { getSessionHistory } from '@/stores'
import type { PitchResult, PracticeResult, SessionResult } from '@/types'

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

  // ── Live Mic Mode State ────────────────────────────────────
  const [analysisMode, setAnalysisMode] = createSignal<AnalysisMode>('history')
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

  // ── Engine refs for live mode ──────────────────────────────
  let engines: ReturnType<typeof useEngines> | null = null
  let pitchDetector: PitchDetector | null = null
  let rafId = 0
  let lastAnalysisTime = 0
  let recordingStartTime = 0
  let frameCount = 0

  // Try to get engine context (may fail outside EngineProvider)
  try {
    engines = useEngines()
  } catch {
    engines = null
  }

  onMount(() => {
    void (async () => {
      try {
        const { loadSessionRecords } =
          await import('@/db/services/session-service')
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

      setIsLiveActive(true)
      recordingStartTime = performance.now()
      lastAnalysisTime = recordingStartTime

      const tick = () => {
        if (!isLiveActive()) return

        frameCount++
        const timeData = engines!.audioEngine.getTimeData()
        const now = performance.now()
        const elapsed = (now - recordingStartTime) / 1000

        if (timeData.length > 0) {
          const detected = pitchDetector!.detect(timeData)
          if (
            detected !== null &&
            detected.clarity > 0.3 &&
            detected.frequency > 65
          ) {
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

            // Update spectrogram from live mic spectrum
            const freqData = engines!.audioEngine.getFrequencyData()
            if (freqData.length > 0) {
              const spectral: SpectrumData[] = []
              const step = Math.max(1, Math.floor(freqData.length / 30))
              for (let i = 0; i < 30; i++) {
                const idx = Math.min(i * step, freqData.length - 1)
                spectral.push({
                  frequency: (idx / freqData.length) * 8000,
                  amplitude: Math.max(0, (freqData[idx] + 100) * 1.5),
                  phase: (i / 30) * Math.PI * 2,
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
    frameCount = 0
    // Keep buffer + snapshot for display
  }

  onCleanup(() => {
    if (isLiveActive()) stopLiveAnalysis()
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
    const freqs = runData.map((r) => r.freq)
    const avgFreq = freqs.reduce((a, b) => a + b, 0) / freqs.length
    const midFreq = 440
    const isHighRange = avgFreq > midFreq * 1.5
    const volumeVariation = maxVolume() / Math.max(1, minVolume())
    return {
      type: 'belting',
      passed: isHighRange && volumeVariation > 1.3,
      confidence: Math.min(95, Math.round((volumeVariation - 1) * 50)),
      feedback: isHighRange
        ? 'Great belting technique! Your chest voice projection is strong.'
        : 'Try singing at a higher intensity to engage your chest voice.',
      metrics: {
        noteCount: runData.length,
        minFreq: Math.min(...freqs),
        maxFreq: Math.max(...freqs),
        avgVolume: avgVolume(),
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
    const freqs = runData.map((r) => r.freq)
    const avgFreq = freqs.reduce((a, b) => a + b, 0) / freqs.length
    const midFreq = 440
    const isHighRange = avgFreq > midFreq * 1.2
    const volume = avgVolume()
    return {
      type: 'falsetto',
      passed: isHighRange && volume < 60,
      confidence: Math.min(90, Math.round((120 - volume) * 1.2)),
      feedback:
        volume < 60
          ? 'Clean falsetto! Your head voice resonance is smooth.'
          : 'Try reducing volume slightly to let your head voice ring more.',
      metrics: {
        noteCount: runData.length,
        minFreq: Math.min(...freqs),
        maxFreq: Math.max(...freqs),
        avgVolume: volume,
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
    const volumes = runData.map((r) => r.clarity)
    const minV = Math.min(...volumes)
    const maxV = Math.max(...volumes)
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
        minFreq: Math.min(...runData.map((r) => r.freq)),
        maxFreq: Math.max(...runData.map((r) => r.freq)),
        avgVolume: (minV + maxV) / 2,
      },
    }
  }

  const avgVolume = (): number => {
    const runData = vocalRunData()
    if (runData.length === 0) return 0
    return runData.reduce((a, r) => a + (r.clarity || 0), 0) / runData.length
  }

  const minVolume = (): number => {
    const runData = vocalRunData()
    if (runData.length === 0) return 0
    return Math.min(...runData.map((r) => r.clarity || 0))
  }

  const maxVolume = (): number => {
    const runData = vocalRunData()
    if (runData.length === 0) return 0
    return Math.max(...runData.map((r) => r.clarity || 0))
  }

  // ── Start Analysis (History Mode) ──────────────────────────

  // Start analyzing session history
  const startAnalysis = () => {
    setIsAnalyzing(true)
    setVocalRunData([])
    setSpectralData([])

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

      // Build spectral approximation
      const spectral: SpectrumData[] = practiceResults
        .slice(-30)
        .map((r: PracticeResult, i: number) => ({
          frequency: r.score * 20,
          amplitude: Math.abs(r.avgCents) * 3,
          phase: (i / 30) * Math.PI * 2,
        }))
      setSpectralData(spectral)

      setIsAnalyzing(false)
    } else {
      setIsAnalyzing(false)
    }
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
          <div class="mode-toggle">
            <button
              class={`mode-toggle-btn ${analysisMode() === 'history' ? 'active' : ''}`}
              onClick={() => {
                setAnalysisMode('history')
                if (isLiveActive()) stopLiveAnalysis()
              }}
            >
              Session History
            </button>
            <button
              class={`mode-toggle-btn ${analysisMode() === 'live' ? 'active' : ''}`}
              onClick={() => setAnalysisMode('live')}
            >
              <IconMic />
              Live Mic
            </button>
          </div>
          {/* Action Button */}
          <Show when={analysisMode() === 'history'}>
            <button
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
          <p>DEV: Inject mock session data for testing.</p>
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
                    {getExerciseCheck(activeExercise() ?? 'belting').passed ? (
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
                    <button class="start-analysis-btn" onClick={startAnalysis}>
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

          {/* Phase 1: Intensity Profile */}
          <Show when={intensityProfile()}>
            <div class="stat-card phase1-card">
              <h3>Intensity Profile</h3>
              <div class="phase1-metrics">
                <div class="phase1-metric">
                  <span class="phase1-label">Avg Level</span>
                  <span class="phase1-value">
                    {intensityProfile()!.avgDb.toFixed(1)} dB
                  </span>
                </div>
                <div class="phase1-metric">
                  <span class="phase1-label">Peak</span>
                  <span class="phase1-value">
                    {intensityProfile()!.peakDb.toFixed(1)} dB
                  </span>
                </div>
                <div class="phase1-metric">
                  <span class="phase1-label">Dynamic Range</span>
                  <span class="phase1-value">
                    {intensityProfile()!.dynamicRange.toFixed(1)} dB
                  </span>
                </div>
              </div>
              <div class="phase1-bar-container">
                <div
                  class="phase1-bar phase1-bar-intensity"
                  style={{
                    width: `${Math.min(100, Math.max(0, (intensityProfile()!.dynamicRange / 40) * 100))}%`,
                  }}
                />
              </div>
              <div class="phase1-hint">
                {intensityProfile()!.dynamicRange > 20
                  ? 'Good dynamic range — expressive singing'
                  : 'Limited dynamic range — try varying your volume more'}
              </div>
            </div>
          </Show>

          {/* Phase 1: Breathiness Meter */}
          <Show when={breathiness()}>
            <div class="stat-card phase1-card">
              <h3>Breathiness Efficiency</h3>
              <div class="phase1-metrics">
                <div class="phase1-metric">
                  <span class="phase1-label">HNR</span>
                  <span class="phase1-value">{breathiness()!.hnrDb} dB</span>
                </div>
                <div class="phase1-metric">
                  <span class="phase1-label">Quality</span>
                  <span
                    class={`phase1-badge phase1-badge--${breathiness()!.quality}`}
                  >
                    {breathiness()!.quality}
                  </span>
                </div>
                <div class="phase1-metric">
                  <span class="phase1-label">Efficiency</span>
                  <span class="phase1-value">{breathiness()!.efficiency}%</span>
                </div>
              </div>
              <div class="phase1-bar-container">
                <div
                  class="phase1-bar phase1-bar-breathiness"
                  style={{
                    width: `${breathiness()!.efficiency}%`,
                  }}
                />
              </div>
              <div class="phase1-hint">
                {breathiness()!.quality === 'resonant'
                  ? 'Clean, efficient tone — great breath support'
                  : breathiness()!.quality === 'pressed'
                    ? 'Very tight tone — try relaxing slightly'
                    : breathiness()!.quality === 'breathy'
                      ? 'Airy tone — work on breath support exercises'
                      : 'Decent tone — keep working on resonance'}
              </div>
            </div>
          </Show>

          {/* Phase 1: Slide Tracking */}
          <Show when={slideTracking()}>
            <div class="stat-card phase1-card">
              <h3>Slide & Transition Analysis</h3>
              <div class="phase1-metrics">
                <div class="phase1-metric">
                  <span class="phase1-label">Transitions</span>
                  <span class="phase1-value">
                    {slideTracking()!.totalTransitions}
                  </span>
                </div>
                <div class="phase1-metric">
                  <span class="phase1-label">Clean</span>
                  <span class="phase1-value phase1-value--good">
                    {slideTracking()!.cleanCount}
                  </span>
                </div>
                <div class="phase1-metric">
                  <span class="phase1-label">Scoops</span>
                  <span class="phase1-value phase1-value--warn">
                    {slideTracking()!.scoopCount}
                  </span>
                </div>
                <div class="phase1-metric">
                  <span class="phase1-label">Overall</span>
                  <span class="phase1-value">
                    {slideTracking()!.overallScore}%
                  </span>
                </div>
              </div>
              <div class="phase1-bar-container">
                <div
                  class="phase1-bar phase1-bar-slides"
                  style={{
                    width: `${slideTracking()!.overallScore}%`,
                  }}
                />
              </div>
              <Show when={slideTracking()!.slides.length > 0}>
                <div class="phase1-slide-list">
                  <For each={slideTracking()!.slides.slice(0, 5)}>
                    {(slide) => (
                      <div
                        class={`phase1-slide-item phase1-slide--${slide.type}`}
                      >
                        <span class="phase1-slide-dir">
                          {slide.direction === 'ascending' ? '↑' : '↓'}
                        </span>
                        <span class="phase1-slide-span">
                          {slide.semitoneSpan.toFixed(1)} st
                        </span>
                        <span class="phase1-slide-type">{slide.type}</span>
                        <span class="phase1-slide-score">{slide.score}%</span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={slideTracking()!.slides.length === 0}>
                <div class="phase1-hint">
                  Not enough note transitions detected. Try singing a melody
                  with more note changes.
                </div>
              </Show>
            </div>
          </Show>

          {/* Phase 2.1: Vibrato Oscilloscope */}
          <Show when={vibratoAnalysis()}>
            <div class="stat-card phase2-card">
              <h3>Vibrato Detection</h3>
              <div class="phase2-metrics">
                <div class="phase2-metric">
                  <span class="phase2-label">Rate</span>
                  <span class="phase2-value">
                    {vibratoAnalysis()!.detected
                      ? `${vibratoAnalysis()!.rateHz.toFixed(1)} Hz`
                      : '—'}
                  </span>
                </div>
                <div class="phase2-metric">
                  <span class="phase2-label">Depth</span>
                  <span class="phase2-value">
                    {vibratoAnalysis()!.detected
                      ? `${vibratoAnalysis()!.depthCents}¢`
                      : '—'}
                  </span>
                </div>
                <div class="phase2-metric">
                  <span class="phase2-label">Type</span>
                  <span
                    class={`phase2-badge phase2-badge--${vibratoAnalysis()!.classification}`}
                  >
                    {vibratoAnalysis()!.classification === 'none'
                      ? 'None'
                      : vibratoAnalysis()!.classification === 'slow-operatic'
                        ? 'Operatic'
                        : vibratoAnalysis()!.classification === 'natural'
                          ? 'Natural'
                          : vibratoAnalysis()!.classification === 'nervous'
                            ? 'Nervous'
                            : 'Wide'}
                  </span>
                </div>
                <div class="phase2-metric">
                  <span class="phase2-label">Confidence</span>
                  <span class="phase2-value">
                    {vibratoAnalysis()!.confidence}%
                  </span>
                </div>
              </div>
              <div class="phase2-bar-container">
                <div
                  class="phase2-bar phase2-bar-vibrato"
                  style={{
                    width: `${vibratoAnalysis()!.confidence}%`,
                  }}
                />
              </div>
              <div class="phase2-hint">
                <Show
                  when={vibratoAnalysis()!.detected}
                  fallback="No vibrato detected — try sustaining a note with gentle pitch wobble"
                >
                  {vibratoAnalysis()!.classification === 'natural'
                    ? 'Natural, musical vibrato — excellent control'
                    : vibratoAnalysis()!.classification === 'slow-operatic'
                      ? 'Slow, operatic vibrato — dramatic and controlled'
                      : vibratoAnalysis()!.classification === 'nervous'
                        ? 'Fast, nervous vibrato — try slowing it down'
                        : 'Wide vibrato — consider tightening pitch control'}
                </Show>
              </div>
            </div>
          </Show>

          {/* Phase 2.2: Harmonic Richness Score */}
          <Show when={harmonicRichness()}>
            <div class="stat-card phase2-card">
              <h3>Harmonic Richness</h3>
              <div class="phase2-metrics">
                <div class="phase2-metric">
                  <span class="phase2-label">Score</span>
                  <span class="phase2-value">
                    {harmonicRichness()!.richnessScore}
                  </span>
                </div>
                <div class="phase2-metric">
                  <span class="phase2-label">Harmonics</span>
                  <span class="phase2-value">
                    {harmonicRichness()!.harmonicCount}
                  </span>
                </div>
                <div class="phase2-metric">
                  <span class="phase2-label">Quality</span>
                  <span
                    class={`phase2-badge phase2-badge--${harmonicRichness()!.quality}`}
                  >
                    {harmonicRichness()!.quality === 'thin'
                      ? 'Thin'
                      : harmonicRichness()!.quality === 'normal'
                        ? 'Normal'
                        : harmonicRichness()!.quality === 'rich'
                          ? 'Rich'
                          : 'Very Rich'}
                  </span>
                </div>
              </div>
              <div class="phase2-bar-container">
                <div
                  class="phase2-bar phase2-bar-harmonics"
                  style={{
                    width: `${harmonicRichness()!.richnessScore}%`,
                  }}
                />
              </div>
              <div class="phase2-hint">
                {harmonicRichness()!.quality === 'very-rich'
                  ? 'Exceptionally rich tone — full harmonic spectrum'
                  : harmonicRichness()!.quality === 'rich'
                    ? 'Rich, full tone with strong overtones'
                    : harmonicRichness()!.quality === 'normal'
                      ? 'Decent harmonic presence — room for more resonance'
                      : 'Thin tone — try opening your throat for more resonance'}
              </div>
            </div>
          </Show>

          {/* Phase 2.3: Resonance Zone Detection */}
          <Show when={resonanceData()}>
            <div class="stat-card phase2-card">
              <h3>Resonance Zone</h3>
              <div class="phase2-resonance-map">
                <div
                  class="phase2-zone phase2-zone-head"
                  classList={{
                    'phase2-zone--active':
                      resonanceData()!.dominantZone === 'head' ||
                      resonanceData()!.dominantZone === 'mixed',
                  }}
                  style={{
                    opacity: Math.max(0.3, resonanceData()!.headRatio * 2),
                  }}
                >
                  <span class="phase2-zone-label">Head</span>
                  <span class="phase2-zone-pct">
                    {(resonanceData()!.headRatio * 100).toFixed(0)}%
                  </span>
                </div>
                <div
                  class="phase2-zone phase2-zone-mask"
                  classList={{
                    'phase2-zone--active':
                      resonanceData()!.dominantZone === 'mask' ||
                      resonanceData()!.dominantZone === 'mixed',
                  }}
                  style={{
                    opacity: Math.max(0.3, resonanceData()!.maskRatio * 2),
                  }}
                >
                  <span class="phase2-zone-label">Mask</span>
                  <span class="phase2-zone-pct">
                    {(resonanceData()!.maskRatio * 100).toFixed(0)}%
                  </span>
                </div>
                <div
                  class="phase2-zone phase2-zone-chest"
                  classList={{
                    'phase2-zone--active':
                      resonanceData()!.dominantZone === 'chest' ||
                      resonanceData()!.dominantZone === 'mixed',
                  }}
                  style={{
                    opacity: Math.max(0.3, resonanceData()!.chestRatio * 2),
                  }}
                >
                  <span class="phase2-zone-label">Chest</span>
                  <span class="phase2-zone-pct">
                    {(resonanceData()!.chestRatio * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div class="phase2-metrics">
                <div class="phase2-metric">
                  <span class="phase2-label">Dominant</span>
                  <span
                    class={`phase2-badge phase2-badge--${resonanceData()!.dominantZone}`}
                  >
                    {resonanceData()!.dominantZone === 'chest'
                      ? 'Chest'
                      : resonanceData()!.dominantZone === 'mask'
                        ? 'Mask'
                        : resonanceData()!.dominantZone === 'head'
                          ? 'Head'
                          : 'Mixed'}
                  </span>
                </div>
                <div class="phase2-metric">
                  <span class="phase2-label">Centroid</span>
                  <span class="phase2-value">
                    {resonanceData()!.spectralCentroid} Hz
                  </span>
                </div>
              </div>
              <div class="phase2-hint">
                {resonanceData()!.dominantZone === 'mixed'
                  ? 'Balanced mixed voice — smooth blend of registers'
                  : resonanceData()!.dominantZone === 'chest'
                    ? 'Strong chest resonance — powerful lower register'
                    : resonanceData()!.dominantZone === 'mask'
                      ? 'Forward mask resonance — bright, projected tone'
                      : 'Head voice dominant — light, airy upper register'}
              </div>
            </div>
          </Show>

          {/* Phase 2.4: Vocal Fatigue Tracker */}
          <Show when={fatigueData()}>
            <div class="stat-card phase2-card">
              <h3>Vocal Fatigue Tracker</h3>
              <div class="phase2-metrics">
                <div class="phase2-metric">
                  <span class="phase2-label">Breath</span>
                  <span
                    class={`phase2-value ${fatigueData()!.trends.hnrTrend < -5 ? 'phase2-value--warn' : ''}`}
                  >
                    {fatigueData()!.trends.hnrTrend > 0 ? '+' : ''}
                    {fatigueData()!.trends.hnrTrend}%
                  </span>
                </div>
                <div class="phase2-metric">
                  <span class="phase2-label">Harmonics</span>
                  <span
                    class={`phase2-value ${fatigueData()!.trends.richnessTrend < -5 ? 'phase2-value--warn' : ''}`}
                  >
                    {fatigueData()!.trends.richnessTrend > 0 ? '+' : ''}
                    {fatigueData()!.trends.richnessTrend}%
                  </span>
                </div>
                <div class="phase2-metric">
                  <span class="phase2-label">Stability</span>
                  <span
                    class={`phase2-value ${fatigueData()!.trends.stabilityTrend < -5 ? 'phase2-value--warn' : ''}`}
                  >
                    {fatigueData()!.trends.stabilityTrend > 0 ? '+' : ''}
                    {fatigueData()!.trends.stabilityTrend}%
                  </span>
                </div>
              </div>
              <Show when={fatigueData()!.fatigued}>
                <div class="phase2-alert">{fatigueData()!.alert}</div>
              </Show>
              <Show when={!fatigueData()!.fatigued}>
                <div class="phase2-hint">
                  {fatigueData()!.checkpoints.length < 3
                    ? 'Need more session data to track fatigue trends'
                    : 'Voice metrics are stable — no fatigue detected'}
                </div>
              </Show>
            </div>
          </Show>

          {/* Spectrogram Display */}
          <div class="spectrogram-display">
            <h3>Spectrum Analysis</h3>
            <div class="spectrogram-container">
              <div class="spectrogram-grid">
                <div class="freq-axis">
                  <div class="freq-label">8000</div>
                  <div class="freq-label">4000</div>
                  <div class="freq-label">2000</div>
                  <div class="freq-label">1000</div>
                  <div class="freq-label">500</div>
                </div>
                <div class="time-axis">
                  <div class="time-label">0s</div>
                  <div class="time-label">2s</div>
                  <div class="time-label">4s</div>
                  <div class="time-label">6s</div>
                  <div class="time-label">8s</div>
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
          </div>

          {/* Pitch History */}
          <Show when={pitchChartData()}>
            <div class="pitch-history">
              <h3>Pitch History</h3>
              <div class="pitch-chart-wrap">
                <svg
                  viewBox="0 0 600 150"
                  class="pitch-chart-svg"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {(() => {
                    const chart = pitchChartData()!
                    const w = 600
                    const h = 150
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
                          opacity="0.15"
                        />
                        {/* Pitch line */}
                        <polyline
                          points={linePoints}
                          fill="none"
                          stroke="url(#pitchLineGrad)"
                          stroke-width="2"
                          stroke-linejoin="round"
                          stroke-linecap="round"
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
                          <linearGradient
                            id="pitchLineGrad"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="0"
                          >
                            <stop offset="0%" stop-color="#58a6ff" />
                            <stop offset="100%" stop-color="#bc8cff" />
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

function midiToNoteName(midi: number): string {
  const names = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ]
  const octave = Math.floor(midi / 12) - 1
  const name = names[Math.round(midi) % 12]
  return `${name}${octave}`
}
