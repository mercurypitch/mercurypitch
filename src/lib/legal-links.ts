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
