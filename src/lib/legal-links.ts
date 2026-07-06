// ============================================================
// Legal document links
// ============================================================
//
// The Terms of Use and Privacy Notice are maintained as the single
// source of truth on the marketing site (packages/mercurypitch in the
// disjoint-colliders repo) and served from the same domain as the app.
// The app never duplicates that text — it links out to it from the
// first-run consent line, the audio-upload box, and Settings > About.
//
// Absolute production URLs are used deliberately: legal copy is canonical
// on the production domain, so the links resolve to the real documents
// regardless of where the app itself is running (localhost, dev, prod).

import { PROD_DOMAIN } from '@/lib/defaults'

const LEGAL_BASE = `https://${PROD_DOMAIN}`

/** Terms of Use (hosted on the landing site). */
export const TERMS_URL = `${LEGAL_BASE}/terms`

/** Privacy Notice (hosted on the landing site). */
export const PRIVACY_URL = `${LEGAL_BASE}/privacy`

/**
 * Deep link to the content / copyright + acceptable-use section of the
 * Terms — used by the audio-upload box, where "only upload audio you have
 * the rights to" is the message that matters most.
 */
export const CONTENT_POLICY_URL = `${LEGAL_BASE}/terms#your-content`
