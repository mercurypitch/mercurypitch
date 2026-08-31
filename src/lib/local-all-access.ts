// ============================================================
// Local all-access — developer bypass for client-side supporter gates
// ============================================================
//
// Set `VITE_LOCAL_ALL_ACCESS=1` in `.env.local` (gitignored) and restart the
// dev server to unlock every client-gated supporter surface: Lab, feature
// perks, supporter rooms and backgrounds.
//
// Three conditions, all required, so the flag is inert everywhere that
// matters:
//   1. The env var — never committed, never set in CI or deploy environments.
//   2. `import.meta.env.MODE === 'development'` — only the vite dev server
//      runs in that mode. Deployed dev and prod domains serve built bundles
//      (mode `production`), where the statically-replaced MODE folds the whole
//      check to `false` and dead-code-eliminates it out of the chunks. Vitest
//      runs in mode `test`, so a flag sitting in `.env.local` cannot leak into
//      unit tests and flip gate assertions on this machine.
//   3. A loopback hostname — a dev server exposed over LAN or a tunnel does
//      not inherit the bypass.
//
// This flips CLIENT gates only. Server-held capabilities (perks worker, paid
// separation, Lab server endpoints) still verify on their side and will still
// refuse; that is the intended boundary, same as hasLocalE2ELabAccess.

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]']

/** Pure core, exported for tests. */
export function localAllAccessDecision(
  flag: string | undefined,
  mode: string,
  hostname: string | undefined,
): boolean {
  if (flag !== '1' || mode !== 'development') return false
  return hostname !== undefined && LOOPBACK_HOSTS.includes(hostname)
}

export function localAllAccessGranted(): boolean {
  return localAllAccessDecision(
    import.meta.env.VITE_LOCAL_ALL_ACCESS as string | undefined,
    import.meta.env.MODE,
    typeof window === 'undefined' ? undefined : window.location.hostname,
  )
}
