// ============================================================
// League service — client for /api/league/me + the public ladder
// ============================================================
//
// Leagues are a registered-accounts-only surface; /api/league/me answers
// {eligible:false} for anonymous identities and the view renders a locked
// state. The ladder (the 7 rungs + trophy art) is public config, read
// straight from the generic CRUD API (leagues is an admin-read table).

import { handleAuthErrorResponse } from '@/db/services/auth-service'
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
 * What reading the league came back with, and WHY when it has none.
 *
 * `refused` is a session the server would not take: a 401, or the 403 a
 * suspended account gets. Any other 403 is no answer, as for every data
 * read (db/index.ts signs out on a 401 only), so a block somewhere on the
 * way never signs a singer out. `unreachable` is a network or a server
 * that could not answer. The native shell tells the two apart, as the
 * account card does (auth-me-service.ts `readMe`): a refused session is
 * asked to sign in again, not told to check the connection.
 */
export type LeagueMeRead =
  | { status: 'ok'; me: LeagueMe }
  | { status: 'refused' }
  | { status: 'unreachable' }

/** One GET of /api/league/me: its response, or null with no answer. */
async function requestLeagueMe(): Promise<Response | null> {
  if (base() === '') return null
  try {
    return await fetch(`${base()}/api/league/me`, {
      headers: getAuthHeaders(),
    })
  } catch {
    return null
  }
}

/** The signed-in user's league state, or why there is none. */
export async function readLeagueMe(): Promise<LeagueMeRead> {
  const res = await requestLeagueMe()
  if (res === null) return { status: 'unreachable' }
  if (!res.ok) {
    // A suspended account is told so here as on every other read.
    const body = await res.text().catch(() => '')
    const suspended = handleAuthErrorResponse(res.status, body)
    return res.status === 401 || suspended
      ? { status: 'refused' }
      : { status: 'unreachable' }
  }
  try {
    return { status: 'ok', me: (await res.json()) as LeagueMe }
  } catch {
    return { status: 'unreachable' }
  }
}

/**
 * The signed-in user's league state, or null when signed out / unreachable
 * (the view falls back to the locked ladder-only presentation). A passive
 * read: whatever the answer, it changes nothing about the session.
 */
export async function fetchLeagueMe(): Promise<LeagueMe | null> {
  const res = await requestLeagueMe()
  if (res === null || !res.ok) return null
  try {
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
