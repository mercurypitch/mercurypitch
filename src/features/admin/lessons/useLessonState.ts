// ============================================================
// useLessonState — the Lessons page's overrides: read, saved and logged
// ============================================================
//
// Holds what the site's lesson state says, each lesson's log once read, and
// every save in flight and how it ended. A save puts the row the API
// answered in place at once, then reads the whole state and that lesson's
// log again, so the page shows what is stored rather than its own guess. A
// read that answers after a newer one was asked is dropped, and nothing
// lands once the page is gone.
//
// Logs are read per lesson, when they matter: at once for every lesson with
// an override (the table says who set it), and for any other lesson when its
// card opens. A refused key on any admin call raises `keyRejected` until an
// admin call succeeds again.

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import type { LessonOverride, LessonState, LessonStateChange, LessonStateField, LessonStateRow, } from '@/lib/lesson-state'
import { failedMessage, savedMessage } from './lesson-publish'
import type { LessonApiError } from './lesson-state-client'
import { fetchLessonLog, fetchLessonState, saveLesson, } from './lesson-state-client'

export type LogRead =
  | { readonly kind: 'reading' }
  | { readonly kind: 'read'; readonly changes: readonly LessonStateChange[] }
  | { readonly kind: 'failed'; readonly error: LessonApiError }

export type SaveOutcome =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly message: string }
  | {
      readonly kind: 'failed'
      readonly message: string
      readonly error: LessonApiError
    }

export interface SaveRequest {
  readonly n: number
  /** "Lesson 3", for what the page says after. */
  readonly name: string
  readonly field: LessonStateField
  /** The value to store; null puts the field back to the code's default. */
  readonly value: boolean | string | null
  /** Whether the code publishes it on this site, for "back to the default". */
  readonly defaultPublished: boolean
}

/** One message for the live region; a new object each time, so a repeat is still announced. */
export interface Announcement {
  readonly text: string
}

export interface LessonStateController {
  /** The overrides as last read; null until the first read lands. */
  readonly state: Accessor<LessonState | null>
  /** Why the last read failed; null once one succeeds. */
  readonly stateError: Accessor<LessonApiError | null>
  readonly readingState: Accessor<boolean>
  readonly stateReadAt: Accessor<Date | null>
  readonly readState: () => Promise<void>
  /** Lesson `n`'s override; empty when it has none. */
  readonly overrideOf: (n: number) => LessonOverride
  /** Lesson `n`'s log, as far as it has been read; undefined before it is asked for. */
  readonly logOf: (n: number) => LogRead | undefined
  /** Read lesson `n`'s log, unless it has been already. */
  readonly ensureLog: (n: number) => void
  readonly keyRejected: Accessor<boolean>
  readonly outcome: (
    n: number,
    field: LessonStateField,
  ) => SaveOutcome | undefined
  readonly saving: (n: number, field: LessonStateField) => boolean
  /** Save one field; true once it is stored. */
  readonly save: (request: SaveRequest) => Promise<boolean>
  readonly announcement: Accessor<Announcement | null>
}

export interface LessonStateOptions {
  /** Read at each call, so a changed key is the one sent. */
  readonly adminKey: () => string
  /** After a save is stored. */
  readonly onSaved?: () => void
}

const slot = (n: number, field: LessonStateField): string => `${n}:${field}`

/** The override a stored row holds. */
function overrideOfRow(row: LessonStateRow): LessonOverride {
  const override: LessonOverride = {}
  if (row.published !== null) override.published = row.published
  if (row.hook !== null) override.hook = row.hook
  if (row.tease !== null) override.tease = row.tease
  return override
}

/** The state with lesson `n` as a save answered it: its row's override, or none once cleared. */
export function withSavedRow(
  state: LessonState,
  n: number,
  row: LessonStateRow | null,
): LessonState {
  const lessons = { ...state.lessons }
  const override = row === null ? {} : overrideOfRow(row)
  if (Object.keys(override).length === 0) delete lessons[String(n)]
  else lessons[String(n)] = override
  return { ...state, updatedAt: row?.updatedAt ?? state.updatedAt, lessons }
}

