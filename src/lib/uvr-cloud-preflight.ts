// ── Cloud split preflight ────────────────────────────────────────────
// Whether a cloud GPU job can run at all — asked before one is started.
//
// The worker already refuses an anonymous request with a 401 and an
// unaffordable one with a 402, and both refusals carry a good message.
// The trouble is when they arrive: after a button has promised to do
// something. Guitar Night's "Separate guitar" showed the worst version of
// that — it started a split with nothing behind it and sat on "Sending
// the instrumental" for ever, because `fetch` cannot report upload
// progress and there was no prerequisite anyone had checked.
//
// So the decision lives here, not in a component. Two surfaces need the
// same answer today (UvrPanel's own gate, Guitar Night's band pass), the
// question is not about rendering, and the answer decides whether a
// button is even offered — which is the part a toast arriving later
// cannot fix.
//
// Pure on purpose, and with no imports at all: callers pass the facts they
// already hold, so this is testable without a network, a database or a
// store — and it cannot drag `uvr-api`'s fetch paths into a chunk that
// only wanted to ask a question.

/** Which part of Settings answers this blocker. */
export type CloudSplitCtaSection = 'account' | 'credits'

export interface CloudSplitBlocker {
  reason: 'signed-out' | 'insufficient-credits' | 'no-instrumental'
  /** Said to the singer as-is. */
  message: string
  /** Where to send them, or null when there is nothing to go and do. */
  cta: { label: string; section: CloudSplitCtaSection } | null
}

export interface CloudSplitFacts {
  /** A real account token. Anonymous identities are refused by the worker. */
  signedIn: boolean
  /** Credit balance, or undefined when billing could not be reached. */
  balance?: number
  /** Credits this job costs, or undefined when pricing is unknown. */
  cost?: number
  /**
   * Whether the instrumental stem this job splits is actually stored.
   *
   * Pass `true` when unknown — an absent stem is checked again inside
   * `runStemSplit`, and refusing on a fact we do not have would block a
   * job that would have worked.
   */
  hasInstrumental?: boolean
}

/**
 * Why a cloud split cannot run, or null when it can.
 *
 * Balance and cost are deliberately only decisive when BOTH are known. A
 * missing price or an unreachable billing endpoint must not become a
 * refusal: the server is the authority on affordability, and a client
 * that guesses "no" from missing data blocks work the account could pay
 * for. Under-declaring is safe here — the 402 is still there behind us.
 */
export function cloudSplitBlocker(
  facts: CloudSplitFacts,
): CloudSplitBlocker | null {
  if (!facts.signedIn) {
    return {
      reason: 'signed-out',
      message:
        'Separating the band runs on a cloud GPU, which needs an account. Sign in and your credits come with you.',
      cta: { label: 'Sign in', section: 'account' },
    }
  }
  if (facts.hasInstrumental === false) {
    return {
      reason: 'no-instrumental',
      message:
        'This song has no stored instrumental to separate. Prepare it again from the original file, then try the band split.',
      cta: null,
    }
  }
  const { balance, cost } = facts
  if (balance !== undefined && Number.isFinite(balance)) {
    // With no price to hand, one credit is the floor: a paid job cannot run
    // on an empty balance, and that is the case worth catching before the
    // button promises anything. A partly-funded account whose exact price
    // we do not know is left to the server's 402, which quotes the real
    // number — better than guessing one here.
    const known = cost !== undefined && Number.isFinite(cost) && cost > 0
    const need = known ? cost : 1
    if (balance < need) {
      return {
        reason: 'insufficient-credits',
        message: known
          ? `Separating the band needs ${cost} credit${cost === 1 ? '' : 's'} and you have ${balance}. Add credits and the split is one tap away.`
          : 'Separating the band runs on a cloud GPU and uses credits. Your balance is empty — add credits and the split is one tap away.',
        cta: { label: 'Get credits', section: 'credits' },
      }
    }
  }
  return null
}

/**
 * A heading for a blocker, naming the situation rather than a failure.
 *
 * "Couldn't build the full band" is wrong here: nothing was attempted and
 * nothing broke. Each of these is a sentence a singer can act on.
 */
export function cloudSplitBlockerHeading(blocker: CloudSplitBlocker): string {
  switch (blocker.reason) {
    case 'signed-out':
      return 'Separating the band needs an account'
    case 'insufficient-credits':
      return 'Separating the band needs credits'
    default:
      return 'There is no instrumental to separate'
  }
}

/**
 * Credit cost of a split, from server pricing.
 *
 * The same lookup UvrPanel's `splitCost` does, so the two surfaces cannot
 * disagree about what this operation costs. The model id is passed in
 * rather than imported — it is the thing that decides the price, and
 * `UVR_DEFAULT_MULTI_STEM_MODEL` lives in the API module this one
 * deliberately does not depend on.
 */
export function splitCostFor(
  uvrModelCredits: Record<string, number> | undefined,
  model: string,
): number | undefined {
  const cost = uvrModelCredits?.[model]
  return cost !== undefined && cost > 0 ? cost : undefined
}
