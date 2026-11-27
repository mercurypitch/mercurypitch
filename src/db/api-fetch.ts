// ============================================================
// API fetch — a deadline on every call to the Mercury Pitch API
// ============================================================
//
// fetch() never gives up on its own. On a network whose proxy holds requests
// to the API host and refuses them about a minute later (a 403 without CORS
// headers, which the browser reports as a network error), each call waited
// out that minute. Startup waited for one before any data on the device
// could be read, and a cloud read retried the TypeError it finally got twice
// more: three minutes for one read, six requests to the host at a time
// (measured 27 Nov 2026).
//
// So a call made through here ends by its deadline (deadlineFor): 8 s for a
// read, 20 s for a write, longer for a body that needs it. The timer is an
// AbortController and a setTimeout, not AbortSignal.timeout() or
// AbortSignal.any(): this code also runs in the native app's WebView, and an
// older Android WebView has neither.
//
// The first call on a page that fails by its deadline or by a network error
// tells the singer, once, that the servers are out of reach: a toast, which
// nothing waits on. A server that answers, even with an error, was reached,
// and a request its own caller cancelled says nothing about the network.

import { showNotification } from '@/stores/notifications-store'

/** A read: whose session this is, a table's rows, a count. */
export const API_READ_DEADLINE_MS = 8_000

/** A write with an ordinary body: a sign-in, a practice run, a setting. */
export const API_WRITE_DEADLINE_MS = 20_000

/**
 * The slowest uplink a write's body is given time for: 64 kbit/s, which is 8
 * bytes a millisecond. The db-worker refuses a CRUD body over 256 KiB
 * (MAX_WRITE_BYTES in workers/db-worker/src/index.ts), so the largest body it
 * takes gets 32.8 s, and anything up to 160 KB keeps the 20 s floor. An
 * upload of audio, should one ever come through here, gets minutes, not
 * seconds: a megabyte is given 131 s.
 */
const SLOW_UPLINK_BYTES_PER_MS = 8

export const API_UNREACHABLE_CHANNEL = 'api-unreachable'

/**
 * What the singer is told. While the API is out of reach, what stays on the
 * device saves (exercise history, takes, songs, recordings), but a practice
 * run's record, practice minutes and the streak are the account's and are not
 * written anywhere: saveSessionRecord credits them only once the server has
 * the run. Hence the second sentence.
 *
 * Three lines at most. The desktop toast is 340px wide in the top-right
 * corner, and a fourth line reached down over Home's Lessons and What's new
 * buttons at 1024 to 1536px (measured 28 Nov 2026): for the nine seconds it
 * showed, on every page load, a click on Lessons hit the toast.
 */
export const API_UNREACHABLE_MESSAGE =
  "Can't reach Mercury Pitch's servers from this network. Recordings still save on this device, but your streak won't update."

/** A request that did not finish by its deadline. Never retried. */
export class ApiDeadlineError extends Error {
  constructor(
    readonly url: string,
    readonly deadlineMs: number,
  ) {
    super(`No answer from ${url} within ${deadlineMs} ms`)
    this.name = 'ApiDeadlineError'
  }
}

/** The bytes a body sends, as far as they can be counted before sending. */
function bodyBytes(body: BodyInit | null | undefined): number {
  if (body == null) return 0
  if (typeof body === 'string') return new TextEncoder().encode(body).length
  if (body instanceof Blob) return body.size
  if (body instanceof ArrayBuffer) return body.byteLength
  if (ArrayBuffer.isView(body)) return body.byteLength
  if (body instanceof URLSearchParams) return body.toString().length
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    let total = 0
    body.forEach((value) => {
      total += typeof value === 'string' ? value.length : value.size
    })
    return total
  }
  // A stream: its length is not known until it has been sent.
  return 0
}

/**
 * How long a request may take: a read 8 s; a write 20 s, or as long as its
 * body takes to send at 64 kbit/s when that is longer.
 */
export function deadlineFor(init?: RequestInit): number {
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return API_READ_DEADLINE_MS
  return Math.max(
    API_WRITE_DEADLINE_MS,
    Math.ceil(bodyBytes(init?.body) / SLOW_UPLINK_BYTES_PER_MS),
  )
}

/**
 * fetch(), ending by `deadlineMs` with an ApiDeadlineError.
 *
 * The deadline covers the body as well as the headers: the timer stays set
 * after the response arrives, so a body that stalls is cut off by the same
 * abort, and reading it rejects with an AbortError. Aborting a request that
 * has finished does nothing. A network failure rejects with the TypeError
 * fetch gave, and the caller's own signal still cancels the request.
 */
export async function fetchWithDeadline(
  input: string,
  init?: RequestInit,
  deadlineMs: number = deadlineFor(init),
): Promise<Response> {
  const controller = new AbortController()
  const callerSignal = init?.signal ?? null
  const followCaller = (): void => {
    controller.abort()
  }
  let expired = false
  const timer = setTimeout(
    () => {
      expired = true
      callerSignal?.removeEventListener('abort', followCaller)
      controller.abort()
    },
    Math.max(0, deadlineMs),
  )
  if (callerSignal !== null) {
    if (callerSignal.aborted) controller.abort()
    else callerSignal.addEventListener('abort', followCaller, { once: true })
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    clearTimeout(timer)
    callerSignal?.removeEventListener('abort', followCaller)
    if (expired) {
      noteUnreachable()
      throw new ApiDeadlineError(input, deadlineMs)
    }
    if (error instanceof TypeError) noteUnreachable()
    throw error
  }
}

let unreachableNoted = false

/** Tell the singer the servers are out of reach, once per page load. */
function noteUnreachable(): void {
  if (unreachableNoted) return
  unreachableNoted = true
  try {
    showNotification(API_UNREACHABLE_MESSAGE, 'warning', {
      channel: API_UNREACHABLE_CHANNEL,
    })
  } catch {
    // A notice must never turn a failed request into a different error.
  }
}

/** Test seam: a fresh page load, as far as the notice is concerned. */
export function resetApiUnreachableNoticeForTests(): void {
  unreachableNoted = false
}
