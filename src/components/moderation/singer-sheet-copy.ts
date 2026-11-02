// ============================================================
// The singer sheet's words
// ============================================================
//
// What SingerSheet.tsx says, kept apart so the wording is tested on its
// own: the reasons a report can give, in the worker's own order
// (report-rules.ts), and every way a report or a block can fail, in plain
// words that say what happened and what the singer can do next.

import type { ModerationProblem, ReportKind, ReportReason, } from '@/db/services/moderation-service'
import { REPORT_NOTE_MAX } from '@/db/services/moderation-service'
import { contactFormUrl } from '@/lib/contact-links'

/** Each reason the worker takes, as the sheet asks it. */
export const REASON_WORDS: Readonly<Record<ReportReason, string>> = {
  offensive: 'Offensive name or words',
  abuse: 'Bullying or harassment',
  sexual: 'Sexual content',
  spam: 'Spam',
  impersonation: 'Pretending to be someone else',
  other: 'Something else',
}

/** After a report reaches the owner. */
export const SENT_WORDS = 'Thanks. We read every report within a day.'

/** The title over a report the singer had already sent, still open. */
export const ALREADY_OPEN_TITLE = 'We have your report already'

/** And under it: nothing new was sent, and what happens to the old one. */
export const ALREADY_OPEN_WORDS =
  'Your earlier report on this is still open, so nothing new was sent. We read every report within a day.'

/** The server answered, but could not do what was asked. */
export const SERVER_WORDS =
  'MercuryPitch could not answer just now. Try again in a moment.'

/** What a block does, said before it and after it. */
export const BLOCK_WORDS =
  "You will not see each other's names or posts. You can unblock them in Settings, Blocked singers."

/** "12 of 500": the note's length against the most the worker takes. */
export function noteCount(note: string): string {
  return `${note.length} of ${REPORT_NOTE_MAX}`
}

/**
 * The contact form, on its support topic (the only topics it takes are
 * `ContactTopic`'s), with a first line naming the report it is about.
 */
export function reportContactUrl(
  displayName: string,
  kind: ReportKind,
  id: string,
): string {
  return contactFormUrl(
    'support',
    `About a report on ${displayName} (${kind} ${id}):\n\n`,
  )
}

/** The contact form for a suspended account, about the suspension. */
export function suspendedContactUrl(): string {
  return contactFormUrl('support', 'About my suspended account:\n\n')
}

export type SheetAction = 'report' | 'block'

/** The sheet's panes (SingerSheet.tsx). */
export type SheetPane =
  | 'choose'
  | 'report'
  | 'sent'
  | 'already'
  | 'block'
  | 'blocked'
  | 'account'
  | 'problem'

/** What failed, and why. */
export interface SheetProblem {
  action: SheetAction
  problem: ModerationProblem
}

export interface ProblemWords {
  title: string
  body: string
  /** What a second try means: the same request, back to the report, none. */
  retry: 'again' | 'edit' | null
  /** Whether signing in is the way on. */
  signIn: boolean
  /** The contact form under the words: about the report, the account, none. */
  contact: 'report' | 'account' | null
}

/** Reports and blocks are closed to a suspended account. */
export const SUSPENDED_TITLE = 'This account is suspended'

/** Why a report or a block did not happen, and what to do about it. */
export function problemWords(
  action: SheetAction,
  problem: ModerationProblem,
  name: string,
): ProblemWords {
  const failed =
    action === 'report'
      ? 'Could not send the report'
      : `Could not block ${name}`
  const words = (
    body: string,
    retry: ProblemWords['retry'] = null,
  ): ProblemWords => ({
    title: failed,
    body,
    retry,
    signIn: false,
    contact: action === 'report' ? 'report' : null,
  })
  switch (problem) {
    case 'account':
      return {
        title: 'Sign in to report or block',
        body: 'Reports and blocks are for registered singers. Sign in or create an account, or tell us about it through the contact form.',
        retry: null,
        signIn: true,
        contact: 'report',
      }
    case 'refused':
      return {
        title: 'Sign in again',
        body: 'This device is no longer signed in to your account. Sign in again to report or block.',
        retry: null,
        signIn: true,
        contact: null,
      }
    case 'suspended':
      return {
        title: SUSPENDED_TITLE,
        body: 'A suspended account cannot report or block. If you think this is a mistake, tell us through the contact form.',
        retry: null,
        signIn: false,
        contact: 'account',
      }
    case 'missing':
      return words(
        action === 'report'
          ? 'This is no longer there to report. It may have been taken down already.'
          : 'This singer is no longer on MercuryPitch.',
      )
    case 'self':
      return words(
        action === 'report'
          ? 'You cannot report yourself.'
          : 'You cannot block yourself.',
      )
    case 'invalid':
      return words(
        'Part of this report could not be sent. Check it and try again.',
        'edit',
      )
    case 'busy':
      return words(
        action === 'report'
          ? 'You have sent a lot of reports in the last hour. Try again later.'
          : 'You have blocked or unblocked a lot of singers in the last hour. Try again later.',
      )
    case 'full':
      return words(
        'You have blocked as many singers as you can. Unblock someone in Settings, Blocked singers, first.',
      )
    case 'unreachable':
      return words(
        'Could not reach MercuryPitch. Check the connection and try again.',
        'again',
      )
    case 'server':
      return words(SERVER_WORDS, 'again')
  }
}

/** The title over a pane, which takes the focus as the pane opens. */
export function paneTitle(
  pane: SheetPane,
  name: string,
  failed: SheetProblem | null,
): string {
  switch (pane) {
    case 'choose':
      return name
    case 'report':
      return `Report ${name}`
    case 'sent':
      return 'Report sent'
    case 'already':
      return ALREADY_OPEN_TITLE
    case 'block':
      return `Block ${name}?`
    case 'blocked':
      return `${name} is blocked`
    case 'account':
      return problemWords('report', 'account', name).title
    case 'problem':
      return failed === null
        ? name
        : problemWords(failed.action, failed.problem, name).title
  }
}
