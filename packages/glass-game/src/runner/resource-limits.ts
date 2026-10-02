// ============================================================
// Song runner resource limits — bounded schema-one PCM and count-in allocation.
// ============================================================

// At 24 kHz, two Float32 buses use 34.56 MB over 180 seconds. Their Web Audio
// copies can double that budget, before decoded recordings and rendered art.
export const RUNNER_MAXIMUM_COURSE_SECONDS = 180
export const RUNNER_MAXIMUM_COUNT_IN_BEATS = 16
export const RUNNER_MAXIMUM_COUNT_IN_SECONDS = 16
