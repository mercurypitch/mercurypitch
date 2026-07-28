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
  }

  writeLocal([record, ...loadLocalVoiceprints()])
  if (cloudAvailable()) await pushToCloud([record])
  return record
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
 * Every voiceprint we know about, newest first. Signed in: the cloud
 * history (uncapped). Otherwise: whatever is on this device.
 */
export async function listVoiceprints(): Promise<VoiceprintRecord[]> {
  const local = loadLocalVoiceprints()
  if (!cloudAvailable()) return sortNewestFirst(local)

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
    return sortNewestFirst(dedupeByTakenAt([...remote, ...local]))
  } catch {
    return sortNewestFirst(local)
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
  const local = loadLocalVoiceprints()
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
