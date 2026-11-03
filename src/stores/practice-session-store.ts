// ============================================================
// Practice Session Store — the multi-item guided practice run
// ============================================================
//
// A session is an ordered list of SessionItems, each repeated N times.
// `advanceSessionItem` walks that structure; `endPracticeSession` is the
// commit point that persists the record, records activity, and triggers badge
// evaluation. Ending a session twice grants badges twice.
//
// Distinct from a single exercise run -- that path is exercise-history-store.

import { createSignal } from 'solid-js'
import { checkAndGrantBadges } from '@/db/services/badge-grant-engine'
import { creditPracticeTime, saveSessionRecord, } from '@/db/services/session-service'
import { getUserId } from '@/db/services/user-service'
import { isNoteHit } from '@/features/exercises/exercise-note-tally'
import { trackEvent } from '@/lib/analytics'
import { noteWasSung } from '@/lib/domain/note-sung'
import { createPersistedSignal } from '@/lib/storage'
import type { PlaybackSession, PracticeResult, SessionItem, SessionResult, } from '@/types'
import { isSessionItemMelodyMissing, STORAGE_KEY_SESSION_HIST, } from './melody-store'
import { showNotification } from './notifications-store'
import { recordCompletion } from './usage-store'

export const [practiceSession, setPracticeSession] =
  createSignal<PlaybackSession | null>(null)
export const [sessionItemIndex, setSessionItemIndex] = createSignal(0)
export const [sessionItemRepeat, setSessionItemRepeat] = createSignal(0)
export const [sessionActive, setSessionActive] = createSignal(false)
export const [sessionModeSignal, setSessionMode] = createSignal(false)

/**
 * Transient flag set by an entry-point (Library "Play All", session
 * template launcher, practice-tab session play button) right before
 * `handlePlay()` is invoked. `handlePlay` reads-and-clears this flag
 * to decide whether the upcoming Play should enter session mode and
 * prime the first session item.
 *
 * Without this gate, `handlePlay()` would inspect `userSession()` and
 * silently promote a single-melody Practice play into a session
 * playback whenever a session happened to be loaded in the editor.
 * (See `assets/plans/session-sequence-advancement.md` Bug 3.)
 */

export const [practiceResults, setPracticeResults] = createSignal<
  PracticeResult[]
>([])
// Results state
export const [sessionResults, setSessionResults] = createPersistedSignal<
  SessionResult[]
>(STORAGE_KEY_SESSION_HIST, [])

export const currentSessionItemIndex = sessionItemIndex
export const currentSessionItemRepeat = sessionItemRepeat
export const sessionMode = sessionModeSignal

export function getSessionHistory() {
  return sessionResults()
}

export function getCurrentSessionItem(): SessionItem | null {
  const session = practiceSession()
  if (!session) return null
  const idx = sessionItemIndex()
  if (idx < 0 || idx >= session.items.length) return null
  return session.items[idx]
}

export function getPracticeSessionItems(): PlaybackSession['items'] {
  const session = practiceSession()
  return session?.items ?? []
}

export function getCurrentSessionItemIndex(): number {
  return sessionItemIndex()
}

export function advanceSessionItem(): SessionItem | null {
  const session = practiceSession()
  if (!session) return null
  const currentItem = getCurrentSessionItem()
  const repeatCount = currentItem?.repeat ?? 1
  const currentRepeat = sessionItemRepeat()

  if (currentRepeat < repeatCount - 1) {
    setSessionItemRepeat(currentRepeat + 1)
    return getCurrentSessionItem()
  } else {
    const next = sessionItemIndex() + 1
    if (next < session.items.length) {
      setSessionItemIndex(next)
      setSessionItemRepeat(0)
      // Return the item AFTER advancing. Must read the index we just
      // set, otherwise the melody/preset path in loadNextSessionItem
      // loads the item at the OLD index when the previous item was a
      // rest (rest handler reads getCurrentSessionItem() before the
      // advance in handleSessionItemComplete).
      const advanced = session.items[next]
      return advanced ?? null
    }
  }
  return null
}

export function recordSessionItemResult(result: PracticeResult): void {
  setPracticeResults((prev) => {
    return [result, ...prev]
  })
}

// ── Whether the session in progress is a whole one ──────────────────────
//
// Each item banks its result as it finishes, and the session's score is the
// average of what was banked. A session stopped after one good item averaged
// that one item, as a drill stopped after one good round graded like a
// flawless run, and its record counted toward every goal that reads a score
// (Perfect Run, Immaculate). So a session is scored only when it ran to its
// end with no item skipped; any other is practice: its time counts, its
// score does not (`endPracticeSession`). The same rule as a stopped drill's
// (`stoppedEarlyMark`).

