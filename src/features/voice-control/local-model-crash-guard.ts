// ============================================================
// Local model crash guard — one attempt per document, never two
// ============================================================
//
// Loading whisper on a phone can take the whole tab with it. WebKit kills the
// content process under memory pressure and the browser silently reloads the
// document at the same URL; the engine preference and the enable flag are both
// persisted, so the fresh document starts the same load, and the SECOND kill
// is the one the user sees as "the tab crashed". Reported on an iPhone 13,
// iOS 27 beta, Chrome (WKWebView), on both the prod and dev deploys: switch to
// the on-device engine, wait, reload, then the tab dies for good.
//
// So a marker is armed just before the model load and cleared the moment the
// attempt settles. A document that starts while the marker is still set is a
// document that came back from a kill, and it must not try again.
//
// `pagehide` clears the marker too, which is what keeps a deliberate
// navigation mid-download from looking like a crash. A jetsammed process fires
// no `pagehide`, so that is exactly the line between the two. The bias is
// deliberate: a missed marker only costs one more attempt, while a spurious
// one would refuse an engine that works.
//
// sessionStorage, not localStorage: the marker belongs to this tab and this
// visit. A crash-reload keeps it; a new tab starts clean.

const STORAGE_KEY = 'mercurypitch:voice-local-model-attempt'

type GuardStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type GuardTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

export interface LocalModelGuardOptions {
  /** Test seam: defaults to `sessionStorage`. */
  storage?: GuardStorage
  /** Test seam: defaults to `window`. */
  target?: GuardTarget
}

function defaultStorage(): GuardStorage | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage
  } catch {
    // Private mode, or site data blocked. Without storage there is no guard —
    // the engine simply behaves as it did before this file existed.
    return undefined
  }
}

function defaultTarget(): GuardTarget | undefined {
  return typeof window === 'undefined' ? undefined : window
}

function resolve(options: LocalModelGuardOptions): {
  storage: GuardStorage | undefined
  target: GuardTarget | undefined
} {
  return {
    storage: options.storage ?? defaultStorage(),
    target: options.target ?? defaultTarget(),
  }
}

/** Removes the `pagehide` listener armed alongside the current marker. */
let releaseOnPageHide: (() => void) | null = null

/**
 * Mark a local-model load as in flight. Call immediately before the load;
 * every path out of it must call {@link disarmLocalModelAttempt}.
 */
export function armLocalModelAttempt(
  options: LocalModelGuardOptions = {},
): void {
  const { storage, target } = resolve(options)
  if (storage === undefined) return
  try {
    storage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {
    return
  }

  if (target === undefined) return
  releaseOnPageHide?.()
  const onPageHide = (): void => {
    disarmLocalModelAttempt(options)
  }
  target.addEventListener('pagehide', onPageHide)
  releaseOnPageHide = () => {
    target.removeEventListener('pagehide', onPageHide)
    releaseOnPageHide = null
  }
}

/** The attempt settled — loaded, failed, or was abandoned. Either outcome
 *  means the document survived, which is the only thing the marker tracks. */
export function disarmLocalModelAttempt(
  options: LocalModelGuardOptions = {},
): void {
  const { storage } = resolve(options)
  releaseOnPageHide?.()
  if (storage === undefined) return
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do: a marker that cannot be cleared costs one refused
    // attempt, which the notification explains and Settings can undo.
  }
}

/**
 * True when the previous document died with a model load in flight.
 *
 * CONSUMES the marker, so the answer is yes exactly once. The retry after that
 * is the user's to make — picking the on-device engine again in Settings is
 * one tap, and a device that was merely short of memory at the time deserves
 * that second chance without being told to clear site data first.
 */
export function localModelKilledTheDocument(
  options: LocalModelGuardOptions = {},
): boolean {
  const { storage } = resolve(options)
  if (storage === undefined) return false
  try {
    const armed = storage.getItem(STORAGE_KEY)
    if (armed === null) return false
    storage.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
