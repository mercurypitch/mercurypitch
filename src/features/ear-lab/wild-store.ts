// ============================================================
// wild-store — which song the Field Book has open, and what has
// been read of it.
//
// A song is read once per app lifetime: the reading (its book of
// items and the decoded stems) is held here in memory, keyed by the
// UVR session id, and the card and the view both watch its state.
// Nothing is persisted — a reading takes seconds and the stems are
// already durable in IndexedDB — and nothing here touches the Column.
// ============================================================

import { createSignal } from 'solid-js'
import type { UvrSession } from '@/stores/uvr-store'
import { getAllUvrSessionsReactive } from '@/stores/uvr-store'
import type { WildAnalysisDeps, WildProgress, WildReading, } from './wild-analysis'
import { readWildSession } from './wild-analysis'

export type WildReadingStatus = 'unread' | 'reading' | 'ready' | 'error'

export interface WildReadingState {
  status: WildReadingStatus
  progress: WildProgress | null
  error: string
  reading: WildReading | null
}

export const UNREAD_STATE: WildReadingState = {
  status: 'unread',
  progress: null,
  error: '',
  reading: null,
}

/** The song the Field Book view shows. */
export const [fieldBookSessionId, setFieldBookSessionId] = createSignal<
  string | null
>(null)

const [states, setStates] = createSignal<Record<string, WildReadingState>>({})
const inFlight = new Map<string, Promise<WildReading>>()

export function wildReadingState(sessionId: string): WildReadingState {
  return states()[sessionId] ?? UNREAD_STATE
}

function patch(sessionId: string, next: Partial<WildReadingState>): void {
  setStates((all) => ({
    ...all,
    [sessionId]: { ...(all[sessionId] ?? UNREAD_STATE), ...next },
  }))
}

/** Read the song unless it is read or being read. The promise is
 *  shared, so the card and the view never start it twice. */
export function ensureWildReading(
  session: UvrSession,
  deps: WildAnalysisDeps,
): Promise<WildReading> {
  const id = session.sessionId
  const existing = inFlight.get(id)
  if (existing) return existing
  patch(id, {
    status: 'reading',
    progress: { phase: 'stems', pct: 0 },
    error: '',
  })
  const promise = readWildSession(session, deps, (progress) =>
    patch(id, { status: 'reading', progress }),
  )
    .then((reading) => {
      patch(id, { status: 'ready', reading, progress: null })
      return reading
    })
    .catch((error: unknown) => {
      inFlight.delete(id)
      patch(id, {
        status: 'error',
        progress: null,
        error:
          error instanceof Error
            ? error.message
            : 'The song could not be read.',
      })
      throw error
    })
  inFlight.set(id, promise)
  return promise
}

/** Hand a reading in without analysis — tests, and any future
 *  persisted book. */
export function primeWildReading(
  sessionId: string,
  reading: WildReading,
): void {
  inFlight.set(sessionId, Promise.resolve(reading))
  patch(sessionId, { status: 'ready', reading, progress: null, error: '' })
}

export function resetWildStore(): void {
  inFlight.clear()
  setStates({})
  setFieldBookSessionId(null)
}

/** Finished separations, newest first — the songs the book can read. */
export function fieldBookSessions(): UvrSession[] {
  return getAllUvrSessionsReactive()
    .filter((session) => session.status === 'completed')
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function songName(session: UvrSession): string {
  const raw = session.originalFile?.name ?? ''
  const trimmed = raw.replace(/\.[a-z0-9]{2,5}$/i, '').trim()
  return trimmed !== '' ? trimmed : `Song ${session.sessionId.slice(0, 6)}`
}
