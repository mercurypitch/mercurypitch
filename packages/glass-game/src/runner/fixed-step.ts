// ============================================================
// Song runner fixed-step clock — one quantization rule for core and compiler.
// ============================================================

const EPSILON = 1e-9

/** Return the first epoch-relative fixed-step boundary at or after course time. */
export function runnerFixedStepAtOrAfter(
  courseSeconds: number,
  epochStartCourseSeconds: number,
  fixedStepSeconds: number,
): number {
  const elapsed = Math.max(0, courseSeconds - epochStartCourseSeconds)
  const steps = Math.ceil(elapsed / fixedStepSeconds - EPSILON)
  return epochStartCourseSeconds + steps * fixedStepSeconds
}

/** Quantize input, then return the boundary where its timed action is complete. */
export function runnerFixedStepActionEnd(
  inputCourseSeconds: number,
  actionDurationSeconds: number,
  epochStartCourseSeconds: number,
  fixedStepSeconds: number,
): number {
  const start = runnerFixedStepAtOrAfter(
    inputCourseSeconds,
    epochStartCourseSeconds,
    fixedStepSeconds,
  )
  return runnerFixedStepAtOrAfter(
    start + actionDurationSeconds,
    epochStartCourseSeconds,
    fixedStepSeconds,
  )
}
