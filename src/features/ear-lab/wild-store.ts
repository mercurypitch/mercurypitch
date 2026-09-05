// ============================================================
// wild-store — which song the Field Book has open, and what has
// been read of it.
//
// A song's book (its items and key) is read once per app lifetime
// and kept here in memory, keyed by the UVR session id: it is small
// and a reading takes seconds. Its decoded stems are not kept that
// long. Three AudioBuffers of a whole song are tens of megabytes, so
// only the last MAX_WARM_STEMS songs stay warm, and leaving the Ear
// Lab cools them all. A song with a book and cold stems reads its
// stems again, and only them, which is the short part. Nothing is
// persisted, and nothing here touches the Column.
// ============================================================

import { createSignal } from 'solid-js'
import type { UvrSession } from '@/stores/uvr-store'
import { getAllUvrSessionsReactive } from '@/stores/uvr-store'
import type { WildAnalysisDeps, WildProgress, WildReading, } from './wild-analysis'
import { loadWildStems, readWildSession, STEM_PHASE_PCT } from './wild-analysis'

export type WildReadingStatus = 'unread' | 'reading' | 'ready' | 'error'

export interface WildReadingState {
  status: WildReadingStatus
  progress: WildProgress | null
  error: string
  /** The book, once read. It outlives the stems. */
  book: WildReading['book'] | null
  /** Book and stems together, only while the stems are warm. */
  reading: WildReading | null
}

/** How many songs keep their decoded stems in memory at once. */
export const MAX_WARM_STEMS = 1

export const UNREAD_STATE: WildReadingState = {
  status: 'unread',
  progress: null,
  error: '',
  book: null,
  reading: null,
}

/** The song the Field Book view shows. */
export const [fieldBookSessionId, setFieldBookSessionId] = createSignal<
  string | null
>(null)

const [states, setStates] = createSignal<Record<string, WildReadingState>>({})
/** Readings in progress, shared so the card and the view never start
 *  the same one twice. */
const inFlight = new Map<string, Promise<WildReading>>()
/** Songs whose stems are decoded, least recently used first. */
const warm: string[] = []
/** Bumped when the lab is left, so a reading still running then lands
 *  as a book without stems instead of warming a song nobody is on. */
let epoch = 0

export function wildReadingState(sessionId: string): WildReadingState {
  return states()[sessionId] ?? UNREAD_STATE
}

function patch(sessionId: string, next: Partial<WildReadingState>): void {
  setStates((all) => ({
    ...all,
    [sessionId]: { ...(all[sessionId] ?? UNREAD_STATE), ...next },
  }))
}

function keepWarm(sessionId: string): void {
  const at = warm.indexOf(sessionId)
  if (at >= 0) warm.splice(at, 1)
  warm.push(sessionId)
  // The open song is never the one let go, whatever finished last: a slow
  // read of another song landing mid-drill would otherwise unmount the
  // drill. The other song is cooled on arrival instead.
  const open = fieldBookSessionId()
  while (warm.length > MAX_WARM_STEMS) {
    const victim = warm.find((id) => id !== open)
    if (victim === undefined) break
    warm.splice(warm.indexOf(victim), 1)
    coolDown(victim)
  }
}

/** Drop a song's stems and keep its book. The view reads the stems
 *  again, and only them, when it next opens the song. */
function coolDown(sessionId: string): void {
  if (!states()[sessionId]?.reading) return
  patch(sessionId, { status: 'unread', reading: null, progress: null })
}

/** Cool every song. Called when the Ear Lab is left, so a song's
 *  stems never outlive the visit that decoded them. */
export function releaseWildStems(): void {
  epoch += 1
  for (const sessionId of warm.splice(0)) coolDown(sessionId)
}

/** Read the song unless it is read or being read. A song whose book
 *  is kept but whose stems went cold reads the stems alone. */
export function ensureWildReading(
  session: UvrSession,
  deps: WildAnalysisDeps,
): Promise<WildReading> {
  const id = session.sessionId
  const running = inFlight.get(id)
  if (running) return running
  const current = states()[id]
  if (current?.reading) {
    keepWarm(id)
    return Promise.resolve(current.reading)
  }
  const book = current?.book ?? null
  const readEpoch = epoch
  patch(id, {
    status: 'reading',
    progress: { phase: 'stems', pct: 0 },
    error: '',
  })
  const read = book
    ? loadWildStems(session, deps, (pct, detail) =>
        patch(id, {
          status: 'reading',
          // loadWildStems reports on the stems phase's own scale; with
          // the book already read, that phase is the whole reading.
          progress: {
            phase: 'stems',
            pct: Math.round((pct / STEM_PHASE_PCT) * 100),
            detail,
          },
        }),
      ).then((stems) => {
        if (!stems) {
          throw new Error('This song has no vocal and instrumental stems yet.')
        }
        return { book, stems }
      })
    : readWildSession(session, deps, (progress) =>
        patch(id, { status: 'reading', progress }),
      )
  const promise = read
    .then((reading) => {
      inFlight.delete(id)
      if (readEpoch !== epoch) {
        // The lab was left while this ran: keep what was learned, let the
        // stems go. The next visit reads the stems alone.
        patch(id, {
          status: 'unread',
          book: reading.book,
          reading: null,
          progress: null,
        })
        return reading
      }
      patch(id, {
        status: 'ready',
        book: reading.book,
        reading,
        progress: null,
      })
      keepWarm(id)
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
  patch(sessionId, {
    status: 'ready',
    book: reading.book,
    reading,
    progress: null,
    error: '',
  })
  keepWarm(sessionId)
}

export function resetWildStore(): void {
  epoch += 1
  inFlight.clear()
  warm.length = 0
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
