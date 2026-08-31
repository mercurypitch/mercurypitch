// ============================================================
// Lazy stem row migration — ArrayBuffer rows become Blob rows on read
// ============================================================
//
// Rows written before the Blob migration hold an ArrayBuffer, which
// IndexedDB materializes in full on every read. Rather than a bulk upgrade
// pass (which would repeat the dexie-index-add-reindexes-blobs disaster in
// spirit: minutes of blocking I/O on first open), each row is rewritten to a
// Blob the first time it is read — the bytes are already in hand at that
// moment, so the rewrite costs one background write, after which every later
// read of that row is a lazy handle.
//
// Deliberate properties:
// - Fire-and-forget: never delays or fails the read that triggered it.
// - Serialized: one rewrite at a time, so quota checks do not race each
//   other and a burst of reads cannot fan out payload-sized writes.
// - Quota-guarded: a rewrite transiently needs old + new bytes on disk;
//   when storage is that tight, skip silently — the row keeps working as an
//   ArrayBuffer, exactly as before the migration existed.
// - At most one attempt per row per page load, success or not.

import { storageEstimate } from '@/db/durable-write'
import type { UvrStemBlob } from '@/db/entities'
import { IS_DEV } from '@/lib/defaults'

/** Old + new copies coexist until the update commits. */
const QUOTA_HEADROOM_FACTOR = 2

const attempted = new Set<string>()
let chain: Promise<void> = Promise.resolve()

/**
 * Queue a just-read stem row for rewrite as a Blob. No-op for rows that are
 * already Blobs and rows attempted earlier this page load.
 */
export function queueStemRowBlobMigration(
  row: Pick<UvrStemBlob, 'id' | 'data' | 'mimeType'>,
): void {
  if (row.data instanceof Blob) return
  if (attempted.has(row.id)) return
  attempted.add(row.id)

  const { id, mimeType } = row
  const bytes = row.data
  chain = chain
    .then(async () => {
      const estimate = await storageEstimate()
      if (
        estimate !== null &&
        estimate.usage + bytes.byteLength * QUOTA_HEADROOM_FACTOR >
          estimate.quota
      ) {
        return
      }
      const { getDb } = await import('@/db')
      const db = await getDb()
      await db
        .getRepository<UvrStemBlob>('uvrStemBlobs')
        .update(id, { data: new Blob([bytes], { type: mimeType }) })
    })
    .catch((error: unknown) => {
      // The row stays a working ArrayBuffer; nothing was lost.
      if (IS_DEV) {
        console.warn('[UvrStemMigration] rewrite skipped:', id, error)
      }
    })
}

/** Settles when every migration queued so far has finished. For tests. */
export function stemRowMigrationsSettled(): Promise<void> {
  return chain
}

/** Forget which rows were attempted, so a test can exercise a row again. */
export function resetStemRowMigrationsForTests(): void {
  attempted.clear()
}
