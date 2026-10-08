// ============================================================
// Sign-up context — what a sign-up tells the worker for its first mail
// ============================================================
//
// A new account's welcome or confirm mail is rendered inside the sign-up
// request, before the app adopts this device's voiceprints. So the sign-up
// carries a hint: the twin it is about to adopt, so the mail can name it, and
// whether it started on Karaoke Night, which picks the mail's picture. The
// worker checks both against its own catalogue and bounds
// (workers/db-worker/src/signup-hint.ts) and stores neither.

/** The newest take a sign-up will adopt, reduced to what the mail shows. */
export interface VoiceprintHint {
  /** A legend's name, exactly as VOICE_LEGENDS spells it. */
  twin: string
  lowMidi: number
  highMidi: number
  accuracy?: number
  steadiness?: number
}

export type SignupSource = 'karaoke'

export interface SignupContext {
  /** Send it only where creating the account adopts the take it describes. */
  voiceprintHint?: VoiceprintHint
  signupSource?: SignupSource
}

/** The optional extras a password registration carries. */
export interface RegisterExtras extends SignupContext {
  /**
   * Ticked the product-updates box on the form. It rides the register request
   * rather than following it, so there is no window where the account exists
   * and the answer does not — and nothing to retry if the second call fails.
   */
  newsletterOptIn?: boolean
}
