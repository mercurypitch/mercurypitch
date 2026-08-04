// ============================================================
// mic-lock — one MercuryPitch tab holds the microphone at a time
// ============================================================
//
// Two tabs of this app both listening to the same device is never what anyone
// meant. On most systems both getUserMedia calls succeed, so nothing errors:
// the singer just finds that one tab scores them and the other shows a dead
// pitch line, or that the tab they forgot about an hour ago is quietly holding
// the recording light on. On the systems that *don't* allow it, they get
// "microphone is in use by another app" and no way to tell which app.
//
// So we arbitrate. A tab claims the lock before acquiring the device; a tab
// that finds it held is blocked and offered a hand-off ("use it here instead"),
// which asks the holder to let go and then takes it.
//
// localStorage is the source of truth — it survives a crashed tab and is
// readable synchronously — and BroadcastChannel is only the wake-up transport,
// so the two can never disagree about who holds what. A holder that stops
// heartbeating for STALE_MS is presumed dead and its record is ignored: that is
// the crashed-tab and killed-process case, which no polite release covers.

import { generateId } from './id'

const STORAGE_KEY = 'mercurypitch_mic_holder'
const CHANNEL_NAME = 'mercurypitch-mic'

/** How often the holder refreshes its record. */
const HEARTBEAT_MS = 2000
/** No heartbeat for this long and the holder is presumed gone. Three missed
 *  beats, so a throttled background tab isn't evicted for being slow. */
const STALE_MS = 6000
/** How long a hand-off waits for the holder to actually let go. */
const HANDOFF_TIMEOUT_MS = 2000

export interface MicLockRecord {
  tabId: string
  /** What the holding tab was doing, for the blocked tab's message. */
  label: string
  /** Timestamp of the last heartbeat, in epoch ms. */
  at: number
}

export type MicLockStatus = 'free' | 'mine' | 'other'

type LockMessage =
  | { type: 'claimed'; tabId: string }
  | { type: 'released'; tabId: string }
  | { type: 'yield'; to: string; from: string }

type LockListener = (
  status: MicLockStatus,
  holder: MicLockRecord | null,
) => void

/**
 * This tab's identity for the lifetime of the document. Regenerated on reload,
 * which is correct: a reloaded tab is a new claimant and its old record will
 * age out on its own.
 */
const TAB_ID = generateId()

let channel: BroadcastChannel | null = null
let heartbeat: ReturnType<typeof setInterval> | null = null
/** Returning a promise is how a handler says "not yet" — see the `yield`
 *  branch in {@link openChannel}. */
type YieldHandler = () => void | Promise<void>
let onYieldRequested: YieldHandler | null = null
const listeners = new Set<LockListener>()

function openChannel(): BroadcastChannel | null {
  if (channel !== null) return channel
  if (typeof BroadcastChannel === 'undefined') return null
  channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = (event: MessageEvent<LockMessage>) => {
    const msg = event.data
    if (msg.type === 'yield' && msg.to === TAB_ID) {
      // Someone wants the mic and we have it. The order matters: the record
      // must not say "free" until this tab has actually stopped capturing,
      // or the requester opens the device while ours is still open — which
      // is the one thing this module exists to prevent. So the handler is
      // awaited, and a tab that cannot let go simply never releases and the
      // requester times out still blocked.
      void (async () => {
        try {
          await onYieldRequested?.()
        } catch (error) {
          // A handler that throws has not necessarily failed to stop, and
          // holding the lock forever on its behalf helps nobody.
          console.warn('[mic-lock] yield handler threw:', error)
        }
        releaseMicLock()
      })()
      return
    }
    notify()
  }
  return channel
}

function post(message: LockMessage): void {
  openChannel()?.postMessage(message)
}

function readRaw(): MicLockRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as Partial<MicLockRecord>
    if (typeof parsed.tabId !== 'string' || typeof parsed.at !== 'number') {
      return null
    }
    return {
      tabId: parsed.tabId,
      label: typeof parsed.label === 'string' ? parsed.label : 'another tab',
      at: parsed.at,
    }
  } catch {
    // Private mode, disabled storage, or a corrupt record. Behaving as if the
    // mic were free is the right failure: worst case we are back to today.
    return null
  }
}

/** The current holder, or null when free. A stale record reads as free. */
export function readMicLock(now = Date.now()): MicLockRecord | null {
  const record = readRaw()
  if (record === null) return null
  if (now - record.at > STALE_MS) return null
  return record
}

export function micLockStatus(now = Date.now()): MicLockStatus {
  const record = readMicLock(now)
  if (record === null) return 'free'
  return record.tabId === TAB_ID ? 'mine' : 'other'
}

function holdsLock(): boolean {
  return micLockStatus() === 'mine'
}

/**
 * How the blocked tab will name the holder.
 *
 * The document title, not the consumer id: "audio-engine-2" tells the singer
 * nothing, while "MercuryPitch — Bohemian Rhapsody" is literally the label on
 * the tab they need to look at. Re-read on every heartbeat so it tracks the
 * title as the holder navigates.
 */
