// ============================================================
// Punched time dial math tests — clock, seam, and hit-zone invariants
// ============================================================

import { describe, expect, it } from 'vitest'
import { applyDialAngularDelta, classifyTimeDialLayer, formatClockTime, normalizeAngularDelta, parseClockTime, PUNCHED_DIAL_GEOMETRY, snapMinutesToInterval, stepDialTime, wrapDayMinutes, } from './punched-time-dial-math'

describe('punched time dial clock values', () => {
  it('round-trips every canonical edge time without dropping zero padding', () => {
    // Arrange
    const times = ['00:00', '00:05', '09:07', '23:59']

    // Act
    const roundTrips = times.map((time) => {
      const minutes = parseClockTime(time)
      return minutes === null ? null : formatClockTime(minutes)
    })

    // Assert
    expect(roundTrips).toEqual(times)
  })

  it.each([
    '',
    '0:00',
    '00:0',
    ' 09:30',
    '09:30 ',
    '09.30',
    '24:00',
    '12:60',
    '12:30:00',
  ])('rejects non-canonical clock string %j', (value) => {
    // Arrange
    const invalidTime = value

    // Act
    const parsed = parseClockTime(invalidTime)

    // Assert
    expect(parsed).toBeNull()
  })

  it('wraps movement across both ends of the day', () => {
    // Arrange
    const beforeMidnight = 23 * 60 + 59

    // Act
    const afterMidnight = wrapDayMinutes(beforeMidnight + 2)
    const beforeStart = wrapDayMinutes(-1)

    // Assert
    expect(afterMidnight).toBe(1)
    expect(beforeStart).toBe(23 * 60 + 59)
    expect(formatClockTime(afterMidnight)).toBe('00:01')
    expect(formatClockTime(beforeStart)).toBe('23:59')
  })
})

describe('punched time dial gesture mapping', () => {
  it('takes the shortest signed path through the angular seam', () => {
    // Arrange
    const clockwiseAcrossSeam = 1 - 359
    const counterClockwiseAcrossSeam = 359 - 1

    // Act
    const clockwise = normalizeAngularDelta(clockwiseAcrossSeam)
    const counterClockwise = normalizeAngularDelta(counterClockwiseAcrossSeam)

    // Assert
    expect(clockwise).toBe(2)
    expect(counterClockwise).toBe(-2)
    expect(normalizeAngularDelta(181)).toBe(-179)
    expect(normalizeAngularDelta(-181)).toBe(179)
  })

  it('moves minutes one step per six degrees and rolls the hour naturally', () => {
    // Arrange
    const startMinutes = parseClockTime('23:58') ?? 0

    // Act
    const result = applyDialAngularDelta(startMinutes, 18, 'minute')

    // Assert
    expect(formatClockTime(result)).toBe('00:01')
  })

  it('moves hours one step per thirty degrees while preserving minutes', () => {
    // Arrange
    const startMinutes = parseClockTime('10:37') ?? 0

    // Act
    const result = applyDialAngularDelta(startMinutes, -60, 'hour')

    // Assert
    expect(formatClockTime(result)).toBe('08:37')
  })

  it('snaps minute releases to five-minute detents across midnight', () => {
    // Arrange
    const nearMidnight = parseClockTime('23:58') ?? 0
    const beforeDetent = parseClockTime('10:12') ?? 0

    // Act
    const midnight = snapMinutesToInterval(nearMidnight, 5)
    const tenPast = snapMinutesToInterval(beforeDetent, 5)

    // Assert
    expect(formatClockTime(midnight)).toBe('00:00')
    expect(formatClockTime(tenPast)).toBe('10:10')
  })
})

describe('punched time dial hit zones', () => {
  it('keeps the spindle and space outside the record inert', () => {
    // Arrange
    const { spindleDeadZoneRadius, recordOuterRadius } = PUNCHED_DIAL_GEOMETRY

    // Act
    const center = classifyTimeDialLayer(0)
    const spindleEdge = classifyTimeDialLayer(spindleDeadZoneRadius)
    const outside = classifyTimeDialLayer(recordOuterRadius + 0.01)
    const visibleRegisterEdge = classifyTimeDialLayer(203)

    // Assert
    expect(center).toBeNull()
    expect(spindleEdge).toBeNull()
    expect(visibleRegisterEdge).toBe('minute')
    expect(outside).toBeNull()
  })

  it('assigns the label and groove boundaries to deterministic layers', () => {
    // Arrange
    const { spindleDeadZoneRadius, hourLayerOuterRadius, recordOuterRadius } =
      PUNCHED_DIAL_GEOMETRY

    // Act
    const justPastSpindle = classifyTimeDialLayer(spindleDeadZoneRadius + 0.01)
    const hourEdge = classifyTimeDialLayer(hourLayerOuterRadius)
    const firstGroove = classifyTimeDialLayer(hourLayerOuterRadius + 0.01)
    const recordEdge = classifyTimeDialLayer(recordOuterRadius)

    // Assert
    expect(justPastSpindle).toBe('hour')
    expect(hourEdge).toBe('hour')
    expect(firstGroove).toBe('minute')
    expect(recordEdge).toBe('minute')
  })
})

describe('punched time dial keyboard steps', () => {
  it('uses layer-sized arrows and a one-hour large step', () => {
    // Arrange
    const startMinutes = parseClockTime('23:58') ?? 0

    // Act
    const minuteArrow = stepDialTime(startMinutes, 'minute', 1)
    const hourArrow = stepDialTime(startMinutes, 'hour', -1)
    const largeStep = stepDialTime(startMinutes, 'minute', 1, {
      large: true,
    })

    // Assert
    expect(formatClockTime(minuteArrow)).toBe('00:03')
    expect(formatClockTime(hourArrow)).toBe('22:58')
    expect(formatClockTime(largeStep)).toBe('00:58')
  })
})
