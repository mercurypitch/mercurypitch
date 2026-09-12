// ============================================================
// Your takes — the kept summaries as rows, newest first
// ============================================================
//
// The store keeps takes OLDEST first (the newest is the last entry, which is
// what the end card's comparison line reads). A list a singer reads wants the
// opposite, and "reverse it at the call site" is how one surface ends up
// showing a different order from another.
//
// Everything the row says is a formatting decision over numbers that already
// exist, so none of it belongs in the component: the date, the duration, the
// range and the cents come from `take-summary`'s own formatters, which is
// what keeps a row and the end card that produced it saying the same words.

import type { SingTake } from '@/stores/sing-takes-store'
import { formatCentsValue, formatTakeDate, formatTakeDuration, } from './take-summary'

export interface SingTakeRow {
  /** The store's id — what Remove is called with. */
  id: string
  /** `2 September 2026, 9:38` */
  when: string
  /** `3 min` */
  duration: string
  /** `D3 to A4`, or a dash for a take that held nothing long enough. */
  range: string
  /** `12 cents` */
  held: string
  /** One line for the row's accessible name. */
  announce: string
}

/** `9:38` — the phone's own clock, the same form the end card uses. */
function clock(epochMs: number): string {
  const date = new Date(epochMs)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

function rangeOf(take: SingTake): string {
  if (take.lowNote === null || take.highNote === null) return '—'
  return `${take.lowNote} to ${take.highNote}`
}

export function singTakeRow(take: SingTake): SingTakeRow {
  const date = formatTakeDate(take.endedAt)
  const when = date === '' ? '' : `${date}, ${clock(take.endedAt)}`
  const duration = formatTakeDuration(take.durationMs)
  const range = rangeOf(take)
  const held = formatCentsValue(take.heldWithinCents)
  const rangeWords = range === '—' ? '' : `, ${range} touched`
  return {
    id: take.id,
    when,
    duration,
    range,
    held,
    announce: `${when}, ${duration}${rangeWords}, held within ${held}`,
  }
}

/** Every kept take as a row, newest first. */
export function singTakeRows(takes: readonly SingTake[]): SingTakeRow[] {
  return takes.map(singTakeRow).reverse()
}
