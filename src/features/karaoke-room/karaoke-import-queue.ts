// ============================================================
// The Karaoke room's import queue (plan S8 §6.4 to §6.6)
// ============================================================
//
// A song picked in the room is a separation session like any other: its
// original is kept on the phone the moment it is picked, and the web's
// pipeline sends it, polls the server and saves the stems. What this adds is
// the phone's side of it.
//
//   ONE SEND AT A TIME. The next song starts sending as soon as the server
//   has the last one (its job id is persisted), not when that one is
//   separated: separations overlap on the server, sends do not.
//
//   ROWS OUTLIVE THE APP. The songs picked are listed under
//   KARAOKE_IMPORTS_KEY and the one being sent under
//   KARAOKE_IMPORT_SENDING_KEY. A song the app closed on before the server
//   had it is sent again from its kept copy on the next launch, and its row
//   says why. One the server had is the auto-resume's (uvr-auto-resume.ts):
//   it is collected without being sent or paid for again.
//
//   NOTHING IS USED BEFORE THE SERVER TAKES A SONG. A refusal (no songs
//   left, a busy studio, no connection) puts the song back in line, and the
//   row says what it waits for. No songs left also shows the gate, which the
//   room's Import registers (setImportGateHandler).
//
//   A READY SONG leaves the queue for the library with a New mark, its kept
//   copy is deleted, and a toast in whatever room is on the screen offers
//   to open it.

import { batch, createEffect, createRoot, createSignal, on, untrack, } from 'solid-js'
import { deleteStemBlobs, getOriginalFileBlob, saveStemBlobDurable, } from '@/db/services/uvr-service'
import { TAB_KARAOKE } from '@/features/tabs/constants'
import type { ProcessingCallbacks } from '@/lib/uvr-processing-pipeline'
import { resumeServerSession, runUvrPipeline, } from '@/lib/uvr-processing-pipeline'
import { showActionNotification } from '@/stores/notifications-store'
import { setActiveTab } from '@/stores/ui-store'
import type { UvrSession } from '@/stores/uvr-store'
import { completeUvrSession, deleteUvrSession, getAllUvrSessions, getAllUvrSessionsReactive, getUvrSession, saveAllUvrSessions, setErrorUvrSession, setInterruptedUvrSession, setUvrSessionResuming, startUvrSession, whenSessionStoreReady, } from '@/stores/uvr-store'
import type { ImportRefusal } from './karaoke-import-checks'
import { songTitleOf } from './karaoke-import-checks'
import { requestKaraokeSong } from './karaoke-room-store'
import type { KaraokeSongs } from './karaoke-songs'
import { karaokeSongs, refreshKaraokeSongs } from './karaoke-songs'

/** The songs picked and not yet ready, oldest first. */
export const KARAOKE_IMPORTS_KEY = 'karaoke-room-imports'
/** The song being sent, so a launch can tell it was cut off. */
export const KARAOKE_IMPORT_SENDING_KEY = 'karaoke-room-import-sending'
/** Songs ready and not yet sung. */
export const KARAOKE_NEW_SONGS_KEY = 'karaoke-room-new-songs'

/** The most songs waiting at once: the web queue's cap. */
export const IMPORT_QUEUE_CAP = 15
/** A busy studio (429, 503) is asked again after this. */
const BUSY_RETRY_MS = 60_000
/** A connection dropped mid-send is tried again after this. */
const NETWORK_RETRY_MS = 5_000

/** Our own failure messages, stored on the session as its error. */
const NOT_SENT = 'This song could not be sent. Nothing was used.'
const COPY_GONE =
  'The copy of this song on this phone is gone. Choose it again from Files.'
/** What cleanupStaleUvrSessions writes on a song cut off before it had a job. */
const CUT_OFF_BY_RELOAD = 'Session interrupted by page reload or closure.'

export type ImportFailure =
  | 'separation'
  | 'expired'
  | 'storage'
  | 'saving'
  | 'not-sent'
  | 'missing'

/** Why a send is a second one. */
export type SendAgain = 'closed' | 'network'

