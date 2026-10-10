// ============================================================
// Legal document links
// ============================================================
//
// The Terms of Use and Privacy Notice are maintained as the single
// source of truth on the marketing / landing site (packages/mercurypitch
// in the disjoint-colliders repo). The app never duplicates that text —
// it links out to it from the first-run consent line, the audio-upload
// box, and Settings > About.
//
// The landing site is hosted on the `about.` subdomain
// (about.mercurypitch.com) and serves /terms and /privacy. Absolute URLs
// are used deliberately so the links resolve to the real documents
// regardless of where the app itself is running (localhost, dev, prod).

const LANDING_ORIGIN = 'https://about.mercurypitch.com'

/** The public marketing / landing site (linked from Settings > About and the header). */
export const WEBSITE_URL = LANDING_ORIGIN

/** Terms of Use (hosted on the landing site). */
export const TERMS_URL = `${LANDING_ORIGIN}/terms`

/** Privacy Notice (hosted on the landing site). */
export const PRIVACY_URL = `${LANDING_ORIGIN}/privacy`

/**
 * Deep link to the content / copyright + acceptable-use section of the
 * Terms — used by the audio-upload box, where "only upload audio you have
 * the rights to" is the message that matters most.
 */
export const CONTENT_POLICY_URL = `${LANDING_ORIGIN}/terms#your-content`

// The footnote under the credit packs links the Terms' withdrawal section,
// WITHDRAWAL_TERMS_URL in workers/db-worker/src/withdrawal-wording.ts, which
// the Stripe checkbox and the purchase mail link too.

/**
 * How to delete an account, and what deleting keeps (delete-account.html).
 * On the app's own origin, not the landing site, because it describes what
 * this app's Worker erases; absolute for the same reason as the links above.
 * Google Play's Data safety form links it as the deletion URL.
 */
export const DELETE_ACCOUNT_URL = 'https://mercurypitch.com/delete-account'

/**
 * Imprint: who runs Mercury Pitch and how to reach them (E-Commerce Directive
 * Art. 5). One page on the landing site, linked from every legal row.
 */
export const IMPRINT_URL = `${LANDING_ORIGIN}/imprint/`

/**
 * The legal documents every legal row links, in the order it shows them. The
 * in-app row (LegalLinks) and the entry documents' raw-HTML nav both read
 * this, so a new document is added here once.
 */
export const LEGAL_DOCUMENT_LINKS: readonly { href: string; label: string }[] =
  [
    { href: PRIVACY_URL, label: 'Privacy' },
    { href: TERMS_URL, label: 'Terms' },
    { href: IMPRINT_URL, label: 'Imprint' },
  ]
