// ============================================================
// A Google sign-in coming back to a standalone room
// ============================================================
//
// Google sign-in is a full-page redirect, and the worker sends it back to the
// page that started it with the session in the fragment (#gauth=…). Guitar
// Night and Drum Night are documents of their own, so a sign-in started from
// their dialog lands on THEIR page and never on the main app's, whose auth
// effect is where a new account adopts this device's takes
// (adoptAfterGoogleSignup, REQ-VPR-014). Until 2026-10-08 a Google sign-up in
// either room left the takes behind, and Drum Night did not even store the
// session the return carried.
//
// These are that step for a room, shaped for a room's first paint: neither
// module below is imported up front, and each loads only when a return needs
// it. Karaoke Night is deliberately not a caller: its standalone account UI
// adopts nothing (spec REQ-VPR-022).

/** A Google return's fragment: a session (`#gauth…`) or a Drive grant (`#gdrive…`). */
const GOOGLE_RETURN = /^#g(?:auth|drive)/

/**
 * When the Google return a room just consumed CREATED the account, this
 * device's unclaimed takes join it: one button both registers and signs in,
 * and making the account is the consent, exactly as in the main app. A
 * returning sign-in adopts nothing and never loads the voiceprint layer.
 *
 * Call it after `consumeGoogleRedirect`. It reads the same one-shot flag as
 * `adoptAfterGoogleSignup` but adopts directly, because asking that function
 * would load the voiceprint layer on every visit only to hear "no".
 *
 * Never rejects: a floating promise at boot must not become an unhandled
 * rejection. A failure loses nothing: the takes stay on this device, and the
 * main app's sync or its Settings notice picks them up on the next visit.
 */
export async function adoptAfterRoomGoogleSignup(): Promise<number> {
  try {
    const auth = await import('@/db/services/auth-service')
    if (!auth.takeGoogleAccountCreated()) return 0
    const voiceprints = await import('@/db/services/voiceprint-service')
    return await voiceprints.adoptDeviceVoiceprints()
  } catch {
    return 0
  }
}

/**
 * Store the session a Google return carried, for a room that keeps the auth
 * layer out of its first paint (Drum Night), then adopt as above.
 *
 * Resolves once the session is stored, so the entry renders after it, the
 * way Guitar Night's synchronous consume does: nothing on the page reads auth
 * before the token is in place, and the fragment holding the token never
 * rides into a history entry the room writes. The adoption runs on without
 * holding the render up. An ordinary visit resolves at once and loads
 * nothing, and an auth chunk that fails to load leaves the room signed out,
 * never blank.
 */
export async function landRoomGoogleReturn(): Promise<void> {
  if (!GOOGLE_RETURN.test(window.location.hash)) return
  try {
    const auth = await import('@/db/services/auth-service')
    auth.consumeGoogleRedirect()
  } catch {
    return
  }
  void adoptAfterRoomGoogleSignup()
}
