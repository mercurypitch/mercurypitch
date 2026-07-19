// ============================================================
// Weekly "Sing the Legend" challenge — API client
// ============================================================
//
// Talks to the db-worker's custom /api/weekly/* handlers (the weeklyChallenges
// table is NOT a generic CRUD entity). active/board/archive are public reads;
// create/update are X-Admin-Key gated (used by seeding + the future admin
// page). Everything degrades to null when no API is configured or on error —
// telemetry/UI must never break the app.

import { getAuthHeaders } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'
import { midiToFrequency, midiToNoteName, noteToMidi, } from '@/lib/frequency-to-note'
import type { MelodyItem, NoteName } from '@/types'

export interface WeeklyChallenge {
  id: string
  slug: string
  title: string
  description: string
  featType: string
  voiceTypeSplit: unknown
  difficulty: string
  targetItems: MelodyItem[]
  targetScore: number
  hearItUrl: string | null
  startsAt: string
  endsAt: string
  rewardBadgeId: string | null
  founderScore: number | null
  founderTrace: unknown
  status: string
}

export interface WeeklyBoardEntry {
  rank: number
  displayName: string
  best: number
  isFounder: boolean
}

export interface WeeklyBoard {
  top: WeeklyBoardEntry[]
  attemptedCount: number
  completedCount: number
  targetScore: number
  founderScore: number | null
  frozen: boolean
  you: {
    best: number
    rank: number
    percentile: number
    beatFounder: boolean
    completed: boolean
  } | null
}

function base(): string {
  return API_BASE_URL ?? ''
}

export async function getActiveWeekly(): Promise<WeeklyChallenge | null> {
  if (base() === '') return null
  try {
    const res = await fetch(`${base()}/api/weekly/active`)
    if (!res.ok) return null
    const data = (await res.json()) as { challenge: WeeklyChallenge | null }
    return data.challenge
  } catch {
    return null
  }
}

export async function getWeeklyBoard(id: string): Promise<WeeklyBoard | null> {
  if (base() === '') return null
  try {
    const res = await fetch(
      `${base()}/api/weekly/board?id=${encodeURIComponent(id)}`,
      { headers: getAuthHeaders() },
    )
    if (!res.ok) return null
    return (await res.json()) as WeeklyBoard
  } catch {
    return null
  }
}

export async function getWeeklyArchive(): Promise<
  (WeeklyChallenge & { results: unknown })[]
> {
  if (base() === '') return []
  try {
    const res = await fetch(`${base()}/api/weekly/archive`)
    if (!res.ok) return []
    const data = (await res.json()) as {
      archive: (WeeklyChallenge & { results: unknown })[]
    }
    return data.archive ?? []
  } catch {
    return []
  }
}

// ── Admin (X-Admin-Key) — used by seeding + the authoring page (PR 3) ──

export async function createWeekly(
  payload: Record<string, unknown>,
  adminKey: string,
): Promise<{ id: string } | { error: string }> {
  if (base() === '') return { error: 'No API configured' }
  try {
    const res = await fetch(`${base()}/api/weekly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: JSON.stringify(payload),
    })
    return (await res.json()) as { id: string } | { error: string }
  } catch (e) {
    return { error: String(e) }
  }
}

export async function updateWeekly(
  id: string,
  patch: Record<string, unknown>,
  adminKey: string,
): Promise<boolean> {
  if (base() === '') return false
  try {
    const res = await fetch(`${base()}/api/weekly/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: JSON.stringify(patch),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Whole-hours until `endsAt`, floored at 0 (for the hero countdown). */
export function hoursUntil(endsAtIso: string): number {
  const ms = Date.parse(endsAtIso) - Date.now()
  return Math.max(0, Math.floor(ms / 3_600_000))
}

// ── Admin authoring (the /admin/weekly page) ─────────────────────────

const ADMIN_KEY_STORAGE = 'pitchperfect_admin_key'

/** Raw admin row — targetItems arrives as a JSON string from /all. */
export interface WeeklyAdminRow {
  id: string
  slug: string
  title: string
  description: string
  featType: string
  difficulty: string
  targetItems: string
  targetScore: number
  hearItUrl: string | null
  startsAt: string
  endsAt: string
  rewardBadgeId: string | null
  founderScore: number | null
  evergreen: number
  status: string
}

export function getAdminKey(): string {
  try {
    return localStorage.getItem(ADMIN_KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export function setAdminKey(key: string): void {
  try {
    if (key !== '') localStorage.setItem(ADMIN_KEY_STORAGE, key)
    else localStorage.removeItem(ADMIN_KEY_STORAGE)
  } catch {
    // ignore
  }
}

/** List every row (incl. queued) for the authoring page. null = auth failed. */
export async function listAllWeekly(
  adminKey: string,
): Promise<WeeklyAdminRow[] | null> {
  if (base() === '') return null
  try {
    const res = await fetch(`${base()}/api/weekly/all`, {
      headers: { 'X-Admin-Key': adminKey },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { challenges: WeeklyAdminRow[] }
    return data.challenges ?? []
  } catch {
    return null
  }
}

export async function deleteWeekly(
  id: string,
  adminKey: string,
): Promise<boolean> {
  if (base() === '') return false
  try {
    const res = await fetch(`${base()}/api/weekly/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Key': adminKey },
    })
    return res.ok
  } catch {
    return false
  }
}

/** Parse a "G4 A4 B4" note-name list into MelodyItem[] (unknown names dropped). */
export function notesToMelodyItems(input: string): MelodyItem[] {
  const names = input
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s !== '')
  const items: MelodyItem[] = []
  names.forEach((name, i) => {
    let midi: number
    try {
      midi = noteToMidi(name)
    } catch {
      return
    }
    if (!Number.isFinite(midi)) return
    items.push({
      id: i + 1,
      note: {
        midi,
        name: midiToNoteName(midi) as NoteName,
        octave: Math.floor(midi / 12) - 1,
        freq: midiToFrequency(midi),
      },
      duration: 1,
      startBeat: i,
    })
  })
  return items
}

/** Render MelodyItem[] back to a "G4 A4 B4" note-name list (for editing). */
export function melodyItemsToNotes(items: MelodyItem[]): string {
  return items
    .map((it) => `${midiToNoteName(it.note.midi)}${it.note.octave}`)
    .join(' ')
}

/** Monday 00:00 UTC of the current week (ISO) — the default challenge start. */
export function thisMondayUtcIso(): string {
  const d = new Date()
  const monday = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - ((d.getUTCDay() + 6) % 7),
  )
  return new Date(monday).toISOString()
}

/** startsAt + 7 days (ISO) — the default challenge end. */
export function plusOneWeekIso(startIso: string): string {
  return new Date(Date.parse(startIso) + 7 * 86_400_000).toISOString()
}
