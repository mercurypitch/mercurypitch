// ============================================================
// mail-answer — what Resend's answer says of a mail the law asks for
// ============================================================
//
// The purchase mail (CRD Art. 8(7), checkout-consent.ts) and the withdrawal
// acknowledgement (Art. 11a(4), withdrawal-ack.ts) have to reach the buyer,
// so neither is let go on a guess. Resend's answer to a try is one of three:
//
//   sent      Resend took it.
//   refused   Resend says the message itself cannot go: a 400 or 422 that
//             names who it goes to or what it says (`to`, `bcc`, `subject`,
//             ...), or there is no address to send it to. Sending it again
//             changes nothing, so the sweep stops at once, and the owner is
//             told to send it by hand. It stays REFUSED until Resend has
//             taken that alert, and only then is GAVE_UP: a give-up nobody
//             heard of never happens.
//   unknown   Everything else. No answer, a 5xx, a 429, a 409 (two requests
//             at once under the key), and every refusal about our side of
//             the request: our key or its permissions (a 401 or 403), the
//             sending domain or address, the quota, a request our code
//             built wrong. None says the mail cannot go, and once ours is
//             fixed it does: the sweep sends it again, under the same key,
//             for as long as it takes, and tells the owner once if it has
//             still not gone after 3 days (WARN_AFTER_MS), with what Resend
//             last said.
//
// The codes are those of Resend's errors page
// (resend.com/docs/api-reference/errors, read 10 Oct 2026). A validation
// error names the field it is about in backquotes ("Invalid `to` field."),
// and only a field of the message itself makes it a refusal: "Invalid
// `from` field." is ours, and so is a validation error that names none.
//
// A 409 invalid_idempotent_request says the key went with another body
// within 24 hours. The mail renders again on every try, and its body moves
// (a refund that went through, a balance), so after a try Resend may have
// taken (no answer, a 5xx, another request under the key at the same time,
// a claim cut off mid-send: mayHaveGone) that 409 says the earlier one was
// taken: sent. After a try Resend refused, it says only that Resend kept
// the key from that refusal: nothing went, and the mail goes once the key
// has expired, so it is unknown. Resend's docs (idempotency keys, errors;
// read 10 Oct 2026) say nothing of a key whose request was refused. The
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

/** The most of Resend's message an owner's alert repeats. */
const SAID_MAX = 200

/** Resend's message on one line, cut to SAID_MAX characters. */
function brief(message: string): string {
  const line = message.replace(/\s+/g, ' ').trim()
  return line.length > SAID_MAX ? `${line.slice(0, SAID_MAX)}…` : line
}

/** Resend's answer in words: "Resend answered 422 validation_error:
 *  Invalid `to` field." */
export function resendSaid(result: ResendResult): string {
  if (result.unanswered === true) return 'Resend did not answer'
  if (result.status === undefined) {
    return 'Resend was not asked: no address to send it to'
  }
  const name = result.errorName === undefined ? '' : ` ${result.errorName}`
  const said = brief(result.errorMessage ?? '')
  return `Resend answered ${result.status}${name}${said === '' ? '' : `: ${said}`}`
}

/** A field of the message itself, as a validation error names it: who it
 *  goes to, or what it says. */
const MESSAGE_FIELD =
  /`(?:to|cc|bcc|subject|html|text)`|\b(?:to|cc|bcc|subject|html|text) field\b/i

/** Whether Resend refused the message itself, rather than our side of the
 *  request. */
function aboutTheMessage(result: ResendResult): boolean {
  return (
    (result.status === 400 || result.status === 422) &&
    MESSAGE_FIELD.test(result.errorMessage ?? '')
  )
}

/**
 * Whether the try before this one may have been taken by Resend, from what
 * the row kept of it: a claim cut off mid-send, or a try that ended
 * unknown with no answer, a 5xx or another request under the key at the
 * same time. A try Resend answered with a refusal (a 401, a 403, a 429...)
 * was not taken. A try kept with no answer (from before migration 0066)
 * may have been.
 */
export function mayHaveGone(
  status: string | null,
  why: string | null,
): boolean {
  if (status === 'sending') return true
  if (status !== 'failed') return false
  const said = why ?? ''
  return (
    !/^Resend answered 4\d\d\b/.test(said) ||
    said.startsWith('Resend answered 409 concurrent_idempotent_requests')
  )
}

/**
 * What Resend's answer to a try says of the mail. `earlierMayHaveGone`:
 * the try before this one may have been taken (mayHaveGone), so a 409
 * invalid_idempotent_request means it went.
 */
export function mailAnswer(
  result: ResendResult,
  earlierMayHaveGone: boolean,
): MailAnswer {
  if (result.ok) return SENT
  const why = resendSaid(result)
  if (result.unanswered === true) return { kind: 'unknown', why }
  if (result.status === undefined) return { kind: 'refused', why }
  if (sentUnderKeyAlready(result)) {
    return earlierMayHaveGone ? SENT : { kind: 'unknown', why }
  }
  return aboutTheMessage(result)
    ? { kind: 'refused', why }
    : { kind: 'unknown', why }
}

/** The status a try leaves the mail in. */
export function statusAfter(answer: MailAnswer): string {
  if (answer.kind === 'sent') return 'sent'
  return answer.kind === 'refused' ? REFUSED : 'failed'
}
