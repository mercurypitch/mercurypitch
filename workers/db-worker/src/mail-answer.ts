// ============================================================
// mail-answer — what Resend's answer says of a mail the law asks for
// ============================================================
//
// The purchase mail (CRD Art. 8(7), checkout-consent.ts) and the withdrawal
// acknowledgement (Art. 11a(4), withdrawal-ack.ts) have to reach the buyer,
// so neither is let go on a guess. Resend's answer to a try is one of three:
//
//   sent      Resend took it.
//   unknown   No answer, a 5xx, a 429, or a 409 (two requests at once under
//             the key: concurrent_idempotent_requests). Whether it went is
//             not known: the sweep sends it again, under the same key, for
//             as long as it takes, and tells the owner once if it has still
//             not gone after 3 days (WARN_AFTER_MS).
//   refused   Any other 4xx: an address Resend cannot use, a key it does not
//             accept. Sending it again changes nothing, so the sweep stops at
//             once, and the owner is told to send it by hand. It stays
//             REFUSED until Resend has taken that alert, and only then is
//             GAVE_UP: a give-up nobody heard of never happens.
//
// A 409 invalid_idempotent_request says the key went with another body
// within 24 hours. The mail renders again on every try, and its body moves
// (a refund that went through, a balance), so after a try whose outcome was
// unknown that 409 says the earlier one was taken: sent. After anything
// else it is a refusal. Resend's docs (idempotency keys, errors; read
// 10 Oct 2026) say nothing of a key whose first request was refused. The
// one case this reads wrong: a try that got no answer though Resend had
// refused it, then a retry with another body, reads as sent.

import type { ResendResult } from './email'
import { sentUnderKeyAlready } from './email'

/** What a try at a mail ended in. `why` is Resend's answer, for the owner. */
export type MailAnswer =
  | { kind: 'sent' }
  | { kind: 'unknown'; why: string }
  | { kind: 'refused'; why: string }

/** A mail whose last try Resend refused for good: waiting for the owner's
 *  alert to go, never sent again. */
export const REFUSED = 'refused'
/** A refused mail the owner has been told to send by hand. */
export const GAVE_UP = 'gave-up'
/** The owner hears once of a mail still not sent this long after its
 *  purchase or statement; the sweep keeps sending it. */
export const WARN_AFTER_MS = 3 * 86_400_000

const SENT: MailAnswer = { kind: 'sent' }

/** Resend's answer in words: "Resend answered 422 validation_error". */
export function resendSaid(result: ResendResult): string {
  if (result.unanswered === true) return 'Resend did not answer'
  if (result.status === undefined) {
    return 'Resend was not asked: no address to send it to'
  }
  const name = result.errorName === undefined ? '' : ` ${result.errorName}`
  return `Resend answered ${result.status}${name}`
}

/** Whether Resend's refusal says nothing of whether the mail can go. */
function passing(status: number): boolean {
  return status === 409 || status === 429 || status >= 500
}

/**
 * What Resend's answer to a try says of the mail. `afterUnknown`: the try
 * before this one ended without a known outcome, so a 409
 * invalid_idempotent_request means it went.
 */
export function mailAnswer(
  result: ResendResult,
  afterUnknown: boolean,
): MailAnswer {
  if (result.ok) return SENT
  const why = resendSaid(result)
  if (result.unanswered === true) return { kind: 'unknown', why }
  if (result.status === undefined) return { kind: 'refused', why }
  if (sentUnderKeyAlready(result)) {
    return afterUnknown ? SENT : { kind: 'refused', why }
  }
  if (passing(result.status) || result.status < 400) {
    return { kind: 'unknown', why }
  }
  return { kind: 'refused', why }
}

/** The status a try leaves the mail in. */
export function statusAfter(answer: MailAnswer): string {
  if (answer.kind === 'sent') return 'sent'
  return answer.kind === 'refused' ? REFUSED : 'failed'
}