function patchOf(
  field: LessonStateField,
  value: boolean | string | null,
): LessonOverride {
  if (field === 'published') {
    return { published: typeof value === 'boolean' ? value : null }
  }
  const variant = typeof value === 'string' ? value : null
  return field === 'hook' ? { hook: variant } : { tease: variant }
}

export function useLessonState(
  options: LessonStateOptions,
): LessonStateController {
  const [state, setState] = createSignal<LessonState | null>(null)
  const [stateError, setStateError] = createSignal<LessonApiError | null>(null)
  const [readingState, setReadingState] = createSignal(false)
  const [stateReadAt, setStateReadAt] = createSignal<Date | null>(null)
  const [logs, setLogs] = createSignal<ReadonlyMap<number, LogRead>>(new Map())
  const [outcomes, setOutcomes] = createSignal<
    ReadonlyMap<string, SaveOutcome>
  >(new Map())
  const [keyRejected, setKeyRejected] = createSignal(false)
  const [announcement, setAnnouncement] = createSignal<Announcement | null>(
    null,
  )
  let alive = true
  let stateRun = 0
  const logRuns = new Map<number, number>()
  onCleanup(() => {
    alive = false
  })

  /** An admin call's answer says whether the key is good. */
  const noteKey = (error: LessonApiError | null): void => {
    if (error === null) setKeyRejected(false)
    else if (error.kind === 'forbidden') setKeyRejected(true)
  }

  const setOutcome = (key: string, outcome: SaveOutcome): void => {
    setOutcomes((prev) => new Map(prev).set(key, outcome))
  }

  const readLog = async (n: number): Promise<void> => {
    const run = (logRuns.get(n) ?? 0) + 1
    logRuns.set(n, run)
    const adminKey = options.adminKey()
    // A log already on the page stays there while it is read again.
    if (logs().get(n)?.kind !== 'read') {
      setLogs((prev) => new Map(prev).set(n, { kind: 'reading' }))
    }
    const result = await fetchLessonLog(adminKey, n)
    if (!alive || logRuns.get(n) !== run) return
    noteKey(result.ok ? null : result.error)
    const read: LogRead = result.ok
      ? { kind: 'read', changes: result.value }
      : { kind: 'failed', error: result.error }
    setLogs((prev) => new Map(prev).set(n, read))
  }

  const ensureLog = (n: number): void => {
    if (!logs().has(n)) void readLog(n)
  }

  const readState = async (): Promise<void> => {
    const run = ++stateRun
    setReadingState(true)
    const result = await fetchLessonState()
    if (!alive || run !== stateRun) return
    setReadingState(false)
    if (!result.ok) {
      setStateError(result.error)
      return
    }
    setState(result.value)
    setStateError(null)
    setStateReadAt(new Date())
    for (const key of Object.keys(result.value.lessons)) ensureLog(Number(key))
  }

  const saving = (n: number, field: LessonStateField): boolean =>
    outcomes().get(slot(n, field))?.kind === 'saving'

  const save = async (request: SaveRequest): Promise<boolean> => {
    const key = slot(request.n, request.field)
    if (saving(request.n, request.field)) return false
    const adminKey = options.adminKey()
    setOutcome(key, { kind: 'saving' })
    const result = await saveLesson(
      adminKey,
      request.n,
      patchOf(request.field, request.value),
    )
    if (!alive) return false
    noteKey(result.ok ? null : result.error)
    if (!result.ok) {
      const message = failedMessage(request.name, result.error)
      setOutcome(key, { kind: 'failed', message, error: result.error })
      setAnnouncement({ text: message })
      return false
    }
    const { row, changed } = result.value
    const message = savedMessage(
      request.name,
      request.field,
      request.value,
      changed.length > 0,
      request.defaultPublished,
    )
    setState((prev) =>
      prev === null ? prev : withSavedRow(prev, request.n, row),
    )
    setOutcome(key, { kind: 'saved', message })
    setAnnouncement({ text: message })
    void readState()
    void readLog(request.n)
    options.onSaved?.()
    return true
  }

  return {
    state,
    stateError,
    readingState,
    stateReadAt,
    readState,
    overrideOf: (n) => state()?.lessons[String(n)] ?? {},
    logOf: (n) => logs().get(n),
    ensureLog,
    keyRejected,
    outcome: (n, field) => outcomes().get(slot(n, field)),
    saving,
    save,
    announcement,
  }
}
