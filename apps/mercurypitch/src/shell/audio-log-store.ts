// ============================================================
// The audio record, kept on the phone across a restart
// ============================================================
//
// The record (src/lib/audio-diagnostics.ts) lives in memory, and an odd
// moment is often noticed later: by then iOS may have ended the app, and
// the moment with it. So a test build keeps the newest
// KEEP_ACROSS_LAUNCHES entries in storage and puts them back, in front of
// the next launch's own, with a line that says where they end.
//
// CHEAP. Nothing runs while nothing happens: an entry starts one timer,
// and the whole record is written when it fires, at most once per
// WRITE_EVERY_MS. As the app goes behind, it is written at once: iOS may
// end a backgrounded app without a word. Clearing the record (the
// Developer screen's Clear log) forgets the kept copy too.
//
// Installed by the native entry alone, behind VITE_PORTABLE_CONSOLE and
// through a dynamic import (main.tsx), as the census is: a store build
// keeps nothing.

import type { AudioDiagnosticEntry } from '@/lib/audio-diagnostics'
import { adoptAudioDiagnostics, audioDiagnosticEntries, formatAudioDiagnostic, onAudioDiagnostic, plainAudioDiagnostic, } from '@/lib/audio-diagnostics'

export const AUDIO_LOG_KEY = 'mp:dev-audio-log'
/** How many entries a restart keeps: the newest. */
export const KEEP_ACROSS_LAUNCHES = 500
/** The longest an entry waits to be written. */
export const WRITE_EVERY_MS = 2000

export interface AudioLogStoreOptions {
  /** Where the record is kept; the page's localStorage when not given. */
  readonly storage?: Storage
}

function pageStorage(): Storage | null {
  try {
    return localStorage
  } catch {
    return null
  }
}

const isEntry = (value: unknown): value is AudioDiagnosticEntry => {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.wall === 'string' &&
    typeof entry.source === 'string' &&
    typeof entry.event === 'string' &&
    typeof entry.detail === 'object' &&
    entry.detail !== null &&
    typeof entry.visibility === 'string'
  )
}

/** The entries a last launch kept, or none where there is no record. */
function restore(storage: Storage): AudioDiagnosticEntry[] {
  try {
    const kept: unknown = JSON.parse(storage.getItem(AUDIO_LOG_KEY) ?? '[]')
    if (!Array.isArray(kept)) return []
    return kept.filter(isEntry).map((entry) => ({
      ...entry,
      at: typeof entry.at === 'number' ? entry.at : 0,
      failed: entry.failed === true,
    }))
  } catch {
    return []
  }
}

/** The line between the last launch's entries and this one's. */
function seam(older: readonly AudioDiagnosticEntry[]): AudioDiagnosticEntry {
  const first = audioDiagnosticEntries()[0]
  return {
    at: 0,
    wall: first?.wall ?? new Date().toISOString(),
    source: 'log',
    event: 'restored',
    detail: {
      entries: older.length,
      from: older[0]?.wall ?? 'unknown',
      to: older.at(-1)?.wall ?? 'unknown',
    },
    failed: false,
    visibility: first?.visibility ?? 'visible',
  }
}

/**
 * Put the last launch's entries back, and keep this launch's from now on.
 * Returns the stop (tests; the app keeps it for its life).
 */
export function keepAudioLogAcrossLaunches(
  options: AudioLogStoreOptions = {},
): () => void {
  const storage = options.storage ?? pageStorage()
  if (storage === null) return () => undefined

  const older = restore(storage)
  if (older.length > 0) {
    const line = seam(older)
    adoptAudioDiagnostics([...older, line])
    console.info(`[audio] ${formatAudioDiagnostic(line)}`)
  }

  let due: ReturnType<typeof setTimeout> | null = null
  const write = (): void => {
    if (due !== null) clearTimeout(due)
    due = null
    const newest = audioDiagnosticEntries()
      .slice(-KEEP_ACROSS_LAUNCHES)
      .map(plainAudioDiagnostic)
    try {
      storage.setItem(AUDIO_LOG_KEY, JSON.stringify(newest))
    } catch {
      // Storage full or refused: the record stays in memory.
    }
  }
  const stopHearing = onAudioDiagnostic((change) => {
    if (change.kind === 'cleared') {
      if (due !== null) clearTimeout(due)
      due = null
      try {
        storage.removeItem(AUDIO_LOG_KEY)
      } catch {
        // Nothing kept to forget.
      }
      return
    }
    due ??= setTimeout(write, WRITE_EVERY_MS)
  })
  const behind = (): void => {
    if (document.visibilityState === 'hidden' && due !== null) write()
  }
  document.addEventListener('visibilitychange', behind)
  window.addEventListener('pagehide', behind)
  return () => {
    stopHearing()
    document.removeEventListener('visibilitychange', behind)
    window.removeEventListener('pagehide', behind)
    if (due !== null) clearTimeout(due)
    due = null
  }
}