let sessionStartedAt: number | null = null
let sessionPausedAt: number | null = null
let sessionPausedMs = 0
let sessionReachedEnd = false
let sessionItemSkipped = false
let skippedItemSung = false

function clearSessionClock(): void {
  sessionStartedAt = null
  sessionPausedAt = null
  sessionPausedMs = 0
  sessionReachedEnd = false
  sessionItemSkipped = false
  skippedItemSung = false
}

/** A session starts: its clock runs from now, and it is whole so far. */
export function markPracticeSessionStarted(now: number = Date.now()): void {
  clearSessionClock()
  sessionStartedAt = now
}

/** The transport paused. A pause is not practice, so the clock stops. */
export function markPracticeSessionPaused(now: number = Date.now()): void {
  if (sessionStartedAt !== null && sessionPausedAt === null) {
    sessionPausedAt = now
  }
}

/** The transport resumed, and the clock with it. */
export function markPracticeSessionResumed(now: number = Date.now()): void {
  if (sessionPausedAt === null) return
  sessionPausedMs += now - sessionPausedAt
  sessionPausedAt = null
}

/**
 * The transport was reset with a session still running: the tab left,
 * another song loaded, Reset pressed. That session is over without an end,
 * but its object stays until the next Stop clears it, and every Stop ends
 * the practice session. Without this, a Stop of anything an hour later
 * would end it as a session the singer had just stopped: a notice, and the
 * hour credited as practice.
 */
export function markPracticeSessionLeft(): void {
  clearSessionClock()
}

/**
 * The singer skipped an item, so the session can no longer be whole. What
 * they sang of it banks nothing, but it was practice all the same.
 */
export function markSessionItemSkipped(sung: boolean): void {
  sessionItemSkipped = true
  if (sung) skippedItemSung = true
}

/** The session's last item played to its end. */
export function markSessionReachedEnd(): void {
  sessionReachedEnd = true
}

/**
 * The session's own length so far: from its start, less its pauses, an open
 * one included. No length is no measurement, so a session never started, or
 * ended at once, has none: a 0 would fail the record's evidence rule.
 */
function sessionLengthMs(now: number): number | undefined {
  if (sessionStartedAt === null) return undefined
  const openPauseMs = sessionPausedAt !== null ? now - sessionPausedAt : 0
  const lengthMs = now - sessionStartedAt - sessionPausedMs - openPauseMs
  return lengthMs > 0 ? lengthMs : undefined
}

/** The store lets the session go: no session, position or mode is left. */
function clearPracticeSession(): void {
  setSessionActive(false)
  setPracticeSession(null)
  setSessionItemIndex(0)
  setSessionItemRepeat(0)
  setSessionMode(false)
}

/** What a whole session says as it ends. */
export function sessionCompleteLine(score: number): string {
  return `Session complete! Score: ${score}%`
}

/** What a session that was not whole says in place of its score. */
export const SESSION_STOPPED_LINE =
  'You stopped before the end, so this session was not scored. Its time still counts as practice.'
export const SESSION_SKIPPED_LINE =
  'You skipped part of this session, so it was not scored. Its time still counts as practice.'

/**
 * Whether one banked run landed: its SUNG notes average within the line.
 * An unsung note's 0 cents is no hit (`noteWasSung`): averaged in, a run
 * nobody sang landed dead centre. A result that keeps no notes is judged by
 * its own average.
 */
function runLanded(result: PracticeResult): boolean {
  const notes = result.noteResult ?? []
  if (notes.length === 0) return isNoteHit(Math.abs(result.avgCents))
  const sung = notes.filter(noteWasSung)
  if (sung.length === 0) return false
  const cents =
    sung.reduce((sum, note) => sum + Math.abs(note.avgCents), 0) / sung.length
  return isNoteHit(cents)
}

/**
 * Whether the singer sang any of a banked run. A result that keeps no notes
 * is taken as sung: there is nothing to read otherwise, and its score
 * stands.
 */
function runWasSung(result: PracticeResult): boolean {
  const notes = result.noteResult ?? []
  return notes.length === 0 || notes.some(noteWasSung)
}

/**
 * Whether the session's singing is done: from the item it stands on, only
 * rests are left, and items whose melody was deleted, which the sequencer
 * passes over. A Stop or End there ends a session whose every sung item is
 * behind it, so it is whole, not stopped.
 */
function onlyRestsRemain(session: PlaybackSession): boolean {
  return session.items
    .slice(sessionItemIndex())
    .every((item) => item.type === 'rest' || isSessionItemMelodyMissing(item))
}

/**
 * The sessionRecords payload for a finished multi-item session.
 *
 * One result is banked per item-*repeat*, so the denominator has to count
 * repeats too. Counting `items.length` instead made notesHit exceed
 * notesTotal for every built-in template (warmup-2min: 24 against 5), the
 * worker's evidence rule rejected the create, and `saveSessionRecord`
 * swallows that by design — so the whole session silently banked nothing:
 * no record, no minutes, no streak, no badges. Same shape as the plain-drill
 * loss in CLAUDE-JOURNEY-007; see exercise-record-payload.test.ts.
 *
 * Exported so the payload can be held against the production validator
 * without driving the whole store.
 */
