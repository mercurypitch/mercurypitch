// ============================================================
// Opening takeover — which one thing takes the screen when the app opens
// ============================================================
//
// Four things used to arrive together on a returning visitor's open: What's
// New, the tour offer, the cookie bar and, now, the plan. A visit gets one
// takeover, and this decides which: the first of these that applies.
//
//   1. The native build: it has none of them.
//   2. A visit that came for somewhere in particular (a link, a lesson's
//      practice link, a return from checkout): it asked for that place.
//   3. First Light, for someone it was never offered to.
//   4. The plan, for an existing user whose record says it was never put in
//      front of them. It is their one takeover, so What's New waits for the
//      next visit rather than arriving beside it.
//   5. What's New, once the plan is settled.
//
// Pure on purpose, like the rest of the plan's rules: it imports nothing
// (pure-modules.test.ts keeps it so), so the table can be read and tested
// without the app around it. What it is told and what it does about the answer
// are useOpeningTakeover's, and so is the wait for the account's settings
// (settings-pull-wait.ts), which the sync shares.

/** The one thing that takes the screen on this visit, or null when none does. */
export type OpeningTakeover = 'first-light' | 'plan' | 'whats-new' | null

/** What the picker is told about this visit. */
export interface TakeoverState {
  /** The native build, which has no takeover. */
  native: boolean
  /** The visit came for somewhere in particular (routeSuppressesAnnouncement), so nothing takes it over. */
  routeSuppressed: boolean
  /** First Light's welcome has not been offered to this visitor yet. */
  welcomeDue: boolean
  /** The plan was never put in front of this person, and nothing says an answer is on its way from another device. */
  planDue: boolean
  /** A release line this device has not been told about is waiting. */
  whatsNewDue: boolean
}

/**
 * Which takeover this visit gets. First Light needs nothing from the caller
 * (its own hook opens it whenever the welcome is due); the answer is for the
 * other two, and for knowing that neither may open.
 */
export function pickOpeningTakeover(s: TakeoverState): OpeningTakeover {
  if (s.native) return null
  if (s.routeSuppressed) return null
  if (s.welcomeDue) return 'first-light'
  if (s.planDue) return 'plan'
  if (s.whatsNewDue) return 'whats-new'
  return null
}
