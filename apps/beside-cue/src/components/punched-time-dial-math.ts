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
  recordOuterRadius: 204,
} as const

export type TimeDialLayer = 'hour' | 'minute'
export type TimeDialTouchIntent = 'pending' | 'spin' | 'yield'

export interface TimeDialTouchIntentSample {
  readonly startX: number
  readonly startY: number
  readonly currentX: number
  readonly currentY: number
  readonly centerX: number
  readonly centerY: number
}

export interface TimeDialStepOptions {
  readonly large?: boolean
}

const CLOCK_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const MINUTE_LAYER_DEGREES_PER_MINUTE = 6
const HOUR_LAYER_DEGREES_PER_HOUR = 30
const DEFAULT_MINUTE_INTERVAL = 5
const TOUCH_INTENT_SLOP_PX = 10
const TOUCH_HORIZONTAL_DOMINANCE = 1.2
const TOUCH_TANGENTIAL_DOMINANCE = 1.35

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

/**
 * Separates a deliberate record turn from a page-scroll gesture. Touch only
 * wins after clear horizontal, tangential travel; vertical or radial motion
 * is yielded to the browser so the record never becomes a scroll trap.
 */
export function classifyTimeDialTouchIntent(
  sample: TimeDialTouchIntentSample,
): TimeDialTouchIntent {
  const values = [
    sample.startX,
    sample.startY,
    sample.currentX,
    sample.currentY,
    sample.centerX,
    sample.centerY,
  ]
  if (values.some((value) => !Number.isFinite(value))) return 'yield'

  const deltaX = sample.currentX - sample.startX
  const deltaY = sample.currentY - sample.startY
  if (Math.hypot(deltaX, deltaY) < TOUCH_INTENT_SLOP_PX) return 'pending'

  const absoluteX = Math.abs(deltaX)
  const absoluteY = Math.abs(deltaY)
  if (absoluteY * TOUCH_HORIZONTAL_DOMINANCE >= absoluteX) return 'yield'

  const radialX = sample.startX - sample.centerX
  const radialY = sample.startY - sample.centerY
  const radius = Math.hypot(radialX, radialY)
  if (radius < 1) return 'yield'

  const radialTravel = Math.abs((deltaX * radialX + deltaY * radialY) / radius)
  const tangentialTravel = Math.abs(
    (deltaX * -radialY + deltaY * radialX) / radius,
  )
  return tangentialTravel >= radialTravel * TOUCH_TANGENTIAL_DOMINANCE
    ? 'spin'
    : 'yield'
}

/** Resolves a record-space radius to the latched interaction layer. */
export function classifyTimeDialLayer(radius: number): TimeDialLayer | null {
  if (!Number.isFinite(radius) || radius < 0) return null
  if (radius <= PUNCHED_DIAL_GEOMETRY.spindleDeadZoneRadius) return null
  if (radius <= PUNCHED_DIAL_GEOMETRY.hourLayerOuterRadius) return 'hour'
  if (radius <= PUNCHED_DIAL_GEOMETRY.recordOuterRadius) return 'minute'
  return null
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