export type ImportRowState =
  | { readonly kind: 'waiting-turn' }
  | { readonly kind: 'waiting-network' }
  | {
      readonly kind: 'sending'
      readonly share: number
      readonly again: SendAgain | null
    }
  | { readonly kind: 'busy' }
  | { readonly kind: 'blocked'; readonly subscribed: boolean }
  | { readonly kind: 'queued' }
  | { readonly kind: 'separating'; readonly percent: number }
  | { readonly kind: 'saving' }
  | { readonly kind: 'failed'; readonly reason: ImportFailure }

export interface ImportRow {
  readonly sessionId: string
  readonly title: string
  readonly state: ImportRowState
}

// ── Persistence ─────────────────────────────────────────────

function readIds(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

function writeIds(key: string, ids: readonly string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // The rows still stand for this run; a launch finds fewer of them.
  }
}

function readSending(): string | null {
  try {
    return localStorage.getItem(KARAOKE_IMPORT_SENDING_KEY)
  } catch {
    return null
  }
}

function writeSending(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(KARAOKE_IMPORT_SENDING_KEY)
    else localStorage.setItem(KARAOKE_IMPORT_SENDING_KEY, id)
  } catch {
    // Without the mark a cut-off send reads as failed, and Try again sends it.
  }
}

// ── State ───────────────────────────────────────────────────

interface Sending {
  readonly id: string
  readonly share: number
  readonly again: SendAgain | null
}

const [tracked, setTracked] = createSignal<string[]>(
  readIds(KARAOKE_IMPORTS_KEY),
)
const [newSongs, setNewSongs] = createSignal<string[]>(
  readIds(KARAOKE_NEW_SONGS_KEY),
)
const [sending, setSending] = createSignal<Sending | null>(null)
const [offline, setOffline] = createSignal(false)
const [busy, setBusy] = createSignal(false)
const [blocked, setBlocked] = createSignal(false)
const [ready, setReady] = createSignal(false)

/** The send in flight, and the way to stop it. */
let current: { readonly id: string; readonly abort: AbortController } | null =
  null
/** Songs whose next send is a second one, and why. */
const againFor = new Map<string, SendAgain>()
let started = false
/** A dropped send waits a moment before the next try, whatever pumps. */
let held = false
let gate: ((songs: KaraokeSongs) => void) | null = null
const timers = new Set<ReturnType<typeof setTimeout>>()

function track(id: string): void {
  const next = [...untrack(tracked), id]
  setTracked(next)
  writeIds(KARAOKE_IMPORTS_KEY, next)
}

function forget(id: string): void {
  const next = untrack(tracked).filter((candidate) => candidate !== id)
  setTracked(next)
  writeIds(KARAOKE_IMPORTS_KEY, next)
}

function patchSession(id: string, patch: Partial<UvrSession>): void {
  if (getUvrSession(id) === undefined) return
  saveAllUvrSessions(
    getAllUvrSessions().map((session) =>
      session.sessionId === id ? { ...session, ...patch } : session,
    ),
  )
}

const hasJob = (session: UvrSession | undefined): boolean =>
  (session?.apiSessionId ?? '') !== ''

const isOnline = (): boolean =>
  typeof navigator === 'undefined' || navigator.onLine !== false

function later(run: () => void, ms: number): void {
  const timer = setTimeout(() => {
    timers.delete(timer)
    run()
  }, ms)
  timers.add(timer)
}

/**
 * The room's Import shows the paywall or the no-songs sheet through this.
 * The last one registered answers; the returned function lets it go.
 */
export function setImportGateHandler(
  handler: (songs: KaraokeSongs) => void,
): () => void {
  gate = handler
  return () => {
    if (gate === handler) gate = null
  }
}

// ── Sending ─────────────────────────────────────────────────

function nextToSend(): string | undefined {
  return untrack(tracked).find((id) => {
    const session = getUvrSession(id)
    return session?.status === 'idle' && !hasJob(session)
  })
}

function pump(): void {
  if (!started || !untrack(ready) || current !== null || held) return
  if (untrack(blocked) || untrack(busy)) return
  const next = nextToSend()
  if (next === undefined) return
  if (!isOnline()) {
    setOffline(true)
    return
  }
  setOffline(false)
  void send(next)
}