export function practiceSessionPayload(
  session: PlaybackSession,
  results: PracticeResult[],
  durationMs?: number,
): {
  melodyName: string
  score: number
  accuracy: number
  notesHit: number
  notesTotal: number
  durationMs?: number
  source: 'practice'
} {
  const avgScore = Math.round(
    results.reduce((sum, r) => sum + r.score, 0) / results.length,
  )
  // Rests bank no PracticeResult (useSessionSequencer banks an item only
  // when it has notes), so counting them would understate a finished run.
  const scheduledRuns = session.items.reduce(
    (total, item) => total + (item.type === 'rest' ? 0 : (item.repeat ?? 1)),
    0,
  )
  return {
    melodyName: session.name,
    score: avgScore,
    accuracy: avgScore,
    // Runs LANDED, not runs reached. This used to be `results.length`,
    // which counted every item the singer got to regardless of pitch -- so
    // the column read 100% for a run sung entirely flat, and Practice rows
    // meant something different from every other run kind. The line is the
    // same fixed 25 cents the drills use (exercise-note-tally); the singer's
    // accuracy tier shapes score and accuracy, never the count.
    notesHit: results.filter(runLanded).length,
    // A walk that somehow outran its own schedule must not resurrect the
    // 400 — the run happened either way, and the evidence is worth more
    // than the tally.
    notesTotal: Math.max(scheduledRuns, results.length),
    // The session's own clock, start to end, less its pauses. Without it
    // the record is credited an estimate from its note count, at least
    // ninety seconds, whatever the session's length.
    ...(durationMs !== undefined ? { durationMs } : {}),
    source: 'practice',
  }
}

export interface EndPracticeSessionOptions {
  /**
   * Whether the singer sang any of the item the Stop cut short. It banks
   * nothing, but its singing is practice, as a banked item's is.
   */
  inFlightSung?: boolean
}

export function endPracticeSession(
  options: EndPracticeSessionOptions = {},
): SessionResult | null {
  const session = practiceSession()
  if (!session) return null

  const results = practiceResults()
  const live = sessionStartedAt !== null
  // Without a length the record carries its estimate.
  const durationMs = sessionLengthMs(Date.now())
  const reachedItsEnd = sessionReachedEnd
  const reachedEnd = reachedItsEnd || onlyRestsRemain(session)
  const skipped = sessionItemSkipped
  // A session the transport left is over without an end, whatever it
  // reached (markPracticeSessionLeft).
  const whole = live && reachedEnd && !skipped
  const bankedSung = results.some(runWasSung)
  const sung = options.inFlightSung === true || skippedItemSung || bankedSung
  clearSessionClock()

  // A session that was not whole is practice, not a result: no score, no
  // record and no local history, so no goal, Progress thread or profile
  // average reads it. Its measured time still counts, toward the day's
  // minutes and the streak, as a stopped drill's does. A session the
  // transport already left (markPracticeSessionLeft), and one stopped
  // before a note was sung, are only cleared: nothing was practised.
  if (!whole) {
    clearPracticeSession()
    if (!live || !sung) return null
    // Run to its end with an item skipped, it was finished, if not scored.
    if (reachedEnd) recordCompletion()
    trackEvent('session_stopped')
    void creditPracticeTime(durationMs, getUserId()).catch(() => {})
    showNotification(
      skipped ? SESSION_SKIPPED_LINE : SESSION_STOPPED_LINE,
      'info',
    )
    return null
  }

  // A session with ZERO scored items records nothing: play-then-stop runs
  // used to persist score-0 entries locally AND as cloud sessionRecords,
  // dragging the profile's best/accuracy/recent-average to 0% and polluting
  // the leaderboard aggregates with sessions that never scored a note. A
  // session played to its end with no note sung is the same: its items
  // banked, but only unsung notes.
  if (!bankedSung) {
    clearPracticeSession()
    return null
  }

  const avgScore = Math.round(
    results.reduce((sum, r) => sum + r.score, 0) / results.length,
  )

  const result: SessionResult = {
    sessionId: session.id,
    name: session.name,
    sessionName: session.name,
    completedAt: Date.now(),
    itemsCompleted: results.length,
    practiceItemResult: results,
    totalItems: session.items.length,
    score: avgScore,
  }

  setSessionResults((prev) => [result, ...prev].slice(0, 50))

  // Persist the record, then check for newly-earned badges/achievements
  // (grant check reads the just-saved record, so chain it after the save).
  // Free practice over a self-chosen melody: kept for personal history, the
  // badge engine and streaks, but never publicly ranked — the difficulty is
  // whatever the singer picked, so the scores compare nothing.
  const ownerId = getUserId()
  void saveSessionRecord(
    practiceSessionPayload(session, results, durationMs),
    ownerId,
  )
    .then((savedSession) => {
      if (savedSession === null || getUserId() !== ownerId) return
      return checkAndGrantBadges(ownerId)
    })
    .catch(() => {})

  clearPracticeSession()

  recordCompletion()

  // The sequencer says this when a session runs out; a Stop or End in its
  // last rest finished it too, and says the same.
  if (!reachedItsEnd) {
    showNotification(
      sessionCompleteLine(avgScore),
      avgScore >= 80 ? 'success' : 'info',
    )
  }

  return result
}

