// ============================================================
// The upload-denial tripwire's rule, and its self-test
// ============================================================
//
// Used by probe-bundle.mjs against every chunk of the native bundle, and
// tested by upload-denial.test.mjs. A plain module so both can import it.

/**
 * Saying an upload does not happen is the one thing the UI may never do.
 *
 * The owner's rule, twice now (device round 2, R6): never name the thing that
 * does not happen — "Nothing is uploaded" puts the idea of an upload in front
 * of somebody who was not thinking about one. What is banned is the
 * REASSURANCE BY DENIAL, not the word: a feature that really does upload a
 * file the singer chose is allowed to say so, and several do.
 *
 * NO ALLOWLIST. Every `.js` in the bundle is read, including the app chunk
 * everything the singer can reach is compiled into. The first version of this
 * check named four dead sentences instead, which is how R6 shipped with
 * "Nothing is uploaded." still in the onboarding sky beat and the karaoke
 * rail: a tripwire scoped to the directory the author was editing.
 *
 * "is not uploaded", "do not upload" and a bare "No uploads." are in the
 * alternation as well (review N5): none of them is in the repository today,
 * and inside the allowlisted app chunk the word rule below would not see
 * them either.
 */
export const UPLOAD_DENIAL =
  /\b(?:nothing|no audio|no recording|none of it)\b[^<>{};]{0,40}?\bupload(?:ed|s|ing)?\b|\bnever\s+upload(?:ed|s)?\b|\bnot\s+upload|\bno\s+uploads?\b/giu

/** Every sentence the rule exists for. Each must be caught. */
export const DENIAL_POSITIVES = [
  // Review N5's four, added to the alternation in 76293bf8.
  'Your take is not uploaded.',
  'We do not upload your voice.',
  'No uploads.',
  'Your voice stays here: no upload happens.',
  // The originals the owner struck (device round 2, R6).
  'Nothing is uploaded.',
  'No audio is ever uploaded.',
  'Your recordings are never uploaded.',
]

/** Real upload copy a feature may use: none of it may be caught. */
export const DENIAL_NEGATIVES = [
  'Audio uploads to our cloud GPU for processing.',
  'Capture first. Upload only after review.',
  'Drop files, or click the upload box',
  'No songs yet — upload one to get started.',
  'Add the example transcript before uploading audio.',
  'Discard selected upload files?',
  'Keep stores it on this phone.',
  'Only you can hear you.',
  'elecUpload',
]

/** Which positives slipped through and which negatives were caught. */
export function uploadDenialMisses() {
  const hits = (text) => {
    UPLOAD_DENIAL.lastIndex = 0
    return UPLOAD_DENIAL.test(text)
  }
  return {
    missed: DENIAL_POSITIVES.filter((text) => !hits(text)),
    caught: DENIAL_NEGATIVES.filter((text) => hits(text)),
  }
}

/** Throws when the rule drifted; otherwise the step line. */
export function selfTestUploadDenial() {
  const { missed, caught } = uploadDenialMisses()
  if (missed.length > 0 || caught.length > 0) {
    throw new Error(
      `the upload-denial rule drifted: missed ${JSON.stringify(missed)}, caught ${JSON.stringify(caught)}`,
    )
  }
  return `tripwire self-test: ${DENIAL_POSITIVES.length} denials caught, ${DENIAL_NEGATIVES.length} real upload lines passed`
}
