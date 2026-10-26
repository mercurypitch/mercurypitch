// ============================================================
// Progress session records — every saved practice session, read in bounded pages
// ============================================================
//
// The read Progress counts its sessions with, and the weekly Check-up counts
// the practice between its two weeks with (docs/specs/weekly-check-up.ears.md,
// REQ-WCU-026). Out of session-service.ts so that the Voice Mirror, a page of
// its own with a tight first-paint budget, can make this read without loading
// the saving half (streaks, practice minutes, the path) into its chunks, and
// without pulling those modules out of the main app's first-paint chunk into a
// shared one. session-service.ts re-exports it, so its callers are unchanged.

import { getDb } from '@/db'
import type { SessionRecord } from '@/db/entities'
import { getUserId } from '@/db/services/user-service'

export interface ProgressSessionRecords {
  records: SessionRecord[]
  /** False only when the audited repository read itself failed. */
  available: boolean
  /** False when the safety ceiling was reached before the repository count. */
  complete: boolean
  totalAvailable: number | null
}

/**
 * Load a bounded, paginated Progress history without calling a truncated page
 * "all time". The caller receives completeness explicitly and can label the
 * coverage honestly when the safety ceiling is reached.
 */
export async function loadProgressSessionRecords(
  options: {
    pageSize?: number
    maxRecords?: number
  } = {},
): Promise<ProgressSessionRecords> {
  const pageSize = Math.min(1000, Math.max(1, options.pageSize ?? 500))
  const maxRecords = Math.max(pageSize, options.maxRecords ?? 5000)
  const ownerId = getUserId()

  try {
    const db = await getDb()
    if (getUserId() !== ownerId) throw new Error('identity changed')
    const repo = db.getRepository<SessionRecord>('sessionRecords')
    const where = { userId: ownerId }
    const initialTotal = await repo.count({ where, throwOnError: true })
    const records: SessionRecord[] = []
    const seen = new Set<string>()
    const target = Math.min(initialTotal, maxRecords)
    let offset = 0

    while (offset < target) {
      const requested = Math.min(pageSize, target - offset)
      const page = await repo.findAll({
        where,
        orderBy: 'endedAt',
        orderDir: 'desc',
        limit: requested,
        offset,
        throwOnError: true,
      })
      if (getUserId() !== ownerId) throw new Error('identity changed')
      if (page.length === 0) break
      offset += page.length
      for (const record of page) {
        if (seen.has(record.id)) continue
        seen.add(record.id)
        records.push(record)
      }
      if (page.length < requested) break
    }

    records.sort((a, b) => {
      const ended = b.endedAt.localeCompare(a.endedAt)
      return ended !== 0 ? ended : b.id.localeCompare(a.id)
    })
    const finalTotal = await repo.count({ where, throwOnError: true })
    if (getUserId() !== ownerId) throw new Error('identity changed')
    const stableRead =
      initialTotal === finalTotal && records.length === initialTotal
    const totalAvailable = finalTotal >= records.length ? finalTotal : null

    return {
      records,
      available: true,
      complete: initialTotal <= maxRecords && stableRead,
      totalAvailable,
    }
  } catch {
    return {
      records: [],
      available: false,
      complete: false,
      totalAvailable: null,
    }
  }
}
