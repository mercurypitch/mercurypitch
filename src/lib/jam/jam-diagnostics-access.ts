// ── Jam diagnostics access ───────────────────────────────────────────
// Who may see the network panel, and how somebody turns it on.
//
// The panel was gated on IS_DIAGNOSTIC_BUILD alone: the local dev server,
// a PR preview, and the dev domain. That is the right default and it made
// the panel unreachable in the one case it exists for. A two-device
// latency test wants a real HTTPS origin both a phone and a desktop can
// load, against the infrastructure people actually use -- and a PR
// preview cannot help, because previews run with the jam signaling mocked
// (VITE_JAM_MOCK_SIGNALING) and peers never connect there at all.
//
// So there is a second door: `?jamdiag=1` on the URL, remembered per
// browser. A query parameter rather than a hash flag because the app's
// routing owns the hash, and a remembered flag rather than a per-load one
// because a test session is full of reloads and re-typing it each time is
// how a run ends up with a hole in the middle.
//
// This is not a security boundary and is not pretending to be one. The
// panel reads stats about your own connection and displays them to you;
// the worst outcome of somebody finding the flag is that they see their
// own ping. It is a default, not a lock.
//
// Tests: src/tests/jam-diagnostics-access.test.ts.

/** The query parameter, and the key it is remembered under. */
export const DIAGNOSTICS_PARAM = 'jamdiag'
export const DIAGNOSTICS_STORAGE_KEY = 'mp_jam_diagnostics_unlocked'

/**
 * What a URL asks for, if anything.
 *
 * Three answers, not two: `true` turns it on, `false` turns it off again,
 * and `null` means the URL said nothing and whatever was remembered
 * stands. Without the middle one there would be no way back out of the
 * panel short of clearing site data.
 */
export function readDiagnosticsParam(search: string): boolean | null {
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search)
  } catch {
    return null
  }
  const raw = params.get(DIAGNOSTICS_PARAM)
  if (raw === null) return null
  const value = raw.trim().toLowerCase()
  if (value === '0' || value === 'false' || value === 'off') return false
  // Bare `?jamdiag` counts as on: that is what somebody typing it means.
  return true
}

/**
 * Resolve the flag once, and persist a change.
 *
 * Deliberately takes its storage rather than reaching for localStorage, so
 * the decision is testable and so a browser with storage blocked -- a
 * private window, a locked-down phone -- degrades to "URL only" instead of
 * throwing on page load.
 */
export function resolveDiagnosticsUnlock(
  search: string,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
): boolean {
  const asked = readDiagnosticsParam(search)

  if (asked !== null) {
    try {
      if (asked) storage?.setItem(DIAGNOSTICS_STORAGE_KEY, '1')
      else storage?.removeItem(DIAGNOSTICS_STORAGE_KEY)
    } catch {
      // Storage full or blocked. The flag still holds for this page load,
      // which is enough to be useful and better than failing the boot.
    }
    return asked
  }

  try {
    return storage?.getItem(DIAGNOSTICS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
