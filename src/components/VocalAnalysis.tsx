// ============================================================
// VocalAnalysis — Vocal Analysis & Training Tab
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, onCleanup, Show } from 'solid-js'
import { frequenciesToNoteName } from '@/lib/frequency-to-note'
import { getSessionHistory } from '@/stores'
import type { NoteResult, PitchResult, SessionResult } from '@/types'

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
  const [history] = createSignal<SessionResult[]>(getSessionHistory())
  const [_selectedDate, _setSelectedDate] = createSignal<string>('all')

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
        ? '✓ Great belting technique! Your chest voice projection is strong.'
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
          ? '✓ Clean falsetto! Your head voice resonance is smooth.'
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
        ? '✓ Excellent dynamic control! Your volume changes smoothly.'
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

  // Start analyzing current input
  const startAnalysis = () => {
    setIsAnalyzing(true)
    setVocalRunData([])
    setSpectralData([])

    // Simulate real analysis (would connect to real mic data in production)
    let analysisComplete = false
    const maxNotes = 100

    const interval = setInterval(() => {
      const allData = getSessionHistory()
      if (allData.length > 0) {
        // Convert SessionResult[] to PitchResult[] by flattening practiceItemResult
        const practiceResults = allData.flatMap(
          (s) => s.practiceItemResult,
        )
        setVocalRunData(
          practiceResults
            .flatMap((p) => p.noteResult)
            .map((r) => ({
              freq: r.pitchFreq || 0,
              midi: r.item.note.midi,
              note: r.item.note.name,
              noteName: r.item.note.name,
              clarity: r.avgCents || 0,
            })) as PitchResult[],
        )
        // Build spectral approximation
        const spectral: SpectrumData[] = practiceResults
          .slice(-30)
          .map((r: NoteResult, i: number) => ({
            frequency: r.pitchFreq,
            amplitude: r.avgCents * 3,
            phase: (i / 30) * Math.PI * 2,
          }))
        setSpectralData(spectral)
      }

      const runHistory = getSessionHistory()
      if (runHistory.length >= maxNotes || analysisComplete) {
        clearInterval(interval)
        setIsAnalyzing(false)
        analysisComplete = true
      }
    }, 100)

    onCleanup(() => clearInterval(interval))
  }

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
        <button
          class="analyze-btn"
          onClick={startAnalysis}
          disabled={isAnalyzing()}
        >
          {isAnalyzing() ? 'Analyzing...' : '▶ Start Vocal Analysis'}
        </button>
      </div>

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
                  {(exercises.find((e) => e.type === activeExercise())?.name) ?? 'Analysis'}
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

  function metrics(): { noteCount: number; minFreq: number; maxFreq: number; avgVolume: number } {
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
    return {
      type: 'riffs' as const,
      passed: false,
      confidence: 0,
      feedback: 'Record a riff.',
      metrics: { noteCount: 0, minFreq: 0, maxFreq: 0, avgVolume: 0 },
    }
  }

  function getRunCheck(): ExerciseCheck {
    return {
      type: 'runs' as const,
      passed: false,
      confidence: 0,
      feedback: 'Record a run.',
      metrics: { noteCount: 0, minFreq: 0, maxFreq: 0, avgVolume: 0 },
    }
  }
}