function tabLabel(): string {
  if (typeof document === 'undefined') return ''
  return document.title
}

function write(): void {
  try {
    const record: MicLockRecord = {
      tabId: TAB_ID,
      label: tabLabel(),
      at: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // See readRaw: storage being unavailable must not block the mic.
  }
}

/**
 * Claim the mic for this tab.
 *
 * Returns 'granted' when this tab may open the device, or 'held-elsewhere'
 * with the current holder — the caller should block and offer
 * {@link requestMicHandoff} rather than opening the device anyway.
 */
export function claimMicLock():
  | { outcome: 'granted' }
  | { outcome: 'held-elsewhere'; holder: MicLockRecord } {
  const holder = readMicLock()
  if (holder !== null && holder.tabId !== TAB_ID) {
    return { outcome: 'held-elsewhere', holder }
  }

  write()

  // localStorage has no compare-and-swap, so two tabs can both pass the check
  // above and both write — and the second write silently wins. Reading our own
  // record back is what turns that into an answer: the tab whose write did not
  // survive finds somebody else's id here and blocks, instead of walking away
  // believing it was granted a lock it does not hold.
  //
  // This is deliberately the whole story. An earlier version also broadcast a
  // `claimed` message and had whichever tab still held the record yield to the
  // lexicographically smaller id — which could not work, because the tab whose
  // write lost never held the record and so never ran the rule. The record is
  // the only source of truth; reading it is the only way to consult it.
  const settled = readMicLock()
  if (settled !== null && settled.tabId !== TAB_ID) {
    return { outcome: 'held-elsewhere', holder: settled }
  }

  if (heartbeat === null) {
    heartbeat = setInterval(() => {
      if (holdsLock()) write()
    }, HEARTBEAT_MS)
  }
  post({ type: 'claimed', tabId: TAB_ID })
  notify()
  return { outcome: 'granted' }
}

/** Give up this tab's claim. Safe to call when we never held it. */
export function releaseMicLock(): void {
  if (heartbeat !== null) {
    clearInterval(heartbeat)
    heartbeat = null
  }
  const record = readRaw()
  if (record !== null && record.tabId !== TAB_ID) return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do — the record will age out.
  }
  post({ type: 'released', tabId: TAB_ID })
  notify()
}

/**
 * Ask the current holder to let go, then claim.
 *
 * Resolves true once this tab holds the lock. Resolves false if the holder
 * never answered — a tab that is frozen rather than closed, say — in which
 * case the caller should leave the singer blocked rather than opening a second
 * handle behind a live one.
 */
export async function requestMicHandoff(): Promise<boolean> {
  const holder = readMicLock()
  if (holder === null || holder.tabId === TAB_ID) {
    return claimMicLock().outcome === 'granted'
  }

  openChannel()
  post({ type: 'yield', to: holder.tabId, from: TAB_ID })

  const freed = await waitForFree(HANDOFF_TIMEOUT_MS)
  if (!freed) return false
  return claimMicLock().outcome === 'granted'
}

function waitForFree(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const poll = setInterval(() => {
      if (micLockStatus() === 'free') {
        clearInterval(poll)
        resolve(true)
        return
      }
      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(poll)
        resolve(false)
      }
    }, 60)
  })
}

/**
 * Register what this tab does when another tab asks for the mic: stop
 * capturing, before the lock is handed over. Only one handler — MicManager's.
 *
 * Return a promise that settles once the device is genuinely closed. The lock
 * is not released until it does, so the handoff cannot hand over a name while
 * this tab still holds the hardware.
 */
export function setMicYieldHandler(handler: YieldHandler | null): void {
  onYieldRequested = handler
}

/** Watch for the holder changing (including in another tab). */
export function onMicLockChange(listener: LockListener): () => void {
  listeners.add(listener)
  openChannel()
  listener(micLockStatus(), readMicLock())
  return () => {
    listeners.delete(listener)
  }
}

function notify(): void {
  const status = micLockStatus()
  const holder = readMicLock()
  for (const listener of listeners) listener(status, holder)
}

if (typeof window !== 'undefined') {
  // A closing tab must not leave its record behind for STALE_MS — the next tab
  // would be told the mic is busy by a tab that no longer exists.
  window.addEventListener('pagehide', () => {
    if (holdsLock()) releaseMicLock()
  })
  // Another tab wrote the record. The `storage` event only fires in tabs that
  // did not make the change, which is exactly who needs to re-read it.
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) notify()
  })
}

/** This tab's lock identity. Exported for tests and diagnostics. */
export const micLockTabId = TAB_ID

/** Reset module state between tests. Not for application code. */
export function resetMicLockForTests(): void {
  if (heartbeat !== null) {
    clearInterval(heartbeat)
    heartbeat = null
  }
  onYieldRequested = null
  listeners.clear()
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
