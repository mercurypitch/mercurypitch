// ── Apple's private relay addresses: the one check, shared ───────────
// Pure and dependency-free — no D1, auth or Env imports — so the frontend can
// import it as well as the Worker, the way it imports billing-core.ts. The
// Worker asks it whether an address may adopt an existing account; the
// account page asks it whether to tell the singer to keep a note of theirs.

/** The relay domain Apple issues when the signer hides their address. */
const APPLE_PRIVATE_RELAY_DOMAIN = '@privaterelay.appleid.com'

/** True for an address on Apple's private relay, in any letter case. */
export function isApplePrivateRelayAddress(
  email: string | null | undefined,
): boolean {
  return email?.toLowerCase().endsWith(APPLE_PRIVATE_RELAY_DOMAIN) ?? false
}