/**
 * Minimal per-note accuracy sample, decoupled from `NoteResult` /
 * `MelodyItem` and the nested `SessionResult` shape. This is the single
 * projection the accuracy heatmap and pitch-weakness analyzer consume, so
 * neither has to walk the raw session-history structure itself.
 */
export interface NoteAccuracySample {
  /** MIDI note number that was practiced. */
  midi: number
  /**
   * Mean absolute cents deviation from the target for this note — a
   * NON-NEGATIVE magnitude. The practice engine averages `Math.abs(cents)`
   * per pitch sample (see `finalizeNoteResult`), so this never carries the
   * sharp/flat sign; consumers must not infer pitch direction from it.
   */
  avgCents: number
}

/**
 * Derive per-note accuracy samples from the persisted session history.
 *
 * This is the single seam between the accuracy heatmap / pitch-weakness
 * analyzer and the nested `SessionResult -> practiceItemResult ->
 * noteResult` shape — those two consumers depend on `NoteAccuracySample`,
 * not the raw structure. (Other features — vocal range/challenges/analysis
 * — read different `NoteResult` fields directly and are intentionally not
 * served by this projection.)
 *
 * Defensive against malformed persisted history: the store loads via a bare
 * `JSON.parse` with no schema validator, so a stale or hand-edited entry
 * could be missing `item`/`note` or carry a non-numeric value. Such notes
 * are skipped rather than allowed to throw (which would take down both
 * consumers at once) or to leak `NaN` into the averaged scores.
 */
export function collectNoteAccuracySamples(): NoteAccuracySample[] {
  const samples: NoteAccuracySample[] = []
  for (const entry of sessionResults()) {
    for (const pr of entry.practiceItemResult ?? []) {
      for (const nr of pr.noteResult ?? []) {
        const midi = nr?.item?.note?.midi
        const avgCents = nr?.avgCents
        if (!Number.isFinite(midi) || !Number.isFinite(avgCents)) continue
        // An unsung note's 0 cents is no reading: kept, it painted a note
        // never sung as perfect.
        if (!noteWasSung(nr)) continue
        samples.push({ midi, avgCents })
      }
    }
  }
  return samples
}

/**
 * Map a cents deviation to a 0-100 accuracy score for the heatmap gradient:
 * within +-5 cents scores a perfect 100, then falls off 5 points per cent
 * beyond that tolerance.
 *
 * Deliberately a CONTINUOUS curve, distinct from practice-engine's discrete
 * accuracy bands (`centsToBand`: 100/90/75/50/0) used for scoring and
 * ratings — the heatmap wants a smooth per-note colour ramp, not named
 * tiers, so the two are not meant to agree numerically.
 *
 * Scores by magnitude via `Math.abs`. Production `avgCents` is already a
 * non-negative magnitude (see `NoteAccuracySample`), so the abs is a guard
 * against a hypothetical signed producer, not a live symmetry requirement.
 */
function centsToAccuracy(avgCents: number): number {
  const off = Math.abs(avgCents)
  return off <= 5 ? 100 : Math.max(0, 100 - (off - 5) * 5)
}

/**
 * Build the note-accuracy map (MIDI -> 0-100 accuracy) rendered by the
 * pitch-accuracy heatmap. Reads the decoupled `NoteAccuracySample`
 * projection rather than the raw session/`NoteResult` shape, and averages
 * per MIDI note in a single pass (sum/count) — same result as collecting
 * each note's scores and averaging, without the intermediate arrays.
 */
export function getNoteAccuracyMap(): Map<number, number> {
  const acc = new Map<number, { sum: number; count: number }>()
  for (const { midi, avgCents } of collectNoteAccuracySamples()) {
    const entry = acc.get(midi) ?? { sum: 0, count: 0 }
    entry.sum += centsToAccuracy(avgCents)
    entry.count++
    acc.set(midi, entry)
  }
  const result = new Map<number, number>()
  for (const [midi, { sum, count }] of acc) {
    result.set(midi, Math.round(sum / count))
  }
  return result
}
