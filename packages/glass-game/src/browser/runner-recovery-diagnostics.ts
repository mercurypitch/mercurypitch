// Runner recovery diagnostics — bounded clock and control facts, with no captured voice data.
export type RunnerAdvanceSource = 'frame' | 'capture' | 'input'

const milliseconds = (value: number) =>
  Math.max(0, Math.min(60000, Math.round(value)))

/** Construct only behind the portable-console gate; ordinary frames never log. */
export function createRunnerRecoveryDiagnostics(catchUpLimitSeconds: number) {
  let remaining = 8
  let lastAdvance: number | null = null
  let lastPresentation: number | null = null
  let lastSteering: number | null = null
  let steeringAxis = 0
  return {
    reset() {
      lastAdvance = null
      lastPresentation = null
      lastSteering = null
      steeringAxis = 0
    },
    steer(axis: number) {
      steeringAxis = axis
      lastSteering = performance.now()
    },
    advance(
      source: RunnerAdvanceSource,
      requestedCourseSeconds: number,
      audioGapSeconds: number,
    ) {
      const now = performance.now()
      if (audioGapSeconds > catchUpLimitSeconds + 1e-9 && remaining > 0) {
        remaining--
        console.warn('[Glassworks runner recovery]', {
          reason: 'frame-gap',
          source,
          requestedCourseSeconds:
            Math.round(requestedCourseSeconds * 1000) / 1000,
          audioGapMs: milliseconds(audioGapSeconds * 1000),
          wallGapMs:
            lastAdvance === null ? null : milliseconds(now - lastAdvance),
          // Age of the presentation callback, not a measurement of GPU completion.
          presentationAgeMs:
            lastPresentation === null
              ? null
              : milliseconds(now - lastPresentation),
          catchUpLimitMs: milliseconds(catchUpLimitSeconds * 1000),
          steeringAxis,
          steeringAgeMs:
            lastSteering === null ? null : milliseconds(now - lastSteering),
        })
      }
      lastAdvance = now
      if (source === 'frame') lastPresentation = now
    },
  }
}
