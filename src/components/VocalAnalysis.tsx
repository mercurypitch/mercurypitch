// ============================================================
// VocalAnalysis — Vocal Analysis & Training Tab
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { IconPlay } from '@/components/hidden-features-icons'
import { loadSessionRecords } from '@/db/services/session-service'
import { IS_DEV } from '@/lib/defaults'
import { frequenciesToNoteName } from '@/lib/frequency-to-note'
import { PitchDetector } from '@/lib/pitch-detector'
import {
  analyzeFatigue,
  approximateBreathiness,
  approximateResonance,
  approximateRichness,
  detectSlides,
  detectVibrato,
  intensityFromPitchResults,
} from '@/lib/vocal-analyzer'
import type {
  BreathinessResult,
  FatigueCheckpoint,
  FatigueResult,
  HarmonicRichnessResult,
  ResonanceResult,
  SlideTrackingResult,
  VibratoResult,
} from '@/lib/vocal-analyzer'
import { generateMockSessions } from '@/lib/vocal-analysis-mock'
import { initAudioEngine } from '@/stores'
import type { AudioEngine } from '@/lib/audio-engine'
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

// ============================================================
// Types for Vocal Analysis
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

  // Live mic analysis signals
  const [analysisMode, setAnalysisMode] = createSignal<'history' | 'live'>('history')
  const [isLiveActive, setIsLiveActive] = createSignal(false)
  const [liveError, setLiveError] = createSignal<string | null>(null)
  const [liveSampleCount, setLiveSampleCount] = createSignal(0)
  let rafId: number | null = null
  let audioEngine: AudioEngine | null = null
  let pitchDetector: PitchDetector | null = null

  onMount(() => {
    void (async () => {
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
    })()
  })

  // Merge localStorage and DB session history
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

  // Calculate practice heatmap data (by day and hour)
  const _heatmapData = createMemo(() => {
    const heatmap = new Map<string, { sessions: number; totalScore: number }>()
    const sessions = history()

    for (const session of sessions) {
      const date = new Date(session.completedAt)
      const dayStr = date.toISOString().split('T')[0]
      const hour = date.getHours()

      const key = `${dayStr}-${hour}`
      const existing = heatmap.get(key) || { sessions: 0, totalScore: 0 }
      heatmap.set(key, {
        sessions: existing.sessions + 1,
        totalScore: existing.totalScore + (session.score || 0),
      })
    }

    return heatmap
  })

  // Average scores by day of week
  const weeklyScores = createMemo(() => {
    const scores = [0, 0, 0, 0, 0, 0, 0] // Mon-Sun
    const counts = [0, 0, 0, 0, 0, 0, 0]
    const sessions = history()

    for (const session of sessions) {
      const date = new Date(session.completedAt)
      const dayIndex = date.getDay() || 7 // Sunday = 7
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

  // Longest streak calculation
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

  // Check if user is belting (high intensity, high frequency variation)
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
    const midFreq = 440 // A4
    const isHighRange = avgFreq > midFreq * 1.5 // Belting is usually above A4
    const volumeVariation = maxVolume() / minVolume()

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

  // Check if user is using falsetto (light, airy sound)
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
    const midFreq = 440 // A4 frequency
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

  // Check for crescendo/decrescendo (dynamic control)
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

  // Helper to get volume metrics from run data
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

  // Start analyzing session history
  const startAnalysis = () => {
    setIsAnalyzing(true)
    setVocalRunData([])
    setSpectralData([])

    const allData = history()

    if (allData.length === 0) {
      setIsAnalyzing(false)
      return
    }

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
  }

  // Load demo data for preview when no sessions exist
  const loadDemoData = () => {
    const mock = generateMockSessions()
    setDbSessionRecords(mock)
    // Also run analysis immediately
    setTimeout(() => startAnalysis(), 50)
  }

  // ── Live Mic Analysis ──────────────────────────────────────────

  const startLiveAnalysis = async () => {
    setLiveError(null)
    setLiveSampleCount(0)
    setIsLiveActive(true)
    setVocalRunData([])
    setSpectralData([])

    try {
      audioEngine = await initAudioEngine()
      const ok = await audioEngine.startMic()
      if (!ok) {
        setLiveError('Microphone access denied or not available.')
        setIsLiveActive(false)
        return
      }

      pitchDetector = new PitchDetector({
        algorithm: 'yin',
        sampleRate: audioEngine.audioCtx.sampleRate,
        minConfidence: 0.3,
        minAmplitude: 0.02,
      })

      // Buffer of pitch samples accumulated from live mic
      const buffer: Array<{ time: number; freq: number; midi: number; clarity: number }> = []
      let frameCount = 0
      const ANALYSIS_INTERVAL = 90 // ~1.5s at 60fps

      const loop = () => {
        if (!isLiveActive() || !audioEngine || !pitchDetector) return

        const timeData = audioEngine.getTimeData()
        const result = pitchDetector.detect(timeData)

        if (result.frequency > 0 && result.confidence > 0.3) {
          buffer.push({
            time: performance.now() / 1000,
            freq: result.frequency,
            midi: result.midi,
            clarity: result.clarity,
          })
          setLiveSampleCount(buffer.length)
        }

        frameCount++
        if (frameCount % ANALYSIS_INTERVAL === 0 && buffer.length >= 3) {
          // Run Phase 1/2 analysis on accumulated buffer
          const snapshot = buffer.slice()

          // Intensity
          const intensity = intensityFromPitchResults(
            snapshot.map((s, i) => ({ time: i * 0.01, clarity: s.clarity, midi: s.midi })),
          )
          setIntensityProfile({
            avgDb: intensity.avgDb,
            peakDb: intensity.peakDb,
            dynamicRange: intensity.dynamicRange,
          })

          // Breathiness
          const breath = approximateBreathiness(
            snapshot.map((s) => ({ freq: s.freq, clarity: s.clarity })),
          )
          setBreathiness(breath)

          // Slide tracking
          if (snapshot.length >= 4) {
            const slides = detectSlides(snapshot)
            setSlideTracking(slides)
          }

          // Vibrato (need enough samples for modulation detection)
          if (snapshot.length >= 15) {
            const vibrato = detectVibrato(snapshot)
            setVibratoAnalysis(vibrato)
          }

          // Harmonic richness
          const richness = approximateRichness(
            snapshot.map((s) => ({ freq: s.freq, clarity: s.clarity })),
          )
          setHarmonicRichness({
            richnessScore: richness.richnessScore,
            harmonicCount: richness.harmonicCount,
            harmonicProfile: [],
            quality: richness.quality,
          })

          // Resonance zone
          const resonance = approximateResonance(
            snapshot.map((s) => ({ freq: s.freq })),
          )
          setResonanceData(resonance)

          // Build a vocal run data approximation for exercise checks
          setVocalRunData(
            snapshot.map((s) => ({
              freq: s.freq,
              midi: s.midi,
              note: '',
              noteName: '',
              clarity: s.clarity,
            })) as unknown as PitchResult[],
          )

          // Spectral approximation
          const spectral = snapshot.slice(-30).map((s, i) => ({
            frequency: s.freq,
            amplitude: s.clarity * 0.5,
            phase: (i / 30) * Math.PI * 2,
          }))
          setSpectralData(spectral)
        }

        rafId = requestAnimationFrame(loop)
      }

      rafId = requestAnimationFrame(loop)
    } catch (err) {
      setLiveError('Failed to start microphone: ' + (err as Error).message)
      setIsLiveActive(false)
    }
  }

  const stopLiveAnalysis = () => {
    setIsLiveActive(false)
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (audioEngine) {
      audioEngine.stopMic()
      audioEngine = null
    }
    pitchDetector = null
  }

  // Cleanup on unmount
  onCleanup(() => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    if (audioEngine) {
      audioEngine.stopMic()
      audioEngine = null
    }
  })

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

  return (
    <div class="vocal-analysis-tab">
      {/* Header */}
      <div class="vocal-header">
        <div class="vocal-header-content">
          <h2>Vocal Analysis</h2>
          <p class="vocal-subtitle">
            Track your progress, analyze technique, and improve your voice
          </p>
        </div>
        <div class="vocal-header-actions">
          {/* Mode toggle */}
          <div class="mode-toggle">
            <button
              class={`mode-toggle-btn ${analysisMode() === 'history' ? 'active' : ''}`}
              onClick={() => {
                setAnalysisMode('history')
                stopLiveAnalysis()
              }}
            >
              Session History
            </button>
            <button
              class={`mode-toggle-btn ${analysisMode() === 'live' ? 'active' : ''}`}
              onClick={() => setAnalysisMode('live')}
            >
              Live Mic
            </button>
          </div>

          {/* History mode button */}
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

          {/* Live mode controls */}
          <Show when={analysisMode() === 'live'}>
            <Show
              when={isLiveActive()}
              fallback={
                <button class="analyze-btn live-start-btn" onClick={startLiveAnalysis}>
                  <IconPlay /> Start Live Analysis
                </button>
              }
            >
              <div class="live-controls">
                <button class="analyze-btn live-stop-btn" onClick={stopLiveAnalysis}>
                  Stop Live Analysis
                </button>
                <span class="live-status">
                  <span class="live-dot" />
                  Live &middot; {liveSampleCount()} samples
                </span>
              </div>
            </Show>
          </Show>
        </div>
      </div>

      {/* Demo data hint — shown when no session history */}
      <Show when={analysisMode() === 'history' && !isAnalyzing() && history().length === 0 && !isLiveActive()}>
        <div class="demo-hint">
          <div class="demo-hint-icon">🎤</div>
          <div class="demo-hint-text">
            <strong>No practice sessions yet.</strong>
            <p>Start a practice session or try the Live Mic mode to analyze your voice in real time.</p>
            <Show when={IS_DEV}>
              <p class="demo-hint-dev">Developer: load mock data to preview analysis cards.</p>
            </Show>
          </div>
          <div class="demo-hint-actions">
            <Show when={IS_DEV}>
              <button class="demo-btn" onClick={loadDemoData}>
                Load Demo Data
              </button>
            </Show>
            <button class="demo-btn demo-btn--live" onClick={() => setAnalysisMode('live')}>
              Try Live Mic
            </button>
          </div>
        </div>
      </Show>

      {/* Live mic error */}
      <Show when={liveError()}>
        <div class="live-error">
          <span class="live-error-icon">⚠</span>
          {liveError()}
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
                          style={{
                            width: `${session.score || 0}%`,
                          }}
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
              <div class="exercise-result">
                <h4>
                  {exercises.find((e) => e.type === activeExercise())?.name ??
                    'Analysis'}
                </h4>
                <Show when={isAnalyzing()}>
                  <div class="analyzing-overlay">
                    <div class="analyzing-spinner" />
                    <p>Analyzing your voice...</p>
                  </div>
                </Show>
                <Show when={!isAnalyzing() && vocalRunData().length > 0}>
                  <div class="result-card">
                    <div
                      class={`result-header ${activeExercise() === 'belting' ? 'result-good' : activeExercise() === 'falsetto' ? 'result-good' : ''}`}
                    >
                      <div class="exercise-type">{activeExercise()}</div>
                    </div>
                    <div class={`result-feedback ${resultClass()}`}>
                      {feedbackMessage()}
                    </div>
                    <div class="result-metrics">
                      <div class="metric-item">
                        <span class="metric-label">Notes</span>
                        <span class="metric-value">{metrics().noteCount}</span>
                      </div>
                      <div class="metric-item">
                        <span class="metric-label">Min Freq</span>
                        <span class="metric-value">
                          {metrics().minFreq.toFixed(0)}Hz
                        </span>
                      </div>
                      <div class="metric-item">
                        <span class="metric-label">Max Freq</span>
                        <span class="metric-value">
                          {metrics().maxFreq.toFixed(0)}Hz
                        </span>
                      </div>
                      <div class="metric-item">
                        <span class="metric-label">Volume</span>
                        <span class="metric-value">
                          {metrics().avgVolume.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Show>
                <Show when={!isAnalyzing() && vocalRunData().length === 0}>
                  <div class="result-card result-empty">
                    <p>
                      Start singing to analyze your {activeExercise()}{' '}
                      technique.
                    </p>
                    <button class="start-analysis-btn" onClick={startAnalysis}>
                      Start Analysis
                    </button>
                  </div>
                </Show>
              </div>
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
                  <span class="phase1-value">
                    {breathiness()!.efficiency}%
                  </span>
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
                      <div class={`phase1-slide-item phase1-slide--${slide.type}`}>
                        <span class="phase1-slide-dir">
                          {slide.direction === 'ascending' ? '↑' : '↓'}
                        </span>
                        <span class="phase1-slide-span">
                          {slide.semitoneSpan.toFixed(1)} st
                        </span>
                        <span class="phase1-slide-type">{slide.type}</span>
                        <span class="phase1-slide-score">
                          {slide.score}%
                        </span>
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
                    opacity: Math.max(
                      0.3,
                      resonanceData()!.headRatio * 2,
                    ),
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
                    opacity: Math.max(
                      0.3,
                      resonanceData()!.maskRatio * 2,
                    ),
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
                    opacity: Math.max(
                      0.3,
                      resonanceData()!.chestRatio * 2,
                    ),
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
                  <For each={spectralData()}>
                    {(data) => (
                      <div
                        class="spectrogram-bar"
                        style={{
                          height: `${Math.min(100, data.amplitude)}%`,
                          background: `hsl(${240 - (data.frequency / 8000) * 240}, 70%, 50%)`,
                        }}
                      />
                    )}
                  </For>
                </div>
              </div>
            </div>
            <div class="spectrogram-legend">
              <span>Color = Frequency</span>
              <span>Height = Amplitude</span>
            </div>
          </div>

          {/* Pitch History Line */}
          <div class="pitch-history">
            <h3>Pitch History</h3>
            <div class="pitch-canvas-container">
              <div class="pitch-grid">
                <div class="pitch-lines">
                  <For each={Array(12).fill(0)}>
                    {(_, i) => (
                      <div
                        class="pitch-line"
                        style={{
                          transform: `translateY(${(i() / 12) * 100}%)`,
                        }}
                      />
                    )}
                  </For>
                </div>
                <div class="pitch-notes">
                  <For each={vocalRunData().slice(-24)}>
                    {(data) => {
                      const noteName = frequenciesToNoteName(data.freq)
                      return (
                        <div
                          class={`pitch-dot ${data.cents !== undefined && Math.abs(data.cents) < 25 ? 'pitch-good' : ''}`}
                          style={{
                            '--pitch-y': `${((data.midi - 48) / 36) * 100}%`,
                            '--pitch-x': `${(vocalRunData().indexOf(data) / Math.max(1, vocalRunData().length)) * 100}%`,
                          }}
                        >
                          <span class="pitch-note">{noteName}</span>
                        </div>
                      )
                    }}
                  </For>
                </div>
              </div>
            </div>
            <div class="pitch-legend">
              <span class="legend-item">
                <span class="dot good" /> Within 25¢ (Perfect/Excellent)
              </span>
              <span class="legend-item">
                <span class="dot bad" /> Beyond 25¢ (Needs work)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Helper for result styling
  function resultClass(): string {
    if (isAnalyzing()) return 'analyzing'
    if (vocalRunData().length === 0) return 'empty'
    const checkFn = getExerciseCheck(activeExercise() ?? 'belting')
    return checkFn.passed ? 'good' : 'neutral'
  }

  function feedbackMessage(): string {
    if (isAnalyzing()) return ''
    if (vocalRunData().length === 0) return ''
    const checkFn = getExerciseCheck(activeExercise() ?? 'belting')
    return checkFn.feedback
  }

  function metrics(): {
    noteCount: number
    minFreq: number
    maxFreq: number
    avgVolume: number
  } {
    if (isAnalyzing())
      return { noteCount: 0, minFreq: 0, maxFreq: 0, avgVolume: 0 }
    if (vocalRunData().length === 0)
      return { noteCount: 0, minFreq: 0, maxFreq: 0, avgVolume: 0 }
    const checkFn = getExerciseCheck(activeExercise() ?? 'belting')
    return checkFn.metrics
  }

  function getBarColor(score: number): string {
    if (score >= 90) return '#3fb950'
    if (score >= 75) return '#58a6ff'
    if (score >= 60) return '#2dd4bf'
    return '#d29922'
  }

  function getExerciseCheck(exerciseType: VocalExerciseType): ExerciseCheck {
    switch (exerciseType) {
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
          type: 'belting' as const,
          passed: false,
          confidence: 0,
          feedback: 'Select an exercise to analyze.',
          metrics: { noteCount: 0, minFreq: 0, maxFreq: 0, avgVolume: 0 },
        }
    }
  }

  function getRiffCheck(): ExerciseCheck {
    const runData = vocalRunData()
    if (runData.length < 6) {
      return {
        type: 'riffs' as const,
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
    return {
      type: 'riffs' as const,
      passed,
      confidence: Math.min(95, Math.round(density * 150)),
      feedback: passed
        ? 'Nice riff! Rapid note alternations detected.'
        : 'Try quick back-and-forth between adjacent notes for a riff.',
      metrics: {
        noteCount: runData.length,
        minFreq: 0,
        maxFreq: 0,
        avgVolume: 0,
      },
    }
  }

  function getRunCheck(): ExerciseCheck {
    const runData = vocalRunData()
    if (runData.length < 6) {
      return {
        type: 'runs' as const,
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
    return {
      type: 'runs' as const,
      passed,
      confidence: Math.min(95, maxConsecutive * 15),
      feedback: passed
        ? `Great run! ${maxConsecutive} consecutive stepwise notes detected.`
        : 'Try a sequence of adjacent notes moving up or down for a run.',
      metrics: {
        noteCount: runData.length,
        minFreq: 0,
        maxFreq: 0,
        avgVolume: 0,
      },
    }
  }
}
