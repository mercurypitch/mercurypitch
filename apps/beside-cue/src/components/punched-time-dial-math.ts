// ============================================================
// Punched time dial math — deterministic clock and gesture mapping
// ============================================================
//
// Pointer movement is accumulated as signed degrees by the view. This module
// turns that movement into canonical local-clock minutes without coupling the
// record interaction to DOM geometry or animation timing.

export const MINUTES_PER_DAY = 24 * 60

export const PUNCHED_DIAL_GEOMETRY = {
  spindleDeadZoneRadius: 24,
  hourLayerOuterRadius: 92,
  // Include the narrow paper rim around the 194-unit vinyl, but not the
  // rectangular corners: a near-edge touch should not miss the whole dial.
  recordOuterRadius: 220,
} as const

export type TimeDialLayer = 'hour' | 'minute'
export interface TimeDialStepOptions {
  readonly large?: boolean
}

const CLOCK_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const MINUTE_LAYER_DEGREES_PER_MINUTE = 6
const HOUR_LAYER_DEGREES_PER_HOUR = 30
const DEFAULT_MINUTE_INTERVAL = 5

function finiteNumber(value: number, name: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`)
  }
  return value
}

/** Parses only a zero-padded 24-hour HH:mm string. */
export function parseClockTime(value: string): number | null {
  if (!CLOCK_TIME_PATTERN.test(value)) return null

  const [hours, minutes] = value.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

/** Wraps a signed minute value into one local-clock day. */
export function wrapDayMinutes(totalMinutes: number): number {
  const minutes = finiteNumber(totalMinutes, 'totalMinutes')
  const wrapped =
    ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return Object.is(wrapped, -0) ? 0 : wrapped
}

/** Formats the nearest whole minute as a zero-padded 24-hour HH:mm string. */
export function formatClockTime(totalMinutes: number): string {
  const minutes = wrapDayMinutes(Math.round(totalMinutes))
  const hours = Math.floor(minutes / 60)
  const minuteOfHour = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minuteOfHour).padStart(2, '0')}`
}

/** Returns the shortest signed angular delta in the half-open [-180, 180) range. */
export function normalizeAngularDelta(deltaDegrees: number): number {
  const delta = finiteNumber(deltaDegrees, 'deltaDegrees')
  const normalized = ((((delta + 180) % 360) + 360) % 360) - 180
  return Object.is(normalized, -0) ? 0 : normalized
}

/** Resolves a record-space radius to the latched interaction layer. */
export function classifyTimeDialLayer(radius: number): TimeDialLayer | null {
  if (!Number.isFinite(radius) || radius < 0) return null
  if (radius <= PUNCHED_DIAL_GEOMETRY.spindleDeadZoneRadius) return null
  if (radius <= PUNCHED_DIAL_GEOMETRY.hourLayerOuterRadius) return 'hour'
  if (radius <= PUNCHED_DIAL_GEOMETRY.recordOuterRadius) return 'minute'
  return null
}

/** Detects spindle crossings between samples in centre-relative record coordinates. */
export function segmentCrossesTimeDialSpindle(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): boolean {
  const deltaX = endX - startX
  const deltaY = endY - startY
  const lengthSquared = deltaX * deltaX + deltaY * deltaY
  const closestFraction =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, -(startX * deltaX + startY * deltaY) / lengthSquared),
        )
  const closestX = startX + closestFraction * deltaX
  const closestY = startY + closestFraction * deltaY
  return (
    Math.hypot(closestX, closestY) <=
    PUNCHED_DIAL_GEOMETRY.spindleDeadZoneRadius
  )
}

/**
 * Maps an accumulated drag angle from its latched layer to a clock value.
 * Hour movement always adds whole hours, so the minute-of-hour is preserved.
 */
export function applyDialAngularDelta(
  startMinutes: number,
  angularDeltaDegrees: number,
  layer: TimeDialLayer,
): number {
  const start = Math.round(finiteNumber(startMinutes, 'startMinutes'))
  const delta = finiteNumber(angularDeltaDegrees, 'angularDeltaDegrees')

  if (layer === 'hour') {
    const hourDelta = Math.round(delta / HOUR_LAYER_DEGREES_PER_HOUR)
    return wrapDayMinutes(start + hourDelta * 60)
  }

  const minuteDelta = Math.round(delta / MINUTE_LAYER_DEGREES_PER_MINUTE)
  return wrapDayMinutes(start + minuteDelta)
}

/** Snaps a release to its nearest minute detent, wrapping midnight cleanly. */
export function snapMinutesToInterval(
  totalMinutes: number,
  intervalMinutes = DEFAULT_MINUTE_INTERVAL,
): number {
  const minutes = finiteNumber(totalMinutes, 'totalMinutes')
  if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0) {
    throw new RangeError('intervalMinutes must be a positive integer.')
  }

  return wrapDayMinutes(Math.round(minutes / intervalMinutes) * intervalMinutes)
}

/** Applies an accessible arrow or large keyboard step to the active layer. */
export function stepDialTime(
  totalMinutes: number,
  layer: TimeDialLayer,
  direction: -1 | 1,
  options: TimeDialStepOptions = {},
): number {
  const minutes = Math.round(finiteNumber(totalMinutes, 'totalMinutes'))
  if (direction !== -1 && direction !== 1) {
    throw new RangeError('direction must be -1 or 1.')
  }

  const stepMinutes =
    options.large === true || layer === 'hour' ? 60 : DEFAULT_MINUTE_INTERVAL
  return wrapDayMinutes(minutes + stepMinutes * direction)
}
