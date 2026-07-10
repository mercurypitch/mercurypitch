// ============================================================
// Voice Mirror — onboarding persistence.
//
// Remembers that the visitor has already watched the "How it works"
// overview so returning users go straight to the mic check. A
// Landing link replays it on demand. Corrupt or blocked storage is
// treated as "not seen" — worst case the overview shows again.
// ============================================================

const STORAGE_KEY = 'mirror.howto.v1'

interface StoredHowto {
  /** Epoch milliseconds of the first completed viewing. */
  seenAt: number
}

export function hasSeenHowItWorks(storage: Storage): boolean {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return false
    const parsed: unknown = JSON.parse(raw)
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as StoredHowto).seenAt === 'number'
    )
  } catch {
    return false
  }
}

export function markHowItWorksSeen(
  storage: Storage,
  seenAt: number = Date.now(),
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ seenAt }))
  } catch {
    // Storage full or blocked (private mode) — the overview just replays.
  }
}
