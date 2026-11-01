// ============================================================
// A list of song ids, kept on this phone
// ============================================================
//
// The import queue keeps its songs this way (karaoke-import-queue.ts), and
// so does the list of songs the room reads the notes of at rest
// (karaoke-notes-wanted.ts). A list that cannot be read comes back empty,
// and one that cannot be written still stands for this run.

/** The ids kept under `key`; none when nothing readable is there. */
export function readIds(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

/** Keep `ids` under `key`. */
export function writeIds(key: string, ids: readonly string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // The list still stands for this run; a launch finds fewer of them.
  }
}
