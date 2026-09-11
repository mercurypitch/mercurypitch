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
// So this tracks POSITION. Every entry the app creates is stamped with an
// index in `history.state`; the boot entry's index is the floor. A back press
// has somewhere to go exactly while the current index is above it.
//
// Stamping on `hashchange` rather than at the push site is deliberate: the
// shell is not the only thing that navigates (the hash router pushes too, and
// so does a deep link), and an entry that arrives with no index is a new one
// however it got here. `replaceHash` preserves `history.state`, so a stamp
// survives the router's own state→URL sync.

const INDEX_KEY = 'mpShellIndex'

let bootIndex = 0
let currentIndex = 0
let highestIndex = 0

function readIndex(): number | null {
  const state: unknown = window.history.state
  if (state === null || typeof state !== 'object') return null
  const value = (state as Record<string, unknown>)[INDEX_KEY]
  return typeof value === 'number' ? value : null
}

function stamp(index: number): void {
  const existing: unknown = window.history.state
  const base =
    existing !== null && typeof existing === 'object'
      ? (existing as Record<string, unknown>)
      : {}
  window.history.replaceState({ ...base, [INDEX_KEY]: index }, '')
}

/** Where a back press stops: the entry the app launched on. */
export function installHistoryDepth(): () => void {
  const existing = readIndex()
  if (existing === null) {
    bootIndex = 0
    currentIndex = 0
    highestIndex = 0
    stamp(0)
  } else {
    // A reload keeps `history.state`. Anything below this entry belongs to a
    // document that is gone, so the floor moves up with it.
    bootIndex = existing
    currentIndex = existing
    highestIndex = existing
  }

  const onChange = (): void => {
    const index = readIndex()
    if (index === null) {
      highestIndex += 1
      currentIndex = highestIndex
      stamp(currentIndex)
      return
    }
    currentIndex = index
    if (index > highestIndex) highestIndex = index
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
  return currentIndex > bootIndex
}

/** Test seam: the indices, for a suite that drives real navigation. */
export function historyDepthState(): {
  boot: number
  current: number
  highest: number
} {
  return { boot: bootIndex, current: currentIndex, highest: highestIndex }
}
