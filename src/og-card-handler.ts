// OG card store — handles /api/og/card/:id
//
// A shared voiceprint link has to unfurl as the card the sender actually
// saw. Crawlers do not run JavaScript, so the numbers sitting in the query
// string are invisible to them and the image has to already exist as a
// URL by the time WhatsApp or Discord fetches the page.
//
// The app draws that PNG anyway. This stores it, keyed by an id the client
// chooses before it opens the share sheet — so no round trip stands between
// the tap and the sheet, which is what Safari requires, and so nothing is
// uploaded by anyone who does not share.
//
// Thirty days: long enough that a link is still pretty while people are
// actually passing it around, short enough that storage does not grow
// without bound. After that the link still opens — the voiceprint is in the
// URL, not in here — it simply unfurls with the stock card.

import type { Env } from './worker'

const THIRTY_DAYS = 30 * 24 * 60 * 60
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const UPLOAD_RATE_MAX = 10
const UPLOAD_RATE_WINDOW_S = 60

/** Base62, 10 characters — the same shape and entropy as a share id. */
const ID_PATTERN = /^[0-9A-Za-z]{10}$/

/** KV keys are namespaced so an image can never answer a share lookup. */
function cardKey(id: string): string {
  return `og:${id}`
}

async function withinUploadRate(env: Env, ip: string): Promise<boolean> {
  const key = `rl:og:${ip}`
  const current = Number((await env.SHARE_STORE.get(key)) ?? '0')
  if (current >= UPLOAD_RATE_MAX) return false
  await env.SHARE_STORE.put(key, String(current + 1), {
    expirationTtl: UPLOAD_RATE_WINDOW_S,
  })
  return true
}

/**
 * Handle `/api/og/card/*`. Returns null when the path is not ours, so the
 * worker can carry on down its chain.
 */
export async function handleOgCardRequest(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url)

  // GET /api/og/card/:id.png — what the crawler fetches.
  const get = url.pathname.match(/^\/api\/og\/card\/([0-9A-Za-z]{10})\.png$/)
  if (get && request.method === 'GET') {
    const body = await env.SHARE_STORE.get(cardKey(get[1]), 'arrayBuffer')
    if (body === null) return new Response('Not found', { status: 404 })
    return new Response(body, {
      headers: {
        'Content-Type': 'image/png',
        // The id names this exact image and is never reused, so a crawler
        // or CDN may hold it for as long as it likes.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }

  // PUT /api/og/card/:id — the app storing the card it just drew.
  const put = url.pathname.match(/^\/api\/og\/card\/([0-9A-Za-z]{10})$/)
  if (put && request.method === 'PUT') {
    const id = put[1]
    if (!ID_PATTERN.test(id)) {
      return new Response('Bad id', { status: 400 })
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    if (!(await withinUploadRate(env, ip))) {
      return new Response('Too many requests', { status: 429 })
    }

    const declared = Number(request.headers.get('Content-Length') ?? '0')
    if (declared > MAX_IMAGE_BYTES) {
      return new Response('Too large', { status: 413 })
    }

    const body = await request.arrayBuffer()
    if (body.byteLength === 0) return new Response('Empty', { status: 400 })
    if (body.byteLength > MAX_IMAGE_BYTES) {
      return new Response('Too large', { status: 413 })
    }
    if (!isPng(body)) {
      // Only ever a PNG: this store is served back with an image content
      // type, so anything else would be us hosting arbitrary bytes.
      return new Response('Not a PNG', { status: 415 })
    }

    // The client picks its own id, so refuse to overwrite one that exists.
    // Collision is vanishingly unlikely; deliberate reuse is not.
    if ((await env.SHARE_STORE.get(cardKey(id), 'stream')) !== null) {
      return new Response('Already exists', { status: 409 })
    }

    await env.SHARE_STORE.put(cardKey(id), body, {
      expirationTtl: THIRTY_DAYS,
    })
    return new Response(null, { status: 204 })
  }

  return null
}

/** PNG magic number. */
function isPng(body: ArrayBuffer): boolean {
  if (body.byteLength < 8) return false
  const head = new Uint8Array(body, 0, 8)
  return (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  )
}
