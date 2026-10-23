// ============================================================
// Lesson telemetry — each question's first answer in a visit, sent anonymously
// ============================================================
//
// The quick check and the recall (quiz.ts) send the team each question's
// first answer in a visit, as one `lesson_answer` event on the db-worker's
// first-party event route (src/lib/funnel-event-catalog.ts), which keeps
// only the numbers workers/db-worker/src/mirror-metrics.ts allows. That is
// all a lesson page sends: not the predicts, which have no right answer,
// not the ear games, not the sung or tapped checkpoints.
//
// Anonymous. The db-worker's database keeps, for each answer, the one
// client id every lesson page shares (`lesson-anonymous`), the UTC day it
// came on, and its seven numbers, `visit` among them: the first, the second
// or a later visit (the quiz's own count of page loads, capped at 3). It
// keeps no address, no time of day and no device id, and the row's place in
// its table is drawn at random, so that does not date it either
// (handleMirrorEvent, mirrorEventInsert). Outside that database Cloudflare
// keeps more, for a while: its request logs hold each request's address and
// time for up to 7 days, and D1's point-in-time recovery can show the minute
// a row was added for up to 30. The privacy notice has to say both.
//
// Only a page the site worker served sends: a document with no
// `#lesson-state` (page-state.ts: `pnpm dev`, the e2e bundle's static
// server, a page saved from the browser) or a build with no API base sends
// nothing. Consent follows the app's rule (lessonConsent): nothing from a
// visitor who declined, nor from one in the EEA, the UK or Switzerland who
// never said yes; the db-worker checks the address as well as this clock.
//
// quiz.ts loads this module by dynamic import on a quiz's first answer, so
// it is never first-paint work. It reads the consent regions from
// consent-regions.ts, which imports nothing, and imports none of the app's
// analytics, funnel or consent modules: they bring solid-js and package.json
// with them.

import { isRestrictedTimezone } from '@/lib/consent-regions'
import type { LessonFunnelEvent } from '@/lib/funnel-event-catalog'
import { LESSON_CLIENT_ID } from '@/lib/funnel-event-catalog'
import { store } from './dom'
import { lessonOfHref, PAGE_STATE_ID } from './publish'

/** What the beacon reads of an answer: quiz.ts `QuizAnswer` has it all. */
export interface AnswerSent {
  /** The question's id, `l04-q1` for Lesson 4's question 1. */
  readonly id: string
  readonly correct: boolean
  /** The question's number of options. */
  readonly k: number
  /** Which visit to this quiz the answer came in. */
  readonly visit: number
}

const EVENT: LessonFunnelEvent = 'lesson_answer'

/** The app's consent record (src/lib/consent.ts), read raw here. */
const CONSENT_KEY = 'mp.consent.v1'

/** The reader's time zone, as consent.ts reads it: '' when none is given. */
function timezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  } catch {
    return ''
  }
}

/**
 * The consent an answer is sent under, or null when none may be sent.
 *
 * The owner's rule of 23 October 2026 is the app's own: in the EEA, the UK
 * and Switzerland, by the reader's clock, a lesson page sends nothing unless
 * the reader recorded a yes. Everywhere else it sends, marked never asked
 * unless the reader accepted.
 *
 * - declined (`status: 'denied'`): null;
 * - accepted (`status: 'granted'`): 1;
 * - never asked (no record, one this cannot read, or a silent grant from
 *   before October 2026, which consent.ts counts as no choice): null when
 *   the clock is in the consent regions or names no place, else 2.
 */
export function lessonConsent(): 1 | 2 | null {
  const stored = store.get<unknown>(CONSENT_KEY, null)
  const { status, implicit } = (
    typeof stored === 'object' && stored !== null ? stored : {}
  ) as { status?: unknown; implicit?: unknown }
  if (status === 'denied') return null
  if (status === 'granted' && implicit !== true) return 1
  return isRestrictedTimezone(timezone()) ? null : 2
}

/** A question's lesson and number, from its id: `l04-q1` is 4 and 1. */
function questionOf(id: string): { lesson: number; n: number } | null {
  const m = /^l(\d+)-q(\d+)$/.exec(id)
  return m === null ? null : { lesson: Number(m[1]), n: Number(m[2]) }
}

/** The most `visit` says: the first, the second or a later visit. */
const VISIT_CAP = 3

/**
 * Send one answer, a question's first in this visit. A no-op with no API
 * base, on a page no site worker served, when consent says no, or when the
 * page or the question has no lesson number (the worker would refuse it);
 * every failure is swallowed, since telemetry must never break the lesson.
 */
export function sendLessonAnswer(answer: AnswerSent): void {
  const base: string | undefined = import.meta.env.VITE_API_BASE_URL
  if (base === undefined || base === '') return
  try {
    if (document.getElementById(PAGE_STATE_ID) === null) return
    const consent = lessonConsent()
    if (consent === null) return
    const page = lessonOfHref(window.location.pathname)
    const question = questionOf(answer.id)
    if (page === null || question === null) return
    const metrics = {
      page,
      qLesson: question.lesson,
      q: question.n,
      firstTry: answer.correct ? 1 : 0,
      k: answer.k,
      visit: Math.min(answer.visit, VISIT_CAP),
      consent,
    }
    // The field names are src/lib/funnel.ts `funnelEventBody`'s. `acq` is
    // what it sends for a visitor with no source, undefined, which JSON
    // leaves out. keepalive with credentials omitted, as the funnel's own
    // beacon does: sendBeacon is always credentialed, and the worker's
    // wildcard CORS answer would have the browser drop it.
    void fetch(`${base}/api/mirror/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: LESSON_CLIENT_ID,
        event: EVENT,
        metrics,
        acq: undefined,
      }),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined)
  } catch {
    // Telemetry must never break the lesson.
  }
}
