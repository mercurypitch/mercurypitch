// OG card store — handles /api/og/card/:id
//
// A shared voiceprint link has to unfurl as the card the sender actually
// saw. Crawlers do not run JavaScript, so the numbers sitting in the query
// string are invisible to them and the image has to already exist as a
// URL by the time WhatsApp or Discord fetches the page.
//
// The app draws that card anyway. This stores it, keyed by an id the client
// chooses before it opens the share sheet — so no round trip stands between
// the tap and the sheet, which is what Safari requires, and so nothing is
// uploaded by anyone who does not share.
//
// A JPEG, not the PNG that goes into the share sheet. Measured over all 31
// twins, the square card is 1.8 to 2.3 MB as a PNG and at most 270 KB as a
// JPEG: a painted portrait is the worst case for lossless. At PNG sizes the
// upload is still running when the first crawler arrives, a month of shares
// is half a gigabyte, and WhatsApp skips a preview image that large.
//
// Thirty days: long enough that a link is still pretty while people are
// actually passing it around, short enough that storage does not grow
// without bound. After that the link still opens — the voiceprint is in the
// URL, not in here — it simply unfurls with the stock card.

import { OG_CARD_SIZE } from './lib/mirror/shared-voiceprint'
import type { Env } from './worker'

const THIRTY_DAYS = 30 * 24 * 60 * 60
/** Four times the largest card measured. */
const MAX_IMAGE_BYTES = 1024 * 1024
const UPLOAD_RATE_MAX = 10
const UPLOAD_RATE_WINDOW_S = 60

/** Base62, 10 characters — the same shape and entropy as a share id. */
const ID_PATTERN = /^[0-9A-Za-z]{10}$/

/** KV keys are namespaced so an image can never answer a share lookup. */
function cardKey(id: string): string {
  return `og:${id}`
}

/**
 * Whether a card is in the store right now.
 *
 * KV has no "exists", so this opens the value and lets go of it unread: the
 * card is a few hundred kilobytes and all that is wanted is a yes or a no.
 */
export async function ogCardExists(env: Env, id: string): Promise<boolean> {
  if (!ID_PATTERN.test(id)) return false
  const value = await env.SHARE_STORE.get(cardKey(id), 'stream')
  if (value === null) return false
  await value.cancel()
  return true
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

  // GET /api/og/card/:id.jpg — what the crawler fetches.
  const get = url.pathname.match(/^\/api\/og\/card\/([0-9A-Za-z]{10})\.jpg$/)
  if (get && request.method === 'GET') {
    const body = await env.SHARE_STORE.get(cardKey(get[1]), 'arrayBuffer')
    if (body === null) return new Response('Not found', { status: 404 })
    return new Response(body, {
      headers: {
        'Content-Type': 'image/jpeg',
        // The id names this exact image and is never reused, so a crawler
        // or CDN may hold it for as long as it likes.
        'Cache-Control': 'public, max-age=31536000, immutable',
        // These bytes came from a stranger and go out under our own domain.
        // They are an image and must only ever be read as one, whatever a
        // browser opening the address directly thinks it has found in them.
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
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
    const size = jpegSize(body)
    if (size === null) {
      // Only ever a JPEG: this store is served back with an image content
      // type, so anything else would be us hosting arbitrary bytes.
      return new Response('Not a JPEG', { status: 415 })
    }
    if (size.width !== OG_CARD_SIZE || size.height !== OG_CARD_SIZE) {
      // The tags tell a crawler the picture is a square of this size, so
      // that is the only picture taken. It also keeps this from being a
      // place to park any image at all behind our name.
      return new Response('Not a card', { status: 415 })
    }

    // The client picks its own id, so refuse to overwrite one that exists.
    // Collision is vanishingly unlikely; deliberate reuse is not.
    if (await ogCardExists(env, id)) {
      return new Response('Already exists', { status: 409 })
    }

    await env.SHARE_STORE.put(cardKey(id), body, {
      expirationTtl: THIRTY_DAYS,
    })
    return new Response(null, { status: 204 })
  }

  return null
}

/**
 * The width and height a JPEG declares, or null when the bytes are not one.
 *
 * A JPEG is a run of segments, each opening 0xFF, a marker byte, and (for
 * most) a two-byte length. The size sits in the frame header — the first SOF
 * marker, 0xC0-0xCF bar the three in that range that are not frames — as
 * height then width, two bytes each, after one byte of precision.
 */
function jpegSize(body: ArrayBuffer): { width: number; height: number } | null {
  const view = new DataView(body)
  if (body.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null

  let at = 2
  while (at + 9 <= body.byteLength) {
    if (view.getUint8(at) !== 0xff) return null
    const marker = view.getUint8(at + 1)
    if (marker === 0xff) {
      at += 1 // a fill byte before the real marker
      continue
    }
    const standsAlone = (marker >= 0xd0 && marker <= 0xd9) || marker === 0x01
    if (standsAlone) {
      at += 2
      continue
    }
    const length = view.getUint16(at + 2)
    if (length < 2) return null
    const isFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    if (isFrame) {
      return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) }
    }
    at += 2 + length
  }
  return null
}
