// ============================================================
// Studio editor presence — which live tab edits a project, held as a Web Lock
// ============================================================
//
// The IndexedDB lease (src/db/services/studio-editor-lease.ts) fences every
// write, but it can tell a live editor from a gone one only by its clock: a
// tab that closed, crashed or reloaded left its lease standing for up to 30
// seconds, so a reload opened its own project read only. A Web Lock is held
// for as long as the document that took it is alive, wherever its timers
// are, and the browser drops it as that document goes. A tab granted a
// project's lock therefore knows no other live tab edits that project, and
// may take over whatever lease the clock still shows.
//
// Where navigator.locks is missing, or refuses this page, every claim is
// granted and proves nothing: the lease's expiry is then the only sign
// another tab has gone, as it was before.

/** How long a claim waits on a tab that may be leaving before it calls the project another tab's. */
export const EDITOR_CLAIM_WAIT_MS = 1000

export interface EditorPresence {
  /** True when holding it proves no other live tab edits the project. */
  readonly exclusive: boolean
  /** Settles when another tab takes the project from this one. A release never settles it. */
  readonly lost: Promise<void>
  release(): void
}

export interface EditorClaim {
  /** How long to wait for a tab that is leaving, such as a reload's old document. */
  waitMs: number
  /** Take the project from the tab that holds it, at once. */
  steal: boolean
}

export interface EditorPresenceSource {
  /** This tab's presence on `projectId`, or null while another live tab holds it past the wait. */
  claim(projectId: string, claim: EditorClaim): Promise<EditorPresence | null>
}

const UNPROVEN: EditorPresence = {
  exclusive: false,
  lost: new Promise<void>(() => undefined),
  release: () => undefined,
}

/** No Web Locks: every claim is granted, proves nothing, and is never taken away. */
export const UNPROVEN_EDITOR_PRESENCE: EditorPresenceSource = {
  claim: () => Promise.resolve(UNPROVEN),
}

/** The lock's name: one per project, for this origin. */
export function editorLockName(projectId: string): string {
  return `mercurypitch-studio-editor:${projectId}`
}

/** Presence held as an exclusive Web Lock on the project. */
export function lockEditorPresence(locks: LockManager): EditorPresenceSource {
  return {
    claim(projectId, { waitMs, steal }) {
      return new Promise<EditorPresence | null>((resolve) => {
        let granted = false
        let releaseHeld = (): void => undefined
        const held = new Promise<void>((release) => {
          releaseHeld = release
        })
        let markLost = (): void => undefined
        const lost = new Promise<void>((settle) => {
          markLost = settle
        })
        // A steal cannot wait or be given up, so only a plain claim gets a
        // deadline; the lock manager refuses `steal` with a `signal`.
        const deadline = steal ? null : new AbortController()
        const timer =
          deadline === null
            ? undefined
            : setTimeout(() => deadline.abort(), waitMs)
        const options: LockOptions =
          deadline === null ? { steal: true } : { signal: deadline.signal }
        locks
          .request(editorLockName(projectId), options, () => {
            granted = true
            clearTimeout(timer)
            resolve({ exclusive: true, lost, release: releaseHeld })
            return held
          })
          .catch(() => {
            clearTimeout(timer)
            // Once held, the request fails only when another tab steals it.
            if (granted) markLost()
            else if (deadline?.signal.aborted === true) resolve(null)
            // Refused outright, as an opaque origin is: the lease alone decides.
            else resolve(UNPROVEN)
          })
      })
    },
  }
}

/** Web Locks where the browser has them, and unproven presence where it does not. */
export function defaultEditorPresence(): EditorPresenceSource {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.locks?.request !== 'function'
  )
    return UNPROVEN_EDITOR_PRESENCE
  return lockEditorPresence(navigator.locks)
}
