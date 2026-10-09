// ============================================================
// withdrawal-wording — every sentence the 14-day withdrawal shows a buyer
// ============================================================
//
// One file for the lawyer to read: the checkbox on Stripe Checkout and the
// line beside its pay button (checkout-consent.ts), the "Your right to
// cancel" panel in the purchase mail (email-purchase.ts), and the footnote
// under the packs and the labels of the withdrawal function in Settings ›
// Credits (the app imports this file, as it does billing-core.ts). The
// wording is the owner's of 9 Oct 2026, from section 5 of the withdrawal
// research, pending the lawyer (points 2 and 4).
//
// WITHDRAWAL_MODE picks the model. The worker reads it here, and the app
// gets it from GET /api/billing/pricing, so both follow one setting:
//   - refund_unused (model B, the default): a buyer can cancel a pack within
//     14 days and gets back the price of the pack's credits they haven't
//     used (withdrawal-rules.ts).
//   - waiver (model A): at checkout the buyer asks for the credits now and
//     accepts that the right to cancel ends once they are added. There is
//     no withdrawal function.
//
// No imports, so the app's bundle can take it without the worker.

export type WithdrawalMode = 'refund_unused' | 'waiver'

export const DEFAULT_WITHDRAWAL_MODE: WithdrawalMode = 'refund_unused'

/** Days a buyer has to cancel a pack, counted from the day after. */
export const WITHDRAWAL_DAYS = 14

/** The version of this file's wording a checkout showed, kept with the
 *  buyer's consent (checkoutConsents.textVersion). Change it whenever the
 *  checkbox text changes. */
export const WITHDRAWAL_TEXT_VERSION = 'wd-2026-10-v1'

/** The Terms section on cancelling, with the model form. */
export const WITHDRAWAL_TERMS_URL =
  'https://about.mercurypitch.com/terms/#withdrawal'

/**
 * The mode a WITHDRAWAL_MODE value names. Unset or blank is the default;
 * anything unrecognised is the default too, because refunding unused
 * credits is the model that protects the buyer if a typo slips through.
 */
export function parseWithdrawalMode(
  value: string | null | undefined,
): WithdrawalMode {
  const mode = (value ?? '').trim().toLowerCase()
  return mode === 'waiver' ? 'waiver' : DEFAULT_WITHDRAWAL_MODE
}

/** Whether a WITHDRAWAL_MODE value is one this file knows, blank included. */
export function isKnownWithdrawalMode(
  value: string | null | undefined,
): boolean {
  const mode = (value ?? '').trim().toLowerCase()
  return mode === '' || mode === 'refund_unused' || mode === 'waiver'
}

// ── Stripe Checkout ──────────────────────────────────────────────────
// Stripe allows 1,200 characters, bold and links only, in each message.

const HOW_CANCELLING_WORKS = `[How cancelling works](${WITHDRAWAL_TERMS_URL})`

/** The required checkbox (custom_text.terms_of_service_acceptance). */
export const CHECKOUT_CHECKBOX: Readonly<Record<WithdrawalMode, string>> = {
  refund_unused:
    "Add my credits now so I can use them straight away, before the 14-day cancellation period ends. I understand that if I cancel, I only get back the price of credits I haven't used, and that once I've used them all, I can no longer cancel. " +
    HOW_CANCELLING_WORKS,
  waiver:
    "Add my credits now so I can use them straight away. I understand that I lose my right to cancel this purchase once they're added. " +
    HOW_CANCELLING_WORKS,
}

/** The line beside the pay button (custom_text.submit). The VAT sentence
 *  waits for the tax adviser. */
export const CHECKOUT_SUBMIT_LINE = 'Your credits are added as soon as you pay.'

// ── The app ──────────────────────────────────────────────────────────

/** The footnote under the packs: before the link to the Terms. */
export const PACK_FOOTNOTE: Readonly<Record<WithdrawalMode, string>> = {
  refund_unused:
    "Credits are prepaid and spent per server-side separation. You can cancel a credit purchase within 14 days and get back the price of credits you haven't used. Donations are voluntary and not refundable. See our",
  waiver:
    "Credits are prepaid and spent per server-side separation. They're added the moment you pay, and at checkout you confirm that you then lose your 14-day right to cancel. Donations are voluntary and not refundable. See our",
}

/** The withdrawal function's labels (CRD Art. 11a). */
export const WITHDRAW_LINK_LABEL = 'Withdraw from contract here'
export const CONFIRM_WITHDRAWAL_LABEL = 'Confirm withdrawal'

/** What the buyer sees once the statement is in, whatever the refund did. */
export const WITHDRAWAL_RECEIVED = "We've received your cancellation"

// ── The purchase mail ────────────────────────────────────────────────

export const RIGHT_TO_CANCEL_TITLE = 'Your right to cancel'

/** Where the purchase mail sends a buyer to cancel. */
export const CANCEL_PATH_LABEL = 'Settings › Credits'

export interface RightToCancelFacts {
  /** The last day to cancel, written out: "23 October 2026". */
  deadline: string
  /** The paid credits the pack added. */
  credits: number
}

/**
 * The panel's sentences. Under refund_unused the last one names where to
 * cancel; the mail turns CANCEL_PATH_LABEL in it into a link.
 */
export function rightToCancelLines(
  mode: WithdrawalMode,
  facts: RightToCancelFacts,
): string[] {
  if (mode === 'waiver') {
    return [
      "You asked us to add these credits straight away and confirmed that you lose your right to cancel once they're added.",
    ]
  }
  const all =
    facts.credits === 1 ? 'it' : `all ${facts.credits.toLocaleString('en-GB')}`
  return [
    `You asked us to add these credits straight away. You can still cancel this purchase until ${facts.deadline} and get back the price of the credits you haven't used. Credits you've used aren't refunded, and once you've used ${all}, you can no longer cancel.`,
    `To cancel, open ${CANCEL_PATH_LABEL} and choose ${WITHDRAW_LINK_LABEL}, or reply to this email.`,
  ]
}

export interface TraderDetails {
  name: string
  address: string
  email: string
  vatId: string
}

/** Who sold the credits (CRD Art. 6(1)(b) and (c), confirmed in Art. 8(7)). */
export function traderLine(trader: TraderDetails): string {
  return `Sold by ${trader.name}, ${trader.address}. Email ${trader.email}. VAT ID ${trader.vatId}.`
}

/** The pointer to the full terms, with the cancellation form. */
export const TERMS_LINE = 'Our terms, with the cancellation form:'
