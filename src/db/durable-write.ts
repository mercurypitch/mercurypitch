// ============================================================
// Durable write helper
// ============================================================
//
// The UVR/karaoke persistence layer historically used a fire-and-forget
// pattern — `void (async () => { ... })()` with the error swallowed (or only
// logged in dev). A silently-failed write means a paying user's separated stems
// or their session status never reach IndexedDB, and are lost on reload.
//
// durableWrite() awaits the write, retries once (except on a full disk, where a
// retry can't help), and RETURNS a result the caller must act on — surface an
// error, flip the session to an error status, warn the user — instead of
// pretending the write succeeded.

export interface DurableWriteResult<T> {
  ok: boolean
  value?: T
  error?: unknown
  /** True when the failure was a storage-quota (disk full) error. */
  quotaExceeded: boolean
}

/** A full-disk / quota error across browsers (Chrome, Firefox, Safari). */
export function isQuotaError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return (
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || // Firefox
      err.code === 22
    )
  }
  // Some engines throw a plain Error whose message mentions the quota.
  return err instanceof Error && /quota/i.test(err.message)
}

/**
 * Run an IndexedDB write, awaited, with a bounded retry. Never throws — returns
 * a result so the caller can react. Failures are always logged (not dev-gated),
 * because a lost write is a real, user-visible defect.
 */
export async function durableWrite<T>(
  what: string,
  op: () => Promise<T>,
  retries = 1,
): Promise<DurableWriteResult<T>> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const value = await op()
      return { ok: true, value, quotaExceeded: false }
    } catch (err) {
      lastErr = err
      console.error(
        `[durableWrite] ${what} failed (attempt ${attempt + 1}/${retries + 1}):`,
        err,
      )
      // A full disk won't clear itself between two back-to-back attempts.
      if (isQuotaError(err)) break
    }
  }
  return { ok: false, error: lastErr, quotaExceeded: isQuotaError(lastErr) }
}

/**
 * Best-effort check that there is room for `bytes` more, keeping a safety
 * margin. Returns true when it can't tell (no StorageManager, or the browser
 * reports nothing) — we never block a write on an unknown, only on a known
 * shortage, so callers use this as a pre-flight WARNING, not a hard gate.
 */
export async function hasRoomFor(bytes: number): Promise<boolean> {
  try {
    if (
      typeof navigator === 'undefined' ||
      navigator.storage?.estimate == null
    ) {
      return true
    }
    const { quota, usage } = await navigator.storage.estimate()
    if (quota == null || usage == null) return true
    const MARGIN = 50 * 1024 * 1024 // keep 50 MB headroom
    return quota - usage > bytes + MARGIN
  } catch {
    return true
  }
}
