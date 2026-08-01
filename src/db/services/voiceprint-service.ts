// ============================================================
// Voiceprint Service — the thing an account keeps
// ============================================================
//
// A voiceprint is a singer's measured voice at one moment: range,
// accuracy, steadiness, and the legend their range overlaps with.
//
// Anonymous visitors get theirs in localStorage, capped — which means
// it dies with the browser, the device, or a cache clear. That is the
// honest default, and it is exactly what signing in fixes: the cloud
// copy is uncapped, follows them across devices, and turns a one-off
// novelty into a timeline they can watch move.
//
// Derived numbers only. No audio, and no pitch frames — the trace
// belongs to the take that drew it, and storing it here would turn a
// small row into an unbounded one.
//
// Every path degrades to local-only: no API configured, signed out, or
// a failed request all still keep the voiceprint on the device.

import { getDb } from '@/db'
import type { Voiceprint, VoiceprintSource } from '@/db/entities'
import { hasValidToken } from '@/db/services/auth-service'
import { getUserId } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'
import type { MirrorSummary } from '@/lib/mirror/metrics'

const STORAGE_KEY = 'mercurypitch.voiceprints.v1'

/**
 * Local history is capped; the cloud copy is not. Twelve matches the
 * Voice Mirror's take cap and fits comfortably in the storage budget.
 */
export const LOCAL_CAP = 12

export interface VoiceprintRecord {
  /** Stable id so a local take can be de-duplicated after it syncs. */
  id: string
  summary: MirrorSummary
  twin: string | null
  source: VoiceprintSource
  takenAt: string
  /**
   * Who made this take on this device: the signed-in user's id, or
   * `'anonymous'` when nobody was signed in. Absent on records from
   * before tagging existed — treated as `'anonymous'`. Device-side
   * only; never sent to the cloud (cloud rows are keyed by userId).
   *
   * This is what keeps a shared PC honest: one singer's takes never
   * silently upload into the next singer's account (owner decision D2,
   * 2026-08-01 — see docs/specs/voiceprints.ears.md §4).
   */
  madeBy?: string
}

/** Tag value for takes made with nobody signed in. */
export const MADE_ANONYMOUSLY = 'anonymous'

/** The identity a record was made under, with legacy records anonymous. */
export function recordMadeBy(record: VoiceprintRecord): string {
  return record.madeBy ?? MADE_ANONYMOUSLY
}

// ── Local ────────────────────────────────────────────────────────

export function loadLocalVoiceprints(): VoiceprintRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isVoiceprintRecord)
  } catch {
    return []
  }
}

function isVoiceprintRecord(value: unknown): value is VoiceprintRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Partial<VoiceprintRecord>
  return (
    typeof record.id === 'string' &&
    typeof record.takenAt === 'string' &&
    typeof record.summary === 'object' &&
    record.summary !== null
  )
}

function writeLocal(records: readonly VoiceprintRecord[]): void {
  try {
    // Newest first, capped. Oldest fall off — the cloud copy is where
    // the full history lives.
    const capped = [...records]
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
      .slice(0, LOCAL_CAP)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped))
  } catch {
    // Storage full or blocked (private mode). The take is still shown
    // for this session; it just won't survive a reload.
  }
}

// ── Save ─────────────────────────────────────────────────────────

/**
 * Record a voiceprint. Always writes locally; additionally writes to
 * the account when one is signed in.
 */
export async function saveVoiceprint(input: {
  summary: MirrorSummary
  twin: string | null
  source: VoiceprintSource
  takenAt?: string
}): Promise<VoiceprintRecord> {
  const record: VoiceprintRecord = {
    id: globalThis.crypto.randomUUID(),
    summary: input.summary,
    twin: input.twin,
    source: input.source,
    takenAt: input.takenAt ?? new Date().toISOString(),
    // The token decides the tag, not the local device id — the device id
    // survives sign-in/out and would make every signed-out take look like
    // it belonged to whoever signs in next.
    madeBy: tokenHeld() ? getUserId() : MADE_ANONYMOUSLY,
  }

  writeLocal([record, ...loadLocalVoiceprints()])
  if (cloudAvailable()) await pushToCloud([record])
  return record
}

