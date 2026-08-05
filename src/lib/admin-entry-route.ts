import type { AdminSection } from '@/stores/ui-store'

const ADMIN_PATHS: Readonly<Record<string, AdminSection>> = {
  '/admin': 'exercises',
  '/admin/exercises': 'exercises',
  '/admin/weekly': 'weekly',
  '/admin/achievements': 'achievements',
  '/admin/demo-song': 'demo-song',
  '/admin/premium-perks': 'premium-perks',
}

/** Convert a friendly path entry into the app's canonical hash route. */
export function adminHashForPath(pathname: string): string | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : '/'
  const section = ADMIN_PATHS[normalized.toLowerCase()]
  return section === undefined ? null : `#/admin/${section}`
}

/**
 * Canonicalize admin entry URLs before App mounts. This keeps direct links from
 * briefly opening the consumer surface and returns the pathname to `/`, where
 * every relative browser resource and hash route behaves consistently.
 */
export function normalizeAdminEntryRoute(): boolean {
  const adminHash = adminHashForPath(window.location.pathname)
  if (adminHash === null) return false
  history.replaceState(
    history.state,
    '',
    `/${window.location.search}${adminHash}`,
  )
  return true
}