function callbacksFor(id: string): ProcessingCallbacks {
  return {
    onProgress: () => {
      // The pipeline writes the server's progress to the session itself.
    },
    onComplete: async (result) => {
      await completeUvrSession(id, result.outputs, result.stemMeta)
    },
    onError: (message) => {
      setErrorUvrSession(id, message)
      // A separation that failed on the server was given back.
      void refreshKaraokeSongs()
    },
  }
}

/** Resolves once the server has the song: its job id is on the session. */
function whenTaken(id: string): { done: Promise<void>; dispose: () => void } {
  let dispose: () => void = () => undefined
  const done = new Promise<void>((resolve) => {
    createRoot((disposeRoot) => {
      dispose = disposeRoot
      createEffect(() => {
        const session = getAllUvrSessionsReactive().find(
          (candidate) => candidate.sessionId === id,
        )
        if (hasJob(session)) resolve()
      })
    })
  })
  return { done, dispose }
}

async function send(id: string): Promise<void> {
  const abort = new AbortController()
  current = { id, abort }
  const again = againFor.get(id) ?? null
  againFor.delete(id)
  let hidden = document.visibilityState === 'hidden'
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') hidden = true
  }
  document.addEventListener('visibilitychange', onVisibility)
  writeSending(id)
  setSending({ id, share: 0, again })

  const taken = whenTaken(id)
  try {
    const file = await getOriginalFileBlob(id)
    if (abort.signal.aborted) return
    if (file === null) {
      setErrorUvrSession(id, COPY_GONE)
      return
    }
    patchSession(id, {
      status: 'processing',
      progress: 0,
      indeterminate: true,
      error: undefined,
    })
    const run = runUvrPipeline(file, id, 'server', callbacksFor(id), {
      signal: abort.signal,
      onUploadProgress: (share) => {
        if (current?.id === id) setSending({ id, share, again })
      },
    })
    // Whatever happens to the run once the server has the song is the
    // session's (and the auto-resume's), never an unhandled rejection.
    const settled = run.then(
      () => null,
      (error: unknown) => ({ error }),
    )
    const first = await Promise.race([
      settled,
      taken.done.then(() => 'taken' as const),
    ])
    if (first === 'taken' || hasJob(getUvrSession(id))) {
      void settled.then((outcome) => {
        if (outcome !== null) afterTaken(id, outcome.error)
      })
      return
    }
    if (first !== null) refused(id, first.error, hidden)
  } finally {
    taken.dispose()
    document.removeEventListener('visibilitychange', onVisibility)
    writeSending(null)
    if (current?.id === id) current = null
    setSending(null)
    pump()
  }
}

/** A run that ended after the server had the song. */
function afterTaken(id: string, error: unknown): void {
  if (error instanceof DOMException && error.name === 'AbortError') return
  // Still holding its job id: the job may be alive, or done and waiting to
  // be collected. The auto-resume collects it on the next foreground or
  // connection, and the row waits for it instead of offering a second
  // separation. A server-confirmed failure cleared the id, and the
  // pipeline's onError already said what happened.
  if (hasJob(getUvrSession(id))) setInterruptedUvrSession(id)
}

/** The server did not take the song: nothing was used. */
function refused(id: string, error: unknown, hidden: boolean): void {
  if (error instanceof DOMException && error.name === 'AbortError') return
  const status = (error as { status?: unknown } | null)?.status
  const backInLine = (): void => {
    patchSession(id, {
      status: 'idle',
      progress: 0,
      indeterminate: false,
      error: undefined,
    })
  }
  if (status === 402) {
    backInLine()
    setBlocked(true)
    void refreshKaraokeSongs()
    gate?.(untrack(karaokeSongs))
    return
  }
  if (status === 429 || status === 503) {
    backInLine()
    setBusy(true)
    later(() => {
      setBusy(false)
      pump()
    }, BUSY_RETRY_MS)
    return
  }
  if (error instanceof TypeError) {
    backInLine()
    againFor.set(id, hidden ? 'closed' : 'network')
    // The row waits for a connection until the next try: at once when the
    // phone is back online, or after a moment on a connection that only
    // dropped.
    setOffline(true)
    if (isOnline()) {
      held = true
      later(() => {
        held = false
        setOffline(false)
        pump()
      }, NETWORK_RETRY_MS)
    }
    return
  }
  setErrorUvrSession(id, NOT_SENT)
}