/** hasValidToken, guarded like cloudAvailable — a throw must never lose a save. */
function tokenHeld(): boolean {
  try {
    return hasValidToken()
  } catch {
    return false
  }
}

function cloudAvailable(): boolean {
  // Guarded because this is called OUTSIDE the try blocks below, so a
  // throw here would escape and break a read that is supposed to fall
  // back to the local copy. "Degrades to local-only" has to be true on
  // every path, including this one.
  try {
    return API_BASE_URL != null && API_BASE_URL !== '' && hasValidToken()
  } catch {
    return false
  }
}

async function pushToCloud(
  records: readonly VoiceprintRecord[],
): Promise<void> {
  try {
    const db = await getDb()
    const repo = db.getRepository<Voiceprint>('voiceprints')
    for (const record of records) {
      await repo.create({
        userId: getUserId(),
        summary: record.summary,
        twin: record.twin ?? undefined,
        source: record.source,
        takenAt: record.takenAt,
      })
    }
  } catch {
    // The local copy already succeeded — a failed upload must never
    // lose the take or surface as an error at the moment of delight.
  }
}

// ── Read ─────────────────────────────────────────────────────────

/**
 * Every voiceprint we know about, newest first. Signed out: whatever is
 * on this device, whoever made it — device data. Signed in: the account
 * history (uncapped) merged with the device takes **made by this
 * account**; takes made anonymously or under another account stay off
 * the signed-in list until the adoption notice resolves them (owner
 * decision D2 — shared-PC accounts must not see each other's takes).
 */
export async function listVoiceprints(): Promise<VoiceprintRecord[]> {
  const local = loadLocalVoiceprints()
  if (!cloudAvailable()) return sortNewestFirst(local)

  const mine = local.filter((r) => recordMadeBy(r) === getUserId())
  try {
    const db = await getDb()
    const repo = db.getRepository<Voiceprint>('voiceprints')
    const rows = await repo.findAll({ where: { userId: getUserId() } })
    const remote: VoiceprintRecord[] = rows.map((row) => ({
      id: row.id,
      summary: row.summary,
      twin: row.twin ?? null,
      source: row.source,
      takenAt: row.takenAt,
    }))
    // Merge rather than replace: a take made moments ago may not have
    // reached the server yet, and it should still show.
    return sortNewestFirst(dedupeByTakenAt([...remote, ...mine]))
  } catch {
    return sortNewestFirst(mine)
  }
}

/** The most recent voiceprint, or null. */
export async function latestVoiceprint(): Promise<VoiceprintRecord | null> {
  return (await listVoiceprints())[0] ?? null
}

function sortNewestFirst(records: VoiceprintRecord[]): VoiceprintRecord[] {
  return [...records].sort((a, b) => b.takenAt.localeCompare(a.takenAt))
}

/**
 * `takenAt` is the identity across the local/cloud boundary: a synced
 * take has a different row id server-side, so keying on id would show
 * the same performance twice.
 */
function dedupeByTakenAt(records: VoiceprintRecord[]): VoiceprintRecord[] {
  const seen = new Set<string>()
  const out: VoiceprintRecord[] = []
  for (const record of records) {
    if (seen.has(record.takenAt)) continue
    seen.add(record.takenAt)
    out.push(record)
  }
  return out
}

// ── Sync ─────────────────────────────────────────────────────────

/**
 * Guards against two overlapping syncs. The auth signal can bump twice
 * in quick succession (token set, then profile fetched), and two runs
 * that both read "the server has none of these" would both upload —
 * duplicating every take the account was meant to rescue.
 */
let syncing: Promise<number> | null = null

/**
 * Upload local takes the account does not have yet. Called after
 * sign-in, so nothing a visitor made anonymously is lost by the act of
 * creating the account that was supposed to keep it.
 *
 * Returns how many were uploaded.
 */
