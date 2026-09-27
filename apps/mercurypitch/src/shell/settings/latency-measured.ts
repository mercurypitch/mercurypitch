// ============================================================
// The day the latency was measured, per input (S6 7a)
// ============================================================
//
// The wizard keeps its number per input (mic-latency-store). The phone keeps
// the day beside it, for the same input, so the Latency row can say
// "Measured 21 September 2026". Kept here rather than in the number's own
// store so the web's store, and everything that reads it, stays as it was.
// A number measured before this existed has no day, and the row then says
// only the number.

import { createSignal } from 'solid-js'
import { currentMicDeviceKey } from '@/stores/mic-latency-store'

const KEY = 'mp:mic-latency-measured'

type Days = Record<string, string>

function isDays(value: unknown): value is Days {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((day) => typeof day === 'string')
  )
}

function read(): Days {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    return isDays(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const [days, setDays] = createSignal<Days>(read())

function write(next: Days): void {
  setDays(next)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Blocked storage: the day shows until the app closes.
  }
}

/** Keep the day for the input in use, after a measurement is applied. */
export function recordLatencyMeasured(at: Date = new Date()): void {
  write({ ...days(), [currentMicDeviceKey()]: at.toISOString() })
}

/** Forget the day for the input in use, after its offset is cleared. */
export function forgetLatencyMeasured(): void {
  const next = { ...days() }
  delete next[currentMicDeviceKey()]
  write(next)
}

/** When the input in use was measured, or null. Reactive. */
export function latencyMeasuredAt(): Date | null {
  const iso = days()[currentMicDeviceKey()]
  if (iso === undefined) return null
  const at = new Date(iso)
  return Number.isNaN(at.getTime()) ? null : at
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** "Measured 21 September 2026". */
export function measuredLine(at: Date): string {
  return `Measured ${DAY_FORMAT.format(at)}`
}

/** Tests: read again from storage, as a fresh start would. */
export function resetLatencyMeasured(): void {
  setDays(read())
}
