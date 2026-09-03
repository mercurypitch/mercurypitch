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
import { isE2ETestMode } from '@/lib/test-utils'
import type { MelodyItem, NoteName } from '@/types'

export interface WeeklyChallenge {
  id: string
  slug: string
  title: string
  description: string
  featType: string
  voiceTypeSplit: unknown
  difficulty: string
  /**
   * Absolute MIDI, sung at written pitch. **Never transpose these to the
   * singer's range** — that is the design, not an oversight. A weekly
   * Legend is a shared feat: everyone attempts the identical notes, which
   * is the only thing that makes the board comparable and "I hit the B4"
   * mean something. Per-voice transposition would make it meaningless.
   *
   * The accepted cost is that a given week is not equally reachable by
   * every voice. Author the melody inside G3-C5 when you want a week most
   * people can finish, and go outside it deliberately when being out of
   * reach IS the challenge. `voiceTypeSplit` above is the unbuilt hook for
   * per-type variants; it is read by nothing today.
   */
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
  /** Everyone who sang, consenting or not — a participation figure. */
  attemptedCount: number
  /**
   * The singers `you.rank` and `you.percentile` are measured against: the
   * ones who consented to be named. Smaller than `attemptedCount` whenever
   * somebody sang without opting in, which is why the two are not
   * interchangeable in copy.
   */
  rankedCount: number
  completedCount: number
  targetScore: number
  founderScore: number | null
  frozen: boolean
  you: {
    best: number
    /** 0 when `ranked` is false — an unranked singer holds no place. */
    rank: number
    percentile: number
    beatFounder: boolean
    completed: boolean
    /**
     * False when this singer has not consented to being named on public
     * boards. Their score is still theirs to see; the rank beside it is only
     * among the singers who can be listed, so the UI must say so rather than
     * imply they hold a place on the board itself.
     */
    ranked: boolean
  } | null
}

// ── The frozen result of a closed challenge ──────────────────────────
//
// Written once by the worker when the window shuts and never recomputed, so
// a later rename cannot rewrite a published podium. The one thing that IS
// re-checked on every read is permission: a singer who has since opted out of
// public boards arrives with `displayName: null` and `redacted: true`, keeping
// their rank and score but losing their name.
//
// Weeks closed before this shape existed carry `version: undefined` and
// entries with no `userId` or `rank`. They are the only record of those weeks,
// so every reader has to keep rendering them.

export interface WeeklyPodiumEntry {
  /** Absent on version 1 rows, and on any entry that has been redacted. */
  userId?: string
  /** Null once redacted — render `<redacted>` rather than an empty name. */
  displayName: string | null
  best: number
  /** Absent on version 1 rows; fall back to the array index. */
  rank?: number
  redacted?: boolean
}

export interface WeeklyResults {
  version?: number
  top3: WeeklyPodiumEntry[]
  attemptedCount: number
  completedCount: number
  closedAt: string
}

export type ArchivedWeeklyChallenge = WeeklyChallenge & {
  results: WeeklyResults | null
}

/**
 * The podium as the card should draw it: at most three entries, each with a
 * definite rank and a name or the redaction marker.
 *
 * Total by construction — a malformed or absent `results` yields an empty
 * list, so the card simply renders no podium rather than throwing on a row
 * written by an older worker.
 */
export function podiumOf(
  results: WeeklyResults | null | undefined,
): Array<{ rank: number; displayName: string | null; best: number }> {
  if (results === null || results === undefined) return []
  if (!Array.isArray(results.top3)) return []
  return results.top3.slice(0, 3).map((entry, index) => ({
    rank: typeof entry.rank === 'number' ? entry.rank : index + 1,
    displayName:
      typeof entry.displayName === 'string' && entry.displayName !== ''
        ? entry.displayName
        : null,
    best: Math.round(entry.best),
  }))
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

export async function getWeeklyArchive(): Promise<ArchivedWeeklyChallenge[]> {
  if (base() === '') return []
  try {
    const res = await fetch(`${base()}/api/weekly/archive`)
    if (!res.ok) return []
    const data = (await res.json()) as { archive: ArchivedWeeklyChallenge[] }
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
  if (base() === '' && isE2ETestMode()) return []
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

export interface ParsedTargetNotes {
  items: MelodyItem[]
  /** Tokens that are not note names, in the order they were written. */
  rejected: string[]
}

/**
 * Parse a "G4 A4 B4" note-name list, keeping the tokens that failed.
 *
 * Callers that can tell a human — the admin form — must check `rejected`.
 * Dropping a token silently ships a Legend a note short, which nobody sees
 * until singers are already attempting it.
 */
export function parseTargetNotes(input: string): ParsedTargetNotes {
  const names = input
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s !== '')
  const items: MelodyItem[] = []
  const rejected: string[] = []
  for (const name of names) {
    let midi: number
    try {
      midi = noteToMidi(name)
    } catch {
      rejected.push(name)
      continue
    }
    if (!Number.isFinite(midi)) {
      rejected.push(name)
      continue
    }
    // id/startBeat come from the surviving count, not the input index — a
    // rejected token must not leave a hole in the playback positions.
    items.push({
      id: items.length + 1,
      note: {
        midi,
        // midiToNoteName includes the octave ("G4"); NoteName is the bare
        // letter and renderers append `octave` themselves — storing "G4"
        // here displayed as "G44".
        name: midiToNoteName(midi).replace(/-?\d+$/, '') as NoteName,
        octave: Math.floor(midi / 12) - 1,
        freq: midiToFrequency(midi),
      },
      duration: 1,
      startBeat: items.length,
    })
  }
  return { items, rejected }
}

/** Parse a "G4 A4 B4" note-name list into MelodyItem[] (unknown names dropped). */
export function notesToMelodyItems(input: string): MelodyItem[] {
  return parseTargetNotes(input).items
}

/** Render MelodyItem[] back to a "G4 A4 B4" note-name list (for editing). */
export function melodyItemsToNotes(items: MelodyItem[]): string {
  // midiToNoteName already includes the octave (e.g. "G4"), so don't append
  // it again — doing so rendered "G4" as "G44", and re-parsing that read the
  // trailing digit as octave 44, corrupting the melody on save.
  return items.map((it) => midiToNoteName(it.note.midi)).join(' ')
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
