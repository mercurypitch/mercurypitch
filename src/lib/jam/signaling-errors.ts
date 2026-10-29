// ── Signaling errors ─────────────────────────────────────────────────
// What to tell somebody whose room connection would not open.
//
// A WebSocket error carries no detail by design, so the message can only
// go on where the socket was pointed. Two causes bite in practice, and
// they need opposite advice:
//
// - A LAN dev server (an IP address, a .local name). The page's
//   self-signed certificate is accepted for the document but not always
//   for the socket, and the handshake is refused before it reaches the
//   server. The fix is to open the host directly and accept it.
// - A public host such as mercurypitch.com. The certificate is real, so
//   the likely cause is the network: work and school proxies often refuse
//   WebSocket upgrades. Certificate advice here sends people after a
//   problem they do not have.
//
// Tests: src/tests/jam-signaling-errors.test.ts.

/** True for a host only reachable on a local network. */
export function isLanHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host.endsWith('.local') || host.endsWith('.lan')) return true
  if (host.endsWith('.home.arpa')) return true
  // A single label ("devbox") resolves only on the local network.
  if (!host.includes('.') && !host.includes(':')) return true

  const v4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host)
  if (v4) {
    const a = Number(v4[1])
    const b = Number(v4[2])
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    )
  }
  // IPv6 loopback, unique-local (fc00::/7) and link-local (fe80::/10).
  if (host.includes(':')) {
    return host === '::1' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host)
  }
  return false
}

/** The message for a room socket that failed to open. */
export function socketFailureMessage(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'Could not reach the room server. Check your connection and try again.'
  }
  if (isLanHost(parsed.hostname)) {
    // Plain ws:// on a local host is a dev box with no jam worker behind it.
    return parsed.protocol === 'wss:'
      ? `Could not open the room connection to ${parsed.host}. On a local network this is usually the certificate: open https://${parsed.host} directly and accept it, then try again.`
      : `Could not reach the room server at ${parsed.host}. Is the jam worker running (pnpm dev:jam)?`
  }
  return 'Could not reach the room server. Work and school networks often block this kind of connection, so try another network, such as a phone hotspot.'
}
