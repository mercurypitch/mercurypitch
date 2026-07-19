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
import type { MelodyItem } from '@/types'

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