// ── What the singer does ────────────────────────────────────

/** A song already here, or already on its way, is refused. */
export function duplicateOf(file: File): ImportRefusal | null {
  const title = songTitleOf(file)
  const same = (session: UvrSession): boolean =>
    session.originalFile?.name === file.name &&
    session.originalFile.size === file.size
  const waiting = untrack(tracked)
  for (const session of getAllUvrSessions()) {
    if (!same(session)) continue
    if (waiting.includes(session.sessionId)) {
      return {
        title: `${title} is already on its way`,
        body: 'It is in your songs as soon as it is ready. Nothing was used.',
      }
    }
    if (session.status === 'completed') {
      return {
        title: `${title} is already in your songs`,
        body: 'Nothing was used.',
      }
    }
  }
  return null
}

const QUEUE_FULL: ImportRefusal = {
  title: 'The queue is full',
  body: `Up to ${IMPORT_QUEUE_CAP} songs can wait at once. Import this one when some are ready. Nothing was used.`,
}

const NO_ROOM_FOR_COPY: ImportRefusal = {
  title: 'Not enough space on this phone',
  body: 'Free up some space and try again. Nothing was used.',
}

export interface EnqueueResult {
  readonly queued: string[]
  readonly refused: ReadonlyArray<{ title: string; refusal: ImportRefusal }>
}

/**
 * Put the songs the singer confirmed in line. Each is a session with its
 * original kept, so a send cut off by the app closing can start again.
 */
export async function enqueueImports(
  files: readonly File[],
): Promise<EnqueueResult> {
  const queued: string[] = []
  const turnedAway: Array<{ title: string; refusal: ImportRefusal }> = []
  for (const file of files) {
    const title = songTitleOf(file)
    if (importRowsNow().length >= IMPORT_QUEUE_CAP) {
      turnedAway.push({ title, refusal: QUEUE_FULL })
      continue
    }
    const sessionId = startUvrSession(
      file.name,
      file.size,
      file.type,
      'separate',
      'server',
      undefined,
      false,
    )
    const kept = await saveStemBlobDurable(
      sessionId,
      'original',
      file,
      file.name,
    )
    if (!kept.ok) {
      await deleteUvrSession(sessionId)
      turnedAway.push({ title, refusal: NO_ROOM_FOR_COPY })
      continue
    }
    track(sessionId)
    queued.push(sessionId)
  }
  pump()
  return { queued, refused: turnedAway }
}

/**
 * Try a failed song again. One the server separated but the phone did not
 * save is collected again for free; anything else goes back in line and is
 * separated again.
 */
export function retryImport(id: string): void {
  const session = getUvrSession(id)
  if (session === undefined) return
  if (hasJob(session)) {
    const job = session.apiSessionId ?? ''
    setUvrSessionResuming(id)
    void resumeServerSession(id, job, callbacksFor(id)).catch(() => {
      afterTaken(id, null)
    })
    return
  }
  patchSession(id, {
    status: 'idle',
    progress: 0,
    indeterminate: false,
    error: undefined,
  })
  setBlocked(false)
  pump()
}

/** Open the gate from a row that waits for songs ("Subscribe"). */
export function showImportGate(): void {
  gate?.(untrack(karaokeSongs))
}

/**
 * Remove a ready song from this phone: its stems and its row (plan §10).
 * The singer still has the original in Files, and can import it again.
 */
export async function removeImportedSong(id: string): Promise<boolean> {
  markKaraokeSongPlayed(id)
  return deleteUvrSession(id)
}

/** Remove a row, and the song with it. One being sent stops. */
export async function removeImport(id: string): Promise<void> {
  if (current?.id === id) current.abort.abort()
  againFor.delete(id)
  forget(id)
  await deleteUvrSession(id)
  pump()
}

// ── New songs ───────────────────────────────────────────────

/** Songs ready and not yet sung, as a signal. */
export const karaokeNewSongs = newSongs

