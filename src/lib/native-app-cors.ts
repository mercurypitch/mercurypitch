// ============================================================
// Separation for the native app: the one cross-origin caller
// ============================================================
//
// The web app calls `/api/uvr/*` on its own origin, so the worker never sent
// a CORS header and a browser page elsewhere could read nothing. The native
// app (plan S8, Stage 2) is a page on capacitor://localhost (iOS) or
// https://localhost (Android), so every call it makes is cross-origin, and
// the preflight before a separation is an OPTIONS the routes below never
// answered. These are the same two origins the db-worker already admits.
//
// Only those two get a header, and only a bare one: no credentials, since
// the app sends its token in `Authorization` and no cookie is involved. A
// request from anywhere else, and the web app's own, come back exactly as
// they did.

/** The origins a Capacitor WebView reports: iOS, then Android. */
export const NATIVE_APP_ORIGINS: readonly string[] = [
  'capacitor://localhost',
  'https://localhost',
]

/** What the app sends with a separation (uvr-api.ts), for the preflight. */
const ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'X-UVR-Provider',
  'X-UVR-Duration-Seconds',
  'X-UVR-Model',
].join(', ')

const ALLOWED_METHODS = 'GET, POST, DELETE, OPTIONS'

/** The request's origin when it is the native app's, else null. */
export function nativeAppOrigin(request: Request): string | null {
  const origin = request.headers.get('Origin')
  return origin !== null && NATIVE_APP_ORIGINS.includes(origin) ? origin : null
}

/** The answer to the native app's preflight, before any backend is asked. */
export function nativePreflight(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': ALLOWED_METHODS,
      'Access-Control-Allow-Headers': ALLOWED_HEADERS,
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    },
  })
}

/** The same answer, readable by the native app. A copy, because a fetched
 *  or redirect response's headers cannot be changed in place. */
export function withNativeCors(response: Response, origin: string): Response {
  const readable = new Response(response.body, response)
  readable.headers.set('Access-Control-Allow-Origin', origin)
  readable.headers.set('Vary', 'Origin')
  return readable
}
