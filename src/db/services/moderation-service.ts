// ============================================================
// Moderation service — report a singer, block one, and lift a block
// ============================================================
//
// The client of the worker's report and block routes (slice 4a of
// docs/plans/native-more-and-community.md: workers/db-worker/src/reports.ts
// and blocks.ts). Every call answers with what happened, typed, so the
// sheet that asked can say it in words: sent, already with the owner, not
// for a singer without an account, a session the server refused, a
// suspended account, nobody there, the singer themself, too many this
// hour, a full list, no answer, or an answer the server could not give.
//
// The reasons and the note's limit are the worker's own (report-rules.ts,
// pure), so the sheet offers exactly what the worker accepts, and a report
// is checked with the worker's own parser before it is sent. A 400 that
// comes back after that check is the one it cannot see: the singer behind
// the target is the caller.
//
// A suspended account is signed out here as on every other read
// (`handleAuthErrorResponse`, as league-service.ts `readLeagueMe` does) and
// comes back as `suspended`, never as a session to sign in to again. A
// report, a block or an unblock is always asked for from a sheet or a list
// that says so in its own words, with the contact form beside them, so
// those say nothing more; the list is read for the boards as well, unseen,
// so its read is told the app's way too. A session the server refused comes
// back as `refused` and changes nothing itself: the caller asks for a
// sign-in again.

import { handleAuthErrorResponse } from '@/db/services/auth-service'
import { getAuthHeaders } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'
import type { ReportKind, ReportReason, } from '../../../workers/db-worker/src/report-rules'
import { parseReportBody, readTargetId, REPORT_NOTE_MAX, REPORT_REASONS, } from '../../../workers/db-worker/src/report-rules'

export { REPORT_NOTE_MAX, REPORT_REASONS }
export type { ReportKind, ReportReason }

/** Why a report or a block did not happen. */
export type ModerationProblem =
  /** A 403: reports and blocks are for registered singers. */
  | 'account'
  /** A 401: the session is no good. */
  | 'refused'
  /** The account is suspended, and signed out here (a 403 that says so). */
  | 'suspended'
  /** A 404: nobody, or nothing, is there any more. */
  | 'missing'
  /** The singer is the caller (the worker's 400 after the parser's check). */
  | 'self'
  /** The sheet asked for something the worker's parser refuses. */
  | 'invalid'
  /** A 429: too many this hour. */
  | 'busy'
  /** A 409: the block list holds as many as it can. */
  | 'full'
  /** No answer: no connection, or no server to ask. */
  | 'unreachable'
  /** An answer, but no use: the server failed, or said what is not read. */
  | 'server'

export type ReportOutcome =
  | { status: 'sent' }
  /** The caller's report on this target is still open: nothing changed. */
  | { status: 'already-open' }
  | { status: ModerationProblem }

export type BlockOutcome = { status: 'blocked' } | { status: ModerationProblem }

export type UnblockOutcome =
  | { status: 'unblocked' }
  | { status: ModerationProblem }

/** A singer the caller blocked, under the name they go by now. */
export interface BlockedSinger {
  userId: string
  displayName: string
  createdAt: string
}

export type BlockListRead =
  | { status: 'ok'; blocks: BlockedSinger[] }
  | { status: ModerationProblem }

export interface ReportRequest {
  targetKind: ReportKind
  targetId: string
  reason: ReportReason
  note?: string
}

function base(): string {
  return API_BASE_URL ?? ''
}

/** One request to the worker, or null when there was no answer. */
async function send(path: string, init: RequestInit): Promise<Response | null> {
  if (base() === '') return null
  try {
    return await fetch(`${base()}${path}`, {
      ...init,
      headers: {
        ...(init.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...getAuthHeaders(),
      },
    })
  } catch {
    return null
  }
}

/**
 * What a refusal means, read from its status. `notify`: whether a
 * suspension is told the app's way as well (`handleAuthErrorResponse`).
 */
export async function problemOf(
  res: Response,
  notify = true,
): Promise<ModerationProblem> {
  switch (res.status) {
    case 400:
      return 'self'
    case 401:
      return 'refused'
    case 403: {
      // A suspension signs the account out here, as on every other read;
      // any other 403 on these routes is the account rule.
      const body = await res.text().catch(() => '')
      return handleAuthErrorResponse(res.status, body, undefined, notify)
        ? 'suspended'
        : 'account'
    }
    case 404:
      return 'missing'
    case 409:
      return 'full'
    case 429:
      return 'busy'
    default:
      return 'server'
  }
}

/** Report a singer, their profile, or a public share of theirs. */
export async function reportContent(
  request: ReportRequest,
): Promise<ReportOutcome> {
  const body = parseReportBody({ ...request, note: request.note ?? null })
  if ('error' in body) return { status: 'invalid' }
  const res = await send('/api/reports', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (res === null) return { status: 'unreachable' }
  if (res.status === 201) return { status: 'sent' }
  if (res.ok) return { status: 'already-open' }
  return { status: await problemOf(res, false) }
}

/** Block a singer: neither sees the other's name or posts from now on. */
export async function blockSinger(userId: string): Promise<BlockOutcome> {
  if (readTargetId(userId) === null) return { status: 'invalid' }
  const res = await send('/api/blocks', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
  if (res === null) return { status: 'unreachable' }
  // 201 is a new block, 200 one that already stood: blocked either way.
  if (res.ok) return { status: 'blocked' }
  return { status: await problemOf(res, false) }
}

/** Lift a block. Lifting one that is not there is no error. */
export async function unblockSinger(userId: string): Promise<UnblockOutcome> {
  if (readTargetId(userId) === null) return { status: 'invalid' }
  const res = await send(`/api/blocks/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
  if (res === null) return { status: 'unreachable' }
  if (res.ok) return { status: 'unblocked' }
  return { status: await problemOf(res, false) }
}

function blockedSingerOf(value: unknown): BlockedSinger | null {
  if (typeof value !== 'object' || value === null) return null
  const row = value as Record<string, unknown>
  if (typeof row.userId !== 'string' || typeof row.displayName !== 'string') {
    return null
  }
  return {
    userId: row.userId,
    displayName: row.displayName,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
  }
}

/** Whom the caller blocked, newest first, by the names they go by now. */
export async function listBlockedSingers(): Promise<BlockListRead> {
  const res = await send('/api/blocks', { method: 'GET' })
  if (res === null) return { status: 'unreachable' }
  if (!res.ok) return { status: await problemOf(res) }
  try {
    const data = (await res.json()) as { blocks?: unknown }
    if (!Array.isArray(data.blocks)) return { status: 'server' }
    return {
      status: 'ok',
      blocks: data.blocks
        .map(blockedSingerOf)
        .filter((row): row is BlockedSinger => row !== null),
    }
  } catch {
    return { status: 'server' }
  }
}
