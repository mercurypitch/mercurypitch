// ============================================================
// Mirror subdomain — where a mirror.* address belongs on the apex
// ============================================================
//
// mirror.mercurypitch.com sends every visitor to mercurypitch.com/mirror, so
// the Mirror has one origin: the one the account worker accepts, where the
// account ask under the results can work. The site's worker answers the
// paths it sees with a 301 (src/worker.ts). The asset layer serves some
// paths without asking it (/vocal-range-test, say), so the Mirror's entry
// makes the same move in the browser (features/mirror/main.tsx).
//
// Tiny on purpose: it is on the Mirror's first paint and in the worker. Kept
// out of src/lib/mirror/, which vite.config.ts pins into the shared
// pitch-core chunk that other rooms' first paint carries.

/**
 * The apex URL for a mirror.* address, or null for any other host. The root
 * becomes /mirror; every other path, the query (?v= share links, &og=, utm_*,
 * gclid) and the hash stay as they are.
 */
export function apexMirrorUrl(href: string): string | null {
  const url = new URL(href)
  if (!url.hostname.startsWith('mirror.')) return null
  url.hostname = url.hostname.slice('mirror.'.length)
  if (url.pathname === '/') url.pathname = '/mirror'
  return url.toString()
}

/**
 * On a mirror.* address, go to the apex with location.replace (the old
 * address stays out of history) and say so. False anywhere else.
 */
export function leaveMirrorSubdomain(
  location: Pick<Location, 'href' | 'replace'>,
): boolean {
  const apex = apexMirrorUrl(location.href)
  if (apex === null) return false
  location.replace(apex)
  return true
}
