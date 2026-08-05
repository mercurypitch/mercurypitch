// =====================================================================
// admin-headers.mjs — credentials for the db-worker's admin API
// =====================================================================
//
// Two credentials, and which one a request needs depends on where it is
// going:
//
//   X-Admin-Key                       the shared key. The only gate on a
//                                     local worker or a PR preview.
//   CF-Access-Client-Id / -Secret     a Cloudflare Access service token.
//                                     Required wherever Access sits in
//                                     front of the API (dev, prod), and
//                                     Access exchanges it at the edge for
//                                     the JWT the Worker verifies.
//
// Both are sent when both are available, so one script works against
// every environment without a flag. See workers/db-worker/src/access.ts
// for what the Worker does with them.

/**
 * @param {string} adminKey  the shared X-Admin-Key, or '' to omit it
 * @returns {Record<string, string>} headers to spread onto a fetch init
 */
export function adminHeaders(adminKey) {
  /** @type {Record<string, string>} */
  const headers = { 'Content-Type': 'application/json' }
  if (adminKey !== '') headers['X-Admin-Key'] = adminKey

  const clientId = process.env.CF_ACCESS_CLIENT_ID ?? ''
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET ?? ''
  if (clientId !== '' && clientSecret !== '') {
    headers['CF-Access-Client-Id'] = clientId
    headers['CF-Access-Client-Secret'] = clientSecret
  }
  return headers
}

/** True when an Access service token is present in the environment. */
export function hasAccessServiceToken() {
  return (
    (process.env.CF_ACCESS_CLIENT_ID ?? '') !== '' &&
    (process.env.CF_ACCESS_CLIENT_SECRET ?? '') !== ''
  )
}

/**
 * A 403 against an Access-protected host almost always means a missing
 * service token rather than a wrong admin key — say so, because the
 * worker's own message ("Admin key required") points the wrong way.
 */
export function accessHint(apiBase) {
  if (hasAccessServiceToken()) return ''
  if (/localhost|127\.0\.0\.1/.test(apiBase)) return ''
  return (
    '\nNo Access service token in the environment. If this host is behind ' +
    'Cloudflare Access, set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET ' +
    '— the admin key alone will not get through.'
  )
}
