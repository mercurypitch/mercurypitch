// ============================================================
// One song read at a time, whichever room asks for it
// ============================================================
//
// First note reads a song of the singer's own for its entries
// (first-note-own-songs.ts), and the Karaoke room reads a song's notes at
// rest so that Find by singing knows it (karaoke-notes-reader.ts). Each
// walks a vocal and runs the pitch read on the thread that draws the
// screen, and a walk holds up to 64 MiB of the vocal
// (streamed-vocal-samples.ts): two reads at once would be twice both. So a
// read takes this lock before it starts and lets it go when it ends, however
// it ends, and a reader that finds it taken waits: it is told when the lock
// is let go, and asks again.
//
// Synchronous on purpose: a free lock is taken in the tick it is asked for,
// so a reader that finds it free starts exactly as it did before there was
// a lock. A reader told the lock is free may no longer want it (its room
// stopped asking meanwhile); it asks for nothing then, and that is all.

let holder: string | null = null
const waiting = new Set<() => void>()

/** Who holds the lock ("first-note", "karaoke-notes"), or null. */
export function songReadLockHolder(): string | null {
  return holder
}

/**
 * Take the lock for `owner`, and with it the way to let it go (safe to call
 * twice). Null while another read holds it: `retry` is then called, once,
 * when the lock is let go.
 */
export function takeSongReadLock(
  owner: string,
  retry: () => void,
): (() => void) | null {
  if (holder !== null) {
    waiting.add(retry)
    return null
  }
  holder = owner
  let held = true
  return () => {
    if (!held) return
    held = false
    holder = null
    // Each waiting reader asks again, in the order they waited: the first
    // to ask takes the lock, and the others wait on it again.
    const asking = [...waiting]
    waiting.clear()
    for (const ask of asking) ask()
  }
}

/** Tests only: nobody holds the lock, and nobody waits for it. */
export function resetSongReadLockForTests(): void {
  holder = null
  waiting.clear()
}
