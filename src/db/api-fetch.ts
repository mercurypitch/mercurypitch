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
//
// That failure also closes a window in which further calls to the API are
// refused at once with an ApiUnreachableError, instead of each waiting out a
// deadline of its own (api-reachability.ts).
//
// The site worker (src/worker.ts: /api/uvr, /api/og, /api/share and
// /api/guided-media on the page's own host) is not the API host. A network
// that holds the API host still reaches it, and the site worker makes its own
// calls to the API from Cloudflare. So a call to it comes through here for
// its deadline only (`siteWorker`): the API's window never refuses it, its
// failure never closes that window, and it raises no notice about the API.

import type { ApiAdmission, ApiCallKind } from '@/db/api-reachability'
import { admitApiCall, apiAnswered, apiCallAbandoned, apiDidNotAnswer, } from '@/db/api-reachability'
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

/**
 * An address as an error may name it: without its query, which can carry a
 * one-time code (`/api/auth/reset-password?token=…`), and errors reach the
 * console and the developer log.
 */
function withoutQuery(url: string): string {
  const cut = url.search(/[?#]/)
  return cut === -1 ? url : url.slice(0, cut)
}

/** A request that did not finish by its deadline. Never retried. */
export class ApiDeadlineError extends Error {
  readonly url: string

  constructor(
    url: string,
    readonly deadlineMs: number,
  ) {
    const address = withoutQuery(url)
    super(`No answer from ${address} within ${deadlineMs} ms`)
    this.name = 'ApiDeadlineError'
    this.url = address
  }
}

/**
 * A call to the API that was not sent, because a recent one got no answer and
 * the window that opened is not over (api-reachability.ts). It is the network
 * failure that call would have met, found out at once. Never retried.
 */
export class ApiUnreachableError extends Error {
  readonly url: string

  constructor(url: string) {
    const address = withoutQuery(url)
    super(
      `Not sent to ${address}: the API did not answer a recent request, so it is being left alone for a while`,
    )
    this.name = 'ApiUnreachableError'
    this.url = address
  }
}

/** How a call through fetchWithDeadline goes. */
export interface ApiFetchOptions {
  /** How long the call may take. deadlineFor(init) when not given. */
  deadlineMs?: number
  /**
   * The deadline ends when the answer's headers arrive, and the body is the
   * caller's to bound with its own signal. For a download whose size is not
   * known when it is asked for (a separated stem): a fixed limit on reading
   * it would cut off a large one on a slow line.
   */
  untilHeaders?: boolean
  /**
   * A person asked for this call just now and is waiting for its answer:
   * Try again, a sign-in, a purchase. While the API is out of reach it is
   * sent anyway, as a probe, rather than refused on what an earlier request
   * found. Never set it on anything a page does by itself.
   */
  userAction?: boolean
  /**
   * A further attempt of a call that was already let through (ServerAdapter's
   * retries). Not refused, so the call that found the API out of reach keeps
   * the retries it always had.
   */
  retry?: boolean
  /** A call to the site worker, not the API host: a deadline and nothing else. */
  siteWorker?: boolean
}

function callKind(options: ApiFetchOptions): ApiCallKind {
  if (options.retry === true) return 'retry'
  if (options.userAction === true) return 'user-action'
  return 'call'
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
 * fetch(), ending by its deadline with an ApiDeadlineError. The third
 * argument is the deadline in milliseconds, or the options above.
 *
 * The deadline covers the body as well as the headers: the timer stays set
 * after the response arrives, so a body that stalls is cut off by the same
 * abort, and reading it rejects with an AbortError (unless `untilHeaders`).
 * Aborting a request that has finished does nothing. A network failure
 * rejects with the TypeError fetch gave, and the caller's own signal still
 * cancels the request.
 *
 * While the API is out of reach, a call to it rejects at once with an
 * ApiUnreachableError and nothing is sent.
 */
export async function fetchWithDeadline(
  input: string,
  init?: RequestInit,
  deadline: number | ApiFetchOptions = {},
): Promise<Response> {
  const options: ApiFetchOptions =
    typeof deadline === 'number' ? { deadlineMs: deadline } : deadline
  const deadlineMs = options.deadlineMs ?? deadlineFor(init)
  const admission = admit(input, options)
  const controller = new AbortController()
  const unfollow = followCaller(init?.signal, controller)
  let expired = false
  const timer = setTimeout(
    () => {
      expired = true
      unfollow()
      controller.abort()
    },
    Math.max(0, deadlineMs),
  )
  try {
    const response = await fetch(input, { ...init, signal: controller.signal })
    if (options.untilHeaders === true) clearTimeout(timer)
    // Any answer, an error status included: the server was reached.
    settle(admission, 'answered')
    return response
  } catch (error) {
    clearTimeout(timer)
    unfollow()
    if (expired) {
      settle(admission, 'no-answer')
      throw new ApiDeadlineError(input, deadlineMs)
    }
    // A network failure is no answer; a request its own caller cancelled
    // says nothing about the network.
    settle(admission, error instanceof TypeError ? 'no-answer' : 'abandoned')
    throw error
  }
}

/**
 * The API's leave for this call, or null for a call to the site worker,
 * which needs none. Refused: throws the ApiUnreachableError, and nothing is
 * sent.
 */
function admit(input: string, options: ApiFetchOptions): ApiAdmission | null {
  if (options.siteWorker === true) return null
  const admission = admitApiCall(callKind(options))
  if (admission === null) throw new ApiUnreachableError(input)
  return admission
}

/**
 * Abort `controller` when the caller's own signal aborts, for as long as the
 * request and its body are being read. Returns the way to stop following.
 */
function followCaller(
  callerSignal: AbortSignal | null | undefined,
  controller: AbortController,
): () => void {
  if (callerSignal == null) return () => undefined
  const abort = (): void => {
    controller.abort()
  }
  if (callerSignal.aborted) controller.abort()
  else callerSignal.addEventListener('abort', abort, { once: true })
  return () => {
    callerSignal.removeEventListener('abort', abort)
  }
}

/** How a call to the API ended, as its reachability hears it. */
function settle(
  admission: ApiAdmission | null,
  outcome: 'answered' | 'no-answer' | 'abandoned',
): void {
  if (admission === null) return
  if (outcome === 'answered') apiAnswered()
  else if (outcome === 'no-answer') noAnswer(admission)
  else apiCallAbandoned(admission)
}

/** A call to the API ended with no answer: by its deadline, or the network. */
function noAnswer(admission: ApiAdmission): void {
  apiDidNotAnswer(admission)
  noteUnreachable()
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
