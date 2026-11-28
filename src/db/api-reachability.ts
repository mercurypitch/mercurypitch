// ============================================================
// API reachability — whether the API host is worth asking, per page load
// ============================================================
//
// A call to the API that ends by its deadline, or with a network error, says
// the host is out of reach. Before this, every later call found that out for
// itself: on a network that held requests to the API host, each read waited
// its 8 s deadline, and a cloud write asked /api/auth/me for 8 s and then
// waited 20 s of its own (measured 28 Nov 2026).
//
// So the first call that gets no answer closes a window, 30 s at first, and a
// call made inside it is refused at once (ApiUnreachableError, api-fetch.ts)
// with nothing sent. When the window is over, the next call goes out as the
// one probe and the others are still refused while it is out. A probe that
// gets any answer, even an error status, clears the state: the server was
// reached. One that gets none doubles the window, up to five minutes. The
// browser's `online` event clears it at once, and so does coming back to a
// visible tab once the window is over: the page is about to ask for things
// again, and a probe that answered would only have let them through one at a
// time.
//
// Two kinds of call go out inside a window. A person's own request (Try
// again, a sign-in) is sent as a probe: they asked for an attempt now, and
// refusing it on what an earlier request found would leave the button dead
// for up to five minutes, whatever they fixed meanwhile. It costs one request
// at a person's pace. And a further attempt of a call that was let through
// (ServerAdapter's retries) is not refused, so the call that found the API
// out of reach keeps the retries it always had.
//
// Evidence has an order. A failure counts only if nothing has answered since
// its request went out (`epoch`): a request that ran out of time while a
// newer one got its answer says nothing about now. And a probe doubles only
// the window it was sent in (`window`): a press that sends several requests
// at once, a screen's reads, is one probe, so when none of them is answered
// the window doubles once, not once for each.
//
// In memory, for this page only: a new page load starts with the API
// reachable.

/** How long the API is left alone after a request to it got no answer. */
export const API_UNREACHABLE_FIRST_WINDOW_MS = 30_000

/** The longest the window grows to, doubling after each probe that fails. */
export const API_UNREACHABLE_LONGEST_WINDOW_MS = 5 * 60_000

/** What a call is: an ordinary one, a person's own, or a retry. */
export type ApiCallKind = 'call' | 'user-action' | 'retry'

/** A call that was let through, and what its outcome may change. */
export interface ApiAdmission {
  /** The state it went out under; see `epoch` below. */
  readonly epoch: number
  /** A failure doubles the window. */
  readonly probe: boolean
  /** The window it went out in; see `window` below. */
  readonly window: number
}

interface Reachability {
  /** Moves on whenever the API answers or the state is cleared. */
  epoch: number
  /** While out of reach: when the next probe may go. Null while reachable. */
  probeAt: number | null
  /** The window the next failed probe doubles. */
  windowMs: number
  /** Moves on whenever a window opens or doubles. */
  window: number
  /** The probe that came at the end of a window, while it is out. */
  probe: ApiAdmission | null
}

function reachable(epoch: number): Reachability {
  return {
    epoch,
    probeAt: null,
    windowMs: API_UNREACHABLE_FIRST_WINDOW_MS,
    window: 0,
    probe: null,
  }
}

let state = reachable(0)

/**
 * Let a call to the API go, or refuse it (null) while the API is out of
 * reach. A call let through reports how it ended through apiAnswered,
 * apiDidNotAnswer or apiCallAbandoned.
 */
export function admitApiCall(kind: ApiCallKind): ApiAdmission | null {
  const { epoch, window } = state
  if (state.probeAt === null || kind === 'retry') {
    return { epoch, probe: false, window }
  }
  if (kind === 'user-action') return { epoch, probe: true, window }
  if (state.probe !== null || Date.now() < state.probeAt) return null
  state.probe = { epoch, probe: true, window }
  return state.probe
}

/** A call got an answer, whatever its status: the API can be reached. */
export function apiAnswered(): void {
  state = reachable(state.epoch + 1)
}

/** A call got no answer: it ran out of time, or the network failed. */
export function apiDidNotAnswer(admission: ApiAdmission): void {
  if (state.probe === admission) state.probe = null
  if (admission.epoch !== state.epoch) return
  if (state.probeAt === null) {
    state.windowMs = API_UNREACHABLE_FIRST_WINDOW_MS
    state.probeAt = Date.now() + state.windowMs
    state.window += 1
    listenForTheWayBack()
    return
  }
  if (!admission.probe || admission.window !== state.window) return
  state.windowMs = Math.min(
    state.windowMs * 2,
    API_UNREACHABLE_LONGEST_WINDOW_MS,
  )
  state.probeAt = Date.now() + state.windowMs
  state.window += 1
}

/** The caller cancelled a call: nothing was learned about the network. */
export function apiCallAbandoned(admission: ApiAdmission): void {
  if (state.probe === admission) state.probe = null
}

/** Forget that the API was out of reach. */
function clear(): void {
  state = reachable(state.epoch + 1)
}

let listening = false

/** The browser's own signs that the network may be back. Installed once. */
function listenForTheWayBack(): void {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('online', clear)
  if (typeof document === 'undefined') return
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (state.probeAt !== null && Date.now() >= state.probeAt) clear()
  })
}

/**
 * Test seam: a fresh page load. src/tests/setup-common.ts calls it before
 * every test, because this state is the page's and a test is a page.
 */
export function resetApiReachabilityForTests(): void {
  state = reachable(0)
}
