// ── ICE recovery policy ──────────────────────────────────────────────
// Whether a broken peer connection should be restarted, and by whom.
//
// Kept separate from service.ts because it is the part with judgement in
// it: the RTCPeerConnection plumbing around it is untestable without a
// browser, and this is the bit that decides whether a jam recovers or
// silently stays dead.

/** How long 'disconnected' is given to heal before spending a restart. */
export const DISCONNECTED_GRACE_MS = 4000
/** Bounded, so a genuinely unreachable peer stops costing renegotiations. */
export const MAX_ICE_RETRIES = 4

export type IceDecision =
  | { restart: true }
  | { restart: false; why: 'polite' | 'exhausted' | 'unknown-self' }

/**
 * Only the IMPOLITE peer restarts.
 *
 * Perfect negotiation survives both sides restarting at once, but it costs
 * a rollback and an extra round trip every time, and on a mesh that
 * multiplies by the number of pairs. The polite side waits for the offer
 * instead. Impolite is the lexicographically LARGER id, which is the same
 * split the glare handling in service.ts already uses -- one rule, not two.
 *
 * Before a peer id is known nobody restarts: guessing the role would make
 * both sides impolite, which is the case the split exists to avoid.
 */
export function decideIceRestart(
  myPeerId: string | null,
  peerId: string,
  attemptsSoFar: number,
): IceDecision {
  if (myPeerId === null || myPeerId === '') {
    return { restart: false, why: 'unknown-self' }
  }
  if (myPeerId <= peerId) return { restart: false, why: 'polite' }
  if (attemptsSoFar >= MAX_ICE_RETRIES) {
    return { restart: false, why: 'exhausted' }
  }
  return { restart: true }
}