/** A song sung once is no longer New. */
export function markKaraokeSongPlayed(id: string): void {
  const now = untrack(newSongs)
  if (!now.includes(id)) return
  const next = now.filter((candidate) => candidate !== id)
  setNewSongs(next)
  writeIds(KARAOKE_NEW_SONGS_KEY, next)
}

function announceReady(session: UvrSession): void {
  const id = session.sessionId
  batch(() => {
    forget(id)
    const next = [...untrack(newSongs).filter((c) => c !== id), id]
    setNewSongs(next)
    writeIds(KARAOKE_NEW_SONGS_KEY, next)
  })
  // The stems are what plays. The copy kept for a resend is not needed.
  void deleteStemBlobs(id, 'original')
  void refreshKaraokeSongs()
  const title = songTitleOf({ name: session.originalFile?.name ?? '' })
  showActionNotification(`${title} is ready to sing.`, 'success', {
    label: 'Open',
    onClick: () => {
      requestKaraokeSong(id)
      setActiveTab(TAB_KARAOKE)
    },
  })
}

// ── Rows ────────────────────────────────────────────────────

function failureOf(session: UvrSession): ImportFailure {
  const message = session.error ?? ''
  if (session.status === 'cancelled' || message === NOT_SENT) return 'not-sent'
  if (message === COPY_GONE) return 'missing'
  if (/expired/iu.test(message)) return 'expired'
  if (/storage is full|quota/iu.test(message)) return 'storage'
  // Separated, and still waiting on the server to be collected.
  if (hasJob(session)) return 'saving'
  return 'separation'
}

function stateOf(session: UvrSession): ImportRowState {
  const now = sending()
  if (now?.id === session.sessionId) {
    return { kind: 'sending', share: now.share, again: now.again }
  }
  if (session.status === 'error' || session.status === 'cancelled') {
    return { kind: 'failed', reason: failureOf(session) }
  }
  if (!hasJob(session)) {
    if (blocked()) {
      return { kind: 'blocked', subscribed: karaokeSongs().subscribed }
    }
    if (busy()) return { kind: 'busy' }
    if (offline()) return { kind: 'waiting-network' }
    return { kind: 'waiting-turn' }
  }
  if (session.status === 'finalizing') return { kind: 'saving' }
  if (
    session.status === 'processing' &&
    session.phase !== 'queued' &&
    session.indeterminate !== true
  ) {
    return { kind: 'separating', percent: Math.round(session.progress) }
  }
  return { kind: 'queued' }
}

/** The queue's rows, newest first, as the library lists your songs. */
export function importRows(): ImportRow[] {
  const sessions = getAllUvrSessionsReactive()
  const rows: ImportRow[] = []
  for (const id of [...tracked()].reverse()) {
    const session = sessions.find((candidate) => candidate.sessionId === id)
    if (session === undefined || session.status === 'completed') continue
    rows.push({
      sessionId: id,
      title: songTitleOf({ name: session.originalFile?.name ?? '' }),
      state: stateOf(session),
    })
  }
  return rows
}

const importRowsNow = (): ImportRow[] => untrack(importRows)

const IN_FLIGHT: ReadonlySet<ImportRowState['kind']> = new Set([
  'waiting-turn',
  'waiting-network',
  'sending',
  'busy',
  'queued',
  'separating',
  'saving',
])

/** Songs on their way to being ready: the player's "Separating 2". */
export function importsInFlight(): number {
  return importRows().filter((row) => IN_FLIGHT.has(row.state.kind)).length
}

/** The song being sent, for "Keep Mercury Pitch open until … is sent." */
export function sendingTitle(): string | null {
  const now = sending()
  if (now === null) return null
  const session = getAllUvrSessionsReactive().find(
    (candidate) => candidate.sessionId === now.id,
  )
  return session === undefined
    ? null
    : songTitleOf({ name: session.originalFile?.name ?? '' })
}

const percent = (share: number): number =>
  Math.max(0, Math.min(100, Math.floor(share * 100)))

