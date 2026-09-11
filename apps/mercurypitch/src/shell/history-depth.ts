// ============================================================
// How deep into the app are we, really
// ============================================================
//
// `history.length` is not the answer and looks exactly like it. It counts
// every entry the tab has ever had, never shrinks when you go back, and in a
// WebView starts at 1 and only grows — so a back handler keyed on it says
// "there is somewhere to go" forever. The measured failure: after the first
// rail tap, Android's back button called `history.back()` at the oldest entry
// (a no-op), reported the press handled, and the app could never be
// minimized again.
//
// So this tracks POSITION: every entry the app visits is stamped with an
// index, and a back press has somewhere to go while that index is above the
// first entry's.
//
// STAMPING CANNOT WAIT FOR AN EVENT. The first version learned about entries
// only through `hashchange` and `popstate`, and the hash router pushes with
// `history.pushState` (useHashRouter.ts, the tab-sync effect), which fires
// neither. Tapping a room cover in Rooms therefore left an unstamped entry,
// the index never moved, and Back minimized the app instead of returning to
// the gallery. Discovery is now lazy as well as event-driven: every question
// reconciles the live entry first, and an entry we have not stamped is a new
// one however it got here.
//
// The router stamps its own `routeIndex` on the entries it creates, and that
// is read as corroboration: an index above zero there is proof of something
// behind us even where our own numbering cannot see it.

const INDEX_KEY = 'mpShellIndex'

/**
 * The floor: the document's first entry, which install stamps.
 *
 * It does NOT move on a reload. A reloaded document keeps the session
 * history it had — the entries below are the same document's, still stamped,
 * and `history.back()` still reaches them — so moving the floor up to the
 * reloaded entry would throw away a back stack that works. This app reloads
 * itself on a failed chunk load (`installChunkLoadRecovery`), which is
 * exactly when a singer has the most to lose.
 */
const FLOOR_INDEX = 0

let currentIndex = FLOOR_INDEX
let highestIndex = FLOOR_INDEX

function stateObject(): Record<string, unknown> | null {
  const state: unknown = window.history.state
  if (state === null || typeof state !== 'object') return null
  return state as Record<string, unknown>
}

function readIndex(): number | null {
  const value = stateObject()?.[INDEX_KEY]
  return typeof value === 'number' ? value : null
}

/** The hash router's own position stamp, where it left one. */
function routerIndex(): number | null {
  const value = stateObject()?.routeIndex
  return typeof value === 'number' ? value : null
}

function stamp(index: number): void {
  window.history.replaceState(
    { ...(stateObject() ?? {}), [INDEX_KEY]: index },
    '',
  )
}

/**
 * Place the entry we are on, stamping it when it is new.
 *
 * Called from the events AND from every question, because a `pushState`
 * navigation announces itself with neither.
 */
function sync(): void {
  const index = readIndex()
  if (index !== null) {
    currentIndex = index
    if (index > highestIndex) highestIndex = index
    return
  }
  highestIndex += 1
  currentIndex = highestIndex
  stamp(currentIndex)
}

export function installHistoryDepth(): () => void {
  const existing = readIndex()
  if (existing === null) {
    currentIndex = FLOOR_INDEX
    highestIndex = FLOOR_INDEX
    stamp(FLOOR_INDEX)
  } else {
    // A reload lands back on a stamped entry. Take its number and keep the
    // floor where it is, so everything below stays reachable.
    currentIndex = existing
    highestIndex = Math.max(existing, FLOOR_INDEX)
  }

  const onChange = (): void => {
    sync()
  }
  window.addEventListener('hashchange', onChange)
  window.addEventListener('popstate', onChange)
  return () => {
    window.removeEventListener('hashchange', onChange)
    window.removeEventListener('popstate', onChange)
  }
}

/** True while there is an entry of this app's own to go back to. */
export function canGoBack(): boolean {
  sync()
  if (currentIndex > FLOOR_INDEX) return true
  const router = routerIndex()
  return router !== null && router > 0
}

/** Test seam: the indices, for a suite that drives real navigation. */
export function historyDepthState(): {
  floor: number
  current: number
  highest: number
} {
  return { floor: FLOOR_INDEX, current: currentIndex, highest: highestIndex }
}
