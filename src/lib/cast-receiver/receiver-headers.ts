// ============================================================
// Cast receiver headers — the policy the receiver page is served with
// ============================================================
//
// The site's Content-Security-Policy (public/_headers) is written for the
// app, and it would stop a Cast receiver twice. Google's Web Receiver SDK
// is served only from www.gstatic.com, and loads its own modules from
// there by script tag, which the site's script-src does not allow. And the
// SDK opens its message bus to the device at ws://localhost:8008/v2/ipc,
// which the site's connect-src, https: and wss: only, does not allow.
//
// A second policy on the path would not help: a browser enforces every
// policy a page carries, so one can only narrow another. So the site Worker
// serves /cast-receiver itself (src/worker.ts, `run_worker_first` in
// wrangler.jsonc) and puts this policy in place of the site's. It allows
// those two and what the page and Cloudflare's own beacon need, and no
// more: the SDK needs no eval, and with its media players skipped
// (caf-host.ts) it fetches nothing from elsewhere. Its one inline style
// element is why style-src keeps 'unsafe-inline'. X-Robots-Tag keeps the
// page out of search, where it would be a blank stage.
//
// Tests: src/tests/worker-cast-receiver.test.ts.

import { CAST_RECEIVER_SDK_URL } from './cast-config'

/** Where the SDK opens its message bus to the Cast device. */
export const CAST_DEVICE_SOCKET = 'ws://localhost:8008'

const SDK_ORIGIN = new URL(CAST_RECEIVER_SDK_URL).origin

export const CAST_RECEIVER_CSP = [
  "default-src 'self'",
  `script-src 'self' ${SDK_ORIGIN} https://static.cloudflareinsights.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: data: https:",
  `connect-src 'self' https: wss: ${CAST_DEVICE_SOCKET}`,
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

/** The receiver page's response, with its own policy in place of the site's. */
export function withCastReceiverHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('Content-Security-Policy', CAST_RECEIVER_CSP)
  headers.set('X-Robots-Tag', 'noindex')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