/** A row's state, in the singer's words (plan §6.4, §6.6). */
export function importRowLine(state: ImportRowState): string {
  switch (state.kind) {
    case 'waiting-turn':
      return 'Waiting to be sent'
    case 'waiting-network':
      return 'Waiting for a connection. It is sent when the phone is back online.'
    case 'sending':
      if (state.again === 'closed') {
        return `Sending again · ${percent(state.share)}%. The app closed before it finished.`
      }
      return state.again === 'network'
        ? `Sending again · ${percent(state.share)}%`
        : `Sending · ${percent(state.share)}%`
    case 'busy':
      return 'The studio is busy. Trying again in a minute.'
    case 'blocked':
      return state.subscribed
        ? 'Waiting for your songs to come back'
        : 'Waiting: subscribe to continue'
    case 'queued':
      return 'Waiting for a studio slot'
    case 'separating':
      return `Separating · ${state.percent}%`
    case 'saving':
      return 'Saving to this phone'
    case 'failed':
      switch (state.reason) {
        case 'separation':
          return 'This song could not be separated. It was given back.'
        case 'expired':
          return 'This song expired on the server before it reached your phone.'
        case 'storage':
          return 'Not enough space on this phone. Free up about 20 MB.'
        case 'saving':
          return 'The song could not be saved to this phone.'
        case 'not-sent':
          return NOT_SENT
        case 'missing':
          return COPY_GONE
      }
  }
}

// ── Start and stop ──────────────────────────────────────────

/** A song the last run was sending when the app closed goes back in line. */
function recoverCutOffSends(): void {
  const marked = readSending()
  writeSending(null)
  for (const id of untrack(tracked)) {
    const session = getUvrSession(id)
    if (session === undefined || hasJob(session)) continue
    const cutOff =
      id === marked ||
      (session.status === 'error' && session.error === CUT_OFF_BY_RELOAD) ||
      session.status === 'processing' ||
      session.status === 'uploading'
    if (!cutOff) continue
    againFor.set(id, 'closed')
    patchSession(id, {
      status: 'idle',
      progress: 0,
      indeterminate: false,
      error: undefined,
    })
  }
}

/**
 * Run the queue for the life of the app (NativeShell starts it where the
 * build imports songs). Idempotent; the returned function stops it.
 */
export function startKaraokeImportQueue(): () => void {
  if (started) return stopKaraokeImportQueue
  started = true
  const disposeRoot = createRoot((dispose) => {
    // A ready song leaves the queue; a row whose session is gone (removed
    // in the studio) goes with it.
    createEffect(() => {
      if (!ready()) return
      const sessions = getAllUvrSessionsReactive()
      for (const id of tracked()) {
        const session = sessions.find((candidate) => candidate.sessionId === id)
        if (session === undefined) untrack(() => forget(id))
        else if (session.status === 'completed') {
          untrack(() => announceReady(session))
        }
      }
    })
    // Songs arriving (a subscription, next month) let a blocked queue go on.
    createEffect(
      on(karaokeSongs, (songs) => {
        if (!untrack(blocked)) return
        if (songs.left === null || songs.left <= 0) return
        setBlocked(false)
        pump()
      }),
    )
    return dispose
  })
  const onOnline = (): void => {
    setOffline(false)
    pump()
  }
  const onVisible = (): void => {
    if (document.visibilityState !== 'visible') return
    held = false
    pump()
  }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  stopListening = () => {
    disposeRoot()
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
  }
  void whenSessionStoreReady().then(() => {
    if (!started) return
    recoverCutOffSends()
    setReady(true)
    pump()
  })
  return stopKaraokeImportQueue
}

let stopListening: () => void = () => undefined

function stopKaraokeImportQueue(): void {
  if (!started) return
  started = false
  stopListening()
  stopListening = () => undefined
  current?.abort.abort()
  current = null
  held = false
  for (const timer of timers) clearTimeout(timer)
  timers.clear()
  setReady(false)
}

/** Tests only: a queue that has never run, read again from storage. */
export function resetImportQueueForTests(): void {
  stopKaraokeImportQueue()
  againFor.clear()
  gate = null
  batch(() => {
    setTracked(readIds(KARAOKE_IMPORTS_KEY))
    setNewSongs(readIds(KARAOKE_NEW_SONGS_KEY))
    setSending(null)
    setOffline(false)
    setBusy(false)
    setBlocked(false)
  })
}