export function syncLocalVoiceprints(): Promise<number> {
  syncing ??= runSync().finally(() => {
    syncing = null
  })
  return syncing
}

async function runSync(): Promise<number> {
  if (!cloudAvailable()) return 0
  // Only takes made under THIS identity upload by themselves. Anything
  // anonymous (or from before tagging) waits for the adoption notice —
  // uploading it here is exactly the shared-PC leak D2 closes.
  const local = loadLocalVoiceprints().filter(
    (record) => recordMadeBy(record) === getUserId(),
  )
  if (local.length === 0) return 0

  try {
    const db = await getDb()
    const repo = db.getRepository<Voiceprint>('voiceprints')
    const rows = await repo.findAll({ where: { userId: getUserId() } })
    const known = new Set(rows.map((row) => row.takenAt))
    const missing = local.filter((record) => !known.has(record.takenAt))
    if (missing.length === 0) return 0
    await pushToCloud(missing)
    return missing.length
  } catch {
    return 0
  }
}

// ── Adoption (owner decision D2, 2026-08-01) ─────────────────────
//
// A signed-in account is offered the device's unclaimed takes once,
// explicitly. Accepting retags them to this account and uploads them;
// declining hides the notice for this account until a NEWER unclaimed
// take appears. Takes tagged to a different account are never offered —
// their owner sees them by signing in, and everyone sees them signed out.

const ADOPT_DECLINE_KEY = 'mercurypitch.voiceprints.adoptDecline.v1'

/** Device takes the signed-in account could adopt (anonymous or legacy). */
export function listAdoptableVoiceprints(): VoiceprintRecord[] {
  if (!cloudAvailable()) return []
  return sortNewestFirst(
    loadLocalVoiceprints().filter(
      (record) => recordMadeBy(record) === MADE_ANONYMOUSLY,
    ),
  )
}

function readDeclines(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ADOPT_DECLINE_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as Record<string, string>
  } catch {
    return {}
  }
}

/**
 * Should the "keep these on this account?" notice show right now?
 * True while adoptable takes exist that are newer than this account's
 * last "Not now".
 */
export function adoptionNoticeDue(): boolean {
  const adoptable = listAdoptableVoiceprints()
  if (adoptable.length === 0) return false
  const declinedUpTo = readDeclines()[getUserId()]
  if (declinedUpTo === undefined) return true
  return adoptable.some((record) => record.takenAt > declinedUpTo)
}

/** "Not now": quiet for this account until a newer unclaimed take exists. */
export function declineAdoption(): void {
  const newest = listAdoptableVoiceprints()[0]
  if (newest === undefined) return
  try {
    localStorage.setItem(
      ADOPT_DECLINE_KEY,
      JSON.stringify({ ...readDeclines(), [getUserId()]: newest.takenAt }),
    )
  } catch {
    // Blocked storage: the notice may reappear next visit — acceptable.
  }
}

/**
 * Adopt the device's unclaimed takes into the signed-in account: retag
 * locally, then upload. Returns how many were adopted.
 */
export async function adoptDeviceVoiceprints(): Promise<number> {
  // Don't interleave with an in-flight auto-sync: both read the cloud
  // list before pushing, and an overlap could upload a take twice.
  if (syncing !== null) await syncing
  const adoptable = listAdoptableVoiceprints()
  if (adoptable.length === 0) return 0
  const me = getUserId()
  const adopting = new Set(adoptable.map((record) => record.id))
  // Retag FIRST: even if the upload below fails, the takes are now
  // own-tagged and the next ordinary sync carries them up.
  writeLocal(
    loadLocalVoiceprints().map((record) =>
      adopting.has(record.id) ? { ...record, madeBy: me } : record,
    ),
  )
  try {
    const db = await getDb()
    const repo = db.getRepository<Voiceprint>('voiceprints')
    const rows = await repo.findAll({ where: { userId: me } })
    const known = new Set(rows.map((row) => row.takenAt))
    await pushToCloud(adoptable.filter((r) => !known.has(r.takenAt)))
  } catch {
    // Covered by the retag-first note above.
  }
  return adoptable.length
}
