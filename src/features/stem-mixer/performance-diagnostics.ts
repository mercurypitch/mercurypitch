export type StemMixerPerformanceStage =
  | 'analysis'
  | 'overview'
  | 'pitch'
  | 'midi'
  | 'live'

export interface StemMixerStagePerformance {
  calls: number
  callsPerSecond: number
  averageMs: number
  worstMs: number
}

export interface StemMixerPerformanceSnapshot {
  sampledMs: number
  animation: {
    frames: number
    fps: number
    averageIntervalMs: number
    worstIntervalMs: number
    longFrames: number
  }
  stages: Record<StemMixerPerformanceStage, StemMixerStagePerformance>
}

export interface StemMixerPerformanceDiagnostics {
  enabled: () => boolean
  start: (nowMs?: number) => void
  stop: (nowMs?: number) => StemMixerPerformanceSnapshot
  reset: (nowMs?: number) => void
  snapshot: (nowMs?: number) => StemMixerPerformanceSnapshot
  recordFrame: (timestampMs: number) => void
  measure: <T>(stage: StemMixerPerformanceStage, work: () => T) => T
}

export function hasStemMixerPerformanceActivity(
  snapshot: StemMixerPerformanceSnapshot,
): boolean {
  return (
    snapshot.animation.frames > 0 ||
    Object.values(snapshot.stages).some((stage) => stage.calls > 0)
  )
}

export function selectLatestActivePerformanceSnapshot(
  current: StemMixerPerformanceSnapshot,
  previous: StemMixerPerformanceSnapshot | null,
): StemMixerPerformanceSnapshot {
  return hasStemMixerPerformanceActivity(current) || previous === null
    ? current
    : previous
}

interface MutableStagePerformance {
  calls: number
  totalMs: number
  worstMs: number
}

const PERFORMANCE_STAGES: StemMixerPerformanceStage[] = [
  'analysis',
  'overview',
  'pitch',
  'midi',
  'live',
]

const createStageCounters = (): Record<
  StemMixerPerformanceStage,
  MutableStagePerformance
> => ({
  analysis: { calls: 0, totalMs: 0, worstMs: 0 },
  overview: { calls: 0, totalMs: 0, worstMs: 0 },
  pitch: { calls: 0, totalMs: 0, worstMs: 0 },
  midi: { calls: 0, totalMs: 0, worstMs: 0 },
  live: { calls: 0, totalMs: 0, worstMs: 0 },
})

export function createStemMixerPerformanceDiagnostics(
  longFrameThresholdMs = 50,
): StemMixerPerformanceDiagnostics {
  let isEnabled = false
  let hasStarted = false
  let startedAtMs = 0
  let lastFrameAtMs: number | null = null
  let frames = 0
  let frameIntervals = 0
  let totalFrameIntervalMs = 0
  let worstFrameIntervalMs = 0
  let longFrames = 0
  let stages = createStageCounters()

  const reset = (nowMs = performance.now()): void => {
    hasStarted = true
    startedAtMs = nowMs
    lastFrameAtMs = null
    frames = 0
    frameIntervals = 0
    totalFrameIntervalMs = 0
    worstFrameIntervalMs = 0
    longFrames = 0
    stages = createStageCounters()
  }

  const snapshot = (
    nowMs = performance.now(),
  ): StemMixerPerformanceSnapshot => {
    const sampledMs = hasStarted ? Math.max(0, nowMs - startedAtMs) : 0
    const stageSnapshot = Object.fromEntries(
      PERFORMANCE_STAGES.map((stage) => {
        const stats = stages[stage]
        return [
          stage,
          {
            calls: stats.calls,
            callsPerSecond:
              sampledMs > 0 ? (stats.calls * 1000) / sampledMs : 0,
            averageMs: stats.calls > 0 ? stats.totalMs / stats.calls : 0,
            worstMs: stats.worstMs,
          },
        ]
      }),
    ) as Record<StemMixerPerformanceStage, StemMixerStagePerformance>

    return {
      sampledMs,
      animation: {
        frames,
        fps:
          totalFrameIntervalMs > 0
            ? (frameIntervals * 1000) / totalFrameIntervalMs
            : 0,
        averageIntervalMs:
          frameIntervals > 0 ? totalFrameIntervalMs / frameIntervals : 0,
        worstIntervalMs: worstFrameIntervalMs,
        longFrames,
      },
      stages: stageSnapshot,
    }
  }

  return {
    enabled: () => isEnabled,
    start(nowMs = performance.now()): void {
      isEnabled = true
      reset(nowMs)
    },
    stop(nowMs = performance.now()): StemMixerPerformanceSnapshot {
      const finalSnapshot = snapshot(nowMs)
      isEnabled = false
      return finalSnapshot
    },
    reset,
    snapshot,
    recordFrame(timestampMs: number): void {
      if (!isEnabled || !Number.isFinite(timestampMs)) return
      frames++
      if (lastFrameAtMs !== null) {
        const intervalMs = timestampMs - lastFrameAtMs
        if (intervalMs >= 0) {
          frameIntervals++
          totalFrameIntervalMs += intervalMs
          worstFrameIntervalMs = Math.max(worstFrameIntervalMs, intervalMs)
          if (intervalMs > longFrameThresholdMs) longFrames++
        }
      }
      lastFrameAtMs = timestampMs
    },
    measure<T>(stage: StemMixerPerformanceStage, work: () => T): T {
      if (!isEnabled) return work()
      const startedAt = performance.now()
      try {
        return work()
      } finally {
        const durationMs = performance.now() - startedAt
        const stats = stages[stage]
        stats.calls++
        stats.totalMs += durationMs
        stats.worstMs = Math.max(stats.worstMs, durationMs)
      }
    },
  }
}
