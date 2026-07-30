// ============================================================
// League service — client for /api/league/me + the public ladder
// ============================================================
//
// Leagues are a registered-accounts-only surface; /api/league/me answers
// {eligible:false} for anonymous identities and the view renders a locked
// state. The ladder (the 7 rungs + trophy art) is public config, read
// straight from the generic CRUD API (leagues is an admin-read table).

import { getAuthHeaders } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'

export interface LeagueRung {
  id: string
  rank: number
  name: string
  /** The rung's sculpture — used everywhere the rung is shown. */
  trophyAsset: string | null
  /**
   * Enamel-pin art for the rung, in the same gem colour and carrying the same
   * note. Not currently rendered anywhere: the trophies are the league's face.
   * Kept because the pins are a finished set and the natural art for the
   * achievement/challenge badges that reuse these tiers.
   */
  badgeAsset: string | null
  isMystery: boolean
  promoteCount: number
  relegateCount: number
}

export interface LeagueStanding {
  userId: string
  displayName: string
  points: number
  rank: number
}

export interface LeagueMe {
  eligible: boolean
  /** 'anonymous' = registered-only rule; 'unavailable' = env predates leagues. */
  reason?: 'anonymous' | 'unavailable'
  weekStart?: string
  league?: LeagueRung
  points?: number
  rank?: number | null
  cohortSize?: number
  standings?: LeagueStanding[]
}

function base(): string {
  return API_BASE_URL ?? ''
}

/** The 7-rung ladder, ascending. Empty when no API / unreachable. */
export async function fetchLeagueLadder(): Promise<LeagueRung[]> {
  if (base() === '') return []
  try {
    const res = await fetch(`${base()}/api/leagues?orderBy=rank&orderDir=asc`)
    if (!res.ok) return []
    return (await res.json()) as LeagueRung[]
  } catch {
    return []
  }
}

/**
 * The signed-in user's league state, or null when signed out / unreachable
 * (the view falls back to the locked ladder-only presentation).
 */
export async function fetchLeagueMe(): Promise<LeagueMe | null> {
  if (base() === '') return null
  try {
    const res = await fetch(`${base()}/api/league/me`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) return null
    return (await res.json()) as LeagueMe
  } catch {
    return null
  }
}

/** ms until the next weekly cut (Monday 00:00 UTC), for the countdown. */
export function msUntilNextCut(nowMs: number = Date.now()): number {
  const now = new Date(nowMs)
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  monday.setUTCDate(monday.getUTCDate() - ((now.getUTCDay() + 6) % 7) + 7)
  return monday.getTime() - nowMs
}

/** "3d 4h" / "5h 12m" — coarse on purpose; the cut lands on a cron tick. */
export function formatCutCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
